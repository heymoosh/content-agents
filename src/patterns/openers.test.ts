// The opener bank. Every test writes into a temp directory, never into the real data/patterns.

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { appendOpeners, buildOpeners, extractOpener, rankOpeners, readOpeners } from "./openers.js";
import type { CorpusEntry, Opener } from "./types.js";

let dir: string;
let openersPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "patterns-openers-"));
  openersPath = join(dir, "openers.jsonl");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function entry(overrides: Partial<CorpusEntry> = {}): CorpusEntry {
  return {
    id: "x-someone-00000000",
    platform: "x",
    handle: "@someone",
    creator: "Someone",
    niche: "building-solopreneur",
    url: "https://example.com/1",
    posted_at: "2026-08-01",
    collected_at: "2026-08-22T00:00:00.000Z",
    kind: "text",
    body: "a post",
    transcript_source: null,
    metrics: { views: 1000, likes: 10, comments: 1, shares: 0, followers: 500 },
    ...overrides,
  };
}

function opener(overrides: Partial<Opener> = {}): Opener {
  return {
    id: "opener-x-someone-00000000",
    corpus_entry_id: "x-someone-00000000",
    platform: "x",
    creator: "Someone",
    handle: "@someone",
    url: "https://example.com/1",
    opener_text: "line one",
    onscreen_title: null,
    kind: "text",
    performance: { multiple: null, metric: null, note: "no baseline" },
    verbatim_ok: false,
    collected_at: "2026-08-22T00:00:00.000Z",
    ...overrides,
  };
}

describe("extractOpener, text posts", () => {
  test("takes the first two lines, verbatim and in order", () => {
    const text = extractOpener(entry({ body: "I quit my job.\nThen I made this mistake.\nHere is what happened next." }));
    assert.equal(text, "I quit my job.\nThen I made this mistake.");
  });

  test("blank lines between paragraphs do not count as lines", () => {
    const text = extractOpener(entry({ body: "First line.\n\n\nSecond line.\n\nThird line." }));
    assert.equal(text, "First line.\nSecond line.");
  });

  test("a one-line post is its own opener", () => {
    assert.equal(extractOpener(entry({ body: "Just the one line." })), "Just the one line.");
  });

  test("an empty body has no opener", () => {
    assert.equal(extractOpener(entry({ body: "   \n\n  " })), null);
  });
});

describe("extractOpener, video speech", () => {
  test("takes the first spoken sentence when it is long enough to stand alone", () => {
    const text = extractOpener(
      entry({
        kind: "video",
        transcript_source: "manual",
        body: "Nobody tells you the first ninety days are the hardest part. So here is what I did about it. And then it worked.",
      }),
    );
    assert.equal(text, "Nobody tells you the first ninety days are the hardest part.");
  });

  test("takes two sentences when the first one is short, which is about three seconds of speech", () => {
    const text = extractOpener(
      entry({ kind: "video", transcript_source: "captions", body: "Stop doing this.\nIt is costing you money every single week." }),
    );
    assert.equal(text, "Stop doing this. It is costing you money every single week.");
  });

  test("a video whose transcript source was never recorded has no known opener", () => {
    assert.equal(extractOpener(entry({ kind: "video", transcript_source: null, body: "Some words." })), null);
  });
});

describe("extractOpener, the cases that must return null", () => {
  test("a written caption is not the spoken opener, so it returns null", () => {
    const result = extractOpener(
      entry({ kind: "video", transcript_source: "caption", body: "3 tools I use every day\nfull breakdown below" }),
    );
    assert.equal(result, null);
  });

  test("a caption on a text entry returns null too, since the body is still not speech", () => {
    assert.equal(extractOpener(entry({ transcript_source: "caption", body: "some caption text" })), null);
  });

  test("a truncated opening returns null rather than a broken line", () => {
    assert.equal(extractOpener(entry({ body: "Here is the thing everyone gets wrong about…" })), null);
    assert.equal(extractOpener(entry({ body: "[truncated] and then the rest of it\nsecond line" })), null);
    assert.equal(extractOpener(entry({ kind: "video", transcript_source: "manual", body: "I want to tell you about the time..." })), null);
  });

  test("a cut later in the body leaves the opening intact, so the opener still counts", () => {
    const text = extractOpener(entry({ body: "First line.\nSecond line.\nThird line runs on and then gets cut…" }));
    assert.equal(text, "First line.\nSecond line.");
  });
});

