import type { VolumePlan, VolumePlanSlot } from "./volume-plan.js";
import type { GrowTreatmentCoverage } from "./treatment-coverage.js";

/** Stable v1 metadata-only handoff from planned slots to already-created artifacts. */
export const GENERATION_RUN_VERSION = "grow-generation-run-v1" as const;

export type GenerationRunSlotStatus = "ready" | "blocked" | "missing" | "duplicate";
export type GenerationRunReadinessStatus = "ready" | "blocked";

export interface GenerationRunSlotIdentity {
  readonly platform: string;
  readonly dayIndex: number;
  readonly slotIndex: number;
  readonly variantId: string;
  readonly experimentAssignment: Record<string, string> | null;
}

export interface GenerationRunCandidate extends GenerationRunSlotIdentity {
  /** Reference supplied by the caller. This is never created or dereferenced here. */
  readonly generatedArtifactRef?: string | null;
  /** Reference to a queue row that is still pending human review. */
  readonly reviewQueueRef?: string | null;
  /** Optional assertion about the supplied queue reference. Only `pending` is safe. */
  readonly reviewQueueStatus?: string | null;
  readonly readiness?: {
    readonly status?: GenerationRunReadinessStatus | string | null;
    readonly blockers?: readonly string[] | null;
  } | null;
}

export interface GenerationRunInput {
  readonly volumePlan: VolumePlan;
  readonly candidates: readonly GenerationRunCandidate[];
  /** Explicit coverage is a prerequisite; readiness is never inferred from slot matches. */
  readonly treatmentCoverage?: GrowTreatmentCoverage | null;
}

export interface GenerationRunSlot extends GenerationRunSlotIdentity {
  readonly status: GenerationRunSlotStatus;
  readonly readiness: {
    readonly status: GenerationRunReadinessStatus;
    readonly blockers: string[];
  };
  readonly blockers: string[];
  readonly generatedArtifactRef: string | null;
  readonly reviewQueueRef: string | null;
  readonly reviewQueueStatus: "pending";
  readonly humanReviewRequired: true;
}

export interface GenerationRunUnexpectedCandidate extends GenerationRunSlotIdentity {
  readonly status: "unexpected";
  readonly readiness: {
    readonly status: GenerationRunReadinessStatus;
    readonly blockers: string[];
  };
  readonly blockers: string[];
  readonly generatedArtifactRef: string | null;
  readonly reviewQueueRef: string | null;
  readonly reviewQueueStatus: "pending";
  readonly humanReviewRequired: true;
}

export interface GenerationRunSummary {
  readonly slots: number;
  readonly ready: number;
  readonly blocked: number;
  readonly missing: number;
  readonly duplicate: number;
  readonly unexpected: number;
}

export interface GenerationRun {
  readonly kind: "grow_generation_run";
  readonly version: typeof GENERATION_RUN_VERSION;
  readonly sourceReference: string;
  readonly substanceReference: string;
  readonly slots: GenerationRunSlot[];
  readonly unexpectedCandidates: GenerationRunUnexpectedCandidate[];
  readonly summary: GenerationRunSummary;
  readonly treatmentCoverage: {
    readonly supplied: boolean;
    readonly status: GenerationRunReadinessStatus;
    readonly blockers: string[];
  };
  readonly readiness: {
    readonly status: GenerationRunReadinessStatus;
    readonly blockers: string[];
  };
  readonly generatesCopy: false;
  readonly creatorBodyCopyAllowed: false;
  readonly humanReviewRequired: true;
  readonly autoApproval: false;
  readonly autoScheduling: false;
  readonly autoPublishing: false;
  readonly sideEffects: "none";
}

interface NormalizedCandidate extends GenerationRunSlotIdentity {
  readonly generatedArtifactRef: string | null;
  readonly reviewQueueRef: string | null;
  readonly reviewQueueStatus: "pending";
  readonly readiness: {
    readonly status: GenerationRunReadinessStatus;
    readonly blockers: string[];
  };
  readonly blockers: string[];
}

