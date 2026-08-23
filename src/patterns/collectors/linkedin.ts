import { parseHTML } from "linkedom";
import { join } from "node:path";
import type { BrowserContext, Page } from "playwright";
import { captureDiagnostics, looksLikeAuthWall } from "../../pull/diagnose.js";
import { PullError } from "../../pull/errors.js";
import { makeId, normalizeHandle } from "../corpus.js";
import type { CorpusEntry } from "../types.js";
import {
  blockSignal,
  canonicalUrl,
  defaultSleep,
  mergeByUrl,
  countBeforeWord,
  parseCompactNumber,
  politeDelay,
  type CollectOptions,
  type CollectResult,
  type CollectorAccount,
  type PatternCollector,
} from "./shared.js";

// WHAT IS ACTUALLY VISIBLE to a logged-in NON-OWNER on a public LinkedIn activity feed.
//
//   body       YES. The post text, though long posts are collapsed behind "see more" until the
//              control is clicked, so a capture can hold a truncated body. See TRUNCATION below.
//   posted_at  NO, not as a real date. LinkedIn shows a RELATIVE age only ("2w", "3mo"), with no
//              machine-readable timestamp on the card. Turning "2w" into a date would be
//              inventing a number, so this field is null. It is not worth guessing: nothing in
//              the outlier math reads posted_at.
//   views      NO. Impressions on LinkedIn are OWNER-ONLY. A non-owner never sees them, on any
//              surface, so this field is ALWAYS null. It is never filled in from the reaction
//              count. See the note in the runner about what that costs.
//   likes      YES, the reactions total across all reaction types.
//   comments   YES.
//   shares     YES, the repost count, when LinkedIn renders it. Often absent on low-engagement
//              posts, and absent means null, not zero.
//   followers  SOMETIMES. Present in the profile header when the capture includes it, absent on
//              the activity feed alone. Falls back to the config seed.
//
// HOW THIS DIFFERS from src/pull/platforms/linkedin.ts, which pulls Muxin's own numbers: that
// adapter clicks Export on /analytics/creator/content/ and gets an xlsx with real impressions.
// There is no equivalent for someone else's account, which is precisely why views is null here.
//
// SELECTORS OBSERVED 2026-08-22 against a live recent-activity feed. That run is what found the
// two real defects this adapter now guards against: comments and reposts read as the same number,
// and a reaction count of 366000000 because a compact-number parser read the M of "Maddy" as a
// millions suffix. See the OBSERVED blocks further down for the exact markup behind both.
//
// Observed does not mean stable. LinkedIn's class names are the least stable of the three
// platforms, and LinkedIn is the most aggressive about blocking automated reading, so expect this
// adapter to need the most maintenance and to stop most often. The block and auth-wall paths were
// not exercised on that run.

const NAME = "linkedin-public-activity";
const VERSION = "1";

function profileUrl(handle: string): string {
  return `https://www.linkedin.com/in/${normalizeHandle(handle)}/recent-activity/all/`;
}

// LinkedIn identifies a post by an activity URN, which is also its permalink.
function permalinkFromUrn(urn: string): string | null {
  const match = /urn:li:(?:activity|share|ugcPost):\d+/.exec(urn);
  return match ? `https://www.linkedin.com/feed/update/${match[0]}/` : null;
}

