import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  buildAccountExampleTable,
  type AccountExampleRow,
  type AccountExampleTable,
} from "./account-table.js";
import type { ComparisonReadinessInventory } from "./comparison-readiness.js";
import { buildEvidenceReadiness } from "./evidence-readiness.js";
import { buildCatalog, loadCatalogInputs, type CatalogRow, type PatternCatalog } from "./catalog.js";
import {
  buildReviewStatus,
  type AccountMetadataStatusRow,
  type ReviewInputReport,
} from "./review-status.js";
import type { ReviewMetadataInput } from "./review-metadata.js";

/** A deterministic, body-free operator handoff over the existing pattern seams. */
export const ACCOUNT_TABLE_REPORT_VERSION = "account-table-report-v1" as const;

export interface AccountTableReportInput {
  /** A catalog artifact, or its explicit rows when a caller already has JSON-like data. */
  readonly catalog: PatternCatalog | readonly CatalogRow[];
  /** Explicit comparison output. Missing comparison data is represented as an empty view. */
  readonly comparison?: ComparisonReadinessInventory;
  /** Raw corpus/analysis inputs used to derive comparison rows when no explicit comparison is supplied. */
  readonly corpus?: readonly unknown[];
  readonly analyses?: readonly unknown[];
  /** Raw JSON-like review rows. They are validated before any metadata is exposed. */
  readonly reviews?: readonly unknown[];
  readonly reviewsPath?: string | null;
}

export interface AccountTableReportLoaders {
  readonly loadCatalog: () => PatternCatalog | readonly CatalogRow[];
  readonly loadComparison?: () => ComparisonReadinessInventory | undefined;
  readonly loadReviews?: () => readonly unknown[] | undefined;
}

export interface AccountTableReportCliIo {
  readonly write: (value: string) => void;
  readonly readFile: (path: string) => string;
}

export interface AccountTableReportPaths {
  config?: string;
  corpus?: string;
  analyses?: string;
}

export interface AccountTableReportRow {
  readonly currentAccountKey: string;
  /** The reviewed stable id only. Catalog-derived ids are not promoted into this field. */
  readonly accountId: string | null;
  readonly handle: string | null;
  readonly creator: string | null;
  readonly configured: boolean;
  readonly collected: boolean;
  readonly evidenceCount: number;
  readonly accountSize: number | null;
  readonly accountSizeSnapshot: AccountMetadataStatusRow["audienceSnapshot"];
  readonly topics: AccountMetadataStatusRow["topics"];
  readonly focus: AccountMetadataStatusRow["focus"];
  readonly platform: string;
  readonly medium: AccountMetadataStatusRow["medium"];
  readonly format: AccountMetadataStatusRow["format"];
  readonly scope: {
    readonly popularity: AccountMetadataStatusRow["popularityScope"];
    readonly sample: AccountMetadataStatusRow["sampleScope"];
    readonly baseline: AccountMetadataStatusRow["baselineScope"];
    readonly baselineSource: AccountMetadataStatusRow["baselineSource"];
  };
  /** Explicit reviewed memberships only. No catalog/topic-based pool is inferred. */
  readonly pool: AccountMetadataStatusRow["reviewedPoolMembership"];
  readonly status: AccountMetadataStatusRow["reviewStatus"];
  readonly reviewStatus: AccountMetadataStatusRow["reviewStatus"];
  readonly evidenceLinks: AccountMetadataStatusRow["evidenceLinks"];
  readonly caveats: AccountMetadataStatusRow["caveats"];
  readonly readiness: { readonly status: "ready" | "blocked"; readonly blockers: string[] };
  readonly bodyIncluded: false;
}

export interface AccountTableReport {
  readonly kind: "account_table_report";
  readonly version: typeof ACCOUNT_TABLE_REPORT_VERSION;
  /** One row per catalog account, including configured-but-unreviewed accounts. */
  readonly rows: AccountTableReportRow[];
  /** The existing comparison/account-table seam, retained as a separate evidence view. */
  readonly accountTable: AccountExampleTable;
  readonly examples: AccountExampleRow[];
  readonly reviewInput: ReviewInputReport;
  readonly summary: {
    readonly accounts: number;
    readonly configured: number;
    readonly unreviewed: number;
    readonly examples: number;
    readonly ready: number;
    readonly blocked: number;
  };
  readonly sideEffects: "none";
}

const EMPTY_COMPARISON: ComparisonReadinessInventory = {
  kind: "comparison_readiness_inventory",
  version: "comparison-readiness-v1",
  rows: [],
  summary: { ready: 0, blocked: 0, duplicateEvidence: 0 },
  sideEffects: "none",
};

