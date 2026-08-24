import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildEvidenceReadiness, type EvidenceReadinessInput } from "./evidence-readiness.js";
import type { PatternCatalog } from "./catalog.js";
import type { ReviewMetadataInput } from "./review-metadata.js";

const POST_BODY = "SECRET POST BODY THAT MUST NEVER REACH THE ARTIFACT";

const review: ReviewMetadataInput = {
  currentAccountKey: "x|alice",
  platform: "x",
  handle: "alice",
  creator: "Alice",
  stableAccountId: "account-a",
  stableAccountIdStatus: "reviewed",
  topics: ["civic technology"],
  focus: ["inference"],
  nicheLabel: "civic technology",
  researchPoolMembership: [{ pool: "niche", reason: "Explicit review selection." }],
  popularityScope: "niche creators",
  sampleScope: "fixed sample",
  baselineScope: "recorded baseline",
  baselineSource: "baseline-a",
  medium: "text",
  format: "text-only",
  audienceSnapshot: {
    size: 12000,
    countType: "followers",
    provenance: "profile snapshot",
    asOf: "2026-08-20",
    collectedAt: "2026-08-21",
  },
  evidenceLinks: ["post-a"],
  reviewer: "muxin",
  reviewNote: "Reviewed fixture.",
  disposition: "reviewed",
  reviewed_at: "2026-08-23T12:00:00Z",
  caveats: ["Public follower count is a snapshot."],
};

function catalogRow(accountId: string, pool: string): PatternCatalog["rows"][number] {
  return {
    key: accountId === "account-a" ? "x|alice" : "x|zara",
    accountId,
    accountIdStatus: "derived",
    platform: "x",
    handle: accountId === "account-a" ? "alice" : "zara",
    creator: accountId === "account-a" ? "Alice" : "Zara",
    niche: "civic technology",
    sourceKind: "handle",
    configured: true,
    collected: true,
    audience: { size: 12000, countType: "followers", provenance: "profile snapshot", asOf: "2026-08-20" },
    topics: ["civic technology"],
    focus: ["inference"],
    researchPools: [pool],
    formats: ["text-only"],
    mediaForms: ["text-only"],
    popularityScopes: ["niche creators"],
    sampleScopes: ["fixed sample"],
    baselineSources: ["baseline-a"],
    evidenceCount: 1,
    admissibleCount: 1,
    bodyCompleteCount: 1,
    bodyIncompleteCount: 0,
    lastCollectedAt: "2026-08-21",
    lastAnalyzedAt: "2026-08-22",
    caveats: [],
  };
}

function catalog(rows = [catalogRow("account-a", "niche"), catalogRow("account-z", "broad")]): PatternCatalog {
  return {
    rows,
    summary: {
      configuredTargets: rows.length,
      collectedSources: rows.length,
      configuredAndCollected: rows.length,
      configuredButUncollected: 0,
      evidenceCount: rows.length,
      admissibleCount: rows.length,
      bodyCompleteCount: rows.length,
      bodyIncompleteCount: 0,
    },
  };
}

function post(id: string, handle: string): Record<string, unknown> {
  return {
    id,
    platform: "x",
    handle,
    creator: handle === "alice" ? "Alice" : "Zara",
    niche: "civic technology",
    url: `https://example.test/${id}`,
    posted_at: "2026-08-20",
    collected_at: "2026-08-21",
    kind: "text",
    body: POST_BODY,
    transcript_source: null,
    body_is_complete: true,
    metrics: { views: 1000, likes: 100, comments: 10, shares: 5, followers: 12000 },
  };
}

function analysis(
  evidenceId: string,
  postId: string,
  sourceId: string,
  accountId: string,
  pool: string | null = "niche",
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    id: evidenceId,
    post_id: postId,
    source_id: sourceId,
    account_id: accountId,
    platform: "x",
    medium: "text",
    format: "text-only",
    audience_size_snapshot: {
      size: 12000,
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
      denominator: 12000,
      window: "lifetime",
      scope: "post",
      observed_at: "2026-08-21",
    },
    popularity_scope: "niche creators",
    sample_scope: "fixed sample",
    baseline_scope: "recorded baseline",
    evidence_links: [postId],
    baseline_source: "baseline-a",
    caveats: [],
    provenance: "fixture source snapshot",
    observed_at: "2026-08-20",
    collected_at: "2026-08-21",
    review_status: "reviewed",
    status: "ready",
    lineage: [{ record_type: "source", id: sourceId, relation: "evidences" }],
    evidence_location: "public post",
    selection_rule: "fixed sample",
    body_is_complete: true,
  };
  if (pool !== null) result.pool_memberships = [{ pool, reason: "Explicit source selection." }];
  return result;
}

