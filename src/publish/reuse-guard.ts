import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../db/db.js";
import { loadPlatforms, type PlatformsConfig } from "../config/platforms.js";
import type { BrandId } from "../identity/brand.js";

// Reuse-frequency guard: prevents re-publishing the same content slug to the same platform
// too soon after its last placement. Reads the bets.md Placed log (briefs/bets.md), which is
// the canonical append-only record of every shipped asset.
//
// Usage:
//   const result = checkReuse("2026-06-25-my-essay", "linkedin");
//   if (!result.allowed) console.warn(result.reason);

// Two test overrides, deliberately different shapes.
//
// CONTENT_AGENTS_TEST_BETS_PATH names ONE file and therefore collapses every brand onto it. That is
// fine for a suite about one brand's window, which is what its existing users are, and it keeps
// working here exactly as it did.
//
// CONTENT_AGENTS_TEST_BRIEFS_ROOT relocates the briefs ROOT instead, so `<root>/<brand>/bets.md`
// still resolves per brand. A suite that has to tell two brands' Placed logs apart needs that:
// under the per-file override both brands read one file, and the only alternative was writing
// fixtures into the real `briefs/` tree — where a stray cleanup would delete Muxin's append-only
// placement log, the record that stops duplicate publishing.
function betsPath(brandId: BrandId): string {
  const perFile = process.env.CONTENT_AGENTS_TEST_BETS_PATH;
  if (perFile !== undefined) return perFile; // `??` semantics, empty string included, exactly as before
  const root = process.env.CONTENT_AGENTS_TEST_BRIEFS_ROOT?.trim();
  return join(root || join(repoRoot, "briefs"), brandId, "bets.md");
}
const FALLBACK_MIN_DAYS = 30;
// Used only when config/platforms.yaml carries neither a per-platform nor a top-level
// `min_variant_days`. Named here so the fallback is one readable constant rather than a literal
// buried in a `??` chain.
const FALLBACK_MIN_VARIANT_DAYS = 7;
const MS_PER_DAY = 86_400_000;

export interface ReuseCheckResult {
  allowed: boolean;
  reason?: string;        // set when !allowed
  lastPlacedAt?: string;  // ISO timestamp of the most recent matching placement (if any)
  daysSince?: number;     // days since last placement (if any)
  minDays?: number;       // the min_reuse_days window this check was evaluated against
  // Set together, and ONLY on the different-derivative (variant) refusal. `deferrable` says this
  // post has a safe date rather than no date at all, and `earliestAllowedAt` is that date: the
  // instant the variant window opens. A caller that does not read these fields still sees
  // `allowed: false` and refuses, which is the fail-closed reading. A caller that does read them
  // hands `earliestAllowedAt` to the unified scheduler as a floor and schedules past it.
  deferrable?: boolean;
  earliestAllowedAt?: string;
  minVariantDays?: number;
}

/** Options for the row-aware check. Every field is optional; an omitted `rowId` cannot tell two
 *  derivatives apart and therefore falls back to the merged, single-window behavior. */
export interface ReuseCheckOptions {
  /** The review-queue row id being placed, e.g. "bluesky-1". */
  rowId?: string;
  brandId?: BrandId;
  /** Skip the config lookup for the same-row window (useful in tests). */
  minDaysOverride?: number;
  /** Skip the config lookup for the different-row window (useful in tests). */
  minVariantDaysOverride?: number;
  /** Evaluate against this instant instead of Date.now() (useful in tests). */
  now?: number;
}

// Load per-platform min_reuse_days from config/platforms.yaml.
// Falls back to the top-level `min_reuse_days:` key, then to FALLBACK_MIN_DAYS.
function loadMinDays(): { global: number; perPlatform: Record<string, number> } {
  const cfg = loadPlatforms();
  const global = cfg.min_reuse_days ?? FALLBACK_MIN_DAYS;
  const perPlatform: Record<string, number> = {};
  for (const [k, v] of Object.entries(cfg.platforms)) {
    if (typeof v.min_reuse_days === "number") perPlatform[k] = v.min_reuse_days;
  }
  return { global, perPlatform };
}

