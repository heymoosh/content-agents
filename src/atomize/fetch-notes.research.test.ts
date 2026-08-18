import { test, after } from "node:test";
import assert from "node:assert/strict";
import { fetchSubstackNotes } from "./fetch-notes.js";

const originalFetch = globalThis.fetch;

after(() => {
  globalThis.fetch = originalFetch;
});

function ownNote(id: number) {
  return {
    type: "comment",
    context: { type: "note" },
    entity_key: `c-${id}`,
    comment: {
      id,
      user_id: 42,
      body: `note ${id}`,
      date: "2026-08-01T00:00:00.000Z",
      ancestor_path: "",
      post_id: null,
      restacked: false,
      reaction_count: 1,
      restacks: 2,
      children_count: 0,
    },
  };
}

test("research backfill can enumerate beyond the legacy 25-page feed cap", async () => {
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("public_profile")) return new Response(JSON.stringify({ id: 42, handle: "muxin" }));
    const cursor = new URL(url).searchParams.get("cursor");
    const page = cursor ? Number(cursor.split("-")[1]) + 1 : 1;
    return new Response(
      JSON.stringify({
        items: [ownNote(page)],
        nextCursor: page < 26 ? `cursor-${page}` : undefined,
      })
    );
  }) as typeof fetch;

  const notes = await fetchSubstackNotes("@muxin", { limit: 1000, maxPages: Number.POSITIVE_INFINITY });

  assert.equal(notes.length, 26);
  assert.equal(calls.filter((url) => url.includes("reader/feed/profile")).length, 26);
});
