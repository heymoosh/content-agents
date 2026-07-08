import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { openDb, repoRoot } from "../db/db.js";
import { runDriftCheck } from "./routing-drift.js";

// Intelligent content router: decide which platforms a piece should be posted to,
// from analytics (resonance) + editorial config (config/routing.yaml) + a graceful
// cold-start. Routing GATES generation in /atomize; Muxin's review stays the final gate.
//
//   tsx src/strategy/route.ts --pillar civic-tech[,human-ai,...] [--folder content/<slug>] [--explore <platform>]
//        → prints JSON decisions; writes <folder>/routing.md when --folder is given.
//          Multiple comma-separated pillars are merged in ONE pass (include if any pillar
//          includes, unless any pillar's `never` rule vetoes it) instead of overwriting
//          routing.md per invocation — always route a multi-pillar piece in one call.
//          `--explore <platform>` (single-pillar calls only) forces that ONE platform's decision
//          to `include`, confidence "exploration" — the exploration-budget probe (card 92bb2ae6,
//          src/strategy/exploration.ts) for an off-assignment pillar/platform pair. Muxin's normal
//          review-queue.md approval still gates publishing; the derivative drafted from this
//          routing.md should be stamped `exploration_probe: true` in its frontmatter so
//          tag-source.ts/loadData can exclude its eventual post from the main resonance figures.
//   tsx src/strategy/route.ts --all
//        → full pillar × platform routing-map markdown (for the strategy brief)
//   tsx src/strategy/route.ts --flags
//        → routing-drift.ts's persistent divergence flags (data vs config/routing.yaml
//          defaults, over two independent windows) — computed/printed only, never written back.

export const PILLARS = ["human-ai", "claude-code", "civic-tech", "career-work", "builder", "other"];
// Derivative target platforms routing chooses among. Substack is the source channel,
// not a target. Community targets come from config (defaults / rules), not the DB.
export const CORE_TEXT = ["x", "linkedin", "bluesky"];
// posts.source value for a deliberate --no-spin control run (card f444f440, src/strategy/spin-
// control.ts): a periodic verbatim derivative drafted for an ALREADY-ASSIGNED pillar/platform
// pair so routing-drift.ts's no-spin-control check has a live baseline (Spin is the always-on
// default now, so a plain verbatim post no longer happens on its own). loadData() below excludes
// these rows from the pillar/platform resonance figures decideForPillar/routing-drift.ts read —
// see spin-control.ts's loadControlData for the separate bucket these rows DO feed.
export const CONTROL_RUN_SOURCE = "spin-control-run";
// posts.source value for an exploration-budget probe post (card 92bb2ae6): a derivative
// deliberately drafted for an off-assignment pillar/platform pair, tagged `exploration_probe:
// true` in frontmatter, recorded via the `| exploration` Placed-log marker (queue.ts) and
// classified back onto the post by tag-source.ts. loadData() below excludes these rows from the
// pillar/platform resonance figures decideForPillar/routing-drift.ts read — see
// src/strategy/exploration.ts for the separate coverage bucket these rows DO feed.
export const EXPLORATION_SOURCE = "exploration-probe";
const WEEK = 7 * 24 * 3600 * 1000;

export interface RoutingConfig {
  defaults: Record<string, string[]>;
  rules: Record<string, { always?: string[]; never?: string[] }>;
  thresholds: {
    min_posts_for_data: number;
    skip_below_score: number;
    always_consider: string[];
  };
}

// "exploration" is stamped only by applyExplorationOverride below — decideForPillar/mergeDecisions
// never produce it on their own; it marks a one-off exploration-budget probe (card 92bb2ae6).
export type Confidence = "data" | "cold-start" | "rule" | "always" | "exploration";

export interface Decision {
  platform: string;
  decision: "include" | "skip";
  score: number | null; // 0..1 normalized fit, null when not data-driven
  confidence: Confidence;
  rationale: string;
}

export interface Cell {
  n: number;
  avg_eng: number;
}

