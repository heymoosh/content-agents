import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

test("canonical harness adapter retains the kill-switch and durable approval inputs", () => {
  const source = readFileSync(new URL("./postiz-canary.ts", import.meta.url), "utf8");
  assert.match(source, /POSTIZ_CANARY_INPUT_JSON/);
  assert.match(source, /POSTIZ_CANARY_APPROVAL_JSON/);
  assert.match(source, /runPostizLifecycleCanary/);
  assert.doesNotMatch(source, /CANARY_I_MEAN_IT\s*=\s*["']1/);
});

test("matrix harness adapter retains attended gates and does not enable the kill-switch", () => {
  const source = readFileSync(new URL("./publish-canary-matrix.ts", import.meta.url), "utf8");
  assert.match(source, /PUBLISH_CANARY_MATRIX_JSON/);
  assert.match(source, /POSTIZ_CANARY_APPROVAL_JSON/);
  assert.match(source, /runCanaryMatrix/);
  assert.doesNotMatch(source, /CANARY_I_MEAN_IT\s*=\s*["']1/);
});
