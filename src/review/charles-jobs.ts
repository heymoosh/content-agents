import { CHARLES_DIR, listCharlesPosts, readCharlesPost, stampCharlesEngine, type CharlesPost } from "./charles.js";
import { ENGINE_COMMANDS, ENGINE_LABELS, type Engine } from "./engines.js";
import { decodeSpawnFailure, logTailSuffix, runClaudeSpawn, runQueued } from "./jobs.js";

const CHARLES_DRAFT_TIMEOUT_MS = 240_000;
export type CharlesDraftMode = "oneliner" | "essay" | "reply";
const CHARLES_DRAFT_MODES = new Set<CharlesDraftMode>(["oneliner", "essay", "reply"]);

function engineName(job: { engine?: Engine }): string {
  return ENGINE_LABELS[job.engine ?? "claude"];
}

// ── Charles room: "Draft" (Build 4) ─────────────────────────────────────────────────────────
// The Charles room's missing front door — parity with the Content room's "Format directly", which
// spawns the real /atomize headlessly. This does the same for /charles: one bounded claude -p call
// that writes exactly one new draft file + appends exactly one review-queue.md row, then stops.
// Text modes only (one-liner/essay/reply) — memes are out of scope here on purpose (Muxin does
// meme research/image-gen elsewhere); the Charles room instead offers a one-click copy of
// charles/config/persona-brief.md for her to hand to whatever tool she's using for that.

// Exported so the prompt's guardrails (persona.yaml governs the voice, not config/voice.yaml;
// leak-bank-only claims; exactly one file + one queue row; id uniqueness) are unit-testable
// without spawning a real subprocess.
export function charlesDraftPrompt(mode: CharlesDraftMode, input: string, existingIds: string[]): string {
  const inputLine =
    mode === "reply"
      ? `Reply to this real post/article — fetch it first, never invent what it said: ${input}`
      : input.trim()
        ? `Topic/angle to draft toward: ${input.trim()}`
        : `No specific topic given — pick one of the comic-engine angles yourself.`;
  const dirByMode: Record<CharlesDraftMode, string> = {
    oneliner: "one-liners", essay: "essays", reply: "replies",
  };
  return [
    `Draft ONE new post for Charles Lord Featherbottom, a fictional satirical persona in this repo`,
    `(Build 4). Do not run shell commands beyond what reading/writing files requires; write the one`,
    `new file plus the one queue row below, then stop.`,
    ``,
    `First read charles/AGENTS.md and charles/config/persona.yaml in full — his voice is governed`,
    `by persona.yaml, NOT config/voice.yaml. Then follow the "Mode: /charles ${mode}" section of`,
    `.claude/skills/charles/SKILL.md exactly, for this input:`,
    ``,
    inputLine,
    ``,
    `Rules:`,
    `- Write ONLY the one new draft file (under charles/posts/${dirByMode[mode]}/)`,
    `  plus ONE new row appended to charles/review-queue.md. Touch nothing else.`,
    `- Pick a short kebab-case id/slug for the draft that is NOT already one of these existing ids:`,
    `  ${existingIds.length ? existingIds.join(", ") : "(none yet)"}`,
    `- Status for the new row is always "pending" — never approve/discard it yourself.`,
    `- If you use a "useful leak," it MUST be one already listed in persona.yaml's leak_bank —`,
    `  never invent a statistic, org, or ballot measure that isn't there.`,
    `- Keep the em-dash ban (charles/AGENTS.md carries it over from Build 2's fiction rule).`,
  ].join("\n");
}

export async function enqueueCharlesDraft(mode: string, input: string, engine: Engine = "claude"): Promise<{ id: string; post: CharlesPost }> {
  if (!CHARLES_DRAFT_MODES.has(mode as CharlesDraftMode)) {
    throw new Error(`"${mode}" isn't a mode this can draft from the GUI. Try one-liner, essay, or reply`);
  }
  if (mode === "reply" && !input.trim()) throw new Error("a reply needs a URL to react to");

  return runQueued("charles-draft", `Draft a Charles ${mode}`, async (job) => {
    const before = new Set(listCharlesPosts(CHARLES_DIR).map((p) => p.id));
    const prompt = charlesDraftPrompt(mode as CharlesDraftMode, input, [...before]);

    const result = await runClaudeSpawn(job, prompt, { timeoutMs: CHARLES_DRAFT_TIMEOUT_MS });
    const failure = decodeSpawnFailure(result, job.id, {
      timeoutVerb: `${engineName(job)} draft`, timeoutLabel: `${CHARLES_DRAFT_TIMEOUT_MS / 1000}s`,
      exitVerb: `${engineName(job)} draft`, command: job.engine === "claude" ? undefined : ENGINE_COMMANDS[job.engine ?? "claude"],
    });
    if (failure) throw new Error(failure);

    const after = listCharlesPosts(CHARLES_DIR);
    const newId = after.map((p) => p.id).find((id) => !before.has(id));
    if (!newId) {
      throw new Error(`${engineName(job)} ran but didn't add a new row to charles/review-queue.md. Check the view-log link${logTailSuffix(job.id)}`);
    }
    stampCharlesEngine(newId, job.engine ?? "claude", CHARLES_DIR);
    return { id: newId, post: readCharlesPost(newId, CHARLES_DIR) };
  }, engine);
}
