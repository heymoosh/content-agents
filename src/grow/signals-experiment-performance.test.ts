import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildExperimentOutcomeLedger } from "./experiment-outcomes.js";
import { buildExperimentRecord } from "./experiment-record.js";
import { buildSignalsExperimentPerformance, buildSignalsExperimentInterpretationPrompt } from "./signals-experiment-performance.js";
import * as performanceSubject from "./signals-experiment-performance.js";
import { signalsExperimentRecommendation } from "./experiment-test-fixtures.js";
import { buildContentRequest } from "../review/content-request.js";
import { buildExperimentPlan } from "./experiment-content-handoff.js";
import { buildFunnelEvent, buildOutcomeLedger } from "./outcome-ledger.js";

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

  test("does not join identical provider identity from another account", () => {
    const facts = performanceSubject.buildMetricFactsFromProviderAnalytics({
      experimentId: "acct-bound", variantIds: ["variant:acct"],
      requestedMetrics: [{ family: "attention", metric: "impressions" }],
      publications: [{ rowId: "variant:acct", state: "published", providerObjectId: "same-post", providerAccountId: "human-inference/typefully", eventId: "pub-1" }],
      analytics: [{ id: "foreign", platformPostId: "same-post", url: null, providerAccountId: "charles/typefully", capturedAt: "2026-08-30T00:00:00Z", impressions: 100, replies: 0, clicks: 0, newFollows: 0 }],
    });
    assert.deepEqual(facts, []);
  });

  test("does not join identical provider account identity from another brand", () => {
    const facts = performanceSubject.buildMetricFactsFromProviderAnalytics({
      experimentId: "brand-bound", variantIds: ["variant:brand"],
      requestedMetrics: [{ family: "attention", metric: "impressions" }],
      publications: [{ rowId: "variant:brand", state: "published", providerObjectId: "same-post", providerAccountId: "shared-account", brandId: "human-inference", eventId: "pub-1" }],
      analytics: [{ id: "foreign", platformPostId: "same-post", url: null, providerAccountId: "shared-account", brandId: "charles", capturedAt: "2026-08-30T00:00:00Z", impressions: 100, replies: 0, clicks: 0, newFollows: 0 }],
    });
    assert.deepEqual(facts, []);
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

  test("requires evidence-linked measurements for both controlled arms and every guardrail", () => {
    const experiment = record("paired", false, null);
    const recommendation = {
      ...recommendationFor("paired"),
      minimumSample: 4,
      guardrails: [{ family: "audience" as const, metric: "essay-visits-per-1000", rule: "Must not decrease by more than 10%." }],
    };
    const ledger = buildExperimentOutcomeLedger({ experiment, commentObservations: [], funnelEvents: [], businessOutcomes: [] });
    const fact = (id: string, variantId: string, family: "conversation" | "audience", metric: string, value: number) => ({
      id, experimentId: "paired", variantId, family, metric, value, sample: 1,
      observedAt: "2026-08-25T00:00:00.000Z", evidenceRefs: [`analytics:${id}`], source: "provider-observation" as const,
    });
    const view = buildSignalsExperimentPerformance({
      recommendations: [recommendation], records: [experiment], ledgers: [ledger], now: "2026-08-31T00:00:00.000Z",
      metricFacts: [
        fact("primary-treatment-1", "variant:paired", "conversation", "substantive-replies-per-1000", 3.2),
        fact("primary-treatment-2", "variant:paired", "conversation", "substantive-replies-per-1000", 2.8),
        fact("primary-control-1", "baseline:paired", "conversation", "substantive-replies-per-1000", 1.1),
        fact("primary-control-2", "baseline:paired", "conversation", "substantive-replies-per-1000", 1.3),
        fact("guardrail-treatment", "variant:paired", "audience", "essay-visits-per-1000", 4.1),
        fact("guardrail-control", "baseline:paired", "audience", "essay-visits-per-1000", 4.0),
      ],
    } as any);
    const row = view.experiments[0]! as any;
    assert.equal(row.analysisStatus, "ready");
    assert.deepEqual(row.primaryComparison, {
      treatment: { variantId: "variant:paired", value: 3, sample: 2 },
      control: { variantId: "baseline:paired", value: 1.2, sample: 2 },
    });
    assert.equal(row.guardrailComparisons[0].treatment.value, 4.1);
    assert.deepEqual(row.outcomeRefs, [
      "analytics:guardrail-control", "analytics:guardrail-treatment", "analytics:primary-control-1",
      "analytics:primary-control-2", "analytics:primary-treatment-1", "analytics:primary-treatment-2",
    ]);
    assert.deepEqual(row.primaryOutcomeRefs, { treatment: [], control: [] }, "provider observations never masquerade as outcome-ledger evidence");
  });

  test("keeps a one-sided or guardrail-free result collecting", () => {
    const experiment = record("one-sided", false, null);
    const recommendation = {
      ...recommendationFor("one-sided"), minimumSample: 1,
      guardrails: [{ family: "audience" as const, metric: "essay-visits-per-1000", rule: "Must hold." }],
    };
    const ledger = buildExperimentOutcomeLedger({ experiment, commentObservations: [], funnelEvents: [], businessOutcomes: [] });
    const view = buildSignalsExperimentPerformance({
      recommendations: [recommendation], records: [experiment], ledgers: [ledger], now: "2026-08-31T00:00:00.000Z",
      metricFacts: [{
        id: "only-treatment", experimentId: "one-sided", variantId: "variant:one-sided", family: "conversation",
        metric: "substantive-replies-per-1000", value: 3, sample: 1, observedAt: "2026-08-25T00:00:00.000Z",
        evidenceRefs: ["analytics:only-treatment"], source: "provider-observation",
      }],
    } as any);
    assert.equal(view.experiments[0]!.analysisStatus, "collecting");
    assert.match(view.experiments[0]!.blockers.join(" "), /comparison arm|guardrail/i);
  });

  test("derives only exact, supported metrics from published provider identities and latest analytics", () => {
    const buildFacts = (performanceSubject as any).buildMetricFactsFromProviderAnalytics;
    const facts = buildFacts({
      experimentId: "experiment-live",
      variantIds: ["treatment", "control"],
      requestedMetrics: [
        { family: "conversation", metric: "replies-per-1000-impressions" },
        { family: "conversation", metric: "substantive-replies-per-1000-impressions" },
        { family: "audience", metric: "essay-visits-per-1000-impressions" },
        { family: "conversation", metric: "clicks" },
        { family: "business", metric: "impressions" },
      ],
      publications: [
        { rowId: "treatment", state: "published", providerObjectId: "li-101", canonicalUrl: "https://linkedin.com/posts/101", providerPublishedAt: "2026-08-20T12:00:00Z", eventId: "delivery-1" },
        { rowId: "control", state: "published", providerObjectId: "li-102", canonicalUrl: "https://linkedin.com/posts/102", providerPublishedAt: "2026-08-21T12:00:00Z", eventId: "delivery-2" },
        { rowId: "ignored", state: "published", providerObjectId: "li-999", providerPublishedAt: "2026-08-21T12:00:00Z", eventId: "delivery-3" },
      ],
      analytics: [
        { id: 1, platformPostId: "li-101", url: "https://linkedin.com/posts/101", capturedAt: "2026-08-22T00:00:00Z", impressions: 1000, replies: 2, clicks: 3, newFollows: 0 },
        { id: 2, platformPostId: "li-101", url: "https://linkedin.com/posts/101", capturedAt: "2026-08-25T00:00:00Z", impressions: 2000, replies: 6, clicks: 5, newFollows: 1 },
        { id: 3, platformPostId: "li-102", url: "https://linkedin.com/posts/102", capturedAt: "2026-08-25T00:00:00Z", impressions: 1000, replies: 1, clicks: 2, newFollows: 0 },
        { id: 4, platformPostId: "almost-li-102", url: null, capturedAt: "2026-08-26T00:00:00Z", impressions: 9999, replies: 999, clicks: 999, newFollows: 999 },
      ],
    });
    assert.deepEqual(facts.map((fact: any) => ({ variantId: fact.variantId, metric: fact.metric, value: fact.value, evidenceRefs: fact.evidenceRefs })), [
      { variantId: "control", metric: "replies-per-1000-impressions", value: 1, evidenceRefs: ["analytics:metrics:3:2026-08-25T00:00:00Z", "provider:delivery-2"] },
      { variantId: "treatment", metric: "replies-per-1000-impressions", value: 3, evidenceRefs: ["analytics:metrics:2:2026-08-25T00:00:00Z", "provider:delivery-1"] },
    ]);
    assert.equal(facts.some((fact: any) => fact.metric.includes("substantive") || fact.metric.includes("essay-visits")), false);
    assert.equal(facts.some((fact: any) => fact.metric === "clicks" || fact.metric === "impressions"), false);
  });

  test("builds the grouped Signals read directly from approved plans, provider observations, and analytics facts", () => {
    const input = { id: "live-content", origin: "human-inference" as const, descriptor: "experiment", originalInput: "Source.", treatments: ["summary"], media: ["none"], platforms: ["linkedin"], sourceProvenance: { kind: "source" as const, sourceLines: [1] } };
    const request = buildContentRequest(input);
    const treatment = request.variants.find((variant) => variant.identity.kind === "treated")!.identity.id;
    const control = request.variants.find((variant) => variant.identity.kind === "control")!.identity.id;
    const base = signalsExperimentRecommendation({ variantId: treatment, comparisonRef: control, minimumSample: 2, families: ["conversation", "attention"] });
    const plan = buildExperimentPlan({
      recommendation: {
        ...base, id: "live-experiment", minimumDays: 1,
        expectedOutcome: { variantId: treatment, comparisonRef: control, family: "conversation", metric: "replies-per-1000-impressions", direction: "increase" },
        primaryMetric: { family: "conversation", metric: "replies-per-1000-impressions" },
        guardrails: [{ family: "attention", metric: "impressions", rule: "Must remain measurable." }],
      },
      contentRequest: input,
      variablesByVariant: Object.fromEntries(request.variants.map((variant) => [variant.identity.id, { opening: variant.identity.kind }])),
      capacity: { availablePublishingUnits: 2, availableDays: 1 },
    });
    const buildLive = (performanceSubject as any).buildLiveSignalsExperimentPerformance;
    const view = buildLive({
      plans: [plan],
      publications: [
        { slug: "live-content", rowId: treatment, state: "live", providerObjectId: "post-1", at: "2026-08-20T00:00:00Z", providerPublishedAt: "2026-08-20T00:00:00Z", eventId: "event-1" },
        { slug: "live-content", rowId: control, state: "live", providerObjectId: "post-2", at: "2026-08-21T00:00:00Z", providerPublishedAt: "2026-08-21T00:00:00Z", eventId: "event-2" },
      ],
      analytics: [
        { id: 1, platformPostId: "post-1", url: null, capturedAt: "2026-08-29T00:00:00Z", impressions: 1000, replies: 4, clicks: 2, newFollows: 0 },
        { id: 2, platformPostId: "post-2", url: null, capturedAt: "2026-08-29T00:00:00Z", impressions: 1000, replies: 2, clicks: 2, newFollows: 0 },
      ],
      now: "2026-08-31T00:00:00Z",
    });
    assert.equal(view.experiments[0].analysisStatus, "ready");
    assert.equal(view.experiments[0].primaryComparison.treatment.value, 4);
    assert.equal(view.experiments[0].primaryComparison.control.value, 2);
    assert.equal(view.experiments[0].autoWinner, false);
    assert.equal(view.experiments[0].winner, null);
  });

  test("maps exact attributed outcome-ledger facts back to each experiment arm", () => {
    const outcome = (id: string, contentItemId: string, value: number) => buildFunnelEvent({
      id, observedAt: "2026-08-29T00:00:00Z", collectedAt: "2026-08-29T01:00:00Z",
      eventType: "visit", metric: "essay-visits-per-1000-impressions", value, unit: "rate", numerator: value, denominator: 1000,
      scope: { platform: "linkedin", surface: "post", contentItemId },
      window: { startAt: "2026-08-20T00:00:00Z", endAt: "2026-08-29T00:00:00Z" },
      sourceNote: "website analytics attributed by campaign id", evidenceRefs: [`website:${id}`],
      lineage: [{ recordType: "publish", id: contentItemId, relation: "attributed-to" }], caveats: [], status: "measured",
      respondentHash: null,
      attribution: [{ contentItemId, touchType: "last", touchAt: "2026-08-29T00:00:00Z", confidence: "high", attributionReason: null }],
    });
    const buildFacts = (performanceSubject as any).buildMetricFactsFromOutcomeLedger;
    const facts = buildFacts({
      experimentId: "experiment-outcomes", variantIds: ["treatment", "control"],
      requestedMetrics: [{ family: "audience", metric: "essay-visits-per-1000-impressions" }],
      publications: [
        { rowId: "treatment", state: "live", providerObjectId: "post-1", eventId: "provider-1" },
        { rowId: "control", state: "live", providerObjectId: "post-2", eventId: "provider-2" },
      ],
      ledger: buildOutcomeLedger([outcome("visit-treatment", "post-1", 4.1), outcome("visit-control", "post-2", 4)]),
    });
    assert.deepEqual(facts.map((fact: any) => ({ variantId: fact.variantId, value: fact.value, source: fact.source, evidenceRefs: fact.evidenceRefs })), [
      { variantId: "control", value: 4, source: "outcome-ledger", evidenceRefs: ["outcome:visit-control", "provider:provider-2", "website:visit-control"] },
      { variantId: "treatment", value: 4.1, source: "outcome-ledger", evidenceRefs: ["outcome:visit-treatment", "provider:provider-1", "website:visit-treatment"] },
    ]);
  });
});
