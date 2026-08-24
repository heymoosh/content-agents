import { pathToFileURL } from "node:url";

import {
  readPatternDataStatus,
  type PatternCoreArtifactReport,
  type PatternDataStatusReport,
  type PatternDerivedArtifactReport,
  type PatternOptionalArtifactReport,
} from "./data-status.js";

export type PatternDataStatusCliFormat = "json" | "markdown" | "both";

export interface PatternDataStatusCliArgs {
  dataDir: string;
  format: PatternDataStatusCliFormat;
}

export interface PatternDataStatusCliIo {
  write: (value: string) => void;
  error?: (value: string) => void;
}

export type PatternDataStatusLoader = (dataDirectory: string) => PatternDataStatusReport;

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value`);
  return value;
}

export function parsePatternDataStatusArgs(argv: readonly string[]): PatternDataStatusCliArgs {
  let dataDir: string | undefined;
  let format: PatternDataStatusCliFormat = "json";
  let formatSeen = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--data-dir") {
      if (dataDir !== undefined) throw new Error("--data-dir may be supplied only once");
      const value = optionValue(argv, index, argument);
      if (value.trim() === "") throw new Error("--data-dir requires a non-empty path");
      dataDir = value;
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

  if (dataDir === undefined) throw new Error("--data-dir is required");
  return { dataDir, format };
}

/** Compatibility alias for callers that use the shorter parser name used by other CLIs. */
export const parseArgs = parsePatternDataStatusArgs;

interface ArtifactMetadata {
  relativePath: string;
  format: "jsonl" | "json";
  status: "available" | "missing" | "invalid";
  bytes: number | null;
  recordCount: number;
  validRecordCount: number;
  parseErrors: Array<{ line: number | null; message: "invalid JSON" }>;
  validationErrors: Array<{ record: number | null; message: string }>;
}

function artifactMetadata(artifact: PatternCoreArtifactReport | PatternDerivedArtifactReport): ArtifactMetadata {
  return {
    relativePath: artifact.relativePath,
    format: artifact.format,
    status: artifact.status,
    bytes: artifact.bytes,
    recordCount: artifact.recordCount,
    validRecordCount: artifact.validRecordCount,
    parseErrors: artifact.parseErrors.map(({ line, message }) => ({ line, message })),
    validationErrors: artifact.validationErrors.map(({ record, message }) => ({ record, message })),
  };
}

function optionalArtifactMetadata(artifact: PatternOptionalArtifactReport): PatternOptionalArtifactReport {
  return {
    relativePath: artifact.relativePath,
    status: artifact.status,
    fileCount: artifact.fileCount,
    files: [...artifact.files],
    fileCountByExtension: artifact.fileCountByExtension.map(({ extension, count }) => ({ extension, count })),
    totalBytes: artifact.totalBytes,
    errors: [...artifact.errors],
  };
}

/** Keep the output contract to the documented operator metadata, even for an injected loader. */
function operatorMetadata(report: PatternDataStatusReport): PatternDataStatusReport {
  return {
    dataDirectory: report.dataDirectory,
    reviewStatus: report.reviewStatus,
    reviewBoundary: report.reviewBoundary,
    artifacts: {
      "corpus.jsonl": artifactMetadata(report.artifacts["corpus.jsonl"]) as PatternDataStatusReport["artifacts"]["corpus.jsonl"],
      "analyses.jsonl": artifactMetadata(report.artifacts["analyses.jsonl"]) as PatternDataStatusReport["artifacts"]["analyses.jsonl"],
      "baselines.jsonl": artifactMetadata(report.artifacts["baselines.jsonl"]) as PatternDataStatusReport["artifacts"]["baselines.jsonl"],
      "inbox/reddit-rss-top-year-2026-08-23.json": artifactMetadata(
        report.artifacts["inbox/reddit-rss-top-year-2026-08-23.json"],
      ) as PatternDataStatusReport["artifacts"]["inbox/reddit-rss-top-year-2026-08-23.json"],
    },
    derivedArtifacts: {
      openers: artifactMetadata(report.derivedArtifacts.openers) as PatternDataStatusReport["derivedArtifacts"]["openers"],
    },
    corpus: {
      recordCount: report.corpus.recordCount,
      validRecordCount: report.corpus.validRecordCount,
      byPlatform: report.corpus.byPlatform.map(({ platform, count }) => ({ platform, count })),
    },
    baselines: {
      recordCount: report.baselines.recordCount,
      validRecordCount: report.baselines.validRecordCount,
      platformHandleKeys: [...report.baselines.platformHandleKeys],
    },
    optionalArtifacts: {
      browser: optionalArtifactMetadata(report.optionalArtifacts.browser),
      rss: optionalArtifactMetadata(report.optionalArtifacts.rss),
    },
    missingArtifacts: [...report.missingArtifacts],
    invalidArtifacts: [...report.invalidArtifacts],
  };
}

export function renderPatternDataStatusJson(report: PatternDataStatusReport): string {
  return `${JSON.stringify(operatorMetadata(report), null, 2)}\n`;
}

function markdownText(value: string): string {
  return value
    .replace(/`/g, "'")
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|")
    .replace(/\s+/g, " ")
    .trim();
}

