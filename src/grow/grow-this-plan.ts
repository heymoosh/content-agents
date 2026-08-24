import type { GrowDeliveryRecord } from "./delivery-record.js";
import type { ExperimentOutcomeLedger } from "./experiment-outcomes.js";
import type { ExperimentRecord } from "./experiment-record.js";
import type {
  GrowReviewBundle,
  GrowReviewReference,
} from "./review-bundle.js";

/** A read-only, reference-only view of one Grow-this lifecycle. */
export const GROW_THIS_PLAN_VERSION = "grow-this-plan-v1" as const;

export type GrowThisStage = "source" | "cut" | "variant" | "review" | "delivery" | "experiment" | "outcome";
export type GrowThisStageStatus = "ready" | "blocked" | "pending" | "not-started";
export type GrowThisHumanGateStatus = "pending" | "approved" | "rejected" | "needs-another-pass";

export interface GrowThisCutDecision {
  readonly status: GrowThisHumanGateStatus;
  readonly decidedBy: "muxin" | null;
  readonly decidedAt: string | null;
}

export interface GrowThisPlanInput {
  readonly id: string;
  readonly sourceRef: GrowReviewReference;
  readonly cutRef: GrowReviewReference;
  readonly variantRefs: readonly GrowReviewReference[];
  /** Caller-supplied readiness facts; reference presence alone is not progress. */
  readonly sourceStatus?: GrowThisStageStatus;
  readonly cutStatus?: GrowThisStageStatus;
  readonly cutDecision?: GrowThisCutDecision | null;
  readonly reviewBundle: GrowReviewBundle;
  readonly deliveryRef?: GrowReviewReference | null;
  readonly delivery?: GrowDeliveryRecord | null;
  readonly experimentRef?: GrowReviewReference | null;
  readonly experiment?: ExperimentRecord | null;
  readonly outcomeRef?: GrowReviewReference | null;
  readonly outcomeLedger?: ExperimentOutcomeLedger | null;
  /** Explicit evidence IDs only; this projection never searches for or creates evidence. */
  readonly evidenceRefs?: readonly string[];
}

export interface GrowThisStageProjection {
  readonly stage: GrowThisStage;
  readonly refs: string[];
  readonly status: GrowThisStageStatus;
  readonly blockers: string[];
}

export interface GrowThisHumanGate {
  readonly required: true;
  readonly owner: "human";
  readonly status: GrowThisHumanGateStatus;
  readonly blockers: string[];
}

export interface GrowThisPlan {
  readonly kind: "grow_this_plan";
  readonly version: typeof GROW_THIS_PLAN_VERSION;
  readonly id: string;
  readonly lifecycle: GrowThisStageProjection[];
  readonly gates: {
    readonly cut: GrowThisHumanGate;
    readonly review: GrowThisHumanGate;
    readonly delivery: GrowThisHumanGate;
  };
  readonly readiness: { readonly status: "ready" | "blocked"; readonly blockers: string[] };
  /** Intentionally null: this projection reports observations, never a winner. */
  readonly winner: null;
  readonly autoWinner: false;
  readonly generatesCopy: false;
  readonly sideEffects: "none";
}

