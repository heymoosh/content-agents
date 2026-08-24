/**
 * Capacity is an inspection-only view. It deliberately accepts decisions that have already
 * been made, but never makes an approval decision itself.
 */

export type GrowCapacityCandidateStatus = "candidate" | "approved" | "rejected" | "blocked";

export interface GrowCapacityCandidate {
  readonly id?: string | null;
  readonly day?: string | null;
  readonly platform?: string | null;
  readonly status?: GrowCapacityCandidateStatus | string | null;
}

export interface GrowReviewCapacity {
  readonly day: string;
  readonly platform: string;
  readonly capacity: number | null;
}

export interface GrowSlotCapacity {
  readonly day: string;
  readonly platform: string;
  /** Configured slot ceiling for this day/platform pair. */
  readonly capacity: number | null;
  /** Existing scheduled work is input data, not something this manifest creates. */
  readonly scheduledCount?: number | null;
  /** Use this when the caller already knows the remaining capacity. */
  readonly availableSlots?: number | null;
}

export interface GrowCapacityPause {
  readonly platform: string;
  readonly day?: string | null;
  readonly reason: string;
}

export interface GrowCapacityRollbackCondition {
  readonly platform: string;
  readonly day?: string | null;
  readonly condition: string;
  readonly reason: string;
  readonly evidence?: string | null;
}

export interface GrowCapacityBlueprint {
  readonly days: readonly string[];
  readonly platforms: readonly string[];
  readonly candidates: readonly GrowCapacityCandidate[];
  readonly reviewCapacity?: readonly GrowReviewCapacity[];
  readonly slotCapacity?: readonly GrowSlotCapacity[];
  readonly pauses?: readonly GrowCapacityPause[];
  readonly rollbackConditions?: readonly GrowCapacityRollbackCondition[];
}

export interface GrowCapacityCounts {
  /** Total inspectable candidate records, including records in a later state. */
  readonly candidates: number;
  readonly approved: number;
  readonly rejected: number;
  readonly blocked: number;
}

export interface GrowCapacitySlice {
  readonly day: string;
  readonly platform: string;
  readonly candidateCount: number;
  readonly approvedCount: number;
  readonly rejectedCount: number;
  readonly blockedCount: number;
  readonly reviewCapacity: number | null;
  readonly slotCapacity: number | null;
  readonly scheduledCount: number | null;
  readonly availableSlots: number | null;
  /** Approved items that have a known slot and are not behind an active pause/rollback. */
  readonly approvedPublishCount: number | null;
  readonly paused: boolean;
  readonly pauseReasons: string[];
  readonly rollbackConditions: GrowCapacityRollbackCondition[];
  readonly gapReasons: string[];
}

export interface GrowCapacityManifest {
  readonly version: "grow-capacity-manifest-v1";
  readonly days: string[];
  readonly platforms: string[];
  readonly slices: GrowCapacitySlice[];
  readonly counts: GrowCapacityCounts;
  /** Internal volume is not a promise to review, schedule, or publish. */
  readonly internalCandidateVolume: number;
  /** Null means an approved item lacks enough placement data to calculate this safely. */
  readonly approvedPublishVolume: number | null;
  readonly unassignedCandidates: number;
  readonly pauses: GrowCapacityPause[];
  readonly rollbackConditions: GrowCapacityRollbackCondition[];
  readonly generatesCopy: false;
  readonly autoApproval: false;
  readonly scheduling: "none";
  readonly publishing: "none";
  readonly sideEffects: "none";
}

interface NormalizedCandidate {
  readonly day: string | null;
  readonly platform: string | null;
  readonly status: GrowCapacityCandidateStatus;
}

interface SlotRecord {
  readonly capacity: number | null;
  readonly scheduledCount: number | null;
  readonly availableSlots: number | null;
}

