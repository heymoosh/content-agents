import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildOperatorReadiness } from "./operator-readiness.js";
import type { ComparisonReadinessInventory } from "./comparison-readiness.js";

const inventory: ComparisonReadinessInventory = {
  kind: "comparison_readiness_inventory", version: "comparison-readiness-v1", sideEffects: "none",
  rows: [
    { kind: "comparison_readiness_row", version: "comparison-readiness-v1", id: "b", evidenceId: "b", accountId: "b", sourceId: "s2", postId: "p2", platform: "x", medium: "video", format: "short", pool: "broad", topics: ["general"], focus: ["news"], nicheLabel: "unknown", popularityScope: "broad", sampleScope: "top", baselineScope: "baseline", baselineSource: "b", evidenceLinks: [], caveats: ["missing metric"], bodyIncluded: false, readiness: { status: "blocked", blockers: ["metric snapshot is incomplete", "pool membership is missing"] } },
    { kind: "comparison_readiness_row", version: "comparison-readiness-v1", id: "a", evidenceId: "a", accountId: "a", sourceId: "s1", postId: "p1", platform: "linkedin", medium: "text", format: "short post", pool: "niche", topics: ["civic technology"], focus: ["inference"], nicheLabel: "civic technology", popularityScope: "niche", sampleScope: "top", baselineScope: "baseline", baselineSource: "b", evidenceLinks: ["e"], caveats: [], bodyIncluded: false, readiness: { status: "ready", blockers: [] } },
  ], summary: { ready: 1, blocked: 1, duplicateEvidence: 0 },
};

describe("operator readiness", () => {
  test("summarizes coverage by pool, platform, medium, and format deterministically", () => {
    const result = buildOperatorReadiness(inventory);
    assert.deepEqual(result.summary, { total: 2, ready: 1, blocked: 1, readinessRate: 0.5 });
    assert.deepEqual(result.byPool.niche, { total: 1, ready: 1, blocked: 0 });
    assert.deepEqual(result.byPool.broad, { total: 1, ready: 0, blocked: 1 });
    assert.deepEqual(result.byPlatform, { linkedin: { total: 1, ready: 1, blocked: 0 }, x: { total: 1, ready: 0, blocked: 1 } });
    assert.deepEqual(result.gaps, ["metric snapshot is incomplete", "pool membership is missing"]);
  });

  test("keeps body/copy out of the operator view and never promotes a winner", () => {
    const result = buildOperatorReadiness(inventory);
    assert.equal(Object.hasOwn(result, "winner"), false);
    assert.equal(JSON.stringify(result).includes("creator body"), false);
    assert.equal(result.sideEffects, "none");
  });
});
