import { PLATFORMS, type Platform } from "./types.js";

export const HOOK_TEMPLATE_LEDGER_VERSION = "hook-template-ledger-v1" as const;

export type HookTemplateReviewState = "pending" | "passed" | "failed" | "not-run";
export type HookTemplateEvidenceStatus = "measured" | "unmeasured" | "insufficient";
export type HookTemplateSourceKind = "library-row" | "opener-evidence" | "corpus-entry";

export interface HookTemplateSourceRef {
  readonly sourceId: string;
  readonly location: string;
  readonly kind: HookTemplateSourceKind;
  readonly url?: string;
  readonly evidenceStatus: HookTemplateEvidenceStatus;
  readonly caveats: readonly string[];
}

/** Curated metadata for a reusable hook mechanism, never a copy bank. */
export interface HookTemplateRecord {
  readonly id: string;
  readonly name: string;
  readonly mechanism: string;
  readonly platforms: readonly Platform[];
  readonly niches: readonly string[];
  readonly formats: readonly string[];
  readonly slots: readonly string[];
  readonly sourceRefs: readonly HookTemplateSourceRef[];
  readonly review: HookTemplateReviewState;
  readonly originality: HookTemplateReviewState;
  readonly evidenceStatus: "supported" | "hypothesis" | "insufficient" | "blocked";
  readonly adaptationNote: string;
  readonly generatesCopy: false;
  readonly creatorBodyCopyAllowed: false;
}

export interface HookTemplateFilter {
  readonly platform?: Platform;
  readonly niche?: string;
  readonly format?: string;
  readonly includeUnreviewed?: boolean;
}

export interface HookTemplateLedgerView {
  readonly kind: "hook_template_ledger";
  readonly version: typeof HOOK_TEMPLATE_LEDGER_VERSION;
  readonly rows: readonly HookTemplateRecord[];
  readonly summary: {
    readonly total: number;
    readonly reviewed: number;
    readonly unreviewed: number;
    readonly measured: number;
  };
  readonly bodyIncluded: false;
  readonly winnerClaimsAllowed: false;
  readonly sideEffects: "none";
  readonly generatesCopy: false;
  readonly creatorBodyCopyAllowed: false;
}

export class HookTemplateLedgerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HookTemplateLedgerValidationError";
  }
}

