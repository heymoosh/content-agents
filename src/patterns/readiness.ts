import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { buildCatalog, loadCatalogInputs, type PatternCatalog } from "./catalog.js";
import { buildEvidenceReadiness, type EvidenceReadinessArtifact } from "./evidence-readiness.js";
import {
  buildPlatformReadiness,
  type PlatformReadinessCatalog,
  type PlatformReadinessInventory,
} from "./platform-readiness.js";
import {
  validateReviewMetadata,
  validateReviewMetadataRows,
  type NormalizedReviewMetadataRecord,
  type ReviewMetadataInput,
  type ReviewMetadataRecord,
} from "./review-metadata.js";

/** The body-free, read-only report composed from the pattern evidence seams. */
export const PATTERN_READINESS_VERSION = "pattern-readiness-v1" as const;

export type ReviewInputStatus = "not_supplied" | "valid" | "invalid";
export type ReviewInputReviewStatus = "unreviewed" | "reviewed";

export interface ReviewInputReadiness {
  readonly status: "ready" | "blocked";
  readonly readyRows: number;
  readonly blockedRows: number;
  readonly blockingFields: string[];
  readonly reason: string;
}

export interface ReviewInputReport {
  readonly supplied: boolean;
  readonly path: string | null;
  readonly status: ReviewInputStatus;
  readonly reviewStatus: ReviewInputReviewStatus;
  readonly rowCount: number;
  readonly validRowCount: number;
  readonly invalidRowCount: number;
  readonly validationErrors: string[];
  readonly readiness: ReviewInputReadiness;
}

export interface ReadinessInputs {
  readonly catalog: PatternCatalog;
  readonly corpus: readonly unknown[];
  readonly analyses: readonly unknown[];
  readonly reviews?: readonly unknown[];
  readonly reviewsPath?: string | null;
  readonly reviewInput?: ReviewInputReport;
}

export interface ReadinessReport {
  readonly kind: "pattern_readiness";
  readonly version: typeof PATTERN_READINESS_VERSION;
  readonly reviewInput: ReviewInputReport;
  readonly evidenceReadiness: EvidenceReadinessArtifact;
  readonly platformReadiness: PlatformReadinessInventory;
  readonly sideEffects: "none";
}

export interface ReadinessCliIo {
  readonly write: (value: string) => void;
  readonly readFile: (path: string) => string;
}

export interface ReadinessPaths {
  config?: string;
  corpus?: string;
  analyses?: string;
}

interface ReviewInputEvaluation {
  readonly report: ReviewInputReport;
  readonly rows: NormalizedReviewMetadataRecord[];
}

