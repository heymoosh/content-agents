import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { needsReconciliation, findLoggedRef, reconcileRow, type LiveProviderState } from "./reconcile.js";
import type { QueueRow } from "../publish/queue.js";

// Live Typefully/PostPeer schedule reconciliation (Muxin, 2026-07-04): with one row genuinely
// scheduled at the provider and one approved row nothing was ever scheduled/it drifted, the review
// GUI should show the provider's real time on the first and a mismatch flag on the second — this
// is the one design decision (correlation key) plus its logic, verified with no network calls.

const row = (over: Partial<QueueRow>): QueueRow => ({
  id: "r-1", platform: "x", format: "text", asset: "—", status: "published", notes: "", lineIndex: 0, ...over,
});

const NO_LIVE: LiveProviderState = { typefullyDrafts: [], postpeerPosts: [] };

describe("needsReconciliation", () => {
  test("only approve/published rows on typefully/tiktok/card platforms are checked", () => {
    assert.equal(needsReconciliation(row({ status: "published", platform: "x" })), true);
    assert.equal(needsReconciliation(row({ status: "approve", platform: "linkedin" })), true);
    assert.equal(needsReconciliation(row({ status: "published", platform: "bluesky" })), true);
    assert.equal(needsReconciliation(row({ status: "published", platform: "tiktok", format: "short" })), true);
    assert.equal(needsReconciliation(row({ status: "published", platform: "quote-card", format: "image" })), true);
    assert.equal(needsReconciliation(row({ status: "published", platform: "quote-card:x", format: "image" })), true);
  });

  test("pending/revise/discard rows are never reconciled, even on a covered platform", () => {
    assert.equal(needsReconciliation(row({ status: "pending" })), false);
    assert.equal(needsReconciliation(row({ status: "revise" })), false);
    assert.equal(needsReconciliation(row({ status: "discard" })), false);
  });

  test("platforms outside Typefully/PostPeer (youtube, substack) are never reconciled", () => {
    assert.equal(needsReconciliation(row({ status: "published", platform: "youtube", format: "short" })), false);
    assert.equal(needsReconciliation(row({ status: "published", platform: "substack" })), false);
  });
});

