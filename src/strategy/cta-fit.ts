import { fileURLToPath } from "node:url";
import { openDb } from "../db/db.js";
import { CORE_TEXT, CONTROL_RUN_SOURCE, EXPLORATION_SOURCE, loadConfig, type RoutingConfig } from "./route.js";
import { loadStrategyConfig, type StrategyConfig } from "./platform-fit.js";
import type { CtaDestination } from "../publish/cta.js";
import { latestMetricsJoin, measurementScope, parseStrategyMeasurementContext, type StrategyMeasurementContext } from "./measurement-context.js";

// Strategy lever E (card d80411bc, epic 2ce597d7 "Close the loop"): a RECOMMENDATION, not an
// auto-gate — same posture as levers A/B/D. The card as originally worded ("score CTA
// effectiveness by click-through + lead-gen per platform") is not buildable today: no
// conversion/lead metric survives ingest (clicks sums to ~40 across 1,229 metric rows, NULL on
// linkedin/bluesky — same wall lever D hit), AND which CTA destination a post used was never
// persisted anywhere — it was computed at publish time (src/publish/cta.ts) and discarded.
//
// Confirmed with Muxin (2026-07-15): no CTA-labeled posts have shipped yet, so there is nothing
// to backfill and no signal to expect today. This is a SCAFFOLD: card d80411bc wired forward
// persistence (appendBetPlacement's `| cta:<dest>` marker → tag-source.ts → posts.cta_destination)
// so future published posts accumulate real data, and this script measures the one contrast the
// schema now supports — per-platform engagement grouped by resolved CTA destination (source /
// project / work_with_me) — using engagement as the honest proxy for the missing click/conversion
// metric, exactly as lever D used engagement as the proxy for the missing conversion signal.
// Every platform is expected to read insufficient-data until enough CTA-tagged posts accumulate —
// that is the correct, honest state, not a bug. Recommendation only — /atomize's CTA choice
// (src/publish/cta.ts) and /publish's CTA placement are untouched by this. Live consumption
// (prioritizing the winning destination) is deferred to a follow-up card once real signal exists.
//   tsx src/strategy/cta-fit.ts   → ranked markdown recommendation to stdout

const WEEK_MS = 7 * 24 * 3600 * 1000;
const HALF_LIFE_WEEKS = 4; // matches snapshot.ts / resonance.ts / platform-fit.ts / cadence-fit.ts / frame-fit.ts

const DESTINATIONS: CtaDestination[] = ["source", "project", "work_with_me"];

export interface Row {
  platform: string;
  cta_destination: string | null;
  posted_at: string | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
}

// Raw per-post rows for CORE_TEXT platforms carrying a resolved CTA destination — excludes
// CONTROL_RUN_SOURCE/EXPLORATION_SOURCE (route.ts's loadData policy, same exclusion posture as
// platform-fit.ts/cadence-fit.ts), and excludes rows with no cta_destination at all (nothing to
// bucket them under — most rows today, since posts.cta_destination only started being stamped
// once card d80411bc shipped).
export function loadRows(injectedDb?: ReturnType<typeof openDb>, context?: StrategyMeasurementContext): Row[] {
  if (!context) throw new Error("strategy measurement requires explicit brand context");
  const db = injectedDb ?? openDb();
  const latest = latestMetricsJoin(context);
  const scope = measurementScope(context, "p", "m");
  const rows = db
    .prepare(
      `SELECT p.platform, p.cta_destination, p.posted_at, m.likes, m.replies, m.reposts
       FROM posts p JOIN (${latest.sql}) m ON m.post_id = p.id
       WHERE p.platform IN (${CORE_TEXT.map(() => "?").join(",")})
         AND p.cta_destination IS NOT NULL
         AND ${scope.sql} AND (p.source IS NULL OR p.source NOT IN (?, ?))`
    )
    .all(...latest.params, ...CORE_TEXT, ...scope.params, CONTROL_RUN_SOURCE, EXPLORATION_SOURCE) as Row[];
  if (!injectedDb) db.close();
  return rows;
}

function engagement(r: Row): number {
  return (r.likes ?? 0) + (r.replies ?? 0) * 3 + (r.reposts ?? 0) * 2;
}

function recencyWeight(postedAt: string | null, now: number): number {
  if (!postedAt) return 1;
  const ageWeeks = Math.max(0, (now - new Date(postedAt).getTime()) / WEEK_MS);
  return 0.5 ** (ageWeeks / HALF_LIFE_WEEKS);
}

function weightedAvg(rows: Row[], now: number): number | null {
  const wSum = rows.reduce((s, r) => s + recencyWeight(r.posted_at, now), 0);
  return wSum > 0 ? rows.reduce((s, r) => s + engagement(r) * recencyWeight(r.posted_at, now), 0) / wSum : null;
}

function weeksSpan(rows: Row[], now: number): number {
  const dated = rows.filter((r) => r.posted_at).map((r) => new Date(r.posted_at!).getTime());
  if (dated.length === 0) return 0;
  return Math.max(1, Math.round((Math.min(now, Math.max(...dated)) - Math.min(...dated)) / WEEK_MS));
}

export type CtaFitLabel = "clear-winner" | "even" | "insufficient-data";

