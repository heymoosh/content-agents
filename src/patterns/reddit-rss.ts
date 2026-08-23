// The reddit RSS collector: Reddit's public Atom feeds, straight into staged corpus entries.
//
// WHY THIS FILE EXISTS ALONGSIDE reddit.ts, in one paragraph, because the difference is the whole
// point.
//
// reddit.ts goes through Reddit's OAuth JSON API and is the better route: it returns the score,
// the upvote ratio, the comment count and the subscriber count, so it can measure a community's
// TRUE MEDIAN and give every winner an honest multiple. It needs a free API key. Where no key
// exists, every other Reddit surface is walled: on 2026-08-23 a plain curl and a real headless
// Chrome both got HTTP 403 "You've been blocked by network security" from old.reddit.com and
// www.reddit.com alike, on the HTML pages and the .json routes. The ONE surface still answering is
// www.reddit.com/r/<sub>/top/.rss, which returns Reddit's own top-of-year ranking with titles,
// bodies, authors and dates.
//
// What it does NOT return is any number at all. No score, no comment count, no subscriber count.
// So this collector stages the actual top posts and records every metric as null. It writes NO
// AccountBaseline, because a baseline needs scores to take a median of and there are none: a
// "baseline" built from ordering would be the sibling-comparison error wearing a different hat,
// the one that rated r/ADHD's biggest post of the year at 2.2x when the truth against a real
// community median is 4095x. An entry from here has no multiple and must never be given one.
//
// Never fetched through a model-backed tool. A model-backed fetch once silently rewrote 14 of 15
// post bodies and attributed a stranger's comment to the author. This file parses the raw feed
// bytes and copies fields across without touching them.

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { INBOX_DIR, makeId } from "./corpus.js";
import { loadConfig, validateEntry } from "./collect.js";
import { nicheFor } from "./reddit.js";
import type { CorpusEntry, CorpusMedia } from "./types.js";

// The listing name recorded in `sample.listing`. Deliberately not "top": a reader has to be able
// to tell an entry that came with a score from one that could not.
export const RSS_LISTING = "top-year-rss";

// One entry as the feed publishes it. Every field is nullable because a missing element must never
// become a guess.
export interface RssEntry {
  // Reddit's fullname, e.g. "t3_1o4u9wk".
  id: string | null;
  title: string;
  // The poster, normalized to "u/name" from the feed's "/u/name".
  author: string | null;
  // The reddit permalink, taken from the entry's own <link href>.
  permalink: string;
  // ISO timestamp from <published>.
  published: string | null;
  // The post's own text, plain, converted from the feed's markdown div. Empty string when the post
  // has no body of its own, which on Reddit is a real and common category rather than a defect.
  body: string;
  // Where the [link] anchor points when it is NOT the permalink, i.e. the post links out.
  outboundUrl: string | null;
}

export interface RedditFeed {
  // The community as the feed's own <category label> writes it, e.g. "r/ADHD". This is where the
  // exact casing comes from (r/yimby really is lowercase), read off the platform rather than
  // reconstructed from whatever someone typed.
  handle: string | null;
  // The feed's <title>, e.g. "top scoring links : ADHD". Recorded because it is the feed's own
  // statement of what it is ordered by.
  feedTitle: string | null;
  entries: RssEntry[];
}

// XML entity decoding. The feed double-escapes: the <content> node is XML-escaped text whose value
// is itself HTML, so &amp;lt; in the bytes is &lt; after this and "<" after htmlToText.
export function unescapeXml(input: string): string {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    // &amp; last, so "&amp;lt;" becomes "&lt;" here and not "<".
    .replace(/&amp;/g, "&");
}

