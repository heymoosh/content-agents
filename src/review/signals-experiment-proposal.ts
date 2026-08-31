import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import type { ContentRequest, ContentRequestInput } from "./content-request.js";
import { readContentRequest } from "./content-request-store.js";
import { safeFolder } from "./rows.js";
import { buildExperimentPlan, type ExperimentPlan } from "../grow/experiment-content-handoff.js";
import {
  buildSignalsExperimentSciencePrompt,
  parseSignalsExperimentScienceResult,
  type SignalsExperimentEvidence,
  type SignalsExperimentScienceInput,
} from "./signals-experiment-recommendation.js";
import { validateUsableResearchDossier, type ResearchDossier } from "../patterns/research-dossier.js";
import type { GrowExperimentOutcomeFamily } from "../grow/experiment-slice.js";

export interface SignalsExperimentProposalRequest {
  readonly contentRequestId: string;
  readonly engine: "claude" | "grok" | "codex";
  readonly evidenceDossierPath: string;
  readonly evidenceFamily: GrowExperimentOutcomeFamily;
  readonly minimumSample: number;
  readonly minimumDays: number;
  readonly availablePublishingUnits: number;
  readonly availableDays: number;
}

export type SignalsExperimentProposalResult =
  | { readonly status: "recommended"; readonly plan: ExperimentPlan }
  | { readonly status: "no-experiment"; readonly reason: string; readonly evidenceRefs: string[] };

function contentInput(request: ContentRequest): ContentRequestInput {
  return {
    id: request.id, origin: request.origin, descriptor: request.descriptor, originalInput: request.originalInput,
    treatments: request.selections.treatments, media: request.selections.media, platforms: request.selections.platforms,
    includeUntreatedControl: request.control.enabled, ventureId: request.ventureId, ventureSource: request.ventureSource,
    sourceProvenance: request.sourceProvenance, sourceContext: request.sourceContext,
  };
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${field} must be a positive integer`);
  return value;
}

async function readReviewedDossier(path: string): Promise<ResearchDossier> {
  const reviewRoot = resolve(process.cwd(), "docs", "reviews");
  const target = resolve(process.cwd(), path);
  const withinReviews = relative(reviewRoot, target);
  if (!path.trim() || withinReviews.startsWith("..") || withinReviews === "" || withinReviews.includes("..") || withinReviews.startsWith("/")) {
    throw new Error("evidenceDossierPath must name a reviewed JSON dossier under docs/reviews");
  }
  if (!target.endsWith(".json")) throw new Error("evidenceDossierPath must name a JSON dossier");
  return validateUsableResearchDossier(JSON.parse(await readFile(target, "utf8")));
}

function dossierEvidence(dossier: ResearchDossier, dossierPath: string, family: GrowExperimentOutcomeFamily): SignalsExperimentEvidence[] {
  const evidenceById = new Map(dossier.boundedEvidence.included.map((row) => [row.id, row]));
  const dates = dossier.boundedEvidence.included.map((row) => row.collectedAt).sort();
  const window = dates.length > 1 ? `${dates[0]}/${dates[dates.length - 1]}` : dates[0] ?? dossier.usabilityDecision!.decidedAt;
  const disposition = dossier.usabilityDecision!.disposition;
  if (disposition !== "observation" && disposition !== "hypothesis" && disposition !== "experiment_input") {
    throw new Error("reviewed dossier disposition is not usable experiment evidence");
  }
  const kind: SignalsExperimentEvidence["kind"] = disposition === "experiment_input" ? "hypothesis" : disposition;
  return dossier.summaries.map((summary) => ({
    id: `dossier:${dossier.digest}#${summary.id}`,
    family,
    kind,
    summary: summary.statement,
    sampleSize: summary.evidenceRefs.length,
    window,
    caveats: [...new Set([
      ...summary.caveats,
      ...summary.evidenceRefs.flatMap((id) => evidenceById.get(id)?.caveats ?? []),
      `Reviewed dossier: ${dossierPath}`,
      `Muxin decision: ${dossier.usabilityDecision!.note}`,
    ])],
  }));
}

