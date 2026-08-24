export type Engine = "claude" | "grok" | "codex";

export const ENGINES: readonly Engine[] = ["claude", "grok", "codex"];

export const ENGINE_LABELS: Record<Engine, string> = {
  claude: "Claude",
  grok: "Grok",
  codex: "GPT (Codex)",
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
};

export interface EngineSpawnOptions {
  timeoutMs: number;
  permissionMode?: string | null;
  model?: string;
  tools?: string;
  sandbox?: "read-only" | "workspace-write" | "danger-full-access";
  outputFile?: string;
}

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
): { command: string; args: string[] } {
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
