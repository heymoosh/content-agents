import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildSignalsExperimentSciencePrompt, parseSignalsExperimentScienceResult, type SignalsExperimentScienceInput } from "./signals-experiment-recommendation.js";

const input = (): SignalsExperimentScienceInput => ({
  recommendationId: "signals-rec-1", createdAt: "2026-08-31T13:45:00Z",
  inputContext: { sourceKind: "long-form", cutId: "cut-1", cutRationale: "The cut contains a genuine former belief and correction.", sourceRefs: ["source-1#L1-L4"] },
  evidence: [
    { id: "evidence-1", family: "conversation", kind: "hypothesis", summary: "A reviewed hook mechanism may improve qualified replies.", sampleSize: 12, window: "2026-08", caveats: ["Not a winner."] },
    { id: "baseline-1", family: "audience", kind: "observation", summary: "Essay visits provide a guardrail baseline.", sampleSize: 30, window: "2026-07/08", caveats: ["Attribution is incomplete."] },
  ],
  candidates: [
    { id: "variant-a", platform: "linkedin", format: "post", treatment: "belief-shift", variables: { hook: "belief-shift" } },
    { id: "variant-b", platform: "linkedin", format: "post", treatment: "direct", variables: { hook: "direct" } },
  ],
  availableOutcomeFamilies: ["conversation", "audience"], minimumSample: 20, minimumDays: 14,
});

const recommended = JSON.stringify({
  status: "recommended", evidenceRefs: ["evidence-1", "baseline-1"], observation: "A reviewed mechanism remains untested for this audience.", interpretation: "The belief shift may create a clearer entry point.",
  hypothesis: "The belief-shift opening will increase substantive replies per 1,000 impressions relative to the direct opening without reducing essay visits beyond the guardrail.",
  expectedOutcome: { variantId: "variant-a", comparisonRef: "variant-b", family: "conversation", metric: "substantive-replies-per-1000", direction: "increase" },
  whyThisInput: "The input contains a genuine change of mind.", controlledVariable: "opening structure", constants: ["platform", "source", "CTA"],
  primaryMetric: { family: "conversation", metric: "substantive-replies-per-1000" }, guardrails: [{ family: "audience", metric: "essay-visits-per-1000", rule: "Must not fall more than 10%." }],
  decisionRule: { keep: "Keep if replies improve and the guardrail holds.", revise: "Revise if direction is positive but uncertain.", reject: "Reject if replies do not improve or the guardrail fails." },
  confidence: "low", caveats: ["The evidence is hypothesis-level."], capacityRationale: "Use one matched pair without displacing normal publishing.",
});

describe("Signals science agent experiment recommendation", () => {
  test("builds a body-free prompt that preserves outcome and Venture boundaries", () => {
    const built = buildSignalsExperimentSciencePrompt(input());
    assert.match(built.prompt, /directional and falsifiable/i);
    assert.match(built.prompt, /Prefer high-confidence recommendations/i);
    assert.match(built.prompt, /low-confidence recommendation will be deferred before content generation/i);
    assert.match(built.prompt, /genuine former belief and correction/i);
    assert.match(built.prompt, /Never read or infer Venture survey/i);
    assert.match(built.prompt, /attention, conversation, audience, and business outcomes separate/i);
    assert.doesNotMatch(built.prompt, /candidate body/i);
    assert.match(built.evidenceDigest, /^sha256:/); assert.match(built.promptDigest, /^sha256:/);
  });

  test("parses a bounded recommendation with exact evidence and model provenance", () => {
    const result = parseSignalsExperimentScienceResult(recommended, input(), "codex");
    assert.equal(result.status, "recommended");
    if (result.status !== "recommended") return;
    assert.equal(result.recommendation.owner, "signals");
    assert.equal(result.recommendation.hypothesis.includes("will increase"), true);
    assert.equal(result.recommendation.provenance.mechanism, "signals-science-agent-v1");
    assert.match(result.recommendation.provenance.responseDigest, /^sha256:/);
  });

  test("allows an honest no-experiment result and rejects invented evidence or candidates", () => {
    assert.deepEqual(parseSignalsExperimentScienceResult(JSON.stringify({ status: "no-experiment", reason: "Evidence is too thin.", evidenceRefs: ["evidence-1"] }), input(), "codex").status, "no-experiment");
    assert.throws(() => parseSignalsExperimentScienceResult(recommended.replace('"evidence-1"', '"invented"'), input(), "codex"), /outside the supplied pack/i);
    assert.throws(() => parseSignalsExperimentScienceResult(recommended.replace('"variant-a"', '"invented"'), input(), "codex"), /unknown or self-referential candidate/i);
  });

  test("rejects a generic hypothesis that is not directional and falsifiable", () => {
    const generic = JSON.parse(recommended);
    generic.hypothesis = "This treatment may affect outcomes.";
    assert.throws(() => parseSignalsExperimentScienceResult(JSON.stringify(generic), input(), "codex"), /directional and falsifiable/i);
    generic.hypothesis = "This treatment will increase outcomes relative to the control.";
    assert.throws(() => parseSignalsExperimentScienceResult(JSON.stringify(generic), input(), "codex"), /directional and falsifiable/i);
  });

  test("accepts a concrete comparative hypothesis written with natural inflection", () => {
    const concrete = JSON.parse(recommended);
    concrete.hypothesis = "The belief-shift opening improves substantive replies compared with the direct opening.";
    assert.equal(parseSignalsExperimentScienceResult(JSON.stringify(concrete), input(), "codex").status, "recommended");
  });
});
