/**
 * Unit tests for src/publish/youtube.ts listScheduledUploads() pagination. The YouTube Data API's
 * playlistItems endpoint pages via nextPageToken (maxResults=25/page) — before this fix, only the
 * first page was ever fetched, so a channel with more than 25 scheduled Shorts had real live
 * uploads invisible to reconcile(), which could misreport them as orphaned ledger claims and let
 * `queue -- --sync` release a slot that was actually still live. Every test stubs global fetch —
 * NEVER a real network call.
 */

import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { listScheduledUploads } from "./youtube.js";

const ENV_KEYS = ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN"] as const;
const UPLOADS_PLAYLIST = "UUtest";

describe("youtube listScheduledUploads: pagination", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv: Record<string, string | undefined> = {};
  for (const k of ENV_KEYS) originalEnv[k] = process.env[k];

  after(() => {
    globalThis.fetch = originalFetch;
    for (const k of ENV_KEYS) {
      if (originalEnv[k] === undefined) delete process.env[k];
      else process.env[k] = originalEnv[k];
    }
  });

  function setEnv(): void {
    process.env.YOUTUBE_CLIENT_ID = "test-client";
    process.env.YOUTUBE_CLIENT_SECRET = "test-secret";
    process.env.YOUTUBE_REFRESH_TOKEN = "test-refresh";
  }

  function videoStub(videoId: string, minutesFromNow: number) {
    return {
      id: videoId,
      status: { publishAt: new Date(Date.now() + minutesFromNow * 60_000).toISOString(), privacyStatus: "private" },
      snippet: { title: `title-${videoId}` },
    };
  }

  // Routes the calls listScheduledUploads makes: token refresh, channels lookup, paginated
  // playlistItems (using the offset encoded in the opaque pageToken), and (possibly batched)
  // videos lookup.
  function stubYouTube(allVideoIds: string[]): { playlistCalls: string[]; videosCalls: string[] } {
    const playlistCalls: string[] = [];
    const videosCalls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "test-token" }), { status: 200 });
      }
      if (url.includes("/channels")) {
        return new Response(
          JSON.stringify({ items: [{ contentDetails: { relatedPlaylists: { uploads: UPLOADS_PLAYLIST } } }] }),
          { status: 200 }
        );
      }
      if (url.includes("/playlistItems")) {
        playlistCalls.push(url);
        const u = new URL(url);
        const maxResults = Number(u.searchParams.get("maxResults") ?? "25");
        const offset = Number(u.searchParams.get("pageToken") ?? "0");
        const pageIds = allVideoIds.slice(offset, offset + maxResults);
        const nextPageToken = offset + maxResults < allVideoIds.length ? String(offset + maxResults) : undefined;
        return new Response(
          JSON.stringify({
            items: pageIds.map((id) => ({ contentDetails: { videoId: id } })),
            ...(nextPageToken ? { nextPageToken } : {}),
          }),
          { status: 200 }
        );
      }
      if (url.includes("/videos")) {
        videosCalls.push(url);
        const u = new URL(url);
        const ids = (u.searchParams.get("id") ?? "").split(",").filter(Boolean);
        return new Response(JSON.stringify({ items: ids.map((id, i) => videoStub(id, i + 1)) }), { status: 200 });
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as typeof fetch;
    return { playlistCalls, videosCalls };
  }

  test("pages through ALL scheduled uploads, not just the first 25", async () => {
    setEnv();
    const allVideoIds = Array.from({ length: 26 }, (_, i) => `vid-${i + 1}`);
    const { playlistCalls, videosCalls } = stubYouTube(allVideoIds);

    const uploads = await listScheduledUploads();

    assert.equal(uploads.length, 26, "must return uploads from every playlist page, not just the first 25");
    assert.ok(
      uploads.some((u) => u.videoId === "vid-26"),
      "a video beyond the old 25-item limit must be present"
    );
    assert.equal(playlistCalls.length, 2, "should have fetched exactly 2 playlistItems pages (25 + 1)");
    assert.equal(videosCalls.length, 1, "26 ids fit in a single videos.list batch (<=50)");
  });

  test("batches the videos.list lookup when more than 50 ids are collected", async () => {
    setEnv();
    const allVideoIds = Array.from({ length: 60 }, (_, i) => `vid-${i + 1}`);
    const { videosCalls } = stubYouTube(allVideoIds);

    const uploads = await listScheduledUploads();

    assert.equal(uploads.length, 60);
    assert.equal(videosCalls.length, 2, "60 ids must be split into two videos.list batches of <=50");
  });

  test("stops at the page cap and warns instead of looping forever", async () => {
    setEnv();
    // 300 videos, always claiming another page — a pathological channel.
    const allVideoIds = Array.from({ length: 300 }, (_, i) => `vid-${i + 1}`);
    const { playlistCalls } = stubYouTube(allVideoIds);
    const warnCalls: unknown[][] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => warnCalls.push(args);
    try {
      const uploads = await listScheduledUploads();
      assert.equal(uploads.length, 250, "must stop at the 10-page cap (10 x 25), not fetch forever");
      assert.equal(playlistCalls.length, 10, "must stop issuing requests once the page cap is hit");
      assert.equal(warnCalls.length, 1, "must warn once when the cap is hit");
      assert.match(String(warnCalls[0][0]), /page cap/);
    } finally {
      console.warn = originalWarn;
    }
  });
});
