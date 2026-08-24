import { MEDIA_FORMS } from "./types.js";

/**
 * Body-free intake for observations made by an operator when no platform collector exists.
 *
 * This module only selects and normalizes values already supplied by the operator. It does not
 * validate a platform against the collector list, derive a pool, calculate a metric, or perform
 * any I/O.
 */

export const MANUAL_PLATFORM_INTAKE_VERSION = "manual-platform-intake-v1" as const;
export const MANUAL_PLATFORM_PROVENANCE = "manual-operator" as const;

export const MANUAL_PLATFORM_SCOPES = ["niche", "broad", "format"] as const;
export type ManualPlatformScope = (typeof MANUAL_PLATFORM_SCOPES)[number];
export type ManualText = string | "unknown" | null;
export type ManualNumber = number | "unknown" | null;
export interface ManualLineageRef {
  readonly recordType: string;
  readonly id: string;
  readonly relation: string;
}
export type ManualLineage = readonly ManualLineageRef[] | "unknown" | null;

export interface ManualAudienceSnapshotInput {
  readonly size?: ManualNumber;
  readonly countType?: ManualText;
  readonly observedAt?: ManualText;
  readonly collectedAt?: ManualText;
  readonly evidenceSource?: ManualText;
  readonly [key: string]: unknown;
}

export interface ManualMetricSnapshotInput {
  readonly metric?: ManualText;
  readonly value?: ManualNumber;
  readonly unit?: ManualText;
  readonly numerator?: ManualNumber;
  readonly denominator?: ManualNumber;
  readonly window?: ManualText;
  readonly scope?: ManualText;
  readonly observedAt?: ManualText;
  readonly [key: string]: unknown;
}

export interface ManualFormatInput {
  readonly medium?: string | "unknown" | null;
  readonly format?: string | "unknown" | null;
  readonly [key: string]: unknown;
}

export interface ManualMediaInput {
  readonly form?: string | "unknown" | null;
  readonly onscreen_text?: string | "unknown" | null;
  readonly description?: string | "unknown" | null;
  readonly duration_seconds?: ManualNumber;
  readonly media_count?: ManualNumber;
  readonly has_captions?: boolean | "unknown" | null;
  readonly aspect?: string | "unknown" | null;
  readonly asset_url?: string | "unknown" | null;
  readonly [key: string]: unknown;
}

export interface ManualCollectionInput {
  readonly status?: string | "unknown" | null;
  readonly caveats?: readonly string[] | "unknown" | null;
  readonly [key: string]: unknown;
}

export interface ManualEvidenceInput {
  readonly evidenceRefs?: readonly string[] | "unknown" | null;
  readonly evidenceLinks?: readonly string[] | "unknown" | null;
  readonly audienceSnapshot?: ManualAudienceSnapshotInput | "unknown" | null;
  readonly metricSnapshot?: ManualMetricSnapshotInput | "unknown" | null;
  readonly [key: string]: unknown;
}

/**
 * Flat fields are the preferred form. `account` and `post` are accepted as metadata containers
 * as well, so a caller can pass an existing account/post record without flattening it first.
 * Unknown extra keys are ignored; in particular, body-like fields are never copied.
 */
