import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildPoolReviewCoverage,
  renderPoolReviewCoverageJson,
  type PoolReviewCoverageArtifact,
} from "./review-pool-coverage.js";
import type { CatalogRow, PatternCatalog } from "./catalog.js";
import type { ReviewMetadataRecord, ReviewMetadataInput } from "./review-metadata.js";

function catalogRow(key: string, overrides: Partial<CatalogRow> = {}): CatalogRow {
  return {
    key,
    accountId: key,
    accountIdStatus: "derived",
    platform: "fixture",
    handle: `@${key.split("|")[1] ?? "unknown"}`,
    creator: "Fixture creator",
    niche: "catalog niche that is not a pool decision",
    sourceKind: "handle",
    configured: true,
    collected: true,
    audience: { size: null, countType: null, provenance: null, asOf: null },
    topics: ["catalog topic"],
    focus: ["catalog focus"],
    researchPools: ["broad"],
    formats: ["video"],
    mediaForms: ["video"],
    popularityScopes: ["catalog scope"],
    sampleScopes: ["catalog sample"],
    baselineSources: ["catalog baseline"],
    evidenceCount: 2,
    admissibleCount: 1,
    bodyCompleteCount: 1,
    bodyIncompleteCount: 0,
    lastCollectedAt: "2026-08-23",
    lastAnalyzedAt: "2026-08-23",
    caveats: ["catalog caveat"],
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

function review(overrides: Partial<ReviewMetadataRecord> = {}): ReviewMetadataInput {
  return {
    currentAccountKey: "fixture|alpha",
    platform: "fixture",
    handle: "@alpha",
    stableAccountId: "stable:alpha",
    stableAccountIdStatus: "confirmed",
    topics: ["reviewed topic"],
    focus: ["reviewed focus"],
    nicheLabel: "reviewed niche",
    researchPoolMembership: [
      { pool: "format", reason: "Explicit format review." },
      { pool: "niche", reason: "Explicit niche review." },
      { pool: "broad", reason: "Explicit broad review." },
    ],
    popularityScope: "reviewed popularity scope",
    sampleScope: "reviewed sample scope",
    baselineScope: "reviewed baseline scope",
    baselineSource: "reviewed baseline source",
    medium: "video",
    format: "short video",
    audienceSnapshot: {
      size: 1200,
      countType: "followers",
      provenance: "reviewed profile",
      asOf: "2026-08-23",
      collectedAt: "2026-08-23",
    },
    evidenceLinks: ["fixture://evidence/alpha"],
    reviewer: "fixture reviewer",
    reviewNote: "Fixture review.",
    disposition: "reviewed",
    reviewed_at: "2026-08-23T12:00:00.000Z",
    caveats: [],
    ...overrides,
  };
}

test("no reviews emits one unmapped row per catalog key and never infers pool membership", () => {
  const input = {
    catalog: catalog([
      catalogRow("fixture|zeta", { researchPools: ["niche", "format"], niche: "niche" }),
      catalogRow("fixture|alpha", { researchPools: ["broad"], formats: ["text"] }),
    ]),
    reviews: [] as ReviewMetadataInput[],
  };
  const before = structuredClone(input);

  const result = buildPoolReviewCoverage(input);

  assert.deepEqual(result.rows.map((row) => row.currentAccountKey), ["fixture|alpha", "fixture|zeta"]);
  assert.deepEqual(result.rows.map((row) => row.reviewedPoolLabels), [null, null]);
  assert.deepEqual(result.rows.map((row) => row.status), ["unmapped", "unmapped"]);
  assert.deepEqual(result.rows.map((row) => row.disposition), [null, null]);
  assert.deepEqual(result.summary, {
    total: 2,
    reviewed: 0,
    pending: 0,
    blocked: 0,
    unmapped: 2,
    poolCounts: { niche: 0, broad: 0, format: 0 },
    unmappedReviewRows: [],
  });
  assert.match(result.scope, /metadata coverage only/i);
  assert.match(result.scope, /not source\/post comparison readiness/i);
  assert.equal(result.bodyIncluded, false);
  assert.equal(result.sideEffects, "none");
  assert.deepEqual(input, before, "building coverage does not mutate inputs");
});

test("counts and emits every explicitly reviewed pool for a complete multi-pool review", () => {
  const result = buildPoolReviewCoverage({
    catalog: catalog([catalogRow("fixture|alpha")]),
    reviews: [review()],
  });

  assert.deepEqual(result.rows[0], {
    currentAccountKey: "fixture|alpha",
    platform: "fixture",
    handle: "@alpha",
    evidenceCount: 2,
    reviewedPoolLabels: ["broad", "format", "niche"],
    disposition: "reviewed",
    status: "reviewed",
    blockers: [],
    nextAction: "no further metadata review action",
  });
  assert.deepEqual(result.summary.poolCounts, { niche: 1, broad: 1, format: 1 });
  assert.equal(result.summary.reviewed, 1);
  assert.equal(result.summary.blocked, 0);
  assert.equal(result.summary.unmapped, 0);
});

test("keeps invalid and incomplete metadata blocked with validator blockers", () => {
  const incomplete = review({
    currentAccountKey: "fixture|incomplete",
    topics: null,
    focus: "unknown",
    researchPoolMembership: [],
    audienceSnapshot: null,
    evidenceLinks: null,
  });
  const invalid = review({
    currentAccountKey: "fixture|invalid",
    researchPoolMembership: [{ pool: "viral" as never, reason: "unsupported fixture pool" }],
  });

  const result = buildPoolReviewCoverage({
    catalog: catalog([
      catalogRow("fixture|invalid"),
      catalogRow("fixture|incomplete"),
    ]),
    reviews: [incomplete, invalid],
  });

  const invalidRow = result.rows.find((row) => row.currentAccountKey === "fixture|invalid")!;
  assert.equal(invalidRow.status, "blocked");
  assert.equal(invalidRow.disposition, "reviewed");
  assert.deepEqual(invalidRow.reviewedPoolLabels, []);
  assert.match(invalidRow.blockers.join("\n"), /unsupported pool.*viral/i);

  const incompleteRow = result.rows.find((row) => row.currentAccountKey === "fixture|incomplete")!;
  assert.equal(incompleteRow.status, "blocked");
  assert.equal(incompleteRow.disposition, "reviewed");
  assert.deepEqual(incompleteRow.reviewedPoolLabels, []);
  assert.ok(incompleteRow.blockers.includes("topics"));
  assert.ok(incompleteRow.blockers.includes("researchPoolMembership"));
  assert.ok(incompleteRow.blockers.includes("audienceSnapshot"));
  assert.ok(incompleteRow.blockers.includes("evidenceLinks"));
  assert.equal(result.summary.blocked, 2);
  assert.deepEqual(result.summary.poolCounts, { niche: 0, broad: 0, format: 0 });
});

test("unknown and null review values remain unknown or null, never catalog-derived pools", () => {
  const result = buildPoolReviewCoverage({
    catalog: catalog([
      catalogRow("fixture|null", { researchPools: ["niche"], niche: "niche" }),
      catalogRow("fixture|unknown", { researchPools: ["format"], formats: ["format"] }),
    ]),
    reviews: [
      review({
        currentAccountKey: "fixture|null",
        researchPoolMembership: null,
        disposition: "blocked",
      }),
      review({
        currentAccountKey: "fixture|unknown",
        researchPoolMembership: "unknown",
        disposition: "pending",
      }),
    ],
  });

  assert.deepEqual(result.rows.map((row) => ({ key: row.currentAccountKey, pools: row.reviewedPoolLabels, status: row.status })), [
    { key: "fixture|null", pools: null, status: "blocked" },
    { key: "fixture|unknown", pools: "unknown", status: "blocked" },
  ]);
  assert.deepEqual(result.summary.poolCounts, { niche: 0, broad: 0, format: 0 });
  assert.equal(result.summary.reviewed, 0);
  assert.equal(result.summary.blocked, 2);
  assert.equal(result.summary.unmapped, 0);
});

test("JSON rendering is body-free and deterministic across input order", () => {
  const first = buildPoolReviewCoverage({
    catalog: catalog([catalogRow("fixture|zeta"), catalogRow("fixture|alpha")]),
    reviews: [review({ currentAccountKey: "fixture|alpha" })],
  });
  const second = buildPoolReviewCoverage({
    catalog: catalog([catalogRow("fixture|alpha"), catalogRow("fixture|zeta")]),
    reviews: [review({ currentAccountKey: "fixture|alpha" })],
  });

  assert.deepEqual(first, second);
  const json = renderPoolReviewCoverageJson(first);
  assert.match(json, /"bodyIncluded": false/);
  assert.match(json, /metadata coverage only; not source\/post comparison readiness/i);
  assert.doesNotMatch(json, /reviewed profile|Explicit format review/);
  assert.doesNotMatch(json, /"body"\s*:/i);
});

function isArtifact(value: PoolReviewCoverageArtifact): boolean {
  return value.kind === "pool_review_coverage" && value.sideEffects === "none";
}

test("artifact shape is explicit and inspectable", () => {
  const result = buildPoolReviewCoverage({ catalog: catalog([]), reviews: [] });
  assert.equal(isArtifact(result), true);
  assert.equal(result.kind, "pool_review_coverage");
  assert.equal(result.version, "pool-review-coverage-v1");
});
