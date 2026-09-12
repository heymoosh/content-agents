import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { scheduleApproved, defaultPublishPostiz, type SchedulerDeps } from "./studio-scheduling.js";
import type { QueueRow } from "../publish/queue.js";
import { resolveDeliveryPolicy, type DeliveryPolicyDecision } from "../publish/delivery-policy.js";
import { PostizRateLimitError, type PostizCapabilityRegistry, type PostizDestination, type PostizMedia, type PostizTransport } from "../publish/postiz.js";

// SLICE-5K — the Postiz path consults the reuse guard BEFORE it creates.
//
// typefully.ts, cards.ts, tiktok.ts, youtube.ts and substack.ts each ask checkReuse before they
// create anything. Postiz did not: the only checkReuse call on this path sat inside runPublisher's
// `done.length === 0` recovery branch, which the Postiz dispatch never reaches. With the guard
// answering "not allowed", Postiz created the post anyway. What kept a duplicate off the wire was
// only setStatus taking a placed row out of `approve`.
//
// Everything below asserts the observable outcome: whether a post was actually created, what the
// slot ledger holds afterwards, what status the queue row kept, and what scheduleError came back.
// Nothing asserts that a function was called with a particular argument.

const ENV_KEYS = ["CONTENT_AGENTS_TEST_BETS_PATH", "CONTENT_AGENTS_TEST_LEDGER", "CONTENT_AGENTS_POSTIZ_ACCOUNT_ID"];

const textRow = (over: Partial<QueueRow> = {}): QueueRow => ({
  id: "x-1", platform: "x", format: "text", asset: "derivatives/x-1.md",
  status: "approve", notes: "", lineIndex: 1, ...over,
});

/** Mirrors the real matrix for a provider-mode Human Inference decision. */
const policyFor = (_folder: string, provider: DeliveryPolicyDecision["provider"]): DeliveryPolicyDecision => ({
  policyVersion: "delivery-policy-v1", origin: "human-inference", brand: "human-inference", provider,
  providerAccountId: `human-inference/${provider}`, mode: "provider", reason: "test",
});

const takes = (destination: PostizDestination, media: PostizMedia[]): PostizCapabilityRegistry => ({
  fetchedAt: "2026-01-01T00:00:00Z",
  capabilities: [{ destination, media, accountId: "acct-1", accountLabel: "Human Inference", localMediaUpload: true }],
});

/** A bets.md Placed row in the exact shape reuse-guard.ts scans for. */
const placed = (slug: string, rowId: string, platform: string, iso: string): string =>
  `- placed ${iso} [${slug}/${rowId}] ${platform} → postiz post pz-0 @ earlier\n`;

/** One day ago: inside every configured reuse window (the shortest is substack's 7 days), and a
 *  fixed value so the refusal string can be asserted whole rather than around its timestamp. */
const YESTERDAY = new Date(Date.now() - 86_400_000).toISOString();

function stubDeps(over: Partial<SchedulerDeps> = {}): { deps: SchedulerDeps; routes: string[] } {
  const routes: string[] = [];
  const deps: SchedulerDeps = {
    publishText: async () => { routes.push("typefully-text"); return [{ ref: "typefully draft text-1" }]; },
    publishCards: async () => { routes.push("typefully-card"); return [{ ref: "typefully draft card-1" }]; },
    publishTikTok: async () => { routes.push("postpeer"); return [{ ref: "postpeer-1" }]; },
    publishShorts: async () => { routes.push("youtube"); return [{ ref: "yt-1" }]; },
    publishSubstack: async () => { routes.push("substack"); return [{ ref: "sub-1" }]; },
    lockOutreachMessage: async () => [],
    resolveDeliveryPolicy: policyFor,
    postizEnv: { POSTIZ_ACCOUNT_ID: "acct-1" },
    publishPostiz: async () => { routes.push("postiz"); return { providerObjectId: "pz-1", status: "scheduled" }; },
    ...over,
  };
  return { deps, routes };
}

