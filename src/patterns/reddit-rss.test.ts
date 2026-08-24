// The reddit RSS collector, tested against a saved fixture feed. Every fixture post is invented:
// no real post text, no real author, and no network call in this file. The real feeds this
// collector reads are other people's writing and never enter git, which is why the fixture is
// hand-written rather than a saved capture.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  RSS_LISTING,
  handleFromFeed,
  htmlToText,
  mediaForRss,
  oldRedditUrl,
  parseFeed,
  postedDate,
  splitContent,
  stageFeed,
  toStagedEntryFromRss,
  unescapeXml,
  type RssEntry,
} from "./reddit-rss.js";
import { validateEntry } from "./collect.js";
import type { PatternMiningConfig } from "./types.js";

const FIXTURES = join(import.meta.dirname, "fixtures");
const FEED = readFileSync(join(FIXTURES, "reddit-top-year.xml"), "utf8");

const CONFIG: PatternMiningConfig = {
  niches: ["adhd", "solopreneur"],
  accounts: [],
  outlier_thresholds: {},
  targets: { corpus_size_min: 1, corpus_size_max: 500 },
};

const CTX = {
  niche: "adhd",
  collectedAt: "2026-08-23T21:30:00.000Z",
  route: "Reddit public Atom feed",
  pacing: "45s between feeds",
};

describe("unescapeXml", () => {
  test("decodes named, decimal and hex entities, and &amp; last", () => {
    assert.equal(unescapeXml("&lt;p&gt;"), "<p>");
    assert.equal(unescapeXml("&quot;quoted&quot;"), '"quoted"');
    assert.equal(unescapeXml("&#39;"), "'");
    assert.equal(unescapeXml("&#x27;"), "'");
    // The ordering that matters: one pass over "&amp;lt;" must yield "&lt;", not "<". Otherwise a
    // double-escaped feed decodes one level too far and turns post text into markup.
    assert.equal(unescapeXml("&amp;lt;"), "&lt;");
    assert.equal(unescapeXml("&amp;#39;"), "&#39;");
  });
});

describe("htmlToText", () => {
  test("keeps every word, turning blocks into breaks and list items into lines", () => {
    const text = htmlToText("<div class=\"md\"><p>First line.</p> <ul> <li>one</li> <li>two</li> </ul> <p>Last line.</p> </div>");
    assert.equal(text, "First line.\n\n- one\n- two\n\nLast line.");
  });

  test("decodes the second escaping level, so entities become characters and not markup", () => {
    assert.equal(htmlToText("<p>tea &amp; toast, it&#39;s fine</p>"), "tea & toast, it's fine");
  });

  test("drops html comments rather than leaving them in the body", () => {
    assert.equal(htmlToText("<!-- SC_OFF --><p>real text</p><!-- SC_ON -->"), "real text");
  });
});

describe("handleFromFeed", () => {
  test("reads the community and its exact casing off the feed's own category label", () => {
    assert.equal(handleFromFeed(FEED), "r/FixtureSub");
  });

  test("returns null rather than inventing a handle when the label is absent", () => {
    assert.equal(handleFromFeed("<feed><title>no category here</title></feed>"), null);
  });
});

