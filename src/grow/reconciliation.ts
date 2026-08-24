import type { GrowDeliveryLineage, GrowDeliveryRecord, GrowDeliveryStatus } from "./delivery-record.js";
import type { GrowReviewBundle } from "./review-bundle.js";

/** Pure read-side reconciliation between Grow, the review queue, and scheduler facts. */
export const GROW_RECONCILIATION_VERSION = "grow-reconciliation-v1" as const;

export type GrowReconciliationStatus = GrowDeliveryStatus | "blocked" | "drifted";
export type GrowQueueStatus = "approved" | "scheduled" | "published" | "measured" | "blocked" | "unknown";
export type GrowSchedulerStatus = "unscheduled" | "scheduled" | "published" | "measured" | "unknown";

export interface GrowQueueState {
  readonly artifactId: string;
  readonly status: GrowQueueStatus;
  readonly lineage: GrowDeliveryLineage | null;
}

export interface GrowSchedulerState {
  readonly deliveryId: string;
  readonly status: GrowSchedulerStatus;
  readonly lineage: GrowDeliveryLineage | null;
}

export interface GrowReconciliationInput {
  readonly reviewBundle: GrowReviewBundle;
  readonly delivery: GrowDeliveryRecord;
  readonly queue: GrowQueueState;
  readonly scheduler: GrowSchedulerState;
}

export interface GrowReconciliation {
  readonly kind: "grow_reconciliation";
  readonly version: typeof GROW_RECONCILIATION_VERSION;
  readonly deliveryId: string;
  readonly candidateId: string;
  readonly status: GrowReconciliationStatus;
  readonly lineage: GrowDeliveryLineage;
  readonly readiness: { status: "ready" | "blocked"; blockers: string[] };
  readonly checks: {
    readonly review: "approved" | "blocked";
    readonly queue: "matching" | "drifted";
    readonly scheduler: "matching" | "drifted" | "not-required";
  };
  readonly sideEffects: "none";
}

function sameLineage(left: GrowDeliveryLineage | null, right: GrowDeliveryLineage): boolean {
  return left !== null
    && left.sourceId === right.sourceId
    && left.cutId === right.cutId
    && left.variantId === right.variantId
    && left.experimentId === right.experimentId
    && left.publishId === right.publishId;
}

function expectedQueueStatus(status: GrowDeliveryStatus): GrowQueueStatus {
  return status;
}

function reviewLineage(bundle: GrowReviewBundle): GrowDeliveryLineage {
  const refs = bundle.lineage ?? [];
  return {
    sourceId: refs.find((ref) => ref.recordType === "source")?.id ?? bundle.sourceRef.id,
    cutId: refs.find((ref) => ref.recordType === "cut")?.id ?? bundle.cutRef.id,
    variantId: refs.find((ref) => ref.recordType === "variant")?.id ?? (bundle.variantRefs.length === 1 ? bundle.variantRefs[0]?.id ?? null : null),
    experimentId: refs.find((ref) => ref.recordType === "experiment")?.id ?? null,
    // publishRefs is the delivery-facing declaration; lineage is the fallback when the
    // review bundle was assembled without a publish list. Keep this precedence aligned with
    // delivery-record so the same bundle cannot reconcile differently depending on the adapter.
    publishId: bundle.publishRefs?.[0]?.id ?? refs.find((ref) => ref.recordType === "publish")?.id ?? null,
  };
}

function reconcileScheduler(status: GrowDeliveryStatus, scheduler: GrowSchedulerState, delivery: GrowDeliveryRecord, blockers: string[]): "matching" | "drifted" | "not-required" {
  if (scheduler.deliveryId !== delivery.id) {
    blockers.push("scheduler delivery id does not match delivery record");
    return "drifted";
  }
  if (status === "approved") {
    if (scheduler.status !== "unscheduled") blockers.push(`scheduler says ${scheduler.status} but delivery is not scheduled`);
    return scheduler.status === "unscheduled" ? "not-required" : "drifted";
  }
  const expected = status === "scheduled" ? "scheduled" : status === "published" ? "published" : "measured";
  const matches = scheduler.status === expected || (status === "measured" && scheduler.status === "published");
  if (!matches) blockers.push(`${status} delivery lacks ${expected} scheduler evidence`);
  return matches ? "matching" : "drifted";
}

/** Reconcile facts only. This function never repairs or writes any source record. */
export function buildGrowReconciliation(input: GrowReconciliationInput): GrowReconciliation {
  const blockers: string[] = [];
  const delivery = input.delivery;
  const reviewApproved = input.reviewBundle.status === "approved"
    && input.reviewBundle.humanDecision.status === "approved"
    && input.reviewBundle.humanDecision.decidedBy === "muxin"
    && input.reviewBundle.humanDecision.decidedAt !== null;
  if (!reviewApproved) blockers.push("review bundle is not approved by Muxin");
  if (delivery.readiness.status !== "ready") blockers.push(...delivery.readiness.blockers.map((blocker) => `delivery: ${blocker}`));
  if (!sameLineage(reviewLineage(input.reviewBundle), delivery.lineage)) blockers.push("review lineage disagrees with delivery lineage");

  const queueMatches = input.queue.artifactId === delivery.candidateId && input.queue.status === expectedQueueStatus(delivery.status);
  if (input.queue.artifactId !== delivery.candidateId) blockers.push("queue artifact id does not match candidate id");
  if (input.queue.status !== expectedQueueStatus(delivery.status)) blockers.push(`queue says ${input.queue.status} but delivery is ${delivery.status}`);
  if (!sameLineage(input.queue.lineage, delivery.lineage)) blockers.push("queue lineage disagrees with delivery lineage");

  const schedulerState = reconcileScheduler(delivery.status, input.scheduler, delivery, blockers);
  if (!sameLineage(input.scheduler.lineage, delivery.lineage)) blockers.push("scheduler lineage disagrees with delivery lineage");

  const hasHardBlocker = blockers.some((blocker) =>
    blocker.startsWith("review bundle") || blocker.startsWith("delivery:") || blocker.includes("lacks") || blocker.includes("id does not"));
  const status: GrowReconciliationStatus = blockers.length === 0
    ? delivery.status
    : hasHardBlocker ? "blocked" : "drifted";
  return {
    kind: "grow_reconciliation",
    version: GROW_RECONCILIATION_VERSION,
    deliveryId: delivery.id,
    candidateId: delivery.candidateId,
    status,
    lineage: { ...delivery.lineage },
    readiness: { status: blockers.length === 0 ? "ready" : "blocked", blockers: [...new Set(blockers)] },
    checks: {
      review: reviewApproved ? "approved" : "blocked",
      queue: queueMatches && sameLineage(input.queue.lineage, delivery.lineage) ? "matching" : "drifted",
      scheduler: schedulerState,
    },
    sideEffects: "none",
  };
}

export const reconcileGrowDelivery = buildGrowReconciliation;
