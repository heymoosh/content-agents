import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  buildSourceEvidence,
  type SourceEvidenceInventory,
  type SourceEvidenceRow,
} from "./source-evidence.js";

export const SOURCE_EVIDENCE_CLI_VERSION = "patterns-source-evidence-cli-v1" as const;

export type SourceEvidenceCliFormat = "json" | "markdown" | "both";

export type SourceEvidenceCliSource =
  | { readonly kind: "json-string"; readonly value: string }
  | { readonly kind: "file"; readonly path: string };

export interface SourceEvidenceCliOptions {
  readonly source: SourceEvidenceCliSource;
  readonly format: SourceEvidenceCliFormat;
}

export interface SourceEvidenceCliIo {
  readonly readFile: (path: string) => string;
  readonly write: (value: string) => void;
  readonly error?: (value: string) => void;
}

export class SourceEvidenceCliValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceEvidenceCliValidationError";
  }
}

function fail(message: string): never {
  throw new SourceEvidenceCliValidationError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value`);
  return value;
}

/** Parse arguments for exactly one explicit JSON string or JSON file. */
export function parseSourceEvidenceArgs(argv: readonly string[]): SourceEvidenceCliOptions {
  let inputPath: string | undefined;
  let jsonText: string | undefined;
  let format: SourceEvidenceCliFormat = "json";
  let formatSeen = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") {
      if (inputPath !== undefined || jsonText !== undefined) {
        throw new Error("exactly one of --json or --file/--input is allowed");
      }
      jsonText = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--file" || argument === "--input") {
      if (inputPath !== undefined || jsonText !== undefined) {
        throw new Error("exactly one of --json or --file/--input is allowed");
      }
      inputPath = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--format") {
      const value = optionValue(argv, index, argument);
      if (value !== "json" && value !== "markdown" && value !== "both") {
        throw new Error("--format must be json, markdown, or both");
      }
      if (formatSeen) throw new Error("--format may be supplied only once");
      format = value;
      formatSeen = true;
      index += 1;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }

  if (inputPath === undefined && jsonText === undefined) {
    throw new Error("exactly one of --json or --file/--input is required");
  }

  return {
    source: inputPath === undefined
      ? { kind: "json-string", value: jsonText as string }
      : { kind: "file", path: inputPath },
    format,
  };
}

/** Compatibility alias used by other pattern CLI adapters. */
export const parseArgs = parseSourceEvidenceArgs;

function validateRows(value: unknown, field: "corpus" | "analyses"): unknown[] {
  if (!Array.isArray(value)) fail(`${field} must be an array`);
  value.forEach((row, index) => {
    if (!isRecord(row)) fail(`${field}[${index}] must be an object`);
  });
  return value;
}

export interface SourceEvidenceInputEnvelope {
  readonly corpus: readonly unknown[];
  readonly analyses: readonly unknown[];
}

/** Strictly validate the explicit corpus/analyses JSON envelope without interpreting row data. */
export function loadSourceEvidenceInput(raw: string): SourceEvidenceInputEnvelope {
  if (typeof raw !== "string") fail("input must be JSON text");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    fail("input must be valid JSON");
  }

  if (!isRecord(parsed)) fail("input must be an object with corpus and analyses arrays");
  if (!Object.hasOwn(parsed, "corpus")) fail("input.corpus is required");
  if (!Object.hasOwn(parsed, "analyses")) fail("input.analyses is required");

  return {
    corpus: validateRows(parsed.corpus, "corpus"),
    analyses: validateRows(parsed.analyses, "analyses"),
  };
}

export const loadSourceEvidenceEnvelope = loadSourceEvidenceInput;
export const parseSourceEvidenceInput = loadSourceEvidenceInput;

/** Build the read-only inventory from the explicit JSON envelope. */
export function buildSourceEvidenceFromJson(raw: string): SourceEvidenceInventory {
  const input = loadSourceEvidenceInput(raw);
  return buildSourceEvidence([...input.corpus], [...input.analyses]);
}

export const buildSourceEvidenceCliFromJson = buildSourceEvidenceFromJson;
export const buildSourcePostEvidenceFromJson = buildSourceEvidenceFromJson;

function readSourceEvidenceSource(
  source: SourceEvidenceCliSource,
  io: Pick<SourceEvidenceCliIo, "readFile">,
): string {
  if (source.kind === "json-string") return source.value;
  try {
    const value = io.readFile(source.path);
    if (typeof value !== "string") throw new Error("not text");
    return value;
  } catch {
    fail("input could not be read");
  }
}

export const readSourceEvidenceRequest = readSourceEvidenceSource;

export function buildSourceEvidenceFromSource(
  source: SourceEvidenceCliSource,
  io: Pick<SourceEvidenceCliIo, "readFile">,
): SourceEvidenceInventory {
  return buildSourceEvidenceFromJson(readSourceEvidenceSource(source, io));
}

export const buildSourceEvidenceCliFromSource = buildSourceEvidenceFromSource;
export const buildSourcePostEvidenceFromSource = buildSourceEvidenceFromSource;

function safeRow(row: SourceEvidenceRow): SourceEvidenceRow {
  // Keep this projection explicit. The builder is body-free today, but the CLI must remain
  // body-free if a future caller attaches an accidental body, winner, or ranking property.
  return {
    id: row.id,
    sourceId: row.sourceId,
    postId: row.postId,
    accountId: row.accountId,
    platform: row.platform,
    medium: row.medium,
    format: row.format,
    pool: row.pool,
    membershipReason: row.membershipReason,
    audienceSizeSnapshot: row.audienceSizeSnapshot,
    metricSnapshot: row.metricSnapshot,
    popularityScope: row.popularityScope,
    sampleScope: row.sampleScope,
    baselineScope: row.baselineScope,
    evidenceLinks: row.evidenceLinks,
    baselineSource: row.baselineSource,
    bodyComplete: row.bodyComplete,
    caveats: row.caveats,
    provenance: row.provenance,
    observedAt: row.observedAt,
    collectedAt: row.collectedAt,
    reviewStatus: row.reviewStatus,
    status: row.status,
    lineage: row.lineage,
    handle: row.handle,
    creator: row.creator,
    url: row.url,
    sourceRole: row.sourceRole,
    listing: row.listing,
    window: row.window,
    rank: row.rank,
    evidenceLocation: row.evidenceLocation,
    metric: row.metric,
    selectionRule: row.selectionRule,
    readiness: {
      status: row.readiness.status,
      reason: row.readiness.reason,
      blockingFields: [...row.readiness.blockingFields],
    },
  };
}

function safeInventory(inventory: SourceEvidenceInventory): SourceEvidenceInventory {
  return {
    rows: inventory.rows.map(safeRow),
    summary: {
      ready: inventory.summary.ready,
      blocked: inventory.summary.blocked,
      pools: {
        niche: inventory.summary.pools.niche,
        broad: inventory.summary.pools.broad,
        format: inventory.summary.pools.format,
      },
    },
  };
}

export function renderSourceEvidenceJson(inventory: SourceEvidenceInventory): string {
  return `${JSON.stringify(safeInventory(inventory), null, 2)}\n`;
}

function markdownText(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (value === "unknown") return "unknown";
  return String(value)
    .replace(/`/g, "'")
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|")
    .replace(/\s+/g, " ")
    .trim();
}

