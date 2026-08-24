import assert from "node:assert/strict";
import test from "node:test";

import { buildDraftBatch, type DraftBatchInput } from "./draft-batch.js";
import { buildDraftBatchGenerationRun } from "./draft-batch-run.js";
import { createVolumePlan } from "./volume-plan.js";
import { buildGrowTreatmentCoverage } from "./treatment-coverage.js";

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
  return { batch, volumePlan, treatmentCoverage };
}

test("joins explicit draft requests to volume slots as pending generation candidates", () => {
  const { batch, volumePlan, treatmentCoverage } = fixture();
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
      reviewQueueRef: `review:${request.id}`,
    }],
  });

  assert.equal(joined.kind, "grow_draft_batch_generation_run");
  assert.deepEqual(joined.unboundRequestIds, []);
  assert.equal(joined.generationRun.summary.slots, 1);
  assert.equal(joined.generationRun.summary.blocked, 1);
  assert.equal(joined.generationRun.slots[0]?.generatedArtifactRef, request.expectedOutputArtifactRef);
  assert.equal(joined.generationRun.slots[0]?.reviewQueueStatus, "pending");
  assert.match(joined.generationRun.slots[0]?.blockers.join("\n") ?? "", /human review is pending/);
  assert.equal(joined.generatesCopy, false);
  assert.equal(joined.sideEffects, "none");
});

test("fails closed on unbound, duplicate, mismatched, and missing-review bindings", () => {
  const { batch, volumePlan, treatmentCoverage } = fixture();
  const request = batch.requests[0]!;
  const base = {
    requestId: request.id,
    platform: "x",
    dayIndex: 0,
    slotIndex: 0,
    variantId: "variant:one",
    experimentAssignment: null,
    generatedArtifactRef: request.expectedOutputArtifactRef,
    reviewQueueRef: "review:one",
  };
  assert.throws(
    () => buildDraftBatchGenerationRun({ draftBatch: batch, volumePlan, treatmentCoverage, bindings: [] }),
    /unbound.*request/i,
  );
  assert.throws(
    () => buildDraftBatchGenerationRun({ draftBatch: batch, volumePlan, treatmentCoverage, bindings: [base, base] }),
    /duplicate.*binding/i,
  );
  assert.throws(
    () => buildDraftBatchGenerationRun({ draftBatch: batch, volumePlan, treatmentCoverage, bindings: [{ ...base, generatedArtifactRef: "artifact:wrong" }] }),
    /expectedOutputArtifactRef/i,
  );
  assert.throws(
    () => buildDraftBatchGenerationRun({ draftBatch: batch, volumePlan, treatmentCoverage, bindings: [{ ...base, reviewQueueRef: "" }] }),
    /reviewQueueRef/i,
  );
});

test("keeps blocked treatment coverage explicit instead of promoting the run", () => {
  const { batch, volumePlan, treatmentCoverage } = fixture();
  const request = batch.requests[0]!;
  const blockedCoverage = { ...treatmentCoverage, readiness: { status: "blocked" as const, blockers: ["candidate is blocked"] } };
  const joined = buildDraftBatchGenerationRun({
    draftBatch: batch,
    volumePlan,
    treatmentCoverage: blockedCoverage,
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

  assert.equal(joined.readiness.status, "blocked");
  assert.match(joined.readiness.blockers.join("\n"), /candidate is blocked|treatment coverage/);
});
