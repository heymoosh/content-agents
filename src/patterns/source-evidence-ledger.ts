import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Durable, body-free source/post evidence. This is a persistence boundary, not a collector or
 * ranking engine. It accepts explicit facts, keeps incomplete rows visible as blocked, and never
 * stores creator prose, model output, or a winner decision.
 */
export const SOURCE_EVIDENCE_LEDGER_VERSION = "source-evidence-ledger-v1" as const;

export type SourceEvidenceLedgerPool = "niche" | "broad" | "format";
export type SourceEvidenceLedgerScalar<T> = T | "unknown" | null;

export interface SourceEvidenceLedgerMetricSnapshot {
  readonly metric: SourceEvidenceLedgerScalar<string>;
  readonly value: SourceEvidenceLedgerScalar<number>;
  readonly unit: SourceEvidenceLedgerScalar<string>;
  readonly numerator: SourceEvidenceLedgerScalar<number>;
  readonly denominator: SourceEvidenceLedgerScalar<number>;
  readonly window: SourceEvidenceLedgerScalar<string>;
  readonly scope: SourceEvidenceLedgerScalar<string>;
  readonly observedAt: SourceEvidenceLedgerScalar<string>;
}

export interface SourceEvidenceLedgerAudienceSizeSnapshot {
  readonly size: SourceEvidenceLedgerScalar<number>;
  readonly countType: SourceEvidenceLedgerScalar<string>;
  readonly observedAt: SourceEvidenceLedgerScalar<string>;
  readonly collectedAt: SourceEvidenceLedgerScalar<string>;
  readonly evidenceSource: SourceEvidenceLedgerScalar<string>;
}

export interface SourceEvidenceLedgerLineageRef {
  readonly recordType: string;
  readonly id: string;
  readonly relation: string;
}

export interface SourceEvidenceLedgerReadiness {
  readonly status: "ready" | "blocked";
  readonly blockers: string[];
}

export interface SourceEvidenceLedgerRecord {
  readonly kind: "source_evidence_ledger_record";
  readonly version: typeof SOURCE_EVIDENCE_LEDGER_VERSION;
  /** `id` remains the existing source-evidence identity; `evidenceId` makes the durable key explicit. */
  readonly id: string;
  readonly evidenceId: string;
  readonly sourceId: SourceEvidenceLedgerScalar<string>;
  readonly postId: SourceEvidenceLedgerScalar<string>;
  readonly accountId: SourceEvidenceLedgerScalar<string>;
  readonly platform: SourceEvidenceLedgerScalar<string>;
  readonly url: SourceEvidenceLedgerScalar<string>;
  readonly locator: SourceEvidenceLedgerScalar<string>;
  readonly sourceRole: SourceEvidenceLedgerScalar<string>;
  readonly evidenceLocation: SourceEvidenceLedgerScalar<string>;
  readonly comparisonClaimed: boolean | null;
  readonly pool: SourceEvidenceLedgerPool | null;
  readonly membershipReason: SourceEvidenceLedgerScalar<string>;
  readonly nicheLabel: SourceEvidenceLedgerScalar<string>;
  readonly topics: string[] | "unknown" | null;
  readonly focus: string[] | "unknown" | null;
  readonly medium: SourceEvidenceLedgerScalar<string>;
  readonly format: SourceEvidenceLedgerScalar<string>;
  readonly audienceSizeSnapshot: SourceEvidenceLedgerAudienceSizeSnapshot | "unknown" | null;
  readonly metricSnapshot: SourceEvidenceLedgerMetricSnapshot | "unknown" | null;
  readonly popularityScope: SourceEvidenceLedgerScalar<string>;
  readonly sampleScope: SourceEvidenceLedgerScalar<string>;
  readonly observedAt: SourceEvidenceLedgerScalar<string>;
  readonly collectedAt: SourceEvidenceLedgerScalar<string>;
  readonly selectionRule: SourceEvidenceLedgerScalar<string>;
  readonly baselineScope: SourceEvidenceLedgerScalar<string>;
  readonly provenance: SourceEvidenceLedgerScalar<string>;
  readonly evidenceRefs: string[] | "unknown" | null;
  readonly baselineRefs: string[] | "unknown" | null;
  readonly baselineSource: SourceEvidenceLedgerScalar<string>;
  readonly bodyComplete: boolean | "unknown" | null;
  readonly reviewStatus: SourceEvidenceLedgerScalar<string>;
  readonly recordStatus: SourceEvidenceLedgerScalar<string>;
  readonly caveats: string[] | "unknown" | null;
  readonly lineage: SourceEvidenceLedgerLineageRef[] | "unknown" | null;
  readonly readiness: SourceEvidenceLedgerReadiness;
  readonly bodyIncluded: false;
}

