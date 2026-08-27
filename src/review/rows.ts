// fs/frontmatter read-write for content/<slug> folders — the data layer the review GUI (serve.ts)
// reads through to build each row it shows, and writes through (updateRow/saveDerivative) when
// Muxin approves/revises/edits one in place. Split out of serve.ts (Codebase review Phase 5c).

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { repoRoot } from "../db/db.js";
import { readQueue, writeCell, appendPublishLog, type QueueRow } from "../publish/queue.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { fetchScheduledDrafts, cancelDraft } from "../publish/typefully.js";
import { fetchScheduledPosts, cancelPost } from "../publish/postpeer-status.js";
import { classifyThread } from "../atomize/thread-check.js";
import { listCuts, DEFAULT_LENS } from "../atomize/cuts.js";
import {
  reconcileRow,
  needsReconciliation,
  findLoggedRef,
  type LiveProviderState,
  type ReconciledStatus,
  type PublishLogRead,
} from "./reconcile.js";

export const CONTENT = join(repoRoot, "content");
// Outreach Phase 2 (docs/outreach-engine-plan.md §6): a lead's review-queue.md row surfaces in
// this SAME Review tab, not a second one — a second discovery root, not a second parser.
export const OUTREACH_LEADS = join(repoRoot, "outreach", "leads");

// A row is "decided" once it's out of the review inbox. Everything else needs Muxin's eyes.
// "locked" (an outreach-message row's terminal state — see lock.ts) counts as decided too: it's
// not still awaiting Muxin, just like "published"/"discard".
export const DECIDED = new Set(["published", "discard", "locked"]);
export const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
export const VIDEO_EXT = new Set([".mp4", ".webm", ".mov"]);

type Kind = "text" | "image" | "video" | "storyboard" | "outreach-message" | "unknown";

interface EnrichedRow extends QueueRow {
  kind: Kind;
  body?: string; // derivative text / storyboard text (what a human reads)
  spin?: boolean;
  angle?: string;
  sourceLines?: unknown;
  threadCheck?: string; // "pass" | "missing" — config/platforms.yaml home_brand thread-check
  threadSpinApplied?: boolean; // Spin already drafted the worldview thread in on a "missing" verdict
  replyToText?: string; // "reply to mention" rows (card db22283f) — what the mention/reply said
  assetUrl?: string; // image/video preview URL
  editable: boolean; // can the body be edited-and-saved here?
  revisable: boolean; // has a derivatives/<id>.md that "Revise with Claude" can rewrite
  hasAsset: boolean;
  approveBlocked: string | null; // reason Approve is disabled, if any
  reconciled?: ReconciledStatus; // live Typefully/PostPeer reconciliation — omitted when not applicable
  // "Generate storyboard" button (card 9e20a616): true for a video-script row whose storyboard
  // hasn't been generated yet — the one case Approve is blocked with no way in the GUI to fix it.
  canGenerateStoryboard: boolean;
  // "Duplicate to platform" button (card 9304e4a5's missing "create a post for another platform"
  // affordance): true for any real text derivative — the dropdown itself is scoped to the actual
  // spin-eligible target platforms server-side (duplicateToPlatform / TEXT_PLATFORMS).
  duplicatable: boolean;
}

export interface Piece {
  slug: string;
  title: string;
  rows: EnrichedRow[];
  pending: number;
}

// Resolve a slug to its folder, refusing anything that isn't a real review-queue folder (defends
// the write/asset endpoints against path traversal on a slug from the client). Checks CONTENT
// first (the common case), then OUTREACH_LEADS — collision is a non-issue in practice (content
// slugs are date-prefixed, outreach lead slugs are kind-prefixed, e.g. "client-acme-co").
export function safeFolder(slug: string): string {
  if (!slug || slug.includes("/") || slug.includes("..")) throw new Error("bad slug");
  const contentFolder = join(CONTENT, slug);
  if (existsSync(join(contentFolder, "review-queue.md"))) return contentFolder;
  const outreachFolder = join(OUTREACH_LEADS, slug);
  if (existsSync(join(outreachFolder, "review-queue.md"))) return outreachFolder;
  throw new Error("no such queue");
}

export function firstHeading(folder: string): string {
  try {
    const m = readFileSync(join(folder, "review-queue.md"), "utf8").match(/^#\s+(.+)$/m);
    if (m) return m[1].replace(/^(?:Outreach review queue|Review queue)\s*[—-]\s*/i, "").trim();
  } catch {
    /* fall through to slug */
  }
  return basename(folder).replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/-/g, " ");
}

