import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import {
  buildReviewQueueBatch,
  renderReviewQueueBatchJson,
  renderReviewQueueBatchMarkdown,
  type ReviewQueueBatchArtifact,
} from "./review-batch.js";
import type { ReviewQueueArtifact, ReviewQueueRow } from "./review-queue.js";

export const REVIEW_BATCH_CLI_VERSION = "account-review-batch-cli-v1" as const;

export interface ReviewBatchCliIo {
  readonly readFile: (path: string) => string | Promise<string>;
  readonly write: (value: string) => void | Promise<void>;
  readonly error?: (value: string) => void | Promise<void>;
}

export type ReviewBatchCliSource =
  | { readonly kind: "json-string"; readonly value: string }
  | { readonly kind: "file"; readonly path: string };

export type ReviewBatchCliFormat = "json" | "markdown" | "both";

export interface ReviewBatchCliPagination {
  readonly pageSize: number;
  readonly pageNumber: number;
}

export interface ReviewBatchCliOptions extends ReviewBatchCliPagination {
  readonly source: ReviewBatchCliSource;
  readonly format: ReviewBatchCliFormat;
}

export class ReviewBatchCliValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewBatchCliValidationError";
  }
}

/** Compatibility names for callers that use the full review-queue-batch term. */
export type ReviewQueueBatchCliIo = ReviewBatchCliIo;
export type ReviewBatchCliIO = ReviewBatchCliIo;
export type ReviewQueueBatchCliIO = ReviewBatchCliIo;
export type ReviewQueueBatchCliSource = ReviewBatchCliSource;
export type ReviewQueueBatchCliFormat = ReviewBatchCliFormat;
export type ReviewQueueBatchCliOptions = ReviewBatchCliOptions;

const REVIEW_QUEUE_KIND = "account_review_queue";
const REVIEW_QUEUE_VERSION = "account-review-queue-v1";
const REVIEW_QUEUE_SIDE_EFFECTS = "none";
const REVIEW_STATUSES = ["reviewed", "pending", "blocked", "unmapped"] as const;

type ReviewStatus = (typeof REVIEW_STATUSES)[number];

function fail(message: string): never {
  throw new ReviewBatchCliValidationError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function objectValue(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value)) fail(`${field} must be an object`);
  return value;
}

function requiredObject(source: Record<string, unknown>, field: string): Record<string, unknown> {
  if (!Object.hasOwn(source, field)) fail(`${field} is required`);
  return objectValue(source[field], field);
}

function requiredArray(source: Record<string, unknown>, field: string): unknown[] {
  const key = propertyName(field);
  if (!Object.hasOwn(source, key)) fail(`${field} is required`);
  if (!Array.isArray(source[key])) fail(`${field} must be an array`);
  return source[key];
}

function propertyName(field: string): string {
  const separator = field.lastIndexOf(".");
  return separator === -1 ? field : field.slice(separator + 1);
}

function requiredString(source: Record<string, unknown>, field: string): string {
  const key = propertyName(field);
  if (!Object.hasOwn(source, key)) fail(`${field} is required`);
  if (typeof source[key] !== "string") fail(`${field} must be a string`);
  return source[key];
}

function nullableString(source: Record<string, unknown>, field: string): string | null {
  const key = propertyName(field);
  if (!Object.hasOwn(source, key)) fail(`${field} is required`);
  if (source[key] !== null && typeof source[key] !== "string") fail(`${field} must be a string or null`);
  return source[key] as string | null;
}

function requiredBoolean(source: Record<string, unknown>, field: string): boolean {
  const key = propertyName(field);
  if (!Object.hasOwn(source, key)) fail(`${field} is required`);
  if (typeof source[key] !== "boolean") fail(`${field} must be a boolean`);
  return source[key];
}

function nonNegativeInteger(source: Record<string, unknown>, field: string): number {
  const key = propertyName(field);
  if (!Object.hasOwn(source, key)) fail(`${field} is required`);
  const value = source[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    fail(`${field} must be a non-negative integer`);
  }
  return value;
}

