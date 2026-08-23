// The Instagram collector, tested against saved fixture JSON. Every fixture post is invented: no
// real post text, no real creator, no real permalink, and no network call in this file.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_API_VERSION,
  InstagramClient,
  MEDIA_FIELDS,
  OPTIONAL_FIELDS,
  ROUTE,
  afterCursor,
  buildFields,
  caption,
  collectAccount,
  creatorFor,
  describeGraphError,
  engagementOf,
  fieldState,
  graphError,
  isCallerError,
  isReel,
  isUnknownFieldError,
  isVideo,
  mediaFor,
  mediaFromDiscovery,
  nicheFor,
  parseDiscovery,
  parseInstagramArgs,
  postedDate,
  readCredentials,
  seededHandles,
  smoke,
  summariseAccount,
  toBaselineSample,
  toStagedEntries,
  toStagedEntry,
  type IgMedia,
  type InstagramArgs,
} from "./instagram.js";
import { buildBaseline } from "./baselines.js";
import { validateEntry } from "./collect.js";
import type { AccountBaseline, PatternMiningConfig } from "./types.js";

const FIXTURES = join(import.meta.dirname, "fixtures");
const discovery = JSON.parse(readFileSync(join(FIXTURES, "instagram-discovery.json"), "utf8")) as unknown;

const account = parseDiscovery(discovery);
const window = mediaFromDiscovery(account);

function post(id: string): IgMedia {
  const found = window.find((m) => m.id === id);
  assert.ok(found, `fixture media ${id} is missing`);
  return found;
}

const REEL = "17800000000000001";
const CAROUSEL = "17800000000000002";
const IMAGE = "17800000000000003";
const FEED_VIDEO = "17800000000000004";
const NO_CAPTION = "17800000000000005";
const REEL_NO_VIEWS = "17800000000000006";
const UNKNOWN_TYPE = "17800000000000007";

const config: PatternMiningConfig = {
  niches: ["civic-democracy", "adhd"],
  accounts: [
    { handle: "@fixturecreator", creator: "Fixture Creator", platform: "instagram", niche: "civic-democracy", followers: null },
    { handle: "@fixturecreator", creator: "Someone Else", platform: "x", niche: "adhd", followers: null },
  ],
  outlier_thresholds: { instagram: { view_follower_ratio: 2, baseline_multiple: 4 } },
  targets: { corpus_size_min: 100, corpus_size_max: 400 },
};

const context = {
  handle: "fixturecreator",
  creator: "Fixture Creator",
  niche: "civic-democracy",
  listing: "business_discovery media edge, reverse chronological (Meta offers no performance sort, so nobody picked these)",
  collectedAt: "2026-08-23T12:00:00.000Z",
  followers: 400000,
  baseline: null as AccountBaseline | null,
  role: "baseline" as "winner" | "baseline",
  route: ROUTE,
};

describe("parsing a business_discovery response", () => {
  test("pulls the account object and its media", () => {
    assert.equal(account?.username, "fixturecreator");
    assert.equal(account?.followers_count, 400000);
    assert.equal(window.length, 7);
  });

  test("a response with no business_discovery object returns null rather than throwing", () => {
    assert.equal(parseDiscovery({ id: "123" }), null);
    assert.equal(parseDiscovery(null), null);
    assert.equal(parseDiscovery({ business_discovery: "nope" }), null);
    assert.deepEqual(mediaFromDiscovery(null), []);
  });

  test("reads the after cursor, since Meta returns no next url on this edge", () => {
    assert.equal(afterCursor(account), "FIXTUREAFTERCURSOR");
    assert.equal(afterCursor({ media: { data: [] } }), null);
    assert.equal(afterCursor({}), null);
  });
});

