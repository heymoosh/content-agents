import type { GrowExperimentOutcomeFamily } from "../grow/experiment-slice.js";
import type { ContentRequest, ContentRequestInput } from "./content-request.js";
import { readContentRequest } from "./content-request-store.js";
import { safeFolder } from "./rows.js";
import {
  buildSignalsExperimentSciencePrompt,
  parseSignalsExperimentScienceResult,
  type SignalsExperimentEvidence,
  type SignalsExperimentScienceInput,
} from "./signals-experiment-recommendation.js";
import { loadLearningEvaluation, type LearningEvaluation } from "../venture/learning-evaluation.js";
import { buildVentureExperimentPlan, type VentureExperimentPlan } from "./venture-experiment-handoff.js";

export interface VentureLearningExperimentRequest {
  readonly ventureSlug: string;
  readonly evaluationId: string;
  readonly contentRequestId: string;
  readonly engine: "claude" | "grok" | "codex";
  readonly evidenceFamily: GrowExperimentOutcomeFamily;
  readonly minimumSample: number;
  readonly minimumDays: number;
  readonly availablePublishingUnits: number;
  readonly availableDays: number;
}

export type VentureLearningExperimentResult =
  | { readonly status: "recommended"; readonly envelope: VentureExperimentPlan }
  | { readonly status: "no-experiment"; readonly reason: string; readonly evidenceRefs: string[] };

type Deps = {
  readonly loadEvaluation?: (slug: string, id: string) => LearningEvaluation;
  readonly readRequest?: (folder: string) => Promise<ContentRequest>;
  readonly resolveFolder?: (id: string) => string;
  readonly now?: () => string;
};

function positive(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${field} must be a positive integer`);
  return value;
}

function contentInput(request: ContentRequest): ContentRequestInput {
  return {
    id: request.id, origin: request.origin, descriptor: request.descriptor, originalInput: request.originalInput,
    treatments: request.selections.treatments, media: request.selections.media, platforms: request.selections.platforms,
    includeUntreatedControl: request.control.enabled, ventureId: request.ventureId, ventureSource: request.ventureSource,
    sourceProvenance: request.sourceProvenance, sourceContext: request.sourceContext,
  };
}

function evidenceKind(evaluation: LearningEvaluation): SignalsExperimentEvidence["kind"] {
  return evaluation.evidenceTier === "directional" || evaluation.evidenceTier === "controlled" ? "inference"
    : evaluation.recommendation === "test" ? "hypothesis" : "observation";
}

function scienceInput(
  request: ContentRequest,
  evaluation: LearningEvaluation,
  input: VentureLearningExperimentRequest,
  now: string,
): SignalsExperimentScienceInput {
  if (request.id !== input.contentRequestId) throw new Error("Content request identity does not match its folder");
  if (request.origin !== "venture" || request.ventureId !== input.ventureSlug) throw new Error("Content request does not belong to this Venture");
  if (request.experiment) throw new Error("an experiment-tagged Content request cannot propose another experiment");
  if (request.variants.length < 2) throw new Error("configure at least two Content variants before proposing the experiment");
  const evidence = evaluation.evidenceRefs.map((ref): SignalsExperimentEvidence => ({
    id: ref,
    family: input.evidenceFamily,
    kind: evidenceKind(evaluation),
    summary: `${evaluation.rationale} Proposed test: ${evaluation.proposedChange}`,
    sampleSize: null,
    window: evaluation.decidedAt ?? now,
    caveats: [...new Set([...evaluation.caveats, `Claim ceiling: ${evaluation.claimCeiling}`])],
  }));
  return {
    recommendationId: `venture-experiment-${evaluation.evaluationId}`,
    createdAt: now,
    inputContext: {
      sourceKind: request.sourceProvenance?.canonicalUrl?.includes("substack.com") ? "substack-note" : request.originalInput.length > 600 ? "long-form" : "raw-thought",
      cutId: request.id,
      cutRationale: `Muxin accepted Venture learning evaluation ${evaluation.evaluationId}: ${evaluation.proposedChange}`,
      sourceRefs: request.sourceProvenance?.sourceLines.map((line) => `${request.id}#L${line}`) ?? [request.ventureSource?.artifactId ?? request.id],
    },
    evidence,
    candidates: request.variants.map((variant) => ({
      id: variant.identity.id,
      platform: variant.platform,
      format: variant.media === "none" ? "post" : variant.media,
      treatment: variant.identity.kind === "control" ? "untreated-control" : variant.treatments.join("+") || "configured-treatment",
      variables: { treatment: variant.identity.kind === "control" ? "untreated-control" : variant.treatments.join("+") || "configured-treatment" },
    })),
    availableOutcomeFamilies: [input.evidenceFamily],
    minimumSample: input.minimumSample,
    minimumDays: input.minimumDays,
  };
}

/** Plan one approved Venture test through the canonical Experiment planner. No copy is generated. */
export async function proposeVentureLearningExperiment(
  input: VentureLearningExperimentRequest,
  runScience: (prompt: string, engine: VentureLearningExperimentRequest["engine"]) => Promise<string>,
  deps: Deps = {},
): Promise<VentureLearningExperimentResult> {
  const minimumSample = positive(input.minimumSample, "minimumSample");
  const minimumDays = positive(input.minimumDays, "minimumDays");
  const availablePublishingUnits = positive(input.availablePublishingUnits, "availablePublishingUnits");
  const availableDays = positive(input.availableDays, "availableDays");
  if (!(input.evidenceFamily === "attention" || input.evidenceFamily === "conversation" || input.evidenceFamily === "audience" || input.evidenceFamily === "business")) throw new Error("evidenceFamily is invalid");
  const evaluation = (deps.loadEvaluation ?? loadLearningEvaluation)(input.ventureSlug, input.evaluationId);
  if (evaluation.status !== "accepted" || evaluation.decidedBy !== "muxin" || evaluation.recommendation !== "test" || evaluation.target !== "experiment") {
    throw new Error("an accepted Muxin-reviewed Venture test recommendation is required");
  }
  if (availablePublishingUnits < minimumSample || availableDays < minimumDays) {
    return { status: "no-experiment", reason: `Declared publishing capacity cannot carry ${minimumSample} units over ${minimumDays} days.`, evidenceRefs: [...evaluation.evidenceRefs] };
  }
  const folder = (deps.resolveFolder ?? safeFolder)(input.contentRequestId);
  const request = await (deps.readRequest ?? readContentRequest)(folder);
  const now = (deps.now ?? (() => new Date().toISOString()))();
  const science = scienceInput(request, evaluation, { ...input, minimumSample, minimumDays }, now);
  const prompt = buildSignalsExperimentSciencePrompt(science, { source: "venture-reviewed-learning" }).prompt;
  const parsed = parseSignalsExperimentScienceResult(await runScience(prompt, input.engine), science, input.engine, { source: "venture-reviewed-learning" });
  if (parsed.status === "no-experiment") return parsed;
  const variablesByVariant = Object.fromEntries(science.candidates.map((candidate) => [candidate.id, { [parsed.recommendation.controlledVariable]: candidate.treatment }]));
  return {
    status: "recommended",
    envelope: buildVentureExperimentPlan({
      evaluation,
      recommendation: parsed.recommendation,
      contentRequest: contentInput(request),
      variablesByVariant,
      capacity: { availablePublishingUnits, availableDays },
    }),
  };
}
