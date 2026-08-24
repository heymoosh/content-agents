import assert from "node:assert/strict";
import test from "node:test";

import { buildGrowCapacityManifest } from "./capacity.js";
import { buildDraftBatch, type DraftBatchInput } from "./draft-batch.js";
import { buildDraftBatchGenerationRun } from "./draft-batch-run.js";
import {
  buildGrowGenerationReviewDelivery,
  GROW_GENERATION_REVIEW_DELIVERY_VERSION,
} from "./generation-review-delivery.js";
import type { QueueRow } from "../publish/queue.js";
import type { Claim } from "../publish/slots.js";
import { composeGrowLiveFacts } from "./live-reconciliation.js";
import { buildGrowReviewBundle } from "./review-bundle.js";
import { buildGrowTreatmentCoverage } from "./treatment-coverage.js";
import { createVolumePlan } from "./volume-plan.js";

const batchInput: DraftBatchInput = {
  sourceThoughtRef: "thought:one",
  sourceArtifactRef: "artifact:one",
  generationBriefRef: "brief:one",
  volumePlanRef: "volume:one",
  treatmentCoverageRef: "coverage:one",
  voicePolicyRef: "voice:muxin",
  treatments: [{
    platform: "x",
    medium: "text",
    format: "thread",
    treatmentRef: "treatment:contrast",
    hookTemplateRefs: ["hook:question"],
    experimentRefs: ["experiment:opening"],
  }],
};

function fixture() {
  const batch = buildDraftBatch(batchInput);
  const volumePlan = createVolumePlan({
    sourceReference: "thought:one",
    substanceReference: "artifact:one",
    platforms: ["x"],
    dailyVolumePerPlatform: { x: 1 },
    variants: [{ id: "variant:one", platform: "x", experimentAssignment: null, readiness: { status: "ready", blockers: [] } }],
  });
  const treatmentCoverage = buildGrowTreatmentCoverage({
    requestedTreatments: [{ platform: "x", medium: "text", format: "thread", treatmentId: "treatment:contrast", experimentId: "experiment:opening", variables: {} }],
    candidates: [{ id: "candidate:one", platform: "x", medium: "text", format: "thread", treatmentId: "treatment:contrast", experimentId: "experiment:opening", variables: {}, readiness: { status: "ready", blockers: [] } }],
  });
  const request = batch.requests[0]!;
  const joined = buildDraftBatchGenerationRun({
    draftBatch: batch,
    volumePlan,
    treatmentCoverage,
    bindings: [{
      requestId: request.id,
      platform: "x",
      dayIndex: 0,
      slotIndex: 0,
      variantId: "variant:one",
      experimentAssignment: null,
      generatedArtifactRef: request.expectedOutputArtifactRef,
      reviewQueueRef: "review:one",
    }],
  });
  const generationRun = joined.generationRun;
  const slot = generationRun.slots[0]!;
  const reviewBundle = buildGrowReviewBundle({
    id: "review:one",
    reviewQueueRef: "review:one",
    sourceRef: { recordType: "source", id: "thought:one" },
    cutRef: { recordType: "cut", id: "cut:one" },
    variantRefs: [{ recordType: "variant", id: "variant:one" }],
    publishRefs: [{ recordType: "publish", id: "publish:one" }],
    lineage: [
      { recordType: "source", id: "thought:one" },
      { recordType: "cut", id: "cut:one" },
      { recordType: "variant", id: "variant:one" },
      { recordType: "treatment", id: "treatment:contrast" },
      { recordType: "experiment", id: "experiment:opening" },
    ],
    evidence: { status: "supported", refs: ["evidence:one"] },
    voiceCheck: "passed",
    originalityCheck: "passed",
    readiness: { status: "ready", blockingFields: [], reason: "ready" },
    humanDecision: { status: "approved", decidedBy: "muxin", decidedAt: "2026-08-24T12:00:00Z" },
  });
  const lineage = {
    sourceId: "thought:one",
    cutId: "cut:one",
    variantId: "variant:one",
    treatmentId: "treatment:contrast",
    experimentId: "experiment:opening",
  } as const;
  const legacyLineage = { ...lineage, publishId: "publish:one" };
  const queueRow: QueueRow = {
    id: slot.generatedArtifactRef!,
    platform: "x",
    format: "thread",
    asset: "artifact.md",
    status: "approve",
    notes: "",
    lineIndex: 0,
  };
  const claim: Claim = {
    platform: "x",
    day: "2026-08-25",
    time: "2026-08-25T16:00:00.000Z",
    asset: "artifact.md",
    by: "typefully",
  };
  const liveFacts = composeGrowLiveFacts({
    queueRow,
    queueLineage: legacyLineage,
    schedulerClaim: claim,
    schedulerObservation: {
      deliveryId: `delivery:${reviewBundle.id}:${slot.generatedArtifactRef}`,
      status: "approved",
      lineage: legacyLineage,
    },
  });
  const capacity = buildGrowCapacityManifest({
    days: ["2026-08-25"],
    platforms: ["x"],
    candidates: [{ id: slot.generatedArtifactRef, day: "2026-08-25", platform: "x", status: "approved" }],
    slotCapacity: [{ day: "2026-08-25", platform: "x", capacity: 1, scheduledCount: 0 }],
  });
  return { generationRun, slot, reviewBundle, lineage, liveFacts, capacitySlice: capacity.slices[0]! };
}

