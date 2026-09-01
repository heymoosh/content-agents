import { createHash } from "node:crypto";
import { buildExperimentPlan, type ExperimentPlan, type ExperimentPlanInput } from "../grow/experiment-content-handoff.js";
import type { GrowExperimentOutcomeFamily, SignalsExperimentRecommendationInput } from "../grow/experiment-slice.js";
import type { ContentRequestInput } from "./content-request.js";
import type { ClaimCeiling, EvidenceTier } from "./signals-venture-handoff-store.js";
import type { LearningEvaluation } from "../venture/learning-evaluation.js";

export const VENTURE_EXPERIMENT_HANDOFF_VERSION = "venture-experiment-handoff-v1" as const;
export type { ClaimCeiling, EvidenceTier, LearningEvaluation };
export type AcceptedVentureLearningEvaluation = LearningEvaluation;

export interface VentureExperimentContext {
  readonly ventureId: string; readonly phase: number; readonly inputRef: string; readonly evaluationId: string;
  readonly evidenceTier: EvidenceTier; readonly claimCeiling: ClaimCeiling;
  readonly evidenceRefs: readonly string[]; readonly caveats: readonly string[];
}
export interface VentureExperimentPlan {
  readonly kind: "venture_experiment_plan"; readonly version: typeof VENTURE_EXPERIMENT_HANDOFF_VERSION;
  readonly plan: ExperimentPlan; readonly ventureContext: VentureExperimentContext; readonly digest: string;
  readonly planApproval: "pending-muxin"; readonly copyApproval: "pending-in-content";
}
export interface VentureExperimentHandoffInput {
  readonly evaluation: AcceptedVentureLearningEvaluation;
  /** This recommendation is separately produced by the canonical Signals/Experiment planner. */
  readonly recommendation: SignalsExperimentRecommendationInput;
  readonly contentRequest: ContentRequestInput;
  readonly variablesByVariant: ExperimentPlanInput["variablesByVariant"];
  readonly capacity: ExperimentPlanInput["capacity"];
}

function fail(message: string): never { throw new TypeError(`venture-experiment-handoff: ${message}`); }
function text(value: unknown, field: string): string { if (typeof value !== "string" || value.trim() === "") fail(`${field} is required`); return value.trim(); }
function refs(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || item.trim() === "")) fail(`${field} must contain at least one non-empty ref`);
  const normalized = value.map((item) => (item as string).trim());
  if (new Set(normalized).size !== normalized.length) fail(`${field} must contain unique refs`);
  return normalized;
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
function digest(value: unknown): string { return `sha256:${createHash("sha256").update(stable(value), "utf8").digest("hex")}`; }
export function ventureExperimentPlanDigest(value: Omit<VentureExperimentPlan, "digest">): string { return digest(value); }
export function assertVentureExperimentPlanIntegrity(value: VentureExperimentPlan): void {
  const { digest: supplied, ...envelope } = value;
  if (supplied !== ventureExperimentPlanDigest(envelope)) fail("envelope digest drifted");
}
function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) { for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child); Object.freeze(value); }
  return value;
}

