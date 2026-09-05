import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRecordedRouting } from "./recorded-routing.js";
import { applyExplorationOverride, decideForPillar, loadConfig, mergeDecisions, routingMd } from "./route.js";

test("multi-pillar routing writer roundtrips one merged decision per platform", () => {
  const pillars = ["civic-tech", "career-work", "human-ai"];
  const config = loadConfig();
  const data = { cells: new Map(), weeks: new Map(), baselines: new Map() };
  const perPillar = new Map(pillars.map((pillar) => [pillar, decideForPillar(pillar, config, data)]));
  assert.ok(perPillar.get("career-work")!.some((decision) => decision.platform === "bluesky" && decision.decision === "skip"));
  assert.ok(perPillar.get("human-ai")!.some((decision) => decision.platform === "bluesky" && decision.decision === "include"));
  const merged = mergeDecisions(pillars, perPillar);
  const md = routingMd(pillars, merged);
  assert.equal(md.split("\n").filter((line) => line.startsWith("| platform | decision |")).length, 1);
  assert.equal(merged.length, new Set(merged.map((decision) => decision.platform)).size);
  assert.deepEqual([...parseRecordedRouting(md)], merged.map((decision) => [decision.platform, { decision: decision.decision, confidence: decision.confidence }]));
  assert.deepEqual(parseRecordedRouting(md).get("bluesky"), { decision: "include", confidence: "cold-start" });
});

test("recorded routing preserves real router decisions and exploration with pipe-bearing rationales", () => {
  const base = decideForPillar("career-work", loadConfig(), { cells: new Map(), weeks: new Map(), baselines: new Map() })
    .map((decision) => ({ ...decision, pillars: ["career-work"], rationale: `${decision.rationale} | retained detail` }));
  const decisions = applyExplorationOverride(base, "career-work", "bluesky");
  const parsed = parseRecordedRouting(routingMd(["career-work"], decisions));
  for (const decision of decisions) assert.deepEqual(parsed.get(decision.platform), { decision: decision.decision, confidence: decision.confidence });
});

test("recorded routing accepts legacy two-column decisions without guessing probe confidence", () => {
  const parsed = parseRecordedRouting("# Routing\n\n| platform | decision |\n|:---|---:|\n| x | include |\n| community:example | skip |\n");
  assert.deepEqual([...parsed], [["x", { decision: "include" }], ["community:example", { decision: "skip" }]]);
  assert.equal(parsed.get("unrecorded"), undefined);
});

test("recorded routing rejects ambiguous or malformed existing metadata", () => {
  for (const raw of ["", "# Routing only", "| platform | decision |\n|---|---|", "| x | skpi |", "| | skip |", "| x | include | - | exploraton |", "| x | skip |\n| x | include |", "| x | skip |\n| x | skip |"] ) {
    assert.throws(() => parseRecordedRouting(raw), /routing/);
  }
});
