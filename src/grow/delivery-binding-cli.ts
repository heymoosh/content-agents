import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  buildGrowDeliveryBinding,
  type GrowDeliveryBinding,
  type GrowDeliveryBindingInput,
} from "./delivery-binding.js";

export const GROW_DELIVERY_BINDING_CLI_VERSION = "grow-delivery-binding-cli-v1" as const;

export type GrowDeliveryBindingCliFormat = "json" | "markdown" | "both";
export type GrowDeliveryBindingCliSource =
  | { readonly kind: "json-string"; readonly value: string }
  | { readonly kind: "file"; readonly path: string };

export interface GrowDeliveryBindingCliOptions {
  readonly source: GrowDeliveryBindingCliSource;
  readonly format: GrowDeliveryBindingCliFormat;
}

export interface GrowDeliveryBindingCliIo {
  readonly readFile: (path: string) => string | Promise<string>;
  readonly write: (value: string) => void | Promise<void>;
  readonly error?: (value: string) => void | Promise<void>;
}

export class GrowDeliveryBindingCliValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GrowDeliveryBindingCliValidationError";
  }
}

type JsonRecord = Record<string, unknown>;

function fail(message: string): never {
  throw new GrowDeliveryBindingCliValidationError(message);
}

function record(value: unknown, label: string): JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(label + " must be an object");
  return value as JsonRecord;
}

function allowed(value: JsonRecord, fields: readonly string[], label: string): void {
  const set = new Set(fields);
  for (const field of Object.keys(value)) {
    if (!set.has(field)) fail(label + ' contains unsupported field "' + field + '"');
  }
}

function nonEmpty(value: unknown, label: string): void {
  if (typeof value !== "string" || value.trim() === "") fail(label + " must be a non-empty string");
}

function nullableText(value: unknown, label: string): void {
  if (value !== undefined && value !== null) nonEmpty(value, label);
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) fail(label + " must be an array");
  return value;
}

function reference(value: unknown, label: string): void {
  const item = record(value, label);
  allowed(item, ["recordType", "id", "relation"], label);
  nonEmpty(item.recordType, label + ".recordType");
  nonEmpty(item.id, label + ".id");
  nullableText(item.relation, label + ".relation");
}

function referenceArray(value: unknown, label: string): void {
  array(value, label).forEach((item, index) => reference(item, label + "[" + index + "]"));
}

function lineage(value: unknown, label: string, allowNull = true): void {
  if (value === null && allowNull) return;
  const item = record(value, label);
  allowed(item, ["sourceId", "cutId", "variantId", "treatmentId", "experimentId", "publishId"], label);
  for (const key of ["sourceId", "cutId", "variantId", "treatmentId", "experimentId", "publishId"]) {
    nullableText(item[key], label + "." + key);
  }
}

function readiness(value: unknown, label: string): void {
  const item = record(value, label);
  allowed(item, ["status", "blockers"], label);
  if (item.status !== "ready" && item.status !== "blocked") fail(label + ".status must be ready or blocked");
  const blockers = array(item.blockers, label + ".blockers");
  blockers.forEach((blocker, index) => nonEmpty(blocker, label + ".blockers[" + index + "]"));
}

function reviewBundle(value: unknown): void {
  const item = record(value, "reviewBundle");
  allowed(item, [
    "kind", "version", "id", "sourceRef", "cutRef", "variantRefs", "publishRefs", "lineage",
    "evidenceStatus", "evidenceRefs", "evidenceNote", "voiceCheck", "originalityCheck",
    "readiness", "humanDecision", "status", "generatesCopy", "sideEffects",
  ], "reviewBundle");
  if (item.kind !== "grow_review_bundle") fail("reviewBundle.kind must be grow_review_bundle");
  if (item.version !== "grow-review-bundle-v1") fail("reviewBundle.version must be grow-review-bundle-v1");
  nonEmpty(item.id, "reviewBundle.id");
  reference(item.sourceRef, "reviewBundle.sourceRef");
  reference(item.cutRef, "reviewBundle.cutRef");
  referenceArray(item.variantRefs, "reviewBundle.variantRefs");
  if (item.publishRefs !== null) referenceArray(item.publishRefs, "reviewBundle.publishRefs");
  if (item.lineage !== null) referenceArray(item.lineage, "reviewBundle.lineage");
  array(item.evidenceRefs, "reviewBundle.evidenceRefs").forEach((ref, index) => nonEmpty(ref, "reviewBundle.evidenceRefs[" + index + "]"));
  readiness(item.readiness, "reviewBundle.readiness");
  const decision = record(item.humanDecision, "reviewBundle.humanDecision");
  allowed(decision, ["status", "decidedBy", "decidedAt", "note"], "reviewBundle.humanDecision");
  nullableText(decision.decidedBy, "reviewBundle.humanDecision.decidedBy");
  nullableText(decision.decidedAt, "reviewBundle.humanDecision.decidedAt");
  nullableText(decision.note, "reviewBundle.humanDecision.note");
  if (item.generatesCopy !== false) fail("reviewBundle.generatesCopy must be false");
  if (item.sideEffects !== "none") fail("reviewBundle.sideEffects must be none");
}

