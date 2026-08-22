import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { repoRoot } from "../db/db.js";
import { loadYamlConfig } from "./load.js";

// Single source of truth for config/platforms.yaml. Previously six files each read + cast this
// file with their own independently-typed partial shape (thread-check.ts, spin.ts, validate.ts,
// typefully.ts, reuse-guard.ts, slots.ts), which could silently drift from what's actually in the
// YAML. They now all call loadPlatforms() below. `.passthrough()` on nested objects tolerates
// fields a caller doesn't read yet, without weakening validation of the fields callers DO read.

export const platformRuleSchema = z
  .object({
    min_reuse_days: z.number().optional(),
    max_chars: z.number().optional(),
    max_words: z.number().optional(),
    derivative_count: z.array(z.number()).optional(),
    best_times_pst: z.string().optional(),
    posts_per_week: z.number().optional(),
    slot_days: z.array(z.string()).optional(),
    slot_time_pst: z.string().optional(),
    // Max claimed slots per PT-calendar-day for this platform (src/publish/slots.ts). Absent means
    // 1, today's behavior for every platform. >1 opts a platform into multiple same-day slots,
    // spaced across the day instead of all landing at slot_time_pst. Must be a positive integer —
    // 0/negative would silently block every future claim, and a fraction would let the day's
    // uniqueness check round up instead of down.
    max_slots_per_day: z.number().int().positive().optional(),
    // Whether this platform gets the storytelling re-hook/re-order pass (src/atomize/spin.ts's
    // appliesRehook). Absent means true, the behavior Muxin widened to every platform on
    // 2026-08-22. Typed as a boolean rather than left to `.passthrough()` because the failure is
    // silent and points the wrong way: a string `rehook: "false"` is truthy against the `!== false`
    // check, so a config typo would quietly leave the pass ON for a channel meant to opt out.
    rehook: z.boolean().optional(),
    style: z.string().optional(),
  })
  .passthrough();

const homeBrandSchema = z.object({
  worldview: z.string(),
  worldview_expanded: z.string(),
  signals: z.array(z.string()),
});

const spinAngleSchema = z.object({
  audience: z.string(),
  angle: z.string(),
});

const communitySchema = z
  .object({
    notes: z.string(),
  })
  .passthrough();

// No `.default()` on the nested records here — combined with `.passthrough()` it defeats
// TypeScript's inference (a known zod v3 pitfall). Missing sections are optional at the schema
// level; loadPlatforms() below fills the empty-object defaults after validation instead.
// z.string().min(1) (not bare z.string()) on every record key below — the `yaml` package parses
// an unquoted null-literal key (`null:`, `~:`, ...) to the empty string, which a bare z.string()
// key type accepts silently, letting a config typo land under e.g. platforms[""] with no error.
const nonEmptyKey = z.string().min(1);

const platformsConfigSchema = z
  .object({
    min_reuse_days: z.number().optional(),
    platforms: z.record(nonEmptyKey, platformRuleSchema).optional(),
    communities: z.record(nonEmptyKey, communitySchema).optional(),
    home_brand: homeBrandSchema.optional(),
    spin_angles: z.record(nonEmptyKey, spinAngleSchema).optional(),
  })
  .passthrough();

export type PlatformRule = z.infer<typeof platformRuleSchema>;
export type HomeBrand = z.infer<typeof homeBrandSchema>;
export type SpinAngle = z.infer<typeof spinAngleSchema>;

export interface PlatformsConfig {
  min_reuse_days?: number;
  platforms: Record<string, PlatformRule>;
  communities: Record<string, z.infer<typeof communitySchema>>;
  home_brand?: HomeBrand;
  spin_angles: Record<string, SpinAngle>;
}

const CONFIG_PATH = join(repoRoot, "config", "platforms.yaml");

let cached: PlatformsConfig | null = null;
let cachedMtimeMs: number | null = null;

function configMtimeMs(): number | null {
  return existsSync(CONFIG_PATH) ? statSync(CONFIG_PATH).mtimeMs : null;
}

// Cached until config/platforms.yaml's mtime changes, instead of re-reading + re-parsing on every
// call (some call sites run in tight loops). The mtime check is what keeps this correct for the one
// long-running process in the repo (`npm run review`'s server) — without it, a config edit made
// while that server is up would silently keep serving the pre-edit cadence/limits until restart. A
// repo with no config/platforms.yaml falls back to an empty config (an intentional "no overrides"
// case); anything else wrong with the file throws loudly via loadYamlConfig.
export function loadPlatforms(): PlatformsConfig {
  const mtimeMs = configMtimeMs();
  if (!cached || mtimeMs !== cachedMtimeMs) {
    const raw = loadYamlConfig(CONFIG_PATH, platformsConfigSchema, {});
    cached = {
      min_reuse_days: raw.min_reuse_days,
      platforms: raw.platforms ?? {},
      communities: raw.communities ?? {},
      home_brand: raw.home_brand,
      spin_angles: raw.spin_angles ?? {},
    };
    cachedMtimeMs = mtimeMs;
  }
  return cached;
}
