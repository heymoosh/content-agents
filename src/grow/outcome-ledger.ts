import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * A small, append-only measurement boundary. It accepts caller-supplied facts only. It does not
 * collect events, infer attribution, rank content, close experiments, or change another system.
 */
export const OUTCOME_LEDGER_VERSION = "outcome-ledger-v1" as const;

export type OutcomeFamily = "attention" | "conversation" | "audience" | "funnel" | "business";
export type FunnelEventType =
  | "visit"
  | "opt_in"
  | "survey_response"
  | "qualified_inquiry"
  | "call"
  | "opportunity"
  | "purchase";
export type BusinessOutcomeType =
  | "qualified_inquiry"
  | "call"
  | "opportunity"
  | "purchase"
  | "retention"
  | "lost";
export type AttributionTouchType = "first" | "last" | "assisted" | "self_reported" | "unknown";
export type AttributionConfidence = "high" | "medium" | "low";
export type OutcomeReadinessStatus = "ready" | "blocked";
export type OutcomeRecordStatus =
  | "draft"
  | "needs-human-judgment"
  | "approved"
  | "rejected"
  | "scheduled"
  | "published"
  | "measured"
  | "observed"
  | "reported"
  | "verified"
  | "pending"
  | "current"
  | "superseded"
  | "corrected";

export interface OutcomeLineageRef {
  readonly recordType: string;
  readonly id: string;
  readonly relation: string;
}

export interface OutcomeScope {
  readonly [key: string]: string | null;
}

export interface OutcomeWindow {
  readonly startAt: string;
  readonly endAt: string;
}

export interface OutcomeAttributionInput {
  readonly contentItemId: string | null;
  readonly touchType: AttributionTouchType;
  readonly touchAt: string;
  readonly confidence: AttributionConfidence;
  readonly attributionReason?: string | null;
  /** Accepted as a compatibility spelling for the canonical camelCase field. */
  readonly unattributedReason?: string | null;
}

export interface OutcomeAttribution {
  readonly contentItemId: string | null;
  readonly touchType: AttributionTouchType;
  readonly touchAt: string;
  readonly confidence: AttributionConfidence;
  readonly attributionReason: string | null;
}

export interface OutcomeCommonInput {
  readonly id: string;
  readonly observedAt: string;
  readonly collectedAt: string;
  readonly metric: string;
  readonly value: number | null;
  readonly unit: string | null;
  readonly numerator: number | null;
  readonly denominator: number | null;
  readonly scope: OutcomeScope;
  readonly window: OutcomeWindow;
  readonly sourceNote: string;
  readonly evidenceRefs: readonly string[];
  readonly lineage: readonly OutcomeLineageRef[];
  readonly caveats: readonly string[];
  readonly status: OutcomeRecordStatus | string;
  readonly supersedesId?: string | null;
}

export interface FunnelEventInput extends OutcomeCommonInput {
  readonly eventType: FunnelEventType;
  readonly respondentHash?: string | null;
  readonly attribution: readonly OutcomeAttributionInput[];
}

export interface BusinessQualification {
  readonly status: "confirmed" | "self_reported" | "unknown";
  readonly rule: string | null;
}

export interface BusinessOutcomeInput extends OutcomeCommonInput {
  readonly outcomeType: BusinessOutcomeType;
  readonly currency: string | null;
  readonly qualification: BusinessQualification;
  readonly contentItemRefs: readonly string[];
  readonly funnelEventRefs: readonly string[];
  readonly attribution?: readonly OutcomeAttributionInput[];
}

interface OutcomeCommonRow {
  readonly id: string;
  readonly observedAt: string;
  readonly collectedAt: string;
  readonly metric: string;
  readonly value: number | null;
  readonly unit: string | null;
  readonly numerator: number | null;
  readonly denominator: number | null;
  readonly scope: OutcomeScope;
  readonly window: OutcomeWindow;
  readonly sourceNote: string;
  readonly evidenceRefs: string[];
  readonly lineage: OutcomeLineageRef[];
  readonly caveats: string[];
  readonly status: OutcomeRecordStatus | string;
  readonly supersedesId: string | null;
  readonly sideEffects: "none";
}

