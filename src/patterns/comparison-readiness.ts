import { validateReviewMetadata, type NormalizedReviewMetadataRecord, type ReviewMetadataInput } from "./review-metadata.js";
import type { SourceEvidenceRow } from "./source-evidence.js";

/** Pure join for Phase 2 comparison eligibility. It carries metadata only, never body text. */
export const COMPARISON_READINESS_VERSION = "comparison-readiness-v1" as const;

export interface ComparisonReadinessInput {
  readonly reviews: readonly ReviewMetadataInput[];
  readonly evidence: readonly SourceEvidenceRow[];
}

export interface ComparisonReadinessRow {
  readonly kind: "comparison_readiness_row";
  readonly version: typeof COMPARISON_READINESS_VERSION;
  readonly id: string;
  readonly evidenceId: string | null;
  readonly accountId: string | null;
  readonly sourceId: string | null;
  readonly postId: string | null;
  readonly platform: string | null;
  readonly medium: string | null;
  readonly format: string | null;
  readonly pool: SourceEvidenceRow["pool"];
  readonly topics: string[] | null;
  readonly focus: string[] | null;
  readonly nicheLabel: string | null;
  readonly popularityScope: string | null;
  readonly sampleScope: string | null;
  readonly baselineScope: string | null;
  readonly baselineSource: string | null;
  readonly evidenceLinks: string[];
  readonly readiness: { status: "ready" | "blocked"; blockers: string[] };
  readonly bodyIncluded: false;
}

export interface ComparisonReadinessInventory {
  readonly kind: "comparison_readiness_inventory";
  readonly version: typeof COMPARISON_READINESS_VERSION;
  readonly rows: ComparisonReadinessRow[];
  readonly summary: { ready: number; blocked: number; duplicateEvidence: number };
  readonly sideEffects: "none";
}

function nullable(value: string | "unknown" | null): string | null {
  return value === null || value === "unknown" ? null : value;
}

function normalizedReviewRows(values: readonly ReviewMetadataInput[]): NormalizedReviewMetadataRecord[] {
  return values.map((value) => validateReviewMetadata(value).normalized)
    .sort((left, right) => left.currentAccountKey.localeCompare(right.currentAccountKey));
}

function reviewKey(row: NormalizedReviewMetadataRecord): string {
  return row.stableAccountId ?? row.currentAccountKey;
}

function findReview(reviews: readonly NormalizedReviewMetadataRecord[], accountId: string | null): NormalizedReviewMetadataRecord | null {
  if (accountId === null || accountId === "unknown") return null;
  return reviews.find((review) => reviewKey(review) === accountId || review.currentAccountKey === accountId) ?? null;
}

function requiredEvidenceBlockers(row: SourceEvidenceRow): string[] {
  const blockers: string[] = [];
  const text = (value: string | "unknown" | null): boolean => value === null || value === "unknown";
  const list = (value: string[] | "unknown" | null): boolean => value === null || value === "unknown" || value.length === 0;
  if (text(row.id) || text(row.accountId) || text(row.platform) || text(row.medium) || text(row.format)) {
    blockers.push("source evidence identity fields are incomplete");
  }
  if ((row.sourceId === null || row.sourceId === "unknown") && (row.postId === null || row.postId === "unknown")) {
    blockers.push("source or post id is missing");
  }
  if (text(row.membershipReason)) blockers.push("pool membership reason is missing");
  if (row.readiness.status !== "ready") blockers.push(...row.readiness.blockingFields.map((field) => `source evidence ${field}`));
  if (row.status !== "ready" || row.reviewStatus !== "reviewed") blockers.push("source evidence is not reviewed and ready");
  if (row.pool === null) blockers.push("pool membership is missing");
  if (text(row.popularityScope)) blockers.push("popularity scope is missing");
  if (text(row.sampleScope)) blockers.push("sample scope is missing");
  if (text(row.baselineScope) || text(row.baselineSource)) blockers.push("baseline scope or source is missing");
  if (list(row.evidenceLinks)) blockers.push("evidence links are missing");
  if (text(row.provenance) || text(row.observedAt) || text(row.collectedAt)) blockers.push("evidence provenance or dates are missing");
  if (row.audienceSizeSnapshot === null || row.audienceSizeSnapshot === "unknown") blockers.push("audience snapshot is incomplete");
  else if ([row.audienceSizeSnapshot.size, row.audienceSizeSnapshot.countType, row.audienceSizeSnapshot.observedAt,
    row.audienceSizeSnapshot.collectedAt, row.audienceSizeSnapshot.evidenceSource].some((value) => value === null || value === "unknown")) {
    blockers.push("audience snapshot is incomplete");
  }
  if (row.metricSnapshot === null || row.metricSnapshot === "unknown") blockers.push("metric snapshot is incomplete");
  else if ([row.metricSnapshot.metric, row.metricSnapshot.value, row.metricSnapshot.unit, row.metricSnapshot.numerator,
    row.metricSnapshot.denominator, row.metricSnapshot.window, row.metricSnapshot.scope, row.metricSnapshot.observedAt]
    .some((value) => value === null || value === "unknown")) blockers.push("metric snapshot is incomplete");
  if (row.caveats === null || row.caveats === "unknown") blockers.push("caveats are missing");
  if (row.bodyComplete !== true) blockers.push("body is not complete evidence");
  if (row.lineage === null || row.lineage === "unknown" || row.lineage.length === 0) blockers.push("evidence lineage is missing");
  return blockers;
}