describe("splitContent", () => {
  test("a self post yields its body and no outbound url", () => {
    const feed = parseFeed(FEED);
    const selfPost = feed.entries[0];
    assert.equal(selfPost.outboundUrl, null);
    assert.match(selfPost.body, /^An invented first paragraph/);
    // Both escaping levels are gone: the body holds characters, not entities.
    assert.match(selfPost.body, /tea & toast/);
    assert.match(selfPost.body, /it's fine/);
    assert.match(selfPost.body, /- first invented item/);
  });

  test("a link post yields an outbound url and an empty body", () => {
    const feed = parseFeed(FEED);
    const linkPost = feed.entries[5];
    assert.equal(linkPost.outboundUrl, "https://example.com/an-invented-article");
    assert.equal(linkPost.body, "");
  });

  test("a title-only self post yields an empty body and still no outbound url", () => {
    const feed = parseFeed(FEED);
    const titleOnly = feed.entries[1];
    assert.equal(titleOnly.outboundUrl, null);
    assert.equal(titleOnly.body, "");
  });

  test("the submitted-by footer never leaks into the body", () => {
    for (const entry of parseFeed(FEED).entries) {
      assert.doesNotMatch(entry.body, /submitted by/);
      assert.doesNotMatch(entry.body, /\[comments\]/);
    }
  });
});

describe("parseFeed", () => {
  test("reads every entry in the feed's own order", () => {
    const feed = parseFeed(FEED);
    assert.equal(feed.entries.length, 6);
    assert.equal(feed.handle, "r/FixtureSub");
    assert.equal(feed.feedTitle, "top scoring links : FixtureSub");
    assert.equal(feed.entries[0].id, "t3_aaa111");
    assert.equal(feed.entries[5].id, "t3_fff666");
  });

  test("normalizes the author to the u/name form the corpus uses", () => {
    assert.equal(parseFeed(FEED).entries[0].author, "u/fixture_author_one");
  });

  test("decodes a title's single escaping level", () => {
    assert.equal(parseFeed(FEED).entries[0].title, "An invented self post with a body & an entity");
  });

  test("an empty feed yields no entries rather than throwing", () => {
    assert.deepEqual(parseFeed("<feed></feed>").entries, []);
  });
});

describe("postedDate", () => {
  test("reduces the timestamp to the ISO date the corpus stores", () => {
    assert.equal(postedDate(parseFeed(FEED).entries[0]), "2025-10-12");
  });

  test("returns null on an absent or unreadable date rather than guessing one", () => {
    assert.equal(postedDate({ published: null } as RssEntry), null);
    assert.equal(postedDate({ published: "not a date" } as RssEntry), null);
  });
});

describe("oldRedditUrl", () => {
  test("swaps the host and leaves the path byte-identical", () => {
    assert.equal(
      oldRedditUrl("https://www.reddit.com/r/ADHD/comments/1o4u9wk/living_with_two_adhd_roommates_has_opened_my_eyes/"),
      "https://old.reddit.com/r/ADHD/comments/1o4u9wk/living_with_two_adhd_roommates_has_opened_my_eyes/",
    );
  });

  test("leaves an already-old.reddit url alone, so a re-run cannot double-rewrite", () => {
    const url = "https://old.reddit.com/r/ADHD/comments/abc/x/";
    assert.equal(oldRedditUrl(url), url);
  });
});

describe("mediaForRss", () => {
  const forms = () => parseFeed(FEED).entries.map((entry) => mediaForRss(entry));

  test("a self post with a body is text-only and complete", () => {
    const media = forms()[0];
    assert.equal(media.form, "text-only");
    assert.equal(media.body_is_complete, true);
  });

  test("a title-only self post is text-only and NOT complete, because the title is the whole post", () => {
    const media = forms()[1];
    assert.equal(media.form, "text-only");
    assert.equal(media.body_is_complete, false);
  });

  test("an image post is image, not complete, and keeps the asset url", () => {
    const media = forms()[2];
    assert.equal(media.form, "image");
    assert.equal(media.body_is_complete, false);
    assert.equal(media.asset_url, "https://i.redd.it/fixtureimage.jpeg");
  });

  test("a gallery post is a carousel with no invented image count", () => {
    const media = forms()[3];
    assert.equal(media.form, "carousel");
    assert.equal(media.media_count, null);
    assert.equal(media.body_is_complete, false);
  });

  test("a v.redd.it post is video", () => {
    assert.equal(forms()[4].form, "video");
  });

  test("an off-site post is a link-preview", () => {
    assert.equal(forms()[5].form, "link-preview");
  });

  test("no form carries on-screen text, because no image was ever opened", () => {
    for (const media of forms()) assert.equal(media.onscreen_text, null);
  });

  test("every description records that form came from the feed rather than Reddit's own flags", () => {
    for (const media of forms()) {
      assert.ok(media.description && media.description.length > 0);
      assert.match(media.description, /feed/i);
    }
  });
});

describe("toStagedEntryFromRss", () => {
  const staged = () => stageFeed(parseFeed(FEED), CTX);

  test("records the sample as a winner off the top-of-year RSS listing, in feed order", () => {
    const entries = staged();
    assert.equal(entries[0].sample?.listing, RSS_LISTING);
    assert.equal(entries[0].sample?.window, "year");
    assert.equal(entries[0].sample?.role, "winner");
    assert.deepEqual(
      entries.map((entry) => entry.sample?.rank),
      [1, 2, 3, 4, 5, 6],
    );
  });

  test("every metric is null, because the feed publishes no numbers at all", () => {
    for (const entry of staged()) {
      assert.equal(entry.metrics.views, null);
      assert.equal(entry.metrics.likes, null);
      assert.equal(entry.metrics.comments, null);
      assert.equal(entry.metrics.shares, null);
      // Read off the platform or left null: never parsed out of the subtitle's marketing prose,
      // which really does say "nearly two million users" in this fixture.
      assert.equal(entry.metrics.followers, null);
      assert.equal(entry.metrics.upvote_ratio, null);
    }
  });

  test("notes say in words that there is no score and therefore no multiple", () => {
    const notes = staged()[0].notes ?? "";
    assert.match(notes, /NO SCORE, AND THEREFORE NO MULTIPLE/);
    assert.match(notes, /must never be given one/);
    assert.match(notes, /No AccountBaseline was written/i);
  });

  test("a titled post with no body copies the title into body and stays incomplete", () => {
    const titleOnly = staged()[1];
    assert.equal(titleOnly.body, "An invented title only self post where the title is the whole artifact");
    assert.equal(titleOnly.title, titleOnly.body);
    assert.equal(titleOnly.media?.body_is_complete, false);
  });

  test("a video post is kind video with a caption transcript source, never captions", () => {
    const video = staged()[4];
    assert.equal(video.kind, "video");
    // "caption" and "captions" mean opposite things: this is the written title, not spoken words.
    assert.equal(video.transcript_source, "caption");
    assert.equal(video.body, "An invented video post");
  });

  test("a text post leaves transcript_source null", () => {
    assert.equal(staged()[0].transcript_source, null);
  });

  test("urls are old.reddit, so entries dedupe against the already-collected corpus", () => {
    for (const entry of staged()) assert.match(entry.url, /^https:\/\/old\.reddit\.com\//);
  });

  test("the same post staged twice keeps the same id", () => {
    const first = stageFeed(parseFeed(FEED), CTX);
    const second = stageFeed(parseFeed(FEED), CTX);
    assert.equal(first[0].id, second[0].id);
  });

  test("every staged entry passes the collector's own validation", () => {
    for (const entry of stageFeed(parseFeed(FEED), CTX)) {
      const { errors } = validateEntry(entry, CONFIG);
      assert.deepEqual(errors, [], `entry ${entry.id} failed validation: ${errors.join("; ")}`);
    }
  });
});

describe("stageFeed", () => {
  test("refuses rather than guessing when the feed names no community", () => {
    assert.throws(() => stageFeed({ handle: null, feedTitle: null, entries: [] }, CTX), /community is unknown/);
  });

  test("an explicit handle overrides the feed's own label", () => {
    const entries = stageFeed(parseFeed(FEED), { ...CTX, handle: "r/Override" });
    assert.equal(entries[0].handle, "r/Override");
  });

  test("skips an entry with no permalink rather than staging an entry with no url", () => {
    const feed = parseFeed(FEED);
    feed.entries[0].permalink = "";
    assert.equal(stageFeed(feed, CTX).length, 5);
  });
});
