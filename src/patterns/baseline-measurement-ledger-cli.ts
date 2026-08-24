import { appendFile, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
  appendBaselineMeasurement,
  assessBaselineMeasurementReadiness,
  createBaselineMeasurementLedger,
  type BaselineMeasurementFact,
  type BaselineMeasurementLedger,
  type BaselineMeasurementReadiness,
} from "./baseline-measurement-ledger.js";

export const BASELINE_MEASUREMENT_LEDGER_CLI_VERSION = "baseline-measurement-ledger-cli-v1" as const;

export type BaselineMeasurementLedgerCliCommand = "inspect" | "append";
export type BaselineMeasurementLedgerCliFormat = "json" | "markdown" | "both";

export interface BaselineMeasurementLedgerCliOptions {
  readonly command: BaselineMeasurementLedgerCliCommand;
  readonly path: string;
  readonly fact: string | undefined;
  readonly format: BaselineMeasurementLedgerCliFormat;
}

/** The only persistence operations this adapter needs. Tests can supply all three. */
export interface BaselineMeasurementLedgerCliIo {
  readonly readJsonl?: (path: string) => string | Promise<string>;
  readonly appendJsonl?: (path: string, line: string) => void | Promise<void>;
  readonly stdout?: (value: string) => void | Promise<void>;
  readonly stderr?: (value: string) => void | Promise<void>;
  /** Compatibility names for callers that already use the other read-only CLI adapters. */
  readonly readFile?: (path: string) => string | Promise<string>;
  readonly write?: (value: string) => void | Promise<void>;
  readonly error?: (value: string) => void | Promise<void>;
}

export class BaselineMeasurementLedgerCliValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BaselineMeasurementLedgerCliValidationError";
  }
}

type UnknownRecord = Record<string, unknown>;

function fail(message: string): never {
  throw new BaselineMeasurementLedgerCliValidationError(message);
}

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (value === undefined || value === "" || value.startsWith("--")) fail(`${option} requires a value`);
  return value;
}

function equalOption(argument: string, option: string): string | undefined {
  if (!argument.startsWith(`${option}=`)) return undefined;
  const value = argument.slice(option.length + 1);
  if (value === "") fail(`${option} requires a value`);
  return value;
}

function setPath(current: string | undefined, next: string): string {
  if (current !== undefined) fail("exactly one of --input/--file/--ledger is allowed");
  return next;
}

/** Parse one explicit inspect or append command. No default ledger path is inferred. */
export function parseBaselineMeasurementLedgerArgs(argv: readonly string[]): BaselineMeasurementLedgerCliOptions {
  const command = argv[0];
  if (command !== "inspect" && command !== "append") fail("command must be inspect or append");

  let path: string | undefined;
  let fact: string | undefined;
  let format: BaselineMeasurementLedgerCliFormat = "json";
  let formatSupplied = false;

  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--input" || argument === "--file" || argument === "--ledger") {
      path = setPath(path, optionValue(argv, index, argument));
      index += 1;
    } else if (argument.startsWith("--input=") || argument.startsWith("--file=") || argument.startsWith("--ledger=")) {
      const option = argument.startsWith("--input=") ? "--input" : argument.startsWith("--file=") ? "--file" : "--ledger";
      path = setPath(path, equalOption(argument, option) as string);
    } else if (argument === "--fact" || argument === "--fact-json") {
      if (fact !== undefined) fail("--fact may be supplied only once");
      fact = optionValue(argv, index, argument);
      index += 1;
    } else if (argument.startsWith("--fact=") || argument.startsWith("--fact-json=")) {
      if (fact !== undefined) fail("--fact may be supplied only once");
      fact = argument.startsWith("--fact=")
        ? equalOption(argument, "--fact")
        : equalOption(argument, "--fact-json");
    } else if (argument === "--format") {
      if (formatSupplied) fail("--format may be supplied only once");
      const value = optionValue(argv, index, argument);
      if (value !== "json" && value !== "markdown" && value !== "both") fail("--format must be json, markdown, or both");
      format = value;
      formatSupplied = true;
      index += 1;
    } else if (argument.startsWith("--format=")) {
      if (formatSupplied) fail("--format may be supplied only once");
      const value = equalOption(argument, "--format");
      if (value !== "json" && value !== "markdown" && value !== "both") fail("--format must be json, markdown, or both");
      format = value;
      formatSupplied = true;
    } else {
      fail(`unknown argument: ${argument}`);
    }
  }

  if (path === undefined) fail("one of --input/--file/--ledger is required");
  if (command === "inspect" && fact !== undefined) fail("--fact is only valid for append");
  if (command === "append" && fact === undefined) fail("--fact is required for append");
  return { command, path, fact, format };
}

