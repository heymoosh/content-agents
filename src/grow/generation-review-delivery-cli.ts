import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
  buildGrowGenerationReviewDelivery,
  type GrowGenerationReviewDelivery,
  type GrowGenerationReviewDeliveryInput,
} from "./generation-review-delivery.js";

export const GENERATION_REVIEW_DELIVERY_CLI_VERSION = "generation-review-delivery-cli-v1" as const;

export interface GenerationReviewDeliveryCliIo {
  readonly readFile: (path: string) => string | Promise<string>;
  readonly write: (value: string) => void | Promise<void>;
  readonly error?: (value: string) => void | Promise<void>;
}

export type GenerationReviewDeliveryCliSource =
  | { readonly kind: "json-string"; readonly value: string }
  | { readonly kind: "file"; readonly path: string };

export type GenerationReviewDeliveryCliFormat = "json" | "markdown" | "both";

export interface GenerationReviewDeliveryCliOptions {
  readonly source: GenerationReviewDeliveryCliSource;
  readonly format: GenerationReviewDeliveryCliFormat;
}

export class GenerationReviewDeliveryCliValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationReviewDeliveryCliValidationError";
  }
}

type JsonRecord = Record<string, unknown>;

function fail(message: string): never {
  throw new GenerationReviewDeliveryCliValidationError(message);
}

function record(value: unknown, label: string): JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value as JsonRecord;
}

function assertNoBodyFields(value: unknown, label: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoBodyFields(item, `${label}[${index + 1}]`));
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value as JsonRecord)) {
    if (new Set(["body", "content", "copy", "sourceBody", "creatorBody"]).has(key)) {
      fail(`${label} contains unsupported body field "${key}"`);
    }
    assertNoBodyFields(item, `${label}.${key}`);
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
  for (const field of Object.keys(envelope)) {
    if (field !== "generationRun" && field !== "bindings") fail(`input envelope contains unsupported field "${field}"`);
  }
  if (!Object.hasOwn(envelope, "generationRun")) fail("generationRun is required");
  if (!Object.hasOwn(envelope, "bindings")) fail("bindings is required");
  record(envelope.generationRun, "generationRun");
  if (!Array.isArray(envelope.bindings)) fail("bindings must be an array");
  assertNoBodyFields(envelope, "input envelope");
  return envelope;
}

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value`);
  return value;
}

export function parseGenerationReviewDeliveryArgs(argv: readonly string[]): GenerationReviewDeliveryCliOptions {
  let jsonText: string | undefined;
  let file: string | undefined;
  let format: GenerationReviewDeliveryCliFormat = "json";
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
      if (value !== "json" && value !== "markdown" && value !== "both") throw new Error("--format must be json, markdown, or both");
      format = value;
      index += 1;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  if (jsonText !== undefined && file !== undefined) throw new Error("exactly one of --json or --file is allowed");
  if (jsonText === undefined && file === undefined) throw new Error("exactly one of --json or --file is required");
  return {
    source: jsonText === undefined ? { kind: "file", path: file as string } : { kind: "json-string", value: jsonText },
    format,
  };
}

export function parseGenerationReviewDeliveryInput(raw: string): GrowGenerationReviewDeliveryInput {
  const envelope = jsonEnvelope(raw);
  return {
    generationRun: envelope.generationRun as GrowGenerationReviewDeliveryInput["generationRun"],
    bindings: envelope.bindings as GrowGenerationReviewDeliveryInput["bindings"],
  };
}

export function buildGenerationReviewDeliveryFromJson(raw: string): GrowGenerationReviewDelivery {
  try {
    return buildGrowGenerationReviewDelivery(parseGenerationReviewDeliveryInput(raw));
  } catch (error) {
    if (error instanceof GenerationReviewDeliveryCliValidationError) throw error;
    fail(`generation review delivery: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function readGenerationReviewDeliveryInput(
  source: GenerationReviewDeliveryCliSource,
  io: Pick<GenerationReviewDeliveryCliIo, "readFile">,
): Promise<string> {
  if (source.kind === "json-string") return source.value;
  const value = await io.readFile(source.path);
  if (typeof value !== "string") fail("input file must contain text");
  return value;
}

