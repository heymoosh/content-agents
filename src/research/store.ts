import "../util/env.js";
import Database from "better-sqlite3";
import { createHmac, randomUUID } from "node:crypto";
import type { FetchedNote } from "../atomize/fetch-notes.js";
import type { FetchedReply } from "./substack/replies.js";
import { validateMeasurementBinding, type BrandId } from "../identity/brand.js";
export type MeasurementBinding = { brandId: BrandId; providerAccountId: string };
function resolvedBinding(binding: MeasurementBinding): MeasurementBinding {
  return validateMeasurementBinding(binding);
}

export interface ReplyObservationResult {
  observationId: string;
  action: "new" | "unchanged" | "changed";
}

export interface ReconciliationResult {
  newObservations: number;
  changedObservations: number;
  unchangedObservations: number;
  tombstonedObservations: number;
}

export interface MetricWriteResult {
  observationId: string;
  created: boolean;
  changed: boolean;
  measured: boolean;
}

export function requireResearchHashKey(key = process.env.RESEARCH_HASH_KEY): string {
  if (!key || !key.trim()) throw new Error("RESEARCH_HASH_KEY is required before research capture can write observations");
  return key;
}

export function respondentHash(platform: string, stableUserId: string | number, key = requireResearchHashKey()): string {
  return createHmac("sha256", key)
    .update(`${platform.toLowerCase()}:${String(stableUserId)}`, "utf8")
    .digest("hex");
}

/** Minimize text before it is sent to a classifier or a redacted research read. */
export function redactResearchText(text: string): string {
  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL_REDACTED]")
    .replace(/\b(?:\+?\d[\d .()\-]{7,}\d)\b/g, "[PHONE_REDACTED]")
    .replace(/https?:\/\/[^\s)]+/gi, "[URL_REDACTED]");
}

function isoOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function ageHours(publishedAt: string | null, observedAt: string): number | null {
  if (!publishedAt) return null;
  const start = new Date(publishedAt).getTime();
  const end = new Date(observedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, (end - start) / 3_600_000);
}

function nextObservationId(): string {
  return `o-${randomUUID()}`;
}

function insertObservation(
  db: Database.Database,
  input: {
    observationId?: string;
    source: string;
    sourcePlatform: string;
    surface: string | null;
    contentItemId?: string | null;
    noteId?: string | null;
    replyId?: string | null;
    parentReplyId?: string | null;
    publishedAt?: string | null;
    observedAt: string;
    capturedAt: string;
    respondentHash?: string | null;
    exactText?: string | null;
    redactedText?: string | null;
    isCreatorObservation?: boolean;
    privacyClass: string;
    postAgeHours?: number | null;
    viewsAtObservation?: number | null;
    editedAt?: string | null;
    metricName?: string | null;
    metricValue?: number | null;
    previousValue?: number | null;
    delta?: number | null;
    windowStart?: string | null;
    windowEnd?: string | null;
    collectedAt?: string | null;
    brandId?: BrandId | null;
    providerAccountId?: string | null;
  }
): string {
  const observationId = input.observationId ?? nextObservationId();
  db.prepare(
    `INSERT INTO research_observations (
      observation_id, source, source_platform, surface, content_item_id, note_id, reply_id,
      parent_reply_id, published_at, observed_at, captured_at, respondent_hash, exact_text,
      redacted_text, is_creator_observation, privacy_class, post_age_hours, views_at_observation,
      edited_at, metric_name, metric_value, previous_value, delta, window_start, window_end, collected_at
      ,brand_id, provider_account_id
    ) VALUES (
      @observationId, @source, @sourcePlatform, @surface, @contentItemId, @noteId, @replyId,
      @parentReplyId, @publishedAt, @observedAt, @capturedAt, @respondentHash, @exactText,
      @redactedText, @isCreatorObservation, @privacyClass, @postAgeHours, @viewsAtObservation,
      @editedAt, @metricName, @metricValue, @previousValue, @delta, @windowStart, @windowEnd, @collectedAt
      ,@brandId, @providerAccountId
    )`
  ).run({
    observationId,
    source: input.source,
    sourcePlatform: input.sourcePlatform,
    surface: input.surface,
    contentItemId: input.contentItemId ?? null,
    noteId: input.noteId ?? null,
    replyId: input.replyId ?? null,
    parentReplyId: input.parentReplyId ?? null,
    publishedAt: input.publishedAt ?? null,
    observedAt: input.observedAt,
    capturedAt: input.capturedAt,
    respondentHash: input.respondentHash ?? null,
    exactText: input.exactText ?? null,
    redactedText: input.redactedText ?? null,
    isCreatorObservation: input.isCreatorObservation ? 1 : 0,
    privacyClass: input.privacyClass,
    postAgeHours: input.postAgeHours ?? null,
    viewsAtObservation: input.viewsAtObservation ?? null,
    editedAt: input.editedAt ?? null,
    metricName: input.metricName ?? null,
    metricValue: input.metricValue ?? null,
    previousValue: input.previousValue ?? null,
    delta: input.delta ?? null,
    windowStart: input.windowStart ?? null,
    windowEnd: input.windowEnd ?? null,
    collectedAt: input.collectedAt ?? null,
    brandId: input.brandId ?? null,
    providerAccountId: input.providerAccountId ?? null,
  });
  return observationId;
}

