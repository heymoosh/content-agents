import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { migrateLegacyDataFile } from "../runtime/data-root.js";
import { withFileLock } from "../runtime/file-lock.js";
import type { AppliedExperimentContentHandoff, ExperimentPlan, ExperimentPlanDecision } from "../grow/experiment-content-handoff.js";
import { assertVentureExperimentPlanIntegrity, type VentureExperimentContext, type VentureExperimentPlan } from "./venture-experiment-handoff.js";

export const SIGNALS_EXPERIMENT_PLANS_PATH = migrateLegacyDataFile(["signals-experiment-plans.jsonl"]);

type PlanEvent =
  | { kind: "proposal"; id: string; at: string; plan: ExperimentPlan; ventureContext?: VentureExperimentContext; ventureEnvelopeDigest?: string }
  | { kind: "decision"; id: string; at: string; decision: ExperimentPlanDecision }
  | { kind: "content-handoff"; id: string; at: string; handoff: Pick<AppliedExperimentContentHandoff, "experimentId" | "generatedIds" | "copyApproval"> };

interface FoldedExperimentPlan {
  plan: ExperimentPlan;
  ventureContext: VentureExperimentContext | null;
  ventureEnvelopeDigest: string | null;
  decision: ExperimentPlanDecision | null;
  handoff: Pick<AppliedExperimentContentHandoff, "experimentId" | "generatedIds" | "copyApproval"> | null;
}

export interface SignalsExperimentPlanRead {
  readonly experimentId: string;
  readonly contentRequestId: string;
  readonly confidence: ExperimentPlan["recommendation"]["confidence"];
  readonly evidenceRefs: string[];
  readonly observation: string;
  readonly interpretation: string;
  readonly priority: ExperimentPlan["priority"];
  readonly priorityReason: string;
  readonly hypothesis: string;
  readonly expectedOutcome: ExperimentPlan["recommendation"]["expectedOutcome"];
  readonly controlledVariable: string;
  readonly whyThisInput: string;
  readonly constants: string[];
  readonly primaryMetric: ExperimentPlan["recommendation"]["primaryMetric"];
  readonly guardrails: ExperimentPlan["recommendation"]["guardrails"];
  readonly minimumSample: number;
  readonly minimumDays: number;
  readonly decisionRule: ExperimentPlan["recommendation"]["decisionRule"];
  readonly caveats: string[];
  readonly capacityRationale: string;
  readonly capacity: ExperimentPlan["capacity"];
  readonly status: "proposed" | "deferred" | "declined" | "plan-approved" | "drafts-pending-content-review";
  readonly planDecision: ExperimentPlanDecision | null;
  readonly generatedIds: string[];
  readonly sourceBodyIncluded: false;
  readonly generatedCopyIncluded: false;
  readonly ventureContext: VentureExperimentContext | null;
}

function readEvents(path: string): PlanEvent[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter(Boolean).map((line, index) => {
    try { return JSON.parse(line) as PlanEvent; }
    catch { throw new Error(`Signals experiment plan ledger line ${index + 1} is invalid JSON`); }
  });
}

function fold(path: string): Map<string, FoldedExperimentPlan> {
  const result = new Map<string, FoldedExperimentPlan>();
  for (const event of readEvents(path)) {
    if (event.kind === "proposal") {
      const prior = result.get(event.id);
      if (prior && (prior.plan.digest !== event.plan.digest || JSON.stringify(prior.ventureContext) !== JSON.stringify(event.ventureContext ?? null) || prior.ventureEnvelopeDigest !== (event.ventureEnvelopeDigest ?? null))) throw new Error(`conflicting experiment plan ${event.id}`);
      if (!prior) result.set(event.id, { plan: event.plan, ventureContext: event.ventureContext ?? null, ventureEnvelopeDigest: event.ventureEnvelopeDigest ?? null, decision: null, handoff: null });
      continue;
    }
    const row = result.get(event.id);
    if (!row) throw new Error(`experiment plan event precedes proposal ${event.id}`);
    if (event.kind === "decision") {
      if (row.decision && row.decision.digest !== event.decision.digest) throw new Error(`conflicting experiment plan decision ${event.id}`);
      row.decision = event.decision;
    } else {
      if (row.handoff && JSON.stringify(row.handoff) !== JSON.stringify(event.handoff)) throw new Error(`conflicting experiment Content handoff ${event.id}`);
      row.handoff = event.handoff;
    }
  }
  return result;
}

