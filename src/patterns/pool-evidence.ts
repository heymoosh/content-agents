import { buildCatalog, loadCatalogInputs } from "./catalog.js";
import type { CatalogAudience, CatalogRow, PatternCatalog } from "./catalog.js";

export const POOL_NAMES = ["niche", "broad", "format"] as const;
export type PoolName = (typeof POOL_NAMES)[number];

type CatalogRowWithPoolReasons = CatalogRow & {
  poolMembershipReasons?: Partial<Record<PoolName, string | null>>;
};

export interface PoolEvidenceReadiness {
  status: "ready" | "blocked";
  reason: string;
}

export interface PoolEvidenceRow {
  accountId: string;
  platform: string;
  handle: string | null;
  creator: string | null;
  niche: string | null;
  topics: string[];
  focus: string[];
  formats: string[];
  audience: CatalogAudience;
  pool: PoolName | null;
  membershipReason: string | null;
  popularityScopes: string[];
  sampleScopes: string[];
  baselineSources: string[];
  evidenceCount: number;
  admissibleCount: number;
  bodyCompleteCount: number;
  bodyIncompleteCount: number;
  caveats: string[];
  readiness: PoolEvidenceReadiness;
  /** Account rows are never comparison-ready; source/post evidence is the comparison authority. */
  comparisonReadiness: PoolEvidenceReadiness;
}

export interface PoolEvidenceInventory {
  rows: PoolEvidenceRow[];
  summary: {
    poolCounts: Record<PoolName, number>;
    blockedAccounts: string[];
  };
}

const READY_REASON = "Explicit pool membership is available for inspection.";
const BLOCKED_REASON = "Blocked: no explicit pool membership; classification was not inferred from niche or name.";

function poolName(value: string): PoolName | null {
  const normalized = value.trim().toLowerCase();
  return (POOL_NAMES as readonly string[]).includes(normalized) ? normalized as PoolName : null;
}

