import { createHash } from "node:crypto";

import { REQUIRED_REVIEW_FIELDS, type ReviewPool } from "./review-metadata.js";

/** The fixed, human-approved identity of the review-staging source snapshot. */
export const REVIEW_STAGING_VERSION = "pattern-review-staging-v1" as const;
export const REVIEW_STAGING_SOURCE_COMMIT = "7b1256ea8d6787cea9105d2e4b2b60ea5ff1b3c7" as const;
export const REVIEW_STAGING_SELECTION_RULE = "evidenceCount > 0" as const;
export const REVIEW_STAGING_COHORT_SIZE = 65 as const;
export const REVIEW_STAGING_COHORT_DIGEST = "1dc0bdb96fd447365701e6bcf3cc251b8611a97f4ae701407fb0c4903641479f" as const;

const APPROVED_KEYS = [
  "bluesky|adriennemareebrown.bsky.social", "bluesky|carnage4life.bsky.social", "bluesky|danidonovan.com", "bluesky|simonwillison.net",
  "devto|sylwia-lask", "hackernews|hackernews", "instagram|adriennemareebrown", "instagram|dralexgeorge", "instagram|sharonsaysso", "instagram|the.holistic.psychologist",
  "linkedin|aagupta", "linkedin|codiesanchez", "linkedin|justinwelsh", "linkedin|thedankoe",
  "mastodon|bagder@mastodon.social", "mastodon|baldur@toot.cafe", "mastodon|dangillmor@mastodon.social", "mastodon|dansup@mastodon.social", "mastodon|gargron@mastodon.social", "mastodon|heidilifeldman@mastodon.social", "mastodon|mer__edith@mastodon.world", "mastodon|mmasnick@mastodon.social", "mastodon|molly0xfff@hachyderm.io",
  "reddit|r/adhd", "reddit|r/civictech", "reddit|r/claudeai", "reddit|r/entrepreneur", "reddit|r/lifeprotips", "reddit|r/localllama", "reddit|r/microsaas", "reddit|r/productmanagement", "reddit|r/sideproject", "reddit|r/youshouldknow",
  "substack-notes|robertreich", "substack-notes|tedgioia", "substack|anandwrites", "substack|davidpepper", "substack|deepaiyer", "substack|elenaverna", "substack|heathercoxrichardson",
  "threads|danidonovan", "threads|rowancheung", "threads|thedankoe",
  "tiktok|adhd_love", "tiktok|aliabdaal", "tiktok|carlos_eduardo_espina", "tiktok|realmattgray", "tiktok|sabrina_ramonov", "tiktok|theholisticpsychologist", "tiktok|underthedesknews",
  "x|akshat_world", "x|arvidkahl", "x|dickiebush", "x|levelsio", "x|nathanbarry", "x|sahilbloom",
  "youtube|aakashgupta", "youtube|aliabdaal", "youtube|benerez", "youtube|dankoetalks", "youtube|melrobbins", "youtube|neelsikdar", "youtube|productmanagementwithsachinsharma", "youtube|theholisticpsychologist", "youtube|underthedesknews",
] as const;
export const REVIEW_STAGING_APPROVED_KEYS = APPROVED_KEYS;

// Keep this assertion close to the snapshot constants: a typo in this allow-list must never
// silently change the approved cohort.
if (APPROVED_KEYS.length !== REVIEW_STAGING_COHORT_SIZE) throw new Error("review-staging approved key list has the wrong size");

export type ReviewStagingPool = ReviewPool;
export type ReviewStagingDisposition = "pending" | "include" | "exclude" | "unknown" | null;

export interface ReviewStagingSourceIdentity {
  readonly sourceCommit: typeof REVIEW_STAGING_SOURCE_COMMIT;
  readonly selectionRule: typeof REVIEW_STAGING_SELECTION_RULE;
  readonly cohortSize: typeof REVIEW_STAGING_COHORT_SIZE;
  readonly cohortDigest: typeof REVIEW_STAGING_COHORT_DIGEST;
}

export interface ReviewStagingRow {
  readonly accountKey: string;
  readonly currentAccountKey: string;
  readonly platform: string;
  readonly handle: string | null;
  readonly evidenceCount: number;
  readonly requiredMetadataFields: readonly string[];
  /** The explicit review fields are repeated at row level for an inspectable handoff. */
  readonly stableAccountId: unknown;
  readonly topics: unknown;
  readonly focus: unknown;
  readonly nicheLabel: unknown;
  readonly researchPoolMembership: unknown;
  readonly popularityScope: unknown;
  readonly sampleScope: unknown;
  readonly baselineScope: unknown;
  readonly baselineSource: unknown;
  readonly medium: unknown;
  readonly format: unknown;
  readonly audienceSnapshot: unknown;
  readonly evidenceLinks: unknown;
  readonly reviewer: unknown;
  readonly reviewed_at: unknown;
  readonly metadata: Record<string, unknown>;
  readonly sourceReferences: string[] | "unknown" | null;
  readonly provenance: string | "unknown" | null;
  readonly caveats: string[] | "unknown" | null;
  readonly poolDispositionChoices: readonly ReviewStagingPool[];
  readonly poolDisposition: Readonly<Record<ReviewStagingPool, ReviewStagingDisposition>>;
  readonly reviewStatus: string | "unknown" | null;
  readonly bodyIncluded: false;
}

