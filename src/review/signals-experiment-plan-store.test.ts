import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildContentRequest } from "./content-request.js";
import { approveExperimentPlan, buildExperimentPlan } from "../grow/experiment-content-handoff.js";
import { signalsExperimentRecommendation } from "../grow/experiment-test-fixtures.js";
import { markExperimentContentHandoff, readExperimentPlans, recordExperimentPlan, reviewExperimentPlan } from "./signals-experiment-plan-store.js";

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
  });
}

describe("Signals experiment plan store", () => {
  test("persists concurrent plans and returns high confidence first without source or draft bodies", async () => {
    const root = await mkdtemp(join(tmpdir(), "signals-experiment-store-")); roots.push(root); const path = join(root, "plans.jsonl");
    recordExperimentPlan(proposal("medium", "medium"), path);
    recordExperimentPlan(proposal("high", "high"), path);
    recordExperimentPlan(proposal("low", "low"), path);
    const rows = readExperimentPlans(path);
    assert.deepEqual(rows.map((row) => row.contentRequestId), ["high", "medium", "low"]);
    assert.equal(rows[2]!.status, "deferred");
    assert.equal(JSON.stringify(rows).includes("Source."), false);
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
    assert.throws(() => reviewExperimentPlan(plan.recommendation.id, decision, path), /already reviewed/i);
  });
});
