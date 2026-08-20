import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { intakePath, ventureDir } from "./paths.js";
import { appendCanonEvent } from "./canon.js";
import { type VentureRules } from "./rules.js";

// venture/rules.md §4.2's fixed 25 questions. The skill runs the actual interview one question
// at a time (Claude's judgment work); this module only persists the completed, verbatim answers
// -- it never generates or edits an answer itself.
export const INTAKE_QUESTIONS: { id: string; block: string; question: string }[] = [
  { id: "q1", block: "A: what are we building?", question: "What are you helping people do?" },
  { id: "q2", block: "A: what are we building?", question: "Who will you help first?" },
  { id: "q3", block: "A: what are we building?", question: "What problem do they already know they have?" },
  { id: "q4", block: "A: what are we building?", question: "What do you think is broken for them?" },
  { id: "q5", block: "A: what are we building?", question: "If this works, what gets better for them?" },
  { id: "q6", block: "B: what makes you credible?", question: "What have you built, shared, taught, or tested?" },
  { id: "q7", block: "B: what makes you credible?", question: "What proof shows that people care?" },
  { id: "q8", block: "B: what makes you credible?", question: "What have people thanked you for?" },
  { id: "q9", block: "B: what makes you credible?", question: "What do you know from experience that others often miss?" },
  { id: "q10", block: "B: what makes you credible?", question: "What proof should we keep using?" },
  { id: "q11", block: "C: what does the audience feel?", question: "What frustrates them now?" },
  { id: "q12", block: "C: what does the audience feel?", question: "What do they waste time trying to learn?" },
  { id: "q13", block: "C: what does the audience feel?", question: "What do they not trust?" },
  { id: "q14", block: "C: what does the audience feel?", question: "What do they want to do but keep putting off?" },
  { id: "q15", block: "C: what does the audience feel?", question: "What words do they use when they talk about this problem?" },
  { id: "q16", block: "D: what can the creator sustain?", question: "What format feels easiest for you: writing, video, audio, live teaching, demos, or templates?" },
  { id: "q17", block: "D: what can the creator sustain?", question: "What can you make in under an hour and still enjoy?" },
  { id: "q18", block: "D: what can the creator sustain?", question: "Which platform feels most natural?" },
  { id: "q19", block: "D: what can the creator sustain?", question: "Which platform would tire you out fastest?" },
  { id: "q20", block: "D: what can the creator sustain?", question: "How much time can you give this for the next 14 days?" },
  { id: "q21", block: "E: what might the first offer become?", question: "What should the first paid offer be: a guide, toolkit, short course, community, coaching, or software-supported product? (a hypothesis -- must not preselect the final product format before audience evidence arrives)" },
  { id: "q22", block: "E: what might the first offer become?", question: "What small win can someone get in 10 minutes?" },
  { id: "q23", block: "E: what might the first offer become?", question: "What bigger win can someone get in one or two weeks?" },
  { id: "q24", block: "E: what might the first offer become?", question: "What must this business never become?" },
  { id: "q25", block: "E: what might the first offer become?", question: "What would make the first 14 days worth continuing?" },
];

export interface IntakeAnswers {
  [questionId: string]: string;
}

export interface VoiceEvidence {
  writing_samples: string[];
  worldview_statement: string;
  natural_phrases: string[];
  refused_phrases_tones: string[];
}

// venture/rules.md §4.4: "Fix the scorecard before Phase 1... Nothing drafts until intake and
// the Day 14 scorecard are complete." These are the user-supplied fields; `views_or_clicks_target`
// and `opt_in_target` may be the literal string "learning_only" when no baseline exists (the
// system must never invent a number). The other two required fields -- the eligible-response
// target and the final-decision option set -- are fixed by the rule itself, not elicited per
// venture; see SCORECARD_FIXED below.
export interface ScorecardInput {
  required_live_posts: number;
  ongoing_pace: string;
  views_or_clicks_target: string;
  opt_in_target: string;
  response_quality_test: string;
  sustainability_test: string;
}

export const SCORECARD_FIXED = {
  eligible_response_target: { minimum: 20, target: 30 },
  final_decision_options: ["continue", "revise_positioning", "revise_lead_magnet", "collect_more_evidence", "stop"],
} as const;

function renderIntakeMd(slug: string, answers: IntakeAnswers, voice: VoiceEvidence, scorecard: ScorecardInput): string {
  const lines = [`# Intake — ${slug}`, ``, `Answers are stored verbatim, exactly as given. Nothing here is paraphrased.`, ``];
  let currentBlock = "";
  for (const q of INTAKE_QUESTIONS) {
    if (q.block !== currentBlock) {
      currentBlock = q.block;
      lines.push(`## Block ${currentBlock}`, ``);
    }
    lines.push(`**${q.question}**`, ``, answers[q.id] ?? "_(not yet answered)_", ``);
  }
  lines.push(
    `## Voice evidence`,
    ``,
    `**Writing samples:**`,
    ...voice.writing_samples.map((s) => `- ${s}`),
    ``,
    `**Worldview statement:** ${voice.worldview_statement}`,
    ``,
    `**Natural phrases:** ${voice.natural_phrases.join(", ")}`,
    ``,
    `**Refused phrases/tones:** ${voice.refused_phrases_tones.join(", ")}`,
    ``,
    `## Day 14 scorecard`,
    ``,
    `Fixed at kickoff, per venture/rules.md §4.4. This is what Day 14 review scores against —`,
    `it is not revised mid-run.`,
    ``,
    `**Required live Phase 1 posts:** ${scorecard.required_live_posts}`,
    `**Ongoing posting pace:** ${scorecard.ongoing_pace}`,
    `**Qualified views/clicks target:** ${scorecard.views_or_clicks_target}`,
    `**Landing-page opt-in target:** ${scorecard.opt_in_target}`,
    `**Eligible unique response target:** minimum ${SCORECARD_FIXED.eligible_response_target.minimum}, target ${SCORECARD_FIXED.eligible_response_target.target}`,
    `**Response-quality test:** ${scorecard.response_quality_test}`,
    `**Sustainability test:** ${scorecard.sustainability_test}`,
    `**Final decision options:** ${SCORECARD_FIXED.final_decision_options.join(", ")}`,
    ``
  );
  return lines.join("\n") + "\n";
}