export interface FunnelEvent extends OutcomeCommonRow {
  readonly recordType: "funnel_event";
  readonly family: "funnel";
  readonly eventType: FunnelEventType;
  readonly respondentHash: string | null;
  readonly attribution: OutcomeAttribution[];
}

export interface BusinessOutcome extends OutcomeCommonRow {
  readonly recordType: "business_outcome";
  readonly family: "business";
  readonly outcomeType: BusinessOutcomeType;
  readonly currency: string | null;
  readonly qualification: BusinessQualification;
  readonly contentItemRefs: string[];
  readonly funnelEventRefs: string[];
  readonly attribution: OutcomeAttribution[];
}

export type OutcomeRow = FunnelEvent | BusinessOutcome;

export interface OutcomeReadiness {
  readonly status: OutcomeReadinessStatus;
  readonly blockers: string[];
}

export interface OutcomeFamilyCounts {
  readonly attention: number;
  readonly conversation: number;
  readonly audience: number;
  readonly funnel: number;
  readonly business: number;
}

export interface OutcomeLedger {
  readonly recordType: "outcome_ledger";
  readonly version: typeof OUTCOME_LEDGER_VERSION;
  readonly rows: OutcomeRow[];
  readonly familyCounts: OutcomeFamilyCounts;
  readonly readiness: OutcomeReadiness;
  readonly generatesCopy: false;
  readonly creatorBodyCopyAllowed: false;
  readonly sideEffects: "none";
}

export class OutcomeLedgerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutcomeLedgerValidationError";
  }
}

const FUNNEL_EVENT_TYPES: readonly FunnelEventType[] = [
  "visit", "opt_in", "survey_response", "qualified_inquiry", "call", "opportunity", "purchase",
];
const BUSINESS_OUTCOME_TYPES: readonly BusinessOutcomeType[] = [
  "qualified_inquiry", "call", "opportunity", "purchase", "retention", "lost",
];
const TOUCH_TYPES: readonly AttributionTouchType[] = ["first", "last", "assisted", "self_reported", "unknown"];
const CONFIDENCES: readonly AttributionConfidence[] = ["high", "medium", "low"];
const QUALIFICATION_STATUSES: readonly BusinessQualification["status"][] = ["confirmed", "self_reported", "unknown"];
const STATUS_VALUES: readonly OutcomeRecordStatus[] = [
  "draft", "needs-human-judgment", "approved", "rejected", "scheduled", "published", "measured",
  "observed", "reported", "verified", "pending", "current", "superseded", "corrected",
];

const COMMON_KEYS = [
  "id", "observedAt", "observed_at", "occurredAt", "occurred_at", "collectedAt", "collected_at", "metric", "value", "unit", "numerator", "denominator", "scope",
  "window", "sourceNote", "source_note", "evidenceRefs", "evidence_refs", "lineage", "caveats", "status", "supersedesId",
  "supersedes_id", "recordType", "record_type", "family", "sideEffects",
] as const;
const FUNNEL_KEYS = [...COMMON_KEYS, "eventType", "event_type", "respondentHash", "respondent_hash", "attribution"] as const;
const BUSINESS_KEYS = [
  ...COMMON_KEYS, "outcomeType", "outcome_type", "currency", "qualification", "contentItemRefs", "content_item_refs",
  "funnelEventRefs", "funnel_event_refs", "attribution",
] as const;
const ATTRIBUTION_KEYS = [
  "contentItemId", "content_item_id", "touchType", "touch_type", "touchAt", "touch_at", "confidence",
  "attributionReason", "attribution_reason", "unattributedReason", "unattributed_reason",
] as const;
const LINEAGE_KEYS = ["recordType", "record_type", "id", "relation"] as const;
const SCOPE_KEYS = ["platform", "surface", "contentItemId", "content_item_id", "audience", "segment", "channel", "cohort"] as const;
const WINDOW_KEYS = ["startAt", "start_at", "endAt", "end_at"] as const;
const QUALIFICATION_KEYS = ["status", "rule"] as const;

function fail(message: string): never {
  throw new OutcomeLedgerValidationError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value)) fail(`${field} must be an object`);
  return value;
}

function own(source: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(source, key);
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") fail(`${field} is required`);
  return value.trim();
}

function nullableText(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  return text(value, field);
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  const normalized = text(value, field);
  if (!allowed.includes(normalized as T)) fail(`${field} must be one of ${allowed.join(", ")}`);
  return normalized as T;
}