function isCatalog(value: PatternCatalog | readonly CatalogRow[]): value is PatternCatalog {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && "rows" in value && Array.isArray((value as PatternCatalog).rows);
}

function catalogFrom(value: PatternCatalog | readonly CatalogRow[]): PatternCatalog {
  if (isCatalog(value)) return value;
  const rows = [...value].sort((left, right) => left.key.localeCompare(right.key));
  return {
    rows,
    summary: {
      configuredTargets: rows.filter((row) => row.configured).length,
      collectedSources: rows.filter((row) => row.collected).length,
      configuredAndCollected: rows.filter((row) => row.configured && row.collected).length,
      configuredButUncollected: rows.filter((row) => row.configured && !row.collected).length,
      evidenceCount: rows.reduce((sum, row) => sum + row.evidenceCount, 0),
      admissibleCount: rows.reduce((sum, row) => sum + row.admissibleCount, 0),
      bodyCompleteCount: rows.reduce((sum, row) => sum + row.bodyCompleteCount, 0),
      bodyIncompleteCount: rows.reduce((sum, row) => sum + row.bodyIncompleteCount, 0),
    },
  };
}

function invalidReviewInput(path: string | null, reason: string): ReviewInputReport {
  return {
    supplied: true,
    path,
    status: "invalid",
    reviewStatus: "unreviewed",
    rowCount: 0,
    validRowCount: 0,
    invalidRowCount: 0,
    validationErrors: [reason],
    readiness: {
      status: "blocked",
      readyRows: 0,
      blockedRows: 0,
      blockingFields: ["reviewMetadata"],
      reason,
    },
  };
}

interface ReviewResolution {
  readonly report: ReviewInputReport;
  readonly rows: readonly ReviewMetadataInput[];
}

function resolveReviews(input: AccountTableReportInput, catalog: PatternCatalog): ReviewResolution {
  if (input.reviews === undefined) {
    const report = buildReviewStatus({ catalog }).reviewInput;
    return { report, rows: [] };
  }
  if (!Array.isArray(input.reviews)) {
    return { report: invalidReviewInput(input.reviewsPath ?? null, "Review input must be a JSON array of account metadata rows."), rows: [] };
  }

  let evaluated: ReturnType<typeof buildReviewStatus>;
  try {
    evaluated = buildReviewStatus({ catalog, reviews: input.reviews, reviewsPath: input.reviewsPath ?? null });
  } catch {
    return { report: invalidReviewInput(input.reviewsPath ?? null, "Review input could not be evaluated."), rows: [] };
  }

  // A review batch is an atomic trust boundary. If any supplied row is invalid, withhold every
  // review row from the joined tables. A valid-but-pending batch remains visible as pending, but
  // never becomes ready until the existing review seam says it is complete and reviewed.
  return evaluated.reviewInput.status === "invalid"
    ? { report: evaluated.reviewInput, rows: [] }
    : { report: evaluated.reviewInput, rows: input.reviews as ReviewMetadataInput[] };
}

function rowFor(
  catalogRow: CatalogRow,
  metadata: AccountMetadataStatusRow,
  reviewInput: ReviewInputReport,
): AccountTableReportRow {
  const accountSize = metadata.audienceSnapshot?.size ?? null;
  const blockers = new Set<string>();
  if (metadata.reviewStatus !== "reviewed") blockers.add("account metadata is not reviewed");
  if (reviewInput.status === "not_supplied") blockers.add("review input was not supplied");
  if (reviewInput.status === "invalid") blockers.add("review input is invalid; metadata is withheld");
  if (reviewInput.status === "valid" && reviewInput.readiness.status !== "ready") {
    blockers.add("review input is not complete and explicitly reviewed");
  }
  const ready = blockers.size === 0 && metadata.reviewStatus === "reviewed";
  return {
    currentAccountKey: metadata.currentAccountKey,
    accountId: metadata.accountId,
    handle: metadata.reviewedHandle ?? metadata.handle,
    creator: metadata.reviewedCreator ?? metadata.creator,
    configured: catalogRow.configured,
    collected: catalogRow.collected,
    evidenceCount: metadata.evidenceCount,
    accountSize,
    accountSizeSnapshot: metadata.audienceSnapshot,
    topics: metadata.topics,
    focus: metadata.focus,
    platform: metadata.reviewedPlatform ?? metadata.platform,
    medium: metadata.medium,
    format: metadata.format,
    scope: {
      popularity: metadata.popularityScope,
      sample: metadata.sampleScope,
      baseline: metadata.baselineScope,
      baselineSource: metadata.baselineSource,
    },
    pool: metadata.reviewedPoolMembership,
    status: metadata.reviewStatus,
    reviewStatus: metadata.reviewStatus,
    evidenceLinks: metadata.evidenceLinks,
    caveats: metadata.caveats,
    readiness: { status: ready ? "ready" : "blocked", blockers: [...blockers].sort() },
    bodyIncluded: false,
  };
}

