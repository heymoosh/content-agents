/**
 * The smallest plan shape needed by this planning-only seam. Keeping the shape structural means
 * the manifest can be used by the orchestrator without making the manifest read source bodies or
 * depend on any queue/publish implementation.
 */
interface GrowPlan {
  source: {
    descriptor: unknown;
    preservation: "required";
    provenance: "descriptor-retained";
  };
  platforms: readonly string[];
  reviewGate: {
    required: true;
    before: "publish";
    approvalOwner: "human";
  };
  experiment: {
    variables: readonly { name: string; options: readonly string[] }[];
    id?: string | null;
    experimentId?: string | null;
  };
}

export type GrowEvidenceStatus = "supported" | "hypothesis" | "insufficient" | "blocked";
export type GrowReviewState = "pending" | "passed" | "failed" | "not-run";
export type GrowReviewStateInput = GrowReviewState | { status: string };
export type GrowEvidencePool = "niche" | "broad" | "format";

export interface GrowMetricSnapshot {
  readonly [key: string]: unknown;
}

/** A source/post-level pattern reference, not a copied creator body or exact creator wording. */
export interface GrowPatternEvidenceRef {
  patternId: string;
  sourceId: string;
  evidenceLocation: string;
  pool: GrowEvidencePool;
  scope: string;
  metricSnapshot: GrowMetricSnapshot;
  selectionRule: string;
  originalityReview: GrowReviewState;
  caveats: string[];
}

/** Accept camelCase and the contract's serialized snake_case spelling at the boundary. */
export interface GrowPatternEvidenceRefInput {
  patternId?: string;
  pattern_id?: string;
  sourceId?: string;
  source_id?: string;
  evidenceLocation?: string;
  evidence_location?: string;
  pool?: string;
  scope?: string;
  metricSnapshot?: GrowMetricSnapshot;
  metric_snapshot?: GrowMetricSnapshot;
  selectionRule?: string;
  selection_rule?: string;
  originalityReview?: GrowReviewStateInput;
  originality_review?: GrowReviewStateInput;
  caveats?: readonly string[];
}

export interface GrowHumanGate {
  required: true;
  before: "publish";
  approvalOwner: "human";
  status: "pending";
}

export interface GrowVariantReadiness {
  status: "ready" | "blocked";
  blockingFields: string[];
  reason: string;
}

export interface GrowTreatmentDefinition {
  id?: string;
  medium: string;
  format?: string;
  formats?: readonly string[];
  reason: string;
  patternRefs?: readonly string[];
  evidenceRefs?: readonly string[];
  patternEvidenceRefs?: readonly GrowPatternEvidenceRefInput[];
  evidenceStatus?: GrowEvidenceStatus;
  audienceScope?: string | null;
  cta?: string | null;
  responseIntent?: string | null;
  experimentId?: string | null;
  voiceCheck?: GrowReviewStateInput;
  voiceReviewState?: GrowReviewStateInput;
  originalityCheck?: GrowReviewStateInput;
  originalityReviewState?: GrowReviewStateInput;
  experimentVariables?: Readonly<Record<string, string>>;
}

export interface GrowVariantCandidate {
  id: string;
  source: GrowPlan["source"];
  provenance: GrowPlan["source"]["provenance"];
  platform: string;
  medium: string;
  format: string;
  treatmentId: string;
  treatmentReason: string;
  patternRefs: string[];
  evidenceRefs: string[];
  patternEvidenceRefs: GrowPatternEvidenceRef[];
  evidenceStatus: GrowEvidenceStatus;
  audienceScope: string | null;
  cta: string;
  responseIntent: string | null;
  experimentId: string | null;
  experimentVariables: Record<string, string>;
  voiceCheck: GrowReviewState;
  originalityCheck: GrowReviewState;
  humanGate: GrowHumanGate;
  readiness: GrowVariantReadiness;
  status: "draft" | "needs-human-review";
  reviewRequirement: string;
}

export interface GrowVariantManifest {
  version: "grow-variant-manifest-v1";
  candidates: GrowVariantCandidate[];
  reviewGate: GrowPlan["reviewGate"];
  generatesCopy: false;
  sideEffects: "none";
}

const DEFAULT_REASON = "Use the plan's requested format as the baseline treatment.";
const EVIDENCE_STATUSES = new Set<GrowEvidenceStatus>(["supported", "hypothesis", "insufficient", "blocked"]);
const REVIEW_STATES = new Set<GrowReviewState>(["pending", "passed", "failed", "not-run"]);
const EVIDENCE_POOLS = new Set<GrowEvidencePool>(["niche", "broad", "format"]);

