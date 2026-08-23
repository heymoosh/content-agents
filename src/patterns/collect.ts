// patterns:collect and patterns:outliers.
//
// Deterministic only. It validates staged entries, dedupes them by url, appends them to the
// corpus, and prints what is there now. It never judges a post, never summarizes one, and never
// calls a model. Reading structure out of the collected posts is the skill's job, not this file's.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { repoRoot } from "../db/db.js";
import { CORPUS_PATH, INBOX_DIR, appendEntries, groupByAccount, makeId, readCorpus } from "./corpus.js";
import { classifyOutlier } from "./outliers.js";
import {
  PLATFORMS,
  VISUAL_FORMS,
  type CorpusEntry,
  type CorpusVisual,
  type OutlierThresholds,
  type PatternMiningConfig,
  type Platform,
  type VisualForm,
} from "./types.js";

const CONFIG_PATH = join(repoRoot, "config", "pattern-mining.yaml");

export function loadConfig(path: string = CONFIG_PATH): PatternMiningConfig {
  return parse(readFileSync(path, "utf8")) as PatternMiningConfig;
}

export function thresholdsFor(config: PatternMiningConfig, platform: string): OutlierThresholds | null {
  return config.outlier_thresholds?.[platform] ?? null;
}

// A staged entry may leave id and collected_at out; everything else has to be there and be the
// right shape. A bad entry is reported by file and index, never quietly fixed.
export function validateEntry(raw: unknown, config: PatternMiningConfig): { entry: CorpusEntry | null; errors: string[] } {
  const errors: string[] = [];
  const fail = (msg: string) => {
    errors.push(msg);
    return null;
  };
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { entry: fail("not a JSON object"), errors };
  }
  const r = raw as Record<string, unknown>;
  const str = (key: string): string => {
    const v = r[key];
    if (typeof v !== "string" || v.trim() === "") {
      errors.push(`${key} must be a non-empty string`);
      return "";
    }
    return v;
  };
  const platform = str("platform");
  if (platform && !PLATFORMS.includes(platform as Platform)) {
    errors.push(`platform ${JSON.stringify(platform)} is not one of: ${PLATFORMS.join(", ")}`);
  }
  const handle = str("handle");
  const creator = str("creator");
  const niche = str("niche");
  if (niche && config.niches && !config.niches.includes(niche)) {
    errors.push(`niche ${JSON.stringify(niche)} is not one of: ${config.niches.join(", ")}`);
  }
  const url = str("url");
  const body = str("body");
  const kind = r.kind;
  if (kind !== "text" && kind !== "video") errors.push('kind must be "text" or "video"');
  const transcriptSource = r.transcript_source ?? null;
  if (
    transcriptSource !== null &&
    transcriptSource !== "manual" &&
    transcriptSource !== "captions" &&
    transcriptSource !== "caption"
  ) {
    errors.push('transcript_source must be "manual", "captions", "caption", or null');
  }
  if (kind === "video" && transcriptSource === null) {
    errors.push("a video entry needs transcript_source, so the corpus records what body actually is");
  }
  if (kind === "text" && transcriptSource !== null) {
    errors.push("a text entry must leave transcript_source null");
  }
  const postedAt = r.posted_at ?? null;
  if (postedAt !== null && typeof postedAt !== "string") errors.push("posted_at must be an ISO date string or null");

  const rawMetrics = r.metrics;
  const metrics = { views: null, likes: null, comments: null, shares: null, followers: null } as CorpusEntry["metrics"];
  if (typeof rawMetrics !== "object" || rawMetrics === null || Array.isArray(rawMetrics)) {
    errors.push("metrics must be an object");
  } else {
    for (const key of ["views", "likes", "comments", "shares", "followers"] as const) {
      const v = (rawMetrics as Record<string, unknown>)[key] ?? null;
      if (v === null) continue;
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
        errors.push(`metrics.${key} must be a non-negative number or null`);
        continue;
      }
      metrics[key] = v;
    }
  }
  // `visual` is optional, so an entry collected before this field existed still validates. When it
  // is there it is checked strictly, because body_is_complete is what a downstream step trusts
  // before quoting `body` as a whole post.
  let visual: CorpusVisual | null = null;
  if (r.visual !== undefined && r.visual !== null) {
    const rv = r.visual;
    if (typeof rv !== "object" || Array.isArray(rv)) {
      errors.push("visual must be an object when present");
    } else {
      const v = rv as Record<string, unknown>;
      const form = v.form;
      if (typeof form !== "string" || !VISUAL_FORMS.includes(form as VisualForm)) {
        errors.push(`visual.form must be one of: ${VISUAL_FORMS.join(", ")}`);
      }
      if (typeof v.body_is_complete !== "boolean") {
        errors.push("visual.body_is_complete must be true or false, so nothing downstream has to guess");
      }
      for (const key of ["onscreen_text", "description"] as const) {
        const value = v[key] ?? null;
        if (value !== null && typeof value !== "string") errors.push(`visual.${key} must be a string or null`);
      }
      for (const key of ["slide_count", "thread_length"] as const) {
        const value = v[key] ?? null;
        if (value === null) continue;
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
          errors.push(`visual.${key} must be a non-negative number or null`);
        }
      }
      if (errors.length === 0) {
        visual = {
          form: form as VisualForm,
          onscreen_text: (v.onscreen_text as string | null | undefined) ?? null,
          description: (v.description as string | null | undefined) ?? null,
          slide_count: (v.slide_count as number | null | undefined) ?? null,
          thread_length: (v.thread_length as number | null | undefined) ?? null,
          body_is_complete: v.body_is_complete as boolean,
        };
      }
    }
  }
  if (r.notes !== undefined && typeof r.notes !== "string") errors.push("notes must be a string when present");

  if (errors.length > 0) return { entry: null, errors };

  const entry: CorpusEntry = {
    id: typeof r.id === "string" && r.id.trim() !== "" ? r.id : makeId(platform, handle, url),
    platform: platform as Platform,
    handle,
    creator,
    niche,
    url,
    posted_at: (postedAt as string | null) ?? null,
    collected_at: typeof r.collected_at === "string" && r.collected_at.trim() !== "" ? r.collected_at : new Date().toISOString(),
    kind: kind as CorpusEntry["kind"],
    body,
    transcript_source: transcriptSource as CorpusEntry["transcript_source"],
    metrics,
  };
  if (visual) entry.visual = visual;
  if (typeof r.notes === "string") entry.notes = r.notes;
  return { entry, errors };
}

