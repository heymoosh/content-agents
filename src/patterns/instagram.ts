// The Instagram collector: Meta's Graph API `business_discovery` edge, straight into staged
// corpus entries plus a measured account baseline.
//
// WHY THIS FILE EXISTS, AND WHAT IT DELIBERATELY CANNOT DO. Read the second paragraph before
// using anything this writes.
//
// Instagram was never failing on popularity. Six of the thirteen hand-collected Instagram posts
// were genuinely big, well past the ten thousand engagement floor. Eleven of the thirteen were
// rejected because they carried no view count and no transcript: a caption over a Reel, stored as
// if it were the post. So the gap was never "find bigger posts", it was "record honest numbers
// and stop pretending a caption is a body".
//
// This collector fixes the first half and CANNOT fix the second. `business_discovery` returns a
// Reel's public view count, which nothing else we have does, so the view-to-follower bar finally
// runs on Instagram. It returns no spoken transcript, no caption track, no on-screen text and no
// carousel slide text, because no field for any of those exists anywhere in the API. Meta's own
// IG Media reference lists every public field and none of them is the words in the video or the
// words on the slide. So `media.body_is_complete` is FALSE on every entry this file writes,
// including single-image posts, where the caption may not be the substance and the API cannot
// tell us either way. Upgrading an entry to body-complete is human work through the existing
// `transcript_source: "manual"` path. There is no API route to it.
//
// WHAT THIS ROUTE PERMANENTLY DOES NOT RETURN. These are facts about Business Discovery, not
// gaps in this file, and none of them is worth re-investigating:
//
//   saved_count        Meta: "Only accessible by the media owner or an accepted collaborator. Not
//                      accessible through Business Discovery."
//   shares_count       Meta: "Not accessible through Business Discovery or hashtag API endpoints."
//                      This is why `metrics.shares` is null on every entry and never 0. A 0 would
//                      be a claim that nobody shared the post; null is the truth, which is that
//                      the number was never offered.
//   total_views_count  Meta: "Not accessible through Business Discovery or hashtag API endpoints.
//                      For Business Discovery, use `view_count` instead."
//   insights of any    Owner-only. Nothing on another creator's account exposes reach,
//   kind               impressions, saves, or watch time.
//   duration, width,   No field exists, so media.duration_seconds and media.aspect are null rather
//   height             than estimated from a thumbnail or a caption.
//
// Never fetched through a model-backed tool. A model-backed fetch once silently rewrote 14 of 15
// post bodies and attributed a stranger's comment to the author. This file reads Meta's JSON and
// copies fields across without touching them.

import "../util/env.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchWithRetry } from "../util/fetch-retry.js";
import { INBOX_DIR, makeId, normalizeHandle } from "./corpus.js";
import { BASELINES_PATH, appendBaseline, buildBaseline, type BaselineSamplePost } from "./baselines.js";
import { loadConfig } from "./collect.js";
import type { AccountBaseline, CorpusEntry, CorpusMedia, MediaForm, PatternMiningConfig } from "./types.js";

// `business_discovery` lives only on the Facebook-Login flavour of the Instagram API, so the host
// is graph.facebook.com and never graph.instagram.com. Meta's reference page says so in one line:
// "Available for the Instagram API with Facebook Login."
const API_HOST = "https://graph.facebook.com";

// The version Meta's own Business Discovery examples are written against as of 2026-08-23. v26.0
// exists; nothing this file reads is version-gated, because both `view_count` changelog entries
// say "applies to all versions". Override with IG_GRAPH_API_VERSION if a future version forces it.
export const DEFAULT_API_VERSION = "v25.0";

// Meta's own page size ceiling on the nested media edge. Asking for more is not refused, it is
// silently capped, so the collector pages instead.
const PAGE_SIZE = 25;

// How many recent posts to read per account by default. Twenty five is one page and is already
// enough for a median that one lucky post cannot move on its own.
export const DEFAULT_LIMIT = 25;

// Recorded on every entry so a reader knows exactly which route produced the numbers, without
// having to open this file.
export const ROUTE = `Meta Graph API business_discovery (${API_HOST}), Instagram API with Facebook Login. No transcript, caption track, on-screen text or carousel slide text exists on this route.`;

export interface InstagramCredentials {
  // A long-lived Facebook User access token. Never logged, never written to a file, never put in
  // an error message.
  accessToken: string;
  // Muxin's OWN Instagram professional account id. Every business_discovery query is performed on
  // this node, with the target creator named in the username parameter.
  igUserId: string;
  apiVersion: string;
}

