import type { GrowCapacitySlice } from "./capacity.js";
import {
  buildGrowDeliveryBinding,
  type GrowDeliveryBinding,
  type GrowDeliveryBindingFactsLineage,
  type GrowDeliveryBindingInput,
  type GrowDeliveryBindingLineage,
  type GrowDeliveryBindingProviderFacts,
} from "./delivery-binding.js";
import type {
  GenerationRun,
  GenerationRunSlot,
  GenerationRunSlotIdentity,
} from "./generation-run.js";
import type { GrowLiveFacts } from "./live-reconciliation.js";
import type { GrowReviewBundle } from "./review-bundle.js";

/** Stable, body-free join from generation slots through reviewed queue facts to delivery binding. */
export const GROW_GENERATION_REVIEW_DELIVERY_VERSION = "grow-generation-review-delivery-v1" as const;

export interface GrowGenerationReviewDeliveryBindingInput {
  /** Exact identity of one slot in the supplied generation run. */
  readonly slot: GenerationRunSlotIdentity;
  /** Must repeat the generation slot's pending review reference. */
  readonly reviewQueueRef: string | null;
  readonly reviewBundle: GrowReviewBundle | null;
  /** Placement is caller-supplied because a generation slot only has a day index. */
  readonly day: string | null;
  /** Exact delivery lineage, including treatment and experiment identity. */
  readonly candidateLineage: GrowDeliveryBindingLineage | null;
  readonly capacitySlice: GrowCapacitySlice | null;
  /** Already-read queue/scheduler facts. This join never reads the live systems. */
  readonly liveFacts: GrowLiveFacts | null;
  /** Legacy live facts may omit treatment identity; delivery requires an explicit enriched view. */
  readonly queueLineage?: GrowDeliveryBindingFactsLineage | null;
  readonly schedulerLineage?: GrowDeliveryBindingFactsLineage | null;
  readonly providerFacts: GrowDeliveryBindingProviderFacts | null;
  readonly deliveryMode?: "provider" | "manual" | "unknown" | string | null;
}

export interface GrowGenerationReviewDeliveryRow {
  readonly slot: GenerationRunSlot;
  readonly generatedArtifactRef: string | null;
  readonly reviewQueueRef: string | null;
  readonly reviewBundleId: string | null;
  readonly deliveryBinding: GrowDeliveryBinding;
  readonly readiness: { status: "ready" | "blocked"; blockers: string[] };
}

export interface GrowGenerationReviewDeliveryInput {
  readonly generationRun: GenerationRun;
  readonly bindings: readonly GrowGenerationReviewDeliveryBindingInput[];
}