// A date-bounded window (ms since epoch, half-open [startMs, endMs)) for scoping loadData to a
// slice of history — used by routing-drift.ts to score two independent windows separately.
export interface WindowRange {
  startMs: number;
  endMs: number;
}

export interface LoadedData {
  cells: Map<string, Cell>; // key: `${platform}|${pillar}`
  weeks: Map<string, number>; // key: platform
  baselines: Map<string, number>; // key: platform → avg engagement per post on that platform
}

export function loadConfig(): RoutingConfig {
  return parse(readFileSync(join(repoRoot, "config", "routing.yaml"), "utf8")) as RoutingConfig;
}

interface EngagementCellRow {
  platform: string;
  pillar: string;
  n: number;
  avg_eng: number;
}

// Shared pillar × platform engagement query (same weighting + latest-metrics CTE used by
// resonance.ts) behind a `sourceClause`/`sourceParams` the caller supplies — loadData() below
// uses it to EXCLUDE both CONTROL_RUN_SOURCE and EXPLORATION_SOURCE rows; spin-control.ts's
// loadControlData REQUIREs CONTROL_RUN_SOURCE and exploration.ts's loadExplorationData REQUIREs
// EXPLORATION_SOURCE, over the exact same join/formula so the buckets can never silently drift
// apart on an engagement-weighting change (only one query to update).
export function queryEngagementCells(
  db: ReturnType<typeof openDb>,
  sourceClause: string,
  sourceParams: unknown[],
  dateClause: string,
  dateParams: unknown[]
): EngagementCellRow[] {
  return db
    .prepare(
      `SELECT p.platform, p.pillar,
              COUNT(*) AS n,
              AVG(COALESCE(m.likes,0) + 3*COALESCE(m.replies,0) + 2*COALESCE(m.reposts,0)) AS avg_eng
       FROM posts p
       JOIN (
         SELECT m.* FROM metrics m
         JOIN (SELECT post_id, MAX(captured_at) AS mc FROM metrics GROUP BY post_id) lm
           ON m.post_id = lm.post_id AND m.captured_at = lm.mc
       ) m ON m.post_id = p.id
       WHERE p.pillar IS NOT NULL ${sourceClause} ${dateClause}
       GROUP BY p.platform, p.pillar`
    )
    .all(...sourceParams, ...dateParams) as EngagementCellRow[];
}

