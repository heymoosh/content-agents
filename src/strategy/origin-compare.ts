import { openDb } from "../db/db.js";

// Atomized-vs-organic traction: per platform, how do machine-distributed posts compare to ones
// Muxin posted natively (incl. Substack notes)? Reuses the snapshot.ts engagement score + recency
// weighting. This is OBSERVATIONAL — the content differs between groups, so a gap is a signal to
// look closer, not proof. Run after `npm run tag-source`.
//   npm run origin-compare

const WEEK_MS = 7 * 24 * 3600 * 1000;
const HALF_LIFE_WEEKS = 4; // matches snapshot.ts / resonance.ts

interface Row {
  platform: string;
  source: string | null;
  posted_at: string | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
}

function main() {
  const db = openDb();
  const rows = db
    .prepare(
      `SELECT p.platform, p.source, p.posted_at, m.likes, m.replies, m.reposts
       FROM posts p
       JOIN (
         SELECT m.* FROM metrics m
         JOIN (SELECT post_id, MAX(captured_at) AS mc FROM metrics GROUP BY post_id) lm
           ON m.post_id = lm.post_id AND m.captured_at = lm.mc
       ) m ON m.post_id = p.id
       WHERE p.source IS NOT NULL`
    )
    .all() as Row[];
  db.close();

  if (rows.length === 0) {
    console.log("No classified posts yet. Run `npm run tag-source` (and `npm run new-notes`) first.");
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
  const cell = (pl: string, src: string): string => {
    const group = rows.filter((r) => r.platform === pl && r.source === src);
    if (group.length === 0) return "—";
    const avgEng = group.reduce((s, r) => s + eng(r), 0) / group.length;
    const wSum = group.reduce((s, r) => s + weight(r), 0);
    const rcEng = wSum > 0 ? group.reduce((s, r) => s + eng(r) * weight(r), 0) / wSum : 0;
    const times = group
      .map((r) => (r.posted_at ? new Date(r.posted_at).getTime() : NaN))
      .filter((t) => !Number.isNaN(t));
    const weeks = times.length ? Math.max(1, Math.round((Math.max(...times) - Math.min(...times)) / WEEK_MS)) : 0;
    const insufficient = group.length < 3 || weeks < 4;
    return `${avgEng.toFixed(1)} (rc ${rcEng.toFixed(1)}) · n=${group.length}${insufficient ? " ⚠INSUFFICIENT" : ""}`;
  };

  console.log(`# Atomized vs organic — ${new Date().toISOString().slice(0, 10)}\n`);
  console.log(
    `Per platform: machine-distributed (atomized) vs natively posted (organic). Cell = avg engagement ` +
      `(replies ×3, reposts ×2, likes ×1) · rc = recency-weighted (${HALF_LIFE_WEEKS}-wk half-life) · n posts. ` +
      `⚠INSUFFICIENT = n<3 or <4 weeks of data.\n`
  );
  console.log(`| platform | atomized | organic |`);
  console.log(`|---|---|---|`);
  for (const pl of platforms) {
    console.log(`| ${pl} | ${cell(pl, "atomized")} | ${cell(pl, "organic")} |`);
  }
  console.log(
    `\n> Observational, not a controlled test: atomized = derivatives shipped from a content folder; ` +
      `organic = posts Muxin wrote natively (incl. Substack notes). The content differs between groups, ` +
      `so a gap is a reason to investigate, not proof. Flagged groups are too small to read yet.`
  );
}

main();
