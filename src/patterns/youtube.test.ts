// The YouTube collector, tested against markup captured from the real site on 2026-08-23 and
// trimmed to the script blobs the parser reads. No test here touches the network.
//
// Most of these exist because the thing they check already went wrong, either in this corpus or
// during the probe that built this file:
//   - the reference doc's "/about carries exactly one subscriberCountText" rule is stale, and a
//     first-match read of it records a sidebar channel's number as the creator's
//   - "caption" and "captions" are one letter apart and mean opposite things
//   - a description standing in for a transcript must never set body_is_complete
//   - the same video can be stored as /watch?v=<id> and as /shorts/<id>, so the backfill matches
//     on the video id rather than on the url string

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  YoutubeBlockedError,
  YoutubeClient,
  aboutUrl,
  buildEntry,
  captionNote,
  extractJsonAfter,
  incompleteYoutubeEntries,
  likesFromHtml,
  parseCompactCount,
  parseTimedTextJson3,
  parseWatchPage,
  parseYoutubeArgs,
  pickCaptionTrack,
  rewriteCorpus,
  subscribersFromAbout,
  upgradeEntry,
  videoIdFromUrl,
  watchUrl,
} from "./youtube.js";
import type { CorpusEntry } from "./types.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const fixture = (name: string) => readFileSync(join(FIXTURES, name), "utf8");

describe("videoIdFromUrl", () => {
  test("reads the id out of every url form YouTube publishes", () => {
    assert.equal(videoIdFromUrl("https://www.youtube.com/watch?v=FE6VL7jpfCs"), "FE6VL7jpfCs");
    assert.equal(videoIdFromUrl("https://www.youtube.com/shorts/oXwujuphEMc"), "oXwujuphEMc");
    assert.equal(videoIdFromUrl("https://youtu.be/FE6VL7jpfCs"), "FE6VL7jpfCs");
    assert.equal(videoIdFromUrl("https://m.youtube.com/watch?v=FE6VL7jpfCs&t=30"), "FE6VL7jpfCs");
    assert.equal(videoIdFromUrl("https://www.youtube.com/embed/FE6VL7jpfCs"), "FE6VL7jpfCs");
  });

  test("the /watch and /shorts forms of one video give the same id, which is what lets the backfill find its target", () => {
    assert.equal(videoIdFromUrl("https://www.youtube.com/watch?v=oXwujuphEMc"), videoIdFromUrl("https://www.youtube.com/shorts/oXwujuphEMc"));
  });

  test("refuses anything that is not a video url rather than returning a path fragment", () => {
    assert.equal(videoIdFromUrl("https://www.youtube.com/@aliabdaal/featured"), null);
    assert.equal(videoIdFromUrl("https://vimeo.com/12345"), null);
    assert.equal(videoIdFromUrl("not a url"), null);
    assert.equal(videoIdFromUrl("https://www.youtube.com/watch?v=tooshort"), null);
  });
});

describe("extractJsonAfter", () => {
  test("counts braces past the ones inside strings, which a non-greedy regex cannot do", () => {
    const html = 'var x = {"desc":"a } brace and a \\" quote","n":1};';
    assert.deepEqual(extractJsonAfter(html, "var x"), { desc: 'a } brace and a " quote', n: 1 });
  });

  test("returns null for a missing marker instead of throwing", () => {
    assert.equal(extractJsonAfter("<html></html>", "ytInitialPlayerResponse"), null);
  });
});