describe("the Postiz path refuses a row the reuse guard blocks", () => {
  const saved: Record<string, string | undefined> = {};
  const scratch = mkdtempSync(join(tmpdir(), "postiz-reuse-"));
  const dirs: string[] = [scratch];

  before(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    process.env.CONTENT_AGENTS_TEST_BETS_PATH = join(scratch, "bets.md");
    process.env.CONTENT_AGENTS_TEST_LEDGER = join(scratch, "publish-schedule.jsonl");
    process.env.CONTENT_AGENTS_POSTIZ_ACCOUNT_ID = "human-inference/postiz";
    writeFileSync(process.env.CONTENT_AGENTS_TEST_BETS_PATH, "# Placed log\n");
  });

  after(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  /** Reset the shared bets/ledger fixtures, then create one folder holding one approved text row. */
  function liveFolder(): { folder: string; slug: string } {
    writeFileSync(process.env.CONTENT_AGENTS_TEST_BETS_PATH!, "# Placed log\n");
    writeFileSync(process.env.CONTENT_AGENTS_TEST_LEDGER!, "");
    const folder = mkdtempSync(join(tmpdir(), "postiz-reuse-folder-"));
    dirs.push(folder);
    mkdirSync(join(folder, "derivatives"), { recursive: true });
    writeFileSync(join(folder, "content-request.json"), JSON.stringify({ origin: "human-inference" }));
    writeFileSync(
      join(folder, "review-queue.md"),
      `| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |\n` +
        `|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|\n` +
        `| x-1 | x | text | derivatives/x-1.md | 4 | 5 | no | approve | studio text row | from studio |\n`
    );
    writeFileSync(join(folder, "derivatives", "x-1.md"), "---\ncta: none\n---\nA line Muxin wrote.\n");
    return { folder, slug: basename(folder) };
  }

  /** The REAL defaultPublishPostiz against a transport that would happily create the post. */
  function liveDeps(calls: string[]): SchedulerDeps {
    const transport: PostizTransport = {
      async request(path) {
        calls.push(path);
        if (path === "/api/public/v1/posts") return { postId: "pz-1" };
        throw new Error(`unexpected Postiz path ${path}`);
      },
    };
    return {
      publishText: async () => { calls.push("typefully-text"); return [{ ref: "typefully draft text-1" }]; },
      publishCards: async () => { calls.push("typefully-card"); return [{ ref: "typefully draft card-1" }]; },
      publishTikTok: async () => [], publishShorts: async () => [], publishSubstack: async () => [],
      lockOutreachMessage: async () => [],
      postizEnv: { POSTIZ_ACCOUNT_ID: "acct-1" },
      fetchPostizRegistry: async () => takes("x", ["text"]),
      // The invocation itself is recorded, not inferred from the transport staying quiet: a leak
      // that reached defaultPublishPostiz and died before the create would otherwise look identical
      // to never having been dispatched at all.
      publishPostiz: (f, r, c, p) => { calls.push("publishPostiz"); return defaultPublishPostiz(f, r, c, p, () => transport); },
    };
  }

  // ── The control. Without it every assertion in the next test passes trivially on a fixture that
  // could never have reached Postiz in the first place. ───────────────────────────────────────────
  test("an ALLOWED row still goes through Postiz unchanged: post created, slot held, row published", async () => {
    const { folder } = liveFolder();
    const calls: string[] = [];
    const result = await scheduleApproved(folder, textRow(), liveDeps(calls));

    assert.equal(result.scheduleError, null);
    assert.equal((result.scheduled as { providerObjectId: string }).providerObjectId, "pz-1");
    assert.deepEqual(calls, ["publishPostiz", "/api/public/v1/posts"], "the dispatch ran and the create really reached the transport");
    const { readLedger } = await import("../publish/slots.js");
    const ledger = readLedger();
    assert.equal(ledger.length, 1, `Postiz holds its claimed slot: ${JSON.stringify(ledger)}`);
    assert.equal(ledger[0].by, "postiz");
    assert.equal(ledger[0].platform, "x");
    assert.match(readFileSync(join(folder, "review-queue.md"), "utf8"), /\| published \|/);
    assert.ok(existsSync(join(folder, "publish-log.md")), "a real placement is logged");
  });

  // ── Acceptance: blocked row is not created, claims nothing, and stays pending with the reason ───
  test("a guard-blocked row creates no Postiz post, claims no slot, and keeps its approve status", async () => {
    const { folder, slug } = liveFolder();
    // The SAME row placed to x yesterday; config/platforms.yaml gives x min_reuse_days: 14.
    // SLICE-6Z: the row id has to match the row being scheduled for this to stay a refusal. A
    // DIFFERENT row id is now the variant case, which is spaced rather than refused (covered by
    // its own suite below), so the old "x-9" fixture would have been testing the other window.
    writeFileSync(process.env.CONTENT_AGENTS_TEST_BETS_PATH!, `# Placed log\n${placed(slug, "x-1", "x", YESTERDAY)}`);
    // An UNRELATED reservation already standing in the ledger. Byte-identity against an empty file
    // would only prove nothing was appended to nothing; against this it also proves the refusal path
    // does not disturb calendar space someone else is holding.
    const standingClaim = { platform: "mastodon", day: "2099-01-02", time: "2099-01-02T17:00:00.000Z", asset: "another-folder/mm-1", by: "postiz" };
    writeFileSync(process.env.CONTENT_AGENTS_TEST_LEDGER!, `${JSON.stringify(standingClaim)}\n`);
    const ledgerBefore = readFileSync(process.env.CONTENT_AGENTS_TEST_LEDGER!);

    const calls: string[] = [];
    const result = await scheduleApproved(folder, textRow(), liveDeps(calls));

    assert.equal(result.scheduled, null);
    assert.deepEqual(calls, [], "the Postiz dispatch was never entered, and no backup route ran either");
    // The ledger, unfiltered and byte-for-byte: a claim leaked under any platform, asset or `by`
    // label would change these bytes, where a filtered "no entry for x" view could miss it.
    assert.deepEqual(readFileSync(process.env.CONTENT_AGENTS_TEST_LEDGER!), ledgerBefore, "publish-schedule.jsonl must be untouched");
    const { readLedger } = await import("../publish/slots.js");
    assert.deepEqual(readLedger(), [standingClaim], "no slot consumed, and the standing reservation survived intact");
    // Still pending for Muxin, never marked published, and nothing written to the publish log.
    const queue = readFileSync(join(folder, "review-queue.md"), "utf8");
    assert.match(queue, /\| approve \|/);
    assert.doesNotMatch(queue, /\| published \|/);
    assert.ok(!existsSync(join(folder, "publish-log.md")));
    // The WHOLE string, timestamp included — the same message runPublisher's recovery branch emits
    // and the same shape reconcile.ts parses back out of the row's notes.
    assert.equal(result.scheduleError, `blocked by reuse guard, last placed to x ${YESTERDAY} (min_reuse_days: 14)`);
  });

  // ── Acceptance: a guard block is NOT SLICE-5J's "Postiz created nothing, try Typefully" ─────────
  test("a guard-blocked media row does not take SLICE-5J's Typefully backup route", async () => {
    // A linkedin image row is exactly the shape 5J made fall back. A refusal means do not place this
    // row ANYWHERE; falling back here would defeat the guard and double-post through the back door.
    const slug = "guard-blocked-media";
    writeFileSync(process.env.CONTENT_AGENTS_TEST_BETS_PATH!, `# Placed log\n${placed(slug, "cm-1", "linkedin", YESTERDAY)}`);
    const row = textRow({ id: "cm-1", platform: "linkedin", format: "image", asset: "configured-media/cm-1/card.png" });

    // Postiz configured AND able to take the row, and its create is wired to raise the ONE error
    // 5J accepts as "provably created nothing" — the rate-limit rejection. So if the pre-flight ever
    // moves after the create, or inside that catch, this row lands on Typefully instead of being
    // refused. The gate runs first, so Postiz is never contacted and the backup never opens.
    const capable = stubDeps({ fetchPostizRegistry: async () => takes("linkedin", ["image"]) });
    // Records its own invocation BEFORE throwing, so `routes` proves Postiz was never entered
    // directly rather than by inference from the backup route staying quiet.
    capable.deps.publishPostiz = async () => { capable.routes.push("postiz"); throw new PostizRateLimitError("2099-01-01T00:00:00Z"); };

    const viaPostiz = await scheduleApproved(`/tmp/${slug}`, row, capable.deps);
    assert.deepEqual(capable.routes, [], "neither Postiz nor the Typefully backup may run");
    assert.equal(viaPostiz.scheduled, null);
    assert.equal(viaPostiz.scheduleError, `blocked by reuse guard, last placed to linkedin ${YESTERDAY} (min_reuse_days: 60)`);
  });

  // ── Acceptance: the guard key matches the row kind ──────────────────────────────────────────────
  // Reuse is keyed per DESTINATION platform. Each case pins the real key by blocking on it, and pins
  // it from the other side with a decoy placement under a neighbouring platform that must NOT block.
  // Drifting reuseGuardPlatform (e.g. returning the "quote-card" bucket for a card row, or
  // row.platform for a video row) fails these: the block case stops refusing and the row reaches
  // Postiz.
  const keyCases: { name: string; row: QueueRow; key: string; decoy: string; registry: PostizCapabilityRegistry; window: number }[] = [
    { name: "a text row keys on its own platform", row: textRow(), key: "x", decoy: "linkedin", registry: takes("x", ["text"]), window: 14 },
    { name: "a card row keys on its card TARGET, not the quote-card bucket", key: "x", decoy: "quote-card", window: 14,
      row: textRow({ id: "quote-card-1-x", platform: "quote-card:x", format: "image", asset: "images/quote-card-1.png" }), registry: takes("x", ["image"]) },
    { name: "a configured-media row keys on its own platform", key: "linkedin", decoy: "x", window: 60,
      row: textRow({ id: "cm-1", platform: "linkedin", format: "image", asset: "configured-media/cm-1/card.png" }), registry: takes("linkedin", ["image"]) },
    { name: "a tiktok row keys on tiktok", key: "tiktok", decoy: "youtube", window: 14,
      row: textRow({ id: "tt-1", platform: "tiktok", format: "video", asset: "video/short.mp4" }), registry: takes("tiktok", ["video"]) },
    // Deliberately a short whose row.platform is NOT youtube: publishShorts keys on the fixed
    // "youtube", so `return row.platform` here would be a drift a platform:"youtube" fixture could
    // never see. The decoy is that same row.platform.
    { name: "a video row keys on youtube, not the row's own platform", key: "youtube", decoy: "x", window: 30,
      row: textRow({ id: "yt-1", platform: "x", format: "short", asset: "video/short.mp4" }), registry: takes("x", ["video"]) },
    { name: "a substack row keys on substack", key: "substack", decoy: "x", window: 7,
      row: textRow({ id: "sub-1", platform: "substack", format: "text", asset: "derivatives/sub-1.md" }), registry: takes("substack", ["text"]) },
  ];

  for (const c of keyCases) {
    test(`the guard key matches the row kind — ${c.name}`, async () => {
      const slug = `key-${c.key}-${c.row.id}`;
      const folder = `/tmp/${slug}`;

      writeFileSync(process.env.CONTENT_AGENTS_TEST_BETS_PATH!, `# Placed log\n${placed(slug, c.row.id, c.key, YESTERDAY)}`);
      const blocked = stubDeps({ fetchPostizRegistry: async () => c.registry });
      const refused = await scheduleApproved(folder, c.row, blocked.deps);
      assert.deepEqual(blocked.routes, [], `a placement under ${c.key} must stop this row`);
      assert.equal(refused.scheduleError, `blocked by reuse guard, last placed to ${c.key} ${YESTERDAY} (min_reuse_days: ${c.window})`);

      writeFileSync(process.env.CONTENT_AGENTS_TEST_BETS_PATH!, `# Placed log\n${placed(slug, c.row.id, c.decoy, YESTERDAY)}`);
      const allowed = stubDeps({ fetchPostizRegistry: async () => c.registry });
      const shipped = await scheduleApproved(folder, c.row, allowed.deps);
      assert.deepEqual(allowed.routes, ["postiz"], `a placement under ${c.decoy} must NOT stop this row`);
      assert.equal(shipped.scheduleError, null);
    });
  }

  // ── Acceptance: the five direct publishers are unaffected, and the recovery branch still works ──
  test("a legacy route is not gated by the Postiz pre-flight: its own publisher still runs and still decides", async () => {
    const slug = "legacy-route-untouched";
    const folder = `/tmp/${slug}`;
    writeFileSync(process.env.CONTENT_AGENTS_TEST_BETS_PATH!, `# Placed log\n${placed(slug, "x-1", "x", YESTERDAY)}`);

    // SLICE-7B moved the vehicle, not the subject. A text row no longer falls back to Typefully
    // when discovery lacks the channel, so the legacy route is reached the way the packet keeps
    // working: no Postiz configured at all. `selectConfiguredProvider` returns the identical
    // `{ provider: "typefully" }`, so everything downstream of it is the same code path.
    // Typefully's own pre-flight still owns the decision, and the new gate must not short-circuit it.
    const reached = stubDeps({ postizEnv: {} });
    const result = await scheduleApproved(folder, textRow(), reached.deps);
    assert.deepEqual(reached.routes, ["typefully-text"], "publishText still runs and still makes its own call");
    assert.equal(result.scheduleError, null, "the pre-flight did not veto a route it does not own");

    // And when that publisher silently skips (its own guard), runPublisher's `done.length === 0`
    // recovery branch is still reached and still explains why — the pre-flight has not made it dead.
    const skipped = stubDeps({
      postizEnv: {},
      publishText: async () => [],
    });
    const recovered = await scheduleApproved(folder, textRow(), skipped.deps);
    assert.equal(recovered.scheduled, null);
    assert.match(recovered.scheduleError ?? "", /^blocked by reuse guard, last placed to x /);
  });

  test("the recovery branch still explains a publisher that skips for a reason the guard knows nothing about", async () => {
    // Guard allows (empty Placed log), publisher returns [] anyway. The generic wording must survive.
    writeFileSync(process.env.CONTENT_AGENTS_TEST_BETS_PATH!, "# Placed log\n");
    const { deps } = stubDeps({ postizEnv: {}, publishText: async () => [] });
    const result = await scheduleApproved("/tmp/no-placements", textRow(), deps);
    assert.equal(result.scheduled, null);
    assert.equal(result.scheduleError, "not scheduled: blocked by the reuse guard (check the server log for the reason)");
  });

  // ── An outreach-lock row has no guard key and must be untouched by any of this ──────────────────
  test("an outreach-message row is never gated: approve still means lock, not schedule", async () => {
    writeFileSync(process.env.CONTENT_AGENTS_TEST_BETS_PATH!, `# Placed log\n${placed("outreach-slug", "om-1", "email", YESTERDAY)}`);
    const locked: string[] = [];
    const { deps } = stubDeps({ lockOutreachMessage: async () => { locked.push("lock"); return [{ ref: "locked" }]; } });
    const result = await scheduleApproved("/tmp/outreach-slug", textRow({ id: "om-1", platform: "email", format: "outreach-message", asset: "outreach/om-1.md" }), deps);
    assert.deepEqual(locked, ["lock"]);
    assert.equal(result.scheduleError, null);
  });
});

