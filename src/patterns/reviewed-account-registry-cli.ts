import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { BASELINES_PATH, readBaselines } from "./baselines.js";
import { buildCatalog, loadCatalogInputs, type PatternCatalog } from "./catalog.js";
import {
  buildReviewedAccountRegistryReport,
  type ReviewedAccountRegistryReport,
} from "./reviewed-account-registry-report.js";
import type { AccountBaseline } from "./types.js";

export const REVIEWED_ACCOUNT_REGISTRY_CLI_VERSION = "reviewed-account-registry-cli-v1" as const;
export type ReviewedAccountRegistryCliFormat = "json" | "markdown" | "both";

export interface ReviewedAccountRegistryCliOptions {
  readonly accountsFile: string;
  readonly sourcesFile: string;
  readonly configPath?: string;
  readonly corpusPath?: string;
  readonly analysesPath?: string;
  readonly baselinesPath?: string;
  readonly format: ReviewedAccountRegistryCliFormat;
}

export interface ReviewedAccountRegistryCliLoaders {
  readonly loadCatalog: (paths: { config?: string; corpus?: string; analyses?: string }) => PatternCatalog;
  readonly readBaselines: (path?: string) => AccountBaseline[];
  readonly readFile: (path: string) => string;
}

export class ReviewedAccountRegistryCliValidationError extends Error {
  constructor(message: string) { super(message); this.name = "ReviewedAccountRegistryCliValidationError"; }
}

function fail(message: string): never { throw new ReviewedAccountRegistryCliValidationError(message); }

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) fail(`${option} requires a value`);
  return value;
}

export function parseReviewedAccountRegistryArgs(argv: readonly string[]): ReviewedAccountRegistryCliOptions {
  let accountsFile: string | undefined;
  let sourcesFile: string | undefined;
  let configPath: string | undefined;
  let corpusPath: string | undefined;
  let analysesPath: string | undefined;
  let baselinesPath: string | undefined;
  let format: ReviewedAccountRegistryCliFormat = "json";
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--accounts-file") { if (accountsFile) fail("--accounts-file may only be supplied once"); accountsFile = optionValue(argv, index, argument); index += 1; }
    else if (argument === "--sources-file") { if (sourcesFile) fail("--sources-file may only be supplied once"); sourcesFile = optionValue(argv, index, argument); index += 1; }
    else if (argument === "--config") { configPath = optionValue(argv, index, argument); index += 1; }
    else if (argument === "--corpus") { corpusPath = optionValue(argv, index, argument); index += 1; }
    else if (argument === "--analyses") { analysesPath = optionValue(argv, index, argument); index += 1; }
    else if (argument === "--baselines") { baselinesPath = optionValue(argv, index, argument); index += 1; }
    else if (argument === "--format") {
      const value = optionValue(argv, index, argument);
      if (value !== "json" && value !== "markdown" && value !== "both") fail("--format must be json, markdown, or both");
      format = value; index += 1;
    } else fail(`unknown argument: ${argument}`);
  }
  if (!accountsFile || !sourcesFile) fail("--accounts-file and --sources-file are required");
  return { accountsFile, sourcesFile, configPath, corpusPath, analysesPath, baselinesPath, format };
}

export function buildReviewedAccountRegistryReportFromPaths(
  options: ReviewedAccountRegistryCliOptions,
  loaders: ReviewedAccountRegistryCliLoaders,
): ReviewedAccountRegistryReport {
  return buildReviewedAccountRegistryReport({
    accountLedger: loaders.readFile(options.accountsFile),
    sourceLedger: loaders.readFile(options.sourcesFile),
    catalog: loaders.loadCatalog({ config: options.configPath, corpus: options.corpusPath, analyses: options.analysesPath }),
    baselines: loaders.readBaselines(options.baselinesPath ?? BASELINES_PATH),
  });
}