function input(overrides: Partial<EvidenceReadinessInput> = {}): EvidenceReadinessInput {
  return {
    catalog: catalog(),
    corpus: [post("post-a", "alice")],
    analyses: [analysis("evidence-a", "post-a", "source-a", "account-a")],
    reviews: [review],
    ...overrides,
  };
}

describe("evidence readiness", () => {
  test("reaches ready only when a reviewed account and admissible evidence join", () => {
    const result = buildEvidenceReadiness(input({
      catalog: catalog([catalogRow("account-a", "niche")]),
    }));

    assert.equal(result.comparisonReadiness.summary.ready, 1);
    assert.equal(result.comparisonReadiness.summary.blocked, 0);
    assert.deepEqual(result.operatorReadiness.summary, { total: 1, ready: 1, blocked: 0, readinessRate: 1 });
    assert.deepEqual(result.comparisonReadiness.rows[0]?.readiness, { status: "ready", blockers: [] });
  });

  test("keeps comparison and operator readiness blocked when explicit reviews are empty", () => {
    const result = buildEvidenceReadiness(input({ reviews: [] }));

    assert.equal(result.comparisonReadiness.summary.ready, 0);
    assert.equal(result.comparisonReadiness.summary.blocked, 1);
    assert.ok(result.comparisonReadiness.rows[0]?.readiness.blockers.includes("account metadata is unreviewed"));
    assert.deepEqual(result.operatorReadiness.summary, { total: 1, ready: 0, blocked: 1, readinessRate: 0 });
    assert.equal(result.sideEffects, "none");
  });

  test("is deterministic, orders rows, and propagates duplicate evidence ids", () => {
    const first = buildEvidenceReadiness(input({
      catalog: catalog(),
      corpus: [post("post-z", "zara"), post("post-a", "alice")],
      analyses: [
        analysis("duplicate-evidence", "post-z", "source-z", "account-a"),
        analysis("duplicate-evidence", "post-a", "source-a", "account-a"),
      ],
    }));
    const second = buildEvidenceReadiness(input({
      catalog: catalog([catalogRow("account-z", "broad"), catalogRow("account-a", "niche")]),
      corpus: [post("post-a", "alice"), post("post-z", "zara")],
      analyses: [
        analysis("duplicate-evidence", "post-a", "source-a", "account-a"),
        analysis("duplicate-evidence", "post-z", "source-z", "account-a"),
      ],
    }));

    assert.deepEqual(first, second);
    assert.deepEqual(first.sourceEvidence.rows.map((row) => row.sourceId), ["source-a", "source-z"]);
    assert.equal(first.sourceEvidence.rows.length, 2);
    assert.equal(first.comparisonReadiness.summary.duplicateEvidence, 1);
    assert.equal(first.comparisonReadiness.rows.every((row) => row.readiness.blockers.includes("duplicate evidence id")), true);
    assert.ok(first.operatorReadiness.gaps.includes("duplicate evidence id"));
  });

  test("does not infer source pools from the catalog and preserves unknown evidence", () => {
    const result = buildEvidenceReadiness(input({
      corpus: [post("post-a", "alice")],
      analyses: [
        {
          ...analysis("evidence-a", "post-a", "source-a", "account-a", null),
          metric_snapshot: "unknown",
        },
      ],
    }));

    assert.equal(result.poolEvidence.rows[0]?.pool, "niche");
    assert.equal(result.sourceEvidence.rows[0]?.pool, null);
    assert.equal(result.sourceEvidence.rows[0]?.metricSnapshot, "unknown");
    assert.ok(result.comparisonReadiness.rows[0]?.readiness.blockers.includes("pool membership is missing"));
  });

  test("does not leak post body text and leaves inputs unchanged", () => {
    const supplied = input();
    const before = JSON.stringify(supplied);
    const result = buildEvidenceReadiness(supplied);
    const serialized = JSON.stringify(result);

    assert.equal(serialized.includes(POST_BODY), false);
    assert.equal(Object.hasOwn(result, "body"), false);
    assert.equal(JSON.stringify(supplied), before);
    assert.equal(result.sideEffects, "none");
    assert.equal(result.comparisonReadiness.sideEffects, "none");
    assert.equal(result.operatorReadiness.sideEffects, "none");
  });
});
