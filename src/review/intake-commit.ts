// The end of the intake interview: turn the room's scratch drafts into a real venture.
//
// The autosave half already existed (intake-draft.ts) and the batch CLI already existed
// (src/venture/new-venture.ts). What was missing was the step between them — a way to say "that's
// all 25, write it" without a terminal. This is that step, and it is deliberately thin:
//
//   THE ANSWERS COME OFF DISK, NOT OUT OF THE REQUEST.
//
// The 25 answers are read back from the same draft store the room has been autosaving into, so
// what gets written is exactly what she last saw on screen. A client that sent its own copy could
// disagree with the buffer — a stale tab, a half-flushed debounce — and nothing would catch it.
//
//   kickoffVenture() STILL OWNS THE WRITE.
//
// Nothing here renders intake.md, appends canon, or decides what "complete" means for the answers
// or the scorecard. It assembles the input and calls kickoffVenture, and every refusal it raises
// comes back word for word, because those sentences already name the qids that are missing.
//
// The one rule this file adds is the one kickoffVenture does not carry: voice evidence. kickoff
// validates the 25 answers and the Day 14 scorecard, but an empty VoiceEvidence sails straight
// through and renders a hollow "Voice evidence" section into intake.md — permanently, because the
// write is existsSync-gated and the kickoff canon event is recorded either way. So the refusal
// lives here, in front of it.

import { INTAKE_QUESTIONS, kickoffVenture, type IntakeAnswers, type ScorecardInput, type VoiceEvidence } from "../venture/intake.js";
import { loadRules } from "../venture/rules.js";
import { readIntakeDrafts, INTAKE_DRAFT_DIR } from "./intake-draft.js";

export interface CommitResult {
  ok: boolean;
  error?: string;
  /** 1-based question numbers with no answer in the draft store, so the screen can point at them. */
  missing?: number[];
  alreadyKickedOff?: boolean;
}

/**
 * The 1-based question numbers the draft store has no usable answer for.
 *
 * Reporting only. kickoffVenture runs the same emptiness test and is the thing that actually
 * refuses; this exists so the screen can mark the boxes rather than making her re-read a sentence
 * full of qids. intake-commit.test.ts asserts the two agree on every vector, so the pair cannot
 * drift into the screen highlighting one question while the server names another.
 */
export function missingQuestionNumbers(answers: IntakeAnswers): number[] {
  const missing: number[] = [];
  INTAKE_QUESTIONS.forEach((q, i) => {
    if (!answers[q.id]?.trim()) missing.push(i + 1);
  });
  return missing;
}

/**
 * Map the draft store's question numbers onto INTAKE_QUESTIONS' ids, in that list's own order.
 * Text is passed through verbatim — never trimmed, never normalized. intake.md's own header says
 * "Answers are stored verbatim, exactly as given"; a helpful trim here would make that a lie.
 */
export function answersFromDrafts(drafts: { n: number; text: string }[]): IntakeAnswers {
  const answers: IntakeAnswers = {};
  for (const d of drafts) {
    const q = INTAKE_QUESTIONS[d.n - 1];
    if (q) answers[q.id] = d.text;
  }
  return answers;
}

const VOICE_FIELDS: { key: keyof VoiceEvidence; ask: string }[] = [
  { key: "writing_samples", ask: "at least one writing sample" },
  { key: "worldview_statement", ask: "a worldview statement" },
  { key: "natural_phrases", ask: "at least one phrase you use naturally" },
  { key: "refused_phrases_tones", ask: "at least one phrase or tone you refuse" },
];

function list(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && !!s.trim()) : [];
}

/**
 * Voice evidence, cleaned and checked. Returns the refusal sentence when something is missing, in
 * SKILL.md step 1's own terms ("1-3 writing samples, a worldview statement, phrases she naturally
 * uses, phrases/tones she refuses"), so the message says what to bring rather than naming a field.
 */
export function checkVoice(input: unknown): { voice: VoiceEvidence } | { error: string } {
  const v = (input ?? {}) as Partial<VoiceEvidence>;
  const voice: VoiceEvidence = {
    writing_samples: list(v.writing_samples),
    worldview_statement: typeof v.worldview_statement === "string" ? v.worldview_statement.trim() : "",
    natural_phrases: list(v.natural_phrases),
    refused_phrases_tones: list(v.refused_phrases_tones),
  };
  const missing = VOICE_FIELDS.filter((f) => {
    const value = voice[f.key];
    return Array.isArray(value) ? value.length === 0 : !value;
  }).map((f) => f.ask);
  if (missing.length) {
    return {
      error:
        "intake incomplete -- the voice evidence is not filled in yet; bring " +
        missing.join(", ") +
        ". Phase 1 drafts in your voice off this, so it is not optional.",
    };
  }
  return { voice };
}

export interface CommitInput {
  voice?: unknown;
  scorecard?: unknown;
}

function scorecardOf(input: unknown): ScorecardInput {
  const s = (input ?? {}) as Partial<Record<keyof ScorecardInput, unknown>>;
  const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  return {
    required_live_posts: Number(s.required_live_posts),
    ongoing_pace: text(s.ongoing_pace),
    views_or_clicks_target: text(s.views_or_clicks_target),
    opt_in_target: text(s.opt_in_target),
    response_quality_test: text(s.response_quality_test),
    sustainability_test: text(s.sustainability_test),
  };
}

/**
 * Commit one venture's intake. `draftRoot` is test-only, the same escape hatch every function in
 * intake-draft.ts already takes.
 *
 * Refusals are returned, not thrown, and carry `missing` alongside so the screen can both print
 * the server's sentence and mark the unanswered boxes.
 */
export function commitIntake(slug: string, input: CommitInput, draftRoot: string = INTAKE_DRAFT_DIR, at: string = new Date().toISOString()): CommitResult {
  const read = readIntakeDrafts(slug, draftRoot);
  if (!read.ok) return { ok: false, error: read.error };

  const answers = answersFromDrafts(read.drafts);
  const missing = missingQuestionNumbers(answers);

  // Voice is checked only once the interview itself is complete, so an unfinished interview never
  // gets a refusal about a panel she has not reached yet.
  if (!missing.length) {
    const checked = checkVoice(input.voice);
    if ("error" in checked) return { ok: false, error: checked.error, missing };

    try {
      const { alreadyKickedOff } = kickoffVenture({
        slug,
        answers,
        voice: checked.voice,
        scorecard: scorecardOf(input.scorecard),
        rules: loadRules(),
        at,
      });
      return { ok: true, alreadyKickedOff };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e), missing };
    }
  }

  // Incomplete: still go through kickoffVenture so the sentence she reads is its own, naming the
  // qids. It cannot succeed from here, and it writes nothing on the way to refusing.
  try {
    kickoffVenture({ slug, answers, voice: { writing_samples: [], worldview_statement: "", natural_phrases: [], refused_phrases_tones: [] }, scorecard: scorecardOf(input.scorecard), rules: loadRules(), at });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), missing };
  }
}