function accountRows(
  catalog: PatternCatalog,
  review: ReturnType<typeof buildReviewStatus>,
): AccountTableReportRow[] {
  const catalogByKey = new Map(catalog.rows.map((row) => [row.key, row]));
  return review.accountMetadataRows
    .map((metadata) => {
      const catalogRow = catalogByKey.get(metadata.currentAccountKey);
      return catalogRow === undefined ? null : rowFor(catalogRow, metadata, review.reviewInput);
    })
    .filter((row): row is AccountTableReportRow => row !== null)
    .sort((left, right) => left.currentAccountKey.localeCompare(right.currentAccountKey));
}

/** Build the report without writing files, changing review state, ranking, or selecting winners. */
export function buildAccountTableReport(input: AccountTableReportInput): AccountTableReport {
  const catalog = catalogFrom(input.catalog);
  const resolved = resolveReviews(input, catalog);
  const review = resolved.report.status === "invalid"
    ? buildReviewStatus({ catalog, reviews: [], reviewInput: resolved.report })
    : input.reviews === undefined
      ? buildReviewStatus({ catalog })
      : buildReviewStatus({ catalog, reviews: resolved.rows, reviewInput: resolved.report });
  const comparison = input.comparison ?? (input.corpus !== undefined && input.analyses !== undefined
    ? buildEvidenceReadiness({ catalog, corpus: input.corpus, analyses: input.analyses, reviews: resolved.rows }).comparisonReadiness
    : EMPTY_COMPARISON);
  const accountTable = buildAccountExampleTable({ reviews: resolved.rows, comparison, catalog: catalog.rows });
  const rows = accountRows(catalog, review);
  const examples = accountTable.rows;
  const ready = rows.filter((row) => row.readiness.status === "ready").length
    + examples.filter((row) => row.readiness.status === "ready").length;
  return {
    kind: "account_table_report",
    version: ACCOUNT_TABLE_REPORT_VERSION,
    rows,
    accountTable,
    examples,
    reviewInput: review.reviewInput,
    summary: {
      accounts: rows.length,
      configured: rows.filter((row) => row.configured).length,
      unreviewed: rows.filter((row) => row.reviewStatus !== "reviewed").length,
      examples: examples.length,
      ready,
      blocked: rows.length + examples.length - ready,
    },
    sideEffects: "none",
  };
}

/** Loader form for callers that already own the repository/file loading policy. */
export function loadAccountTableReport(loaders: AccountTableReportLoaders): AccountTableReport {
  let reviews: readonly unknown[] | undefined;
  try {
    reviews = loaders.loadReviews?.();
  } catch {
    reviews = [{ __invalidReviewLoader: true }];
  }
  return buildAccountTableReport({
    catalog: loaders.loadCatalog(),
    comparison: loaders.loadComparison?.(),
    reviews,
  });
}

export const createAccountTableReport = buildAccountTableReport;

function markdownCell(value: string | number | null | undefined): string {
  return String(value ?? "null").replace(/\|/g, "\\|").replace(/[\r\n\s]+/g, " ").trim();
}

function markdownList(value: readonly string[] | "unknown" | null): string {
  if (value === "unknown") return "unknown";
  return markdownCell(value?.length ? value.join(", ") : null);
}

function markdownPools(value: AccountTableReportRow["pool"]): string {
  if (value === "unknown") return "unknown";
  return value === null ? "null" : markdownCell(value.length ? value.map((item) => `${item.pool}: ${item.reason}`).join(", ") : null);
}

function markdownAudience(value: AccountTableReportRow["accountSizeSnapshot"]): string {
  if (value === null) return "null";
  return [value.size, value.countType, value.provenance, value.asOf].map((item) => markdownCell(item)).join("/");
}

function markdownScope(row: AccountTableReportRow): string {
  return [row.scope.popularity, row.scope.sample, row.scope.baseline, row.scope.baselineSource]
    .map((value) => markdownCell(value)).join("/");
}

function markdownExampleScope(row: AccountExampleRow): string {
  return [row.popularityScope, row.sampleScope, row.baselineScope, row.baselineSource]
    .map((value) => markdownCell(value)).join("/");
}

function markdownExamplePool(row: AccountExampleRow): string {
  return markdownCell(row.pool);
}

