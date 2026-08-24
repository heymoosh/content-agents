import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCatalog, type PatternCatalog } from "./catalog.js";
import {
  buildReviewStatus,
  main,
  type ReviewMetadataRecord,
  type ReviewStatusInputs,
} from "./review-status.js";
import type { PatternMiningConfig } from "./types.js";

const config: PatternMiningConfig = {
  niches: ["systems"],
  accounts: [
    { platform: "x", handle: "@zeta", creator: "Zeta", niche: "systems", followers: null },
    { platform: "x", handle: "@alpha", creator: "Alpha", niche: "systems", followers: null },
  ],
  outlier_thresholds: {},
  targets: { corpus_size_min: 1, corpus_size_max: 10 },
};

function catalog(): PatternCatalog {
  return buildCatalog(config, [
    {
      platform: "x",
      handle: "@zeta",
      creator: "Zeta",
      body: "PRIVATE BODY ZETA MUST NOT APPEAR",
      url: "https://example.test/zeta",
      collected_at: "2026-08-24T00:00:00.000Z",
    },
    {
      platform: "x",
      handle: "@alpha",
      creator: "Alpha",
      body: "PRIVATE BODY ALPHA MUST NOT APPEAR",
      url: "https://example.test/alpha",
      collected_at: "2026-08-24T00:00:00.000Z",
    },
  ]);
}

function review(currentAccountKey: string, overrides: Partial<ReviewMetadataRecord> = {}): ReviewMetadataRecord {
  return {
    currentAccountKey,
    platform: "x",
    handle: `@${currentAccountKey.split("|")[1]}`,
    creator: "Human-reviewed creator",
    stableAccountId: `stable:${currentAccountKey}`,
    stableAccountIdStatus: "confirmed",
    topics: ["explicit topic"],
    focus: ["explicit focus"],
    nicheLabel: "explicit niche",
    researchPoolMembership: [{ pool: "niche", reason: "human supplied pool reason" }],
    popularityScope: "explicit popularity scope",
    sampleScope: "explicit sample scope",
    baselineScope: "explicit baseline scope",
    baselineSource: "explicit baseline source",
    medium: "text",
    format: "short post",
    audienceSnapshot: {
      size: 100,
      countType: "followers",
      provenance: "human supplied audience source",
      asOf: "2026-08-20",
      collectedAt: "2026-08-21",
    },
    evidenceLinks: [`fixture://evidence/${currentAccountKey}`],
    reviewer: "Muxin",
    reviewNote: "PRIVATE REVIEW NOTE MUST NOT APPEAR",
    disposition: "reviewed",
    reviewed_at: "2026-08-23T00:00:00.000Z",
    caveats: ["human caveat metadata is intentionally visible"],
    ...overrides,
  };
}

function inputs(overrides: Partial<ReviewStatusInputs> = {}): ReviewStatusInputs {
  return { catalog: catalog(), ...overrides };
}

function captureMain(
  argv: string[],
  reviews?: unknown,
  reviewsPath?: string,
): { code: number; output: string } {
  const path = reviewsPath ?? join(mkdtempSync(join(tmpdir(), "review-status-test-")), "reviews.json");
  if (reviews !== undefined) writeFileSync(path, JSON.stringify(reviews), "utf8");
  const output: string[] = [];
  const code = main(
    reviews === undefined ? argv : [...argv, "--reviews", path],
    () => ({ config, corpus: [], analyses: [] }),
    {
      write: (value) => output.push(value),
      readFile: (path) => readFileSync(path, "utf8"),
    },
  );
  return { code, output: output.join("") };
}

test("absent reviews are reported as not supplied and never reviewed", () => {
  const report = buildReviewStatus(inputs());

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
  assert.deepEqual(report.queue.rows.map((row) => [row.currentAccountKey, row.status]), [
    ["x|alpha", "unmapped"],
    ["x|zeta", "unmapped"],
  ]);
  assert.ok(report.queue.rows[0]?.missingRequiredOverlayFields.includes("topics"));
  assert.ok(report.queue.rows[0]?.missingRequiredOverlayFields.includes("audienceSnapshot"));
  assert.equal(report.queue.rows.some((row) => row.status === "reviewed"), false);
  assert.equal(report.accountMetadataRows[0]?.topics, null);
  assert.equal(report.accountMetadataRows[0]?.reviewedPoolMembership, null);
  assert.deepEqual(report.poolCoverage.summary.poolCounts, { niche: 0, broad: 0, format: 0 });
  assert.equal(report.sideEffects, "none");
});

