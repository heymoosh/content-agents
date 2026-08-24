import { fileURLToPath } from "node:url";
import { openDb } from "../db/db.js";
import { CORE_TEXT, CONTROL_RUN_SOURCE, loadConfig, type RoutingConfig } from "./route.js";
import { loadStrategyConfig, type StrategyConfig } from "./platform-fit.js";

// Strategy lever D (card a4c5b42b, epic 2ce597d7 "Close the loop"): a RECOMMENDATION, not an
// auto-gate — same posture as levers A/B. The card as originally worded ("weight spin angles by
// conversion performance per platform") is not buildable today: angle is 1:1 with platform
// (src/atomize/spin.ts resolveAngle), so there is no angle A vs angle B to weight within a
// platform, and no conversion/lead metric exists in the DB (clicks sums to ~40 across 1,229
// metric rows, NULL on linkedin/bluesky). This script instead measures the one framing contrast
// the DB actually supports: spin-ON (the always-default frame) vs spin-OFF (the verbatim control
// baseline src/strategy/spin-control.ts already places periodically), per platform, by engagement.
// It closes the loop on that control experiment. Case-skeleton/directive-level angle weighting is
// deferred to a follow-up card (those tags live only in derivative frontmatter, not the DB yet).
// Recommendation only — /atomize's spin selection (src/atomize/spin.ts) is untouched by this.
//   tsx src/strategy/frame-fit.ts   → ranked markdown recommendation to stdout

const WEEK_MS = 7 * 24 * 3600 * 1000;
const HALF_LIFE_WEEKS = 4; // matches snapshot.ts / resonance.ts / platform-fit.ts / cadence-fit.ts

// Spin-on posts.source values (src/db/tag-source.ts) — the frame /atomize applies by default.
// Spin-off is CONTROL_RUN_SOURCE ("spin-control-run"), the periodic verbatim baseline.
const SPIN_ON_SOURCES = ["atomized", "atomized-spin"];

export interface Row {
  platform: string;
  source: string | null;
  posted_at: string | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
}

