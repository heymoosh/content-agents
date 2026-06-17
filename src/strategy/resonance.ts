import { openDb } from "../db/db.js";

// Topic resonance map: pillar × platform. Requires posts to be tagged first.
//   tsx src/strategy/resonance.ts

const PILLARS = ["human-ai", "claude-code", "civic-tech", "career-work", "builder", "other"];
const WEEK_MS = 7 * 24 * 3600 * 1000;
const HALF_LIFE_WEEKS = 4; // matches snapshot.ts: a win 4 weeks old counts half as much today

interface Row {
  platform: string;
  pillar: string;
  posted_at: string | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
}

function main() {
  const db = openDb();
  const rows = db
    .prepare(
      `SELECT p.platform, p.pillar, p.posted_at,
              m.likes, m.replies, m.reposts
       FROM posts p
       JOIN (
         SELECT m.* FROM metrics m
         JOIN (SELECT post_id, MAX(captured_at) AS mc FROM metrics GROUP BY post_id) lm
           ON m.post_id = lm.post_id AND m.captured_at = lm.mc
       ) m ON m.post_id = p.id
       WHERE p.pillar IS NOT NULL`
    )
    .all() as Row[];
  db.close();

  if (rows.length === 0) {
    console.log("No tagged posts with metrics yet. Tag posts first (snapshot --untagged → tag-posts).");
    return;
  }

  const now = Date.now();
  const eng = (r: Row) => (r.likes ?? 0) + (r.replies ?? 0) * 3 + (r.reposts ?? 0) * 2;
  const weight = (r: Row) => {
    if (!r.posted_at) return 1;
    const ageWeeks = Math.max(0, (now - new Date(r.posted_at).getTime()) / WEEK_MS);
    return 0.5 ** (ageWeeks / HALF_LIFE_WEEKS);
  };

  const platforms = [...new Set(rows.map((r) => r.platform))].sort();
  const cell = (pl: string, pillar: string) => {
    const group = rows.filter((r) => r.platform === pl && r.pillar === pillar);
    if (group.length === 0) return "—";
    const avgEng = group.reduce((s, r) => s + eng(r), 0) / group.length;
    const wSum = group.reduce((s, r) => s + weight(r), 0);
    const rcEng = wSum > 0 ? group.reduce((s, r) => s + eng(r) * weight(r), 0) / wSum : 0;
    const replies = group.reduce((s, r) => s + (r.replies ?? 0), 0);
    return `${avgEng.toFixed(1)} (rc ${rcEng.toFixed(1)}) · n=${group.length} · ${replies}r`;
  };

  console.log(`# Topic resonance map — ${new Date().toISOString().slice(0, 10)}\n`);
  console.log(
    `Cell = avg engagement (replies ×3, reposts ×2, likes ×1) · rc = recency-weighted (${HALF_LIFE_WEEKS}-wk half-life) · n posts · total replies\n`
  );
  console.log(`| Pillar | ${platforms.join(" | ")} |`);
  console.log(`|---|${platforms.map(() => "---").join("|")}|`);
  for (const pillar of PILLARS) {
    console.log(`| ${pillar} | ${platforms.map((pl) => cell(pl, pillar)).join(" | ")} |`);
  }
  console.log(
    `\n> Cells with n<3 are anecdotes, not patterns. Where rc is far below the raw avg, the pillar's wins are aging out — discount it.`
  );
}

main();