function candidate(value: unknown): void {
  const item = record(value, "candidate");
  allowed(item, ["id", "day", "platform", "variantId", "lineage"], "candidate");
  nonEmpty(item.id, "candidate.id");
  nonEmpty(item.day, "candidate.day");
  nonEmpty(item.platform, "candidate.platform");
  nullableText(item.variantId, "candidate.variantId");
  const candidateLineage = record(item.lineage, "candidate.lineage");
  allowed(candidateLineage, ["sourceId", "cutId", "variantId", "treatmentId", "experimentId"], "candidate.lineage");
  for (const key of ["sourceId", "cutId", "variantId", "treatmentId", "experimentId"]) nonEmpty(candidateLineage[key], "candidate.lineage." + key);
}

function capacitySlice(value: unknown): void {
  const item = record(value, "capacitySlice");
  allowed(item, [
    "day", "platform", "candidateCount", "approvedCount", "rejectedCount", "blockedCount",
    "reviewCapacity", "slotCapacity", "scheduledCount", "availableSlots", "approvedPublishCount",
    "paused", "pauseReasons", "rollbackConditions", "gapReasons",
  ], "capacitySlice");
  nonEmpty(item.day, "capacitySlice.day");
  nonEmpty(item.platform, "capacitySlice.platform");
  for (const key of ["pauseReasons", "gapReasons"]) {
    array(item[key], "capacitySlice." + key).forEach((entry, index) => nonEmpty(entry, "capacitySlice." + key + "[" + index + "]"));
  }
  const rollbacks = array(item.rollbackConditions, "capacitySlice.rollbackConditions");
  rollbacks.forEach((entry, index) => {
    const rollback = record(entry, "capacitySlice.rollbackConditions[" + index + "]");
    allowed(rollback, ["platform", "day", "condition", "reason", "evidence"], "capacitySlice.rollbackConditions[" + index + "]");
    nonEmpty(rollback.platform, "capacitySlice.rollbackConditions[" + index + "].platform");
    nullableText(rollback.day, "capacitySlice.rollbackConditions[" + index + "].day");
    nonEmpty(rollback.condition, "capacitySlice.rollbackConditions[" + index + "].condition");
    nonEmpty(rollback.reason, "capacitySlice.rollbackConditions[" + index + "].reason");
    nullableText(rollback.evidence, "capacitySlice.rollbackConditions[" + index + "].evidence");
  });
}

function facts(value: unknown, label: "queueFacts" | "schedulerFacts"): void {
  const item = record(value, label);
  const identifier = label === "queueFacts" ? "artifactId" : "deliveryId";
  allowed(item, [identifier, "status", "lineage", "readiness", "sideEffects"], label);
  nullableText(item[identifier], label + "." + identifier);
  nonEmpty(item.status, label + ".status");
  lineage(item.lineage, label + ".lineage");
  readiness(item.readiness, label + ".readiness");
  if (item.sideEffects !== "none") fail(label + ".sideEffects must be none");
}