function text(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} must not be empty`);
  return normalized;
}

function refs(values: readonly GrowReviewReference[]): string[] {
  return [...new Set(values.map((value) => text(value.id, "reference id")))].sort();
}

function oneRef(value: GrowReviewReference | null | undefined): string[] {
  return value === null || value === undefined ? [] : [text(value.id, "reference id")];
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function stage(
  name: GrowThisStage,
  stageRefs: string[],
  status: GrowThisStageStatus,
  blockers: readonly string[] = [],
): GrowThisStageProjection {
  return { stage: name, refs: [...stageRefs], status, blockers: unique(blockers) };
}

function gate(status: GrowThisHumanGateStatus, blockers: readonly string[] = []): GrowThisHumanGate {
  return { required: true, owner: "human", status, blockers: unique(blockers) };
}

function reviewGate(bundle: GrowReviewBundle): GrowThisHumanGate {
  const status = bundle.humanDecision.status === "candidate"
    ? "pending"
    : bundle.humanDecision.status;
  const blockers: string[] = [];
  if (status !== "approved") blockers.push("human review is pending");
  if (bundle.humanDecision.status === "rejected") blockers.push("human review was rejected");
  if (bundle.humanDecision.status === "needs-another-pass") blockers.push("human review needs another pass");
  return gate(status, blockers);
}

function cutGate(decision: GrowThisCutDecision | null | undefined): GrowThisHumanGate {
  const status = decision?.status ?? "pending";
  const approved = status === "approved" && decision?.decidedBy === "muxin" && decision.decidedAt !== null;
  const blockers: string[] = [];
  if (!approved) blockers.push("Muxin cut decision is pending");
  if (status === "rejected") blockers.push("cut was rejected");
  if (status === "needs-another-pass") blockers.push("cut needs another pass");
  return gate(approved ? "approved" : status, blockers);
}

/**
 * Join caller-supplied Grow records into a deterministic lifecycle projection.
 * No body fields are read, no winner is selected, and no queue, scheduler, or publisher is called.
 */
export function buildGrowThisPlan(input: GrowThisPlanInput): GrowThisPlan {
  const id = text(input.id, "id");
  const sourceId = text(input.sourceRef.id, "sourceRef.id");
  const cutId = text(input.cutRef.id, "cutRef.id");
  const variantIds = refs(input.variantRefs);
  const evidenceRefs = unique((input.evidenceRefs ?? []).map((value) => text(value, "evidence ref")));
  const review = input.reviewBundle;
  const blockers: string[] = [];
  const reviewBlockers: string[] = [];
  const reviewApproved = review.status === "approved"
    && review.humanDecision.status === "approved"
    && review.humanDecision.decidedBy === "muxin"
    && review.humanDecision.decidedAt !== null;
  if (!reviewApproved) {
    blockers.push("human review is pending");
    reviewBlockers.push("human review is pending");
  }
  if (review.evidenceStatus !== "supported" || review.evidenceRefs.length === 0 || evidenceRefs.length === 0) {
    blockers.push("evidence is missing");
    reviewBlockers.push("evidence is missing");
  }
  if (review.sourceRef.id !== sourceId) blockers.push("source reference does not match review");
  if (review.cutRef.id !== cutId) blockers.push("cut reference does not match review");
  if (!variantIds.length) blockers.push("variant reference is missing");
  if (review.variantRefs.some((ref) => !variantIds.includes(ref.id))) blockers.push("variant reference does not match review");
  if (review.readiness.status !== "ready") blockers.push(...review.readiness.blockingFields.map((field) => `review: ${field}`));

  const cutDecision = cutGate(input.cutDecision);
  const sourceStatus = input.sourceStatus ?? "pending";
  const cutStatus = input.cutStatus ?? "pending";
  if (sourceStatus !== "ready") blockers.push("source record is not marked ready");
  if (cutStatus !== "ready") blockers.push("cut record is not marked ready");
  if (cutDecision.status !== "approved") blockers.push(...cutDecision.blockers);

  const deliveryIds = oneRef(input.deliveryRef);
  const experimentIds = oneRef(input.experimentRef);
  const outcomeIds = oneRef(input.outcomeRef);
  const deliveryBlockers = reviewApproved ? [] : ["delivery waits for human review"];
  if (deliveryIds.length && (input.delivery === null || input.delivery === undefined)) deliveryBlockers.push("delivery record is missing");
  if (input.delivery && !deliveryIds.length) deliveryBlockers.push("delivery reference is missing");
  if (input.delivery && deliveryIds[0] !== input.delivery.id) deliveryBlockers.push("delivery reference does not match record");
  if (input.delivery && input.delivery.reviewBundleId !== review.id) deliveryBlockers.push("delivery record does not match review bundle");
  if (input.delivery?.readiness.status === "blocked") deliveryBlockers.push(...input.delivery.readiness.blockers.map((blocker) => `delivery: ${blocker}`));
  const deliveryStatus: GrowThisStageStatus = !deliveryIds.length ? "not-started" : deliveryBlockers.length ? "blocked" : "ready";

  const experimentBlockers: string[] = [];
  if (experimentIds.length && (input.experiment === null || input.experiment === undefined)) experimentBlockers.push("experiment record is missing");
  if (input.experiment && !experimentIds.length) experimentBlockers.push("experiment reference is missing");
  if (input.experiment && experimentIds[0] !== input.experiment.id) experimentBlockers.push("experiment reference does not match record");
  if (input.experiment && !input.experiment.lineage.sourceRefs.includes(sourceId)) experimentBlockers.push("experiment does not include source reference");
  if (input.experiment && !variantIds.some((variantId) => input.experiment?.lineage.variantRefs.includes(variantId))) experimentBlockers.push("experiment does not include a variant reference");
  if (input.experiment?.status === "insufficient-evidence") experimentBlockers.push("experiment has insufficient evidence");
  const experimentStatus: GrowThisStageStatus = !experimentIds.length
    ? "not-started"
    : experimentBlockers.length
      ? "blocked"
      : input.experiment?.status === "proposed" || input.experiment?.status === "running" ? "pending" : "ready";

  const outcomeBlockers = evidenceRefs.length ? [] : ["evidence is missing"];
  if (outcomeIds.length && (input.outcomeLedger === null || input.outcomeLedger === undefined)) outcomeBlockers.push("outcome ledger is missing");
  if (input.outcomeLedger && !outcomeIds.length) outcomeBlockers.push("outcome reference is missing");
  if (input.outcomeLedger && experimentIds[0] !== input.outcomeLedger.experimentId) outcomeBlockers.push("outcome ledger does not match experiment");
  if (input.outcomeLedger?.readiness.status === "blocked") outcomeBlockers.push(...input.outcomeLedger.readiness.blockers);
  if (deliveryBlockers.length) blockers.push(...deliveryBlockers);
  if (experimentBlockers.length) blockers.push(...experimentBlockers);
  const outcomeStatus: GrowThisStageStatus = !outcomeIds.length ? "not-started" : outcomeBlockers.length ? "blocked" : "ready";
  if (experimentStatus === "blocked") blockers.push(...experimentBlockers);
  if (outcomeStatus === "blocked") blockers.push(...outcomeBlockers);

  const reviewRefs = [review.id];
  const lifecycle = [
    stage("source", [sourceId], sourceStatus, sourceStatus === "ready" ? [] : ["source record is not marked ready"]),
    stage("cut", [cutId], cutStatus === "ready" && cutDecision.status === "approved" ? "ready" : cutStatus === "blocked" ? "blocked" : "pending",
      [...(cutStatus === "ready" ? [] : ["cut record is not marked ready"]), ...cutDecision.blockers]),
    stage("variant", variantIds, variantIds.length ? "ready" : "blocked", variantIds.length ? [] : ["variant reference is missing"]),
    stage("review", reviewRefs, reviewApproved && review.readiness.status === "ready" ? "ready" : "pending", reviewBlockers),
    stage("delivery", deliveryIds, deliveryStatus, deliveryBlockers),
    stage("experiment", experimentIds, experimentStatus, experimentBlockers),
    stage("outcome", outcomeIds, outcomeStatus, outcomeBlockers),
  ];
  const deliveryGate = gate(deliveryStatus === "ready" ? "approved" : "pending", deliveryBlockers);
  return {
    kind: "grow_this_plan",
    version: GROW_THIS_PLAN_VERSION,
    id,
    lifecycle,
    gates: { cut: cutDecision, review: reviewGate(review), delivery: deliveryGate },
    readiness: { status: blockers.length ? "blocked" : "ready", blockers: unique(blockers) },
    winner: null,
    autoWinner: false,
    generatesCopy: false,
    sideEffects: "none",
  };
}

export const createGrowThisPlan = buildGrowThisPlan;
