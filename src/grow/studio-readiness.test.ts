import test from "node:test";
import assert from "node:assert/strict";

import { buildGrowCapacityManifest } from "./capacity.js";
import { buildCommentLearningView, type CommentLearningView } from "./comment-learning.js";
import { buildGrowDeliveryRecord } from "./delivery-record.js";
import { createGenerationBrief } from "./generation-brief.js";
import type { GrowGenerationReviewDelivery } from "./generation-review-delivery.js";
import { buildGrowReviewBundle } from "./review-bundle.js";
import { buildStudioReadiness, type StudioReadiness } from "./studio-readiness.js";

const briefInput = {
  sourceReference: "source:essay-1",
  substanceReference: "substance:essay-1",
  goal: "test an explicit Studio lifecycle",
  platforms: ["linkedin"],
  formats: ["short-post"],
  mediaModes: ["text"],
  topicLanes: ["human inference"],
  patternTemplateRefs: ["hook:observation"],
};

const reviewInput = {
  id: "review-1",
  sourceRef: { recordType: "source", id: "source-1" },
  cutRef: { recordType: "cut", id: "cut-1" },
  variantRefs: [{ recordType: "variant", id: "variant-1" }],
  publishRefs: [{ recordType: "publish", id: "publish-1" }],
  lineage: [
    { recordType: "source", id: "source-1" },
    { recordType: "cut", id: "cut-1" },
    { recordType: "variant", id: "variant-1" },
    { recordType: "experiment", id: "experiment-1" },
  ],
  evidence: { status: "supported" as const, refs: ["evidence-1"] },
  voiceCheck: "passed" as const,
  originalityCheck: "passed" as const,
  readiness: { status: "ready" as const, blockingFields: [], reason: "ready" },
  humanDecision: { status: "approved" as const, decidedBy: "muxin" as const, decidedAt: "2026-08-24T12:00:00Z" },
};

const brief = createGenerationBrief(briefInput);
const approvedReview = buildGrowReviewBundle(reviewInput);
const capacity = buildGrowCapacityManifest({
  days: ["2026-08-24"],
  platforms: ["linkedin"],
  candidates: [{ id: "candidate-1", day: "2026-08-24", platform: "linkedin", status: "approved" }],
  slotCapacity: [{ day: "2026-08-24", platform: "linkedin", capacity: 2, scheduledCount: 1 }],
});
const delivery = buildGrowDeliveryRecord({
  reviewBundle: approvedReview,
  capacityManifest: capacity,
  capacityCandidateIds: ["candidate-1"],
  candidate: { id: "candidate-1", day: "2026-08-24", platform: "linkedin" },
  status: "approved",
});
const learning = buildCommentLearningView({
  commentObservations: [],
  funnelEvents: [],
  businessOutcomes: [],
  muxinDecision: "adopted",
});

const volumePlan = {
  sourceReference: "source:essay-1",
  substanceReference: "substance:essay-1",
  slots: [{
    platform: "linkedin",
    dayIndex: 0,
    slotIndex: 0,
    variantId: "variant-1",
    experimentAssignment: null,
    readiness: "ready" as const,
    blockers: [],
    humanReviewRequired: true as const,
    humanGate: { required: true as const, before: "publish" as const, approvalOwner: "human" as const, status: "pending" as const },
  }],
  humanReviewRequired: true as const,
  generatesCopy: false as const,
  sideEffects: "none" as const,
};

const treatmentCoverage = {
  readiness: { status: "ready" as const, blockers: [] },
  generatesCopy: false as const,
  creatorBodyCopyAllowed: false as const,
  sideEffects: "none" as const,
};

const generationRunManifest = {
  coverage: {
    status: "complete" as const,
    expectedVariantIds: ["variant-1"],
    generatedVariantIds: ["variant-1"],
    duplicateVariantIds: [],
    missingVariantIds: [],
  },
  rows: [{ variantId: "variant-1", status: "ready" as const, blockers: [] }],
  humanReviewRequired: true as const,
  generatesCopy: false as const,
  sideEffects: "none" as const,
  autoApproval: false as const,
  autoScheduling: false as const,
  autoPublishing: false as const,
};

