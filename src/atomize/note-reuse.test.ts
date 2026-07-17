// note-reuse.ts — the relaxed "already drafted" rule for the Substack Notes picker (Muxin,
// 2026-07-16: a discarded draft must be selectable again; a published note gets a 30-day
// cooldown instead of a permanent block; anything still in review stays blocked).

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  REUSE_COOLDOWN_DAYS,
  parsePublishLogDates,
  foldFolderState,
  mergeOriginStates,
  noteReuse,
  readOriginStates,
  type OriginState,
} from "./note-reuse.js";

const NOW = new Date("2026-07-16T12:00:00Z").getTime();
const daysBeforeNow = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

describe("parsePublishLogDates", () => {
  test("pulls the leading ISO timestamp off each publish-log entry line", () => {
    const text = [
      "# Publish log",
      "",
      "- 2026-07-05T16:50:41.397Z — bluesky-2 → typefully draft 9778798 (bluesky, Wed, Jul 15, 6:30 PM PT, cta→inline)",
      "- 2026-07-08T09:00:00.000Z — x-1 → typefully draft 111",
      "not a log line",
    ].join("\n");
    assert.deepEqual(parsePublishLogDates(text), ["2026-07-05T16:50:41.397Z", "2026-07-08T09:00:00.000Z"]);
  });

  test("empty/absent log text yields no dates", () => {
    assert.deepEqual(parsePublishLogDates(""), []);
  });
});

describe("foldFolderState", () => {
  test("a folder with zero rows is a fresh scaffold — undecided (mid-atomize), never free to re-draft", () => {
    assert.equal(foldFolderState([], []).undecided, true);
  });

  test("any pending/approve/revise row keeps the folder undecided", () => {
    for (const status of ["pending", "approve", "revise", ""]) {
      assert.equal(foldFolderState([{ status }, { status: "discard" }], []).undecided, true, `status "${status}"`);
    }
  });

  test("all rows discarded, no publish log → decided, nothing published", () => {
    const s = foldFolderState([{ status: "discard" }, { status: "discard" }], []);
    assert.deepEqual(s, { undecided: false, lastPublishedAt: null, publishedUndated: false });
  });

  test("published row + dated log → lastPublishedAt is the newest log date", () => {
    const s = foldFolderState([{ status: "published" }], ["2026-06-01T00:00:00.000Z", "2026-06-10T00:00:00.000Z"]);
    assert.equal(s.lastPublishedAt, "2026-06-10T00:00:00.000Z");
    assert.equal(s.publishedUndated, false);
  });

  test("published row with NO log date is flagged publishedUndated (conservative)", () => {
    const s = foldFolderState([{ status: "published" }], []);
    assert.equal(s.publishedUndated, true);
    assert.equal(s.lastPublishedAt, null);
  });
});

describe("mergeOriginStates (one note re-drafted into several folders)", () => {
  const decided = (last: string | null): OriginState => ({ undecided: false, lastPublishedAt: last, publishedUndated: false });

  test("any undecided folder wins", () => {
    const merged = mergeOriginStates(decided(null), { undecided: true, lastPublishedAt: null, publishedUndated: false });
    assert.equal(merged.undecided, true);
  });

  test("newest publish date wins", () => {
    const merged = mergeOriginStates(decided("2026-05-01T00:00:00Z"), decided("2026-07-01T00:00:00Z"));
    assert.equal(merged.lastPublishedAt, "2026-07-01T00:00:00Z");
  });
});

