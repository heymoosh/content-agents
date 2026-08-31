// The reddit collector: Reddit's own OAuth JSON API, straight into staged corpus entries plus a
// measured community baseline.
//
// WHY THIS FILE EXISTS AT ALL, in one paragraph, because it is the whole point.
//
// The first reddit pass read RSS and HTML. RSS carries bodies and no scores, so ranking had to be
// repaired by hand, and the outlier step measured each collected post against its siblings. Every
// sibling was also a top-of-year post, so r/ADHD's biggest post of the year scored 2.2x. Against
// the community's true median of 3 the same post is about 4095x. The sibling number was not a
// small error, it was the wrong question. So this collector pulls TWO samples: the top-of-year
// winners, which become corpus entries, and an unbiased window of ordinary posts, which never
// enters the corpus and instead produces one AccountBaseline. Every entry records which sample it
// came from in `sample.role`, so nothing downstream has to infer it.
//
// Never fetched through a model-backed tool. A model-backed fetch once silently rewrote 14 of 15
// post bodies and attributed a stranger's comment to the author. This file uses the JSON API and
// copies fields across without touching them.

import "../util/env.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchWithRetry } from "../util/fetch-retry.js";
import { INBOX_DIR, makeId, normalizeHandle, readCorpus } from "./corpus.js";
import { BASELINES_PATH, appendBaseline, buildBaseline, type BaselineSamplePost } from "./baselines.js";
import { recordedBaselineMultiple } from "./outliers.js";
import { loadConfig } from "./collect.js";
import type {
  AccountBaseline,
  BaselineTerm,
  CorpusEntry,
  CorpusMedia,
  MediaAspect,
  MediaForm,
  PatternMiningConfig,
} from "./types.js";

// Reddit's own hosts. Tokens are minted on www and every read goes to oauth, which is the
// documented split for a script app.
const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const API_BASE = "https://oauth.reddit.com";

// Posts younger than this are not votes yet. Reddit's /new listing is minutes old at the top, and
// a post at score 1 because nobody has seen it would drag a community median toward 1 and inflate
// every multiple measured against it. The hand-collected baselines used "at least a few days old
// so votes had settled"; this is that rule, written down.
export const DEFAULT_MIN_AGE_DAYS = 3;

// Enough posts that a median is not moved by one lucky thread. The hand windows used 162 and 163.
export const DEFAULT_BASELINE_SAMPLE = 150;

// Reddit's own maximum page size on a listing.
const PAGE_SIZE = 100;

export interface RedditCredentials {
  clientId: string;
  clientSecret: string;
  userAgent: string;
}

// Reads the three keys and refuses clearly when one is missing. The message names the page that
// creates them, because the person reading it is the person who has to go make the app.
//
// Values are never logged, never written to a file, and never put in an error message.
export function readCredentials(env: NodeJS.ProcessEnv = process.env): RedditCredentials {
  const clientId = env.REDDIT_CLIENT_ID?.trim();
  const clientSecret = env.REDDIT_CLIENT_SECRET?.trim();
  const userAgent = env.REDDIT_USER_AGENT?.trim();
  const missing = [
    clientId ? null : "REDDIT_CLIENT_ID",
    clientSecret ? null : "REDDIT_CLIENT_SECRET",
    userAgent ? null : "REDDIT_USER_AGENT",
  ].filter((name): name is string => name !== null);
  if (missing.length > 0) {
    throw new Error(
      `Missing ${missing.join(", ")} in .env.\n` +
        "Create a free script app at https://www.reddit.com/prefs/apps (button: 'create another app...'),\n" +
        "choose type 'script', set the redirect uri to http://localhost:8080, and copy the two values it shows:\n" +
        "  REDDIT_CLIENT_ID      the string under the app name, directly below 'personal use script'\n" +
        "  REDDIT_CLIENT_SECRET  the field labelled 'secret'\n" +
        "  REDDIT_USER_AGENT     a description you write, in Reddit's required format:\n" +
        "                        platform:app-id:version (by /u/your-reddit-username)\n" +
        "Add the Reddit variables to the repository .env.",
    );
  }
  return { clientId: clientId!, clientSecret: clientSecret!, userAgent: userAgent! };
}

