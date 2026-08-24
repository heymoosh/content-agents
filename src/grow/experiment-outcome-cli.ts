import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  buildBusinessOutcome,
  buildCommentObservation,
  buildFunnelEvent,
  buildVentureInputProposal,
  type BusinessOutcome,
  type BusinessOutcomeInput,
  type CommentObservation,
  type CommentObservationInput,
  type FunnelEvent,
  type FunnelEventInput,
  type VentureInputProposal,
  type VentureInputProposalInput,
} from "../review/learning-packet.js";
import { buildExperimentOutcomeLedger, type ExperimentOutcomeLedger, type ExperimentOutcomeLedgerInput } from "./experiment-outcomes.js";
import { buildExperimentRecord, type ExperimentRecord, type ExperimentRecordInput } from "./experiment-record.js";

export const EXPERIMENT_OUTCOME_CLI_VERSION = "grow-experiment-outcome-cli-v1" as const;

export interface ExperimentOutcomeCliIo {
  readonly readFile: (path: string) => string | Promise<string>;
  readonly write: (value: string) => void | Promise<void>;
  readonly error?: (value: string) => void | Promise<void>;
}

export type ExperimentOutcomeCliSource =
  | { readonly kind: "json-string"; readonly value: string }
  | { readonly kind: "file"; readonly path: string };
export type ExperimentOutcomeCliFormat = "json" | "markdown" | "both";
export interface ExperimentOutcomeCliOptions { readonly source: ExperimentOutcomeCliSource; readonly format: ExperimentOutcomeCliFormat }

export class ExperimentOutcomeCliValidationError extends Error {
  constructor(message: string) { super(message); this.name = "ExperimentOutcomeCliValidationError"; }
}

function fail(message: string): never { throw new ExperimentOutcomeCliValidationError(message); }
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function requiredObject(source: Record<string, unknown>, field: string): Record<string, unknown> {
  if (!Object.hasOwn(source, field)) fail(`${field} is required`);
  if (!isRecord(source[field])) fail(`${field} must be an object`);
  return source[field];
}
function requiredArray(source: Record<string, unknown>, field: string): unknown[] {
  if (!Object.hasOwn(source, field)) fail(`${field} is required`);
  if (!Array.isArray(source[field])) fail(`${field} must be an array`);
  return source[field];
}
function expectedKind(source: Record<string, unknown>, field: string, kind: string): void {
  if (source.kind !== undefined && source.kind !== kind) fail(`${field}.kind must be ${kind}`);
}
function normalizeRecords<T>(value: unknown[], field: string, kind: string, build: (source: Record<string, unknown>) => T): T[] {
  return value.map((item, index) => {
    const itemField = `${field}[${index}]`;
    if (!isRecord(item)) fail(`${itemField} must be an object`);
    expectedKind(item, itemField, kind);
    try { return build(item); } catch (error) {
      fail(`${itemField}: ${error instanceof Error ? error.message : "invalid record"}`);
    }
  });
}
function uniqueIds(records: readonly { id: string }[]): void {
  const ids = new Set<string>();
  for (const record of records) {
    if (ids.has(record.id)) fail(`outcome record ids must be unique: ${record.id}`);
    ids.add(record.id);
  }
}

/** Parse the explicit, JSON-only operator envelope and normalize every supplied record. */
export function loadExperimentOutcomeEnvelope(raw: string): ExperimentOutcomeLedgerInput {
  let parsed: unknown;
  try { parsed = JSON.parse(raw) as unknown; } catch { fail("input must be valid JSON"); }
  if (!isRecord(parsed)) fail("input must be a JSON object envelope");

  const experimentSource = requiredObject(parsed, "experiment");
  if (experimentSource.recordType !== undefined && experimentSource.recordType !== "experiment") fail("experiment.recordType must be experiment");
  if (experimentSource.version !== undefined && experimentSource.version !== "grow-experiment-v1") fail("experiment.version is unsupported");
  if (experimentSource.generatesCopy !== undefined && experimentSource.generatesCopy !== false) fail("experiment.generatesCopy must be false");
  if (experimentSource.sideEffects !== undefined && experimentSource.sideEffects !== "none") fail("experiment.sideEffects must be none");
  let experiment: ExperimentRecord;
  try { experiment = buildExperimentRecord(experimentSource as unknown as ExperimentRecordInput); }
  catch (error) { fail(`experiment: ${error instanceof Error ? error.message : "invalid record"}`); }

  const commentObservations = normalizeRecords(requiredArray(parsed, "commentObservations"), "commentObservations", "comment_observation", (source) => buildCommentObservation(source as unknown as CommentObservationInput));
  const funnelEvents = normalizeRecords(requiredArray(parsed, "funnelEvents"), "funnelEvents", "funnel_event", (source) => buildFunnelEvent(source as unknown as FunnelEventInput));
  const businessOutcomes = normalizeRecords(requiredArray(parsed, "businessOutcomes"), "businessOutcomes", "business_outcome", (source) => buildBusinessOutcome(source as unknown as BusinessOutcomeInput));
  uniqueIds([...commentObservations, ...funnelEvents, ...businessOutcomes]);

  let ventureInputProposal: VentureInputProposal | undefined;
  if (parsed.ventureInputProposal !== undefined && parsed.ventureInputProposal !== null) {
    if (!isRecord(parsed.ventureInputProposal)) fail("ventureInputProposal must be an object or null");
    expectedKind(parsed.ventureInputProposal, "ventureInputProposal", "venture_input_proposal");
    try { ventureInputProposal = buildVentureInputProposal(parsed.ventureInputProposal as unknown as VentureInputProposalInput); }
    catch (error) { fail(`ventureInputProposal: ${error instanceof Error ? error.message : "invalid record"}`); }
  }
  return { experiment, commentObservations, funnelEvents, businessOutcomes, ...(ventureInputProposal === undefined ? {} : { ventureInputProposal }) };
}