function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(`${field} must be a finite number`);
  return value;
}

function nullableNumber(value: unknown, field: string): number | null {
  if (value === undefined || value === null) return null;
  return finiteNumber(value, field);
}

function isoDate(value: unknown, field: string): string {
  const normalized = text(value, field);
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)$/.exec(normalized);
  if (match === null || Number.isNaN(Date.parse(normalized))) fail(`${field} must be a valid ISO date`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth) fail(`${field} must be a valid ISO date`);
  return normalized;
}

function assertAllowedKeys(source: Record<string, unknown>, allowed: readonly string[], field: string): void {
  for (const key of Object.keys(source)) {
    if (!allowed.includes(key)) fail(`${field} has unknown field "${key}"`);
  }
}

function aliasValue(source: Record<string, unknown>, camel: string, snake: string, field: string): unknown {
  const camelPresent = own(source, camel);
  const snakePresent = own(source, snake);
  if (camelPresent && snakePresent && JSON.stringify(source[camel]) !== JSON.stringify(source[snake])) {
    fail(`${field} has conflicting ${camel} and ${snake}`);
  }
  return camelPresent ? source[camel] : source[snake];
}

function uniqueSortedText(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) fail(`${field} must be an array`);
  const values = value.map((item, index) => text(item, `${field}[${index}]`));
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function normalizeScope(value: unknown): OutcomeScope {
  const source = object(value, "scope");
  assertAllowedKeys(source, SCOPE_KEYS, "scope");
  const scope: Record<string, string | null> = {};
  for (const key of SCOPE_KEYS) {
    if (!own(source, key)) continue;
    const canonical = key === "content_item_id" ? "contentItemId" : key;
    if (own(scope, canonical)) continue;
    scope[canonical] = nullableText(source[key], `scope.${key}`);
  }
  return scope;
}

function normalizeWindow(value: unknown): OutcomeWindow {
  const source = object(value, "window");
  assertAllowedKeys(source, WINDOW_KEYS, "window");
  const start = aliasValue(source, "startAt", "start_at", "window.startAt");
  const end = aliasValue(source, "endAt", "end_at", "window.endAt");
  return { startAt: isoDate(start, "window.startAt"), endAt: isoDate(end, "window.endAt") };
}

function normalizeLineage(value: unknown): OutcomeLineageRef[] {
  if (!Array.isArray(value)) fail("lineage must be an array");
  return value.map((item, index) => {
    const source = object(item, `lineage[${index}]`);
    assertAllowedKeys(source, LINEAGE_KEYS, `lineage[${index}]`);
    return {
      recordType: text(aliasValue(source, "recordType", "record_type", `lineage[${index}].recordType`), `lineage[${index}].recordType`),
      id: text(source.id, `lineage[${index}].id`),
      relation: text(source.relation, `lineage[${index}].relation`),
    };
  });
}

function normalizeAttribution(value: unknown): OutcomeAttribution[] {
  if (!Array.isArray(value)) fail("attribution must be an array");
  return value.map((item, index) => {
    const source = object(item, `attribution[${index}]`);
    assertAllowedKeys(source, ATTRIBUTION_KEYS, `attribution[${index}]`);
    const contentItemId = aliasValue(source, "contentItemId", "content_item_id", `attribution[${index}].contentItemId`);
    const touchType = enumValue(aliasValue(source, "touchType", "touch_type", `attribution[${index}].touchType`), TOUCH_TYPES, `attribution[${index}].touchType`);
    const touchAt = isoDate(aliasValue(source, "touchAt", "touch_at", `attribution[${index}].touchAt`), `attribution[${index}].touchAt`);
    const confidence = enumValue(source.confidence, CONFIDENCES, `attribution[${index}].confidence`);
    const reasonValue = aliasValue(source, "attributionReason", "attribution_reason", `attribution[${index}].attributionReason`);
    const legacyReason = aliasValue(source, "unattributedReason", "unattributed_reason", `attribution[${index}].unattributedReason`);
    if (reasonValue !== undefined && legacyReason !== undefined && JSON.stringify(reasonValue) !== JSON.stringify(legacyReason)) {
      fail(`attribution[${index}] has conflicting attributionReason and unattributedReason`);
    }
    const reason = reasonValue !== undefined ? reasonValue : legacyReason;
    const normalizedContentItemId = contentItemId === null || contentItemId === undefined
      ? null
      : text(contentItemId, `attribution[${index}].contentItemId`);
    const normalizedReason = reason === undefined || reason === null ? null : text(reason, `attribution[${index}].attributionReason`);

    if (touchType === "unknown") {
      if (normalizedContentItemId !== null) fail(`attribution[${index}] unknown touch requires contentItemId null`);
      if (normalizedReason === null) fail(`attribution[${index}] unknown touch requires attributionReason`);
    } else {
      if (normalizedContentItemId === null) fail(`attribution[${index}] ${touchType} touch requires contentItemId`);
      if (normalizedReason !== null) fail(`attribution[${index}] ${touchType} touch requires attributionReason null`);
    }
    return {
      contentItemId: normalizedContentItemId,
      touchType,
      touchAt,
      confidence,
      attributionReason: normalizedReason,
    };
  });
}

