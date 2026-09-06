import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { scheduleApproved, defaultPublishPostiz, type SchedulerDeps } from "./studio-scheduling.js";
import type { QueueRow } from "../publish/queue.js";
import type { DeliveryPolicyDecision } from "../publish/delivery-policy.js";
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
    // Placed to x yesterday; config/platforms.yaml gives x min_reuse_days: 14.
    writeFileSync(process.env.CONTENT_AGENTS_TEST_BETS_PATH!, `# Placed log\n${placed(slug, "x-9", "x", YESTERDAY)}`);
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

    // Authoritative discovery says Postiz cannot take x/text, so this text row routes to Typefully,
    // whose own pre-flight owns the decision. The new gate must not short-circuit it.
    const reached = stubDeps({ fetchPostizRegistry: async () => takes("youtube", ["video"]) });
    const result = await scheduleApproved(folder, textRow(), reached.deps);
    assert.deepEqual(reached.routes, ["typefully-text"], "publishText still runs and still makes its own call");
    assert.equal(result.scheduleError, null, "the pre-flight did not veto a route it does not own");

    // And when that publisher silently skips (its own guard), runPublisher's `done.length === 0`
    // recovery branch is still reached and still explains why — the pre-flight has not made it dead.
    const skipped = stubDeps({
      fetchPostizRegistry: async () => takes("youtube", ["video"]),
      publishText: async () => [],
    });
    const recovered = await scheduleApproved(folder, textRow(), skipped.deps);
    assert.equal(recovered.scheduled, null);
    assert.match(recovered.scheduleError ?? "", /^blocked by reuse guard, last placed to x /);
  });

  test("the recovery branch still explains a publisher that skips for a reason the guard knows nothing about", async () => {
    // Guard allows (empty Placed log), publisher returns [] anyway. The generic wording must survive.
    writeFileSync(process.env.CONTENT_AGENTS_TEST_BETS_PATH!, "# Placed log\n");
    const { deps } = stubDeps({ fetchPostizRegistry: async () => takes("youtube", ["video"]), publishText: async () => [] });
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