export interface ManualPlatformIntakeInput {
  readonly accountId?: string | "unknown" | null;
  readonly sourceId?: string | "unknown" | null;
  readonly postId?: string | "unknown" | null;
  readonly evidenceId?: string | "unknown" | null;
  readonly platform?: string | "unknown" | null;
  readonly handle?: string | "unknown" | null;
  readonly creator?: string | "unknown" | null;
  /** Explicit operator-supplied account role/category; never inferred. */
  readonly role?: string | "unknown" | null;
  readonly topic?: string | "unknown" | null;
  readonly topics?: readonly string[] | "unknown" | null;
  readonly focus?: readonly string[] | string | "unknown" | null;
  readonly audienceSnapshot?: ManualAudienceSnapshotInput | "unknown" | null;
  readonly medium?: string | "unknown" | null;
  readonly format?: string | ManualFormatInput | "unknown" | null;
  readonly media?: ManualMediaInput | "unknown" | null;
  readonly url?: string | "unknown" | null;
  readonly stableUrl?: string | "unknown" | null;
  readonly evidenceRefs?: readonly string[] | "unknown" | null;
  readonly pool?: string | "unknown" | null;
  readonly scope?: string | "unknown" | null;
  readonly selectionScope?: string | "unknown" | { readonly pool?: string; readonly scope?: string; readonly reason?: string } | null;
  readonly membershipReason?: string | "unknown" | null;
  readonly selectionReason?: string | "unknown" | null;
  readonly metricSnapshot?: ManualMetricSnapshotInput | "unknown" | null;
  readonly evidence?: ManualEvidenceInput | null;
  readonly collectionStatus?: string | "unknown" | null;
  readonly collectionCaveats?: readonly string[] | "unknown" | null;
  readonly collection?: ManualCollectionInput | null;
  readonly lineage?: ManualLineage;
  readonly observedAt?: string | "unknown" | null;
  readonly collectedAt?: string | "unknown" | null;
  readonly caveats?: readonly string[] | "unknown" | null;
  /** Accepted only so callers can explicitly discard it. It is never read into the output. */
  readonly body?: unknown;
  readonly account?: Record<string, unknown> | null;
  readonly post?: Record<string, unknown> | null;
  readonly [key: string]: unknown;
}

export interface ManualAudienceSnapshot {
  readonly size: ManualNumber;
  readonly countType: ManualText;
  readonly observedAt: ManualText;
  readonly collectedAt: ManualText;
  readonly evidenceSource: ManualText;
}

export interface ManualMetricSnapshot {
  readonly metric: ManualText;
  readonly value: ManualNumber;
  readonly unit: ManualText;
  readonly numerator: ManualNumber;
  readonly denominator: ManualNumber;
  readonly window: ManualText;
  readonly scope: ManualText;
  readonly observedAt: ManualText;
}

export interface ManualPlatformReadiness {
  readonly status: "ready" | "blocked";
  readonly blockers: string[];
}

export interface ManualPlatformIntake {
  readonly kind: "manual_platform_observation";
  readonly version: typeof MANUAL_PLATFORM_INTAKE_VERSION;
  readonly accountId: ManualText;
  readonly sourceId: ManualText;
  readonly postId: ManualText;
  readonly evidenceId: ManualText;
  readonly platform: ManualText;
  readonly handle: ManualText;
  readonly creator: ManualText;
  /** Present only when the operator supplied it explicitly. */
  readonly role?: ManualText;
  readonly topics: string[] | "unknown" | null;
  readonly focus: string[] | "unknown" | null;
  readonly audienceSnapshot: ManualAudienceSnapshot | "unknown" | null;
  readonly medium: ManualText;
  readonly format: ManualText;
  readonly media: ManualMediaObservation | null;
  readonly url: ManualText;
  readonly stableUrl: ManualText;
  readonly evidenceRefs: string[] | "unknown" | null;
  readonly pool: ManualPlatformScope | null;
  readonly scope: ManualPlatformScope | null;
  readonly membershipReason: ManualText;
  readonly metricSnapshot: ManualMetricSnapshot | "unknown" | null;
  readonly evidenceLinks: string[] | "unknown" | null;
  readonly popularityScope: ManualText;
  readonly sampleScope: ManualText;
  readonly baselineScope: ManualText;
  readonly baselineSource: ManualText;
  readonly observedAt: ManualText;
  readonly collectedAt: ManualText;
  readonly caveats: string[] | "unknown" | null;
  readonly provenance: typeof MANUAL_PLATFORM_PROVENANCE;
  readonly collectionMethod: "manual";
  readonly collectionStatus: ManualCollectionStatus | null;
  readonly collectionCaveats: string[] | "unknown" | null;
  readonly collection: {
    readonly method: "manual";
    readonly status: ManualCollectionStatus | null;
    readonly caveats: string[] | "unknown" | null;
  };
  readonly status: ManualCollectionStatus | null;
  readonly bodyIncluded: false;
  readonly bodyComplete: false;
  readonly lineage: ManualLineage;
  readonly evidence: ManualEvidenceProjection;
  readonly readiness: ManualPlatformReadiness;
  readonly sideEffects: "none";
}

