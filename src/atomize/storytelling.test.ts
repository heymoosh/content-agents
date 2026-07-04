import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  parseStorytelling,
  lowDimensions,
  needsSpinPass,
  spinPassNote,
  summarizeStorytelling,
  LOW_SCORE_THRESHOLD,
} from "./storytelling.js";

describe("parseStorytelling: reads fm.scores.{hook,narrative,resonance}", () => {
  test("returns the three scores when all present as numbers", () => {
    const scores = parseStorytelling({ scores: { native: 4, brand: 5, hook: 4, narrative: 3, resonance: 2 } });
    assert.deepEqual(scores, { hook: 4, narrative: 3, resonance: 2 });
  });

  test("undefined when scores is missing entirely (pre-dimension derivative)", () => {
    assert.equal(parseStorytelling({}), undefined);
  });

  test("undefined when only some of the three dimensions are present", () => {
    assert.equal(parseStorytelling({ scores: { hook: 4, narrative: 3 } }), undefined);
  });

  test("undefined when a dimension is a non-number", () => {
    assert.equal(parseStorytelling({ scores: { hook: "4", narrative: 3, resonance: 3 } }), undefined);
  });

  test("undefined when scores is not an object", () => {
    assert.equal(parseStorytelling({ scores: "high" }), undefined);
  });
});

describe(`lowDimensions / needsSpinPass: soft-gate at <= ${LOW_SCORE_THRESHOLD} (matches the 2-3 clustering the eval found)`, () => {
  test("a dimension at the threshold counts as low", () => {
    assert.deepEqual(lowDimensions({ hook: 3, narrative: 5, resonance: 5 }), ["hook"]);
  });

  test("a dimension above the threshold does not count as low", () => {
    assert.deepEqual(lowDimensions({ hook: 4, narrative: 5, resonance: 5 }), []);
  });

  test("multiple low dimensions are all reported, in rubric order", () => {
    assert.deepEqual(lowDimensions({ hook: 2, narrative: 5, resonance: 3 }), ["hook", "resonance"]);
  });

  test("needsSpinPass is true iff any dimension is low", () => {
    assert.equal(needsSpinPass({ hook: 3, narrative: 5, resonance: 5 }), true);
    assert.equal(needsSpinPass({ hook: 4, narrative: 5, resonance: 4 }), false);
  });
});

describe("spinPassNote: the exact review-queue.md notes-cell suffix Claude appends", () => {
  test("undefined when nothing is low (a high-scoring derivative is not flagged)", () => {
    assert.equal(spinPassNote({ hook: 4, narrative: 5, resonance: 4 }), undefined);
  });

  test("names the low dimension(s) when flagged", () => {
    assert.equal(
      spinPassNote({ hook: 2, narrative: 5, resonance: 3 }),
      "flag: spin pass suggested (low: hook, resonance)"
    );
  });
});

describe("summarizeStorytelling: advisory rollup for npm run validate, never a gate", () => {
  test("counts only scored derivatives; unscored ones are skipped, not violations", () => {
    const result = summarizeStorytelling([
      { file: "x-1.md", fm: { scores: { hook: 2, narrative: 2, resonance: 2 } } },
      { file: "x-2.md", fm: { scores: { hook: 4, narrative: 4, resonance: 4 } } },
      { file: "bluesky-1.md", fm: { scores: { native: 4, brand: 4 } } }, // no storytelling dims yet
    ]);
    assert.equal(result.scored, 2);
    assert.equal(result.flagged, 1);
    assert.deepEqual(result.flaggedFiles, [{ file: "x-1.md", low: ["hook", "narrative", "resonance"] }]);
  });

  test("all-high reports zero flagged", () => {
    const result = summarizeStorytelling([{ file: "a.md", fm: { scores: { hook: 5, narrative: 5, resonance: 5 } } }]);
    assert.equal(result.flagged, 0);
    assert.deepEqual(result.flaggedFiles, []);
  });
});
