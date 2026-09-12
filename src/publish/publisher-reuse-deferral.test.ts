/**
 * SLICE-6Z — the three publisher call sites get the same two-window treatment the Studio path does.
 *
 * `typefully.ts`, `tiktok.ts` and `substack.ts` each ask the reuse guard before they create
 * anything. Before this slice all three refused any placement of the slug inside `min_reuse_days`,
 * which merged "this exact post again" with "a different derivative of the same piece". Now:
 *   same row inside min_reuse_days      → still refused, nothing is created
 *   different row inside min_variant_days → spaced, and the post is scheduled past the window
 *
 * Everything below asserts the observable outcome: what time the provider was actually asked for,
 * what the shared slot ledger holds, and whether anything was created at all. No live provider call
 * happens anywhere here: Typefully's fetch is stubbed, TikTok's PostPeer fetch is stubbed, and
 * Substack takes an injected postFn. briefs/ is never read or written; the fixtures live in
 * throwaway directories via CONTENT_AGENTS_TEST_BETS_PATH and CONTENT_AGENTS_TEST_LEDGER.
 */

import { test, describe, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { publishText } from "./typefully.js";
import { publishTikTok } from "./tiktok.js";
import { publishSubstack, type PostFn } from "./substack.js";
import { readQueue } from "./queue.js";
import { readLedger } from "./slots.js";

const ENV_KEYS = [
  "CONTENT_AGENTS_TEST_BETS_PATH", "CONTENT_AGENTS_TEST_LEDGER",
  "TYPEFULLY_API_KEY", "TYPEFULLY_SOCIAL_SET_ID", "CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID",
  "POSTPEER_API_KEY", "POSTPEER_TIKTOK_ACCOUNT_ID", "CONTENT_AGENTS_POSTPEER_ACCOUNT_ID",
  "TIKTOK_SCHEDULE_AT", "TIKTOK_SCHEDULE_LEAD_MIN", "CONTENT_AGENTS_SUBSTACK_ACCOUNT_ID",
];

/** The real gap Muxin hit: one derivative placed, another scheduled an hour later. */
const AN_HOUR_AGO = new Date(Date.now() - 3_600_000).toISOString();
const VARIANT_DAYS = 7; // config/platforms.yaml top-level min_variant_days
const floorMs = Date.parse(AN_HOUR_AGO) + VARIANT_DAYS * 86_400_000;

/** A bets.md Placed row in the exact shape reuse-guard.ts scans for. */
const placed = (slug: string, rowId: string, platform: string, iso: string): string =>
  `- placed ${iso} [${slug}/${rowId}] ${platform} → earlier placement\n`;

describe("SLICE-6Z: the publisher call sites space a different derivative instead of refusing it", () => {
  const saved: Record<string, string | undefined> = {};
  const scratch = mkdtempSync(join(tmpdir(), "publisher-defer-"));
  const dirs: string[] = [scratch];
  const originalFetch = globalThis.fetch;
  const BETS = join(scratch, "bets.md");
  const LEDGER = join(scratch, "publish-schedule.jsonl");

  before(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    process.env.CONTENT_AGENTS_TEST_BETS_PATH = BETS;
    process.env.CONTENT_AGENTS_TEST_LEDGER = LEDGER;
    process.env.TYPEFULLY_API_KEY = "test-key";
    process.env.TYPEFULLY_SOCIAL_SET_ID = "test-set";
    process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID = "human-inference/typefully";
    process.env.POSTPEER_API_KEY = "test-postpeer-key";
    process.env.POSTPEER_TIKTOK_ACCOUNT_ID = "tt-acct-1";
    process.env.CONTENT_AGENTS_POSTPEER_ACCOUNT_ID = "human-inference/postpeer";
    process.env.CONTENT_AGENTS_SUBSTACK_ACCOUNT_ID = "human-inference/substack";
    delete process.env.TIKTOK_SCHEDULE_AT;
  });

  after(() => {
    globalThis.fetch = originalFetch;
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  beforeEach(() => {
    writeFileSync(BETS, "# Placed log\n");
    writeFileSync(LEDGER, "");
  });

  /** One content folder holding ONE approved row of the given shape. */
  function folderWith(row: { id: string; platform: string; format: string; asset: string }): { folder: string; slug: string } {
    const folder = mkdtempSync(join(tmpdir(), "publisher-defer-folder-"));
    dirs.push(folder);
    mkdirSync(join(folder, "derivatives"), { recursive: true });
    mkdirSync(join(folder, "video"), { recursive: true });
    writeFileSync(join(folder, "content-request.json"), JSON.stringify({ origin: "human-inference" }));
    writeFileSync(
      join(folder, "review-queue.md"),
      `| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |\n` +
        `|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|\n` +
        `| ${row.id} | ${row.platform} | ${row.format} | ${row.asset} | 4 | 5 | no | approve | fixture | fixture |\n`
    );
    writeFileSync(join(folder, "derivatives", `${row.id}.md`), "---\ncta: none\n---\nA line Muxin wrote.\n");
    writeFileSync(join(folder, "video", "short.mp4"), "fixture video bytes");
    writeFileSync(join(folder, "video", "title.txt"), "A caption Muxin wrote.");
    return { folder, slug: basename(folder) };
  }

  // ── typefully.ts ────────────────────────────────────────────────────────────────────────────────

  /** Captures every Typefully draft POST, so the requested publish_at is the assertion, not a call
   *  count. Returns the captured payloads. */
  function stubTypefully(): Record<string, unknown>[] {
    const payloads: Record<string, unknown>[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/drafts")) {
        payloads.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
        return new Response(JSON.stringify({ id: `draft-${payloads.length}` }), { status: 200 });
      }
      throw new Error(`unexpected fetch in test: ${url}`);
    }) as typeof fetch;
    return payloads;
  }

  test("typefully: a DIFFERENT bluesky derivative an hour later is scheduled past the variant window", async () => {
    const { folder, slug } = folderWith({ id: "bluesky-1", platform: "bluesky", format: "text", asset: "derivatives/bluesky-1.md" });
    writeFileSync(BETS, `# Placed log\n${placed(slug, "bluesky-2", "bluesky", AN_HOUR_AGO)}`);
    const payloads = stubTypefully();

    const results = await publishText(folder);

    assert.equal(results.length, 1, "the row was scheduled, not refused");
    assert.equal(payloads.length, 1, "exactly one draft was created");
    const publishAt = String(payloads[0].publish_at ?? "");
    assert.ok(publishAt && publishAt !== "next-free-slot", `Typefully was given an explicit time, got ${JSON.stringify(publishAt)}`);
    assert.ok(
      Date.parse(publishAt) >= floorMs,
      `requested ${publishAt} must be at or after lastPlacement + ${VARIANT_DAYS}d (${new Date(floorMs).toISOString()})`
    );
    const ledger = readLedger();
    assert.equal(ledger.length, 1, `one claim in the shared ledger: ${JSON.stringify(ledger)}`);
    assert.equal(ledger[0].time, publishAt, "the unified scheduler picked the time, nothing else did");
  });

  test("typefully: re-placing the SAME bluesky row inside min_reuse_days still creates nothing", async () => {
    const { folder, slug } = folderWith({ id: "bluesky-1", platform: "bluesky", format: "text", asset: "derivatives/bluesky-1.md" });
    writeFileSync(BETS, `# Placed log\n${placed(slug, "bluesky-1", "bluesky", AN_HOUR_AGO)}`);
    const payloads = stubTypefully();

    const results = await publishText(folder);

    assert.deepEqual(results, [], "the identical post is refused");
    assert.deepEqual(payloads, [], "no draft reached Typefully");
    assert.deepEqual(readLedger(), [], "no slot was claimed");
    assert.doesNotMatch(readFileSync(join(folder, "review-queue.md"), "utf8"), /\| published \|/);
  });

  test("typefully: a bluesky placement does not space an x row", async () => {
    const { folder, slug } = folderWith({ id: "x-1", platform: "x", format: "text", asset: "derivatives/x-1.md" });
    writeFileSync(BETS, `# Placed log\n${placed(slug, "bluesky-2", "bluesky", AN_HOUR_AGO)}`);
    const payloads = stubTypefully();

    await publishText(folder);

    assert.equal(payloads.length, 1);
    assert.ok(Date.parse(String(payloads[0].publish_at)) < floorMs, "x took its normal next slot");
  });

  // ── tiktok.ts ───────────────────────────────────────────────────────────────────────────────────

  /** Captures the scheduledFor PostPeer was asked for, without any network call. */
  function stubPostPeer(): { scheduledFor: string[] } {
    const captured = { scheduledFor: [] as string[] };
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/media/upload")) {
        return new Response(JSON.stringify({ data: { uploadUrl: "https://s3.example.com/put", publicUrl: "https://cdn.example.com/v.mp4" } }), { status: 200 });
      }
      if (url.startsWith("https://s3.example.com")) return new Response(null, { status: 200 });
      if (url.endsWith("/posts")) {
        captured.scheduledFor.push(String((JSON.parse(String(init?.body ?? "{}")) as { scheduledFor?: string }).scheduledFor));
        return new Response(JSON.stringify({ postId: "pp-1" }), { status: 200 });
      }
      throw new Error(`unexpected fetch in test: ${url}`);
    }) as typeof fetch;
    return captured;
  }

  test("tiktok: a DIFFERENT derivative an hour later is scheduled past the variant window", async () => {
    const { folder, slug } = folderWith({ id: "tiktok-1", platform: "tiktok", format: "video", asset: "video/short.mp4" });
    writeFileSync(BETS, `# Placed log\n${placed(slug, "tiktok-2", "tiktok", AN_HOUR_AGO)}`);
    const captured = stubPostPeer();

    const results = await publishTikTok(folder);

    assert.equal(results.length, 1, "the row was scheduled, not refused");
    assert.equal(captured.scheduledFor.length, 1);
    assert.ok(
      Date.parse(captured.scheduledFor[0]) >= floorMs,
      `PostPeer was asked for ${captured.scheduledFor[0]}, which must be at or after ${new Date(floorMs).toISOString()}`
    );
  });

  test("tiktok: re-placing the SAME row inside min_reuse_days still creates nothing", async () => {
    const { folder, slug } = folderWith({ id: "tiktok-1", platform: "tiktok", format: "video", asset: "video/short.mp4" });
    writeFileSync(BETS, `# Placed log\n${placed(slug, "tiktok-1", "tiktok", AN_HOUR_AGO)}`);
    const captured = stubPostPeer();

    const results = await publishTikTok(folder);

    assert.deepEqual(results, []);
    assert.deepEqual(captured.scheduledFor, [], "nothing reached PostPeer");
    assert.deepEqual(readLedger(), []);
  });

  // Fail closed: a deferred row must never fall back to the lead-time guess (about an hour out),
  // which lands inside the very window it was spaced for.
  test("tiktok: a manual TIKTOK_SCHEDULE_AT inside the spacing window places nothing", async () => {
    const { folder, slug } = folderWith({ id: "tiktok-1", platform: "tiktok", format: "video", asset: "video/short.mp4" });
    writeFileSync(BETS, `# Placed log\n${placed(slug, "tiktok-2", "tiktok", AN_HOUR_AGO)}`);
    const captured = stubPostPeer();
    process.env.TIKTOK_SCHEDULE_AT = new Date(Date.now() + 2 * 3_600_000).toISOString();
    try {
      const results = await publishTikTok(folder);
      assert.deepEqual(results, [], "an override inside the spacing window is not an acceptable time");
      assert.deepEqual(captured.scheduledFor, [], "nothing reached PostPeer");
    } finally {
      delete process.env.TIKTOK_SCHEDULE_AT;
    }
  });

  // ── substack.ts ─────────────────────────────────────────────────────────────────────────────────

  const shouldNotPost: PostFn = async () => { throw new Error("postFn must not be called in this test"); };

  test("substack: a DIFFERENT derivative an hour later claims a slot past the variant window", async () => {
    const { folder, slug } = folderWith({ id: "substack-1", platform: "substack", format: "text", asset: "derivatives/substack-1.md" });
    writeFileSync(BETS, `# Placed log\n${placed(slug, "substack-2", "substack", AN_HOUR_AGO)}`);

    const results = await publishSubstack(folder, { postFn: shouldNotPost });

    assert.equal(results.length, 1, "phase 1 claimed a slot instead of refusing");
    assert.equal(results[0].posted, false, "phase 1 never posts");
    const ledger = readLedger();
    assert.equal(ledger.length, 1, `one claim in the shared ledger: ${JSON.stringify(ledger)}`);
    assert.ok(
      Date.parse(ledger[0].time) >= floorMs,
      `claimed ${ledger[0].time}, which must be at or after ${new Date(floorMs).toISOString()}`
    );
    assert.equal(results[0].plannedFor, ledger[0].time, "the reported time is the claim, not a second calculation");
  });

  // ── Acceptance item 5, at the publisher call sites (the Postiz path is pinned separately) ───────
  //
  // A deferral the shared scheduler cannot place must refuse, claim nothing, and never reach a
  // provider. Both bluesky and substack cap at posts_per_week 7 on all seven slot days, so the way
  // to exhaust them honestly is to fill the ledger: one claim per PT day across the whole 365-day
  // probe range puts every Mon-Sun week at its cap, which is the real production condition, not a
  // stubbed scheduler.
  function saturate(platform: string): void {
    const rows: string[] = [];
    for (let offset = -10; offset <= 400; offset++) {
      const at = new Date(Date.now() + offset * 86_400_000);
      const day = at.toISOString().slice(0, 10);
      rows.push(JSON.stringify({ platform, day, time: at.toISOString(), asset: `someone-else/${day}`, by: "fixture" }));
    }
    writeFileSync(LEDGER, rows.join("\n") + "\n");
  }

  test("typefully: a deferral with no free slot creates no draft and claims nothing", async () => {
    const { folder, slug } = folderWith({ id: "bluesky-1", platform: "bluesky", format: "text", asset: "derivatives/bluesky-1.md" });
    writeFileSync(BETS, `# Placed log\n${placed(slug, "bluesky-2", "bluesky", AN_HOUR_AGO)}`);
    saturate("bluesky");
    const ledgerBefore = readFileSync(LEDGER);
    const payloads = stubTypefully();

    const results = await publishText(folder);

    assert.deepEqual(results, [], "nothing was scheduled");
    assert.deepEqual(payloads, [], "no draft reached Typefully");
    assert.deepEqual(readFileSync(LEDGER), ledgerBefore, "publish-schedule.jsonl must be byte-identical");
    assert.doesNotMatch(readFileSync(join(folder, "review-queue.md"), "utf8"), /\| published \|/);
  });

  test("substack: a deferral with no free slot posts nothing and claims nothing", async () => {
    const { folder, slug } = folderWith({ id: "substack-1", platform: "substack", format: "text", asset: "derivatives/substack-1.md" });
    writeFileSync(BETS, `# Placed log\n${placed(slug, "substack-2", "substack", AN_HOUR_AGO)}`);
    saturate("substack");
    const ledgerBefore = readFileSync(LEDGER);

    const results = await publishSubstack(folder, { postFn: shouldNotPost });

    assert.deepEqual(results, [], "nothing was claimed and nothing was posted");
    assert.deepEqual(readFileSync(LEDGER), ledgerBefore, "publish-schedule.jsonl must be byte-identical");
    assert.equal(readQueue(folder).rows[0].status, "approve", "the row stays pending for Muxin");
  });

  test("substack: re-placing the SAME row inside min_reuse_days still claims nothing", async () => {
    const { folder, slug } = folderWith({ id: "substack-1", platform: "substack", format: "text", asset: "derivatives/substack-1.md" });
    writeFileSync(BETS, `# Placed log\n${placed(slug, "substack-1", "substack", AN_HOUR_AGO)}`);

    const results = await publishSubstack(folder, { postFn: shouldNotPost });

    assert.deepEqual(results, []);
    assert.deepEqual(readLedger(), []);
    assert.equal(readQueue(folder).rows[0].status, "approve", "the row stays pending for Muxin");
  });
});
