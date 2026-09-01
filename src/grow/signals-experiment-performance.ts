import { buildExperimentOutcomeLedger, type ExperimentOutcomeLedger } from "./experiment-outcomes.js";
import { buildExperimentRecord, type ExperimentRecord, type SuccessObservation } from "./experiment-record.js";
import type { ExperimentPlan } from "./experiment-content-handoff.js";
import type { OutcomeLedger } from "./outcome-ledger.js";
import type { SignalsExperimentRecommendationInput } from "./experiment-slice.js";
import { brandForOrigin, type BrandId } from "../identity/brand.js";

export const SIGNALS_EXPERIMENT_PERFORMANCE_VERSION = "signals-experiment-performance-v1" as const;

export interface SignalsExperimentPerformanceInput {
  readonly recommendations: readonly SignalsExperimentRecommendationInput[];
  readonly records: readonly ExperimentRecord[];
  readonly ledgers: readonly ExperimentOutcomeLedger[];
  /** Immutable, evidence-linked measurements normalized from providers or an outcome ledger. */
  readonly metricFacts?: readonly ExperimentMetricFact[];
  readonly brandByExperiment?: Readonly<Record<string, BrandId | null>>;
  readonly now: string;
}

export interface ExperimentMetricFact {
  readonly id: string;
  readonly experimentId: string;
  readonly variantId: string;
  readonly family: SignalsExperimentRecommendationInput["primaryMetric"]["family"];
  readonly metric: string;
  readonly value: number;
  /** Number of comparable published units represented by this fact. */
  readonly sample: number;
  readonly observedAt: string;
  readonly evidenceRefs: readonly string[];
  readonly source: "provider-observation" | "outcome-ledger";
}

export interface ExperimentArmMeasurement {
  readonly variantId: string;
  readonly value: number;
  readonly sample: number;
}

export interface ExperimentMetricComparison {
  readonly family: ExperimentMetricFact["family"];
  readonly metric: string;
  readonly treatment: ExperimentArmMeasurement | null;
  readonly control: ExperimentArmMeasurement | null;
}

export interface ExperimentProviderPublication {
  readonly rowId: string;
  readonly state: string;
  readonly providerObjectId?: string | null;
  readonly canonicalUrl?: string | null;
  readonly providerPublishedAt?: string | null;
  readonly eventId: string;
  readonly providerAccountId?: string | null;
  readonly brandId?: BrandId | null;
}

export interface LiveExperimentPublication extends ExperimentProviderPublication {
  readonly slug: string;
  readonly at: string;
}

export interface ExperimentAnalyticsObservation {
  readonly id: string | number;
  readonly platformPostId: string | null;
  readonly url: string | null;
  readonly capturedAt: string;
  readonly impressions: number | null;
  readonly replies: number | null;
  readonly clicks: number | null;
  readonly newFollows: number | null;
  readonly providerAccountId?: string | null;
  readonly brandId?: BrandId | null;
}

export interface ProviderAnalyticsMetricInput {
  readonly experimentId: string;
  readonly variantIds: readonly string[];
  readonly requestedMetrics: readonly { readonly family: ExperimentMetricFact["family"]; readonly metric: string }[];
  readonly publications: readonly ExperimentProviderPublication[];
  readonly analytics: readonly ExperimentAnalyticsObservation[];
}

export interface OutcomeLedgerMetricInput {
  readonly experimentId: string;
  readonly variantIds: readonly string[];
  readonly requestedMetrics: readonly { readonly family: ExperimentMetricFact["family"]; readonly metric: string }[];
  readonly publications: readonly ExperimentProviderPublication[];
  readonly ledger: OutcomeLedger;
}

export interface LiveSignalsExperimentPerformanceInput {
  readonly plans: readonly ExperimentPlan[];
  readonly publications: readonly LiveExperimentPublication[];
  readonly analytics: readonly ExperimentAnalyticsObservation[];
  readonly outcomeLedger?: OutcomeLedger | null;
  readonly now: string;
}