describe("buildOpeners", () => {
  // Four entries on one account: three ordinary ones make the baseline, the fourth is the winner.
  function account(): CorpusEntry[] {
    return [
      entry({ id: "x-someone-1", url: "https://example.com/1", metrics: { views: 100, likes: 1, comments: 0, shares: 0, followers: 500 } }),
      entry({ id: "x-someone-2", url: "https://example.com/2", metrics: { views: 100, likes: 1, comments: 0, shares: 0, followers: 500 } }),
      entry({ id: "x-someone-3", url: "https://example.com/3", metrics: { views: 100, likes: 1, comments: 0, shares: 0, followers: 500 } }),
      entry({
        id: "x-someone-4",
        url: "https://example.com/4",
        body: "The winner line.\nSecond line.",
        metrics: { views: 400, likes: 1, comments: 0, shares: 0, followers: 500 },
      }),
    ];
  }

  test("derives one opener per entry with a knowable opener, and skips the rest", () => {
    const entries = [...account(), entry({ id: "x-someone-5", url: "https://example.com/5", transcript_source: "caption" })];
    const built = buildOpeners(entries);
    assert.equal(built.length, 4);
    assert.ok(!built.some((o) => o.corpus_entry_id === "x-someone-5"));
  });

  test("ids are derived from the corpus id, so a rebuild is a no-op", () => {
    const first = buildOpeners(account());
    const second = buildOpeners(account());
    assert.deepEqual(first.map((o) => o.id), second.map((o) => o.id));
    assert.equal(first[0].id, "opener-x-someone-1");
  });

  test("records the account multiple and which metric it was measured on", () => {
    const winner = buildOpeners(account()).find((o) => o.corpus_entry_id === "x-someone-4");
    assert.equal(winner?.performance.multiple, 4);
    assert.equal(winner?.performance.metric, "views");
  });

  test("says plainly when there is no baseline instead of scoring a zero", () => {
    const [only] = buildOpeners([entry()]);
    assert.equal(only.performance.multiple, null);
    assert.equal(only.performance.metric, null);
    assert.match(only.performance.note, /No baseline yet/);
  });

  test("verbatim_ok is false unless the handle was passed in as publicly permitted", () => {
    const [plain] = buildOpeners([entry()]);
    assert.equal(plain.verbatim_ok, false);
    const [permitted] = buildOpeners([entry()], { verbatimOkHandles: ["SomeOne"] });
    assert.equal(permitted.verbatim_ok, true);
  });

  test("onscreen_title is null on every derived opener, because the corpus does not capture it", () => {
    assert.ok(buildOpeners(account()).every((o) => o.onscreen_title === null));
  });

  test("the platform filter narrows the output but not the baseline", () => {
    const entries = [...account(), entry({ id: "li-1", platform: "linkedin", url: "https://example.com/li" })];
    const built = buildOpeners(entries, { platform: "linkedin" });
    assert.equal(built.length, 1);
    assert.equal(built[0].platform, "linkedin");
  });
});

describe("rankOpeners", () => {
  test("sorts by multiple, strongest first, with unmeasured openers last", () => {
    const ranked = rankOpeners([
      opener({ id: "a", performance: { multiple: 2, metric: "views", note: "" } }),
      opener({ id: "b", performance: { multiple: null, metric: null, note: "" } }),
      opener({ id: "c", performance: { multiple: 9, metric: "engagement", note: "" } }),
      opener({ id: "d", performance: { multiple: null, metric: null, note: "" } }),
      opener({ id: "e", performance: { multiple: 5, metric: "views", note: "" } }),
    ]);
    assert.deepEqual(ranked.map((o) => o.id), ["c", "e", "a", "b", "d"]);
  });

  test("an all-null bank keeps its input order rather than shuffling", () => {
    const input = [opener({ id: "a" }), opener({ id: "b" }), opener({ id: "c" })];
    assert.deepEqual(rankOpeners(input).map((o) => o.id), ["a", "b", "c"]);
  });

  test("does not mutate the bank it was given", () => {
    const input = [
      opener({ id: "a", performance: { multiple: 1, metric: "views", note: "" } }),
      opener({ id: "b", performance: { multiple: 8, metric: "views", note: "" } }),
    ];
    rankOpeners(input);
    assert.deepEqual(input.map((o) => o.id), ["a", "b"]);
  });
});

describe("the openers.jsonl store", () => {
  test("a bank that does not exist yet reads as empty", () => {
    assert.deepEqual(readOpeners(openersPath), []);
  });

  test("appends new openers and reads them back whole", () => {
    const result = appendOpeners([opener({ id: "a" }), opener({ id: "b" })], openersPath);
    assert.equal(result.appended.length, 2);
    assert.deepEqual(readOpeners(openersPath).map((o) => o.id), ["a", "b"]);
  });

  test("the same opener never lands twice, within a batch or across runs", () => {
    appendOpeners([opener({ id: "a" })], openersPath);
    const second = appendOpeners([opener({ id: "a" }), opener({ id: "b" }), opener({ id: "b" })], openersPath);
    assert.equal(second.appended.length, 1);
    assert.equal(second.duplicates.length, 2);
    assert.deepEqual(readOpeners(openersPath).map((o) => o.id), ["a", "b"]);
  });
});
