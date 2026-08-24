import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
  buildOpenerReport,
  renderOpenerReportJson,
  renderOpenerReportMarkdown,
  type OpenerReport,
} from "./opener-report.js";
import { PLATFORMS, type Opener, type OpenerWarning, type Platform, type PostKind } from "./types.js";

export const OPENER_REPORT_CLI_VERSION = "patterns-opener-report-cli-v1" as const;

export interface OpenerReportCliIo {
  readonly readFile: (path: string) => string | Promise<string>;
  readonly write: (value: string) => void | Promise<void>;
  readonly error?: (value: string) => void | Promise<void>;
}

export type OpenerReportCliSource =
  | { readonly kind: "json-string"; readonly value: string }
  | { readonly kind: "file"; readonly path: string };

export type OpenerReportCliFormat = "json" | "markdown" | "both";

export interface OpenerReportCliOptions {
  readonly source: OpenerReportCliSource;
  readonly format: OpenerReportCliFormat;
}

export class OpenerReportCliValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenerReportCliValidationError";
  }
}

const OPENER_WARNING_CODES: ReadonlySet<OpenerWarning["code"]> = new Set([
  "substance-outside-body",
  "short-body",
  "media-first-platform",
  "missing-onscreen-title",
  "truncated-body",
]);

const POST_KINDS: ReadonlySet<PostKind> = new Set(["text", "video"]);

function fail(message: string): never {
  throw new OpenerReportCliValidationError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(source: Record<string, unknown>, field: string, rowField: string): string {
  if (typeof source[field] !== "string" || source[field].trim() === "") {
    fail(`${rowField}.${field} must be a non-empty string`);
  }
  return source[field] as string;
}

function validateWarning(value: unknown, rowField: string, index: number): OpenerWarning {
  const warningField = `${rowField}.warnings[${index}]`;
  if (!isRecord(value)) fail(`${warningField} must be an object`);
  const code = requiredString(value, "code", warningField) as OpenerWarning["code"];
  if (!OPENER_WARNING_CODES.has(code)) fail(`${warningField}.code is unsupported`);
  return { code, note: requiredString(value, "note", warningField) };
}

function validateOpenerRow(value: unknown, index: number): Opener {
  const rowField = `openers[${index}]`;
  if (!isRecord(value)) fail(`${rowField} must be an object`);

  const id = requiredString(value, "id", rowField);
  const corpusEntryId = requiredString(value, "corpus_entry_id", rowField);
  const creator = requiredString(value, "creator", rowField);
  const handle = requiredString(value, "handle", rowField);
  const url = requiredString(value, "url", rowField);
  const openerText = requiredString(value, "opener_text", rowField);
  const collectedAt = requiredString(value, "collected_at", rowField);
  const platform = requiredString(value, "platform", rowField) as Platform;
  if (!PLATFORMS.includes(platform)) fail(`${rowField}.platform is unsupported`);
  const kind = requiredString(value, "kind", rowField) as PostKind;
  if (!POST_KINDS.has(kind)) fail(`${rowField}.kind is unsupported`);

  if (typeof value.onscreen_title !== "string" && value.onscreen_title !== null) {
    fail(`${rowField}.onscreen_title must be a string or null`);
  }
  if (typeof value.verbatim_ok !== "boolean") fail(`${rowField}.verbatim_ok must be a boolean`);
  if (!Array.isArray(value.warnings)) fail(`${rowField}.warnings must be an array`);

  if (!isRecord(value.performance)) fail(`${rowField}.performance must be an object`);
  const performance = value.performance;
  if (performance.multiple !== null && (typeof performance.multiple !== "number" || !Number.isFinite(performance.multiple))) {
    fail(`${rowField}.performance.multiple must be a finite number or null`);
  }
  if (performance.metric !== null && performance.metric !== "views" && performance.metric !== "engagement") {
    fail(`${rowField}.performance.metric must be views, engagement, or null`);
  }
  const normalizedPerformance: Opener["performance"] = {
    multiple: performance.multiple as number | null,
    metric: performance.metric as Opener["performance"]["metric"],
    note: requiredString(performance, "note", `${rowField}.performance`),
  };

  const warnings = value.warnings.map((warning, warningIndex) => validateWarning(warning, rowField, warningIndex));

  // Project only the Opener contract. In particular, an accidental `body` or transcript field
  // supplied by a caller cannot enter the report renderers.
  return {
    id,
    corpus_entry_id: corpusEntryId,
    platform,
    creator,
    handle,
    url,
    opener_text: openerText,
    onscreen_title: value.onscreen_title as string | null,
    kind,
    performance: normalizedPerformance,
    verbatim_ok: value.verbatim_ok,
    warnings,
    collected_at: collectedAt,
  };
}

function parseOpenerRows(value: unknown): readonly unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value)) {
    if (!Object.hasOwn(value, "openers")) fail("openers must be an array");
    if (!Array.isArray(value.openers)) fail("openers must be an array");
    return value.openers;
  }
  fail("input must be a JSON array of opener rows or an object with an openers array");
}

