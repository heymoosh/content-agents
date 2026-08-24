import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildBaselineGapReport, renderBaselineGapReportMarkdown } from "./baseline-gap-report.js";
import type { AccountBaseline } from "./types.js";

const measured: AccountBaseline = {
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

describe("baseline gap report", () => {
  test("distinguishes measured baselines from explicit /new measurement gaps", () => {
    const report = buildBaselineGapReport([
      { platform: "reddit", handle: "r/ADHD", topic: "attention", focus: ["habits"] },
      { platform: "reddit", handle: "r/LocalLLaMA", topic: "AI", focus: ["open models"], sampleSize: 100, minAgeDays: 3 },
    ], [measured]);

    assert.deepEqual(report.summary, { total: 2, needsMeasurement: 1, alreadyMeasured: 1 });
    assert.deepEqual(report.rows[0], { accountKey: "reddit|r/adhd", platform: "reddit", handle: "r/ADHD", topic: "attention", focus: ["habits"], action: "already_measured", requiredRoute: "/new", sampleSize: null, minAgeDays: null, method: null, caveats: [], measured: { sampleSize: 12, windowStart: "2026-08-01T00:00:00.000Z", windowEnd: "2026-08-10T00:00:00.000Z", method: "settled /new sample", collectedAt: "2026-08-11T00:00:00.000Z" } });
    assert.deepEqual(report.rows[1], { accountKey: "reddit|r/localllama", platform: "reddit", handle: "r/LocalLLaMA", topic: "AI", focus: ["open models"], action: "measure_baseline", requiredRoute: "/new", sampleSize: 100, minAgeDays: 3, method: null, caveats: [], measured: null });
    assert.equal(report.sideEffects, "none");
  });

  test("normalizes ordering and never invents a missing median", () => {
    const report = buildBaselineGapReport([
      { platform: "reddit", handle: "@zeta", focus: ["", "b", "a", "a"] },
      { platform: "reddit", handle: "alpha", caveats: [" caveat ", "caveat"] },
    ], []);

    assert.deepEqual(report.rows.map((row) => row.handle), ["alpha", "@zeta"]);
    assert.deepEqual(report.rows[1].focus, ["a", "b"]);
    assert.equal(report.rows[0].measured, null);
    assert.equal(JSON.stringify(report).includes('"median"'), false);
  });

  test("renders an operator table with the required route", () => {
    const markdown = renderBaselineGapReportMarkdown(buildBaselineGapReport([
      { platform: "reddit", handle: "r/test", topic: "civic tech" },
    ], []));
    assert.equal(markdown.includes("`/new`"), true);
    assert.equal(markdown.includes("measure_baseline"), true);
  });

  test("rejects an empty handle", () => {
    assert.throws(() => buildBaselineGapReport([{ platform: "reddit", handle: " " }], []), /handle/);
  });
});