describe("parseWatchPage", () => {
  test("reads every field the watch page actually publishes", () => {
    const page = parseWatchPage(fixture("youtube-watch-asr.html"));
    assert.equal(page.videoId, "FE6VL7jpfCs");
    assert.equal(page.title, "I asked Hormozi how to make $100k a year");
    assert.equal(page.durationSeconds, 88);
    assert.equal(page.views, 79082);
    assert.equal(page.author, "Ali Abdaal");
    assert.equal(page.channelId, "UCoOae5nYA7VqaXzerajD0lg");
    assert.equal(page.publishedAt, "2026-08-04");
    assert.ok((page.description ?? "").length > 100);
  });

  test("the like count is YouTube's exact integer, not the rounded display", () => {
    // The page also carries the accessibility string "3.7 thousand likes". Reading that one would
    // record 3700 for a video that has 3704 likes.
    const page = parseWatchPage(fixture("youtube-watch-asr.html"));
    assert.equal(page.likes, 3704);
  });

  test("the handle comes off the page, because a corpus handle can be out of date", () => {
    // @AakashGupta is really @growproduct and @BenErez is really @benerez333, both recorded in the
    // corpus under the stale name. The page is the authority.
    const page = parseWatchPage(fixture("youtube-watch-asr.html"));
    assert.equal(page.handle, "aliabdaal");
  });

  test("an absent caption list is null, which is a different fact from an empty one", () => {
    const off = parseWatchPage(fixture("youtube-watch-no-captions.html"));
    assert.equal(off.captionTracks, null);
    const on = parseWatchPage(fixture("youtube-watch-asr.html"));
    assert.deepEqual(on.captionTracks?.length, 1);
  });
});

describe("caption tracks", () => {
  test("a machine-generated track is recognised as such", () => {
    const page = parseWatchPage(fixture("youtube-watch-asr.html"));
    const choice = pickCaptionTrack(page.captionTracks);
    assert.equal(choice?.isAsr, true);
    assert.equal(choice?.preferredHuman, false);
    assert.equal(choice?.track.name, "English (auto-generated)");
  });

  test("a human-authored track wins over a machine one on the same video", () => {
    const page = parseWatchPage(fixture("youtube-watch-human-track.html"));
    assert.equal(page.captionTracks?.length, 2);
    const choice = pickCaptionTrack(page.captionTracks);
    assert.equal(choice?.isAsr, false);
    assert.equal(choice?.preferredHuman, true);
    assert.equal(choice?.track.name, "English");
  });

  test("the note says out loud that a machine track's wording is approximate", () => {
    const page = parseWatchPage(fixture("youtube-watch-asr.html"));
    const note = captionNote(pickCaptionTrack(page.captionTracks), page.captionTracks);
    assert.match(note, /machine-generated/);
    assert.match(note, /never be quoted as exact/);
  });

  test("captions switched off is reported as the channel's own setting, not a retrieval failure", () => {
    const note = captionNote(null, []);
    assert.match(note, /disabled captions/);
    assert.match(note, /not a retrieval failure/);
  });

  test("no caption list at all is reported as unknown, not as absent captions", () => {
    const note = captionNote(null, null);
    assert.match(note, /unknown/);
  });
});

describe("subscribersFromAbout", () => {
  test("ignores the sidebar channels that the documented subscriberCountText route would have taken", () => {
    // Captured real on 2026-08-23: @aliabdaal /about carried FOUR subscriberCountText strings,
    // reading 561 thousand, 92.2 thousand and 47.6 thousand, every one a recommended channel. The
    // correct answer is 6.67M and it is nowhere in that field.
    const html = fixture("youtube-about-sidebar-trap.html");
    assert.equal([...html.matchAll(/"subscriberCountText"/g)].length, 3);
    assert.equal(subscribersFromAbout(html), 6670000);
  });

  test("reads the plain single-channel case", () => {
    assert.equal(subscribersFromAbout(fixture("youtube-about-single.html")), 6070000);
  });

  test("two candidates means null, never the first", () => {
    assert.equal(subscribersFromAbout(fixture("youtube-about-ambiguous.html")), null);
  });

  test("a walled or empty page records null rather than zero", () => {
    assert.equal(subscribersFromAbout(fixture("youtube-about-walled.html")), null);
  });
});

describe("parseCompactCount", () => {
  test("expands YouTube's rounded display strings", () => {
    assert.equal(parseCompactCount("6.67M"), 6670000);
    assert.equal(parseCompactCount("45.2K"), 45200);
    assert.equal(parseCompactCount("1.45K"), 1450);
    assert.equal(parseCompactCount("2.1B"), 2100000000);
    assert.equal(parseCompactCount("980"), 980);
    assert.equal(parseCompactCount("1,234"), 1234);
  });

  test("refuses junk rather than returning a plausible number", () => {
    assert.equal(parseCompactCount("many"), null);
    assert.equal(parseCompactCount(""), null);
  });
});

