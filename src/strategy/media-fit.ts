import { fileURLToPath } from "node:url";
import { openDb } from "../db/db.js";
import { CORE_TEXT, CONTROL_RUN_SOURCE, EXPLORATION_SOURCE, loadConfig, type RoutingConfig } from "./route.js";
import { loadStrategyConfig, type StrategyConfig } from "./platform-fit.js";

// Strategy lever B (card 27dc7d2d, epic 2ce597d7 "Close the loop"): a RECOMMENDATION, not
// auto-generation. Muxin decided (2026-07-15) this stays "recommend only" — the card's own literal
// test ("queues prioritized video derivatives") is structurally impossible without /atomize
// auto-invoking /video, which would bypass /video's deliberate human-review + cost-offer-first
// gates (CLAUDE.md rule 6). This script compares each platform's text engagement against its
// quote-card/video engagement and labels the read; /atomize's generation contract (always text +
// quote-card per routed platform) and /video's invocation model (always human-invoked) are both
// untouched. The read reaches /atomize only via the existing "Directives for atomization" brief
// channel (.claude/skills/atomize/SKILL.md step 2), same as any other strategy guidance.
//   tsx src/strategy/media-fit.ts   → ranked markdown recommendation to stdout

const WEEK_MS = 7 * 24 * 3600 * 1000;
const HALF_LIFE_WEEKS = 4; // matches snapshot.ts / resonance.ts / origin-compare.ts / platform-fit.ts

// Media types /atomize or /video can actually produce, i.e. the axis lever B is scoped to. "note"
// (a Substack Note) is a distinct channel with its own pipeline (/atomize notes) — not a lever B
// target — and "unknown" is unclassified legacy data. Both are excluded from comparison.
const COMPARABLE_MEDIA_TYPES = ["quote-card", "video"];

interface Row {
  platform: string;
  media_type: string;
  posted_at: string | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
}