// The raw fields this collector reads off a Reddit listing child. Everything is optional because
// Reddit omits fields rather than nulling them, and a missing field must never become a guess.
export interface RedditPost {
  id?: string;
  name?: string;
  title?: string;
  selftext?: string;
  author?: string;
  subreddit?: string;
  subreddit_name_prefixed?: string;
  permalink?: string;
  url?: string;
  score?: number;
  upvote_ratio?: number;
  num_comments?: number;
  created_utc?: number;
  is_self?: boolean;
  is_video?: boolean;
  is_gallery?: boolean;
  post_hint?: string;
  stickied?: boolean;
  pinned?: boolean;
  distinguished?: string | null;
  removed_by_category?: string | null;
  crosspost_parent?: string;
  poll_data?: unknown;
  gallery_data?: { items?: unknown[] };
  media?: { reddit_video?: { duration?: number; width?: number; height?: number } };
  media_metadata?: Record<string, unknown>;
}

// Pulls the post objects out of a listing response. A response that is not a listing returns an
// empty array rather than throwing, so one odd page never loses a whole run, and the caller sees
// zero posts instead of a plausible-looking partial.
export function parseListing(json: unknown): { posts: RedditPost[]; after: string | null } {
  const root = json as { kind?: string; data?: { children?: unknown[]; after?: string | null } } | null;
  const children = root?.data?.children;
  if (!Array.isArray(children)) return { posts: [], after: null };
  const posts: RedditPost[] = [];
  for (const child of children) {
    const data = (child as { kind?: string; data?: RedditPost } | null)?.data;
    if (data && typeof data === "object") posts.push(data);
  }
  return { posts, after: root?.data?.after ?? null };
}

export function subscribersFromAbout(json: unknown): number | null {
  const subscribers = (json as { data?: { subscribers?: unknown } } | null)?.data?.subscribers;
  return typeof subscribers === "number" && Number.isFinite(subscribers) && subscribers >= 0 ? subscribers : null;
}

// The canonical prefixed name as Reddit itself writes it, which is also the exact casing the
// config uses. r/yimby really is lowercase and r/AskReddit really is not, so this is read off the
// platform rather than reconstructed from the argument someone typed.
export function prefixedNameFromAbout(json: unknown, fallback: string): string {
  const data = (json as { data?: { display_name_prefixed?: unknown; display_name?: unknown } } | null)?.data;
  if (typeof data?.display_name_prefixed === "string" && data.display_name_prefixed.trim() !== "") {
    return data.display_name_prefixed;
  }
  if (typeof data?.display_name === "string" && data.display_name.trim() !== "") return `r/${data.display_name}`;
  return fallback;
}

// Whether a post belongs in an UNBIASED window. The filters are all about selection, not quality:
//
//   - a stickied or pinned post sits at the top of the community because a moderator put it there,
//     so its score is not a sample of what the community does with an ordinary post
//   - a removed post's score stopped accumulating when it was removed
//   - a post younger than minAgeSeconds has not finished being voted on
//
// Nothing here filters on score, form, or topic. The median has to include the boring posts and
// the flops, because those are most of what a community actually publishes and the whole point of
// the baseline is to say what ordinary looks like.
export function isEligibleBaselinePost(
  post: RedditPost,
  opts: { nowSeconds: number; minAgeSeconds: number },
): boolean {
  if (typeof post.score !== "number" || !Number.isFinite(post.score)) return false;
  if (post.stickied === true || post.pinned === true) return false;
  if (typeof post.removed_by_category === "string" && post.removed_by_category !== "") return false;
  if (typeof post.created_utc !== "number" || !Number.isFinite(post.created_utc)) return false;
  return opts.nowSeconds - post.created_utc >= opts.minAgeSeconds;
}

// Turns an eligible sample into the shape buildBaseline wants: the same four counts a corpus entry
// carries, plus a date. No text.
//
// The mapping is the one the entries themselves use, so both sides of a baseline division are
// describing the same fields: reddit's score is the like count, and reddit publishes neither a
// view count nor a share count, so those are null. Saying null is a statement, not an omission:
// buildBaseline reads it and leaves those terms out of the median, and the winner's numerator is
// then built from the remaining terms only.
export function toBaselineSample(posts: RedditPost[]): BaselineSamplePost[] {
  return posts.map((post) => ({
    metrics: {
      views: null,
      likes: post.score as number,
      comments: typeof post.num_comments === "number" ? post.num_comments : null,
      shares: null,
    },
    posted_at: postedDate(post),
  }));
}

