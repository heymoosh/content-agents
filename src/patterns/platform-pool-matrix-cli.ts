import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  buildPlatformPoolMatrix,
  renderPlatformPoolMatrixJson,
  renderPlatformPoolMatrixMarkdown,
  type PlatformPoolMatrix,
  type PlatformPoolMatrixTarget,
} from "./platform-pool-matrix.js";
import { POOL_NAMES } from "./pool-evidence.js";

export const PLATFORM_POOL_MATRIX_CLI_VERSION = "platform-pool-matrix-cli-v1" as const;
export type PlatformPoolMatrixCliFormat = "json" | "markdown" | "both";
export type PlatformPoolMatrixCliSource = { readonly kind: "json"; readonly value: string } | { readonly kind: "file"; readonly path: string };
export interface PlatformPoolMatrixCliOptions { readonly source: PlatformPoolMatrixCliSource; readonly format: PlatformPoolMatrixCliFormat }

export class PlatformPoolMatrixCliValidationError extends Error {
  constructor(message: string) { super(message); this.name = "PlatformPoolMatrixCliValidationError"; }
}

function fail(message: string): never { throw new PlatformPoolMatrixCliValidationError(message); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) fail(`${option} requires a value`);
  return value;
}

function validateTarget(value: unknown, index: number): PlatformPoolMatrixTarget {
  if (!isRecord(value)) fail(`targets[${index}] must be an object`);
  if (typeof value.id !== "string" || value.id.trim() === "") fail(`targets[${index}].id must be a non-empty string`);
  if (typeof value.platform !== "string" || value.platform.trim() === "") fail(`targets[${index}].platform must be a non-empty string`);
  if (typeof value.researchPool !== "string" || !POOL_NAMES.includes(value.researchPool as typeof POOL_NAMES[number])) fail(`targets[${index}].researchPool must be niche, broad, or format`);
  for (const field of ["medium", "format"] as const) {
    if (value[field] !== null && typeof value[field] !== "string") fail(`targets[${index}].${field} must be a string or null`);
  }
  for (const field of ["configured", "collected", "baselineReady"] as const) {
    if (typeof value[field] !== "boolean") fail(`targets[${index}].${field} must be boolean`);
  }
  if (value.reviewStatus !== "reviewed" && value.reviewStatus !== "unreviewed" && value.reviewStatus !== "blocked") fail(`targets[${index}].reviewStatus is invalid`);
  if (!Array.isArray(value.blockers) || value.blockers.some((blocker) => typeof blocker !== "string")) fail(`targets[${index}].blockers must be an array of strings`);
  return value as unknown as PlatformPoolMatrixTarget;
}

export function parsePlatformPoolMatrixInput(raw: string): PlatformPoolMatrix {
  let value: unknown;
  try { value = JSON.parse(raw) as unknown; } catch { fail("input must be valid JSON"); }
  const targets = Array.isArray(value) ? value : isRecord(value) && Array.isArray(value.targets) ? value.targets : null;
  if (!targets) fail("input must be an array of targets or an object with a targets array");
  return buildPlatformPoolMatrix(targets.map(validateTarget));
}

export function renderPlatformPoolMatrix(matrix: PlatformPoolMatrix, format: PlatformPoolMatrixCliFormat): string {
  if (format === "json") return renderPlatformPoolMatrixJson(matrix);
  if (format === "markdown") return renderPlatformPoolMatrixMarkdown(matrix);
  return `${renderPlatformPoolMatrixJson(matrix)}\n${renderPlatformPoolMatrixMarkdown(matrix)}`;
}

export function parsePlatformPoolMatrixArgs(argv: readonly string[]): PlatformPoolMatrixCliOptions {
  let source: PlatformPoolMatrixCliSource | undefined;
  let format: PlatformPoolMatrixCliFormat = "json";
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") {
      if (source) fail("exactly one of --json or --input is allowed");
      source = { kind: "json", value: optionValue(argv, index, argument) }; index += 1;
    } else if (argument === "--input" || argument === "--file") {
      if (source) fail("exactly one of --json or --input is allowed");
      source = { kind: "file", path: optionValue(argv, index, argument) }; index += 1;
    } else if (argument === "--format") {
      const value = optionValue(argv, index, argument);
      if (value !== "json" && value !== "markdown" && value !== "both") fail("--format must be json, markdown, or both");
      format = value; index += 1;
    } else fail(`unknown argument: ${argument}`);
  }
  if (!source) fail("one of --json or --input is required");
  return { source, format };
}

export function main(argv: readonly string[] = process.argv.slice(2), io: { write?: (value: string) => void; error?: (value: string) => void } = {}): number {
  try {
    const options = parsePlatformPoolMatrixArgs(argv);
    const raw = options.source.kind === "json" ? options.source.value : readFileSync(options.source.path, "utf8");
    const output = renderPlatformPoolMatrix(parsePlatformPoolMatrixInput(raw), options.format);
    (io.write ?? ((value: string) => process.stdout.write(value)))(output);
    return 0;
  } catch (error) {
    (io.error ?? ((value: string) => process.stderr.write(value)))(`patterns:platform-pool-matrix: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
