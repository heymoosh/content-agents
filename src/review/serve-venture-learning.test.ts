import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { test } from "node:test";
import { appendCanonEvent } from "../venture/canon.js";
import { readCanonEvents } from "../venture/canon.js";
import { readArtifacts } from "../venture/artifacts.js";
import { computeState } from "../venture/state.js";
import { loadRules } from "../venture/rules.js";
import { clearTempVentureRoot, useTempVentureRoot } from "../venture/test-venture-root.js";
import { handleVentureLearningRoute } from "./serve-venture-learning.js";
import type { VentureLearningReceipt } from "./venture-learning-evaluator.js";
import type { LearningEvaluationInput } from "../venture/learning-evaluation.js";

function harness(method: string, path: string, body: Record<string, unknown> = {}) {
  let response: { code: number; value: any } | undefined;
  return { req: { method } as any, res: {} as any, url: new URL(`http://localhost${path}`), readBody: async () => body, json: (_res: unknown, code: number, value: unknown) => { response = { code, value }; }, response: () => response };
}
const receipt: VentureLearningReceipt = { id: "response:r1", venture: "learning-route", phase: 1, evidenceTier: "survey", claimCeiling: "stated-need", factualSummary: "A reader asked for a checklist.", evidenceRefs: ["response:r1"], sourceRefs: ["response-source:survey"], scope: "one response", sample: { treatment: 1, control: 0 }, caveats: ["One response is not demand."] };

test("evaluation is stored pending and its later acceptance is the only source of a downstream proposal", async () => {
  useTempVentureRoot();
  try {
    mkdirSync("/tmp", { recursive: true });
    appendCanonEvent("learning-route", "kickoff", "learning-route/kickoff", { rules_version: loadRules().rules_version }, "2026-09-01T12:00:00.000Z");
    let saved: any;
    const evaluate = harness("POST", "/api/venture/learning-route/learning/response/r1/evaluate", { engine: "grok" });
    await handleVentureLearningRoute({ ...evaluate, receiptFor: () => receipt, contextFor: () => ({ namedHypotheses: [], refs: [{ id: "artifact:offer", kind: "offer", summary: "Current offer" }] }), evaluateLearning: async () => ({ recommendation: "change", target: "offer", rationale: "Clarify the offer around the stated checklist need.", proposedChange: "Make the checklist the concrete entry offer.", affectedRefs: ["artifact:offer"], evidenceRefs: ["response:r1"], caveats: ["Do not call this demand."], confidence: "medium", provenance: { engine: "grok", route: "subscription-cli" } }), recordEvaluation: (input: LearningEvaluationInput) => saved = { ...input, status: "pending", decidedBy: null, downstreamProposal: null } as any } as any);
    assert.equal(evaluate.response()?.code, 200);
    assert.equal(saved.recommendation, "change");
    assert.equal(saved.claimCeiling, "stated-need");
    assert.equal(saved.status, "pending");
    assert.equal(saved.downstreamProposal, null);
  } finally { clearTempVentureRoot(); }
});

