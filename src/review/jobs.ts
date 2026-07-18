// Job queue + Claude subprocess runner for the review GUI (serve.ts). Every Claude-spawning GUI
// action funnels through the ONE queue defined here (Codebase review Phase 2, "GUI actions"):
// the "Add / Queue" atomize/video jobs, "Revise with Claude" (reviseDerivative/reviseBrief),
// "Duplicate to platform" (duplicateToPlatform), and — via runQueued/runClaudeSpawn, imported back
// into serve.ts — the Strategy tab's generateInsights/askInsights. One `draining` mutex serializes
// ALL of them, so GUI concurrency is bounded and every run gets a persisted log + heartbeat exactly
// like an atomize job (previously only atomize jobs queued; the other four spawned unbounded).
// Split out of serve.ts (Codebase review Phase 5c).

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, createWriteStream } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import { spawn } from "node:child_process";
import { repoRoot } from "../db/db.js";
import { appendRow, readQueue, stampOrigin } from "../publish/queue.js";
import { TEXT_PLATFORMS } from "../publish/typefully.js";
import { resolveAngle } from "../atomize/spin.js";
import { loadPlatforms } from "../config/platforms.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { CONTENT, safeFolder, isValidLens } from "./rows.js";
import { roundCount } from "./develop.js";
import { briefRevisePrompt, latestBriefPath } from "./serve.js";
import { runDraft, draftModel, type DraftResult } from "../outreach/draft.js";

// Per-job stdout/stderr logs for the atomize job queue (see the Job interface below) — persisted
// to disk so a job's real output survives past the 40MB in-memory buffer execFile used to impose,
// and so a "view log" link + failure log-tail have something to read.
const JOB_LOG_DIR = join(homedir(), ".content-agents", "logs", "gui-jobs");
export function jobLogPath(jobId: string): string {
  return join(JOB_LOG_DIR, `${jobId}.log`);
}

// The last non-empty line of accumulated output — the "heartbeat" shown in the jobs pill so a
// long-running job doesn't read as a silent black box. Pure/testable: takes the buffer directly
// rather than reading a file.
export function lastNonEmptyLine(text: string): string | null {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.length ? lines[lines.length - 1] : null;
}

// Last `n` lines of `text`, joined back with newlines — used to attach a bounded log tail to
// job.error on failure instead of the whole (potentially large) log.
export function tailLines(text: string, n: number): string {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  return lines.slice(-n).join("\n");
}

// "Revise with Claude" ("Ask Claude" in the GUI): shell out to headless Claude Code (`claude -p`),
// which uses Muxin's subscription ($0 marginal), to edit ONE derivative in place per a
// natural-language instruction.
const REVISE_TIMEOUT_MS = 180_000;

// Ask Claude's real scope, in one line, reused everywhere the boundary needs stating: editing ONE
// existing derivative's body text in place. Anything else (retargeting the platform, creating a
// new post) is out of scope BY DESIGN — "Duplicate to platform" is the actual affordance for that
// (card 9304e4a5).
const REVISE_SCOPE = "edit this ONE post's body text in place";

// The exact line Claude must print (and ONLY that, no edit) when a request falls outside
// REVISE_SCOPE — e.g. "make this an X post instead" (a platform/frontmatter change) or "write a
// new post about..." (a new derivative). Matched back by parseReviseRefusal. Previously an
// out-of-scope ask just silently changed nothing and surfaced as a generic "didn't change
// anything" — indistinguishable from Claude simply not bothering. Now it's a real, specific reason.
const REFUSAL_MARKER = "REFUSED:";

// Build the instruction for a single-file, extraction-first revision. Kept explicit + exported so
// the guardrails (edit only this file, keep frontmatter, stay traceable, voice.yaml) can't drift.
export function revisePrompt(slug: string, id: string, platform: string, instruction: string): string {
  const isCardCaption = /^quote-card-\d+-[a-z]+$/i.test(id);
  return [
    `Revise ONE content derivative in place for Muxin Li's content pipeline. Do not run shell commands; just edit the one file, then stop.`,
    ``,
    `File to edit: content/${slug}/derivatives/${id}.md   (platform: ${platform || "?"})`,
    `Muxin's request: "${instruction}"`,
    ``,
    `Your scope is ONLY to ${REVISE_SCOPE}. If the request asks for anything outside that scope —`,
    `changing which platform this derivative targets (its frontmatter \`platform\`), creating a`,
    `brand-new post/derivative, or anything that isn't an edit to this one file's existing body —`,
    `do NOT edit the file. Instead print EXACTLY one line to stdout: "${REFUSAL_MARKER} <short reason,`,
    `one sentence>" (e.g. "${REFUSAL_MARKER} that would retarget the platform — use Duplicate to`,
    `platform instead"), then stop. Do not print anything else in that case.`,
    ``,
    `Rules (when the request IS in scope):`,
    `- Edit ONLY that one file. Touch nothing else.`,
    `- Keep the YAML frontmatter block intact (platform, spin, angle, source_lines, cta, ...). Change only the body (the post text) unless the request is explicitly about frontmatter.`,
    `- Extraction-first: the body must stay traceable to Muxin's source at content/${slug}/source.md. If the derivative has spin: true you may re-angle within its config/platforms.yaml spin_angles guardrails, but NEVER invent a claim, statistic, metaphor, or worldview Muxin did not express.`,
    `- Follow config/voice.yaml: no em dashes, no AI tells, Muxin's plain PM voice.`,
    `- Respect the platform's max_chars in config/platforms.yaml.`,
    isCardCaption
      ? `- This is a quote-card CAPTION: it gives CONTEXT around the quote shown on the image. Do not restate the quote; keep it context-only.`
      : ``,
    `- Be surgical: apply the request, do not rewrite what was not asked.`,
  ]
    .filter(Boolean)
    .join("\n");
}

// Pure: pulls Claude's refusal reason (if any) out of a job's captured stdout. Exported so the
// refusal path is unit-testable without spawning a subprocess.
export function parseReviseRefusal(stdout: string): string | null {
  const m = stdout.match(new RegExp(`^${REFUSAL_MARKER}\\s*(.+)$`, "m"));
  return m ? m[1].trim() : null;
}

