import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildReviewStaging,
  REVIEW_STAGING_APPROVED_KEYS,
  REVIEW_STAGING_COHORT_DIGEST,
  type ReviewStagingInput,
} from "./review-staging.js";

function projection(overrides: Partial<ReviewStagingInput> = {}): ReviewStagingInput {
  return {
    accountMetadataRows: REVIEW_STAGING_APPROVED_KEYS.map((currentAccountKey, index) => {
      const [platform, handle] = currentAccountKey.split("|");
      return { currentAccountKey, platform, handle, evidenceCount: index + 1, topics: null, focus: "unknown", evidenceLinks: null, caveats: null, provenance: null };
    }),
    ...overrides,
  };
}

test("projects exactly the approved cohort in deterministic order", () => {
  const first = buildReviewStaging(projection());
  const second = buildReviewStaging({ ...projection(), accountMetadataRows: [...projection().accountMetadataRows].reverse() });
  assert.equal(first.rows.length, 65);
  assert.equal(first.source.cohortDigest, REVIEW_STAGING_COHORT_DIGEST);
  assert.deepEqual(first.rows.map((row) => row.accountKey), second.rows.map((row) => row.accountKey));
  assert.equal(first.bodyIncluded, false);
  assert.equal(first.winnerClaimsAllowed, false);
  assert.equal(first.canonicalWritesAllowed, false);
  assert.deepEqual(first.rows[0]?.poolDisposition, { niche: null, broad: null, format: null });
  assert.deepEqual(first.rows[0]?.requiredMetadataFields.includes("audienceSnapshot"), true);
});

test("excludes zero-evidence accounts while retaining explicit null and unknown values", () => {
  const input = projection({ accountMetadataRows: [...projection().accountMetadataRows, { currentAccountKey: "pinterest|zero-evidence", platform: "pinterest", handle: "zero-evidence", evidenceCount: 0 }] });
  const result = buildReviewStaging(input);
  assert.equal(result.rows.some((row) => row.accountKey === "pinterest|zero-evidence"), false);
  assert.equal(result.rows[0]?.metadata.topics, null);
  assert.equal(result.rows[0]?.metadata.focus, "unknown");
});

test("fails closed on count, digest, outside-cohort, body, and unsupported metadata drift", () => {
  assert.throws(() => buildReviewStaging({ ...projection(), accountMetadataRows: projection().accountMetadataRows.slice(1) }), /count mismatch/);
  const base = projection().accountMetadataRows;
  const first = base[0] as Record<string, unknown>;
  const changed = base.map((row, index) => index === 0 ? { ...first, currentAccountKey: "x|outside" } : row);
  assert.throws(() => buildReviewStaging({ ...projection(), accountMetadataRows: changed }), /digest mismatch/);
  assert.throws(() => buildReviewStaging({ ...projection(), accountMetadataRows: [{ ...first, body: "PRIVATE BODY" }, ...base.slice(1)] }), /body/);
  assert.throws(() => buildReviewStaging({ ...projection(), accountMetadataRows: [{ ...first, ranking: 1 }, ...base.slice(1)] }), /unsupported/);
});
