import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
  createGenerationRun,
  type GenerationRun,
  type GenerationRunCandidate,
  type GenerationRunInput,
} from "./generation-run.js";

export const GENERATION_RUN_CLI_VERSION = "generation-run-cli-v1" as const;

export interface GenerationRunCliIo {
  readonly readFile: (path: string) => string | Promise<string>;
  readonly write: (value: string) => void | Promise<void>;
  readonly error?: (value: string) => void | Promise<void>;
}

export type GenerationRunCliSource =
  | { readonly kind: "json-string"; readonly value: string }
  | { readonly kind: "file"; readonly path: string };

export type GenerationRunCliFormat = "json" | "markdown" | "both";

export interface GenerationRunCliOptions {
  readonly source: GenerationRunCliSource;
  readonly format: GenerationRunCliFormat;
}

export class GenerationRunCliValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationRunCliValidationError";
  }
}

type JsonRecord = Record<string, unknown>;

function fail(message: string): never {
  throw new GenerationRunCliValidationError(message);
}

function record(value: unknown, label: string): JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value as JsonRecord;
}

function assertAllowedFields(value: JsonRecord, allowed: ReadonlySet<string>, label: string): void {
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) fail(`${label} contains unsupported field "${field}"`);
  }
}

function jsonEnvelope(raw: string): JsonRecord {
  if (typeof raw !== "string") fail("input must contain text");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    fail("input must be valid JSON");
  }
  const envelope = record(parsed, "JSON object envelope");
  assertAllowedFields(envelope, new Set(["volumePlan", "candidates", "treatmentCoverage"]), "input envelope");
  if (!Object.hasOwn(envelope, "volumePlan")) fail("volumePlan is required");
  if (!Object.hasOwn(envelope, "candidates")) fail("candidates is required");
  if (!Array.isArray(envelope.candidates)) fail("candidates must be an array");
  record(envelope.volumePlan, "volumePlan");
  return envelope;
}

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value`);
  return value;
}

export function parseGenerationRunArgs(argv: readonly string[]): GenerationRunCliOptions {
  let jsonText: string | undefined;
  let file: string | undefined;
  let format: GenerationRunCliFormat = "json";
  let jsonSeen = false;
  let fileSeen = false;
  let formatSeen = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") {
      if (jsonSeen) throw new Error("--json may only be supplied once");
      jsonSeen = true;
      jsonText = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--file") {
      if (fileSeen) throw new Error("--file may only be supplied once");
      fileSeen = true;
      file = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--format") {
      if (formatSeen) throw new Error("--format may only be supplied once");
      formatSeen = true;
      const value = optionValue(argv, index, argument);
      if (value !== "json" && value !== "markdown" && value !== "both") {
        throw new Error("--format must be json, markdown, or both");
      }
      format = value;
      index += 1;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }

  if (jsonText !== undefined && file !== undefined) throw new Error("exactly one of --json or --file is allowed");
  if (jsonText === undefined && file === undefined) throw new Error("exactly one of --json or --file is required");
  return {
    source: jsonText === undefined
      ? { kind: "file", path: file as string }
      : { kind: "json-string", value: jsonText },
    format,
  };
}

export function loadGenerationRunEnvelope(raw: string): GenerationRunInput {
  const envelope = jsonEnvelope(raw);
  return {
    volumePlan: envelope.volumePlan as GenerationRunInput["volumePlan"],
    candidates: envelope.candidates as GenerationRunCandidate[],
    ...(Object.hasOwn(envelope, "treatmentCoverage")
      ? { treatmentCoverage: envelope.treatmentCoverage as GenerationRunInput["treatmentCoverage"] }
      : {}),
  };
}

export function buildGenerationRunFromJson(raw: string): GenerationRun {
  try {
    return createGenerationRun(loadGenerationRunEnvelope(raw));
  } catch (error) {
    if (error instanceof GenerationRunCliValidationError) throw error;
    fail(`generation run: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function readGenerationRunEnvelope(
  source: GenerationRunCliSource,
  io: Pick<GenerationRunCliIo, "readFile">,
): Promise<string> {
  if (source.kind === "json-string") return source.value;
  const value = await io.readFile(source.path);
  if (typeof value !== "string") fail("input file must contain text");
  return value;
}

