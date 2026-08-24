/**
 * Append-only persistence for explicit human-reviewed account/example metadata.
 *
 * This is an account-facts boundary, not a content extractor. It stores no creator body,
 * ranking, winner, model, or inferred metadata. Corrections are new rows that explicitly
 * supersede the current row for the same account identity.
 */

export const ACCOUNT_REVIEW_LEDGER_VERSION = "account-review-ledger-v1" as const;

export type AccountReviewPool = "niche" | "broad" | "format";
export type AccountReviewDisposition = "reviewed" | "pending" | "blocked" | "unmapped";
export type AccountReviewIdentityStatus = "confirmed" | "unconfirmed" | "blocked" | "unmapped";
export type AccountReviewScalar = string | "unknown" | null;
export type AccountReviewList = readonly string[] | "unknown" | null;

export interface AccountReviewAudienceSnapshot {
  readonly size: number | "unknown" | null;
  readonly countType: AccountReviewScalar;
  readonly provenance: AccountReviewScalar;
  readonly asOf: AccountReviewScalar;
  readonly collectedAt: AccountReviewScalar;
}

export interface AccountReviewPoolMembership {
  readonly pool: AccountReviewPool;
  readonly reason: string;
}

/** The caller-supplied, body-free row. Computed ledger fields are deliberately absent. */
export interface AccountReviewInput {
  readonly id: string;
  readonly currentAccountKey: string;
  readonly platform: string;
  readonly handle: string | null;
  readonly creator: string | null;
  readonly stableAccountId: string | null;
  readonly stableAccountIdStatus: AccountReviewIdentityStatus;
  readonly topics: AccountReviewList;
  readonly focus: AccountReviewList;
  readonly nicheLabel: AccountReviewScalar;
  readonly researchPoolMembership: readonly AccountReviewPoolMembership[] | "unknown" | null;
  readonly popularityScope: AccountReviewScalar;
  readonly sampleScope: AccountReviewScalar;
  readonly baselineScope: AccountReviewScalar;
  readonly baselineSource: AccountReviewScalar;
  readonly medium: AccountReviewScalar;
  readonly format: AccountReviewScalar;
  readonly audienceSnapshot: AccountReviewAudienceSnapshot | "unknown" | null;
  readonly evidenceRefs: AccountReviewList;
  readonly baselineRefs: AccountReviewList;
  readonly caveats: AccountReviewList;
  readonly reviewer: AccountReviewScalar;
  readonly reviewNote: AccountReviewScalar;
  readonly disposition: AccountReviewDisposition;
  readonly dispositionReason: AccountReviewScalar;
  readonly reviewed_at: AccountReviewScalar;
  /** Null for the first row; a correction must name the row it supersedes. */
  readonly supersedesId: string | null;
}

export interface AccountReviewReadiness {
  readonly status: "ready" | "blocked";
  readonly blockers: string[];
}

export interface AccountReviewLedgerRow extends AccountReviewInput {
  readonly kind: "account_review_ledger_row";
  readonly version: typeof ACCOUNT_REVIEW_LEDGER_VERSION;
  readonly identityKey: string;
  readonly readiness: AccountReviewReadiness;
  readonly bodyIncluded: false;
}

export interface AccountReviewLedgerSummary {
  readonly totalRows: number;
  readonly currentRows: number;
  readonly readyRows: number;
  readonly blockedRows: number;
  readonly reviewedRows: number;
  readonly pendingRows: number;
  readonly blockedStatusRows: number;
  readonly unmappedRows: number;
}

export interface AccountReviewLedger {
  readonly kind: "account_review_ledger";
  readonly version: typeof ACCOUNT_REVIEW_LEDGER_VERSION;
  readonly rows: AccountReviewLedgerRow[];
  readonly summary: AccountReviewLedgerSummary;
  readonly bodyIncluded: false;
  readonly sideEffects: "none";
}

