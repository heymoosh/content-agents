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
import type { SourceEvidenceRow } from "../patterns/source-evidence.js";
import { buildCommentLearningView, type CommentLearningView } from "./comment-learning.js";
import { buildLearningBundle, type LearningBundle, type LearningBundleProposalInput } from "./learning-bundle.js";
import { buildVentureHandoffView } from "./venture-handoff.js";

const lineage: BlueprintLineage = { sourceId: "source-1", variantId: "variant-1", experimentId: "experiment-1" };
const evidence = { status: "observed" as const, refs: ["ref-1"], note: null };

const feedEvidence = (overrides: Partial<SourceEvidenceRow> = {}): SourceEvidenceRow => ({
  id: "feed-1", sourceId: "source-1", postId: "post-1", accountId: "account-1",
  platform: "linkedin", medium: "text", format: "short post", pool: "niche",
  membershipReason: "reviewed niche membership", audienceSizeSnapshot: null,
  metricSnapshot: { metric: "reactions", value: 240, unit: "count", numerator: 240, denominator: 10000, window: "lifetime", scope: "post", observedAt: "2026-08-23" },
  popularityScope: "niche creators on LinkedIn", sampleScope: "fixed reviewed sample", baselineScope: "LinkedIn /new baseline",
  evidenceLinks: ["https://example.test/post-1"], baselineSource: "baseline-ledger", bodyComplete: true,
  caveats: ["fixture"], provenance: "reviewed post snapshot", observedAt: "2026-08-23", collectedAt: "2026-08-23",
  reviewStatus: "reviewed", status: "ready", lineage: [{ recordType: "source", id: "source-1", relation: "evidences" }],
  handle: "creator-1", creator: "Creator 1", url: "https://example.test/post-1", sourceRole: "niche creator",
  listing: "fixed reviewed sample", window: "lifetime", rank: 1, evidenceLocation: "public post",
  metric: { name: "reactions", numerator: 240, denominator: 10000, window: "lifetime", scope: "post" }, selectionRule: "fixed reviewed sample",
  readiness: { status: "ready", reason: "complete", blockingFields: [] }, ...overrides,
});

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