export interface ReviewStagingArtifact {
  readonly kind: "pattern_review_staging";
  readonly version: typeof REVIEW_STAGING_VERSION;
  readonly source: ReviewStagingSourceIdentity;
  readonly rows: ReviewStagingRow[];
  readonly summary: { readonly cohortSize: number; readonly evidenceCount: number; readonly humanReviewRequired: true };
  readonly winnerClaimsAllowed: false;
  readonly canonicalWritesAllowed: false;
  readonly bodyIncluded: false;
  readonly sideEffects: "none";
}

export interface ReviewStagingInput {
  readonly accountMetadataRows: readonly unknown[];
  readonly source?: Partial<ReviewStagingSourceIdentity>;
  readonly sourceProjection?: Partial<ReviewStagingSourceIdentity>;
  readonly sourceCommit?: string;
  readonly selectionRule?: string;
  readonly cohortSize?: number;
  readonly cohortDigest?: string;
}

export class ReviewStagingValidationError extends Error {
  constructor(message: string) { super(message); this.name = "ReviewStagingValidationError"; }
}

const APPROVED_KEY_SET = new Set<string>(APPROVED_KEYS);
const POOLS: readonly ReviewStagingPool[] = ["niche", "broad", "format"];
const ALLOWED_ROW_KEYS = new Set([
  "currentAccountKey", "accountKey", "accountId", "platform", "reviewedPlatform", "handle", "reviewedHandle", "creator", "reviewedCreator", "evidenceCount",
  "audienceSnapshot", "topics", "focus", "nicheLabel", "medium", "format", "reviewedPoolMembership", "researchPoolMembership", "popularityScope", "sampleScope", "baselineScope", "baselineSource",
  "evidenceLinks", "evidenceRefs", "sourceReferences", "sourceRefs", "provenance", "caveats", "reviewStatus", "disposition", "reviewer", "reviewedAt", "reviewed_at", "reviewNote", "stableAccountId", "stableAccountIdStatus", "bodyIncluded",
]);
const BODY_KEYS = new Set(["body", "bodytext", "postbody", "posttext", "creatorbody", "rawbody", "transcript", "transcripttext", "caption", "content", "text", "title", "onscreentext", "opener", "hook", "model", "modelname", "modelversion", "prompt", "completion", "generatedby", "llm", "winner", "winners", "ranking", "rank", "score", "scores", "selectedwinner"]);

function fail(message: string): never { throw new ReviewStagingValidationError(message); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function keyName(value: string): string { return value.replace(/[_-]/g, "").toLowerCase(); }
function compare(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0; }
function sortedUnique(values: readonly string[]): string[] { return [...new Set(values)].sort(compare); }

function scanForBodies(value: unknown, path = "input", seen = new WeakSet<object>()): void {
  if (typeof value !== "object" || value === null) return;
  if (seen.has(value)) fail(`${path} contains a cyclic value`);
  seen.add(value);
  if (Array.isArray(value)) { value.forEach((item, index) => scanForBodies(item, `${path}[${index}]`, seen)); return; }
  for (const [key, nested] of Object.entries(value)) {
    const normalized = keyName(key);
    if (BODY_KEYS.has(normalized)) fail(`${path}.${key} is unsupported; body, model, ranking, and winner fields are not accepted`);
    if (normalized === "bodyincluded" && nested !== false) fail(`${path}.${key} must be false`);
    scanForBodies(nested, `${path}.${key}`, seen);
  }
}

/** Reject body-bearing envelopes before a CLI adapter projects their known fields. */
export function assertReviewStagingBodyFree(value: unknown): void { scanForBodies(value); }

function stableDigest(keys: readonly string[]): string {
  return createHash("sha256").update(`${[...keys].sort(compare).join("\n")}\n`, "utf8").digest("hex");
}

if (stableDigest(APPROVED_KEYS) !== REVIEW_STAGING_COHORT_DIGEST) {
  throw new Error("review-staging approved key list does not match its recorded digest");
}

function rowKey(value: Record<string, unknown>, index: number): string {
  const key = value.currentAccountKey ?? value.accountKey;
  if (typeof key !== "string" || key.trim() === "") fail(`accountMetadataRows[${index}].currentAccountKey must be a non-empty string`);
  return key.trim();
}

function listOrUnknown(value: unknown, path: string): string[] | "unknown" | null {
  if (value === undefined || value === null) return null;
  if (value === "unknown") return "unknown";
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) fail(`${path} must be an array of strings, null, or unknown`);
  return sortedUnique(value as string[]);
}

