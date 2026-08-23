// The reddit collector, tested against saved fixture JSON. Every fixture post is invented: no
// real post text, no real author, and no network call in this file.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  RedditClient,
  baselinesFromNotes,
  isEligibleBaselinePost,
  mediaFor,
  nicheFor,
  parseListing,
  parseRedditArgs,
  postedDate,
  prefixedNameFromAbout,
  readCredentials,
  subredditName,
  subscribersFromAbout,
  toBaselineSample,
  toStagedEntry,
  type RedditPost,
} from "./reddit.js";
import { validateEntry } from "./collect.js";
import type { AccountBaseline, CorpusEntry, PatternMiningConfig } from "./types.js";

// The same fixed epoch the fixtures were generated against.
const NOW = 1787000000;
const FIXTURES = join(import.meta.dirname, "fixtures");

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, name), "utf8")) as unknown;
}

const topListing = fixture("reddit-top-listing.json");
const formsListing = fixture("reddit-forms-listing.json");
const newWindow = fixture("reddit-new-window.json");
const about = fixture("reddit-about.json");

function formPost(id: string): RedditPost {
  const post = parseListing(formsListing).posts.find((p) => p.id === id);
  assert.ok(post, `fixture post ${id} is missing`);
  return post;
}

const context = {
  handle: "r/Fixturesub",
  niche: "adhd",
  listing: "top",
  window: "year" as string | null,
  rank: 1,
  collectedAt: "2026-08-23T12:00:00.000Z",
  subscribers: 1234567,
  baseline: null as AccountBaseline | null,
  route: "Reddit OAuth JSON API (https://oauth.reddit.com), script app, application-only token.",
};

describe("parseListing", () => {
  test("pulls every child's data object and the pagination cursor", () => {
    const { posts, after } = parseListing(topListing);
    assert.equal(posts.length, 5);
    assert.equal(posts[0].score, 12286);
    assert.equal(after, "t3_aaa005");
  });

  test("a response that is not a listing yields no posts instead of throwing", () => {
    assert.deepEqual(parseListing({ error: 403 }), { posts: [], after: null });
    assert.deepEqual(parseListing(null), { posts: [], after: null });
  });
});

describe("subreddit identity", () => {
  test("subscribers come straight off about.json", () => {
    assert.equal(subscribersFromAbout(about), 1234567);
  });

  test("a missing subscriber count is null, never zero", () => {
    assert.equal(subscribersFromAbout({ data: {} }), null);
  });

  test("the prefixed name is read off the platform, so casing is never reconstructed", () => {
    assert.equal(prefixedNameFromAbout(about, "r/wrongcase"), "r/Fixturesub");
    assert.equal(prefixedNameFromAbout({ data: {} }, "r/fallback"), "r/fallback");
  });

  test("a community name is accepted in any of the three forms people type", () => {
    assert.equal(subredditName("r/ADHD"), "ADHD");
    assert.equal(subredditName("/r/ADHD"), "ADHD");
    assert.equal(subredditName(" ADHD "), "ADHD");
  });
});

describe("mediaFor", () => {
  test("a self post with a body is text-only and body_is_complete", () => {
    const media = mediaFor(formPost("bbb001"));
    assert.equal(media.form, "text-only");
    assert.equal(media.body_is_complete, true);
  });

  test("a self post with an empty body is text-only and NOT body_is_complete", () => {
    // The title is the whole artifact here. Marking it complete would let a downstream step quote
    // a bare title as a proven opener.
    const media = mediaFor(formPost("bbb002"));
    assert.equal(media.form, "text-only");
    assert.equal(media.body_is_complete, false);
  });

  test("an image post is never body_is_complete, because the image was not read", () => {
    const media = mediaFor(formPost("bbb003"));
    assert.equal(media.form, "image");
    assert.equal(media.body_is_complete, false);
    assert.equal(media.onscreen_text, null);
  });

  test("a gallery is a carousel and counts its slides", () => {
    const media = mediaFor(formPost("bbb004"));
    assert.equal(media.form, "carousel");
    assert.equal(media.media_count, 3);
  });

  test("a short vertical video is short-video, a long horizontal one is video", () => {
    const short = mediaFor(formPost("bbb005"));
    assert.equal(short.form, "short-video");
    assert.equal(short.duration_seconds, 38);
    assert.equal(short.aspect, "vertical");
    const long = mediaFor(formPost("bbb006"));
    assert.equal(long.form, "video");
    assert.equal(long.duration_seconds, 1400);
    assert.equal(long.aspect, "horizontal");
  });

  test("a poll is a poll and a link post is a link-preview", () => {
    assert.equal(mediaFor(formPost("bbb007")).form, "poll");
    assert.equal(mediaFor(formPost("bbb008")).form, "link-preview");
  });

  test("a video with no duration on record is video, not a guessed short", () => {
    const media = mediaFor({ is_video: true, is_self: false });
    assert.equal(media.form, "video");
    assert.equal(media.duration_seconds, null);
  });
});

