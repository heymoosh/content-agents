import assert from "node:assert/strict";
import test from "node:test";

import {
  bridgeReviewedEvidenceIntake,
  type ReviewedEvidenceIntakeReport,
} from "./reviewed-evidence-ledger-bridge.js";

function report(overrides: Partial<ReviewedEvidenceIntakeReport> = {}): ReviewedEvidenceIntakeReport {
  return {
    kind: "reviewed_evidence_intake",
    version: "reviewed-evidence-intake-v1",
    rows: {
      accounts: [],
      evidence: [],
      baselines: [],
    },
    summary: {
      accounts: { total: 0, ready: 0, blocked: 0, unmapped: 0, blockerCount: 0 },
      evidence: { total: 0, ready: 0, blocked: 0, unmapped: 0, blockerCount: 0 },
      baselines: { total: 0, ready: 0, blocked: 0, unmapped: 0, blockerCount: 0 },
      total: { total: 0, ready: 0, blocked: 0, unmapped: 0, blockerCount: 0 },
      blockerCounts: {},
    },
    readiness: { total: 0, ready: 0, blocked: 0, unmapped: 0, blockerCount: 0, status: "ready" },
    bodyIncluded: false,
    sideEffects: "none",
    ...overrides,
  };
}

test("projects account and source rows deterministically without persistence or body material", () => {
  const input = report({
    rows: {
      accounts: [{
        kind: "reviewed_account_intake_row", version: "reviewed-evidence-intake-v1", id: "account:x|alpha",
        currentAccountKey: "x|alpha", platform: "x", handle: "@alpha", creator: "Alpha",
        stableAccountId: "account-alpha", stableAccountIdStatus: "confirmed", topics: ["civic tech"], focus: ["decisions"],
        nicheLabel: "human inference", researchPoolMembership: [{ pool: "niche", reason: "explicit review" }],
        popularityScope: "public follower count", sampleScope: "reviewed posts", baselineScope: "same platform",
        baselineSource: "baseline://x", medium: "text", format: "text", audienceSnapshot: {
          size: 100, countType: "followers", provenance: "profile", asOf: "2026-08-20", collectedAt: "2026-08-21",
        },
        evidenceLinks: ["evidence://account-alpha"], evidenceRefs: ["evidence://account-alpha"], caveats: [],
        reviewer: "muxin", reviewedAt: "2026-08-21", disposition: "reviewed", dispositionReason: null,
        readiness: { status: "ready", blockers: [] }, bodyIncluded: false,
      }],
      evidence: [{
        kind: "reviewed_source_evidence_intake_row", version: "reviewed-evidence-intake-v1", id: "evidence-alpha",
        sourceId: "source-alpha", postId: "post-alpha", accountId: "account-alpha", platform: "x", medium: "text", format: "text",
        pool: "niche", membershipReason: "explicit review", audienceSizeSnapshot: {
          size: 100, countType: "followers", provenance: "profile", asOf: "2026-08-20", collectedAt: "2026-08-21",
        }, metricSnapshot: { metric: "likes", value: 5, unit: "count", numerator: 5, denominator: 100, window: "all time", scope: "post", observedAt: "2026-08-20" },
        comparisonClaimed: true, popularityScope: "public", sampleScope: "reviewed posts", baselineScope: "same platform", baselineSource: "baseline://x",
        evidenceLinks: ["evidence://post-alpha"], evidenceRefs: ["evidence://post-alpha"], bodyComplete: true, caveats: [], provenance: "manual review",
        observedAt: "2026-08-20", collectedAt: "2026-08-21", reviewStatus: "reviewed", status: "ready",
        lineage: [{ recordType: "account", id: "account-alpha", relation: "belongs-to" }], readiness: { status: "ready", blockers: [] }, bodyIncluded: false,
      }],
      baselines: [],
    },
  });

  const first = bridgeReviewedEvidenceIntake(input);
  const second = bridgeReviewedEvidenceIntake(input);
  assert.deepEqual(first, second);
  assert.equal(first.accountReviewInputs[0]?.id, "account:x|alpha");
  assert.equal(first.sourceEvidenceRecordInputs[0]?.evidenceId, "evidence-alpha");
  assert.equal(first.accountReviewInputs[0]?.disposition, "reviewed");
  assert.equal(first.sourceEvidenceRecordInputs[0]?.reviewStatus, "reviewed");
  assert.equal(first.accountReviewInputs[0]?.supersedesId, null);
  assert.equal(first.sourceEvidenceRecordInputs[0]?.bodyIncluded, false);
  assert.doesNotMatch(JSON.stringify(first), /creator body|private body|post text/i);
});

