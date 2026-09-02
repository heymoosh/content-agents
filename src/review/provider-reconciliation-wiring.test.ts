import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

test("review server starts bounded reconciliation and exposes last-run health", () => {
  const source = readFileSync(new URL("./serve.ts", import.meta.url), "utf8");
  assert.match(source, /startProviderReconciliationLoop\(\)/);
  assert.match(source, /\/api\/publishing\/reconciliation-health/);
  assert.match(source, /if \(!FIXTURES_ON\) startProviderReconciliationLoop/);
});

test("review server drains rate-limited approved rows in the background and exposes that health", () => {
  const source = readFileSync(new URL("./serve.ts", import.meta.url), "utf8");
  assert.match(source, /if \(!FIXTURES_ON\) startPublishDrainLoop\(\)/);
  assert.match(source, /\/api\/publishing\/drain-health/);
  const page = readFileSync(new URL("./page.ts", import.meta.url), "utf8");
  assert.match(page, /fetch\("\/api\/publishing\/drain-health"\)/);
  assert.match(page, /waiting for Postiz/);
});
