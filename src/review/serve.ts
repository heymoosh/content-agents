// Unified review + approval GUI.
//
// One local page that aggregates every content/<slug>/review-queue.md, previews the actual
// derivative inline (post text, quote-card image, video storyboard), and lets Muxin
// approve / revise / discard / edit in place — instead of hand-editing 20+ markdown tables.
//
// It READS through the same readQueue() the publish step uses and WRITES status back into the
// exact same table cell setStatus() targets, so an "approve" here starts from the same place an
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
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { homedir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";
import { repoRoot, openDb } from "../db/db.js";
import { readQueue, stampOrigin, type QueueRow } from "../publish/queue.js";
import { publishText, TEXT_PLATFORMS, fetchScheduledDrafts } from "../publish/typefully.js";
import { publishCards, isQuoteCardRow } from "../publish/cards.js";
import { publishTikTok, isTikTokRow } from "../publish/tiktok.js";
import { publishShorts, isShortRow } from "../publish/youtube.js";
import { fetchScheduledPosts } from "../publish/postpeer-status.js";
import { reconcileRow, needsReconciliation, type LiveProviderState, type ReconciledStatus, type PublishLogRead } from "./reconcile.js";
import { fetchNotesList, scaffoldPicked } from "../atomize/new-notes.js";
import { classifyThread } from "../atomize/thread-check.js";

const CONTENT = join(repoRoot, "content");
const PORT = Number(process.env.REVIEW_PORT ?? 4600);

// Claude Code creates ephemeral dev worktrees under .claude/worktrees/<name> — each one has its
// OWN gitignored data/ and content/, isolated from the real checkout, so a report run here can
// come back looking empty even though nothing is actually broken. Surfaced as a banner (see PAGE)
// so this is never silently confusing again (Muxin, 2026-07-04).
const IS_DEV_WORKTREE = repoRoot.includes("/.claude/worktrees/");

// A row is "decided" once it's out of the review inbox. Everything else needs Muxin's eyes.
const DECIDED = new Set(["published", "discard"]);
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const VIDEO_EXT = new Set([".mp4", ".webm", ".mov"]);

// "Revise with Claude": shell out to headless Claude Code (`claude -p`), which uses Muxin's
// subscription ($0 marginal), to edit ONE derivative in place per a natural-language instruction.
const execFileP = promisify(execFile);
const REVISE_TIMEOUT_MS = 180_000;

type Kind = "text" | "image" | "video" | "storyboard" | "unknown";

interface EnrichedRow extends QueueRow {
  kind: Kind;
  body?: string; // derivative text / storyboard text (what a human reads)
  spin?: boolean;
  angle?: string;
  sourceLines?: unknown;
  threadCheck?: string; // "pass" | "missing" — config/platforms.yaml home_brand thread-check
  threadSpinApplied?: boolean; // Spin already drafted the worldview thread in on a "missing" verdict
  assetUrl?: string; // image/video preview URL
  editable: boolean; // can the body be edited-and-saved here?
  revisable: boolean; // has a derivatives/<id>.md that "Revise with Claude" can rewrite
  hasAsset: boolean;
  approveBlocked: string | null; // reason Approve is disabled, if any
  reconciled?: ReconciledStatus; // live Typefully/PostPeer reconciliation — omitted when not applicable
}

interface Piece {
  slug: string;
  title: string;
  rows: EnrichedRow[];
  pending: number;
}

// Split frontmatter but KEEP the raw header text so a body edit can be written back without
// re-serializing (and thus reordering / reformatting) the YAML the pipeline wrote.
function splitRaw(text: string): { header: string; body: string; fm: Record<string, unknown> } {
  const m = text.match(/^(---\n[\s\S]*?\n---\n?)([\s\S]*)$/);
  if (!m) return { header: "", body: text.trim(), fm: {} };
  let fm: Record<string, unknown> = {};
  try {
    fm = (parseYaml(m[1].replace(/^---\n/, "").replace(/\n---\n?$/, "")) as Record<string, unknown>) ?? {};
  } catch {
    fm = {};
  }
  return { header: m[1], body: m[2].trim(), fm };
}

// Resolve a slug to its content folder, refusing anything that isn't a real review-queue folder
// (defends the write/asset endpoints against path traversal on a slug from the client).
function safeFolder(slug: string): string {
  if (!slug || slug.includes("/") || slug.includes("..")) throw new Error("bad slug");
  const folder = join(CONTENT, slug);
  if (!existsSync(join(folder, "review-queue.md"))) throw new Error("no such queue");
  return folder;
}

function firstHeading(folder: string): string {
  try {
    const m = readFileSync(join(folder, "review-queue.md"), "utf8").match(/^#\s+(.+)$/m);
    if (m) return m[1].replace(/^Review queue\s*[—-]\s*/i, "").trim();
  } catch {
    /* fall through to slug */
  }
  return basename(folder).replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/-/g, " ");
}

// A "video-script" row (format=storyboard) drafts video/script-draft.md long before /video turns
// it into video/storyboard.md — the one file src/video/render.ts's own render gate trusts. Approving
// off the draft alone is a phantom approval: it means nothing to render.ts and misrepresents review
// as having happened. Same risk for "video"/"short" rows (animated quote-videos, /video's rendered
// short + its TikTok row — CLAUDE.md backlog card 4bef9a7c) if the row lands in review-queue.md
// before its asset file does — so those are gated on their own `asset` cell existing on disk too.
// `exists` is injected (mirrors classifySource below) so this is unit-testable without touching disk.
export function approveBlockReason(
  folder: string,
  row: QueueRow,
  exists: (p: string) => boolean = existsSync,
): string | null {
  if (row.format === "storyboard") {
    return exists(join(folder, "video", "storyboard.md")) ? null : "storyboard not rendered yet — run /video";
  }
  if (row.format === "video" || row.format === "short") {
    const asset = row.asset && row.asset !== "—" && row.asset !== "-" ? row.asset : "";
    if (!asset) return null; // no known gate file to check
    return exists(join(folder, asset)) ? null : "video not rendered yet — run /video";
  }
  return null;
}

// Approve → auto-schedule routing. Which platform scheduler an approved row belongs to. Each check
// calls the OWNING publisher's own exported predicate (isQuoteCardRow, isTikTokRow, isShortRow,
// TEXT_PLATFORMS) instead of re-encoding that publisher's row filter here a second time — so this
// can't silently drift out of sync if a publisher's own definition of "which rows are mine" changes:
//   text (x/linkedin/bluesky, incl. native-video posts) → Typefully (publishText)
//   quote-card / quote-card:<target>                     → cards.ts   (publishCards)
//   tiktok                                               → tiktok.ts  (publishTikTok → scheduleToTikTok)
//   YouTube Short (platform youtube OR format short)     → youtube.ts (publishShorts)
// Returns null for a row no scheduler owns — it just gets the plain approve status (CLAUDE.md rule 2
// is preserved: the row was already set to approve; scheduling only mirrors what /publish would do).
export type ScheduleKind = "text" | "card" | "tiktok" | "video";
export function scheduleKind(row: QueueRow): ScheduleKind | null {
  if (TEXT_PLATFORMS.has(row.platform)) return "text";
  if (isQuoteCardRow(row.platform)) return "card";
  if (isTikTokRow(row.platform)) return "tiktok"; // checked before "video" — a tiktok row is also a short
  if (isShortRow(row.platform, row.format)) return "video";
  return null;
}

// The four folder-level publish functions the dispatch routes to. Injected (default = the real ones)
// so scheduleApproved is unit-testable WITHOUT any real PostPeer / Upload-Post / YouTube network call.
export interface SchedulerDeps {
  publishText: (folder: string, opts: { onlyIds?: string[] }) => Promise<unknown[]>;
  publishCards: (folder: string, opts: { onlyIds?: string[] }) => Promise<unknown[]>;
  publishTikTok: (folder: string, opts: { onlyIds?: string[] }) => Promise<unknown[]>;
  publishShorts: (folder: string, opts: { onlyIds?: string[] }) => Promise<unknown[]>;
}
const DEFAULT_SCHEDULER_DEPS: SchedulerDeps = { publishText, publishCards, publishTikTok, publishShorts };

// Rows (keyed `${slug}/${id}`) currently mid-schedule — see the in-flight guard in the /api/status
// handler below, which prevents a double-click/retry from firing a duplicate real provider call.
const schedulingInFlight = new Set<string>();

// Schedule ONE approved row via its platform's existing publish function (scoped by onlyIds),
// mirroring the text path exactly: on success the row's scheduled info comes back; on failure a
// scheduleError is RETURNED (never thrown) so the row stays `approve` and the GUI shows why instead
// of silently losing the approval or crashing the request.
//
// A publisher can also skip a row WITHOUT throwing (the reuse guard, or cards.ts finding no
// connected account for the row's target) — it just logs a console.warn and returns []. That must
// still surface as a scheduleError, not fall through silently: `done[0] ?? null` alone can't tell
// "no scheduler owns this row" (kind === null, a genuine no-op) apart from "a scheduler ran but
// skipped this row" (kind set, done === []) — and the GUI showed a bare "Approved" for both.
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
    : deps.publishShorts;
  try {
    const done = await fn(folder, { onlyIds: [row.id] });
    if (done.length === 0) {
      return {
        scheduled: null,
        scheduleError: "not scheduled — blocked by the reuse guard or no connected account (check the server log for the reason)",
      };
    }
    return { scheduled: done[0], scheduleError: null };
  } catch (e) {
    return { scheduled: null, scheduleError: e instanceof Error ? e.message : String(e) };
  }
}

