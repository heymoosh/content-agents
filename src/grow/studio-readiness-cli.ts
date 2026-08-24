import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { buildCommentLearningView, type CommentLearningView } from "./comment-learning.js";
import { buildGrowDeliveryRecord, type GrowDeliveryRecord } from "./delivery-record.js";
import { createGenerationBrief, GENERATION_BRIEF_VERSION, type GenerationBrief } from "./generation-brief.js";
import { buildGrowReviewBundle, type GrowReviewBundle } from "./review-bundle.js";
import {
  buildStudioReadiness,
  type StudioReadinessGenerationRun,
  type StudioReadiness,
  type StudioReadinessInput,
  type StudioReadinessStageProjection,
  type StudioReadinessTreatmentCoverage,
  type StudioReadinessVolumePlan,
} from "./studio-readiness.js";

export const STUDIO_READINESS_CLI_VERSION = "studio-readiness-cli-v1" as const;

export interface StudioReadinessCliIo {
  readonly readFile: (path: string) => string | Promise<string>;
  readonly write: (value: string) => void | Promise<void>;
  readonly error?: (value: string) => void | Promise<void>;
}

export type StudioReadinessCliSource =
  | { readonly kind: "json-string"; readonly value: string }
  | { readonly kind: "file"; readonly path: string };

export type StudioReadinessCliFormat = "json" | "markdown" | "both";

export interface StudioReadinessCliOptions {
  readonly source: StudioReadinessCliSource;
  readonly format: StudioReadinessCliFormat;
}

export class StudioReadinessCliValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StudioReadinessCliValidationError";
  }
}