describe("field readers", () => {
  test("posted_at is an ISO date, and an unparseable timestamp is null rather than a guess", () => {
    assert.equal(postedDate(post(REEL)), "2026-08-01");
    assert.equal(postedDate({ timestamp: "not a date" }), null);
    assert.equal(postedDate({}), null);
  });

  test("caption is trimmed, and absent means empty", () => {
    assert.equal(caption(post(REEL)), "invented caption for a fixture reel, no real post");
    assert.equal(caption(post(NO_CAPTION)), "");
  });

  test("a Reel is decided by media_product_type, not by media_type alone", () => {
    assert.equal(isReel(post(REEL)), true);
    assert.equal(isReel(post(FEED_VIDEO)), false);
    assert.equal(isVideo(post(FEED_VIDEO)), true);
    assert.equal(isVideo(post(IMAGE)), false);
  });

  test("engagement is likes plus comments and never includes views", () => {
    assert.equal(engagementOf(post(REEL)), 52000 + 858);
    assert.equal(engagementOf(post(IMAGE)), 3400 + 61);
    assert.equal(engagementOf({}), null);
  });
});

describe("mediaFor", () => {
  test("body_is_complete is false on EVERY form, which is the whole point of this collector", () => {
    for (const media of window) {
      assert.equal(mediaFor(media).body_is_complete, false, `${media.id} claimed a complete body`);
    }
  });

  test("a Reel is short-video and says outright that body holds the caption, not the speech", () => {
    const form = mediaFor(post(REEL));
    assert.equal(form.form, "short-video");
    assert.match(form.description ?? "", /WRITTEN caption, never the spoken words/);
    assert.equal(form.onscreen_text, null);
    assert.equal(form.duration_seconds, null);
    assert.equal(form.has_captions, null);
    assert.equal(form.aspect, null);
  });

  test("a feed video is video and not short-video", () => {
    assert.equal(mediaFor(post(FEED_VIDEO)).form, "video");
  });

  test("a carousel counts its slides from the children edge and admits the slide text is uncollected", () => {
    const form = mediaFor(post(CAROUSEL));
    assert.equal(form.form, "carousel");
    assert.equal(form.media_count, 4);
    assert.match(form.description ?? "", /what any slide SAYS is uncollected/);
  });

  test("a carousel with no children edge reports an unknown slide count rather than one", () => {
    const form = mediaFor({ media_type: "CAROUSEL_ALBUM" });
    assert.equal(form.media_count, null);
    assert.match(form.description ?? "", /even the slide COUNT is unknown/);
  });

  test("an unrecognised media_type asserts nothing about the media", () => {
    const form = mediaFor(post(UNKNOWN_TYPE));
    assert.equal(form.form, "mixed");
    assert.match(form.description ?? "", /Form was not determined/);
  });
});

describe("toStagedEntry", () => {
  test("a Reel carries the view count, the caption as body, and transcript_source 'caption'", () => {
    const entry = toStagedEntry(post(REEL), { ...context, rank: 1 });
    assert.equal(entry.platform, "instagram");
    assert.equal(entry.kind, "video");
    assert.equal(entry.transcript_source, "caption");
    assert.equal(entry.body, "invented caption for a fixture reel, no real post");
    assert.equal(entry.metrics.views, 1240000);
    assert.equal(entry.metrics.likes, 52000);
    assert.equal(entry.metrics.comments, 858);
    assert.equal(entry.metrics.followers, 400000);
    assert.equal(entry.url, "https://www.instagram.com/reel/FIXTURE001/");
    assert.equal(entry.posted_at, "2026-08-01");
  });

  test("shares is null on every entry, because Business Discovery does not return it", () => {
    for (const media of window) {
      if (typeof media.permalink !== "string") continue;
      assert.equal(toStagedEntry(media, { ...context, rank: 1 }).metrics.shares, null);
    }
  });

  test("a post that is not a Reel has a null view count and says why in notes", () => {
    const entry = toStagedEntry(post(IMAGE), { ...context, rank: 3 });
    assert.equal(entry.metrics.views, null);
    assert.equal(entry.kind, "text");
    assert.equal(entry.transcript_source, null);
    assert.match(entry.notes ?? "", /view_count for Reels only/);
  });

  test("a Reel whose view_count Meta did not return records null rather than zero", () => {
    assert.equal(toStagedEntry(post(REEL_NO_VIEWS), { ...context, rank: 6 }).metrics.views, null);
  });

  test("notes name the paid and crosspost caveats Meta states about view_count", () => {
    const notes = toStagedEntry(post(REEL), { ...context, rank: 1 }).notes ?? "";
    assert.match(notes, /PAID and organic/);
    assert.match(notes, /Facebook views/);
  });

  test("notes carry a body warning on every entry, video or not", () => {
    assert.match(toStagedEntry(post(REEL), { ...context, rank: 1 }).notes ?? "", /BODY WARNING/);
    assert.match(toStagedEntry(post(IMAGE), { ...context, rank: 3 }).notes ?? "", /BODY WARNING/);
  });

  test("the multiple against a measured baseline is written in plain words", () => {
    const baseline = buildBaseline({ platform: "instagram", handle: "fixturecreator" }, toBaselineSample(window), {
      followers: 400000,
      collected_at: context.collectedAt,
      method: "test",
    });
    assert.ok(baseline);
    const entry = toStagedEntry(post(REEL), { ...context, rank: 1, baseline });
    assert.match(entry.notes ?? "", /TRUE MEDIAN engagement/);
    assert.match(entry.notes ?? "", /x that median/);
  });

  test("the same media always produces the same id", () => {
    const a = toStagedEntry(post(REEL), { ...context, rank: 1 });
    const b = toStagedEntry(post(REEL), { ...context, rank: 4 });
    assert.equal(a.id, b.id);
  });
});

