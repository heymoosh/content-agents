import {
  validateReviewMetadata,
  type NormalizedReviewMetadataRecord,
  type ReviewDisposition,
  type ReviewMetadataInput,
  type ReviewPool,
} from "./review-metadata.js";
import type { CatalogRow, PatternCatalog } from "./catalog.js";

export const POOL_REVIEW_COVERAGE_VERSION = "pool-review-coverage-v1" as const;
export const POOL_REVIEW_COVERAGE_SCOPE =
  "metadata coverage only; not source/post comparison readiness" as const;

export type PoolReviewCoverageStatus = "reviewed" | "pending" | "blocked" | "unmapped";
export type ReviewedPoolLabels = ReviewPool[] | "unknown" | null;

export interface PoolReviewCoverageInput {
  readonly catalog: PatternCatalog | readonly CatalogRow[];
  readonly reviews: readonly ReviewMetadataInput[];
}

export interface PoolReviewCoverageRow {
  readonly currentAccountKey: string;
  readonly platform: string;
  readonly handle: string | null;
  readonly evidenceCount: number;
  /** Labels come only from the validated review metadata, never from catalog fields. */
  readonly reviewedPoolLabels: ReviewedPoolLabels;
  readonly disposition: ReviewDisposition | null;
  readonly status: PoolReviewCoverageStatus;
  readonly blockers: string[];
  readonly nextAction: string;
}

export interface PoolReviewCoverageSummary {
  readonly total: number;
  readonly reviewed: number;
  readonly pending: number;
  readonly blocked: number;
  readonly unmapped: number;
  readonly poolCounts: Record<ReviewPool, number>;
  readonly unmappedReviewRows: string[];
}

export interface PoolReviewCoverageArtifact {
  readonly kind: "pool_review_coverage";
  readonly version: typeof POOL_REVIEW_COVERAGE_VERSION;
  readonly scope: typeof POOL_REVIEW_COVERAGE_SCOPE;
  readonly bodyIncluded: false;
  readonly rows: PoolReviewCoverageRow[];
  readonly summary: PoolReviewCoverageSummary;
  readonly sideEffects: "none";
}

interface ValidatedReview {
  readonly currentAccountKey: string;
  readonly normalized: NormalizedReviewMetadataRecord | null;
  readonly errors: string[];
  readonly blockingFields: string[];
}

const REVIEW_DISPOSITIONS = new Set<ReviewDisposition>(["pending", "reviewed", "blocked", "unmapped"]);
const REVIEW_POOLS = new Set<ReviewPool>(["niche", "broad", "format"]);

function compareValues(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareValues);
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

function currentAccountKey(value: unknown): string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return "";
  const candidate = (value as Record<string, unknown>).currentAccountKey;
  return typeof candidate === "string" ? candidate.trim() : "";
}

function validateReview(review: ReviewMetadataInput): ValidatedReview {
  try {
    const result = validateReviewMetadata(review);
    return {
      currentAccountKey: result.normalized.currentAccountKey,
      normalized: result.normalized,
      errors: uniqueSorted(result.errors),
      blockingFields: uniqueSorted(result.blockingFields),
    };
  } catch (error) {
    return {
      currentAccountKey: currentAccountKey(review),
      normalized: null,
      errors: [error instanceof Error ? error.message : String(error)],
      blockingFields: ["reviewMetadata"],
    };
  }
}

function normalizedReviews(reviews: readonly ReviewMetadataInput[]): ValidatedReview[] {
  return reviews
    .map(validateReview)
    .sort((left, right) => compareValues(left.currentAccountKey, right.currentAccountKey) || compareValues(stableValue(left), stableValue(right)));
}

function explicitPoolLabels(review: ValidatedReview | null): ReviewedPoolLabels {
  if (review === null || review.normalized === null) return null;
  if (review.errors.length > 0) return [];
  const memberships = review.normalized.researchPoolMembership;
  if (memberships === null || memberships === "unknown") return memberships;
  return [...new Set(memberships.map((membership) => membership.pool).filter((pool) => REVIEW_POOLS.has(pool)))].sort(compareValues);
}

function validDisposition(review: ValidatedReview | null): ReviewDisposition | null {
  const disposition = review?.normalized?.disposition;
  return typeof disposition === "string" && REVIEW_DISPOSITIONS.has(disposition as ReviewDisposition)
    ? disposition as ReviewDisposition
    : null;
}

function blockersFor(review: ValidatedReview | null, duplicate: boolean): string[] {
  if (review === null) return ["review metadata is missing"];
  const blockers = [...review.errors, ...review.blockingFields];
  if (duplicate) blockers.push("duplicate review metadata rows");
  const disposition = validDisposition(review);
  if (disposition === "blocked") blockers.push("review disposition is blocked");
  if (review.normalized === null && blockers.length === 0) blockers.push("review metadata is invalid");
  return uniqueSorted(blockers);
}

function statusFor(
  review: ValidatedReview | null,
  blockers: readonly string[],
  duplicate: boolean,
): PoolReviewCoverageStatus {
  if (review === null) return "unmapped";
  if (duplicate || review.normalized === null || review.errors.length > 0 || review.blockingFields.length > 0) return "blocked";
  const disposition = validDisposition(review);
  if (disposition === "unmapped") return "unmapped";
  if (disposition === "blocked") return "blocked";
  if (disposition === "pending") return blockers.length > 0 ? "blocked" : "pending";
  if (disposition === "reviewed") return blockers.length > 0 ? "blocked" : "reviewed";
  return "blocked";
}

