import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

import {
  appendSourceEvidenceLedgerRecords,
  buildSourceEvidenceLedger,
  readSourceEvidenceLedger,
  type SourceEvidenceLedger,
  type SourceEvidenceLedgerPersistence,
} from "./source-evidence-ledger.js";

export const SOURCE_EVIDENCE_LEDGER_CLI_VERSION = "source-evidence-ledger-cli-v1" as const;
export type SourceEvidenceLedgerCliFormat = "json" | "markdown" | "both";

export type SourceEvidenceLedgerCliSource =
  | { readonly kind: "json"; readonly value: string }
  | { readonly kind: "file"; readonly path: string };

export interface SourceEvidenceLedgerCliOptions {
  readonly source: SourceEvidenceLedgerCliSource;
  readonly format: SourceEvidenceLedgerCliFormat;
  readonly appendPath: string | null;
}

export interface SourceEvidenceLedgerCliIo {
  readonly readFile: (path: string) => string;
  readonly appendFile: (path: string, value: string) => void;
  readonly write: (value: string) => void;
  readonly error?: (value: string) => void;
}

export class SourceEvidenceLedgerCliValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceEvidenceLedgerCliValidationError";
  }
}

function fail(message: string): never {
  throw new SourceEvidenceLedgerCliValidationError(message);
}

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) fail(`${option} requires a value`);
  return value;
}

export function parseSourceEvidenceLedgerArgs(argv: readonly string[]): SourceEvidenceLedgerCliOptions {
  let source: SourceEvidenceLedgerCliSource | undefined;
  let format: SourceEvidenceLedgerCliFormat = "json";
  let appendPath: string | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") {
      if (source) fail("exactly one of --json or --file is allowed");
      source = { kind: "json", value: optionValue(argv, index, argument) };
      index += 1;
    } else if (argument === "--file" || argument === "--input") {
      if (source) fail("exactly one of --json or --file is allowed");
      source = { kind: "file", path: optionValue(argv, index, argument) };
      index += 1;
    } else if (argument === "--format") {
      const value = optionValue(argv, index, argument);
      if (value !== "json" && value !== "markdown" && value !== "both") fail("--format must be json, markdown, or both");
      format = value;
      index += 1;
    } else if (argument === "--append") {
      if (appendPath !== null) fail("--append may be supplied only once");
      appendPath = optionValue(argv, index, argument);
      index += 1;
    } else {
      fail(`unknown argument: ${argument}`);
    }
  }
  if (!source) fail("exactly one of --json or --file is required");
  return { source, format, appendPath };
}

export const parseArgs = parseSourceEvidenceLedgerArgs;

function parseInput(raw: string): unknown {
  if (typeof raw !== "string") fail("input must be JSON text");
  try { return JSON.parse(raw) as unknown; }
  catch { fail("input must be valid JSON"); }
}

/** Load only rows or a `{ rows }`/`{ records }` envelope. The core normalizer rejects row fields. */
export function loadSourceEvidenceLedgerInput(raw: string): readonly unknown[] {
  const parsed = parseInput(raw);
  if (Array.isArray(parsed)) return parsed;
  if (parsed === null || typeof parsed !== "object") fail("input must be an array or an object with rows");
  const envelope = parsed as Record<string, unknown>;
  const keys = Object.keys(envelope);
  if (keys.some((key) => key !== "rows" && key !== "records")) fail("input envelope contains an unknown field");
  const rows = envelope.rows ?? envelope.records;
  if (!Array.isArray(rows)) fail("input.rows must be an array");
  return rows;
}

export const parseSourceEvidenceLedgerInput = loadSourceEvidenceLedgerInput;

export function buildSourceEvidenceLedgerFromJson(raw: string): SourceEvidenceLedger {
  return buildSourceEvidenceLedger(loadSourceEvidenceLedgerInput(raw));
}

export const buildSourceEvidenceLedgerCliFromJson = buildSourceEvidenceLedgerFromJson;

export function renderSourceEvidenceLedgerJson(ledger: SourceEvidenceLedger): string {
  return `${JSON.stringify({ ...ledger, cliVersion: SOURCE_EVIDENCE_LEDGER_CLI_VERSION }, null, 2)}\n`;
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (value === "unknown") return "unknown";
  return String(value).replace(/[|\r\n]/g, (character) => character === "|" ? "\\|" : " ").replace(/\s+/g, " ").trim();
}