function append(path: string, event: PlanEvent): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(event) + "\n", { encoding: "utf8", mode: 0o600 });
}

export function recordExperimentPlan(plan: ExperimentPlan, path: string = SIGNALS_EXPERIMENT_PLANS_PATH): ExperimentPlan {
  return withFileLock(`${path}.lock`, () => {
    const prior = fold(path).get(plan.recommendation.id);
    if (prior) {
      if (prior.plan.digest !== plan.digest || prior.ventureContext !== null) throw new Error(`conflicting experiment plan ${plan.recommendation.id}`);
      return prior.plan;
    }
    append(path, { kind: "proposal", id: plan.recommendation.id, at: new Date().toISOString(), plan });
    return plan;
  });
}

/** Persist a Venture-origin plan in the same queue while retaining its reviewed learning lineage. */
export function recordVentureExperimentPlan(envelope: VentureExperimentPlan, path: string = SIGNALS_EXPERIMENT_PLANS_PATH): ExperimentPlan {
  if (envelope.kind !== "venture_experiment_plan" || envelope.version !== "venture-experiment-handoff-v1") throw new Error("invalid Venture experiment envelope");
  if (envelope.planApproval !== "pending-muxin" || envelope.copyApproval !== "pending-in-content") throw new Error("Venture experiment approval gates are invalid");
  if (!/^sha256:[a-f0-9]{64}$/.test(envelope.digest)) throw new Error("Venture experiment envelope digest is invalid");
  assertVentureExperimentPlanIntegrity(envelope);
  return withFileLock(`${path}.lock`, () => {
    const id = envelope.plan.recommendation.id;
    const prior = fold(path).get(id);
    if (prior) {
      if (prior.plan.digest !== envelope.plan.digest || prior.ventureEnvelopeDigest !== envelope.digest || JSON.stringify(prior.ventureContext) !== JSON.stringify(envelope.ventureContext)) throw new Error(`conflicting experiment plan ${id}`);
      return prior.plan;
    }
    append(path, { kind: "proposal", id, at: new Date().toISOString(), plan: envelope.plan, ventureContext: envelope.ventureContext, ventureEnvelopeDigest: envelope.digest });
    return envelope.plan;
  });
}

export function loadExperimentPlan(id: string, path: string = SIGNALS_EXPERIMENT_PLANS_PATH): ExperimentPlan {
  return withFileLock(`${path}.lock`, () => {
    const row = fold(path).get(id);
    if (!row) throw new Error(`unknown experiment plan ${id}`);
    return row.plan;
  });
}

export function loadExperimentPlanDecision(id: string, path: string = SIGNALS_EXPERIMENT_PLANS_PATH): ExperimentPlanDecision | null {
  return withFileLock(`${path}.lock`, () => {
    const row = fold(path).get(id);
    if (!row) throw new Error(`unknown experiment plan ${id}`);
    return row.decision ? { ...row.decision } : null;
  });
}

export function reviewExperimentPlan(id: string, decision: ExperimentPlanDecision, path: string = SIGNALS_EXPERIMENT_PLANS_PATH): ExperimentPlanDecision {
  return withFileLock(`${path}.lock`, () => {
    const row = fold(path).get(id);
    if (!row) throw new Error(`unknown experiment plan ${id}`);
    if (row.decision) throw new Error(`experiment plan ${id} was already reviewed`);
    if (decision.proposalDigest !== row.plan.digest) throw new Error("experiment plan decision does not match proposal");
    append(path, { kind: "decision", id, at: decision.decidedAt, decision });
    return decision;
  });
}

