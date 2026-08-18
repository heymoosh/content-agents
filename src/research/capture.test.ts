import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runResearchCapture } from "./capture.js";
import { installResearchSchema } from "./store.js";
import type { FetchedNote } from "../atomize/fetch-notes.js";

const dirs: string[] = [];
const dbs: Database.Database[] = [];

afterEach(() => {
  for (const db of dbs.splice(0)) db.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function response(body: unknown, status = 200) {
  return {
    ok: () => status >= 200 && status < 300,
    status: () => status,
    json: async () => body,
  };
}

const note: FetchedNote = {
  noteId: "c-1",
  url: "https://substack.com/@muxin/note/c-1",
  publishedAt: "2026-08-01T00:00:00.000Z",
  text: "A Note",
  likes: 1,
  reposts: 2,
  replies: 1,
  views: 10,
  raw: { entity_key: "c-1", comment: { id: 1, body: "A Note" } },
};

function newDb() {
  const db = new Database(":memory:");
  installResearchSchema(db);
  dbs.push(db);
  return db;
}

function newDir() {
  const dir = mkdtempSync(join(tmpdir(), "research-capture-test-"));
  dirs.push(dir);
  return dir;
}

function launchContext(calls: { count: number }) {
  return async () => ({
    request: {
      get: async () => {
        calls.count++;
        return response({
          commentBranches: [{ comment: { id: 10, user_id: 99, body: "A reply", date: "2026-08-01T01:00:00Z" } }],
          moreBranches: 0,
        });
      },
    },
    close: async () => undefined,
  });
}

test("backfill checkpoints raw capture and ledger state, then resumes without refetching complete Notes", async () => {
  const db = newDb();
  const dir = newDir();
  const paths = {
    ledger: join(dir, "ledger.jsonl"),
    raw: join(dir, "raw"),
    coverage: join(dir, "coverage.jsonl"),
  };
  const calls = { count: 0 };
  const options = {
    mode: "backfill" as const,
    handle: "muxin",
    db,
    key: "test-key",
    now: () => new Date("2026-08-02T00:00:00Z"),
    fetchNotes: async () => [note],
    launchContext: launchContext(calls),
    ...{ ledgerPath: paths.ledger, rawNotesDir: paths.raw, coveragePath: paths.coverage },
  };

  const first = await runResearchCapture(options);
  assert.equal(first.notesComplete, 1);
  assert.equal(first.replyObservationsCreated, 1);
  assert.equal(first.metricObservationsCreated, 4);
  assert.equal(calls.count, 1);
  assert.equal(JSON.parse(readFileSync(join(paths.raw, "c-1.json"), "utf8")).reply_observation_count_captured, 1);
  assert.match(readFileSync(paths.ledger, "utf8"), /"completeness":"complete"/);
  assert.equal(first.coverage.find((row) => row.source === "essay_comment")?.status, "unavailable");

  const second = await runResearchCapture(options);
  assert.equal(second.notesSelected, 0);
  assert.equal(calls.count, 1);
  assert.equal((db.prepare("SELECT COUNT(*) AS count FROM research_observations").get() as { count: number }).count, 5);
});

test("a forbidden reply walk reports an error and never marks the Note complete", async () => {
  const db = newDb();
  const dir = newDir();
  const calls = { count: 0 };
  const result = await runResearchCapture({
    mode: "sync",
    handle: "muxin",
    db,
    key: "test-key",
    now: () => new Date("2026-08-02T00:00:00Z"),
    fetchNotes: async () => [note],
    launchContext: async () => ({
      request: {
        get: async () => {
          calls.count++;
          return response({}, 403);
        },
      },
      close: async () => undefined,
    }),
    ledgerPath: join(dir, "ledger.jsonl"),
    rawNotesDir: join(dir, "raw"),
    coveragePath: join(dir, "coverage.jsonl"),
  });

  assert.equal(calls.count, 1);
  assert.equal(result.notesErrored, 1);
  assert.equal(result.notesComplete, 0);
  assert.equal(result.coverage.find((row) => row.source === "note_reply")?.status, "partial");
});