export async function buildGenerationReviewDeliveryFromSource(
  source: GenerationReviewDeliveryCliSource,
  io: Pick<GenerationReviewDeliveryCliIo, "readFile">,
): Promise<GrowGenerationReviewDelivery> {
  return buildGenerationReviewDeliveryFromJson(await readGenerationReviewDeliveryInput(source, io));
}

export function renderGenerationReviewDeliveryJson(value: GrowGenerationReviewDelivery): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function markdown(value: string): string {
  return value.replace(/`/g, "'").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function blockers(value: readonly string[]): string {
  return value.length ? value.map(markdown).join("; ") : "none";
}

export function renderGenerationReviewDeliveryMarkdown(value: GrowGenerationReviewDelivery): string {
  const lines = [
    "# Generation review delivery",
    "",
    `- Version: \`${markdown(value.version)}\``,
    `- Source reference: \`${markdown(value.sourceReference)}\``,
    `- Substance reference: \`${markdown(value.substanceReference)}\``,
    `- Overall readiness: ${value.readiness.status}`,
    `- Slot summary: ${value.summary.ready} ready, ${value.summary.blocked} blocked, ${value.summary.missingBindings} missing bindings`,
    "",
    "## Safety boundary",
    "",
    `- Body-free: ${value.bodyFree}`,
    `- Human approval required: ${value.humanApprovalRequired}`,
    `- Auto-approval: ${value.autoApproval}`,
    `- Auto-scheduling: ${value.autoScheduling}`,
    `- Auto-publishing: ${value.autoPublishing}`,
    `- Side effects: ${value.sideEffects}`,
    "",
    "## Per-artifact joins",
    "",
    "| Platform | Day index | Slot | Artifact reference | Review queue reference | Review bundle | Delivery status | Readiness | Blockers |",
    "|---|---:|---:|---|---|---|---|---|---|",
    ...value.rows.map((row) => [
      markdown(row.slot.platform),
      String(row.slot.dayIndex),
      String(row.slot.slotIndex),
      markdown(row.generatedArtifactRef ?? "none"),
      markdown(row.reviewQueueRef ?? "none"),
      markdown(row.reviewBundleId ?? "none"),
      row.deliveryBinding.status,
      row.readiness.status,
      blockers(row.readiness.blockers),
    ].map(markdown).join(" | ").replace(/^/, "| ").concat(" |")),
  ];
  return `${lines.join("\n")}\n`;
}

export function renderGenerationReviewDelivery(value: GrowGenerationReviewDelivery, format: GenerationReviewDeliveryCliFormat): string {
  if (format === "json") return renderGenerationReviewDeliveryJson(value);
  if (format === "markdown") return renderGenerationReviewDeliveryMarkdown(value);
  return `${renderGenerationReviewDeliveryJson(value)}\n${renderGenerationReviewDeliveryMarkdown(value)}`;
}

const defaultIo: GenerationReviewDeliveryCliIo = {
  readFile: (path) => readFile(path, "utf8"),
  write: (value) => { process.stdout.write(value); },
  error: (value) => { process.stderr.write(value); },
};

export async function main(
  argv: readonly string[] = process.argv.slice(2),
  io: Partial<GenerationReviewDeliveryCliIo> = {},
): Promise<number> {
  const effectiveIo = { ...defaultIo, ...io };
  try {
    const options = parseGenerationReviewDeliveryArgs(argv);
    const value = await buildGenerationReviewDeliveryFromSource(options.source, effectiveIo);
    await effectiveIo.write(renderGenerationReviewDelivery(value, options.format));
    return 0;
  } catch (error) {
    await effectiveIo.error?.(`grow:generation-review-delivery: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((exitCode) => { process.exitCode = exitCode; });
}