// Raw per-post rows (platform, media_type, posted_at, engagement inputs), excluding BOTH
// CONTROL_RUN_SOURCE and EXPLORATION_SOURCE — same policy as route.ts's loadData and
// platform-fit.ts's loadRows, so a deliberate control/probe post never skews this recommendation.
export function loadRows(injectedDb?: ReturnType<typeof openDb>): Row[] {
  const db = injectedDb ?? openDb();
  const rows = db
    .prepare(
      `SELECT p.platform, p.media_type, p.posted_at, m.likes, m.replies, m.reposts
       FROM posts p
       JOIN (
         SELECT m.* FROM metrics m
         JOIN (SELECT post_id, MAX(captured_at) AS mc FROM metrics GROUP BY post_id) lm
           ON m.post_id = lm.post_id AND m.captured_at = lm.mc
       ) m ON m.post_id = p.id
       WHERE p.media_type IS NOT NULL AND p.media_type != 'unknown'
         AND (p.source IS NULL OR p.source NOT IN (?, ?))`
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

interface Cell {
  n: number;
  weeks: number;
  recencyWeightedAvg: number | null;
}

// Weeks-of-data scoped to THIS (platform, media_type) cell specifically, not the platform overall
// — a platform with years of text history but 2 weeks of quote-cards should read insufficient for
// the quote-card side of the comparison, matching Lever A's per-cell (not per-platform-wide)
// reliability bar.
function computeCell(rows: Row[], platform: string, mediaType: string, now: number): Cell {
  const group = rows.filter((r) => r.platform === platform && r.media_type === mediaType);
  if (group.length === 0) return { n: 0, weeks: 0, recencyWeightedAvg: null };
  const dated = group.map((r) => r.posted_at).filter((d): d is string => !!d).map((d) => new Date(d).getTime());
  const weeks = dated.length > 0 ? Math.max(1, Math.round((Math.min(now, Math.max(...dated)) - Math.min(...dated)) / WEEK_MS)) : 0;
  const wSum = group.reduce((s, r) => s + recencyWeight(r.posted_at, now), 0);
  const recencyWeightedAvg = wSum > 0 ? group.reduce((s, r) => s + engagement(r) * recencyWeight(r.posted_at, now), 0) / wSum : null;
  return { n: group.length, weeks, recencyWeightedAvg };
}

function hasData(cell: Cell, cfg: RoutingConfig): boolean {
  return cell.n >= cfg.thresholds.min_posts_for_data && cell.weeks >= 4;
}

export type MediaLabel = "lean-toward" | "steady" | "insufficient-data";

export interface MediaFitResult {
  platform: string;
  mediaType: string; // the non-text media type being compared against text
  label: MediaLabel;
  ratio: number | null; // mediaAvg / textAvg, null when insufficient
  mediaN: number;
  textN: number;
}

// The overfitting guard (Muxin's explicit concern, carried over from Lever A): insufficient data
// on EITHER side of the comparison always reads insufficient-data, never a forced lean/steady
// read, however extreme the raw ratio looks.
export function classifyMediaFit(
  platform: string,
  mediaType: string,
  rows: Row[],
  cfg: RoutingConfig,
  strategyCfg: StrategyConfig,
  now = Date.now()
): MediaFitResult {
  if (!strategyCfg.media_thresholds) {
    throw new Error("config/strategy.yaml is missing media_thresholds (lever B, card 27dc7d2d) — add a media_thresholds.lean_floor entry.");
  }
  const textCell = computeCell(rows, platform, "text", now);
  const mediaCell = computeCell(rows, platform, mediaType, now);

  if (!hasData(textCell, cfg) || !hasData(mediaCell, cfg) || (textCell.recencyWeightedAvg ?? 0) <= 0) {
    return { platform, mediaType, label: "insufficient-data", ratio: null, mediaN: mediaCell.n, textN: textCell.n };
  }

  const ratio = mediaCell.recencyWeightedAvg! / textCell.recencyWeightedAvg!;
  const label: MediaLabel = ratio >= strategyCfg.media_thresholds.lean_floor ? "lean-toward" : "steady";
  return { platform, mediaType, label, ratio, mediaN: mediaCell.n, textN: textCell.n };
}

const LABEL_ORDER: Record<MediaLabel, number> = { "lean-toward": 0, steady: 1, "insufficient-data": 2 };

export function rankMediaFit(rows: Row[], cfg: RoutingConfig, strategyCfg: StrategyConfig, now = Date.now()): MediaFitResult[] {
  const platforms = CORE_TEXT.filter((p) => rows.some((r) => r.platform === p));
  const results: MediaFitResult[] = [];
  for (const platform of platforms) {
    for (const mediaType of COMPARABLE_MEDIA_TYPES) {
      if (!rows.some((r) => r.platform === platform && r.media_type === mediaType)) continue; // never fabricate a read for a media type that's never been posted
      results.push(classifyMediaFit(platform, mediaType, rows, cfg, strategyCfg, now));
    }
  }
  return results.sort((a, b) => LABEL_ORDER[a.label] - LABEL_ORDER[b.label] || (b.ratio ?? -1) - (a.ratio ?? -1));
}

function labelText(r: MediaFitResult): string {
  switch (r.label) {
    case "lean-toward":
      return `lean toward ${r.mediaType}`;
    case "steady":
      return "steady (text default holds)";
    case "insufficient-data":
      return "insufficient data";
  }
}

function main() {
  const cfg = loadConfig();
  const strategyCfg = loadStrategyConfig();
  const rows = loadRows();
  const ranked = rankMediaFit(rows, cfg, strategyCfg);

  console.log(`# Media-type fit — ${new Date().toISOString().slice(0, 10)}\n`);
  console.log(
    `Recommendation only — nothing here auto-generates a quote+image variant or invokes /video. /atomize's generation contract (text + quote-card per routed platform) and /video's invocation model (always human-invoked) are unchanged; use a "lean toward" read as a data point when weighing the optional quote+image variant (SKILL.md step 7d) or whether to suggest /video (step 8).\n`
  );

  if (ranked.length === 0) {
    console.log("No tagged posts with metrics yet, or no non-text media type posted. Nothing to compare.");
    return;
  }

  const withData = ranked.filter((r) => r.label !== "insufficient-data");
  const thin = ranked.filter((r) => r.label === "insufficient-data");

  if (withData.length > 0) {
    console.log(`| Platform | vs. text | Read | Ratio | n (media/text) |`);
    console.log(`|---|---|---|---|---|`);
    for (const r of withData) {
      console.log(`| ${r.platform} | ${r.mediaType} | ${labelText(r)} | ${r.ratio!.toFixed(2)}x | ${r.mediaN}/${r.textN} |`);
    }
  } else {
    console.log("No platform/media-type pair has enough data yet (all read insufficient-data).");
  }

  if (thin.length > 0) {
    console.log(
      `\n${thin.length} platform/media-type pair(s) have insufficient data (n<${cfg.thresholds.min_posts_for_data} or <4wks on either side) — no read yet, not a forced recommendation:`
    );
    for (const r of thin) console.log(`- ${r.platform} / ${r.mediaType}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
