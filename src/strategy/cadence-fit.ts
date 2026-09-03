import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { openDb, repoRoot } from "../db/db.js";
import { loadPlatforms } from "../config/platforms.js";
import { CORE_TEXT, CONTROL_RUN_SOURCE, EXPLORATION_SOURCE, loadConfig, type RoutingConfig } from "./route.js";
import { loadStrategyConfig, type StrategyConfig } from "./platform-fit.js";
import { latestMetricsJoin, measurementScope, parseStrategyMeasurementContext, type StrategyMeasurementContext } from "./measurement-context.js";

// Strategy lever C (card ed23f712, epic 2ce597d7 "Close the loop"): UNLIKE levers A/B, this one
// really can change /publish's live scheduler -- but only through config/schedule-overrides.yaml,
// which src/publish/slots.ts ignores entirely while `approved: false` there. `npm run cadence-fit`
// (report) prints a trend + peak-hour read; `npm run cadence-fit -- --write` also proposes numbers
// into schedule-overrides.yaml (still inert). Muxin reviews the numbers and flips `approved: true`
// herself -- nothing here bumps posting frequency or moves a slot time on its own.
//   tsx src/strategy/cadence-fit.ts              → ranked markdown recommendation to stdout
//   tsx src/strategy/cadence-fit.ts --write       → also writes proposed (still-inert) overrides

const WEEK_MS = 7 * 24 * 3600 * 1000;
const HALF_LIFE_WEEKS = 4; // matches snapshot.ts / resonance.ts / platform-fit.ts / media-fit.ts
const TZ = "America/Los_Angeles";

interface Row {
  platform: string;
  posted_at: string | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
}

