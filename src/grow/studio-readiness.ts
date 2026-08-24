import type { CommentLearningView } from "./comment-learning.js";
import type { GrowDeliveryRecord } from "./delivery-record.js";
import type { GenerationBrief } from "./generation-brief.js";
import type { GrowReviewBundle } from "./review-bundle.js";

/** A body-free aggregate of already-produced Studio lifecycle facts. */
export const STUDIO_READINESS_VERSION = "studio-readiness-v1" as const;

export type StudioReadinessStage = "source" | "brief" | "review" | "delivery" | "learning";
export type StudioReadinessStatus = "ready" | "blocked";
export type StudioHumanGateStatus = "pending" | "approved" | "rejected" | "needs-another-pass";

export interface StudioReadinessInput {
  /** Source readiness is always caller-supplied; the aggregate never classifies a source. */
  readonly sourceStatus: StudioReadinessStatus | null | undefined;
  /** `generationBrief` is an explicit alias for callers that prefer the type name. */
  readonly brief?: GenerationBrief | null;
  readonly generationBrief?: GenerationBrief | null;
  /** `review` is an explicit alias for callers that prefer the stage name. */
  readonly review?: GrowReviewBundle | null;
  readonly reviewBundle?: GrowReviewBundle | null;
  readonly delivery?: GrowDeliveryRecord | null;
  readonly deliveryRecord?: GrowDeliveryRecord | null;
  readonly learning?: CommentLearningView | null;
  readonly commentLearning?: CommentLearningView | null;
  readonly commentLearningView?: CommentLearningView | null;
}

export interface StudioReadinessStageProjection {
  readonly stage: StudioReadinessStage;
  readonly status: StudioReadinessStatus;
  readonly blockers: string[];
}

export interface StudioHumanGate {
  readonly required: true;
  readonly owner: "human";
  readonly status: StudioHumanGateStatus;
  readonly blockers: string[];
}

