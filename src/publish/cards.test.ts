import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { basePlatform, cardTarget, publishCards } from "./cards.js";
import { readQueue } from "./queue.js";

// The per-platform card model (Muxin, 2026-07-03): a card row is `quote-card:<target>` — one card
// image shared across platforms, each with its OWN spun context caption so a quote never ships out
// of context. basePlatform + cardTarget decode the row's platform column.

test("basePlatform strips the colon subtype so cards.ts still owns the row", () => {
  assert.equal(basePlatform("quote-card:x"), "quote-card");
  assert.equal(basePlatform("quote-card"), "quote-card");
  assert.equal(basePlatform("community:democratic-resilience"), "community");
  assert.equal(basePlatform("x"), "x");
});

test("cardTarget returns the destination platform, or null for a legacy fan-out row", () => {
  assert.equal(cardTarget("quote-card:x"), "x");
  assert.equal(cardTarget("quote-card:linkedin"), "linkedin");
  assert.equal(cardTarget("quote-card:bluesky"), "bluesky");
  assert.equal(cardTarget("quote-card"), null); // legacy: fan out to every account
  assert.equal(cardTarget("quote-card:"), null); // empty suffix → treat as legacy, not a "" platform
});

// Card 1829fdf9 (2026-07-08): quote cards now ship as NATIVE Typefully image posts on
// x/linkedin/bluesky — uploadMedia + media_ids attached to a scheduled draft, the exact path
// publishText already uses for text posts — instead of the retired PostPeer/Upload-Post relays.
// Every provider call below is a mocked global.fetch stub (same pattern as typefully.test.ts's
// pagination tests); no real network call is ever made, and a call to postpeer.dev or
// upload-post.com is treated as a hard failure.
describe("publishCards: native Typefully routing (mocked Typefully client)", () => {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  // appendBetPlacement (src/publish/queue.ts) writes to briefs/bets.md — a real, shared repo file
  // other concurrently-running test files (e.g. reuse-guard.test.ts) also read/write, since node's
  // test runner runs test files concurrently. Point it at an isolated fixture file via
  // CONTENT_AGENTS_TEST_BETS_PATH (same isolation mechanism as slots.test.ts's
  // CONTENT_AGENTS_TEST_LEDGER) instead of touching the real ledger at all.
  const TEST_BETS_PATH = join(repoRoot, "briefs", "test-fixture-cards-bets.md");
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.TYPEFULLY_API_KEY;
  const originalSetId = process.env.TYPEFULLY_SOCIAL_SET_ID;
  const originalBetsPath = process.env.CONTENT_AGENTS_TEST_BETS_PATH;
  const originalAccountId = process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID;
  const dirs: string[] = [];

  before(() => {
    process.env.TYPEFULLY_API_KEY = "test-key";
    process.env.TYPEFULLY_SOCIAL_SET_ID = "test-set";
    process.env.CONTENT_AGENTS_TEST_BETS_PATH = TEST_BETS_PATH;
    process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID = "human-inference/typefully";
  });

  after(() => {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.TYPEFULLY_API_KEY;
    else process.env.TYPEFULLY_API_KEY = originalKey;
    if (originalSetId === undefined) delete process.env.TYPEFULLY_SOCIAL_SET_ID;
    else process.env.TYPEFULLY_SOCIAL_SET_ID = originalSetId;
    if (originalBetsPath === undefined) delete process.env.CONTENT_AGENTS_TEST_BETS_PATH;
    else process.env.CONTENT_AGENTS_TEST_BETS_PATH = originalBetsPath;
    if (originalAccountId === undefined) delete process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID;
    else process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID = originalAccountId;
    if (existsSync(TEST_BETS_PATH)) rmSync(TEST_BETS_PATH, { force: true });
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  // Routes calls to a stub Typefully API (media/upload → presigned PUT → drafts), records every
  // call, and THROWS on any call to a retired card provider — proving PostPeer/Upload-Post are
  // never touched, not just asserting-after-the-fact on an empty list.
  function stubTypefully(): { calls: { method: string; url: string; body?: unknown }[] } {
    const calls: { method: string; url: string; body?: unknown }[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      calls.push({ method, url, body });
      if (url.includes("postpeer.dev") || url.includes("upload-post.com")) {
        throw new Error(`unexpected call to a retired card provider: ${method} ${url}`);
      }
      if (url.includes("/media/upload")) {
        return new Response(JSON.stringify({ media_id: "media-1", upload_url: "https://s3.example.com/upload" }), { status: 200 });
      }
      if (url.includes("s3.example.com")) {
        return new Response(null, { status: 200 });
      }
      if (url.endsWith("/drafts")) {
        return new Response(JSON.stringify({ id: "draft-1", share_url: "https://typefully.com/x/draft-1" }), { status: 200 });
      }
      throw new Error(`unexpected fetch in test: ${method} ${url}`);
    }) as typeof fetch;
    return { calls };
  }

  function tmpFolder(rowLine: string, captionFrontmatter: string): string {
    const folder = mkdtempSync(join(tmpdir(), "cards-test-"));
    dirs.push(folder);
    writeFileSync(join(folder, "content-request.json"), JSON.stringify({ origin: "human-inference" }));
    mkdirSync(join(folder, "derivatives"), { recursive: true });
    mkdirSync(join(folder, "images"), { recursive: true });
    writeFileSync(
      join(folder, "review-queue.md"),
      `| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |\n` +
        `|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|\n` +
        rowLine
    );
    writeFileSync(join(folder, "derivatives", "quote-card-1-x.md"), `${captionFrontmatter}Context caption for the card.\n`);
    writeFileSync(join(folder, "images", "quote-card-1.png"), "not real png bytes, just a fixture for the mocked upload");
    return folder;
  }

  const FUTURE_ISO = "2099-01-01T18:00:00.000Z";

  test("schedules a quote-card:x row as a native Typefully draft: uploadMedia → media_ids on the draft, never PostPeer/Upload-Post", async () => {
    const { calls } = stubTypefully();
    const folder = tmpFolder(
      `| quote-card-1-x | quote-card:x | image | images/quote-card-1.png | 4 | 5 | yes | approve | test row | from /cycle |\n`,
      `---\nplatform: quote-card:x\ncta: none\n---\n`
    );

    const results = await publishCards(folder, { atOverride: FUTURE_ISO });

    assert.equal(results.length, 1);
    assert.equal(results[0].platform, "x");
    assert.equal(results[0].ref, "typefully draft draft-1");

    const mediaUploadCall = calls.find((c) => c.url.includes("/media/upload"));
    assert.ok(mediaUploadCall, "must upload the card PNG via Typefully's media/upload endpoint");
    const draftCall = calls.find((c) => c.url.endsWith("/drafts"));
    assert.ok(draftCall, "must create a Typefully draft");
    const posts = (draftCall!.body as { platforms: Record<string, { posts: { media_ids?: string[] }[] }> }).platforms.x.posts;
    assert.deepEqual(posts[0].media_ids, ["media-1"], "the draft's post must carry the uploaded card's media_id");

    assert.ok(
      !calls.some((c) => c.url.includes("postpeer.dev") || c.url.includes("upload-post.com")),
      "no call to a retired card provider should ever be made"
    );

    const { rows } = readQueue(folder);
    assert.equal(rows[0].status, "published");
    const log = readFileSync(join(folder, "publish-log.md"), "utf8");
    assert.match(log, /quote-card-1-x → typefully draft draft-1/);
  });

  test("a card with a resolvable CTA places the link like a text post (X reply thread), not omitted", async () => {
    const { calls } = stubTypefully();
    const folder = tmpFolder(
      `| quote-card-1-x | quote-card:x | image | images/quote-card-1.png | 4 | 5 | yes | approve | test row | from /cycle |\n`,
      `---\nplatform: quote-card:x\ncta: "https://example.com/essay"\ncta_label: "Full essay:"\n---\n`
    );

    await publishCards(folder, { atOverride: FUTURE_ISO });

    const draftCall = calls.find((c) => c.url.endsWith("/drafts"));
    assert.ok(draftCall);
    const xPosts = (draftCall!.body as { platforms: Record<string, { posts: { text: string }[] }> }).platforms.x.posts;
    // config/cta.yaml places x's link in the first reply (not inline, not omitted) — same as text.
    assert.equal(xPosts.length, 2, "X CTA goes in a second (reply) post, matching publishText's buildPosts");
    assert.match(xPosts[1].text, /https:\/\/example\.com\/essay/);
  });

  // Card d80411bc (strategy lever E scaffold): the resolved CTA destination now rides along as a
  // `| cta:<dest>` marker on the bets.md Placed-log row, so tag-source.ts can later stamp it onto
  // posts.cta_destination. Verifies both resolution paths land the right marker. bets.md
  // accumulates across tests in this describe block (only cleaned in `after()`), so each
  // assertion greps the line for THIS test's own folder (a fresh mkdtemp dir every time), never
  // the whole file — otherwise an earlier test's marker would false-positive a later assertion.
  function betsLineFor(folder: string, rowId: string): string {
    const bets = readFileSync(TEST_BETS_PATH, "utf8");
    const line = bets.split("\n").find((l) => l.includes(`[${basename(folder)}/${rowId}]`));
    assert.ok(line, `no Placed-log row found for ${basename(folder)}/${rowId}`);
    return line!;
  }

  test("cta:source resolves and marks the Placed-log row `| cta:source`", async () => {
    stubTypefully();
    const folder = tmpFolder(
      `| quote-card-1-x | quote-card:x | image | images/quote-card-1.png | 4 | 5 | yes | approve | test row | from /cycle |\n`,
      `---\nplatform: quote-card:x\ncta: source\n---\n`
    );

    await publishCards(folder, { atOverride: FUTURE_ISO });

    assert.match(betsLineFor(folder, "quote-card-1-x"), /\| cta:source \|/);
  });

  test("a content_type resolving to work_with_me marks the Placed-log row `| cta:work_with_me`", async () => {
    stubTypefully();
    const folder = tmpFolder(
      `| quote-card-1-x | quote-card:x | image | images/quote-card-1.png | 4 | 5 | yes | approve | test row | from /cycle |\n`,
      `---\nplatform: quote-card:x\ncontent_type: [offer_adjacent_post]\n---\n`
    );

    await publishCards(folder, { atOverride: FUTURE_ISO });

    assert.match(betsLineFor(folder, "quote-card-1-x"), /\| cta:work_with_me \|/);
  });

  test("a literal-url cta override (not one of the three known destinations) leaves no cta marker", async () => {
    stubTypefully();
    const folder = tmpFolder(
      `| quote-card-1-x | quote-card:x | image | images/quote-card-1.png | 4 | 5 | yes | approve | test row | from /cycle |\n`,
      `---\nplatform: quote-card:x\ncta: "https://example.com/essay"\ncta_label: "Full essay:"\n---\n`
    );

    await publishCards(folder, { atOverride: FUTURE_ISO });

    assert.ok(
      !/\| cta:/.test(betsLineFor(folder, "quote-card-1-x")),
      "a literal-url override should not be classified into a cta_destination bucket"
    );
  });

  test("a legacy fan-out quote-card row (no :<platform> target) throws instead of silently misrouting", async () => {
    stubTypefully();
    const folder = tmpFolder(
      `| quote-card-1 | quote-card | image | images/quote-card-1.png | 4 | 5 | yes | approve | test row | from /cycle |\n`,
      `---\nplatform: quote-card\ncta: none\n---\n`
    );
    await assert.rejects(() => publishCards(folder, { atOverride: FUTURE_ISO }), /legacy fan-out/);
  });
});
