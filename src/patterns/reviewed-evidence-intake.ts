/**
 * A small, pure intake boundary for reviewed blueprint account/source/baseline facts.
 *
 * This module deliberately does not collect, calculate, rank, merge, or select anything. It
 * accepts facts that a caller already reviewed, keeps incomplete facts visible as blockers, and
 * projects an explicit allow-list so creator bodies and model/ranking fields cannot travel into
 * the report.
 */

export const REVIEWED_EVIDENCE_INTAKE_VERSION = "reviewed-evidence-intake-v1" as const;

export type ReviewedEvidencePool = "niche" | "broad" | "format";
export type ReviewedEvidenceDisposition = "pending" | "reviewed" | "blocked" | "unmapped";
export type ReviewedEvidenceRowStatus = "ready" | "blocked" | "unmapped";
export type IntakeText = string | "unknown" | null;
export type IntakeNumber = number | "unknown" | null;

export interface ReviewedEvidenceIntakeInput {
  readonly accountMetadataRows: readonly unknown[];
  readonly sourceEvidenceRows: readonly unknown[];
  readonly baselineSamples: readonly unknown[];
}

export interface ReviewedEvidenceAudienceSnapshot {
  readonly size: IntakeNumber;
  readonly countType: IntakeText;
  readonly provenance: IntakeText;
  readonly asOf: IntakeText;
  readonly collectedAt: IntakeText;
}

export interface ReviewedEvidencePoolMembership {
  readonly pool: ReviewedEvidencePool;
  readonly reason: string;
}

export interface ReviewedEvidenceReadiness {
  readonly status: ReviewedEvidenceRowStatus;
  readonly blockers: string[];
}

export interface ReviewedAccountIntakeRow {
  readonly kind: "reviewed_account_intake_row";
  readonly version: typeof REVIEWED_EVIDENCE_INTAKE_VERSION;
  readonly id: string;
  readonly currentAccountKey: IntakeText;
  readonly platform: IntakeText;
  readonly handle: IntakeText;
  readonly creator: IntakeText;
  readonly stableAccountId: IntakeText;
  readonly stableAccountIdStatus: IntakeText;
  readonly topics: string[] | "unknown" | null;
  readonly focus: string[] | "unknown" | null;
  readonly nicheLabel: IntakeText;
  readonly researchPoolMembership: ReviewedEvidencePoolMembership[] | "unknown" | null;
  readonly popularityScope: IntakeText;
  readonly sampleScope: IntakeText;
  readonly baselineScope: IntakeText;
  readonly baselineSource: IntakeText;
  readonly medium: IntakeText;
  readonly format: IntakeText;
  readonly audienceSnapshot: ReviewedEvidenceAudienceSnapshot | "unknown" | null;
  readonly evidenceLinks: string[] | "unknown" | null;
  readonly evidenceRefs: string[] | "unknown" | null;
  readonly caveats: string[] | "unknown" | null;
  readonly reviewer: IntakeText;
  readonly reviewedAt: IntakeText;
  readonly disposition: ReviewedEvidenceDisposition | null;
  readonly dispositionReason: IntakeText;
  readonly readiness: ReviewedEvidenceReadiness;
  readonly bodyIncluded: false;
}

export interface ReviewedEvidenceLineageRef {
  readonly recordType: string;
  readonly id: string;
  readonly relation: string;
}

export interface ReviewedEvidenceMetricSnapshot {
  readonly metric: IntakeText;
  readonly value: IntakeNumber;
  readonly unit: IntakeText;
  readonly numerator: IntakeNumber;
  readonly denominator: IntakeNumber;
  readonly window: IntakeText;
  readonly scope: IntakeText;
  readonly observedAt: IntakeText;
}

export interface ReviewedSourceEvidenceIntakeRow {
  readonly kind: "reviewed_source_evidence_intake_row";
  readonly version: typeof REVIEWED_EVIDENCE_INTAKE_VERSION;
  readonly id: IntakeText;
  readonly sourceId: IntakeText;
  readonly postId: IntakeText;
  readonly accountId: IntakeText;
  readonly platform: IntakeText;
  readonly medium: IntakeText;
  readonly format: IntakeText;
  readonly pool: ReviewedEvidencePool | null;
  readonly membershipReason: IntakeText;
  readonly audienceSizeSnapshot: ReviewedEvidenceAudienceSnapshot | "unknown" | null;
  readonly metricSnapshot: ReviewedEvidenceMetricSnapshot | "unknown" | null;
  readonly comparisonClaimed: boolean | null;
  readonly popularityScope: IntakeText;
  readonly sampleScope: IntakeText;
  readonly baselineScope: IntakeText;
  readonly baselineSource: IntakeText;
  readonly evidenceLinks: string[] | "unknown" | null;
  readonly evidenceRefs: string[] | "unknown" | null;
  readonly bodyComplete: boolean | "unknown" | null;
  readonly caveats: string[] | "unknown" | null;
  readonly provenance: IntakeText;
  readonly observedAt: IntakeText;
  readonly collectedAt: IntakeText;
  readonly reviewStatus: IntakeText;
  readonly status: IntakeText;
  readonly lineage: ReviewedEvidenceLineageRef[] | "unknown" | null;
  readonly readiness: ReviewedEvidenceReadiness;
  readonly bodyIncluded: false;
}

