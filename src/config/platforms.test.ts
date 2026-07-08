/**
 * Unit tests for src/config/platforms.ts loadPlatforms() — the single memoized, zod-validated
 * reader every call site now uses instead of independently reading + casting config/platforms.yaml.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { loadPlatforms, platformRuleSchema } from "./platforms.js";

describe("loadPlatforms: validates the real config/platforms.yaml without behavior change", () => {
  test("loads all known top-level sections with the shapes callers rely on", () => {
    const cfg = loadPlatforms();
    // Structural checks only for cadence fields Muxin tunes directly in config/platforms.yaml
    // (posts_per_week, slot_days) — asserting today's exact tuning here would fail this test on
    // every unrelated cadence edit. max_chars/max_words/worldview are stable format constraints,
    // safe to assert exactly.
    assert.equal(cfg.platforms.x.max_chars, 280);
    assert.equal(typeof cfg.platforms.linkedin.posts_per_week, "number");
    assert.ok(cfg.platforms.linkedin.slot_days!.length > 0, "linkedin should have slot_days configured");
    assert.equal(cfg.platforms["video-script"].max_words, 220);
    assert.equal(typeof cfg.min_reuse_days, "number");
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

  test("the real config/platforms.yaml does not set max_slots_per_day on any platform (mechanism-only card)", () => {
    const cfg = loadPlatforms();
    for (const [name, rule] of Object.entries(cfg.platforms)) {
      assert.equal(rule.max_slots_per_day, undefined, `${name} should not have max_slots_per_day set yet`);
    }
  });
});

describe("platformRuleSchema: max_slots_per_day", () => {
  test("parses a valid max_slots_per_day as a typed number", () => {
    const rule = platformRuleSchema.parse({ max_slots_per_day: 3 });
    assert.equal(rule.max_slots_per_day, 3);
  });

  test("leaves max_slots_per_day undefined when absent (default-of-1 is applied by the scheduler, not the schema)", () => {
    const rule = platformRuleSchema.parse({});
    assert.equal(rule.max_slots_per_day, undefined);
  });

  test("rejects a non-number max_slots_per_day instead of silently passing it through", () => {
    assert.throws(() => platformRuleSchema.parse({ max_slots_per_day: "three" }));
  });
});
