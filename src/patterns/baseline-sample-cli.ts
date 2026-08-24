import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { buildBaseline, type BaselineSamplePost } from "./baselines.js";
import { PLATFORMS, type Platform } from "./types.js";
import type { MetricCounts } from "./outliers.js";

export const BASELINE_SAMPLE_CLI_VERSION = "baseline-sample-cli-v1" as const;

export type BaselineSampleCliFormat = "json" | "markdown" | "both";

export interface BaselineSampleCliOptions {
  readonly source: { readonly kind: "json"; readonly value: string } | { readonly kind: "file"; readonly path: string };
  readonly format: BaselineSampleCliFormat;
}

export interface BaselineSampleEnvelope {
  readonly account: { readonly platform: Platform; readonly handle: string };
  readonly sample: readonly BaselineSamplePost[];
  readonly meta: { readonly followers: number | null; readonly method: string; readonly collected_at: string };
}

export class BaselineSampleCliValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BaselineSampleCliValidationError";
  }
}

function fail(message: string): never {
  throw new BaselineSampleCliValidationError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") fail(`${field} must be a non-empty string`);
  return value.trim();
}

function finiteCount(value: unknown, field: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) fail(`${field} must be a non-negative number or null`);
  return value;
}

function parseMetrics(value: unknown, index: number): MetricCounts {
  if (!isRecord(value)) fail(`sample[${index}].metrics must be an object`);
  return {
    views: finiteCount(value.views, `sample[${index}].metrics.views`),
    likes: finiteCount(value.likes, `sample[${index}].metrics.likes`),
    comments: finiteCount(value.comments, `sample[${index}].metrics.comments`),
    shares: finiteCount(value.shares, `sample[${index}].metrics.shares`),
  };
}

function parseSample(value: unknown): BaselineSamplePost[] {
  if (!Array.isArray(value) || value.length === 0) fail("sample must be a non-empty array");
  return value.map((item, index) => {
    if (!isRecord(item)) fail(`sample[${index}] must be an object`);
    const postedAt = item.posted_at;
    if (postedAt !== null && typeof postedAt !== "string") fail(`sample[${index}].posted_at must be a string or null`);
    return { metrics: parseMetrics(item.metrics, index), posted_at: postedAt as string | null };
  });
}

export function parseBaselineSampleInput(raw: string): BaselineSampleEnvelope {
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    fail("input must be valid JSON");
  }
  if (!isRecord(value)) fail("input must be an object with account, sample, and meta");
  if (!isRecord(value.account)) fail("account must be an object");
  if (!PLATFORMS.includes(value.account.platform as Platform)) fail("account.platform must be a supported pattern platform");
  const platform = value.account.platform as Platform;
  const handle = requiredString(value.account.handle, "account.handle");
  if (!isRecord(value.meta)) fail("meta must be an object");
  const followers = finiteCount(value.meta.followers, "meta.followers");
  const method = requiredString(value.meta.method, "meta.method");
  const collected_at = requiredString(value.meta.collected_at, "meta.collected_at");
  const sample = parseSample(value.sample);
  const baseline = buildBaseline({ platform, handle }, sample, { followers, method, collected_at });
  if (baseline === null) fail("sample has no common measurable terms; no baseline was built");
  return { account: { platform, handle }, sample, meta: { followers, method, collected_at } };
}

export function buildBaselineFromJson(raw: string) {
  const input = parseBaselineSampleInput(raw);
  const baseline = buildBaseline(input.account, [...input.sample], input.meta);
  if (baseline === null) fail("sample has no common measurable terms; no baseline was built");
  return baseline;
}

export function renderBaselineSampleJson(baseline: ReturnType<typeof buildBaseline> extends infer T ? Exclude<T, null> : never): string {
  return `${JSON.stringify({ kind: "baseline_sample", version: BASELINE_SAMPLE_CLI_VERSION, baseline, sideEffects: "none" }, null, 2)}\n`;
}

function markdownText(value: string | number | null): string {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function renderBaselineSampleMarkdown(baseline: Exclude<ReturnType<typeof buildBaseline>, null>): string {
  const lines = [
    "# Measured baseline sample",
    "",
    `- Account: ${markdownText(baseline.platform)} / ${markdownText(baseline.handle)}`,
    `- Metric: ${markdownText(baseline.metric)}`,
    `- Terms: ${markdownText(baseline.terms.join(", "))}`,
    `- Median: ${markdownText(baseline.median)}`,
    `- Sample size: ${markdownText(baseline.sample_size)}`,
    `- Window: ${markdownText(baseline.window_start)} to ${markdownText(baseline.window_end)}`,
    `- Method: ${markdownText(baseline.method)}`,
    `- Collected at: ${markdownText(baseline.collected_at)}`,
    "",
    "This is a measured baseline projection. It contains no post text and writes no baseline file.",
    "",
  ];
  return lines.join("\n");
}

export function renderBaselineSample(baseline: Exclude<ReturnType<typeof buildBaseline>, null>, format: BaselineSampleCliFormat): string {
  if (format === "json") return renderBaselineSampleJson(baseline);
  if (format === "markdown") return renderBaselineSampleMarkdown(baseline);
  return `${renderBaselineSampleJson(baseline)}\n${renderBaselineSampleMarkdown(baseline)}`;
}

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) fail(`${option} requires a value`);
  return value;
}

export function parseBaselineSampleArgs(argv: readonly string[]): BaselineSampleCliOptions {
  let source: BaselineSampleCliOptions["source"] | undefined;
  let format: BaselineSampleCliFormat = "json";
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") {
      if (source) fail("exactly one of --json or --input is allowed");
      source = { kind: "json", value: optionValue(argv, index, argument) };
      index += 1;
    } else if (argument === "--input" || argument === "--file") {
      if (source) fail("exactly one of --json or --input is allowed");
      source = { kind: "file", path: optionValue(argv, index, argument) };
      index += 1;
    } else if (argument === "--format") {
      const value = optionValue(argv, index, argument);
      if (value !== "json" && value !== "markdown" && value !== "both") fail("--format must be json, markdown, or both");
      format = value;
      index += 1;
    } else {
      fail(`unknown argument: ${argument}`);
    }
  }
  if (!source) fail("one of --json or --input is required");
  return { source, format };
}

export function main(argv: readonly string[] = process.argv.slice(2), io: { write?: (value: string) => void; error?: (value: string) => void } = {}): number {
  try {
    const options = parseBaselineSampleArgs(argv);
    const raw = options.source.kind === "json" ? options.source.value : readFileSync(options.source.path, "utf8");
    const output = renderBaselineSample(buildBaselineFromJson(raw), options.format);
    (io.write ?? ((value: string) => process.stdout.write(value)))(output);
    return 0;
  } catch (error) {
    (io.error ?? ((value: string) => process.stderr.write(value)))(`patterns:baseline-sample: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
