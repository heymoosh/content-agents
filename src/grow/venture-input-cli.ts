import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
  assessVentureInputReadiness,
  createVentureInputPointer,
  type VentureInputReadiness,
  type VentureInputStatus,
} from "./venture-input.js";

export const VENTURE_INPUT_CLI_VERSION = "venture-input-cli-v1" as const;

export interface VentureInputCliIo {
  readonly readFile: (path: string) => string | Promise<string>;
  readonly write: (value: string) => void | Promise<void>;
  readonly error?: (value: string) => void | Promise<void>;
}

export type VentureInputCliSource =
  | { readonly kind: "json-string"; readonly value: string }
  | { readonly kind: "file"; readonly path: string };

export type VentureInputCliFormat = "json" | "markdown" | "both";

export interface VentureInputCliOptions {
  readonly source: VentureInputCliSource;
  readonly format: VentureInputCliFormat;
}

export class VentureInputCliValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VentureInputCliValidationError";
  }
}

function fail(message: string): never {
  throw new VentureInputCliValidationError(message);
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${field} must be a JSON object`);
  return value as Record<string, unknown>;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    fail("input must be valid JSON");
  }
}

function pointerEnvelope(raw: string): unknown {
  const parsed = parseJson(raw);
  const source = record(parsed, "input");
  if (Object.hasOwn(source, "pointer")) {
    const keys = Object.keys(source);
    if (keys.length !== 1) fail("input envelope may contain only pointer");
    return source.pointer;
  }
  return source;
}

export function buildVentureInputReadinessFromJson(raw: string): VentureInputReadiness {
  return assessVentureInputReadiness(createVentureInputPointer(pointerEnvelope(raw)));
}

export function renderVentureInputJson(readiness: VentureInputReadiness): string {
  return `${JSON.stringify({
    version: VENTURE_INPUT_CLI_VERSION,
    ...readiness,
  }, null, 2)}\n`;
}

function cell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function list(values: readonly string[]): string {
  return values.length ? values.map(cell).join(", ") : "none recorded";
}

function statusLabel(status: VentureInputStatus): string {
  return status;
}

export function renderVentureInputMarkdown(readiness: VentureInputReadiness): string {
  const pointer = readiness.pointer;
  const decision = readiness.ventureDecision ? `${readiness.ventureDecision.outcome} (${readiness.ventureDecision.factRef})` : "null";
  const lines = [
    "# Venture input readiness",
    "",
    `Input: ${cell(pointer.id)}`,
    `Venture: ${cell(pointer.ventureId)}`,
    `Phase: ${pointer.phase}`,
    `Input kind: ${cell(pointer.inputKind)}`,
    `Status: ${statusLabel(readiness.status)}`,
    `Ready: ${readiness.ready ? "yes" : "no"}`,
    `Blockers: ${readiness.blockers.length ? readiness.blockers.map(cell).join("; ") : "none"}`,
    "",
    "## Decisions",
    "",
    `Content approval: ${readiness.contentApproval}`,
    `Venture decision: ${cell(decision)}`,
    `Venture gate: ${pointer.ventureGate.status}`,
    "",
    "## Evidence boundary",
    "",
    `Source records: ${list(pointer.sourceRecordRefs)}`,
    `Evidence refs: ${list(pointer.evidenceRefs)}`,
    `Content item refs: ${list(pointer.contentItemRefs)}`,
    `Scope: ${cell(pointer.scope)}`,
    `Sample size: ${pointer.sampleSize}`,
    `Provenance: ${cell(pointer.provenance)}`,
    `Caveats: ${list(pointer.caveats)}`,
    `Lineage: exact (${cell(pointer.lineage.pointerId)})`,
    "",
    "## Safety boundary",
    "",
    "- Owner: Content",
    "- Append-only: yes",
    "- Body-free: yes",
    "- Read-only: yes",
    "- Side effects: none",
    "- Creates artifacts: no",
    "- Unlocks a phase: no",
    "- Approves publishing: no",
    "- Changes strategy: no",
  ];
  return `${lines.join("\n")}\n`;
}

export function renderVentureInputReadiness(
  readiness: VentureInputReadiness,
  format: VentureInputCliFormat,
): string {
  if (format === "json") return renderVentureInputJson(readiness);
  if (format === "markdown") return renderVentureInputMarkdown(readiness);
  return `${renderVentureInputJson(readiness)}\n${renderVentureInputMarkdown(readiness)}`;
}

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value`);
  return value;
}

export function parseVentureInputArgs(argv: readonly string[]): VentureInputCliOptions {
  let jsonText: string | undefined;
  let file: string | undefined;
  let format: VentureInputCliFormat = "json";
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") {
      jsonText = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--file") {
      file = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--format") {
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
    source: jsonText === undefined ? { kind: "file", path: file as string } : { kind: "json-string", value: jsonText },
    format,
  };
}

const defaultIo: VentureInputCliIo = {
  readFile: (path) => readFile(path, "utf8"),
  write: (value) => { process.stdout.write(value); },
  error: (value) => { process.stderr.write(value); },
};

/** CLI entry point. It reads an optional source and writes only the rendered report. */
export async function main(
  argv: readonly string[] = process.argv.slice(2),
  io: Partial<VentureInputCliIo> = {},
): Promise<number> {
  const effectiveIo = { ...defaultIo, ...io };
  try {
    const options = parseVentureInputArgs(argv);
    const raw = options.source.kind === "json-string"
      ? options.source.value
      : await effectiveIo.readFile(options.source.path);
    if (typeof raw !== "string") fail("input file must contain text");
    const readiness = buildVentureInputReadinessFromJson(raw);
    await effectiveIo.write(renderVentureInputReadiness(readiness, options.format));
    return 0;
  } catch (error) {
    await effectiveIo.error?.(`grow:venture-input: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((exitCode) => { process.exitCode = exitCode; });
}