export interface ManualMediaObservation {
  readonly form: string | "unknown" | null;
  readonly onscreen_text: ManualText;
  readonly description: ManualText;
  readonly duration_seconds: ManualNumber;
  readonly media_count: ManualNumber;
  readonly has_captions: boolean | "unknown" | null;
  readonly aspect: string | "unknown" | null;
  readonly asset_url: ManualText;
  readonly body_is_complete: false;
}

/** Source-post-evidence-shaped projection. It intentionally carries no body field. */
export interface ManualEvidenceProjection {
  readonly id: ManualText;
  readonly sourceId: ManualText;
  readonly accountId: ManualText;
  readonly postId: ManualText;
  readonly platform: ManualText;
  readonly medium: ManualText;
  readonly format: ManualText;
  readonly pool: ManualPlatformScope | null;
  readonly membershipReason: ManualText;
  readonly audienceSizeSnapshot: ManualAudienceSnapshot | "unknown" | null;
  readonly metricSnapshot: ManualMetricSnapshot | "unknown" | null;
  readonly popularityScope: ManualText;
  readonly sampleScope: ManualText;
  readonly baselineScope: ManualText;
  readonly evidenceLinks: string[] | "unknown" | null;
  readonly baselineSource: ManualText;
  readonly bodyComplete: false;
  readonly caveats: string[] | "unknown" | null;
  readonly provenance: typeof MANUAL_PLATFORM_PROVENANCE;
  readonly observedAt: ManualText;
  readonly collectedAt: ManualText;
  readonly reviewStatus: "pending";
  readonly status: ManualCollectionStatus | null;
  readonly lineage: ManualLineage;
}

export type ManualCollectionStatus = "observed" | "partial" | "blocked" | "not_collected";

type LooseRecord = Record<string, unknown>;

const SCOPES = new Set<string>(MANUAL_PLATFORM_SCOPES);

function record(value: unknown): LooseRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as LooseRecord
    : {};
}

function has(recordValue: LooseRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(recordValue, key);
}

/** Select the first explicitly supplied alias. No fallback is derived from another field. */
function pick(...candidates: Array<{ source: LooseRecord; keys: readonly string[] }>): unknown {
  for (const candidate of candidates) {
    for (const key of candidate.keys) {
      if (has(candidate.source, key) && candidate.source[key] !== undefined) return candidate.source[key];
    }
  }
  return undefined;
}

function text(value: unknown, lowerCase = false): ManualText {
  if (value === "unknown") return "unknown";
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return lowerCase ? normalized.toLowerCase() : normalized;
}

function number(value: unknown): ManualNumber {
  if (value === "unknown") return "unknown";
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function list(value: unknown): string[] | "unknown" | null {
  if (value === "unknown") return "unknown";
  if (value === null || value === undefined) return null;
  const values = Array.isArray(value) ? value : [value];
  return [...new Set(values
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0))].sort((left, right) => left.localeCompare(right));
}

function normalizeAudience(value: unknown): ManualAudienceSnapshot | "unknown" | null {
  if (value === "unknown") return "unknown";
  if (value === null || value === undefined) return null;
  const raw = record(value);
  return {
    size: number(pick({ source: raw, keys: ["size", "value", "count"] })),
    countType: text(pick({ source: raw, keys: ["countType", "count_type", "type"] })),
    observedAt: text(pick({ source: raw, keys: ["observedAt", "observed_at", "asOf", "as_of"] })),
    collectedAt: text(pick({ source: raw, keys: ["collectedAt", "collected_at"] })),
    evidenceSource: text(pick({ source: raw, keys: ["evidenceSource", "evidence_source", "provenance", "source"] })),
  };
}

