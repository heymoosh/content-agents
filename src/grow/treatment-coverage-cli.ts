import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  buildGrowTreatmentCoverage,
  type GrowTreatmentCandidateInput,
  type GrowTreatmentCoverage,
  type GrowTreatmentCoverageInput,
  type GrowTreatmentIdentityInput,
} from "./treatment-coverage.js";

export const GROW_TREATMENT_COVERAGE_CLI_VERSION = "grow-treatment-coverage-cli-v1" as const;
export type GrowTreatmentCoverageCliFormat = "json" | "markdown" | "both";
export type GrowTreatmentCoverageCliSource = { readonly kind: "json"; readonly value: string } | { readonly kind: "file"; readonly path: string };
export interface GrowTreatmentCoverageCliOptions { readonly source: GrowTreatmentCoverageCliSource; readonly format: GrowTreatmentCoverageCliFormat }

export class GrowTreatmentCoverageCliValidationError extends Error {
  constructor(message: string) { super(message); this.name = "GrowTreatmentCoverageCliValidationError"; }
}

function fail(message: string): never { throw new GrowTreatmentCoverageCliValidationError(message); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) fail(`${option} requires a value`);
  return value;
}
function requiredArray(value: Record<string, unknown>, field: string): unknown[] {
  if (!Array.isArray(value[field])) fail(`${field} must be an array`);
  return value[field];
}

/** Parse an explicit treatment-request/candidate envelope without accepting copy or asset fields. */
export function parseGrowTreatmentCoverageInput(raw: string): GrowTreatmentCoverageInput {
  let parsed: unknown;
  try { parsed = JSON.parse(raw) as unknown; } catch { fail("input must be valid JSON"); }
  if (!isRecord(parsed)) fail("input must be an object envelope");
  const requestedField = ["requestedTreatments", "requested", "treatments"].find((field) => Object.hasOwn(parsed, field));
  if (requestedField === undefined) fail("requestedTreatments is required");
  const requested = requiredArray(parsed, requestedField);
  requested.forEach((item, index) => { if (!isRecord(item)) fail(`${requestedField}[${index}] must be an object`); });
  const candidates = requiredArray(parsed, "candidates");
  candidates.forEach((item, index) => { if (!isRecord(item)) fail(`candidates[${index}] must be an object`); });
  return {
    [requestedField]: requested as GrowTreatmentIdentityInput[],
    candidates: candidates as GrowTreatmentCandidateInput[],
  } as GrowTreatmentCoverageInput;
}

export function renderGrowTreatmentCoverageJson(report: GrowTreatmentCoverage): string { return `${JSON.stringify(report, null, 2)}\n`; }

function cell(value: string): string { return value.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim(); }

export function renderGrowTreatmentCoverageMarkdown(report: GrowTreatmentCoverage): string {
  const lines = [
    "# Grow treatment coverage", "",
    `Overall: ${report.readiness.status}`,
    `Requested: ${report.summary.requested}; matched: ${report.summary.matched}; missing: ${report.summary.missing}; duplicate: ${report.summary.duplicate}; blocked: ${report.summary.blocked}; unexpected: ${report.summary.unexpected}`,
    "",
    "| Platform | Medium | Format | Treatment | Experiment | Variables | Status | Candidate IDs | Blockers |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...report.rows.map((row) => `| ${cell(row.identity.platform)} | ${cell(row.identity.medium)} | ${cell(row.identity.format)} | ${cell(row.identity.treatmentId)} | ${cell(row.identity.experimentId ?? "null")} | ${cell(Object.entries(row.identity.variables).map(([key, value]) => `${key}=${value}`).join(", ") || "null")} | ${row.status} | ${cell(row.candidateIds.join(", ") || "null")} | ${cell(row.readiness.blockers.join("; ") || "none")} |`),
    "",
    `Generates copy: ${report.generatesCopy}; creator body copy allowed: ${report.creatorBodyCopyAllowed}; side effects: ${report.sideEffects}`,
  ];
  return `${lines.join("\n")}\n`;
}

export function renderGrowTreatmentCoverage(report: GrowTreatmentCoverage, format: GrowTreatmentCoverageCliFormat): string {
  if (format === "json") return renderGrowTreatmentCoverageJson(report);
  if (format === "markdown") return renderGrowTreatmentCoverageMarkdown(report);
  return `${renderGrowTreatmentCoverageJson(report)}\n${renderGrowTreatmentCoverageMarkdown(report)}`;
}

export function parseGrowTreatmentCoverageArgs(argv: readonly string[]): GrowTreatmentCoverageCliOptions {
  let source: GrowTreatmentCoverageCliSource | undefined;
  let format: GrowTreatmentCoverageCliFormat = "json";
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
    const options = parseGrowTreatmentCoverageArgs(argv);
    const raw = options.source.kind === "json" ? options.source.value : readFileSync(options.source.path, "utf8");
    const report = buildGrowTreatmentCoverage(parseGrowTreatmentCoverageInput(raw));
    (io.write ?? ((value: string) => process.stdout.write(value)))(renderGrowTreatmentCoverage(report, options.format));
    return 0;
  } catch (error) {
    (io.error ?? ((value: string) => process.stderr.write(value)))(`grow:treatment-coverage: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
