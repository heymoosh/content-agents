// Staged-entry validation. The config is a small literal rather than the real
// config/pattern-mining.yaml, so these tests keep passing when Muxin edits the seed list.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validateEntry } from "./collect.js";
import type { PatternMiningConfig } from "./types.js";

const config: PatternMiningConfig = {
  niches: ["building-solopreneur", "inner-journey", "civic-democracy"],
  accounts: [],
  outlier_thresholds: { youtube: { view_follower_ratio: 15, baseline_multiple: 5 } },
  targets: { corpus_size_min: 20, corpus_size_max: 50 },
};

function staged(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    platform: "youtube",
    handle: "@someone",
    creator: "Someone",
    niche: "inner-journey",
    url: "https://www.youtube.com/shorts/abc123",
    posted_at: "2026-08-01",
    kind: "video",
    body: "the words that were said",
    transcript_source: "captions",
    metrics: { views: 1000, likes: 10, comments: null, shares: null, followers: null },
    ...overrides,
  };
}

describe("validateEntry transcript_source", () => {
  test('a video entry may say "caption", meaning body is the written caption and not the spoken words', () => {
    const { entry, errors } = validateEntry(staged({ transcript_source: "caption" }), config);
    assert.deepEqual(errors, []);
    assert.equal(entry?.transcript_source, "caption");
  });

  test("a video entry still may not leave transcript_source null", () => {
    const { entry, errors } = validateEntry(staged({ transcript_source: null }), config);
    assert.equal(entry, null);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /video entry needs transcript_source/);
  });

  test('a text entry may not say "caption" either; text must leave it null', () => {
    const { entry, errors } = validateEntry(
      staged({ kind: "text", transcript_source: "caption" }),
      config,
    );
    assert.equal(entry, null);
    assert.match(errors[0], /text entry must leave transcript_source null/);
  });

  test('"captions" and "manual" are both still valid on a video entry', () => {
    for (const source of ["captions", "manual"] as const) {
      const { entry, errors } = validateEntry(staged({ transcript_source: source }), config);
      assert.deepEqual(errors, [], `${source} should be valid`);
      assert.equal(entry?.transcript_source, source);
    }
  });

  test("a value outside the four allowed ones is rejected, and the message lists them", () => {
    const { entry, errors } = validateEntry(staged({ transcript_source: "subtitles" }), config);
    assert.equal(entry, null);
    assert.match(errors[0], /"manual", "captions", "caption", or null/);
  });
});
