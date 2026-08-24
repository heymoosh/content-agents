import { extname, join, relative, resolve } from "node:path";
import { lstatSync, readdirSync, readFileSync } from "node:fs";

export const CORE_PATTERN_ARTIFACT_PATHS = [
  "corpus.jsonl",
  "analyses.jsonl",
  "baselines.jsonl",
  "inbox/reddit-rss-top-year-2026-08-23.json",
] as const;

const DERIVED_PATTERN_ARTIFACT_PATHS = ["openers.jsonl"] as const;

const OPTIONAL_PATTERN_ARTIFACT_DIRECTORIES = ["browser", "rss"] as const;

export type PatternArtifactStatus = "available" | "missing" | "invalid";
export type PatternCoreArtifactPath = (typeof CORE_PATTERN_ARTIFACT_PATHS)[number];
export type PatternDerivedArtifactPath = (typeof DERIVED_PATTERN_ARTIFACT_PATHS)[number];
export type PatternOptionalArtifactDirectory = (typeof OPTIONAL_PATTERN_ARTIFACT_DIRECTORIES)[number];

export interface PatternDataParseError {
  line: number | null;
  message: "invalid JSON";
}

export interface PatternDataValidationError {
  record: number | null;
  message: string;
}

export interface PatternCoreArtifactReport {
  relativePath: PatternCoreArtifactPath;
  format: "jsonl" | "json";
  status: PatternArtifactStatus;
  bytes: number | null;
  // JSONL counts non-empty lines. JSON counts array items. Invalid positions are included in
  // recordCount and excluded from validRecordCount so partial files remain diagnosable.
  recordCount: number;
  validRecordCount: number;
  parseErrors: PatternDataParseError[];
  validationErrors: PatternDataValidationError[];
}

export interface PatternDerivedArtifactReport {
  relativePath: PatternDerivedArtifactPath;
  format: "jsonl";
  status: PatternArtifactStatus;
  bytes: number | null;
  recordCount: number;
  validRecordCount: number;
  parseErrors: PatternDataParseError[];
  validationErrors: PatternDataValidationError[];
}

export interface PatternOptionalArtifactReport {
  relativePath: PatternOptionalArtifactDirectory;
  status: PatternArtifactStatus;
  fileCount: number;
  files: string[];
  fileCountByExtension: Array<{ extension: string; count: number }>;
  totalBytes: number | null;
  errors: string[];
}

export interface PatternPlatformCount {
  platform: string;
  count: number;
}

export interface PatternDataStatusReport {
  dataDirectory: string;
  reviewStatus: "unreviewed";
  reviewBoundary: string;
  artifacts: {
    [path in PatternCoreArtifactPath]: PatternCoreArtifactReport;
  };
  derivedArtifacts: {
    openers: PatternDerivedArtifactReport;
  };
  corpus: {
    recordCount: number;
    validRecordCount: number;
    byPlatform: PatternPlatformCount[];
  };
  baselines: {
    recordCount: number;
    validRecordCount: number;
    platformHandleKeys: string[];
  };
  optionalArtifacts: {
    browser: PatternOptionalArtifactReport;
    rss: PatternOptionalArtifactReport;
  };
  missingArtifacts: string[];
  invalidArtifacts: string[];
}

interface ReadableFile {
  status: "available";
  bytes: number;
  text: string;
}

interface MissingFile {
  status: "missing";
}

interface InvalidFile {
  status: "invalid";
  message: string;
}

type FileReadResult = ReadableFile | MissingFile | InvalidFile;

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRegularFile(path: string): FileReadResult {
  try {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) return { status: "invalid", message: "symbolic links are not inspected" };
    if (!stat.isFile()) return { status: "invalid", message: "artifact is not a regular file" };
    return { status: "available", bytes: stat.size, text: readFileSync(path, "utf8") };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { status: "missing" };
    return { status: "invalid", message: "unable to read artifact" };
  }
}