describe("toStagedEntry", () => {
  const post = parseListing(topListing).posts[0];

  test("keeps the score, the upvote ratio, the comment count and the subscriber count", () => {
    const entry = toStagedEntry(post, context);
    assert.equal(entry.metrics.likes, 12286);
    assert.equal(entry.metrics.upvote_ratio, 0.97);
    assert.equal(entry.metrics.comments, 1339);
    assert.equal(entry.metrics.followers, 1234567);
    // Reddit publishes no view count, so this stays null rather than borrowing another number.
    assert.equal(entry.metrics.views, null);
  });

  test("records the title as its own field, because on reddit the title is the artifact", () => {
    const entry = toStagedEntry(post, context);
    assert.equal(entry.title, "I finally worked out why my mornings collapse");
  });

  test("marks the post as a winner from the listing it was taken out of", () => {
    const entry = toStagedEntry(post, { ...context, rank: 4 });
    assert.deepEqual(entry.sample, { listing: "top", window: "year", rank: 4, role: "winner" });
  });

  test("writes an old.reddit url, which is what the corpus already dedupes on", () => {
    const entry = toStagedEntry(post, context);
    assert.ok(entry.url.startsWith("https://old.reddit.com/r/Fixturesub/comments/aaa001/"));
    assert.ok(entry.id.startsWith("reddit-r-fixturesub-"));
  });

  test("a bodiless post copies its title into body and stays not-complete", () => {
    const entry = toStagedEntry(formPost("bbb002"), context);
    assert.equal(entry.body, "A title carrying the whole post");
    assert.equal(entry.media?.body_is_complete, false);
  });

  test("a video post is kind video with transcript_source caption, never captions", () => {
    // "caption" means the creator's written words. Reddit exposes no spoken transcript, so
    // claiming "captions" would say the body holds speech that was never collected.
    const entry = toStagedEntry(formPost("bbb005"), context);
    assert.equal(entry.kind, "video");
    assert.equal(entry.transcript_source, "caption");
  });

  test("posted_at is the post's own date", () => {
    assert.equal(postedDate({ created_utc: NOW }), new Date(NOW * 1000).toISOString().slice(0, 10));
    assert.equal(postedDate({}), null);
  });

  test("the notes say plainly when no baseline was measured", () => {
    const entry = toStagedEntry(post, context);
    assert.match(entry.notes ?? "", /Baseline: not measured in this run/);
  });

  test("a staged entry passes the corpus validator with its new fields intact", () => {
    const config = { niches: ["adhd"], accounts: [] } as unknown as PatternMiningConfig;
    const { entry, errors } = validateEntry(JSON.parse(JSON.stringify(toStagedEntry(post, context))), config);
    assert.deepEqual(errors, []);
    assert.equal(entry?.title, "I finally worked out why my mornings collapse");
    assert.equal(entry?.sample?.role, "winner");
    assert.equal(entry?.metrics.upvote_ratio, 0.97);
  });
});

describe("isEligibleBaselinePost", () => {
  const opts = { nowSeconds: NOW, minAgeSeconds: 3 * 86400 };

  test("keeps the settled ordinary posts and drops the ones still being voted on", () => {
    const { posts } = parseListing(newWindow);
    const eligible = posts.filter((post) => isEligibleBaselinePost(post, opts));
    assert.equal(posts.length, 14);
    assert.equal(eligible.length, 9);
    assert.deepEqual(
      eligible.map((post) => post.score).sort((a, b) => (a as number) - (b as number)),
      [1, 1, 2, 2, 3, 3, 4, 7, 120],
    );
  });

  test("a stickied mod post is not a sample of what the community does", () => {
    assert.equal(isEligibleBaselinePost({ score: 900, stickied: true, created_utc: NOW - 20 * 86400 }, opts), false);
  });

  test("a removed post stopped accumulating votes when it was removed", () => {
    assert.equal(
      isEligibleBaselinePost({ score: 2, removed_by_category: "moderator", created_utc: NOW - 8 * 86400 }, opts),
      false,
    );
  });

  test("a post with no score at all cannot join a median", () => {
    assert.equal(isEligibleBaselinePost({ created_utc: NOW - 8 * 86400 }, opts), false);
  });

  test("the sample carries numbers and a date only, never text", () => {
    const sample = toBaselineSample([{ score: 5, num_comments: 2, created_utc: NOW - 8 * 86400, selftext: "invented" }]);
    assert.deepEqual(Object.keys(sample[0]).sort(), ["comments", "posted_at", "score"]);
  });
});

