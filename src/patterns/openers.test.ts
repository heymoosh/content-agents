// The opener bank. Every test writes into a temp directory, never into the real data/patterns.

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { appendOpeners, buildOpeners, extractOpener, grantedHandles, openerWarnings, rankOpeners, readOpeners } from "./openers.js";
import type { CorpusEntry, CorpusMedia, Opener, OpenerWarningCode, PatternMiningConfig } from "./types.js";

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
    warnings: [],
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

  test("a body ending on a colon is a thread opener, and its substance was never collected", () => {
    assert.equal(extractOpener(entry({ body: "I read 40 books this year. The 6 that changed how I work:" })), null);
  });

  test("a colon in the middle of a post is ordinary writing and keeps its opener", () => {
    const text = extractOpener(entry({ body: "Here is what I learned:\nMost of it was obvious.\nThe rest was not." }));
    assert.equal(text, "Here is what I learned:\nMost of it was obvious.");
  });
});

describe("openerWarnings", () => {
  function codes(e: CorpusEntry): OpenerWarningCode[] {
    return openerWarnings(e).map((w) => w.code);
  }

  function media(overrides: Partial<CorpusMedia> = {}): CorpusMedia {
    return {
      form: "image",
      onscreen_text: null,
      description: null,
      duration_seconds: null,
      media_count: null,
      has_captions: null,
      aspect: null,
      body_is_complete: false,
      ...overrides,
    };
  }

  test("a body long enough to be the whole post carries no warnings", () => {
    const long = entry({
      body: "I spent six months building the wrong thing, and the tell was there in week two.\nHere is what I should have measured instead of what I did measure.",
    });
    assert.deepEqual(codes(long), []);
  });

  test("a short body is flagged, because it may be a caption over media nobody collected", () => {
    const warning = openerWarnings(entry({ body: "the best advice I ever got" })).find((w) => w.code === "short-body");
    assert.ok(warning);
    assert.match(warning.note, /caption over an image/);
  });

  test("a media-first platform is flagged, because slide and frame text are never collected", () => {
    assert.ok(codes(entry({ platform: "instagram" })).includes("media-first-platform"));
    assert.ok(!codes(entry({ platform: "linkedin" })).includes("media-first-platform"));
  });

  test("every video opener is flagged as missing its on-screen title", () => {
    assert.ok(codes(entry({ kind: "video", transcript_source: "manual" })).includes("missing-onscreen-title"));
    assert.ok(!codes(entry()).includes("missing-onscreen-title"));
  });

  test("a body cut off after the opener is flagged without losing the opener", () => {
    const cut = entry({ body: "First line.\nSecond line.\nThird line runs on and then gets cut…" });
    assert.ok(codes(cut).includes("truncated-body"));
    assert.equal(extractOpener(cut), "First line.\nSecond line.");
  });

  test("the guessed warnings come before the ones that only add context", () => {
    const both = entry({ platform: "instagram", kind: "video", transcript_source: "manual", body: "short one" });
    assert.deepEqual(codes(both).slice(0, 2), ["short-body", "media-first-platform"]);
  });

  test("a recorded media saying the body is not the whole post is flagged as recorded, not guessed", () => {
    const koe = entry({ platform: "linkedin", body: "the best advice I ever got", media: media({ form: "image" }) });
    assert.ok(codes(koe).includes("substance-outside-body"));
    assert.match(openerWarnings(koe)[0].note, /Someone looked at this post/);
  });

  test("a recorded media replaces the guesses instead of piling on top of them", () => {
    const looked = entry({ platform: "instagram", body: "short one", media: media({ form: "image" }) });
    assert.ok(!codes(looked).includes("short-body"));
    assert.ok(!codes(looked).includes("media-first-platform"));
  });

  test("a short post someone confirmed is the whole post carries no doubt at all", () => {
    const confirmed = entry({ body: "short but complete", media: media({ form: "text-only", body_is_complete: true }) });
    assert.deepEqual(codes(confirmed), []);
  });

  test("a media with no captured on-screen text is missing half the method", () => {
    assert.ok(codes(entry({ media: media({ form: "carousel" }) })).includes("missing-onscreen-title"));
  });

  test("a captured on-screen title closes that gap", () => {
    const titled = entry({ media: media({ form: "image", onscreen_text: "THE BEST ADVICE I EVER GOT" }) });
    assert.ok(!codes(titled).includes("missing-onscreen-title"));
  });

  test("a thread has no on-screen title to be missing", () => {
    const thread = entry({ body: "one of two", media: media({ form: "thread", media_count: 7 }) });
    assert.ok(!codes(thread).includes("missing-onscreen-title"));
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

  test("onscreen_title is null when nobody recorded what the post looked like", () => {
    assert.ok(buildOpeners(account()).every((o) => o.onscreen_title === null));
  });

  test("a captured on-screen title reaches the opener verbatim", () => {
    const [built] = buildOpeners([
      entry({
        body: "the best advice I ever got",
        media: {
          form: "image",
          onscreen_text: "THE BEST ADVICE I EVER GOT",
          description: "stacked text on plain background",
          duration_seconds: null,
          media_count: null,
          has_captions: null,
          aspect: null,
          body_is_complete: false,
        },
      }),
    ]);
    assert.equal(built.onscreen_title, "THE BEST ADVICE I EVER GOT");
  });

  test("each opener carries its own warnings, so the doubt reaches the pick", () => {
    const [built] = buildOpeners([entry({ platform: "instagram", body: "short one" })]);
    assert.deepEqual(built.warnings.map((w) => w.code), ["short-body", "media-first-platform"]);
  });

  test("the platform filter narrows the output but not the baseline", () => {
    const entries = [...account(), entry({ id: "li-1", platform: "linkedin", url: "https://example.com/li" })];
    const built = buildOpeners(entries, { platform: "linkedin" });
    assert.equal(built.length, 1);
    assert.equal(built[0].platform, "linkedin");
  });
});

describe("grantedHandles", () => {
  function config(overrides: Partial<PatternMiningConfig> = {}): PatternMiningConfig {
    return { niches: [], accounts: [], outlier_thresholds: {}, targets: { corpus_size_min: 20, corpus_size_max: 50 }, ...overrides };
  }

  test("a config with no grant list grants nobody", () => {
    assert.deepEqual(grantedHandles(config()), []);
  });

  test("reads the handles off the recorded grants", () => {
    const granted = grantedHandles(
      config({ verbatim_ok: [{ handle: "@sabrinaramonov", creator: "Sabrina Ramonov", grant: "public blanket grant" }] }),
    );
    assert.deepEqual(granted, ["@sabrinaramonov"]);
    assert.equal(buildOpeners([entry({ handle: "@SabrinaRamonov" })], { verbatimOkHandles: granted })[0].verbatim_ok, true);
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