function textOrUnknown(value: unknown, path: string): string | "unknown" | null {
  if (value === undefined || value === null) return null;
  if (value === "unknown") return "unknown";
  if (typeof value !== "string") fail(`${path} must be a string, null, or unknown`);
  return value.trim() || null;
}

function rowProjection(value: unknown, index: number): ReviewStagingRow {
  if (!isRecord(value)) fail(`accountMetadataRows[${index}] must be an object`);
  for (const key of Object.keys(value)) if (!ALLOWED_ROW_KEYS.has(key)) fail(`accountMetadataRows[${index}].${key} is an unsupported metadata field`);
  const currentAccountKey = rowKey(value, index);
  if (typeof value.platform !== "string" || value.platform.trim() === "") fail(`accountMetadataRows[${index}].platform must be a non-empty string`);
  const evidenceCount = value.evidenceCount;
  if (typeof evidenceCount !== "number" || !Number.isInteger(evidenceCount) || evidenceCount < 0) fail(`accountMetadataRows[${index}].evidenceCount must be a non-negative integer`);
  const handle = value.handle ?? value.reviewedHandle ?? null;
  if (handle !== null && typeof handle !== "string") fail(`accountMetadataRows[${index}].handle must be a string or null`);
  const sourceReferences = listOrUnknown(value.sourceReferences ?? value.sourceRefs ?? value.evidenceRefs ?? value.evidenceLinks, `accountMetadataRows[${index}].sourceReferences`);
  const caveats = listOrUnknown(value.caveats, `accountMetadataRows[${index}].caveats`);
  const provenance = textOrUnknown(value.provenance, `accountMetadataRows[${index}].provenance`);
  const reviewStatus = Object.prototype.hasOwnProperty.call(value, "reviewStatus")
    ? textOrUnknown(value.reviewStatus, `accountMetadataRows[${index}].reviewStatus`)
    : "unreviewed";
  const metadata: Record<string, unknown> = {};
  for (const field of REQUIRED_REVIEW_FIELDS) {
    const alias = field === "reviewed_at" ? (value.reviewed_at ?? value.reviewedAt) : field === "stableAccountId" ? (value.stableAccountId ?? value.accountId) : field === "researchPoolMembership" ? (value.researchPoolMembership ?? value.reviewedPoolMembership) : value[field];
    metadata[field] = alias === undefined ? null : alias;
  }
  metadata.caveats = caveats;
  metadata.provenance = provenance;
  metadata.reviewStatus = reviewStatus;
  const poolDisposition = { niche: null, broad: null, format: null } as Record<ReviewStagingPool, ReviewStagingDisposition>;
  return {
    accountKey: currentAccountKey,
    currentAccountKey,
    platform: value.platform.trim(),
    handle: typeof handle === "string" ? handle.trim() : null,
    evidenceCount,
    requiredMetadataFields: [...REQUIRED_REVIEW_FIELDS],
    stableAccountId: metadata.stableAccountId,
    topics: metadata.topics,
    focus: metadata.focus,
    nicheLabel: metadata.nicheLabel,
    researchPoolMembership: metadata.researchPoolMembership,
    popularityScope: metadata.popularityScope,
    sampleScope: metadata.sampleScope,
    baselineScope: metadata.baselineScope,
    baselineSource: metadata.baselineSource,
    medium: metadata.medium,
    format: metadata.format,
    audienceSnapshot: metadata.audienceSnapshot,
    evidenceLinks: metadata.evidenceLinks,
    reviewer: metadata.reviewer,
    reviewed_at: metadata.reviewed_at,
    metadata,
    sourceReferences,
    provenance,
    caveats,
    poolDispositionChoices: [...POOLS],
    poolDisposition,
    reviewStatus,
    bodyIncluded: false,
  };
}

