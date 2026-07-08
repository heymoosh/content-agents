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
import { CONTENT, safeFolder } from "./rows.js";
import { briefRevisePrompt, latestBriefPath } from "./serve.js";

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
    if (result.enoent) {
      throw new Error("the `claude` CLI isn't on this server's PATH — start the GUI from a terminal where `claude` runs");
    }
    if (result.timedOut) throw new Error(`Claude timed out after ${REVISE_TIMEOUT_MS / 1000}s`);
    if (result.code !== 0) throw new Error(`Claude revise failed (exit ${result.code})${logTailSuffix(job.id)}`);

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
    if (result.enoent) {
      throw new Error("the `claude` CLI isn't on this server's PATH — start the GUI from a terminal where `claude` runs");
    }
    if (result.timedOut) throw new Error(`Claude timed out after ${REVISE_TIMEOUT_MS / 1000}s`);
    if (result.code !== 0) throw new Error(`Claude revise failed (exit ${result.code})${logTailSuffix(job.id)}`);
    const after = readFileSync(abs, "utf8");
    if (after === before) throw new Error("Claude ran but didn't change anything — try a more specific instruction");
    return { path: relPath, content: after };
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
// "revise" | "brief-revise" | "insights" | "ask-insights" | "duplicate" are generic task jobs (run
// an arbitrary async task via runQueued) — the four call sites complaint 2 flagged as spawning
// unbounded, plus "Duplicate to platform". Both families share the same queue/mutex/log/heartbeat.
export type JobKind =
  | "url" | "file" | "text" | "notes" | "continue" | "video"
  | "revise" | "brief-revise" | "insights" | "ask-insights" | "duplicate";
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

// Enqueue an arbitrary async task through the SAME queue/mutex atomize jobs use, so it's bounded
// by the one `draining` gate and shows up in the jobs pill with a real log + heartbeat (via
// runClaudeSpawn inside the task). The caller's promise resolves/rejects with whatever `task`
// returns/throws — the job bookkeeping (status/error/finishedAt) is separate, driven by drain().
export function runQueued<T>(kind: JobKind, label: string, task: (job: Job) => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = `job-${++jobSeq}`;
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

// Generic spawn: `claude -p "<prompt>"`, streamed to the job's persisted log + heartbeat exactly
// like the atomize path (persist + stream, not execFile's 40MB in-memory buffer). Shared by every
// Claude-spawning call site in the GUI — atomize-family jobs AND task jobs (revise/brief-revise/
// insights/ask-insights/duplicate) — so they all get the same log file + heartbeat UX. `stdout` is
// captured separately (not just written to the log) for callers that need Claude's actual answer
// text (insights/ask) or a refusal marker (revise), since the log interleaves stdout+stderr.
interface ClaudeSpawnResult {
  code: number | null;
  timedOut: boolean;
  enoent: boolean;
  stdout: string;
}
export function runClaudeSpawn(
  job: Job,
  prompt: string,
  opts: { timeoutMs: number; permissionMode?: string; env?: NodeJS.ProcessEnv }
): Promise<ClaudeSpawnResult> {
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
    const child = spawn("claude", ["-p", prompt, "--permission-mode", opts.permissionMode ?? "acceptEdits"], {
      cwd: repoRoot,
      timeout: opts.timeoutMs,
      killSignal: "SIGTERM",
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
        // Node's own `timeout` option kills with `killSignal` once timeoutMs elapses — that's the
        // one signal we ever send, so seeing it back means we timed out, not a crash.
        resolve({ code, timedOut: signal === "SIGTERM", enoent, stdout: stdoutBuf });
      });
    });
  });
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

