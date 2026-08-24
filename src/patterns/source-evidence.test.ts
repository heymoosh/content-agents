import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSourceEvidence, buildSourceEvidenceRows } from "./source-evidence.js";

type Fixture = Record<string, unknown>;

function post(overrides: Fixture = {}): Fixture {
  return {
    id: "post-b",
    source_id: "source-b",
    post_id: "post-b",
    platform: "x",
    handle: "@fixture-account",
    creator: "Fixture Account",
    url: "https://example.test/posts/b",
    posted_at: "2026-08-20",
    collected_at: "2026-08-21T00:00:00.000Z",
    body: "Creator body must never be emitted.",
    medium: "text",
    format: "short-post",
    audience_size_snapshot: {
      size: 500,
      count_type: "followers",
      observed_at: "2026-08-20",
      collected_at: "2026-08-21T00:00:00.000Z",
      evidence_source: "profile snapshot",
    },
    metric_snapshot: {
      metric: "views",
      value: 2500,
      unit: "views",
      numerator: 2500,
      denominator: 500,
      window: "2026-08-01/2026-08-31",
      scope: "account-baseline",
      observed_at: "2026-08-20",
    },
    popularity_scope: "fixture-account",
    sample_scope: "explicit fixture listing",
    baseline_scope: "same-account posts in the observation window",
    baseline_source: "fixture baseline ledger",
    evidence_links: ["fixture://evidence/z", "fixture://evidence/a"],
    provenance: "fixture collector and reviewed source record",
    body_is_complete: true,
    caveats: ["Fixture-only caveat", "Another caveat"],
    review_status: "reviewed",
    status: "current",
    lineage: [
      { record_type: "source", id: "source-b", relation: "observes" },
      { record_type: "account", id: "account-b", relation: "belongs_to" },
    ],
    sample: { role: "winner", listing: "top", window: "month", rank: 2 },
    ...overrides,
  };
}

function analysis(overrides: Fixture = {}): Fixture {
  return {
    id: "evidence-b",
    source_id: "source-b",
    post_id: "post-b",
    account_id: "account-b",
    pool_memberships: [{ pool: "niche", reason: "Fixture topic pool" }],
    evidence_location: "body:lines-1-3",
    selection_rule: "Explicit fixture listing selection rule",
    ...overrides,
  };
}

test("normalizes the explicit source_post_evidence handoff without creator body text", () => {
  const [row] = buildSourceEvidenceRows([post()], [analysis()]);

  assert.equal(row?.id, "evidence-b");
  assert.equal(row?.sourceId, "source-b");
  assert.equal(row?.postId, "post-b");
  assert.equal(row?.accountId, "account-b");
  assert.equal(row?.platform, "x");
  assert.equal(row?.medium, "text");
  assert.equal(row?.format, "short-post");
  assert.deepEqual(row?.audienceSizeSnapshot, {
    size: 500,
    countType: "followers",
    observedAt: "2026-08-20",
    collectedAt: "2026-08-21T00:00:00.000Z",
    evidenceSource: "profile snapshot",
  });
  assert.deepEqual(row?.metricSnapshot, {
    metric: "views",
    value: 2500,
    unit: "views",
    numerator: 2500,
    denominator: 500,
    window: "2026-08-01/2026-08-31",
    scope: "account-baseline",
    observedAt: "2026-08-20",
  });
  assert.equal(row?.popularityScope, "fixture-account");
  assert.equal(row?.sampleScope, "explicit fixture listing");
  assert.equal(row?.baselineScope, "same-account posts in the observation window");
  assert.deepEqual(row?.evidenceLinks, ["fixture://evidence/a", "fixture://evidence/z"]);
  assert.equal(row?.baselineSource, "fixture baseline ledger");
  assert.equal(row?.bodyComplete, true);
  assert.deepEqual(row?.caveats, ["Another caveat", "Fixture-only caveat"]);
  assert.equal(row?.provenance, "fixture collector and reviewed source record");
  assert.equal(row?.observedAt, "2026-08-20");
  assert.equal(row?.collectedAt, "2026-08-21T00:00:00.000Z");
  assert.equal(row?.reviewStatus, "reviewed");
  assert.equal(row?.status, "current");
  assert.deepEqual(row?.lineage, [
    { recordType: "account", id: "account-b", relation: "belongs_to" },
    { recordType: "source", id: "source-b", relation: "observes" },
  ]);
  assert.deepEqual(row?.readiness.status, "ready");
  assert.deepEqual(row?.readiness.blockingFields, []);
  assert.equal("body" in (row ?? {}), false);
  assert.equal(JSON.stringify(row).includes("Creator body must never be emitted."), false);
});

