import test from "node:test";
import assert from "node:assert/strict";

import { buildGrowCapacityManifest } from "./capacity.js";
import { buildCommentLearningView, type CommentLearningView } from "./comment-learning.js";
import { buildGrowDeliveryRecord } from "./delivery-record.js";
import { createGenerationBrief } from "./generation-brief.js";
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

function stage(result: StudioReadiness, name: "source" | "brief" | "review" | "delivery" | "learning") {
  return result.stages.find((entry) => entry.stage === name);
}

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
