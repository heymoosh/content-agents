// The Pinterest collector, tested against HTML captured from the real site on 2026-08-23 and
// trimmed to the script tags the parser reads. No test here touches the network.
//
// Most of these tests exist because the thing they check already went wrong once during the probe:
// the attribute is data-test-id and not id, the profile follower counter is a dict and not a list
// and is missing entirely on major accounts, a nonexistent board answers 200, and a vanity handle
// can belong to a different person whose page still reports the handle you asked for.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PinterestBlockedError,
  PinterestClient,
  boardSlugsFromHtml,
  boardsFromProps,
  cleanArticleBody,
  collectAccount,
  namesAgree,
  parseInitialProps,
  parsePin,
  parsePinterestArgs,
  parseProfileSnippet,
  pinIdsFromBoard,
  relatedHandlesFromProps,
  expandFromAccount,
  profileFromProps,
  rankReport,
  readProfile,
  toStagedEntry,
  verifyIdentity,
  type EntryContext,
} from "./pinterest.js";
import { validateEntry, loadConfig } from "./collect.js";
import { classifyOutlier } from "./outliers.js";
import type { CorpusEntry } from "./types.js";

const FIXTURES = join(import.meta.dirname, "fixtures");
const fixture = (name: string): string => readFileSync(join(FIXTURES, name), "utf8");

const ldjsonProfile = fixture("pinterest-profile-ldjson.html");
const pwsProfile = fixture("pinterest-profile-pws-only.html");
const impostorProfile = fixture("pinterest-profile-impostor.html");
const tinyProfile = fixture("pinterest-profile-tiny.html");
const boardHtml = fixture("pinterest-board.html");
const emptyBoardHtml = fixture("pinterest-board-empty.html");
const archivePin = fixture("pinterest-pin-archive.html");
const recentPin = fixture("pinterest-pin-recent.html");
const datePrefixPin = fixture("pinterest-pin-date-prefix.html");
const boilerplatePin = fixture("pinterest-pin-boilerplate.html");
const futureDatePin = fixture("pinterest-pin-future-date.html");
const noTextPin = fixture("pinterest-pin-no-text.html");

const CTX: EntryContext = {
  handle: "additudemag",
  creator: "ADDitude Magazine",
  niche: "adhd",
  boardSlug: "additude-free-downloads",
  followers: 96671,
  rank: 1,
  collectedAt: "2026-08-23T12:00:00.000Z",
  identity: { status: "verified", observedHandle: "additudemag", observedName: "ADDitude Magazine", reason: "ok" },
  now: new Date("2026-08-23T12:00:00.000Z"),
};

describe("profile parsing", () => {
  test("reads the ld+json identity card, whose attribute is data-test-id and not id", () => {
    const snippet = parseProfileSnippet(ldjsonProfile);
    assert.ok(snippet);
    assert.equal(snippet.handle, "wired");
    assert.equal(snippet.displayName, "WIRED");
    // interactionStatistic is a DICT on a profile, not the list it is on a pin.
    assert.equal(snippet.followers, 189600);
  });

  test("a profile with no follower counter in the ld+json is not a profile with no followers", () => {
    const snippet = parseProfileSnippet(pwsProfile);
    assert.ok(snippet);
    assert.equal(snippet.handle, "additudemag");
    assert.equal(snippet.followers, null);
    // The redux blob still knows, which is the whole reason the fallback is required rather than
    // optional. Without it ADDitude Magazine scores as an account with no data.
    const fromProps = profileFromProps(parseInitialProps(pwsProfile), "additudemag");
    assert.ok(fromProps);
    assert.equal(fromProps.followers, 96671);
    assert.equal(fromProps.source, "user-resource");
  });

  test("a profile with no ld+json snippet at all still yields a follower count", () => {
    // joannagaines answers 200 with no snippet. That is "skip the ld+json route", not "zero".
    assert.equal(parseProfileSnippet(tinyProfile), null);
    const fromProps = profileFromProps(parseInitialProps(tinyProfile), "joannagaines");
    assert.ok(fromProps);
    assert.equal(fromProps.followers, 166);
  });

  test("both routes agree where both answer", () => {
    const snippet = parseProfileSnippet(ldjsonProfile);
    const fromProps = profileFromProps(parseInitialProps(ldjsonProfile), "wired");
    assert.equal(snippet?.followers, fromProps?.followers);
  });

  test("readProfile records which route answered", () => {
    assert.equal(readProfile(ldjsonProfile, "wired", "WIRED").followersSource, "ld+json");
    assert.equal(readProfile(pwsProfile, "additudemag", "ADDitude Magazine").followersSource, "user-resource");
  });
});

