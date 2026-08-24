import assert from "node:assert/strict";
import test from "node:test";
import { buildAccountReviewLedger, type AccountReviewInput } from "./account-review-ledger.js";
import {
  adaptReviewedAccountRow,
  buildReviewedAccountRegistry,
  REVIEWED_ACCOUNT_REGISTRY_VERSION,
} from "./reviewed-account-registry.js";

function account(overrides: Partial<AccountReviewInput> = {}): AccountReviewInput {
  return {
    id: "review:alice",
    currentAccountKey: "linkedin|alice",
    platform: "linkedin",
    handle: "@alice",
    creator: "Alice Example",
    stableAccountId: "account:alice",
    stableAccountIdStatus: "confirmed",
    topics: ["civic technology", "public institutions"],
    focus: ["decision-making under uncertainty"],
    nicheLabel: "civic technology",
    researchPoolMembership: [
      { pool: "broad", reason: "explicit broad-platform comparison account" },
      { pool: "format", reason: "explicit short-text format account" },
      { pool: "niche", reason: "explicit civic technology account" },
    ],
    popularityScope: "reviewed niche and broad account sample",
    sampleScope: "2026-08 reviewed top-post sample",
    baselineScope: "2026-08 /new baseline",
    baselineSource: "baseline:linkedin:2026-08",
    medium: "text",
    format: "short text post",
    audienceSnapshot: {
      size: 12000,
      countType: "followers",
      provenance: "human-reviewed profile snapshot",
      asOf: "2026-08-23",
      collectedAt: "2026-08-24",
    },
    evidenceRefs: ["evidence:account:alice"],
    baselineRefs: ["baseline:linkedin:2026-08"],
    caveats: ["Audience size is a point-in-time snapshot."],
    reviewer: "muxin",
    reviewNote: "Human-reviewed account metadata.",
    disposition: "reviewed",
    dispositionReason: "Explicitly reviewed.",
    reviewed_at: "2026-08-24T12:00:00.000Z",
    supersedesId: null,
    ...overrides,
  };
}

test("reads exactly one current row per append-only identity and preserves explicit metadata", () => {
  const root = account();
  const correction = account({
    id: "review:alice:correction",
    topics: ["public procurement"],
    reviewNote: "Corrected topic label.",
    supersedesId: root.id,
  });
  const ledger = buildAccountReviewLedger([correction, root]);
  const first = buildReviewedAccountRegistry(ledger);
  const second = buildReviewedAccountRegistry(buildAccountReviewLedger([root, correction]));
  const row = first.rows[0]!;

  assert.deepEqual(first, second);
  assert.equal(first.version, REVIEWED_ACCOUNT_REGISTRY_VERSION);
  assert.equal(first.rows.length, 1);
  assert.equal(row.id, correction.id);
  assert.deepEqual(row.topics, ["public procurement"]);
  assert.equal(row.accountId, "account:alice");
  assert.equal(row.bodyIncluded, false);
  assert.equal(first.summary.ready, 1);
  assert.equal(first.readiness.status, "ready");
  assert.equal(JSON.stringify(first).includes("body"), true, "bodyIncluded is an explicit false safety fact");
  assert.equal(JSON.stringify(first).includes("creator body"), false);
});

test("keeps incomplete and unmapped rows visible and blocked", () => {
  const registry = buildReviewedAccountRegistry(buildAccountReviewLedger([account({
    id: "review:unmapped",
    currentAccountKey: "x|unknown",
    platform: "x",
    handle: null,
    creator: null,
    stableAccountId: null,
    stableAccountIdStatus: "unmapped",
    topics: "unknown",
    focus: null,
    nicheLabel: "unknown",
    researchPoolMembership: null,
    audienceSnapshot: "unknown",
    evidenceRefs: null,
    baselineRefs: null,
    reviewer: null,
    reviewed_at: null,
    disposition: "unmapped",
    dispositionReason: "Identity could not be confirmed.",
  })]));

  assert.equal(registry.rows.length, 1);
  assert.equal(registry.rows[0]?.disposition, "unmapped");
  assert.equal(registry.rows[0]?.readiness.status, "blocked");
  assert.ok(registry.readiness.blockers.some((blocker) => blocker.includes("stableAccountId")));
  assert.equal(registry.summary.unmapped, 1);
  assert.equal(registry.summary.blocked, 1);
});

test("adapts one registry row into explicit metadata and matrix facts without inventing pool membership", () => {
  const row = buildReviewedAccountRegistry(buildAccountReviewLedger([account()])).rows[0]!;
  const adapters = adaptReviewedAccountRow(row);

  assert.deepEqual(adapters.metadata.topics, ["civic technology", "public institutions"]);
  assert.deepEqual(adapters.metadata.focus, ["decision-making under uncertainty"]);
  assert.equal(adapters.metadata.reviewNote, "Human-reviewed account metadata.");
  assert.deepEqual(adapters.matrix.reviewedPoolMembership, [
    { pool: "broad", reason: "explicit broad-platform comparison account" },
    { pool: "format", reason: "explicit short-text format account" },
    { pool: "niche", reason: "explicit civic technology account" },
  ]);
  assert.equal(adapters.matrix.reviewStatus, "reviewed");

  const blocked = buildReviewedAccountRegistry(buildAccountReviewLedger([account({
    id: "review:no-pool",
    researchPoolMembership: null,
    disposition: "pending",
    reviewed_at: null,
  })])).rows[0]!;
  assert.deepEqual(adaptReviewedAccountRow(blocked).matrix.reviewedPoolMembership, null);
});

test("revalidates caller-shaped ledger objects instead of trusting their computed fields", () => {
  const ledger = buildAccountReviewLedger([account()]);
  const forged = {
    ...ledger,
    rows: [{ ...ledger.rows[0], readiness: { status: "ready", blockers: [] }, bodyIncluded: true }],
  } as never;

  assert.throws(() => buildReviewedAccountRegistry(forged), /bodyIncluded must be false/);
});
