import type { GrowCapacitySlice } from "./capacity.js";
import type { GrowDeliveryLineage } from "./delivery-record.js";
import type { GrowQueueFacts, GrowSchedulerFacts } from "./queue-facts.js";
import type { GrowReviewBundle } from "./review-bundle.js";

/** Stable, body-free read-side join from reviewed Grow work to delivery evidence. */
export const GROW_DELIVERY_BINDING_VERSION = "grow-delivery-binding-v1" as const;

export type GrowDeliveryBindingStatus = "approved" | "scheduled" | "live_confirmed";
export type GrowDeliveryBindingDeliveryMode = "provider" | "manual" | "unknown";
export type GrowDeliveryBindingLiveCheckStatus = "not_confirmed" | "confirmed" | "unavailable";

export interface GrowDeliveryBindingLineage {
  readonly sourceId: string;
  readonly cutId: string;
  readonly variantId: string;
  readonly treatmentId: string;
  readonly experimentId: string;
}

export interface GrowDeliveryBindingCandidate {
  readonly id: string;
  readonly day: string;
  readonly platform: string;
  readonly variantId?: string | null;
  readonly lineage: GrowDeliveryBindingLineage;
}

/** Legacy queue/scheduler lineage plus the exact treatment identity required by this seam. */
export type GrowDeliveryBindingFactsLineage = GrowDeliveryLineage & {
  readonly treatmentId?: string | null;
};

export type GrowDeliveryBindingQueueFacts = Omit<GrowQueueFacts, "lineage"> & {
  readonly lineage: GrowDeliveryBindingFactsLineage | null;
};

export type GrowDeliveryBindingSchedulerFacts = Omit<GrowSchedulerFacts, "lineage"> & {
  readonly lineage: GrowDeliveryBindingFactsLineage | null;
};

export interface GrowDeliveryBindingLiveCheck {
  readonly status: GrowDeliveryBindingLiveCheckStatus;
  readonly checkedAt: string | null;
  readonly liveAt: string | null;
}

export interface GrowDeliveryBindingProviderFacts {
  readonly provider: string;
  readonly reference: string | null;
  readonly scheduledAt: string | null;
  readonly liveCheck: GrowDeliveryBindingLiveCheck | null;
}

export interface GrowDeliveryBindingInput {
  readonly reviewBundle: GrowReviewBundle;
  readonly candidate: GrowDeliveryBindingCandidate;
  readonly capacitySlice: GrowCapacitySlice | null;
  readonly queueFacts: GrowDeliveryBindingQueueFacts | null;
  readonly schedulerFacts: GrowDeliveryBindingSchedulerFacts | null;
  readonly providerFacts: GrowDeliveryBindingProviderFacts | null;
  /** Manual or unknown delivery is never treated as ready. */
  readonly deliveryMode?: GrowDeliveryBindingDeliveryMode | string | null;
}

export interface GrowDeliveryBindingReconciliation {
  readonly status: "matching" | "drifted";
  readonly drift: string[];
  readonly sideEffects: "none";
}

export interface GrowDeliveryBinding {
  readonly kind: "grow_delivery_binding";
  readonly version: typeof GROW_DELIVERY_BINDING_VERSION;
  readonly deliveryId: string;
  readonly reviewBundleId: string | null;
  readonly candidateId: string | null;
  readonly day: string | null;
  readonly platform: string | null;
  readonly status: GrowDeliveryBindingStatus;
  readonly lineage: GrowDeliveryBindingLineage | null;
  readonly capacitySlice: GrowCapacitySlice | null;
  readonly queueFacts: GrowDeliveryBindingQueueFacts | null;
  readonly schedulerFacts: GrowDeliveryBindingSchedulerFacts | null;
  readonly providerFacts: GrowDeliveryBindingProviderFacts | null;
  readonly checks: {
    readonly review: "approved" | "blocked";
    readonly lineage: "matching" | "blocked" | "drifted";
    readonly capacity: "available" | "blocked";
    readonly queue: "matching" | "drifted" | "blocked";
    readonly scheduler: "matching" | "drifted" | "blocked";
    readonly provider: "matching" | "missing" | "drifted";
    readonly live: "confirmed" | "not_confirmed" | "unavailable" | "not_required";
  };
  readonly reconciliation: GrowDeliveryBindingReconciliation;
  readonly readiness: { readonly status: "ready" | "blocked"; readonly blockers: string[] };
  readonly bodyFree: true;
  readonly generatesCopy: false;
  readonly creatorBodyCopyAllowed: false;
  readonly humanApprovalRequired: true;
  readonly autoApproval: false;
  readonly autoScheduling: false;
  readonly autoPublishing: false;
  readonly sideEffects: "none";
}

