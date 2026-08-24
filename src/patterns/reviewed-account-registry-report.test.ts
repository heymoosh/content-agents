import assert from "node:assert/strict";
import test from "node:test";
import { buildAccountReviewLedger, type AccountReviewInput } from "./account-review-ledger.js";
import { buildSourceEvidenceLedger } from "./source-evidence-ledger.js";
import type { PatternCatalog } from "./catalog.js";
import { buildReviewedAccountRegistryReport } from "./reviewed-account-registry-report.js";

function account(overrides: Partial<AccountReviewInput> = {}): AccountReviewInput {
  return {
    id: "review:alice",
    currentAccountKey: "linkedin|alice",
    platform: "linkedin",
    handle: "@alice",
    creator: "Alice Example",
    stableAccountId: "account:alice",
    stableAccountIdStatus: "confirmed",
    topics: ["civic technology"],
    focus: ["decision-making under uncertainty"],
    nicheLabel: "civic technology",
    researchPoolMembership: [
      { pool: "broad", reason: "explicit broad-platform account" },
      { pool: "format", reason: "explicit short-text format account" },
      { pool: "niche", reason: "explicit civic technology account" },
    ],
    popularityScope: "reviewed niche and broad account sample",
    sampleScope: "2026-08 reviewed sample",
    baselineScope: "2026-08 /new baseline",
    baselineSource: "baseline:linkedin:2026-08",
    medium: "text",
    format: "short text post",
    audienceSnapshot: { size: 12000, countType: "followers", provenance: "reviewed profile", asOf: "2026-08-23", collectedAt: "2026-08-24" },
    evidenceRefs: ["evidence:account:alice"],
    baselineRefs: ["baseline:linkedin:2026-08"],
    caveats: ["point-in-time audience snapshot"],
    reviewer: "muxin",
    reviewNote: "reviewed",
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
    platform: "linkedin",
    url: "https://example.test/post",
    locator: "post page",
    sourceRole: "reviewed example",
    evidenceLocation: "post page",
    comparisonClaimed: true,
    pool: "niche",
    membershipReason: "explicit civic technology sample",
    nicheLabel: "civic technology",
    topics: ["civic technology"],
    focus: ["decision-making under uncertainty"],
    medium: "text",
    format: "short text post",
    audienceSizeSnapshot: { size: 12000, countType: "followers", observedAt: "2026-08-23", collectedAt: "2026-08-24", evidenceSource: "profile" },
    metricSnapshot: { metric: "likes", value: 820, unit: "likes", numerator: 820, denominator: 12000, window: "post lifetime", scope: "visible metric", observedAt: "2026-08-24" },
    popularityScope: "reviewed niche sample",
    sampleScope: "2026-08 reviewed sample",
    observedAt: "2026-08-23",
    collectedAt: "2026-08-24",
    selectionRule: "explicit reviewed sample",
    baselineScope: "2026-08 /new baseline",
    provenance: "reviewed browser observation",
    evidenceRefs: ["https://example.test/post"],
    baselineRefs: ["baseline:linkedin:2026-08"],
    baselineSource: "baseline:linkedin:2026-08",
    bodyComplete: true,
    reviewStatus: "reviewed",
    recordStatus: "ready",
    caveats: [],
    lineage: [{ recordType: "account_review_ledger_row", id: "review:alice", relation: "supports" }],
    ...overrides,
  };
}

const catalog: PatternCatalog = {
  rows: [{
    key: "linkedin|alice",
    accountId: "linkedin|alice",
    accountIdStatus: "derived",
    platform: "linkedin",
    handle: "@alice",
    creator: "Alice Example",
    niche: "civic technology",
    sourceKind: "handle",
    configured: true,
    collected: true,
    audience: { size: 12000, countType: "followers", provenance: "catalog context", asOf: "2026-08-23" },
    topics: ["catalog topic that must not become review evidence"],
    focus: ["catalog focus"],
    researchPools: ["niche", "broad", "format"],
    formats: ["text"],
    mediaForms: ["text-only"],
    popularityScopes: ["catalog scope"],
    sampleScopes: ["catalog sample"],
    baselineSources: ["catalog baseline"],
    evidenceCount: 1,
    admissibleCount: 1,
    bodyCompleteCount: 1,
    bodyIncompleteCount: 0,
    lastCollectedAt: "2026-08-24",
    lastAnalyzedAt: "2026-08-24",
    caveats: [],
  }],
  summary: {
    configuredTargets: 1,
    collectedSources: 1,
    configuredAndCollected: 1,
    configuredButUncollected: 0,
    evidenceCount: 1,
    admissibleCount: 1,
    bodyCompleteCount: 1,
    bodyIncompleteCount: 0,
  },
};

test("feeds one durable registry into the table and three explicit pool matrix cells", () => {
  const result = buildReviewedAccountRegistryReport({
    accountLedger: buildAccountReviewLedger([account()]),
    sourceLedger: buildSourceEvidenceLedger([source()]),
    catalog,
    baselines: ["linkedin|alice"],
  });

  assert.equal(result.registry.rows.length, 1);
  assert.equal(result.accountExamples.table.rows.length, 1);
  assert.equal(result.platformPoolMatrix.targets.length, 3);
  assert.deepEqual(result.platformPoolMatrix.targets.map((row) => row.researchPool), ["broad", "format", "niche"]);
  assert.equal(result.platformPoolMatrix.summary.reviewed, 3);
  assert.equal(result.platformPoolMatrix.summary.baselineReady, 3);
  assert.equal(result.winnerClaimsAllowed, false);
  assert.equal(result.bodyIncluded, false);
  assert.equal(JSON.stringify(result).includes("catalog topic that must not become review evidence"), false);
});

test("keeps catalog pool labels from silently assigning an unreviewed account", () => {
  const result = buildReviewedAccountRegistryReport({
    accountLedger: buildAccountReviewLedger([account({
      researchPoolMembership: null,
      disposition: "pending",
      reviewed_at: null,
    })]),
    sourceLedger: buildSourceEvidenceLedger([source()]),
    catalog,
  });

  assert.equal(result.platformPoolMatrix.targets.length, 0);
  assert.equal(result.platformPoolMatrix.blockedTargets.length, 1);
  assert.match(result.platformPoolMatrix.blockedTargets[0]!.blockers.join("; "), /reviewed research pool membership absent/);
  assert.equal(result.readiness.status, "blocked");
  assert.ok(result.readiness.blockers.some((blocker) => blocker.includes("registry:")));
});

test("preserves source-ledger blockers and does not turn the bridge into a winner report", () => {
  const result = buildReviewedAccountRegistryReport({
    accountLedger: buildAccountReviewLedger([account()]),
    sourceLedger: buildSourceEvidenceLedger([source({
      metricSnapshot: "unknown",
      recordStatus: "blocked",
      bodyComplete: false,
      evidenceRefs: null,
    })]),
    catalog,
    baselines: ["linkedin|alice"],
  });

  assert.equal(result.winnerClaimsAllowed, false);
  assert.equal(result.accountExamples.readiness.status, "blocked");
  assert.ok(result.readiness.blockers.some((blocker) => /metric snapshot is incomplete|evidence links are missing|body is not complete evidence/i.test(blocker)));
});
