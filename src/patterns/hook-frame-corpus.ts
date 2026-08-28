// Deterministic corpus side of the hook frame library.
//
// Which corpus entries instantiate a frame is a judgment call, made once when the bank is built.
// Everything downstream of that call is arithmetic, and it lives here so a frame's support numbers
// can be recomputed from the read-only corpus at any time and compared against what the bank
// claims. A frame whose numbers do not survive that recomputation does not ship.
//
// The performance signal is deliberately WITHIN-CREATOR. Comparing a 7.9M subscriber channel's view
// count against a 900 follower account's would measure audience size, not the opening. Ranking each
// entry against the other entries in its own file removes that, and it gives the thing the earlier
// mechanism proposals never had: a denominator.

import type { ParsedCreatorFile, ParsedEntry } from "./creator-content-normalization.js";
import type { HookFrameSupport } from "./hook-frame-library.js";

export const HOOK_FRAME_CORPUS_VERSION = "hook-frame-corpus-v1" as const;

/** Below this many ranked entries a within-file quartile is noise, so the file contributes none. */
export const MINIMUM_ENTRIES_FOR_RANKING = 8;

/**
 * Metric names that stand in for reach, most preferred first. Only one is taken per entry: mixing
 * views on one post with likes on another would rank a file against itself on two different scales.
 */
const PRIMARY_METRICS = [
  "views", "plays", "impressions", "reads",
  "likes", "reactions", "hearts", "points", "upvotes", "claps", "saves",
];

export interface RankedEntry {
  readonly ref: string;
  readonly file: string;
  readonly platform: string | null;
  /** The reach count this entry was ranked on, or null when nothing readable was captured. */
  readonly primaryCount: number | null;
  readonly primaryMetric: string | null;
  /** null when the entry could not be ranked, either for want of a count or of a file distribution. */
  readonly topQuartile: boolean | null;
}

export interface CorpusRanking {
  readonly byRef: ReadonlyMap<string, RankedEntry>;
  /** Entries that carried a readable count AND sat in a file with a usable distribution. */
  readonly rankedEntries: number;
  readonly topQuartileEntries: number;
  /** Share of ranked entries in the top quartile. The base rate a frame is read against. */
  readonly baseRate: number;
  readonly filesWithDistribution: number;
}

function primaryCount(entry: ParsedEntry): { count: number; metric: string } | null {
  if (!entry.metrics.available) return null;
  for (const wanted of PRIMARY_METRICS) {
    for (const value of entry.metrics.values) {
      if (value.metric.toLowerCase().includes(wanted)) return { count: value.count, metric: value.metric };
    }
  }
  return null;
}

/**
 * Rank every entry against the other entries in its own creator file.
 *
 * A file needs `MINIMUM_ENTRIES_FOR_RANKING` readable counts before its quartile means anything.
 * Entries in thinner files stay `topQuartile: null` rather than being scored against a distribution
 * of three, and a frame supported only by those honestly reports zero ranked instances.
 */
