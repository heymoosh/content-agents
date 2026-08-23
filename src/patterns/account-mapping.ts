import { buildCatalog, loadCatalogInputs } from "./catalog.js";
import type { PatternCatalog } from "./catalog.js";

export type AccountMappingDisposition = "needs-review" | "unmapped";

export interface AccountMappingRow {
  currentAccountKey: string;
  derivedAccountId: string;
  accountIdStatus: "derived";
  platform: string;
  handle: string | null;
  creator: string | null;
  mappingDisposition: AccountMappingDisposition;
  evidenceCount: number;
  humanReviewNote: string;
}

export interface AccountMappingArtifact {
  rows: AccountMappingRow[];
  summary: {
    total: number;
    needsReview: number;
    unmapped: number;
    evidenceCount: number;
  };
}

const REVIEW_NOTE = "Derived ID is not yet opaque/reviewed; human review is required before adoption.";

/** Build the review artifact without reading or mutating the corpus. */
export function buildAccountMapping(catalog: PatternCatalog): AccountMappingArtifact {
  const rows = catalog.rows.map((row): AccountMappingRow => ({
    currentAccountKey: row.key,
    derivedAccountId: row.accountId,
    accountIdStatus: "derived",
    platform: row.platform,
    handle: row.handle,
    creator: row.creator,
    mappingDisposition: "needs-review",
    evidenceCount: row.evidenceCount,
    humanReviewNote: REVIEW_NOTE,
  })).sort((a, b) => a.currentAccountKey < b.currentAccountKey ? -1 : a.currentAccountKey > b.currentAccountKey ? 1 : 0);

  return {
    rows,
    summary: {
      total: rows.length,
      needsReview: rows.filter((row) => row.mappingDisposition === "needs-review").length,
      unmapped: rows.filter((row) => row.mappingDisposition === "unmapped").length,
      evidenceCount: rows.reduce((sum, row) => sum + row.evidenceCount, 0),
    },
  };
}

export function renderAccountMappingMarkdown(mapping: AccountMappingArtifact): string {
  const cell = (value: string | null): string => (value ?? "unknown").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
  const { summary } = mapping;
  const lines = [
    "# Account identity mapping review",
    "",
    `Total rows: ${summary.total} | Needs review: ${summary.needsReview} | Unmapped: ${summary.unmapped} | Evidence: ${summary.evidenceCount}`,
    "",
    "| Current account key | Derived account ID | Account ID status | Platform | Handle | Creator | Mapping disposition | Evidence count | Human review note |",
    "|---|---|---|---|---|---|---|---:|---|",
  ];
  for (const row of mapping.rows) {
    lines.push(`| ${cell(row.currentAccountKey)} | ${cell(row.derivedAccountId)} | ${row.accountIdStatus} | ${cell(row.platform)} | ${cell(row.handle)} | ${cell(row.creator)} | ${row.mappingDisposition} | ${row.evidenceCount} | ${cell(row.humanReviewNote)} |`);
  }
  return `${lines.join("\n")}\n`;
}

export function main(
  argv: string[] = process.argv.slice(2),
  loadInputs: typeof loadCatalogInputs = loadCatalogInputs,
): number {
  const format = argv.includes("--format") && argv[argv.indexOf("--format") + 1] === "markdown" ? "markdown" : "json";
  const inputs = loadInputs();
  const mapping = buildAccountMapping(buildCatalog(inputs.config, inputs.corpus, inputs.analyses));
  process.stdout.write(format === "markdown"
    ? renderAccountMappingMarkdown(mapping)
    : `${JSON.stringify(mapping, null, 2)}\n`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = main();
