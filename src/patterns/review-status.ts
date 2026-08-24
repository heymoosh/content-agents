import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { buildCatalog, loadCatalogInputs, type PatternCatalog } from "./catalog.js";
import { buildOverlayCoverage } from "./overlay-coverage.js";
import { buildReviewQueue, type ReviewQueueArtifact } from "./review-queue.js";
import { buildPoolReviewCoverage, type PoolReviewCoverageArtifact } from "./review-pool-coverage.js";
import { renderReviewInputTemplateJson } from "./review-input-template.js";
import {
  validateReviewMetadata,
  validateReviewMetadataRows,
  type NormalizedReviewMetadataRecord,
  type ReviewMetadataRecord,
} from "./review-metadata.js";

export type { ReviewMetadataRecord } from "./review-metadata.js";

export const ACCOUNT_REVIEW_STATUS_VERSION = "account-review-status-v1" as const;

export type ReviewInputStatus = "not_supplied" | "valid" | "invalid";
export type ReviewInputReviewStatus = "unreviewed" | "reviewed";

export interface ReviewInputReadiness {
  status: "ready" | "blocked";
  readyRows: number;
  blockedRows: number;
  blockingFields: string[];
  reason: string;
}

export interface ReviewInputReport {
  supplied: boolean;
  path: string | null;
  status: ReviewInputStatus;
  reviewStatus: ReviewInputReviewStatus;
  rowCount: number;
  validRowCount: number;
  invalidRowCount: number;
  validationErrors: string[];
  readiness: ReviewInputReadiness;
}

export interface ReviewStatusReport {
  kind: "account_review_status";
  version: typeof ACCOUNT_REVIEW_STATUS_VERSION;
  reviewInput: ReviewInputReport;
  accountMetadataRows: AccountMetadataStatusRow[];
  queue: ReviewQueueArtifact;
  poolCoverage: PoolReviewCoverageArtifact;
  sideEffects: "none";
}

/** The requested account table, limited to supplied metadata and catalog context. */
export interface AccountMetadataStatusRow {
  readonly currentAccountKey: string;
  readonly accountId: string | null;
  readonly platform: string;
  readonly reviewedPlatform: string | null;
  readonly handle: string | null;
  readonly reviewedHandle: string | null;
  readonly creator: string | null;
  readonly reviewedCreator: string | null;
  readonly evidenceCount: number;
  readonly audienceSnapshot: NormalizedReviewMetadataRecord["audienceSnapshot"];
  readonly topics: NormalizedReviewMetadataRecord["topics"];
  readonly focus: NormalizedReviewMetadataRecord["focus"];
  readonly nicheLabel: NormalizedReviewMetadataRecord["nicheLabel"];
  readonly medium: NormalizedReviewMetadataRecord["medium"];
  readonly format: NormalizedReviewMetadataRecord["format"];
  readonly reviewedPoolMembership: NormalizedReviewMetadataRecord["researchPoolMembership"];
  readonly popularityScope: NormalizedReviewMetadataRecord["popularityScope"];
  readonly sampleScope: NormalizedReviewMetadataRecord["sampleScope"];
  readonly baselineScope: NormalizedReviewMetadataRecord["baselineScope"];
  readonly baselineSource: NormalizedReviewMetadataRecord["baselineSource"];
  readonly evidenceLinks: NormalizedReviewMetadataRecord["evidenceLinks"];
  readonly caveats: NormalizedReviewMetadataRecord["caveats"];
  readonly reviewStatus: "reviewed" | "pending" | "blocked" | "unmapped" | "unreviewed";
  readonly bodyIncluded: false;
}

export interface ReviewStatusInputs {
  catalog: PatternCatalog;
  reviews?: readonly unknown[];
  reviewsPath?: string | null;
  reviewInput?: ReviewInputReport;
}

export interface ReviewStatusCliIo {
  write: (value: string) => void;
  readFile: (path: string) => string;
}

export interface ReviewStatusPaths {
  config?: string;
  corpus?: string;
  analyses?: string;
}

interface ReviewInputEvaluation {
  report: ReviewInputReport;
  rows: NormalizedReviewMetadataRecord[];
}

