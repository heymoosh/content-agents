import { join } from "node:path";
import { repoRoot } from "../db/db.js";
import { handleVentureRead } from "./venture-reads.js";
import {
  decodeSpawnFailure,
  runAgentSpawn,
  runCommandSpawn,
  runQueued,
  type CommandSpawnResult,
} from "./jobs.js";
import { ENGINE_COMMANDS, ENGINE_LABELS, enginePrompt, type Engine } from "./engines.js";
import { readLearningEvaluations } from "../venture/learning-evaluation.js";

const PROPOSAL_TIMEOUT_MS = 240_000;
const CLI_TIMEOUT_MS = 120_000;

/** Only commands that create a draft/recommendation and then stop at a human gate. */
export const VENTURE_STEP_COMMANDS: Readonly<Record<1 | 2 | 3 | 4, readonly string[]>> = {
  1: ["plan-init", "platform", "ideas", "draft", "research-read-init", "continuation"],
  2: ["concepts", "magnet-draft", "landing-page-draft", "survey-review", "welcome-email-draft", "announcement-draft"],
  3: ["cluster", "problem-score", "transformation-draft", "outline-draft", "price", "price-draft"],
  4: ["operating-plan-draft", "operating-plan-write", "thank-you-note-draft", "day-14-scorecard-draft"],
};

export interface VentureStepProposal {
  command: string;
  args: string[];
  input: Record<string, unknown>;
  summary?: string;
}

function isSafeArg(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9][\w-]*$/.test(value);
}

function allowedForPhase(phase: number): readonly string[] {
  if (phase !== 1 && phase !== 2 && phase !== 3 && phase !== 4) throw new Error("phase must be 1, 2, 3, or 4");
  return VENTURE_STEP_COMMANDS[phase];
}

/** Parse the engine's final answer, accepting a fenced JSON block but no prose-only answer. */
export function parseVentureStepProposal(raw: string): VentureStepProposal {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced?.trim() ?? (() => {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    return start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
  })();
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error("selected engine did not return the required Venture step JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Venture step proposal must be a JSON object");
  }
  const value = parsed as Record<string, unknown>;
  if (typeof value.command !== "string") throw new Error("Venture step proposal needs a command");
  if (!Array.isArray(value.args) || !value.args.every(isSafeArg)) {
    throw new Error("Venture step proposal args must be safe lowercase ids");
  }
  if (!value.input || typeof value.input !== "object" || Array.isArray(value.input)) {
    throw new Error("Venture step proposal needs a JSON input object");
  }
  if (JSON.stringify(value.input).length > 100_000) throw new Error("Venture step proposal input is too large");
  if (value.summary !== undefined && typeof value.summary !== "string") {
    throw new Error("Venture step proposal summary must be text");
  }
  if (typeof value.summary === "string" && value.summary.includes("\u2014")) {
    throw new Error("Venture step proposal summary contains a forbidden long dash");
  }
  return {
    command: value.command,
    args: value.args,
    input: value.input as Record<string, unknown>,
    ...(typeof value.summary === "string" ? { summary: value.summary } : {}),
  };
}

/** Validate the command and argument shape before any Venture CLI can write. */
export function validateVentureStepProposal(phase: number, proposal: VentureStepProposal): VentureStepProposal {
  const allowed = allowedForPhase(phase);
  if (!allowed.includes(proposal.command)) {
    throw new Error(`Venture step "${proposal.command}" is not allowed in Phase ${phase}; human selection and approval steps stay in the room`);
  }
  if (!proposal.args.every(isSafeArg)) throw new Error("Venture step proposal args must be safe lowercase ids");
  const needsId = proposal.command === "draft" || proposal.command === "thank-you-note-draft";
  if (proposal.args.length !== (needsId ? 1 : 0)) {
    throw new Error(`Venture step "${proposal.command}" expects ${needsId ? "one safe id" : "no arguments"}`);
  }
  return proposal;
}

