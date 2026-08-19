import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { rmSync, existsSync, readFileSync } from "node:fs";
import { kickoffVenture, INTAKE_QUESTIONS, type IntakeAnswers } from "./intake.js";
import { intakePath, ventureDir } from "./paths.js";
import { hasCanonEvent, findCanonEvent } from "./canon.js";
import { loadRules, type VentureRules } from "./rules.js";

const SLUG = "zz-test-intake";
let rules: VentureRules;

beforeEach(() => {
  rules = loadRules();
});

afterEach(() => {
  rmSync(ventureDir(SLUG), { recursive: true, force: true });
});

function fullAnswers(): IntakeAnswers {
  const a: IntakeAnswers = {};
  for (const q of INTAKE_QUESTIONS) a[q.id] = `answer to ${q.id}`;
  return a;
}

function fullScorecard() {
  return {
    required_live_posts: 3,
    ongoing_pace: "5 posts/week",
    views_or_clicks_target: "learning_only",
    opt_in_target: "learning_only",
    response_quality_test: "at least one specific, on-topic reply per post",
    sustainability_test: "fits inside the 5 hrs/week declared in q20",
  };
}

describe("INTAKE_QUESTIONS", () => {
  test("has exactly 25 questions", () => {
    assert.equal(INTAKE_QUESTIONS.length, 25);
  });

  test("every id is unique", () => {
    const ids = new Set(INTAKE_QUESTIONS.map((q) => q.id));
    assert.equal(ids.size, 25);
  });
});

describe("kickoffVenture", () => {
  const voice = {
    writing_samples: ["https://example.com/sample"],
    worldview_statement: "test worldview",
    natural_phrases: ["kind of a big deal"],
    refused_phrases_tones: ["here's the thing"],
  };

  test("refuses to kick off with missing answers", () => {
    assert.throws(
      () =>
        kickoffVenture({
          slug: SLUG,
          answers: { q1: "only one answered" },
          voice,
          scorecard: fullScorecard(),
          rules,
          at: "t0",
        }),
      /intake incomplete/
    );
    assert.equal(existsSync(intakePath(SLUG)), false);
  });

  test("refuses to kick off with an incomplete scorecard", () => {
    assert.throws(
      () =>
        kickoffVenture({
          slug: SLUG,
          answers: fullAnswers(),
          voice,
          scorecard: { ...fullScorecard(), ongoing_pace: "" },
          rules,
          at: "t0",
        }),
      /Day 14 scorecard/
    );
    assert.equal(existsSync(intakePath(SLUG)), false);
  });

  test("refuses a scorecard with a non-positive required_live_posts", () => {
    assert.throws(
      () =>
        kickoffVenture({
          slug: SLUG,
          answers: fullAnswers(),
          voice,
          scorecard: { ...fullScorecard(), required_live_posts: 0 },
          rules,
          at: "t0",
        }),
      /Day 14 scorecard/
    );
  });

  test("with all 25 answered and a complete scorecard, writes intake.md and the kickoff canon event", () => {
    const r = kickoffVenture({
      slug: SLUG,
      answers: fullAnswers(),
      voice,
      scorecard: fullScorecard(),
      rules,
      at: "2026-08-19T00:00:00.000Z",
    });
    assert.equal(r.alreadyKickedOff, false);
    assert.equal(existsSync(intakePath(SLUG)), true);
    assert.equal(hasCanonEvent(SLUG, `${SLUG}/kickoff`), true);
  });

  test("intake.md stores answers verbatim and the fixed scorecard", () => {
    kickoffVenture({ slug: SLUG, answers: fullAnswers(), voice, scorecard: fullScorecard(), rules, at: "t0" });
    const text = readFileSync(intakePath(SLUG), "utf8");
    assert.match(text, /answer to q1/);
    assert.match(text, /answer to q25/);
    assert.match(text, /Day 14 scorecard/);
    assert.match(text, /Required live Phase 1 posts:\*\* 3/);
    assert.match(text, /minimum 20, target 30/);
  });

  test("kicking off twice is idempotent on the canon event", () => {
    kickoffVenture({ slug: SLUG, answers: fullAnswers(), voice, scorecard: fullScorecard(), rules, at: "t0" });
    const r2 = kickoffVenture({ slug: SLUG, answers: fullAnswers(), voice, scorecard: fullScorecard(), rules, at: "t1" });
    assert.equal(r2.alreadyKickedOff, true);
  });

  test("stamps the rules_version, both source hashes, and scorecard_fixed on the kickoff canon event", () => {
    kickoffVenture({ slug: SLUG, answers: fullAnswers(), voice, scorecard: fullScorecard(), rules, at: "t0" });
    const event = findCanonEvent(SLUG, `${SLUG}/kickoff`);
    assert.equal(event?.fields.rules_version, rules.rules_version);
    assert.equal(event?.fields.starter_kit_sha256, rules.sources.starter_kit_sha256);
    assert.equal(event?.fields.welsh_note_sha256, rules.sources.welsh_note_sha256);
    assert.equal(event?.fields.scorecard_fixed, "true");
  });
});
