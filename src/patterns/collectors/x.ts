import { parseHTML } from "linkedom";
import { join } from "node:path";
import type { BrowserContext, Page } from "playwright";
import { captureDiagnostics, looksLikeAuthWall } from "../../pull/diagnose.js";
import { PullError } from "../../pull/errors.js";
import { makeId, normalizeHandle } from "../corpus.js";
import type { CorpusEntry } from "../types.js";
import {
  authorFromPermalink,
  blockSignal,
  canonicalUrl,
  countFromAriaLabel,
  defaultSleep,
  mergeByUrl,
  parseCompactNumber,
  politeDelay,
  type CollectOptions,
  type CollectResult,
  type CollectorAccount,
  type PatternCollector,
} from "./shared.js";

// WHAT IS ACTUALLY VISIBLE to a logged-in NON-OWNER on a public x.com profile.
//
//   body       YES. The post text is right there.
//   posted_at  YES, exact. Each post's permalink wraps a <time datetime="..."> with a real
//              timestamp, so this is read, never inferred.
//   views      YES, and x is the ONLY one of the three text platforms where this is true. X shows
//              a public view count on posts. Two honest caveats. First, it is X's public "Views"
//              figure, which is the impression count X chooses to publish, not the owner-only
//              analytics number, and the two do not always agree. Second, it is absent on some
//              posts and post types, and when it is absent the field is null. It is NEVER filled
//              in from likes.
//   likes      YES.
//   comments   YES, the reply count.
//   shares     YES, the repost count. Quotes are counted separately by X and are not added in.
//   followers  YES, from the profile header, but ROUNDED by X for display ("12.3K"), so treat it
//              as approximate. Falls back to the config seed when the header is not in the capture.
//
// HOW THIS DIFFERS from src/pull/platforms/x.ts, which pulls Muxin's own numbers: that adapter
// downloads the owner-only Analytics > Content CSV with true impressions and engagement rates.
// None of that exists for someone else's account. This reads the public profile timeline instead.
//
// SELECTORS OBSERVED 2026-08-22 against live logged-in profile pages. The run read 24 posts with
// real view, like, reply and repost counts, which is where the measured `view_follower_ratio` in
// config/pattern-mining.yaml came from. They follow X's data-testid contract, which is the most
// stable thing X exposes, and the counts are read from the action bar's accessible name because
// that carries EXACT integers where the visible text is rounded.
//
// Observed does not mean permanent. X can change its markup any week, and the block, rate-limit
// and auth-wall paths below were NOT exercised on that run, so those are still first-pass. Refine
// from a live `--headed` diagnostics run when something stops matching.

const NAME = "x-public-profile";
const VERSION = "1";

function profileUrl(handle: string): string {
  return `https://x.com/${normalizeHandle(handle)}`;
}

