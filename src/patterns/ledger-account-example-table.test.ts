import assert from "node:assert/strict";
import test from "node:test";
import { buildAccountReviewLedger, type AccountReviewInput } from "./account-review-ledger.js";
import { buildLedgerAccountExampleTable } from "./ledger-account-example-table.js";
import { buildSourceEvidenceLedger } from "./source-evidence-ledger.js";

function account(overrides: Partial<AccountReviewInput> = {}): AccountReviewInput {
  return {
    id: "review:alice",
    currentAccountKey: "x|alice",
    platform: "x",
    handle: "@alice",
    creator: "Alice Example",
    stableAccountId: "account:alice",
    stableAccountIdStatus: "confirmed",
    topics: ["civic technology", "public institutions"],
    focus: ["decision-making under uncertainty"],
    nicheLabel: "civic technology",
    researchPoolMembership: [{ pool: "niche", reason: "explicit civic technology account" }, { pool: "broad", reason: "explicit broad-platform account" }],
    popularityScope: "reviewed niche and broad account sample",
    sampleScope: "2026-08 reviewed top-post sample",
    baselineScope: "2026-08 /new baseline",
    baselineSource: "baseline:x:2026-08",
    medium: "text",
    format: "short post",
    audienceSnapshot: { size: 12000, countType: "followers", provenance: "human-reviewed profile", asOf: "2026-08-23", collectedAt: "2026-08-24" },
    evidenceRefs: ["https://example.test/account", "https://example.test/post"],
    baselineRefs: ["baseline:x:2026-08"],
    caveats: ["audience is a point-in-time snapshot"],
    reviewer: "muxin",
    reviewNote: "human-reviewed account metadata",
    disposition: "reviewed",
    dispositionReason: "explicitly reviewed",
    reviewed_at: "2026-08-24T12:00:00Z",
    supersedesId: null,
    ...overrides,
  };
}

function source(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    evidenceId: "evidence:alice:post-1",
    sourceId: "source:alice",
    postId: "post:alice:1",
    accountId: "account:alice",
    platform: "x",
    url: "https://example.test/post",
    locator: "post body captured by approved browser evidence",
    sourceRole: "top example",
    evidenceLocation: "post page",
    comparisonClaimed: true,
    pool: "niche",
    membershipReason: "explicit civic technology account sample",
    nicheLabel: "civic technology",
    topics: ["civic technology"],
    focus: ["decision-making under uncertainty"],
    medium: "text",
    format: "short post",
    audienceSizeSnapshot: { size: 12000, countType: "followers", observedAt: "2026-08-23", collectedAt: "2026-08-24", evidenceSource: "profile page" },
    metricSnapshot: { metric: "likes", value: 820, unit: "likes", numerator: 820, denominator: 12000, window: "post lifetime", scope: "visible post metric", observedAt: "2026-08-24" },
    popularityScope: "reviewed niche sample",
    sampleScope: "2026-08 reviewed top-post sample",
    observedAt: "2026-08-23",
    collectedAt: "2026-08-24",
    selectionRule: "explicit top-post sample rule",
    baselineScope: "2026-08 /new baseline",
    provenance: "approved browser observation",
    evidenceRefs: ["https://example.test/post"],
    baselineRefs: ["baseline:x:2026-08"],
    baselineSource: "baseline:x:2026-08",
    bodyComplete: true,
    reviewStatus: "reviewed",
    recordStatus: "ready",
    caveats: ["visible metric is a point-in-time observation"],
    lineage: [{ recordType: "account_review_ledger_row", id: "review:alice", relation: "supports" }],
    ...overrides,
  };
}

test("joins current account and source ledgers while preserving topic, focus, size, scopes, and citations", () => {
  const accounts = buildAccountReviewLedger([account()]);
  const sources = buildSourceEvidenceLedger([source()]);
  const result = buildLedgerAccountExampleTable({ accountLedger: accounts, sourceLedger: sources });
  const row = result.table.rows[0]!;

  assert.equal(result.kind, "ledger_account_example_table");
  assert.equal(result.readiness.status, "ready");
  assert.equal(row.accountId, "account:alice");
  assert.deepEqual(row.accountSizeSnapshot, { size: 12000, countType: "followers", provenance: "human-reviewed profile", asOf: "2026-08-23", collectedAt: "2026-08-24" });
  assert.deepEqual(row.topics, ["civic technology", "public institutions"]);
  assert.deepEqual(row.focus, ["decision-making under uncertainty"]);
  assert.equal(row.pool, "niche");
  assert.equal(row.popularityScope, "reviewed niche sample");
  assert.deepEqual(row.evidenceLinks, ["https://example.test/account", "https://example.test/post"]);
  assert.equal(row.bodyIncluded, false);
  assert.equal(result.bodyIncluded, false);
  assert.equal(result.winnerClaimsAllowed, false);
  assert.equal(JSON.stringify(result).includes("post body captured"), false);
});

test("uses only current corrections and keeps blocked source evidence visible", () => {
  const first = account();
  const correction = account({ id: "review:alice:correction", topics: ["public procurement"], supersedesId: first.id });
  const accounts = buildAccountReviewLedger([first, correction]);
  const sources = buildSourceEvidenceLedger([source({
    evidenceId: "evidence:alice:post-2",
    postId: "post:alice:2",
    evidenceRefs: null,
    recordStatus: "blocked",
    bodyComplete: false,
    metricSnapshot: "unknown",
  })]);
  const result = buildLedgerAccountExampleTable({
    accountLedger: accounts.rows.map((row) => JSON.stringify(row)).join("\n"),
    sourceLedger: sources.rows.map((row) => JSON.stringify(row)).join("\n"),
  });
  const row = result.table.rows[0]!;

  assert.deepEqual(row.topics, ["public procurement"]);
  assert.equal(row.readiness.status, "blocked");
  assert.equal(result.readiness.status, "blocked");
  assert.match(result.readiness.blockers.join("\n"), /evidence links are missing|metric snapshot is incomplete|body is not complete evidence/i);
});

test("falls back to bridge evidenceLinks when evidenceRefs is null or empty", () => {
  const accounts = buildAccountReviewLedger([account()]);
  const sources = buildSourceEvidenceLedger([source({ evidenceId: "evidence:alice:links", evidenceRefs: null, evidenceLinks: ["https://example.test/bridge-link"] })]);
  const result = buildLedgerAccountExampleTable({ accountLedger: accounts, sourceLedger: sources });
  assert.deepEqual(result.table.rows[0]?.evidenceLinks, ["https://example.test/account", "https://example.test/bridge-link", "https://example.test/post"]);
  assert.equal(result.table.rows[0]?.readiness.status, "ready");
});