export interface CtaFitResult {
  platform: string;
  label: CtaFitLabel;
  topDestination: CtaDestination | null;
  ratio: number | null; // top destination's recency-weighted avg engagement / runner-up's
  counts: Partial<Record<CtaDestination, number>>;
}

// The overfitting guard (same posture as levers A/B/C/D): a destination bucket only counts as
// "sufficient" once it clears n>=min_posts_for_data AND spans >=4wks — exactly frame-fit's guard,
// applied per bucket instead of per side. With fewer than two sufficient buckets there is nothing
// to compare, so the platform always reads insufficient-data — never a forced winner off one
// thin/early bucket. This is expected to be the universal read today: no CTA-tagged posts have
// shipped yet (2026-07-15), so posts.cta_destination is empty across the corpus.
export function classifyCtaFit(
  platform: string,
  rows: Row[],
  cfg: RoutingConfig,
  strategyCfg: StrategyConfig,
  now = Date.now()
): CtaFitResult {
  if (!strategyCfg.cta_thresholds) {
    throw new Error("config/strategy.yaml is missing cta_thresholds (lever E, card d80411bc). Add a cta_thresholds block.");
  }
  const group = rows.filter((r) => r.platform === platform);
  const min = cfg.thresholds.min_posts_for_data;

  const counts: Partial<Record<CtaDestination, number>> = {};
  const sufficient: { dest: CtaDestination; avg: number }[] = [];
  for (const dest of DESTINATIONS) {
    const bucket = group.filter((r) => r.cta_destination === dest);
    counts[dest] = bucket.length;
    if (bucket.length < min || weeksSpan(bucket, now) < 4) continue;
    const avg = weightedAvg(bucket, now);
    if (avg != null && avg > 0) sufficient.push({ dest, avg });
  }

  if (sufficient.length < 2) {
    return { platform, label: "insufficient-data", topDestination: null, ratio: null, counts };
  }

  sufficient.sort((a, b) => b.avg - a.avg);
  const [top, runnerUp] = sufficient;
  const ratio = top.avg / runnerUp.avg;
  const { win_ratio } = strategyCfg.cta_thresholds;
  const label: CtaFitLabel = ratio >= win_ratio ? "clear-winner" : "even";
  return { platform, label, topDestination: label === "clear-winner" ? top.dest : null, ratio, counts };
}

const LABEL_ORDER: Record<CtaFitLabel, number> = { "clear-winner": 0, even: 1, "insufficient-data": 2 };

export function rankCtaFit(rows: Row[], cfg: RoutingConfig, strategyCfg: StrategyConfig, now = Date.now()): CtaFitResult[] {
  return CORE_TEXT.filter((p) => rows.some((r) => r.platform === p))
    .map((p) => classifyCtaFit(p, rows, cfg, strategyCfg, now))
    .sort((a, b) => LABEL_ORDER[a.label] - LABEL_ORDER[b.label] || (b.ratio ?? -1) - (a.ratio ?? -1));
}

function labelText(r: CtaFitResult): string {
  switch (r.label) {
    case "clear-winner":
      return `${r.topDestination} clearly wins`;
    case "even":
      return "no clear winner (even)";
    case "insufficient-data":
      return "insufficient data";
  }
}

function main() {
  const cfg = loadConfig();
  const strategyCfg = loadStrategyConfig();
  const rows = loadRows(undefined, parseStrategyMeasurementContext());
  const ranked = rankCtaFit(rows, cfg, strategyCfg);

  console.log(`# CTA-fit signal, ${new Date().toISOString().slice(0, 10)}\n`);
  console.log(
    `Recommendation only. Nothing here changes what /atomize or /publish choose. Engagement is used as ` +
      `an honest proxy: no click/conversion metric survives ingest (clicks sums to ~40 across 1,229 metric ` +
      `rows, NULL on linkedin/bluesky). posts.cta_destination only started being stamped once card d80411bc ` +
      `shipped, so most platforms are expected to read insufficient-data until enough CTA-tagged posts ` +
      `accumulate. That is the correct state today, not a bug. Live consumption (prioritizing the winning ` +
      `destination in /publish) is deferred to a follow-up card once real signal exists.\n`
  );

  if (ranked.length === 0) {
    console.log(
      "No platform has any CTA-tagged posts yet. Publish some CTA-carrying posts, then run npm run tag-source " +
        "to stamp posts.cta_destination."
    );
    return;
  }

  const withData = ranked.filter((r) => r.label !== "insufficient-data");
  const thin = ranked.filter((r) => r.label === "insufficient-data");

  if (withData.length > 0) {
    console.log(`| Platform | Read | Ratio |`);
    console.log(`|---|---|---|`);
    for (const r of withData) {
      console.log(`| ${r.platform} | ${labelText(r)} | ${r.ratio!.toFixed(2)}x |`);
    }
  } else {
    console.log("No platform has two CTA destinations with enough data yet (all read insufficient-data).");
  }

  if (thin.length > 0) {
    console.log(
      `\n${thin.length} platform(s) read insufficient data: fewer than two CTA destinations clear ` +
        `n>=${cfg.thresholds.min_posts_for_data} and a 4wk span yet:`
    );
    for (const r of thin) {
      const countText = DESTINATIONS.map((d) => `${d}=${r.counts[d] ?? 0}`).join(", ");
      console.log(`- ${r.platform} (${countText})`);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