describe("findLoggedRef — parsing publish-log.md's free-text lines", () => {
  test("extracts a typefully draft id logged by typefully.ts", () => {
    const log = `# Publish log\n\n- 2026-07-04T18:22:10.123Z — x-1 → typefully draft 98765 (x, Fri 9:00am PT)\n`;
    assert.deepEqual(findLoggedRef(log, "x-1"), { provider: "typefully", refId: "98765" });
  });

  test("extracts a postpeer post id logged by tiktok.ts", () => {
    const log = `- 2026-07-04T18:22:10.123Z — tiktok-1 → tiktok postpeer post 55555 (scheduled 2026-07-05T00:00:00.000Z)\n`;
    assert.deepEqual(findLoggedRef(log, "tiktok-1"), { provider: "postpeer", refId: "55555" });
  });

  test("extracts a postpeer post id logged by cards.ts", () => {
    const log = `- 2026-07-04T18:22:10.123Z — quote-card-1-x → postpeer postpeer post 44444 → twitter [twitter] (scheduled 2026-07-05T00:00:00.000Z)\n`;
    assert.deepEqual(findLoggedRef(log, "quote-card-1-x"), { provider: "postpeer", refId: "44444" });
  });

  test("extracts an upload-post job id logged by cards.ts's failover provider", () => {
    const log = `- 2026-06-24T20:10:59.848Z — quote-card-3 → upload-post upload-post job 9cce6f7492ec45a8ae810bc0beb5e97f → linkedin+bluesky [linkedin+bluesky +link] (scheduled 2026-07-07T19:00:00.000Z)\n`;
    assert.deepEqual(findLoggedRef(log, "quote-card-3"), { provider: "upload-post", refId: "9cce6f7492ec45a8ae810bc0beb5e97f" });
  });

  test("returns null for a row with no logged entry at all", () => {
    const log = `- 2026-07-04T18:22:10.123Z — x-1 → typefully draft 98765 (x, Fri 9:00am PT)\n`;
    assert.equal(findLoggedRef(log, "x-2"), null);
  });

  test("takes the LAST matching entry when a row was rescheduled", () => {
    const log =
      `- 2026-07-01T00:00:00.000Z — tiktok-1 → tiktok postpeer post 11111 (scheduled 2026-07-02T00:00:00.000Z)\n` +
      `- 2026-07-03T00:00:00.000Z — tiktok-1 → tiktok postpeer post 22222 (scheduled 2026-07-06T00:00:00.000Z)\n`;
    assert.deepEqual(findLoggedRef(log, "tiktok-1"), { provider: "postpeer", refId: "22222" });
  });

  // Real content/2026-06-16-building-an-innovation-nation/publish-log.md data: quote-card-3 was
  // first scheduled via PostPeer, then rescheduled TWICE via the upload-post failover. The provider
  // ref for this row must reflect the LATEST reschedule (upload-post), not the stale PostPeer one —
  // otherwise reconcileRow would check a superseded id against the wrong provider's live list.
  test("reflects the most recent reschedule even when it switched provider format (real quote-card-3 data)", () => {
    const log =
      `- 2026-06-24T20:09:12.071Z — quote-card-3 → postpeer postpeer post 6a3c3968060dd1b4214d5566 → bluesky+linkedin+linkedin [bluesky+linkedin+linkedin +link] (scheduled 2026-06-26T19:00:00.000Z)\n` +
      `- 2026-06-24T20:10:59.848Z — quote-card-3 → upload-post upload-post job 9cce6f7492ec45a8ae810bc0beb5e97f → linkedin+bluesky [linkedin+bluesky +link] (scheduled 2026-07-07T19:00:00.000Z)\n` +
      `- 2026-06-24T20:11:00.583Z — quote-card-3 → upload-post upload-post job c283be7ff94347618a561aede34a2e81 → x [x] (scheduled 2026-07-07T19:00:00.000Z)\n`;
    assert.deepEqual(findLoggedRef(log, "quote-card-3"), { provider: "upload-post", refId: "c283be7ff94347618a561aede34a2e81" });
  });

  test("resets to null (not a stale ref) when the most recent line for a row uses an unrecognized ref format", () => {
    const log =
      `- 2026-07-01T00:00:00.000Z — foo-1 → postpeer post 11111 (scheduled 2026-07-02T00:00:00.000Z)\n` +
      `- 2026-07-03T00:00:00.000Z — foo-1 → somefutureprovider ref 99999 (scheduled 2026-07-06T00:00:00.000Z)\n`;
    assert.equal(findLoggedRef(log, "foo-1"), null);
  });
});

