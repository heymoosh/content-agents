import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
  createDraftRequest,
  DraftRequestValidationError,
  type DraftRequest,
  type DraftRequestInput,
} from "./draft-request.js";

export const DRAFT_REQUEST_CLI_VERSION = "grow-draft-request-cli-v1" as const;

export interface DraftRequestCliIo {
  readonly readFile: (path: string) => string | Promise<string>;
  readonly write: (value: string) => void | Promise<void>;
  readonly error?: (value: string) => void | Promise<void>;
}

export type DraftRequestCliSource =
  | { readonly kind: "json-string"; readonly value: string }
  | { readonly kind: "file"; readonly path: string };

export type DraftRequestCliFormat = "json" | "markdown" | "both";

export interface DraftRequestCliOptions {
  readonly source: DraftRequestCliSource;
  readonly format: DraftRequestCliFormat;
}

const INPUT_FIELDS = new Set([
  "id",
  "sourceThoughtRef",
  "sourceArtifactRef",
  "platform",
  "medium",
  "format",
  "treatmentRef",
  "hookTemplateRefs",
  "experimentRefs",
  "voicePolicyRef",
  "expectedOutputArtifactRef",
  "treatment",
  "lineage",
  "blockers",
  "humanReview",
]);

export class DraftRequestCliValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DraftRequestCliValidationError";
  }
}

function fail(message: string): never {
  throw new DraftRequestCliValidationError(message);
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(label + " must be an object");
  return value as Record<string, unknown>;
}

function assertAllowedFields(value: Record<string, unknown>, label: string): void {
  for (const field of Object.keys(value)) {
    if (!INPUT_FIELDS.has(field)) fail(label + " contains unsupported field \"" + field + "\"");
  }
}

function jsonInput(raw: string): DraftRequestInput {
  if (typeof raw !== "string") fail("input must contain text");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    fail("input must be valid JSON");
  }
  const source = object(parsed, "JSON object");
  assertAllowedFields(source, "JSON object");
  return source as unknown as DraftRequestInput;
}

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(option + " requires a value");
  return value;
}

export function parseDraftRequestArgs(argv: readonly string[]): DraftRequestCliOptions {
  let jsonText: string | undefined;
  let file: string | undefined;
  let format: DraftRequestCliFormat = "json";
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
      throw new Error("unknown argument: " + argument);
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

export function buildDraftRequestFromJson(raw: string): DraftRequest {
  try {
    return createDraftRequest(jsonInput(raw));
  } catch (error) {
    if (error instanceof DraftRequestCliValidationError) throw error;
    if (error instanceof DraftRequestValidationError) fail("draft request: " + error.message);
    fail("draft request: " + (error instanceof Error ? error.message : String(error)));
  }
}

export async function readDraftRequestSource(
  source: DraftRequestCliSource,
  io: Pick<DraftRequestCliIo, "readFile">,
): Promise<string> {
  if (source.kind === "json-string") return source.value;
  const value = await io.readFile(source.path);
  if (typeof value !== "string") fail("input file must contain text");
  return value;
}

export async function buildDraftRequestFromSource(
  source: DraftRequestCliSource,
  io: Pick<DraftRequestCliIo, "readFile">,
): Promise<DraftRequest> {
  return buildDraftRequestFromJson(await readDraftRequestSource(source, io));
}

export function renderDraftRequestJson(request: DraftRequest): string {
  return JSON.stringify(request, null, 2) + "\n";
}

function markdownText(value: string): string {
  return value.split(String.fromCharCode(96)).join("'").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function refsText(refs: readonly string[]): string {
  return refs.length ? refs.map(markdownText).join(", ") : "none";
}

function blockersText(blockers: readonly string[]): string {
  return blockers.length ? blockers.map(markdownText).join("; ") : "none";
}

export function renderDraftRequestMarkdown(request: DraftRequest): string {
  const lines = [
    "# Draft request",
    "",
    "- Version: " + markdownText(request.version),
    "- ID: " + markdownText(request.id),
    "- Source thought reference: " + markdownText(request.sourceThoughtRef),
    "- Source artifact reference: " + markdownText(request.sourceArtifactRef),
    "- Expected output artifact reference: " + markdownText(request.expectedOutputArtifactRef),
    "- Human review: " + request.humanReview.status,
    "- Readiness: " + request.readiness.status,
    "- Blockers: " + blockersText(request.blockers),
    "",
    "## Treatment identity",
    "",
    "| Platform | Medium | Format | Treatment reference | Hook templates | Experiments | Voice policy |",
    "|---|---|---|---|---|---|---|",
    "| " + [
      markdownText(request.platform),
      markdownText(request.medium),
      markdownText(request.format),
      markdownText(request.treatmentRef),
      refsText(request.hookTemplateRefs),
      refsText(request.experimentRefs),
      markdownText(request.voicePolicyRef),
    ].join(" | ") + " |",
    "",
    "## Lineage",
    "",
    "- Generation brief reference: " + markdownText(request.lineage.generationBriefRef),
    "- Volume plan reference: " + markdownText(request.lineage.volumePlanRef),
    "- Treatment coverage reference: " + markdownText(request.lineage.treatmentCoverageRef),
    "- Human review: " + request.humanReview.status + " before " + request.humanReview.before + " (owner: " + request.humanReview.approvalOwner + ")",
    "",
    "## Safety boundary",
    "",
    "- Generates copy: " + request.generatesCopy,
    "- Creator body copy allowed: " + request.creatorBodyCopyAllowed,
    "- Common hook mad-lib adaptation: " + request.modelBoundary.boundaries.commonHookMadLibAllowed,
    "- Model invocation: " + request.modelBoundary.modelInvocation,
    "- Side effects: " + request.sideEffects,
  ];
  return lines.join("\n") + "\n";
}

export function renderDraftRequest(request: DraftRequest, format: DraftRequestCliFormat): string {
  if (format === "json") return renderDraftRequestJson(request);
  if (format === "markdown") return renderDraftRequestMarkdown(request);
  return renderDraftRequestJson(request) + "\n" + renderDraftRequestMarkdown(request);
}

const defaultIo: DraftRequestCliIo = {
  readFile: (path) => readFile(path, "utf8"),
  write: (value) => { process.stdout.write(value); },
  error: (value) => { process.stderr.write(value); },
};

export async function main(
  argv: readonly string[] = process.argv.slice(2),
  io: Partial<DraftRequestCliIo> = {},
): Promise<number> {
  const effectiveIo = { ...defaultIo, ...io };
  try {
    const options = parseDraftRequestArgs(argv);
    const request = await buildDraftRequestFromSource(options.source, effectiveIo);
    await effectiveIo.write(renderDraftRequest(request, options.format));
    return 0;
  } catch (error) {
    await effectiveIo.error?.("grow:draft-request: " + (error instanceof Error ? error.message : String(error)) + "\n");
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((exitCode) => { process.exitCode = exitCode; });
}