function compareValues(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function membershipReason(row: CatalogRow, pool: PoolName): string | null {
  const reasons = (row as CatalogRowWithPoolReasons).poolMembershipReasons;
  const reason = reasons?.[pool];
  return typeof reason === "string" && reason.trim() ? reason.trim() : null;
}

function copyRow(row: CatalogRow, pool: PoolName | null): PoolEvidenceRow {
  return {
    accountId: row.accountId,
    platform: row.platform,
    handle: row.handle,
    creator: row.creator,
    niche: row.niche,
    topics: [...row.topics],
    focus: [...row.focus],
    formats: [...row.formats],
    audience: { ...row.audience },
    pool,
    membershipReason: pool === null ? null : membershipReason(row, pool),
    popularityScopes: [...row.popularityScopes],
    sampleScopes: [...row.sampleScopes],
    baselineSources: [...row.baselineSources],
    evidenceCount: row.evidenceCount,
    admissibleCount: row.admissibleCount,
    bodyCompleteCount: row.bodyCompleteCount,
    bodyIncompleteCount: row.bodyIncompleteCount,
    caveats: [...row.caveats],
    readiness: pool === null
      ? { status: "blocked", reason: BLOCKED_REASON }
      : { status: "ready", reason: READY_REASON },
    comparisonReadiness: {
      status: "blocked",
      reason: "Blocked: account inventory is a rollup; linked source/post evidence is required for comparison.",
    },
  };
}

function compareRows(left: PoolEvidenceRow, right: PoolEvidenceRow): number {
  return compareValues(left.accountId, right.accountId)
    || compareValues(left.pool ?? "", right.pool ?? "");
}

/** Build a read-only inventory from normalized catalog rows without classifying unassigned accounts. */
export function buildPoolEvidenceInventory(catalog: PatternCatalog): PoolEvidenceInventory {
  const rows = catalog.rows.flatMap((row) => {
    const pools = [...new Set(row.researchPools.map(poolName).filter((pool): pool is PoolName => pool !== null))].sort(compareValues);
    return pools.length ? pools.map((pool) => copyRow(row, pool)) : [copyRow(row, null)];
  }).sort(compareRows);
  const blockedAccounts = [...new Set(rows.filter((row) => row.pool === null).map((row) => row.accountId))].sort(compareValues);

  return {
    rows,
    summary: {
      poolCounts: {
        niche: rows.filter((row) => row.pool === "niche").length,
        broad: rows.filter((row) => row.pool === "broad").length,
        format: rows.filter((row) => row.pool === "format").length,
      },
      blockedAccounts,
    },
  };
}

export function renderPoolEvidenceJson(inventory: PoolEvidenceInventory): string {
  const ordered = {
    rows: [...inventory.rows].sort(compareRows),
    summary: {
      poolCounts: {
        niche: inventory.summary.poolCounts.niche,
        broad: inventory.summary.poolCounts.broad,
        format: inventory.summary.poolCounts.format,
      },
      blockedAccounts: [...inventory.summary.blockedAccounts].sort(compareValues),
    },
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

function markdownCell(value: string | null): string {
  return (value ?? "null").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function markdownList(values: string[]): string {
  return markdownCell(values.length ? values.join(", ") : null);
}

function audienceSnapshot(audience: CatalogAudience): string {
  if (audience.size === null && audience.countType === null && audience.provenance === null && audience.asOf === null) return "null";
  return [
    audience.size === null ? "null" : audience.size.toString(),
    audience.countType ?? "null",
    audience.provenance ?? "null",
    audience.asOf ?? "null",
  ].join("/");
}

function completeness(row: PoolEvidenceRow): string {
  return `${row.evidenceCount} / ${row.admissibleCount} / ${row.bodyCompleteCount} / ${row.bodyIncompleteCount}`;
}

export function renderPoolEvidenceMarkdown(inventory: PoolEvidenceInventory): string {
  const { poolCounts, blockedAccounts } = inventory.summary;
  const rows = [...inventory.rows].sort(compareRows);
  const lines = [
    "# Pool evidence inventory",
    "",
    `Pool counts: niche ${poolCounts.niche} | broad ${poolCounts.broad} | format ${poolCounts.format} | blocked ${blockedAccounts.length}`,
    `Blocked accounts: ${blockedAccounts.length ? blockedAccounts.map(markdownCell).join(", ") : "none"}`,
    "",
    "| Account ID | Platform | Handle | Creator | Niche | Topics | Focus | Formats | Audience | Pool | Membership reason | Popularity scopes | Sample scopes | Baseline sources | Evidence/admissible/body-complete/body-incomplete | Caveats | Readiness | Comparison readiness |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---:|---|---|---|",
  ];
  for (const row of rows) {
    lines.push(`| ${markdownCell(row.accountId)} | ${markdownCell(row.platform)} | ${markdownCell(row.handle)} | ${markdownCell(row.creator)} | ${markdownCell(row.niche)} | ${markdownList(row.topics)} | ${markdownList(row.focus)} | ${markdownList(row.formats)} | ${markdownCell(audienceSnapshot(row.audience))} | ${markdownCell(row.pool)} | ${markdownCell(row.membershipReason)} | ${markdownList(row.popularityScopes)} | ${markdownList(row.sampleScopes)} | ${markdownList(row.baselineSources)} | ${completeness(row)} | ${markdownList(row.caveats)} | ${row.readiness.status}: ${markdownCell(row.readiness.reason)} | ${row.comparisonReadiness.status}: ${markdownCell(row.comparisonReadiness.reason)} |`);
  }
  return `${lines.join("\n")}\n`;
}

export const buildPoolEvidenceReport = buildPoolEvidenceInventory;

export function main(argv: string[] = process.argv.slice(2)): number {
  const format = argv.includes("--format") && argv[argv.indexOf("--format") + 1] === "markdown"
    ? "markdown"
    : "json";
  const inputs = loadCatalogInputs();
  const inventory = buildPoolEvidenceInventory(buildCatalog(inputs.config, inputs.corpus, inputs.analyses));
  process.stdout.write(format === "markdown"
    ? renderPoolEvidenceMarkdown(inventory)
    : renderPoolEvidenceJson(inventory));
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = main();
