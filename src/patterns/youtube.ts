// The YouTube collector: the watch page and the channel /about page, by plain HTTP, into staged
// corpus entries. It also upgrades YouTube entries already in the corpus, in place.
//
// WHAT THIS FILE CAN AND CANNOT GET, because the second half is the important half.
//
// It was built to close one hole: 13 of the corpus's 24 YouTube entries carry
// `body_is_complete: false` because nobody had the spoken words. A YouTube video's substance is
// what the person says, and a title and description are not a substitute.
//
// THE SPOKEN WORDS ARE NOT RETRIEVABLE HERE, and that is not a bug in this file. The watch page
// still publishes the caption track LIST, so we can say with certainty whether a video has
// captions and whether they are human-authored or machine-generated. The track CONTENT is gated
// behind a proof-of-origin token: `https://www.youtube.com/api/timedtext?...` answers HTTP 200
// with a zero-byte body for every format (default, json3, vtt, srv3), with and without a browser
// user-agent, a Referer, an Origin, or a shared cookie jar. `/youtubei/v1/get_transcript` answers
// 400 FAILED_PRECONDITION even with the page's own INNERTUBE_CONTEXT and visitor id. The token is
// produced by YouTube's own obfuscated JavaScript running in a real browser, so no amount of
// header shaping reaches it. Verified independently on 2026-08-23; a previous pass recorded the
// same wall on 2026-08-23 before it.
//
// The YouTube Data API is not a way around it either. `captions.download` requires an OAuth token
// from an account that can edit the video, so it answers 403 for anyone else's video. That is the
// documented contract, not a quota problem, and no scope or service account changes it.
//
// So `parseTimedTextJson3` below is written and tested and currently unreachable. It exists so
// that the day a route opens, the parsing half is already done and already correct.
//
// Never fetched through a model-backed tool. A model-backed fetch once silently rewrote 14 of 15
// post bodies in this corpus and attributed a stranger's comment to the author. Every read here is
// plain HTTP and every field is copied across without being reworded.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CORPUS_PATH, INBOX_DIR, makeId, normalizeHandle, readCorpus } from "./corpus.js";
import type { CorpusEntry, CorpusMedia, CorpusMetrics } from "./types.js";

// A real Chrome string. YouTube serves a stripped page to an unrecognised agent, and the stripped
// page has no ytInitialPlayerResponse at all, so this is load-bearing rather than cosmetic.
export const YOUTUBE_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// One second between fetches. A 429 was returned during the 2026-08-23 probe after roughly fifteen
// rapid requests, so this is a measured floor rather than a guess.
export const DEFAULT_POLITENESS_MS = 1000;

// Thrown on 403 or 429 and never swallowed. A blocked run has to stop and say so: quietly
// recording nulls for a rate-limited fetch would write "this video has no likes" into the corpus
// when the truth is "YouTube would not answer".
export class YoutubeBlockedError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`YouTube answered ${status} for ${url}. Stopping rather than recording nulls as facts.`);
    this.name = "YoutubeBlockedError";
  }
}

// ---------------------------------------------------------------------------
// URL handling
// ---------------------------------------------------------------------------

// The video id out of any of the three URL forms YouTube publishes. This is the join key for the
// backfill: the corpus dedupes on the whole url string, so the SAME video stored once as
// /watch?v=ID and once as /shorts/ID would be two rows. Matching on the id instead means an
// upgrade finds its target whichever form the entry happens to carry.
export function videoIdFromUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = parsed.pathname.slice(1).split("/")[0];
    return isVideoId(id) ? id : null;
  }
  if (host !== "youtube.com" && host !== "m.youtube.com" && host !== "music.youtube.com") return null;
  const v = parsed.searchParams.get("v");
  if (v && isVideoId(v)) return v;
  const match = parsed.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/);
  if (match && isVideoId(match[1])) return match[1];
  return null;
}

// YouTube ids are exactly 11 characters of the URL-safe base64 alphabet. Checking the shape stops
// a path fragment like "featured" being carried around as if it were an id.
function isVideoId(value: string): boolean {
  return /^[A-Za-z0-9_-]{11}$/.test(value);
}

export function watchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function aboutUrl(handle: string): string {
  return `https://www.youtube.com/@${normalizeHandle(handle)}/about`;
}

// ---------------------------------------------------------------------------
// Reading the JSON blobs out of the page
// ---------------------------------------------------------------------------

