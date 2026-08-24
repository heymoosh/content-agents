import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCatalog, type PatternCatalog } from "./catalog.js";
import {
  buildReadinessReport,
  main,
  renderReadinessJson,
  renderReadinessMarkdown,
  type ReadinessInputs,
} from "./readiness.js";
import type { ReviewMetadataRecord } from "./review-metadata.js";
import type { PatternMiningConfig } from "./types.js";

const POST_BODY = "PRIVATE POST BODY MUST NOT APPEAR";
const REVIEW_NOTE = "PRIVATE REVIEW NOTE MUST NOT APPEAR";

const config: PatternMiningConfig = {
  niches: ["systems"],
  accounts: [
    { platform: "x", handle: "@zeta", creator: "Zeta", niche: "systems", followers: null },
    { platform: "x", handle: "@alpha", creator: "Alpha", niche: "systems", followers: null },
  ],
  outlier_thresholds: {},
  targets: { corpus_size_min: 1, corpus_size_max: 10 },
};

const corpus = [{
  id: "post-a",
  platform: "x",
  handle: "@alpha",
  creator: "Alpha",
  url: "https://example.test/post-a",
  posted_at: "2026-08-20",
  collected_at: "2026-08-21",
  kind: "text",
  body: POST_BODY,
  body_is_complete: true,
  media: { form: "text-only" },
}];

const analyses = [{
  id: "evidence-a",
  post_id: "post-a",
  source_id: "source-a",
  account_id: "account-a",
  platform: "x",
  medium: "text",
  format: "text-only",
  pool_memberships: [{ pool: "niche", reason: "Explicit source selection." }],
  audience_size_snapshot: {
    size: 1200,
    count_type: "followers",
    observed_at: "2026-08-20",
    collected_at: "2026-08-21",
    evidence_source: "profile snapshot",
  },
  metric_snapshot: {
    metric: "likes",
    value: 100,
    unit: "count",
    numerator: 100,
    denominator: 1200,
    window: "lifetime",
    scope: "post",
    observed_at: "2026-08-21",
  },
  popularity_scope: "niche creators",
  sample_scope: "fixed sample",
  baseline_scope: "recorded baseline",
  baseline_source: "baseline-a",
  evidence_links: ["post-a"],
  caveats: [],
  provenance: "fixture source snapshot",
  observed_at: "2026-08-20",
  collected_at: "2026-08-21",
  review_status: "reviewed",
  status: "ready",
  lineage: [{ record_type: "source", id: "source-a", relation: "evidences" }],
  evidence_location: "public post",
  selection_rule: "fixed sample",
  body_is_complete: true,
}];

function review(currentAccountKey: string, stableAccountId: string): ReviewMetadataRecord {
  return {
    currentAccountKey,
    platform: "x",
    handle: `@${currentAccountKey.split("|")[1]}`,
    creator: "Human-reviewed creator",
    stableAccountId,
    stableAccountIdStatus: "confirmed",
    topics: ["explicit topic"],
    focus: ["explicit focus"],
    nicheLabel: "explicit niche",
    researchPoolMembership: [{ pool: "niche", reason: "Human supplied pool reason." }],
    popularityScope: "explicit popularity scope",
    sampleScope: "explicit sample scope",
    baselineScope: "explicit baseline scope",
    baselineSource: "explicit baseline source",
    medium: "text",
    format: "text-only",
    audienceSnapshot: {
      size: 1200,
      countType: "followers",
      provenance: "human supplied audience source",
      asOf: "2026-08-20",
      collectedAt: "2026-08-21",
    },
    evidenceLinks: ["post-a"],
    reviewer: "Muxin",
    reviewNote: REVIEW_NOTE,
    disposition: "reviewed",
    reviewed_at: "2026-08-23T00:00:00.000Z",
    caveats: ["human caveat metadata"],
  };
}

const validReviews = [review("x|alpha", "account-a"), review("x|zeta", "account-z")];

function catalog(): PatternCatalog {
  return buildCatalog(config, corpus, analyses);
}

function inputs(overrides: Partial<ReadinessInputs> = {}): ReadinessInputs {
  return { catalog: catalog(), corpus, analyses, ...overrides };
}

function captureMain(
  argv: readonly string[],
  reviewRows?: unknown,
): { code: number; output: string; loadedPaths: { config?: string; corpus?: string; analyses?: string } } {
  const output: string[] = [];
  let loadedPaths: { config?: string; corpus?: string; analyses?: string } = {};
  const code = main(argv, (receivedPaths) => {
    loadedPaths = receivedPaths ?? {};
    return { config, corpus, analyses };
  }, {
    write: (value) => output.push(value),
    readFile: () => JSON.stringify(reviewRows),
  });
  return { code, output: output.join(""), loadedPaths };
}