// ── SLICE-6Z: the guard spaces a DIFFERENT derivative instead of refusing it ─────────────────────
//
// Two derivatives of one essay are two different posts. The guard used to match `[slug/<any row>]`,
// so placing bluesky-2 locked out bluesky-1 for bluesky's full 21-day min_reuse_days window. Now the
// same row inside min_reuse_days still refuses, while a different row inside min_variant_days is
// handed to the SAME unified scheduler with an earliest-allowed floor and comes back scheduled.
//
// Everything below asserts the observable outcome: whether a post was created, what time the shared
// ledger actually holds, and what came back as scheduled/scheduleError.
describe("SLICE-6Z: a different derivative of the same piece is spaced, not refused", () => {
  const saved: Record<string, string | undefined> = {};
  const scratch = mkdtempSync(join(tmpdir(), "variant-defer-"));
  const dirs: string[] = [scratch];

  /** One hour ago, the real gap Muxin hit: bluesky-2 placed, bluesky-1 scheduled an hour later. */
  const AN_HOUR_AGO = new Date(Date.now() - 3_600_000).toISOString();
  const VARIANT_DAYS = 7; // config/platforms.yaml top-level min_variant_days
  const floorMs = (iso: string): number => Date.parse(iso) + VARIANT_DAYS * 86_400_000;

  before(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    process.env.CONTENT_AGENTS_TEST_BETS_PATH = join(scratch, "bets.md");
    process.env.CONTENT_AGENTS_TEST_LEDGER = join(scratch, "publish-schedule.jsonl");
    process.env.CONTENT_AGENTS_POSTIZ_ACCOUNT_ID = "human-inference/postiz";
    writeFileSync(process.env.CONTENT_AGENTS_TEST_BETS_PATH, "# Placed log\n");
    writeFileSync(process.env.CONTENT_AGENTS_TEST_LEDGER, "");
  });

  after(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  /** A real content folder with ONE approved bluesky row, plus an isolated empty ledger. */
  function blueskyFolder(rowId: string): { folder: string; slug: string } {
    const folder = mkdtempSync(join(tmpdir(), "variant-defer-folder-"));
    dirs.push(folder);
    mkdirSync(join(folder, "derivatives"), { recursive: true });
    writeFileSync(join(folder, "content-request.json"), JSON.stringify({ origin: "human-inference" }));
    writeFileSync(
      join(folder, "review-queue.md"),
      `| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |\n` +
        `|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|\n` +
        `| ${rowId} | bluesky | text | derivatives/${rowId}.md | 4 | 5 | no | approve | studio text row | from studio |\n`
    );
    writeFileSync(join(folder, "derivatives", `${rowId}.md`), "---\ncta: none\n---\nA line Muxin wrote.\n");
    writeFileSync(process.env.CONTENT_AGENTS_TEST_LEDGER!, "");
    return { folder, slug: basename(folder) };
  }

  /** The REAL defaultPublishPostiz, with the spacing floor forwarded (production passes it too). */
  function liveBlueskyDeps(calls: string[]): SchedulerDeps {
    const transport: PostizTransport = {
      async request(path) {
        calls.push(path);
        if (path === "/api/public/v1/posts") return { postId: "pz-defer" };
        throw new Error(`unexpected Postiz path ${path}`);
      },
    };
    return {
      publishText: async () => { calls.push("typefully-text"); return [{ ref: "typefully draft text-1" }]; },
      publishCards: async () => { calls.push("typefully-card"); return [{ ref: "typefully draft card-1" }]; },
      publishTikTok: async () => [], publishShorts: async () => [], publishSubstack: async () => [],
      lockOutreachMessage: async () => [],
      postizEnv: { POSTIZ_ACCOUNT_ID: "acct-1" },
      fetchPostizRegistry: async () => takes("bluesky", ["text"]),
      publishPostiz: (f, r, c, p, e) => { calls.push("publishPostiz"); return defaultPublishPostiz(f, r, c, p, () => transport, e); },
    };
  }

  test("the case that prompted this slice: bluesky-1 an hour after bluesky-2 is SCHEDULED, past the variant window", async () => {
    const { folder, slug } = blueskyFolder("bluesky-1");
    writeFileSync(process.env.CONTENT_AGENTS_TEST_BETS_PATH!, `# Placed log\n${placed(slug, "bluesky-2", "bluesky", AN_HOUR_AGO)}`);

    const calls: string[] = [];
    const result = await scheduleApproved(folder, textRow({ id: "bluesky-1", platform: "bluesky", asset: "derivatives/bluesky-1.md" }), liveBlueskyDeps(calls));

    assert.equal(result.scheduleError, null, "no refusal, and no red banner for Muxin");
    const scheduled = result.scheduled as { providerObjectId: string; plannedFor: string; spacingNote?: string };
    assert.equal(scheduled.providerObjectId, "pz-defer", "the post really was created");
    assert.deepEqual(calls, ["publishPostiz", "/api/public/v1/posts"]);
    assert.ok(
      Date.parse(scheduled.plannedFor) >= floorMs(AN_HOUR_AGO),
      `scheduled ${scheduled.plannedFor} must be at or after lastPlacement + ${VARIANT_DAYS}d (${new Date(floorMs(AN_HOUR_AGO)).toISOString()})`
    );
    assert.match(scheduled.spacingNote ?? "", /^Spaced from an earlier post from this piece on bluesky\. First free slot past the spacing window is /);
    assert.doesNotMatch(scheduled.spacingNote ?? "", /—/, "config/voice.yaml bans em dashes");

    // The date came from the shared ledger's own claim, not a second calculation.
    const { readLedger } = await import("../publish/slots.js");
    const ledger = readLedger();
    assert.equal(ledger.length, 1, `exactly one claim: ${JSON.stringify(ledger)}`);
    assert.equal(ledger[0].platform, "bluesky");
    assert.equal(ledger[0].time, scheduled.plannedFor, "the scheduler picked the time, nothing else did");
    assert.match(readFileSync(join(folder, "review-queue.md"), "utf8"), /\| published \|/);
  });

  test("the SAME row an hour after its own placement still refuses, with today's message and window", async () => {
    const { folder, slug } = blueskyFolder("bluesky-1");
    writeFileSync(process.env.CONTENT_AGENTS_TEST_BETS_PATH!, `# Placed log\n${placed(slug, "bluesky-1", "bluesky", AN_HOUR_AGO)}`);
    const ledgerBefore = readFileSync(process.env.CONTENT_AGENTS_TEST_LEDGER!);

    const calls: string[] = [];
    const result = await scheduleApproved(folder, textRow({ id: "bluesky-1", platform: "bluesky", asset: "derivatives/bluesky-1.md" }), liveBlueskyDeps(calls));

    assert.equal(result.scheduled, null);
    assert.deepEqual(calls, [], "nothing was created, and no backup route ran");
    assert.equal(result.scheduleError, `blocked by reuse guard, last placed to bluesky ${AN_HOUR_AGO} (min_reuse_days: 21)`);
    assert.deepEqual(readFileSync(process.env.CONTENT_AGENTS_TEST_LEDGER!), ledgerBefore, "no slot consumed");
    assert.doesNotMatch(readFileSync(join(folder, "review-queue.md"), "utf8"), /\| published \|/);
  });

  test("platforms stay independent: a bluesky placement does not defer or block an x row", async () => {
    const { folder, slug } = blueskyFolder("x-1");
    writeFileSync(
      join(folder, "review-queue.md"),
      `| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |\n` +
        `|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|\n` +
        `| x-1 | x | text | derivatives/x-1.md | 4 | 5 | no | approve | studio text row | from studio |\n`
    );
    writeFileSync(process.env.CONTENT_AGENTS_TEST_BETS_PATH!, `# Placed log\n${placed(slug, "bluesky-2", "bluesky", AN_HOUR_AGO)}`);

    const calls: string[] = [];
    const deps = liveBlueskyDeps(calls);
    deps.fetchPostizRegistry = async () => takes("x", ["text"]);
    const result = await scheduleApproved(folder, textRow(), deps);

    assert.equal(result.scheduleError, null);
    const scheduled = result.scheduled as { plannedFor: string; spacingNote?: string };
    assert.equal(scheduled.spacingNote, undefined, "an x row is not spaced by a bluesky placement");
    assert.ok(Date.parse(scheduled.plannedFor) < floorMs(AN_HOUR_AGO), "x took its normal next slot, not a spaced one");
  });

  test("a slug with no prior placement schedules immediately, unchanged", async () => {
    const { folder } = blueskyFolder("bluesky-1");
    writeFileSync(process.env.CONTENT_AGENTS_TEST_BETS_PATH!, "# Placed log\n");

    const calls: string[] = [];
    const result = await scheduleApproved(folder, textRow({ id: "bluesky-1", platform: "bluesky", asset: "derivatives/bluesky-1.md" }), liveBlueskyDeps(calls));

    assert.equal(result.scheduleError, null);
    const scheduled = result.scheduled as { plannedFor: string; spacingNote?: string };
    assert.equal(scheduled.spacingNote, undefined);
    assert.ok(Date.parse(scheduled.plannedFor) < floorMs(AN_HOUR_AGO), "no spacing floor was applied");
  });

  // Acceptance item 5: a deferral that cannot find a slot REFUSES and says so. `facebook` is a real
  // Postiz destination with no cadence entry in config/platforms.yaml, so the shared scheduler
  // answers "next-free-slot" — which hands the timing back to the provider and would defeat the
  // spacing. Fail closed: no slot means say it could not be placed.
  test("a deferral the scheduler cannot place refuses, and never reports a schedule it did not achieve", async () => {
    const folder = mkdtempSync(join(tmpdir(), "variant-defer-noslot-"));
    dirs.push(folder);
    mkdirSync(join(folder, "configured-media", "cm-1"), { recursive: true });
    writeFileSync(join(folder, "content-request.json"), JSON.stringify({ origin: "human-inference" }));
    writeFileSync(process.env.CONTENT_AGENTS_TEST_LEDGER!, "");
    const ledgerBefore = readFileSync(process.env.CONTENT_AGENTS_TEST_LEDGER!);

    const row = textRow({ id: "cm-1", platform: "facebook", format: "image", asset: "configured-media/cm-1/card.png" });
    const policy = resolveDeliveryPolicy(folder, "postiz");
    const capability = takes("facebook", ["image"]).capabilities[0];
    const earliestAt = new Date(floorMs(AN_HOUR_AGO)).toISOString();

    await assert.rejects(
      () => defaultPublishPostiz(folder, row, capability, policy, () => { throw new Error("the transport must never be reached"); }, earliestAt),
      (error: Error) => {
        assert.match(error.message, /^could not place cm-1, no free facebook slot on or after /);
        assert.doesNotMatch(error.message, /—/, "config/voice.yaml bans em dashes");
        return true;
      }
    );
    assert.deepEqual(readFileSync(process.env.CONTENT_AGENTS_TEST_LEDGER!), ledgerBefore, "no slot was claimed for a post that was not placed");
  });
});

