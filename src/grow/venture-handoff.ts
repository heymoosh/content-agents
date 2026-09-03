import type { BlueprintLearningPacket, BlueprintLineage } from "../review/learning-packet.js";
import type { CommentLearningHypothesis, CommentLearningView } from "./comment-learning.js";
import type { LearningBundle, LearningBundleProposal } from "./learning-bundle.js";

/** Pure, read-only projection at the Signals -> Venture boundary. */
export const VENTURE_HANDOFF_VIEW_VERSION = "grow-venture-handoff-v1" as const;

export type VentureHandoffFamily = "comment" | "funnel" | "business";

export interface VentureHandoffHypothesis extends CommentLearningHypothesis {
  readonly family: VentureHandoffFamily;
}

/** Selected proposal metadata only. Proposal statements and source/feed bodies stay out. */
export type VentureHandoffProposalMetadata = Pick<
  LearningBundleProposal,
  | "id"
  | "type"
  | "basisRecordIds"
  | "feedContextIds"
  | "scope"
  | "sampleSize"
  | "caveats"
  | "qualification"
  | "muxinDecision"
  | "lineage"
  | "basisHypotheses"
  | "feedContext"
  | "readiness"
  | "status"
>;

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
  readonly proposalId: string | null;
  readonly selectedProposal: VentureHandoffProposalMetadata | null;
  readonly muxinDecision: BlueprintLearningPacket["ventureInputProposal"]["muxinDecision"];
  /** The proposal's declared Venture gate, kept separate from readiness. */
  readonly ventureGate: BlueprintLearningPacket["ventureInputProposal"]["ventureGate"];
  readonly readiness: { readonly status: "blocked" | "ready"; readonly blockers: string[] };
  readonly autoClaimsDemand: false;
  readonly ventureArtifacts: false;
  readonly sideEffects: "none";
}

/** Immutable, evidence-linked proof that this Content variant produced measured outcomes. */
export interface MeasuredContentEvidence {
  readonly sourceId: string;
  readonly variantId: string;
  readonly experimentId: string;
  readonly measured: true;
  readonly sampleSize: number;
  readonly evidenceRefs: readonly string[];
  readonly outcomeRefs: readonly string[];
  readonly contentItemRefs: readonly string[];
  readonly provenance: string;
  readonly caveats: readonly string[];
}

function completeLineage(value: unknown): value is BlueprintLineage {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const lineage = value as Record<string, unknown>;
  return [lineage.sourceId, lineage.variantId, lineage.experimentId]
    .every((item) => typeof item === "string" && item.trim() !== "");
}

function sameLineage(left: unknown, right: unknown): boolean {
  return completeLineage(left) && completeLineage(right)
    && left.sourceId === right.sourceId
    && left.variantId === right.variantId
    && left.experimentId === right.experimentId;
}