function replyInput(note: FetchedNote, reply: FetchedReply, at: string, key: string, binding: MeasurementBinding) {
  return {
    source: "reply",
    sourcePlatform: "substack",
    surface: "note",
    contentItemId: note.noteId,
    noteId: note.noteId,
    replyId: reply.replyId,
    parentReplyId: reply.parentReplyId,
    publishedAt: isoOrNull(reply.publishedAt),
    observedAt: at,
    capturedAt: at,
    respondentHash: reply.userId === null ? null : respondentHash("substack", reply.userId, key),
    exactText: reply.body,
    redactedText: redactResearchText(reply.body),
    isCreatorObservation: note.authorUserId !== undefined && reply.userId !== null && reply.userId === note.authorUserId,
    privacyClass: "private_non_identifying",
    postAgeHours: ageHours(note.publishedAt, at),
    viewsAtObservation: note.views ?? null,
    editedAt: isoOrNull(reply.editedAt),
    brandId: binding.brandId,
    providerAccountId: binding.providerAccountId,
  } as const;
}

export function upsertReplyObservation(
  db: Database.Database,
  note: FetchedNote,
  reply: FetchedReply,
  at: string,
  key: string | undefined,
  binding: MeasurementBinding,
): ReplyObservationResult {
  const valid = resolvedBinding(binding);
  const hashKey = key ?? requireResearchHashKey();
  const current = db
    .prepare(
      `SELECT observation_id, exact_text, edited_at, deleted_at, is_creator_observation
       FROM research_observations
       WHERE source = 'reply' AND source_platform = 'substack' AND note_id = ? AND reply_id = ? AND brand_id = ? AND provider_account_id = ?
         AND superseded_by IS NULL
       ORDER BY captured_at DESC LIMIT 1`
    )
    .get(note.noteId, reply.replyId, valid.brandId, valid.providerAccountId) as
    | {
        observation_id: string;
        exact_text: string | null;
        edited_at: string | null;
        deleted_at: string | null;
        is_creator_observation: number;
      }
    | undefined;
  const input = replyInput(note, reply, at, hashKey, valid);

  if (current && current.exact_text === input.exactText && current.edited_at === input.editedAt) {
    if (current.deleted_at || (note.authorUserId !== undefined && current.is_creator_observation !== (input.isCreatorObservation ? 1 : 0))) {
      db.prepare(
        "UPDATE research_observations SET deleted_at = NULL, is_creator_observation = ? WHERE observation_id = ?"
      ).run(input.isCreatorObservation ? 1 : 0, current.observation_id);
    }
    return { observationId: current.observation_id, action: "unchanged" };
  }

  const action = current ? "changed" : "new";
  const observationId = insertObservation(db, input);
  if (current) {
    db.prepare("UPDATE research_observations SET superseded_by = ? WHERE observation_id = ?").run(
      observationId,
      current.observation_id
    );
  }
  return { observationId, action };
}

export function reconcileReplyObservations(
  db: Database.Database,
  note: FetchedNote,
  replies: FetchedReply[],
  completeness: "complete" | "partial",
  at: string,
  key: string | undefined,
  binding: MeasurementBinding,
): ReconciliationResult {
  const result: ReconciliationResult = {
    newObservations: 0,
    changedObservations: 0,
    unchangedObservations: 0,
    tombstonedObservations: 0,
  };
  const seen = new Set<string>();
  const transaction = db.transaction(() => {
    for (const reply of replies) {
      seen.add(reply.replyId);
      const outcome = upsertReplyObservation(db, note, reply, at, key, binding);
      if (outcome.action === "new") result.newObservations++;
      else if (outcome.action === "changed") result.changedObservations++;
      else result.unchangedObservations++;
    }
    if (completeness !== "complete") return;
    const valid = resolvedBinding(binding);
    const rows = db
      .prepare(
        `SELECT observation_id, reply_id
         FROM research_observations
         WHERE source = 'reply' AND note_id = ? AND brand_id = ? AND provider_account_id = ? AND superseded_by IS NULL AND deleted_at IS NULL`
      )
      .all(note.noteId, valid.brandId, valid.providerAccountId) as { observation_id: string; reply_id: string }[];
    for (const row of rows) {
      if (seen.has(row.reply_id)) continue;
      db.prepare("UPDATE research_observations SET deleted_at = ? WHERE observation_id = ?").run(at, row.observation_id);
      result.tombstonedObservations++;
    }
  });
  transaction();
  return result;
}