export interface AccountReviewLedgerIo {
  readonly readJsonl: () => string;
  readonly appendJsonl: (value: string) => void;
}

export class AccountReviewLedgerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountReviewLedgerValidationError";
  }
}

type LooseRecord = Record<string, unknown>;
type NormalizedInput = AccountReviewInput;

const POOLS = new Set<AccountReviewPool>(["niche", "broad", "format"]);
const DISPOSITIONS = new Set<AccountReviewDisposition>(["reviewed", "pending", "blocked", "unmapped"]);
const IDENTITY_STATUSES = new Set<AccountReviewIdentityStatus>(["confirmed", "unconfirmed", "blocked", "unmapped"]);

const INPUT_KEYS = [
  "id", "currentAccountKey", "platform", "handle", "creator", "stableAccountId", "stableAccountIdStatus",
  "topics", "focus", "nicheLabel", "researchPoolMembership", "popularityScope", "sampleScope", "baselineScope",
  "baselineSource", "medium", "format", "audienceSnapshot", "evidenceRefs", "baselineRefs", "caveats", "reviewer",
  "reviewNote", "disposition", "dispositionReason", "reviewed_at", "supersedesId",
] as const;

const SNAPSHOT_KEYS = ["size", "countType", "provenance", "asOf", "collectedAt"] as const;
const MEMBERSHIP_KEYS = ["pool", "reason"] as const;
const READINESS_KEYS = ["status", "blockers"] as const;
const PERSISTED_KEYS = [
  ...INPUT_KEYS, "kind", "version", "identityKey", "readiness", "bodyIncluded",
] as const;

/** Names that are rejected with a useful body/model/ranking error before exact-key validation. */
const FORBIDDEN_KEYS = new Set([
  "body", "bodytext", "postbody", "posttext", "creatorbody", "creatorbio", "bio", "description", "about",
  "rawbody", "transcript", "transcripttext", "caption", "content", "text", "title", "onscreentext",
  "opener", "hook", "model", "modelname", "modelversion", "prompt", "completion", "generatedby", "llm",
  "winner", "winners", "selectedwinner", "ranking", "rank", "score", "scores", "popularityrank", "best",
  "top", "selection", "winnerclaim", "causality",
]);

function fail(message: string): never {
  throw new AccountReviewLedgerValidationError(message);
}

function isRecord(value: unknown): value is LooseRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function object(value: unknown, path: string): LooseRecord {
  if (!isRecord(value)) fail(`${path} must be an object`);
  return value;
}

function keyName(key: string): string {
  return key.replace(/[_-]/g, "").toLowerCase();
}

function rejectForbiddenKeys(value: unknown, path: string, seen = new WeakSet<object>()): void {
  if (typeof value !== "object" || value === null) return;
  if (seen.has(value)) fail(`${path} contains a cyclic value`);
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectForbiddenKeys(item, `${path}[${index}]`, seen));
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(keyName(key))) {
      fail(`${path}.${key} is unsupported; account review rows are body-free and do not accept model, ranking, or winner fields`);
    }
    rejectForbiddenKeys(nested, `${path}.${key}`, seen);
  }
}

function exactKeys(value: LooseRecord, allowed: readonly string[], path: string): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) fail(`${path}.${key} is unsupported or unknown`);
  }
}