function bundleFor(
  packetValue: BlueprintLearningPacket,
  overrides: Partial<LearningBundleProposalInput> = {},
  feedEvidenceRows: readonly SourceEvidenceRow[] = [feedEvidence()],
): LearningBundle {
  const learningView = buildCommentLearningView({
    commentObservations: packetValue.commentObservations,
    funnelEvents: packetValue.funnelEvents,
    businessOutcomes: packetValue.businessOutcomes,
    muxinDecision: packetValue.ventureInputProposal.muxinDecision,
  });
  return buildLearningBundle({
    lineage,
    learningView,
    feedEvidence: feedEvidenceRows,
    proposals: [{
      id: packetValue.ventureInputProposal.id,
      type: "lead",
      statement: "Test a focused workflow offer.",
      basisRecordIds: ["funnel-1"],
      feedContextIds: ["feed-1"],
      scope: "LinkedIn civic technology audience",
      sampleSize: 1,
      caveats: ["fixture only"],
      qualification: "qualified",
      muxinDecision: packetValue.ventureInputProposal.muxinDecision,
      lineage,
      ...overrides,
    }],
  });
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

  test("selects the exact bundle proposal and preserves only body-free metadata", () => {
    const packetValue = packet("adopted", "ready");
    const bundle = bundleFor(packetValue);
    const learningView = buildCommentLearningView({
      commentObservations: packetValue.commentObservations,
      funnelEvents: packetValue.funnelEvents,
      businessOutcomes: packetValue.businessOutcomes,
      muxinDecision: "adopted",
    });
    const result = buildVentureHandoffView({ packet: packetValue, learningView, learningBundle: bundle, proposalId: "proposal-1" });

    assert.equal(result.readiness.status, "ready");
    assert.equal(result.proposalId, "proposal-1");
    assert.equal(result.selectedProposal?.id, "proposal-1");
    assert.equal(result.selectedProposal?.type, "lead");
    assert.deepEqual(result.selectedProposal?.basisRecordIds, ["funnel-1"]);
    assert.deepEqual(result.selectedProposal?.feedContextIds, ["feed-1"]);
    assert.equal("statement" in (result.selectedProposal ?? {}), false);
    assert.equal(JSON.stringify(result).includes("private comment text"), false);
    assert.equal(JSON.stringify(result).includes("creator body"), false);
  });

  test("blocks a missing or mismatched explicit proposal instead of choosing one", () => {
    const packetValue = packet("adopted", "ready");
    const bundle = bundleFor(packetValue);
    const learningView = buildCommentLearningView({
      commentObservations: packetValue.commentObservations,
      funnelEvents: packetValue.funnelEvents,
      businessOutcomes: packetValue.businessOutcomes,
      muxinDecision: "adopted",
    });

    const missing = buildVentureHandoffView({ packet: packetValue, learningView, learningBundle: bundle });
    assert.equal(missing.readiness.status, "blocked");
    assert.ok(missing.readiness.blockers.some((blocker) => /proposal.*required|proposal.*missing/i.test(blocker)));

    const mismatched = buildVentureHandoffView({ packet: packetValue, learningView, learningBundle: bundle, proposalId: "proposal-404" });
    assert.equal(mismatched.readiness.status, "blocked");
    assert.ok(mismatched.readiness.blockers.some((blocker) => /proposal.*missing|proposal.*match/i.test(blocker)));
  });

  test("blocks a selected proposal with blocked feed evidence", () => {
    const packetValue = packet("adopted", "ready");
    const blockedBundle = bundleFor(packetValue, {}, [feedEvidence({ bodyComplete: false })]);
    const learningView = buildCommentLearningView({
      commentObservations: packetValue.commentObservations,
      funnelEvents: packetValue.funnelEvents,
      businessOutcomes: packetValue.businessOutcomes,
      muxinDecision: "adopted",
    });
    const result = buildVentureHandoffView({ packet: packetValue, learningView, learningBundle: blockedBundle, proposalId: "proposal-1" });
    assert.equal(result.readiness.status, "blocked");
  });

  test("blocks a selected proposal when its Muxin decision disagrees with the packet", () => {
    const packetValue = packet("adopted", "ready");
    const bundle = bundleFor(packetValue, { muxinDecision: "pending" });
    const learningView = buildCommentLearningView({
      commentObservations: packetValue.commentObservations,
      funnelEvents: packetValue.funnelEvents,
      businessOutcomes: packetValue.businessOutcomes,
      muxinDecision: "adopted",
    });
    const result = buildVentureHandoffView({ packet: packetValue, learningView, learningBundle: bundle, proposalId: "proposal-1" });
    assert.equal(result.readiness.status, "blocked");
    assert.ok(result.readiness.blockers.some((blocker) => /decision.*match|decision.*packet/i.test(blocker)));
  });

  test("keeps a comment-only hypothesis separate and blocked from Venture", () => {
    const fullPacket = packet("adopted", "ready");
    const packetValue = buildBlueprintLearningPacket({
      blueprint: fullPacket.blueprint,
      commentObservations: fullPacket.commentObservations,
      funnelEvents: [],
      businessOutcomes: [],
      ventureInputProposal: buildVentureInputProposal({
        ...fullPacket.ventureInputProposal,
        observation: { ...fullPacket.ventureInputProposal.observation, basisRecordIds: ["comment-1"] },
      }),
    });
    const learningView = buildCommentLearningView({
      commentObservations: packetValue.commentObservations,
      funnelEvents: [],
      businessOutcomes: [],
      muxinDecision: "adopted",
    });
    const commentBundle = buildLearningBundle({
      lineage,
      learningView,
      feedEvidence: [],
      proposals: [{
        id: "proposal-1", type: "product", statement: "Explore the comment signal.", basisRecordIds: ["comment-1"], feedContextIds: [],
        scope: "comment only", sampleSize: 1, caveats: ["not demand"], qualification: "hypothesis", muxinDecision: "adopted", lineage,
      }],
    });
    const result = buildVentureHandoffView({ packet: packetValue, learningView, learningBundle: commentBundle, proposalId: "proposal-1" });
    assert.equal(result.readiness.status, "blocked");
    assert.deepEqual(result.families.comment.map((hypothesis) => hypothesis.id), ["comment-1"]);
    assert.deepEqual(result.families.funnel, []);
    assert.deepEqual(result.families.business, []);
    assert.ok(result.readiness.blockers.some((blocker) => /hypothesis/i.test(blocker)));
  });
});