function markdownJson(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (value === "unknown") return "unknown";
  return markdownText(JSON.stringify(value));
}

function metricText(row: SourceEvidenceRow): string {
  const metric = row.metricSnapshot;
  if (metric === null || metric === "unknown") return markdownJson(metric);
  return [
    `${markdownText(metric.metric)} = ${markdownText(metric.value)} ${markdownText(metric.unit)}`,
    `(numerator ${markdownText(metric.numerator)}, denominator ${markdownText(metric.denominator)}, window ${markdownText(metric.window)}, scope ${markdownText(metric.scope)}, observed ${markdownText(metric.observedAt)})`,
  ].join(" ");
}

function poolText(row: SourceEvidenceRow): string {
  return `${markdownText(row.pool)}${row.membershipReason === null ? "" : ` (${markdownText(row.membershipReason)})`}`;
}

function evidenceLinksText(row: SourceEvidenceRow): string {
  if (row.evidenceLinks === null || row.evidenceLinks === "unknown") return markdownJson(row.evidenceLinks);
  return row.evidenceLinks.length === 0 ? "none" : row.evidenceLinks.map(markdownText).join(", ");
}

function lineageText(row: SourceEvidenceRow): string {
  return markdownJson(row.lineage);
}

export function renderSourceEvidenceMarkdown(inventory: SourceEvidenceInventory): string {
  const view = safeInventory(inventory);
  const lines = [
    "# Source/post evidence inventory",
    "",
    `- Rows: ${view.rows.length} (ready: ${view.summary.ready}, blocked: ${view.summary.blocked})`,
    `- Pools: niche ${view.summary.pools.niche} | broad ${view.summary.pools.broad} | format ${view.summary.pools.format}`,
    "",
    ...view.rows.flatMap((row, index) => [
      `## Evidence row ${index + 1}: ${markdownText(row.id)}`,
      "",
      `- Source ID: ${markdownText(row.sourceId)}`,
      `- Post ID: ${markdownText(row.postId)}`,
      `- Account: ${markdownText(row.accountId)}${row.handle === null ? "" : ` (${markdownText(row.handle)})`}`,
      `- Platform / medium / format: ${markdownText(row.platform)} / ${markdownText(row.medium)} / ${markdownText(row.format)}`,
      `- Pool: ${poolText(row)}`,
      `- Popularity scope: ${markdownText(row.popularityScope)}`,
      `- Sample scope: ${markdownText(row.sampleScope)}`,
      `- Baseline scope: ${markdownText(row.baselineScope)}`,
      `- Baseline source: ${markdownText(row.baselineSource)}`,
      `- Audience snapshot: ${markdownJson(row.audienceSizeSnapshot)}`,
      `- Metric: ${metricText(row)}`,
      `- Evidence links: ${evidenceLinksText(row)}`,
      `- Provenance: ${markdownText(row.provenance)}`,
      `- Observed / collected: ${markdownText(row.observedAt)} / ${markdownText(row.collectedAt)}`,
      `- Body complete metadata: ${markdownText(row.bodyComplete)}`,
      `- Caveats: ${markdownJson(row.caveats)}`,
      `- Review status: ${markdownText(row.reviewStatus)}`,
      `- Status: ${markdownText(row.status)}`,
      `- Lineage: ${lineageText(row)}`,
      `- Readiness: ${markdownText(row.readiness.status)} (${markdownText(row.readiness.reason)})`,
      `- Blocking fields: ${row.readiness.blockingFields.length ? row.readiness.blockingFields.map(markdownText).join(", ") : "none"}`,
      "",
    ]),
  ];
  return `${lines.join("\n")}\n`;
}

