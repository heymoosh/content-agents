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

function reviewIndex(value: PlatformPoolMatrixRepoInputs["reviews"]): Map<string, MatrixReviewStatus> {
  if (value === undefined) return new Map();
  const rows = value instanceof Map ? [...value.entries()].map(([currentAccountKey, status]) => ({ currentAccountKey, reviewStatus: status })) : value;
  if (!Array.isArray(rows)) fail("reviews must be an array or map");
  const index = new Map<string, MatrixReviewStatus>();
  for (const [position, row] of rows.entries()) {
    if (typeof row !== "object" || row === null || Array.isArray(row)) fail(`reviews[${position}] must be an object`);
    const currentAccountKey = nonEmpty(row.currentAccountKey, `reviews[${position}].currentAccountKey`);
    if (index.has(currentAccountKey)) fail(`reviews[${position}] duplicates ${currentAccountKey}`);
    index.set(currentAccountKey, reviewStatus(row.reviewStatus, `reviews[${position}].reviewStatus`));
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

function normalizedPools(row: CatalogRow): PoolName[] {
  return [...new Set(row.researchPools.filter((pool): pool is PoolName => (POOL_NAMES as readonly string[]).includes(pool)))].sort();
}

function label(value: readonly string[], field: string): { value: string | null; blocker: string | null } {
  if (value.length === 0) return { value: null, blocker: `${field} label absent` };
  if (value.length > 1) return { value: null, blocker: `multiple ${field} labels lack explicit tuple provenance` };
  return { value: value[0], blocker: null };
}

function targetFor(row: CatalogRow, pool: PoolName, reviews: Map<string, MatrixReviewStatus>, baselines: Set<string>): PlatformPoolMatrixTarget {
  const medium = label(row.mediaForms, "medium");
  const format = label(row.formats, "format");
  const status = reviews.get(row.key) ?? "unreviewed";
  const blockers = [
    !row.configured ? "target not configured" : null,
    !row.collected ? "source not collected" : null,
    status === "reviewed" ? null : `review status is ${status}`,
    baselines.has(row.key) ? null : "baseline not measured",
    medium.blocker,
    format.blocker,
    row.researchPools.some((pool) => !(POOL_NAMES as readonly string[]).includes(pool)) ? "one or more research pool labels are not recognized" : null,
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
 * Populates the explicit matrix only from exact catalog/review/baseline facts. It never
 * cross-products independent catalog arrays: multiple media or format labels become null with a
 * provenance blocker, and rows without a recognized pool become blockedTargets rather than being
 * silently assigned to niche.
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
    const pools = normalizedPools(row);
    const invalidPool = row.researchPools.some((pool) => !(POOL_NAMES as readonly string[]).includes(pool));
    if (pools.length === 0) {
      blockedTargets.push({
        id: row.key,
        platform: row.platform,
        researchPools: [...row.researchPools],
        blockers: [row.researchPools.length === 0 ? "research pool label absent" : "research pool is not a recognized matrix pool"],
      });
      continue;
    }
    for (const pool of pools) targets.push(targetFor(row, pool, reviews, baselines));
    if (invalidPool) {
      // The valid explicit pool rows remain usable, while the unrecognized label is retained as a
      // blocker on those rows instead of being silently discarded.
    }
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
