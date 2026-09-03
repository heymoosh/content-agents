import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildContentRequest, type ContentRequestInput } from "./content-request.js";
import { signalsExperimentRecommendation } from "../grow/experiment-test-fixtures.js";
import { recordLearningEvaluation, recordLearningEvaluationDecision, type LearningEvaluationInput } from "../venture/learning-evaluation.js";
import { buildVentureExperimentPlan, type VentureExperimentHandoffInput } from "./venture-experiment-handoff.js";

function contentInput(id = "venture-experiment"): ContentRequestInput {
  return { id, origin: "venture", descriptor: "A Venture learning experiment", originalInput: "The approved Venture source remains the canonical input.", treatments: ["summary"], media: ["none"], platforms: ["linkedin"], includeUntreatedControl: true, ventureId: "named-venture", ventureSource: { artifactId: "p1-essay-01", phase: 2, artifactKind: "substack-post", messageId: "p1-essay-01", bodyPath: "phase-1-attention/p1-essay-01.md", claimRefs: [{ claim: "A source-grounded claim", ref: "intake:q7" }], approval: { editorialStatus: "approved", provenance: "muxin-editorial-approval" } }, sourceProvenance: { kind: "approved-cut", lens: "venture-learning", sourceLines: [7] } };
}

function accepted(): { evaluation: ReturnType<typeof recordLearningEvaluationDecision>; recommendation: VentureExperimentHandoffInput["recommendation"] } {
  const request = buildContentRequest(contentInput());
  const treated = request.variants.find((variant) => variant.identity.kind === "treated")!.identity.id;
  const control = request.variants.find((variant) => variant.identity.kind === "control")!.identity.id;
  const recommendation = { ...signalsExperimentRecommendation({ variantId: treated, comparisonRef: control, minimumSample: 10, evidenceRefs: ["outcome:experiment-1"] }), id: "signals:venture:evaluation-1", confidence: "high" as const };
  const root = mkdtempSync(join(tmpdir(), "venture-experiment-handoff-"));
  const path = join(root, "evaluations.jsonl");
  const input: LearningEvaluationInput = { evaluationId: "evaluation-1", ventureSlug: "named-venture", inputRef: "learning-input-1", evidenceTier: "controlled", claimCeiling: "bounded-comparison", recommendation: "test", target: "experiment", rationale: "Test the bounded learning.", proposedChange: "Run the declared experiment.", evidenceRefs: ["outcome:experiment-1", control], affectedRefs: ["learning-input-1"], caveats: ["The result is bounded to the declared audience and window."], engine: "codex" };
  const pending = recordLearningEvaluation(input, path, "2026-09-01T11:00:00.000Z");
  const evaluation = recordLearningEvaluationDecision("named-venture", pending.evaluationId, "accept", "Muxin accepts the next test.", path, "2026-09-01T12:00:00.000Z");
  return { evaluation, recommendation: { ...recommendation, evidenceRefs: ["outcome:experiment-1"] } };
}
function handoff(over: Partial<VentureExperimentHandoffInput> = {}) {
  const a = accepted(); const request = buildContentRequest(contentInput());
  return buildVentureExperimentPlan({ evaluation: a.evaluation, recommendation: a.recommendation, contentRequest: contentInput(), variablesByVariant: Object.fromEntries(request.variants.map((variant) => [variant.identity.id, { opening: variant.identity.kind }])), capacity: { availablePublishingUnits: 10, availableDays: 7 }, ...over });
}

describe("Venture to Experiment handoff", () => {
  test("wraps a normal pending ExperimentPlan with canonical Venture provenance", () => {
    const a = accepted(); const result = handoff({ evaluation: a.evaluation, recommendation: a.recommendation });
    assert.equal(result.plan.kind, "experiment_plan"); assert.equal(result.plan.recommendation.owner, "signals"); assert.equal(result.plan.generatesCopy, false); assert.equal(result.plan.contentRequest.experiment, null);
    assert.deepEqual(result.ventureContext, { ventureId: "named-venture", phase: 2, inputRef: "learning-input-1", evaluationId: "evaluation-1", evidenceTier: "controlled", claimCeiling: "bounded-comparison", evidenceRefs: a.evaluation.evidenceRefs, caveats: a.evaluation.caveats });
    assert.equal(result.planApproval, "pending-muxin"); assert.equal(result.copyApproval, "pending-in-content"); assert.match(result.digest, /^sha256:/);
  });
  test("rejects non-test, unaccepted, wrong-venture, missing proposal, drifted refs, and incomplete inputs", () => {
    const a = accepted();
    assert.throws(() => handoff({ evaluation: { ...a.evaluation, recommendation: "change", target: "hypothesis" } }), /test evaluation|accepted/i);
    assert.throws(() => handoff({ evaluation: { ...a.evaluation, status: "pending" } }), /accepted/i);
    assert.throws(() => handoff({ contentRequest: { ...contentInput(), ventureId: "other-venture" } }), /venture/i);
    assert.throws(() => handoff({ evaluation: { ...a.evaluation, downstreamProposal: null } }), /downstream/i);
    assert.throws(() => handoff({ recommendation: { ...a.recommendation, evidenceRefs: ["not-in-evaluation"] } }), /subset|evidence refs/i);
    assert.throws(() => handoff({ contentRequest: { ...contentInput(), ventureSource: null } }), /approved Venture source/i);
  });
  test("keeps four outcome families bounded and requires exact variants, one variable, and capacity", () => {
    for (const family of ["attention", "conversation", "audience", "business"] as const) {
      const a = accepted(); const recommendation = { ...a.recommendation, expectedOutcome: { ...a.recommendation.expectedOutcome, family }, primaryMetric: { family, metric: "bounded metric" } };
      assert.equal(handoff({ evaluation: a.evaluation, recommendation }).plan.recommendation.expectedOutcome.family, family);
    }
    const a = accepted(); const request = buildContentRequest(contentInput()); const vars = Object.fromEntries(request.variants.map((variant) => [variant.identity.id, { opening: variant.identity.kind }]));
    assert.throws(() => handoff({ evaluation: a.evaluation, recommendation: { ...a.recommendation, controlledVariable: "" }, variablesByVariant: vars }), /controlledVariable/i);
    assert.throws(() => handoff({ variablesByVariant: {} }), /variants|variables/i);
    assert.throws(() => handoff({ capacity: { availablePublishingUnits: 1, availableDays: 1 } }), /capacity|deferred/i);
    assert.throws(() => handoff({ contentRequest: { ...contentInput(), experiment: { id: "already", recommendationId: "already", planProposalDigest: "sha256:" + "a".repeat(64), planDecisionDigest: "sha256:" + "b".repeat(64), planApprovedAt: "2026-09-01T12:00:00.000Z", hypothesis: "x", controlledVariable: "x", variablesByVariant: {} } } }), /experiment/i);
  });
});

test.afterEach(() => { /* temp evaluation stores are intentionally isolated per test */ });
