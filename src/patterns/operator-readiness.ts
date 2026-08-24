import type { ComparisonReadinessInventory } from "./comparison-readiness.js";

/** Deterministic operator view; this is coverage accounting, never ranking or winner selection. */
export const OPERATOR_READINESS_VERSION = "operator-readiness-v1" as const;
type Bucket = { total: number; ready: number; blocked: number };
type Dimension = Record<string, Bucket>;

export interface OperatorReadiness {
  readonly kind: "pattern_operator_readiness";
  readonly version: typeof OPERATOR_READINESS_VERSION;
  readonly summary: Bucket & { readinessRate: number | null };
  readonly byPool: Dimension;
  readonly byPlatform: Dimension;
  readonly byMedium: Dimension;
  readonly byFormat: Dimension;
  readonly gaps: string[];
  readonly sideEffects: "none";
}

function bucket(): Bucket { return { total: 0, ready: 0, blocked: 0 }; }
function add(dimension: Dimension, key: string, ready: boolean): void {
  const current = dimension[key] ?? bucket();
  current.total += 1;
  if (ready) current.ready += 1; else current.blocked += 1;
  dimension[key] = current;
}
function sortedDimension(dimension: Dimension): Dimension {
  return Object.fromEntries(Object.entries(dimension).sort(([left], [right]) => left.localeCompare(right)));
}

export function buildOperatorReadiness(inventory: ComparisonReadinessInventory): OperatorReadiness {
  const rows = [...inventory.rows].sort((left, right) => left.id.localeCompare(right.id));
  const byPool: Dimension = {};
  const byPlatform: Dimension = {};
  const byMedium: Dimension = {};
  const byFormat: Dimension = {};
  const gaps = new Set<string>();
  let ready = 0;
  for (const row of rows) {
    const isReady = row.readiness.status === "ready";
    if (isReady) ready += 1;
    add(byPool, row.pool ?? "unassigned", isReady);
    add(byPlatform, row.platform ?? "unknown", isReady);
    add(byMedium, row.medium ?? "unknown", isReady);
    add(byFormat, row.format ?? "unknown", isReady);
    for (const blocker of row.readiness.blockers) gaps.add(blocker);
  }
  const total = rows.length;
  return {
    kind: "pattern_operator_readiness",
    version: OPERATOR_READINESS_VERSION,
    summary: { total, ready, blocked: total - ready, readinessRate: total === 0 ? null : ready / total },
    byPool: sortedDimension(byPool),
    byPlatform: sortedDimension(byPlatform),
    byMedium: sortedDimension(byMedium),
    byFormat: sortedDimension(byFormat),
    gaps: [...gaps].sort(),
    sideEffects: "none",
  };
}

export const createOperatorReadiness = buildOperatorReadiness;
