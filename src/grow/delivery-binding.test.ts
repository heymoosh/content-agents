import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildGrowCapacityManifest } from "./capacity.js";
import { buildGrowReviewBundle } from "./review-bundle.js";
import {
  buildGrowDeliveryBinding,
  GROW_DELIVERY_BINDING_VERSION,
  type GrowDeliveryBindingInput,
  type GrowDeliveryBindingLineage,
  type GrowDeliveryBindingProviderFacts,
} from "./delivery-binding.js";

const lineage: GrowDeliveryBindingLineage = {
  sourceId: "source-1",
  cutId: "cut-1",
  variantId: "variant-1",
  treatmentId: "treatment-1",
  experimentId: "experiment-1",
};

const review = buildGrowReviewBundle({
  id: "review-1",
  sourceRef: { recordType: "source", id: "source-1" },
  cutRef: { recordType: "cut", id: "cut-1" },
  variantRefs: [{ recordType: "variant", id: "variant-1" }],
  publishRefs: [{ recordType: "publish", id: "publish-1" }],
  lineage: [
    { recordType: "experiment", id: "experiment-1" },
    { recordType: "treatment", id: "treatment-1" },
    { recordType: "variant", id: "variant-1" },
    { recordType: "cut", id: "cut-1" },
    { recordType: "source", id: "source-1" },
  ],
  evidence: { status: "supported", refs: ["evidence-1"] },
  voiceCheck: "passed",
  originalityCheck: "passed",
  readiness: { status: "ready", blockingFields: [], reason: "ready" },
  humanDecision: { status: "approved", decidedBy: "muxin", decidedAt: "2026-08-24T12:00:00Z" },
});

const capacity = buildGrowCapacityManifest({
  days: ["2026-08-25"],
  platforms: ["linkedin"],
  candidates: [{ id: "candidate-1", day: "2026-08-25", platform: "linkedin", status: "approved" }],
  slotCapacity: [{ day: "2026-08-25", platform: "linkedin", capacity: 2, scheduledCount: 0 }],
});

const capacitySlice = capacity.slices[0]!;
const deliveryId = "delivery:review-1:candidate-1";

function queue(status: "approved" | "scheduled" | "published" = "approved") {
  return {
    artifactId: "candidate-1",
    status,
    lineage: { ...lineage, publishId: "publish-1" },
    readiness: { status: "ready" as const, blockers: [] },
    sideEffects: "none" as const,
  };
}

function scheduler(status: "unscheduled" | "scheduled" | "published" = "unscheduled") {
  return {
    deliveryId,
    status,
    lineage: { ...lineage, publishId: "publish-1" },
    readiness: { status: "ready" as const, blockers: [] },
    sideEffects: "none" as const,
  };
}

function provider(
  liveStatus: "not_confirmed" | "confirmed" = "not_confirmed",
): GrowDeliveryBindingProviderFacts {
  return {
    provider: "typefully",
    reference: "provider-1",
    scheduledAt: "2026-08-25T15:00:00Z",
    liveCheck: {
      status: liveStatus,
      checkedAt: "2026-08-25T15:05:00Z",
      liveAt: liveStatus === "confirmed" ? "2026-08-25T15:01:00Z" : null,
    },
  };
}

function input(overrides: Partial<GrowDeliveryBindingInput> = {}): GrowDeliveryBindingInput {
  return {
    reviewBundle: review,
    candidate: {
      id: "candidate-1",
      day: "2026-08-25",
      platform: "linkedin",
      variantId: "variant-1",
      lineage: { ...lineage },
    },
    capacitySlice,
    queueFacts: queue(),
    schedulerFacts: scheduler(),
    providerFacts: null,
    deliveryMode: "provider",
    ...overrides,
  };
}

