import { openDb } from "../db/db.js";
import { CONTROL_RUN_SOURCE, CORE_TEXT, computeFit, loadData, type LoadedData, type RoutingConfig, type WindowRange } from "./route.js";
import { parseStrategyMeasurementContext, type StrategyMeasurementContext } from "./measurement-context.js";

// Routing drift flags: does a pillar/platform pair's fit score PERSISTENTLY diverge from
// config/routing.yaml's defaults list? decideForPillar (route.ts) is now always defaults-driven
// (card 7e550e48) — score never overrides it. This module is the surfaced-for-review companion:
// it checks the same score math (computeFit) across two independent windows so a single noisy
// snapshot never trips a flag, and reports (never writes) the result.
//
//   tsx src/strategy/route.ts --flags

const WEEK_MS = 7 * 24 * 3600 * 1000;
const WINDOW_WEEKS = 4;

// Two independent, non-overlapping ~4-week windows: the most recent, and the one before it.
export function driftWindows(now: number = Date.now()): [WindowRange, WindowRange] {
  const recentEnd = now;
  const recentStart = now - WINDOW_WEEKS * WEEK_MS;
  const priorEnd = recentStart;
  const priorStart = recentStart - WINDOW_WEEKS * WEEK_MS;
  return [
    { startMs: recentStart, endMs: recentEnd },
    { startMs: priorStart, endMs: priorEnd },
  ];
}

export type DriftDirection = "underperforming-assigned" | "overperforming-unassigned";

export interface DriftFlag {
  pillar: string;
  platform: string;
  direction: DriftDirection;
  n: number; // combined sample count across the windows that both independently cleared the floor
  windowsChecked: number; // independent windows that agreed on the direction (currently always 2)
  noSpinControlAvailable: boolean; // a deliberate control run (source=CONTROL_RUN_SOURCE) exists for this pair in the lookback
}

// Pure divergence check — no I/O. `windowData` must already be loaded per-window (loadData's
// `range` param); reuses computeFit's exact score math + route.ts:143's sample floor for EACH
// window independently, never a new/looser threshold. Flags only when every window agrees:
//   (a) platform IS in defaults AND scores persistently BELOW skip_below_score  -> underperforming-assigned
//   (b) platform is NOT in defaults AND scores persistently AT/ABOVE it        -> overperforming-unassigned
export function detectDrift(
  pillars: string[],
  cfg: RoutingConfig,
  windowData: LoadedData[],
  noSpinLookup: (pillar: string, platform: string) => boolean
): DriftFlag[] {
  const flags: DriftFlag[] = [];
  for (const pillar of pillars) {
    const defaults = cfg.defaults[pillar] ?? [];
    for (const platform of CORE_TEXT) {
      const results = windowData.map((data) => computeFit(platform, pillar, cfg, data));
      if (!results.every((r) => r.hasData)) continue; // every window must independently clear the floor

      const inDefaults = defaults.includes(platform);
      const scores = results.map((r) => r.score!);
      const persistentlyBelow = scores.every((s) => s < cfg.thresholds.skip_below_score);
      const persistentlyAbove = scores.every((s) => s >= cfg.thresholds.skip_below_score);

      let direction: DriftDirection | null = null;
      if (inDefaults && persistentlyBelow) direction = "underperforming-assigned";
      else if (!inDefaults && persistentlyAbove) direction = "overperforming-unassigned";
      if (!direction) continue;

      flags.push({
        pillar,
        platform,
        direction,
        n: results.reduce((s, r) => s + r.n, 0),
        windowsChecked: windowData.length,
        noSpinControlAvailable: noSpinLookup(pillar, platform),
      });
    }
  }
  return flags;
}

// Checks for a DELIBERATE, current control run (source=CONTROL_RUN_SOURCE, card f444f440's
// spin-control.ts) — not source='atomized' (origin-compare.ts's NO_SPIN_SOURCE). Spin is now the
// always-on default, so a stray old 'atomized' post is a pre-Spin artifact, not evidence of a
// live baseline; only the periodic --no-spin control run counts. Scoped to `range` like any other
// lookback here, so an ancient control run ages out and stops counting too.
export function hasNoSpinControl(db: ReturnType<typeof openDb>, pillar: string, platform: string, range: WindowRange, context?: StrategyMeasurementContext): boolean {
  if (!context) throw new Error("strategy measurement requires explicit brand context");
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM posts
       WHERE platform = ? AND pillar = ? AND source = ? AND brand_id = ?${context.providerAccountId ? " AND provider_account_id = ?" : ""}
         AND posted_at >= ? AND posted_at < ?`
    )
    .get(platform, pillar, CONTROL_RUN_SOURCE, context.brandId, ...(context.providerAccountId ? [context.providerAccountId] : []), new Date(range.startMs).toISOString(), new Date(range.endMs).toISOString()) as {
    c: number;
  };
  return row.c > 0;
}

export function formatDriftFlags(flags: DriftFlag[]): string {
  const lines = [
    `## Routing drift flags\n`,
    `Fit score diverges from config/routing.yaml's defaults list in BOTH of the last two ` +
      `independent ~4-week windows (not one noisy snapshot). Computed/printed only, this never ` +
      `writes to config/routing.yaml or config/platforms.yaml. A persistent divergence is a prompt ` +
      `for Muxin to reconsider the defaults by hand, same posture as the angle drift check.\n`,
  ];
  if (flags.length === 0) {
    lines.push(`No persistent divergences. Fit scores track config/routing.yaml's defaults across both windows.`);
    return lines.join("\n");
  }
  lines.push(`| pillar | platform | direction | n | windows checked | no-spin control available |`);
  lines.push(`|---|---|---|---|---|---|`);
  for (const f of flags) {
    lines.push(
      `| ${f.pillar} | ${f.platform} | ${f.direction} | ${f.n} | ${f.windowsChecked} | ${f.noSpinControlAvailable ? "yes" : "no"} |`
    );
  }
  return lines.join("\n");
}

// CLI-facing entry point for route.ts's `--flags` mode: loads config + two windows of data
// (through loadData, never duplicated), runs detectDrift, and looks up no-spin-control
// availability over the combined lookback (both windows together).
export function runDriftCheck(pillars: string[], cfg: RoutingConfig, context?: StrategyMeasurementContext): { flags: DriftFlag[]; report: string } {
  if (!context) throw new Error("strategy measurement requires explicit brand context");
  const db = openDb();
  try {
    const windows = driftWindows();
    const windowData = windows.map((w) => loadData(w, db, context));
    const lookback: WindowRange = { startMs: windows[1].startMs, endMs: windows[0].endMs };
    const flags = detectDrift(pillars, cfg, windowData, (pillar, platform) => hasNoSpinControl(db, pillar, platform, lookback, context));
    return { flags, report: formatDriftFlags(flags) };
  } finally {
    db.close();
  }
}
