import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildGrowCapacityManifest } from "./capacity.js";
import { buildGrowReviewBundle } from "./review-bundle.js";
import { buildGrowDeliveryRecord } from "./delivery-record.js";

const review = (status: "candidate" | "approved" = "approved") => buildGrowReviewBundle({
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
  evidence: { status: "supported", refs: ["evidence-1"] },
  voiceCheck: "passed",
  originalityCheck: "passed",
  readiness: { status: "ready", blockingFields: [], reason: "ready" },
  humanDecision: { status, decidedBy: status === "approved" ? "muxin" : null, decidedAt: status === "approved" ? "2026-08-23T12:00:00Z" : null },
});

const capacity = buildGrowCapacityManifest({
  days: ["2026-08-24"],
  platforms: ["linkedin"],
  candidates: [{ id: "candidate-1", day: "2026-08-24", platform: "linkedin", status: "approved" }],
  slotCapacity: [{ day: "2026-08-24", platform: "linkedin", capacity: 2, scheduledCount: 1 }],
});

const input = (status: "approved" | "scheduled" | "published" | "measured" = "approved") => ({
  reviewBundle: review(),
  capacityManifest: capacity,
  capacityCandidateIds: ["candidate-1"],
  candidate: { id: "candidate-1", day: "2026-08-24", platform: "linkedin" },
  status,
  publishRef: status === "published" || status === "measured" ? "publish-1" : null,
  publishedAt: status === "published" || status === "measured" ? "2026-08-24T15:00:00Z" : null,
  outcomeRefs: status === "measured" ? ["outcome-1"] : [],
});

describe("grow delivery record", () => {
  test("builds a ready approved record without scheduling or publishing", () => {
    const result = buildGrowDeliveryRecord(input());
    assert.equal(result.status, "approved");
    assert.deepEqual(result.readiness, { status: "ready", blockers: [] });
    assert.equal(result.lineage.experimentId, "experiment-1");
    assert.equal(result.autoScheduling, false);
    assert.equal(result.autoPublishing, false);
    assert.equal(result.sideEffects, "none");
  });

  test("blocks every delivery state when the review bundle is not approved by Muxin", () => {
    const result = buildGrowDeliveryRecord({ ...input("scheduled"), reviewBundle: review("candidate") });
    assert.equal(result.readiness.status, "blocked");
    assert.ok(result.readiness.blockers.includes("review bundle is not approved by Muxin"));
  });

  test("requires a real remaining slot before scheduled delivery", () => {
    const full = buildGrowCapacityManifest({
      days: ["2026-08-24"], platforms: ["linkedin"],
      candidates: [{ id: "candidate-1", day: "2026-08-24", platform: "linkedin", status: "approved" }],
      slotCapacity: [{ day: "2026-08-24", platform: "linkedin", capacity: 1, scheduledCount: 1 }],
    });
    const result = buildGrowDeliveryRecord({ ...input("scheduled"), capacityManifest: full });
    assert.ok(result.readiness.blockers.includes("no remaining publish slot"));
  });

  test("does not let published or measured status omit publish and outcome evidence", () => {
    assert.ok(buildGrowDeliveryRecord({ ...input("published"), publishRef: null }).readiness.blockers
      .includes("published delivery requires a publish reference and timestamp"));
    assert.ok(buildGrowDeliveryRecord({ ...input("measured"), outcomeRefs: [] }).readiness.blockers
      .includes("measured delivery requires outcome references"));
  });

  test("requires the candidate to be present in the explicit capacity roster", () => {
    const result = buildGrowDeliveryRecord({ ...input(), capacityCandidateIds: [] });
    assert.ok(result.readiness.blockers.includes("candidate is not in the capacity roster"));
  });

  test("does not collapse multi-variant lineage or float a publish ref", () => {
    const multiVariant = { ...review(), variantRefs: [
      { recordType: "variant", id: "variant-1", relation: null },
      { recordType: "variant", id: "variant-2", relation: null },
    ] };
    const multi = buildGrowDeliveryRecord({ ...input(), reviewBundle: multiVariant });
    assert.ok(multi.readiness.blockers.includes("variant id is required for a multi-variant review bundle"));

    const withoutPublishRefs = { ...review(), publishRefs: null };
    const published = buildGrowDeliveryRecord({ ...input("published"), reviewBundle: withoutPublishRefs });
    assert.ok(published.readiness.blockers.includes("publish reference is not declared by the review bundle"));
  });

  test("blocks a review lineage that cannot identify the source, cut, variant, and experiment", () => {
    const result = buildGrowDeliveryRecord({
      ...input(),
      reviewBundle: {
        ...review(),
        lineage: review().lineage?.filter((ref) => ref.recordType !== "experiment") ?? null,
      },
    });
    assert.ok(result.readiness.blockers.includes("experiment lineage is missing"));
  });
});
