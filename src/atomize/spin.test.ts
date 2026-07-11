import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { loadSpinAngles, resolveAngle, isSpinDefault, appliesRehook } from "./spin.js";

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

  test("linkedin: case-first beat template, zoom-out beat placed last, business/career audience", () => {
    assert.equal(angles.linkedin.audience, "business/career");
    assert.match(angles.linkedin.angle, /Case-first beat template/);
    assert.match(angles.linkedin.angle, /Beat 4 — Zoom-out/);
    assert.match(angles.linkedin.angle, /QUOTED as a belief statement/);
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

describe("appliesRehook: storytelling re-hook/re-order latitude (Muxin, 2026-07-04), scoped to X/LinkedIn only", () => {
  test("x and linkedin get the re-hook/re-order pass", () => {
    assert.equal(appliesRehook("x", undefined), true);
    assert.equal(appliesRehook("linkedin", undefined), true);
  });

  test("bluesky never gets it, even from a normal essay source", () => {
    assert.equal(appliesRehook("bluesky", undefined), false);
  });

  test("a Notes-sourced derivative stays near-verbatim on every platform, including x/linkedin", () => {
    assert.equal(appliesRehook("x", "substack-note"), false);
    assert.equal(appliesRehook("linkedin", "substack-note"), false);
    assert.equal(appliesRehook("bluesky", "substack-note"), false);
  });

  test("other platforms (community, quote-card) never get it", () => {
    assert.equal(appliesRehook("community", undefined), false);
    assert.equal(appliesRehook("quote-card", undefined), false);
  });
});
