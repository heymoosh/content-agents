import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { BASELINES_PATH, readBaselines } from "./baselines.js";
import {
  buildPoolBestLedgerReport,
  type PoolBestLedgerReport,
} from "./pool-best-ledger-report.js";
import { renderPoolBestReportMarkdown } from "./pool-best-report.js";

export const POOL_BEST_LEDGER_REPORT_CLI_VERSION = "pool-best-ledger-report-cli-v1" as const;
export type PoolBestLedgerReportCliFormat = "json" | "markdown" | "both";

export interface PoolBestLedgerReportCliOptions {
  readonly accountsFile: string;
  readonly sourcesFile: string;
  readonly baselinesPath?: string;
  readonly minimumComparableCandidates: number;
  readonly format: PoolBestLedgerReportCliFormat;
}

export interface PoolBestLedgerReportCliLoaders {
  readonly readFile: (path: string) => string;
  readonly readBaselines: (path?: string) => Parameters<typeof buildPoolBestLedgerReport>[0]["baselines"];
}

export class PoolBestLedgerReportCliValidationError extends Error {
  constructor(message: string) { super(message); this.name = "PoolBestLedgerReportCliValidationError"; }
}

function fail(message: string): never { throw new PoolBestLedgerReportCliValidationError(message); }
function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) fail(`${option} requires a value`);
  return value;
}

export function parsePoolBestLedgerReportArgs(argv: readonly string[]): PoolBestLedgerReportCliOptions {
  let accountsFile: string | undefined;
  let sourcesFile: string | undefined;
  let baselinesPath: string | undefined;
  let minimumComparableCandidates = 2;
  let format: PoolBestLedgerReportCliFormat = "json";
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--accounts-file") { accountsFile = optionValue(argv, index, argument); index += 1; }
    else if (argument === "--sources-file") { sourcesFile = optionValue(argv, index, argument); index += 1; }
    else if (argument === "--baselines") { baselinesPath = optionValue(argv, index, argument); index += 1; }
    else if (argument === "--minimum-comparable-candidates") {
      const value = Number(optionValue(argv, index, argument));
      if (!Number.isInteger(value) || value < 2) fail("--minimum-comparable-candidates must be an integer of at least 2");
      minimumComparableCandidates = value; index += 1;
    } else if (argument === "--format") {
      const value = optionValue(argv, index, argument);
      if (value !== "json" && value !== "markdown" && value !== "both") fail("--format must be json, markdown, or both");
      format = value; index += 1;
    } else fail(`unknown argument: ${argument}`);
  }
  if (!accountsFile || !sourcesFile) fail("--accounts-file and --sources-file are required");
  return { accountsFile, sourcesFile, baselinesPath, minimumComparableCandidates, format };
}

export function buildPoolBestLedgerReportFromPaths(
  options: PoolBestLedgerReportCliOptions,
  loaders: PoolBestLedgerReportCliLoaders,
): PoolBestLedgerReport {
  return buildPoolBestLedgerReport({
    accountLedger: loaders.readFile(options.accountsFile),
    sourceLedger: loaders.readFile(options.sourcesFile),
    baselines: loaders.readBaselines(options.baselinesPath ?? BASELINES_PATH),
    minimumComparableCandidates: options.minimumComparableCandidates,
  });
}

export function renderPoolBestLedgerReportJson(report: PoolBestLedgerReport): string {
  return `${JSON.stringify({ ...report, cliVersion: POOL_BEST_LEDGER_REPORT_CLI_VERSION }, null, 2)}\n`;
}

export function renderPoolBestLedgerReportMarkdown(report: PoolBestLedgerReport): string {
  return [
    "# Pool best report from durable ledgers",
    "",
    `Readiness: ${report.readiness.status} | Winner groups: ${report.comparison.summary.winnerGroups} | Blocked groups: ${report.comparison.summary.blockedGroups}`,
    "The comparison is limited to explicit reviewed source/post facts and recorded baselines.",
    "",
    renderPoolBestReportMarkdown(report.comparison).trimEnd(),
    "",
    "## Ledger blockers",
    "",
    ...(report.readiness.blockers.length ? report.readiness.blockers.map((blocker) => `- ${blocker}`) : ["- none"]),
    "",
  ].join("\n");
}

export function renderPoolBestLedgerReport(report: PoolBestLedgerReport, format: PoolBestLedgerReportCliFormat): string {
  if (format === "json") return renderPoolBestLedgerReportJson(report);
  if (format === "markdown") return renderPoolBestLedgerReportMarkdown(report);
  return `${renderPoolBestLedgerReportJson(report)}\n${renderPoolBestLedgerReportMarkdown(report)}`;
}

const defaultLoaders: PoolBestLedgerReportCliLoaders = { readFile: (path) => readFileSync(path, "utf8"), readBaselines };

export function main(
  argv: readonly string[] = process.argv.slice(2),
  loaders: PoolBestLedgerReportCliLoaders = defaultLoaders,
  io: { readonly write?: (value: string) => void; readonly error?: (value: string) => void } = {},
): number {
  try {
    const options = parsePoolBestLedgerReportArgs(argv);
    const report = buildPoolBestLedgerReportFromPaths(options, loaders);
    (io.write ?? ((value: string) => process.stdout.write(value)))(renderPoolBestLedgerReport(report, options.format));
    return 0;
  } catch (error) {
    (io.error ?? ((value: string) => process.stderr.write(value)))(`patterns:pool-best-ledger: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
