import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scheduleToTikTok } from "./tiktok.js";

// Card 1829fdf9 (2026-07-08) rewired quote-card image posts (x/linkedin/bluesky) off PostPeer/
// Upload-Post onto native Typefully drafts, but explicitly keeps PostPeer for TikTok — a genuinely
// different, video-only relay with audited Content Posting API access (docs/codebase-review.md
// Part 1 §7). tiktok.ts shares no code with cards.ts, so this is a straight regression test proving
// the TikTok path still calls PostPeer, unmodified. Fetch is mocked; no real network call is made.
describe("scheduleToTikTok: still calls PostPeer, unchanged by the cards.ts Typefully rewire", () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.POSTPEER_API_KEY;
  const originalAccountId = process.env.POSTPEER_TIKTOK_ACCOUNT_ID;
  const dirs: string[] = [];

  after(() => {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.POSTPEER_API_KEY;
    else process.env.POSTPEER_API_KEY = originalKey;
    if (originalAccountId === undefined) delete process.env.POSTPEER_TIKTOK_ACCOUNT_ID;
    else process.env.POSTPEER_TIKTOK_ACCOUNT_ID = originalAccountId;
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  test("uploads the short + posts to postpeer.dev with platform 'tiktok', never api.typefully.com", async () => {
    process.env.POSTPEER_API_KEY = "test-postpeer-key";
    const calls: { method: string; url: string; body?: unknown }[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      calls.push({ method, url, body });
      if (url.includes("api.typefully.com")) {
        throw new Error(`unexpected call to Typefully from the TikTok path: ${method} ${url}`);
      }
      if (url === "https://api.postpeer.dev/v1/media/upload") {
        return new Response(
          JSON.stringify({ uploadUrl: "https://s3.example.com/upload", publicUrl: "https://cdn.example.com/short.mp4" }),
          { status: 200 }
        );
      }
      if (url === "https://s3.example.com/upload") {
        return new Response(null, { status: 200 });
      }
      if (url === "https://api.postpeer.dev/v1/posts") {
        return new Response(JSON.stringify({ postId: "tiktok-post-1" }), { status: 200 });
      }
      throw new Error(`unexpected fetch in test: ${method} ${url}`);
    }) as typeof fetch;

    const dir = mkdtempSync(join(tmpdir(), "tiktok-test-"));
    dirs.push(dir);
    const videoPath = join(dir, "short.mp4");
    writeFileSync(videoPath, "not a real mp4, just fixture bytes");
    process.env.POSTPEER_TIKTOK_ACCOUNT_ID = "acct-1";

    const ref = await scheduleToTikTok(videoPath, "a test caption", "2099-01-01T18:00:00.000Z");

    assert.equal(ref, "postpeer post tiktok-post-1");
    const postCall = calls.find((c) => c.url === "https://api.postpeer.dev/v1/posts");
    assert.ok(postCall, "must POST to PostPeer's /posts endpoint");
    const postBody = postCall!.body as { platforms: { platform: string; accountId: string }[] };
    assert.deepEqual(postBody.platforms, [{ platform: "tiktok", accountId: "acct-1" }]);
    assert.ok(!calls.some((c) => c.url.includes("api.typefully.com")), "TikTok must never call Typefully");
  });
});
