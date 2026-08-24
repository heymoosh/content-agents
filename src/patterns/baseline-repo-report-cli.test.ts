import { test } from "node:test";
import assert from "node:assert/strict";
import { main, parseBaselineRepoReportArgs, renderBaselineRepoReportMarkdown } from "./baseline-repo-report-cli.js";
import type { AccountBaseline, PatternMiningConfig } from "./types.js";

const config: PatternMiningConfig = {
  niches: ["civic"],
  accounts: [{ platform: "reddit", handle: "r/test", creator: "r/test", niche: "civic", followers: null, topics: ["systems"], focus: ["inference"] }],
  outlier_thresholds: {},
  targets: { corpus_size_min: 1, corpus_size_max: 10 },
};
const baseline: AccountBaseline = {
  platform: "reddit", handle: "r/test", metric: "engagement", terms: ["likes", "comments"], median: 4, sample_size: 3,
  window_start: "2026-08-01", window_end: "2026-08-03", scores: [2, 4, 6], followers: null, method: "settled /new", collected_at: "2026-08-04",
};

test("builds a repo-level report from injected config and ledger loaders", () => {
  let output = "";
  assert.equal(main(["--format", "markdown"], { loadConfig: () => config, readBaselines: () => [baseline] }, { write: (value) => { output = value; } }), 0);
  assert.match(output, /Repository baseline measurement plan/);
  assert.match(output, /already_measured/);
  assert.match(renderBaselineRepoReportMarkdown({ kind: "baseline_repo_report", version: "baseline-repo-report-v1", rows: [], blockedTargets: [], summary: { total: 0, needsMeasurement: 0, alreadyMeasured: 0 }, sideEffects: "none", note: "none" }), /`\/new`/);
});

test("defaults are parseable and failures use the command prefix", () => {
  assert.deepEqual(parseBaselineRepoReportArgs([]), { configPath: undefined, baselinesPath: undefined, format: "json" });
  let error = "";
  assert.equal(main(["--unknown"], { loadConfig: () => config, readBaselines: () => [] }, { error: (value) => { error = value; } }), 1);
  assert.match(error, /patterns:baseline-repo/);
});
