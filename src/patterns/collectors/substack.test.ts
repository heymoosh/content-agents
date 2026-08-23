// The substack adapter's parsing step. Pure, over a fixture string, no network.
//
// EVERY WORD IN THESE FIXTURES IS INVENTED. The shape mirrors Substack's public archive records;
// the titles and body text belong to no real publication, because other people's post text never
// enters git.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parse, type SubstackCapture } from "./substack.js";
import type { CollectorAccount } from "./shared.js";

const account: CollectorAccount = {
  handle: "@madeupwriter",
  creator: "Made Up Writer",
  niche: "inner-journey",
  followers: 2000,
};

const now = () => new Date("2026-08-22T12:00:00.000Z");

function post(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    slug: "an-invented-post",
    title: "An Invented Post",
    subtitle: "An invented subtitle.",
    canonical_url: "https://madeup.substack.com/p/an-invented-post?utm_source=feed",
    post_date: "2026-08-01T09:00:00.000Z",
    type: "newsletter",
    audience: "everyone",
    reaction_count: 87,
    comment_count: 12,
    truncated_body_text: "An invented opening line...",
    publishedBylines: [{ handle: "madeupwriter", name: "Made Up Writer" }],
    ...overrides,
  };
}

function capture(overrides: Partial<SubstackCapture> = {}): string {
  return JSON.stringify({
    profile: null,
    posts: [post()],
    bodies: { "an-invented-post": "<p>An invented opening line.</p><p>An invented second line.</p>" },
    ...overrides,
  } satisfies SubstackCapture);
}

describe("substack parse", () => {
  test("maps a free post to a corpus entry with its full body", () => {
    const [entry] = parse(capture(), account, { now });
    assert.equal(entry.platform, "substack");
    assert.equal(entry.creator, "Made Up Writer");
    assert.equal(entry.kind, "text");
    assert.equal(entry.transcript_source, null);
    assert.equal(entry.url, "https://madeup.substack.com/p/an-invented-post");
    assert.equal(entry.posted_at, "2026-08-01T09:00:00.000Z");
    assert.equal(entry.collected_by, "substack-public-archive@1");
    assert.equal(entry.collection_method, "auto");
    // Title and subtitle lead the body: on Substack that is where the hook lives.
    assert.equal(entry.body, "An Invented Post\n\nAn invented subtitle.\n\nAn invented opening line.\n\nAn invented second line.");
  });

  test("views is ALWAYS null, because Substack publishes no public per-post reach number", () => {
    const [entry] = parse(capture(), account, { now });
    assert.equal(entry.metrics.views, null);
    assert.equal(entry.metrics.likes, 87);
    assert.notEqual(entry.metrics.views, entry.metrics.likes);
  });

  test("shares is null, not zero, because Substack exposes no public share count", () => {
    const [entry] = parse(capture(), account, { now });
    assert.equal(entry.metrics.shares, null);
    assert.equal(entry.metrics.comments, 12);
  });

  test("a per-emoji reactions map is summed when there is no reaction_count", () => {
    const raw = capture({ posts: [post({ reaction_count: undefined, reactions: { a: 30, b: 12 } })] });
    assert.equal(parse(raw, account, { now })[0].metrics.likes, 42);
  });

  test("a post with neither a count nor a reactions map records likes as null", () => {
    const raw = capture({ posts: [post({ reaction_count: undefined })] });
    assert.equal(parse(raw, account, { now })[0].metrics.likes, null);
  });

  test("a paid post keeps only its public preview and says so", () => {
    const raw = capture({
      posts: [post({ audience: "only_paid", slug: "a-paid-post", canonical_url: "https://madeup.substack.com/p/a-paid-post" })],
      bodies: {},
    });
    const [entry] = parse(raw, account, { now });
    assert.equal(entry.body, "An Invented Post\n\nAn invented subtitle.\n\nAn invented opening line...");
    assert.match(entry.notes ?? "", /nothing behind the paywall was read/);
  });

  test("podcast and video posts are skipped, because their real content is not text", () => {
    const raw = capture({
      posts: [
        post({ type: "podcast", canonical_url: "https://madeup.substack.com/p/an-episode" }),
        post({ type: "newsletter" }),
      ],
    });
    assert.deepEqual(parse(raw, account, { now }).map((e) => e.url), [
      "https://madeup.substack.com/p/an-invented-post",
    ]);
  });

  test("a public subscriber count beats the config seed; its absence falls back and says so", () => {
    const withCount = parse(capture({ profile: { subscriberCount: 15000 } }), account, { now })[0];
    assert.equal(withCount.metrics.followers, 15000);

    const withoutCount = parse(capture(), account, { now })[0];
    assert.equal(withoutCount.metrics.followers, 2000);
    assert.match(withoutCount.notes ?? "", /config seed/);
  });

  test("no seed and no public count means followers is null, not a guess", () => {
    const [entry] = parse(capture(), { ...account, followers: null }, { now });
    assert.equal(entry.metrics.followers, null);
  });

  test("the same post listed twice is recorded once", () => {
    const raw = capture({ posts: [post(), post()] });
    assert.equal(parse(raw, account, { now }).length, 1);
  });

  test("a guest or co-author post in the same publication is NOT filed under this creator", () => {
    // A publication's archive is not automatically one person's writing. Filing someone else's
    // post under this handle would poison the account's baseline and every pattern read off it.
    const raw = capture({
      posts: [
        post({ publishedBylines: [{ handle: "someoneelse", name: "Someone Else" }], canonical_url: "https://madeup.substack.com/p/a-guest-post" }),
        post(),
      ],
    });
    assert.deepEqual(parse(raw, account, { now }).map((e) => e.url), [
      "https://madeup.substack.com/p/an-invented-post",
    ]);
  });

  test("a co-authored post that includes this creator is kept", () => {
    const raw = capture({
      posts: [post({ publishedBylines: [{ handle: "someoneelse" }, { handle: "MadeUpWriter" }] })],
    });
    assert.equal(parse(raw, account, { now }).length, 1);
  });

  test("an archive with no byline data is kept but says authorship was not verifiable", () => {
    // Unverifiable is not the same as wrong. Dropping these would silently lose real posts.
    const raw = capture({ posts: [post({ publishedBylines: [] })] });
    const [entry] = parse(raw, account, { now });
    assert.equal(entry.url, "https://madeup.substack.com/p/an-invented-post");
    assert.match(entry.notes ?? "", /authorship not verifiable/);
  });

  test("an empty archive yields no entries and does not throw", () => {
    assert.deepEqual(parse(JSON.stringify({ profile: null, posts: [], bodies: {} }), account, { now }), []);
  });
});
