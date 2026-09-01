import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildContentRequest } from "./content-request.js";
import { handleSignalsRoute } from "./serve-signals.js";
import { recordExperimentInterpretation, reviewExperimentInterpretation, loadExperimentInterpretation } from "./signals-experiment-result-store.js";
import { markExperimentContentHandoff, recordExperimentPlan, reviewExperimentPlan } from "./signals-experiment-plan-store.js";
import { readSignals } from "./signals.js";
import { approveExperimentPlan, buildExperimentPlan } from "../grow/experiment-content-handoff.js";
import { signalsExperimentRecommendation } from "../grow/experiment-test-fixtures.js";
import { appendCanonEvent, readCanonEvents } from "../venture/canon.js";
import { readArtifacts } from "../venture/artifacts.js";
import { computeState } from "../venture/state.js";
import { loadRules } from "../venture/rules.js";
import { clearTempVentureRoot, useTempVentureRoot } from "../venture/test-venture-root.js";
import { handleVentureWrite } from "./venture-writes.js";

const SLUG = "signals-venture-lifecycle";
const EXPERIMENT = "signals-lifecycle-experiment";
const AT = "2026-08-31T18:00:00.000Z";

function harness(method: string, path: string, body: Record<string, unknown> = {}) {
  let response: { code: number; value: unknown } | undefined;
  return {
    req: { method } as any,
    url: new URL(`http://localhost${path}`),
    readBody: async () => body,
    json: (_res: unknown, code: number, value: unknown) => { response = { code, value }; },
    response: () => response,
  };
}

test("measured Signals proposal can be adopted and accepted without changing Venture or winner state", async () => {
  const root = mkdtempSync(join(tmpdir(), "signals-venture-lifecycle-"));
  const plansPath = join(root, "plans.jsonl");
  const resultsPath = join(root, "results.jsonl");
  const handoffsPath = join(root, "handoffs.jsonl");
  const briefsPath = join(root, "briefs");
  useTempVentureRoot();
  try {
    const contentInput = {
      id: "signals-lifecycle-content", origin: "human-inference" as const, descriptor: "lifecycle input",
      originalInput: "A bounded experiment input", treatments: ["summary"], media: ["none"], platforms: ["linkedin"],
      sourceProvenance: { kind: "source" as const, sourceLines: [1] },
    };
    const request = buildContentRequest(contentInput);
    const treated = request.variants.find((variant) => variant.identity.kind === "treated")!.identity.id;
    const control = request.variants.find((variant) => variant.identity.kind === "control")!.identity.id;
    const recommendation = { ...signalsExperimentRecommendation({ variantId: treated, comparisonRef: control, families: ["audience"], minimumSample: 1 }), id: EXPERIMENT, confidence: "high" as const };
    const plan = buildExperimentPlan({
      recommendation,
      contentRequest: contentInput,
      variablesByVariant: Object.fromEntries(request.variants.map((variant) => [variant.identity.id, { opening: variant.identity.kind }])),
      capacity: { availablePublishingUnits: 10, availableDays: 7 },
    });
    recordExperimentPlan(plan, plansPath);
    const approved = approveExperimentPlan(plan, { status: "approved", decidedBy: "muxin", decidedAt: AT });
    reviewExperimentPlan(plan.recommendation.id, approved, plansPath);
    markExperimentContentHandoff(plan.recommendation.id, { experimentId: EXPERIMENT, generatedIds: [treated, control], copyApproval: "pending-in-content" }, plansPath);

    const interpretation = recordExperimentInterpretation({
      experimentId: EXPERIMENT, recommendation: "keep", rationale: "Use the measured opening as the next audience input.",
      evidenceRefs: ["outcome:experiment"], confidence: "high", caveats: ["bounded"], engine: "codex",
    }, resultsPath, AT);
    reviewExperimentInterpretation(EXPERIMENT, "accepted", "I accept this measured interpretation.", resultsPath, AT);
    assert.equal(loadExperimentInterpretation(EXPERIMENT, resultsPath).winner, null);

    appendCanonEvent(SLUG, "kickoff", `${SLUG}/kickoff`, { rules_version: loadRules().rules_version }, AT);
    mkdirSync(briefsPath, { recursive: true });
    const stateBefore = computeState(SLUG);
    const signalsBefore = readSignals("human-inference", briefsPath);
    const winnerBefore = { interpretation: loadExperimentInterpretation(EXPERIMENT, resultsPath).winner, autoWinner: loadExperimentInterpretation(EXPERIMENT, resultsPath).autoWinner };

    const proposalRequest = harness("POST", `/api/signals/experiments/${EXPERIMENT}/venture-handoff/propose`, { ventureSlug: SLUG, phase: 1 });
    await handleSignalsRoute({
      ...proposalRequest, res: {} as any, experimentPlansPath: plansPath, experimentResultsPath: resultsPath,
      ventureHandoffsPath: handoffsPath, readVentureState: () => ({ current_phase: 1 }),
      readExperimentPerformance: () => ({ experiments: [{ experimentId: EXPERIMENT, analysisStatus: "ready", primaryMetric: { family: "audience", metric: "audience-rate" }, outcomeRefs: ["outcome:experiment"], primaryOutcomeRefs: { treatment: ["outcome:treatment"], control: ["outcome:control"] }, primaryComparison: { treatment: { variantId: treated, sample: 10, value: 2 }, control: { variantId: control, sample: 10, value: 1 } } }] }),
    });
    assert.equal(proposalRequest.response()?.code, 200, JSON.stringify(proposalRequest.response()?.value));
    const proposal = (proposalRequest.response()?.value as any).proposal;

    const adopt = harness("POST", `/api/signals/venture-handoff/${proposal.id}/decision`, { decision: "adopt", rationale: "Adopt this measured input for Venture review." });
    await handleSignalsRoute({ ...adopt, res: {} as any, ventureHandoffsPath: handoffsPath });
    assert.equal((adopt.response()?.value as any).proposal.status, "adopted");

    const ventureDecision = handleVentureWrite(
      "POST",
      `/api/venture/${SLUG}/signals-input/${proposal.id}/decision`,
      { outcome: "accept", reason: "Accept the adopted measured signal." },
      { signalsHandoffsPath: handoffsPath },
    );
    assert.equal(ventureDecision?.status, 200, JSON.stringify(ventureDecision));
    const accepted = (ventureDecision?.body as { acceptance: { artifact: { artifact_kind: string } | null } }).acceptance;

    assert.equal(accepted.artifact?.artifact_kind, "signals-input");
    assert.equal(readArtifacts(SLUG).length, 1);
    assert.equal(readCanonEvents(SLUG).filter((event) => event.type === "signals-input-decision").length, 1);
    assert.deepEqual(computeState(SLUG), stateBefore);
    assert.deepEqual(readSignals("human-inference", briefsPath), signalsBefore);
    assert.deepEqual({ interpretation: loadExperimentInterpretation(EXPERIMENT, resultsPath).winner, autoWinner: loadExperimentInterpretation(EXPERIMENT, resultsPath).autoWinner }, winnerBefore);
  } finally {
    clearTempVentureRoot();
    rmSync(root, { recursive: true, force: true });
  }
});