// A "video-script" row (format=storyboard) drafts video/script-draft.md long before /video turns
// it into video/storyboard.md — the one file src/video/render.ts's own render gate trusts. Approving
// off the draft alone is a phantom approval: it means nothing to render.ts and misrepresents review
// as having happened. Same risk for "video"/"short" rows (animated quote-videos, /video's rendered
// short + its TikTok row — CLAUDE.md backlog card 4bef9a7c) and "image" (quote-card) rows if the row
// lands in review-queue.md before its asset file does — so those are gated on their own `asset` cell
// existing on disk too. `exists` is injected (mirrors classifySource below) so this is unit-testable
// without touching disk.
export function approveBlockReason(
  folder: string,
  row: QueueRow,
  exists: (p: string) => boolean = existsSync,
): string | null {
  if (row.format === "storyboard") {
    return exists(join(folder, "video", "storyboard.md")) ? null : "storyboard not rendered yet. Run /video";
  }
  if (row.format === "video" || row.format === "short") {
    const asset = row.asset && row.asset !== "—" && row.asset !== "-" ? row.asset : "";
    if (!asset) return null; // no known gate file to check
    return exists(join(folder, asset)) ? null : "video not rendered yet. Run /video";
  }
  if (row.format === "image") {
    const asset = row.asset && row.asset !== "—" && row.asset !== "-" ? row.asset : "";
    if (!asset) return null; // no known gate file to check
    return exists(join(folder, asset)) ? null : "image not rendered yet. Run npm run render -- --still <folder>";
  }
  return null;
}

