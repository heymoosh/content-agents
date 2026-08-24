import assert from "node:assert/strict";
import test from "node:test";

import {
  createGenerationRun,
  type GenerationRunCandidate,
  type GenerationRunInput,
} from "./generation-run.js";
import type { GrowTreatmentCoverage } from "./treatment-coverage.js";
import type { VolumePlan, VolumePlanSlot } from "./volume-plan.js";

function slot(overrides: Partial<VolumePlanSlot> = {}): VolumePlanSlot {
  return {
    platform: "linkedin",
    dayIndex: 0,
    slotIndex: 0,
    variantId: "linkedin-a",
    experimentAssignment: { opening: "question" },
    readiness: "ready",
    blockers: [],
    humanReviewRequired: true,
    humanGate: { required: true, before: "publish", approvalOwner: "human", status: "pending" },
    ...overrides,
  };
}

function plan(overrides: Partial<VolumePlan> = {}): VolumePlan {
  return {
    sourceReference: "essay:attention",
    substanceReference: "substance:attention",
    slots: [
      slot(),
      slot({
        platform: "x",
        slotIndex: 1,
        variantId: "x-a",
        experimentAssignment: null,
      }),
    ],
    humanReviewRequired: true,
    generatesCopy: false,
    sideEffects: "none",
    ...overrides,
  };
}

function treatmentCoverage(status: "ready" | "blocked" = "ready"): GrowTreatmentCoverage {
  return {
    kind: "grow_treatment_coverage",
    version: "grow-treatment-coverage-v1",
    rows: [],
    unexpectedCandidates: [],
    summary: { requested: 0, matched: 0, missing: 0, duplicate: 0, blocked: 0, unexpected: 0 },
    readiness: { status, blockers: status === "ready" ? [] : ["requested treatment is blocked"] },
    generatesCopy: false,
    creatorBodyCopyAllowed: false,
    sideEffects: "none",
  };
}

function candidate(
  current: VolumePlanSlot,
  overrides: Partial<GenerationRunCandidate> = {},
): GenerationRunCandidate {
  return {
    platform: current.platform,
    dayIndex: current.dayIndex,
    slotIndex: current.slotIndex,
    variantId: current.variantId,
    experimentAssignment: current.experimentAssignment ? { ...current.experimentAssignment } : null,
    generatedArtifactRef: `artifact:${current.variantId}`,
    reviewQueueRef: `review:${current.variantId}`,
    reviewQueueStatus: "pending",
    readiness: { status: "ready", blockers: [] },
    ...overrides,
  };
}

function input(
  candidates: readonly GenerationRunCandidate[],
  overrides: Partial<VolumePlan> = {},
  coverage: GrowTreatmentCoverage | null = treatmentCoverage(),
): GenerationRunInput {
  return { volumePlan: plan(overrides), candidates, treatmentCoverage: coverage };
}

test("maps every ready volume slot to its supplied artifact and pending review references", () => {
  const volumePlan = plan();
  const result = createGenerationRun(input(volumePlan.slots.map((current) => candidate(current))));

  assert.equal(result.kind, "grow_generation_run");
  assert.equal(result.version, "grow-generation-run-v1");
  assert.equal(result.sourceReference, "essay:attention");
  assert.equal(result.substanceReference, "substance:attention");
  assert.deepEqual(result.slots.map((current) => ({
    platform: current.platform,
    dayIndex: current.dayIndex,
    slotIndex: current.slotIndex,
    variantId: current.variantId,
    experimentAssignment: current.experimentAssignment,
    status: current.status,
    generatedArtifactRef: current.generatedArtifactRef,
    reviewQueueRef: current.reviewQueueRef,
    reviewQueueStatus: current.reviewQueueStatus,
  })), [
    {
      platform: "linkedin",
      dayIndex: 0,
      slotIndex: 0,
      variantId: "linkedin-a",
      experimentAssignment: { opening: "question" },
      status: "ready",
      generatedArtifactRef: "artifact:linkedin-a",
      reviewQueueRef: "review:linkedin-a",
      reviewQueueStatus: "pending",
    },
    {
      platform: "x",
      dayIndex: 0,
      slotIndex: 1,
      variantId: "x-a",
      experimentAssignment: null,
      status: "ready",
      generatedArtifactRef: "artifact:x-a",
      reviewQueueRef: "review:x-a",
      reviewQueueStatus: "pending",
    },
  ]);
  assert.deepEqual(result.summary, { slots: 2, ready: 2, blocked: 0, missing: 0, duplicate: 0, unexpected: 0 });
  assert.deepEqual(result.readiness, { status: "ready", blockers: [] });
});

