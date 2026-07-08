// Job queue + Claude subprocess runner for the review GUI (serve.ts). Two related things live
// here: the "Add / Queue" job queue that shells out to headless `claude -p /atomize ...` one job
// at a time, and the "Revise with Claude" single-file edits (reviseDerivative/reviseBrief) — both
// spawn a `claude -p` subprocess on Muxin's subscription ($0 marginal), which is this module's
// defining behavior. Split out of serve.ts (Codebase review Phase 5c).

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, createWriteStream } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { repoRoot } from "../db/db.js";
import { stampOrigin } from "../publish/queue.js";
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

// "Revise with Claude": shell out to headless Claude Code (`claude -p`), which uses Muxin's
// subscription ($0 marginal), to edit ONE derivative in place per a natural-language instruction.
const execFileP = promisify(execFile);
const REVISE_TIMEOUT_MS = 180_000;

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
    `Rules:`,
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

// Run the revision through headless Claude Code (subscription, no per-token API cost), then return
// the edited body. Failures (missing CLI, timeout, non-zero exit, no-op) surface as thrown messages
// the GUI shows instead of crashing.
export async function reviseDerivative(slug: string, id: string, instruction: string): Promise<string> {
  const folder = safeFolder(slug);
  if (!/^[\w.-]+$/.test(id)) throw new Error("bad id");
  if (!instruction.trim()) throw new Error("tell Claude what to change first");
  const p = join(folder, "derivatives", `${id}.md`);
  if (!existsSync(p)) throw new Error("no such derivative to revise");

  const original = splitFrontmatter(readFileSync(p, "utf8"));
  const platform = typeof original.fm.platform === "string" ? original.fm.platform : "";
  const prompt = revisePrompt(slug, id, platform, instruction.trim());

  try {
    await execFileP("claude", ["-p", prompt, "--permission-mode", "acceptEdits"], {
      cwd: repoRoot,
      timeout: REVISE_TIMEOUT_MS,
      maxBuffer: 20_000_000,
    });
  } catch (e) {
    const err = e as { code?: string; killed?: boolean; stderr?: string; message?: string };
    if (err.code === "ENOENT") {
      throw new Error("the `claude` CLI isn't on this server's PATH — start the GUI from a terminal where `claude` runs");
    }
    if (err.killed) throw new Error(`Claude timed out after ${REVISE_TIMEOUT_MS / 1000}s`);
    throw new Error(`Claude revise failed: ${(err.stderr || err.message || "unknown").slice(0, 300)}`);
  }

  const after = splitFrontmatter(readFileSync(p, "utf8")).body;
  if (after === original.body) {
    throw new Error("Claude ran but didn't change anything — try a more specific instruction");
  }
  return after;
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
  try {
    await execFileP("claude", ["-p", prompt, "--permission-mode", "acceptEdits"], {
      cwd: repoRoot,
      timeout: REVISE_TIMEOUT_MS,
      maxBuffer: 20_000_000,
    });
  } catch (e) {
    const err = e as { code?: string; killed?: boolean; stderr?: string; message?: string };
    if (err.code === "ENOENT") {
      throw new Error("the `claude` CLI isn't on this server's PATH — start the GUI from a terminal where `claude` runs");
    }
    if (err.killed) throw new Error(`Claude timed out after ${REVISE_TIMEOUT_MS / 1000}s`);
    throw new Error(`Claude revise failed: ${(err.stderr || err.message || "unknown").slice(0, 300)}`);
  }
  const after = readFileSync(abs, "utf8");
  if (after === before) throw new Error("Claude ran but didn't change anything — try a more specific instruction");
  return { path: relPath, content: after };
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
interface Job {
  id: string;
  kind: "url" | "file" | "text" | "notes" | "continue";
  label: string;
  arg: string; // what /atomize receives: a url, a space-free .inbox path, or "notes"
  status: JobStatus;
  slugs: string[]; // content folders atomize created — linked back so the Review tab can jump to them
  error: string | null;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  lastStdoutLine: string | null; // heartbeat — last non-empty line seen so far, updated as output streams in
}
export const jobs: Job[] = [];
let jobSeq = 0;
let draining = false;

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

// Materialize a source into a stable, space-free arg for /atomize, then queue it. Pasted text and
// file sources are copied into .inbox (space-free names) so the skill's `npm run new-content -- <arg>`
// never trips over spaces in an Obsidian path; urls and "notes" pass straight through.
export function addJob(kind: Job["kind"], rawArg: string, label: string, rawText?: string): Job {
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

interface AtomizeRunResult {
  code: number | null;
  timedOut: boolean;
  enoent: boolean;
}

// Spawn the real /atomize headlessly, streaming stdout+stderr straight to the job's log file
// (persist + stream, not execFile's 40MB in-memory buffer) while updating job.lastStdoutLine as a
// live heartbeat. Resolves once the process closes; never rejects — outcome is read off the
// returned result plus the persisted log file.
function runAtomizeJob(job: Job): Promise<AtomizeRunResult> {
  mkdirSync(JOB_LOG_DIR, { recursive: true });
  const log = createWriteStream(jobLogPath(job.id), { flags: "a" });
  let tailBuf = "";
  const onChunk = (chunk: Buffer) => {
    const text = chunk.toString("utf8");
    log.write(chunk);
    tailBuf = (tailBuf + text).slice(-4000); // bounded tail buffer — heartbeat only needs the last line
    const line = lastNonEmptyLine(tailBuf);
    if (line) job.lastStdoutLine = line;
  };
  return new Promise((resolve) => {
    // ATOMIZE_ORIGIN=gui-queue tells the /atomize skill's step 8 to tag every row it appends
    // "from GUI queue" instead of the default "from /cycle" — the origin source-tag the review
    // GUI renders per row (src/publish/queue.ts QUEUE_ORIGINS).
    const child = spawn("claude", ["-p", `/atomize ${job.arg}`, "--permission-mode", ATOMIZE_PERMISSION_MODE], {
      cwd: repoRoot,
      timeout: ATOMIZE_TIMEOUT_MS,
      killSignal: "SIGTERM",
      env: { ...process.env, ATOMIZE_ORIGIN: "gui-queue" },
    });
    let enoent = false;
    child.on("error", (e) => {
      enoent = (e as { code?: string }).code === "ENOENT";
    });
    child.stdout?.on("data", onChunk);
    child.stderr?.on("data", onChunk);
    child.on("close", (code, signal) => {
      // Wait for the write stream to actually flush before resolving — drain() reads the log
      // file back synchronously right after this promise settles (for the failure tail), and
      // log.end() alone doesn't guarantee the last chunk has hit disk yet.
      log.end(() => {
        // Node's own `timeout` option kills with `killSignal` once ATOMIZE_TIMEOUT_MS elapses —
        // that's the one signal we ever send, so seeing it back means we timed out, not a crash.
        resolve({ code, timedOut: signal === "SIGTERM", enoent });
      });
    });
  });
}

// Process the queue one job at a time. Each job shells the real /atomize; we diff the content
// folders before/after to link the job to whatever it created (claude's stdout isn't reliable).
async function drain(): Promise<void> {
  if (draining) return;
  const job = jobs.find((j) => j.status === "queued");
  if (!job) return;
  draining = true;
  job.status = "running";
  job.startedAt = Date.now();
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
    const tail = (() => {
      try {
        return tailLines(readFileSync(jobLogPath(job.id), "utf8"), 30);
      } catch {
        return "";
      }
    })();
    if (result.enoent) {
      job.error = "the `claude` CLI isn't on this server's PATH — start the GUI from a terminal where `claude` runs";
    } else if (result.timedOut) {
      job.error = `atomize timed out after ${ATOMIZE_TIMEOUT_MS / 60000} min` + (tail ? `\n---\n${tail}` : "");
    } else if (result.code !== 0) {
      job.error = `atomize failed (exit ${result.code})` + (tail ? `\n---\n${tail}` : "");
    } else if (!job.slugs.length) {
      job.error = "atomize finished but created no new content folder — check the view-log link" + (tail ? `\n---\n${tail}` : "");
    }
  }
  job.finishedAt = Date.now();
  draining = false;
  void drain(); // next queued job
}
