import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReviewSession, renderReviewSessionMarkdown } from "./review-session.js";
import type { ReviewQueueBatchArtifact } from "./review-batch.js";

const batch = {
  kind: "account_review_queue_batch",
  version: "account-review-batch-v1",
  rows: [{
    currentAccountKey: "reddit|r/test",
    platform: "reddit",
    handle: "r/test",
    creator: null,
    evidenceCount: 2,
    status: "blocked",
    stableIdPresent: false,
    missingRequiredOverlayFields: ["topics", "format"],
    comparisonEvidenceReady: false,
    nextReviewAction: "complete missing metadata: topics, format",
  }],
  totalRows: 1,
  page: { number: 1, size: 1, total: 1, totalPages: 1, hasPrevious: false, hasNext: false },
  statusCounts: { reviewed: 0, pending: 0, blocked: 1, unmapped: 0 },
  nextReviewActions: ["complete missing metadata: topics, format"],
  humanReviewRequired: true,
  pending: false,
  humanReviewRequiredRows: 1,
  pendingRows: 0,
  note: "descriptive",
  sideEffects: "none",
} satisfies ReviewQueueBatchArtifact;

test("preserves blocked queue facts and exposes a human action", () => {
  const session = buildReviewSession({
    batch,
    reviewInput: { supplied: true, status: "valid", reviewStatus: "unreviewed", rowCount: 1, validRowCount: 1, invalidRowCount: 0, validationErrors: [] },
    dataStatus: { reviewStatus: "unreviewed", reviewBoundary: "human metadata not yet supplied" },
  });
  assert.deepEqual(session.summary, { selectedRows: 1, humanReviewRequiredRows: 1, blockedRows: 1, pendingRows: 0, unmappedRows: 0 });
  assert.equal(session.rows[0].humanAction, "resolve the explicit blocker before completing review");
  assert.deepEqual(session.rows[0].requiredFields, ["topics", "format"]);
  assert.equal(session.rows[0].bodyIncluded, false);
  assert.equal(session.sideEffects, "none");
});

test("renders a body-free handoff", () => {
  const output = renderReviewSessionMarkdown(buildReviewSession({ batch }));
  assert.match(output, /Human review session/);
  assert.match(output, /not supplied/);
  assert.doesNotMatch(output, /creator post body/);
});
