import { join } from "node:path";
import { z } from "zod";
import { repoRoot } from "../db/db.js";
import { loadYamlConfig } from "./load.js";

// Single source of truth for config/platforms.yaml. Previously six files each read + cast this
// file with their own independently-typed partial shape (thread-check.ts, spin.ts, validate.ts,
// typefully.ts, reuse-guard.ts, slots.ts), which could silently drift from what's actually in the
// YAML. They now all call loadPlatforms() below. `.passthrough()` on nested objects tolerates
// fields a caller doesn't read yet, without weakening validation of the fields callers DO read.

const platformRuleSchema = z
  .object({
    min_reuse_days: z.number().optional(),
    max_chars: z.number().optional(),
    max_words: z.number().optional(),
    derivative_count: z.array(z.number()).optional(),
    best_times_pst: z.string().optional(),
    posts_per_week: z.number().optional(),
    slot_days: z.array(z.string()).optional(),
    slot_time_pst: z.string().optional(),
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
const platformsConfigSchema = z
  .object({
    min_reuse_days: z.number().optional(),
    platforms: z.record(z.string(), platformRuleSchema).optional(),
    communities: z.record(z.string(), communitySchema).optional(),
    home_brand: homeBrandSchema.optional(),
    spin_angles: z.record(z.string(), spinAngleSchema).optional(),
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

// Read once per process (some call sites run in tight loops). A repo with no config/platforms.yaml
// falls back to an empty config (an intentional "no overrides" case); anything else wrong with the
// file throws loudly via loadYamlConfig.
export function loadPlatforms(): PlatformsConfig {
  if (!cached) {
    const raw = loadYamlConfig(CONFIG_PATH, platformsConfigSchema, {});
    cached = {
      min_reuse_days: raw.min_reuse_days,
      platforms: raw.platforms ?? {},
      communities: raw.communities ?? {},
      home_brand: raw.home_brand,
      spin_angles: raw.spin_angles ?? {},
    };
  }
  return cached;
}
