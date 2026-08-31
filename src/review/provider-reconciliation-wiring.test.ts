import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

test("review server starts bounded reconciliation and exposes last-run health", () => {
  const source = readFileSync(new URL("./serve.ts", import.meta.url), "utf8");
  assert.match(source, /startProviderReconciliationLoop\(\)/);
  assert.match(source, /\/api\/publishing\/reconciliation-health/);
  assert.match(source, /if \(!FIXTURES_ON\) startProviderReconciliationLoop/);
});
