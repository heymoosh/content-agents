import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AnalystProvider } from "../types.js";
import { repoRoot } from "../../db/db.js";

// The analyst fallback: headless Claude on Muxin's subscription ($0), tools disabled — analysis
// prompts are self-contained by contract (see types.ts), so there is nothing legitimate for a
// tool call to do. Behaviorally identical to the pre-routing insights spawn.

const execFileP = promisify(execFile);
const DEFAULT_TIMEOUT_MS = 240_000;

export const provider: AnalystProvider = {
  name: "claude-cli",
  async analyze({ prompt, timeoutMs }) {
    try {
      const { stdout } = await execFileP("claude", ["-p", prompt, "--tools", ""], {
        cwd: repoRoot,
        timeout: timeoutMs ?? DEFAULT_TIMEOUT_MS,
        maxBuffer: 20_000_000,
      });
      const text = stdout.trim();
      if (!text) throw new Error("claude -p returned no text");
      return { text, costUsd: 0, engine: "claude-cli" };
    } catch (e) {
      const err = e as { code?: string; killed?: boolean; message?: string };
      if (err.code === "ENOENT") throw new Error("`claude` CLI not on PATH");
      if (err.killed) throw new Error(`claude -p timed out after ${(timeoutMs ?? DEFAULT_TIMEOUT_MS) / 1000}s`);
      throw e;
    }
  },
};
