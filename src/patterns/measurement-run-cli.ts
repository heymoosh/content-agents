import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  buildMeasurementRun,
  MeasurementRunValidationError,
  normalizeMeasurementRunInput,
  renderMeasurementRunJson,
  renderMeasurementRunMarkdown,
  type MeasurementRunInput,
  type MeasurementRunManifest,
} from "./measurement-run.js";

export const MEASUREMENT_RUN_CLI_VERSION = "measurement-run-cli-v1" as const;
export type MeasurementRunCliFormat = "json" | "markdown" | "both";

export type MeasurementRunCliSource =
  | { readonly kind: "json"; readonly value: string }
  | { readonly kind: "file"; readonly path: string };

export interface MeasurementRunCliOptions {
  readonly source: MeasurementRunCliSource;
  readonly format: MeasurementRunCliFormat;
}

export interface MeasurementRunCliIo {
  readonly readFile: (path: string) => string;
  readonly write: (value: string) => void;
  readonly error?: (value: string) => void;
}

function fail(message: string): never {
  throw new MeasurementRunValidationError(message);
}

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) fail(`${option} requires a value`);
  return value;
}

export function parseMeasurementRunArgs(argv: readonly string[]): MeasurementRunCliOptions {
  let source: MeasurementRunCliSource | undefined;
  let format: MeasurementRunCliFormat = "json";
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
    } else {
      fail(`unknown argument: ${argument}`);
    }
  }

  if (!source) fail("exactly one of --json or --file is required");
  return { source, format };
}

export const parseArgs = parseMeasurementRunArgs;

export function loadMeasurementRunInput(raw: string): MeasurementRunInput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    fail("input must be valid JSON");
  }
  return normalizeMeasurementRunInput(parsed);
}

export const parseMeasurementRunInput = loadMeasurementRunInput;

export function buildMeasurementRunFromJson(raw: string): MeasurementRunManifest {
  return buildMeasurementRun(loadMeasurementRunInput(raw));
}

export function renderMeasurementRun(manifest: MeasurementRunManifest, format: MeasurementRunCliFormat): string {
  if (format === "json") return renderMeasurementRunJson(manifest);
  if (format === "markdown") return renderMeasurementRunMarkdown(manifest);
  return `${renderMeasurementRunJson(manifest)}\n${renderMeasurementRunMarkdown(manifest)}`;
}

const defaultIo: MeasurementRunCliIo = {
  readFile: (path) => readFileSync(path, "utf8"),
  write: (value) => process.stdout.write(value),
  error: (value) => process.stderr.write(value),
};

export function main(argv: readonly string[] = process.argv.slice(2), io: Partial<MeasurementRunCliIo> = {}): number {
  const effectiveIo = { ...defaultIo, ...io };
  try {
    const options = parseMeasurementRunArgs(argv);
    const raw = options.source.kind === "json" ? options.source.value : effectiveIo.readFile(options.source.path);
    effectiveIo.write(renderMeasurementRun(buildMeasurementRunFromJson(raw), options.format));
    return 0;
  } catch (error) {
    effectiveIo.error?.(`patterns:measurement-run: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
