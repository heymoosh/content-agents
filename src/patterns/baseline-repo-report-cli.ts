import { pathToFileURL } from "node:url";

import { BASELINES_PATH, readBaselines } from "./baselines.js";
import { loadConfig } from "./collect.js";
import {
  buildBaselineRepoReport,
  type BaselineRepoReport,
  type BaselineRepoTargetSource,
} from "./baseline-repo-report.js";
import type { AccountBaseline, PatternMiningConfig } from "./types.js";

export const BASELINE_REPO_REPORT_CLI_VERSION = "baseline-repo-report-cli-v1" as const;
export type BaselineRepoReportCliFormat = "json" | "markdown";

export interface BaselineRepoReportCliOptions {
  readonly configPath?: string;
  readonly baselinesPath?: string;
  readonly format: BaselineRepoReportCliFormat;
}

export interface BaselineRepoReportCliLoaders {
  readonly loadConfig: (path?: string) => PatternMiningConfig;
  readonly readBaselines: (path?: string) => AccountBaseline[];
}

export class BaselineRepoReportCliValidationError extends Error {
  constructor(message: string) { super(message); this.name = "BaselineRepoReportCliValidationError"; }
}

function fail(message: string): never { throw new BaselineRepoReportCliValidationError(message); }
function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) fail(`${option} requires a value`);
  return value;
}

export function parseBaselineRepoReportArgs(argv: readonly string[]): BaselineRepoReportCliOptions {
  let configPath: string | undefined;
  let baselinesPath: string | undefined;
  let format: BaselineRepoReportCliFormat = "json";
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--config") {
      if (configPath !== undefined) fail("--config may be supplied only once");
      configPath = optionValue(argv, index, argument); index += 1;
    } else if (argument === "--baselines") {
      if (baselinesPath !== undefined) fail("--baselines may be supplied only once");
      baselinesPath = optionValue(argv, index, argument); index += 1;
    } else if (argument === "--format") {
      const value = optionValue(argv, index, argument);
      if (value !== "json" && value !== "markdown") fail("--format must be json or markdown");
      format = value; index += 1;
    } else fail(`unknown argument: ${argument}`);
  }
  return { configPath, baselinesPath, format };
}

export function buildBaselineRepoReportFromPaths(
  options: BaselineRepoReportCliOptions,
  loaders: BaselineRepoReportCliLoaders = { loadConfig, readBaselines },
): BaselineRepoReport {
  const config = loaders.loadConfig(options.configPath);
  const baselines = loaders.readBaselines(options.baselinesPath ?? BASELINES_PATH);
  return buildBaselineRepoReport(config as BaselineRepoTargetSource, baselines);
}

export function renderBaselineRepoReportJson(report: BaselineRepoReport): string {
  return `${JSON.stringify({ ...report, cliVersion: BASELINE_REPO_REPORT_CLI_VERSION }, null, 2)}\n`;
}

function markdownText(value: string | number | null): string {
  return String(value ?? "null").replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function renderBaselineRepoReportMarkdown(report: BaselineRepoReport): string {
  const lines = [
    "# Repository baseline measurement plan",
    "",
    `Targets: ${report.summary.total} | Need measurement: ${report.summary.needsMeasurement} | Already measured: ${report.summary.alreadyMeasured} | Blocked handle confirmation: ${report.blockedTargets.length}`,
    "Route: `/new` only. This report does not measure, write, rank, or declare winners.",
    "",
    "| Account | Platform | Niche | Topics | Focus | Action | Sample size | Min age days | Measured sample | Caveats |",
    "|---|---|---|---|---|---|---:|---:|---:|---|",
    ...report.rows.map((row) => `| ${markdownText(row.accountKey)} | ${markdownText(row.platform)} | ${markdownText(row.niche)} | ${markdownText(row.topics.join(", "))} | ${markdownText(row.focus.join(", "))} | ${row.action} | ${markdownText(row.sampleSize)} | ${markdownText(row.minAgeDays)} | ${markdownText(row.measured?.sampleSize ?? null)} | ${markdownText(row.caveats.join("; "))} |`),
    "",
    "## Blocked configured targets",
    "",
    "| Platform | Creator | Niche | Reason |",
    "|---|---|---|---|",
    ...report.blockedTargets.map((target) => `| ${markdownText(target.platform)} | ${markdownText(target.creator)} | ${markdownText(target.niche)} | ${target.reason} |`),
    "",
    `Note: ${report.note}`,
    "",
  ];
  return lines.join("\n");
}

export function main(
  argv: readonly string[] = process.argv.slice(2),
  loaders: BaselineRepoReportCliLoaders = { loadConfig, readBaselines },
  io: { readonly write?: (value: string) => void; readonly error?: (value: string) => void } = {},
): number {
  try {
    const options = parseBaselineRepoReportArgs(argv);
    const report = buildBaselineRepoReportFromPaths(options, loaders);
    const output = options.format === "markdown" ? renderBaselineRepoReportMarkdown(report) : renderBaselineRepoReportJson(report);
    (io.write ?? ((value: string) => process.stdout.write(value)))(output);
    return 0;
  } catch (error) {
    (io.error ?? ((value: string) => process.stderr.write(value)))(`patterns:baseline-repo: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
