import type { BlueprintLearningPacket, BlueprintLineage } from "../review/learning-packet.js";
import type { CommentLearningHypothesis, CommentLearningView } from "./comment-learning.js";

/** Pure, read-only projection at the Signals -> Venture boundary. */
export const VENTURE_HANDOFF_VIEW_VERSION = "grow-venture-handoff-v1" as const;

export type VentureHandoffFamily = "comment" | "funnel" | "business";

export interface VentureHandoffHypothesis extends CommentLearningHypothesis {
  readonly family: VentureHandoffFamily;
}

export interface VentureHandoffView {
  readonly kind: "grow_venture_handoff_view";
  readonly version: typeof VENTURE_HANDOFF_VIEW_VERSION;
  readonly blueprintId: string;
  readonly lineage: BlueprintLineage;
  readonly families: {
    readonly comment: VentureHandoffHypothesis[];
    readonly funnel: VentureHandoffHypothesis[];
    readonly business: VentureHandoffHypothesis[];
  };
  readonly qualifiedHypotheses: VentureHandoffHypothesis[];
  readonly muxinDecision: BlueprintLearningPacket["ventureInputProposal"]["muxinDecision"];
  /** The proposal's declared Venture gate, kept separate from readiness. */
  readonly ventureGate: BlueprintLearningPacket["ventureInputProposal"]["ventureGate"];
  readonly readiness: { readonly status: "blocked" | "ready"; readonly blockers: string[] };
  readonly autoClaimsDemand: false;
  readonly ventureArtifacts: false;
  readonly sideEffects: "none";
}

function sameLineage(left: BlueprintLineage, right: BlueprintLineage): boolean {
  return left.sourceId === right.sourceId
    && left.variantId === right.variantId
    && left.experimentId === right.experimentId;
}

function withFamily(
  records: readonly { id: string }[],
  learningView: CommentLearningView,
  family: VentureHandoffFamily,
  blockers: string[],
): VentureHandoffHypothesis[] {
  return records.flatMap((record) => {
    const hypothesis = learningView.hypotheses.find((candidate) => candidate.id === record.id);
    if (!hypothesis) {
      blockers.push(`learning view is missing hypothesis ${record.id}`);
      return [];
    }
    return [{
      ...hypothesis,
      family,
      lineage: { ...hypothesis.lineage },
      evidenceRefs: [...hypothesis.evidenceRefs],
      sourceRecordIds: [...hypothesis.sourceRecordIds],
      muxinDecision: learningView.muxinDecision,
    }];
  });
}

/**
 * Join an existing packet and Signals view without generating copy or changing either input.
 * Readiness requires Muxin adoption, a ready/accepted Venture gate, and both source views to
 * report no blockers. The three signal families remain distinct throughout the projection.
 */
export function buildVentureHandoffView(input: {
  readonly packet: BlueprintLearningPacket;
  readonly learningView: CommentLearningView;
}): VentureHandoffView {
  const { packet, learningView } = input;
  const proposal = packet.ventureInputProposal;
  const blockers = [...packet.handoff.blockers, ...learningView.readiness.blockers];
  const comment = withFamily(packet.commentObservations, learningView, "comment", blockers);
  const funnel = withFamily(packet.funnelEvents, learningView, "funnel", blockers);
  const business = withFamily(packet.businessOutcomes, learningView, "business", blockers);
  const all = [...comment, ...funnel, ...business];

  if (proposal.muxinDecision !== "adopted") {
    blockers.push(proposal.muxinDecision === "pending" ? "Muxin decision is pending" : "Muxin declined the proposal");
  }
  if (proposal.ventureGate !== "ready" && proposal.ventureGate !== "accepted") {
    blockers.push(`Venture gate is ${proposal.ventureGate}`);
  }
  if (learningView.muxinDecision !== proposal.muxinDecision) blockers.push("Muxin decision does not match the packet");
  for (const hypothesis of all) {
    if (!sameLineage(hypothesis.lineage, packet.lineage)) blockers.push(`${hypothesis.id} lineage does not match blueprint`);
  }

  const uniqueBlockers = [...new Set(blockers)].sort((left, right) => left.localeCompare(right));
  const ready = uniqueBlockers.length === 0;
  return {
    kind: "grow_venture_handoff_view",
    version: VENTURE_HANDOFF_VIEW_VERSION,
    blueprintId: packet.blueprint.id,
    lineage: { ...packet.lineage },
    families: { comment, funnel, business },
    qualifiedHypotheses: all.filter((hypothesis) => hypothesis.qualification === "qualified"),
    muxinDecision: proposal.muxinDecision,
    ventureGate: proposal.ventureGate,
    readiness: { status: ready ? "ready" : "blocked", blockers: uniqueBlockers },
    autoClaimsDemand: false,
    ventureArtifacts: false,
    sideEffects: "none",
  };
}

export const createVentureHandoffView = buildVentureHandoffView;
