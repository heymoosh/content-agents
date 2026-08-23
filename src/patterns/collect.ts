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
import { BASELINES_PATH, loadBaselineIndex } from "./baselines.js";
import { classifyOutlier, isWinnersOnlySample } from "./outliers.js";
import { countByEra, eraFor, isPostEra } from "./era.js";
import {
  PLATFORMS,
  MEDIA_FORMS,
  POST_ERAS,
  type CorpusEntry,
  type CorpusMedia,
  type CorpusSample,
  type OutlierThresholds,
  type PatternMiningConfig,
  type MediaAspect,
  type MediaForm,
  type Platform,
  type PostEra,
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
  // `era` is optional, so entries staged before it existed still validate. When it IS there it has
  // to agree with posted_at, because two fields describing the same fact is exactly how a corpus
  // grows a second, wrong source of truth. A staged entry that disagrees is rejected rather than
  // silently corrected, so the collector that produced it gets fixed.
  const rawEra = r.era ?? null;
  let era: PostEra | null = null;
  if (rawEra !== null) {
    if (!isPostEra(rawEra)) {
      errors.push(`era ${JSON.stringify(rawEra)} is not one of: ${POST_ERAS.join(", ")}`);
    } else {
      const derived = eraFor(typeof postedAt === "string" ? postedAt : null);
      if (derived !== rawEra) {
        errors.push(`era ${JSON.stringify(rawEra)} disagrees with posted_at ${JSON.stringify(postedAt)}, which is ${JSON.stringify(derived)}`);
      } else {
        era = rawEra;
      }
    }
  }

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
    // Optional, and bounded rather than merely non-negative: it is a proportion of votes, so
    // anything outside 0..1 is a misread field rather than a surprising post.
    const upvoteRatio = (rawMetrics as Record<string, unknown>).upvote_ratio ?? null;
    if (upvoteRatio !== null) {
      if (typeof upvoteRatio !== "number" || !Number.isFinite(upvoteRatio) || upvoteRatio < 0 || upvoteRatio > 1) {
        errors.push("metrics.upvote_ratio must be a number between 0 and 1, or null");
      } else {
        metrics.upvote_ratio = upvoteRatio;
      }
    }
    // Optional and pinterest-only. Kept out of the loop above on purpose: it is NOT one of the
    // five comparable metrics, it is a global aggregate across every copy of an image, and
    // entryScore must never pick it up as if it were this account's own number.
    const aggregateSaves = (rawMetrics as Record<string, unknown>).aggregate_saves ?? null;
    if (aggregateSaves !== null) {
      if (typeof aggregateSaves !== "number" || !Number.isFinite(aggregateSaves) || aggregateSaves < 0) {
        errors.push("metrics.aggregate_saves must be a non-negative number or null");
      } else {
        metrics.aggregate_saves = aggregateSaves;
      }
    }
  }
  // `media` is optional, so an entry collected before this field existed still validates. When it
  // is there it is checked strictly, because body_is_complete is what a downstream step trusts
  // before quoting `body` as a whole post, and `form` is the axis the analysis compares on.
  let media: CorpusMedia | null = null;
  if (r.media !== undefined && r.media !== null) {
    const rm = r.media;
    if (typeof rm !== "object" || Array.isArray(rm)) {
      errors.push("media must be an object when present");
    } else {
      const m = rm as Record<string, unknown>;
      const form = m.form;
      if (typeof form !== "string" || !MEDIA_FORMS.includes(form as MediaForm)) {
        errors.push(`media.form must be one of: ${MEDIA_FORMS.join(", ")}`);
      }
      if (typeof m.body_is_complete !== "boolean") {
        errors.push("media.body_is_complete must be true or false, so nothing downstream has to guess");
      }
      for (const key of ["onscreen_text", "description"] as const) {
        const value = m[key] ?? null;
        if (value !== null && typeof value !== "string") errors.push(`media.${key} must be a string or null`);
      }
      for (const key of ["duration_seconds", "media_count"] as const) {
        const value = m[key] ?? null;
        if (value === null) continue;
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
          errors.push(`media.${key} must be a non-negative number or null`);
        }
      }
      const hasCaptions = m.has_captions ?? null;
      if (hasCaptions !== null && typeof hasCaptions !== "boolean") {
        errors.push("media.has_captions must be true, false, or null");
      }
      const aspect = m.aspect ?? null;
      if (aspect !== null && aspect !== "vertical" && aspect !== "square" && aspect !== "horizontal") {
        errors.push('media.aspect must be "vertical", "square", "horizontal", or null');
      }
      if (errors.length === 0) {
        media = {
          form: form as MediaForm,
          onscreen_text: (m.onscreen_text as string | null | undefined) ?? null,
          description: (m.description as string | null | undefined) ?? null,
          duration_seconds: (m.duration_seconds as number | null | undefined) ?? null,
          media_count: (m.media_count as number | null | undefined) ?? null,
          has_captions: hasCaptions as boolean | null,
          aspect: aspect as MediaAspect | null,
          body_is_complete: m.body_is_complete as boolean,
        };
      }
    }
  }
  if (r.notes !== undefined && typeof r.notes !== "string") errors.push("notes must be a string when present");
  if (r.title !== undefined && r.title !== null && typeof r.title !== "string") {
    errors.push("title must be a string or null when present");
  }
  // `sample` is optional so entries staged before it existed still validate, and strict when it is
  // there, because role is what stops a winner's siblings being read as a baseline.
  let sample: CorpusSample | null = null;
  if (r.sample !== undefined && r.sample !== null) {
    const rs = r.sample;
    if (typeof rs !== "object" || Array.isArray(rs)) {
      errors.push("sample must be an object when present");
    } else {
      const sm = rs as Record<string, unknown>;
      if (typeof sm.listing !== "string" || sm.listing.trim() === "") {
        errors.push("sample.listing must name the listing the post came from");
      }
      if (sm.role !== "winner" && sm.role !== "baseline" && sm.role !== "unranked") {
        errors.push('sample.role must be "winner", "baseline", or "unranked"');
      }
      const window = sm.window ?? null;
      if (window !== null && typeof window !== "string") errors.push("sample.window must be a string or null");
      const rank = sm.rank ?? null;
      if (rank !== null && (typeof rank !== "number" || !Number.isFinite(rank) || rank < 1)) {
        errors.push("sample.rank must be a 1-based position or null");
      }
      if (errors.length === 0) {
        sample = {
          listing: sm.listing as string,
          window: window as string | null,
          rank: rank as number | null,
          role: sm.role as CorpusSample["role"],
        };
      }
    }
  }

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
  if (era !== null) entry.era = era;
  if (typeof r.title === "string") entry.title = r.title;
  if (media) entry.media = media;
  if (sample) entry.sample = sample;
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
  baselinesPath: string;
}