test("preserves pending, blocked, and unmapped rows plus every explicit blocker", () => {
  const input = report({
    rows: {
      accounts: [{
        kind: "reviewed_account_intake_row", version: "reviewed-evidence-intake-v1", id: "account:unmapped",
        currentAccountKey: "x|unknown", platform: "x", handle: null, creator: null, stableAccountId: "unknown", stableAccountIdStatus: "unmapped",
        topics: "unknown", focus: null, nicheLabel: "unknown", researchPoolMembership: "unknown", popularityScope: null, sampleScope: null,
        baselineScope: null, baselineSource: null, medium: null, format: null, audienceSnapshot: "unknown", evidenceLinks: null, evidenceRefs: null,
        caveats: "unknown", reviewer: null, reviewedAt: null, disposition: "unmapped", dispositionReason: "identity not confirmed",
        readiness: { status: "unmapped", blockers: ["identity not confirmed", "account reference is unmapped or ambiguous"] }, bodyIncluded: false,
      }],
      evidence: [{
        kind: "reviewed_source_evidence_intake_row", version: "reviewed-evidence-intake-v1", id: "evidence-pending", sourceId: null, postId: "post-pending",
        accountId: "x|unknown", platform: "x", medium: "text", format: "text", pool: null, membershipReason: null, audienceSizeSnapshot: null,
        metricSnapshot: null, comparisonClaimed: true, popularityScope: null, sampleScope: null, baselineScope: null, baselineSource: null,
        evidenceLinks: null, evidenceRefs: null, bodyComplete: false, caveats: "unknown", provenance: null, observedAt: null, collectedAt: null,
        reviewStatus: "pending", status: "blocked", lineage: "unknown", readiness: { status: "blocked", blockers: ["reviewStatus", "account reference is unmapped or ambiguous"] }, bodyIncluded: false,
      }],
      baselines: [],
    },
    readiness: { total: 2, ready: 0, blocked: 1, unmapped: 1, blockerCount: 4, status: "blocked" },
  });

  const bridged = bridgeReviewedEvidenceIntake(input);
  assert.equal(bridged.accountReviewInputs[0]?.disposition, "unmapped");
  assert.equal(bridged.sourceEvidenceRecordInputs[0]?.reviewStatus, "pending");
  assert.deepEqual(bridged.blockers, [
    { kind: "account", id: "account:unmapped", blockers: ["account reference is unmapped or ambiguous", "identity not confirmed"] },
    { kind: "evidence", id: "evidence-pending", blockers: ["account reference is unmapped or ambiguous", "reviewStatus"] },
  ]);
});

test("retains explicit baseline intake rows instead of reducing them to blocker labels", () => {
  const baseline = {
    id: "baseline-alpha",
    accountId: "account-alpha",
    platform: "x",
    source: "operator report",
    settledSampleDate: "2026-08-20",
    window: { start: "2026-08-13", end: "2026-08-19" },
    numerator: 12,
    denominator: 40,
    metric: "likes",
    sampleSize: 40,
    unavailableReason: null,
    evidenceLinks: ["evidence://baseline-alpha"],
    evidenceRefs: ["evidence://baseline-alpha"],
    caveats: [],
    reviewer: "muxin",
    reviewedAt: "2026-08-21",
    reviewStatus: "reviewed",
    readiness: { status: "ready", blockers: [] },
  } as const;
  const bridged = bridgeReviewedEvidenceIntake(report({
    rows: { accounts: [], evidence: [], baselines: [baseline] },
  }));

  assert.deepEqual(bridged.baselineIntakeRows, [baseline]);
  assert.deepEqual(bridged.blockers, []);
});

test("rejects forbidden fields instead of dropping them", () => {
  const bad = report({ rows: { accounts: [{ body: "secret" } as never], evidence: [], baselines: [] } });
  assert.throws(() => bridgeReviewedEvidenceIntake(bad), /body.*unsupported|body.*not accepted/i);
  const badNested = report({ rows: { accounts: [], evidence: [{ metricSnapshot: { model: "gpt" } } as never], baselines: [] } });
  assert.throws(() => bridgeReviewedEvidenceIntake(badNested), /model.*unsupported|model.*not accepted/i);
});

test("preserves unknown disposition, identity status, and evidence-link distinction", () => {
  const bridged = bridgeReviewedEvidenceIntake(report({
    rows: {
      accounts: [{
        kind: "reviewed_account_intake_row", version: "reviewed-evidence-intake-v1", id: "account:pending",
        currentAccountKey: "x|pending", platform: "x", handle: null, creator: null,
        stableAccountId: "unknown", stableAccountIdStatus: "not-yet-reviewed", topics: null, focus: null,
        nicheLabel: null, researchPoolMembership: null, popularityScope: null, sampleScope: null,
        baselineScope: null, baselineSource: null, medium: null, format: null, audienceSnapshot: null,
        evidenceLinks: null, evidenceRefs: null, caveats: null, reviewer: null, reviewedAt: null,
        disposition: null, dispositionReason: null, readiness: { status: "blocked", blockers: ["disposition"] }, bodyIncluded: false,
      }],
      evidence: [{
        kind: "reviewed_source_evidence_intake_row", version: "reviewed-evidence-intake-v1", id: "evidence:links-only",
        sourceId: "source-1", postId: "post-1", accountId: "account-1", platform: "x", medium: "text", format: "short",
        pool: null, membershipReason: null, audienceSizeSnapshot: null, metricSnapshot: null, comparisonClaimed: false,
        popularityScope: null, sampleScope: null, baselineScope: null, baselineSource: null,
        evidenceLinks: ["link://only"], evidenceRefs: null, bodyComplete: false, caveats: null, provenance: null,
        observedAt: null, collectedAt: null, reviewStatus: "pending", status: "blocked", lineage: null,
        readiness: { status: "blocked", blockers: ["evidenceRefs"] }, bodyIncluded: false,
      }],
      baselines: [],
    },
  }));

  assert.equal(bridged.accountReviewInputs[0]?.stableAccountIdStatus, null);
  assert.equal(bridged.accountReviewInputs[0]?.disposition, null);
  assert.equal(bridged.sourceEvidenceRecordInputs[0]?.evidenceRefs, null);
  assert.deepEqual(bridged.sourceEvidenceRecordInputs[0]?.evidenceLinks, ["link://only"]);
});