// Reads the keys and refuses clearly when one is missing. The message is the setup guide, because
// the person reading it is the person who has to go and do the setup.
export function readCredentials(env: NodeJS.ProcessEnv = process.env): InstagramCredentials {
  const accessToken = env.IG_GRAPH_ACCESS_TOKEN?.trim();
  const igUserId = env.IG_GRAPH_USER_ID?.trim();
  const missing = [
    accessToken ? null : "IG_GRAPH_ACCESS_TOKEN",
    igUserId ? null : "IG_GRAPH_USER_ID",
  ].filter((name): name is string => name !== null);
  if (missing.length > 0) {
    throw new Error(
      `Missing ${missing.join(", ")} in .env.\n` +
        "business_discovery needs an Instagram professional account linked to a Facebook Page, plus a Meta app.\n" +
        "Standard Access is enough because only you use the app, so there is no App Review and no Business Verification.\n" +
        "  1. Instagram app, Settings, Account type and tools: switch to a Business or Creator account.\n" +
        "  2. Link that account to a Facebook Page you can administer.\n" +
        "  3. developers.facebook.com/apps: create an app, fill in Basic settings.\n" +
        "  4. In the App Dashboard add the Facebook Login for Business product. Defaults are fine.\n" +
        "  5. developers.facebook.com/tools/explorer: pick the app and generate a User token granting\n" +
        "     instagram_basic, instagram_manage_insights, pages_show_list, pages_read_engagement.\n" +
        "  6. GET /me/accounts for the Page id, then GET /<PAGE_ID>?fields=instagram_business_account\n" +
        "     for your IG user id. That id is IG_GRAPH_USER_ID.\n" +
        "  7. Explorer tokens die in about an hour. Exchange for a roughly 60 day one:\n" +
        "     GET /oauth/access_token?grant_type=fb_exchange_token&client_id=<APP_ID>\n" +
        "       &client_secret=<APP_SECRET>&fb_exchange_token=<SHORT_TOKEN>\n" +
        "     That long-lived token is IG_GRAPH_ACCESS_TOKEN.\n" +
        "See .env.example for the exact lines to copy.",
    );
  }
  return {
    accessToken: accessToken!,
    igUserId: igUserId!,
    apiVersion: env.IG_GRAPH_API_VERSION?.trim() || DEFAULT_API_VERSION,
  };
}

// The raw shape of one media object as business_discovery returns it. Every field is optional
// because Meta omits a field rather than nulling it, and a missing field must never become a
// guess. `view_count` in particular is returned for Reels and simply absent on everything else.
export interface IgMedia {
  id?: string;
  caption?: string;
  like_count?: number;
  comments_count?: number;
  view_count?: number;
  media_type?: string;
  media_product_type?: string;
  permalink?: string;
  timestamp?: string;
  username?: string;
  media_url?: string;
  thumbnail_url?: string;
  alt_text?: string;
  children?: { data?: { id?: string; media_type?: string }[] };
}

export interface IgAccount {
  id?: string;
  username?: string;
  name?: string;
  followers_count?: number;
  media_count?: number;
  media?: { data?: IgMedia[]; paging?: { cursors?: { after?: string; before?: string } } };
}

// Pulls the account object out of a business_discovery response. A response that is not one
// returns null rather than throwing, so the caller reports "nothing came back for this account"
// instead of a stack trace that reads like a bug in the collector.
export function parseDiscovery(json: unknown): IgAccount | null {
  const discovery = (json as { business_discovery?: unknown } | null)?.business_discovery;
  if (typeof discovery !== "object" || discovery === null || Array.isArray(discovery)) return null;
  return discovery as IgAccount;
}

export function mediaFromDiscovery(account: IgAccount | null): IgMedia[] {
  const data = account?.media?.data;
  return Array.isArray(data) ? data.filter((m): m is IgMedia => typeof m === "object" && m !== null) : [];
}

// business_discovery pages with `before`/`after` cursors and, unlike ordinary cursor pagination,
// returns no `next` url. Meta's reference says so outright, so the next page is built by hand from
// the `after` cursor.
export function afterCursor(account: IgAccount | null): string | null {
  const after = account?.media?.paging?.cursors?.after;
  return typeof after === "string" && after !== "" ? after : null;
}

// ISO date, not a timestamp, matching what every other corpus entry carries. Meta returns
// "2019-09-26T22:36:43+0000", which Date parses; a value it cannot parse becomes null rather than
// a plausible-looking wrong date.
export function postedDate(media: IgMedia): string | null {
  if (typeof media.timestamp !== "string" || media.timestamp === "") return null;
  const parsed = new Date(media.timestamp);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

export function caption(media: IgMedia): string {
  return typeof media.caption === "string" ? media.caption.trim() : "";
}

// Reels are the video product; a VIDEO posted to the feed is not a Reel and is not a short.
// Decided only from Meta's own two type fields, never inferred from a caption or a thumbnail.
export function isReel(media: IgMedia): boolean {
  return media.media_product_type === "REELS";
}

export function isVideo(media: IgMedia): boolean {
  return media.media_type === "VIDEO" || isReel(media);
}

// The engagement quantity a baseline is measured in here, and the same one outliers.ts computes
// for an entry with no view count: the public interaction counts that ARE recorded. Views are
// deliberately NOT part of it, because only Reels carry a view count on this route and a median
// that mixed views with likes would be measuring two different things and calling them one.
export function engagementOf(media: IgMedia): number | null {
  const parts = [media.like_count, media.comments_count].filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n),
  );
  return parts.length === 0 ? null : parts.reduce((sum, n) => sum + n, 0);
}

