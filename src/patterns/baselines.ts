// The baseline store: one AccountBaseline per account in data/patterns/baselines.jsonl.
//
// Separate from the corpus on purpose. The corpus holds posts that were collected BECAUSE they
// travelled, so its median is the median of winners. A baseline is the opposite kind of sample:
// ordinary posts nobody picked, which is the only denominator an honest multiple can use.
//
// Latest write wins per account, so re-measuring a subreddit replaces its baseline rather than
// growing a second one.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PATTERNS_DIR, accountKey } from "./corpus.js";
import { commonTerms, median, metricForTerms, scoreOverTerms, type MetricCounts } from "./outliers.js";
import type { AccountBaseline, Platform } from "./types.js";

export const BASELINES_PATH = join(PATTERNS_DIR, "baselines.jsonl");

export function readBaselines(path: string = BASELINES_PATH): AccountBaseline[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as AccountBaseline);
}

// Keyed the same way the corpus groups accounts, so a lookup never depends on how a handle was
// capitalised or whether it carried a leading @. Later records replace earlier ones, which is how
// a re-measured subreddit takes effect without an edit.
export function baselineIndex(baselines: AccountBaseline[]): Map<string, AccountBaseline> {
  const index = new Map<string, AccountBaseline>();
  for (const baseline of baselines) index.set(accountKey(baseline), baseline);
  return index;
}

export function loadBaselineIndex(path: string = BASELINES_PATH): Map<string, AccountBaseline> {
  return baselineIndex(readBaselines(path));
}

export function appendBaseline(baseline: AccountBaseline, path: string = BASELINES_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(baseline) + "\n", "utf8");
}

// One ordinary post in the unbiased window, reduced to numbers. No title, no body, no author: a
// baseline is a distribution, not a collection.
//
// `metrics` carries the SAME four counts a corpus entry carries, and every one of them is
// required. A collector cannot quietly leave `shares` out of the sample the way it could when this
// type held one pre-summed number: it has to say `shares: null`, which is a statement that the
// route exposes no share count, and that statement then travels into `terms` and constrains the
// numerator too. There is no longer any way to hand a two-term denominator to a three-term
// numerator, because neither side chooses its own terms.
export interface BaselineSamplePost {
  metrics: MetricCounts;
  // ISO date string of when the post went up, used only for the window bounds.
  posted_at: string | null;
}

// Builds the baseline record from an already-filtered sample. Filtering is the caller's job,
// because what belongs in an unbiased window is platform knowledge, not arithmetic.
//
// Returns null on an empty sample rather than a zero median. A zero denominator would turn every
// multiple into Infinity, which reads like an enormous finding and means nothing happened.
export function buildBaseline(
  account: { platform: Platform; handle: string },
  sample: BaselineSamplePost[],
  meta: { followers: number | null; method: string; collected_at: string },
): AccountBaseline | null {
  if (sample.length === 0) return null;
  // The terms are read off the sample, not passed in. A caller cannot declare the median to be
  // something other than what was actually added up.
  const terms = commonTerms(sample.map((post) => post.metrics));
  const metric = metricForTerms(terms);
  if (metric === null) return null;
  const scores = sample.map((post) => scoreOverTerms(post.metrics, terms));
  if (scores.some((score) => score === null)) return null;
  const value = median(scores as number[]);
  if (value === null) return null;
  const dates = sample.map((post) => post.posted_at).filter((d): d is string => typeof d === "string" && d !== "");
  dates.sort();
  return {
    platform: account.platform,
    handle: account.handle,
    metric,
    terms,
    median: value,
    sample_size: sample.length,
    window_start: dates[0] ?? null,
    window_end: dates[dates.length - 1] ?? null,
    scores: scores as number[],
    followers: meta.followers,
    method: meta.method,
    collected_at: meta.collected_at,
  };
}
