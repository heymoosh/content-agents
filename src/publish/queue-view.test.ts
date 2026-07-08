/**
 * Unit tests for src/publish/queue-view.ts — syncLedger(), the --sync action that both prunes
 * past-dated ledger claims and releases orphaned FUTURE claims (a run claimed a slot then aborted
 * before the post actually happened, so reconcile() reports it "claimed but not live" forever
 * unless something releases it).
 *
 * Strategy: point CONTENT_AGENTS_TEST_LEDGER (read lazily by slots.ts's ledgerPath()) at an
 * isolated file instead of the real data/publish-schedule.jsonl — slots.test.ts already exercises
 * the real path with its own save/restore dance, and running both suites against the SAME real
 * file raced under Node's default concurrent-test-file execution (one file's beforeEach wiping the
 * other's fixture mid-assertion). An isolated file removes the collision instead of just narrowing it.
 */

import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, existsSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readLedger, type Claim } from "./slots.js";
import { syncLedger, reconcile, type QueueItem } from "./queue-view.js";
import { fetchScheduledDrafts } from "./typefully.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TEST_LEDGER = join(repoRoot, "data", ".test-publish-schedule.queue-view.jsonl");

function claim(overrides: Partial<Claim> = {}): Claim {
  return {
    platform: "x",
    day: "2026-08-01",
    time: "2026-08-01T17:00:00.000Z",
    asset: "test-fixture/x",
    by: "test",
    ...overrides,
  };
}

function seedLedger(claims: Claim[]): void {
  writeFileSync(TEST_LEDGER, claims.length ? claims.map((c) => JSON.stringify(c)).join("\n") + "\n" : "");
}

const NOW = new Date("2026-07-08T12:00:00.000Z").getTime();
const ALL_OK = { typefully: true, postpeer: true, youtube: true };

describe("queue-view.ts: syncLedger", () => {
  before(() => {
    process.env.CONTENT_AGENTS_TEST_LEDGER = TEST_LEDGER;
  });

  after(() => {
    delete process.env.CONTENT_AGENTS_TEST_LEDGER;
    if (existsSync(TEST_LEDGER)) unlinkSync(TEST_LEDGER);
  });

  beforeEach(() => {
    seedLedger([]);
  });

  test("releases an orphaned future claim with no live post behind it", () => {
    const orphan = claim({ asset: "aborted-run/x" });
    seedLedger([orphan]);

    const before = syncLedger([], ALL_OK, NOW);
    assert.equal(before.releasedOrphans.length, 1);
    assert.deepEqual(before.releasedOrphans[0], orphan);
    assert.deepEqual(readLedger(), [], "orphaned claim must be gone from the ledger after sync");
  });

  test("does not release a future claim that IS matched by a live post", () => {
    const matched = claim({ asset: "real-post/x" });
    seedLedger([matched]);
    const live: QueueItem[] = [
      { whenIso: matched.time, platform: "x", media: "text", title: "real post", source: "typefully" },
    ];

    const result = syncLedger(live, ALL_OK, NOW);
    assert.equal(result.releasedOrphans.length, 0);
    assert.deepEqual(readLedger(), [matched], "a claim backed by a live post must survive sync");
  });

  test("does not release a claim when a needed source was unreachable (uncheckable, not drift)", () => {
    const claimUnreachable = claim({ platform: "tiktok", day: "2026-08-02", time: "2026-08-02T17:00:00.000Z", asset: "maybe-live/tiktok" });
    seedLedger([claimUnreachable]);
    const okWithPostpeerDown = { ...ALL_OK, postpeer: false };

    const result = syncLedger([], okWithPostpeerDown, NOW);
    assert.equal(result.releasedOrphans.length, 0);
    assert.deepEqual(readLedger(), [claimUnreachable], "an uncheckable claim must not be released");
  });

  test("prunes past claims and reports counts, independent of orphan release", () => {
    const past = claim({ asset: "past", time: new Date(NOW - 86_400_000).toISOString(), day: "2026-07-07" });
    const futureLive = claim({ asset: "future-live", time: new Date(NOW + 86_400_000).toISOString(), day: "2026-07-09" });
    seedLedger([past, futureLive]);
    const live: QueueItem[] = [
      { whenIso: futureLive.time, platform: "x", media: "text", title: "t", source: "typefully" },
    ];

    const result = syncLedger(live, ALL_OK, NOW);
    assert.equal(result.prunedPast, 1);
    assert.equal(result.keptFuture, 1);
    assert.equal(result.releasedOrphans.length, 0);
    assert.deepEqual(readLedger(), [futureLive]);
  });

  test("no-op result on an empty ledger", () => {
    const result = syncLedger([], ALL_OK, NOW);
    assert.deepEqual(result, { prunedPast: 0, keptFuture: 0, releasedOrphans: [] });
  });
});

