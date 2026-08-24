import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { buildCatalog, loadCatalogInputs, type PatternCatalog } from "./catalog.js";
import {
  buildPoolReviewCoverage,
  type PoolReviewCoverageArtifact,
} from "./review-pool-coverage.js";
import {
  buildPoolReviewHandoff,
  renderPoolReviewHandoff,
  type PoolReviewHandoffArtifact,
} from "./pool-review-handoff.js";
import type { ReviewMetadataInput } from "./review-metadata.js";

export const POOL_REVIEW_HANDOFF_CLI_VERSION = "pool-review-handoff-cli-v1" as const;
export type PoolReviewHandoffCliFormat = "json" | "markdown" | "both";

export interface PoolReviewHandoffCliOptions {
  readonly configPath?: string;
  readonly corpusPath?: string;
  readonly analysesPath?: string;
  readonly reviewsPath?: string;
  readonly format: PoolReviewHandoffCliFormat;
}

export interface PoolReviewHandoffCliLoaders {
  readonly loadCatalog: (paths: { config?: string; corpus?: string; analyses?: string }) => PatternCatalog;
  readonly readFile: (path: string) => string;
}

export class PoolReviewHandoffCliValidationError extends Error {
  constructor(message: string) { super(message); this.name = "PoolReviewHandoffCliValidationError"; }
}

function fail(message: string): never { throw new PoolReviewHandoffCliValidationError(message); }
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) fail(`${option} requires a value`);
  return value;
}

export function parsePoolReviewHandoffArgs(argv: readonly string[]): PoolReviewHandoffCliOptions {
  let configPath: string | undefined;
  let corpusPath: string | undefined;
  let analysesPath: string | undefined;
  let reviewsPath: string | undefined;
  let format: PoolReviewHandoffCliFormat = "json";
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--config") { configPath = optionValue(argv, index, argument); index += 1; }
    else if (argument === "--corpus") { corpusPath = optionValue(argv, index, argument); index += 1; }
    else if (argument === "--analyses") { analysesPath = optionValue(argv, index, argument); index += 1; }
    else if (argument === "--reviews") { reviewsPath = optionValue(argv, index, argument); index += 1; }
    else if (argument === "--format") {
      const value = optionValue(argv, index, argument);
      if (value !== "json" && value !== "markdown" && value !== "both") fail("--format must be json, markdown, or both");
      format = value; index += 1;
    } else fail(`unknown argument: ${argument}`);
  }
  return { configPath, corpusPath, analysesPath, reviewsPath, format };
}

function readReviewRows(raw: string): ReviewMetadataInput[] {
  let value: unknown;
  try { value = JSON.parse(raw) as unknown; } catch { fail("reviews input must be valid JSON"); }
  const rows = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.accountMetadataRows)
      ? value.accountMetadataRows
      : null;
  if (rows === null) fail("reviews input must be an array or review-status report with accountMetadataRows");
  return rows as ReviewMetadataInput[];
}

function coverageFromPaths(
  catalog: PatternCatalog,
  reviewsPath: string | undefined,
  readFile: (path: string) => string,
): PoolReviewCoverageArtifact {
  const reviews = reviewsPath === undefined ? [] : readReviewRows(readFile(reviewsPath));
  return buildPoolReviewCoverage({ catalog, reviews });
}

export function buildPoolReviewHandoffFromPaths(
  options: PoolReviewHandoffCliOptions,
  loaders: PoolReviewHandoffCliLoaders,
): PoolReviewHandoffArtifact {
  const catalog = loaders.loadCatalog({ config: options.configPath, corpus: options.corpusPath, analyses: options.analysesPath });
  const coverage = coverageFromPaths(catalog, options.reviewsPath, loaders.readFile);
  return buildPoolReviewHandoff({ catalog, coverage });
}

export function renderPoolReviewHandoffJsonWithCliVersion(artifact: PoolReviewHandoffArtifact): string {
  return `${JSON.stringify({ ...artifact, cliVersion: POOL_REVIEW_HANDOFF_CLI_VERSION }, null, 2)}\n`;
}

const defaultLoaders: PoolReviewHandoffCliLoaders = {
  loadCatalog: (paths) => {
    const inputs = loadCatalogInputs(paths);
    return buildCatalog(inputs.config, inputs.corpus, inputs.analyses);
  },
  readFile: (path) => readFileSync(path, "utf8"),
};

export function main(
  argv: readonly string[] = process.argv.slice(2),
  loaders: PoolReviewHandoffCliLoaders = defaultLoaders,
  io: { readonly write?: (value: string) => void; readonly error?: (value: string) => void } = {},
): number {
  try {
    const options = parsePoolReviewHandoffArgs(argv);
    const report = buildPoolReviewHandoffFromPaths(options, loaders);
    const output = options.format === "json"
      ? renderPoolReviewHandoffJsonWithCliVersion(report)
      : renderPoolReviewHandoff(report, options.format);
    (io.write ?? ((value: string) => process.stdout.write(value)))(output);
    return 0;
  } catch (error) {
    (io.error ?? ((value: string) => process.stderr.write(value)))(`patterns:pool-review-handoff: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
