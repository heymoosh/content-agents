import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readQueue, setStatus, stampOrigin, writeCell, storyboardRowStatus, type QueueRow } from "./queue.js";

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

// writeCell — the one write path serve.ts's /api/status handler and setStatus() both funnel
// through, matched by id (not a stale line index) so a caller that only knows the row's id — e.g.
// a REST request body — can still target the right row.

test("writeCell updates status only, leaving notes/origin/every other cell untouched", () => {
  const dir = tmpFolder(
    `| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |\n` +
      `|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|\n` +
      `| x-1 | x | text | derivatives/x-1.md | 4 | 5 | yes | pending | some note | from /cycle |\n` +
      `| x-2 | x | text | derivatives/x-2.md | 4 | 5 | yes | pending | other note | reply to mention |\n`
  );
  const ok = writeCell(dir, "x-1", { status: "approve" });
  assert.equal(ok, true);
  const { rows } = readQueue(dir);
  assert.equal(rows[0].status, "approve");
  assert.equal(rows[0].notes, "some note");
  assert.equal(rows[0].origin, "from /cycle");
  // the other row is untouched
  assert.equal(rows[1].status, "pending");
  assert.equal(rows[1].origin, "reply to mention");
  rmSync(dir, { recursive: true, force: true });
});

test("writeCell updates notes only, leaving status untouched, and escapes pipes/newlines", () => {
  const dir = tmpFolder(
    `| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes |\n` +
      `|----|----------|--------|-------|-------------|------------|-----|--------|-------|\n` +
      `| x-1 | x | text | derivatives/x-1.md | 4 | 5 | yes | pending | old note |\n`
  );
  const ok = writeCell(dir, "x-1", { notes: "line one\nline two | with a pipe" });
  assert.equal(ok, true);
  const { rows } = readQueue(dir);
  assert.equal(rows[0].status, "pending");
  assert.equal(rows[0].notes, "line one line two   with a pipe");
  rmSync(dir, { recursive: true, force: true });
});

test("writeCell updates status and notes together in one pass", () => {
  const dir = tmpFolder(
    `| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |\n` +
      `|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|\n` +
      `| x-1 | x | text | derivatives/x-1.md | 4 | 5 | yes | pending | old note | from GUI queue |\n`
  );
  writeCell(dir, "x-1", { status: "discard", notes: "not on-brand" });
  const { rows } = readQueue(dir);
  assert.equal(rows[0].status, "discard");
  assert.equal(rows[0].notes, "not on-brand");
  assert.equal(rows[0].origin, "from GUI queue");
  rmSync(dir, { recursive: true, force: true });
});

test("writeCell writing back an already-empty notes cell is byte-identical, not two spaces", () => {
  const dir = tmpFolder(
    `| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes |\n` +
      `|----|----------|--------|-------|-------------|------------|-----|--------|-------|\n` +
      `| x-1 | x | text | derivatives/x-1.md | 4 | 5 | yes | published | |\n`
  );
  const before = readFileSync(join(dir, "review-queue.md"), "utf8");
  writeCell(dir, "x-1", { status: "published", notes: "" });
  assert.equal(readFileSync(join(dir, "review-queue.md"), "utf8"), before);
  rmSync(dir, { recursive: true, force: true });
});

test("writeCell returns false and leaves the file untouched when the id doesn't exist", () => {
  const dir = tmpFolder(
    `| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes |\n` +
      `|----|----------|--------|-------|-------------|------------|-----|--------|-------|\n` +
      `| x-1 | x | text | derivatives/x-1.md | 4 | 5 | yes | pending | note |\n`
  );
  const before = readFileSync(join(dir, "review-queue.md"), "utf8");
  const ok = writeCell(dir, "no-such-id", { status: "approve" });
  assert.equal(ok, false);
  assert.equal(readFileSync(join(dir, "review-queue.md"), "utf8"), before);
  rmSync(dir, { recursive: true, force: true });
});

// storyboardRowStatus — the render gate src/video/render.ts checks before any paid generation
// runs, now routed through readQueue instead of its own cells[3]/cells[8] parsing.

test("storyboardRowStatus returns the storyboard row's status", () => {
  const dir = tmpFolder(
    `| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes |\n` +
      `|----|----------|--------|-------|-------------|------------|-----|--------|-------|\n` +
      `| x-1 | x | text | derivatives/x-1.md | 4 | 5 | yes | approve | |\n` +
      `| video-script | video-script | storyboard | — | — | — | — | blocked | drafted |\n`
  );
  assert.equal(storyboardRowStatus(dir), "blocked");
  rmSync(dir, { recursive: true, force: true });
});

test("storyboardRowStatus returns null when there is no storyboard row", () => {
  const dir = tmpFolder(
    `| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes |\n` +
      `|----|----------|--------|-------|-------------|------------|-----|--------|-------|\n` +
      `| x-1 | x | text | derivatives/x-1.md | 4 | 5 | yes | approve | |\n`
  );
  assert.equal(storyboardRowStatus(dir), null);
  rmSync(dir, { recursive: true, force: true });
});

test("storyboardRowStatus returns null when review-queue.md doesn't exist", () => {
  const dir = mkdtempSync(join(tmpdir(), "queue-test-"));
  assert.equal(storyboardRowStatus(dir), null);
  rmSync(dir, { recursive: true, force: true });
});