const readyGenerationReviewDelivery = {
  kind: "grow_generation_review_delivery",
  version: "grow-generation-review-delivery-v1",
  sourceReference: "source:essay-1",
  substanceReference: "substance:essay-1",
  rows: [{
    slot: { platform: "linkedin", dayIndex: 0, slotIndex: 0, variantId: "variant-1" },
    generatedArtifactRef: "artifact:variant-1",
    reviewQueueRef: "review:variant-1",
    reviewBundleId: "review-1",
    deliveryBinding: { readiness: { status: "ready", blockers: [] } },
    readiness: { status: "ready", blockers: [] },
  }],
  summary: { slots: 1, bound: 1, ready: 1, blocked: 0, missingBindings: 0 },
  readiness: { status: "ready", blockers: [] },
  bodyFree: true,
  generatesCopy: false,
  creatorBodyCopyAllowed: false,
  humanApprovalRequired: true,
  autoApproval: false,
  autoScheduling: false,
  autoPublishing: false,
  sideEffects: "none",
} as unknown as GrowGenerationReviewDelivery;

function stage(result: StudioReadiness, name: "source" | "brief" | "treatment-coverage" | "volume" | "generation" | "review" | "delivery" | "learning") {
  return result.stages.find((entry) => entry.stage === name);
}

test("adds explicitly blocked volume and generation stages for legacy input", () => {
  const result = buildStudioReadiness({ sourceStatus: "ready", brief, reviewBundle: approvedReview, delivery, learning });

  assert.deepEqual(result.stages.map(({ stage: name, status }) => ({ name, status })), [
    { name: "source", status: "ready" },
    { name: "brief", status: "ready" },
    { name: "treatment-coverage", status: "blocked" },
    { name: "volume", status: "blocked" },
    { name: "generation", status: "blocked" },
    { name: "review", status: "ready" },
    { name: "delivery", status: "ready" },
    { name: "learning", status: "ready" },
  ]);
  assert.deepEqual(stage(result, "volume")?.blockers, ["volume plan is missing"]);
  assert.deepEqual(stage(result, "generation")?.blockers, ["generation run manifest is missing"]);
  assert.deepEqual(stage(result, "treatment-coverage")?.blockers, ["treatment coverage is missing"]);
});

test("accepts explicit ready volume and generation aliases in lifecycle order", () => {
  const result = buildStudioReadiness({
    sourceStatus: "ready",
    brief,
    treatmentCoverage,
    volumePlan,
    generationRunManifest,
    reviewBundle: approvedReview,
    delivery,
    learning,
  });

  assert.deepEqual(result.stages.map(({ stage: name, status }) => ({ name, status })), [
    { name: "source", status: "ready" },
    { name: "brief", status: "ready" },
    { name: "treatment-coverage", status: "ready" },
    { name: "volume", status: "ready" },
    { name: "generation", status: "ready" },
    { name: "review", status: "ready" },
    { name: "delivery", status: "ready" },
    { name: "learning", status: "ready" },
  ]);
  assert.equal(result.gates.volume.status, "pending");
  assert.equal(result.gates.generation.status, "pending");
  assert.equal(result.readiness.status, "ready");
});

test("folds the per-slot review-to-delivery join into delivery readiness without replacing the record gate", () => {
  const blockedJoin = {
    ...readyGenerationReviewDelivery,
    readiness: { status: "blocked", blockers: ["review:variant-1: live queue is missing"] },
  } as GrowGenerationReviewDelivery;
  const result = buildStudioReadiness({
    sourceStatus: "ready",
    brief,
    treatmentCoverage,
    volumePlan,
    generationRunManifest,
    reviewBundle: approvedReview,
    delivery,
    generationReviewDelivery: blockedJoin,
    learning,
  });

  assert.equal(stage(result, "delivery")?.status, "blocked");
  assert.ok(stage(result, "delivery")?.blockers.includes("review:variant-1: live queue is missing"));
  assert.equal(result.readiness.status, "blocked");

  const ready = buildStudioReadiness({
    sourceStatus: "ready",
    brief,
    treatmentCoverage,
    volumePlan,
    generationRunManifest,
    reviewBundle: approvedReview,
    delivery,
    generationReviewDelivery: readyGenerationReviewDelivery,
    learning,
  });
  assert.equal(stage(ready, "delivery")?.status, "ready");
});