// ISO date, not a timestamp, matching what the hand-collected reddit entries already carry.
export function postedDate(post: RedditPost): string | null {
  if (typeof post.created_utc !== "number" || !Number.isFinite(post.created_utc)) return null;
  return new Date(post.created_utc * 1000).toISOString().slice(0, 10);
}

function isVideoPost(post: RedditPost): boolean {
  return post.is_video === true || post.post_hint === "hosted:video" || post.post_hint === "rich:video";
}

function selftext(post: RedditPost): string {
  const text = typeof post.selftext === "string" ? post.selftext.trim() : "";
  // Reddit keeps the field and fills it with these markers when the body is gone. They are not a
  // body, so they are treated as no body at all.
  if (text === "[removed]" || text === "[deleted]") return "";
  return text;
}

function aspectOf(width: number | undefined, height: number | undefined): MediaAspect | null {
  if (typeof width !== "number" || typeof height !== "number" || width <= 0 || height <= 0) return null;
  if (height > width) return "vertical";
  if (width > height) return "horizontal";
  return "square";
}

// What form the post took, decided only from fields Reddit itself returns. Nothing here opens an
// image or a video, so `onscreen_text` is always null: unknown, never guessed.
export function mediaFor(post: RedditPost): CorpusMedia {
  const empty: CorpusMedia = {
    form: "link-preview",
    onscreen_text: null,
    description: null,
    duration_seconds: null,
    media_count: null,
    has_captions: null,
    aspect: null,
    body_is_complete: false,
  };
  const body = selftext(post);

  if (post.poll_data !== undefined && post.poll_data !== null) {
    return {
      ...empty,
      form: "poll",
      description: "Poll post (poll_data present). The options carry the post and were not collected.",
    };
  }
  if (post.is_gallery === true) {
    const count = Array.isArray(post.gallery_data?.items) ? post.gallery_data!.items!.length : null;
    return {
      ...empty,
      form: "carousel",
      media_count: count,
      description: "Reddit gallery post (is_gallery). The images were not retrieved, so any text typeset onto them is unknown.",
    };
  }
  if (isVideoPost(post)) {
    const video = post.media?.reddit_video;
    const duration = typeof video?.duration === "number" ? video.duration : null;
    const aspect = aspectOf(video?.width, video?.height);
    // A vertical minute or less is a short, and a longer or non-vertical upload is not. Split only
    // where both numbers are known, because guessing turns a 20-minute upload into a short.
    const form: MediaForm = duration !== null && duration <= 60 && aspect === "vertical" ? "short-video" : "video";
    return {
      ...empty,
      form,
      duration_seconds: duration,
      aspect,
      description:
        post.post_hint === "rich:video"
          ? "Embedded video from another host (post_hint=rich:video). No transcript route; body holds the post title only."
          : "Native Reddit video (v.redd.it). No transcript route; body holds the post title only.",
    };
  }
  if (post.post_hint === "image" || /\.(jpg|jpeg|png|webp)$/i.test(post.url ?? "")) {
    return {
      ...empty,
      form: "image",
      media_count: 1,
      description: "Image post. The image itself was not retrieved or read, so any text typeset onto it is unknown.",
    };
  }
  if (/\.(gif|gifv)$/i.test(post.url ?? "")) {
    return { ...empty, form: "gif", media_count: 1, description: "Animated image post. The image was not retrieved or read." };
  }
  if (post.is_self === true) {
    return {
      ...empty,
      form: "text-only",
      // The one form where the body really is the whole post, and only when there is a body. A
      // self post with an empty selftext is a title and nothing else, so it is not complete.
      body_is_complete: body !== "",
      description:
        body === ""
          ? "Reddit self post with an empty body (is_self, selftext empty). The title is the entire post."
          : "Reddit self (text) post, determined from the API's is_self flag: a text body and no attached media.",
    };
  }
  return {
    ...empty,
    form: "link-preview",
    description:
      typeof post.crosspost_parent === "string"
        ? "Crosspost, recorded by its own fields. The linked post was not collected."
        : "Link post. The substance sits at the linked page, which was not collected.",
  };
}

// The terms a baseline counted, in words a person reads, e.g. "upvotes plus comments".
function readableTerms(terms: BaselineTerm[]): string {
  const words: Record<BaselineTerm, string> = { views: "views", likes: "upvotes", comments: "comments", shares: "shares" };
  const named = terms.map((term) => words[term]);
  if (named.length <= 1) return named[0] ?? "nothing";
  return `${named.slice(0, -1).join(", ")} plus ${named[named.length - 1]}`;
}

