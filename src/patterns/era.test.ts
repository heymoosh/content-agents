// Era buckets, and the two facts they exist to keep visible: a pin's date is the only thing that
// makes its save count readable, and a date Pinterest published in the future is not a date.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { countByEra, eraFor, filterByEra, isImplausibleDate, isPostEra } from "./era.js";
import type { CorpusEntry } from "./types.js";

function entry(overrides: Partial<CorpusEntry>): CorpusEntry {
  return {
    id: "pinterest-x-00000000",
    platform: "pinterest",
    handle: "x",
    creator: "X",
    niche: "adhd",
    url: "https://www.pinterest.com/pin/1/",
    posted_at: null,
    collected_at: "2026-08-23T00:00:00.000Z",
    kind: "text",
    body: "b",
    transcript_source: null,
    metrics: { views: null, likes: null, comments: null, shares: null, followers: null },
    ...overrides,
  };
}

describe("eraFor", () => {
  test("splits on the 2020 collapse and the 2023 line", () => {
    assert.equal(eraFor("2014-03-01T00:00:00.000Z"), "pre-2020");
    assert.equal(eraFor("2019-12-31"), "pre-2020");
    assert.equal(eraFor("2020-01-01T00:00:00.000Z"), "2020-2022");
    assert.equal(eraFor("2022-12-31"), "2020-2022");
    assert.equal(eraFor("2023-01-01"), "2023-plus");
    assert.equal(eraFor("2026-08-23T11:00:00.000Z"), "2023-plus");
  });

  test("a missing or unreadable date is unknown, never guessed into an era", () => {
    assert.equal(eraFor(null), "unknown");
    assert.equal(eraFor(undefined), "unknown");
    assert.equal(eraFor(""), "unknown");
    assert.equal(eraFor("   "), "unknown");
    assert.equal(eraFor("July 2017"), "unknown");
    assert.equal(eraFor("2017-13-45"), "unknown");
  });

  test("isPostEra rejects anything not in the union", () => {
    assert.equal(isPostEra("pre-2020"), true);
    assert.equal(isPostEra("unknown"), true);
    assert.equal(isPostEra("old"), false);
    assert.equal(isPostEra(2017), false);
  });
});

describe("isImplausibleDate", () => {
  // One collected pin really did carry datePublished 2026-12-27, months ahead of collection.
  test("a date in the future is flagged, and the date itself is left alone", () => {
    const now = new Date("2026-08-23T12:00:00.000Z");
    assert.equal(isImplausibleDate("2026-12-27T00:00:00.000Z", now), true);
    assert.equal(isImplausibleDate("2017-07-07T00:00:00.000Z", now), false);
    // The flagged pin still lands in an era, computed off the date as published.
    assert.equal(eraFor("2026-12-27T00:00:00.000Z"), "2023-plus");
  });

  test("a day of slack, so a timezone difference is not called impossible", () => {
    const now = new Date("2026-08-23T12:00:00.000Z");
    assert.equal(isImplausibleDate("2026-08-23T23:00:00.000Z", now), false);
    assert.equal(isImplausibleDate("2026-08-25T00:00:00.000Z", now), true);
  });

  test("no date is not an implausible date", () => {
    assert.equal(isImplausibleDate(null), false);
    assert.equal(isImplausibleDate("not a date"), false);
  });
});

describe("filterByEra and countByEra", () => {
  const entries = [
    entry({ url: "a", posted_at: "2017-07-07", era: "pre-2020" }),
    entry({ url: "b", posted_at: "2021-06-07", era: "2020-2022" }),
    entry({ url: "c", posted_at: "2025-01-26", era: "2023-plus" }),
    entry({ url: "d", posted_at: null }),
    // No era field at all, which is what a corpus written before the field existed looks like.
    entry({ url: "e", posted_at: "2016-02-02" }),
  ];

  test("an entry with no era field is still placed, from its posted_at", () => {
    assert.deepEqual(filterByEra(entries, "pre-2020").map((e) => e.url), ["a", "e"]);
  });

  test("counts cover every era including unknown", () => {
    const counts = countByEra(entries);
    assert.equal(counts.get("pre-2020"), 2);
    assert.equal(counts.get("2020-2022"), 1);
    assert.equal(counts.get("2023-plus"), 1);
    assert.equal(counts.get("unknown"), 1);
  });
});
