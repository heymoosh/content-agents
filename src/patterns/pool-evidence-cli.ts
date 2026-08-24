import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  buildCatalog,
  loadCatalogInputs,
  type CatalogRow,
  type PatternCatalog,
} from "./catalog.js";
import {
  buildPoolEvidenceInventory,
  renderPoolEvidenceJson,
  renderPoolEvidenceMarkdown,
  type PoolEvidenceInventory,
} from "./pool-evidence.js";
import type { PatternMiningConfig } from "./types.js";

export const POOL_EVIDENCE_CLI_VERSION = "pool-evidence-cli-v1" as const;

export type PoolEvidenceCliFormat = "json" | "markdown";

export interface PoolEvidenceCliPaths {
  readonly config?: string;
  readonly corpus?: string;
  readonly analyses?: string;
}

export type PoolEvidenceCliSource =
  | { readonly kind: "json-string"; readonly value: string }
  | { readonly kind: "file"; readonly path: string }
  | { readonly kind: "catalog-paths"; readonly paths: PoolEvidenceCliPaths };

export interface PoolEvidenceCliOptions {
  readonly source: PoolEvidenceCliSource;
  readonly paths: PoolEvidenceCliPaths;
  readonly format: PoolEvidenceCliFormat;
}

export interface PoolEvidenceCliIo {
  readonly readFile: (path: string) => string;
  readonly write: (value: string) => void;
  readonly error?: (value: string) => void;
}

export class PoolEvidenceCliValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PoolEvidenceCliValidationError";
  }
}