export const parseArgs = parseBaselineMeasurementLedgerArgs;

/** Parse append-only JSONL. Blank lines are harmless; every non-blank line must be one fact. */
export function loadBaselineMeasurementLedgerInput(raw: string): BaselineMeasurementLedger {
  if (typeof raw !== "string") fail("ledger input must be text");
  const rows: BaselineMeasurementFact[] = [];
  const lines = raw.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? "";
    if (line === "") continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch {
      fail(`ledger line ${index + 1} must be valid JSON`);
    }
    if (!isRecord(parsed)) fail(`ledger line ${index + 1} must be an object fact`);
    rows.push(parsed as unknown as BaselineMeasurementFact);
  }
  try {
    return createBaselineMeasurementLedger(rows);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

export const parseBaselineMeasurementLedgerInput = loadBaselineMeasurementLedgerInput;
export const loadBaselineMeasurementLedgerJsonl = loadBaselineMeasurementLedgerInput;

export function buildBaselineMeasurementLedgerFromJsonl(raw: string): BaselineMeasurementLedger {
  return loadBaselineMeasurementLedgerInput(raw);
}

function parseFactJson(raw: string): BaselineMeasurementFact {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    fail("fact must be valid JSON");
  }
  if (!isRecord(parsed)) fail("fact must be a JSON object");
  return parsed as unknown as BaselineMeasurementFact;
}

interface InspectionRow extends BaselineMeasurementFact {
  readonly readiness: BaselineMeasurementReadiness;
}

interface BaselineMeasurementLedgerInspection {
  readonly kind: "baseline_measurement_ledger";
  readonly version: "baseline-measurement-ledger-v1";
  readonly rows: readonly InspectionRow[];
  readonly bodyFree: true;
  readonly sideEffects: "none";
}

function inspectLedger(ledger: BaselineMeasurementLedger): BaselineMeasurementLedgerInspection {
  return {
    kind: ledger.kind,
    version: ledger.version,
    rows: ledger.rows.map((row) => ({
      id: row.id,
      accountId: row.accountId,
      platform: row.platform,
      route: row.route,
      settled: row.settled,
      sample: { windowStart: row.sample.windowStart, windowEnd: row.sample.windowEnd },
      metric: { name: row.metric.name, numerator: row.metric.numerator, denominator: row.metric.denominator },
      method: row.method,
      observedAt: row.observedAt,
      collectedAt: row.collectedAt,
      baselineScope: row.baselineScope,
      baselineSource: row.baselineSource,
      evidenceRefs: [...row.evidenceRefs],
      reviewerStatus: row.reviewerStatus,
      unavailableReason: row.unavailableReason,
      readiness: assessBaselineMeasurementReadiness(row),
    })),
    bodyFree: true,
    sideEffects: "none",
  };
}

export function renderBaselineMeasurementLedgerJson(ledger: BaselineMeasurementLedger): string {
  return `${JSON.stringify(inspectLedger(ledger), null, 2)}\n`;
}

