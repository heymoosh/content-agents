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

describe("validateEntry visual", () => {
  function visual(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      form: "image",
      onscreen_text: "THE 5 AM RULE",
      description: "a slide of stacked text on a plain background",
      slide_count: null,
      thread_length: null,
      body_is_complete: false,
      ...overrides,
    };
  }

  test("an entry with no visual at all still validates, so entries collected before the field survive", () => {
    const { entry, errors } = validateEntry(staged(), config);
    assert.deepEqual(errors, []);
    assert.equal(entry?.visual, undefined);
  });

  test("a valid visual survives onto the entry rather than being validated and dropped", () => {
    const { entry, errors } = validateEntry(staged({ visual: visual() }), config);
    assert.deepEqual(errors, []);
    assert.deepEqual(entry?.visual, {
      form: "image",
      onscreen_text: "THE 5 AM RULE",
      description: "a slide of stacked text on a plain background",
      slide_count: null,
      thread_length: null,
      body_is_complete: false,
    });
  });

  test("all five forms are accepted", () => {
    for (const form of ["image", "carousel", "video", "thread", "none"] as const) {
      const { entry, errors } = validateEntry(staged({ visual: visual({ form }) }), config);
      assert.deepEqual(errors, [], `${form} should be valid`);
      assert.equal(entry?.visual?.form, form);
    }
  });

  test("a sixth form is rejected, and the message lists the five", () => {
    const { entry, errors } = validateEntry(staged({ visual: visual({ form: "gif" }) }), config);
    assert.equal(entry, null);
    assert.match(errors[0], /image, carousel, video, thread, none/);
  });

  test("body_is_complete must be a boolean, never missing and never a stringly-typed guess", () => {
    for (const bad of [undefined, "false", 0, null]) {
      const { entry, errors } = validateEntry(
        staged({ visual: visual({ body_is_complete: bad }) }),
        config,
      );
      assert.equal(entry, null, `${JSON.stringify(bad)} should be rejected`);
      assert.match(errors[0], /body_is_complete must be true or false/);
    }
  });

  test("onscreen_text and description may be null, which is how an unreadable image is recorded", () => {
    const { entry, errors } = validateEntry(
      staged({ visual: visual({ onscreen_text: null, description: null }) }),
      config,
    );
    assert.deepEqual(errors, []);
    assert.equal(entry?.visual?.onscreen_text, null);
    assert.equal(entry?.visual?.description, null);
  });

  test("onscreen_text may not be a number dressed up as text", () => {
    const { entry, errors } = validateEntry(staged({ visual: visual({ onscreen_text: 12 }) }), config);
    assert.equal(entry, null);
    assert.match(errors[0], /visual.onscreen_text must be a string or null/);
  });

  test("slide_count and thread_length take a non-negative number or null", () => {
    const ok = validateEntry(
      staged({ visual: visual({ form: "carousel", slide_count: 9, thread_length: null }) }),
      config,
    );
    assert.deepEqual(ok.errors, []);
    assert.equal(ok.entry?.visual?.slide_count, 9);

    const bad = validateEntry(staged({ visual: visual({ thread_length: -1 }) }), config);
    assert.equal(bad.entry, null);
    assert.match(bad.errors[0], /visual.thread_length must be a non-negative number or null/);
  });

  test("visual must be an object, not an array of them", () => {
    const { entry, errors } = validateEntry(staged({ visual: [visual()] }), config);
    assert.equal(entry, null);
    assert.match(errors[0], /visual must be an object when present/);
  });
});
