// The shared collector helpers. Pure functions, no network, no fixtures on disk.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type { CorpusEntry } from "../types.js";
import {
  AUTO_PLATFORMS,
  PATTERN_COLLECTORS,
  blockSignal,
  canonicalUrl,
  collectedBy,
  collectorFor,
  countFromAriaLabel,
  isAutoPlatform,
  mergeByUrl,
  parseCompactNumber,
  politeDelay,
} from "./registry.js";

describe("parseCompactNumber", () => {
  test("plain integers", () => {
    assert.equal(parseCompactNumber("0"), 0);
    assert.equal(parseCompactNumber("7"), 7);
    assert.equal(parseCompactNumber("1,234"), 1234);
    assert.equal(parseCompactNumber("1\u00a0234"), 1234); // a real nbsp separator is unambiguous
  });

  test("abbreviated counts expand", () => {
    assert.equal(parseCompactNumber("1.2K"), 1200);
    assert.equal(parseCompactNumber("12.3k"), 12300);
    assert.equal(parseCompactNumber("3M"), 3_000_000);
    assert.equal(parseCompactNumber("1.5B"), 1_500_000_000);
  });

  test("a comma is a decimal point only when a suffix follows it", () => {
    assert.equal(parseCompactNumber("1,2K"), 1200);
    assert.equal(parseCompactNumber("1,200"), 1200);
  });

  test("trailing words are ignored", () => {
    assert.equal(parseCompactNumber("340 likes"), 340);
    assert.equal(parseCompactNumber("12.3K Followers"), 12300);
  });

  test("a following word is never read as a magnitude suffix", () => {
    // OBSERVED on a live LinkedIn reaction button. Reading the M of "Maddy" as millions turned a
    // reaction count of 366 into 366000000.
    assert.equal(parseCompactNumber("366 Maddy Viswanath and 365 others"), 366);
    assert.equal(parseCompactNumber("12 Bobs"), 12);
    assert.equal(parseCompactNumber("40 Karens"), 40);
    // A genuine suffix, sitting against the digits, still works.
    assert.equal(parseCompactNumber("366M followers"), 366_000_000);
  });

  test("anything without a number is null, never zero", () => {
    assert.equal(parseCompactNumber(""), null);
    assert.equal(parseCompactNumber("   "), null);
    assert.equal(parseCompactNumber("Like"), null);
    assert.equal(parseCompactNumber(null), null);
    assert.equal(parseCompactNumber(undefined), null);
  });
});

describe("countFromAriaLabel", () => {
  const label = "12 replies, 5 reposts, 340 likes, 6 bookmarks, 12345 views";

  test("reads each labelled count out of the accessible name", () => {
    assert.equal(countFromAriaLabel(label, "replies"), 12);
    assert.equal(countFromAriaLabel(label, "reposts"), 5);
    assert.equal(countFromAriaLabel(label, "likes"), 340);
    assert.equal(countFromAriaLabel(label, "views"), 12345);
  });

  test("an abbreviated count in the label still expands", () => {
    assert.equal(countFromAriaLabel("2 replies, 1.2K likes, 45.6K views", "likes"), 1200);
    assert.equal(countFromAriaLabel("2 replies, 1.2K likes, 45.6K views", "views"), 45600);
  });

  test("two adjacent numbers do not merge into one", () => {
    // A live LinkedIn counts blob runs the reaction total straight into the comment count. A
    // space-tolerant number pattern read "1,234  56 comments" as 123456.
    assert.equal(countFromAriaLabel("1,234  56 comments  7 reposts", "comments"), 56);
    assert.equal(countFromAriaLabel("1,234  56 comments  7 reposts", "reposts"), 7);
  });

  test("a word the label does not carry is null, not zero", () => {
    // This is the whole point: a platform that does not publish views must not look like a
    // platform that published a view count of zero.
    assert.equal(countFromAriaLabel("12 replies, 340 likes", "views"), null);
    assert.equal(countFromAriaLabel(null, "views"), null);
    assert.equal(countFromAriaLabel("", "views"), null);
  });
});

describe("canonicalUrl", () => {
  test("drops tracking query strings and fragments so a repeat run dedupes", () => {
    assert.equal(canonicalUrl("https://x.com/someone/status/123?s=20&t=abc"), "https://x.com/someone/status/123");
    assert.equal(canonicalUrl("https://x.com/someone/status/123#photo1"), "https://x.com/someone/status/123");
  });

  test("folds twitter.com and www into one spelling", () => {
    assert.equal(canonicalUrl("https://twitter.com/someone/status/123"), "https://x.com/someone/status/123");
    assert.equal(canonicalUrl("https://www.linkedin.com/feed/update/urn:li:activity:1/"), "https://linkedin.com/feed/update/urn:li:activity:1");
  });

  test("a string that is not a url comes back untouched rather than throwing", () => {
    assert.equal(canonicalUrl("  not a url  "), "not a url");
  });
});

