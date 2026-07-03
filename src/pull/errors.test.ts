/**
 * Unit tests for src/pull/errors.ts — failure classification. classifyUnknown buckets an
 * un-typed thrown error into a PullFailureKind so even unanticipated failures get a culprit;
 * CULPRIT must cover every kind (it's the triage headline printed on failure).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { PullError, classifyUnknown, CULPRIT, type PullFailureKind } from "./errors.js";

test("classifyUnknown buckets setup vs network vs unknown", () => {
  assert.equal(
    classifyUnknown(new Error("Executable doesn't exist at /ms-playwright/…; run npx playwright install")),
    "SETUP"
  );
  assert.equal(classifyUnknown(new Error("page.goto: net::ERR_NAME_NOT_RESOLVED")), "NETWORK");
  assert.equal(classifyUnknown(new Error("connect ETIMEDOUT 10.0.0.1:443")), "NETWORK");
  assert.equal(classifyUnknown(new Error("some unexpected failure")), "UNKNOWN");
  assert.equal(classifyUnknown("a bare string"), "UNKNOWN");
});

test("PullError carries kind + hint and defaults hint to empty", () => {
  const e = new PullError("UI_CHANGED", "Export not found", { hint: "update selectors" });
  assert.equal(e.kind, "UI_CHANGED");
  assert.equal(e.hint, "update selectors");
  assert.equal(e.name, "PullError");
  assert.ok(e instanceof Error);
  assert.equal(new PullError("NETWORK", "x").hint, "");
});

test("every failure kind has a non-empty culprit line", () => {
  const kinds: PullFailureKind[] = [
    "SETUP",
    "NETWORK",
    "SESSION_EXPIRED",
    "UI_CHANGED",
    "DOWNLOAD_FAILED",
    "UNKNOWN",
  ];
  for (const k of kinds) assert.ok(CULPRIT[k] && CULPRIT[k].length > 0, k);
});