describe("toStagedEntries", () => {
  test("stages every captioned post and reports the uncaptioned ones by permalink", () => {
    const staged = toStagedEntries(window, context, 0);
    assert.equal(staged.entries.length, 6);
    assert.deepEqual(staged.skippedNoCaption, ["https://www.instagram.com/p/FIXTURE005/"]);
    assert.equal(staged.skippedBelowFloor, 0);
    assert.equal(staged.skippedNoPermalink, 0);
  });

  test("a post with no permalink is counted, not dropped in silence", () => {
    const staged = toStagedEntries([{ id: "x", caption: "invented", like_count: 5 }, ...window], context, 0);
    assert.equal(staged.skippedNoPermalink, 1);
    assert.equal(staged.entries.length, 6);
  });

  test("an engagement floor filters the window and the caller marks it a winners list", () => {
    const staged = toStagedEntries(window, { ...context, role: "winner" }, 10000);
    assert.equal(staged.entries.length, 1);
    assert.equal(staged.entries[0].url, "https://www.instagram.com/reel/FIXTURE001/");
    assert.equal(staged.skippedBelowFloor, 6);
    assert.equal(staged.entries[0].sample?.role, "winner");
  });

  test("with no floor the entries are marked baseline, because nobody picked them", () => {
    const staged = toStagedEntries(window, context, 0);
    for (const entry of staged.entries) assert.equal(entry.sample?.role, "baseline");
    assert.match(staged.entries[0].notes ?? "", /nobody selected it for having travelled/);
  });

  test("every staged entry passes the corpus validator unchanged", () => {
    for (const entry of toStagedEntries(window, context, 0).entries) {
      const { entry: validated, errors } = validateEntry(JSON.parse(JSON.stringify(entry)), config);
      assert.deepEqual(errors, [], `${entry.id}: ${errors.join("; ")}`);
      assert.ok(validated);
      assert.equal(validated.media?.body_is_complete, false);
    }
  });
});

describe("toBaselineSample", () => {
  test("measures the FULL window in likes plus comments, so a floor cannot bias the median", () => {
    const sample = toBaselineSample(window);
    assert.equal(sample.length, 7);
    // The raw counts travel separately now: buildBaseline reads which of them every post carries
    // and records that in `terms`, so nothing here has to pre-sum and nothing downstream has to
    // guess what was summed.
    for (const item of sample) assert.equal(item.metrics.views, null);
    const baseline = buildBaseline({ platform: "instagram", handle: "fixturecreator" }, sample, {
      followers: 400000,
      collected_at: context.collectedAt,
      method: "test",
    });
    assert.ok(baseline);
    assert.equal(baseline.metric, "engagement");
    assert.equal(baseline.sample_size, 7);
    assert.equal(baseline.median, 2100 + 33);
    assert.equal(baseline.window_start, "2026-06-15");
    assert.equal(baseline.window_end, "2026-08-01");
  });

  test("a post with no like or comment count drops out rather than scoring zero", () => {
    assert.equal(toBaselineSample([{ id: "x" }, post(IMAGE)]).length, 1);
  });
});

