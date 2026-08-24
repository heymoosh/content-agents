import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  COMMENT_INTAKE_VERSION,
  normalizeCommentIntake,
  type CommentIntakeInput,
  type NormalizedCommentIntake,
} from "./comment-intake.js";

export const COMMENT_INTAKE_CLI_VERSION = "comment-intake-cli-v1" as const;

export interface CommentIntakeCliIo {
  readonly readFile: (path: string) => string | Promise<string>;
  readonly write: (value: string) => void | Promise<void>;
  readonly error?: (value: string) => void | Promise<void>;
}

export type CommentIntakeCliSource =
  | { readonly kind: "json-string"; readonly value: string }
  | { readonly kind: "file"; readonly path: string };

export type CommentIntakeCliFormat = "json" | "markdown" | "both";

export interface CommentIntakeCliOptions {
  readonly source: CommentIntakeCliSource;
  readonly format: CommentIntakeCliFormat;
  readonly includeCommentText: boolean;
}

export type CommentTextKind = "raw" | "redacted";

export interface CommentIntakeOperatorProjection {
  readonly kind: "comment_intake_operator_view";
  readonly version: typeof COMMENT_INTAKE_CLI_VERSION;
  readonly intakeVersion: typeof COMMENT_INTAKE_VERSION;
  readonly id: string;
  readonly contentItemId: string;
  readonly lineage: NormalizedCommentIntake["lineage"];
  readonly source: NormalizedCommentIntake["source"];
  readonly moderation: NormalizedCommentIntake["moderation"];
  readonly consent: NormalizedCommentIntake["consent"];
  readonly redactionRequested: boolean;
  readonly summary: NormalizedCommentIntake["summary"];
  readonly readiness: NormalizedCommentIntake["readiness"];
  readonly ventureHandoff: NormalizedCommentIntake["ventureHandoff"];
  readonly autoClaimsDemand: false;
  readonly ventureArtifacts: false;
  readonly publish: false;
  readonly reply: false;
  readonly sideEffects: "none";
  readonly commentText?: string;
  readonly commentTextKind?: CommentTextKind;
}

export class CommentIntakeCliValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommentIntakeCliValidationError";
  }
}