type JsonRecord = Record<string, unknown>;
type BindingFacts = GrowDeliveryBindingQueueFacts | GrowDeliveryBindingSchedulerFacts;

const QUEUE_STATUSES = new Set(["approved", "scheduled", "published", "measured"]);
const SCHEDULER_STATUSES = new Set(["unscheduled", "scheduled", "published", "measured"]);
const LINEAGE_KEYS = ["sourceId", "cutId", "variantId", "treatmentId", "experimentId"] as const;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function validTimestamp(value: string | null): boolean {
  return value !== null && !Number.isNaN(Date.parse(value));
}

function readCandidateLineage(value: unknown, blockers: string[]): GrowDeliveryBindingLineage | null {
  if (!isRecord(value)) {
    blockers.push("candidate lineage is missing");
    return null;
  }
  const result = {} as Record<(typeof LINEAGE_KEYS)[number], string>;
  let complete = true;
  for (const key of LINEAGE_KEYS) {
    const item = text(value[key]);
    if (item === null) {
      blockers.push("candidate " + key + " lineage is missing");
      complete = false;
    } else {
      result[key] = item;
    }
  }
  return complete ? result as GrowDeliveryBindingLineage : null;
}

function reviewLineage(
  bundle: GrowReviewBundle | null,
  candidateLineage: GrowDeliveryBindingLineage | null,
  blockers: string[],
): GrowDeliveryBindingLineage | null {
  if (bundle === null || !Array.isArray(bundle.lineage)) {
    blockers.push("review lineage is missing");
    return null;
  }

  const refs = bundle.lineage;
  const refsFor = (recordType: string) => refs.filter((ref) => ref?.recordType === recordType);
  const one = (recordType: string): string | null => {
    const matches = refsFor(recordType);
    if (matches.length === 0) blockers.push(recordType + " lineage is missing");
    if (matches.length > 1) blockers.push("duplicate " + recordType + " lineage");
    return matches.length === 1 ? text(matches[0]?.id) : null;
  };

  const sourceId = one("source");
  const cutId = one("cut");
  const treatmentId = one("treatment");
  const experimentId = one("experiment");
  const variantId = candidateLineage?.variantId ?? null;
  const variantMatches = variantId === null ? [] : refsFor("variant").filter((ref) => text(ref.id) === variantId);
  if (variantId === null) blockers.push("variant lineage is missing");
  else if (variantMatches.length === 0) blockers.push("candidate variant lineage is missing");
  else if (variantMatches.length > 1) blockers.push("duplicate variant lineage");

  if (bundle.sourceRef?.recordType !== "source" || text(bundle.sourceRef?.id) !== sourceId) {
    blockers.push("review source reference does not match lineage");
  }
  if (bundle.cutRef?.recordType !== "cut" || text(bundle.cutRef?.id) !== cutId) {
    blockers.push("review cut reference does not match lineage");
  }

  const declaredVariants = Array.isArray(bundle.variantRefs) ? bundle.variantRefs : [];
  const candidateVariants = declaredVariants.filter((ref) => text(ref?.id) === variantId);
  if (candidateVariants.length !== 1) blockers.push("candidate variant is not declared exactly once by the review bundle");

  if (sourceId === null || cutId === null || treatmentId === null || experimentId === null
    || variantId === null || variantMatches.length !== 1) {
    return null;
  }
  return { sourceId, cutId, variantId, treatmentId, experimentId };
}