const defaultIo: ReviewStatusCliIo = {
  write: (value) => process.stdout.write(value),
  readFile: (path) => readFileSync(path, "utf8"),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareValues(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareValues);
}

function requiredStringErrors(row: Record<string, unknown>, index: number): string[] {
  return ["currentAccountKey", "platform", "stableAccountIdStatus"].flatMap((field) => {
    const value = row[field];
    return typeof value === "string" && value.trim().length > 0
      ? []
      : [`review row ${index + 1}: ${field} must be a non-empty string`];
  });
}

function nullableStringErrors(row: Record<string, unknown>, index: number): string[] {
  return ["handle", "creator", "stableAccountId"].flatMap((field) => {
    const value = row[field];
    return value === null || typeof value === "string"
      ? []
      : [`review row ${index + 1}: ${field} must be a string or null`];
  });
}

function listErrors(row: Record<string, unknown>, index: number): string[] {
  return ["topics", "focus", "evidenceLinks", "caveats"].flatMap((field) => {
    const value = row[field];
    return value === null || value === "unknown" || Array.isArray(value)
      ? []
      : [`review row ${index + 1}: ${field} must be an array, null, or unknown`];
  });
}

function scalarErrors(row: Record<string, unknown>, index: number): string[] {
  return [
    "nicheLabel", "popularityScope", "sampleScope", "baselineScope", "baselineSource", "medium", "format",
    "reviewer", "reviewNote", "reviewed_at",
  ].flatMap((field) => {
    const value = row[field];
    return value === null || value === "unknown" || typeof value === "string"
      ? []
      : [`review row ${index + 1}: ${field} must be a string, null, or unknown`];
  });
}

function shapeErrors(value: unknown, index: number): string[] {
  if (!isRecord(value)) return [`review row ${index + 1}: must be a JSON object`];
  const errors = [
    ...requiredStringErrors(value, index),
    ...nullableStringErrors(value, index),
    ...listErrors(value, index),
    ...scalarErrors(value, index),
  ];
  const audience = value.audienceSnapshot;
  if (audience !== null && !isRecord(audience)) {
    errors.push(`review row ${index + 1}: audienceSnapshot must be an object or null`);
  }
  const memberships = value.researchPoolMembership;
  if (memberships !== null && memberships !== "unknown" && !Array.isArray(memberships)) {
    errors.push(`review row ${index + 1}: researchPoolMembership must be an array, null, or unknown`);
  }
  return errors;
}

function emptyReviewInput(path: string | null): ReviewInputEvaluation {
  return {
    rows: [],
    report: {
      supplied: false,
      path,
      status: "not_supplied",
      reviewStatus: "unreviewed",
      rowCount: 0,
      validRowCount: 0,
      invalidRowCount: 0,
      validationErrors: [],
      readiness: {
        status: "blocked",
        readyRows: 0,
        blockedRows: 0,
        blockingFields: ["reviewMetadata"],
        reason: "Review input was not supplied; account metadata remains unreviewed.",
      },
    },
  };
}