const REQUIRED_SCORECARD_STRING_FIELDS: (keyof Omit<ScorecardInput, "required_live_posts">)[] = [
  "ongoing_pace",
  "views_or_clicks_target",
  "opt_in_target",
  "response_quality_test",
  "sustainability_test",
];

function scorecardIsComplete(scorecard: ScorecardInput | undefined): scorecard is ScorecardInput {
  if (!scorecard) return false;
  if (!Number.isFinite(scorecard.required_live_posts) || scorecard.required_live_posts <= 0) return false;
  return REQUIRED_SCORECARD_STRING_FIELDS.every((f) => scorecard[f]?.trim());
}

export interface KickoffInput {
  slug: string;
  answers: IntakeAnswers;
  voice: VoiceEvidence;
  scorecard: ScorecardInput;
  rules: VentureRules;
  at: string;
}

// Reads back the two Day 14 targets a venture's kickoff fixed (rules.md §4.4) so Phase 4's
// day-14-scorecard-draft can compare against them without a second, separate store -- intake.md's
// rendered markdown IS the only durable copy of the scorecard (kickoffVenture never persists it as
// structured data anywhere else). Parses renderIntakeMd's own fixed "**Label:** value" lines --
// fragile only in the sense that it depends on that render format staying put, which is already
// true for every other reader of intake.md in this codebase. Returns undefined if intake.md is
// missing or a field didn't parse, rather than a partially-filled object a caller could
// half-trust.
export function readIntakeScorecard(slug: string): ScorecardInput | undefined {
  const path = intakePath(slug);
  if (!existsSync(path)) return undefined;
  const text = readFileSync(path, "utf8");
  const field = (label: string): string | undefined => text.match(new RegExp(`\\*\\*${label}:\\*\\* (.+)`))?.[1]?.trim();

  const requiredLivePostsRaw = field("Required live Phase 1 posts");
  const ongoingPace = field("Ongoing posting pace");
  const viewsOrClicksTarget = field("Qualified views/clicks target");
  const optInTarget = field("Landing-page opt-in target");
  const responseQualityTest = field("Response-quality test");
  const sustainabilityTest = field("Sustainability test");
  const requiredLivePosts = requiredLivePostsRaw !== undefined ? Number(requiredLivePostsRaw) : NaN;

  if (
    !Number.isFinite(requiredLivePosts) ||
    !ongoingPace ||
    !viewsOrClicksTarget ||
    !optInTarget ||
    !responseQualityTest ||
    !sustainabilityTest
  ) {
    return undefined;
  }
  return {
    required_live_posts: requiredLivePosts,
    ongoing_pace: ongoingPace,
    views_or_clicks_target: viewsOrClicksTarget,
    opt_in_target: optInTarget,
    response_quality_test: responseQualityTest,
    sustainability_test: sustainabilityTest,
  };
}

// Non-deferrable: everything downstream in Phase 1 cites intake:qN as evidence, and the kickoff
// canon event stamps the rules_version + source hashes every later step is checked against.
export function kickoffVenture(input: KickoffInput): { alreadyKickedOff: boolean } {
  const missing = INTAKE_QUESTIONS.filter((q) => !input.answers[q.id]?.trim());
  if (missing.length) {
    throw new Error(`intake incomplete -- missing answers for: ${missing.map((q) => q.id).join(", ")}`);
  }
  if (!scorecardIsComplete(input.scorecard)) {
    throw new Error(
      "intake incomplete -- the Day 14 scorecard is not fully fixed (venture/rules.md §4.4); " +
        "required_live_posts, ongoing_pace, views_or_clicks_target, opt_in_target, " +
        "response_quality_test, and sustainability_test must all be set (targets may be the " +
        'literal "learning_only" when there is no baseline)'
    );
  }
  const dir = ventureDir(input.slug);
  mkdirSync(dir, { recursive: true });
  if (!existsSync(intakePath(input.slug))) {
    writeFileSync(intakePath(input.slug), renderIntakeMd(input.slug, input.answers, input.voice, input.scorecard));
  }
  const { alreadyRecorded } = appendCanonEvent(
    input.slug,
    "kickoff",
    `${input.slug}/kickoff`,
    {
      rules_version: input.rules.rules_version,
      starter_kit_sha256: input.rules.sources.starter_kit_sha256,
      welsh_note_sha256: input.rules.sources.welsh_note_sha256,
      scorecard_fixed: "true",
    },
    input.at
  );
  return { alreadyKickedOff: alreadyRecorded };
}
