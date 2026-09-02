import { test } from "node:test";
import assert from "node:assert/strict";
import { homedir } from "node:os";
import { join } from "node:path";
import { configuredDataPathOrLegacy, dataRoot } from "./data-root.js";

test("dataRoot: under the test runner an unconfigured root is a throwaway directory, never the real one", () => {
  const saved = process.env.CONTENT_AGENTS_DATA_ROOT;
  delete process.env.CONTENT_AGENTS_DATA_ROOT;
  try {
    assert.ok(process.env.NODE_TEST_CONTEXT, "node:test marks its processes");
    const root = dataRoot();
    assert.ok(!root.includes(join(homedir(), ".content-agents")), `real store must not be touched: ${root}`);
    assert.equal(dataRoot(), root, "stable within the process");
    assert.ok(!configuredDataPathOrLegacy("jobs", "x.json").includes(join(homedir(), ".content-agents")));
  } finally {
    if (saved !== undefined) process.env.CONTENT_AGENTS_DATA_ROOT = saved;
  }
});
