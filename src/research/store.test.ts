import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {
  installResearchSchema,
  reconcileReplyObservations,
  respondentHash,
  writeMetricObservation,
  writeNoteMetrics,
  type ReconciliationResult,
} from "./store.js";
import type { FetchedNote } from "../atomize/fetch-notes.js";
import type { FetchedReply } from "./substack/replies.js";

const dbs: Database.Database[] = [];
const originalKey = process.env.RESEARCH_HASH_KEY;
const BINDING = { brandId: "human-inference", providerAccountId: "human-inference/substack" } as const;

afterEach(() => {
  for (const db of dbs.splice(0)) db.close();
  if (originalKey === undefined) delete process.env.RESEARCH_HASH_KEY;
  else process.env.RESEARCH_HASH_KEY = originalKey;
});

function db(): Database.Database {
  const value = new Database(":memory:");
  installResearchSchema(value);
  dbs.push(value);
  return value;
}

const note: FetchedNote = {
  noteId: "c-1",
  url: "https://substack.com/@muxin/note/c-1",
  publishedAt: "2026-08-01T00:00:00.000Z",
  text: "A Note",
  likes: 0,
  reposts: 0,
  replies: 0,
  views: 0,
};

function reply(body: string, editedAt: string | null = null): FetchedReply {
  return {
    replyId: "10",
    userId: "99",
    body,
    publishedAt: "2026-08-01T01:00:00.000Z",
    editedAt,
    parentReplyId: null,
    raw: { body },
  };
}

test("respondent hashes are keyed and fail closed without the local key", () => {
  assert.notEqual(respondentHash("substack", 99, "key-a"), respondentHash("substack", 99, "key-b"));
  delete process.env.RESEARCH_HASH_KEY;
  assert.throws(() => respondentHash("substack", 99), /RESEARCH_HASH_KEY/);
});

test("reply reconciliation is idempotent, append-only for edits, and tombstones only complete absences", () => {
  const value = db();
  const key = "test-only-research-key";
  const first = reconcileReplyObservations(value, note, [reply("first")], "complete", "2026-08-02T00:00:00Z", key, BINDING);
  assert.deepEqual(first, {
    newObservations: 1,
    changedObservations: 0,
    unchangedObservations: 0,
    tombstonedObservations: 0,
  } satisfies ReconciliationResult);
  const unchanged = reconcileReplyObservations(value, note, [reply("first")], "complete", "2026-08-02T01:00:00Z", key, BINDING);
  assert.equal(unchanged.unchangedObservations, 1);
  assert.equal((value.prepare("SELECT COUNT(*) AS count FROM research_observations").get() as { count: number }).count, 1);

  const edited = reconcileReplyObservations(
    value,
    note,
    [reply("edited", "2026-08-02T02:00:00Z")],
    "complete",
    "2026-08-02T03:00:00Z",
    key,
    BINDING,
  );
  assert.equal(edited.changedObservations, 1);
  const rows = value.prepare("SELECT observation_id, exact_text, superseded_by FROM research_observations ORDER BY rowid").all() as {
    observation_id: string;
    exact_text: string;
    superseded_by: string | null;
  }[];
  assert.equal(rows.length, 2);
  assert.equal(rows[0].exact_text, "first");
  assert.equal(rows[0].superseded_by, rows[1].observation_id);

  const partial = reconcileReplyObservations(value, note, [], "partial", "2026-08-02T04:00:00Z", key, BINDING);
  assert.equal(partial.tombstonedObservations, 0);
  const complete = reconcileReplyObservations(value, note, [], "complete", "2026-08-02T05:00:00Z", key, BINDING);
  assert.equal(complete.tombstonedObservations, 1);
  const current = value.prepare("SELECT deleted_at FROM research_observations WHERE superseded_by IS NULL").get() as { deleted_at: string | null };
  assert.ok(current.deleted_at);
});

test("reply observations identify creator replies when the Note author is known", () => {
  const value = db();
  const creatorNote = { ...note, authorUserId: "99" };
  reconcileReplyObservations(value, creatorNote, [reply("creator reply")], "complete", "2026-08-02T00:00:00Z", "test-key", BINDING);

  const row = value.prepare("SELECT is_creator_observation FROM research_observations WHERE source = 'reply'").get() as {
    is_creator_observation: number;
  };
  assert.equal(row.is_creator_observation, 1);
});

test("metric observations preserve measured zeroes and only append when values change", () => {
  const value = db();
  const first = writeNoteMetrics(value, note, "2026-08-02T00:00:00Z", BINDING);
  assert.equal(first.length, 4);
  assert.equal((value.prepare("SELECT COUNT(*) AS count FROM research_observations WHERE source = 'metric'").get() as { count: number }).count, 4);
  assert.equal(
    (value.prepare("SELECT metric_value FROM research_observations WHERE metric_name = 'replies_count'").get() as { metric_value: number }).metric_value,
    0
  );

  writeNoteMetrics(value, note, "2026-08-03T00:00:00Z", BINDING);
  assert.equal((value.prepare("SELECT COUNT(*) AS count FROM research_observations WHERE source = 'metric'").get() as { count: number }).count, 4);
  const changed = writeMetricObservation(value, {
    contentItemId: note.noteId,
    noteId: note.noteId,
    surface: "note",
    metricName: "likes",
    metricValue: 2,
    at: "2026-08-04T00:00:00Z",
    binding: BINDING,
  });
  assert.equal(changed.changed, true);
  assert.equal((value.prepare("SELECT COUNT(*) AS count FROM research_observations WHERE metric_name = 'likes'").get() as { count: number }).count, 2);
  const latest = value.prepare("SELECT previous_value, delta FROM research_observations WHERE metric_name = 'likes' ORDER BY rowid DESC LIMIT 1").get() as {
    previous_value: number;
    delta: number;
  };
  assert.equal(latest.previous_value, 0);
  assert.equal(latest.delta, 2);
});
