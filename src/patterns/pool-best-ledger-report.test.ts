import assert from "node:assert/strict";
import test from "node:test";
import { buildAccountReviewLedger, type AccountReviewInput } from "./account-review-ledger.js";
import { buildSourceEvidenceLedger } from "./source-evidence-ledger.js";
import { buildPoolBestLedgerReport } from "./pool-best-ledger-report.js";
import type { AccountBaseline } from "./types.js";

function account(name: string): AccountReviewInput {
  return {
    id: `review:${name}`,
    currentAccountKey: `linkedin|${name}`,
    platform: "linkedin",
    handle: `@${name}`,
    creator: `${name} creator`,
    stableAccountId: `account:${name}`,
    stableAccountIdStatus: "confirmed",
    topics: ["civic technology"],
    focus: ["decision-making under uncertainty"],
    nicheLabel: "civic technology",
    researchPoolMembership: [{ pool: "niche", reason: "explicit civic technology membership" }],
    popularityScope: "reviewed niche sample",
    sampleScope: "fixed reviewed source-post set",
    baselineScope: "2026-08 /new baseline",
    baselineSource: "settled baseline ledger",
    medium: "text",
    format: "short text post",
    audienceSnapshot: { size: 10000, countType: "followers", provenance: "reviewed profile", asOf: "2026-08-23", collectedAt: "2026-08-24" },
    evidenceRefs: [`evidence:account:${name}`],
    baselineRefs: [`baseline:${name}`],
    caveats: [],
    reviewer: "muxin",
    reviewNote: "reviewed",
    disposition: "reviewed",
    dispositionReason: "explicitly reviewed",
    reviewed_at: "2026-08-24T12:00:00Z",
    supersedesId: null,
  };
}

function source(name: string, value: number): Record<string, unknown> {
  return {
    evidenceId: `evidence:${name}:post`,
    sourceId: `source:${name}`,
    postId: `post:${name}`,
    accountId: `account:${name}`,
    platform: "linkedin",
    url: `https://example.test/${name}`,
    locator: "post page",
    sourceRole: "reviewed example",
    evidenceLocation: "post page",
    comparisonClaimed: true,
    pool: "niche",
    membershipReason: "explicit niche source-post membership",
    nicheLabel: "civic technology",
    topics: ["civic technology"],
    focus: ["decision-making under uncertainty"],
    medium: "text",
    format: "short text post",
    audienceSizeSnapshot: { size: 10000, countType: "followers", observedAt: "2026-08-23", collectedAt: "2026-08-24", evidenceSource: "profile" },
    metricSnapshot: { metric: "views", value, unit: "views", numerator: value, denominator: 10000, window: "post lifetime", scope: "visible metric", observedAt: "2026-08-24" },
    popularityScope: "reviewed niche sample",
    sampleScope: "fixed reviewed source-post set",
    observedAt: "2026-08-23",
    collectedAt: "2026-08-24",
    selectionRule: "fixed reviewed source-post set",
    baselineScope: "2026-08 /new baseline",
    provenance: "reviewed browser observation",
    evidenceRefs: [`https://example.test/${name}`],
    baselineRefs: [`baseline:${name}`],
    baselineSource: "settled baseline ledger",
    bodyComplete: true,
    reviewStatus: "reviewed",
    recordStatus: "ready",
    caveats: [],
    lineage: [{ recordType: "account_review_ledger_row", id: `review:${name}`, relation: "supports" }],
  };
}

function baseline(name: string): AccountBaseline {
  return {
    platform: "linkedin",
    handle: `@${name}`,
    metric: "views",
    terms: ["views"],
    median: 100,
    sample_size: 10,
    window_start: "2026-08-01",
    window_end: "2026-08-20",
    scores: [100, 100, 100],
    followers: 10000,
    method: "settled /new sample",
    collected_at: "2026-08-21T00:00:00Z",
  };
}

test("feeds durable account/source ledgers into the existing best comparison and names the winner only when comparable", () => {
  const report = buildPoolBestLedgerReport({
    accountLedger: buildAccountReviewLedger([account("alice"), account("bob")]),
    sourceLedger: buildSourceEvidenceLedger([source("alice", 300), source("bob", 100)]),
    baselines: [baseline("alice"), baseline("bob")],
    minimumComparableCandidates: 2,
  });

  assert.equal(report.readiness.status, "ready");
  assert.equal(report.comparison.summary.winnerGroups, 1);
  assert.deepEqual(report.comparison.groups[0]?.bestExampleIds, ["evidence:alice:post"]);
  assert.equal(report.comparison.groups[0]?.bestCreators[0]?.creator, "alice creator");
  assert.equal(report.bodyIncluded, false);
  assert.equal(JSON.stringify(report).includes("creator body"), false);
});

test("keeps incomplete durable facts blocked instead of silently falling back to catalog or ephemeral fields", () => {
  const report = buildPoolBestLedgerReport({
    accountLedger: buildAccountReviewLedger([account("alice"), account("bob")]),
    sourceLedger: buildSourceEvidenceLedger([source("alice", 300), source("bob", 100)]),
    baselines: [baseline("alice")],
    minimumComparableCandidates: 2,
  });

  assert.equal(report.comparison.summary.winnerGroups, 0);
  assert.ok(report.comparison.groups.every((group) => group.status === "blocked"));
  assert.ok(report.readiness.blockers.some((blocker) => blocker.includes("recorded baseline is missing")));
});

test("preserves the explicit pool boundary from the source ledger", () => {
  const report = buildPoolBestLedgerReport({
    accountLedger: buildAccountReviewLedger([account("alice"), account("bob")]),
    sourceLedger: buildSourceEvidenceLedger([source("alice", 300), { ...source("bob", 100), pool: null }]),
    baselines: [baseline("alice"), baseline("bob")],
    minimumComparableCandidates: 2,
  });

  assert.equal(report.comparison.summary.winnerGroups, 0);
  assert.ok(report.comparison.candidates.some((candidate) => candidate.readiness.blockers.includes("pool membership is missing")));
});