/** Render only the report's body-free operator fields. */
export function renderAccountTableReportJson(report: AccountTableReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function renderAccountTableReportMarkdown(report: AccountTableReport): string {
  const input = report.reviewInput;
  const lines = [
    "# Account table report",
    "",
    `Review input: ${input.status} | Review state: ${input.reviewStatus} | Readiness: ${input.readiness.status}`,
    `Accounts: ${report.summary.accounts} | Configured: ${report.summary.configured} | Unreviewed: ${report.summary.unreviewed} | Examples: ${report.summary.examples} | Ready: ${report.summary.ready} | Blocked: ${report.summary.blocked}`,
    `Validation errors: ${input.validationErrors.length ? input.validationErrors.map(markdownCell).join("; ") : "none"}`,
    "",
    "## Account metadata",
    "",
    "| Account | Account ID | Configured | Collected | Account size | Audience snapshot | Topics | Focus | Platform | Medium | Format | Scope (popularity/sample/baseline/source) | Pool | Status | Evidence links | Caveats |",
    "|---|---|---|---|---:|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const row of report.rows) {
    lines.push(`| ${markdownCell(row.currentAccountKey)} | ${markdownCell(row.accountId)} | ${row.configured ? "yes" : "no"} | ${row.collected ? "yes" : "no"} | ${markdownCell(row.accountSize)} | ${markdownCell(markdownAudience(row.accountSizeSnapshot))} | ${markdownList(row.topics)} | ${markdownList(row.focus)} | ${markdownCell(row.platform)} | ${markdownCell(row.medium)} | ${markdownCell(row.format)} | ${markdownCell(markdownScope(row))} | ${markdownPools(row.pool)} | ${row.status} | ${markdownList(row.evidenceLinks)} | ${markdownList(row.caveats)} |`);
  }
  lines.push(
    "",
    "## Comparison examples",
    "",
    "Pool and scope values in this table are copied from explicit comparison evidence. No pool or winner is inferred.",
    "",
    "| Example | Account | Platform | Medium | Format | Scope (popularity/sample/baseline/source) | Pool | Status | Readiness | Evidence links | Caveats |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
  );
  for (const row of report.examples) {
    lines.push(`| ${markdownCell(row.exampleId)} | ${markdownCell(row.accountId)} | ${markdownCell(row.platform)} | ${markdownCell(row.medium)} | ${markdownCell(row.format)} | ${markdownCell(markdownExampleScope(row))} | ${markdownExamplePool(row)} | ${row.reviewStatus} | ${row.readiness.status} | ${markdownList(row.evidenceLinks)} | ${markdownList(row.caveats)} |`);
  }
  return `${lines.join("\n")}\n`;
}

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value`);
  return value;
}

function parseArgs(argv: readonly string[]): {
  paths: AccountTableReportPaths;
  reviewsPath?: string;
  format: "json" | "markdown";
} {
  const paths: AccountTableReportPaths = {};
  let reviewsPath: string | undefined;
  let format: "json" | "markdown" = "json";
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--config") {
      paths.config = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--corpus") {
      paths.corpus = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--analyses") {
      paths.analyses = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--reviews") {
      reviewsPath = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--format") {
      const value = optionValue(argv, index, argument);
      if (value !== "json" && value !== "markdown") throw new Error("--format must be json or markdown");
      format = value;
      index += 1;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  return { paths, reviewsPath, format };
}

const defaultCliIo: AccountTableReportCliIo = {
  write: (value) => process.stdout.write(value),
  readFile: (path) => readFileSync(path, "utf8"),
};

/** CLI adapter with injected catalog loading and file I/O for deterministic tests. */
export function main(
  argv: readonly string[] = process.argv.slice(2),
  loadInputs: typeof loadCatalogInputs = loadCatalogInputs,
  io: Partial<AccountTableReportCliIo> = {},
): number {
  const options = parseArgs(argv);
  const inputs = loadInputs(options.paths);
  let reviews: readonly unknown[] | undefined;
  if (options.reviewsPath !== undefined) {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse((io.readFile ?? defaultCliIo.readFile)(options.reviewsPath)) as unknown;
    } catch {
      parsed = null;
    }
    reviews = parsed as readonly unknown[];
  }
  const report = buildAccountTableReport({
    catalog: buildCatalog(inputs.config, inputs.corpus, inputs.analyses),
    corpus: inputs.corpus,
    analyses: inputs.analyses,
    reviews,
    reviewsPath: options.reviewsPath ?? null,
  });
  (io.write ?? defaultCliIo.write)(options.format === "markdown"
    ? renderAccountTableReportMarkdown(report)
    : renderAccountTableReportJson(report));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