// Run the revision through headless Claude Code (subscription, no per-token API cost), then return
// the edited body. Failures (missing CLI, timeout, non-zero exit, refusal, no-op) surface as
// thrown messages the GUI shows durably on the row instead of a silent no-op or a crash. Routed
// through runQueued so "Ask Claude" shares the ONE job queue/log/heartbeat every other Claude spawn
// in this GUI does (Codebase review Phase 2) — no separate concurrency lane.
export async function reviseDerivative(slug: string, id: string, instruction: string): Promise<string> {
  const folder = safeFolder(slug);
  if (!/^[\w.-]+$/.test(id)) throw new Error("bad id");
  if (!instruction.trim()) throw new Error("tell Claude what to change first");
  const p = join(folder, "derivatives", `${id}.md`);
  if (!existsSync(p)) throw new Error("no such derivative to revise");

  const original = splitFrontmatter(readFileSync(p, "utf8"));
  const platform = typeof original.fm.platform === "string" ? original.fm.platform : "";
  const prompt = revisePrompt(slug, id, platform, instruction.trim());

  return runQueued("revise", `Ask Claude: ${slug}/${id}`, async (job) => {
    const result = await runClaudeSpawn(job, prompt, { timeoutMs: REVISE_TIMEOUT_MS });
    const failure = decodeSpawnFailure(result, job.id, {
      timeoutVerb: "Claude", timeoutLabel: `${REVISE_TIMEOUT_MS / 1000}s`, exitVerb: "Claude revise",
    });
    if (failure) throw new Error(failure);

    const refusal = parseReviseRefusal(result.stdout);
    if (refusal) throw new Error(`Ask Claude can't do that: ${refusal}`);

    const after = splitFrontmatter(readFileSync(p, "utf8")).body;
    if (after === original.body) {
      throw new Error("Claude ran but didn't change anything — try a more specific instruction");
    }
    return after;
  });
}

// Same "revise with Claude" pattern as reviseDerivative, but for the latest strategy brief instead
// of a derivative — briefRevisePrompt/latestBriefPath stay in serve.ts (part of the Strategy/
// Analytics block), imported back here since this is the one place that spawns the subprocess.
export async function reviseBrief(instruction: string): Promise<{ path: string; content: string }> {
  const abs = latestBriefPath();
  if (!abs) throw new Error("no strategy brief exists yet — run /strategy first");
  if (!instruction.trim()) throw new Error("tell Claude what to change first");
  const relPath = abs.slice(repoRoot.length + 1);
  const before = readFileSync(abs, "utf8");
  const prompt = briefRevisePrompt(relPath, instruction.trim());

  return runQueued("brief-revise", `Revise brief: ${relPath}`, async (job) => {
    const result = await runClaudeSpawn(job, prompt, { timeoutMs: REVISE_TIMEOUT_MS });
    const failure = decodeSpawnFailure(result, job.id, {
      timeoutVerb: "Claude", timeoutLabel: `${REVISE_TIMEOUT_MS / 1000}s`, exitVerb: "Claude revise",
    });
    if (failure) throw new Error(failure);
    const after = readFileSync(abs, "utf8");
    if (after === before) throw new Error("Claude ran but didn't change anything — try a more specific instruction");
    return { path: relPath, content: after };
  });
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
export async function reviseOutreachMessage(dir: string, file: string, instruction: string): Promise<{ body: string }> {
  if (!instruction.trim()) throw new Error("tell Claude what to change first");
  const abs = join(repoRoot, dir, file);
  if (!existsSync(abs)) throw new Error("no such message to revise");
  const before = splitFrontmatter(readFileSync(abs, "utf8"));
  if (String(before.fm.status ?? "").trim() === "locked") {
    throw new Error("this message is locked — use Draft follow-up for a new touch instead");
  }
  const channel = typeof before.fm.channel === "string" ? before.fm.channel : "";
  const prompt = outreachMessageRevisePrompt(`${dir}/${file}`, channel, instruction.trim());

  return runQueued("revise", `Revise outreach message: ${dir}/${file}`, async (job) => {
    const result = await runClaudeSpawn(job, prompt, { timeoutMs: REVISE_TIMEOUT_MS });
    const failure = decodeSpawnFailure(result, job.id, {
      timeoutVerb: "Claude", timeoutLabel: `${REVISE_TIMEOUT_MS / 1000}s`, exitVerb: "Claude revise",
    });
    if (failure) throw new Error(failure);
    const after = splitFrontmatter(readFileSync(abs, "utf8")).body;
    if (after === before.body) {
      throw new Error("Claude ran but didn't change anything — try a more specific instruction");
    }
    return { body: after.trim() };
  });
}

// ── Content ingestion: the GUI's front door ─────────────────────────────────────────────────
// The review page is an inbox; this is the door. Muxin drops a source — pasted text, a file path
// (e.g. an Obsidian note), a Substack URL, or "pull my Notes" — and the GUI runs the REAL /atomize
// headlessly via `claude -p` on his subscription ($0 marginal), one job at a time so he can keep
// queueing while it works. Nothing here publishes: atomize only drafts + queues, and every
// derivative still lands `pending` for review on the other tab (CLAUDE.md rule 2).
const INBOX = join(CONTENT, ".inbox"); // pasted/copied sources live here (git-ignored)
const ATOMIZE_TIMEOUT_MS = 15 * 60_000;
// acceptEdits (not bypass) is enough: the project settings already allowlist `npm run:*`, which is
// all atomize shells out to. Overridable for a setup that needs a different mode.
const ATOMIZE_PERMISSION_MODE = process.env.ATOMIZE_PERMISSION_MODE ?? "acceptEdits";

type JobStatus = "queued" | "running" | "done" | "failed";
// "url" | "file" | "text" | "notes" | "continue" | "video" are the atomize-family kinds (dispatch
// a slash-command against a folder/source, verified by artifact check — see drain() below).
// "revise" | "brief-revise" | "insights" | "ask-insights" | "duplicate" | "draft-follow-up" |
// "pull" | "strategy" | "scout" are generic task jobs (run an arbitrary async task via runQueued)
// — the four call sites complaint 2 flagged as spawning unbounded, plus "Duplicate to platform",
// the Follow-ups tab's "Draft follow-up", the Analytics tab's "Pull fresh now" (runCommandSpawn,
// not a claude spawn) and "Refresh brief" (a full /strategy run), and the Outreach tab's "Scout
// new leads" (npm run scout). All families share the same queue/mutex/log/heartbeat.
// "develop" | "develop-reply" are the Develop tab's advisor rounds — same slash-command-dispatch
// shape as the atomize family (`/develop <arg>`), verified by their own artifact check (a new
// parseable round in develop/advice.json — see runDevelopJob below).
export type JobKind =
  | "url" | "file" | "text" | "notes" | "continue" | "video"
  | "develop" | "develop-reply"
  | "revise" | "brief-revise" | "insights" | "ask-insights" | "duplicate" | "draft-follow-up"
  | "pull" | "strategy" | "scout";
interface Job {
  id: string;
  kind: JobKind;
  label: string;
  arg: string; // atomize-family only: what the slash command receives (url, .inbox path, folder, "notes")
  status: JobStatus;
  slugs: string[]; // content folders touched — linked back so the Review tab can jump to them
  error: string | null;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  lastStdoutLine: string | null; // heartbeat — last non-empty line seen so far, updated as output streams in
  // Task jobs only (revise/brief-revise/insights/ask-insights/duplicate) — the actual work this job
  // runs once it's its turn. Never serialized: publicJob() below is an explicit allowlist that omits
  // it, so this stays an internal queue-execution detail, not part of the polled /api/jobs shape.
  task?: (job: Job) => Promise<void>;
}
export const jobs: Job[] = [];
let jobSeq = 0;
let draining = false;

// "Clear queue" (GUI) only ever removes finished entries — queued/running jobs stay untouched.
// drain() finds work via jobs.find(status==="queued"), not by index, so splicing mid-array here is
// safe even while a job is actively running.
export function clearFinishedJobs(): number {
  let removed = 0;
  for (let i = jobs.length - 1; i >= 0; i--) {
    if (jobs[i].status === "done" || jobs[i].status === "failed") {
      jobs.splice(i, 1);
      removed++;
    }
  }
  return removed;
}

// Job ids must stay unique across a server RESTART, not just within one process: they key the
// persisted per-job log file (jobLogPath) under ~/.content-agents/logs/gui-jobs/, which outlives
// the process. `jobSeq` alone resets to 0 on every restart, so a bare `job-${++jobSeq}` reissues
// "job-1", "job-2", ... every time the GUI restarts — colliding with a prior run's ids and, since
// runClaudeSpawn opens that log file in append mode, silently concatenating this run's output onto
// whatever an unrelated old run already wrote there (surfaced as mixed-in stale content in the
// queue UI's error/log view). Prefixing with the process start time makes a collision require two
// server starts landing in the same millisecond — effectively impossible.
//
// buildJobId is the pure piece of that invariant (session start ms + intra-session sequence
// number), split out so the uniqueness guarantee is directly unit-testable without needing to
// simulate an actual process restart (jobIdPrefix/jobSeq below are the real module-level wiring).
export function buildJobId(sessionStartMs: number, seq: number): string {
  return `job-${sessionStartMs}-${seq}`;
}
const jobIdPrefix = Date.now();
function nextJobId(): string {
  return buildJobId(jobIdPrefix, ++jobSeq);
}

// Enqueue an arbitrary async task through the SAME queue/mutex atomize jobs use, so it's bounded
// by the one `draining` gate and shows up in the jobs pill with a real log + heartbeat (via
// runClaudeSpawn inside the task). The caller's promise resolves/rejects with whatever `task`
// returns/throws — the job bookkeeping (status/error/finishedAt) is separate, driven by drain().
export function runQueued<T>(kind: JobKind, label: string, task: (job: Job) => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = nextJobId();
    const job: Job = {
      id, kind, label, arg: "", status: "queued", slugs: [], error: null,
      createdAt: Date.now(), startedAt: null, finishedAt: null, lastStdoutLine: null,
      task: async (j) => {
        try {
          resolve(await task(j));
        } catch (e) {
          job.error = e instanceof Error ? e.message : String(e);
          reject(e);
          throw e; // rethrow so drain()'s own try/catch also marks the job "failed", not "done"
        }
      },
    };
    jobs.push(job);
    void drain();
  });
}