const defaultIo: ReadinessCliIo = {
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

function shapeErrors(value: unknown, index: number): string[] {
  if (!isRecord(value)) return [`review row ${index + 1}: must be a JSON object`];
  const errors: string[] = [];
  for (const field of ["currentAccountKey", "platform", "stableAccountIdStatus"] as const) {
    if (typeof value[field] !== "string" || value[field].trim() === "") {
      errors.push(`review row ${index + 1}: ${field} must be a non-empty string`);
    }
  }
  for (const field of ["handle", "creator", "stableAccountId"] as const) {
    if (value[field] !== null && typeof value[field] !== "string") {
      errors.push(`review row ${index + 1}: ${field} must be a string or null`);
    }
  }
  for (const field of ["topics", "focus", "evidenceLinks", "caveats"] as const) {
    if (value[field] !== null && value[field] !== "unknown" && !Array.isArray(value[field])) {
      errors.push(`review row ${index + 1}: ${field} must be an array, null, or unknown`);
    }
  }
  for (const field of [
    "nicheLabel", "popularityScope", "sampleScope", "baselineScope", "baselineSource", "medium", "format",
    "reviewer", "reviewNote", "reviewed_at",
  ] as const) {
    if (value[field] !== null && value[field] !== "unknown" && typeof value[field] !== "string") {
      errors.push(`review row ${index + 1}: ${field} must be a string, null, or unknown`);
    }
  }
  if (value.audienceSnapshot !== null && !isRecord(value.audienceSnapshot)) {
    errors.push(`review row ${index + 1}: audienceSnapshot must be an object or null`);
  }
  if (value.researchPoolMembership !== null
    && value.researchPoolMembership !== "unknown"
    && !Array.isArray(value.researchPoolMembership)) {
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

function duplicateKeys(rows: readonly NormalizedReviewMetadataRecord[]): Set<string> {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.currentAccountKey, (counts.get(row.currentAccountKey) ?? 0) + 1);
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
}

function evaluateReviewRows(values: readonly unknown[], path: string | null): ReviewInputEvaluation {
  const shapeValidation = values.map((value, index) => shapeErrors(value, index));
  const structural = values
    .map((value, index) => ({ value, index, errors: shapeValidation[index] ?? [] }))
    .filter((row) => row.errors.length === 0)
    .map((row) => ({ ...row, value: row.value as ReviewMetadataRecord }));
  const rowValidation = structural.map((row) => validateReviewMetadata(row.value));
  const rowsValidation = validateReviewMetadataRows(structural.map((row) => row.value));
  const normalizedRows = rowValidation.map((result) => result.normalized);
  const duplicates = duplicateKeys(normalizedRows.filter((_, index) => rowValidation[index]?.errors.length === 0));
  const validRows = normalizedRows.filter((row, index) => {
    return rowValidation[index]?.ok === true && !duplicates.has(row.currentAccountKey);
  });
  const validationErrors = sortedUnique([
    ...shapeValidation.flat(),
    ...rowValidation.flatMap((result, index) => result.errors.map((error) => `review row ${structural[index]?.index + 1}: ${error}`)),
    ...rowValidation.flatMap((result, index) => result.errors.length === 0 && result.blockingFields.length > 0
      ? [`review row ${structural[index]?.index + 1}: required fields are incomplete: ${result.blockingFields.join(", ")}`]
      : []),
    ...rowsValidation.errors.filter((error) => error.startsWith("duplicate currentAccountKey ")),
  ]);
  const usableRows = normalizedRows.filter((row, index) => {
    return rowValidation[index]?.ok === true && !duplicates.has(row.currentAccountKey);
  });
  const readyRows = normalizedRows.filter((row, index) => {
    return rowValidation[index]?.ok === true
      && !duplicates.has(row.currentAccountKey)
      && rowValidation[index]?.blockingFields.length === 0
      && row.disposition === "reviewed";
  }).length;
  const duplicate = duplicates.size > 0;
  const blockingFields = sortedUnique([
    ...rowValidation.flatMap((result) => result.blockingFields),
    ...rowValidation
      .filter((result, index) => result.errors.length === 0 && !duplicates.has(normalizedRows[index]?.currentAccountKey ?? "")
        && result.normalized.disposition !== "reviewed")
      .map(() => "reviewStatus"),
    ...(duplicate ? ["duplicate currentAccountKey"] : []),
    ...(shapeValidation.some((errors) => errors.length > 0) || rowValidation.some((result) => !result.ok)
      ? ["reviewMetadata"] : []),
  ]);
  const allRowsReady = values.length > 0 && validationErrors.length === 0 && readyRows === values.length;
  return {
    // A review file is an atomic trust boundary. Do not let a valid sibling
    // row become reusable evidence when any row in the supplied batch fails
    // validation or completeness checks.
    rows: allRowsReady ? usableRows : [],
    report: {
      supplied: true,
      path,
      status: validationErrors.length === 0 ? "valid" : "invalid",
      reviewStatus: allRowsReady ? "reviewed" : "unreviewed",
      rowCount: values.length,
      validRowCount: validRows.length,
      invalidRowCount: values.length - validRows.length,
      validationErrors,
      readiness: {
        status: allRowsReady ? "ready" : "blocked",
        readyRows,
        blockedRows: values.length - readyRows,
        blockingFields: blockingFields.length || values.length > 0 ? blockingFields : ["reviewMetadata"],
        reason: allRowsReady
          ? "All supplied account metadata rows are complete and explicitly reviewed."
          : values.length === 0
            ? "Review input was supplied but contains no account metadata rows."
            : "One or more supplied account metadata rows are invalid, incomplete, or not explicitly reviewed.",
      },
    },
  };
}

function invalidReviewFile(path: string, message: string): ReviewInputEvaluation {
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
      validationErrors: [message],
      readiness: {
        status: "blocked",
        readyRows: 0,
        blockedRows: 0,
        blockingFields: ["reviewMetadata"],
        reason: message,
      },
    },
  };
}

