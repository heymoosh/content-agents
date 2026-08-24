import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAccountTableReport,
  loadAccountTableReport,
  main,
  renderAccountTableReportJson,
  renderAccountTableReportMarkdown,
} from "./account-table-report.js";
import type { PatternCatalog } from "./catalog.js";
import type { ComparisonReadinessInventory } from "./comparison-readiness.js";
import type { ReviewMetadataRecord } from "./review-metadata.js";
import type { PatternMiningConfig } from "./types.js";

function catalog(): PatternCatalog {
  return {
    rows: [
      {
        key: "x|zeta", accountId: "x|zeta", accountIdStatus: "derived", platform: "x", handle: "@zeta",
        creator: "Zeta", niche: "civic", sourceKind: "handle", configured: true, collected: true,
        audience: { size: 900, countType: "followers", provenance: "catalog must not win over review", asOf: "2026-08-20" },
        topics: ["catalog topic"], focus: ["catalog focus"], researchPools: ["broad"], formats: ["text"],
        mediaForms: ["text"], popularityScopes: ["catalog popularity"], sampleScopes: ["catalog sample"],
        baselineSources: ["catalog baseline"], evidenceCount: 1, admissibleCount: 1, bodyCompleteCount: 1,
        bodyIncompleteCount: 0, lastCollectedAt: "2026-08-20", lastAnalyzedAt: "2026-08-21",
        caveats: ["catalog caveat"],
      },
      {
        key: "x|alpha", accountId: "x|alpha", accountIdStatus: "derived", platform: "x", handle: "@alpha",
        creator: "Alpha", niche: "civic", sourceKind: "handle", configured: true, collected: false,
        audience: { size: 123, countType: "followers", provenance: "unreviewed catalog value", asOf: "2026-08-20" },
        topics: ["must not be inferred"], focus: ["must not be inferred"], researchPools: ["niche"], formats: ["text"],
        mediaForms: ["text"], popularityScopes: ["catalog popularity"], sampleScopes: ["catalog sample"],
        baselineSources: ["catalog baseline"], evidenceCount: 0, admissibleCount: 0, bodyCompleteCount: 0,
        bodyIncompleteCount: 0, lastCollectedAt: null, lastAnalyzedAt: null, caveats: [],
      },
    ],
    summary: {
      configuredTargets: 2, collectedSources: 1, configuredAndCollected: 1, configuredButUncollected: 1,
      evidenceCount: 1, admissibleCount: 1, bodyCompleteCount: 1, bodyIncompleteCount: 0,
    },
  };
}

function review(overrides: Partial<ReviewMetadataRecord> = {}): ReviewMetadataRecord {
  return {
    currentAccountKey: "x|zeta", platform: "x", handle: "@zeta", creator: "Reviewed Zeta",
    stableAccountId: "stable-zeta", stableAccountIdStatus: "reviewed", topics: ["review topic"],
    focus: ["review focus"], nicheLabel: "civic", researchPoolMembership: [{ pool: "niche", reason: "explicit human reason" }],
    popularityScope: "review popularity", sampleScope: "review sample", baselineScope: "review baseline",
    baselineSource: "review source", medium: "text", format: "short post",
    audienceSnapshot: { size: 1200, countType: "followers", provenance: "reviewed profile", asOf: "2026-08-22", collectedAt: "2026-08-23" },
    evidenceLinks: ["https://example.test/account"], reviewer: "Muxin",
    reviewNote: "PRIVATE REVIEW NOTE MUST NOT APPEAR", disposition: "reviewed", reviewed_at: "2026-08-23",
    caveats: ["review caveat"], ...overrides,
  };
}