// Pillar × platform engagement (same weighting + latest-metrics CTE as resonance.ts),
// plus weeks-of-data per platform (same as snapshot.ts) for confidence, plus a per-platform
// engagement baseline. The baseline matters because engagement scales are NOT comparable across
// platforms: X is a weighted replies/reposts/likes score (single digits) while LinkedIn carries
// one lumped "Engagements" count per post (often 100+). We judge each platform on its own scale.
//
// `range`, when given, scopes every query to posts with posted_at in [range.startMs, range.endMs)
// — used by routing-drift.ts to load two independent windows of history separately, through this
// SAME function, rather than duplicating the score math.
// `injectedDb`, when given, is used instead of opening the real analytics.db (and is left open —
// caller owns its lifecycle). Test-only hook — unlike routing-drift.ts's hasNoSpinControl or
// exploration.ts's loadExplorationData (both take db as a required FIRST param), this one is an
// optional LAST param that self-opens/closes when omitted.
//
// CONTROL_RUN_SOURCE and EXPLORATION_SOURCE rows are both excluded from BOTH queries below — a
// deliberate --no-spin control run (card f444f440) or an exploration-budget probe (card 92bb2ae6)
// must never feed the pillar/platform resonance figures decideForPillar or routing-drift.ts's
// detectDrift read. Their own separate buckets live in spin-control.ts's loadControlData and
// exploration.ts's loadExplorationData, over the SAME posts but scoped to one source each.
export function loadData(range?: WindowRange, injectedDb?: ReturnType<typeof openDb>): LoadedData {
  const db = injectedDb ?? openDb();
  const dateClause = range ? `AND p.posted_at >= ? AND p.posted_at < ?` : "";
  const dateParams = range ? [new Date(range.startMs).toISOString(), new Date(range.endMs).toISOString()] : [];
  const rows = queryEngagementCells(
    db,
    "AND (p.source IS NULL OR p.source NOT IN (?, ?))",
    [CONTROL_RUN_SOURCE, EXPLORATION_SOURCE],
    dateClause,
    dateParams
  );

  const dates = db
    .prepare(
      `SELECT platform, posted_at FROM posts p WHERE posted_at IS NOT NULL AND (p.source IS NULL OR p.source NOT IN (?, ?)) ${dateClause}`
    )
    .all(CONTROL_RUN_SOURCE, EXPLORATION_SOURCE, ...dateParams) as { platform: string; posted_at: string }[];
  if (!injectedDb) db.close();

  const cells = new Map<string, Cell>();
  for (const r of rows) cells.set(`${r.platform}|${r.pillar}`, { n: r.n, avg_eng: r.avg_eng });

  // Per-platform baseline = average engagement per post on that platform (post-weighted across
  // its pillars). Used to score each pillar relative to the platform's own norm.
  const baseTotals = new Map<string, { sum: number; n: number }>();
  for (const r of rows) {
    const b = baseTotals.get(r.platform) ?? { sum: 0, n: 0 };
    b.sum += r.avg_eng * r.n;
    b.n += r.n;
    baseTotals.set(r.platform, b);
  }
  const baselines = new Map<string, number>();
  for (const [pl, b] of baseTotals) baselines.set(pl, b.n > 0 ? b.sum / b.n : 0);

  const byPlatform = new Map<string, number[]>();
  for (const d of dates) {
    const t = new Date(d.posted_at).getTime();
    if (Number.isNaN(t)) continue;
    const list = byPlatform.get(d.platform) ?? [];
    list.push(t);
    byPlatform.set(d.platform, list);
  }
  const cap = range?.endMs ?? Date.now();
  const weeks = new Map<string, number>();
  for (const [pl, ts] of byPlatform) {
    weeks.set(pl, Math.max(1, Math.round((Math.min(cap, Math.max(...ts)) - Math.min(...ts)) / WEEK)));
  }
  return { cells, weeks, baselines };
}

// Fit = this pillar's avg engagement relative to the platform's average post. Each platform is
// scored on its OWN scale, so X (small weighted scores) and LinkedIn (large lumped engagement
// counts) are never compared in absolute terms. A pillar at the platform's norm scores ~1.0;
// skip_below_score is the fraction-of-norm floor. `hasData` reuses the exact same sample floor
// everywhere it's checked (route.ts and routing-drift.ts): n >= min_posts_for_data AND weeks >= 4.
//
// NOTE: this score is for VISIBILITY/CONFIDENCE only — it no longer drives the include/skip
// decision (see decideForPillar). routing-drift.ts's persistent-divergence flags are the intended
// place to act on a data/defaults mismatch, as a surfaced-for-review flag, not an auto-override.
export interface FitResult {
  hasData: boolean;
  score: number | null; // 0..1 normalized fit, null when data is insufficient
  n: number;
  weeks: number;
}

export function computeFit(platform: string, pillar: string, cfg: RoutingConfig, data: LoadedData): FitResult {
  const cell = data.cells.get(`${platform}|${pillar}`); // only core text platforms carry data
  const weeks = data.weeks.get(platform) ?? 0;
  const hasData = !!cell && cell.n >= cfg.thresholds.min_posts_for_data && weeks >= 4;
  if (!cell) return { hasData, score: null, n: 0, weeks };
  const baseline = data.baselines.get(platform) ?? 0;
  const score = baseline > 0 ? cell.avg_eng / baseline : 0;
  return { hasData, score, n: cell.n, weeks };
}

