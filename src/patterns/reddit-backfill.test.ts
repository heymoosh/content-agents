// The reddit backfill, tested on invented measurements and invented entries. No network, no real
// post text, no real author.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  backfill,
  measurementIndex,
  parseMeasurements,
  postIdFrom,
  rewriteNotes,
  type BrowserMeasurement,
} from "./reddit-backfill.js";
import type { CorpusEntry } from "./types.js";

const FILE = [
  "rank|id|score|comments|ratio|type|date",
  "1|aaa111|12283|1339|0.992|text|2025-10-12",
  "2|bbb222|6760|1517|0.990|image|2025-12-07",
].join("\n");

function entry(overrides: Partial<CorpusEntry> = {}): CorpusEntry {
  return {
    id: "reddit-r-fixture-x",
    platform: "reddit",
    handle: "r/FixtureSub",
    creator: "u/someone",
    niche: "adhd",
    url: "https://old.reddit.com/r/FixtureSub/comments/aaa111/an_invented_post/",
    posted_at: "2025-10-12",
    collected_at: "2026-08-23T00:00:00.000Z",
    kind: "text",
    body: "invented body",
    transcript_source: null,
    title: "An invented post",
    metrics: { views: null, likes: null, comments: null, shares: null, followers: null, upvote_ratio: null },
    media: {
      form: "text-only",
      onscreen_text: null,
      description: "invented",
      duration_seconds: null,
      media_count: null,
      has_captions: null,
      aspect: null,
      body_is_complete: true,
    },
    sample: { listing: "top-year-rss", window: "year", rank: 1, role: "winner" },
    notes: [
      "PLATFORM: reddit",
      "NO SCORE, AND THEREFORE NO MULTIPLE. Reddit's RSS feed publishes no score.",
      "Route: rss",
    ].join("\n"),
    ...overrides,
  };
}

describe("postIdFrom", () => {
  test("reads the id out of an old.reddit url, a www url and a fullname alike", () => {
    assert.equal(postIdFrom("https://old.reddit.com/r/ADHD/comments/1o4u9wk/some_slug/"), "1o4u9wk");
    assert.equal(postIdFrom("https://www.reddit.com/r/ADHD/comments/1o4u9wk/some_slug/"), "1o4u9wk");
    assert.equal(postIdFrom("t3_1o4u9wk"), "1o4u9wk");
  });

  test("returns null rather than a guess when there is no id", () => {
    assert.equal(postIdFrom("https://example.com/nothing"), null);
    assert.equal(postIdFrom(""), null);
  });
});

describe("parseMeasurements", () => {
  test("reads every row and coerces the numbers", () => {
    const rows = parseMeasurements(FILE);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], {
      rank: 1, id: "aaa111", score: 12283, comments: 1339, ratio: 0.992, postType: "text", date: "2025-10-12",
    });
  });

  test("refuses a file whose columns are not the ones it expects", () => {
    assert.throws(() => parseMeasurements("id|score\nx|1"), /header must start/);
  });

  test("skips a row with an unreadable score instead of storing NaN", () => {
    const rows = parseMeasurements("rank|id|score|comments|ratio|type|date\n1|aaa|notanumber|3|1|text|2025-01-01");
    assert.deepEqual(rows, []);
  });

  test("an empty file yields no rows rather than throwing", () => {
    assert.deepEqual(parseMeasurements(""), []);
  });
});

describe("rewriteNotes", () => {
  const m: BrowserMeasurement = {
    id: "aaa111", rank: 1, score: 12283, comments: 1339, ratio: 0.992, postType: "text", date: "2025-10-12",
  };

  test("replaces the no-score claim, so the corpus never carries a contradiction", () => {
    const out = rewriteNotes(entry().notes!, m, "2026-08-23T10:00:00.000Z");
    assert.doesNotMatch(out, /NO SCORE, AND THEREFORE NO MULTIPLE/);
    assert.match(out, /score=12283/);
    assert.match(out, /comment-count=1339/);
    assert.match(out, /upvote-ratio=0\.992/);
    assert.match(out, /joined on the post id aaa111/);
  });

  test("keeps the lines it is not replacing", () => {
    const out = rewriteNotes(entry().notes!, m, "2026-08-23T10:00:00.000Z");
    assert.match(out, /^PLATFORM: reddit/m);
    assert.match(out, /^Route: rss/m);
  });

  test("appends provenance when the marker was never there", () => {
    const out = rewriteNotes("PLATFORM: reddit", m, "2026-08-23T10:00:00.000Z");
    assert.match(out, /^PLATFORM: reddit/);
    assert.match(out, /score=12283/);
  });

  test("says nothing about a ratio it does not have", () => {
    const out = rewriteNotes(entry().notes!, { ...m, ratio: null }, "2026-08-23T10:00:00.000Z");
    assert.doesNotMatch(out, /upvote-ratio/);
  });
});