// What form the post took, decided only from fields Meta itself returns. Nothing here opens an
// image or plays a video, so `onscreen_text` is always null: unknown, never guessed.
//
// `body_is_complete` is false on every branch, and that is the point of the file. See the header.
export function mediaFor(media: IgMedia): CorpusMedia {
  const base: CorpusMedia = {
    form: "image",
    onscreen_text: null,
    description: null,
    // business_discovery returns no duration field for video of any kind, so a runtime here would
    // have to be estimated, and an estimated runtime is worse than an admitted unknown.
    duration_seconds: null,
    media_count: null,
    // Nothing on this route says whether a video carries burned-in or served captions.
    has_captions: null,
    // No width or height is returned either, so aspect is genuinely unknown. Reels are vertical by
    // product convention, but convention is not an observation.
    aspect: null,
    body_is_complete: false,
  };
  const children = Array.isArray(media.children?.data) ? media.children!.data!.length : null;

  if (media.media_type === "CAROUSEL_ALBUM") {
    return {
      ...base,
      form: "carousel",
      media_count: children,
      description:
        children === null
          ? "Carousel (media_type=CAROUSEL_ALBUM). The children edge returned nothing on this route, so even the slide COUNT is unknown. The API has no field for text typeset onto a slide, so slides 2..n are entirely uncollected."
          : `Carousel of ${children} slides (media_type=CAROUSEL_ALBUM, counted from the children edge). Only slide ids and image urls came back. The API has no field for text typeset onto a slide, so what any slide SAYS is uncollected.`,
    };
  }
  if (isReel(media)) {
    return {
      ...base,
      form: "short-video",
      media_count: 1,
      description:
        "Reel (media_product_type=REELS). body holds the creator's WRITTEN caption, never the spoken words: business_discovery returns no transcript, no caption track and no on-screen text. The hook, which is the first seconds of speech, is uncollected.",
    };
  }
  if (media.media_type === "VIDEO") {
    return {
      ...base,
      form: "video",
      media_count: 1,
      description:
        "Feed video (media_type=VIDEO, not REELS). body holds the creator's WRITTEN caption, never the spoken words: business_discovery returns no transcript and no caption track.",
    };
  }
  if (media.media_type === "IMAGE") {
    return {
      ...base,
      form: "image",
      media_count: 1,
      description:
        "Single image (media_type=IMAGE). The image was not retrieved or read, so any text typeset onto it is unknown, which is also why body_is_complete is false even though a caption is present.",
    };
  }
  return {
    ...base,
    form: "mixed",
    media_count: children,
    description: `Unrecognised media_type ${JSON.stringify(media.media_type ?? null)} (media_product_type ${JSON.stringify(media.media_product_type ?? null)}). Form was not determined, so nothing about the media is asserted.`,
  };
}

export interface EntryContext {
  // The target account as Meta itself spells it, with no leading @.
  handle: string;
  creator: string;
  niche: string;
  listing: string;
  rank: number;
  collectedAt: string;
  followers: number | null;
  // The measured account baseline where one was measured in this run. Used only to write the
  // multiple into `notes` in plain words; the honest computation lives in outliers.ts.
  baseline: AccountBaseline | null;
  // "baseline" when the window was staged whole and nobody picked the posts, "winner" when an
  // engagement floor filtered it. See toStagedEntries for why the two cannot be swapped.
  role: "winner" | "baseline";
  route: string;
}

// One media object becomes one staged corpus entry.
export function toStagedEntry(media: IgMedia, ctx: EntryContext): CorpusEntry {
  const url = typeof media.permalink === "string" ? media.permalink : "";
  const body = caption(media);
  const form = mediaFor(media);
  const video = isVideo(media);
  const views = typeof media.view_count === "number" && Number.isFinite(media.view_count) ? media.view_count : null;
  const likes = typeof media.like_count === "number" && Number.isFinite(media.like_count) ? media.like_count : null;
  const comments = typeof media.comments_count === "number" && Number.isFinite(media.comments_count) ? media.comments_count : null;
  const engagement = engagementOf(media);
  const multiple = ctx.baseline && engagement !== null && ctx.baseline.median > 0 ? engagement / ctx.baseline.median : null;

  const notes = [
    "PLATFORM: instagram",
    `Selection: position ${ctx.rank} in ${ctx.listing}, read ${ctx.collectedAt.slice(0, 10)}.`,
    ctx.role === "baseline"
      ? "sample.role is 'baseline' and not 'winner' ON PURPOSE. business_discovery cannot sort by performance, so this window is whatever the account posted most recently and nobody selected it for having travelled. That makes the account's other collected entries a legitimate denominator, which is exactly what a winners-only collection can never offer."
      : "sample.role is 'winner': an engagement floor was applied to this window, so these posts WERE selected for having travelled and their siblings are not a baseline.",
    ctx.baseline
      ? `Baseline: the full unfiltered window of ${ctx.baseline.sample_size} recent posts from this account (posted ${ctx.baseline.window_start} to ${ctx.baseline.window_end}) has a TRUE MEDIAN engagement of ${ctx.baseline.median} (likes plus comments).` +
        (multiple !== null ? ` This post's ${likes ?? 0} likes plus ${comments ?? 0} comments is about ${multiple.toFixed(1)}x that median.` : "")
      : "Baseline: not measured in this run.",
    views === null
      ? "metrics.views is null: Meta returns view_count for Reels only, and this post is not one."
      : "metrics.views holds Meta's view_count, which is available through business_discovery ONLY and only for Reels. Two caveats Meta states outright: it mixes PAID and organic views, and since June 2026 it can include Facebook views for video crossposted there.",
    "metrics.shares is null on every Instagram entry: Meta's IG Media reference says shares_count and saved_count are not accessible through Business Discovery.",
    video
      ? "BODY WARNING: body is the creator's written caption, not the spoken words. transcript_source is 'caption' for exactly that reason. Nothing downstream may read it as an opener or a hook."
      : "BODY WARNING: body is the caption. Any words typeset onto the image or the slides were not collected and are not in it.",
    `Route: ${ctx.route}`,
  ].join("\n");

  return {
    id: makeId("instagram", ctx.handle, url),
    platform: "instagram",
    handle: ctx.handle,
    creator: ctx.creator,
    niche: ctx.niche,
    url,
    posted_at: postedDate(media),
    collected_at: ctx.collectedAt,
    kind: video ? "video" : "text",
    body,
    // "caption" and not "captions": the two mean opposite things. This is the creator's written
    // caption and never their spoken words, which this route cannot reach at all.
    transcript_source: video ? "caption" : null,
    metrics: { views, likes, comments, shares: null, followers: ctx.followers },
    media: form,
    sample: { listing: ctx.listing, window: null, rank: ctx.rank, role: ctx.role },
    notes,
  };
}

