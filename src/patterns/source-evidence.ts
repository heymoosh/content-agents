// Normalization boundary for the source_post_evidence handoff.
//
// This module is deliberately extraction-only. It selects already-recorded metadata, normalizes
// its shape, and reports what is still missing. It never reads a body, derives a pool from a
// niche/name/rank, or turns a missing metric into a value.

export type EvidencePool = "niche" | "broad" | "format";
export type EvidenceUnknown = "unknown";
export type EvidenceText = string | EvidenceUnknown | null;
export type EvidenceNumber = number | EvidenceUnknown | null;
export type EvidenceList = string[] | EvidenceUnknown | null;

export interface EvidenceAudienceSizeSnapshot {
  size: EvidenceNumber;
  countType: EvidenceText;
  observedAt: EvidenceText;
  collectedAt: EvidenceText;
  evidenceSource: EvidenceText;
}

// The legacy metric shape is retained as `metric`. New handoff consumers should use
// `metricSnapshot`, which includes the value, unit, and metric observation date required by the
// record contract.
export interface EvidenceMetric {
  name: EvidenceText;
  numerator: EvidenceNumber;
  denominator: EvidenceNumber;
  window: EvidenceText;
  scope: EvidenceText;
}

export interface EvidenceMetricSnapshot {
  metric: EvidenceText;
  value: EvidenceNumber;
  unit: EvidenceText;
  numerator: EvidenceNumber;
  denominator: EvidenceNumber;
  window: EvidenceText;
  scope: EvidenceText;
  observedAt: EvidenceText;
}

export interface EvidenceLineageRef {
  recordType: string;
  id: string;
  relation: string;
}

export type EvidenceLineage = EvidenceLineageRef[] | EvidenceUnknown | null;

export interface SourceEvidenceReadiness {
  status: "ready" | "blocked";
  reason: string;
  blockingFields: string[];
}

export interface SourceEvidenceRow {
  // Explicit source_post_evidence handoff fields, in normalized camelCase form.
  id: EvidenceText;
  sourceId: EvidenceText;
  postId: EvidenceText;
  accountId: EvidenceText;
  platform: EvidenceText;
  medium: EvidenceText;
  format: EvidenceText;
  pool: EvidencePool | null;
  membershipReason: EvidenceText;
  audienceSizeSnapshot: EvidenceAudienceSizeSnapshot | EvidenceUnknown | null;
  metricSnapshot: EvidenceMetricSnapshot | EvidenceUnknown | null;
  popularityScope: EvidenceText;
  sampleScope: EvidenceText;
  baselineScope: EvidenceText;
  evidenceLinks: EvidenceList;
  baselineSource: EvidenceText;
  bodyComplete: boolean | EvidenceUnknown | null;
  caveats: EvidenceList;
  provenance: EvidenceText;
  observedAt: EvidenceText;
  collectedAt: EvidenceText;
  reviewStatus: EvidenceText;
  status: EvidenceText;
  lineage: EvidenceLineage;

  // Backward-compatible fields from the first pool-evidence scaffold. They remain selected only
  // from explicit inputs and never contain the creator body.
  handle: EvidenceText;
  creator: EvidenceText;
  url: EvidenceText;
  sourceRole: EvidenceText;
  listing: EvidenceText;
  window: EvidenceText;
  rank: number | null;
  evidenceLocation: EvidenceText;
  metric: EvidenceMetric;
  selectionRule: EvidenceText;
  readiness: SourceEvidenceReadiness;
}

export type SourcePostEvidenceRow = SourceEvidenceRow;

export interface SourceEvidenceInventory {
  rows: SourceEvidenceRow[];
  summary: { ready: number; blocked: number; pools: Record<EvidencePool, number> };
}

export type SourcePostEvidenceInventory = SourceEvidenceInventory;

const POOLS = new Set<EvidencePool>(["niche", "broad", "format"]);
type Loose = Record<string, unknown>;

const has = (value: Loose, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);

// `undefined` is an absent fixture property, not a permission to fall through to a guessed
// value. `null` and the literal `unknown` are preserved once selected.
function pick(value: Loose, keys: string[]): unknown {
  for (const key of keys) {
    if (has(value, key) && value[key] !== undefined) return value[key];
  }
  return undefined;
}

function pickFrom(values: Array<{ value: Loose; keys: string[] }>): unknown {
  for (const candidate of values) {
    const selected = pick(candidate.value, candidate.keys);
    if (selected !== undefined) return selected;
  }
  return undefined;
}