function readFactsLineage(
  value: unknown,
  label: "queue" | "scheduler",
  expected: GrowDeliveryBindingLineage | null,
  blockers: string[],
): GrowDeliveryBindingFactsLineage | null {
  if (!isRecord(value)) {
    blockers.push(label + " lineage is missing");
    return null;
  }
  const result: Record<string, string | null> = {};
  let complete = true;
  for (const key of LINEAGE_KEYS) {
    const item = text(value[key]);
    if (item === null) {
      blockers.push(label + " lineage " + key + " is missing");
      complete = false;
    } else {
      result[key] = item;
    }
  }
  result.publishId = value.publishId === undefined || value.publishId === null ? null : text(value.publishId);
  if (!complete) return null;
  const lineage = result as GrowDeliveryBindingFactsLineage;
  if (expected !== null && !sameLineage(lineage, expected)) {
    blockers.push(label + " lineage does not match candidate lineage");
  }
  return lineage;
}

function sameLineage(left: unknown, right: GrowDeliveryBindingLineage | null): boolean {
  if (!isRecord(left) || right === null) return false;
  return LINEAGE_KEYS.every((key) => text(left[key]) === right[key]);
}

function copyCapacitySlice(value: GrowCapacitySlice | null): GrowCapacitySlice | null {
  if (value === null || !isRecord(value)) return null;
  return {
    day: text(value.day) ?? "",
    platform: text(value.platform) ?? "",
    candidateCount: typeof value.candidateCount === "number" ? value.candidateCount : 0,
    approvedCount: typeof value.approvedCount === "number" ? value.approvedCount : 0,
    rejectedCount: typeof value.rejectedCount === "number" ? value.rejectedCount : 0,
    blockedCount: typeof value.blockedCount === "number" ? value.blockedCount : 0,
    reviewCapacity: typeof value.reviewCapacity === "number" ? value.reviewCapacity : null,
    slotCapacity: typeof value.slotCapacity === "number" ? value.slotCapacity : null,
    scheduledCount: typeof value.scheduledCount === "number" ? value.scheduledCount : null,
    availableSlots: typeof value.availableSlots === "number" ? value.availableSlots : null,
    approvedPublishCount: typeof value.approvedPublishCount === "number" ? value.approvedPublishCount : null,
    paused: value.paused === true,
    pauseReasons: Array.isArray(value.pauseReasons)
      ? value.pauseReasons.filter((item): item is string => typeof item === "string").slice()
      : [],
    rollbackConditions: Array.isArray(value.rollbackConditions)
      ? value.rollbackConditions.map((item) => ({ ...item }))
      : [],
    gapReasons: Array.isArray(value.gapReasons)
      ? value.gapReasons.filter((item): item is string => typeof item === "string").slice()
      : [],
  };
}

function copyFacts(value: BindingFacts | null): BindingFacts | null {
  if (value === null || !isRecord(value)) return null;
  const readiness = isRecord(value.readiness)
    && (value.readiness.status === "ready" || value.readiness.status === "blocked")
    ? {
      status: value.readiness.status,
      blockers: Array.isArray(value.readiness.blockers)
        ? value.readiness.blockers.filter((item): item is string => typeof item === "string").slice()
        : [],
    }
    : { status: "blocked" as const, blockers: ["facts readiness is missing"] };
  const lineage = value.lineage === null
    ? null
    : isRecord(value.lineage) ? { ...value.lineage } as GrowDeliveryBindingFactsLineage : null;
  return {
    ...("artifactId" in value ? { artifactId: text(value.artifactId) } : { deliveryId: text(value.deliveryId) }),
    status: typeof value.status === "string" ? value.status as never : "unknown" as never,
    lineage,
    readiness,
    sideEffects: "none",
  } as BindingFacts;
}

