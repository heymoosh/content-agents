import { test } from "node:test";
import assert from "node:assert/strict";
import { main, parsePoolBestReportArgs } from "./pool-best-report-cli.js";

const empty = JSON.stringify({ evidence: [], reviews: [], baselines: [], minimumComparableCandidates: 2 });

test("renders an explicit empty report without writing or fetching", () => {
  let output = "";
  assert.equal(main(["--json", empty, "--format", "markdown"], { write: (value) => { output = value; } }), 0);
  assert.match(output, /Pool best report/);
  assert.match(output, /winner groups: 0/);
});

test("parses a file source and both format", () => {
  assert.deepEqual(parsePoolBestReportArgs(["--input", "evidence.json", "--format", "both"]), {
    source: { kind: "file", path: "evidence.json" }, format: "both",
  });
});

test("fails closed on missing envelope facts", () => {
  let error = "";
  assert.equal(main(["--json", "{}"], { error: (value) => { error = value; } }), 1);
  assert.match(error, /patterns:best-report/);
  assert.match(error, /evidence must be an array/);
});
