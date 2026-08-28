import { spawn } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import type { AnalystProvider } from "../types.js";
import { repoRoot } from "../../db/db.js";

// Grok via the locally-installed xAI CLI (`grok -p`), mirroring the codex-cli adapter's posture.
//
// This exists because restructuring prose is a job Claude is bad at: it stays too close to what was
// already written and loses the thread of the argument partway through. Muxin named Grok and GPT as
// the two that do this well, so the restructure path routes here and must never silently fall back
// to Claude the way the "routed" analyst does.
//
// Unlike the subscription-backed codex and claude adapters this one BILLS PER TOKEN, so callers
// log to data/cost-log.csv (CLAUDE.md rule 6) and it is never a silent default.

const DEFAULT_TIMEOUT_MS = 300_000;

// A large prompt is passed by FILE, not argv: grok offloads oversized prompts itself and the
// round trip through its own tooling was observed hanging for tens of minutes on prompts past
// roughly 32KB. Writing the file ourselves keeps the argv small and the behaviour predictable.
const ARGV_PROMPT_LIMIT = 8_000;

function runGrok(args: string[], timeoutMs: number): Promise<{ code: number | null; killed: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    // stdin closed up front: like codex, grok treats an open piped stdin as input to wait on.
    const child = spawn("grok", args, {
      cwd: repoRoot,
      timeout: timeoutMs,
      killSignal: "SIGTERM",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let killed = false;
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
    child.on("error", (error) => reject(error));
    child.on("close", (code, signal) => {
      if (signal === "SIGTERM") killed = true;
      resolve({ code, killed, stdout, stderr });
    });
  });
}

export class GrokUnavailableError extends Error {}

/** Pull the text and the billed cost out of grok's JSON envelope. Exported for unit tests. */
export function parseGrokJson(raw: string): { text: string; costUsd: number } {
  const trimmed = raw.split("\n[exited with code")[0]!.trim();
  if (!trimmed.startsWith("{")) throw new GrokUnavailableError("grok returned no JSON envelope");
  let parsed: { text?: string; total_cost_usd?: number; message?: string; type?: string };
  try {
    parsed = JSON.parse(trimmed) as typeof parsed;
  } catch (error) {
    throw new GrokUnavailableError(`grok output was not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (parsed.type === "error") throw new GrokUnavailableError(parsed.message ?? "grok reported an error");
  const text = (parsed.text ?? "").trim();
  if (!text) throw new GrokUnavailableError("grok returned an empty message");
  return { text, costUsd: typeof parsed.total_cost_usd === "number" ? parsed.total_cost_usd : 0 };
}

export const provider: AnalystProvider = {
  name: "grok-cli",
  async analyze({ prompt, timeoutMs }) {
    const large = prompt.length > ARGV_PROMPT_LIMIT;
    const promptFile = large ? join(tmpdir(), `grok-analyst-${randomUUID()}.txt`) : null;
    if (promptFile !== null) writeFileSync(promptFile, prompt, "utf8");
    try {
      const args = promptFile === null
        ? ["-p", prompt, "--output-format", "json", "--disable-web-search", "--no-plan"]
        : ["--prompt-file", promptFile, "--output-format", "json", "--disable-web-search", "--no-plan"];
      let result;
      try {
        result = await runGrok(args, timeoutMs ?? DEFAULT_TIMEOUT_MS);
      } catch (error) {
        const failure = error as { code?: string; message?: string };
        if (failure.code === "ENOENT") throw new GrokUnavailableError("`grok` CLI not on PATH");
        throw new GrokUnavailableError(failure.message ?? "grok failed to start");
      }
      if (result.killed) throw new GrokUnavailableError(`grok timed out after ${(timeoutMs ?? DEFAULT_TIMEOUT_MS) / 1000}s`);
      if (result.code !== 0 && !result.stdout.trim().startsWith("{")) {
        throw new GrokUnavailableError(`grok failed (exit ${result.code}): ${result.stderr.trim().slice(0, 300)}`);
      }
      const { text, costUsd } = parseGrokJson(result.stdout);
      return { text, costUsd, engine: "grok-cli" };
    } finally {
      if (promptFile !== null) rmSync(promptFile, { force: true });
    }
  },
};
