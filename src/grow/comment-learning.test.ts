import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildBusinessOutcome,
  buildCommentObservation,
  buildFunnelEvent,
} from "../review/learning-packet.js";
import { buildCommentLearningView } from "./comment-learning.js";

const lineage = { sourceId: "source-1", variantId: "variant-2", experimentId: "experiment-3" };
const evidence = { status: "observed" as const, refs: ["evidence-2", "evidence-1"], note: null };

const comment = buildCommentObservation({
  id: "comment-1",
  lineage,
  observation: {
    sourcePlatform: "substack",
    surface: "comment",
    commentId: "remote-comment-1",
    observedAt: "2026-08-23T12:00:00Z",
    text: "Private source text must not enter the operator view.",
  },
  qualification: { status: "qualified", basis: "names a concrete recurring problem" },
  interpretation: { summary: "problem signal", confidence: "medium" },
  evidence,
  caveats: ["single observation"],
});

const optIn = buildFunnelEvent({
  id: "funnel-1",
  lineage,
  observation: { eventType: "opt_in", occurredAt: "2026-08-23T13:00:00Z", source: "substack", value: null },
  interpretation: { summary: "opt-in signal", confidence: "low" },
  evidence,
  caveats: [],
});

const purchase = buildBusinessOutcome({
  id: "business-1",
  lineage,
  observation: { outcomeType: "purchase", occurredAt: "2026-08-23T14:00:00Z", source: "substack", amount: 25, currency: "usd" },
  interpretation: { summary: "purchase recorded", confidence: "high" },
  evidence,
  caveats: [],
});

describe("comment learning operator view", () => {
  test("emits typed hypotheses with complete lineage, evidence, confidence, qualification, and a pending Muxin decision", () => {
    const view = buildCommentLearningView({ commentObservations: [comment], funnelEvents: [optIn], businessOutcomes: [purchase] });

    assert.equal(view.kind, "grow_comment_learning_view");
    assert.equal(view.sideEffects, "none");
    assert.equal(view.muxinDecision, "pending");
    assert.deepEqual(view.hypotheses.map((hypothesis) => hypothesis.id), ["business-1", "comment-1", "funnel-1"]);
    assert.deepEqual(view.hypotheses[0], {
      id: "business-1",
      type: "product",
      signal: "purchase",
      qualification: "qualified",
      confidence: "high",
      lineage,
      evidenceRefs: ["evidence-1", "evidence-2"],
      sourceRecordIds: ["business-1"],
      muxinDecision: "pending",
    });
    assert.equal(view.hypotheses[2]?.type, "lead");
    assert.equal(view.hypotheses[2]?.qualification, "uncertain");
  });

  test("never includes comment body copy or Venture artifact instructions", () => {
    const view = buildCommentLearningView({ commentObservations: [comment], funnelEvents: [], businessOutcomes: [] });
    const serialized = JSON.stringify(view);

    assert.equal(serialized.includes(comment.observation.text), false);
    assert.equal(Object.hasOwn(view, "venture"), false);
    assert.equal(Object.hasOwn(view.hypotheses[0] ?? {}, "body"), false);
  });

  test("preserves not-qualified and missing-evidence state instead of upgrading demand", () => {
    const notQualified = buildCommentObservation({
      ...comment,
      id: "comment-2",
      qualification: { status: "not_qualified", basis: "generic praise" },
      evidence: { status: "missing", refs: [], note: "not collected" },
    });
    const view = buildCommentLearningView({ commentObservations: [notQualified], funnelEvents: [], businessOutcomes: [] });

    assert.equal(view.hypotheses[0]?.qualification, "not_qualified");
    assert.equal(view.hypotheses[0]?.signal, "comment");
    assert.deepEqual(view.hypotheses[0]?.evidenceRefs, []);
    assert.equal(view.readiness.status, "blocked");
    assert.ok(view.readiness.blockers.includes("comment-2 evidence is missing"));
  });
});
