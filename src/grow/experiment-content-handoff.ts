import { createHash } from "node:crypto";
import { basename } from "node:path";
import { buildContentRequest, type ContentRequest, type ContentRequestInput } from "../review/content-request.js";
import { authorizeGuiContentRequest, writeContentRequest } from "../review/content-request-store.js";
import type { SignalsExperimentRecommendationInput } from "./experiment-slice.js";

export const EXPERIMENT_CONTENT_HANDOFF_VERSION = "experiment-content-handoff-v1" as const;

export interface ExperimentPlanInput {
  readonly recommendation: SignalsExperimentRecommendationInput;
  readonly contentRequest: ContentRequestInput;
  readonly variablesByVariant: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly capacity: { readonly availablePublishingUnits: number; readonly availableDays: number };
}

export interface ExperimentPlan {
  readonly kind: "experiment_plan";
  readonly version: typeof EXPERIMENT_CONTENT_HANDOFF_VERSION;
  readonly recommendation: SignalsExperimentRecommendationInput;
  readonly contentRequest: ContentRequest;
  readonly variablesByVariant: Record<string, Record<string, string>>;
  readonly priority: "high" | "medium" | "deferred";
  readonly priorityReason: string;
  readonly capacity: { readonly availablePublishingUnits: number; readonly availableDays: number; readonly sufficient: boolean };
  readonly digest: string;
  readonly generatesCopy: false;
  readonly authorizesCopyApproval: false;
}

export interface ExperimentPlanDecisionInput {
  readonly status: "approved" | "declined";
  readonly decidedBy: "muxin";
  readonly decidedAt: string;
  readonly rationale?: string;
}

export interface ExperimentPlanDecision {
  readonly kind: "experiment_plan_decision";
  readonly version: typeof EXPERIMENT_CONTENT_HANDOFF_VERSION;
  readonly proposalDigest: string;
  readonly status: "approved" | "declined";
  readonly decidedBy: "muxin";
  readonly decidedAt: string;
  readonly rationale: string;
  readonly authorizesGeneration: boolean;
  readonly authorizesCopyApproval: false;
  readonly digest: string;
}

export interface RankedExperimentPlans {
  readonly ready: ExperimentPlan[];
  readonly deferred: ExperimentPlan[];
  readonly ranking: "confidence-descending";
}

export interface AppliedExperimentContentHandoff {
  readonly kind: "experiment_content_handoff";
  readonly version: typeof EXPERIMENT_CONTENT_HANDOFF_VERSION;
  readonly experimentId: string;
  readonly contentRequest: ContentRequest;
  readonly generatedIds: string[];
  readonly copyApproval: "pending-in-content";
  readonly contentIsCanonicalReviewSurface: true;
}