// Read-only publish-log.md text for a folder — the only place a provider draft/post id is
// persisted (see src/review/reconcile.ts). A missing file (ENOENT — no log yet) just has no
// entries to find; any OTHER read failure (permissions, fd exhaustion, ...) is carried as `error`
// so reconcileRow reports "unavailable" instead of misreading it as "nothing ever scheduled".
function readPublishLogSafe(folder: string): PublishLogRead {
  try {
    return { text: readFileSync(join(folder, "publish-log.md"), "utf8") };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return { text: "" };
    return { text: "", error: e instanceof Error ? e.message : String(e) };
  }
}

// Fetch one provider's live list, degrading to `items: null` + an error string on failure (missing
// credentials, network error, non-2xx) instead of throwing — a reconciliation check that can't
// reach a provider must say so ("unavailable"), never silently read as "not scheduled" (mismatch).
async function safeFetch<T>(fn: () => Promise<T[]>): Promise<{ items: T[] | null; error?: string }> {
  try {
    return { items: await fn() };
  } catch (e) {
    return { items: null, error: e instanceof Error ? e.message : String(e) };
  }
}

// The live Typefully + PostPeer state, fetched ONCE per /api/queue request (not per row/folder) —
// both are account-wide reads, not scoped to one content folder. Read-only: never schedules,
// cancels, or modifies anything at either provider.
async function fetchLiveProviderState(): Promise<LiveProviderState> {
  const [tf, pp] = await Promise.all([safeFetch(fetchScheduledDrafts), safeFetch(fetchScheduledPosts)]);
  return { typefullyDrafts: tf.items, typefullyError: tf.error, postpeerPosts: pp.items, postpeerError: pp.error };
}

// Exported so the reconciliation wiring (row.reconciled) is testable against the REAL code path
// /api/queue uses — a temp folder + a crafted publish-log.md + injected live state, no server/network.
export function enrich(folder: string, slug: string, row: QueueRow, publishLog: PublishLogRead, live: LiveProviderState): EnrichedRow {
  const asset = row.asset && row.asset !== "—" && row.asset !== "-" ? row.asset : "";
  let kind: Kind = "unknown";
  if (row.format === "text") kind = "text";
  else if (row.format === "image") kind = "image";
  else if (row.format === "video") kind = "video";
  else if (row.format === "storyboard") kind = "storyboard";

  const out: EnrichedRow = {
    ...row,
    kind,
    editable: false,
    revisable: existsSync(join(folder, "derivatives", `${row.id}.md`)),
    hasAsset: false,
    approveBlocked: approveBlockReason(folder, row),
    reconciled: needsReconciliation(row) ? reconcileRow(row, publishLog, live) : undefined,
  };
  const assetUrl = (file: string) => `/asset?slug=${encodeURIComponent(slug)}&file=${encodeURIComponent(file)}`;

  const loadMd = (relPath: string) => {
    const p = join(folder, relPath);
    if (!existsSync(p)) return false;
    const { body, fm } = splitRaw(readFileSync(p, "utf8"));
    out.body = body;
    out.spin = fm.spin === true;
    out.angle = typeof fm.angle === "string" ? fm.angle : undefined;
    out.sourceLines = fm.source_lines;
    out.threadCheck = classifyThread(fm);
    out.threadSpinApplied = fm.thread_spin_applied === true;
    return true;
  };

  if ((kind === "text" || kind === "video") && asset.endsWith(".md")) {
    if (loadMd(asset)) {
      out.hasAsset = true;
      out.editable = kind === "text"; // text derivatives are safe to edit-in-place
    }
  } else if (kind === "image" && asset) {
    const p = join(folder, asset);
    if (existsSync(p) && IMAGE_EXT.has(extname(asset).toLowerCase())) {
      out.assetUrl = assetUrl(asset);
      out.hasAsset = true;
    }
    // The quote text that backs the card usually lives in a companion derivative.
    loadMd(join("derivatives", `${row.id}.md`));
  } else if (kind === "storyboard") {
    // Prefer the storyboard once /video builds it; before then, surface the drafted script so the
    // video-script row is reviewable in the GUI instead of showing "no asset generated yet".
    if (loadMd(join("video", "storyboard.md")) || loadMd(join("video", "script-draft.md"))) {
      out.hasAsset = true;
    }
  }

  // A video derivative can also have a rendered file to preview.
  if (kind === "video" && asset && VIDEO_EXT.has(extname(asset).toLowerCase())) {
    if (existsSync(join(folder, asset))) {
      out.assetUrl = assetUrl(asset);
      out.hasAsset = true;
    }
  }
  return out;
}

async function listPieces(): Promise<Piece[]> {
  let dirs: string[] = [];
  try {
    dirs = readdirSync(CONTENT, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(CONTENT, d.name, "review-queue.md")))
      .map((d) => d.name);
  } catch {
    dirs = [];
  }
  // Read every folder's rows up front (sync, no network) so a live Typefully/PostPeer fetch only
  // happens when there's actually an approved row somewhere to reconcile.
  const folderRows = dirs.map((slug) => {
    const folder = join(CONTENT, slug);
    return { slug, folder, rows: readQueue(folder).rows };
  });
  const anyNeedsReconcile = folderRows.some(({ rows }) => rows.some(needsReconciliation));
  const live: LiveProviderState = anyNeedsReconcile
    ? await fetchLiveProviderState()
    : { typefullyDrafts: [], postpeerPosts: [] };

  const pieces = folderRows.map(({ slug, folder, rows }) => {
    const publishLog: PublishLogRead = rows.some(needsReconciliation) ? readPublishLogSafe(folder) : { text: "" };
    const enriched = rows.map((r) => enrich(folder, slug, r, publishLog, live));
    return {
      slug,
      title: firstHeading(folder),
      rows: enriched,
      pending: enriched.filter((r) => !DECIDED.has(r.status)).length,
    };
  });
  pieces.sort((a, b) => b.slug.localeCompare(a.slug)); // newest (date-prefixed) first
  return pieces;
}

