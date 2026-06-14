import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { openDb, repoRoot } from "../db/db.js";

// Intelligent content router: decide which platforms a piece should be posted to,
// from analytics (resonance) + editorial config (config/routing.yaml) + a graceful
// cold-start. Routing GATES generation in /atomize; Muxin's review stays the final gate.
//
//   tsx src/strategy/route.ts --pillar civic-tech [--folder content/<slug>]
//        → prints JSON decisions; writes <folder>/routing.md when --folder is given
//   tsx src/strategy/route.ts --all
//        → full pillar × platform routing-map markdown (for the strategy brief)

const PILLARS = ["human-ai", "claude-code", "civic-tech", "other"];
// Derivative target platforms routing chooses among. Substack is the source channel,
// not a target. Community targets come from config (defaults / rules), not the DB.
const CORE_TEXT = ["x", "linkedin", "bluesky"];
const WEEK = 7 * 24 * 3600 * 1000;

interface RoutingConfig {
  defaults: Record<string, string[]>;
  rules: Record<string, { always?: string[]; never?: string[] }>;
  thresholds: {
    min_posts_for_data: number;
    skip_below_score: number;
    always_consider: string[];
  };
}

type Confidence = "data" | "cold-start" | "rule" | "always";

interface Decision {
  platform: string;
  decision: "include" | "skip";
  score: number | null; // 0..1 normalized fit, null when not data-driven
  confidence: Confidence;
  rationale: string;
}

interface Cell {
  n: number;
  avg_eng: number;
}

function loadConfig(): RoutingConfig {
  return parse(readFileSync(join(repoRoot, "config", "routing.yaml"), "utf8")) as RoutingConfig;
}

// Pillar × platform engagement (same weighting + latest-metrics CTE as resonance.ts),
// plus weeks-of-data per platform (same as snapshot.ts) for confidence.
function loadData(): {
  cells: Map<string, Cell>; // key: `${platform}|${pillar}`
  weeks: Map<string, number>; // key: platform
} {
  const db = openDb();
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
       WHERE p.pillar IS NOT NULL
       GROUP BY p.platform, p.pillar`
    )
    .all() as { platform: string; pillar: string; n: number; avg_eng: number }[];

  const dates = db
    .prepare(`SELECT platform, posted_at FROM posts WHERE posted_at IS NOT NULL`)
    .all() as { platform: string; posted_at: string }[];
  db.close();

  const cells = new Map<string, Cell>();
  for (const r of rows) cells.set(`${r.platform}|${r.pillar}`, { n: r.n, avg_eng: r.avg_eng });

  const byPlatform = new Map<string, number[]>();
  for (const d of dates) {
    const t = new Date(d.posted_at).getTime();
    if (Number.isNaN(t)) continue;
    const list = byPlatform.get(d.platform) ?? [];
    list.push(t);
    byPlatform.set(d.platform, list);
  }
  const now = Date.now();
  const weeks = new Map<string, number>();
  for (const [pl, ts] of byPlatform) {
    weeks.set(pl, Math.max(1, Math.round((Math.min(now, Math.max(...ts)) - Math.min(...ts)) / WEEK)));
  }
  return { cells, weeks };
}

function decideForPillar(
  pillar: string,
  cfg: RoutingConfig,
  data: { cells: Map<string, Cell>; weeks: Map<string, number> }
): Decision[] {
  const defaults = cfg.defaults[pillar] ?? [];
  const rule = cfg.rules[pillar] ?? {};
  const always = new Set(rule.always ?? []);
  const never = new Set(rule.never ?? []);
  const { min_posts_for_data, skip_below_score } = cfg.thresholds;

  // Candidate targets: the core text platforms + anything config names for this pillar.
  const candidates = [...new Set([...CORE_TEXT, ...defaults, ...always, ...never])];

  // Normalize fit against the strongest confident platform for this pillar.
  const confident = CORE_TEXT.map((pl) => data.cells.get(`${pl}|${pillar}`))
    .filter((c): c is Cell => !!c && c.n >= min_posts_for_data)
    .map((c) => c.avg_eng);
  const maxEng = confident.length ? Math.max(...confident) : 0;

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
    const cell = data.cells.get(`${platform}|${pillar}`); // only core text platforms carry data
    const weeks = data.weeks.get(platform) ?? 0;
    const hasData = !!cell && cell.n >= min_posts_for_data && weeks >= 4;
    if (hasData && cell) {
      const score = maxEng > 0 ? cell.avg_eng / maxEng : 0;
      const decision = score >= skip_below_score ? "include" : "skip";
      out.push({
        platform,
        decision,
        score,
        confidence: "data",
        rationale:
          decision === "include"
            ? `data: ${score.toFixed(2)} fit (n=${cell.n}) — receptive to this topic`
            : `data: ${score.toFixed(2)} fit (n=${cell.n}) — underperforms for this topic`,
      });
    } else {
      // Cold start: post broadly to the configured defaults to gather signal; otherwise hold.
      const inDefaults = defaults.includes(platform);
      const why = !cell
        ? "no tagged data yet"
        : weeks < 4
          ? "<4wks data"
          : `only n=${cell.n} posts`;
      out.push({
        platform,
        decision: inDefaults ? "include" : "skip",
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

function routingMd(pillar: string, decisions: Decision[]): string {
  const fit = (d: Decision) => (d.score == null ? "—" : d.score.toFixed(2));
  const rows = decisions
    .map((d) => `| ${d.platform} | ${d.decision} | ${fit(d)} | ${d.confidence} | ${d.rationale} |`)
    .join("\n");
  return (
    `# Routing — ${pillar} — ${new Date().toISOString().slice(0, 10)}\n\n` +
    `Generated by \`npm run route\` from analytics + config/routing.yaml. Only \`include\` ` +
    `platforms are atomized and queued; Muxin's review-queue approval stays the final gate.\n\n` +
    `| platform | decision | fit | confidence | why |\n|---|---|---|---|---|\n${rows}\n`
  );
}

function main() {
  const args = process.argv.slice(2);
  const cfg = loadConfig();
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
  const pillar = pi >= 0 ? args[pi + 1] : undefined;
  if (!pillar || !PILLARS.includes(pillar)) {
    console.error(`usage: tsx src/strategy/route.ts --pillar <${PILLARS.join("|")}> [--folder <content-folder>]  |  --all`);
    process.exit(1);
  }
  const decisions = decideForPillar(pillar, cfg, data);

  const fo = args.indexOf("--folder");
  if (fo >= 0 && args[fo + 1]) {
    const folder = args[fo + 1];
    const abs = folder.startsWith("/") ? folder : join(repoRoot, folder);
    writeFileSync(join(abs, "routing.md"), routingMd(pillar, decisions));
    console.error(`wrote ${join(abs, "routing.md")}`);
  }
  console.log(JSON.stringify({ pillar, decisions }, null, 2));
}

main();