describe("board discovery", () => {
  test("only boards the handle owns come back", () => {
    const boards = boardsFromProps(parseInitialProps(pwsProfile), "additudemag");
    const slugs = boards.map((board) => board.slug);
    assert.ok(slugs.includes("womens-health-month-2026"));
    // The same page describes boards belonging to other people. Collecting one of those would file
    // another creator's pins under this account.
    assert.ok(!slugs.some((slug) => slug === "child-family-resources"));
    for (const board of boards) assert.equal(typeof board.slug, "string");
  });

  test("the raw-HTML fallback finds the same account's slugs", () => {
    const slugs = boardSlugsFromHtml(pwsProfile, "additudemag");
    assert.ok(slugs.includes("womens-health-month-2026"));
  });

  test("pin ids come off a board page in payload order, deduped", () => {
    const ids = pinIdsFromBoard(boardHtml);
    assert.ok(ids.length > 5);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) assert.match(id, /^\d+$/);
  });

  test("HTTP 200 means nothing: a board that does not exist yields zero pin ids", () => {
    assert.deepEqual(pinIdsFromBoard(emptyBoardHtml), []);
  });
});

describe("identity", () => {
  test("a vanity handle belonging to someone else is a mismatch, not a warning", () => {
    // The page for /jasminestar/ reports alternateName "jasminestar", so the handle check passes
    // and tells you nothing. The display name is what catches it.
    const snippet = parseProfileSnippet(impostorProfile);
    assert.equal(snippet?.handle, "jasminestar");
    assert.equal(snippet?.displayName, "Sharon Stewart");
    const verdict = verifyIdentity("jasminestar", "Jasmine Star", snippet, null);
    assert.equal(verdict.status, "mismatch");
    assert.match(verdict.reason, /Sharon Stewart/);
  });

  test("a real account verifies on its display name", () => {
    const snippet = parseProfileSnippet(pwsProfile);
    assert.equal(verifyIdentity("additudemag", "ADDitude Magazine", snippet, null).status, "verified");
  });

  test("no expected creator means unverified, which is not the same as verified", () => {
    const verdict = verifyIdentity("additudemag", null, parseProfileSnippet(pwsProfile), null);
    assert.equal(verdict.status, "unverified");
  });

  test("namesAgree is loose on purpose and still separates two different people", () => {
    assert.equal(namesAgree("ADDitude", "ADDitude Magazine"), true);
    assert.equal(namesAgree("Sandra Rief", "Sandra Rief"), true);
    assert.equal(namesAgree("Jasmine Star", "Sharon Stewart"), false);
  });

  test("collectAccount refuses to collect from a mismatched page", async () => {
    const client = stubClient({ profile: impostorProfile, board: boardHtml, pin: archivePin });
    await assert.rejects(
      () => collectAccount(client, { handle: "jasminestar", creator: "Jasmine Star", niche: "adhd", boards: ["b"] }),
      /identity mismatch/,
    );
  });
});

describe("pin parsing", () => {
  test("reads saves, repins, date and headline off an archive pin", () => {
    const pin = parsePin(archivePin, "158540849367875270");
    assert.ok(pin);
    // The two save metrics are different quantities and are never folded together.
    assert.equal(pin.aggregateSaves, 15201);
    assert.equal(pin.repinCount, 17);
    assert.equal(pin.datePublished, "2017-07-07T00:00:00.000Z");
    assert.equal(pin.headline, "Free Handout: How to Manage Your Time at Work");
    assert.equal(pin.author, "additudemag");
    assert.match(pin.sharedUrl ?? "", /additudemag\.com/);
    // The image file, which is where the pin's actual substance lives.
    assert.match(pin.imageUrl ?? "", /^https:\/\/i\.pinimg\.com\/originals\/.+\.jpg$/);
  });

  test("the same account's recent pin carries the collapse", () => {
    const pin = parsePin(recentPin, "158540849378891372");
    assert.ok(pin);
    assert.equal(pin.aggregateSaves, 1);
    assert.equal(pin.datePublished?.slice(0, 4), "2023");
  });

  test("the published date and this copy's created date are different facts", () => {
    const pin = parsePin(archivePin, "158540849367875270");
    assert.ok(pin?.copyCreatedAt);
    // 2017 published, 2018 saved. Era is taken from the published date, never from this one.
    assert.match(pin.copyCreatedAt, /2018/);
  });

  test("a pin with no headline and no description parses but stages nothing", () => {
    const pin = parsePin(noTextPin, "112730796965913885");
    assert.ok(pin);
    assert.equal(pin.headline, null);
    assert.equal(toStagedEntry(pin, CTX), null);
  });
});