describe("blockSignal", () => {
  test("recognises being told to back off", () => {
    assert.equal(blockSignal("Rate limit exceeded")?.reason, "rate_limited");
    assert.equal(blockSignal("Too many requests. Please try again later.")?.reason, "rate_limited");
    assert.equal(blockSignal("We detected unusual activity from this account")?.reason, "blocked");
    assert.equal(blockSignal("Please complete the CAPTCHA to continue")?.reason, "blocked");
    assert.equal(blockSignal("Access denied")?.reason, "blocked");
  });

  test("an ordinary page is not a block", () => {
    assert.equal(blockSignal("Here are the latest posts from this account."), null);
    assert.equal(blockSignal(""), null);
    assert.equal(blockSignal(null), null);
  });

  test("block language far down the page does not trip it", () => {
    // Someone's post can contain the words. Only the top of the page is a real block notice.
    const page = "A normal timeline. " + "x".repeat(5_000) + " rate limit";
    assert.equal(blockSignal(page), null);
  });
});

describe("politeDelay", () => {
  test("jitters around the requested delay and never returns zero for a real delay", () => {
    assert.equal(politeDelay(8_000, () => 0), 6_000);
    assert.equal(politeDelay(8_000, () => 0.5), 8_000);
    assert.equal(politeDelay(8_000, () => 1), 10_000);
  });

  test("no delay requested means no delay", () => {
    assert.equal(politeDelay(0), 0);
  });
});

describe("the registry", () => {
  test("covers exactly the three text platforms, and no video platform", () => {
    assert.deepEqual([...AUTO_PLATFORMS], ["x", "linkedin", "substack"]);
    assert.deepEqual(Object.keys(PATTERN_COLLECTORS).sort(), ["linkedin", "substack", "x"]);
    assert.equal(isAutoPlatform("tiktok"), false);
    assert.equal(collectorFor("tiktok"), null);
    assert.equal(collectorFor("youtube"), null);
  });

  test("every registered collector is registered under its own platform", () => {
    for (const [key, collector] of Object.entries(PATTERN_COLLECTORS)) {
      assert.equal(collector?.platform, key);
      assert.ok(collector?.name);
      assert.ok(collector?.version);
      assert.ok(collector?.profileUrl("@someone").startsWith("https://"));
    }
  });

  test("collectedBy stamps name and version, which is the audit trail on every entry", () => {
    assert.equal(collectedBy({ name: "x-public-profile", version: "1" }), "x-public-profile@1");
  });
});

describe("mergeByUrl", () => {
  function e(url: string, body = "a"): CorpusEntry {
    return {
      id: url, platform: "x", handle: "@someone", creator: "Someone", niche: "n", url,
      posted_at: null, collected_at: "2026-08-22T00:00:00.000Z", kind: "text", body,
      transcript_source: null,
      metrics: { views: null, likes: null, comments: null, shares: null, followers: null },
    };
  }

  test("keeps everything seen so far, which is what a virtualized timeline needs", () => {
    // The second capture is a moving window: the platform dropped post 1 from the DOM and
    // rendered post 3. Without merging, post 1 would be lost.
    const collected = new Map<string, CorpusEntry>();
    assert.equal(mergeByUrl(collected, [e("u1"), e("u2")]), 2);
    assert.equal(mergeByUrl(collected, [e("u2"), e("u3")]), 1);
    assert.deepEqual([...collected.keys()], ["u1", "u2", "u3"]);
  });

  test("a capture with nothing new adds nothing, which is the signal to stop scrolling", () => {
    const collected = new Map<string, CorpusEntry>();
    mergeByUrl(collected, [e("u1")]);
    assert.equal(mergeByUrl(collected, [e("u1")]), 0);
    assert.equal(collected.size, 1);
  });

  test("the first version of a post wins, so a later partial render cannot overwrite it", () => {
    const collected = new Map<string, CorpusEntry>();
    mergeByUrl(collected, [e("u1", "the full body")]);
    mergeByUrl(collected, [e("u1", "")]);
    assert.equal(collected.get("u1")?.body, "the full body");
  });
});