// Server-side enforcement mirror of the `isReply` UI hint inside enrich() below (which only
// drives the revisable/duplicatable button flags — a hint the GUI can choose to render, not a
// gate). serve.ts's /api/revise and /api/duplicate handlers call this BEFORE ever running
// reviseDerivative/duplicateToPlatform, sourced from the row's actual persisted origin (read
// server-side via readQueue), never a client-supplied flag: both of those jobs.ts prompts tell
// Claude the body must "stay traceable to Muxin's source at content/<slug>/source.md", but for a
// "reply to mention" row that file holds the mention author's own untrusted post text, not
// Muxin's writing — and runClaudeSpawn's default permission mode (acceptEdits, full tool access)
// is the opposite of reply-draft.ts's locked-down `--tools ""` spawn for that same untrusted text.
export function replyToMentionBlockReason(row: QueueRow | undefined): string | null {
  if (row?.origin === "reply to mention") {
    return "not available for a reply-to-mention row (its source is the mention author's own post, not Muxin's writing)";
  }
  return null;
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
  else if (row.format === "outreach-message") kind = "outreach-message";

  // "Ask Claude" (revisable) and "Duplicate to platform" (duplicatable, below) both run jobs.ts
  // prompts that tell Claude the body must "stay traceable to Muxin's source at
  // content/<slug>/source.md" — true for every normal atomized row, but NOT for a "reply to
  // mention" row, whose source.md is the mention author's own post, not Muxin's writing. Gate both
  // off for that origin so neither prompt runs against a false premise.
  const isReply = row.origin === "reply to mention";
  const out: EnrichedRow = {
    ...row,
    kind,
    editable: false,
    revisable: !isReply && existsSync(join(folder, "derivatives", `${row.id}.md`)),
    hasAsset: false,
    approveBlocked: approveBlockReason(folder, row),
    reconciled: needsReconciliation(row) ? reconcileRow(row, publishLog, live) : undefined,
    canGenerateStoryboard: kind === "storyboard" && !existsSync(join(folder, "video", "storyboard.md")),
    duplicatable: false, // finalized below, once hasAsset is known
  };
  const assetUrl = (file: string) => `/asset?slug=${encodeURIComponent(slug)}&file=${encodeURIComponent(file)}`;

  const loadMd = (relPath: string) => {
    const p = join(folder, relPath);
    if (!existsSync(p)) return false;
    const { body, fm } = splitFrontmatter(readFileSync(p, "utf8"));
    out.body = body;
    out.spin = fm.spin === true;
    out.angle = typeof fm.angle === "string" ? fm.angle : undefined;
    out.sourceLines = fm.source_lines;
    out.threadCheck = classifyThread(fm);
    out.threadSpinApplied = fm.thread_spin_applied === true;
    out.replyToText = typeof fm.reply_to_text === "string" ? fm.reply_to_text : undefined;
    return true;
  };

  if ((kind === "text" || kind === "video" || kind === "outreach-message") && asset.endsWith(".md")) {
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
  // "Duplicate to platform" only makes sense on a real text post — not an empty draft, and not an
  // asset row (image/video/storyboard) that has no body of its own to re-angle. Also excluded for
  // "reply to mention" rows — see isReply above.
  out.duplicatable = !isReply && kind === "text" && out.hasAsset;
  return out;
}

// Cache of one content folder's parsed review-queue.md rows, keyed by the file's own mtime.
// GET /api/queue used to re-read + re-parse EVERY folder's queue synchronously on every request,
// even when nothing had changed since the last read — this reuses the parsed rows whenever the
// file provably hasn't moved. A write (writeCell/updateRow below) always rewrites the file, which
// always bumps its mtime, so this can never serve stale rows after an edit; it only ever skips the
// reparse when the file is unchanged. `parse` is injected (default = the real readQueue) so a test
// can prove the skip actually happens, without needing to mock the fs module.
const queueCache = new Map<string, { mtimeMs: number; rows: QueueRow[] }>();

export function readQueueCached(
  folder: string,
  parse: (folder: string) => { rows: QueueRow[] } = readQueue,
): QueueRow[] {
  const mtimeMs = statSync(join(folder, "review-queue.md")).mtimeMs;
  const cached = queueCache.get(folder);
  if (cached && cached.mtimeMs === mtimeMs) return cached.rows;
  const rows = parse(folder).rows;
  queueCache.set(folder, { mtimeMs, rows });
  return rows;
}

// The live Typefully/PostPeer state used to reconcile rows, refreshed on a background interval
// instead of being fetched inline on every /api/queue request — a request that needs it just reads
// whatever was last fetched (plus `liveStateAsOf`, so a caller can tell how fresh it is) rather than
// blocking on a network call every time. Polling only starts once something in the queue actually
// needs reconciling (listPieces below), so a checkout with nothing approved never hits either
// provider at all — same as the old inline-fetch gate, just decoupled from the request itself.
const LIVE_STATE_POLL_MS = 60_000;
let liveState: LiveProviderState = { typefullyDrafts: [], postpeerPosts: [] };
let liveStateAsOf: number | null = null;
let livePollTimer: ReturnType<typeof setInterval> | null = null;

async function refreshLiveState(): Promise<void> {
  liveState = await fetchLiveProviderState();
  liveStateAsOf = Date.now();
}

function ensureLiveStatePolling(): void {
  if (livePollTimer) return;
  livePollTimer = setInterval(() => {
    void refreshLiveState();
  }, LIVE_STATE_POLL_MS);
  livePollTimer.unref?.(); // never keep the process alive just for this poll
  void refreshLiveState(); // kick off the first fetch now instead of waiting a full interval
}

// When the live state was last actually fetched from Typefully/PostPeer — null until the first
// fetch lands. Exposed so /api/queue can tell the GUI how stale `reconciled` might be.
export function getLiveStateAsOf(): number | null {
  return liveStateAsOf;
}

// Every folder directly under `root` that carries its own review-queue.md — the one discovery
// rule shared by CONTENT (content/<slug>/) and OUTREACH_LEADS (outreach/leads/<kind>-<slug>/), so
// picking up outreach leads is a second root scanned the same way, not a second parser.
export function listRootFolders(root: string): string[] {
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(root, d.name, "review-queue.md")))
      .map((d) => d.name);
  } catch {
    return [];
  }
}