function readStagedFile(path: string): unknown[] {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  return Array.isArray(parsed) ? parsed : [parsed];
}

function stagedFiles(inboxDir: string, extra: string[]): string[] {
  const files = [...extra];
  if (existsSync(inboxDir)) {
    for (const name of readdirSync(inboxDir).sort()) {
      if (name.endsWith(".json")) files.push(join(inboxDir, name));
    }
  }
  return files;
}

interface Args {
  command: "collect" | "outliers";
  corpusPath: string;
  inboxDir: string;
  entries: string[];
  configPath: string;
}

export function parseArgs(argv: string[]): Args {
  const args: Args = {
    command: argv[0] === "outliers" ? "outliers" : "collect",
    corpusPath: CORPUS_PATH,
    inboxDir: INBOX_DIR,
    entries: [],
    configPath: CONFIG_PATH,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--entry" && value) args.entries.push(value), i++;
    else if (flag === "--corpus" && value) (args.corpusPath = value), i++;
    else if (flag === "--inbox" && value) (args.inboxDir = value), i++;
    else if (flag === "--config" && value) (args.configPath = value), i++;
  }
  return args;
}

// The shared report both commands print: how many entries each account has now, and which of
// them cleared the outlier bar.
function printCorpusReport(corpus: CorpusEntry[], config: PatternMiningConfig): void {
  const groups = groupByAccount(corpus);
  console.log(`\nCorpus: ${corpus.length} entries across ${groups.size} accounts (target ${config.targets.corpus_size_min}-${config.targets.corpus_size_max}).`);
  if (corpus.length < config.targets.corpus_size_min) {
    console.log(`Below the ${config.targets.corpus_size_min}-entry floor. Collect more before running the analysis step.`);
  }

  console.log("\nAccount                              Platform    Entries  Outliers");
  const outlierLines: string[] = [];
  for (const [key, entries] of [...groups.entries()].sort()) {
    const [platform, handle] = key.split("|");
    const thresholds = thresholdsFor(config, platform);
    let outliers = 0;
    for (const entry of entries) {
      if (!thresholds) continue;
      const verdict = classifyOutlier(entry, entries, thresholds);
      if (!verdict.isOutlier) continue;
      outliers++;
      const ratio = verdict.ratio === null ? "n/a" : verdict.ratio.toFixed(1);
      const multiple = verdict.multiple === null ? "n/a" : verdict.multiple.toFixed(1);
      outlierLines.push(`  [${verdict.reason}] ${entry.id}  views/followers ${ratio}, baseline x${multiple}\n    ${entry.url}`);
    }
    const label = thresholds ? String(outliers) : "no thresholds";
    console.log(`${("@" + handle).padEnd(36)} ${platform.padEnd(11)} ${String(entries.length).padEnd(8)} ${label}`);
  }

  if (outlierLines.length === 0) {
    console.log("\nNo entry cleared the outlier bar yet. Baselines need at least 3 other scored posts per account.");
  } else {
    console.log(`\nCleared the outlier bar (${outlierLines.length}):`);
    for (const line of outlierLines) console.log(line);
  }
}

export function main(argv: string[] = process.argv.slice(2)): number {
  const args = parseArgs(argv);
  const config = loadConfig(args.configPath);

  if (args.command === "outliers") {
    const corpus = readCorpus(args.corpusPath);
    printCorpusReport(corpus, config);
    return 0;
  }

  const files = stagedFiles(args.inboxDir, args.entries);
  if (files.length === 0) {
    console.log(`No staged entries. Drop JSON files in ${args.inboxDir} or pass --entry <file>.`);
    return 0;
  }

  const valid: CorpusEntry[] = [];
  let invalid = 0;
  for (const file of files) {
    let staged: unknown[];
    try {
      staged = readStagedFile(file);
    } catch (err) {
      console.error(`${file}: could not be read as JSON (${(err as Error).message})`);
      invalid++;
      continue;
    }
    staged.forEach((raw, i) => {
      const { entry, errors } = validateEntry(raw, config);
      if (entry) {
        valid.push(entry);
        return;
      }
      invalid++;
      console.error(`${file}[${i}] rejected:`);
      for (const e of errors) console.error(`  - ${e}`);
    });
  }

  const { appended, duplicates } = appendEntries(valid, args.corpusPath);
  console.log(`Staged files: ${files.length}. Valid entries: ${valid.length}. Rejected: ${invalid}.`);
  console.log(`Appended: ${appended.length}. Skipped as already collected: ${duplicates.length}.`);
  for (const dup of duplicates) console.log(`  already collected: ${dup.url}`);

  printCorpusReport(readCorpus(args.corpusPath), config);
  return invalid > 0 ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
