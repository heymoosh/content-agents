import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  buildBusinessOutcome,
  buildCommentObservation,
  buildFunnelEvent,
  type BusinessOutcome,
  type BusinessOutcomeInput,
  type CommentObservation,
  type CommentObservationInput,
  type FunnelEvent,
  type FunnelEventInput,
  type MuxinDecision,
} from "../review/learning-packet.js";
import { buildCommentLearningView, type CommentLearningView, type CommentLearningViewInput } from "./comment-learning.js";

export const COMMENT_LEARNING_CLI_VERSION = "grow-comment-learning-cli-v1" as const;

export interface CommentLearningCliIo {
  readonly readFile: (path: string) => string | Promise<string>;
  readonly write: (value: string) => void | Promise<void>;
  readonly error?: (value: string) => void | Promise<void>;
}

export type CommentLearningCliSource =
  | { readonly kind: "json-string"; readonly value: string }
  | { readonly kind: "file"; readonly path: string };

export type CommentLearningCliFormat = "json" | "markdown" | "both";

export interface CommentLearningCliOptions {
  readonly source: CommentLearningCliSource;
  readonly format: CommentLearningCliFormat;
}

export class CommentLearningCliValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommentLearningCliValidationError";
  }
}

const MUXIN_DECISIONS: readonly MuxinDecision[] = ["pending", "adopted", "declined"];

function fail(message: string): never {
  throw new CommentLearningCliValidationError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredArray(source: Record<string, unknown>, field: string): unknown[] {
  if (!Object.hasOwn(source, field)) fail(`${field} is required`);
  if (!Array.isArray(source[field])) fail(`${field} must be an array`);
  return source[field];
}

function expectedKind(source: Record<string, unknown>, field: string, kind: string): void {
  if (source.kind !== undefined && source.kind !== kind) fail(`${field}.kind must be ${kind}`);
}

function normalizeRecords<T>(
  value: unknown[],
  field: string,
  kind: string,
  build: (source: Record<string, unknown>) => T,
): T[] {
  return value.map((item, index) => {
    const itemField = `${field}[${index}]`;
    if (!isRecord(item)) fail(`${itemField} must be an object`);
    expectedKind(item, itemField, kind);
    try {
      return build(item);
    } catch (error) {
      if (error instanceof CommentLearningCliValidationError) throw error;
      const message = error instanceof Error ? error.message : "invalid record";
      fail(`${itemField}: ${message}`);
    }
  });
}

function assertUniqueRecordIds(records: readonly { id: string }[]): void {
  const ids = new Set<string>();
  for (const record of records) {
    if (ids.has(record.id)) fail("record ids must be unique across the envelope arrays");
    ids.add(record.id);
  }
}

/** Parse and normalize the only accepted operator input: an explicit JSON envelope. */
export function loadCommentLearningEnvelope(raw: string): CommentLearningViewInput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    fail("input must be valid JSON");
  }
  if (!isRecord(parsed)) fail("input must be a JSON object envelope");

  const commentObservations = normalizeRecords(
    requiredArray(parsed, "commentObservations"),
    "commentObservations",
    "comment_observation",
    (source) => buildCommentObservation(source as unknown as CommentObservationInput),
  );
  const funnelEvents = normalizeRecords(
    requiredArray(parsed, "funnelEvents"),
    "funnelEvents",
    "funnel_event",
    (source) => buildFunnelEvent(source as unknown as FunnelEventInput),
  );
  const businessOutcomes = normalizeRecords(
    requiredArray(parsed, "businessOutcomes"),
    "businessOutcomes",
    "business_outcome",
    (source) => buildBusinessOutcome(source as unknown as BusinessOutcomeInput),
  );
  assertUniqueRecordIds([
    ...(commentObservations as CommentObservation[]),
    ...(funnelEvents as FunnelEvent[]),
    ...(businessOutcomes as BusinessOutcome[]),
  ]);

  let muxinDecision: MuxinDecision | undefined;
  if (Object.hasOwn(parsed, "muxinDecision")) {
    if (typeof parsed.muxinDecision !== "string" || !MUXIN_DECISIONS.includes(parsed.muxinDecision as MuxinDecision)) {
      fail("muxinDecision must be one of pending, adopted, declined");
    }
    muxinDecision = parsed.muxinDecision as MuxinDecision;
  }

  return {
    commentObservations,
    funnelEvents,
    businessOutcomes,
    ...(muxinDecision === undefined ? {} : { muxinDecision }),
  };
}

export function renderCommentLearningJson(view: CommentLearningView): string {
  return `${JSON.stringify(view, null, 2)}\n`;
}