export function buildCorpusRanking(files: readonly ParsedCreatorFile[]): CorpusRanking {
  const counted = new Map<string, { entry: ParsedEntry; file: ParsedCreatorFile; count: number; metric: string }>();
  const perFile = new Map<string, number[]>();
  for (const file of files) {
    for (const entry of file.entries) {
      const primary = primaryCount(entry);
      if (primary === null) continue;
      counted.set(entry.ref, { entry, file, count: primary.count, metric: primary.metric });
      const bucket = perFile.get(file.file) ?? [];
      bucket.push(primary.count);
      perFile.set(file.file, bucket);
    }
  }

  const thresholds = new Map<string, number>();
  for (const [file, counts] of perFile) {
    if (counts.length < MINIMUM_ENTRIES_FOR_RANKING) continue;
    const sorted = [...counts].sort((left, right) => left - right);
    // Nearest-rank 75th percentile. Deterministic, and it does not interpolate a count that no
    // entry actually had.
    thresholds.set(file, sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75))]!);
  }

  const byRef = new Map<string, RankedEntry>();
  let rankedEntries = 0;
  let topQuartileEntries = 0;
  for (const file of files) {
    for (const entry of file.entries) {
      const hit = counted.get(entry.ref);
      const threshold = thresholds.get(file.file);
      let topQuartile: boolean | null = null;
      if (hit !== undefined && threshold !== undefined) {
        topQuartile = hit.count >= threshold;
        rankedEntries += 1;
        if (topQuartile) topQuartileEntries += 1;
      }
      byRef.set(entry.ref, {
        ref: entry.ref,
        file: file.file,
        platform: file.header.platform,
        primaryCount: hit?.count ?? null,
        primaryMetric: hit?.metric ?? null,
        topQuartile,
      });
    }
  }

  return {
    byRef,
    rankedEntries,
    topQuartileEntries,
    baseRate: rankedEntries === 0 ? 0 : topQuartileEntries / rankedEntries,
    filesWithDistribution: thresholds.size,
  };
}

export interface RecomputedSupport {
  readonly support: HookFrameSupport;
  /** Refs in the frame that resolve to no entry in the corpus. A hallucinated citation. */
  readonly unresolvedRefs: readonly string[];
  readonly platforms: readonly string[];
}

/** Recompute a frame's support from its cited refs. Never trusts the numbers written in the bank. */
export function recomputeSupport(refs: readonly string[], ranking: CorpusRanking): RecomputedSupport {
  const unique = [...new Set(refs)];
  const unresolvedRefs: string[] = [];
  const creatorFiles = new Set<string>();
  const platforms = new Set<string>();
  let rankedInstances = 0;
  let topQuartileInstances = 0;
  for (const ref of unique) {
    const entry = ranking.byRef.get(ref);
    if (entry === undefined) {
      unresolvedRefs.push(ref);
      continue;
    }
    creatorFiles.add(entry.file);
    if (entry.platform !== null) platforms.add(entry.platform);
    if (entry.topQuartile !== null) {
      rankedInstances += 1;
      if (entry.topQuartile) topQuartileInstances += 1;
    }
  }
  return {
    support: {
      instances: unique.length - unresolvedRefs.length,
      distinctCreatorFiles: creatorFiles.size,
      rankedInstances,
      topQuartileInstances,
    },
    unresolvedRefs: unresolvedRefs.sort(),
    platforms: [...platforms].sort(),
  };
}

export interface SupportMismatch {
  readonly field: keyof HookFrameSupport;
  readonly claimed: number;
  readonly recomputed: number;
}

/** Compare a bank's declared support against the recomputation. Empty means the bank is honest. */
export function compareSupport(claimed: HookFrameSupport, recomputed: HookFrameSupport): SupportMismatch[] {
  const fields: (keyof HookFrameSupport)[] = ["instances", "distinctCreatorFiles", "rankedInstances", "topQuartileInstances"];
  return fields
    .filter((field) => claimed[field] !== recomputed[field])
    .map((field) => ({ field, claimed: claimed[field], recomputed: recomputed[field] }));
}

/**
 * Every distinct word run of `length` words across a creator file's raw text, as a set of strings.
 *
 * Used to answer "does this frame's fixed wording appear verbatim in the corpus". Built over raw
 * text and thrown away by the caller; nothing here is persisted.
 */
export function corpusRunIndex(rawTexts: readonly string[], length: number): Set<string> {
  const index = new Set<string>();
  for (const raw of rawTexts) {
    const words = raw
      .toLowerCase()
      .split(/\s+/)
      .map((word) => word.replace(/[^a-z0-9']/g, ""))
      .filter((word) => word.length > 0);
    for (let start = 0; start + length <= words.length; start += 1) {
      index.add(words.slice(start, start + length).join(" "));
    }
  }
  return index;
}