function fail(message: string): never {
  throw new StudioReadinessCliValidationError(message);
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${field} must be an object`);
  return value as Record<string, unknown>;
}

function jsonEnvelope(raw: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    fail("input must be valid JSON");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail("JSON object envelope must be an object");
  }
  return parsed as Record<string, unknown>;
}

function sourceStatus(value: unknown): StudioReadinessInput["sourceStatus"] {
  if (value === undefined || value === null) return null;
  if (value === "ready" || value === "blocked") return value;
  const source = record(value, "source");
  const status = source.status ?? record(source.readiness, "source.readiness").status;
  if (status !== "ready" && status !== "blocked") fail("source status must be ready or blocked");
  return status;
}

function isBuilt(value: unknown, kind: string): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && (value as { kind?: unknown }).kind === kind;
}

function brief(value: unknown): GenerationBrief | null {
  if (value === undefined || value === null) return null;
  const source = record(value, "generationBrief");
  const appearsBuilt = Object.hasOwn(source, "version")
    || Object.hasOwn(source, "variants")
    || Object.hasOwn(source, "kind");
  if (appearsBuilt) {
    if (source.kind !== undefined && source.kind !== "generation_brief") fail("generation brief kind must be generation_brief");
    if (source.version !== GENERATION_BRIEF_VERSION) fail(`generation brief version must be ${GENERATION_BRIEF_VERSION}`);
    if (!Array.isArray(source.variants)) fail("built generation brief variants must be an array");
    if (source.generatesCopy !== false) fail("built generation brief must not generate copy");
    if (source.sideEffects !== "none") fail("built generation brief must have no side effects");
    const templatePolicy = record(source.templateReusePolicy, "built generation brief templateReusePolicy");
    if (templatePolicy.creatorBodyCopy !== "forbidden") fail("built generation brief must forbid creator body copy");
    const modelBoundary = record(source.modelBoundary, "built generation brief modelBoundary");
    if (modelBoundary.modelInvocation !== "deferred" || modelBoundary.sideEffects !== "none") {
      fail("built generation brief model boundary is unsafe");
    }
    return source as unknown as GenerationBrief;
  }
  try { return createGenerationBrief(record(value, "generationBrief") as never); }
  catch (error) { fail(`generation brief: ${error instanceof Error ? error.message : String(error)}`); }
}

function review(value: unknown): GrowReviewBundle | null {
  if (value === undefined || value === null) return null;
  if (isBuilt(value, "grow_review_bundle")) return value as GrowReviewBundle;
  try { return buildGrowReviewBundle(record(value, "reviewBundle") as never); }
  catch (error) { fail(`review bundle: ${error instanceof Error ? error.message : String(error)}`); }
}

function delivery(value: unknown): GrowDeliveryRecord | null {
  if (value === undefined || value === null) return null;
  if (isBuilt(value, "grow_delivery_record")) return value as GrowDeliveryRecord;
  const input = record(value, "deliveryRecord");
  try { return buildGrowDeliveryRecord(input as never); }
  catch (error) { fail(`delivery record: ${error instanceof Error ? error.message : String(error)}`); }
}

function learning(value: unknown): CommentLearningView | null {
  if (value === undefined || value === null) return null;
  if (isBuilt(value, "grow_comment_learning_view")) return value as CommentLearningView;
  try { return buildCommentLearningView(record(value, "learningPacket") as never); }
  catch (error) { fail(`learning packet: ${error instanceof Error ? error.message : String(error)}`); }
}

function optionalArray(value: unknown, field: string): void {
  if (value !== undefined && !Array.isArray(value)) fail(`${field} must be an array`);
}

function optionalBoolean(value: unknown, field: string): void {
  if (value !== undefined && typeof value !== "boolean") fail(`${field} must be a boolean`);
}

function readinessObject(value: unknown, field: string): Record<string, unknown> | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    if (value !== "ready" && value !== "blocked") fail(`${field} status must be ready or blocked`);
    return null;
  }
  const result = record(value, field);
  if (result.status !== undefined && result.status !== "ready" && result.status !== "blocked") {
    fail(`${field} status must be ready or blocked`);
  }
  if (Object.hasOwn(result, "blockers")) optionalArray(result.blockers, `${field} blockers`);
  return result;
}

function volumePlan(value: unknown): StudioReadinessVolumePlan | null {
  if (value === undefined || value === null) return null;
  const plan = record(value, "volumePlan");
  if (Object.hasOwn(plan, "slots") && !Array.isArray(plan.slots)) {
    fail("volume plan slots must be an array");
  }
  for (const [index, slot] of (plan.slots as unknown[] | undefined ?? []).entries()) {
    const slotRecord = record(slot, `volume plan slot ${index + 1}`);
    if (Object.hasOwn(slotRecord, "blockers")) optionalArray(slotRecord.blockers, `volume plan slot ${index + 1} blockers`);
    readinessObject(slotRecord.readiness, `volume plan slot ${index + 1} readiness`);
    optionalBoolean(slotRecord.humanReviewRequired, `volume plan slot ${index + 1} humanReviewRequired`);
  }
  optionalBoolean(plan.humanReviewRequired, "volume plan humanReviewRequired");
  optionalBoolean(plan.generatesCopy, "volume plan generatesCopy");
  optionalBoolean(plan.creatorBodyCopyAllowed, "volume plan creatorBodyCopyAllowed");
  if (plan.sideEffects !== undefined && plan.sideEffects !== "none") fail("volume plan sideEffects must be none");
  return plan as StudioReadinessVolumePlan;
}

function generationRun(value: unknown): StudioReadinessGenerationRun | null {
  if (value === undefined || value === null) return null;
  const run = record(value, "generationRunManifest");
  if (Object.hasOwn(run, "rows") && !Array.isArray(run.rows)) {
    fail("generation run rows must be an array");
  }
  const rows = (run.rows as unknown[] | undefined) ?? [];
  for (const [index, row] of rows.entries()) {
    const rowRecord = record(row, `generation run row ${index + 1}`);
    const readiness = rowRecord.readiness;
    const readinessStatus = readiness !== null && typeof readiness === "object" && !Array.isArray(readiness)
      ? (readiness as Record<string, unknown>).status
      : undefined;
    if (typeof rowRecord.status !== "string" && typeof readinessStatus !== "string") {
      fail(`generation run row ${index + 1} must contain a status`);
    }
    if (Object.hasOwn(rowRecord, "blockers")) optionalArray(rowRecord.blockers, `generation run row ${index + 1} blockers`);
    readinessObject(rowRecord.readiness, `generation run row ${index + 1} readiness`);
    optionalBoolean(rowRecord.humanReviewRequired, `generation run row ${index + 1} humanReviewRequired`);
  }
  const coverage = run.coverage;
  if (coverage !== undefined) {
    const coverageRecord = record(coverage, "generation run coverage");
    for (const field of ["expectedVariantIds", "generatedVariantIds", "duplicateVariantIds", "missingVariantIds", "blockers"]) {
      if (Object.hasOwn(coverageRecord, field)) optionalArray(coverageRecord[field], `generation run coverage ${field}`);
    }
    if (coverageRecord.status !== undefined && coverageRecord.status !== "complete") {
      fail("generation run coverage status must be complete");
    }
    optionalBoolean(coverageRecord.oneToOne, "generation run coverage oneToOne");
  }
  optionalBoolean(run.humanReviewRequired, "generation run humanReviewRequired");
  optionalBoolean(run.generatesCopy, "generation run generatesCopy");
  optionalBoolean(run.creatorBodyCopyAllowed, "generation run creatorBodyCopyAllowed");
  optionalBoolean(run.autoApproval, "generation run autoApproval");
  optionalBoolean(run.autoScheduling, "generation run autoScheduling");
  optionalBoolean(run.autoPublishing, "generation run autoPublishing");
  if (run.sideEffects !== undefined && run.sideEffects !== "none") fail("generation run sideEffects must be none");
  return run as StudioReadinessGenerationRun;
}

function treatmentCoverage(value: unknown): StudioReadinessTreatmentCoverage | null {
  if (value === undefined || value === null) return null;
  const coverage = record(value, "treatmentCoverage");
  if (coverage.kind !== undefined && coverage.kind !== "grow_treatment_coverage") {
    fail("treatment coverage kind must be grow_treatment_coverage");
  }
  if (coverage.version !== undefined && coverage.version !== "grow-treatment-coverage-v1") {
    fail("treatment coverage version must be grow-treatment-coverage-v1");
  }
  const built = coverage.kind === "grow_treatment_coverage" || coverage.version === "grow-treatment-coverage-v1";
  const readiness = record(coverage.readiness, "treatment coverage readiness");
  if (readiness.status !== "ready" && readiness.status !== "blocked") fail("treatment coverage readiness status must be ready or blocked");
  if (Object.hasOwn(readiness, "blockers")) optionalArray(readiness.blockers, "treatment coverage readiness blockers");
  optionalBoolean(coverage.generatesCopy, "treatment coverage generatesCopy");
  optionalBoolean(coverage.creatorBodyCopyAllowed, "treatment coverage creatorBodyCopyAllowed");
  optionalBoolean(coverage.bodyFree, "treatment coverage bodyFree");
  if (coverage.sideEffects !== undefined && coverage.sideEffects !== "none") fail("treatment coverage sideEffects must be none");
  if (built && coverage.generatesCopy !== false) fail("built treatment coverage must not generate copy");
  if (built && coverage.creatorBodyCopyAllowed !== false) fail("built treatment coverage must not allow creator body copy");
  if (built && coverage.sideEffects !== "none") fail("built treatment coverage must have no side effects");
  return coverage as unknown as StudioReadinessTreatmentCoverage;
}

/** Parse the body-free operator envelope and feed only metadata to existing readiness builders. */
export function loadStudioReadinessEnvelope(raw: string): StudioReadinessInput {
  const input = jsonEnvelope(raw);
  const briefValue = input.generationBrief ?? input.brief;
  const coverageValue = input.treatmentCoverage ?? input.coverage ?? input.treatmentCoverageView;
  const volumeValue = input.volumePlan ?? input.volume ?? input.volumePlanManifest;
  const generationValue = input.generationRunManifest
    ?? input.generationRun
    ?? input.generationManifest
    ?? input.generation;
  const reviewValue = input.reviewBundle ?? input.reviewProjection ?? input.review;
  const deliveryValue = input.deliveryRecord ?? input.delivery;
  const learningValue = input.learningPacket ?? input.learning ?? input.commentLearningView ?? input.commentLearning;
  return {
    sourceStatus: sourceStatus(input.sourceStatus ?? input.source),
    brief: brief(briefValue),
    treatmentCoverage: treatmentCoverage(coverageValue),
    volumePlan: volumePlan(volumeValue),
    generationRunManifest: generationRun(generationValue),
    reviewBundle: review(reviewValue),
    delivery: delivery(deliveryValue),
    learning: learning(learningValue),
  };
}

export function buildStudioReadinessFromJson(raw: string): StudioReadiness {
  return buildStudioReadiness(loadStudioReadinessEnvelope(raw));
}

export function renderStudioReadinessJson(readiness: StudioReadiness): string {
  return `${JSON.stringify(readiness, null, 2)}\n`;
}

function cell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

export function renderStudioReadinessMarkdown(readiness: StudioReadiness): string {
  const lines = [
    "# Studio readiness",
    "",
    `Overall: ${readiness.readiness.status}`,
    `Blockers: ${readiness.readiness.blockers.length ? readiness.readiness.blockers.map(cell).join("; ") : "none"}`,
    "",
    "## Stages",
    "",
    "| Stage | Status | Blockers |",
    "|---|---|---|",
    ...readiness.stages.map((stage: StudioReadinessStageProjection) => `| ${stage.stage} | ${stage.status} | ${stage.blockers.length ? stage.blockers.map(cell).join("; ") : "none"} |`),
    "",
    "## Human gates",
    "",
    "| Gate | Status | Blockers |",
    "|---|---|---|",
    ...(Object.entries(readiness.gates) as Array<[string, StudioReadiness["gates"][keyof StudioReadiness["gates"]]]>)
      .map(([name, gate]) => `| ${name} | ${gate.status} | ${gate.blockers.length ? gate.blockers.map(cell).join("; ") : "none"} |`),
    "",
    "## Safety boundary",
    "",
    `- Generates copy: ${readiness.generatesCopy}`,
    `- Creator body copy allowed: ${readiness.creatorBodyCopyAllowed}`,
    `- Auto-publishing: ${readiness.autoPublishing}`,
    `- Side effects: ${readiness.sideEffects}`,
  ];
  return `${lines.join("\n")}\n`;
}

export function renderStudioReadiness(readiness: StudioReadiness, format: StudioReadinessCliFormat): string {
  if (format === "json") return renderStudioReadinessJson(readiness);
  if (format === "markdown") return renderStudioReadinessMarkdown(readiness);
  return `${renderStudioReadinessJson(readiness)}\n${renderStudioReadinessMarkdown(readiness)}`;
}

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value`);
  return value;
}

