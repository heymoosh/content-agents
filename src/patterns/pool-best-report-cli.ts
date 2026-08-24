import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  buildPoolBestReport,
  renderPoolBestReportJson,
  renderPoolBestReportMarkdown,
  type PoolBestReport,
  type PoolBestReportInput,
} from "./pool-best-report.js";

export const POOL_BEST_REPORT_CLI_VERSION = "pool-best-report-cli-v1" as const;
export type PoolBestReportCliFormat = "json" | "markdown" | "both";
export type PoolBestReportCliSource = { readonly kind: "json"; readonly value: string } | { readonly kind: "file"; readonly path: string };
export interface PoolBestReportCliOptions { readonly source: PoolBestReportCliSource; readonly format: PoolBestReportCliFormat }

export class PoolBestReportCliValidationError extends Error {
  constructor(message: string) { super(message); this.name = "PoolBestReportCliValidationError"; }
}

function fail(message: string): never { throw new PoolBestReportCliValidationError(message); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) fail(`${option} requires a value`);
  return value;
}

/** Parse an explicit evidence/review/baseline envelope; the report itself remains body-free. */
export function parsePoolBestReportInput(raw: string): PoolBestReportInput {
  let value: unknown;
  try { value = JSON.parse(raw) as unknown; } catch { fail("input must be valid JSON"); }
  if (!isRecord(value)) fail("input must be an object");
  if (!Array.isArray(value.evidence)) fail("evidence must be an array");
  if (!Array.isArray(value.reviews)) fail("reviews must be an array");
  if (!Array.isArray(value.baselines)) fail("baselines must be an array");
  if (!Number.isInteger(value.minimumComparableCandidates) || (value.minimumComparableCandidates as number) < 2) {
    fail("minimumComparableCandidates must be an integer of at least 2");
  }
  return {
    evidence: value.evidence as PoolBestReportInput["evidence"],
    reviews: value.reviews as PoolBestReportInput["reviews"],
    baselines: value.baselines as PoolBestReportInput["baselines"],
    minimumComparableCandidates: value.minimumComparableCandidates as number,
  };
}

export function renderPoolBestReport(report: PoolBestReport, format: PoolBestReportCliFormat): string {
  if (format === "json") return renderPoolBestReportJson(report);
  if (format === "markdown") return renderPoolBestReportMarkdown(report);
  return `${renderPoolBestReportJson(report)}\n${renderPoolBestReportMarkdown(report)}`;
}

export function parsePoolBestReportArgs(argv: readonly string[]): PoolBestReportCliOptions {
  let source: PoolBestReportCliSource | undefined;
  let format: PoolBestReportCliFormat = "json";
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
    const options = parsePoolBestReportArgs(argv);
    const raw = options.source.kind === "json" ? options.source.value : readFileSync(options.source.path, "utf8");
    (io.write ?? ((value: string) => process.stdout.write(value)))(renderPoolBestReport(buildPoolBestReport(parsePoolBestReportInput(raw)), options.format));
    return 0;
  } catch (error) {
    (io.error ?? ((value: string) => process.stderr.write(value)))(`patterns:best-report: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
