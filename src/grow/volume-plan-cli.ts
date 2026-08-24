import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { pathToFileURL } from "node:url";

import {
  createGenerationBrief,
  GENERATION_BRIEF_VERSION,
  type GenerationBrief,
  type GenerationBriefInput,
  type GenerationPlatformFormatReadinessFact,
} from "./generation-brief.js";
import {
  createVolumePlan,
  type VolumeOverrides,
  type VolumePlan,
  type VolumePlanSlot,
} from "./volume-plan.js";

export const VOLUME_PLAN_CLI_VERSION = "volume-plan-cli-v1" as const;

export interface VolumePlanCliIo {
  readonly readFile: (path: string) => string | Promise<string>;
  readonly write: (value: string) => void | Promise<void>;
  readonly error?: (value: string) => void | Promise<void>;
}

export type VolumePlanCliSource =
  | { readonly kind: "json-string"; readonly value: string }
  | { readonly kind: "file"; readonly path: string };

export type VolumePlanCliFormat = "json" | "markdown" | "both";

export interface VolumePlanCliOptions {
  readonly source: VolumePlanCliSource;
  readonly format: VolumePlanCliFormat;
}

export class VolumePlanCliValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VolumePlanCliValidationError";
  }
}

type JsonRecord = Record<string, unknown>;

function fail(message: string): never {
  throw new VolumePlanCliValidationError(message);
}

function record(value: unknown, field: string): JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${field} must be an object`);
  }
  return value as JsonRecord;
}

function assertAllowedFields(value: JsonRecord, allowed: ReadonlySet<string>, label: string): void {
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) fail(`${label} contains unsupported field "${field}"`);
  }
}

function jsonEnvelope(raw: string): JsonRecord {
  if (typeof raw !== "string") fail("input must contain text");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    fail("input must be valid JSON");
  }

  const envelope = record(parsed, "JSON object envelope");
  assertAllowedFields(envelope, new Set(["generationBrief", "volumeOverrides"]), "input envelope");
  if (!Object.hasOwn(envelope, "generationBrief")) fail("generationBrief is required");
  return envelope;
}

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value`);
  return value;
}

export function parseVolumePlanArgs(argv: readonly string[]): VolumePlanCliOptions {
  let jsonText: string | undefined;
  let file: string | undefined;
  let format: VolumePlanCliFormat = "json";
  let jsonSeen = false;
  let fileSeen = false;
  let formatSeen = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") {
      if (jsonSeen) throw new Error("--json may only be supplied once");
      jsonSeen = true;
      jsonText = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--file") {
      if (fileSeen) throw new Error("--file may only be supplied once");
      fileSeen = true;
      file = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--format") {
      if (formatSeen) throw new Error("--format may only be supplied once");
      formatSeen = true;
      const value = optionValue(argv, index, argument);
      if (value !== "json" && value !== "markdown" && value !== "both") {
        throw new Error("--format must be json, markdown, or both");
      }
      format = value;
      index += 1;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }

  if (jsonText !== undefined && file !== undefined) {
    throw new Error("exactly one of --json or --file is allowed");
  }
  if (jsonText === undefined && file === undefined) {
    throw new Error("exactly one of --json or --file is required");
  }

  return {
    source: jsonText === undefined
      ? { kind: "file", path: file as string }
      : { kind: "json-string", value: jsonText },
    format,
  };
}

const generationBriefInputFields = new Set([
  "sourceReference",
  "substanceReference",
  "goal",
  "platforms",
  "formats",
  "mediaModes",
  "topicLanes",
  "patternTemplateRefs",
  "dailyVolumePerPlatform",
  "experimentMatrix",
  "platformFormatReadiness",
]);

const generationBriefBuiltFields = new Set([
  "version",
  "sourceReference",
  "substanceReference",
  "goal",
  "platforms",
  "formats",
  "mediaModes",
  "topicLanes",
  "patternTemplateRefs",
  "dailyVolumePerPlatform",
  "experimentMatrix",
  "variants",
  "templateReusePolicy",
  "humanGate",
  "reviewGate",
  "modelBoundary",
  "generatesCopy",
  "sideEffects",
  "kind",
]);

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    fail(`${field} must be an array of strings`);
  }
  return value as string[];
}

