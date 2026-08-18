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
      () => kickoffVenture({ slug: SLUG, answers: { q1: "only one answered" }, voice, rules, at: "t0" }),
      /intake incomplete/
    );
    assert.equal(existsSync(intakePath(SLUG)), false);
  });

  test("with all 25 answered, writes intake.md and the kickoff canon event", () => {
    const r = kickoffVenture({ slug: SLUG, answers: fullAnswers(), voice, rules, at: "2026-08-19T00:00:00.000Z" });
    assert.equal(r.alreadyKickedOff, false);
    assert.equal(existsSync(intakePath(SLUG)), true);
    assert.equal(hasCanonEvent(SLUG, `${SLUG}/kickoff`), true);
  });

  test("intake.md stores answers verbatim", () => {
    kickoffVenture({ slug: SLUG, answers: fullAnswers(), voice, rules, at: "t0" });
    const text = readFileSync(intakePath(SLUG), "utf8");
    assert.match(text, /answer to q1/);
    assert.match(text, /answer to q25/);
  });

  test("kicking off twice is idempotent on the canon event", () => {
    kickoffVenture({ slug: SLUG, answers: fullAnswers(), voice, rules, at: "t0" });
    const r2 = kickoffVenture({ slug: SLUG, answers: fullAnswers(), voice, rules, at: "t1" });
    assert.equal(r2.alreadyKickedOff, true);
  });

  test("stamps the rules_version and both source hashes on the kickoff canon event", () => {
    kickoffVenture({ slug: SLUG, answers: fullAnswers(), voice, rules, at: "t0" });
    const event = findCanonEvent(SLUG, `${SLUG}/kickoff`);
    assert.equal(event?.fields.rules_version, rules.rules_version);
    assert.equal(event?.fields.starter_kit_sha256, rules.sources.starter_kit_sha256);
    assert.equal(event?.fields.welsh_note_sha256, rules.sources.welsh_note_sha256);
  });
});