describe("likesFromHtml", () => {
  test("one candidate is read, several candidates is null", () => {
    assert.equal(likesFromHtml('{"likeCount":"3704"}'), 3704);
    assert.equal(likesFromHtml('{"likeCount":"3704"},{"likeCount":"9"}'), null);
    assert.equal(likesFromHtml("{}"), null);
  });

  test("the same count repeated is still one answer", () => {
    assert.equal(likesFromHtml('{"likeCount":"3704"} ... {"likeCount":"3704"}'), 3704);
  });
});

describe("parseTimedTextJson3", () => {
  // Unreachable in a live run today, because every timedtext fetch answers 200 with an empty body.
  // Tested anyway so the parsing half is already right when a route opens.
  test("joins the segments into one run of text", () => {
    const json = {
      events: [
        { segs: [{ utf8: "Four things " }, { utf8: "I wish I knew" }] },
        { segs: [{ utf8: " in my early 20s." }] },
      ],
    };
    assert.equal(parseTimedTextJson3(json), "Four things I wish I knew in my early 20s.");
  });

  test("an empty or wrong-shaped payload is null, never an empty transcript", () => {
    assert.equal(parseTimedTextJson3({ events: [] }), null);
    assert.equal(parseTimedTextJson3({}), null);
    assert.equal(parseTimedTextJson3(null), null);
  });
});

describe("buildEntry", () => {
  const base = {
    url: "https://www.youtube.com/watch?v=FE6VL7jpfCs",
    handle: "@aliabdaal",
    creator: "Ali Abdaal",
    niche: "productivity",
    followers: 6670000,
    collectedAt: "2026-08-23T15:00:00.000Z",
  };

  test("without a transcript the body is the description and the entry says so in every field that matters", () => {
    const page = parseWatchPage(fixture("youtube-watch-asr.html"));
    const entry = buildEntry({ ...base, page });
    // "caption" SINGULAR: the written description, not the spoken words.
    assert.equal(entry.transcript_source, "caption");
    assert.equal(entry.media?.body_is_complete, false);
    assert.equal(entry.body, page.description);
    assert.match(entry.notes ?? "", /not the spoken words/);
  });

  test("has_captions is true even though the words are missing, because the track really is there", () => {
    const page = parseWatchPage(fixture("youtube-watch-asr.html"));
    const entry = buildEntry({ ...base, page });
    assert.equal(entry.media?.has_captions, true);
    assert.equal(entry.metrics.likes, 3704);
    assert.equal(entry.metrics.views, 79082);
    // Not in the fetched markup, so null rather than zero.
    assert.equal(entry.metrics.comments, null);
  });

  test("a real transcript, if one ever arrives, flips the flags to captions plural and complete", () => {
    const page = parseWatchPage(fixture("youtube-watch-asr.html"));
    const entry = buildEntry({ ...base, page, transcript: "the spoken words" });
    assert.equal(entry.transcript_source, "captions");
    assert.equal(entry.media?.body_is_complete, true);
    assert.equal(entry.body, "the spoken words");
  });

  test("a /shorts url is recorded as short-video on YouTube's own classification", () => {
    const page = parseWatchPage(fixture("youtube-watch-asr.html"));
    const short = buildEntry({ ...base, page, url: "https://www.youtube.com/shorts/oXwujuphEMc" });
    assert.equal(short.media?.form, "short-video");
    assert.equal(short.media?.aspect, "vertical");
    const long = buildEntry({ ...base, page });
    assert.equal(long.media?.form, "video");
  });

  test("captions off produces has_captions false and still refuses to call the description a body", () => {
    const page = parseWatchPage(fixture("youtube-watch-no-captions.html"));
    const entry = buildEntry({ ...base, page });
    // This fixture has no caption list at all, so the honest answer is null, not false.
    assert.equal(entry.media?.has_captions, null);
    assert.equal(entry.media?.body_is_complete, false);
    assert.equal(entry.transcript_source, "caption");
  });
});