function normalizeMetric(value: unknown): ManualMetricSnapshot | "unknown" | null {
  if (value === "unknown") return "unknown";
  if (value === null || value === undefined) return null;
  const raw = record(value);
  return {
    metric: text(pick({ source: raw, keys: ["metric", "name"] })),
    value: number(pick({ source: raw, keys: ["value"] })),
    unit: text(pick({ source: raw, keys: ["unit"] })),
    numerator: number(pick({ source: raw, keys: ["numerator"] })),
    denominator: number(pick({ source: raw, keys: ["denominator"] })),
    window: text(pick({ source: raw, keys: ["window"] })),
    scope: text(pick({ source: raw, keys: ["scope"] })),
    observedAt: text(pick({ source: raw, keys: ["observedAt", "observed_at"] })),
  };
}

const COLLECTION_STATUSES = new Set<ManualCollectionStatus>(["observed", "partial", "blocked", "not_collected"]);

function normalizeMedia(value: unknown): ManualMediaObservation | null {
  if (value === null || value === undefined || value === "unknown") return null;
  const raw = record(value);
  const rawForm = text(pick({ source: raw, keys: ["form"] }));
  const form = rawForm === "unknown" || rawForm === null
    ? rawForm
    : (MEDIA_FORMS as readonly string[]).includes(rawForm) ? rawForm : null;
  const aspect = text(pick({ source: raw, keys: ["aspect"] }));
  const captions = pick({ source: raw, keys: ["has_captions", "hasCaptions"] });
  return {
    form,
    onscreen_text: text(pick({ source: raw, keys: ["onscreen_text", "onscreenText"] })),
    description: text(pick({ source: raw, keys: ["description"] })),
    duration_seconds: number(pick({ source: raw, keys: ["duration_seconds", "durationSeconds"] })),
    media_count: number(pick({ source: raw, keys: ["media_count", "mediaCount"] })),
    has_captions: captions === "unknown" || typeof captions === "boolean" ? captions : null,
    aspect,
    asset_url: text(pick({ source: raw, keys: ["asset_url", "assetUrl"] })),
    body_is_complete: false,
  };
}

function normalizeCollectionStatus(input: LooseRecord, collection: LooseRecord): ManualCollectionStatus | null {
  const value = pick(
    { source: input, keys: ["collectionStatus", "collection_status"] },
    { source: collection, keys: ["status", "collectionStatus", "collection_status"] },
  );
  return typeof value === "string" && COLLECTION_STATUSES.has(value as ManualCollectionStatus)
    ? value as ManualCollectionStatus
    : null;
}

function explicitScope(input: LooseRecord, post: LooseRecord, field: "pool" | "scope" = "pool"): ManualPlatformScope | null {
  const keys = field === "pool"
    ? ["pool", "selectionScope", "selection_scope"]
    : ["scope", "selectionScope", "selection_scope"];
  const selected = pick(
    { source: input, keys },
    { source: post, keys },
  );
  const value = typeof selected === "object" && selected !== null
    ? pick({ source: record(selected), keys: [field] })
    : selected;
  const normalized = text(value, true);
  return normalized !== null && normalized !== "unknown" && SCOPES.has(normalized)
    ? normalized as ManualPlatformScope
    : null;
}

function explicitReason(input: LooseRecord, post: LooseRecord): ManualText {
  return text(pick(
    { source: input, keys: ["membershipReason", "membership_reason", "selectionReason", "selection_reason"] },
    { source: post, keys: ["membershipReason", "membership_reason", "selectionReason", "selection_reason"] },
  ));
}

function missing(value: unknown): boolean {
  return value === null || value === undefined || value === "unknown";
}

function addMissing(blockers: Set<string>, field: string, value: unknown): void {
  if (missing(value)) blockers.add(field);
}

