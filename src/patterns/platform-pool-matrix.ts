import type { PoolName } from "./pool-evidence.js";

export const PLATFORM_POOL_MATRIX_VERSION = "platform-pool-matrix-v1" as const;

export type MatrixReviewStatus = "reviewed" | "unreviewed" | "pending" | "blocked" | "unmapped";

/** One explicit target/catalog row. No field is derived by this report. */
export interface PlatformPoolMatrixTarget {
  readonly id: string;
  readonly platform: string;
  readonly researchPool: PoolName;
  readonly medium: string | null;
  readonly format: string | null;
  readonly configured: boolean;
  readonly collected: boolean;
  readonly reviewStatus: MatrixReviewStatus;
  readonly baselineReady: boolean;
  readonly blockers: readonly string[];
}

export interface PlatformPoolMatrixGaps {
  readonly notConfigured: number;
  readonly notCollected: number;
  readonly notReviewed: number;
  readonly baselineNotReady: number;
}

export interface PlatformPoolMatrixCell {
  readonly platform: string;
  readonly researchPool: PoolName;
  readonly medium: string | null;
  readonly format: string | null;
  readonly targetIds: readonly string[];
  readonly total: number;
  readonly configured: number;
  readonly collected: number;
  readonly reviewed: number;
  readonly baselineReady: number;
  readonly blocked: number;
  readonly unreviewed: number;
  readonly pending: number;
  readonly unmapped: number;
  readonly gaps: PlatformPoolMatrixGaps;
}

export interface PlatformPoolMatrix {
  readonly kind: "platform_pool_matrix";
  readonly version: typeof PLATFORM_POOL_MATRIX_VERSION;
  readonly cells: readonly PlatformPoolMatrixCell[];
  readonly targets: readonly PlatformPoolMatrixTarget[];
  readonly summary: {
    readonly total: number;
    readonly configured: number;
    readonly collected: number;
    readonly reviewed: number;
    readonly baselineReady: number;
    readonly blocked: number;
    readonly unreviewed: number;
    readonly pending: number;
    readonly unmapped: number;
    readonly gaps: PlatformPoolMatrixGaps;
  };
  readonly bodyIncluded: false;
  readonly sideEffects: "none";
}

function compareNullable(left: string | null, right: string | null): number {
  if (left === right) return 0;
  if (left === null) return -1;
  if (right === null) return 1;
  return left < right ? -1 : 1;
}

function compareTargets(left: PlatformPoolMatrixTarget, right: PlatformPoolMatrixTarget): number {
  return compareNullable(left.platform, right.platform)
    || compareNullable(left.researchPool, right.researchPool)
    || compareNullable(left.medium, right.medium)
    || compareNullable(left.format, right.format)
    || compareNullable(left.id, right.id);
}

function sameCell(left: PlatformPoolMatrixTarget, right: PlatformPoolMatrixTarget): boolean {
  return left.platform === right.platform
    && left.researchPool === right.researchPool
    && left.medium === right.medium
    && left.format === right.format;
}

function gaps(rows: readonly PlatformPoolMatrixTarget[]): PlatformPoolMatrixGaps {
  return {
    notConfigured: rows.filter((row) => !row.configured).length,
    notCollected: rows.filter((row) => !row.collected).length,
    notReviewed: rows.filter((row) => row.reviewStatus !== "reviewed").length,
    baselineNotReady: rows.filter((row) => !row.baselineReady).length,
  };
}

function cellFor(rows: readonly PlatformPoolMatrixTarget[]): PlatformPoolMatrixCell {
  const first = rows[0];
  const cellGaps = gaps(rows);
  return {
    platform: first.platform,
    researchPool: first.researchPool,
    medium: first.medium,
    format: first.format,
    targetIds: rows.map((row) => row.id),
    total: rows.length,
    configured: rows.filter((row) => row.configured).length,
    collected: rows.filter((row) => row.collected).length,
    reviewed: rows.filter((row) => row.reviewStatus === "reviewed").length,
    baselineReady: rows.filter((row) => row.baselineReady).length,
    blocked: rows.filter((row) => row.reviewStatus === "blocked").length,
    unreviewed: rows.filter((row) => row.reviewStatus === "unreviewed").length,
    pending: rows.filter((row) => row.reviewStatus === "pending").length,
    unmapped: rows.filter((row) => row.reviewStatus === "unmapped").length,
    gaps: cellGaps,
  };
}

