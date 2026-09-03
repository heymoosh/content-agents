import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildVentureLearningEvaluationPrompt,
  parseVentureLearningEvaluation,
  type VentureLearningReceipt,
  type VentureLearningContext,
} from "./venture-learning-evaluator.js";

const receipt: VentureLearningReceipt = {
  id: "receipt-1", venture: "quiet-ops", phase: 2, evidenceTier: "funnel",
  claimCeiling: "behavioral-intent", factualSummary: "Three intended readers asked for the checklist.",
  evidenceRefs: ["response:1", "response:2"], sourceRefs: ["survey:2026-08"],
  scope: "early respondents to one lead magnet", sample: { treatment: 12, control: 10 }, caveats: ["small convenience sample"],
};
const context: VentureLearningContext = {
  namedHypotheses: [{ id: "hypothesis:1", summary: "A checklist may help operators" }],
  refs: [
    { id: "decision:leadgen", kind: "lead-generation", summary: "Lead magnet is still being tested" },
    { id: "artifact:offer", kind: "offer", summary: "No offer selected" },
  ],
};
const output = (patch: Record<string, unknown>) => JSON.stringify({
  recommendation: "change", target: "lead-generation", rationale: "Refine the lead magnet invitation.",
  proposedChange: "Make the invitation specific to the checklist.", affectedRefs: ["decision:leadgen"],
  evidenceRefs: ["response:1"], caveats: ["Small sample."], confidence: "medium", ...patch,
});

test("prompt is a subscription-CLI, one-recommendation, claim-bounded contract", () => {
  const prompt = buildVentureLearningEvaluationPrompt(receipt, context);
  assert.match(prompt, /exactly one typed recommendation/i);
  assert.match(prompt, /no-change\|change\|test/);
  assert.match(prompt, /attention.*resonance.*stated need.*intent.*observed demand/i);
  assert.match(prompt, /claim ceiling: behavioral-intent/i);
  assert.match(prompt, /never auto-apply|never.*select a winner/i);
  assert.match(prompt, /subscription CLI/i);
});

test("parser rejects forged evidence refs and Venture refs", () => {
  assert.throws(() => parseVentureLearningEvaluation(output({ evidenceRefs: ["forged:9"] }), receipt, context), /evidence.*supplied/i);
  assert.throws(() => parseVentureLearningEvaluation(output({ affectedRefs: ["artifact:not-context"] }), receipt, context), /affected.*context/i);
});

test("parser enforces the claim ceiling and typed target pairings", () => {
  assert.throws(() => parseVentureLearningEvaluation(output({ rationale: "This proves observed demand and customers will buy." }), receipt, context), /claim ceiling|overclaim/i);
  assert.throws(() => parseVentureLearningEvaluation(output({ recommendation: "no-change", target: "lead-generation" }), receipt, context), /target.*none|pairing/i);
  assert.throws(() => parseVentureLearningEvaluation(output({ recommendation: "test", target: "offer" }), receipt, context), /target.*experiment|pairing/i);
});

test("a caveat that explicitly refuses a stronger claim is not misread as making that claim", () => {
  const weak = { ...receipt, evidenceTier: "qualitative" as const, claimCeiling: "resonance" as const };
  const result = parseVentureLearningEvaluation(output({ rationale: "The reply shows resonance.", proposedChange: "Test a clearer version.", caveats: ["This is not observed demand and does not prove purchase intent."] }), weak, context);
  assert.equal(result.recommendation, "change");
});

test("parser recognizes every canonical claim ceiling in ascending order", () => {
  const pairs = [["engagement", "attention"], ["qualitative", "resonance"], ["survey", "stated-need"], ["directional", "directional-comparison"], ["controlled", "bounded-comparison"], ["funnel", "behavioral-intent"], ["business", "observed-demand"]] as const;
  for (const [evidenceTier, claimCeiling] of pairs) {
    const r = parseVentureLearningEvaluation(output({ rationale: "A bounded next step is appropriate." }), { ...receipt, evidenceTier, claimCeiling }, context);
    assert.equal(r.recommendation, "change");
  }
  assert.throws(() => parseVentureLearningEvaluation(output({ rationale: "The directional comparison proves observed demand." }), { ...receipt, evidenceTier: "directional", claimCeiling: "directional-comparison" }, context), /overclaims/i);
  assert.throws(() => parseVentureLearningEvaluation(output({}), { ...receipt, evidenceTier: "controlled", claimCeiling: "behavioral-intent" }, context), /exceeds.*evidence tier/i);
});

test("parser requires unique evidence refs and affected refs for changes/tests", () => {
  assert.throws(() => parseVentureLearningEvaluation(output({ evidenceRefs: ["response:1", "response:1"] }), receipt, context), /duplicate|unique/i);
  assert.throws(() => parseVentureLearningEvaluation(output({ affectedRefs: [] }), receipt, context), /affectedRefs.*at least one/i);
  assert.throws(() => parseVentureLearningEvaluation(output({ recommendation: "test", target: "experiment", affectedRefs: [] }), receipt, context), /affectedRefs.*at least one/i);
  const noChange = parseVentureLearningEvaluation(output({ recommendation: "no-change", target: "none", affectedRefs: [] }), receipt, context);
  assert.deepEqual(noChange.affectedRefs, []);
});

test("parser rejects unknown fields and markdown/body output", () => {
  assert.throws(() => parseVentureLearningEvaluation(output({ extra: "forged" }), receipt, context), /unknown field/i);
  assert.throws(() => parseVentureLearningEvaluation(output({ rationale: "# Heading\n**body**" }), receipt, context), /markdown|body/i);
});

test("parser accepts no-change, change, and test with engine provenance", () => {
  for (const [recommendation, target] of [["no-change", "none"], ["change", "hypothesis"], ["test", "experiment"]] as const) {
    const result = parseVentureLearningEvaluation(output({ recommendation, target, affectedRefs: target === "hypothesis" ? ["hypothesis:1"] : target === "none" ? [] : ["decision:leadgen"] }), receipt, context, "claude-cli");
    assert.equal(result.recommendation, recommendation);
    assert.equal(result.target, target);
    assert.equal(result.provenance.engine, "claude-cli");
    assert.equal(result.provenance.route, "subscription-cli");
  }
});
