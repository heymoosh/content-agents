import { existsSync, readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openDb, repoRoot } from "../db/db.js";
import { parseStrategyMeasurementContext, type StrategyMeasurementContext } from "./measurement-context.js";
import {
  CONTROL_RUN_SOURCE,
  PILLARS,
  loadConfig,
  queryEngagementCells,
  type Cell,
  type RoutingConfig,
  type WindowRange,
} from "./route.js";

// Spin-control runs (card f444f440): a small, deliberate, periodic --no-spin mechanism that keeps
// a live verbatim baseline for pillar/platform pairs config/routing.yaml's defaults ALREADY route
// to. Spin (docs/spin-experiment.md) has been the always-on default for every /atomize run since
// 2026-07-02, so a plain verbatim post basically never happens on its own anymore — without this,
// routing-drift.ts's no-spin-control check permanently reports false, and the drift flag can never
// tell "wrong platform for this topic" apart from "the spin angle isn't landing." UNLIKE
// exploration.ts (card 92bb2ae6, off-assignment probes into UNtested pairs), this targets pairs
// that are ALREADY assigned — every (pillar, platform) combination config/routing.yaml's
// `defaults` section lists.
//
// Cadence: once a calendar month, OVERALL (not per platform) — unlike exploration.ts's per-
// platform gate. Exploration split its gate across exactly 2 platforms (LinkedIn/Bluesky) with a
// clean untested-pillar list each; this card's ~14 assigned pairs span 4+ platforms/communities
// (x, linkedin, bluesky, community:democratic-resilience) with no similarly clean split, and a
// control run is pure measurement scaffolding, not a growth lever, so keeping total volume low
// (one control post a month, period) matters more than covering every platform in parallel. Pick
// whichever assigned pair has gone the longest since its last control run (never-run counts as
// the longest possible wait, outranking any pair with a recorded run however old), gated to at
// most one pick across ALL pairs per calendar month. State persists in
// data/spin-control-ledger.jsonl — JSONL, one line per control run, read + append, no DB — same
// convention as data/notes-spread-ledger.jsonl (src/cron/ledger.ts).
//
// Integration with /atomize (documented, not auto-wired end-to-end — same posture as exploration.ts):
//   1. `npm run spin-control` picks this month's due pair and appends the ledger.
//   2. On that pillar's next /atomize run, draft ONLY that one platform's derivative verbatim
//      (.claude/skills/atomize/SKILL.md step 3.5) — every other routed platform for the same
//      piece still gets its normal spin treatment. This is NOT a full `/atomize --no-spin`
//      invocation, which would strip spin from the whole piece instead of just this one platform.
//   3. Stamp its frontmatter `control_run: true`. Downstream, appendBetPlacement
//      (src/publish/queue.ts) writes a `| control-run` Placed-log marker for that row, and
//      tag-source.ts reads it back to classify the resulting post's DB row
//      `source = 'spin-control-run'` (CONTROL_RUN_SOURCE) — which route.ts's loadData() excludes
//      from the pillar/platform resonance figures decideForPillar and routing-drift.ts read.
//   4. It still queues through the NORMAL review-queue.md approval flow — nothing auto-publishes
//      (CLAUDE.md rule 2 keeps governing).
//
//   tsx src/strategy/spin-control.ts               → select + record this month's due control run
//   tsx src/strategy/spin-control.ts --dry-run      → same selection, no ledger write
//   tsx src/strategy/spin-control.ts --coverage     → accumulated control-run engagement per
//                                                      assigned pair, gated to n>=3.

// Same PT anchor as the unified publish scheduler (src/publish/slots.ts's TZ) — the "calendar
// month" a control run counts against is Muxin's local month, not UTC's.
const TZ = "America/Los_Angeles";
function ptMonthKey(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit" }).formatToParts(d);
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
}

export const LEDGER_PATH = join(repoRoot, "data", "spin-control-ledger.jsonl");

export interface ControlRunLedgerEntry {
  pillar: string;
  platform: string;
  ranAt: string; // ISO timestamp of when this pillar/platform pair was selected for a control run
  contentFolder?: string; // relative path, once a derivative is actually drafted for it
}

