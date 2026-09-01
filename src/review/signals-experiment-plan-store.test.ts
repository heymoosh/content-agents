import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildContentRequest } from "./content-request.js";
import { approveExperimentPlan, buildExperimentPlan } from "../grow/experiment-content-handoff.js";
import { signalsExperimentRecommendation } from "../grow/experiment-test-fixtures.js";
import { markExperimentContentHandoff, readExperimentPlans, recordExperimentPlan, reviewExperimentPlan } from "./signals-experiment-plan-store.js";
import * as planStoreSubject from "./signals-experiment-plan-store.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

function proposal(id: string, confidence: "low" | "medium" | "high" = "high") {
  const input = { id, origin: "human-inference" as const, descriptor: "experiment", originalInput: "Source.", treatments: ["summary"], media: ["none"], platforms: ["linkedin"], sourceProvenance: { kind: "source" as const, sourceLines: [1] } };
  const request = buildContentRequest(input);
  const variantId = request.variants.find((variant) => variant.identity.kind === "treated")!.identity.id;
  const comparisonRef = request.variants.find((variant) => variant.identity.kind === "control")!.identity.id;
  return buildExperimentPlan({
    recommendation: { ...signalsExperimentRecommendation({ variantId, comparisonRef, minimumSample: 10 }), id: `signals:${id}`, confidence },
    contentRequest: input,
    variablesByVariant: Object.fromEntries(request.variants.map((variant) => [variant.identity.id, { opening: variant.identity.kind }])),
    capacity: { availablePublishingUnits: 10, availableDays: 7 },
  });
}

