// The step that turns 25 scratch drafts into a real venture (src/review/intake-commit.ts), and the
// route that exposes it.
//
// Nothing here writes into the repo's own venture/ tree: useTempVentureRoot points paths.ts at a
// throwaway directory, and the draft store gets its own mkdtemp root through the same escape hatch
// intake-draft.ts already takes.

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { commitIntake, answersFromDrafts, missingQuestionNumbers, checkVoice } from "./intake-commit.js";
import { saveIntakeDraft, readIntakeDrafts, clearIntakeDrafts, INTAKE_DRAFT_PATHS } from "./intake-draft.js";
import { handleVentureWrite, VENTURE_WRITE_PATHS } from "./venture-writes.js";
import { INTAKE_QUESTIONS, kickoffVenture, readIntakeAnswers, readIntakeScorecard } from "../venture/intake.js";
import { intakeUnanswered } from "./page.js";
import { intakePath, ventureDir } from "../venture/paths.js";
import { useTempVentureRoot, clearTempVentureRoot } from "../venture/test-venture-root.js";
import { loadRules } from "../venture/rules.js";

let draftRoot = "";

beforeEach(() => {
  useTempVentureRoot();
  draftRoot = mkdtempSync(join(tmpdir(), "intake-drafts-"));
});
afterEach(() => {
  clearTempVentureRoot();
  if (draftRoot) rmSync(draftRoot, { recursive: true, force: true });
  draftRoot = "";
});

const VOICE = {
  writing_samples: ["https://example.com/a-post"],
  worldview_statement: "Systems fail people quietly, and someone has to say so out loud.",
  natural_phrases: ["here is what actually happened"],
  refused_phrases_tones: ["thought leadership"],
};

const SCORECARD = {
  required_live_posts: 3,
  ongoing_pace: "three a week, more if a thread lands",
  views_or_clicks_target: "learning_only",
  opt_in_target: "learning_only",
  response_quality_test: "someone names a moment, not a category",
  sustainability_test: "still under the 90 minutes a day I said in q20",
};

function fillAll(slug: string, text = (n: number) => `answer ${n}`): void {
  for (let n = 1; n <= INTAKE_QUESTIONS.length; n++) saveIntakeDraft(slug, n, text(n), draftRoot);
}

// ── the answer mapping ───────────────────────────────────────────────────────────────────────────

test("answersFromDrafts maps question numbers onto the real question ids, in order", () => {
  const answers = answersFromDrafts([
    { n: 1, text: "helping people read their own ballot" },
    { n: 25, text: "one reply from someone who voted differently" },
  ]);
  assert.equal(answers.q1, "helping people read their own ballot");
  assert.equal(answers.q25, "one reply from someone who voted differently");
  assert.equal(Object.keys(answers).length, 2);
});

test("answersFromDrafts keeps her text byte for byte, including whitespace she typed", () => {
  const typed = "  two thoughts\n\n  and a trailing space  ";
  const answers = answersFromDrafts([{ n: 4, text: typed }]);
  assert.equal(answers.q4, typed, "intake.md says the answers are verbatim; a helpful trim would make that a lie");
});

test("answersFromDrafts ignores a question number outside the real list", () => {
  assert.deepEqual(answersFromDrafts([{ n: 99, text: "x" }, { n: 0, text: "y" }]), {});
});

// ── missing-answer reporting agrees with the thing that actually refuses ──────────────────────────

