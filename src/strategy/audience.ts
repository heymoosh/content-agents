import { openDb } from "../db/db.js";

// Audience summary for the weekly brief: who follows you (LinkedIn demographics), how many
// (follower/subscriber totals + recent growth), across platforms. Reads the `audience` table
// (populated by ingest). Prints markdown for /strategy to weave into the brief.
//   tsx src/strategy/audience.ts

interface ARow {
  platform: string;
  captured_at: string;
  as_of_date: string | null;
  metric_type: string;
  dimension: string | null;
  value_label: string | null;
  value_count: number | null;
  value_pct: number | null;
}

const LI_DIMS = ["location", "seniority", "industry", "job_title", "company_size", "company"];

function main() {
  const db = openDb();
  const all = db
    .prepare(
      `SELECT platform, captured_at, as_of_date, metric_type, dimension, value_label, value_count, value_pct
       FROM audience`
    )
    .all() as ARow[];
  db.close();

  if (all.length === 0) {
    console.log(
      "No audience data yet. Drop a LinkedIn .xlsx or Substack export in data/inbox and run `npm run ingest`."
    );
    return;
  }

  // Use the freshest snapshot per platform (captured_at builds a time series for snapshot-only platforms).
  const latest: Record<string, string> = {};
  for (const r of all) if (!latest[r.platform] || r.captured_at > latest[r.platform]) latest[r.platform] = r.captured_at;
  const cur = all.filter((r) => r.captured_at === latest[r.platform]);
  const platforms = [...new Set(cur.map((r) => r.platform))].sort();

  console.log(`# Audience — who you're reaching — ${new Date().toISOString().slice(0, 10)}\n`);

  console.log(`## Reach\n`);
  console.log(`| Platform | Followers/subs | Recent net growth | Demographics |`);
  console.log(`|---|---|---|---|`);
  for (const pl of platforms) {
    const total = cur.find((r) => r.platform === pl && r.metric_type === "follower_total")?.value_count;
    const delta = cur.find((r) => r.platform === pl && r.metric_type === "follower_delta")?.value_count;
    const hasDemo = cur.some((r) => r.platform === pl && r.metric_type === "demographic" && r.dimension !== "tier");
    const hasTier = cur.some((r) => r.platform === pl && r.dimension === "tier");
    const demoNote = hasDemo ? "yes" : hasTier ? "tier only" : "none";
    console.log(`| ${pl} | ${total ?? "—"} | ${delta != null ? "+" + delta : "—"} | ${demoNote} |`);
  }

  const liRows = cur.filter((r) => r.platform === "linkedin" && r.metric_type === "demographic");
  if (liRows.length) {
    console.log(`\n## LinkedIn demographics (top 5 per dimension)\n`);
    for (const d of LI_DIMS) {
      const rows = liRows
        .filter((r) => r.dimension === d)
        .sort((a, b) => (b.value_pct ?? 0) - (a.value_pct ?? 0))
        .slice(0, 5);
      if (!rows.length) continue;
      const vals = rows.map((r) => `${r.value_label} ${r.value_pct != null ? r.value_pct + "%" : "<1%"}`).join(", ");
      console.log(`- **${d.replace("_", " ")}:** ${vals}`);
    }
  }

  const tier = cur.filter((r) => r.platform === "substack" && r.dimension === "tier");
  if (tier.length) {
    console.log(`\n## Substack subscribers by tier\n`);
    tier
      .sort((a, b) => (b.value_count ?? 0) - (a.value_count ?? 0))
      .forEach((r) => console.log(`- ${r.value_label}: ${r.value_count} (${r.value_pct}%)`));
  }

  console.log(`\n> Notes for the brief:`);
  for (const pl of platforms) {
    const total = cur.find((r) => r.platform === pl && r.metric_type === "follower_total")?.value_count;
    if (total != null && total < 100) {
      console.log(`> - ${pl}: only ${total} followers/subs — too small to read demographics into; treat as anecdote.`);
    }
  }
  console.log(
    `> - Demographics are LinkedIn-only (X & Bluesky expose none; Substack only free/paid). Use LinkedIn's audience as the proxy for who Muxin reaches professionally, and judge whether it matches the target reader for each pillar — a mismatch is a routing/positioning signal, not just trivia.`
  );
}

main();