function evaluateReviewRows(values: unknown[], path: string | null): ReviewInputEvaluation {
  const shapeValidation = values.map((value, index) => shapeErrors(value, index));
  const structurallyValid = values.filter((value, index) => shapeValidation[index].length === 0) as ReviewMetadataRecord[];
  const rowValidation = structurallyValid.map((row) => validateReviewMetadata(row));
  const rowsValidation = validateReviewMetadataRows(structurallyValid);
  const validationErrors = sortedUnique([
    ...shapeValidation.flat(),
    ...rowsValidation.errors,
  ]);
  const usableRows: NormalizedReviewMetadataRecord[] = rowValidation
    .filter((result) => result.errors.length === 0)
    .map((result) => result.normalized);
  const readyRows = rowValidation.filter((result) => (
    result.errors.length === 0
    && result.blockingFields.length === 0
    && result.normalized.disposition === "reviewed"
  )).length;
  const blockedRows = values.length - readyRows;
  const duplicate = rowsValidation.errors.some((error) => error.startsWith("duplicate currentAccountKey "));
  const blockingFields = sortedUnique([
    ...rowValidation.flatMap((result) => result.blockingFields),
    ...rowValidation
      .filter((result) => result.errors.length === 0 && result.normalized.disposition !== "reviewed")
      .map(() => "reviewStatus"),
    ...(duplicate ? ["duplicate currentAccountKey"] : []),
    ...(shapeValidation.some((errors) => errors.length > 0) ? ["reviewMetadata"] : []),
  ]);
  const allRowsReady = values.length > 0 && validationErrors.length === 0 && readyRows === values.length;
  const report: ReviewInputReport = {
    supplied: true,
    path,
    status: validationErrors.length === 0 ? "valid" : "invalid",
    reviewStatus: allRowsReady ? "reviewed" : "unreviewed",
    rowCount: values.length,
    validRowCount: structurallyValid.length,
    invalidRowCount: values.length - structurallyValid.length,
    validationErrors,
    readiness: {
      status: allRowsReady ? "ready" : "blocked",
      readyRows,
      blockedRows,
      blockingFields: blockingFields.length || values.length > 0 ? blockingFields : ["reviewMetadata"],
      reason: allRowsReady
        ? "All supplied account metadata rows are complete and explicitly reviewed."
        : values.length === 0
          ? "Review input was supplied but contains no account metadata rows."
          : "One or more supplied account metadata rows are invalid, incomplete, or not explicitly reviewed.",
    },
  };
  return { report, rows: usableRows };
}

function evaluateReviewFile(path: string, readFile: (path: string) => string): ReviewInputEvaluation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFile(path)) as unknown;
  } catch {
    return {
      rows: [],
      report: {
        supplied: true,
        path,
        status: "invalid",
        reviewStatus: "unreviewed",
        rowCount: 0,
        validRowCount: 0,
        invalidRowCount: 0,
        validationErrors: ["review input must contain valid JSON"],
        readiness: {
          status: "blocked",
          readyRows: 0,
          blockedRows: 0,
          blockingFields: ["reviewMetadata"],
          reason: "Review input could not be parsed as JSON.",
        },
      },
    };
  }
  if (!Array.isArray(parsed)) {
    return {
      rows: [],
      report: {
        supplied: true,
        path,
        status: "invalid",
        reviewStatus: "unreviewed",
        rowCount: 0,
        validRowCount: 0,
        invalidRowCount: 0,
        validationErrors: ["review input must be a JSON array"],
        readiness: {
          status: "blocked",
          readyRows: 0,
          blockedRows: 0,
          blockingFields: ["reviewMetadata"],
          reason: "Review input must be a JSON array of account metadata rows.",
        },
      },
    };
  }
  return evaluateReviewRows(parsed, path);
}

function evaluateReviews(inputs: ReviewStatusInputs): ReviewInputEvaluation {
  if (inputs.reviewInput !== undefined) {
    return { report: inputs.reviewInput, rows: (inputs.reviews ?? []) as NormalizedReviewMetadataRecord[] };
  }
  if (inputs.reviews === undefined) return emptyReviewInput(inputs.reviewsPath ?? null);
  return evaluateReviewRows([...inputs.reviews], inputs.reviewsPath ?? null);
}

function catalogRows(catalog: PatternCatalog): readonly PatternCatalog["rows"][number][] {
  return catalog.rows;
}

