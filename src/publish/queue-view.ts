import "../util/env.js";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { repoRoot } from "../db/db.js";
import { readLedger, pruneLedger, fmtLa, type Claim } from "./slots.js";
import { fetchScheduledDrafts } from "./typefully.js";
import { listScheduledUploads } from "./youtube.js";

// The UNIFIED publish queue — one chronological view of everything scheduled across every channel,
// readable from any session or worktree.
//   npm run queue            print the merged queue + drift/reconcile + pending paste
//   npm run queue -- --sync  also prune past-dated claims from data/publish-schedule.jsonl
//
// WHY read live services, not just the local ledger: the ledger (data/publish-schedule.jsonl) is the
// write-side source of truth for WHEN we claim slots, but it is gitignored and local — a fresh
// worktree sees it empty even when Typefully actually holds scheduled drafts. So the table below is
// built from the LIVE services (Typefully drafts, PostPeer posts, YouTube scheduled uploads); the
// ledger is then cross-checked against them to flag drift (a claim with no live post, or a live post
// with no claim). House rules are untouched: this view is READ-ONLY except `--sync`, which only
// compacts already-past ledger rows. It never schedules or publishes anything.

interface QueueItem {
  whenIso: string; // scheduled publish time (ISO)
  platform: string; // x | linkedin | bluesky | tiktok | youtube | …
  media: "text" | "card" | "video";
  title: string;
  source: "typefully" | "postpeer" | "youtube";
}

interface SourceResult {
  items: QueueItem[];
  note: string | null; // a one-line reason the source was skipped/unavailable (keys missing, error)
  ok: boolean; // did we successfully reach the service? drift only cross-checks reachable sources
}

const POSTPEER_API = "https://api.postpeer.dev/v1";

// LA calendar day (YYYY-MM-DD) for an ISO time — matches the ledger's `day` key so live posts and
// claims compare on the same per-platform-per-day grain the scheduler enforces.
function laDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

// PostPeer reports X as "twitter"; the scheduler + cta config key it as "x". Normalize so card
// fan-out platforms line up with ledger/text keys.
function platformKey(p: string): string {
  const k = p.trim().toLowerCase();
  return k === "twitter" ? "x" : k;
}

// --- live sources --------------------------------------------------------------------------------

async function listTypefully(): Promise<SourceResult> {
  if (!process.env.TYPEFULLY_API_KEY) {
    return { items: [], note: "Typefully: TYPEFULLY_API_KEY not set — skipped", ok: false };
  }
  try {
    const drafts = await fetchScheduledDrafts();
    const items = drafts.flatMap((d) =>
      (d.platforms.length ? d.platforms : ["?"]).map(
        (p): QueueItem => ({ whenIso: d.whenIso, platform: platformKey(p), media: "text", title: d.title, source: "typefully" })
      )
    );
    return { items, note: null, ok: true };
  } catch (e) {
    return { items: [], note: `Typefully: ${(e as Error).message}`, ok: false };
  }
}

async function listYouTube(): Promise<SourceResult> {
  const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN } = process.env;
  if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET || !YOUTUBE_REFRESH_TOKEN) {
    return { items: [], note: "YouTube: OAuth env vars not set — skipped", ok: false };
  }
  try {
    const ups = await listScheduledUploads();
    const items = ups.map(
      (u): QueueItem => ({ whenIso: u.publishAt, platform: "youtube", media: "video", title: u.title, source: "youtube" })
    );
    return { items, note: null, ok: true };
  } catch (e) {
    return { items: [], note: `YouTube: ${(e as Error).message}`, ok: false };
  }
}

// PostPeer (TikTok shorts + quote cards). PostPeer publicly documents only POST /v1/posts; a list
// endpoint isn't published, so this is best-effort: try GET /v1/posts, and if it isn't there, degrade
// to a note (the ledger section still shows the tiktok/card claims). Parse defensively — the response
// shape isn't contract-guaranteed.
interface PostPeerPost {
  id?: string;
  postId?: string;
  status?: string;
  scheduledFor?: string;
  content?: string;
  platforms?: ({ platform?: string } | string)[];
  mediaItems?: { type?: string }[];
}

function extractPostPeerList(json: unknown): PostPeerPost[] {
  if (Array.isArray(json)) return json as PostPeerPost[];
  const o = json as Record<string, unknown>;
  for (const key of ["posts", "data", "results", "items"]) {
    if (Array.isArray(o?.[key])) return o[key] as PostPeerPost[];
  }
  return [];
}