/** Build a deterministic, body-free matrix from explicit target rows only. */
export function buildPlatformPoolMatrix(targets: readonly PlatformPoolMatrixTarget[]): PlatformPoolMatrix {
  const orderedTargets = targets.map((target) => ({ ...target, blockers: [...target.blockers] })).sort(compareTargets);
  const cells: PlatformPoolMatrixCell[] = [];
  for (const target of orderedTargets) {
    const previous = cells[cells.length - 1];
    const cellRows = orderedTargets.filter((candidate) => sameCell(candidate, target));
    if (previous && previous.platform === target.platform && previous.researchPool === target.researchPool
      && previous.medium === target.medium && previous.format === target.format) continue;
    cells.push(cellFor(cellRows));
  }
  const summaryGaps = gaps(orderedTargets);
  return {
    kind: "platform_pool_matrix",
    version: PLATFORM_POOL_MATRIX_VERSION,
    cells,
    targets: orderedTargets,
    summary: {
      total: orderedTargets.length,
      configured: orderedTargets.filter((row) => row.configured).length,
      collected: orderedTargets.filter((row) => row.collected).length,
      reviewed: orderedTargets.filter((row) => row.reviewStatus === "reviewed").length,
      baselineReady: orderedTargets.filter((row) => row.baselineReady).length,
    blocked: orderedTargets.filter((row) => row.reviewStatus === "blocked").length,
    unreviewed: orderedTargets.filter((row) => row.reviewStatus === "unreviewed").length,
    pending: orderedTargets.filter((row) => row.reviewStatus === "pending").length,
    unmapped: orderedTargets.filter((row) => row.reviewStatus === "unmapped").length,
      gaps: summaryGaps,
    },
    bodyIncluded: false,
    sideEffects: "none",
  };
}

export function renderPlatformPoolMatrixJson(matrix: PlatformPoolMatrix): string {
  return `${JSON.stringify(matrix, null, 2)}\n`;
}

function markdownCell(value: string | number | null): string {
  return String(value ?? "null").replaceAll("|", "\\|").replaceAll("\n", "<br>");
}

/** Render only matrix metadata and explicit target state. No body or creator claims are emitted. */
export function renderPlatformPoolMatrixMarkdown(matrix: PlatformPoolMatrix): string {
  const s = matrix.summary;
  const lines = [
    "# Platform × research-pool coverage matrix",
    "",
    `Targets: ${s.total} | configured ${s.configured} | collected ${s.collected} | reviewed ${s.reviewed} | baseline-ready ${s.baselineReady} | blocked ${s.blocked} | unreviewed ${s.unreviewed} | pending ${s.pending} | unmapped ${s.unmapped}`,
    `Gaps: not configured ${s.gaps.notConfigured} | not collected ${s.gaps.notCollected} | not reviewed ${s.gaps.notReviewed} | baseline not ready ${s.gaps.baselineNotReady}`,
    "",
    "| Platform | Pool | Medium | Format | Targets | Configured | Collected | Reviewed | Baseline-ready | Blocked | Unreviewed | Pending | Unmapped | Gaps (config / collection / review / baseline) |",
    "|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|",
    ...matrix.cells.map((cell) => `| ${markdownCell(cell.platform)} | ${cell.researchPool} | ${markdownCell(cell.medium)} | ${markdownCell(cell.format)} | ${cell.total} | ${cell.configured} | ${cell.collected} | ${cell.reviewed} | ${cell.baselineReady} | ${cell.blocked} | ${cell.unreviewed} | ${cell.pending} | ${cell.unmapped} | ${cell.gaps.notConfigured} / ${cell.gaps.notCollected} / ${cell.gaps.notReviewed} / ${cell.gaps.baselineNotReady} |`),
    "",
    "Rows remain explicit catalog/target state. Missing labels are not inferred, and this report does not identify best creators.",
    "",
  ];
  return lines.join("\n");
}