function markdownCell(value: string | null): string {
  return (value ?? "null").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function markdownList(values: readonly string[]): string {
  return markdownCell(values.length > 0 ? values.join(", ") : null);
}

/** Render only operator metadata; comment observation text is intentionally not available here. */
export function renderCommentLearningMarkdown(view: CommentLearningView): string {
  const lines = [
    "# Comment learning",
    "",
    `Muxin decision: ${view.muxinDecision}`,
    `Readiness: ${view.readiness.status}`,
    `Evidence blockers: ${markdownList([...view.readiness.blockers].sort((left, right) => left.localeCompare(right)))}`,
    `Auto-claims demand: ${view.autoClaimsDemand}`,
    `Venture artifacts: ${view.ventureArtifacts}`,
    `Side effects: ${view.sideEffects}`,
    "",
    "## Hypotheses",
    "",
    "| ID | Type | Signal | Qualification | Confidence | Lineage | Evidence refs | Source record IDs | Muxin decision |",
    "|---|---|---|---|---|---|---|---|---|",
  ];
  for (const hypothesis of [...view.hypotheses].sort((left, right) => left.id.localeCompare(right.id))) {
    const lineage = [hypothesis.lineage.sourceId, hypothesis.lineage.variantId, hypothesis.lineage.experimentId].join("/");
    lines.push(
      `| ${markdownCell(hypothesis.id)} | ${hypothesis.type} | ${hypothesis.signal} | ${hypothesis.qualification} | ${hypothesis.confidence} | ${markdownCell(lineage)} | ${markdownList([...hypothesis.evidenceRefs].sort((left, right) => left.localeCompare(right)))} | ${markdownList(hypothesis.sourceRecordIds)} | ${hypothesis.muxinDecision} |`,
    );
  }
  return `${lines.join("\n")}\n`;
}

export function renderCommentLearning(view: CommentLearningView, format: CommentLearningCliFormat): string {
  if (format === "json") return renderCommentLearningJson(view);
  if (format === "markdown") return renderCommentLearningMarkdown(view);
  return `${renderCommentLearningJson(view)}\n${renderCommentLearningMarkdown(view)}`;
}

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value`);
  return value;
}

export function parseCommentLearningArgs(argv: readonly string[]): CommentLearningCliOptions {
  let inputPath: string | undefined;
  let jsonText: string | undefined;
  let format: CommentLearningCliFormat = "json";

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--input" || argument === "--file") {
      if (inputPath !== undefined || jsonText !== undefined) throw new Error("exactly one of --json or --input/--file is allowed");
      inputPath = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--json") {
      if (inputPath !== undefined || jsonText !== undefined) throw new Error("exactly one of --json or --input/--file is allowed");
      jsonText = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--format") {
      const value = optionValue(argv, index, argument);
      if (value !== "json" && value !== "markdown" && value !== "both") throw new Error("--format must be json, markdown, or both");
      format = value;
      index += 1;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }

  if (inputPath === undefined && jsonText === undefined) throw new Error("exactly one of --json or --input/--file is required");
  return {
    source: inputPath === undefined ? { kind: "json-string", value: jsonText as string } : { kind: "file", path: inputPath },
    format,
  };
}

const defaultIo: CommentLearningCliIo = {
  readFile: (path) => readFile(path, "utf8"),
  write: (value) => {
    process.stdout.write(value);
  },
  error: (value) => {
    process.stderr.write(value);
  },
};

export async function readCommentLearningRequest(
  source: CommentLearningCliSource,
  io: Pick<CommentLearningCliIo, "readFile">,
): Promise<string> {
  if (source.kind === "json-string") return source.value;
  let value: string | Promise<string>;
  try {
    value = await io.readFile(source.path);
  } catch {
    throw new CommentLearningCliValidationError("input could not be read");
  }
  if (typeof value !== "string") throw new CommentLearningCliValidationError("input file must contain text");
  return value;
}

export async function buildCommentLearningFromSource(
  source: CommentLearningCliSource,
  io: Pick<CommentLearningCliIo, "readFile">,
): Promise<CommentLearningView> {
  return buildCommentLearningView(loadCommentLearningEnvelope(await readCommentLearningRequest(source, io)));
}

export function buildCommentLearningFromJson(raw: string): CommentLearningView {
  return buildCommentLearningView(loadCommentLearningEnvelope(raw));
}

/** Read, validate, project, and render one envelope without writing any domain state. */
export async function main(
  argv: readonly string[] = process.argv.slice(2),
  io: Partial<CommentLearningCliIo> = {},
): Promise<number> {
  try {
    const options = parseCommentLearningArgs(argv);
    const effectiveIo: CommentLearningCliIo = {
      readFile: io.readFile ?? defaultIo.readFile,
      write: io.write ?? defaultIo.write,
      error: io.error ?? defaultIo.error,
    };
    const view = await buildCommentLearningFromSource(options.source, effectiveIo);
    await effectiveIo.write(renderCommentLearning(view, options.format));
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : "comment learning input is invalid";
    await (io.error ?? defaultIo.error)?.(`grow:comment-learning: ${message}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