// Regression for card a112f4ac: reconcile() used to key live posts / ledger claims by plain Sets of
// `${platform}|${day}`, so it could only tell presence from absence, never a count. Once a platform
// has >1 slot/day (max_slots_per_day, card c58fa530), an orphaned extra claim (or an extra unclaimed
// live post) on a multi-slot day silently looked "matched, fine" on both sides.
describe("queue-view.ts: reconcile() counts claims per platform/day instead of just checking presence", () => {
  test("2 ledger claims + 1 live post on the same platform/day: the 1 excess claim is claimedNotLive", () => {
    const c1 = claim({ asset: "slot-1/x" });
    const c2 = claim({ asset: "slot-2/x" });
    const live: QueueItem[] = [
      { whenIso: c1.time, platform: "x", media: "text", title: "the one live post", source: "typefully" },
    ];

    const result = reconcile(live, [c1, c2], ALL_OK);
    assert.equal(result.claimedNotLive.length, 1, "exactly one of the two same-day claims is unmatched");
    assert.ok(
      [c1.asset, c2.asset].includes(result.claimedNotLive[0].asset),
      "the flagged claim must be one of the two same-day claims"
    );
    assert.equal(result.liveNotClaimed.length, 0);
  });

  test("1 ledger claim + 2 live posts on the same platform/day: the 1 excess live post is liveNotClaimed", () => {
    const c1 = claim({ asset: "slot-1/x" });
    const live: QueueItem[] = [
      { whenIso: c1.time, platform: "x", media: "text", title: "live post A", source: "typefully" },
      { whenIso: c1.time, platform: "x", media: "text", title: "live post B", source: "typefully" },
    ];

    const result = reconcile(live, [c1], ALL_OK);
    assert.equal(result.claimedNotLive.length, 0);
    assert.equal(result.liveNotClaimed.length, 1, "exactly one of the two same-day live posts is unclaimed");
    assert.ok(
      ["live post A", "live post B"].includes(result.liveNotClaimed[0].title),
      "the flagged live post must be one of the two same-day live posts"
    );
  });

  test("2 ledger claims + 2 live posts on the same platform/day: counts match, no drift", () => {
    const c1 = claim({ asset: "slot-1/x" });
    const c2 = claim({ asset: "slot-2/x" });
    const live: QueueItem[] = [
      { whenIso: c1.time, platform: "x", media: "text", title: "live post A", source: "typefully" },
      { whenIso: c1.time, platform: "x", media: "text", title: "live post B", source: "typefully" },
    ];

    const result = reconcile(live, [c1, c2], ALL_OK);
    assert.equal(result.claimedNotLive.length, 0);
    assert.equal(result.liveNotClaimed.length, 0);
  });
});

// Regression for card c18c39a9: fetchScheduledDrafts() used to fetch only the first page (limit=50)
// of Typefully's scheduled drafts. A real live draft sitting beyond that page was invisible to
// reconcile(), so a matching ledger claim was misreported as claimedNotLive and `--sync` would
// release it, letting a later run double-book the same slot. Exercises the full path: a stubbed
// multi-page Typefully response -> fetchScheduledDrafts() -> reconcile() (via syncLedger).
describe("queue-view.ts: reconcile() correctly matches a live post beyond the old pagination limit", () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.TYPEFULLY_API_KEY;
  const originalSetId = process.env.TYPEFULLY_SOCIAL_SET_ID;

  before(() => {
    process.env.CONTENT_AGENTS_TEST_LEDGER = TEST_LEDGER;
  });

  after(() => {
    delete process.env.CONTENT_AGENTS_TEST_LEDGER;
    if (existsSync(TEST_LEDGER)) unlinkSync(TEST_LEDGER);
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.TYPEFULLY_API_KEY;
    else process.env.TYPEFULLY_API_KEY = originalKey;
    if (originalSetId === undefined) delete process.env.TYPEFULLY_SOCIAL_SET_ID;
    else process.env.TYPEFULLY_SOCIAL_SET_ID = originalSetId;
  });

  beforeEach(() => {
    seedLedger([]);
  });

  test("the 51st Typefully draft is matched, not wrongly released as an orphan", async () => {
    process.env.TYPEFULLY_API_KEY = "test-key";
    process.env.TYPEFULLY_SOCIAL_SET_ID = "test-set";

    // The claim we expect to survive --sync: a real draft scheduled for 2026-08-01T17:00:00Z on x.
    const matched = claim({ asset: "51st-draft/x" });
    seedLedger([matched]);

    // First 50 drafts are unrelated (different day); the 51st (index 50, beyond the OLD limit=50
    // page) is the one that actually matches the ledger claim.
    const allDrafts = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      draft_title: `filler-${i + 1}`,
      scheduled_date: "2026-08-02T17:00:00.000Z",
      status: "scheduled",
      x_post_enabled: true,
    }));
    allDrafts.push({
      id: 51,
      draft_title: "the-real-draft",
      scheduled_date: matched.time,
      status: "scheduled",
      x_post_enabled: true,
    });

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const limit = Number(url.searchParams.get("limit") ?? "50");
      const offset = Number(url.searchParams.get("offset") ?? "0");
      const page = allDrafts.slice(offset, offset + limit);
      const next = offset + limit < allDrafts.length ? "https://api.typefully.com/v2/next-page" : null;
      return new Response(JSON.stringify({ results: page, next }), { status: 200 });
    }) as typeof fetch;

    const drafts = await fetchScheduledDrafts();
    assert.equal(drafts.length, 51, "fetchScheduledDrafts must have paged past the old 50-item limit");

    const live: QueueItem[] = drafts.map((d) => ({
      whenIso: d.whenIso,
      platform: d.platforms[0],
      media: "text",
      title: d.title,
      source: "typefully",
    }));

    const result = syncLedger(live, ALL_OK, NOW);
    assert.equal(
      result.releasedOrphans.length,
      0,
      "the 51st draft matches the claim, so reconcile() must not report it claimedNotLive"
    );
    assert.deepEqual(readLedger(), [matched], "a claim backed by a live post beyond the old page limit must survive --sync");
  });
});
