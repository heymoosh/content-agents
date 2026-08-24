import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReviewedEvidenceIntake,
  REVIEWED_EVIDENCE_INTAKE_VERSION,
  type ReviewedEvidenceIntakeInput,
} from "./reviewed-evidence-intake.js";

const BODY = "PRIVATE CREATOR BODY MUST NEVER LEAK";

function account(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    currentAccountKey: "x|alpha",
    platform: "x",
    handle: "@alpha",
    stableAccountId: "account-alpha",
    stableAccountIdStatus: "reviewed",
    topics: ["civic technology"],
    focus: ["public systems"],
    nicheLabel: "civic technology",
    researchPoolMembership: [
      { pool: "broad", reason: "explicit broad-platform review" },
      { pool: "format", reason: "explicit short-post format review" },
      { pool: "niche", reason: "explicit civic technology review" },
    ],
    popularityScope: "reviewed account sample",
    sampleScope: "settled source listing",
    baselineScope: "same-account settled window",
    baselineSource: "baseline:alpha",
    medium: "text",
    format: "short-post",
    audienceSnapshot: {
      size: 1200,
      countType: "followers",
      provenance: "profile snapshot",
      asOf: "2026-08-20",
      collectedAt: "2026-08-21",
    },
    evidenceLinks: ["evidence://account/alpha"],
    reviewer: "muxin",
    reviewed_at: "2026-08-23",
    disposition: "reviewed",
    caveats: [],
    ...overrides,
  };
}

function evidence(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "evidence-alpha",
    sourceId: "source-alpha",
    postId: "post-alpha",
    accountId: "account-alpha",
    platform: "x",
    medium: "text",
    format: "short-post",
    pool: "niche",
    membershipReason: "explicit civic technology review",
    evidenceLinks: ["evidence://post/alpha"],
    provenance: "reviewed source record",
    observedAt: "2026-08-20",
    collectedAt: "2026-08-21",
    bodyComplete: true,
    caveats: [],
    reviewStatus: "reviewed",
    status: "current",
    lineage: [{ recordType: "source", id: "source-alpha", relation: "observes" }],
    audienceSizeSnapshot: {
      size: 1200,
      countType: "followers",
      observedAt: "2026-08-20",
      collectedAt: "2026-08-21",
      evidenceSource: "profile snapshot",
    },
    metricSnapshot: {
      metric: "engagement",
      value: 18,
      unit: "interactions",
      numerator: 18,
      denominator: 1200,
      window: "2026-08-01/2026-08-20",
      scope: "same-account settled window",
      observedAt: "2026-08-20",
    },
    ...overrides,
  };
}

function baseline(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "baseline-alpha",
    accountId: "account-alpha",
    platform: "x",
    source: "settled /new sample ledger",
    settledSampleDate: "2026-08-22",
    window: { start: "2026-08-01", end: "2026-08-20" },
    numerator: 18,
    denominator: 1200,
    metric: "engagement",
    reviewer: "muxin",
    reviewedAt: "2026-08-23",
    caveats: [],
    ...overrides,
  };
}

function input(overrides: Partial<ReviewedEvidenceIntakeInput> = {}): ReviewedEvidenceIntakeInput {
  return {
    accountMetadataRows: [account()],
    sourceEvidenceRows: [evidence()],
    baselineSamples: [baseline()],
    ...overrides,
  };
}

test("normalizes reviewed account, evidence, and baseline rows into explicit groups", () => {
  const report = buildReviewedEvidenceIntake(input());

  assert.equal(report.kind, "reviewed_evidence_intake");
  assert.equal(report.version, REVIEWED_EVIDENCE_INTAKE_VERSION);
  assert.equal(report.rows.accounts.length, 1);
  assert.equal(report.rows.evidence.length, 1);
  assert.equal(report.rows.baselines.length, 1);
  assert.deepEqual(report.rows.accounts[0]?.researchPoolMembership.map((row) => row.pool), ["broad", "format", "niche"]);
  assert.equal(report.rows.accounts[0]?.readiness.status, "ready");
  assert.equal(report.rows.evidence[0]?.readiness.status, "ready");
  assert.equal(report.rows.baselines[0]?.readiness.status, "ready");
  assert.deepEqual(report.readiness, { status: "ready", ready: 3, blocked: 0, unmapped: 0, blockerCount: 0 });
  assert.equal(report.bodyIncluded, false);
  assert.equal(report.sideEffects, "none");
});

