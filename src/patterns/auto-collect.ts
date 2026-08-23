// patterns:auto. The automated half of collection.
//
// Phase 1 needed Muxin to find a good post, copy its text, and hand-stage a JSON file. This walks
// the accounts already listed in config/pattern-mining.yaml, reads their PUBLIC posts through the
// same logged-in browser session src/pull/ uses, and appends whatever is new to the same corpus.
//
// Deterministic only, per rule 4. It fetches, maps fields, dedupes, and reports. It never judges a
// post, never summarizes one, and never calls a model. Reading structure out of the collected
// posts stays the skill's job.
//
// POLITENESS IS A REQUIREMENT HERE, not a nicety. Public pages only, a real jittered delay between
// requests, a hard cap on posts per account and accounts per run, and a full stop on the platform
// the moment it signals a rate limit or a block. We never retry past a block and we never touch a
// captcha.

import { fileURLToPath } from "node:url";
import type { BrowserContext } from "playwright";
import { launchPlatform } from "../pull/browser.js";
import { CULPRIT, PullError, classifyUnknown } from "../pull/errors.js";
import { CORPUS_PATH, appendEntries, groupByAccount, normalizeHandle, readCorpus } from "./corpus.js";
import { loadConfig, thresholdsFor } from "./collect.js";
import { classifyOutlier } from "./outliers.js";
import {
  AUTO_PLATFORMS,
  PATTERN_COLLECTORS,
  defaultSleep,
  isAutoPlatform,
  type AutoPlatform,
  type CollectorAccount,
  type PatternCollector,
  type StopSignal,
} from "./collectors/registry.js";
import type { CorpusEntry, PatternMiningConfig } from "./types.js";

// Defaults chosen to be boring and slow. Raise them deliberately, not by habit.
export const DEFAULT_LIMIT = 10; // posts taken from one account in one run
export const DEFAULT_DELAY_MS = 8_000; // pause between requests, before jitter
export const DEFAULT_MAX_ACCOUNTS = 12; // accounts touched in one run, across all platforms

export interface Args {
  platforms: AutoPlatform[];
  accounts: string[];
  limit: number;
  delayMs: number;
  maxAccounts: number;
  dryRun: boolean;
  // Show the browser. The repo's convention for a first live run against a platform, because a
  // headless window is exactly what a bot check is looking for and because you cannot see what
  // went wrong in a window you cannot see.
  headed: boolean;
  corpusPath: string;
  configPath?: string;
}

export function parseArgs(argv: string[]): Args {
  const args: Args = {
    platforms: [],
    accounts: [],
    limit: DEFAULT_LIMIT,
    delayMs: DEFAULT_DELAY_MS,
    maxAccounts: DEFAULT_MAX_ACCOUNTS,
    dryRun: false,
    headed: false,
    corpusPath: CORPUS_PATH,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--dry-run") args.dryRun = true;
    else if (flag === "--headed") args.headed = true;
    else if (flag === "--platform" && value) (args.platforms.push(...value.split(",").map((p) => p.trim()).filter(Boolean) as AutoPlatform[]), i++);
    else if (flag === "--account" && value) (args.accounts.push(...value.split(",").map((a) => a.trim()).filter(Boolean)), i++);
    else if (flag === "--limit" && value) ((args.limit = Number.parseInt(value, 10)), i++);
    else if (flag === "--delay-ms" && value) ((args.delayMs = Number.parseInt(value, 10)), i++);
    else if (flag === "--max-accounts" && value) ((args.maxAccounts = Number.parseInt(value, 10)), i++);
    else if (flag === "--corpus" && value) ((args.corpusPath = value), i++);
    else if (flag === "--config" && value) ((args.configPath = value), i++);
  }
  return args;
}

export interface PlannedAccount {
  platform: AutoPlatform;
  account: CollectorAccount;
  url: string;
}

export interface RunPlan {
  planned: PlannedAccount[];
  // Accounts named in the config that this run cannot or will not touch, each with the reason.
  skipped: { label: string; reason: string }[];
}