export function measuredContentEvidenceBlockers(value: MeasuredContentEvidence | null | undefined, lineage: BlueprintLineage): string[] {
  if (value === null || value === undefined) return ["measured Content variant/outcome evidence is missing"];
  const blockers: string[] = [];
  if (value.measured !== true) blockers.push("measured Content variant/outcome evidence is not measured");
  if (value.sourceId !== lineage.sourceId || value.variantId !== lineage.variantId || value.experimentId !== lineage.experimentId) {
    blockers.push("measured Content evidence lineage does not match blueprint");
  }
  if (!Number.isInteger(value.sampleSize) || value.sampleSize < 1) blockers.push("measured Content evidence sample size is invalid");
  if (!Array.isArray(value.evidenceRefs) || value.evidenceRefs.length === 0) blockers.push("measured Content evidence refs are missing");
  if (!Array.isArray(value.outcomeRefs) || value.outcomeRefs.length === 0) blockers.push("measured Content outcome refs are missing");
  if (!Array.isArray(value.contentItemRefs) || value.contentItemRefs.length === 0) blockers.push("measured Content item refs are missing");
  if (typeof value.provenance !== "string" || value.provenance.trim() === "") blockers.push("measured Content evidence provenance is missing");
  return blockers;
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
  /** Optional for legacy callers; supplying it requires an explicit proposalId. */
  readonly learningBundle?: LearningBundle | null;
  readonly proposalId?: string | null;
  readonly measuredEvidence?: MeasuredContentEvidence | null;
}): VentureHandoffView {
  const { packet, learningView } = input;
  const proposal = packet.ventureInputProposal;
  const blockers = [...packet.handoff.blockers, ...learningView.readiness.blockers];
  blockers.push(...measuredContentEvidenceBlockers(input.measuredEvidence, packet.lineage));
  const comment = withFamily(packet.commentObservations, learningView, "comment", blockers);
  const funnel = withFamily(packet.funnelEvents, learningView, "funnel", blockers);
  const business = withFamily(packet.businessOutcomes, learningView, "business", blockers);
  const all = [...comment, ...funnel, ...business];
  const explicitBundlePath = true;
  let selectedProposal: VentureHandoffProposalMetadata | null = null;

  if (!sameLineage(packet.blueprint.lineage, packet.lineage)) {
    blockers.push("blueprint lineage does not match packet");
  }
  if (!sameLineage(proposal.lineage, packet.lineage)) {
    blockers.push("packet proposal lineage does not match blueprint");
  }
  for (const [family, records] of [
    ["comment", packet.commentObservations],
    ["funnel", packet.funnelEvents],
    ["business", packet.businessOutcomes],
  ] as const) {
    for (const record of records) {
      if (!sameLineage(record.lineage, packet.lineage)) blockers.push(`${family} record ${record.id} lineage does not match blueprint`);
    }
  }
  for (const hypothesis of learningView.hypotheses) {
    if (!sameLineage(hypothesis.lineage, packet.lineage)) blockers.push(`${hypothesis.id} lineage does not match blueprint`);
  }

  if (proposal.muxinDecision !== "adopted") {
    blockers.push(proposal.muxinDecision === "pending" ? "Muxin decision is pending" : "Muxin declined the proposal");
  }
  if (proposal.ventureGate !== "accepted") {
    blockers.push(`Venture gate is ${proposal.ventureGate}; accepted is required`);
  }
  if (learningView.muxinDecision !== proposal.muxinDecision) blockers.push("Muxin decision does not match the packet");
  for (const hypothesis of all) {
    if (!sameLineage(hypothesis.lineage, packet.lineage)) blockers.push(`${hypothesis.id} lineage does not match blueprint`);
  }

  if (explicitBundlePath) {
    const bundle = input.learningBundle;
    if (bundle === null || bundle === undefined) {
      blockers.push("LearningBundle is required for an explicit proposal handoff");
    }
    if (typeof input.proposalId !== "string" || input.proposalId.trim() === "") {
      blockers.push("proposalId is required for an explicit proposal handoff");
    }
    if (bundle !== null && bundle !== undefined && typeof input.proposalId === "string" && input.proposalId.trim() !== "") {
      if (!sameLineage(bundle.lineage, packet.lineage)) blockers.push("learning bundle lineage does not match blueprint");
      if (!Array.isArray(bundle.proposals)) {
        blockers.push("learning bundle proposals are missing");
      } else {
        const matches = bundle.proposals.filter((candidate) => candidate?.id === input.proposalId);
        if (matches.length !== 1) {
          blockers.push(`learning bundle proposal ${input.proposalId} is missing or not unique`);
        } else {
          const candidate = matches[0];
          if (!completeProposal(candidate)) {
            blockers.push("selected proposal metadata is incomplete");
          } else {
            selectedProposal = proposalMetadata(candidate);
            if (candidate.id !== proposal.id) blockers.push("selected proposal does not match packet proposal");
            if (!sameLineage(candidate.lineage, packet.lineage)) blockers.push("selected proposal lineage does not match blueprint");
            if (candidate.muxinDecision !== proposal.muxinDecision || candidate.muxinDecision !== learningView.muxinDecision) {
              blockers.push("selected proposal decision does not match the packet");
            }
            if (candidate.qualification !== "qualified" || candidate.status !== "qualified") {
              blockers.push("selected proposal is hypothesis-only");
            }
            if (candidate.readiness.status !== "ready") {
              blockers.push(...candidate.readiness.blockers);
              if (candidate.readiness.blockers.length === 0) blockers.push("selected proposal is blocked");
            }
            if (candidate.feedContext.blockers.length > 0) blockers.push(...candidate.feedContext.blockers);
          }
        }
      }
    }
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
    proposalId: explicitBundlePath ? (typeof input.proposalId === "string" ? input.proposalId : null) : proposal.id,
    selectedProposal,
    muxinDecision: proposal.muxinDecision,
    ventureGate: proposal.ventureGate,
    readiness: { status: ready ? "ready" : "blocked", blockers: uniqueBlockers },
    autoClaimsDemand: false,
    ventureArtifacts: false,
    sideEffects: "none",
  };
}

function completeProposal(value: LearningBundleProposal | undefined): value is LearningBundleProposal {
  if (value === undefined || value === null || typeof value !== "object") return false;
  return typeof value.id === "string"
    && completeLineage(value.lineage)
    && Array.isArray(value.basisRecordIds)
    && Array.isArray(value.feedContextIds)
    && Array.isArray(value.caveats)
    && value.feedContext !== null
    && typeof value.feedContext === "object"
    && Array.isArray(value.feedContext.ids)
    && Array.isArray(value.feedContext.blockers)
    && value.readiness !== null
    && typeof value.readiness === "object"
    && (value.readiness.status === "ready" || value.readiness.status === "blocked")
    && Array.isArray(value.readiness.blockers)
    && Array.isArray(value.basisHypotheses);
}

function proposalMetadata(proposal: LearningBundleProposal): VentureHandoffProposalMetadata {
  return {
    id: proposal.id,
    type: proposal.type,
    basisRecordIds: [...proposal.basisRecordIds],
    feedContextIds: [...proposal.feedContextIds],
    scope: proposal.scope,
    sampleSize: proposal.sampleSize,
    caveats: [...proposal.caveats],
    qualification: proposal.qualification,
    muxinDecision: proposal.muxinDecision,
    lineage: { ...proposal.lineage },
    basisHypotheses: proposal.basisHypotheses.map((hypothesis) => ({ ...hypothesis, evidenceRefs: [...hypothesis.evidenceRefs] })),
    feedContext: { ids: [...proposal.feedContext.ids], blockers: [...proposal.feedContext.blockers] },
    readiness: { status: proposal.readiness.status, blockers: [...proposal.readiness.blockers] },
    status: proposal.status,
  };
}

export const createVentureHandoffView = buildVentureHandoffView;