function accountMetadataRows(
  catalog: PatternCatalog,
  reviews: readonly NormalizedReviewMetadataRecord[],
): AccountMetadataStatusRow[] {
  const byKey = new Map<string, NormalizedReviewMetadataRecord[]>();
  for (const review of reviews) {
    const rows = byKey.get(review.currentAccountKey) ?? [];
    rows.push(review);
    byKey.set(review.currentAccountKey, rows);
  }
  return [...catalogRows(catalog)]
    .sort((left, right) => compareValues(left.key, right.key))
    .map((catalogRow): AccountMetadataStatusRow => {
      const matching = byKey.get(catalogRow.key) ?? [];
      const review = matching.length === 1 ? matching[0] : null;
      return {
        currentAccountKey: catalogRow.key,
        accountId: review?.stableAccountId ?? null,
        platform: catalogRow.platform,
        reviewedPlatform: review?.platform ?? null,
        handle: catalogRow.handle,
        reviewedHandle: review?.handle ?? null,
        creator: catalogRow.creator,
        reviewedCreator: review?.creator ?? null,
        evidenceCount: catalogRow.evidenceCount,
        audienceSnapshot: review?.audienceSnapshot ?? null,
        topics: review?.topics ?? null,
        focus: review?.focus ?? null,
        nicheLabel: review?.nicheLabel ?? null,
        medium: review?.medium ?? null,
        format: review?.format ?? null,
        reviewedPoolMembership: review?.researchPoolMembership ?? null,
        popularityScope: review?.popularityScope ?? null,
        sampleScope: review?.sampleScope ?? null,
        baselineScope: review?.baselineScope ?? null,
        baselineSource: review?.baselineSource ?? null,
        evidenceLinks: review?.evidenceLinks ?? null,
        caveats: review?.caveats ?? null,
        reviewStatus: matching.length > 1 ? "blocked" : review?.disposition ?? "unreviewed",
        bodyIncluded: false,
      };
    });
}

/** Build the read-only account review report from catalog facts and optional review rows. */
export function buildReviewStatus(inputs: ReviewStatusInputs): ReviewStatusReport {
  const evaluated = evaluateReviews(inputs);
  const coverage = buildOverlayCoverage({ catalog: inputs.catalog, reviews: evaluated.rows });
  const normalizedReviews = evaluated.rows as readonly NormalizedReviewMetadataRecord[];
  return {
    kind: "account_review_status",
    version: ACCOUNT_REVIEW_STATUS_VERSION,
    reviewInput: evaluated.report,
    accountMetadataRows: accountMetadataRows(inputs.catalog, normalizedReviews),
    queue: buildReviewQueue({ catalog: inputs.catalog, coverage }),
    poolCoverage: buildPoolReviewCoverage({ catalog: inputs.catalog, reviews: normalizedReviews }),
    sideEffects: "none",
  };
}