// How a raw source string should reach /atomize. Exported + `exists` injected so it's unit-testable
// without touching the filesystem.
export function classifySource(
  raw: string,
  exists: (p: string) => boolean = existsSync,
): { kind: "url" | "file" | "text"; arg: string; label: string } {
  const s = raw.trim();
  if (/^https?:\/\//i.test(s)) return { kind: "url", arg: s, label: s };
  const asPath = s.startsWith("~/") ? join(homedir(), s.slice(2)) : s;
  // A short single-line string that resolves to a real file is a path (e.g. an Obsidian note).
  if (s && !s.includes("\n") && s.length < 400 && exists(asPath)) {
    return { kind: "file", arg: asPath, label: basename(asPath) };
  }
  const firstLine = s.split("\n").map((l) => l.trim()).find(Boolean) ?? "pasted text";
  return { kind: "text", arg: "", label: firstLine.replace(/^#\s*/, "").slice(0, 80) };
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

// Materialize a source into a stable, space-free arg for /atomize, then queue it. Pasted text and
// file sources are copied into .inbox (space-free names) so the skill's `npm run new-content -- <arg>`
// never trips over spaces in an Obsidian path; urls and "notes" pass straight through. "video" jobs
// pass their content-folder path straight through too (see addVideoJob) — no materialization needed.
export function addJob(kind: AtomizeFamilyKind, rawArg: string, label: string, rawText?: string): Job {
  const id = `job-${++jobSeq}`;
  let arg = rawArg;
  if (kind === "text" || kind === "file") {
    mkdirSync(INBOX, { recursive: true });
    if (kind === "text") {
      arg = join(INBOX, `${id}.md`);
      writeFileSync(arg, (rawText ?? "").trim() + "\n");
    } else {
      const content = readFileSync(rawArg, "utf8");
      const stem = basename(rawArg).replace(/\.[^.]+$/, "");
      const safe = stem.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "note";
      arg = join(INBOX, `${safe}-${id}.md`);
      // Keep the note's title: if it has no heading, seed one from the filename so /atomize doesn't
      // fall back to the safe filename.
      writeFileSync(arg, (/^#\s+/m.test(content) ? "" : `# ${stem}\n\n`) + content);
    }
  }
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
  const ran = result.code === 0 && !result.timedOut && !result.enoent;
  const storyboardReady = existsSync(join(folderAbs, "video", "storyboard.md"));
  job.status = ran && storyboardReady ? "done" : "failed";
  if (job.status === "done") {
    job.slugs = [basename(job.arg)]; // enables the jobs pill's "→ review" jump link
    return;
  }
  const tail = logTailSuffix(job.id);
  if (result.enoent) {
    job.error = "the `claude` CLI isn't on this server's PATH — start the GUI from a terminal where `claude` runs";
  } else if (result.timedOut) {
    job.error = `video generation timed out after ${ATOMIZE_TIMEOUT_MS / 60000} min${tail}`;
  } else if (result.code !== 0) {
    job.error = `video generation failed (exit ${result.code})${tail}`;
  } else {
    job.error = `/video ran but produced no video/storyboard.md — check the view-log link${tail}`;
  }
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

  // Atomize-family (url/file/text/notes/continue): diff the content folders before/after to link
  // the job to whatever it created (claude's stdout isn't reliable).
  const before = new Set(listSlugs());
  const result = await runAtomizeJob(job);
  job.slugs = listSlugs().filter((s) => !before.has(s)); // artifact check — real folders, not exit code
  const ran = result.code === 0 && !result.timedOut && !result.enoent;
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
    const tail = logTailSuffix(job.id);
    if (result.enoent) {
      job.error = "the `claude` CLI isn't on this server's PATH — start the GUI from a terminal where `claude` runs";
    } else if (result.timedOut) {
      job.error = `atomize timed out after ${ATOMIZE_TIMEOUT_MS / 60000} min${tail}`;
    } else if (result.code !== 0) {
      job.error = `atomize failed (exit ${result.code})${tail}`;
    } else if (!job.slugs.length) {
      job.error = `atomize finished but created no new content folder — check the view-log link${tail}`;
    }
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
    const prompt = duplicatePrompt(slug, id, sourcePlatform, targetPlatform, targetId, body, maxChars);

    const result = await runClaudeSpawn(job, prompt, { timeoutMs: REVISE_TIMEOUT_MS });
    if (result.enoent) {
      throw new Error("the `claude` CLI isn't on this server's PATH — start the GUI from a terminal where `claude` runs");
    }
    if (result.timedOut) throw new Error(`Claude timed out after ${REVISE_TIMEOUT_MS / 1000}s`);
    if (result.code !== 0) throw new Error(`Claude failed (exit ${result.code})${logTailSuffix(job.id)}`);
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