test("joins a pending generation slot to the reviewed queue and delivery binding", () => {
  const { generationRun, slot, reviewBundle, lineage, liveFacts, capacitySlice } = fixture();
  const result = buildGrowGenerationReviewDelivery({
    generationRun,
    bindings: [{
      slot,
      reviewQueueRef: slot.reviewQueueRef,
      reviewBundle,
      day: "2026-08-25",
      candidateLineage: lineage,
      capacitySlice,
      liveFacts,
      queueLineage: { ...lineage, publishId: "publish:one" },
      schedulerLineage: { ...lineage, publishId: "publish:one" },
      providerFacts: null,
      deliveryMode: "provider",
    }],
  });

  assert.equal(result.kind, "grow_generation_review_delivery");
  assert.equal(result.version, GROW_GENERATION_REVIEW_DELIVERY_VERSION);
  assert.deepEqual(result.summary, { slots: 1, bound: 1, ready: 1, blocked: 0, missingBindings: 0 });
  assert.equal(result.readiness.status, "ready");
  assert.equal(result.rows[0]?.deliveryBinding.status, "approved");
  assert.equal(result.rows[0]?.deliveryBinding.candidateId, slot.generatedArtifactRef);
  assert.equal(result.rows[0]?.reviewQueueRef, slot.reviewQueueRef);
  assert.equal(result.rows[0]?.reviewBundleId, reviewBundle.id);
  assert.equal(result.bodyFree, true);
  assert.equal(result.generatesCopy, false);
  assert.equal(result.autoPublishing, false);
  assert.equal(result.sideEffects, "none");
  assert.equal(Object.hasOwn(result.rows[0]?.deliveryBinding ?? {}, "body"), false);
});

