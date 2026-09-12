import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { findLoggedRef, reconcileRow, type LiveProviderState } from "./reconcile.js";
import type { QueueRow } from "../publish/queue.js";
import type { PostizPost } from "../publish/postiz.js";

// Studio's Publishing room was blind to Postiz: reconcile.ts knew only Typefully and PostPeer, so a
// Postiz-scheduled bluesky/threads/x row could never reach state "scheduled" and the GUI's
// "Cancel scheduled post" button never rendered for it (src/review/page.ts). These tests pin the
// Postiz branch, and pin the fail-closed rule that matters most here: Postiz soft-deletes and
// filters deleted posts out of its list, so ABSENCE from that list is not evidence of anything.
// No network: every live list is handed in.

const row = (over: Partial<QueueRow> = {}): QueueRow => ({
  id: "x-1", platform: "x", format: "text", asset: "—", status: "approve", notes: "", lineIndex: 0, ...over,
});

// The real shape studio-scheduling.ts writes (content/2026-09-07-.../publish-log.md).
const POSTIZ_LOG =
  "# Publish log\n\n" +
  "- 2026-09-12T10:27:12.838Z — x-1 → postiz post pz-live-1 (x, Sun, Sep 13, 9:30 AM PT, cta→reply)\n";

const post = (over: Partial<PostizPost> = {}): PostizPost => ({
  id: "pz-live-1", url: null, status: "scheduled", scheduledAt: "2026-09-13T16:30:00.000Z", ...over,
});

const live = (over: Partial<LiveProviderState> = {}): LiveProviderState => ({
  typefullyDrafts: [], postpeerPosts: [], postizPosts: [], ...over,
});

describe("findLoggedRef reads Postiz refs", () => {
  test("extracts a postiz post id logged by studio-scheduling.ts", () => {
    assert.deepEqual(findLoggedRef(POSTIZ_LOG, "x-1"), {
      provider: "postiz",
      refId: "pz-live-1",
      loggedAt: "2026-09-12T10:27:12.838Z",
      plannedAt: "2026-09-13T17:30:00.000Z", // fixed -08:00 approximation, see plannedAtFromLogLine
    });
  });

  test("a postiz line is not confused with a postpeer line, in either direction", () => {
    const pp = "- 2026-07-10T00:00:00.000Z — t-1 → tiktok postpeer post pp-42 (scheduled)\n";
    assert.deepEqual(findLoggedRef(pp, "t-1"), { provider: "postpeer", refId: "pp-42" });
    const mixed = POSTIZ_LOG + pp;
    assert.equal(findLoggedRef(mixed, "x-1")?.provider, "postiz");
    assert.equal(findLoggedRef(mixed, "x-1")?.refId, "pz-live-1");
    assert.deepEqual(findLoggedRef(mixed, "t-1"), { provider: "postpeer", refId: "pp-42" });
  });
});

