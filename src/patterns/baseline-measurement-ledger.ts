/**
 * A pure ledger for facts explicitly supplied by a caller through `/new`.
 *
 * This module deliberately has no store, network, collector, calculator, or model dependency.
 * It records what was supplied, including gaps, and never turns a gap into a value.
 */

export const BASELINE_MEASUREMENT_LEDGER_VERSION = "baseline-measurement-ledger-v1" as const;

export type ReviewerStatus = "unreviewed" | "manual" | "reviewed";

export interface BaselineMeasurementFact {
  readonly id: string;
  readonly accountId: string | null;
  readonly platform: string | null;
  readonly route: "/new";
  readonly settled: true;
  readonly sample: {
    readonly windowStart: string | null;
    readonly windowEnd: string | null;
  };
  readonly metric: {
    readonly name: string | null;
    readonly numerator: number | null;
    readonly denominator: number | null;
  };
  readonly method: string | null;
  readonly observedAt: string | null;
  readonly collectedAt: string | null;
  readonly baselineScope: string | null;
  readonly baselineSource: string | null;
  readonly evidenceRefs: readonly string[];
  readonly reviewerStatus: ReviewerStatus;
  readonly unavailableReason: string | null;
}

export interface BaselineMeasurementLedger {
  readonly kind: "baseline_measurement_ledger";
  readonly version: typeof BASELINE_MEASUREMENT_LEDGER_VERSION;
  readonly rows: readonly BaselineMeasurementFact[];
  readonly bodyFree: true;
  readonly sideEffects: "none";
}

export interface BaselineMeasurementReadiness {
  readonly status: "ready" | "blocked";
  readonly blockers: readonly string[];
}

type UnknownRecord = Record<string, unknown>;

const FACT_KEYS = new Set([
  "id", "accountId", "platform", "route", "settled", "sample", "metric", "method",
  "observedAt", "collectedAt", "baselineScope", "baselineSource", "evidenceRefs",
  "reviewerStatus", "unavailableReason",
]);
const SAMPLE_KEYS = new Set(["windowStart", "windowEnd"]);
const METRIC_KEYS = new Set(["name", "numerator", "denominator"]);
const FORBIDDEN = new Set([
  "body", "text", "transcript", "model", "prompt", "pii", "email", "phone", "name",
  "handle", "person", "creator", "ranking", "rank", "winner", "score", "ratio", "average",
  "mean", "median", "value", "calculatedValue", "inferredValue", "derivedValue",
]);

function record(value: unknown, label: string): UnknownRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as UnknownRecord;
}

function checkKeys(value: UnknownRecord, allowed: Set<string>, label: string): void {
  for (const key of Object.keys(value)) {
    if (FORBIDDEN.has(key) && (label === "fact" || key !== "name")) throw new TypeError(`forbidden field: ${key}`);
    if (!allowed.has(key)) throw new TypeError(`unknown field: ${label}.${key}`);
  }
}

function text(value: unknown, label: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(`${label} must be a non-empty string or null`);
  return value.trim();
}

function timestamp(value: unknown, label: string): string | null {
  const normalized = text(value, label);
  if (normalized === null) return null;
  if (!Number.isFinite(Date.parse(normalized))) throw new TypeError(`${label} must be a valid timestamp or null`);
  return new Date(normalized).toISOString();
}