export function parseArgs(argv: string[]): Args {
  const args: Args = {
    command: argv[0] === "outliers" ? "outliers" : "collect",
    corpusPath: CORPUS_PATH,
    inboxDir: INBOX_DIR,
    entries: [],
    configPath: CONFIG_PATH,
    baselinesPath: BASELINES_PATH,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--entry" && value) args.entries.push(value), i++;
    else if (flag === "--corpus" && value) (args.corpusPath = value), i++;
    else if (flag === "--inbox" && value) (args.inboxDir = value), i++;
    else if (flag === "--config" && value) (args.configPath = value), i++;
    else if (flag === "--baselines" && value) (args.baselinesPath = value), i++;
  }
  return args;
}

// The shared report both commands print: how many entries each account has now, and which of
// them cleared the outlier bar.
function printCorpusReport(corpus: CorpusEntry[], config: PatternMiningConfig, baselinesPath?: string): void {
  const groups = groupByAccount(corpus);
  const baselines = loadBaselineIndex(baselinesPath);
  console.log(`\nCorpus: ${corpus.length} entries across ${groups.size} accounts (target ${config.targets.corpus_size_min}-${config.targets.corpus_size_max}).`);
  if (corpus.length < config.targets.corpus_size_min) {
    console.log(`Below the ${config.targets.corpus_size_min}-entry floor. Collect more before running the analysis step.`);
  }
  // Printed unconditionally so no one reads a corpus count as one comparable population. On
  // pinterest the eras differ by three orders of magnitude, and the same split is worth seeing
  // anywhere.
  const eras = [...countByEra(corpus).entries()].filter(([, count]) => count > 0);
  if (eras.length > 1) {
    console.log(`By era: ${eras.map(([era, count]) => `${era} ${count}`).join(", ")}. Eras are not comparable in one ranking.`);
  }

  console.log("\nAccount                              Platform    Entries  Outliers");
  const outlierLines: string[] = [];
  const unmeasured: string[] = [];
  for (const [key, entries] of [...groups.entries()].sort()) {
    const [platform, handle] = key.split("|");
    const thresholds = thresholdsFor(config, platform);
    const baseline = baselines.get(key) ?? null;
    // A winners-only collection with no measured baseline has no honest denominator, so say that
    // rather than printing the median of the winners and letting it read as the community's norm.
    if (!baseline && isWinnersOnlySample(entries)) unmeasured.push(`${platform} ${handle}`);
    let outliers = 0;
    for (const entry of entries) {
      if (!thresholds) continue;
      const verdict = classifyOutlier(entry, entries, thresholds, baseline);
      if (!verdict.isOutlier) continue;
      outliers++;
      const ratio = verdict.ratio === null ? "n/a" : verdict.ratio.toFixed(1);
      const multiple = verdict.multiple === null ? "n/a" : verdict.multiple.toFixed(1);
      // The source is printed with the number on purpose. "12x against a measured baseline" and
      // "12x against this account's other collected winners" are different claims.
      const against = verdict.baselineSource === null ? "" : ` (vs ${verdict.baselineSource === "recorded" ? "measured baseline" : "other collected entries"})`;
      outlierLines.push(`  [${verdict.reason}] ${entry.id}  views/followers ${ratio}, baseline x${multiple}${against}\n    ${entry.url}`);
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

  if (unmeasured.length > 0) {
    console.log(`\nNo baseline measured yet for ${unmeasured.length} account(s) whose entries were all collected as winners.`);
    console.log("Their multiples are left blank rather than measured against each other. Measure one with:");
    console.log("  npm run patterns:reddit -- --sub r/<name>   (reddit)");
    for (const line of unmeasured) console.log(`  ${line}`);
  }
}

export function main(argv: string[] = process.argv.slice(2)): number {
  const args = parseArgs(argv);
  const config = loadConfig(args.configPath);

  if (args.command === "outliers") {
    const corpus = readCorpus(args.corpusPath);
    printCorpusReport(corpus, config, args.baselinesPath);
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

  printCorpusReport(readCorpus(args.corpusPath), config, args.baselinesPath);
  return invalid > 0 ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
