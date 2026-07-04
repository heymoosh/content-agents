/**
 * Unit tests for src/publish/reuse-guard.ts — checkReuse window math.
 *
 * Strategy: checkReuse reads briefs/bets.md from a hardcoded path (join(repoRoot, "briefs/bets.md")).
 * We can't inject that path, so the before/after hooks write controlled fixture lines to the real
 * bets.md and restore the original on teardown.
 *
 * checkReuse accepts a minDaysOverride param that skips the platforms.yaml lookup, which makes most
 * window-math tests fully deterministic without touching config. The per-platform test deliberately
 * omits the override so it exercises the real config/platforms.yaml lookup.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkReuse } from "./reuse-guard.js";

// Compute repo root the same way db.ts does: dirname(this file) = src/publish → ../.. = repo root
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BETS_PATH = join(repoRoot, "briefs", "bets.md");

// Unique test slugs — chosen to be impossible to collide with real placed-log entries.
const SLUG_WINDOW = "test-fixture-9999-rg-window";
const SLUG_PLATFORM = "test-fixture-9999-rg-platform";

const now = Date.now();
const fiveDaysAgo   = new Date(now - 5  * 86_400_000).toISOString(); // inside 30-day window
const fortyDaysAgo  = new Date(now - 40 * 86_400_000).toISOString(); // outside 30-day window
const twentyDaysAgo = new Date(now - 20 * 86_400_000).toISOString(); // outside x(14) but inside linkedin(60)

// Fixture lines that look exactly like real placed-log entries so the regex matches them.
const FIXTURE_LINES = `
- placed ${fiveDaysAgo} [${SLUG_WINDOW}/x-1] x → test fixture inside window
- placed ${fortyDaysAgo} [${SLUG_WINDOW}/linkedin-1] linkedin → test fixture outside window
- placed ${twentyDaysAgo} [${SLUG_PLATFORM}/x-1] x → test fixture platform-x 20d
- placed ${twentyDaysAgo} [${SLUG_PLATFORM}/linkedin-1] linkedin → test fixture platform-linkedin 20d
`;

let savedBets: string | null = null;

describe("reuse-guard: checkReuse window math", () => {
  before(() => {
    savedBets = existsSync(BETS_PATH) ? readFileSync(BETS_PATH, "utf8") : null;
    // Append fixture lines so real bets data is undisturbed (avoids test-vs-reality bleed).
    writeFileSync(BETS_PATH, (savedBets ?? "") + "\n" + FIXTURE_LINES);
  });

  after(() => {
    // Restore exactly what was there (or remove if bets.md didn't exist).
    if (savedBets === null) {
      // file didn't exist before — but briefs/bets.md always exists in this repo, leave it as-is
      writeFileSync(BETS_PATH, "");
    } else {
      writeFileSync(BETS_PATH, savedBets);
    }
  });

  test("blocked when last placement is inside min_reuse_days window", () => {
    // SLUG_WINDOW placed on x 5 days ago; override min=30 → 5 < 30 → blocked
    const result = checkReuse(SLUG_WINDOW, "x", 30);
    assert.equal(result.allowed, false, "should be blocked (5 days < 30)");
    assert.ok(result.reason !== undefined, "should have a reason string");
    assert.ok(result.reason!.includes(SLUG_WINDOW), "reason should name the slug");
    assert.ok(
      typeof result.daysSince === "number" && result.daysSince < 30,
      `daysSince (${result.daysSince}) should be < 30`
    );
    assert.ok(result.lastPlacedAt !== undefined, "should record the last placement timestamp");
  });

  test("allowed when last placement is outside min_reuse_days window", () => {
    // SLUG_WINDOW placed on linkedin 40 days ago; override min=30 → 40 > 30 → allowed
    const result = checkReuse(SLUG_WINDOW, "linkedin", 30);
    assert.equal(result.allowed, true, "should be allowed (40 days > 30)");
    assert.ok(result.reason === undefined, "should have no reason when allowed");
    assert.ok(
      typeof result.daysSince === "number" && result.daysSince > 30,
      `daysSince (${result.daysSince}) should be > 30`
    );
  });

  test("allowed when no prior placement exists for slug", () => {
    const result = checkReuse("no-such-slug-ever-placed-anywhere", "x", 30);
    assert.equal(result.allowed, true, "unknown slug should be allowed");
    assert.equal(result.lastPlacedAt, undefined, "no lastPlacedAt for unknown slug");
    assert.equal(result.daysSince, undefined, "no daysSince for unknown slug");
  });

  test("allowed when prior placement is for a different platform", () => {
    // SLUG_WINDOW has only x and linkedin placements — bluesky has none
    const result = checkReuse(SLUG_WINDOW, "bluesky", 30);
    assert.equal(result.allowed, true, "no bluesky placement → allowed");
  });

  test("per-platform min_reuse_days from platforms.yaml honored: x(14) vs linkedin(60) with 20-day-old placement", () => {
    // Both SLUG_PLATFORM/x and SLUG_PLATFORM/linkedin were placed 20 days ago.
    // config/platforms.yaml: x.min_reuse_days = 14, linkedin.min_reuse_days = 60
    // 20 > 14 → x: allowed
    // 20 < 60 → linkedin: blocked
    const xResult = checkReuse(SLUG_PLATFORM, "x"); // no override: reads real config
    assert.equal(
      xResult.allowed,
      true,
      `x (min=14) with 20-day placement should be allowed, got: ${xResult.reason}`
    );

    const liResult = checkReuse(SLUG_PLATFORM, "linkedin"); // no override: reads real config
    assert.equal(
      liResult.allowed,
      false,
      `linkedin (min=60) with 20-day placement should be blocked`
    );
    assert.ok(liResult.reason?.includes("linkedin"), "linkedin block reason should mention platform");
  });
});