function readinessFactsFromBuilt(value: JsonRecord): readonly GenerationPlatformFormatReadinessFact[] | undefined {
  const platforms = stringArray(value.platforms, "built generation brief platforms");
  const formats = stringArray(value.formats, "built generation brief formats");
  const variants = value.variants;
  if (!Array.isArray(variants)) fail("built generation brief variants must be an array");

  const variantRecords = variants.map((variant, index) => record(variant, `built generation brief variant ${index + 1}`));
  const hasReadiness = variantRecords.some((variant) => Object.hasOwn(variant, "readiness"));
  if (!hasReadiness) return undefined;

  const facts: GenerationPlatformFormatReadinessFact[] = [];
  for (const platform of platforms) {
    for (const format of formats) {
      const matching = variantRecords.filter(
        (variant) => variant.platform === platform && variant.format === format,
      );
      if (!matching.length) fail(`built generation brief has no variants for ${platform}/${format}`);

      const present = matching.filter((variant) => Object.hasOwn(variant, "readiness"));
      if (present.length !== 0 && present.length !== matching.length) {
        fail(`built generation brief has inconsistent readiness for ${platform}/${format}`);
      }
      if (!present.length) continue;

      const firstReadiness = record(present[0]?.readiness, `built readiness for ${platform}/${format}`);
      const status = firstReadiness.status;
      const blockers = firstReadiness.blockers;
      if (status !== "ready" && status !== "blocked") {
        fail(`built readiness for ${platform}/${format} must be ready or blocked`);
      }
      if (!Array.isArray(blockers) || blockers.some((blocker) => typeof blocker !== "string")) {
        fail(`built readiness blockers for ${platform}/${format} must be an array of strings`);
      }
      for (const variant of present.slice(1)) {
        if (!isDeepStrictEqual(variant.readiness, firstReadiness)) {
          fail(`built generation brief has inconsistent readiness for ${platform}/${format}`);
        }
      }
      facts.push({
        platform,
        format,
        readiness: {
          status,
          blockers: blockers as string[],
        },
      });
    }
  }
  return facts;
}

function isBuiltGenerationBrief(value: JsonRecord): boolean {
  return Object.hasOwn(value, "version")
    || Object.hasOwn(value, "variants")
    || Object.hasOwn(value, "templateReusePolicy")
    || value.kind === "generation_brief";
}

function buildGenerationBriefFromBuilt(value: JsonRecord): GenerationBrief {
  assertAllowedFields(value, generationBriefBuiltFields, "built generation brief");
  if (value.kind !== undefined && value.kind !== "generation_brief") {
    fail("built generation brief kind must be generation_brief");
  }
  if (value.version !== GENERATION_BRIEF_VERSION) {
    fail(`built generation brief version must be ${GENERATION_BRIEF_VERSION}`);
  }

  const input: GenerationBriefInput = {
    sourceReference: value.sourceReference as string,
    substanceReference: value.substanceReference as string,
    goal: value.goal as string,
    platforms: value.platforms as string[],
    formats: value.formats as string[],
    mediaModes: value.mediaModes as string[],
    topicLanes: value.topicLanes as string[],
    patternTemplateRefs: value.patternTemplateRefs as string[],
    dailyVolumePerPlatform: value.dailyVolumePerPlatform as Readonly<Record<string, number>>,
    experimentMatrix: value.experimentMatrix === null
      ? undefined
      : value.experimentMatrix as GenerationBriefInput["experimentMatrix"],
    platformFormatReadiness: readinessFactsFromBuilt(value),
  };

  let rebuilt: GenerationBrief;
  try {
    rebuilt = createGenerationBrief(input);
  } catch (error) {
    fail(`built generation brief: ${error instanceof Error ? error.message : String(error)}`);
  }

  const candidate = { ...value };
  delete candidate.kind;
  if (!isDeepStrictEqual(candidate, rebuilt)) {
    fail("built generation brief does not match the canonical generation brief shape");
  }
  return rebuilt;
}

