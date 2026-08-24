import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildComparisonReadiness } from "./comparison-readiness.js";
import type { ReviewMetadataInput } from "./review-metadata.js";
import type { SourceEvidenceRow } from "./source-evidence.js";

const review: ReviewMetadataInput = {
  currentAccountKey: "linkedin:alice",
  platform: "linkedin",
  handle: "alice",
  stableAccountId: "account-alice",
  stableAccountIdStatus: "reviewed",
  topics: ["human inference", "civic technology"],
  focus: ["how people make decisions"],
  nicheLabel: "civic technology",
  researchPoolMembership: [{ pool: "niche", reason: "Muxin selected this creator for the civic-technology question." }],
  popularityScope: "niche creators on LinkedIn",
  sampleScope: "top 10 posts in the fixed snapshot",
  baselineScope: "LinkedIn /new baseline",
  baselineSource: "baseline-1",
  medium: "text",
  format: "short post",
  audienceSnapshot: { size: 12000, countType: "followers", provenance: "profile snapshot", asOf: "2026-08-20", collectedAt: "2026-08-21" },
  evidenceLinks: ["source-post-1"],
  reviewer: "muxin",
  reviewNote: "reviewed",
  disposition: "reviewed",
  reviewed_at: "2026-08-23T12:00:00Z",
  caveats: ["public follower count is a snapshot"],
};

const evidence = (overrides: Partial<SourceEvidenceRow> = {}): SourceEvidenceRow => ({
  id: "source-post-1", sourceId: "source-1", postId: "post-1", accountId: "account-alice",
  platform: "linkedin", medium: "text", format: "short post", pool: "niche",
  membershipReason: "Muxin selected this creator for the civic-technology question.",
  audienceSizeSnapshot: { size: 12000, countType: "followers", observedAt: "2026-08-20", collectedAt: "2026-08-21", evidenceSource: "profile-1" },
  metricSnapshot: { metric: "reactions", value: 240, unit: "count", numerator: 240, denominator: 12000, window: "lifetime", scope: "post", observedAt: "2026-08-21" },
  popularityScope: "niche creators on LinkedIn", sampleScope: "top 10 posts in the fixed snapshot",
  baselineScope: "LinkedIn /new baseline", evidenceLinks: ["post-1"], baselineSource: "baseline-1",
  bodyComplete: true, caveats: ["public reactions are not impressions"], provenance: "post snapshot",
  observedAt: "2026-08-21", collectedAt: "2026-08-21", reviewStatus: "reviewed", status: "ready",
  lineage: [{ recordType: "source", id: "source-1", relation: "evidences" }], handle: "alice", creator: "Alice",
  url: "https://example.test/post-1", sourceRole: "niche creator", listing: "fixed snapshot", window: "lifetime",
  rank: 1, evidenceLocation: "public post", metric: { name: "reactions", numerator: 240, denominator: null, window: "lifetime", scope: "post" },
  selectionRule: "fixed snapshot", readiness: { status: "ready", reason: "complete", blockingFields: [] },
  ...overrides,
});

describe("comparison readiness", () => {
  test("joins reviewed account metadata to a ready source/post row without body text", () => {
    const result = buildComparisonReadiness({ reviews: [review], evidence: [evidence()] });
    assert.deepEqual(result.summary, { ready: 1, blocked: 0, duplicateEvidence: 0 });
    assert.equal(result.rows[0]?.readiness.status, "ready");
    assert.equal(Object.hasOwn(result.rows[0] ?? {}, "body"), false);
    assert.equal(JSON.stringify(result).includes("creator body"), false);
  });

  test("keeps blocked evidence visible when metadata or scopes are incomplete", () => {
    const result = buildComparisonReadiness({
      reviews: [{ ...review, disposition: "pending", reviewed_at: null }],
      evidence: [evidence({ pool: null, metricSnapshot: "unknown" })],
    });
    assert.equal(result.summary.blocked, 1);
    assert.deepEqual(result.rows[0]?.readiness.blockers, [
      "account metadata reviewed_at is incomplete", "account metadata is not reviewed",
      "pool membership is missing", "metric snapshot is incomplete",
    ]);
  });

  test("does not infer a pool from a review row or a rank", () => {
    const result = buildComparisonReadiness({ reviews: [review], evidence: [evidence({ pool: null, rank: 1 })] });
    assert.equal(result.rows[0]?.readiness.status, "blocked");
    assert.ok(result.rows[0]?.readiness.blockers.includes("pool membership is missing"));
  });

  test("requires an authoritative source or post id", () => {
    const result = buildComparisonReadiness({ reviews: [review], evidence: [evidence({ sourceId: null, postId: null })] });
    assert.ok(result.rows[0]?.readiness.blockers.includes("source or post id is missing"));
  });

  test("sorts rows deterministically and reports duplicate evidence ids", () => {
    const result = buildComparisonReadiness({ reviews: [review], evidence: [evidence({ id: "z" }), evidence({ id: "a" }), evidence({ id: "a" })] });
    assert.deepEqual(result.rows.map((row) => row.id), ["a", "a", "z"]);
    assert.equal(result.summary.duplicateEvidence, 1);
    assert.equal(result.rows.filter((row) => row.id === "a").every((row) => row.readiness.status === "blocked"), true);
  });
});