function count(value: unknown, label: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative integer or null`);
  }
  return value;
}

function normalizeFact(input: BaselineMeasurementFact): BaselineMeasurementFact {
  const source = record(input, "fact");
  checkKeys(source, FACT_KEYS, "fact");
  if (source.route !== "/new") throw new TypeError("route must be /new");
  if (source.settled !== true) throw new TypeError("fact must be settled caller-supplied data");
  const id = text(source.id, "id");
  if (id === null) throw new TypeError("id is required");
  const sample = record(source.sample, "sample");
  checkKeys(sample, SAMPLE_KEYS, "sample");
  const metric = record(source.metric, "metric");
  checkKeys(metric, METRIC_KEYS, "metric");
  const evidenceRefs = source.evidenceRefs;
  if (!Array.isArray(evidenceRefs)) throw new TypeError("evidence refs must be an array");
  const refs = evidenceRefs.map((ref, index) => {
    if (typeof ref !== "string" || ref.trim() === "") throw new TypeError(`evidence refs[${index}] must be a non-empty ref`);
    return ref.trim();
  });
  if (new Set(refs).size !== refs.length) throw new TypeError("evidence refs must be unique");
  const unavailableReason = text(source.unavailableReason, "unavailableReason");
  const fact: BaselineMeasurementFact = {
    id,
    accountId: text(source.accountId, "accountId"),
    platform: text(source.platform, "platform"),
    route: "/new",
    settled: true,
    sample: {
      windowStart: timestamp(sample.windowStart, "sample.windowStart"),
      windowEnd: timestamp(sample.windowEnd, "sample.windowEnd"),
    },
    metric: {
      name: text(metric.name, "metric.name"),
      numerator: count(metric.numerator, "metric.numerator"),
      denominator: count(metric.denominator, "metric.denominator"),
    },
    method: text(source.method, "method"),
    observedAt: timestamp(source.observedAt, "observedAt"),
    collectedAt: timestamp(source.collectedAt, "collectedAt"),
    baselineScope: text(source.baselineScope, "baselineScope"),
    baselineSource: text(source.baselineSource, "baselineSource"),
    evidenceRefs: [...refs] as string[],
    reviewerStatus: source.reviewerStatus as ReviewerStatus,
    unavailableReason,
  };
  if (!["unreviewed", "manual", "reviewed"].includes(fact.reviewerStatus)) {
    throw new TypeError("reviewerStatus must be unreviewed, manual, or reviewed");
  }
  if (fact.unavailableReason === null && (fact.metric.numerator === null || fact.metric.denominator === null)) {
    // Incomplete rows are allowed, but their absence must be named by the caller.
    throw new TypeError("explicit unavailable reason is required when metric facts are unavailable");
  }
  if (fact.metric.numerator !== null && fact.metric.denominator !== null && fact.metric.numerator > fact.metric.denominator) {
    throw new TypeError("metric numerator cannot exceed denominator");
  }
  return deepFreeze(fact);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as UnknownRecord)) deepFreeze(child);
  }
  return value;
}

export function createBaselineMeasurementLedger(rows: readonly BaselineMeasurementFact[] = []): BaselineMeasurementLedger {
  const ledger: BaselineMeasurementLedger = {
    kind: "baseline_measurement_ledger",
    version: BASELINE_MEASUREMENT_LEDGER_VERSION,
    rows: rows.map(normalizeFact),
    bodyFree: true,
    sideEffects: "none",
  };
  const ids = new Set<string>();
  for (const row of ledger.rows) {
    if (ids.has(row.id)) throw new TypeError(`duplicate id: ${row.id}`);
    ids.add(row.id);
  }
  return deepFreeze(ledger);
}

export function appendBaselineMeasurement(
  ledger: BaselineMeasurementLedger,
  input: BaselineMeasurementFact,
): BaselineMeasurementLedger {
  if (ledger.kind !== "baseline_measurement_ledger" || ledger.version !== BASELINE_MEASUREMENT_LEDGER_VERSION) {
    throw new TypeError("invalid baseline measurement ledger");
  }
  const row = normalizeFact(input);
  if (ledger.rows.some((existing) => existing.id === row.id)) throw new TypeError(`duplicate id: ${row.id}`);
  return createBaselineMeasurementLedger([...ledger.rows, row]);
}

export function assessBaselineMeasurementReadiness(row: BaselineMeasurementFact): BaselineMeasurementReadiness {
  const blockers: string[] = [];
  if (row.accountId === null) blockers.push("account is missing");
  if (row.platform === null) blockers.push("platform is missing");
  if (row.route !== "/new") blockers.push("route must be /new");
  if (row.metric.name === null) blockers.push("metric name is missing");
  if (row.metric.numerator === null) blockers.push("metric numerator is missing");
  if (row.metric.denominator === null) blockers.push("metric denominator is missing");
  if (row.sample.windowStart === null) blockers.push("sample window start is missing");
  if (row.sample.windowEnd === null) blockers.push("sample window end is missing");
  if (row.method === null) blockers.push("method is missing");
  if (row.observedAt === null) blockers.push("observed time is missing");
  if (row.collectedAt === null) blockers.push("collected time is missing");
  if (row.baselineScope === null) blockers.push("baseline scope is missing");
  if (row.baselineSource === null) blockers.push("baseline source is missing");
  if (row.evidenceRefs.length === 0) blockers.push("evidence refs are missing");
  if (row.reviewerStatus !== "reviewed") blockers.push(`reviewer status is ${row.reviewerStatus}`);
  if (blockers.length > 0 && row.unavailableReason === null) blockers.push("unavailable reason is missing");
  return { status: blockers.length === 0 ? "ready" : "blocked", blockers };
}

export const append = appendBaselineMeasurement;
export const readiness = assessBaselineMeasurementReadiness;
