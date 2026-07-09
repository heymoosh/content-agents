/**
 * Unit tests for src/cron/bluesky-mentions.ts's detect/dedupe logic — goal (a):
 *   polling a mocked listNotifications response against an empty ledger detects+logs only new
 *   mentions, idempotent on a 2nd run against the same mock.
 *
 * fetchNotifications/detectNewMentions are pure/DI-testable (no real AtpAgent, no network) —
 * mirrors the mocking convention used elsewhere in this repo for external API calls (a minimal
 * injected client interface, e.g. typefully.test.ts's globalThis.fetch stub, cron/ledger.test.ts's
 * injectable ledger path).
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  detectNewMentions,
  fetchNotifications,
  type RawNotification,
  type NotificationsClient,
} from "./bluesky-mentions.js";
import { readLedger, appendLedger } from "./bluesky-mentions-ledger.js";

function notification(overrides: Partial<RawNotification> = {}): RawNotification {
  return {
    uri: "at://did:plc:abc/app.bsky.feed.post/rkey1",
    reason: "mention",
    author: { handle: "someone.bsky.social" },
    record: { text: "hey @humaninference, thoughts?", createdAt: "2026-07-08T10:00:00.000Z" },
    indexedAt: "2026-07-08T10:00:05.000Z",
    ...overrides,
  };
}

describe("detectNewMentions: filters to mention/reply, dedupes against seenUris", () => {
  test("keeps mention and reply, drops like/repost/follow", () => {
    const notifications = [
      notification({ uri: "u-mention", reason: "mention" }),
      notification({ uri: "u-reply", reason: "reply" }),
      notification({ uri: "u-like", reason: "like" }),
      notification({ uri: "u-repost", reason: "repost" }),
      notification({ uri: "u-follow", reason: "follow" }),
    ];
    const out = detectNewMentions(notifications, new Set());
    assert.deepEqual(
      out.map((m) => m.uri).sort(),
      ["u-mention", "u-reply"]
    );
  });

  test("drops anything already in seenUris", () => {
    const notifications = [
      notification({ uri: "u-new", reason: "mention" }),
      notification({ uri: "u-old", reason: "mention" }),
    ];
    const out = detectNewMentions(notifications, new Set(["u-old"]));
    assert.deepEqual(out.map((m) => m.uri), ["u-new"]);
  });

  test("maps author handle + rkey into a real bsky.app post URL", () => {
    const out = detectNewMentions(
      [notification({ uri: "at://did:plc:xyz/app.bsky.feed.post/theRkey", author: { handle: "alice.bsky.social" } })],
      new Set()
    );
    assert.equal(out[0].postUrl, "https://bsky.app/profile/alice.bsky.social/post/theRkey");
  });

  test("empty input against an empty ledger detects nothing (no crash)", () => {
    assert.deepEqual(detectNewMentions([], new Set()), []);
  });
});

describe("fetchNotifications: DI'd client, no real network", () => {
  test("passes reasons+limit through and returns the client's notifications", async () => {
    let seenParams: unknown;
    const client: NotificationsClient = {
      async listNotifications(params) {
        seenParams = params;
        return { data: { notifications: [notification({ uri: "u-1" })] } };
      },
    };
    const out = await fetchNotifications(client, 42);
    assert.deepEqual(seenParams, { reasons: ["mention", "reply"], limit: 42 });
    assert.equal(out.length, 1);
    assert.equal(out[0].uri, "u-1");
  });
});

// End-to-end poll-once helper: mirrors what main() does with a real ledger file, so the
// idempotency property is proven against the REAL readLedger/appendLedger, not a reimplementation.
function pollOnce(notifications: RawNotification[], ledgerPath: string): { logged: string[] } {
  const { seenUris } = readLedger(ledgerPath);
  const newMentions = detectNewMentions(notifications, seenUris);
  for (const m of newMentions) {
    appendLedger(
      {
        uri: m.uri,
        reason: m.reason,
        authorHandle: m.authorHandle,
        postUrl: m.postUrl,
        postText: m.postText,
        indexedAt: m.indexedAt,
        seenAt: new Date().toISOString(),
      },
      ledgerPath
    );
  }
  return { logged: newMentions.map((m) => m.uri) };
}

describe("poll against a real ledger file: detect+log new, idempotent on re-run", () => {
  test("first run against an empty ledger logs only new mentions; second run against the SAME mock logs nothing new", () => {
    const dir = mkdtempSync(join(tmpdir(), "bluesky-mentions-test-"));
    const ledgerPath = join(dir, "bluesky-mentions-ledger.jsonl");
    try {
      const mockResponse: RawNotification[] = [
        notification({ uri: "u-mention-1", reason: "mention", author: { handle: "alice.bsky.social" } }),
        notification({ uri: "u-reply-1", reason: "reply", author: { handle: "bob.bsky.social" } }),
        notification({ uri: "u-like-1", reason: "like" }), // must never be logged
      ];

      // Empty ledger to start.
      assert.equal(readLedger(ledgerPath).seenUris.size, 0);

      // Run 1: against an empty ledger, both mention+reply are detected+logged; the like is not.
      const run1 = pollOnce(mockResponse, ledgerPath);
      assert.deepEqual(run1.logged.sort(), ["u-mention-1", "u-reply-1"]);
      const afterRun1 = readLedger(ledgerPath);
      assert.equal(afterRun1.entries.length, 2, "ledger should have exactly the 2 real mentions, not the like");
      assert.ok(afterRun1.seenUris.has("u-mention-1"));
      assert.ok(afterRun1.seenUris.has("u-reply-1"));
      assert.ok(!afterRun1.seenUris.has("u-like-1"));

      // Run 2: identical mock response again — idempotent, nothing new to log.
      const run2 = pollOnce(mockResponse, ledgerPath);
      assert.deepEqual(run2.logged, [], "re-polling the exact same notifications must detect nothing new");
      const afterRun2 = readLedger(ledgerPath);
      assert.equal(afterRun2.entries.length, 2, "ledger must not grow on a re-run against the same mock");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
