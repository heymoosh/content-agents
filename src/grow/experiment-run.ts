import { buildExperimentRecord, type ExperimentRecord } from "./experiment-record.js";
import type { GrowExperimentScheduleAttempt } from "./experiment-scheduling.js";
import { buildGrowExperimentDecision, type GrowExperimentDecisionInput, type GrowExperimentProposal } from "./experiment-slice.js";

export const GROW_EXPERIMENT_RUN_VERSION = "grow-experiment-run-v1" as const;

export interface GrowExperimentRun {
  readonly kind: "grow_experiment_run";
  readonly version: typeof GROW_EXPERIMENT_RUN_VERSION;
  readonly proposalDigest: string;
  readonly experimentRecord: ExperimentRecord;
  readonly deliveryIds: string[];
  readonly providerReferences: string[];
  readonly readiness: { readonly status: "ready"; readonly blockers: [] };
  readonly autoWinner: false;
  readonly autoVentureHandoff: false;
  readonly sideEffects: "none";
}

function timestamp(value: string, field: string): string {
  if (Number.isNaN(Date.parse(value))) throw new Error(`${field} must be a valid timestamp`);
  return value;
}

/** Convert explicit successful scheduler observations into the canonical running experiment. */
export function buildGrowExperimentRun(
  proposal: GrowExperimentProposal,
  decisionInput: GrowExperimentDecisionInput,
  attempts: readonly GrowExperimentScheduleAttempt[],
): GrowExperimentRun {
  const decision = buildGrowExperimentDecision(proposal, decisionInput);
  if (!Array.isArray(attempts) || attempts.length === 0) throw new Error("at least one successful scheduling attempt is required");
  const approved = new Map(decision.approvedRecords.map((record) => [record.variantId, record]));
  const seen = new Set<string>();
  const deliveryIds = new Set<string>();
  const providerReferences = new Set<string>();
  const normalized = attempts.map((attempt, index) => {
    if (!attempt || attempt.kind !== "grow_experiment_schedule_attempt"
      || attempt.version !== "grow-experiment-scheduling-v1" || attempt.attempted !== true) {
      throw new Error(`attempts[${index}] kind or version is unsupported`);
    }
    if (attempt.proposalDigest !== proposal.digest) throw new Error(`attempts[${index}] proposal digest does not match`);
    if (seen.has(attempt.variantId)) throw new Error(`duplicate scheduling attempt for ${attempt.variantId}`);
    seen.add(attempt.variantId);
    const record = approved.get(attempt.variantId);
    if (!record) throw new Error(`attempts[${index}] does not identify an approved unchanged variant`);
    if (attempt.scheduleError !== null || !["planned", "delivered", "live"].includes(attempt.publishing.state)) {
      throw new Error(`attempts[${index}] is not a successful provider scheduling observation`);
    }
    if (attempt.binding.readiness.status !== "ready" || (attempt.binding.status !== "scheduled" && attempt.binding.status !== "live_confirmed")) {
      throw new Error(`attempts[${index}] lacks a ready scheduled binding`);
    }
    if (attempt.binding.candidateId !== attempt.variantId) throw new Error(`attempts[${index}] binding candidate does not match`);
    if (deliveryIds.has(attempt.binding.deliveryId)) throw new Error(`duplicate delivery id ${attempt.binding.deliveryId}`);
    deliveryIds.add(attempt.binding.deliveryId);
    const lineage = attempt.binding.lineage;
    if (!lineage || lineage.sourceId !== proposal.source.id || lineage.cutId !== proposal.cut.id
      || lineage.variantId !== record.variantId || lineage.treatmentId !== record.treatmentRef
      || lineage.experimentId !== proposal.experiment.id) {
      throw new Error(`attempts[${index}] binding lineage does not match the approved experiment`);
    }
    const providerReference = attempt.publishing.providerObjectId ?? attempt.publishing.ref;
    if (!providerReference || providerReference !== attempt.binding.providerFacts?.reference) {
      throw new Error(`attempts[${index}] provider reference is missing or drifted`);
    }
    if (providerReferences.has(providerReference)) throw new Error(`duplicate provider reference ${providerReference}`);
    providerReferences.add(providerReference);
    const plannedFor = attempt.publishing.plannedFor;
    if (!plannedFor || plannedFor !== attempt.binding.providerFacts?.scheduledAt || Number.isNaN(Date.parse(plannedFor))) {
      throw new Error(`attempts[${index}] planned timestamp is missing or drifted`);
    }
    if (attempt.publishing.deliveryMode !== "provider") throw new Error(`attempts[${index}] is not provider delivery`);
    const observedAt = timestamp(attempt.publishing.at, `attempts[${index}].publishing.at`);
    if (Date.parse(observedAt) < Date.parse(decision.review.decidedAt)) throw new Error(`attempts[${index}] predates Muxin's decision`);
    return {
      attempt,
      record,
      providerReference,
      observedAt,
    };
  }).sort((left, right) => left.record.variantId.localeCompare(right.record.variantId));

  const variantIds = normalized.map((item) => item.record.variantId);
  const scheduledVariantIds = new Set(variantIds);
  const selectedVariants = variantIds.map((id) => proposal.variants.find((variant) => variant.id === id)!);
  const variableOptions = new Map<string, Set<string>>();
  for (const variant of selectedVariants) for (const [name, option] of Object.entries(variant.experimentVariables)) {
    const options = variableOptions.get(name) ?? new Set<string>(); options.add(option); variableOptions.set(name, options);
  }
  const experimentRecord = buildExperimentRecord({
    id: proposal.experimentRecord.id,
    question: proposal.experimentRecord.question,
    hypothesis: proposal.experimentRecord.hypothesis,
    unit: proposal.experimentRecord.unit,
    comparison: {
      ...(proposal.experimentRecord.comparison.control !== null && scheduledVariantIds.has(proposal.experimentRecord.comparison.control)
        ? { control: proposal.experimentRecord.comparison.control } : {}),
      ...(proposal.experimentRecord.comparison.treatment !== null && scheduledVariantIds.has(proposal.experimentRecord.comparison.treatment)
        ? { treatment: proposal.experimentRecord.comparison.treatment } : {}),
    },
    variables: [...variableOptions].map(([name, options]) => ({ name, options: [...options] })),
    scope: {
      platform: selectedVariants.map((variant) => variant.platform),
      format: selectedVariants.map((variant) => variant.format),
      topic: proposal.experimentRecord.scope.topic,
      audience: proposal.experimentRecord.scope.audience,
    },
    lineage: {
      sourceRefs: [proposal.source.id], variantRefs: variantIds,
      publishRefs: normalized.map((item) => item.providerReference), outcomeRefs: [],
    },
    successObservations: proposal.experimentRecord.successObservations,
    minimumSample: proposal.experimentRecord.minimumSample,
    reviewRule: proposal.experimentRecord.reviewRule,
    startAt: normalized.map((item) => item.observedAt).sort()[0]!,
    endAt: null,
    status: "running",
    winner: null,
  });
  return {
    kind: "grow_experiment_run", version: GROW_EXPERIMENT_RUN_VERSION, proposalDigest: proposal.digest,
    experimentRecord,
    deliveryIds: normalized.map((item) => item.attempt.binding.deliveryId),
    providerReferences: normalized.map((item) => item.providerReference),
    readiness: { status: "ready", blockers: [] },
    autoWinner: false, autoVentureHandoff: false, sideEffects: "none",
  };
}
