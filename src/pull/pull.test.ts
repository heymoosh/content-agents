import assert from "node:assert/strict";
import test from "node:test";
import { measurementIngestArgs, parsePullBrand } from "./pull.js";

test("pull requires explicit brand and resolves its configured measurement account", () => {
  assert.equal(parsePullBrand(["--brand", "human-inference"]), "human-inference");
  assert.deepEqual(measurementIngestArgs("human-inference"), [
    "--brand", "human-inference", "--account", "human-inference/browser-analytics",
  ]);
});

test("pull fails closed for missing brand or unconfigured brand measurement account", () => {
  assert.throws(() => parsePullBrand([]), /requires explicit --brand/);
  assert.throws(() => measurementIngestArgs("charles"), /no measurement account configured/);
  assert.throws(() => measurementIngestArgs("fiction"), /no measurement account configured/);
});