export function renderReviewStatusJson(report: ReviewStatusReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

function markdownCell(value: string | null): string {
  return (value ?? "null").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function markdownList(values: readonly string[]): string {
  return markdownCell(values.length ? values.join(", ") : null);
}

function markdownUnknownList(values: readonly string[] | "unknown" | null): string {
  return values === "unknown" ? "unknown" : markdownList(values ?? []);
}

function markdownAudience(value: AccountMetadataStatusRow["audienceSnapshot"]): string {
  if (value === null) return "null";
  return [value.size ?? "null", value.countType ?? "null", value.asOf ?? "null"].join("/");
}

function markdownPools(value: AccountMetadataStatusRow["reviewedPoolMembership"]): string {
  if (value === "unknown") return "unknown";
  if (value === null) return "null";
  return markdownList(value.map((membership) => `${membership.pool}: ${membership.reason}`));
}

export function renderReviewStatusMarkdown(report: ReviewStatusReport): string {
  const input = report.reviewInput;
  const lines = [
    "# Account review status",
    "",
    `Review input: ${input.status}${input.path ? ` (${markdownCell(input.path)})` : ""}`,
    `Review state: ${input.reviewStatus}`,
    `Review rows: ${input.rowCount} supplied | ${input.readiness.readyRows} ready | ${input.readiness.blockedRows} blocked`,
    `Readiness: ${input.readiness.status}`,
    `Readiness reason: ${markdownCell(input.readiness.reason)}`,
    `Validation errors: ${input.validationErrors.length ? input.validationErrors.map(markdownCell).join("; ") : "none"}`,
    "",
    "| Current account key | Platform | Handle | Creator | Evidence count | Status | Stable ID | Missing fields | Comparison evidence | Next review action |",
    "|---|---|---|---|---:|---|---|---|---|---|",
  ];
  for (const row of report.queue.rows) {
    lines.push(`| ${markdownCell(row.currentAccountKey)} | ${markdownCell(row.platform)} | ${markdownCell(row.handle)} | ${markdownCell(row.creator)} | ${row.evidenceCount} | ${row.status} | ${row.stableIdPresent ? "present" : "missing"} | ${markdownList(row.missingRequiredOverlayFields)} | ${row.comparisonEvidenceReady ? "ready" : "blocked"} | ${markdownCell(row.nextReviewAction)} |`);
  }
  lines.push(
    "",
    `Queue summary: ${report.queue.summary.total} account rows | ${report.queue.summary.evidenceCount} evidence records | ${report.queue.summary.comparisonEvidenceReady} comparison-ready (provisional; source/post comparison evidence still required)`,
    "",
    "## Account metadata table",
    "",
    "This table exposes supplied metadata and catalog context only. Null or unknown values remain explicit; body text is never included.",
    "",
    "| Account | Account ID | Audience size/type/as-of | Topics | Focus | Platform | Medium | Format | Pools | Popularity scope | Sample scope | Baseline scope | Baseline source | Evidence links | Caveats | Review status |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
  );
  for (const row of report.accountMetadataRows) {
    lines.push(`| ${markdownCell(row.currentAccountKey)} | ${markdownCell(row.accountId)} | ${markdownCell(markdownAudience(row.audienceSnapshot))} | ${markdownUnknownList(row.topics)} | ${markdownUnknownList(row.focus)} | ${markdownCell(row.reviewedPlatform ?? row.platform)} | ${markdownCell(row.medium)} | ${markdownCell(row.format)} | ${markdownPools(row.reviewedPoolMembership)} | ${markdownCell(row.popularityScope)} | ${markdownCell(row.sampleScope)} | ${markdownCell(row.baselineScope)} | ${markdownCell(row.baselineSource)} | ${markdownUnknownList(row.evidenceLinks)} | ${markdownUnknownList(row.caveats)} | ${row.reviewStatus} |`);
  }
  lines.push(
    "",
    `Pool metadata coverage: ${report.poolCoverage.summary.reviewed} reviewed | ${report.poolCoverage.summary.pending} pending | ${report.poolCoverage.summary.blocked} blocked | ${report.poolCoverage.summary.unmapped} unmapped | niche ${report.poolCoverage.summary.poolCounts.niche} | broad ${report.poolCoverage.summary.poolCounts.broad} | format ${report.poolCoverage.summary.poolCounts.format}`,
  );
  return `${lines.join("\n")}\n`;
}

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value`);
  return value;
}

function parseArgs(argv: readonly string[]): { paths: ReviewStatusPaths; reviewsPath?: string; format: "json" | "markdown"; template: boolean } {
  const paths: ReviewStatusPaths = {};
  let reviewsPath: string | undefined;
  let format: "json" | "markdown" = "json";
  let template = false;
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
    } else if (argument === "--template") {
      template = true;
    } else if (argument === "--format") {
      const value = optionValue(argv, index, argument);
      if (value !== "json" && value !== "markdown") throw new Error("--format must be json or markdown");
      format = value;
      index += 1;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  if (template && reviewsPath !== undefined) throw new Error("--template cannot be combined with --reviews");
  return { paths, reviewsPath, format, template };
}

export function main(
  argv: readonly string[] = process.argv.slice(2),
  loadInputs: typeof loadCatalogInputs = loadCatalogInputs,
  io: Partial<ReviewStatusCliIo> = {},
): number {
  const options = parseArgs(argv);
  const inputs = loadInputs(options.paths);
  const catalog = buildCatalog(inputs.config, inputs.corpus, inputs.analyses);
  if (options.template) {
    (io.write ?? defaultIo.write)(renderReviewInputTemplateJson(catalog));
    return 0;
  }
  const evaluated = options.reviewsPath === undefined
    ? emptyReviewInput(null)
    : evaluateReviewFile(options.reviewsPath, io.readFile ?? defaultIo.readFile);
  const report = buildReviewStatus({
    catalog,
    reviews: evaluated.rows,
    reviewsPath: options.reviewsPath ?? null,
    reviewInput: evaluated.report,
  });
  (io.write ?? defaultIo.write)(options.format === "markdown"
    ? renderReviewStatusMarkdown(report)
    : renderReviewStatusJson(report));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