export interface EntryContext {
  // The community as Reddit writes it, e.g. "r/ADHD".
  handle: string;
  niche: string;
  listing: string;
  window: string | null;
  rank: number;
  collectedAt: string;
  subscribers: number | null;
  // The measured community baseline, where one was measured in this run. Used only to write the
  // multiple into `notes` in plain words; the honest computation lives in outliers.ts.
  baseline: AccountBaseline | null;
  route: string;
}

// One listing child becomes one staged corpus entry.
//
// The url is written against old.reddit.com deliberately. The corpus dedupes on the exact url
// string and the 25 reddit entries already collected are all old.reddit urls, so emitting
// www.reddit.com here would re-append every one of them as a new post.
export function toStagedEntry(post: RedditPost, ctx: EntryContext): CorpusEntry {
  const title = typeof post.title === "string" ? post.title : "";
  const body = selftext(post);
  const media = mediaFor(post);
  const url = `https://old.reddit.com${post.permalink ?? ""}`;
  const isVideo = media.form === "video" || media.form === "short-video";
  const score = typeof post.score === "number" ? post.score : null;
  const comments = typeof post.num_comments === "number" ? post.num_comments : null;

  const entry: CorpusEntry = {
    id: makeId("reddit", ctx.handle, url),
    platform: "reddit",
    handle: ctx.handle,
    creator: `u/${post.author ?? "unknown"}`,
    niche: ctx.niche,
    url,
    posted_at: postedDate(post),
    collected_at: ctx.collectedAt,
    kind: isVideo ? "video" : "text",
    // A titled post with no body of its own copies the title in, which is the convention the
    // hand-collected reddit entries already use, and media.body_is_complete stays false so nothing
    // downstream reads that title as a whole post.
    body: body !== "" ? body : title,
    // "caption" and not "captions": this is the creator's written title, never their spoken words.
    transcript_source: isVideo ? "caption" : null,
    title,
    metrics: {
      views: null,
      likes: score,
      comments,
      shares: null,
      followers: ctx.subscribers,
      upvote_ratio: typeof post.upvote_ratio === "number" ? post.upvote_ratio : null,
    },
    media,
    sample: { listing: ctx.listing, window: ctx.window, rank: ctx.rank, role: "winner" },
  };

  // The plain-words version of the number, and it is computed by the same function the outlier
  // step uses, over the same terms the baseline recorded. Nothing here does its own arithmetic,
  // because a note that disagrees with the report is worse than a note with no number in it.
  const recorded = ctx.baseline ? recordedBaselineMultiple(entry, ctx.baseline) : null;
  const termWords = ctx.baseline ? readableTerms(ctx.baseline.terms) : "";
  entry.notes = [
    "PLATFORM: reddit",
    `Community post, not a creator account: the community ${ctx.handle} is in handle, the poster u/${post.author ?? "unknown"} is in creator.`,
    `Post title (Reddit's title is a separate field from the body, and on Reddit it is most of the craft): ${JSON.stringify(title)}`,
    `Selection: position ${ctx.rank} in ${ctx.handle}'s ${ctx.listing} listing${ctx.window ? ` (t=${ctx.window})` : ""}, read ${ctx.collectedAt.slice(0, 10)}.`,
    ctx.baseline
      ? `Baseline: an unbiased window of ${ctx.baseline.sample_size} posts from ${ctx.handle}'s /new listing (posted ${ctx.baseline.window_start} to ${ctx.baseline.window_end}), all settled, has a TRUE MEDIAN of ${ctx.baseline.median}, counting ${termWords}.` +
        (recorded !== null
          ? ` This post is about ${recorded.multiple.toFixed(1)}x that community median, counted the same way.`
          : " This post could not be measured against it, because it is missing one of the counts the median was measured on.")
      : "Baseline: not measured in this run. Any multiple against this account's other collected entries is a multiple against other winners, not against the community.",
    "metrics.likes holds Reddit's score (upvotes minus downvotes) as the API reports it. metrics.upvote_ratio holds upvote_ratio. Reddit publishes no view count and no share count, so views and shares are null; metrics.followers holds the subreddit's subscriber count where the API returned one.",
    `Route: ${ctx.route}`,
  ].join("\n");

  return entry;
}