function postPeerPlatforms(p: PostPeerPost): string[] {
  const raw = p.platforms ?? [];
  const names = raw.map((x) => (typeof x === "string" ? x : x?.platform ?? "")).filter(Boolean);
  return [...new Set(names.map(platformKey))];
}

async function listPostPeer(): Promise<SourceResult> {
  const key = process.env.POSTPEER_API_KEY;
  if (!key) return { items: [], note: "PostPeer: POSTPEER_API_KEY not set — skipped", ok: false };
  let res: Response;
  try {
    res = await fetch(`${POSTPEER_API}/posts`, { headers: { "x-access-key": key } });
  } catch (e) {
    return { items: [], note: `PostPeer: request failed (${(e as Error).message}) — see ledger below`, ok: false };
  }
  if (!res.ok) {
    return {
      items: [],
      note: `PostPeer: GET /posts → ${res.status} (no public list endpoint; tiktok/card claims shown from the ledger below)`,
      ok: false,
    };
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { items: [], note: "PostPeer: /posts returned unparseable JSON", ok: false };
  }
  const now = Date.now();
  const items: QueueItem[] = [];
  for (const p of extractPostPeerList(json)) {
    const when = p.scheduledFor;
    if (!when || new Date(when).getTime() <= now) continue;
    if (p.status && !/schedul/i.test(p.status)) continue; // keep only still-scheduled posts
    const media: QueueItem["media"] = (p.mediaItems ?? []).some((m) => m?.type === "video") ? "video" : "card";
    const title = (p.content ?? p.id ?? p.postId ?? "").toString().replace(/\s+/g, " ").trim().slice(0, 60);
    for (const plat of postPeerPlatforms(p).length ? postPeerPlatforms(p) : ["?"]) {
      items.push({ whenIso: when, platform: plat, media, title, source: "postpeer" });
    }
  }
  return { items, note: null, ok: true };
}

// --- pending manual (paste) channels -------------------------------------------------------------

// Substack / community posts have no API — /publish emits ready-to-paste/<id>.txt for Muxin to paste
// by hand. They aren't on the scheduler, but they ARE pending work, so surface them so "everything
// not yet out" lives in one view.
function listPendingPaste(): { folder: string; file: string }[] {
  const contentDir = join(repoRoot, "content");
  if (!existsSync(contentDir)) return [];
  const out: { folder: string; file: string }[] = [];
  for (const folder of readdirSync(contentDir)) {
    const rtp = join(contentDir, folder, "ready-to-paste");
    if (!existsSync(rtp)) continue;
    for (const f of readdirSync(rtp)) if (f.endsWith(".txt")) out.push({ folder, file: f });
  }
  return out;
}

// --- reconcile / drift ---------------------------------------------------------------------------

// Which live sources could legitimately produce a claim on this platform. A claim is only flagged as
// "claimed but not live" when EVERY possible source was reachable — otherwise an unreachable service
// (e.g. no PostPeer list endpoint) would masquerade as drift.
function possibleSources(platform: string): ("typefully" | "postpeer" | "youtube")[] {
  switch (platform) {
    case "x":
    case "linkedin":
    case "bluesky":
      return ["typefully", "postpeer"]; // text via Typefully, or a card fan-out via PostPeer
    case "tiktok":
      return ["postpeer"];
    case "youtube":
      return ["youtube"];
    default:
      return []; // "quote-card" is a cadence bucket, not a real destination — never cross-checked
  }
}

function reconcile(live: QueueItem[], futureClaims: Claim[], ok: Record<string, boolean>): {
  claimedNotLive: Claim[];
  liveNotClaimed: QueueItem[];
  uncheckable: Claim[];
} {
  const liveKeys = new Set(live.map((i) => `${i.platform}|${laDay(i.whenIso)}`));
  const claimKeys = new Set(futureClaims.map((c) => `${c.platform}|${c.day}`));

  const claimedNotLive: Claim[] = [];
  const uncheckable: Claim[] = [];
  for (const c of futureClaims) {
    const srcs = possibleSources(c.platform);
    if (srcs.length === 0) continue; // cadence bucket — skip
    if (liveKeys.has(`${c.platform}|${c.day}`)) continue; // matched a live post
    if (srcs.every((s) => ok[s])) claimedNotLive.push(c);
    else uncheckable.push(c); // a needed source was unreachable — can't conclude drift
  }

  // A live post with no ledger claim. Only meaningful when the ledger actually has claims (it's
  // local + gitignored, so a fresh worktree has none — then every live post would falsely look
  // unclaimed). Skip the per-item list in that case; the caller notes it instead.
  const liveNotClaimed = claimKeys.size === 0 ? [] : live.filter((i) => !claimKeys.has(`${i.platform}|${laDay(i.whenIso)}`));

  return { claimedNotLive, liveNotClaimed, uncheckable };
}

