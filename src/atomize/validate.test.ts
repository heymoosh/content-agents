import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  checkDerivative,
  parseRoutingDecisions,
  routingKeyFor,
  checkRoutingGate,
  checkSkeletonGate,
  type PlatformRule,
} from "./validate.js";

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

  test("a truthy non-boolean spin (e.g. the string \"yes\") gets no exemption: source_lines still required", () => {
    const violations = checkDerivative("x-1.md", { platform: "x", spin: "yes" }, "some text", PLATFORMS);
    assert.ok(violations.some((v) => v.includes("missing source_lines")));
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

describe("platform-fit hard gate: derivatives vs routing.md", () => {
  const ROUTING_MD = [
    "# Routing — civic-tech + human-ai — 2026-07-04",
    "",
    "| platform | decision | fit | confidence | why |",
    "|---|---|---|---|---|",
    "| x | include | — | cold-start | both pillars cold-start |",
    "| linkedin | skip | — | rule | civic-tech: cold-start; human-ai: hard veto: brief says never route here |",
    "| bluesky | include | 1.20 | data | human-ai: 1.20x platform norm (n=5) — receptive to this topic |",
    "| community:democratic-resilience | include | — | rule | editorial rule: always route here |",
    "| quote-card | include | — | always | format asset — always generated |",
  ].join("\n");

  test("parseRoutingDecisions reads platform -> decision even when the rationale column has embedded pipes", () => {
    const decisions = parseRoutingDecisions(ROUTING_MD);
    assert.equal(decisions.get("x"), "include");
    assert.equal(decisions.get("linkedin"), "skip");
    assert.equal(decisions.get("bluesky"), "include");
    assert.equal(decisions.get("community:democratic-resilience"), "include");
  });

  test("routingKeyFor maps a generic community derivative to its routing.md room key", () => {
    assert.equal(routingKeyFor("community-democratic-resilience.md", "community"), "community:democratic-resilience");
    assert.equal(routingKeyFor("x-1.md", "x"), "x");
  });

  test("checkRoutingGate flags a derivative drafted for a platform routing.md marked skip", () => {
    const decisions = parseRoutingDecisions(ROUTING_MD);
    const violations = checkRoutingGate(
      [
        { file: "linkedin-1.md", platform: "linkedin" },
        { file: "x-1.md", platform: "x" },
        { file: "community-democratic-resilience.md", platform: "community" },
      ],
      decisions
    );
    assert.equal(violations.length, 1);
    assert.match(violations[0], /linkedin-1\.md/);
    assert.match(violations[0], /marked it skip/);
  });

  test("checkRoutingGate does not flag format assets absent from routing.md's core platforms", () => {
    const decisions = parseRoutingDecisions(ROUTING_MD);
    const violations = checkRoutingGate([{ file: "video-script.md", platform: "video-script" }], decisions);
    assert.deepEqual(violations, []);
  });
});

describe("checkSkeletonGate: reflective/fiction-promo sources never carry the case-skeleton beat treatment (card b288d0da)", () => {
  test("frame-native: skeleton allowed, spin:true angle:linkedin passes clean", () => {
    const violations = checkSkeletonGate(
      [{ file: "linkedin-1.md", platform: "linkedin", spin: true, angle: "linkedin" }],
      "frame-native"
    );
    assert.deepEqual(violations, []);
  });

  test("reflective: spin:true angle:linkedin on a case-skeleton platform is a hard violation", () => {
    const violations = checkSkeletonGate(
      [{ file: "linkedin-1.md", platform: "linkedin", spin: true, angle: "linkedin" }],
      "reflective"
    );
    assert.equal(violations.length, 1);
    assert.match(violations[0], /linkedin-1\.md/);
    assert.match(violations[0], /case-skeleton/);
  });

  test("reflective: spin:true angle:x on x is also flagged", () => {
    const violations = checkSkeletonGate([{ file: "x-1.md", platform: "x", spin: true, angle: "x" }], "reflective");
    assert.equal(violations.length, 1);
    assert.match(violations[0], /x-1\.md/);
  });

  test("fiction-promo: spin:true angle:x on x is flagged even though the platform subset is unrestricted", () => {
    const violations = checkSkeletonGate([{ file: "x-1.md", platform: "x", spin: true, angle: "x" }], "fiction-promo");
    assert.equal(violations.length, 1);
  });

  test("fiction-promo: bluesky is not a case-skeleton platform, so spin:true there is never flagged", () => {
    const violations = checkSkeletonGate(
      [{ file: "bluesky-1.md", platform: "bluesky", spin: true, angle: "bluesky" }],
      "fiction-promo"
    );
    assert.deepEqual(violations, []);
  });

  test("reflective: a verbatim (non-spun) linkedin derivative is not flagged by this gate (no skeleton applied)", () => {
    const violations = checkSkeletonGate([{ file: "linkedin-1.md", platform: "linkedin" }], "reflective");
    assert.deepEqual(violations, []);
  });

  test("reflective: spin:true but a mismatched angle (not this platform's own) is not this gate's concern", () => {
    // A stray/mismatched angle is checkDerivative's job (angle-consistency check); this gate only
    // fires when spin:true legitimately declares THIS platform's own case-skeleton angle.
    const violations = checkSkeletonGate(
      [{ file: "linkedin-1.md", platform: "linkedin", spin: true, angle: "x" }],
      "reflective"
    );
    assert.deepEqual(violations, []);
  });
});