function comparison(): ComparisonReadinessInventory {
  return {
    kind: "comparison_readiness_inventory", version: "comparison-readiness-v1", sideEffects: "none",
    summary: { ready: 1, blocked: 0, duplicateEvidence: 0 },
    rows: [{
      kind: "comparison_readiness_row", version: "comparison-readiness-v1", id: "example-zeta",
      evidenceId: "example-zeta", accountId: "x|zeta", sourceId: "source-zeta", postId: "post-zeta",
      platform: "x", medium: "text", format: "short post", pool: "broad", topics: ["wrong topic"],
      focus: ["wrong focus"], nicheLabel: "wrong niche", popularityScope: "evidence popularity",
      sampleScope: "evidence sample", baselineScope: "evidence baseline", baselineSource: "evidence source",
      evidenceLinks: ["https://example.test/post"], caveats: ["evidence caveat"], bodyIncluded: false,
      readiness: { status: "ready", blockers: [] },
    }],
  };
}

function input(reviews?: readonly unknown[]) {
  return { catalog: catalog(), comparison: comparison(), ...(reviews === undefined ? {} : { reviews }) };
}

describe("account table report", () => {
  test("keeps configured rows, joins reviewed fields, and renders deterministically without body or winner claims", () => {
    const first = buildAccountTableReport(input([review()]));
    const second = loadAccountTableReport({
      loadCatalog: () => ({ ...catalog(), rows: [...catalog().rows].reverse() }),
      loadComparison: () => comparison(),
      loadReviews: () => [review()],
    });

    assert.deepEqual(first, second);
    assert.deepEqual(first.rows.map((row) => [row.currentAccountKey, row.configured, row.reviewStatus]), [
      ["x|alpha", true, "unreviewed"],
      ["x|zeta", true, "reviewed"],
    ]);
    assert.deepEqual(first.rows[1], {
      currentAccountKey: "x|zeta", accountId: "stable-zeta", handle: "@zeta", creator: "Reviewed Zeta",
      configured: true, collected: true, evidenceCount: 1,
      accountSize: 1200,
      accountSizeSnapshot: { size: 1200, countType: "followers", provenance: "reviewed profile", asOf: "2026-08-22", collectedAt: "2026-08-23" },
      topics: ["review topic"], focus: ["review focus"], platform: "x", medium: "text", format: "short post",
      scope: { popularity: "review popularity", sample: "review sample", baseline: "review baseline", baselineSource: "review source" },
      pool: [{ pool: "niche", reason: "explicit human reason" }], status: "reviewed", reviewStatus: "reviewed",
      evidenceLinks: ["https://example.test/account"], caveats: ["review caveat"],
      readiness: { status: "ready", blockers: [] }, bodyIncluded: false,
    });
    assert.equal(first.rows[0]?.accountSize, null);
    assert.equal(first.examples[0]?.pool, "broad");
    assert.equal(first.examples[0]?.topics?.[0], "review topic");
    assert.equal(first.examples[0]?.reviewStatus, "reviewed");

    const json = renderAccountTableReportJson(first);
    assert.equal(json, renderAccountTableReportJson(second));
    assert.doesNotMatch(json, /PRIVATE REVIEW NOTE|POST BODY|"body"\s*:|winner/i);
    const markdown = renderAccountTableReportMarkdown(first);
    assert.match(markdown, /# Account table report/);
    assert.match(markdown, /x\\\|alpha/);
    assert.match(markdown, /Account size/);
    assert.match(markdown, /Caveats/);
    assert.match(markdown, /review caveat/);
    assert.match(markdown, /evidence caveat/);
    assert.doesNotMatch(markdown, /PRIVATE REVIEW NOTE|POST BODY|bodyIncluded|winner (selected|claim)/i);
  });

  test("derives comparison examples from explicit corpus and analyses when no comparison view is injected", () => {
    const report = buildAccountTableReport({
      catalog: catalog(),
      reviews: [review()],
      corpus: [{
        id: "post-zeta", platform: "x", handle: "@zeta", creator: "Zeta",
        url: "https://example.test/post-zeta", posted_at: "2026-08-20", collected_at: "2026-08-21",
        kind: "text", body: "POST BODY MUST NOT APPEAR", body_is_complete: true,
      }],
      analyses: [{
        id: "evidence-zeta", post_id: "post-zeta", source_id: "source-zeta", account_id: "stable-zeta",
        platform: "x", medium: "text", format: "short post",
        pool_memberships: [{ pool: "niche", reason: "Explicit source selection." }],
        audience_size_snapshot: { size: 1200, count_type: "followers", observed_at: "2026-08-20", collected_at: "2026-08-21", evidence_source: "profile snapshot" },
        metric_snapshot: { metric: "likes", value: 100, unit: "count", numerator: 100, denominator: 1200, window: "lifetime", scope: "post", observed_at: "2026-08-21" },
        popularity_scope: "niche creators", sample_scope: "fixed sample", baseline_scope: "recorded baseline", baseline_source: "baseline",
        evidence_links: ["post-zeta"], caveats: [], provenance: "fixture", observed_at: "2026-08-20", collected_at: "2026-08-21",
        review_status: "reviewed", status: "ready", lineage: [{ record_type: "source", id: "source-zeta", relation: "evidences" }],
        evidence_location: "public post", selection_rule: "fixed sample", body_is_complete: true,
      }],
    });

    assert.equal(report.examples.length, 1);
    assert.equal(report.examples[0]?.pool, "niche");
    assert.equal(report.examples[0]?.readiness.status, "ready");
    assert.doesNotMatch(renderAccountTableReportJson(report), /POST BODY MUST NOT APPEAR/);
  });

  test("fails closed when review input is missing while retaining explicit evidence and configured rows", () => {
    const report = buildAccountTableReport(input());

    assert.equal(report.reviewInput.status, "not_supplied");
    assert.equal(report.reviewInput.reviewStatus, "unreviewed");
    assert.deepEqual(report.rows.map((row) => [row.currentAccountKey, row.reviewStatus, row.accountSize, row.pool]), [
      ["x|alpha", "unreviewed", null, null],
      ["x|zeta", "unreviewed", null, null],
    ]);
    assert.equal(report.examples[0]?.pool, "broad");
    assert.equal(report.examples[0]?.readiness.status, "blocked");
    assert.equal(report.summary.ready, 0);
  });

  test("treats an invalid review batch atomically and never lets a valid sibling become reviewed", () => {
    const report = buildAccountTableReport(input([review(), { currentAccountKey: "x|broken" }]));

    assert.equal(report.reviewInput.status, "invalid");
    assert.equal(report.reviewInput.reviewStatus, "unreviewed");
    assert.equal(report.rows.find((row) => row.currentAccountKey === "x|zeta")?.reviewStatus, "unreviewed");
    assert.equal(report.rows.find((row) => row.currentAccountKey === "x|zeta")?.topics, null);
    assert.equal(report.rows.find((row) => row.currentAccountKey === "x|zeta")?.pool, null);
    assert.equal(report.examples[0]?.reviewStatus, "unreviewed");
    assert.equal(report.examples[0]?.pool, "broad");
    assert.equal(report.summary.blocked, report.rows.length + report.examples.length);
  });

  test("CLI main accepts injected catalog/file loaders and renders the same body-free contract", () => {
    const writes: string[] = [];
    const config: PatternMiningConfig = {
      niches: ["civic"],
      accounts: [
        { platform: "x", handle: "@zeta", creator: "Zeta", niche: "civic", followers: null },
        { platform: "x", handle: "@alpha", creator: "Alpha", niche: "civic", followers: null },
      ],
      outlier_thresholds: {}, targets: { corpus_size_min: 1, corpus_size_max: 2 },
    };
    assert.equal(main(["--format", "json", "--reviews", "reviews.json"], () => ({ config, corpus: [], analyses: [] }), {
      write: (value) => writes.push(value),
      readFile: () => JSON.stringify([review()]),
    }), 0);
    const output = writes.join("");
    assert.equal(JSON.parse(output).reviewInput.status, "valid");
    assert.doesNotMatch(output, /PRIVATE REVIEW NOTE|"body"\s*:/);
  });
});