function statusForErrors(parseErrors: PatternDataParseError[], validationErrors: PatternDataValidationError[]): PatternArtifactStatus {
  return parseErrors.length > 0 || validationErrors.length > 0 ? "invalid" : "available";
}

function baseCoreReport(relativePath: PatternCoreArtifactPath, format: PatternCoreArtifactReport["format"]): PatternCoreArtifactReport {
  return {
    relativePath,
    format,
    status: "missing",
    bytes: null,
    recordCount: 0,
    validRecordCount: 0,
    parseErrors: [],
    validationErrors: [],
  };
}

type JsonlRecordHandler = (record: Record<string, unknown>, recordNumber: number, validationErrors: PatternDataValidationError[]) => void;

function scanJsonl(path: string, relativePath: PatternCoreArtifactPath, onRecord?: JsonlRecordHandler): PatternCoreArtifactReport {
  const report = baseCoreReport(relativePath, "jsonl");
  const file = readRegularFile(path);
  if (file.status === "missing") return report;
  if (file.status === "invalid") {
    report.status = "invalid";
    report.validationErrors.push({ record: null, message: file.message });
    return report;
  }

  report.status = "available";
  report.bytes = file.bytes;
  const lines = file.text.split(/\r?\n/);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    if (lines[lineIndex].trim() === "") continue;
    report.recordCount += 1;
    let parsed: unknown;
    try {
      parsed = JSON.parse(lines[lineIndex]);
    } catch {
      report.parseErrors.push({ line: lineIndex + 1, message: "invalid JSON" });
      continue;
    }
    if (!isRecord(parsed)) {
      report.validationErrors.push({ record: report.recordCount, message: "record must be a JSON object" });
      continue;
    }
    report.validRecordCount += 1;
    onRecord?.(parsed, report.recordCount, report.validationErrors);
  }
  report.status = statusForErrors(report.parseErrors, report.validationErrors);
  return report;
}

function baseDerivedReport(relativePath: PatternDerivedArtifactPath): PatternDerivedArtifactReport {
  return {
    relativePath,
    format: "jsonl",
    status: "missing",
    bytes: null,
    recordCount: 0,
    validRecordCount: 0,
    parseErrors: [],
    validationErrors: [],
  };
}

function validateOpener(record: Record<string, unknown>, recordNumber: number, errors: PatternDataValidationError[]): void {
  const requireString = (field: string): void => {
    if (typeof record[field] !== "string" || (record[field] as string).trim() === "") {
      errors.push({ record: recordNumber, message: `${field} must be a non-empty string` });
    }
  };
  for (const field of ["id", "corpus_entry_id", "platform", "creator", "handle", "url", "opener_text", "kind", "collected_at"]) {
    requireString(field);
  }
  if (record.onscreen_title !== null && typeof record.onscreen_title !== "string") {
    errors.push({ record: recordNumber, message: "onscreen_title must be a string or null" });
  }
  if (typeof record.verbatim_ok !== "boolean") {
    errors.push({ record: recordNumber, message: "verbatim_ok must be a boolean" });
  }
  if (!Array.isArray(record.warnings)) {
    errors.push({ record: recordNumber, message: "warnings must be an array" });
  }
  const performance = record.performance;
  if (!isRecord(performance)) {
    errors.push({ record: recordNumber, message: "performance must be an object" });
  } else {
    if (performance.multiple !== null && typeof performance.multiple !== "number") {
      errors.push({ record: recordNumber, message: "performance.multiple must be a number or null" });
    }
    if (performance.metric !== null && performance.metric !== "views" && performance.metric !== "engagement") {
      errors.push({ record: recordNumber, message: "performance.metric must be views, engagement, or null" });
    }
    if (typeof performance.note !== "string" || performance.note.trim() === "") {
      errors.push({ record: recordNumber, message: "performance.note must be a non-empty string" });
    }
  }
}

