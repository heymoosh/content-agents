// The baseline store, and the single number this whole change exists for: a winner measured
// against the community's true median instead of against other winners.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { appendBaseline, baselineIndex, buildBaseline, loadBaselineIndex, readBaselines } from "./baselines.js";
import { baselineMultiple, classifyOutlier, isWinnersOnlySample, recordedBaselineMultiple } from "./outliers.js";
import { isEligibleBaselinePost, parseListing, toBaselineSample, toStagedEntry } from "./reddit.js";
import { buildOpeners } from "./openers.js";
import { accountKey } from "./corpus.js";
import type { AccountBaseline, CorpusEntry, OutlierThresholds } from "./types.js";

const NOW = 1787000000;
const FIXTURES = join(import.meta.dirname, "fixtures");
const topListing = JSON.parse(readFileSync(join(FIXTURES, "reddit-top-listing.json"), "utf8")) as unknown;
const newWindow = JSON.parse(readFileSync(join(FIXTURES, "reddit-new-window.json"), "utf8")) as unknown;

function tempPath(): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "baselines-"));
  return { path: join(dir, "baselines.jsonl"), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

// The unbiased window, exactly as the collector would build it off the fixture.
function fixtureBaseline(): AccountBaseline {
  const eligible = parseListing(newWindow).posts.filter((post) =>
    isEligibleBaselinePost(post, { nowSeconds: NOW, minAgeSeconds: 3 * 86400 }),
  );
  const baseline = buildBaseline({ platform: "reddit", handle: "r/Fixturesub" }, toBaselineSample(eligible), {
    followers: 1234567,
    method: "fixture window",
    collected_at: "2026-08-23T12:00:00.000Z",
  });
  assert.ok(baseline);
  return baseline;
}

// The five top-of-year winners, exactly as the collector would stage them.
function fixtureWinners(baseline: AccountBaseline | null): CorpusEntry[] {
  return parseListing(topListing).posts.map((post, index) =>
    toStagedEntry(post, {
      handle: "r/Fixturesub",
      niche: "adhd",
      listing: "top",
      window: "year",
      rank: index + 1,
      collectedAt: "2026-08-23T12:00:00.000Z",
      subscribers: 1234567,
      baseline,
      route: "fixture",
    }),
  );
}

describe("buildBaseline", () => {
  test("takes the true median of the unbiased window and records the window itself", () => {
    const baseline = fixtureBaseline();
    // Upvotes 1,1,2,2,3,3,4,7,120 with 0..8 comments each, so engagement 1,2,4,5,7,8,10,14,128.
    // The mean would be 21; the median is 7, and the median is what an ordinary post in this
    // community actually looks like.
    assert.equal(baseline.median, 7);
    assert.equal(baseline.sample_size, 9);
    assert.equal(baseline.scores.length, 9);
    assert.equal(baseline.metric, "engagement");
    assert.equal(baseline.followers, 1234567);
    assert.ok(baseline.window_start && baseline.window_end && baseline.window_start <= baseline.window_end);
  });

  test("an empty sample is null, never a median of zero", () => {
    const baseline = buildBaseline({ platform: "reddit", handle: "r/Fixturesub" }, [], {
      followers: null,
      method: "empty",
      collected_at: "2026-08-23T12:00:00.000Z",
    });
    assert.equal(baseline, null);
  });
});

describe("the store", () => {
  test("round-trips and keys accounts the way the corpus groups them", () => {
    const { path, cleanup } = tempPath();
    try {
      assert.deepEqual(readBaselines(path), []);
      appendBaseline(fixtureBaseline(), path);
      const index = loadBaselineIndex(path);
      assert.equal(index.get("reddit|r/fixturesub")?.median, 7);
    } finally {
      cleanup();
    }
  });

  test("a re-measured account replaces its earlier baseline rather than growing a second", () => {
    const first = fixtureBaseline();
    const second = { ...first, median: 11, collected_at: "2026-09-01T00:00:00.000Z" };
    assert.equal(baselineIndex([first, second]).get("reddit|r/fixturesub")?.median, 11);
  });
});

describe("the multiple this change exists to fix", () => {
  const thresholds: OutlierThresholds = { view_follower_ratio: 5, baseline_multiple: 3 };

  test("against other winners the biggest post of the year reads as barely above average", () => {
    // What the old path computed: the median of the account's OTHER collected entries. Every one
    // of them is also a top-of-year post, so this measures a winner against winners.
    const winners = fixtureWinners(null);
    const sibling = baselineMultiple(winners[0], winners);
    assert.ok(sibling);
    assert.equal(Math.round(sibling.multiple * 100) / 100, 2.38);
  });

  test("against the community's true median the same post is three orders of magnitude bigger", () => {
    const baseline = fixtureBaseline();
    const winners = fixtureWinners(baseline);
    const recorded = recordedBaselineMultiple(winners[0], baseline);
    assert.ok(recorded);
    // 12286 upvotes plus 1339 comments, over an ordinary post's 7.
    assert.equal(Math.round(recorded.multiple * 10) / 10, 1946.4);
    assert.equal(recorded.metric, "engagement");
  });

  test("classifyOutlier uses the recorded baseline when one exists, and says so", () => {
    const baseline = fixtureBaseline();
    const winners = fixtureWinners(baseline);
    const verdict = classifyOutlier(winners[0], winners, thresholds, baseline);
    assert.equal(verdict.isOutlier, true);
    assert.equal(verdict.baselineSource, "recorded");
    assert.equal(Math.round((verdict.multiple ?? 0) * 10) / 10, 1946.4);
  });

  test("with no recorded baseline a winners-only collection reports no multiple at all", () => {
    // The honest answer. A sibling multiple here would be printed as if it were a fact about the
    // community, and it is not one.
    const winners = fixtureWinners(null);
    assert.equal(isWinnersOnlySample(winners), true);
    const verdict = classifyOutlier(winners[0], winners, thresholds, null);
    assert.equal(verdict.multiple, null);
    assert.equal(verdict.baselineSource, null);
    assert.equal(verdict.reason, "none");
  });

  test("a collection that never marked how it was sampled keeps the old sibling behaviour", () => {
    // Entries collected before `sample` existed say nothing about how they were chosen, so
    // nothing is assumed about them in either direction.
    const winners = fixtureWinners(null).map((entry) => {
      const copy = { ...entry };
      delete copy.sample;
      return copy;
    });
    assert.equal(isWinnersOnlySample(winners), false);
    const verdict = classifyOutlier(winners[0], winners, thresholds, null);
    assert.equal(verdict.baselineSource, "siblings");
    assert.ok(verdict.multiple !== null);
  });

  test("a baseline measured on the other metric is refused rather than divided in", () => {
    const baseline = { ...fixtureBaseline(), metric: "views" as const };
    // The winners are scored on engagement, because reddit publishes no view count.
    assert.equal(recordedBaselineMultiple(fixtureWinners(null)[0], baseline), null);
  });

  test("a zero median never becomes an infinite multiple", () => {
    const baseline = { ...fixtureBaseline(), median: 0 };
    assert.equal(recordedBaselineMultiple(fixtureWinners(null)[0], baseline), null);
  });
});

// The opener bank shows Muxin a multiple next to a proven opener at pick time, so it has to divide
// by the same denominator the outlier step does.
describe("the opener bank", () => {
  test("shows the measured multiple and says it was measured", () => {
    const baseline = fixtureBaseline();
    const winners = fixtureWinners(baseline);
    const openers = buildOpeners(winners, { baselines: new Map([[accountKey(winners[0]), baseline]]) });
    const top = openers.find((opener) => opener.corpus_entry_id === winners[0].id);
    assert.ok(top);
    assert.equal(Math.round((top.performance.multiple ?? 0) * 10) / 10, 1946.4);
    assert.match(top.performance.note, /measured against a real baseline/);
  });

  test("with no measured baseline it reports no multiple and explains why", () => {
    const winners = fixtureWinners(null);
    const openers = buildOpeners(winners, {});
    const top = openers.find((opener) => opener.corpus_entry_id === winners[0].id);
    assert.ok(top);
    assert.equal(top.performance.multiple, null);
    assert.match(top.performance.note, /median of winners/);
  });
});