test("defaults load the explicit catalog inputs and compose both readiness artifacts", () => {
  const result = captureMain([]);
  const report = JSON.parse(result.output) as ReturnType<typeof buildReadinessReport>;

  assert.equal(result.code, 0);
  assert.deepEqual(result.loadedPaths, {});
  assert.equal(report.evidenceReadiness.kind, "pattern_evidence_readiness");
  assert.equal(report.platformReadiness.kind, "pattern_platform_readiness");
  assert.equal(report.sideEffects, "none");

  const explicit = captureMain([
    "--config", "fixture-config.yaml", "--corpus", "fixture-corpus.jsonl", "--analyses", "fixture-analyses.jsonl",
  ]);
  assert.deepEqual(explicit.loadedPaths, {
    config: "fixture-config.yaml",
    corpus: "fixture-corpus.jsonl",
    analyses: "fixture-analyses.jsonl",
  });
});

test("missing reviews remain explicitly not supplied and blocked", () => {
  const report = buildReadinessReport(inputs());

  assert.deepEqual(report.reviewInput, {
    supplied: false,
    path: null,
    status: "not_supplied",
    reviewStatus: "unreviewed",
    rowCount: 0,
    validRowCount: 0,
    invalidRowCount: 0,
    validationErrors: [],
    readiness: {
      status: "blocked",
      readyRows: 0,
      blockedRows: 0,
      blockingFields: ["reviewMetadata"],
      reason: "Review input was not supplied; account metadata remains unreviewed.",
    },
  });
  assert.equal(report.evidenceReadiness.comparisonReadiness.summary.ready, 0);
  assert.equal(report.evidenceReadiness.comparisonReadiness.rows[0]?.readiness.status, "blocked");
  assert.equal(report.platformReadiness.summary.reviewedEvidence, 0);
  assert.equal(report.platformReadiness.summary.reusableRows, 0);
});

test("invalid review rows are reported and cannot make evidence reviewed", () => {
  const invalid = {
    ...validReviews[0],
    researchPoolMembership: [{ pool: "viral", reason: "Unsupported and must not be inferred." }],
  };
  const result = captureMain(["--reviews", "fixture-reviews.json"], [invalid]);
  const report = JSON.parse(result.output) as ReturnType<typeof buildReadinessReport>;

  assert.equal(result.code, 0);
  assert.equal(report.reviewInput.status, "invalid");
  assert.equal(report.reviewInput.reviewStatus, "unreviewed");
  assert.equal(report.reviewInput.invalidRowCount, 1);
  assert.match(report.reviewInput.validationErrors.join("\n"), /unsupported pool.*viral/i);
  assert.equal(report.evidenceReadiness.comparisonReadiness.summary.ready, 0);
  assert.equal(report.platformReadiness.summary.reviewedEvidence, 0);
  assert.equal(report.platformReadiness.summary.reusableRows, 0);
  assert.doesNotMatch(result.output, /PRIVATE POST BODY|PRIVATE REVIEW NOTE/);
  assert.doesNotMatch(result.output, /"body"\s*:/);
});

test("a mixed valid and invalid review batch fails closed for every row", () => {
  const invalid = {
    ...validReviews[0],
    researchPoolMembership: [{ pool: "viral", reason: "Unsupported and must not be inferred." }],
  };
  const result = captureMain(["--reviews", "fixture-reviews.json"], [validReviews[1], invalid]);
  const report = JSON.parse(result.output) as ReturnType<typeof buildReadinessReport>;

  assert.equal(report.reviewInput.status, "invalid");
  assert.equal(report.reviewInput.validRowCount, 1);
  assert.equal(report.reviewInput.invalidRowCount, 1);
  assert.equal(report.evidenceReadiness.comparisonReadiness.summary.ready, 0);
  assert.equal(report.platformReadiness.summary.reviewedEvidence, 0);
  assert.equal(report.platformReadiness.summary.reusableRows, 0);
});

test("a reviewed row beside a pending row also fails closed", () => {
  const pending = { ...validReviews[0], disposition: "pending" };
  const result = captureMain(["--reviews", "fixture-reviews.json"], [validReviews[1], pending]);
  const report = JSON.parse(result.output) as ReturnType<typeof buildReadinessReport>;

  assert.equal(report.reviewInput.status, "valid");
  assert.equal(report.reviewInput.reviewStatus, "unreviewed");
  assert.equal(report.reviewInput.readiness.status, "blocked");
  assert.equal(report.evidenceReadiness.comparisonReadiness.summary.ready, 0);
  assert.equal(report.platformReadiness.summary.reviewedEvidence, 0);
  assert.equal(report.platformReadiness.summary.reusableRows, 0);
});

test("JSON and Markdown rendering are deterministic and body-free", () => {
  const first = buildReadinessReport(inputs({ reviews: [...validReviews].reverse(), reviewsPath: "reviews.json" }));
  const second = buildReadinessReport(inputs({ reviews: [...validReviews], reviewsPath: "reviews.json" }));

  assert.equal(renderReadinessJson(first), renderReadinessJson(second));
  assert.equal(renderReadinessMarkdown(first), renderReadinessMarkdown(second));
  assert.match(renderReadinessMarkdown(first), /# Pattern readiness/);
  assert.match(renderReadinessMarkdown(first), /Platform readiness/);
  assert.doesNotMatch(renderReadinessJson(first), /PRIVATE POST BODY|PRIVATE REVIEW NOTE/);
  assert.doesNotMatch(renderReadinessMarkdown(first), /PRIVATE POST BODY|PRIVATE REVIEW NOTE|bodyIncluded/);
});