// Turns the window into staged entries. A post with no caption at all is not staged: the corpus
// contract requires a non-empty body and there is nothing honest to put there, so it is reported
// by permalink for hand collection rather than filed with an invented one.
export function toStagedEntries(
  window: IgMedia[],
  ctx: Omit<EntryContext, "rank">,
  minEngagement: number,
): { entries: CorpusEntry[]; skippedNoCaption: string[]; skippedBelowFloor: number; skippedNoPermalink: number } {
  const entries: CorpusEntry[] = [];
  const skippedNoCaption: string[] = [];
  let skippedBelowFloor = 0;
  // The corpus dedupes on url, so a post with no permalink has no identity and cannot be stored.
  // Counted rather than dropped in silence, because a silent skip is how a run quietly loses posts.
  let skippedNoPermalink = 0;
  window.forEach((media, index) => {
    if (typeof media.permalink !== "string" || media.permalink === "") {
      skippedNoPermalink++;
      return;
    }
    if (minEngagement > 0 && (engagementOf(media) ?? 0) < minEngagement) {
      skippedBelowFloor++;
      return;
    }
    if (caption(media) === "") {
      skippedNoCaption.push(media.permalink);
      return;
    }
    entries.push(toStagedEntry(media, { ...ctx, rank: index + 1 }));
  });
  return { entries, skippedNoCaption, skippedBelowFloor, skippedNoPermalink };
}

// The unbiased half. Measured over the FULL window before any engagement floor is applied, which
// is what makes it a baseline rather than a median of whatever survived the filter.
export function toBaselineSample(window: IgMedia[]): BaselineSamplePost[] {
  const sample: BaselineSamplePost[] = [];
  for (const media of window) {
    if (engagementOf(media) === null) continue;
    // The raw counts, not a pre-summed figure. buildBaseline decides which of them the median is
    // measured on and records that decision in `terms`, and the winner's numerator is then built
    // from those same terms. Summing here would let the two sides drift apart again.
    //
    // `views` is null even on a Reel that has one, deliberately: Meta returns view_count for Reels
    // only, so a views median over a mixed window would be measuring two quantities and calling
    // them one. Instagram exposes no share count at all through business_discovery.
    sample.push({
      metrics: {
        views: null,
        likes: typeof media.like_count === "number" ? media.like_count : null,
        comments: typeof media.comments_count === "number" ? media.comments_count : null,
        shares: null,
      },
      posted_at: postedDate(media),
    });
  }
  return sample;
}

// ---------------------------------------------------------------------------------------------
// The network half. Everything above this line is pure and is what the tests exercise.
// ---------------------------------------------------------------------------------------------

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ClientOptions {
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  politenessMs?: number;
  log?: (line: string) => void;
}

// The per-media fields asked for. Every one of these is marked Public on Meta's IG Media
// reference, which is the condition for reading it through field expansion on someone else's
// account. Nothing here is an insights metric, because insights are owner-only.
export const MEDIA_FIELDS = [
  "id",
  "caption",
  "like_count",
  "comments_count",
  "view_count",
  "media_type",
  "media_product_type",
  "permalink",
  "timestamp",
  "username",
  "media_url",
  "thumbnail_url",
] as const;

// The two fields Meta documents as public but which nobody here has seen come back through
// business_discovery specifically. `children` is a public edge and the reference says public edges
// expand; community reports have long disagreed. `alt_text` is newer than most of this surface.
// Rather than assert either way, the client asks for both and drops BOTH on the one error that
// means "no such field", so a run degrades to a carousel with an unknown slide count instead of
// failing outright. Nothing in MEDIA_FIELDS above is optional: without those there is no entry.
export const OPTIONAL_FIELDS = ["alt_text", "children{id,media_type}"] as const;

export function buildFields(username: string, opts: { limit: number; after?: string | null; extras: boolean }): string {
  const fields = [...MEDIA_FIELDS, ...(opts.extras ? OPTIONAL_FIELDS : [])].join(",");
  const paging = [`limit(${opts.limit})`, opts.after ? `after(${opts.after})` : null].filter(Boolean).join(".");
  return `business_discovery.username(${username}){followers_count,media_count,username,name,media.${paging}{${fields}}}`;
}

export interface GraphError {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
}

export function graphError(json: unknown): GraphError | null {
  const error = (json as { error?: unknown } | null)?.error;
  if (typeof error !== "object" || error === null || Array.isArray(error)) return null;
  return error as GraphError;
}

// True for the one error that means a requested sub-field was not accepted, so the caller knows to
// retry without the optional ones rather than treating a recoverable shape problem as a dead
// account.
export function isUnknownFieldError(error: GraphError | null): boolean {
  if (!error || error.code !== 100) return false;
  const message = (error.message ?? "").toLowerCase();
  return message.includes("nonexistent field") || message.includes("unknown field") || message.includes("does not exist on type");
}

// Meta's throttling codes. 4 is app-level, 17 is user-level, 32 is the page-level bucket, 613 is
// the generic "calls to this api have exceeded the rate limit".
const THROTTLE_CODES = new Set([4, 17, 32, 613]);

// True when the failure is about the CALLER, not about the account being looked up: a dead token,
// a throttled app, a missing permission. This distinction is load-bearing in the smoke check.
// Without it a single expired token makes every seeded account report as "not a professional
// account", which sends the reader off to audit handles when the only thing wrong is a credential.
export function isCallerError(error: GraphError | null): boolean {
  if (!error) return false;
  const code = error.code ?? 0;
  return code === 190 || code === 10 || code === 200 || THROTTLE_CODES.has(code);
}

