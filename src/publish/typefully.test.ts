/**
 * Unit tests for src/publish/typefully.ts buildDraftPayload — the scheduled vs UNSCHEDULED
 * draft contract used by the daily notes cloud routine (notes-daily.ts --no-schedule).
 *
 * Contract: omitting publish_at makes Typefully save an UNSCHEDULED draft (status not "scheduled",
 * no scheduled_date) that will NOT auto-post. The daily notes path relies on this so nothing fires
 * automatically — Muxin schedules/publishes the good drafts by hand.
 *
 * buildDraftPayload is a pure function (no network), so we test the exact JSON shape sent to the
 * Typefully /drafts API.
 */

import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { buildDraftPayload, fetchScheduledDrafts } from "./typefully.js";

const POSTS = [{ text: "Verbatim note text spread to a text channel." }];

describe("typefully buildDraftPayload: scheduled vs unscheduled contract", () => {
  test("daily notes path (publishAt=null) produces an UNSCHEDULED draft: no publish_at key", () => {
    const payload = buildDraftPayload({
      title: "x-1 (content-agents)",
      platformKey: "x",
      posts: POSTS,
      publishAt: null, // notes-daily --no-schedule passes null
    });
    assert.ok(
      !("publish_at" in payload),
      "unscheduled draft must OMIT publish_at so Typefully does not schedule/auto-post it"
    );
    // Sanity: the rest of the draft is still well-formed.
    assert.equal(payload.draft_title, "x-1 (content-agents)");
    assert.deepEqual(
      (payload.platforms as Record<string, unknown>).x,
      { enabled: true, posts: POSTS },
      "platform block should still carry the posts"
    );
  });

  test("scheduled path (publishAt set) INCLUDES publish_at so the draft auto-fires", () => {
    const payload = buildDraftPayload({
      title: "x-1 (content-agents)",
      platformKey: "x",
      posts: POSTS,
      publishAt: "next-free-slot",
    });
    assert.equal(
      payload.publish_at,
      "next-free-slot",
      "scheduled draft must carry publish_at"
    );
  });

  test("an explicit ISO publish time is preserved on publish_at", () => {
    const iso = "2026-06-27T16:30:00.000Z";
    const payload = buildDraftPayload({
      title: "bluesky-1 (content-agents)",
      platformKey: "bluesky",
      posts: POSTS,
      publishAt: iso,
    });
    assert.equal(payload.publish_at, iso);
  });

  test("empty-string publishAt is treated as unscheduled (no publish_at)", () => {
    // Defensive: a falsy publishAt must never schedule a draft.
    const payload = buildDraftPayload({
      title: "x-1 (content-agents)",
      platformKey: "x",
      posts: POSTS,
      publishAt: "",
    });
    assert.ok(!("publish_at" in payload), "empty publishAt must not schedule the draft");
  });
});

// fetchScheduledDrafts pagination: Typefully v2 caps a single page at limit=50 ({ results, next }
// shape, next null on the last page). Before this fix, only the first page was ever fetched — a
// genuinely-scheduled draft sitting beyond item 50 was invisible to reconcile() and could get
// misreported as an orphaned ledger claim and released by `queue -- --sync`.
describe("typefully fetchScheduledDrafts: pagination", () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.TYPEFULLY_API_KEY;
  const originalSetId = process.env.TYPEFULLY_SOCIAL_SET_ID;

  after(() => {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.TYPEFULLY_API_KEY;
    else process.env.TYPEFULLY_API_KEY = originalKey;
    if (originalSetId === undefined) delete process.env.TYPEFULLY_SOCIAL_SET_ID;
    else process.env.TYPEFULLY_SOCIAL_SET_ID = originalSetId;
  });

  function draft(id: number, minutesFromNow: number) {
    return {
      id,
      draft_title: `draft-${id}`,
      scheduled_date: new Date(Date.now() + minutesFromNow * 60_000).toISOString(),
      status: "scheduled",
      x_post_enabled: true,
    };
  }

  // Serves fixed-size pages out of `allDrafts`, honoring limit/offset and returning Typefully's
  // real { results, next } shape (next null on the last page).
  function stubPagedFetch(allDrafts: ReturnType<typeof draft>[]): { calls: string[] } {
    const calls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      calls.push(url.toString());
      const limit = Number(url.searchParams.get("limit") ?? "50");
      const offset = Number(url.searchParams.get("offset") ?? "0");
      const page = allDrafts.slice(offset, offset + limit);
      const next = offset + limit < allDrafts.length ? "https://api.typefully.com/v2/next-page" : null;
      return new Response(JSON.stringify({ results: page, next }), { status: 200 });
    }) as typeof fetch;
    return { calls };
  }

  test("pages through ALL scheduled drafts, not just the first 50", async () => {
    process.env.TYPEFULLY_API_KEY = "test-key";
    process.env.TYPEFULLY_SOCIAL_SET_ID = "test-set";
    const allDrafts = Array.from({ length: 120 }, (_, i) => draft(i + 1, i));
    const { calls } = stubPagedFetch(allDrafts);

    const scheduled = await fetchScheduledDrafts();

    assert.equal(scheduled.length, 120, "must return drafts from every page, not just the first 50");
    assert.ok(scheduled.some((d) => d.id === "119"), "a draft beyond the old 50-item limit must be present");
    assert.equal(calls.length, 3, "should have fetched exactly 3 pages (50 + 50 + 20)");
  });

  test("stops at the page cap and warns instead of looping forever", async () => {
    process.env.TYPEFULLY_API_KEY = "test-key";
    process.env.TYPEFULLY_SOCIAL_SET_ID = "test-set";
    // 600 drafts, always claiming a next page — a pathological account state.
    const allDrafts = Array.from({ length: 600 }, (_, i) => draft(i + 1, i));
    const { calls } = stubPagedFetch(allDrafts);
    const warnCalls: unknown[][] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => warnCalls.push(args);
    try {
      const scheduled = await fetchScheduledDrafts();
      assert.equal(scheduled.length, 500, "must stop at the 10-page cap (10 x 50), not fetch forever");
      assert.equal(calls.length, 10, "must stop issuing requests once the page cap is hit");
      assert.equal(warnCalls.length, 1, "must warn once when the cap is hit");
      assert.match(String(warnCalls[0][0]), /page cap/);
    } finally {
      console.warn = originalWarn;
    }
  });
});