describe("buildFields", () => {
  test("asks for the public fields on the nested media edge", () => {
    const fields = buildFields("fixturecreator", { limit: 25, extras: true });
    assert.match(fields, /^business_discovery\.username\(fixturecreator\)\{/);
    assert.match(fields, /followers_count/);
    assert.match(fields, /media\.limit\(25\)\{/);
    for (const field of MEDIA_FIELDS) assert.ok(fields.includes(field), `missing ${field}`);
    for (const field of OPTIONAL_FIELDS) assert.ok(fields.includes(field), `missing ${field}`);
  });

  test("drops the optional fields when asked, and appends the after cursor for page two", () => {
    const fields = buildFields("fixturecreator", { limit: 25, after: "CURSOR", extras: false });
    assert.equal(fields.includes("children"), false);
    assert.equal(fields.includes("alt_text"), false);
    assert.match(fields, /media\.limit\(25\)\.after\(CURSOR\)\{/);
  });
});

describe("graph errors", () => {
  test("reads the error object, and a clean response has none", () => {
    assert.equal(graphError(discovery), null);
    assert.equal(graphError({ error: { code: 190 } })?.code, 190);
  });

  test("only a nonexistent-field error triggers the optional-field retry", () => {
    assert.equal(isUnknownFieldError({ code: 100, message: "(#100) Tried accessing nonexistent field (children)" }), true);
    assert.equal(isUnknownFieldError({ code: 190, message: "nonexistent field" }), false);
    assert.equal(isUnknownFieldError({ code: 100, message: "Invalid parameter" }), false);
    assert.equal(isUnknownFieldError(null), false);
  });

  test("an expired token gets the re-auth instructions and never echoes a credential", () => {
    const message = describeGraphError({ code: 190, type: "OAuthException", message: "Session has expired" }, "fixturecreator");
    assert.match(message, /fb_exchange_token/);
    assert.match(message, /IG_GRAPH_ACCESS_TOKEN/);
    assert.equal(message.includes("access_token=") , false);
  });

  test("a throttle code says run it again later rather than inventing a ceiling", () => {
    for (const code of [4, 17, 32, 613]) {
      const message = describeGraphError({ code, message: "rate limit" }, "fixturecreator");
      assert.match(message, /throttled/);
      assert.match(message, /Nothing partial was written/);
    }
  });

  test("an unreadable target is explained as an account-type problem, not a collector fault", () => {
    const message = describeGraphError({ code: 110, message: "cannot be loaded" }, "somebody");
    assert.match(message, /PROFESSIONAL accounts/);
    assert.match(message, /age-gated/);
  });

  test("caller errors are told apart from account errors", () => {
    for (const code of [190, 10, 200, 4, 17, 32, 613]) assert.equal(isCallerError({ code }), true);
    for (const code of [110, 100, 0]) assert.equal(isCallerError({ code }), false);
    assert.equal(isCallerError(null), false);
  });

  test("a permissions refusal names the scopes and the id mix-up", () => {
    const message = describeGraphError({ code: 200, message: "Permissions error" }, "somebody");
    assert.match(message, /instagram_manage_insights/);
    assert.match(message, /not the target's/);
  });
});

describe("readCredentials", () => {
  test("names every missing key and hands back the setup steps", () => {
    assert.throws(() => readCredentials({} as NodeJS.ProcessEnv), (err: Error) => {
      assert.match(err.message, /IG_GRAPH_ACCESS_TOKEN/);
      assert.match(err.message, /IG_GRAPH_USER_ID/);
      assert.match(err.message, /Facebook Page/);
      return true;
    });
  });

  test("defaults the api version and keeps an override", () => {
    const base = { IG_GRAPH_ACCESS_TOKEN: "t", IG_GRAPH_USER_ID: "1" } as unknown as NodeJS.ProcessEnv;
    assert.equal(readCredentials(base).apiVersion, DEFAULT_API_VERSION);
    assert.equal(readCredentials({ ...base, IG_GRAPH_API_VERSION: "v26.0" }).apiVersion, "v26.0");
  });
});

describe("parseInstagramArgs", () => {
  test("collects accounts and flags, with baselines on by default", () => {
    const args = parseInstagramArgs(["--account", "@one", "--account", "two", "--limit", "50", "--min-engagement", "10000"]);
    assert.deepEqual(args.accounts, ["@one", "two"]);
    assert.equal(args.limit, 50);
    assert.equal(args.minEngagement, 10000);
    assert.equal(args.measureBaseline, true);
    assert.equal(args.smoke, false);
  });

  test("--no-baseline and --smoke are recognised", () => {
    const args = parseInstagramArgs(["--account", "@one", "--no-baseline", "--smoke"]);
    assert.equal(args.measureBaseline, false);
    assert.equal(args.smoke, true);
  });
});

describe("nicheFor and creatorFor", () => {
  test("read the seed for the instagram platform only, ignoring the same handle elsewhere", () => {
    assert.equal(nicheFor(config, "@FixtureCreator"), "civic-democracy");
    assert.equal(creatorFor(config, "fixturecreator"), "Fixture Creator");
    assert.equal(nicheFor(config, "@nobody"), null);
  });
});

// A stub fetch, so the client is exercised without a network or a credential.
function stubFetch(pages: unknown[]): { fetch: (url: string) => Promise<Response>; urls: string[] } {
  const urls: string[] = [];
  let call = 0;
  return {
    urls,
    fetch: async (url: string) => {
      urls.push(url);
      const body = pages[Math.min(call, pages.length - 1)];
      call++;
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    },
  };
}

const creds = { accessToken: "fixture-token-never-real", igUserId: "17841400000000999", apiVersion: DEFAULT_API_VERSION };

describe("InstagramClient", () => {
  test("reads one page and stops when the account runs out of media", async () => {
    const lastPage = JSON.parse(JSON.stringify(discovery)) as { business_discovery: { media: { paging?: unknown } } };
    delete lastPage.business_discovery.media.paging;
    const stub = stubFetch([lastPage]);
    const client = new InstagramClient(creds, { fetchImpl: stub.fetch, politenessMs: 0 });
    const result = await client.recentMedia("@FixtureCreator", 25);
    assert.equal(result.media.length, 7);
    assert.equal(result.account?.followers_count, 400000);
    assert.equal(stub.urls.length, 1);
    assert.match(decodeURIComponent(stub.urls[0]), /business_discovery\.username\(fixturecreator\)/);
  });

  test("follows the after cursor to a second page", async () => {
    const second = JSON.parse(JSON.stringify(discovery)) as {
      business_discovery: { media: { data: IgMedia[]; paging?: unknown } };
    };
    second.business_discovery.media.data = [{ ...post(IMAGE), id: "page-two", permalink: "https://www.instagram.com/p/FIXTURE900/" }];
    delete second.business_discovery.media.paging;
    const stub = stubFetch([discovery, second]);
    const client = new InstagramClient(creds, { fetchImpl: stub.fetch, politenessMs: 0 });
    const result = await client.recentMedia("fixturecreator", 25);
    assert.equal(result.media.length, 8);
    assert.equal(stub.urls.length, 2);
    assert.match(decodeURIComponent(stub.urls[1]), /after\(FIXTUREAFTERCURSOR\)/);
  });

  test("stops at the requested limit", async () => {
    const stub = stubFetch([discovery]);
    const client = new InstagramClient(creds, { fetchImpl: stub.fetch, politenessMs: 0 });
    const result = await client.recentMedia("fixturecreator", 3);
    assert.equal(result.media.length, 3);
  });

  test("retries without the optional fields when Meta refuses them, once for the whole run", async () => {
    const noPaging = JSON.parse(JSON.stringify(discovery)) as { business_discovery: { media: { paging?: unknown } } };
    delete noPaging.business_discovery.media.paging;
    const refusal = { error: { code: 100, type: "OAuthException", message: "(#100) Tried accessing nonexistent field (children)" } };
    const urls: string[] = [];
    let call = 0;
    const fetchImpl = async (url: string) => {
      urls.push(url);
      const body = call++ === 0 ? refusal : noPaging;
      return new Response(JSON.stringify(body), { status: call === 1 ? 400 : 200 });
    };
    const lines: string[] = [];
    const client = new InstagramClient(creds, { fetchImpl, politenessMs: 0, log: (line) => lines.push(line) });
    const first = await client.recentMedia("fixturecreator", 25);
    assert.equal(first.media.length, 7);
    assert.equal(client.extrasAvailable, false);
    assert.equal(urls.length, 2);
    assert.equal(decodeURIComponent(urls[1]).includes("children"), false);
    assert.equal(decodeURIComponent(urls[1]).includes("alt_text"), false);
    assert.match(lines.join("\n"), /Slide TEXT was never available either way/);

    const second = await client.recentMedia("fixturecreator", 25);
    assert.equal(second.media.length, 7);
    // Still just one more call: the refusal is remembered rather than re-earned.
    assert.equal(urls.length, 3);
  });

  test("a non-field error is raised, not retried away", async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ error: { code: 190, type: "OAuthException", message: "Session has expired" } }), { status: 400 });
    const client = new InstagramClient(creds, { fetchImpl, politenessMs: 0 });
    await assert.rejects(() => client.recentMedia("fixturecreator", 25), /rejected the access token/);
  });
});

