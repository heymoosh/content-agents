import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  parseDerisk,
  lowDimensions,
  missingBeats,
  needsFramePass,
  deriskNote,
  summarizeDerisk,
  LOW_SCORE_THRESHOLD,
} from "./score.js";

const FULL_SCORES = {
  belief_load_bearing: 4,
  test_cheap: 4,
  test_reader_runnable: true,
  decision_named: true,
  saves_if_false_concrete: 4,
  has_signoff: true,
};

describe("parseDerisk: reads fm.derisk_scores.{...}", () => {
  test("returns all six fields when present with the right types", () => {
    assert.deepEqual(parseDerisk({ derisk_scores: FULL_SCORES }), FULL_SCORES);
  });

  test("undefined when derisk_scores is missing entirely (most content never goes through /derisk)", () => {
    assert.equal(parseDerisk({}), undefined);
  });

  test("undefined when only some fields are present", () => {
    assert.equal(parseDerisk({ derisk_scores: { belief_load_bearing: 4, test_cheap: 4 } }), undefined);
  });

  test("undefined when a numeric dimension is a non-number", () => {
    assert.equal(parseDerisk({ derisk_scores: { ...FULL_SCORES, belief_load_bearing: "4" } }), undefined);
  });

  test("undefined when a boolean beat is not a boolean", () => {
    assert.equal(parseDerisk({ derisk_scores: { ...FULL_SCORES, test_reader_runnable: "true" } }), undefined);
  });

  test("undefined when derisk_scores is not an object", () => {
    assert.equal(parseDerisk({ derisk_scores: "high" }), undefined);
  });
});

describe(`lowDimensions: soft-gate at <= ${LOW_SCORE_THRESHOLD}`, () => {
  test("a numeric dimension at the threshold counts as low", () => {
    assert.deepEqual(lowDimensions({ ...FULL_SCORES, test_cheap: 3 }), ["test_cheap"]);
  });

  test("a dimension above the threshold does not count as low", () => {
    assert.deepEqual(lowDimensions(FULL_SCORES), []);
  });

  test("multiple low dimensions are all reported, in rubric order", () => {
    assert.deepEqual(
      lowDimensions({ ...FULL_SCORES, belief_load_bearing: 2, saves_if_false_concrete: 3 }),
      ["belief_load_bearing", "saves_if_false_concrete"],
    );
  });

  test("boolean beats never appear here even when false", () => {
    assert.deepEqual(lowDimensions({ ...FULL_SCORES, test_reader_runnable: false }), []);
  });
});

describe("missingBeats: which boolean frame beats are absent", () => {
  test("empty when every beat is present", () => {
    assert.deepEqual(missingBeats(FULL_SCORES), []);
  });

  test("names a single missing beat", () => {
    assert.deepEqual(missingBeats({ ...FULL_SCORES, has_signoff: false }), ["has_signoff"]);
  });

  test("names multiple missing beats, in rubric order", () => {
    assert.deepEqual(
      missingBeats({ ...FULL_SCORES, test_reader_runnable: false, has_signoff: false }),
      ["test_reader_runnable", "has_signoff"],
    );
  });

  test("numeric dimensions never appear here", () => {
    assert.deepEqual(missingBeats({ ...FULL_SCORES, test_cheap: 1 }), []);
  });
});

describe("needsFramePass: soft signal only, mirrors needsSpinPass", () => {
  test("false when every beat is present and no dimension is low", () => {
    assert.equal(needsFramePass(FULL_SCORES), false);
  });

  test("true when a boolean beat is missing even with all-high numeric scores", () => {
    assert.equal(needsFramePass({ ...FULL_SCORES, decision_named: false }), true);
  });

  test("true when a numeric dimension is low even with every beat present", () => {
    assert.equal(needsFramePass({ ...FULL_SCORES, test_cheap: 2 }), true);
  });
});

describe("deriskNote: the exact review-queue.md notes-cell suffix", () => {
  test("undefined when the frame is complete and strong", () => {
    assert.equal(deriskNote(FULL_SCORES), undefined);
  });

  test("names missing beats", () => {
    assert.equal(
      deriskNote({ ...FULL_SCORES, has_signoff: false }),
      "flag: derisk frame incomplete (missing: has_signoff)",
    );
  });

  test("names low numeric dimensions separately from missing beats", () => {
    assert.equal(
      deriskNote({ ...FULL_SCORES, belief_load_bearing: 2, test_cheap: 3 }),
      "flag: derisk frame weak (low: belief_load_bearing, test_cheap)",
    );
  });

  test("combines both flags with '; ' when both trip, missing beats first", () => {
    assert.equal(
      deriskNote({ ...FULL_SCORES, test_reader_runnable: false, belief_load_bearing: 2 }),
      "flag: derisk frame incomplete (missing: test_reader_runnable); flag: derisk frame weak (low: belief_load_bearing)",
    );
  });

  test("multiple missing beats and multiple low dimensions all named", () => {
    assert.equal(
      deriskNote({ ...FULL_SCORES, test_reader_runnable: false, has_signoff: false, test_cheap: 1 }),
      "flag: derisk frame incomplete (missing: test_reader_runnable, has_signoff); flag: derisk frame weak (low: test_cheap)",
    );
  });
});

describe("summarizeDerisk: advisory rollup for npm run validate, never a gate", () => {
  test("counts only scored sources; unscored ones are skipped, not violations", () => {
    const result = summarizeDerisk([
      { file: "content/a/source.md", fm: { derisk_scores: { ...FULL_SCORES, belief_load_bearing: 2 } } },
      { file: "content/b/source.md", fm: { derisk_scores: FULL_SCORES } },
      { file: "content/c/source.md", fm: { title: "no derisk pass" } },
    ]);
    assert.equal(result.scored, 2);
    assert.equal(result.flagged, 1);
    assert.deepEqual(result.flaggedFiles, [{ file: "content/a/source.md", low: ["belief_load_bearing"], missing: [] }]);
  });

  test("flags a source with a missing beat even when no numeric dim is low", () => {
    const result = summarizeDerisk([
      { file: "content/a/source.md", fm: { derisk_scores: { ...FULL_SCORES, decision_named: false } } },
    ]);
    assert.equal(result.flagged, 1);
    assert.deepEqual(result.flaggedFiles, [{ file: "content/a/source.md", low: [], missing: ["decision_named"] }]);
  });

  test("all-complete-and-strong reports zero flagged", () => {
    const result = summarizeDerisk([{ file: "a.md", fm: { derisk_scores: FULL_SCORES } }]);
    assert.equal(result.flagged, 0);
    assert.deepEqual(result.flaggedFiles, []);
  });
});
