import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { openDb, repoRoot } from "../db/db.js";
import {
  CORE_TEXT,
  CONTROL_RUN_SOURCE,
  EXPLORATION_SOURCE,
  PILLARS,
  computeFit,
  loadConfig,
  loadData,
  type LoadedData,
  type RoutingConfig,
} from "./route.js";

// Strategy lever A (card c7638362, epic 2ce597d7 "Close the loop"): a RECOMMENDATION, not an
// auto-gate. Muxin decided (2026-07-15, thin/early-signal overfitting concern) that topic-vs-
// platform performance data should inform the weekly brief but never change what /atomize
// drafts — route.ts's include/skip decision stays defaults-driven (card 7e550e48), untouched by
// this file. This script ranks each pillar x platform pair by measured fit + a seed-prior
// annotation (config/strategy.yaml) for Muxin to act on by hand.
//   tsx src/strategy/platform-fit.ts   → ranked markdown recommendation to stdout

const WEEK_MS = 7 * 24 * 3600 * 1000;
const HALF_LIFE_WEEKS = 4; // matches snapshot.ts / resonance.ts / origin-compare.ts

export interface StrategyConfig {
  platform_pillar_priors: Record<string, string[]>;
  thresholds: { lean_in_floor: number };
  // Optional: lever B (card 27dc7d2d, src/strategy/media-fit.ts) reuses this same config file +
  // loader rather than standing up a second one. Absent on a Lever-A-only config.
  media_thresholds?: { lean_floor: number };
  // Optional: lever C (card ed23f712, src/strategy/cadence-fit.ts) reuses this same config file +
  // loader rather than standing up a second one. Absent on a config that predates lever C.
  cadence_thresholds?: { climb_ratio: number; decline_ratio: number; step: number; max_posts_per_week: number };
  peak_hour_thresholds?: { min_distinct_times: number };
  // Optional: lever D (card a4c5b42b, src/strategy/frame-fit.ts) reuses this same config file +
  // loader rather than standing up a second one. Absent on a config that predates lever D.
  frame_thresholds?: { win_ratio: number };
  // Optional: lever E (card d80411bc, src/strategy/cta-fit.ts) reuses this same config file +
  // loader rather than standing up a second one. Absent on a config that predates lever E.
  cta_thresholds?: { win_ratio: number };
}

export function loadStrategyConfig(): StrategyConfig {
  return parse(readFileSync(join(repoRoot, "config", "strategy.yaml"), "utf8")) as StrategyConfig;
}

interface Row {
  platform: string;
  pillar: string;
  posted_at: string | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
}

