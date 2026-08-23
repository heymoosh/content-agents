// The linkedin adapter's parsing step. Pure, over a fixture string, no network.
//
// EVERY WORD IN THESE FIXTURES IS INVENTED. The structure mirrors LinkedIn's feed markup; the post
// text does not belong to any real creator, because other people's post text never enters git.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parse } from "./linkedin.js";
import type { CollectorAccount } from "./shared.js";

const account: CollectorAccount = {
  handle: "@madeuppm",
  creator: "Made Up PM",
  niche: "building-solopreneur",
  followers: 4321,
};

const now = () => new Date("2026-08-22T12:00:00.000Z");

function card(opts: {
  id: string;
  actor?: string;
  text?: string;
  header?: string;
  counts?: string;
}): string {
  const header = opts.header ? `<div class="update-components-header__text-view">${opts.header}</div>` : "";
  const text = opts.text === "" ? "" : `<div class="update-components-text">${opts.text ?? `Invented LinkedIn body ${opts.id}.`}</div>`;
  const counts =
    opts.counts === ""
      ? ""
      : opts.counts ??
        `<div class="social-details-social-counts">
           <span class="social-details-social-counts__reactions-count">1,234</span>
           <li class="social-details-social-counts__comments"><span>56 comments</span></li>
           <li><span>7 reposts</span></li>
         </div>`;
  return `
    <div class="feed-shared-update-v2" data-urn="urn:li:activity:${opts.id}">
      ${header}
      <div class="update-components-actor"><a href="/in/${opts.actor ?? "madeuppm"}/">Made Up PM</a></div>
      ${text}
      ${counts}
    </div>`;
}

function page(cards: string, header = ""): string {
  return `<html><body>${header}${cards}</body></html>`;
}

