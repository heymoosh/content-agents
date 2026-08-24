import { accountKey } from "./corpus.js";
import type { PatternCatalog, CatalogRow } from "./catalog.js";
import type { AccountBaseline } from "./types.js";
import {
  buildPlatformPoolMatrix,
  type MatrixReviewStatus,
  type PlatformPoolMatrix,
  type PlatformPoolMatrixTarget,
} from "./platform-pool-matrix.js";
import { POOL_NAMES, type PoolName } from "./pool-evidence.js";

export const PLATFORM_POOL_MATRIX_REPO_VERSION = "platform-pool-matrix-repo-v1" as const;

export interface PlatformPoolReviewFact {
  readonly currentAccountKey: string;
  readonly reviewStatus: MatrixReviewStatus;
  /** Explicit human metadata; catalog researchPools/mediaForms/formats are never promoted. */
  readonly reviewedPoolMembership?: readonly { readonly pool: PoolName; readonly reason: string }[] | "unknown" | null;
  readonly medium?: string | "unknown" | null;
  readonly format?: string | "unknown" | null;
}

export type PlatformPoolBaselineFact = string | Pick<AccountBaseline, "platform" | "handle">;

export interface PlatformPoolMatrixRepoInputs {
  readonly reviews?: readonly PlatformPoolReviewFact[] | ReadonlyMap<string, MatrixReviewStatus>;
  readonly baselines?: readonly PlatformPoolBaselineFact[] | ReadonlyMap<string, unknown>;
}

export interface PlatformPoolMatrixBlockedTarget {
  readonly id: string;
  readonly platform: string;
  readonly researchPools: string[];
  readonly blockers: string[];
}

export type PlatformPoolMatrixRepoReport = Omit<PlatformPoolMatrix, "kind" | "version"> & {
  readonly kind: "platform_pool_matrix_repo";
  readonly version: typeof PLATFORM_POOL_MATRIX_REPO_VERSION;
  readonly blockedTargets: readonly PlatformPoolMatrixBlockedTarget[];
};

function fail(message: string): never {
  throw new TypeError(`invalid platform-pool matrix repo input: ${message}`);
}

function nonEmpty(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") fail(`${field} must be a non-empty string`);
  return value.trim();
}

function reviewStatus(value: unknown, field: string): MatrixReviewStatus {
  if (value !== "reviewed" && value !== "unreviewed" && value !== "pending" && value !== "blocked" && value !== "unmapped") fail(`${field} has an invalid review status`);
  return value;
}

function reviewIndex(value: PlatformPoolMatrixRepoInputs["reviews"]): Map<string, PlatformPoolReviewFact> {
  if (value === undefined) return new Map();
  const rows: readonly PlatformPoolReviewFact[] = value === undefined
    ? []
    : Array.isArray(value)
      ? value
      : [...value.entries()].map(([currentAccountKey, status]) => ({ currentAccountKey, reviewStatus: status }));
  if (!Array.isArray(rows)) fail("reviews must be an array or map");
  const index = new Map<string, PlatformPoolReviewFact>();
  for (const [position, row] of rows.entries()) {
    if (typeof row !== "object" || row === null || Array.isArray(row)) fail(`reviews[${position}] must be an object`);
    const currentAccountKey = nonEmpty(row.currentAccountKey, `reviews[${position}].currentAccountKey`);
    if (index.has(currentAccountKey)) fail(`reviews[${position}] duplicates ${currentAccountKey}`);
    const membership = row.reviewedPoolMembership;
    let normalizedMembership: PlatformPoolReviewFact["reviewedPoolMembership"] = membership;
    if (membership !== undefined && membership !== null && membership !== "unknown") {
      if (!Array.isArray(membership)) fail(`reviews[${position}].reviewedPoolMembership must be an array, null, unknown, or absent`);
      const seen = new Set<string>();
      const normalizedRows: Array<{ readonly pool: PoolName; readonly reason: string }> = [];
      for (const [membershipIndex, item] of membership.entries()) {
        if (typeof item !== "object" || item === null || Array.isArray(item)) fail(`reviews[${position}].reviewedPoolMembership[${membershipIndex}] must be an object`);
        const pool = nonEmpty(item.pool, `reviews[${position}].reviewedPoolMembership[${membershipIndex}].pool`).toLowerCase();
        if (!(POOL_NAMES as readonly string[]).includes(pool)) fail(`reviews[${position}].reviewedPoolMembership[${membershipIndex}].pool is not recognized`);
        const reason = nonEmpty(item.reason, `reviews[${position}].reviewedPoolMembership[${membershipIndex}].reason`);
        if (seen.has(pool)) fail(`reviews[${position}].reviewedPoolMembership duplicates ${pool}`);
        seen.add(pool);
        normalizedRows.push({ pool: pool as PoolName, reason });
      }
      normalizedRows.sort((left, right) => left.pool.localeCompare(right.pool));
      normalizedMembership = normalizedRows;
    }
    let normalizedMedium: PlatformPoolReviewFact["medium"] = row.medium;
    let normalizedFormat: PlatformPoolReviewFact["format"] = row.format;
    for (const field of ["medium", "format"] as const) {
      const candidate = row[field];
      if (candidate !== undefined && candidate !== null && candidate !== "unknown") {
        const normalized = nonEmpty(candidate, `reviews[${position}].${field}`);
        if (field === "medium") normalizedMedium = normalized;
        else normalizedFormat = normalized;
      }
    }
    index.set(currentAccountKey, {
      currentAccountKey,
      reviewStatus: reviewStatus(row.reviewStatus, `reviews[${position}].reviewStatus`),
      ...(membership !== undefined ? { reviewedPoolMembership: normalizedMembership } : {}),
      ...(row.medium !== undefined ? { medium: normalizedMedium } : {}),
      ...(row.format !== undefined ? { format: normalizedFormat } : {}),
    });
  }
  return index;
}

