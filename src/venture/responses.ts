import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { respondentHash } from "../research/store.js";
import { appendCanonEvent, findCanonEvent } from "./canon.js";
import { responsesPath, ventureDir } from "./paths.js";
import { loadRules } from "./rules.js";

// Phase 3's response log (rules.md §7.2-§7.4, venture-schema-contract.md §5.4). This is the
// gated, 20/30-eligible-unique-respondent problem-selection loop's own private store --
// completely separate from src/research/store.ts's account-level research_observations (§5.4a),
// which backs Phase 1's wider signal ingestion. Never mix the two: a research_observations row
// (or one tagged historical_prior) MUST NOT count toward this gate (rules.md §11 items 32/34).
//
// venture/<slug>/responses.jsonl is gitignored (see .gitignore) -- raw quotes and respondent
// hashes never reach git, same privacy treatment as data/analytics.db.

export type ResponseSource = "survey" | "email" | "comment" | "dm" | "other";
export type EmotionalIntensity = "low" | "medium" | "high";

export interface ResponseRecord {
  response_id: string;
  source: ResponseSource;
  received_at: string;
  // A keyed HMAC (src/research/store.ts's respondentHash, same RESEARCH_HASH_KEY discipline as
  // §5.4a's observations and §5.7's funnel events) when the ingesting caller supplied a stable
  // platform identifier -- this is what dedupes the same person appearing via two channels. When
  // no identifier was supplied, this is a random, guaranteed-unique placeholder (never a real
  // hash of anything) so the response is treated as its own unique respondent -- deliberately no
  // fuzzy/automatic person-matching (see ingestResponse's doc comment). Either way, the raw
  // identifier itself is NEVER persisted here or anywhere else.
  respondent_hash: string;
  // A judgment call by whoever transcribed this response against the venture's target audience
  // (intake.md) -- ingestResponse takes this as explicit input, it never infers it.
  target_audience_eligible: boolean;
  exact_quote: string;
  redacted_quote: string;
  stuck_point: string;
  desired_outcome: string | null;
  emotional_intensity: EmotionalIntensity;
  cluster_id: string | null;
  // Derived, not independently settable: true iff exclusion_reason is null. Kept as its own
  // field because it's what venture-schema-contract.md §5.4's record shape and the user-facing
  // copy table (rules.md §10: "eligible unique respondents" -> "people who count toward the
  // goal") both name directly.
  included_in_gate: boolean;
  exclusion_reason: string | null;
}

export interface ResponseGateState {
  state: "closed" | "opened";
  have: number;
  need: number;
  target: number;
  opened_at: string | null;
}

function gateEventId(slug: string): string {
  return `${slug}/response-gate-opened`;
}

function readLines(slug: string): ResponseRecord[] {
  const path = responsesPath(slug);
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as ResponseRecord);
}

// responses.jsonl is append-only: each write is a full snapshot line for that response_id.
// Reading folds to the latest line per id (last write wins) -- the same event-sourced pattern
// artifacts.jsonl and decisions.jsonl already use, not a new file I/O approach.
export function readResponses(slug: string): ResponseRecord[] {
  const lines = readLines(slug);
  const latest = new Map<string, ResponseRecord>();
  for (const r of lines) latest.set(r.response_id, r);
  return [...latest.values()];
}

export function readResponse(slug: string, responseId: string): ResponseRecord | undefined {
  return readResponses(slug).find((r) => r.response_id === responseId);
}

function appendLine(slug: string, record: ResponseRecord): void {
  mkdirSync(ventureDir(slug), { recursive: true });
  appendFileSync(responsesPath(slug), JSON.stringify(record) + "\n");
}

// The gate's exact predicate (rules.md §7.3, venture-schema-contract.md §5.4): eligible unique
// respondents, never a row count. Pure and file-I/O-free on purpose so it's directly testable in
// isolation -- this is the required-test-area item the build plan calls out by name.
export function countEligibleUnique(records: ResponseRecord[]): number {
  const eligible = records.filter((r) => r.target_audience_eligible && r.included_in_gate);
  return new Set(eligible.map((r) => r.respondent_hash)).size;
}

function gateStateFromRecords(slug: string, records: ResponseRecord[]): ResponseGateState {
  const rules = loadRules();
  const have = countEligibleUnique(records);
  const event = findCanonEvent(slug, gateEventId(slug));
  return {
    state: event ? "opened" : "closed",
    have,
    need: rules.response_gate.min_eligible_unique,
    target: rules.response_gate.target_eligible_unique,
    opened_at: event ? event.at : null,
  };
}

// Read-model shape from venture-schema-contract.md §5.1/§5.4.
export function getResponseGateState(slug: string): ResponseGateState {
  return gateStateFromRecords(slug, readResponses(slug));
}

// Fires the `response_gate_opened` ledger event the first time eligible-unique count reaches
// min_eligible_unique (rules.md §7.3). appendCanonEvent's own hasCanonEvent guard is what makes
// this idempotent -- re-checking on every ingest/correct call, even ones that cross the threshold
// repeatedly (e.g. a later correction drops the count back below 20, then a fresh ingest crosses
// it again), never double-fires or duplicates the event. This is a standalone ledger event: it
// does NOT clear a checkpoint and does NOT touch state.ts's checkpoint/phase machinery -- a later
// work package reads it directly via canon.ts to gate the cluster/problem/outline/price commands.
function maybeOpenGate(slug: string, records: ResponseRecord[], at: string): ResponseGateState {
  const rules = loadRules();
  const have = countEligibleUnique(records);
  if (have >= rules.response_gate.min_eligible_unique) {
    appendCanonEvent(slug, "response-gate-opened", gateEventId(slug), { eligible_unique: String(have) }, at);
  }
  return gateStateFromRecords(slug, records);
}

