// Unified review + approval GUI.
//
// One local page that aggregates every content/<slug>/review-queue.md, previews the actual
// derivative inline (post text, quote-card image, video storyboard), and lets Muxin
// approve / revise / discard / edit in place — instead of hand-editing 20+ markdown tables.
//
// It READS through the same readQueue() the publish step uses and WRITES status back through the
// same writeCell() setStatus() also targets, so an "approve" here starts from the same place an
// "approve" typed by hand would. For rows a scheduler owns (text/card/tiktok/video — see
// scheduleApproved below), approving here ALSO immediately fires the real publish call — the same
// thing a manual `/publish` run would do, just triggered by the approve click instead of a
// separate step. Rows no scheduler owns just get the plain approve status, still gated by
// CLAUDE.md rule 2 (Muxin approved it; nothing publishes without that).
//
//   npm run review            # http://localhost:4600
//   REVIEW_PORT=5000 npm run review
//
// Zero new deps: Node's built-in http + the existing queue parser.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { repoRoot, openDb } from "../db/db.js";
import { readQueue, type QueueRow } from "../publish/queue.js";
import { TEXT_PLATFORMS } from "../publish/typefully.js";
import { fetchNotesList, scaffoldPicked } from "../atomize/new-notes.js";
import { listLeadDetails } from "../outreach/status.js";
import { setFrontmatterField } from "../outreach/qualify.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { handleVentureRead } from "./venture-reads.js";
import { handleVentureWrite } from "./venture-writes.js";
import { buildFollowups, markResponded, markContacted, moveOn, markSent, latestLockedMessage, isBucket } from "../outreach/tracker.js";
import { CHANNELS } from "../outreach/draft.js";
import {
  enrich,
  listPieces,
  updateRow,
  saveDerivative,
  approveBlockReason,
  replyToMentionBlockReason,
  safeFolder,
  IMAGE_EXT,
  VIDEO_EXT,
  getLiveStateAsOf,
  cancelScheduled,
  saveCutBody,
} from "./rows.js";
import {
  classifySource,
  sourceDispatch,
  addJob,
  addVideoJob,
  publicJob,
  jobs,
  clearFinishedJobs,
  answerJob,
  retryJob,
  stopJob,
  jobLogPath,
  lastNonEmptyLine,
  tailLines,
  jobElapsedMs,
  revisePrompt,
  reviseDerivative,
  reviseBrief,
  reviseOutreachMessage,
  duplicateToPlatform,
  runQueued,
  runAgentSpawn,
  runClaudeSpawn,
  runCommandSpawn,
  decodeSpawnFailure,
  enqueueFollowUpDraft,
  enqueueDirectedDraft,
  addDevelopJob,
  addDevelopFolderJob,
  developJobInFlight,
  buildFormatArg,
} from "./jobs.js";
import { listContentSessions, acceptAngleBySlug, dismissCardBySlug, appendReplyBySlug } from "./develop.js";
import { listCuts } from "../atomize/cuts.js";
import { renderPage } from "./page.js";
import { fixturesEnabled, FIXTURE_ENV_VAR, FIXTURE_WRITE_REFUSAL } from "./fixtures.js";
import { buildStudioHome } from "./studio.js";
import { ENGINES, ENGINE_COMMANDS, ENGINE_LABELS, ENGINE_METADATA, isEngine, enginePrompt, type Engine } from "./engines.js";
import { readTreatment } from "./treatment.js";
import { saveIntakeDraft, readIntakeDraft, readIntakeDrafts, saveIntakeSectionDraft, readIntakeSections, clearIntakeDrafts } from "./intake-draft.js";
import { enqueueVentureStep } from "./venture-runner.js";
import { scheduleApproved, scheduleKind } from "./studio-scheduling.js";
import { handleFictionRoute } from "./serve-fiction.js";
import { handleCharlesRoute } from "./serve-charles.js";
import { handleSignalsRoute } from "./serve-signals.js";
import { blockedRecommendationRead } from "./recommendations.js";

// Re-exported so serve.test.ts's existing imports keep working UNCHANGED after this split — the
// implementations now live in rows.ts (approveBlockReason, enrich), jobs.ts (classifySource,
// revisePrompt, jobLogPath, lastNonEmptyLine, tailLines, jobElapsedMs), or studio-scheduling.ts
// (scheduleKind, scheduleApproved, SchedulerDeps). Keep the existing serve.ts exports intact for
// callers and tests while the implementations move to their cohesive modules.
export { approveBlockReason, replyToMentionBlockReason, enrich, classifySource, sourceDispatch, revisePrompt, jobLogPath, lastNonEmptyLine, tailLines, jobElapsedMs, scheduleKind, scheduleApproved };
export type { ScheduleKind, SchedulerDeps } from "./studio-scheduling.js";

const PORT = Number(process.env.REVIEW_PORT ?? 4600);

function requestEngine(value: unknown): Engine {
  return isEngine(value) ? value : "claude";
}

function availableEngines() {
  return ENGINES.map((engine) => {
    let installed = false;
    try {
      execFileSync("which", [ENGINE_COMMANDS[engine]], { stdio: "ignore", timeout: 2_000 });
      installed = true;
    } catch {
      installed = false;
    }
    return {
      id: engine,
      label: ENGINE_LABELS[engine],
      description: ENGINE_METADATA[engine].description,
      roleHint: ENGINE_METADATA[engine].roleHint,
      installed,
      note: installed ? "Sign-in is checked when the run starts." : `${ENGINE_COMMANDS[engine]} is not on this server's PATH`,
    };
  });
}

// Claude Code creates ephemeral dev worktrees under .claude/worktrees/<name> — each one has its
// OWN gitignored data/ and content/, isolated from the real checkout, so a report run here can
// come back looking empty even though nothing is actually broken. Surfaced as a banner (see PAGE)
// so this is never silently confusing again (Muxin, 2026-07-04).
const IS_DEV_WORKTREE = repoRoot.includes("/.claude/worktrees/");

// Dev fixture mode (src/review/fixtures.ts). Read ONCE, here, from the environment the process was
// started with — an env var and not a query param precisely because nothing in the browser can set
// one, so a normal `npm run review` cannot be talked into serving fixture data. While it is on the
// server is READ-ONLY: the guard at the top of the request handler refuses every non-GET before any
// route matches, which is what makes "a fixture session writes nothing" a property of the process
// rather than a promise about the client.
const FIXTURES_ON = fixturesEnabled();

// Rows (keyed `${slug}/${id}`) currently mid-schedule — see the in-flight guard in the /api/status
// handler below, which prevents a double-click/retry from firing a duplicate real provider call.
const schedulingInFlight = new Set<string>();

// A separate execFileP instance from jobs.ts's own (that one backs reviseDerivative/reviseBrief) —
// this one just backs the read-only report/insights calls below. Stateless (promisify(execFile) is
// pure), so two independent instances are fine; nothing here needs to be a shared singleton.
const execFileP = promisify(execFile);

// ── Analytics & Strategy tab ─────────────────────────────────────────────────────────────────
// Read-only reports + the latest strategy brief, surfaced so Muxin can see "what's working"
// without dropping to a terminal. The brief is the one file this tab can edit (same headless-
// Claude "Ask Claude" pattern as a derivative) — /atomize already reads the latest brief every
// run (SKILL.md step 2) and routing already reads config/routing.yaml, so an edit here feeds
// forward into atomize/routing with no new wiring needed.
const BRIEFS_DIR = join(repoRoot, "briefs");
// 180s (not the original 90s): the insights prompt inlines every report's full output plus the
// entire latest brief, and a real run was observed timing out at 90s with zero output produced —
// see the matching bump to isSpawnTimeout's exit-143 handling in jobs.ts.
const STRATEGY_TIMEOUT_MS = 180_000;
const INSIGHTS_ASK_TIMEOUT_MS = 180_000; // a deep-dive answer may itself run 1-2 of the reports below
// A FULL /strategy run (grade bets → reports → Claude-written brief → new bets) — minutes, not
// seconds. Same order of magnitude as an atomize job, doubled: /strategy runs ~8 report scripts
// plus a long synthesis pass.
const STRATEGY_RUN_TIMEOUT_MS = 30 * 60_000;
// `npm run scout` runs up to 3 bounded `claude -p` web-search calls (one per kind) — see
// src/discovery/discover.ts. Its own per-call timeout governs each; this bounds the whole run.
const SCOUT_TIMEOUT_MS = 30 * 60_000;
const PULL_TIMEOUT_MS = 15 * 60_000; // real Chrome + saved sessions across 3 platforms — slow on purpose

// Allowlisted, read-only, no-arg report commands only — used server-side to build the insights
// synthesis, never exposed directly by cmd string from the client (no argv injection surface).
const REPORTS: Record<string, string[]> = {
  snapshot: ["run", "snapshot"],
  resonance: ["run", "resonance"],
  audience: ["run", "audience"],
  "origin-compare": ["run", "origin-compare"],
};

// Exported (along with briefRevisePrompt below): jobs.ts's reviseBrief is the one place that
// actually spawns the `claude -p` subprocess to revise the brief, and it needs both of these — but
// they stay defined here since they're part of the cohesive Strategy/Analytics tab (scope decision,
// see the top-of-file re-export comment).
export function latestBriefPath(): string | null {
  if (!existsSync(BRIEFS_DIR)) return null;
  const files = readdirSync(BRIEFS_DIR).filter((f) => /^\d{4}-\d{2}-\d{2}-strategy-brief\.md$/.test(f)).sort();
  return files.length ? join(BRIEFS_DIR, files[files.length - 1]) : null;
}

async function runReport(cmd: string): Promise<string> {
  const args = REPORTS[cmd];
  if (!args) throw new Error(`unknown report "${cmd}"`);
  try {
    const { stdout } = await execFileP("npm", args, {
      cwd: repoRoot,
      timeout: STRATEGY_TIMEOUT_MS,
      maxBuffer: 20_000_000,
    });
    return stdout;
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    throw new Error((err.stderr || err.message || "report failed").slice(0, 3000));
  }
}