// ---------------------------------------------------------------------------------------------
// The network half. Everything above this line is pure and is what the tests exercise.
// ---------------------------------------------------------------------------------------------

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ClientOptions {
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  // A deliberate pause between calls. Reddit's free tier is generous but shared, and a collector
  // that empties its bucket in one burst is the reason limits get tightened.
  politenessMs?: number;
  now?: () => number;
  log?: (line: string) => void;
}

// Bare community name from anything a person might type: "r/ADHD", "/r/ADHD", "ADHD".
export function subredditName(input: string): string {
  return input.trim().replace(/^\/?r\//i, "").replace(/\/$/, "");
}

export class RedditClient {
  private token: string | null = null;
  private tokenExpiresAt = 0;
  private readonly fetchImpl: FetchLike;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly politenessMs: number;
  private readonly now: () => number;
  private readonly log: (line: string) => void;

  constructor(private readonly creds: RedditCredentials, opts: ClientOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? ((input, init) => fetchWithRetry(input, init) as Promise<Response>);
    this.sleep = opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.politenessMs = opts.politenessMs ?? 1000;
    this.now = opts.now ?? (() => Date.now());
    this.log = opts.log ?? (() => {});
  }

  // Application-only OAuth, the flow Reddit documents for a confidential "script" app. No Reddit
  // account password is involved and no user data is reachable with the token it returns.
  //
  // The secret goes in the Basic auth header and nowhere else. Neither it nor the token is ever
  // logged, and a failed exchange reports the status and Reddit's own short error code only.
  async authorize(): Promise<void> {
    if (this.token !== null && this.now() < this.tokenExpiresAt) return;
    const basic = Buffer.from(`${this.creds.clientId}:${this.creds.clientSecret}`).toString("base64");
    const res = await this.fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": this.creds.userAgent,
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) {
      const code = res.status;
      let reason = "";
      try {
        const body = (await res.json()) as { error?: unknown };
        if (typeof body?.error === "string") reason = `: ${body.error}`;
      } catch {
        // A non-JSON error body tells us nothing extra, and dumping it risks printing whatever
        // Reddit echoed back, so the status alone is the whole message.
      }
      throw new Error(
        `Reddit refused the token request (HTTP ${code}${reason}).\n` +
          (code === 401
            ? "A 401 here means the client id or secret is wrong, or the app is not type 'script'. Re-copy both from https://www.reddit.com/prefs/apps."
            : "Check REDDIT_USER_AGENT is in the format platform:app-id:version (by /u/username); Reddit rejects generic agents."),
      );
    }
    const body = (await res.json()) as { access_token?: string; expires_in?: number };
    if (typeof body.access_token !== "string" || body.access_token === "") {
      throw new Error("Reddit returned no access token. Nothing was collected.");
    }
    this.token = body.access_token;
    // A minute of slack, so a long run never sends a token that expires mid-flight.
    const lifetimeMs = (typeof body.expires_in === "number" ? body.expires_in : 3600) * 1000;
    this.tokenExpiresAt = this.now() + Math.max(lifetimeMs - 60_000, 0);
  }

  // Reddit reports the state of the caller's bucket on every response. Honouring it is cheaper
  // than being throttled: when the remaining allowance runs out, wait for the reset the server
  // named rather than retrying into a wall.
  private async respectRateLimit(res: Response): Promise<void> {
    const remaining = Number(res.headers.get("x-ratelimit-remaining"));
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    if (Number.isFinite(remaining) && remaining <= 1 && Number.isFinite(reset) && reset > 0) {
      const waitMs = Math.min(reset * 1000 + 1000, 120_000);
      this.log(`Reddit rate limit almost empty. Waiting ${Math.round(waitMs / 1000)}s for the window to reset.`);
      await this.sleep(waitMs);
      return;
    }
    if (this.politenessMs > 0) await this.sleep(this.politenessMs);
  }

  async get(path: string, params: Record<string, string | number | undefined> = {}): Promise<unknown> {
    await this.authorize();
    const url = new URL(API_BASE + path);
    // raw_json=1 stops Reddit HTML-escaping &, < and > inside post text. Without it a body comes
    // back with &amp; in it and the corpus stores something the author never typed.
    url.searchParams.set("raw_json", "1");
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const res = await this.fetchImpl(url.toString(), {
      headers: { Authorization: `bearer ${this.token}`, "User-Agent": this.creds.userAgent },
    });
    if (!res.ok) {
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after"));
        throw new Error(
          `Reddit rate limited this run (HTTP 429)${Number.isFinite(retryAfter) ? `, asking for ${retryAfter}s` : ""}. Nothing partial was written. Run it again later.`,
        );
      }
      if (res.status === 403 || res.status === 404) {
        throw new Error(`Reddit returned HTTP ${res.status} for ${path}. The community may be private, quarantined, banned, or misspelled.`);
      }
      throw new Error(`Reddit returned HTTP ${res.status} for ${path}.`);
    }
    const json = (await res.json()) as unknown;
    await this.respectRateLimit(res);
    return json;
  }

  async about(sub: string): Promise<unknown> {
    return this.get(`/r/${subredditName(sub)}/about`);
  }

  // Walks a listing page by page until `limit` posts are in hand or the listing runs out.
  async listing(
    sub: string,
    listing: string,
    opts: { limit: number; window?: string | null },
  ): Promise<RedditPost[]> {
    const name = subredditName(sub);
    const posts: RedditPost[] = [];
    let after: string | null = null;
    while (posts.length < opts.limit) {
      const page: unknown = await this.get(`/r/${name}/${listing}`, {
        limit: Math.min(PAGE_SIZE, opts.limit - posts.length),
        t: opts.window ?? undefined,
        after: after ?? undefined,
        count: posts.length,
      });
      const parsed = parseListing(page);
      if (parsed.posts.length === 0) break;
      posts.push(...parsed.posts);
      if (!parsed.after) break;
      after = parsed.after;
    }
    return posts.slice(0, opts.limit);
  }

  // The unbiased half of the collection: ordinary posts from /new, old enough that their votes
  // have settled. Pages are walked from the newest backwards, and only settled posts are kept, so
  // the first page or two typically contribute nothing at all. That is the intended behaviour and
  // not a fault.
  async baselineSample(
    sub: string,
    opts: { targetSample: number; minAgeSeconds: number; nowSeconds: number; maxPages?: number },
  ): Promise<{ eligible: RedditPost[]; scanned: number; pages: number }> {
    const name = subredditName(sub);
    const maxPages = opts.maxPages ?? 12;
    const eligible: RedditPost[] = [];
    let after: string | null = null;
    let scanned = 0;
    let pages = 0;
    while (eligible.length < opts.targetSample && pages < maxPages) {
      const page: unknown = await this.get(`/r/${name}/new`, {
        limit: PAGE_SIZE,
        after: after ?? undefined,
        count: scanned,
      });
      const parsed = parseListing(page);
      pages++;
      if (parsed.posts.length === 0) break;
      scanned += parsed.posts.length;
      for (const post of parsed.posts) {
        if (isEligibleBaselinePost(post, { nowSeconds: opts.nowSeconds, minAgeSeconds: opts.minAgeSeconds })) {
          eligible.push(post);
        }
      }
      if (!parsed.after) break;
      after = parsed.after;
    }
    return { eligible: eligible.slice(0, opts.targetSample), scanned, pages };
  }
}

