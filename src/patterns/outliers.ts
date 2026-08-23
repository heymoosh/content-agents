// Outlier scoring. Pure functions over numbers already recorded on the entries. Nothing here
// fetches, reads, or writes anything. If a number was not collected, the answer is null, never a
// guess.

import type {
  AccountBaseline,
  BaselineMetric,
  BaselineSource,
  BaselineTerm,
  CorpusEntry,
  OutlierThresholds,
  OutlierVerdict,
} from "./types.js";

// The account needs this many OTHER comparable same-kind entries before a baseline means anything.
export const MIN_BASELINE_SAMPLE = 3;

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// The four counts a travel score can be built from, in the order entryScore prefers them. This is
// the shape both sides of a baseline division speak, so a sample of ordinary posts and a collected
// winner are described in exactly the same words.
export interface MetricCounts {
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
}

// The interaction counts that make up an engagement score. Keep this list and the fallback branch
// of entryScore in step: they are the same three numbers, named once.
export const ENGAGEMENT_TERMS: readonly BaselineTerm[] = ["likes", "comments", "shares"] as const;

// Which terms a whole SAMPLE can be measured on: the ones every post in it carries.
//
// All-or-nothing per term, on purpose. A median built from some posts' likes-plus-shares and other
// posts' likes alone is not a median of anything, and it would quietly become the denominator of
// every multiple on that account.
//
// Views win outright where every post has them, mirroring entryScore's own priority, so a sample
// is never half a reach measure and half an interaction measure.
export function commonTerms(samples: MetricCounts[]): BaselineTerm[] {
  if (samples.length === 0) return [];
  if (samples.every((sample) => sample.views !== null)) return ["views"];
  return ENGAGEMENT_TERMS.filter((term) => samples.every((sample) => sample[term] !== null));
}

// The score of one post over an EXACT list of terms, and null when any of them is missing.
//
// This is what makes a baseline division safe. The baseline records the terms its median was
// measured on, and the winner's numerator is then built from those same terms and no others, so a
// two-term denominator can never meet a three-term numerator. Before this existed, the reddit
// baseline summed upvotes and comments while the corpus scored upvotes, comments and shares; it
// happened to agree only because reddit has no share count, and the first platform with one would
// have inflated every multiple silently.
export function scoreOverTerms(metrics: MetricCounts, terms: readonly BaselineTerm[]): number | null {
  if (terms.length === 0) return null;
  let total = 0;
  for (const term of terms) {
    const value = metrics[term];
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    total += value;
  }
  return total;
}

// Which kind of quantity a term list describes. "views" is only ever measured alone.
export function metricForTerms(terms: readonly BaselineTerm[]): BaselineMetric | null {
  if (terms.length === 0) return null;
  return terms[0] === "views" ? "views" : "engagement";
}

// The best available single number for "how much did this post travel", plus which kind of number
// it is. Priority order, and why:
//
//   1. views, when recorded. Views count reach directly, and they do not depend on how willing an
//      audience is to press a button, so they are the closest thing to the quantity the baseline
//      concept actually means.
//   2. otherwise the sum of the public interaction counts that ARE recorded: likes, comments,
//      shares. This is what is left on platforms that do not publish a view count. A public view
//      count is shown on X, but LinkedIn impressions are visible only to the post author and
//      Substack does not expose per-post views publicly, so without this fallback every LinkedIn
//      and Substack entry would score "not an outlier" forever.
//   3. null when nothing at all was recorded.
//
// The sum adds whichever of the three fields are present, so an entry with only likes still
// scores. That means two engagement scores can be built from different field sets (likes alone vs
// likes plus comments) and are therefore only roughly comparable. Deliberate: splitting engagement
// into per-field-set buckets would recreate the same dead end this fallback exists to remove.
//
// There is no "reposts" field on CorpusMetrics. `shares` is that number, so do not add a
// reposts term here expecting it to pick anything up.
function entryScore(entry: CorpusEntry): { value: number; kind: BaselineMetric } | null {
  const { views, likes, comments, shares } = entry.metrics;
  if (views !== null) return { value: views, kind: "views" };
  const parts = [likes, comments, shares].filter((n): n is number => n !== null);
  if (parts.length === 0) return null;
  return { value: parts.reduce((sum, n) => sum + n, 0), kind: "engagement" };
}

// The number half of entryScore, for callers that only need "how far did this travel".
export function engagementScore(entry: CorpusEntry): number | null {
  return entryScore(entry)?.value ?? null;
}

// How far the post travelled past the account's own follower count. Null when either number is
// missing, and when followers is 0 so the ratio never becomes Infinity.
//
// This bar stays views-only on purpose. A like-to-follower ratio is a different quantity, and
// scoring it against the same threshold would be worse than not scoring it at all.
export function viewFollowerRatio(entry: CorpusEntry): number | null {
  const { views, followers } = entry.metrics;
  if (views === null || followers === null) return null;
  if (followers <= 0) return null;
  return views / followers;
}