const text = (value: unknown): EvidenceText => {
  if (value === "unknown") return "unknown";
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
};

const numberOrUnknown = (value: unknown): EvidenceNumber => {
  if (value === "unknown") return "unknown";
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

function list(value: unknown): EvidenceList {
  if (value === "unknown") return "unknown";
  if (!Array.isArray(value)) return null;
  return [...new Set(value.map(text).filter((item): item is string => typeof item === "string" && item !== "unknown"))].sort();
}

const record = (value: unknown): Loose =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as Loose : {};

function normalizeAudience(value: unknown): EvidenceAudienceSizeSnapshot | EvidenceUnknown | null {
  if (value === "unknown") return "unknown";
  if (value === undefined || value === null) return null;
  const raw = record(value);
  return {
    size: numberOrUnknown(pick(raw, ["size", "value", "count"])),
    countType: text(pick(raw, ["count_type", "countType", "type"])),
    observedAt: text(pick(raw, ["observed_at", "observedAt", "as_of", "asOf"])),
    collectedAt: text(pick(raw, ["collected_at", "collectedAt"])),
    evidenceSource: text(pick(raw, ["evidence_source", "evidenceSource", "provenance", "source"])),
  };
}

function normalizeMetric(value: unknown): EvidenceMetricSnapshot | EvidenceUnknown | null {
  if (value === "unknown") return "unknown";
  if (value === undefined || value === null) return null;
  const raw = record(value);
  return {
    metric: text(pick(raw, ["metric", "name"])),
    value: numberOrUnknown(pick(raw, ["value"])),
    unit: text(pick(raw, ["unit"])),
    numerator: numberOrUnknown(pick(raw, ["numerator"])),
    denominator: numberOrUnknown(pick(raw, ["denominator"])),
    window: text(pick(raw, ["window"])),
    scope: text(pick(raw, ["scope"])),
    observedAt: text(pick(raw, ["observed_at", "observedAt"])),
  };
}

function legacyMetric(value: EvidenceMetricSnapshot | EvidenceUnknown | null): EvidenceMetric {
  if (value === "unknown" || value === null) {
    return { name: null, numerator: null, denominator: null, window: null, scope: null };
  }
  return {
    name: value.metric,
    numerator: value.numerator,
    denominator: value.denominator,
    window: value.window,
    scope: value.scope,
  };
}

function normalizeLineage(value: unknown): EvidenceLineage {
  if (value === "unknown") return "unknown";
  if (!Array.isArray(value)) return null;
  const refs = value.flatMap((item): EvidenceLineageRef[] => {
    const raw = record(item);
    const recordType = text(raw.record_type ?? raw.recordType);
    const id = text(raw.id);
    const relation = text(raw.relation);
    if (!recordType || recordType === "unknown" || !id || id === "unknown" || !relation || relation === "unknown") return [];
    return [{ recordType, id, relation }];
  });
  return refs
    .sort((a, b) => a.recordType.localeCompare(b.recordType) || a.id.localeCompare(b.id) || a.relation.localeCompare(b.relation));
}

interface PoolMembership {
  pool: EvidencePool;
  reason: EvidenceText;
}

function memberships(post: Loose, analysis: Loose): PoolMembership[] {
  const raw = pickFrom([
    { value: analysis, keys: ["pool_memberships", "poolMemberships"] },
    { value: post, keys: ["pool_memberships", "poolMemberships"] },
  ]);
  const items: unknown[] = Array.isArray(raw) ? raw : [];
  const directPool = pickFrom([
    { value: analysis, keys: ["pool"] },
    { value: post, keys: ["pool"] },
  ]);
  if (items.length === 0 && directPool !== undefined) {
    items.push({
      pool: directPool,
      reason: pickFrom([
        { value: analysis, keys: ["membership_reason", "membershipReason"] },
        { value: post, keys: ["membership_reason", "membershipReason"] },
      ]),
    });
  }

  const result = items.flatMap((item): PoolMembership[] => {
    const rawItem = record(item);
    const candidate = text(rawItem.pool);
    if (!candidate || candidate === "unknown" || !POOLS.has(candidate as EvidencePool)) return [];
    return [{
      pool: candidate as EvidencePool,
      reason: text(rawItem.reason ?? rawItem.membership_reason ?? rawItem.membershipReason),
    }];
  });
  const unique = new Map<string, PoolMembership>();
  for (const membership of result) unique.set(`${membership.pool}\u0000${membership.reason ?? "null"}`, membership);
  return [...unique.values()].sort((a, b) => a.pool.localeCompare(b.pool) || (a.reason ?? "").localeCompare(b.reason ?? ""));
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (typeof value !== "object" || value === null) return JSON.stringify(value);
  const raw = value as Record<string, unknown>;
  return `{${Object.keys(raw).sort().map((key) => `${JSON.stringify(key)}:${stableJson(raw[key])}`).join(",")}}`;
}

function analysisKeys(analysis: Loose): string[] {
  return [
    pick(analysis, ["source_id", "sourceId"]),
    pick(analysis, ["post_id", "postId"]),
    // The first scaffold accepted `analysis.id` as the join key. Retain that compatibility path;
    // it is still an explicit identifier, never a value derived from body text or ranking.
    pick(analysis, ["id"]),
  ].filter((value): value is string => typeof value === "string" && value.trim() !== "");
}

function baseRow(post: Loose, analysis: Loose, membership: PoolMembership | null): SourceEvidenceRow {
  const sample = record(pick(post, ["sample"]));
  const media = record(pick(post, ["media"]));
  const metricValue = pickFrom([
    { value: analysis, keys: ["metric_snapshot", "metricSnapshot", "metric"] },
    { value: post, keys: ["metric_snapshot", "metricSnapshot", "metric"] },
  ]);
  const metricSnapshot = normalizeMetric(metricValue);
  const sourceId = text(pickFrom([
    { value: analysis, keys: ["source_id", "sourceId"] },
    { value: post, keys: ["source_id", "sourceId"] },
    // The legacy corpus's `id` is the post locator. Keep the old sourceId view while also exposing
    // postId; the readiness gate still accepts either explicit locator.
    { value: post, keys: ["id"] },
  ]));
  const postId = text(pickFrom([
    { value: analysis, keys: ["post_id", "postId"] },
    { value: post, keys: ["post_id", "postId", "id"] },
  ]));
  const bodyCompleteValue = pickFrom([
    { value: post, keys: ["body_is_complete", "bodyIsComplete"] },
    { value: media, keys: ["body_is_complete", "bodyIsComplete"] },
    { value: analysis, keys: ["body_is_complete", "bodyIsComplete"] },
  ]);
  const bodyComplete = bodyCompleteValue === "unknown"
    ? "unknown"
    : typeof bodyCompleteValue === "boolean" ? bodyCompleteValue : null;

  return {
    id: text(pickFrom([
      { value: analysis, keys: ["id", "evidence_id", "evidenceId"] },
      { value: post, keys: ["evidence_id", "evidenceId", "record_id", "recordId"] },
    ])),
    sourceId,
    postId,
    accountId: text(pickFrom([
      { value: analysis, keys: ["account_id", "accountId"] },
      { value: post, keys: ["account_id", "accountId"] },
    ])),
    platform: text(pickFrom([
      { value: analysis, keys: ["platform"] },
      { value: post, keys: ["platform"] },
    ])),
    medium: text(pickFrom([
      { value: analysis, keys: ["medium"] },
      { value: post, keys: ["medium"] },
      { value: media, keys: ["medium"] },
    ])),
    format: text(pickFrom([
      { value: analysis, keys: ["format"] },
      { value: post, keys: ["format"] },
      { value: media, keys: ["format"] },
    ])),
    pool: membership?.pool ?? null,
    membershipReason: membership?.reason ?? null,
    audienceSizeSnapshot: normalizeAudience(pickFrom([
      { value: analysis, keys: ["audience_size_snapshot", "audienceSizeSnapshot", "audience_snapshot", "audienceSnapshot"] },
      { value: post, keys: ["audience_size_snapshot", "audienceSizeSnapshot", "audience_snapshot", "audienceSnapshot"] },
    ])),
    metricSnapshot,
    popularityScope: text(pickFrom([
      { value: analysis, keys: ["popularity_scope", "popularityScope"] },
      { value: post, keys: ["popularity_scope", "popularityScope"] },
    ])),
    sampleScope: text(pickFrom([
      { value: analysis, keys: ["sample_scope", "sampleScope"] },
      { value: post, keys: ["sample_scope", "sampleScope"] },
    ])),
    baselineScope: text(pickFrom([
      { value: analysis, keys: ["baseline_scope", "baselineScope"] },
      { value: post, keys: ["baseline_scope", "baselineScope"] },
    ])),
    evidenceLinks: list(pickFrom([
      { value: analysis, keys: ["evidence_links", "evidenceLinks"] },
      { value: post, keys: ["evidence_links", "evidenceLinks"] },
    ])),
    baselineSource: text(pickFrom([
      { value: analysis, keys: ["baseline_source", "baselineSource"] },
      { value: post, keys: ["baseline_source", "baselineSource"] },
    ])),
    bodyComplete,
    caveats: list(pickFrom([
      { value: analysis, keys: ["caveats"] },
      { value: post, keys: ["caveats"] },
    ])),
    provenance: text(pickFrom([
      { value: analysis, keys: ["provenance"] },
      { value: post, keys: ["provenance"] },
    ])),
    observedAt: text(pickFrom([
      { value: post, keys: ["observed_at", "observedAt", "posted_at", "postedAt"] },
      { value: analysis, keys: ["observed_at", "observedAt"] },
    ])),
    collectedAt: text(pickFrom([
      { value: post, keys: ["collected_at", "collectedAt"] },
      { value: analysis, keys: ["collected_at", "collectedAt"] },
    ])),
    reviewStatus: text(pickFrom([
      { value: analysis, keys: ["review_status", "reviewStatus"] },
      { value: post, keys: ["review_status", "reviewStatus"] },
    ])),
    status: text(pickFrom([
      { value: analysis, keys: ["status"] },
      { value: post, keys: ["status"] },
    ])),
    lineage: normalizeLineage(pickFrom([
      { value: analysis, keys: ["lineage"] },
      { value: post, keys: ["lineage"] },
    ])),

    handle: text(pickFrom([
      { value: post, keys: ["handle"] },
      { value: analysis, keys: ["handle"] },
    ])),
    creator: text(pickFrom([
      { value: post, keys: ["creator"] },
      { value: analysis, keys: ["creator"] },
    ])),
    url: text(pickFrom([
      { value: post, keys: ["url", "locator"] },
      { value: analysis, keys: ["url", "locator"] },
    ])),
    sourceRole: text(pick(sample, ["role"]) ?? pick(post, ["sample_role", "sampleRole"])),
    listing: text(pick(sample, ["listing"])),
    window: text(pick(sample, ["window"])),
    rank: numberOrUnknown(pick(sample, ["rank"])) === "unknown" ? null : numberOrUnknown(pick(sample, ["rank"])) as number | null,
    evidenceLocation: text(pickFrom([
      { value: analysis, keys: ["evidence_location", "evidenceLocation"] },
      { value: post, keys: ["evidence_location", "evidenceLocation"] },
    ])),
    metric: legacyMetric(metricSnapshot),
    selectionRule: text(pickFrom([
      { value: analysis, keys: ["selection_rule", "selectionRule"] },
      { value: post, keys: ["selection_rule", "selectionRule"] },
    ])),
    readiness: { status: "blocked", reason: "Blocked: source evidence fields are incomplete.", blockingFields: [] },
  };
}

function missing(value: unknown): boolean {
  return value === null || value === undefined || value === "unknown";
}

function readiness(row: SourceEvidenceRow): SourceEvidenceReadiness {
  const blockers: string[] = [];
  const add = (field: string) => { if (!blockers.includes(field)) blockers.push(field); };

  if (missing(row.id)) add("id");
  if (missing(row.sourceId) && missing(row.postId)) add("sourceIdOrPostId");
  if (missing(row.accountId)) add("accountId");
  if (missing(row.platform)) add("platform");
  if (missing(row.medium)) add("medium");
  if (missing(row.format)) add("format");
  if (row.pool === null) add("pool");
  else if (missing(row.membershipReason)) add("membershipReason");

  if (row.audienceSizeSnapshot === null || row.audienceSizeSnapshot === "unknown") {
    add("audienceSizeSnapshot");
  } else {
    for (const field of ["size", "countType", "observedAt", "collectedAt", "evidenceSource"] as const) {
      if (missing(row.audienceSizeSnapshot[field])) add(`audienceSizeSnapshot.${field}`);
    }
  }

  if (row.metricSnapshot === null || row.metricSnapshot === "unknown") {
    add("metricSnapshot");
  } else {
    for (const field of ["metric", "value", "unit", "numerator", "denominator", "window", "scope", "observedAt"] as const) {
      if (missing(row.metricSnapshot[field])) add(`metricSnapshot.${field}`);
    }
  }

  for (const [field, value] of [
    ["popularityScope", row.popularityScope],
    ["sampleScope", row.sampleScope],
    ["baselineScope", row.baselineScope],
    ["baselineSource", row.baselineSource],
    ["provenance", row.provenance],
    ["observedAt", row.observedAt],
    ["collectedAt", row.collectedAt],
  ] as const) {
    if (missing(value)) add(field);
  }

  if (row.evidenceLinks === null || row.evidenceLinks === "unknown" || row.evidenceLinks.length === 0) add("evidenceLinks");
  if (row.caveats === null || row.caveats === "unknown") add("caveats");
  if (row.bodyComplete !== true) add("bodyComplete");
  if (missing(row.reviewStatus)) add("reviewStatus");
  else if (row.reviewStatus !== "reviewed") add("reviewStatus");
  if (missing(row.status) || row.status === "blocked") add("status");
  if (row.lineage === null || row.lineage === "unknown" || row.lineage.length === 0) add("lineage");

  // These fields were part of the original public builder and are still required to keep its
  // exact-evidence/no-inference safety gate intact. They are not synthesized from body text,
  // rank, listing, or the new evidence links.
  const hasEvidenceLinks = Array.isArray(row.evidenceLinks) && row.evidenceLinks.length > 0;
  if (missing(row.evidenceLocation) && !hasEvidenceLinks) add("evidenceLocation");
  if (missing(row.selectionRule) && missing(row.sampleScope)) add("selectionRule");

  if (blockers.length === 0) return {
    status: "ready",
    reason: "Explicit source evidence fields are present.",
    blockingFields: [],
  };

  const bodyReason = row.bodyComplete === false ? " Body is incomplete; the source substance cannot be treated as complete evidence." : "";
  const reviewReason = row.reviewStatus !== null && row.reviewStatus !== "reviewed"
    ? ` Review status is ${row.reviewStatus}.`
    : "";
  return {
    status: "blocked",
    reason: `Blocked: missing or ineligible required evidence: ${blockers.join(", ")}.${bodyReason}${reviewReason}`,
    blockingFields: blockers,
  };
}

function compare(a: SourceEvidenceRow, b: SourceEvidenceRow): number {
  return (a.sourceId ?? "").localeCompare(b.sourceId ?? "")
    || (a.postId ?? "").localeCompare(b.postId ?? "")
    || (a.pool ?? "").localeCompare(b.pool ?? "")
    || (a.id ?? "").localeCompare(b.id ?? "")
    || (a.url ?? "").localeCompare(b.url ?? "");
}

export function buildSourceEvidenceRows(corpus: unknown[], analyses: unknown[]): SourceEvidenceRow[] {
  const posts = corpus.map(record);
  const analysisRecords = analyses.map(record).sort((a, b) => stableJson(a).localeCompare(stableJson(b)));
  const byKey = new Map<string, Loose>();
  for (const analysis of analysisRecords) {
    for (const key of analysisKeys(analysis)) if (!byKey.has(key)) byKey.set(key, analysis);
  }

  const rows = posts.flatMap((post) => {
    const keys = [
      pick(post, ["source_id", "sourceId"]),
      pick(post, ["post_id", "postId"]),
      pick(post, ["id"]),
    ].filter((value): value is string => typeof value === "string" && value.trim() !== "");
    const analysis = keys.map((key) => byKey.get(key)).find((value): value is Loose => value !== undefined) ?? {};
    const poolRows = memberships(post, analysis);
    const candidates: Array<PoolMembership | null> = poolRows.length > 0 ? poolRows : [null];
    return candidates.map((membership) => {
      const row = baseRow(post, analysis, membership);
      return { ...row, readiness: readiness(row) };
    });
  });
  return rows.sort(compare);
}

export function buildSourceEvidence(corpus: unknown[], analyses: unknown[]): SourceEvidenceInventory {
  const rows = buildSourceEvidenceRows(corpus, analyses);
  return {
    rows,
    summary: {
      ready: rows.filter((row) => row.readiness.status === "ready").length,
      blocked: rows.filter((row) => row.readiness.status === "blocked").length,
      pools: {
        niche: rows.filter((row) => row.pool === "niche").length,
        broad: rows.filter((row) => row.pool === "broad").length,
        format: rows.filter((row) => row.pool === "format").length,
      },
    },
  };
}

// New names make the handoff explicit without breaking callers of the original scaffolded
// builders.
export const buildSourcePostEvidenceRows = buildSourceEvidenceRows;
export const buildSourcePostEvidence = buildSourceEvidence;