function has(value: LooseRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function required(value: LooseRecord, key: string, path: string): unknown {
  if (!has(value, key)) fail(`${path}.${key} is required`);
  return value[key];
}

function text(value: unknown, path: string, nullable = true): AccountReviewScalar {
  if (value === "unknown") return "unknown";
  if (value === null || value === undefined) {
    if (nullable) return null;
    fail(`${path} must be a non-empty string`);
  }
  if (typeof value !== "string") fail(`${path} must be a string${nullable ? ", null, or unknown" : ""}`);
  const normalized = value.trim();
  if (!normalized) return nullable ? null : fail(`${path} must be a non-empty string`);
  return normalized;
}

function requiredText(value: unknown, path: string): string {
  const normalized = text(value, path, false);
  return normalized as string;
}

function enumValue<T extends string>(value: unknown, allowed: Set<T>, path: string): T {
  if (typeof value !== "string" || !allowed.has(value as T)) fail(`${path} must be one of: ${[...allowed].join(", ")}`);
  return value as T;
}

function stringList(value: unknown, path: string): AccountReviewList {
  if (value === "unknown") return "unknown";
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) fail(`${path} must be an array, null, or unknown`);
  const values = value.map((item, index) => requiredText(item, `${path}[${index}]`));
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function numberOrUnknown(value: unknown, path: string): number | "unknown" | null {
  if (value === "unknown") return "unknown";
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    fail(`${path} must be a non-negative finite number, null, or unknown`);
  }
  return value;
}

function audienceSnapshot(value: unknown, path: string): AccountReviewAudienceSnapshot | "unknown" | null {
  if (value === "unknown") return "unknown";
  if (value === null || value === undefined) return null;
  const raw = object(value, path);
  exactKeys(raw, SNAPSHOT_KEYS, path);
  return {
    size: numberOrUnknown(raw.size, `${path}.size`),
    countType: text(raw.countType, `${path}.countType`),
    provenance: text(raw.provenance, `${path}.provenance`),
    asOf: text(raw.asOf, `${path}.asOf`),
    collectedAt: text(raw.collectedAt, `${path}.collectedAt`),
  };
}

function memberships(value: unknown, path: string): readonly AccountReviewPoolMembership[] | "unknown" | null {
  if (value === "unknown") return "unknown";
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) fail(`${path} must be an array, null, or unknown`);
  const rows = value.map((item, index) => {
    const raw = object(item, `${path}[${index}]`);
    exactKeys(raw, MEMBERSHIP_KEYS, `${path}[${index}]`);
    const pool = enumValue(required(raw, "pool", `${path}[${index}]`), POOLS, `${path}[${index}].pool`);
    const reason = requiredText(required(raw, "reason", `${path}[${index}]`), `${path}[${index}].reason`);
    return { pool, reason };
  });
  const seen = new Set<AccountReviewPool>();
  for (const row of rows) {
    if (seen.has(row.pool)) fail(`${path} contains duplicate pool "${row.pool}"`);
    seen.add(row.pool);
  }
  return rows.sort((left, right) => left.pool.localeCompare(right.pool) || left.reason.localeCompare(right.reason));
}

