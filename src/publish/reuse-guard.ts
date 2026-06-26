import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { repoRoot } from "../db/db.js";

// Reuse-frequency guard: prevents re-publishing the same content slug to the same platform
// too soon after its last placement. Reads the bets.md Placed log (briefs/bets.md), which is
// the canonical append-only record of every shipped asset.
//
// Usage:
//   const result = checkReuse("2026-06-25-my-essay", "linkedin");
//   if (!result.allowed) console.warn(result.reason);

const BETS_PATH = join(repoRoot, "briefs", "bets.md");
const FALLBACK_MIN_DAYS = 30;

export interface ReuseCheckResult {
  allowed: boolean;
  reason?: string;        // set when !allowed
  lastPlacedAt?: string;  // ISO timestamp of the most recent matching placement (if any)
  daysSince?: number;     // days since last placement (if any)
}

// Load per-platform min_reuse_days from config/platforms.yaml.
// Falls back to the top-level `min_reuse_days:` key, then to FALLBACK_MIN_DAYS.
function loadMinDays(): { global: number; perPlatform: Record<string, number> } {
  try {
    const cfg = parseYaml(readFileSync(join(repoRoot, "config", "platforms.yaml"), "utf8")) as {
      min_reuse_days?: number;
      platforms?: Record<string, { min_reuse_days?: number }>;
    };
    const global = cfg.min_reuse_days ?? FALLBACK_MIN_DAYS;
    const perPlatform: Record<string, number> = {};
    for (const [k, v] of Object.entries(cfg.platforms ?? {})) {
      if (typeof v.min_reuse_days === "number") perPlatform[k] = v.min_reuse_days;
    }
    return { global, perPlatform };
  } catch {
    return { global: FALLBACK_MIN_DAYS, perPlatform: {} };
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Scan the Placed log in briefs/bets.md for lines that match this slug+platform.
// Lines look like:
//   - placed 2026-06-25T12:00:00.000Z [slug/rowId] platform → ref ...
function findLastPlacement(slug: string, platform: string): { iso: string; ms: number } | null {
  if (!existsSync(BETS_PATH)) return null;
  const content = readFileSync(BETS_PATH, "utf8");

  // Match every placed line for this slug (any derivative row ID).
  const linePattern = new RegExp(
    `^- placed (\\S+) \\[${escapeRegex(slug)}/[^\\]]+\\] (\\S+) →`,
    "gm"
  );

  let latestMs = 0;
  let latestIso = "";
  let m: RegExpExecArray | null;
  while ((m = linePattern.exec(content)) !== null) {
    if (m[2] !== platform) continue; // different platform on this line
    const t = new Date(m[1]).getTime();
    if (!isNaN(t) && t > latestMs) {
      latestMs = t;
      latestIso = m[1];
    }
  }

  return latestMs > 0 ? { iso: latestIso, ms: latestMs } : null;
}

// Check whether `slug` may be published to `platform`.
// `slug` = basename of the content folder (e.g. "2026-06-25-my-essay").
// `platform` = platform key used in bets.md (e.g. "x", "linkedin", "bluesky", "quote-card").
// `minDaysOverride` = skip config lookup and use this value directly (useful in tests).
export function checkReuse(
  slug: string,
  platform: string,
  minDaysOverride?: number
): ReuseCheckResult {
  const { global, perPlatform } = loadMinDays();
  const minDays = minDaysOverride ?? perPlatform[platform] ?? global;

  const last = findLastPlacement(slug, platform);
  if (!last) return { allowed: true };

  const daysSince = (Date.now() - last.ms) / (1000 * 86_400);
  if (daysSince < minDays) {
    return {
      allowed: false,
      reason: `"${slug}" was last published to ${platform} ${daysSince.toFixed(1)} days ago (min_reuse_days: ${minDays})`,
      lastPlacedAt: last.iso,
      daysSince,
    };
  }

  return { allowed: true, lastPlacedAt: last.iso, daysSince };
}