export interface RawIdentifier {
  platform: string;
  stableUserId: string | number;
}

export interface IngestResponseInput {
  source: ResponseSource;
  receivedAt: string;
  // A stable platform identifier (email, a platform's numeric/opaque user id -- NOT a display
  // name or handle), when the ingesting caller has one. It is hashed via respondentHash()
  // (src/research/store.ts, keyed HMAC-SHA256 off RESEARCH_HASH_KEY) and the raw value is
  // discarded immediately -- never written to responses.jsonl, never logged, never returned.
  // Omit when no identifier is available: the response is then treated as its own unique
  // respondent. This is deliberate -- automatic/fuzzy person-matching across responses with no
  // shared identifier is out of scope (too speculative with no second case to validate against).
  // Muxin can merge two response records she recognizes as the same person via
  // correctResponse's merge_with_response_id.
  rawIdentifier?: RawIdentifier | null;
  targetAudienceEligible: boolean;
  exactQuote: string;
  redactedQuote: string;
  stuckPoint: string;
  desiredOutcome?: string | null;
  emotionalIntensity: EmotionalIntensity;
  exclusionReason?: string | null;
  responseId?: string; // override for deterministic tests/idempotent re-ingest; default random
}

export interface IngestResponseResult {
  record: ResponseRecord;
  // Ingestion returns a confirmation, never raw text back (venture-schema-contract.md §5.4) --
  // this is that confirmation's duplicate flag: true when the computed respondent_hash matches
  // an already-ingested response's hash. Informational only; it does not block the write or set
  // exclusion_reason automatically -- countEligibleUnique's own dedup is the actual gate logic.
  likelyDuplicate: boolean;
  gate: ResponseGateState;
}

export function ingestResponse(slug: string, input: IngestResponseInput, at: string): IngestResponseResult {
  const existing = readResponses(slug);
  const respondentHashValue = input.rawIdentifier
    ? respondentHash(input.rawIdentifier.platform, input.rawIdentifier.stableUserId)
    : `no-id-${randomUUID()}`;
  const likelyDuplicate = existing.some((r) => r.respondent_hash === respondentHashValue);
  const exclusionReason = input.exclusionReason ?? null;
  const record: ResponseRecord = {
    response_id: input.responseId ?? `r-${randomUUID()}`,
    source: input.source,
    received_at: input.receivedAt,
    respondent_hash: respondentHashValue,
    target_audience_eligible: input.targetAudienceEligible,
    exact_quote: input.exactQuote,
    redacted_quote: input.redactedQuote,
    stuck_point: input.stuckPoint,
    desired_outcome: input.desiredOutcome ?? null,
    emotional_intensity: input.emotionalIntensity,
    cluster_id: null,
    included_in_gate: exclusionReason === null,
    exclusion_reason: exclusionReason,
  };
  appendLine(slug, record);
  const gate = maybeOpenGate(slug, [...existing, record], at);
  return { record, likelyDuplicate, gate };
}

// venture-schema-contract.md §5.5's `POST …/response/<id>/correct`, extended (this work package)
// with a merge path: `merge_with_response_id` sets THIS response's respondent_hash to match the
// named response's hash, i.e. "treat this response as the same respondent as that one" -- for
// when Muxin manually recognizes the same person across two records. Everything else matches the
// contract's field list exactly. `exact_quote` is never rewritten (not in this patch's shape).
export interface ResponseCorrectionPatch {
  cluster_id?: string | null;
  target_audience_eligible?: boolean;
  exclusion_reason?: string | null;
  stuck_point?: string;
  desired_outcome?: string | null;
  merge_with_response_id?: string;
}

export function correctResponse(slug: string, responseId: string, patch: ResponseCorrectionPatch, at: string): ResponseRecord {
  const current = readResponse(slug, responseId);
  if (!current) throw new Error(`no such response: ${responseId}`);

  let respondentHashValue = current.respondent_hash;
  if (patch.merge_with_response_id) {
    if (patch.merge_with_response_id === responseId) {
      throw new Error(`cannot merge response "${responseId}" with itself`);
    }
    const other = readResponse(slug, patch.merge_with_response_id);
    if (!other) throw new Error(`no such response to merge with: ${patch.merge_with_response_id}`);
    respondentHashValue = other.respondent_hash;
  }

  const exclusionReason = patch.exclusion_reason !== undefined ? patch.exclusion_reason : current.exclusion_reason;
  const next: ResponseRecord = {
    ...current,
    respondent_hash: respondentHashValue,
    cluster_id: patch.cluster_id !== undefined ? patch.cluster_id : current.cluster_id,
    target_audience_eligible: patch.target_audience_eligible ?? current.target_audience_eligible,
    exclusion_reason: exclusionReason,
    included_in_gate: exclusionReason === null,
    stuck_point: patch.stuck_point ?? current.stuck_point,
    desired_outcome: patch.desired_outcome !== undefined ? patch.desired_outcome : current.desired_outcome,
  };
  appendLine(slug, next);
  // readResponses folds append-only lines to the latest per response_id, so this already reflects
  // the correction just written above -- no need to splice `next` in manually.
  maybeOpenGate(slug, readResponses(slug), at);
  return next;
}
