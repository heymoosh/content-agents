import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCreatorFile } from "./creator-content-normalization.js";
import {
  MINIMUM_ENTRIES_FOR_RANKING,
  buildCorpusRanking,
  compareSupport,
  corpusRunIndex,
  recomputeSupport,
} from "./hook-frame-corpus.js";
import type { HookFrameSupport } from "./hook-frame-library.js";

// Synthetic fixtures only. Nothing below is read from, or derived from, the real corpus under
// docs/content-studio-program/creator-content/.

type MetricsSpec =
  | { readonly kind: "views"; readonly count: number }
  | { readonly kind: "likes"; readonly count: number }
  | { readonly kind: "both"; readonly likes: number; readonly views: number }
  | { readonly kind: "none" };

function metricsLine(spec: MetricsSpec): string {
  switch (spec.kind) {
    case "views":
      return `**Metrics:** ${spec.count} views`;
    case "likes":
      return `**Metrics:** ${spec.count} likes`;
    case "both":
      return `**Metrics:** ${spec.likes} likes, ${spec.views} views`;
    case "none":
      return "**Metrics:** Not captured";
  }
}

/** A minimal, obviously-synthetic creator file with one "## Posts" section. */
function buildCreatorMarkdown(fileName: string, platformLabel: string, specs: readonly MetricsSpec[]): string {
  const lines: string[] = [
    `**Handle:** @${fileName.replace(/\.md$/, "")}`,
    `**Primary platform:** ${platformLabel}`,
    "**Primary media type:** Text",
    "**Audience size:** 10K",
    "**Topic(s):** testing",
    "**Capture method:** manual capture",
    `**Posts captured:** ${specs.length}/${specs.length}`,
    "",
    "## Posts",
    "",
  ];
  specs.forEach((spec, index) => {
    const n = index + 1;
    const day = String(n).padStart(2, "0");
    lines.push(
      `### ${n}. Synthetic Title ${n} (2025-01-${day}) [link](https://example.test/${fileName}/${n})`,
      metricsLine(spec),
      "",
      "**Opening hook (verbatim):**",
      `> Synthetic hook line ${n}, invented for this test only.`,
      "",
    );
  });
  return lines.join("\n");
}

function parsedFile(fileName: string, platformLabel: string, specs: readonly MetricsSpec[]) {
  return parseCreatorFile(fileName, buildCreatorMarkdown(fileName, platformLabel, specs));
}

test("a file below MINIMUM_ENTRIES_FOR_RANKING never gets a quartile", () => {
  assert.equal(MINIMUM_ENTRIES_FOR_RANKING, 8);
  const specs: MetricsSpec[] = Array.from({ length: 5 }, (_, i) => ({ kind: "views", count: (i + 1) * 10 }));
  const file = parsedFile("sparse-creator.md", "YouTube", specs);
  assert.equal(file.entries.length, 5);
  const ranking = buildCorpusRanking([file]);
  assert.equal(ranking.filesWithDistribution, 0);
  assert.equal(ranking.rankedEntries, 0);
  assert.equal(ranking.topQuartileEntries, 0);
  for (const entry of file.entries) {
    const ranked = ranking.byRef.get(entry.ref);
    assert.equal(ranked?.topQuartile, null);
  }
});

test("a file at or above MINIMUM_ENTRIES_FOR_RANKING gets a threshold and marks its top quarter true", () => {
  const specs: MetricsSpec[] = Array.from({ length: 8 }, (_, i) => ({ kind: "views", count: (i + 1) * 10 }));
  const file = parsedFile("eight-creator.md", "YouTube", specs);
  const ranking = buildCorpusRanking([file]);
  assert.equal(ranking.filesWithDistribution, 1);
  assert.equal(ranking.rankedEntries, 8);
  const topQuartileCount = file.entries.filter((entry) => ranking.byRef.get(entry.ref)?.topQuartile === true).length;
  assert.ok(topQuartileCount > 0);
});

