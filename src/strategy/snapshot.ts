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
  media_type: string | null;
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

const WEEK_MS = 7 * 24 * 3600 * 1000;
const HALF_LIFE_WEEKS = 4; // anti-fossilization: a win 4 weeks old counts half as much today

// Recency-decayed engagement: same score, weighted by how recent the post is, so stale wins
// visibly fade and the brief can't keep leaning on what worked months ago.
function recencyWeightedEngagement(p: PostStat, now: number): number {
  if (!p.posted_at) return engagement(p);
  const ageWeeks = Math.max(0, (now - new Date(p.posted_at).getTime()) / WEEK_MS);
  return engagement(p) * 0.5 ** (ageWeeks / HALF_LIFE_WEEKS);
}

function main() {
  const db = openDb();
  const posts = db
    .prepare(
      `SELECT p.id, p.platform, p.posted_at, p.url, p.content_text, p.pillar, p.media_type,
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
    console.log(`Top posts by engagement (replies ×3, reposts ×2, likes ×1; RcEng = recency-weighted, ${HALF_LIFE_WEEKS}-wk half-life):\n`);
    console.log(`| Eng | RcEng | Imp | Likes | Re | RT | Pillar | Post |`);
    console.log(`|---|---|---|---|---|---|---|---|`);
    for (const p of top) {
      const text = (p.content_text ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, 80);
      console.log(
        `| ${engagement(p)} | ${recencyWeightedEngagement(p, now).toFixed(1)} | ${p.impressions ?? "-"} | ${p.likes ?? "-"} | ${p.replies ?? "-"} | ${
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

  // Media-type x platform engagement breakdown — shows which content formats drive engagement per channel.
  const withType = posts.filter((p) => p.media_type && p.media_type !== "unknown");
  if (withType.length > 0) {
    console.log(`\n## Format breakdown (platform × media type)\n`);
    console.log(
      `Cell = posts | avg engagement (replies ×3, reposts ×2, likes ×1) | avg impressions\n`
    );
    const mediaTypes = [...new Set(withType.map((p) => p.media_type!))].sort();
    console.log(`| Platform | ${mediaTypes.join(" | ")} |`);
    console.log(`|---|${mediaTypes.map(() => "---").join("|")}|`);
    for (const pl of platforms) {
      const cell = (mt: string): string => {
        const group = withType.filter((p) => p.platform === pl && p.media_type === mt);
        if (group.length === 0) return "—";
        const withMetrics = group.filter((p) => p.impressions != null || p.likes != null);
        const avgEng =
          withMetrics.length > 0
            ? (withMetrics.reduce((s, p) => s + engagement(p), 0) / withMetrics.length).toFixed(1)
            : "—";
        const avgImp =
          withMetrics.length > 0
            ? Math.round(withMetrics.reduce((s, p) => s + (p.impressions ?? 0), 0) / withMetrics.length)
            : "—";
        return `n=${group.length} | eng ${avgEng} | imp ${avgImp}`;
      };
      console.log(`| ${pl} | ${mediaTypes.map((mt) => cell(mt)).join(" | ")} |`);
    }
    console.log(`\n> text = plain post; quote-card = image card from /atomize; video = short-form video; note = Substack Note`);
  }

  db.close();
}

main();