function evaluateReviewFile(path: string, readFile: (path: string) => string): ReviewInputEvaluation {
  let raw: string;
  try {
    raw = readFile(path);
  } catch {
    return invalidReviewFile(path, "Review input could not be read.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return invalidReviewFile(path, "Review input could not be parsed as JSON.");
  }
  if (!Array.isArray(parsed)) return invalidReviewFile(path, "Review input must be a JSON array of account metadata rows.");
  return evaluateReviewRows(parsed, path);
}

function evaluateReviews(inputs: ReadinessInputs): ReviewInputEvaluation {
  if (inputs.reviewInput !== undefined) {
    return {
      report: inputs.reviewInput,
      rows: (inputs.reviews ?? []) as NormalizedReviewMetadataRecord[],
    };
  }
  if (inputs.reviews === undefined) return emptyReviewInput(inputs.reviewsPath ?? null);
  return evaluateReviewRows(inputs.reviews, inputs.reviewsPath ?? null);
}

function platformCatalog(catalog: PatternCatalog): PlatformReadinessCatalog {
  return {
    rows: catalog.rows.map((row) => ({
      accountId: row.accountId,
      platform: row.platform,
      configured: row.configured,
      collected: row.collected,
      formats: row.formats,
    })),
  };
}

function buildPlatformReport(evidence: EvidenceReadinessArtifact, catalog: PatternCatalog): PlatformReadinessInventory {
  return buildPlatformReadiness({
    catalog: platformCatalog(catalog),
    sourceEvidence: {
      rows: evidence.sourceEvidence.rows.map((row) => ({
        id: row.id,
        sourceId: row.sourceId,
        postId: row.postId,
        platform: row.platform,
        format: row.format,
        baselineScope: row.baselineScope,
        baselineSource: row.baselineSource,
      })),
    },
    comparisonReadiness: {
      rows: evidence.comparisonReadiness.rows.map((row) => ({
        id: row.id,
        evidenceId: row.evidenceId,
        sourceId: row.sourceId,
        postId: row.postId,
        platform: row.platform,
        format: row.format,
        readiness: row.readiness,
      })),
    },
    operatorReadiness: { gaps: evidence.operatorReadiness.gaps },
  });
}

/** Compose the catalog, evidence, review, and platform readiness views without side effects. */
export function buildReadinessReport(inputs: ReadinessInputs): ReadinessReport {
  const evaluated = evaluateReviews(inputs);
  const evidenceReadiness = buildEvidenceReadiness({
    catalog: inputs.catalog,
    corpus: [...inputs.corpus],
    analyses: [...inputs.analyses],
    reviews: [...evaluated.rows] as ReviewMetadataInput[],
  });
  return {
    kind: "pattern_readiness",
    version: PATTERN_READINESS_VERSION,
    reviewInput: evaluated.report,
    evidenceReadiness,
    platformReadiness: buildPlatformReport(evidenceReadiness, inputs.catalog),
    sideEffects: "none",
  };
}

export const buildPatternReadiness = buildReadinessReport;

export function renderReadinessJson(report: ReadinessReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

function markdownCell(value: string | null): string {
  return (value ?? "null").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function markdownList(values: readonly string[]): string {
  return markdownCell(values.length ? values.join(", ") : null);
}

export function renderReadinessMarkdown(report: ReadinessReport): string {
  const review = report.reviewInput;
  const evidence = report.evidenceReadiness;
  const platform = report.platformReadiness;
  const lines = [
    "# Pattern readiness",
    "",
    `Review input: ${review.status}${review.path ? ` (${markdownCell(review.path)})` : ""}`,
    `Review state: ${review.reviewStatus}`,
    `Review rows: ${review.rowCount} supplied | ${review.readiness.readyRows} ready | ${review.readiness.blockedRows} blocked`,
    `Review readiness: ${review.readiness.status}`,
    `Review reason: ${markdownCell(review.readiness.reason)}`,
    `Validation errors: ${review.validationErrors.length ? review.validationErrors.map(markdownCell).join("; ") : "none"}`,
    "",
    "## Evidence readiness",
    "",
    `Source evidence: ${evidence.sourceEvidence.summary.ready} ready | ${evidence.sourceEvidence.summary.blocked} blocked`,
    `Comparison evidence: ${evidence.comparisonReadiness.summary.ready} ready | ${evidence.comparisonReadiness.summary.blocked} blocked`,
    `Operator readiness: ${evidence.operatorReadiness.summary.ready} ready | ${evidence.operatorReadiness.summary.blocked} blocked`,
    `Operator gaps: ${markdownList(evidence.operatorReadiness.gaps)}`,
    "",
    "| Evidence ID | Platform | Format | Pool | Status | Blockers |",
    "|---|---|---|---|---|---|",
  ];
  for (const row of [...evidence.comparisonReadiness.rows].sort((left, right) => compareValues(left.id, right.id))) {
    lines.push(`| ${markdownCell(row.id)} | ${markdownCell(row.platform)} | ${markdownCell(row.format)} | ${markdownCell(row.pool)} | ${row.readiness.status} | ${markdownList(row.readiness.blockers)} |`);
  }
  lines.push(
    "",
    "## Platform readiness",
    "",
    `Summary: ${platform.summary.reusableRows} reusable | ${platform.summary.blockedRows} blocked | ${platform.summary.reviewedEvidence} reviewed evidence`,
    `Global blockers: ${markdownList(platform.summary.blockers)}`,
    "",
    "| Platform | Format | Configured targets | Collected evidence | Reviewed evidence | Baselines present/unknown/missing | Reusable | Blockers |",
    "|---|---|---:|---:|---:|---:|---|---|",
  );
  for (const row of [...platform.rows].sort((left, right) => compareValues(left.key, right.key))) {
    lines.push(`| ${markdownCell(row.platform)} | ${markdownCell(row.format)} | ${row.configuredTargets} | ${row.collectedEvidence} | ${row.reviewedEvidence} | ${row.baselines.present}/${row.baselines.unknown}/${row.baselines.missing} | ${row.reusable.status} | ${markdownList(row.blockers)} |`);
  }
  return `${lines.join("\n")}\n`;
}

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value`);
  return value;
}

function parseArgs(argv: readonly string[]): { paths: ReadinessPaths; reviewsPath?: string; format: "json" | "markdown" } {
  const paths: ReadinessPaths = {};
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

export function main(
  argv: readonly string[] = process.argv.slice(2),
  loadInputs: typeof loadCatalogInputs = loadCatalogInputs,
  io: Partial<ReadinessCliIo> = {},
): number {
  const options = parseArgs(argv);
  const inputs = loadInputs(options.paths);
  const catalog = buildCatalog(inputs.config, inputs.corpus, inputs.analyses);
  const evaluated = options.reviewsPath === undefined
    ? emptyReviewInput(null)
    : evaluateReviewFile(options.reviewsPath, io.readFile ?? defaultIo.readFile);
  const report = buildReadinessReport({
    catalog,
    corpus: inputs.corpus,
    analyses: inputs.analyses,
    reviews: evaluated.rows,
    reviewsPath: options.reviewsPath ?? null,
    reviewInput: evaluated.report,
  });
  (io.write ?? defaultIo.write)(options.format === "markdown"
    ? renderReadinessMarkdown(report)
    : renderReadinessJson(report));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