describe("upgradeEntry", () => {
  const existing = (): CorpusEntry => ({
    id: "youtube-aliabdaal-4c90901b",
    platform: "youtube",
    handle: "@aliabdaal",
    creator: "Ali Abdaal",
    niche: "productivity",
    url: "https://www.youtube.com/watch?v=FE6VL7jpfCs",
    posted_at: null,
    collected_at: "2026-08-23T05:32:33.638Z",
    kind: "video",
    body: "the written description",
    transcript_source: "caption",
    metrics: { views: 78902, likes: null, comments: null, shares: null, followers: 6670000 },
    media: {
      form: "short-video",
      onscreen_text: null,
      description: "YouTube watch page. Caption track=False.",
      duration_seconds: 88,
      media_count: null,
      has_captions: false,
      aspect: null,
      body_is_complete: false,
    },
    notes: "Retrieved 2026-08-23 via curl.",
  });

  test("fills the like count that the earlier pass left null", () => {
    const page = parseWatchPage(fixture("youtube-watch-asr.html"));
    const { entry, changed } = upgradeEntry(existing(), page, "2026-08-23T15:00:00.000Z");
    assert.equal(entry.metrics.likes, 3704);
    assert.ok(changed.includes("likes"));
  });

  test("corrects has_captions, which the earlier pass recorded as false on a video that has a track", () => {
    const page = parseWatchPage(fixture("youtube-watch-asr.html"));
    const { entry, changed } = upgradeEntry(existing(), page, "2026-08-23T15:00:00.000Z");
    assert.equal(entry.media?.has_captions, true);
    assert.ok(changed.includes("has_captions"));
  });

  test("WITHOUT a transcript it never flips body_is_complete, however much else it filled in", () => {
    // This is the whole guard. A pass that refreshed six fields is still a pass that did not get
    // the spoken words, and the flag has to keep saying so.
    const page = parseWatchPage(fixture("youtube-watch-asr.html"));
    const { entry, changed } = upgradeEntry(existing(), page, "2026-08-23T15:00:00.000Z");
    assert.equal(entry.media?.body_is_complete, false);
    assert.equal(entry.transcript_source, "caption");
    assert.equal(entry.body, "the written description");
    assert.ok(!changed.includes("body_is_complete"));
    assert.match(entry.notes ?? "", /spoken transcript is still NOT in this record/);
  });

  test("WITH a transcript it flips all three together", () => {
    const page = parseWatchPage(fixture("youtube-watch-asr.html"));
    const { entry } = upgradeEntry(existing(), page, "2026-08-23T15:00:00.000Z", "the spoken words");
    assert.equal(entry.media?.body_is_complete, true);
    assert.equal(entry.transcript_source, "captions");
    assert.equal(entry.body, "the spoken words");
  });

  test("never rewrites the entry's identity or provenance", () => {
    const before = existing();
    const page = parseWatchPage(fixture("youtube-watch-asr.html"));
    const { entry } = upgradeEntry(before, page, "2026-08-23T15:00:00.000Z");
    assert.equal(entry.id, before.id);
    assert.equal(entry.url, before.url);
    assert.equal(entry.handle, before.handle);
    assert.equal(entry.creator, before.creator);
    assert.equal(entry.niche, before.niche);
  });

  test("does not mutate the entry it was given", () => {
    const before = existing();
    const page = parseWatchPage(fixture("youtube-watch-asr.html"));
    upgradeEntry(before, page, "2026-08-23T15:00:00.000Z");
    assert.equal(before.metrics.likes, null);
    assert.equal(before.media?.has_captions, false);
  });

  test("appends to the existing notes rather than replacing what an earlier pass recorded", () => {
    const page = parseWatchPage(fixture("youtube-watch-asr.html"));
    const { entry } = upgradeEntry(existing(), page, "2026-08-23T15:00:00.000Z");
    assert.match(entry.notes ?? "", /Retrieved 2026-08-23 via curl\./);
    assert.match(entry.notes ?? "", /youtube re-fetch/);
  });
});

describe("incompleteYoutubeEntries", () => {
  test("finds the rows whose body is not the spoken words and leaves the rest alone", () => {
    const entries = [
      { platform: "youtube", transcript_source: "caption", media: { body_is_complete: false } },
      { platform: "youtube", transcript_source: "captions", media: { body_is_complete: true } },
      { platform: "tiktok", transcript_source: "caption", media: { body_is_complete: false } },
    ] as unknown as CorpusEntry[];
    const found = incompleteYoutubeEntries(entries);
    assert.equal(found.length, 1);
    assert.equal(found[0].transcript_source, "caption");
  });
});

