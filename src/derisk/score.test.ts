import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  parseDerisk,
  lowDimensions,
  needsAntiSaltyGuard,
  needsReworkPass,
  deriskNote,
  summarizeDerisk,
  LOW_SCORE_THRESHOLD,
} from "./score.js";

const FULL_SCORES = {
  load_bearing: 4,
  test_cheap: 4,
  test_decisive: 4,
  payoff_concrete: 4,
  reader_runnable: true,
  constructive: 4,
};

describe("parseDerisk: reads fm.derisk_scores.{...}", () => {
  test("returns all six fields when present with the right types", () => {
    assert.deepEqual(parseDerisk({ derisk_scores: FULL_SCORES }), FULL_SCORES);
  });

  test("undefined when derisk_scores is missing entirely (most content never goes through /derisk)", () => {
    assert.equal(parseDerisk({}), undefined);
  });

  test("undefined when only some fields are present", () => {
    assert.equal(parseDerisk({ derisk_scores: { load_bearing: 4, test_cheap: 4 } }), undefined);
  });

  test("undefined when a numeric dimension is a non-number", () => {
    assert.equal(parseDerisk({ derisk_scores: { ...FULL_SCORES, load_bearing: "4" } }), undefined);
  });

  test("undefined when reader_runnable is not a boolean", () => {
    assert.equal(parseDerisk({ derisk_scores: { ...FULL_SCORES, reader_runnable: "true" } }), undefined);
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
      lowDimensions({ ...FULL_SCORES, load_bearing: 2, payoff_concrete: 3 }),
      ["load_bearing", "payoff_concrete"],
    );
  });

  test("reader_runnable never appears (it's boolean, not scored 1-5)", () => {
    assert.deepEqual(lowDimensions({ ...FULL_SCORES, reader_runnable: false }), []);
  });
});

describe("needsAntiSaltyGuard: the reason this lens exists", () => {
  test("false when reader_runnable is true and constructive is above threshold", () => {
    assert.equal(needsAntiSaltyGuard(FULL_SCORES), false);
  });

  test("true when reader_runnable is false, even if every score is high", () => {
    assert.equal(needsAntiSaltyGuard({ ...FULL_SCORES, reader_runnable: false }), true);
  });

  test("true when constructive is at/below threshold, even if reader_runnable is true", () => {
    assert.equal(needsAntiSaltyGuard({ ...FULL_SCORES, constructive: 3 }), true);
  });
});

describe("needsReworkPass", () => {
  test("false when everything is high and reader-runnable", () => {
    assert.equal(needsReworkPass(FULL_SCORES), false);
  });

  test("true when the anti-salty guard trips even with no low numeric dimensions", () => {
    assert.equal(needsReworkPass({ ...FULL_SCORES, reader_runnable: false }), true);
  });

  test("true when a non-constructive numeric dimension is low", () => {
    assert.equal(needsReworkPass({ ...FULL_SCORES, test_decisive: 2 }), true);
  });
});

describe("deriskNote: the exact review-queue.md notes-cell suffix", () => {
  test("undefined when nothing is flagged", () => {
    assert.equal(deriskNote(FULL_SCORES), undefined);
  });

  test("names the anti-salty guard first when reader_runnable is false", () => {
    assert.equal(
      deriskNote({ ...FULL_SCORES, reader_runnable: false }),
      "flag: derisk anti-salty guard (reader_runnable: false, constructive: 4)",
    );
  });

  test("names the anti-salty guard when constructive is low, citing both fields", () => {
    assert.equal(
      deriskNote({ ...FULL_SCORES, constructive: 2 }),
      "flag: derisk anti-salty guard (reader_runnable: true, constructive: 2)",
    );
  });

  test("names low non-constructive dimensions separately from the anti-salty guard", () => {
    assert.equal(
      deriskNote({ ...FULL_SCORES, load_bearing: 2, test_cheap: 3 }),
      "flag: derisk weak (low: load_bearing, test_cheap)",
    );
  });

  test("combines both flags with '; ' when both trip", () => {
    assert.equal(
      deriskNote({ ...FULL_SCORES, reader_runnable: false, load_bearing: 2 }),
      "flag: derisk anti-salty guard (reader_runnable: false, constructive: 4); flag: derisk weak (low: load_bearing)",
    );
  });

  test("a low constructive score is not double-counted in the 'weak' list", () => {
    assert.equal(
      deriskNote({ ...FULL_SCORES, constructive: 2 }),
      "flag: derisk anti-salty guard (reader_runnable: true, constructive: 2)",
    );
  });
});

describe("summarizeDerisk: advisory rollup for npm run validate, never a gate", () => {
  test("counts only scored sources; unscored ones are skipped, not violations", () => {
    const result = summarizeDerisk([
      { file: "content/a/source.md", fm: { derisk_scores: { ...FULL_SCORES, load_bearing: 2 } } },
      { file: "content/b/source.md", fm: { derisk_scores: FULL_SCORES } },
      { file: "content/c/source.md", fm: { title: "no derisk pass" } },
    ]);
    assert.equal(result.scored, 2);
    assert.equal(result.flagged, 1);
    assert.deepEqual(result.flaggedFiles, [{ file: "content/a/source.md", low: ["load_bearing"], antiSalty: false }]);
  });

  test("flags a source with the anti-salty guard tripped even when no numeric dim is low", () => {
    const result = summarizeDerisk([
      { file: "content/a/source.md", fm: { derisk_scores: { ...FULL_SCORES, reader_runnable: false } } },
    ]);
    assert.equal(result.flagged, 1);
    assert.deepEqual(result.flaggedFiles, [{ file: "content/a/source.md", low: [], antiSalty: true }]);
  });

  test("all-high reports zero flagged", () => {
    const result = summarizeDerisk([{ file: "a.md", fm: { derisk_scores: FULL_SCORES } }]);
    assert.equal(result.flagged, 0);
    assert.deepEqual(result.flaggedFiles, []);
  });
});