function normalizeCommon(source: Record<string, unknown>): OutcomeCommonRow {
  const status = text(source.status, "status");
  if (!(STATUS_VALUES as readonly string[]).includes(status)) fail(`status must be one of ${STATUS_VALUES.join(", ")}`);
  const observed = aliasValue(source, "observedAt", "observed_at", "observedAt")
    ?? aliasValue(source, "occurredAt", "occurred_at", "occurredAt");
  return {
    id: text(source.id, "id"),
    observedAt: isoDate(observed, "observedAt"),
    collectedAt: isoDate(aliasValue(source, "collectedAt", "collected_at", "collectedAt"), "collectedAt"),
    metric: text(source.metric, "metric"),
    value: nullableNumber(source.value, "value"),
    unit: nullableText(source.unit, "unit"),
    numerator: nullableNumber(source.numerator, "numerator"),
    denominator: nullableNumber(source.denominator, "denominator"),
    scope: normalizeScope(source.scope),
    window: normalizeWindow(source.window),
    sourceNote: text(aliasValue(source, "sourceNote", "source_note", "sourceNote"), "sourceNote"),
    evidenceRefs: uniqueSortedText(aliasValue(source, "evidenceRefs", "evidence_refs", "evidenceRefs"), "evidenceRefs"),
    lineage: normalizeLineage(source.lineage),
    caveats: uniqueSortedText(source.caveats, "caveats"),
    status,
    supersedesId: nullableText(aliasValue(source, "supersedesId", "supersedes_id", "supersedesId"), "supersedesId"),
    sideEffects: "none",
  };
}

function recordType(source: Record<string, unknown>): string | undefined {
  const value = aliasValue(source, "recordType", "record_type", "recordType");
  return value === undefined ? undefined : text(value, "recordType");
}

function normalizeRecordEnvelope(source: Record<string, unknown>, expected: "funnel_event" | "business_outcome"): void {
  const declared = recordType(source);
  if (declared !== undefined && declared !== expected) fail(`recordType must be ${expected}`);
  if (source.family !== undefined) {
    const expectedFamily = expected === "funnel_event" ? "funnel" : "business";
    if (source.family !== expectedFamily) fail(`family must be ${expectedFamily}`);
  }
  if (source.sideEffects !== undefined && source.sideEffects !== "none") fail("sideEffects must be none");
}

function normalizeFunnelEvent(value: unknown): FunnelEvent {
  const source = object(value, "funnel event");
  assertAllowedKeys(source, FUNNEL_KEYS, "funnel event");
  normalizeRecordEnvelope(source, "funnel_event");
  const common = normalizeCommon(source);
  return deepFreeze({
    recordType: "funnel_event",
    family: "funnel",
    ...common,
    eventType: enumValue(aliasValue(source, "eventType", "event_type", "eventType"), FUNNEL_EVENT_TYPES, "eventType"),
    respondentHash: nullableText(aliasValue(source, "respondentHash", "respondent_hash", "respondentHash"), "respondentHash"),
    attribution: normalizeAttribution(source.attribution),
  });
}

function normalizeQualification(value: unknown): BusinessQualification {
  const source = object(value, "qualification");
  assertAllowedKeys(source, QUALIFICATION_KEYS, "qualification");
  return {
    status: enumValue(source.status, QUALIFICATION_STATUSES, "qualification.status"),
    rule: nullableText(source.rule, "qualification.rule"),
  };
}

