import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mergeDecisions, type Decision } from "./route.js";

function d(overrides: Partial<Decision>): Decision {
  return { platform: "x", decision: "include", score: null, confidence: "cold-start", rationale: "", ...overrides };
}

describe("mergeDecisions: platform-fit gate across multiple pillars", () => {
  test("includes a platform if either pillar includes it", () => {
    const perPillar = new Map([
      ["civic-tech", [d({ platform: "bluesky", decision: "include", confidence: "cold-start" })]],
      ["human-ai", [d({ platform: "bluesky", decision: "skip", confidence: "cold-start" })]],
    ]);
    const merged = mergeDecisions(["civic-tech", "human-ai"], perPillar);
    const bluesky = merged.find((m) => m.platform === "bluesky")!;
    assert.equal(bluesky.decision, "include");
    assert.deepEqual(bluesky.pillars, ["civic-tech"]);
  });

  test("a `never` rule from one pillar hard-vetoes the platform even if another pillar includes it", () => {
    const perPillar = new Map([
      ["civic-tech", [d({ platform: "x", decision: "skip", confidence: "rule", rationale: "editorial rule: never route here" })]],
      ["human-ai", [d({ platform: "x", decision: "include", confidence: "cold-start" })]],
    ]);
    const merged = mergeDecisions(["civic-tech", "human-ai"], perPillar);
    const x = merged.find((m) => m.platform === "x")!;
    assert.equal(x.decision, "skip");
    assert.equal(x.confidence, "rule");
    assert.match(x.rationale, /hard veto/);
  });

  test("skips a platform no pillar includes", () => {
    const perPillar = new Map([
      ["civic-tech", [d({ platform: "linkedin", decision: "skip", confidence: "cold-start" })]],
      ["human-ai", [d({ platform: "linkedin", decision: "skip", confidence: "cold-start" })]],
    ]);
    const merged = mergeDecisions(["civic-tech", "human-ai"], perPillar);
    const li = merged.find((m) => m.platform === "linkedin")!;
    assert.equal(li.decision, "skip");
    assert.deepEqual(li.pillars, []);
  });

  test("a platform only one pillar considered still resolves correctly", () => {
    const perPillar = new Map([
      ["civic-tech", [d({ platform: "community:democratic-resilience", decision: "include", confidence: "rule" })]],
      ["human-ai", []],
    ]);
    const merged = mergeDecisions(["civic-tech", "human-ai"], perPillar);
    const community = merged.find((m) => m.platform === "community:democratic-resilience")!;
    assert.equal(community.decision, "include");
  });
});
