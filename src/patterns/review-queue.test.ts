import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReviewQueue, renderReviewQueueJson } from "./review-queue.js";
import type { CatalogRow, PatternCatalog } from "./catalog.js";
import type { OverlayCoverageReport } from "./overlay-coverage.js";

function catalogRow(key: string, overrides: Partial<CatalogRow> = {}): CatalogRow {
  return {
    key,
    accountId: `derived:${key}`,
    accountIdStatus: "derived",
    platform: "fixture",
    handle: key,
    creator: "Fixture creator",
    niche: null,
    sourceKind: "handle",
    configured: true,
    collected: true,
    audience: { size: null, countType: null, provenance: null, asOf: null },
    topics: [],
    focus: [],
    researchPools: [],
    formats: [],
    mediaForms: [],
    popularityScopes: [],
    sampleScopes: [],
    baselineSources: [],
    evidenceCount: 0,
    admissibleCount: 0,
    bodyCompleteCount: 0,
    bodyIncompleteCount: 0,
    lastCollectedAt: null,
    lastAnalyzedAt: null,
    caveats: [],
    ...overrides,
  };
}

function catalog(rows: CatalogRow[]): PatternCatalog {
  return {
    rows,
    summary: {
      configuredTargets: rows.filter((row) => row.configured).length,
      collectedSources: rows.filter((row) => row.collected).length,
      configuredAndCollected: rows.filter((row) => row.configured && row.collected).length,
      configuredButUncollected: rows.filter((row) => row.configured && !row.collected).length,
      evidenceCount: rows.reduce((sum, row) => sum + row.evidenceCount, 0),
      admissibleCount: rows.reduce((sum, row) => sum + row.admissibleCount, 0),
      bodyCompleteCount: rows.reduce((sum, row) => sum + row.bodyCompleteCount, 0),
      bodyIncompleteCount: rows.reduce((sum, row) => sum + row.bodyIncompleteCount, 0),
    },
  };
}

function coverage(rows: OverlayCoverageReport["rows"], overrides: Partial<OverlayCoverageReport> = {}): OverlayCoverageReport {
  return {
    kind: "overlay_coverage",
    version: "overlay-coverage-v1",
    rows,
    duplicateMappings: [],
    missingMappings: [],
    unmappedMetadataRows: [],
    summary: { reviewed: 0, pending: 0, blocked: 0, unmapped: rows.length },
    sideEffects: "none",
    ...overrides,
  };
}

function coverageRow(currentAccountKey: string, overrides: Partial<OverlayCoverageReport["rows"][number]> = {}): OverlayCoverageReport["rows"][number] {
  return {
    currentAccountKey,
    status: "unmapped",
    stableId: null,
    stableIdPresent: false,
    missingRequiredOverlayFields: [],
    comparisonEvidenceReady: false,
    ...overrides,
  };
}

test("emits deterministic account-key rows with catalog context and summary counts", () => {
  const rows = [
    catalogRow("fixture|zeta", { handle: null, creator: null, evidenceCount: 2 }),
    catalogRow("fixture|alpha", { evidenceCount: 4 }),
  ];
  const overlay = coverage([
    coverageRow("fixture|zeta", { status: "pending" }),
    coverageRow("fixture|alpha", { status: "reviewed", stableIdPresent: true, stableId: "stable:alpha", comparisonEvidenceReady: true }),
  ], { summary: { reviewed: 1, pending: 1, blocked: 0, unmapped: 0 } });

  const first = buildReviewQueue({ catalog: catalog(rows), coverage: overlay });
  const second = buildReviewQueue({ catalog: catalog([...rows].reverse()), coverage: coverage([...overlay.rows].reverse(), { summary: overlay.summary }) });

  assert.deepEqual(first, second);
  assert.deepEqual(first.rows.map((row) => row.currentAccountKey), ["fixture|alpha", "fixture|zeta"]);
  assert.deepEqual(first.rows[0], {
    currentAccountKey: "fixture|alpha",
    platform: "fixture",
    handle: "fixture|alpha",
    creator: "Fixture creator",
    evidenceCount: 4,
    status: "reviewed",
    stableIdPresent: true,
    missingRequiredOverlayFields: [],
    comparisonEvidenceReady: true,
    nextReviewAction: "no further account review action",
  });
  assert.equal(first.summary.total, 2);
  assert.equal(first.summary.evidenceCount, 6);
  assert.equal(first.summary.comparisonEvidenceReady, 1);
  assert.deepEqual(first.summary.statusCounts, { reviewed: 1, pending: 1, blocked: 0, unmapped: 0 });
});

test("keeps blocked and unmapped rows explicit with human next actions", () => {
  const result = buildReviewQueue({
    catalog: catalog([
      catalogRow("fixture|blocked", { evidenceCount: 3 }),
      catalogRow("fixture|unmapped", { evidenceCount: 0 }),
    ]),
    coverage: coverage([
      coverageRow("fixture|blocked", { status: "blocked", missingRequiredOverlayFields: ["topics", "stableAccountId"] }),
      coverageRow("fixture|unmapped"),
    ], { summary: { reviewed: 0, pending: 0, blocked: 1, unmapped: 1 } }),
  });

  assert.equal(result.rows[0]?.status, "blocked");
  assert.equal(result.rows[0]?.nextReviewAction, "complete missing metadata: stableAccountId, topics");
  assert.equal(result.rows[1]?.status, "unmapped");
  assert.equal(result.rows[1]?.nextReviewAction, "map account or confirm explicit unmapped disposition");
  assert.deepEqual(result.summary.statusCounts, { reviewed: 0, pending: 0, blocked: 1, unmapped: 1 });
});

test("does not carry post body text into rows or JSON", () => {
  const result = buildReviewQueue({
    catalog: catalog([catalogRow("fixture|alpha", { evidenceCount: 1, caveats: ["body text must stay out"] })]),
    coverage: coverage([coverageRow("fixture|alpha", { status: "blocked", missingRequiredOverlayFields: ["topics"] })]),
  });

  assert.equal("body" in result.rows[0]!, false);
  const json = renderReviewQueueJson(result);
  assert.doesNotMatch(json, /body text must stay out/);
  assert.doesNotMatch(json, /bodyIncluded/);
});
