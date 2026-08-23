// The x adapter's parsing step. Pure, over a fixture string, no network.
//
// EVERY WORD IN THESE FIXTURES IS INVENTED. The structure mirrors X's data-testid contract; the
// post text does not belong to any real creator, because other people's post text never enters git.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parse } from "./x.js";
import type { CollectorAccount } from "./registry.js";

const account: CollectorAccount = {
  handle: "@madeupbuilder",
  creator: "Made Up Builder",
  niche: "building-solopreneur",
  followers: 999,
};

const now = () => new Date("2026-08-22T12:00:00.000Z");

function tweet(opts: {
  id: string;
  author?: string;
  text?: string;
  ariaLabel?: string | null;
  socialContext?: string;
  promoted?: boolean;
  datetime?: string;
}): string {
  const author = opts.author ?? "madeupbuilder";
  const context = opts.socialContext
    ? `<div data-testid="socialContext">${opts.socialContext}</div>`
    : "";
  const promoted = opts.promoted ? `<div data-testid="placementTracking"></div>` : "";
  const text = opts.text === undefined ? `<div data-testid="tweetText">Invented body ${opts.id}.</div>` : opts.text === "" ? "" : `<div data-testid="tweetText">${opts.text}</div>`;
  const group =
    opts.ariaLabel === null
      ? ""
      : `<div role="group" aria-label="${opts.ariaLabel ?? "12 replies, 5 reposts, 340 likes, 6 bookmarks, 12345 views"}"></div>`;
  return `
    <article data-testid="tweet">
      ${context}${promoted}${text}
      <a href="/${author}/status/${opts.id}?s=20"><time datetime="${opts.datetime ?? "2026-08-01T10:00:00.000Z"}">Aug 1</time></a>
      ${group}
    </article>`;
}

function page(articles: string, header = `<a href="/madeupbuilder/verified_followers">12.3K Followers</a>`): string {
  return `<html><body>${header}${articles}</body></html>`;
}

describe("x parse", () => {
  test("maps a normal post to a corpus entry, with every public number", () => {
    const [entry] = parse(page(tweet({ id: "111" })), account, { now });
    assert.equal(entry.platform, "x");
    assert.equal(entry.handle, "@madeupbuilder");
    assert.equal(entry.creator, "Made Up Builder");
    assert.equal(entry.niche, "building-solopreneur");
    assert.equal(entry.kind, "text");
    assert.equal(entry.transcript_source, null);
    assert.equal(entry.body, "Invented body 111.");
    // The query string is dropped, which is what makes a second run a no-op.
    assert.equal(entry.url, "https://x.com/madeupbuilder/status/111");
    assert.equal(entry.posted_at, "2026-08-01T10:00:00.000Z");
    assert.equal(entry.collected_at, "2026-08-22T12:00:00.000Z");
    assert.deepEqual(entry.metrics, {
      views: 12345,
      likes: 340,
      comments: 12,
      shares: 5,
      followers: 12300,
    });
  });

  test("stamps how the entry was collected and by which adapter version", () => {
    const [entry] = parse(page(tweet({ id: "111" })), account, { now });
    assert.equal(entry.collection_method, "auto");
    assert.equal(entry.collected_by, "x-public-profile@1");
    assert.equal(entry.id, "x-madeupbuilder-" + entry.id.split("-").pop());
  });

  test("a post whose action bar omits views records views: null, never the like count", () => {
    const [entry] = parse(page(tweet({ id: "222", ariaLabel: "3 replies, 1 repost, 88 likes" })), account, { now });
    assert.equal(entry.metrics.views, null);
    assert.equal(entry.metrics.likes, 88);
  });

  test("a post with no action bar at all records every count as null", () => {
    const [entry] = parse(page(tweet({ id: "333", ariaLabel: null })), account, { now });
    assert.deepEqual(
      { views: entry.metrics.views, likes: entry.metrics.likes, comments: entry.metrics.comments, shares: entry.metrics.shares },
      { views: null, likes: null, comments: null, shares: null },
    );
  });

  test("reposts, pinned posts, and ads are all left out", () => {
    const html = page(
      tweet({ id: "1" }) +
        tweet({ id: "2", socialContext: "Pinned" }) +
        tweet({ id: "3", socialContext: "Made Up Builder reposted" }) +
        tweet({ id: "4", promoted: true }),
    );
    const urls = parse(html, account, { now }).map((e) => e.url);
    assert.deepEqual(urls, ["https://x.com/madeupbuilder/status/1"]);
  });

  test("a card whose permalink belongs to someone else is not this account's post", () => {
    const html = page(tweet({ id: "9", author: "someoneelse" }) + tweet({ id: "10" }));
    const urls = parse(html, account, { now }).map((e) => e.url);
    assert.deepEqual(urls, ["https://x.com/madeupbuilder/status/10"]);
  });

  test("an image-only post with no text is skipped rather than recorded with an empty body", () => {
    const html = page(tweet({ id: "5", text: "" }) + tweet({ id: "6" }));
    assert.deepEqual(parse(html, account, { now }).map((e) => e.url), ["https://x.com/madeupbuilder/status/6"]);
  });

  test("the same post rendered twice in a virtualized timeline is recorded once", () => {
    const html = page(tweet({ id: "7" }) + tweet({ id: "7" }));
    assert.equal(parse(html, account, { now }).length, 1);
  });

  test("without a header in the capture, followers falls back to the config seed and says so", () => {
    const [entry] = parse(page(tweet({ id: "111" }), ""), account, { now });
    assert.equal(entry.metrics.followers, 999);
    assert.match(entry.notes ?? "", /config seed/);
  });

  test("no seed and no header means followers is null, not a guess", () => {
    const [entry] = parse(page(tweet({ id: "111" }), ""), { ...account, followers: null }, { now });
    assert.equal(entry.metrics.followers, null);
    assert.equal(entry.notes, undefined);
  });

  test("an empty page yields no entries and does not throw", () => {
    assert.deepEqual(parse("<html><body></body></html>", account, { now }), []);
  });
});
