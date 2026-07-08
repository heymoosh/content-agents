import "../util/env.js";
import { readFileSync, existsSync } from "node:fs";
import { join, isAbsolute, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { repoRoot } from "../db/db.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { readQueue, setStatus, appendPublishLog, appendBetPlacement } from "./queue.js";
import { claimSlots, fmtLa } from "./slots.js";
import { checkReuse } from "./reuse-guard.js";
import { fetchWithRetry } from "../util/fetch-retry.js";

// Upload approved video rows to YouTube as Shorts. A short is uploaded as a SCHEDULED publish: it
// claims a slot from the UNIFIED scheduler (src/publish/slots.ts, windowKey "youtube") and sets
// status.publishAt = that slot (private until then), so YouTube auto-flips it to public on the SAME
// clock + shared ledger as text/cards/TikTok — no manual trip to Studio, no platform double-books a
// PT day. If no `youtube` cadence is configured, it falls back to a plain private upload (manual
// flip, or YOUTUBE_PRIVACY=public).
//   tsx src/publish/youtube.ts <content-folder>
// Needs YOUTUBE_CLIENT_ID / SECRET / REFRESH_TOKEN — see docs/setup-youtube-oauth.md.

export async function accessToken(): Promise<string> {
  const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN } = process.env;
  if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET || !YOUTUBE_REFRESH_TOKEN) {
    throw new Error("YouTube OAuth env vars missing — see docs/setup-youtube-oauth.md");
  }
  const res = await fetchWithRetry("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: YOUTUBE_CLIENT_ID,
      client_secret: YOUTUBE_CLIENT_SECRET,
      refresh_token: YOUTUBE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`token refresh failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function uploadShort(
  videoPath: string,
  title: string,
  description: string,
  publishAt?: string
): Promise<string> {
  const token = await accessToken();
  // status.publishAt requires privacyStatus=private; YouTube flips the video to public AT publishAt.
  // No publishAt → keep the old behavior (private by default, or YOUTUBE_PRIVACY=public for instant).
  const status: Record<string, unknown> = {
    privacyStatus: publishAt ? "private" : process.env.YOUTUBE_PRIVACY ?? "private",
    selfDeclaredMadeForKids: false,
  };
  if (publishAt) status.publishAt = publishAt;
  const metadata = {
    snippet: { title, description, categoryId: "28" }, // 28 = Science & Technology
    status,
  };
  const boundary = "content-agents-upload";
  const head = Buffer.from(
    `--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
      metadata
    )}\r\n--${boundary}\r\ncontent-type: video/mp4\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--`);
  const body = Buffer.concat([head, readFileSync(videoPath), tail]);

  const res = await fetchWithRetry(
    "https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=multipart",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": `multipart/related; boundary=${boundary}`,
        "content-length": String(body.length),
      },
      body,
    },
    // Creates a real scheduled video upload — a lost-response network error (very plausible on a
    // large multipart upload) OR a 5xx (e.g. a fronting proxy timing out after YouTube already
    // committed the upload) must not retry this and risk a duplicate video. Only 429 still
    // retries (an explicit rejection, never processed).
    { retryOnNetworkError: false }
  );
  if (!res.ok) throw new Error(`upload failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { id: string }).id;
}

export interface ScheduledShort {
  id: string;
  platform: string; // always "youtube"
  when: string; // human PT label or privacy note
  ref: string; // youtube shorts url
  autoPublishes: boolean; // false = private upload (no youtube cadence configured) — needs a manual flip in YouTube Studio, unlike a real scheduled slot
}

// Exported so serve.ts's scheduleKind() routes to publishShorts using this SAME predicate, instead
// of keeping its own independently-maintained copy that could drift out of sync with this one.
export const isShortRow = (platform: string, format: string): boolean =>
  platform !== "tiktok" && (platform === "youtube" || format === "short");