function fail(message: string): never {
  throw new CommentIntakeCliValidationError(message);
}

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value`);
  return value;
}

/** Parse only one explicit JSON string or file source. There is no stdin/default source. */
export function parseCommentIntakeArgs(argv: readonly string[]): CommentIntakeCliOptions {
  let jsonText: string | undefined;
  let filePath: string | undefined;
  let format: CommentIntakeCliFormat = "json";
  let includeCommentText = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") {
      if (jsonText !== undefined || filePath !== undefined) throw new Error("exactly one of --json or --file is allowed");
      jsonText = optionValue(argv, index, argument);
      index += 1;
    } else if (argument.startsWith("--json=")) {
      if (jsonText !== undefined || filePath !== undefined) throw new Error("exactly one of --json or --file is allowed");
      jsonText = argument.slice("--json=".length);
      if (jsonText === "") throw new Error("--json requires a value");
    } else if (argument === "--file") {
      if (jsonText !== undefined || filePath !== undefined) throw new Error("exactly one of --json or --file is allowed");
      filePath = optionValue(argv, index, argument);
      index += 1;
    } else if (argument.startsWith("--file=")) {
      if (jsonText !== undefined || filePath !== undefined) throw new Error("exactly one of --json or --file is allowed");
      filePath = argument.slice("--file=".length);
      if (filePath === "") throw new Error("--file requires a value");
    } else if (argument === "--format") {
      const value = optionValue(argv, index, argument);
      if (value !== "json" && value !== "markdown" && value !== "both") {
        throw new Error("format must be json, markdown, or both");
      }
      format = value;
      index += 1;
    } else if (argument.startsWith("--format=")) {
      const value = argument.slice("--format=".length);
      if (value !== "json" && value !== "markdown" && value !== "both") {
        throw new Error("format must be json, markdown, or both");
      }
      format = value;
    } else if (argument === "--include-comment-text") {
      includeCommentText = true;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }

  if (jsonText === undefined && filePath === undefined) {
    throw new Error("exactly one of --json or --file is required");
  }

  return {
    source: jsonText === undefined
      ? { kind: "file", path: filePath as string }
      : { kind: "json-string", value: jsonText },
    format,
    includeCommentText,
  };
}

/** Parse the explicit JSON request without accepting arrays, null, or implicit input. */
export function parseCommentIntakeRequest(raw: string): CommentIntakeInput {
  if (typeof raw !== "string") fail("input must be valid JSON text");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    fail("input must be valid JSON");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail("input must be a JSON object");
  }
  return parsed as CommentIntakeInput;
}

/** Read a file source through the injected reader; JSON-string sources never read a file. */
export async function readCommentIntakeRequest(
  source: CommentIntakeCliSource,
  io: Pick<CommentIntakeCliIo, "readFile">,
): Promise<string> {
  if (source.kind === "json-string") return source.value;
  try {
    const value = await io.readFile(source.path);
    if (typeof value !== "string") throw new Error("file is not text");
    return value;
  } catch {
    throw new CommentIntakeCliValidationError("input file could not be read");
  }
}

export function buildCommentIntakeFromJson(raw: string): NormalizedCommentIntake {
  return normalizeCommentIntake(parseCommentIntakeRequest(raw));
}

export async function buildCommentIntakeFromSource(
  source: CommentIntakeCliSource,
  io: Pick<CommentIntakeCliIo, "readFile">,
): Promise<NormalizedCommentIntake> {
  return buildCommentIntakeFromJson(await readCommentIntakeRequest(source, io));
}

/**
 * Remove the observation body and expose only reviewable intake metadata by default.
 * Text is included only when the caller has explicitly selected --include-comment-text.
 */
export function projectCommentIntake(
  intake: NormalizedCommentIntake,
  options: Pick<CommentIntakeCliOptions, "includeCommentText"> = { includeCommentText: false },
): CommentIntakeOperatorProjection {
  const projection: CommentIntakeOperatorProjection = {
    kind: "comment_intake_operator_view",
    version: COMMENT_INTAKE_CLI_VERSION,
    intakeVersion: intake.version,
    id: intake.id,
    contentItemId: intake.contentItemId,
    lineage: { ...intake.lineage },
    source: {
      noteRef: intake.source.noteRef,
      evidenceRefs: [...intake.source.evidenceRefs],
    },
    moderation: { ...intake.moderation },
    consent: { ...intake.consent },
    redactionRequested: intake.redactionRequested,
    summary: {
      ...intake.summary,
      lineage: { ...intake.summary.lineage },
      evidenceRefs: [...intake.summary.evidenceRefs],
      sourceRecordIds: [...intake.summary.sourceRecordIds],
    },
    readiness: {
      status: intake.readiness.status,
      blockers: [...intake.readiness.blockers],
      ventureHandoff: {
        status: intake.readiness.ventureHandoff.status,
        blockers: [...intake.readiness.ventureHandoff.blockers],
      },
    },
    ventureHandoff: {
      ...intake.ventureHandoff,
      lineage: { ...intake.ventureHandoff.lineage },
      readiness: {
        status: intake.ventureHandoff.readiness.status,
        blockers: [...intake.ventureHandoff.readiness.blockers],
      },
    },
    autoClaimsDemand: false,
    ventureArtifacts: false,
    publish: false,
    reply: false,
    sideEffects: "none",
  };

  if (!options.includeCommentText) return projection;
  return {
    ...projection,
    commentText: intake.commentObservation.observation.text,
    commentTextKind: intake.redactionRequested ? "redacted" : "raw",
  };
}

export function renderCommentIntakeJson(projection: CommentIntakeOperatorProjection): string {
  return `${JSON.stringify(projection, null, 2)}\n`;
}

function markdownCell(value: string | null): string {
  return (value ?? "null").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function markdownList(values: readonly string[]): string {
  return values.length === 0 ? "None" : values.map(markdownCell).join(", ");
}

export function renderCommentIntakeMarkdown(projection: CommentIntakeOperatorProjection): string {
  const lines = [
    "# Comment intake operator view",
    "",
    `- ID: ${markdownCell(projection.id)}`,
    `- Content item: ${markdownCell(projection.contentItemId)}`,
    `- Intake version: ${markdownCell(projection.intakeVersion)}`,
    `- Moderation: ${projection.moderation.status}`,
    `- Consent: ${projection.consent.status}`,
    `- Readiness: ${projection.readiness.status}`,
    `- Side effects: ${projection.sideEffects}`,
    "",
    "## Summary",
    "",
    `- Qualification: ${projection.summary.qualification}`,
    `- Confidence: ${projection.summary.confidence}`,
    `- Muxin decision: ${projection.summary.muxinDecision}`,
    `- Product idea: ${projection.summary.productIdea === null ? "None" : markdownCell(projection.summary.productIdea)}`,
    `- Auto-claims demand: ${projection.autoClaimsDemand}`,
    "",
    "## Source refs",
    "",
    `- Source note: ${markdownCell(projection.source.noteRef)}`,
    `- Evidence: ${markdownList([...projection.source.evidenceRefs].sort((left, right) => left.localeCompare(right)))}`,
    `- Lineage: ${markdownCell(`${projection.lineage.sourceId}/${projection.lineage.variantId}/${projection.lineage.experimentId}`)}`,
    "",
    "## Readiness",
    "",
    `- Status: ${projection.readiness.status}`,
    `- Blockers: ${markdownList([...projection.readiness.blockers].sort((left, right) => left.localeCompare(right)))}`,
    "",
    "## Venture handoff",
    "",
    `- Venture gate: ${projection.ventureHandoff.ventureGate}`,
    `- Handoff status: ${projection.ventureHandoff.readiness.status}`,
    `- Blockers: ${markdownList([...projection.ventureHandoff.readiness.blockers].sort((left, right) => left.localeCompare(right)))}`,
  ];

  if (projection.commentText !== undefined) {
    lines.push(
      "",
      "## Comment text",
      "",
      `- Kind: ${projection.commentTextKind ?? "raw"}`,
      `- Text: ${markdownCell(projection.commentText)}`,
    );
  }

  return `${lines.join("\n")}\n`;
}

export function renderCommentIntake(
  projection: CommentIntakeOperatorProjection,
  format: CommentIntakeCliFormat,
): string {
  if (format === "json") return renderCommentIntakeJson(projection);
  if (format === "markdown") return renderCommentIntakeMarkdown(projection);
  return `${renderCommentIntakeJson(projection)}\n---\n${renderCommentIntakeMarkdown(projection)}`;
}

const defaultIo: CommentIntakeCliIo = {
  readFile: (path) => readFile(path, "utf8"),
  write: (value) => {
    process.stdout.write(value);
  },
  error: (value) => {
    process.stderr.write(value);
  },
};

/** Read, normalize, project, and render without writing any domain data or invoking providers. */
export async function main(
  argv: readonly string[] = process.argv.slice(2),
  io: Partial<CommentIntakeCliIo> = {},
): Promise<number> {
  try {
    const options = parseCommentIntakeArgs(argv);
    const effectiveIo: CommentIntakeCliIo = {
      readFile: io.readFile ?? defaultIo.readFile,
      write: io.write ?? defaultIo.write,
      error: io.error ?? defaultIo.error,
    };
    const normalized = await buildCommentIntakeFromSource(options.source, effectiveIo);
    const projection = projectCommentIntake(normalized, options);
    await effectiveIo.write(renderCommentIntake(projection, options.format));
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : "comment intake input is invalid";
    await (io.error ?? defaultIo.error)?.(`review:comment-intake: ${message}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
