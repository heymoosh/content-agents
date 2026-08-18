import "../util/env.js";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { BrowserContext } from "playwright";
import { fetchAllSubstackNotes, fetchSubstackNotes, type FetchedNote } from "../atomize/fetch-notes.js";
import { launchPlatform } from "../pull/browser.js";
import { repoRoot, openDb } from "../db/db.js";
import { fetchSubstackReplyTree, ReplyTreeError, type AuthenticatedRequestContext } from "./substack/replies.js";
import {
  reconcileReplyObservations,
  requireResearchHashKey,
  writeMetricObservation,
  writeNoteMetrics,
} from "./store.js";
import { appendResearchLedger, readResearchLedger, shouldCheckNote, type NoteCompleteness, type SubstackNotesLedgerEntry } from "./ledger.js";

export const RESEARCH_DIR = join(repoRoot, "data", "research");
export const RAW_NOTES_DIR = join(RESEARCH_DIR, "substack-notes");
export const LEDGER_PATH = join(RESEARCH_DIR, "substack-notes-ledger.jsonl");
export const COVERAGE_PATH = join(RESEARCH_DIR, "substack-notes-coverage.jsonl");

export type CaptureMode = "backfill" | "sync";

export interface CoverageRecord {
  source: "note_reply" | "essay_comment" | "metric" | "subscriber_movement" | "dm" | "email" | "follow_up_question" | "creator_observation";
  window_start: string;
  window_end: string;
  status: "complete" | "partial" | "unavailable" | "not_checked";
  records_captured: number;
  gap_reason: string | null;
}

export interface CaptureRunResult {
  mode: CaptureMode;
  notesEnumerated: number;
  notesSelected: number;
  notesComplete: number;
  notesPartial: number;
  notesErrored: number;
  replyObservationsCreated: number;
  replyObservationsChanged: number;
  metricObservationsCreated: number;
  coverage: CoverageRecord[];
}

interface CaptureRequestContext extends AuthenticatedRequestContext {
  close?: () => Promise<void>;
}

export interface CaptureRunOptions {
  mode: CaptureMode;
  handle: string;
  db?: ReturnType<typeof openDb>;
  now?: () => Date;
  limit?: number;
  key?: string;
  ledgerPath?: string;
  rawNotesDir?: string;
  coveragePath?: string;
  fetchNotes?: (handle: string, limit?: number) => Promise<FetchedNote[]>;
  launchContext?: () => Promise<CaptureRequestContext>;
  sleep?: (milliseconds: number) => Promise<void>;
  politenessDelayMs?: number;
}

