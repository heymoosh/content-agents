import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildReviewQueueBatch,
  renderReviewQueueBatchJson,
  renderReviewQueueBatchMarkdown,
} from "./review-batch.js";
import type { ReviewQueueArtifact } from "./review-queue.js";

function queue(): ReviewQueueArtifact {
  const rows = [
    "alpha|one",
    "alpha|two",
    "alpha|three",
    "alpha|four",
  ].map((currentAccountKey, index) => ({
    currentAccountKey,
    platform: "fixture",
    handle: `@${currentAccountKey.split("|")[1]}`,
    creator: "Fixture creator",
    evidenceCount: index,
    status: index === 0 ? "reviewed" as const : index === 1 ? "pending" as const : "blocked" as const,
    stableIdPresent: false,
    missingRequiredOverlayFields: [],
    comparisonEvidenceReady: false,
    nextReviewAction: index === 1 ? "review pending account metadata" : "review blocked account metadata",
  }));
  return {
    kind: "account_review_queue",
    version: "account-review-queue-v1",
    rows,
    summary: {
      total: rows.length,
      evidenceCount: 6,
      comparisonEvidenceReady: 0,
      statusCounts: { reviewed: 1, pending: 1, blocked: 2, unmapped: 0 },
    },
    sideEffects: "none",
  };
}

test("paginates only unreviewed rows with page metadata, counts, and human-review fields", () => {
  const batch = buildReviewQueueBatch({ queue: queue(), pageSize: 2, pageNumber: 2 });

  assert.deepEqual(batch.rows.map((row) => row.currentAccountKey), ["alpha|two"]);
  assert.equal(batch.totalRows, 3);
  assert.deepEqual(batch.page, { number: 2, size: 2, total: 1, totalPages: 2, hasPrevious: true, hasNext: false });
  assert.deepEqual(batch.statusCounts, { reviewed: 0, pending: 1, blocked: 0, unmapped: 0 });
  assert.deepEqual(batch.nextReviewActions, ["review pending account metadata"]);
  assert.equal(batch.humanReviewRequired, true);
  assert.equal(batch.pending, true);
  assert.equal(batch.humanReviewRequiredRows, 1);
  assert.equal(batch.pendingRows, 1);
  assert.match(batch.note, /descriptive/i);
});

test("renders deterministic JSON and Markdown without mutating or adding content", () => {
  const first = buildReviewQueueBatch({ queue: queue(), pageSize: 2, pageNumber: 1 });
  const second = buildReviewQueueBatch({ queue: queue(), pageSize: 2, pageNumber: 1 });
  assert.deepEqual(first, second);
  assert.match(renderReviewQueueBatchJson(first), /"humanReviewRequired": true/);
  assert.match(renderReviewQueueBatchMarkdown(first), /# Account review queue batch/);
  assert.match(renderReviewQueueBatchMarkdown(first), /descriptive-only/i);
  assert.doesNotMatch(renderReviewQueueBatchJson(first), /bodyIncluded|winnerSelected|published/i);
});

test("refuses invalid positive integer pagination inputs", () => {
  for (const input of [
    { pageSize: 0, pageNumber: 1 },
    { pageSize: 2, pageNumber: 0 },
    { pageSize: -1, pageNumber: 1 },
    { pageSize: 1.5, pageNumber: 1 },
    { pageSize: 1, pageNumber: Number.NaN },
  ]) {
    assert.throws(() => buildReviewQueueBatch({ queue: queue(), ...input }), /positive integer/i);
  }
  assert.throws(() => buildReviewQueueBatch({ queue: queue(), pageSize: 2, pageNumber: 3 }), /exceed total pages/i);
});

test("allows empty page one but refuses later pages", () => {
  const emptyQueue = { ...queue(), rows: [] };
  const first = buildReviewQueueBatch({ queue: emptyQueue, pageSize: 2, pageNumber: 1 });
  assert.deepEqual(first.page, { number: 1, size: 2, total: 0, totalPages: 0, hasPrevious: false, hasNext: false });
  assert.equal(first.humanReviewRequired, false);
  assert.throws(() => buildReviewQueueBatch({ queue: emptyQueue, pageSize: 2, pageNumber: 2 }), /exceed total pages/i);
});