// Turns a Graph error into a message a person can act on, and never echoes the token. Meta's
// error text is included because it names the field or permission at fault, and it never contains
// the credential.
export function describeGraphError(error: GraphError, username: string): string {
  const code = error.code ?? 0;
  const detail = `${error.type ?? "Error"} code ${code}${error.error_subcode ? `/${error.error_subcode}` : ""}: ${error.message ?? "no message"}`;
  if (code === 190) {
    return (
      `Meta rejected the access token (${detail}).\n` +
      "Long-lived tokens last about 60 days. Mint a fresh one in the Graph API Explorer and exchange it again:\n" +
      "  GET /oauth/access_token?grant_type=fb_exchange_token&client_id=<APP_ID>&client_secret=<APP_SECRET>&fb_exchange_token=<SHORT_TOKEN>\n" +
      "Then replace IG_GRAPH_ACCESS_TOKEN in .env. Nothing partial was written."
    );
  }
  if (THROTTLE_CODES.has(code)) {
    return (
      `Meta throttled this run (${detail}).\n` +
      "Business Discovery falls under Platform Rate Limits, which are per app and reset on a rolling window.\n" +
      "Nothing partial was written. Run it again later."
    );
  }
  if (code === 10 || code === 200) {
    return (
      `Meta refused the request for permissions reasons (${detail}).\n` +
      "business_discovery needs instagram_basic, instagram_manage_insights and pages_read_engagement on the token,\n" +
      "and IG_GRAPH_USER_ID must be YOUR Instagram professional account id, not the target's."
    );
  }
  if (code === 110 || (error.message ?? "").toLowerCase().includes("cannot be loaded")) {
    return (
      `Meta returned nothing for @${username} (${detail}).\n` +
      "business_discovery only reads Instagram PROFESSIONAL accounts, Business or Creator. A personal account\n" +
      "returns nothing, and so does an age-gated one. Check the account type before assuming a collector fault."
    );
  }
  return `Meta returned an error for @${username} (${detail}).`;
}

export class InstagramClient {
  private readonly fetchImpl: FetchLike;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly politenessMs: number;
  private readonly log: (line: string) => void;
  // Flipped off permanently for the run the first time Meta refuses an optional sub-field, so one
  // rejection does not cost a retry on every later page and every later account.
  private extrasSupported = true;

  constructor(private readonly creds: InstagramCredentials, opts: ClientOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? ((input, init) => fetchWithRetry(input, init) as Promise<Response>);
    this.sleep = opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.politenessMs = opts.politenessMs ?? 500;
    this.log = opts.log ?? (() => {});
  }

  // Whether Meta accepted the optional fields (alt_text and the children edge) this run.
  get extrasAvailable(): boolean {
    return this.extrasSupported;
  }

  // One business_discovery read. The token goes in the query string because that is the only place
  // Graph accepts it, and the url is never logged for exactly that reason.
  private async request(fields: string, username: string): Promise<unknown> {
    const url = new URL(`${API_HOST}/${this.creds.apiVersion}/${this.creds.igUserId}`);
    url.searchParams.set("fields", fields);
    url.searchParams.set("access_token", this.creds.accessToken);
    const res = await this.fetchImpl(url.toString());
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new Error(`Meta returned HTTP ${res.status} with a body that was not JSON, for @${username}.`);
    }
    const error = graphError(json);
    if (error) {
      const err = new Error(describeGraphError(error, username)) as Error & { graph?: GraphError };
      err.graph = error;
      throw err;
    }
    if (!res.ok) throw new Error(`Meta returned HTTP ${res.status} for @${username} with no error object.`);
    if (this.politenessMs > 0) await this.sleep(this.politenessMs);
    return json;
  }

  // One page of an account's recent media, retrying once without the optional sub-fields if Meta
  // rejects them. Returns the account object so the caller gets followers_count off the same call.
  async page(username: string, opts: { limit: number; after?: string | null }): Promise<IgAccount | null> {
    const name = normalizeHandle(username);
    try {
      const json = await this.request(buildFields(name, { ...opts, extras: this.extrasSupported }), name);
      return parseDiscovery(json);
    } catch (err) {
      const error = (err as { graph?: GraphError }).graph ?? null;
      if (!this.extrasSupported || !isUnknownFieldError(error)) throw err;
      this.extrasSupported = false;
      this.log(
        "  Meta refused an optional sub-field (alt_text or children) inside business_discovery, so carousel slide counts will be unknown for the rest of this run. Slide TEXT was never available either way.",
      );
      const json = await this.request(buildFields(name, { ...opts, extras: false }), name);
      return parseDiscovery(json);
    }
  }

  // Walks the media edge until `limit` posts are in hand or the account runs out. Meta returns
  // recent media in reverse chronological order and offers no way to sort by performance, which is
  // why every window this returns is an unselected sample.
  async recentMedia(username: string, limit: number): Promise<{ account: IgAccount | null; media: IgMedia[] }> {
    const media: IgMedia[] = [];
    let account: IgAccount | null = null;
    let after: string | null = null;
    while (media.length < limit) {
      const page: IgAccount | null = await this.page(username, {
        limit: Math.min(PAGE_SIZE, limit - media.length),
        after,
      });
      if (page === null) break;
      if (account === null) account = page;
      const batch = mediaFromDiscovery(page);
      if (batch.length === 0) break;
      media.push(...batch);
      const next = afterCursor(page);
      if (!next) break;
      after = next;
    }
    return { account, media: media.slice(0, limit) };
  }
}