function scanOpeners(path: string): PatternDerivedArtifactReport {
  const report = baseDerivedReport("openers.jsonl");
  const file = readRegularFile(path);
  if (file.status === "missing") return report;
  if (file.status === "invalid") {
    report.status = "invalid";
    report.validationErrors.push({ record: null, message: file.message });
    return report;
  }
  report.status = "available";
  report.bytes = file.bytes;
  const lines = file.text.split(/\r?\n/);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    if (lines[lineIndex].trim() === "") continue;
    report.recordCount += 1;
    let parsed: unknown;
    try {
      parsed = JSON.parse(lines[lineIndex]);
    } catch {
      report.parseErrors.push({ line: lineIndex + 1, message: "invalid JSON" });
      continue;
    }
    if (!isRecord(parsed)) {
      report.validationErrors.push({ record: report.recordCount, message: "record must be a JSON object" });
      continue;
    }
    const before = report.validationErrors.length;
    validateOpener(parsed, report.recordCount, report.validationErrors);
    if (report.validationErrors.length === before) report.validRecordCount += 1;
  }
  report.status = statusForErrors(report.parseErrors, report.validationErrors);
  return report;
}

function readJsonArray(path: string, relativePath: PatternCoreArtifactPath): PatternCoreArtifactReport {
  const report = baseCoreReport(relativePath, "json");
  const file = readRegularFile(path);
  if (file.status === "missing") return report;
  if (file.status === "invalid") {
    report.status = "invalid";
    report.validationErrors.push({ record: null, message: file.message });
    return report;
  }

  report.status = "available";
  report.bytes = file.bytes;
  let parsed: unknown;
  try {
    parsed = JSON.parse(file.text);
  } catch {
    report.status = "invalid";
    report.parseErrors.push({ line: null, message: "invalid JSON" });
    return report;
  }
  if (!Array.isArray(parsed)) {
    report.status = "invalid";
    report.validationErrors.push({ record: null, message: "JSON artifact must be an array" });
    return report;
  }

  report.recordCount = parsed.length;
  for (let index = 0; index < parsed.length; index++) {
    if (isRecord(parsed[index])) report.validRecordCount += 1;
    else report.validationErrors.push({ record: index + 1, message: "record must be a JSON object" });
  }
  report.status = statusForErrors(report.parseErrors, report.validationErrors);
  return report;
}

function normalizedHandle(value: string): string {
  return value.trim().replace(/^@/, "").toLowerCase();
}

function requiredString(
  record: Record<string, unknown>,
  field: string,
  recordNumber: number,
  validationErrors: PatternDataValidationError[],
): string | null {
  const value = record[field];
  if (typeof value !== "string" || value.trim() === "") {
    validationErrors.push({ record: recordNumber, message: `${field} must be a non-empty string` });
    return null;
  }
  return value.trim();
}

function optionalArtifactReport(root: string, relativePath: PatternOptionalArtifactDirectory): PatternOptionalArtifactReport {
  const report: PatternOptionalArtifactReport = {
    relativePath,
    status: "missing",
    fileCount: 0,
    files: [],
    fileCountByExtension: [],
    totalBytes: null,
    errors: [],
  };
  const directory = join(root, relativePath);
  let stat;
  try {
    stat = lstatSync(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return report;
    report.status = "invalid";
    report.errors.push("unable to read directory");
    return report;
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    report.status = "invalid";
    report.errors.push(stat.isSymbolicLink() ? "symbolic links are not inspected" : "artifact path is not a directory");
    return report;
  }

  const extensions = new Map<string, number>();
  let totalBytes = 0;
  const walk = (current: string): void => {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true }).sort((left, right) => compare(left.name, right.name));
    } catch {
      report.errors.push(`unable to read ${relative(root, current) || relativePath}`);
      return;
    }
    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      let entryStat;
      try {
        entryStat = lstatSync(fullPath);
      } catch {
        report.errors.push(`unable to inspect ${relative(root, fullPath)}`);
        continue;
      }
      if (entryStat.isSymbolicLink()) {
        report.errors.push(`symbolic links are not inspected: ${relative(root, fullPath)}`);
      } else if (entryStat.isDirectory()) {
        walk(fullPath);
      } else if (entryStat.isFile()) {
        const fileName = relative(directory, fullPath);
        report.files.push(fileName);
        report.fileCount += 1;
        totalBytes += entryStat.size;
        const extension = extname(entry.name).toLowerCase() || "none";
        extensions.set(extension, (extensions.get(extension) ?? 0) + 1);
      } else {
        report.errors.push(`unsupported filesystem entry: ${relative(root, fullPath)}`);
      }
    }
  };
  walk(directory);
  report.files.sort(compare);
  report.fileCountByExtension = [...extensions.entries()]
    .sort(([left], [right]) => compare(left, right))
    .map(([extension, count]) => ({ extension, count }));
  report.totalBytes = totalBytes;
  report.status = report.errors.length > 0 ? "invalid" : "available";
  return report;
}