function list(value: readonly string[] | "unknown" | null): string {
  return value === null ? "null" : value === "unknown" ? "unknown" : cell(value.length === 0 ? null : value.join(", "));
}

function metric(row: SourceEvidenceLedger["rows"][number]): string {
  if (row.metricSnapshot === null || row.metricSnapshot === "unknown") return cell(row.metricSnapshot);
  return cell(`${row.metricSnapshot.metric ?? "null"}=${row.metricSnapshot.value ?? "null"} ${row.metricSnapshot.unit ?? "null"} / ${row.metricSnapshot.denominator ?? "null"}`);
}

export function renderSourceEvidenceLedgerMarkdown(ledger: SourceEvidenceLedger): string {
  const lines = [
    "# Source evidence ledger",
    "",
    `Readiness: ${ledger.readiness.status}`,
    `Rows: ${ledger.summary.total} total, ${ledger.summary.ready} ready, ${ledger.summary.blocked} blocked, ${ledger.summary.reviewed} reviewed, ${ledger.summary.unreviewed} unreviewed`,
    `Blockers: ${list(ledger.readiness.blockers)}`,
    "",
    "| Evidence ID | Post ID | Account ID | Platform | Pool | Niche | Topics | Focus | Format | Metric / denominator | Observed | Collected | Review | Readiness | Blockers | Caveats |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const row of ledger.rows) {
    lines.push(`| ${cell(row.evidenceId)} | ${cell(row.postId)} | ${cell(row.accountId)} | ${cell(row.platform)} | ${cell(row.pool)} | ${cell(row.nicheLabel)} | ${list(row.topics)} | ${list(row.focus)} | ${cell(row.format)} | ${metric(row)} | ${cell(row.observedAt)} | ${cell(row.collectedAt)} | ${cell(row.reviewStatus)} | ${row.readiness.status} | ${list(row.readiness.blockers)} | ${list(row.caveats)} |`);
  }
  lines.push("", "This is an append-only, body-free evidence view. It stores refs and flags, not creator bodies, model output, rankings, or winner claims.", "");
  return lines.join("\n");
}

export function renderSourceEvidenceLedger(ledger: SourceEvidenceLedger, format: SourceEvidenceLedgerCliFormat): string {
  if (format === "json") return renderSourceEvidenceLedgerJson(ledger);
  if (format === "markdown") return renderSourceEvidenceLedgerMarkdown(ledger);
  return `${renderSourceEvidenceLedgerJson(ledger)}\n${renderSourceEvidenceLedgerMarkdown(ledger)}`;
}

const defaultIo: SourceEvidenceLedgerCliIo = {
  readFile: (path) => readFileSync(path, "utf8"),
  appendFile: (path, value) => {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, value, "utf8");
  },
  write: (value) => process.stdout.write(value),
  error: (value) => process.stderr.write(value),
};

function persistenceFor(path: string, io: SourceEvidenceLedgerCliIo): SourceEvidenceLedgerPersistence {
  return {
    read: () => {
      try { return io.readFile(path); }
      catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return "";
        throw error;
      }
    },
    append: (value) => io.appendFile(path, value),
  };
}

export function main(argv: readonly string[] = process.argv.slice(2), io: Partial<SourceEvidenceLedgerCliIo> = {}): number {
  const effectiveIo: SourceEvidenceLedgerCliIo = { ...defaultIo, ...io };
  try {
    const options = parseSourceEvidenceLedgerArgs(argv);
    const raw = options.source.kind === "json" ? options.source.value : effectiveIo.readFile(options.source.path);
    const rows = loadSourceEvidenceLedgerInput(raw);
    let ledger = buildSourceEvidenceLedger(rows);
    if (options.appendPath !== null) {
      const persistence = persistenceFor(options.appendPath, effectiveIo);
      appendSourceEvidenceLedgerRecords(rows, persistence);
      ledger = buildSourceEvidenceLedger(readSourceEvidenceLedger(persistence));
    }
    effectiveIo.write(renderSourceEvidenceLedger(ledger, options.format));
    return 0;
  } catch (error) {
    effectiveIo.error?.(`patterns:source-evidence-ledger: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