// How many entries the corpus already holds per account, keyed the way groupByAccount keys them.
// This is what makes the per-run cap fair across weeks, see planRun.
export function collectedCounts(corpus: CorpusEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const [key, entries] of groupByAccount(corpus)) counts.set(key, entries.length);
  return counts;
}

// PURE. Turn the config plus the flags into the exact list of accounts this run will touch. This
// is what --dry-run prints, so a run can be checked before it costs anyone a request.
//
// THE CAP IS FAIR, not first-come. The config lists far more accounts than one polite run should
// touch, so something has to be left out. Taking the first N in file order would mean the accounts
// near the bottom of the file never got collected at all, no matter how many weeks the job ran.
// Instead the accounts with the FEWEST entries already in the corpus go first, so repeated runs
// even out across the whole list on their own, with no scheduling state to keep anywhere.
export function planRun(
  config: PatternMiningConfig,
  args: Args,
  collectors: Partial<Record<AutoPlatform, PatternCollector>> = PATTERN_COLLECTORS,
  already: Map<string, number> = new Map(),
): RunPlan {
  const wantPlatforms = args.platforms.length > 0 ? args.platforms : [...AUTO_PLATFORMS];
  const wantAccounts = new Set(args.accounts.map(normalizeHandle));
  const skipped: RunPlan["skipped"] = [];
  const candidates: { item: PlannedAccount; label: string; order: number; collected: number }[] = [];
  let videoAccounts = 0;

  (config.accounts ?? []).forEach((seed, order) => {
    const label = `${seed.creator} (${seed.platform})`;
    if (!isAutoPlatform(seed.platform)) {
      // Video platforms are a deliberate second pass, so this is expected, not a failure. Counted
      // and reported as one line, because one line per account would bury everything else.
      if (args.platforms.length === 0) videoAccounts++;
      return;
    }
    if (!wantPlatforms.includes(seed.platform)) return;
    const collector = collectors[seed.platform];
    if (!collector) {
      skipped.push({ label, reason: `no collector registered for ${seed.platform}` });
      return;
    }
    if (seed.handle === null || seed.handle.trim() === "") {
      // Never guess a handle. A wrong handle collects a different person's posts into the corpus
      // under this creator's name, which is worse than collecting nothing.
      skipped.push({ label, reason: "no handle in config/pattern-mining.yaml" });
      return;
    }
    if (wantAccounts.size > 0 && !wantAccounts.has(normalizeHandle(seed.handle))) return;
    candidates.push({
      label,
      order,
      collected: already.get(`${seed.platform}|${normalizeHandle(seed.handle)}`) ?? 0,
      item: {
        platform: seed.platform,
        account: {
          handle: seed.handle,
          creator: seed.creator,
          niche: seed.niche,
          followers: seed.followers ?? null,
        },
        url: collector.profileUrl(seed.handle),
      },
    });
  });

  // Fewest collected first, config order breaking the tie so a run is reproducible.
  candidates.sort((a, b) => a.collected - b.collected || a.order - b.order);
  const taken = candidates.slice(0, Math.max(0, args.maxAccounts));
  for (const held of candidates.slice(Math.max(0, args.maxAccounts))) {
    skipped.push({
      label: held.label,
      reason: `per-run cap of ${args.maxAccounts} accounts reached; it has ${held.collected} entries already, so accounts with fewer went first`,
    });
  }
  if (videoAccounts > 0) {
    skipped.push({
      label: `${videoAccounts} account(s) on video platforms`,
      reason: "tiktok, youtube and instagram have no collector yet; video is a deliberate second pass",
    });
  }

  return { planned: taken.map((c) => c.item), skipped };
}