// Raw per-post rows (not the aggregated cells loadData() returns) so recency weighting can be
// applied per post, same shape as resonance.ts's own query — but excluding BOTH
// CONTROL_RUN_SOURCE and EXPLORATION_SOURCE (route.ts's loadData policy), not just the former, so
// this recommendation never leans on a deliberate control/probe post's engagement.
export function loadRows(injectedDb?: ReturnType<typeof openDb>): Row[] {
  const db = injectedDb ?? openDb();
  const rows = db
    .prepare(
      `SELECT p.platform, p.pillar, p.posted_at, m.likes, m.replies, m.reposts
       FROM posts p
       JOIN (
         SELECT m.* FROM metrics m
         JOIN (SELECT post_id, MAX(captured_at) AS mc FROM metrics GROUP BY post_id) lm
           ON m.post_id = lm.post_id AND m.captured_at = lm.mc
       ) m ON m.post_id = p.id
       WHERE p.pillar IS NOT NULL AND (p.source IS NULL OR p.source NOT IN (?, ?))`
    )
    .all(CONTROL_RUN_SOURCE, EXPLORATION_SOURCE) as Row[];
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

export type FitLabel = "lean-in" | "steady" | "ease-off" | "insufficient-data";
export type PriorMatch = "matches-prior" | "off-prior" | "no-prior";

export interface PlatformFitResult {
  platform: string;
  pillar: string;
  label: FitLabel;
  score: number | null; // same 0..1+ normalized fit as route.ts's computeFit; null only when no cell at all
  recencyWeightedEng: number | null;
  n: number;
  priorMatch: PriorMatch;
}

// hasData reuses route.ts's exact floor (n >= min_posts_for_data && weeks >= 4) — a thin cell is
// ALWAYS "insufficient-data", never a forced lean-in/ease-off, however extreme its raw score
// looks. This is the overfitting guard Muxin asked for: no directive read on early signal.
export function classifyFit(
  platform: string,
  pillar: string,
  cfg: RoutingConfig,
  data: LoadedData,
  rows: Row[],
  strategyCfg: StrategyConfig,
  now = Date.now()
): PlatformFitResult {
  const fit = computeFit(platform, pillar, cfg, data);
  const group = rows.filter((r) => r.platform === platform && r.pillar === pillar);
  const wSum = group.reduce((s, r) => s + recencyWeight(r.posted_at, now), 0);
  const recencyWeightedEng =
    wSum > 0 ? group.reduce((s, r) => s + engagement(r) * recencyWeight(r.posted_at, now), 0) / wSum : null;

  let label: FitLabel;
  if (!fit.hasData) {
    label = "insufficient-data";
  } else if (fit.score! >= strategyCfg.thresholds.lean_in_floor) {
    label = "lean-in";
  } else if (fit.score! < cfg.thresholds.skip_below_score) {
    label = "ease-off";
  } else {
    label = "steady";
  }

  const priors = strategyCfg.platform_pillar_priors[platform] ?? [];
  const priorMatch: PriorMatch = priors.length === 0 ? "no-prior" : priors.includes(pillar) ? "matches-prior" : "off-prior";

  return { platform, pillar, label, score: fit.score, recencyWeightedEng, n: fit.n, priorMatch };
}

const LABEL_ORDER: Record<FitLabel, number> = { "lean-in": 0, steady: 1, "ease-off": 2, "insufficient-data": 3 };

export function rankPlatformFit(
  cfg: RoutingConfig,
  data: LoadedData,
  rows: Row[],
  strategyCfg: StrategyConfig,
  now = Date.now()
): PlatformFitResult[] {
  const platforms = CORE_TEXT.filter((p) => rows.some((r) => r.platform === p));
  const results: PlatformFitResult[] = [];
  for (const pillar of PILLARS) {
    for (const platform of platforms) {
      results.push(classifyFit(platform, pillar, cfg, data, rows, strategyCfg, now));
    }
  }
  return results.sort((a, b) => LABEL_ORDER[a.label] - LABEL_ORDER[b.label] || (b.score ?? -1) - (a.score ?? -1));
}

function labelText(label: FitLabel): string {
  switch (label) {
    case "lean-in":
      return "lean in";
    case "steady":
      return "steady";
    case "ease-off":
      return "consider easing off";
    case "insufficient-data":
      return "insufficient data";
  }
}

function priorText(m: PriorMatch): string {
  switch (m) {
    case "matches-prior":
      return "matches seed prior";
    case "off-prior":
      return "off seed prior";
    case "no-prior":
      return "no prior set";
  }
}

function main() {
  const cfg = loadConfig();
  const strategyCfg = loadStrategyConfig();
  const data = loadData();
  const rows = loadRows();
  const ranked = rankPlatformFit(cfg, data, rows, strategyCfg);

  console.log(`# Topic-platform fit — ${new Date().toISOString().slice(0, 10)}\n`);
  console.log(
    `Recommendation only — nothing here changes what /atomize drafts. route.ts's include/skip stays defaults-driven (card 7e550e48); use this to decide by hand whether to update config/routing.yaml's defaults.\n`
  );

  if (ranked.length === 0) {
    console.log("No tagged posts with metrics yet. Tag posts first (snapshot --untagged → tag-posts).");
    return;
  }

  const withData = ranked.filter((r) => r.label !== "insufficient-data");
  const thin = ranked.filter((r) => r.label === "insufficient-data");

  if (withData.length > 0) {
    console.log(`| Platform | Pillar | Read | Fit | n | Prior |`);
    console.log(`|---|---|---|---|---|---|`);
    for (const r of withData) {
      console.log(`| ${r.platform} | ${r.pillar} | ${labelText(r.label)} | ${r.score!.toFixed(2)} | ${r.n} | ${priorText(r.priorMatch)} |`);
    }
  } else {
    console.log("No pillar/platform pair has enough data yet (all read insufficient-data).");
  }

  if (thin.length > 0) {
    console.log(
      `\n${thin.length} pillar/platform pair(s) have insufficient data (n<${cfg.thresholds.min_posts_for_data} or <4wks) — no read yet, not a forced recommendation:`
    );
    for (const r of thin) console.log(`- ${r.platform} / ${r.pillar} (${priorText(r.priorMatch)})`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
