import type { CatalogRow } from "./catalog.js";

export type ReviewPool = "niche" | "broad" | "format";
export type ReviewDisposition = "pending" | "reviewed" | "blocked" | "unmapped";

export interface AudienceSnapshot {
  size: number | null;
  countType: string | null;
  provenance: string | null;
  asOf: string | null;
  /** Collection timestamp is distinct from the audience observation date. */
  collectedAt?: string | null;
}

export interface ReviewPoolMembership {
  pool: ReviewPool;
  reason: string;
}

export interface ReviewMetadataRecord {
  currentAccountKey: string;
  platform: string;
  handle: string | null;
  /** Optional display name; the catalog remains the preferred source when available. */
  creator?: string | null;
  stableAccountId: string | null;
  stableAccountIdStatus: string;
  topics: string[] | "unknown" | null;
  focus: string[] | "unknown" | null;
  nicheLabel: string | "unknown" | null;
  researchPoolMembership: ReviewPoolMembership[] | "unknown" | null;
  popularityScope: string | "unknown" | null;
  sampleScope: string | "unknown" | null;
  baselineScope: string | "unknown" | null;
  baselineSource: string | "unknown" | null;
  medium: string | "unknown" | null;
  format: string | "unknown" | null;
  audienceSnapshot: AudienceSnapshot | null;
  evidenceLinks: string[] | "unknown" | null;
  reviewer: string | "unknown" | null;
  reviewNote: string | "unknown" | null;
  disposition: ReviewDisposition;
  reviewed_at: string | null;
  caveats: string[] | "unknown" | null;
}

export type ReviewMetadataInput = Omit<ReviewMetadataRecord, "researchPoolMembership"> & {
  researchPoolMembership: Array<{ pool: string; reason: string }> | "unknown" | null;
};

export interface NormalizedReviewMetadataRecord extends Omit<ReviewMetadataRecord, "researchPoolMembership"> {
  researchPoolMembership: ReviewPoolMembership[] | "unknown" | null;
}

export interface ReviewValidation {
  ok: boolean;
  errors: string[];
  blockingFields: string[];
  normalized: NormalizedReviewMetadataRecord;
}

export interface ReviewRowsValidation {
  ok: boolean;
  errors: string[];
  rows: NormalizedReviewMetadataRecord[];
}

export interface MergedReviewMetadata {
  accountId: string | null;
  nicheLabel: string | null;
  researchPoolMembership: ReviewPoolMembership[] | null;
  reviewStatus: "unreviewed" | ReviewDisposition;
  readiness: {
    status: "ready" | "blocked";
    blockingFields: string[];
    reason: string;
  };
  catalogRow: CatalogRow;
  metadata: ReviewMetadataRecord | null;
}

const POOLS = new Set<ReviewPool>(["niche", "broad", "format"]);
const DISPOSITIONS = new Set<ReviewDisposition>(["pending", "reviewed", "blocked", "unmapped"]);
function strings(value: unknown): string[] | "unknown" | null {
  if (value === null || value === "unknown") return value;
  if (!Array.isArray(value)) return null;
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim()))].sort();
}

function scalar(value: unknown): string | "unknown" | null {
  if (value === null || value === "unknown") return value;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeMemberships(value: unknown): { value: ReviewPoolMembership[] | "unknown" | null; errors: string[] } {
  if (value === null || value === "unknown") return { value, errors: [] };
  if (!Array.isArray(value)) return { value: null, errors: ["researchPoolMembership must be an array, null, or unknown"] };
  const errors: string[] = [];
  const rows: ReviewPoolMembership[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      errors.push("researchPoolMembership entries must be objects");
      continue;
    }
    const candidate = item as Record<string, unknown>;
    const pool = typeof candidate.pool === "string" ? candidate.pool.trim().toLowerCase() : "";
    const reason = typeof candidate.reason === "string" ? candidate.reason.trim() : "";
    if (!POOLS.has(pool as ReviewPool)) {
      errors.push(`researchPoolMembership has unsupported pool "${pool || String(candidate.pool)}"; expected niche, broad, or format`);
      continue;
    }
    if (!reason) errors.push(`researchPoolMembership ${pool} requires an explicit reason`);
    rows.push({ pool: pool as ReviewPool, reason });
  }
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.pool)) errors.push(`researchPoolMembership contains duplicate pool "${row.pool}"`);
    seen.add(row.pool);
  }
  rows.sort((a, b) => a.pool.localeCompare(b.pool));
  return { value: rows, errors };
}

