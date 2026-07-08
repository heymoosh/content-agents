import { test, after } from "node:test";
import assert from "node:assert/strict";
import { fetchScheduledPosts } from "./postpeer-status.js";

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
