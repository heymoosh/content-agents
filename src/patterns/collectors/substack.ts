import { parseHTML } from "linkedom";
import type { BrowserContext, Page } from "playwright";
import { looksLikeAuthWall } from "../../pull/diagnose.js";
import { PullError } from "../../pull/errors.js";
import { makeId, normalizeHandle } from "../corpus.js";
import type { CorpusEntry } from "../types.js";
import {
  canonicalUrl,
  defaultSleep,
  politeDelay,
  type CollectOptions,
  type CollectResult,
  type CollectorAccount,
  type PatternCollector,
  type StopSignal,
} from "./shared.js";

// WHAT IS ACTUALLY VISIBLE to a logged-in NON-OWNER of a public Substack publication.
//
//   body       YES for a free post, in full. NO for a paid-subscriber post: Substack serves only
//              the public preview, and the preview is what gets recorded, with a note saying so.
//              We do not read past a paywall, ever.
//   posted_at  YES, exact. post_date is a real ISO timestamp.
//   views      NO. Substack publishes no per-post view or open count to anyone but the writer, on
//              any public surface. ALWAYS null. It is never filled in from the like count.
//   likes      YES, the reaction total.
//   comments   YES.
//   shares     NO. Substack exposes no public share or restack count on the archive record, so
//              this is null rather than zero.
//   followers  RARELY. A subscriber count appears on a public profile only when the writer has
//              chosen to show it. Absent by default, so this normally falls back to the config
//              seed.
//
// HOW THIS DIFFERS from src/pull/platforms/substack.ts, which pulls Muxin's own numbers: that
// adapter reads the WRITER DASHBOARD API (/api/v1/post_management/published), which is owner-only
// and carries real views, opens, clicks and signups. None of that is reachable for someone else's
// publication. This reads the PUBLIC archive API instead, which anyone can read and which
// deliberately carries no reach numbers at all.
//
// THE PUBLIC ENDPOINTS, and what was actually checked against a live publication:
//   https://substack.com/api/v1/user/<handle>/public_profile      OBSERVED 2026-08-22
//     -> the profile, and the publication its posts live on
//   https://<publication>/api/v1/archive?sort=new&limit=N&offset=0  OBSERVED 2026-08-22
//     -> the post list, with reaction and comment counts. Read live against
//        davidpepper.substack.com, sarahfay.substack.com and growthinreverse.substack.com, all
//        HTTP 200 carrying canonical_url, reaction_count, comment_count, post_date and
//        publishedBylines.
//   https://<publication>/api/v1/posts/<slug>                       UNVERIFIED
//     -> one post, with body_html when the post is free. Not traceable to a live read in this
//        build, so it stays first-pass.
// They are fetched from inside the logged-in page so the session and the origin match, the same
// way the pull adapter does it. That is not a detail: the first live run fetched cross-origin and
// collected nothing at all, every time, silently. Refine from a live `--headed` run if the shapes
// have moved.

const NAME = "substack-public-archive";
const VERSION = "1";

function profileUrl(handle: string): string {
  return `https://substack.com/@${normalizeHandle(handle)}`;
}

// What collect() captures and parse() reads. One JSON string, so the whole interpretation step is
// a pure function over a fixture.
export interface SubstackCapture {
  // The public profile record, when it could be read. Only ever used for a subscriber count.
  profile: { subscriberCount?: number | null } | null;
  // The archive records, newest first.
  posts: unknown[];
  // slug -> body_html, for the free posts whose full text we were able to read.
  bodies: Record<string, string>;
}