function normalizeInput(value: unknown, path = "row"): NormalizedInput {
  rejectForbiddenKeys(value, path);
  const raw = object(value, path);
  exactKeys(raw, INPUT_KEYS, path);
  const disposition = enumValue(required(raw, "disposition", path), DISPOSITIONS, `${path}.disposition`);
  const identityStatus = enumValue(required(raw, "stableAccountIdStatus", path), IDENTITY_STATUSES, `${path}.stableAccountIdStatus`);
  const stableAccountId = text(raw.stableAccountId, `${path}.stableAccountId`);
  const supersedesId = text(required(raw, "supersedesId", path), `${path}.supersedesId`);
  if (supersedesId === "unknown") fail(`${path}.supersedesId must be a row id or null, not unknown`);
  return {
    id: requiredText(required(raw, "id", path), `${path}.id`),
    currentAccountKey: requiredText(required(raw, "currentAccountKey", path), `${path}.currentAccountKey`),
    platform: requiredText(required(raw, "platform", path), `${path}.platform`),
    handle: text(raw.handle, `${path}.handle`) as string | null,
    creator: text(raw.creator, `${path}.creator`) as string | null,
    stableAccountId: stableAccountId as string | null,
    stableAccountIdStatus: identityStatus,
    topics: stringList(raw.topics, `${path}.topics`),
    focus: stringList(raw.focus, `${path}.focus`),
    nicheLabel: text(raw.nicheLabel, `${path}.nicheLabel`),
    researchPoolMembership: memberships(raw.researchPoolMembership, `${path}.researchPoolMembership`),
    popularityScope: text(raw.popularityScope, `${path}.popularityScope`),
    sampleScope: text(raw.sampleScope, `${path}.sampleScope`),
    baselineScope: text(raw.baselineScope, `${path}.baselineScope`),
    baselineSource: text(raw.baselineSource, `${path}.baselineSource`),
    medium: text(raw.medium, `${path}.medium`),
    format: text(raw.format, `${path}.format`),
    audienceSnapshot: audienceSnapshot(raw.audienceSnapshot, `${path}.audienceSnapshot`),
    evidenceRefs: stringList(raw.evidenceRefs, `${path}.evidenceRefs`),
    baselineRefs: stringList(raw.baselineRefs, `${path}.baselineRefs`),
    caveats: stringList(raw.caveats, `${path}.caveats`),
    reviewer: text(raw.reviewer, `${path}.reviewer`),
    reviewNote: text(raw.reviewNote, `${path}.reviewNote`),
    disposition,
    dispositionReason: text(raw.dispositionReason, `${path}.dispositionReason`),
    reviewed_at: text(raw.reviewed_at, `${path}.reviewed_at`),
    supersedesId: supersedesId as string | null,
  };
}

function identityKey(row: Pick<AccountReviewInput, "platform" | "currentAccountKey" | "stableAccountId">): string {
  const stable = row.stableAccountId;
  return stable !== null && stable !== "unknown"
    ? `stable:${stable}`
    : `unconfirmed:${row.platform.toLowerCase()}:${row.currentAccountKey.toLowerCase()}`;
}

function missing(value: unknown): boolean {
  return value === null || value === undefined || value === "unknown";
}

function missingList(value: AccountReviewList | readonly AccountReviewPoolMembership[] | "unknown" | null): boolean {
  return value === null || value === "unknown" || value.length === 0;
}

function readinessFor(row: AccountReviewInput): AccountReviewReadiness {
  const blockers: string[] = [];
  if (row.stableAccountId === null || row.stableAccountId === "unknown") blockers.push("stableAccountId");
  if (row.stableAccountIdStatus !== "confirmed") blockers.push("stableAccountIdStatus");
  if (missingList(row.topics)) blockers.push("topics");
  if (missingList(row.focus)) blockers.push("focus");
  if (missing(row.nicheLabel)) blockers.push("nicheLabel");
  if (missingList(row.researchPoolMembership)) blockers.push("researchPoolMembership");
  for (const field of ["popularityScope", "sampleScope", "baselineScope", "baselineSource", "medium", "format"] as const) {
    if (missing(row[field])) blockers.push(field);
  }
  if (row.audienceSnapshot === null || row.audienceSnapshot === "unknown") {
    blockers.push("audienceSnapshot");
  } else {
    if (missing(row.audienceSnapshot.size)) blockers.push("audienceSnapshot.size");
    for (const field of ["countType", "provenance", "asOf", "collectedAt"] as const) {
      if (missing(row.audienceSnapshot[field])) blockers.push(`audienceSnapshot.${field}`);
    }
  }
  if (missingList(row.evidenceRefs)) blockers.push("evidenceRefs");
  if (missingList(row.baselineRefs)) blockers.push("baselineRefs");
  if (missing(row.reviewer)) blockers.push("reviewer");
  if (missing(row.reviewed_at)) blockers.push("reviewed_at");
  if (row.disposition !== "reviewed") blockers.push(`disposition:${row.disposition}`);
  return { status: blockers.length === 0 ? "ready" : "blocked", blockers };
}

