import { inspectDraftBatch } from "./draft-batch-inspection.js";
import type { DraftBatch, DraftRequest } from "./draft-batch.js";
import { createGenerationRun, type GenerationRun, type GenerationRunSlotIdentity } from "./generation-run.js";
import type { GrowTreatmentCoverage } from "./treatment-coverage.js";
import type { VolumePlan } from "./volume-plan.js";

/** Stable, body-free join from explicit draft requests to generation-run slots. */
export const DRAFT_BATCH_GENERATION_RUN_VERSION = "grow-draft-batch-generation-run-v1" as const;

export interface DraftBatchRunBinding extends GenerationRunSlotIdentity {
  readonly requestId: string;
  readonly generatedArtifactRef: string;
  readonly reviewQueueRef: string;
}

export interface DraftBatchGenerationRunInput {
  readonly draftBatch: DraftBatch;
  readonly volumePlan: VolumePlan;
  readonly treatmentCoverage: GrowTreatmentCoverage;
  readonly bindings: readonly DraftBatchRunBinding[];
}

export interface DraftBatchGenerationRun {
  readonly kind: "grow_draft_batch_generation_run";
  readonly version: typeof DRAFT_BATCH_GENERATION_RUN_VERSION;
  readonly sourceThoughtRef: string;
  readonly sourceArtifactRef: string;
  readonly generationRun: GenerationRun;
  readonly bindings: DraftBatchRunBinding[];
  readonly unboundRequestIds: string[];
  readonly readiness: { status: "ready" | "blocked"; blockers: string[] };
  readonly generatesCopy: false;
  readonly creatorBodyCopyAllowed: false;
  readonly humanReviewRequired: true;
  readonly autoApproval: false;
  readonly autoScheduling: false;
  readonly autoPublishing: false;
  readonly sideEffects: "none";
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
}

function assignment(value: unknown, label: string): Record<string, string> | null {
  if (value === null) return null;
  const source = object(value, label);
  const result: Record<string, string> = {};
  for (const [key, option] of Object.entries(source)) {
    if (key.trim() === "") throw new Error(`${label} contains an empty dimension name`);
    result[key] = text(option, `${label}.${key}`);
  }
  return Object.fromEntries(Object.entries(result).sort(([left], [right]) => left.localeCompare(right)));
}

function assignmentKey(value: Record<string, string> | null): string {
  return value === null ? "null" : JSON.stringify(Object.entries(value));
}

function identityKey(value: GenerationRunSlotIdentity): string {
  return JSON.stringify([value.platform, value.dayIndex, value.slotIndex, value.variantId, assignmentKey(value.experimentAssignment)]);
}

function bindingKey(value: DraftBatchRunBinding): string {
  return `${value.requestId}\u0000${identityKey(value)}`;
}

function normalizedBinding(value: unknown, index: number): DraftBatchRunBinding {
  const source = object(value, `bindings[${index + 1}]`);
  const allowed = new Set([
    "requestId", "platform", "dayIndex", "slotIndex", "variantId", "experimentAssignment",
    "generatedArtifactRef", "reviewQueueRef",
  ]);
  for (const field of Object.keys(source)) if (!allowed.has(field)) throw new Error(`bindings[${index + 1}] contains unsupported field "${field}"`);
  return {
    requestId: text(source.requestId, `bindings[${index + 1}].requestId`),
    platform: text(source.platform, `bindings[${index + 1}].platform`),
    dayIndex: nonNegativeInteger(source.dayIndex, `bindings[${index + 1}].dayIndex`),
    slotIndex: nonNegativeInteger(source.slotIndex, `bindings[${index + 1}].slotIndex`),
    variantId: text(source.variantId, `bindings[${index + 1}].variantId`),
    experimentAssignment: assignment(source.experimentAssignment, `bindings[${index + 1}].experimentAssignment`),
    generatedArtifactRef: text(source.generatedArtifactRef, `bindings[${index + 1}].generatedArtifactRef`),
    reviewQueueRef: text(source.reviewQueueRef, `bindings[${index + 1}].reviewQueueRef`),
  };
}