function readiness(row: Omit<ManualPlatformIntake, "readiness">): ManualPlatformReadiness {
  const blockers = new Set<string>();
  addMissing(blockers, "accountId", row.accountId);
  addMissing(blockers, "postId", row.postId);
  addMissing(blockers, "platform", row.platform);
  addMissing(blockers, "handle", row.handle);
  addMissing(blockers, "creator", row.creator);
  if (row.topics === null || row.topics === "unknown" || row.topics.length === 0) blockers.add("topics");
  if (row.focus === null || row.focus === "unknown" || row.focus.length === 0) blockers.add("focus");
  addMissing(blockers, "medium", row.medium);
  addMissing(blockers, "format", row.format);
  addMissing(blockers, "url", row.url);
  if (row.evidenceRefs === null || row.evidenceRefs === "unknown" || row.evidenceRefs.length === 0) blockers.add("evidenceRefs");
  addMissing(blockers, "pool", row.pool);
  addMissing(blockers, "scope", row.scope);
  addMissing(blockers, "membershipReason", row.membershipReason);
  if (row.audienceSnapshot === null || row.audienceSnapshot === "unknown") {
    blockers.add("audienceSnapshot");
  } else {
    for (const field of ["size", "countType", "observedAt", "collectedAt", "evidenceSource"] as const) {
      addMissing(blockers, `audienceSnapshot.${field}`, row.audienceSnapshot[field]);
    }
  }
  if (row.metricSnapshot === null || row.metricSnapshot === "unknown") {
    blockers.add("metricSnapshot");
  } else {
    for (const field of ["metric", "value", "unit", "numerator", "denominator", "window", "scope", "observedAt"] as const) {
      addMissing(blockers, `metricSnapshot.${field}`, row.metricSnapshot[field]);
    }
  }
  addMissing(blockers, "observedAt", row.observedAt);
  addMissing(blockers, "collectedAt", row.collectedAt);
  if (row.caveats === null || row.caveats === "unknown") blockers.add("caveats");
  if (row.media?.form === null) blockers.add("media.form");
  if (row.collectionStatus === null || row.collectionStatus === "blocked" || row.collectionStatus === "not_collected") blockers.add("collectionStatus");
  return blockers.size === 0
    ? { status: "ready", blockers: [] }
    : { status: "blocked", blockers: [...blockers].sort((left, right) => left.localeCompare(right)) };
}