// Rewrite one row's status and/or notes in review-queue.md, matched by id (not a stale line
// index), preserving every other cell. Mirrors setStatus()'s cells[8] target so /publish reads
// it identically; also updates the notes cell (cells[9]) which setStatus() doesn't touch.
function updateRow(slug: string, id: string, status?: string, notes?: string): boolean {
  const folder = safeFolder(slug);
  const path = join(folder, "review-queue.md");
  const lines = readFileSync(path, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("|") || /^\|\s*-+/.test(line) || /^\|\s*id\s*\|/i.test(line)) continue;
    const cells = line.split("|");
    if (cells.length < 11) continue; // leading "" + 9 data cells + trailing ""
    if (cells[1].trim() !== id) continue;
    if (status !== undefined) cells[8] = ` ${status} `;
    if (notes !== undefined) cells[9] = ` ${notes.replace(/[|\n\r]/g, " ").trim()} `;
    lines[i] = cells.join("|");
    writeFileSync(path, lines.join("\n"));
    return true;
  }
  return false;
}

// Save an edited derivative body, keeping its frontmatter block byte-for-byte.
function saveDerivative(slug: string, id: string, body: string): void {
  const folder = safeFolder(slug);
  if (!/^[\w.-]+$/.test(id)) throw new Error("bad id");
  const p = join(folder, "derivatives", `${id}.md`);
  if (!existsSync(p)) throw new Error("no such derivative");
  const { header } = splitRaw(readFileSync(p, "utf8"));
  writeFileSync(p, header + body.trim() + "\n");
}

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
async function reviseDerivative(slug: string, id: string, instruction: string): Promise<string> {
  const folder = safeFolder(slug);
  if (!/^[\w.-]+$/.test(id)) throw new Error("bad id");
  if (!instruction.trim()) throw new Error("tell Claude what to change first");
  const p = join(folder, "derivatives", `${id}.md`);
  if (!existsSync(p)) throw new Error("no such derivative to revise");

  const original = splitRaw(readFileSync(p, "utf8"));
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

  const after = splitRaw(readFileSync(p, "utf8")).body;
  if (after === original.body) {
    throw new Error("Claude ran but didn't change anything — try a more specific instruction");
  }
  return after;
}

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