// Generic spawn: streamed to the job's persisted log + heartbeat exactly like the atomize path
// (persist + stream, not execFile's 40MB in-memory buffer). Shared by every subprocess-spawning
// call site in the GUI — atomize-family jobs AND task jobs (revise/brief-revise/insights/
// ask-insights/duplicate/pull) — so they all get the same log file + heartbeat UX. `stdout` is
// captured separately (not just written to the log) for callers that need the process's actual
// answer text (insights/ask) or a refusal marker (revise), since the log interleaves stdout+stderr.
interface CommandSpawnResult {
  code: number | null;
  timedOut: boolean;
  enoent: boolean;
  stdout: string;
}
// Node's own `timeout` option kills a stuck child with `killSignal` (always SIGTERM here — see
// runCommandSpawn) once timeoutMs elapses, so seeing that signal back means we timed out, not a
// crash. But `claude`'s compiled native binary CATCHES SIGTERM and exits with numeric code 143
// (128+15) instead of dying by signal — so a run we killed for running too long can show up as
// `code=143, signal=null`, which reads exactly like a plain nonzero-exit crash unless callers also
// check for 143. killSignal:SIGTERM is the only signal this module ever sends a child, so either
// tell means our own timeout fired.
export function isSpawnTimeout(code: number | null, signal: NodeJS.Signals | null): boolean {
  return signal === "SIGTERM" || code === 143;
}

export function runCommandSpawn(
  job: Job,
  command: string,
  args: string[],
  opts: { timeoutMs: number; env?: NodeJS.ProcessEnv }
): Promise<CommandSpawnResult> {
  mkdirSync(JOB_LOG_DIR, { recursive: true });
  const log = createWriteStream(jobLogPath(job.id), { flags: "a" });
  let tailBuf = "";
  let stdoutBuf = "";
  const onChunk = (isStdout: boolean) => (chunk: Buffer) => {
    const text = chunk.toString("utf8");
    if (isStdout) stdoutBuf += text;
    log.write(chunk);
    tailBuf = (tailBuf + text).slice(-4000); // bounded tail buffer — heartbeat only needs the last line
    const line = lastNonEmptyLine(tailBuf);
    if (line) job.lastStdoutLine = line;
  };
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      timeout: opts.timeoutMs,
      killSignal: "SIGTERM",
      // Explicitly close the child's stdin (rather than leaving Node's default open, unwritten
      // pipe) — no caller here ever writes to it, but an unclosed pipe makes `claude -p` wait up
      // to 3s for stdin input before it warns and proceeds without it ("no stdin data received in
      // 3s"). Closing it up front skips that wait entirely.
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...opts.env },
    });
    let enoent = false;
    child.on("error", (e) => {
      enoent = (e as { code?: string }).code === "ENOENT";
    });
    child.stdout?.on("data", onChunk(true));
    child.stderr?.on("data", onChunk(false));
    child.on("close", (code, signal) => {
      // Wait for the write stream to actually flush before resolving — callers read the log file
      // back synchronously right after this promise settles (for the failure tail), and
      // log.end() alone doesn't guarantee the last chunk has hit disk yet.
      log.end(() => {
        resolve({ code, timedOut: isSpawnTimeout(code, signal), enoent, stdout: stdoutBuf });
      });
    });
  });
}

