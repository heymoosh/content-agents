/**
 * Unit tests for src/cron/ledger.ts — dedup logic.
 *
 * We use a temp ledger path injected via the optional parameter, so tests never
 * touch data/notes-spread-ledger.jsonl. The temp file is cleaned up in after().
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, existsSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readLedger, appendLedger, LedgerEntry } from "./ledger.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TEST_LEDGER = join(repoRoot, "data", ".notes-spread-ledger-test.jsonl");

const ENTRY_A: LedgerEntry = {
  noteId: "c-already-spread-111",
  url: "https://substack.com/@test/note/c-already-spread-111",
  spreadAt: "2026-06-25T10:00:00.000Z",
  platforms: ["x", "bluesky"],
  contentFolder: "content/2026-06-25-test-note-a",
};

const ENTRY_B: LedgerEntry = {
  noteId: "c-already-spread-222",
  url: "https://substack.com/@test/note/c-already-spread-222",
  spreadAt: "2026-06-24T10:00:00.000Z",
  platforms: ["x"],
  contentFolder: "content/2026-06-24-test-note-b",
};

describe("notes-spread-ledger: dedup logic", () => {
  before(() => {
    // Write two fixture entries to the test ledger
    writeFileSync(
      TEST_LEDGER,
      [JSON.stringify(ENTRY_A), JSON.stringify(ENTRY_B)].join("\n") + "\n"
    );
  });

  after(() => {
    if (existsSync(TEST_LEDGER)) unlinkSync(TEST_LEDGER);
  });

  test("readLedger returns all entries", () => {
    const { entries } = readLedger(TEST_LEDGER);
    assert.equal(entries.length, 2, "should read both ledger entries");
    assert.equal(entries[0].noteId, ENTRY_A.noteId);
    assert.equal(entries[1].noteId, ENTRY_B.noteId);
  });

  test("already-spread note ID is in spreadIds set (dedup check)", () => {
    const { spreadIds } = readLedger(TEST_LEDGER);
    assert.ok(
      spreadIds.has(ENTRY_A.noteId),
      `"${ENTRY_A.noteId}" must be in spreadIds (was already spread)`
    );
    assert.ok(
      spreadIds.has(ENTRY_B.noteId),
      `"${ENTRY_B.noteId}" must be in spreadIds (was already spread)`
    );
  });

  test("new note ID is NOT in spreadIds (would be selected for spreading)", () => {
    const { spreadIds } = readLedger(TEST_LEDGER);
    const newNoteId = "c-brand-new-999";
    assert.ok(
      !spreadIds.has(newNoteId),
      `"${newNoteId}" must not be in spreadIds (has never been spread)`
    );
  });

  test("appendLedger writes a new entry that readLedger picks up", () => {
    const newEntry: LedgerEntry = {
      noteId: "c-newly-spread-333",
      url: "https://substack.com/@test/note/c-newly-spread-333",
      spreadAt: new Date().toISOString(),
      platforms: ["x", "bluesky"],
      contentFolder: "content/2026-06-26-test-note-c",
    };
    appendLedger(newEntry, TEST_LEDGER);

    const { entries, spreadIds } = readLedger(TEST_LEDGER);
    assert.equal(entries.length, 3, "should now have 3 entries after append");
    assert.ok(
      spreadIds.has(newEntry.noteId),
      "newly appended note ID must appear in spreadIds"
    );
  });

  test("empty/missing ledger returns empty sets without throwing", () => {
    const missingPath = join(repoRoot, "data", ".notes-spread-ledger-nonexistent.jsonl");
    const { entries, spreadIds } = readLedger(missingPath);
    assert.equal(entries.length, 0, "empty ledger should have 0 entries");
    assert.equal(spreadIds.size, 0, "empty ledger should have 0 spread IDs");
  });

  test("malformed JSON lines in ledger are skipped gracefully", () => {
    const malformedPath = join(repoRoot, "data", ".notes-spread-ledger-malformed.jsonl");
    writeFileSync(
      malformedPath,
      JSON.stringify(ENTRY_A) + "\n" + "NOT_VALID_JSON\n" + JSON.stringify(ENTRY_B) + "\n"
    );
    try {
      const { entries } = readLedger(malformedPath);
      // Should parse the two valid lines and skip the bad one
      assert.equal(entries.length, 2, "malformed lines should be silently skipped");
    } finally {
      if (existsSync(malformedPath)) unlinkSync(malformedPath);
    }
  });
});