/** Parse and strictly normalize the explicit JSON input accepted by this adapter. */
export function loadOpenerReportInput(raw: string): readonly Opener[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    fail("input must be valid JSON");
  }

  const rows = parseOpenerRows(parsed).map((value, index) => validateOpenerRow(value, index));
  const ids = new Set<string>();
  for (const row of rows) {
    if (ids.has(row.id)) fail(`openers.id must be unique: ${row.id}`);
    ids.add(row.id);
  }
  return rows;
}

export const loadOpenerReportEnvelope = loadOpenerReportInput;

export function buildOpenerReportFromJson(raw: string): OpenerReport {
  return buildOpenerReport(loadOpenerReportInput(raw));
}

export async function readOpenerReportRequest(
  source: OpenerReportCliSource,
  io: Pick<OpenerReportCliIo, "readFile">,
): Promise<string> {
  if (source.kind === "json-string") return source.value;
  try {
    const value = await io.readFile(source.path);
    if (typeof value !== "string") throw new Error("not text");
    return value;
  } catch {
    throw new OpenerReportCliValidationError("input could not be read");
  }
}

export async function buildOpenerReportFromSource(
  source: OpenerReportCliSource,
  io: Pick<OpenerReportCliIo, "readFile">,
): Promise<OpenerReport> {
  return buildOpenerReportFromJson(await readOpenerReportRequest(source, io));
}

export function renderOpenerReport(report: OpenerReport, format: OpenerReportCliFormat): string {
  if (format === "json") return renderOpenerReportJson(report);
  if (format === "markdown") return renderOpenerReportMarkdown(report);
  return `${renderOpenerReportJson(report)}\n${renderOpenerReportMarkdown(report)}`;
}

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value`);
  return value;
}

export function parseOpenerReportArgs(argv: readonly string[]): OpenerReportCliOptions {
  let inputPath: string | undefined;
  let jsonText: string | undefined;
  let format: OpenerReportCliFormat = "json";

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

const defaultIo: OpenerReportCliIo = {
  readFile: (path) => readFile(path, "utf8"),
  write: (value) => {
    process.stdout.write(value);
  },
  error: (value) => {
    process.stderr.write(value);
  },
};

/** Read, validate, render, and write one report. No domain state is written. */
export async function main(
  argv: readonly string[] = process.argv.slice(2),
  io: Partial<OpenerReportCliIo> = {},
): Promise<number> {
  try {
    const options = parseOpenerReportArgs(argv);
    const effectiveIo: OpenerReportCliIo = {
      readFile: io.readFile ?? defaultIo.readFile,
      write: io.write ?? defaultIo.write,
      error: io.error ?? defaultIo.error,
    };
    const report = await buildOpenerReportFromSource(options.source, effectiveIo);
    await effectiveIo.write(renderOpenerReport(report, options.format));
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : "opener report input is invalid";
    await (io.error ?? defaultIo.error)?.(`patterns:opener-report: ${message}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
