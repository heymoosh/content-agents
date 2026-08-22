// Outlier scoring. Pure functions over numbers already recorded on the entries. Nothing here
// fetches, reads, or writes anything. If a number was not collected, the answer is null, never a
// guess.

import type { CorpusEntry, OutlierThresholds, OutlierVerdict } from "./types.js";

// The account needs this many OTHER entries with views before a baseline means anything.
export const MIN_BASELINE_SAMPLE = 3;

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// How far the post travelled past the account's own follower count. Null when either number is
// missing, and when followers is 0 so the ratio never becomes Infinity.
export function viewFollowerRatio(entry: CorpusEntry): number | null {
  const { views, followers } = entry.metrics;
  if (views === null || followers === null) return null;
  if (followers <= 0) return null;
  return views / followers;
}

// How far the post travelled past the same account's typical post. The entry itself is excluded
// from its own baseline, matched by url, which is the same key the corpus dedupes on.
export function baselineMultiple(entry: CorpusEntry, accountEntries: CorpusEntry[]): number | null {
  const views = entry.metrics.views;
  if (views === null) return null;
  const others = accountEntries
    .filter((other) => other.url !== entry.url)
    .map((other) => other.metrics.views)
    .filter((v): v is number => v !== null);
  if (others.length < MIN_BASELINE_SAMPLE) return null;
  const base = median(others);
  if (base === null || base <= 0) return null;
  return views / base;
}

// An entry is an outlier when EITHER bar clears. reason names the bar that fired, or "both".
export function classifyOutlier(
  entry: CorpusEntry,
  accountEntries: CorpusEntry[],
  thresholds: OutlierThresholds,
): OutlierVerdict {
  const ratio = viewFollowerRatio(entry);
  const multiple = baselineMultiple(entry, accountEntries);
  const ratioFired = ratio !== null && ratio >= thresholds.view_follower_ratio;
  const baselineFired = multiple !== null && multiple >= thresholds.baseline_multiple;
  const reason = ratioFired && baselineFired ? "both" : ratioFired ? "ratio" : baselineFired ? "baseline" : "none";
  return { isOutlier: ratioFired || baselineFired, ratio, multiple, reason };
}
