/**
 * A read-only join between requested Grow treatments and already-produced candidate metadata.
 *
 * This module compares identity only. It never reads source material, copies candidate fields,
 * invokes a model, or changes a candidate's lifecycle state.
 */

export const GROW_TREATMENT_COVERAGE_VERSION = "grow-treatment-coverage-v1" as const;

export type GrowTreatmentCoverageStatus = "matched" | "missing" | "duplicate" | "blocked";
export type GrowTreatmentCoverageReadinessStatus = "ready" | "blocked";

export interface GrowTreatmentIdentityInput {
  readonly platform?: string;
  readonly medium?: string;
  readonly format?: string;
  readonly treatmentId?: string | null;
  readonly treatment_id?: string | null;
  readonly experimentId?: string | null;
  readonly experiment_id?: string | null;
  readonly variables?: Readonly<Record<string, string>> | null;
  readonly experimentVariables?: Readonly<Record<string, string>> | null;
  readonly experiment_variables?: Readonly<Record<string, string>> | null;
}

export interface GrowTreatmentIdentity {
  readonly platform: string;
  readonly medium: string;
  readonly format: string;
  readonly treatmentId: string;
  readonly experimentId: string | null;
  readonly variables: Record<string, string>;
}

export interface GrowTreatmentReadinessInput {
  readonly status?: string | null;
  readonly blockers?: readonly string[];
  readonly blockingFields?: readonly string[];
  readonly reason?: string | null;
}

export interface GrowTreatmentReadiness {
  readonly status: GrowTreatmentCoverageReadinessStatus;
  readonly blockers: string[];
}

export interface GrowTreatmentCandidateInput extends GrowTreatmentIdentityInput {
  readonly id?: string | null;
  readonly candidateId?: string | null;
  readonly readiness?: GrowTreatmentReadinessInput | null;
  readonly status?: string | null;
}

export interface GrowTreatmentCoverageInput {
  /** Preferred field name. */
  readonly requestedTreatments?: readonly GrowTreatmentIdentityInput[];
  /** Short alias useful for already-normalized operator envelopes. */
  readonly requested?: readonly GrowTreatmentIdentityInput[];
  /** Compatibility alias for callers that call the rows treatments. */
  readonly treatments?: readonly GrowTreatmentIdentityInput[];
  readonly candidates: readonly GrowTreatmentCandidateInput[];
}

export interface GrowTreatmentCoverageRow {
  readonly identity: GrowTreatmentIdentity;
  readonly candidateIds: string[];
  readonly status: GrowTreatmentCoverageStatus;
  readonly readiness: GrowTreatmentReadiness;
}

export interface GrowTreatmentCoverageUnexpectedCandidate {
  readonly candidateId: string;
  readonly identity: GrowTreatmentIdentity;
  readonly status: "unexpected";
  readonly readiness: GrowTreatmentReadiness;
}

export interface GrowTreatmentCoverageSummary {
  readonly requested: number;
  readonly matched: number;
  readonly missing: number;
  readonly duplicate: number;
  readonly blocked: number;
  readonly unexpected: number;
}

export interface GrowTreatmentCoverage {
  readonly kind: "grow_treatment_coverage";
  readonly version: typeof GROW_TREATMENT_COVERAGE_VERSION;
  readonly rows: GrowTreatmentCoverageRow[];
  readonly unexpectedCandidates: GrowTreatmentCoverageUnexpectedCandidate[];
  readonly summary: GrowTreatmentCoverageSummary;
  readonly readiness: {
    readonly status: GrowTreatmentCoverageReadinessStatus;
    readonly blockers: string[];
  };
  readonly generatesCopy: false;
  readonly creatorBodyCopyAllowed: false;
  readonly sideEffects: "none";
}