test("blocks volume and generation on explicit readiness and one-to-one coverage gaps", () => {
  const result = buildStudioReadiness({
    sourceStatus: "ready",
    brief,
    treatmentCoverage,
    volumePlan: {
      ...volumePlan,
      slots: [{ ...volumePlan.slots[0], readiness: "blocked", blockers: ["slot review pending"] }],
    },
    generationRunManifest: {
      ...generationRunManifest,
      coverage: {
        ...generationRunManifest.coverage,
        status: "incomplete",
        generatedVariantIds: [],
        missingVariantIds: ["variant-1"],
      },
      rows: [{ variantId: "variant-1", status: "blocked", blockers: ["generation row blocked"] }],
    },
    reviewBundle: approvedReview,
    delivery,
    learning,
  });

  assert.deepEqual(stage(result, "volume")?.blockers, ["slot review pending"]);
  assert.equal(stage(result, "generation")?.status, "blocked");
  assert.ok(stage(result, "generation")?.blockers.includes("generation row blocked"));
  assert.ok(stage(result, "generation")?.blockers.includes("generation run coverage is incomplete"));
  assert.ok(stage(result, "generation")?.blockers.includes("generation run coverage is not one-to-one"));
  assert.deepEqual(stage(result, "generation")?.blockers, [...(stage(result, "generation")?.blockers ?? [])].sort());
});

test("fails closed at volume and generation safety boundaries", () => {
  const result = buildStudioReadiness({
    sourceStatus: "ready",
    brief,
    treatmentCoverage,
    volumePlan: { ...volumePlan, generatesCopy: true, sideEffects: "writes-queue" },
    generationRunManifest: {
      ...generationRunManifest,
      humanReviewRequired: false,
      generatesCopy: true,
      sideEffects: "invokes-model",
      autoApproval: true,
      autoScheduling: true,
      autoPublishing: true,
    },
    reviewBundle: approvedReview,
    delivery,
    learning,
  });

  assert.equal(stage(result, "volume")?.status, "blocked");
  assert.ok(stage(result, "volume")?.blockers.includes("volume plan must not generate copy"));
  assert.ok(stage(result, "volume")?.blockers.includes("volume plan has side effects"));
  assert.equal(stage(result, "generation")?.status, "blocked");
  assert.ok(stage(result, "generation")?.blockers.includes("generation run must require human review"));
  assert.ok(stage(result, "generation")?.blockers.includes("generation run must not generate copy"));
  assert.ok(stage(result, "generation")?.blockers.includes("generation run has side effects"));
  assert.ok(stage(result, "generation")?.blockers.includes("generation run permits auto-approval"));
  assert.ok(stage(result, "generation")?.blockers.includes("generation run permits auto-scheduling"));
  assert.ok(stage(result, "generation")?.blockers.includes("generation run permits auto-publishing"));
});

