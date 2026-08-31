import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildExperimentOutcomeLedger } from "./experiment-outcomes.js";
import { buildExperimentRecord } from "./experiment-record.js";
import { buildSignalsExperimentPerformance, buildSignalsExperimentInterpretationPrompt } from "./signals-experiment-performance.js";
import { signalsExperimentRecommendation } from "./experiment-test-fixtures.js";

function record(id: string, measured: boolean, sample: number | null, startAt: string | null = "2026-08-01T00:00:00.000Z") {
  return buildExperimentRecord({
    id, question: "Which opening earns substantive replies?", hypothesis: "Belief shift will increase replies.", unit: "published post",
    variables: [{ name: "opening", options: ["direct", "belief-shift"] }], scope: { platform: ["linkedin"], format: ["text"], topic: ["civic action"], audience: ["readers"] },
    lineage: { sourceRefs: [`source:${id}`], variantRefs: [`variant:${id}`], publishRefs: measured ? [`post:${id}`] : [], outcomeRefs: measured ? [`outcome:${id}`] : [] },
    successObservations: [measured
      ? { id: `observation:${id}`, family: "conversation", metric: "substantive-replies-per-1000", measured: true, value: 2.4, sample, observedAt: "2026-08-25T00:00:00.000Z", outcomeRefs: [`outcome:${id}`] }
      : { id: `observation:${id}`, family: "conversation", metric: "substantive-replies-per-1000", measured: false }],
    minimumSample: 10, reviewRule: "Review after 10 units and 14 days.", startAt, status: measured ? "running" : "proposed", winner: null,
  });
}

function recommendationFor(id: string) {
  const base = signalsExperimentRecommendation({ variantId: `variant:${id}`, comparisonRef: `baseline:${id}`, evidenceRefs: [`baseline:${id}`], families: ["conversation"], minimumSample: 10 });
  return {
    ...base,
    id,
    minimumDays: 14,
    expectedOutcome: { ...base.expectedOutcome, metric: "substantive-replies-per-1000" },
    primaryMetric: { family: "conversation" as const, metric: "substantive-replies-per-1000" },
  };
}

describe("Signals per-experiment performance view", () => {
  test("tracks multiple experiments independently and exposes only mature evidence for analysis", () => {
    const readyRecord = record("ready", true, 12);
    const waitingRecord = record("waiting", true, 3);
    const readyLedger = buildExperimentOutcomeLedger({ experiment: readyRecord, commentObservations: [], funnelEvents: [], businessOutcomes: [] });
    const waitingLedger = buildExperimentOutcomeLedger({ experiment: waitingRecord, commentObservations: [], funnelEvents: [], businessOutcomes: [] });
    const view = buildSignalsExperimentPerformance({
      recommendations: [
        recommendationFor("ready"),
        recommendationFor("waiting"),
      ],
      records: [waitingRecord, readyRecord], ledgers: [waitingLedger, readyLedger], now: "2026-08-31T00:00:00.000Z",
    });
    assert.deepEqual(view.experiments.map((item) => item.experimentId), ["ready", "waiting"]);
    assert.equal(view.experiments[0]!.analysisStatus, "ready");
    assert.equal(view.experiments[1]!.analysisStatus, "collecting");
    assert.match(view.experiments[1]!.blockers.join(" "), /sample 3 of 10/i);
    assert.equal(view.autoWinner, false);
  });

  test("builds a body-free Signals interpretation prompt with the original decision rule", () => {
    const experiment = record("ready", true, 12);
    const recommendation = recommendationFor("ready");
    const ledger = buildExperimentOutcomeLedger({ experiment, commentObservations: [], funnelEvents: [], businessOutcomes: [] });
    const row = buildSignalsExperimentPerformance({ recommendations: [recommendation], records: [experiment], ledgers: [ledger], now: "2026-08-31T00:00:00.000Z" }).experiments[0]!;
    const prompt = buildSignalsExperimentInterpretationPrompt(row);
    assert.match(prompt, /keep, revise, or reject/i);
    assert.match(prompt, /substantive-replies-per-1000/);
    assert.match(prompt, /Never infer a winner/i);
    assert.doesNotMatch(prompt, /Trying to respond|Source text:/i);
  });
});