export interface AccountOutcome {
  platform: AutoPlatform;
  handle: string;
  creator: string;
  fetched: number;
  appended: number;
  duplicates: number;
  // Entries in the corpus for this account that clear the outlier bar, after the append.
  // null when config/pattern-mining.yaml has no thresholds for the platform.
  outliers: number | null;
  // True when every entry we just fetched carried views: null. That is the normal, expected state
  // on linkedin and substack, and it has a consequence the summary spells out.
  viewsMissing: boolean;
  failure: string | null;
  stop: StopSignal | null;
}

// Does the outlier scoring currently produce a baseline for entries that have no views?
//
// Asked, not assumed. Phase 1 scored views only, and a change to generalize it to public
// engagement is in flight. A printed note that hardcodes either answer is wrong half the time, so
// this probes the real classifyOutlier with synthetic entries and reports what it actually did.
export function baselineScoresWithoutViews(): boolean {
  const base = (url: string, likes: number): CorpusEntry => ({
    id: url, platform: "x", handle: "@probe", creator: "probe", niche: "probe", url,
    posted_at: null, collected_at: "", kind: "text", body: "probe", transcript_source: null,
    metrics: { views: null, likes, comments: 0, shares: 0, followers: 100 },
  });
  const group = [base("p1", 10), base("p2", 10), base("p3", 10), base("p4", 10), base("p5", 1000)];
  const verdict = classifyOutlier(group[4], group, { view_follower_ratio: 1e9, baseline_multiple: 2 });
  return verdict.multiple !== null;
}

function countOutliers(
  corpus: CorpusEntry[],
  platform: string,
  handle: string,
  config: PatternMiningConfig,
): number | null {
  const thresholds = thresholdsFor(config, platform);
  if (!thresholds) return null;
  const group = groupByAccount(corpus).get(`${platform}|${normalizeHandle(handle)}`) ?? [];
  return group.filter((entry) => classifyOutlier(entry, group, thresholds).isOutlier).length;
}

// PURE. The whole run report, as a string, so a test can assert on exactly what a human reads.
export function formatSummary(plan: RunPlan, outcomes: AccountOutcome[], corpusSize: number): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("Account                              Platform    Fetched  New  Outliers");
  for (const outcome of outcomes) {
    // Three different things, kept apart. A number is a real reading. "failed" means we never got
    // posts to score. "no thresholds" means config/pattern-mining.yaml has no bars for this
    // platform. Printing "no thresholds" for an account that simply failed, which an earlier
    // version did, sends someone to edit a config file that was never the problem.
    const outliers = outcome.failure !== null ? "failed" : outcome.outliers === null ? "no thresholds" : String(outcome.outliers);
    lines.push(
      `${("@" + normalizeHandle(outcome.handle)).padEnd(36)} ${outcome.platform.padEnd(11)} ${String(outcome.fetched).padEnd(8)} ${String(outcome.appended).padEnd(4)} ${outliers}`,
    );
  }

  const totals = outcomes.reduce(
    (acc, o) => ({ fetched: acc.fetched + o.fetched, appended: acc.appended + o.appended, duplicates: acc.duplicates + o.duplicates }),
    { fetched: 0, appended: 0, duplicates: 0 },
  );
  lines.push("");
  lines.push(`Fetched ${totals.fetched}. New ${totals.appended}. Already collected ${totals.duplicates}. Corpus is now ${corpusSize}.`);

  // The honest note about what the outlier column can and cannot mean on a platform that does not
  // publish view counts. Without it, a bare "0" reads like a finding about the posts when it is
  // actually the scoring having nothing to work with.
  //
  // The two bars fail differently, so they are described separately. The view-to-follower ratio
  // needs views by definition and can NEVER fire without them, whatever the scoring does later.
  // The baseline bar is a different story: it is being generalized to score on public engagement
  // when views are absent. Rather than hardcode a claim that goes stale the moment that lands, the
  // note ASKS the scoring what it currently does, via baselineScoresWithoutViews().
  const blind = [...new Set(outcomes.filter((o) => o.viewsMissing && o.fetched > 0).map((o) => o.platform))];
  if (blind.length > 0) {
    const baselineWorks = baselineScoresWithoutViews();
    lines.push("");
    lines.push(`Views are not public on ${blind.join(", ")}, so every entry from those platforms carries views: null.`);
    lines.push("The view-to-follower bar can never fire on them. That is a platform fact, not a gap in the");
    lines.push("collector, and it will not change.");
    lines.push(
      baselineWorks
        ? "The baseline bar DOES score these, on the public engagement numbers collected instead of views,"
        : "The baseline bar reads views only as of this run, so it cannot score these either. Read the",
    );
    lines.push(
      baselineWorks
        ? "so the Outliers column above is a real reading for them, just not a view-based one."
        : "Outliers column above as 'not scoreable' for them, not as 'nothing stood out'.",
    );
  }

  const stopped = outcomes.filter((o) => o.stop !== null);
  if (stopped.length > 0) {
    lines.push("");
    lines.push("Stopped early (the platform asked us to back off, so we did):");
    for (const o of stopped) lines.push(`  ${o.platform} @${normalizeHandle(o.handle)}: ${o.stop?.reason}, ${o.stop?.detail}`);
  }

  const failed = outcomes.filter((o) => o.failure !== null);
  if (failed.length > 0) {
    lines.push("");
    lines.push(`Failures (${failed.length}):`);
    for (const o of failed) lines.push(`  ${o.platform} @${normalizeHandle(o.handle)}: ${o.failure}`);
  }

  if (plan.skipped.length > 0) {
    lines.push("");
    lines.push(`Skipped (${plan.skipped.length}):`);
    for (const s of plan.skipped) lines.push(`  ${s.label}: ${s.reason}`);
  }

  return lines.join("\n");
}