describe("collectAccount", () => {
  const args: InstagramArgs = {
    accounts: ["@fixturecreator"],
    niche: null,
    limit: 25,
    minEngagement: 0,
    measureBaseline: true,
    outDir: "unused",
    baselinesPath: "unused",
    smoke: false,
  };

  function clientOverOnePage(): InstagramClient {
    const page = JSON.parse(JSON.stringify(discovery)) as { business_discovery: { media: { paging?: unknown } } };
    delete page.business_discovery.media.paging;
    return new InstagramClient(creds, { fetchImpl: stubFetch([page]).fetch, politenessMs: 0 });
  }

  test("stages the window, measures a baseline over all of it, and writes no view count it did not get", async () => {
    const result = await collectAccount(clientOverOnePage(), "@fixturecreator", args, config, Date.parse("2026-08-23T12:00:00Z"), () => {});
    assert.equal(result.entries.length, 6);
    assert.equal(result.baseline?.metric, "engagement");
    assert.equal(result.baseline?.sample_size, 7);
    assert.match(result.baseline?.method ?? "", /No filter on engagement, form or topic/);
    const withViews = result.entries.filter((e) => e.metrics.views !== null);
    assert.equal(withViews.length, 1);
    for (const entry of result.entries) assert.equal(entry.media?.body_is_complete, false);
  });

  test("refuses an account with no seeded niche rather than filing it under one nobody chose", async () => {
    await assert.rejects(
      () => collectAccount(clientOverOnePage(), "@unseeded", { ...args }, config, Date.now(), () => {}),
      /not seeded in config\/pattern-mining.yaml/,
    );
  });

  test("--niche overrides the seed lookup", async () => {
    const result = await collectAccount(clientOverOnePage(), "@unseeded", { ...args, niche: "adhd" }, config, Date.now(), () => {});
    assert.equal(result.entries[0].niche, "adhd");
  });

  test("an engagement floor flips the recorded role to winner", async () => {
    const result = await collectAccount(
      clientOverOnePage(),
      "@fixturecreator",
      { ...args, minEngagement: 10000 },
      config,
      Date.now(),
      () => {},
    );
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].sample?.role, "winner");
    // The baseline is still measured over the whole window, not over what survived the floor.
    assert.equal(result.baseline?.sample_size, 7);
  });

  test("an account Meta returns nothing for is explained as an account-type problem", async () => {
    const fetchImpl = async () => new Response(JSON.stringify({ id: "17841400000000999" }), { status: 200 });
    const client = new InstagramClient(creds, { fetchImpl, politenessMs: 0 });
    await assert.rejects(
      () => collectAccount(client, "@somebody", args, config, Date.now(), () => {}),
      /not an Instagram professional \(Business or Creator\) account/,
    );
  });
});

