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
    reviews: [{
      currentAccountKey: "x|alpha",
      reviewStatus: "reviewed",
      reviewedPoolMembership: [{ pool: "broad", reason: "reviewed broad-platform example" }],
      medium: "video",
      format: "short video",
    }],
    baselines: ["x|alpha"],
  });

  assert.equal(report.targets.length, 1);
  assert.deepEqual(report.targets[0], {
    id: "x|alpha",
    platform: "x",
    researchPool: "broad",
    medium: "video",
    format: "short video",
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
    { id: "linkedin|beta", platform: "linkedin", researchPools: [], blockers: ["review metadata is missing"] },
    { id: "x|gamma", platform: "x", researchPools: ["not-a-pool"], blockers: ["review metadata is missing"] },
  ]);
});

test("never promotes catalog pool, medium, or format labels without explicit review metadata", () => {
  const report = buildPlatformPoolMatrixRepoReport(catalog([catalogRow({ researchPools: ["niche"], mediaForms: ["text"], formats: ["short post"] })]), {
    reviews: [{ currentAccountKey: "x|alpha", reviewStatus: "reviewed", reviewedPoolMembership: null, medium: null, format: null }],
    baselines: ["x|alpha"],
  });
  assert.equal(report.targets.length, 0);
  assert.deepEqual(report.blockedTargets[0]?.blockers, ["reviewed research pool membership absent"]);
});

test("normalizes explicit reviewed pool and treatment labels before joining", () => {
  const report = buildPlatformPoolMatrixRepoReport(catalog([catalogRow()]), {
    reviews: [{
      currentAccountKey: "x|alpha",
      reviewStatus: "reviewed",
      reviewedPoolMembership: [{ pool: " NICHE " as "niche", reason: " explicit niche " }],
      medium: " video ",
      format: " short video ",
    }],
  });
  assert.deepEqual(
    report.targets[0] && [report.targets[0].researchPool, report.targets[0].medium, report.targets[0].format],
    ["niche", "video", "short video"],
  );
  assert.deepEqual(report.targets[0]?.blockers, ["baseline not measured"]);
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
    { currentAccountKey: "x|pending", reviewStatus: "pending", reviewedPoolMembership: [{ pool: "niche", reason: "pending fixture" }], medium: "text", format: "short post" },
    { currentAccountKey: "x|unmapped", reviewStatus: "unmapped", reviewedPoolMembership: [{ pool: "niche", reason: "unmapped fixture" }], medium: "text", format: "short post" },
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
  })]), {
    reviews: [{
      currentAccountKey: "x|alpha",
      reviewStatus: "reviewed",
      reviewedPoolMembership: [
        { pool: "niche", reason: "explicit niche" },
        { pool: "broad", reason: "explicit broad" },
      ],
      medium: "video",
      format: "short video",
    }],
  });
  assert.equal(report.targets.length, 2);
  assert.deepEqual(report.targets.map((row) => [row.researchPool, row.medium, row.format]), [["broad", "video", "short video"], ["niche", "video", "short video"]]);
  assert.ok(report.targets.every((row) => !row.blockers.some((blocker) => /cross-product|multiple .* labels/.test(blocker))));
});