export interface ReviewedBaselineWindow {
  readonly start: IntakeText;
  readonly end: IntakeText;
}

export interface ReviewedBaselineIntakeRow {
  readonly kind: "reviewed_baseline_intake_row";
  readonly version: typeof REVIEWED_EVIDENCE_INTAKE_VERSION;
  readonly id: IntakeText;
  readonly accountId: IntakeText;
  readonly platform: IntakeText;
  readonly source: IntakeText;
  readonly settledSampleDate: IntakeText;
  readonly window: ReviewedBaselineWindow | IntakeText;
  readonly numerator: IntakeNumber;
  readonly denominator: IntakeNumber;
  readonly metric: IntakeText;
  readonly sampleSize: number | null;
  readonly unavailableReason: IntakeText;
  readonly evidenceLinks: string[] | "unknown" | null;
  readonly evidenceRefs: string[] | "unknown" | null;
  readonly caveats: string[] | "unknown" | null;
  readonly reviewer: IntakeText;
  readonly reviewedAt: IntakeText;
  readonly reviewStatus: IntakeText;
  readonly readiness: ReviewedEvidenceReadiness;
  readonly bodyIncluded: false;
}

export interface ReviewedEvidenceIntakeCount {
  readonly total: number;
  readonly ready: number;
  readonly blocked: number;
  readonly unmapped: number;
  readonly blockerCount: number;
}

export interface ReviewedEvidenceIntakeReport {
  readonly kind: "reviewed_evidence_intake";
  readonly version: typeof REVIEWED_EVIDENCE_INTAKE_VERSION;
  readonly rows: {
    readonly accounts: ReviewedAccountIntakeRow[];
    readonly evidence: ReviewedSourceEvidenceIntakeRow[];
    readonly baselines: ReviewedBaselineIntakeRow[];
  };
  readonly summary: {
    readonly accounts: ReviewedEvidenceIntakeCount;
    readonly evidence: ReviewedEvidenceIntakeCount;
    readonly baselines: ReviewedEvidenceIntakeCount;
    readonly total: ReviewedEvidenceIntakeCount;
    readonly blockerCounts: Readonly<Record<string, number>>;
  };
  readonly readiness: ReviewedEvidenceIntakeCount & { readonly status: "ready" | "blocked" };
  readonly bodyIncluded: false;
  readonly sideEffects: "none";
}

export class ReviewedEvidenceIntakeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewedEvidenceIntakeValidationError";
  }
}

type LooseRecord = Record<string, unknown>;
type NormalizedAccount = Omit<ReviewedAccountIntakeRow, "readiness" | "kind" | "version" | "bodyIncluded" | "id">;
type NormalizedEvidence = Omit<ReviewedSourceEvidenceIntakeRow, "readiness" | "kind" | "version" | "bodyIncluded">;
type NormalizedBaseline = Omit<ReviewedBaselineIntakeRow, "readiness" | "kind" | "version" | "bodyIncluded">;

const POOLS = new Set<ReviewedEvidencePool>(["niche", "broad", "format"]);
const DISPOSITIONS = new Set<ReviewedEvidenceDisposition>(["pending", "reviewed", "blocked", "unmapped"]);
const UNSUPPORTED_KEYS = new Set([
  "body", "bodytext", "postbody", "posttext", "creatorbody", "rawbody", "transcript", "transcripttext",
  "caption", "content", "text", "title", "onscreentext", "opener", "hook", "model", "modelname",
  "modelversion", "prompt", "completion", "generatedby", "llm", "winner", "winners", "ranking", "rank",
  "score", "scores", "selectedwinner",
]);

function fail(message: string): never {
  throw new ReviewedEvidenceIntakeValidationError(message);
}

function isRecord(value: unknown): value is LooseRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown, path: string): LooseRecord {
  if (!isRecord(value)) fail(`${path} must be an object`);
  return value;
}

function present(value: LooseRecord, keys: readonly string[]): unknown {
  for (const key of keys) if (Object.prototype.hasOwnProperty.call(value, key) && value[key] !== undefined) return value[key];
  return undefined;
}

function keyName(key: string): string {
  return key.replace(/[_-]/g, "").toLowerCase();
}

function rejectUnsupported(value: unknown, path: string, seen = new WeakSet<object>()): void {
  if (typeof value !== "object" || value === null) return;
  if (seen.has(value)) fail(`${path} contains a cyclic envelope`);
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectUnsupported(item, `${path}[${index}]`, seen));
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (UNSUPPORTED_KEYS.has(keyName(key))) fail(`${path}.${key} is unsupported; body, model, ranking, and winner fields are not accepted`);
    rejectUnsupported(nested, `${path}.${key}`, seen);
  }
}

function text(value: unknown, path: string): IntakeText {
  if (value === undefined || value === null) return value === undefined ? null : null;
  if (value === "unknown") return "unknown";
  if (typeof value !== "string") fail(`${path} must be a string, null, or unknown`);
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function requiredText(value: unknown, path: string): string | null {
  const normalized = text(value, path);
  return normalized === "unknown" ? null : normalized;
}

function numberValue(value: unknown, path: string): IntakeNumber {
  if (value === undefined || value === null) return value === undefined ? null : null;
  if (value === "unknown") return "unknown";
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) fail(`${path} must be a non-negative finite number, null, or unknown`);
  return value;
}