// Raw per-post rows for CORE_TEXT platforms, excluding BOTH CONTROL_RUN_SOURCE and
// EXPLORATION_SOURCE (route.ts's loadData policy) -- a deliberate control/probe post never skews
// a cadence or peak-hour read.
export function loadRows(injectedDb?: ReturnType<typeof openDb>, context?: StrategyMeasurementContext): Row[] {
  if (!context) throw new Error("strategy measurement requires explicit brand context");
  const db = injectedDb ?? openDb();
  const latest = latestMetricsJoin(context);
  const scope = measurementScope(context, "p", "m");
  const rows = db
    .prepare(
      `SELECT p.platform, p.posted_at, m.likes, m.replies, m.reposts
       FROM posts p JOIN (${latest.sql}) m ON m.post_id = p.id
       WHERE p.platform IN (${CORE_TEXT.map(() => "?").join(",")})
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

// PT hour-of-day (0-23) for a UTC instant. A local, independent copy of the same
// Intl.DateTimeFormat approach slots.ts uses for its (unexported) laParts -- this repo's
// convention is a small local copy per strategy script rather than a shared import for a formula
// this size (see snapshot.ts/resonance.ts/platform-fit.ts's own recencyWeight copies).
function laHour(d: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", hour12: false });
  const h = Number(dtf.format(d));
  return h === 24 ? 0 : h;
}

function weightedAvg(rows: Row[], now: number): number | null {
  const wSum = rows.reduce((s, r) => s + recencyWeight(r.posted_at, now), 0);
  return wSum > 0 ? rows.reduce((s, r) => s + engagement(r) * recencyWeight(r.posted_at, now), 0) / wSum : null;
}

// ---------- trend ----------

export type TrendLabel = "climbing" | "steady" | "declining" | "insufficient-data";

export interface TrendResult {
  platform: string;
  label: TrendLabel;
  ratio: number | null; // recent-4wk / prior-4wk recency-weighted avg engagement
  recentN: number;
  priorN: number;
}

// The overfitting guard (same posture as levers A/B): insufficient data in EITHER the recent or
// prior 4wk window, or a non-positive prior baseline, always reads insufficient-data -- never a
// forced climbing/declining read on thin/early signal.
export function classifyTrend(
  platform: string,
  rows: Row[],
  cfg: RoutingConfig,
  strategyCfg: StrategyConfig,
  now = Date.now()
): TrendResult {
  if (!strategyCfg.cadence_thresholds) {
    throw new Error("config/strategy.yaml is missing cadence_thresholds (lever C, card ed23f712). Add a cadence_thresholds block.");
  }
  const group = rows.filter((r) => r.platform === platform);
  const recent = group.filter((r) => r.posted_at && new Date(r.posted_at).getTime() > now - 4 * WEEK_MS);
  const prior = group.filter((r) => {
    if (!r.posted_at) return false;
    const t = new Date(r.posted_at).getTime();
    return t <= now - 4 * WEEK_MS && t > now - 8 * WEEK_MS;
  });

  const min = cfg.thresholds.min_posts_for_data;
  const recentAvg = weightedAvg(recent, now);
  const priorAvg = weightedAvg(prior, now);

  if (recent.length < min || prior.length < min || !priorAvg || priorAvg <= 0) {
    return { platform, label: "insufficient-data", ratio: null, recentN: recent.length, priorN: prior.length };
  }

  const ratio = (recentAvg ?? 0) / priorAvg;
  const { climb_ratio, decline_ratio } = strategyCfg.cadence_thresholds;
  const label: TrendLabel = ratio >= climb_ratio ? "climbing" : ratio <= decline_ratio ? "declining" : "steady";
  return { platform, label, ratio, recentN: recent.length, priorN: prior.length };
}

// ---------- peak hour ----------

export type PeakHourLabel = "found" | "insufficient-data";

export interface PeakHourResult {
  platform: string;
  label: PeakHourLabel;
  hourPst: number | null; // 0-23, PT
  n: number;
  distinctHours: number;
}

// insufficient-data when: too few distinct PT hours (X/LinkedIn's synthetic date-only timestamps
// always fail this -- see card ed23f712's PR notes), too few posts, or <4wks of span. Same
// overfitting posture as classifyTrend/levers A-B: a thin or synthetic signal never produces a
// forced peak-hour read.
export function classifyPeakHour(
  platform: string,
  rows: Row[],
  cfg: RoutingConfig,
  strategyCfg: StrategyConfig,
  now = Date.now()
): PeakHourResult {
  if (!strategyCfg.peak_hour_thresholds) {
    throw new Error("config/strategy.yaml is missing peak_hour_thresholds (lever C, card ed23f712). Add a peak_hour_thresholds block.");
  }
  const group = rows.filter((r) => r.platform === platform && r.posted_at);
  const distinctHours = new Set(group.map((r) => laHour(new Date(r.posted_at!)))).size;

  const dated = group.map((r) => new Date(r.posted_at!).getTime());
  const weeks = dated.length ? Math.max(1, Math.round((Math.min(now, Math.max(...dated)) - Math.min(...dated)) / WEEK_MS)) : 0;

  if (
    group.length < cfg.thresholds.min_posts_for_data ||
    weeks < 4 ||
    distinctHours < strategyCfg.peak_hour_thresholds.min_distinct_times
  ) {
    return { platform, label: "insufficient-data", hourPst: null, n: group.length, distinctHours };
  }

  const byHour = new Map<number, Row[]>();
  for (const r of group) {
    const h = laHour(new Date(r.posted_at!));
    if (!byHour.has(h)) byHour.set(h, []);
    byHour.get(h)!.push(r);
  }
  let bestHour = 0;
  let bestAvg = -Infinity;
  for (const [h, hRows] of byHour) {
    const avg = weightedAvg(hRows, now) ?? -Infinity;
    if (avg > bestAvg) {
      bestAvg = avg;
      bestHour = h;
    }
  }
  return { platform, label: "found", hourPst: bestHour, n: group.length, distinctHours };
}

// ---------- cadence-source follow-through (lever C follow-through, epic 2ce597d7) ----------

export interface FollowRow {
  platform: string;
  cadence_source: string | null; // 'override' | 'default' | NULL = published before the marker existed
  posted_at: string | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
}

// Raw per-post rows carrying a resolved cadence_source, for CORE_TEXT platforms only — the one
// channel (src/publish/typefully.ts) that ever stamps this column (see queue.ts's comment on
// appendBetPlacement's cadenceSource param). Excludes BOTH CONTROL_RUN_SOURCE and
// EXPLORATION_SOURCE, same policy as loadRows() above, so a deliberate control/probe post never
// skews this comparison.
export function loadFollowRows(injectedDb?: ReturnType<typeof openDb>, context?: StrategyMeasurementContext): FollowRow[] {
  if (!context) throw new Error("strategy measurement requires explicit brand context");
  const db = injectedDb ?? openDb();
  const latest = latestMetricsJoin(context);
  const scope = measurementScope(context, "p", "m");
  const rows = db
    .prepare(
      `SELECT p.platform, p.cadence_source, p.posted_at, m.likes, m.replies, m.reposts
       FROM posts p JOIN (${latest.sql}) m ON m.post_id = p.id
       WHERE p.platform IN (${CORE_TEXT.map(() => "?").join(",")})
         AND p.cadence_source IS NOT NULL
         AND ${scope.sql} AND (p.source IS NULL OR p.source NOT IN (?, ?))`
    )
    .all(...latest.params, ...CORE_TEXT, ...scope.params, CONTROL_RUN_SOURCE, EXPLORATION_SOURCE) as FollowRow[];
  if (!injectedDb) db.close();
  return rows;
}

function weeksSpan(rows: FollowRow[], now: number): number {
  const dated = rows.filter((r) => r.posted_at).map((r) => new Date(r.posted_at!).getTime());
  if (dated.length === 0) return 0;
  return Math.max(1, Math.round((Math.min(now, Math.max(...dated)) - Math.min(...dated)) / WEEK_MS));
}

export type CadenceFollowLabel = "override-winning" | "even" | "override-losing" | "insufficient-data";

export interface CadenceFollowFitResult {
  platform: string;
  label: CadenceFollowLabel;
  ratio: number | null; // override / default recency-weighted avg engagement
  overrideN: number;
  defaultN: number;
}

// The overfitting guard (same posture as the trend/peak-hour reads above and every sibling
// lever): insufficient data on EITHER side, either side spanning <4wks, or a non-positive default
// baseline, always reads insufficient-data — never a forced winning/losing read on thin signal.
// Expected to read insufficient-data everywhere until Muxin approves an override AND posts
// accumulate under it (config/schedule-overrides.yaml is approved: false / empty as of 2026-08-18).
export function classifyCadenceFollow(
  platform: string,
  rows: FollowRow[],
  cfg: RoutingConfig,
  strategyCfg: StrategyConfig,
  now = Date.now()
): CadenceFollowFitResult {
  if (!strategyCfg.cadence_follow_thresholds) {
    throw new Error(
      "config/strategy.yaml is missing cadence_follow_thresholds (lever C follow-through, epic 2ce597d7). Add a cadence_follow_thresholds block."
    );
  }
  const group = rows.filter((r) => r.platform === platform);
  const overrideRows = group.filter((r) => r.cadence_source === "override");
  const defaultRows = group.filter((r) => r.cadence_source === "default");

  const min = cfg.thresholds.min_posts_for_data;
  const overrideAvg = weightedAvg(overrideRows, now);
  const defaultAvg = weightedAvg(defaultRows, now);

  if (
    overrideRows.length < min ||
    defaultRows.length < min ||
    weeksSpan(overrideRows, now) < 4 ||
    weeksSpan(defaultRows, now) < 4 ||
    !defaultAvg ||
    defaultAvg <= 0
  ) {
    return {
      platform,
      label: "insufficient-data",
      ratio: null,
      overrideN: overrideRows.length,
      defaultN: defaultRows.length,
    };
  }

  const ratio = (overrideAvg ?? 0) / defaultAvg;
  const { win_ratio } = strategyCfg.cadence_follow_thresholds;
  const label: CadenceFollowLabel =
    ratio >= win_ratio ? "override-winning" : ratio <= 1 / win_ratio ? "override-losing" : "even";
  return { platform, label, ratio, overrideN: overrideRows.length, defaultN: defaultRows.length };
}

const CADENCE_FOLLOW_LABEL_ORDER: Record<CadenceFollowLabel, number> = {
  "override-winning": 0,
  even: 1,
  "override-losing": 2,
  "insufficient-data": 3,
};

export function rankCadenceFollow(
  rows: FollowRow[],
  cfg: RoutingConfig,
  strategyCfg: StrategyConfig,
  now = Date.now()
): CadenceFollowFitResult[] {
  return CORE_TEXT.filter((p) => rows.some((r) => r.platform === p))
    .map((p) => classifyCadenceFollow(p, rows, cfg, strategyCfg, now))
    .sort(
      (a, b) => CADENCE_FOLLOW_LABEL_ORDER[a.label] - CADENCE_FOLLOW_LABEL_ORDER[b.label] || (b.ratio ?? -1) - (a.ratio ?? -1)
    );
}

function followLabelText(r: CadenceFollowFitResult): string {
  switch (r.label) {
    case "override-winning":
      return "override winning, keep it";
    case "even":
      return "even";
    case "override-losing":
      return "override losing, default cadence outperforms";
    case "insufficient-data":
      return "insufficient data";
  }
}

// ---------- ranking + report ----------

const TREND_ORDER: Record<TrendLabel, number> = { climbing: 0, steady: 1, declining: 2, "insufficient-data": 3 };

export function rankTrend(rows: Row[], cfg: RoutingConfig, strategyCfg: StrategyConfig, now = Date.now()): TrendResult[] {
  return CORE_TEXT.filter((p) => rows.some((r) => r.platform === p))
    .map((p) => classifyTrend(p, rows, cfg, strategyCfg, now))
    .sort((a, b) => TREND_ORDER[a.label] - TREND_ORDER[b.label] || (b.ratio ?? -1) - (a.ratio ?? -1));
}

export function rankPeakHour(rows: Row[], cfg: RoutingConfig, strategyCfg: StrategyConfig, now = Date.now()): PeakHourResult[] {
  return CORE_TEXT.filter((p) => rows.some((r) => r.platform === p)).map((p) => classifyPeakHour(p, rows, cfg, strategyCfg, now));
}

function hourLabel(h: number): string {
  const period = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00${period} PT`;
}

export interface OverridesFile {
  approved: boolean;
  generated: string;
  overrides: Record<string, { posts_per_week?: number; slot_time_pst?: string }>;
}

const OVERRIDES_PATH = join(repoRoot, "config", "schedule-overrides.yaml");

function loadOverridesFile(): OverridesFile {
  if (!existsSync(OVERRIDES_PATH)) return { approved: false, generated: "", overrides: {} };
  return parse(readFileSync(OVERRIDES_PATH, "utf8")) as OverridesFile;
}

function canonicalize(overrides: OverridesFile["overrides"]): string {
  const sorted: OverridesFile["overrides"] = {};
  for (const platform of Object.keys(overrides).sort()) {
    const entry = overrides[platform];
    sorted[platform] = {};
    if (entry.posts_per_week !== undefined) sorted[platform].posts_per_week = entry.posts_per_week;
    if (entry.slot_time_pst !== undefined) sorted[platform].slot_time_pst = entry.slot_time_pst;
  }
  return JSON.stringify(sorted);
}

function formatOverridesYaml(file: OverridesFile): string {
  const header = [
    "# Proposed posting cadence + timing overrides -- strategy lever C (card ed23f712).",
    "# WRITTEN BY: npm run cadence-fit -- --write (from /strategy). Regenerated each cycle.",
    "# NOT LIVE until you approve: src/publish/slots.ts ignores every override while `approved: false`.",
    "# To activate: review the proposed values below, set `approved: true`, commit. A --write rerun",
    "# whose proposals differ from what's on disk resets this to false, so new numbers always get a",
    "# fresh review -- an old approval never silently carries over to different numbers.",
  ].join("\n");
  const platforms = Object.keys(file.overrides).sort();
  const body =
    platforms.length === 0
      ? "overrides: {}"
      : "overrides:\n" +
        platforms
          .map((p) => {
            const entry = file.overrides[p];
            const lines = [`  ${p}:`];
            if (entry.posts_per_week !== undefined) lines.push(`    posts_per_week: ${entry.posts_per_week}`);
            if (entry.slot_time_pst !== undefined) lines.push(`    slot_time_pst: "${entry.slot_time_pst}"`);
            return lines.join("\n");
          })
          .join("\n");
  return `${header}\napproved: ${file.approved}\ngenerated: "${file.generated}"\n${body}\n`;
}

// Builds the proposed overrides block from this cycle's trend + peak-hour reads, clamped by
// cadence_thresholds.max_posts_per_week and stepped by cadence_thresholds.step (over-posting
// guards). Only ever WRITES to schedule-overrides.yaml's `overrides`/`generated` fields;
// `approved` is preserved ONLY when the new block is byte-identical to `existingFile.overrides`
// (unchanged numbers keep an existing approval), and reset to false otherwise -- fresh numbers
// always need a fresh review. `currentSchedule`/`existingFile` are injected (not read from disk
// here) so this stays a pure, unit-testable function; main() below supplies the real files.
export function buildOverridesFile(
  trends: TrendResult[],
  peakHours: PeakHourResult[],
  strategyCfg: StrategyConfig,
  generated: string,
  currentSchedule: Record<string, { posts_per_week?: number; slot_time_pst?: string }>,
  existingFile: OverridesFile
): OverridesFile {
  if (!strategyCfg.cadence_thresholds) {
    throw new Error("config/strategy.yaml is missing cadence_thresholds (lever C, card ed23f712). Add a cadence_thresholds block.");
  }
  const { step, max_posts_per_week } = strategyCfg.cadence_thresholds;
  const overrides: OverridesFile["overrides"] = {};

  for (const t of trends) {
    if (t.label !== "climbing" && t.label !== "declining") continue;
    const current = currentSchedule[t.platform]?.posts_per_week;
    if (current === undefined) continue;
    const delta = t.label === "climbing" ? step : -step;
    const proposed = Math.max(1, Math.min(max_posts_per_week, current + delta));
    if (proposed === current) continue;
    overrides[t.platform] ??= {};
    overrides[t.platform].posts_per_week = proposed;
  }

  for (const p of peakHours) {
    if (p.label !== "found" || p.hourPst === null) continue;
    const current = currentSchedule[p.platform]?.slot_time_pst;
    const proposed = `${String(p.hourPst).padStart(2, "0")}:00`;
    if (proposed === current) continue;
    overrides[p.platform] ??= {};
    overrides[p.platform].slot_time_pst = proposed;
  }

  const unchanged = canonicalize(existingFile.overrides) === canonicalize(overrides);
  return { approved: unchanged ? existingFile.approved : false, generated, overrides };
}

function main() {
  const write = process.argv.includes("--write");
  const cfg = loadConfig();
  const strategyCfg = loadStrategyConfig();
  const rows = loadRows(undefined, parseStrategyMeasurementContext());
  const trends = rankTrend(rows, cfg, strategyCfg);
  const peakHours = rankPeakHour(rows, cfg, strategyCfg);

  console.log(`# Cadence + timing fit, ${new Date().toISOString().slice(0, 10)}\n`);
  console.log(
    `Nothing here is live posting behavior on its own. This report is recommendation-only; even with` +
      ` --write, the proposals below land in config/schedule-overrides.yaml with approved: false.` +
      ` /publish's scheduler (src/publish/slots.ts) ignores it until Muxin reviews the numbers and sets` +
      ` approved: true herself.\n`
  );

  console.log(`## Engagement trend (recent 4wk vs prior 4wk)\n`);
  const trendData = trends.filter((t) => t.label !== "insufficient-data");
  const trendThin = trends.filter((t) => t.label === "insufficient-data");
  if (trendData.length > 0) {
    console.log(`| Platform | Read | Ratio | n (recent/prior) |`);
    console.log(`|---|---|---|---|`);
    for (const t of trendData) console.log(`| ${t.platform} | ${t.label} | ${t.ratio!.toFixed(2)}x | ${t.recentN}/${t.priorN} |`);
  } else {
    console.log("No platform has enough data yet in both windows (all read insufficient-data).");
  }
  if (trendThin.length > 0) {
    console.log(
      `\n${trendThin.length} platform(s) have insufficient data (n<${cfg.thresholds.min_posts_for_data} in either 4wk window), so there is no trend read yet:`
    );
    for (const t of trendThin) console.log(`- ${t.platform}`);
  }

  console.log(`\n## Peak posting hour (PT)\n`);
  const hourData = peakHours.filter((p) => p.label === "found");
  const hourThin = peakHours.filter((p) => p.label === "insufficient-data");
  if (hourData.length > 0) {
    console.log(`| Platform | Peak hour | n | distinct hours seen |`);
    console.log(`|---|---|---|---|`);
    for (const p of hourData) console.log(`| ${p.platform} | ${hourLabel(p.hourPst!)} | ${p.n} | ${p.distinctHours} |`);
  } else {
    console.log("No platform has a reliable peak-hour read yet.");
  }
  if (hourThin.length > 0) {
    console.log(
      `\n${hourThin.length} platform(s) read insufficient data for peak-hour, either too few posts/weeks, or` +
        ` (true today of X and LinkedIn) their analytics only capture the posting DATE, not the hour, so every` +
        ` post lands on a synthetic timestamp with no real time-of-day signal:`
    );
    for (const p of hourThin) console.log(`- ${p.platform} (n=${p.n}, ${p.distinctHours} distinct hour(s) seen)`);
  }

  console.log(`\n## Cadence-override follow-through (posts.cadence_source: override vs default)\n`);
  console.log(
    `Whether an approved config/schedule-overrides.yaml entry actually outperforms the static default, ` +
      `once Muxin has approved one and posts have accumulated under it. Every post published via ` +
      `src/publish/typefully.ts is stamped 'override' or 'default' at claim time, and this compares them.\n`
  );
  const followRows = loadFollowRows();
  const followRanked = rankCadenceFollow(followRows, cfg, strategyCfg);
  if (followRanked.length === 0) {
    console.log(
      "No platform has any cadence_source-tagged posts yet, either because no override has been approved, or because none " +
        "have published since. Run npm run tag-source after publishing to stamp posts.cadence_source."
    );
  } else {
    const followData = followRanked.filter((r) => r.label !== "insufficient-data");
    const followThin = followRanked.filter((r) => r.label === "insufficient-data");
    if (followData.length > 0) {
      console.log(`| Platform | Read | Ratio | override n | default n |`);
      console.log(`|---|---|---|---|---|`);
      for (const r of followData) {
        console.log(`| ${r.platform} | ${followLabelText(r)} | ${r.ratio!.toFixed(2)}x | ${r.overrideN} | ${r.defaultN} |`);
      }
    } else {
      console.log("No platform has enough override/default data yet (all read insufficient-data).");
    }
    if (followThin.length > 0) {
      console.log(
        `\n${followThin.length} platform(s) read insufficient data (either side n<${cfg.thresholds.min_posts_for_data} ` +
          `or <4wks span):`
      );
      for (const r of followThin) console.log(`- ${r.platform} (override n=${r.overrideN}, default n=${r.defaultN})`);
    }
  }

  if (write) {
    const file = buildOverridesFile(
      trends,
      peakHours,
      strategyCfg,
      new Date().toISOString().slice(0, 10),
      loadPlatforms().platforms,
      loadOverridesFile()
    );
    writeFileSync(OVERRIDES_PATH, formatOverridesYaml(file));
    console.log(`\n---\nWrote proposals to config/schedule-overrides.yaml (approved: ${file.approved}).`);
    if (Object.keys(file.overrides).length === 0) {
      console.log("No platform proposed a change this cycle (all steady/insufficient-data).");
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