// Upload approved video (YouTube Short) rows from a folder. Extracted from the CLI (like publishText)
// so the review GUI can schedule ONE row on approve via opts.onlyIds. With no opts it behaves exactly
// as the CLI did — every approved video row in the folder — so /publish is unchanged.
export async function publishShorts(
  folder: string,
  opts: { onlyIds?: string[] } = {}
): Promise<ScheduledShort[]> {
  const { rows } = readQueue(folder);
  // The same render also feeds TikTok via a separate `tiktok` row (src/publish/tiktok.ts);
  // exclude it so a short isn't double-posted here.
  let approved = rows.filter((r) => r.status === "approve" && isShortRow(r.platform, r.format));
  if (opts.onlyIds) approved = approved.filter((r) => opts.onlyIds!.includes(r.id));
  if (approved.length === 0) {
    console.log("no approved video rows in the review queue");
    return [];
  }

  // Reuse guard: skip if this slug was published to YouTube too recently.
  const slug = basename(folder);
  const reuseCheck = checkReuse(slug, "youtube");
  if (!reuseCheck.allowed) {
    console.warn(`reuse guard: ${reuseCheck.reason} — skipping`);
    console.log("no rows to publish: youtube blocked by the reuse guard");
    return [];
  }

  const videoPath = join(folder, "video", "short.mp4");
  const titlePath = join(folder, "video", "title.txt");
  const descPath = join(folder, "video", "description.txt");
  for (const p of [videoPath, titlePath, descPath]) {
    if (!existsSync(p)) throw new Error(`missing ${p}`);
  }
  let title = readFileSync(titlePath, "utf8").trim();
  if (!/#shorts/i.test(title)) title = `${title} #Shorts`;
  const description = readFileSync(descPath, "utf8").trim();

  // The short's attribution lives in the video-script derivative's frontmatter (if present).
  const scriptPath = join(folder, "derivatives", "video-script.md");
  const { fm } = existsSync(scriptPath)
    ? splitFrontmatter(readFileSync(scriptPath, "utf8"))
    : { fm: {} as Record<string, unknown> };

  // Claim a slot per video from the unified scheduler (windowKey "youtube"), de-conflicting against
  // YouTube's own ledger days. Each upload sets status.publishAt = its slot, so it auto-publishes on
  // the shared clock. No cadence configured → "next-free-slot" sentinel → plain private upload.
  const { times, labels } = claimSlots({
    windowKey: "youtube",
    conflictPlatforms: ["youtube"],
    count: approved.length,
    asset: `${basename(folder)}/youtube`,
    by: "youtube",
  });

  const results: ScheduledShort[] = [];
  for (let i = 0; i < approved.length; i++) {
    const row = approved[i];
    const slot = times[i];
    const publishAt = slot && slot !== "next-free-slot" ? slot : undefined;
    const videoId = await uploadShort(videoPath, title, description, publishAt);
    const url = `https://youtube.com/shorts/${videoId}`;
    setStatus(folder, row, "published");
    const when = publishAt ? `public ${labels[i]}` : `privacy: ${process.env.YOUTUBE_PRIVACY ?? "private"}`;
    appendPublishLog(folder, `${row.id} → youtube ${url} (${when})`);
    appendBetPlacement(folder, row.id, "youtube", publishAt ? `${url} @ ${labels[i]}` : url, fm, title);
    console.log(publishAt ? `scheduled: ${url} → goes public ${labels[i]}` : `uploaded: ${url}`);
    results.push({ id: row.id, platform: "youtube", when, ref: url, autoPublishes: !!publishAt });
  }
  return results;
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("usage: tsx src/publish/youtube.ts <content-folder>");
    process.exit(1);
  }
  const folder = isAbsolute(arg) ? arg : join(repoRoot, arg);
  await publishShorts(folder);
}

// Read-only: list the channel's currently-scheduled Shorts (status.publishAt in the future) for the
// unified queue view. Best-effort, three Data API calls: channels → uploads playlist → videos.
type YtVideo = {
  id: string;
  status?: { publishAt?: string; privacyStatus?: string };
  snippet?: { title?: string };
};
const PLAYLIST_PAGE_SIZE = 25;
const PLAYLIST_MAX_PAGES = 10; // sane upper bound so a pathological channel can't loop forever / hammer the API
const VIDEOS_BATCH_SIZE = 50; // videos.list accepts at most 50 ids per call

export async function listScheduledUploads(): Promise<{ publishAt: string; title: string; videoId: string }[]> {
  const token = await accessToken();
  const get = async (path: string): Promise<Record<string, unknown>> => {
    const res = await fetchWithRetry(`https://www.googleapis.com/youtube/v3/${path}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`youtube ${path} → ${res.status} ${await res.text()}`);
    return (await res.json()) as Record<string, unknown>;
  };
  const ch = (await get("channels?part=contentDetails&mine=true")) as {
    items?: { contentDetails?: { relatedPlaylists?: { uploads?: string } } }[];
  };
  const uploads = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) return [];

  // playlistItems pages via nextPageToken (standard YouTube Data API v3 pattern) — loop until no
  // more pages so a channel with more than one page of uploads doesn't hide scheduled Shorts.
  const ids: string[] = [];
  let pageToken = "";
  for (let page = 0; page < PLAYLIST_MAX_PAGES; page++) {
    const tokenParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
    const pl = (await get(
      `playlistItems?part=contentDetails&maxResults=${PLAYLIST_PAGE_SIZE}&playlistId=${uploads}${tokenParam}`
    )) as {
      items?: { contentDetails?: { videoId?: string } }[];
      nextPageToken?: string;
    };
    ids.push(...(pl.items ?? []).map((it) => it.contentDetails?.videoId).filter((v): v is string => !!v));
    pageToken = pl.nextPageToken ?? "";
    if (!pageToken) break;
    if (page + 1 >= PLAYLIST_MAX_PAGES) {
      // A truncated live list is more dangerous than an unreachable one: reconcile() (queue-view.ts)
      // trusts a successful return as complete and will release ledger claims it can't match — the
      // exact orphan-release misfire this pagination fix is closing. Throwing routes this the same
      // way a network failure already does (caller marks the source unreachable / uncheckable)
      // instead of silently handing back a partial list that looks complete.
      throw new Error(
        `listScheduledUploads: hit the ${PLAYLIST_MAX_PAGES}-page cap (${ids.length} uploads fetched) — more uploads exist and were not fetched`
      );
    }
  }
  if (!ids.length) return [];

  // videos.list only accepts up to 50 ids per call — batch so full pagination above doesn't
  // silently truncate at the video-status lookup step instead. Batches are independent (no cursor
  // dependency between them), so fetch them concurrently.
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += VIDEOS_BATCH_SIZE) batches.push(ids.slice(i, i + VIDEOS_BATCH_SIZE));
  const batchResults = (await Promise.all(
    batches.map((batch) => get(`videos?part=status,snippet&id=${batch.join(",")}`))
  )) as { items?: YtVideo[] }[];
  const items: YtVideo[] = batchResults.flatMap((r) => r.items ?? []);
  const now = Date.now();
  return items
    .filter((v) => v.status?.publishAt && new Date(v.status.publishAt).getTime() > now)
    .map((v) => ({ publishAt: v.status!.publishAt!, title: v.snippet?.title ?? v.id, videoId: v.id }));
}

// Run the CLI only when executed directly, so the module can be imported (accessToken,
// listScheduledUploads) without triggering main()/process.exit. Matches tiktok.ts / cards.ts.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