function requestFor(requests: readonly DraftRequest[], requestId: string): DraftRequest {
  const request = requests.find((candidate) => candidate.id === requestId);
  if (request === undefined) throw new Error(`binding references unknown draft request "${requestId}"`);
  return request;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

/**
 * Join already-created artifact/review references to a validated draft batch.
 * This function never creates copy, reads source substance, invokes a model, or persists data.
 */
export function buildDraftBatchGenerationRun(input: DraftBatchGenerationRunInput): DraftBatchGenerationRun {
  const envelope = object(input, "draft batch generation run input");
  const allowed = new Set(["draftBatch", "volumePlan", "treatmentCoverage", "bindings"]);
  for (const field of Object.keys(envelope)) if (!allowed.has(field)) throw new Error(`generation run input contains unsupported field "${field}"`);

  const inspection = inspectDraftBatch(envelope.draftBatch);
  const draftBatch = envelope.draftBatch as DraftBatch;
  const volumePlan = envelope.volumePlan as VolumePlan;
  const treatmentCoverage = envelope.treatmentCoverage as GrowTreatmentCoverage;
  if (volumePlan.sourceReference !== inspection.sourceThoughtRef) {
    throw new Error("volumePlan.sourceReference must match draft batch sourceThoughtRef");
  }
  if (volumePlan.substanceReference !== inspection.sourceArtifactRef) {
    throw new Error("volumePlan.substanceReference must match draft batch sourceArtifactRef");
  }
  if (!Array.isArray(envelope.bindings)) throw new Error("bindings must be an array");

  const bindings = envelope.bindings.map(normalizedBinding);
  const seenBindingKeys = new Set<string>();
  const seenRequestIds = new Set<string>();
  for (const binding of bindings) {
    const key = bindingKey(binding);
    if (seenBindingKeys.has(key)) throw new Error(`duplicate binding: ${key}`);
    seenBindingKeys.add(key);
    if (seenRequestIds.has(binding.requestId)) throw new Error(`duplicate binding for request ${binding.requestId}`);
    seenRequestIds.add(binding.requestId);
    const request = requestFor(draftBatch.requests, binding.requestId);
    if (binding.generatedArtifactRef !== request.expectedOutputArtifactRef) {
      throw new Error(`binding generatedArtifactRef must equal request expectedOutputArtifactRef for ${binding.requestId}`);
    }
  }

  const unboundRequestIds = draftBatch.requests
    .map((request) => request.id)
    .filter((requestId) => !seenRequestIds.has(requestId));
  if (unboundRequestIds.length > 0) throw new Error(`unbound draft request: ${unboundRequestIds.join(", ")}`);

  const candidates = bindings.map((binding) => ({
    platform: binding.platform,
    dayIndex: binding.dayIndex,
    slotIndex: binding.slotIndex,
    variantId: binding.variantId,
    experimentAssignment: binding.experimentAssignment,
    generatedArtifactRef: binding.generatedArtifactRef,
    reviewQueueRef: binding.reviewQueueRef,
    reviewQueueStatus: "pending" as const,
    readiness: { status: "blocked" as const, blockers: ["human review is pending"] },
  }));
  const generationRun = createGenerationRun({ volumePlan, treatmentCoverage, candidates });
  const blockers = sortedUnique(generationRun.readiness.blockers);
  return {
    kind: "grow_draft_batch_generation_run",
    version: DRAFT_BATCH_GENERATION_RUN_VERSION,
    sourceThoughtRef: inspection.sourceThoughtRef,
    sourceArtifactRef: inspection.sourceArtifactRef,
    generationRun,
    bindings: bindings.map((binding) => ({ ...binding, experimentAssignment: binding.experimentAssignment ? { ...binding.experimentAssignment } : null })),
    unboundRequestIds,
    readiness: { status: blockers.length === 0 ? "ready" : "blocked", blockers },
    generatesCopy: false,
    creatorBodyCopyAllowed: false,
    humanReviewRequired: true,
    autoApproval: false,
    autoScheduling: false,
    autoPublishing: false,
    sideEffects: "none",
  };
}

export const createDraftBatchGenerationRun = buildDraftBatchGenerationRun;
export const buildGenerationRunFromDraftBatch = buildDraftBatchGenerationRun;