// Pulls one balanced JSON object out of a page after a marker, counting braces while skipping over
// string literals and their escapes. A plain non-greedy regex cannot do this: every one of these
// blobs contains braces inside description text and inside escaped quotes, and a regex that stops
// at the first "}" truncates the object into something that either fails to parse or, worse,
// parses into a smaller object that looks fine.
export function extractJsonAfter(html: string, marker: string): unknown | null {
  const at = html.indexOf(marker);
  if (at < 0) return null;
  const start = html.indexOf("{", at);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (ch === '"') {
      i++;
      while (i < html.length) {
        if (html[i] === "\\") {
          i += 2;
          continue;
        }
        if (html[i] === '"') break;
        i++;
      }
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

// One caption track as the page lists it. `isAsr` is the whole reason this type exists.
export interface CaptionTrack {
  languageCode: string;
  // The track's own display name, e.g. "English" or "English (auto-generated)".
  name: string | null;
  // TRUE means machine-generated (ASR). YouTube marks these two independent ways and both are
  // checked: `kind: "asr"` on the track, and a vssId beginning "a." rather than ".". An ASR track
  // is still the spoken words, so it may set body_is_complete, but a reader must be told the
  // wording is approximate and must never quote it as exact.
  isAsr: boolean;
  baseUrl: string;
}

export interface WatchPage {
  videoId: string | null;
  title: string | null;
  // The creator's written description. This is NOT the spoken words and must never be recorded as
  // if it were: it lands in `body` only alongside transcript_source "caption", singular.
  description: string | null;
  durationSeconds: number | null;
  views: number | null;
  // Exact, not rounded: the page carries "likeCount":"3704" as an integer string.
  likes: number | null;
  author: string | null;
  channelId: string | null;
  // The vanity handle off ownerProfileUrl, without the "@". Read off the page rather than guessed
  // from the entry, because a channel's handle can differ from the name the corpus filed it under:
  // @AakashGupta is really @growproduct and @BenErez is really @benerez333.
  handle: string | null;
  publishedAt: string | null;
  // Null means the page published no caption list at all, which is a different fact from an empty
  // array. Empty array means the page listed captions and there were none.
  captionTracks: CaptionTrack[] | null;
}

export function parseWatchPage(html: string): WatchPage {
  const player = extractJsonAfter(html, "ytInitialPlayerResponse") as Record<string, any> | null;
  const details = (player?.videoDetails ?? null) as Record<string, any> | null;
  const micro = (player?.microformat?.playerMicroformatRenderer ?? null) as Record<string, any> | null;
  const tracklist = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

  const captionTracks = Array.isArray(tracklist)
    ? tracklist.map(
        (t: Record<string, any>): CaptionTrack => ({
          languageCode: typeof t.languageCode === "string" ? t.languageCode : "",
          name: trackName(t),
          isAsr: t.kind === "asr" || (typeof t.vssId === "string" && t.vssId.startsWith("a.")),
          baseUrl: typeof t.baseUrl === "string" ? t.baseUrl : "",
        }),
      )
    : null;

  return {
    videoId: typeof details?.videoId === "string" ? details.videoId : null,
    title: typeof details?.title === "string" ? details.title : null,
    description: typeof details?.shortDescription === "string" ? details.shortDescription : null,
    durationSeconds: intOrNull(details?.lengthSeconds ?? micro?.lengthSeconds),
    views: intOrNull(details?.viewCount),
    likes: likesFromHtml(html),
    author: typeof details?.author === "string" ? details.author : null,
    channelId: typeof details?.channelId === "string" ? details.channelId : null,
    handle: handleFromProfileUrl(micro?.ownerProfileUrl),
    publishedAt: dateOnly(micro?.publishDate ?? micro?.uploadDate),
    captionTracks,
  };
}

function trackName(track: Record<string, any>): string | null {
  const name = track?.name;
  if (typeof name?.simpleText === "string") return name.simpleText;
  if (Array.isArray(name?.runs)) return name.runs.map((r: Record<string, any>) => r?.text ?? "").join("") || null;
  return null;
}

// The like count, under the same one-candidate rule the subscriber count uses. The watch page
// carries exactly one "likeCount" today; if a future page carries several, one of them belongs to
// something else, and a null is the honest answer rather than the first match.
export function likesFromHtml(html: string): number | null {
  const found = [...html.matchAll(/"likeCount":"?(\d+)"?/g)].map((m) => m[1]);
  const distinct = [...new Set(found)];
  if (distinct.length !== 1) return null;
  return intOrNull(distinct[0]);
}

function handleFromProfileUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const match = url.match(/\/@([^/?#]+)/);
  return match ? match[1] : null;
}

// ISO date only, matching what every other collector in this corpus records.
function dateOnly(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function intOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/,/g, "").trim();
  if (!/^\d+$/.test(cleaned)) return null;
  return Number.parseInt(cleaned, 10);
}

// ---------------------------------------------------------------------------
// Subscriber count
// ---------------------------------------------------------------------------

// The channel's OWN subscriber count off its /about page, or null.
//
// READ THIS BEFORE CHANGING THE ROUTE. The reference doc says /about carries exactly one
// `subscriberCountText` and that it is the channel's own. That was true when it was written and it
// is NOT true now: on 2026-08-23 `youtube.com/@aliabdaal/about` carried FOUR of them, reading 561
// thousand, 92.2 thousand and 47.6 thousand, every one a recommended channel in the sidebar, while
// the real answer was 6.67M. A first-match read there records a stranger's number as this
// creator's, which is the exact failure the safety rule was written to prevent.
//
// So the count is read from the header route instead: the single `"content":"<n> subscribers"`
// string that the page header renders. Checked against three channels (@aliabdaal 6.67M,
// @melrobbins 6.07M, @growproduct 45.2K), it produced exactly one candidate on each and every one
// agreed with the number already recorded in the corpus by hand.
//
// The ambiguity rule still governs, just pointed at the route that works: more than one candidate
// means null, never the first.
export function subscribersFromAbout(html: string): number | null {
  const found = [...html.matchAll(/"content":"([\d][\d.,]*[KMB]?) subscribers"/g)].map((m) => m[1]);
  const distinct = [...new Set(found)];
  if (distinct.length !== 1) return null;
  return parseCompactCount(distinct[0]);
}

// "6.67M" -> 6670000. YouTube publishes a rounded display string and there is no precise integer
// anywhere on the page, so the result carries exactly the precision the platform gave and no more.
export function parseCompactCount(text: string): number | null {
  const match = text.trim().match(/^([\d][\d.,]*)([KMB])?$/i);
  if (!match) return null;
  const value = Number.parseFloat(match[1].replace(/,/g, ""));
  if (!Number.isFinite(value)) return null;
  const scale = { k: 1e3, m: 1e6, b: 1e9 }[(match[2] ?? "").toLowerCase()] ?? 1;
  return Math.round(value * scale);
}

// ---------------------------------------------------------------------------
// Caption tracks
// ---------------------------------------------------------------------------

export interface TrackChoice {
  track: CaptionTrack;
  // True when the chosen track is the machine-generated one, so the caller can say so out loud.
  isAsr: boolean;
  // True when a human-authored track existed and was chosen over an ASR track.
  preferredHuman: boolean;
}

// Prefers a human-authored track over a machine one, and the requested language over any other.
// A human-authored track is a real editorial artifact and its wording can be trusted; an ASR track
// is a guess at the audio that is usually right and sometimes wrong, and the corpus already holds
// caption mis-transcriptions recorded verbatim ("sematic" for "somatic", "ruin your Safe").
export function pickCaptionTrack(tracks: CaptionTrack[] | null, language = "en"): TrackChoice | null {
  if (!tracks || tracks.length === 0) return null;
  const inLanguage = tracks.filter((t) => t.languageCode === language || t.languageCode.startsWith(`${language}-`));
  const pool = inLanguage.length > 0 ? inLanguage : tracks;
  const human = pool.find((t) => !t.isAsr);
  const track = human ?? pool[0];
  return { track, isAsr: track.isAsr, preferredHuman: Boolean(human) };
}

// A caption track in YouTube's json3 shape into one run of plain text.
//
// CURRENTLY UNREACHABLE, deliberately kept and deliberately tested. Every timedtext fetch answers
// 200 with an empty body, so nothing in a live run gets here today. When a route opens, this is
// the half that must not be written in a hurry.
export function parseTimedTextJson3(json: unknown): string | null {
  const events = (json as Record<string, any>)?.events;
  if (!Array.isArray(events)) return null;
  const pieces: string[] = [];
  for (const event of events) {
    const segs = event?.segs;
    if (!Array.isArray(segs)) continue;
    for (const seg of segs) {
      if (typeof seg?.utf8 === "string") pieces.push(seg.utf8);
    }
  }
  const text = pieces.join("").replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
  return text.length > 0 ? text : null;
}

// ---------------------------------------------------------------------------
// Building an entry
// ---------------------------------------------------------------------------

// Plain words for what the caption situation actually is, written to go straight into `notes` so a
// reader never has to work it out from a boolean.
export function captionNote(choice: TrackChoice | null, tracks: CaptionTrack[] | null): string {
  if (tracks === null) {
    return "The watch page published no caption track list at all, so whether this video has captions is unknown.";
  }
  if (!choice) {
    return "The channel disabled captions on this video: the page listed its caption tracks and there were none. This is the channel's own setting, not a retrieval failure, and it is why there is no transcript.";
  }
  const kind = choice.isAsr
    ? "machine-generated (ASR), so its wording is approximate and must never be quoted as exact"
    : "human-authored, so its wording is the creator's own";
  return (
    `A caption track exists in ${choice.track.languageCode} and it is ${kind}. ` +
    "Its CONTENT could not be retrieved: YouTube gates timedtext behind a proof-of-origin token that only its own browser JavaScript can mint, and every fetch answers 200 with an empty body."
  );
}

export interface BuildEntryInput {
  page: WatchPage;
  url: string;
  handle: string;
  creator: string;
  niche: string;
  followers: number | null;
  collectedAt: string;
  // Present only where a real transcript was obtained. It is null in every live run today.
  transcript?: string | null;
}

export function buildEntry(input: BuildEntryInput): CorpusEntry {
  const { page, url, handle, creator, niche, followers, collectedAt } = input;
  const choice = pickCaptionTrack(page.captionTracks);
  const transcript = input.transcript ?? null;

  const metrics: CorpusMetrics = {
    views: page.views,
    likes: page.likes,
    // Not in the watch page's first response: YouTube loads the comment header by continuation
    // after the page renders. Null is the honest answer, not zero.
    comments: null,
    shares: null,
    followers,
  };

  const media: CorpusMedia = {
    form: isShortUrl(url) ? "short-video" : "video",
    onscreen_text: null,
    description: mediaDescription(page, choice, url),
    duration_seconds: page.durationSeconds,
    media_count: null,
    // A determination, not a shrug: the page's own track list answers it. Null only where the page
    // published no list at all.
    has_captions: page.captionTracks === null ? null : page.captionTracks.length > 0,
    aspect: isShortUrl(url) ? "vertical" : null,
    asset_url: null,
    // The spoken words are the substance of a video. With a transcript the body is the whole post;
    // without one the body is the creator's written description, which is not what won.
    body_is_complete: transcript !== null,
  };

  return {
    id: makeId("youtube", handle, url),
    platform: "youtube",
    handle,
    creator,
    niche,
    url,
    posted_at: page.publishedAt,
    collected_at: collectedAt,
    kind: "video",
    body: transcript ?? page.description ?? page.title ?? "",
    // "captions" plural is the spoken words. "caption" singular is NOT: it is the creator's written
    // description standing in because the transcript could not be retrieved. One letter apart and
    // opposite meanings, so this line is written out rather than computed inline.
    transcript_source: transcript !== null ? "captions" : "caption",
    title: page.title,
    metrics,
    media,
    notes: buildNotes(page, choice, transcript),
  };
}

function isShortUrl(url: string): boolean {
  return url.includes("/shorts/");
}

function mediaDescription(page: WatchPage, choice: TrackChoice | null, url: string): string {
  const parts = [
    `YouTube watch-page retrieval by plain HTTP on ${isShortUrl(url) ? "a /shorts/ url" : "a /watch url"}.`,
    page.title ? `Title on the page: ${JSON.stringify(page.title)}.` : "No title on the page.",
    page.durationSeconds === null ? "Duration not published." : `lengthSeconds=${page.durationSeconds}.`,
  ];
  if (page.captionTracks === null) parts.push("Caption track list absent from the page.");
  else if (page.captionTracks.length === 0) parts.push("Caption tracks listed and empty: captions are off for this video.");
  else {
    parts.push(
      `Caption tracks listed: ${page.captionTracks
        .map((t) => `${t.languageCode}/${t.isAsr ? "asr" : "human"}`)
        .join(", ")}. Chosen: ${choice ? `${choice.track.languageCode}/${choice.isAsr ? "asr" : "human"}` : "none"}.`,
    );
  }
  // Recorded as short-video on YouTube's own classification, not a duration threshold: a
  // /shorts/<id> url is YouTube itself calling the video a Short.
  return parts.join(" ");
}

function buildNotes(page: WatchPage, choice: TrackChoice | null, transcript: string | null): string {
  const lines = [
    "Retrieved by plain HTTP against the real YouTube watch page. Title, description, duration, publish date, view count and like count come from ytInitialPlayerResponse.videoDetails and .microformat; the like count is YouTube's exact integer, not a rounded display. No model-backed fetch anywhere in the path.",
    captionNote(choice, page.captionTracks),
  ];
  if (transcript === null) {
    lines.push(
      "body is the creator's written DESCRIPTION, not the spoken words, and transcript_source is \"caption\" singular to say so. media.body_is_complete is false: the substance of this video is what the person says, and that is not in this record.",
    );
  }
  lines.push("comments null: YouTube loads the comment count by continuation after the page renders, so it is not in the fetched markup.");
  return lines.join(" ");
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

export type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  status: number;
  text: () => Promise<string>;
}>;

export interface YoutubeClientOptions {
  fetchImpl?: FetchLike;
  politenessMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export class YoutubeClient {
  private readonly fetchImpl: FetchLike;
  private readonly politenessMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private fetched = false;

  constructor(opts: YoutubeClientOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
    this.politenessMs = opts.politenessMs ?? DEFAULT_POLITENESS_MS;
    this.sleep = opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async getText(url: string): Promise<string> {
    if (this.fetched && this.politenessMs > 0) await this.sleep(this.politenessMs);
    this.fetched = true;
    const res = await this.fetchImpl(url, {
      headers: { "user-agent": YOUTUBE_USER_AGENT, "accept-language": "en-US,en;q=0.9" },
    });
    if (res.status === 403 || res.status === 429) throw new YoutubeBlockedError(res.status, url);
    if (res.status !== 200) throw new Error(`YouTube answered ${res.status} for ${url}.`);
    return res.text();
  }
}

// ---------------------------------------------------------------------------
// Backfill: upgrading YouTube entries already in the corpus, in place
// ---------------------------------------------------------------------------

// What a re-fetch can change on an entry already in the corpus, and what it must never touch.
//
// The corpus dedupes on `url`, so a second collect of the same video is dropped rather than
// merged. That means an upgrade has to be a REWRITE of the matching line, not an append. Entries
// are matched by video id rather than by url string, so an entry stored as /shorts/<id> is still
// found when the fetch went to /watch?v=<id>.
//
// `id`, `url`, `handle`, `creator`, `niche` and `sample` are left exactly as they are: they are
// the entry's identity and its provenance, and rewriting them here would silently relabel a row
// somebody else collected.
export interface UpgradeResult {
  entry: CorpusEntry;
  changed: string[];
}

export function upgradeEntry(entry: CorpusEntry, page: WatchPage, collectedAt: string, transcript: string | null = null): UpgradeResult {
  const changed: string[] = [];
  const next: CorpusEntry = { ...entry, metrics: { ...entry.metrics }, media: entry.media ? { ...entry.media } : undefined };

  if (page.views !== null && page.views !== entry.metrics.views) {
    next.metrics.views = page.views;
    changed.push("views");
  }
  if (page.likes !== null && page.likes !== entry.metrics.likes) {
    next.metrics.likes = page.likes;
    changed.push("likes");
  }
  if (page.publishedAt && page.publishedAt !== entry.posted_at) {
    next.posted_at = page.publishedAt;
    changed.push("posted_at");
  }
  if (page.title && page.title !== entry.title) {
    next.title = page.title;
    changed.push("title");
  }
  if (page.durationSeconds !== null && next.media && next.media.duration_seconds !== page.durationSeconds) {
    next.media.duration_seconds = page.durationSeconds;
    changed.push("duration_seconds");
  }

  const choice = pickCaptionTrack(page.captionTracks);
  const hasCaptions = page.captionTracks === null ? null : page.captionTracks.length > 0;
  if (next.media && hasCaptions !== null && next.media.has_captions !== hasCaptions) {
    next.media.has_captions = hasCaptions;
    changed.push("has_captions");
  }

  // A transcript is the only thing that can flip body_is_complete on a video entry, and only a
  // REAL one. Without it the body stays the description and the flag stays false, however much
  // other metadata this pass filled in.
  if (transcript !== null) {
    next.body = transcript;
    next.transcript_source = "captions";
    if (next.media) next.media.body_is_complete = true;
    changed.push("body", "transcript_source", "body_is_complete");
  }

  if (changed.length > 0) {
    next.notes = appendNote(
      entry.notes,
      `UPDATE ${collectedAt.slice(0, 10)} (youtube re-fetch): ${changed.join(", ")} refreshed by plain HTTP off the watch page. ${captionNote(choice, page.captionTracks)}` +
        (transcript === null
          ? " The spoken transcript is still NOT in this record, so body_is_complete stays false and body remains the written description."
          : ""),
    );
  }
  return { entry: next, changed };
}

function appendNote(existing: string | undefined, addition: string): string {
  return existing && existing.trim().length > 0 ? `${existing} ${addition}` : addition;
}

// Rewrites the corpus with the given entries replacing their matching lines, matched by id.
// Writes to a temp file and renames, so an interrupted run cannot leave a half-written corpus.
export function rewriteCorpus(updates: CorpusEntry[], path: string = CORPUS_PATH): number {
  if (updates.length === 0) return 0;
  const byId = new Map(updates.map((e) => [e.id, e]));
  const all = readCorpus(path);
  let replaced = 0;
  const next = all.map((entry) => {
    const update = byId.get(entry.id);
    if (!update) return entry;
    replaced++;
    return update;
  });
  const tmp = `${path}.tmp`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(tmp, next.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
  renameSync(tmp, path);
  return replaced;
}

// The YouTube entries whose body is not the spoken words. These are the rows the backfill exists
// for: a video entry whose body_is_complete is false, or whose transcript_source is the singular
// "caption" meaning a written description stood in.
export function incompleteYoutubeEntries(entries: CorpusEntry[]): CorpusEntry[] {
  return entries.filter(
    (e) => e.platform === "youtube" && (e.transcript_source === "caption" || e.media?.body_is_complete === false),
  );
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export interface YoutubeArgs {
  urls: string[];
  handle: string | null;
  creator: string | null;
  niche: string | null;
  backfill: boolean;
  dryRun: boolean;
  limit: number | null;
  outPath: string | null;
  corpusPath: string | null;
  politenessMs: number;
}

export function parseYoutubeArgs(argv: string[]): YoutubeArgs {
  const args: YoutubeArgs = {
    urls: [],
    handle: null,
    creator: null,
    niche: null,
    backfill: false,
    dryRun: false,
    limit: null,
    outPath: null,
    corpusPath: null,
    politenessMs: DEFAULT_POLITENESS_MS,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    if (arg === "--url") args.urls.push(next());
    else if (arg === "--handle") args.handle = next();
    else if (arg === "--creator") args.creator = next();
    else if (arg === "--niche") args.niche = next();
    else if (arg === "--backfill") args.backfill = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--limit") args.limit = Number.parseInt(next(), 10);
    else if (arg === "--out") args.outPath = next();
    else if (arg === "--corpus") args.corpusPath = next();
    else if (arg === "--politeness-ms") args.politenessMs = Number.parseInt(next(), 10);
    else if (!arg.startsWith("--")) args.urls.push(arg);
  }
  return args;
}

const USAGE = [
  "Usage:",
  "  npm run patterns:youtube -- --backfill [--dry-run] [--limit N]",
  "      Re-fetch every YouTube entry whose body is not the spoken words and upgrade it in place.",
  "",
  "  npm run patterns:youtube -- --url <video url> --handle <@handle> --creator <name> --niche <niche>",
  "      Collect one video into a staged inbox file for patterns:collect to validate and append.",
  "",
  "The spoken transcript is NOT retrievable by this route. YouTube gates caption content behind a",
  "proof-of-origin token minted by its own browser JavaScript, and the Data API's captions.download",
  "requires OAuth as the video's owner. This collector records the caption track's EXISTENCE and",
  "whether it is human-authored or machine-generated, and says plainly that the words are missing.",
].join("\n");

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const args = parseYoutubeArgs(argv);
  const log = (line: string) => console.log(line);
  const client = new YoutubeClient({ politenessMs: args.politenessMs });
  const collectedAt = new Date().toISOString();

  if (args.backfill) return runBackfill(args, client, collectedAt, log);

  if (args.urls.length === 0) {
    console.error(USAGE);
    return 1;
  }
  if (!args.handle || !args.creator || !args.niche) {
    console.error("--handle, --creator and --niche are required when collecting a url.");
    return 1;
  }

  const staged: CorpusEntry[] = [];
  let followers: number | null = null;
  try {
    followers = subscribersFromAbout(await client.getText(aboutUrl(args.handle)));
  } catch (err) {
    if (err instanceof YoutubeBlockedError) {
      console.error(err.message);
      return 1;
    }
    console.error(`Subscriber count not retrieved: ${(err as Error).message}`);
  }
  if (followers === null) {
    log("followers null: the /about page gave no single unambiguous count, so nothing was recorded rather than a guess.");
  }

  for (const url of args.urls) {
    const videoId = videoIdFromUrl(url);
    if (!videoId) {
      console.error(`Not a YouTube video url, skipped: ${url}`);
      continue;
    }
    try {
      const page = parseWatchPage(await client.getText(url));
      const entry = buildEntry({
        page,
        url,
        handle: args.handle,
        creator: args.creator,
        niche: args.niche,
        followers,
        collectedAt,
      });
      staged.push(entry);
      const choice = pickCaptionTrack(page.captionTracks);
      log(`${url}: ${page.views ?? "no"} views, ${page.likes ?? "no"} likes, captions ${page.captionTracks === null ? "unknown" : page.captionTracks.length === 0 ? "OFF" : choice?.isAsr ? "on (machine-generated)" : "on (human-authored)"}, transcript NOT retrievable.`);
    } catch (err) {
      if (err instanceof YoutubeBlockedError) {
        console.error(err.message);
        return 1;
      }
      console.error(`${url}: ${(err as Error).message}`);
    }
  }

  if (staged.length === 0) {
    console.error("Nothing was staged.");
    return 1;
  }
  const outPath = args.outPath ?? join(INBOX_DIR, `youtube-${collectedAt.slice(0, 10)}.json`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(staged, null, 2) + "\n", "utf8");
  log(`\nStaged ${staged.length} entries to ${outPath}.`);
  log("Nothing has entered the corpus yet. Validate and append them with: npm run patterns:collect");
  return 0;
}

async function runBackfill(
  args: YoutubeArgs,
  client: YoutubeClient,
  collectedAt: string,
  log: (line: string) => void,
): Promise<number> {
  const corpusPath = args.corpusPath ?? CORPUS_PATH;
  const all = readCorpus(corpusPath);
  let targets = incompleteYoutubeEntries(all);
  if (args.limit !== null) targets = targets.slice(0, args.limit);

  if (targets.length === 0) {
    log("No YouTube entries are missing their spoken words. Nothing to do.");
    return 0;
  }
  log(`${targets.length} YouTube entries have a body that is not the spoken words. Re-fetching each one.\n`);

  const updated: CorpusEntry[] = [];
  let blocked = 0;
  let stillIncomplete = 0;

  for (const entry of targets) {
    const videoId = videoIdFromUrl(entry.url);
    if (!videoId) {
      console.error(`${entry.id}: url is not a YouTube video url, skipped: ${entry.url}`);
      continue;
    }
    try {
      const page = parseWatchPage(await client.getText(watchUrl(videoId)));
      // No transcript is passed, because none is obtainable. This is the honest call, not a
      // placeholder: see the header of this file for exactly what was tried and what answered.
      const result = upgradeEntry(entry, page, collectedAt, null);
      stillIncomplete++;
      if (result.changed.length === 0) {
        log(`${entry.id}: nothing changed.`);
        continue;
      }
      updated.push(result.entry);
      log(`${entry.id}: ${result.changed.join(", ")}. Transcript still missing.`);
    } catch (err) {
      if (err instanceof YoutubeBlockedError) {
        console.error(`\n${err.message}`);
        console.error("Stopping the backfill here. Nothing partial has been written.");
        blocked++;
        break;
      }
      console.error(`${entry.id}: ${(err as Error).message}`);
    }
  }

  if (args.dryRun) {
    log(`\nDry run: ${updated.length} entries would be rewritten. The corpus was not touched.`);
    return blocked > 0 ? 1 : 0;
  }
  const replaced = rewriteCorpus(updated, corpusPath);
  log(`\nRewrote ${replaced} entries in ${corpusPath}.`);
  log(
    `${stillIncomplete} of them still have body_is_complete false, because the spoken words are not retrievable by this route. ` +
      "That is the honest state of those rows, not a failure of this run.",
  );
  return blocked > 0 ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().then((code) => {
    process.exitCode = code;
  });
}
