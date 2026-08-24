import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  buildReviewedEvidenceIntake,
  type ReviewedAccountIntakeRow,
  type ReviewedBaselineIntakeRow,
  type ReviewedEvidenceIntakeInput,
  type ReviewedEvidenceIntakeReport,
  type ReviewedSourceEvidenceIntakeRow,
  ReviewedEvidenceIntakeValidationError,
} from "./reviewed-evidence-intake.js";

export const REVIEWED_EVIDENCE_INTAKE_CLI_VERSION = "reviewed-evidence-intake-cli-v1" as const;
export type ReviewedEvidenceIntakeCliFormat = "json" | "markdown" | "both";

export type ReviewedEvidenceIntakeCliSource =
  | { readonly kind: "json"; readonly value: string }
  | { readonly kind: "file"; readonly path: string };

export interface ReviewedEvidenceIntakeCliOptions {
  readonly source: ReviewedEvidenceIntakeCliSource;
  readonly format: ReviewedEvidenceIntakeCliFormat;
}

export interface ReviewedEvidenceIntakeCliIo {
  readonly readFile: (path: string) => string;
  readonly write: (value: string) => void;
  readonly error?: (value: string) => void;
}

export { ReviewedEvidenceIntakeValidationError };

function fail(message: string): never {
  throw new ReviewedEvidenceIntakeValidationError(message);
}

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) fail(`${option} requires a value`);
  return value;
}

export function parseReviewedEvidenceIntakeArgs(argv: readonly string[]): ReviewedEvidenceIntakeCliOptions {
  let source: ReviewedEvidenceIntakeCliSource | undefined;
  let format: ReviewedEvidenceIntakeCliFormat = "json";
  let formatSeen = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") {
      if (source) fail("exactly one of --json or --file is allowed");
      source = { kind: "json", value: optionValue(argv, index, argument) };
      index += 1;
    } else if (argument === "--file") {
      if (source) fail("exactly one of --json or --file is allowed");
      source = { kind: "file", path: optionValue(argv, index, argument) };
      index += 1;
    } else if (argument === "--format") {
      if (formatSeen) fail("--format may be supplied only once");
      const value = optionValue(argv, index, argument);
      if (value !== "json" && value !== "markdown" && value !== "both") fail("--format must be json, markdown, or both");
      format = value;
      formatSeen = true;
      index += 1;
    } else fail(`unknown argument: ${argument}`);
  }
  if (!source) fail("exactly one of --json or --file is required");
  return { source, format };
}

export const parseArgs = parseReviewedEvidenceIntakeArgs;