function baselineIndex(value: PlatformPoolMatrixRepoInputs["baselines"]): Set<string> {
  if (value === undefined) return new Set();
  if (value instanceof Map) {
    const keys = new Set<string>();
    for (const [key, fact] of value.entries()) {
      const normalized = nonEmpty(key, "baseline key");
      if (fact === null || fact === false || fact === undefined) fail(`baseline ${normalized} has no explicit fact`);
      keys.add(normalized);
    }
    return keys;
  }
  if (!Array.isArray(value)) fail("baselines must be an array or map");
  const keys = new Set<string>();
  for (const [position, fact] of value.entries()) {
    if (typeof fact === "string") {
      keys.add(nonEmpty(fact, `baselines[${position}]`));
    } else if (typeof fact === "object" && fact !== null && !Array.isArray(fact)) {
      const baseline = fact as Pick<AccountBaseline, "platform" | "handle">;
      keys.add(accountKey({ platform: nonEmpty(baseline.platform, `baselines[${position}].platform`) as AccountBaseline["platform"], handle: nonEmpty(baseline.handle, `baselines[${position}].handle`) }));
    } else {
      fail(`baselines[${position}] must be an account key or baseline account fact`);
    }
  }
  return keys;
}

function normalizedPools(review: PlatformPoolReviewFact | undefined): PoolName[] {
  if (!review || !Array.isArray(review.reviewedPoolMembership)) return [];
  return [...new Set(review.reviewedPoolMembership.map((membership) => membership.pool))].sort();
}

function label(value: string | "unknown" | null | undefined, field: string): { value: string | null; blocker: string | null } {
  if (value === undefined || value === null || value === "unknown" || value.trim() === "") return { value: null, blocker: `${field} label absent from reviewed metadata` };
  return { value, blocker: null };
}

function targetFor(row: CatalogRow, pool: PoolName, review: PlatformPoolReviewFact | undefined, baselines: Set<string>): PlatformPoolMatrixTarget {
  const medium = label(review?.medium, "medium");
  const format = label(review?.format, "format");
  const status = review?.reviewStatus ?? "unreviewed";
  const blockers = [
    !row.configured ? "target not configured" : null,
    !row.collected ? "source not collected" : null,
    status === "reviewed" ? null : `review status is ${status}`,
    baselines.has(row.key) ? null : "baseline not measured",
    medium.blocker,
    format.blocker,
  ].filter((value): value is string => value !== null);
  return {
    id: row.key,
    platform: row.platform,
    researchPool: pool,
    medium: medium.value,
    format: format.value,
    configured: row.configured,
    collected: row.collected,
    reviewStatus: status,
    baselineReady: baselines.has(row.key),
    blockers,
  };
}

/**
 * Populates the explicit matrix only from exact catalog/review/baseline facts. Pool, medium, and
 * format values come from reviewed metadata; catalog labels remain context-only. Rows without a
 * reviewed pool become blockedTargets rather than being silently assigned to niche.
 */
export function buildPlatformPoolMatrixRepoReport(
  catalog: PatternCatalog,
  inputs: PlatformPoolMatrixRepoInputs = {},
): PlatformPoolMatrixRepoReport {
  if (!catalog || !Array.isArray(catalog.rows)) fail("catalog must contain rows");
  const reviews = reviewIndex(inputs.reviews);
  const baselines = baselineIndex(inputs.baselines);
  const blockedTargets: PlatformPoolMatrixBlockedTarget[] = [];
  const targets: PlatformPoolMatrixTarget[] = [];
  for (const row of catalog.rows) {
    const review = reviews.get(row.key);
    const pools = normalizedPools(review);
    if (pools.length === 0) {
      blockedTargets.push({
        id: row.key,
        platform: row.platform,
        researchPools: [...row.researchPools],
        blockers: [
          review === undefined ? "review metadata is missing" : "reviewed research pool membership absent",
          ...(review?.reviewStatus && review.reviewStatus !== "reviewed" ? [`review status is ${review.reviewStatus}`] : []),
        ],
      });
      continue;
    }
    for (const pool of pools) targets.push(targetFor(row, pool, review, baselines));
  }
  const matrix = buildPlatformPoolMatrix(targets);
  return {
    ...matrix,
    kind: "platform_pool_matrix_repo",
    version: PLATFORM_POOL_MATRIX_REPO_VERSION,
    blockedTargets: blockedTargets.sort((left, right) => left.id.localeCompare(right.id)),
  };
}

export const createPlatformPoolMatrixRepoReport = buildPlatformPoolMatrixRepoReport;
