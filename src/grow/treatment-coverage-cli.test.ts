import assert from "node:assert/strict";
import test from "node:test";
import { main, parseGrowTreatmentCoverageArgs } from "./treatment-coverage-cli.js";

const empty = JSON.stringify({ requestedTreatments: [], candidates: [] });

test("renders an explicit empty treatment report", () => {
  let output = "";
  assert.equal(main(["--json", empty, "--format", "markdown"], { write: (value) => { output = value; } }), 0);
  assert.match(output, /Grow treatment coverage/);
  assert.match(output, /Requested: 0/);
  assert.doesNotMatch(output, /copyOrAssetRef|body text|asset contents/);
});

test("parses file and both-format options", () => {
  assert.deepEqual(parseGrowTreatmentCoverageArgs(["--input", "coverage.json", "--format", "both"]), {
    source: { kind: "file", path: "coverage.json" }, format: "both",
  });
});

test("fails closed on malformed nested envelopes", () => {
  let error = "";
  assert.equal(main(["--json", JSON.stringify({ candidates: [] })], { error: (value) => { error = value; } }), 1);
  assert.match(error, /requestedTreatments is required/);
  assert.equal(main(["--json", JSON.stringify({ requestedTreatments: ["bad"], candidates: [] })], { error: (value) => { error = value; } }), 1);
  assert.match(error, /requestedTreatments\[0\] must be an object/);
  assert.throws(() => parseGrowTreatmentCoverageArgs(["--json", "{}", "--input", "x"]), /exactly one/);
});