function normalizeBusinessOutcome(value: unknown): BusinessOutcome {
  const source = object(value, "business outcome");
  assertAllowedKeys(source, BUSINESS_KEYS, "business outcome");
  normalizeRecordEnvelope(source, "business_outcome");
  const common = normalizeCommon(source);
  return deepFreeze({
    recordType: "business_outcome",
    family: "business",
    ...common,
    outcomeType: enumValue(aliasValue(source, "outcomeType", "outcome_type", "outcomeType"), BUSINESS_OUTCOME_TYPES, "outcomeType"),
    currency: nullableText(source.currency, "currency")?.toUpperCase() ?? null,
    qualification: normalizeQualification(source.qualification),
    contentItemRefs: uniqueSortedText(aliasValue(source, "contentItemRefs", "content_item_refs", "contentItemRefs"), "contentItemRefs"),
    funnelEventRefs: uniqueSortedText(aliasValue(source, "funnelEventRefs", "funnel_event_refs", "funnelEventRefs"), "funnelEventRefs"),
    attribution: source.attribution === undefined ? [] : normalizeAttribution(source.attribution),
  });
}

/** Normalize one explicit funnel event. No interpretation fields are accepted. */
export function buildFunnelEvent(input: FunnelEventInput): FunnelEvent {
  return normalizeFunnelEvent(input);
}

/** Normalize one explicit business fact as its own family. It is never inferred from engagement. */
export function buildBusinessOutcome(input: BusinessOutcomeInput): BusinessOutcome {
  return normalizeBusinessOutcome(input);
}

