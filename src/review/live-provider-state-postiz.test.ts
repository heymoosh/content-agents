import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { fetchLiveProviderState, postizRefsForFolder, collectPostizLookups, type LiveFetchDeps, type PostizLookup } from "./rows.js";
import type { PublishLogRead } from "./reconcile.js";
import type { QueueRow } from "../publish/queue.js";
import type { PostizPost, PostizTransport } from "../publish/postiz.js";

// The Studio live poller learns nothing about Postiz unless it is told which post ids to look up:
// Postiz has no account-wide scheduled list, only a publish-date window resolved per post id. These
// tests pin the gate (no Postiz rows, no Postiz call), the window centring (a post planned months
// out must still be looked up around its planned time, not around now), per-ref failure isolation,
// and per-provider degradation. Every provider call is a stub; nothing touches a network.

const row = (over: Partial<QueueRow> = {}): QueueRow => ({
  id: "x-1", platform: "x", format: "text", asset: "—", status: "approve", notes: "", lineIndex: 0, ...over,
});

const FAKE_TRANSPORT: PostizTransport = { request: async () => ({}) };

const post = (id: string): PostizPost => ({ id, url: null, status: "scheduled", scheduledAt: null });

// One stubbed pass of every provider read, with counters the test can inspect.
function harness(found: Record<string, PostizPost | null> = {}) {
  const postizLookups: { id: string; around?: string }[] = [];
  let transportBuilds = 0;
  const deps: LiveFetchDeps = {
    fetchTypefully: async () => [{ id: "tf-1", whenIso: "2026-09-13T16:30:00.000Z", platforms: ["x"], title: "x-1" }],
    fetchPostpeer: async () => [{ id: "pp-1", scheduledFor: "2026-09-13T16:30:00.000Z" }],
    makePostizTransport: () => { transportBuilds++; return FAKE_TRANSPORT; },
    findPostiz: async (_t, id, around) => { postizLookups.push({ id, around }); return found[id] ?? null; },
  };
  return { deps, postizLookups, builds: () => transportBuilds };
}

// The real shape studio-scheduling.ts writes, planned time included as fmtLa's human PT label.
const POSTIZ_LOG = "- 2026-09-12T10:27:12.838Z — x-1 → postiz post pz-live-1 (x, Sun, Sep 13, 9:30 AM PT, cta→reply)\n";

describe("postizRefsForFolder — what tells the poller a Postiz call is warranted", () => {
  test("collects the Postiz refs of rows that actually need reconciliation", () => {
    const lookups = postizRefsForFolder([row()], { text: POSTIZ_LOG });
    assert.equal(lookups.length, 1);
    assert.equal(lookups[0].id, "pz-live-1");
  });

  // The audit's window bug: centring on "now" silently misses a post planned further out than the
  // provider's list window, so it can never be confirmed and never gets a cancel button.
  test("carries the row's PLANNED time, recovered from the log label, as the lookup centre", () => {
    const [lookup] = postizRefsForFolder([row()], { text: POSTIZ_LOG });
    assert.ok(lookup.around, "a lookup with no centre falls back to now, which is the bug");
    assert.equal(lookup.around, "2026-09-13T17:30:00.000Z", "Sun, Sep 13 in the log label, not the Sep 12 log stamp");
  });

  test("a post planned far past the provider's window still centres on its own planned time", () => {
    const far = "- 2026-09-12T10:00:00.000Z — x-1 → postiz post pz-far (x, Thu, Dec 31, 6:30 PM PT)\n";
    const [lookup] = postizRefsForFolder([row()], { text: far });
    // Dec 31 evening PT is Jan 1 in UTC. The point is that it centres 110 days after the log stamp,
    // well outside the provider's window around "now", which is what used to lose this post.
    assert.equal(lookup.around, "2027-01-01T02:30:00.000Z");
    const days = (Date.parse(lookup.around!) - Date.parse("2026-09-12T10:00:00.000Z")) / 86_400_000;
    assert.ok(days > 45, `planned time is ${Math.round(days)} days out, past the provider window`);
  });

  test("a planned label that rolls into the next year takes the closest year, not the log's", () => {
    const rollover = "- 2026-12-28T10:00:00.000Z — x-1 → postiz post pz-ny (x, Fri, Jan 2, 9:00 AM PT)\n";
    const [lookup] = postizRefsForFolder([row()], { text: rollover });
    assert.match(lookup.around!, /^2027-01-02T/);
  });

  test("a line with no parseable planned label falls back to the line's own ISO stamp", () => {
    const bare = "- 2026-09-12T10:27:12.838Z — x-1 → postiz post pz-bare (x)\n";
    const [lookup] = postizRefsForFolder([row()], { text: bare });
    assert.equal(lookup.around, "2026-09-12T10:27:12.838Z");
  });

  test("a row that does not need reconciliation contributes no ref", () => {
    assert.deepEqual(postizRefsForFolder([row({ status: "pending" })], { text: POSTIZ_LOG }), []);
  });

  test("Typefully, PostPeer and upload-post rows contribute no Postiz ref", () => {
    const log =
      "- 2026-07-04T18:22:10.123Z — x-1 → typefully draft 98765 (x)\n" +
      "- 2026-07-04T18:22:10.123Z — tiktok-1 → tiktok postpeer post 55555 (scheduled)\n" +
      "- 2026-06-24T20:10:59.848Z — card-1 → upload-post job up-9 (scheduled)\n";
    const rows = [row(), row({ id: "tiktok-1", platform: "tiktok", format: "short" }), row({ id: "card-1", platform: "quote-card", format: "image" })];
    assert.deepEqual(postizRefsForFolder(rows, { text: log }), []);
  });

  test("an unreadable publish log yields no refs rather than a guess", () => {
    assert.deepEqual(postizRefsForFolder([row()], { text: "", error: "EACCES" }), []);
  });
});