interface NormalizedCandidate {
  readonly candidateId: string;
  readonly identity: GrowTreatmentIdentity;
  readonly key: string;
  readonly readiness: GrowTreatmentReadiness;
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compare);
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function optionalText(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  return requiredText(value, label);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function selectedField<T>(value: Record<string, unknown>, fields: readonly string[]): T | undefined {
  for (const field of fields) {
    if (Object.hasOwn(value, field) && value[field] !== undefined) return value[field] as T;
  }
  return undefined;
}

function normalizedVariables(value: unknown, label: string): Record<string, string> {
  if (value === undefined || value === null) return {};
  const source = record(value, label);
  const entries = Object.entries(source).map(([name, entry]) => [
    requiredText(name, `${label} name`),
    requiredText(entry, `${label} value`),
  ] as const);
  const names = new Set<string>();
  for (const [name] of entries) {
    if (names.has(name)) throw new Error(`${label} contains duplicate variable "${name}"`);
    names.add(name);
  }
  return Object.fromEntries(entries.sort(([left], [right]) => compare(left, right)));
}

/** Return the canonical, sorted identity used by the coverage join. */
export function normalizeGrowTreatmentIdentity(value: GrowTreatmentIdentityInput): GrowTreatmentIdentity {
  const source = record(value, "treatment identity");
  const variables = selectedField<unknown>(source, ["variables", "experimentVariables", "experiment_variables"]);
  return {
    platform: requiredText(source.platform, "treatment platform"),
    medium: requiredText(source.medium, "treatment medium"),
    format: requiredText(source.format, "treatment format"),
    treatmentId: requiredText(selectedField(source, ["treatmentId", "treatment_id"]), "treatment id"),
    experimentId: optionalText(selectedField(source, ["experimentId", "experiment_id"]), "experiment id"),
    variables: normalizedVariables(variables, "treatment variables"),
  };
}

/** Build a stable identity key. Every identity dimension participates in the comparison. */
export function growTreatmentIdentityKey(identity: GrowTreatmentIdentityInput): string {
  const normalized = normalizeGrowTreatmentIdentity(identity);
  return JSON.stringify([
    normalized.platform,
    normalized.medium,
    normalized.format,
    normalized.treatmentId,
    normalized.experimentId,
    Object.entries(normalized.variables),
  ]);
}

function readiness(value: unknown, label: string): GrowTreatmentReadiness {
  if (value === undefined || value === null) {
    return { status: "blocked", blockers: [`${label} is missing`] };
  }

  const source = record(value, label);
  const rawStatus = typeof source.status === "string" ? source.status.trim().toLowerCase() : "";
  const status: GrowTreatmentCoverageReadinessStatus = rawStatus === "ready" ? "ready" : "blocked";
  const suppliedBlockers = source.blockers ?? source.blockingFields;
  const blockers = suppliedBlockers === undefined
    ? []
    : !Array.isArray(suppliedBlockers)
      ? [`${label} blockers must be an array`]
      : suppliedBlockers.map((blocker, index) => requiredText(blocker, `${label} blocker ${index + 1}`));
  if (rawStatus !== "ready" && rawStatus !== "blocked") blockers.push(`${label} status is missing or invalid`);
  if (status === "blocked" && blockers.length === 0) blockers.push(`${label} is blocked`);
  return { status, blockers: uniqueSorted(blockers) };
}

function candidateId(value: GrowTreatmentCandidateInput, index: number): string {
  const source = record(value, "treatment candidate");
  const supplied = selectedField<unknown>(source, ["id", "candidateId", "candidate_id"]);
  return supplied === undefined || supplied === null || supplied === ""
    ? `candidate-${index + 1}`
    : requiredText(supplied, "candidate id");
}

function candidateReadiness(value: GrowTreatmentCandidateInput): GrowTreatmentReadiness {
  const source = record(value, "treatment candidate");
  if (Object.hasOwn(source, "readiness")) return readiness(source.readiness, "candidate readiness");
  if (source.status === "ready") return { status: "ready", blockers: [] };
  if (source.status === "blocked") return { status: "blocked", blockers: ["candidate status is blocked"] };
  return { status: "blocked", blockers: ["candidate readiness is missing"] };
}

function normalizedCandidates(values: readonly GrowTreatmentCandidateInput[]): NormalizedCandidate[] {
  return values.map((value, index) => {
    const identity = normalizeGrowTreatmentIdentity(value);
    return {
      candidateId: candidateId(value, index),
      identity,
      key: growTreatmentIdentityKey(identity),
      readiness: candidateReadiness(value),
    };
  });
}

function selectedRequested(input: GrowTreatmentCoverageInput): readonly GrowTreatmentIdentityInput[] {
  if (input.requestedTreatments !== undefined) return input.requestedTreatments;
  if (input.requested !== undefined) return input.requested;
  if (input.treatments !== undefined) return input.treatments;
  throw new Error("requestedTreatments is required");
}

function rowReadiness(
  status: GrowTreatmentCoverageStatus,
  matching: readonly NormalizedCandidate[],
): GrowTreatmentReadiness {
  const blockers: string[] = [];
  if (status === "missing") blockers.push("requested treatment is missing");
  if (status === "duplicate") blockers.push("multiple candidates match requested treatment");
  for (const candidate of matching) {
    blockers.push(...candidate.readiness.blockers);
    if (candidate.readiness.status === "blocked") blockers.push("candidate readiness is blocked");
  }
  return {
    status: blockers.length > 0 ? "blocked" : "ready",
    blockers: uniqueSorted(blockers),
  };
}

function rowStatus(matching: readonly NormalizedCandidate[]): GrowTreatmentCoverageStatus {
  if (matching.length === 0) return "missing";
  if (matching.length > 1) return "duplicate";
  return matching[0]!.readiness.status === "blocked" ? "blocked" : "matched";
}

function summary(rows: readonly GrowTreatmentCoverageRow[], unexpected: readonly GrowTreatmentCoverageUnexpectedCandidate[]): GrowTreatmentCoverageSummary {
  const result = {
    requested: rows.length,
    matched: 0,
    missing: 0,
    duplicate: 0,
    blocked: 0,
    unexpected: unexpected.length,
  };
  for (const row of rows) result[row.status] += 1;
  return result;
}

function readinessBlockers(
  rows: readonly GrowTreatmentCoverageRow[],
  unexpected: readonly GrowTreatmentCoverageUnexpectedCandidate[],
): string[] {
  const blockers: string[] = [];
  for (const row of rows) {
    if (row.status === "matched" && row.readiness.status === "ready") continue;
    const key = growTreatmentIdentityKey(row.identity);
    blockers.push(`${row.status} requested treatment: ${key}`);
    blockers.push(...row.readiness.blockers.map((blocker) => `${key}: ${blocker}`));
  }
  for (const row of unexpected) {
    blockers.push(`unexpected candidate: ${row.candidateId}`);
    blockers.push(...row.readiness.blockers.map((blocker) => `${row.candidateId}: ${blocker}`));
  }
  return uniqueSorted(blockers);
}

/** Build deterministic treatment coverage from caller-supplied metadata only. */
export function buildGrowTreatmentCoverage(input: GrowTreatmentCoverageInput): GrowTreatmentCoverage {
  const requested = selectedRequested(input).map(normalizeGrowTreatmentIdentity);
  const candidates = normalizedCandidates(input.candidates);
  const byKey = new Map<string, NormalizedCandidate[]>();
  for (const candidate of candidates) {
    byKey.set(candidate.key, [...(byKey.get(candidate.key) ?? []), candidate]);
  }

  const rows = requested
    .map((identity): GrowTreatmentCoverageRow => {
      const matching = byKey.get(growTreatmentIdentityKey(identity)) ?? [];
      const status = rowStatus(matching);
      return {
        identity: {
          ...identity,
          variables: { ...identity.variables },
        },
        candidateIds: matching.map((candidate) => candidate.candidateId).sort(compare),
        status,
        readiness: rowReadiness(status, matching),
      };
    })
    .sort((left, right) => growTreatmentIdentityKey(left.identity).localeCompare(growTreatmentIdentityKey(right.identity)));

  const requestedKeys = new Set(requested.map(growTreatmentIdentityKey));
  const unexpectedCandidates = candidates
    .filter((candidate) => !requestedKeys.has(candidate.key))
    .map((candidate): GrowTreatmentCoverageUnexpectedCandidate => ({
      candidateId: candidate.candidateId,
      identity: {
        ...candidate.identity,
        variables: { ...candidate.identity.variables },
      },
      status: "unexpected",
      readiness: {
        status: candidate.readiness.status,
        blockers: [...candidate.readiness.blockers],
      },
    }))
    .sort((left, right) =>
      growTreatmentIdentityKey(left.identity).localeCompare(growTreatmentIdentityKey(right.identity))
      || compare(left.candidateId, right.candidateId));

  const artifactSummary = summary(rows, unexpectedCandidates);
  return {
    kind: "grow_treatment_coverage",
    version: GROW_TREATMENT_COVERAGE_VERSION,
    rows,
    unexpectedCandidates,
    summary: artifactSummary,
    readiness: {
      status: rows.every((row) => row.status === "matched" && row.readiness.status === "ready")
        && unexpectedCandidates.length === 0
        ? "ready"
        : "blocked",
      blockers: readinessBlockers(rows, unexpectedCandidates),
    },
    generatesCopy: false,
    creatorBodyCopyAllowed: false,
    sideEffects: "none",
  };
}

export const createGrowTreatmentCoverage = buildGrowTreatmentCoverage;
export const buildTreatmentCoverage = buildGrowTreatmentCoverage;
export const createTreatmentCoverage = buildGrowTreatmentCoverage;
export const normalizeTreatmentCoverage = buildGrowTreatmentCoverage;
