import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { buildDraftBatchGenerationRun, type DraftBatchGenerationRun } from "./draft-batch-run.js";

export const DRAFT_BATCH_GENERATION_RUN_CLI_VERSION = "draft-batch-generation-run-cli-v1" as const;
export type DraftBatchGenerationRunCliFormat = "json" | "markdown" | "both";

export interface DraftBatchGenerationRunCliOptions {
  readonly source: { readonly kind: "json"; readonly value: string } | { readonly kind: "file"; readonly path: string };
  readonly format: DraftBatchGenerationRunCliFormat;
}

export interface DraftBatchGenerationRunCliIo {
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

export function parseDraftBatchGenerationRunArgs(argv: readonly string[]): DraftBatchGenerationRunCliOptions {
  let source: DraftBatchGenerationRunCliOptions["source"] | undefined;
  let format: DraftBatchGenerationRunCliFormat = "json";
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") {
      if (source) fail("exactly one of --json or --file is allowed");
      source = { kind: "json", value: optionValue(argv, index, argument) }; index += 1;
    } else if (argument === "--file") {
      if (source) fail("exactly one of --json or --file is allowed");
      source = { kind: "file", path: optionValue(argv, index, argument) }; index += 1;
    } else if (argument === "--format") {
      const value = optionValue(argv, index, argument);
      if (value !== "json" && value !== "markdown" && value !== "both") fail("--format must be json, markdown, or both");
      format = value; index += 1;
    } else fail(`unknown argument: ${argument}`);
  }
  if (!source) fail("exactly one of --json or --file is required");
  return { source, format };
}

function input(raw: string): Parameters<typeof buildDraftBatchGenerationRun>[0] {
  let parsed: unknown;
  try { parsed = JSON.parse(raw) as unknown; } catch { fail("input must be valid JSON"); }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) fail("input must be an object envelope");
  return parsed as Parameters<typeof buildDraftBatchGenerationRun>[0];
}

export function buildDraftBatchGenerationRunFromJson(raw: string): DraftBatchGenerationRun {
  return buildDraftBatchGenerationRun(input(raw));
}

export function renderDraftBatchGenerationRunJson(value: DraftBatchGenerationRun): string {
  return `${JSON.stringify({ ...value, cliVersion: DRAFT_BATCH_GENERATION_RUN_CLI_VERSION }, null, 2)}\n`;
}

function markdown(value: unknown): string {
  return String(value ?? "null").replace(/[|\r\n]/g, (character) => character === "|" ? "\\|" : " ").replace(/\s+/g, " ").trim();
}

export function renderDraftBatchGenerationRunMarkdown(value: DraftBatchGenerationRun): string {
  const lines = [
    "# Draft batch generation run",
    "",
    `Readiness: ${value.readiness.status}`,
    `Requests bound: ${value.bindings.length}; unbound: ${value.unboundRequestIds.length}`,
    `Slots: ${value.generationRun.summary.slots}; blocked: ${value.generationRun.summary.blocked}`,
    "",
    "| Platform | Day | Slot | Variant | Artifact reference | Review queue | Status | Blockers |",
    "|---|---:|---:|---|---|---|---|---|",
    ...value.generationRun.slots.map((slot) => `| ${markdown(slot.platform)} | ${slot.dayIndex} | ${slot.slotIndex} | ${markdown(slot.variantId)} | ${markdown(slot.generatedArtifactRef)} | ${markdown(slot.reviewQueueRef)} | ${slot.status} | ${markdown(slot.blockers.join("; "))} |`),
    "",
    "Body-free and side-effect-free: no copy generated, no model invoked, no approval, scheduling, publishing, or persistence performed.",
    "",
  ];
  return lines.join("\n");
}

export function renderDraftBatchGenerationRun(value: DraftBatchGenerationRun, format: DraftBatchGenerationRunCliFormat): string {
  if (format === "json") return renderDraftBatchGenerationRunJson(value);
  if (format === "markdown") return renderDraftBatchGenerationRunMarkdown(value);
  return `${renderDraftBatchGenerationRunJson(value)}\n${renderDraftBatchGenerationRunMarkdown(value)}`;
}

const defaultIo: DraftBatchGenerationRunCliIo = {
  readFile: (path) => readFileSync(path, "utf8"),
  write: (value) => process.stdout.write(value),
  error: (value) => process.stderr.write(value),
};

export function main(argv: readonly string[] = process.argv.slice(2), io: Partial<DraftBatchGenerationRunCliIo> = {}): number {
  const effectiveIo = { ...defaultIo, ...io };
  try {
    const options = parseDraftBatchGenerationRunArgs(argv);
    const raw = options.source.kind === "file" ? effectiveIo.readFile(options.source.path) : options.source.value;
    effectiveIo.write(renderDraftBatchGenerationRun(buildDraftBatchGenerationRunFromJson(raw), options.format));
    return 0;
  } catch (error) {
    effectiveIo.error?.(`grow:draft-batch-run: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
