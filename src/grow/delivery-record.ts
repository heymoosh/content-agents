import type { GrowCapacityManifest } from "./capacity.js";
import type { GrowReviewBundle } from "./review-bundle.js";

/** Pure bridge from an approved review bundle to an inspectable delivery state. */
export const GROW_DELIVERY_RECORD_VERSION = "grow-delivery-record-v1" as const;

export type GrowDeliveryStatus = "approved" | "scheduled" | "published" | "measured";

export interface GrowDeliveryCandidate {
  readonly id: string;
  readonly day: string;
  readonly platform: string;
  readonly variantId?: string | null;
}

export interface GrowDeliveryLineage {
  readonly sourceId: string | null;
  readonly cutId: string | null;
  readonly variantId: string | null;
  readonly experimentId: string | null;
  readonly publishId: string | null;
}

export interface GrowDeliveryInput {
  readonly reviewBundle: GrowReviewBundle;
  readonly capacityManifest: GrowCapacityManifest;
  /** Explicit roster from the same capacity calculation; this adapter never guesses membership. */
  readonly capacityCandidateIds: readonly string[];
  readonly candidate: GrowDeliveryCandidate;
  readonly status: GrowDeliveryStatus | string;
  readonly publishRef?: string | null;
  readonly publishedAt?: string | null;
  readonly outcomeRefs?: readonly string[];
}

export interface GrowDeliveryRecord {
  readonly kind: "grow_delivery_record";
  readonly version: typeof GROW_DELIVERY_RECORD_VERSION;
  readonly id: string;
  readonly reviewBundleId: string;
  readonly candidateId: string;
  readonly day: string;
  readonly platform: string;
  readonly status: GrowDeliveryStatus;
  readonly lineage: GrowDeliveryLineage;
  readonly publishRef: string | null;
  readonly publishedAt: string | null;
  readonly outcomeRefs: string[];
  readonly readiness: {
    readonly status: "ready" | "blocked";
    readonly blockers: string[];
  };
  readonly autoScheduling: false;
  readonly autoPublishing: false;
  readonly sideEffects: "none";
}

export class GrowDeliveryRecordValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GrowDeliveryRecordValidationError";
  }
}

const STATUSES = new Set<GrowDeliveryStatus>(["approved", "scheduled", "published", "measured"]);

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new GrowDeliveryRecordValidationError(`${field} is required`);
  }
  return value.trim();
}

function optionalText(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  return text(value, field);
}

function normalizedStatus(value: unknown): GrowDeliveryStatus {
  const status = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!STATUSES.has(status as GrowDeliveryStatus)) throw new GrowDeliveryRecordValidationError("status must be approved, scheduled, published, or measured");
  return status as GrowDeliveryStatus;
}

function uniqueSorted(values: readonly string[] | undefined, field: string): string[] {
  if (values === undefined) return [];
  return [...new Set(values.map((value, index) => text(value, `${field}[${index}]`)))].sort();
}

function findId(bundle: GrowReviewBundle, recordType: string): string | null {
  const refs = bundle.lineage ?? [];
  return refs.find((ref) => ref.recordType === recordType)?.id ?? null;
}

function normalizeLineage(bundle: GrowReviewBundle, variantId: string | null): GrowDeliveryLineage {
  return {
    sourceId: bundle.sourceRef.id || findId(bundle, "source"),
    cutId: bundle.cutRef.id || findId(bundle, "cut"),
    variantId: variantId ?? (bundle.variantRefs.length === 1 ? bundle.variantRefs[0]?.id ?? null : null),
    experimentId: findId(bundle, "experiment"),
    publishId: bundle.publishRefs?.[0]?.id ?? findId(bundle, "publish"),
  };
}

function candidateSlice(input: GrowDeliveryInput) {
  return input.capacityManifest.slices.find((slice) =>
    slice.day === input.candidate.day && slice.platform === input.candidate.platform);
}

/**
 * Build a delivery record from facts already produced by review and capacity systems.
 * This function never claims a slot, writes a queue row, schedules, publishes, or measures.
 */