describe("reconcileRow — the actual GOAL_CONDITION scenario", () => {
  test("a published text row whose draft IS live shows the provider's real scheduled time", () => {
    const log = `- 2026-07-04T00:00:00.000Z — x-1 → typefully draft 98765 (x, Fri 9:00am PT)\n`;
    const live: LiveProviderState = {
      typefullyDrafts: [{ id: "98765", whenIso: "2026-07-10T16:00:00.000Z", platforms: ["x"], title: "x-1 (content-agents)" }],
      postpeerPosts: [],
    };
    const result = reconcileRow(row({ id: "x-1", platform: "x", status: "published" }), { text: log }, live);
    assert.equal(result.provider, "typefully");
    assert.equal(result.state, "scheduled");
    assert.ok(result.when && result.when.includes("PT"), "when should be a human PT label");
  });

  test("an approved text row whose logged draft id has NO live match is flagged mismatch", () => {
    const log = `- 2026-07-04T00:00:00.000Z — x-1 → typefully draft 111 (x, Fri 9:00am PT)\n`;
    const live: LiveProviderState = {
      typefullyDrafts: [{ id: "999", whenIso: "2026-07-10T16:00:00.000Z", platforms: ["x"], title: "some-other-row (content-agents)" }],
      postpeerPosts: [],
    };
    const result = reconcileRow(row({ id: "x-1", platform: "x", status: "approve" }), { text: log }, live);
    assert.equal(result.provider, "typefully");
    assert.equal(result.state, "mismatch");
    assert.match(result.reason ?? "", /no matching scheduled draft/);
  });

  test("an approved text row with no logged draft id at all is flagged mismatch", () => {
    const result = reconcileRow(row({ id: "x-1", platform: "x", status: "approve" }), { text: "" }, NO_LIVE);
    assert.equal(result.provider, "typefully");
    assert.equal(result.state, "mismatch");
    assert.match(result.reason ?? "", /no logged Typefully draft id/);
  });

  // Two different content folders both numbering rows "x-1", "x-2", ... is real (confirmed in this
  // repo's own content/ folders) — matching by row-derived title alone would have let one folder's
  // row silently show another folder's schedule. Matching by the provider's own draft id instead
  // makes that collision structurally impossible: a same-named row in a DIFFERENT folder that was
  // never logged for THIS folder produces no ref, so it can never accidentally match someone else's
  // live draft merely because the title happens to collide.
  test("two folders' same-named row id never cross-match because matching is by logged draft id, not title", () => {
    const live: LiveProviderState = {
      typefullyDrafts: [{ id: "555", whenIso: "2026-06-20T16:00:00.000Z", platforms: ["x"], title: "x-1 (content-agents)" }],
      postpeerPosts: [],
    };
    // This folder's own publish-log.md never logged x-1 (a different folder's x-1 did).
    const result = reconcileRow(row({ id: "x-1", platform: "x", status: "approve" }), { text: "" }, live);
    assert.equal(result.state, "mismatch");
    assert.match(result.reason ?? "", /no logged Typefully draft id/);
  });

  test("a published tiktok row whose logged postId IS in the live PostPeer list shows the real time", () => {
    const log = `- 2026-07-04T00:00:00.000Z — tiktok-1 → tiktok postpeer post 55555 (scheduled 2026-07-05T00:00:00.000Z)\n`;
    const live: LiveProviderState = {
      typefullyDrafts: [],
      postpeerPosts: [{ id: "55555", scheduledFor: "2026-07-05T00:00:00.000Z" }],
    };
    const result = reconcileRow(row({ id: "tiktok-1", platform: "tiktok", format: "short", status: "published" }), { text: log }, live);
    assert.equal(result.provider, "postpeer");
    assert.equal(result.state, "scheduled");
    assert.ok(result.when && result.when.includes("PT"));
  });

  test("a published card row whose logged postId is NOT in the live list is flagged mismatch (drift)", () => {
    const log = `- 2026-07-04T00:00:00.000Z — quote-card-1-x → postpeer postpeer post 44444 → twitter [twitter] (scheduled 2026-07-05T00:00:00.000Z)\n`;
    const live: LiveProviderState = { typefullyDrafts: [], postpeerPosts: [{ id: "99999", scheduledFor: "2026-07-06T00:00:00.000Z" }] };
    const result = reconcileRow(row({ id: "quote-card-1-x", platform: "quote-card:x", format: "image", status: "published" }), { text: log }, live);
    assert.equal(result.provider, "postpeer");
    assert.equal(result.state, "mismatch");
    assert.match(result.reason ?? "", /not found in the live scheduled posts/);
  });

  test("a quote-card row scheduled via the upload-post failover reports 'unavailable', never a false mismatch", () => {
    const log = `- 2026-06-24T20:11:00.583Z — quote-card-3 → upload-post upload-post job c283be7ff94347618a561aede34a2e81 → x [x] (scheduled 2026-07-07T19:00:00.000Z)\n`;
    const result = reconcileRow(row({ id: "quote-card-3", platform: "quote-card:x", format: "image", status: "published" }), { text: log }, NO_LIVE);
    assert.equal(result.provider, "upload-post");
    assert.equal(result.state, "unavailable");
    assert.match(result.reason ?? "", /upload-post failover/);
  });

  // 2026-07-08 rewire (card 1829fdf9): cards.ts ships x/linkedin/bluesky cards as NATIVE Typefully
  // drafts now, logged exactly like text rows (`typefully draft <id>`) — so a card whose most recent
  // log line is a Typefully draft must reconcile via the Typefully branch, not PostPeer.
  test("a published quote-card row logged via the NEW Typefully draft path reconciles like a text row", () => {
    const log = `- 2026-07-08T00:00:00.000Z — quote-card-1-x → typefully draft 424242 (x, Fri 12:00pm PT)\n`;
    const live: LiveProviderState = {
      typefullyDrafts: [{ id: "424242", whenIso: "2026-07-10T20:00:00.000Z", platforms: ["x"], title: "quote-card-1-x (content-agents)" }],
      postpeerPosts: [],
    };
    const result = reconcileRow(row({ id: "quote-card-1-x", platform: "quote-card:x", format: "image", status: "published" }), { text: log }, live);
    assert.equal(result.provider, "typefully");
    assert.equal(result.state, "scheduled");
    assert.ok(result.when && result.when.includes("PT"));
  });

  test("an approved quote-card row with no logged ref at all reconciles as a Typefully mismatch, not PostPeer", () => {
    const result = reconcileRow(row({ id: "quote-card-1-x", platform: "quote-card:x", format: "image", status: "approve" }), { text: "" }, NO_LIVE);
    assert.equal(result.provider, "typefully");
    assert.equal(result.state, "mismatch");
    assert.match(result.reason ?? "", /no logged Typefully draft id/);
  });

  test("an approved-but-never-scheduled tiktok row (no publish-log.md entry) is flagged mismatch", () => {
    const result = reconcileRow(row({ id: "tiktok-2", platform: "tiktok", format: "short", status: "approve" }), { text: "" }, NO_LIVE);
    assert.equal(result.provider, "postpeer");
    assert.equal(result.state, "mismatch");
    assert.match(result.reason ?? "", /no scheduled PostPeer post recorded/);
  });

  test("pending/discard/revise rows are not-applicable regardless of live state", () => {
    assert.deepEqual(reconcileRow(row({ status: "pending" }), { text: "" }, NO_LIVE), { provider: null, state: "not-applicable" });
    assert.deepEqual(reconcileRow(row({ status: "discard" }), { text: "" }, NO_LIVE), { provider: null, state: "not-applicable" });
  });

  test("a row outside typefully/postpeer coverage (youtube) is not-applicable", () => {
    const result = reconcileRow(row({ platform: "youtube", format: "short", status: "published" }), { text: "" }, NO_LIVE);
    assert.deepEqual(result, { provider: null, state: "not-applicable" });
  });

  test("credentials/network failure surfaces as 'unavailable', never a false mismatch", () => {
    const live: LiveProviderState = { typefullyDrafts: null, typefullyError: "TYPEFULLY_API_KEY missing", postpeerPosts: [] };
    const result = reconcileRow(row({ id: "x-1", platform: "x", status: "published" }), { text: "" }, live);
    assert.equal(result.state, "unavailable");
    assert.match(result.reason ?? "", /TYPEFULLY_API_KEY missing/);
  });

  test("an unreadable publish-log.md surfaces as 'unavailable', never a false mismatch", () => {
    const result = reconcileRow(
      row({ id: "quote-card-1", platform: "quote-card", format: "image", status: "published" }),
      { text: "", error: "EACCES: permission denied, open 'publish-log.md'" },
      NO_LIVE
    );
    assert.equal(result.state, "unavailable");
    assert.match(result.reason ?? "", /EACCES/);
  });

  test("a malformed/invalid provider timestamp degrades to omitting `when` instead of throwing", () => {
    const log = `- 2026-07-04T00:00:00.000Z — x-1 → typefully draft 98765 (x, Fri 9:00am PT)\n`;
    const live: LiveProviderState = {
      typefullyDrafts: [{ id: "98765", whenIso: "not-a-real-date", platforms: ["x"], title: "x-1 (content-agents)" }],
      postpeerPosts: [],
    };
    const result = reconcileRow(row({ id: "x-1", platform: "x", status: "published" }), { text: log }, live);
    assert.equal(result.state, "scheduled");
    assert.equal(result.when, undefined);
  });
});
