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

// Substring matching on metric names is a trap: "interviews" contains "views", "displays" contains
// "plays", and "dislikes" contains "likes", which would rank an entry on a rejection count. Match
// whole words instead.
function metricMatches(metric: string, wanted: string): boolean {
  return metric
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((word) => word.length > 0)
    .includes(wanted);
}

function metricFor(entry: ParsedEntry, wanted: string): { count: number; metric: string } | null {
  if (!entry.metrics.available) return null;
  for (const value of entry.metrics.values) {
    if (metricMatches(value.metric, wanted)) return { count: value.count, metric: value.metric };
  }
  return null;
}

/**
 * The single metric a whole file is ranked on: the most preferred metric that most of its entries
 * carry. Choosing per entry instead would put a five million view post and a forty like post on one
 * scale, and the quartile would then measure which metric a post happened to report.
 */
export function fileMetric(entries: readonly ParsedEntry[]): string | null {
  let chosen: string | null = null;
  let chosenCoverage = 0;
  for (const wanted of PRIMARY_METRICS) {
    const coverage = entries.filter((entry) => metricFor(entry, wanted) !== null).length;
    if (coverage > chosenCoverage) {
      chosen = wanted;
      chosenCoverage = coverage;
    }
  }
  return chosen;
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
    const wanted = fileMetric(file.entries);
    if (wanted === null) continue;
    for (const entry of file.entries) {
      const primary = metricFor(entry, wanted);
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
    // The count at the 75% index, so the top quartile is the entries at or above it. Deterministic,
    // and it never interpolates a count no entry actually had. Note this is not the nearest-rank
    // percentile, which would put the cut one position lower and admit slightly more than a quarter.
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

/** Fixed runs shorter than this are too generic to be worth grounding. */
export const MINIMUM_GROUNDED_RUN_WORDS = 3;

/** A frame's fixed wording must appear in at least this many of its cited creators' files. */
export const MINIMUM_GROUNDING_CREATORS = 2;

export interface GroundingResult {
  /** Fixed runs of at least MINIMUM_GROUNDED_RUN_WORDS words that no cited creator actually wrote. */
  readonly ungroundedRuns: readonly string[];
  /** Runs only one cited creator wrote, which makes them that creator's wording, not common language. */
  readonly singleCreatorRuns: readonly string[];
}

/**
 * Check that a frame's own fixed wording is language its cited creators actually used.
 *
 * This is the mirror of the verbatim-run scan, and the two are not in tension. A long fixed run
 * found anywhere in the corpus is one creator's distinctive sentence and is refused. A SHORT fixed
 * run found in nobody's text was invented by whatever proposed the frame, and a short run found in
 * exactly one creator's text is that creator's phrasing. Only a run at least two cited creators
 * independently wrote is the common connective language a frame is allowed to carry.
 *
 * `runs` comes from `fixedRuns` on the template. `citedTexts` maps creator file to that file's raw
 * text, restricted to the files the frame cites.
 */
// Frames spell contractions out because config/voice.yaml prefers it; creators type them short.
// Without this, "hi i am" would read as ungrounded against a hook that plainly says "hi i'm".
const CONTRACTIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bi'm\b/g, "i am"], [/\bi've\b/g, "i have"], [/\bi'll\b/g, "i will"], [/\bi'd\b/g, "i would"],
  [/\byou're\b/g, "you are"], [/\byou've\b/g, "you have"], [/\byou'll\b/g, "you will"],
  [/\bwe're\b/g, "we are"], [/\bwe've\b/g, "we have"], [/\bwe'll\b/g, "we will"],
  [/\bthey're\b/g, "they are"], [/\bthey've\b/g, "they have"],
  [/\bit's\b/g, "it is"], [/\bthat's\b/g, "that is"], [/\bhere's\b/g, "here is"],
  [/\bthere's\b/g, "there is"], [/\bwhat's\b/g, "what is"], [/\bwho's\b/g, "who is"],
  [/\blet's\b/g, "let us"], [/\bdon't\b/g, "do not"], [/\bdoesn't\b/g, "does not"],
  [/\bdidn't\b/g, "did not"], [/\bisn't\b/g, "is not"], [/\baren't\b/g, "are not"],
  [/\bwasn't\b/g, "was not"], [/\bhaven't\b/g, "have not"], [/\bhasn't\b/g, "has not"],
  [/\bcan't\b/g, "can not"], [/\bcannot\b/g, "can not"], [/\bwon't\b/g, "will not"],
];

function groundingText(value: string): string {
  let text = value.toLowerCase().replace(/[‘’ʼ]/g, "'");
  for (const [pattern, replacement] of CONTRACTIONS) text = text.replace(pattern, replacement);
  return text
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9']/g, ""))
    .filter((word) => word.length > 0)
    .join(" ");
}

export function checkGrounding(
  runs: readonly (readonly string[])[],
  citedTexts: ReadonlyMap<string, string>,
): GroundingResult {
  const normalized = new Map<string, string>();
  for (const [file, raw] of citedTexts) normalized.set(file, groundingText(raw));
  const ungroundedRuns: string[] = [];
  const singleCreatorRuns: string[] = [];
  for (const run of runs) {
    if (run.length < MINIMUM_GROUNDED_RUN_WORDS) continue;
    const needle = groundingText(run.join(" "));
    if (needle.length === 0) continue;
    let found = 0;
    for (const haystack of normalized.values()) {
      // Word-boundary safe: both sides are single-spaced word sequences.
      if (haystack === needle || haystack.startsWith(`${needle} `) || haystack.endsWith(` ${needle}`) || haystack.includes(` ${needle} `)) {
        found += 1;
      }
    }
    if (found === 0) ungroundedRuns.push(needle);
    else if (found < MINIMUM_GROUNDING_CREATORS) singleCreatorRuns.push(needle);
  }
  return { ungroundedRuns, singleCreatorRuns };
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
      // Curly apostrophes first, or a corpus "don't" indexes as "dont" and never matches a
      // template's ASCII "don't", leaving the verbatim guard blind to a real copy.
      .replace(/[‘’ʼ]/g, "'")
      .split(/\s+/)
      .map((word) => word.replace(/[^a-z0-9']/g, ""))
      .filter((word) => word.length > 0);
    for (let start = 0; start + length <= words.length; start += 1) {
      index.add(words.slice(start, start + length).join(" "));
    }
  }
  return index;
}
