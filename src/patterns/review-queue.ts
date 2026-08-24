import type { CatalogRow, PatternCatalog } from "./catalog.js";
import type { OverlayCoverageReport, OverlayCoverageStatus } from "./overlay-coverage.js";
import { REQUIRED_REVIEW_FIELDS } from "./review-metadata.js";

/** A body-free, read-only account metadata review handoff. */
export const ACCOUNT_REVIEW_QUEUE_VERSION = "account-review-queue-v1" as const;

export interface ReviewQueueInput {
  readonly catalog: PatternCatalog | readonly CatalogRow[];
  readonly coverage: OverlayCoverageReport;
}

export interface ReviewQueueRow {
  /** The stable current-state key. It is not a reviewed target account id. */
  readonly currentAccountKey: string;
  readonly platform: string;
  readonly handle: string | null;
  readonly creator: string | null;
  readonly evidenceCount: number;
  readonly status: OverlayCoverageStatus;
  readonly stableIdPresent: boolean;
  readonly missingRequiredOverlayFields: string[];
  readonly comparisonEvidenceReady: boolean;
  readonly nextReviewAction: string;
}

export interface ReviewQueueSummary {
  readonly total: number;
  readonly evidenceCount: number;
  readonly comparisonEvidenceReady: number;
  readonly statusCounts: Record<OverlayCoverageStatus, number>;
}

export interface ReviewQueueArtifact {
  readonly kind: "account_review_queue";
  readonly version: typeof ACCOUNT_REVIEW_QUEUE_VERSION;
  readonly rows: ReviewQueueRow[];
  readonly summary: ReviewQueueSummary;
  readonly sideEffects: "none";
}

const EMPTY_COVERAGE = (currentAccountKey: string): OverlayCoverageReport["rows"][number] => ({
  currentAccountKey,
  status: "unmapped",
  stableId: null,
  stableIdPresent: false,
  missingRequiredOverlayFields: [...REQUIRED_REVIEW_FIELDS],
  comparisonEvidenceReady: false,
});

function compareValues(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stableValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    return `{${Object.keys(value).sort(compareValues).map((key) => `${JSON.stringify(key)}:${stableValue((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function catalogRows(catalog: PatternCatalog | readonly CatalogRow[]): readonly CatalogRow[] {
  return "rows" in catalog ? catalog.rows : catalog;
}

function nextReviewAction(
  status: OverlayCoverageStatus,
  missingFields: readonly string[],
  comparisonEvidenceReady: boolean,
  duplicateMapping: boolean,
): string {
  if (status === "unmapped") return "map account or confirm explicit unmapped disposition";
  if (status === "pending") return "review pending account metadata";
  if (status === "blocked") {
    if (duplicateMapping) return "resolve duplicate overlay mapping";
    if (missingFields.length > 0) return `complete missing metadata: ${missingFields.join(", ")}`;
    return "review blocked account metadata";
  }
  return comparisonEvidenceReady ? "no further account review action" : "review linked comparison evidence";
}

function sortedCoverageRows(coverage: OverlayCoverageReport): OverlayCoverageReport["rows"] {
  return [...coverage.rows].sort((left, right) => compareValues(left.currentAccountKey, right.currentAccountKey) || compareValues(stableValue(left), stableValue(right)));
}

/**
 * Joins catalog identity/evidence facts to the already-computed overlay coverage.
 *
 * The catalog is the source of current account keys and display context. Overlay coverage is the
 * source of review status. No account metadata is inferred from the catalog, evidence counts, or
 * the absence of a coverage row.
 */
export function buildReviewQueue(input: ReviewQueueInput): ReviewQueueArtifact {
  const catalog = catalogRows(input.catalog);
  const keys = [...new Set(catalog.map((row) => row.key))].sort(compareValues);
  const catalogByKey = new Map([...catalog]
    .sort((left, right) => compareValues(left.key, right.key) || compareValues(stableValue(left), stableValue(right)))
    .map((row) => [row.key, row]));
  const coverageByKey = new Map(sortedCoverageRows(input.coverage).map((row) => [row.currentAccountKey, row]));
  const duplicateMappings = new Set(input.coverage.duplicateMappings);

  const rows = keys.map((currentAccountKey): ReviewQueueRow => {
    const catalogRow = catalogByKey.get(currentAccountKey)!;
    const coverageRow = coverageByKey.get(currentAccountKey) ?? EMPTY_COVERAGE(currentAccountKey);
    const missingRequiredOverlayFields = [...new Set(
      coverageRow.status === "unmapped" && coverageRow.missingRequiredOverlayFields.length === 0
        ? REQUIRED_REVIEW_FIELDS
        : coverageRow.missingRequiredOverlayFields,
    )].sort(compareValues);
    return {
      currentAccountKey,
      platform: catalogRow.platform,
      handle: catalogRow.handle,
      creator: catalogRow.creator,
      evidenceCount: catalogRow.evidenceCount,
      status: coverageRow.status,
      stableIdPresent: coverageRow.stableIdPresent,
      missingRequiredOverlayFields,
      comparisonEvidenceReady: coverageRow.comparisonEvidenceReady,
      nextReviewAction: nextReviewAction(
        coverageRow.status,
        missingRequiredOverlayFields,
        coverageRow.comparisonEvidenceReady,
        duplicateMappings.has(currentAccountKey),
      ),
    };
  });

  const statusCounts: Record<OverlayCoverageStatus, number> = { reviewed: 0, pending: 0, blocked: 0, unmapped: 0 };
  let comparisonEvidenceReady = 0;
  let evidenceCount = 0;
  for (const row of rows) {
    statusCounts[row.status] += 1;
    evidenceCount += row.evidenceCount;
    if (row.comparisonEvidenceReady) comparisonEvidenceReady += 1;
  }

  return {
    kind: "account_review_queue",
    version: ACCOUNT_REVIEW_QUEUE_VERSION,
    rows,
    summary: { total: rows.length, evidenceCount, comparisonEvidenceReady, statusCounts },
    sideEffects: "none",
  };
}

export const createReviewQueue = buildReviewQueue;
export const buildAccountReviewQueue = buildReviewQueue;

/** Compact, deterministic JSON for inspection or handoff. */
export function renderReviewQueueJson(queue: ReviewQueueArtifact): string {
  return `${JSON.stringify({
    kind: queue.kind,
    version: queue.version,
    rows: [...queue.rows].sort((left, right) => compareValues(left.currentAccountKey, right.currentAccountKey)),
    summary: {
      total: queue.summary.total,
      evidenceCount: queue.summary.evidenceCount,
      comparisonEvidenceReady: queue.summary.comparisonEvidenceReady,
      statusCounts: {
        reviewed: queue.summary.statusCounts.reviewed,
        pending: queue.summary.statusCounts.pending,
        blocked: queue.summary.statusCounts.blocked,
        unmapped: queue.summary.statusCounts.unmapped,
      },
    },
    sideEffects: queue.sideEffects,
  }, null, 2)}\n`;
}