export function decideForPillar(pillar: string, cfg: RoutingConfig, data: LoadedData): Decision[] {
  const defaults = cfg.defaults[pillar] ?? [];
  const rule = cfg.rules[pillar] ?? {};
  const always = new Set(rule.always ?? []);
  const never = new Set(rule.never ?? []);

  // Candidate targets: the core text platforms + anything config names for this pillar.
  const candidates = [...new Set([...CORE_TEXT, ...defaults, ...always, ...never])];

  const out: Decision[] = [];
  for (const platform of candidates) {
    if (never.has(platform)) {
      out.push({ platform, decision: "skip", score: null, confidence: "rule", rationale: "editorial rule: never route here" });
      continue;
    }
    if (always.has(platform)) {
      out.push({ platform, decision: "include", score: null, confidence: "rule", rationale: "editorial rule: always route here" });
      continue;
    }

    // The decision is ALWAYS defaults-driven — config/routing.yaml's defaults list is the single
    // source of truth for include/skip, at any data volume. Score is computed and attached below
    // (when data is sufficient) for visibility/confidence only; it never flips the decision.
    // (Muxin's locked call, card 7e550e48: a fit score overriding the editorial defaults list —
    // in either direction — was surprising Muxin. Persistent divergences are surfaced separately
    // by routing-drift.ts's `--flags` mode, as a review prompt, not an auto-override.)
    const inDefaults = defaults.includes(platform);
    const decision: "include" | "skip" = inDefaults ? "include" : "skip";
    const fit = computeFit(platform, pillar, cfg, data);

    if (fit.hasData) {
      out.push({
        platform,
        decision,
        score: fit.score,
        confidence: "data",
        rationale: `config default: ${decision} — data shows ${fit.score!.toFixed(2)}× platform norm (n=${fit.n})`,
      });
    } else {
      const why = fit.n === 0 ? "no tagged data yet" : fit.weeks < 4 ? "<4wks data" : `only n=${fit.n} posts`;
      out.push({
        platform,
        decision,
        score: null,
        confidence: "cold-start",
        rationale: inDefaults
          ? `cold-start (${why}) — posting broadly to gather signal`
          : `cold-start (${why}) — not a default target for this pillar`,
      });
    }
  }

  // Format assets are always generated, never platform-gated.
  for (const asset of cfg.thresholds.always_consider) {
    out.push({ platform: asset, decision: "include", score: null, confidence: "always", rationale: "format asset — always generated" });
  }
  return out;
}

// A platform is included if ANY listed pillar includes it, EXCEPT an explicit `never` rule from
// ANY pillar is a hard veto that no other pillar's include can override — this is the enforcement
// point for "if the data/strategy doesn't support this platform for this category, never draft
// for it," applied once per multi-pillar piece instead of by hand-merging routing.md per pillar.
export interface MergedDecision extends Decision {
  pillars: string[]; // which pillar(s) this decision draws from
}

export function mergeDecisions(pillars: string[], perPillar: Map<string, Decision[]>): MergedDecision[] {
  const platforms = new Set<string>();
  for (const decs of perPillar.values()) for (const d of decs) platforms.add(d.platform);

  const merged: MergedDecision[] = [];
  for (const platform of platforms) {
    const byPillar = pillars
      .map((pillar) => ({ pillar, d: (perPillar.get(pillar) ?? []).find((x) => x.platform === platform) }))
      .filter((x): x is { pillar: string; d: Decision } => !!x.d);

    const veto = byPillar.find((p) => p.d.decision === "skip" && p.d.confidence === "rule");
    if (veto) {
      merged.push({
        platform,
        decision: "skip",
        score: null,
        confidence: "rule",
        rationale: `hard veto: ${veto.pillar} editorial rule says never route here (overrides any other pillar's include)`,
        pillars: [veto.pillar],
      });
      continue;
    }

    const includes = byPillar.filter((p) => p.d.decision === "include");
    if (includes.length > 0) {
      const confOrder: Confidence[] = ["always", "rule", "data", "cold-start", "exploration"];
      const confidence = confOrder.find((c) => includes.some((p) => p.d.confidence === c)) ?? "cold-start";
      const scores = includes.map((p) => p.d.score).filter((s): s is number => s != null);
      merged.push({
        platform,
        decision: "include",
        score: scores.length ? Math.max(...scores) : null,
        confidence,
        // Semicolon-joined (not " | ") because this rationale lands in a markdown table cell —
        // validate.ts's routing-gate parser splits table rows on "|", so a literal pipe here
        // would shift columns. Platform/decision are still always columns 1/2 either way, but
        // semicolons keep the row human-readable.
        rationale: includes.map((p) => `${p.pillar}: ${p.d.rationale}`).join("; "),
        pillars: includes.map((p) => p.pillar),
      });
    } else {
      merged.push({
        platform,
        decision: "skip",
        score: null,
        confidence: byPillar[0]?.d.confidence ?? "cold-start",
        rationale: byPillar.map((p) => `${p.pillar}: ${p.d.rationale}`).join("; ") || "no pillar considered this platform",
        pillars: [],
      });
    }
  }
  return merged;
}

