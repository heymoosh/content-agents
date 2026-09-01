import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../db/db.js";
import { runDraft, draftModel, type DraftResult } from "../outreach/draft.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { ENGINE_COMMANDS, ENGINE_LABELS, type Engine } from "./engines.js";
import { isOutreachEngine, type OutreachEngine } from "./page-outreach.js";
import { decodeSpawnFailure, logTailSuffix, runClaudeSpawn, runQueued } from "./jobs.js";

const REVISE_TIMEOUT_MS = 180_000;
const DRAFT_TIMEOUT_MS = 120_000;
const DISPOSABLE_OUTREACH_BODY = "Fixture outreach draft grounded in the reviewed lead evidence.";
const DISPOSABLE_OUTREACH_REVISION = "Fixture revised outreach message, shorter and warmer.";

/** Available only to the combined E2E runner inside its private disposable repository copy. */
export function disposableOutreachEngineAuthorized(
  env: NodeJS.ProcessEnv = process.env,
  root: string = repoRoot,
): boolean {
  const token = env.CONTENT_AGENTS_E2E_CONFIGURED_ENGINE_TOKEN;
  const disposableRoot = env.E2E_REPO_ROOT;
  if (!token || !disposableRoot) return false;
  try {
    if (realpathSync(disposableRoot) !== realpathSync(root)) return false;
  } catch { return false; }
  const marker = join(root, ".e2e-configured-engine-token");
  return existsSync(marker) && readFileSync(marker, "utf8") === token;
}

function requireValidDisposableOutreachAuthorization(): boolean {
  const requested = Boolean(process.env.CONTENT_AGENTS_E2E_CONFIGURED_ENGINE_TOKEN);
  const authorized = disposableOutreachEngineAuthorized();
  if (requested && !authorized) {
    throw new Error("disposable Outreach engine token was present but marker/root authorization failed");
  }
  return authorized;
}

function engineName(job: { engine?: Engine }): string {
  return ENGINE_LABELS[job.engine ?? "claude"];
}

function requireOutreachEngine(engine: unknown): OutreachEngine {
  if (!isOutreachEngine(engine)) throw new Error(`Outreach engine must be ChatGPT or Grok; received ${String(engine)}`);
  return engine;
}

// Same "revise ONE file with Claude" pattern as briefRevisePrompt/reviseBrief, scoped to a drafted
// (never locked) outreach message. Exported so the guardrails (one file, frontmatter intact,
// evidence-grounded, voice.yaml) are unit-testable — this prompt decides what an outreach message
// can say, so it's content-generation-adjacent (CLAUDE.md rule 7 flags it at the PR).
export function outreachMessageRevisePrompt(relPath: string, channel: string, instruction: string): string {
  return [
    `Revise ONE file in place for Muxin Li's outreach pipeline: a drafted outreach message (channel: ${channel || "?"}). Do not run shell commands; just edit the one file, then stop.`,
    ``,
    `File to edit: ${relPath}`,
    `Muxin's request: "${instruction}"`,
    ``,
    `Rules:`,
    `- Edit ONLY that one file. Touch nothing else — no lead.md, no other message, no review-queue.md.`,
    `- Keep the YAML frontmatter block intact (lead, channel, evidence, classification, status). Change only the body (the message text).`,
    `- Stay grounded in the lead's cited evidence (the lead.md ## Evidence items the frontmatter references) — NEVER invent a fact about the company, the person, or Muxin.`,
    `- Follow config/voice.yaml: no em dashes, no AI tells, Muxin's plain PM voice.`,
    `- Be surgical: apply the request, do not rewrite what was not asked.`,
  ].join("\n");
}

// Revise a lead's drafted outreach message in place (Outreach tab's "Revise with AI"). Refuses a
// locked message — a locked text is Muxin's final word; a new angle goes through the existing
// draft-follow-up path instead. `dir`/`file` are validated by the route (isValidLeadDir + the
// messages/message-NN.md shape) before this runs.
export async function reviseOutreachMessage(dir: string, file: string, instruction: string, engine: unknown = "codex"): Promise<{ body: string }> {
  const outreachEngine = requireOutreachEngine(engine);
  if (!instruction.trim()) throw new Error("tell ChatGPT or Grok what to change first");
  const abs = join(repoRoot, dir, file);
  if (!existsSync(abs)) throw new Error("no such message to revise");
  const before = splitFrontmatter(readFileSync(abs, "utf8"));
  if (String(before.fm.status ?? "").trim() === "locked") {
    throw new Error("this message is locked. Use Draft follow-up for a new touch instead");
  }
  const channel = typeof before.fm.channel === "string" ? before.fm.channel : "";
  const prompt = outreachMessageRevisePrompt(`${dir}/${file}`, channel, instruction.trim());

  // Its own kind, not the shared "revise": a job's kind is what picks the room its progress shows
  // in, and "revise" routes to Content. Clicking "Update it" on an Outreach thread used to leave
  // the Outreach strip idle and post the Connector's work under Content as the Formatter. Content
  // derivative revises still use "revise" and still belong in Content.
  return runQueued("outreach-revise", `Revise outreach message: ${dir}/${file}`, async (job) => {
    if (requireValidDisposableOutreachAuthorization()) {
      writeFileSync(abs, `${before.header}\n${DISPOSABLE_OUTREACH_REVISION}\n`);
    } else {
      const result = await runClaudeSpawn(job, prompt, { timeoutMs: REVISE_TIMEOUT_MS });
      const failure = decodeSpawnFailure(result, job.id, {
        timeoutVerb: "Claude", timeoutLabel: `${REVISE_TIMEOUT_MS / 1000}s`, exitVerb: "Claude revise",
      });
      if (failure) throw new Error(failure);
    }
    const after = splitFrontmatter(readFileSync(abs, "utf8")).body;
    if (after === before.body) {
      throw new Error(`${engineName(job)} ran but didn't change anything. Try a more specific instruction`);
    }
    return { body: after.trim() };
  }, outreachEngine);
}

