import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
  bridgeReviewedEvidenceIntake,
  type ReviewedEvidenceIntakeReport,
} from "./reviewed-evidence-ledger-bridge.js";

export const REVIEWED_EVIDENCE_LEDGER_BRIDGE_CLI_VERSION = "reviewed-evidence-ledger-bridge-cli-v1" as const;

export type ReviewedEvidenceLedgerBridgeCliFormat = "json" | "markdown" | "both";
export type ReviewedEvidenceLedgerBridgeCliSource =
  | { readonly kind: "json-string"; readonly value: string }
  | { readonly kind: "file"; readonly path: string };

export interface ReviewedEvidenceLedgerBridgeCliOptions {
  readonly source: ReviewedEvidenceLedgerBridgeCliSource;
  readonly format: ReviewedEvidenceLedgerBridgeCliFormat;
}

export interface ReviewedEvidenceLedgerBridgeCliIo {
  readonly readFile: (path: string) => string | Promise<string>;
  readonly write: (value: string) => void | Promise<void>;
  readonly error?: (value: string) => void | Promise<void>;
}

export interface ReviewedEvidenceLedgerBridgeCounts {
  readonly accounts: number;
  readonly sources: number;
  readonly baselines: number;
  readonly total: number;
}

export interface ReviewedEvidenceLedgerBridgeBlocker {
  readonly kind: "account" | "evidence" | "baseline";
  readonly id: string | null;
  readonly blockers: readonly string[];
}

export interface ReviewedEvidenceLedgerBridgeCliReport {
  readonly kind: "reviewed_evidence_ledger_bridge";
  readonly version: typeof REVIEWED_EVIDENCE_LEDGER_BRIDGE_CLI_VERSION;
  readonly counts: ReviewedEvidenceLedgerBridgeCounts;
  readonly accounts: readonly Record<string, unknown>[];
  readonly sources: readonly Record<string, unknown>[];
  readonly baselines: readonly Record<string, unknown>[];
  readonly accountReviewInputs: readonly Record<string, unknown>[];
  readonly sourceEvidenceRecordInputs: readonly Record<string, unknown>[];
  readonly blockers: readonly ReviewedEvidenceLedgerBridgeBlocker[];
  readonly bodyIncluded: false;
  readonly sideEffects: "none";
}

export class ReviewedEvidenceLedgerBridgeCliValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewedEvidenceLedgerBridgeCliValidationError";
  }
}

function fail(message: string): never {
  throw new ReviewedEvidenceLedgerBridgeCliValidationError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (value === undefined || value === "" || value.startsWith("--")) fail(`${option} requires a value`);
  return value;
}

function optionEquals(argument: string, option: string): string {
  const value = argument.slice(option.length + 1);
  if (value === "") fail(`${option} requires a value`);
  return value;
}

function chooseSource(
  current: ReviewedEvidenceLedgerBridgeCliSource | undefined,
  next: ReviewedEvidenceLedgerBridgeCliSource,
): ReviewedEvidenceLedgerBridgeCliSource {
  if (current !== undefined) fail("exactly one of --json or --input/--file is allowed");
  return next;
}

