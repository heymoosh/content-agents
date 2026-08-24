import type { BusinessOutcome, BlueprintLineage, CommentObservation, FunnelEvent, VentureInputProposal } from "../review/learning-packet.js";
import type { ExperimentRecord, OutcomeFamily } from "./experiment-record.js";

/** Pure measurement join for the experiment -> learning -> Venture boundary. */
export const EXPERIMENT_OUTCOME_LEDGER_VERSION = "grow-experiment-outcome-ledger-v1" as const;

export interface ExperimentOutcomeLedgerInput {
  readonly experiment: ExperimentRecord;
  readonly commentObservations: readonly CommentObservation[];
  readonly funnelEvents: readonly FunnelEvent[];
  readonly businessOutcomes: readonly BusinessOutcome[];
  readonly ventureInputProposal?: VentureInputProposal | null;
}

export interface ExperimentOutcomeLink {
  readonly recordKind: "comment_observation" | "funnel_event" | "business_outcome";
  readonly recordId: string;
  readonly family: "conversation" | "audience" | "business";
  readonly lineage: BlueprintLineage;
  readonly evidenceStatus: string;
  readonly evidenceRefs: string[];
  readonly caveats: string[];
}

export interface ExperimentDeclaredObservation {
  readonly id: string;
  readonly family: OutcomeFamily;
  readonly metric: string;
  readonly measured: boolean;
  readonly sample: number | null;
  readonly minimumSample: number;
  readonly outcomeRefs: string[];
}

export interface ExperimentOutcomeLedger {
  readonly kind: "grow_experiment_outcome_ledger";
  readonly version: typeof EXPERIMENT_OUTCOME_LEDGER_VERSION;
  readonly experimentId: string;
  readonly sourceIds: string[];
  readonly variantIds: string[];
  readonly links: ExperimentOutcomeLink[];
  readonly declaredObservations: ExperimentDeclaredObservation[];
  readonly familyCounts: Record<OutcomeFamily, number>;
  readonly winner: ExperimentRecord["winner"];
  readonly venture: {
    readonly proposalId: string | null;
    readonly muxinDecision: string | null;
    readonly ventureGate: string | null;
  };
  readonly readiness: { status: "ready" | "blocked"; blockers: string[] };
  readonly autoWinner: false;
  readonly sideEffects: "none";
}

function sameLineage(
  lineage: BlueprintLineage,
  experiment: ExperimentRecord,
): boolean {
  return experiment.id === lineage.experimentId
    && experiment.lineage.sourceRefs.includes(lineage.sourceId)
    && experiment.lineage.variantRefs.includes(lineage.variantId);
}

function missingEvidence(record: { evidence: { status: string; refs: readonly string[] } }): boolean {
  return record.evidence.status === "missing" || record.evidence.refs.length === 0;
}

function link(
  record: CommentObservation | FunnelEvent | BusinessOutcome,
  family: ExperimentOutcomeLink["family"],
  experiment: ExperimentRecord,
): ExperimentOutcomeLink & { lineageOk: boolean; evidenceMissing: boolean } {
  return {
    recordKind: record.kind,
    recordId: record.id,
    family,
    lineage: { ...record.lineage },
    evidenceStatus: record.evidence.status,
    evidenceRefs: [...record.evidence.refs].sort(),
    caveats: [...record.caveats].sort(),
    lineageOk: sameLineage(record.lineage, experiment),
    evidenceMissing: missingEvidence(record),
  };
}

/**
 * Link already-normalized observations to one experiment. The ledger reports readiness only;
 * it never changes experiment status, closes a test, declares a winner, or writes a Venture row.
 */
export function buildExperimentOutcomeLedger(input: ExperimentOutcomeLedgerInput): ExperimentOutcomeLedger {
  const conversation = input.commentObservations.map((record) => link(record, "conversation", input.experiment));
  const audience = input.funnelEvents.map((record) => link(record, "audience", input.experiment));
  const business = input.businessOutcomes.map((record) => link(record, "business", input.experiment));
  const internal = [...conversation, ...audience, ...business].sort((left, right) =>
    left.family.localeCompare(right.family) || left.recordId.localeCompare(right.recordId));
  const blockers: string[] = [];
  const seenIds = new Set<string>();
  for (const record of internal) {
    if (seenIds.has(record.recordId)) blockers.push(`duplicate outcome record ${record.recordId}`);
    seenIds.add(record.recordId);
    if (!record.lineageOk) blockers.push(`${record.recordId} lineage does not match experiment`);
    if (record.evidenceMissing) blockers.push(`${record.recordId} evidence is missing`);
  }
  const venture = input.ventureInputProposal ?? null;
  if (venture && !sameLineage(venture.lineage, input.experiment)) blockers.push("Venture proposal lineage does not match experiment");

  const declaredObservations = input.experiment.successObservations.map((observation) => ({
    id: observation.id,
    family: observation.family,
    metric: observation.metric,
    measured: observation.measured,
    sample: observation.sample,
    minimumSample: input.experiment.minimumSample,
    outcomeRefs: [...observation.outcomeRefs].sort(),
  }));
  const familyCounts: Record<OutcomeFamily, number> = { attention: 0, conversation: 0, audience: 0, business: 0 };
  for (const record of internal) familyCounts[record.family] += 1;

  return {
    kind: "grow_experiment_outcome_ledger",
    version: EXPERIMENT_OUTCOME_LEDGER_VERSION,
    experimentId: input.experiment.id,
    sourceIds: [...input.experiment.lineage.sourceRefs].sort(),
    variantIds: [...input.experiment.lineage.variantRefs].sort(),
    links: internal.map(({ lineageOk: _lineageOk, evidenceMissing: _evidenceMissing, ...record }) => record),
    declaredObservations,
    familyCounts,
    winner: input.experiment.winner,
    venture: {
      proposalId: venture?.id ?? null,
      muxinDecision: venture?.muxinDecision ?? null,
      ventureGate: venture?.ventureGate ?? null,
    },
    readiness: { status: blockers.length === 0 ? "ready" : "blocked", blockers: [...new Set(blockers)] },
    autoWinner: false,
    sideEffects: "none",
  };
}

export const createExperimentOutcomeLedger = buildExperimentOutcomeLedger;