test("missingQuestionNumbers and kickoffVenture agree on what counts as unanswered", () => {
  const vectors: Record<string, string>[] = [
    {},
    { q1: "a" },
    Object.fromEntries(INTAKE_QUESTIONS.map((q) => [q.id, "a"])),
    { ...Object.fromEntries(INTAKE_QUESTIONS.map((q) => [q.id, "a"])), q7: "   " },
    { ...Object.fromEntries(INTAKE_QUESTIONS.map((q) => [q.id, "a"])), q1: "", q25: "\n\t" },
  ];
  for (const answers of vectors) {
    const mine = missingQuestionNumbers(answers);
    let theirs: number[] = [];
    try {
      kickoffVenture({ slug: "agree-check", answers, voice: VOICE, scorecard: SCORECARD, rules: loadRules(), at: "2026-08-23T00:00:00.000Z" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const named = /missing answers for: (.+)$/.exec(msg)?.[1];
      if (named) theirs = named.split(", ").map((id) => INTAKE_QUESTIONS.findIndex((q) => q.id === id) + 1);
    }
    assert.deepEqual(mine, theirs, `disagreement on ${JSON.stringify(answers).slice(0, 60)}`);
  }
});

test("the screen's unanswered marker and the server's agree, off the same drafts", () => {
  const drafts = [{ n: 1, text: "a" }, { n: 2, text: "  " }, { n: 5, text: "b" }];
  const fromScreen = intakeUnanswered(drafts, INTAKE_QUESTIONS.length);
  const fromServer = missingQuestionNumbers(answersFromDrafts(drafts));
  assert.deepEqual(fromScreen, fromServer, "the marked boxes and the refusal must name the same questions");
});

// ── voice evidence, the rule kickoffVenture does not carry ───────────────────────────────────────

test("checkVoice refuses an empty voice block and says what to bring", () => {
  const r = checkVoice({});
  assert.ok("error" in r);
  assert.match(r.error, /at least one writing sample/);
  assert.match(r.error, /a worldview statement/);
  assert.match(r.error, /at least one phrase you use naturally/);
  assert.match(r.error, /at least one phrase or tone you refuse/);
});

test("checkVoice refuses a block that is present but blank", () => {
  const r = checkVoice({ writing_samples: ["  ", ""], worldview_statement: "   ", natural_phrases: [], refused_phrases_tones: ["x"] });
  assert.ok("error" in r);
  assert.match(r.error, /at least one writing sample/);
  assert.doesNotMatch(r.error, /at least one phrase or tone you refuse/, "the one field she did fill is not named");
});

test("checkVoice drops blank list entries rather than writing them into intake.md", () => {
  const r = checkVoice({ ...VOICE, natural_phrases: ["  ", "here is what actually happened", ""] });
  assert.ok(!("error" in r));
  assert.deepEqual(r.voice.natural_phrases, ["here is what actually happened"]);
});

// ── the commit ───────────────────────────────────────────────────────────────────────────────────

test("commitIntake refuses an unfinished interview and names the questions", () => {
  for (let n = 1; n <= 20; n++) saveIntakeDraft("half-done", n, `answer ${n}`, draftRoot);
  const r = commitIntake("half-done", { voice: VOICE, scorecard: SCORECARD }, draftRoot);
  assert.equal(r.ok, false);
  assert.match(r.error!, /missing answers for: q21, q22, q23, q24, q25/);
  assert.deepEqual(r.missing, [21, 22, 23, 24, 25]);
  assert.ok(!existsSync(ventureDir("half-done")), "a refused commit writes nothing");
});

test("commitIntake refuses when the voice evidence is not filled in", () => {
  fillAll("no-voice");
  const r = commitIntake("no-voice", { voice: {}, scorecard: SCORECARD }, draftRoot);
  assert.equal(r.ok, false);
  assert.match(r.error!, /voice evidence is not filled in/);
  assert.deepEqual(r.missing, [], "the interview itself is complete, so no question is marked");
  assert.ok(!existsSync(intakePath("no-voice")), "a refused commit writes nothing");
});

test("commitIntake passes the scorecard refusal through word for word", () => {
  fillAll("no-scorecard");
  const r = commitIntake("no-scorecard", { voice: VOICE, scorecard: { ...SCORECARD, sustainability_test: "" } }, draftRoot);
  assert.equal(r.ok, false);
  assert.match(r.error!, /the Day 14 scorecard is not fully fixed/);
  assert.match(r.error!, /venture\/rules\.md §4\.4/, "the refusal keeps the rule reference that tells her where to look");
});

test("commitIntake refuses a bad venture name before it touches anything", () => {
  const r = commitIntake("../escape", { voice: VOICE, scorecard: SCORECARD }, draftRoot);
  assert.equal(r.ok, false);
  assert.equal(r.error, "bad venture name");
});

test("a complete interview writes intake.md with her answers verbatim, and records the kickoff", () => {
  fillAll("voter-choice", (n) => (n === 20 ? "about 90 minutes a day" : `answer number ${n}`));
  const r = commitIntake("voter-choice", { voice: VOICE, scorecard: SCORECARD }, draftRoot);
  assert.equal(r.ok, true, r.error ?? "");
  assert.equal(r.alreadyKickedOff, false);

  const md = readFileSync(intakePath("voter-choice"), "utf8");
  assert.match(md, /Answers are stored verbatim/);
  const answers = readIntakeAnswers("voter-choice");
  assert.equal(answers?.q1, "answer number 1");
  assert.equal(answers?.q20, "about 90 minutes a day");
  assert.equal(answers?.q25, "answer number 25");
  assert.equal(Object.keys(answers ?? {}).length, INTAKE_QUESTIONS.length, "all 25 land");

  // The voice block and the scorecard are in the same file, which is the whole reason the screen
  // has to collect them: intake.md cannot be written without them.
  assert.match(md, /Systems fail people quietly/);
  assert.deepEqual(readIntakeScorecard("voter-choice"), SCORECARD);

  // and the kickoff is in canon
  assert.match(readFileSync(join(ventureDir("voter-choice"), "canon.md"), "utf8"), /kickoff/);
});

test("committing twice is safe and says so, rather than writing a second intake", () => {
  fillAll("twice");
  assert.equal(commitIntake("twice", { voice: VOICE, scorecard: SCORECARD }, draftRoot).ok, true);
  const again = commitIntake("twice", { voice: VOICE, scorecard: SCORECARD }, draftRoot);
  assert.equal(again.ok, true);
  assert.equal(again.alreadyKickedOff, true);
});

test("the drafts survive a refused commit, so nothing she typed is lost", () => {
  for (let n = 1; n <= 10; n++) saveIntakeDraft("survives", n, `answer ${n}`, draftRoot);
  commitIntake("survives", { voice: VOICE, scorecard: SCORECARD }, draftRoot);
  assert.equal(readIntakeDrafts("survives", draftRoot).drafts.length, 10);
});

// ── the route ────────────────────────────────────────────────────────────────────────────────────

test("POST :slug/intake/commit is dispatched, and does not require the venture to exist first", () => {
  // The commit is what CREATES venture/<slug>/, so a requiresVenture check here would make it
  // impossible to ever run.
  const res = handleVentureWrite("POST", "/api/venture/zz-intake-guard-commit/intake/commit", {});
  assert.ok(res, "the dispatcher must claim this path");
  assert.equal(res.status, 200, "a refusal is a fact about the drafts, not a 404 about the venture");
  const body = res.body as { ok: boolean; result: { ok: boolean; error?: string; missing?: number[] } };
  assert.equal(body.result.ok, false);
  assert.deepEqual(body.result.missing, Array.from({ length: INTAKE_QUESTIONS.length }, (_, i) => i + 1));
});

test("the commit route rejects a slug that is not a bare name", () => {
  const res = handleVentureWrite("POST", "/api/venture/..%2Fescape/intake/commit", {});
  assert.ok(res);
  assert.equal(res.status, 400);
});

test("the clear route drops the scratch buffer the commit no longer needs", () => {
  fillAll("cleared");
  assert.equal(readIntakeDrafts("cleared", draftRoot).drafts.length, INTAKE_QUESTIONS.length);
  assert.equal(clearIntakeDrafts("cleared", draftRoot).cleared, true);
  assert.deepEqual(readIntakeDrafts("cleared", draftRoot).drafts, []);
});

// ── the wiring guard's own inputs ────────────────────────────────────────────────────────────────

test("every path the guards read is declared, and the commit route is one of them", () => {
  assert.ok(VENTURE_WRITE_PATHS.includes("/api/venture/:slug/intake/commit"));
  assert.ok(VENTURE_WRITE_PATHS.includes("/api/venture/:slug/intake/drafts/clear"));
  assert.deepEqual(INTAKE_DRAFT_PATHS, ["/api/venture/:slug/intake/:n/draft", "/api/venture/:slug/intake/drafts"]);
  // Every declared write path must actually be dispatched, or the guard is checking a fiction.
  for (const p of VENTURE_WRITE_PATHS) {
    const concrete = p.replace(/:[a-zA-Z]+/g, "zz-intake-guard-claims");
    assert.ok(handleVentureWrite("POST", concrete, {}), `${p} is declared but the dispatcher does not claim it`);
  }
});