describe("fieldState", () => {
  test("tells apart a value, an empty, and a field that never came back", () => {
    assert.equal(fieldState({ caption: "words" }, "caption"), "value");
    assert.equal(fieldState({ caption: "" }, "caption"), "empty");
    assert.equal(fieldState({ caption: "   " }, "caption"), "empty");
    assert.equal(fieldState({ caption: null }, "caption"), "empty");
    assert.equal(fieldState({}, "caption"), "absent");
  });

  test("a zero count is a value, not an empty, because 0 likes is a real answer", () => {
    assert.equal(fieldState({ like_count: 0 }, "like_count"), "value");
  });

  test("the children edge is read through its data list", () => {
    assert.equal(fieldState({ children: { data: [{ id: "a" }] } }, "children"), "value");
    assert.equal(fieldState({ children: { data: [] } }, "children"), "empty");
    assert.equal(fieldState({}, "children"), "absent");
  });
});

describe("summariseAccount", () => {
  test("counts each field's three states across the posts read", () => {
    const result = summariseAccount("fixturecreator", account, window);
    assert.equal(result.professional, true);
    assert.equal(result.followers, 400000);
    assert.equal(result.mediaRead, 7);
    assert.equal(result.reels, 2);
    // Only one of the two fixture Reels carries a view_count, which is exactly the distinction
    // this report exists to surface.
    assert.equal(result.reelsWithViews, 1);
    assert.equal(result.fields.get("view_count")?.value, 1);
    assert.equal(result.fields.get("view_count")?.absent, 6);
    assert.equal(result.fields.get("caption")?.value, 6);
    assert.equal(result.fields.get("caption")?.absent, 1);
    assert.equal(result.fields.get("alt_text")?.value, 1);
    assert.equal(result.fields.get("children")?.value, 1);
  });

  test("a null account is reported as not readable rather than as an empty account", () => {
    const result = summariseAccount("somebody", null, []);
    assert.equal(result.professional, false);
    assert.equal(result.followers, null);
  });
});