export interface ExperimentContentHandoffDeps {
  readonly generate?: (slug: string, request: ContentRequest) => Promise<{ ids: string[]; existing?: boolean }>;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(stable(value), "utf8").digest("hex")}`;
}

function timestamp(value: string, field: string): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error(`${field} must be a valid timestamp`);
  return value;
}

function normalizeVariables(value: ExperimentPlanInput["variablesByVariant"], request: ContentRequest): Record<string, Record<string, string>> {
  const variantIds = request.variants.map((variant) => variant.identity.id).sort();
  if (JSON.stringify(Object.keys(value ?? {}).sort()) !== JSON.stringify(variantIds)) throw new Error("experiment variables must cover every configured variant exactly");
  return Object.fromEntries(variantIds.map((variantId) => {
    const variables = value[variantId];
    if (!variables || Object.keys(variables).length === 0) throw new Error(`experiment variables for ${variantId} must not be empty`);
    return [variantId, Object.fromEntries(Object.entries(variables).sort(([a], [b]) => a.localeCompare(b)).map(([name, option]) => {
      if (!name.trim() || !option.trim()) throw new Error(`experiment variables for ${variantId} must be non-empty`);
      return [name.trim(), option.trim()];
    }))];
  }));
}

/** Build a body-copy-free plan. Candidate identities are deterministic Content configuration ids. */
export function buildExperimentPlan(input: ExperimentPlanInput): ExperimentPlan {
  if (input.contentRequest.experiment != null) throw new Error("experiment plan input cannot pre-authorize its own Content request");
  const contentRequest = buildContentRequest(input.contentRequest);
  if (contentRequest.variants.length < 2) throw new Error("experiment plan requires at least two configured variants");
  const candidateIds = new Set(contentRequest.variants.map((variant) => variant.identity.id));
  const expected = input.recommendation.expectedOutcome;
  if (!candidateIds.has(expected.variantId) || !candidateIds.has(expected.comparisonRef) || expected.variantId === expected.comparisonRef) {
    throw new Error("Signals recommendation comparison must name two configured Content variants");
  }
  const variablesByVariant = normalizeVariables(input.variablesByVariant, contentRequest);
  const capacity = {
    availablePublishingUnits: input.capacity.availablePublishingUnits,
    availableDays: input.capacity.availableDays,
    sufficient: false,
  };
  if (!Number.isInteger(capacity.availablePublishingUnits) || capacity.availablePublishingUnits < 0) throw new Error("available publishing units must be a non-negative integer");
  if (!Number.isInteger(capacity.availableDays) || capacity.availableDays < 0) throw new Error("available days must be a non-negative integer");
  capacity.sufficient = capacity.availablePublishingUnits >= input.recommendation.minimumSample && capacity.availableDays >= input.recommendation.minimumDays;
  const priority: ExperimentPlan["priority"] = input.recommendation.confidence === "low" || !capacity.sufficient ? "deferred" : input.recommendation.confidence;
  const priorityReason = priority === "deferred"
    ? input.recommendation.confidence === "low"
      ? "Deferred because Signals reported low confidence; do not spend generation or publishing capacity."
      : `Deferred because declared capacity (${capacity.availablePublishingUnits} units over ${capacity.availableDays} days) cannot satisfy the ${input.recommendation.minimumSample}-unit, ${input.recommendation.minimumDays}-day plan.`
    : `${priority[0]!.toUpperCase()}${priority.slice(1)}-confidence Signals proposal; rank before lower-confidence work.`;
  const base = {
    kind: "experiment_plan" as const,
    version: EXPERIMENT_CONTENT_HANDOFF_VERSION,
    recommendation: input.recommendation,
    contentRequest,
    variablesByVariant,
    capacity,
    priority,
    priorityReason,
    generatesCopy: false as const,
    authorizesCopyApproval: false as const,
  };
  return { ...base, digest: digest(base) };
}

export function rankExperimentPlans(plans: readonly ExperimentPlan[]): RankedExperimentPlans {
  const unique = new Set<string>();
  for (const plan of plans) {
    if (unique.has(plan.recommendation.id)) throw new Error(`duplicate experiment recommendation ${plan.recommendation.id}`);
    unique.add(plan.recommendation.id);
  }
  const order = { high: 0, medium: 1, deferred: 2 } as const;
  const sorted = [...plans].sort((left, right) => order[left.priority] - order[right.priority]
    || left.recommendation.createdAt.localeCompare(right.recommendation.createdAt)
    || left.recommendation.id.localeCompare(right.recommendation.id));
  return { ready: sorted.filter((plan) => plan.priority !== "deferred"), deferred: sorted.filter((plan) => plan.priority === "deferred"), ranking: "confidence-descending" };
}

export function assertExperimentPlanCanGenerate(proposal: ExperimentPlan): void {
  const capacity = proposal.capacity;
  if (!capacity?.sufficient
    || capacity.availablePublishingUnits < proposal.recommendation.minimumSample
    || capacity.availableDays < proposal.recommendation.minimumDays
    || proposal.recommendation.confidence === "low"
    || proposal.priority === "deferred") {
    throw new Error("deferred experiment or insufficient declared capacity cannot authorize generation");
  }
}

export function approveExperimentPlan(proposal: ExperimentPlan, input: ExperimentPlanDecisionInput): ExperimentPlanDecision {
  if (input.decidedBy !== "muxin") throw new Error("only Muxin can decide an experiment plan");
  const decidedAt = timestamp(input.decidedAt, "decidedAt");
  const rationale = input.rationale?.trim() ?? "";
  if (input.status === "declined" && !rationale) throw new Error("declining an experiment plan requires a rationale");
  if (input.status === "approved") assertExperimentPlanCanGenerate(proposal);
  const base = {
    kind: "experiment_plan_decision" as const,
    version: EXPERIMENT_CONTENT_HANDOFF_VERSION,
    proposalDigest: proposal.digest,
    status: input.status,
    decidedBy: "muxin" as const,
    decidedAt,
    rationale,
    authorizesGeneration: input.status === "approved",
    authorizesCopyApproval: false as const,
  };
  return { ...base, digest: digest(base) };
}

/**
 * Persist an approved plan as an ordinary configured Content request and invoke the canonical
 * generator. The generator owns treatment/editor/voice/CTA/media checks and writes only pending
 * review rows. Distinct content folders allow multiple experiment ids to progress concurrently.
 */
export async function applyApprovedExperimentToContent(
  folder: string,
  proposal: ExperimentPlan,
  decision: ExperimentPlanDecision,
  deps: ExperimentContentHandoffDeps = {},
): Promise<AppliedExperimentContentHandoff> {
  if (decision.proposalDigest !== proposal.digest) throw new Error("experiment plan decision does not match proposal");
  if (decision.status !== "approved" || decision.decidedBy !== "muxin" || !decision.authorizesGeneration || decision.authorizesCopyApproval !== false) {
    throw new Error("approved Muxin plan decision is required before Content generation");
  }
  assertExperimentPlanCanGenerate(proposal);
  if (basename(folder) !== proposal.contentRequest.id) throw new Error("Content folder must match the experiment request id");
  const input: ContentRequestInput = {
    id: proposal.contentRequest.id,
    origin: proposal.contentRequest.origin,
    descriptor: proposal.contentRequest.descriptor,
    originalInput: proposal.contentRequest.originalInput,
    treatments: proposal.contentRequest.selections.treatments,
    media: proposal.contentRequest.selections.media,
    platforms: proposal.contentRequest.selections.platforms,
    includeUntreatedControl: proposal.contentRequest.control.enabled,
    ventureId: proposal.contentRequest.ventureId,
    ventureSource: proposal.contentRequest.ventureSource,
    sourceProvenance: proposal.contentRequest.sourceProvenance,
    sourceContext: proposal.contentRequest.sourceContext,
    experiment: {
      id: proposal.recommendation.id,
      recommendationId: proposal.recommendation.id,
      planProposalDigest: proposal.digest,
      planDecisionDigest: decision.digest,
      planApprovedAt: decision.decidedAt,
      hypothesis: proposal.recommendation.hypothesis,
      controlledVariable: proposal.recommendation.controlledVariable,
      variablesByVariant: proposal.variablesByVariant,
    },
  };
  // Re-read the approved cut and its source-line provenance from disk at the last responsible
  // moment. Plan approval authorizes generation, never a client-supplied replacement source.
  const safeInput = await authorizeGuiContentRequest(folder, input);
  const contentRequest = await writeContentRequest(folder, safeInput);
  const generate = deps.generate ?? (async (slug, request) => {
    const { generateConfiguredContent } = await import("../review/jobs.js");
    return generateConfiguredContent(slug, request);
  });
  const generated = await generate(basename(folder), contentRequest);
  return {
    kind: "experiment_content_handoff",
    version: EXPERIMENT_CONTENT_HANDOFF_VERSION,
    experimentId: proposal.recommendation.id,
    contentRequest,
    generatedIds: [...generated.ids],
    copyApproval: "pending-in-content",
    contentIsCanonicalReviewSurface: true,
  };
}
