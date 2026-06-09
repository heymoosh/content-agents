import { openDb } from "../db/db.js";

// Topic resonance map: pillar × platform. Requires posts to be tagged first.
//   tsx src/strategy/resonance.ts

const PILLARS = ["human-ai", "claude-code", "civic-tech", "other"];

function main() {
  const db = openDb();
  const rows = db
    .prepare(
      `SELECT p.platform, p.pillar,
              COUNT(*) AS n,
              AVG(COALESCE(m.likes,0) + 3*COALESCE(m.replies,0) + 2*COALESCE(m.reposts,0)) AS avg_eng,
              AVG(m.impressions) AS avg_imp,
              SUM(COALESCE(m.replies,0)) AS replies
       FROM posts p
       JOIN (
         SELECT m.* FROM metrics m
         JOIN (SELECT post_id, MAX(captured_at) AS mc FROM metrics GROUP BY post_id) lm
           ON m.post_id = lm.post_id AND m.captured_at = lm.mc
       ) m ON m.post_id = p.id
       WHERE p.pillar IS NOT NULL
       GROUP BY p.platform, p.pillar`
    )
    .all() as {
    platform: string;
    pillar: string;
    n: number;
    avg_eng: number;
    avg_imp: number | null;
    replies: number;
  }[];

  if (rows.length === 0) {
    console.log("No tagged posts with metrics yet. Tag posts first (snapshot --untagged → tag-posts).");
    db.close();
    return;
  }

  const platforms = [...new Set(rows.map((r) => r.platform))].sort();
  console.log(`# Topic resonance map — ${new Date().toISOString().slice(0, 10)}\n`);
  console.log(`Cell = avg engagement score (replies ×3, reposts ×2, likes ×1) · n posts · total replies\n`);
  console.log(`| Pillar | ${platforms.join(" | ")} |`);
  console.log(`|---|${platforms.map(() => "---").join("|")}|`);
  for (const pillar of PILLARS) {
    const cells = platforms.map((pl) => {
      const r = rows.find((x) => x.platform === pl && x.pillar === pillar);
      return r ? `${r.avg_eng.toFixed(1)} · n=${r.n} · ${r.replies}r` : "—";
    });
    console.log(`| ${pillar} | ${cells.join(" | ")} |`);
  }
  console.log(
    `\n> Cells with n<3 are anecdotes, not patterns. Cross-check with the data-confidence table in the snapshot.`
  );
  db.close();
}

main();