function metadataBlockers(review: NormalizedReviewMetadataRecord | null, evidence: SourceEvidenceRow): string[] {
  if (review === null) return ["account metadata is unreviewed"];
  const result = validateReviewMetadata(review).blockingFields;
  const blockers = result.map((field) => `account metadata ${field} is incomplete`);
  if (review.disposition !== "reviewed") blockers.push("account metadata is not reviewed");
  if (review.platform !== evidence.platform) blockers.push("platform does not match reviewed account metadata");
  if (review.medium !== evidence.medium) blockers.push("medium does not match reviewed account metadata");
  if (review.format !== evidence.format) blockers.push("format does not match reviewed account metadata");
  if (review.researchPoolMembership !== null && review.researchPoolMembership !== "unknown"
    && evidence.pool !== null && !review.researchPoolMembership.some((membership) => membership.pool === evidence.pool)) {
    blockers.push("pool is not an explicit membership on reviewed account metadata");
  }
  return blockers;
}

function buildRow(
  evidence: SourceEvidenceRow,
  review: NormalizedReviewMetadataRecord | null,
  duplicate: boolean,
): ComparisonReadinessRow {
  const blockers = [...metadataBlockers(review, evidence), ...requiredEvidenceBlockers(evidence)];
  if (duplicate) blockers.push("duplicate evidence id");
  return {
    kind: "comparison_readiness_row",
    version: COMPARISON_READINESS_VERSION,
    id: evidence.id ?? `evidence:${evidence.sourceId ?? "unknown"}:${evidence.postId ?? "unknown"}`,
    evidenceId: nullable(evidence.id),
    accountId: nullable(evidence.accountId),
    sourceId: nullable(evidence.sourceId),
    postId: nullable(evidence.postId),
    platform: nullable(evidence.platform),
    medium: nullable(evidence.medium),
    format: nullable(evidence.format),
    pool: evidence.pool,
    topics: review?.topics === "unknown" ? null : review?.topics ?? null,
    focus: review?.focus === "unknown" ? null : review?.focus ?? null,
    nicheLabel: review?.nicheLabel === "unknown" ? null : review?.nicheLabel ?? null,
    popularityScope: nullable(evidence.popularityScope),
    sampleScope: nullable(evidence.sampleScope),
    baselineScope: nullable(evidence.baselineScope),
    baselineSource: nullable(evidence.baselineSource),
    evidenceLinks: evidence.evidenceLinks === "unknown" || evidence.evidenceLinks === null ? [] : [...evidence.evidenceLinks].sort(),
    readiness: { status: blockers.length === 0 ? "ready" : "blocked", blockers: [...new Set(blockers)] },
    bodyIncluded: false,
  };
}

export function buildComparisonReadiness(input: ComparisonReadinessInput): ComparisonReadinessInventory {
  const reviews = normalizedReviewRows(input.reviews);
  const evidence = [...input.evidence].sort((left, right) => (left.id ?? "").localeCompare(right.id ?? ""));
  const counts = new Map<string, number>();
  for (const row of evidence) if (row.id !== null && row.id !== "unknown") counts.set(row.id, (counts.get(row.id) ?? 0) + 1);
  const rows = evidence.map((row) => buildRow(
    row,
    findReview(reviews, nullable(row.accountId)),
    row.id !== null && row.id !== "unknown" && (counts.get(row.id) ?? 0) > 1,
  ));
  const ready = rows.filter((row) => row.readiness.status === "ready").length;
  return {
    kind: "comparison_readiness_inventory",
    version: COMPARISON_READINESS_VERSION,
    rows,
    summary: { ready, blocked: rows.length - ready, duplicateEvidence: [...counts.values()].filter((count) => count > 1).reduce((sum, count) => sum + count - 1, 0) },
    sideEffects: "none",
  };
}

export const createComparisonReadiness = buildComparisonReadiness;