// ---------------------------------------------------------------------------------------------
// The command.
// ---------------------------------------------------------------------------------------------

// The niche an account is seeded under in config/pattern-mining.yaml. Not guessed: an account that
// is not in the config has no niche, and the run stops and says so rather than filing posts under
// a niche nobody chose.
export function nicheFor(config: PatternMiningConfig, handle: string): string | null {
  const wanted = normalizeHandle(handle);
  for (const account of config.accounts ?? []) {
    if (account.platform !== "instagram" || !account.handle) continue;
    if (normalizeHandle(account.handle) === wanted) return account.niche;
  }
  return null;
}

// Every instagram handle seeded in config/pattern-mining.yaml, so `--smoke` with no --account
// checks the whole seed list rather than whichever account someone happened to type.
export function seededHandles(config: PatternMiningConfig): string[] {
  const handles: string[] = [];
  for (const account of config.accounts ?? []) {
    if (account.platform !== "instagram" || !account.handle) continue;
    const handle = normalizeHandle(account.handle);
    if (handle !== "" && !handles.includes(handle)) handles.push(handle);
  }
  return handles;
}

export function creatorFor(config: PatternMiningConfig, handle: string): string | null {
  const wanted = normalizeHandle(handle);
  for (const account of config.accounts ?? []) {
    if (account.platform !== "instagram" || !account.handle) continue;
    if (normalizeHandle(account.handle) === wanted) return account.creator;
  }
  return null;
}

export interface InstagramArgs {
  accounts: string[];
  niche: string | null;
  limit: number;
  minEngagement: number;
  measureBaseline: boolean;
  outDir: string;
  baselinesPath: string;
  smoke: boolean;
}

export function parseInstagramArgs(argv: string[]): InstagramArgs {
  const args: InstagramArgs = {
    accounts: [],
    niche: null,
    limit: DEFAULT_LIMIT,
    minEngagement: 0,
    measureBaseline: true,
    outDir: INBOX_DIR,
    baselinesPath: BASELINES_PATH,
    smoke: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--account" && value) args.accounts.push(value), i++;
    else if (flag === "--niche" && value) (args.niche = value), i++;
    else if (flag === "--limit" && value) (args.limit = Number(value)), i++;
    else if (flag === "--min-engagement" && value) (args.minEngagement = Number(value)), i++;
    else if (flag === "--no-baseline") args.measureBaseline = false;
    else if (flag === "--out" && value) (args.outDir = value), i++;
    else if (flag === "--baselines" && value) (args.baselinesPath = value), i++;
    else if (flag === "--smoke") args.smoke = true;
  }
  return args;
}

export async function collectAccount(
  client: InstagramClient,
  handleInput: string,
  args: InstagramArgs,
  config: PatternMiningConfig,
  nowMs: number,
  log: (line: string) => void,
): Promise<{ entries: CorpusEntry[]; baseline: AccountBaseline | null }> {
  const handle = normalizeHandle(handleInput);
  const { account, media } = await client.recentMedia(handle, args.limit);
  if (account === null) {
    throw new Error(
      `Meta returned no business_discovery object for @${handle}. The account is probably not an Instagram professional (Business or Creator) account, or it is age-gated. Neither returns data on this route.`,
    );
  }
  const niche = args.niche ?? nicheFor(config, handle);
  if (!niche) {
    throw new Error(
      `@${handle} is not seeded in config/pattern-mining.yaml as an instagram account, so it has no niche. Add it there, or pass --niche <one of: ${(config.niches ?? []).join(", ")}>.`,
    );
  }
  const creator = creatorFor(config, handle) ?? (typeof account.name === "string" && account.name !== "" ? account.name : `@${handle}`);
  const followers = typeof account.followers_count === "number" ? account.followers_count : null;
  log(
    `@${handle}: ${followers === null ? "follower count not returned" : `${followers.toLocaleString("en-US")} followers`}, ${media.length} recent post(s) read, niche ${niche}.`,
  );

  const collectedAt = new Date(nowMs).toISOString();
  let baseline: AccountBaseline | null = null;
  if (args.measureBaseline) {
    baseline = buildBaseline({ platform: "instagram", handle }, toBaselineSample(media), {
      followers,
      collected_at: collectedAt,
      method:
        `Unbiased window: the ${media.length} most recent posts on @${handle}'s business_discovery media edge, which Meta returns in reverse chronological order with no way to sort by performance. ` +
        "No filter on engagement, form or topic: the flops belong in the median. " +
        "Measured in LIKES PLUS COMMENTS and not views, because Meta returns view_count for Reels only, so a views median over a mixed window would be measuring two different quantities and calling them one.",
    });
    if (baseline) {
      log(`  TRUE MEDIAN engagement: ${baseline.median} over ${baseline.sample_size} posts (${baseline.window_start} to ${baseline.window_end}).`);
    } else {
      log("  no post carried a like or comment count, so no baseline was written. Nothing was guessed.");
    }
  }

  const reels = media.filter(isReel).length;
  const withViews = media.filter((m) => typeof m.view_count === "number").length;
  log(`  ${reels} Reel(s) in the window, ${withViews} with a view_count returned.`);

  const listing =
    args.minEngagement > 0
      ? `business_discovery media edge, reverse chronological, filtered to posts with at least ${args.minEngagement} likes plus comments`
      : "business_discovery media edge, reverse chronological (Meta offers no performance sort, so nobody picked these)";
  const staged = toStagedEntries(
    media,
    {
      handle,
      creator,
      niche,
      listing,
      collectedAt,
      followers,
      baseline,
      // An engagement floor selects FOR having travelled, so applying one turns the window into a
      // winners list and the label has to change with it. Without a floor nobody picked these.
      role: args.minEngagement > 0 ? "winner" : "baseline",
      route: ROUTE,
    },
    args.minEngagement,
  );
  if (staged.skippedNoPermalink > 0) {
    log(`  ${staged.skippedNoPermalink} post(s) came back with no permalink, so they have no identity the corpus can dedupe on and were not staged.`);
  }
  if (staged.skippedBelowFloor > 0) {
    log(`  ${staged.skippedBelowFloor} post(s) below the ${args.minEngagement} engagement floor were not staged.`);
  }
  if (staged.skippedNoCaption.length > 0) {
    log(`  ${staged.skippedNoCaption.length} post(s) carried no caption at all, so there was nothing honest to store as a body. Collect these by hand if they matter:`);
    for (const permalink of staged.skippedNoCaption) log(`    ${permalink}`);
  }
  return { entries: staged.entries, baseline };
}

