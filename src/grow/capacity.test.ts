import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  createGrowCapacityManifest,
  type GrowCapacityBlueprint,
} from "./capacity.js";

const day = "2026-08-24";

describe("createGrowCapacityManifest", () => {
  test("separates candidate volume from approved publish volume when review or slots are exhausted", () => {
    const manifest = createGrowCapacityManifest({
      days: [day],
      platforms: ["x"],
      reviewCapacity: [{ day, platform: "x", capacity: 1 }],
      slotCapacity: [{ day, platform: "x", capacity: 1, scheduledCount: 0 }],
      candidates: [
        { id: "pending-1", day, platform: "x", status: "candidate" },
        { id: "pending-2", day, platform: "x", status: "candidate" },
        { id: "approved-1", day, platform: "x", status: "approved" },
        { id: "approved-2", day, platform: "x", status: "approved" },
        { id: "rejected-1", day, platform: "x", status: "rejected" },
        { id: "blocked-1", day, platform: "x", status: "blocked" },
      ],
    });

    assert.deepEqual(manifest.counts, { candidates: 6, approved: 2, rejected: 1, blocked: 1 });
    assert.equal(manifest.internalCandidateVolume, 6);
    assert.equal(manifest.approvedPublishVolume, 0);
    assert.deepEqual(manifest.slices, [{
      day,
      platform: "x",
      candidateCount: 6,
      approvedCount: 2,
      rejectedCount: 1,
      blockedCount: 1,
      reviewCapacity: 1,
      slotCapacity: 1,
      scheduledCount: 0,
      availableSlots: 1,
      approvedPublishCount: 0,
      paused: true,
      pauseReasons: ["review-capacity-exhausted"],
      rollbackConditions: [],
      gapReasons: ["review-capacity-exhausted"],
    }]);
  });

  test("honors platform pauses and rollback conditions without changing candidate decisions", () => {
    const manifest = createGrowCapacityManifest({
      days: [day],
      platforms: ["linkedin", "x"],
      reviewCapacity: [
        { day, platform: "linkedin", capacity: 3 },
        { day, platform: "x", capacity: 3 },
      ],
      slotCapacity: [
        { day, platform: "linkedin", capacity: 2, scheduledCount: 0 },
        { day, platform: "x", capacity: 2, scheduledCount: 0 },
      ],
      pauses: [{ platform: "linkedin", reason: "publish error unresolved" }],
      rollbackConditions: [{
        platform: "x",
        condition: "rollback-after-publish-error",
        reason: "The last known-good cadence must be restored.",
        evidence: null,
      }],
      candidates: [
        { id: "linkedin-approved", day, platform: "linkedin", status: "approved" },
        { id: "x-approved", day, platform: "x", status: "approved" },
        { id: "unknown-status", day, platform: "x" },
        { id: "unknown-location", status: "approved" },
      ],
    });

    assert.equal(manifest.approvedPublishVolume, 0);
    assert.equal(manifest.slices[0]?.platform, "linkedin");
    assert.equal(manifest.slices[0]?.paused, true);
    assert.deepEqual(manifest.slices[0]?.pauseReasons, ["publish error unresolved"]);
    assert.equal(manifest.slices[0]?.approvedPublishCount, 0);
    assert.equal(manifest.slices[1]?.paused, true);
    assert.deepEqual(manifest.slices[1]?.rollbackConditions, [{
      platform: "x",
      day: null,
      condition: "rollback-after-publish-error",
      reason: "The last known-good cadence must be restored.",
      evidence: null,
    }]);
    assert.equal(manifest.slices[1]?.approvedPublishCount, 0);
    assert.deepEqual(manifest.counts, { candidates: 4, approved: 2, rejected: 0, blocked: 2 });
    assert.equal(manifest.unassignedCandidates, 1);
  });

  test("limits approved publish volume to remaining platform slots", () => {
    const manifest = createGrowCapacityManifest({
      days: [day],
      platforms: ["x"],
      reviewCapacity: [{ day, platform: "x", capacity: 4 }],
      slotCapacity: [{ day, platform: "x", capacity: 2, scheduledCount: 2 }],
      candidates: [
        { id: "approved-1", day, platform: "x", status: "approved" },
        { id: "approved-2", day, platform: "x", status: "approved" },
      ],
    });

    assert.equal(manifest.slices[0]?.availableSlots, 0);
    assert.equal(manifest.slices[0]?.approvedPublishCount, 0);
    assert.equal(manifest.slices[0]?.paused, false);
    assert.deepEqual(manifest.slices[0]?.gapReasons, ["slot-capacity-exhausted"]);
    assert.equal(manifest.approvedPublishVolume, 0);
  });

  test("reports positive approved publish volume when review and slots are available", () => {
    const manifest = createGrowCapacityManifest({
      days: [day],
      platforms: ["x"],
      reviewCapacity: [{ day, platform: "x", capacity: 3 }],
      slotCapacity: [{ day, platform: "x", capacity: 2, scheduledCount: 0 }],
      candidates: [
        { id: "approved-1", day, platform: "x", status: "approved" },
        { id: "approved-2", day, platform: "x", status: "approved" },
      ],
    });

    assert.equal(manifest.slices[0]?.approvedPublishCount, 2);
    assert.equal(manifest.approvedPublishVolume, 2);
    assert.equal(manifest.internalCandidateVolume, 2);
  });

  test("is deterministic, does not infer missing capacity, and never auto-approves candidates", () => {
    const input: GrowCapacityBlueprint = {
      days: [day, "2026-08-25"],
      platforms: ["x", "bluesky"],
      reviewCapacity: [{ day, platform: "x", capacity: null }],
      slotCapacity: [{ day, platform: "x", capacity: null, scheduledCount: null }],
      candidates: [
        { id: "candidate", day, platform: "x", status: "candidate" },
        { id: "blocked", day, platform: "x", status: "blocked" },
      ],
    };

    const first = createGrowCapacityManifest(input);
    const second = createGrowCapacityManifest({
      ...input,
      days: [...input.days].reverse(),
      platforms: [...input.platforms].reverse(),
      candidates: [...input.candidates].reverse(),
      reviewCapacity: [...(input.reviewCapacity ?? [])].reverse(),
      slotCapacity: [...(input.slotCapacity ?? [])].reverse(),
    });

    assert.deepEqual(first, second);
    assert.equal(first.approvedPublishVolume, 0);
    assert.equal(first.slices[0]?.reviewCapacity, null);
    assert.equal(first.slices[0]?.availableSlots, null);
    assert.equal(first.slices[0]?.approvedPublishCount, 0);
    assert.ok(first.slices.some((slice) => slice.day === "2026-08-25" && slice.platform === "bluesky"));
    assert.equal(first.generatesCopy, false);
    assert.equal(first.autoApproval, false);
    assert.equal(first.scheduling, "none");
    assert.equal(first.publishing, "none");
    assert.equal(first.sideEffects, "none");
  });
});