// Pure argv builder for runClaudeSpawn, split out so a caller's exact invocation is unit-testable
// without spawning a real subprocess. `permissionMode: null` omits the --permission-mode flag
// entirely (draft.ts's callClaudeDraft never passes one, using --model/--tools instead — see
// enqueueFollowUpDraft below); omitting the option (undefined) keeps the original "acceptEdits"
// default so every pre-existing caller is unaffected.
export function buildClaudeSpawnArgs(
  prompt: string,
  opts: { permissionMode?: string | null; model?: string; tools?: string }
): string[] {
  const args = ["-p", prompt];
  if (opts.permissionMode !== null) args.push("--permission-mode", opts.permissionMode ?? "acceptEdits");
  if (opts.model !== undefined) args.push("--model", opts.model);
  if (opts.tools !== undefined) args.push("--tools", opts.tools);
  return args;
}

// `claude -p "<prompt>"` specifically, layered on runCommandSpawn above.
export function runClaudeSpawn(
  job: Job,
  prompt: string,
  opts: { timeoutMs: number; permissionMode?: string | null; model?: string; tools?: string; env?: NodeJS.ProcessEnv }
): Promise<CommandSpawnResult> {
  return runCommandSpawn(job, "claude", buildClaudeSpawnArgs(prompt, opts), opts);
}

// Last ~30 lines of a job's persisted log, formatted as a "\n---\n<tail>" suffix to append to an
// error message — or "" if there's no log to read yet. Shared by every failure path below so a
// failed job's error always points at what actually happened, not just an exit code.
export function logTailSuffix(jobId: string): string {
  try {
    const tail = tailLines(readFileSync(jobLogPath(jobId), "utf8"), 30);
    return tail ? `\n---\n${tail}` : "";
  } catch {
    return "";
  }
}

// The ONE enoent/timedOut/non-zero-exit classification for a runClaudeSpawn() result, shared by
// every Claude-spawning call site in the GUI (reviseDerivative, reviseBrief, duplicateToPlatform,
// generateInsights/askInsights in serve.ts, runVideoJob, and drain()'s atomize branch — previously
// six near-duplicated if/else-if chains, one per call site). Returns the failure message the caller
// should throw or assign, or null when the run was clean (exit 0, no timeout/enoent) so the caller
// proceeds to its own success-path work.
//
// Call sites disagree on wording, not on the underlying decoding, so the differences are captured
// as options rather than papered over:
// - `timeoutVerb`/`exitVerb` let a site's timeout and exit-code messages use different verbs (e.g.
//   reviseDerivative says "Claude timed out" but "Claude revise failed").
// - `timeoutLabel` is the pre-formatted duration ("180s" vs "15 min") since sites disagree on unit.
// - `includeTailOnTimeout` preserves an existing quirk: the assign-style sites (runVideoJob, the
//   atomize branch of drain()) append the log tail to the timeout message too, while the throw-style
//   sites (revise/insights/duplicate) don't. Preserved as-is — this is a pure extraction, not a
//   behavior change.
// - `command` names the binary in the ENOENT message; defaults to "claude" since every pre-existing
//   call site spawns `claude` — pullFreshAnalytics (serve.ts) is the first non-claude spawn through
//   this decoder (`npm`) and passes it explicitly so a missing-npm error doesn't blame `claude`.
export function decodeSpawnFailure(
  result: { code: number | null; timedOut: boolean; enoent: boolean },
  jobId: string,
  opts: { timeoutVerb: string; timeoutLabel: string; exitVerb: string; includeTailOnTimeout?: boolean; command?: string }
): string | null {
  if (result.enoent) {
    // `command` names the actual spawned CLI (runCommandSpawn call sites, e.g. "npm") — the
    // default stays "claude" so every pre-existing call site's message is unchanged.
    const cli = opts.command ?? "claude";
    return `the \`${cli}\` CLI isn't on this server's PATH — start the GUI from a terminal where \`${cli}\` runs`;
  }
  if (result.timedOut) {
    const tail = opts.includeTailOnTimeout ? logTailSuffix(jobId) : "";
    return `${opts.timeoutVerb} timed out after ${opts.timeoutLabel}${tail}`;
  }
  if (result.code !== 0) {
    return `${opts.exitVerb} failed (exit ${result.code})${logTailSuffix(jobId)}`;
  }
  return null;
}