export function renderReviewedAccountRegistryJson(report: ReviewedAccountRegistryReport): string {
  return `${JSON.stringify({ ...report, cliVersion: REVIEWED_ACCOUNT_REGISTRY_CLI_VERSION }, null, 2)}\n`;
}

function markdown(value: unknown): string {
  return String(value ?? "null").replace(/[|\r\n]/g, (character) => character === "|" ? "\\|" : " ").replace(/\s+/g, " ").trim();
}

export function renderReviewedAccountRegistryMarkdown(report: ReviewedAccountRegistryReport): string {
  const lines = [
    "# Reviewed account registry",
    "",
    `Readiness: ${report.readiness.status} | Accounts: ${report.registry.summary.total} | Reviewed: ${report.registry.summary.reviewed} | Ready: ${report.registry.summary.ready} | Blocked: ${report.registry.summary.blocked}`,
    `Matrix: ${report.platformPoolMatrix.summary.total} explicit targets | Reviewed: ${report.platformPoolMatrix.summary.reviewed} | Baseline-ready: ${report.platformPoolMatrix.summary.baselineReady} | Blocked pool assignments: ${report.platformPoolMatrix.blockedTargets.length}`,
    "Winner claims allowed: no. This is a reviewed-fact and coverage view, not a best-creator ranking.",
    "",
    "| Account | Platform | Handle / creator | Size | Topics | Focus | Medium | Format | Pools | Review | Readiness |",
    "|---|---|---|---:|---|---|---|---|---|---|---|",
    ...report.registry.rows.map((row) => `| ${markdown(row.accountId ?? row.currentAccountKey)} | ${markdown(row.platform)} | ${markdown(row.handle)} / ${markdown(row.creator)} | ${markdown(row.audienceSnapshot === null || row.audienceSnapshot === "unknown" ? null : row.audienceSnapshot.size)} | ${markdown(row.topics === "unknown" ? "unknown" : row.topics?.join(", "))} | ${markdown(row.focus === "unknown" ? "unknown" : row.focus?.join(", "))} | ${markdown(row.medium)} | ${markdown(row.format)} | ${markdown(row.researchPoolMembership === "unknown" ? "unknown" : row.researchPoolMembership?.map((membership) => membership.pool).join(", "))} | ${row.disposition} | ${row.readiness.status} |`),
    "",
    "## Blockers",
    "",
    ...(report.readiness.blockers.length ? report.readiness.blockers.map((blocker) => `- ${markdown(blocker)}`) : ["- none"]),
    "",
    "No creator body, model output, inferred pool, or winner claim is emitted.",
    "",
  ];
  return lines.join("\n");
}

export function renderReviewedAccountRegistry(
  report: ReviewedAccountRegistryReport,
  format: ReviewedAccountRegistryCliFormat,
): string {
  if (format === "json") return renderReviewedAccountRegistryJson(report);
  if (format === "markdown") return renderReviewedAccountRegistryMarkdown(report);
  return `${renderReviewedAccountRegistryJson(report)}\n${renderReviewedAccountRegistryMarkdown(report)}`;
}

const defaultLoaders: ReviewedAccountRegistryCliLoaders = {
  loadCatalog: (paths) => {
    const inputs = loadCatalogInputs(paths);
    return buildCatalog(inputs.config, inputs.corpus, inputs.analyses);
  },
  readBaselines,
  readFile: (path) => readFileSync(path, "utf8"),
};

export function main(
  argv: readonly string[] = process.argv.slice(2),
  loaders: ReviewedAccountRegistryCliLoaders = defaultLoaders,
  io: { readonly write?: (value: string) => void; readonly error?: (value: string) => void } = {},
): number {
  try {
    const options = parseReviewedAccountRegistryArgs(argv);
    const report = buildReviewedAccountRegistryReportFromPaths(options, loaders);
    (io.write ?? ((value: string) => process.stdout.write(value)))(renderReviewedAccountRegistry(report, options.format));
    return 0;
  } catch (error) {
    (io.error ?? ((value: string) => process.stderr.write(value)))(`patterns:reviewed-account-registry: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
