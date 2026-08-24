import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlatformPoolMatrixRepoReport } from "./platform-pool-matrix-repo.js";
import type { PatternCatalog } from "./catalog.js";

function catalogRow(overrides: Partial<PatternCatalog["rows"][number]> = {}): PatternCatalog["rows"][number] {
  return {
    key: "x|alpha", accountId: "x|alpha", accountIdStatus: "derived", platform: "x", handle: "@alpha",
    creator: "Alpha", niche: "civic", sourceKind: "handle", configured: true, collected: true,
    audience: { size: null, countType: null, provenance: null, asOf: null }, topics: ["civic"], focus: ["systems"],
    researchPools: ["niche"], formats: ["short post"], mediaForms: ["text"], popularityScopes: [],
    sampleScopes: [], baselineSources: [], evidenceCount: 1, admissibleCount: 1, bodyCompleteCount: 0,
    bodyIncompleteCount: 0, lastCollectedAt: null, lastAnalyzedAt: null, caveats: [], ...overrides,
  };
}

function catalog(rows: PatternCatalog["rows"]): PatternCatalog {
  return {
    rows,
    summary: { configuredTargets: rows.length, collectedSources: 0, configuredAndCollected: 0, configuredButUncollected: 0, evidenceCount: 0, admissibleCount: 0, bodyCompleteCount: 0, bodyIncompleteCount: 0 },
  };
}

test("joins explicit catalog, review, and baseline facts without exposing bodies or winners", () => {
  const report = buildPlatformPoolMatrixRepoReport(catalog([catalogRow()]), {
    reviews: [{ currentAccountKey: "x|alpha", reviewStatus: "reviewed" }],
    baselines: ["x|alpha"],
  });

  assert.equal(report.targets.length, 1);
  assert.deepEqual(report.targets[0], {
    id: "x|alpha",
    platform: "x",
    researchPool: "niche",
    medium: "text",
    format: "short post",
    configured: true,
    collected: true,
    reviewStatus: "reviewed",
    baselineReady: true,
    blockers: [],
  });
  assert.deepEqual(report.blockedTargets, []);
  assert.equal(report.bodyIncluded, false);
  assert.equal(report.sideEffects, "none");
  assert.doesNotMatch(JSON.stringify(report), /"body":/);
  assert.equal(JSON.stringify(report).includes("winner"), false);
});

test("keeps missing labels and unassigned pools visible as explicit blocked facts", () => {
  const report = buildPlatformPoolMatrixRepoReport(catalog([
    catalogRow({ key: "linkedin|beta", accountId: "linkedin|beta", platform: "linkedin", handle: "@beta", researchPools: [], mediaForms: [], formats: [], configured: false, collected: false }),
    catalogRow({ key: "x|gamma", accountId: "x|gamma", handle: "@gamma", researchPools: ["not-a-pool"], mediaForms: ["video"], formats: ["short video"] }),
  ]));

  assert.deepEqual(report.targets, []);
  assert.deepEqual(report.blockedTargets, [
    { id: "linkedin|beta", platform: "linkedin", researchPools: [], blockers: ["research pool label absent"] },
    { id: "x|gamma", platform: "x", researchPools: ["not-a-pool"], blockers: ["research pool is not a recognized matrix pool"] },
  ]);
});

test("fails closed on malformed review and baseline maps", () => {
  const one = catalog([catalogRow()]);
  assert.throws(() => buildPlatformPoolMatrixRepoReport(one, { reviews: [{ currentAccountKey: "x|alpha", reviewStatus: "invented" } as never] }), /review status/);
  assert.throws(() => buildPlatformPoolMatrixRepoReport(one, { reviews: new Map([["", "reviewed"]]) }), /review/);
  assert.throws(() => buildPlatformPoolMatrixRepoReport(one, { baselines: [""] }), /baseline/);
  assert.throws(() => buildPlatformPoolMatrixRepoReport(one, { baselines: new Map([["x|alpha", null]]) }), /baseline/);
});

test("preserves pending and unmapped review states instead of collapsing them", () => {
  const report = buildPlatformPoolMatrixRepoReport(catalog([
    catalogRow({ key: "x|pending", accountId: "x|pending" }),
    catalogRow({ key: "x|unmapped", accountId: "x|unmapped" }),
  ]), { reviews: [
    { currentAccountKey: "x|pending", reviewStatus: "pending" },
    { currentAccountKey: "x|unmapped", reviewStatus: "unmapped" },
  ] });
  assert.deepEqual(report.targets.map((row) => [row.id, row.reviewStatus]), [["x|pending", "pending"], ["x|unmapped", "unmapped"]]);
  assert.equal(report.summary.pending, 1);
  assert.equal(report.summary.unmapped, 1);
});

test("does not cross-product independent medium and format labels", () => {
  const report = buildPlatformPoolMatrixRepoReport(catalog([catalogRow({
    researchPools: ["niche", "broad"],
    mediaForms: ["text", "video"],
    formats: ["short post", "long post"],
  })]));
  assert.equal(report.targets.length, 2);
  assert.deepEqual(report.targets.map((row) => [row.researchPool, row.medium, row.format]), [["broad", null, null], ["niche", null, null]]);
  assert.ok(report.targets.every((row) => row.blockers.includes("multiple medium labels lack explicit tuple provenance")));
  assert.ok(report.targets.every((row) => row.blockers.includes("multiple format labels lack explicit tuple provenance")));
});