export function ventureStepPrompt(slug: string, phase: number, thread: unknown): string {
  return [
    "Read .claude/skills/venture/SKILL.md in full before acting.",
    "You are proposing exactly one model-owned Venture draft or analysis step for the current phase.",
    "Work read-only: do not edit, delete, or create files and do not run a phase command yourself.",
    "Return ONLY one JSON object with this shape: {command, args, input, summary}.",
    "The server will validate the command and feed input to the existing Venture CLI, which owns every gate.",
    "Choose only a draft/recommendation command for the current phase. Never choose platform-select, select, concept-select, problem-select, transformation-select, price-select, operating-plan-choice-select, approve, discard, restore, deliver, confirm-live, checkpoint, response-ingest, day-14-decide, or any phase-transition command.",
    "Stop after one command. Do not auto-select, auto-approve, confirm delivery, clear a checkpoint, publish, or invent claims, evidence, respondents, or measurements.",
    "Use accepted learning evaluations as evidence-bounded context for the next ordinary draft or recommendation. They do not authorize overwriting an existing decision or artifact. Pending, declined, and more-evidence evaluations must not drive a change. Experiment-targeted learning stays in the normal Experiment workflow.",
    "Use safe lowercase ids in args. No em dashes in summary.",
    "",
    `Venture slug: ${slug}`,
    `Current phase: ${phase}`,
    "Current server-derived state:",
    "```json",
    JSON.stringify(thread, null, 2),
    "```",
  ].join("\n");
}

function checkSpawn(result: CommandSpawnResult, jobId: string, label: string, command: string, timeoutMs: number): void {
  const failure = decodeSpawnFailure(result, jobId, {
    timeoutVerb: label,
    timeoutLabel: `${timeoutMs / 1000}s`,
    exitVerb: label,
    command,
  });
  if (failure) throw new Error(failure);
}

function currentThread(slug: string): { phase: number; thread: unknown } {
  const read = handleVentureRead("GET", `/api/venture/${slug}/thread`);
  if (!read || read.status !== 200) {
    const body = read?.body as { error?: unknown } | undefined;
    throw new Error(typeof body?.error === "string" ? body.error : "could not read this venture");
  }
  const thread = (read.body as { thread?: { phase?: unknown } }).thread;
  const phase = thread?.phase;
  if (typeof phase !== "number" || ![1, 2, 3, 4].includes(phase)) throw new Error("this venture has no runnable phase yet");
  return { phase, thread: { ...(thread as Record<string, unknown>), learningEvaluations: readLearningEvaluations(slug) } };
}

export async function enqueueVentureStep(slug: string, requestedPhase: number, engine: Engine = "claude") {
  const current = currentThread(slug);
  if (requestedPhase !== current.phase) throw new Error(`the venture is in Phase ${current.phase}, not Phase ${requestedPhase}`);
  allowedForPhase(requestedPhase);

  return runQueued("venture-step", `Run Venture Phase ${requestedPhase} step with ${ENGINE_LABELS[engine]}`, async (job) => {
    const proposalResult = await runAgentSpawn(job, engine, enginePrompt(engine, "venture", ventureStepPrompt(slug, requestedPhase, current.thread)), {
      timeoutMs: PROPOSAL_TIMEOUT_MS,
      permissionMode: "plan",
      sandbox: "read-only",
    });
    checkSpawn(proposalResult, job.id, `${ENGINE_LABELS[engine]} Venture proposal`, ENGINE_COMMANDS[engine], PROPOSAL_TIMEOUT_MS);
    const proposal = validateVentureStepProposal(requestedPhase, parseVentureStepProposal(proposalResult.stdout));
    const script = join(repoRoot, "src", "venture", `phase${requestedPhase}.ts`);
    const cliResult = await runCommandSpawn(job, process.execPath, ["--import", "tsx", script, proposal.command, slug, ...proposal.args], {
      timeoutMs: CLI_TIMEOUT_MS,
      input: JSON.stringify(proposal.input),
      env: { CONTENT_AGENT_ENGINE: engine },
    });
    checkSpawn(cliResult, job.id, "Venture CLI", process.execPath, CLI_TIMEOUT_MS);
    return {
      engine,
      phase: requestedPhase,
      command: proposal.command,
      summary: proposal.summary ?? "One Venture draft step completed and left at its next human gate.",
      output: cliResult.stdout.trim(),
    };
  }, engine);
}
