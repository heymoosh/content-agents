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
//   tsx src/strategy/route.ts --pillar civic-tech[,human-ai,...] [--folder content/<slug>]
//        → prints JSON decisions; writes <folder>/routing.md when --folder is given.
//          Multiple comma-separated pillars are merged in ONE pass (include if any pillar
//          includes, unless any pillar's `never` rule vetoes it) instead of overwriting
//          routing.md per invocation — always route a multi-pillar piece in one call.
//   tsx src/strategy/route.ts --all
//        → full pillar × platform routing-map markdown (for the strategy brief)
//   tsx src/strategy/route.ts --flags
//        → routing-drift.ts's persistent divergence flags (data vs config/routing.yaml
//          defaults, over two independent windows) — computed/printed only, never written back.

export const PILLARS = ["human-ai", "claude-code", "civic-tech", "career-work", "builder", "other"];
// Derivative target platforms routing chooses among. Substack is the source channel,
// not a target. Community targets come from config (defaults / rules), not the DB.
export const CORE_TEXT = ["x", "linkedin", "bluesky"];
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

export type Confidence = "data" | "cold-start" | "rule" | "always";

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

function loadConfig(): RoutingConfig {
  return parse(readFileSync(join(repoRoot, "config", "routing.yaml"), "utf8")) as RoutingConfig;
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
export function loadData(range?: WindowRange): LoadedData {
  const db = openDb();
  const dateClause = range ? `AND p.posted_at >= ? AND p.posted_at < ?` : "";
  const dateParams = range ? [new Date(range.startMs).toISOString(), new Date(range.endMs).toISOString()] : [];
  const rows = db
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
       WHERE p.pillar IS NOT NULL ${dateClause}
       GROUP BY p.platform, p.pillar`
    )
    .all(...dateParams) as { platform: string; pillar: string; n: number; avg_eng: number }[];

  const dates = db
    .prepare(
      `SELECT platform, posted_at FROM posts p WHERE posted_at IS NOT NULL ${dateClause}`
    )
    .all(...dateParams) as { platform: string; posted_at: string }[];
  db.close();

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
      const confOrder: Confidence[] = ["always", "rule", "data", "cold-start"];
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
  const merged: MergedDecision[] =
    pillars.length === 1
      ? perPillar.get(pillars[0])!.map((d) => ({ ...d, pillars: [pillars[0]] }))
      : mergeDecisions(pillars, perPillar);

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
