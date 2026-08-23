// Weekly pattern mining. Pull the configured accounts, then look for new ones.
//
// Runs the same verified commands you'd run by hand, in order, isolating failures so one blocked
// platform never stops the rest:
//   1. npm run patterns:auto -- --platform x         → public posts from the configured x accounts
//   2. npm run patterns:auto -- --platform linkedin  → same, LinkedIn
//   3. npm run patterns:auto -- --platform substack  → same, Substack
//   4. npm run patterns:discover                     → PROPOSES new accounts by search, adds none
//
// Text platforms only. Video collection (tiktok, youtube, instagram) is not built, so this job
// does not touch it and a video entry still needs a pasted transcript.
//
// Safe to run twice. The corpus dedupes by url (src/patterns/corpus.ts), so a second run over the
// same week appends nothing it already has. Discovery writes proposals, never config: adding an
// account to config/pattern-mining.yaml stays a thing Muxin does by hand with
// `npm run patterns:discover -- --approve <handle>`.
//
// Each step is a separate child process on purpose. That is what makes "LinkedIn blocked us" a
// line in the report instead of a dead run.
//
// THE STEPS MUST STAY SEQUENTIAL, and not for tidiness. launchPersistentContext takes an EXCLUSIVE
// lock on a Chrome profile directory, and src/pull/ keeps one profile per platform. Two steps
// touching the same platform at the same instant fail on that lock, with an error that reads like
// nothing in particular. spawnSync blocks until the child exits, so the four steps are sequenced by
// construction, and the discovery step, which walks every platform itself, runs last. Do not
// "speed this up" by running platforms concurrently. patterns-weekly.test.ts asserts the ordering
// and that the run stays synchronous, so a refactor that breaks this fails there.
//
// Meant to be driven by launchd (config/launchd/com.content-agents.patterns-weekly.plist, see
// docs/setup-patterns-weekly.md), but safe to run by hand any time: `npm run patterns:weekly`.
// NOTHING is installed or scheduled by shipping this file or that plist; loading the LaunchAgent
// is a step Muxin takes herself.

import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { repoRoot } from "../db/db.js";
import { PATTERNS_DIR, readCorpus } from "../patterns/corpus.js";

// The run report lands next to the corpus, so it is gitignored for the same reason the corpus is:
// what it summarizes is other people's posts.
export const RUN_REPORT_PATH = join(PATTERNS_DIR, "weekly-runs.jsonl");

// The text platforms this job collects. Video is deliberately absent, not stubbed.
export const TEXT_PLATFORMS = ["x", "linkedin", "substack"] as const;

export interface Step {
  name: string;
  cmd: string;
  args: string[];
}

export interface StepResult {
  name: string;
  code: number;
}

export interface RunReport {
  ran_at: string;
  dry_run: boolean;
  steps: StepResult[];
  failed: string[];
  corpus_before: number;
  corpus_after: number;
  new_entries: number;
}

// One collector run per platform, then one discovery run. `--dry-run` is passed straight through
// to both, and both honor it by fetching nothing.
export function buildSteps(dryRun: boolean): Step[] {
  const dry = dryRun ? ["--dry-run"] : [];
  const steps: Step[] = TEXT_PLATFORMS.map((platform) => ({
    name: `collect ${platform}`,
    cmd: "npm",
    args: ["run", "patterns:auto", "--", "--platform", platform, ...dry],
  }));
  steps.push({
    name: "discover new accounts (proposes only)",
    cmd: "npm",
    args: ["run", "patterns:discover", "--", ...dry],
  });
  return steps;
}

// Injected so tests can exercise the report without spawning npm.
export type Runner = (step: Step) => number;

const spawnRunner: Runner = (step) => {
  const r = spawnSync(step.cmd, step.args, { cwd: repoRoot, stdio: "inherit" });
  return r.status ?? 1;
};

export function summarize(
  results: StepResult[],
  counts: { before: number; after: number },
  opts: { dryRun: boolean; ranAt?: string },
): RunReport {
  return {
    ran_at: opts.ranAt ?? new Date().toISOString(),
    dry_run: opts.dryRun,
    steps: results,
    failed: results.filter((r) => r.code !== 0).map((r) => r.name),
    corpus_before: counts.before,
    corpus_after: counts.after,
    new_entries: counts.after - counts.before,
  };
}

// A dry run proves the wiring without touching the report file, same way --dry-run fetches
// nothing.
export function writeRunReport(report: RunReport, path: string = RUN_REPORT_PATH): void {
  if (report.dry_run) return;
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(report) + "\n", "utf8");
}

export function formatReport(report: RunReport): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("═══ summary ═══");
  for (const step of report.steps) lines.push(`  ${step.code === 0 ? "✓" : "✗"} ${step.name}`);
  lines.push(
    report.dry_run
      ? "\nDry run: nothing was fetched and nothing was written."
      : `\nCorpus: ${report.corpus_before} → ${report.corpus_after} entries (${report.new_entries} new).`,
  );
  if (report.failed.length > 0) {
    lines.push(
      `\n⚠ ${report.failed.length} step(s) failed: ${report.failed.join(", ")}.` +
        `\nA platform that blocked or rate limited us is a normal outcome, not a bug. It stopped for` +
        `\nthis run only and the other platforms above still collected. Re-run next week, or by hand` +
        `\nwith: npm run patterns:auto -- --platform <name>`,
    );
  }
  lines.push(
    "\nNew accounts are PROPOSED, never added. Read data/patterns/account-proposals.jsonl, then" +
      "\nadd the ones you want with: npm run patterns:discover -- --approve <handle>",
  );
  return lines.join("\n");
}

export interface MainOptions {
  runner?: Runner;
  reportPath?: string;
  corpusCount?: () => number;
}

export function main(argv: string[] = process.argv.slice(2), opts: MainOptions = {}): number {
  const dryRun = argv.includes("--dry-run");
  const runner = opts.runner ?? spawnRunner;
  const countCorpus = opts.corpusCount ?? (() => readCorpus().length);

  const startedAt = new Date().toISOString();
  console.log(`\n═══ weekly pattern mining · ${startedAt}${dryRun ? " · DRY RUN" : ""} ═══`);
  console.log("Text platforms only (x, linkedin, substack). Video collection is not built yet.");

  const before = countCorpus();
  const results: StepResult[] = [];
  for (const step of buildSteps(dryRun)) {
    console.log(`\n━━ ${step.name} ━━`);
    results.push({ name: step.name, code: runner(step) });
  }
  const after = countCorpus();

  const report = summarize(results, { before, after }, { dryRun, ranAt: startedAt });
  writeRunReport(report, opts.reportPath ?? RUN_REPORT_PATH);
  console.log(formatReport(report));

  return report.failed.length > 0 ? 1 : 0;
}

// Guarded so the test file can import the pieces above without running the job. weekly-pull.ts
// calls main() at import because nothing imports it; this one is imported by its test.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
