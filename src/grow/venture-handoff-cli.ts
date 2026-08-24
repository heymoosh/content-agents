import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import type { BlueprintLearningPacket } from "../review/learning-packet.js";
import type { CommentLearningView } from "./comment-learning.js";
import type { LearningBundle } from "./learning-bundle.js";
import {
  buildVentureHandoffView,
  type VentureHandoffView,
} from "./venture-handoff.js";

export const VENTURE_HANDOFF_CLI_VERSION = "grow-venture-handoff-cli-v1" as const;
export type VentureHandoffCliFormat = "json" | "markdown" | "both";
export type VentureHandoffCliSource = { readonly kind: "json"; readonly value: string } | { readonly kind: "file"; readonly path: string };
export interface VentureHandoffCliOptions { readonly source: VentureHandoffCliSource; readonly format: VentureHandoffCliFormat }

export class VentureHandoffCliValidationError extends Error {
  constructor(message: string) { super(message); this.name = "VentureHandoffCliValidationError"; }
}

function fail(message: string): never { throw new VentureHandoffCliValidationError(message); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) fail(`${option} requires a value`);
  return value;
}
function requiredObject(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value)) fail(`${field} must be an object`);
  return value;
}

/** Parse pre-built, body-free handoff inputs; builders remain the source of readiness truth. */
export function parseVentureHandoffInput(raw: string): {
  readonly packet: BlueprintLearningPacket;
  readonly learningView: CommentLearningView;
  readonly learningBundle?: LearningBundle | null;
  readonly proposalId?: string | null;
} {
  let parsed: unknown;
  try { parsed = JSON.parse(raw) as unknown; } catch { fail("input must be valid JSON"); }
  const envelope = requiredObject(parsed, "input");
  const packet = requiredObject(envelope.packet, "packet");
  const learningView = requiredObject(envelope.learningView, "learningView");
  if (learningView.kind !== "grow_comment_learning_view") fail("learningView.kind must be grow_comment_learning_view");
  const hasBundle = Object.hasOwn(envelope, "learningBundle");
  const hasProposal = Object.hasOwn(envelope, "proposalId");
  if (hasBundle !== hasProposal) fail("learningBundle and proposalId must be supplied together");
  if (hasBundle) {
    const bundle = requiredObject(envelope.learningBundle, "learningBundle");
    if (bundle.kind !== "grow_learning_bundle") fail("learningBundle.kind must be grow_learning_bundle");
    if (typeof envelope.proposalId !== "string" || envelope.proposalId.trim() === "") fail("proposalId must be a non-empty string");
    return { packet: packet as unknown as BlueprintLearningPacket, learningView: learningView as unknown as CommentLearningView, learningBundle: bundle as unknown as LearningBundle, proposalId: envelope.proposalId.trim() };
  }
  return { packet: packet as unknown as BlueprintLearningPacket, learningView: learningView as unknown as CommentLearningView };
}

export function renderVentureHandoffJson(view: VentureHandoffView): string { return `${JSON.stringify(view, null, 2)}\n`; }

function cell(value: string): string { return value.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim(); }

export function renderVentureHandoffMarkdown(view: VentureHandoffView): string {
  const lines = [
    "# Venture handoff", "",
    `Overall: ${view.readiness.status}`,
    `Muxin decision: ${view.muxinDecision}; Venture gate: ${view.ventureGate}; proposal: ${view.proposalId ?? "none"}`,
    `Blockers: ${view.readiness.blockers.length ? view.readiness.blockers.map(cell).join("; ") : "none"}`,
    "",
    "| Family | Hypotheses | Qualified |",
    "| --- | ---: | ---: |",
    `| comment | ${view.families.comment.length} | ${view.families.comment.filter((item) => item.qualification === "qualified").length} |`,
    `| funnel | ${view.families.funnel.length} | ${view.families.funnel.filter((item) => item.qualification === "qualified").length} |`,
    `| business | ${view.families.business.length} | ${view.families.business.filter((item) => item.qualification === "qualified").length} |`,
    "",
    `Selected proposal: ${view.selectedProposal?.id ?? "none"}`,
    `Feed context: ${view.selectedProposal?.feedContextIds.join(", ") || "none"}`,
    "",
    "No Venture artifact, demand claim, reply, or publish side effect is created by this view.",
  ];
  return `${lines.join("\n")}\n`;
}

export function renderVentureHandoff(view: VentureHandoffView, format: VentureHandoffCliFormat): string {
  if (format === "json") return renderVentureHandoffJson(view);
  if (format === "markdown") return renderVentureHandoffMarkdown(view);
  return `${renderVentureHandoffJson(view)}\n${renderVentureHandoffMarkdown(view)}`;
}

export function parseVentureHandoffArgs(argv: readonly string[]): VentureHandoffCliOptions {
  let source: VentureHandoffCliSource | undefined;
  let format: VentureHandoffCliFormat = "json";
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") {
      if (source) fail("exactly one of --json or --input is allowed");
      source = { kind: "json", value: optionValue(argv, index, argument) }; index += 1;
    } else if (argument === "--input" || argument === "--file") {
      if (source) fail("exactly one of --json or --input is allowed");
      source = { kind: "file", path: optionValue(argv, index, argument) }; index += 1;
    } else if (argument === "--format") {
      const value = optionValue(argv, index, argument);
      if (value !== "json" && value !== "markdown" && value !== "both") fail("--format must be json, markdown, or both");
      format = value; index += 1;
    } else fail(`unknown argument: ${argument}`);
  }
  if (!source) fail("one of --json or --input is required");
  return { source, format };
}

export function main(argv: readonly string[] = process.argv.slice(2), io: { write?: (value: string) => void; error?: (value: string) => void } = {}): number {
  try {
    const options = parseVentureHandoffArgs(argv);
    const raw = options.source.kind === "json" ? options.source.value : readFileSync(options.source.path, "utf8");
    const input = parseVentureHandoffInput(raw);
    (io.write ?? ((value: string) => process.stdout.write(value)))(renderVentureHandoff(buildVentureHandoffView(input), options.format));
    return 0;
  } catch (error) {
    (io.error ?? ((value: string) => process.stderr.write(value)))(`grow:venture-handoff: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
