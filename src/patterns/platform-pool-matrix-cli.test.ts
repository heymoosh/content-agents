import { test } from "node:test";
import assert from "node:assert/strict";
import { main, parsePlatformPoolMatrixArgs, parsePlatformPoolMatrixInput } from "./platform-pool-matrix-cli.js";

const target = { id: "x-niche-text-a", platform: "x", researchPool: "niche", medium: "text", format: "short post", configured: true, collected: false, reviewStatus: "unreviewed", baselineReady: false, blockers: ["not collected"] };
const input = JSON.stringify({ targets: [target] });

test("accepts explicit target arrays and renders a deterministic matrix", () => {
  const matrix = parsePlatformPoolMatrixInput(input);
  assert.deepEqual(matrix.summary, { total: 1, configured: 1, collected: 0, reviewed: 0, baselineReady: 0, blocked: 0, unreviewed: 1, gaps: { notConfigured: 0, notCollected: 1, notReviewed: 1, baselineNotReady: 1 } });
  assert.equal(parsePlatformPoolMatrixArgs(["--json", input, "--format", "markdown"]).format, "markdown");
});

test("fails closed on unknown pool or malformed state", () => {
  assert.throws(() => parsePlatformPoolMatrixInput(JSON.stringify({ targets: [{ ...target, researchPool: "unknown" }] })), /researchPool/);
  assert.throws(() => parsePlatformPoolMatrixInput(JSON.stringify({ targets: [{ ...target, configured: "yes" }] })), /configured/);
  let error = "";
  assert.equal(main(["--json", "{}"], { error: (value) => { error = value; } }), 1);
  assert.match(error, /patterns:platform-pool-matrix/);
});