// The exploration budget's routing hook (card 92bb2ae6, src/strategy/exploration.ts): force ONE
// platform's decision to `include` for a single-pillar routing pass, even though config/
// routing.yaml's defaults don't list it there. Pure and additive — a platform already `include`d
// by the normal defaults-driven decision is left untouched (an exploration probe only matters for
// an off-assignment pair; overriding an already-included one would be a no-op that muddies the
// rationale), and a platform under an explicit editorial `never` rule (confidence "rule") is also
// left untouched — an exploration probe must never punch through a hard veto Muxin set on purpose.
// The distinct "exploration" confidence + rationale is what lets the drafted derivative be stamped
// `exploration_probe: true` and later excluded from resonance figures (see EXPLORATION_SOURCE /
// loadData).
export function applyExplorationOverride(merged: MergedDecision[], pillar: string, platform: string): MergedDecision[] {
  return merged.map((d) => {
    if (d.platform !== platform || d.decision === "include" || d.confidence === "rule") return d;
    return {
      ...d,
      decision: "include",
      confidence: "exploration",
      rationale:
        `exploration probe (card 92bb2ae6): off-assignment probe for "${pillar}" on ${platform} this cycle — ` +
        `stamp the drafted derivative exploration_probe: true (see src/strategy/exploration.ts)`,
      pillars: [...new Set([...d.pillars, pillar])],
    };
  });
}

function routingMd(pillars: string[], merged: MergedDecision[]): string {
  const fit = (d: MergedDecision) => (d.score == null ? "—" : d.score.toFixed(2));
  const rows = merged
    .map((d) => `| ${d.platform} | ${d.decision} | ${fit(d)} | ${d.confidence} | ${d.rationale} |`)
    .join("\n");
  const header =
    pillars.length > 1
      ? `# Routing — ${pillars.join(" + ")} — ${new Date().toISOString().slice(0, 10)}\n\n` +
        `Generated by \`npm run route\` from analytics + config/routing.yaml, merged across ${pillars.length} pillars in one ` +
        `pass: a platform is \`include\` if ANY pillar includes it, UNLESS any pillar's editorial \`never\` rule vetoes it ` +
        `(that veto wins regardless of other pillars). Only \`include\` platforms are atomized and queued; Muxin's ` +
        `review-queue approval stays the final gate. \`npm run validate\` hard-fails any derivative drafted for a ` +
        `platform marked \`skip\` here.\n\n`
      : `# Routing — ${pillars[0]} — ${new Date().toISOString().slice(0, 10)}\n\n` +
        `Generated by \`npm run route\` from analytics + config/routing.yaml. Only \`include\` platforms are atomized ` +
        `and queued; Muxin's review-queue approval stays the final gate. \`npm run validate\` hard-fails any derivative ` +
        `drafted for a platform marked \`skip\` here.\n\n`;
  return header + `| platform | decision | fit | confidence | why |\n|---|---|---|---|---|\n${rows}\n`;
}