function sampleSize(value: unknown, path: string): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) fail(`${path} must be a positive integer or null`);
  return value;
}

function booleanValue(value: unknown, path: string): boolean | "unknown" | null {
  if (value === undefined || value === null) return null;
  if (value === "unknown") return "unknown";
  if (typeof value !== "boolean") fail(`${path} must be boolean, null, or unknown`);
  return value;
}

function stringList(value: unknown, path: string): string[] | "unknown" | null {
  if (value === undefined || value === null) return value === undefined ? null : null;
  if (value === "unknown") return "unknown";
  if (!Array.isArray(value)) fail(`${path} must be an array, null, or unknown`);
  const values = value.map((item, index) => {
    if (typeof item !== "string") fail(`${path}[${index}] must be a string`);
    const normalized = item.trim();
    if (!normalized) fail(`${path}[${index}] must be non-empty`);
    return normalized;
  });
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function pool(value: unknown, path: string): ReviewedEvidencePool | null {
  const normalized = text(value, path);
  if (normalized === null || normalized === "unknown") return null;
  const lower = normalized.toLowerCase();
  if (!POOLS.has(lower as ReviewedEvidencePool)) fail(`${path} must be niche, broad, or format`);
  return lower as ReviewedEvidencePool;
}

function disposition(value: unknown, path: string): ReviewedEvidenceDisposition | null {
  const normalized = text(value, path);
  if (normalized === null || normalized === "unknown") return null;
  if (!DISPOSITIONS.has(normalized as ReviewedEvidenceDisposition)) fail(`${path} must be pending, reviewed, blocked, or unmapped`);
  return normalized as ReviewedEvidenceDisposition;
}

function audience(value: unknown, path: string): ReviewedEvidenceAudienceSnapshot | "unknown" | null {
  if (value === undefined || value === null) return value === undefined ? null : null;
  if (value === "unknown") return "unknown";
  const raw = record(value, path);
  return {
    size: numberValue(present(raw, ["size", "value", "count"]), `${path}.size`),
    countType: text(present(raw, ["countType", "count_type", "type"]), `${path}.countType`),
    provenance: text(present(raw, ["provenance", "evidenceSource", "evidence_source", "source"]), `${path}.provenance`),
    asOf: text(present(raw, ["asOf", "as_of", "observedAt", "observed_at"]), `${path}.asOf`),
    collectedAt: text(present(raw, ["collectedAt", "collected_at"]), `${path}.collectedAt`),
  };
}

function memberships(value: unknown, path: string): ReviewedEvidencePoolMembership[] | "unknown" | null {
  if (value === undefined || value === null) return value === undefined ? null : null;
  if (value === "unknown") return "unknown";
  if (!Array.isArray(value)) fail(`${path} must be an array, null, or unknown`);
  const rows = value.map((item, index) => {
    const raw = record(item, `${path}[${index}]`);
    const memberPool = pool(present(raw, ["pool"]), `${path}[${index}].pool`);
    const reason = requiredText(present(raw, ["reason", "membershipReason", "membership_reason"]), `${path}[${index}].reason`);
    if (memberPool === null || reason === null) fail(`${path}[${index}] requires an explicit pool and reason`);
    return { pool: memberPool, reason };
  });
  const seen = new Set<ReviewedEvidencePool>();
  for (const row of rows) {
    if (seen.has(row.pool)) fail(`${path} contains duplicate pool ${row.pool}`);
    seen.add(row.pool);
  }
  return rows.sort((left, right) => left.pool.localeCompare(right.pool) || left.reason.localeCompare(right.reason));
}

function lineage(value: unknown, path: string): ReviewedEvidenceLineageRef[] | "unknown" | null {
  if (value === undefined || value === null) return value === undefined ? null : null;
  if (value === "unknown") return "unknown";
  if (!Array.isArray(value)) fail(`${path} must be an array, null, or unknown`);
  const rows = value.flatMap((item, index): ReviewedEvidenceLineageRef[] => {
    const raw = record(item, `${path}[${index}]`);
    const recordType = requiredText(present(raw, ["recordType", "record_type"]), `${path}[${index}].recordType`);
    const id = requiredText(present(raw, ["id"]), `${path}[${index}].id`);
    const relation = requiredText(present(raw, ["relation"]), `${path}[${index}].relation`);
    return recordType !== null && id !== null && relation !== null ? [{ recordType, id, relation }] : [];
  });
  return rows.sort((left, right) => left.recordType.localeCompare(right.recordType) || left.id.localeCompare(right.id) || left.relation.localeCompare(right.relation));
}

function metric(value: unknown, path: string): ReviewedEvidenceMetricSnapshot | "unknown" | null {
  if (value === undefined || value === null) return value === undefined ? null : null;
  if (value === "unknown") return "unknown";
  const raw = record(value, path);
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

function normalizedAccount(value: unknown, index: number): NormalizedAccount {
  const raw = record(value, `accountMetadataRows[${index}]`);
  const membershipsValue = memberships(present(raw, ["researchPoolMembership", "research_pool_membership", "researchPoolMemberships", "poolMemberships"]), `accountMetadataRows[${index}].researchPoolMembership`);
  return {
    currentAccountKey: text(present(raw, ["currentAccountKey", "current_account_key", "accountKey"]), `accountMetadataRows[${index}].currentAccountKey`),
    platform: text(present(raw, ["platform"]), `accountMetadataRows[${index}].platform`),
    handle: text(present(raw, ["handle"]), `accountMetadataRows[${index}].handle`),
    creator: text(present(raw, ["creator"]), `accountMetadataRows[${index}].creator`),
    stableAccountId: text(present(raw, ["stableAccountId", "stable_account_id", "accountId"]), `accountMetadataRows[${index}].stableAccountId`),
    stableAccountIdStatus: text(present(raw, ["stableAccountIdStatus", "stable_account_id_status"]), `accountMetadataRows[${index}].stableAccountIdStatus`),
    topics: stringList(present(raw, ["topics"]), `accountMetadataRows[${index}].topics`),
    focus: stringList(present(raw, ["focus"]), `accountMetadataRows[${index}].focus`),
    nicheLabel: text(present(raw, ["nicheLabel", "niche_label"]), `accountMetadataRows[${index}].nicheLabel`),
    researchPoolMembership: membershipsValue,
    popularityScope: text(present(raw, ["popularityScope", "popularity_scope"]), `accountMetadataRows[${index}].popularityScope`),
    sampleScope: text(present(raw, ["sampleScope", "sample_scope"]), `accountMetadataRows[${index}].sampleScope`),
    baselineScope: text(present(raw, ["baselineScope", "baseline_scope"]), `accountMetadataRows[${index}].baselineScope`),
    baselineSource: text(present(raw, ["baselineSource", "baseline_source"]), `accountMetadataRows[${index}].baselineSource`),
    medium: text(present(raw, ["medium"]), `accountMetadataRows[${index}].medium`),
    format: text(present(raw, ["format"]), `accountMetadataRows[${index}].format`),
    audienceSnapshot: audience(present(raw, ["audienceSnapshot", "audience_snapshot"]), `accountMetadataRows[${index}].audienceSnapshot`),
    evidenceLinks: stringList(present(raw, ["evidenceLinks", "evidence_links", "evidenceRefs", "evidence_refs"]), `accountMetadataRows[${index}].evidenceLinks`),
    evidenceRefs: stringList(present(raw, ["evidenceRefs", "evidence_refs", "evidenceLinks", "evidence_links"]), `accountMetadataRows[${index}].evidenceRefs`),
    caveats: stringList(present(raw, ["caveats"]), `accountMetadataRows[${index}].caveats`),
    reviewer: text(present(raw, ["reviewer"]), `accountMetadataRows[${index}].reviewer`),
    reviewedAt: text(present(raw, ["reviewedAt", "reviewed_at"]), `accountMetadataRows[${index}].reviewedAt`),
    disposition: disposition(present(raw, ["disposition", "reviewStatus", "review_status"]), `accountMetadataRows[${index}].disposition`),
    dispositionReason: text(present(raw, ["dispositionReason", "disposition_reason", "unmappedReason", "unmapped_reason"]), `accountMetadataRows[${index}].dispositionReason`),
  };
}

function normalizedEvidence(value: unknown, index: number): NormalizedEvidence {
  const raw = record(value, `sourceEvidenceRows[${index}]`);
  const poolValue = pool(present(raw, ["pool"]), `sourceEvidenceRows[${index}].pool`);
  return {
    id: text(present(raw, ["id", "evidenceId", "evidence_id"]), `sourceEvidenceRows[${index}].id`),
    sourceId: text(present(raw, ["sourceId", "source_id"]), `sourceEvidenceRows[${index}].sourceId`),
    postId: text(present(raw, ["postId", "post_id"]), `sourceEvidenceRows[${index}].postId`),
    accountId: text(present(raw, ["accountId", "account_id"]), `sourceEvidenceRows[${index}].accountId`),
    platform: text(present(raw, ["platform"]), `sourceEvidenceRows[${index}].platform`),
    medium: text(present(raw, ["medium"]), `sourceEvidenceRows[${index}].medium`),
    format: text(present(raw, ["format"]), `sourceEvidenceRows[${index}].format`),
    pool: poolValue,
    membershipReason: text(present(raw, ["membershipReason", "membership_reason"]), `sourceEvidenceRows[${index}].membershipReason`),
    audienceSizeSnapshot: audience(present(raw, ["audienceSizeSnapshot", "audience_size_snapshot", "audienceSnapshot", "audience_snapshot"]), `sourceEvidenceRows[${index}].audienceSizeSnapshot`),
    metricSnapshot: metric(present(raw, ["metricSnapshot", "metric_snapshot"]), `sourceEvidenceRows[${index}].metricSnapshot`),
    comparisonClaimed: (() => {
      const value = present(raw, ["comparisonClaimed", "comparison_claimed"]);
      if (value === undefined || value === null) return null;
      if (typeof value !== "boolean") fail(`sourceEvidenceRows[${index}].comparisonClaimed must be boolean or null`);
      return value;
    })(),
    popularityScope: text(present(raw, ["popularityScope", "popularity_scope"]), `sourceEvidenceRows[${index}].popularityScope`),
    sampleScope: text(present(raw, ["sampleScope", "sample_scope"]), `sourceEvidenceRows[${index}].sampleScope`),
    baselineScope: text(present(raw, ["baselineScope", "baseline_scope"]), `sourceEvidenceRows[${index}].baselineScope`),
    baselineSource: text(present(raw, ["baselineSource", "baseline_source"]), `sourceEvidenceRows[${index}].baselineSource`),
    evidenceLinks: stringList(present(raw, ["evidenceLinks", "evidence_links", "evidenceRefs", "evidence_refs"]), `sourceEvidenceRows[${index}].evidenceLinks`),
    evidenceRefs: stringList(present(raw, ["evidenceRefs", "evidence_refs", "evidenceLinks", "evidence_links"]), `sourceEvidenceRows[${index}].evidenceRefs`),
    bodyComplete: booleanValue(present(raw, ["bodyComplete", "body_complete", "bodyIsComplete", "body_is_complete"]), `sourceEvidenceRows[${index}].bodyComplete`),
    caveats: stringList(present(raw, ["caveats"]), `sourceEvidenceRows[${index}].caveats`),
    provenance: text(present(raw, ["provenance"]), `sourceEvidenceRows[${index}].provenance`),
    observedAt: text(present(raw, ["observedAt", "observed_at"]), `sourceEvidenceRows[${index}].observedAt`),
    collectedAt: text(present(raw, ["collectedAt", "collected_at"]), `sourceEvidenceRows[${index}].collectedAt`),
    reviewStatus: text(present(raw, ["reviewStatus", "review_status"]), `sourceEvidenceRows[${index}].reviewStatus`),
    status: text(present(raw, ["status"]), `sourceEvidenceRows[${index}].status`),
    lineage: lineage(present(raw, ["lineage"]), `sourceEvidenceRows[${index}].lineage`),
  };
}

function baselineWindow(raw: LooseRecord, index: number): ReviewedBaselineWindow | IntakeText {
  const path = `baselineSamples[${index}].window`;
  const direct = present(raw, ["window"]);
  if (direct !== undefined && direct !== null && direct !== "unknown" && typeof direct !== "string") {
    const value = record(direct, path);
    return {
      start: text(present(value, ["start", "windowStart", "window_start"]), `${path}.start`),
      end: text(present(value, ["end", "windowEnd", "window_end"]), `${path}.end`),
    };
  }
  if (direct !== undefined) return text(direct, path);
  const start = text(present(raw, ["windowStart", "window_start"]), `${path}.start`);
  const end = text(present(raw, ["windowEnd", "window_end"]), `${path}.end`);
  return start === null && end === null ? null : { start, end };
}

function normalizedBaseline(value: unknown, index: number): NormalizedBaseline {
  const raw = record(value, `baselineSamples[${index}]`);
  return {
    id: text(present(raw, ["id", "baselineId", "baseline_id"]), `baselineSamples[${index}].id`),
    accountId: text(present(raw, ["accountId", "account_id", "stableAccountId", "stable_account_id", "currentAccountKey", "current_account_key"]), `baselineSamples[${index}].accountId`),
    platform: text(present(raw, ["platform"]), `baselineSamples[${index}].platform`),
    source: text(present(raw, ["source", "baselineSource", "baseline_source"]), `baselineSamples[${index}].source`),
    settledSampleDate: text(present(raw, ["settledSampleDate", "settled_sample_date", "sampleDate", "sample_date", "settledAt", "settled_at"]), `baselineSamples[${index}].settledSampleDate`),
    window: baselineWindow(raw, index),
    numerator: numberValue(present(raw, ["numerator"]), `baselineSamples[${index}].numerator`),
    denominator: numberValue(present(raw, ["denominator"]), `baselineSamples[${index}].denominator`),
    metric: text(present(raw, ["metric"]), `baselineSamples[${index}].metric`),
    sampleSize: sampleSize(present(raw, ["sampleSize", "sample_size"]), `baselineSamples[${index}].sampleSize`),
    unavailableReason: text(present(raw, ["unavailableReason", "unavailable_reason"]), `baselineSamples[${index}].unavailableReason`),
    evidenceLinks: stringList(present(raw, ["evidenceLinks", "evidence_links", "evidenceRefs", "evidence_refs"]), `baselineSamples[${index}].evidenceLinks`),
    evidenceRefs: stringList(present(raw, ["evidenceRefs", "evidence_refs", "evidenceLinks", "evidence_links"]), `baselineSamples[${index}].evidenceRefs`),
    caveats: stringList(present(raw, ["caveats"]), `baselineSamples[${index}].caveats`),
    reviewer: text(present(raw, ["reviewer"]), `baselineSamples[${index}].reviewer`),
    reviewedAt: text(present(raw, ["reviewedAt", "reviewed_at"]), `baselineSamples[${index}].reviewedAt`),
    reviewStatus: text(present(raw, ["reviewStatus", "review_status"]), `baselineSamples[${index}].reviewStatus`),
  };
}

function missing(value: unknown): boolean {
  return value === null || value === undefined || value === "unknown";
}

function add(blockers: string[], condition: boolean, value: string): void {
  if (condition && !blockers.includes(value)) blockers.push(value);
}

function missingList(value: string[] | "unknown" | null): boolean {
  return value === null || value === "unknown" || value.length === 0;
}

function accountBlockers(row: NormalizedAccount): string[] {
  const blockers: string[] = [];
  add(blockers, missing(row.currentAccountKey), "currentAccountKey");
  add(blockers, missing(row.platform), "platform");
  add(blockers, row.disposition === null, "disposition");
  add(blockers, row.disposition !== "unmapped" && missing(row.stableAccountId), "stableAccountId");
  add(blockers, row.disposition === "unmapped" && missing(row.dispositionReason), "unmappedReason");
  add(blockers, missingList(row.topics), "topics");
  add(blockers, missingList(row.focus), "focus");
  add(blockers, missing(row.nicheLabel), "nicheLabel");
  add(blockers, row.researchPoolMembership === null || row.researchPoolMembership === "unknown" || row.researchPoolMembership.length === 0, "researchPoolMembership");
  add(blockers, missing(row.popularityScope), "popularityScope");
  add(blockers, missing(row.sampleScope), "sampleScope");
  add(blockers, missing(row.baselineScope), "baselineScope");
  add(blockers, missing(row.baselineSource), "baselineSource");
  add(blockers, missing(row.medium), "medium");
  add(blockers, missing(row.format), "format");
  if (row.audienceSnapshot === null || row.audienceSnapshot === "unknown") add(blockers, true, "audienceSnapshot");
  else for (const field of ["size", "countType", "provenance", "asOf", "collectedAt"] as const) add(blockers, missing(row.audienceSnapshot[field]), `audienceSnapshot.${field}`);
  add(blockers, missingList(row.evidenceLinks), "evidenceLinks");
  add(blockers, row.caveats === null || row.caveats === "unknown", "caveats");
  add(blockers, missing(row.reviewer), "reviewer");
  add(blockers, missing(row.reviewedAt), "reviewedAt");
  add(blockers, row.disposition !== "reviewed" && row.disposition !== "unmapped", "reviewStatus");
  return blockers.sort((left, right) => left.localeCompare(right));
}

function evidenceBlockers(row: NormalizedEvidence): string[] {
  const blockers: string[] = [];
  add(blockers, missing(row.id), "id");
  add(blockers, missing(row.sourceId) && missing(row.postId), "sourceIdOrPostId");
  add(blockers, missing(row.accountId), "accountId");
  add(blockers, missing(row.platform), "platform");
  add(blockers, missing(row.medium), "medium");
  add(blockers, missing(row.format), "format");
  add(blockers, row.pool === null, "pool");
  add(blockers, missing(row.membershipReason), "membershipReason");
  if (row.audienceSizeSnapshot === null || row.audienceSizeSnapshot === "unknown") add(blockers, true, "audienceSizeSnapshot");
  else for (const field of ["size", "countType", "asOf", "collectedAt", "provenance"] as const) add(blockers, missing(row.audienceSizeSnapshot[field]), `audienceSizeSnapshot.${field}`);
  const metricRequired = row.comparisonClaimed !== false;
  if (metricRequired && (row.metricSnapshot === null || row.metricSnapshot === "unknown")) add(blockers, true, "metricSnapshot");
  else if (metricRequired && row.metricSnapshot !== null && row.metricSnapshot !== "unknown") {
    for (const field of ["metric", "value", "unit", "numerator", "denominator", "window", "scope", "observedAt"] as const) add(blockers, missing(row.metricSnapshot[field]), `metricSnapshot.${field}`);
  }
  add(blockers, missing(row.popularityScope), "popularityScope");
  add(blockers, missing(row.sampleScope), "sampleScope");
  add(blockers, missing(row.baselineScope), "baselineScope");
  add(blockers, missing(row.baselineSource), "baselineSource");
  add(blockers, missingList(row.evidenceLinks), "evidenceLinks");
  add(blockers, row.bodyComplete !== true, "bodyComplete");
  add(blockers, row.caveats === null || row.caveats === "unknown", "caveats");
  add(blockers, missing(row.provenance), "provenance");
  add(blockers, missing(row.observedAt), "observedAt");
  add(blockers, missing(row.collectedAt), "collectedAt");
  add(blockers, row.reviewStatus !== "reviewed", "reviewStatus");
  add(blockers, missing(row.status) || row.status === "blocked", "status");
  add(blockers, row.lineage === null || row.lineage === "unknown" || row.lineage.length === 0, "lineage");
  return blockers.sort((left, right) => left.localeCompare(right));
}

function baselineBlockers(row: NormalizedBaseline): string[] {
  const blockers: string[] = [];
  add(blockers, missing(row.id), "id");
  add(blockers, missing(row.accountId), "accountId");
  add(blockers, missing(row.platform), "platform");
  add(blockers, missing(row.source), "source");
  add(blockers, missing(row.settledSampleDate), "settledSampleDate");
  if (typeof row.window === "string") add(blockers, missing(row.window), "window");
  else if (row.window === null) add(blockers, true, "window");
  else {
    add(blockers, missing(row.window.start), "window.start");
    add(blockers, missing(row.window.end), "window.end");
  }
  const hasUnavailableReason = !missing(row.unavailableReason);
  if (!hasUnavailableReason) {
    add(blockers, missing(row.numerator), "numerator");
    add(blockers, missing(row.denominator), "denominator");
  }
  add(blockers, row.caveats === null || row.caveats === "unknown", "caveats");
  add(blockers, missing(row.reviewer), "reviewer");
  add(blockers, missing(row.reviewedAt), "reviewedAt");
  add(blockers, row.reviewStatus !== "reviewed", "reviewStatus");
  return blockers.sort((left, right) => left.localeCompare(right));
}

function statusFor(blockers: readonly string[], disposition?: ReviewedEvidenceDisposition | null): ReviewedEvidenceRowStatus {
  if (disposition === "unmapped") return "unmapped";
  return blockers.length === 0 && (disposition === undefined || disposition === "reviewed") ? "ready" : "blocked";
}

function readiness(blockers: string[], disposition?: ReviewedEvidenceDisposition | null): ReviewedEvidenceReadiness {
  return { status: statusFor(blockers, disposition), blockers: [...new Set(blockers)].sort((left, right) => left.localeCompare(right)) };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (typeof value !== "object" || value === null) return JSON.stringify(value);
  const raw = value as LooseRecord;
  return `{${Object.keys(raw).sort().map((key) => `${JSON.stringify(key)}:${stableJson(raw[key])}`).join(",")}}`;
}

function compare(left: unknown, right: unknown): number {
  return String(left ?? "").localeCompare(String(right ?? ""));
}

function accountOutput(row: NormalizedAccount, duplicateKeys: ReadonlySet<string>): ReviewedAccountIntakeRow {
  const blockers = accountBlockers(row);
  const identityKeys = new Set([row.currentAccountKey, row.stableAccountId]
    .filter((value): value is string => !missing(value)));
  if ([...identityKeys].some((key) => duplicateKeys.has(key))) blockers.push("duplicate account identity");
  const key = row.currentAccountKey ?? row.stableAccountId ?? "";
  return {
    kind: "reviewed_account_intake_row",
    version: REVIEWED_EVIDENCE_INTAKE_VERSION,
    id: `account:${key || "unknown"}`,
    ...row,
    readiness: readiness(blockers, row.disposition),
    bodyIncluded: false,
  };
}

function evidenceOutput(row: NormalizedEvidence): ReviewedSourceEvidenceIntakeRow {
  const links = row.evidenceLinks;
  const refs = row.evidenceRefs;
  return {
    kind: "reviewed_source_evidence_intake_row",
    version: REVIEWED_EVIDENCE_INTAKE_VERSION,
    ...row,
    evidenceLinks: links,
    evidenceRefs: refs,
    readiness: readiness(evidenceBlockers(row)),
    bodyIncluded: false,
  };
}

function baselineOutput(row: NormalizedBaseline): ReviewedBaselineIntakeRow {
  return {
    kind: "reviewed_baseline_intake_row",
    version: REVIEWED_EVIDENCE_INTAKE_VERSION,
    ...row,
    readiness: readiness(baselineBlockers(row)),
    bodyIncluded: false,
  };
}

function arrayFor(raw: LooseRecord, keys: readonly string[], label: string): unknown[] {
  const value = present(raw, keys);
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  value.forEach((item, index) => { if (!isRecord(item)) fail(`${label}[${index}] must be an object`); });
  return value;
}

function inputRows(value: unknown): ReviewedEvidenceIntakeInput {
  rejectUnsupported(value, "input");
  const raw = record(value, "input");
  return {
    accountMetadataRows: arrayFor(raw, ["accountMetadataRows", "accountRows", "accounts", "reviews"], "accountMetadataRows"),
    sourceEvidenceRows: arrayFor(raw, ["sourceEvidenceRows", "evidenceRows", "evidence"], "sourceEvidenceRows"),
    baselineSamples: arrayFor(raw, ["baselineSamples", "baselineRows", "baselines"], "baselineSamples"),
  };
}

function referenceIndex(accounts: readonly ReviewedAccountIntakeRow[]): Map<string, ReviewedAccountIntakeRow[]> {
  const index = new Map<string, ReviewedAccountIntakeRow[]>();
  for (const account of accounts) {
    for (const value of [account.stableAccountId, account.currentAccountKey]) {
      if (missing(value)) continue;
      const rows = index.get(value as string) ?? [];
      rows.push(account);
      index.set(value as string, rows);
    }
  }
  return index;
}

function withCrossReferenceBlockers(
  evidence: ReviewedSourceEvidenceIntakeRow[],
  baselines: ReviewedBaselineIntakeRow[],
  accounts: readonly ReviewedAccountIntakeRow[],
): { evidence: ReviewedSourceEvidenceIntakeRow[]; baselines: ReviewedBaselineIntakeRow[] } {
  const index = referenceIndex(accounts);
  const match = (accountId: IntakeText): ReviewedAccountIntakeRow | null => {
    if (missing(accountId)) return null;
    const rows = index.get(accountId as string) ?? [];
    return rows.length === 1 ? rows[0] as ReviewedAccountIntakeRow : null;
  };
  const nextEvidence = evidence.map((row) => {
    const blockers = [...row.readiness.blockers];
    const account = match(row.accountId);
    if (account === null) blockers.push("account reference is unmapped or ambiguous");
    else {
      if (account.readiness.status !== "ready") blockers.push("account metadata is not ready");
      if (!missing(account.platform) && account.platform !== row.platform) blockers.push("platform does not match account metadata");
      if (!missing(account.medium) && account.medium !== row.medium) blockers.push("medium does not match account metadata");
      if (!missing(account.format) && account.format !== row.format) blockers.push("format does not match account metadata");
      if (row.pool !== null && Array.isArray(account.researchPoolMembership) && !account.researchPoolMembership.some((membership) => membership.pool === row.pool)) blockers.push("pool is not an explicit account membership");
    }
    return { ...row, readiness: readiness(blockers) };
  });
  const nextBaselines = baselines.map((row) => {
    const blockers = [...row.readiness.blockers];
    const account = match(row.accountId);
    if (account === null) blockers.push("account reference is unmapped or ambiguous");
    else {
      if (account.readiness.status !== "ready") blockers.push("account metadata is not ready");
      if (!missing(account.platform) && account.platform !== row.platform) blockers.push("platform does not match account metadata");
    }
    return { ...row, readiness: readiness(blockers) };
  });
  return { evidence: nextEvidence, baselines: nextBaselines };
}

function countRows(rows: readonly { readiness: ReviewedEvidenceReadiness }[]): ReviewedEvidenceIntakeCount {
  const ready = rows.filter((row) => row.readiness.status === "ready").length;
  const blocked = rows.filter((row) => row.readiness.status === "blocked").length;
  const unmapped = rows.filter((row) => row.readiness.status === "unmapped").length;
  return {
    total: rows.length,
    ready,
    blocked,
    unmapped,
    blockerCount: rows.reduce((sum, row) => sum + row.readiness.blockers.length, 0),
  };
}

function blockerCounts(rows: readonly { readiness: ReviewedEvidenceReadiness }[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) for (const blocker of row.readiness.blockers) counts.set(blocker, (counts.get(blocker) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

/** Build the deterministic body-free intake report from explicit caller-supplied rows. */
export function buildReviewedEvidenceIntake(input: ReviewedEvidenceIntakeInput): ReviewedEvidenceIntakeReport {
  const rows = inputRows(input);
  const accountValues = rows.accountMetadataRows.map(normalizedAccount);
  const keyCounts = new Map<string, number>();
  for (const row of accountValues) {
    const rowKeys = new Set<string>();
    for (const key of [row.currentAccountKey, row.stableAccountId]) {
      if (missing(key)) continue;
      rowKeys.add(key as string);
    }
    for (const key of rowKeys) keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
  }
  const duplicateKeys = new Set([...keyCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key));
  const accounts = accountValues
    .map((row) => accountOutput(row, duplicateKeys))
    .sort((left, right) => compare(left.currentAccountKey, right.currentAccountKey) || compare(left.stableAccountId, right.stableAccountId) || stableJson(left).localeCompare(stableJson(right)));
  const evidence = rows.sourceEvidenceRows
    .map(normalizedEvidence)
    .map(evidenceOutput)
    .sort((left, right) => compare(left.id, right.id) || compare(left.sourceId, right.sourceId) || compare(left.postId, right.postId) || stableJson(left).localeCompare(stableJson(right)));
  const baselines = rows.baselineSamples
    .map(normalizedBaseline)
    .map(baselineOutput)
    .sort((left, right) => compare(left.id, right.id) || compare(left.accountId, right.accountId) || compare(left.settledSampleDate, right.settledSampleDate) || stableJson(left).localeCompare(stableJson(right)));
  const crossReferenced = withCrossReferenceBlockers(evidence, baselines, accounts);
  const allRows = [...accounts, ...crossReferenced.evidence, ...crossReferenced.baselines];
  const accountSummary = countRows(accounts);
  const evidenceSummary = countRows(crossReferenced.evidence);
  const baselineSummary = countRows(crossReferenced.baselines);
  const total = countRows(allRows);
  const emptyInput = allRows.length === 0;
  const intakeBlockerCounts = blockerCounts(allRows);
  if (emptyInput) intakeBlockerCounts["no reviewed evidence rows supplied"] = 1;
  const readiness = {
    status: !emptyInput && total.blocked === 0 && total.unmapped === 0 ? "ready" as const : "blocked" as const,
    ...total,
    blockerCount: total.blockerCount + (emptyInput ? 1 : 0),
  };
  return {
    kind: "reviewed_evidence_intake",
    version: REVIEWED_EVIDENCE_INTAKE_VERSION,
    rows: { accounts, evidence: crossReferenced.evidence, baselines: crossReferenced.baselines },
    summary: {
      accounts: accountSummary,
      evidence: evidenceSummary,
      baselines: baselineSummary,
      total,
      blockerCounts: intakeBlockerCounts,
    },
    readiness,
    bodyIncluded: false,
    sideEffects: "none",
  };
}

export const createReviewedEvidenceIntake = buildReviewedEvidenceIntake;
export const normalizeReviewedEvidenceIntake = buildReviewedEvidenceIntake;