// The glue listPieces runs to turn every folder's rows into the poller's one lookup list.
describe("collectPostizLookups — the listPieces aggregation", () => {
  const logs = (entries: Record<string, string>): ReadonlyMap<string, PublishLogRead> =>
    new Map(Object.entries(entries).map(([folder, text]) => [folder, { text }]));

  test("aggregates every folder's Postiz lookups into one list", () => {
    const result = collectPostizLookups(
      [{ folder: "/a", rows: [row()] }, { folder: "/b", rows: [row({ id: "b-1" })] }],
      logs({
        "/a": POSTIZ_LOG,
        "/b": "- 2026-09-12T10:00:00.000Z — b-1 → postiz post pz-live-2 (bluesky, Sun, Sep 13, 6:30 PM PT)\n",
      }),
    );
    assert.deepEqual(result.map((l) => l.id), ["pz-live-1", "pz-live-2"]);
  });

  test("dedupes two rows naming the same Postiz post", () => {
    const result = collectPostizLookups(
      [{ folder: "/a", rows: [row()] }, { folder: "/b", rows: [row({ id: "b-1" })] }],
      logs({ "/a": POSTIZ_LOG, "/b": "- 2026-09-12T10:00:00.000Z — b-1 → postiz post pz-live-1 (x, Sun, Sep 13, 9:30 AM PT)\n" }),
    );
    assert.deepEqual(result.map((l) => l.id), ["pz-live-1"]);
  });

  test("a folder with no publish log and a folder of non-Postiz rows contribute nothing", () => {
    const result = collectPostizLookups(
      [{ folder: "/a", rows: [row()] }, { folder: "/b", rows: [row({ id: "b-1" })] }],
      logs({ "/b": "- 2026-07-04T18:22:10.123Z — b-1 → typefully draft 98765 (x)\n" }),
    );
    assert.deepEqual(result, []);
  });

  test("no folders at all means no lookups, so the poller makes no Postiz call", () => {
    assert.deepEqual(collectPostizLookups([], new Map()), []);
  });
});