export interface StudioReadiness {
  readonly kind: "studio_readiness";
  readonly version: typeof STUDIO_READINESS_VERSION;
  readonly stages: StudioReadinessStageProjection[];
  readonly gates: {
    readonly brief: StudioHumanGate;
    readonly review: StudioHumanGate;
    readonly delivery: StudioHumanGate;
    readonly learning: StudioHumanGate;
  };
  readonly readiness: {
    readonly status: StudioReadinessStatus;
    readonly blockers: string[];
  };
  readonly generatesCopy: false;
  readonly creatorBodyCopyAllowed: false;
  readonly autoPublishing: false;
  readonly sideEffects: "none";
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function stage(
  name: StudioReadinessStage,
  status: StudioReadinessStatus,
  blockers: readonly string[] = [],
): StudioReadinessStageProjection {
  return { stage: name, status, blockers: uniqueSorted(blockers) };
}

function gate(
  status: StudioHumanGateStatus,
  blockers: readonly string[] = [],
): StudioHumanGate {
  return { required: true, owner: "human", status, blockers: uniqueSorted(blockers) };
}

function supplied<T>(primary: T | null | undefined, alias: T | null | undefined): T | null {
  if (primary !== undefined) return primary;
  return alias === undefined ? null : alias;
}

function sourceStage(status: StudioReadinessInput["sourceStatus"]): StudioReadinessStageProjection {
  if (status === "ready") return stage("source", "ready");
  if (status === "blocked") return stage("source", "blocked", ["source status is blocked"]);
  return stage("source", "blocked", ["source status is missing"]);
}

function briefStage(brief: GenerationBrief | null): StudioReadinessStageProjection {
  if (brief === null) return stage("brief", "blocked", ["generation brief is missing"]);

  const blockers = brief.variants.flatMap((variant) => {
    if (variant.readiness?.status !== "blocked") return [];
    return variant.readiness.blockers.length > 0
      ? variant.readiness.blockers
      : ["brief variant readiness is blocked"];
  });
  if (brief.variants.length === 0) blockers.push("generation brief has no variants");
  if (brief.generatesCopy !== false) blockers.push("generation brief must not generate copy");
  if (brief.sideEffects !== "none") blockers.push("generation brief has side effects");
  if (brief.templateReusePolicy?.creatorBodyCopy !== "forbidden") blockers.push("creator body copying is not forbidden");
  if (brief.modelBoundary?.modelInvocation !== "deferred") blockers.push("generation model invocation is not deferred");
  if (brief.modelBoundary?.sideEffects !== "none") blockers.push("generation model boundary has side effects");
  if (brief.modelBoundary?.boundaries?.composesBody !== false) blockers.push("generation model boundary composes body copy");
  if (brief.modelBoundary?.boundaries?.creatorBodyCopyAllowed !== false) blockers.push("generation model boundary allows creator body copy");
  return stage("brief", blockers.length === 0 ? "ready" : "blocked", blockers);
}

function reviewApproved(review: GrowReviewBundle): boolean {
  return review.status === "approved"
    && review.humanDecision.status === "approved"
    && review.humanDecision.decidedBy === "muxin"
    && review.humanDecision.decidedAt !== null;
}

function reviewStage(review: GrowReviewBundle | null): StudioReadinessStageProjection {
  if (review === null) return stage("review", "blocked", ["review bundle is missing"]);

  const blockers: string[] = [];
  if (review.readiness.status === "blocked") {
    blockers.push(...review.readiness.blockingFields);
    if (review.readiness.blockingFields.length === 0) blockers.push("review readiness is blocked");
  }
  if (!reviewApproved(review)) blockers.push("review is not approved by Muxin");
  if (review.generatesCopy !== false) blockers.push("review bundle must not generate copy");
  if (review.sideEffects !== "none") blockers.push("review bundle has side effects");
  return stage("review", blockers.length === 0 ? "ready" : "blocked", blockers);
}

function deliveryStage(
  delivery: GrowDeliveryRecord | null,
  review: GrowReviewBundle | null,
  reviewProjection: StudioReadinessStageProjection,
  source: StudioReadinessStageProjection,
  brief: StudioReadinessStageProjection,
): StudioReadinessStageProjection {
  if (delivery === null) return stage("delivery", "blocked", ["delivery record is missing"]);

  const blockers: string[] = [];
  if (review === null) {
    blockers.push("review bundle is missing");
  } else if (delivery.reviewBundleId !== review.id) {
    blockers.push("delivery record does not match review bundle");
  } else if (!reviewApproved(review)) {
    blockers.push("review is not approved by Muxin");
  }
  if (reviewProjection.status !== "ready") blockers.push("delivery waits for review readiness");
  if (source.status !== "ready") blockers.push("delivery waits for source readiness");
  if (brief.status !== "ready") blockers.push("delivery waits for generation brief");
  if (delivery.readiness.status === "blocked") {
    blockers.push(...delivery.readiness.blockers);
    if (delivery.readiness.blockers.length === 0) blockers.push("delivery readiness is blocked");
  }
  if (delivery.autoPublishing !== false) blockers.push("delivery record permits auto-publishing");
  if (delivery.sideEffects !== "none") blockers.push("delivery record has side effects");
  return stage("delivery", blockers.length === 0 ? "ready" : "blocked", blockers);
}

function learningStage(learning: CommentLearningView | null): StudioReadinessStageProjection {
  if (learning === null) return stage("learning", "blocked", ["comment-learning view is missing"]);
  if (learning.readiness.status === "ready") return stage("learning", "ready");
  return stage(
    "learning",
    "blocked",
    learning.readiness.blockers.length > 0 ? learning.readiness.blockers : ["learning readiness is blocked"],
  );
}

function briefGate(brief: GenerationBrief | null): StudioHumanGate {
  if (brief === null) return gate("pending", ["generation brief is missing"]);
  return gate(brief.humanGate.status, brief.humanGate.status === "pending" ? ["brief human approval is pending"] : []);
}

function reviewGate(review: GrowReviewBundle | null): StudioHumanGate {
  if (review === null) return gate("pending", ["review bundle is missing"]);
  const status = review.humanDecision.status === "candidate" ? "pending" : review.humanDecision.status;
  const blockers: string[] = [];
  if (status === "pending") blockers.push("human review is pending");
  if (status === "rejected") blockers.push("human review was rejected");
  if (status === "needs-another-pass") blockers.push("human review needs another pass");
  if (review.readiness.status === "blocked") blockers.push(...review.readiness.blockingFields);
  return gate(status, blockers);
}

function deliveryGate(delivery: GrowDeliveryRecord | null, blockers: readonly string[]): StudioHumanGate {
  return delivery !== null && blockers.length === 0
    ? gate("approved")
    : gate("pending", blockers.length > 0 ? blockers : ["delivery record is missing"]);
}

function learningGate(learning: CommentLearningView | null): StudioHumanGate {
  if (learning === null) return gate("pending", ["comment-learning view is missing"]);
  if (learning.muxinDecision === "adopted") return gate("approved");
  if (learning.muxinDecision === "declined") return gate("rejected", ["Muxin declined the learning handoff"]);
  return gate("pending", ["Muxin learning decision is pending"]);
}

/**
 * Compose explicit Studio facts into a deterministic lifecycle readiness view.
 *
 * This function reads status and readiness metadata only. It does not read bodies, invoke a
 * model, create downstream artifacts, call a publisher or reply path, or perform any I/O.
 */
export function buildStudioReadiness(input: StudioReadinessInput): StudioReadiness {
  const brief = supplied(input.brief, input.generationBrief);
  const review = supplied(input.reviewBundle, input.review);
  const learning = input.learning !== undefined
    ? input.learning
    : input.commentLearning !== undefined
      ? input.commentLearning
      : input.commentLearningView === undefined ? null : input.commentLearningView;

  const source = sourceStage(input.sourceStatus);
  const briefProjection = briefStage(brief);
  const reviewProjection = reviewStage(review);
  const delivery = input.delivery !== undefined ? input.delivery : input.deliveryRecord ?? null;
  const deliveryProjection = deliveryStage(delivery, review, reviewProjection, source, briefProjection);
  const learningProjection = learningStage(learning);
  const stages = [source, briefProjection, reviewProjection, deliveryProjection, learningProjection];
  const blockers = uniqueSorted(stages.flatMap((current) => current.blockers));

  return {
    kind: "studio_readiness",
    version: STUDIO_READINESS_VERSION,
    stages,
    gates: {
      brief: briefGate(brief),
      review: reviewGate(review),
      delivery: deliveryGate(delivery, deliveryProjection.blockers),
      learning: learningGate(learning),
    },
    readiness: {
      status: blockers.length === 0 ? "ready" : "blocked",
      blockers,
    },
    generatesCopy: false,
    creatorBodyCopyAllowed: false,
    autoPublishing: false,
    sideEffects: "none",
  };
}

export const createStudioReadiness = buildStudioReadiness;
export const aggregateStudioReadiness = buildStudioReadiness;
