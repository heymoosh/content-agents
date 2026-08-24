import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { BASELINES_PATH, readBaselines } from "./baselines.js";
import { buildCatalog, loadCatalogInputs, type PatternCatalog } from "./catalog.js";
import {
  buildPlatformPoolMatrixRepoReport,
  type PlatformPoolMatrixRepoInputs,
  type PlatformPoolMatrixRepoReport,
} from "./platform-pool-matrix-repo.js";
import { renderPlatformPoolMatrixMarkdown } from "./platform-pool-matrix.js";
import type { AccountBaseline } from "./types.js";

export const PLATFORM_POOL_MATRIX_REPO_CLI_VERSION = "platform-pool-matrix-repo-cli-v1" as const;
export type PlatformPoolMatrixRepoCliFormat = "json" | "markdown";

export interface PlatformPoolMatrixRepoCliOptions {
  readonly configPath?: string;
  readonly corpusPath?: string;
  readonly analysesPath?: string;
  readonly reviewsPath?: string;
  readonly baselinesPath?: string;
  readonly format: PlatformPoolMatrixRepoCliFormat;
}

export interface PlatformPoolMatrixRepoCliLoaders {
  readonly loadCatalog: (paths: { config?: string; corpus?: string; analyses?: string }) => PatternCatalog;
  readonly readBaselines: (path?: string) => AccountBaseline[];
  readonly readFile: (path: string) => string;
}

export class PlatformPoolMatrixRepoCliValidationError extends Error {
  constructor(message: string) { super(message); this.name = "PlatformPoolMatrixRepoCliValidationError"; }
}

function fail(message: string): never { throw new PlatformPoolMatrixRepoCliValidationError(message); }
function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) fail(`${option} requires a value`);
  return value;
}

export function parsePlatformPoolMatrixRepoArgs(argv: readonly string[]): PlatformPoolMatrixRepoCliOptions {
  let configPath: string | undefined;
  let corpusPath: string | undefined;
  let analysesPath: string | undefined;
  let reviewsPath: string | undefined;
  let baselinesPath: string | undefined;
  let format: PlatformPoolMatrixRepoCliFormat = "json";
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--config") { configPath = optionValue(argv, index, argument); index += 1; }
    else if (argument === "--corpus") { corpusPath = optionValue(argv, index, argument); index += 1; }
    else if (argument === "--analyses") { analysesPath = optionValue(argv, index, argument); index += 1; }
    else if (argument === "--reviews") { reviewsPath = optionValue(argv, index, argument); index += 1; }
    else if (argument === "--baselines") { baselinesPath = optionValue(argv, index, argument); index += 1; }
    else if (argument === "--format") {
      const value = optionValue(argv, index, argument);
      if (value !== "json" && value !== "markdown") fail("--format must be json or markdown");
      format = value; index += 1;
    } else fail(`unknown argument: ${argument}`);
  }
  return { configPath, corpusPath, analysesPath, reviewsPath, baselinesPath, format };
}

function reviewFacts(raw: string): PlatformPoolMatrixRepoInputs["reviews"] {
  let value: unknown;
  try { value = JSON.parse(raw) as unknown; } catch { fail("reviews input must be valid JSON"); }
  const rows = Array.isArray(value) ? value : typeof value === "object" && value !== null && !Array.isArray(value) && Array.isArray((value as Record<string, unknown>).accountMetadataRows)
    ? (value as Record<string, unknown>).accountMetadataRows
    : null;
  if (!rows) fail("reviews input must be an array or review-status report with accountMetadataRows");
  return rows as PlatformPoolMatrixRepoInputs["reviews"];
}

export function buildPlatformPoolMatrixRepoReportFromPaths(
  options: PlatformPoolMatrixRepoCliOptions,
  loaders: PlatformPoolMatrixRepoCliLoaders,
): PlatformPoolMatrixRepoReport {
  const catalog = loaders.loadCatalog({ config: options.configPath, corpus: options.corpusPath, analyses: options.analysesPath });
  const inputs: PlatformPoolMatrixRepoInputs = {
    reviews: options.reviewsPath === undefined ? undefined : reviewFacts(loaders.readFile(options.reviewsPath)),
    baselines: loaders.readBaselines(options.baselinesPath ?? BASELINES_PATH),
  };
  return buildPlatformPoolMatrixRepoReport(catalog, inputs);
}

export function renderPlatformPoolMatrixRepoJson(report: PlatformPoolMatrixRepoReport): string {
  return `${JSON.stringify({ ...report, cliVersion: PLATFORM_POOL_MATRIX_REPO_CLI_VERSION }, null, 2)}\n`;
}

export function renderPlatformPoolMatrixRepoMarkdown(report: PlatformPoolMatrixRepoReport): string {
  const base = renderPlatformPoolMatrixMarkdown({
    ...report,
    kind: "platform_pool_matrix",
    version: "platform-pool-matrix-v1",
  });
  const lines = [base.trimEnd(), "", "## Unassigned or blocked pool targets", "", "| Account | Platform | Source pool labels | Blockers |", "|---|---|---|---|", ...report.blockedTargets.map((row) => `| ${row.id.replaceAll("|", "\\|")} | ${row.platform} | ${row.researchPools.join(", ") || "none"} | ${row.blockers.join("; ")} |`), ""];
  return lines.join("\n");
}

const defaultLoaders: PlatformPoolMatrixRepoCliLoaders = {
  loadCatalog: (paths) => {
    const inputs = loadCatalogInputs(paths);
    return buildCatalog(inputs.config, inputs.corpus, inputs.analyses);
  },
  readBaselines,
  readFile: (path) => readFileSync(path, "utf8"),
};

export function main(
  argv: readonly string[] = process.argv.slice(2),
  loaders: PlatformPoolMatrixRepoCliLoaders = defaultLoaders,
  io: { readonly write?: (value: string) => void; readonly error?: (value: string) => void } = {},
): number {
  try {
    const options = parsePlatformPoolMatrixRepoArgs(argv);
    const report = buildPlatformPoolMatrixRepoReportFromPaths(options, loaders);
    const output = options.format === "markdown" ? renderPlatformPoolMatrixRepoMarkdown(report) : renderPlatformPoolMatrixRepoJson(report);
    (io.write ?? ((value: string) => process.stdout.write(value)))(output);
    return 0;
  } catch (error) {
    (io.error ?? ((value: string) => process.stderr.write(value)))(`patterns:platform-pool-matrix-repo: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