test("accepts the canonical generation-run slots shape and keeps coverage before generation", () => {
  const result = buildStudioReadiness({
    sourceStatus: "ready",
    brief,
    treatmentCoverage,
    volumePlan,
    generationRunManifest: {
      kind: "grow_generation_run",
      version: "grow-generation-run-v1",
      slots: [{
        platform: "linkedin",
        dayIndex: 0,
        slotIndex: 0,
        variantId: "variant-1",
        status: "ready",
        readiness: { status: "ready", blockers: [] },
        blockers: [],
        generatedArtifactRef: "artifact:variant-1",
        reviewQueueRef: "review:variant-1",
        reviewQueueStatus: "pending",
        humanReviewRequired: true,
      }],
      summary: { slots: 1, ready: 1, blocked: 0, missing: 0, duplicate: 0, unexpected: 0 },
      readiness: { status: "ready", blockers: [] },
      humanReviewRequired: true,
      generatesCopy: false,
      creatorBodyCopyAllowed: false,
      autoApproval: false,
      autoScheduling: false,
      autoPublishing: false,
      sideEffects: "none",
    },
    reviewBundle: approvedReview,
    delivery,
    learning,
  });

  assert.equal(stage(result, "generation")?.status, "ready");
  assert.deepEqual(result.stages.map(({ stage: name }) => name), [
    "source", "brief", "treatment-coverage", "volume", "generation", "review", "delivery", "learning",
  ]);

  const blockedCoverage = buildStudioReadiness({
    sourceStatus: "ready",
    brief,
    treatmentCoverage: { ...treatmentCoverage, readiness: { status: "blocked", blockers: ["format is unreviewed"] } },
    volumePlan,
    generationRunManifest: {
      kind: "grow_generation_run",
      version: "grow-generation-run-v1",
      slots: [{
        platform: "linkedin", dayIndex: 0, slotIndex: 0, variantId: "variant-1", status: "ready",
        readiness: { status: "ready", blockers: [] }, blockers: [], humanReviewRequired: true,
        generatedArtifactRef: "artifact:variant-1", reviewQueueRef: "review:variant-1", reviewQueueStatus: "pending",
      }],
      summary: { slots: 1, ready: 1, blocked: 0, missing: 0, duplicate: 0, unexpected: 0 },
      readiness: { status: "ready", blockers: [] }, humanReviewRequired: true,
      generatesCopy: false, creatorBodyCopyAllowed: false, autoApproval: false,
      autoScheduling: false, autoPublishing: false, sideEffects: "none",
    },
    reviewBundle: approvedReview,
    delivery,
    learning,
  });
  assert.equal(stage(blockedCoverage, "treatment-coverage")?.status, "blocked");
  assert.ok(stage(blockedCoverage, "generation")?.blockers.includes("generation waits for treatment coverage"));
});

test("does not trust a generation summary over slot identity or unexpected candidates", () => {
  const base = {
    kind: "grow_generation_run" as const,
    version: "grow-generation-run-v1" as const,
    sourceReference: "source:essay-1",
    substanceReference: "substance:essay-1",
    summary: { slots: 1, ready: 1, blocked: 0, missing: 0, duplicate: 0, unexpected: 0 },
    readiness: { status: "ready" as const, blockers: [] },
    humanReviewRequired: true as const,
    generatesCopy: false as const,
    creatorBodyCopyAllowed: false as const,
    autoApproval: false as const,
    autoScheduling: false as const,
    autoPublishing: false as const,
    sideEffects: "none" as const,
  };
  const row = {
    platform: "linkedin", dayIndex: 0, slotIndex: 0, variantId: "other-variant", status: "ready" as const,
    readiness: { status: "ready" as const, blockers: [] }, blockers: [], humanReviewRequired: true as const,
    generatedArtifactRef: "artifact:other", reviewQueueRef: "review:other", reviewQueueStatus: "pending",
  };
  const mismatched = buildStudioReadiness({
    sourceStatus: "ready", brief, treatmentCoverage, volumePlan,
    generationRunManifest: { ...base, slots: [row], unexpectedCandidates: [] },
    reviewBundle: approvedReview, delivery, learning,
  });
  assert.equal(stage(mismatched, "generation")?.status, "blocked");
  assert.ok(stage(mismatched, "generation")?.blockers.includes("generation run slots do not match the volume plan"));

  const unexpected = buildStudioReadiness({
    sourceStatus: "ready", brief, treatmentCoverage, volumePlan,
    generationRunManifest: {
      ...base,
      slots: [{ ...row, variantId: "variant-1", generatedArtifactRef: "artifact:variant-1", reviewQueueRef: "review:variant-1" }],
      unexpectedCandidates: [{ ...row, platform: "x", variantId: "extra", status: "unexpected", readiness: { status: "blocked", blockers: ["unexpected"] } }],
    },
    reviewBundle: approvedReview, delivery, learning,
  });
  assert.equal(stage(unexpected, "generation")?.status, "blocked");
  assert.ok(stage(unexpected, "generation")?.blockers.includes("generation run has unexpected candidates"));
});

test("keeps a missing brief blocked even when later facts are supplied", () => {
  const result = buildStudioReadiness({
    sourceStatus: "ready",
    brief: null,
    reviewBundle: approvedReview,
    delivery,
    learning,
  });

  assert.deepEqual(stage(result, "brief"), {
    stage: "brief",
    status: "blocked",
    blockers: ["generation brief is missing"],
  });
  assert.equal(result.readiness.status, "blocked");
  assert.ok(result.readiness.blockers.includes("generation brief is missing"));
});

