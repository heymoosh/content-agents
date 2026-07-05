import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readQueue, setStatus, stampOrigin, type QueueRow } from "./queue.js";

// Origin source-tags (Muxin, 2026-07-04): every row awaiting review carries an origin — one of
// QUEUE_ORIGINS — set at the pipeline that created it. Rows written before this change have no
// origin cell at all; readQueue must leave those `undefined` rather than guess.

function tmpFolder(reviewQueueBody: string): string {
  const dir = mkdtempSync(join(tmpdir(), "queue-test-"));
  writeFileSync(join(dir, "review-queue.md"), reviewQueueBody);
  return dir;
}

test("readQueue parses a valid origin cell", () => {
  const dir = tmpFolder(
    `| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |\n` +
      `|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|\n` +
      `| x-1 | x | text | derivatives/x-1.md | 4 | 5 | yes | pending | | from /cycle |\n`
  );
  const { rows } = readQueue(dir);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].origin, "from /cycle");
  rmSync(dir, { recursive: true, force: true });
});

test("readQueue leaves origin undefined for a legacy row with no origin column", () => {
  const dir = tmpFolder(
    `| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes |\n` +
      `|----|----------|--------|-------|-------------|------------|-----|--------|-------|\n` +
      `| x-1 | x | text | derivatives/x-1.md | 4 | 5 | yes | pending | some note |\n`
  );
  const { rows } = readQueue(dir);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].origin, undefined);
  rmSync(dir, { recursive: true, force: true });
});

test("readQueue never guesses an origin — an unrecognized value is dropped, not passed through", () => {
  const dir = tmpFolder(
    `| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |\n` +
      `|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|\n` +
      `| x-1 | x | text | derivatives/x-1.md | 4 | 5 | yes | pending | | some made-up origin |\n`
  );
  const { rows } = readQueue(dir);
  assert.equal(rows[0].origin, undefined);
  rmSync(dir, { recursive: true, force: true });
});

test("readQueue parses each of the three canonical origins", () => {
  const dir = tmpFolder(
    `| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |\n` +
      `|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|\n` +
      `| a | x | text | a.md | 4 | 5 | yes | pending | | from /cycle |\n` +
      `| b | x | text | b.md | 4 | 5 | yes | pending | | reply to mention |\n` +
      `| c | x | text | c.md | 4 | 5 | yes | pending | | from GUI queue |\n`
  );
  const { rows } = readQueue(dir);
  assert.deepEqual(rows.map((r) => r.origin), ["from /cycle", "reply to mention", "from GUI queue"]);
  rmSync(dir, { recursive: true, force: true });
});

test("setStatus on a row with an origin cell leaves the origin untouched", () => {
  const dir = tmpFolder(
    `| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |\n` +
      `|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|\n` +
      `| x-1 | x | text | derivatives/x-1.md | 4 | 5 | yes | pending | | from GUI queue |\n`
  );
  const before = readQueue(dir).rows[0];
  setStatus(dir, before, "approve");
  const after = readQueue(dir).rows[0];
  assert.equal(after.status, "approve");
  assert.equal(after.origin, "from GUI queue");
  rmSync(dir, { recursive: true, force: true });
});

test("stampOrigin inserts an origin column into a legacy row that has none", () => {
  const dir = tmpFolder(
    `| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes |\n` +
      `|----|----------|--------|-------|-------------|------------|-----|--------|-------|\n` +
      `| x-1 | x | text | derivatives/x-1.md | 4 | 5 | yes | pending | some note |\n`
  );
  stampOrigin(dir, "from GUI queue");
  const row = readQueue(dir).rows[0];
  assert.equal(row.origin, "from GUI queue");
  assert.equal(row.status, "pending");
  assert.equal(row.notes, "some note");
  rmSync(dir, { recursive: true, force: true });
});

test("stampOrigin overwrites whatever origin value a row already carries", () => {
  const dir = tmpFolder(
    `| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |\n` +
      `|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|\n` +
      `| a | x | text | a.md | 4 | 5 | yes | pending | | from /cycle |\n` +
      `| b | x | text | b.md | 4 | 5 | yes | pending | note | some made-up origin |\n`
  );
  stampOrigin(dir, "from GUI queue");
  const { rows } = readQueue(dir);
  assert.deepEqual(rows.map((r) => r.origin), ["from GUI queue", "from GUI queue"]);
  assert.equal(rows[1].notes, "note");
  rmSync(dir, { recursive: true, force: true });
});