test("keeps a complete slot map blocked when treatment coverage is missing", () => {
  const volumePlan = plan();
  const result = createGenerationRun({
    volumePlan,
    candidates: volumePlan.slots.map((current) => candidate(current)),
  });

  assert.equal(result.summary.ready, 2);
  assert.equal(result.treatmentCoverage.supplied, false);
  assert.equal(result.treatmentCoverage.status, "blocked");
  assert.deepEqual(result.treatmentCoverage.blockers, ["treatment coverage is missing"]);
  assert.equal(result.readiness.status, "blocked");
  assert.match(result.readiness.blockers.join("\n"), /treatment coverage is missing/);
});

test("keeps a complete slot map blocked when supplied treatment coverage is blocked", () => {
  const volumePlan = plan();
  const result = createGenerationRun(input(
    volumePlan.slots.map((current) => candidate(current)),
    {},
    treatmentCoverage("blocked"),
  ));

  assert.equal(result.summary.ready, 2);
  assert.equal(result.treatmentCoverage.supplied, true);
  assert.equal(result.treatmentCoverage.status, "blocked");
  assert.match(result.treatmentCoverage.blockers.join("\n"), /treatment coverage is blocked/);
  assert.match(result.readiness.blockers.join("\n"), /requested treatment is blocked/);
  assert.equal(result.readiness.status, "blocked");
});

test("preserves blocked plan and candidate metadata as explicit blockers", () => {
  const volumePlan = plan({
    slots: [slot({ readiness: "blocked", blockers: ["format review pending"] })],
  });
  const result = createGenerationRun(input([
    candidate(volumePlan.slots[0]!, {
      readiness: { status: "blocked", blockers: ["candidate evidence is missing"] },
    }),
  ], volumePlan));

  assert.equal(result.slots[0]?.status, "blocked");
  assert.deepEqual(result.slots[0]?.blockers, [
    "candidate evidence is missing",
    "format review pending",
    "volume plan slot readiness is blocked",
  ]);
  assert.equal(result.slots[0]?.generatedArtifactRef, "artifact:linkedin-a");
  assert.equal(result.slots[0]?.reviewQueueRef, "review:linkedin-a");
  assert.match(result.readiness.blockers.join("\n"), /candidate evidence is missing/);
  assert.match(result.readiness.blockers.join("\n"), /format review pending/);
});

test("keeps missing, duplicate, wrong-platform, wrong-variant, and unexpected candidates visible", () => {
  const volumePlan = plan({
    slots: [
      slot(),
      slot({ dayIndex: 1, variantId: "linkedin-b", experimentAssignment: { opening: "observation" } }),
    ],
  });
  const first = candidate(volumePlan.slots[0]!);
  const result = createGenerationRun(input([
    first,
    { ...first, generatedArtifactRef: "artifact:duplicate", reviewQueueRef: "review:duplicate" },
    candidate(volumePlan.slots[1]!, { platform: "mastodon" }),
    candidate(volumePlan.slots[1]!, { variantId: "linkedin-wrong" }),
  ], volumePlan));

  assert.deepEqual(result.slots.map((current) => [current.status, current.generatedArtifactRef]), [
    ["duplicate", null],
    ["missing", null],
  ]);
  assert.equal(result.unexpectedCandidates.length, 2);
  assert.match(result.unexpectedCandidates[0]?.blockers.join("; ") ?? "", /platform|unexpected/i);
  assert.match(result.unexpectedCandidates[1]?.blockers.join("; ") ?? "", /variant|unexpected/i);
  assert.deepEqual(result.summary, { slots: 2, ready: 0, blocked: 0, missing: 1, duplicate: 1, unexpected: 2 });
  assert.match(result.readiness.blockers.join("\n"), /missing/);
  assert.match(result.readiness.blockers.join("\n"), /duplicate/);
  assert.match(result.readiness.blockers.join("\n"), /unexpected/);
});

