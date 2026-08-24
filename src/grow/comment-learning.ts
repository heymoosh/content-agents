import type {
  BusinessOutcome,
  CommentObservation,
  CommentQualificationStatus,
  FunnelEvent,
  BlueprintLineage,
  Confidence,
  MuxinDecision,
} from "../review/learning-packet.js";

/** Structured operator view of learning signals. It contains no generated copy or writes. */
export const COMMENT_LEARNING_VIEW_VERSION = "grow-comment-learning-v1" as const;

export type CommentLearningHypothesisType = "product" | "lead";
export type CommentLearningQualification = CommentQualificationStatus;
export type CommentLearningSignal =
  | "qualified_comment"
  | "comment"
  | "visit"
  | "opt_in"
  | "survey_response"
  | "qualified_inquiry"
  | "call"
  | "opportunity"
  | "purchase";

export interface CommentLearningHypothesis {
  readonly id: string;
  readonly type: CommentLearningHypothesisType;
  readonly signal: CommentLearningSignal;
  readonly qualification: CommentLearningQualification;
  readonly confidence: Confidence;
  readonly lineage: BlueprintLineage;
  readonly evidenceRefs: string[];
  readonly sourceRecordIds: string[];
  readonly muxinDecision: MuxinDecision;
}

export interface CommentLearningViewInput {
  readonly commentObservations: readonly CommentObservation[];
  readonly funnelEvents: readonly FunnelEvent[];
  readonly businessOutcomes: readonly BusinessOutcome[];
  readonly muxinDecision?: MuxinDecision;
}

export interface CommentLearningView {
  readonly kind: "grow_comment_learning_view";
  readonly version: typeof COMMENT_LEARNING_VIEW_VERSION;
  readonly hypotheses: CommentLearningHypothesis[];
  readonly muxinDecision: MuxinDecision;
  readonly readiness: { status: "ready" | "blocked"; blockers: string[] };
  readonly autoClaimsDemand: false;
  readonly ventureArtifacts: false;
  readonly sideEffects: "none";
}

function evidenceRefs(record: { evidence: { refs: readonly string[] } }): string[] {
  return [...new Set(record.evidence.refs)].sort((left, right) => left.localeCompare(right));
}

function confidence(record: { interpretation: { confidence: Confidence } | null }): Confidence {
  return record.interpretation?.confidence ?? "low";
}

function funnelQualification(eventType: FunnelEvent["observation"]["eventType"]): CommentLearningQualification {
  if (eventType === "visit") return "not_qualified";
  if (eventType === "qualified_inquiry" || eventType === "call" || eventType === "opportunity" || eventType === "purchase") {
    return "qualified";
  }
  return "uncertain";
}

function funnelType(eventType: FunnelEvent["observation"]["eventType"]): CommentLearningHypothesisType {
  return eventType === "purchase" ? "product" : "lead";
}

function businessType(outcomeType: BusinessOutcome["observation"]["outcomeType"]): CommentLearningHypothesisType {
  return outcomeType === "purchase" ? "product" : "lead";
}

function commentHypothesis(record: CommentObservation, muxinDecision: MuxinDecision): CommentLearningHypothesis {
  return {
    id: record.id,
    type: "product",
    signal: record.qualification.status === "qualified" ? "qualified_comment" : "comment",
    qualification: record.qualification.status,
    confidence: record.interpretation.confidence,
    lineage: { ...record.lineage },
    evidenceRefs: evidenceRefs(record),
    sourceRecordIds: [record.id],
    muxinDecision,
  };
}

function funnelHypothesis(record: FunnelEvent, muxinDecision: MuxinDecision): CommentLearningHypothesis {
  return {
    id: record.id,
    type: funnelType(record.observation.eventType),
    signal: record.observation.eventType,
    qualification: funnelQualification(record.observation.eventType),
    confidence: confidence(record),
    lineage: { ...record.lineage },
    evidenceRefs: evidenceRefs(record),
    sourceRecordIds: [record.id],
    muxinDecision,
  };
}

function businessHypothesis(record: BusinessOutcome, muxinDecision: MuxinDecision): CommentLearningHypothesis {
  return {
    id: record.id,
    type: businessType(record.observation.outcomeType),
    signal: record.observation.outcomeType,
    qualification: "qualified",
    confidence: confidence(record),
    lineage: { ...record.lineage },
    evidenceRefs: evidenceRefs(record),
    sourceRecordIds: [record.id],
    muxinDecision,
  };
}

function evidenceBlockers(records: readonly ({ id: string; evidence: { status: string; refs: readonly string[] } })[]): string[] {
  const blockers: string[] = [];
  for (const record of records) {
    if (record.evidence.status === "missing" || record.evidence.refs.length === 0) {
      blockers.push(`${record.id} evidence is missing`);
    }
  }
  return blockers;
}

/**
 * Project supplied facts into reviewable product/lead hypotheses. This never infers demand,
 * composes body copy, creates Venture artifacts, or mutates the supplied records.
 */
export function buildCommentLearningView(input: CommentLearningViewInput): CommentLearningView {
  const muxinDecision = input.muxinDecision ?? "pending";
  const hypotheses = [
    ...input.commentObservations.map((record) => commentHypothesis(record, muxinDecision)),
    ...input.funnelEvents.map((record) => funnelHypothesis(record, muxinDecision)),
    ...input.businessOutcomes.map((record) => businessHypothesis(record, muxinDecision)),
  ].sort((left, right) => left.id.localeCompare(right.id));
  const records = [...input.commentObservations, ...input.funnelEvents, ...input.businessOutcomes];
  const blockers = [...new Set(evidenceBlockers(records))].sort((left, right) => left.localeCompare(right));

  return {
    kind: "grow_comment_learning_view",
    version: COMMENT_LEARNING_VIEW_VERSION,
    hypotheses,
    muxinDecision,
    readiness: { status: blockers.length === 0 ? "ready" : "blocked", blockers },
    autoClaimsDemand: false,
    ventureArtifacts: false,
    sideEffects: "none",
  };
}

export const createCommentLearningView = buildCommentLearningView;