export function buildGrowDeliveryRecord(input: GrowDeliveryInput): GrowDeliveryRecord {
  const status = normalizedStatus(input.status);
  const candidateId = text(input.candidate.id, "candidate.id");
  const day = text(input.candidate.day, "candidate.day");
  const platform = text(input.candidate.platform, "candidate.platform");
  const publishRef = optionalText(input.publishRef, "publishRef");
  const publishedAt = optionalText(input.publishedAt, "publishedAt");
  const outcomeRefs = uniqueSorted(input.outcomeRefs, "outcomeRefs");
  const requestedVariantId = optionalText(input.candidate.variantId, "candidate.variantId");
  const lineage = normalizeLineage(input.reviewBundle, requestedVariantId);
  const blockers: string[] = [];
  const slice = candidateSlice(input);

  if (input.reviewBundle.status !== "approved"
    || input.reviewBundle.humanDecision.status !== "approved"
    || input.reviewBundle.humanDecision.decidedBy !== "muxin"
    || input.reviewBundle.humanDecision.decidedAt === null) {
    blockers.push("review bundle is not approved by Muxin");
  }
  if (input.reviewBundle.readiness.status !== "ready") blockers.push("review bundle readiness is blocked");
  if (input.reviewBundle.evidenceStatus !== "supported" || input.reviewBundle.evidenceRefs.length === 0) {
    blockers.push("review bundle evidence is not supported");
  }
  if (input.reviewBundle.voiceCheck !== "passed") blockers.push("voice check is not passed");
  if (input.reviewBundle.originalityCheck !== "passed") blockers.push("originality check is not passed");
  if (lineage.sourceId === null) blockers.push("source lineage is missing");
  if (lineage.cutId === null) blockers.push("cut lineage is missing");
  if (lineage.variantId === null) blockers.push("variant lineage is missing");
  if (lineage.experimentId === null) blockers.push("experiment lineage is missing");
  if (slice === undefined) blockers.push("capacity slice is missing");
  if (!input.capacityCandidateIds.some((id) => id === candidateId)) blockers.push("candidate is not in the capacity roster");
  if (input.reviewBundle.variantRefs.length > 1 && requestedVariantId === null) blockers.push("variant id is required for a multi-variant review bundle");
  if (requestedVariantId !== null && !input.reviewBundle.variantRefs.some((ref) => ref.id === requestedVariantId)) {
    blockers.push("candidate variant is not declared by the review bundle");
  }
  if (slice && (slice.paused || slice.rollbackConditions.length > 0)) {
    blockers.push("capacity is paused or behind a rollback condition");
  }
  if (slice && slice.platform !== platform) blockers.push("capacity platform does not match candidate platform");
  if (status !== "approved" && slice && (slice.availableSlots === null || slice.availableSlots < 1)) {
    blockers.push("no remaining publish slot");
  }
  if ((status === "published" || status === "measured")
    && (publishRef === null || publishedAt === null || Number.isNaN(Date.parse(publishedAt)))) {
    blockers.push("published delivery requires a publish reference and timestamp");
  }
  if (status === "published" || status === "measured") {
    if (input.reviewBundle.publishRefs === null || publishRef === null
      || !input.reviewBundle.publishRefs.some((ref) => ref.id === publishRef)) {
      blockers.push("publish reference is not declared by the review bundle");
    }
  } else if (publishRef !== null && input.reviewBundle.publishRefs !== null
    && !input.reviewBundle.publishRefs.some((ref) => ref.id === publishRef)) {
    blockers.push("publish reference is not declared by the review bundle");
  }
  if (status === "measured" && outcomeRefs.length === 0) blockers.push("measured delivery requires outcome references");

  return {
    kind: "grow_delivery_record",
    version: GROW_DELIVERY_RECORD_VERSION,
    id: `delivery:${input.reviewBundle.id}:${candidateId}`,
    reviewBundleId: text(input.reviewBundle.id, "reviewBundle.id"),
    candidateId,
    day,
    platform,
    status,
    lineage,
    publishRef,
    publishedAt,
    outcomeRefs,
    readiness: { status: blockers.length === 0 ? "ready" : "blocked", blockers: [...new Set(blockers)] },
    autoScheduling: false,
    autoPublishing: false,
    sideEffects: "none",
  };
}

export const createGrowDeliveryRecord = buildGrowDeliveryRecord;
