import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadOutreachConfig, type OutreachConfig } from "../outreach/config.js";
import { appendTrackerEvent, readTrackerEvents, foldLeadEvents, buildInboundRows, nextActionLabel, type TrackerEvent } from "../outreach/tracker.js";
import { appendLedger, type MentionLedgerEntry } from "./bluesky-mentions-ledger.js";
import { foldMentionsPure, foldLedgerIntoTracker } from "./inbound-to-tracker.js";

const CONFIG: OutreachConfig = loadOutreachConfig();

function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), "inbound-to-tracker-test-"));
}

const MENTION_A: MentionLedgerEntry = {
  uri: "at://did:plc:alice/app.bsky.feed.post/aaa111",
  reason: "mention",
  authorHandle: "alice.bsky.social",
  postUrl: "https://bsky.app/profile/alice.bsky.social/post/aaa111",
  postText: "what do you make of this?",
  indexedAt: "2026-07-10T10:00:00.000Z",
  seenAt: "2026-07-10T10:00:05.000Z",
};

const MENTION_B: MentionLedgerEntry = {
  uri: "at://did:plc:bob/app.bsky.feed.post/bbb222",
  reason: "reply",
  authorHandle: "bob.bsky.social",
  postUrl: "https://bsky.app/profile/bob.bsky.social/post/bbb222",
  postText: "disagree, here's why",
  indexedAt: "2026-07-11T09:00:00.000Z",
  seenAt: "2026-07-11T09:00:05.000Z",
};

describe("foldMentionsPure", () => {
  test("maps each new mention to an inbound_received tracker event, deduped by URI", () => {
    const events = foldMentionsPure([MENTION_A, MENTION_B], [], "bluesky");
    assert.equal(events.length, 2);
    assert.deepEqual(
      events.map((e) => ({ lead: e.lead, bucket: e.bucket, event: e.event, message: e.message, note: e.note })),
      [
        { lead: "alice.bsky.social", bucket: "inbound", event: "inbound_received", message: MENTION_A.uri, note: MENTION_A.postText },
        { lead: "bob.bsky.social", bucket: "inbound", event: "inbound_received", message: MENTION_B.uri, note: MENTION_B.postText },
      ]
    );
  });

  test("skips a mention already folded (same URI in an existing inbound_received event)", () => {
    const existing: TrackerEvent[] = [
      { ts: MENTION_A.indexedAt, lead: MENTION_A.authorHandle, bucket: "inbound", event: "inbound_received", channel: "bluesky", message: MENTION_A.uri, note: MENTION_A.postText },
    ];
    const events = foldMentionsPure([MENTION_A, MENTION_B], existing, "bluesky");
    assert.equal(events.length, 1);
    assert.equal(events[0].message, MENTION_B.uri);
  });
});

describe("foldLedgerIntoTracker: idempotent end-to-end fold", () => {
  test("first run appends both mentions; re-run appends zero", () => {
    const dir = tmpDir();
    const ledgerPath = join(dir, "ledger.jsonl");
    const trackerPath = join(dir, "tracker.jsonl");
    try {
      appendLedger(MENTION_A, ledgerPath);
      appendLedger(MENTION_B, ledgerPath);

      const first = foldLedgerIntoTracker(ledgerPath, trackerPath);
      assert.equal(first.appended, 2);
      assert.equal(readTrackerEvents(trackerPath).length, 2);

      const second = foldLedgerIntoTracker(ledgerPath, trackerPath);
      assert.equal(second.appended, 0);
      assert.equal(second.skipped, 2);
      assert.equal(readTrackerEvents(trackerPath).length, 2); // still 2, not 4
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("Follow-ups tab rendering: shared mechanics, inbound-only entry label", () => {
  test("a fresh mention renders as a 'draft reply' row with the mention text as why", () => {
    const dir = tmpDir();
    const trackerPath = join(dir, "tracker.jsonl");
    try {
      appendTrackerEvent(
        { ts: MENTION_A.indexedAt, lead: MENTION_A.authorHandle, bucket: "inbound", event: "inbound_received", channel: "bluesky", message: MENTION_A.uri, note: MENTION_A.postText },
        trackerPath
      );
      const rows = buildInboundRows(readTrackerEvents(trackerPath), CONFIG);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].who, "alice.bsky.social");
      assert.equal(rows[0].why, MENTION_A.postText);
      assert.equal(rows[0].status, "not_contacted");
      assert.equal(rows[0].nextAction, "draft reply");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("once Muxin replies (a normal contacted event), the shared outbound clock takes over", () => {
    const events: TrackerEvent[] = [
      { ts: "2026-07-10T10:00:00.000Z", lead: "alice.bsky.social", bucket: "inbound", event: "inbound_received", channel: "bluesky", message: MENTION_A.uri, note: MENTION_A.postText },
      { ts: "2026-07-10T14:00:00.000Z", lead: "alice.bsky.social", bucket: "inbound", event: "followup_sent", channel: "bluesky" },
    ];
    const state = foldLeadEvents("alice.bsky.social", "inbound", events, CONFIG, "2026-07-10T15:00:00.000Z");
    assert.equal(state.status, "waiting");
    assert.ok(state.dueDate, "replying should start the same due-date clock outbound leads get");
    assert.equal(nextActionLabel(state), `waiting (check back ${state.dueDate})`);
  });

  test("a later mention after Muxin already replied flips the row back to 'draft reply'", () => {
    const events: TrackerEvent[] = [
      { ts: "2026-07-10T10:00:00.000Z", lead: "alice.bsky.social", bucket: "inbound", event: "inbound_received", channel: "bluesky", message: MENTION_A.uri, note: MENTION_A.postText },
      { ts: "2026-07-10T14:00:00.000Z", lead: "alice.bsky.social", bucket: "inbound", event: "followup_sent", channel: "bluesky" },
      { ts: "2026-07-12T09:00:00.000Z", lead: "alice.bsky.social", bucket: "inbound", event: "inbound_received", channel: "bluesky", message: MENTION_B.uri, note: "following up on my last message" },
    ];
    const state = foldLeadEvents("alice.bsky.social", "inbound", events, CONFIG);
    assert.equal(state.status, "not_contacted");
    assert.equal(nextActionLabel(state), "draft reply");
    assert.equal(state.lastNote, "following up on my last message");
  });

  test("outbound (client) 'not_contacted' copy is unaffected by the inbound branch", () => {
    const state = foldLeadEvents("client-acme-co", "client", [], CONFIG);
    assert.equal(nextActionLabel(state), "not yet contacted");
  });
});