export function writeMetricObservation(
  db: Database.Database,
  input: {
    source?: "metric" | "subscriber_movement";
    sourcePlatform?: string;
    surface?: string | null;
    contentItemId?: string | null;
    noteId?: string | null;
    publishedAt?: string | null;
    metricName: string;
    metricValue: number | null;
    at: string;
    binding: MeasurementBinding;
  }
): MetricWriteResult {
  const valid = resolvedBinding(input.binding);
  const source = input.source ?? "metric";
  const sourcePlatform = input.sourcePlatform ?? "substack";
  const previous = db
    .prepare(
      `SELECT observation_id, metric_value, window_start, window_end
       FROM research_observations
       WHERE source = ? AND metric_name = ?
         AND ((content_item_id = ?) OR (content_item_id IS NULL AND ? IS NULL)) AND brand_id = ? AND provider_account_id = ?
       ORDER BY collected_at DESC, rowid DESC LIMIT 1`
    )
    .get(source, input.metricName, input.contentItemId ?? null, input.contentItemId ?? null, valid.brandId, valid.providerAccountId) as
    | { observation_id: string; metric_value: number | null; window_start: string | null; window_end: string | null }
    | undefined;

  if (previous && previous.metric_value === input.metricValue) {
    db.prepare(
      `UPDATE research_observations
       SET window_end = ?, collected_at = ?
       WHERE observation_id = ?`
    ).run(input.at, input.at, previous.observation_id);
    return { observationId: previous.observation_id, created: false, changed: false, measured: input.metricValue !== null };
  }

  const observationId = insertObservation(db, {
    source,
    sourcePlatform,
    surface: input.surface ?? null,
    contentItemId: input.contentItemId ?? null,
    noteId: input.noteId ?? null,
    publishedAt: isoOrNull(input.publishedAt),
    observedAt: input.at,
    capturedAt: input.at,
    privacyClass: "public_metric",
    metricName: input.metricName,
    metricValue: input.metricValue,
    previousValue: previous?.metric_value ?? null,
    delta:
      previous && previous.metric_value !== null && input.metricValue !== null
        ? input.metricValue - previous.metric_value
        : null,
    windowStart: input.at,
    windowEnd: input.at,
    collectedAt: input.at,
    brandId: valid.brandId,
    providerAccountId: valid.providerAccountId,
  });
  return { observationId, created: true, changed: Boolean(previous), measured: input.metricValue !== null };
}

export function writeNoteMetrics(db: Database.Database, note: FetchedNote, at: string, binding: MeasurementBinding): MetricWriteResult[] {
  const metrics: Array<[string, number | undefined]> = [
    ["views", note.views],
    ["likes", note.likes],
    ["restacks", note.reposts],
    ["replies_count", note.replies],
  ];
  return metrics.map(([metricName, value]) => {
    const metricValue = typeof value === "number" && Number.isFinite(value) ? value : null;
    return (
      writeMetricObservation(db, {
        contentItemId: note.noteId,
        noteId: note.noteId,
        surface: "note",
        publishedAt: note.publishedAt,
        metricName,
        metricValue,
        binding,
        at,
      })
    );
  });
}

export function installResearchSchema(db: Database.Database): void {
  // openDb() executes the canonical schema. This helper makes isolated test and probe databases
  // use the same migration path without reaching into the process-global analytics DB.
  db.exec(`
    CREATE TABLE IF NOT EXISTS research_observations (
      observation_id TEXT PRIMARY KEY, source TEXT NOT NULL, source_platform TEXT NOT NULL,
      surface TEXT, content_item_id TEXT, note_id TEXT, reply_id TEXT, parent_reply_id TEXT,
      published_at TEXT, observed_at TEXT NOT NULL, captured_at TEXT NOT NULL,
      respondent_hash TEXT, exact_text TEXT, redacted_text TEXT, follow_up_question TEXT,
      behavioral_action TEXT, is_creator_observation INTEGER NOT NULL DEFAULT 0,
      privacy_class TEXT NOT NULL, post_age_hours REAL, views_at_observation REAL, edited_at TEXT,
      deleted_at TEXT, superseded_by TEXT, metric_name TEXT, metric_value REAL,
      previous_value REAL, delta REAL, window_start TEXT, window_end TEXT, collected_at TEXT,
      brand_id TEXT, provider_account_id TEXT
    );
    CREATE TABLE IF NOT EXISTS research_observation_classifications (
      classification_id TEXT PRIMARY KEY, observation_id TEXT NOT NULL,
      taxonomy_id TEXT NOT NULL, taxonomy_version TEXT NOT NULL, prompt_version TEXT,
      model TEXT, status TEXT NOT NULL, classified_at TEXT, supersedes_classification_id TEXT,
      fields_json TEXT NOT NULL, correction_json TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_test_research_classifications_live
      ON research_observation_classifications(observation_id, taxonomy_id)
      WHERE supersedes_classification_id IS NULL;
  `);
}