export function parseStudioReadinessArgs(argv: readonly string[]): StudioReadinessCliOptions {
  let jsonText: string | undefined;
  let file: string | undefined;
  let format: StudioReadinessCliFormat = "json";
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") { jsonText = optionValue(argv, index, argument); index += 1; }
    else if (argument === "--file") { file = optionValue(argv, index, argument); index += 1; }
    else if (argument === "--format") {
      const value = optionValue(argv, index, argument);
      if (value !== "json" && value !== "markdown" && value !== "both") throw new Error("--format must be json, markdown, or both");
      format = value; index += 1;
    } else throw new Error(`unknown argument: ${argument}`);
  }
  if (jsonText !== undefined && file !== undefined) throw new Error("exactly one of --json or --file is allowed");
  if (jsonText === undefined && file === undefined) throw new Error("exactly one of --json or --file is required");
  return { source: jsonText === undefined ? { kind: "file", path: file as string } : { kind: "json-string", value: jsonText }, format };
}

const defaultIo: StudioReadinessCliIo = {
  readFile: (path) => readFile(path, "utf8"),
  write: (value) => { process.stdout.write(value); },
  error: (value) => { process.stderr.write(value); },
};

export async function main(argv: readonly string[] = process.argv.slice(2), io: Partial<StudioReadinessCliIo> = {}): Promise<number> {
  const effectiveIo = { ...defaultIo, ...io };
  try {
    const options = parseStudioReadinessArgs(argv);
    const raw = options.source.kind === "json-string" ? options.source.value : await effectiveIo.readFile(options.source.path);
    if (typeof raw !== "string") fail("input file must contain text");
    await effectiveIo.write(renderStudioReadiness(buildStudioReadiness(loadStudioReadinessEnvelope(raw)), options.format));
    return 0;
  } catch (error) {
    await effectiveIo.error?.(`grow:studio-readiness: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((exitCode) => { process.exitCode = exitCode; });
}