function decorate(row: NormalizedInput): AccountReviewLedgerRow {
  return {
    ...row,
    kind: "account_review_ledger_row",
    version: ACCOUNT_REVIEW_LEDGER_VERSION,
    identityKey: identityKey(row),
    readiness: readinessFor(row),
    bodyIncluded: false,
  };
}

function inputFromRow(row: AccountReviewLedgerRow): AccountReviewInput {
  const {
    kind: _kind, version: _version, identityKey: _identityKey, readiness: _readiness, bodyIncluded: _bodyIncluded,
    ...input
  } = row;
  return input;
}

function compareRows(left: AccountReviewLedgerRow, right: AccountReviewLedgerRow): number {
  return left.identityKey.localeCompare(right.identityKey) || left.id.localeCompare(right.id);
}

function validateHistory(rows: readonly AccountReviewLedgerRow[]): void {
  const ids = new Set<string>();
  const byIdentity = new Map<string, AccountReviewLedgerRow[]>();
  for (const row of rows) {
    if (ids.has(row.id)) fail(`duplicate row id "${row.id}"`);
    ids.add(row.id);
    const group = byIdentity.get(row.identityKey) ?? [];
    group.push(row);
    byIdentity.set(row.identityKey, group);
  }

  for (const [key, group] of byIdentity) {
    const byId = new Map(group.map((row) => [row.id, row]));
    const roots = group.filter((row) => row.supersedesId === null);
    if (roots.length !== 1) fail(`duplicate account identity "${key}" requires one append-only root row`);
    const successors = new Set<string>();
    for (const row of group) {
      if (row.supersedesId === null) continue;
      const target = byId.get(row.supersedesId);
      if (!target) fail(`row "${row.id}" supersedes an unknown or different account row "${row.supersedesId}"`);
      if (successors.has(row.supersedesId)) fail(`row "${row.supersedesId}" has more than one append-only successor`);
      successors.add(row.supersedesId);
    }
    const leaves = group.filter((row) => !successors.has(row.id));
    if (leaves.length !== 1) fail(`account identity "${key}" must have exactly one current append-only row`);
    const visited = new Set<string>();
    const nextBySupersededId = new Map<string, AccountReviewLedgerRow>();
    for (const row of group) if (row.supersedesId !== null) nextBySupersededId.set(row.supersedesId, row);
    let cursor: AccountReviewLedgerRow | undefined = roots[0];
    while (cursor) {
      if (visited.has(cursor.id)) fail(`account identity "${key}" contains a supersession cycle`);
      visited.add(cursor.id);
      cursor = nextBySupersededId.get(cursor.id);
    }
    if (visited.size !== group.length) fail(`account identity "${key}" contains a disconnected revision`);
  }
}

function summaryFor(rows: readonly AccountReviewLedgerRow[]): AccountReviewLedgerSummary {
  const superseded = new Set(rows.flatMap((row) => row.supersedesId === null ? [] : [row.supersedesId]));
  return {
    totalRows: rows.length,
    currentRows: rows.filter((row) => !superseded.has(row.id)).length,
    readyRows: rows.filter((row) => row.readiness.status === "ready").length,
    blockedRows: rows.filter((row) => row.readiness.status === "blocked").length,
    reviewedRows: rows.filter((row) => row.disposition === "reviewed").length,
    pendingRows: rows.filter((row) => row.disposition === "pending").length,
    blockedStatusRows: rows.filter((row) => row.disposition === "blocked").length,
    unmappedRows: rows.filter((row) => row.disposition === "unmapped").length,
  };
}

export function buildAccountReviewLedger(values: readonly AccountReviewInput[]): AccountReviewLedger {
  const rows = values.map((value, index) => decorate(normalizeInput(value, `rows[${index}]`)));
  validateHistory(rows);
  const ordered = [...rows].sort(compareRows);
  return {
    kind: "account_review_ledger",
    version: ACCOUNT_REVIEW_LEDGER_VERSION,
    rows: ordered,
    summary: summaryFor(ordered),
    bodyIncluded: false,
    sideEffects: "none",
  };
}

