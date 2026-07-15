import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkAndConsumeSearchBudget } from "./search-budget-hook.js";

describe("checkAndConsumeSearchBudget", () => {
  function counterPath(dir: string): string {
    return join(dir, "counter.count");
  }

  test("allows exactly totalBudget calls, then denies every call after", () => {
    const dir = mkdtempSync(join(tmpdir(), "search-budget-hook-test-"));
    try {
      const file = counterPath(dir);
      const results = Array.from({ length: 5 }, () => checkAndConsumeSearchBudget(file, 3));
      assert.deepEqual(results, [true, true, true, false, false]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("persists the count across separate invocations against the same counter file", () => {
    const dir = mkdtempSync(join(tmpdir(), "search-budget-hook-test-"));
    try {
      const file = counterPath(dir);
      assert.equal(checkAndConsumeSearchBudget(file, 2), true);
      assert.equal(readFileSync(file, "utf8"), "1");
      assert.equal(checkAndConsumeSearchBudget(file, 2), true);
      assert.equal(readFileSync(file, "utf8"), "2");
      assert.equal(checkAndConsumeSearchBudget(file, 2), false);
      // A denied call does not consume further budget -- the counter stays at 2, not 3.
      assert.equal(readFileSync(file, "utf8"), "2");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a totalBudget of 0 denies the very first call", () => {
    const dir = mkdtempSync(join(tmpdir(), "search-budget-hook-test-"));
    try {
      assert.equal(checkAndConsumeSearchBudget(counterPath(dir), 0), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("fails open (allows) if the counter file exists but is corrupt/unreadable-as-a-number", () => {
    const dir = mkdtempSync(join(tmpdir(), "search-budget-hook-test-"));
    try {
      const file = counterPath(dir);
      writeFileSync(file, "not-a-number");
      // Corrupt count is treated as 0 (fail-open), so a call is still allowed and overwrites it.
      assert.equal(checkAndConsumeSearchBudget(file, 1), true);
      assert.equal(readFileSync(file, "utf8"), "1");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