function stringArray(source: Record<string, unknown>, field: string): string[] {
  const values = requiredArray(source, field);
  return values.map((value, index) => {
    if (typeof value !== "string") fail(`${field}[${index}] must be a string`);
    return value;
  });
}

function status(source: Record<string, unknown>, field: string): ReviewStatus {
  const value = requiredString(source, field);
  if (!(REVIEW_STATUSES as readonly string[]).includes(value)) {
    fail(`${field} must be reviewed, pending, blocked, or unmapped`);
  }
  return value as ReviewStatus;
}

function normalizeQueueRow(value: unknown, index: number): ReviewQueueRow {
  const field = `rows[${index}]`;
  const source = objectValue(value, field);
  return {
    currentAccountKey: requiredString(source, `${field}.currentAccountKey`),
    platform: requiredString(source, `${field}.platform`),
    handle: nullableString(source, `${field}.handle`),
    creator: nullableString(source, `${field}.creator`),
    evidenceCount: nonNegativeInteger(source, `${field}.evidenceCount`),
    status: status(source, `${field}.status`),
    stableIdPresent: requiredBoolean(source, `${field}.stableIdPresent`),
    missingRequiredOverlayFields: stringArray(source, `${field}.missingRequiredOverlayFields`),
    comparisonEvidenceReady: requiredBoolean(source, `${field}.comparisonEvidenceReady`),
    nextReviewAction: requiredString(source, `${field}.nextReviewAction`),
  };
}

function normalizeReviewQueue(value: unknown): ReviewQueueArtifact {
  const source = objectValue(value, "queue");
  if (source.kind !== REVIEW_QUEUE_KIND) fail(`queue.kind must be ${REVIEW_QUEUE_KIND}`);
  if (source.version !== REVIEW_QUEUE_VERSION) fail(`queue.version must be ${REVIEW_QUEUE_VERSION}`);
  if (source.sideEffects !== REVIEW_QUEUE_SIDE_EFFECTS) fail("queue.sideEffects must be none");

  const rows = requiredArray(source, "rows").map(normalizeQueueRow);
  const summary = requiredObject(source, "summary");
  const statusCounts = requiredObject(summary, "statusCounts");
  const normalizedStatusCounts = {
    reviewed: nonNegativeInteger(statusCounts, "summary.statusCounts.reviewed"),
    pending: nonNegativeInteger(statusCounts, "summary.statusCounts.pending"),
    blocked: nonNegativeInteger(statusCounts, "summary.statusCounts.blocked"),
    unmapped: nonNegativeInteger(statusCounts, "summary.statusCounts.unmapped"),
  };
  const total = nonNegativeInteger(summary, "summary.total");
  const evidenceCount = nonNegativeInteger(summary, "summary.evidenceCount");
  const comparisonEvidenceReady = nonNegativeInteger(summary, "summary.comparisonEvidenceReady");

  if (total !== rows.length) fail("summary.total must equal rows.length");
  const rowStatusCounts = { reviewed: 0, pending: 0, blocked: 0, unmapped: 0 };
  let rowEvidenceCount = 0;
  let rowComparisonEvidenceReady = 0;
  for (const row of rows) {
    rowStatusCounts[row.status] += 1;
    rowEvidenceCount += row.evidenceCount;
    if (row.comparisonEvidenceReady) rowComparisonEvidenceReady += 1;
  }
  if (evidenceCount !== rowEvidenceCount) fail("summary.evidenceCount must equal row evidenceCount total");
  if (comparisonEvidenceReady !== rowComparisonEvidenceReady) fail("summary.comparisonEvidenceReady must equal ready row count");
  for (const reviewStatus of REVIEW_STATUSES) {
    if (normalizedStatusCounts[reviewStatus] !== rowStatusCounts[reviewStatus]) {
      fail(`summary.statusCounts.${reviewStatus} must match rows`);
    }
  }

  return {
    kind: REVIEW_QUEUE_KIND,
    version: REVIEW_QUEUE_VERSION,
    rows,
    summary: {
      total,
      evidenceCount,
      comparisonEvidenceReady,
      statusCounts: normalizedStatusCounts,
    },
    sideEffects: REVIEW_QUEUE_SIDE_EFFECTS,
  };
}