test("preserves blocked readiness from supplied brief, review, and learning facts", () => {
  const blockedBrief = createGenerationBrief({
    ...briefInput,
    platformFormatReadiness: [{
      platform: "linkedin",
      format: "short-post",
      readiness: { status: "blocked", blockers: ["format has not been reviewed"] },
    }],
  });
  const blockedReview = buildGrowReviewBundle({ ...reviewInput, humanDecision: undefined });
  const blockedLearning: CommentLearningView = {
    ...learning,
    readiness: { status: "blocked", blockers: ["learning evidence is missing"] },
  };
  const result = buildStudioReadiness({
    sourceStatus: "blocked",
    brief: blockedBrief,
    reviewBundle: blockedReview,
    delivery: null,
    learning: blockedLearning,
  });

  assert.equal(stage(result, "source")?.status, "blocked");
  assert.equal(stage(result, "brief")?.status, "blocked");
  assert.equal(stage(result, "review")?.status, "blocked");
  assert.equal(stage(result, "learning")?.status, "blocked");
  assert.ok(result.readiness.blockers.includes("format has not been reviewed"));
  assert.ok(result.readiness.blockers.includes("learning evidence is missing"));
});

test("does not treat an approved review as delivery readiness", () => {
  const result = buildStudioReadiness({
    sourceStatus: "ready",
    brief,
    treatmentCoverage,
    reviewBundle: approvedReview,
    learning,
  });

  assert.equal(stage(result, "review")?.status, "ready");
  assert.deepEqual(stage(result, "delivery"), {
    stage: "delivery",
    status: "blocked",
    blockers: ["delivery record is missing"],
  });
  assert.equal(result.readiness.status, "blocked");
});

test("does not let delivery pass when the review artifact violates copy-safety", () => {
  const unsafeReview = { ...approvedReview, generatesCopy: true } as unknown as typeof approvedReview;
  const result = buildStudioReadiness({
    sourceStatus: "ready",
    brief,
    reviewBundle: unsafeReview,
    delivery,
    learning,
  });

  assert.equal(stage(result, "review")?.status, "blocked");
  assert.equal(stage(result, "delivery")?.status, "blocked");
  assert.ok(stage(result, "delivery")?.blockers.includes("delivery waits for review readiness"));
});

test("returns deterministic stages and human gates for fully explicit input", () => {
  const input = {
    sourceStatus: "ready" as const,
    brief,
    treatmentCoverage,
    volumePlan,
    generationRunManifest,
    reviewBundle: approvedReview,
    delivery,
    learning,
  };
  const first = buildStudioReadiness(input);
  const second = buildStudioReadiness(input);

  assert.deepEqual(first, second);
  assert.deepEqual(first.stages.map(({ stage: name, status, blockers }) => ({ name, status, blockers })), [
    { name: "source", status: "ready", blockers: [] },
    { name: "brief", status: "ready", blockers: [] },
    { name: "treatment-coverage", status: "ready", blockers: [] },
    { name: "volume", status: "ready", blockers: [] },
    { name: "generation", status: "ready", blockers: [] },
    { name: "review", status: "ready", blockers: [] },
    { name: "delivery", status: "ready", blockers: [] },
    { name: "learning", status: "ready", blockers: [] },
  ]);
  assert.equal(first.gates.review.status, "approved");
  assert.equal(first.gates.delivery.status, "approved");
  assert.equal(first.gates.learning.status, "approved");
  assert.equal(first.sideEffects, "none");
  assert.equal(first.generatesCopy, false);
  assert.equal(first.creatorBodyCopyAllowed, false);
  assert.equal(first.autoPublishing, false);

  const serialized = JSON.stringify(first);
  assert.equal(serialized.includes("substance:essay-1"), false);
  assert.equal(serialized.includes("body"), false);
  assert.equal(serialized.includes("publish"), false);
  assert.equal(serialized.includes("venture"), false);
  assert.equal(serialized.includes("signals"), false);
});