// --- render --------------------------------------------------------------------------------------

const MEDIA_TAG: Record<QueueItem["media"], string> = { text: "text ", card: "card ", video: "video" };

function printQueue(items: QueueItem[]): void {
  if (!items.length) {
    console.log("  (nothing scheduled in any reachable service)");
    return;
  }
  const sorted = [...items].sort((a, b) => new Date(a.whenIso).getTime() - new Date(b.whenIso).getTime());
  const whenW = Math.max(...sorted.map((i) => fmtLa(new Date(i.whenIso)).length));
  const platW = Math.max(...sorted.map((i) => i.platform.length), 8);
  for (const i of sorted) {
    const when = fmtLa(new Date(i.whenIso)).padEnd(whenW);
    const plat = i.platform.padEnd(platW);
    console.log(`  ${when}  ${plat}  ${MEDIA_TAG[i.media]}  ${i.title}`);
  }
}

async function main(): Promise<void> {
  const sync = process.argv.includes("--sync");

  const [tf, pp, yt] = await Promise.all([listTypefully(), listPostPeer(), listYouTube()]);
  const live = [...tf.items, ...pp.items, ...yt.items];
  const ok = { typefully: tf.ok, postpeer: pp.ok, youtube: yt.ok };

  console.log("\n=== UNIFIED PUBLISH QUEUE (live services, times in PT) ===\n");
  printQueue(live);

  const notes = [tf.note, pp.note, yt.note].filter((n): n is string => !!n);
  if (notes.length) {
    console.log("\n  sources skipped / unavailable:");
    for (const n of notes) console.log(`    • ${n.replace(/\s+/g, " ").trim()}`);
  }

  // Pending manual (paste) channels.
  const paste = listPendingPaste();
  console.log(`\n=== PENDING PASTE (manual: Substack / community), ${paste.length} ===\n`);
  if (!paste.length) console.log("  (none)");
  for (const p of paste) console.log(`  ${p.folder}/ready-to-paste/${p.file}`);

  // Reconcile against the local ledger.
  const now = Date.now();
  const claims = readLedger();
  const future = claims.filter((c) => new Date(c.time).getTime() > now);
  const past = claims.length - future.length;
  console.log(`\n=== LEDGER RECONCILE (data/publish-schedule.jsonl: ${claims.length} claims, ${future.length} future) ===\n`);

  if (claims.length === 0) {
    console.log("  ledger is empty (it's local + gitignored — expected in a fresh worktree). Live table above is the truth.");
  } else {
    const { claimedNotLive, liveNotClaimed, uncheckable } = reconcile(live, future, ok);

    if (claimedNotLive.length) {
      console.log(`  ⚠ claimed but NOT live (draft may have been deleted/rescheduled downstream): ${claimedNotLive.length}`);
      for (const c of claimedNotLive) console.log(`    • ${c.platform}  ${fmtLa(new Date(c.time))}  ${c.asset} (by ${c.by})`);
    }
    if (uncheckable.length) {
      const plats = [...new Set(uncheckable.map((c) => c.platform))].join(", ");
      console.log(`  ? not cross-checked — a needed service was unreachable (${plats}): ${uncheckable.length} claim(s)`);
    }
    if (liveNotClaimed.length) {
      console.log(`  ⚠ live but NOT in the ledger (scheduled elsewhere, or claimed in another worktree): ${liveNotClaimed.length}`);
      for (const i of liveNotClaimed) console.log(`    • ${i.platform}  ${fmtLa(new Date(i.whenIso))}  ${i.title} (${i.source})`);
    }
    if (!claimedNotLive.length && !liveNotClaimed.length && !uncheckable.length) {
      console.log("  ✓ ledger and live services agree (no drift).");
    }
  }

  // --sync: compact past-dated rows out of the ledger.
  if (sync) {
    const { removed, kept } = pruneLedger(now);
    console.log(`\n--sync: pruned ${removed} past-dated claim(s) from the ledger (${kept} future kept).`);
  } else if (past > 0) {
    console.log(`\n  note: ${past} past-dated claim(s) still in the ledger — run \`npm run queue -- --sync\` to compact.`);
  }
  console.log("");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
