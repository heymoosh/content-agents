/**
 * Unit tests for src/config/platforms.ts loadPlatforms() — the single memoized, zod-validated
 * reader every call site now uses instead of independently reading + casting config/platforms.yaml.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { loadPlatforms } from "./platforms.js";

describe("loadPlatforms: validates the real config/platforms.yaml without behavior change", () => {
  test("loads all known top-level sections with the shapes callers rely on", () => {
    const cfg = loadPlatforms();
    assert.equal(cfg.platforms.x.max_chars, 280);
    assert.equal(cfg.platforms.linkedin.posts_per_week, 5);
    assert.deepEqual(cfg.platforms.linkedin.slot_days, ["Mon", "Tue", "Wed", "Thu", "Fri"]);
    assert.equal(cfg.platforms["video-script"].max_words, 220);
    assert.equal(cfg.min_reuse_days, 30);
    assert.ok(cfg.home_brand, "home_brand should be present");
    assert.match(cfg.home_brand!.worldview, /harmful hidden beliefs/);
    assert.ok(cfg.spin_angles.x, "spin_angles.x should be present");
    assert.ok(cfg.communities["moral-ambition"], "communities should be present");
  });

  test("memoized: repeated calls return the same object reference (read once per process)", () => {
    const a = loadPlatforms();
    const b = loadPlatforms();
    assert.equal(a, b, "loadPlatforms should return the cached object, not re-read the file");
  });
});