function htmlToText(html: string): string {
  // linkedom only fills document.body when it is given a whole document, so wrap the fragment.
  const { document } = parseHTML(`<html><body>${html}</body></html>`);
  // Keep paragraph boundaries. Hook structure is the point of this corpus and it lives in the
  // line breaks as much as in the words.
  for (const br of Array.from(document.querySelectorAll("br"))) br.replaceWith("\n");
  for (const block of Array.from(document.querySelectorAll("p, div, li, h1, h2, h3, h4, blockquote"))) {
    block.append("\n\n");
  }
  return (document.body?.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

// reaction_count when Substack sends it, otherwise the sum of the per-emoji reactions map.
function reactionTotal(post: Record<string, unknown>): number | null {
  const direct = num(post.reaction_count);
  if (direct !== null) return direct;
  const reactions = post.reactions;
  if (typeof reactions !== "object" || reactions === null) return null;
  let total = 0;
  let sawOne = false;
  for (const value of Object.values(reactions as Record<string, unknown>)) {
    const n = num(value);
    if (n === null) continue;
    total += n;
    sawOne = true;
  }
  return sawOne ? total : null;
}

// PURE. Given the captured JSON, return one entry per readable post.
export function parse(
  raw: string,
  account: CollectorAccount,
  opts: { now?: () => Date } = {},
): CorpusEntry[] {
  const capture = JSON.parse(raw) as SubstackCapture;
  const now = opts.now ?? (() => new Date());
  const collectedAt = now().toISOString();
  const handle = normalizeHandle(account.handle);
  const profileFollowers = num(capture.profile?.subscriberCount);

  const entries: CorpusEntry[] = [];
  const seen = new Set<string>();

  for (const item of capture.posts ?? []) {
    if (typeof item !== "object" || item === null) continue;
    const post = item as Record<string, unknown>;

    // A podcast or video post's real content is audio, and its transcript is not in this API.
    // Recording it as a text post with the show notes as the body would misrepresent it.
    const type = typeof post.type === "string" ? post.type : "";
    if (type === "podcast" || type === "video") continue;

    // AUTHORSHIP. A publication's archive is not automatically one person's writing: publications
    // carry guest posts and co-authors, and an entry filed under the wrong creator is worse than a
    // missing one, because it poisons that account's baseline and every pattern read off it.
    // OBSERVED 2026-08-22: the archive record carries publishedBylines[{handle, name}], and the
    // handle is the same profile handle config/pattern-mining.yaml uses.
    const bylines = Array.isArray(post.publishedBylines) ? post.publishedBylines : [];
    const bylineHandles = bylines
      .map((b) => (typeof b === "object" && b !== null ? (b as Record<string, unknown>).handle : null))
      .filter((h): h is string => typeof h === "string" && h.trim() !== "")
      .map(normalizeHandle);
    // Only skip when the record TELLS us it is someone else's. An archive with no byline data at
    // all is unverifiable rather than wrong, so it is kept and the entry says so.
    if (bylineHandles.length > 0 && !bylineHandles.includes(handle)) continue;

    const url = typeof post.canonical_url === "string" ? canonicalUrl(post.canonical_url) : "";
    if (url === "" || seen.has(url)) continue;

    const slug = typeof post.slug === "string" ? post.slug : "";
    const title = typeof post.title === "string" ? post.title.trim() : "";
    const subtitle = typeof post.subtitle === "string" ? post.subtitle.trim() : "";
    const bodyHtml = slug !== "" ? capture.bodies?.[slug] : undefined;
    // The preview Substack serves publicly when the full text was not readable.
    const preview = typeof post.truncated_body_text === "string"
      ? post.truncated_body_text.trim()
      : typeof post.description === "string"
        ? post.description.trim()
        : "";
    const paywalled = post.audience === "only_paid" || post.audience === "founding";
    const fullText = bodyHtml ? htmlToText(bodyHtml) : "";
    const bodyText = fullText !== "" ? fullText : preview;

    // Title and subtitle carry the hook on Substack, so they lead the body rather than being
    // dropped. A post with neither a title nor any text is skipped.
    const body = [title, subtitle, bodyText].filter((part) => part !== "").join("\n\n");
    if (body === "") continue;

    const notes: string[] = [];
    if (bylineHandles.length === 0) {
      notes.push("authorship not verifiable: the archive record carried no bylines");
    }
    if (paywalled) notes.push("paid post; body is the public preview only, nothing behind the paywall was read");
    else if (fullText === "") notes.push("full text was not readable; body is the public preview only");
    if (profileFollowers === null && account.followers !== null) {
      notes.push("followers taken from the config seed; the public profile showed no subscriber count");
    }

    seen.add(url);
    entries.push({
      id: makeId("substack", handle, url),
      platform: "substack",
      handle: account.handle,
      creator: account.creator,
      niche: account.niche,
      url,
      posted_at: typeof post.post_date === "string" ? post.post_date : null,
      collected_at: collectedAt,
      kind: "text",
      transcript_source: null,
      body,
      metrics: {
        // ALWAYS null on Substack for a non-owner. Not a parsing gap, a platform fact.
        views: null,
        likes: reactionTotal(post),
        comments: num(post.comment_count),
        shares: null,
        followers: profileFollowers ?? account.followers,
      },
      collection_method: "auto",
      collected_by: `${NAME}@${VERSION}`,
      ...(notes.length > 0 ? { notes: notes.join("; ") } : {}),
    });
  }

  return entries;
}

// A JSON fetch made from inside the logged-in page, so it carries the session and shares the
// origin. Returns the parsed body, or a stop signal when the platform tells us to back off.
async function fetchJson(
  page: Page,
  url: string,
): Promise<{ data: unknown; stop: StopSignal | null }> {
  const result = (await page.evaluate(async (target: string) => {
    const response = await fetch(target, { credentials: "include", headers: { accept: "application/json" } });
    const text = await response.text();
    return { status: response.status, text };
  }, url)) as { status: number; text: string };

  if (result.status === 429) {
    return { data: null, stop: { reason: "rate_limited", detail: `substack answered 429 for ${url}` } };
  }
  if (result.status === 403) {
    return { data: null, stop: { reason: "blocked", detail: `substack answered 403 for ${url}` } };
  }
  if (result.status >= 400) return { data: null, stop: null };
  try {
    return { data: JSON.parse(result.text), stop: null };
  } catch {
    return { data: null, stop: null };
  }
}

// The publication a profile's posts actually live on. The archive API is served from the
// publication origin, not from substack.com, so this has to be resolved before anything else.
function publicationOriginFrom(profile: unknown): string | null {
  if (typeof profile !== "object" || profile === null) return null;
  const record = profile as Record<string, unknown>;
  const candidates: unknown[] = [record.primaryPublication];
  if (Array.isArray(record.publicationUsers)) {
    for (const entry of record.publicationUsers) {
      if (typeof entry === "object" && entry !== null) candidates.push((entry as Record<string, unknown>).publication);
    }
  }
  for (const candidate of candidates) {
    if (typeof candidate !== "object" || candidate === null) continue;
    const pub = candidate as Record<string, unknown>;
    if (typeof pub.custom_domain === "string" && pub.custom_domain !== "") return `https://${pub.custom_domain}`;
    if (typeof pub.subdomain === "string" && pub.subdomain !== "") return `https://${pub.subdomain}.substack.com`;
  }
  return null;
}

export const substack: PatternCollector = {
  platform: "substack",
  name: NAME,
  version: VERSION,
  profileUrl,
  parse,

  async collect(
    context: BrowserContext,
    account: CollectorAccount,
    opts: CollectOptions,
  ): Promise<CollectResult> {
    const sleep = opts.sleep ?? defaultSleep;
    const page = context.pages()[0] ?? (await context.newPage());
    const handle = normalizeHandle(account.handle);
    const url = profileUrl(account.handle);

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    } catch (cause) {
      throw new PullError("NETWORK", `Couldn't load ${url}`, {
        hint: "Check your connection / that substack.com opens in a normal browser.",
        cause,
      });
    }

    if (looksLikeAuthWall(page.url())) {
      throw new PullError("SESSION_EXPIRED", `Substack redirected to a sign-in wall (${page.url()})`, {
        hint: "Run `npm run pull:login -- substack` and sign in again.",
      });
    }

    // 1) The profile, for the publication origin and any public subscriber count.
    const profileFetch = await fetchJson(page, `https://substack.com/api/v1/user/${handle}/public_profile`);
    if (profileFetch.stop) return { entries: [], stop: profileFetch.stop };
    const origin = publicationOriginFrom(profileFetch.data);
    if (!origin) {
      throw new PullError("UI_CHANGED", `Couldn't find a publication for substack profile @${handle}`, {
        hint: `Expected a primaryPublication or publicationUsers entry on the public_profile response. Either the handle in config/pattern-mining.yaml is wrong, or the response shape moved. Re-check src/patterns/collectors/substack.ts.`,
      });
    }
    await sleep(politeDelay(opts.delayMs));

    // Move the page ONTO the publication before asking it for anything. The archive and post
    // endpoints are served from the publication origin, not from substack.com, so fetching them
    // from a page still sitting on substack.com would be a cross-origin request with credentials
    // and would be refused unless Substack happens to send permissive CORS headers. Navigating
    // first costs one polite page load and removes the dependency on that entirely.
    try {
      await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 30_000 });
    } catch (cause) {
      throw new PullError("NETWORK", `Couldn't load the publication at ${origin}`, {
        hint: `Resolved @${handle} to ${origin} from the public profile, but that host did not load.`,
        cause,
      });
    }

    // 2) The archive list. One request for the whole account.
    const archiveFetch = await fetchJson(
      page,
      `${origin}/api/v1/archive?sort=new&limit=${opts.limit}&offset=0`,
    );
    if (archiveFetch.stop) return { entries: [], stop: archiveFetch.stop };
    const posts = Array.isArray(archiveFetch.data) ? archiveFetch.data : [];
    if (posts.length === 0) {
      throw new PullError("UI_CHANGED", `The archive at ${origin} returned no posts`, {
        hint: "Expected an array from /api/v1/archive. Re-check the endpoint in src/patterns/collectors/substack.ts.",
      });
    }

    // 3) One request per FREE post for its full text, paced. A paid post is skipped here on
    //    purpose: we take its public preview from the archive record and never ask for more.
    const bodies: Record<string, string> = {};
    let stop: StopSignal | null = null;
    for (const item of posts.slice(0, opts.limit)) {
      if (typeof item !== "object" || item === null) continue;
      const post = item as Record<string, unknown>;
      const slug = typeof post.slug === "string" ? post.slug : "";
      if (slug === "" || post.audience === "only_paid" || post.audience === "founding") continue;
      await sleep(politeDelay(opts.delayMs));
      const postFetch = await fetchJson(page, `${origin}/api/v1/posts/${slug}`);
      if (postFetch.stop) {
        stop = postFetch.stop;
        break;
      }
      const body = (postFetch.data as Record<string, unknown> | null)?.body_html;
      if (typeof body === "string" && body !== "") bodies[slug] = body;
    }

    const capture: SubstackCapture = {
      profile: (profileFetch.data as SubstackCapture["profile"]) ?? null,
      posts: posts.slice(0, opts.limit),
      bodies,
    };
    return { entries: parse(JSON.stringify(capture), account, { now: opts.now }), stop };
  },
};
