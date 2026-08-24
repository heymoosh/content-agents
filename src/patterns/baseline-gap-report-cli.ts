import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  buildBaselineGapReport,
  renderBaselineGapReportJson,
  renderBaselineGapReportMarkdown,
  type BaselineGapReport,
  type BaselineGapTarget,
} from "./baseline-gap-report.js";
import { PLATFORMS, type AccountBaseline, type Platform } from "./types.js";

export const BASELINE_GAP_REPORT_CLI_VERSION = "baseline-gap-report-cli-v1" as const;
export type BaselineGapReportCliFormat = "json" | "markdown" | "both";
export type BaselineGapReportCliSource = { readonly kind: "json"; readonly value: string } | { readonly kind: "file"; readonly path: string };
export interface BaselineGapReportCliOptions { readonly source: BaselineGapReportCliSource; readonly format: BaselineGapReportCliFormat }

export class BaselineGapReportCliValidationError extends Error {
  constructor(message: string) { super(message); this.name = "BaselineGapReportCliValidationError"; }
}

function fail(message: string): never { throw new BaselineGapReportCliValidationError(message); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) fail(`${option} requires a value`);
  return value;
}
function validPlatform(value: unknown): value is Platform { return typeof value === "string" && PLATFORMS.includes(value as Platform); }

function validNullableNumber(value: unknown): boolean {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function validateTarget(target: unknown, index: number): BaselineGapTarget {
  if (!isRecord(target) || !validPlatform(target.platform) || typeof target.handle !== "string") fail(`targets[${index}] must contain a supported platform and handle`);
  if (target.focus !== undefined && target.focus !== null && (!Array.isArray(target.focus) || target.focus.some((value) => typeof value !== "string"))) fail(`targets[${index}].focus must be an array of strings or null`);
  if (target.caveats !== undefined && target.caveats !== null && (!Array.isArray(target.caveats) || target.caveats.some((value) => typeof value !== "string"))) fail(`targets[${index}].caveats must be an array of strings or null`);
  if (target.sampleSize !== undefined && target.sampleSize !== null && (typeof target.sampleSize !== "number" || !Number.isInteger(target.sampleSize) || target.sampleSize <= 0)) fail(`targets[${index}].sampleSize must be a positive integer or null`);
  if (target.minAgeDays !== undefined && target.minAgeDays !== null && (typeof target.minAgeDays !== "number" || !Number.isInteger(target.minAgeDays) || target.minAgeDays < 0)) fail(`targets[${index}].minAgeDays must be a non-negative integer or null`);
  return target as unknown as BaselineGapTarget;
}

function validateBaseline(baseline: unknown, index: number): AccountBaseline {
  if (!isRecord(baseline) || !validPlatform(baseline.platform) || typeof baseline.handle !== "string") fail(`baselines[${index}] must contain a supported platform and handle`);
  if (baseline.metric !== "views" && baseline.metric !== "engagement") fail(`baselines[${index}].metric is invalid`);
  if (!Array.isArray(baseline.terms) || baseline.terms.length === 0 || baseline.terms.some((term) => !["views", "likes", "comments", "shares"].includes(String(term)))) fail(`baselines[${index}].terms is invalid`);
  if (typeof baseline.median !== "number" || !Number.isFinite(baseline.median) || baseline.median <= 0) fail(`baselines[${index}].median must be positive`);
  if (typeof baseline.sample_size !== "number" || !Number.isInteger(baseline.sample_size) || baseline.sample_size <= 0) fail(`baselines[${index}].sample_size must be positive`);
  if (!Array.isArray(baseline.scores) || baseline.scores.some((score) => typeof score !== "number" || !Number.isFinite(score))) fail(`baselines[${index}].scores must be finite numbers`);
  if (baseline.window_start !== null && typeof baseline.window_start !== "string") fail(`baselines[${index}].window_start must be a string or null`);
  if (baseline.window_end !== null && typeof baseline.window_end !== "string") fail(`baselines[${index}].window_end must be a string or null`);
  if (!validNullableNumber(baseline.followers) || typeof baseline.method !== "string" || baseline.method.trim() === "" || typeof baseline.collected_at !== "string" || baseline.collected_at.trim() === "") fail(`baselines[${index}] has invalid metadata`);
  return baseline as unknown as AccountBaseline;
}

function parseEnvelope(value: unknown): { targets: BaselineGapTarget[]; baselines: AccountBaseline[] } {
  if (!isRecord(value) || !Array.isArray(value.targets) || !Array.isArray(value.baselines)) fail("input must contain targets and baselines arrays");
  const targets = value.targets.map(validateTarget);
  const baselines = value.baselines.map(validateBaseline);
  return { targets, baselines };
}

export function parseBaselineGapReportInput(raw: string): BaselineGapReport {
  let value: unknown;
  try { value = JSON.parse(raw) as unknown; } catch { fail("input must be valid JSON"); }
  const input = parseEnvelope(value);
  return buildBaselineGapReport(input.targets, input.baselines);
}

export function renderBaselineGapReport(report: BaselineGapReport, format: BaselineGapReportCliFormat): string {
  if (format === "json") return renderBaselineGapReportJson(report);
  if (format === "markdown") return renderBaselineGapReportMarkdown(report);
  return `${renderBaselineGapReportJson(report)}\n${renderBaselineGapReportMarkdown(report)}`;
}

export function parseBaselineGapReportArgs(argv: readonly string[]): BaselineGapReportCliOptions {
  let source: BaselineGapReportCliSource | undefined;
  let format: BaselineGapReportCliFormat = "json";
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
    const options = parseBaselineGapReportArgs(argv);
    const raw = options.source.kind === "json" ? options.source.value : readFileSync(options.source.path, "utf8");
    const output = renderBaselineGapReport(parseBaselineGapReportInput(raw), options.format);
    (io.write ?? ((value: string) => process.stdout.write(value)))(output);
    return 0;
  } catch (error) {
    (io.error ?? ((value: string) => process.stderr.write(value)))(`patterns:baseline-gaps: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
