import { test } from "node:test";
import assert from "node:assert/strict";
import type { CatalogRow, PatternCatalog } from "./catalog.js";
import {
  buildPoolReviewHandoff,
  renderPoolReviewHandoffMarkdown,
  renderPoolReviewHandoffJson,
} from "./pool-review-handoff.js";
import type { PoolReviewCoverageArtifact } from "./review-pool-coverage.js";

function catalogRow(key: string, overrides: Partial<CatalogRow> = {}): CatalogRow {
  return {
    key,
    accountId: `account:${key}`,
    accountIdStatus: "derived",
    platform: "fixture",
    handle: `@${key.split("|")[1] ?? "unknown"}`,
    creator: "Fixture creator",
    niche: "civic technology",
    sourceKind: "handle",
    configured: true,
    collected: true,
    audience: { size: 1200, countType: "followers", provenance: "fixture profile", asOf: "2026-08-23" },
    topics: ["public services"],
    focus: ["human-centered systems"],
    researchPools: ["broad"],
    formats: ["video"],
    mediaForms: ["video"],
    popularityScopes: ["fixture scope"],
    sampleScopes: ["fixture sample"],
    baselineSources: ["fixture baseline"],
    evidenceCount: 2,
    admissibleCount: 2,
    bodyCompleteCount: 1,
    bodyIncompleteCount: 0,
    lastCollectedAt: "2026-08-23",
    lastAnalyzedAt: "2026-08-23",
    caveats: ["fixture caveat"],
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

function coverage(rows: PoolReviewCoverageArtifact["rows"]): PoolReviewCoverageArtifact {
  return {
    kind: "pool_review_coverage",
    version: "pool-review-coverage-v1",
    scope: "metadata coverage only; not source/post comparison readiness",
    bodyIncluded: false,
    rows,
    summary: {
      total: rows.length,
      reviewed: rows.filter((row) => row.status === "reviewed").length,
      pending: rows.filter((row) => row.status === "pending").length,
      blocked: rows.filter((row) => row.status === "blocked").length,
      unmapped: rows.filter((row) => row.status === "unmapped").length,
      poolCounts: { niche: 0, broad: 0, format: 0 },
      unmappedReviewRows: [],
    },
    sideEffects: "none",
  };
}

test("joins account context to explicit reviewed pool facts without using catalog pools", () => {
  const input = {
    catalog: catalog([
      catalogRow("fixture|zeta", { researchPools: ["niche"] }),
      catalogRow("fixture|alpha", { creator: "Alpha creator", topics: ["AI accountability"] }),
    ]),
    coverage: coverage([
      {
        currentAccountKey: "fixture|alpha",
        platform: "fixture",
        handle: "@alpha",
        evidenceCount: 2,
        reviewedPoolLabels: ["broad"],
        disposition: "reviewed",
        status: "reviewed",
        blockers: [],
        nextAction: "no further metadata review action",
      },
      {
        currentAccountKey: "fixture|zeta",
        platform: "fixture",
        handle: "@zeta",
        evidenceCount: 2,
        reviewedPoolLabels: null,
        disposition: "pending",
        status: "pending",
        blockers: ["researchPoolMembership"],
        nextAction: "complete human review of account metadata",
      },
    ]),
  };
  const before = structuredClone(input);
  const result = buildPoolReviewHandoff(input);

  assert.deepEqual(result.rows.map((row) => row.currentAccountKey), ["fixture|alpha", "fixture|zeta"]);
  assert.equal(result.rows[0]?.creator, "Alpha creator");
  assert.deepEqual(result.rows[0]?.reviewedPoolLabels, ["broad"]);
  assert.deepEqual(result.rows[1]?.reviewedPoolLabels, null);
  assert.equal(result.summary.explicitPoolReviewRows, 1);
  assert.equal(result.summary.choiceRequiredRows, 1);
  assert.equal(result.bodyIncluded, false);
  assert.equal(result.sideEffects, "none");
  assert.deepEqual(input, before, "building the handoff does not mutate inputs");
});

test("missing coverage stays unmapped and does not invent a pool from catalog researchPools", () => {
  const result = buildPoolReviewHandoff({
    catalog: [catalogRow("fixture|missing", { researchPools: ["niche", "format"] })],
    coverage: coverage([]),
  });
  assert.equal(result.rows[0]?.status, "unmapped");
  assert.equal(result.rows[0]?.reviewedPoolLabels, null);
  assert.equal(result.rows[0]?.nextAction, "run pool review coverage and add explicit review metadata");
  assert.match(result.rows[0]?.blockers.join("\n") ?? "", /coverage is missing/i);
  assert.equal(result.summary.unmapped, 1);
});

test("rendering is deterministic, account-context-only, and body-free", () => {
  const result = buildPoolReviewHandoff({
    catalog: catalog([catalogRow("fixture|alpha")]),
    coverage: coverage([{
      currentAccountKey: "fixture|alpha",
      platform: "fixture",
      handle: "@alpha",
      evidenceCount: 2,
      reviewedPoolLabels: "unknown",
      disposition: "blocked",
      status: "blocked",
      blockers: ["researchPoolMembership"],
      nextAction: "resolve metadata blockers",
    }]),
  });
  const json = renderPoolReviewHandoffJson(result);
  const markdown = renderPoolReviewHandoffMarkdown(result);
  assert.match(json, /"bodyIncluded": false/);
  assert.match(markdown, /Pool review handoff/);
  assert.match(markdown, /civic technology/);
  assert.match(markdown, /1200; followers; 2026-08-23; fixture profile/);
  assert.match(markdown, /yes \/ yes/);
  assert.doesNotMatch(json, /"body"\s*:/i);
  assert.doesNotMatch(markdown, /researchPools/);
});