function sourceIdentity(input: ReviewStagingInput): ReviewStagingSourceIdentity {
  const source = input.source ?? input.sourceProjection;
  const sourceCommit = input.sourceCommit ?? source?.sourceCommit;
  const selectionRule = input.selectionRule ?? source?.selectionRule;
  const cohortSize = input.cohortSize ?? source?.cohortSize;
  const cohortDigest = input.cohortDigest ?? source?.cohortDigest;
  if (sourceCommit !== undefined && sourceCommit !== REVIEW_STAGING_SOURCE_COMMIT) fail(`source commit mismatch: expected ${REVIEW_STAGING_SOURCE_COMMIT}`);
  if (selectionRule !== undefined && selectionRule !== REVIEW_STAGING_SELECTION_RULE) fail(`selection rule mismatch: expected ${REVIEW_STAGING_SELECTION_RULE}`);
  if (cohortSize !== undefined && cohortSize !== REVIEW_STAGING_COHORT_SIZE) fail(`approved cohort count mismatch: expected ${REVIEW_STAGING_COHORT_SIZE}`);
  if (cohortDigest !== undefined && cohortDigest !== REVIEW_STAGING_COHORT_DIGEST) fail(`approved cohort digest mismatch: expected ${REVIEW_STAGING_COHORT_DIGEST}`);
  return { sourceCommit: REVIEW_STAGING_SOURCE_COMMIT, selectionRule: REVIEW_STAGING_SELECTION_RULE, cohortSize: REVIEW_STAGING_COHORT_SIZE, cohortDigest: REVIEW_STAGING_COHORT_DIGEST };
}

/** Build a deterministic, body-free projection of exactly the approved evidence-bearing cohort. */
export function buildReviewStaging(input: ReviewStagingInput): ReviewStagingArtifact {
  if (!isRecord(input) || !Array.isArray(input.accountMetadataRows)) fail("input.accountMetadataRows must be an array");
  scanForBodies(input);
  const identity = sourceIdentity(input);
  const projected = input.accountMetadataRows.map(rowProjection);
  const seen = new Set<string>();
  for (const row of projected) { if (seen.has(row.currentAccountKey)) fail(`duplicate currentAccountKey \"${row.currentAccountKey}\"`); seen.add(row.currentAccountKey); }
  const candidateRows = projected.filter((row) => row.evidenceCount > 0);
  const keys = candidateRows.map((row) => row.currentAccountKey);
  const digest = stableDigest(keys);
  if (candidateRows.length !== identity.cohortSize) fail(`approved cohort count mismatch: source projection has ${candidateRows.length}, expected ${identity.cohortSize}`);
  const missing = APPROVED_KEYS.filter((key) => !seen.has(key));
  const outside = keys.filter((key) => !APPROVED_KEY_SET.has(key));
  // The allow-list is the recorded snapshot's source-of-truth. The digest is retained in the
  // artifact and checked at the boundary; set comparison also makes a same-sized replacement
  // fail closed even if a caller supplies an accidentally stale digest field.
  if (digest !== identity.cohortDigest) {
    fail(`approved cohort digest mismatch: source projection does not equal the approved snapshot${outside.length ? `; outside cohort: ${outside.sort(compare).join(", ")}` : ""}${missing.length ? `; missing cohort members: ${missing.join(", ")}` : ""}`);
  }
  const rows = candidateRows.sort((left, right) => compare(left.currentAccountKey, right.currentAccountKey));
  return {
    kind: "pattern_review_staging",
    version: REVIEW_STAGING_VERSION,
    source: identity,
    rows,
    summary: { cohortSize: rows.length, evidenceCount: rows.reduce((sum, row) => sum + row.evidenceCount, 0), humanReviewRequired: true },
    winnerClaimsAllowed: false,
    canonicalWritesAllowed: false,
    bodyIncluded: false,
    sideEffects: "none",
  };
}

export const buildPatternReviewStaging = buildReviewStaging;
export const buildReviewStagingProjection = buildReviewStaging;
export const createReviewStaging = buildReviewStaging;
export function renderReviewStagingJson(artifact: ReviewStagingArtifact): string { return `${JSON.stringify(artifact, null, 2)}\n`; }

export function renderReviewStagingMarkdown(artifact: ReviewStagingArtifact): string {
  const cell = (value: unknown): string => String(value ?? "null").replaceAll("|", "\\|").replace(/[\r\n]+/g, " ");
  return [
    "# Pattern review staging",
    "",
    `Source: ${artifact.source.sourceCommit} | Rule: ${artifact.source.selectionRule} | Cohort: ${artifact.summary.cohortSize} | Evidence: ${artifact.summary.evidenceCount}`,
    "Human review only. No bodies, inference, ranking, canonical writes, or publication.",
    "",
    "| Account | Platform | Handle | Evidence | Review status | Source references | Provenance | Caveats | Niche | Broad | Format |",
    "|---|---|---|---:|---|---|---|---|---|---|---|",
    ...artifact.rows.map((row) => `| ${cell(row.accountKey)} | ${cell(row.platform)} | ${cell(row.handle)} | ${row.evidenceCount} | ${cell(row.reviewStatus)} | ${cell(row.sourceReferences === "unknown" ? "unknown" : row.sourceReferences?.join(", "))} | ${cell(row.provenance)} | ${cell(row.caveats === "unknown" ? "unknown" : row.caveats?.join(", "))} | pending | pending | pending |`),
    "",
  ].join("\n");
}