function copyProvider(value: GrowDeliveryBindingProviderFacts | null): GrowDeliveryBindingProviderFacts | null {
  if (value === null || !isRecord(value)) return null;
  const live = isRecord(value.liveCheck)
    ? {
      status: value.liveCheck.status as GrowDeliveryBindingLiveCheckStatus,
      checkedAt: text(value.liveCheck.checkedAt),
      liveAt: text(value.liveCheck.liveAt),
    }
    : null;
  return {
    provider: text(value.provider) ?? "",
    reference: text(value.reference),
    scheduledAt: text(value.scheduledAt),
    liveCheck: live,
  };
}

function statusIsScheduled(value: unknown): boolean {
  return typeof value === "string" && ["scheduled", "published", "measured"].includes(value);
}

function liveStatus(value: GrowDeliveryBindingProviderFacts | null): GrowDeliveryBindingLiveCheckStatus | null {
  return value?.liveCheck?.status ?? null;
}

function makeDeliveryId(bundleId: string | null, candidateId: string | null): string {
  return "delivery:" + (bundleId ?? "unknown") + ":" + (candidateId ?? "unknown");
}

/**
 * Join explicit review, candidate, capacity, queue, scheduler, and provider facts.
 * This function never reads or writes state, calls a provider, schedules, publishes, retries,
 * cancels, repairs, or mutates any input. Queue labels alone cannot establish lifecycle state.
 */
