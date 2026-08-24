/**
 * Pure normalization boundary for one canonical funnel event.
 *
 * This module only validates caller-supplied facts. It does not capture live events, read a
 * database, infer engagement, select a winner, make a demand claim, or persist anything.
 */
export const FUNNEL_EVENT_VERSION = "funnel-event-v1" as const;

export type FunnelEventType =
  | "visit"
  | "opt_in"
  | "survey_response"
  | "qualified_inquiry"
  | "call"
  | "opportunity"
  | "purchase";

export type FunnelTouchType = "first" | "last" | "assisted" | "self_reported" | "unknown";
export type FunnelConfidence = "high" | "medium" | "low";

export interface FunnelLineageRef {
  recordType: string;
  id: string;
  relation: string | null;
}

export interface FunnelAttributionInput {
  contentItemId: string | null;
  touchType: FunnelTouchType;
  touchAt: string;
  confidence: FunnelConfidence;
  unattributedReason?: string | null;
}

export interface FunnelAttribution extends FunnelAttributionInput {
  unattributedReason: string | null;
}

export interface FunnelEventInput {
  id: string;
  eventType: FunnelEventType;
  occurredAt: string;
  collectedAt: string;
  respondentHash?: string | null;
  value?: number | null;
  sourceNote: string;
  status: string;
  attribution: readonly FunnelAttributionInput[];
  evidenceRefs?: readonly string[] | null;
  lineage?: readonly FunnelLineageRef[] | null;
}

export interface FunnelEvent {
  kind: "funnel_event";
  version: typeof FUNNEL_EVENT_VERSION;
  id: string;
  eventType: FunnelEventType;
  occurredAt: string;
  collectedAt: string;
  respondentHash: string | null;
  value: number | null;
  sourceNote: string;
  status: string;
  attribution: FunnelAttribution[];
  evidenceRefs: string[];
  lineage: FunnelLineageRef[] | null;
  sideEffects: "none";
}

export interface FunnelEventAssessment {
  status: "ready" | "blocked";
  blockers: string[];
}

export class FunnelEventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FunnelEventValidationError";
  }
}

const EVENT_TYPES: readonly FunnelEventType[] = [
  "visit",
  "opt_in",
  "survey_response",
  "qualified_inquiry",
  "call",
  "opportunity",
  "purchase",
];

const TOUCH_TYPES: readonly FunnelTouchType[] = ["first", "last", "assisted", "self_reported", "unknown"];
const CONFIDENCES: readonly FunnelConfidence[] = ["high", "medium", "low"];

function fail(message: string): never {
  throw new FunnelEventValidationError(message);
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
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

function isoDate(value: unknown, field: string): string {
  const normalized = text(value, field);
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)$/.exec(normalized);
  if (match === null || Number.isNaN(Date.parse(normalized))) {
    fail(`${field} must be a valid ISO date`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth) {
    fail(`${field} must be a valid ISO date`);
  }
  return normalized;
}

function nonNegativeFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    fail(`${field} must be a non-negative finite number`);
  }
  return value;
}

function nullableValue(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  return nonNegativeFiniteNumber(value, "value");
}

function sortedUniqueText(value: unknown, field: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) fail(`${field} must be an array or null`);
  return [...new Set(value.map((item, index) => text(item, `${field}[${index}]`)))].sort((left, right) => left.localeCompare(right));
}

function normalizeLineage(value: unknown): FunnelLineageRef[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) fail("lineage must be an array or null");

  return value.map((item, index) => {
    const input = object(item, `lineage[${index}]`);
    const relation = input.relation === undefined || input.relation === null
      ? null
      : text(input.relation, `lineage[${index}].relation`);
    return {
      recordType: text(input.recordType, `lineage[${index}].recordType`),
      id: text(input.id, `lineage[${index}].id`),
      relation,
    };
  });
}

function normalizeAttribution(value: unknown): FunnelAttribution[] {
  if (!Array.isArray(value)) fail("attribution must be an array");

  return value.map((item, index) => {
    const input = object(item, `attribution[${index}]`);
    const touchType = enumValue(input.touchType, TOUCH_TYPES, `attribution[${index}].touchType`);
    const contentItemId = input.contentItemId === null
      ? null
      : text(input.contentItemId, `attribution[${index}].contentItemId`);
    const reason = input.unattributedReason === undefined || input.unattributedReason === null
      ? null
      : text(input.unattributedReason, `attribution[${index}].unattributedReason`);

    if (touchType === "unknown") {
      if (contentItemId !== null) fail(`attribution[${index}] unknown touch requires contentItemId null`);
      if (reason === null) fail(`attribution[${index}] unknown touch requires unattributedReason`);
    } else {
      if (contentItemId === null) fail(`attribution[${index}] ${touchType} touch requires contentItemId`);
      if (reason !== null) fail(`attribution[${index}] ${touchType} touch requires unattributedReason null`);
    }

    return {
      contentItemId,
      touchType,
      touchAt: isoDate(input.touchAt, `attribution[${index}].touchAt`),
      confidence: enumValue(input.confidence, CONFIDENCES, `attribution[${index}].confidence`),
      unattributedReason: reason,
    };
  });
}

/** Normalize one funnel event without adding an interpretation or making an attribution claim. */
export function normalizeFunnelEvent(input: unknown): FunnelEvent {
  const source = object(input, "funnel event");
  return {
    kind: "funnel_event",
    version: FUNNEL_EVENT_VERSION,
    id: text(source.id, "id"),
    eventType: enumValue(source.eventType, EVENT_TYPES, "eventType"),
    occurredAt: isoDate(source.occurredAt, "occurredAt"),
    collectedAt: isoDate(source.collectedAt, "collectedAt"),
    respondentHash: nullableText(source.respondentHash, "respondentHash"),
    value: nullableValue(source.value),
    sourceNote: text(source.sourceNote, "sourceNote"),
    status: text(source.status, "status"),
    attribution: normalizeAttribution(source.attribution),
    evidenceRefs: sortedUniqueText(source.evidenceRefs, "evidenceRefs"),
    lineage: normalizeLineage(source.lineage),
    sideEffects: "none",
  };
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

/** Assess only explicit record completeness. Low confidence and unknown attribution are valid facts. */
export function assessFunnelEvent(event: FunnelEvent): FunnelEventAssessment {
  const blockers: string[] = [];
  if (event.lineage === null || event.lineage.length === 0) blockers.push("lineage is missing");
  if (event.evidenceRefs.length === 0) blockers.push("evidenceRefs are missing");
  if (event.attribution.length === 0) blockers.push("attribution is missing");

  const normalizedBlockers = sortedUnique(blockers);
  return {
    status: normalizedBlockers.length === 0 ? "ready" : "blocked",
    blockers: normalizedBlockers,
  };
}