export function parseReviewedEvidenceLedgerBridgeArgs(argv: readonly string[]): ReviewedEvidenceLedgerBridgeCliOptions {
  let source: ReviewedEvidenceLedgerBridgeCliSource | undefined;
  let format: ReviewedEvidenceLedgerBridgeCliFormat = "json";
  let formatSeen = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") {
      source = chooseSource(source, { kind: "json-string", value: optionValue(argv, index, argument) });
      index += 1;
    } else if (argument.startsWith("--json=")) {
      source = chooseSource(source, { kind: "json-string", value: optionEquals(argument, "--json") });
    } else if (argument === "--input" || argument === "--file") {
      source = chooseSource(source, { kind: "file", path: optionValue(argv, index, argument) });
      index += 1;
    } else if (argument.startsWith("--input=") || argument.startsWith("--file=")) {
      const option = argument.startsWith("--input=") ? "--input" : "--file";
      source = chooseSource(source, { kind: "file", path: optionEquals(argument, option) });
    } else if (argument === "--format") {
      if (formatSeen) fail("--format may be supplied only once");
      const value = optionValue(argv, index, argument);
      if (value !== "json" && value !== "markdown" && value !== "both") fail("--format must be json, markdown, or both");
      format = value;
      formatSeen = true;
      index += 1;
    } else if (argument.startsWith("--format=")) {
      if (formatSeen) fail("--format may be supplied only once");
      const value = optionEquals(argument, "--format");
      if (value !== "json" && value !== "markdown" && value !== "both") fail("--format must be json, markdown, or both");
      format = value;
      formatSeen = true;
    } else {
      fail(`unknown argument: ${argument}`);
    }
  }

  if (source === undefined) fail("exactly one of --json or --input/--file is required");
  return { source, format };
}

export const parseArgs = parseReviewedEvidenceLedgerBridgeArgs;

function validateReadiness(value: unknown, path: string): void {
  if (!isRecord(value)) fail(`${path} must be an object`);
  if (value.status !== "ready" && value.status !== "blocked" && value.status !== "unmapped") {
    fail(`${path}.status must be ready, blocked, or unmapped`);
  }
  if (!Array.isArray(value.blockers) || value.blockers.some((blocker) => typeof blocker !== "string")) {
    fail(`${path}.blockers must be an array of strings`);
  }
}

function validateScalar(value: unknown, path: string): void {
  if (value !== null && value !== "unknown" && typeof value !== "string") fail(`${path} must be a string, null, or unknown`);
}

function validateRows(rows: Record<string, unknown>): void {
  for (const field of ["accounts", "evidence", "baselines"] as const) {
    if (!Array.isArray(rows[field])) fail(`input.rows.${field} must be an array`);
    rows[field].forEach((row, index) => {
      const path = `input.rows.${field}[${index}]`;
      if (!isRecord(row)) fail(`${path} must be an object`);
      if (Object.hasOwn(row, "bodyIncluded") && row.bodyIncluded !== false) fail(`${path}.bodyIncluded must be false`);
      validateReadiness(row.readiness, `${path}.readiness`);
      if (field === "accounts") {
        if (typeof row.id !== "string") fail(`${path}.id must be a string`);
        if (row.kind !== "reviewed_account_intake_row" || row.version !== "reviewed-evidence-intake-v1") fail(`${path} has an unsupported kind or version`);
        for (const key of ["currentAccountKey", "platform", "handle", "creator", "stableAccountId", "stableAccountIdStatus", "nicheLabel", "popularityScope", "sampleScope", "baselineScope", "baselineSource", "medium", "format", "reviewer", "reviewedAt", "dispositionReason"]) {
          if (Object.hasOwn(row, key)) validateScalar(row[key], `${path}.${key}`);
        }
        if (row.disposition !== null && row.disposition !== undefined && !["pending", "reviewed", "blocked", "unmapped"].includes(String(row.disposition))) fail(`${path}.disposition is unsupported`);
      } else if (field === "evidence") {
        if (row.id !== null && row.id !== "unknown" && typeof row.id !== "string") fail(`${path}.id must be a string, null, or unknown`);
        if (row.kind !== "reviewed_source_evidence_intake_row" || row.version !== "reviewed-evidence-intake-v1") fail(`${path} has an unsupported kind or version`);
        for (const key of ["sourceId", "postId", "accountId", "platform", "medium", "format", "membershipReason", "popularityScope", "sampleScope", "baselineScope", "baselineSource", "provenance", "observedAt", "collectedAt", "reviewStatus", "status"]) {
          if (Object.hasOwn(row, key)) validateScalar(row[key], `${path}.${key}`);
        }
      } else if (row.id !== null && row.id !== "unknown" && typeof row.id !== "string") {
        fail(`${path}.id must be a string, null, or unknown`);
      }
    });
  }
}