function markdownText(value: unknown): string {
  if (value === null || value === undefined) return "none";
  return String(value).replace(/\r?\n/g, " ").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function markdownList(values: readonly string[]): string {
  return values.length === 0 ? "none" : values.map(markdownText).join(", ");
}

export function renderBaselineMeasurementLedgerMarkdown(ledger: BaselineMeasurementLedger): string {
  const lines = ["# Baseline measurement ledger", ""];
  for (const row of ledger.rows) {
    const readiness = assessBaselineMeasurementReadiness(row);
    lines.push(
      `## ${markdownText(row.id)}`,
      "",
      `- Account: ${markdownText(row.accountId)}`,
      `- Platform: ${markdownText(row.platform)}`,
      `- Route: ${markdownText(row.route)}`,
      `- Metric: ${markdownText(row.metric.name)}`,
      `- Numerator: ${markdownText(row.metric.numerator)}`,
      `- Denominator: ${markdownText(row.metric.denominator)}`,
      `- Window: ${markdownText(row.sample.windowStart)} to ${markdownText(row.sample.windowEnd)}`,
      `- Method: ${markdownText(row.method)}`,
      `- Observed / collected: ${markdownText(row.observedAt)} / ${markdownText(row.collectedAt)}`,
      `- Baseline scope: ${markdownText(row.baselineScope)}`,
      `- Baseline source: ${markdownText(row.baselineSource)}`,
      `- Evidence refs: ${markdownList(row.evidenceRefs)}`,
      `- Reviewer status: ${markdownText(row.reviewerStatus)}`,
      `- Readiness: ${readiness.status.toUpperCase()}`,
      `- Blockers: ${markdownList(readiness.blockers)}`,
      `- Unavailable reason: ${markdownText(row.unavailableReason)}`,
      "",
    );
  }
  return `${lines.join("\n")}\n`;
}

export function renderBaselineMeasurementLedger(
  ledger: BaselineMeasurementLedger,
  format: BaselineMeasurementLedgerCliFormat,
): string {
  if (format === "json") return renderBaselineMeasurementLedgerJson(ledger);
  if (format === "markdown") return renderBaselineMeasurementLedgerMarkdown(ledger);
  return `${renderBaselineMeasurementLedgerJson(ledger)}\n${renderBaselineMeasurementLedgerMarkdown(ledger)}`;
}

const defaultIo: Required<Pick<BaselineMeasurementLedgerCliIo, "readJsonl" | "appendJsonl" | "stdout" | "stderr">> = {
  readJsonl: (path) => readFile(path, "utf8"),
  appendJsonl: (path, line) => appendFile(path, line, "utf8"),
  stdout: (value) => { process.stdout.write(value); },
  stderr: (value) => { process.stderr.write(value); },
};

function effectiveIo(io: BaselineMeasurementLedgerCliIo) {
  return {
    readJsonl: io.readJsonl ?? io.readFile ?? defaultIo.readJsonl,
    appendJsonl: io.appendJsonl ?? defaultIo.appendJsonl,
    stdout: io.stdout ?? io.write ?? defaultIo.stdout,
    stderr: io.stderr ?? io.error ?? defaultIo.stderr,
  };
}

/** Inspect or append one explicit fact. Domain state is touched only through injected JSONL I/O. */
export async function main(
  argv: readonly string[] = process.argv.slice(2),
  io: BaselineMeasurementLedgerCliIo = {},
): Promise<number> {
  const output = effectiveIo(io);
  try {
    const options = parseBaselineMeasurementLedgerArgs(argv);
    const rawLedger = await output.readJsonl(options.path);
    let ledger = buildBaselineMeasurementLedgerFromJsonl(rawLedger);
    if (options.command === "append") {
      const next = appendBaselineMeasurement(ledger, parseFactJson(options.fact as string));
      const row = next.rows[next.rows.length - 1];
      if (row === undefined) fail("append produced no fact");
      const separator = ledger.rows.length > 0 && rawLedger.trim() !== "" && !rawLedger.endsWith("\n") && !rawLedger.endsWith("\r") ? "\n" : "";
      await output.appendJsonl(options.path, `${separator}${JSON.stringify(row)}\n`);
      ledger = next;
    }
    await output.stdout(renderBaselineMeasurementLedger(ledger, options.format));
    return 0;
  } catch (error) {
    await output.stderr(`patterns:baseline-measurement-ledger: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((exitCode) => { process.exitCode = exitCode; });
}
