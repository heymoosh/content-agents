import { openDb } from "../db/db.js";

// Channel performance snapshot from the latest metrics per post.
//   tsx src/strategy/snapshot.ts             → markdown report to stdout
//   tsx src/strategy/snapshot.ts --untagged  → JSON list of untagged posts (for Claude to tag)

const LATEST_METRICS = `
  SELECT m.* FROM metrics m
  JOIN (SELECT post_id, MAX(captured_at) AS mc FROM metrics GROUP BY post_id) lm
    ON m.post_id = lm.post_id AND m.captured_at = lm.mc
`;

interface PostStat {
  id: number;
  platform: string;
  posted_at: string | null;
  url: string | null;
  content_text: string | null;
  pillar: string | null;
  impressions: number | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
  clicks: number | null;
  new_follows: number | null;
}

function engagement(p: PostStat): number {
  return (p.likes ?? 0) + (p.replies ?? 0) * 3 + (p.reposts ?? 0) * 2;
  // replies weighted highest: real conversation > passive likes (per Build 0 goals)
}

function main() {
  const db = openDb();
  const posts = db
    .prepare(
      `SELECT p.id, p.platform, p.posted_at, p.url, p.content_text, p.pillar,
              m.impressions, m.likes, m.replies, m.reposts, m.clicks, m.new_follows
       FROM posts p LEFT JOIN (${LATEST_METRICS}) m ON m.post_id = p.id`
    )
    .all() as PostStat[];

  if (process.argv.includes("--untagged")) {
    const untagged = posts
      .filter((p) => p.pillar == null)
      .map((p) => ({
        id: p.id,
        platform: p.platform,
        text: (p.content_text ?? "").slice(0, 280),
      }));
    console.log(JSON.stringify(untagged, null, 2));
    db.close();
    return;
  }

  const platforms = [...new Set(posts.map((p) => p.platform))].sort();
  const now = Date.now();
  const WEEK = 7 * 24 * 3600 * 1000;

  console.log(`# Channel performance snapshot — ${new Date().toISOString().slice(0, 10)}\n`);

  console.log(`## Data confidence\n`);
  console.log(`| Channel | Posts | Weeks of data | Status |`);
  console.log(`|---|---|---|---|`);
  for (const pl of platforms) {
    const dates = posts
      .filter((p) => p.platform === pl && p.posted_at)
      .map((p) => new Date(p.posted_at!).getTime());
    const weeks = dates.length
      ? Math.max(1, Math.round((Math.min(now, Math.max(...dates)) - Math.min(...dates)) / WEEK))
      : 0;
    const status = weeks >= 4 ? "OK" : `INSUFFICIENT (<4 wks) — directional only`;
    console.log(`| ${pl} | ${dates.length} | ${weeks} | ${status} |`);
  }

  for (const pl of platforms) {
    const rows = posts.filter((p) => p.platform === pl);
    const withMetrics = rows.filter((p) => p.impressions != null || p.likes != null);
    const tot = (k: keyof PostStat) =>
      withMetrics.reduce((s, p) => s + ((p[k] as number | null) ?? 0), 0);
    console.log(`\n## ${pl} (${rows.length} posts)\n`);
    console.log(
      `Totals: impressions ${tot("impressions")}, likes ${tot("likes")}, replies ${tot(
        "replies"
      )}, reposts ${tot("reposts")}, clicks ${tot("clicks")}, new follows/subs ${tot("new_follows")}\n`
    );
    const top = [...withMetrics].sort((a, b) => engagement(b) - engagement(a)).slice(0, 5);
    console.log(`Top posts by engagement (replies ×3, reposts ×2, likes ×1):\n`);
    console.log(`| Eng | Imp | Likes | Re | RT | Pillar | Post |`);
    console.log(`|---|---|---|---|---|---|---|`);
    for (const p of top) {
      const text = (p.content_text ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, 80);
      console.log(
        `| ${engagement(p)} | ${p.impressions ?? "-"} | ${p.likes ?? "-"} | ${p.replies ?? "-"} | ${
          p.reposts ?? "-"
        } | ${p.pillar ?? "untagged"} | ${text}${p.url ? ` ([link](${p.url}))` : ""} |`
      );
    }
  }

  const untaggedCount = posts.filter((p) => p.pillar == null).length;
  if (untaggedCount > 0) {
    console.log(
      `\n> ⚠ ${untaggedCount} posts untagged — run \`npm run snapshot -- --untagged\`, assign pillars, write back with \`tsx src/db/tag-posts.ts\`.`
    );
  }
  db.close();
}

main();