export interface GrowGenerationReviewDelivery {
  readonly kind: "grow_generation_review_delivery";
  readonly version: typeof GROW_GENERATION_REVIEW_DELIVERY_VERSION;
  readonly sourceReference: string;
  readonly substanceReference: string;
  readonly rows: GrowGenerationReviewDeliveryRow[];
  readonly summary: {
    readonly slots: number;
    readonly bound: number;
    readonly ready: number;
    readonly blocked: number;
    readonly missingBindings: number;
  };
  readonly readiness: { status: "ready" | "blocked"; blockers: string[] };
  readonly bodyFree: true;
  readonly generatesCopy: false;
  readonly creatorBodyCopyAllowed: false;
  readonly humanApprovalRequired: true;
  readonly autoApproval: false;
  readonly autoScheduling: false;
  readonly autoPublishing: false;
  readonly sideEffects: "none";
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function assignmentKey(value: Record<string, string> | null): string {
  return value === null ? "null" : JSON.stringify(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

function slotKey(value: GenerationRunSlotIdentity): string {
  return JSON.stringify([
    value.platform,
    value.dayIndex,
    value.slotIndex,
    value.variantId,
    assignmentKey(value.experimentAssignment),
  ]);
}

function text(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function blockedBinding(binding: GrowDeliveryBinding, blockers: readonly string[]): GrowDeliveryBinding {
  const all = uniqueSorted([...binding.readiness.blockers, ...blockers]);
  if (all.length === binding.readiness.blockers.length && all.every((value, index) => value === binding.readiness.blockers[index])) {
    return binding;
  }
  return {
    ...binding,
    status: "blocked",
    readiness: { status: "blocked", blockers: all },
  };
}

function generationSlotBlockers(
  slot: GenerationRunSlot,
  generatedArtifactRefCounts: ReadonlyMap<string, number>,
  reviewQueueRefCounts: ReadonlyMap<string, number>,
): string[] {
  // A draft-batch generation run is expected to carry this blocker until Muxin reviews the
  // artifact. Do not make the later review-bundle join permanently blocked because that gate
  // is precisely what this adapter connects.
  const blockers = slot.blockers.filter((blocker) => blocker !== "human review is pending");
  if (slot.status === "missing") blockers.push("generation slot metadata is missing");
  if (slot.status === "duplicate") blockers.push("generation slot metadata is duplicated");
  if (slot.generatedArtifactRef !== null && (generatedArtifactRefCounts.get(slot.generatedArtifactRef) ?? 0) >= 2) {
    blockers.push("duplicate generated artifact reference");
  }
  if (slot.reviewQueueRef !== null && (reviewQueueRefCounts.get(slot.reviewQueueRef) ?? 0) >= 2) {
    blockers.push("duplicate human review queue reference");
  }
  return uniqueSorted(blockers);
}

function bindingFor(
  slot: GenerationRunSlot,
  input: GrowGenerationReviewDeliveryBindingInput | null,
  sourceReference: string,
): { binding: GrowDeliveryBinding; joinBlockers: string[] } {
  const joinBlockers: string[] = [];
  const slotArtifact = text(slot.generatedArtifactRef);
  const slotQueue = text(slot.reviewQueueRef);
  const reviewQueueRef = text(input?.reviewQueueRef);
  const reviewBundle = input?.reviewBundle ?? null;
  const liveFacts = input?.liveFacts ?? null;
  const candidateLineage = input?.candidateLineage ?? null;

  if (input === null) joinBlockers.push("review and delivery binding is missing");
  if (slotArtifact === null) joinBlockers.push("generation slot artifact reference is missing");
  if (slotQueue === null) joinBlockers.push("generation slot review queue reference is missing");
  if (reviewQueueRef === null) joinBlockers.push("review queue binding reference is missing");
  if (slotQueue !== null && reviewQueueRef !== null && slotQueue !== reviewQueueRef) {
    joinBlockers.push("review queue reference does not match generation slot");
  }
  if (input?.liveFacts === null || input?.liveFacts === undefined) joinBlockers.push("live queue and scheduler facts are missing");
  if (input?.day === null || input?.day === undefined || text(input.day) === null) joinBlockers.push("delivery day is missing");
  if (input?.candidateLineage === null || input?.candidateLineage === undefined) joinBlockers.push("delivery lineage is missing");
  if (reviewBundle !== null && reviewBundle.sourceRef.id !== sourceReference) {
    joinBlockers.push("review bundle source does not match generation run");
  }
  const bundleQueueRef = text(reviewBundle?.reviewQueueRef);
  if (reviewBundle !== null && bundleQueueRef === null) {
    joinBlockers.push("review bundle review queue reference is missing");
  } else if (reviewBundle !== null && reviewQueueRef !== null && bundleQueueRef !== reviewQueueRef) {
    joinBlockers.push("review bundle does not match review queue reference");
  }
  if (candidateLineage !== null && candidateLineage.variantId !== slot.variantId) {
    joinBlockers.push("delivery lineage variant does not match generation slot");
  }

  const queueFacts = liveFacts?.queue === null || liveFacts?.queue === undefined
    ? null
    : {
      ...liveFacts.queue,
      lineage: input?.queueLineage ?? liveFacts.queue.lineage,
    };
  const schedulerFacts = liveFacts?.scheduler === null || liveFacts?.scheduler === undefined
    ? null
    : {
      ...liveFacts.scheduler,
      lineage: input?.schedulerLineage ?? liveFacts.scheduler.lineage,
    };
  if (liveFacts !== null && liveFacts.readiness.status !== "ready") {
    joinBlockers.push(...liveFacts.readiness.blockers.map((blocker) => `live facts: ${blocker}`));
  }

  const raw = {
    reviewBundle: reviewBundle as GrowReviewBundle,
    candidate: {
      id: slotArtifact ?? "",
      day: text(input?.day) ?? "",
      platform: slot.platform,
      variantId: slot.variantId,
      lineage: candidateLineage as GrowDeliveryBindingLineage,
    },
    capacitySlice: input?.capacitySlice ?? null,
    queueFacts,
    schedulerFacts,
    providerFacts: input?.providerFacts ?? null,
    deliveryMode: input?.deliveryMode,
  } as unknown as GrowDeliveryBindingInput;
  return {
    binding: blockedBinding(buildGrowDeliveryBinding(raw), joinBlockers),
    joinBlockers,
  };
}

/**
 * Join every generation slot to its explicit review bundle, live facts, and delivery binding.
 * The adapter is read-only: it never creates a queue row, approves a bundle, claims a slot,
 * schedules, publishes, or reads body text.
 */
export function buildGrowGenerationReviewDelivery(input: GrowGenerationReviewDeliveryInput): GrowGenerationReviewDelivery {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new Error("generation review delivery input must be an object");
  if (input.generationRun?.version !== "grow-generation-run-v1") throw new Error("generationRun.version must be grow-generation-run-v1");
  if (!Array.isArray(input.bindings)) throw new Error("bindings must be an array");
  if (!Array.isArray(input.generationRun.slots)) throw new Error("generationRun.slots must be an array");

  const planned = new Map(input.generationRun.slots.map((slot) => [slotKey(slot), slot]));
  const generatedArtifactRefCounts = new Map<string, number>();
  const reviewQueueRefCounts = new Map<string, number>();
  for (const slot of input.generationRun.slots) {
    if (slot.generatedArtifactRef !== null) {
      generatedArtifactRefCounts.set(slot.generatedArtifactRef, (generatedArtifactRefCounts.get(slot.generatedArtifactRef) ?? 0) + 1);
    }
    if (slot.reviewQueueRef !== null) {
      reviewQueueRefCounts.set(slot.reviewQueueRef, (reviewQueueRefCounts.get(slot.reviewQueueRef) ?? 0) + 1);
    }
  }
  const supplied = new Map<string, GrowGenerationReviewDeliveryBindingInput>();
  for (const current of input.bindings) {
    const key = slotKey(current.slot);
    if (!planned.has(key)) throw new Error(`binding references unknown generation slot: ${key}`);
    if (supplied.has(key)) throw new Error(`duplicate generation review delivery binding: ${key}`);
    supplied.set(key, current);
  }

  const rows = input.generationRun.slots.map((slot) => {
    const current = supplied.get(slotKey(slot)) ?? null;
    const { binding, joinBlockers } = bindingFor(slot, current, input.generationRun.sourceReference);
    const blockers = uniqueSorted([
      ...generationSlotBlockers(slot, generatedArtifactRefCounts, reviewQueueRefCounts),
      ...joinBlockers,
      ...binding.readiness.blockers,
    ]);
    const effectiveBinding = blockedBinding(binding, blockers);
    return {
      slot,
      generatedArtifactRef: slot.generatedArtifactRef,
      reviewQueueRef: slot.reviewQueueRef,
      reviewBundleId: effectiveBinding.reviewBundleId,
      deliveryBinding: effectiveBinding,
      readiness: { status: blockers.length === 0 ? "ready" as const : "blocked" as const, blockers },
    };
  });
  const topBlockers = rows.flatMap((row) => row.readiness.blockers.map((blocker) => `${slotKey(row.slot)}: ${blocker}`));
  const ready = rows.filter((row) => row.readiness.status === "ready").length;
  const bound = rows.filter((row) => supplied.has(slotKey(row.slot))).length;
  return {
      kind: "grow_generation_review_delivery",
      version: GROW_GENERATION_REVIEW_DELIVERY_VERSION,
      sourceReference: input.generationRun.sourceReference,
      substanceReference: input.generationRun.substanceReference,
      rows,
      summary: {
        slots: rows.length,
        bound,
        ready,
        blocked: rows.length - ready,
        missingBindings: rows.length - bound,
      },
      readiness: { status: topBlockers.length === 0 ? "ready" : "blocked", blockers: uniqueSorted(topBlockers) },
      bodyFree: true,
      generatesCopy: false,
      creatorBodyCopyAllowed: false,
      humanApprovalRequired: true,
      autoApproval: false,
      autoScheduling: false,
      autoPublishing: false,
      sideEffects: "none",
  };
}

export const createGrowGenerationReviewDelivery = buildGrowGenerationReviewDelivery;
export const buildGenerationReviewDelivery = buildGrowGenerationReviewDelivery;