function postCount(): number {
  const db = openDb();
  try {
    return (db.prepare("SELECT COUNT(*) AS n FROM posts").get() as { n: number }).n;
  } finally {
    db.close();
  }
}

function untaggedCount(): number {
  const db = openDb();
  try {
    return (db.prepare("SELECT COUNT(*) AS n FROM posts WHERE pillar IS NULL").get() as { n: number }).n;
  } finally {
    db.close();
  }
}

// ── Freshness + brief-reference helpers (Muxin, 2026-07-16) ────────────────────────────────────
// generateInsights already ran the 4 reports live off data/analytics.db — the numbers were never
// stale. What was misleading is that it ALSO inlined the entire latest brief with no age signal,
// so a 3-week-old brief read as co-equal to this second's DB query. These give the GUI a real
// "as of" stamp instead, and let the brief be linked (dated) rather than dumped whole.

export type Freshness = { date: string; ageDays: number };

// Pure: calendar-day difference between an ISO date (yyyy-mm-dd, or any ISO string — only the date
// part matters) and `nowMs`. `now` is normalized down to its own UTC midnight first, so any time
// later the same calendar day still reads as "0 days ago" rather than rounding up to 1. Injected
// `nowMs` keeps this testable without mocking the clock.
export function daysAgo(dateStr: string, nowMs: number): number {
  const then = new Date(dateStr.slice(0, 10) + "T00:00:00Z").getTime();
  const now = new Date(nowMs);
  const nowMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((nowMidnight - then) / 86_400_000));
}

// Pure: picks the most recent of a set of possibly-null ISO date strings (e.g. MAX(captured_at),
// MAX(imported_at)) and turns it into a Freshness stamp. Returns null when there's no data at all.
export function computeFreshness(dates: (string | null | undefined)[], nowMs: number): Freshness | null {
  const valid = dates.filter((d): d is string => !!d).sort();
  if (!valid.length) return null;
  const date = valid[valid.length - 1].slice(0, 10);
  return { date, ageDays: daysAgo(date, nowMs) };
}

// Pure: brief filenames are `YYYY-MM-DD-strategy-brief.md` (same pattern latestBriefPath filters
// on) — extract just the date.
export function parseBriefDate(filename: string): string | null {
  const m = filename.match(/^(\d{4}-\d{2}-\d{2})-strategy-brief\.md$/);
  return m ? m[1] : null;
}

// Pure: pulls one `## <header>` section (through the next `## ` heading, or EOF) out of a brief's
// markdown — used to hand Claude the brief's directives/scorecard without inlining the whole ~10KB
// file. Returns null if the section isn't present (older briefs, or a hand-edited one).
export function extractSection(md: string, header: string): string | null {
  const lines = md.split("\n");
  const headerRe = new RegExp(`^##\\s+${header.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
  const start = lines.findIndex((l) => headerRe.test(l.trim()));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      end = i;
      break;
    }
  }
  const section = lines.slice(start, end).join("\n").trim();
  return section || null;
}

type BriefReference = {
  path: string;
  date: string | null;
  ageDays: number | null;
  directives: string | null;
  scorecard: string | null;
};

function briefReference(nowMs: number = Date.now()): BriefReference | null {
  const abs = latestBriefPath();
  if (!abs) return null;
  const filename = basename(abs);
  const date = parseBriefDate(filename);
  const text = readFileSync(abs, "utf8");
  return {
    path: abs.slice(repoRoot.length + 1),
    date,
    ageDays: date ? daysAgo(date, nowMs) : null,
    directives: extractSection(text, "Directives for atomization"),
    scorecard: extractSection(text, "Last cycle scorecard"),
  };
}

function dataFreshness(nowMs: number = Date.now()): Freshness | null {
  const db = openDb();
  try {
    const metricsRow = db.prepare("SELECT MAX(captured_at) AS d FROM metrics").get() as { d: string | null };
    const importsRow = db.prepare("SELECT MAX(imported_at) AS d FROM imports").get() as { d: string | null };
    return computeFreshness([metricsRow.d, importsRow.d], nowMs);
  } finally {
    db.close();
  }
}

export type InsightsResult = {
  summary: string;
  engine?: string; // which analyst engine answered ("gpt-codex" | "claude-cli")
  fallbackReason?: string; // set when GPT was unavailable and Claude answered — says why
  freshness: Freshness | null;
  brief: { path: string; date: string | null; ageDays: number | null } | null;
  untagged: number;
};

// "Generate insights": run the read-only reports ourselves (deterministic, no LLM variance on the
// numbers), then hand the raw output + a TRIMMED, dated brief excerpt to Claude and ask for a short
// synthesis — not another raw dump. Freshness/brief/untagged are computed here (deterministic, not
// LLM-dependent) so the GUI can show an "as of" stamp and a dated link instead of trusting the
// summary text to mention how current anything is. This is otherwise a pure text answer (nothing
// written to disk), shown straight in the GUI.
async function generateInsights(engine: Engine = "claude"): Promise<InsightsResult> {
  // Fail loud and fast, before spending a Claude call: an empty posts table almost always means
  // this checkout's data/analytics.db is a stale/isolated copy (gitignored, never synced between
  // checkouts — see IS_DEV_WORKTREE), not that there's genuinely no data.
  if (postCount() === 0) {
    const summary =
      `**No analytics data in this checkout (0 posts in data/analytics.db).**\n\n` +
      (IS_DEV_WORKTREE
        ? `This GUI is running from a Claude Code dev worktree, which has its own empty, gitignored ` +
          `data/analytics.db. It's never synced with your real checkout. Run \`npm run review\` from ` +
          `your main repo checkout instead to see live numbers.\n`
        : `\`data/analytics.db\` is gitignored (per-checkout, never synced by git). Either this checkout ` +
          `has never been ingested, or something pulled into a different copy. Run \`npm run ingest\` / ` +
          `\`npm run pull\` here, or check you're in the checkout you expect.\n`);
    return { summary, engine, freshness: null, brief: null, untagged: 0 };
  }
  const sections: string[] = [];
  for (const key of Object.keys(REPORTS)) {
    try {
      sections.push(`### ${key}\n${await runReport(key)}`);
    } catch (e) {
      sections.push(`### ${key}\n(failed: ${e instanceof Error ? e.message : String(e)})`);
    }
  }
  const freshness = dataFreshness();
  const brief = briefReference();
  const untagged = untaggedCount();
  const briefLabel = brief ? `${brief.date ?? "undated"}${brief.ageDays != null ? `, ${brief.ageDays}d old` : ""}` : null;
  const briefExcerpt = brief
    ? [brief.scorecard, brief.directives].filter(Boolean).join("\n\n") || "(no directives/scorecard section found)"
    : null;
  const prompt = [
    `Muxin Li wants a quick read on his content pipeline's analytics. Below is LIVE raw output from`,
    `the pipeline's own report scripts (run just now, against the current database) — this is the`,
    `primary source. Below that is a short excerpt from his prior-cycle strategy brief`,
    `(${briefLabel ?? "none exists yet"}) for context only: it may be stale, so prefer the live`,
    `numbers and call out anywhere the brief's claims no longer hold. Do not run any commands or`,
    `read any other files — just read what's given below and respond.`,
    ``,
    `Write a SHORT, high-level synthesis: what's working, what's not, 3-5 concrete numbers that`,
    `actually matter, and one or two things worth doing next. Also flag concrete DATA-HYGIENE next`,
    `steps you see in the reports below (e.g. an untagged-post count, an origin-compare cell marked`,
    `INSUFFICIENT, a channel below the 4-week data-confidence bar) as specific actions, not just`,
    `numbers. This is a skim, not a re-statement of the brief — assume he will ask follow-up`,
    `questions for anything he wants to dig into. Plain markdown (headers/bullets/bold only, no`,
    `tables). No em dashes, no AI-tell filler phrases ("it's not just X, it's Y", "let's unpack",`,
    `etc.) — write like a sharp PM giving a 30-second verbal update.`,
    ``,
    `## Live report output`,
    sections.join("\n\n"),
    untagged > 0 ? `\n${untagged} posts have no pillar tag (posts.pillar IS NULL) as of this query.` : "",
    ``,
    `## Prior-cycle brief excerpt (${briefLabel ?? "none"}) — context only, may be stale`,
    briefExcerpt ?? "(no strategy brief exists yet)",
  ].join("\n");
  // Routed through the ONE job queue (Codebase review Phase 2) — same log/heartbeat + bounded
  // concurrency every other Claude spawn in this GUI now gets, instead of its own unbounded spawn.
  // tools: "" disables all tools (confirmed via `claude --help`, same flag draft.ts's
  // callClaudeDraft already relies on) — the prompt above already forbids running commands or
  // reading other files and inlines everything needed, so there's no legitimate tool call for this
  // spawn to make; skipping tool/MCP setup removes one more thing that could eat into the timeout.
  // The model call goes through the ANALYST provider (config/providers.yaml `analyst: routed`):
  // GPT via the local Codex CLI first — Muxin's explicit 2026-07-19 call for analysis and
  // interpretation work — falling back to Claude when Codex is unavailable (usage limits
  // included; the fallback reason carries the limit message so the GUI can say when it clears).
  // The prompt is fully self-contained (everything inlined above), which is the analyst contract.
  const analysis = await runQueued("insights", `Generate insights with ${engine}`, async (job) => {
    const result = await runAgentSpawn(job, engine, prompt, {
      timeoutMs: STRATEGY_TIMEOUT_MS,
      permissionMode: null,
      tools: engine === "codex" ? undefined : "",
      sandbox: "read-only",
    });
    const failure = decodeSpawnFailure(result, job.id, {
      timeoutVerb: `${ENGINE_LABELS[engine]} analysis`,
      timeoutLabel: `${STRATEGY_TIMEOUT_MS / 1000}s`,
      exitVerb: `${ENGINE_LABELS[engine]} analysis`,
      command: ENGINE_COMMANDS[engine],
    });
    if (failure) throw new Error(failure);
    return { text: result.stdout.trim(), engine: engine === "codex" ? "gpt-codex" : engine, fallbackReason: undefined };
  }, engine);
  return {
    summary: analysis.text,
    engine: analysis.engine,
    fallbackReason: analysis.fallbackReason,
    freshness,
    brief: brief ? { path: brief.path, date: brief.date, ageDays: brief.ageDays } : null,
    untagged,
  };
}

