import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  buildReviewSession,
  renderReviewSessionJson,
  renderReviewSessionMarkdown,
  type ReviewSessionArtifact,
  type ReviewSessionInput,
} from "./review-session.js";
import { ACCOUNT_REVIEW_BATCH_VERSION, type ReviewQueueBatchArtifact } from "./review-batch.js";

export const REVIEW_SESSION_CLI_VERSION = "review-session-cli-v1" as const;
export type ReviewSessionCliFormat = "json" | "markdown" | "both";
export type ReviewSessionCliSource = { readonly kind: "json"; readonly value: string } | { readonly kind: "file"; readonly path: string };
export interface ReviewSessionCliOptions { readonly source: ReviewSessionCliSource; readonly format: ReviewSessionCliFormat }

export class ReviewSessionCliValidationError extends Error {
  constructor(message: string) { super(message); this.name = "ReviewSessionCliValidationError"; }
}

function fail(message: string): never { throw new ReviewSessionCliValidationError(message); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) fail(`${option} requires a value`);
  return value;
}

function nonNegativeInteger(value: unknown, field: string): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) fail(`${field} must be a non-negative integer`);
}

function validateReviewInput(value: unknown): ReviewSessionInput["reviewInput"] {
  if (value === undefined || value === null) return value ?? null;
  if (!isRecord(value)) fail("reviewInput must be an object or null");
  if (typeof value.supplied !== "boolean") fail("reviewInput.supplied must be boolean");
  if (value.status !== "not_supplied" && value.status !== "valid" && value.status !== "invalid") fail("reviewInput.status is invalid");
  if (value.reviewStatus !== "unreviewed" && value.reviewStatus !== "reviewed") fail("reviewInput.reviewStatus is invalid");
  nonNegativeInteger(value.rowCount, "reviewInput.rowCount");
  nonNegativeInteger(value.validRowCount, "reviewInput.validRowCount");
  nonNegativeInteger(value.invalidRowCount, "reviewInput.invalidRowCount");
  if (!Array.isArray(value.validationErrors) || value.validationErrors.some((error) => typeof error !== "string")) fail("reviewInput.validationErrors must be an array of strings");
  return value as unknown as ReviewSessionInput["reviewInput"];
}

function validateBatch(value: unknown): ReviewQueueBatchArtifact {
  if (!isRecord(value) || value.kind !== "account_review_queue_batch" || value.version !== ACCOUNT_REVIEW_BATCH_VERSION || !Array.isArray(value.rows)) {
    fail("batch must be an account_review_queue_batch artifact");
  }
  if (typeof value.humanReviewRequiredRows !== "number" || !Number.isInteger(value.humanReviewRequiredRows) || value.humanReviewRequiredRows < 0) fail("batch.humanReviewRequiredRows must be a non-negative integer");
  for (const [index, row] of value.rows.entries()) {
    if (!isRecord(row)) fail(`batch.rows[${index}] must be an object`);
    if (typeof row.currentAccountKey !== "string" || row.currentAccountKey.trim() === "") fail(`batch.rows[${index}].currentAccountKey must be a non-empty string`);
    if (typeof row.platform !== "string" || row.platform.trim() === "") fail(`batch.rows[${index}].platform must be a non-empty string`);
    if (row.handle !== null && typeof row.handle !== "string") fail(`batch.rows[${index}].handle must be a string or null`);
    if (row.status !== "reviewed" && row.status !== "pending" && row.status !== "blocked" && row.status !== "unmapped") fail(`batch.rows[${index}].status is invalid`);
    nonNegativeInteger(row.evidenceCount, `batch.rows[${index}].evidenceCount`);
    if (!Array.isArray(row.missingRequiredOverlayFields) || row.missingRequiredOverlayFields.some((field) => typeof field !== "string")) fail(`batch.rows[${index}].missingRequiredOverlayFields must be an array of strings`);
    if (typeof row.nextReviewAction !== "string" || row.nextReviewAction.trim() === "") fail(`batch.rows[${index}].nextReviewAction must be a non-empty string`);
  }
  return value as unknown as ReviewQueueBatchArtifact;
}

function validateDataStatus(value: unknown): ReviewSessionInput["dataStatus"] {
  if (value === undefined || value === null) return value ?? null;
  if (!isRecord(value) || typeof value.reviewStatus !== "string" || typeof value.reviewBoundary !== "string") fail("dataStatus must contain reviewStatus and reviewBoundary strings");
  return value as unknown as ReviewSessionInput["dataStatus"];
}

function validateInput(value: unknown): ReviewSessionInput {
  if (!isRecord(value)) fail("input must be an object with a batch");
  return { batch: validateBatch(value.batch), reviewInput: validateReviewInput(value.reviewInput), dataStatus: validateDataStatus(value.dataStatus) };
}

export function parseReviewSessionInput(raw: string): ReviewSessionArtifact {
  let value: unknown;
  try { value = JSON.parse(raw) as unknown; } catch { fail("input must be valid JSON"); }
  return buildReviewSession(validateInput(value));
}

export function renderReviewSession(session: ReviewSessionArtifact, format: ReviewSessionCliFormat): string {
  if (format === "json") return renderReviewSessionJson(session);
  if (format === "markdown") return renderReviewSessionMarkdown(session);
  return `${renderReviewSessionJson(session)}\n${renderReviewSessionMarkdown(session)}`;
}

export function parseReviewSessionArgs(argv: readonly string[]): ReviewSessionCliOptions {
  let source: ReviewSessionCliSource | undefined;
  let format: ReviewSessionCliFormat = "json";
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
    const options = parseReviewSessionArgs(argv);
    const raw = options.source.kind === "json" ? options.source.value : readFileSync(options.source.path, "utf8");
    const output = renderReviewSession(parseReviewSessionInput(raw), options.format);
    (io.write ?? ((value: string) => process.stdout.write(value)))(output);
    return 0;
  } catch (error) {
    (io.error ?? ((value: string) => process.stderr.write(value)))(`patterns:review-session: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