describe("readCredentials", () => {
  test("names every missing key and where to get it", () => {
    assert.throws(
      () => readCredentials({} as NodeJS.ProcessEnv),
      (err: Error) => {
        assert.match(err.message, /REDDIT_CLIENT_ID/);
        assert.match(err.message, /REDDIT_CLIENT_SECRET/);
        assert.match(err.message, /REDDIT_USER_AGENT/);
        assert.match(err.message, /reddit\.com\/prefs\/apps/);
        return true;
      },
    );
  });

  test("accepts a complete set", () => {
    const creds = readCredentials({
      REDDIT_CLIENT_ID: " id ",
      REDDIT_CLIENT_SECRET: "secret",
      REDDIT_USER_AGENT: "nodejs:test:1.0 (by /u/someone)",
    } as NodeJS.ProcessEnv);
    assert.equal(creds.clientId, "id");
  });
});

// A stub fetch: no network, no credentials, and every request recorded so the headers and the
// backoff can be asserted on.
function stubFetch(responses: Array<{ status?: number; body: unknown; headers?: Record<string, string> }>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let i = 0;
  const fetchImpl = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const next = responses[Math.min(i, responses.length - 1)];
    i++;
    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { "content-type": "application/json", ...(next.headers ?? {}) },
    });
  };
  return { fetchImpl, calls };
}

const token = { body: { access_token: "fixture-token", expires_in: 3600 } };

describe("RedditClient", () => {
  test("exchanges the client id and secret for an app-only token, and never sends a password", async () => {
    const { fetchImpl, calls } = stubFetch([token, { body: about }]);
    const client = new RedditClient(
      { clientId: "cid", clientSecret: "csecret", userAgent: "nodejs:test:1.0 (by /u/someone)" },
      { fetchImpl, sleep: async () => {}, politenessMs: 0 },
    );
    await client.about("r/Fixturesub");
    assert.equal(calls[0].url, "https://www.reddit.com/api/v1/access_token");
    assert.equal(calls[0].init?.body, "grant_type=client_credentials");
    const auth = (calls[0].init?.headers as Record<string, string>).Authorization;
    assert.equal(auth, `Basic ${Buffer.from("cid:csecret").toString("base64")}`);
    assert.equal((calls[0].init?.headers as Record<string, string>)["User-Agent"], "nodejs:test:1.0 (by /u/someone)");
  });

  test("a rejected token says what to fix rather than what the server sent back", async () => {
    const { fetchImpl } = stubFetch([{ status: 401, body: { error: "invalid_grant" } }]);
    const client = new RedditClient(
      { clientId: "cid", clientSecret: "csecret", userAgent: "ua" },
      { fetchImpl, sleep: async () => {}, politenessMs: 0 },
    );
    await assert.rejects(client.about("r/Fixturesub"), /type 'script'/);
  });

  test("reads go to oauth.reddit.com with the bearer token and raw_json", async () => {
    const { fetchImpl, calls } = stubFetch([token, { body: about }]);
    const client = new RedditClient(
      { clientId: "cid", clientSecret: "csecret", userAgent: "ua" },
      { fetchImpl, sleep: async () => {}, politenessMs: 0 },
    );
    await client.about("r/Fixturesub");
    assert.ok(calls[1].url.startsWith("https://oauth.reddit.com/r/Fixturesub/about"));
    assert.match(calls[1].url, /raw_json=1/);
    assert.equal((calls[1].init?.headers as Record<string, string>).Authorization, "bearer fixture-token");
  });

  test("waits out the window when the rate limit is nearly empty", async () => {
    const slept: number[] = [];
    const { fetchImpl } = stubFetch([
      token,
      { body: about, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "30" } },
    ]);
    const client = new RedditClient(
      { clientId: "cid", clientSecret: "csecret", userAgent: "ua" },
      { fetchImpl, sleep: async (ms) => void slept.push(ms), politenessMs: 0 },
    );
    await client.about("r/Fixturesub");
    assert.deepEqual(slept, [31_000]);
  });

  test("a 429 stops the run instead of hammering", async () => {
    const { fetchImpl } = stubFetch([token, { status: 429, body: {}, headers: { "retry-after": "600" } }]);
    const client = new RedditClient(
      { clientId: "cid", clientSecret: "csecret", userAgent: "ua" },
      { fetchImpl, sleep: async () => {}, politenessMs: 0 },
    );
    await assert.rejects(client.about("r/Fixturesub"), /rate limited/);
  });

  test("a private or misspelled community is named as such", async () => {
    const { fetchImpl } = stubFetch([token, { status: 403, body: {} }]);
    const client = new RedditClient(
      { clientId: "cid", clientSecret: "csecret", userAgent: "ua" },
      { fetchImpl, sleep: async () => {}, politenessMs: 0 },
    );
    await assert.rejects(client.about("r/Fixturesub"), /private, quarantined, banned, or misspelled/);
  });

  test("the baseline sample keeps only settled posts and reports what it scanned", async () => {
    const { fetchImpl } = stubFetch([token, { body: newWindow }]);
    const client = new RedditClient(
      { clientId: "cid", clientSecret: "csecret", userAgent: "ua" },
      { fetchImpl, sleep: async () => {}, politenessMs: 0 },
    );
    const sample = await client.baselineSample("r/Fixturesub", {
      targetSample: 150,
      minAgeSeconds: 3 * 86400,
      nowSeconds: NOW,
    });
    assert.equal(sample.scanned, 14);
    assert.equal(sample.eligible.length, 9);
    assert.equal(sample.pages, 1);
  });

  test("a listing stops at the limit asked for", async () => {
    const { fetchImpl } = stubFetch([token, { body: topListing }]);
    const client = new RedditClient(
      { clientId: "cid", clientSecret: "csecret", userAgent: "ua" },
      { fetchImpl, sleep: async () => {}, politenessMs: 0 },
    );
    const posts = await client.listing("r/Fixturesub", "top", { limit: 3, window: "year" });
    assert.equal(posts.length, 3);
  });
});

