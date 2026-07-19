import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import type { AnalystProvider } from "../types.js";
import { repoRoot } from "../../db/db.js";

// GPT analysis via the locally-installed OpenAI Codex CLI (`codex exec`), authenticated through
// Muxin's ChatGPT SUBSCRIPTION — $0 marginal, no API key, the same posture as claude-cli
// adapters (CLAUDE.md rule 6). Mirrors the global run-codex skill's contract: non-interactive
// `codex exec`, `--sandbox read-only` (analysis reads its own prompt; it never edits or runs
// commands), `-o <file>` so the final agent message is read cleanly instead of parsed out of a
// stdout stream that Muxin's codex hooks write noise into.

const DEFAULT_TIMEOUT_MS = 240_000;

// spawn (not execFile) so stdin can be CLOSED up front: codex exec treats an open piped stdin as
// input to wait on/append, and under Node's default piped stdio it exits silently with no work
// done — the same stdin gotcha runCommandSpawn documents for `claude -p` in src/review/jobs.ts.
function runCodex(args: string[], timeoutMs: number): Promise<{ code: number | null; killed: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("codex", args, {
      cwd: repoRoot,
      timeout: timeoutMs,
      killSignal: "SIGTERM",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let killed = false;
    child.stdout.on("data", (c: Buffer) => { stdout += c.toString("utf8"); });
    child.stderr.on("data", (c: Buffer) => { stderr += c.toString("utf8"); });
    child.on("error", (e) => reject(e));
    child.on("close", (code, signal) => {
      if (signal === "SIGTERM") killed = true;
      resolve({ code, killed, stdout, stderr });
    });
  });
}

// Thrown when Codex is UNAVAILABLE (usage limits, not installed, not logged in) rather than
// wrong — the routed provider treats this as "fall back to Claude", carrying the message so the
// GUI can say when the limit clears ("resets on the 23rd") instead of a mute failure.
export class CodexUnavailableError extends Error {}

// Pure, exported for unit tests: pick the usage-limit / availability line out of codex output.
// Returns the matched line (trimmed) or null when the output carries no availability signal.
export function classifyCodexAvailability(output: string): string | null {
  const patterns = [
    /usage limit/i,
    /rate.?limit/i,
    /quota/i,
    /too many requests/i,
    /plan limit/i,
    /out of (usage )?credits/i,
    /try again (at|after|on|in)/i,
    /resets? (at|on|in)/i,
    /not logged in/i,
    /login required/i,
    // a signed-out / expired-auth codex fails with a raw HTTP status, not a friendly message
    // (observed live 2026-07-19: "failed to connect to websocket: HTTP error: 401 Unauthorized")
    /\b401\b|unauthorized/i,
    /\b403\b|forbidden/i,
  ];
  for (const line of output.split("\n")) {
    if (patterns.some((re) => re.test(line))) return line.trim();
  }
  return null;
}

export const provider: AnalystProvider = {
  name: "gpt-codex",
  async analyze({ prompt, timeoutMs }) {
    const outFile = join(tmpdir(), `codex-analyst-${randomUUID()}.md`);
    let stdout = "";
    let stderr = "";
    let failed: Error | null = null;
    try {
      const r = await runCodex(
        ["exec", "--sandbox", "read-only", "--skip-git-repo-check", "-o", outFile, prompt],
        timeoutMs ?? DEFAULT_TIMEOUT_MS,
      );
      stdout = r.stdout;
      stderr = r.stderr;
      if (r.killed) failed = new Error(`codex exec timed out after ${(timeoutMs ?? DEFAULT_TIMEOUT_MS) / 1000}s`);
      else if (r.code !== 0) failed = new Error(`codex exec failed (exit ${r.code})`);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code === "ENOENT") {
        throw new CodexUnavailableError("`codex` CLI not on PATH — install it (npm i -g @openai/codex) and sign in with ChatGPT");
      }
      failed = new Error(err.message ?? "codex exec failed");
    }
    try {
      let text = "";
      try {
        text = readFileSync(outFile, "utf8").trim();
      } catch {
        /* no final-message file — fall through to the failure paths */
      }
      // A clean exit WITH a final message is a success, full stop. Never classify a successful
      // run's stdout: it contains the model's own analysis, which can legitimately talk about
      // rate limits and quotas (an Anthropic dossier did exactly that and false-tripped this).
      if (!failed && text) return { text, costUsd: 0, engine: "gpt-codex" };
      // Failure path: NOW the output is error surface — pick out the availability line so the
      // fallback reason can say when the limit clears.
      const limitLine = classifyCodexAvailability(`${stdout}\n${stderr}`);
      if (limitLine) throw new CodexUnavailableError(limitLine);
      throw new CodexUnavailableError(failed ? failed.message : "codex exec returned no final message");
    } finally {
      rmSync(outFile, { force: true });
    }
  },
};
