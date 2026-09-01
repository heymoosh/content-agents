import { existsSync, readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openDb, repoRoot } from "../db/db.js";
import { EXPLORATION_SOURCE, PILLARS, loadConfig, type Cell, type RoutingConfig, type WindowRange } from "./route.js";
import { latestMetricsJoin, measurementScope, parseStrategyMeasurementContext, type StrategyMeasurementContext } from "./measurement-context.js";

// Same PT anchor as the unified publish scheduler (src/publish/slots.ts's TZ) — the "calendar
// month" a probe counts against is Muxin's local month, not UTC's.
const TZ = "America/Los_Angeles";
function ptMonthKey(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit" }).formatToParts(d);
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
}

// Exploration budget (card 92bb2ae6): a small, deliberate, LABELED probe mechanism that tests
// off-assignment pillar/platform pairs config/routing.yaml's defaults never route to. Without it,
// an unassigned pair (e.g. LinkedIn x civic-tech) never gets posted, so its fit can never be
// learned — the catch-22 Muxin flagged 2026-07-04. Completely separate from normal routed posting
// and from routing-drift.ts (which only monitors pairs ALREADY assigned by config/routing.yaml).
//
// Cadence: once a calendar month, per exploration platform (LinkedIn, Bluesky — X already gets
// all 6 pillars by default, so there's no gap to probe there), pick whichever of that platform's
// untested pillars has gone the longest since its last probe (never-probed counts as the longest
// possible wait). State persists in data/exploration-ledger.jsonl — JSONL, one line per probe,
// read + append, no DB — same convention as data/notes-spread-ledger.jsonl (src/cron/ledger.ts).
//
// Integration with /atomize (documented, deliberately NOT auto-wired end-to-end — see card
// 92bb2ae6's scoping note: a standalone, independently testable mechanism is the concrete minimum):
//   1. `npm run explore` picks this month's due probe(s) and appends the ledger.
//   2. For a platform picked this way, route that ONE piece with:
//        tsx src/strategy/route.ts --pillar <picked-pillar> --explore <platform> --folder <folder>
//      `--explore` forces that platform's decision to `include` (confidence "exploration") for
//      this single routing.md, even though it is off that pillar's config/routing.yaml defaults.
//   3. When /atomize drafts the derivative for that platform, stamp its frontmatter
//      `exploration_probe: true`. Downstream, appendBetPlacement (src/publish/queue.ts) writes a
//      `| exploration` Placed-log marker for that row, and tag-source.ts reads it back to classify
//      the resulting post's DB row `source = 'exploration-probe'` (EXPLORATION_SOURCE) — which
//      route.ts's loadData() excludes from the pillar/platform resonance figures decideForPillar
//      and routing-drift.ts read (see route.ts's loadData for the exclusion).
//   4. It still queues through the NORMAL review-queue.md approval flow — nothing auto-publishes
//      (CLAUDE.md rule 2 keeps governing).
//
//   tsx src/strategy/exploration.ts               → select + record this month's due probe(s)
//   tsx src/strategy/exploration.ts --dry-run      → same selection, no ledger write
//   tsx src/strategy/exploration.ts --coverage     → accumulated exploration coverage (n, avg
//                                                     engagement) per untested pillar, gated to
//                                                     n>=3 — the block /strategy's brief includes.

// X already gets all 6 pillars by default in config/routing.yaml, so it has no untested pillar to
// probe. LinkedIn and Bluesky are the two platforms with a real coverage gap.
export const EXPLORATION_PLATFORMS = ["linkedin", "bluesky"];

export const LEDGER_PATH = join(repoRoot, "data", "exploration-ledger.jsonl");

export interface ExplorationLedgerEntry {
  platform: string;
  pillar: string;
  probedAt: string; // ISO timestamp of when this platform/pillar pair was selected for probing
  contentFolder?: string; // relative path, once a derivative is actually drafted for it
}

