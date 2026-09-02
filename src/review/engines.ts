export type Engine = "claude" | "grok" | "codex" | "ollama-gpt-oss";

export const ENGINES: readonly Engine[] = ["claude", "grok", "codex", "ollama-gpt-oss"];

export const ENGINE_LABELS: Record<Engine, string> = {
  claude: "Claude",
  grok: "Grok",
  codex: "GPT (Codex)",
  "ollama-gpt-oss": "GPT-OSS (local)",
};

export type EngineRoleHint = "Writing" | "Ideation / Humor" | "Deep / Structured Analysis";

export interface EngineMetadata {
  readonly id: Engine;
  readonly label: string;
  readonly description: string;
  readonly roleHint: EngineRoleHint;
}

export const ENGINE_METADATA: Readonly<Record<Engine, EngineMetadata>> = Object.freeze({
  claude: Object.freeze({
    id: "claude",
    label: "Claude",
    description: "Voice-aware writing, revision, and careful drafting.",
    roleHint: "Writing",
  }),
  grok: Object.freeze({
    id: "grok",
    label: "Grok",
    description: "Playful ideation, humor, and unexpected angles.",
    roleHint: "Ideation / Humor",
  }),
  codex: Object.freeze({
    id: "codex",
    label: "GPT (Codex)",
    description: "Deep reasoning, structured analysis, and implementation planning.",
    roleHint: "Deep / Structured Analysis",
  }),
  "ollama-gpt-oss": Object.freeze({
    id: "ollama-gpt-oss",
    label: "GPT-OSS (local)",
    description: "Local GPT-OSS analysis through Ollama.",
    roleHint: "Deep / Structured Analysis",
  }),
});

export function getEngineMetadata(engine: unknown): EngineMetadata {
  return isEngine(engine) ? ENGINE_METADATA[engine] : {
    id: "claude",
    label: ENGINE_LABELS.claude,
    description: "Voice-aware writing, revision, and careful drafting.",
    roleHint: "Writing",
  };
}

export const ENGINE_COMMANDS: Record<Engine, string> = {
  claude: "claude",
  grok: "grok",
  codex: "codex",
  "ollama-gpt-oss": "ollama",
};

export const GROK_FINAL_TEXT_SYSTEM_PROMPT = "You are a bounded text transformation function. Do not inspect files, use tools, narrate your process, plan aloud, or explain. Follow the user prompt and output only the requested final text.";

export interface EngineSpawnOptions {
  timeoutMs: number;
  cwd?: string;
  permissionMode?: string | null;
  model?: string;
  tools?: string;
  sandbox?: "read-only" | "workspace-write" | "danger-full-access";
  outputFile?: string;
}

export { OLLAMA_MODEL, parseOllamaList, ollamaAvailability, parseOllamaAvailability } from "./ollama-availability.js";

export function isEngine(value: unknown): value is Engine {
  return typeof value === "string" && (ENGINES as readonly string[]).includes(value);
}

/** Keep slash-command skills Claude-specific; other CLIs need the skill file made explicit. */
export function enginePrompt(engine: Engine, skill: string, request: string): string {
  if (engine === "claude") return request;
  return [
    `Read .claude/skills/${skill}/SKILL.md in full before acting.`,
    `Follow that skill's rules and guardrails for this request.`,
    `Do not assume a slash command is available in your CLI.`,
    ``,
    request,
  ].join("\n");
}

/** Build a headless invocation without inspecting the machine or spawning a process. */
export function buildEngineSpawn(
  engine: Engine,
  prompt: string,
  opts: EngineSpawnOptions,
): { command: string; args: string[]; input?: string } {
  if (engine === "ollama-gpt-oss") {
    // Ollama receives the prompt on stdin. This avoids putting potentially sensitive prompt
    // content in argv/process listings and keeps invocation shell-free.
    return { command: "ollama", args: ["run", "gpt-oss:20b"], input: prompt };
  }
  if (engine === "codex") {
    const args = [
      "exec",
      "--sandbox",
      opts.sandbox ?? "workspace-write",
      "--skip-git-repo-check",
    ];
    if (opts.outputFile) args.push("--output-last-message", opts.outputFile);
    args.push(prompt);
    return { command: "codex", args };
  }

  const args = ["-p", prompt];
  if (opts.permissionMode !== null) {
    args.push("--permission-mode", opts.permissionMode ?? "acceptEdits");
  }
  if (opts.model !== undefined) args.push("--model", opts.model);
  if (opts.tools !== undefined) args.push("--tools", opts.tools);
  return { command: engine, args };
}

/** Normalize a completed CLI invocation to the model's final answer only. */
export function extractEngineText(engine: Engine, stdout: string): string {
  if (engine !== "grok") return String(stdout ?? "").trim();
  let parsed: unknown;
  try { parsed = JSON.parse(String(stdout ?? "")); }
  catch { throw new Error("Grok did not return valid final-answer JSON"); }
  const text = parsed && typeof parsed === "object" && "text" in parsed
    ? (parsed as { text?: unknown }).text
    : undefined;
  if (typeof text !== "string" || !text.trim()) throw new Error("Grok final-answer JSON did not contain text");
  return text.trim();
}