describe("fetchLiveProviderState — Postiz channel", () => {
  // Acceptance 7: no Postiz rows needing reconciliation means no Postiz call at all.
  test("with no Postiz refs it builds no transport and makes no lookup", async () => {
    const h = harness();
    const live = await fetchLiveProviderState([], h.deps);
    assert.equal(h.builds(), 0, "must not even build a Postiz transport when nothing needs it");
    assert.deepEqual(h.postizLookups, [], "must make no Postiz call");
    assert.deepEqual(live.postizPosts, []);
    assert.equal(live.postizError, undefined);
    assert.equal(live.typefullyDrafts?.length, 1, "the other providers are still read");
    assert.equal(live.postpeerPosts?.length, 1);
  });

  test("it looks up exactly the given refs and passes each planned time through as the window centre", async () => {
    const h = harness({ "pz-live-1": post("pz-live-1") });
    const lookups: PostizLookup[] = [{ id: "pz-live-1", around: "2026-12-31T02:30:00.000Z" }, { id: "pz-gone-2" }];
    const live = await fetchLiveProviderState(lookups, h.deps);
    assert.deepEqual(h.postizLookups, [
      { id: "pz-live-1", around: "2026-12-31T02:30:00.000Z" },
      { id: "pz-gone-2", around: undefined },
    ]);
    assert.equal(h.builds(), 1, "one transport for the whole pass");
    assert.deepEqual(live.postizPosts, [post("pz-live-1")], "a ref Postiz does not list simply is not in the list");
  });

  // Audit P2: one bad ref must not hide every other Postiz row.
  test("a single failing ref is absent for itself only and leaves the healthy refs confirmed", async () => {
    const h = harness();
    const deps: LiveFetchDeps = {
      ...h.deps,
      findPostiz: async (_t, id) => {
        if (id === "pz-bad") throw new Error("Postiz GET /api/public/v1/posts failed (503)");
        return post(id);
      },
    };
    const live = await fetchLiveProviderState([{ id: "pz-ok" }, { id: "pz-bad" }, { id: "pz-ok-2" }], deps);
    assert.deepEqual(live.postizPosts?.map((p) => p.id), ["pz-ok", "pz-ok-2"], "healthy rows keep their confirmation");
    assert.equal(live.postizError, undefined, "one bad ref is not a channel outage");
    assert.equal(
      live.postizPosts?.some((p) => p.id === "pz-bad"),
      false,
      "the failed ref must never appear as a confirmation; absent reads uncertain at reconcileRow",
    );
  });

  // Acceptance 8: one provider down must not blank the others.
  test("a Postiz config failure nulls only the Postiz channel and records its error", async () => {
    const h = harness();
    const deps: LiveFetchDeps = { ...h.deps, makePostizTransport: () => { throw new Error("POSTIZ_BASE_URL and POSTIZ_API_KEY are required"); } };
    const live = await fetchLiveProviderState([{ id: "pz-live-1" }], deps);
    assert.equal(live.postizPosts, null, "a failed read is null, never an empty list");
    assert.match(live.postizError!, /POSTIZ_BASE_URL and POSTIZ_API_KEY are required/);
    assert.equal(live.typefullyDrafts?.length, 1, "Typefully evidence survives a Postiz outage");
    assert.equal(live.postpeerPosts?.length, 1, "PostPeer evidence survives a Postiz outage");
    assert.equal(live.typefullyError, undefined);
    assert.equal(live.postpeerError, undefined);
  });

  test("a Typefully failure leaves the Postiz channel intact", async () => {
    const h = harness({ "pz-live-1": post("pz-live-1") });
    const deps: LiveFetchDeps = { ...h.deps, fetchTypefully: async () => { throw new Error("TYPEFULLY_API_KEY missing"); } };
    const live = await fetchLiveProviderState([{ id: "pz-live-1" }], deps);
    assert.equal(live.typefullyDrafts, null);
    assert.match(live.typefullyError!, /TYPEFULLY_API_KEY missing/);
    assert.deepEqual(live.postizPosts, [post("pz-live-1")]);
    assert.equal(live.postpeerPosts?.length, 1);
  });

  test("a PostPeer failure leaves the Postiz channel intact", async () => {
    const h = harness({ "pz-live-1": post("pz-live-1") });
    const deps: LiveFetchDeps = { ...h.deps, fetchPostpeer: async () => { throw new Error("POSTPEER_API_KEY missing"); } };
    const live = await fetchLiveProviderState([{ id: "pz-live-1" }], deps);
    assert.equal(live.postpeerPosts, null);
    assert.deepEqual(live.postizPosts, [post("pz-live-1")]);
    assert.equal(live.typefullyDrafts?.length, 1);
  });
});