// Three states a field can be in, and they are three because two of them get confused constantly.
//
//   "value"  - the field came back carrying something.
//   "empty"  - the field came back and is null, an empty string, or an empty list. The API DOES
//              return it for this account; there is simply nothing in it.
//   "absent" - the key is not in the response at all. The API did not return this field here.
//
// "empty" and "absent" are different problems with different fixes. An empty alt_text means the
// creator never wrote one. An absent alt_text means the route does not serve it, and no amount of
// picking different accounts will change that. Anything that collapses the two sends the reader
// off to debug the wrong thing.
export type FieldState = "value" | "empty" | "absent";

export function fieldState(record: Record<string, unknown>, key: string): FieldState {
  if (!(key in record)) return "absent";
  const value = record[key];
  if (value === null || value === undefined) return "empty";
  if (typeof value === "string" && value.trim() === "") return "empty";
  if (Array.isArray(value) && value.length === 0) return "empty";
  // The children edge arrives as { data: [...] }, so an edge with no rows is empty, not a value.
  if (typeof value === "object") {
    const data = (value as { data?: unknown }).data;
    if (Array.isArray(data)) return data.length === 0 ? "empty" : "value";
  }
  return "value";
}

// Every field the smoke check reports on, in the order a reader wants them.
const SMOKE_FIELDS = [
  "caption",
  "like_count",
  "comments_count",
  "view_count",
  "media_type",
  "media_product_type",
  "permalink",
  "timestamp",
  "media_url",
  "thumbnail_url",
  "alt_text",
  "children",
] as const;

export interface SmokeAccountResult {
  handle: string;
  // False means business_discovery returned nothing for this handle. That has three causes and
  // the report names all three, because "the collector is broken" is not one of them.
  professional: boolean;
  followers: number | null;
  mediaRead: number;
  reels: number;
  reelsWithViews: number;
  // Per field: how many of the posts read returned a value, an empty, or nothing at all.
  fields: Map<string, { value: number; empty: number; absent: number }>;
  // Meta's own words when a handle could not be read, so a wrong handle is never reported as an
  // API fault.
  error: string | null;
}

export function summariseAccount(handle: string, account: IgAccount | null, media: IgMedia[]): SmokeAccountResult {
  const fields = new Map<string, { value: number; empty: number; absent: number }>();
  for (const field of SMOKE_FIELDS) fields.set(field, { value: 0, empty: 0, absent: 0 });
  for (const item of media) {
    for (const field of SMOKE_FIELDS) {
      const counts = fields.get(field)!;
      counts[fieldState(item as unknown as Record<string, unknown>, field)]++;
    }
  }
  return {
    handle,
    professional: account !== null,
    followers: typeof account?.followers_count === "number" ? account.followers_count : null,
    mediaRead: media.length,
    reels: media.filter(isReel).length,
    reelsWithViews: media.filter((m) => isReel(m) && fieldState(m as unknown as Record<string, unknown>, "view_count") === "value").length,
    fields,
    error: null,
  };
}

