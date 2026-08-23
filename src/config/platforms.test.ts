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

  test("the real config/platforms.yaml only sets max_slots_per_day on daily text platforms that also receive quote-cards", () => {
    const cfg = loadPlatforms();
    // Raised to 2 on x/linkedin/mastodon/threads/bluesky (Muxin, 2026-08-20): daily text cadence
    // now claims every day's one slot on these platforms, so a same-day quote-card needs room too.
    // Every other platform (substack, tiktok, youtube, community, video-script, quote-card itself)
    // is untouched and should still fall back to the scheduler's default cap of 1.
    const expectRaised = new Set(["x", "linkedin", "mastodon", "threads", "bluesky"]);
    for (const [name, rule] of Object.entries(cfg.platforms)) {
      if (expectRaised.has(name)) {
        assert.equal(rule.max_slots_per_day, 2, `${name} should have max_slots_per_day: 2`);
      } else {
        assert.equal(rule.max_slots_per_day, undefined, `${name} should not have max_slots_per_day set`);
      }
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

  test("rejects zero, negative, and fractional max_slots_per_day (would silently starve or off-by-one the day cap)", () => {
    assert.throws(() => platformRuleSchema.parse({ max_slots_per_day: 0 }));
    assert.throws(() => platformRuleSchema.parse({ max_slots_per_day: -1 }));
    assert.throws(() => platformRuleSchema.parse({ max_slots_per_day: 1.5 }));
  });
});

describe("platformRuleSchema: rehook", () => {
  test("parses an explicit rehook as a typed boolean", () => {
    assert.equal(platformRuleSchema.parse({ rehook: false }).rehook, false);
    assert.equal(platformRuleSchema.parse({ rehook: true }).rehook, true);
  });

  test("leaves rehook undefined when absent (the default-of-true is applied by appliesRehook, not the schema)", () => {
    assert.equal(platformRuleSchema.parse({}).rehook, undefined);
  });

  test("rejects a non-boolean rehook instead of silently passing it through (a string 'false' is truthy against appliesRehook's !== false check, so a typo would leave the pass ON)", () => {
    assert.throws(() => platformRuleSchema.parse({ rehook: "false" }));
    assert.throws(() => platformRuleSchema.parse({ rehook: 0 }));
    assert.throws(() => platformRuleSchema.parse({ rehook: "no" }));
  });
});