function describeFailure(err: unknown, platform: AutoPlatform): string {
  if (err instanceof PullError) {
    const hint = err.hint ? ` ${err.hint}` : "";
    return `[${err.kind}] ${err.message}. ${CULPRIT[err.kind]}.${hint}`;
  }
  const message = err instanceof Error ? err.message : String(err);

  // OBSERVED during the first live run. One saved Chrome profile can only be open in one process
  // at a time, so a second run of this collector, an interrupted run that left a lock behind, or
  // `npm run pull` on the same platform all produce a wall of Playwright launch log that says
  // nothing useful. Name it plainly instead: it is our side, it is not the site, and retrying
  // harder will not fix it.
  if (/ProcessSingleton|SingletonLock|already in use by another/i.test(message)) {
    return `[SETUP] the saved Chrome profile for ${platform} is already open in another process, so this run could not use it. OUR SIDE, not the site: close the other run (or \`npm run pull\`) using ~/.content-agents/browser-profiles/${platform}, then try again. Nothing was wrong with the site.`;
  }

  const kind = classifyUnknown(err);
  return `[${kind}] ${message}. ${CULPRIT[kind]}.`;
}

export interface RunDeps {
  launch: (platform: AutoPlatform, opts: { headed: boolean }) => Promise<BrowserContext>;
  collectors: Partial<Record<AutoPlatform, PatternCollector>>;
  sleep: (ms: number) => Promise<void>;
  now: () => Date;
  log: (line: string) => void;
}

function defaultDeps(): RunDeps {
  return {
    launch: (platform, opts) => launchPlatform(platform, { headed: opts.headed }),
    collectors: PATTERN_COLLECTORS,
    sleep: defaultSleep,
    now: () => new Date(),
    log: (line) => console.log(line),
  };
}

