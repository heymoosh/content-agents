import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { repoRoot } from "../db/db.js";

// Shared reader for config/outreach.yaml, used by intake.ts / research.ts / qualify.ts so the
// knobs (batch cap, research timeout, search budget) live in exactly one place, per repo
// convention (config/pillars.yaml, config/platforms.yaml). Defaults here match the checked-in
// config/outreach.yaml so a missing/partial file still yields sane, documented values instead of
// throwing mid-run.

export interface OutreachConfig {
  jsaDbPathEnv: string;
  batchCap: number;
  researchTimeoutMin: number;
  searchBudgetPerSignal: number;
  channels: string[];
}

const DEFAULTS: OutreachConfig = {
  jsaDbPathEnv: "JSA_DB_PATH",
  batchCap: 5,
  researchTimeoutMin: 6,
  searchBudgetPerSignal: 2,
  channels: ["email", "linkedin-dm", "contact-form", "podcast-pitch"],
};

interface RawConfig {
  jsa_db_path_env?: string;
  batch_cap?: number;
  research_timeout_min?: number;
  search_budget_per_signal?: number;
  channels?: string[];
}

export function loadOutreachConfig(): OutreachConfig {
  const configPath = join(repoRoot, "config", "outreach.yaml");
  if (!existsSync(configPath)) return { ...DEFAULTS };
  let raw: RawConfig = {};
  try {
    raw = (parse(readFileSync(configPath, "utf8")) as RawConfig) ?? {};
  } catch {
    return { ...DEFAULTS };
  }
  return {
    jsaDbPathEnv: raw.jsa_db_path_env ?? DEFAULTS.jsaDbPathEnv,
    batchCap: raw.batch_cap ?? DEFAULTS.batchCap,
    researchTimeoutMin: raw.research_timeout_min ?? DEFAULTS.researchTimeoutMin,
    searchBudgetPerSignal: raw.search_budget_per_signal ?? DEFAULTS.searchBudgetPerSignal,
    channels: raw.channels ?? DEFAULTS.channels,
  };
}
