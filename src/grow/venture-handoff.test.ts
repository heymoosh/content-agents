import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildBlueprintLearningPacket,
  buildBusinessOutcome,
  buildCommentObservation,
  buildFunnelEvent,
  buildVentureInputProposal,
  type BlueprintLearningPacket,
  type BlueprintLineage,
  type MuxinDecision,
  type VentureGate,
} from "../review/learning-packet.js";
import { buildCommentLearningView, type CommentLearningView } from "./comment-learning.js";
import { buildVentureHandoffView } from "./venture-handoff.js";

const lineage: BlueprintLineage = { sourceId: "source-1", variantId: "variant-1", experimentId: "experiment-1" };
const evidence = { status: "observed" as const, refs: ["ref-1"], note: null };

function packet(muxinDecision: MuxinDecision, ventureGate: VentureGate): BlueprintLearningPacket {
  const comment = buildCommentObservation({
    id: "comment-1", lineage,
    observation: { sourcePlatform: "substack", surface: "comment", commentId: "remote-1", observedAt: "2026-08-23T12:00:00Z", text: "private comment text" },
    qualification: { status: "qualified", basis: "names a concrete problem" },
    interpretation: { summary: "problem signal", confidence: "medium" }, evidence, caveats: [],
  });
  const funnel = buildFunnelEvent({
    id: "funnel-1", lineage,
    observation: { eventType: "qualified_inquiry", occurredAt: "2026-08-23T13:00:00Z", source: "form", value: null },
    interpretation: { summary: "qualified inquiry", confidence: "high" }, evidence, caveats: [],
  });
  const business = buildBusinessOutcome({
    id: "business-1", lineage,
    observation: { outcomeType: "purchase", occurredAt: "2026-08-23T14:00:00Z", source: "checkout", amount: 25, currency: "USD" },
    interpretation: { summary: "purchase", confidence: "high" }, evidence, caveats: [],
  });
  return buildBlueprintLearningPacket({
    blueprint: { id: "blueprint-1", publishedAt: "2026-08-23T11:00:00Z", lineage },
    commentObservations: [comment], funnelEvents: [funnel], businessOutcomes: [business],
    ventureInputProposal: buildVentureInputProposal({
      id: "proposal-1", lineage,
      observation: { basisRecordIds: ["comment-1", "funnel-1", "business-1"], factualSummary: "observed signals" },
      interpretation: { proposedInput: "test the problem", rationale: "signals warrant review", confidence: "medium" },
      caveats: ["not proof of demand"], evidence, muxinDecision, ventureGate,
    }),
  });
}

function view(muxinDecision: MuxinDecision, ventureGate: VentureGate): ReturnType<typeof buildVentureHandoffView> {
  const packetValue = packet(muxinDecision, ventureGate);
  const learningView = buildCommentLearningView({
    commentObservations: packetValue.commentObservations,
    funnelEvents: packetValue.funnelEvents,
    businessOutcomes: packetValue.businessOutcomes,
    muxinDecision,
  });
  return buildVentureHandoffView({ packet: packetValue, learningView });
}

describe("Venture/Signals handoff view", () => {
  test("stays blocked while Muxin's decision is pending", () => {
    const result = view("pending", "blocked");
    assert.equal(result.readiness.status, "blocked");
    assert.ok(result.readiness.blockers.includes("Muxin decision is pending"));
  });

  test("preserves a declined decision as blocked", () => {
    const result = view("declined", "rejected");
    assert.equal(result.readiness.status, "blocked");
    assert.ok(result.readiness.blockers.includes("Muxin declined the proposal"));
    assert.equal(result.muxinDecision, "declined");
    assert.equal(result.ventureGate, "rejected");
  });

  test("keeps an adopted proposal blocked until the Venture gate is ready", () => {
    const result = view("adopted", "blocked");
    assert.equal(result.readiness.status, "blocked");
    assert.ok(result.readiness.blockers.includes("Venture gate is blocked"));
  });

  test("is ready only for an adopted proposal with a ready or accepted Venture gate", () => {
    for (const ventureGate of ["ready", "accepted"] as const) {
      const result = view("adopted", ventureGate);
      assert.equal(result.readiness.status, "ready");
      assert.deepEqual(Object.keys(result.families), ["comment", "funnel", "business"]);
      assert.equal(result.families.comment[0]?.type, "product");
      assert.equal(result.families.funnel[0]?.type, "lead");
      assert.equal(result.families.business[0]?.type, "product");
      assert.deepEqual(result.families.comment[0]?.lineage, lineage);
      assert.deepEqual(result.families.comment[0]?.evidenceRefs, ["ref-1"]);
      assert.equal(result.qualifiedHypotheses.length, 3);
    }
  });

  test("does not expose comment body copy, create artifacts, or mutate inputs", () => {
    const packetValue = packet("adopted", "ready");
    const learningView: CommentLearningView = buildCommentLearningView({
      commentObservations: packetValue.commentObservations, funnelEvents: packetValue.funnelEvents,
      businessOutcomes: packetValue.businessOutcomes, muxinDecision: "adopted",
    });
    const before = JSON.stringify(packetValue);
    const result = buildVentureHandoffView({ packet: packetValue, learningView });
    assert.equal(JSON.stringify(packetValue), before);
    assert.equal(JSON.stringify(result).includes("private comment text"), false);
    assert.equal(result.autoClaimsDemand, false);
    assert.equal(result.ventureArtifacts, false);
    assert.equal(result.sideEffects, "none");
  });

  test("reports a missing Signals hypothesis as blocked instead of throwing", () => {
    const packetValue = packet("adopted", "ready");
    const result = buildVentureHandoffView({
      packet: packetValue,
      learningView: buildCommentLearningView({ commentObservations: [], funnelEvents: [], businessOutcomes: [], muxinDecision: "adopted" }),
    });
    assert.equal(result.readiness.status, "blocked");
    assert.ok(result.readiness.blockers.includes("learning view is missing hypothesis comment-1"));
  });
});