function slugFromProfileHref(href: string | null | undefined): string | null {
  if (!href) return null;
  const match = /\/in\/([^/?#]+)/.exec(href);
  return match ? decodeURIComponent(match[1]).toLowerCase() : null;
}

// OBSERVED 2026-08-22 against a live activity feed, and this is why the counts are read the way
// they are. The counts block's text runs together like:
//
//   "366  Maddy Viswanath and 365 others   237 comments   5 reposts"
//
// LinkedIn wraps the comments and reposts spans in a SHARED parent, so "find the first element
// whose text mentions reposts" returns that parent, whose text starts with the COMMENT count.
// That produced comments === shares on every row of the first live run. Reading the number that
// immediately precedes each word, out of the whole blob, is what actually works.
function countFromCounts(root: Element | null, word: string): number | null {
  return countBeforeWord(root?.textContent ?? null, word);
}

// The reactions total, and the reason it is read so fussily.
//
// OBSERVED 2026-08-22, and confirmed independently by discovery-builder on the same three posts a
// few hours later (they read 371/3233/4127 where I read 366/3230/4126). The total is the LEADING
// number of the reaction button's own text: "371  Maddy Viswanath and 370 others".
//
// THE OFF-BY-ONE TRAP. That same button's aria-label is often just "Maddy Viswanath and 370
// others", with no total in it at all. Any parser that pulls "a number" out of that string returns
// 370, which is the count of OTHER reactors, so it is short by exactly the named one, silently, on
// every post whose label names a person. So the number is accepted ONLY as the leading token of
// the button text, and the aria-label is trusted only when it literally says "N reactions".
// Neither available means null. We never reconstruct a total by adding one to an "others" count:
// that is right for one named person and wrong for two.
//
// CORRECTION to an earlier comment here: .social-details-social-counts__reactions-count DOES exist
// on this page (discovery-builder counted 4 nodes of it). My first live run had likes null because
// it is not populated on every card, not because it is absent. It stays as a last fallback, since
// it did carry the right number on the cards where it was populated.
function reactionsFrom(card: Element): number | null {
  const button = card.querySelector("li.social-details-social-counts__reactions button")
    ?? card.querySelector("button[data-reaction-details]");
  const text = (button?.textContent ?? "").trim();
  const leading = /^[\d][\d.,\u00a0\u202f]*\s?[KMB]?(?![A-Za-z0-9])/.exec(text);
  if (leading) return parseCompactNumber(leading[0]);
  const aria = button?.getAttribute("aria-label") ?? "";
  if (/\breactions?\b/i.test(aria)) return countBeforeWord(aria, "reactions?");
  return parseCompactNumber(card.querySelector(".social-details-social-counts__reactions-count")?.textContent ?? null);
}

// PURE. Given the captured activity-feed HTML, return one entry per ORIGINAL post by this account.
export function parse(
  html: string,
  account: CollectorAccount,
  opts: { now?: () => Date } = {},
): CorpusEntry[] {
  const { document } = parseHTML(html);
  const now = opts.now ?? (() => new Date());
  const collectedAt = now().toISOString();
  const wanted = normalizeHandle(account.handle);

  // The follower line lives in the profile header when the capture reaches it. Absent on the
  // activity feed on its own, which is the common case.
  let headerFollowers: number | null = null;
  for (const node of Array.from(document.querySelectorAll(".pv-top-card--list li, .pvs-header__subtitle, .top-card__subline-item"))) {
    const text = (node.textContent ?? "").trim();
    if (/followers?/i.test(text)) {
      headerFollowers = parseCompactNumber(text);
      if (headerFollowers !== null) break;
    }
  }

  const entries: CorpusEntry[] = [];
  const seen = new Set<string>();

  for (const card of Array.from(document.querySelectorAll("div.feed-shared-update-v2[data-urn], div[data-urn^=\"urn:li:activity\"]"))) {
    const urn = card.getAttribute("data-urn") ?? "";
    const permalink = permalinkFromUrn(urn);
    if (!permalink) continue;

    // Skip reposts of someone else's post. We are studying what THIS account wrote.
    const header = (card.querySelector(".update-components-header__text-view")?.textContent ?? "").trim();
    if (/reposted this|shared this/i.test(header)) continue;

    // AUTHORSHIP. The activity feed also surfaces posts this person merely commented on or
    // reacted to, and those are not theirs. The author link is read ONLY from the actor block:
    // an earlier version fell back to "any /in/ link in the card", which happily matched a person
    // MENTIONED in the post body and then judged authorship off a stranger's profile.
    const actorHref = card.querySelector(".update-components-actor a[href*=\"/in/\"]")?.getAttribute("href")
      ?? card.querySelector(".update-components-actor__meta a[href*=\"/in/\"]")?.getAttribute("href");
    const actor = slugFromProfileHref(actorHref);
    if (actor !== null && actor !== wanted) continue;

    const body = (card.querySelector(".update-components-text")?.textContent ?? "").replace(/\s*…see more\s*$/i, "").trim();
    // No text means nothing to learn a pattern from, and an empty body fails the corpus's own
    // validation, so the post is skipped rather than recorded hollow.
    if (body === "") continue;

    const url = canonicalUrl(permalink);
    if (seen.has(url)) continue;

    const counts = card.querySelector(".social-details-social-counts");
    const reactions = reactionsFrom(card);

    seen.add(url);
    entries.push({
      id: makeId("linkedin", wanted, url),
      platform: "linkedin",
      handle: account.handle,
      creator: account.creator,
      niche: account.niche,
      url,
      // Relative ages only. See the header note: null beats a fabricated date.
      posted_at: null,
      collected_at: collectedAt,
      kind: "text",
      transcript_source: null,
      body,
      metrics: {
        // ALWAYS null on LinkedIn for a non-owner. Not a parsing gap, a platform fact.
        views: null,
        likes: reactions,
        comments: countFromCounts(counts, "comments?"),
        shares: countFromCounts(counts, "reposts?"),
        followers: headerFollowers ?? account.followers,
      },
      collection_method: "auto",
      collected_by: `${NAME}@${VERSION}`,
      ...(noteFor(actor === null, headerFollowers === null && account.followers !== null)),
    });
  }

  return entries;
}

// Notes are only written when there is something a reader needs to know about how a number or an
// attribution was arrived at. Silence means it was read straight off the page.
function noteFor(authorUnconfirmed: boolean, followersFromSeed: boolean): { notes?: string } {
  const notes: string[] = [];
  if (authorUnconfirmed) notes.push("author link not found on the card; attribution assumes the account's own activity feed");
  if (followersFromSeed) notes.push("followers taken from the config seed; the profile header was not in the capture");
  return notes.length > 0 ? { notes: notes.join("; ") } : {};
}

// TRUNCATION, stated plainly: we do NOT click "see more" on every post. Clicking once per post
// would multiply the request count against the platform most likely to block for it. A long post
// is therefore captured up to LinkedIn's fold. That is a real limitation of this adapter and it
// is better than a run that gets the account blocked.

const MAX_SCROLLS = 4;

async function pageText(page: Page): Promise<string> {
  try {
    return await page.locator("body").innerText({ timeout: 5_000 });
  } catch {
    return "";
  }
}

export const linkedin: PatternCollector = {
  platform: "linkedin",
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
        hint: "Check your connection / that LinkedIn opens in a normal browser.",
        cause,
      });
    }
    await sleep(4_000); // the feed hydrates client-side

    // LinkedIn's authwall is also what it shows a lapsed session, so this is the session check.
    if (looksLikeAuthWall(page.url())) {
      throw new PullError("SESSION_EXPIRED", `LinkedIn redirected to an auth wall (${page.url()})`, {
        hint: "Run `npm run pull:login -- linkedin` and sign in again.",
      });
    }

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
      const diag = await captureDiagnostics(page, "linkedin", "no-posts-parsed");
      throw new PullError("UI_CHANGED", `No posts parsed from ${page.url()}`, {
        hint: `Logged in and on the activity feed, but no update card matched. Re-check the selectors in src/patterns/collectors/linkedin.ts. Screenshot: ${join(diag, "screenshot.png")}`,
        diagnosticsDir: diag,
      });
    }

    return { entries: [...collected.values()].slice(0, opts.limit), stop: null };
  },
};
