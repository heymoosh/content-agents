import type { ExperimentOutcomeLedger } from "./experiment-outcomes.js";
import type { ExperimentRecord, SuccessObservation } from "./experiment-record.js";
import type { SignalsExperimentRecommendationInput } from "./experiment-slice.js";

export const SIGNALS_EXPERIMENT_PERFORMANCE_VERSION = "signals-experiment-performance-v1" as const;

export interface SignalsExperimentPerformanceInput {
  readonly recommendations: readonly SignalsExperimentRecommendationInput[];
  readonly records: readonly ExperimentRecord[];
  readonly ledgers: readonly ExperimentOutcomeLedger[];
  readonly now: string;
}

export interface SignalsExperimentPerformanceRow {
  readonly experimentId: string;
  readonly confidence: SignalsExperimentRecommendationInput["confidence"];
  readonly hypothesis: string;
  readonly primaryMetric: SignalsExperimentRecommendationInput["primaryMetric"];
  readonly direction: SignalsExperimentRecommendationInput["expectedOutcome"]["direction"];
  readonly decisionRule: SignalsExperimentRecommendationInput["decisionRule"];
  readonly guardrails: SignalsExperimentRecommendationInput["guardrails"];
  readonly minimumSample: number;
  readonly minimumDays: number;
  readonly elapsedDays: number | null;
  readonly observation: SuccessObservation | null;
  readonly outcomeRefs: string[];
  readonly analysisStatus: "collecting" | "ready" | "closed" | "insufficient-evidence";
  readonly blockers: string[];
  readonly winner: ExperimentRecord["winner"];
  readonly autoWinner: false;
}

export interface SignalsExperimentPerformanceView {
  readonly kind: "signals_experiment_performance";
  readonly version: typeof SIGNALS_EXPERIMENT_PERFORMANCE_VERSION;
  readonly experiments: SignalsExperimentPerformanceRow[];
  readonly autoWinner: false;
  readonly sideEffects: "none";
}

function byId<T>(items: readonly T[], id: (item: T) => string, label: string): Map<string, T> {
  const result = new Map<string, T>();
  for (const item of items) {
    const key = id(item);
    if (result.has(key)) throw new Error(`duplicate ${label} ${key}`);
    result.set(key, item);
  }
  return result;
}

function elapsedDays(startAt: string | null, now: string): number | null {
  if (startAt === null) return null;
  const start = Date.parse(startAt), end = Date.parse(now);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) throw new Error("experiment performance timestamps are invalid");
  return Math.floor((end - start) / 86_400_000);
}

/** Join multiple active experiment records without collapsing their metrics or selecting a winner. */
export function buildSignalsExperimentPerformance(input: SignalsExperimentPerformanceInput): SignalsExperimentPerformanceView {
  if (Number.isNaN(Date.parse(input.now))) throw new Error("now must be a valid timestamp");
  const records = byId(input.records, (item) => item.id, "experiment record");
  const ledgers = byId(input.ledgers, (item) => item.experimentId, "experiment outcome ledger");
  const recommendations = byId(input.recommendations, (item) => item.id, "experiment recommendation");
  const experiments = [...recommendations.values()].sort((left, right) => left.id.localeCompare(right.id)).map((recommendation): SignalsExperimentPerformanceRow => {
    const record = records.get(recommendation.id);
    const ledger = ledgers.get(recommendation.id);
    const blockers: string[] = [];
    if (!record) blockers.push("experiment record is missing");
    if (!ledger) blockers.push("experiment outcome ledger is missing");
    if (record && ledger && ledger.experimentId !== record.id) blockers.push("outcome ledger does not match experiment");
    if (ledger?.readiness.status === "blocked") blockers.push(...ledger.readiness.blockers);
    const observation = record?.successObservations.find((item) => item.family === recommendation.primaryMetric.family && item.metric === recommendation.primaryMetric.metric) ?? null;
    if (!observation) blockers.push("primary metric observation is missing");
    else {
      if (!observation.measured) blockers.push("primary metric is not measured");
      if (observation.sample === null || observation.sample < recommendation.minimumSample) blockers.push(`sample ${observation.sample ?? 0} of ${recommendation.minimumSample}`);
      if (observation.value === null) blockers.push("primary metric value is missing");
    }
    const days = elapsedDays(record?.startAt ?? null, input.now);
    if (days === null || days < recommendation.minimumDays) blockers.push(`elapsed ${days ?? 0} of ${recommendation.minimumDays} days`);
    const terminal = record?.status === "closed" ? "closed" : record?.status === "insufficient-evidence" ? "insufficient-evidence" : null;
    return {
      experimentId: recommendation.id,
      confidence: recommendation.confidence,
      hypothesis: recommendation.hypothesis,
      primaryMetric: { ...recommendation.primaryMetric },
      direction: recommendation.expectedOutcome.direction,
      decisionRule: { ...recommendation.decisionRule },
      guardrails: recommendation.guardrails.map((item) => ({ ...item })),
      minimumSample: recommendation.minimumSample,
      minimumDays: recommendation.minimumDays,
      elapsedDays: days,
      observation: observation ? { ...observation, outcomeRefs: [...observation.outcomeRefs] } : null,
      outcomeRefs: record ? [...record.lineage.outcomeRefs].sort() : [],
      analysisStatus: terminal ?? (blockers.length ? "collecting" : "ready"),
      blockers: [...new Set(blockers)].sort(),
      winner: record?.winner ?? null,
      autoWinner: false,
    };
  });
  for (const id of records.keys()) if (!recommendations.has(id)) throw new Error(`experiment record ${id} has no Signals recommendation`);
  for (const id of ledgers.keys()) if (!recommendations.has(id)) throw new Error(`experiment outcome ledger ${id} has no Signals recommendation`);
  return { kind: "signals_experiment_performance", version: SIGNALS_EXPERIMENT_PERFORMANCE_VERSION, experiments, autoWinner: false, sideEffects: "none" };
}

/** Body-free science prompt for one mature experiment. The model interprets facts; it cannot close the record. */
export function buildSignalsExperimentInterpretationPrompt(row: SignalsExperimentPerformanceRow): string {
  if (row.analysisStatus !== "ready") throw new Error("experiment is not ready for Signals interpretation");
  return [
    "Return one JSON object only. Do not use markdown fences or write files.",
    "You are the Signals science editor. Interpret one controlled content experiment and recommend keep, revise, or reject against the original declared rule.",
    "Never infer a winner from missing outcomes, collapse outcome families, or turn correlation into causation. State caveats and uncertainty. No post copy is included.",
    "Return exactly: experimentId, recommendation (keep|revise|reject), rationale, evidenceRefs, confidence, caveats.",
    JSON.stringify(row),
  ].join("\n\n");
}