test("keeps missing, mismatched, and incomplete review joins blocked", () => {
  const { generationRun, slot, reviewBundle, lineage, liveFacts, capacitySlice } = fixture();
  const missing = buildGrowGenerationReviewDelivery({ generationRun, bindings: [] });
  assert.equal(missing.summary.missingBindings, 1);
  assert.equal(missing.rows[0]?.readiness.status, "blocked");
  assert.ok(missing.rows[0]?.readiness.blockers.some((blocker) => /binding|review bundle|live/i.test(blocker)));

  const missingBundleQueueRef = buildGrowGenerationReviewDelivery({
    generationRun,
    bindings: [{
      slot,
      reviewQueueRef: slot.reviewQueueRef,
      reviewBundle: { ...reviewBundle, reviewQueueRef: null },
      day: "2026-08-25",
      candidateLineage: lineage,
      capacitySlice,
      liveFacts,
      queueLineage: { ...lineage, publishId: "publish:one" },
      schedulerLineage: { ...lineage, publishId: "publish:one" },
      providerFacts: null,
    }],
  });
  assert.ok(missingBundleQueueRef.rows[0]?.readiness.blockers.includes("review bundle review queue reference is missing"));

  const mismatchedBundleQueueRef = buildGrowGenerationReviewDelivery({
    generationRun,
    bindings: [{
      slot,
      reviewQueueRef: slot.reviewQueueRef,
      reviewBundle: { ...reviewBundle, reviewQueueRef: "review:other" },
      day: "2026-08-25",
      candidateLineage: lineage,
      capacitySlice,
      liveFacts,
      queueLineage: { ...lineage, publishId: "publish:one" },
      schedulerLineage: { ...lineage, publishId: "publish:one" },
      providerFacts: null,
    }],
  });
  assert.ok(mismatchedBundleQueueRef.rows[0]?.readiness.blockers.includes("review bundle does not match review queue reference"));

  const mismatched = buildGrowGenerationReviewDelivery({
    generationRun,
    bindings: [{
      slot,
      reviewQueueRef: "review:other",
      reviewBundle: {
        ...reviewBundle,
        reviewQueueRef: "review:other",
        sourceRef: { ...reviewBundle.sourceRef, id: "thought:other" },
      },
      day: "2026-08-25",
      candidateLineage: { ...lineage, variantId: "variant:other" },
      capacitySlice,
      liveFacts,
      queueLineage: { ...lineage, publishId: "publish:one" },
      schedulerLineage: { ...lineage, publishId: "publish:one" },
      providerFacts: null,
    }],
  });
  assert.equal(mismatched.readiness.status, "blocked");
  assert.ok(mismatched.rows[0]?.readiness.blockers.some((blocker) => /review queue reference|review bundle source|variant/i.test(blocker)));
  assert.equal(mismatched.rows[0]?.deliveryBinding.status, "blocked");
});

test("blocks duplicate artifact or queue references in a caller-shaped generation manifest", () => {
  const { generationRun, slot, reviewBundle, lineage, liveFacts, capacitySlice } = fixture();
  const secondSlot = { ...slot, slotIndex: 1, generatedArtifactRef: slot.generatedArtifactRef, reviewQueueRef: slot.reviewQueueRef };
  const shapedRun = { ...generationRun, slots: [slot, secondSlot] };
  const result = buildGrowGenerationReviewDelivery({
    generationRun: shapedRun,
    bindings: [{
      slot,
      reviewQueueRef: slot.reviewQueueRef,
      reviewBundle,
      day: "2026-08-25",
      candidateLineage: lineage,
      capacitySlice,
      liveFacts,
      queueLineage: { ...lineage, publishId: "publish:one" },
      schedulerLineage: { ...lineage, publishId: "publish:one" },
      providerFacts: null,
    }],
  });
  assert.equal(result.readiness.status, "blocked");
  assert.ok(result.rows.every((row) => row.readiness.blockers.some((blocker) => /duplicate (generated artifact|human review queue)/i.test(blocker))));
});

test("rejects duplicate or unknown slot bindings", () => {
  const { generationRun, slot } = fixture();
  const empty = { slot, reviewQueueRef: null, reviewBundle: null, day: null, candidateLineage: null, capacitySlice: null, liveFacts: null, providerFacts: null };
  assert.throws(() => buildGrowGenerationReviewDelivery({ generationRun, bindings: [empty, empty] }), /duplicate.*binding/i);
  assert.throws(() => buildGrowGenerationReviewDelivery({ generationRun, bindings: [{ ...empty, slot: { ...slot, slotIndex: 9 } }] }), /unknown generation slot/i);
});
