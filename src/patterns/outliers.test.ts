// Outlier math, including every case where the honest answer is null instead of a number.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { baselineMultiple, classifyOutlier, median, viewFollowerRatio, MIN_BASELINE_SAMPLE } from "./outliers.js";
import type { CorpusEntry, OutlierThresholds } from "./types.js";

function entry(overrides: Omit<Partial<CorpusEntry>, "metrics"> & { metrics?: Partial<CorpusEntry["metrics"]> } = {}): CorpusEntry {
  const { metrics, ...rest } = overrides;
  return {
    id: "x-someone-00000000",
    platform: "x",
    handle: "@someone",
    creator: "Someone",
    niche: "building-solopreneur",
    url: "https://example.com/1",
    posted_at: "2026-08-01",
    collected_at: "2026-08-20T00:00:00.000Z",
    kind: "text",
    body: "a post",
    transcript_source: null,
    metrics: { views: null, likes: null, comments: null, shares: null, followers: null, ...metrics },
    ...rest,
  };
}

// Builds n other posts for the same account, each with the given view count.
function others(views: (number | null)[]): CorpusEntry[] {
  return views.map((v, i) => entry({ url: `https://example.com/other-${i}`, metrics: { views: v } }));
}

const thresholds: OutlierThresholds = { view_follower_ratio: 5, baseline_multiple: 3 };

describe("median", () => {
  test("odd count takes the middle value", () => {
    assert.equal(median([5, 1, 3]), 3);
  });

  test("even count averages the two middle values", () => {
    assert.equal(median([1, 3, 5, 9]), 4);
  });

  test("empty is null, not 0", () => {
    assert.equal(median([]), null);
  });
});

describe("viewFollowerRatio", () => {
  test("divides views by followers", () => {
    assert.equal(viewFollowerRatio(entry({ metrics: { views: 50_000, followers: 10_000 } })), 5);
  });

  test("null when views were not collected", () => {
    assert.equal(viewFollowerRatio(entry({ metrics: { views: null, followers: 10_000 } })), null);
  });

  test("null when followers were not collected", () => {
    assert.equal(viewFollowerRatio(entry({ metrics: { views: 50_000, followers: null } })), null);
  });

  test("null when followers is 0, so the ratio never becomes Infinity", () => {
    assert.equal(viewFollowerRatio(entry({ metrics: { views: 50_000, followers: 0 } })), null);
  });
});

describe("baselineMultiple", () => {
  test("divides views by the median of the account's OTHER posts", () => {
    const e = entry({ metrics: { views: 900 } });
    assert.equal(baselineMultiple(e, [e, ...others([100, 300, 200])]), 4.5);
  });

  test("the entry itself never counts toward its own baseline, matched by url", () => {
    const e = entry({ url: "https://example.com/hit", metrics: { views: 900 } });
    const withSelf = baselineMultiple(e, [e, ...others([100, 300, 200])]);
    const withoutSelf = baselineMultiple(e, others([100, 300, 200]));
    assert.equal(withSelf, withoutSelf, "including the entry in the account list changes nothing");
  });

  test(`null with fewer than ${MIN_BASELINE_SAMPLE} other scored posts`, () => {
    const e = entry({ metrics: { views: 900 } });
    assert.equal(baselineMultiple(e, [e, ...others([100, 300])]), null);
  });

  test("other posts with no view count do not count toward the sample", () => {
    const e = entry({ metrics: { views: 900 } });
    assert.equal(baselineMultiple(e, [e, ...others([100, 300, null, null])]), null);
  });

  test("null when the entry itself has no view count", () => {
    const e = entry({ metrics: { views: null } });
    assert.equal(baselineMultiple(e, [e, ...others([100, 300, 200])]), null);
  });

  test("null when the median is 0, so the multiple never becomes Infinity", () => {
    const e = entry({ metrics: { views: 900 } });
    assert.equal(baselineMultiple(e, [e, ...others([0, 0, 0])]), null);
  });
});

describe("classifyOutlier", () => {
  test("the ratio alone can fire, and reason says so", () => {
    const e = entry({ metrics: { views: 60_000, followers: 10_000 } });
    const v = classifyOutlier(e, [e], thresholds);
    assert.equal(v.isOutlier, true);
    assert.equal(v.reason, "ratio");
    assert.equal(v.ratio, 6);
    assert.equal(v.multiple, null, "no baseline sample, so the multiple stays null");
  });

  test("the baseline alone can fire, and reason says so", () => {
    const e = entry({ metrics: { views: 900 } });
    const v = classifyOutlier(e, [e, ...others([100, 300, 200])], thresholds);
    assert.equal(v.isOutlier, true);
    assert.equal(v.reason, "baseline");
    assert.equal(v.multiple, 4.5);
    assert.equal(v.ratio, null, "no follower count, so the ratio stays null");
  });

  test('both bars clearing reports reason "both"', () => {
    const e = entry({ metrics: { views: 60_000, followers: 10_000 } });
    const v = classifyOutlier(e, [e, ...others([1000, 3000, 2000])], thresholds);
    assert.equal(v.isOutlier, true);
    assert.equal(v.reason, "both");
  });

  test("a post that clears neither bar is not an outlier", () => {
    const e = entry({ metrics: { views: 20_000, followers: 10_000 } });
    const v = classifyOutlier(e, [e, ...others([15_000, 18_000, 20_000])], thresholds);
    assert.equal(v.isOutlier, false);
    assert.equal(v.reason, "none");
    assert.equal(v.ratio, 2);
  });

  test("exactly at a threshold counts as clearing it", () => {
    const e = entry({ metrics: { views: 50_000, followers: 10_000 } });
    const v = classifyOutlier(e, [e], thresholds);
    assert.equal(v.isOutlier, true);
    assert.equal(v.reason, "ratio");
  });

  test("an entry with no numbers at all is not an outlier and both scores stay null", () => {
    const e = entry();
    const v = classifyOutlier(e, [e], thresholds);
    assert.deepEqual(v, { isOutlier: false, ratio: null, multiple: null, reason: "none" });
  });
});
