import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { loadSpinAngles, resolveAngle, isSpinDefault } from "./spin.js";

describe("config/platforms.yaml spin_angles: the four Muxin-approved angles (2026-06-30)", () => {
  const angles = loadSpinAngles();

  test("carries all four channel entries", () => {
    assert.deepEqual(Object.keys(angles).sort(), ["bluesky", "linkedin", "substack", "x"]);
  });

  test("x: non-engineer outside the SV tech bubble, tech audience", () => {
    assert.equal(angles.x.audience, "tech");
    assert.match(angles.x.angle, /non-engineer OUTSIDE the SV tech bubble/);
    assert.match(angles.x.angle, /96% of non-tech workers/);
  });

  test("linkedin: business innovation broadly, not just product craft", () => {
    assert.equal(angles.linkedin.audience, "business/career");
    assert.match(angles.linkedin.angle, /NOT just product craft/);
    assert.match(angles.linkedin.angle, /corporate \/ business norms quietly strangle/);
  });

  test("substack: builder-philosopher, society", () => {
    assert.equal(angles.substack.audience, "society");
    assert.match(angles.substack.angle, /Builder-philosopher/);
    assert.match(angles.substack.angle, /unexamined human systems/);
  });

  test("bluesky: democracy as broken UX, political", () => {
    assert.equal(angles.bluesky.audience, "political");
    assert.match(angles.bluesky.angle, /democracy as broken UX/);
    assert.match(angles.bluesky.angle, /fairness gap unignorable/);
  });
});

describe("resolveAngle: channel -> audience -> angle lookup", () => {
  test("returns the configured angle for a known platform", () => {
    const angle = resolveAngle("x");
    assert.ok(angle);
    assert.equal(angle?.audience, "tech");
  });

  test("returns undefined for a platform with no configured angle (e.g. quote-card, community)", () => {
    assert.equal(resolveAngle("quote-card"), undefined);
    assert.equal(resolveAngle("community"), undefined);
  });
});

describe("isSpinDefault: spin is the always-on default, --no-spin is the only opt-out", () => {
  test("no flag -> spin is on by default", () => {
    assert.equal(isSpinDefault(false), true);
  });

  test("--no-spin -> spin is off", () => {
    assert.equal(isSpinDefault(true), false);
  });
});