describe("Signals experiment plan store", () => {
  test("binds a plan to the Content origin brand and leaves Studio legacy plans unassigned", async () => {
    const root = await mkdtemp(join(tmpdir(), "signals-experiment-brand-")); roots.push(root); const path = join(root, "plans.jsonl");
    const plan = proposal("brand-bound");
    assert.equal(plan.brandId, "human-inference");
    recordExperimentPlan(plan, path);
    const legacy = structuredClone(plan) as any;
    legacy.recommendation.id = "studio-legacy";
    legacy.contentRequest.id = "studio-legacy";
    legacy.contentRequest.origin = "studio";
    delete legacy.brandId;
    recordExperimentPlan(legacy, path);
    const rows = readExperimentPlans(path);
    assert.equal(rows.find((row) => row.contentRequestId === "brand-bound")?.brandId, "human-inference");
    assert.equal(rows.find((row) => row.contentRequestId === "studio-legacy")?.brandId, null);
    const decision = approveExperimentPlan(plan, { status: "approved", decidedBy: "muxin", decidedAt: "2026-08-31T18:00:00.000Z" });
    reviewExperimentPlan(plan.recommendation.id, decision, path);
    markExperimentContentHandoff(plan.recommendation.id, { experimentId: plan.recommendation.id, generatedIds: ["x"], copyApproval: "pending-in-content" }, path);
    assert.deepEqual((planStoreSubject as any).readExperimentPlansForPerformance(path).map((item: any) => item.recommendation.id), [plan.recommendation.id]);
  });
  test("persists concurrent plans and returns high confidence first without source or draft bodies", async () => {
    const root = await mkdtemp(join(tmpdir(), "signals-experiment-store-")); roots.push(root); const path = join(root, "plans.jsonl");
    recordExperimentPlan(proposal("medium", "medium"), path);
    recordExperimentPlan(proposal("high", "high"), path);
    recordExperimentPlan(proposal("low", "low"), path);
    const rows = readExperimentPlans(path);
    assert.deepEqual(rows.map((row) => row.contentRequestId), ["high", "medium", "low"]);
    assert.equal(rows[2]!.status, "deferred");
    assert.equal(JSON.stringify(rows).includes("Source."), false);
    assert.equal(rows[0]!.observation, proposal("high").recommendation.observation);
    assert.deepEqual(rows[0]!.evidenceRefs, proposal("high").recommendation.evidenceRefs);
    assert.equal(rows[0]!.interpretation, proposal("high").recommendation.interpretation);
    assert.equal(rows[0]!.whyThisInput, proposal("high").recommendation.whyThisInput);
    assert.deepEqual(rows[0]!.expectedOutcome, proposal("high").recommendation.expectedOutcome);
    assert.deepEqual(rows[0]!.constants, proposal("high").recommendation.constants);
    assert.deepEqual(rows[0]!.decisionRule, proposal("high").recommendation.decisionRule);
    assert.deepEqual(rows[0]!.caveats, proposal("high").recommendation.caveats);
    assert.equal(rows[0]!.capacityRationale, proposal("high").recommendation.capacityRationale);
  });

  test("records one Muxin plan decision and a separate pending-Content handoff", async () => {
    const root = await mkdtemp(join(tmpdir(), "signals-experiment-store-")); roots.push(root); const path = join(root, "plans.jsonl");
    const plan = proposal("high"); recordExperimentPlan(plan, path);
    const decision = approveExperimentPlan(plan, { status: "approved", decidedBy: "muxin", decidedAt: "2026-08-31T18:00:00.000Z" });
    reviewExperimentPlan(plan.recommendation.id, decision, path);
    markExperimentContentHandoff(plan.recommendation.id, { experimentId: plan.recommendation.id, generatedIds: ["control", "treated"], copyApproval: "pending-in-content" }, path);
    const row = readExperimentPlans(path)[0]!;
    assert.equal(row.status, "drafts-pending-content-review");
    assert.deepEqual(row.generatedIds, ["control", "treated"]);
    assert.equal(row.planDecision?.authorizesCopyApproval, false);
    assert.deepEqual((planStoreSubject as any).readExperimentPlansForPerformance(path).map((item: any) => item.recommendation.id), [plan.recommendation.id]);
    assert.throws(() => reviewExperimentPlan(plan.recommendation.id, decision, path), /already reviewed/i);
  });

  test("does not measure a proposal before its canonical Content handoff exists", async () => {
    const root = await mkdtemp(join(tmpdir(), "signals-experiment-store-")); roots.push(root); const path = join(root, "plans.jsonl");
    const plan = proposal("approved-only"); recordExperimentPlan(plan, path);
    const decision = approveExperimentPlan(plan, { status: "approved", decidedBy: "muxin", decidedAt: "2026-08-31T18:00:00.000Z" });
    reviewExperimentPlan(plan.recommendation.id, decision, path);
    assert.deepEqual((planStoreSubject as any).readExperimentPlansForPerformance(path), []);
  });

  test("retains Muxin's decline rationale", async () => {
    const root = await mkdtemp(join(tmpdir(), "signals-experiment-store-")); roots.push(root); const path = join(root, "plans.jsonl");
    const plan = proposal("declined"); recordExperimentPlan(plan, path);
    const decision = approveExperimentPlan(plan, { status: "declined", decidedBy: "muxin", decidedAt: "2026-08-31T18:00:00.000Z", rationale: "The learning is not worth this publishing window." });
    reviewExperimentPlan(plan.recommendation.id, decision, path);
    assert.equal(readExperimentPlans(path)[0]!.planDecision?.rationale, "The learning is not worth this publishing window.");
  });

  test("explains capacity deferral accurately for both new and legacy plans", async () => {
    const root = await mkdtemp(join(tmpdir(), "signals-experiment-store-")); roots.push(root); const path = join(root, "plans.jsonl");
    const insufficient = { ...structuredClone(proposal("insufficient")), capacity: { availablePublishingUnits: 2, availableDays: 3, sufficient: false } };
    recordExperimentPlan(insufficient, path);
    const legacy = structuredClone(proposal("legacy")) as any;
    delete legacy.capacity;
    recordExperimentPlan(legacy, path);
    const rows = readExperimentPlans(path);
    assert.match(rows.find((row) => row.contentRequestId === "insufficient")!.priorityReason, /declared publishing capacity is insufficient/i);
    assert.match(rows.find((row) => row.contentRequestId === "legacy")!.priorityReason, /legacy plan has no declared publishing capacity/i);
  });
});