// How a raw source string should reach /atomize. Exported + `exists` injected so it's unit-testable
// without touching the filesystem.
export function classifySource(
  raw: string,
  exists: (p: string) => boolean = existsSync,
): { kind: "url" | "file" | "file-not-found" | "text"; arg: string; label: string } {
  const s = raw.trim();
  if (/^https?:\/\//i.test(s)) return { kind: "url", arg: s, label: s };
  const asPath = s.startsWith("~/") ? join(homedir(), s.slice(2)) : s;
  // A short single-line string that resolves to a real file is a path (e.g. an Obsidian note).
  if (s && !s.includes("\n") && s.length < 400 && exists(asPath)) {
    return { kind: "file", arg: asPath, label: basename(asPath) };
  }
  // A string that LOOKS like a path (a slash with no spaces, a `~/` prefix, or a drive letter)
  // but doesn't resolve is a typo'd path, not pasted note content — say so fast instead of
  // materializing the raw string as fake note content and burning an LLM atomize run on it.
  const looksLikePath =
    s && !s.includes("\n") && s.length < 400 &&
    (s.startsWith("~/") || /^[A-Za-z]:[\\/]/.test(s) || (s.includes("/") && !s.includes(" ")));
  if (looksLikePath) {
    return { kind: "file-not-found", arg: asPath, label: basename(asPath) };
  }
  const firstLine = s.split("\n").map((l) => l.trim()).find(Boolean) ?? "pasted text";
  return { kind: "text", arg: "", label: firstLine.replace(/^#\s*/, "").slice(0, 80) };
}

// Turns a classifySource() result into either a dispatch descriptor for addJob() or an immediate
// client-facing error — kept separate from the /api/atomize route handler so the file-not-found
// short circuit is unit-testable without spinning up the HTTP server.
export function sourceDispatch(
  c: ReturnType<typeof classifySource>,
  rawText: string,
): { error: string } | { kind: AtomizeFamilyKind; arg: string; label: string; rawText?: string } {
  if (c.kind === "file-not-found") {
    return { error: `no such file: ${c.arg}` };
  }
  if (c.kind === "text") {
    return { kind: "text", arg: "", label: c.label, rawText };
  }
  return { kind: c.kind, arg: c.arg, label: c.label };
}

// Wall-clock time the job has taken so far — still ticking while running, frozen once it lands.
export function jobElapsedMs(j: Pick<Job, "status" | "startedAt" | "finishedAt">, now: number = Date.now()): number | null {
  if (!j.startedAt) return null;
  return (j.status === "running" ? now : j.finishedAt ?? now) - j.startedAt;
}

export function publicJob(j: Job) {
  return {
    id: j.id, kind: j.kind, label: j.label, status: j.status, slugs: j.slugs,
    error: j.error, createdAt: j.createdAt, startedAt: j.startedAt, finishedAt: j.finishedAt,
    elapsedMs: jobElapsedMs(j), lastStdoutLine: j.lastStdoutLine,
  };
}

function listSlugs(): string[] {
  try {
    return readdirSync(CONTENT, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(CONTENT, d.name, "review-queue.md")))
      .map((d) => d.name);
  } catch {
    return [];
  }
}

// Atomize-family job kinds: url/file/text/notes/continue dispatch `/atomize <arg>`; video
// dispatches `/video <arg>` instead. Both are verified by artifact (not exit code) in drain() below.
type AtomizeFamilyKind = "url" | "file" | "text" | "notes" | "continue" | "video";

// Copy a pasted-text or file source into .inbox under a stable, space-free name so the skill's
// `npm run new-content -- <arg>` never trips over spaces in an Obsidian path. Shared by addJob
// (atomize family) and addDevelopJob — the same door, two destinations.
function materializeInboxArg(kind: "text" | "file", rawArg: string, id: string, rawText?: string): string {
  mkdirSync(INBOX, { recursive: true });
  if (kind === "text") {
    const arg = join(INBOX, `${id}.md`);
    writeFileSync(arg, (rawText ?? "").trim() + "\n");
    return arg;
  }
  const content = readFileSync(rawArg, "utf8");
  const stem = basename(rawArg).replace(/\.[^.]+$/, "");
  const safe = stem.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "note";
  const arg = join(INBOX, `${safe}-${id}.md`);
  // Keep the note's title: if it has no heading, seed one from the filename so the skill doesn't
  // fall back to the safe filename.
  writeFileSync(arg, (/^#\s+/m.test(content) ? "" : `# ${stem}\n\n`) + content);
  return arg;
}

// Materialize a source into a stable, space-free arg for /atomize, then queue it. Pasted text and
// file sources are copied into .inbox (space-free names) via materializeInboxArg; urls and "notes"
// pass straight through. "video" jobs pass their content-folder path straight through too (see
// addVideoJob) — no materialization needed.
export function addJob(kind: AtomizeFamilyKind, rawArg: string, label: string, rawText?: string): Job {
  const id = nextJobId();
  const arg = kind === "text" || kind === "file" ? materializeInboxArg(kind, rawArg, id, rawText) : rawArg;
  const job: Job = {
    id, kind, label, arg, status: "queued", slugs: [], error: null,
    createdAt: Date.now(), startedAt: null, finishedAt: null, lastStdoutLine: null,
  };
  jobs.push(job);
  void drain();
  return job;
}

// "Generate storyboard" (card 9e20a616): enqueue `/video <folder>` through the SAME queue atomize
// jobs run through — no second queue. Idempotent against a double-click: if this folder already
// has a video job queued/running, hand back that job instead of starting a redundant second /video.
export function addVideoJob(slug: string): Job {
  safeFolder(slug); // throws "no such queue" if slug isn't a real content folder
  const arg = join("content", slug);
  const existing = jobs.find((j) => j.kind === "video" && j.arg === arg && (j.status === "queued" || j.status === "running"));
  if (existing) return existing;
  return addJob("video", arg, `Generate storyboard: ${slug}`);
}

// ── Develop tab: the advisor stage ──────────────────────────────────────────────────────────────
// `/develop <arg>` runs the advisor skill headlessly: it reads the source, runs the checks (brand
// angles, CTA sense-check, platform spin fit, routing preview) and appends a recommendation round
// to develop/advice.json + develop/log.md. It NEVER drafts a cut or a derivative — accept/dismiss
// are deterministic server-side actions (src/review/develop.ts), and formatting is a separate
// explicit "Format for platforms" click. Same queue, same artifact-verified contract.

// True while a develop/develop-reply job for this content folder is queued or running — the
// /api/develop/reply route refuses a second concurrent round for the same folder (409-style).
export function developJobInFlight(slug: string): boolean {
  const arg = join("content", slug);
  return jobs.some(
    (j) => (j.kind === "develop" || j.kind === "develop-reply") && j.arg === arg && (j.status === "queued" || j.status === "running"),
  );
}

// Start an advisor round. `source` uses the same classify/materialize door as /api/atomize (url /
// file / pasted text); an existing folder comes in as `{ slug }` instead. Reply rounds are
// enqueued by addDevelopReplyJob AFTER serve.ts persisted the reply to develop/log.md — the spawn
// argv stays a fixed `/develop content/<slug>`, no free text in it.
export function addDevelopJob(kind: "url" | "file" | "text", rawArg: string, label: string, rawText?: string): Job {
  const id = nextJobId();
  const arg = kind === "url" ? rawArg : materializeInboxArg(kind, rawArg, id, rawText);
  const job: Job = {
    id, kind: "develop", label: `Develop: ${label}`, arg, status: "queued", slugs: [], error: null,
    createdAt: Date.now(), startedAt: null, finishedAt: null, lastStdoutLine: null,
  };
  jobs.push(job);
  void drain();
  return job;
}

export function addDevelopFolderJob(slug: string, kind: "develop" | "develop-reply" = "develop"): Job {
  safeFolder(slug); // throws "no such queue" if slug isn't a real content folder
  const arg = join("content", slug);
  const existing = jobs.find(
    (j) => (j.kind === "develop" || j.kind === "develop-reply") && j.arg === arg && (j.status === "queued" || j.status === "running"),
  );
  if (existing) return existing; // idempotent against a double-click, like addVideoJob
  const label = kind === "develop-reply" ? `Advisor reply: ${slug}` : `Develop: ${slug}`;
  const job: Job = {
    id: nextJobId(), kind, label, arg, status: "queued", slugs: [], error: null,
    createdAt: Date.now(), startedAt: null, finishedAt: null, lastStdoutLine: null,
  };
  jobs.push(job);
  void drain();
  return job;
}

// "Format for platforms" arg builder — pure, exported for a direct unit test. The extract lens is
// the top-level default (no cuts/ subfolder — src/atomize/cuts.ts), so it takes no --cut flag.
export function buildFormatArg(slug: string, lens: string): string {
  return lens === "extract" ? `--continue content/${slug}` : `--continue content/${slug} --cut ${lens}`;
}

// Parse a continue-job's arg back into its folder (+ optional cut lens). Pure + exported for unit
// tests; returns null on any shape this module didn't itself build.
export function parseContinueArg(arg: string): { folder: string; lens?: string } | null {
  const m = /^--continue\s+(\S+)(?:\s+--cut\s+(\S+))?\s*$/.exec(arg);
  if (!m) return null;
  if (m[2] !== undefined && !isValidLens(m[2])) return null;
  return m[2] ? { folder: m[1], lens: m[2] } : { folder: m[1] };
}

// Artifact snapshot for a continue job: how many queue rows the folder has, and how many files sit
// in the derivatives dir the job targets (top-level for extract, cuts/<lens>/derivatives for a
// cut). `deps` injected so the growth predicate is unit-testable without a real folder.
export interface ContinueArtifacts {
  rows: number;
  derivatives: number;
}
export function continueArtifactCounts(folderAbs: string, lens?: string): ContinueArtifacts {
  let rows = 0;
  try {
    rows = readQueue(folderAbs).rows.length;
  } catch {
    /* no queue yet — counts as 0 */
  }
  const derivDir = lens ? join(folderAbs, "cuts", lens, "derivatives") : join(folderAbs, "derivatives");
  let derivatives = 0;
  try {
    derivatives = readdirSync(derivDir).length;
  } catch {
    /* dir not created yet — counts as 0 */
  }
  return { rows, derivatives };
}
export function continueJobProgressed(before: ContinueArtifacts, after: ContinueArtifacts): boolean {
  return after.rows > before.rows || after.derivatives > before.derivatives;
}

interface AtomizeRunResult {
  code: number | null;
  timedOut: boolean;
  enoent: boolean;
}

// Spawn the real /atomize headlessly. ATOMIZE_ORIGIN=gui-queue tells the /atomize skill's step 8
// to tag every row it appends "from GUI queue" instead of the default "from /cycle" — the origin
// source-tag the review GUI renders per row (src/publish/queue.ts QUEUE_ORIGINS).
async function runAtomizeJob(job: Job): Promise<AtomizeRunResult> {
  const result = await runClaudeSpawn(job, `/atomize ${job.arg}`, {
    timeoutMs: ATOMIZE_TIMEOUT_MS,
    permissionMode: ATOMIZE_PERMISSION_MODE,
    env: { ATOMIZE_ORIGIN: "gui-queue" },
  });
  return { code: result.code, timedOut: result.timedOut, enoent: result.enoent };
}

// Spawn `/video <folder>` headlessly and verify success by artifact (video/storyboard.md actually
// existing), not exit code — the same "finished" != "worked" fix complaint 4 required for atomize.
// Sets job.status/job.error/job.slugs itself (mirrors the atomize branch of drain() below).
async function runVideoJob(job: Job): Promise<void> {
  const folderAbs = join(repoRoot, job.arg);
  const result = await runClaudeSpawn(job, `/video ${job.arg}`, {
    timeoutMs: ATOMIZE_TIMEOUT_MS,
    permissionMode: ATOMIZE_PERMISSION_MODE,
  });
  const failure = decodeSpawnFailure(result, job.id, {
    timeoutVerb: "video generation", timeoutLabel: `${ATOMIZE_TIMEOUT_MS / 60000} min`,
    exitVerb: "video generation", includeTailOnTimeout: true,
  });
  const storyboardReady = existsSync(join(folderAbs, "video", "storyboard.md"));
  job.status = !failure && storyboardReady ? "done" : "failed";
  if (job.status === "done") {
    job.slugs = [basename(job.arg)]; // enables the jobs pill's "→ review" jump link
    return;
  }
  job.error = failure ?? `/video ran but produced no video/storyboard.md — check the view-log link${logTailSuffix(job.id)}`;
}

// Spawn `/develop <arg>` headlessly and verify by artifact: a NEW, parseable round must have
// landed in develop/advice.json (roundCount uses the tolerant readAdvice parse, so a run that
// exits 0 but writes garbage JSON still fails loudly here instead of rendering nothing). For a
// start-from-source job the folder doesn't exist yet — diff listSlugs() like the atomize branch,
// then check the new folder's round count against 0.
const DEVELOP_TIMEOUT_MS = 10 * 60_000;
async function runDevelopJob(job: Job): Promise<void> {
  const isFolderArg = job.arg.startsWith("content/");
  const beforeSlugs = isFolderArg ? null : new Set(listSlugs());
  const beforeRounds = isFolderArg ? roundCount(join(repoRoot, job.arg)) : 0;
  const result = await runClaudeSpawn(job, `/develop ${job.arg}`, {
    timeoutMs: DEVELOP_TIMEOUT_MS,
    permissionMode: ATOMIZE_PERMISSION_MODE,
  });
  const failure = decodeSpawnFailure(result, job.id, {
    timeoutVerb: "the advisor", timeoutLabel: `${DEVELOP_TIMEOUT_MS / 60000} min`,
    exitVerb: "the advisor", includeTailOnTimeout: true,
  });
  let slug: string | null = isFolderArg ? basename(job.arg) : null;
  if (!isFolderArg) {
    const created = listSlugs().filter((s) => !beforeSlugs!.has(s));
    // Prefer the created folder that actually carries an advisor round; fall back to any created.
    slug = created.find((s) => roundCount(join(CONTENT, s)) > 0) ?? created[0] ?? null;
  }
  const rounds = slug ? roundCount(isFolderArg ? join(repoRoot, job.arg) : join(CONTENT, slug)) : 0;
  job.status = !failure && slug && rounds > beforeRounds ? "done" : "failed";
  if (job.status === "done") {
    job.slugs = [slug!];
    return;
  }
  job.error = failure ?? `the advisor ran but wrote no new round to develop/advice.json — check the view-log link${logTailSuffix(job.id)}`;
}

// A `--continue` job runs on an ALREADY-scaffolded folder, so drain()'s new-folder diff can never
// see it — before this branch existed, a perfectly clean continue run finished with a misleading
// "created no new content folder" error and no "→ review" link (hit by both the notes-pick flow
// and the Develop tab's Format for platforms). Verified instead by in-folder artifact: queue rows
// or the targeted derivatives dir grew.
async function runContinueJob(job: Job): Promise<void> {
  const parsed = parseContinueArg(job.arg);
  const folderAbs = parsed ? join(repoRoot, parsed.folder) : null;
  const before = folderAbs ? continueArtifactCounts(folderAbs, parsed?.lens) : null;
  const result = await runAtomizeJob(job);
  const failure = decodeSpawnFailure(result, job.id, {
    timeoutVerb: "atomize", timeoutLabel: `${ATOMIZE_TIMEOUT_MS / 60000} min`,
    exitVerb: "atomize", includeTailOnTimeout: true,
  });
  // An unparseable arg (not built by this module) degrades to exit-code-only verification rather
  // than failing a run we can't inspect.
  const progressed =
    !folderAbs || !before ? true : continueJobProgressed(before, continueArtifactCounts(folderAbs, parsed?.lens));
  job.status = !failure && progressed ? "done" : "failed";
  if (job.status === "done") {
    if (parsed) job.slugs = [basename(parsed.folder)]; // enables the jobs pill's "→ review" jump link
    return;
  }
  job.error =
    failure ??
    `formatting ran but added no new rows or derivatives in ${parsed?.folder ?? job.arg} — check the view-log link${logTailSuffix(job.id)}`;
}

// Process the queue one job at a time — every kind (atomize-family AND task jobs) shares this one
// `draining` mutex, so GUI-wide Claude concurrency is bounded no matter which button fired it.
async function drain(): Promise<void> {
  if (draining) return;
  const job = jobs.find((j) => j.status === "queued");
  if (!job) return;
  draining = true;
  job.status = "running";
  job.startedAt = Date.now();

  if (job.task) {
    // Generic task job (revise/brief-revise/insights/ask-insights/duplicate). The task itself
    // already resolved/rejected runQueued()'s caller-facing promise; this just finishes bookkeeping.
    try {
      await job.task(job);
      job.status = "done";
    } catch {
      job.status = "failed"; // job.error was already set inside runQueued()'s wrapper
    }
    job.finishedAt = Date.now();
    draining = false;
    void drain();
    return;
  }

  if (job.kind === "video") {
    await runVideoJob(job);
    job.finishedAt = Date.now();
    draining = false;
    void drain();
    return;
  }

  if (job.kind === "develop" || job.kind === "develop-reply") {
    await runDevelopJob(job);
    job.finishedAt = Date.now();
    draining = false;
    void drain();
    return;
  }

  if (job.kind === "continue") {
    await runContinueJob(job);
    job.finishedAt = Date.now();
    draining = false;
    void drain();
    return;
  }

  // Atomize-family (url/file/text/notes): diff the content folders before/after to link
  // the job to whatever it created (claude's stdout isn't reliable).
  const before = new Set(listSlugs());
  const result = await runAtomizeJob(job);
  job.slugs = listSlugs().filter((s) => !before.has(s)); // artifact check — real folders, not exit code
  const failure = decodeSpawnFailure(result, job.id, {
    timeoutVerb: "atomize", timeoutLabel: `${ATOMIZE_TIMEOUT_MS / 60000} min`,
    exitVerb: "atomize", includeTailOnTimeout: true,
  });
  const ran = !failure;
  job.status = ran ? "done" : "failed";
  if (ran && job.slugs.length) {
    // Belt-and-suspenders: force the origin tag on every row of every folder this job created,
    // rather than trusting the subprocess's own SKILL.md-driven bookkeeping to have landed it
    // (e.g. if `echo $ATOMIZE_ORIGIN` wasn't an allowlisted Bash command in that run).
    for (const slug of job.slugs) {
      try {
        stampOrigin(join(CONTENT, slug), "from GUI queue");
      } catch {
        // best-effort tagging only — never fail the job over it
      }
    }
  } else {
    job.error = failure ?? `atomize finished but created no new content folder — check the view-log link${logTailSuffix(job.id)}`;
  }
  job.finishedAt = Date.now();
  draining = false;
  void drain(); // next queued job
}

// ── Duplicate to platform ────────────────────────────────────────────────────────────────────
// The missing "create a post for another platform" affordance (card 9304e4a5: Muxin asked Ask
// Claude to turn a Bluesky post into an X post — out of Ask Claude's edit-in-place scope by
// design). This reuses the SAME spin config /atomize's own spin pass reads — resolveAngle() from
// src/atomize/spin.ts, the actual "spin path" — so the reframe follows the identical
// Muxin-approved per-platform angle rather than inventing a new one here. There's no separate
// callable "spin one derivative" function anywhere in the codebase (spin is Claude-driven, done
// inline during /atomize); this mirrors reviseDerivative's pattern (a scoped Claude subprocess)
// but WRITES A NEW FILE instead of editing one in place. Claude only ever touches that one new
// derivative file — the review-queue.md row is appended deterministically by this module
// afterward (queue.ts's appendRow), not trusted to the subprocess, the same "don't trust the
// subprocess's own bookkeeping" belt-and-suspenders pattern stampOrigin already uses above.
// Nothing here approves or schedules anything — the new row lands `pending`, gated by Muxin's
// review like every other row (CLAUDE.md rule 2).

// Next available `<platform>-N` id in folder's review-queue.md — mirrors how /atomize numbers
// derivative options (x-1, x-2, ...). Exported for a direct unit test.
export function nextDerivativeId(folder: string, platform: string): string {
  const { rows } = readQueue(folder);
  const re = new RegExp(`^${platform}-(\\d+)$`);
  const max = rows.reduce((m, r) => {
    const match = re.exec(r.id);
    return match ? Math.max(m, Number(match[1])) : m;
  }, 0);
  return `${platform}-${max + 1}`;
}

// Guards duplicateToPlatform's write: refuse instead of letting the claude subprocess silently
// clobber a stray file that happens to already occupy the freshly-computed target id.
export function assertNoExistingDerivative(targetPath: string, targetId: string): void {
  if (existsSync(targetPath)) {
    throw new Error(`refusing to overwrite existing derivative at ${targetId}.md`);
  }
}

// Build the instruction for a new, re-angled derivative. Exported so the prompt's guardrails
// (extraction-first, voice.yaml, the target platform's angle + max_chars) are unit-testable.
export function duplicatePrompt(
  slug: string,
  sourceId: string,
  sourcePlatform: string,
  targetPlatform: string,
  targetId: string,
  sourceBody: string,
  targetMaxChars?: number,
): string {
  const angle = resolveAngle(targetPlatform);
  return [
    `Create ONE new content derivative for Muxin Li's content pipeline: a ${targetPlatform} post`,
    `adapted from an existing ${sourcePlatform || "?"} post. Do not run shell commands; write the one new file, then stop.`,
    ``,
    `Source post (content/${slug}/derivatives/${sourceId}.md, platform: ${sourcePlatform || "?"}):`,
    `"""`,
    sourceBody,
    `"""`,
    ``,
    `New file to write: content/${slug}/derivatives/${targetId}.md`,
    ``,
    `Write this exact frontmatter block, then the new post body:`,
    `---`,
    `platform: ${targetPlatform}`,
    `spin: true`,
    `angle: ${targetPlatform}`,
    `---`,
    ``,
    `Rules:`,
    `- Write ONLY that one new file. Touch nothing else — no other derivative, no review-queue.md.`,
    `- Extraction-first: the body must stay traceable to Muxin's source at content/${slug}/source.md —`,
    `  reframe and re-hook for ${targetPlatform}'s audience, but NEVER invent a claim, statistic,`,
    `  metaphor, or worldview Muxin did not express in the source post above.`,
    angle ? `- ${targetPlatform}'s approved angle (audience: ${angle.audience}): ${angle.angle}` : ``,
    `- Follow config/voice.yaml: no em dashes, no AI tells, Muxin's plain PM voice.`,
    targetMaxChars ? `- Stay within ${targetPlatform}'s ${targetMaxChars}-character limit.` : ``,
    `- Be surgical: this is a re-angling of the source post for a new audience, not a new essay.`,
  ]
    .filter(Boolean)
    .join("\n");
}

// Duplicate one existing text derivative into a NEW derivative for `targetPlatform`, respun via
// the existing spin angle, and append its review-queue.md row (status `pending`) so it lands back
// in the Review tab. Routed through runQueued like every other Claude spawn in this GUI.
export async function duplicateToPlatform(
  slug: string,
  id: string,
  targetPlatform: string
): Promise<{ id: string; platform: string; body: string }> {
  const folder = safeFolder(slug);
  if (!/^[\w.-]+$/.test(id)) throw new Error("bad id");
  if (!TEXT_PLATFORMS.has(targetPlatform)) {
    throw new Error(`"${targetPlatform}" isn't a platform this can duplicate to`);
  }
  const p = join(folder, "derivatives", `${id}.md`);
  if (!existsSync(p)) throw new Error("no such derivative to duplicate");
  const { fm, body } = splitFrontmatter(readFileSync(p, "utf8"));
  const sourcePlatform = typeof fm.platform === "string" ? fm.platform : "";
  const maxChars = loadPlatforms().platforms[targetPlatform]?.max_chars;

  return runQueued("duplicate", `Duplicate ${slug}/${id} → ${targetPlatform}`, async (job) => {
    // Computed at RUN time, not enqueue time: the queue serializes one job at a time, so reading
    // review-queue.md for the next free id HERE (not before the job was even queued) can't race
    // with another duplicate/atomize job that lands in between and claims the same id.
    const targetId = nextDerivativeId(folder, targetPlatform);
    const targetPath = join(folder, "derivatives", `${targetId}.md`);
    assertNoExistingDerivative(targetPath, targetId);
    const prompt = duplicatePrompt(slug, id, sourcePlatform, targetPlatform, targetId, body, maxChars);

    const result = await runClaudeSpawn(job, prompt, { timeoutMs: REVISE_TIMEOUT_MS });
    const failure = decodeSpawnFailure(result, job.id, {
      timeoutVerb: "Claude", timeoutLabel: `${REVISE_TIMEOUT_MS / 1000}s`, exitVerb: "Claude",
    });
    if (failure) throw new Error(failure);
    if (!existsSync(targetPath)) {
      throw new Error(`Claude ran but didn't write ${targetId}.md — check the view-log link${logTailSuffix(job.id)}`);
    }

    const newBody = splitFrontmatter(readFileSync(targetPath, "utf8")).body;
    appendRow(folder, {
      id: targetId,
      platform: targetPlatform,
      format: "text",
      asset: `derivatives/${targetId}.md`,
      status: "pending",
      notes: `duplicated from ${id} for ${targetPlatform}`,
      origin: "from GUI queue",
    });
    return { id: targetId, platform: targetPlatform, body: newBody };
  });
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
const DRAFT_TIMEOUT_MS = 120_000; // mirrors outreach/draft.ts's own (private) DRAFT_TIMEOUT_MS
export async function enqueueFollowUpDraft(dir: string, channel?: string, recipient?: string): Promise<DraftResult> {
  return runQueued("draft-follow-up", `Draft follow-up: ${dir}`, (job) =>
    runDraft(dir, {
      channel,
      recipient,
      callClaude: async (prompt) => {
        const result = await runClaudeSpawn(job, prompt, {
          timeoutMs: DRAFT_TIMEOUT_MS,
          model: draftModel(),
          tools: "",
          permissionMode: null,
        });
        const failure = decodeSpawnFailure(result, job.id, {
          timeoutVerb: "claude -p",
          timeoutLabel: "120s",
          exitVerb: "claude -p",
          includeTailOnTimeout: true,
        });
        if (failure) throw new Error(failure);
        const text = result.stdout.trim();
        if (!text) throw new Error("claude -p returned no text during draft");
        return text;
      },
    }),
  );
}
