import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
  buildManualPlatformIntake,
  type ManualPlatformIntake,
  type ManualPlatformIntakeInput,
} from "./manual-platform-intake.js";
import {
  buildManualPlatformReport,
  renderManualPlatformReportJson,
  renderManualPlatformReportMarkdown,
  type ManualPlatformReport,
} from "./manual-platform-report.js";

export const MANUAL_PLATFORM_REPORT_CLI_VERSION = "manual-platform-report-cli-v1" as const;

export interface ManualPlatformReportCliIo {
  readonly readFile: (path: string) => string | Promise<string>;
  readonly write: (value: string) => void | Promise<void>;
  readonly error?: (value: string) => void | Promise<void>;
}

export type ManualPlatformReportCliSource =
  | { readonly kind: "json-string"; readonly value: string }
  | { readonly kind: "file"; readonly path: string };

export type ManualPlatformReportCliFormat = "json" | "markdown" | "both";

export interface ManualPlatformReportCliOptions {
  readonly source: ManualPlatformReportCliSource;
  readonly format: ManualPlatformReportCliFormat;
}

export class ManualPlatformReportCliValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManualPlatformReportCliValidationError";
  }
}

function fail(message: string): never {
  throw new ManualPlatformReportCliValidationError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseObservationRows(value: unknown): readonly unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value)) {
    if (!Object.hasOwn(value, "observations") || !Array.isArray(value.observations)) {
      fail("observations must be an array");
    }
    return value.observations;
  }
  fail("input must be a JSON array of observations or an object with an observations array");
}

function normalizeObservation(value: unknown, index: number): ManualPlatformIntake {
  if (!isRecord(value)) fail(`observations[${index}] must be an object`);
  try {
    return buildManualPlatformIntake(value as ManualPlatformIntakeInput);
  } catch (error) {
    fail(`observations[${index}] is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Parse and normalize the explicit, body-free manual observation input. */
export function loadManualPlatformReportInput(raw: string): readonly ManualPlatformIntake[] {
  if (typeof raw !== "string") fail("input must be text");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    fail("input must be valid JSON");
  }

  return parseObservationRows(parsed).map((value, index) => normalizeObservation(value, index));
}

export const loadManualPlatformReportEnvelope = loadManualPlatformReportInput;
export const parseManualPlatformReportInput = loadManualPlatformReportInput;

export function buildManualPlatformReportFromJson(raw: string): ManualPlatformReport {
  return buildManualPlatformReport(loadManualPlatformReportInput(raw));
}

export async function readManualPlatformReportRequest(
  source: ManualPlatformReportCliSource,
  io: Pick<ManualPlatformReportCliIo, "readFile">,
): Promise<string> {
  if (source.kind === "json-string") return source.value;
  try {
    const value = await io.readFile(source.path);
    if (typeof value !== "string") fail("input file must contain text");
    return value;
  } catch (error) {
    if (error instanceof ManualPlatformReportCliValidationError) throw error;
    throw new ManualPlatformReportCliValidationError("input could not be read");
  }
}

export async function buildManualPlatformReportFromSource(
  source: ManualPlatformReportCliSource,
  io: Pick<ManualPlatformReportCliIo, "readFile">,
): Promise<ManualPlatformReport> {
  return buildManualPlatformReportFromJson(await readManualPlatformReportRequest(source, io));
}

export { renderManualPlatformReportJson, renderManualPlatformReportMarkdown };

export function renderManualPlatformReport(
  report: ManualPlatformReport,
  format: ManualPlatformReportCliFormat,
): string {
  if (format === "json") return renderManualPlatformReportJson(report);
  if (format === "markdown") return renderManualPlatformReportMarkdown(report);
  if (format === "both") return `${renderManualPlatformReportJson(report)}\n${renderManualPlatformReportMarkdown(report)}`;
  fail("--format must be json, markdown, or both");
}

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (value === undefined || value === "" || value.startsWith("--")) fail(`${option} requires a value`);
  return value;
}

function optionEquals(argument: string, option: string): string | undefined {
  if (!argument.startsWith(`${option}=`)) return undefined;
  const value = argument.slice(option.length + 1);
  if (value === "") fail(`${option} requires a value`);
  return value;
}

function setSource(
  current: ManualPlatformReportCliSource | undefined,
  next: ManualPlatformReportCliSource,
): ManualPlatformReportCliSource {
  if (current !== undefined) fail("exactly one of --json or --input/--file is allowed");
  return next;
}

export function parseManualPlatformReportArgs(argv: readonly string[]): ManualPlatformReportCliOptions {
  let source: ManualPlatformReportCliSource | undefined;
  let format: ManualPlatformReportCliFormat = "json";
  let formatSupplied = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") {
      source = setSource(source, { kind: "json-string", value: optionValue(argv, index, argument) });
      index += 1;
    } else if (argument.startsWith("--json=")) {
      source = setSource(source, { kind: "json-string", value: optionEquals(argument, "--json") as string });
    } else if (argument === "--input" || argument === "--file") {
      source = setSource(source, { kind: "file", path: optionValue(argv, index, argument) });
      index += 1;
    } else if (argument.startsWith("--input=") || argument.startsWith("--file=")) {
      const option = argument.startsWith("--input=") ? "--input" : "--file";
      source = setSource(source, { kind: "file", path: optionEquals(argument, option) as string });
    } else if (argument === "--format") {
      if (formatSupplied) fail("--format may be supplied only once");
      const value = optionValue(argv, index, argument);
      if (value !== "json" && value !== "markdown" && value !== "both") {
        fail("--format must be json, markdown, or both");
      }
      format = value;
      formatSupplied = true;
      index += 1;
    } else if (argument.startsWith("--format=")) {
      if (formatSupplied) fail("--format may be supplied only once");
      const value = optionEquals(argument, "--format");
      if (value !== "json" && value !== "markdown" && value !== "both") {
        fail("--format must be json, markdown, or both");
      }
      format = value;
      formatSupplied = true;
    } else {
      fail(`unknown argument: ${argument}`);
    }
  }

  if (source === undefined) fail("exactly one of --json or --input/--file is required");
  return { source, format };
}

const defaultIo: ManualPlatformReportCliIo = {
  readFile: (path) => readFile(path, "utf8"),
  write: (value) => { process.stdout.write(value); },
  error: (value) => { process.stderr.write(value); },
};

/** Read, validate, render, and write one report. No domain state is written. */
export async function main(
  argv: readonly string[] = process.argv.slice(2),
  io: Partial<ManualPlatformReportCliIo> = {},
): Promise<number> {
  const effectiveIo: ManualPlatformReportCliIo = {
    readFile: io.readFile ?? defaultIo.readFile,
    write: io.write ?? defaultIo.write,
    error: io.error ?? defaultIo.error,
  };
  try {
    const options = parseManualPlatformReportArgs(argv);
    const report = await buildManualPlatformReportFromSource(options.source, effectiveIo);
    await effectiveIo.write(renderManualPlatformReport(report, options.format));
    return 0;
  } catch (error) {
    await effectiveIo.error?.(`patterns:manual-platform-report: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((exitCode) => { process.exitCode = exitCode; });
}
