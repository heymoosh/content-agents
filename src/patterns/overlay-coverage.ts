import { validateReviewMetadata, type NormalizedReviewMetadataRecord, type ReviewMetadataInput } from "./review-metadata.js";
import type { ComparisonReadinessInventory } from "./comparison-readiness.js";
import type { CatalogRow, PatternCatalog } from "./catalog.js";

export const OVERLAY_COVERAGE_VERSION = "overlay-coverage-v1" as const;

export interface OverlayCoverageInput {
  readonly catalog: PatternCatalog | readonly CatalogRow[];
  readonly reviews: readonly ReviewMetadataInput[];
  readonly comparison?: ComparisonReadinessInventory;
}

export type OverlayCoverageStatus = "reviewed" | "pending" | "blocked" | "unmapped";

export interface OverlayCoverageRow {
  readonly currentAccountKey: string;
  readonly status: OverlayCoverageStatus;
  readonly stableId: string | null;
  readonly stableIdPresent: boolean;
  readonly missingRequiredOverlayFields: string[];
  readonly comparisonEvidenceReady: boolean;
}

export interface OverlayCoverageReport {
  readonly kind: "overlay_coverage";
  readonly version: typeof OVERLAY_COVERAGE_VERSION;
  readonly rows: OverlayCoverageRow[];
  readonly duplicateMappings: string[];
  readonly missingMappings: string[];
  readonly unmappedMetadataRows: string[];
  readonly summary: { reviewed: number; pending: number; blocked: number; unmapped: number };
  readonly sideEffects: "none";
}

function catalogRows(catalog: PatternCatalog | readonly CatalogRow[]): readonly CatalogRow[] {
  return "rows" in catalog ? catalog.rows : catalog;
}

function stableValue(row: NormalizedReviewMetadataRecord): string {
  return JSON.stringify(row, Object.keys(row).sort());
}

function normalizedReviews(reviews: readonly ReviewMetadataInput[]): NormalizedReviewMetadataRecord[] {
  return reviews.map((review) => validateReviewMetadata(review).normalized)
    .sort((left, right) => left.currentAccountKey.localeCompare(right.currentAccountKey) || stableValue(left).localeCompare(stableValue(right)));
}

function missingFields(rows: readonly NormalizedReviewMetadataRecord[]): string[] {
  const fields = new Set<string>();
  for (const row of rows) {
    for (const field of validateReviewMetadata(row).blockingFields) fields.add(field);
    if (row.stableAccountId === null || row.stableAccountId === "unknown" || row.stableAccountId.trim() === "") fields.add("stableAccountId");
  }
  return [...fields].sort();
}

function evidenceReady(comparison: ComparisonReadinessInventory | undefined, reviews: readonly NormalizedReviewMetadataRecord[], currentAccountKey: string): boolean {
  if (comparison === undefined) return false;
  const ids = new Set<string>([currentAccountKey, ...reviews.flatMap((row) => row.stableAccountId && row.stableAccountId !== "unknown" ? [row.stableAccountId] : [])]);
  return comparison.rows.some((row) => row.accountId !== null && row.accountId !== "unknown" && ids.has(row.accountId) && row.readiness.status === "ready");
}

export function buildOverlayCoverage(input: OverlayCoverageInput): OverlayCoverageReport {
  const catalogKeys = [...new Set(catalogRows(input.catalog).map((row) => row.key))].sort();
  const reviews = normalizedReviews(input.reviews);
  const byKey = new Map<string, NormalizedReviewMetadataRecord[]>();
  for (const review of reviews) byKey.set(review.currentAccountKey, [...(byKey.get(review.currentAccountKey) ?? []), review]);
  const duplicateMappings = [...byKey.entries()].filter(([, rows]) => rows.length > 1).map(([key]) => key).sort();
  const rows = catalogKeys.map((currentAccountKey): OverlayCoverageRow => {
    const matching = byKey.get(currentAccountKey) ?? [];
    const duplicate = matching.length > 1;
    const review = matching.length === 1 ? matching[0] : null;
    const missing = matching.length === 0 ? [] : missingFields(matching);
    const status: OverlayCoverageStatus = matching.length === 0
      ? "unmapped"
      : duplicate
        ? "blocked"
        : review?.disposition === "unmapped"
          ? "unmapped"
          : missing.length > 0 || review?.disposition === "blocked"
            ? "blocked"
            : review?.disposition ?? "blocked";
    const stableIds = new Set(matching.flatMap((row) => row.stableAccountId && row.stableAccountId !== "unknown" ? [row.stableAccountId] : []));
    return {
      currentAccountKey,
      status,
      stableId: stableIds.size === 1 ? [...stableIds][0] : null,
      stableIdPresent: stableIds.size === 1,
      missingRequiredOverlayFields: missing,
      comparisonEvidenceReady: review !== null && review.disposition === "reviewed" && !duplicate && missing.length === 0
        && evidenceReady(input.comparison, matching, currentAccountKey),
    };
  });
  const catalogKeySet = new Set(catalogKeys);
  const unmappedMetadataRows = [...new Set(reviews.filter((row) => !catalogKeySet.has(row.currentAccountKey)).map((row) => row.currentAccountKey))].sort();
  const missingMappings = rows.filter((row) => row.status === "unmapped").map((row) => row.currentAccountKey);
  const summary = { reviewed: 0, pending: 0, blocked: 0, unmapped: 0 };
  for (const row of rows) summary[row.status] += 1;
  return { kind: "overlay_coverage", version: OVERLAY_COVERAGE_VERSION, rows, duplicateMappings, missingMappings, unmappedMetadataRows, summary, sideEffects: "none" };
}

export const createOverlayCoverage = buildOverlayCoverage;
