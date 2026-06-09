import "../util/env.js";
import { AtpAgent } from "@atproto/api";
import { openDb } from "../db/db.js";

// Fetch own posts + engagement from Bluesky (free AT Protocol API).
// Needs BLUESKY_HANDLE and BLUESKY_APP_PASSWORD in .env.
async function main() {
  const handle = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_APP_PASSWORD;
  if (!handle || !password) {
    console.error("Set BLUESKY_HANDLE and BLUESKY_APP_PASSWORD in .env (see .env.example).");
    process.exit(1);
  }

  const agent = new AtpAgent({ service: "https://bsky.social" });
  await agent.login({ identifier: handle, password });

  const db = openDb();
  const now = new Date().toISOString();
  const upsertPost = db.prepare(`
    INSERT INTO posts (platform, platform_post_id, posted_at, url, content_text, format)
    VALUES ('bluesky', ?, ?, ?, ?, 'text')
    ON CONFLICT(platform, platform_post_id) DO UPDATE SET
      content_text = excluded.content_text
    RETURNING id
  `);
  const insertMetrics = db.prepare(`
    INSERT INTO metrics (post_id, captured_at, impressions, likes, replies, reposts, clicks, new_follows, engagement_rate, raw_json)
    VALUES (?, ?, NULL, ?, ?, ?, NULL, NULL, NULL, ?)
  `);

  let cursor: string | undefined;
  let count = 0;
  do {
    const res = await agent.getAuthorFeed({ actor: handle, limit: 100, cursor });
    for (const item of res.data.feed) {
      // skip reposts of others' content
      if (item.reason) continue;
      const post = item.post;
      const rkey = post.uri.split("/").pop()!;
      const record = post.record as { text?: string; createdAt?: string };
      const url = `https://bsky.app/profile/${handle}/post/${rkey}`;
      const { id } = upsertPost.get(
        post.uri,
        record.createdAt ?? null,
        url,
        record.text ?? null
      ) as { id: number };
      insertMetrics.run(
        id,
        now,
        post.likeCount ?? 0,
        post.replyCount ?? 0,
        post.repostCount ?? 0,
        JSON.stringify({
          likeCount: post.likeCount,
          replyCount: post.replyCount,
          repostCount: post.repostCount,
          quoteCount: post.quoteCount,
          indexedAt: post.indexedAt,
        })
      );
      count++;
    }
    cursor = res.data.cursor;
  } while (cursor);

  console.log(`bluesky: captured metrics for ${count} posts`);
  db.close();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
