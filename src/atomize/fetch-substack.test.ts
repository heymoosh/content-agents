import { test, after } from "node:test";
import assert from "node:assert/strict";
import { fetchSubstackPost } from "./fetch-substack.js";

// fetchSubstackPost tries the publication's RSS feed first; when that fails (non-ok response,
// network error) or has no matching item, it falls back to generic Readability-based extraction
// of the raw page HTML. Every test stubs globalThis.fetch — no real network calls.

const originalFetch = globalThis.fetch;
after(() => {
  globalThis.fetch = originalFetch;
});

function textResponse(status: number, body: string): Response {
  return new Response(body, { status });
}

const FEED_XML = `<?xml version="1.0"?>
<rss><channel>
<item>
<title>A Real Substack Post</title>
<link>https://example.substack.com/p/a-real-post</link>
<pubDate>Mon, 01 Jun 2026 12:00:00 GMT</pubDate>
<content:encoded><![CDATA[<p>First paragraph.</p><p>Second paragraph.</p>]]></content:encoded>
</item>
</channel></rss>`;

const ARTICLE_HTML = `<!doctype html>
<html><head>
<title>Generic Article Title</title>
<meta property="article:published_time" content="2026-05-15T10:00:00.000Z">
</head><body>
<article>
<h1>Generic Article Title</h1>
<p>This is the first paragraph of a real article with enough text content for Readability to
consider it the main body rather than boilerplate chrome around the page layout.</p>
<p>This is the second paragraph, continuing the article with more substantive prose so the
extractor has a clear winning candidate node to select as the article body.</p>
</article>
</body></html>`;

test("existing RSS-feed-hit path still works (unchanged success case)", async () => {
  let calls = 0;
  globalThis.fetch = (async (url: string | URL) => {
    calls++;
    assert.equal(String(url), "https://example.substack.com/feed");
    return textResponse(200, FEED_XML);
  }) as typeof fetch;

  const post = await fetchSubstackPost("https://example.substack.com/p/a-real-post");
  assert.equal(post.title, "A Real Substack Post");
  assert.equal(post.url, "https://example.substack.com/p/a-real-post");
  assert.equal(post.publishedAt, new Date("Mon, 01 Jun 2026 12:00:00 GMT").toISOString());
  assert.equal(post.text, "First paragraph.\n\nSecond paragraph.");
  assert.equal(calls, 1, "only the feed should be fetched on a successful match");
});

test("feed fetch fails (404) -> falls back to generic extraction", async () => {
  const urlsFetched: string[] = [];
  globalThis.fetch = (async (url: string | URL) => {
    const u = String(url);
    urlsFetched.push(u);
    if (u === "https://example.com/feed") return textResponse(404, "not found");
    if (u === "https://example.com/blog/some-post") return textResponse(200, ARTICLE_HTML);
    throw new Error(`unexpected fetch: ${u}`);
  }) as typeof fetch;

  const post = await fetchSubstackPost("https://example.com/blog/some-post");
  assert.equal(post.title, "Generic Article Title");
  assert.match(post.text, /first paragraph of a real article/);
  assert.match(post.text, /second paragraph, continuing the article/);
  assert.equal(post.publishedAt, "2026-05-15T10:00:00.000Z");
  assert.deepEqual(urlsFetched, ["https://example.com/feed", "https://example.com/blog/some-post"]);
});

test("feed succeeds but no matching item -> falls back to generic extraction", async () => {
  const urlsFetched: string[] = [];
  globalThis.fetch = (async (url: string | URL) => {
    const u = String(url);
    urlsFetched.push(u);
    if (u === "https://example.com/feed") return textResponse(200, FEED_XML);
    if (u === "https://example.com/p/unlisted-post") return textResponse(200, ARTICLE_HTML);
    throw new Error(`unexpected fetch: ${u}`);
  }) as typeof fetch;

  const post = await fetchSubstackPost("https://example.com/p/unlisted-post");
  assert.equal(post.title, "Generic Article Title");
  assert.match(post.text, /first paragraph of a real article/);
  assert.deepEqual(urlsFetched, ["https://example.com/feed", "https://example.com/p/unlisted-post"]);
});

test("generic fallback also fails -> throws mentioning both attempts", async () => {
  globalThis.fetch = (async (url: string | URL) => {
    const u = String(url);
    if (u === "https://example.com/feed") return textResponse(404, "not found");
    if (u === "https://example.com/broken-page") return textResponse(500, "server error");
    throw new Error(`unexpected fetch: ${u}`);
  }) as typeof fetch;

  await assert.rejects(
    () => fetchSubstackPost("https://example.com/broken-page"),
    (err: Error) => {
      assert.match(err.message, /feed attempt/);
      assert.match(err.message, /generic fallback attempt/);
      assert.match(err.message, /404/);
      assert.match(err.message, /500/);
      return true;
    }
  );
});