function assertAcceptedEvaluation(evaluation: LearningEvaluation): void {
  if (!evaluation || evaluation.status !== "accepted" || evaluation.decidedBy !== "muxin") fail("learning evaluation must be accepted by Muxin");
  if (evaluation.recommendation !== "test" || evaluation.target !== "experiment") fail("only a test evaluation targeting an experiment can cross this adapter");
  text(evaluation.evaluationId, "evaluation.evaluationId"); text(evaluation.ventureSlug, "evaluation.ventureSlug"); text(evaluation.inputRef, "evaluation.inputRef");
  refs(evaluation.evidenceRefs, "evaluation.evidenceRefs");
  if (!evaluation.decidedAt || Number.isNaN(Date.parse(evaluation.decidedAt))) fail("accepted evaluation must have a valid decision timestamp");
  const proposal = evaluation.downstreamProposal;
  if (!proposal || proposal.target !== "experiment" || proposal.evaluationId !== evaluation.evaluationId || proposal.inputRef !== evaluation.inputRef) fail("accepted test evaluation must include its downstream experiment proposal");
  if (proposal.claimCeiling !== evaluation.claimCeiling || proposal.evidenceTier !== evaluation.evidenceTier) fail("downstream proposal provenance drifted from evaluation");
}
function assertRecommendation(recommendation: SignalsExperimentRecommendationInput, evaluation: LearningEvaluation): void {
  if (!recommendation || recommendation.owner !== "signals" || recommendation.version !== "signals-experiment-recommendation-v1") fail("recommendation must be produced by the canonical Signals/Experiment planner");
  text(recommendation.id, "recommendation.id"); text(recommendation.controlledVariable, "recommendation.controlledVariable");
  const recommendationRefs = refs(recommendation.evidenceRefs, "recommendation.evidenceRefs");
  const evaluationRefs = new Set(evaluation.evidenceRefs);
  if (recommendationRefs.some((ref) => !evaluationRefs.has(ref))) fail("planner recommendation evidence refs must be a subset of evaluation evidence refs");
}
function assertApprovedVentureSource(request: ContentRequestInput, evaluation: LearningEvaluation): number {
  if (request.origin !== "venture" || request.ventureId !== evaluation.ventureSlug) fail("Content request must name the same Venture as the accepted evaluation");
  const source = request.ventureSource;
  if (!source || source.approval.editorialStatus !== "approved" || source.approval.provenance !== "muxin-editorial-approval") fail("an approved Venture source is required");
  if (!Number.isInteger(source.phase) || source.phase < 1) fail("approved Venture source phase is invalid");
  return source.phase;
}

/** Build a body-free pending plan. Recommendation ownership remains Signals/Experiment planner-owned. */
export function buildVentureExperimentPlan(input: VentureExperimentHandoffInput): VentureExperimentPlan {
  const evaluation = input.evaluation; assertAcceptedEvaluation(evaluation); assertRecommendation(input.recommendation, evaluation);
  const phase = assertApprovedVentureSource(input.contentRequest, evaluation);
  if (input.contentRequest.experiment != null) fail("Content request is already experiment-tagged");
  if (!input.variablesByVariant || Object.keys(input.variablesByVariant).length < 2) fail("at least two exact configured variants are required");
  const variableKeys = Object.values(input.variablesByVariant).map((variables) => Object.keys(variables ?? {}));
  if (variableKeys.some((keys) => keys.length !== 1) || new Set(variableKeys.map((keys) => keys[0])).size !== 1) fail("exactly one controlled variable must be configured consistently for every variant");
  const plan = buildExperimentPlan({ recommendation: input.recommendation, contentRequest: input.contentRequest, variablesByVariant: input.variablesByVariant, capacity: input.capacity });
  if (plan.priority === "deferred" || !plan.capacity.sufficient) fail("declared capacity is inadequate for this Venture experiment");
  const context: VentureExperimentContext = { ventureId: evaluation.ventureSlug, phase, inputRef: evaluation.inputRef, evaluationId: evaluation.evaluationId, evidenceTier: evaluation.evidenceTier, claimCeiling: evaluation.claimCeiling, evidenceRefs: [...evaluation.evidenceRefs], caveats: [...evaluation.caveats] };
  const envelope = { kind: "venture_experiment_plan" as const, version: VENTURE_EXPERIMENT_HANDOFF_VERSION, plan, ventureContext: context, planApproval: "pending-muxin" as const, copyApproval: "pending-in-content" as const };
  return freezeDeep({ ...envelope, digest: ventureExperimentPlanDigest(envelope) });
}
export const createVentureExperimentPlan = buildVentureExperimentPlan;
export type VentureExperimentOutcomeFamily = GrowExperimentOutcomeFamily;
