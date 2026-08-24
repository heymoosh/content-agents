import { buildCatalog, loadCatalogInputs } from "./catalog.js";
import type { CatalogAudience, PatternCatalog } from "./catalog.js";

export type AccountMappingDisposition = "needs-review" | "unmapped";

export interface AccountMappingRow {
  currentAccountKey: string;
  derivedAccountId: string;
  accountIdStatus: "derived";
  platform: string;
  handle: string | null;
  creator: string | null;
  niche: string | null;
  audience: CatalogAudience;
  topics: string[];
  focus: string[];
  researchPools: string[];
  popularityScopes: string[];
  sampleScopes: string[];
  baselineSources: string[];
  formats: string[];
  mappingDisposition: AccountMappingDisposition;
  evidenceCount: number;
  readiness: {
    status: "ready" | "blocked";
    blockingFields: string[];
    reason: string;
  };
  humanReviewNote: string;
}

export interface AccountMappingArtifact {
  rows: AccountMappingRow[];
  summary: {
    total: number;
    needsReview: number;
    unmapped: number;
    evidenceCount: number;
    readiness: {
      ready: number;
      blocked: number;
      blockedRows: string[];
    };
  };
}

const REVIEW_NOTE = "Derived ID is not yet opaque/reviewed; human review is required before adoption.";
const REQUIRED_FIELDS = [
  "audience.size",
  "audience.countType",
  "audience.provenance",
  "audience.asOf",
  "topics",
  "focus",
  "researchPools",
  "popularityScopes",
  "sampleScopes",
  "baselineSources",
  "formats",
  "evidenceCount",
] as const;

function missingRequiredFields(row: PatternCatalog["rows"][number]): string[] {
  return REQUIRED_FIELDS.filter((field) => {
    if (field.startsWith("audience.")) {
      const value = row.audience[field.slice("audience.".length) as keyof CatalogAudience];
      return value === null;
    }
    const value = row[field as keyof typeof row];
    return Array.isArray(value) ? value.length === 0 : value === 0;
  });
}

function readinessFor(row: PatternCatalog["rows"][number]): AccountMappingRow["readiness"] {
  const blockingFields = missingRequiredFields(row);
  return blockingFields.length === 0
    ? { status: "ready", blockingFields: [], reason: "Inventory complete; identity still requires human review." }
    : {
      status: "blocked",
      blockingFields,
      reason: `Blocked: missing required fields: ${blockingFields.join(", ")}.`,
    };
}

/** Build the review artifact without reading or mutating the corpus. */
export function buildAccountMapping(catalog: PatternCatalog): AccountMappingArtifact {
  const rows = catalog.rows.map((row): AccountMappingRow => ({
    currentAccountKey: row.key,
    derivedAccountId: row.accountId,
    accountIdStatus: "derived",
    platform: row.platform,
    handle: row.handle,
    creator: row.creator,
    niche: row.niche,
    audience: row.audience,
    topics: row.topics,
    focus: row.focus,
    researchPools: row.researchPools,
    popularityScopes: row.popularityScopes,
    sampleScopes: row.sampleScopes,
    baselineSources: row.baselineSources,
    formats: row.formats,
    mappingDisposition: "needs-review",
    evidenceCount: row.evidenceCount,
    readiness: readinessFor(row),
    humanReviewNote: REVIEW_NOTE,
  })).sort((a, b) => a.currentAccountKey < b.currentAccountKey ? -1 : a.currentAccountKey > b.currentAccountKey ? 1 : 0);

  return {
    rows,
    summary: {
      total: rows.length,
      needsReview: rows.filter((row) => row.mappingDisposition === "needs-review").length,
      unmapped: rows.filter((row) => row.mappingDisposition === "unmapped").length,
      evidenceCount: rows.reduce((sum, row) => sum + row.evidenceCount, 0),
      readiness: {
        ready: rows.filter((row) => row.readiness.status === "ready").length,
        blocked: rows.filter((row) => row.readiness.status === "blocked").length,
        blockedRows: rows.filter((row) => row.readiness.status === "blocked").map((row) => row.currentAccountKey),
      },
    },
  };
}

export function renderAccountMappingMarkdown(mapping: AccountMappingArtifact): string {
  const cell = (value: string | null): string => (value ?? "null").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
  const list = (values: string[]): string => values.length ? values.map((value) => cell(value)).join(", ") : "null";
  const audience = (row: AccountMappingRow): string => [
    row.audience.size === null ? "null" : row.audience.size.toString(),
    row.audience.countType ?? "null",
    row.audience.provenance ?? "null",
    row.audience.asOf ?? "null",
  ].join("/");
  const { summary } = mapping;
  const lines = [
    "# Account identity mapping review",
    "",
    `Total rows: ${summary.total} | Needs review: ${summary.needsReview} | Unmapped: ${summary.unmapped} | Evidence: ${summary.evidenceCount} | Ready: ${summary.readiness.ready} | Blocked: ${summary.readiness.blocked}`,
    "",
    "| Current account key | Derived account ID | Account ID status | Platform | Handle | Creator | Niche label | Audience (size/type/provenance/as-of) | Topics | Focus | Research pools | Popularity scopes | Sample scopes | Baseline sources | Formats | Mapping disposition | Evidence count | Readiness | Blocking fields | Readiness reason | Human review note |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---:|---|---|---|---|",
  ];
  for (const row of mapping.rows) {
    lines.push(`| ${cell(row.currentAccountKey)} | ${cell(row.derivedAccountId)} | ${row.accountIdStatus} | ${cell(row.platform)} | ${cell(row.handle)} | ${cell(row.creator)} | ${cell(row.niche)} | ${cell(audience(row))} | ${list(row.topics)} | ${list(row.focus)} | ${list(row.researchPools)} | ${list(row.popularityScopes)} | ${list(row.sampleScopes)} | ${list(row.baselineSources)} | ${list(row.formats)} | ${row.mappingDisposition} | ${row.evidenceCount} | ${row.readiness.status} | ${list(row.readiness.blockingFields)} | ${cell(row.readiness.reason)} | ${cell(row.humanReviewNote)} |`);
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