// PURE. Given the captured profile HTML, return one entry per ORIGINAL post by this account.
export function parse(
  html: string,
  account: CollectorAccount,
  opts: { now?: () => Date } = {},
): CorpusEntry[] {
  const { document } = parseHTML(html);
  const now = opts.now ?? (() => new Date());
  const collectedAt = now().toISOString();
  const wanted = normalizeHandle(account.handle);

  // Read the follower count off the profile header. Rounded, and absent on a partial capture.
  const followerLink =
    document.querySelector('a[href$="/verified_followers"]') ??
    document.querySelector('a[href$="/followers"]');
  const headerFollowers = parseCompactNumber(followerLink?.textContent ?? null);

  const entries: CorpusEntry[] = [];
  const seen = new Set<string>();

  for (const article of Array.from(document.querySelectorAll('article[data-testid="tweet"]'))) {
    // Skip promoted posts. An ad is not this creator's organic reach and would poison the
    // account's baseline median.
    if (article.querySelector('[data-testid="placementTracking"]')) continue;

    const socialContext = article.querySelector('[data-testid="socialContext"]')?.textContent ?? "";
    // Skip pinned posts for the same reason: a pinned post collects views for months and would
    // sit far above the account's real typical post, dragging the baseline the wrong way.
    if (/pinned/i.test(socialContext)) continue;
    // Skip reposts of other people's work. We are studying what THIS account wrote.
    if (/repost|retweet/i.test(socialContext)) continue;

    const timeEl = article.querySelector('a[href*="/status/"] time[datetime]');
    const anchor = timeEl?.closest('a[href*="/status/"]');
    const href = anchor?.getAttribute("href");
    if (!href) continue;

    const author = authorFromPermalink(href);
    // A card whose permalink belongs to someone else is a repost or an embedded quote. Either way
    // it is not a post by the account we are collecting.
    if (!author || author !== wanted) continue;

    const url = canonicalUrl(new URL(href, "https://x.com").toString());
    if (seen.has(url)) continue;

    // The FIRST tweetText is the outer post. A quoted tweet nests a second one, which belongs to
    // the quoted author, not to this account.
    const body = (article.querySelector('[data-testid="tweetText"]')?.textContent ?? "").trim();
    // An image-only or video-only post has no text to learn a pattern from. Skipping it is
    // honest; writing an empty body would be a record that fails the corpus's own validation.
    if (body === "") continue;

    // The action bar's accessible name carries every count as an exact integer, e.g.
    // "12 replies, 5 reposts, 340 likes, 6 bookmarks, 12345 views". A missing label word means
    // the platform did not show us that number, so the field is null.
    const ariaLabel = article.querySelector('[role="group"][aria-label]')?.getAttribute("aria-label") ?? null;

    seen.add(url);
    entries.push({
      id: makeId("x", wanted, url),
      platform: "x",
      handle: account.handle,
      creator: account.creator,
      niche: account.niche,
      url,
      posted_at: timeEl?.getAttribute("datetime") ?? null,
      collected_at: collectedAt,
      kind: "text",
      transcript_source: null,
      body,
      metrics: {
        views: countFromAriaLabel(ariaLabel, "views"),
        likes: countFromAriaLabel(ariaLabel, "likes"),
        comments: countFromAriaLabel(ariaLabel, "replies"),
        shares: countFromAriaLabel(ariaLabel, "reposts"),
        followers: headerFollowers ?? account.followers,
      },
      collection_method: "auto",
      collected_by: `${NAME}@${VERSION}`,
      ...(headerFollowers === null && account.followers !== null
        ? { notes: "followers taken from the config seed; the profile header was not in the capture" }
        : {}),
    });
  }

  return entries;
}

// How many times we ask the timeline for more before giving up. A hard cap, not a loop until
// satisfied: a bounded number of requests is the whole point of being polite.
const MAX_SCROLLS = 4;

async function pageText(page: Page): Promise<string> {
  try {
    return await page.locator("body").innerText({ timeout: 5_000 });
  } catch {
    return "";
  }
}

export const x: PatternCollector = {
  platform: "x",
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
    const url = profileUrl(account.handle);

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    } catch (cause) {
      throw new PullError("NETWORK", `Couldn't load ${url}`, {
        hint: "Check your connection / that x.com opens in a normal browser.",
        cause,
      });
    }
    await sleep(4_000); // the timeline hydrates client-side

    if (looksLikeAuthWall(page.url())) {
      throw new PullError("SESSION_EXPIRED", `X redirected to a login wall (${page.url()})`, {
        hint: "Run `npm run pull:login -- x` and sign in again.",
      });
    }

    // Told to back off? Stop this platform for the run. We never retry past a block and we never
    // try to solve a challenge.
    const blocked = blockSignal(await pageText(page));
    if (blocked) return { entries: [], stop: blocked };

    // Accumulated across scrolls, because the timeline is virtualized and a later parse does not
    // contain the earlier posts. See mergeByUrl.
    const collected = new Map<string, CorpusEntry>();
    mergeByUrl(collected, parse(await page.content(), account, { now: opts.now }));
    for (let scroll = 0; scroll < MAX_SCROLLS && collected.size < opts.limit; scroll++) {
      await page.mouse.wheel(0, 3_000);
      await sleep(politeDelay(opts.delayMs));
      const stop = blockSignal(await pageText(page));
      if (stop) return { entries: [...collected.values()].slice(0, opts.limit), stop };
      // A scroll that surfaces no new post means the feed has stopped giving us more. Asking
      // again would just be noise.
      if (mergeByUrl(collected, parse(await page.content(), account, { now: opts.now })) === 0) break;
    }

    if (collected.size === 0) {
      const diag = await captureDiagnostics(page, "x", "no-posts-parsed");
      throw new PullError("UI_CHANGED", `No posts parsed from ${page.url()}`, {
        hint: `Logged in and on the profile, but no article[data-testid="tweet"] matched. Re-check the selectors in src/patterns/collectors/x.ts. Screenshot: ${join(diag, "screenshot.png")}`,
        diagnosticsDir: diag,
      });
    }

    return { entries: [...collected.values()].slice(0, opts.limit), stop: null };
  },
};