// Raw per-post rows for CORE_TEXT platforms, scoped to the two frame buckets this lever compares
// (spin-on sources + the control baseline) — UNLIKE platform-fit.ts/cadence-fit.ts, this does NOT
// exclude CONTROL_RUN_SOURCE, because that's exactly the spin-off side of the comparison. Rows
// with any other source (organic, exploration-probe, atomized-outreach, NULL/untagged) are left
// out here since neither bucket claims them.
export function loadRows(injectedDb?: ReturnType<typeof openDb>): Row[] {
  const db = injectedDb ?? openDb();
  const sources = [...SPIN_ON_SOURCES, CONTROL_RUN_SOURCE];
  const rows = db
    .prepare(
      `SELECT p.platform, p.source, p.posted_at, m.likes, m.replies, m.reposts
       FROM posts p
       JOIN (
         SELECT m.* FROM metrics m
         JOIN (SELECT post_id, MAX(captured_at) AS mc FROM metrics GROUP BY post_id) lm
           ON m.post_id = lm.post_id AND m.captured_at = lm.mc
       ) m ON m.post_id = p.id
       WHERE p.platform IN (${CORE_TEXT.map(() => "?").join(",")})
         AND p.source IN (${sources.map(() => "?").join(",")})`
    )
    .all(...CORE_TEXT, ...sources) as Row[];
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

export type FrameLabel = "frame-winning" | "even" | "frame-losing" | "insufficient-data";

export interface FrameFitResult {
  platform: string;
  label: FrameLabel;
  ratio: number | null; // spin-on / spin-off recency-weighted avg engagement
  spinOnN: number;
  spinOffN: number;
}

// The overfitting guard (same posture as levers A/B/C): insufficient data on EITHER side, either
// side spanning <4wks, or a non-positive spin-off baseline, always reads insufficient-data — never
// a forced winning/losing read on thin/early signal. This is expected to be the common read today:
// posts.source is NULL on most distributed posts until tag-source runs, and spin-control-run
// coverage accrues only one pick per calendar month (spin-control.ts).
export function classifyFrame(
  platform: string,
  rows: Row[],
  cfg: RoutingConfig,
  strategyCfg: StrategyConfig,
  now = Date.now()
): FrameFitResult {
  if (!strategyCfg.frame_thresholds) {
    throw new Error("config/strategy.yaml is missing frame_thresholds (lever D, card a4c5b42b). Add a frame_thresholds block.");
  }
  const group = rows.filter((r) => r.platform === platform);
  const spinOn = group.filter((r) => SPIN_ON_SOURCES.includes(r.source ?? ""));
  const spinOff = group.filter((r) => r.source === CONTROL_RUN_SOURCE);

  const min = cfg.thresholds.min_posts_for_data;
  const spinOnAvg = weightedAvg(spinOn, now);
  const spinOffAvg = weightedAvg(spinOff, now);

  if (
    spinOn.length < min ||
    spinOff.length < min ||
    weeksSpan(spinOn, now) < 4 ||
    weeksSpan(spinOff, now) < 4 ||
    !spinOffAvg ||
    spinOffAvg <= 0
  ) {
    return { platform, label: "insufficient-data", ratio: null, spinOnN: spinOn.length, spinOffN: spinOff.length };
  }

  const ratio = (spinOnAvg ?? 0) / spinOffAvg;
  const { win_ratio } = strategyCfg.frame_thresholds;
  const label: FrameLabel = ratio >= win_ratio ? "frame-winning" : ratio <= 1 / win_ratio ? "frame-losing" : "even";
  return { platform, label, ratio, spinOnN: spinOn.length, spinOffN: spinOff.length };
}

const LABEL_ORDER: Record<FrameLabel, number> = { "frame-winning": 0, even: 1, "frame-losing": 2, "insufficient-data": 3 };

export function rankFrameFit(rows: Row[], cfg: RoutingConfig, strategyCfg: StrategyConfig, now = Date.now()): FrameFitResult[] {
  return CORE_TEXT.filter((p) => rows.some((r) => r.platform === p))
    .map((p) => classifyFrame(p, rows, cfg, strategyCfg, now))
    .sort((a, b) => LABEL_ORDER[a.label] - LABEL_ORDER[b.label] || (b.ratio ?? -1) - (a.ratio ?? -1));
}

function labelText(label: FrameLabel): string {
  switch (label) {
    case "frame-winning":
      return "spin frame winning, keep it";
    case "even":
      return "even";
    case "frame-losing":
      return "spin frame losing, verbatim baseline outperforms";
    case "insufficient-data":
      return "insufficient data";
  }
}

function main() {
  const cfg = loadConfig();
  const strategyCfg = loadStrategyConfig();
  const rows = loadRows();
  const ranked = rankFrameFit(rows, cfg, strategyCfg);

  console.log(`# Spin-frame fit, ${new Date().toISOString().slice(0, 10)}\n`);
  console.log(
    `Recommendation only. Nothing here changes what /atomize drafts. src/atomize/spin.ts's per-platform ` +
      `angle stays as-is; this compares the always-on spin frame against the verbatim control baseline ` +
      `(src/strategy/spin-control.ts) by engagement, per platform, for Muxin to act on by hand. Weighting ` +
      `individual angles (case-skeleton, directive-level frames) by conversion is deferred until those tags ` +
      `are persisted to the analytics DB. See the follow-up card filed alongside this lever.\n`
  );

  if (ranked.length === 0) {
    console.log(
      "No platform has both a spin-on and a spin-off (control) row yet. Run npm run tag-source to classify " +
        "posts.source, and npm run spin-control to place this cycle's verbatim baseline."
    );
    return;
  }

  const withData = ranked.filter((r) => r.label !== "insufficient-data");
  const thin = ranked.filter((r) => r.label === "insufficient-data");

  if (withData.length > 0) {
    console.log(`| Platform | Read | Ratio | spin-on n | spin-off n |`);
    console.log(`|---|---|---|---|---|`);
    for (const r of withData) {
      console.log(`| ${r.platform} | ${labelText(r.label)} | ${r.ratio!.toFixed(2)}x | ${r.spinOnN} | ${r.spinOffN} |`);
    }
  } else {
    console.log("No platform has enough spin-on/spin-off data yet (all read insufficient-data).");
  }

  if (thin.length > 0) {
    console.log(
      `\n${thin.length} platform(s) read insufficient data: either side has n<${cfg.thresholds.min_posts_for_data}, ` +
        `<4wks of span, or no spin-control-run coverage yet at all (source untagged, or spin-control.ts hasn't ` +
        `placed a baseline for that platform yet):`
    );
    for (const r of thin) console.log(`- ${r.platform} (spin-on n=${r.spinOnN}, spin-off n=${r.spinOffN})`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