describe("rewriteCorpus", () => {
  test("replaces the matching lines in place and leaves every other line byte-identical", () => {
    const dir = mkdtempSync(join(tmpdir(), "yt-corpus-"));
    const path = join(dir, "corpus.jsonl");
    try {
      const rows = [
        { id: "a", platform: "youtube", body: "one" },
        { id: "b", platform: "reddit", body: "two" },
        { id: "c", platform: "youtube", body: "three" },
      ];
      writeFileSync(path, rows.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
      const replaced = rewriteCorpus([{ id: "c", platform: "youtube", body: "THREE" } as unknown as CorpusEntry], path);
      assert.equal(replaced, 1);
      const after = readFileSync(path, "utf8").trim().split("\n").map((l) => JSON.parse(l));
      assert.equal(after.length, 3);
      assert.equal(after[0].body, "one");
      assert.equal(after[1].body, "two");
      assert.equal(after[2].body, "THREE");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("an empty update list touches nothing", () => {
    assert.equal(rewriteCorpus([], "/nonexistent/path.jsonl"), 0);
  });
});

describe("YoutubeClient", () => {
  test("a 429 throws rather than letting the run record nulls as facts", async () => {
    const client = new YoutubeClient({
      politenessMs: 0,
      fetchImpl: async () => ({ status: 429, text: async () => "" }),
    });
    await assert.rejects(() => client.getText("https://www.youtube.com/watch?v=FE6VL7jpfCs"), YoutubeBlockedError);
  });

  test("a 403 throws for the same reason", async () => {
    const client = new YoutubeClient({
      politenessMs: 0,
      fetchImpl: async () => ({ status: 403, text: async () => "" }),
    });
    await assert.rejects(() => client.getText("https://www.youtube.com/watch?v=FE6VL7jpfCs"), YoutubeBlockedError);
  });

  test("waits between fetches but not before the first one", async () => {
    const waits: number[] = [];
    const client = new YoutubeClient({
      politenessMs: 1000,
      sleep: async (ms) => {
        waits.push(ms);
      },
      fetchImpl: async () => ({ status: 200, text: async () => "ok" }),
    });
    await client.getText("https://www.youtube.com/a");
    assert.deepEqual(waits, []);
    await client.getText("https://www.youtube.com/b");
    assert.deepEqual(waits, [1000]);
  });

  test("sends a real browser user-agent, because a stripped page has no player response at all", async () => {
    let seen: Record<string, string> | undefined;
    const client = new YoutubeClient({
      politenessMs: 0,
      fetchImpl: async (_url, init) => {
        seen = init?.headers;
        return { status: 200, text: async () => "ok" };
      },
    });
    await client.getText("https://www.youtube.com/a");
    assert.match(seen?.["user-agent"] ?? "", /Chrome\/126/);
  });
});

describe("urls and args", () => {
  test("builds the canonical watch and about urls", () => {
    assert.equal(watchUrl("FE6VL7jpfCs"), "https://www.youtube.com/watch?v=FE6VL7jpfCs");
    assert.equal(aboutUrl("@aliabdaal"), "https://www.youtube.com/@aliabdaal/about");
    assert.equal(aboutUrl("AliAbdaal"), "https://www.youtube.com/@aliabdaal/about");
  });

  test("parses the collect and backfill invocations", () => {
    const collect = parseYoutubeArgs(["--url", "https://youtu.be/FE6VL7jpfCs", "--handle", "@aliabdaal", "--creator", "Ali Abdaal", "--niche", "productivity"]);
    assert.deepEqual(collect.urls, ["https://youtu.be/FE6VL7jpfCs"]);
    assert.equal(collect.creator, "Ali Abdaal");
    assert.equal(collect.backfill, false);

    const backfill = parseYoutubeArgs(["--backfill", "--dry-run", "--limit", "5"]);
    assert.equal(backfill.backfill, true);
    assert.equal(backfill.dryRun, true);
    assert.equal(backfill.limit, 5);
  });
});
