import assert from "node:assert/strict";
import test from "node:test";

import { createVolumePlan, type VolumePlanBrief } from "./volume-plan.js";

function brief(overrides: Partial<VolumePlanBrief> = {}): VolumePlanBrief {
  return {
    sourceReference: "essay:attention",
    substanceReference: "substance:attention",
    platforms: ["linkedin", "x"],
    dailyVolumePerPlatform: { linkedin: 1, x: 1 },
    variants: [
      {
        id: "linkedin-a",
        platform: "linkedin",
        experimentAssignment: { opening: "question" },
        readiness: { status: "ready", blockers: [] },
      },
      {
        id: "linkedin-b",
        platform: "linkedin",
        experimentAssignment: { opening: "observation" },
        readiness: { status: "blocked", blockers: ["format review pending"] },
      },
      {
        id: "x-a",
        platform: "x",
        experimentAssignment: null,
        readiness: { status: "ready", blockers: [] },
      },
      {
        id: "x-b",
        platform: "x",
        experimentAssignment: { cta: "reply" },
        readiness: { status: "ready", blockers: [] },
      },
    ],
    ...overrides,
  };
}

test("plans deterministic per-platform daily slots", () => {
  const first = createVolumePlan(brief({ dailyVolumePerPlatform: { linkedin: 2, x: 2 } }));
  const second = createVolumePlan(brief({ dailyVolumePerPlatform: { x: 2, linkedin: 2 } }));

  assert.deepEqual(first, second);
  assert.deepEqual(
    first.slots.map(({ platform, dayIndex, slotIndex, variantId }) => [platform, dayIndex, slotIndex, variantId]),
    [
      ["linkedin", 0, 0, "linkedin-a"],
      ["linkedin", 0, 1, "linkedin-b"],
      ["x", 0, 0, "x-a"],
      ["x", 0, 1, "x-b"],
    ],
  );
});

test("uses overrides and wraps variants round-robin across planned days", () => {
  const result = createVolumePlan(
    brief({
      platforms: ["x"],
      dailyVolumePerPlatform: { x: 1 },
      variants: [
        { id: "x-a", platform: "x", experimentAssignment: { hook: "a" } },
        { id: "x-b", platform: "x", experimentAssignment: { hook: "b" } },
        { id: "x-c", platform: "x", experimentAssignment: { hook: "c" } },
      ],
    }),
    { x: 2 },
  );

  assert.deepEqual(result.slots.map((slot) => [slot.dayIndex, slot.slotIndex, slot.variantId]), [
    [0, 0, "x-a"],
    [0, 1, "x-b"],
    [1, 0, "x-c"],
  ]);
});

test("rejects unknown platforms, invalid volumes, and platforms without variants", () => {
  assert.throws(() => createVolumePlan(brief(), { mastodon: 1 }), /unknown platform/);
  assert.throws(() => createVolumePlan(brief(), { x: 0 }), /positive integer/);
  assert.throws(() => createVolumePlan(brief({ platforms: ["linkedin"], variants: [] })), /no variants/);
  assert.throws(() => createVolumePlan(brief({ platforms: ["mastodon"] })), /no variants/);
});

test("preserves references, assignments, readiness, blockers, and review gates without copy", () => {
  const result = createVolumePlan(brief({ dailyVolumePerPlatform: { linkedin: 1, x: 1 } }));
  const blocked = result.slots.find((slot) => slot.variantId === "linkedin-b");

  assert.equal(result.sourceReference, "essay:attention");
  assert.equal(result.substanceReference, "substance:attention");
  assert.equal(result.generatesCopy, false);
  assert.equal(result.sideEffects, "none");
  assert.deepEqual(blocked, {
    platform: "linkedin",
    dayIndex: 1,
    slotIndex: 0,
    variantId: "linkedin-b",
    experimentAssignment: { opening: "observation" },
    readiness: "blocked",
    blockers: ["format review pending"],
    humanReviewRequired: true,
    humanGate: { required: true, before: "publish", approvalOwner: "human", status: "pending" },
  });
  assert.equal(Object.hasOwn(blocked!, "body"), false);
});