// ---------------------------------------------------------------------------------------------
// The command.
// ---------------------------------------------------------------------------------------------

// The niche a community is seeded under in config/pattern-mining.yaml. Not guessed: a community
// that is not in the config has no niche, and the run stops and says so rather than filing posts
// under a niche nobody chose.
export function nicheFor(config: PatternMiningConfig, handle: string): string | null {
  const wanted = normalizeHandle(handle);
  for (const account of config.accounts ?? []) {
    if (account.platform !== "reddit" || !account.handle) continue;
    if (normalizeHandle(account.handle) === wanted) return account.niche;
  }
  return null;
}

export interface RedditArgs {
  subs: string[];
  niche: string | null;
  listing: string;
  window: string | null;
  limit: number;
  baselineSample: number;
  minAgeDays: number;
  measureBaseline: boolean;
  outDir: string;
  baselinesPath: string;
  corpusPath: string | null;
  seedFromNotes: boolean;
}

export function parseRedditArgs(argv: string[]): RedditArgs {
  const args: RedditArgs = {
    subs: [],
    niche: null,
    listing: "top",
    window: "year",
    limit: 10,
    baselineSample: DEFAULT_BASELINE_SAMPLE,
    minAgeDays: DEFAULT_MIN_AGE_DAYS,
    measureBaseline: true,
    outDir: INBOX_DIR,
    baselinesPath: BASELINES_PATH,
    corpusPath: null,
    seedFromNotes: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--sub" && value) args.subs.push(value), i++;
    else if (flag === "--niche" && value) (args.niche = value), i++;
    else if (flag === "--listing" && value) (args.listing = value), i++;
    else if (flag === "--window" && value) (args.window = value === "all" ? "all" : value), i++;
    else if (flag === "--limit" && value) (args.limit = Number(value)), i++;
    else if (flag === "--baseline-sample" && value) (args.baselineSample = Number(value)), i++;
    else if (flag === "--min-age-days" && value) (args.minAgeDays = Number(value)), i++;
    else if (flag === "--no-baseline") args.measureBaseline = false;
    else if (flag === "--out" && value) (args.outDir = value), i++;
    else if (flag === "--baselines" && value) (args.baselinesPath = value), i++;
    else if (flag === "--corpus" && value) (args.corpusPath = value), i++;
    else if (flag === "--seed-baselines-from-notes") args.seedFromNotes = true;
  }
  return args;
}