function writeRawCapture(dir: string, note: FetchedNote, value: unknown): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${note.noteId}.json`);
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
  return path;
}

function latestActivity(replies: Array<{ publishedAt: string | null }>, fallback: string | null): string | null {
  const values = replies
    .map((reply) => (reply.publishedAt ? new Date(reply.publishedAt).getTime() : Number.NaN))
    .filter(Number.isFinite);
  if (values.length === 0) return fallback;
  return new Date(Math.max(...values)).toISOString();
}

function errorCode(error: unknown): string {
  if (error instanceof ReplyTreeError) return `reply_tree_${error.kind.toLowerCase()}`;
  return "reply_tree_fetch_failed";
}

function appendCoverage(path: string, coverage: CoverageRecord[], runAt: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "", { flag: "a", mode: 0o600 });
  const lines = coverage.map((record) => JSON.stringify({ run_at: runAt, ...record })).join("\n");
  if (lines) writeFileSync(path, lines + "\n", { flag: "a", mode: 0o600 });
}

function noteCompletenessStatus(statuses: NoteCompleteness[], selected: number): CoverageRecord["status"] {
  if (selected === 0 || (statuses.length === selected && statuses.every((status) => status === "complete"))) return "complete";
  return "partial";
}

function noteLedgerEntry(
  note: FetchedNote,
  previous: SubstackNotesLedgerEntry | undefined,
  at: string,
  completeness: NoteCompleteness,
  branchCount: number,
  observationCount: number,
  lastActivity: string | null,
  rawPath: string | null,
  lastError: string | null
): SubstackNotesLedgerEntry {
  return {
    note_id: note.noteId,
    first_seen_at: previous?.first_seen_at ?? at,
    last_checked_at: at,
    last_activity_at: lastActivity ?? previous?.last_activity_at ?? null,
    reply_branch_count_reported: note.replies,
    reply_branch_count_captured: branchCount,
    reply_observation_count_captured: observationCount,
    completeness,
    cursor_or_etag: null,
    last_error: lastError,
    raw_capture_path: rawPath,
  };
}

function emptyCoverage(windowStart: string, windowEnd: string): CoverageRecord[] {
  return [
    { source: "essay_comment", window_start: windowStart, window_end: windowEnd, status: "unavailable", records_captured: 0, gap_reason: "endpoint not discovered; Notes-only in v1" },
    { source: "dm", window_start: windowStart, window_end: windowEnd, status: "not_checked", records_captured: 0, gap_reason: "manual entry is outside this pipeline" },
    { source: "email", window_start: windowStart, window_end: windowEnd, status: "not_checked", records_captured: 0, gap_reason: "manual entry is outside this pipeline" },
    { source: "follow_up_question", window_start: windowStart, window_end: windowEnd, status: "not_checked", records_captured: 0, gap_reason: "manual entry is outside this pipeline" },
    { source: "creator_observation", window_start: windowStart, window_end: windowEnd, status: "not_checked", records_captured: 0, gap_reason: "manual entry is outside this pipeline" },
  ];
}

export async function runResearchCapture(options: CaptureRunOptions): Promise<CaptureRunResult> {
  const hashKey = options.key ?? requireResearchHashKey();
  requireResearchHashKey(hashKey);
  const now = options.now ?? (() => new Date());
  const ledgerPath = options.ledgerPath ?? LEDGER_PATH;
  const rawNotesDir = options.rawNotesDir ?? RAW_NOTES_DIR;
  const coveragePath = options.coveragePath ?? COVERAGE_PATH;
  const ledger = readResearchLedger(ledgerPath);
  const startedAt = now().toISOString();
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const politenessDelayMs = options.politenessDelayMs ?? 250;
  const fetchedNotes = options.fetchNotes
    ? await options.fetchNotes(options.handle, options.limit)
    : options.limit === undefined
      ? await fetchAllSubstackNotes(options.handle, { delayMs: politenessDelayMs, sleep })
      : await fetchSubstackNotes(options.handle, {
        limit: options.limit,
        maxPages: Number.POSITIVE_INFINITY,
        delayMs: politenessDelayMs,
        sleep,
      });
  const notes = options.limit === undefined ? fetchedNotes : fetchedNotes.slice(0, options.limit);
  const db = options.db ?? openDb();
  const shouldCloseDb = !options.db;
  const selected = notes.filter((note) => {
    const previous = ledger.get(note.noteId);
    if (options.mode === "backfill") {
      return !(previous?.completeness === "complete" && previous.raw_capture_path && existsSync(previous.raw_capture_path));
    }
    return shouldCheckNote(note, previous, now());
  });

  const statuses: NoteCompleteness[] = [];
  let replyObservationsCreated = 0;
  let replyObservationsChanged = 0;
  let metricObservationsCreated = 0;
  let capturedReplyObservations = 0;
  let metricRows = 0;
  let metricGap = false;
  let subscriberRows = 0;
  let context: CaptureRequestContext | undefined;
  let contextError: unknown;
  let consecutiveForbidden = 0;
  let failureStreak = 0;
  try {
    if (selected.length > 0) {
      try {
        context = await (options.launchContext ?? (() => launchPlatform("substack")))();
      } catch (error) {
        contextError = error;
      }
    }

    for (const note of selected) {
      if (consecutiveForbidden >= 3) break;
      const at = now().toISOString();
      const previous = ledger.get(note.noteId);
      let completeness: NoteCompleteness = "error";
      let branchCount = 0;
      let observationCount = 0;
      let lastActivity = previous?.last_activity_at ?? note.publishedAt;
      let rawPath: string | null = null;
      let lastError: string | null = null;
      try {
        const metricWrites = writeNoteMetrics(db, note, at);
        metricRows += metricWrites.length;
        metricObservationsCreated += metricWrites.filter((write) => write.created).length;
        if (metricWrites.length < 4 || metricWrites.some((write) => !write.measured)) metricGap = true;

        if (contextError) throw new Error("authenticated Substack request context unavailable");
        const tree = await fetchSubstackReplyTree(note.noteId, context!, {
          delayMs: politenessDelayMs,
          sleep,
        });
        branchCount = tree.replyBranchCountCaptured;
        observationCount = tree.replyObservationCountCaptured;
        completeness = branchCount === note.replies ? "complete" : "partial";
        const reconciliation = reconcileReplyObservations(db, note, tree.flattenedReplies, completeness, at, hashKey);
        replyObservationsCreated += reconciliation.newObservations;
        replyObservationsChanged += reconciliation.changedObservations;
        capturedReplyObservations += observationCount;
        lastActivity = latestActivity(tree.flattenedReplies, lastActivity);
        rawPath = writeRawCapture(rawNotesDir, note, {
          captured_at: at,
          note: note.raw ?? note,
          reply_tree_pages: tree.rawPages,
          reply_branch_count_reported: note.replies,
          reply_branch_count_captured: branchCount,
          reply_observation_count_captured: observationCount,
        });
        if (completeness === "partial") lastError = "reply branch count did not reconcile";
        consecutiveForbidden = 0;
        failureStreak = 0;
      } catch (error) {
        completeness = error instanceof ReplyTreeError && error.kind === "PARTIAL_RESULT" ? "partial" : "error";
        lastError = errorCode(error);
        rawPath = writeRawCapture(rawNotesDir, note, {
          captured_at: at,
          note: note.raw ?? note,
          reply_tree_pages: [],
          reply_branch_count_reported: note.replies,
          reply_branch_count_captured: branchCount,
          reply_observation_count_captured: observationCount,
          capture_error: lastError,
        });
        failureStreak++;
        if (error instanceof ReplyTreeError && error.kind === "FORBIDDEN") consecutiveForbidden++;
        if (failureStreak > 1) await sleep(Math.min(30_000, politenessDelayMs * 2 ** Math.min(failureStreak - 1, 6)));
      }
      statuses.push(completeness);
      appendResearchLedger(
        ledgerPath,
        noteLedgerEntry(note, previous, at, completeness, branchCount, observationCount, lastActivity, rawPath, lastError)
      );
      ledger.set(note.noteId, noteLedgerEntry(note, previous, at, completeness, branchCount, observationCount, lastActivity, rawPath, lastError));
      if (politenessDelayMs > 0) await sleep(politenessDelayMs);
    }

    const subscriberTotal = fetchedNotes.find((note) => typeof note.subscriberTotal === "number")?.subscriberTotal;
    if (typeof subscriberTotal === "number") {
      const total = writeMetricObservation(db, {
        source: "subscriber_movement",
        metricName: "subscribers_total",
        metricValue: subscriberTotal,
        at: now().toISOString(),
      });
      subscriberRows += 1;
      if (total.created) metricObservationsCreated += 1;
      const previousTotal = db
        .prepare(
          `SELECT metric_value FROM research_observations
           WHERE source = 'subscriber_movement' AND metric_name = 'subscribers_total'
           ORDER BY collected_at DESC, rowid DESC LIMIT 2`
        )
        .all() as { metric_value: number }[];
      if (previousTotal.length > 1) {
        const delta = writeMetricObservation(db, {
          source: "subscriber_movement",
          metricName: "subscribers_delta",
          metricValue: subscriberTotal - previousTotal[1].metric_value,
          at: now().toISOString(),
        });
        subscriberRows += 1;
        if (delta.created) metricObservationsCreated += 1;
      }
    }
  } finally {
    await context?.close?.();
    if (shouldCloseDb) db.close();
  }

  const endedAt = now().toISOString();
  const coverage: CoverageRecord[] = [
    {
      source: "note_reply",
      window_start: startedAt,
      window_end: endedAt,
      status: noteCompletenessStatus(statuses, selected.length),
      records_captured: capturedReplyObservations,
      gap_reason: statuses.some((status) => status !== "complete") ? "one or more Note reply trees were not complete" : null,
    },
    {
      source: "metric",
      window_start: startedAt,
      window_end: endedAt,
      status: metricGap ? "partial" : "complete",
      records_captured: metricRows,
      gap_reason: metricGap ? "the public feed did not return every required Note metric" : null,
    },
    {
      source: "subscriber_movement",
      window_start: startedAt,
      window_end: endedAt,
      status: subscriberRows > 0 ? "complete" : "unavailable",
      records_captured: subscriberRows,
      gap_reason: subscriberRows > 0 ? null : "public profile did not return subscriber count",
    },
    ...emptyCoverage(startedAt, endedAt),
  ];
  appendCoverage(coveragePath, coverage, endedAt);
  if (shouldCloseDb) {
    // The database was closed in the finally block. This branch keeps the ownership decision
    // explicit at the call site and avoids accidentally closing an injected test database.
  }
  return {
    mode: options.mode,
    notesEnumerated: fetchedNotes.length,
    notesSelected: selected.length,
    notesComplete: statuses.filter((status) => status === "complete").length,
    notesPartial: statuses.filter((status) => status === "partial").length,
    notesErrored: statuses.filter((status) => status === "error").length,
    replyObservationsCreated,
    replyObservationsChanged,
    metricObservationsCreated,
    coverage,
  };
}
