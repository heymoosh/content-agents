import type { ReviewQueueBatchArtifact } from "./review-batch.js";

export const REVIEW_SESSION_VERSION = "review-session-v1" as const;

export interface ReviewSessionInputStatus {
  readonly supplied: boolean;
  readonly status: "not_supplied" | "valid" | "invalid";
  readonly reviewStatus: "unreviewed" | "reviewed";
  readonly rowCount: number;
  readonly validRowCount: number;
  readonly invalidRowCount: number;
  readonly validationErrors: readonly string[];
}

export interface ReviewSessionDataStatus {
  readonly reviewStatus: string;
  readonly reviewBoundary: string;
}

export interface ReviewSessionInput {
  readonly batch: ReviewQueueBatchArtifact;
  readonly reviewInput?: ReviewSessionInputStatus | null;
  readonly dataStatus?: ReviewSessionDataStatus | null;
}

export interface ReviewSessionRow {
  readonly accountKey: string;
  readonly platform: string;
  readonly handle: string | null;
  readonly status: string;
  readonly evidenceCount: number;
  readonly requiredFields: string[];
  readonly humanAction: string;
  readonly nextReviewAction: string;
  readonly bodyIncluded: false;
}

export interface ReviewSessionArtifact {
  readonly kind: "review_session";
  readonly version: typeof REVIEW_SESSION_VERSION;
  readonly rows: ReviewSessionRow[];
  readonly reviewInput: ReviewSessionInputStatus | null;
  readonly dataStatus: ReviewSessionDataStatus | null;
  readonly summary: {
    readonly selectedRows: number;
    readonly humanReviewRequiredRows: number;
    readonly blockedRows: number;
    readonly pendingRows: number;
    readonly unmappedRows: number;
  };
  readonly humanReviewRequired: boolean;
  readonly sideEffects: "none";
  readonly note: string;
}

function actionFor(status: string, nextReviewAction: string): string {
  if (status === "blocked") return "resolve the explicit blocker before completing review";
  if (status === "unmapped") return "map the account or record an explicit unmapped disposition";
  if (status === "pending") return "review the required account metadata fields";
  return nextReviewAction;
}

/**
 * Joins already-computed review and inventory facts into one human handoff. This projection does
 * not approve metadata, mutate review state, rank accounts, select winners, or include post text.
 */
export function buildReviewSession(input: ReviewSessionInput): ReviewSessionArtifact {
  const rows = input.batch.rows.map((row): ReviewSessionRow => ({
    accountKey: row.currentAccountKey,
    platform: row.platform,
    handle: row.handle,
    status: row.status,
    evidenceCount: row.evidenceCount,
    requiredFields: [...row.missingRequiredOverlayFields],
    humanAction: actionFor(row.status, row.nextReviewAction),
    nextReviewAction: row.nextReviewAction,
    bodyIncluded: false,
  }));
  const blockedRows = rows.filter((row) => row.status === "blocked").length;
  const pendingRows = rows.filter((row) => row.status === "pending").length;
  const unmappedRows = rows.filter((row) => row.status === "unmapped").length;
  return {
    kind: "review_session",
    version: REVIEW_SESSION_VERSION,
    rows,
    reviewInput: input.reviewInput ?? null,
    dataStatus: input.dataStatus ?? null,
    summary: {
      selectedRows: rows.length,
      humanReviewRequiredRows: input.batch.humanReviewRequiredRows,
      blockedRows,
      pendingRows,
      unmappedRows,
    },
    humanReviewRequired: rows.length > 0,
    sideEffects: "none",
    note: "Human review handoff only. It preserves explicit review and data-status facts, contains no creator post bodies, and does not approve, persist, rank, select, or publish anything.",
  };
}

export const createReviewSession = buildReviewSession;

export function renderReviewSessionJson(session: ReviewSessionArtifact): string {
  return `${JSON.stringify(session, null, 2)}\n`;
}

function markdownText(value: string | number | null): string {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function renderReviewSessionMarkdown(session: ReviewSessionArtifact): string {
  const lines = [
    "# Human review session",
    "",
    `- Selected rows: ${session.summary.selectedRows}`,
    `- Human review required: ${session.humanReviewRequired ? "yes" : "no"}`,
    `- Pending: ${session.summary.pendingRows}`,
    `- Blocked: ${session.summary.blockedRows}`,
    `- Unmapped: ${session.summary.unmappedRows}`,
    "",
    "| Account | Platform | Handle | Status | Required fields | Human action | Evidence |",
    "|---|---|---|---|---|---|---:|",
    ...session.rows.map((row) => `| ${markdownText(row.accountKey)} | ${markdownText(row.platform)} | ${markdownText(row.handle)} | ${markdownText(row.status)} | ${markdownText(row.requiredFields.join(", "))} | ${markdownText(row.humanAction)} | ${row.evidenceCount} |`),
    "",
    `- Review input: ${session.reviewInput ? `${session.reviewInput.status}, ${session.reviewInput.reviewStatus}, ${session.reviewInput.validRowCount} valid row(s)` : "not supplied"}`,
    `- Data status: ${session.dataStatus ? `${markdownText(session.dataStatus.reviewStatus)} (${markdownText(session.dataStatus.reviewBoundary)})` : "not supplied"}`,
    `- Note: ${session.note}`,
    "",
  ];
  return lines.join("\n");
}
