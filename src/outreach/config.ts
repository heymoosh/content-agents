import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { repoRoot } from "../db/db.js";

// Shared reader for config/outreach.yaml, used by intake.ts / research.ts / qualify.ts so the
// knobs (batch cap, research timeout, search budget) live in exactly one place, per repo
// convention (config/pillars.yaml, config/platforms.yaml). Defaults here match the checked-in
// config/outreach.yaml so a missing/partial file still yields sane, documented values instead of
// throwing mid-run.

// Follow-up tracker buckets (plan §3 / card 659b50f0 / Phase 4 card 21a5eb84) -- the same four
// reason-buckets data/outreach/tracker.jsonl events carry.
export type FollowUpBucket = "client" | "platform" | "jobsearch" | "inbound";

export interface FollowUpWindow {
  followUpAfterDays: number;
  abandonAfterDays: number;
}

export interface OutreachConfig {
  jsaDbPathEnv: string;
  batchCap: number;
  researchTimeoutMin: number;
  searchBudgetPerSignal: number;
  channels: string[];
  followUp: Record<FollowUpBucket, FollowUpWindow>;
  midTailCaps: {
    podcastListenersMax: number;
    newsletterSubscribersMax: number;
    companyFundingStageExclude: string[];
  };
}

const FOLLOW_UP_BUCKETS: readonly FollowUpBucket[] = ["client", "platform", "jobsearch", "inbound"];

const DEFAULTS: OutreachConfig = {
  jsaDbPathEnv: "JSA_DB_PATH",
  batchCap: 5,
  researchTimeoutMin: 6,
  searchBudgetPerSignal: 2,
  channels: ["email", "linkedin-dm", "contact-form", "podcast-pitch"],
  // Matches the checked-in config/outreach.yaml `follow_up:` section exactly, so a missing/partial
  // file (or a file missing one bucket) still yields the same sane windows documented there.
  followUp: {
    client: { followUpAfterDays: 7, abandonAfterDays: 30 },
    platform: { followUpAfterDays: 10, abandonAfterDays: 45 },
    jobsearch: { followUpAfterDays: 7, abandonAfterDays: 30 },
    inbound: { followUpAfterDays: 3, abandonAfterDays: 14 },
  },
  midTailCaps: {
    podcastListenersMax: 50_000,
    newsletterSubscribersMax: 50_000,
    companyFundingStageExclude: ["series-b", "series-c", "series-d-plus", "growth", "public"],
  },
};

interface RawFollowUpWindow {
  follow_up_after_days?: number;
  abandon_after_days?: number;
}

interface RawConfig {
  jsa_db_path_env?: string;
  batch_cap?: number;
  research_timeout_min?: number;
  search_budget_per_signal?: number;
  channels?: string[];
  follow_up?: Partial<Record<FollowUpBucket, RawFollowUpWindow>>;
  mid_tail_caps?: {
    podcast_listeners_max?: number;
    newsletter_subscribers_max?: number;
    company_funding_stage_exclude?: string[];
  };
}

function parseFollowUp(raw: RawConfig["follow_up"]): OutreachConfig["followUp"] {
  const result = {} as OutreachConfig["followUp"];
  for (const bucket of FOLLOW_UP_BUCKETS) {
    const rawWindow = raw?.[bucket];
    const fallback = DEFAULTS.followUp[bucket];
    result[bucket] = {
      followUpAfterDays: rawWindow?.follow_up_after_days ?? fallback.followUpAfterDays,
      abandonAfterDays: rawWindow?.abandon_after_days ?? fallback.abandonAfterDays,
    };
  }
  return result;
}

export function loadOutreachConfig(): OutreachConfig {
  const configPath = join(repoRoot, "config", "outreach.yaml");
  if (!existsSync(configPath)) return { ...DEFAULTS, followUp: parseFollowUp(undefined) };
  let raw: RawConfig = {};
  try {
    raw = (parse(readFileSync(configPath, "utf8")) as RawConfig) ?? {};
  } catch {
    return { ...DEFAULTS, followUp: parseFollowUp(undefined) };
  }
  return {
    jsaDbPathEnv: raw.jsa_db_path_env ?? DEFAULTS.jsaDbPathEnv,
    batchCap: raw.batch_cap ?? DEFAULTS.batchCap,
    researchTimeoutMin: raw.research_timeout_min ?? DEFAULTS.researchTimeoutMin,
    searchBudgetPerSignal: raw.search_budget_per_signal ?? DEFAULTS.searchBudgetPerSignal,
    channels: raw.channels ?? DEFAULTS.channels,
    followUp: parseFollowUp(raw.follow_up),
    midTailCaps: {
      podcastListenersMax: raw.mid_tail_caps?.podcast_listeners_max ?? DEFAULTS.midTailCaps.podcastListenersMax,
      newsletterSubscribersMax: raw.mid_tail_caps?.newsletter_subscribers_max ?? DEFAULTS.midTailCaps.newsletterSubscribersMax,
      companyFundingStageExclude: raw.mid_tail_caps?.company_funding_stage_exclude ?? DEFAULTS.midTailCaps.companyFundingStageExclude,
    },
  };
}