function parseReport(raw: string): ReviewedEvidenceIntakeReport {
  if (typeof raw !== "string") fail("input must be JSON text");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    fail("input must be valid JSON");
  }
  if (!isRecord(parsed)) fail("input must be a JSON object report");
  if (parsed.kind !== "reviewed_evidence_intake" || parsed.version !== "reviewed-evidence-intake-v1") fail("unsupported reviewed evidence intake report");
  if (!isRecord(parsed.rows)) fail("input.rows must be an object");
  validateRows(parsed.rows);
  if (parsed.bodyIncluded !== false) fail("input.bodyIncluded must be false");
  if (parsed.sideEffects !== "none") fail("input.sideEffects must be none");
  try {
    bridgeReviewedEvidenceIntake(parsed as unknown as ReviewedEvidenceIntakeReport);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
  return parsed as unknown as ReviewedEvidenceIntakeReport;
}

export function loadReviewedEvidenceLedgerBridgeInput(raw: string): ReviewedEvidenceIntakeReport {
  return parseReport(raw);
}

export const loadReviewedEvidenceLedgerBridgeEnvelope = loadReviewedEvidenceLedgerBridgeInput;
export const parseReviewedEvidenceLedgerBridgeInput = loadReviewedEvidenceLedgerBridgeInput;

function clone(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clone);
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, nested]) => [key, clone(nested)]));
  return value;
}

function ownFields(row: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) if (Object.hasOwn(row, field)) result[field] = clone(row[field]);
  return result;
}

const ACCOUNT_FIELDS = ["kind", "version", "id", "currentAccountKey", "platform", "handle", "creator", "stableAccountId", "stableAccountIdStatus", "topics", "focus", "nicheLabel", "researchPoolMembership", "popularityScope", "sampleScope", "baselineScope", "baselineSource", "medium", "format", "audienceSnapshot", "evidenceLinks", "evidenceRefs", "caveats", "reviewer", "reviewedAt", "disposition", "dispositionReason", "readiness", "bodyIncluded"] as const;
const SOURCE_FIELDS = ["kind", "version", "id", "sourceId", "postId", "accountId", "platform", "medium", "format", "pool", "membershipReason", "audienceSizeSnapshot", "metricSnapshot", "comparisonClaimed", "popularityScope", "sampleScope", "baselineScope", "baselineSource", "evidenceLinks", "evidenceRefs", "bodyComplete", "caveats", "provenance", "observedAt", "collectedAt", "reviewStatus", "status", "lineage", "readiness", "bodyIncluded"] as const;
const BASELINE_FIELDS = ["kind", "version", "id", "accountId", "platform", "source", "settledSampleDate", "window", "numerator", "denominator", "metric", "sampleSize", "unavailableReason", "baselineScope", "baselineSource", "evidenceLinks", "evidenceRefs", "caveats", "reviewer", "reviewedAt", "reviewStatus", "readiness", "bodyIncluded"] as const;

function byId(left: Record<string, unknown>, right: Record<string, unknown>): number {
  return String(left.id ?? "").localeCompare(String(right.id ?? ""));
}

function safeRows(report: ReviewedEvidenceIntakeReport, fields: readonly string[], rows: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => ownFields(row, fields)).sort(byId);
}

