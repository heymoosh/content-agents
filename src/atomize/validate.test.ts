import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { checkDerivative, type PlatformRule } from "./validate.js";

const PLATFORMS: Record<string, PlatformRule> = {
  x: { max_chars: 280 },
  linkedin: { max_chars: 3000 },
  "video-script": { max_words: 220 },
};

describe("checkDerivative: spin default-on angle consistency", () => {
  test("verbatim derivative (no spin) still requires source_lines", () => {
    const violations = checkDerivative("x-1.md", { platform: "x" }, "some text", PLATFORMS);
    assert.ok(violations.some((v) => v.includes("missing source_lines")));
  });

  test("spin:true with matching angle passes clean", () => {
    const violations = checkDerivative(
      "x-1.md",
      { platform: "x", spin: true, angle: "x", source_lines: [12] },
      "some text",
      PLATFORMS
    );
    assert.deepEqual(violations, []);
  });

  test("spin:true relaxes source_lines to best-effort (omitted entirely is fine)", () => {
    const violations = checkDerivative(
      "x-1.md",
      { platform: "x", spin: true, angle: "x" },
      "some text",
      PLATFORMS
    );
    assert.deepEqual(violations, []);
  });

  test("spin:true without an angle field is flagged", () => {
    const violations = checkDerivative("x-1.md", { platform: "x", spin: true }, "some text", PLATFORMS);
    assert.ok(violations.some((v) => v.includes("missing angle frontmatter")));
  });

  test("spin:true with a mismatched angle (e.g. linkedin angle on an x post) is flagged", () => {
    const violations = checkDerivative(
      "x-1.md",
      { platform: "x", spin: true, angle: "linkedin", source_lines: [12] },
      "some text",
      PLATFORMS
    );
    assert.ok(violations.some((v) => v.includes('does not match a configured spin angle')));
  });

  test("video-script stays exempt from source_lines regardless of spin", () => {
    const violations = checkDerivative(
      "script.md",
      { platform: "video-script" },
      "a short script",
      PLATFORMS
    );
    assert.deepEqual(violations, []);
  });
});