describe("cleanArticleBody", () => {
  test("strips the date prefix Pinterest prepends to about a fifth of descriptions", () => {
    const pin = parsePin(datePrefixPin, "112730796957263692");
    assert.ok(pin?.articleBody);
    assert.match(pin.articleBody, /^Feb 1, 2026/);
    const cleaned = cleanArticleBody(pin.articleBody);
    assert.ok(cleaned);
    assert.ok(!/^Feb 1, 2026/.test(cleaned));
    assert.match(cleaned, /^BELARY/);
  });

  test("refuses the boilerplate description outright", () => {
    const pin = parsePin(boilerplatePin, "137500594870304137");
    assert.ok(pin);
    // The raw value is a date prefix followed by Pinterest's own filler, and neither is content.
    assert.equal(cleanArticleBody(pin.articleBody), null);
  });

  test("an empty or absent description is null, not an empty string", () => {
    assert.equal(cleanArticleBody(null), null);
    assert.equal(cleanArticleBody("   "), null);
  });
});

describe("staged entries", () => {
  test("an archive pin becomes a valid entry that admits what it does not know", () => {
    const pin = parsePin(archivePin, "158540849367875270");
    assert.ok(pin);
    const entry = toStagedEntry(pin, CTX);
    assert.ok(entry);
    assert.equal(entry.platform, "pinterest");
    assert.equal(entry.era, "pre-2020");
    assert.equal(entry.posted_at, "2017-07-07T00:00:00.000Z");
    assert.equal(entry.title, "Free Handout: How to Manage Your Time at Work");
    // THE flag. The pin's substance is text typeset into the image, which Pinterest does not
    // publish, so this can never be true and no heuristic promotes it.
    assert.equal(entry.media?.body_is_complete, false);
    assert.equal(entry.media?.onscreen_text, null);
    assert.equal(entry.media?.form, "image");
    // repins are this copy's own number; the global aggregate is kept apart from the five
    // comparable metrics so nothing scores against it by accident.
    assert.equal(entry.metrics.shares, 17);
    assert.equal(entry.metrics.aggregate_saves, 15201);
    assert.equal(entry.metrics.views, null);
    assert.equal(entry.metrics.followers, 96671);
    // A board's first page is not a ranking and not an unbiased sample.
    assert.equal(entry.sample?.role, "unranked");
    assert.equal(entry.sample?.listing, "board:additude-free-downloads");
    assert.equal(entry.sample?.rank, 1);
  });

  test("the notes name every limitation a downstream reader would otherwise assume away", () => {
    const entry = toStagedEntry(parsePin(archivePin, "158540849367875270")!, CTX);
    assert.ok(entry?.notes);
    assert.match(entry.notes, /words ON the graphic are not published/);
    assert.match(entry.notes, /lifetime running totals/);
    assert.match(entry.notes, /repin/i);
    assert.match(entry.notes, /first server-rendered page/);
  });

  test("a date Pinterest published in the future is kept and flagged, never corrected", () => {
    const pin = parsePin(futureDatePin, "625507835742382007");
    assert.ok(pin);
    const entry = toStagedEntry(pin, CTX);
    assert.ok(entry);
    assert.equal(entry.posted_at, "2026-12-27T00:00:00.000Z");
    assert.match(entry.notes ?? "", /date in the future/);
  });

  test("an unverified identity is stamped onto every entry it produced", () => {
    const entry = toStagedEntry(parsePin(archivePin, "1")!, {
      ...CTX,
      identity: { status: "unverified", observedHandle: null, observedName: null, reason: "no display name on the page, from either route" },
    });
    assert.match(entry?.notes ?? "", /Identity unverified/);
  });

  test("a staged entry passes the corpus validator, era check included", () => {
    const config = loadConfig();
    const entry = toStagedEntry(parsePin(archivePin, "158540849367875270")!, CTX);
    const { entry: validated, errors } = validateEntry(JSON.parse(JSON.stringify(entry)), config);
    assert.deepEqual(errors, []);
    assert.ok(validated);
    assert.equal(validated.era, "pre-2020");
    assert.equal(validated.metrics.aggregate_saves, 15201);
    assert.equal(validated.sample?.role, "unranked");
  });

  test("the validator rejects an era that disagrees with posted_at", () => {
    const config = loadConfig();
    const entry = JSON.parse(JSON.stringify(toStagedEntry(parsePin(archivePin, "1")!, CTX))) as Record<string, unknown>;
    entry.era = "2023-plus";
    const { entry: validated, errors } = validateEntry(entry, config);
    assert.equal(validated, null);
    assert.ok(errors.some((e) => /disagrees with posted_at/.test(e)));
  });

  test("aggregate saves never reach the outlier scorer as this account's own number", () => {
    const entry = toStagedEntry(parsePin(archivePin, "158540849367875270")!, CTX)!;
    // engagement is likes + comments + shares. shares is 17, the repin count. If the 15,201
    // aggregate were leaking into the score this multiple would be three orders of magnitude out.
    const siblings: CorpusEntry[] = [1, 2, 3].map((n) => ({
      ...entry,
      url: `https://www.pinterest.com/pin/sib${n}/`,
      metrics: { ...entry.metrics, shares: 1 },
    }));
    const verdict = classifyOutlier(entry, [entry, ...siblings], { view_follower_ratio: 5, baseline_multiple: 4 });
    assert.equal(verdict.baselineMetric, "engagement");
    assert.equal(verdict.multiple, 17);
  });
});