function buildOperatorReport(report: ReviewedEvidenceIntakeReport): ReviewedEvidenceLedgerBridgeCliReport {
  const bridge = bridgeReviewedEvidenceIntake(report);
  const accounts = safeRows(report, ACCOUNT_FIELDS, report.rows.accounts as readonly Record<string, unknown>[]);
  const sources = safeRows(report, SOURCE_FIELDS, report.rows.evidence as readonly Record<string, unknown>[]);
  const baselines = safeRows(report, BASELINE_FIELDS, report.rows.baselines as readonly Record<string, unknown>[]);
  const accountById = new Map(accounts.map((row) => [String(row.id), row]));
  const sourceById = new Map(sources.map((row) => [String(row.id ?? ""), row]));

  const accountReviewInputs = bridge.accountReviewInputs.map((input) => {
    const original = accountById.get(String(input.id));
    return {
      ...clone(input) as Record<string, unknown>,
      currentAccountKey: original?.currentAccountKey,
      platform: original?.platform,
      handle: original?.handle,
      creator: original?.creator,
      stableAccountId: original?.stableAccountId,
      stableAccountIdStatus: original?.stableAccountIdStatus,
      topics: original?.topics,
      focus: original?.focus,
      audienceSnapshot: original?.audienceSnapshot,
      evidenceLinks: original?.evidenceLinks,
      evidenceRefs: original?.evidenceRefs,
      disposition: original?.disposition,
      dispositionReason: original?.dispositionReason,
    };
  });

  const sourceEvidenceRecordInputs = bridge.sourceEvidenceRecordInputs.map((input) => {
    const original = sourceById.get(String(input.id ?? ""));
    return {
      ...clone(input) as Record<string, unknown>,
      id: original?.id ?? input.id,
      evidenceId: original?.id ?? input.evidenceId,
      sourceId: original?.sourceId,
      postId: original?.postId,
      accountId: original?.accountId,
      platform: original?.platform,
      evidenceLinks: original?.evidenceLinks,
      evidenceRefs: original?.evidenceRefs,
      reviewStatus: original?.reviewStatus,
      recordStatus: original?.status,
      bodyIncluded: false,
    };
  });

  return {
    kind: "reviewed_evidence_ledger_bridge",
    version: REVIEWED_EVIDENCE_LEDGER_BRIDGE_CLI_VERSION,
    counts: { accounts: accounts.length, sources: sources.length, baselines: baselines.length, total: accounts.length + sources.length + baselines.length },
    accounts,
    sources,
    baselines,
    accountReviewInputs,
    sourceEvidenceRecordInputs,
    blockers: bridge.blockers.map((blocker) => ({ kind: blocker.kind, id: blocker.id, blockers: [...blocker.blockers] })),
    bodyIncluded: false,
    sideEffects: "none",
  };
}

export function buildReviewedEvidenceLedgerBridgeCliFromJson(raw: string): ReviewedEvidenceLedgerBridgeCliReport {
  return buildOperatorReport(parseReport(raw));
}

export const buildReviewedEvidenceLedgerBridgeFromJson = buildReviewedEvidenceLedgerBridgeCliFromJson;
export const buildReviewedEvidenceLedgerBridgeCli = buildReviewedEvidenceLedgerBridgeCliFromJson;

function renderable(report: ReviewedEvidenceLedgerBridgeCliReport): ReviewedEvidenceLedgerBridgeCliReport {
  return {
    kind: report.kind,
    version: report.version,
    counts: { ...report.counts },
    accounts: report.accounts.map((row) => ownFields(row, ACCOUNT_FIELDS)),
    sources: report.sources.map((row) => ownFields(row, SOURCE_FIELDS)),
    baselines: report.baselines.map((row) => ownFields(row, BASELINE_FIELDS)),
    accountReviewInputs: report.accountReviewInputs.map((row) => clone(row) as Record<string, unknown>),
    sourceEvidenceRecordInputs: report.sourceEvidenceRecordInputs.map((row) => clone(row) as Record<string, unknown>),
    blockers: report.blockers.map((blocker) => ({ kind: blocker.kind, id: blocker.id, blockers: [...blocker.blockers] })),
    bodyIncluded: false,
    sideEffects: "none",
  };
}

export function renderReviewedEvidenceLedgerBridgeJson(report: ReviewedEvidenceLedgerBridgeCliReport): string {
  return `${JSON.stringify(renderable(report), null, 2)}\n`;
}

