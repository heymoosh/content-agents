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
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDraftPayload, buildPosts, fetchScheduledDrafts, cancelDraft, parseTypefullyCliInvocation, runTypefullyCli } from "./typefully.js";
import { readQueue, writeCell } from "./queue.js";
import { commitReviewStatus, journalPathForLedger, recordNewQueueRows } from "../review/approval-provenance.js";
import { appendPublishingStatus, readPublishingStatuses } from "../review/publishing-status.js";

const POSTS = [{ text: "Verbatim note text spread to a text channel." }];

test("the production Typefully CLI selects one approved text row for a fake-network private draft through the unified route", async () => {
  const root = mkdtempSync(join(tmpdir(), "slice-5u-typefully-cli-"));
  const folder = join(root, "piece");
  const statusPath = join(root, "publishing-status.jsonl");
  const slotPath = join(root, "slot-ledger.jsonl");
  const oldFetch = globalThis.fetch;
  const saved = Object.fromEntries([
    "TYPEFULLY_API_KEY", "TYPEFULLY_SOCIAL_SET_ID", "CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID",
    "CONTENT_AGENTS_TEST_BETS_PATH", "CONTENT_AGENTS_TEST_LEDGER",
  ].map((key) => [key, process.env[key]]));
  const requests: Array<{ url: string; method: string; payload: Record<string, unknown> }> = [];
  let preCallbackFence = false;
  try {
    mkdirSync(join(folder, "derivatives"), { recursive: true });
    writeFileSync(join(folder, "content-request.json"), JSON.stringify({ origin: "human-inference" }));
    writeFileSync(join(folder, "derivatives", "x-1.md"), "---\nplatform: x\n---\n\nFirst approved fixture body.\n");
    writeFileSync(join(folder, "derivatives", "x-2.md"), "---\nplatform: x\n---\n\nSecond approved fixture body.\n");
    writeFileSync(join(folder, "derivatives", "x-legacy.md"), "---\nplatform: x\n---\n\nKnown-safe legacy retry fixture body.\n");
    writeFileSync(join(folder, "review-queue.md"), "| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |\n|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|\n| x-1 | x | text | derivatives/x-1.md | — | — | — | pending | | fixture |\n| x-2 | x | text | derivatives/x-2.md | — | — | — | pending | | fixture |\n| x-legacy | x | text | derivatives/x-legacy.md | — | — | — | approve | | fixture |\n| x-pending | x | text | derivatives/x-1.md | — | — | — | pending | | fixture |\n| card-1 | quote-card:x | image | derivatives/x-1.md | — | — | — | approve | | fixture |\n");
    const journal = journalPathForLedger(statusPath);
    recordNewQueueRows(folder, readQueue(folder).rows.filter((row) => row.id === "x-1" || row.id === "x-2"), journal);
    assert.equal(commitReviewStatus(folder, "piece", "x-1", "approve", () => writeCell(folder, "x-1", { status: "approve" }), statusPath, journal), true);
    assert.equal(commitReviewStatus(folder, "piece", "x-2", "approve", () => writeCell(folder, "x-2", { status: "approve" }), statusPath, journal), true);
    // This is the 5P retry shape: the retained status proves its old attempt stopped before a
    // provider request. Its newer approval journal is intentionally not required for retry.
    appendPublishingStatus({ slug: "piece", rowId: "x-legacy", provider: "typefully", state: "failed", at: new Date().toISOString(), error: "provider selection failed before dispatch; no provider request was made" }, statusPath);
    process.env.TYPEFULLY_API_KEY = "fake-key";
    process.env.TYPEFULLY_SOCIAL_SET_ID = "fake-set";
    process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID = "human-inference/typefully";
    process.env.CONTENT_AGENTS_TEST_BETS_PATH = join(root, "bets.md");
    writeFileSync(slotPath, "");
    process.env.CONTENT_AGENTS_TEST_LEDGER = slotPath;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      preCallbackFence = readFileSync(journal, "utf8").includes("\"dispatch_started\"");
      requests.push({ url: String(input), method: init?.method ?? "GET", payload: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown> });
      return new Response(JSON.stringify({ id: `draft-fixture-${requests.length}` }), { status: 200 });
    }) as typeof fetch;

    await runTypefullyCli(["node", "src/publish/typefully.ts", folder, "--no-schedule", "--only-id", "x-1"], {}, { publishingStatusPath: statusPath });

    assert.deepEqual(parseTypefullyCliInvocation(["node", "src/publish/typefully.ts", folder, "--only-id", "x-1"], { TYPEFULLY_SCHEDULE: "off" }), { list: false, folderArg: folder, noSchedule: true, forceReuse: false, onlyId: "x-1" });
    assert.throws(() => parseTypefullyCliInvocation(["node", "src/publish/typefully.ts", folder, "--no-schedule"], { TYPEFULLY_SCHEDULE: "on" }), /conflicting scheduling intent/);
    assert.throws(() => parseTypefullyCliInvocation(["node", "src/publish/typefully.ts", folder, "--only-id"]), /requires one non-empty row id/);
    assert.throws(() => parseTypefullyCliInvocation(["node", "src/publish/typefully.ts", folder, "--only-id", "x-1", "--only-id", "x-2"]), /only once/);
    assert.throws(() => parseTypefullyCliInvocation(["node", "src/publish/typefully.ts", "--list", "--only-id", "x-1"]), /cannot be combined/);
    assert.equal(requests.length, 1, "the approved row creates exactly one draft request");
    assert.equal(requests[0]?.url, "https://api.typefully.com/v2/social-sets/fake-set/drafts");
    assert.equal(requests[0]?.method, "POST");
    assert.equal(requests[0]?.payload.draft_title, "x-1 (content-agents)", "the provider sees the exact selected row");
    assert.ok(!("publish_at" in requests[0]!.payload), "the actual request has no scheduled or next-free-slot value");
    assert.equal(readQueue(folder).rows[0]?.status, "approve", "saving a private draft must not mark the review row published");
    const outcome = readPublishingStatuses(statusPath)["piece/x-1"];
    assert.equal(outcome?.state, "private");
    assert.equal(outcome?.providerObjectId, "draft-fixture-1");
    assert.equal(outcome?.plannedFor, undefined);
    assert.equal(readFileSync(statusPath, "utf8").includes("draft-fixture-1"), true);
    assert.equal(readPublishingStatuses(statusPath)["piece/x-2"], undefined, "the other approved text row has no dispatch event");
    assert.equal(readFileSync(slotPath, "utf8"), "", "draft mode leaves the automatic slot ledger untouched");

    await assert.rejects(
      () => runTypefullyCli(["node", "src/publish/typefully.ts", folder, "--no-schedule", "--only-id", "x-1"], {}, { publishingStatusPath: statusPath }),
      /already has a private publishing attempt|reconcile/i,
      "a private selected attempt must never create a duplicate draft",
    );
    assert.equal(requests.length, 1, "the duplicate selected private attempt has zero provider effects");

    for (const [id, expected] of [["missing", /does not name a queue row/], ["x-pending", /not approved/], ["card-1", /not a text row/]] as const) {
      await assert.rejects(
        () => runTypefullyCli(["node", "src/publish/typefully.ts", folder, "--no-schedule", "--only-id", id], {}, { publishingStatusPath: statusPath }),
        expected,
        `${id} must be rejected before provider selection`,
      );
    }
    assert.equal(requests.length, 1, "invalid selected rows have zero provider effects");

    await runTypefullyCli(["node", "src/publish/typefully.ts", folder, "--no-schedule", "--only-id", "x-legacy"], {}, { publishingStatusPath: statusPath });
    assert.equal(requests.length, 2, "the known-safe failed pre-dispatch retry creates once");
    assert.equal(requests[1]?.payload.draft_title, "x-legacy (content-agents)");
    const dispatchRows = readFileSync(journal, "utf8").split("\n").filter(Boolean)
      .map((line) => JSON.parse(line) as { kind?: string; rowId?: string })
      .filter((event) => event.kind === "dispatch_started").map((event) => event.rowId);
    assert.deepEqual(dispatchRows, ["x-1"], "unselected x-2 and the known-safe legacy retry do not create a fresh dispatch fence");

    const evidencePath = process.env.SLICE_5U_EVIDENCE_PATH ?? process.env.SLICE_5T_EVIDENCE_PATH;
    if (evidencePath) {
      writeFileSync(evidencePath, JSON.stringify({
        command: "node --import tsx --test --test-concurrency=1 src/publish/typefully.test.ts",
        fakeNetworkCallbackCount: requests.length,
        preCallbackDispatchFence: preCallbackFence,
        selectedRequest: requests[0],
        legacyRetryRequest: requests[1],
        unselectedDispatchRows: dispatchRows,
        publishingResult: { state: outcome?.state, providerObjectId: outcome?.providerObjectId, plannedFor: outcome?.plannedFor },
        slotLedgerBefore: "",
        slotLedgerAfter: readFileSync(slotPath, "utf8"),
      }, null, 2) + "\n");
    }
  } finally {
    globalThis.fetch = oldFetch;
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    rmSync(root, { recursive: true, force: true });
  }
});

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