describe("linkedin parse", () => {
  test("maps a normal post to a corpus entry", () => {
    const [entry] = parse(page(card({ id: "7001" })), account, { now });
    assert.equal(entry.platform, "linkedin");
    assert.equal(entry.creator, "Made Up PM");
    assert.equal(entry.kind, "text");
    assert.equal(entry.transcript_source, null);
    assert.equal(entry.body, "Invented LinkedIn body 7001.");
    assert.equal(entry.url, "https://linkedin.com/feed/update/urn:li:activity:7001");
    assert.equal(entry.collected_at, "2026-08-22T12:00:00.000Z");
    assert.equal(entry.collection_method, "auto");
    assert.equal(entry.collected_by, "linkedin-public-activity@1");
  });

  test("views is ALWAYS null, because impressions on LinkedIn are owner-only", () => {
    const [entry] = parse(page(card({ id: "7001" })), account, { now });
    assert.equal(entry.metrics.views, null);
    // And the reaction count is emphatically not smuggled in as a view count.
    assert.equal(entry.metrics.likes, 1234);
    assert.notEqual(entry.metrics.views, entry.metrics.likes);
  });

  test("reactions, comments and reposts are read; followers falls back to the config seed", () => {
    const [entry] = parse(page(card({ id: "7001" })), account, { now });
    assert.deepEqual(entry.metrics, { views: null, likes: 1234, comments: 56, shares: 7, followers: 4321 });
    assert.match(entry.notes ?? "", /config seed/);
  });

  test("a follower count in the capture beats the config seed", () => {
    const header = `<ul class="pv-top-card--list"><li>12,500 followers</li></ul>`;
    const [entry] = parse(page(card({ id: "7001" }), header), account, { now });
    assert.equal(entry.metrics.followers, 12500);
    assert.equal(entry.notes, undefined);
  });

  test("posted_at is null, because LinkedIn shows a relative age and a date would be invented", () => {
    const [entry] = parse(page(card({ id: "7001" })), account, { now });
    assert.equal(entry.posted_at, null);
  });

  test("a card with no counts block records every engagement number as null, not zero", () => {
    const [entry] = parse(page(card({ id: "7002", counts: "" })), account, { now });
    assert.deepEqual(
      { likes: entry.metrics.likes, comments: entry.metrics.comments, shares: entry.metrics.shares },
      { likes: null, comments: null, shares: null },
    );
  });

  test("a repost of someone else's post is left out", () => {
    const html = page(card({ id: "1" }) + card({ id: "2", header: "Made Up PM reposted this" }));
    assert.deepEqual(parse(html, account, { now }).map((e) => e.url), [
      "https://linkedin.com/feed/update/urn:li:activity:1",
    ]);
  });

  test("a card authored by a different person is left out", () => {
    const html = page(card({ id: "3", actor: "someoneelse" }) + card({ id: "4" }));
    assert.deepEqual(parse(html, account, { now }).map((e) => e.url), [
      "https://linkedin.com/feed/update/urn:li:activity:4",
    ]);
  });

  test("a card with no text is skipped rather than recorded with an empty body", () => {
    const html = page(card({ id: "5", text: "" }) + card({ id: "6" }));
    assert.deepEqual(parse(html, account, { now }).map((e) => e.url), [
      "https://linkedin.com/feed/update/urn:li:activity:6",
    ]);
  });

  test("the see-more marker is trimmed off a collapsed body", () => {
    const html = page(card({ id: "8", text: "A truncated invented post …see more" }));
    assert.equal(parse(html, account, { now })[0].body, "A truncated invented post");
  });

  test("the real LinkedIn counts markup: comments and reposts do not collapse to one number", () => {
    // OBSERVED 2026-08-22 on a live activity feed. The reaction total is the leading number in the
    // reaction button, and comments and reposts share a parent, which is what made an earlier
    // version report the comment count as the repost count. Structure real, names invented.
    const liveCounts = `
      <div class="social-details-social-counts">
        <ul>
          <li class="social-details-social-counts__reactions">
            <button data-reaction-details="">366 Someone Invented and 365 others</button>
          </li>
          <li>
            <span><button>237 comments</button></span>
            <span><button>5 reposts</button></span>
          </li>
        </ul>
      </div>`;
    const [entry] = parse(page(card({ id: "7100", counts: liveCounts })), account, { now });
    assert.equal(entry.metrics.likes, 366);
    assert.equal(entry.metrics.comments, 237);
    assert.equal(entry.metrics.shares, 5);
    assert.notEqual(entry.metrics.comments, entry.metrics.shares);
  });

  test("a person merely MENTIONED in the post body is not mistaken for the author", () => {
    // An earlier version fell back to "any /in/ link in the card" when the actor block was
    // missing, which matched a mention and judged authorship off a stranger's profile.
    const mentionOnly = `
      <div class="feed-shared-update-v2" data-urn="urn:li:activity:7200">
        <div class="update-components-text">Great thoughts from <a href="/in/someoneelse/">Someone Else</a> today.</div>
      </div>`;
    const [entry] = parse(page(mentionOnly), account, { now });
    assert.equal(entry.url, "https://linkedin.com/feed/update/urn:li:activity:7200");
    assert.match(entry.notes ?? "", /author link not found/);
  });

  test("the reaction off-by-one trap: an aria-label naming a person is never counted", () => {
    // Flagged by discovery-builder with live evidence. The button's aria-label is often just
    // "Maddy Viswanath and 370 others", with no total in it. Reading a number out of that gives
    // 370, the count of OTHER reactors, which is short by exactly one on every such post.
    const trap = `
      <div class="social-details-social-counts">
        <ul><li class="social-details-social-counts__reactions">
          <button data-reaction-details="" aria-label="Someone Invented and 370 others">371 Someone Invented and 370 others</button>
        </li></ul>
      </div>`;
    assert.equal(parse(page(card({ id: "7300", counts: trap })), account, { now })[0].metrics.likes, 371);
  });

  test("with no leading total and no 'N reactions' label, likes is null rather than short by one", () => {
    const noTotal = `
      <div class="social-details-social-counts">
        <ul><li class="social-details-social-counts__reactions">
          <button data-reaction-details="" aria-label="Someone Invented and 370 others">Someone Invented and 370 others</button>
        </li></ul>
      </div>`;
    // 370 would be wrong and 371 would be a guess that breaks with two named people. Null is honest.
    assert.equal(parse(page(card({ id: "7301", counts: noTotal })), account, { now })[0].metrics.likes, null);
  });

  test("an aria-label that does state a total is trusted", () => {
    const stated = `
      <div class="social-details-social-counts">
        <ul><li class="social-details-social-counts__reactions">
          <button data-reaction-details="" aria-label="3,233 reactions"></button>
        </li></ul>
      </div>`;
    assert.equal(parse(page(card({ id: "7302", counts: stated })), account, { now })[0].metrics.likes, 3233);
  });

  test("an empty page yields no entries and does not throw", () => {
    assert.deepEqual(parse("<html><body></body></html>", account, { now }), []);
  });
});