function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} must not be empty`);
  return trimmed;
}

function optionalText(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  return requiredText(value, label);
}

function uniqueSorted(values: readonly string[] | undefined, label: string): string[] {
  return [...new Set((values ?? []).map((value) => requiredText(value, label)))].sort();
}

function normalizedEvidenceStatus(value: unknown): GrowEvidenceStatus {
  if (value === undefined || value === null) return "blocked";
  const normalized = requiredText(value, "evidence status").toLowerCase() as GrowEvidenceStatus;
  if (!EVIDENCE_STATUSES.has(normalized)) {
    throw new Error(`unsupported evidence status "${String(value)}"; expected supported, hypothesis, insufficient, or blocked`);
  }
  return normalized;
}

function normalizedReviewState(value: unknown, label: string): GrowReviewState {
  if (value === undefined) return "pending";
  const rawValue = typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as { status?: unknown }).status
    : value;
  const normalized = requiredText(rawValue, label).toLowerCase().replace(/_/g, "-");
  const aliases: Record<string, GrowReviewState> = {
    pass: "passed",
    fail: "failed",
  };
  const state = aliases[normalized] ?? normalized;
  if (!REVIEW_STATES.has(state as GrowReviewState)) {
    throw new Error(`unsupported ${label} "${String(value)}"; expected pending, passed, failed, or not-run`);
  }
  return state as GrowReviewState;
}

function normalizedMetricValue(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("metric snapshot values must be finite");
    return value;
  }
  if (Array.isArray(value)) return value.map(normalizedMetricValue);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [requiredText(key, "metric snapshot key"), normalizedMetricValue(entry)]),
    );
  }
  throw new Error("metric snapshot contains an unsupported value");
}

function normalizedMetricSnapshot(value: unknown): GrowMetricSnapshot {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("metric snapshot must be an object");
  }
  const entries = Object.entries(value);
  if (!entries.length) throw new Error("metric snapshot must not be empty");
  const normalized = Object.fromEntries(
    entries
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [requiredText(key, "metric snapshot key"), normalizedMetricValue(entry)]),
  );
  const requiredEvidenceFields = ["denominator", "scope"];
  const missingEvidenceFields = requiredEvidenceFields.filter((field) => normalized[field] === undefined || normalized[field] === null);
  if (missingEvidenceFields.length > 0) {
    throw new Error(`metric snapshot is missing required evidence fields: ${missingEvidenceFields.join(", ")}`);
  }
  if (normalized.window === undefined && normalized.observedAt === undefined && normalized.observed_at === undefined) {
    throw new Error("metric snapshot is missing a date or observation window");
  }
  return normalized;
}

function field(input: GrowPatternEvidenceRefInput, camel: keyof GrowPatternEvidenceRefInput, snake: keyof GrowPatternEvidenceRefInput): unknown {
  return input[camel] ?? input[snake];
}

function normalizedPatternEvidenceRef(input: GrowPatternEvidenceRefInput): GrowPatternEvidenceRef {
  const patternId = requiredText(field(input, "patternId", "pattern_id"), "pattern id");
  const sourceId = requiredText(field(input, "sourceId", "source_id"), "source id");
  const evidenceLocation = requiredText(field(input, "evidenceLocation", "evidence_location"), "evidence location");
  const pool = requiredText(input.pool, "evidence pool").toLowerCase() as GrowEvidencePool;
  if (!EVIDENCE_POOLS.has(pool)) throw new Error(`unsupported evidence pool "${String(input.pool)}"`);
  const scope = requiredText(input.scope, "evidence scope");
  const selectionRule = requiredText(field(input, "selectionRule", "selection_rule"), "selection rule");
  const originalityReview = normalizedReviewState(
    field(input, "originalityReview", "originality_review"),
    "source originality review",
  );
  return {
    patternId,
    sourceId,
    evidenceLocation,
    pool,
    scope,
    metricSnapshot: normalizedMetricSnapshot(field(input, "metricSnapshot", "metric_snapshot")),
    selectionRule,
    originalityReview,
    caveats: uniqueSorted(input.caveats, "evidence caveat"),
  };
}

function normalizedPatternEvidenceRefs(values: readonly GrowPatternEvidenceRefInput[] | undefined): GrowPatternEvidenceRef[] {
  const normalized = (values ?? []).map(normalizedPatternEvidenceRef);
  return [...new Map(normalized.map((value) => [
    JSON.stringify(value),
    value,
  ])).values()].sort((left, right) =>
    left.patternId.localeCompare(right.patternId)
    || left.sourceId.localeCompare(right.sourceId)
    || left.evidenceLocation.localeCompare(right.evidenceLocation)
    || left.pool.localeCompare(right.pool));
}

function normalizedExperimentVariables(values: Readonly<Record<string, string>> | undefined): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values ?? {})
      .map(([name, value]) => [requiredText(name, "experiment variable name"), requiredText(value, "experiment variable value")])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

interface NormalizedTreatment {
  id: string;
  medium: string;
  formats: string[];
  reason: string;
  patternRefs: string[];
  evidenceRefs: string[];
  patternEvidenceRefs: GrowPatternEvidenceRef[];
  evidenceStatus: GrowEvidenceStatus;
  audienceScope: string | null;
  cta: string;
  responseIntent: string | null;
  experimentId: string | null;
  voiceCheck: GrowReviewState;
  originalityCheck: GrowReviewState;
  experimentVariables: Record<string, string>;
}

function normalizedTreatments(plan: GrowPlan, supplied: readonly GrowTreatmentDefinition[] | undefined): NormalizedTreatment[] {
  if (supplied && supplied.length === 0) throw new Error("at least one treatment definition is required");
  if (!supplied) {
    const planFormats = plan.experiment.variables.find((variable) => variable.name === "format")?.options;
    const formats = uniqueSorted(planFormats?.length ? planFormats : ["text"], "treatment format");
    return formats.map((format) => normalizedTreatment(plan, {
      id: `default-${format}`,
      medium: format,
      format,
      reason: DEFAULT_REASON,
    }));
  }

  const normalized = supplied.map((treatment) => normalizedTreatment(plan, treatment));
  const unique = [...new Map(normalized.map((treatment) => [
    JSON.stringify([
      treatment.medium,
      treatment.formats,
      treatment.reason,
      treatment.patternRefs,
      treatment.evidenceRefs,
      treatment.patternEvidenceRefs,
      treatment.evidenceStatus,
      treatment.audienceScope,
      treatment.cta,
      treatment.responseIntent,
      treatment.experimentId,
      treatment.voiceCheck,
      treatment.originalityCheck,
      treatment.experimentVariables,
    ]),
    treatment,
  ])).values()];
  const seenIds = new Set<string>();
  for (const treatment of unique) {
    if (seenIds.has(treatment.id)) throw new Error(`treatment id must be unique: ${treatment.id}`);
    seenIds.add(treatment.id);
  }
  return unique;
}

function normalizedTreatment(plan: GrowPlan, treatment: GrowTreatmentDefinition): NormalizedTreatment {
  const formats = uniqueSorted(
    [...(treatment.formats ?? []), ...(treatment.format === undefined ? [] : [treatment.format])],
    "treatment format",
  );
  if (!formats.length) throw new Error("treatment must define at least one format");
  const medium = requiredText(treatment.medium, "treatment medium");
  const id = requiredText(treatment.id ?? `treatment-${medium}-${formats.join("-")}`, "treatment id");
  const voiceCheck = normalizedReviewState(
    treatment.voiceCheck ?? treatment.voiceReviewState,
    "voice check",
  );
  const originalityCheck = normalizedReviewState(
    treatment.originalityCheck ?? treatment.originalityReviewState,
    "originality check",
  );
  const planExperiment = plan.experiment as { id?: string | null; experimentId?: string | null };
  const experimentId = treatment.experimentId !== undefined
    ? optionalText(treatment.experimentId, "experiment id")
    : optionalText(planExperiment.id ?? planExperiment.experimentId, "experiment id");
  return {
    id,
    medium,
    formats,
    reason: requiredText(treatment.reason, "treatment reason"),
    patternRefs: uniqueSorted(treatment.patternRefs, "pattern ref"),
    evidenceRefs: uniqueSorted(treatment.evidenceRefs, "evidence ref"),
    patternEvidenceRefs: normalizedPatternEvidenceRefs(treatment.patternEvidenceRefs),
    evidenceStatus: normalizedEvidenceStatus(treatment.evidenceStatus),
    audienceScope: optionalText(treatment.audienceScope, "audience scope"),
    cta: treatment.cta === undefined || treatment.cta === null
      ? "none"
      : requiredText(treatment.cta, "CTA"),
    responseIntent: optionalText(treatment.responseIntent, "response intent"),
    experimentId,
    voiceCheck,
    originalityCheck,
    experimentVariables: normalizedExperimentVariables(treatment.experimentVariables),
  };
}

function stableIdPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "value";
}

function normalizedPlatforms(plan: GrowPlan): string[] {
  const platforms = uniqueSorted(plan.platforms, "platform");
  if (!platforms.length) throw new Error("at least one platform is required");
  return platforms;
}

function humanGate(plan: GrowPlan): GrowHumanGate {
  if (!plan.reviewGate || plan.reviewGate.required !== true) {
    throw new Error("human review gate is required");
  }
  if (plan.reviewGate.before !== "publish") throw new Error("human review gate must be before publish");
  if (plan.reviewGate.approvalOwner !== "human") throw new Error("human review gate approval owner must be human");
  return {
    required: true,
    before: "publish",
    approvalOwner: "human",
    status: "pending",
  };
}

function readinessFor(candidate: Pick<GrowVariantCandidate, "evidenceStatus" | "audienceScope" | "responseIntent" | "experimentId" | "evidenceRefs" | "patternEvidenceRefs" | "voiceCheck" | "originalityCheck">, gate: GrowHumanGate): GrowVariantReadiness {
  const blockingFields: string[] = [];
  if (candidate.evidenceStatus === "blocked" || candidate.evidenceStatus === "insufficient") blockingFields.push("evidenceStatus");
  if (candidate.audienceScope === null || candidate.audienceScope.toLowerCase() === "unknown") blockingFields.push("audienceScope");
  if (candidate.responseIntent === null || candidate.responseIntent.toLowerCase() === "unknown") blockingFields.push("responseIntent");
  if (candidate.experimentId === null || candidate.experimentId.toLowerCase() === "unknown") blockingFields.push("experimentId");
  if (candidate.evidenceStatus === "supported" && candidate.evidenceRefs.length === 0 && candidate.patternEvidenceRefs.length === 0) {
    blockingFields.push("evidenceRefs");
  }
  if (candidate.voiceCheck !== "passed") blockingFields.push("voiceCheck");
  if (candidate.originalityCheck !== "passed") blockingFields.push("originalityCheck");
  blockingFields.push("humanGate");
  return {
    status: blockingFields.length ? "blocked" : "ready",
    blockingFields,
    reason: blockingFields.length
      ? `Blocked: ${blockingFields.join(", ")} must be resolved before human approval.`
      : "Ready for human approval; no publication or queue action is performed here.",
  };
}

export function createGrowVariantManifest(
  plan: GrowPlan,
  treatments?: readonly GrowTreatmentDefinition[],
): GrowVariantManifest {
  const gate = humanGate(plan);
  const platforms = normalizedPlatforms(plan);
  const definitions = normalizedTreatments(plan, treatments);
  const candidates = definitions.flatMap((treatment) => treatment.formats.flatMap((format) => platforms.map((platform) => {
    const experimentVariables = {
      ...treatment.experimentVariables,
      format,
      medium: treatment.medium,
      platform,
    };
    const candidate: GrowVariantCandidate = {
      id: [platform, treatment.id, format].map(stableIdPart).join("--"),
      source: {
        descriptor: plan.source.descriptor,
        preservation: plan.source.preservation,
        provenance: plan.source.provenance,
      },
      provenance: plan.source.provenance,
      platform,
      medium: treatment.medium,
      format,
      treatmentId: treatment.id,
      treatmentReason: treatment.reason,
      patternRefs: [...treatment.patternRefs],
      evidenceRefs: [...treatment.evidenceRefs],
      patternEvidenceRefs: treatment.patternEvidenceRefs.map((ref) => ({
        ...ref,
        metricSnapshot: { ...ref.metricSnapshot },
        caveats: [...ref.caveats],
      })),
      evidenceStatus: treatment.evidenceStatus,
      audienceScope: treatment.audienceScope,
      cta: treatment.cta,
      responseIntent: treatment.responseIntent,
      experimentId: treatment.experimentId,
      experimentVariables,
      voiceCheck: treatment.voiceCheck,
      originalityCheck: treatment.originalityCheck,
      humanGate: { ...gate },
      readiness: {
        status: "blocked",
        blockingFields: [],
        reason: "",
      },
      status: "needs-human-review",
      reviewRequirement: "Human approval is required before this candidate can be approved or published.",
    };
    candidate.readiness = readinessFor(candidate, gate);
    return candidate;
  })));

  const uniqueCandidates = [...new Map(candidates.map((candidate) => [
    JSON.stringify([
      candidate.platform,
      candidate.medium,
      candidate.format,
      candidate.treatmentId,
      candidate.treatmentReason,
      candidate.patternRefs,
      candidate.evidenceRefs,
      candidate.patternEvidenceRefs,
      candidate.evidenceStatus,
      candidate.audienceScope,
      candidate.cta,
      candidate.responseIntent,
      candidate.experimentId,
      candidate.experimentVariables,
      candidate.voiceCheck,
      candidate.originalityCheck,
    ]),
    candidate,
  ])).values()].sort((left, right) =>
    left.platform.localeCompare(right.platform)
    || left.medium.localeCompare(right.medium)
    || left.format.localeCompare(right.format)
    || left.treatmentId.localeCompare(right.treatmentId));

  return {
    version: "grow-variant-manifest-v1",
    candidates: uniqueCandidates,
    reviewGate: { ...plan.reviewGate },
    generatesCopy: false,
    sideEffects: "none",
  };
}

export const buildGrowVariantManifest = createGrowVariantManifest;
