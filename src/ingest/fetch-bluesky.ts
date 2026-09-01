import "../util/env.js";
import { AtpAgent } from "@atproto/api";
import { openDb } from "../db/db.js";
import { validateMeasurementBinding } from "../identity/brand.js";

// Fetch own posts + engagement from Bluesky (free AT Protocol API).
// Needs BLUESKY_HANDLE and BLUESKY_APP_PASSWORD in .env.
async function main() {
  const handle = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_APP_PASSWORD;
  if (!handle || !password) {
    console.error("Set BLUESKY_HANDLE and BLUESKY_APP_PASSWORD in the repository .env.");
    process.exit(1);
  }

  const agent = new AtpAgent({ service: "https://bsky.social" });
  await agent.login({ identifier: handle, password });
  const identity = validateMeasurementBinding({
    brandId: "human-inference",
    providerAccountId: `atproto:${agent.session?.did ?? handle}`,
  });

  const db = openDb();
  const now = new Date().toISOString();
  const upsertPost = db.prepare(`
    INSERT INTO posts (platform, platform_post_id, posted_at, url, content_text, format, media_type, brand_id, provider_account_id)
    VALUES ('bluesky', ?, ?, ?, ?, 'text', 'text', ?, ?)
    ON CONFLICT(platform, platform_post_id) DO UPDATE SET
      content_text = excluded.content_text,
      media_type = COALESCE(posts.media_type, excluded.media_type),
      brand_id = COALESCE(posts.brand_id, excluded.brand_id),
      provider_account_id = COALESCE(posts.provider_account_id, excluded.provider_account_id)
    WHERE (posts.brand_id IS NULL OR posts.brand_id = excluded.brand_id)
      AND (posts.provider_account_id IS NULL OR posts.provider_account_id = excluded.provider_account_id)
    RETURNING id
  `);
  const insertMetrics = db.prepare(`
    INSERT INTO metrics (post_id, captured_at, impressions, likes, replies, reposts, clicks, new_follows, engagement_rate, raw_json, brand_id, provider_account_id)
    VALUES (?, ?, NULL, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?)
  `);
  const insertAudience = db.prepare(`
    INSERT OR IGNORE INTO audience (platform, captured_at, as_of_date, metric_type, dimension, value_label, value_count, value_pct, source_file, raw_json, brand_id, provider_account_id)
    VALUES ('bluesky', ?, NULL, 'follower_total', NULL, NULL, ?, NULL, 'atproto:getProfile', ?, ?, ?)
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
      const stored = upsertPost.get(
        post.uri,
        record.createdAt ?? null,
        url,
        record.text ?? null, identity.brandId, identity.providerAccountId
      ) as { id: number } | undefined;
      if (!stored) throw new Error(`identity conflict for bluesky/${post.uri}`);
      const { id } = stored;
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
        }), identity.brandId, identity.providerAccountId
      );
      count++;
    }
    cursor = res.data.cursor;
  } while (cursor);

  // Audience snapshot: follower count is a point-in-time value, so repeated runs build a growth
  // series via captured_at. Bluesky/AT Protocol exposes no follower demographics.
  try {
    const prof = await agent.getProfile({ actor: handle });
    insertAudience.run(
      now,
      prof.data.followersCount ?? null,
      JSON.stringify({
        followersCount: prof.data.followersCount,
        followsCount: prof.data.followsCount,
        postsCount: prof.data.postsCount,
      }), identity.brandId, identity.providerAccountId
    );
    console.log(`bluesky: follower_total snapshot = ${prof.data.followersCount ?? "?"}`);
  } catch (e) {
    console.error(`bluesky: profile snapshot failed — ${e instanceof Error ? e.message : e}`);
  }

  console.log(`bluesky: captured metrics for ${count} posts`);
  db.close();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
