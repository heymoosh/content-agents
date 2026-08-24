import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { normalizeGrowQueueFacts, normalizeGrowSchedulerFacts } from "./queue-facts.js";

const lineage = {
  sourceId: "source-1",
  cutId: "cut-1",
  variantId: "variant-1",
  experimentId: "experiment-1",
  publishId: "publish-1",
};

describe("Grow queue and scheduler facts", () => {
  test("maps explicit review-queue lifecycle statuses conservatively", () => {
    assert.equal(normalizeGrowQueueFacts({ artifactId: "artifact-1", status: "approve" }).status, "approved");
    assert.equal(normalizeGrowQueueFacts({ artifactId: "artifact-1", status: "approved" }).status, "approved");
    assert.equal(normalizeGrowQueueFacts({ artifactId: "artifact-1", status: "scheduled" }).status, "scheduled");
    assert.equal(normalizeGrowQueueFacts({ artifactId: "artifact-1", status: "published" }).status, "published");
    assert.equal(normalizeGrowQueueFacts({ artifactId: "artifact-1", status: "measured" }).status, "measured");
    assert.equal(normalizeGrowQueueFacts({ artifactId: "artifact-1", status: "blocked" }).status, "blocked");
    assert.equal(normalizeGrowQueueFacts({ artifactId: "artifact-1", status: "pending" }).status, "unknown");
    assert.equal(normalizeGrowQueueFacts({ artifactId: "artifact-1", status: "draft" }).status, "unknown");
    assert.equal(normalizeGrowQueueFacts({ artifactId: "artifact-1", status: "unknown" }).status, "unknown");
    assert.equal(normalizeGrowQueueFacts({ artifactId: "artifact-1" }).status, "unknown");
  });

  test("maps scheduler facts without turning pending or unknown into approval", () => {
    assert.equal(normalizeGrowSchedulerFacts({ deliveryId: "delivery-1", status: "approve" }).status, "unscheduled");
    assert.equal(normalizeGrowSchedulerFacts({ deliveryId: "delivery-1", status: "approved" }).status, "unscheduled");
    assert.equal(normalizeGrowSchedulerFacts({ deliveryId: "delivery-1", status: "scheduled" }).status, "scheduled");
    assert.equal(normalizeGrowSchedulerFacts({ deliveryId: "delivery-1", status: "published" }).status, "published");
    assert.equal(normalizeGrowSchedulerFacts({ deliveryId: "delivery-1", status: "measured" }).status, "measured");
    assert.equal(normalizeGrowSchedulerFacts({ deliveryId: "delivery-1", status: "blocked" }).status, "unknown");
    assert.equal(normalizeGrowSchedulerFacts({ deliveryId: "delivery-1", status: "blocked" }).readiness.status, "blocked");
  });

  test("preserves explicit IDs and complete lineage", () => {
    const queue = normalizeGrowQueueFacts({ artifactId: "artifact-explicit", status: "approved", lineage });
    const scheduler = normalizeGrowSchedulerFacts({ deliveryId: "delivery-explicit", status: "scheduled", lineage });
    assert.equal(queue.artifactId, "artifact-explicit");
    assert.equal(scheduler.deliveryId, "delivery-explicit");
    assert.deepEqual(queue.lineage, lineage);
    assert.deepEqual(scheduler.lineage, lineage);
    assert.deepEqual(queue.readiness, { status: "ready", blockers: [] });
    assert.equal(queue.sideEffects, "none");
    assert.equal(scheduler.sideEffects, "none");
  });

  test("reports missing or invalid identifiers and statuses", () => {
    const queue = normalizeGrowQueueFacts({ artifactId: " ", status: "bogus" });
    const scheduler = normalizeGrowSchedulerFacts({ deliveryId: "", status: "bogus" });
    assert.equal(queue.status, "unknown");
    assert.deepEqual(queue.readiness, {
      status: "blocked",
      blockers: ["artifact id is missing or invalid", "status is invalid or missing"],
    });
    assert.equal(scheduler.status, "unknown");
    assert.deepEqual(scheduler.readiness.blockers, ["delivery id is missing or invalid", "status is invalid or missing"]);
  });

  test("does not report workflow readiness without required lineage", () => {
    const queue = normalizeGrowQueueFacts({ artifactId: "artifact-1", status: "approved" });
    const published = normalizeGrowSchedulerFacts({ deliveryId: "delivery-1", status: "published", lineage: { sourceId: "s", cutId: "c", variantId: "v", experimentId: "e" } });
    assert.equal(queue.readiness.status, "blocked");
    assert.ok(queue.readiness.blockers.includes("lineage is missing"));
    assert.equal(published.readiness.status, "blocked");
    assert.ok(published.readiness.blockers.includes("lineage publishId is missing"));
  });

  test("is deterministic and has no side effects", () => {
    const input = { artifactId: "artifact-1", status: "approved", lineage };
    const first = normalizeGrowQueueFacts(input);
    const second = normalizeGrowQueueFacts(input);
    assert.deepEqual(first, second);
    assert.equal(first.sideEffects, "none");
    assert.deepEqual(input, { artifactId: "artifact-1", status: "approved", lineage });
  });
});
