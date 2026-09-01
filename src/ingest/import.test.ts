import assert from "node:assert/strict";
import test from "node:test";
import { validateImportMeasurementBinding } from "./import.js";

test("direct ingest accepts only the exact configured measurement account", () => {
  assert.deepEqual(
    validateImportMeasurementBinding({ brandId: "human-inference", providerAccountId: "human-inference/browser-analytics" }),
    { brandId: "human-inference", providerAccountId: "human-inference/browser-analytics" }
  );
});

test("direct ingest refuses wrong, unset, and syntactically valid but unconfigured accounts", () => {
  assert.throws(() => validateImportMeasurementBinding({ brandId: "human-inference", providerAccountId: "human-inference/postiz" }), /not configured/);
  assert.throws(() => validateImportMeasurementBinding({ brandId: "charles", providerAccountId: "charles/substack" }), /no measurement account configured/);
  assert.throws(() => validateImportMeasurementBinding({ brandId: "fiction", providerAccountId: "fiction/substack" }), /no measurement account configured/);
});
