import { appendFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  appendAccountReviewRow,
  readAccountReviewLedger,
  AccountReviewLedgerValidationError,
  type AccountReviewInput,
  type AccountReviewLedger,
  type AccountReviewLedgerIo,
} from "./account-review-ledger.js";

export const ACCOUNT_REVIEW_LEDGER_CLI_VERSION = "account-review-ledger-cli-v1" as const;
export type AccountReviewLedgerCliFormat = "json" | "markdown" | "both";

export type AccountReviewLedgerCliSource =
  | { readonly kind: "jsonl"; readonly value: string }
  | { readonly kind: "file"; readonly path: string };

export interface AccountReviewLedgerCliOptions {
  readonly source: AccountReviewLedgerCliSource;
  readonly format: AccountReviewLedgerCliFormat;
  readonly appendJson: string | null;
}

export interface AccountReviewLedgerCliIo {
  readonly readFile: (path: string) => string;
  readonly appendFile?: (path: string, value: string) => void;
  readonly write: (value: string) => void;
  readonly error?: (value: string) => void;
}

export { AccountReviewLedgerValidationError };

function fail(message: string): never {
  throw new AccountReviewLedgerValidationError(message);
}

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) fail(`${option} requires a value`);
  return value;
}

export function parseAccountReviewLedgerArgs(argv: readonly string[]): AccountReviewLedgerCliOptions {
  let source: AccountReviewLedgerCliSource | undefined;
  let format: AccountReviewLedgerCliFormat = "json";
  let appendJson: string | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--jsonl") {
      if (source) fail("exactly one of --jsonl or --file is allowed");
      source = { kind: "jsonl", value: optionValue(argv, index, argument) };
      index += 1;
    } else if (argument === "--file") {
      if (source) fail("exactly one of --jsonl or --file is allowed");
      source = { kind: "file", path: optionValue(argv, index, argument) };
      index += 1;
    } else if (argument === "--append-json") {
      if (appendJson !== null) fail("--append-json may be supplied only once");
      appendJson = optionValue(argv, index, argument);
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
  if (!source) fail("exactly one of --jsonl or --file is required");
  if (appendJson !== null && source.kind !== "file") fail("--append-json requires --file so the append remains durable");
  return { source, format, appendJson };
}

export const parseArgs = parseAccountReviewLedgerArgs;

export function loadAccountReviewLedgerSource(source: AccountReviewLedgerCliSource, io: Pick<AccountReviewLedgerCliIo, "readFile">): string {
  return source.kind === "file" ? io.readFile(source.path) : source.value;
}