// A one-time bridge, not part of the collector.
//
// The 25 reddit entries collected by hand before this file existed carry their measured community
// median in prose inside `notes`, e.g. "an unbiased window of 163 posts from r/ADHD's /new listing
// ... has a TRUE MEDIAN score of 3". Those medians are real measurements and there is no reason to
// re-measure them, but nothing can read prose, so the outlier step was still dividing by the
// median of the winners. This lifts each one into a real AccountBaseline record.
//
// `scores` comes out empty because the individual sample scores were never written down, only the
// median. That is recorded in `method` rather than filled with anything invented.
export function baselinesFromNotes(entries: CorpusEntry[], collectedAt: string): AccountBaseline[] {
  const found = new Map<string, AccountBaseline>();
  for (const entry of entries) {
    if (entry.platform !== "reddit" || typeof entry.notes !== "string") continue;
    const key = normalizeHandle(entry.handle);
    if (found.has(key)) continue;
    const median = entry.notes.match(/TRUE MEDIAN (?:score|engagement) of (\d+(?:\.\d+)?)/);
    if (!median) continue;
    const size = entry.notes.match(/window of (\d+) posts/);
    const window = entry.notes.match(/\(posted (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})\)/);
    found.set(key, {
      platform: "reddit",
      handle: entry.handle,
      metric: "engagement",
      // The hand pass measured the median of the UPVOTE score alone; it never wrote down the
      // comment counts of that window. Saying so here is not a caveat in prose, it is the thing
      // that makes the number safe: a winner is now divided by this median on upvotes alone too,
      // so the two sides count the same thing and the multiple is exact rather than inflated.
      terms: ["likes"],
      median: Number(median[1]),
      sample_size: size ? Number(size[1]) : 0,
      window_start: window ? window[1] : null,
      window_end: window ? window[2] : null,
      scores: [],
      followers: null,
      method:
        "Lifted from the hand-collected notes of the 2026-08-23 old.reddit pass: an unbiased /new window of settled posts. " +
        "The individual scores were never recorded, only the median, so `scores` is empty rather than reconstructed. " +
        "The median counts UPVOTES ONLY, which is recorded in `terms`, so every multiple taken against it counts upvotes " +
        "only on both sides. A collector-measured baseline counts comments too; re-measure with npm run patterns:reddit " +
        "to replace this one with a wider sample and its own scores.",
      collected_at: collectedAt,
    });
  }
  return [...found.values()];
}

