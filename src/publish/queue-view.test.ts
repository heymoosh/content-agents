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
import { syncLedger, type QueueItem } from "./queue-view.js";

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
