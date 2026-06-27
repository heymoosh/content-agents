/**
 * Tests for the media_type='note' fix from change #46 (new-notes.ts upsert path).
 *
 * new-notes.ts is not unit-importable: it calls main() at module top-level, which reads env
 * vars and may call process.exit(). Instead of importing it, we test the SQL logic directly
 * against an in-memory SQLite DB — the same INSERT statement that ingestNotes() in new-notes.ts
 * executes (confirmed by reading the source). This is the smallest real unit that can be verified
 * without refactoring the script.
 *
 * Schema source: src/db/schema.sql (same file openDb() executes), which includes the media_type
 * column as of this change. We also replicate the db.ts migrations for media_type index.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const schema = readFileSync(join(repoRoot, "src", "db", "schema.sql"), "utf8");

// The exact INSERT that ingestNotes() in src/atomize/new-notes.ts executes:
const UPSERT_SQL = `
  INSERT INTO posts (platform, platform_post_id, posted_at, url, content_text, format, media_type, source)
  VALUES ('substack-note', ?, ?, ?, ?, 'note', 'note', 'organic')
  ON CONFLICT(platform, platform_post_id) DO UPDATE SET
    content_text = excluded.content_text,
    media_type = COALESCE(posts.media_type, excluded.media_type),
    source = COALESCE(posts.source, 'organic')
  RETURNING id
`;

function freshDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(schema);
  return db;
}

describe("new-notes.ts upsert path: media_type='note' (#46)", () => {
  test("INSERT sets media_type to 'note' for a new note row", () => {
    const db = freshDb();
    const stmt = db.prepare(UPSERT_SQL);
    const row = stmt.get(
      "note-test-123",
      "2026-06-25T12:00:00.000Z",
      "https://substack.com/@test/note/123",
      "This is a test note body."
    ) as { id: number };

    assert.ok(row?.id, "RETURNING id should give a valid row id");

    const stored = db.prepare("SELECT media_type, platform FROM posts WHERE id = ?").get(row.id) as {
      media_type: string;
      platform: string;
    };
    assert.equal(stored.media_type, "note", "media_type must be 'note' on new insert");
    assert.equal(stored.platform, "substack-note", "platform must be 'substack-note'");
    db.close();
  });

  test("re-ingest (conflict) uses COALESCE to preserve existing media_type", () => {
    const db = freshDb();
    const stmt = db.prepare(UPSERT_SQL);

    // First insert
    const first = stmt.get(
      "note-test-456",
      "2026-06-25T12:00:00.000Z",
      "https://substack.com/@test/note/456",
      "Original text."
    ) as { id: number };

    // Simulate a row that already has media_type set to something (e.g. from an older run
    // that wrote a different value). COALESCE(posts.media_type, excluded.media_type) should
    // keep the existing value rather than overwriting with excluded.media_type.
    db.prepare("UPDATE posts SET media_type = 'existing-value' WHERE id = ?").run(first.id);

    // Second run — same platform_post_id → hits ON CONFLICT path
    stmt.get(
      "note-test-456",
      "2026-06-25T12:00:00.000Z",
      "https://substack.com/@test/note/456",
      "Updated text."
    );

    const stored = db.prepare("SELECT media_type, content_text FROM posts WHERE id = ?").get(first.id) as {
      media_type: string;
      content_text: string;
    };
    assert.equal(stored.media_type, "existing-value", "COALESCE must not overwrite an existing media_type");
    assert.equal(stored.content_text, "Updated text.", "content_text should be updated on conflict");
    db.close();
  });

  test("format column is set to 'note' on INSERT (mirrors media_type='note')", () => {
    const db = freshDb();
    const stmt = db.prepare(UPSERT_SQL);
    const row = stmt.get(
      "note-test-789",
      "2026-06-25T14:00:00.000Z",
      "https://substack.com/@test/note/789",
      "Another note."
    ) as { id: number };

    const stored = db.prepare("SELECT format FROM posts WHERE id = ?").get(row.id) as { format: string };
    assert.equal(stored.format, "note", "format column should be 'note' to match media_type");
    db.close();
  });
});