test("ordinary account-level engagement and comments are listed and evaluated without an experiment", async () => {
  useTempVentureRoot();
  try {
    appendCanonEvent("learning-route", "kickoff", "learning-route/kickoff", { rules_version: loadRules().rules_version }, "2026-09-01T12:00:00.000Z");
    const engagement: VentureLearningReceipt = { ...receipt, id: "research:metric-1", evidenceTier: "engagement", claimCeiling: "attention", factualSummary: "Substack likes: 14", evidenceRefs: ["research-observation:metric-1"], sourceRefs: ["content:post-1"] };
    const list = harness("GET", "/api/venture/learning-route/learning-sources");
    await handleVentureLearningRoute({ ...list, listSources: () => [engagement] } as any);
    assert.equal(list.response()?.code, 200);
    assert.equal(list.response()?.value.sources[0].claimCeiling, "attention");

    let seenSource = "";
    const evaluate = harness("POST", "/api/venture/learning-route/learning/research-observation/metric-1/evaluate");
    await handleVentureLearningRoute({ ...evaluate,
      receiptFor: (_slug: string, source: string) => { seenSource = source; return engagement; },
      contextFor: () => ({ namedHypotheses: [], refs: [] }),
      evaluateLearning: async () => ({ recommendation: "no-change", target: "none", rationale: "Attention moved, but the evidence supports no stronger conclusion.", proposedChange: "Keep the current Venture direction while collecting stronger evidence.", affectedRefs: [], evidenceRefs: ["research-observation:metric-1"], caveats: ["Attention is not demand."], confidence: "low", provenance: { engine: "codex", route: "subscription-cli" } }),
      recordEvaluation: (input: LearningEvaluationInput) => ({ ...input, status: "pending" }) as any,
    } as any);
    assert.equal(evaluate.response()?.code, 200);
    assert.equal(seenSource, "research-observation");
    assert.equal(evaluate.response()?.value.evaluation.evidenceTier, "engagement");
  } finally { clearTempVentureRoot(); }
});

test("an accepted test proposal is recorded in the normal Experiment queue", async () => {
  useTempVentureRoot();
  try {
    appendCanonEvent("learning-route", "kickoff", "learning-route/kickoff", { rules_version: loadRules().rules_version }, "2026-09-01T12:00:00.000Z");
    const route = harness("POST", "/api/venture/learning-route/learning-evaluations/eval-1/experiment/propose", { contentRequestId: "venture-content", evidenceFamily: "conversation", minimumSample: 2, minimumDays: 2, availablePublishingUnits: 2, availableDays: 2 });
    let recorded = false;
    await handleVentureLearningRoute({ ...route, proposeExperiment: async () => ({ status: "recommended", envelope: { plan: { recommendation: { id: "experiment-1" } } } as any }), recordExperiment: () => { recorded = true; return {} as any; } } as any);
    assert.equal(route.response()?.code, 200);
    assert.equal(route.response()?.value.result.experimentId, "experiment-1");
    assert.equal(recorded, true);
  } finally { clearTempVentureRoot(); }
});

test("accepting a learning recommendation creates only its proposal and never mutates Venture authority", async () => {
  useTempVentureRoot();
  try {
    appendCanonEvent("learning-route", "kickoff", "learning-route/kickoff", { rules_version: loadRules().rules_version }, "2026-09-01T12:00:00.000Z");
    const stateBefore = computeState("learning-route");
    const evaluate = harness("POST", "/api/venture/learning-route/learning/response/r1/evaluate", { engine: "codex" });
    await handleVentureLearningRoute({ ...evaluate, receiptFor: () => receipt, contextFor: () => ({ namedHypotheses: [], refs: [{ id: "artifact:offer", kind: "offer", summary: "Current offer" }] }), evaluateLearning: async () => ({ recommendation: "change", target: "offer", rationale: "A stated need may justify clarifying the offer.", proposedChange: "Propose a checklist-shaped offer for review.", affectedRefs: ["artifact:offer"], evidenceRefs: ["response:r1"], caveats: ["Not observed demand."], confidence: "medium", provenance: { engine: "codex", route: "subscription-cli" } }) } as any);
    const id = evaluate.response()?.value.evaluation.evaluationId;
    const decide = harness("POST", `/api/venture/learning-route/learning-evaluations/${id}/decision`, { decision: "accept", rationale: "Retain this as a proposal, not an automatic change." });
    await handleVentureLearningRoute(decide as any);
    assert.equal(decide.response()?.value.evaluation.status, "accepted");
    assert.equal(decide.response()?.value.evaluation.downstreamProposal.target, "offer");
    assert.deepEqual(computeState("learning-route"), stateBefore);
    assert.deepEqual(readArtifacts("learning-route"), []);
    assert.deepEqual(readCanonEvents("learning-route").map((event) => event.type), ["kickoff"]);
  } finally { clearTempVentureRoot(); }
});