/** Parse and normalize the explicit, body-free account review queue artifact. */
export function loadReviewQueue(raw: string): ReviewQueueArtifact {
  if (typeof raw !== "string") fail("input must be text");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    fail("input must be valid JSON");
  }
  return normalizeReviewQueue(parsed);
}

export const parseReviewQueue = loadReviewQueue;

function positiveInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) fail(`${field} must be a positive integer`);
  return value;
}

function pagination(pageSizeOrPagination: number | ReviewBatchCliPagination, pageNumber?: number): ReviewBatchCliPagination {
  if (typeof pageSizeOrPagination === "number") {
    return {
      pageSize: positiveInteger(pageSizeOrPagination, "pageSize"),
      pageNumber: positiveInteger(pageNumber as number, "pageNumber"),
    };
  }
  return {
    pageSize: positiveInteger(pageSizeOrPagination.pageSize, "pageSize"),
    pageNumber: positiveInteger(pageSizeOrPagination.pageNumber, "pageNumber"),
  };
}

export function buildReviewQueueBatchFromJson(
  raw: string,
  pageSize: number,
  pageNumber: number,
): ReviewQueueBatchArtifact;
export function buildReviewQueueBatchFromJson(
  raw: string,
  input: ReviewBatchCliPagination,
): ReviewQueueBatchArtifact;
export function buildReviewQueueBatchFromJson(
  raw: string,
  pageSizeOrPagination: number | ReviewBatchCliPagination,
  pageNumber?: number,
): ReviewQueueBatchArtifact {
  const page = pagination(pageSizeOrPagination, pageNumber);
  return buildReviewQueueBatch({ queue: loadReviewQueue(raw), ...page });
}

export async function readReviewQueueSource(
  source: ReviewBatchCliSource,
  io: Pick<ReviewBatchCliIo, "readFile">,
): Promise<string> {
  if (source.kind === "json-string") return source.value;
  try {
    const value = await io.readFile(source.path);
    if (typeof value !== "string") fail("input file must contain text");
    return value;
  } catch (error) {
    if (error instanceof ReviewBatchCliValidationError) throw error;
    throw new ReviewBatchCliValidationError("input could not be read");
  }
}

export async function buildReviewQueueBatchFromSource(
  source: ReviewBatchCliSource,
  input: ReviewBatchCliPagination,
  io: Pick<ReviewBatchCliIo, "readFile">,
): Promise<ReviewQueueBatchArtifact> {
  return buildReviewQueueBatchFromJson(await readReviewQueueSource(source, io), input);
}

export { renderReviewQueueBatchJson, renderReviewQueueBatchMarkdown };

export function renderReviewQueueBatch(
  batch: ReviewQueueBatchArtifact,
  format: ReviewBatchCliFormat,
): string {
  if (format === "json") return renderReviewQueueBatchJson(batch);
  if (format === "markdown") return renderReviewQueueBatchMarkdown(batch);
  if (format === "both") return `${renderReviewQueueBatchJson(batch)}\n${renderReviewQueueBatchMarkdown(batch)}`;
  throw new ReviewBatchCliValidationError("--format must be json, markdown, or both");
}

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (value === undefined || value === "" || value.startsWith("--")) fail(`${option} requires a value`);
  return value;
}

function optionEquals(argument: string, option: string): string | undefined {
  if (!argument.startsWith(`${option}=`)) return undefined;
  const value = argument.slice(option.length + 1);
  if (value === "") fail(`${option} requires a value`);
  return value;
}

