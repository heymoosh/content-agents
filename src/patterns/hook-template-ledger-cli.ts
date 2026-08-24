import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  readHookTemplateLedger,
  type HookTemplateFilter,
  type HookTemplateLedgerView,
} from "./hook-template-ledger.js";
import { PLATFORMS, type Platform } from "./types.js";

export const HOOK_TEMPLATE_LEDGER_CLI_VERSION = "hook-template-ledger-cli-v1" as const;
export type HookTemplateLedgerCliFormat = "json" | "markdown" | "both";

export interface HookTemplateLedgerCliOptions {
  readonly file: string;
  readonly filter: HookTemplateFilter;
  readonly format: HookTemplateLedgerCliFormat;
}

export interface HookTemplateLedgerCliIo {
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

function nonEmpty(value: string, field: string): string {
  if (!value.trim()) fail(`${field} requires a non-empty value`);
  return value.trim();
}

export function parseHookTemplateLedgerArgs(argv: readonly string[]): HookTemplateLedgerCliOptions {
  let file: string | undefined;
  let platform: Platform | undefined;
  let niche: string | undefined;
  let formatValue: string | undefined;
  let includeUnreviewed = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--file") {
      if (file !== undefined) fail("--file may only be supplied once");
      file = optionValue(argv, index, argument); index += 1;
    } else if (argument === "--platform") {
      const value = optionValue(argv, index, argument);
      if (!(PLATFORMS as readonly string[]).includes(value)) fail("--platform is unsupported");
      platform = value as Platform; index += 1;
    } else if (argument === "--niche") {
      niche = nonEmpty(optionValue(argv, index, argument), "--niche"); index += 1;
    } else if (argument === "--format") {
      formatValue = optionValue(argv, index, argument); index += 1;
    } else if (argument === "--include-unreviewed") {
      if (includeUnreviewed) fail("--include-unreviewed may only be supplied once");
      includeUnreviewed = true;
    } else fail(`unknown argument: ${argument}`);
  }
  if (!file) fail("--file is required");
  if (formatValue !== undefined && formatValue !== "json" && formatValue !== "markdown" && formatValue !== "both") {
    fail("--format must be json, markdown, or both");
  }
  return {
    file,
    filter: { platform, niche, includeUnreviewed },
    format: (formatValue ?? "json") as HookTemplateLedgerCliFormat,
  };
}

export function renderHookTemplateLedgerJson(value: HookTemplateLedgerView): string {
  return `${JSON.stringify({ ...value, cliVersion: HOOK_TEMPLATE_LEDGER_CLI_VERSION }, null, 2)}\n`;
}

function markdown(value: unknown): string {
  return String(value ?? "null").replace(/[|\r\n]/g, (character) => character === "|" ? "\\|" : " ").replace(/\s+/g, " ").trim();
}

export function renderHookTemplateLedgerMarkdown(value: HookTemplateLedgerView): string {
  const lines = [
    "# Hook-template ledger",
    "",
    `Rows: ${value.summary.total} | Reviewed: ${value.summary.reviewed} | Unreviewed: ${value.summary.unreviewed} | Measured: ${value.summary.measured}`,
    "",
    "| ID | Mechanism | Platforms | Niches | Formats | Slots | Review | Originality | Evidence | Sources |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...value.rows.map((row) => `| ${markdown(row.id)} | ${markdown(row.mechanism)} | ${markdown(row.platforms.join(", "))} | ${markdown(row.niches.join(", "))} | ${markdown(row.formats.join(", "))} | ${markdown(row.slots.join(", "))} | ${markdown(row.review)} | ${markdown(row.originality)} | ${markdown(row.evidenceStatus)} | ${markdown(row.sourceRefs.map((ref) => `${ref.sourceId} @ ${ref.location}`).join("; "))} |`),
    "",
    "Common-hook mad-lib adaptation is allowed downstream. This ledger contains no creator body, exact opener wording, model output, ranking, winner, queue, or publishing side effect.",
    "",
  ];
  return lines.join("\n");
}

export function renderHookTemplateLedger(value: HookTemplateLedgerView, format: HookTemplateLedgerCliFormat): string {
  if (format === "json") return renderHookTemplateLedgerJson(value);
  if (format === "markdown") return renderHookTemplateLedgerMarkdown(value);
  return `${renderHookTemplateLedgerJson(value)}\n${renderHookTemplateLedgerMarkdown(value)}`;
}

const defaultIo: HookTemplateLedgerCliIo = {
  readFile: (path) => readFileSync(path, "utf8"),
  write: (value) => process.stdout.write(value),
  error: (value) => process.stderr.write(value),
};

export function main(argv: readonly string[] = process.argv.slice(2), io: Partial<HookTemplateLedgerCliIo> = {}): number {
  const effectiveIo = { ...defaultIo, ...io };
  try {
    const options = parseHookTemplateLedgerArgs(argv);
    const value = readHookTemplateLedger(effectiveIo.readFile(options.file), options.filter);
    effectiveIo.write(renderHookTemplateLedger(value, options.format));
    return 0;
  } catch (error) {
    effectiveIo.error?.(`patterns:hook-templates: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
