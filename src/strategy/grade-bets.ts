import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openDb, repoRoot } from "../db/db.js";

// Deterministic scoring for the bets ledger — the anti-fossilization backstop.
//   tsx src/strategy/grade-bets.ts   → markdown report for /strategy to act on
//
// For each OPEN/CARRIED bet in briefs/bets.md it computes, from analytics linked via
// posts.bet_id: sample size, avg engagement vs. the platform reference, weeks open (from the
// bet id's date), and a mechanical verdict. It then emits flags /strategy MUST respond to:
//   SUGGEST_FLIP   — a DO_MORE that underperformed two graded cycles running → flip to DO_LESS
//   SUGGEST_RETIRE — a bet open >6 weeks that still can't reach n>=3 (unresolvable at this cadence)
// The numbers are the script's; the decision to flip/retire/keep stays Claude's judgment.

const BETS_PATH = join(repoRoot, "briefs", "bets.md");
const WEEK = 7 * 24 * 3600 * 1000;
const STALE_WEEKS = 6;
const MIN_SAMPLE = 3;

interface Bet {
  id: string; // e.g. "2026-06-14-001"
  type: string; // DO_MORE | TEST | DO_LESS
  status: string; // open | carried | confirmed | failed | retired
  streak: number; // consecutive underperforming graded cycles (maintained by /strategy)
}

// Parse the "## Bets" section into bet blocks. Each block starts with "## bet:<id>".
function parseBets(md: string): Bet[] {
  const bets: Bet[] = [];
  const blocks = md.split(/^##\s+bet:/m).slice(1);
  for (const block of blocks) {
    const id = block.split(/\s|\n/)[0].trim();
    if (!id) continue;
    const field = (name: string) =>
      block.match(new RegExp(`^\\s*${name}:\\s*(.+)$`, "m"))?.[1]?.trim();
    bets.push({
      id,
      type: (field("type") ?? "TEST").toUpperCase(),
      status: (field("status") ?? "open").toLowerCase(),
      streak: Number(field("underperform_streak") ?? 0) || 0,
    });
  }
  return bets;
}

interface Stat {
  bet_id: string | null;
  platform: string;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
  impressions: number | null;
}

const eng = (s: Stat) => (s.likes ?? 0) + (s.replies ?? 0) * 3 + (s.reposts ?? 0) * 2;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function main() {
  let md = "";
  try {
    md = readFileSync(BETS_PATH, "utf8");
  } catch {
    console.log("No bets ledger yet (briefs/bets.md). Nothing to grade — this is the first cycle.");
    return;
  }
  const bets = parseBets(md).filter((b) => b.status === "open" || b.status === "carried");
  if (bets.length === 0) {
    console.log("No open/carried bets to grade.");
    return;
  }

  const db = openDb();
  const rows = db
    .prepare(
      `SELECT p.bet_id, p.platform, m.likes, m.replies, m.reposts, m.impressions
       FROM posts p LEFT JOIN (
         SELECT m.* FROM metrics m
         JOIN (SELECT post_id, MAX(captured_at) AS mc FROM metrics GROUP BY post_id) lm
           ON m.post_id = lm.post_id AND m.captured_at = lm.mc
       ) m ON m.post_id = p.id`
    )
    .all() as Stat[];
  db.close();

  const withMetrics = rows.filter(
    (r) => r.likes != null || r.replies != null || r.reposts != null || r.impressions != null
  );
  // Platform reference = avg engagement of all measured posts on that platform.
  const platformAvg = (pl: string) => {
    const e = withMetrics.filter((r) => r.platform === pl).map(eng);
    return mean(e);
  };

  const now = Date.now();
  console.log(`# Bet scoreboard — ${new Date().toISOString().slice(0, 10)}\n`);
  console.log(`Reference = avg engagement (likes + replies×3 + reposts×2) of all measured posts per platform.\n`);
  console.log(`| Bet | Type | n | Avg eng | Platform ref | Weeks open | Verdict |`);
  console.log(`|---|---|---|---|---|---|---|`);

  const flags: string[] = [];
  const streakUpdates: string[] = [];

  for (const bet of bets) {
    const linked = withMetrics.filter((r) => r.bet_id === bet.id);
    const n = linked.length;
    const avg = mean(linked.map(eng));
    // weeks open from the bet id's date prefix (YYYY-MM-DD-NNN)
    const datePrefix = bet.id.slice(0, 10);
    const placedMs = Date.parse(datePrefix);
    const weeksOpen = Number.isNaN(placedMs) ? "?" : Math.max(0, Math.round((now - placedMs) / WEEK));
    const refs = [...new Set(linked.map((r) => r.platform))];
    const ref = refs.length ? mean(refs.map(platformAvg)) : 0;

    let verdict: "pass" | "fail" | "insufficient-sample";
    if (n < MIN_SAMPLE) verdict = "insufficient-sample";
    else verdict = avg >= ref ? "pass" : "fail";

    console.log(
      `| bet:${bet.id} | ${bet.type} | ${n} | ${avg.toFixed(1)} | ${ref.toFixed(1)} | ${weeksOpen} | ${verdict} |`
    );

    // SUGGEST_RETIRE: open too long and still unresolvable at current sample.
    if (typeof weeksOpen === "number" && weeksOpen > STALE_WEEKS && verdict === "insufficient-sample") {
      flags.push(
        `SUGGEST_RETIRE bet:${bet.id} — open ${weeksOpen} wks, only n=${n} (<${MIN_SAMPLE}); not resolvable at current cadence.`
      );
    }

    // SUGGEST_FLIP: a DO_MORE that underperforms its platform reference two graded cycles running.
    if (bet.type === "DO_MORE" && verdict === "fail") {
      const newStreak = bet.streak + 1;
      streakUpdates.push(`bet:${bet.id} underperform_streak → ${newStreak}`);
      if (newStreak >= 2) {
        flags.push(
          `SUGGEST_FLIP bet:${bet.id} — DO_MORE underperformed platform ref ${newStreak} cycles running (avg ${avg.toFixed(1)} < ref ${ref.toFixed(1)}); flip to DO_LESS or justify keeping it.`
        );
      }
    } else if (verdict === "pass" && bet.streak > 0) {
      streakUpdates.push(`bet:${bet.id} underperform_streak → 0 (recovered)`);
    }
  }

  console.log(`\n## Flags (every flag must be acted on or overridden with one sentence in the brief)\n`);
  console.log(flags.length ? flags.map((f) => `- ${f}`).join("\n") : "- none");

  if (streakUpdates.length) {
    console.log(`\n## Streak updates to write back into briefs/bets.md\n`);
    console.log(streakUpdates.map((s) => `- ${s}`).join("\n"));
  }

  console.log(
    `\n> n<${MIN_SAMPLE} is "insufficient-sample" — such a bet may be carried but NEVER promoted to a DO_MORE directive.`
  );
}

main();
