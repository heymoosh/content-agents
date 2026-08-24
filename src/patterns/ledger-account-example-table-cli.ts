import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  buildLedgerAccountExampleTable,
  type LedgerAccountExampleTable,
} from "./ledger-account-example-table.js";

export const LEDGER_ACCOUNT_EXAMPLE_TABLE_CLI_VERSION = "ledger-account-example-table-cli-v1" as const;
export type LedgerAccountExampleTableCliFormat = "json" | "markdown" | "both";

export interface LedgerAccountExampleTableCliOptions {
  readonly accountFile: string;
  readonly sourceFile: string;
  readonly format: LedgerAccountExampleTableCliFormat;
}

export interface LedgerAccountExampleTableCliIo {
  readonly readFile: (path: string) => string;
  readonly write: (value: string) => void;
  readonly error?: (value: string) => void;
}

function fail(message: string): never { throw new Error(message); }

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) fail(`${option} requires a value`);
  return value;
}

export function parseLedgerAccountExampleTableArgs(argv: readonly string[]): LedgerAccountExampleTableCliOptions {
  let accountFile: string | undefined;
  let sourceFile: string | undefined;
  let format: LedgerAccountExampleTableCliFormat = "json";
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--accounts-file") {
      if (accountFile) fail("--accounts-file may only be supplied once");
      accountFile = optionValue(argv, index, argument); index += 1;
    } else if (argument === "--sources-file") {
      if (sourceFile) fail("--sources-file may only be supplied once");
      sourceFile = optionValue(argv, index, argument); index += 1;
    } else if (argument === "--format") {
      const value = optionValue(argv, index, argument);
      if (value !== "json" && value !== "markdown" && value !== "both") fail("--format must be json, markdown, or both");
      format = value; index += 1;
    } else fail(`unknown argument: ${argument}`);
  }
  if (!accountFile || !sourceFile) fail("--accounts-file and --sources-file are required");
  return { accountFile, sourceFile, format };
}

export function renderLedgerAccountExampleTableJson(value: LedgerAccountExampleTable): string {
  return `${JSON.stringify({ ...value, cliVersion: LEDGER_ACCOUNT_EXAMPLE_TABLE_CLI_VERSION }, null, 2)}\n`;
}

function markdown(value: unknown): string {
  return String(value ?? "null").replace(/[|\r\n]/g, (character) => character === "|" ? "\\|" : " ").replace(/\s+/g, " ").trim();
}

export function renderLedgerAccountExampleTableMarkdown(value: LedgerAccountExampleTable): string {
  const lines = [
    "# Ledger account/example table",
    "",
    `Readiness: ${value.readiness.status}`,
    `Rows: ${value.table.summary.ready} ready, ${value.table.summary.blocked} blocked`,
    `Winner claims allowed: ${value.winnerClaimsAllowed}`,
    "",
    "| Account | Handle / creator | Size | Topics | Focus | Platform | Medium | Format | Pool | Scope | Evidence | Caveats | Status | Blockers |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...value.table.rows.map((row) => `| ${markdown(row.accountId)} | ${markdown(row.handle)} / ${markdown(row.creator)} | ${markdown(row.accountSizeSnapshot ? JSON.stringify(row.accountSizeSnapshot) : null)} | ${markdown(row.topics?.join(", "))} | ${markdown(row.focus?.join(", "))} | ${markdown(row.platform)} | ${markdown(row.medium)} | ${markdown(row.format)} | ${markdown(row.pool)} | ${markdown(`${row.popularityScope} / ${row.sampleScope}`)} | ${markdown(row.evidenceLinks.join(", "))} | ${markdown(row.caveats?.join(", "))} | ${markdown(row.readiness.status)} | ${markdown(row.readiness.blockers.join("; "))} |`),
    "",
    "Body-free read model: no creator post body, model output, ranking, or winner selection is included.",
    "",
  ];
  return lines.join("\n");
}

export function renderLedgerAccountExampleTable(value: LedgerAccountExampleTable, format: LedgerAccountExampleTableCliFormat): string {
  if (format === "json") return renderLedgerAccountExampleTableJson(value);
  if (format === "markdown") return renderLedgerAccountExampleTableMarkdown(value);
  return `${renderLedgerAccountExampleTableJson(value)}\n${renderLedgerAccountExampleTableMarkdown(value)}`;
}

const defaultIo: LedgerAccountExampleTableCliIo = {
  readFile: (path) => readFileSync(path, "utf8"),
  write: (value) => process.stdout.write(value),
  error: (value) => process.stderr.write(value),
};

export function main(argv: readonly string[] = process.argv.slice(2), io: Partial<LedgerAccountExampleTableCliIo> = {}): number {
  const effectiveIo = { ...defaultIo, ...io };
  try {
    const options = parseLedgerAccountExampleTableArgs(argv);
    const value = buildLedgerAccountExampleTable({ accountLedger: effectiveIo.readFile(options.accountFile), sourceLedger: effectiveIo.readFile(options.sourceFile) });
    effectiveIo.write(renderLedgerAccountExampleTable(value, options.format));
    return 0;
  } catch (error) {
    effectiveIo.error?.(`patterns:ledger-account-example-table: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
