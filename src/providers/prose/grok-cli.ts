import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ProseProvider } from "../types.js";
import { parseGrokJson } from "../analyst/grok-cli.js";
import { tmpdir } from "node:os";

const execFileP = promisify(execFile);
const PROSE_TIMEOUT_MS = 300_000;

function required(label: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} must not be empty`);
  return trimmed;
}

/** Assemble a self-contained prompt so Grok needs no repository tools or write access. */
export function buildProsePrompt(system: string, context: string, instructions: string): string {
  return [
    "# System and voice rules",
    required("system and voice rules", system),
    "",
    "# Canon and story context",
    required("canon and story context", context),
    "",
    "# Chapter direction",
    required("chapter direction", instructions),
    "",
    "Output only the finished chapter prose. Do not add a preamble, notes, or Markdown fences.",
  ].join("\n");
}

export const provider: ProseProvider = {
  name: "grok-cli",
  async generate({ system, context, instructions }) {
    const prompt = buildProsePrompt(system, context, instructions);
    let stdout: string;
    try {
      const result = await execFileP("grok", [
        "-p", prompt,
        "--output-format", "json",
        "--disable-web-search",
        "--no-plan",
        "--permission-mode", "dontAsk",
        "--tools", "",
      ], {
        // The prompt is self-contained. Running outside the repository with all Grok tools
        // disabled prevents source/file access and also avoids unsupported nested sandboxing
        // when Content Agents itself is launched from Codex.
        cwd: tmpdir(),
        timeout: PROSE_TIMEOUT_MS,
        maxBuffer: 20_000_000,
      });
      stdout = result.stdout;
    } catch (error) {
      const failure = error as { code?: string; killed?: boolean; stderr?: string };
      if (failure.code === "ENOENT") {
        throw new Error("`grok` CLI not on PATH — install Grok Build and sign in with your subscription");
      }
      if (failure.killed) throw new Error(`grok timed out after ${PROSE_TIMEOUT_MS / 1000}s drafting prose`);
      throw new Error(`grok CLI failed: ${failure.stderr?.trim() || (error instanceof Error ? error.message : String(error))}`);
    }
    // Subscription-authenticated runs currently report zero. Preserve any nonzero value the CLI
    // does report so a future billing-mode change can never be hidden from the cost ledger.
    const { text, costUsd } = parseGrokJson(stdout);
    return { text, costUsd };
  },
};
