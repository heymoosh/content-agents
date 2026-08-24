// The baseline store, and the single number this whole change exists for: a winner measured
// against the community's true median instead of against other winners.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { appendBaseline, baselineIndex, buildBaseline, loadBaselineIndex, readBaselines } from "./baselines.js";
import {
  baselineMultiple,
  classifyOutlier,
  engagementScore,
  isWinnersOnlySample,
  median,
  recordedBaselineMultiple,
} from "./outliers.js";
import { isEligibleBaselinePost, parseListing, toBaselineSample, toStagedEntry } from "./reddit.js";
import { buildOpeners } from "./openers.js";
import { accountKey } from "./corpus.js";
import type { AccountBaseline, BaselineTerm, CorpusEntry, MediaForm, OutlierThresholds } from "./types.js";

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
    // Read off the sample, never passed in: reddit publishes no view count and no share count, so
    // those terms are absent and the median counts exactly what was there.
    assert.deepEqual(baseline.terms, ["likes", "comments"]);
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

  test("a baseline measured on a count the post does not carry is refused, not divided in", () => {
    // A share-counting median cannot be divided into a reddit post, which has no share count.
    // Refusing is the point: a multiple across two different term sets is not a smaller error
    // than no multiple at all.
    const baseline = { ...fixtureBaseline(), terms: ["likes", "comments", "shares"] as BaselineTerm[] };
    assert.equal(recordedBaselineMultiple(fixtureWinners(null)[0], baseline), null);
  });

  test("a record written before terms existed cannot be divided into anything", () => {
    const { terms: _dropped, ...legacy } = fixtureBaseline();
    assert.equal(recordedBaselineMultiple(fixtureWinners(null)[0], legacy as AccountBaseline), null);
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

// The second instance of the same bug class, caught before it shipped. A baseline summing two
// terms into a winner scored on three reads as a finding and is not one.
describe("a shares-bearing platform", () => {
  const doc = JSON.parse(readFileSync(join(FIXTURES, "shares-platform-window.json"), "utf8")) as {
    account: { platform: "threads"; handle: string };
    window: Array<{ metrics: { views: number | null; likes: number; comments: number; shares: number }; posted_at: string }>;
    winner: { metrics: { views: number | null; likes: number; comments: number; shares: number }; posted_at: string };
  };

  function winnerEntry(): CorpusEntry {
    return {
      id: "threads-fixturecreator-00000000",
      platform: doc.account.platform,
      handle: doc.account.handle,
      creator: "Fixture Creator",
      niche: "adhd",
      url: "https://example.com/threads/winner",
      posted_at: doc.winner.posted_at,
      collected_at: "2026-08-23T12:00:00.000Z",
      kind: "text",
      body: "invented",
      transcript_source: null,
      metrics: { ...doc.winner.metrics, followers: null },
      media: {
        form: "text-only" as MediaForm,
        onscreen_text: null,
        description: "fixture",
        duration_seconds: null,
        media_count: null,
        has_captions: null,
        aspect: null,
        body_is_complete: true,
      },
      sample: { listing: "top", window: null, rank: 1, role: "winner" },
    };
  }

  const baseline = buildBaseline(doc.account, doc.window, {
    followers: null,
    method: "fixture window",
    collected_at: "2026-08-23T12:00:00.000Z",
  });

  test("the median counts every term the window carries, shares included", () => {
    assert.ok(baseline);
    assert.deepEqual(baseline.terms, ["likes", "comments", "shares"]);
    assert.equal(baseline.median, 60);
  });

  test("the old arithmetic inflated the multiple by two thirds, the new one is exact", () => {
    assert.ok(baseline);
    // What the old code did: a denominator summing likes and comments only, divided into a
    // numerator that also counted shares. Reproduced here so the failure is visible, not asserted
    // from memory.
    const twoTermMedian = median(doc.window.map((post) => post.metrics.likes + post.metrics.comments));
    assert.equal(twoTermMedian, 36);
    const winner = winnerEntry();
    const threeTermNumerator = engagementScore(winner);
    assert.equal(threeTermNumerator, 6000);
    const inflated = (threeTermNumerator as number) / (twoTermMedian as number);
    assert.equal(Math.round(inflated * 100) / 100, 166.67);

    // What it does now: the numerator is rebuilt from the baseline's own terms, so both sides
    // count likes, comments and shares.
    const honest = recordedBaselineMultiple(winner, baseline);
    assert.ok(honest);
    assert.equal(honest.multiple, 100);
    assert.equal(honest.metric, "engagement");
  });

  test("a shares count of 0 and a shares of null are not the same statement", () => {
    // Zero claims nobody shared the post. Null says the platform never offered the number. They
    // must not be interchangeable, because one belongs in the median and the other cannot.
    const zeroed = doc.window.map((post) => ({ ...post, metrics: { ...post.metrics, shares: 0 } }));
    const withZeros = buildBaseline(doc.account, zeroed, {
      followers: null,
      method: "fixture window",
      collected_at: "2026-08-23T12:00:00.000Z",
    });
    const nulled = doc.window.map((post) => ({ ...post, metrics: { ...post.metrics, shares: null } }));
    const withNulls = buildBaseline(doc.account, nulled, {
      followers: null,
      method: "fixture window",
      collected_at: "2026-08-23T12:00:00.000Z",
    });
    assert.ok(withZeros);
    assert.ok(withNulls);

    // A real zero counts: shares stays a term, and it adds nothing because it genuinely was
    // nothing. A null drops the term entirely.
    assert.deepEqual(withZeros.terms, ["likes", "comments", "shares"]);
    assert.deepEqual(withNulls.terms, ["likes", "comments"]);
    // Same median either way here, which is exactly why the term list has to carry the difference:
    // the number alone cannot tell you what was counted.
    assert.equal(withZeros.median, 36);
    assert.equal(withNulls.median, 36);

    // And the difference lands where it matters, on the numerator. The winner shared 2400 times.
    const winner = winnerEntry();
    assert.equal(recordedBaselineMultiple(winner, withZeros)?.multiple, 6000 / 36);
    assert.equal(recordedBaselineMultiple(winner, withNulls)?.multiple, 3600 / 36);
  });

  test("a sample where only some posts carry shares drops that term from both sides", () => {
    // All-or-nothing per term. A median built from some posts' shares and other posts' silence is
    // not a median of anything, so shares leaves the term list and the numerator loses it too.
    const patchy = doc.window.map((post, index) => ({
      ...post,
      metrics: { ...post.metrics, shares: index === 0 ? null : post.metrics.shares },
    }));
    const mixed = buildBaseline(doc.account, patchy, {
      followers: null,
      method: "fixture window",
      collected_at: "2026-08-23T12:00:00.000Z",
    });
    assert.ok(mixed);
    assert.deepEqual(mixed.terms, ["likes", "comments"]);
    assert.equal(mixed.median, 36);
    const honest = recordedBaselineMultiple(winnerEntry(), mixed);
    // 3000 likes plus 600 comments over 36, with shares left out of BOTH sides.
    assert.equal(Math.round((honest?.multiple ?? 0) * 100) / 100, 100);
  });
});