function cliPositiveInteger(value: string, option: string): number {
  if (!/^[1-9][0-9]*$/.test(value)) fail(`${option} must be a positive integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) fail(`${option} must be a positive integer`);
  return parsed;
}

function setSource(
  current: ReviewBatchCliSource | undefined,
  next: ReviewBatchCliSource,
): ReviewBatchCliSource {
  if (current !== undefined) fail("exactly one of --json or --input/--file is allowed");
  return next;
}

export function parseReviewBatchArgs(argv: readonly string[]): ReviewBatchCliOptions {
  let source: ReviewBatchCliSource | undefined;
  let pageSize: number | undefined;
  let pageNumber: number | undefined;
  let format: ReviewBatchCliFormat = "json";
  let formatSupplied = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") {
      source = setSource(source, { kind: "json-string", value: optionValue(argv, index, argument) });
      index += 1;
    } else if (argument.startsWith("--json=")) {
      source = setSource(source, { kind: "json-string", value: optionEquals(argument, "--json") as string });
    } else if (argument === "--input" || argument === "--file") {
      source = setSource(source, { kind: "file", path: optionValue(argv, index, argument) });
      index += 1;
    } else if (argument.startsWith("--input=") || argument.startsWith("--file=")) {
      const option = argument.startsWith("--input=") ? "--input" : "--file";
      source = setSource(source, { kind: "file", path: optionEquals(argument, option) as string });
    } else if (argument === "--page-size") {
      if (pageSize !== undefined) fail("--page-size may only be supplied once");
      pageSize = cliPositiveInteger(optionValue(argv, index, argument), "--page-size");
      index += 1;
    } else if (argument.startsWith("--page-size=")) {
      if (pageSize !== undefined) fail("--page-size may only be supplied once");
      pageSize = cliPositiveInteger(optionEquals(argument, "--page-size") as string, "--page-size");
    } else if (argument === "--page-number") {
      if (pageNumber !== undefined) fail("--page-number may only be supplied once");
      pageNumber = cliPositiveInteger(optionValue(argv, index, argument), "--page-number");
      index += 1;
    } else if (argument.startsWith("--page-number=")) {
      if (pageNumber !== undefined) fail("--page-number may only be supplied once");
      pageNumber = cliPositiveInteger(optionEquals(argument, "--page-number") as string, "--page-number");
    } else if (argument === "--format") {
      if (formatSupplied) fail("--format may only be supplied once");
      const value = optionValue(argv, index, argument);
      if (value !== "json" && value !== "markdown" && value !== "both") fail("--format must be json, markdown, or both");
      format = value;
      formatSupplied = true;
      index += 1;
    } else if (argument.startsWith("--format=")) {
      if (formatSupplied) fail("--format may only be supplied once");
      const value = optionEquals(argument, "--format");
      if (value !== "json" && value !== "markdown" && value !== "both") fail("--format must be json, markdown, or both");
      format = value;
      formatSupplied = true;
    } else {
      fail(`unknown argument: ${argument}`);
    }
  }

  if (source === undefined) fail("exactly one of --json or --input/--file is required");
  if (pageSize === undefined) fail("--page-size is required");
  if (pageNumber === undefined) fail("--page-number is required");
  return { source, pageSize, pageNumber, format };
}

const defaultIo: ReviewBatchCliIo = {
  readFile: (path) => readFile(path, "utf8"),
  write: (value) => { process.stdout.write(value); },
  error: (value) => { process.stderr.write(value); },
};

export async function main(
  argv: readonly string[] = process.argv.slice(2),
  io: Partial<ReviewBatchCliIo> = {},
): Promise<number> {
  const effectiveIo: ReviewBatchCliIo = {
    readFile: io.readFile ?? defaultIo.readFile,
    write: io.write ?? defaultIo.write,
    error: io.error ?? defaultIo.error,
  };
  try {
    const options = parseReviewBatchArgs(argv);
    const batch = await buildReviewQueueBatchFromSource(options.source, options, effectiveIo);
    await effectiveIo.write(renderReviewQueueBatch(batch, options.format));
    return 0;
  } catch (error) {
    await effectiveIo.error?.(`patterns:review-batch: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((exitCode) => { process.exitCode = exitCode; });
}
