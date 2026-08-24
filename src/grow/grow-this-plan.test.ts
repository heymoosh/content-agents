import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildGrowThisPlan,
  type GrowThisPlanInput,
} from "./grow-this-plan.js";
import type { GrowDeliveryRecord } from "./delivery-record.js";
import type { ExperimentOutcomeLedger } from "./experiment-outcomes.js";
import type { ExperimentRecord } from "./experiment-record.js";

const source = { recordType: "source", id: "source-1", relation: "origin" };
const cut = { recordType: "cut", id: "cut-1", relation: "selected" };
const variant = { recordType: "variant", id: "variant-1", relation: "formatted" };
const deliveryRecord = {
  id: "delivery-1",
  reviewBundleId: "review-1",
  readiness: { status: "ready", blockers: [] },
} as unknown as GrowDeliveryRecord;
const experimentRecord = {
  id: "experiment-1",
  status: "running",
  lineage: { sourceRefs: ["source-1"], variantRefs: ["variant-1"] },
} as ExperimentRecord;
const outcomeLedger = {
  experimentId: "experiment-1",
  readiness: { status: "ready", blockers: [] },
} as unknown as ExperimentOutcomeLedger;

function input(overrides: Partial<GrowThisPlanInput> = {}): GrowThisPlanInput {
  return {
    id: "grow-this-1",
    sourceRef: source,
    cutRef: cut,
    variantRefs: [variant],
    sourceStatus: "ready",
    cutStatus: "ready",
    cutDecision: { status: "approved", decidedBy: "muxin", decidedAt: "2026-08-23T11:00:00Z" },
    reviewBundle: {
      id: "review-1",
      sourceRef: source,
      cutRef: cut,
      variantRefs: [variant],
      publishRefs: [{ recordType: "publish", id: "publish-1", relation: "delivery" }],
      lineage: [source, cut, variant, { recordType: "experiment", id: "experiment-1", relation: null }],
      evidenceStatus: "supported",
      evidenceRefs: ["evidence-1"],
      evidenceNote: null,
      voiceCheck: "passed",
      originalityCheck: "passed",
      readiness: { status: "ready", blockingFields: [], reason: "ready" },
      humanDecision: { status: "approved", decidedBy: "muxin", decidedAt: "2026-08-23T12:00:00Z", note: null },
      status: "approved",
      kind: "grow_review_bundle",
      version: "grow-review-bundle-v1",
      generatesCopy: false,
      sideEffects: "none",
    } as GrowThisPlanInput["reviewBundle"],
    deliveryRef: { recordType: "delivery", id: "delivery-1", relation: "approved" },
    delivery: deliveryRecord,
    experimentRef: { recordType: "experiment", id: "experiment-1", relation: "test" },
    experiment: experimentRecord,
    outcomeRef: { recordType: "outcome", id: "outcome-1", relation: "measurement" },
    outcomeLedger,
    evidenceRefs: ["evidence-1", "outcome-evidence-1"],
    ...overrides,
  };
}

describe("Grow-this plan projection", () => {
  test("joins the lifecycle references and keeps the projection side-effect free", () => {
    const result = buildGrowThisPlan(input());

    assert.equal(result.version, "grow-this-plan-v1");
    assert.equal(result.readiness.status, "ready");
    assert.deepEqual(result.lifecycle.map((stage) => stage.stage), [
      "source", "cut", "variant", "review", "delivery", "experiment", "outcome",
    ]);
    assert.deepEqual(result.lifecycle.find((stage) => stage.stage === "source")?.refs, ["source-1"]);
    assert.deepEqual(result.lifecycle.find((stage) => stage.stage === "variant")?.refs, ["variant-1"]);
    assert.equal(result.gates.cut.status, "approved");
    assert.equal(result.gates.review.status, "approved");
    assert.equal(result.winner, null);
    assert.equal(result.autoWinner, false);
    assert.equal(result.generatesCopy, false);
    assert.equal(result.sideEffects, "none");
    assert.equal("body" in result, false);
  });

  test("reports human-review and missing-evidence blockers without inferring progress", () => {
    const result = buildGrowThisPlan(input({
      reviewBundle: {
        ...input().reviewBundle,
        status: "candidate",
        humanDecision: { status: "candidate", decidedBy: null, decidedAt: null, note: null },
        evidenceStatus: "blocked",
        evidenceRefs: [],
        readiness: { status: "blocked", blockingFields: ["humanReview", "evidenceRefs"], reason: "needs review" },
      },
      evidenceRefs: [],
    }));

    assert.equal(result.readiness.status, "blocked");
    assert.ok(result.readiness.blockers.includes("human review is pending"));
    assert.ok(result.readiness.blockers.includes("evidence is missing"));
    assert.equal(result.gates.review.status, "pending");
    assert.equal(result.gates.review.required, true);
    assert.equal(result.lifecycle.find((stage) => stage.stage === "outcome")?.status, "blocked");
    assert.equal(result.winner, null);
  });

  test("does not approve source or cut stages from references alone", () => {
    const result = buildGrowThisPlan(input({ sourceStatus: undefined, cutStatus: undefined, cutDecision: null }));
    assert.equal(result.gates.cut.status, "pending");
    assert.equal(result.lifecycle.find((stage) => stage.stage === "source")?.status, "pending");
    assert.equal(result.lifecycle.find((stage) => stage.stage === "cut")?.status, "pending");
    assert.ok(result.readiness.blockers.includes("source record is not marked ready"));
    assert.ok(result.readiness.blockers.includes("cut record is not marked ready"));
  });
});