function nextAction(status: PoolReviewCoverageStatus, blockers: readonly string[], disposition: ReviewDisposition | null): string {
  if (status === "unmapped") {
    return disposition === "unmapped"
      ? "confirm the explicit unmapped disposition"
      : "add explicit review metadata for this catalog account";
  }
  if (status === "pending") return "complete human review of account metadata";
  if (status === "blocked") {
    return blockers.length > 0
      ? `resolve metadata blockers: ${blockers.join(", ")}`
      : "resolve account metadata blockers";
  }
  return "no further metadata review action";
}

function reviewRowsByKey(reviews: readonly ValidatedReview[]): Map<string, ValidatedReview[]> {
  const byKey = new Map<string, ValidatedReview[]>();
  for (const review of reviews) {
    const rows = byKey.get(review.currentAccountKey) ?? [];
    rows.push(review);
    byKey.set(review.currentAccountKey, rows);
  }
  return byKey;
}

function catalogByKey(rows: readonly CatalogRow[]): Map<string, CatalogRow> {
  const byKey = new Map<string, CatalogRow>();
  const ordered = [...rows].sort((left, right) => compareValues(left.key, right.key) || compareValues(stableValue(left), stableValue(right)));
  for (const row of ordered) if (!byKey.has(row.key)) byKey.set(row.key, row);
  return byKey;
}

function buildRow(catalogRow: CatalogRow, matching: readonly ValidatedReview[]): PoolReviewCoverageRow {
  const duplicate = matching.length > 1;
  const review = matching[0] ?? null;
  const blockers = blockersFor(review, duplicate);
  const disposition = duplicate ? null : validDisposition(review);
  const status = statusFor(review, blockers, duplicate);
  return {
    currentAccountKey: catalogRow.key,
    platform: catalogRow.platform,
    handle: catalogRow.handle,
    evidenceCount: catalogRow.evidenceCount,
    reviewedPoolLabels: duplicate ? null : explicitPoolLabels(review),
    disposition,
    status,
    blockers,
    nextAction: nextAction(status, blockers, disposition),
  };
}

function summaryFor(rows: readonly PoolReviewCoverageRow[], unmappedReviewRows: string[]): PoolReviewCoverageSummary {
  const summary = {
    total: rows.length,
    reviewed: 0,
    pending: 0,
    blocked: 0,
    unmapped: 0,
    poolCounts: { niche: 0, broad: 0, format: 0 } as Record<ReviewPool, number>,
    unmappedReviewRows: uniqueSorted(unmappedReviewRows),
  };
  for (const row of rows) {
    summary[row.status] += 1;
    if (row.status !== "reviewed" || !Array.isArray(row.reviewedPoolLabels)) continue;
    for (const pool of row.reviewedPoolLabels) summary.poolCounts[pool] += 1;
  }
  return summary;
}

/** Build a body-free, read-only metadata coverage handoff from catalog rows and human reviews. */
export function buildPoolReviewCoverage(input: PoolReviewCoverageInput): PoolReviewCoverageArtifact {
  const catalog = catalogByKey(catalogRows(input.catalog));
  const reviews = normalizedReviews(input.reviews);
  const byKey = reviewRowsByKey(reviews);
  const rows = [...catalog.keys()]
    .sort(compareValues)
    .map((key) => buildRow(catalog.get(key)!, byKey.get(key) ?? []));
  const catalogKeys = new Set(catalog.keys());
  const unmappedReviewRows = reviews
    .filter((review) => !catalogKeys.has(review.currentAccountKey))
    .map((review) => review.currentAccountKey);

  return {
    kind: "pool_review_coverage",
    version: POOL_REVIEW_COVERAGE_VERSION,
    scope: POOL_REVIEW_COVERAGE_SCOPE,
    bodyIncluded: false,
    rows,
    summary: summaryFor(rows, unmappedReviewRows),
    sideEffects: "none",
  };
}

export const createPoolReviewCoverage = buildPoolReviewCoverage;
export const buildReviewPoolCoverage = buildPoolReviewCoverage;
export const createReviewPoolCoverage = buildPoolReviewCoverage;

/** Render a stable inspection artifact without adding review notes, reasons, or source bodies. */
export function renderPoolReviewCoverageJson(artifact: PoolReviewCoverageArtifact): string {
  const rows = [...artifact.rows].sort((left, right) => compareValues(left.currentAccountKey, right.currentAccountKey));
  return `${JSON.stringify({
    kind: artifact.kind,
    version: artifact.version,
    scope: artifact.scope,
    bodyIncluded: artifact.bodyIncluded,
    rows,
    summary: {
      total: artifact.summary.total,
      reviewed: artifact.summary.reviewed,
      pending: artifact.summary.pending,
      blocked: artifact.summary.blocked,
      unmapped: artifact.summary.unmapped,
      poolCounts: {
        niche: artifact.summary.poolCounts.niche,
        broad: artifact.summary.poolCounts.broad,
        format: artifact.summary.poolCounts.format,
      },
      unmappedReviewRows: [...artifact.summary.unmappedReviewRows].sort(compareValues),
    },
    sideEffects: artifact.sideEffects,
  }, null, 2)}\n`;
}

export const renderPoolCoverageJson = renderPoolReviewCoverageJson;
export const renderReviewPoolCoverageJson = renderPoolReviewCoverageJson;