// ── Follow-ups tab: "Draft follow-up" ────────────────────────────────────────────────────────
// A follow-up touch is a Spin reframe of the already-locked message, extraction-first (plan §5
// stage 9) — this reuses outreach/draft.ts's runDraft() (the ONE place composed prose is allowed,
// c308a8cf/CLAUDE.md rule 1's scoped exception) verbatim, never a bespoke compose path. Routed
// through the SAME job queue every other GUI Claude spawn uses, so it's bounded by the one
// `draining` mutex. Writes a new messages/message-NN.md + a `pending` review-queue.md row — same
// as any other draft — nothing here sends or locks anything (CLAUDE.md rule 2 analog).
//
// Card d39258ab: runDraft's default callClaudeDraft spawns via execFile, so this job used to get
// no persisted log or heartbeat despite being routed through the shared queue — unlike every other
// Claude-spawning GUI action. Fix: inject a callClaude backed by the shared runClaudeSpawn/
// decodeSpawnFailure so it gets a real log + heartbeat too, WITHOUT changing what gets generated —
// same model (draftModel(), the same resolver draft.ts's own callClaudeDraft uses), same --tools ""
// lockdown, same prompt, same timeout as draft.ts's own execFile call. Only transport + error
// wording differ.
//
// NO `STEP` MARKERS on this job, deliberately. runDraft takes the spawn's stdout AS THE MESSAGE
// BODY, so a `STEP 1/3 ...` line would land inside messages/message-NN.md. It is one step anyway;
// the lastStdoutLine heartbeat is the whole progress story.

// The ONE queued-draft path, shared by Follow-ups' "Draft follow-up" and the Outreach thread's
// directed first draft. Only the label and the optional typed direction differ; the transport,
// model, tools lockdown and timeout stay identical so neither caller can drift from the other.
export interface OutreachDraftJobDeps {
  /** Injectable only for focused tests; production keeps the existing runDraft path. */
  runDraft?: typeof runDraft;
  /** Injectable only for focused tests; production uses the shared engine-aware spawn. */
  spawn?: typeof runClaudeSpawn;
}

export function enqueueOutreachDraft(
  label: string,
  dir: string,
  opts: { channel?: string; recipient?: string; direction?: string },
  engine: unknown = "codex",
  deps: OutreachDraftJobDeps = {},
): Promise<DraftResult> {
  const outreachEngine = requireOutreachEngine(engine);
  const draft = deps.runDraft ?? runDraft;
  const spawn = deps.spawn ?? (requireValidDisposableOutreachAuthorization()
    ? async () => ({ code: 0, timedOut: false, enoent: false, stdout: DISPOSABLE_OUTREACH_BODY })
    : runClaudeSpawn);
  return runQueued("draft-follow-up", label, (job) =>
    draft(dir, {
      channel: opts.channel,
      recipient: opts.recipient,
      direction: opts.direction,
      callClaude: async (prompt) => {
        const result = await spawn(job, prompt, {
          timeoutMs: DRAFT_TIMEOUT_MS,
          model: draftModel(),
          tools: "",
          permissionMode: null,
        });
        const failure = decodeSpawnFailure(result, job.id, {
          timeoutVerb: `${engineName(job)} draft`,
          timeoutLabel: "120s",
          exitVerb: `${engineName(job)} draft`,
          includeTailOnTimeout: true,
          command: ENGINE_COMMANDS[job.engine ?? "claude"],
        });
        if (failure) throw new Error(failure);
        const text = result.stdout.trim();
        if (!text) throw new Error(`${engineName(job)} returned no text during draft`);
        return text;
      },
    }),
    outreachEngine,
  );
}

export async function enqueueFollowUpDraft(
  dir: string,
  channel?: string,
  recipient?: string,
  engine: unknown = "codex",
  deps: OutreachDraftJobDeps = {},
): Promise<DraftResult> {
  return enqueueOutreachDraft(`Draft follow-up: ${dir}`, dir, { channel, recipient }, engine, deps);
}

// ── Outreach thread: the directed first draft (v7 handoff §3, the conversational half) ───────
// Muxin types what she wants said, and that text rides into THIS run's draft prompt (see
// buildDraftPrompt's direction block). It wins over the stored pitch_angle where they disagree,
// because pitch_angle is what research.ts concluded upstream and the typed direction is what she
// wants now. Iterating on the result is NOT here: it reuses the existing reviseOutreachMessage /
// POST /api/outreach/message/revise path, so there is exactly one revise path in this codebase.
export async function enqueueDirectedDraft(
  dir: string,
  channel?: string,
  recipient?: string,
  direction?: string,
  engine: unknown = "codex",
  deps: OutreachDraftJobDeps = {},
): Promise<DraftResult> {
  return enqueueOutreachDraft(`Draft message: ${dir}`, dir, { channel, recipient, direction }, engine, deps);
}