export async function runAutoCollect(args: Args, overrides: Partial<RunDeps> = {}): Promise<number> {
  const deps: RunDeps = { ...defaultDeps(), ...overrides };
  const config = loadConfig(args.configPath);
  const plan = planRun(config, args, deps.collectors, collectedCounts(readCorpus(args.corpusPath)));

  if (plan.planned.length === 0) {
    deps.log("Nothing to collect. Check --platform / --account against config/pattern-mining.yaml.");
    for (const s of plan.skipped) deps.log(`  skipped ${s.label}: ${s.reason}`);
    return 0;
  }

  if (args.dryRun) {
    deps.log(`Dry run. ${plan.planned.length} account(s), up to ${args.limit} post(s) each, about ${args.delayMs}ms between requests.`);
    for (const item of plan.planned) {
      deps.log(`  ${item.platform.padEnd(10)} @${normalizeHandle(item.account.handle).padEnd(24)} ${item.url}`);
    }
    for (const s of plan.skipped) deps.log(`  skipped ${s.label}: ${s.reason}`);
    deps.log("");
    deps.log("Nothing was fetched. No browser was launched and no page was loaded.");
    return 0;
  }

  const outcomes: AccountOutcome[] = [];
  // One platform at a time, because each platform's saved Chrome profile can only be open once.
  for (const platform of AUTO_PLATFORMS) {
    const forPlatform = plan.planned.filter((item) => item.platform === platform);
    if (forPlatform.length === 0) continue;
    const collector = deps.collectors[platform];
    if (!collector) continue;

    let context: BrowserContext;
    try {
      context = await deps.launch(platform, { headed: args.headed });
    } catch (err) {
      for (const item of forPlatform) {
        outcomes.push(emptyOutcome(item, describeFailure(err, platform)));
      }
      continue;
    }

    try {
      for (const [index, item] of forPlatform.entries()) {
        const outcome = emptyOutcome(item, null);
        try {
          const result = await collector.collect(context, item.account, {
            limit: args.limit,
            delayMs: args.delayMs,
            now: deps.now,
            sleep: deps.sleep,
          });
          outcome.fetched = result.entries.length;
          outcome.stop = result.stop;
          outcome.viewsMissing = result.entries.length > 0 && result.entries.every((e) => e.metrics.views === null);
          const { appended, duplicates } = appendEntries(result.entries, args.corpusPath);
          outcome.appended = appended.length;
          outcome.duplicates = duplicates.length;
          outcome.outliers = countOutliers(readCorpus(args.corpusPath), platform, item.account.handle, config);
        } catch (err) {
          outcome.failure = describeFailure(err, platform);
          outcomes.push(outcome);
          // A lapsed session or a dead connection will not fix itself between accounts, so there
          // is no point hammering the rest of this platform's list.
          if (err instanceof PullError && (err.kind === "SESSION_EXPIRED" || err.kind === "NETWORK")) {
            noteNotAttempted(plan, forPlatform.slice(index + 1), `${platform} stopped after a ${err.kind}`);
            break;
          }
          continue;
        }
        outcomes.push(outcome);
        if (outcome.stop) {
          // Told to back off: this platform is done for the run. Say which accounts that cost, so
          // the summary never quietly drops them.
          noteNotAttempted(plan, forPlatform.slice(index + 1), `${platform} stopped: ${outcome.stop.reason}`);
          break;
        }
        await deps.sleep(args.delayMs);
      }
    } finally {
      await context.close().catch(() => {});
    }
  }

  deps.log(formatSummary(plan, outcomes, readCorpus(args.corpusPath).length));
  return outcomes.some((o) => o.failure !== null) ? 1 : 0;
}

function noteNotAttempted(plan: RunPlan, remaining: PlannedAccount[], reason: string): void {
  for (const item of remaining) {
    plan.skipped.push({ label: `${item.account.creator} (${item.platform})`, reason: `not attempted, ${reason}` });
  }
}

function emptyOutcome(item: PlannedAccount, failure: string | null): AccountOutcome {
  return {
    platform: item.platform,
    handle: item.account.handle,
    creator: item.account.creator,
    fetched: 0,
    appended: 0,
    duplicates: 0,
    outliers: null,
    viewsMissing: false,
    failure,
    stop: null,
  };
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  return runAutoCollect(parseArgs(argv));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().then((code) => {
    process.exitCode = code;
  });
}