// Read all ledger entries. `ledgerPath` is injectable for testing (defaults to the committed
// ledger file). Malformed lines are skipped silently, same posture as notes-spread-ledger's
// reader — this includes JSON that parses fine but carries an unparseable `ranAt`, since
// nextControlRun's month-key/recency math would otherwise throw on that entry's Invalid Date.
export function readControlLedger(ledgerPath = LEDGER_PATH): ControlRunLedgerEntry[] {
  if (!existsSync(ledgerPath)) return [];
  const lines = readFileSync(ledgerPath, "utf8").split("\n").filter(Boolean);
  const entries: ControlRunLedgerEntry[] = [];
  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as ControlRunLedgerEntry;
      if (Number.isNaN(new Date(entry.ranAt).getTime())) continue;
      entries.push(entry);
    } catch {
      // skip malformed lines silently — don't crash if the file gets a stray newline
    }
  }
  return entries;
}

// Append a single new entry to the ledger. `ledgerPath` is injectable for testing.
export function appendControlLedger(entry: ControlRunLedgerEntry, ledgerPath = LEDGER_PATH): void {
  mkdirSync(dirname(ledgerPath), { recursive: true });
  appendFileSync(ledgerPath, JSON.stringify(entry) + "\n");
}

export interface AssignedPair {
  pillar: string;
  platform: string;
}

// Every (pillar, platform) pair config/routing.yaml treats as a permanently-routed target, in
// pillar-then-platform order: the `defaults` list, plus any `rules.<pillar>.always` platform not
// already in defaults (route.ts's decideForPillar treats both as equally "assigned" — see its
// `always` handling). Always derived from the live cfg (never hardcoded), so an edit to
// routing.yaml is picked up automatically the next time this runs.
export function assignedPairs(cfg: RoutingConfig, pillars: string[] = PILLARS): AssignedPair[] {
  return pillars.flatMap((pillar) => {
    const defaults = cfg.defaults[pillar] ?? [];
    const always = (cfg.rules[pillar]?.always ?? []).filter((platform) => !defaults.includes(platform));
    return [...defaults, ...always].map((platform) => ({ pillar, platform }));
  });
}

export type ControlPick = AssignedPair;

// Longest-since-last-control-run selection, gated to ONE pick per calendar month across ALL
// assigned pairs (not per-pair/per-platform — see the module comment for why). Never-run pairs
// count as the longest wait (mirrors exploration.ts's explicit call) and outrank any pair with a
// recorded run, however old. Returns null when there are no assigned pairs at all, or a control
// run has already used this calendar month's single slot.
export function nextControlRun(
  cfg: RoutingConfig,
  entries: ControlRunLedgerEntry[],
  now: number | Date = Date.now(),
  pillars: string[] = PILLARS
): ControlPick | null {
  const pairs = assignedPairs(cfg, pillars);
  if (pairs.length === 0) return null;

  const nowKey = ptMonthKey(new Date(now));
  const usedThisMonth = entries.some((e) => ptMonthKey(new Date(e.ranAt)) === nowKey);
  if (usedThisMonth) return null;

  // One pass over entries to find each pair's most recent run, instead of re-filtering the full
  // entries array once per pair being ranked. Never-run pairs (absent from the map) count as the
  // longest possible wait.
  const lastRun = new Map<string, number>();
  for (const e of entries) {
    const key = `${e.pillar}|${e.platform}`;
    const t = new Date(e.ranAt).getTime();
    lastRun.set(key, Math.max(lastRun.get(key) ?? -Infinity, t));
  }
  const lastRunMs = (pair: AssignedPair): number => lastRun.get(`${pair.pillar}|${pair.platform}`) ?? -Infinity;

  const oldest = pairs.reduce((best, pair) => (lastRunMs(pair) < lastRunMs(best) ? pair : best));
  return { pillar: oldest.pillar, platform: oldest.platform };
}

// ---- data separation: the control-run bucket, kept OUT of route.ts's main resonance figures ----