function providerFacts(value: unknown): void {
  const item = record(value, "providerFacts");
  allowed(item, ["provider", "reference", "scheduledAt", "liveCheck"], "providerFacts");
  nonEmpty(item.provider, "providerFacts.provider");
  nullableText(item.reference, "providerFacts.reference");
  nullableText(item.scheduledAt, "providerFacts.scheduledAt");
  if (item.liveCheck === null) return;
  const live = record(item.liveCheck, "providerFacts.liveCheck");
  allowed(live, ["status", "checkedAt", "liveAt"], "providerFacts.liveCheck");
  if (!["not_confirmed", "confirmed", "unavailable"].includes(String(live.status))) {
    fail("providerFacts.liveCheck.status is invalid");
  }
  nullableText(live.checkedAt, "providerFacts.liveCheck.checkedAt");
  nullableText(live.liveAt, "providerFacts.liveCheck.liveAt");
}

function parseEnvelope(raw: string): JsonRecord {
  if (typeof raw !== "string") fail("input must contain text");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    fail("input must be valid JSON");
  }
  const envelope = record(parsed, "JSON object envelope");
  allowed(envelope, [
    "reviewBundle", "candidate", "capacitySlice", "queueFacts", "schedulerFacts", "providerFacts", "deliveryMode",
  ], "input envelope");
  if (!Object.hasOwn(envelope, "reviewBundle")) fail("reviewBundle is required");
  if (!Object.hasOwn(envelope, "candidate")) fail("candidate is required");
  if (!Object.hasOwn(envelope, "capacitySlice")) fail("capacitySlice is required");
  if (!Object.hasOwn(envelope, "queueFacts")) fail("queueFacts is required");
  if (!Object.hasOwn(envelope, "schedulerFacts")) fail("schedulerFacts is required");
  if (!Object.hasOwn(envelope, "providerFacts")) fail("providerFacts is required");
  reviewBundle(envelope.reviewBundle);
  candidate(envelope.candidate);
  capacitySlice(envelope.capacitySlice);
  facts(envelope.queueFacts, "queueFacts");
  facts(envelope.schedulerFacts, "schedulerFacts");
  if (envelope.providerFacts !== null) providerFacts(envelope.providerFacts);
  if (envelope.deliveryMode !== undefined && envelope.deliveryMode !== null) nonEmpty(envelope.deliveryMode, "deliveryMode");
  return envelope;
}

export function parseGrowDeliveryBindingInput(raw: string): GrowDeliveryBindingInput {
  return parseEnvelope(raw) as unknown as GrowDeliveryBindingInput;
}

export function buildGrowDeliveryBindingFromJson(raw: string): GrowDeliveryBinding {
  return buildGrowDeliveryBinding(parseGrowDeliveryBindingInput(raw));
}

export async function readGrowDeliveryBindingInput(
  source: GrowDeliveryBindingCliSource,
  io: Pick<GrowDeliveryBindingCliIo, "readFile">,
): Promise<string> {
  if (source.kind === "json-string") return source.value;
  const value = await io.readFile(source.path);
  if (typeof value !== "string") fail("input file must contain text");
  return value;
}

export async function buildGrowDeliveryBindingFromSource(
  source: GrowDeliveryBindingCliSource,
  io: Pick<GrowDeliveryBindingCliIo, "readFile">,
): Promise<GrowDeliveryBinding> {
  return buildGrowDeliveryBindingFromJson(await readGrowDeliveryBindingInput(source, io));
}

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(option + " requires a value");
  return value;
}

export function parseGrowDeliveryBindingArgs(argv: readonly string[]): GrowDeliveryBindingCliOptions {
  let jsonText: string | undefined;
  let file: string | undefined;
  let format: GrowDeliveryBindingCliFormat = "json";
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") {
      if (jsonText !== undefined) throw new Error("--json may only be supplied once");
      jsonText = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--file") {
      if (file !== undefined) throw new Error("--file may only be supplied once");
      file = optionValue(argv, index, argument);
      index += 1;
    } else if (argument === "--format") {
      const value = optionValue(argv, index, argument);
      if (value !== "json" && value !== "markdown" && value !== "both") {
        throw new Error("--format must be json, markdown, or both");
      }
      format = value;
      index += 1;
    } else {
      throw new Error("unknown argument: " + argument);
    }
  }
  if (jsonText !== undefined && file !== undefined) throw new Error("exactly one of --json or --file is allowed");
  if (jsonText === undefined && file === undefined) throw new Error("exactly one of --json or --file is required");
  return {
    source: jsonText === undefined ? { kind: "file", path: file as string } : { kind: "json-string", value: jsonText },
    format,
  };
}