export async function buildGenerationRunFromSource(
  source: GenerationRunCliSource,
  io: Pick<GenerationRunCliIo, "readFile">,
): Promise<GenerationRun> {
  return buildGenerationRunFromJson(await readGenerationRunEnvelope(source, io));
}

export function renderGenerationRunJson(run: GenerationRun): string {
  return `${JSON.stringify(run, null, 2)}\n`;
}

function markdownText(value: string): string {
  return value.replace(/`/g, "'").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function experimentText(assignment: Record<string, string> | null): string {
  if (!assignment) return "none";
  return Object.entries(assignment)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([name, option]) => `${name}=${option}`)
    .join(", ");
}

function blockersText(blockers: readonly string[]): string {
  return blockers.length ? blockers.map(markdownText).join("; ") : "none";
}

export function renderGenerationRunMarkdown(run: GenerationRun): string {
  const lines = [
    "# Generation run",
    "",
    `- Version: \`${markdownText(run.version)}\``,
    `- Source reference: \`${markdownText(run.sourceReference)}\``,
    `- Substance reference: \`${markdownText(run.substanceReference)}\``,
    `- Overall readiness: ${run.readiness.status}`,
    `- Overall blockers: ${blockersText(run.readiness.blockers)}`,
    `- Treatment coverage: ${run.treatmentCoverage.status}${run.treatmentCoverage.supplied ? " (supplied)" : " (missing)"}`,
    `- Slot summary: ${run.summary.ready} ready, ${run.summary.blocked} blocked, ${run.summary.missing} missing, ${run.summary.duplicate} duplicate, ${run.summary.unexpected} unexpected`,
    "",
    "## Safety boundary",
    "",
    `- Generates copy: ${run.generatesCopy}`,
    `- Creator body copy allowed: ${run.creatorBodyCopyAllowed}`,
    `- Human review required: ${run.humanReviewRequired}`,
    `- Auto-approval: ${run.autoApproval}`,
    `- Auto-scheduling: ${run.autoScheduling}`,
    `- Auto-publishing: ${run.autoPublishing}`,
    `- Side effects: ${run.sideEffects}`,
    "",
    "## Slot coverage",
    "",
    "| Platform | Day | Slot | Variant | Experiment | Status | Artifact reference | Review queue reference | Blockers |",
    "|---|---:|---:|---|---|---|---|---|---|",
    ...run.slots.map((slot) => [
      markdownText(slot.platform),
      String(slot.dayIndex),
      String(slot.slotIndex),
      markdownText(slot.variantId),
      markdownText(experimentText(slot.experimentAssignment)),
      slot.status,
      markdownText(slot.generatedArtifactRef ?? "none"),
      markdownText(slot.reviewQueueRef ?? "none"),
      blockersText(slot.blockers),
    ].map(markdownText).join(" | ").replace(/^/, "| ").concat(" |")),
  ];

  if (run.unexpectedCandidates.length) {
    lines.push(
      "",
      "## Unexpected candidate metadata",
      "",
      ...run.unexpectedCandidates.map((candidate) => `- ${markdownText(candidate.platform)}/${candidate.dayIndex}/${candidate.slotIndex}/${markdownText(candidate.variantId)}: ${blockersText(candidate.blockers)}`),
    );
  }
  return `${lines.join("\n")}\n`;
}

export function renderGenerationRun(run: GenerationRun, format: GenerationRunCliFormat): string {
  if (format === "json") return renderGenerationRunJson(run);
  if (format === "markdown") return renderGenerationRunMarkdown(run);
  return `${renderGenerationRunJson(run)}\n${renderGenerationRunMarkdown(run)}`;
}

const defaultIo: GenerationRunCliIo = {
  readFile: (path) => readFile(path, "utf8"),
  write: (value) => { process.stdout.write(value); },
  error: (value) => { process.stderr.write(value); },
};

export async function main(
  argv: readonly string[] = process.argv.slice(2),
  io: Partial<GenerationRunCliIo> = {},
): Promise<number> {
  const effectiveIo = { ...defaultIo, ...io };
  try {
    const options = parseGenerationRunArgs(argv);
    const run = await buildGenerationRunFromSource(options.source, effectiveIo);
    await effectiveIo.write(renderGenerationRun(run, options.format));
    return 0;
  } catch (error) {
    await effectiveIo.error?.(`grow:generation-run: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((exitCode) => { process.exitCode = exitCode; });
}
