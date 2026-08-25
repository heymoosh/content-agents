import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  buildReviewStaging,
  assertReviewStagingBodyFree,
  renderReviewStagingJson,
  renderReviewStagingMarkdown,
  type ReviewStagingArtifact,
  type ReviewStagingInput,
} from "./review-staging.js";

export type ReviewStagingCliFormat = "json" | "markdown" | "both";
export type ReviewStagingCliSource = { readonly kind: "json"; readonly value: string } | { readonly kind: "file"; readonly path: string };
export interface ReviewStagingCliOptions { readonly source: ReviewStagingCliSource; readonly format: ReviewStagingCliFormat }

export class ReviewStagingCliValidationError extends Error {
  constructor(message: string) { super(message); this.name = "ReviewStagingCliValidationError"; }
}

function fail(message: string): never { throw new ReviewStagingCliValidationError(message); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) fail(`${option} requires a value`);
  return value;
}

/** Parse an explicit review-status projection without reading a data or content path. */
export function parseReviewStagingInput(raw: string): ReviewStagingArtifact {
  let value: unknown;
  try { value = JSON.parse(raw) as unknown; } catch { fail("input must be valid JSON"); }
  if (!isRecord(value)) fail("input must be a review-status projection object");
  assertReviewStagingBodyFree(value);
  const source = isRecord(value.source)
    ? value.source
    : isRecord(value.sourceProjection)
      ? value.sourceProjection
      : value;
  if (!Array.isArray(value.accountMetadataRows)) fail("input.accountMetadataRows must be an array");
  const input: ReviewStagingInput = {
    accountMetadataRows: value.accountMetadataRows,
    sourceCommit: typeof source.sourceCommit === "string" ? source.sourceCommit : undefined,
    selectionRule: typeof source.selectionRule === "string" ? source.selectionRule : undefined,
    cohortSize: typeof source.cohortSize === "number" ? source.cohortSize : undefined,
    cohortDigest: typeof source.cohortDigest === "string" ? source.cohortDigest : undefined,
  };
  return buildReviewStaging(input);
}

export function renderReviewStaging(artifact: ReviewStagingArtifact, format: ReviewStagingCliFormat): string {
  if (format === "json") return renderReviewStagingJson(artifact);
  if (format === "markdown") return renderReviewStagingMarkdown(artifact);
  return `${renderReviewStagingJson(artifact)}\n${renderReviewStagingMarkdown(artifact)}`;
}

export function parseReviewStagingArgs(argv: readonly string[]): ReviewStagingCliOptions {
  let source: ReviewStagingCliSource | undefined;
  let format: ReviewStagingCliFormat = "json";
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
    const options = parseReviewStagingArgs(argv);
    const raw = options.source.kind === "json" ? options.source.value : readFileSync(options.source.path, "utf8");
    const output = renderReviewStaging(parseReviewStagingInput(raw), options.format);
    (io.write ?? ((value: string) => process.stdout.write(value)))(output);
    return 0;
  } catch (error) {
    (io.error ?? ((value: string) => process.stderr.write(value)))(`patterns:review-staging: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