// cancelDraft: the review GUI's "Cancel" action (card e4eca4a1) — DELETEs a scheduled Typefully
// draft by id. Endpoint shape is INFERRED from the same /social-sets/{setId}/drafts REST convention
// every other call in this file uses (no official Typefully docs cover delete) — these tests only
// prove this module's own request/response handling, not that the real Typefully API matches.
describe("cancelDraft", () => {
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

  test("sends a DELETE to /social-sets/{setId}/drafts/{draftId} with bearer auth", async () => {
    process.env.TYPEFULLY_API_KEY = "test-key";
    process.env.TYPEFULLY_SOCIAL_SET_ID = "test-set";
    let seenUrl = "";
    let seenInit: RequestInit | undefined;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seenUrl = String(input);
      seenInit = init;
      return new Response(null, { status: 204 });
    }) as typeof fetch;
    await cancelDraft("draft-123");
    assert.equal(seenUrl, "https://api.typefully.com/v2/social-sets/test-set/drafts/draft-123");
    assert.equal(seenInit?.method, "DELETE");
    assert.equal((seenInit?.headers as Record<string, string>).authorization, "Bearer test-key");
  });

  test("treats a 404 (already gone) as success, not an error", async () => {
    process.env.TYPEFULLY_API_KEY = "test-key";
    process.env.TYPEFULLY_SOCIAL_SET_ID = "test-set";
    globalThis.fetch = (async () => new Response("not found", { status: 404 })) as typeof fetch;
    await cancelDraft("draft-already-gone"); // must not throw
  });

  test("throws with the status + body on a real failure", async () => {
    process.env.TYPEFULLY_API_KEY = "test-key";
    process.env.TYPEFULLY_SOCIAL_SET_ID = "test-set";
    globalThis.fetch = (async () => new Response("server exploded", { status: 500 })) as typeof fetch;
    await assert.rejects(() => cancelDraft("draft-123"), /500/);
  });

  test("throws when TYPEFULLY_API_KEY is missing (never calls fetch)", async () => {
    delete process.env.TYPEFULLY_API_KEY;
    process.env.TYPEFULLY_SOCIAL_SET_ID = "test-set";
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      throw new Error("should not be called");
    }) as typeof fetch;
    await assert.rejects(() => cancelDraft("draft-123"), /TYPEFULLY_API_KEY missing/);
    assert.equal(called, false);
  });
});