// Deep-dive follow-up: unlike generateInsights (which we feed pre-fetched data), Claude is allowed
// to go run one of the same read-only reports itself, or read briefs/config, if the question needs
// something not already in the conversation. Read-only: it's told never to edit/write/delete.
async function askInsights(question: string, history: { role: string; content: string }[], engine: Engine = "claude"): Promise<string> {
  if (!question.trim()) throw new Error("ask something first");
  const transcript = history
    .map((h) => `${h.role === "user" ? "Muxin" : "Claude"}: ${h.content}`)
    .join("\n\n");
  const prompt = [
    `You are Muxin Li's analytics assistant for his content pipeline (data/analytics.db via`,
    `npm run snapshot/resonance/audience/origin-compare, briefs/, config/*.yaml). He's asking a`,
    `follow-up question after an insights summary. You MAY run those npm scripts, or read briefs/`,
    `and config files, if the question needs something not already in the conversation below. Do`,
    `NOT edit, write, or delete any file — this is read-only Q&A.`,
    ``,
    `## Conversation so far`,
    transcript || "(nothing yet)",
    ``,
    `## New question`,
    question.trim(),
    ``,
    `Answer directly and specifically, citing real numbers you find. Plain markdown, no em dashes,`,
    `no AI-tell filler. Keep it as short as the question allows.`,
  ].join("\n");
  // Routed through the ONE job queue (Codebase review Phase 2) — see generateInsights above.
  return runQueued("ask-insights", `Ask with ${engine}: ${question.trim().slice(0, 50)}`, async (job) => {
    const result = await runAgentSpawn(job, engine, prompt, {
      timeoutMs: INSIGHTS_ASK_TIMEOUT_MS,
      permissionMode: null,
      tools: engine === "codex" ? undefined : "",
      sandbox: "read-only",
    });
    const failure = decodeSpawnFailure(result, job.id, {
      timeoutVerb: `${ENGINE_LABELS[engine]} analysis`, timeoutLabel: `${INSIGHTS_ASK_TIMEOUT_MS / 1000}s`,
      exitVerb: `${ENGINE_LABELS[engine]} analysis`, command: ENGINE_COMMANDS[engine],
    });
    if (failure) throw new Error(failure);
    return result.stdout.trim();
  }, engine);
}

function ventureThreadForAnalysis(slug: string): unknown {
  const read = handleVentureRead("GET", `/api/venture/${slug}/thread`);
  if (!read || read.status !== 200) {
    const body = read?.body as { error?: unknown } | undefined;
    throw new Error(typeof body?.error === "string" ? body.error : "could not read this venture");
  }
  const body = read.body as { thread?: unknown };
  if (!body.thread) throw new Error("this venture has no readable thread yet");
  return body.thread;
}

export function ventureAnalysisPrompt(slug: string, thread: unknown): string {
  return [
    `Read .claude/skills/venture/SKILL.md in full before acting.`,
    `Follow its rules and phase gates as the governing policy for this advice.`,
    `Do not run /venture, do not execute a phase command, and do not write, edit, delete, or advance any file or ledger.`,
    `You are giving Muxin a read-only judgment about the current venture state.`,
    `Identify what is ready now, the next decision or action that belongs to Muxin, the strongest risks or evidence gaps,`,
    `and what must not happen yet. Keep recommendations grounded only in the supplied server-derived state.`,
    `Return plain markdown with short headings and bullets. No em dashes and no invented claims, numbers, or evidence.`,
    ``,
    `## Venture`,
    slug,
    ``,
    `## Current server-derived state`,
    "```json",
    JSON.stringify(thread, null, 2),
    "```",
  ].join("\n");
}

async function analyzeVenture(slug: string, engine: Engine = "claude"): Promise<string> {
  const thread = ventureThreadForAnalysis(slug);
  return runQueued("venture-analysis", `Analyze venture ${slug} with ${engine}`, async (job) => {
    const result = await runAgentSpawn(job, engine, ventureAnalysisPrompt(slug, thread), {
      timeoutMs: STRATEGY_TIMEOUT_MS,
      permissionMode: "plan",
      sandbox: "read-only",
    });
    const failure = decodeSpawnFailure(result, job.id, {
      timeoutVerb: `${ENGINE_LABELS[engine]} venture analysis`,
      timeoutLabel: `${STRATEGY_TIMEOUT_MS / 1000}s`,
      exitVerb: `${ENGINE_LABELS[engine]} venture analysis`,
      command: ENGINE_COMMANDS[engine],
    });
    if (failure) throw new Error(failure);
    const text = result.stdout.trim();
    if (!text) throw new Error(`${ENGINE_LABELS[engine]} returned no venture analysis`);
    return text;
  }, engine);
}

// "Refresh brief": run the REAL /strategy skill headlessly (same claude -p slash-command dispatch
// the atomize/video jobs use — the brief is Claude-authored by the skill's own multi-step judgment,
// there is no deterministic brief generator to call instead). It grades last cycle's bets, writes a
// new dated briefs/YYYY-MM-DD-strategy-brief.md, and appends new bets to briefs/bets.md — exactly
// what a terminal /strategy run does (Muxin's pick, 2026-07-16: the full run, not a brief-only
// synthesis). Verified by artifact like every atomize-family job: a new-or-updated brief file must
// actually exist afterward, or the job fails with the log tail.
async function refreshBrief(engine: Engine = "claude"): Promise<{ path: string }> {
  const before = latestBriefPath();
  const beforeMtime = before && existsSync(before) ? statSync(before).mtimeMs : 0;
  return runQueued("strategy", `Refresh strategy brief with ${engine}`, async (job) => {
    const result = await runClaudeSpawn(job, enginePrompt(engine, "strategy", "/strategy"), { timeoutMs: STRATEGY_RUN_TIMEOUT_MS });
    const failure = decodeSpawnFailure(result, job.id, {
      timeoutVerb: "/strategy", timeoutLabel: `${STRATEGY_RUN_TIMEOUT_MS / 60_000} min`,
      exitVerb: "/strategy", includeTailOnTimeout: true,
    });
    if (failure) throw new Error(failure);
    const after = latestBriefPath();
    const changed = after && (after !== before || statSync(after).mtimeMs > beforeMtime);
    if (!after || !changed) {
      throw new Error("/strategy ran but no new or updated brief landed in briefs/. Check the job log");
    }
    return { path: after.slice(repoRoot.length + 1) };
  }, engine);
}

// "Scout new leads": run the real web-discovery agent (`npm run scout` → src/discovery/discover.ts,
// which spawns its own bounded claude -p web searches and writes qualified candidates into
// outreach/leads/ — see .claude/skills/scout/SKILL.md). Discovery only: nothing here contacts
// anyone or drafts a message; new leads land status researched/intake for Muxin to Pursue/Pass.
async function runScout(engine: Engine = "claude"): Promise<void> {
  if (engine === "codex") throw new Error("Scout supports Claude or Grok web discovery; choose one of those engines.");
  await runQueued("scout", "Scout new leads (npm run scout)", async (job) => {
    const result = await runCommandSpawn(job, "npm", ["run", "scout"], { timeoutMs: SCOUT_TIMEOUT_MS, env: { CONTENT_AGENT_ENGINE: engine } });
    const failure = decodeSpawnFailure(result, job.id, {
      timeoutVerb: "scout", timeoutLabel: `${SCOUT_TIMEOUT_MS / 60_000} min`,
      exitVerb: "scout", includeTailOnTimeout: true, command: "npm",
    });
    if (failure) throw new Error(failure);
  }, engine);
}

// True while a job of `kind` is queued or running — backs the 409 guard on the two long-running
// single-flight actions above (a second click must not stack a second 30-min run).
function jobInFlight(kind: "strategy" | "scout"): boolean {
  return jobs.some((j) => j.kind === kind && (j.status === "queued" || j.status === "running"));
}

// "Pull fresh now": the ONLY thing in this GUI that actually fetches new analytics. The header's
// "Reload brief + file list" button (doRefresh in page.ts) just re-reads what's already on disk —
// it never pulls, so it can never surface anything newer than the last real pull. That's normally
// the Sunday 07:00 launchd cron (config/launchd/com.content-agents.weekly-pull.plist); this button
// lets Muxin trigger the same `npm run pull -- --ingest` on demand between cron runs. Scope is
// pull+ingest only (no bluesky, no brief regen) — Muxin still runs Generate insights / /strategy
// himself once fresh data is in.
async function pullFreshAnalytics(): Promise<string> {
  return runQueued("pull", "Pull fresh analytics", async (job) => {
    const result = await runCommandSpawn(job, "npm", ["run", "pull", "--", "--ingest"], {
      timeoutMs: PULL_TIMEOUT_MS,
    });
    const failure = decodeSpawnFailure(result, job.id, {
      timeoutVerb: "Pull", timeoutLabel: `${PULL_TIMEOUT_MS / 60_000} min`, exitVerb: "Pull",
      includeTailOnTimeout: true, command: "npm",
    });
    if (failure) throw new Error(failure);
    return result.stdout.trim();
  });
}

// ── Raw downloaded exports (data/inbox = not-yet-ingested, data/processed = archived after
// ingest) — the actual CSV/JSON/XLSX files pulled from each platform, for Muxin to open and read
// himself rather than trusting only the computed reports above.
const RAW_ROOTS = ["inbox", "processed"];

interface RawFile {
  path: string; // relative to data/, e.g. "processed/foo.csv"
  size: number;
  mtime: number;
}

function listRawFiles(): RawFile[] {
  const out: RawFile[] = [];
  const walk = (dir: string, rel: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const abs = join(dir, entry.name);
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(abs, relPath);
      else {
        const st = statSync(abs);
        out.push({ path: relPath, size: st.size, mtime: st.mtimeMs });
      }
    }
  };
  for (const root of RAW_ROOTS) walk(join(repoRoot, "data", root), root);
  return out.sort((a, b) => b.mtime - a.mtime);
}