// HTML to plain text, deterministically. Block elements become line breaks and list items become
// lines; everything else is unwrapped. This is a transformation of the author's own words, never a
// summary of them, and no word is added or dropped.
export function htmlToText(html: string): string {
  return unescapeXml(
    html
      .replace(/<!--.*?-->/g, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|blockquote|pre|tr|ul|ol|table)>/gi, "\n\n")
      .replace(/<li[^>]*>/gi, "\n- ")
      .replace(/<\/li>/gi, "")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    // Reddit separates block elements with a literal space, so without this every paragraph after
    // the first would start with one.
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function tagText(xml: string, tag: string): string | null {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`).exec(xml);
  return match ? match[1] : null;
}

// The community name, from the feed-level <category label="r/Name"/>. Reddit writes the exact
// casing here, which is why it is read rather than rebuilt.
export function handleFromFeed(xml: string): string | null {
  const match = /<category\s+term="[^"]*"\s+label="([^"]+)"\s*\/>/.exec(xml);
  return match ? match[1] : null;
}

// Splits one entry's <content> into the post's own body and the outbound url.
//
// Reddit's feed appends a fixed footer to every entry: "submitted by <user> [link] [comments]".
// On a SELF post both anchors point at the permalink. On a LINK post the [link] anchor points
// somewhere else, and that divergence is the only signal the feed gives about the post's form.
export function splitContent(contentHtml: string): { body: string; outboundUrl: string | null } {
  const html = unescapeXml(contentHtml);
  const linkHref = /<a href="([^"]+)">\s*\[link\]\s*<\/a>/.exec(html)?.[1] ?? null;
  const commentsHref = /<a href="([^"]+)">\s*\[comments\]\s*<\/a>/.exec(html)?.[1] ?? null;
  const outboundUrl = linkHref !== null && commentsHref !== null && linkHref !== commentsHref ? linkHref : null;

  // The post's own text lives in the markdown div Reddit brackets with SC_OFF/SC_ON. A link post
  // has no such div at all, so an absent one means no body rather than an unread one.
  const md = /<!--\s*SC_OFF\s*-->([\s\S]*?)<!--\s*SC_ON\s*-->/.exec(html);
  return { body: md ? htmlToText(md[1]) : "", outboundUrl };
}

export function parseFeed(xml: string): RedditFeed {
  const header = xml.split("<entry>")[0] ?? "";
  const entries: RssEntry[] = [];
  for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const raw = match[1];
    const rawTitle = tagText(raw, "title");
    const permalink = /<link\s+href="([^"]+)"/.exec(raw)?.[1] ?? "";
    const rawAuthor = tagText(raw, "name");
    const content = tagText(raw, "content") ?? "";
    const { body, outboundUrl } = splitContent(content);
    entries.push({
      id: tagText(raw, "id"),
      title: rawTitle ? unescapeXml(rawTitle) : "",
      author: rawAuthor ? unescapeXml(rawAuthor).replace(/^\//, "") : null,
      permalink,
      published: tagText(raw, "published"),
      body,
      outboundUrl,
    });
  }
  const feedTitle = tagText(header, "title");
  return {
    handle: handleFromFeed(header),
    feedTitle: feedTitle ? unescapeXml(feedTitle) : null,
    entries,
  };
}

// What form the post took, decided only from the url the [link] anchor points at. Nothing here
// opens an image or a video, so `onscreen_text` is always null: unknown, never guessed.
//
// This is a WEAKER determination than the API collector's, which reads Reddit's own is_self,
// is_gallery, is_video and post_hint flags. The feed publishes none of those, so form comes from a
// url pattern and every description says so.
export function mediaForRss(entry: RssEntry): CorpusMedia {
  const base: CorpusMedia = {
    form: "link-preview",
    onscreen_text: null,
    description: null,
    duration_seconds: null,
    media_count: null,
    has_captions: null,
    aspect: null,
    body_is_complete: false,
  };
  const url = entry.outboundUrl;

  if (url === null) {
    // Both feed anchors pointed at the permalink, so the post links nowhere: it is a self post.
    // The one form where the body really is the whole post, and only when there IS a body.
    return {
      ...base,
      form: "text-only",
      body_is_complete: entry.body !== "",
      description:
        entry.body === ""
          ? "Reddit self post with an empty body, determined from the RSS feed: the [link] and [comments] anchors both point at the permalink and the feed carried no markdown div. The title is the entire post."
          : "Reddit self (text) post, determined from the RSS feed: the [link] and [comments] anchors both point at the permalink, and the feed carried the post's own markdown body.",
    };
  }
  if (/\/gallery\//.test(url)) {
    return {
      ...base,
      form: "carousel",
      description:
        "Reddit gallery post, determined from the /gallery/ url pattern in the feed's [link] anchor. The images were not retrieved, so any text typeset onto them is unknown, and the feed publishes no image count.",
    };
  }
  if (/v\.redd\.it/.test(url) || /(youtube\.com|youtu\.be)/.test(url)) {
    return {
      ...base,
      form: "video",
      description:
        "Video post, determined from the url pattern in the feed's [link] anchor. No transcript route from RSS; body holds the post title only.",
    };
  }
  if (/\.(gif|gifv)(\?|$)/i.test(url)) {
    return {
      ...base,
      form: "gif",
      media_count: 1,
      description: "Animated image post, determined from the url pattern in the feed's [link] anchor. The image was not retrieved or read.",
    };
  }
  if (/i\.redd\.it|preview\.redd\.it|i\.imgur\.com/.test(url) || /\.(jpg|jpeg|png|webp)(\?|$)/i.test(url)) {
    return {
      ...base,
      form: "image",
      media_count: 1,
      asset_url: url,
      description:
        "Image post, determined from the url pattern in the feed's [link] anchor. The image itself was not retrieved or read, so any text typeset onto it is unknown, and on an image post that is where the substance usually sits.",
    };
  }
  return {
    ...base,
    form: "link-preview",
    asset_url: url,
    description: "Link post, determined from the feed's [link] anchor pointing off the permalink. The substance sits at the linked page, which was not collected.",
  };
}

export interface RssEntryContext {
  // The community as Reddit writes it, e.g. "r/ADHD".
  handle: string;
  niche: string;
  rank: number;
  collectedAt: string;
  route: string;
  pacing: string;
}

// ISO date, not a timestamp, matching what the hand-collected reddit entries and the API collector
// both carry.
export function postedDate(entry: RssEntry): string | null {
  if (!entry.published) return null;
  const date = new Date(entry.published);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

// The permalink rewritten onto old.reddit.com, path byte-identical.
//
// This is not cosmetic. The corpus dedupes on the exact url string and every reddit entry already
// collected is an old.reddit url, so emitting the feed's www.reddit.com permalink would re-append
// posts that are already in the corpus as brand new ones. The two routes really do return the same
// posts: r/ADHD's top-of-year entry 1o4u9wk is in both.
export function oldRedditUrl(permalink: string): string {
  return permalink.replace(/^https?:\/\/(www\.)?reddit\.com/, "https://old.reddit.com");
}

// One feed entry becomes one staged corpus entry.
//
// Every metric is null and that is the honest answer, not an omission: RSS publishes no score, no
// comment count and no subscriber count. `notes` says so in words, because the number a reader
// most wants here is the one that does not exist.
export function toStagedEntryFromRss(entry: RssEntry, ctx: RssEntryContext): CorpusEntry {
  const media = mediaForRss(entry);
  const url = oldRedditUrl(entry.permalink);
  const isVideo = media.form === "video" || media.form === "short-video";

  const staged: CorpusEntry = {
    id: makeId("reddit", ctx.handle, url),
    platform: "reddit",
    handle: ctx.handle,
    creator: entry.author ?? "u/unknown",
    niche: ctx.niche,
    url,
    posted_at: postedDate(entry),
    collected_at: ctx.collectedAt,
    kind: isVideo ? "video" : "text",
    // A titled post with no body of its own copies the title in, which is the convention the
    // hand-collected reddit entries and the API collector both use. media.body_is_complete stays
    // false so nothing downstream reads that title as a whole post.
    body: entry.body !== "" ? entry.body : entry.title,
    // "caption" and not "captions": this is the creator's written title, never their spoken words.
    transcript_source: isVideo ? "caption" : null,
    title: entry.title,
    metrics: {
      views: null,
      likes: null,
      comments: null,
      shares: null,
      followers: null,
      upvote_ratio: null,
    },
    media,
    sample: { listing: RSS_LISTING, window: "year", rank: ctx.rank, role: "winner" },
  };

  staged.notes = [
    "PLATFORM: reddit",
    `Community post, not a creator account: the community ${ctx.handle} is in handle, the poster ${entry.author ?? "u/unknown"} is in creator.`,
    `Post title (Reddit's title is a separate field from the body, and on Reddit it is most of the craft, often the entire artifact): ${JSON.stringify(entry.title)}`,
    `Selection: position ${ctx.rank} in ${ctx.handle}'s top-of-year RSS listing, read ${ctx.collectedAt.slice(0, 10)}. The feed's own title confirms the ordering is Reddit's top scoring links for the year, so this post was selected FOR having travelled.`,
    "NO SCORE, AND THEREFORE NO MULTIPLE. Reddit's RSS feed publishes no score, no comment count and no subscriber count, so metrics.likes, metrics.comments and metrics.followers are all null. That is a statement about the route, not a post with zero engagement. This entry has NO baseline multiple and must never be given one: no AccountBaseline was written from this run, because a median needs scores to be taken over and there are none. Any ranking of this entry against others is Reddit's own ordering, never a computed ratio.",
    `Form: ${media.form}, determined from the feed's [link] anchor rather than from Reddit's own is_self/is_gallery/is_video flags, which RSS does not publish. That is a weaker determination than the API collector's and is recorded as such in media.description.`,
    `Route: ${ctx.route}`,
    `Pacing: ${ctx.pacing}`,
  ].join("\n");

  return staged;
}

// The whole feed, in listing order, as staged entries. Rank is 1-based position in Reddit's own
// top-of-year ordering.
export function stageFeed(
  feed: RedditFeed,
  ctx: Omit<RssEntryContext, "rank" | "handle"> & { handle?: string },
): CorpusEntry[] {
  const handle = ctx.handle ?? feed.handle;
  if (!handle) {
    throw new Error("The feed carried no <category label> and no handle was supplied, so the community is unknown. Nothing was staged.");
  }
  return feed.entries
    .filter((entry) => entry.permalink !== "")
    .map((entry, index) => toStagedEntryFromRss(entry, { ...ctx, handle, rank: index + 1 }));
}

// ---------------------------------------------------------------------------------------------
// The command. Everything above this line is pure and is what the tests exercise.
//
// Deliberately split from the fetch. scripts/reddit-rss-fetch.sh does the paced network half and
// writes raw feed bytes to disk; this reads those bytes and stages them. Keeping them apart means
// a re-stage after a parser fix costs no requests against a surface that rate-limits this hard.
// ---------------------------------------------------------------------------------------------

export const DEFAULT_ROUTE =
  "Reddit public Atom feed, www.reddit.com/r/<sub>/top/.rss?t=year, fetched with curl over plain HTTPS, logged out, no credentials and no API key.";

export interface RedditRssArgs {
  feedsDir: string;
  outDir: string;
  route: string;
  pacing: string;
}

export function parseRedditRssArgs(argv: string[]): RedditRssArgs {
  const args: RedditRssArgs = {
    feedsDir: "",
    outDir: INBOX_DIR,
    route: DEFAULT_ROUTE,
    pacing: "unrecorded",
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--feeds" && value) (args.feedsDir = value), i++;
    else if (flag === "--out" && value) (args.outDir = value), i++;
    else if (flag === "--route" && value) (args.route = value), i++;
    else if (flag === "--pacing" && value) (args.pacing = value), i++;
  }
  return args;
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const args = parseRedditRssArgs(argv);
  if (!args.feedsDir) {
    console.error("Usage: npm run patterns:reddit-rss -- --feeds <dir-of-saved-feeds> [--out <inbox-dir>] [--pacing \"...\"]");
    console.error("Fetch the feeds first:  bash scripts/reddit-rss-fetch.sh <dir> ADHD civictech ...");
    return 1;
  }

  const config = loadConfig();
  const collectedAt = new Date().toISOString();
  const staged: CorpusEntry[] = [];
  let invalid = 0;

  for (const file of readdirSync(args.feedsDir).filter((name) => name.endsWith(".xml")).sort()) {
    const feed = parseFeed(readFileSync(join(args.feedsDir, file), "utf8"));
    if (!feed.handle) {
      console.error(`${file}: the feed carried no <category label>, so the community is unknown. Skipped.`);
      continue;
    }
    // Not guessed: a community with no row in the config has no niche, and filing its posts under
    // one nobody chose is worse than skipping it.
    const niche = nicheFor(config, feed.handle);
    if (!niche) {
      console.error(`${feed.handle}: not seeded in config/pattern-mining.yaml, so it has no niche. Add a row there. Skipped.`);
      continue;
    }
    const entries = stageFeed(feed, { niche, collectedAt, route: args.route, pacing: args.pacing });
    for (const entry of entries) {
      const { errors } = validateEntry(entry, config);
      if (errors.length > 0) {
        invalid++;
        console.error(`INVALID ${entry.id}: ${errors.join("; ")}`);
      }
    }
    staged.push(...entries);
    const forms = entries.reduce((acc: Record<string, number>, entry) => {
      const form = entry.media?.form ?? "unknown";
      acc[form] = (acc[form] ?? 0) + 1;
      return acc;
    }, {});
    const complete = entries.filter((entry) => entry.media?.body_is_complete).length;
    console.log(
      `${feed.handle}: ${entries.length} top-of-year posts, niche ${niche}, ${complete} with a complete body. ` +
        Object.entries(forms).sort((a, b) => b[1] - a[1]).map(([form, n]) => `${form}:${n}`).join(" "),
    );
  }

  if (staged.length === 0) {
    console.error("Nothing was staged.");
    return 1;
  }

  mkdirSync(args.outDir, { recursive: true });
  const outPath = join(args.outDir, `reddit-rss-top-year-${collectedAt.slice(0, 10)}.json`);
  writeFileSync(outPath, JSON.stringify(staged, null, 2) + "\n", "utf8");

  console.log(`\nStaged ${staged.length} entries to ${outPath}.${invalid > 0 ? ` ${invalid} FAILED validation.` : ""}`);
  console.log("NO baseline was written. RSS publishes no score, so there is nothing to take a median of,");
  console.log("and every entry from this route carries a null score and no multiple, on purpose.");
  console.log("Nothing has entered the corpus yet. Validate and append them with:");
  console.log("  npm run patterns:collect");
  return invalid > 0 ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().then((code) => {
    process.exitCode = code;
  });
}