describe("seededHandles", () => {
  test("returns the instagram seeds only, normalised and deduped", () => {
    assert.deepEqual(seededHandles(config), ["fixturecreator"]);
    assert.deepEqual(seededHandles({ ...config, accounts: [] }), []);
  });
});

describe("smoke", () => {
  function smokeClient(body: unknown): InstagramClient {
    const fetchImpl = async () => new Response(JSON.stringify(body), { status: 200 });
    return new InstagramClient(creds, { fetchImpl, politenessMs: 0 });
  }

  test("reports value, empty and absent counts separately for every field", async () => {
    const lines: string[] = [];
    const page = JSON.parse(JSON.stringify(discovery)) as { business_discovery: { media: { paging?: unknown } } };
    delete page.business_discovery.media.paging;
    const code = await smoke(smokeClient(page), ["@fixturecreator"], (line) => lines.push(line));
    const out = lines.join("\n");
    assert.equal(code, 0);
    assert.match(out, /READABLE: YES/);
    assert.match(out, /field\s+value\s+empty\s+absent/);
    // view_count on one of the five read, absent on the other four, which is the split the whole
    // report exists to make visible.
    assert.match(out, /view_count\s+1\s+0\s+4/);
    assert.match(out, /body_is_complete: false/);
  });

  test("a field absent from every post read is called out as never returned", async () => {
    const lines: string[] = [];
    const page = JSON.parse(JSON.stringify(discovery)) as {
      business_discovery: { media: { data: Record<string, unknown>[]; paging?: unknown } };
    };
    delete page.business_discovery.media.paging;
    for (const item of page.business_discovery.media.data) delete item.alt_text;
    await smoke(smokeClient(page), ["@fixturecreator"], (line) => lines.push(line));
    assert.match(lines.join("\n"), /alt_text\s+0\s+0\s+5\s+<- never returned for this account/);
  });

  test("a field present but blank everywhere is called out as returned but always empty", async () => {
    const lines: string[] = [];
    const page = JSON.parse(JSON.stringify(discovery)) as {
      business_discovery: { media: { data: Record<string, unknown>[]; paging?: unknown } };
    };
    delete page.business_discovery.media.paging;
    for (const item of page.business_discovery.media.data) item.alt_text = "";
    await smoke(smokeClient(page), ["@fixturecreator"], (line) => lines.push(line));
    assert.match(lines.join("\n"), /alt_text\s+0\s+5\s+0\s+<- returned but always empty/);
  });

  test("an unreadable handle names all three causes and never calls it an API failure", async () => {
    const lines: string[] = [];
    const code = await smoke(smokeClient({ id: "17841400000000999" }), ["@somebody"], (line) => lines.push(line));
    const out = lines.join("\n");
    assert.equal(code, 1);
    assert.match(out, /READABLE: NO/);
    assert.match(out, /personal account/);
    assert.match(out, /age-gated/);
    assert.match(out, /handle in config\/pattern-mining.yaml is wrong/);
    assert.equal(out.includes("API failed"), false);
  });

  test("one bad handle does not stop the others being checked", async () => {
    const lines: string[] = [];
    let call = 0;
    const fetchImpl = async () => {
      const good = JSON.parse(JSON.stringify(discovery)) as { business_discovery: { media: { paging?: unknown } } };
      delete good.business_discovery.media.paging;
      const body = call++ === 0 ? { error: { code: 110, message: "cannot be loaded" } } : good;
      return new Response(JSON.stringify(body), { status: call === 1 ? 400 : 200 });
    };
    const client = new InstagramClient(creds, { fetchImpl, politenessMs: 0 });
    const code = await smoke(client, ["@broken", "@fixturecreator"], (line) => lines.push(line));
    const out = lines.join("\n");
    assert.equal(code, 1);
    assert.match(out, /SEEDS: 1 of 2 account\(s\) readable/);
    assert.match(out, /Not readable: @broken/);
    // The exit code must not read as a setup failure. A caller error would have aborted above.
    assert.match(out, /SETUP: working/);
    assert.match(out, /at least one SEED needs attention, never that the setup failed/);
  });

  test("a dead token stops the run instead of calling every account non-professional", async () => {
    const lines: string[] = [];
    let calls = 0;
    const failing = async () => {
      calls++;
      return new Response(JSON.stringify({ error: { code: 190, type: "OAuthException", message: "Session has expired" } }), { status: 400 });
    };
    const client = new InstagramClient(creds, { fetchImpl: failing, politenessMs: 0, log: (line) => lines.push(line) });
    const code = await smoke(client, ["@one", "@two", "@three"], (line) => lines.push(line));
    const out = lines.join("\n");
    assert.equal(code, 1);
    // It stopped on the first handle rather than mislabelling the other two.
    assert.equal(calls, 1);
    assert.match(out, /about the CALLER, not about any of these accounts/);
    assert.match(out, /rejected the access token/);
    assert.equal(out.includes("READABLE: NO"), false);
  });

  test("a throttle stops the run the same way", async () => {
    const lines: string[] = [];
    const failing = async () =>
      new Response(JSON.stringify({ error: { code: 4, message: "Application request limit reached" } }), { status: 400 });
    const client = new InstagramClient(creds, { fetchImpl: failing, politenessMs: 0, log: (line) => lines.push(line) });
    const code = await smoke(client, ["@one", "@two"], (line) => lines.push(line));
    assert.equal(code, 1);
    assert.match(lines.join("\n"), /throttled/);
  });

  test("nothing the smoke check prints contains the token, on any path", async () => {
    const lines: string[] = [];
    const failing = async () => new Response(JSON.stringify({ error: { code: 190, message: "Session has expired" } }), { status: 400 });
    const client = new InstagramClient(creds, { fetchImpl: failing, politenessMs: 0, log: (line) => lines.push(line) });
    await smoke(client, ["@one", "@two"], (line) => lines.push(line));
    const good = JSON.parse(JSON.stringify(discovery)) as { business_discovery: { media: { paging?: unknown } } };
    delete good.business_discovery.media.paging;
    await smoke(smokeClient(good), ["@fixturecreator"], (line) => lines.push(line));
    const out = lines.join("\n");
    // The credential value itself must never appear anywhere.
    assert.equal(out.includes(creds.accessToken), false);
    // Nor may a query string carrying one. The re-auth instructions mention the /oauth/access_token
    // ENDPOINT by name, which is a documentation string and not a credential, so the check is for
    // an assigned value rather than for the word.
    assert.equal(/access_token=\S/.test(out), false);
  });
});
