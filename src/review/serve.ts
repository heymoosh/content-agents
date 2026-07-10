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
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { repoRoot, openDb } from "../db/db.js";
import { readQueue, type QueueRow } from "../publish/queue.js";
import { publishText, TEXT_PLATFORMS } from "../publish/typefully.js";
import { publishCards, isQuoteCardRow } from "../publish/cards.js";
import { publishTikTok, isTikTokRow } from "../publish/tiktok.js";
import { publishShorts, isShortRow } from "../publish/youtube.js";
import { publishSubstack, isSubstackRow } from "../publish/substack.js";
import { fetchNotesList, scaffoldPicked } from "../atomize/new-notes.js";
import { listLeads } from "../outreach/status.js";
import { lockOutreachMessageRow } from "../outreach/lock.js";
import { buildFollowups, markResponded, moveOn, isBucket } from "../outreach/tracker.js";
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
} from "./rows.js";
import {
  classifySource,
  addJob,
  addVideoJob,
  publicJob,
  jobs,
  jobLogPath,
  lastNonEmptyLine,
  tailLines,
  jobElapsedMs,
  revisePrompt,
  reviseDerivative,
  reviseBrief,
  duplicateToPlatform,
  runQueued,
  runClaudeSpawn,
  decodeSpawnFailure,
  enqueueFollowUpDraft,
} from "./jobs.js";
import { renderPage } from "./page.js";

// Re-exported so serve.test.ts's existing imports keep working UNCHANGED after this split — the
// implementations now live in rows.ts (approveBlockReason, enrich) or jobs.ts (classifySource,
// revisePrompt, jobLogPath, lastNonEmptyLine, tailLines, jobElapsedMs). scheduleKind,
// scheduleApproved, isSafeRawPath, and SchedulerDeps are still defined natively below — this
// module deliberately keeps scheduling + the whole Strategy/Analytics tab (see comments below).
export { approveBlockReason, replyToMentionBlockReason, enrich, classifySource, revisePrompt, jobLogPath, lastNonEmptyLine, tailLines, jobElapsedMs };

const PORT = Number(process.env.REVIEW_PORT ?? 4600);

// Claude Code creates ephemeral dev worktrees under .claude/worktrees/<name> — each one has its
// OWN gitignored data/ and content/, isolated from the real checkout, so a report run here can
// come back looking empty even though nothing is actually broken. Surfaced as a banner (see PAGE)
// so this is never silently confusing again (Muxin, 2026-07-04).
const IS_DEV_WORKTREE = repoRoot.includes("/.claude/worktrees/");

// Approve → auto-schedule routing. Which platform scheduler an approved row belongs to. Each check
// calls the OWNING publisher's own exported predicate (isQuoteCardRow, isTikTokRow, isShortRow,
// TEXT_PLATFORMS) instead of re-encoding that publisher's row filter here a second time — so this
// can't silently drift out of sync if a publisher's own definition of "which rows are mine" changes:
//   text (x/linkedin/bluesky, incl. native-video posts) → Typefully (publishText)
//   quote-card / quote-card:<target>                     → cards.ts   (publishCards)
//   tiktok                                               → tiktok.ts  (publishTikTok → scheduleToTikTok)
//   YouTube Short (platform youtube OR format short)     → youtube.ts (publishShorts)
//   substack                                             → substack.ts (publishSubstack)
//   outreach-message (any channel)                       → outreach/lock.ts (lockOutreachMessageRow)
//     -- NOT a scheduler at all (CLAUDE.md rule 2 analog): Approve on this row kind means LOCK,
//     never send/schedule anything. Routed by FORMAT (fixed), not platform, since platform here is
//     the outreach channel (email/linkedin-dm/contact-form/podcast-pitch), not a real destination.
// Returns null for a row no scheduler owns — it just gets the plain approve status (CLAUDE.md rule 2
// is preserved: the row was already set to approve; scheduling only mirrors what /publish would do).
export type ScheduleKind = "text" | "card" | "tiktok" | "video" | "substack" | "outreach-lock";
export function scheduleKind(row: QueueRow): ScheduleKind | null {
  if (TEXT_PLATFORMS.has(row.platform)) return "text";
  if (isQuoteCardRow(row.platform)) return "card";
  if (isTikTokRow(row.platform)) return "tiktok"; // checked before "video" — a tiktok row is also a short
  if (isShortRow(row.platform, row.format)) return "video";
  if (isSubstackRow(row.platform)) return "substack";
  if (row.format === "outreach-message") return "outreach-lock";
  return null;
}

