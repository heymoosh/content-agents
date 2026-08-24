import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildGrowCapacityManifest } from "./capacity.js";
import { buildGrowReviewBundle } from "./review-bundle.js";
import { buildGrowDeliveryRecord } from "./delivery-record.js";
import { buildGrowReconciliation } from "./reconciliation.js";

const baseReview = buildGrowReviewBundle({
  id: "review-1", sourceRef: "source-1", cutRef: "cut-1", variantRefs: ["variant-1"], publishRefs: ["publish-1"],
  lineage: { sourceId: "source-1", cutId: "cut-1", variantId: "variant-1" },
  evidence: { status: "supported", refs: ["evidence-1"] }, voiceCheck: "passed", originalityCheck: "passed",
  readiness: { status: "ready", blockingFields: [], reason: "ready" },
  humanDecision: { status: "approved", decidedBy: "muxin", decidedAt: "2026-08-24T12:00:00Z" },
});
const review = {
  ...baseReview,
  lineage: [...(baseReview.lineage ?? []),
    { recordType: "experiment", id: "experiment-1", relation: null },
    { recordType: "publish", id: "publish-1", relation: null }],
};
const capacity = buildGrowCapacityManifest({
  days: ["2026-08-25"], platforms: ["linkedin"],
  candidates: [{ id: "candidate-1", day: "2026-08-25", platform: "linkedin", status: "approved" }],
  slotCapacity: [{ day: "2026-08-25", platform: "linkedin", capacity: 1, scheduledCount: 0 }],
});
const delivery = buildGrowDeliveryRecord({
  reviewBundle: review, capacityManifest: capacity, capacityCandidateIds: ["candidate-1"],
  candidate: { id: "candidate-1", day: "2026-08-25", platform: "linkedin" }, status: "approved",
});
const lineage = { sourceId: "source-1", cutId: "cut-1", variantId: "variant-1", experimentId: "experiment-1", publishId: "publish-1" };
const queue = { artifactId: "candidate-1", status: "approved" as const, lineage };
const scheduler = { deliveryId: delivery.id, status: "unscheduled" as const, lineage };

describe("grow reconciliation", () => {
  test("returns an approved read-only reconciliation when all facts agree", () => {
    const result = buildGrowReconciliation({ reviewBundle: review, delivery, queue, scheduler });
    assert.equal(result.status, "approved");
    assert.deepEqual(result.readiness, { status: "ready", blockers: [] });
    assert.equal(result.sideEffects, "none");
  });

  test("uses the review publish declaration consistently with delivery", () => {
    const reviewWithBoth = {
      ...review,
      lineage: [...(review.lineage ?? []), { recordType: "publish", id: "lineage-publish", relation: null }],
    };
    const deliveryWithBoth = buildGrowDeliveryRecord({
      reviewBundle: reviewWithBoth,
      capacityManifest: capacity,
      capacityCandidateIds: ["candidate-1"],
      candidate: { id: "candidate-1", day: "2026-08-25", platform: "linkedin" },
      status: "approved",
    });
    const result = buildGrowReconciliation({
      reviewBundle: reviewWithBoth,
      delivery: deliveryWithBoth,
      queue: { artifactId: "candidate-1", status: "approved", lineage: deliveryWithBoth.lineage },
      scheduler: { deliveryId: deliveryWithBoth.id, status: "unscheduled", lineage: deliveryWithBoth.lineage },
    });
    assert.equal(deliveryWithBoth.lineage.publishId, "publish-1");
    assert.equal(result.status, "approved");
    assert.deepEqual(result.readiness.blockers, []);
  });

  test("blocks a queue approval that is not backed by Muxin's bundle decision", () => {
    const result = buildGrowReconciliation({ reviewBundle: { ...review, status: "candidate" }, delivery, queue, scheduler });
    assert.equal(result.status, "blocked");
    assert.ok(result.readiness.blockers.includes("review bundle is not approved by Muxin"));
  });

  test("reports lineage disagreement and scheduler drift instead of repairing either record", () => {
    const result = buildGrowReconciliation({
      reviewBundle: review, delivery,
      queue: { ...queue, lineage: { ...lineage, variantId: "other-variant" } },
      scheduler: { ...scheduler, status: "scheduled", lineage },
    });
    assert.equal(result.status, "drifted");
    assert.ok(result.readiness.blockers.includes("queue lineage disagrees with delivery lineage"));
    assert.ok(result.readiness.blockers.includes("scheduler says scheduled but delivery is not scheduled"));
  });

  test("requires scheduler evidence for published delivery", () => {
    const published = { ...delivery, status: "published" as const, publishRef: "publish-1", publishedAt: "2026-08-25T12:00:00Z" };
    const result = buildGrowReconciliation({ reviewBundle: review, delivery: published, queue: { ...queue, status: "published" }, scheduler });
    assert.equal(result.status, "blocked");
    assert.ok(result.readiness.blockers.includes("published delivery lacks published scheduler evidence"));
  });
});
