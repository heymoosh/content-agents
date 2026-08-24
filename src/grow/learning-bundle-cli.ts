import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import type { BlueprintLineage } from "../review/learning-packet.js";
import type { SourceEvidenceRow } from "../patterns/source-evidence.js";
import {
  buildLearningBundle,
  renderLearningBundleJson,
  renderLearningBundleMarkdown,
  type LearningBundle,
  type LearningBundleInput,
  type LearningBundleProposalInput,
} from "./learning-bundle.js";
import type { CommentLearningView } from "./comment-learning.js";

export const LEARNING_BUNDLE_CLI_VERSION = "grow-learning-bundle-cli-v1" as const;
export type LearningBundleCliFormat = "json" | "markdown" | "both";
export type LearningBundleCliSource = { readonly kind: "json"; readonly value: string } | { readonly kind: "file"; readonly path: string };
export interface LearningBundleCliOptions { readonly source: LearningBundleCliSource; readonly format: LearningBundleCliFormat }

export class LearningBundleCliValidationError extends Error {
  constructor(message: string) { super(message); this.name = "LearningBundleCliValidationError"; }
}

function fail(message: string): never { throw new LearningBundleCliValidationError(message); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function requiredArray(source: Record<string, unknown>, field: string): unknown[] {
  if (!Array.isArray(source[field])) fail(`${field} must be an array`);
  return source[field];
}
function requiredObject(source: Record<string, unknown>, field: string): Record<string, unknown> {
  if (!isRecord(source[field])) fail(`${field} must be an object`);
  return source[field];
}
function requiredString(source: Record<string, unknown>, key: string, label = key): string {
  if (typeof source[key] !== "string" || source[key].trim() === "") fail(`${label} must be a non-empty string`);
  return source[key] as string;
}
function requiredBoolean(source: Record<string, unknown>, field: string, expected: boolean): void {
  if (source[field] !== expected) fail(`${field} must be ${expected}`);
}
function validateLineage(value: unknown, field: string): void {
  if (!isRecord(value)) fail(`${field} must be an object`);
  requiredString(value, "sourceId", `${field}.sourceId`);
  requiredString(value, "variantId", `${field}.variantId`);
  requiredString(value, "experimentId", `${field}.experimentId`);
}
function validateLearningView(value: unknown): CommentLearningView {
  const view = requiredObject({ view: value }, "view");
  if (view.kind !== "grow_comment_learning_view") fail("learningView.kind must be grow_comment_learning_view");
  if (view.version !== "grow-comment-learning-v1") fail("learningView.version must be grow-comment-learning-v1");
  if (!Array.isArray(view.hypotheses)) fail("learningView.hypotheses must be an array");
  if (view.muxinDecision !== "pending" && view.muxinDecision !== "adopted" && view.muxinDecision !== "declined") fail("learningView.muxinDecision is invalid");
  requiredObject(view, "readiness");
  requiredBoolean(view, "autoClaimsDemand", false);
  requiredBoolean(view, "ventureArtifacts", false);
  if (view.sideEffects !== "none") fail("learningView.sideEffects must be none");
  view.hypotheses.forEach((item, index) => {
    const hypothesis = requiredObject({ [`hypotheses[${index}]`]: item }, `hypotheses[${index}]`);
    requiredString(hypothesis, "id");
    validateLineage(hypothesis.lineage, `hypotheses[${index}].lineage`);
    if (!Array.isArray(hypothesis.evidenceRefs)) fail(`hypotheses[${index}].evidenceRefs must be an array`);
  });
  return view as unknown as CommentLearningView;
}
function validateProposal(value: unknown, index: number): LearningBundleProposalInput {
  const field = `proposals[${index}]`;
  const proposal = requiredObject({ [field]: value }, field);
  for (const key of ["id", "statement", "scope"] as const) requiredString(proposal, key, `${field}.${key}`);
  if (proposal.type !== "product" && proposal.type !== "lead") fail(`${field}.type must be product or lead`);
  if (proposal.qualification !== "hypothesis" && proposal.qualification !== "qualified") fail(`${field}.qualification is invalid`);
  if (proposal.muxinDecision !== "pending" && proposal.muxinDecision !== "adopted" && proposal.muxinDecision !== "declined") fail(`${field}.muxinDecision is invalid`);
  if (!Array.isArray(proposal.basisRecordIds)) fail(`${field}.basisRecordIds must be an array`);
  if (!Array.isArray(proposal.feedContextIds)) fail(`${field}.feedContextIds must be an array`);
  if (!Array.isArray(proposal.caveats)) fail(`${field}.caveats must be an array`);
  if (!Number.isInteger(proposal.sampleSize) || (proposal.sampleSize as number) < 1) fail(`${field}.sampleSize must be a positive integer`);
  validateLineage(proposal.lineage, `${field}.lineage`);
  return proposal as unknown as LearningBundleProposalInput;
}
function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) fail(`${option} requires a value`);
  return value;
}

/** Parse only the explicit, body-free learning-bundle envelope. */
export function parseLearningBundleInput(raw: string): LearningBundleInput {
  let value: unknown;
  try { value = JSON.parse(raw) as unknown; } catch { fail("input must be valid JSON"); }
  if (!isRecord(value)) fail("input must be an object envelope");
  const lineageObject = requiredObject(value, "lineage");
  validateLineage(lineageObject, "lineage");
  const lineage = lineageObject as unknown as BlueprintLineage;
  const learningView = validateLearningView(value.learningView);
  const feedEvidence = requiredArray(value, "feedEvidence").map((item, index) => {
    if (!isRecord(item)) fail(`feedEvidence[${index}] must be an object`);
    return item as unknown as SourceEvidenceRow;
  });
  const proposals = requiredArray(value, "proposals").map(validateProposal);
  return {
    lineage,
    learningView,
    feedEvidence,
    proposals,
  };
}

export function renderLearningBundle(bundle: LearningBundle, format: LearningBundleCliFormat): string {
  if (format === "json") return renderLearningBundleJson(bundle);
  if (format === "markdown") return renderLearningBundleMarkdown(bundle);
  return `${renderLearningBundleJson(bundle)}\n${renderLearningBundleMarkdown(bundle)}`;
}

export function parseLearningBundleArgs(argv: readonly string[]): LearningBundleCliOptions {
  let source: LearningBundleCliSource | undefined;
  let format: LearningBundleCliFormat = "json";
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
    const options = parseLearningBundleArgs(argv);
    const raw = options.source.kind === "json" ? options.source.value : readFileSync(options.source.path, "utf8");
    (io.write ?? ((value: string) => process.stdout.write(value)))(renderLearningBundle(buildLearningBundle(parseLearningBundleInput(raw)), options.format));
    return 0;
  } catch (error) {
    (io.error ?? ((value: string) => process.stderr.write(value)))(`grow:learning-bundle: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