function normalize(value: ReviewMetadataInput): { normalized: NormalizedReviewMetadataRecord; errors: string[] } {
  const memberships = normalizeMemberships(value.researchPoolMembership);
  const errors = [...memberships.errors];
  if (!DISPOSITIONS.has(value.disposition)) errors.push(`unsupported disposition "${String(value.disposition)}"; expected pending, reviewed, blocked, or unmapped`);
  const audience = value.audienceSnapshot === null ? null : {
    size: typeof value.audienceSnapshot?.size === "number" && Number.isFinite(value.audienceSnapshot.size)
      ? value.audienceSnapshot.size : null,
    countType: scalar(value.audienceSnapshot?.countType),
    provenance: scalar(value.audienceSnapshot?.provenance),
    asOf: scalar(value.audienceSnapshot?.asOf),
    collectedAt: scalar(value.audienceSnapshot?.collectedAt),
  };
  return {
    normalized: {
      ...value,
      currentAccountKey: value.currentAccountKey.trim(),
      platform: value.platform.trim(),
      handle: value.handle === null ? null : value.handle.trim(),
      creator: value.creator === undefined || value.creator === null ? value.creator ?? null : value.creator.trim(),
      stableAccountId: value.stableAccountId === null ? null : value.stableAccountId.trim(),
      stableAccountIdStatus: value.stableAccountIdStatus.trim(),
      topics: strings(value.topics),
      focus: strings(value.focus),
      nicheLabel: scalar(value.nicheLabel),
      researchPoolMembership: memberships.value,
      popularityScope: scalar(value.popularityScope),
      sampleScope: scalar(value.sampleScope),
      baselineScope: scalar(value.baselineScope),
      baselineSource: scalar(value.baselineSource),
      medium: scalar(value.medium),
      format: scalar(value.format),
      audienceSnapshot: audience,
      evidenceLinks: strings(value.evidenceLinks),
      reviewer: scalar(value.reviewer),
      reviewNote: scalar(value.reviewNote),
      reviewed_at: scalar(value.reviewed_at),
      caveats: value.caveats === null || value.caveats === "unknown" ? value.caveats : strings(value.caveats),
    },
    errors,
  };
}

function blockingFields(row: ReviewMetadataRecord): string[] {
  const blockers: string[] = [];
  const missing = (value: unknown): boolean => value === null || value === "unknown" || (Array.isArray(value) && value.length === 0);
  if (missing(row.topics)) blockers.push("topics");
  if (missing(row.focus)) blockers.push("focus");
  if (missing(row.nicheLabel)) blockers.push("nicheLabel");
  if (missing(row.researchPoolMembership)) blockers.push("researchPoolMembership");
  for (const field of ["popularityScope", "sampleScope", "baselineScope", "baselineSource", "medium", "format"] as const) {
    if (missing(row[field]) || row[field] === "") blockers.push(field);
  }
  if (row.audienceSnapshot === null) blockers.push("audienceSnapshot");
  else {
    for (const field of ["size", "countType", "provenance", "asOf", "collectedAt"] as const) {
      if (row.audienceSnapshot[field] === null) blockers.push(`audienceSnapshot.${field}`);
    }
  }
  if (missing(row.evidenceLinks)) blockers.push("evidenceLinks");
  for (const field of ["reviewer", "reviewed_at"] as const) if (missing(row[field]) || row[field] === "") blockers.push(field);
  return blockers;
}

export function normalizeReviewMetadata(value: ReviewMetadataInput): NormalizedReviewMetadataRecord {
  const result = normalize(value);
  if (result.errors.length) throw new Error(result.errors.join("; "));
  return result.normalized;
}

export function validateReviewMetadata(value: ReviewMetadataInput): ReviewValidation {
  const result = normalize(value);
  const blockers = blockingFields(result.normalized);
  return {
    ok: result.errors.length === 0 && blockers.length === 0,
    errors: result.errors,
    blockingFields: blockers,
    normalized: result.normalized,
  };
}

export function validateReviewMetadataRows(values: ReviewMetadataRecord[]): ReviewRowsValidation {
  const normalized = values.map((value) => validateReviewMetadata(value));
  const rows = normalized.map((result) => result.normalized).sort((a, b) => a.currentAccountKey.localeCompare(b.currentAccountKey));
  const errors = normalized.flatMap((result) => result.errors);
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.currentAccountKey)) errors.push(`duplicate currentAccountKey "${row.currentAccountKey}"`);
    seen.add(row.currentAccountKey);
  }
  return { ok: errors.length === 0 && normalized.every((result) => result.ok), errors, rows };
}

export function mergeReviewedMetadata(catalogRow: CatalogRow, metadata: ReviewMetadataInput | null): MergedReviewMetadata {
  if (metadata === null) return {
    accountId: null,
    nicheLabel: null,
    researchPoolMembership: null,
    reviewStatus: "unreviewed",
    readiness: { status: "blocked", blockingFields: ["reviewMetadata"], reason: "Blocked: account metadata is unreviewed." },
    catalogRow,
    metadata: null,
  };
  const normalized = normalizeReviewMetadata(metadata);
  const blockers = blockingFields(normalized);
  return {
    accountId: normalized.stableAccountId,
    nicheLabel: normalized.nicheLabel === "unknown" ? null : normalized.nicheLabel,
    researchPoolMembership: Array.isArray(normalized.researchPoolMembership) ? normalized.researchPoolMembership : null,
    reviewStatus: normalized.disposition,
    readiness: blockers.length === 0 && normalized.disposition === "reviewed"
      ? { status: "ready", blockingFields: [], reason: "Reviewed metadata is complete and explicitly evidenced." }
      : { status: "blocked", blockingFields: blockers.length ? blockers : ["reviewStatus"], reason: blockers.length ? `Blocked: missing required fields: ${blockers.join(", ")}.` : `Blocked: review disposition is ${normalized.disposition}.` },
    catalogRow,
    metadata: normalized,
  };
}
