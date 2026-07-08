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
import { buildDraftPayload, buildPosts, fetchScheduledDrafts } from "./typefully.js";

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

// buildPosts now takes a LIST of CTAs (Smarter routing, card 6dcaee98) instead of one url/label,
// so a post matching 2+ content types can stack every applicable CTA instead of picking a winner.
describe("buildPosts: stacked CTA lines (Smarter routing, card 6dcaee98)", () => {
  test("no CTAs: body ships alone, exactly like the old ctaUrl=null case", () => {
    const { posts, manualComment } = buildPosts("body text", [], "inline", 280);
    assert.deepEqual(posts, [{ text: "body text" }]);
    assert.equal(manualComment, null);
  });

  test("a single CTA renders identically to the old single url/label contract", () => {
    const { posts } = buildPosts(
      "body text",
      [{ url: "https://example.com/essay", label: "Full essay:" }],
      "inline",
      280
    );
    assert.equal(posts[0].text, "body text\n\nFull essay: https://example.com/essay");
  });

  test("2+ CTAs stack as separate lines with a blank line between each, inline placement", () => {
    const { posts } = buildPosts(
      "body text",
      [
        { url: "https://example.com/essay", label: "Read full essay:" },
        { url: "https://example.com/project", label: "See related project:" },
      ],
      "inline",
      280
    );
    assert.equal(
      posts[0].text,
      "body text\n\nRead full essay: https://example.com/essay\n\nSee related project: https://example.com/project"
    );
  });

  test("2+ CTAs on X (reply placement): all stacked into the single reply post, blank line between", () => {
    const { posts } = buildPosts(
      "body text",
      [
        { url: "https://example.com/essay", label: "Read full essay:" },
        { url: "https://example.com/project", label: "See related project:" },
      ],
      "reply",
      280
    );
    assert.equal(posts.length, 2);
    assert.equal(
      posts[1].text,
      "Read full essay: https://example.com/essay\n\nSee related project: https://example.com/project"
    );
  });

  test("2+ CTAs on LinkedIn (comment placement): all stacked into the manual comment string", () => {
    const { manualComment } = buildPosts(
      "body text",
      [
        { url: "https://example.com/essay", label: "Read full essay:" },
        { url: "https://example.com/project", label: "See related project:" },
      ],
      "comment",
      280
    );
    assert.equal(
      manualComment,
      "Read full essay: https://example.com/essay\n\nSee related project: https://example.com/project"
    );
  });

  test("inline placement overflow still spills the (now multi-line) CTA block into a second post", () => {
    const longBody = "x".repeat(270);
    const { posts } = buildPosts(
      longBody,
      [{ url: "https://example.com/essay", label: "Read full essay:" }],
      "inline",
      280
    );
    assert.equal(posts.length, 2, "combined body+cta exceeds max, so it must split like the single-CTA case did");
    assert.equal(posts[1].text, "Read full essay: https://example.com/essay");
  });

  test("reply placement: 2+ stacked CTAs that alone overflow max split into one reply post per CTA", () => {
    const longLabel = "x".repeat(200);
    const { posts } = buildPosts(
      "body text",
      [
        { url: "https://example.com/essay", label: longLabel },
        { url: "https://example.com/project", label: longLabel },
      ],
      "reply",
      280
    );
    assert.equal(posts.length, 3, "body + one reply post per CTA, never a truncated combined block");
    assert.equal(posts[1].text, `${longLabel} https://example.com/essay`);
    assert.equal(posts[2].text, `${longLabel} https://example.com/project`);
  });

  test("inline placement: 2+ stacked CTAs that alone overflow max split into one reply post per CTA", () => {
    const longLabel = "x".repeat(200);
    const { posts } = buildPosts(
      "body text",
      [
        { url: "https://example.com/essay", label: longLabel },
        { url: "https://example.com/project", label: longLabel },
      ],
      "inline",
      280
    );
    assert.equal(posts.length, 3, "body + one reply post per CTA, never a truncated combined block");
    assert.equal(posts[1].text, `${longLabel} https://example.com/essay`);
    assert.equal(posts[2].text, `${longLabel} https://example.com/project`);
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

  test("stops at the page cap and throws instead of looping forever or returning a truncated list", async () => {
    process.env.TYPEFULLY_API_KEY = "test-key";
    process.env.TYPEFULLY_SOCIAL_SET_ID = "test-set";
    // 600 drafts, always claiming a next page — a pathological account state.
    const allDrafts = Array.from({ length: 600 }, (_, i) => draft(i + 1, i));
    const { calls } = stubPagedFetch(allDrafts);

    await assert.rejects(
      () => fetchScheduledDrafts(),
      /page cap/,
      "a truncated list must surface as a failure (caller treats the source as unreachable), not a silently-partial success"
    );
    assert.equal(calls.length, 10, "must stop issuing requests once the page cap is hit");
  });

  test("a non-final page returning fewer than the limit still advances past it, not just full pages", async () => {
    process.env.TYPEFULLY_API_KEY = "test-key";
    process.env.TYPEFULLY_SOCIAL_SET_ID = "test-set";
    // Page 1 returns a SHORT page (30 items, not the full 50) while still claiming a next page —
    // offset must advance by what actually came back (30), not by the fixed page limit (50), or
    // items 31-49 would be silently skipped forever.
    const allDrafts = Array.from({ length: 80 }, (_, i) => draft(i + 1, i));
    const calls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      calls.push(url.toString());
      const offset = Number(url.searchParams.get("offset") ?? "0");
      const page = offset === 0 ? allDrafts.slice(0, 30) : allDrafts.slice(offset);
      const next = offset === 0 ? "https://api.typefully.com/v2/next-page" : null;
      return new Response(JSON.stringify({ results: page, next }), { status: 200 });
    }) as typeof fetch;

    const scheduled = await fetchScheduledDrafts();

    assert.equal(scheduled.length, 80, "every draft must be returned, including those after a short non-final page");
    assert.ok(scheduled.some((d) => d.id === "31"), "item 31 (right after the short page) must not be skipped");
  });
});
