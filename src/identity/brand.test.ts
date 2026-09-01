import { test } from "node:test";
import assert from "node:assert/strict";
import { brandForOrigin, validateMeasurementBinding } from "./brand.js";

test("brand resolver fails closed for ambiguous Studio and maps Venture to Human Inference", () => {
  assert.equal(brandForOrigin("studio"), null);
  assert.equal(brandForOrigin(undefined), null);
  assert.equal(brandForOrigin("venture"), "human-inference");
  assert.equal(brandForOrigin("charles"), "charles");
  assert.equal(brandForOrigin("fiction"), "fiction");
});

test("measurement binding requires an allowlisted brand and account identity", () => {
  assert.deepEqual(validateMeasurementBinding({ brandId: "charles", providerAccountId: "charles/substack" }), {
    brandId: "charles", providerAccountId: "charles/substack",
  });
  assert.throws(() => validateMeasurementBinding({ brandId: "studio", providerAccountId: "x" }), /invalid brand/);
  assert.throws(() => validateMeasurementBinding({ brandId: "fiction" }), /provider account/);
});
