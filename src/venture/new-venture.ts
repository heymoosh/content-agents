import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadRules } from "./rules.js";
import { kickoffVenture, type IntakeAnswers, type VoiceEvidence } from "./intake.js";

// tsx src/venture/new-venture.ts <slug> --stdin
// stdin: {"answers": {...IntakeAnswers}, "voice": {...VoiceEvidence}}
// The 25-question interview itself is Claude's judgment work (see .claude/skills/venture/SKILL.md
// step 1) -- this script only persists the completed answers once Claude has them.

export function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("usage: tsx src/venture/new-venture.ts <slug> --stdin");
    process.exit(1);
  }
  const rules = loadRules();
  const input = JSON.parse(readFileSync(0, "utf8")) as { answers: IntakeAnswers; voice: VoiceEvidence };
  try {
    const r = kickoffVenture({ slug, answers: input.answers, voice: input.voice, rules, at: new Date().toISOString() });
    console.log(r.alreadyKickedOff ? `${slug} was already kicked off` : `${slug} kicked off -- intake.md written, kickoff recorded`);
    console.log(`next: assemble the phase_1_research_plan (tsx src/venture/phase1.ts plan-init ${slug})`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