describe("nicheFor", () => {
  const config = {
    niches: ["adhd"],
    accounts: [
      { handle: "r/ADHD", creator: "r/ADHD (subreddit)", platform: "reddit", niche: "adhd", followers: null },
      { handle: "@someone", creator: "Someone", platform: "x", niche: "adhd", followers: null },
    ],
  } as unknown as PatternMiningConfig;

  test("finds the seeded niche whatever the casing", () => {
    assert.equal(nicheFor(config, "r/adhd"), "adhd");
  });

  test("an unseeded community has no niche, so nothing is filed under a guess", () => {
    assert.equal(nicheFor(config, "r/NotSeeded"), null);
  });
});

describe("parseRedditArgs", () => {
  test("defaults to the top ten of the past year, with a baseline", () => {
    const args = parseRedditArgs(["--sub", "r/ADHD"]);
    assert.deepEqual(args.subs, ["r/ADHD"]);
    assert.equal(args.listing, "top");
    assert.equal(args.window, "year");
    assert.equal(args.limit, 10);
    assert.equal(args.measureBaseline, true);
  });

  test("takes several communities and can skip the baseline pass", () => {
    const args = parseRedditArgs(["--sub", "r/ADHD", "--sub", "r/civictech", "--no-baseline", "--min-age-days", "7"]);
    assert.deepEqual(args.subs, ["r/ADHD", "r/civictech"]);
    assert.equal(args.measureBaseline, false);
    assert.equal(args.minAgeDays, 7);
  });
});

describe("baselinesFromNotes", () => {
  const entry = (handle: string, notes: string): CorpusEntry => ({
    id: `reddit-${handle}-000`,
    platform: "reddit",
    handle,
    creator: "u/someone",
    niche: "adhd",
    url: `https://old.reddit.com/${handle}/comments/x/y/`,
    posted_at: "2025-10-12",
    collected_at: "2026-08-23T05:32:33.635Z",
    kind: "text",
    body: "invented",
    transcript_source: null,
    metrics: { views: null, likes: 12286, comments: 1339, shares: null, followers: null },
    notes,
  });

  test("lifts a hand-measured median out of the prose it was written in", () => {
    const notes =
      "Baseline: an unbiased window of 163 posts from r/ADHD's /new listing, all at least a few days old so " +
      "votes had settled (posted 2026-08-14 to 2026-08-16), has a TRUE MEDIAN score of 3.";
    const [baseline] = baselinesFromNotes([entry("r/ADHD", notes)], "2026-08-23T12:00:00.000Z");
    assert.equal(baseline.median, 3);
    assert.equal(baseline.sample_size, 163);
    assert.equal(baseline.window_start, "2026-08-14");
    assert.equal(baseline.window_end, "2026-08-16");
    // The individual scores were never written down, so the array is empty rather than invented.
    assert.deepEqual(baseline.scores, []);
  });

  test("an entry whose notes carry no measured median produces nothing", () => {
    assert.deepEqual(baselinesFromNotes([entry("r/ADHD", "PLATFORM: reddit")], "2026-08-23T12:00:00.000Z"), []);
  });
});