export function parseAccountReviewInput(raw: string): AccountReviewInput {
  try {
    const value = JSON.parse(raw) as unknown;
    if (typeof value !== "object" || value === null || Array.isArray(value)) fail("--append-json must contain one account review JSON object");
    return value as AccountReviewInput;
  } catch (error) {
    if (error instanceof AccountReviewLedgerValidationError) throw error;
    fail(`--append-json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function readAccountReviewLedgerFromSource(
  source: AccountReviewLedgerCliSource,
  io: Pick<AccountReviewLedgerCliIo, "readFile">,
): AccountReviewLedger {
  return readAccountReviewLedger(loadAccountReviewLedgerSource(source, io));
}

function safeRow(row: AccountReviewLedger["rows"][number]): AccountReviewLedger["rows"][number] {
  return {
    id: row.id,
    currentAccountKey: row.currentAccountKey,
    platform: row.platform,
    handle: row.handle,
    creator: row.creator,
    stableAccountId: row.stableAccountId,
    stableAccountIdStatus: row.stableAccountIdStatus,
    topics: row.topics,
    focus: row.focus,
    nicheLabel: row.nicheLabel,
    researchPoolMembership: row.researchPoolMembership,
    popularityScope: row.popularityScope,
    sampleScope: row.sampleScope,
    baselineScope: row.baselineScope,
    baselineSource: row.baselineSource,
    medium: row.medium,
    format: row.format,
    audienceSnapshot: row.audienceSnapshot,
    evidenceRefs: row.evidenceRefs,
    baselineRefs: row.baselineRefs,
    caveats: row.caveats,
    reviewer: row.reviewer,
    reviewNote: row.reviewNote,
    disposition: row.disposition,
    dispositionReason: row.dispositionReason,
    reviewed_at: row.reviewed_at,
    supersedesId: row.supersedesId,
    kind: row.kind,
    version: row.version,
    identityKey: row.identityKey,
    readiness: { status: row.readiness.status, blockers: [...row.readiness.blockers] },
    bodyIncluded: false,
  };
}

function safeLedger(ledger: AccountReviewLedger): AccountReviewLedger {
  return {
    kind: ledger.kind,
    version: ledger.version,
    rows: ledger.rows.map(safeRow),
    summary: { ...ledger.summary },
    bodyIncluded: false,
    sideEffects: "none",
  };
}

export function renderAccountReviewLedgerJson(ledger: AccountReviewLedger): string {
  return `${JSON.stringify({ ...safeLedger(ledger), cliVersion: ACCOUNT_REVIEW_LEDGER_CLI_VERSION }, null, 2)}\n`;
}

function markdownText(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (value === "unknown") return "unknown";
  const rendered = typeof value === "object" ? JSON.stringify(value) : String(value);
  return rendered.replace(/[|\r\n]/g, (character) => character === "|" ? "\\|" : " ").replace(/\s+/g, " ").trim();
}

function listText(value: readonly string[] | "unknown" | null): string {
  return value === null || value === "unknown" ? markdownText(value) : markdownText(value.join(", "));
}

function poolText(value: AccountReviewLedger["rows"][number]["researchPoolMembership"]): string {
  return value === null || value === "unknown" ? markdownText(value) : markdownText(value.map((membership) => membership.pool).join(", "));
}

function audienceText(value: AccountReviewLedger["rows"][number]["audienceSnapshot"]): string {
  if (value === null || value === "unknown") return markdownText(value);
  return markdownText({ size: value.size, countType: value.countType, asOf: value.asOf });
}

export function renderAccountReviewLedgerMarkdown(ledger: AccountReviewLedger): string {
  const view = safeLedger(ledger);
  const lines = [
    "# Account review ledger",
    "",
    `Rows: ${view.summary.totalRows} total, ${view.summary.currentRows} current, ${view.summary.readyRows} ready, ${view.summary.blockedRows} blocked`,
    "",
    "| ID | Account | Platform | Handle / creator | Audience | Topics / focus | Pools | Medium / format | Popularity / sample | Baseline | Evidence | Review | Readiness |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...view.rows.map((row) => `| ${markdownText(row.id)} | ${markdownText(row.stableAccountId ?? row.currentAccountKey)} | ${markdownText(row.platform)} | ${markdownText(row.handle)} / ${markdownText(row.creator)} | ${audienceText(row.audienceSnapshot)} | ${listText(row.topics)} / ${listText(row.focus)} | ${poolText(row.researchPoolMembership)} | ${markdownText(row.medium)} / ${markdownText(row.format)} | ${markdownText(row.popularityScope)} / ${markdownText(row.sampleScope)} | ${markdownText(row.baselineScope)} / ${listText(row.baselineRefs)} | ${listText(row.evidenceRefs)} | ${markdownText(row.disposition)} by ${markdownText(row.reviewer)} at ${markdownText(row.reviewed_at)} | ${markdownText(row.readiness.status)}: ${markdownText(row.readiness.blockers.join(", "))} |`),
    "",
    "Caveats and review notes:",
    ...view.rows.map((row) => `- ${markdownText(row.id)}: caveats=${listText(row.caveats)}; note=${markdownText(row.reviewNote)}; reason=${markdownText(row.dispositionReason)}; supersedes=${markdownText(row.supersedesId)}`),
    "",
    "This is a body-free, append-only human-review ledger. It does not infer account size, topic, pool membership, rankings, winners, or model output.",
    "",
  ];
  return lines.join("\n");
}

export function renderAccountReviewLedger(ledger: AccountReviewLedger, format: AccountReviewLedgerCliFormat): string {
  if (format === "json") return renderAccountReviewLedgerJson(ledger);
  if (format === "markdown") return renderAccountReviewLedgerMarkdown(ledger);
  return `${renderAccountReviewLedgerJson(ledger)}\n${renderAccountReviewLedgerMarkdown(ledger)}`;
}

const defaultIo: AccountReviewLedgerCliIo = {
  readFile: (path) => readFileSync(path, "utf8"),
  appendFile: (path, value) => appendFileSync(path, value, "utf8"),
  write: (value) => process.stdout.write(value),
  error: (value) => process.stderr.write(value),
};

export function main(argv: readonly string[] = process.argv.slice(2), io: Partial<AccountReviewLedgerCliIo> = {}): number {
  const effectiveIo = { ...defaultIo, ...io };
  try {
    const options = parseAccountReviewLedgerArgs(argv);
    const raw = loadAccountReviewLedgerSource(options.source, effectiveIo);
    let ledger: AccountReviewLedger;
    if (options.appendJson !== null) {
      if (options.source.kind !== "file" || !effectiveIo.appendFile) fail("append I/O is unavailable");
      let currentRaw = raw;
      const appendIo: AccountReviewLedgerIo = {
        readJsonl: () => currentRaw,
        appendJsonl: (value) => {
          effectiveIo.appendFile!(options.source.kind === "file" ? options.source.path : "", value);
          currentRaw += value;
        },
      };
      ledger = appendAccountReviewRow(appendIo, parseAccountReviewInput(options.appendJson));
    } else {
      ledger = readAccountReviewLedger(raw);
    }
    effectiveIo.write(renderAccountReviewLedger(ledger, options.format));
    return 0;
  } catch (error) {
    effectiveIo.error?.(`patterns:account-review-ledger: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