function markdownText(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (value === "unknown") return "unknown";
  return String(value).replace(/`/g, "'").replace(/\r?\n/g, " ").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function rowJson(rows: readonly Record<string, unknown>[]): string[] {
  return rows.flatMap((row) => ["```json", JSON.stringify(row, null, 2), "```", ""]);
}

export function renderReviewedEvidenceLedgerBridgeMarkdown(report: ReviewedEvidenceLedgerBridgeCliReport): string {
  const view = renderable(report);
  const lines = [
    "# Reviewed evidence ledger bridge",
    "",
    "Read-only, body-free operator metadata. Counts are row counts from the explicit report; no disposition, status, or baseline facts are inferred.",
    "",
    "## Counts",
    "",
    `- Accounts: ${view.counts.accounts}`,
    `- Sources: ${view.counts.sources}`,
    `- Baselines: ${view.counts.baselines}`,
    `- Total rows: ${view.counts.total}`,
    "",
    "## Blockers",
    "",
    "| Kind | ID | Blocker |",
    "|---|---|---|",
    ...(view.blockers.length === 0 ? ["| none | none | none |"] : view.blockers.flatMap((blocker) => blocker.blockers.map((reason) => `| ${blocker.kind} | ${markdownText(blocker.id)} | ${markdownText(reason)} |`))),
    "",
    "## Accounts",
    "",
    ...rowJson(view.accounts),
    "## Sources",
    "",
    ...rowJson(view.sources),
    "## Baselines",
    "",
    ...rowJson(view.baselines),
    "## Ledger projections",
    "",
    ...rowJson(view.accountReviewInputs),
    ...rowJson(view.sourceEvidenceRecordInputs),
  ];
  return `${lines.join("\n")}\n`;
}

export function renderReviewedEvidenceLedgerBridge(report: ReviewedEvidenceLedgerBridgeCliReport, format: ReviewedEvidenceLedgerBridgeCliFormat): string {
  if (format === "json") return renderReviewedEvidenceLedgerBridgeJson(report);
  if (format === "markdown") return renderReviewedEvidenceLedgerBridgeMarkdown(report);
  return `${renderReviewedEvidenceLedgerBridgeJson(report)}\n${renderReviewedEvidenceLedgerBridgeMarkdown(report)}`;
}

export const renderReviewedEvidenceLedgerBridgeReport = renderReviewedEvidenceLedgerBridge;

async function readSource(source: ReviewedEvidenceLedgerBridgeCliSource, io: Pick<ReviewedEvidenceLedgerBridgeCliIo, "readFile">): Promise<string> {
  if (source.kind === "json-string") return source.value;
  try {
    const value = await io.readFile(source.path);
    if (typeof value !== "string") fail("input file must contain text");
    return value;
  } catch (error) {
    if (error instanceof ReviewedEvidenceLedgerBridgeCliValidationError) throw error;
    fail("input could not be read");
  }
}

export const readReviewedEvidenceLedgerBridgeRequest = readSource;

const defaultIo: ReviewedEvidenceLedgerBridgeCliIo = {
  readFile: (path) => readFile(path, "utf8"),
  write: (value) => { process.stdout.write(value); },
  error: (value) => { process.stderr.write(value); },
};

export async function main(argv: readonly string[] = process.argv.slice(2), io: Partial<ReviewedEvidenceLedgerBridgeCliIo> = {}): Promise<number> {
  const effectiveIo: ReviewedEvidenceLedgerBridgeCliIo = { readFile: io.readFile ?? defaultIo.readFile, write: io.write ?? defaultIo.write, error: io.error ?? defaultIo.error };
  try {
    const options = parseReviewedEvidenceLedgerBridgeArgs(argv);
    const report = buildReviewedEvidenceLedgerBridgeCliFromJson(await readSource(options.source, effectiveIo));
    await effectiveIo.write(renderReviewedEvidenceLedgerBridge(report, options.format));
    return 0;
  } catch (error) {
    await effectiveIo.error?.(`patterns:reviewed-evidence-ledger-bridge: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((exitCode) => { process.exitCode = exitCode; });
}
