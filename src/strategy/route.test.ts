import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { decideForPillar, mergeDecisions, type Decision, type LoadedData, type RoutingConfig } from "./route.js";

function d(overrides: Partial<Decision>): Decision {
  return { platform: "x", decision: "include", score: null, confidence: "cold-start", rationale: "", ...overrides };
}

function cfg(overrides: Partial<RoutingConfig> = {}): RoutingConfig {
  return {
    defaults: {},
    rules: {},
    thresholds: { min_posts_for_data: 3, skip_below_score: 0.4, always_consider: [] },
    ...overrides,
  };
}

describe("decideForPillar: decision is ALWAYS defaults-driven, score never overrides it (card 7e550e48)", () => {
  test("a defaults-listed platform with sufficient data but a LOW score still includes (old score-driven logic would have skipped it)", () => {
    const c = cfg({ defaults: { "human-ai": ["x"] } });
    const data: LoadedData = {
      cells: new Map([["x|human-ai", { n: 5, avg_eng: 1 }]]), // well below baseline
      weeks: new Map([["x", 5]]),
      baselines: new Map([["x", 10]]),
    };
    const decisions = decideForPillar("human-ai", c, data);
    const x = decisions.find((x) => x.platform === "x")!;
    assert.equal(x.decision, "include", "in defaults -> include regardless of score");
    assert.equal(x.confidence, "data", "confidence still reflects that data was sufficient");
    assert.ok(x.score !== null && x.score < c.thresholds.skip_below_score, "score is computed and attached, and is indeed below skip_below_score");
  });

  test("a NON-defaults platform with sufficient data and a HIGH score still skips (old score-driven logic would have included it)", () => {
    const c = cfg({ defaults: { "human-ai": ["x"] } }); // linkedin not in defaults for this pillar
    const data: LoadedData = {
      cells: new Map([["linkedin|human-ai", { n: 5, avg_eng: 20 }]]), // well above baseline
      weeks: new Map([["linkedin", 5]]),
      baselines: new Map([["linkedin", 10]]),
    };
    const decisions = decideForPillar("human-ai", c, data);
    const li = decisions.find((x) => x.platform === "linkedin")!;
    assert.equal(li.decision, "skip", "not in defaults -> skip regardless of score");
    assert.equal(li.confidence, "data");
    assert.ok(li.score !== null && li.score >= c.thresholds.skip_below_score, "score is computed and attached, and is indeed at/above skip_below_score");
  });

  test("insufficient data (cold-start) still falls back to defaults, unchanged from before", () => {
    const c = cfg({ defaults: { "human-ai": ["x"] } });
    const data: LoadedData = { cells: new Map(), weeks: new Map(), baselines: new Map() };
    const decisions = decideForPillar("human-ai", c, data);
    assert.equal(decisions.find((x) => x.platform === "x")!.decision, "include");
    assert.equal(decisions.find((x) => x.platform === "linkedin")!.decision, "skip");
    assert.equal(decisions.find((x) => x.platform === "x")!.confidence, "cold-start");
  });

  test("`never`/`always` editorial rules still override the defaults-driven decision, unaffected by this change", () => {
    const c = cfg({ defaults: { "human-ai": ["x"] }, rules: { "human-ai": { always: ["linkedin"], never: ["x"] } } });
    const data: LoadedData = { cells: new Map(), weeks: new Map(), baselines: new Map() };
    const decisions = decideForPillar("human-ai", c, data);
    const x = decisions.find((d) => d.platform === "x")!;
    const li = decisions.find((d) => d.platform === "linkedin")!;
    assert.equal(x.decision, "skip");
    assert.equal(x.confidence, "rule");
    assert.equal(li.decision, "include");
    assert.equal(li.confidence, "rule");
  });
});

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