// Same engagement weighting as route.ts's loadData / resonance.ts, but scoped to
// CONTROL_RUN_SOURCE rows only — the mirror image of loadData()'s exclusion, so a control run's
// engagement is trackable as its own bucket without ever touching the main pillar/platform cells.
// `db` is injectable for tests (see routing-drift.ts's hasNoSpinControl for the same pattern).
export function loadControlData(db: ReturnType<typeof openDb>, range?: WindowRange, context?: StrategyMeasurementContext): Map<string, Cell> {
  if (!context) throw new Error("strategy measurement requires explicit brand context");
  const dateClause = range ? `AND p.posted_at >= ? AND p.posted_at < ?` : "";
  const dateParams = range ? [new Date(range.startMs).toISOString(), new Date(range.endMs).toISOString()] : [];
  const rows = queryEngagementCells(db, "AND p.source = ?", [CONTROL_RUN_SOURCE], dateClause, dateParams, context);

  const cells = new Map<string, Cell>();
  for (const r of rows) cells.set(`${r.platform}|${r.pillar}`, { n: r.n, avg_eng: r.avg_eng });
  return cells;
}

// Don't surface a bucket until it has enough control runs to say anything (n>=3 gate, same
// threshold as exploration.ts's coverage report).
const COVERAGE_MIN_N = 3;

// Markdown block for /strategy's brief. Only lists assigned pillar/platform cells that have
// reached COVERAGE_MIN_N control runs — everything below that stays silent rather than emit noise.
export function formatControlCoverage(cells: Map<string, Cell>, cfg: RoutingConfig, pillars: string[] = PILLARS): string {
  const rows: string[] = [];
  for (const pair of assignedPairs(cfg, pillars)) {
    const cell = cells.get(`${pair.platform}|${pair.pillar}`);
    if (!cell || cell.n < COVERAGE_MIN_N) continue;
    rows.push(`| ${pair.platform} | ${pair.pillar} | ${cell.n} | ${cell.avg_eng.toFixed(1)} |`);
  }
  const lines = [
    `## Spin-control coverage\n`,
    `Deliberate --no-spin control runs (card f444f440) on already-assigned pillar/platform pairs, ` +
      `tracked separately from, and never folded into, the pillar/platform resonance figures route.ts ` +
      `and the routing drift flag use. Surfaced only once a pair has reached n>=${COVERAGE_MIN_N} control runs.\n`,
  ];
  if (rows.length === 0) {
    lines.push(`No assigned pair has reached n>=${COVERAGE_MIN_N} spin-control runs yet.`);
    return lines.join("\n");
  }
  lines.push(`| platform | pillar | n | avg engagement |`);
  lines.push(`|---|---|---|---|`);
  return lines.concat(rows).join("\n");
}

// ---- CLI ---------------------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const cfg = loadConfig();

  if (args.includes("--coverage")) {
    const db = openDb();
    try {
      const cells = loadControlData(db, undefined, parseStrategyMeasurementContext());
      console.log(formatControlCoverage(cells, cfg));
    } finally {
      db.close();
    }
    return;
  }

  const dryRun = args.includes("--dry-run");
  const entries = readControlLedger();

  console.log(`\nspin-control${dryRun ? " [DRY RUN, no ledger write]" : ""}`);
  console.log("=".repeat(50));

  const pick = nextControlRun(cfg, entries, Date.now());
  if (!pick) {
    const pairs = assignedPairs(cfg);
    const reason = pairs.length === 0 ? "no assigned pairs in config/routing.yaml" : "already ran a control this calendar month";
    console.log(`skip, ${reason}`);
  } else {
    console.log(`control run this month: "${pick.pillar}" on ${pick.platform}`);
    if (!dryRun) {
      const entry: ControlRunLedgerEntry = { pillar: pick.pillar, platform: pick.platform, ranAt: new Date().toISOString() };
      appendControlLedger(entry);
    }
  }

  if (dryRun) {
    console.log("\nDry-run complete, no ledger entry written.");
  } else if (pick) {
    console.log(
      `\nNext: on this pillar's next /atomize run, draft ONLY the ${pick.platform} derivative verbatim\n` +
        `(no spin: true, no angle. See .claude/skills/atomize/SKILL.md step 3.5; NOT a full /atomize --no-spin\n` +
        `invocation, which would strip spin from every routed platform, not just this one), then stamp\n` +
        `that one derivative's frontmatter control_run: true before it reaches review-queue.md.`
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