// A spacing window is only meaningful as a finite positive number of days. 0 or a negative value
// collapses `daysSince < minVariantDays` to "always allowed", which silently removes variant spacing
// altogether, and NaN/Infinity do the same in one direction or the other. The schema in
// src/config/platforms.ts rejects those at load (loadYamlConfig THROWS on a schema failure; it falls
// back only for a missing file), but this guard is the second layer: resolveVariantDays also takes a
// caller-supplied `cfg`, which no schema ever sees. An unusable value is treated as absent, so the
// precedence simply continues to the next level rather than disabling the window.
function positiveDays(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

// Same precedence min_reuse_days already uses: a platform's own `min_variant_days`, then the
// top-level key, then the named constant. Reads through loadPlatforms() (never a second YAML read
// of its own) so it cannot drift from what the rest of the repo sees in config/platforms.yaml.
// `cfg` is a parameter with a real default so the precedence itself is unit-testable against a
// hand-built config, without editing Muxin's live config file from a test.
export function resolveVariantDays(platform: string, cfg: PlatformsConfig = loadPlatforms()): number {
  return positiveDays(cfg.platforms[platform]?.min_variant_days)
    ?? positiveDays(cfg.min_variant_days)
    ?? FALLBACK_MIN_VARIANT_DAYS;
}

// Row identity, normalized once. Returns null for identity this process does not actually know:
// an omitted id, an empty cell, or whitespace only. readQueue trims every cell (src/review/queue.ts),
// so a blank id column arrives here as "" rather than undefined, and "" is defined — without this it
// would skip the merged fallback and then never match any placement, buying the SHORT window on
// unknown identity. Unknown identity must take the strict path, not the loose one.
//
// Case is folded because matching MORE placements as "same row" can only move a case toward the
// longer window and the refusal, which is the fail-closed direction. The Placed log itself is never
// rewritten; only the comparison is normalized.
function normalizeRowId(rowId: string | undefined): string | null {
  if (rowId === undefined) return null;
  const trimmed = rowId.trim().toLowerCase();
  return trimmed === "" ? null : trimmed;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface Placement { iso: string; ms: number }

// Scan the Placed log in briefs/bets.md for lines that match this slug+platform.
// Lines look like:
//   - placed 2026-06-25T12:00:00.000Z [slug/rowId] platform → ref ...
//
// Returns the most recent placement of ANY row of this slug, and separately the most recent
// placement of the ONE row named by `rowKey`. Two different derivatives of one essay are two
// different posts, so the two windows below have to tell them apart. Matching only "any row" is
// exactly the merged case this guard was applying a full re-publish window to.
//
// `rowKey` is already normalized by normalizeRowId (trimmed, lowercased, never empty), and each
// logged row id is normalized the same way before comparison, so "X-1" and " x-1 " are the same row
// while "x-1" and "x-11" stay different ones.
function findPlacements(
  slug: string,
  platform: string,
  brandId: BrandId,
  rowKey?: string
): { latest: Placement | null; latestSameRow: Placement | null } {
  const path = betsPath(brandId);
  if (!existsSync(path)) return { latest: null, latestSameRow: null };
  const content = readFileSync(path, "utf8");

  // Match every placed line for this slug, capturing the derivative row id so the caller can tell
  // "this exact post again" from "a different post from the same piece".
  const linePattern = new RegExp(
    `^- placed (\\S+) \\[${escapeRegex(slug)}/([^\\]]+)\\] (\\S+) →`,
    "gm"
  );

  let latest: Placement | null = null;
  let latestSameRow: Placement | null = null;
  let m: RegExpExecArray | null;
  while ((m = linePattern.exec(content)) !== null) {
    if (m[3] !== platform) continue; // different platform on this line
    const t = new Date(m[1]).getTime();
    if (isNaN(t)) continue;
    if (!latest || t > latest.ms) latest = { iso: m[1], ms: t };
    if (rowKey !== undefined && m[2].trim().toLowerCase() === rowKey && (!latestSameRow || t > latestSameRow.ms)) {
      latestSameRow = { iso: m[1], ms: t };
    }
  }

  return { latest, latestSameRow };
}

// Check whether `slug` may be published to `platform`.
// `slug` = basename of the content folder (e.g. "2026-06-25-my-essay").
// `platform` = platform key used in bets.md (e.g. "x", "linkedin", "bluesky", "quote-card").
// `minDaysOverride` = skip config lookup and use this value directly (useful in tests).
//
// Row-unaware: it cannot tell two derivatives of one piece apart, so it applies the single
// `min_reuse_days` window to any placement of the slug and refuses inside it. That is what every
// caller had before the two-window split, kept exactly, for callers with no row id to give. A
// caller that knows which row it is placing should use checkReuseForRow below.
export function checkReuse(
  slug: string,
  platform: string,
  minDaysOverride?: number,
  brandId: BrandId = "human-inference"
): ReuseCheckResult {
  const { global, perPlatform } = loadMinDays();
  const minDays = minDaysOverride ?? perPlatform[platform] ?? global;

  const { latest } = findPlacements(slug, platform, brandId);
  if (!latest) return { allowed: true, minDays };

  const daysSince = (Date.now() - latest.ms) / (1000 * 86_400);
  if (daysSince < minDays) {
    return {
      allowed: false,
      reason: `"${slug}" was last published to ${platform} ${daysSince.toFixed(1)} days ago (min_reuse_days: ${minDays})`,
      lastPlacedAt: latest.iso,
      daysSince,
      minDays,
    };
  }

  return { allowed: true, lastPlacedAt: latest.iso, daysSince, minDays };
}

/**
 * The two-window check, for a caller that knows WHICH row it is placing.
 *
 *   same slug + same platform + SAME row id      → `min_reuse_days`, and a hit is a REFUSAL.
 *     Re-placing an identical post is almost always a mistake, and no date makes it right.
 *   same slug + same platform + DIFFERENT row id → `min_variant_days`, and a hit is DEFERRABLE.
 *     A different derivative is a different post. Its only problem is "not yet", and the guard
 *     knows when the window opens, so it hands back that instant instead of a red error.
 *
 * The deferral floor is measured from the most recent placement of ANY row of this slug on this
 * platform, not from the most recent different row: the point is spacing between posts from one
 * piece, so the later placement is the one that counts. That also fails closed, because the latest
 * placement can only push the floor further out.
 *
 * Without `rowId` this is the merged legacy check, identical to checkReuse above.
 */
export function checkReuseForRow(slug: string, platform: string, opts: ReuseCheckOptions = {}): ReuseCheckResult {
  const brandId = opts.brandId ?? "human-inference";
  // Unknown row identity (omitted, empty, or whitespace only) cannot tell two derivatives apart, so
  // it takes the strict merged window rather than the short variant one.
  const rowKey = normalizeRowId(opts.rowId);
  if (rowKey === null) return checkReuse(slug, platform, opts.minDaysOverride, brandId);

  const minDaysCfg = loadMinDays();
  const minDays = opts.minDaysOverride ?? minDaysCfg.perPlatform[platform] ?? minDaysCfg.global;
  // Same guard as the config path: an unusable override is treated as absent, never as "no window".
  const minVariantDays = positiveDays(opts.minVariantDaysOverride) ?? resolveVariantDays(platform);
  const now = opts.now ?? Date.now();

  const { latest, latestSameRow } = findPlacements(slug, platform, brandId, rowKey);
  if (!latest) return { allowed: true, minDays, minVariantDays };

  // Window 1: this exact post again. Same message, same window value, still a refusal.
  if (latestSameRow) {
    const sameRowDays = (now - latestSameRow.ms) / (1000 * 86_400);
    if (sameRowDays < minDays) {
      return {
        allowed: false,
        reason: `"${slug}" was last published to ${platform} ${sameRowDays.toFixed(1)} days ago (min_reuse_days: ${minDays})`,
        lastPlacedAt: latestSameRow.iso,
        daysSince: sameRowDays,
        minDays,
      };
    }
  }

  // Window 2: a different derivative of the same piece. Spaced, not refused.
  const daysSince = (now - latest.ms) / (1000 * 86_400);
  if (daysSince < minVariantDays) {
    const earliestAllowedAt = new Date(latest.ms + minVariantDays * MS_PER_DAY).toISOString();
    return {
      allowed: false,
      deferrable: true,
      earliestAllowedAt,
      reason: `"${slug}" already has a post on ${platform} from ${daysSince.toFixed(1)} days ago (min_variant_days: ${minVariantDays}), so this one is spaced to ${earliestAllowedAt} or later`,
      lastPlacedAt: latest.iso,
      daysSince,
      minVariantDays,
    };
  }

  return { allowed: true, lastPlacedAt: latest.iso, daysSince, minDays, minVariantDays };
}