export function markExperimentContentHandoff(
  id: string,
  handoff: Pick<AppliedExperimentContentHandoff, "experimentId" | "generatedIds" | "copyApproval">,
  path: string = SIGNALS_EXPERIMENT_PLANS_PATH,
): void {
  withFileLock(`${path}.lock`, () => {
    const row = fold(path).get(id);
    if (!row?.decision || row.decision.status !== "approved") throw new Error("approved experiment plan decision is required before recording Content handoff");
    if (handoff.experimentId !== id || handoff.copyApproval !== "pending-in-content") throw new Error("experiment Content handoff identity or approval state is invalid");
    if (row.handoff) {
      if (JSON.stringify(row.handoff) !== JSON.stringify(handoff)) throw new Error(`conflicting experiment Content handoff ${id}`);
      return;
    }
    append(path, { kind: "content-handoff", id, at: new Date().toISOString(), handoff: { ...handoff, generatedIds: [...handoff.generatedIds] } });
  });
}

export function readExperimentPlans(path: string = SIGNALS_EXPERIMENT_PLANS_PATH): SignalsExperimentPlanRead[] {
  return withFileLock(`${path}.lock`, () => [...fold(path).values()].map((row): SignalsExperimentPlanRead => {
    const capacity = row.plan.capacity ?? { availablePublishingUnits: 0, availableDays: 0, sufficient: false };
    const effectivePriority = capacity.sufficient ? row.plan.priority : "deferred";
    const status = row.handoff ? "drafts-pending-content-review"
      : row.decision?.status === "approved" ? "plan-approved"
        : row.decision?.status === "declined" ? "declined"
          : effectivePriority === "deferred" ? "deferred" : "proposed";
    return {
      experimentId: row.plan.recommendation.id,
      contentRequestId: row.plan.contentRequest.id,
      confidence: row.plan.recommendation.confidence,
      evidenceRefs: [...row.plan.recommendation.evidenceRefs],
      observation: row.plan.recommendation.observation,
      interpretation: row.plan.recommendation.interpretation,
      priority: effectivePriority,
      priorityReason: capacity.sufficient
        ? row.plan.priorityReason
        : row.plan.capacity
          ? "Deferred because declared publishing capacity is insufficient for the minimum sample or duration."
          : "Deferred because this legacy plan has no declared publishing capacity.",
      hypothesis: row.plan.recommendation.hypothesis,
      expectedOutcome: { ...row.plan.recommendation.expectedOutcome },
      controlledVariable: row.plan.recommendation.controlledVariable,
      whyThisInput: row.plan.recommendation.whyThisInput,
      constants: [...row.plan.recommendation.constants],
      primaryMetric: { ...row.plan.recommendation.primaryMetric },
      guardrails: row.plan.recommendation.guardrails.map((item) => ({ ...item })),
      minimumSample: row.plan.recommendation.minimumSample,
      minimumDays: row.plan.recommendation.minimumDays,
      decisionRule: { ...row.plan.recommendation.decisionRule },
      caveats: [...row.plan.recommendation.caveats],
      capacityRationale: row.plan.recommendation.capacityRationale,
      capacity: { ...capacity },
      status,
      planDecision: row.decision ? { ...row.decision } : null,
      generatedIds: row.handoff ? [...row.handoff.generatedIds] : [],
      sourceBodyIncluded: false,
      generatedCopyIncluded: false,
      ventureContext: row.ventureContext ? { ...row.ventureContext, evidenceRefs: [...row.ventureContext.evidenceRefs], caveats: [...row.ventureContext.caveats] } : null,
    };
  }).sort((left, right) => {
    const priority = { high: 0, medium: 1, deferred: 2 } as const;
    return priority[left.priority] - priority[right.priority] || left.experimentId.localeCompare(right.experimentId);
  }));
}

/** Full body-bearing plans are server-internal and become measurable only after Content handoff. */
export function readExperimentPlansForPerformance(path: string = SIGNALS_EXPERIMENT_PLANS_PATH): ExperimentPlan[] {
  if (!existsSync(path)) return [];
  return withFileLock(`${path}.lock`, () => [...fold(path).values()]
    .filter((row) => row.decision?.status === "approved" && row.handoff !== null)
    .map((row) => row.plan)
    .sort((left, right) => left.recommendation.id.localeCompare(right.recommendation.id)));
}