function count(value: number | null): string {
  return value === null ? "null" : value.toLocaleString("en-US");
}

function artifactMarkdownRow(kind: string, artifact: ArtifactMetadata): string {
  return `| ${kind} | ${markdownText(artifact.relativePath)} | ${artifact.status} | ${count(artifact.bytes)} | ${count(artifact.recordCount)} | ${count(artifact.validRecordCount)} | ${artifact.parseErrors.length} | ${artifact.validationErrors.length} |`;
}

function optionalMarkdownRow(artifact: PatternOptionalArtifactReport): string {
  const extensions = artifact.fileCountByExtension.length
    ? artifact.fileCountByExtension.map(({ extension, count: total }) => `${extension}: ${total}`).join(", ")
    : "none";
  return `| ${markdownText(artifact.relativePath)} | ${artifact.status} | ${count(artifact.fileCount)} | ${count(artifact.totalBytes)} | ${markdownText(extensions)} | ${artifact.files.length ? artifact.files.map(markdownText).join(", ") : "none"} | ${artifact.errors.length ? artifact.errors.map(markdownText).join("; ") : "none"} |`;
}

export function renderPatternDataStatusMarkdown(report: PatternDataStatusReport): string {
  const view = operatorMetadata(report);
  const artifacts: Array<[string, ArtifactMetadata]> = [
    ["core", artifactMetadata(view.artifacts["corpus.jsonl"])],
    ["core", artifactMetadata(view.artifacts["analyses.jsonl"])],
    ["core", artifactMetadata(view.artifacts["baselines.jsonl"])],
    ["core", artifactMetadata(view.artifacts["inbox/reddit-rss-top-year-2026-08-23.json"])],
    ["derived", artifactMetadata(view.derivedArtifacts.openers)],
  ];
  const lines = [
    "# Pattern data status",
    "",
    `- Data directory: \`${markdownText(view.dataDirectory)}\``,
    `- Review status: ${view.reviewStatus}`,
    `- Review boundary: ${markdownText(view.reviewBoundary)}`,
    "",
    "## Artifact inventory",
    "",
    "| Kind | Artifact | Status | Bytes | Records | Valid records | Parse errors | Validation errors |",
    "|---|---|---|---:|---:|---:|---:|---:|",
    ...artifacts.map(([kind, artifact]) => artifactMarkdownRow(kind, artifact)),
    "",
    "## Corpus inventory",
    "",
    `- Corpus records: ${count(view.corpus.recordCount)} (valid: ${count(view.corpus.validRecordCount)})`,
    "",
    "| Platform | Records |",
    "|---|---:|",
    ...view.corpus.byPlatform.map(({ platform, count: total }) => `| ${markdownText(platform)} | ${count(total)} |`),
    "",
    "## Baseline inventory",
    "",
    `- Baselines: ${count(view.baselines.recordCount)} (valid: ${count(view.baselines.validRecordCount)})`,
    `- Platform/handle keys: ${view.baselines.platformHandleKeys.length ? view.baselines.platformHandleKeys.map(markdownText).join(", ") : "none"}`,
    "",
    "## Optional artifact directories",
    "",
    "| Directory | Status | Files | Bytes | Extensions | File names | Errors |",
    "|---|---|---:|---:|---|---|---|",
    optionalMarkdownRow(view.optionalArtifacts.browser),
    optionalMarkdownRow(view.optionalArtifacts.rss),
    "",
    "## Missing and invalid artifacts",
    "",
    `- Missing: ${view.missingArtifacts.length ? view.missingArtifacts.map(markdownText).join(", ") : "none"}`,
    `- Invalid: ${view.invalidArtifacts.length ? view.invalidArtifacts.map(markdownText).join(", ") : "none"}`,
  ];
  return `${lines.join("\n")}\n`;
}

export function renderPatternDataStatus(report: PatternDataStatusReport, format: PatternDataStatusCliFormat): string {
  if (format === "json") return renderPatternDataStatusJson(report);
  if (format === "markdown") return renderPatternDataStatusMarkdown(report);
  return `${renderPatternDataStatusJson(report)}\n${renderPatternDataStatusMarkdown(report)}`;
}

const defaultCliIo: PatternDataStatusCliIo = {
  write: (value) => process.stdout.write(value),
  error: (value) => process.stderr.write(value),
};

/** Read-only CLI entry point. The loader seam makes tests independent of the data directory. */
export function main(
  argv: readonly string[] = process.argv.slice(2),
  loadStatus: PatternDataStatusLoader = readPatternDataStatus,
  io: Partial<PatternDataStatusCliIo> = {},
): number {
  try {
    const args = parsePatternDataStatusArgs(argv);
    const report = loadStatus(args.dataDir);
    (io.write ?? defaultCliIo.write)(renderPatternDataStatus(report, args.format));
    return 0;
  } catch (error) {
    (io.error ?? defaultCliIo.error)?.(`patterns:data-status: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