// The five folder-level publish functions the dispatch routes to. Injected (default = the real ones)
// so scheduleApproved is unit-testable WITHOUT any real PostPeer / Upload-Post / YouTube / browser call.
export interface SchedulerDeps {
  publishText: (folder: string, opts: { onlyIds?: string[] }) => Promise<unknown[]>;
  publishCards: (folder: string, opts: { onlyIds?: string[] }) => Promise<unknown[]>;
  publishTikTok: (folder: string, opts: { onlyIds?: string[] }) => Promise<unknown[]>;
  publishShorts: (folder: string, opts: { onlyIds?: string[] }) => Promise<unknown[]>;
  publishSubstack: (folder: string, opts: { onlyIds?: string[] }) => Promise<unknown[]>;
  lockOutreachMessage: (folder: string, opts: { onlyIds?: string[] }) => Promise<unknown[]>;
}
const DEFAULT_SCHEDULER_DEPS: SchedulerDeps = {
  publishText,
  publishCards,
  publishTikTok,
  publishShorts,
  publishSubstack,
  lockOutreachMessage: lockOutreachMessageRow,
};

// Rows (keyed `${slug}/${id}`) currently mid-schedule — see the in-flight guard in the /api/status
// handler below, which prevents a double-click/retry from firing a duplicate real provider call.
const schedulingInFlight = new Set<string>();

// Schedule ONE approved row via its platform's existing publish function (scoped by onlyIds),
// mirroring the text path exactly: on success the row's scheduled info comes back; on failure a
// scheduleError is RETURNED (never thrown) so the row stays `approve` and the GUI shows why instead
// of silently losing the approval or crashing the request.
//
// A publisher can also skip a row WITHOUT throwing (the reuse guard) — it just logs a console.warn
// and returns []. That must still surface as a scheduleError, not fall through silently: `done[0]
// ?? null` alone can't tell "no scheduler owns this row" (kind === null, a genuine no-op) apart
// from "a scheduler ran but skipped this row" (kind set, done === []) — and the GUI showed a bare
// "Approved" for both.
export async function scheduleApproved(
  folder: string,
  row: QueueRow,
  deps: SchedulerDeps = DEFAULT_SCHEDULER_DEPS
): Promise<{ scheduled: unknown; scheduleError: string | null }> {
  const kind = scheduleKind(row);
  if (!kind) return { scheduled: null, scheduleError: null };
  const fn =
    kind === "text" ? deps.publishText
    : kind === "card" ? deps.publishCards
    : kind === "tiktok" ? deps.publishTikTok
    : kind === "substack" ? deps.publishSubstack
    : kind === "outreach-lock" ? deps.lockOutreachMessage
    : deps.publishShorts;
  try {
    const done = await fn(folder, { onlyIds: [row.id] });
    if (done.length === 0) {
      return {
        scheduled: null,
        scheduleError: "not scheduled — blocked by the reuse guard (check the server log for the reason)",
      };
    }
    return { scheduled: done[0], scheduleError: null };
  } catch (e) {
    return { scheduled: null, scheduleError: e instanceof Error ? e.message : String(e) };
  }
}

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
const STRATEGY_TIMEOUT_MS = 90_000;
const INSIGHTS_ASK_TIMEOUT_MS = 180_000; // a deep-dive answer may itself run 1-2 of the reports below

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

