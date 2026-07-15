import { test, after } from "node:test";
import assert from "node:assert/strict";
import { fetchScheduledPosts, cancelPost } from "./postpeer-status.js";

// fetchScheduledPosts is a thin, read-only GET /v1/posts client (PostPeer publishes no dedicated
// "list scheduled" endpoint — src/publish/queue-view.ts already hits this same endpoint with the
// same defensive parsing). Every test below stubs global fetch — NEVER a real network call.

const originalFetch = globalThis.fetch;
const originalKey = process.env.POSTPEER_API_KEY;
after(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.POSTPEER_API_KEY;
  else process.env.POSTPEER_API_KEY = originalKey;
});

function stubFetch(status: number, body: unknown): void {
  globalThis.fetch = (async () =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status })) as typeof fetch;
}

test("fetchScheduledPosts throws when POSTPEER_API_KEY is missing (never calls fetch)", async () => {
  delete process.env.POSTPEER_API_KEY;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    throw new Error("should not be called");
  }) as typeof fetch;
  await assert.rejects(() => fetchScheduledPosts(), /POSTPEER_API_KEY missing/);
  assert.equal(called, false);
});

test("fetchScheduledPosts parses a bare array response", async () => {
  process.env.POSTPEER_API_KEY = "test-key";
  stubFetch(200, [{ id: "111", scheduledFor: "2026-07-05T00:00:00.000Z", status: "scheduled", content: "hi" }]);
  const posts = await fetchScheduledPosts();
  assert.deepEqual(posts, [{ id: "111", scheduledFor: "2026-07-05T00:00:00.000Z", status: "scheduled", content: "hi" }]);
});

test("fetchScheduledPosts unwraps { posts: [...] } / { data: [...] } shapes", async () => {
  process.env.POSTPEER_API_KEY = "test-key";
  stubFetch(200, { posts: [{ id: "222" }] });
  assert.deepEqual(await fetchScheduledPosts(), [{ id: "222", scheduledFor: undefined, status: undefined, content: undefined }]);

  stubFetch(200, { data: [{ postId: "333" }] });
  assert.deepEqual(await fetchScheduledPosts(), [{ id: "333", scheduledFor: undefined, status: undefined, content: undefined }]);
});

test("fetchScheduledPosts drops entries with no id at all", async () => {
  process.env.POSTPEER_API_KEY = "test-key";
  stubFetch(200, [{ scheduledFor: "2026-07-05T00:00:00.000Z" }, { id: "444" }]);
  const posts = await fetchScheduledPosts();
  assert.equal(posts.length, 1);
  assert.equal(posts[0].id, "444");
});

test("fetchScheduledPosts throws with the status + body on a non-ok response", async () => {
  process.env.POSTPEER_API_KEY = "test-key";
  stubFetch(401, "unauthorized");
  await assert.rejects(() => fetchScheduledPosts(), /401/);
});

test("fetchScheduledPosts survives a transient 503 via fetchWithRetry (real call site, not the helper's own unit tests)", async () => {
  process.env.POSTPEER_API_KEY = "test-key";
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    if (calls < 2) return new Response("service unavailable", { status: 503 });
    return new Response(JSON.stringify([{ id: "999" }]), { status: 200 });
  }) as typeof fetch;
  const posts = await fetchScheduledPosts({ sleep: async () => {} });
  assert.equal(calls, 2, "should have retried once after the transient 503");
  assert.deepEqual(posts, [{ id: "999", scheduledFor: undefined, status: undefined, content: undefined }]);
});

// cancelPost: the review GUI's "Cancel" action (card e4eca4a1) — DELETEs a scheduled PostPeer post
// by id. Endpoint shape is INFERRED from the same GET /v1/posts convention (no official PostPeer
// docs cover delete) — these tests only prove this module's own request/response handling, not that
// the real PostPeer API matches.
test("cancelPost sends a DELETE to /posts/{id} with the x-access-key header", async () => {
  process.env.POSTPEER_API_KEY = "test-key";
  let seenUrl = "";
  let seenInit: RequestInit | undefined;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seenUrl = String(input);
    seenInit = init;
    return new Response(null, { status: 200 });
  }) as typeof fetch;
  await cancelPost("post-123");
  assert.equal(seenUrl, "https://api.postpeer.dev/v1/posts/post-123");
  assert.equal(seenInit?.method, "DELETE");
  assert.equal((seenInit?.headers as Record<string, string>)["x-access-key"], "test-key");
});

test("cancelPost treats a 404 (already gone) as success, not an error", async () => {
  process.env.POSTPEER_API_KEY = "test-key";
  stubFetch(404, "not found");
  await cancelPost("post-already-gone"); // must not throw
});

test("cancelPost throws with the status + body on a real failure", async () => {
  process.env.POSTPEER_API_KEY = "test-key";
  stubFetch(500, "server exploded");
  await assert.rejects(() => cancelPost("post-123"), /500/);
});

test("cancelPost throws when POSTPEER_API_KEY is missing (never calls fetch)", async () => {
  delete process.env.POSTPEER_API_KEY;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    throw new Error("should not be called");
  }) as typeof fetch;
  await assert.rejects(() => cancelPost("post-123"), /POSTPEER_API_KEY missing/);
  assert.equal(called, false);
});