// Exported so the path-traversal guard is unit-testable without touching the filesystem.
export function isSafeRawPath(relPath: string): boolean {
  if (!relPath || relPath.includes("..") || relPath.startsWith("/")) return false;
  return RAW_ROOTS.some((root) => relPath === root || relPath.startsWith(`${root}/`));
}

// Follow-ups tab's draft-follow-up route: only a real single-segment outreach/leads/<dir> name is
// legal. Requiring the leading char to be alphanumeric blocks a bare "." or ".." segment (which
// `[\w.-]+` alone would let through, e.g. "outreach/leads/.." resolving one level up) -- same
// posture as rows.ts's safeFolder() explicitly rejecting "..".
export function isValidLeadDir(dir: string): boolean {
  return /^outreach\/leads\/[A-Za-z0-9][\w.-]*$/.test(dir);
}

// The Outreach tab's inline draft editor may only touch a lead's own messages/message-NN.md —
// same allowlist posture as isValidLeadDir above (no "..", no absolute paths, no other files).
export function isValidMessageFile(file: string): boolean {
  return /^messages\/message-\d+\.md$/.test(file);
}

// A typed direction is a sentence or two about what she wants said, not a pasted document. The cap
// keeps one runaway paste from dominating the draft prompt the evidence is supposed to anchor.
export const MAX_DIRECTION_CHARS = 2000;

// The whole guard for POST /api/outreach/draft, pure and exported so the path allowlist and the
// length cap are unit-testable without booting a server. Returns the cleaned inputs or the one
// message the route sends back. A blank direction comes back `undefined`, never "": that is what
// keeps the drafting prompt byte-identical to the one every existing caller already builds.
export function outreachDraftGuard(
  body: Record<string, unknown>,
): { error: string } | { dir: string; direction: string | undefined; engine: Engine } {
  const dir = String(body.dir ?? "");
  if (!isValidLeadDir(dir)) return { error: "not a valid outreach lead folder" };
  const direction = String(body.direction ?? "").trim();
  if (direction.length > MAX_DIRECTION_CHARS) {
    return { error: `keep the direction under ${MAX_DIRECTION_CHARS} characters` };
  }
  return { dir, direction: direction || undefined, engine: requestEngine(body.engine) };
}

// Follow-ups have no typed direction and no second draft surface: keep their request guard
// separate so the optional engine cannot accidentally leak into the directed first-draft route.
// Invalid engine ids retain the existing default posture, while the job receives the normalized
// value and therefore cannot silently fall back after enqueueing.
export function followUpDraftGuard(body: Record<string, unknown>): { error: string } | { dir: string; engine: Engine } {
  const dir = String(body.dir ?? "");
  if (!isValidLeadDir(dir)) return { error: "not a valid outreach lead folder" };
  return { dir, engine: requestEngine(body.engine) };
}

// Pure, exported for unit testing: append one dated note line under a lead.md's `## Muxin notes`
// section, creating the section (before `## Decision log` when present, else at the end) if it
// doesn't exist yet. Muxin's own memory-jogger per lead ("what I liked, what stood out") — plain
// human text in the lead file itself, so it survives any GUI and travels with the lead.
export function appendLeadNote(raw: string, note: string, date: string): string {
  const { header, body } = splitFrontmatter(raw);
  const line = `- ${date}: ${note}`;
  const lines = body.replace(/\n+$/, "").split("\n");
  const sectionAt = lines.findIndex((l) => l.trim() === "## Muxin notes");
  if (sectionAt !== -1) {
    let end = lines.length;
    for (let i = sectionAt + 1; i < lines.length; i++) {
      if (/^##\s+/.test(lines[i])) {
        end = i;
        break;
      }
    }
    // Insert at the section's end, before any trailing blank line that separates the next section.
    while (end > sectionAt + 1 && lines[end - 1].trim() === "") end--;
    lines.splice(end, 0, line);
  } else {
    const decisionAt = lines.findIndex((l) => l.trim() === "## Decision log");
    const section = ["## Muxin notes", "", line, ""];
    if (decisionAt === -1) lines.push("", ...section.slice(0, 3));
    else lines.splice(decisionAt, 0, ...section);
  }
  return `${header}\n${lines.join("\n").replace(/\n+$/, "")}\n`;
}

