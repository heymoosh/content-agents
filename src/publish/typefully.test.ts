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

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildDraftPayload } from "./typefully.js";

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
