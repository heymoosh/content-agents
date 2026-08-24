import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSourceEvidence, buildSourceEvidenceRows } from "./source-evidence.js";

type FixtureOverrides = Record<string, unknown>;

function corpus(overrides: FixtureOverrides = {}): Record<string, unknown> {
  return {
    id: "fixture-post-b",
    platform: "x",
    handle: "@fixture-account",
    creator: "Fixture Account",
    url: "https://example.test/posts/b",
    posted_at: "2026-08-20",
    collected_at: "2026-08-21T00:00:00.000Z",
    body: "Creator body must never be emitted.",
    media: { form: "text-only", body_is_complete: true },
    sample: { role: "winner", listing: "top", window: "month", rank: 2 },
    ...overrides,
  };
}

function analysis(overrides: FixtureOverrides = {}): Record<string, unknown> {
  return {
    source_id: "fixture-post-b",
    account_id: "fixture-account-b",
    evidence_location: "body:lines-1-3",
    pool_memberships: [{ pool: "niche", reason: "Fixture topic pool" }],
    metric: {
      name: "views",
      numerator: 2500,
      denominator: 500,
      window: "2026-08-01/2026-08-31",
      scope: "account-baseline",
    },
    selection_rule: "Explicit fixture listing selection rule",
    caveats: ["Fixture-only caveat"],
    ...overrides,
  };
}

test("builds one explicit admissible row without creator body text", () => {
  const rows = buildSourceEvidenceRows([corpus()], [analysis()]);

  assert.deepEqual(rows, [{
    sourceId: "fixture-post-b",
    accountId: "fixture-account-b",
    handle: "@fixture-account",
    creator: "Fixture Account",
    platform: "x",
    url: "https://example.test/posts/b",
    observedAt: "2026-08-20",
    collectedAt: "2026-08-21T00:00:00.000Z",
    sourceRole: "winner",
    listing: "top",
    window: "month",
    rank: 2,
    bodyComplete: true,
    evidenceLocation: "body:lines-1-3",
    metric: {
      name: "views",
      numerator: 2500,
      denominator: 500,
      window: "2026-08-01/2026-08-31",
      scope: "account-baseline",
    },
    pool: "niche",
    membershipReason: "Fixture topic pool",
    selectionRule: "Explicit fixture listing selection rule",
    caveats: ["Fixture-only caveat"],
    readiness: { status: "ready", reason: "Explicit source evidence fields are present." },
  }]);
  assert.equal("body" in rows[0]!, false);
  assert.equal(JSON.stringify(rows).includes("Creator body must never be emitted."), false);
});

test("retains an incomplete-body row but blocks it", () => {
  const [row] = buildSourceEvidenceRows(
    [corpus({ media: { form: "image", body_is_complete: false } })],
    [analysis()],
  );

  assert.equal(row?.bodyComplete, false);
  assert.deepEqual(row?.readiness, {
    status: "blocked",
    reason: "Blocked: body is incomplete; the source substance cannot be treated as complete evidence.",
  });
  assert.equal("body" in row!, false);
});

test("retains a blocked row when pool membership is missing instead of inferring from niche", () => {
  const [row] = buildSourceEvidenceRows(
    [corpus({ niche: "fixture-niche" })],
    [analysis({ pool_memberships: [] })],
  );

  assert.equal(row?.pool, null);
  assert.equal(row?.membershipReason, null);
  assert.deepEqual(row?.readiness, {
    status: "blocked",
    reason: "Blocked: no explicit supported pool membership; niche, broad, or format was not inferred.",
  });
});

test("retains a blocked row when the exact evidence location is missing", () => {
  const [row] = buildSourceEvidenceRows(
    [corpus()],
    [analysis({ evidence_location: undefined })],
  );

  assert.equal(row?.pool, "niche");
  assert.equal(row?.evidenceLocation, null);
  assert.deepEqual(row?.readiness, {
    status: "blocked",
    reason: "Blocked: missing explicit evidence location; no locator was inferred from the post body.",
  });
});

test("retains a blocked row when metric scope is missing rather than inferring popularity scope", () => {
  const [row] = buildSourceEvidenceRows(
    [corpus()],
    [analysis({ metric: {
      name: "views",
      numerator: 2500,
      denominator: 500,
      window: "2026-08-01/2026-08-31",
    }, popularity_scope: "platform-wide" })],
  );

  assert.equal(row?.metric.scope, null);
  assert.deepEqual(row?.readiness, {
    status: "blocked",
    reason: "Blocked: missing explicit metric scope; popularity scope was not inferred from listing or rank.",
  });
});

test("orders rows deterministically independent of input order", () => {
  const firstCorpus = [
    corpus({ id: "fixture-post-z", url: "https://example.test/posts/z" }),
    corpus({ id: "fixture-post-a", url: "https://example.test/posts/a" }),
  ];
  const firstAnalyses = [
    analysis({ source_id: "fixture-post-z", pool_memberships: [{ pool: "format", reason: "Fixture format pool" }] }),
    analysis({ source_id: "fixture-post-a", pool_memberships: [{ pool: "broad", reason: "Fixture broad pool" }] }),
  ];
  const first = buildSourceEvidence(firstCorpus, firstAnalyses);
  const second = buildSourceEvidence([...firstCorpus].reverse(), [...firstAnalyses].reverse());

  assert.deepEqual(first, second);
  assert.deepEqual(first.rows.map((row) => `${row.sourceId}/${row.pool}`), [
    "fixture-post-a/broad",
    "fixture-post-z/format",
  ]);
});

test("emits one row per explicitly reasoned pool membership", () => {
  const rows = buildSourceEvidenceRows([corpus()], [analysis({
    pool_memberships: [
      { pool: "niche", reason: "Fixture topic pool" },
      { pool: "format", reason: "Fixture format pool" },
    ],
  })]);

  assert.deepEqual(rows.map((row) => [row.pool, row.membershipReason]), [
    ["format", "Fixture format pool"],
    ["niche", "Fixture topic pool"],
  ]);
  assert.ok(rows.every((row) => row.readiness.status === "ready"));
});