function main() {
  const args = process.argv.slice(2);
  const cfg = loadConfig();

  if (args.includes("--flags")) {
    // Persistent divergence flags: data vs config/routing.yaml's defaults, over two independent
    // windows. Computed/printed only — see routing-drift.ts; makes zero writes to any config file.
    const { report } = runDriftCheck(PILLARS, cfg);
    console.log(report);
    return;
  }

  const data = loadData();

  if (args.includes("--all")) {
    const targets = [...new Set(PILLARS.flatMap((p) => decideForPillar(p, cfg, data).map((d) => d.platform)))]
      .filter((t) => !cfg.thresholds.always_consider.includes(t))
      .sort();
    console.log(`# Routing map — ${new Date().toISOString().slice(0, 10)}\n`);
    console.log(`Where each pillar should post. \`include\`/\`skip\` from analytics + config/routing.yaml; format assets (${cfg.thresholds.always_consider.join(", ")}) always generated.\n`);
    console.log(`| Pillar | ${targets.join(" | ")} |`);
    console.log(`|---|${targets.map(() => "---").join("|")}|`);
    for (const pillar of PILLARS) {
      const dec = decideForPillar(pillar, cfg, data);
      const cells = targets.map((t) => {
        const d = dec.find((x) => x.platform === t);
        return d ? d.decision : "—";
      });
      console.log(`| ${pillar} | ${cells.join(" | ")} |`);
    }
    console.log(`\n> Cold-start pillars post broadly to their config defaults until ≥4 weeks of data accrue; routing tightens as data lands.`);
    return;
  }

  const pi = args.indexOf("--pillar");
  const pillarArg = pi >= 0 ? args[pi + 1] : undefined;
  const pillars = pillarArg ? [...new Set(pillarArg.split(",").map((p) => p.trim()))] : undefined;
  if (!pillars || pillars.length === 0 || pillars.some((p) => !PILLARS.includes(p))) {
    console.error(
      `usage: tsx src/strategy/route.ts --pillar <${PILLARS.join("|")}>[,<pillar2>,...] [--folder <content-folder>]  |  --all  |  --flags`
    );
    process.exit(1);
  }
  const perPillar = new Map(pillars.map((p) => [p, decideForPillar(p, cfg, data)]));
  let merged: MergedDecision[] =
    pillars.length === 1
      ? perPillar.get(pillars[0])!.map((d) => ({ ...d, pillars: [pillars[0]] }))
      : mergeDecisions(pillars, perPillar);

  const exploreIdx = args.indexOf("--explore");
  if (exploreIdx >= 0) {
    const explorePlatform = args[exploreIdx + 1];
    if (!explorePlatform) {
      console.error("--explore requires a platform argument, e.g. --explore linkedin");
      process.exit(1);
    }
    if (pillars.length !== 1) {
      console.error("--explore requires exactly one --pillar (an exploration probe targets one pillar/platform pair)");
      process.exit(1);
    }
    if (!merged.some((d) => d.platform === explorePlatform)) {
      console.error(
        `--explore: "${explorePlatform}" is not a candidate platform for pillar "${pillars[0]}" (candidates: ${merged.map((d) => d.platform).join(", ")})`
      );
      process.exit(1);
    }
    merged = applyExplorationOverride(merged, pillars[0], explorePlatform);
  }

  const fo = args.indexOf("--folder");
  if (fo >= 0 && args[fo + 1]) {
    const folder = args[fo + 1];
    const abs = folder.startsWith("/") ? folder : join(repoRoot, folder);
    writeFileSync(join(abs, "routing.md"), routingMd(pillars, merged));
    console.error(`wrote ${join(abs, "routing.md")}`);
  }
  console.log(JSON.stringify({ pillars, decisions: merged }, null, 2));
}

// Run only as a CLI entry point — importing mergeDecisions/decideForPillar for tests must not
// execute main() (which opens the db and calls process.exit on bad args).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
