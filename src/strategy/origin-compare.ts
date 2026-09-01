import { openDb } from "../db/db.js";
import { latestMetricsJoin, measurementScope, parseStrategyMeasurementContext } from "./measurement-context.js";
import { fileURLToPath } from "node:url";
import { CONTROL_RUN_SOURCE, EXPLORATION_SOURCE } from "./route.js";

// Atomized-vs-organic traction: per platform, how do machine-distributed posts compare to ones
// Muxin posted natively (incl. Substack notes)? Reuses the snapshot.ts engagement score + recency
// weighting. This is OBSERVATIONAL — the content differs between groups, so a gap is a signal to
// look closer, not proof. Run after `npm run tag-source`.
//   npm run origin-compare

const WEEK_MS = 7 * 24 * 3600 * 1000;
const HALF_LIFE_WEEKS = 4; // matches snapshot.ts / resonance.ts
// The verbatim/no-spin control classification (posts.source), reused by routing-drift.ts's
// no-spin-control-availability check instead of re-encoding the same string elsewhere.
export const NO_SPIN_SOURCE = "atomized";
// Spin is the always-on default (promoted 2026-07-02); `--no-spin` is the opt-out. So almost
// everything atomized now ships as spin, and the *control* — verbatim `--no-spin` runs — is what
// gets rare. To measure whether spin actually earns its keep, we need a verbatim baseline to
// compare it against. This many verbatim-atomized posts on a platform = a control worth reading.
const SPIN_CONTROL_N = 10;

interface Row {
  platform: string;
  source: string | null;
  posted_at: string | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
}

function main() {
  const context = parseStrategyMeasurementContext();
  const db = openDb();
  const latest = latestMetricsJoin(context);
  const scope = measurementScope(context, "p", "m");
  // exploration-probe rows are a deliberate off-assignment mechanism (card 92bb2ae6), not part of
  // the atomized/spin/organic comparison this report measures — exclude them, same as route.ts's
  // loadData(). Their own coverage bucket lives in exploration.ts's --coverage report.
  const rows = db
    .prepare(
      `SELECT p.platform, p.source, p.posted_at, m.likes, m.replies, m.reposts
       FROM posts p JOIN (${latest.sql}) m ON m.post_id = p.id
       WHERE p.source IS NOT NULL AND ${scope.sql} AND p.source != ?`
    )
    .all(...latest.params, ...scope.params, EXPLORATION_SOURCE) as Row[];
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
    if (group.length === 0) return "-";
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

  console.log(`# Atomized vs organic, ${new Date().toISOString().slice(0, 10)}\n`);
  console.log(
    `Per platform: verbatim-atomized vs spin (audience-reframed) vs natively posted (organic). ` +
      `Cell = avg engagement (replies ×3, reposts ×2, likes ×1) · rc = recency-weighted ` +
      `(${HALF_LIFE_WEEKS}-wk half-life) · n posts. ⚠INSUFFICIENT = n<3 or <4 weeks of data.\n`
  );
  console.log(`| platform | atomized | atomized-spin | organic |`);
  console.log(`|---|---|---|---|`);
  for (const pl of platforms) {
    console.log(`| ${pl} | ${cell(pl, "atomized")} | ${cell(pl, "atomized-spin")} | ${cell(pl, "organic")} |`);
  }
  console.log(
    `\n> Observational, not a controlled test: atomized = verbatim derivatives shipped from a content ` +
      `folder; atomized-spin = derivatives reframed for audience fit (docs/spin-experiment.md); ` +
      `organic = posts Muxin wrote natively (incl. Substack notes). The content differs between groups, ` +
      `so a gap is a reason to investigate, not proof. Flagged groups are too small to read yet.`
  );

  // Spin-control readiness: spin is the default, so the question flipped from "is it time to start
  // spinning?" to "do we have enough verbatim `--no-spin` control to measure spin's lift?". Flag
  // platforms where spin has real volume but the verbatim control is too thin to compare against.
  const byPlatform = platforms.map((pl) => ({
    pl,
    spin: rows.filter((r) => r.platform === pl && r.source === "atomized-spin").length,
    // Counts both the legacy ad hoc verbatim posts ('atomized') AND the systematic monthly
    // control runs (CONTROL_RUN_SOURCE, card f444f440's spin-control.ts) — both are verbatim
    // no-spin baselines. Without the latter, this permanently undercounts once spin-control.ts's
    // ledger-tracked runs replace ad hoc verbatim posts as the source of control data.
    verbatim: rows.filter((r) => r.platform === pl && (r.source === "atomized" || r.source === CONTROL_RUN_SOURCE)).length,
  }));
  const totalSpin = byPlatform.reduce((s, x) => s + x.spin, 0);
  const needControl = byPlatform.filter((x) => x.spin >= 3 && x.verbatim < SPIN_CONTROL_N);
  console.log(`\n## Spin control readiness\n`);
  if (totalSpin < 3) {
    console.log(
      `No spin data classified yet. Spin is the always-on default, so this fills in as atomized-spin ` +
        `posts ship and get tagged. Once a platform has spin volume, this flags whether its verbatim ` +
        `\`--no-spin\` control is thick enough to measure spin's lift. See docs/spin-experiment.md.`
    );
  } else if (needControl.length) {
    console.log(
      `**Spin lift not yet measurable.** Spin is the always-on default, so the verbatim control is thin ` +
        `on ${needControl.map((x) => `${x.pl} (spin n=${x.spin}, verbatim n=${x.verbatim}/${SPIN_CONTROL_N})`).join(", ")}. ` +
        `Run the occasional \`/atomize --no-spin\` control there so spin's lift has a verbatim baseline to ` +
        `beat, and record a control bet in briefs/bets.md so it gets graded. See docs/spin-experiment.md.`
    );
  } else {
    console.log(
      `Verbatim control is adequate where spin has volume. Read spin vs verbatim vs organic straight off ` +
        `the table above. Keep the odd \`/atomize --no-spin\` run going so the control doesn't age out ` +
        `(recency-weighted). See docs/spin-experiment.md.`
    );
  }
}

// Guarded (not a bare `main()` call), same CLI-entry-point convention as route.ts: nothing
// currently imports from this module, but a bare call would re-run the whole report (and hit
// the DB) as a side effect the moment anything — a future test, or a re-added cross-module
// import of NO_SPIN_SOURCE — imports this file.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