describe("grow delivery binding", () => {
  test("builds an approved, not-scheduled body-free binding", () => {
    const result = buildGrowDeliveryBinding(input());

    assert.equal(result.kind, "grow_delivery_binding");
    assert.equal(result.version, GROW_DELIVERY_BINDING_VERSION);
    assert.equal(result.status, "approved");
    assert.deepEqual(result.readiness, { status: "ready", blockers: [] });
    assert.deepEqual(result.lineage, lineage);
    assert.equal(result.bodyFree, true);
    assert.equal(result.generatesCopy, false);
    assert.equal(result.creatorBodyCopyAllowed, false);
    assert.equal(result.humanApprovalRequired, true);
    assert.equal(result.autoApproval, false);
    assert.equal(result.autoScheduling, false);
    assert.equal(result.autoPublishing, false);
    assert.equal(result.sideEffects, "none");
    assert.equal(Object.hasOwn(result, "body"), false);
    assert.equal(Object.hasOwn(result, "content"), false);
  });

  test("requires both queue and scheduler evidence for scheduled state", () => {
    const scheduled = buildGrowDeliveryBinding({
      ...input(),
      queueFacts: queue("scheduled"),
      schedulerFacts: scheduler("scheduled"),
      providerFacts: provider(),
    });

    assert.equal(scheduled.status, "scheduled");
    assert.deepEqual(scheduled.readiness, { status: "ready", blockers: [] });

    const queueOnly = buildGrowDeliveryBinding({
      ...input(),
      queueFacts: queue("scheduled"),
      providerFacts: provider(),
    });
    assert.equal(queueOnly.status, "blocked");
    assert.ok(queueOnly.readiness.blockers.some((blocker) => /scheduler|manual delivery/i.test(blocker)));
  });

  test("requires explicit provider live evidence for live_confirmed", () => {
    const live = buildGrowDeliveryBinding({
      ...input(),
      queueFacts: queue("published"),
      schedulerFacts: scheduler("published"),
      providerFacts: provider("confirmed"),
    });

    assert.equal(live.status, "live_confirmed");
    assert.deepEqual(live.readiness, { status: "ready", blockers: [] });

    const missingCheck = buildGrowDeliveryBinding({
      ...input(),
      queueFacts: queue("scheduled"),
      schedulerFacts: scheduler("scheduled"),
      providerFacts: { ...provider(), liveCheck: null },
    });
    assert.equal(missingCheck.status, "blocked");
    assert.ok(missingCheck.readiness.blockers.includes("live check is unavailable"));
  });

  test("keeps every safety and reconciliation blocker explicit", () => {
    const duplicateLineageReview = {
      ...review,
      lineage: [...(review.lineage ?? []), { recordType: "treatment", id: "treatment-1", relation: null }],
    };
    const result = buildGrowDeliveryBinding({
      ...input(),
      reviewBundle: { ...duplicateLineageReview, status: "candidate", humanDecision: { status: "candidate", decidedBy: null, decidedAt: null, note: null } },
      capacitySlice: null,
      queueFacts: { ...queue("scheduled"), artifactId: "other-candidate" },
      schedulerFacts: { ...scheduler("scheduled"), deliveryId: "other-delivery" },
      providerFacts: { ...provider(), reference: null, liveCheck: null },
      deliveryMode: "manual",
    });

    assert.equal(result.readiness.status, "blocked");
    assert.ok(result.readiness.blockers.includes("review bundle is not approved by Muxin"));
    assert.ok(result.readiness.blockers.includes("duplicate treatment lineage"));
    assert.ok(result.readiness.blockers.includes("capacity slot is missing"));
    assert.ok(result.readiness.blockers.includes("provider reference is missing"));
    assert.ok(result.readiness.blockers.includes("live check is unavailable"));
    assert.ok(result.readiness.blockers.includes("manual delivery is ambiguous"));
    assert.equal(result.reconciliation.status, "drifted");
    assert.equal(result.reconciliation.sideEffects, "none");
  });

  test("reports missing lineage and does not infer lifecycle from labels", () => {
    const result = buildGrowDeliveryBinding({
      ...input(),
      candidate: { ...input().candidate, lineage: { ...lineage, treatmentId: "" } },
      queueFacts: { ...queue("scheduled"), lineage: null },
      schedulerFacts: { ...scheduler("scheduled"), lineage: null },
      providerFacts: provider(),
    });

    assert.equal(result.status, "blocked");
    assert.ok(result.readiness.blockers.includes("candidate treatment lineage is missing"));
    assert.ok(result.readiness.blockers.includes("queue lineage is missing"));
    assert.ok(result.readiness.blockers.includes("scheduler lineage is missing"));
    assert.ok(result.readiness.blockers.includes("queue and scheduler state do not agree"));
  });

  test("rechecks review evidence and quality gates instead of trusting readiness", () => {
    const result = buildGrowDeliveryBinding({
      ...input(),
      reviewBundle: {
        ...review,
        evidenceStatus: "insufficient",
        evidenceRefs: [],
        voiceCheck: "failed",
        originalityCheck: "failed",
        readiness: { status: "ready", blockingFields: [], reason: "forged ready flag" },
      },
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.checks.review, "blocked");
    assert.ok(result.readiness.blockers.includes("review bundle evidence is not supported"));
    assert.ok(result.readiness.blockers.includes("voice check is not passed"));
    assert.ok(result.readiness.blockers.includes("originality check is not passed"));
  });

  test("rejects blank evidence references in direct library input", () => {
    const result = buildGrowDeliveryBinding({
      ...input(),
      reviewBundle: {
        ...review,
        evidenceRefs: ["", "  "],
        readiness: { status: "ready", blockingFields: [], reason: "forged ready flag" },
      },
    });

    assert.equal(result.status, "blocked");
    assert.ok(result.readiness.blockers.includes("review bundle evidence is not supported"));
  });

  test("orders output deterministically and never mutates supplied facts", () => {
    const firstInput = input({
      reviewBundle: {
        ...review,
        lineage: [
          ...(review.lineage ?? []).slice().reverse(),
        ],
      },
    });
    const secondInput = input();
    const firstBefore = structuredClone(firstInput);
    const secondBefore = structuredClone(secondInput);

    const first = buildGrowDeliveryBinding(firstInput);
    const second = buildGrowDeliveryBinding(secondInput);

    assert.deepEqual(first, second);
    assert.deepEqual(firstInput, firstBefore);
    assert.deepEqual(secondInput, secondBefore);
  });
});
