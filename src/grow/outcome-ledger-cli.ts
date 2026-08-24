import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
  buildOutcomeLedger,
  normalizeOutcomeRow,
  type OutcomeLedger,
  type OutcomeRow,
} from "./outcome-ledger.js";

export const OUTCOME_LEDGER_CLI_VERSION = "outcome-ledger-cli-v1" as const;

export interface OutcomeLedgerCliIo {
  readonly readFile: (path: string) => string | Promise<string>;
  readonly write: (value: string) => void | Promise<void>;
  readonly error?: (value: string) => void | Promise<void>;
}

export type OutcomeLedgerCliSource =
  | { readonly kind: "json-string"; readonly value: string }
  | { readonly kind: "file"; readonly path: string };

export type OutcomeLedgerCliFormat = "json" | "markdown" | "both";

export interface OutcomeLedgerCliOptions {
  readonly source: OutcomeLedgerCliSource;
  readonly format: OutcomeLedgerCliFormat;
}

export class OutcomeLedgerCliValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutcomeLedgerCliValidationError";
  }
}

function fail(message: string): never {
  throw new OutcomeLedgerCliValidationError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value)) fail(`${field} must be an object`);
  return value;
}

function array(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) fail(`${field} must be an array`);
  return value;
}

function assertEnvelopeKeys(value: Record<string, unknown>): void {
  const allowed = ["rows", "funnelEvents", "businessOutcomes"];
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail(`input has unknown field "${key}"`);
  }
}

function normalizeRows(values: readonly unknown[], field: string): OutcomeRow[] {
  return values.map((value, index) => {
    try { return normalizeOutcomeRow(value); }
    catch (error) { fail(`${field}[${index}]: ${error instanceof Error ? error.message : "invalid outcome row"}`); }
  });
}

/** Parse an explicit JSON envelope. The command never reads a live source or writes a ledger. */
export function loadOutcomeLedgerEnvelope(raw: string): OutcomeRow[] {
  let parsed: unknown;
  try { parsed = JSON.parse(raw) as unknown; }
  catch { fail("input must be valid JSON"); }
  const source = object(parsed, "input");
  assertEnvelopeKeys(source);

  const hasRows = Object.hasOwn(source, "rows");
  const hasSplitRows = Object.hasOwn(source, "funnelEvents") || Object.hasOwn(source, "businessOutcomes");
  if (hasRows && hasSplitRows) fail("input must use rows or split row arrays, not both");
  if (!hasRows && !hasSplitRows) fail("input requires rows, funnelEvents, or businessOutcomes");
  if (hasRows) return normalizeRows(array(source.rows, "rows"), "rows");

  const funnelEvents = source.funnelEvents === undefined ? [] : array(source.funnelEvents, "funnelEvents");
  const businessOutcomes = source.businessOutcomes === undefined ? [] : array(source.businessOutcomes, "businessOutcomes");
  return [
    ...normalizeRows(funnelEvents, "funnelEvents"),
    ...normalizeRows(businessOutcomes, "businessOutcomes"),
  ];
}

export function buildOutcomeLedgerFromJson(raw: string): OutcomeLedger {
  return buildOutcomeLedger(loadOutcomeLedgerEnvelope(raw));
}

export function renderOutcomeLedgerJson(ledger: OutcomeLedger): string {
  return `${JSON.stringify(ledger, null, 2)}\n`;
}

function cell(value: string | number | null): string {
  return String(value ?? "null").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function list(values: readonly string[]): string {
  return cell(values.length === 0 ? null : values.join(", "));
}

function attributionList(row: OutcomeRow): string[] {
  return row.attribution.map((touch) => {
    const target = touch.contentItemId ?? `unknown (${touch.attributionReason})`;
    return `${touch.touchType}:${target}:${touch.confidence}`;
  });
}

export function renderOutcomeLedgerMarkdown(ledger: OutcomeLedger): string {
  const lines = [
    "# Outcome ledger",
    "",
    `Readiness: ${ledger.readiness.status}`,
    `Blockers: ${list(ledger.readiness.blockers)}`,
    `Side effects: ${ledger.sideEffects}`,
    "",
    "## Outcome families",
    "",
    "| Family | Count |",
    "|---|---:|",
    `| attention | ${ledger.familyCounts.attention} |`,
    `| conversation | ${ledger.familyCounts.conversation} |`,
    `| audience | ${ledger.familyCounts.audience} |`,
    `| funnel | ${ledger.familyCounts.funnel} |`,
    `| business | ${ledger.familyCounts.business} |`,
    "",
    "## Rows",
    "",
    "| ID | Type | Family | Observed | Collected | Metric | Value | Attribution | Evidence | Caveats |",
    "|---|---|---|---|---|---|---:|---|---|---|",
  ];
  for (const row of ledger.rows) {
    lines.push(
      `| ${cell(row.id)} | ${row.recordType} | ${row.family} | ${cell(row.observedAt)} | ${cell(row.collectedAt)} | ${cell(row.metric)} | ${cell(row.value)} | ${list(attributionList(row))} | ${list(row.evidenceRefs)} | ${list(row.caveats)} |`,
    );
  }
  return `${lines.join("\n")}\n`;
}

export function renderOutcomeLedger(ledger: OutcomeLedger, format: OutcomeLedgerCliFormat): string {
  if (format === "json") return renderOutcomeLedgerJson(ledger);
  if (format === "markdown") return renderOutcomeLedgerMarkdown(ledger);
  return `${renderOutcomeLedgerJson(ledger)}\n${renderOutcomeLedgerMarkdown(ledger)}`;
}

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value`);
  return value;
}

export function parseOutcomeLedgerArgs(argv: readonly string[]): OutcomeLedgerCliOptions {
  let inputPath: string | undefined;
  let jsonText: string | undefined;
  let format: OutcomeLedgerCliFormat = "json";
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--input" || argument === "--file") {
      if (inputPath !== undefined || jsonText !== undefined) throw new Error("exactly one of --json or --input/--file is allowed");
      inputPath = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--json") {
      if (inputPath !== undefined || jsonText !== undefined) throw new Error("exactly one of --json or --input/--file is allowed");
      jsonText = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--format") {
      const value = optionValue(argv, index, argument);
      if (value !== "json" && value !== "markdown" && value !== "both") throw new Error("--format must be json, markdown, or both");
      format = value;
      index += 1;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  if (inputPath === undefined && jsonText === undefined) throw new Error("exactly one of --json or --input/--file is required");
  return {
    source: inputPath === undefined ? { kind: "json-string", value: jsonText as string } : { kind: "file", path: inputPath },
    format,
  };
}

const defaultIo: OutcomeLedgerCliIo = {
  readFile: (path) => readFile(path, "utf8"),
  write: (value) => { process.stdout.write(value); },
  error: (value) => { process.stderr.write(value); },
};

export async function main(argv: readonly string[] = process.argv.slice(2), io: Partial<OutcomeLedgerCliIo> = {}): Promise<number> {
  const effectiveIo: OutcomeLedgerCliIo = { ...defaultIo, ...io };
  try {
    const options = parseOutcomeLedgerArgs(argv);
    const raw = options.source.kind === "json-string" ? options.source.value : await effectiveIo.readFile(options.source.path);
    if (typeof raw !== "string") fail("input file must contain text");
    const ledger = buildOutcomeLedgerFromJson(raw);
    await effectiveIo.write(renderOutcomeLedger(ledger, options.format));
    return 0;
  } catch (error) {
    await effectiveIo.error?.(`grow:outcome-ledger: ${error instanceof Error ? error.message : "input is invalid"}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((exitCode) => { process.exitCode = exitCode; });
}