function latestBriefPath(): string | null {
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
  try {
    const { stdout } = await execFileP("claude", ["-p", prompt, "--permission-mode", "acceptEdits"], {
      cwd: repoRoot,
      timeout: STRATEGY_TIMEOUT_MS,
      maxBuffer: 20_000_000,
    });
    return stdout.trim();
  } catch (e) {
    const err = e as { code?: string; killed?: boolean; stderr?: string; message?: string };
    if (err.code === "ENOENT") {
      throw new Error("the `claude` CLI isn't on this server's PATH — start the GUI from a terminal where `claude` runs");
    }
    if (err.killed) throw new Error(`Claude timed out after ${STRATEGY_TIMEOUT_MS / 1000}s`);
    throw new Error(`Claude failed: ${(err.stderr || err.message || "unknown").slice(0, 300)}`);
  }
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
  try {
    const { stdout } = await execFileP("claude", ["-p", prompt, "--permission-mode", "acceptEdits"], {
      cwd: repoRoot,
      timeout: INSIGHTS_ASK_TIMEOUT_MS,
      maxBuffer: 20_000_000,
    });
    return stdout.trim();
  } catch (e) {
    const err = e as { code?: string; killed?: boolean; stderr?: string; message?: string };
    if (err.code === "ENOENT") {
      throw new Error("the `claude` CLI isn't on this server's PATH — start the GUI from a terminal where `claude` runs");
    }
    if (err.killed) throw new Error(`Claude timed out after ${INSIGHTS_ASK_TIMEOUT_MS / 1000}s`);
    throw new Error(`Claude failed: ${(err.stderr || err.message || "unknown").slice(0, 300)}`);
  }
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

function briefRevisePrompt(relPath: string, instruction: string): string {
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

async function reviseBrief(instruction: string): Promise<{ path: string; content: string }> {
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
}
const jobs: Job[] = [];
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

function publicJob(j: Job) {
  return {
    id: j.id, kind: j.kind, label: j.label, status: j.status, slugs: j.slugs,
    error: j.error, createdAt: j.createdAt, startedAt: j.startedAt, finishedAt: j.finishedAt,
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
function addJob(kind: Job["kind"], rawArg: string, label: string, rawText?: string): Job {
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
    createdAt: Date.now(), startedAt: null, finishedAt: null,
  };
  jobs.push(job);
  void drain();
  return job;
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
  try {
    // ATOMIZE_ORIGIN=gui-queue tells the /atomize skill's step 8 to tag every row it appends
    // "from GUI queue" instead of the default "from /cycle" — the origin source-tag the review
    // GUI renders per row (src/publish/queue.ts QUEUE_ORIGINS).
    await execFileP("claude", ["-p", `/atomize ${job.arg}`, "--permission-mode", ATOMIZE_PERMISSION_MODE], {
      cwd: repoRoot,
      timeout: ATOMIZE_TIMEOUT_MS,
      maxBuffer: 40_000_000,
      env: { ...process.env, ATOMIZE_ORIGIN: "gui-queue" },
    });
    job.slugs = listSlugs().filter((s) => !before.has(s));
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
    job.status = "done";
    if (!job.slugs.length) {
      job.error = "atomize finished but created no new content folder — check the terminal running the GUI";
    }
  } catch (e) {
    const err = e as { code?: string; killed?: boolean; stderr?: string; message?: string };
    job.status = "failed";
    if (err.code === "ENOENT") {
      job.error = "the `claude` CLI isn't on this server's PATH — start the GUI from a terminal where `claude` runs";
    } else if (err.killed) {
      job.error = `atomize timed out after ${ATOMIZE_TIMEOUT_MS / 60000} min`;
    } else {
      job.error = `atomize failed: ${(err.stderr || err.message || "unknown").slice(0, 400)}`;
    }
    job.slugs = listSlugs().filter((s) => !before.has(s)); // link a partial scaffold if one appeared
  }
  job.finishedAt = Date.now();
  draining = false;
  void drain(); // next queued job
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
      res.end(PAGE);
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/queue") {
      const pieces = await listPieces();
      json(res, 200, { pieces, pending: pieces.reduce((n, p) => n + p.pending, 0) });
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
      try {
        const body = await reviseDerivative(String(b.slug ?? ""), String(b.id ?? ""), String(b.instruction ?? ""));
        json(res, 200, { ok: true, body });
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

// ── the page (self-contained, no build step, no external requests) ──────────────────────────
const PAGE = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Review queue</title>
<style>
  :root {
    --paper:#faf8f3; --ink:#1c1a17; --muted:#7a7266; --line:#e7e1d6; --card:#fffdf8;
    --green:#2f7d46; --green-bg:#e7f2ea; --amber:#9a6b12; --amber-bg:#f7efdc;
    --red:#9a2f2f; --red-bg:#f6e6e3; --blue:#2f5d9a; --blue-bg:#e6ecf5; --accent:#1c1a17;
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--paper); color:var(--ink);
    font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
  header { position:sticky; top:0; z-index:5; background:rgba(250,248,243,.92);
    backdrop-filter:blur(8px); border-bottom:1px solid var(--line); padding:14px 22px;
    display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
  h1 { font:600 17px/1.2 Georgia,"Times New Roman",serif; margin:0; letter-spacing:.2px; }
  .count { background:var(--accent); color:var(--paper); border-radius:20px; padding:2px 11px;
    font-size:13px; font-weight:600; }
  .grow { flex:1; }
  label.toggle { font-size:13px; color:var(--muted); display:flex; align-items:center; gap:6px; cursor:pointer; }
  button { font:inherit; cursor:pointer; border:1px solid var(--line); background:var(--card);
    color:var(--ink); border-radius:7px; padding:6px 12px; transition:.12s; }
  button:hover { border-color:var(--muted); }
  button:disabled { opacity:.4; cursor:default; }
  main { max-width:860px; margin:0 auto; padding:22px 22px 120px; }
  .piece { margin:26px 0 8px; }
  .piece > h2 { font:600 15px/1.3 Georgia,serif; margin:0 0 2px; }
  .piece > .slug { color:var(--muted); font-size:12px; margin-bottom:12px; }
  .row { background:var(--card); border:1px solid var(--line); border-radius:11px;
    padding:14px 16px; margin:10px 0; box-shadow:0 1px 0 rgba(0,0,0,.02); }
  .row.decided { opacity:.62; }
  .rowhead { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:9px; }
  .badge { font-size:11px; font-weight:700; letter-spacing:.4px; text-transform:uppercase;
    padding:2px 8px; border-radius:5px; background:#efeae0; color:#5a5346; }
  .badge.x{background:#e9edf2;color:#2c3e50}.badge.linkedin{background:#e4ecf5;color:#1c4e8a}
  .badge.bluesky{background:#e3eefb;color:#1f6fd6}.badge.tiktok{background:#f0e9f2;color:#5a2c66}
  .badge.quote-card{background:#f3ecdf;color:#7a5a1c}.badge.video-script,.badge.youtube{background:#f6e3e1;color:#9a2f2f}
  .fmt { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.4px; }
  .pill { font-size:11px; font-weight:700; padding:2px 9px; border-radius:20px; margin-left:auto; }
  .pill.approve{background:var(--green-bg);color:var(--green)}
  .pill.revise{background:var(--amber-bg);color:var(--amber)}
  .pill.discard{background:#eee;color:var(--muted)}
  .pill.published{background:var(--blue-bg);color:var(--blue)}
  .pill.blocked{background:var(--red-bg);color:var(--red)}
  .pill.needs{background:#efe9db;color:#8a6d1e}
  .spin { font-size:11px; background:#efeafd; color:#5b46b8; padding:2px 8px; border-radius:5px; font-weight:600; }
  .thread-pass { font-size:11px; background:var(--green-bg); color:var(--green); padding:2px 8px; border-radius:5px; font-weight:600; }
  .thread-missing { font-size:11px; background:var(--amber-bg); color:var(--amber); padding:2px 8px; border-radius:5px; font-weight:600; }
  .origin { font-size:11px; background:#e9e5da; color:#6b6355; padding:2px 8px; border-radius:5px; font-weight:600; }
  .src { font-size:11px; color:var(--muted); }
  .body { white-space:pre-wrap; font-size:14.5px; line-height:1.6; margin:4px 0 6px;
    padding:11px 13px; background:var(--paper); border:1px solid var(--line); border-radius:8px; }
  .body.story { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12.5px; color:#4a453c; max-height:260px; overflow:auto; }
  textarea { width:100%; min-height:120px; font:14.5px/1.6 inherit; padding:11px 13px;
    border:1px solid var(--muted); border-radius:8px; background:#fff; resize:vertical; }
  img.preview { max-width:340px; width:100%; border-radius:8px; border:1px solid var(--line); display:block; }
  video.preview { max-width:340px; width:100%; border-radius:8px; border:1px solid var(--line); display:block; }
  .notes { font-size:12.5px; color:var(--amber); margin:4px 0 0; }
  .approve-blocked { font-size:12.5px; color:var(--red); margin:4px 0 0; font-weight:600; }
  .scheduled { font-size:12.5px; color:var(--green); font-weight:600; margin:4px 0 0; }
  .recon-ok { font-size:12.5px; color:var(--green); font-weight:600; margin:4px 0 0; }
  .recon-mismatch { font-size:12.5px; color:var(--red); font-weight:600; margin:4px 0 0; }
  .recon-unknown { font-size:12.5px; color:var(--muted); margin:4px 0 0; }
  .actions { display:flex; gap:7px; margin-top:11px; flex-wrap:wrap; align-items:center; }
  .actions .spacer { flex:1; }
  button.approve{border-color:var(--green);color:var(--green)}
  button.approve.on{background:var(--green);color:#fff}
  button.revise{border-color:var(--amber);color:var(--amber)}
  button.revise.on{background:var(--amber);color:#fff}
  button.discard.on{background:#6b6459;color:#fff;border-color:#6b6459}
  button.save{border-color:var(--accent);background:var(--accent);color:var(--paper)}
  .empty { text-align:center; color:var(--muted); padding:60px 20px; }
  .revisebox { margin-top:9px; display:none; gap:7px; }
  .revisebox.show { display:flex; }
  .revisebox input { flex:1; font:inherit; padding:7px 10px; border:1px solid var(--muted); border-radius:7px; }
  button.ai { border-color:#5b46b8; color:#5b46b8; }
  button.ai:hover { background:#efeafd; }
  .aibox { margin-top:9px; display:none; gap:7px; }
  .aibox.show { display:flex; }
  .aibox input { flex:1; font:inherit; padding:7px 10px; border:1px solid #5b46b8; border-radius:7px; }
  .aibox button.send { border-color:#5b46b8; background:#5b46b8; color:#fff; }
  .thinking { font-size:13px; color:#5b46b8; font-weight:600; padding:4px 0; }
  nav.tabs { display:flex; gap:5px; }
  .tab { border:1px solid var(--line); background:var(--card); border-radius:8px; padding:6px 14px;
    font-weight:600; color:var(--muted); display:flex; align-items:center; gap:7px; }
  .tab.on { background:var(--accent); color:var(--paper); border-color:var(--accent); }
  .tab.on .count { background:var(--paper); color:var(--accent); }
  .view[hidden] { display:none; }
  .ingest { max-width:820px; margin:0 auto; }
  .ingest textarea { width:100%; min-height:130px; font:15px/1.6 inherit; padding:13px 15px;
    border:1px solid var(--muted); border-radius:10px; background:#fff; resize:vertical; }
  .ingest-actions { display:flex; gap:9px; align-items:center; margin-top:11px; flex-wrap:wrap; }
  button.primary { background:var(--accent); color:var(--paper); border-color:var(--accent); font-weight:600; }
  .hint { font-size:12px; color:var(--muted); flex:1; min-width:220px; line-height:1.4; }
  .notes-panel { max-width:820px; margin:16px auto 0; background:var(--card); border:1px solid var(--line);
    border-radius:10px; padding:14px 16px; }
  .notes-head { display:flex; align-items:center; gap:12px; margin-bottom:8px; flex-wrap:wrap; }
  .notes-head h3 { font:600 14px/1.3 Georgia,serif; margin:0; }
  .notelist { max-height:420px; overflow:auto; }
  .notepick { display:flex; align-items:flex-start; gap:10px; padding:9px 4px; border-bottom:1px solid var(--line); }
  .notepick:last-child { border-bottom:none; }
  .notepick.drafted { opacity:.5; }
  .notepick input[type=checkbox] { margin-top:3px; flex:0 0 auto; }
  .notepick .ntext { flex:1; min-width:0; font-size:13.5px; line-height:1.45; }
  .notepick .nmeta { font-size:11.5px; color:var(--muted); margin-bottom:2px; }
  .notepick .nmeta .drafted-tag { color:var(--blue); font-weight:600; }
  .notes-actions { display:flex; gap:9px; align-items:center; margin-top:12px; flex-wrap:wrap; }
  .strategy { max-width:820px; margin:0 auto; }
  .strategy-actions { display:flex; gap:9px; align-items:center; margin-bottom:6px; flex-wrap:wrap; }
  .md { font-size:14px; line-height:1.6; }
  .md h1,.md h2,.md h3 { font-family:Georgia,"Times New Roman",serif; margin:16px 0 6px; }
  .md h1 { font-size:18px; } .md h2 { font-size:15.5px; } .md h3 { font-size:14px; }
  .md h1:first-child,.md h2:first-child,.md h3:first-child { margin-top:0; }
  .md p { margin:7px 0; }
  .md ul { margin:5px 0 10px 20px; padding:0; }
  .md li { margin:3px 0; }
  .md table { border-collapse:collapse; width:100%; margin:9px 0; font-size:12.5px; }
  .md th,.md td { border:1px solid var(--line); padding:5px 9px; text-align:left; vertical-align:top; }
  .md th { background:#f1ede3; font-weight:700; }
  .md code { background:#efeae0; padding:1px 5px; border-radius:4px; font-size:12px; }
  .insights-panel { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:14px 16px; margin-top:12px; }
  .thread-turn { margin-top:10px; padding-top:10px; border-top:1px solid var(--line); }
  .thread-turn.q { font-weight:600; color:var(--muted); font-size:13.5px; border-top:none; padding-top:0; }
  .jobs { max-width:820px; margin:24px auto 0; }
  .jobs > h3 { font:600 13px/1.3 Georgia,serif; color:var(--muted); margin:0 0 8px; text-transform:uppercase; letter-spacing:.5px; }
  .job { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:12px 15px;
    margin:9px 0; display:flex; align-items:center; gap:12px; }
  .job .jlabel { flex:1; min-width:0; font-size:14px; }
  .job .jlabel .txt { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:block; }
  .job .jkind { font-size:11px; text-transform:uppercase; letter-spacing:.4px; color:var(--muted); }
  .job .jerr { color:var(--red); font-size:12.5px; white-space:normal; margin-top:3px; }
  .job a.jump { font-size:12.5px; color:var(--blue); text-decoration:none; font-weight:600; }
  .spin-dot { width:9px; height:9px; border-radius:50%; background:var(--amber); flex:0 0 auto;
    animation:pulse 1s ease-in-out infinite; }
  @keyframes pulse { 0%,100%{opacity:.3} 50%{opacity:1} }
  .flash { position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:var(--accent);
    color:var(--paper); padding:9px 16px; border-radius:8px; font-size:13px; opacity:0;
    transition:.2s; pointer-events:none; }
  .flash.show { opacity:1; }
  .worktree-banner { background:var(--red-bg); color:var(--red); font-size:12.5px; font-weight:600;
    text-align:center; padding:6px 16px; border-bottom:1px solid var(--red); }
</style>
</head>
<body>
${IS_DEV_WORKTREE ? `<div class="worktree-banner">⚠ Dev worktree checkout (${repoRoot}) — data/content here is isolated and gitignored, not synced with your main repo. Numbers may look empty/stale even when your real pipeline is fine.</div>` : ""}
<header>
  <h1>Content studio</h1>
  <nav class="tabs">
    <button class="tab on" data-tab="ingest">Add / Queue</button>
    <button class="tab" data-tab="review">Review <span class="count" id="count">0</span></button>
    <button class="tab" data-tab="strategy">Analytics</button>
  </nav>
  <span class="grow"></span>
  <label class="toggle" id="decidedWrap"><input type="checkbox" id="showDecided" /> show published / discarded</label>
  <button id="refresh">Refresh</button>
</header>
<main>
  <section class="view" id="ingestView">
    <div class="ingest">
      <textarea id="src" placeholder="Paste an idea, a file path to an Obsidian note, or a Substack URL, then Add to queue. (⌘/Ctrl+Enter)"></textarea>
      <div class="ingest-actions">
        <button class="primary" id="addBtn">Add to queue</button>
        <button id="notesBtn">Browse Substack Notes</button>
        <span class="hint">One source per add. Claude drafts it on your subscription ($0), one at a time, so keep adding while it works. LinkedIn/X posts aren't re-importable; paste the text to expand one.</span>
      </div>
    </div>
    <div class="notes-panel" id="notesPanel" hidden>
      <div class="notes-head">
        <h3>Substack Notes</h3>
        <label class="toggle"><input type="checkbox" id="notesShowDrafted" /> show already drafted</label>
        <span class="grow"></span>
        <button id="notesCloseBtn">Close</button>
      </div>
      <div class="notelist" id="notesList"><div class="empty">Loading…</div></div>
      <div class="notes-actions">
        <button class="primary" id="notesDraftBtn">Draft selected</button>
        <span class="hint">Pick the notes worth cross-posting. Draft selected scaffolds a folder per note and runs the normal atomize pipeline (tag, route, draft, validate, queue) — nothing publishes without your review.</span>
      </div>
    </div>
    <div class="jobs" id="jobs"></div>
  </section>
  <section class="view" id="reviewView" hidden>
    <div id="reviewMain"><div class="empty">Loading…</div></div>
  </section>
  <section class="view" id="strategyView" hidden>
    <div class="strategy">
      <div class="strategy-actions">
        <button class="primary" id="insightsBtn">Generate insights</button>
        <span class="hint">Runs the analytics reports, then asks Claude (your subscription, $0) for a short skim: what's working, what's not, the numbers that matter. Nothing here writes data or publishes anything.</span>
      </div>
      <div class="insights-panel" id="insightsPanel" hidden>
        <div class="md" id="insightsOut"></div>
        <div id="insightsThread"></div>
        <div class="aibox show">
          <input placeholder="ask a follow-up… (e.g. why is X underperforming?)" id="insightsAskInput" />
          <button class="send" id="insightsAskBtn">Ask</button>
        </div>
      </div>
    </div>
    <div class="notes-panel">
      <div class="notes-head">
        <h3>Latest strategy brief</h3>
        <span class="grow"></span>
        <span class="src" id="briefPath"></span>
      </div>
      <div class="md" id="briefBody">Loading…</div>
      <div class="aibox show">
        <input placeholder="tell Claude what to change in the brief…" id="briefAskInput" />
        <button class="send" id="briefAskBtn">Send to Claude</button>
      </div>
      <span class="hint">Edits land in the brief file itself — /atomize and /strategy already read the latest brief every run, so a change here feeds forward with no extra step.</span>
    </div>
    <div class="notes-panel">
      <div class="notes-head">
        <h3>Raw downloaded exports</h3>
        <span class="grow"></span>
        <button id="rawRefreshBtn">Refresh</button>
      </div>
      <div id="rawList"><div class="empty">Loading…</div></div>
      <span class="hint">The actual CSV/JSON/XLSX files pulled from each platform (data/inbox = not yet ingested, data/processed = archived after npm run ingest) — open one yourself if you want to read the raw numbers rather than a computed report.</span>
    </div>
  </section>
</main>
<div class="flash" id="flash"></div>
<script>
const $ = (s, r=document) => r.querySelector(s);
let DATA = { pieces: [], pending: 0 };
let showDecided = false;
const DECIDED = new Set(["published","discard"]);

function flash(msg){ const f=$("#flash"); f.textContent=msg; f.classList.add("show"); setTimeout(()=>f.classList.remove("show"),1400); }
function esc(s){ return (s??"").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

async function load(){
  const r = await fetch("/api/queue"); DATA = await r.json();
  render();
}
async function post(path, body){
  const r = await fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  return r.json();
}

function statusLabel(s){ return s ? s : "needs"; }
function pillClass(s){ return s && ["approve","revise","discard","published","blocked"].includes(s) ? s : "needs"; }

function rowEl(piece, row){
  const el = document.createElement("div");
  const decided = DECIDED.has(row.status);
  el.className = "row" + (decided ? " decided" : "");
  el.dataset.id = row.id;

  const spin = row.spin ? '<span class="spin">spin · '+esc(row.angle||"")+'</span>' : "";
  const src = row.sourceLines ? '<span class="src">lines '+esc(JSON.stringify(row.sourceLines))+'</span>' : "";
  const thread = row.threadCheck === "missing"
    ? '<span class="thread-missing">thread: missing'+(row.threadSpinApplied?" · spin-drafted":"")+'</span>'
    : row.threadCheck === "pass"
    ? '<span class="thread-pass">thread: pass</span>'
    : "";
  // Origin source-tag (Muxin, 2026-07-04): which pipeline created this row. Omitted (not guessed)
  // for a row written before this field existed — see src/publish/queue.ts QUEUE_ORIGINS.
  const origin = row.origin ? '<span class="origin">'+esc(row.origin)+'</span>' : "";
  let preview = "";
  if (row.assetUrl && row.kind === "image") preview = '<img class="preview" src="'+row.assetUrl+'" alt="card" />';
  else if (row.assetUrl && row.kind === "video") preview = '<video class="preview" src="'+row.assetUrl+'" controls muted></video>';
  if (row.body !== undefined && row.body !== "") {
    const cls = row.kind === "storyboard" ? "body story" : "body";
    preview += '<div class="'+cls+'" data-body>'+esc(row.body)+'</div>';
  }
  if (!preview) preview = '<div class="src">— no asset generated yet —</div>';

  const notes = row.notes && row.notes.trim() ? '<div class="notes">note: '+esc(row.notes)+'</div>' : "";
  const sched = row.scheduledWhen ? '<div class="scheduled">✓ scheduled · '+esc(row.scheduledWhen)+'</div>' : "";
  // Live reconciliation against the real provider (Typefully/PostPeer) — the authoritative check,
  // unlike sched above which is just what the client remembers asking for at approve-time.
  const recon = row.reconciled;
  let reconHtml = "";
  if (recon && recon.state === "scheduled") {
    reconHtml = '<div class="recon-ok">✓ live at '+esc(recon.provider)+(recon.when ? ' · '+esc(recon.when) : '')+'</div>';
  } else if (recon && recon.state === "mismatch") {
    reconHtml = '<div class="recon-mismatch">⚠ not found at '+esc(recon.provider)+' — '+esc(recon.reason||"mismatch")+'</div>';
  } else if (recon && recon.state === "unavailable") {
    reconHtml = '<div class="recon-unknown">provider check unavailable ('+esc(recon.provider)+') — '+esc(recon.reason||"")+'</div>';
  }
  const manual = row.manualComment ? '<div class="notes">↳ add as first comment in Typefully: '+esc(row.manualComment)+'</div>' : "";
  const editBtn = row.editable ? '<button data-act="edit">Edit</button>' : "";
  const aiBtn = row.revisable ? '<button class="ai" data-act="ai">✨ Ask Claude</button>' : "";
  const schedulable = ["x","linkedin","bluesky"].includes(row.platform);
  const approveLabel = schedulable ? "Approve → schedule" : "Approve";
  // Keep warning + disabled state even once status is "approve" — that's the phantom-approval
  // case (hand-edited row, or the asset removed after a valid approval) this guard exists to catch.
  const approveDisabled = !!row.approveBlocked;
  const blockedNote = approveDisabled ? '<div class="approve-blocked">⚠ '+esc(row.approveBlocked)+'</div>' : "";

  el.innerHTML =
    '<div class="rowhead">'+
      '<span class="badge '+esc(row.platform.split(":")[0])+'">'+esc(row.platform)+'</span>'+
      '<span class="fmt">'+esc(row.format)+' · '+esc(row.id)+'</span>'+ spin + thread + origin + src +
      '<span class="pill '+pillClass(row.status)+'">'+esc(statusLabel(row.status))+'</span>'+
    '</div>'+
    preview + notes + sched + reconHtml + manual + blockedNote +
    '<div class="actions">'+
      '<button class="approve'+(row.status==="approve"?" on":"")+'" data-act="approve"'+
        (approveDisabled ? ' disabled title="'+esc(row.approveBlocked)+'"' : "")+'>'+approveLabel+'</button>'+
      '<button class="revise'+(row.status==="revise"?" on":"")+'" data-act="revise">Revise</button>'+
      '<button class="discard'+(row.status==="discard"?" on":"")+'" data-act="discard">Discard</button>'+
      '<span class="spacer"></span>'+ editBtn + aiBtn +
    '</div>'+
    '<div class="revisebox"><input placeholder="what needs changing?" value="'+esc(row.notes||"")+'" /><button data-act="save-note">Save note</button></div>'+
    '<div class="aibox"><input placeholder="tell Claude what to change…" /><button class="send" data-act="ai-send">Send to Claude</button></div>';

  el.addEventListener("click", (e)=>onAction(e, piece, row, el));
  return el;
}

async function onAction(e, piece, row, el){
  const act = e.target.dataset.act; if(!act) return;
  if (act === "approve" || act === "discard"){
    e.target.disabled = true;
    const r = await post("/api/status",{slug:piece.slug,id:row.id,status:act});
    if (act === "approve"){
      if (r.ok === false){ flash(r.error || "Approve blocked"); }
      else if (r.scheduled){
        row.status="published"; row.scheduledWhen=r.scheduled.when; row.manualComment=r.scheduled.manualComment||"";
        // A YouTube Short with no "youtube" cadence configured uploads PRIVATE instead of on a real
        // publish schedule (see publishShorts) — flag that distinctly instead of a generic "Scheduled"
        // that reads the same as an actually-scheduled post.
        flash(r.scheduled.autoPublishes === false ? "Uploaded (still PRIVATE — flip it manually in YouTube Studio) · "+r.scheduled.when : "Scheduled · "+r.scheduled.when);
      }
      else if (r.scheduleError){ row.status="approve"; flash("Approved — schedule failed: "+r.scheduleError); }
      else { row.status="approve"; flash("Approved"); }
    } else { row.status="discard"; flash("Discarded"); }
    rerender();
  } else if (act === "revise"){
    el.querySelector(".revisebox").classList.toggle("show");
  } else if (act === "save-note"){
    const note = el.querySelector(".revisebox input").value;
    await post("/api/status",{slug:piece.slug,id:row.id,status:"revise",notes:note});
    row.status="revise"; row.notes=note; flash("Marked revise"); rerender();
  } else if (act === "edit"){
    const bodyEl = el.querySelector("[data-body]"); if(!bodyEl) return;
    const ta = document.createElement("textarea"); ta.value = row.body;
    bodyEl.replaceWith(ta);
    e.target.textContent = "Save"; e.target.dataset.act = "save-body";
  } else if (act === "save-body"){
    const ta = el.querySelector("textarea"); if(!ta) return;
    await post("/api/derivative",{slug:piece.slug,id:row.id,body:ta.value});
    row.body = ta.value.trim(); flash("Saved"); rerender();
  } else if (act === "ai"){
    const box = el.querySelector(".aibox"); box.classList.toggle("show");
    const inp = el.querySelector(".aibox input"); if(inp && box.classList.contains("show")) inp.focus();
  } else if (act === "ai-send"){
    const inp = el.querySelector(".aibox input"); const instruction = inp ? inp.value.trim() : "";
    if(!instruction){ flash("Type what you want changed first"); return; }
    el.querySelector(".aibox").innerHTML = '<div class="thinking">✨ Claude is revising… (your subscription, ~10-30s)</div>';
    const r = await post("/api/revise",{slug:piece.slug,id:row.id,instruction});
    if(r.ok){ row.body = r.body; flash("Revised by Claude"); }
    else { flash("Revise failed: "+(r.error||"error")); }
    rerender();
  }
}

let rerenderScheduled=false;
function rerender(){ if(rerenderScheduled) return; rerenderScheduled=true; requestAnimationFrame(()=>{rerenderScheduled=false; render();}); }

function render(){
  const main = $("#reviewMain"); main.innerHTML = "";
  let shown = 0, pending = 0;
  for (const piece of DATA.pieces){
    const rows = piece.rows.filter(r => showDecided || !DECIDED.has(r.status));
    pending += piece.rows.filter(r=>!DECIDED.has(r.status)).length;
    if (!rows.length) continue;
    shown += rows.length;
    const sec = document.createElement("section"); sec.className = "piece";
    sec.innerHTML = '<h2>'+esc(piece.title)+'</h2><div class="slug">'+esc(piece.slug)+'</div>';
    for (const row of rows) sec.appendChild(rowEl(piece, row));
    main.appendChild(sec);
  }
  $("#count").textContent = pending + " pending";
  if (!shown) main.innerHTML = '<div class="empty">Nothing '+(showDecided?"here yet":"awaiting review")+'. 🎉</div>';
}

// ── tabs ──
function setTab(t){
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("on", b.dataset.tab===t));
  $("#ingestView").hidden = t!=="ingest";
  $("#reviewView").hidden = t!=="review";
  $("#strategyView").hidden = t!=="strategy";
  $("#decidedWrap").style.display = t==="review" ? "" : "none";
  if (t==="strategy" && !briefLoaded){ loadBrief(); loadRaw(); }
}
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click", ()=>setTab(b.dataset.tab)));

// ── Analytics & Strategy ──

// Minimal markdown -> HTML for the brief + Claude's synthesis: headers, tables, bullet lists,
// bold/code, paragraphs. Not a full CommonMark parser, just enough for the content this pipeline
// itself generates. Escapes first, so no raw HTML from a derivative/brief ever executes.
function mdToHtml(md){
  const inline = s => esc(s).replace(/\\*\\*(.+?)\\*\\*/g, "<b>$1</b>").replace(/\`([^\`]+)\`/g, "<code>$1</code>");
  const isTableRow = l => /^\\s*\\|.*\\|\\s*$/.test(l);
  const isSepRow = l => /^[\\s|:-]+$/.test(l) && l.includes("-");
  const cellsOf = l => l.trim().replace(/^\\|/,"").replace(/\\|$/,"").split("|").map(c=>c.trim());
  const lines = md.split("\\n");
  let html = "", i = 0, inList = false;
  const closeList = () => { if(inList){ html += "</ul>"; inList = false; } };
  while(i < lines.length){
    const line = lines[i];
    const h = line.match(/^(#{1,6})\\s+(.*)$/);
    if(h){ closeList(); const lvl = h[1].length; html += "<h"+lvl+">"+inline(h[2])+"</h"+lvl+">"; i++; continue; }
    if(isTableRow(line)){
      closeList();
      const rows = [];
      while(i < lines.length && isTableRow(lines[i])){ rows.push(lines[i]); i++; }
      let head = null, body = rows;
      if(rows.length > 1 && isSepRow(rows[1])){ head = cellsOf(rows[0]); body = rows.slice(2); }
      html += "<table>";
      if(head) html += "<tr>"+head.map(c=>"<th>"+inline(c)+"</th>").join("")+"</tr>";
      for(const r of body){ if(isSepRow(r)) continue; html += "<tr>"+cellsOf(r).map(c=>"<td>"+inline(c)+"</td>").join("")+"</tr>"; }
      html += "</table>";
      continue;
    }
    if(/^\\s*[-*]\\s+/.test(line)){
      if(!inList){ html += "<ul>"; inList = true; }
      html += "<li>"+inline(line.replace(/^\\s*[-*]\\s+/,""))+"</li>";
      i++; continue;
    }
    closeList();
    if(line.trim() === ""){ i++; continue; }
    html += "<p>"+inline(line)+"</p>";
    i++;
  }
  closeList();
  return html;
}

let briefLoaded = false;
async function loadBrief(){
  briefLoaded = true;
  const r = await fetch("/api/strategy/brief"); const d = await r.json();
  if(!d.ok){ $("#briefBody").textContent = d.error; $("#briefPath").textContent = ""; return; }
  $("#briefBody").innerHTML = mdToHtml(d.content);
  $("#briefPath").textContent = d.path;
}
async function askBrief(){
  const inp = $("#briefAskInput"); const instruction = inp.value.trim();
  if(!instruction){ flash("Type what you want changed first"); return; }
  $("#briefAskBtn").disabled = true;
  const prevHtml = $("#briefBody").innerHTML;
  $("#briefBody").textContent = "✨ Claude is revising the brief… (your subscription, ~10-30s)";
  const r = await post("/api/strategy/ask", {instruction});
  $("#briefAskBtn").disabled = false;
  if(r.ok){ $("#briefBody").innerHTML = mdToHtml(r.content); $("#briefPath").textContent = r.path; inp.value = ""; flash("Brief revised by Claude"); }
  else { $("#briefBody").innerHTML = prevHtml; flash("Revise failed: "+(r.error||"error")); }
}
$("#briefAskBtn").addEventListener("click", askBrief);

// Insights: a Claude-written synthesis (not a raw report dump), plus a follow-up chat thread that
// can ask Claude to dig into anything — Claude may re-run the reports itself to answer.
let insightsHistory = [];
async function generateInsights(){
  $("#insightsBtn").disabled = true;
  $("#insightsPanel").hidden = false;
  insightsHistory = [];
  $("#insightsThread").innerHTML = "";
  $("#insightsOut").innerHTML = '<p class="hint">Running the reports, then asking Claude for a synthesis… (~20-40s)</p>';
  const r = await post("/api/strategy/insights", {});
  $("#insightsBtn").disabled = false;
  if(r.ok){ $("#insightsOut").innerHTML = mdToHtml(r.summary); insightsHistory = [{role:"assistant", content:r.summary}]; }
  else { $("#insightsOut").innerHTML = "<p>Failed: "+esc(r.error||"error")+"</p>"; }
}
$("#insightsBtn").addEventListener("click", generateInsights);

function renderThread(){
  const box = $("#insightsThread"); box.innerHTML = "";
  for(const h of insightsHistory.slice(1)){ // [0] is the initial summary, already shown above
    const el = document.createElement("div");
    el.className = "thread-turn" + (h.role === "user" ? " q" : "");
    el.innerHTML = h.role === "user" ? "You asked: "+esc(h.content) : mdToHtml(h.content);
    box.appendChild(el);
  }
}
async function askInsights(){
  const inp = $("#insightsAskInput"); const q = inp.value.trim();
  if(!q){ flash("Ask something first"); return; }
  if(!insightsHistory.length){ flash("Generate insights first"); return; }
  $("#insightsAskBtn").disabled = true;
  insightsHistory.push({role:"user", content:q});
  inp.value = "";
  renderThread();
  const thinking = document.createElement("div");
  thinking.className = "thinking"; thinking.textContent = "✨ Claude is looking into it… (~10-60s, may re-run a report)";
  $("#insightsThread").appendChild(thinking);
  const r = await post("/api/strategy/ask-insights", {question:q, history:insightsHistory});
  $("#insightsAskBtn").disabled = false;
  insightsHistory.push({role:"assistant", content: r.ok ? r.answer : "Failed: "+(r.error||"error")});
  renderThread();
}
$("#insightsAskBtn").addEventListener("click", askInsights);

// Raw downloaded exports — the actual files, not a computed report.
async function loadRaw(){
  const box = $("#rawList");
  box.innerHTML = '<div class="empty">Loading…</div>';
  const r = await fetch("/api/strategy/raw"); const d = await r.json();
  if(!d.files || !d.files.length){ box.innerHTML = '<div class="empty">No raw exports found in data/inbox or data/processed on this checkout.</div>'; return; }
  box.innerHTML = "";
  for(const f of d.files){
    const el = document.createElement("div"); el.className = "notepick";
    const kb = (f.size/1024).toFixed(1);
    const when = new Date(f.mtime).toISOString().slice(0,10);
    el.innerHTML = '<div class="ntext"><div class="nmeta">'+when+' · '+kb+' KB</div>'+
      '<a href="/api/strategy/raw-file?path='+encodeURIComponent(f.path)+'" target="_blank">'+esc(f.path)+'</a></div>';
    box.appendChild(el);
  }
}
$("#rawRefreshBtn").addEventListener("click", loadRaw);

// ── ingest + job queue ──
let JOBS = [];
function jobPill(s){ return s==="done"?"published":s==="failed"?"blocked":s==="running"?"revise":"needs"; }
function jobStatusText(s){ return s==="running"?"working…":s; }
function renderJobs(){
  const box = $("#jobs"); box.innerHTML = "";
  if(!JOBS.length){ box.innerHTML = '<div class="empty" style="padding:34px">Nothing queued yet. Drop an idea above. 🌱</div>'; return; }
  box.innerHTML = '<h3>Queue</h3>';
  for(const j of [...JOBS].reverse()){
    const el = document.createElement("div"); el.className = "job";
    const dot = j.status==="running" ? '<span class="spin-dot"></span>' : "";
    const err = j.error ? '<div class="jerr">'+esc(j.error)+'</div>' : "";
    let right = '<span class="pill '+jobPill(j.status)+'">'+esc(jobStatusText(j.status))+'</span>';
    if(j.status==="done" && j.slugs && j.slugs.length){
      right = '<a class="jump" href="#" data-slug="'+esc(j.slugs[0])+'">→ review'+(j.slugs.length>1?" "+j.slugs.length+" pieces":"")+'</a>' + right;
    }
    el.innerHTML = dot + '<div class="jlabel"><span class="txt"><span class="jkind">'+esc(j.kind)+'</span> · '+esc(j.label)+'</span>'+err+'</div>' + right;
    box.appendChild(el);
  }
  box.querySelectorAll("a.jump").forEach(a=>a.addEventListener("click",(e)=>{
    e.preventDefault(); setTab("review");
    load().then(()=>{
      const d = [...document.querySelectorAll(".piece .slug")].find(x=>x.textContent===a.dataset.slug);
      if(d) d.scrollIntoView({behavior:"smooth", block:"start"});
    });
  }));
}
async function loadJobs(){
  try{
    const before = JSON.stringify(JOBS.map(j=>[j.id,j.status]));
    const r = await fetch("/api/jobs"); JOBS = (await r.json()).jobs || [];
    renderJobs();
    if(before !== JSON.stringify(JOBS.map(j=>[j.id,j.status]))) load(); // a job moved → refresh review rows
  }catch(e){}
}
async function addSource(){
  const ta = $("#src"); const source = ta.value.trim();
  if(!source){ flash("Paste something first"); return; }
  $("#addBtn").disabled = true;
  const r = await post("/api/atomize",{source});
  $("#addBtn").disabled = false;
  if(r.ok){ ta.value=""; flash("Queued — Claude is drafting"); loadJobs(); }
  else flash(r.error || "Could not queue");
}
// ── Substack Notes checklist (manual pick, replaces the old one-click "Pull Substack Notes") ──
let NOTES = [];
let notesShowDrafted = false;
function noteMeta(n){
  const d = n.publishedAt ? n.publishedAt.slice(0,10) : "????-??-??";
  const tag = n.drafted ? ' <span class="drafted-tag">already drafted</span>' : "";
  return d+' · eng '+n.eng+' (♥'+n.likes+' ↻'+n.reposts+' 💬'+n.replies+')'+tag;
}
function renderNotes(){
  const box = $("#notesList");
  const visible = NOTES.filter(n => notesShowDrafted || !n.drafted);
  if(!visible.length){ box.innerHTML = '<div class="empty">'+(NOTES.length? "All notes are already drafted." : "No notes found.")+'</div>'; return; }
  box.innerHTML = "";
  for(const n of visible){
    const el = document.createElement("label");
    el.className = "notepick" + (n.drafted ? " drafted" : "");
    el.innerHTML = '<input type="checkbox" data-idx="'+n.idx+'" '+(n.drafted?"disabled":"")+'>'+
      '<div class="ntext"><div class="nmeta">'+noteMeta(n)+'</div>'+esc(n.text.replace(/\\s+/g," ").slice(0,220))+'</div>';
    box.appendChild(el);
  }
}
async function openNotes(){
  $("#notesPanel").hidden = false;
  $("#notesList").innerHTML = '<div class="empty">Loading…</div>';
  const r = await fetch("/api/notes");
  const data = await r.json();
  if(!data.ok){ $("#notesList").innerHTML = '<div class="empty">'+esc(data.error||"Failed to load notes")+'</div>'; return; }
  NOTES = data.notes;
  renderNotes();
}
async function draftSelectedNotes(){
  const indices = [...document.querySelectorAll('#notesList input[type=checkbox]:checked')].map(cb=>Number(cb.dataset.idx));
  if(!indices.length){ flash("Pick at least one note"); return; }
  $("#notesDraftBtn").disabled = true;
  const r = await post("/api/notes/pick",{indices});
  $("#notesDraftBtn").disabled = false;
  if(r.ok){
    flash(r.jobs.length+" note(s) queued");
    $("#notesPanel").hidden = true;
    loadJobs();
  } else flash(r.error || "Failed");
}
$("#addBtn").addEventListener("click", addSource);
$("#notesBtn").addEventListener("click", openNotes);
$("#notesCloseBtn").addEventListener("click", ()=>{ $("#notesPanel").hidden = true; });
$("#notesShowDrafted").addEventListener("change",(e)=>{ notesShowDrafted = e.target.checked; renderNotes(); });
$("#notesDraftBtn").addEventListener("click", draftSelectedNotes);
$("#src").addEventListener("keydown",(e)=>{ if((e.metaKey||e.ctrlKey)&&e.key==="Enter") addSource(); });
setInterval(()=>{ if(JOBS.some(j=>j.status==="queued"||j.status==="running")) loadJobs(); }, 3000);

$("#refresh").addEventListener("click", ()=>{ load(); loadJobs(); });
$("#showDecided").addEventListener("change", (e)=>{ showDecided = e.target.checked; render(); });
setTab("ingest");
load();
loadJobs();
</script>
</body>
</html>`;