export async function listPieces(): Promise<Piece[]> {
  const dirs = [
    ...listRootFolders(CONTENT).map((slug) => ({ slug, folder: join(CONTENT, slug) })),
    ...listRootFolders(OUTREACH_LEADS).map((slug) => ({ slug, folder: join(OUTREACH_LEADS, slug) })),
  ];
  // Read every folder's rows up front (sync, no network) so a live Typefully/PostPeer fetch only
  // happens when there's actually an approved row somewhere to reconcile.
  const folderRows = dirs.map(({ slug, folder }) => {
    return { slug, folder, rows: readQueueCached(folder) };
  });
  const anyNeedsReconcile = folderRows.some(({ rows }) => rows.some(needsReconciliation));
  if (anyNeedsReconcile) ensureLiveStatePolling();
  const live: LiveProviderState = anyNeedsReconcile ? liveState : { typefullyDrafts: [], postpeerPosts: [] };

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

// ── Cuts tab (Stage 1 "Proof Sheet" — plan i-want-to-add-mellow-mist) ──
// Renders content/<slug>'s versions side by side BEFORE atomize formats anything per platform —
// the extract lens (never a cuts/ subfolder, see src/atomize/cuts.ts) plus any additional lens's
// cuts/<lens>/cut.md. Comments are anchored to a line within a cut's body, stored in one JSON
// sidecar per folder (not a markdown table row — there's no queue row yet at this stage).

export interface CutComment {
  id: string;
  line: number; // 1-indexed line within the cut's rendered body
  text: string;
  resolved: boolean;
  createdAt: string;
}

export interface CutView {
  lens: string;
  body: string;
  comments: CutComment[];
}

export interface CutSet {
  slug: string;
  title: string;
  cuts: CutView[];
}

function cutCommentsPath(folder: string): string {
  return join(folder, "cut-comments.json");
}

function readCutComments(folder: string): Record<string, CutComment[]> {
  try {
    return JSON.parse(readFileSync(cutCommentsPath(folder), "utf8"));
  } catch {
    return {};
  }
}

function writeCutComments(folder: string, all: Record<string, CutComment[]>): void {
  writeFileSync(cutCommentsPath(folder), JSON.stringify(all, null, 2) + "\n");
}

// A lens is always a slugified name (see src/atomize/cuts.ts's addCut) — this is the one guard
// every cut function below routes `lens` through before it ever reaches a join(), the same
// posture saveDerivative() already takes on its `id` param. Without it, a client-supplied `lens`
// like "../../../secret" would let /api/cut-save write outside the content folder entirely
// (path.join does NOT sandbox ".." segments) — caught in self-vet before this ever shipped.
export function isValidLens(lens: string): boolean {
  return /^[a-z][a-z0-9-]*$/.test(lens);
}

// The extract lens's drafting material is extracts.md (SKILL.md step 3's 5-10 tagged quotable
// lines) — it has no frontmatter, unlike a real cuts/<lens>/cut.md. Returns null when that lens
// hasn't been drafted yet (nothing to show for it in the Cuts tab), or when `lens` isn't a valid
// slug. Exported (folder, not slug) so it's testable against a tmp dir, same as every other pure
// helper in this file.
export function cutBody(folder: string, lens: string): string | null {
  if (!isValidLens(lens)) return null;
  if (lens === DEFAULT_LENS) {
    const p = join(folder, "extracts.md");
    if (!existsSync(p)) return null;
    return readFileSync(p, "utf8");
  }
  const p = join(folder, "cuts", lens, "cut.md");
  if (!existsSync(p)) return null;
  return splitFrontmatter(readFileSync(p, "utf8")).body;
}

// The folder-level core for a piece's cut set — every one of listCutSets()'s slug-resolving calls
// funnels through this. Exported so it's testable against a tmp dir instead of the real content/.
export function cutSetForFolder(folder: string, title: string): CutView[] | null {
  const comments = readCutComments(folder);
  const cuts: CutView[] = [];
  for (const lens of [DEFAULT_LENS, ...listCuts(folder)]) {
    const body = cutBody(folder, lens);
    if (body === null) continue;
    cuts.push({ lens, body, comments: comments[lens] ?? [] });
  }
  return cuts.length ? cuts : null;
}

// Every content folder with at least one drafted cut, for the Cuts tab's list. Outreach leads are
// excluded — cuts are a content-pipeline concept, leads don't have them.
export function listCutSets(): CutSet[] {
  const out: CutSet[] = [];
  for (const slug of listRootFolders(CONTENT)) {
    const folder = join(CONTENT, slug);
    const cuts = cutSetForFolder(folder, slug);
    if (!cuts) continue;
    out.push({ slug, title: firstHeading(folder), cuts });
  }
  out.sort((a, b) => b.slug.localeCompare(a.slug));
  return out;
}

// Save an edited cut body in place — extracts.md is overwritten whole (no frontmatter to
// preserve); a non-default lens's cut.md keeps its frontmatter block byte-for-byte, same pattern
// saveDerivative() uses below. Folder-level core exported for testability.
export function saveCutBodyToFolder(folder: string, lens: string, body: string): void {
  if (!isValidLens(lens)) throw new Error("bad lens");
  if (lens === DEFAULT_LENS) {
    writeFileSync(join(folder, "extracts.md"), body.trim() + "\n");
    return;
  }
  const p = join(folder, "cuts", lens, "cut.md");
  if (!existsSync(p)) throw new Error("no such cut");
  const { header } = splitFrontmatter(readFileSync(p, "utf8"));
  writeFileSync(p, header + body.trim() + "\n");
}

export function saveCutBody(slug: string, lens: string, body: string): void {
  saveCutBodyToFolder(safeFolder(slug), lens, body);
}

export function addCutCommentToFolder(folder: string, lens: string, line: number, text: string): CutComment {
  if (!isValidLens(lens)) throw new Error("bad lens");
  const all = readCutComments(folder);
  const comment: CutComment = {
    id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    line,
    text,
    resolved: false,
    createdAt: new Date().toISOString(),
  };
  all[lens] = [...(all[lens] ?? []), comment];
  writeCutComments(folder, all);
  return comment;
}

export function addCutComment(slug: string, lens: string, line: number, text: string): CutComment {
  return addCutCommentToFolder(safeFolder(slug), lens, line, text);
}

export function resolveCutCommentInFolder(folder: string, lens: string, commentId: string): boolean {
  const all = readCutComments(folder);
  const comment = (all[lens] ?? []).find((c) => c.id === commentId);
  if (!comment) return false;
  comment.resolved = true;
  writeCutComments(folder, all);
  return true;
}

export function resolveCutComment(slug: string, lens: string, commentId: string): boolean {
  return resolveCutCommentInFolder(safeFolder(slug), lens, commentId);
}

// Rewrite one row's status and/or notes in review-queue.md, matched by id (not a stale line
// index). Delegates to queue.ts's writeCell() — the one write path this and /publish's
// setStatus() both funnel through.
export function updateRow(slug: string, id: string, status?: string, notes?: string): boolean {
  const folder = safeFolder(slug);
  return writeCell(folder, id, { status, notes });
}

// Save an edited derivative body, keeping its frontmatter block byte-for-byte.
export function saveDerivative(slug: string, id: string, body: string): void {
  const folder = safeFolder(slug);
  if (!/^[\w.-]+$/.test(id)) throw new Error("bad id");
  const p = join(folder, "derivatives", `${id}.md`);
  if (!existsSync(p)) throw new Error("no such derivative");
  const { header } = splitFrontmatter(readFileSync(p, "utf8"));
  writeFileSync(p, header + body.trim() + "\n");
}

// Live provider cancel calls injected (mirrors serve.ts's SchedulerDeps for scheduleApproved) so
// cancelScheduled is unit-testable without a real Typefully/PostPeer network call.
export interface CancelDeps {
  cancelTypefullyDraft: (draftId: string) => Promise<void>;
  cancelPostPeerPost: (postId: string) => Promise<void>;
}
const DEFAULT_CANCEL_DEPS: CancelDeps = { cancelTypefullyDraft: cancelDraft, cancelPostPeerPost: cancelPost };

// Cancel ONE already-scheduled row's live Typefully/PostPeer draft/post — the review GUI's "Cancel"
// action (card e4eca4a1: two stale Upload-Post jobs kept firing after the 2026-07-08 rewire because
// nothing in the pipeline could cancel a scheduled post, so Muxin had to do it by hand on
// upload-post.com). Keyed off the SAME provider-ref parsing reconcile.ts's live reconciliation
// already does (findLoggedRef against publish-log.md) rather than re-deriving it a second way.
//
// A row logged via the retired Upload-Post provider (PR #130 deleted its adapter wholesale) can't
// be live-canceled here — this returns an error pointing at the upload-post.com dashboard instead,
// the same "degrade gracefully, don't pretend to handle it" posture reconcileRow already takes for
// that provider's "unavailable" state (see reconcile.ts).
//
// On success the row flips straight to "discard", never back to "pending" — CLAUDE.md rule 2
// (nothing publishes without a real review decision) means a canceled row must never later
// masquerade as still-approved and get picked up by a future schedule pass — and the cancellation
// is logged to publish-log.md, the same append-only audit trail every schedule call already writes
// (no cost-log.csv entry: a cancel isn't a billed provider call, unlike the paid generation steps
// that log there).
export async function cancelScheduled(
  folder: string,
  row: QueueRow,
  deps: CancelDeps = DEFAULT_CANCEL_DEPS
): Promise<{ ok: boolean; error?: string }> {
  if (!needsReconciliation(row)) return { ok: false, error: "this row isn't a scheduled post" };
  const publishLog = readPublishLogSafe(folder);
  if (publishLog.error) return { ok: false, error: publishLog.error };
  const logged = findLoggedRef(publishLog.text, row.id);
  if (!logged) return { ok: false, error: "no logged provider draft/post id found for this row" };
  if (logged.provider === "upload-post") {
    return {
      ok: false,
      error: "scheduled via the retired Upload-Post provider (no live adapter since PR #130). Cancel it by hand at upload-post.com",
    };
  }
  try {
    if (logged.provider === "typefully") await deps.cancelTypefullyDraft(logged.refId);
    else await deps.cancelPostPeerPost(logged.refId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  writeCell(folder, row.id, { status: "discard" });
  appendPublishLog(folder, `${row.id} → canceled (${logged.provider} ref ${logged.refId} removed via review GUI)`);
  return { ok: true };
}
