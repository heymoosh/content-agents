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
import { median } from "./outliers.js";
import type { AccountBaseline, BaselineMetric, Platform } from "./types.js";

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
export interface BaselineSamplePost {
  // The platform's own score. Reddit's upvotes minus downvotes, which lands in metrics.likes.
  score: number;
  // The comment count, or null where the route did not return one.
  comments: number | null;
  // ISO date string of when the post went up, used only for the window bounds.
  posted_at: string | null;
}

// The quantity a baseline is measured in, and it deliberately mirrors what outliers.ts computes
// for a corpus entry with no view count: the sum of the public interaction counts on record.
//
// This has to be the SAME quantity on both sides of the division or the multiple is nonsense. A
// median of upvotes divided into a winner's upvotes-plus-comments reports a bigger multiple than
// really happened, because the numerator counts something the denominator left out.
export function sampleEngagement(post: BaselineSamplePost): number {
  return post.score + (post.comments ?? 0);
}

// Builds the baseline record from an already-filtered sample. Filtering is the caller's job,
// because what belongs in an unbiased window is platform knowledge, not arithmetic.
//
// Returns null on an empty sample rather than a zero median. A zero denominator would turn every
// multiple into Infinity, which reads like an enormous finding and means nothing happened.
export function buildBaseline(
  account: { platform: Platform; handle: string },
  sample: BaselineSamplePost[],
  // `metric` names the quantity the scores are in, and defaults to "engagement" because that is
  // what an upvote score is: a public interaction count, not a view count. Pass "views" only where
  // the sample really is view counts.
  meta: { followers: number | null; method: string; collected_at: string; metric?: BaselineMetric },
): AccountBaseline | null {
  if (sample.length === 0) return null;
  const scores = sample.map(sampleEngagement);
  const value = median(scores);
  if (value === null) return null;
  const dates = sample.map((post) => post.posted_at).filter((d): d is string => typeof d === "string" && d !== "");
  dates.sort();
  return {
    platform: account.platform,
    handle: account.handle,
    metric: meta.metric ?? "engagement",
    median: value,
    sample_size: sample.length,
    window_start: dates[0] ?? null,
    window_end: dates[dates.length - 1] ?? null,
    scores,
    followers: meta.followers,
    method: meta.method,
    collected_at: meta.collected_at,
  };
}