describe("backfill", () => {
  const index = measurementIndex(parseMeasurements(FILE));

  test("fills upvotes, comments and the ratio on a matched entry", () => {
    const r = backfill([entry()], index, "2026-08-23T10:00:00.000Z");
    assert.equal(r.filled, 1);
    assert.equal(r.entries[0].metrics.likes, 12283);
    assert.equal(r.entries[0].metrics.comments, 1339);
    assert.equal(r.entries[0].metrics.upvote_ratio, 0.992);
  });

  test("leaves views and shares null, because reddit publishes neither", () => {
    const r = backfill([entry()], index, "2026-08-23T10:00:00.000Z");
    assert.equal(r.entries[0].metrics.views, null);
    assert.equal(r.entries[0].metrics.shares, null);
  });

  test("does not mutate the entries it was given", () => {
    const original = entry();
    backfill([original], index, "2026-08-23T10:00:00.000Z");
    assert.equal(original.metrics.likes, null);
  });

  test("an unmatched entry keeps its nulls and is counted, never invented", () => {
    const orphan = entry({ url: "https://old.reddit.com/r/FixtureSub/comments/zzz999/not_measured/" });
    const r = backfill([orphan], index, "2026-08-23T10:00:00.000Z");
    assert.equal(r.filled, 0);
    assert.equal(r.missed, 1);
    assert.deepEqual(r.missedIds, ["zzz999"]);
    assert.equal(r.entries[0].metrics.likes, null);
    // And its notes keep saying so.
    assert.match(r.entries[0].notes!, /NO SCORE/);
  });

  test("reports a form disagreement without overwriting the recorded form", () => {
    const e = entry({ url: "https://old.reddit.com/r/FixtureSub/comments/bbb222/an_invented_post/" });
    const r = backfill([e], index, "2026-08-23T10:00:00.000Z");
    assert.equal(r.entries[0].media?.form, "text-only");
    assert.deepEqual(r.typeDisagreements, [{ id: "bbb222", recordedForm: "text-only", browserType: "image" }]);
  });

  test("agreeing forms are not reported as disagreements", () => {
    const r = backfill([entry()], index, "2026-08-23T10:00:00.000Z");
    assert.deepEqual(r.typeDisagreements, []);
  });

  test("a non-reddit entry is passed through untouched", () => {
    const other = entry({ platform: "bluesky" });
    const r = backfill([other], index, "2026-08-23T10:00:00.000Z");
    assert.equal(r.filled, 0);
    assert.equal(r.entries[0].metrics.likes, null);
  });
});

describe("rewriteNotes idempotency", () => {
  const m: BrowserMeasurement = {
    id: "aaa111", rank: 1, score: 12283, comments: 1339, ratio: 0.992, postType: "text", date: "2025-10-12",
  };
  const MARKER = "Upvotes and comments were measured separately";

  test("running twice leaves exactly one provenance line", () => {
    const once = rewriteNotes(entry().notes!, m, "2026-08-23T10:00:00.000Z");
    const twice = rewriteNotes(once, m, "2026-08-23T10:00:00.000Z");
    assert.equal(twice.split("\n").filter((l) => l.startsWith(MARKER)).length, 1);
    assert.equal(once, twice);
  });

  test("a re-run picks up corrected numbers rather than stacking a second line", () => {
    const once = rewriteNotes(entry().notes!, m, "2026-08-23T10:00:00.000Z");
    const corrected = rewriteNotes(once, { ...m, score: 99 }, "2026-08-24T10:00:00.000Z");
    assert.equal(corrected.split("\n").filter((l) => l.startsWith(MARKER)).length, 1);
    assert.match(corrected, /score=99/);
    assert.doesNotMatch(corrected, /score=12283/);
  });

  test("repairs a note a previous buggy run already doubled", () => {
    const once = rewriteNotes(entry().notes!, m, "2026-08-23T10:00:00.000Z");
    const doubled = once + "\n" + once.split("\n").find((l) => l.startsWith(MARKER));
    assert.equal(doubled.split("\n").filter((l) => l.startsWith(MARKER)).length, 2);
    const repaired = rewriteNotes(doubled, m, "2026-08-23T10:00:00.000Z");
    assert.equal(repaired.split("\n").filter((l) => l.startsWith(MARKER)).length, 1);
  });
});