test("blocks duplicate human review queue references across distinct slots", () => {
  const volumePlan = plan();
  const result = createGenerationRun(input(
    volumePlan.slots.map((current) => candidate(current, { reviewQueueRef: "review:shared" })),
    volumePlan,
  ));

  assert.deepEqual(result.slots.map((current) => current.status), ["blocked", "blocked"]);
  assert.ok(result.slots.every((current) => current.blockers.includes("duplicate human review queue reference")));
  assert.match(result.readiness.blockers.join("\n"), /duplicate human review queue reference/);
});

test("blocks duplicate generated artifact references across distinct slots", () => {
  const volumePlan = plan();
  const result = createGenerationRun(input(
    volumePlan.slots.map((current) => candidate(current, { generatedArtifactRef: "artifact:shared" })),
    volumePlan,
  ));

  assert.deepEqual(result.slots.map((current) => current.status), ["blocked", "blocked"]);
  assert.ok(result.slots.every((current) => current.blockers.includes("duplicate generated artifact reference")));
  assert.match(result.readiness.blockers.join("\n"), /duplicate generated artifact reference/);
});

test("uses canonical slot ordering regardless of candidate and plan input order", () => {
  const volumePlan = plan({
    slots: [
      slot({ platform: "x", slotIndex: 1, variantId: "x-a", experimentAssignment: null }),
      slot({ platform: "linkedin", slotIndex: 0, variantId: "linkedin-a" }),
    ],
  });
  const candidates = volumePlan.slots.map((current) => candidate(current)).reverse();
  const result = createGenerationRun(input(candidates, volumePlan));

  assert.deepEqual(result.slots.map((current) => current.variantId), ["linkedin-a", "x-a"]);
});

test("does not mutate the volume plan, candidates, assignments, or blocker arrays", () => {
  const volumePlan = plan();
  const candidates = volumePlan.slots.map((current) => candidate(current));
  const beforePlan = structuredClone(volumePlan);
  const beforeCandidates = structuredClone(candidates);
  const result = createGenerationRun({ volumePlan, candidates });

  assert.deepEqual(volumePlan, beforePlan);
  assert.deepEqual(candidates, beforeCandidates);
  result.slots[0]!.experimentAssignment!.opening = "mutated-output";
  result.slots[0]!.blockers.push("mutated-output");
  assert.deepEqual(volumePlan, beforePlan);
  assert.deepEqual(candidates, beforeCandidates);
});

test("contains no body, copy, or asset payload and exposes every safety boundary", () => {
  const volumePlan = plan();
  const result = createGenerationRun(input(volumePlan.slots.map((current) => candidate(current))));

  assert.equal(result.generatesCopy, false);
  assert.equal(result.creatorBodyCopyAllowed, false);
  assert.equal(result.humanReviewRequired, true);
  assert.equal(result.autoApproval, false);
  assert.equal(result.autoScheduling, false);
  assert.equal(result.autoPublishing, false);
  assert.equal(result.sideEffects, "none");
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /"(?:body|content|assets?|copy)"\s*:/i);
  assert.equal(Object.hasOwn(result, "publishing"), false);
  assert.equal(Object.hasOwn(result, "scheduling"), false);
});