const STATUS_ALIASES: Readonly<Record<string, GrowCapacityCandidateStatus>> = {
  candidate: "candidate",
  draft: "candidate",
  pending: "candidate",
  "needs-human-review": "candidate",
  approved: "approved",
  rejected: "rejected",
  blocked: "blocked",
};

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareStrings);
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} must not be empty`);
  return trimmed;
}

function nullableText(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  return requiredText(value, label);
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
}

function nullableNonNegativeInteger(value: unknown, label: string): number | null {
  if (value === undefined || value === null) return null;
  return nonNegativeInteger(value, label);
}

function normalizeStatus(value: unknown): GrowCapacityCandidateStatus {
  if (typeof value !== "string") return "blocked";
  return STATUS_ALIASES[value.trim().toLowerCase()] ?? "blocked";
}

function normalizeCandidate(candidate: GrowCapacityCandidate): NormalizedCandidate {
  return {
    day: nullableText(candidate.day, "candidate day"),
    platform: nullableText(candidate.platform, "candidate platform"),
    status: normalizeStatus(candidate.status),
  };
}

function key(day: string, platform: string): string {
  return `${day}\u0000${platform}`;
}

function capacityKey(day: string, platform: string): string {
  return key(day, platform);
}

function normalizeReviewCapacities(values: readonly GrowReviewCapacity[] | undefined): Map<string, number | null> {
  const normalized = new Map<string, number | null>();
  for (const value of values ?? []) {
    const day = requiredText(value.day, "review capacity day");
    const platform = requiredText(value.platform, "review capacity platform");
    const mapKey = capacityKey(day, platform);
    if (normalized.has(mapKey)) throw new Error(`duplicate review capacity for ${day}/${platform}`);
    normalized.set(mapKey, nullableNonNegativeInteger(value.capacity, "review capacity"));
  }
  return normalized;
}

function normalizeSlotCapacities(values: readonly GrowSlotCapacity[] | undefined): Map<string, SlotRecord> {
  const normalized = new Map<string, SlotRecord>();
  for (const value of values ?? []) {
    const day = requiredText(value.day, "slot capacity day");
    const platform = requiredText(value.platform, "slot capacity platform");
    const mapKey = capacityKey(day, platform);
    if (normalized.has(mapKey)) throw new Error(`duplicate slot capacity for ${day}/${platform}`);

    const capacity = nullableNonNegativeInteger(value.capacity, "slot capacity");
    const scheduledCount = nullableNonNegativeInteger(value.scheduledCount, "scheduled count");
    const suppliedAvailableSlots = value.availableSlots === undefined
      ? undefined
      : nullableNonNegativeInteger(value.availableSlots, "available slots");
    const availableSlots = suppliedAvailableSlots !== undefined
      ? suppliedAvailableSlots
      : capacity !== null && scheduledCount !== null
        ? Math.max(0, capacity - scheduledCount)
        : null;

    normalized.set(mapKey, { capacity, scheduledCount, availableSlots });
  }
  return normalized;
}

function normalizePauses(values: readonly GrowCapacityPause[] | undefined): GrowCapacityPause[] {
  const normalized = (values ?? []).map((value) => ({
    platform: requiredText(value.platform, "pause platform"),
    day: nullableText(value.day, "pause day"),
    reason: requiredText(value.reason, "pause reason"),
  }));
  return normalized.sort((left, right) =>
    compareStrings(left.platform, right.platform)
    || compareStrings(left.day ?? "", right.day ?? "")
    || compareStrings(left.reason, right.reason));
}

function normalizeRollbackConditions(
  values: readonly GrowCapacityRollbackCondition[] | undefined,
): GrowCapacityRollbackCondition[] {
  const normalized = (values ?? []).map((value) => ({
    platform: requiredText(value.platform, "rollback platform"),
    day: nullableText(value.day, "rollback day"),
    condition: requiredText(value.condition, "rollback condition"),
    reason: requiredText(value.reason, "rollback reason"),
    evidence: nullableText(value.evidence, "rollback evidence"),
  }));
  return normalized.sort((left, right) =>
    compareStrings(left.platform, right.platform)
    || compareStrings(left.day ?? "", right.day ?? "")
    || compareStrings(left.condition, right.condition)
    || compareStrings(left.reason, right.reason)
    || compareStrings(left.evidence ?? "", right.evidence ?? ""));
}

function matchingPauseReasons(
  pauses: readonly GrowCapacityPause[],
  day: string,
  platform: string,
): string[] {
  return sortedUnique(
    pauses
      .filter((pause) => pause.platform === platform && (pause.day === null || pause.day === day))
      .map((pause) => pause.reason),
  );
}

function matchingRollbackConditions(
  conditions: readonly GrowCapacityRollbackCondition[],
  day: string,
  platform: string,
): GrowCapacityRollbackCondition[] {
  return conditions
    .filter((condition) => condition.platform === platform && (condition.day === null || condition.day === day))
    .map((condition) => ({ ...condition }));
}

function countForSlice(candidates: readonly NormalizedCandidate[], day: string, platform: string): GrowCapacityCounts {
  const matching = candidates.filter((candidate) => candidate.day === day && candidate.platform === platform);
  return {
    candidates: matching.length,
    approved: matching.filter((candidate) => candidate.status === "approved").length,
    rejected: matching.filter((candidate) => candidate.status === "rejected").length,
    blocked: matching.filter((candidate) => candidate.status === "blocked").length,
  };
}

function countsForAll(candidates: readonly NormalizedCandidate[]): GrowCapacityCounts {
  return {
    candidates: candidates.length,
    approved: candidates.filter((candidate) => candidate.status === "approved").length,
    rejected: candidates.filter((candidate) => candidate.status === "rejected").length,
    blocked: candidates.filter((candidate) => candidate.status === "blocked").length,
  };
}

function pendingCount(candidates: readonly NormalizedCandidate[], day: string, platform: string): number {
  return candidates.filter((candidate) =>
    candidate.day === day && candidate.platform === platform && candidate.status === "candidate").length;
}

function buildSlice(
  candidates: readonly NormalizedCandidate[],
  day: string,
  platform: string,
  reviewCapacities: ReadonlyMap<string, number | null>,
  slotCapacities: ReadonlyMap<string, SlotRecord>,
  pauses: readonly GrowCapacityPause[],
  rollbackConditions: readonly GrowCapacityRollbackCondition[],
): GrowCapacitySlice {
  const mapKey = capacityKey(day, platform);
  const counts = countForSlice(candidates, day, platform);
  const reviewCapacity = reviewCapacities.get(mapKey) ?? null;
  const slot = slotCapacities.get(mapKey);
  const slotCapacity = slot?.capacity ?? null;
  const scheduledCount = slot?.scheduledCount ?? null;
  const availableSlots = slot?.availableSlots ?? null;
  const pauseReasons = matchingPauseReasons(pauses, day, platform);
  const matchingRollbacks = matchingRollbackConditions(rollbackConditions, day, platform);
  const reviewCapacityExhausted = reviewCapacity !== null
    && pendingCount(candidates, day, platform) >= reviewCapacity
    && pendingCount(candidates, day, platform) > 0;
  if (reviewCapacityExhausted) pauseReasons.push("review-capacity-exhausted");
  pauseReasons.sort(compareStrings);
  const paused = pauseReasons.length > 0 || matchingRollbacks.length > 0 || reviewCapacityExhausted;
  const gapReasons = new Set<string>(pauseReasons);
  if (reviewCapacityExhausted) gapReasons.add("review-capacity-exhausted");
  if (matchingRollbacks.length > 0) gapReasons.add("rollback-condition-active");
  if (counts.approved > 0 && availableSlots === 0) gapReasons.add("slot-capacity-exhausted");
  if (counts.approved > 0 && availableSlots === null) gapReasons.add("slot-capacity-unknown");

  let approvedPublishCount: number | null;
  if (counts.approved === 0) approvedPublishCount = 0;
  else if (paused) approvedPublishCount = 0;
  else if (availableSlots === null) approvedPublishCount = null;
  else approvedPublishCount = Math.min(counts.approved, availableSlots);

  return {
    day,
    platform,
    candidateCount: counts.candidates,
    approvedCount: counts.approved,
    rejectedCount: counts.rejected,
    blockedCount: counts.blocked,
    reviewCapacity,
    slotCapacity,
    scheduledCount,
    availableSlots,
    approvedPublishCount,
    paused,
    pauseReasons,
    rollbackConditions: matchingRollbacks,
    gapReasons: sortedUnique([...gapReasons]),
  };
}

/** Build a deterministic capacity view without reading or writing any external state. */
export function createGrowCapacityManifest(blueprint: GrowCapacityBlueprint): GrowCapacityManifest {
  const days = sortedUnique(blueprint.days.map((day) => requiredText(day, "day")));
  const platforms = sortedUnique(blueprint.platforms.map((platform) => requiredText(platform, "platform")));
  const knownDays = new Set(days);
  const knownPlatforms = new Set(platforms);
  const normalizedCandidates = blueprint.candidates.map(normalizeCandidate).map((candidate) => {
    const hasKnownPlacement = candidate.day !== null
      && candidate.platform !== null
      && knownDays.has(candidate.day)
      && knownPlatforms.has(candidate.platform);
    return hasKnownPlacement ? candidate : { ...candidate, day: null, platform: null, status: "blocked" as const };
  });
  const reviewCapacities = normalizeReviewCapacities(blueprint.reviewCapacity);
  const slotCapacities = normalizeSlotCapacities(blueprint.slotCapacity);
  const pauses = normalizePauses(blueprint.pauses);
  const rollbackConditions = normalizeRollbackConditions(blueprint.rollbackConditions);
  const slices = days.flatMap((day) => platforms.map((platform) => buildSlice(
    normalizedCandidates,
    day,
    platform,
    reviewCapacities,
    slotCapacities,
    pauses,
    rollbackConditions,
  )));
  const counts = countsForAll(normalizedCandidates);
  const approvedSlices = slices.filter((slice) => slice.approvedCount > 0);
  const approvedPublishVolume = approvedSlices.some((slice) => slice.approvedPublishCount === null)
    ? null
    : slices.reduce((total, slice) => total + (slice.approvedPublishCount ?? 0), 0);

  return {
    version: "grow-capacity-manifest-v1",
    days,
    platforms,
    slices,
    counts,
    internalCandidateVolume: counts.candidates,
    approvedPublishVolume,
    unassignedCandidates: normalizedCandidates.filter((candidate) => candidate.day === null || candidate.platform === null).length,
    pauses,
    rollbackConditions,
    generatesCopy: false,
    autoApproval: false,
    scheduling: "none",
    publishing: "none",
    sideEffects: "none",
  };
}

export const buildGrowCapacityManifest = createGrowCapacityManifest;
export const createCapacityManifest = createGrowCapacityManifest;
