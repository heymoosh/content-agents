import { test } from "node:test";
import assert from "node:assert/strict";
import { main, parseBaselineGapReportArgs, parseBaselineGapReportInput } from "./baseline-gap-report-cli.js";

const input = JSON.stringify({ targets: [{ platform: "reddit", handle: "r/test", topic: "AI" }], baselines: [] });

test("accepts explicit target and baseline arrays", () => {
  const report = parseBaselineGapReportInput(input);
  assert.equal(report.summary.needsMeasurement, 1);
  assert.equal(parseBaselineGapReportArgs(["--json", input, "--format", "markdown"]).format, "markdown");
});

test("fails closed and has a stdout-only main", () => {
  assert.throws(() => parseBaselineGapReportInput(JSON.stringify({ targets: [], baselines: "not-an-array" })), /arrays/);
  assert.throws(() => parseBaselineGapReportInput(JSON.stringify({ targets: [{ platform: "reddit", handle: "r/test" }], baselines: [{ platform: "reddit", handle: "r/test" }] })), /metric/);
  assert.throws(() => parseBaselineGapReportInput(JSON.stringify({ targets: [{ platform: "reddit", handle: "r/test", sampleSize: 0 }], baselines: [] })), /sampleSize/);
  let output = "";
  assert.equal(main(["--json", input], { write: (value) => { output = value; } }), 0);
  assert.match(output, /baseline_gap_report/);
});