export function buildExperimentOutcomeFromJson(raw: string): ExperimentOutcomeLedger {
  return buildExperimentOutcomeLedger(loadExperimentOutcomeEnvelope(raw));
}
export async function readExperimentOutcomeRequest(source: ExperimentOutcomeCliSource, io: Pick<ExperimentOutcomeCliIo, "readFile">): Promise<string> {
  if (source.kind === "json-string") return source.value;
  try {
    const value = await io.readFile(source.path);
    if (typeof value !== "string") throw new Error("not text");
    return value;
  } catch { throw new ExperimentOutcomeCliValidationError("input could not be read"); }
}
export async function buildExperimentOutcomeFromSource(source: ExperimentOutcomeCliSource, io: Pick<ExperimentOutcomeCliIo, "readFile">): Promise<ExperimentOutcomeLedger> {
  return buildExperimentOutcomeFromJson(await readExperimentOutcomeRequest(source, io));
}

export function renderExperimentOutcomeJson(ledger: ExperimentOutcomeLedger): string { return `${JSON.stringify(ledger, null, 2)}\n`; }
function cell(value: string | number | null): string { return String(value ?? "null").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim(); }
function list(values: readonly string[]): string { return cell(values.length === 0 ? null : values.join(", ")); }
export function renderExperimentOutcomeMarkdown(ledger: ExperimentOutcomeLedger): string {
  const lines = [
    "# Experiment outcome ledger", "", `Experiment: ${cell(ledger.experimentId)}`, `Readiness: ${ledger.readiness.status}`,
    `Evidence blockers: ${list([...ledger.readiness.blockers].sort())}`, `Winner: ${ledger.winner ? `${cell(ledger.winner.variantRef)} (${ledger.winner.family})` : "null"}`,
    `Auto-winner: ${ledger.autoWinner}`, `Side effects: ${ledger.sideEffects}`, `Venture proposal: ${cell(ledger.venture.proposalId)}`, "",
    "## Outcome families", "", "| Family | Count |", "|---|---:|",
  ];
  for (const family of ["attention", "conversation", "audience", "business"] as const) lines.push(`| ${family} | ${ledger.familyCounts[family]} |`);
  lines.push("", "## Linked records", "", "| ID | Family | Evidence status | Evidence refs | Caveats |", "|---|---|---|---|---|");
  for (const link of ledger.links) lines.push(`| ${cell(link.recordId)} | ${link.family} | ${cell(link.evidenceStatus)} | ${list(link.evidenceRefs)} | ${list(link.caveats)} |`);
  return `${lines.join("\n")}\n`;
}
export function renderExperimentOutcome(ledger: ExperimentOutcomeLedger, format: ExperimentOutcomeCliFormat): string {
  if (format === "json") return renderExperimentOutcomeJson(ledger);
  if (format === "markdown") return renderExperimentOutcomeMarkdown(ledger);
  return `${renderExperimentOutcomeJson(ledger)}\n${renderExperimentOutcomeMarkdown(ledger)}`;
}
function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value`);
  return value;
}
export function parseExperimentOutcomeArgs(argv: readonly string[]): ExperimentOutcomeCliOptions {
  let inputPath: string | undefined; let jsonText: string | undefined; let format: ExperimentOutcomeCliFormat = "json";
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--input" || argument === "--file") { if (inputPath !== undefined || jsonText !== undefined) throw new Error("exactly one of --json or --input/--file is allowed"); inputPath = optionValue(argv, index, argument); index += 1; }
    else if (argument === "--json") { if (inputPath !== undefined || jsonText !== undefined) throw new Error("exactly one of --json or --input/--file is allowed"); jsonText = optionValue(argv, index, argument); index += 1; }
    else if (argument === "--format") { const value = optionValue(argv, index, argument); if (value !== "json" && value !== "markdown" && value !== "both") throw new Error("--format must be json, markdown, or both"); format = value; index += 1; }
    else throw new Error(`unknown argument: ${argument}`);
  }
  if (inputPath === undefined && jsonText === undefined) throw new Error("exactly one of --json or --input/--file is required");
  return { source: inputPath === undefined ? { kind: "json-string", value: jsonText as string } : { kind: "file", path: inputPath }, format };
}
const defaultIo: ExperimentOutcomeCliIo = {
  readFile: (path) => readFile(path, "utf8"),
  write: (value) => { process.stdout.write(value); },
  error: (value) => { process.stderr.write(value); },
};
export async function main(argv: readonly string[] = process.argv.slice(2), io: Partial<ExperimentOutcomeCliIo> = {}): Promise<number> {
  try {
    const options = parseExperimentOutcomeArgs(argv);
    const effectiveIo: ExperimentOutcomeCliIo = { readFile: io.readFile ?? defaultIo.readFile, write: io.write ?? defaultIo.write, error: io.error ?? defaultIo.error };
    const ledger = await buildExperimentOutcomeFromSource(options.source, effectiveIo);
    await effectiveIo.write(renderExperimentOutcome(ledger, options.format)); return 0;
  } catch (error) {
    await (io.error ?? defaultIo.error)?.(`grow:experiment-outcome: ${error instanceof Error ? error.message : "input is invalid"}\n`); return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((exitCode) => { process.exitCode = exitCode; });
}