// Read all ledger entries. `ledgerPath` is injectable for testing (defaults to the committed
// ledger file). Malformed lines are skipped silently, same posture as notes-spread-ledger's reader.
export function readExplorationLedger(ledgerPath = LEDGER_PATH): ExplorationLedgerEntry[] {
  if (!existsSync(ledgerPath)) return [];
  const lines = readFileSync(ledgerPath, "utf8").split("\n").filter(Boolean);
  const entries: ExplorationLedgerEntry[] = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line) as ExplorationLedgerEntry);
    } catch {
      // skip malformed lines silently — don't crash if the file gets a stray newline
    }
  }
  return entries;
}

// Append a single new entry to the ledger. `ledgerPath` is injectable for testing.
export function appendExplorationLedger(entry: ExplorationLedgerEntry, ledgerPath = LEDGER_PATH): void {
  mkdirSync(dirname(ledgerPath), { recursive: true });
  appendFileSync(ledgerPath, JSON.stringify(entry) + "\n");
}

// Untested surface: pillars config/routing.yaml's `defaults` do NOT list for this platform.
// Always derived from the live cfg (never hardcoded), so an edit to routing.yaml's defaults is
// picked up automatically the next time this runs.
export function untestedPillars(platform: string, cfg: RoutingConfig, pillars: string[] = PILLARS): string[] {
  return pillars.filter((pillar) => !(cfg.defaults[pillar] ?? []).includes(platform));
}

export interface ProbePick {
  platform: string;
  pillar: string;
  untested: string[]; // full untested set this pick was chosen from, for context/logging
}

// Longest-since-last-probe selection, gated to once per calendar month per platform. Never-probed
// pillars count as the longest wait (Muxin's explicit call) and outrank any pillar with a
// recorded probe, however old. Returns null when the platform has no untested pillars (no gap to
// probe) or has already used its slot for the current calendar month.
export function nextExplorationProbe(
  platform: string,
  cfg: RoutingConfig,
  entries: ExplorationLedgerEntry[],
  now: number | Date = Date.now(),
  pillars: string[] = PILLARS
): ProbePick | null {
  const untested = untestedPillars(platform, cfg, pillars);
  if (untested.length === 0) return null;

  const nowKey = ptMonthKey(new Date(now));
  const platformEntries = entries.filter((e) => e.platform === platform);
  const usedThisMonth = platformEntries.some((e) => ptMonthKey(new Date(e.probedAt)) === nowKey);
  if (usedThisMonth) return null;

  const lastProbedMs = (pillar: string): number => {
    const times = platformEntries.filter((e) => e.pillar === pillar).map((e) => new Date(e.probedAt).getTime());
    return times.length ? Math.max(...times) : -Infinity; // never-probed = the longest possible wait
  };

  const ranked = [...untested].sort((a, b) => lastProbedMs(a) - lastProbedMs(b));
  return { platform, pillar: ranked[0], untested };
}

// ---- data separation: the exploration bucket, kept OUT of route.ts's main resonance figures ----

// Same engagement weighting as route.ts's loadData / resonance.ts, but scoped to
// EXPLORATION_SOURCE rows only — the mirror image of loadData()'s exclusion, so a probe's
// engagement is trackable as its own bucket without ever touching the main pillar/platform cells.
// `db` is injectable for tests (see routing-drift.ts's hasNoSpinControl for the same pattern).
export function loadExplorationData(db: ReturnType<typeof openDb>, range?: WindowRange, context?: StrategyMeasurementContext): Map<string, Cell> {
  if (!context) throw new Error("strategy measurement requires explicit brand context");
  const latest = latestMetricsJoin(context);
  const scope = measurementScope(context, "p", "m");
  const dateClause = range ? `AND p.posted_at >= ? AND p.posted_at < ?` : "";
  const dateParams = range ? [new Date(range.startMs).toISOString(), new Date(range.endMs).toISOString()] : [];
  const rows = db
    .prepare(
      `SELECT p.platform, p.pillar,
              COUNT(*) AS n,
              AVG(COALESCE(m.likes,0) + 3*COALESCE(m.replies,0) + 2*COALESCE(m.reposts,0)) AS avg_eng
       FROM posts p JOIN (${latest.sql}) m ON m.post_id = p.id
       WHERE p.pillar IS NOT NULL AND p.source = ? AND ${scope.sql} ${dateClause}
       GROUP BY p.platform, p.pillar`
    )
    .all(...latest.params, EXPLORATION_SOURCE, ...scope.params, ...dateParams) as { platform: string; pillar: string; n: number; avg_eng: number }[];

  const cells = new Map<string, Cell>();
  for (const r of rows) cells.set(`${r.platform}|${r.pillar}`, { n: r.n, avg_eng: r.avg_eng });
  return cells;
}