export function readPatternDataStatus(dataDirectory: string): PatternDataStatusReport {
  if (typeof dataDirectory !== "string" || dataDirectory.trim() === "") {
    throw new TypeError("dataDirectory must be an explicit non-empty path");
  }
  const root = resolve(dataDirectory);
  const corpusPlatforms = new Map<string, number>();
  const baselineKeys = new Set<string>();
  const corpus = scanJsonl(join(root, "corpus.jsonl"), "corpus.jsonl", (record, recordNumber, validationErrors) => {
    const platform = requiredString(record, "platform", recordNumber, validationErrors);
    if (platform) corpusPlatforms.set(platform, (corpusPlatforms.get(platform) ?? 0) + 1);
  });
  const analyses = scanJsonl(join(root, "analyses.jsonl"), "analyses.jsonl");
  const baselines = scanJsonl(join(root, "baselines.jsonl"), "baselines.jsonl", (record, recordNumber, validationErrors) => {
    const platform = requiredString(record, "platform", recordNumber, validationErrors);
    const handle = requiredString(record, "handle", recordNumber, validationErrors);
    const normalized = handle === null ? null : normalizedHandle(handle);
    if (platform && normalized) baselineKeys.add(`${platform}|${normalized}`);
    else if (platform && handle !== null) validationErrors.push({ record: recordNumber, message: "handle must contain characters after an optional @" });
  });
  const inbox = readJsonArray(join(root, "inbox", "reddit-rss-top-year-2026-08-23.json"), "inbox/reddit-rss-top-year-2026-08-23.json");
  const openers = scanOpeners(join(root, "openers.jsonl"));
  const artifacts = {
    "corpus.jsonl": corpus,
    "analyses.jsonl": analyses,
    "baselines.jsonl": baselines,
    "inbox/reddit-rss-top-year-2026-08-23.json": inbox,
  };
  const browser = optionalArtifactReport(root, "browser");
  const rss = optionalArtifactReport(root, "rss");
  const allArtifacts = [...Object.values(artifacts), openers, browser, rss];
  const missingArtifacts = allArtifacts.filter((artifact) => artifact.status === "missing").map((artifact) => artifact.relativePath).sort(compare);
  const invalidArtifacts = allArtifacts.filter((artifact) => artifact.status === "invalid").map((artifact) => artifact.relativePath).sort(compare);

  return {
    dataDirectory: root,
    reviewStatus: "unreviewed",
    reviewBoundary: "Counts and file metadata are unreviewed and not human-reviewed. Derived openers are not reviewed evidence, winner claims, account metadata, or proof of platform-wide best content.",
    artifacts,
    derivedArtifacts: { openers },
    corpus: {
      recordCount: corpus.recordCount,
      validRecordCount: corpus.validRecordCount,
      byPlatform: [...corpusPlatforms.entries()]
        .sort(([left], [right]) => compare(left, right))
        .map(([platform, count]) => ({ platform, count })),
    },
    baselines: {
      recordCount: baselines.recordCount,
      validRecordCount: baselines.validRecordCount,
      platformHandleKeys: [...baselineKeys].sort(compare),
    },
    optionalArtifacts: { browser, rss },
    missingArtifacts,
    invalidArtifacts,
  };
}