test("retains explicit unknown values and blocks comparison readiness instead of inferring them", () => {
  const [row] = buildSourceEvidenceRows([
    post({
      niche: "fixture-niche",
      media: { form: "text-only" },
      sample: { listing: "top", rank: 1 },
      popularity_scope: undefined,
      sample_scope: undefined,
      baseline_scope: undefined,
      baseline_source: undefined,
      audience_size_snapshot: "unknown",
      metric_snapshot: {
        metric: "views",
        value: "unknown",
        unit: "views",
        numerator: "unknown",
        denominator: "unknown",
        window: "unknown",
        scope: "unknown",
        observed_at: "unknown",
      },
      evidence_links: "unknown",
      provenance: "unknown",
      caveats: "unknown",
      review_status: "pending",
      status: "draft",
      lineage: "unknown",
    }),
  ], [analysis({ pool_memberships: [] })]);

  assert.equal(row?.pool, null);
  assert.equal(row?.membershipReason, null);
  assert.equal(row?.popularityScope, null);
  assert.equal(row?.sampleScope, null);
  assert.equal(row?.baselineScope, null);
  assert.equal(row?.baselineSource, null);
  assert.equal(row?.audienceSizeSnapshot, "unknown");
  const metricSnapshot = row?.metricSnapshot;
  assert.ok(metricSnapshot && metricSnapshot !== "unknown");
  assert.equal(metricSnapshot.value, "unknown");
  assert.equal(row?.evidenceLinks, "unknown");
  assert.equal(row?.provenance, "unknown");
  assert.equal(row?.caveats, "unknown");
  assert.equal(row?.lineage, "unknown");
  assert.deepEqual(row?.readiness.blockingFields, [
    "pool",
    "audienceSizeSnapshot",
    "metricSnapshot.value",
    "metricSnapshot.numerator",
    "metricSnapshot.denominator",
    "metricSnapshot.window",
    "metricSnapshot.scope",
    "metricSnapshot.observedAt",
    "popularityScope",
    "sampleScope",
    "baselineScope",
    "baselineSource",
    "provenance",
    "evidenceLinks",
    "caveats",
    "reviewStatus",
    "lineage",
  ]);
  assert.equal(row?.readiness.status, "blocked");
  assert.equal("body" in (row ?? {}), false);
  assert.equal(JSON.stringify(row).includes("Creator body must never be emitted."), false);
});

test("blocks an incomplete body while keeping the evidence row and never leaking its body", () => {
  const [row] = buildSourceEvidenceRows([post({ body_is_complete: false })], [analysis()]);

  assert.equal(row?.bodyComplete, false);
  assert.deepEqual(row?.readiness.blockingFields, ["bodyComplete"]);
  assert.match(row?.readiness.reason ?? "", /body is incomplete/i);
  assert.equal("body" in (row ?? {}), false);
});

test("emits one deterministic row per explicitly reasoned pool membership", () => {
  const firstPosts = [
    post({ id: "post-z", source_id: "source-z", post_id: "post-z", url: "https://example.test/posts/z" }),
    post({ id: "post-a", source_id: "source-a", post_id: "post-a", url: "https://example.test/posts/a" }),
  ];
  const firstAnalyses = [
    analysis({ id: "evidence-z", source_id: "source-z", post_id: "post-z", pool_memberships: [
      { pool: "format", reason: "Fixture format pool" },
    ] }),
    analysis({ id: "evidence-a", source_id: "source-a", post_id: "post-a", pool_memberships: [
      { pool: "broad", reason: "Fixture broad pool" },
      { pool: "niche", reason: "Fixture niche pool" },
    ] }),
  ];
  const first = buildSourceEvidence(firstPosts, firstAnalyses);
  const second = buildSourceEvidence([...firstPosts].reverse(), [...firstAnalyses].reverse());

  assert.deepEqual(first, second);
  assert.deepEqual(first.rows.map((row) => `${row.sourceId}/${row.pool}`), [
    "source-a/broad",
    "source-a/niche",
    "source-z/format",
  ]);
  assert.deepEqual(first.summary, {
    ready: 3,
    blocked: 0,
    pools: { niche: 1, broad: 1, format: 1 },
  });
});