const PLAN_FIELDS = new Set([
  "sourceReference",
  "substanceReference",
  "slots",
  "humanReviewRequired",
  "generatesCopy",
  "sideEffects",
]);
const PLAN_SLOT_FIELDS = new Set([
  "platform",
  "dayIndex",
  "slotIndex",
  "variantId",
  "experimentAssignment",
  "readiness",
  "blockers",
  "humanReviewRequired",
  "humanGate",
]);
const HUMAN_GATE_FIELDS = new Set(["required", "before", "approvalOwner", "status"]);
const CANDIDATE_FIELDS = new Set([
  "platform",
  "dayIndex",
  "slotIndex",
  "variantId",
  "experimentAssignment",
  "generatedArtifactRef",
  "reviewQueueRef",
  "reviewQueueStatus",
  "readiness",
]);
const TREATMENT_COVERAGE_FIELDS = new Set([
  "kind",
  "version",
  "rows",
  "unexpectedCandidates",
  "summary",
  "readiness",
  "generatesCopy",
  "creatorBodyCopyAllowed",
  "sideEffects",
]);

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertAllowedFields(value: Record<string, unknown>, allowed: ReadonlySet<string>, label: string): void {
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) throw new Error(`${label} contains unsupported field "${field}"`);
  }
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a non-empty string`);
  return value;
}

function optionalReference(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  return text(value, label);
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
}

function assignment(value: unknown, label: string): Record<string, string> | null {
  if (value === null || value === undefined) return null;
  const source = record(value, label);
  const entries = Object.entries(source).map(([name, option]) => {
    if (!name.trim()) throw new Error(`${label} contains an empty dimension name`);
    return [name, text(option, `${label}.${name}`)] as const;
  });
  return Object.fromEntries(entries.sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
}

function assignmentKey(value: Record<string, string> | null): string {
  return value === null ? "null" : JSON.stringify(Object.entries(value));
}

function identityKey(value: GenerationRunSlotIdentity): string {
  return JSON.stringify([
    value.platform,
    value.dayIndex,
    value.slotIndex,
    value.variantId,
    assignmentKey(value.experimentAssignment),
  ]);
}

function compareIdentity(left: GenerationRunSlotIdentity, right: GenerationRunSlotIdentity): number {
  return (left.platform < right.platform ? -1 : left.platform > right.platform ? 1 : 0)
    || left.dayIndex - right.dayIndex
    || left.slotIndex - right.slotIndex
    || (left.variantId < right.variantId ? -1 : left.variantId > right.variantId ? 1 : 0)
    || (assignmentKey(left.experimentAssignment) < assignmentKey(right.experimentAssignment)
      ? -1
      : assignmentKey(left.experimentAssignment) > assignmentKey(right.experimentAssignment) ? 1 : 0);
}

function identity(value: unknown, label: string): GenerationRunSlotIdentity {
  const source = record(value, label);
  return {
    platform: text(source.platform, `${label}.platform`).trim(),
    dayIndex: nonNegativeInteger(source.dayIndex, `${label}.dayIndex`),
    slotIndex: nonNegativeInteger(source.slotIndex, `${label}.slotIndex`),
    variantId: text(source.variantId, `${label}.variantId`).trim(),
    experimentAssignment: assignment(source.experimentAssignment, `${label}.experimentAssignment`),
  };
}

function blockers(value: unknown, label: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return sortedUnique(value.map((item, index) => text(item, `${label}[${index}]`).trim()));
}

function readiness(
  value: unknown,
  label: string,
  missingMessage: string,
): { status: GenerationRunReadinessStatus; blockers: string[] } {
  if (value === undefined || value === null) return { status: "blocked", blockers: [missingMessage] };
  const source = record(value, label);
  const status = source.status === "ready" || source.status === "blocked" ? source.status : null;
  if (status === null) throw new Error(`${label}.status must be ready or blocked`);
  const supplied = blockers(source.blockers, `${label}.blockers`);
  if (status === "blocked" && supplied.length === 0) supplied.push(`${label} is blocked`);
  return { status, blockers: supplied };
}

function normalizePlanSlot(value: unknown, index: number): VolumePlanSlot & GenerationRunSlotIdentity {
  const source = record(value, `volumePlan.slots[${index + 1}]`);
  assertAllowedFields(source, PLAN_SLOT_FIELDS, `volumePlan.slots[${index + 1}]`);
  const slotIdentity = identity(source, `volumePlan.slots[${index + 1}]`);
  if (source.readiness !== "ready" && source.readiness !== "blocked") {
    throw new Error(`volumePlan.slots[${index + 1}].readiness must be ready or blocked`);
  }
  const slotReadiness = source.readiness;
  const slotBlockers = blockers(source.blockers, `volumePlan.slots[${index + 1}].blockers`);
  const gate = record(source.humanGate, `volumePlan.slots[${index + 1}].humanGate`);
  assertAllowedFields(gate, HUMAN_GATE_FIELDS, `volumePlan.slots[${index + 1}].humanGate`);
  if (source.humanReviewRequired !== true) throw new Error(`volumePlan.slots[${index + 1}] requires human review`);
  if (gate.required !== true || gate.before !== "publish" || gate.approvalOwner !== "human" || gate.status !== "pending") {
    throw new Error(`volumePlan.slots[${index + 1}] must have a pending human review gate before publish`);
  }
  return {
    platform: slotIdentity.platform,
    dayIndex: slotIdentity.dayIndex,
    slotIndex: slotIdentity.slotIndex,
    variantId: slotIdentity.variantId,
    experimentAssignment: slotIdentity.experimentAssignment,
    readiness: slotReadiness,
    blockers: slotBlockers,
    humanReviewRequired: true,
    humanGate: { required: true, before: "publish", approvalOwner: "human", status: "pending" },
  };
}

function normalizePlan(value: unknown): {
  readonly sourceReference: string;
  readonly substanceReference: string;
  readonly slots: Array<VolumePlanSlot & GenerationRunSlotIdentity>;
} {
  const source = record(value, "volumePlan");
  assertAllowedFields(source, PLAN_FIELDS, "volumePlan");
  const sourceReference = text(source.sourceReference, "volumePlan.sourceReference");
  const substanceReference = text(source.substanceReference, "volumePlan.substanceReference");
  if (source.humanReviewRequired !== true) throw new Error("volumePlan.humanReviewRequired must be true");
  if (source.generatesCopy !== false) throw new Error("volumePlan.generatesCopy must be false");
  if (source.sideEffects !== "none") throw new Error("volumePlan.sideEffects must be none");
  if (!Array.isArray(source.slots)) throw new Error("volumePlan.slots must be an array");
  const slots = source.slots.map((current, index) => normalizePlanSlot(current, index));
  if (slots.length === 0) throw new Error("volumePlan.slots must not be empty");
  const seen = new Set<string>();
  for (const current of slots) {
    const key = identityKey(current);
    if (seen.has(key)) throw new Error(`volumePlan contains duplicate slot ${current.platform}/${current.dayIndex}/${current.slotIndex}`);
    seen.add(key);
  }
  return { sourceReference, substanceReference, slots };
}

function normalizeCandidate(value: unknown, index: number): NormalizedCandidate {
  const source = record(value, `candidates[${index + 1}]`);
  assertAllowedFields(source, CANDIDATE_FIELDS, `candidates[${index + 1}]`);
  const candidateIdentity = identity(source, `candidates[${index + 1}]`);
  const candidateReadiness = readiness(
    source.readiness,
    `candidates[${index + 1}].readiness`,
    "candidate readiness metadata is missing",
  );
  const candidateBlockers = [...candidateReadiness.blockers];
  if (!Object.hasOwn(source, "experimentAssignment")) candidateBlockers.push("candidate experiment assignment is missing");
  const generatedArtifactRef = optionalReference(source.generatedArtifactRef, `candidates[${index + 1}].generatedArtifactRef`);
  const reviewQueueRef = optionalReference(source.reviewQueueRef, `candidates[${index + 1}].reviewQueueRef`);
  if (generatedArtifactRef === null) candidateBlockers.push("generated artifact reference is missing");
  if (reviewQueueRef === null) candidateBlockers.push("human review queue reference is missing");
  const suppliedQueueStatus = source.reviewQueueStatus;
  if (suppliedQueueStatus !== undefined && suppliedQueueStatus !== null && suppliedQueueStatus !== "pending") {
    candidateBlockers.push("human review queue reference is not pending");
  }
  return {
    ...candidateIdentity,
    generatedArtifactRef,
    reviewQueueRef: suppliedQueueStatus === undefined || suppliedQueueStatus === null || suppliedQueueStatus === "pending"
      ? reviewQueueRef
      : null,
    reviewQueueStatus: "pending",
    readiness: candidateReadiness,
    blockers: sortedUnique(candidateBlockers),
  };
}

function normalizeTreatmentCoverage(value: unknown): GenerationRun["treatmentCoverage"] {
  if (value === undefined || value === null) {
    return {
      supplied: false,
      status: "blocked",
      blockers: ["treatment coverage is missing"],
    };
  }

  const source = record(value, "treatmentCoverage");
  assertAllowedFields(source, TREATMENT_COVERAGE_FIELDS, "treatmentCoverage");
  if (source.kind !== "grow_treatment_coverage") throw new Error("treatmentCoverage.kind must be grow_treatment_coverage");
  if (source.version !== "grow-treatment-coverage-v1") throw new Error("treatmentCoverage.version must be grow-treatment-coverage-v1");
  if (!Array.isArray(source.rows)) throw new Error("treatmentCoverage.rows must be an array");
  if (!Array.isArray(source.unexpectedCandidates)) throw new Error("treatmentCoverage.unexpectedCandidates must be an array");
  if (source.generatesCopy !== false) throw new Error("treatmentCoverage.generatesCopy must be false");
  if (source.creatorBodyCopyAllowed !== false) throw new Error("treatmentCoverage.creatorBodyCopyAllowed must be false");
  if (source.sideEffects !== "none") throw new Error("treatmentCoverage.sideEffects must be none");

  const suppliedReadiness = readiness(
    source.readiness,
    "treatmentCoverage.readiness",
    "treatment coverage readiness is missing",
  );
  const blockers = suppliedReadiness.status === "ready" && suppliedReadiness.blockers.length === 0
    ? []
    : sortedUnique([
      "treatment coverage is blocked",
      ...suppliedReadiness.blockers,
    ]);
  return {
    supplied: true,
    status: blockers.length === 0 ? "ready" : "blocked",
    blockers,
  };
}

function planBlockers(slot: VolumePlanSlot): string[] {
  const result = [...slot.blockers];
  if (slot.readiness !== "ready") result.push("volume plan slot readiness is blocked");
  if (slot.readiness === "ready" && result.length > 0) result.push("volume plan slot has readiness blockers");
  return sortedUnique(result);
}

function slotLabel(slot: GenerationRunSlotIdentity): string {
  return `${slot.platform}/${slot.dayIndex}/${slot.slotIndex}/${slot.variantId}`;
}

function unexpectedBlockers(
  candidate: NormalizedCandidate,
  plannedSlots: readonly GenerationRunSlotIdentity[],
): string[] {
  const result = [...candidate.blockers, "unexpected candidate does not match a VolumePlan slot"];
  const sameCoordinates = plannedSlots.some((slot) =>
    slot.dayIndex === candidate.dayIndex && slot.slotIndex === candidate.slotIndex,
  );
  const samePlatform = plannedSlots.some((slot) => slot.platform === candidate.platform);
  if (!samePlatform) result.push("candidate platform does not match the VolumePlan");
  else if (!sameCoordinates) result.push("candidate day and slot do not match the VolumePlan");
  else {
    const sameCoordinateSlot = plannedSlots.find((slot) =>
      slot.platform === candidate.platform
      && slot.dayIndex === candidate.dayIndex
      && slot.slotIndex === candidate.slotIndex,
    );
    if (sameCoordinateSlot && sameCoordinateSlot.variantId !== candidate.variantId) {
      result.push("candidate variant does not match the VolumePlan slot");
    } else if (sameCoordinateSlot && assignmentKey(sameCoordinateSlot.experimentAssignment) !== assignmentKey(candidate.experimentAssignment)) {
      result.push("candidate experiment assignment does not match the VolumePlan slot");
    }
  }
  return sortedUnique(result);
}

function unexpectedCandidate(
  candidate: NormalizedCandidate,
  plannedSlots: readonly GenerationRunSlotIdentity[],
): GenerationRunUnexpectedCandidate {
  const candidateBlockers = unexpectedBlockers(candidate, plannedSlots);
  return {
    platform: candidate.platform,
    dayIndex: candidate.dayIndex,
    slotIndex: candidate.slotIndex,
    variantId: candidate.variantId,
    experimentAssignment: candidate.experimentAssignment ? { ...candidate.experimentAssignment } : null,
    status: "unexpected",
    readiness: { status: "blocked", blockers: candidateBlockers },
    blockers: candidateBlockers,
    generatedArtifactRef: candidate.generatedArtifactRef,
    reviewQueueRef: candidate.reviewQueueRef,
    reviewQueueStatus: "pending",
    humanReviewRequired: true,
  };
}

/** Build a deterministic, pure, body-free run manifest from a VolumePlan and caller metadata. */
export function createGenerationRun(input: GenerationRunInput): GenerationRun {
  const envelope = record(input, "generation run input");
  assertAllowedFields(envelope, new Set(["volumePlan", "candidates", "treatmentCoverage"]), "generation run input");
  const normalizedPlan = normalizePlan(envelope.volumePlan);
  if (!Array.isArray(envelope.candidates)) throw new Error("candidates must be an array");
  const normalizedCandidates = envelope.candidates.map((current, index) => normalizeCandidate(current, index));
  const reviewQueueRefCounts = new Map<string, number>();
  for (const candidate of normalizedCandidates) {
    if (candidate.reviewQueueRef !== null) {
      reviewQueueRefCounts.set(candidate.reviewQueueRef, (reviewQueueRefCounts.get(candidate.reviewQueueRef) ?? 0) + 1);
    }
  }
  const candidates = normalizedCandidates.map((candidate) => {
    if (candidate.reviewQueueRef === null || (reviewQueueRefCounts.get(candidate.reviewQueueRef) ?? 0) < 2) return candidate;
    const candidateBlockers = sortedUnique([...candidate.blockers, "duplicate human review queue reference"]);
    return {
      ...candidate,
      readiness: { status: "blocked" as const, blockers: candidateBlockers },
      blockers: candidateBlockers,
    };
  });
  const treatmentCoverage = normalizeTreatmentCoverage(envelope.treatmentCoverage);
  const plannedSlots = [...normalizedPlan.slots].sort(compareIdentity);
  const candidateByKey = new Map<string, NormalizedCandidate[]>();
  for (const current of candidates) {
    const key = identityKey(current);
    candidateByKey.set(key, [...(candidateByKey.get(key) ?? []), current]);
  }

  const slots: GenerationRunSlot[] = plannedSlots.map((plannedSlot) => {
    const key = identityKey(plannedSlot);
    const matches = candidateByKey.get(key) ?? [];
    const inheritedBlockers = planBlockers(plannedSlot);
    let status: GenerationRunSlotStatus;
    let generatedArtifactRef: string | null = null;
    let reviewQueueRef: string | null = null;
    let blockersForSlot: string[];

    if (matches.length === 0) {
      status = "missing";
      blockersForSlot = [...inheritedBlockers, "candidate metadata is missing for VolumePlan slot"];
    } else if (matches.length > 1) {
      status = "duplicate";
      blockersForSlot = [
        ...inheritedBlockers,
        "multiple candidate metadata records match VolumePlan slot",
        ...matches.flatMap((current) => current.blockers),
      ];
    } else {
      const match = matches[0]!;
      generatedArtifactRef = match.generatedArtifactRef;
      reviewQueueRef = match.reviewQueueRef;
      blockersForSlot = [...inheritedBlockers, ...match.blockers];
      status = blockersForSlot.length === 0 ? "ready" : "blocked";
    }

    blockersForSlot = sortedUnique(blockersForSlot);
    return {
      platform: plannedSlot.platform,
      dayIndex: plannedSlot.dayIndex,
      slotIndex: plannedSlot.slotIndex,
      variantId: plannedSlot.variantId,
      experimentAssignment: plannedSlot.experimentAssignment ? { ...plannedSlot.experimentAssignment } : null,
      status,
      readiness: {
        status: status === "ready" ? "ready" : "blocked",
        blockers: [...blockersForSlot],
      },
      blockers: [...blockersForSlot],
      generatedArtifactRef,
      reviewQueueRef,
      reviewQueueStatus: "pending",
      humanReviewRequired: true,
    };
  });

  const plannedKeys = new Set(plannedSlots.map(identityKey));
  const unexpectedCandidates = candidates
    .filter((current) => !plannedKeys.has(identityKey(current)))
    .map((current) => unexpectedCandidate(current, plannedSlots))
    .sort((left, right) => compareIdentity(left, right)
      || (left.generatedArtifactRef ?? "").localeCompare(right.generatedArtifactRef ?? "")
      || (left.reviewQueueRef ?? "").localeCompare(right.reviewQueueRef ?? "")
      || left.blockers.join("\u0000").localeCompare(right.blockers.join("\u0000")));
  const summary: GenerationRunSummary = {
    slots: slots.length,
    ready: slots.filter((current) => current.status === "ready").length,
    blocked: slots.filter((current) => current.status === "blocked").length,
    missing: slots.filter((current) => current.status === "missing").length,
    duplicate: slots.filter((current) => current.status === "duplicate").length,
    unexpected: unexpectedCandidates.length,
  };
  const readinessBlockers = [
    ...treatmentCoverage.blockers.map((blocker) => `treatment coverage: ${blocker}`),
    ...slots.flatMap((current) => current.status === "ready" ? [] : [`slot ${slotLabel(current)}: ${current.status}`, ...current.blockers.map((blocker) => `slot ${slotLabel(current)}: ${blocker}`)]),
    ...unexpectedCandidates.flatMap((current) => current.blockers.map((blocker) => `unexpected candidate ${slotLabel(current)}: ${blocker}`)),
  ];

  return {
    kind: "grow_generation_run",
    version: GENERATION_RUN_VERSION,
    sourceReference: normalizedPlan.sourceReference,
    substanceReference: normalizedPlan.substanceReference,
    slots,
    unexpectedCandidates,
    summary,
    treatmentCoverage,
    readiness: {
      status: readinessBlockers.length === 0 ? "ready" : "blocked",
      blockers: sortedUnique(readinessBlockers),
    },
    generatesCopy: false,
    creatorBodyCopyAllowed: false,
    humanReviewRequired: true,
    autoApproval: false,
    autoScheduling: false,
    autoPublishing: false,
    sideEffects: "none",
  };
}

export const buildGenerationRun = createGenerationRun;
export const createGenerationRunManifest = createGenerationRun;
export const buildGenerationRunManifest = createGenerationRun;