// Pure, exported for unit testing: append one `- Name | role` line under a lead.md's
// `## Contacts` section (design 3d "WHO YOU'D REACH"), creating the section before
// `## Decision log` (else at the end) when absent -- same placement contract as appendLeadNote.
// Refuses a duplicate name (case-insensitive) so a double-click can't double a person.
export function appendLeadContact(raw: string, name: string, role: string): string {
  const { header, body } = splitFrontmatter(raw);
  const line = role.trim() ? `- ${name} | ${role.trim()}` : `- ${name}`;
  const lines = body.replace(/\n+$/, "").split("\n");
  const sectionAt = lines.findIndex((l) => l.trim() === "## Contacts");
  if (sectionAt !== -1) {
    let end = lines.length;
    for (let i = sectionAt + 1; i < lines.length; i++) {
      if (/^##\s+/.test(lines[i])) { end = i; break; }
    }
    for (let i = sectionAt + 1; i < end; i++) {
      const m = lines[i].match(/^-\s+(.+?)(?:\s*\|.*)?$/);
      if (m && m[1].trim().toLowerCase() === name.toLowerCase()) {
        throw new Error(`"${name}" is already a contact on this lead`);
      }
    }
    while (end > sectionAt + 1 && lines[end - 1].trim() === "") end--;
    lines.splice(end, 0, line);
  } else {
    const decisionAt = lines.findIndex((l) => l.trim() === "## Decision log");
    const section = ["## Contacts", "", line, ""];
    if (decisionAt === -1) lines.push("", ...section.slice(0, 3));
    else lines.splice(decisionAt, 0, ...section);
  }
  return `${header}\n${lines.join("\n").replace(/\n+$/, "")}\n`;
}

function serveRawFile(res: ServerResponse, relPath: string): void {
  if (!isSafeRawPath(relPath)) {
    res.writeHead(400).end("bad path");
    return;
  }
  const abs = join(repoRoot, "data", relPath);
  if (!existsSync(abs) || !statSync(abs).isFile()) {
    res.writeHead(404).end("not found");
    return;
  }
  const ext = extname(abs).toLowerCase();
  const inline = new Set([".csv", ".json", ".png", ".jpg", ".jpeg"]);
  const types: Record<string, string> = {
    ".csv": "text/csv", ".json": "application/json", ".png": "image/png",
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  res.writeHead(200, {
    "content-type": types[ext] ?? "application/octet-stream",
    "content-disposition": `${inline.has(ext) ? "inline" : "attachment"}; filename="${basename(abs)}"`,
    "cache-control": "no-store",
  });
  res.end(readFileSync(abs));
}

export function briefRevisePrompt(relPath: string, instruction: string): string {
  return [
    `Revise ONE file in place for Muxin Li's content pipeline: the current strategy brief. Do not run shell commands; just edit the one file, then stop.`,
    ``,
    `File to edit: ${relPath}`,
    `Muxin's request: "${instruction}"`,
    ``,
    `Rules:`,
    `- Edit ONLY that one file. Touch nothing else — no other briefs, no briefs/bets.md, no config.`,
    `- Keep the existing structure/tables intact unless the request is explicitly about restructuring.`,
    `- Follow config/voice.yaml: no em dashes, no AI tells, Muxin's plain PM voice.`,
    `- Be surgical: apply the request, do not rewrite sections that were not asked about.`,
  ].join("\n");
}

function serveAsset(res: ServerResponse, slug: string, file: string): void {
  let folder: string;
  try {
    folder = safeFolder(slug);
  } catch {
    res.writeHead(404).end("not found");
    return;
  }
  if (file.includes("..") || file.startsWith("/")) {
    res.writeHead(400).end("bad path");
    return;
  }
  const ext = extname(file).toLowerCase();
  if (!IMAGE_EXT.has(ext) && !VIDEO_EXT.has(ext)) {
    res.writeHead(400).end("unsupported");
    return;
  }
  const p = join(folder, file);
  if (!p.startsWith(folder) || !existsSync(p)) {
    res.writeHead(404).end("not found");
    return;
  }
  const types: Record<string, string> = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".gif": "image/gif", ".mp4": "video/mp4",
    ".webm": "video/webm", ".mov": "video/quicktime",
  };
  res.writeHead(200, { "content-type": types[ext] ?? "application/octet-stream", "cache-control": "no-store" });
  res.end(readFileSync(p));
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 5_000_000) reject(new Error("body too large"));
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function json(res: ServerResponse, code: number, obj: unknown): void {
  const s = JSON.stringify(obj);
  res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(s);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  try {
    // Fixture mode is read-only by construction. This sits ABOVE every route on purpose: nothing
    // that mutates state can be reached at all while REVIEW_FIXTURES is set, so no fixture session
    // can touch data/analytics.db, data/publish-schedule.jsonl, review-queue.md, briefs/bets.md or
    // any venture/<slug>/ file. The browser interceptor refuses these too and they never get this
    // far in practice — this is the half that holds even for a request the page did not send.
    if (FIXTURES_ON && req.method !== "GET") {
      json(res, 403, { ok: false, error: FIXTURE_WRITE_REFUSAL });
      return;
    }
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderPage({ repoRoot, isDevWorktree: IS_DEV_WORKTREE, fixtures: FIXTURES_ON }));
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/engines") {
      json(res, 200, { engines: availableEngines(), default: "claude" });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/queue") {
      const pieces = await listPieces();
      // liveStateAsOf: when the background Typefully/PostPeer poll last actually ran (P1 cache
      // work) — null until the first fetch lands. Purely additive/observability; the GUI doesn't
      // need to read it for anything to keep working.
      json(res, 200, {
        pieces,
        pending: pieces.reduce((n, p) => n + p.pending, 0),
        liveStateAsOf: getLiveStateAsOf(),
        // The "Duplicate to platform" dropdown's target list — sourced from the same TEXT_PLATFORMS
        // Typefully scheduling + the spin_angles config both key off, so the client never hardcodes
        // its own copy of "which platforms are real duplicate targets."
        textPlatforms: [...TEXT_PLATFORMS],
      });
      return;
    }
    if (req.method === "GET" && url.pathname === "/asset") {
      serveAsset(res, url.searchParams.get("slug") ?? "", url.searchParams.get("file") ?? "");
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/status") {
      const b = await readBody(req);
      const slug = String(b.slug ?? "");
      const id = String(b.id ?? "");
      // Trimmed + lowercased to match readQueue()'s own normalization (queue.ts trims every
      // cell, then lowercases status) — otherwise a differently-cased or whitespace-padded
      // "approve " would skip the block-check below yet still read back as a clean approved
      // row on the next load, defeating the guard entirely.
      const status = b.status === undefined ? undefined : String(b.status).trim().toLowerCase();
      const notes = b.notes === undefined ? undefined : String(b.notes);
      // One lookup, reused by both the block-check and the schedule-check below — updateRow()
      // only ever touches the status/notes cells, so platform/format stay valid across the write.
      const approveFolder = status === "approve" ? safeFolder(slug) : undefined;
      const approveRow = approveFolder ? readQueue(approveFolder).rows.find((r) => r.id === id) : undefined;
      if (approveFolder && approveRow) {
        const blocked = approveBlockReason(approveFolder, approveRow);
        if (blocked) {
          json(res, 200, { ok: false, error: blocked });
          return;
        }
      }
      const ok = updateRow(slug, id, status, notes);
      if (!ok) {
        json(res, 404, { ok: false });
        return;
      }
      // Approve → auto-schedule (Muxin's choice): the row goes straight to a SCHEDULED post/draft via
      // its platform's existing publish function — text → Typefully, quote-card → cards.ts, tiktok →
      // tiktok.ts, YouTube Short → youtube.ts — which flips the row to "published". No separate
      // /publish run needed. A scheduling failure is returned (not thrown) so the row stays "approve"
      // and the GUI can show why. Rows no scheduler owns just get the plain approve status.
      let scheduled: unknown = null;
      let scheduleError: string | null = null;
      if (approveFolder && approveRow) {
        // In-flight guard: a publisher only flips the row to "published" AFTER its real network
        // call, so two near-simultaneous approve requests for the same row (a double-click, a
        // client retry) would otherwise both read status="approve" and both fire a duplicate
        // PostPeer/YouTube/Typefully call before either write lands. Keyed per row so unrelated
        // rows/folders keep scheduling concurrently.
        const inFlightKey = `${slug}/${id}`;
        if (schedulingInFlight.has(inFlightKey)) {
          json(res, 200, { ok: true, scheduled: null, scheduleError: "already scheduling this row. Try again in a moment" });
          return;
        }
        schedulingInFlight.add(inFlightKey);
        try {
          ({ scheduled, scheduleError } = await scheduleApproved(approveFolder, approveRow));
          // A schedule failure (e.g. the reuse guard) leaves the row at "approve" (scheduleApproved
          // never flips it to "published") but until now the reason only ever flashed once in the
          // browser (page.ts's flash toast) — miss it, and the only remaining signal is reconcile.ts
          // flagging it days later with a generic "not found" mismatch. Persist the real reason into
          // the row's own notes column so it survives a reload, on top of (not instead of) that flash.
          if (scheduleError) {
            const priorNotes = notes !== undefined ? notes : approveRow.notes;
            const persisted =
              priorNotes && priorNotes.trim()
                ? `${priorNotes.trim()} | schedule failed: ${scheduleError}`
                : `schedule failed: ${scheduleError}`;
            updateRow(slug, id, "approve", persisted);
          }
        } finally {
          schedulingInFlight.delete(inFlightKey);
        }
      }
      json(res, 200, { ok: true, scheduled, scheduleError });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/cancel") {
      // Cancel an already-scheduled row's live Typefully/PostPeer draft/post (card e4eca4a1) —
      // the "Cancel" button next to a row reconcile.ts confirms is actually live. Reuses the SAME
      // in-flight guard/key as /api/status's schedule call: a cancel racing a schedule for the
      // same row (double-click, retry) is exactly the kind of duplicate concurrent provider call
      // that guard exists to prevent, so it isn't worth a second Set.
      const b = await readBody(req);
      const slug = String(b.slug ?? "");
      const id = String(b.id ?? "");
      let folder: string;
      try {
        folder = safeFolder(slug);
      } catch (e) {
        json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
        return;
      }
      const row = readQueue(folder).rows.find((r) => r.id === id);
      if (!row) {
        json(res, 404, { ok: false, error: "no such row" });
        return;
      }
      const inFlightKey = `${slug}/${id}`;
      if (schedulingInFlight.has(inFlightKey)) {
        json(res, 200, { ok: false, error: "already scheduling/canceling this row. Try again in a moment" });
        return;
      }
      schedulingInFlight.add(inFlightKey);
      let result: { ok: boolean; error?: string };
      try {
        result = await cancelScheduled(folder, row);
      } finally {
        schedulingInFlight.delete(inFlightKey);
      }
      json(res, 200, result);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/derivative") {
      const b = await readBody(req);
      saveDerivative(String(b.slug ?? ""), String(b.id ?? ""), String(b.body ?? ""));
      json(res, 200, { ok: true });
      return;
    }
    // Cut edits from the workbench: version review before formatting — no scheduling, no status,
    // nothing publishes from here.
    if (req.method === "POST" && url.pathname === "/api/cut-save") {
      const b = await readBody(req);
      try {
        saveCutBody(String(b.slug ?? ""), String(b.lens ?? ""), String(b.body ?? ""));
        json(res, 200, { ok: true });
      } catch (e) {
        json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    // ── Develop tab: the advisor stage ─────────────────────────────────────────────────────────
    // A queued `/develop` round proposes recommendation cards (angles/CTA/spin/routing) — nothing
    // here formats, queues, or publishes anything. Accept/dismiss are deterministic server-side
    // writes (src/review/develop.ts): an accepted angle becomes a cut whose body is assembled
    // ONLY from Muxin's verbatim source.md lines, never from advisor text (CLAUDE.md rule 1).
    if (await handleFictionRoute({ req, res, url, readBody, json, requestEngine })) return;
    if (await handleCharlesRoute({ req, res, url, readBody, json, requestEngine })) return;
    if (await handleSignalsRoute({ req, res, url, readBody, json })) return;
    // Studio home (design 3c): counts, the ranked needs-you list, and the team's honest status.
    if (req.method === "GET" && url.pathname === "/api/studio") {
      json(res, 200, await buildStudioHome());
      return;
    }
    // The Content room's workbench aggregate: per active piece — Muxin's source verbatim, the
    // advisor rounds, each cut as a readable message with provenance, pending review count.
    if (req.method === "GET" && url.pathname === "/api/content") {
      json(res, 200, { sessions: listContentSessions() });
      return;
    }
    // Read-only recommendation seam: production always answers blocked. Touches no file, spawns
    // no job, and takes no parameters that change the answer.
    if (req.method === "GET" && url.pathname === "/api/recommendations") {
      json(res, 200, blockedRecommendationRead());
      return;
    }
    // Read-only: everything the Content room's "decide the treatment" step renders for one piece —
    // per-channel fit label, that channel's OWN reuse window (never a global constant), and the
    // next free slot computed with claimSlots({ dryRun: true }) so nothing is claimed. No ledger
    // write, no queue mutation.
    if (req.method === "GET" && url.pathname === "/api/content/treatment") {
      const slug = (url.searchParams.get("slug") ?? "").trim();
      try {
        json(res, 200, readTreatment(slug, { folder: safeFolder(slug) }));
      } catch (e) {
        json(res, 400, { error: String((e as Error)?.message ?? e) });
      }
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/develop/start") {
      const b = await readBody(req);
      const slug = String(b.slug ?? "").trim();
      try {
        if (slug) {
          json(res, 200, { ok: true, job: publicJob(addDevelopFolderJob(slug, "develop", requestEngine(b.engine))) });
          return;
        }
        const source = String(b.source ?? "");
        if (!source.trim()) {
          json(res, 400, { ok: false, error: "paste some text, a file path, or a URL first" });
          return;
        }
        const dispatch = sourceDispatch(classifySource(source), source);
        if ("error" in dispatch) {
          json(res, 400, { ok: false, error: dispatch.error });
          return;
        }
        if (dispatch.kind === "notes" || dispatch.kind === "continue" || dispatch.kind === "video") {
          json(res, 400, { ok: false, error: "drop a URL, file path, or pasted text here" });
          return;
        }
        const job = addDevelopJob(dispatch.kind, dispatch.arg, dispatch.label, dispatch.rawText, requestEngine(b.engine));
        json(res, 200, { ok: true, job: publicJob(job) });
      } catch (e) {
        json(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/develop/reply") {
      const b = await readBody(req);
      const slug = String(b.slug ?? "");
      const reply = String(b.reply ?? "").trim();
      if (!reply) {
        json(res, 400, { ok: false, error: "type a reply for the advisor first" });
        return;
      }
      try {
        if (developJobInFlight(slug)) {
          json(res, 409, { ok: false, error: "the advisor is already working on this piece. Wait for that round to land" });
          return;
        }
        // Persist the reply BEFORE enqueueing: the spawn argv stays a fixed `/develop
        // content/<slug>`, and the reply is on disk for the audit trail even if the job dies.
        appendReplyBySlug(slug, reply);
        json(res, 200, { ok: true, job: publicJob(addDevelopFolderJob(slug, "develop-reply", requestEngine(b.engine))) });
      } catch (e) {
        json(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/develop/accept") {
      const b = await readBody(req);
      try {
        const result = acceptAngleBySlug(
          String(b.slug ?? ""),
          String(b.cardId ?? ""),
          b.lens === undefined ? undefined : String(b.lens),
          b.title === undefined ? undefined : String(b.title),
        );
        json(res, 200, { ok: true, ...result });
      } catch (e) {
        json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/develop/dismiss") {
      const b = await readBody(req);
      try {
        dismissCardBySlug(String(b.slug ?? ""), String(b.cardId ?? ""));
        json(res, 200, { ok: true });
      } catch (e) {
        json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    // "Format for platforms": one `continue` job per selected cut, resuming the normal /atomize
    // steps 2-8 on the already-scaffolded folder/cut. Everything still lands `pending` in the
    // Review tab — CLAUDE.md rule 2 holds, nothing here publishes.
    if (req.method === "POST" && url.pathname === "/api/develop/format") {
      const b = await readBody(req);
      const slug = String(b.slug ?? "");
      const lenses = Array.isArray(b.lenses) ? b.lenses.map(String) : [];
      if (!lenses.length) {
        json(res, 400, { ok: false, error: "pick at least one cut to format" });
        return;
      }
      try {
        const folder = safeFolder(slug);
        const known = new Set(["extract", ...listCuts(folder)]);
        const unknown = lenses.filter((l) => !known.has(l));
        if (unknown.length) {
          json(res, 400, { ok: false, error: `no such cut: ${unknown.join(", ")}` });
          return;
        }
        const queued = lenses.map((lens) =>
          publicJob(addJob("continue", buildFormatArg(slug, lens), `Format for platforms: ${slug} (${lens})`, undefined, requestEngine(b.engine))),
        );
        json(res, 200, { ok: true, jobs: queued });
      } catch (e) {
        json(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/revise") {
      const b = await readBody(req);
      const slug = String(b.slug ?? "");
      const id = String(b.id ?? "");
      try {
        // Server-side origin check, sourced from the row's actual persisted state — never a
        // client-supplied flag — BEFORE this can spawn `claude -p` against a "reply to mention"
        // row's untrusted source text (see replyToMentionBlockReason's comment in rows.ts).
        const folder = safeFolder(slug);
        const row = readQueue(folder).rows.find((r) => r.id === id);
        const blocked = replyToMentionBlockReason(row);
        if (blocked) {
          json(res, 400, { ok: false, error: `Revision is ${blocked}` });
          return;
        }
        const body = await reviseDerivative(slug, id, String(b.instruction ?? ""), requestEngine(b.engine));
        json(res, 200, { ok: true, body });
      } catch (e) {
        json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    // "Generate storyboard" (card 9e20a616): enqueue `/video <folder>` through the SAME job queue
    // atomize runs through. Fire-and-poll, like /api/atomize — the job shows up in /api/jobs and the
    // row's canGenerateStoryboard/approveBlocked flip once video/storyboard.md lands on disk.
    if (req.method === "POST" && url.pathname === "/api/video/generate") {
      const b = await readBody(req);
      try {
        const job = addVideoJob(String(b.slug ?? ""), requestEngine(b.engine));
        json(res, 200, { ok: true, job: publicJob(job) });
      } catch (e) {
        json(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    // "Duplicate to platform" (card 9304e4a5's missing "create a post for another platform"
    // affordance): copy + re-angle an existing text derivative for a new platform, appending a new
    // `pending` review-queue.md row. Never approves/schedules anything — CLAUDE.md rule 2 holds.
    if (req.method === "POST" && url.pathname === "/api/duplicate") {
      const b = await readBody(req);
      const slug = String(b.slug ?? "");
      const id = String(b.id ?? "");
      try {
        // Same server-side origin check as /api/revise above — a "reply to mention" row must
        // never reach duplicateToPlatform's claude -p spawn either.
        const folder = safeFolder(slug);
        const existingRow = readQueue(folder).rows.find((r) => r.id === id);
        const blocked = replyToMentionBlockReason(existingRow);
        if (blocked) {
          json(res, 400, { ok: false, error: `Duplicate to platform is ${blocked}` });
          return;
        }
        const newRow = await duplicateToPlatform(slug, id, String(b.platform ?? ""), requestEngine(b.engine));
        json(res, 200, { ok: true, row: newRow });
      } catch (e) {
        json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/atomize") {
      const b = await readBody(req);
      const source = String(b.source ?? "");
      if (!source.trim()) {
        json(res, 400, { ok: false, error: "paste some text, a file path, or a URL first" });
        return;
      }
      const dispatch = sourceDispatch(classifySource(source), source);
      if ("error" in dispatch) {
        json(res, 400, { ok: false, error: dispatch.error });
        return;
      }
      const job = addJob(dispatch.kind, dispatch.arg, dispatch.label, dispatch.rawText, requestEngine(b.engine));
      json(res, 200, { ok: true, job: publicJob(job) });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/notes") {
      const limit = Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20);
      const handle = process.env.SUBSTACK_HANDLE;
      if (!handle) {
        json(res, 400, { ok: false, error: "set SUBSTACK_HANDLE in .env first" });
        return;
      }
      const { notes } = await fetchNotesList(handle, limit);
      json(res, 200, {
        ok: true,
        notes: notes.map((n, i) => ({
          idx: i + 1,
          url: n.url,
          publishedAt: n.publishedAt,
          text: n.text,
          likes: n.likes,
          reposts: n.reposts,
          replies: n.replies,
          eng: n.likes + n.replies * 3 + n.reposts * 2,
          drafted: n.drafted,
          reusable: n.reusable,
          draftedTag: n.draftedTag,
        })),
      });
      return;
    }
    // Muxin's manual pick (replaces the old one-click "Pull Substack Notes", which let headless
    // Claude choose on its own): scaffold a folder per picked note, then queue each folder to
    // resume the normal atomize pipeline via `/atomize --continue <folder>` (steps 2-8 only —
    // the folder is already scaffolded, so no re-ingest).
    if (req.method === "POST" && url.pathname === "/api/notes/pick") {
      const b = await readBody(req);
      const indices = Array.isArray(b.indices) ? b.indices.map(Number).filter(Number.isInteger) : [];
      if (!indices.length) {
        json(res, 400, { ok: false, error: "pick at least one note first" });
        return;
      }
      const results = scaffoldPicked(indices);
      const queued = results
        .filter((r) => r.dir)
        .map((r) => publicJob(addJob("continue", `--continue ${r.dir}`, `Note: ${r.title}`, undefined, requestEngine(b.engine))));
      json(res, 200, { ok: true, results, jobs: queued });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/jobs") {
      json(res, 200, { jobs: jobs.map(publicJob) });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/jobs/clear") {
      const removed = clearFinishedJobs();
      json(res, 200, { ok: true, removed });
      return;
    }
    // Stop ONE job — the per-job counterpart to "Clear finished" above. Path-matched by regex like
    // the /log, /answer and /retry routes, since the job id is in the path. `stopped: false` means
    // it had already settled and nothing changed: a safe no-op, not an error. See stopJob for what
    // "stop" means for each of the three job shapes (queued, subprocess, task closure).
    if (req.method === "POST" && /^\/api\/jobs\/[^/]+\/stop$/.test(url.pathname)) {
      const jobId = url.pathname.split("/")[3];
      const result = stopJob(jobId);
      if ("error" in result) {
        res.writeHead(404).end("no such job");
        return;
      }
      json(res, 200, { ok: true, status: result.job.status, stopped: result.stopped });
      return;
    }
    if (req.method === "GET" && /^\/api\/jobs\/[^/]+\/log$/.test(url.pathname)) {
      const jobId = url.pathname.split("/")[3];
      if (!jobs.some((j) => j.id === jobId)) {
        res.writeHead(404).end("no such job");
        return;
      }
      let text: string;
      try {
        text = readFileSync(jobLogPath(jobId), "utf8");
      } catch {
        text = "(no log yet: the job hasn't produced output)";
      }
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
      res.end(text);
      return;
    }
    // A job that stopped to ask Muxin something. She picks one of the options it offered, and the
    // work is requeued as a NEW job carrying her answer (answerJob — a dead subprocess can't be
    // resumed). Path-matched by regex like the /log route above, since the job id is in the path.
    if (req.method === "POST" && /^\/api\/jobs\/[^/]+\/answer$/.test(url.pathname)) {
      const jobId = url.pathname.split("/")[3];
      const b = await readBody(req);
      const answer = String(b.answer ?? "").trim();
      if (!answer) {
        json(res, 400, { ok: false, error: "pick one of the options first" });
        return;
      }
      const result = answerJob(jobId, answer);
      if ("error" in result) {
        json(res, result.error === "no such job" ? 404 : 400, { ok: false, error: result.error });
        return;
      }
      json(res, 200, { ok: true, job: publicJob(result.job) });
      return;
    }
    // Run a failed job again, same id so its log appends rather than starting a second file.
    if (req.method === "POST" && /^\/api\/jobs\/[^/]+\/retry$/.test(url.pathname)) {
      const jobId = url.pathname.split("/")[3];
      const result = retryJob(jobId);
      if ("error" in result) {
        json(res, result.error === "no such job" ? 404 : 400, { ok: false, error: result.error });
        return;
      }
      json(res, 200, { ok: true, job: publicJob(result.job) });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/strategy/brief") {
      const abs = latestBriefPath();
      if (!abs) {
        json(res, 200, { ok: false, error: "no strategy brief exists yet. Run /strategy first" });
        return;
      }
      json(res, 200, { ok: true, path: abs.slice(repoRoot.length + 1), content: readFileSync(abs, "utf8") });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/strategy/ask") {
      const b = await readBody(req);
      try {
        const { path, content } = await reviseBrief(String(b.instruction ?? ""), requestEngine(b.engine));
        json(res, 200, { ok: true, path, content });
      } catch (e) {
        json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    // "Refresh brief": kicks a FULL /strategy run (grades bets, writes a new dated brief + bets —
    // Muxin's pick over a brief-only synthesis). Single-flight: 409 while one is already going.
    // The response resolves only when the run finishes (same long-await contract as /api/strategy/
    // pull-style jobs); progress is visible via /api/jobs + the job log meanwhile.
    if (req.method === "POST" && url.pathname === "/api/strategy/refresh-brief") {
      if (jobInFlight("strategy")) {
        json(res, 409, { ok: false, error: "a /strategy run is already in progress. See the Add / Queue tab" });
        return;
      }
      try {
        const { path } = await refreshBrief(requestEngine((await readBody(req)).engine));
        json(res, 200, { ok: true, path });
      } catch (e) {
        json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/strategy/insights") {
      const b = await readBody(req);
      try {
        const result = await generateInsights(requestEngine(b.engine));
        json(res, 200, { ok: true, ...result });
      } catch (e) {
        json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/strategy/ask-insights") {
      const b = await readBody(req);
      const question = String(b.question ?? "");
      const history = Array.isArray(b.history) ? b.history : [];
      try {
        const answer = await askInsights(question, history, requestEngine(b.engine));
        json(res, 200, { ok: true, answer });
      } catch (e) {
        json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/strategy/pull") {
      try {
        const log = await pullFreshAnalytics();
        json(res, 200, { ok: true, log });
      } catch (e) {
        json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/strategy/raw") {
      json(res, 200, { ok: true, files: listRawFiles() });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/strategy/raw-file") {
      serveRawFile(res, url.searchParams.get("path") ?? "");
      return;
    }
    // Outreach/discovery inbox (card: web-discovery inbox -- fixes the prior read-only, bare-row
    // tab: no clickable sources, no why-fit, no way to act). Returns full lead detail (clickable
    // ## Evidence source URLs + quotes, ## Classification why-fit reasoning, ## Pitch angle) via
    // status.ts's listLeadDetails(), not just frontmatter. add/research/qualify still stay
    // CLI-only (`/outreach` skill, `npm run outreach:*`, `/scout` for discovery) -- this endpoint
    // only reads; the two POST endpoints below are the entire write surface this tab gets.
    if (req.method === "GET" && url.pathname === "/api/outreach/leads") {
      json(res, 200, { ok: true, leads: listLeadDetails() });
      return;
    }
    // Muxin's own pursue/pass call on a lead -- the token-spend gate: nothing downstream (a draft
    // message, a /brand-lens run) fires until he decides here. Deliberately NOT run through
    // qualify.ts's evaluateQualify: this is a human override of (or confirmation of) whatever
    // classification/fit qualify.ts already computed, not another legality re-derivation. Reuses
    // qualify.ts's own setFrontmatterField so the frontmatter rewrite can't drift from how every
    // other outreach status transition writes a field.
    if (req.method === "POST" && url.pathname === "/api/outreach/decide") {
      const b = await readBody(req);
      const dir = String(b.dir ?? "");
      const decision = String(b.decision ?? "");
      if (!isValidLeadDir(dir) || (decision !== "pursue" && decision !== "pass")) {
        json(res, 400, { ok: false, error: "dir must be a valid lead folder and decision must be pursue|pass" });
        return;
      }
      try {
        const leadPath = join(repoRoot, dir, "lead.md");
        const raw = readFileSync(leadPath, "utf8");
        const { header, body } = splitFrontmatter(raw);
        const status = decision === "pursue" ? "pursue" : "passed";
        const newHeader = setFrontmatterField(header, "status", status);
        const date = new Date().toISOString().slice(0, 10);
        const newBody = `${body.replace(/\n+$/, "")}\n- ${date}: Muxin decided ${decision} (manual, review GUI)\n`;
        writeFileSync(leadPath, `${newHeader}\n${newBody}`);
        json(res, 200, { ok: true, dir, status });
      } catch (e) {
        json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    // "Scout new leads" (Muxin, 2026-07-16: the old "Refresh leads" only re-read disk and "doesn't
    // seem to do anything") — runs the real /scout web-discovery agent as a background job, then
    // the client reloads the inbox. Single-flight like refresh-brief. Discovery only (rule: no
    // send path); found leads land researched/intake awaiting Pursue/Pass.
    if (req.method === "POST" && url.pathname === "/api/outreach/scout") {
      if (jobInFlight("scout")) {
        json(res, 409, { ok: false, error: "a scout run is already in progress. See the Add / Queue tab" });
        return;
      }
      const b = await readBody(req);
      try {
        await runScout(requestEngine(b.engine));
        json(res, 200, { ok: true });
      } catch (e) {
        json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    // Muxin's own free-text note on a lead ("what I liked, what stood out") — appended dated under
    // lead.md's ## Muxin notes so it travels with the lead file, same write posture as decide above.
    // "WHO YOU'D REACH" (design 3d): add a person to a lead's ## Contacts. Each contact gets its
    // own follow-up clock once marked sent; nothing here contacts anyone.
    if (req.method === "POST" && url.pathname === "/api/outreach/contact/add") {
      const b = await readBody(req);
      const dir = String(b.dir ?? "");
      const name = String(b.name ?? "").trim().replace(/[|\n]/g, " ");
      const role = String(b.role ?? "").trim().replace(/[|\n]/g, " ");
      if (!isValidLeadDir(dir) || !name) {
        json(res, 400, { ok: false, error: "a valid lead dir and a contact name are required" });
        return;
      }
      try {
        const leadPath = join(repoRoot, dir, "lead.md");
        writeFileSync(leadPath, appendLeadContact(readFileSync(leadPath, "utf8"), name, role));
        json(res, 200, { ok: true });
      } catch (e) {
        json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    // "Mark as sent" (design 3d): the step that puts a person on the follow-ups ledger. Appends a
    // `contacted` tracker event carrying person + channel + which locked message -- the due-date
    // clock starts here. Nothing is transmitted; Muxin already sent it by hand.
    if (req.method === "POST" && url.pathname === "/api/outreach/mark-sent") {
      const b = await readBody(req);
      const dir = String(b.dir ?? "");
      const person = String(b.person ?? "").trim();
      const channel = String(b.channel ?? "").trim();
      if (!isValidLeadDir(dir)) {
        json(res, 400, { ok: false, error: "not a valid outreach lead folder" });
        return;
      }
      if (channel && !(CHANNELS as readonly string[]).includes(channel)) {
        json(res, 400, { ok: false, error: `channel must be one of ${CHANNELS.join(", ")}` });
        return;
      }
      const leadDirName = dir.split("/").pop()!;
      const bucket = leadDirName.startsWith("platform-") ? "platform" : "client";
      const locked = latestLockedMessage(join(repoRoot, dir));
      const event = markSent(bucket, leadDirName, {
        person: person || undefined,
        channel: channel || locked?.channel,
        message: locked?.messageId,
        note: b.note ? String(b.note) : undefined,
      });
      json(res, 200, { ok: true, event });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/outreach/note") {
      const b = await readBody(req);
      const dir = String(b.dir ?? "");
      const note = String(b.note ?? "").trim();
      if (!isValidLeadDir(dir) || !note) {
        json(res, 400, { ok: false, error: "dir must be a valid lead folder and note must be non-empty" });
        return;
      }
      try {
        const leadPath = join(repoRoot, dir, "lead.md");
        const raw = readFileSync(leadPath, "utf8");
        writeFileSync(leadPath, appendLeadNote(raw, note, new Date().toISOString().slice(0, 10)));
        json(res, 200, { ok: true });
      } catch (e) {
        json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    // Inline manual edit of a lead's drafted message (Outreach tab). Body-only: frontmatter is
    // preserved verbatim; a locked message is refused (locked = Muxin's final, approved text).
    // Nothing here sends anything — the edited draft still goes through Review-tab lock + a
    // by-hand send (CLAUDE.md rule 2 analog).
    if (req.method === "POST" && url.pathname === "/api/outreach/message/save") {
      const b = await readBody(req);
      const dir = String(b.dir ?? "");
      const file = String(b.file ?? "");
      const newBody = String(b.body ?? "");
      if (!isValidLeadDir(dir) || !isValidMessageFile(file) || !newBody.trim()) {
        json(res, 400, { ok: false, error: "need a valid lead folder, a messages/message-NN.md file, and non-empty body" });
        return;
      }
      try {
        const abs = join(repoRoot, dir, file);
        const { header, fm } = splitFrontmatter(readFileSync(abs, "utf8"));
        if (String(fm.status ?? "").trim() === "locked") {
          json(res, 200, { ok: false, error: "this message is locked. Use Draft follow-up for a new touch instead" });
          return;
        }
        // `header` keeps its own trailing newline (splitFrontmatter's byte-exact block).
        writeFileSync(abs, `${header}\n${newBody.trim()}\n`);
        json(res, 200, { ok: true, body: newBody.trim() });
      } catch (e) {
        json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    // "Revise with AI" on a drafted outreach message — same headless-Claude single-file revise
    // pattern as a derivative/brief (reviseOutreachMessage in jobs.ts, routed through the one queue).
    if (req.method === "POST" && url.pathname === "/api/outreach/message/revise") {
      const b = await readBody(req);
      const dir = String(b.dir ?? "");
      const file = String(b.file ?? "");
      if (!isValidLeadDir(dir) || !isValidMessageFile(file)) {
        json(res, 400, { ok: false, error: "need a valid lead folder and a messages/message-NN.md file" });
        return;
      }
      try {
        const { body } = await reviseOutreachMessage(dir, file, String(b.instruction ?? ""), requestEngine(b.engine));
        json(res, 200, { ok: true, body });
      } catch (e) {
        json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    // The Outreach thread's directed first draft (Venture Build v7 handoff §3, the conversational
    // half). Muxin types what she wants said and it rides into THIS run's prompt, winning over the
    // stored pitch_angle where the two disagree. `direction` is optional: without it the prompt is
    // byte-identical to the one every existing caller already builds.
    //
    // Iterating on the result is NOT here. It reuses POST /api/outreach/message/revise above, so
    // there stays exactly one revise path. Nothing here sends anything: the draft lands `pending`
    // in the lead's review-queue.md, Muxin locks it and sends it by hand (CLAUDE.md rule 2 analog).
    if (req.method === "POST" && url.pathname === "/api/outreach/draft") {
      const b = await readBody(req);
      const guard = outreachDraftGuard(b);
      if ("error" in guard) {
        json(res, 400, { ok: false, error: guard.error });
        return;
      }
      try {
        const result = await enqueueDirectedDraft(
          guard.dir,
          b.channel ? String(b.channel) : undefined,
          b.recipient ? String(b.recipient) : undefined,
          guard.direction,
          guard.engine,
        );
        json(res, 200, { ok: true, result });
      } catch (e) {
        json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    // Follow-ups tab (docs/outreach-engine-plan.md §6 Phase 4, backlog card 21a5eb84): folds
    // data/outreach/tracker.jsonl into all 4 reason-buckets (client/platform/inbound/jobsearch).
    // GUI/state plumbing only -- no content-generation logic here (CLAUDE.md rule 7).
    if (req.method === "GET" && url.pathname === "/api/followups") {
      json(res, 200, { ok: true, ...buildFollowups() });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/followups/mark-responded") {
      const b = await readBody(req);
      const bucket = String(b.bucket ?? "");
      const lead = String(b.lead ?? "");
      if (!lead || !isBucket(bucket)) {
        json(res, 400, { ok: false, error: "bucket and lead are required" });
        return;
      }
      const event = markResponded(bucket, lead, b.note ? String(b.note) : undefined, undefined, b.person ? String(b.person) : undefined);
      json(res, 200, { ok: true, event });
      return;
    }
    // Manual "I sent this by hand" touch (e.g. sent from an email client, outside this tool) --
    // appends a `followup_sent` event so the due-date clock (re)starts like a drafted-and-sent one.
    if (req.method === "POST" && url.pathname === "/api/followups/mark-contacted") {
      const b = await readBody(req);
      const bucket = String(b.bucket ?? "");
      const lead = String(b.lead ?? "");
      if (!lead || !isBucket(bucket)) {
        json(res, 400, { ok: false, error: "bucket and lead are required" });
        return;
      }
      const event = markContacted(bucket, lead, b.note ? String(b.note) : undefined, undefined, b.person ? String(b.person) : undefined);
      json(res, 200, { ok: true, event });
      return;
    }
    // "Move on" -- reads as closing a chapter, never failure (659b50f0's explicit anti-pattern:
    // no CRM aesthetics, no guilt-styling on overdue rows).
    if (req.method === "POST" && url.pathname === "/api/followups/move-on") {
      const b = await readBody(req);
      const bucket = String(b.bucket ?? "");
      const lead = String(b.lead ?? "");
      if (!lead || !isBucket(bucket)) {
        json(res, 400, { ok: false, error: "bucket and lead are required" });
        return;
      }
      const event = moveOn(bucket, lead, b.note ? String(b.note) : undefined, undefined, b.person ? String(b.person) : undefined);
      json(res, 200, { ok: true, event });
      return;
    }
    // A follow-up touch is a Spin reframe of the already-locked message (plan §5 stage 9) --
    // reuses the existing /outreach draft path via the GUI job queue, never a new compose path.
    // Only client/platform rows carry a `dir` (a real outreach/leads/<dir> folder); jobsearch/
    // inbound rows have nowhere to draft into yet, so this refuses anything outside that tree.
    if (req.method === "POST" && url.pathname === "/api/followups/draft-follow-up") {
      const b = await readBody(req);
      const guard = followUpDraftGuard(b);
      if ("error" in guard) {
        json(res, 400, { ok: false, error: guard.error });
        return;
      }
      try {
        const result = await enqueueFollowUpDraft(
          guard.dir,
          b.channel ? String(b.channel) : undefined,
          b.recipient ? String(b.recipient) : undefined,
          guard.engine,
        );
        json(res, 200, { ok: true, result });
      } catch (e) {
        json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    // Venture intake autosave (Venture Build v7 handoff §1). The intake interview is 25 questions
    // long, so the room debounces each keystroke to a scratch buffer and a half-typed answer
    // survives a reload. These are SEPARATE from the final write: kickoffVenture() in
    // src/venture/intake.ts still owns the real answers and is untouched by any of this. The slug
    // and question number ride in the path, so they are matched by regex like /api/jobs/:id/log
    // above. All three validate in intake-draft.ts, which is the only thing that touches the file.
    if (req.method === "POST" && /^\/api\/venture\/[^/]+\/intake\/\d+\/draft$/.test(url.pathname)) {
      const parts = url.pathname.split("/");
      const b = await readBody(req);
      if (typeof b.text !== "string") {
        json(res, 400, { ok: false, error: "send the draft as text" });
        return;
      }
      const result = saveIntakeDraft(parts[3], Number(parts[5]), b.text);
      json(res, result.ok ? 200 : 400, result);
      return;
    }
    // Restore every in-progress answer at once, for a reopened interview. Matched before the
    // per-question GET below; the two patterns cannot collide (this one ends at "drafts").
    if (req.method === "GET" && /^\/api\/venture\/[^/]+\/intake\/drafts$/.test(url.pathname)) {
      const result = readIntakeDrafts(url.pathname.split("/")[3]);
      json(res, result.ok ? 200 : 400, result);
      return;
    }
    if (req.method === "POST" && /^\/api\/venture\/[^/]+\/intake\/section$/.test(url.pathname)) {
      const b = await readBody(req);
      const result = saveIntakeSectionDraft(url.pathname.split("/")[3], b.section, b.field, b.text);
      json(res, result.ok ? 200 : 400, result);
      return;
    }
    if (req.method === "GET" && /^\/api\/venture\/[^/]+\/intake\/sections$/.test(url.pathname)) {
      const result = readIntakeSections(url.pathname.split("/")[3]);
      json(res, result.ok ? 200 : 400, result);
      return;
    }
    if (req.method === "POST" && /^\/api\/venture\/[^/]+\/intake\/drafts\/clear$/.test(url.pathname)) {
      const result = clearIntakeDrafts(url.pathname.split("/")[3]);
      json(res, result.ok ? 200 : 400, result);
      return;
    }
    // Restore one question. No draft yet is normal on a fresh question, so it answers 200 with a
    // null draft rather than a 404.
    if (req.method === "GET" && /^\/api\/venture\/[^/]+\/intake\/\d+\/draft$/.test(url.pathname)) {
      const parts = url.pathname.split("/");
      const result = readIntakeDraft(parts[3], Number(parts[5]));
      json(res, result.ok ? 200 : 400, result);
      return;
    }
    // Read-only Venture judgment. The selected engine sees the same server-derived thread the room
    // renders and may recommend the next human decision, but it cannot write canon or advance a
    // phase. The existing Venture write routes remain the only way state changes.
    if (req.method === "POST" && /^\/api\/venture\/[^/]+\/analyze$/.test(url.pathname)) {
      const slug = url.pathname.split("/")[3];
      const b = await readBody(req);
      try {
        const engine = requestEngine(b.engine);
        const analysis = await analyzeVenture(slug, engine);
        json(res, 200, { ok: true, engine, analysis });
      } catch (e) {
        json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    // One selected-engine Venture draft step. The engine proposes JSON read-only; venture-runner
    // validates the command against the current phase and feeds it to the existing phase CLI, so
    // the CLI's gates remain authoritative and nothing can auto-select, approve, or publish.
    if (req.method === "POST" && /^\/api\/venture\/[^/]+\/run-step$/.test(url.pathname)) {
      const slug = url.pathname.split("/")[3];
      const b = await readBody(req);
      const phase = Number(b.phase);
      if (!Number.isInteger(phase) || phase < 1 || phase > 4) {
        json(res, 400, { ok: false, error: "phase must be 1, 2, 3, or 4" });
        return;
      }
      try {
        const engine = requestEngine(b.engine);
        const result = await enqueueVentureStep(slug, phase, engine);
        json(res, 200, { ok: true, ...result });
      } catch (e) {
        json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    // The Venture room's write side (twelve POSTs). Every one wraps the function that already
    // owns the rule -- see src/review/venture-writes.ts. Placed before the read dispatcher below
    // (they cannot collide: one is POST-only, the other GET-only) and after the intake-draft
    // routes above, so POST :slug/intake/<n>/draft still reaches its own handler.
    if (req.method === "POST" && url.pathname.startsWith("/api/venture/")) {
      const ventureWrite = handleVentureWrite(req.method, url.pathname, await readBody(req));
      if (ventureWrite) {
        json(res, ventureWrite.status, ventureWrite.body);
        return;
      }
    }
    // The Venture room's read side (nine GETs). Every one wraps an existing src/venture/** read
    // and NOTHING here writes — see src/review/venture-reads.ts for the three properties that
    // file holds (no writes, no response content, three states never two). Placed after the
    // intake-draft routes above so it can never shadow GET :slug/intake/drafts. Returns null for
    // anything that isn't a venture read, so the fall-through 404 below is unchanged.
    {
      const ventureRead = handleVentureRead(req.method ?? "", url.pathname);
      if (ventureRead) {
        json(res, ventureRead.status, ventureRead.body);
        return;
      }
    }
    res.writeHead(404).end("not found");
  } catch (e) {
    json(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});

// Start the server only when run directly (npm run review), so tests can import revisePrompt et al.
// without binding the port. The explicit function is also the narrow seam used by the hermetic
// E2E harness: a loader/eval entrypoint cannot reliably satisfy this module-identity check, while
// an intentional caller can still start the exact same server without changing production routes.
let startRequested = false;
export function startReviewServer(): void {
  if (startRequested) return;
  startRequested = true;
  // Loopback ONLY, deliberately. This server has no authentication and it both writes real state
  // (approve / revise / discard) and triggers real publishes, so binding every interface — Node's
  // default when no host is passed — put it on the local Wi-Fi for anyone to drive. It also made
  // the console line below a lie. Muxin never opens the studio from another device (2026-08-06),
  // so there is no opt-in flag to keep: if that ever changes, add one explicitly rather than
  // widening the default.
  server.listen(PORT, "127.0.0.1", () => {
    if (FIXTURES_ON) {
      console.log(`\n  ⚠ FIXTURE MODE (${FIXTURE_ENV_VAR}=1) — the desk can serve fake data and every write is refused.`);
    }
    console.log(`\n  Review queue → http://localhost:${PORT}\n`);
    console.log("  Approve / revise / discard / edit every pending derivative in one place.");
    console.log("  Only 'approve' rows are acted on by /publish. Ctrl-C to stop.\n");
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startReviewServer();
}
