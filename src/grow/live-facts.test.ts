import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { QueueRow } from "../publish/queue.js";
import type { Claim } from "../publish/slots.js";
import { adaptQueueRowToGrowFacts, adaptSchedulerClaimToGrowFacts } from "./live-facts.js";

const lineage = {
  sourceId: "source-1",
  cutId: "cut-1",
  variantId: "variant-1",
  experimentId: "experiment-1",
  publishId: "publish-1",
};

function queueRow(overrides: Partial<QueueRow> = {}): QueueRow {
  return {
    id: "artifact-1",
    platform: "x",
    format: "text",
    asset: "derivatives/x-1.md",
    status: "approved",
    notes: "",
    lineIndex: 0,
    ...overrides,
  };
}

function claim(overrides: Partial<Claim> = {}): Claim {
  return {
    platform: "x",
    day: "2026-08-24",
    time: "2026-08-24T16:00:00.000Z",
    asset: "artifact-1",
    by: "muxin",
    ...overrides,
  };
}

describe("live Grow facts adapters", () => {
  test("adapts approved, pending, and unknown queue rows without upgrading pending", () => {
    const approved = adaptQueueRowToGrowFacts(queueRow({ id: "approved-1", status: "approved" }), lineage);
    const pending = adaptQueueRowToGrowFacts(queueRow({ id: "pending-1", status: "pending" }), lineage);
    const unknown = adaptQueueRowToGrowFacts(queueRow({ id: "unknown-1", status: "unknown" }), lineage);

    assert.equal(approved.artifactId, "approved-1");
    assert.equal(approved.status, "approved");
    assert.equal(approved.readiness.status, "ready");
    assert.equal(pending.status, "unknown");
    assert.equal(pending.readiness.status, "blocked");
    assert.ok(pending.readiness.blockers.includes("status is pending"));
    assert.equal(unknown.status, "unknown");
    assert.equal(unknown.readiness.status, "blocked");
    assert.ok(unknown.readiness.blockers.includes("status is unknown"));
  });

  test("uses a present scheduler claim as evidence without inferring status or lineage", () => {
    const facts = adaptSchedulerClaimToGrowFacts(claim(), {
      deliveryId: "delivery-1",
      status: "scheduled",
      lineage,
    });

    assert.equal(facts.deliveryId, "delivery-1");
    assert.equal(facts.status, "scheduled");
    assert.deepEqual(facts.lineage, lineage);
    assert.deepEqual(facts.readiness, { status: "ready", blockers: [] });
    assert.equal(facts.sideEffects, "none");
  });

  test("does not infer missing lineage from a scheduler claim", () => {
    const facts = adaptSchedulerClaimToGrowFacts(claim(), {
      deliveryId: "delivery-1",
      status: "scheduled",
    });

    assert.equal(facts.status, "scheduled");
    assert.equal(facts.lineage, null);
    assert.equal(facts.readiness.status, "blocked");
    assert.ok(facts.readiness.blockers.includes("lineage is missing"));
  });

  test("makes a missing scheduler claim conservative and visible", () => {
    const facts = adaptSchedulerClaimToGrowFacts(null, {
      deliveryId: "delivery-1",
      status: "scheduled",
      lineage,
    });

    assert.equal(facts.status, "unknown");
    assert.equal(facts.readiness.status, "blocked");
    assert.ok(facts.readiness.blockers.includes("scheduler claim is missing"));
    assert.deepEqual(facts.lineage, lineage);
  });

  test("makes a missing scheduler status conservative and visible", () => {
    const facts = adaptSchedulerClaimToGrowFacts(claim(), {
      deliveryId: "delivery-1",
      lineage,
    });

    assert.equal(facts.status, "unknown");
    assert.equal(facts.readiness.status, "blocked");
    assert.ok(facts.readiness.blockers.includes("scheduler status is missing"));
  });

  test("reports missing identifiers through the existing normalizers", () => {
    const queue = adaptQueueRowToGrowFacts(queueRow({ id: "", status: "approved" }), lineage);
    const scheduler = adaptSchedulerClaimToGrowFacts(claim(), {
      deliveryId: " ",
      status: "scheduled",
      lineage,
    });

    assert.equal(queue.artifactId, null);
    assert.ok(queue.readiness.blockers.includes("artifact id is missing or invalid"));
    assert.equal(scheduler.deliveryId, null);
    assert.ok(scheduler.readiness.blockers.includes("delivery id is missing or invalid"));
  });

  test("preserves caller lineage and does not mutate source facts", () => {
    const row = queueRow({ status: "approved" });
    const schedulerInput = { deliveryId: "delivery-1", status: "scheduled", lineage: { ...lineage } };
    const rowBefore = structuredClone(row);
    const schedulerBefore = structuredClone(schedulerInput);

    const queueFacts = adaptQueueRowToGrowFacts(row, schedulerInput.lineage);
    const schedulerFacts = adaptSchedulerClaimToGrowFacts(claim(), schedulerInput);

    assert.deepEqual(queueFacts.lineage, lineage);
    assert.deepEqual(schedulerFacts.lineage, lineage);
    assert.deepEqual(row, rowBefore);
    assert.deepEqual(schedulerInput, schedulerBefore);
    assert.equal(queueFacts.sideEffects, "none");
    assert.equal(schedulerFacts.sideEffects, "none");
  });
});