test("keeps explicit unmapped, unreviewed, incomplete, and mismatched rows blocked", () => {
  const report = buildReviewedEvidenceIntake(input({
    accountMetadataRows: [
      account({
        currentAccountKey: "x|unmapped",
        stableAccountId: null,
        disposition: "unmapped",
        unmappedReason: "the account identity could not be confirmed",
        topics: null,
      }),
      account({ currentAccountKey: "x|pending", stableAccountId: "account-pending", disposition: "pending", reviewer: null }),
    ],
    sourceEvidenceRows: [evidence({ id: "evidence-pending", accountId: "account-pending", reviewStatus: "pending" })],
    baselineSamples: [baseline({ id: "baseline-missing", accountId: "account-pending", denominator: null, unavailableReason: null })],
  }));

  assert.equal(report.rows.accounts.find((row) => row.currentAccountKey === "x|unmapped")?.readiness.status, "unmapped");
  assert.equal(report.rows.accounts.find((row) => row.currentAccountKey === "x|pending")?.readiness.status, "blocked");
  assert.equal(report.rows.evidence[0]?.readiness.status, "blocked");
  assert.equal(report.rows.baselines[0]?.readiness.status, "blocked");
  assert.ok(report.rows.evidence[0]?.readiness.blockers.some((blocker) => /review/i.test(blocker)));
  assert.ok(report.rows.baselines[0]?.readiness.blockers.includes("denominator"));
  assert.equal(report.readiness.unmapped, 1);
  assert.equal(report.readiness.blocked, 3);
  assert.ok(report.readiness.blockerCount > 0);
});

test("keeps niche, broad, and format as distinct explicit memberships", () => {
  const report = buildReviewedEvidenceIntake(input());
  const memberships = report.rows.accounts[0]?.researchPoolMembership ?? [];
  assert.deepEqual(memberships, [
    { pool: "broad", reason: "explicit broad-platform review" },
    { pool: "format", reason: "explicit short-post format review" },
    { pool: "niche", reason: "explicit civic technology review" },
  ]);
  assert.equal(report.rows.evidence[0]?.pool, "niche");
  assert.equal(report.rows.evidence[0]?.pool === "broad", false);
  assert.equal(report.rows.evidence[0]?.pool === "format", false);
});

test("blocks incomplete comparison metrics and baselines without inventing values", () => {
  const report = buildReviewedEvidenceIntake(input({
    sourceEvidenceRows: [evidence({ metricSnapshot: { metric: "engagement", value: 18, unit: "interactions", numerator: 18, denominator: null, window: null, scope: "same-account", observedAt: "2026-08-20" } })],
    baselineSamples: [baseline({ numerator: null, denominator: null, unavailableReason: "route did not expose a settled denominator" })],
  }));
  const metric = report.rows.evidence[0]?.metricSnapshot;
  assert.equal(metric?.denominator, null);
  assert.ok(report.rows.evidence[0]?.readiness.blockers.includes("metricSnapshot.denominator"));
  assert.equal(report.rows.baselines[0]?.numerator, null);
  assert.equal(report.rows.baselines[0]?.denominator, null);
  assert.equal(report.rows.baselines[0]?.unavailableReason, "route did not expose a settled denominator");
  assert.equal(report.rows.baselines[0]?.readiness.status, "ready");
});

test("sorts deterministically, does not mutate input, and never emits body or winner fields", () => {
  const original = input({
    accountMetadataRows: [account({ currentAccountKey: "x|zeta" }), account({ currentAccountKey: "x|alpha" })],
    sourceEvidenceRows: [evidence({ id: "z-evidence" }), evidence({ id: "a-evidence" })],
    baselineSamples: [baseline({ id: "z-baseline" }), baseline({ id: "a-baseline" })],
  });
  const snapshot = structuredClone(original);
  const poisoned = structuredClone(original) as ReviewedEvidenceIntakeInput & Record<string, unknown>;
  (poisoned.accountMetadataRows[0] as Record<string, unknown>).body = BODY;
  (poisoned.sourceEvidenceRows[0] as Record<string, unknown>).winner = "do not select";
  const report = buildReviewedEvidenceIntake(original);
  const reversed = buildReviewedEvidenceIntake({
    accountMetadataRows: [...original.accountMetadataRows].reverse(),
    sourceEvidenceRows: [...original.sourceEvidenceRows].reverse(),
    baselineSamples: [...original.baselineSamples].reverse(),
  });
  assert.deepEqual(original, snapshot);
  assert.deepEqual(report, reversed);
  assert.deepEqual(report.rows.accounts.map((row) => row.currentAccountKey), ["x|alpha", "x|zeta"]);
  assert.deepEqual(report.rows.evidence.map((row) => row.id), ["a-evidence", "a-evidence", "z-evidence", "z-evidence"]);
  assert.deepEqual(report.rows.baselines.map((row) => row.id), ["a-baseline", "a-baseline", "z-baseline", "z-baseline"]);
  assert.doesNotMatch(JSON.stringify(report), /PRIVATE CREATOR BODY|"winner"|"model"|"ranking"/i);
  assert.throws(() => buildReviewedEvidenceIntake(poisoned), /body|unsupported/i);
});
