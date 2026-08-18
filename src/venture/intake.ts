import { mkdirSync, writeFileSync, existsSync } from "node:fs";
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

function renderIntakeMd(slug: string, answers: IntakeAnswers, voice: VoiceEvidence): string {
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
    ``
  );
  return lines.join("\n") + "\n";
}

export interface KickoffInput {
  slug: string;
  answers: IntakeAnswers;
  voice: VoiceEvidence;
  rules: VentureRules;
  at: string;
}

// Non-deferrable: everything downstream in Phase 1 cites intake:qN as evidence, and the kickoff
// canon event stamps the rules_version + source hashes every later step is checked against.
export function kickoffVenture(input: KickoffInput): { alreadyKickedOff: boolean } {
  const missing = INTAKE_QUESTIONS.filter((q) => !input.answers[q.id]?.trim());
  if (missing.length) {
    throw new Error(`intake incomplete -- missing answers for: ${missing.map((q) => q.id).join(", ")}`);
  }
  const dir = ventureDir(input.slug);
  mkdirSync(dir, { recursive: true });
  if (!existsSync(intakePath(input.slug))) {
    writeFileSync(intakePath(input.slug), renderIntakeMd(input.slug, input.answers, input.voice));
  }
  const { alreadyRecorded } = appendCanonEvent(
    input.slug,
    "kickoff",
    `${input.slug}/kickoff`,
    {
      rules_version: input.rules.rules_version,
      starter_kit_sha256: input.rules.sources.starter_kit_sha256,
      welsh_note_sha256: input.rules.sources.welsh_note_sha256,
    },
    input.at
  );
  return { alreadyKickedOff: alreadyRecorded };
}