export function renderGrowDeliveryBindingJson(view: GrowDeliveryBinding): string {
  return JSON.stringify(view, null, 2) + "\n";
}

function markdownText(value: string): string {
  return value.replace(String.fromCharCode(96), "'").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function blockersText(values: readonly string[]): string {
  return values.length === 0 ? "none" : values.map(markdownText).join("; ");
}

export function renderGrowDeliveryBindingMarkdown(view: GrowDeliveryBinding): string {
  const lines = [
    "# Grow delivery binding",
    "",
    "- Version: " + markdownText(view.version),
    "- Delivery: " + markdownText(view.deliveryId),
    "- Candidate: " + markdownText(view.candidateId ?? "none"),
    "- Placement: " + markdownText(view.day ?? "none") + " / " + markdownText(view.platform ?? "none"),
    "- Status: " + view.status,
    "- Overall readiness: " + view.readiness.status,
    "- Blockers: " + blockersText(view.readiness.blockers),
    "- Lineage: " + (view.lineage === null ? "blocked" : [
      view.lineage.sourceId, view.lineage.cutId, view.lineage.variantId, view.lineage.treatmentId, view.lineage.experimentId,
    ].map(markdownText).join(" / ")),
    "",
    "## Safety boundary",
    "",
    "- Body-free: " + view.bodyFree,
    "- Generates copy: " + view.generatesCopy,
    "- Creator body copy allowed: " + view.creatorBodyCopyAllowed,
    "- Human approval required: " + view.humanApprovalRequired,
    "- Auto-approval: " + view.autoApproval,
    "- Auto-scheduling: " + view.autoScheduling,
    "- Auto-publishing: " + view.autoPublishing,
    "- Side effects: " + view.sideEffects,
    "",
    "## Evidence checks",
    "",
    "| Review | Lineage | Capacity | Queue | Scheduler | Provider | Live |",
    "|---|---|---|---|---|---|---|",
    "| " + view.checks.review + " | " + view.checks.lineage + " | " + view.checks.capacity + " | "
      + view.checks.queue + " | " + view.checks.scheduler + " | " + view.checks.provider + " | " + view.checks.live + " |",
    "",
    "Reconciliation: " + view.reconciliation.status + "; drift: " + blockersText(view.reconciliation.drift) + ".",
    "This view reports supplied delivery facts only. It does not schedule, publish, call providers, or write queues.",
  ];
  return lines.join("\n") + "\n";
}

export function renderGrowDeliveryBinding(view: GrowDeliveryBinding, format: GrowDeliveryBindingCliFormat): string {
  if (format === "json") return renderGrowDeliveryBindingJson(view);
  if (format === "markdown") return renderGrowDeliveryBindingMarkdown(view);
  return renderGrowDeliveryBindingJson(view) + "\n" + renderGrowDeliveryBindingMarkdown(view);
}

const defaultIo: GrowDeliveryBindingCliIo = {
  readFile: (path) => readFile(path, "utf8"),
  write: (value) => { process.stdout.write(value); },
  error: (value) => { process.stderr.write(value); },
};

export async function main(
  argv: readonly string[] = process.argv.slice(2),
  io: Partial<GrowDeliveryBindingCliIo> = {},
): Promise<number> {
  const effectiveIo = { ...defaultIo, ...io };
  try {
    const options = parseGrowDeliveryBindingArgs(argv);
    const view = await buildGrowDeliveryBindingFromSource(options.source, effectiveIo);
    await effectiveIo.write(renderGrowDeliveryBinding(view, options.format));
    return 0;
  } catch (error) {
    await effectiveIo.error?.("grow:delivery-binding: " + (error instanceof Error ? error.message : String(error)) + "\n");
    return 1;
  }
}

export const parseDeliveryBindingArgs = parseGrowDeliveryBindingArgs;
export const buildDeliveryBindingFromJson = buildGrowDeliveryBindingFromJson;
export const renderDeliveryBinding = renderGrowDeliveryBinding;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((exitCode) => { process.exitCode = exitCode; });
}