function parseEnvelope(raw: string): ReviewedEvidenceIntakeInput {
  if (typeof raw !== "string") fail("input must be JSON text");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    fail("input must be valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) fail("input must be an object with accountMetadataRows, sourceEvidenceRows, and baselineSamples arrays");
  const value = parsed as Record<string, unknown>;
  const required = ["accountMetadataRows", "sourceEvidenceRows", "baselineSamples"] as const;
  for (const field of required) if (!Object.prototype.hasOwnProperty.call(value, field)) fail(`input.${field} is required`);
  return {
    accountMetadataRows: value.accountMetadataRows as readonly unknown[],
    sourceEvidenceRows: value.sourceEvidenceRows as readonly unknown[],
    baselineSamples: value.baselineSamples as readonly unknown[],
  };
}

export function loadReviewedEvidenceIntakeInput(raw: string): ReviewedEvidenceIntakeInput {
  return parseEnvelope(raw);
}

export const parseReviewedEvidenceIntakeInput = loadReviewedEvidenceIntakeInput;

export function buildReviewedEvidenceIntakeFromJson(raw: string): ReviewedEvidenceIntakeReport {
  return buildReviewedEvidenceIntake(loadReviewedEvidenceIntakeInput(raw));
}

export const buildReviewedEvidenceIntakeCliFromJson = buildReviewedEvidenceIntakeFromJson;

function safeAccount(row: ReviewedAccountIntakeRow): ReviewedAccountIntakeRow {
  return {
    kind: row.kind, version: row.version, id: row.id, currentAccountKey: row.currentAccountKey, platform: row.platform,
    handle: row.handle, creator: row.creator, stableAccountId: row.stableAccountId, stableAccountIdStatus: row.stableAccountIdStatus,
    topics: row.topics, focus: row.focus, nicheLabel: row.nicheLabel, researchPoolMembership: row.researchPoolMembership,
    popularityScope: row.popularityScope, sampleScope: row.sampleScope, baselineScope: row.baselineScope, baselineSource: row.baselineSource,
    medium: row.medium, format: row.format, audienceSnapshot: row.audienceSnapshot, evidenceLinks: row.evidenceLinks,
    evidenceRefs: row.evidenceRefs, caveats: row.caveats, reviewer: row.reviewer, reviewedAt: row.reviewedAt,
    disposition: row.disposition, dispositionReason: row.dispositionReason, readiness: { status: row.readiness.status, blockers: [...row.readiness.blockers] }, bodyIncluded: false,
  };
}

function safeEvidence(row: ReviewedSourceEvidenceIntakeRow): ReviewedSourceEvidenceIntakeRow {
  return {
    kind: row.kind, version: row.version, id: row.id, sourceId: row.sourceId, postId: row.postId, accountId: row.accountId,
    platform: row.platform, medium: row.medium, format: row.format, pool: row.pool, membershipReason: row.membershipReason,
    audienceSizeSnapshot: row.audienceSizeSnapshot, metricSnapshot: row.metricSnapshot, comparisonClaimed: row.comparisonClaimed,
    popularityScope: row.popularityScope, sampleScope: row.sampleScope, baselineScope: row.baselineScope, baselineSource: row.baselineSource,
    evidenceLinks: row.evidenceLinks, evidenceRefs: row.evidenceRefs, bodyComplete: row.bodyComplete, caveats: row.caveats,
    provenance: row.provenance, observedAt: row.observedAt, collectedAt: row.collectedAt, reviewStatus: row.reviewStatus, status: row.status,
    lineage: row.lineage, readiness: { status: row.readiness.status, blockers: [...row.readiness.blockers] }, bodyIncluded: false,
  };
}

function safeBaseline(row: ReviewedBaselineIntakeRow): ReviewedBaselineIntakeRow {
  return {
    kind: row.kind, version: row.version, id: row.id, accountId: row.accountId, platform: row.platform, source: row.source,
    settledSampleDate: row.settledSampleDate, window: row.window, numerator: row.numerator, denominator: row.denominator, metric: row.metric,
    sampleSize: row.sampleSize, unavailableReason: row.unavailableReason, evidenceLinks: row.evidenceLinks, evidenceRefs: row.evidenceRefs,
    caveats: row.caveats, reviewer: row.reviewer, reviewedAt: row.reviewedAt, reviewStatus: row.reviewStatus,
    readiness: { status: row.readiness.status, blockers: [...row.readiness.blockers] }, bodyIncluded: false,
  };
}

function safeReport(report: ReviewedEvidenceIntakeReport): ReviewedEvidenceIntakeReport {
  return {
    kind: report.kind,
    version: report.version,
    rows: {
      accounts: report.rows.accounts.map(safeAccount),
      evidence: report.rows.evidence.map(safeEvidence),
      baselines: report.rows.baselines.map(safeBaseline),
    },
    summary: {
      accounts: { ...report.summary.accounts }, evidence: { ...report.summary.evidence }, baselines: { ...report.summary.baselines }, total: { ...report.summary.total },
      blockerCounts: { ...report.summary.blockerCounts },
    },
    readiness: { ...report.readiness },
    bodyIncluded: false,
    sideEffects: "none",
  };
}

export function renderReviewedEvidenceIntakeJson(report: ReviewedEvidenceIntakeReport): string {
  return `${JSON.stringify({ ...safeReport(report), cliVersion: REVIEWED_EVIDENCE_INTAKE_CLI_VERSION }, null, 2)}\n`;
}

function markdownText(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (value === "unknown") return "unknown";
  return String(value).replace(/[`|\r\n]/g, (character) => character === "|" ? "\\|" : " ").replace(/\s+/g, " ").trim();
}

function countText(count: { total: number; ready: number; blocked: number; unmapped: number; blockerCount: number }): string {
  return `${count.total} total, ${count.ready} ready, ${count.blocked} blocked, ${count.unmapped} unmapped, ${count.blockerCount} blockers`;
}

export function renderReviewedEvidenceIntakeMarkdown(report: ReviewedEvidenceIntakeReport): string {
  const view = safeReport(report);
  const lines = [
    "# Reviewed evidence intake",
    "",
    `Readiness: ${view.readiness.status} (${countText(view.readiness)})`,
    "",
    "## Rows",
    "",
    `- Accounts: ${countText(view.summary.accounts)}`,
    `- Evidence: ${countText(view.summary.evidence)}`,
    `- Baselines: ${countText(view.summary.baselines)}`,
    "",
    "| Group | ID | Account | Platform | Pool / source | Review / disposition | Readiness | Blockers |",
    "|---|---|---|---|---|---|---|---|",
    ...view.rows.accounts.map((row) => `| account | ${markdownText(row.id)} | ${markdownText(row.stableAccountId ?? row.currentAccountKey)} | ${markdownText(row.platform)} | ${markdownText(Array.isArray(row.researchPoolMembership) ? row.researchPoolMembership.map((membership) => membership.pool).join(", ") : row.researchPoolMembership)} | ${markdownText(row.disposition)} | ${row.readiness.status} | ${markdownText(row.readiness.blockers.join(", "))} |`),
    ...view.rows.evidence.map((row) => `| evidence | ${markdownText(row.id)} | ${markdownText(row.accountId)} | ${markdownText(row.platform)} | ${markdownText(row.pool)} | ${markdownText(row.reviewStatus)} | ${row.readiness.status} | ${markdownText(row.readiness.blockers.join(", "))} |`),
    ...view.rows.baselines.map((row) => `| baseline | ${markdownText(row.id)} | ${markdownText(row.accountId)} | ${markdownText(row.platform)} | ${markdownText(row.source)} | ${markdownText(row.reviewStatus)} | ${row.readiness.status} | ${markdownText(row.readiness.blockers.join(", "))} |`),
    "",
    `Blocker counts: ${Object.entries(view.summary.blockerCounts).map(([key, value]) => `${key} (${value})`).join(", ") || "none"}`,
    "",
    "This is a body-free, read-only intake validation report. It does not collect, rank, merge accounts, calculate metrics, select winners, invoke models, or write data.",
    "",
  ];
  return lines.join("\n");
}

export function renderReviewedEvidenceIntake(report: ReviewedEvidenceIntakeReport, format: ReviewedEvidenceIntakeCliFormat): string {
  if (format === "json") return renderReviewedEvidenceIntakeJson(report);
  if (format === "markdown") return renderReviewedEvidenceIntakeMarkdown(report);
  return `${renderReviewedEvidenceIntakeJson(report)}\n${renderReviewedEvidenceIntakeMarkdown(report)}`;
}

export const renderReviewedEvidenceIntakeReport = renderReviewedEvidenceIntake;

const defaultIo: ReviewedEvidenceIntakeCliIo = {
  readFile: (path) => readFileSync(path, "utf8"),
  write: (value) => process.stdout.write(value),
  error: (value) => process.stderr.write(value),
};

export function main(argv: readonly string[] = process.argv.slice(2), io: Partial<ReviewedEvidenceIntakeCliIo> = {}): number {
  const effectiveIo = { ...defaultIo, ...io };
  try {
    const options = parseReviewedEvidenceIntakeArgs(argv);
    const raw = options.source.kind === "json" ? options.source.value : effectiveIo.readFile(options.source.path);
    effectiveIo.write(renderReviewedEvidenceIntake(buildReviewedEvidenceIntakeFromJson(raw), options.format));
    return 0;
  } catch (error) {
    effectiveIo.error?.(`patterns:reviewed-evidence-intake: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
