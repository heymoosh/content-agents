import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { basename, join, dirname } from "node:path";
import { tmpdir } from "node:os";
import {
  readQueue,
  setStatus,
  stampOrigin,
  writeCell,
  storyboardRowStatus,
  appendRow,
  appendRows,
  appendBetPlacement,
  cutRowId,
  rowLens,
  type QueueRow,
} from "./queue.js";
import { approvalDispatchDisposition, journalPathForLedger } from "../review/approval-provenance.js";

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

// The continue path is the other half of the same function. It re-stamps a folder that also holds
// rows from earlier runs, so unlike the new-folder path above it fills only the empty cells.
test("stampOrigin with preserveExisting keeps a recorded origin and fills only missing values", () => {
  const dir = tmpFolder(
    `| id | platform | format | asset | native | brand | cta | status | notes | origin |\n` +
      `|---|---|---|---|---|---|---|---|---|---|\n` +
      `| x-1 | x | text | derivatives/x-1.md | — | — | — | pending | | from /cycle |\n` +
      `| x-2 | x | text | derivatives/x-2.md | — | — | — | pending | | |\n`,
  );
  mkdirSync(join(dir, "derivatives"));
  writeFileSync(join(dir, "derivatives", "x-1.md"), "Existing derivative.\n");
  writeFileSync(join(dir, "derivatives", "x-2.md"), "New derivative.\n");
  const journal = journalPathForLedger(join(dir, "publishing-status.jsonl"));
  stampOrigin(dir, "from GUI queue", { journalPath: journal, preserveExisting: true });
  assert.deepEqual(readQueue(dir).rows.map((row) => row.origin), ["from /cycle", "from GUI queue"]);
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

// appendRow — the "Duplicate to platform" GUI action's write path (src/review/jobs.ts
// duplicateToPlatform): a brand-new row for a brand-new derivative, appended deterministically by
// the server rather than trusting the Claude subprocess to also hand-edit the queue table.

test("appendRow adds a full 10-column row that readQueue parses back correctly", () => {
  const dir = tmpFolder(
    `| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |\n` +
      `|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|\n` +
      `| x-1 | x | text | derivatives/x-1.md | 4 | 5 | yes | pending | | from /cycle |\n`
  );
  appendRow(dir, {
    id: "linkedin-2",
    platform: "linkedin",
    format: "text",
    asset: "derivatives/linkedin-2.md",
    status: "pending",
    notes: "duplicated from x-1 for linkedin",
    origin: "from GUI queue",
  });
  const { rows } = readQueue(dir);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, "x-1"); // untouched
  const added = rows[1];
  assert.equal(added.id, "linkedin-2");
  assert.equal(added.platform, "linkedin");
  assert.equal(added.format, "text");
  assert.equal(added.asset, "derivatives/linkedin-2.md");
  assert.equal(added.status, "pending");
  assert.equal(added.notes, "duplicated from x-1 for linkedin");
  assert.equal(added.origin, "from GUI queue");
  rmSync(dir, { recursive: true, force: true });
});

test("appendRow onto a legacy 9-column table (no origin header) still parses, origin undefined only if omitted", () => {
  const dir = tmpFolder(
    `| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes |\n` +
      `|----|----------|--------|-------|-------------|------------|-----|--------|-------|\n` +
      `| x-1 | x | text | derivatives/x-1.md | 4 | 5 | yes | pending | old note |\n`
  );
  appendRow(dir, { id: "bluesky-1", platform: "bluesky", format: "text", asset: "derivatives/bluesky-1.md", status: "pending" });
  const { rows } = readQueue(dir);
  assert.equal(rows.length, 2);
  assert.equal(rows[1].id, "bluesky-1");
  assert.equal(rows[1].notes, "");
  assert.equal(rows[1].origin, undefined); // no origin passed
  rmSync(dir, { recursive: true, force: true });
});

test("appendRow leaves every existing row byte-identical (no rewrite of prior lines)", () => {
  const dir = tmpFolder(
    `| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |\n` +
      `|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|\n` +
      `| x-1 | x | text | derivatives/x-1.md | 4 | 5 | yes | approve | | from /cycle |\n`
  );
  const before = readFileSync(join(dir, "review-queue.md"), "utf8");
  appendRow(dir, { id: "x-2", platform: "x", format: "text", asset: "derivatives/x-2.md", status: "pending", origin: "from GUI queue" });
  const after = readFileSync(join(dir, "review-queue.md"), "utf8");
  assert.ok(after.startsWith(before.replace(/\n*$/, "\n")));
  rmSync(dir, { recursive: true, force: true });
});

test("appendRow strips stray pipes/newlines out of notes so column boundaries can't shift", () => {
  const dir = tmpFolder(
    `| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |\n` +
      `|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|\n`
  );
  appendRow(dir, {
    id: "x-1", platform: "x", format: "text", asset: "derivatives/x-1.md", status: "pending",
    notes: "line one\nline two | with a pipe",
  });
  const { rows } = readQueue(dir);
  assert.equal(rows[0].notes, "line one line two   with a pipe");
  rmSync(dir, { recursive: true, force: true });
});

test("appendRow and appendRows both record created provenance for completed assets", () => {
  for (const append of [
    (folder: string, journal: string) => appendRow(folder, { id: "x-1", platform: "x", format: "text", asset: "derivatives/x-1.md", status: "pending" }, journal),
    (folder: string, journal: string) => appendRows(folder, [{ id: "x-1", platform: "x", format: "text", asset: "derivatives/x-1.md", status: "pending" }], journal),
  ]) {
    const dir = tmpFolder("| id | platform | format | asset | native | brand | cta | status | notes | origin |\n|---|---|---|---|---|---|---|---|---|---|\n");
    const journal = journalPathForLedger(join(dir, "publishing-status.jsonl"));
    const derivativeDir = join(dir, "derivatives");
    mkdirSync(derivativeDir);
    writeFileSync(join(derivativeDir, "x-1.md"), "A completed derivative.\n");
    append(dir, journal);
    const event = JSON.parse(readFileSync(journal, "utf8")) as { kind?: string; rowId?: string };
    assert.deepEqual({ kind: event.kind, rowId: event.rowId }, { kind: "created", rowId: "x-1" });
    rmSync(dir, { recursive: true, force: true });
  }
});

test("stampOrigin records created provenance for rows produced by a new-folder GUI atomize run", () => {
  const dir = tmpFolder("| id | platform | format | asset | native | brand | cta | status | notes | origin |\n|---|---|---|---|---|---|---|---|---|---|\n| x-1 | x | text | derivatives/x-1.md | — | — | — | pending | | |\n");
  mkdirSync(join(dir, "derivatives"));
  writeFileSync(join(dir, "derivatives", "x-1.md"), "A completed subprocess derivative.\n");
  const journal = journalPathForLedger(join(dir, "publishing-status.jsonl"));
  stampOrigin(dir, "from GUI queue", { journalPath: journal });
  const event = JSON.parse(readFileSync(journal, "utf8")) as { kind?: string; rowId?: string };
  assert.deepEqual({ kind: event.kind, rowId: event.rowId }, { kind: "created", rowId: "x-1" });
  rmSync(dir, { recursive: true, force: true });
});

test("stampOrigin is idempotent for a folder whose rows already have creation provenance", () => {
  const dir = tmpFolder("| id | platform | format | asset | native | brand | cta | status | notes | origin |\n|---|---|---|---|---|---|---|---|---|---|\n| x-1 | x | text | derivatives/x-1.md | — | — | — | pending | | |\n");
  mkdirSync(join(dir, "derivatives"));
  writeFileSync(join(dir, "derivatives", "x-1.md"), "A completed subprocess derivative.\n");
  const journal = journalPathForLedger(join(dir, "publishing-status.jsonl"));
  stampOrigin(dir, "from GUI queue", { journalPath: journal });
  const before = readFileSync(journal, "utf8");
  assert.doesNotThrow(() => stampOrigin(dir, "from GUI queue", { journalPath: journal }));
  assert.equal(readFileSync(journal, "utf8"), before);
  rmSync(dir, { recursive: true, force: true });
});

test("stampOrigin records a later row while preserving a previously recorded row", () => {
  const dir = tmpFolder("| id | platform | format | asset | native | brand | cta | status | notes | origin |\n|---|---|---|---|---|---|---|---|---|---|\n| x-1 | x | text | derivatives/x-1.md | — | — | — | pending | | |\n");
  mkdirSync(join(dir, "derivatives"));
  writeFileSync(join(dir, "derivatives", "x-1.md"), "First completed derivative.\n");
  const journal = journalPathForLedger(join(dir, "publishing-status.jsonl"));
  stampOrigin(dir, "from GUI queue", { journalPath: journal });
  writeFileSync(join(dir, "derivatives", "x-2.md"), "Second completed derivative.\n");
  writeFileSync(join(dir, "review-queue.md"), readFileSync(join(dir, "review-queue.md"), "utf8") + "| x-2 | x | text | derivatives/x-2.md | — | — | — | pending | | |\n");
  stampOrigin(dir, "from GUI queue", { journalPath: journal });
  const created = readFileSync(journal, "utf8").trim().split("\n").map((line) => JSON.parse(line) as { kind: string; rowId: string });
  assert.deepEqual(created.map(({ kind, rowId }) => ({ kind, rowId })), [
    { kind: "created", rowId: "x-1" },
    { kind: "created", rowId: "x-2" },
  ]);
  rmSync(dir, { recursive: true, force: true });
});

// Regression (SLICE-6X repair round 6): stampOrigin rescans the WHOLE folder, and since the
// continue-run wiring it runs over folders holding rows from earlier runs. A denylist that skipped
// only `approve` still minted a creation event for a legacy `published` row, which both stripped
// that row of its one recovery path (adoptApprovedQueueRow needs zero prior events) and let a
// later re-approval dispatch already-published content a second time. Only a creatable status may
// be granted creation provenance.
function createdRowIds(journal: string): string[] {
  if (!existsSync(journal)) return [];
  return readFileSync(journal, "utf8").trim().split("\n").filter(Boolean)
    .map((line) => JSON.parse(line) as { kind: string; rowId: string })
    .filter((event) => event.kind === "created")
    .map((event) => event.rowId);
}

for (const settled of ["published", "discard"]) {
  test(`stampOrigin records no creation provenance for a legacy ${settled} row, which stays adoptable`, () => {
    const dir = tmpFolder(`| id | platform | format | asset | native | brand | cta | status | notes | origin |\n|---|---|---|---|---|---|---|---|---|---|\n| x-1 | x | text | derivatives/x-1.md | — | — | — | ${settled} | | |\n`);
    mkdirSync(join(dir, "derivatives"));
    writeFileSync(join(dir, "derivatives", "x-1.md"), "A derivative from an earlier run.\n");
    const ledger = join(dir, "publishing-status.jsonl");
    const journal = journalPathForLedger(ledger);
    stampOrigin(dir, "from GUI queue", { journalPath: journal });
    assert.deepEqual(createdRowIds(journal), [], `a ${settled} row must not be granted creation provenance`);
    const row = readQueue(dir).rows.find((candidate) => candidate.id === "x-1")!;
    assert.deepEqual(approvalDispatchDisposition(dir, basename(dir), row, ledger, journal), { kind: "legacy" });
    rmSync(dir, { recursive: true, force: true });
  });
}

test("stampOrigin records the pending row of a mixed folder and leaves the published row alone", () => {
  const dir = tmpFolder(
    "| id | platform | format | asset | native | brand | cta | status | notes | origin |\n" +
      "|---|---|---|---|---|---|---|---|---|---|\n" +
      "| x-1 | x | text | derivatives/x-1.md | — | — | — | published | | |\n" +
      "| x-2 | x | text | derivatives/x-2.md | — | — | — | pending | | |\n",
  );
  mkdirSync(join(dir, "derivatives"));
  writeFileSync(join(dir, "derivatives", "x-1.md"), "An earlier run's derivative.\n");
  writeFileSync(join(dir, "derivatives", "x-2.md"), "This run's derivative.\n");
  const ledger = join(dir, "publishing-status.jsonl");
  const journal = journalPathForLedger(ledger);
  stampOrigin(dir, "from GUI queue", { journalPath: journal });
  assert.deepEqual(createdRowIds(journal), ["x-2"]);
  const published = readQueue(dir).rows.find((candidate) => candidate.id === "x-1")!;
  assert.deepEqual(approvalDispatchDisposition(dir, basename(dir), published, ledger, journal), { kind: "legacy" });
  rmSync(dir, { recursive: true, force: true });
});

test("production queue-row writers use the provenance helpers and no source file appends a table row directly", () => {
  const callers = [
    "src/atomize/reply-draft.ts",
    "src/grow/experiment-queue-handoff.ts",
    "src/outreach/draft.ts",
    "src/review/jobs.ts",
  ];
  for (const path of callers) {
    const source = readFileSync(join(process.cwd(), path), "utf8");
    assert.match(source, /\b(?:appendRows?|stampOrigin)\s*\(/, `${path} must use a provenance-recording queue helper`);
    assert.match(source, /from ["'][^"']*publish\/queue\.js["']/, `${path} must import the canonical queue helper`);
  }

  const sourceFiles = (root: string): string[] => readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : entry.isFile() && path.endsWith(".ts") && !path.endsWith(".test.ts") ? [path] : [];
  });
  for (const path of sourceFiles(join(process.cwd(), "src"))) {
    if (path.endsWith(join("src", "publish", "queue.ts"))) continue;
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /appendFileSync\s*\([\s\S]{0,500}?review-queue\.md[\s\S]{0,500}?[`"']\|\s*\$?\{?[\w-]+/, `${path} must not append a pipe-delimited review row outside queue.ts`);
  }
});

test("the E2E registry gives every pass a distinct display title", () => {
  const source = readFileSync(join(process.cwd(), "e2e", "run-all.ts"), "utf8");
  const titles = [...source.matchAll(/title:\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.equal(titles.filter((title) => /^Pass E\b/.test(title)).length, 1);
  assert.equal(titles.filter((title) => /^Pass F\b/.test(title)).length, 1);
});

// appendBetPlacement's ctaDestination param (card d80411bc, strategy lever E scaffold): the
// `| cta:<dest>` marker it writes is what tag-source.ts reads back onto posts.cta_destination.
// Isolated from the real briefs/bets.md via CONTENT_AGENTS_TEST_BETS_PATH (same mechanism
// slots.test.ts uses for CONTENT_AGENTS_TEST_LEDGER, and cards.test.ts already uses for this file).
describe("appendBetPlacement: ctaDestination marker", () => {
  const originalBetsPath = process.env.CONTENT_AGENTS_TEST_BETS_PATH;
  let testDir: string;
  let testBetsPath: string;

  before(() => {
    testDir = mkdtempSync(join(tmpdir(), "queue-bets-test-"));
    testBetsPath = join(testDir, "bets.md");
    process.env.CONTENT_AGENTS_TEST_BETS_PATH = testBetsPath;
  });

  after(() => {
    if (originalBetsPath === undefined) delete process.env.CONTENT_AGENTS_TEST_BETS_PATH;
    else process.env.CONTENT_AGENTS_TEST_BETS_PATH = originalBetsPath;
    rmSync(testDir, { recursive: true, force: true });
  });

  function lineFor(rowId: string): string {
    const line = readFileSync(testBetsPath, "utf8").split("\n").find((l) => l.includes(`[essay-01/${rowId}]`));
    assert.ok(line, `no Placed-log row found for essay-01/${rowId}`);
    return line!;
  }

  test("a ctaDestination writes a `| cta:<dest>` marker before the quoted prefix", () => {
    appendBetPlacement("essay-01", "x-1", "x", "typefully draft 1", {}, "some posted text long enough to match", "source");
    assert.match(lineFor("x-1"), /\| cta:source \|/);
  });

  test("an unset ctaDestination (default null) writes no cta marker at all", () => {
    appendBetPlacement("essay-01", "x-2", "x", "typefully draft 2", {}, "other posted text long enough to match");
    assert.ok(!/\| cta:/.test(lineFor("x-2")));
  });

  test("the cta marker coexists with the spin marker, both before the quote", () => {
    appendBetPlacement("essay-01", "x-3", "x", "typefully draft 3", { spin: true }, "third posted text long enough to match", "work_with_me");
    assert.match(lineFor("x-3"), /\| spin \| cta:work_with_me \|/);
  });
});

// appendBetPlacement's cadenceSource param (strategy lever C follow-through, epic 2ce597d7): the
// `| cadence:<source>` marker it writes is what tag-source.ts reads back onto
// posts.cadence_source. Same isolation mechanism as the cta block above.
describe("appendBetPlacement: cadenceSource marker", () => {
  const originalBetsPath = process.env.CONTENT_AGENTS_TEST_BETS_PATH;
  let testDir: string;
  let testBetsPath: string;

  before(() => {
    testDir = mkdtempSync(join(tmpdir(), "queue-bets-cadence-test-"));
    testBetsPath = join(testDir, "bets.md");
    process.env.CONTENT_AGENTS_TEST_BETS_PATH = testBetsPath;
  });

  after(() => {
    if (originalBetsPath === undefined) delete process.env.CONTENT_AGENTS_TEST_BETS_PATH;
    else process.env.CONTENT_AGENTS_TEST_BETS_PATH = originalBetsPath;
    rmSync(testDir, { recursive: true, force: true });
  });

  function lineFor(rowId: string): string {
    const line = readFileSync(testBetsPath, "utf8").split("\n").find((l) => l.includes(`[essay-01/${rowId}]`));
    assert.ok(line, `no Placed-log row found for essay-01/${rowId}`);
    return line!;
  }

  test("a cadenceSource of 'override' writes a `| cadence:override` marker before the quoted prefix", () => {
    appendBetPlacement(
      "essay-01",
      "x-1",
      "x",
      "typefully draft 1",
      {},
      "some posted text long enough to match",
      null,
      "override"
    );
    assert.match(lineFor("x-1"), /\| cadence:override \|/);
  });

  test("a cadenceSource of 'default' writes a `| cadence:default` marker", () => {
    appendBetPlacement(
      "essay-01",
      "x-2",
      "x",
      "typefully draft 2",
      {},
      "other posted text long enough to match",
      null,
      "default"
    );
    assert.match(lineFor("x-2"), /\| cadence:default \|/);
  });

  test("an unset cadenceSource (default null) writes no cadence marker at all", () => {
    appendBetPlacement("essay-01", "x-3", "x", "typefully draft 3", {}, "third posted text long enough to match");
    assert.ok(!/\| cadence:/.test(lineFor("x-3")));
  });

  test("the cadence marker coexists with the cta marker, cta first then cadence", () => {
    appendBetPlacement(
      "essay-01",
      "x-4",
      "x",
      "typefully draft 4",
      { spin: true },
      "fourth posted text long enough to match",
      "work_with_me",
      "override"
    );
    assert.match(lineFor("x-4"), /\| spin \| cta:work_with_me \| cadence:override \|/);
  });
});

// Multi-cut row ids (plan i-want-to-add-mellow-mist): a row from a non-default lens self-describes
// via an id prefix ("short/x-1"), not a heading inserted into the table — a heading line would
// break review-queue.md's single contiguous GFM table.
describe("cutRowId / rowLens: id-prefix convention for grouping rows by lens", () => {
  test("the default lens (extract) is never prefixed", () => {
    assert.equal(cutRowId("extract", "x-1"), "x-1");
  });

  test("a non-default lens prefixes the id", () => {
    assert.equal(cutRowId("short", "x-1"), "short/x-1");
  });

  test("rowLens reads extract back from an unprefixed id", () => {
    assert.equal(rowLens("x-1"), "extract");
  });

  test("rowLens reads the lens back from a prefixed id", () => {
    assert.equal(rowLens("short/x-1"), "short");
  });

  test("a cut-prefixed id round-trips through readQueue/writeCell unchanged (no table-parsing special-casing needed)", () => {
    const dir = tmpFolder(
      `| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |\n` +
        `|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|\n` +
        `| short/x-1 | x | text | cuts/short/derivatives/x-1.md | 4 | 5 | yes | pending | | from /cycle |\n`
    );
    const { rows } = readQueue(dir);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, "short/x-1");
    assert.equal(rows[0].asset, "cuts/short/derivatives/x-1.md");
    assert.equal(rowLens(rows[0].id), "short");
    assert.ok(writeCell(dir, "short/x-1", { status: "approve" }));
    assert.equal(readQueue(dir).rows[0].status, "approve");
    rmSync(dir, { recursive: true, force: true });
  });
});

// appendBetPlacement's experiment-lineage marker (SLICE-5F): when the configured Content path
// stamps experiment_id / experiment_recommendation_id onto a derivative's frontmatter
// (configuredExperimentFrontmatter, src/review/jobs.ts), /publish records it as an
// `| experiment: <id> | recommendation: <id>` segment so the published experiment post lands in
// briefs/bets.md *as an experiment*. Same isolation mechanism as the cta/cadence blocks above.
describe("appendBetPlacement: experiment-lineage marker", () => {
  const originalBetsPath = process.env.CONTENT_AGENTS_TEST_BETS_PATH;
  let testDir: string;
  let testBetsPath: string;

  before(() => {
    testDir = mkdtempSync(join(tmpdir(), "queue-bets-experiment-test-"));
    testBetsPath = join(testDir, "bets.md");
    process.env.CONTENT_AGENTS_TEST_BETS_PATH = testBetsPath;
  });

  after(() => {
    if (originalBetsPath === undefined) delete process.env.CONTENT_AGENTS_TEST_BETS_PATH;
    else process.env.CONTENT_AGENTS_TEST_BETS_PATH = originalBetsPath;
    rmSync(testDir, { recursive: true, force: true });
  });

  function lineFor(rowId: string): string {
    const line = readFileSync(testBetsPath, "utf8").split("\n").find((l) => l.includes(`[essay-01/${rowId}]`));
    assert.ok(line, `no Placed-log row found for essay-01/${rowId}`);
    return line!;
  }

  test("experiment_id + experiment_recommendation_id writes both segments before the quoted prefix", () => {
    appendBetPlacement(
      "essay-01",
      "x-1",
      "x",
      "typefully draft 1",
      { experiment_id: "experiment:opening", experiment_recommendation_id: "signals:opening" },
      "some posted text long enough to match"
    );
    assert.match(
      lineFor("x-1"),
      /\| experiment: experiment:opening \| recommendation: signals:opening \| "some posted text long enough to match"$/
    );
  });

  test("experiment_id alone writes the experiment segment and no recommendation segment", () => {
    appendBetPlacement(
      "essay-01",
      "x-2",
      "x",
      "typefully draft 2",
      { experiment_id: "experiment:opening" },
      "other posted text long enough to match"
    );
    const line = lineFor("x-2");
    assert.match(line, /\| experiment: experiment:opening \|/);
    assert.ok(!/\| recommendation:/.test(line), "no dangling recommendation segment");
  });

  test("a recommendation with no experiment_id writes neither segment", () => {
    appendBetPlacement(
      "essay-01",
      "x-3",
      "x",
      "typefully draft 3",
      { experiment_recommendation_id: "signals:opening" },
      "third posted text long enough to match"
    );
    const line = lineFor("x-3");
    assert.ok(!/\| experiment:/.test(line), "no experiment segment without experiment_id");
    assert.ok(!/\| recommendation:/.test(line), "no recommendation segment without experiment_id");
  });

  test("no experiment fields yields a line byte-identical to the pre-change baseline", () => {
    appendBetPlacement("essay-01", "x-4", "x", "typefully draft 4", {}, "fourth posted text long enough to match");
    // Strip only the ISO timestamp; the rest of the line must match the pre-SLICE-5F template exactly.
    const withoutTs = lineFor("x-4").replace(
      /^- placed \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z /,
      "- placed <ts> "
    );
    assert.equal(
      withoutTs,
      '- placed <ts> [essay-01/x-4] x → typefully draft 4 | "fourth posted text long enough to match"'
    );
  });
});
