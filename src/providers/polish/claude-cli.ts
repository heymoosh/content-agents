import "../../util/env.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { TextPolishProvider } from "../types.js";
import { repoRoot } from "../../db/db.js";

// Text-polish via headless Claude Code on Muxin's SUBSCRIPTION — $0 marginal (CLAUDE.md rule 6),
// no API key. Used for VIDEO SCRIPTS only (the /video skill's scoped exception to extraction-first;
// see CLAUDE.md rule 1). Replaces the Grok/OpenRouter route so a short hook-driven script needs no
// per-token spend or OPENROUTER_API_KEY. Model is a Claude alias (default "sonnet" — storytelling is
// built in and it is plenty for a 60-90s script; set CLAUDE_POLISH_MODEL=haiku for the cheapest run).

const execFileP = promisify(execFile);
const POLISH_TIMEOUT_MS = 180_000;

// Pure prompt assembly, exported so it can be unit-tested without shelling out to the CLI.
export function buildPolishPrompt(instructions: string, draft: string): string {
  return [
    instructions.trim(),
    ``,
    `Source material to work from:`,
    `"""`,
    draft.trim(),
    `"""`,
    ``,
    `Output ONLY the finished text — no preamble, no notes, no markdown fences.`,
  ].join("\n");
}

function polishModel(): string {
  return (process.env.CLAUDE_POLISH_MODEL ?? "sonnet").trim();
}

export const provider: TextPolishProvider = {
  name: "claude-cli",
  async polish({ draft, instructions }) {
    const prompt = buildPolishPrompt(instructions, draft);
    const model = polishModel();
    let stdout: string;
    try {
      const r = await execFileP("claude", ["-p", prompt, "--model", model], {
        cwd: repoRoot,
        timeout: POLISH_TIMEOUT_MS,
        maxBuffer: 20_000_000,
      });
      stdout = r.stdout;
    } catch (e) {
      const err = e as { code?: string; killed?: boolean; stderr?: string };
      if (err.code === "ENOENT") {
        throw new Error("`claude` CLI not on PATH — the claude-cli text-polish provider needs Claude Code installed");
      }
      if (err.killed) throw new Error(`claude -p timed out after ${POLISH_TIMEOUT_MS / 1000}s drafting the script`);
      throw new Error(`claude -p failed: ${err.stderr?.trim() || (e instanceof Error ? e.message : String(e))}`);
    }
    const text = stdout.trim();
    if (!text) throw new Error("claude -p returned no text");
    // Subscription route: $0 marginal. Logged as 0 so the cost ledger stays honest.
    return { text, costUsd: 0 };
  },
};
