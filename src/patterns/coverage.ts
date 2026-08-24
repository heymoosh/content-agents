import type { PatternCatalog, CatalogRow } from "./catalog.js";
import { buildCatalog, loadCatalogInputs } from "./catalog.js";

export type EvidenceState = "none" | "present";
export type CoverageDimension = string | null;

export interface CoverageCell {
  platform: string;
  researchPool: CoverageDimension;
  topic: CoverageDimension;
  format: CoverageDimension;
  evidenceState: EvidenceState;
  accountCount: number;
  evidenceCount: number;
  admissibleCount: number;
  bodyCompleteCount: number;
  bodyIncompleteCount: number;
}

export interface CoverageAccountRow {
  accountId: string;
  platform: string;
  handle: string | null;
  creator: string | null;
  niche: string | null;
  audience: {
    size: number | null;
    countType: string | null;
    provenance: string | null;
    asOf: string | null;
  };
  topics: string[];
  focus: string[];
  researchPools: string[];
  popularityScopes: string[];
  sampleScopes: string[];
  baselineSources: string[];
  formats: string[];
  evidenceCount: number;
  caveats: string[];
}

export interface CoverageReport {
  accountRows: CoverageAccountRow[];
  cells: CoverageCell[];
  summary: {
    accountCount: number;
    evidenceCount: number;
    admissibleCount: number;
    bodyCompleteCount: number;
    bodyIncompleteCount: number;
  };
  gaps: {
    noTopicAccountIds: string[];
    noFocusAccountIds: string[];
    noResearchPoolAccountIds: string[];
    noPopularityScopeAccountIds: string[];
    noSampleScopeAccountIds: string[];
    noBaselineSourceAccountIds: string[];
  };
  note: string;
}