export async function collectSubreddit(
  client: RedditClient,
  sub: string,
  args: RedditArgs,
  config: PatternMiningConfig,
  nowMs: number,
  log: (line: string) => void,
): Promise<{ entries: CorpusEntry[]; baseline: AccountBaseline | null }> {
  const about = await client.about(sub);
  const handle = prefixedNameFromAbout(about, `r/${subredditName(sub)}`);
  const subscribers = subscribersFromAbout(about);
  const niche = args.niche ?? nicheFor(config, handle);
  if (!niche) {
    throw new Error(
      `${handle} is not seeded in config/pattern-mining.yaml, so it has no niche. Add it there, or pass --niche <one of: ${(config.niches ?? []).join(", ")}>.`,
    );
  }
  log(`${handle}: ${subscribers === null ? "subscriber count not returned" : `${subscribers.toLocaleString("en-US")} subscribers`}, niche ${niche}.`);

  let baseline: AccountBaseline | null = null;
  if (args.measureBaseline) {
    const nowSeconds = Math.floor(nowMs / 1000);
    const sample = await client.baselineSample(sub, {
      targetSample: args.baselineSample,
      minAgeSeconds: args.minAgeDays * 86_400,
      nowSeconds,
    });
    log(`  baseline: scanned ${sample.scanned} posts from /new over ${sample.pages} page(s), ${sample.eligible.length} settled and eligible.`);
    baseline = buildBaseline({ platform: "reddit", handle }, toBaselineSample(sample.eligible), {
      followers: subscribers,
      collected_at: new Date(nowMs).toISOString(),
      method:
        `Unbiased window: ${handle}'s /new listing, every post at least ${args.minAgeDays} day(s) old so votes had settled. ` +
        "Stickied, pinned and removed posts excluded. No filter on score, form or topic: the flops belong in the median.",
    });
    if (baseline) {
      log(`  TRUE MEDIAN score: ${baseline.median} over ${baseline.sample_size} posts (${baseline.window_start} to ${baseline.window_end}).`);
    } else {
      log("  no settled posts found, so no baseline was written. Nothing was guessed.");
    }
  }

  const posts = await client.listing(sub, args.listing, { limit: args.limit, window: args.window });
  const collectedAt = new Date(nowMs).toISOString();
  const route = `Reddit OAuth JSON API (${API_BASE}), script app, application-only token.`;
  const entries = posts.map((post, index) =>
    toStagedEntry(post, {
      handle,
      niche,
      listing: args.listing,
      window: args.window,
      rank: index + 1,
      collectedAt,
      subscribers,
      baseline,
      route,
    }),
  );
  return { entries, baseline };
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const args = parseRedditArgs(argv);
  const log = (line: string) => console.log(line);

  if (args.seedFromNotes) {
    const entries = readCorpus(args.corpusPath ?? undefined);
    const baselines = baselinesFromNotes(entries, new Date().toISOString());
    for (const baseline of baselines) {
      appendBaseline(baseline, args.baselinesPath);
      log(`${baseline.handle}: median ${baseline.median} over ${baseline.sample_size} posts, lifted from hand-collected notes.`);
    }
    log(`\nWrote ${baselines.length} baseline(s) to ${args.baselinesPath}. Run npm run patterns:outliers to see the multiples they produce.`);
    return 0;
  }

  if (args.subs.length === 0) {
    console.error("Usage: npm run patterns:reddit -- --sub r/ADHD [--sub r/civictech] [--limit 10] [--window year] [--min-age-days 3]");
    console.error("       npm run patterns:reddit -- --seed-baselines-from-notes   (one-time: lift the hand-measured medians into the baseline store)");
    return 1;
  }

  let creds: RedditCredentials;
  try {
    creds = readCredentials();
  } catch (err) {
    console.error((err as Error).message);
    return 1;
  }

  const config = loadConfig();
  const client = new RedditClient(creds, { log });
  const nowMs = Date.now();
  const staged: CorpusEntry[] = [];
  let failed = 0;

  for (const sub of args.subs) {
    try {
      const result = await collectSubreddit(client, sub, args, config, nowMs, log);
      if (result.baseline) appendBaseline(result.baseline, args.baselinesPath);
      staged.push(...result.entries);
      log(`  staged ${result.entries.length} post(s) from the ${args.listing} listing.`);
    } catch (err) {
      failed++;
      console.error(`${sub}: ${(err as Error).message}`);
    }
  }

  if (staged.length === 0) {
    console.error("Nothing was staged.");
    return failed > 0 ? 1 : 0;
  }

  mkdirSync(args.outDir, { recursive: true });
  const stamp = new Date(nowMs).toISOString().slice(0, 10);
  const slug = args.subs.map((sub) => subredditName(sub).toLowerCase()).join("-").slice(0, 60);
  const outPath = join(args.outDir, `reddit-${slug}-${stamp}.json`);
  writeFileSync(outPath, JSON.stringify(staged, null, 2) + "\n", "utf8");

  log(`\nStaged ${staged.length} entries to ${outPath}.`);
  log("Nothing has entered the corpus yet. Validate and append them with:");
  log("  npm run patterns:collect");
  return failed > 0 ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().then((code) => {
    process.exitCode = code;
  });
}
