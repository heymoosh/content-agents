// fs/frontmatter read-write for content/<slug> folders — the data layer the review GUI (serve.ts)
// reads through to build each row it shows, and writes through (updateRow/saveDerivative) when
// Muxin approves/revises/edits one in place. Split out of serve.ts (Codebase review Phase 5c).

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { repoRoot } from "../db/db.js";
import { readQueue, writeCell, type QueueRow } from "../publish/queue.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { fetchScheduledDrafts } from "../publish/typefully.js";
import { fetchScheduledPosts } from "../publish/postpeer-status.js";
import { classifyThread } from "../atomize/thread-check.js";
import {
  reconcileRow,
  needsReconciliation,
  type LiveProviderState,
  type ReconciledStatus,
  type PublishLogRead,
} from "./reconcile.js";

export const CONTENT = join(repoRoot, "content");

// A row is "decided" once it's out of the review inbox. Everything else needs Muxin's eyes.
const DECIDED = new Set(["published", "discard"]);
export const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
export const VIDEO_EXT = new Set([".mp4", ".webm", ".mov"]);

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

export interface Piece {
  slug: string;
  title: string;
  rows: EnrichedRow[];
  pending: number;
}

// Resolve a slug to its content folder, refusing anything that isn't a real review-queue folder
// (defends the write/asset endpoints against path traversal on a slug from the client).
export function safeFolder(slug: string): string {
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
    const { body, fm } = splitFrontmatter(readFileSync(p, "utf8"));
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

export async function listPieces(): Promise<Piece[]> {
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