describe("reconcileRow — Postiz", () => {
  // Acceptance 1: present in the provider's list opens page.ts's cancel gate.
  test("a Postiz post present in the live list reconciles to scheduled, provider postiz", () => {
    const r = reconcileRow(row(), { text: POSTIZ_LOG }, live({ postizPosts: [post()] }));
    assert.equal(r.provider, "postiz");
    assert.equal(r.state, "scheduled", "state 'scheduled' is what renders the Cancel button in page.ts");
    assert.equal(r.providerObjectId, "pz-live-1");
    assert.ok(r.when, "carries the provider's own planned time");
  });

  test("a Postiz card row on a non-text platform reconciles through the same branch", () => {
    const log = "- 2026-09-12T10:00:00.000Z — quote-card-1 → postiz post pz-live-1 (bluesky, Sat)\n";
    const r = reconcileRow(
      row({ id: "quote-card-1", platform: "quote-card:bluesky", format: "image" }),
      { text: log },
      live({ postizPosts: [post()] }),
    );
    assert.equal(r.provider, "postiz");
    assert.equal(r.state, "scheduled");
  });

  test("the matched post's account id rides along as non-secret audit identity", () => {
    const r = reconcileRow(row(), { text: POSTIZ_LOG }, live({ postizPosts: [post({ accountId: "integration-7" })] }));
    assert.equal(r.providerAccountId, "integration-7");
  });

  // Acceptance 2: absence is never proof.
  test("a Postiz post ABSENT from the live list is uncertain, never a confirmed-gone state", () => {
    const r = reconcileRow(row(), { text: POSTIZ_LOG }, live({ postizPosts: [post({ id: "someone-elses-post" })] }));
    assert.equal(r.provider, "postiz");
    assert.equal(r.state, "unavailable", "absence must not read as a mismatch");
    assert.equal(r.deliveryState, "uncertain");
    assert.notEqual(r.state, "scheduled");
    assert.match(r.reason!, /absence cannot tell a live post from a canceled one/i);
  });

  test("an empty Postiz live list is uncertain too, not a confirmed cancellation", () => {
    const r = reconcileRow(row(), { text: POSTIZ_LOG }, live({ postizPosts: [] }));
    assert.equal(r.state, "unavailable");
    assert.equal(r.deliveryState, "uncertain");
  });

  // Acceptance 3: a transport/config failure is not evidence about provider state.
  test("a Postiz fetch failure is uncertain and surfaces the error, never scheduled and never absent", () => {
    const r = reconcileRow(
      row(),
      { text: POSTIZ_LOG },
      live({ postizPosts: null, postizError: "POSTIZ_BASE_URL and POSTIZ_API_KEY are required" }),
    );
    assert.equal(r.provider, "postiz");
    assert.equal(r.state, "unavailable");
    assert.equal(r.deliveryState, "uncertain");
    assert.equal(r.reason, "POSTIZ_BASE_URL and POSTIZ_API_KEY are required");
  });

  test("a Postiz channel that was never fetched this cycle is uncertain, not a mismatch", () => {
    const r = reconcileRow(row(), { text: POSTIZ_LOG }, { typefullyDrafts: [], postpeerPosts: [] });
    assert.equal(r.provider, "postiz");
    assert.equal(r.state, "unavailable");
    assert.equal(r.deliveryState, "uncertain");
  });

  // STATUS MATRIX. Every Postiz status this branch handles, and the state it must produce. The gap
  // this closes is the one the audit caught: "published" used to reach "scheduled", which is the
  // exact condition page.ts renders "✕ Cancel scheduled post" on, so Studio offered to soft-delete
  // a post that was already live under Muxin's byline.
  const MATRIX: { status: PostizPost["status"]; state: string; cancelable: boolean }[] = [
    { status: "scheduled", state: "scheduled", cancelable: true },
    { status: "draft", state: "scheduled", cancelable: true },
    { status: "private", state: "scheduled", cancelable: true },
    { status: "published", state: "unavailable", cancelable: false },
    { status: "canceled", state: "mismatch", cancelable: false },
    { status: "failed", state: "mismatch", cancelable: false },
    { status: "unknown", state: "unavailable", cancelable: false },
  ];

  for (const { status, state, cancelable } of MATRIX) {
    test(`status matrix: Postiz "${status}" reconciles to "${state}" and is ${cancelable ? "" : "NOT "}cancelable`, () => {
      const r = reconcileRow(row(), { text: POSTIZ_LOG }, live({ postizPosts: [post({ status })] }));
      assert.equal(r.state, state);
      assert.equal(r.provider, "postiz");
      // page.ts renders the cancel button on exactly this condition, and on nothing else.
      assert.equal(r.state === "scheduled", cancelable, "cancel button eligibility");
    });
  }

  // P1 regression, called out on its own so a revert is unmistakable.
  test("an ALREADY PUBLISHED Postiz post never becomes cancelable", () => {
    const r = reconcileRow(
      row({ status: "published" }),
      { text: POSTIZ_LOG },
      live({ postizPosts: [post({ status: "published", url: "https://x.com/muxin/status/1" })] }),
    );
    assert.notEqual(r.state, "scheduled", "state 'scheduled' is what renders the delete button in page.ts");
    assert.equal(r.state, "unavailable");
    assert.equal(r.deliveryState, "live", "it is live, which is the opposite of an uncertain absence");
    assert.equal(r.canonicalUrl, "https://x.com/muxin/status/1");
    assert.match(r.reason!, /already published/i);
    assert.doesNotMatch(r.reason!, /not found/i);
  });

  test("an unparseable provider time degrades this row's label, it does not throw", () => {
    const r = reconcileRow(row(), { text: POSTIZ_LOG }, live({ postizPosts: [post({ scheduledAt: "not-a-date" })] }));
    assert.equal(r.state, "scheduled");
    assert.equal(r.when, undefined);
  });
});

// Acceptance 6 (reconcile half): the two providers that already worked must be untouched, including
// when the Postiz channel is down.
describe("reconcileRow — Typefully and PostPeer are unchanged", () => {
  const tfLog = "- 2026-07-04T18:22:10.123Z — x-1 → typefully draft 98765 (x, Fri 9:00am PT)\n";
  const ppLog = "- 2026-07-04T18:22:10.123Z — tiktok-1 → tiktok postpeer post 55555 (scheduled)\n";

  test("a Typefully row still reconciles to scheduled while Postiz is down", () => {
    const r = reconcileRow(
      row(),
      { text: tfLog },
      live({
        typefullyDrafts: [{ id: "98765", whenIso: "2026-07-10T16:00:00.000Z", platforms: ["x"], title: "x-1" }],
        postizPosts: null,
        postizError: "could not reach Postiz",
      }),
    );
    assert.equal(r.provider, "typefully");
    assert.equal(r.state, "scheduled");
  });

  test("a PostPeer (TikTok) row still reconciles to scheduled while Postiz is down", () => {
    const r = reconcileRow(
      row({ id: "tiktok-1", platform: "tiktok", format: "short" }),
      { text: ppLog },
      live({ postpeerPosts: [{ id: "55555", scheduledFor: "2026-07-05T00:00:00.000Z" }], postizPosts: null }),
    );
    assert.equal(r.provider, "postpeer");
    assert.equal(r.state, "scheduled");
  });

  // The real historical shape: a pre-rewire quote-card that failed over to Upload-Post.
  test("the retired upload-post card row still degrades to its dashboard pointer, not to Postiz", () => {
    const log = "- 2026-06-24T20:10:59.848Z — quote-card-3 → upload-post job up-9 (scheduled)\n";
    const r = reconcileRow(
      row({ id: "quote-card-3", platform: "quote-card", format: "image" }),
      { text: log },
      live({ postizPosts: [post()] }),
    );
    assert.equal(r.provider, "upload-post");
    assert.equal(r.state, "unavailable");
    assert.match(r.reason!, /upload-post\.com/);
  });

  test("a Typefully row with no logged draft id still reports its own mismatch, not a Postiz one", () => {
    const r = reconcileRow(row(), { text: "" }, live({ postizPosts: [post()] }));
    assert.equal(r.provider, "typefully");
    assert.equal(r.state, "mismatch");
  });
});