function buildGenerationBrief(value: unknown): GenerationBrief {
  const input = record(value, "generationBrief");
  if (isBuiltGenerationBrief(input)) return buildGenerationBriefFromBuilt(input);
  assertAllowedFields(input, generationBriefInputFields, "generation brief input");
  try {
    return createGenerationBrief(input as unknown as GenerationBriefInput);
  } catch (error) {
    fail(`generation brief: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function volumeOverrides(value: unknown): VolumeOverrides | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("volumeOverrides must be a platform map");
  }
  return value as VolumeOverrides;
}

export function loadVolumePlanEnvelope(raw: string): {
  readonly generationBrief: GenerationBrief;
  readonly volumeOverrides?: VolumeOverrides;
} {
  const envelope = jsonEnvelope(raw);
  return {
    generationBrief: buildGenerationBrief(envelope.generationBrief),
    ...(Object.hasOwn(envelope, "volumeOverrides")
      ? { volumeOverrides: volumeOverrides(envelope.volumeOverrides) }
      : {}),
  };
}

export function buildVolumePlanFromJson(raw: string): VolumePlan {
  const envelope = loadVolumePlanEnvelope(raw);
  try {
    return createVolumePlan(envelope.generationBrief, envelope.volumeOverrides);
  } catch (error) {
    fail(`volume plan: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function readVolumePlanEnvelope(
  source: VolumePlanCliSource,
  io: Pick<VolumePlanCliIo, "readFile">,
): Promise<string> {
  if (source.kind === "json-string") return source.value;
  const value = await io.readFile(source.path);
  if (typeof value !== "string") fail("input file must contain text");
  return value;
}

export async function buildVolumePlanFromSource(
  source: VolumePlanCliSource,
  io: Pick<VolumePlanCliIo, "readFile">,
): Promise<VolumePlan> {
  return buildVolumePlanFromJson(await readVolumePlanEnvelope(source, io));
}

export function renderVolumePlanJson(plan: VolumePlan): string {
  return `${JSON.stringify(plan, null, 2)}\n`;
}

function markdownText(value: string): string {
  return value.replace(/`/g, "'").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function experimentText(slot: VolumePlanSlot): string {
  if (!slot.experimentAssignment) return "none";
  return Object.entries(slot.experimentAssignment)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([name, option]) => `${name}=${option}`)
    .join(", ");
}

function blockersText(slot: VolumePlanSlot): string {
  return slot.blockers.length ? slot.blockers.map(markdownText).join("; ") : "none";
}

function gateText(slot: VolumePlanSlot): string {
  return `${slot.humanGate.status} before ${slot.humanGate.before} (owner: ${slot.humanGate.approvalOwner})`;
}

export function renderVolumePlanMarkdown(plan: VolumePlan): string {
  const lines = [
    "# Volume plan",
    "",
    `- Source reference: \`${markdownText(plan.sourceReference)}\``,
    `- Substance reference: \`${markdownText(plan.substanceReference)}\``,
    `- Slots: ${plan.slots.length}`,
    `- Human review required: ${plan.humanReviewRequired}`,
    `- Generates copy: ${plan.generatesCopy}`,
    `- Side effects: ${plan.sideEffects}`,
    "",
    "## Slots",
    "",
    "| Platform | Day index | Slot index | Variant | Experiment | Readiness | Blockers | Human gate |",
    "|---|---:|---:|---|---|---|---|---|",
    ...plan.slots.map((slot) => [
      markdownText(slot.platform),
      String(slot.dayIndex),
      String(slot.slotIndex),
      markdownText(slot.variantId),
      markdownText(experimentText(slot)),
      slot.readiness,
      blockersText(slot),
      gateText(slot),
    ].map(markdownText).join(" | ").replace(/^/, "| ").concat(" |")),
  ];
  return `${lines.join("\n")}\n`;
}

export function renderVolumePlan(plan: VolumePlan, format: VolumePlanCliFormat): string {
  if (format === "json") return renderVolumePlanJson(plan);
  if (format === "markdown") return renderVolumePlanMarkdown(plan);
  return `${renderVolumePlanJson(plan)}\n${renderVolumePlanMarkdown(plan)}`;
}

const defaultIo: VolumePlanCliIo = {
  readFile: (path) => readFile(path, "utf8"),
  write: (value) => { process.stdout.write(value); },
  error: (value) => { process.stderr.write(value); },
};

export async function main(
  argv: readonly string[] = process.argv.slice(2),
  io: Partial<VolumePlanCliIo> = {},
): Promise<number> {
  const effectiveIo = { ...defaultIo, ...io };
  try {
    const options = parseVolumePlanArgs(argv);
    const plan = await buildVolumePlanFromSource(options.source, effectiveIo);
    await effectiveIo.write(renderVolumePlan(plan, options.format));
    return 0;
  } catch (error) {
    await effectiveIo.error?.(`grow:volume-plan: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((exitCode) => { process.exitCode = exitCode; });
}