// A stub that answers by URL shape. Every test that runs the client goes through this, so no test
// in this file can reach the network even by accident.
function stubClient(pages: { profile: string; board: string; pin: string }, statuses: Record<string, number> = {}): PinterestClient {
  return new PinterestClient({
    politenessMs: 0,
    fetchImpl: async (url) => {
      const status = statuses[url] ?? 200;
      const body = /\/pin\//.test(url) ? pages.pin : url.split("/").filter(Boolean).length > 3 ? pages.board : pages.profile;
      return new Response(body, { status });
    },
  });
}

describe("collectAccount", () => {
  test("walks a seeded board into staged entries and reports the profile it read", async () => {
    const client = stubClient({ profile: pwsProfile, board: boardHtml, pin: archivePin });
    const result = await collectAccount(
      client,
      { handle: "additudemag", creator: "ADDitude Magazine", niche: "adhd", boards: ["additude-free-downloads"] },
      { maxPins: 3, collectedAt: "2026-08-23T12:00:00.000Z" },
    );
    assert.equal(result.profile.followers, 96671);
    assert.equal(result.profile.identity.status, "verified");
    assert.equal(result.entries.length, 3);
    assert.deepEqual(result.emptyBoards, []);
    // Rank is the position on the board's first page, which is the only positional fact there is.
    assert.deepEqual(result.entries.map((e) => e.sample?.rank), [1, 2, 3]);
  });

  test("a board that answers 200 with no pins is surfaced, never counted as collected", async () => {
    const client = stubClient({ profile: pwsProfile, board: emptyBoardHtml, pin: archivePin });
    const result = await collectAccount(client, {
      handle: "additudemag",
      creator: "ADDitude Magazine",
      niche: "adhd",
      boards: ["a-board-that-does-not-exist"],
    });
    assert.deepEqual(result.emptyBoards, ["a-board-that-does-not-exist"]);
    assert.equal(result.entries.length, 0);
  });

  test("a 403 or a 429 stops the run instead of collecting a block notice", async () => {
    const client = new PinterestClient({
      politenessMs: 0,
      fetchImpl: async (url) => new Response("blocked", { status: url.includes("/pin/") ? 429 : 200 }),
    });
    await assert.rejects(() => client.pin("1"), PinterestBlockedError);
    const forbidden = new PinterestClient({ politenessMs: 0, fetchImpl: async () => new Response("", { status: 403 }) });
    await assert.rejects(() => forbidden.profile("additudemag"), PinterestBlockedError);
  });

  test("the politeness pause happens between requests, not after the last one", async () => {
    const waits: number[] = [];
    const client = new PinterestClient({
      politenessMs: 1000,
      sleep: async (ms) => void waits.push(ms),
      fetchImpl: async () => new Response(pwsProfile, { status: 200 }),
    });
    await client.profile("additudemag");
    assert.deepEqual(waits, []);
    await client.profile("additudemag");
    assert.deepEqual(waits, [1000]);
  });
});