/** Normalize either canonical row kind, accepting documented snake_case aliases at the boundary. */
export function normalizeOutcomeRow(value: unknown): OutcomeRow {
  const source = object(value, "outcome row");
  const declared = recordType(source);
  if (declared === "funnel_event" || (declared === undefined && source.eventType !== undefined)) return normalizeFunnelEvent(source);
  if (declared === "business_outcome" || (declared === undefined && source.outcomeType !== undefined)) return normalizeBusinessOutcome(source);
  fail("outcome row recordType must be funnel_event or business_outcome");
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function validEvidenceRef(value: string): boolean {
  return value.trim() !== "" && !/\s/.test(value) && !/^(?:body|commentbody|email|phone|raw[_-]?pii):/i.test(value);
}

function attributionBlockers(attribution: readonly OutcomeAttribution[]): string[] {
  if (attribution.length === 0) return ["attribution is missing"];
  const blockers: string[] = [];
  const seen = new Set<string>();
  const exclusive = new Map<"first" | "last", Set<string>>();
  let hasUnknown = false;
  let hasKnown = false;
  for (const touch of attribution) {
    const key = `${touch.touchType}:${touch.contentItemId ?? "unknown"}:${touch.touchAt}`;
    if (seen.has(key)) blockers.push(`duplicate attribution touch ${key}`);
    seen.add(key);
    if (touch.touchType === "unknown") hasUnknown = true;
    else hasKnown = true;
    if (touch.touchType === "first" || touch.touchType === "last") {
      const ids = exclusive.get(touch.touchType) ?? new Set<string>();
      ids.add(touch.contentItemId as string);
      exclusive.set(touch.touchType, ids);
    }
  }
  for (const [touchType, ids] of exclusive) {
    if (ids.size > 1) blockers.push(`ambiguous attribution: multiple ${touchType} content items`);
  }
  if (hasUnknown && hasKnown) blockers.push("ambiguous attribution: unknown and known touches are mixed");
  return blockers;
}

/** Readiness is descriptive and conservative. It never upgrades an incomplete record. */
export function assessOutcomeRow(row: OutcomeRow): OutcomeReadiness {
  const blockers: string[] = [];
  if (row.evidenceRefs.length === 0) blockers.push("evidence refs are missing");
  for (const ref of row.evidenceRefs) if (!validEvidenceRef(ref)) blockers.push(`invalid evidence ref ${ref}`);
  if (row.lineage.length === 0) blockers.push("lineage refs are missing");
  for (const ref of row.lineage) {
    if (!ref.recordType || !ref.id || !ref.relation) blockers.push("lineage ref is incomplete");
  }
  blockers.push(...attributionBlockers(row.attribution));
  return { status: blockers.length === 0 ? "ready" : "blocked", blockers: uniqueStrings(blockers) };
}

function compareRows(left: OutcomeRow, right: OutcomeRow): number {
  return left.recordType.localeCompare(right.recordType) || left.id.localeCompare(right.id);
}

function revisionBlockers(rows: readonly OutcomeRow[]): string[] {
  const blockers: string[] = [];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const successors = new Set<string>();
  for (const row of rows) {
    if (row.supersedesId === null) continue;
    if (row.supersedesId === row.id) blockers.push(`${row.id} cannot supersede itself`);
    const previous = byId.get(row.supersedesId);
    if (!previous) blockers.push(`${row.id} supersedes missing row ${row.supersedesId}`);
    else if (previous.recordType !== row.recordType) blockers.push(`${row.id} supersedes a different row family`);
    if (successors.has(row.supersedesId)) blockers.push(`multiple revisions supersede ${row.supersedesId}`);
    successors.add(row.supersedesId);
  }
  return blockers;
}

/** Build a deterministic read model. It never chooses a winner or changes any input row. */
export function buildOutcomeLedger(rows: readonly OutcomeRow[]): OutcomeLedger {
  const normalized = rows.map((row) => normalizeOutcomeRow(row));
  const blockers: string[] = [];
  const ids = new Set<string>();
  for (const row of normalized) {
    if (ids.has(row.id)) blockers.push(`duplicate outcome row ${row.id}`);
    ids.add(row.id);
    blockers.push(...assessOutcomeRow(row).blockers.map((blocker) => `${row.id}: ${blocker}`));
  }
  blockers.push(...revisionBlockers(normalized));
  const sorted = [...normalized].sort(compareRows);
  const familyCounts: OutcomeFamilyCounts = {
    attention: 0,
    conversation: 0,
    audience: 0,
    funnel: sorted.filter((row) => row.family === "funnel").length,
    business: sorted.filter((row) => row.family === "business").length,
  };
  return deepFreeze({
    recordType: "outcome_ledger",
    version: OUTCOME_LEDGER_VERSION,
    rows: sorted,
    familyCounts,
    readiness: {
      status: blockers.length === 0 ? "ready" : "blocked",
      blockers: uniqueStrings(blockers),
    },
    generatesCopy: false,
    creatorBodyCopyAllowed: false,
    sideEffects: "none",
  });
}

function assertAppendable(existing: readonly OutcomeRow[], row: OutcomeRow): void {
  if (existing.some((item) => item.id === row.id)) fail(`outcome row id already exists: ${row.id}`);
  if (row.supersedesId === null) return;
  const previous = existing.find((item) => item.id === row.supersedesId);
  if (!previous) fail(`supersedesId references missing row ${row.supersedesId}`);
  if (previous.recordType !== row.recordType) fail("supersedesId must reference the same row kind");
  if (existing.some((item) => item.supersedesId === row.supersedesId)) fail(`row ${row.supersedesId} already has a revision`);
}

/** Read JSONL without repairing, rewriting, deleting, or skipping malformed durable rows. */
export function readOutcomeLedger(path: string): OutcomeRow[] {
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, "utf8").split("\n").filter((line) => line.trim() !== "");
  return lines.map((line, index) => {
    let value: unknown;
    try { value = JSON.parse(line) as unknown; }
    catch { fail(`ledger line ${index + 1} is not valid JSON`); }
    try { return normalizeOutcomeRow(value); }
    catch (error) { fail(`ledger line ${index + 1}: ${error instanceof Error ? error.message : "invalid row"}`); }
  });
}

/** Append one row or one non-destructive revision. This is the only persistence helper. */
export function appendOutcomeRow(row: OutcomeRow, path: string): void {
  const normalized = normalizeOutcomeRow(row);
  const existing = readOutcomeLedger(path);
  assertAppendable(existing, normalized);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(normalized)}\n`, "utf8");
}

export const normalizeFunnelEventRecord = buildFunnelEvent;
export const normalizeBusinessOutcomeRecord = buildBusinessOutcome;
export const createOutcomeLedger = buildOutcomeLedger;
export const appendOutcomeLedger = appendOutcomeRow;
export const loadOutcomeLedger = readOutcomeLedger;

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}
