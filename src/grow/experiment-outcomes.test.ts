import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildExperimentRecord } from "./experiment-record.js";
import { buildExperimentOutcomeLedger } from "./experiment-outcomes.js";
import { buildBusinessOutcome, buildCommentObservation, buildFunnelEvent } from "../review/learning-packet.js";

const lineage = { sourceId: "source-1", variantId: "variant-1", experimentId: "experiment-1" };
const evidence = { status: "observed" as const, refs: ["evidence-1"], note: null };

const experiment = (status: "proposed" | "running" | "closed" = "running") => buildExperimentRecord({
  id: "experiment-1", question: "Does the opening change conversation?", hypothesis: "A concrete opening helps.",
  unit: "post", comparison: { control: "variant-1", treatment: "variant-1" },
  variables: [{ name: "opening", options: ["concrete", "abstract"] }],
  scope: { platform: ["linkedin"], format: ["text"], topic: ["human inference"], audience: ["builders"] },
  lineage: { sourceRefs: ["source-1"], variantRefs: ["variant-1"], publishRefs: ["publish-1"], outcomeRefs: ["outcome-1"] },
  successObservations: [{ id: "success-1", family: "conversation", metric: "qualified comments", measured: false, sample: null, outcomeRefs: ["outcome-1"] }],
  minimumSample: 3, reviewRule: "after 3 posts", status,
});

const comment = (lineageOverride = lineage) => buildCommentObservation({
  id: "comment-1", lineage: lineageOverride, observation: {
    sourcePlatform: "linkedin", surface: "comment", commentId: "comment-1",
    observedAt: "2026-08-24T12:00:00Z", text: "I had this problem too.",
  }, qualification: { status: "qualified", basis: "describes a concrete problem" },
  interpretation: { summary: "problem signal", confidence: "medium" }, evidence, caveats: ["one comment"],
});

const funnel = buildFunnelEvent({ id: "funnel-1", lineage, observation: {
  eventType: "visit", occurredAt: "2026-08-24T12:00:00Z", source: "linkedin", value: null,
}, interpretation: null, evidence, caveats: [] });

const business = buildBusinessOutcome({ id: "business-1", lineage, observation: {
  outcomeType: "purchase", occurredAt: "2026-08-24T12:00:00Z", source: "linkedin", amount: null, currency: null,
}, interpretation: null, evidence, caveats: [] });

describe("experiment outcome ledger", () => {
  test("links learning observations into distinct families without copying their text", () => {
    const result = buildExperimentOutcomeLedger({ experiment: experiment(), commentObservations: [comment()], funnelEvents: [funnel], businessOutcomes: [business] });
    assert.deepEqual(result.familyCounts, { attention: 0, conversation: 1, audience: 1, business: 1 });
    assert.equal(result.readiness.status, "ready");
    assert.equal(result.links.find((link) => link.recordId === "comment-1")?.family, "conversation");
    assert.equal(result.links.find((link) => link.recordId === "business-1")?.family, "business");
    assert.equal(Object.hasOwn(result.links[0] ?? {}, "text"), false);
    assert.equal(JSON.stringify(result).includes("I had this problem"), false);
    assert.equal(result.winner, null);
  });

  test("blocks a linked record with mismatched experiment lineage", () => {
    const result = buildExperimentOutcomeLedger({ experiment: experiment(), commentObservations: [comment({ ...lineage, experimentId: "other-experiment" })], funnelEvents: [], businessOutcomes: [] });
    assert.equal(result.readiness.status, "blocked");
    assert.ok(result.readiness.blockers.some((blocker) => blocker.includes("comment-1") && blocker.includes("lineage")));
  });

  test("keeps evidence and declared observations visible when evidence is missing", () => {
    const missingEvidence = buildBusinessOutcome({ ...business, evidence: { status: "missing", refs: [], note: "not collected" } });
    const result = buildExperimentOutcomeLedger({ experiment: experiment(), commentObservations: [], funnelEvents: [], businessOutcomes: [missingEvidence] });
    assert.equal(result.readiness.status, "blocked");
    assert.ok(result.readiness.blockers.includes("business-1 evidence is missing"));
    assert.equal(result.declaredObservations[0]?.minimumSample, 3);
  });

  test("does not infer a winner for a running experiment", () => {
    const result = buildExperimentOutcomeLedger({ experiment: experiment("running"), commentObservations: [comment()], funnelEvents: [], businessOutcomes: [] });
    assert.equal(result.winner, null);
    assert.equal(result.readiness.status, "ready");
  });
});