export interface SourceEvidenceLedger {
  readonly kind: "source_evidence_ledger";
  readonly version: typeof SOURCE_EVIDENCE_LEDGER_VERSION;
  readonly rows: SourceEvidenceLedgerRecord[];
  readonly summary: {
    readonly total: number;
    readonly ready: number;
    readonly blocked: number;
    readonly reviewed: number;
    readonly unreviewed: number;
  };
  readonly readiness: SourceEvidenceLedgerReadiness;
  readonly bodyIncluded: false;
  readonly winnerClaimsAllowed: false;
  readonly sideEffects: "none";
}

export interface SourceEvidenceLedgerPersistence {
  /** Return the existing JSONL text. An empty string means an empty ledger. */
  readonly read: () => string;
  /** Append exactly one or more newline-terminated normalized JSONL records. */
  readonly append: (value: string) => void;
}

export class SourceEvidenceLedgerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceEvidenceLedgerValidationError";
  }
}

type LooseRecord = Record<string, unknown>;

const POOLS = new Set<SourceEvidenceLedgerPool>(["niche", "broad", "format"]);
const UNSUPPORTED_KEY_NAMES = new Set([
  "body", "bodytext", "postbody", "posttext", "creatorbody", "rawbody", "transcript", "transcripttext",
  "caption", "content", "onscreentext", "model", "modelname", "modelversion", "prompt", "completion",
  "llm", "generatedby", "email", "phone", "phonenumber", "address", "ip", "ipaddress", "pii",
  "ranking", "rank", "score", "scores", "winner", "winners", "selectedwinner", "winnerclaim",
]);

const RECORD_KEYS = new Set([
  "kind", "version", "id", "evidenceId", "evidence_id", "sourceId", "source_id", "postId", "post_id",
  "accountId", "account_id", "platform", "pool", "membershipReason", "membership_reason", "poolMembershipReason",
  "nicheLabel", "niche_label", "niche", "topics", "focus", "medium", "format", "metricSnapshot", "metric_snapshot",
  "audienceSizeSnapshot", "audience_size_snapshot", "audienceSnapshot", "audience_snapshot",
  "popularityScope", "popularity_scope", "sampleScope", "sample_scope", "observedAt", "observed_at", "postedAt", "posted_at",
  "collectedAt", "collected_at", "selectionRule", "selection_rule", "baselineScope", "baseline_scope", "provenance", "evidenceRefs", "evidence_refs",
  "evidenceLinks", "evidence_links", "baselineRefs", "baseline_refs", "baselineSource", "baseline_source",
  "bodyComplete", "body_complete", "bodyIsComplete", "body_is_complete", "reviewStatus", "review_status", "status",
  "recordStatus", "record_status", "caveats", "lineage", "readiness", "bodyIncluded", "body_included", "comparisonClaimed",
  "comparison_claimed", "sourceRole", "source_role", "evidenceLocation", "evidence_location", "metric", "url", "locator",
]);
const METRIC_KEYS = new Set([
  "metric", "name", "value", "unit", "numerator", "denominator", "window", "scope", "observedAt", "observed_at",
]);
const AUDIENCE_KEYS = new Set([
  "size", "value", "count", "countType", "count_type", "type", "observedAt", "observed_at", "asOf", "as_of",
  "collectedAt", "collected_at", "evidenceSource", "evidence_source", "provenance", "source",
]);
const LINEAGE_KEYS = new Set(["recordType", "record_type", "id", "relation"]);
const READINESS_KEYS = new Set(["status", "blockers", "blockingFields", "blocking_fields", "reason"]);