export function buildGrowDeliveryBinding(input: GrowDeliveryBindingInput): GrowDeliveryBinding {
  const source = input as unknown as JsonRecord;
  const reviewBundle = isRecord(source.reviewBundle) ? source.reviewBundle as unknown as GrowReviewBundle : null;
  const candidate = isRecord(source.candidate) ? source.candidate : null;
  const candidateId = text(candidate?.id);
  const day = text(candidate?.day);
  const platform = text(candidate?.platform);
  const blockers: string[] = [];
  const reviewBlockers: string[] = [];

  if (reviewBundle === null) reviewBlockers.push("review bundle is missing");
  else {
    if (reviewBundle.kind !== "grow_review_bundle") reviewBlockers.push("review bundle kind is invalid");
    if (reviewBundle.version !== "grow-review-bundle-v1") reviewBlockers.push("review bundle version is invalid");
    if (reviewBundle.status !== "approved"
      || reviewBundle.humanDecision?.status !== "approved"
      || reviewBundle.humanDecision?.decidedBy !== "muxin"
      || reviewBundle.humanDecision?.decidedAt === null) {
      reviewBlockers.push("review bundle is not approved by Muxin");
    }
    if (reviewBundle.readiness?.status !== "ready") reviewBlockers.push("review bundle readiness is blocked");
    if (reviewBundle.generatesCopy !== false) reviewBlockers.push("review bundle is not body-free");
    if (reviewBundle.sideEffects !== "none") reviewBlockers.push("review bundle has side effects");
  }

  const candidateLineage = readCandidateLineage(candidate?.lineage, blockers);
  const boundLineage = reviewLineage(reviewBundle, candidateLineage, blockers);
  if (candidateId === null) blockers.push("candidate id is missing");
  if (day === null) blockers.push("candidate day is missing");
  if (platform === null) blockers.push("candidate platform is missing");
  if (candidate?.variantId !== undefined && candidate?.variantId !== null
    && text(candidate.variantId) !== candidateLineage?.variantId) {
    blockers.push("candidate variant id does not match candidate lineage");
  }
  if (boundLineage !== null && candidateLineage !== null && !sameLineage(candidateLineage, boundLineage)) {
    blockers.push("candidate lineage does not match review lineage");
  }

  const slice = isRecord(source.capacitySlice) ? source.capacitySlice as unknown as GrowCapacitySlice : null;
  if (slice === null) blockers.push("capacity slice is missing", "capacity slot is missing");
  else {
    if (slice.day !== day || slice.platform !== platform) blockers.push("capacity slice does not match candidate placement");
    if (slice.slotCapacity === null || slice.slotCapacity === undefined
      || slice.availableSlots === null || slice.availableSlots === undefined) {
      blockers.push("capacity slot is missing");
    }
    if (slice.availableSlots !== null && slice.availableSlots !== undefined && slice.availableSlots < 1
      && !statusIsScheduled(isRecord(source.queueFacts) ? source.queueFacts.status : null)) {
      blockers.push("no remaining capacity slot");
    }
    if (slice.paused) blockers.push("capacity is paused");
    if (slice.rollbackConditions.length > 0) blockers.push("capacity has an active rollback condition");
  }

  const queue = isRecord(source.queueFacts) ? source.queueFacts as unknown as GrowDeliveryBindingQueueFacts : null;
  const scheduler = isRecord(source.schedulerFacts) ? source.schedulerFacts as unknown as GrowDeliveryBindingSchedulerFacts : null;
  const provider = copyProvider(isRecord(source.providerFacts)
    ? source.providerFacts as GrowDeliveryBindingProviderFacts
    : null);
  if (queue === null) blockers.push("queue facts are missing");
  if (scheduler === null) blockers.push("scheduler facts are missing");

  const queueStatus = queue?.status;
  const schedulerStatus = scheduler?.status;
  const queueValid = typeof queueStatus === "string" && QUEUE_STATUSES.has(queueStatus);
  const schedulerValid = typeof schedulerStatus === "string" && SCHEDULER_STATUSES.has(schedulerStatus);
  if (!queueValid) blockers.push("queue status is unavailable");
  if (!schedulerValid) blockers.push("scheduler status is unavailable");
  if (queue?.artifactId !== candidateId) blockers.push("queue artifact id does not match candidate id");
  if (scheduler?.deliveryId !== makeDeliveryId(text(reviewBundle?.id), candidateId)) {
    blockers.push("scheduler delivery id does not match delivery binding");
  }
  if (queue?.readiness.status !== "ready") {
    blockers.push(...(queue?.readiness.blockers ?? []).map((item) => "queue: " + item));
  }
  if (scheduler?.readiness.status !== "ready") {
    blockers.push(...(scheduler?.readiness.blockers ?? []).map((item) => "scheduler: " + item));
  }
  if (queue?.sideEffects !== "none") blockers.push("queue facts have side effects");
  if (scheduler?.sideEffects !== "none") blockers.push("scheduler facts have side effects");

  const queueLineageBlockers: string[] = [];
  const schedulerLineageBlockers: string[] = [];
  const queueLineage = readFactsLineage(queue?.lineage, "queue", candidateLineage, queueLineageBlockers);
  const schedulerLineage = readFactsLineage(scheduler?.lineage, "scheduler", candidateLineage, schedulerLineageBlockers);
  blockers.push(...queueLineageBlockers, ...schedulerLineageBlockers);

  const queueScheduled = queueValid && statusIsScheduled(queueStatus);
  const schedulerScheduled = schedulerValid && statusIsScheduled(schedulerStatus);
  const approvedEvidence = queueValid && schedulerValid && queueStatus === "approved" && schedulerStatus === "unscheduled";
  const scheduledEvidence = queueScheduled && schedulerScheduled
    && queueLineage !== null && schedulerLineage !== null
    && queue?.artifactId === candidateId
    && scheduler?.deliveryId === makeDeliveryId(text(reviewBundle?.id), candidateId);
  if (!approvedEvidence && !scheduledEvidence) blockers.push("queue and scheduler state do not agree");

  const attemptedScheduled = queueScheduled || schedulerScheduled
    || provider?.reference !== null || provider?.scheduledAt !== null;
  const live = liveStatus(provider);
  if (attemptedScheduled) {
    if (provider === null || provider.reference === null) blockers.push("provider reference is missing");
    if (provider === null || provider.scheduledAt === null) blockers.push("provider scheduled timestamp is missing");
    else if (!validTimestamp(provider.scheduledAt)) blockers.push("provider scheduled timestamp is invalid");
    if (provider === null || provider.liveCheck === null || provider.liveCheck.status === "unavailable") {
      blockers.push("live check is unavailable");
    }
    if (provider?.liveCheck?.status === "confirmed") {
      if (provider.liveCheck.checkedAt === null || !validTimestamp(provider.liveCheck.checkedAt)) {
        blockers.push("live check timestamp is missing or invalid");
      }
      if (provider.liveCheck.liveAt === null || !validTimestamp(provider.liveCheck.liveAt)) {
        blockers.push("live confirmation timestamp is missing or invalid");
      }
    }
  } else if (provider?.reference !== null || provider?.scheduledAt !== null || live === "confirmed") {
    blockers.push("manual delivery is ambiguous");
  }
  const mode = text(source.deliveryMode)?.toLowerCase() ?? null;
  if (mode === "manual" || mode === "unknown") blockers.push("manual delivery is ambiguous");
  if (mode !== null && mode !== "manual" && mode !== "unknown" && mode !== "provider") {
    blockers.push("delivery mode is invalid");
  }

  const reviewReady = reviewBlockers.length === 0;
  blockers.push(...reviewBlockers);
  const currentStatus: GrowDeliveryBindingStatus = scheduledEvidence
    ? live === "confirmed" && provider?.reference !== null && provider.liveCheck?.liveAt !== null
      ? "live_confirmed"
      : "scheduled"
    : "approved";
  const liveCheck = attemptedScheduled
    ? live === null || live === "unavailable" ? "unavailable" : live
    : "not_required";

  const drift: string[] = [];
  if (queue !== null && queue.artifactId !== candidateId) drift.push("queue artifact id drift");
  if (scheduler !== null && scheduler.deliveryId !== makeDeliveryId(text(reviewBundle?.id), candidateId)) drift.push("scheduler delivery id drift");
  if (queueLineage !== null && candidateLineage !== null && !sameLineage(queueLineage, candidateLineage)) drift.push("queue lineage drift");
  if (schedulerLineage !== null && candidateLineage !== null && !sameLineage(schedulerLineage, candidateLineage)) drift.push("scheduler lineage drift");
  if (queueValid && schedulerValid && !approvedEvidence && !scheduledEvidence) drift.push("queue and scheduler lifecycle drift");
  const sortedBlockers = uniqueSorted(blockers);
  const sortedDrift = uniqueSorted(drift);
  const reviewBundleId = text(reviewBundle?.id);

  return {
    kind: "grow_delivery_binding",
    version: GROW_DELIVERY_BINDING_VERSION,
    deliveryId: makeDeliveryId(reviewBundleId, candidateId),
    reviewBundleId,
    candidateId,
    day,
    platform,
    status: currentStatus,
    lineage: boundLineage,
    capacitySlice: copyCapacitySlice(slice),
    queueFacts: copyFacts(queue) as GrowDeliveryBindingQueueFacts | null,
    schedulerFacts: copyFacts(scheduler) as GrowDeliveryBindingSchedulerFacts | null,
    providerFacts: provider,
    checks: {
      review: reviewReady ? "approved" : "blocked",
      lineage: boundLineage !== null && blockers.every((item) => !item.includes("lineage"))
        ? "matching" : "blocked",
      capacity: slice !== null && slice.slotCapacity !== null && slice.availableSlots !== null ? "available" : "blocked",
      queue: queue === null ? "blocked" : queueLineage !== null && queue.artifactId === candidateId ? "matching" : "drifted",
      scheduler: scheduler === null ? "blocked" : schedulerLineage !== null
        && scheduler.deliveryId === makeDeliveryId(reviewBundleId, candidateId) ? "matching" : "drifted",
      provider: attemptedScheduled ? provider?.reference === null || provider === null ? "missing" : "matching" : "matching",
      live: liveCheck,
    },
    reconciliation: {
      status: sortedDrift.length === 0 ? "matching" : "drifted",
      drift: sortedDrift,
      sideEffects: "none",
    },
    readiness: { status: sortedBlockers.length === 0 ? "ready" : "blocked", blockers: sortedBlockers },
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

export const createGrowDeliveryBinding = buildGrowDeliveryBinding;
export const buildGrowDeliveryBindingView = buildGrowDeliveryBinding;
export const createGrowDeliveryBindingView = buildGrowDeliveryBinding;