describe("the era-scoped ranking, which is how a downstream consumer asks for 2014-2019", () => {
  const pins: CorpusEntry[] = [
    toStagedEntry(parsePin(archivePin, "158540849367875270")!, CTX)!,
    toStagedEntry(parsePin(recentPin, "158540849378891372")!, { ...CTX, rank: 2 })!,
  ];

  test("no era means no ranking at all, rather than a pooled one", () => {
    const lines = rankReport(pins, null, null, 10).join("\n");
    assert.match(lines, /No --era given/);
    assert.ok(!/saves \//.test(lines));
  });

  test("an era filters the pool and the numbers are labelled as lifetime totals", () => {
    const lines = rankReport(pins, "pre-2020", null, 10).join("\n");
    assert.match(lines, /Era pre-2020/);
    assert.match(lines, /15201 saves/);
    assert.match(lines, /LIFETIME totals/);
    assert.match(lines, /SHAPE, not a quotation/);
    // The 2023 pin is not in this ranking.
    assert.ok(!/158540849378891372/.test(lines));
  });

  test("the era breakdown is printed whether or not a ranking follows", () => {
    assert.match(rankReport(pins, null, null, 10)[0], /pre-2020 1, 2023-plus 1/);
  });

  test("a niche narrows the ranking further", () => {
    assert.match(rankReport(pins, "pre-2020", "adhd", 10).join("\n"), /niche adhd/);
    assert.match(rankReport(pins, "pre-2020", "civic-tech", 10).join("\n"), /0 entries/);
  });
});

// The 2026-08-23 correction, after the winning images were downloaded and looked at: `headline` is
// an SEO title, not the words on the graphic. These tests exist so that can never quietly be
// undone by a later change that finds `headline` convenient.
describe("the on-image text this collector deliberately does not have", () => {
  test("the image url is recorded on the entry, so a later transcription pass has the file", () => {
    const entry = toStagedEntry(parsePin(archivePin, "158540849367875270")!, CTX);
    assert.match(entry?.media?.asset_url ?? "", /^https:\/\/i\.pinimg\.com\/originals\//);
  });

  test("recording an image url does not promote onscreen_text", () => {
    const entry = toStagedEntry(parsePin(archivePin, "158540849367875270")!, CTX)!;
    assert.equal(typeof entry.media?.asset_url, "string");
    // Having the file is not having read it. These two facts are independent and stay that way.
    assert.equal(entry.media!.onscreen_text, null);
    assert.equal(entry.media!.body_is_complete, false);
  });

  test("the entry says in words that its text is SEO metadata, not the creator's words", () => {
    const entry = toStagedEntry(parsePin(archivePin, "158540849367875270")!, CTX)!;
    assert.match(entry.notes ?? "", /TEXT PROVENANCE/);
    assert.match(entry.notes!, /SEO-GENERATED/);
    // The description a reader of media sees must not claim the words were read.
    assert.match(entry.media?.description ?? "", /were NOT read/);
  });

  test("comments stays null: the page's commentCount is a cross-copy aggregate", () => {
    // commentCount sits inside aggregatedPinData beside the cross-copy save total, so it counts
    // comments on every copy of the image. Putting it in metrics.comments would inflate every
    // engagement score built from this entry.
    const entry = toStagedEntry(parsePin(archivePin, "158540849367875270")!, CTX)!;
    assert.equal(entry.metrics.comments, null);
    assert.equal(entry.metrics.likes, null);
    assert.equal(entry.metrics.views, null);
  });

  test("a pin with no image url says so, rather than leaving a silent null", () => {
    const pin = parsePin(archivePin, "1")!;
    const entry = toStagedEntry({ ...pin, imageUrl: null }, CTX)!;
    assert.equal(entry.media?.asset_url, null);
    assert.match(entry.notes!, /cannot recover its words/);
  });

  test("asset_url survives the corpus validator", () => {
    const entry = toStagedEntry(parsePin(archivePin, "158540849367875270")!, CTX);
    const { entry: validated, errors } = validateEntry(JSON.parse(JSON.stringify(entry)), loadConfig());
    assert.deepEqual(errors, []);
    assert.match(validated?.media?.asset_url ?? "", /i\.pinimg\.com/);
  });
});

// Discovery. Pinterest's search surfaces answer 200 with zero pins, so the related-user graph on a
// profile page is the only route that works logged out.
describe("related-user graph", () => {
  test("harvests neighbour usernames off a profile, excluding the account itself", () => {
    const handles = relatedHandlesFromProps(parseInitialProps(pwsProfile), "additudemag");
    assert.ok(handles.length > 5);
    assert.ok(!handles.some((handle) => handle.toLowerCase() === "additudemag"));
    assert.equal(new Set(handles).size, handles.length);
  });

  test("it returns names and nothing else, so no wrong follower number can be recorded", () => {
    // The graph's counts misattribute across adjacent user objects: careercontessa and prepary
    // both read 80,467 off a third party's page while prepary's own page says 5,673. The function
    // has no number in its return type at all, which is how that stays impossible.
    const handles = relatedHandlesFromProps(parseInitialProps(pwsProfile), "additudemag");
    for (const handle of handles) assert.equal(typeof handle, "string");
  });

  test("expansion re-fetches each candidate's own profile for its count", async () => {
    const fetched: string[] = [];
    const client = new PinterestClient({
      politenessMs: 0,
      fetchImpl: async (url) => {
        fetched.push(url);
        // The root profile answers with the graph; every candidate re-fetch answers with a
        // profile whose own record says 189,600. A candidate reported at that number therefore
        // proves the count came from the re-fetch and not from the graph.
        return new Response(fetched.length === 1 ? pwsProfile : ldjsonProfile, { status: 200 });
      },
    });
    const first = relatedHandlesFromProps(parseInitialProps(pwsProfile), "additudemag")[0].toLowerCase();
    const candidates = await expandFromAccount(client, "additudemag", { limit: 3, seeded: new Set([first]) });
    assert.equal(candidates.length, 3);
    // One fetch for the root profile plus one per candidate. The per-candidate fetch is the point.
    assert.equal(fetched.length, 4);
    for (const candidate of candidates) assert.equal(candidate.followers, 189600);
    assert.equal(candidates.filter((candidate) => candidate.alreadySeeded).length, 1);
  });

  test("expansion collects nothing and proposes nothing into config", async () => {
    const client = new PinterestClient({ politenessMs: 0, fetchImpl: async () => new Response(pwsProfile, { status: 200 }) });
    const candidates = await expandFromAccount(client, "additudemag", { limit: 2 });
    // The return type carries no entries, no niche and no creator: a config row needs an expected
    // creator name to check identity against, and the graph cannot supply one.
    for (const candidate of candidates) {
      assert.deepEqual(Object.keys(candidate).sort(), [
        "alreadySeeded",
        "boardCount",
        "displayName",
        "followers",
        "followersSource",
        "handle",
      ]);
    }
  });

  test("a block during expansion stops it rather than returning a short list", async () => {
    let calls = 0;
    const client = new PinterestClient({
      politenessMs: 0,
      fetchImpl: async () => {
        calls++;
        return new Response(calls === 1 ? pwsProfile : "", { status: calls === 1 ? 200 : 429 });
      },
    });
    await assert.rejects(() => expandFromAccount(client, "additudemag", { limit: 3 }), PinterestBlockedError);
  });
});

describe("argument parsing", () => {
  test("collect is the default and rank is opt-in", () => {
    assert.equal(parsePinterestArgs([]).command, "collect");
    assert.equal(parsePinterestArgs(["rank"]).command, "rank");
    assert.equal(parsePinterestArgs(["expand"]).command, "expand");
  });

  test("flags carry through", () => {
    const args = parsePinterestArgs(["--account", "@AdditudeMag", "--board", "one", "--board", "two", "--max-pins", "10"]);
    assert.equal(args.account, "@AdditudeMag");
    assert.deepEqual(args.boards, ["one", "two"]);
    assert.equal(args.maxPins, 10);
  });

  test("an era that is not an era becomes null rather than a silent filter on nothing", () => {
    assert.equal(parsePinterestArgs(["rank", "--era", "old"]).era, null);
    assert.equal(parsePinterestArgs(["rank", "--era", "pre-2020"]).era, "pre-2020");
  });
});
