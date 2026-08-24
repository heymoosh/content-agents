import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildAccountExampleTable } from "./account-table.js";
import type { ComparisonReadinessInventory } from "./comparison-readiness.js";
import type { ReviewMetadataInput } from "./review-metadata.js";
import type { CatalogRow } from "./catalog.js";

const review: ReviewMetadataInput = {
  currentAccountKey: "linkedin:alice",
  platform: "linkedin",
  handle: "alice",
  stableAccountId: "account-alice",
  stableAccountIdStatus: "reviewed",
  topics: ["civic technology"],
  focus: ["decision making"],
  nicheLabel: "civic technology",
  researchPoolMembership: [{ pool: "niche", reason: "selected for the topic" }],
  popularityScope: "niche creators",
  sampleScope: "fixed top-post sample",
  baselineScope: "new-post baseline",
  baselineSource: "baseline-1",
  medium: "text",
  format: "short post",
  audienceSnapshot: { size: 12000, countType: "followers", provenance: "profile", asOf: "2026-08-20", collectedAt: "2026-08-21" },
  evidenceLinks: ["https://example.test/account"],
  reviewer: "muxin",
  reviewNote: "reviewed",
  disposition: "reviewed",
  reviewed_at: "2026-08-23T12:00:00Z",
  caveats: ["snapshot changes"],
};

const comparison: ComparisonReadinessInventory = {
  kind: "comparison_readiness_inventory",
  version: "comparison-readiness-v1",
  sideEffects: "none",
  summary: { ready: 1, blocked: 1, duplicateEvidence: 0 },
  rows: [
    {
      kind: "comparison_readiness_row", version: "comparison-readiness-v1", id: "z-example",
      evidenceId: "z-example", accountId: "account-alice", sourceId: "source-z", postId: "post-z",
      platform: "linkedin", medium: "text", format: "short post", pool: "niche",
      topics: ["should-not-win"], focus: ["should-not-win"], nicheLabel: "wrong-derived-value",
      popularityScope: "evidence popularity", sampleScope: "evidence sample", baselineScope: "evidence baseline",
      baselineSource: "baseline-1", evidenceLinks: ["https://example.test/post-z"], caveats: ["evidence caveat"], bodyIncluded: false,
      readiness: { status: "ready", blockers: [] },
    },
    {
      kind: "comparison_readiness_row", version: "comparison-readiness-v1", id: "a-example",
      evidenceId: "a-example", accountId: "missing-account", sourceId: "source-a", postId: "post-a",
      platform: "x", medium: "video", format: "short video", pool: null,
      topics: null, focus: null, nicheLabel: null, popularityScope: null, sampleScope: null,
      baselineScope: null, baselineSource: null, evidenceLinks: [], caveats: [], bodyIncluded: false,
      readiness: { status: "blocked", blockers: ["pool membership is missing"] },
    },
  ],
};
const catalog = [{
  key: "linkedin:alice", accountId: "account-alice", handle: "alice", creator: "Alice Example",
}] as unknown as CatalogRow[];

describe("account/example table", () => {
  test("joins reviewed account facts to examples without using example-derived account fields", () => {
    const first = buildAccountExampleTable({ reviews: [review], comparison, catalog });
    const second = buildAccountExampleTable({ reviews: [review], comparison: { ...comparison, rows: [...comparison.rows].reverse() }, catalog });
    assert.deepEqual(first, second);
    assert.deepEqual(first.rows[1], {
      kind: "account_example_row", version: "account-example-table-v1", id: "z-example",
      accountId: "account-alice", exampleId: "z-example", sourceId: "source-z", postId: "post-z",
      handle: "alice", creator: "Alice Example",
      accountSizeSnapshot: { size: 12000, countType: "followers", provenance: "profile", asOf: "2026-08-20", collectedAt: "2026-08-21" },
      topics: ["civic technology"], focus: ["decision making"], platform: "linkedin", medium: "text",
      format: "short post", pool: "niche", popularityScope: "evidence popularity", sampleScope: "evidence sample",
      baselineScope: "evidence baseline", baselineSource: "baseline-1",
      evidenceLinks: ["https://example.test/account", "https://example.test/post-z"], caveats: ["evidence caveat", "snapshot changes"],
      reviewStatus: "reviewed", readiness: { status: "ready", blockers: [] }, bodyIncluded: false,
    });
  });

  test("keeps an incomplete or unjoined example visible and blocked; it does not infer its pool", () => {
    const result = buildAccountExampleTable({ reviews: [review], comparison });
    const row = result.rows[0];
    assert.equal(row?.id, "a-example");
    assert.equal(row?.pool, null);
    assert.equal(row?.readiness.status, "blocked");
    assert.ok(row?.readiness.blockers.includes("account metadata is unreviewed"));
    assert.equal(JSON.stringify(result).includes("should-not-win"), false);
    assert.equal(JSON.stringify(result).includes("body"), true);
  });
});