// ── SLICE-7A: which side of dispatch a refusal came from ─────────────────────────────────────────
//
// Both sides emit the SAME wording. `reuseGuardVerdict` builds the same-row refusal string for the
// Postiz pre-flight, and `reuseGuardBlock` rebuilds it in the recovery branches after a publisher
// has already run. Message text therefore cannot tell them apart, which is the whole reason the
// outcome carries a typed discriminant instead.
//
//   "no-provider-request" — pre-flight only. Provably ahead of every create and every slot claim.
//   "publisher-declined"  — the publisher already ran. Nothing here proves it created nothing.
//
// Getting this backwards is the dangerous direction: it would let a human clear the dispatch fence
// on a row whose publisher may already hold a provider object, and re-send it.
describe("SLICE-7A: a refusal says which side of dispatch it came from", () => {
  const saved: Record<string, string | undefined> = {};
  const scratch = mkdtempSync(join(tmpdir(), "refusal-side-"));
  const dirs: string[] = [scratch];

  before(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    process.env.CONTENT_AGENTS_TEST_BETS_PATH = join(scratch, "bets.md");
    process.env.CONTENT_AGENTS_TEST_LEDGER = join(scratch, "publish-schedule.jsonl");
    process.env.CONTENT_AGENTS_POSTIZ_ACCOUNT_ID = "human-inference/postiz";
    writeFileSync(process.env.CONTENT_AGENTS_TEST_BETS_PATH, "# Placed log\n");
    writeFileSync(process.env.CONTENT_AGENTS_TEST_LEDGER, "");
  });

  after(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  test("the pre-flight same-row refusal is no-provider-request, and nothing ran to contradict it", async () => {
    const slug = "side-preflight-same-row";
    writeFileSync(process.env.CONTENT_AGENTS_TEST_BETS_PATH!, `# Placed log\n${placed(slug, "x-1", "x", YESTERDAY)}`);
    writeFileSync(process.env.CONTENT_AGENTS_TEST_LEDGER!, "");
    const ledgerBefore = readFileSync(process.env.CONTENT_AGENTS_TEST_LEDGER!);

    const { deps, routes } = stubDeps({ fetchPostizRegistry: async () => takes("x", ["text"]) });
    const result = await scheduleApproved(`/tmp/${slug}`, textRow(), deps);

    assert.equal(result.scheduleError, `blocked by reuse guard, last placed to x ${YESTERDAY} (min_reuse_days: 14)`);
    assert.equal(result.refusal, "no-provider-request");
    assert.deepEqual(routes, [], "the claim is true: no publisher ran");
    assert.deepEqual(readFileSync(process.env.CONTENT_AGENTS_TEST_LEDGER!), ledgerBefore, "and no slot was claimed");
  });

  test("the pre-flight no-brand refusal is no-provider-request too", async () => {
    writeFileSync(process.env.CONTENT_AGENTS_TEST_BETS_PATH!, "# Placed log\n");
    const brandless = (_folder: string, provider: DeliveryPolicyDecision["provider"]): DeliveryPolicyDecision => ({
      ...policyFor(_folder, provider), brand: null,
    });
    const { deps, routes } = stubDeps({ fetchPostizRegistry: async () => takes("x", ["text"]), resolveDeliveryPolicy: brandless });
    const result = await scheduleApproved("/tmp/side-preflight-no-brand", textRow(), deps);

    assert.equal(result.scheduleError, "not scheduled: the delivery policy resolved no brand, so the reuse guard has no Placed log to check");
    assert.equal(result.refusal, "no-provider-request");
    assert.deepEqual(routes, []);
  });

  // ── The P0 this discriminant exists for. Same wording as the pre-flight, opposite provenance. ──
  test("the recovery branch emits the SAME same-row wording but is publisher-declined", async () => {
    const slug = "side-recovery-same-row";
    writeFileSync(process.env.CONTENT_AGENTS_TEST_BETS_PATH!, `# Placed log\n${placed(slug, "x-1", "x", YESTERDAY)}`);
    // No Postiz configured, so this row routes to Typefully (SLICE-7B: a text row no longer falls
    // back to Typefully from an authoritative registry that lacks the channel, and this test is
    // about recovery provenance, not about which route got here). Its publisher runs and returns [],
    // and the recovery branch rebuilds the identical refusal string.
    const ran: string[] = [];
    const { deps } = stubDeps({
      postizEnv: {},
      publishText: async () => { ran.push("typefully-text"); return []; },
    });
    const result = await scheduleApproved(`/tmp/${slug}`, textRow(), deps);

    assert.deepEqual(ran, ["typefully-text"], "the publisher really was invoked");
    assert.equal(result.scheduleError, `blocked by reuse guard, last placed to x ${YESTERDAY} (min_reuse_days: 14)`,
      "byte-identical to the pre-flight wording, which is why text can never decide this");
    assert.equal(result.refusal, "publisher-declined", "an empty result is not proof that nothing was created");
  });

  test("the recovery branch's unspecified fallback is publisher-declined as well", async () => {
    writeFileSync(process.env.CONTENT_AGENTS_TEST_BETS_PATH!, "# Placed log\n");
    const { deps } = stubDeps({ postizEnv: {}, publishText: async () => [] });
    const result = await scheduleApproved("/tmp/side-recovery-unspecified", textRow(), deps);

    assert.equal(result.scheduleError, "not scheduled: blocked by the reuse guard (check the server log for the reason)");
    assert.equal(result.refusal, "publisher-declined");
  });

  test("the recovery branch's variant-spacing wording is publisher-declined", async () => {
    const slug = "side-recovery-variant";
    const anHourAgo = new Date(Date.now() - 3_600_000).toISOString();
    // A DIFFERENT row of the same slug placed an hour ago: the guard defers rather than refuses, and
    // only the recovery branch turns a deferral into a "not scheduled" message.
    writeFileSync(process.env.CONTENT_AGENTS_TEST_BETS_PATH!, `# Placed log\n${placed(slug, "x-2", "x", anHourAgo)}`);
    const { deps } = stubDeps({ postizEnv: {}, publishText: async () => [] });
    const result = await scheduleApproved(`/tmp/${slug}`, textRow(), deps);

    assert.match(result.scheduleError ?? "", /^not scheduled: another post from this piece already went to x /);
    assert.equal(result.refusal, "publisher-declined");
  });

  test("the unscheduled-draft route's recovery branch is publisher-declined too", async () => {
    const slug = "side-unscheduled-draft";
    writeFileSync(process.env.CONTENT_AGENTS_TEST_BETS_PATH!, `# Placed log\n${placed(slug, "x-1", "x", YESTERDAY)}`);
    const ran: string[] = [];
    const { deps } = stubDeps({ publishText: async () => { ran.push("typefully-text"); return []; } });
    const result = await scheduleApproved(`/tmp/${slug}`, textRow(), deps, undefined, "unscheduled-draft");

    assert.deepEqual(ran, ["typefully-text"], "publishText already ran on this route as well");
    assert.match(result.scheduleError ?? "", /^blocked by reuse guard, last placed to x /);
    assert.equal(result.refusal, "publisher-declined", "the second post-publisher site must not be left unmarked");
  });

  test("fails closed: a Postiz create failure carries no discriminant at all", async () => {
    writeFileSync(process.env.CONTENT_AGENTS_TEST_BETS_PATH!, "# Placed log\n");
    const { deps, routes } = stubDeps({
      fetchPostizRegistry: async () => takes("x", ["text"]),
      publishPostiz: async () => { routes.push("postiz"); throw new Error("socket hang up after the request left"); },
    });
    const result = await scheduleApproved("/tmp/side-create-failed", textRow(), deps);

    assert.deepEqual(routes, ["postiz"], "Postiz really was contacted");
    assert.equal(result.scheduleError, "socket hang up after the request left");
    assert.equal(result.refusal, undefined, "an ambiguous create failure is not a guard refusal of either kind");
  });

  test("a successful schedule, and a deferred derivative, carry no discriminant", async () => {
    writeFileSync(process.env.CONTENT_AGENTS_TEST_BETS_PATH!, "# Placed log\n");
    const clean = stubDeps({ fetchPostizRegistry: async () => takes("x", ["text"]) });
    const shipped = await scheduleApproved("/tmp/side-success", textRow(), clean.deps);
    assert.equal(shipped.scheduleError, null);
    assert.equal(shipped.refusal, undefined);

    const slug = "side-deferred";
    const anHourAgo = new Date(Date.now() - 3_600_000).toISOString();
    writeFileSync(process.env.CONTENT_AGENTS_TEST_BETS_PATH!, `# Placed log\n${placed(slug, "x-2", "x", anHourAgo)}`);
    const spaced = stubDeps({ fetchPostizRegistry: async () => takes("x", ["text"]) });
    const deferred = await scheduleApproved(`/tmp/${slug}`, textRow(), spaced.deps);
    assert.equal(deferred.scheduleError, null, "deferral is a date, not a refusal");
    assert.equal(deferred.refusal, undefined);
    assert.deepEqual(spaced.routes, ["postiz"]);
  });
});