function scienceInput(request: ContentRequest, input: SignalsExperimentProposalRequest, evidence: readonly SignalsExperimentEvidence[], now: string): SignalsExperimentScienceInput {
  if (request.experiment) throw new Error("an experiment-tagged Content request cannot propose another experiment");
  if (request.variants.length < 2) throw new Error("configure at least two Content variants before asking Signals for an experiment");
  const qualifiedEvidence = evidence.map((row, index) => {
    if (!row || typeof row !== "object") throw new Error(`evidence[${index}] is invalid`);
    if (!row.id?.trim() || !row.summary?.trim() || !row.window?.trim()) throw new Error(`evidence[${index}] requires id, summary, and window`);
    if (!["attention", "conversation", "audience", "business"].includes(row.family)) throw new Error(`evidence[${index}] has an invalid outcome family`);
    if (!["observation", "inference", "hypothesis"].includes(row.kind)) throw new Error(`evidence[${index}] has an invalid evidence kind`);
    if (row.sampleSize !== null && (!Number.isInteger(row.sampleSize) || row.sampleSize < 0)) throw new Error(`evidence[${index}] sampleSize is invalid`);
    if (!Array.isArray(row.caveats) || row.caveats.some((item) => typeof item !== "string" || !item.trim())) throw new Error(`evidence[${index}] caveats must be non-empty strings`);
    return { ...row, id: row.id.trim(), summary: row.summary.trim(), window: row.window.trim(), caveats: row.caveats.map((item) => item.trim()) };
  });
  if (!qualifiedEvidence.length) throw new Error("qualified evidence is required");
  if (new Set(qualifiedEvidence.map((row) => row.id)).size !== qualifiedEvidence.length) throw new Error("qualified evidence ids must be unique");
  const sourceLines = request.sourceProvenance?.sourceLines ?? [];
  const sourceKind = request.sourceProvenance?.canonicalUrl?.includes("substack.com") ? "substack-note"
    : request.originalInput.length > 600 ? "long-form" : "raw-thought";
  const candidates = request.variants.map((variant) => ({
    id: variant.identity.id,
    platform: variant.platform,
    format: variant.media === "none" ? "post" : variant.media,
    treatment: variant.identity.kind === "control" ? "untreated-control" : variant.treatments.join("+") || "configured-treatment",
    variables: { platform: variant.platform, media: variant.media, treatment: variant.identity.kind === "control" ? "untreated-control" : variant.treatments.join("+") || "configured-treatment" },
  }));
  return {
    recommendationId: `signals-experiment:${request.id}:${Date.parse(now)}`,
    createdAt: now,
    inputContext: {
      sourceKind,
      cutId: request.sourceProvenance?.kind === "approved-cut" ? request.sourceProvenance.lens! : request.id,
      cutRationale: request.descriptor,
      sourceRefs: sourceLines.map((line) => `${request.id}#L${line}`),
    },
    evidence: qualifiedEvidence,
    candidates,
    availableOutcomeFamilies: [...new Set(qualifiedEvidence.map((row) => row.family))].sort(),
    minimumSample: positiveInteger(input.minimumSample, "minimumSample"),
    minimumDays: positiveInteger(input.minimumDays, "minimumDays"),
  };
}

export async function proposeSignalsExperiment(
  input: SignalsExperimentProposalRequest,
  runScience: (prompt: string, engine: SignalsExperimentProposalRequest["engine"]) => Promise<string>,
  deps: { readonly readRequest?: (folder: string) => Promise<ContentRequest>; readonly resolveFolder?: (id: string) => string; readonly readDossier?: (path: string) => Promise<unknown>; readonly now?: () => string } = {},
): Promise<SignalsExperimentProposalResult> {
  // Validate operator-declared bounds before any file or model work. The route performs the same
  // check, but this function is also a production boundary and must fail closed on direct calls.
  const minimumSample = positiveInteger(input.minimumSample, "minimumSample");
  const minimumDays = positiveInteger(input.minimumDays, "minimumDays");
  const availablePublishingUnits = positiveInteger(input.availablePublishingUnits, "availablePublishingUnits");
  const availableDays = positiveInteger(input.availableDays, "availableDays");
  if (availablePublishingUnits < minimumSample || availableDays < minimumDays) {
    return {
      status: "no-experiment",
      reason: `Declared publishing capacity cannot carry the minimum sample of ${minimumSample} units over ${minimumDays} days.`,
      evidenceRefs: [],
    };
  }
  const folder = (deps.resolveFolder ?? safeFolder)(input.contentRequestId);
  const request = await (deps.readRequest ?? readContentRequest)(folder);
  if (request.id !== input.contentRequestId) throw new Error("Content request identity does not match its folder");
  if (!(["attention", "conversation", "audience", "business"] as const).includes(input.evidenceFamily)) throw new Error("evidenceFamily is invalid");
  const dossier = validateUsableResearchDossier(await (deps.readDossier ?? readReviewedDossier)(input.evidenceDossierPath));
  const evidence = dossierEvidence(dossier, input.evidenceDossierPath, input.evidenceFamily);
  const now = (deps.now ?? (() => new Date().toISOString()))();
  const science = scienceInput(request, input, evidence, now);
  const prompt = buildSignalsExperimentSciencePrompt(science).prompt;
  const parsed = parseSignalsExperimentScienceResult(await runScience(prompt, input.engine), science, input.engine);
  if (parsed.status === "no-experiment") return parsed;
  const variablesByVariant = Object.fromEntries(science.candidates.map((candidate) => [candidate.id, candidate.variables]));
  return {
    status: "recommended",
    plan: buildExperimentPlan({
      recommendation: parsed.recommendation,
      contentRequest: contentInput(request),
      variablesByVariant,
      capacity: { availablePublishingUnits, availableDays },
    }),
  };
}