function persistedRow(value: unknown, index: number): AccountReviewLedgerRow {
  const path = `jsonl line ${index + 1}`;
  rejectForbiddenKeys(value, path);
  const raw = object(value, path);
  exactKeys(raw, PERSISTED_KEYS, path);
  if (raw.kind !== "account_review_ledger_row") fail(`${path}.kind must be account_review_ledger_row`);
  if (raw.version !== ACCOUNT_REVIEW_LEDGER_VERSION) fail(`${path}.version must be ${ACCOUNT_REVIEW_LEDGER_VERSION}`);
  if (raw.bodyIncluded !== false) fail(`${path}.bodyIncluded must be false`);
  const inputRaw: LooseRecord = {};
  for (const key of INPUT_KEYS) inputRaw[key] = raw[key];
  const normalized = normalizeInput(inputRaw, path);
  const row = decorate(normalized);
  if (raw.identityKey !== row.identityKey) fail(`${path}.identityKey does not match the explicit account identity`);
  const readiness = object(raw.readiness, `${path}.readiness`);
  exactKeys(readiness, READINESS_KEYS, `${path}.readiness`);
  if (readiness.status !== row.readiness.status) fail(`${path}.readiness.status is stale or invalid`);
  if (!Array.isArray(readiness.blockers) || JSON.stringify(readiness.blockers) !== JSON.stringify(row.readiness.blockers)) {
    fail(`${path}.readiness.blockers is stale or invalid`);
  }
  return row;
}

export function readAccountReviewLedger(jsonl: string): AccountReviewLedger {
  if (typeof jsonl !== "string") fail("account review ledger input must be JSONL text");
  const values = jsonl.split(/\r?\n/).flatMap((line, index) => {
    if (!line.trim()) return [];
    try {
      return [persistedRow(JSON.parse(line) as unknown, index)];
    } catch (error) {
      if (error instanceof AccountReviewLedgerValidationError) throw error;
      fail(`jsonl line ${index + 1} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  validateHistory(values);
  return buildAccountReviewLedger(values.map(inputFromRow));
}

function currentRowFor(rows: readonly AccountReviewLedgerRow[], key: string): AccountReviewLedgerRow | null {
  const group = rows.filter((row) => row.identityKey === key);
  if (group.length === 0) return null;
  const superseded = new Set(group.flatMap((row) => row.supersedesId === null ? [] : [row.supersedesId]));
  return group.find((row) => !superseded.has(row.id)) ?? null;
}

export function appendAccountReviewRow(io: AccountReviewLedgerIo, value: AccountReviewInput): AccountReviewLedger {
  const existingJsonl = io.readJsonl();
  const current = readAccountReviewLedger(existingJsonl);
  const candidate = decorate(normalizeInput(value, "append"));
  if (current.rows.some((row) => row.id === candidate.id)) fail(`duplicate row id "${candidate.id}"`);
  const currentRow = currentRowFor(current.rows, candidate.identityKey);
  if (currentRow === null && candidate.supersedesId !== null) {
    fail(`new account identity "${candidate.identityKey}" cannot supersede a missing row`);
  }
  if (currentRow !== null && candidate.supersedesId !== currentRow.id) {
    fail(`account identity "${candidate.identityKey}" already exists; append a correction that supersedes current row "${currentRow.id}"`);
  }
  const next = buildAccountReviewLedger([...current.rows.map(inputFromRow), value]);
  const prefix = existingJsonl.length > 0 && !existingJsonl.endsWith("\n") ? "\n" : "";
  io.appendJsonl(`${prefix}${JSON.stringify(candidate)}\n`);
  return next;
}

export const createAccountReviewLedger = buildAccountReviewLedger;
export const loadAccountReviewLedger = readAccountReviewLedger;
export const appendAccountReviewLedger = appendAccountReviewRow;