// How far the post travelled past the same account's typical post, measured on whichever metric
// entryScore picked. The entry itself is excluded from its own baseline, matched by url, which is
// the same key the corpus dedupes on.
//
// Metric kinds are never mixed. A views score and an engagement score are not the same quantity,
// so an account's other entries only join the baseline when their score came from the SAME kind.
// Entries scored on the other kind drop out of the sample rather than being averaged in, which
// can leave the sample under MIN_BASELINE_SAMPLE, and then the answer is null. The kind used
// comes back with the number so a reader is never left guessing what a 4x meant.
export function baselineMultiple(
  entry: CorpusEntry,
  accountEntries: CorpusEntry[],
): { multiple: number; metric: BaselineMetric } | null {
  const scored = entryScore(entry);
  if (scored === null) return null;
  const others = accountEntries
    .filter((other) => other.url !== entry.url)
    .map((other) => entryScore(other))
    .filter((s): s is { value: number; kind: BaselineMetric } => s !== null && s.kind === scored.kind)
    .map((s) => s.value);
  if (others.length < MIN_BASELINE_SAMPLE) return null;
  const base = median(others);
  if (base === null || base <= 0) return null;
  return { multiple: scored.value / base, metric: scored.kind };
}

// How far the post travelled past a RECORDED baseline: an account's true typical post, measured
// on a sample nobody selected for performance.
//
// This is the honest version of baselineMultiple, and it exists because the sibling version is
// wrong wherever the collection itself is a list of winners. On reddit that is every entry: all of
// them came out of a top-of-year listing, so the sibling median is a median of winners. r/ADHD's
// biggest post of the year reads 2.2x against its siblings and 4095x against the community's true
// median of 3. Same post, same number collected, two answers, and only one of them is a fact
// about the platform.
//
// Null when the entry has no score, when the baseline was measured on the other kind of metric,
// and when the recorded median is 0 or less, because dividing by that turns "nothing happened"
// into Infinity.
export function recordedBaselineMultiple(
  entry: CorpusEntry,
  baseline: AccountBaseline,
): { multiple: number; metric: BaselineMetric } | null {
  // A record written before terms existed cannot say what its median counted, so it cannot be
  // divided into anything safely. Refusing is the honest answer; re-measure to get a number back.
  if (!Array.isArray(baseline.terms) || baseline.terms.length === 0) return null;
  const metric = metricForTerms(baseline.terms);
  if (metric === null) return null;
  // The numerator is built from the baseline's own terms, so the two sides are the same quantity
  // by construction rather than by the caller remembering to make them match. Null here means the
  // post is missing a count the baseline was measured on, and a multiple across different term
  // sets is not a smaller error than no multiple at all.
  const value = scoreOverTerms(entry.metrics, baseline.terms);
  if (value === null) return null;
  if (!Number.isFinite(baseline.median) || baseline.median <= 0) return null;
  return { multiple: value / baseline.median, metric };
}

// True when this account's collected entries are a selected-for-performance sample, so their
// median is a median of winners and cannot stand in for a baseline. Read off what the collector
// recorded, never guessed from the platform: an entry with no `sample` block says nothing either
// way, and a collection of unmarked entries keeps the old behaviour.
export function isWinnersOnlySample(accountEntries: CorpusEntry[]): boolean {
  const marked = accountEntries.filter((entry) => entry.sample !== undefined);
  return marked.length > 0 && marked.every((entry) => entry.sample?.role === "winner");
}

// An entry is an outlier when EITHER bar clears. reason names the bar that fired, or "both".
//
// `baseline` is the account's recorded baseline where one has been measured. Pass it and the
// multiple is measured against the account's true typical post; leave it out and the multiple
// falls back to the median of the account's other collected entries, which is only as unbiased as
// the collection is. Where the collection marks itself as winners-only and no recorded baseline
// was passed, the multiple comes back null rather than as a sibling number that would be read as
// authoritative.
export function classifyOutlier(
  entry: CorpusEntry,
  accountEntries: CorpusEntry[],
  thresholds: OutlierThresholds,
  baseline: AccountBaseline | null = null,
): OutlierVerdict {
  const ratio = viewFollowerRatio(entry);
  const recorded = baseline ? recordedBaselineMultiple(entry, baseline) : null;
  const siblings = recorded === null && !isWinnersOnlySample(accountEntries) ? baselineMultiple(entry, accountEntries) : null;
  const source: BaselineSource | null = recorded ? "recorded" : siblings ? "siblings" : null;
  const multiple = recorded?.multiple ?? siblings?.multiple ?? null;
  const baselineMetric = recorded?.metric ?? siblings?.metric ?? null;
  const ratioFired = ratio !== null && ratio >= thresholds.view_follower_ratio;
  const baselineFired = multiple !== null && multiple >= thresholds.baseline_multiple;
  const reason = ratioFired && baselineFired ? "both" : ratioFired ? "ratio" : baselineFired ? "baseline" : "none";
  return { isOutlier: ratioFired || baselineFired, ratio, multiple, baselineMetric, baselineSource: source, reason };
}