// Don't surface a bucket until it has enough probes to say anything (Muxin's n>=3 gate).
const COVERAGE_MIN_N = 3;

// Markdown block for /strategy's brief. Only lists untested pillar/platform cells that have
// reached COVERAGE_MIN_N probes — everything below that stays silent rather than emit noise.
export function formatExplorationCoverage(cells: Map<string, Cell>, cfg: RoutingConfig): string {
  const rows: string[] = [];
  for (const platform of EXPLORATION_PLATFORMS) {
    for (const pillar of untestedPillars(platform, cfg)) {
      const cell = cells.get(`${platform}|${pillar}`);
      if (!cell || cell.n < COVERAGE_MIN_N) continue;
      rows.push(`| ${platform} | ${pillar} | ${cell.n} | ${cell.avg_eng.toFixed(1)} |`);
    }
  }
  const lines = [
    `## Exploration coverage\n`,
    `Off-assignment pillar/platform probes (card 92bb2ae6), tracked separately from, and never ` +
      `folded into, the pillar/platform resonance figures route.ts and the routing drift flag use. ` +
      `Surfaced only once an untested pillar has reached n>=${COVERAGE_MIN_N} probes.\n`,
  ];
  if (rows.length === 0) {
    lines.push(`No untested pillar has reached n>=${COVERAGE_MIN_N} exploration probes yet.`);
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
      const cells = loadExplorationData(db, undefined, parseStrategyMeasurementContext());
      console.log(formatExplorationCoverage(cells, cfg));
    } finally {
      db.close();
    }
    return;
  }

  const dryRun = args.includes("--dry-run");
  const entries = readExplorationLedger();

  console.log(`\nexploration-budget${dryRun ? " [DRY RUN, no ledger write]" : ""}`);
  console.log("=".repeat(50));

  for (const platform of EXPLORATION_PLATFORMS) {
    const pick = nextExplorationProbe(platform, cfg, entries, Date.now());
    if (!pick) {
      const untested = untestedPillars(platform, cfg);
      const reason =
        untested.length === 0
          ? "no untested pillars for this platform"
          : "already probed this platform this calendar month";
      console.log(`${platform}: skip, ${reason}`);
      continue;
    }
    console.log(`${platform}: probe "${pick.pillar}" this month (untested: ${pick.untested.join(", ")})`);
    if (!dryRun) {
      const entry: ExplorationLedgerEntry = { platform, pillar: pick.pillar, probedAt: new Date().toISOString() };
      appendExplorationLedger(entry);
      entries.push(entry); // keep the in-memory copy consistent in case both platforms are due this run
    }
  }

  if (dryRun) {
    console.log("\nDry-run complete, no ledger entries written.");
  } else {
    console.log(
      `\nNext: for each platform picked above, route + draft that one probe:\n` +
        `  tsx src/strategy/route.ts --pillar <pillar> --explore <platform> --folder <content-folder>\n` +
        `then stamp the drafted derivative's frontmatter exploration_probe: true before it reaches review-queue.md.`
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