// "Generate insights": run the read-only reports ourselves (deterministic, no LLM variance on the
// numbers), then hand the raw output + latest brief to Claude and ask for a short synthesis — not
// another raw dump. This is a pure text answer (nothing written to disk), shown straight in the GUI.
async function generateInsights(): Promise<string> {
  // Fail loud and fast, before spending a Claude call: an empty posts table almost always means
  // this checkout's data/analytics.db is a stale/isolated copy (gitignored, never synced between
  // checkouts — see IS_DEV_WORKTREE), not that there's genuinely no data.
  if (postCount() === 0) {
    return (
      `**No analytics data in this checkout (0 posts in data/analytics.db).**\n\n` +
      (IS_DEV_WORKTREE
        ? `This GUI is running from a Claude Code dev worktree, which has its own empty, gitignored ` +
          `data/analytics.db — it's never synced with your real checkout. Run \`npm run review\` from ` +
          `your main repo checkout instead to see live numbers.\n`
        : `\`data/analytics.db\` is gitignored (per-checkout, never synced by git) — either this checkout ` +
          `has never been ingested, or something pulled into a different copy. Run \`npm run ingest\` / ` +
          `\`npm run pull\` here, or check you're in the checkout you expect.\n`)
    );
  }
  const sections: string[] = [];
  for (const key of Object.keys(REPORTS)) {
    try {
      sections.push(`### ${key}\n${await runReport(key)}`);
    } catch (e) {
      sections.push(`### ${key}\n(failed: ${e instanceof Error ? e.message : String(e)})`);
    }
  }
  const briefPath = latestBriefPath();
  const briefText = briefPath ? readFileSync(briefPath, "utf8") : "(no strategy brief exists yet)";
  const prompt = [
    `Muxin Li wants a quick read on his content pipeline's analytics. Below is raw output from the`,
    `pipeline's own report scripts, plus his latest strategy brief. Do not run any commands or read`,
    `any other files — just read what's given below and respond.`,
    ``,
    `Write a SHORT, high-level synthesis: what's working, what's not, 3-5 concrete numbers that`,
    `actually matter, and one or two things worth doing next. This is a skim, not a re-statement of`,
    `the brief — assume he will ask follow-up questions for anything he wants to dig into. Plain`,
    `markdown (headers/bullets/bold only, no tables). No em dashes, no AI-tell filler phrases`,
    `("it's not just X, it's Y", "let's unpack", etc.) — write like a sharp PM giving a 30-second`,
    `verbal update.`,
    ``,
    `## Raw report output`,
    sections.join("\n\n"),
    ``,
    `## Latest strategy brief`,
    briefText,
  ].join("\n");
  // Routed through the ONE job queue (Codebase review Phase 2) — same log/heartbeat + bounded
  // concurrency every other Claude spawn in this GUI now gets, instead of its own unbounded spawn.
  return runQueued("insights", "Generate insights", async (job) => {
    const result = await runClaudeSpawn(job, prompt, { timeoutMs: STRATEGY_TIMEOUT_MS });
    const failure = decodeSpawnFailure(result, job.id, {
      timeoutVerb: "Claude", timeoutLabel: `${STRATEGY_TIMEOUT_MS / 1000}s`, exitVerb: "Claude",
    });
    if (failure) throw new Error(failure);
    return result.stdout.trim();
  });
}