function values(values: string[]): CoverageDimension[] {
  return values.length ? values : [null];
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function cellKey(cell: Pick<CoverageCell, "platform" | "researchPool" | "topic" | "format" | "evidenceState">): string[] {
  return [cell.platform, cell.researchPool ?? "", cell.topic ?? "", cell.format ?? "", cell.evidenceState];
}

function compareCells(a: CoverageCell, b: CoverageCell): number {
  const left = cellKey(a);
  const right = cellKey(b);
  for (let i = 0; i < left.length; i++) {
    const result = compare(left[i], right[i]);
    if (result !== 0) return result;
  }
  return 0;
}

function accountRow(row: CatalogRow): CoverageAccountRow {
  return {
    accountId: row.accountId,
    platform: row.platform,
    handle: row.handle,
    creator: row.creator,
    niche: row.niche,
    audience: { ...row.audience },
    topics: [...row.topics],
    focus: [...row.focus],
    researchPools: [...row.researchPools],
    popularityScopes: [...row.popularityScopes],
    sampleScopes: [...row.sampleScopes],
    baselineSources: [...row.baselineSources],
    formats: [...row.formats],
    evidenceCount: row.evidenceCount,
    caveats: [...row.caveats],
  };
}

function addRow(cells: Map<string, CoverageCell>, row: CatalogRow): void {
  const platform = row.platform || "null";
  const evidenceState: EvidenceState = row.evidenceCount > 0 ? "present" : "none";
  for (const researchPool of values(row.researchPools)) {
    for (const topic of values(row.topics)) {
      for (const format of values(row.formats)) {
        const cell: CoverageCell = {
          platform, researchPool, topic, format, evidenceState,
          accountCount: 0, evidenceCount: 0, admissibleCount: 0,
          bodyCompleteCount: 0, bodyIncompleteCount: 0,
        };
        const key = cellKey(cell).join("\u0000");
        const existing = cells.get(key) ?? cell;
        existing.accountCount += 1;
        existing.evidenceCount += row.evidenceCount;
        existing.admissibleCount += row.admissibleCount;
        existing.bodyCompleteCount += row.bodyCompleteCount;
        existing.bodyIncompleteCount += row.bodyIncompleteCount;
        cells.set(key, existing);
      }
    }
  }
}

export function buildCoverageReport(catalog: PatternCatalog): CoverageReport {
  const cells = new Map<string, CoverageCell>();
  for (const row of catalog.rows) addRow(cells, row);
  const rows = [...catalog.rows].sort((a, b) => compare(a.accountId, b.accountId));
  return {
    cells: [...cells.values()].sort(compareCells),
    accountRows: rows.map(accountRow),
    summary: {
      accountCount: catalog.rows.length,
      evidenceCount: catalog.summary.evidenceCount,
      admissibleCount: catalog.summary.admissibleCount,
      bodyCompleteCount: catalog.summary.bodyCompleteCount,
      bodyIncompleteCount: catalog.summary.bodyIncompleteCount,
    },
    gaps: {
      noTopicAccountIds: rows.filter((row) => row.topics.length === 0).map((row) => row.accountId),
      noFocusAccountIds: rows.filter((row) => row.focus.length === 0).map((row) => row.accountId),
      noResearchPoolAccountIds: rows.filter((row) => row.researchPools.length === 0).map((row) => row.accountId),
      noPopularityScopeAccountIds: rows.filter((row) => row.popularityScopes.length === 0).map((row) => row.accountId),
      noSampleScopeAccountIds: rows.filter((row) => row.sampleScopes.length === 0).map((row) => row.accountId),
      noBaselineSourceAccountIds: rows.filter((row) => row.baselineSources.length === 0).map((row) => row.accountId),
    },
    note: "Descriptive catalog coverage only. This report does not claim representativeness. Null dimensions were not collected or not yet normalized. Cell account counts fan out across dimensions and are not additive.",
  };
}

export function renderCoverageJson(report: CoverageReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

function markdownCell(value: CoverageDimension): string {
  return (value ?? "null").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function markdownList(values: string[]): string {
  return markdownCell(values.length ? values.join(", ") : null);
}

function markdownText(value: string | null): string {
  return markdownCell(value);
}

export function renderCoverageMarkdown(report: CoverageReport): string {
  const { gaps, summary } = report;
  const accountWord = (count: number): string => count === 1 ? "account" : "accounts";
  const gapLine = (label: string, ids: string[]): string => {
    const sample = ids.slice(0, 3).join(", ");
    return `${label}: ${ids.length} ${accountWord(ids.length)}${sample ? ` (sample: ${sample}${ids.length > 3 ? ", …" : ""})` : ""}`;
  };
  const lines = [
    "# Pattern coverage",
    "",
    report.note,
    "",
    `Totals: ${summary.accountCount} accounts | ${summary.evidenceCount} evidence | ${summary.admissibleCount} admissible | ${summary.bodyCompleteCount} body-complete | ${summary.bodyIncompleteCount} body-incomplete`,
    "",
    gapLine("No topic", gaps.noTopicAccountIds),
    gapLine("No focus", gaps.noFocusAccountIds),
    gapLine("No research pool", gaps.noResearchPoolAccountIds),
    gapLine("No popularity scope", gaps.noPopularityScopeAccountIds),
    gapLine("No sample scope", gaps.noSampleScopeAccountIds),
    gapLine("No baseline source", gaps.noBaselineSourceAccountIds),
    "",
    "## Account inventory",
    "",
    "Descriptive account metadata only. Unknown values remain null; empty lists indicate no collected value.",
    "",
    "| Account | Platform | Handle | Creator | Niche label | Audience size | Audience type | Audience provenance | Audience as-of | Topics | Focus | Research pools | Popularity scopes | Sample scopes | Baseline sources | Formats | Evidence | Caveats |",
    "|---|---|---|---|---|---:|---|---|---|---|---|---|---|---|---|---|---:|---|",
  ];
  for (const row of report.accountRows) {
    lines.push(`| ${markdownText(row.accountId)} | ${markdownText(row.platform)} | ${markdownText(row.handle)} | ${markdownText(row.creator)} | ${markdownText(row.niche)} | ${row.audience.size ?? "null"} | ${markdownText(row.audience.countType)} | ${markdownText(row.audience.provenance)} | ${markdownText(row.audience.asOf)} | ${markdownList(row.topics)} | ${markdownList(row.focus)} | ${markdownList(row.researchPools)} | ${markdownList(row.popularityScopes)} | ${markdownList(row.sampleScopes)} | ${markdownList(row.baselineSources)} | ${markdownList(row.formats)} | ${row.evidenceCount} | ${markdownList(row.caveats)} |`);
  }
  lines.push(
    "",
    "| Platform | Research pool | Topic | Format | Evidence state | Accounts | Evidence | Admissible | Body-complete | Body-incomplete |",
    "|---|---|---|---|---|---:|---:|---:|---:|---:|",
  );
  for (const cell of report.cells) {
    lines.push(`| ${markdownCell(cell.platform)} | ${markdownCell(cell.researchPool)} | ${markdownCell(cell.topic)} | ${markdownCell(cell.format)} | ${cell.evidenceState} | ${cell.accountCount} | ${cell.evidenceCount} | ${cell.admissibleCount} | ${cell.bodyCompleteCount} | ${cell.bodyIncompleteCount} |`);
  }
  return `${lines.join("\n")}\n`;
}

export function main(argv: string[] = process.argv.slice(2)): number {
  const paths: { config?: string; corpus?: string; analyses?: string } = {};
  let format = "json";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--format" && argv[i + 1]) format = argv[++i];
    else if (argv[i] === "--config" && argv[i + 1]) paths.config = argv[++i];
    else if (argv[i] === "--corpus" && argv[i + 1]) paths.corpus = argv[++i];
    else if (argv[i] === "--analyses" && argv[i + 1]) paths.analyses = argv[++i];
  }
  const inputs = loadCatalogInputs(paths);
  const report = buildCoverageReport(buildCatalog(inputs.config, inputs.corpus, inputs.analyses));
  process.stdout.write(format === "markdown" ? renderCoverageMarkdown(report) : renderCoverageJson(report));
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = main();