export function renderSourceEvidence(
  inventory: SourceEvidenceInventory,
  format: SourceEvidenceCliFormat,
): string {
  if (format === "json") return renderSourceEvidenceJson(inventory);
  if (format === "markdown") return renderSourceEvidenceMarkdown(inventory);
  return `${renderSourceEvidenceJson(inventory)}\n${renderSourceEvidenceMarkdown(inventory)}`;
}

export const renderSourcePostEvidence = renderSourceEvidence;
export const renderSourcePostEvidenceJson = renderSourceEvidenceJson;
export const renderSourcePostEvidenceMarkdown = renderSourceEvidenceMarkdown;

const defaultIo: SourceEvidenceCliIo = {
  readFile: (path) => readFileSync(path, "utf8"),
  write: (value) => process.stdout.write(value),
  error: (value) => process.stderr.write(value),
};

/** Read, validate, build, and render source evidence without writing domain data. */
export function main(
  argv: readonly string[] = process.argv.slice(2),
  io: Partial<SourceEvidenceCliIo> = {},
): number {
  const effectiveIo: SourceEvidenceCliIo = { ...defaultIo, ...io };
  try {
    const options = parseSourceEvidenceArgs(argv);
    const inventory = buildSourceEvidenceFromSource(options.source, effectiveIo);
    effectiveIo.write(renderSourceEvidence(inventory, options.format));
    return 0;
  } catch (error) {
    effectiveIo.error?.(`patterns:source-evidence: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
