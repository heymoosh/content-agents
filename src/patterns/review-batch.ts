import type { OverlayCoverageStatus } from "./overlay-coverage.js";
import type { ReviewQueueArtifact, ReviewQueueRow } from "./review-queue.js";

export const ACCOUNT_REVIEW_BATCH_VERSION = "account-review-batch-v1" as const;

export interface ReviewQueueBatchInput {
  readonly queue: ReviewQueueArtifact;
  /** One-based page size. */
  readonly pageSize: number;
  /** One-based page number. */
  readonly pageNumber: number;
}

export interface ReviewQueueBatchPage {
  readonly number: number;
  readonly size: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
}

export interface ReviewQueueBatchArtifact {
  readonly kind: "account_review_queue_batch";
  readonly version: typeof ACCOUNT_REVIEW_BATCH_VERSION;
  /** Rows selected from the unreviewed portion of the queue for this page. */
  readonly rows: ReviewQueueRow[];
  /** Total number of rows whose queue status is not reviewed. */
  readonly totalRows: number;
  readonly page: ReviewQueueBatchPage;
  readonly statusCounts: Record<OverlayCoverageStatus, number>;
  readonly nextReviewActions: string[];
  readonly humanReviewRequired: boolean;
  readonly pending: boolean;
  readonly humanReviewRequiredRows: number;
  readonly pendingRows: number;
  /** Describes the projection for a human; it does not direct or perform an action. */
  readonly note: string;
  readonly sideEffects: "none";
}

function compareValues(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${field} must be a positive integer`);
}

function emptyStatusCounts(): Record<OverlayCoverageStatus, number> {
  return { reviewed: 0, pending: 0, blocked: 0, unmapped: 0 };
}

function cell(value: string | number | boolean | null): string {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

/**
 * Purely projects one page of unreviewed account rows. It does not update the queue or infer,
 * rank, select, publish, or persist anything.
 */
export function buildReviewQueueBatch(input: ReviewQueueBatchInput): ReviewQueueBatchArtifact {
  assertPositiveInteger(input.pageSize, "pageSize");
  assertPositiveInteger(input.pageNumber, "pageNumber");

  const unreviewedRows = input.queue.rows
    .filter((row) => row.status !== "reviewed")
    .sort((left, right) => compareValues(left.currentAccountKey, right.currentAccountKey));
  const totalRows = unreviewedRows.length;
  const totalPages = Math.ceil(totalRows / input.pageSize);
  const maxPage = Math.max(totalPages, 1);
  if (input.pageNumber > maxPage) throw new Error("pageNumber must not exceed total pages");
  const start = (input.pageNumber - 1) * input.pageSize;
  const rows = unreviewedRows.slice(start, start + input.pageSize);
  const statusCounts = emptyStatusCounts();
  const nextReviewActions = new Set<string>();
  let pendingRows = 0;

  for (const row of rows) {
    statusCounts[row.status] += 1;
    nextReviewActions.add(row.nextReviewAction);
    if (row.status === "pending") pendingRows += 1;
  }

  return {
    kind: "account_review_queue_batch",
    version: ACCOUNT_REVIEW_BATCH_VERSION,
    rows,
    totalRows,
    page: {
      number: input.pageNumber,
      size: input.pageSize,
      total: rows.length,
      totalPages,
      hasPrevious: input.pageNumber > 1,
      hasNext: input.pageNumber < totalPages,
    },
    statusCounts,
    nextReviewActions: [...nextReviewActions].sort(compareValues),
    humanReviewRequired: rows.length > 0,
    pending: pendingRows > 0,
    humanReviewRequiredRows: rows.length,
    pendingRows,
    note: "Descriptive-only projection for human review. It does not mutate review state, infer metadata, rank accounts, select winners, write files, or publish.",
    sideEffects: "none",
  };
}

export const createReviewQueueBatch = buildReviewQueueBatch;

/** Compact, deterministic JSON for inspection or handoff. */
export function renderReviewQueueBatchJson(batch: ReviewQueueBatchArtifact): string {
  return `${JSON.stringify(batch, null, 2)}\n`;
}

/** Descriptive-only Markdown for an operator's review page. */
export function renderReviewQueueBatchMarkdown(batch: ReviewQueueBatchArtifact): string {
  const lines = [
    "# Account review queue batch",
    "",
    `Page ${batch.page.number} of ${batch.page.totalPages} | ${batch.page.total} selected row(s) | ${batch.totalRows} unreviewed row(s) total`,
    `Human review required: ${batch.humanReviewRequired ? "yes" : "no"} (${batch.humanReviewRequiredRows}) | Pending: ${batch.pending ? "yes" : "no"} (${batch.pendingRows})`,
    "",
    "## Status counts",
    "",
    "| Reviewed | Pending | Blocked | Unmapped |",
    "| ---: | ---: | ---: | ---: |",
    `| ${batch.statusCounts.reviewed} | ${batch.statusCounts.pending} | ${batch.statusCounts.blocked} | ${batch.statusCounts.unmapped} |`,
    "",
    "## Selected rows",
    "",
    "| Account key | Platform | Handle | Status | Next review action |",
    "| --- | --- | --- | --- | --- |",
    ...batch.rows.map((row) => `| ${cell(row.currentAccountKey)} | ${cell(row.platform)} | ${cell(row.handle)} | ${row.status} | ${cell(row.nextReviewAction)} |`),
    "",
    `Next review actions: ${batch.nextReviewActions.length === 0 ? "none" : batch.nextReviewActions.join("; ")}`,
    "",
    `Note: ${batch.note}`,
    "",
  ];
  return lines.join("\n");
}