export interface SignalsExperimentPerformanceRow {
  readonly experimentId: string;
  readonly brandId: BrandId | null;
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
  readonly primaryComparison: Pick<ExperimentMetricComparison, "treatment" | "control"> | null;
  readonly guardrailComparisons: ExperimentMetricComparison[];
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

function requiredText(value: string, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} is required`);
  return value.trim();
}

function normalizedFacts(facts: readonly ExperimentMetricFact[]): ExperimentMetricFact[] {
  const ids = new Set<string>();
  return facts.map((fact, index) => {
    const id = requiredText(fact.id, `metricFacts[${index}].id`);
    if (ids.has(id)) throw new Error(`duplicate experiment metric fact ${id}`);
    ids.add(id);
    if (!Number.isFinite(fact.value) || fact.value < 0) throw new Error(`metricFacts[${index}].value must be non-negative`);
    if (!Number.isInteger(fact.sample) || fact.sample < 1) throw new Error(`metricFacts[${index}].sample must be a positive integer`);
    if (Number.isNaN(Date.parse(fact.observedAt))) throw new Error(`metricFacts[${index}].observedAt must be a valid timestamp`);
    if (!Array.isArray(fact.evidenceRefs) || fact.evidenceRefs.length === 0) throw new Error(`metricFacts[${index}].evidenceRefs must not be empty`);
    if (fact.source !== "provider-observation" && fact.source !== "outcome-ledger") throw new Error(`metricFacts[${index}].source is invalid`);
    return {
      ...fact,
      id,
      experimentId: requiredText(fact.experimentId, `metricFacts[${index}].experimentId`),
      variantId: requiredText(fact.variantId, `metricFacts[${index}].variantId`),
      metric: requiredText(fact.metric, `metricFacts[${index}].metric`),
      evidenceRefs: [...new Set(fact.evidenceRefs.map((ref, refIndex) => requiredText(ref, `metricFacts[${index}].evidenceRefs[${refIndex}]`)))].sort(),
    };
  });
}

function armMeasurement(facts: readonly ExperimentMetricFact[], variantId: string): ExperimentArmMeasurement | null {
  const arm = facts.filter((fact) => fact.variantId === variantId);
  if (!arm.length) return null;
  const sample = arm.reduce((sum, fact) => sum + fact.sample, 0);
  const weighted = arm.reduce((sum, fact) => sum + fact.value * fact.sample, 0) / sample;
  return { variantId, value: Math.round(weighted * 1e12) / 1e12, sample };
}

function comparison(
  facts: readonly ExperimentMetricFact[],
  recommendation: SignalsExperimentRecommendationInput,
  family: ExperimentMetricFact["family"],
  metric: string,
): ExperimentMetricComparison {
  const matching = facts.filter((fact) => fact.family === family && fact.metric === metric);
  return {
    family,
    metric,
    treatment: armMeasurement(matching, recommendation.expectedOutcome.variantId),
    control: armMeasurement(matching, recommendation.expectedOutcome.comparisonRef),
  };
}

function supportedMetric(family: ExperimentMetricFact["family"], metric: string, row: ExperimentAnalyticsObservation): number | null {
  const allowed = new Set([
    "attention:impressions",
    "conversation:replies",
    "conversation:replies-per-1000-impressions",
    "audience:clicks",
    "audience:clicks-per-1000-impressions",
    "audience:new-follows",
    "audience:new-follows-per-1000-impressions",
  ]);
  if (!allowed.has(`${family}:${metric}`)) return null;
  const direct: Record<string, number | null> = {
    impressions: row.impressions,
    replies: row.replies,
    clicks: row.clicks,
    "new-follows": row.newFollows,
  };
  if (Object.hasOwn(direct, metric)) return direct[metric] ?? null;
  const perThousand: Record<string, number | null> = {
    "replies-per-1000-impressions": row.replies,
    "clicks-per-1000-impressions": row.clicks,
    "new-follows-per-1000-impressions": row.newFollows,
  };
  if (!Object.hasOwn(perThousand, metric)) return null;
  const numerator = perThousand[metric];
  if (numerator === null || row.impressions === null || row.impressions <= 0) return null;
  return Math.round((numerator / row.impressions) * 1000 * 1e12) / 1e12;
}

/**
 * Convert exact provider-object/URL matches to immutable metric facts. This deliberately supports
 * only fields the analytics schema actually measures; semantic reply quality and website visits
 * remain absent rather than being guessed from generic replies or clicks.
 */
export function buildMetricFactsFromProviderAnalytics(input: ProviderAnalyticsMetricInput): ExperimentMetricFact[] {
  const experimentId = requiredText(input.experimentId, "experimentId");
  const variants = new Set(input.variantIds.map((id, index) => requiredText(id, `variantIds[${index}]`)));
  const requested = [...new Map(input.requestedMetrics.map((item, index) => {
    const metric = requiredText(item.metric, `requestedMetrics[${index}].metric`);
    return [`${item.family}:${metric}`, { family: item.family, metric }] as const;
  })).values()];
  const facts: ExperimentMetricFact[] = [];
  const claimedAnalytics = new Map<string, string>();
  for (const publication of input.publications) {
    if (!["published", "delivered", "live"].includes(publication.state) || !variants.has(publication.rowId)) continue;
    const providerObjectId = publication.providerObjectId?.trim() || null;
    const canonicalUrl = publication.canonicalUrl?.trim() || null;
    if (!providerObjectId && !canonicalUrl) continue;
    const matches = input.analytics.filter((row) =>
      ((providerObjectId !== null && row.platformPostId === providerObjectId)
      || (canonicalUrl !== null && row.url === canonicalUrl))
      && (publication.providerAccountId === undefined && row.providerAccountId === undefined
        ? true
        : Boolean(publication.providerAccountId && row.providerAccountId && publication.providerAccountId === row.providerAccountId))
      && (publication.brandId === undefined && row.brandId === undefined
        ? true
        : Boolean(publication.brandId && row.brandId && publication.brandId === row.brandId)));
    if (!matches.length) continue;
    const latest = [...matches].sort((left, right) => Date.parse(right.capturedAt) - Date.parse(left.capturedAt))[0]!;
    if (Number.isNaN(Date.parse(latest.capturedAt))) throw new Error(`analytics ${latest.id} capturedAt is invalid`);
    const analyticsIdentity = String(latest.id);
    const priorVariant = claimedAnalytics.get(analyticsIdentity);
    if (priorVariant && priorVariant !== publication.rowId) throw new Error(`analytics ${analyticsIdentity} matches multiple experiment variants`);
    claimedAnalytics.set(analyticsIdentity, publication.rowId);
    for (const metric of requested) {
      const value = supportedMetric(metric.family, metric.metric, latest);
      if (value === null || !Number.isFinite(value) || value < 0) continue;
      facts.push({
        id: `provider:${experimentId}:${publication.rowId}:${metric.family}:${metric.metric}:${analyticsIdentity}`,
        experimentId,
        variantId: publication.rowId,
        family: metric.family,
        metric: metric.metric,
        value,
        sample: 1,
        observedAt: latest.capturedAt,
        evidenceRefs: [`analytics:metrics:${analyticsIdentity}:${latest.capturedAt}`, `provider:${requiredText(publication.eventId, "publication.eventId")}`].sort(),
        source: "provider-observation",
      });
    }
  }
  return facts.sort((left, right) => left.variantId.localeCompare(right.variantId)
    || left.family.localeCompare(right.family) || left.metric.localeCompare(right.metric) || left.id.localeCompare(right.id));
}

/** Convert canonical, explicitly attributed funnel/business rows to per-arm metric facts. */
export function buildMetricFactsFromOutcomeLedger(input: OutcomeLedgerMetricInput): ExperimentMetricFact[] {
  if (input.ledger.readiness.status !== "ready") return [];
  const experimentId = requiredText(input.experimentId, "experimentId");
  const variants = new Set(input.variantIds.map((id, index) => requiredText(id, `variantIds[${index}]`)));
  const requested = new Set(input.requestedMetrics.map((item, index) => `${item.family}:${requiredText(item.metric, `requestedMetrics[${index}].metric`)}`));
  const superseded = new Set(input.ledger.rows.map((row) => row.supersedesId).filter((id): id is string => id !== null));
  const measurableStatuses = new Set(["measured", "observed", "reported", "verified", "current"]);
  const facts: ExperimentMetricFact[] = [];
  for (const row of input.ledger.rows) {
    if (superseded.has(row.id) || !measurableStatuses.has(row.status) || row.value === null || row.value < 0) continue;
    const family: ExperimentMetricFact["family"] = row.family === "funnel" ? "audience" : "business";
    if (!requested.has(`${family}:${row.metric}`)) continue;
    const contentIds = [...new Set(row.attribution.map((touch) => touch.contentItemId).filter((id): id is string => id !== null))];
    if (contentIds.length !== 1) continue;
    const contentId = contentIds[0]!;
    const matches = input.publications.filter((publication) => variants.has(publication.rowId)
      && ["published", "delivered", "live"].includes(publication.state)
      && (publication.providerObjectId === contentId || publication.canonicalUrl === contentId));
    if (matches.length !== 1) continue;
    const publication = matches[0]!;
    facts.push({
      id: `outcome:${experimentId}:${publication.rowId}:${row.id}`,
      experimentId,
      variantId: publication.rowId,
      family,
      metric: row.metric,
      value: row.value,
      sample: 1,
      observedAt: row.observedAt,
      evidenceRefs: [...new Set([...row.evidenceRefs, `outcome:${row.id}`, `provider:${requiredText(publication.eventId, "publication.eventId")}`])].sort(),
      source: "outcome-ledger",
    });
  }
  return facts.sort((left, right) => left.variantId.localeCompare(right.variantId)
    || left.family.localeCompare(right.family) || left.metric.localeCompare(right.metric) || left.id.localeCompare(right.id));
}

/** Build the complete grouped read from approved plan identity plus current provider/analytics facts. */
export function buildLiveSignalsExperimentPerformance(input: LiveSignalsExperimentPerformanceInput): SignalsExperimentPerformanceView {
  const recommendations: SignalsExperimentRecommendationInput[] = [];
  const records: ExperimentRecord[] = [];
  const ledgers: ExperimentOutcomeLedger[] = [];
  const metricFacts: ExperimentMetricFact[] = [];
  const seen = new Set<string>();
  for (const plan of input.plans) {
    const recommendation = plan.recommendation;
    if (seen.has(recommendation.id)) throw new Error(`duplicate experiment plan ${recommendation.id}`);
    seen.add(recommendation.id);
    recommendations.push(recommendation);
    const variantIds = plan.contentRequest.variants.map((variant) => variant.identity.id);
    const publications = input.publications.filter((publication) => publication.slug === plan.contentRequest.id && variantIds.includes(publication.rowId));
    const requestedMetrics = [recommendation.primaryMetric, ...recommendation.guardrails.map(({ family, metric }) => ({ family, metric }))];
    const facts = buildMetricFactsFromProviderAnalytics({
      experimentId: recommendation.id, variantIds, requestedMetrics, publications, analytics: input.analytics,
    });
    const outcomeFacts = input.outcomeLedger ? buildMetricFactsFromOutcomeLedger({
      experimentId: recommendation.id, variantIds, requestedMetrics, publications, ledger: input.outcomeLedger,
    }) : [];
    metricFacts.push(...facts, ...outcomeFacts);
    const livePublications = publications.filter((publication) => ["published", "delivered", "live"].includes(publication.state));
    const startTimes = livePublications.map((publication) => publication.providerPublishedAt ?? publication.at)
      .filter((value) => !Number.isNaN(Date.parse(value))).sort();
    const variableOptions = new Map<string, Set<string>>();
    for (const variables of Object.values(plan.variablesByVariant)) for (const [name, option] of Object.entries(variables)) {
      const values = variableOptions.get(name) ?? new Set<string>();
      values.add(option); variableOptions.set(name, values);
    }
    const observations = [...new Map(requestedMetrics.map((metric) => [`${metric.family}:${metric.metric}`, metric])).values()];
    const outcomeRefs = [...new Set([...facts, ...outcomeFacts].flatMap((fact) => fact.evidenceRefs))].sort();
    const record = buildExperimentRecord({
      id: recommendation.id,
      question: recommendation.hypothesis,
      hypothesis: recommendation.hypothesis,
      unit: "published platform variant",
      comparison: { control: recommendation.expectedOutcome.comparisonRef, treatment: recommendation.expectedOutcome.variantId },
      variables: [...variableOptions.entries()].map(([name, options]) => ({ name, options: [...options] })),
      scope: {
        platform: [...new Set(plan.contentRequest.variants.map((variant) => variant.platform))],
        format: [...new Set(plan.contentRequest.variants.map((variant) => variant.media))],
        topic: [plan.contentRequest.descriptor],
        audience: [plan.contentRequest.origin],
      },
      lineage: {
        sourceRefs: [`content:${plan.contentRequest.id}`],
        variantRefs: variantIds,
        publishRefs: [...new Set(livePublications.map((publication) => publication.providerObjectId ?? `provider-event:${publication.eventId}`))],
        outcomeRefs,
      },
      successObservations: observations.map((metric) => ({
        id: `${recommendation.id}:${metric.family}:${metric.metric}`,
        family: metric.family,
        metric: metric.metric,
        measured: false,
      })),
      minimumSample: recommendation.minimumSample,
      reviewRule: `Review after ${recommendation.minimumSample} comparable units and ${recommendation.minimumDays} days.`,
      startAt: startTimes[0] ?? null,
      status: livePublications.length ? "running" : "proposed",
      winner: null,
    });
    records.push(record);
    ledgers.push(buildExperimentOutcomeLedger({ experiment: record, commentObservations: [], funnelEvents: [], businessOutcomes: [] }));
  }
  return buildSignalsExperimentPerformance({ recommendations, records, ledgers, metricFacts, brandByExperiment: Object.fromEntries(input.plans.map((plan) => {
    const derived = brandForOrigin(plan.contentRequest.origin);
    return [plan.recommendation.id, plan.brandId === derived ? derived : null];
  })), now: input.now });
}

/** Join multiple active experiment records without collapsing their metrics or selecting a winner. */
export function buildSignalsExperimentPerformance(input: SignalsExperimentPerformanceInput): SignalsExperimentPerformanceView {
  if (Number.isNaN(Date.parse(input.now))) throw new Error("now must be a valid timestamp");
  const facts = normalizedFacts(input.metricFacts ?? []);
  const records = byId(input.records, (item) => item.id, "experiment record");
  const ledgers = byId(input.ledgers, (item) => item.experimentId, "experiment outcome ledger");
  const recommendations = byId(input.recommendations, (item) => item.id, "experiment recommendation");
  const experiments = [...recommendations.values()].sort((left, right) => left.id.localeCompare(right.id)).map((recommendation): SignalsExperimentPerformanceRow => {
    const record = records.get(recommendation.id);
    const ledger = ledgers.get(recommendation.id);
    const experimentFacts = facts.filter((fact) => fact.experimentId === recommendation.id);
    const usesFacts = input.metricFacts !== undefined;
    const blockers: string[] = [];
    if (input.brandByExperiment && Object.hasOwn(input.brandByExperiment, recommendation.id) && input.brandByExperiment[recommendation.id] === null) blockers.push("experiment brand lineage is unassigned or inconsistent");
    if (!record) blockers.push("experiment record is missing");
    if (!ledger) blockers.push("experiment outcome ledger is missing");
    if (record && ledger && ledger.experimentId !== record.id) blockers.push("outcome ledger does not match experiment");
    if (ledger?.readiness.status === "blocked") blockers.push(...ledger.readiness.blockers);
    const observation = record?.successObservations.find((item) => item.family === recommendation.primaryMetric.family && item.metric === recommendation.primaryMetric.metric) ?? null;
    const primary = usesFacts ? comparison(experimentFacts, recommendation, recommendation.primaryMetric.family, recommendation.primaryMetric.metric) : null;
    const guardrails = usesFacts ? recommendation.guardrails.map((guardrail) => comparison(experimentFacts, recommendation, guardrail.family, guardrail.metric)) : [];
    if (usesFacts) {
      if (!primary?.treatment) blockers.push("primary metric treatment arm is missing");
      if (!primary?.control) blockers.push("primary metric comparison arm is missing");
      const factSample = (primary?.treatment?.sample ?? 0) + (primary?.control?.sample ?? 0);
      if (factSample < recommendation.minimumSample) blockers.push(`sample ${factSample} of ${recommendation.minimumSample}`);
      for (const guardrail of guardrails) {
        if (!guardrail.treatment || !guardrail.control) blockers.push(`guardrail ${guardrail.family}:${guardrail.metric} requires both controlled arms`);
      }
    } else if (!observation) blockers.push("primary metric observation is missing");
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
      brandId: input.brandByExperiment?.[recommendation.id] ?? null,
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
      primaryComparison: primary ? { treatment: primary.treatment, control: primary.control } : null,
      guardrailComparisons: guardrails,
      outcomeRefs: usesFacts
        ? [...new Set(experimentFacts.flatMap((fact) => fact.evidenceRefs))].sort()
        : record ? [...record.lineage.outcomeRefs].sort() : [],
      analysisStatus: terminal ?? (blockers.length ? "collecting" : "ready"),
      blockers: [...new Set(blockers)].sort(),
      winner: record?.winner ?? null,
      autoWinner: false,
    };
  });
  for (const id of records.keys()) if (!recommendations.has(id)) throw new Error(`experiment record ${id} has no Signals recommendation`);
  for (const id of ledgers.keys()) if (!recommendations.has(id)) throw new Error(`experiment outcome ledger ${id} has no Signals recommendation`);
  for (const fact of facts) if (!recommendations.has(fact.experimentId)) throw new Error(`experiment metric fact ${fact.id} has no Signals recommendation`);
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