function build(input: ManualPlatformIntakeInput): ManualPlatformIntake {
  const raw = record(input);
  const account = record(raw.account);
  const post = record(raw.post);
  const format = record(raw.format);
  const media = record(raw.media);
  const evidence = record(raw.evidence);
  const collection = record(raw.collection);
  const audienceValue = pick(
    { source: raw, keys: ["audienceSnapshot", "audience_snapshot"] },
    { source: evidence, keys: ["audienceSnapshot", "audience_snapshot"] },
    { source: account, keys: ["audienceSnapshot", "audience_snapshot"] },
  );
  const metricValue = pick(
    { source: raw, keys: ["metricSnapshot", "metric_snapshot"] },
    { source: evidence, keys: ["metricSnapshot", "metric_snapshot"] },
    { source: post, keys: ["metricSnapshot", "metric_snapshot"] },
  );
  const topicsValue = pick(
    { source: raw, keys: ["topics", "topic"] },
    { source: account, keys: ["topics", "topic"] },
  );
  const focusValue = pick(
    { source: raw, keys: ["focus"] },
    { source: account, keys: ["focus"] },
  );
  const evidenceValue = pick(
    { source: raw, keys: ["evidenceRefs", "evidence_refs", "evidenceLinks", "evidence_links"] },
    { source: evidence, keys: ["evidenceRefs", "evidence_refs", "evidenceLinks", "evidence_links"] },
    { source: post, keys: ["evidenceRefs", "evidence_refs", "evidenceLinks", "evidence_links"] },
  );
  const rawFormatValue = pick(
    { source: raw, keys: ["format"] },
    { source: post, keys: ["format"] },
  );
  const formatValue = rawFormatValue !== null && typeof rawFormatValue === "object"
    ? pick({ source: format, keys: ["format"] })
    : rawFormatValue ?? pick({ source: format, keys: ["format"] });
  const mediumValue = pick(
    { source: raw, keys: ["medium"] },
    { source: format, keys: ["medium"] },
    { source: post, keys: ["medium"] },
  );
  const urlValue = pick(
    { source: raw, keys: ["url", "stableUrl", "stable_url"] },
    { source: post, keys: ["url", "stableUrl", "stable_url"] },
  );
  const status = normalizeCollectionStatus(raw, collection);
  const collectionCaveatsValue = pick(
    { source: raw, keys: ["collectionCaveats", "collection_caveats"] },
    { source: collection, keys: ["caveats"] },
  );
  const roleValue = text(pick(
    { source: raw, keys: ["role"] },
    { source: account, keys: ["role"] },
    { source: post, keys: ["role"] },
  ));
  const selectionInput = { ...evidence, ...raw };
  const rowWithoutReadiness: Omit<ManualPlatformIntake, "readiness"> = {
    kind: "manual_platform_observation",
    version: MANUAL_PLATFORM_INTAKE_VERSION,
    accountId: text(pick(
      { source: raw, keys: ["accountId", "account_id", "stableAccountId", "stable_account_id"] },
      { source: account, keys: ["accountId", "account_id", "stableAccountId", "stable_account_id", "id"] },
    )),
    sourceId: text(pick(
      { source: raw, keys: ["sourceId", "source_id"] },
      { source: post, keys: ["sourceId", "source_id"] },
    )),
    postId: text(pick(
      { source: raw, keys: ["postId", "post_id"] },
      { source: post, keys: ["postId", "post_id", "id"] },
    )),
    evidenceId: text(pick(
      { source: raw, keys: ["evidenceId", "evidence_id"] },
      { source: post, keys: ["evidenceId", "evidence_id"] },
    )),
    platform: text(pick(
      { source: raw, keys: ["platform"] },
      { source: account, keys: ["platform"] },
      { source: post, keys: ["platform"] },
    ), true),
    handle: text(pick(
      { source: raw, keys: ["handle"] },
      { source: account, keys: ["handle"] },
    )),
    creator: text(pick(
      { source: raw, keys: ["creator", "creatorName", "creator_name"] },
      { source: account, keys: ["creator", "creatorName", "creator_name", "name"] },
    )),
    ...(roleValue === null ? {} : { role: roleValue }),
    topics: list(topicsValue),
    focus: list(focusValue),
    audienceSnapshot: normalizeAudience(audienceValue),
    medium: text(mediumValue),
    format: text(formatValue),
    media: normalizeMedia(pick(
      { source: raw, keys: ["media"] },
      { source: post, keys: ["media"] },
    )),
    url: text(urlValue),
    stableUrl: text(urlValue),
    evidenceRefs: list(evidenceValue),
    evidenceLinks: list(evidenceValue),
    pool: explicitScope(selectionInput, post, "pool"),
    scope: explicitScope(selectionInput, post, "scope"),
    membershipReason: explicitReason(selectionInput, post),
    metricSnapshot: normalizeMetric(metricValue),
    popularityScope: text(pick(
      { source: raw, keys: ["popularityScope", "popularity_scope"] },
      { source: evidence, keys: ["popularityScope", "popularity_scope"] },
      { source: post, keys: ["popularityScope", "popularity_scope"] },
    )),
    sampleScope: text(pick(
      { source: raw, keys: ["sampleScope", "sample_scope"] },
      { source: evidence, keys: ["sampleScope", "sample_scope"] },
      { source: post, keys: ["sampleScope", "sample_scope"] },
    )),
    baselineScope: text(pick(
      { source: raw, keys: ["baselineScope", "baseline_scope"] },
      { source: evidence, keys: ["baselineScope", "baseline_scope"] },
      { source: post, keys: ["baselineScope", "baseline_scope"] },
    )),
    baselineSource: text(pick(
      { source: raw, keys: ["baselineSource", "baseline_source"] },
      { source: evidence, keys: ["baselineSource", "baseline_source"] },
      { source: post, keys: ["baselineSource", "baseline_source"] },
    )),
    observedAt: text(pick(
      { source: raw, keys: ["observedAt", "observed_at"] },
      { source: post, keys: ["observedAt", "observed_at"] },
    )),
    collectedAt: text(pick(
      { source: raw, keys: ["collectedAt", "collected_at"] },
      { source: post, keys: ["collectedAt", "collected_at"] },
    )),
    caveats: list(pick(
      { source: raw, keys: ["caveats"] },
      { source: evidence, keys: ["caveats"] },
      { source: post, keys: ["caveats"] },
    )),
    provenance: MANUAL_PLATFORM_PROVENANCE,
    collectionMethod: "manual",
    collectionStatus: status,
    collectionCaveats: list(collectionCaveatsValue),
    collection: { method: "manual", status, caveats: list(collectionCaveatsValue) },
    status,
    bodyIncluded: false,
    bodyComplete: false,
    lineage: input.lineage ?? null,
    evidence: {
      id: text(pick(
        { source: raw, keys: ["evidenceId", "evidence_id"] },
        { source: post, keys: ["evidenceId", "evidence_id"] },
      )),
      sourceId: text(pick(
        { source: raw, keys: ["sourceId", "source_id"] },
        { source: post, keys: ["sourceId", "source_id"] },
      )),
      accountId: text(pick(
        { source: raw, keys: ["accountId", "account_id", "stableAccountId", "stable_account_id"] },
        { source: account, keys: ["accountId", "account_id", "stableAccountId", "stable_account_id", "id"] },
      )),
      postId: text(pick(
        { source: raw, keys: ["postId", "post_id"] },
        { source: post, keys: ["postId", "post_id", "id"] },
      )),
      platform: text(pick(
        { source: raw, keys: ["platform"] },
        { source: account, keys: ["platform"] },
        { source: post, keys: ["platform"] },
      ), true),
      medium: text(mediumValue),
      format: text(formatValue),
      pool: explicitScope(selectionInput, post, "pool"),
      membershipReason: explicitReason(selectionInput, post),
      audienceSizeSnapshot: normalizeAudience(audienceValue),
      metricSnapshot: normalizeMetric(metricValue),
      popularityScope: text(pick(
        { source: raw, keys: ["popularityScope", "popularity_scope"] },
        { source: evidence, keys: ["popularityScope", "popularity_scope"] },
        { source: post, keys: ["popularityScope", "popularity_scope"] },
      )),
      sampleScope: text(pick(
        { source: raw, keys: ["sampleScope", "sample_scope"] },
        { source: evidence, keys: ["sampleScope", "sample_scope"] },
        { source: post, keys: ["sampleScope", "sample_scope"] },
      )),
      baselineScope: text(pick(
        { source: raw, keys: ["baselineScope", "baseline_scope"] },
        { source: evidence, keys: ["baselineScope", "baseline_scope"] },
        { source: post, keys: ["baselineScope", "baseline_scope"] },
      )),
      evidenceLinks: list(evidenceValue),
      baselineSource: text(pick(
        { source: raw, keys: ["baselineSource", "baseline_source"] },
        { source: evidence, keys: ["baselineSource", "baseline_source"] },
        { source: post, keys: ["baselineSource", "baseline_source"] },
      )),
      bodyComplete: false,
      caveats: list(pick(
        { source: raw, keys: ["caveats"] },
        { source: evidence, keys: ["caveats"] },
        { source: post, keys: ["caveats"] },
      )),
      provenance: MANUAL_PLATFORM_PROVENANCE,
      observedAt: text(pick(
        { source: raw, keys: ["observedAt", "observed_at"] },
        { source: post, keys: ["observedAt", "observed_at"] },
      )),
      collectedAt: text(pick(
        { source: raw, keys: ["collectedAt", "collected_at"] },
        { source: post, keys: ["collectedAt", "collected_at"] },
      )),
      reviewStatus: "pending",
      status,
      lineage: input.lineage ?? null,
    },
    sideEffects: "none",
  };

  return { ...rowWithoutReadiness, readiness: readiness(rowWithoutReadiness) };
}

export function buildManualPlatformIntake(input: ManualPlatformIntakeInput): ManualPlatformIntake {
  return build(input);
}

export const createManualPlatformIntake = buildManualPlatformIntake;
export const buildManualPlatformObservation = buildManualPlatformIntake;
export const createManualPlatformObservation = buildManualPlatformIntake;