test("valid reviewed input is exposed as ready while comparison readiness stays explicit", () => {
  const report = buildReviewStatus({
    ...inputs(),
    reviews: [review("x|alpha"), review("x|zeta")],
    reviewsPath: "/tmp/reviews.json",
  });

  assert.equal(report.reviewInput.status, "valid");
  assert.equal(report.reviewInput.reviewStatus, "reviewed");
  assert.deepEqual(report.reviewInput.validationErrors, []);
  assert.deepEqual(report.reviewInput.readiness, {
    status: "ready",
    readyRows: 2,
    blockedRows: 0,
    blockingFields: [],
    reason: "All supplied account metadata rows are complete and explicitly reviewed.",
  });
  assert.deepEqual(report.queue.rows.map((row) => [row.currentAccountKey, row.status, row.comparisonEvidenceReady]), [
    ["x|alpha", "reviewed", false],
    ["x|zeta", "reviewed", false],
  ]);
  assert.equal(report.accountMetadataRows[0]?.topics?.[0], "explicit topic");
  const firstPools = report.accountMetadataRows[0]?.reviewedPoolMembership;
  assert.equal(Array.isArray(firstPools) ? firstPools[0]?.pool : null, "niche");
  assert.deepEqual(report.poolCoverage.summary.poolCounts, { niche: 2, broad: 0, format: 0 });
});

test("malformed and duplicate review input exposes validation errors and blocked readiness", () => {
  const malformed = { currentAccountKey: "x|zeta", platform: "x" };
  const report = buildReviewStatus({
    ...inputs(),
    reviews: [review("x|alpha"), review("x|alpha"), malformed as never],
  });

  assert.equal(report.reviewInput.status, "invalid");
  assert.equal(report.reviewInput.reviewStatus, "unreviewed");
  assert.match(report.reviewInput.validationErrors.join("\n"), /duplicate currentAccountKey "x\|alpha"/);
  assert.match(report.reviewInput.validationErrors.join("\n"), /review row 3: .*stableAccountIdStatus|review row 3: .*required/i);
  assert.equal(report.reviewInput.readiness.status, "blocked");
  assert.deepEqual(report.queue.rows.find((row) => row.currentAccountKey === "x|alpha")?.status, "blocked");
  assert.deepEqual(report.queue.rows.find((row) => row.currentAccountKey === "x|zeta")?.status, "unmapped");
});

test("JSON and Markdown output are deterministic and contain no body text", () => {
  const reviewsPath = join(mkdtempSync(join(tmpdir(), "review-status-deterministic-")), "reviews.json");
  const first = captureMain(["--format", "json"], [review("x|zeta"), review("x|alpha")], reviewsPath);
  const second = captureMain(["--format", "json"], [review("x|zeta"), review("x|alpha")], reviewsPath);
  assert.equal(first.code, 0);
  assert.equal(first.output, second.output);
  assert.deepEqual(JSON.parse(first.output).queue.rows.map((row: { currentAccountKey: string }) => row.currentAccountKey), ["x|alpha", "x|zeta"]);
  assert.doesNotMatch(first.output, /PRIVATE BODY|PRIVATE REVIEW NOTE/);
  assert.doesNotMatch(first.output, /"body"\s*:/);

  const markdown = captureMain(["--format", "markdown"], [review("x|alpha")]);
  assert.equal(markdown.code, 0);
  assert.match(markdown.output, /# Account review status/);
  assert.match(markdown.output, /Review input: valid/);
  assert.match(markdown.output, /x\\\|alpha/);
  assert.doesNotMatch(markdown.output, /PRIVATE BODY|PRIVATE REVIEW NOTE/);
  assert.doesNotMatch(markdown.output, /bodyIncluded/);
  assert.match(markdown.output, /Account metadata table/);
});
