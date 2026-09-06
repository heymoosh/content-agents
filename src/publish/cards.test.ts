import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { basePlatform, cardTarget, publishCards } from "./cards.js";
import { readQueue } from "./queue.js";
import { laDayKey } from "./slots.js";

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
  const originalLedger = process.env.CONTENT_AGENTS_TEST_LEDGER;
  const TEST_LEDGER_PATH = join(mkdtempSync(join(tmpdir(), "cards-ledger-")), "publish-schedule.jsonl");
  const dirs: string[] = [];

  before(() => {
    process.env.TYPEFULLY_API_KEY = "test-key";
    process.env.TYPEFULLY_SOCIAL_SET_ID = "test-set";
    process.env.CONTENT_AGENTS_TEST_BETS_PATH = TEST_BETS_PATH;
    process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID = "human-inference/typefully";
    // Slot claims go to an isolated ledger, never data/scheduler/publish-schedule.jsonl.
    process.env.CONTENT_AGENTS_TEST_LEDGER = TEST_LEDGER_PATH;
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
    if (originalLedger === undefined) delete process.env.CONTENT_AGENTS_TEST_LEDGER;
    else process.env.CONTENT_AGENTS_TEST_LEDGER = originalLedger;
    rmSync(dirname(TEST_LEDGER_PATH), { recursive: true, force: true });
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

  function tmpFolder(rowLine: string, captionFrontmatter: string, sourceFrontmatter = ""): string {
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
    if (sourceFrontmatter) writeFileSync(join(folder, "source.md"), sourceFrontmatter);
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
      `---\nplatform: quote-card:x\ncta: source\n---\n`,
      `---\ncanonical_url: https://example.com/essay\nsource_kind: essay\n---\n`
    );

    await publishCards(folder, { atOverride: FUTURE_ISO });

    assert.match(betsLineFor(folder, "quote-card-1-x"), /\| cta:source \|/);
  });

  test("a content_type resolving to work_with_me marks the Placed-log row `| cta:work_with_me`", async () => {
    stubTypefully();
    const folder = tmpFolder(
      `| quote-card-1-x | quote-card:x | image | images/quote-card-1.png | 4 | 5 | yes | approve | test row | from /cycle |\n`,
      `---\nplatform: quote-card:x\ncontent_type: [offer_adjacent_post]\ncta_reviewed: true\ncta_fit: high\ncta_value: high\n---\n`
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

  // SLICE-5J: Typefully is the BACKUP route for a Content-page configured-media image row when
  // Postiz cannot take it. publishCards already does the per-row work (rendered image + the row's
  // derivatives/<id>.md caption + a claimed slot + the reuse guard + a native scheduled draft); the
  // only thing that changed is which rows it will pick up.
  function tmpMediaFolder(rowLine: string, captionFrontmatter = "---\ncta: none\n---\n", rowId = "cm-1", assetRelPath = "configured-media/cm-1/card.png"): string {
    const folder = mkdtempSync(join(tmpdir(), "cards-media-test-"));
    dirs.push(folder);
    writeFileSync(join(folder, "content-request.json"), JSON.stringify({ origin: "human-inference" }));
    mkdirSync(join(folder, "derivatives"), { recursive: true });
    mkdirSync(join(folder, assetRelPath, ".."), { recursive: true });
    writeFileSync(
      join(folder, "review-queue.md"),
      `| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |\n` +
        `|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|\n` +
        rowLine
    );
    writeFileSync(join(folder, "derivatives", `${rowId}.md`), `${captionFrontmatter}Caption Muxin approved for this image.\n`);
    writeFileSync(join(folder, assetRelPath), "not real png bytes, just a fixture for the mocked upload");
    return folder;
  }

  test("an approved configured-media image row schedules as a native Typefully image draft carrying its asset and derivative caption", async () => {
    const { calls } = stubTypefully();
    const folder = tmpMediaFolder(
      `| cm-1 | linkedin | image | configured-media/cm-1/card.png | 4 | 5 | yes | approve | studio media row | from studio |\n`
    );

    // onlyIds is the fallback authorization: studio-scheduling's scheduleMediaViaTypefully always
    // names the row it decided Postiz could not take.
    const results = await publishCards(folder, { onlyIds: ["cm-1"], atOverride: FUTURE_ISO });

    assert.equal(results.length, 1);
    assert.equal(results[0].platform, "linkedin", "a media row's destination is its own platform column");
    assert.equal(results[0].ref, "typefully draft draft-1");

    const draftCall = calls.find((c) => c.url.endsWith("/drafts"));
    assert.ok(draftCall, "must create a Typefully draft");
    const body = draftCall!.body as { publish_at?: string; platforms: Record<string, { enabled: boolean; posts: { text: string; media_ids?: string[] }[] }> };
    const posts = body.platforms.linkedin.posts;
    assert.deepEqual(posts[0].media_ids, ["media-1"], "the draft must carry the row's rendered asset");
    assert.match(posts[0].text, /Caption Muxin approved for this image\./, "the caption is the row's own derivatives/<id>.md body");

    // CLAUDE.md rule 2: a SCHEDULED DRAFT, never an instant post. Asserted on the payload itself,
    // not inferred from the endpoint — the exact key set proves there is no post-now/share field
    // riding along, and publish_at is a real future time.
    assert.deepEqual(Object.keys(body).sort(), ["draft_title", "platforms", "publish_at"]);
    assert.equal(body.publish_at, FUTURE_ISO);
    assert.ok(new Date(body.publish_at!).getTime() > Date.now(), "the draft is scheduled forward, not published now");
    assert.equal(body.platforms.linkedin.enabled, true);

    const { rows } = readQueue(folder);
    assert.equal(rows[0].status, "published");
    assert.match(readFileSync(join(folder, "publish-log.md"), "utf8"), /cm-1 → typefully draft draft-1 \(linkedin/);
  });

  test("publishCards leaves alone every media row Typefully cannot take", async () => {
    const cases: [string, string, string][] = [
      // [description, row line, asset path]
      ["video", `| cm-1 | linkedin | video | configured-media/cm-1/video.mp4 | 4 | 5 | yes | approve | v | studio |\n`, "configured-media/cm-1/video.mp4"],
      ["carousel", `| cm-1 | linkedin | image | configured-media/cm-1/carousel-manifest.json | 4 | 5 | yes | approve | c | studio |\n`, "configured-media/cm-1/carousel-manifest.json"],
      ["instagram", `| cm-1 | instagram | image | configured-media/cm-1/card.png | 4 | 5 | yes | approve | i | studio |\n`, "configured-media/cm-1/card.png"],
      ["threads", `| cm-1 | threads | image | configured-media/cm-1/card.png | 4 | 5 | yes | approve | t | studio |\n`, "configured-media/cm-1/card.png"],
      ["mastodon", `| cm-1 | mastodon | image | configured-media/cm-1/card.png | 4 | 5 | yes | approve | m | studio |\n`, "configured-media/cm-1/card.png"],
      // a plain image row that is NOT a configured-media asset stays out too
      ["non-configured asset", `| cm-1 | linkedin | image | images/loose.png | 4 | 5 | yes | approve | n | studio |\n`, "images/loose.png"],
    ];
    for (const [label, rowLine, assetRelPath] of cases) {
      const { calls } = stubTypefully();
      const folder = tmpMediaFolder(rowLine, "---\ncta: none\n---\n", "cm-1", assetRelPath);
      // Named in onlyIds and still refused: eligibility, not authorization, is what stops these.
      const results = await publishCards(folder, { onlyIds: ["cm-1"], atOverride: FUTURE_ISO });
      assert.deepEqual(results, [], `${label}: must not be scheduled`);
      assert.ok(!calls.some((c) => c.url.endsWith("/drafts")), `${label}: no Typefully draft may be created`);
      assert.equal(readQueue(folder).rows[0].status, "approve", `${label}: the row keeps its approval`);
    }
  });

  // FINDING A: `npm run publish:cards <folder>` calls publishCards(folder) with no opts. If mere
  // approval put a media row on this route, that bare sweep would ship it through Typefully with
  // Postiz available and willing — Typefully as a second default, not a backup. Only
  // studio-scheduling's scheduleMediaViaTypefully may authorize the backup, and it always names the
  // row in onlyIds.
  test("a bare folder sweep schedules the quote-card rows and never an approved, fully eligible media row", async () => {
    const { calls } = stubTypefully();
    const folder = mkdtempSync(join(tmpdir(), "cards-sweep-test-"));
    dirs.push(folder);
    writeFileSync(join(folder, "content-request.json"), JSON.stringify({ origin: "human-inference" }));
    mkdirSync(join(folder, "derivatives"), { recursive: true });
    mkdirSync(join(folder, "images"), { recursive: true });
    mkdirSync(join(folder, "configured-media", "cm-1"), { recursive: true });
    writeFileSync(
      join(folder, "review-queue.md"),
      `| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |\n` +
        `|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|\n` +
        `| quote-card-1-x | quote-card:x | image | images/quote-card-1.png | 4 | 5 | yes | approve | card row | from /cycle |\n` +
        `| cm-1 | linkedin | image | configured-media/cm-1/card.png | 4 | 5 | yes | approve | eligible media row | from studio |\n`
    );
    writeFileSync(join(folder, "derivatives", "quote-card-1-x.md"), `---\nplatform: quote-card:x\ncta: none\n---\nContext caption for the card.\n`);
    writeFileSync(join(folder, "derivatives", "cm-1.md"), `---\ncta: none\n---\nCaption Muxin approved for this image.\n`);
    writeFileSync(join(folder, "images", "quote-card-1.png"), "fixture");
    writeFileSync(join(folder, "configured-media", "cm-1", "card.png"), "fixture");

    const results = await publishCards(folder, { atOverride: FUTURE_ISO });

    assert.deepEqual(results.map((r) => r.id), ["quote-card-1-x"], "the sweep takes the card row and only the card row");
    assert.equal(calls.filter((c) => c.url.endsWith("/drafts")).length, 1, "exactly one draft, for the quote-card row");
    const rows = readQueue(folder).rows;
    assert.equal(rows.find((r) => r.id === "quote-card-1-x")!.status, "published");
    assert.equal(rows.find((r) => r.id === "cm-1")!.status, "approve", "the media row is left for the Postiz-first path to decide");
  });

  // Box 8, across invocations: a completed fallback must not produce a second live draft if the row
  // is somehow still `approve` on a later run (a crash between createDraft and the status write).
  test("re-running after a completed fallback reuses the logged draft instead of creating a second one", async () => {
    const { calls } = stubTypefully();
    const folder = tmpMediaFolder(
      `| cm-1 | linkedin | image | configured-media/cm-1/card.png | 4 | 5 | yes | approve | studio media row | from studio |\n`
    );

    const first = await publishCards(folder, { onlyIds: ["cm-1"], atOverride: FUTURE_ISO });
    assert.equal(first[0].ref, "typefully draft draft-1");
    assert.equal(calls.filter((c) => c.url.endsWith("/drafts")).length, 1);

    // Put the row back to `approve`, exactly as a crashed status write would have left it.
    const queuePath = join(folder, "review-queue.md");
    writeFileSync(queuePath, readFileSync(queuePath, "utf8").replace("| published |", "| approve |"));
    assert.equal(readQueue(folder).rows[0].status, "approve", "precondition: the row is approve again");

    // Layer one: the reuse guard alone already refuses the re-run (linkedin's min_reuse_days).
    assert.deepEqual(await publishCards(folder, { onlyIds: ["cm-1"], atOverride: FUTURE_ISO }), []);
    assert.equal(calls.filter((c) => c.url.endsWith("/drafts")).length, 1);

    // Layer two: even with the reuse window bypassed, alreadyLoggedDraft reuses the logged ref
    // instead of creating a second live draft.
    const second = await publishCards(folder, { onlyIds: ["cm-1"], atOverride: FUTURE_ISO, forceReuse: true });

    assert.equal(calls.filter((c) => c.url.endsWith("/drafts")).length, 1, "no second live draft may be created");
    assert.equal(calls.filter((c) => c.url.includes("/media/upload")).length, 1, "and no second media upload");
    assert.equal(second[0].ref, "typefully draft draft-1", "the prior draft's ref is reused");
    assert.equal(readQueue(folder).rows[0].status, "published");
  });

  test("fallback media rows claim real slots from the shared ledger and cannot exceed linkedin's per-day cap", async () => {
    // No --at override here: the rows go through the unified scheduler (slots.ts + the
    // config/platforms.yaml linkedin cadence + the shared ledger), exactly as the card path does.
    // config/platforms.yaml gives linkedin max_slots_per_day: 2, so three rows cannot land three
    // times on one PT day no matter how they are claimed.
    const days: string[] = [];
    for (const n of [1, 2, 3]) {
      stubTypefully();
      const folder = tmpMediaFolder(
        `| cm-${n} | linkedin | image | configured-media/cm-${n}/card.png | 4 | 5 | yes | approve | studio media row | from studio |\n`,
        "---\ncta: none\n---\n",
        `cm-${n}`,
        `configured-media/cm-${n}/card.png`
      );
      const [scheduled] = await publishCards(folder, { onlyIds: [`cm-${n}`] });
      assert.ok(scheduled?.plannedFor, `row ${n} must be given a real scheduled time`);
      assert.ok(new Date(scheduled.plannedFor!).getTime() > Date.now(), `row ${n} must be scheduled in the future`);
      days.push(laDayKey(new Date(scheduled.plannedFor!)));
    }
    for (const day of new Set(days)) {
      assert.ok(days.filter((d) => d === day).length <= 2, `more than linkedin's max_slots_per_day landed on ${day}: ${days.join(", ")}`);
    }
  });

  test("an unapproved media row is never scheduled, no matter how eligible it is", async () => {
    const { calls } = stubTypefully();
    const folder = tmpMediaFolder(
      `| cm-1 | linkedin | image | configured-media/cm-1/card.png | 4 | 5 | yes | pending | studio media row | from studio |\n`
    );
    assert.deepEqual(await publishCards(folder, { onlyIds: ["cm-1"], atOverride: FUTURE_ISO }), []);
    assert.ok(!calls.some((c) => c.url.endsWith("/drafts")), "review is the only gate that releases a row");
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
