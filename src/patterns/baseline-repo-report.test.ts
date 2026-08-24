import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBaselineRepoReport } from "./baseline-repo-report.js";
import type { AccountBaseline, PatternMiningConfig } from "./types.js";

const config: PatternMiningConfig = {
  niches: ["civic"],
  accounts: [
    {
      platform: "reddit",
      handle: "r/ADHD",
      creator: "Creator",
      niche: "civic",
      followers: null,
      topics: ["attention", "systems"],
      focus: ["inference"],
    },
  ],
  outlier_thresholds: {},
  targets: { corpus_size_min: 1, corpus_size_max: 10 },
};

const baseline: AccountBaseline = {
  platform: "reddit",
  handle: "r/ADHD",
  metric: "engagement",
  terms: ["likes", "comments"],
  median: 42,
  sample_size: 12,
  window_start: "2026-08-01T00:00:00.000Z",
  window_end: "2026-08-10T00:00:00.000Z",
  scores: [10, 42, 90],
  followers: 123,
  method: "settled /new sample",
  collected_at: "2026-08-11T00:00:00.000Z",
};

test("adapts config accounts into a body-free baseline plan without inventing metadata", () => {
  const report = buildBaselineRepoReport(config, [baseline]);

  assert.deepEqual(report.summary, { total: 1, needsMeasurement: 0, alreadyMeasured: 1 });
  assert.deepEqual(report.rows[0], {
    accountKey: "reddit|r/adhd",
    platform: "reddit",
    handle: "r/ADHD",
    niche: "civic",
    topics: ["attention", "systems"],
    focus: ["inference"],
    topic: null,
    action: "already_measured",
    requiredRoute: "/new",
    sampleSize: null,
    minAgeDays: null,
    method: null,
    caveats: [],
    measured: {
      sampleSize: 12,
      windowStart: "2026-08-01T00:00:00.000Z",
      windowEnd: "2026-08-10T00:00:00.000Z",
      method: "settled /new sample",
      collectedAt: "2026-08-11T00:00:00.000Z",
    },
  });
  assert.equal(report.sideEffects, "none");
  assert.deepEqual(report.blockedTargets, []);
  assert.equal(JSON.stringify(report).includes('"median"'), false);
  assert.equal(JSON.stringify(report).includes("body"), false);
});

test("keeps explicit measurement parameters and supports target arrays", () => {
  const report = buildBaselineRepoReport([
    {
      platform: "x",
      handle: "@alpha",
      niche: "labor",
      topics: ["work"],
      focus: ["systems"],
      sampleSize: 25,
      minAgeDays: 4,
      method: "settled listing",
      caveats: ["manual review required"],
    },
  ], []);

  assert.deepEqual(report.rows[0], {
    accountKey: "x|alpha",
    platform: "x",
    handle: "@alpha",
    niche: "labor",
    topics: ["work"],
    focus: ["systems"],
    topic: null,
    action: "measure_baseline",
    requiredRoute: "/new",
    sampleSize: 25,
    minAgeDays: 4,
    method: "settled listing",
    caveats: ["manual review required"],
    measured: null,
  });
});

test("fails closed on malformed targets", () => {
  assert.throws(() => buildBaselineRepoReport([
    { platform: "reddit", handle: null, niche: "civic" },
  ], []), /handle/);
  assert.throws(() => buildBaselineRepoReport([
    { platform: "not-a-platform", handle: "r/test", niche: "civic" },
  ] as never, []), /platform/);
  assert.throws(() => buildBaselineRepoReport([
    { platform: "reddit", handle: "r/test", niche: "civic", topics: ["ok", 2] },
  ] as never, []), /topics/);
});

test("keeps config accounts without confirmed handles visible as blocked", () => {
  const report = buildBaselineRepoReport({ ...config, accounts: [{ ...config.accounts[0], handle: null }] }, []);
  assert.deepEqual(report.rows, []);
  assert.deepEqual(report.blockedTargets, [{ platform: "reddit", creator: "Creator", niche: "civic", reason: "handle_not_confirmed" }]);
});