describe("noteReuse — the picker-facing verdict", () => {
  test("never drafted → selectable, no tag", () => {
    assert.deepEqual(noteReuse(undefined, NOW), { drafted: false, reusable: true, draftedTag: "" });
  });

  test("still in review → blocked", () => {
    const r = noteReuse({ undecided: true, lastPublishedAt: null, publishedUndated: false }, NOW);
    assert.equal(r.reusable, false);
    assert.equal(r.draftedTag, "in review now");
  });

  test("published inside the cooldown → blocked, tag says how long ago", () => {
    const r = noteReuse({ undecided: false, lastPublishedAt: daysBeforeNow(10), publishedUndated: false }, NOW);
    assert.equal(r.reusable, false);
    assert.equal(r.draftedTag, "published 10d ago");
  });

  test(`published ${REUSE_COOLDOWN_DAYS}+ days ago → selectable again, labeled`, () => {
    const r = noteReuse({ undecided: false, lastPublishedAt: daysBeforeNow(REUSE_COOLDOWN_DAYS + 5), publishedUndated: false }, NOW);
    assert.equal(r.reusable, true);
    assert.equal(r.draftedTag, `published ${REUSE_COOLDOWN_DAYS + 5}d ago, ok to reuse`);
  });

  test("published exactly at the cooldown boundary is reusable (>= cooldown days)", () => {
    const r = noteReuse({ undecided: false, lastPublishedAt: daysBeforeNow(REUSE_COOLDOWN_DAYS), publishedUndated: false }, NOW);
    assert.equal(r.reusable, true);
  });

  test("published but undated → blocked (can't prove the cooldown passed)", () => {
    const r = noteReuse({ undecided: false, lastPublishedAt: null, publishedUndated: true }, NOW);
    assert.equal(r.reusable, false);
    assert.equal(r.draftedTag, "published (date unknown)");
  });

  test("drafted then fully discarded → selectable immediately", () => {
    const r = noteReuse({ undecided: false, lastPublishedAt: null, publishedUndated: false }, NOW);
    assert.deepEqual(r, { drafted: true, reusable: true, draftedTag: "drafted before, discarded" });
  });
});

describe("readOriginStates — real folder scan", () => {
  const QUEUE_HEADER = [
    "# Review queue — test",
    "",
    "| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |",
    "|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|",
  ];
  function makeFolder(root: string, name: string, origin: string, rowStatuses: string[], publishDates: string[] = []): void {
    const dir = join(root, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "source.md"), `---\ntitle: "t"\norigin: ${origin}\n---\n\nbody\n`);
    const rows = rowStatuses.map((s, i) => `| x-${i + 1} | x | text | derivatives/x-${i + 1}.md | — | — | — | ${s} | | |`);
    writeFileSync(join(dir, "review-queue.md"), [...QUEUE_HEADER, ...rows, ""].join("\n"));
    if (publishDates.length) {
      writeFileSync(join(dir, "publish-log.md"), ["# Publish log", "", ...publishDates.map((d) => `- ${d} — x-1 → typefully draft 1`), ""].join("\n"));
    }
  }

  test("folds per-origin state across folders; unrelated origins stay separate", () => {
    const root = mkdtempSync(join(tmpdir(), "note-reuse-"));
    try {
      makeFolder(root, "2026-06-01-a", "https://substack.com/@m/note/c-1", ["discard"]);
      makeFolder(root, "2026-06-05-b", "https://substack.com/@m/note/c-2", ["published"], ["2026-06-05T10:00:00.000Z"]);
      makeFolder(root, "2026-07-01-c", "https://substack.com/@m/note/c-2", ["pending"]); // re-draft of c-2, in flight
      const states = readOriginStates(root);
      assert.deepEqual(states.get("https://substack.com/@m/note/c-1"), {
        undecided: false, lastPublishedAt: null, publishedUndated: false,
      });
      const c2 = states.get("https://substack.com/@m/note/c-2")!;
      assert.equal(c2.undecided, true, "the in-flight re-draft keeps c-2 blocked");
      assert.equal(c2.lastPublishedAt, "2026-06-05T10:00:00.000Z");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a folder without review-queue.md counts as undecided (conservative), not free", () => {
    const root = mkdtempSync(join(tmpdir(), "note-reuse-"));
    try {
      const dir = join(root, "2026-07-01-x");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "source.md"), `---\ntitle: "t"\norigin: https://substack.com/@m/note/c-9\n---\n\nbody\n`);
      const s = readOriginStates(root).get("https://substack.com/@m/note/c-9")!;
      assert.equal(s.undecided, true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("missing content dir → empty map", () => {
    assert.equal(readOriginStates(join(tmpdir(), "definitely-not-there-12345")).size, 0);
  });
});