function fail(message: string): never {
  throw new SourceEvidenceLedgerValidationError(message);
}

function isRecord(value: unknown): value is LooseRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function object(value: unknown, path: string): LooseRecord {
  if (!isRecord(value)) fail(`${path} must be an object`);
  return value;
}

function keyName(key: string): string {
  return key.replace(/[_-]/g, "").toLowerCase();
}

function rejectUnsafeFields(value: unknown, path: string, seen = new WeakSet<object>()): void {
  if (value === null || typeof value !== "object") return;
  if (seen.has(value)) fail(`${path} contains a cyclic value`);
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectUnsafeFields(item, `${path}[${index}]`, seen));
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (UNSUPPORTED_KEY_NAMES.has(keyName(key))) fail(`${path}.${key} is unsupported; body, PII, model, ranking, and winner fields are not accepted`);
    rejectUnsafeFields(nested, `${path}.${key}`, seen);
  }
}

function rejectUnknownFields(value: LooseRecord, path: string, allowed: ReadonlySet<string>): void {
  for (const key of Object.keys(value)) if (!allowed.has(key)) fail(`${path}.${key} is an unknown field`);
}

function own(record: LooseRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function present(record: LooseRecord, keys: readonly string[]): unknown {
  for (const key of keys) if (own(record, key) && record[key] !== undefined) return record[key];
  return undefined;
}

/** Prefer explicit evidence refs, but do not let a null/empty compatibility alias hide links. */
function evidenceReferences(record: LooseRecord): unknown {
  const refs = present(record, ["evidenceRefs", "evidence_refs"]);
  if (refs !== undefined && refs !== null && refs !== "unknown" && (!Array.isArray(refs) || refs.length > 0)) return refs;
  const links = present(record, ["evidenceLinks", "evidence_links"]);
  return links === undefined ? refs : links;
}

function text(value: unknown, path: string): SourceEvidenceLedgerScalar<string> {
  if (value === undefined || value === null) return null;
  if (value === "unknown") return "unknown";
  if (typeof value !== "string") fail(`${path} must be a string, null, or unknown`);
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function requiredText(value: unknown, path: string): string | null {
  const normalized = text(value, path);
  return normalized === "unknown" ? null : normalized;
}

function numberValue(value: unknown, path: string): SourceEvidenceLedgerScalar<number> {
  if (value === undefined || value === null) return null;
  if (value === "unknown") return "unknown";
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) fail(`${path} must be a non-negative finite number, null, or unknown`);
  return value;
}

function booleanValue(value: unknown, path: string): boolean | "unknown" | null {
  if (value === undefined || value === null) return null;
  if (value === "unknown") return "unknown";
  if (typeof value !== "boolean") fail(`${path} must be boolean, null, or unknown`);
  return value;
}

function stringList(value: unknown, path: string): string[] | "unknown" | null {
  if (value === undefined || value === null) return null;
  if (value === "unknown") return "unknown";
  if (!Array.isArray(value)) fail(`${path} must be an array of strings, null, or unknown`);
  const values = value.map((item, index) => {
    if (typeof item !== "string" || item.trim() === "") fail(`${path}[${index}] must be a non-empty string`);
    return item.trim();
  });
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function pool(value: unknown, path: string): SourceEvidenceLedgerPool | null {
  const normalized = text(value, path);
  if (normalized === null || normalized === "unknown") return null;
  if (!POOLS.has(normalized as SourceEvidenceLedgerPool)) fail(`${path} must be niche, broad, or format; pool membership is never inferred`);
  return normalized as SourceEvidenceLedgerPool;
}

function audienceSizeSnapshot(value: unknown, path: string): SourceEvidenceLedgerAudienceSizeSnapshot | "unknown" | null {
  if (value === undefined || value === null) return null;
  if (value === "unknown") return "unknown";
  const raw = object(value, path);
  rejectUnsafeFields(raw, path);
  rejectUnknownFields(raw, path, AUDIENCE_KEYS);
  return {
    size: numberValue(present(raw, ["size", "value", "count"]), `${path}.size`),
    countType: text(present(raw, ["countType", "count_type", "type"]), `${path}.countType`),
    observedAt: text(present(raw, ["observedAt", "observed_at", "asOf", "as_of"]), `${path}.observedAt`),
    collectedAt: text(present(raw, ["collectedAt", "collected_at"]), `${path}.collectedAt`),
    evidenceSource: text(present(raw, ["evidenceSource", "evidence_source", "provenance", "source"]), `${path}.evidenceSource`),
  };
}

function metricSnapshot(value: unknown, path: string): SourceEvidenceLedgerMetricSnapshot | "unknown" | null {
  if (value === undefined || value === null) return null;
  if (value === "unknown") return "unknown";
  const raw = object(value, path);
  rejectUnsafeFields(raw, path);
  rejectUnknownFields(raw, path, METRIC_KEYS);
  return {
    metric: text(present(raw, ["metric", "name"]), `${path}.metric`),
    value: numberValue(present(raw, ["value"]), `${path}.value`),
    unit: text(present(raw, ["unit"]), `${path}.unit`),
    numerator: numberValue(present(raw, ["numerator"]), `${path}.numerator`),
    denominator: numberValue(present(raw, ["denominator"]), `${path}.denominator`),
    window: text(present(raw, ["window"]), `${path}.window`),
    scope: text(present(raw, ["scope"]), `${path}.scope`),
    observedAt: text(present(raw, ["observedAt", "observed_at"]), `${path}.observedAt`),
  };
}

function lineage(value: unknown, path: string): SourceEvidenceLedgerLineageRef[] | "unknown" | null {
  if (value === undefined || value === null) return null;
  if (value === "unknown") return "unknown";
  if (!Array.isArray(value)) fail(`${path} must be an array, null, or unknown`);
  const rows = value.map((item, index) => {
    const raw = object(item, `${path}[${index}]`);
    rejectUnsafeFields(raw, `${path}[${index}]`);
    rejectUnknownFields(raw, `${path}[${index}]`, LINEAGE_KEYS);
    const recordType = requiredText(present(raw, ["recordType", "record_type"]), `${path}[${index}].recordType`);
    const id = requiredText(present(raw, ["id"]), `${path}[${index}].id`);
    const relation = requiredText(present(raw, ["relation"]), `${path}[${index}].relation`);
    if (recordType === null || id === null || relation === null) fail(`${path}[${index}] requires recordType, id, and relation`);
    return { recordType, id, relation };
  });
  return rows.sort((left, right) => left.recordType.localeCompare(right.recordType) || left.id.localeCompare(right.id) || left.relation.localeCompare(right.relation));
}

function missing(value: unknown): boolean {
  return value === null || value === undefined || value === "unknown";
}

function missingList(value: string[] | "unknown" | null): boolean {
  return value === null || value === "unknown" || value.length === 0;
}

function metricBlockers(metric: SourceEvidenceLedgerRecord["metricSnapshot"]): string[] {
  if (metric === null || metric === "unknown") return ["metricSnapshot"];
  const blockers: string[] = [];
  for (const field of ["metric", "value", "unit", "numerator", "denominator", "window", "scope", "observedAt"] as const) {
    if (missing(metric[field])) blockers.push(`metricSnapshot.${field}`);
  }
  if (metric.denominator !== null && metric.denominator !== "unknown" && metric.denominator <= 0) blockers.push("metricSnapshot.denominator must be positive");
  return blockers;
}

function audienceBlockers(audience: SourceEvidenceLedgerRecord["audienceSizeSnapshot"]): string[] {
  if (audience === null || audience === "unknown") return ["audienceSizeSnapshot"];
  const blockers: string[] = [];
  for (const field of ["size", "countType", "observedAt", "collectedAt", "evidenceSource"] as const) {
    if (missing(audience[field])) blockers.push(`audienceSizeSnapshot.${field}`);
  }
  return blockers;
}

/** Report comparison blockers without dropping an incomplete or unreviewed row. */
export function assessSourceEvidenceLedgerRecord(row: SourceEvidenceLedgerRecord): SourceEvidenceLedgerReadiness {
  const blockers: string[] = [];
  const add = (value: string) => { if (!blockers.includes(value)) blockers.push(value); };
  const comparisonRequired = row.comparisonClaimed !== false;
  if (missing(row.evidenceId)) add("evidenceId");
  if (missing(row.postId)) add("postId");
  if (missing(row.accountId)) add("accountId");
  if (missing(row.platform)) add("platform");
  if (row.pool === null) add("pool: explicit membership is required; it was not inferred");
  if (missing(row.membershipReason)) add("membershipReason");
  if (missing(row.nicheLabel)) add("nicheLabel");
  if (missingList(row.topics)) add("topics");
  if (missingList(row.focus)) add("focus");
  if (missing(row.medium)) add("medium");
  if (missing(row.format)) add("format");
  if (comparisonRequired) {
    for (const blocker of audienceBlockers(row.audienceSizeSnapshot)) add(blocker);
    for (const blocker of metricBlockers(row.metricSnapshot)) add(blocker);
  }
  for (const [field, value] of [
    ["popularityScope", row.popularityScope],
    ["sampleScope", row.sampleScope],
    ["observedAt", row.observedAt],
    ["collectedAt", row.collectedAt],
    ["selectionRule", row.selectionRule],
    ["provenance", row.provenance],
  ] as const) if (missing(value)) add(field);
  if (comparisonRequired) {
    if (missing(row.baselineScope)) add("baselineScope");
    if (missing(row.baselineSource)) add("baselineSource");
    if (row.baselineRefs === null || row.baselineRefs === "unknown" || row.baselineRefs.length === 0) add("baselineRefs");
  }
  if (row.evidenceRefs === null || row.evidenceRefs === "unknown" || row.evidenceRefs.length === 0) add("evidenceRefs");
  if (row.bodyComplete !== true) add("bodyComplete");
  if (missing(row.reviewStatus) || row.reviewStatus !== "reviewed") add("reviewStatus");
  if (row.caveats === null || row.caveats === "unknown") add("caveats");
  return { status: blockers.length === 0 ? "ready" : "blocked", blockers: blockers.sort((left, right) => left.localeCompare(right)) };
}

function normalizeRecord(value: unknown): SourceEvidenceLedgerRecord {
  const raw = object(value, "record");
  rejectUnsafeFields(raw, "record");
  rejectUnknownFields(raw, "record", RECORD_KEYS);
  if (own(raw, "readiness")) {
    const readiness = object(raw.readiness, "record.readiness");
    rejectUnsafeFields(readiness, "record.readiness");
    rejectUnknownFields(readiness, "record.readiness", READINESS_KEYS);
  }
  const evidenceId = requiredText(present(raw, ["evidenceId", "evidence_id", "id"]), "record.evidenceId");
  if (evidenceId === null) fail("record.evidenceId is required and cannot be unknown");
  const normalized: Omit<SourceEvidenceLedgerRecord, "readiness"> = {
    kind: "source_evidence_ledger_record",
    version: SOURCE_EVIDENCE_LEDGER_VERSION,
    id: evidenceId,
    evidenceId,
    sourceId: text(present(raw, ["sourceId", "source_id"]), "record.sourceId"),
    postId: text(present(raw, ["postId", "post_id"]), "record.postId"),
    accountId: text(present(raw, ["accountId", "account_id"]), "record.accountId"),
    platform: text(present(raw, ["platform"]), "record.platform"),
    url: text(present(raw, ["url"]), "record.url"),
    locator: text(present(raw, ["locator"]), "record.locator"),
    sourceRole: text(present(raw, ["sourceRole", "source_role"]), "record.sourceRole"),
    evidenceLocation: text(present(raw, ["evidenceLocation", "evidence_location"]), "record.evidenceLocation"),
    comparisonClaimed: (() => {
      const value = present(raw, ["comparisonClaimed", "comparison_claimed"]);
      if (value === undefined || value === null) return null;
      if (typeof value !== "boolean") fail("record.comparisonClaimed must be boolean or null");
      return value;
    })(),
    pool: pool(present(raw, ["pool"]), "record.pool"),
    membershipReason: text(present(raw, ["membershipReason", "membership_reason", "poolMembershipReason"]), "record.membershipReason"),
    nicheLabel: text(present(raw, ["nicheLabel", "niche_label", "niche"]), "record.nicheLabel"),
    topics: stringList(present(raw, ["topics"]), "record.topics"),
    focus: stringList(present(raw, ["focus"]), "record.focus"),
    medium: text(present(raw, ["medium"]), "record.medium"),
    format: text(present(raw, ["format"]), "record.format"),
    audienceSizeSnapshot: audienceSizeSnapshot(present(raw, ["audienceSizeSnapshot", "audience_size_snapshot", "audienceSnapshot", "audience_snapshot"]), "record.audienceSizeSnapshot"),
    metricSnapshot: metricSnapshot(present(raw, ["metricSnapshot", "metric_snapshot", "metric"]), "record.metricSnapshot"),
    popularityScope: text(present(raw, ["popularityScope", "popularity_scope"]), "record.popularityScope"),
    sampleScope: text(present(raw, ["sampleScope", "sample_scope"]), "record.sampleScope"),
    observedAt: text(present(raw, ["observedAt", "observed_at", "postedAt", "posted_at"]), "record.observedAt"),
    collectedAt: text(present(raw, ["collectedAt", "collected_at"]), "record.collectedAt"),
    selectionRule: text(present(raw, ["selectionRule", "selection_rule"]), "record.selectionRule"),
    baselineScope: text(present(raw, ["baselineScope", "baseline_scope"]), "record.baselineScope"),
    provenance: text(present(raw, ["provenance"]), "record.provenance"),
    evidenceRefs: stringList(evidenceReferences(raw), "record.evidenceRefs"),
    baselineRefs: stringList(present(raw, ["baselineRefs", "baseline_refs"]), "record.baselineRefs"),
    baselineSource: text(present(raw, ["baselineSource", "baseline_source"]), "record.baselineSource"),
    bodyComplete: booleanValue(present(raw, ["bodyComplete", "body_complete", "bodyIsComplete", "body_is_complete"]), "record.bodyComplete"),
    reviewStatus: text(present(raw, ["reviewStatus", "review_status"]), "record.reviewStatus"),
    recordStatus: text(present(raw, ["recordStatus", "record_status", "status"]), "record.recordStatus"),
    caveats: stringList(present(raw, ["caveats"]), "record.caveats"),
    lineage: lineage(present(raw, ["lineage"]), "record.lineage"),
    bodyIncluded: false,
  };
  const readiness = assessSourceEvidenceLedgerRecord(normalized as SourceEvidenceLedgerRecord);
  return { ...normalized, readiness };
}

/** Normalize an existing source-evidence/reviewed-intake-shaped row into the durable view. */
export function normalizeSourceEvidenceLedgerRecord(value: unknown): SourceEvidenceLedgerRecord {
  return normalizeRecord(value);
}

function inputRows(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const raw = object(value, "input");
  const allowed = new Set(["rows", "records"]);
  for (const key of Object.keys(raw)) if (!allowed.has(key)) fail(`input.${key} is an unknown field`);
  const rows = present(raw, ["rows", "records"]);
  if (!Array.isArray(rows)) fail("input.rows must be an array");
  return rows;
}

function compareRows(left: SourceEvidenceLedgerRecord, right: SourceEvidenceLedgerRecord): number {
  return String(left.platform ?? "").localeCompare(String(right.platform ?? ""))
    || left.evidenceId.localeCompare(right.evidenceId)
    || String(left.postId ?? "").localeCompare(String(right.postId ?? ""));
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

/** Build a deterministic read model. Incomplete rows remain present and visibly blocked. */
export function buildSourceEvidenceLedger(input: readonly unknown[] | { readonly rows: readonly unknown[] } | unknown): SourceEvidenceLedger {
  const normalized = inputRows(input).map((value, index) => {
    try { return normalizeRecord(value); }
    catch (error) { fail(`rows[${index}]: ${error instanceof Error ? error.message : "invalid source evidence row"}`); }
  });
  const ids = new Set<string>();
  for (const row of normalized) {
    if (ids.has(row.evidenceId)) fail(`duplicate evidence id: ${row.evidenceId}`);
    ids.add(row.evidenceId);
  }
  const rows = [...normalized].sort(compareRows);
  const blockers = rows.flatMap((row) => row.readiness.blockers.map((blocker) => `${row.evidenceId}: ${blocker}`));
  const reviewed = rows.filter((row) => row.reviewStatus === "reviewed").length;
  return {
    kind: "source_evidence_ledger",
    version: SOURCE_EVIDENCE_LEDGER_VERSION,
    rows,
    summary: { total: rows.length, ready: rows.filter((row) => row.readiness.status === "ready").length, blocked: rows.filter((row) => row.readiness.status === "blocked").length, reviewed, unreviewed: rows.length - reviewed },
    readiness: { status: blockers.length === 0 ? "ready" : "blocked", blockers: unique(blockers) },
    bodyIncluded: false,
    winnerClaimsAllowed: false,
    sideEffects: "none",
  };
}

/** Explicitly reject a row from comparison use while retaining it for blocked inspection. */
export function assertComparableSourceEvidenceRecord(value: unknown): SourceEvidenceLedgerRecord {
  const row = normalizeRecord(value);
  if (row.readiness.status !== "ready") fail(`source evidence ${row.evidenceId} is not comparison-ready: ${row.readiness.blockers.join(", ")}`);
  return row;
}

function parseJsonLine(line: string, index: number): SourceEvidenceLedgerRecord {
  let parsed: unknown;
  try { parsed = JSON.parse(line) as unknown; }
  catch { fail(`ledger line ${index + 1} is not valid JSON`); }
  try { return normalizeRecord(parsed); }
  catch (error) { fail(`ledger line ${index + 1}: ${error instanceof Error ? error.message : "invalid source evidence row"}`); }
}

/** Read JSONL without repairing, rewriting, deleting, or silently omitting blocked rows. */
export function readSourceEvidenceLedger(io: SourceEvidenceLedgerPersistence): SourceEvidenceLedgerRecord[] {
  const raw = io.read();
  if (typeof raw !== "string") fail("persistence read must return text");
  const rows = raw.split("\n").filter((line) => line.trim() !== "").map(parseJsonLine);
  const ids = new Set<string>();
  for (const row of rows) {
    if (ids.has(row.evidenceId)) fail(`ledger contains duplicate evidence id: ${row.evidenceId}`);
    ids.add(row.evidenceId);
  }
  return rows;
}

/** Append a batch atomically with respect to validation; existing IDs can never be edited in place. */
export function appendSourceEvidenceLedgerRecords(input: readonly unknown[], io: SourceEvidenceLedgerPersistence): SourceEvidenceLedgerRecord[] {
  const rows = input.map((value, index) => {
    try { return normalizeRecord(value); }
    catch (error) { fail(`rows[${index}]: ${error instanceof Error ? error.message : "invalid source evidence row"}`); }
  });
  const existing = readSourceEvidenceLedger(io);
  const ids = new Set(existing.map((row) => row.evidenceId));
  for (const row of rows) {
    if (ids.has(row.evidenceId)) fail(`source evidence id already exists; in-place edits are rejected: ${row.evidenceId}`);
    ids.add(row.evidenceId);
  }
  if (rows.length > 0) io.append(`${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
  return rows;
}

export function appendSourceEvidenceLedgerRecord(value: unknown, io: SourceEvidenceLedgerPersistence): SourceEvidenceLedgerRecord {
  return appendSourceEvidenceLedgerRecords([value], io)[0] as SourceEvidenceLedgerRecord;
}

export const createSourceEvidenceLedger = buildSourceEvidenceLedger;
export const loadSourceEvidenceLedger = readSourceEvidenceLedger;
export const appendSourceEvidenceLedger = appendSourceEvidenceLedgerRecord;

/** Filesystem adapter kept here so callers can inject a memory adapter in tests or a database adapter in production. */
export function fileSourceEvidenceLedgerPersistence(path: string): SourceEvidenceLedgerPersistence {
  return {
    read: () => existsSync(path) ? readFileSync(path, "utf8") : "",
    append: (value) => {
      mkdirSync(dirname(path), { recursive: true });
      appendFileSync(path, value, "utf8");
    },
  };
}