function fail(message: string): never {
  throw new HookTemplateLedgerValidationError(message);
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${field} must be an object`);
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) fail(`${field} must be a non-empty string`);
  return value.trim();
}

function optionalText(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  return text(value, field);
}

function array(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value)) fail(`${field} must be an array`);
  return value;
}

function strings(value: unknown, field: string): string[] {
  const result = array(value, field).map((item, index) => text(item, `${field}[${index + 1}]`));
  if (result.length === 0) fail(`${field} must not be empty`);
  return [...new Set(result)].sort(compare);
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function enumValue<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  const normalized = text(value, field) as T;
  if (!allowed.includes(normalized)) fail(`${field} must be one of ${allowed.join(", ")}`);
  return normalized;
}

const REVIEW_STATES = ["pending", "passed", "failed", "not-run"] as const;
const EVIDENCE_STATUSES = ["measured", "unmeasured", "insufficient"] as const;
const SOURCE_KINDS = ["library-row", "opener-evidence", "corpus-entry"] as const;
const RECORD_EVIDENCE_STATUSES = ["supported", "hypothesis", "insufficient", "blocked"] as const;

const FORBIDDEN_KEYS = new Set([
  "body", "bodytext", "postbody", "creatorbody", "creatorbodycopy", "sourcebody", "content", "copy",
  "example", "exampletext", "openertext", "onscreentitle", "literalshape", "transcript", "caption", "verbatim", "model", "modelname", "prompt",
  "completion", "llm", "apikey", "accesstoken", "password", "secret", "winner", "ranking", "rank", "score", "scores",
]);

function keyName(value: string): string {
  return value.replace(/[_-]/g, "").toLowerCase();
}

function assertNoForbiddenKeys(value: unknown, field: string, seen = new WeakSet<object>()): void {
  if (value === null || typeof value !== "object") return;
  if (seen.has(value)) fail(`${field} contains a cyclic value`);
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenKeys(item, `${field}[${index + 1}]`, seen));
    return;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(keyName(key))) fail(`${field}.${key} is forbidden; the hook ledger stores mechanism metadata, not copied wording or model fields`);
    assertNoForbiddenKeys(nested, `${field}.${key}`, seen);
  }
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], field: string): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) if (!allowedSet.has(key)) fail(`${field}.${key} is unsupported`);
}

function sourceRef(value: unknown, field: string): HookTemplateSourceRef {
  const row = object(value, field);
  exactKeys(row, ["sourceId", "location", "kind", "url", "evidenceStatus", "caveats"], field);
  const url = optionalText(row.url, `${field}.url`);
  return {
    sourceId: text(row.sourceId, `${field}.sourceId`),
    location: text(row.location, `${field}.location`),
    kind: enumValue(row.kind, `${field}.kind`, SOURCE_KINDS),
    ...(url === undefined ? {} : { url }),
    evidenceStatus: enumValue(row.evidenceStatus, `${field}.evidenceStatus`, EVIDENCE_STATUSES),
    caveats: array(row.caveats, `${field}.caveats`)
      .map((item, index) => text(item, `${field}.caveats[${index + 1}]`))
      .filter((value, index, values) => values.indexOf(value) === index)
      .sort(compare),
  };
}

function record(value: unknown, field: string): HookTemplateRecord {
  const row = object(value, field);
  exactKeys(row, [
    "id", "name", "mechanism", "platforms", "niches", "formats", "slots", "sourceRefs", "review", "originality",
    "evidenceStatus", "adaptationNote", "generatesCopy", "creatorBodyCopyAllowed",
  ], field);
  const platforms = strings(row.platforms, `${field}.platforms`).map((platform, index) => {
    if (!(PLATFORMS as readonly string[]).includes(platform)) fail(`${field}.platforms[${index + 1}] is not a supported platform`);
    return platform as Platform;
  });
  const sourceRefs = array(row.sourceRefs, `${field}.sourceRefs`).map((ref, index) => sourceRef(ref, `${field}.sourceRefs[${index + 1}]`));
  if (sourceRefs.length === 0) fail(`${field}.sourceRefs must not be empty`);
  if (row.generatesCopy !== false) fail(`${field}.generatesCopy must be false`);
  if (row.creatorBodyCopyAllowed !== false) fail(`${field}.creatorBodyCopyAllowed must be false`);
  return {
    id: text(row.id, `${field}.id`),
    name: text(row.name, `${field}.name`),
    mechanism: text(row.mechanism, `${field}.mechanism`),
    platforms,
    niches: strings(row.niches, `${field}.niches`),
    formats: strings(row.formats, `${field}.formats`),
    slots: strings(row.slots, `${field}.slots`),
    sourceRefs: [...sourceRefs].sort((left, right) => compare(`${left.sourceId}\u0000${left.location}`, `${right.sourceId}\u0000${right.location}`)),
    review: enumValue(row.review, `${field}.review`, REVIEW_STATES),
    originality: enumValue(row.originality, `${field}.originality`, REVIEW_STATES),
    evidenceStatus: enumValue(row.evidenceStatus, `${field}.evidenceStatus`, RECORD_EVIDENCE_STATUSES),
    adaptationNote: text(row.adaptationNote, `${field}.adaptationNote`),
    generatesCopy: false,
    creatorBodyCopyAllowed: false,
  };
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    if (Array.isArray(value)) value.forEach(freeze);
    else Object.values(value as Record<string, unknown>).forEach(freeze);
  }
  return value;
}

export function readHookTemplateLedger(jsonl: string, filter: HookTemplateFilter = {}): HookTemplateLedgerView {
  if (typeof jsonl !== "string") fail("hook template ledger input must be JSONL text");
  if (filter.platform !== undefined && !(PLATFORMS as readonly string[]).includes(filter.platform)) fail("filter.platform is unsupported");
  const niche = filter.niche === undefined ? undefined : text(filter.niche, "filter.niche");
  const format = filter.format === undefined ? undefined : text(filter.format, "filter.format");
  const rows: HookTemplateRecord[] = [];
  const ids = new Set<string>();
  for (const [index, line] of jsonl.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(line) as unknown; }
    catch (error) { fail(`jsonl line ${index + 1} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`); }
    assertNoForbiddenKeys(parsed, `jsonl line ${index + 1}`);
    const row = record(parsed, `jsonl line ${index + 1}`);
    if (ids.has(row.id)) fail(`duplicate hook template id: ${row.id}`);
    ids.add(row.id);
    if (!filter.includeUnreviewed && (row.review !== "passed" || row.originality !== "passed")) continue;
    if (filter.platform !== undefined && !row.platforms.includes(filter.platform)) continue;
    if (niche !== undefined && !row.niches.includes(niche)) continue;
    if (format !== undefined && !row.formats.includes(format)) continue;
    rows.push(row);
  }
  rows.sort((left, right) => compare(left.id, right.id));
  const reviewed = rows.filter((row) => row.review === "passed" && row.originality === "passed").length;
  const measured = rows.filter((row) => row.evidenceStatus === "supported" && row.sourceRefs.some((ref) => ref.evidenceStatus === "measured")).length;
  return freeze({
    kind: "hook_template_ledger",
    version: HOOK_TEMPLATE_LEDGER_VERSION,
    rows,
    summary: { total: rows.length, reviewed, unreviewed: rows.length - reviewed, measured },
    bodyIncluded: false,
    winnerClaimsAllowed: false,
    sideEffects: "none",
    generatesCopy: false,
    creatorBodyCopyAllowed: false,
  });
}

/** Adapt only the metadata that Grow already accepts; never carry wording or source bodies. */
export function toGrowHookTemplate(recordValue: HookTemplateRecord): {
  readonly ref: string;
  readonly slotRefs: string[];
  readonly adaptationNote: string;
} {
  const record = recordValue;
  return { ref: record.id, slotRefs: [...record.slots], adaptationNote: record.adaptationNote };
}