// Deep-dive follow-up: unlike generateInsights (which we feed pre-fetched data), Claude is allowed
// to go run one of the same read-only reports itself, or read briefs/config, if the question needs
// something not already in the conversation. Read-only: it's told never to edit/write/delete.
async function askInsights(question: string, history: { role: string; content: string }[]): Promise<string> {
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
  return runQueued("ask-insights", `Ask: ${question.trim().slice(0, 60)}`, async (job) => {
    const result = await runClaudeSpawn(job, prompt, { timeoutMs: INSIGHTS_ASK_TIMEOUT_MS });
    const failure = decodeSpawnFailure(result, job.id, {
      timeoutVerb: "Claude", timeoutLabel: `${INSIGHTS_ASK_TIMEOUT_MS / 1000}s`, exitVerb: "Claude",
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
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderPage({ repoRoot, isDevWorktree: IS_DEV_WORKTREE }));
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
          json(res, 200, { ok: true, scheduled: null, scheduleError: "already scheduling this row — try again in a moment" });
          return;
        }
        schedulingInFlight.add(inFlightKey);
        try {
          ({ scheduled, scheduleError } = await scheduleApproved(approveFolder, approveRow));
        } finally {
          schedulingInFlight.delete(inFlightKey);
        }
      }
      json(res, 200, { ok: true, scheduled, scheduleError });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/derivative") {
      const b = await readBody(req);
      saveDerivative(String(b.slug ?? ""), String(b.id ?? ""), String(b.body ?? ""));
      json(res, 200, { ok: true });
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
          json(res, 400, { ok: false, error: `Ask Claude is ${blocked}` });
          return;
        }
        const body = await reviseDerivative(slug, id, String(b.instruction ?? ""));
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
        const job = addVideoJob(String(b.slug ?? ""));
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
        const newRow = await duplicateToPlatform(slug, id, String(b.platform ?? ""));
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
      const c = classifySource(source);
      const job = c.kind === "text" ? addJob("text", "", c.label, source) : addJob(c.kind, c.arg, c.label);
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
        .map((r) => publicJob(addJob("continue", `--continue ${r.dir}`, `Note: ${r.title}`)));
      json(res, 200, { ok: true, results, jobs: queued });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/jobs") {
      json(res, 200, { jobs: jobs.map(publicJob) });
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
        text = "(no log yet — the job hasn't produced output)";
      }
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
      res.end(text);
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/strategy/brief") {
      const abs = latestBriefPath();
      if (!abs) {
        json(res, 200, { ok: false, error: "no strategy brief exists yet — run /strategy first" });
        return;
      }
      json(res, 200, { ok: true, path: abs.slice(repoRoot.length + 1), content: readFileSync(abs, "utf8") });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/strategy/ask") {
      const b = await readBody(req);
      try {
        const { path, content } = await reviseBrief(String(b.instruction ?? ""));
        json(res, 200, { ok: true, path, content });
      } catch (e) {
        json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/strategy/insights") {
      try {
        const summary = await generateInsights();
        json(res, 200, { ok: true, summary });
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
        const answer = await askInsights(question, history);
        json(res, 200, { ok: true, answer });
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
    // Read-only outreach lead surfacing (Phase 1 definition of done: "GUI reads lead
    // review-queues"). No write path here on purpose -- add/research/qualify stay CLI-only
    // (`/outreach` skill, `npm run outreach:*`) for Phase 1; this endpoint just lets Muxin see
    // where every seeded lead stands without a terminal. Reuses status.ts's own scan (listLeads)
    // instead of re-implementing the outreach/leads/*/lead.md read here.
    if (req.method === "GET" && url.pathname === "/api/outreach/leads") {
      json(res, 200, { ok: true, leads: listLeads() });
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
      const event = markResponded(bucket, lead, b.note ? String(b.note) : undefined);
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
      const event = moveOn(bucket, lead, b.note ? String(b.note) : undefined);
      json(res, 200, { ok: true, event });
      return;
    }
    // A follow-up touch is a Spin reframe of the already-locked message (plan §5 stage 9) --
    // reuses the existing /outreach draft path via the GUI job queue, never a new compose path.
    // Only client/platform rows carry a `dir` (a real outreach/leads/<dir> folder); jobsearch/
    // inbound rows have nowhere to draft into yet, so this refuses anything outside that tree.
    if (req.method === "POST" && url.pathname === "/api/followups/draft-follow-up") {
      const b = await readBody(req);
      const dir = String(b.dir ?? "");
      if (!/^outreach\/leads\/[\w.-]+$/.test(dir)) {
        json(res, 400, { ok: false, error: "not a valid outreach lead folder" });
        return;
      }
      try {
        const result = await enqueueFollowUpDraft(dir, b.channel ? String(b.channel) : undefined);
        json(res, 200, { ok: true, result });
      } catch (e) {
        json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    res.writeHead(404).end("not found");
  } catch (e) {
    json(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});

// Start the server only when run directly (npm run review), so tests can import revisePrompt et al.
// without binding the port.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  server.listen(PORT, () => {
    console.log(`\n  Review queue → http://localhost:${PORT}\n`);
    console.log("  Approve / revise / discard / edit every pending derivative in one place.");
    console.log("  Only 'approve' rows are acted on by /publish. Ctrl-C to stop.\n");
  });
}