function fail(message: string): never {
  throw new PoolEvidenceCliValidationError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value`);
  return value;
}

/** Parse explicit JSON input or the existing catalog input paths. */
export function parsePoolEvidenceArgs(argv: readonly string[]): PoolEvidenceCliOptions {
  let jsonText: string | undefined;
  let inputPath: string | undefined;
  const paths: { config?: string; corpus?: string; analyses?: string } = {};
  let format: PoolEvidenceCliFormat = "json";

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") {
      if (jsonText !== undefined || inputPath !== undefined) {
        throw new Error("exactly one explicit JSON source or catalog paths is allowed");
      }
      jsonText = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--input" || argument === "--file") {
      if (jsonText !== undefined || inputPath !== undefined) {
        throw new Error("exactly one explicit JSON source or catalog paths is allowed");
      }
      inputPath = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--config") {
      if (jsonText !== undefined || inputPath !== undefined) {
        throw new Error("exactly one explicit JSON source or catalog paths is allowed");
      }
      paths.config = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--corpus") {
      if (jsonText !== undefined || inputPath !== undefined) {
        throw new Error("exactly one explicit JSON source or catalog paths is allowed");
      }
      paths.corpus = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--analyses") {
      if (jsonText !== undefined || inputPath !== undefined) {
        throw new Error("exactly one explicit JSON source or catalog paths is allowed");
      }
      paths.analyses = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--format") {
      const value = optionValue(argv, index, argument);
      if (value !== "json" && value !== "markdown") throw new Error("--format must be json or markdown");
      format = value;
      index += 1;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }

  if (jsonText !== undefined) {
    if (Object.keys(paths).length > 0) throw new Error("exactly one explicit JSON source or catalog paths is allowed");
    return { source: { kind: "json-string", value: jsonText }, paths, format };
  }
  if (inputPath !== undefined) {
    if (Object.keys(paths).length > 0) throw new Error("exactly one explicit JSON source or catalog paths is allowed");
    return { source: { kind: "file", path: inputPath }, paths, format };
  }
  return { source: { kind: "catalog-paths", paths }, paths, format };
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value === "string") return value;
  fail(`${field} must be a string or null`);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") fail(`${field} must be a non-empty string`);
  return value;
}

function stringList(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    fail(`${field} must be an array of strings`);
  }
  return value as string[];
}

function finiteCount(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    fail(`${field} must be a non-negative integer`);
  }
  return value;
}

function nullableFiniteNumber(value: unknown, field: string): number | null {
  if (value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  fail(`${field} must be a finite number or null`);
}

function validateAudience(value: unknown, field: string): void {
  if (!isRecord(value)) fail(`${field} must be an object`);
  nullableFiniteNumber(value.size, `${field}.size`);
  nullableString(value.countType, `${field}.countType`);
  nullableString(value.provenance, `${field}.provenance`);
  nullableString(value.asOf, `${field}.asOf`);
}

function validatePoolMembershipReasons(value: unknown): void {
  if (value === undefined) return;
  if (!isRecord(value)) fail("catalog row poolMembershipReasons must be an object");
  for (const [pool, reason] of Object.entries(value)) {
    if (reason !== null && typeof reason !== "string") {
      fail(`catalog row poolMembershipReasons.${pool} must be a string or null`);
    }
  }
}

function validateCatalogRow(value: unknown, index: number): CatalogRow {
  const field = `catalog.rows[${index}]`;
  if (!isRecord(value)) fail(`${field} must be an object`);

  for (const name of ["key", "accountId", "platform"] as const) requiredString(value[name], `${field}.${name}`);
  if (value.accountIdStatus !== "derived") fail(`${field}.accountIdStatus must be derived`);
  if (value.sourceKind !== "handle" && value.sourceKind !== "source") fail(`${field}.sourceKind must be handle or source`);
  for (const name of ["handle", "creator", "niche"] as const) nullableString(value[name], `${field}.${name}`);
  for (const name of ["configured", "collected"] as const) {
    if (typeof value[name] !== "boolean") fail(`${field}.${name} must be boolean`);
  }
  validateAudience(value.audience, `${field}.audience`);
  for (const name of [
    "topics", "focus", "researchPools", "formats", "mediaForms", "popularityScopes", "sampleScopes",
    "baselineSources", "caveats",
  ] as const) stringList(value[name], `${field}.${name}`);
  for (const name of ["evidenceCount", "admissibleCount", "bodyCompleteCount", "bodyIncompleteCount"] as const) {
    finiteCount(value[name], `${field}.${name}`);
  }
  nullableString(value.lastCollectedAt, `${field}.lastCollectedAt`);
  nullableString(value.lastAnalyzedAt, `${field}.lastAnalyzedAt`);
  validatePoolMembershipReasons(value.poolMembershipReasons);
  return value as unknown as CatalogRow;
}

function validateCatalog(value: unknown, field = "input"): PatternCatalog {
  if (!isRecord(value)) fail(`${field} must be a pattern catalog object`);
  if (!Array.isArray(value.rows)) fail(`${field}.rows must be an array`);
  if (!isRecord(value.summary)) fail(`${field}.summary must be an object`);
  const summary = value.summary;
  const configuredTargets = finiteCount(summary.configuredTargets, `${field}.summary.configuredTargets`);
  const collectedSources = finiteCount(summary.collectedSources, `${field}.summary.collectedSources`);
  const configuredAndCollected = finiteCount(summary.configuredAndCollected, `${field}.summary.configuredAndCollected`);
  const configuredButUncollected = finiteCount(summary.configuredButUncollected, `${field}.summary.configuredButUncollected`);
  const evidenceCount = finiteCount(summary.evidenceCount, `${field}.summary.evidenceCount`);
  const admissibleCount = finiteCount(summary.admissibleCount, `${field}.summary.admissibleCount`);
  const bodyCompleteCount = finiteCount(summary.bodyCompleteCount, `${field}.summary.bodyCompleteCount`);
  const bodyIncompleteCount = finiteCount(summary.bodyIncompleteCount, `${field}.summary.bodyIncompleteCount`);
  return {
    rows: value.rows.map((row, index) => validateCatalogRow(row, index)),
    summary: {
      configuredTargets,
      collectedSources,
      configuredAndCollected,
      configuredButUncollected,
      evidenceCount,
      admissibleCount,
      bodyCompleteCount,
      bodyIncompleteCount,
    },
  };
}

function validateRawInputRows(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) fail(`${field} must be an array`);
  value.forEach((row, index) => {
    if (!isRecord(row)) fail(`${field}[${index}] must be an object`);
  });
  return value;
}

function validateCatalogInputs(value: unknown): {
  config: PatternMiningConfig;
  corpus: unknown[];
  analyses: unknown[];
} {
  if (!isRecord(value)) fail("catalog inputs must be an object");
  if (!isRecord(value.config)) fail("catalog inputs.config must be an object");
  const config = value.config;
  stringList(config.niches, "catalog inputs.config.niches");
  const accounts = validateRawInputRows(config.accounts, "catalog inputs.config.accounts");
  accounts.forEach((account, index) => {
    const field = `catalog inputs.config.accounts[${index}]`;
    const accountRecord = account as Record<string, unknown>;
    requiredString(accountRecord.platform, `${field}.platform`);
    requiredString(accountRecord.creator, `${field}.creator`);
    requiredString(accountRecord.niche, `${field}.niche`);
    nullableString(accountRecord.handle, `${field}.handle`);
    nullableFiniteNumber(accountRecord.followers, `${field}.followers`);
    for (const name of ["topics", "focus", "research_pools", "boards"] as const) {
      if (accountRecord[name] !== undefined) stringList(accountRecord[name], `${field}.${name}`);
    }
  });
  if (!isRecord(config.outlier_thresholds)) fail("catalog inputs.config.outlier_thresholds must be an object");
  if (!isRecord(config.targets)) fail("catalog inputs.config.targets must be an object");
  finiteCount(config.targets.corpus_size_min, "catalog inputs.config.targets.corpus_size_min");
  finiteCount(config.targets.corpus_size_max, "catalog inputs.config.targets.corpus_size_max");
  if (config.verbatim_ok !== undefined) validateRawInputRows(config.verbatim_ok, "catalog inputs.config.verbatim_ok");
  return {
    config: config as unknown as PatternMiningConfig,
    corpus: validateRawInputRows(value.corpus, "catalog inputs.corpus"),
    analyses: validateRawInputRows(value.analyses, "catalog inputs.analyses"),
  };
}

function parseJson(raw: string): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    fail("input must be valid JSON");
  }
  return parsed;
}

/** Build the same inventory as the existing module from an explicit catalog JSON artifact. */
export function buildPoolEvidenceFromJson(raw: string): PoolEvidenceInventory {
  if (typeof raw !== "string") fail("input must be JSON text");
  const parsed = parseJson(raw);
  if (!isRecord(parsed)) fail("input must be a pattern catalog object or catalog input envelope");

  const hasCatalog = Object.hasOwn(parsed, "catalog");
  const hasRawInputs = Object.hasOwn(parsed, "config") || Object.hasOwn(parsed, "corpus") || Object.hasOwn(parsed, "analyses");
  if (hasCatalog && hasRawInputs) fail("input cannot combine catalog and catalog input fields");
  if (hasCatalog) {
    return buildPoolEvidenceInventory(validateCatalog(parsed.catalog, "input.catalog"));
  }
  if (hasRawInputs) {
    const inputs = validateCatalogInputs(parsed);
    return buildPoolEvidenceInventory(buildCatalog(inputs.config, inputs.corpus, inputs.analyses));
  }
  return buildPoolEvidenceInventory(validateCatalog(parsed));
}

export const buildPoolEvidenceCliFromJson = buildPoolEvidenceFromJson;

export function renderPoolEvidence(inventory: PoolEvidenceInventory, format: PoolEvidenceCliFormat): string {
  return format === "markdown"
    ? renderPoolEvidenceMarkdown(inventory)
    : renderPoolEvidenceJson(inventory);
}

export { renderPoolEvidenceJson, renderPoolEvidenceMarkdown } from "./pool-evidence.js";

const defaultIo: PoolEvidenceCliIo = {
  readFile: (path) => readFileSync(path, "utf8"),
  write: (value) => process.stdout.write(value),
  error: (value) => process.stderr.write(value),
};

function readJsonSource(source: Exclude<PoolEvidenceCliSource, { kind: "catalog-paths" }>, io: PoolEvidenceCliIo): string {
  if (source.kind === "json-string") return source.value;
  let raw: string;
  try {
    raw = io.readFile(source.path);
  } catch {
    fail("input could not be read");
  }
  if (typeof raw !== "string") fail("input file must contain text");
  return raw;
}

/** Read-only CLI adapter with injected catalog loading and file/output I/O. */
export function main(
  argv: readonly string[] = process.argv.slice(2),
  loadInputs: typeof loadCatalogInputs = loadCatalogInputs,
  io: Partial<PoolEvidenceCliIo> = {},
): number {
  const effectiveIo: PoolEvidenceCliIo = { ...defaultIo, ...io };
  try {
    const options = parsePoolEvidenceArgs(argv);
    let inventory: PoolEvidenceInventory;
    if (options.source.kind === "catalog-paths") {
      let inputs: ReturnType<typeof loadCatalogInputs>;
      try {
        inputs = loadInputs(options.paths);
      } catch {
        fail("catalog inputs could not be loaded");
      }
      const validated = validateCatalogInputs(inputs);
      inventory = buildPoolEvidenceInventory(buildCatalog(validated.config, validated.corpus, validated.analyses));
    } else {
      inventory = buildPoolEvidenceFromJson(readJsonSource(options.source, effectiveIo));
    }
    effectiveIo.write(renderPoolEvidence(inventory, options.format));
    return 0;
  } catch (error) {
    effectiveIo.error?.(`patterns:pool-evidence: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