// A deliberately tiny live check, kept separate from collection and from the tests. It runs one
// business_discovery query per account and prints exactly what came back, which is the only way to
// settle three things the documentation cannot: whether each seeded handle is a professional
// account at all, whether view_count really arrives for its Reels, and whether the children edge
// expands here.
//
// It never prints the token, on any path, and never writes a file.
export async function smoke(client: InstagramClient, handles: string[], log: (line: string) => void): Promise<number> {
  const results: SmokeAccountResult[] = [];
  for (const input of handles) {
    const handle = normalizeHandle(input);
    try {
      const { account, media } = await client.recentMedia(handle, 5);
      results.push(summariseAccount(handle, account, media));
    } catch (err) {
      const error = (err as { graph?: GraphError }).graph ?? null;
      // A dead token or a throttled app is not a fact about this account, and marching on would
      // print "not a professional account" against every remaining handle. Stop and say what is
      // actually wrong, which is the same misattribution rule the unreadable-handle report follows,
      // pointed the other way.
      if (isCallerError(error)) {
        log("\nStopped before checking the rest. This failure is about the CALLER, not about any of these accounts:");
        log((err as Error).message);
        log("\nNothing above says anything about whether these handles are professional accounts. Fix the credential or wait out the throttle, then run the check again.");
        return 1;
      }
      results.push({
        handle,
        professional: false,
        followers: null,
        mediaRead: 0,
        reels: 0,
        reelsWithViews: 0,
        fields: new Map(),
        error: (err as Error).message,
      });
    }
  }

  log(`Optional fields (alt_text, children) accepted inside business_discovery this run: ${client.extrasAvailable ? "yes" : "no"}`);

  for (const result of results) {
    log(`\n@${result.handle}`);
    if (!result.professional) {
      // Never "the API failed". A seeded handle is not evidence the account exists or is the right
      // one: this project has already been burned by a handle that resolved to a different channel
      // and by two impostor accounts whose titles matched the real creator exactly.
      log("  READABLE: NO. business_discovery returned nothing for this handle.");
      log("  That means one of three things, and the API cannot tell them apart:");
      log("    1. the account is a personal account, not a Business or Creator account");
      log("    2. the account is age-gated, which Meta excludes from this route by design");
      log("    3. the handle in config/pattern-mining.yaml is wrong or belongs to someone else");
      log("  Check the profile by hand before treating this as a collector fault.");
      if (result.error) log(`  Meta said: ${result.error.split("\n")[0]}`);
      continue;
    }
    log(`  READABLE: YES, so it is an Instagram professional (Business or Creator) account.`);
    log(`  followers_count ${result.followers === null ? "NOT RETURNED" : result.followers.toLocaleString("en-US")}, ${result.mediaRead} recent post(s) read, ${result.reels} of them Reels.`);
    log(`  view_count returned on ${result.reelsWithViews} of ${result.reels} Reel(s).`);
    log("  field                 value  empty  absent");
    for (const field of SMOKE_FIELDS) {
      const counts = result.fields.get(field)!;
      const note =
        counts.absent === result.mediaRead && result.mediaRead > 0
          ? "  <- never returned for this account"
          : counts.empty > 0 && counts.value === 0
            ? "  <- returned but always empty"
            : "";
      log(`  ${field.padEnd(20)} ${String(counts.value).padStart(5)}  ${String(counts.empty).padStart(5)}  ${String(counts.absent).padStart(6)}${note}`);
    }
  }

  const unreadable = results.filter((r) => !r.professional);
  // Two different questions, answered separately, because a run that reaches here has already
  // proved the first one. Every credential failure aborts above with its own message, so getting
  // this far means the token and the IG user id were accepted. A seed that cannot be read after
  // that is a fact about the seed, and it must never be read as "my setup is broken".
  log("\nSETUP: working. The token and IG_GRAPH_USER_ID were accepted, or this run would have stopped above.");
  log(`SEEDS: ${results.length - unreadable.length} of ${results.length} account(s) readable through business_discovery.`);
  if (unreadable.length > 0) {
    log(`Not readable: ${unreadable.map((r) => "@" + r.handle).join(", ")}. See the three causes above; none of them is an API failure or a setup problem.`);
    log("A nonzero exit code below means at least one SEED needs attention, never that the setup failed.");
  }
  log("\nNo transcript, caption track, on-screen text or slide text appears anywhere above, because no such field exists on this route.");
  log("Every entry the collector writes will therefore be body_is_complete: false. That is the honest value, not a gap in the run.");
  return unreadable.length > 0 ? 1 : 0;
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const args = parseInstagramArgs(argv);
  const log = (line: string) => console.log(line);

  if (args.accounts.length === 0 && !args.smoke) {
    console.error("Usage: npm run patterns:instagram -- --account @adriennemareebrown [--account @sharonsaysso] [--limit 25]");
    console.error("       npm run patterns:instagram -- --smoke   (checks every seeded instagram account: readable or not, and which fields came back)");
    console.error("       npm run patterns:instagram -- --smoke --account @someone   (just this one)");
    return 1;
  }

  let creds: InstagramCredentials;
  try {
    creds = readCredentials();
  } catch (err) {
    console.error((err as Error).message);
    return 1;
  }

  const client = new InstagramClient(creds, { log });

  if (args.smoke) {
    // With no --account, check the whole seed list. A seeded handle is not evidence the account
    // exists or is the right one, and this is the cheapest place to find that out.
    const handles = args.accounts.length > 0 ? args.accounts : seededHandles(loadConfig());
    if (handles.length === 0) {
      console.error("No instagram accounts are seeded in config/pattern-mining.yaml, and none were passed with --account.");
      return 1;
    }
    try {
      return await smoke(client, handles, log);
    } catch (err) {
      console.error((err as Error).message);
      return 1;
    }
  }

  const config = loadConfig();
  const nowMs = Date.now();
  const staged: CorpusEntry[] = [];
  let failed = 0;

  for (const account of args.accounts) {
    try {
      const result = await collectAccount(client, account, args, config, nowMs, log);
      if (result.baseline) appendBaseline(result.baseline, args.baselinesPath);
      staged.push(...result.entries);
      log(`  staged ${result.entries.length} post(s).`);
    } catch (err) {
      failed++;
      console.error(`${account}: ${(err as Error).message}`);
    }
  }

  if (staged.length === 0) {
    console.error("Nothing was staged.");
    return failed > 0 ? 1 : 0;
  }

  mkdirSync(args.outDir, { recursive: true });
  const stamp = new Date(nowMs).toISOString().slice(0, 10);
  const slug = args.accounts.map((a) => normalizeHandle(a)).join("-").slice(0, 60);
  const outPath = join(args.outDir, `instagram-${slug}-${stamp}.json`);
  writeFileSync(outPath, JSON.stringify(staged, null, 2) + "\n", "utf8");

  log(`\nStaged ${staged.length} entries to ${outPath}.`);
  log("Every one of them is body_is_complete: false. The API has no transcript and no slide text, so that is the honest value and not a gap in this run.");
  log("Nothing has entered the corpus yet. Validate and append them with:");
  log("  npm run patterns:collect");
  return failed > 0 ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().then((code) => {
    process.exitCode = code;
  });
}