test("nearest-rank 75th percentile marks exactly the top quarter for counts 1..12", () => {
  const specs: MetricsSpec[] = Array.from({ length: 12 }, (_, i) => ({ kind: "views", count: i + 1 }));
  const file = parsedFile("quartile-creator.md", "YouTube", specs);
  const ranking = buildCorpusRanking([file]);
  assert.equal(ranking.filesWithDistribution, 1);
  assert.equal(ranking.rankedEntries, 12);
  const topQuartileEntryNumbers = file.entries
    .filter((entry) => ranking.byRef.get(entry.ref)?.topQuartile === true)
    .map((entry) => entry.entryNumber)
    .sort((a, b) => a - b);
  // sorted counts 1..12, nearest-rank 75th percentile index = floor(12 * 0.75) = 9 (0-based) -> value 10.
  assert.deepEqual(topQuartileEntryNumbers, [10, 11, 12]);
  const belowThresholdEntryNumbers = file.entries
    .filter((entry) => ranking.byRef.get(entry.ref)?.topQuartile === false)
    .map((entry) => entry.entryNumber)
    .sort((a, b) => a - b);
  assert.deepEqual(belowThresholdEntryNumbers, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(ranking.topQuartileEntries, 3);
});

test("primaryCount prefers views over likes, uses only one metric per entry, and leaves unavailable metrics unranked", () => {
  const file = parsedFile("preference-creator.md", "YouTube", [
    { kind: "both", likes: 50, views: 200 },
    { kind: "likes", count: 75 },
    { kind: "none" },
  ]);
  const [entryBoth, entryLikesOnly, entryNone] = file.entries;
  assert.ok(entryBoth && entryLikesOnly && entryNone);
  const ranking = buildCorpusRanking([file]);

  const rankedBoth = ranking.byRef.get(entryBoth.ref);
  assert.equal(rankedBoth?.primaryMetric, "views");
  assert.equal(rankedBoth?.primaryCount, 200);

  const rankedLikesOnly = ranking.byRef.get(entryLikesOnly.ref);
  assert.equal(rankedLikesOnly?.primaryMetric, "likes");
  assert.equal(rankedLikesOnly?.primaryCount, 75);

  const rankedNone = ranking.byRef.get(entryNone.ref);
  assert.equal(rankedNone?.primaryMetric, null);
  assert.equal(rankedNone?.primaryCount, null);
  assert.equal(rankedNone?.topQuartile, null);
});

test("baseRate is the topQuartile share of ranked entries, and 0 when nothing is rankable", () => {
  const specs: MetricsSpec[] = Array.from({ length: 12 }, (_, i) => ({ kind: "views", count: i + 1 }));
  const file = parsedFile("baserate-creator.md", "YouTube", specs);
  const ranking = buildCorpusRanking([file]);
  assert.equal(ranking.baseRate, 3 / 12);

  const emptyFile = parsedFile("empty-creator.md", "LinkedIn", [{ kind: "none" }, { kind: "none" }]);
  const emptyRanking = buildCorpusRanking([emptyFile]);
  assert.equal(emptyRanking.rankedEntries, 0);
  assert.equal(emptyRanking.baseRate, 0);
});

test("byRef covers every entry, including entries that could not be ranked", () => {
  const file = parsedFile("cover-creator.md", "LinkedIn", [{ kind: "views", count: 10 }, { kind: "none" }]);
  const ranking = buildCorpusRanking([file]);
  assert.equal(ranking.byRef.size, file.entries.length);
  for (const entry of file.entries) {
    assert.ok(ranking.byRef.has(entry.ref));
  }
});

test("recomputeSupport aggregates distinct files, dedupes refs, and separates ranked from unranked instances", () => {
  const quartile = parsedFile(
    "quartile-creator.md",
    "YouTube",
    Array.from({ length: 12 }, (_, i) => ({ kind: "views", count: i + 1 } as MetricsSpec)),
  );
  const sparse = parsedFile(
    "sparse-creator.md",
    "LinkedIn",
    Array.from({ length: 5 }, (_, i) => ({ kind: "views", count: (i + 1) * 10 } as MetricsSpec)),
  );
  const other = parsedFile("other-creator.md", "Substack", [
    { kind: "views", count: 5 },
    { kind: "views", count: 9 },
  ]);
  const ranking = buildCorpusRanking([quartile, sparse, other]);

  const entryBelowThreshold = quartile.entries[0]!; // count 1, ranked, not top quartile
  const entryTopQuartile = quartile.entries[9]!; // count 10, ranked, top quartile
  const sparseEntry = sparse.entries[0]!; // too few entries in file to rank
  const otherEntry = other.entries[0]!; // too few entries in file to rank

  const refs = [
    entryBelowThreshold.ref,
    entryTopQuartile.ref,
    sparseEntry.ref,
    otherEntry.ref,
    entryBelowThreshold.ref, // repeated on purpose
    "missing.md#entry-1-1", // resolves to nothing
  ];
  const result = recomputeSupport(refs, ranking);

  assert.deepEqual(result.unresolvedRefs, ["missing.md#entry-1-1"]);
  assert.equal(result.support.instances, 4); // 5 unique refs minus 1 unresolved
  assert.equal(result.support.distinctCreatorFiles, 3);
  assert.equal(result.support.rankedInstances, 2); // only the two quartile-file entries were rankable
  assert.equal(result.support.topQuartileInstances, 1); // only entryTopQuartile
  assert.deepEqual(result.platforms, ["linkedin", "substack", "youtube"]);
});

test("compareSupport returns [] when claimed matches recomputed", () => {
  const support: HookFrameSupport = { instances: 4, distinctCreatorFiles: 3, rankedInstances: 2, topQuartileInstances: 1 };
  assert.deepEqual(compareSupport(support, support), []);
});

test("compareSupport returns one mismatch per differing field", () => {
  const claimed: HookFrameSupport = { instances: 5, distinctCreatorFiles: 3, rankedInstances: 3, topQuartileInstances: 2 };
  const recomputed: HookFrameSupport = { instances: 4, distinctCreatorFiles: 3, rankedInstances: 2, topQuartileInstances: 2 };
  assert.deepEqual(compareSupport(claimed, recomputed), [
    { field: "instances", claimed: 5, recomputed: 4 },
    { field: "rankedInstances", claimed: 3, recomputed: 2 },
  ]);
});

test("corpusRunIndex builds every window of the given length, lowercased and stripped of punctuation", () => {
  const raw = "Hello, World! This is a Test.";
  const index = corpusRunIndex([raw], 3);
  assert.equal(index.size, 4);
  assert.ok(index.has("hello world this"));
  assert.ok(index.has("world this is"));
  assert.ok(index.has("this is a"));
  assert.ok(index.has("is a test"));
});

test("corpusRunIndex returns an empty set when the text is shorter than the window", () => {
  const index = corpusRunIndex(["short text"], 5);
  assert.equal(index.size, 0);
});

test("corpusRunIndex pools windows across multiple raw texts", () => {
  const index = corpusRunIndex(["one two three", "four five six"], 2);
  assert.deepEqual([...index].sort(), ["five six", "four five", "one two", "two three"]);
});
