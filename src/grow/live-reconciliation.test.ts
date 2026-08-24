import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { QueueRow } from "../publish/queue.js";
import type { Claim } from "../publish/slots.js";
import {
  GROW_LIVE_FACTS_VERSION,
  composeGrowLiveFacts,
} from "./live-reconciliation.js";

const queueLineage = {
  sourceId: "source-1",
  cutId: "cut-1",
  variantId: "variant-1",
  experimentId: "experiment-1",
  publishId: null,
};

const schedulerLineage = {
  ...queueLineage,
};

function queueRow(overrides: Partial<QueueRow> = {}): QueueRow {
  return {
    id: "artifact-1",
    platform: "x",
    format: "text",
    asset: "derivatives/x-1.md",
    status: "approve",
    notes: "",
    lineIndex: 0,
    ...overrides,
  };
}

function schedulerClaim(overrides: Partial<Claim> = {}): Claim {
  return {
    platform: "x",
    day: "2026-08-25",
    time: "2026-08-25T16:00:00.000Z",
    asset: "content-slug/x",
    by: "typefully",
    ...overrides,
  };
}

describe("Grow live reconciliation facts", () => {
  test("composes complete queue and scheduler facts without adding lifecycle meaning", () => {
    const result = composeGrowLiveFacts({
      queueRow: queueRow(),
      queueLineage,
      schedulerClaim: schedulerClaim(),
      schedulerObservation: {
        deliveryId: "delivery-1",
        status: "scheduled",
        lineage: schedulerLineage,
      },
    });

    assert.deepEqual(result, {
      kind: "grow_live_facts",
      version: GROW_LIVE_FACTS_VERSION,
      queue: {
        artifactId: "artifact-1",
        status: "approved",
        lineage: queueLineage,
        readiness: { status: "ready", blockers: [] },
        sideEffects: "none",
      },
      scheduler: {
        deliveryId: "delivery-1",
        status: "scheduled",
        lineage: schedulerLineage,
        readiness: { status: "ready", blockers: [] },
        sideEffects: "none",
      },
      readiness: { status: "ready", blockers: [] },
      sideEffects: "none",
    });
  });

  test("keeps missing queue and claim visible and conservative", () => {
    const result = composeGrowLiveFacts({
      queueRow: null,
      schedulerClaim: null,
      schedulerObservation: {
        deliveryId: "delivery-1",
        status: "scheduled",
        lineage: schedulerLineage,
      },
    });

    assert.equal(result.queue, null);
    assert.equal(result.scheduler.status, "unknown");
    assert.equal(result.readiness.status, "blocked");
    assert.ok(result.readiness.blockers.includes("review queue row is missing"));
    assert.ok(result.readiness.blockers.includes("scheduler claim is missing"));
    assert.equal(result.sideEffects, "none");
  });

  test("reports conflicting explicit lineage without choosing a winner", () => {
    const conflictingSchedulerLineage = {
      ...schedulerLineage,
      sourceId: "source-2",
    };
    const result = composeGrowLiveFacts({
      queueRow: queueRow(),
      queueLineage,
      schedulerClaim: schedulerClaim(),
      schedulerObservation: {
        deliveryId: "delivery-1",
        status: "scheduled",
        lineage: conflictingSchedulerLineage,
      },
    });

    assert.equal(result.queue?.lineage?.sourceId, "source-1");
    assert.equal(result.scheduler.lineage?.sourceId, "source-2");
    assert.equal(result.readiness.status, "blocked");
    assert.ok(result.readiness.blockers.includes("queue and scheduler lineage conflict at sourceId"));
    assert.equal(result.sideEffects, "none");
  });

  test("does not mutate queue, claim, or observation inputs", () => {
    const row = queueRow();
    const claim = schedulerClaim();
    const observation = {
      deliveryId: "delivery-1",
      status: "scheduled",
      lineage: { ...schedulerLineage },
    };
    const before = structuredClone({ row, claim, observation, queueLineage });

    composeGrowLiveFacts({
      queueRow: row,
      queueLineage,
      schedulerClaim: claim,
      schedulerObservation: observation,
    });

    assert.deepEqual({ row, claim, observation, queueLineage }, before);
  });
});
