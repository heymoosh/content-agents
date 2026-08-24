/**
 * Pure Phase 3 experiment contract.
 *
 * This module only validates and normalizes caller-supplied facts. It does not read content,
 * generate copy, consult a clock, persist a record, publish anything, or infer an outcome.
 */

export const EXPERIMENT_RECORD_VERSION = "grow-experiment-v1" as const;

export type ExperimentStatus = "proposed" | "running" | "closed" | "insufficient-evidence";
export type OutcomeFamily = "attention" | "conversation" | "audience" | "business";

type TextCollection = string | readonly string[];

export interface ExperimentVariableInput {
  name: string;
  options?: readonly string[];
  values?: readonly string[];
}

export interface ExperimentVariable {
  name: string;
  options: string[];
}

export interface ExperimentScopeInput {
  platform?: TextCollection;
  format?: TextCollection;
  topic?: TextCollection;
  audience?: TextCollection;
  platform_scope?: TextCollection;
  format_scope?: TextCollection;
  topic_scope?: TextCollection;
  audience_scope?: TextCollection;
}

export interface ExperimentScope {
  platform: string[];
  format: string[];
  topic: string[];
  audience: string[];
}

export interface ExperimentLineageInput {
  sourceRefs?: readonly string[];
  source_refs?: readonly string[];
  variantRefs?: readonly string[];
  variant_refs?: readonly string[];
  publishRefs?: readonly string[];
  publish_refs?: readonly string[];
  outcomeRefs?: readonly string[];
  outcome_refs?: readonly string[];
}

export interface ExperimentLineage {
  sourceRefs: string[];
  variantRefs: string[];
  publishRefs: string[];
  outcomeRefs: string[];
}

export interface SuccessObservationInput {
  id: string;
  family?: OutcomeFamily | string;
  outcomeFamily?: OutcomeFamily | string;
  outcome_family?: OutcomeFamily | string;
  metric: string;
  target?: number | null;
  threshold?: number | null;
  measured?: boolean;
  value?: number | null;
  sample?: number | null;
  sampleSize?: number | null;
  sample_size?: number | null;
  denominator?: number | null;
  observedAt?: string | null;
  observed_at?: string | null;
  outcomeRefs?: readonly string[];
  outcome_refs?: readonly string[];
}

export interface SuccessObservation {
  id: string;
  family: OutcomeFamily;
  metric: string;
  target: number | null;
  measured: boolean;
  value: number | null;
  sample: number | null;
  observedAt: string | null;
  outcomeRefs: string[];
}

export interface ExperimentWinnerInput {
  variantRef?: string;
  variant_ref?: string;
  family?: OutcomeFamily | string;
  outcomeFamily?: OutcomeFamily | string;
  outcome_family?: OutcomeFamily | string;
  observationRefs?: readonly string[];
  observation_refs?: readonly string[];
}

export interface ExperimentWinner {
  variantRef: string;
  family: OutcomeFamily;
  observationRefs: string[];
}

export interface ExperimentComparisonInput {
  control?: string;
  treatment?: string;
}

export interface ExperimentComparison {
  control: string | null;
  treatment: string | null;
}

export interface ExperimentRecordInput {
  id: string;
  question?: string;
  questions?: readonly string[];
  hypothesis?: string | null;
  unit?: string | null;
  comparison?: ExperimentComparisonInput | null;
  variables?: readonly ExperimentVariableInput[] | Readonly<Record<string, TextCollection>>;
  variableNames?: readonly string[];
  variable_names?: readonly string[];
  scope?: ExperimentScopeInput;
  platformScope?: TextCollection;
  formatScope?: TextCollection;
  topicScope?: TextCollection;
  audienceScope?: TextCollection;
  platform_scope?: TextCollection;
  format_scope?: TextCollection;
  topic_scope?: TextCollection;
  audience_scope?: TextCollection;
  lineage?: ExperimentLineageInput;
  sourceRefs?: readonly string[];
  variantRefs?: readonly string[];
  publishRefs?: readonly string[];
  outcomeRefs?: readonly string[];
  source_refs?: readonly string[];
  variant_refs?: readonly string[];
  publish_refs?: readonly string[];
  outcome_refs?: readonly string[];
  successObservations: readonly SuccessObservationInput[];
  success_observations?: readonly SuccessObservationInput[];
  minimumSample?: number;
  minimum_sample?: number;
  reviewRule?: string | null;
  review_rule?: string | null;
  startAt?: string | null;
  start_at?: string | null;
  endAt?: string | null;
  end_at?: string | null;
  status: ExperimentStatus | string;
  winner?: string | ExperimentWinnerInput | null;
  winnerVariantRef?: string | null;
  winner_variant_ref?: string | null;
}

export interface ExperimentRecord {
  recordType: "experiment";
  version: typeof EXPERIMENT_RECORD_VERSION;
  id: string;
  question: string;
  hypothesis: string | null;
  unit: string | null;
  comparison: ExperimentComparison;
  variables: ExperimentVariable[];
  variableNames: string[];
  scope: ExperimentScope;
  platformScope: string[];
  formatScope: string[];
  topicScope: string[];
  audienceScope: string[];
  lineage: ExperimentLineage;
  successObservations: SuccessObservation[];
  minimumSample: number;
  reviewRule: string | null;
  startAt: string | null;
  endAt: string | null;
  winner: ExperimentWinner | null;
  status: ExperimentStatus;
  generatesCopy: false;
  sideEffects: "none";
}

export class ExperimentRecordValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExperimentRecordValidationError";
  }
}

const STATUSES: readonly ExperimentStatus[] = ["proposed", "running", "closed", "insufficient-evidence"];
const OUTCOME_FAMILIES: readonly OutcomeFamily[] = ["attention", "conversation", "audience", "business"];

function fail(message: string): never {
  throw new ExperimentRecordValidationError(message);
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${field} must be an object`);
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") fail(`${field} is required`);
  return value.trim();
}

function optionalText(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  return text(value, field);
}

function own(value: Record<string, unknown>, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, field);
}

function firstDefined(value: Record<string, unknown>, fields: readonly string[]): unknown {
  for (const field of fields) {
    if (own(value, field) && value[field] !== undefined) return value[field];
  }
  return undefined;
}

function normalizedStrings(value: unknown, field: string, required: boolean): string[] {
  if (typeof value === "string") return [text(value, field)];
  if (!Array.isArray(value)) {
    if (!required && (value === undefined || value === null)) return [];
    fail(`${field} must be a string or array of strings`);
  }
  const values = value.map((item, index) => text(item, `${field}[${index}]`));
  const normalized = [...new Set(values)].sort((left, right) => left.localeCompare(right));
  if (required && normalized.length === 0) fail(`${field} must not be empty`);
  return normalized;
}

function normalizedRefs(value: unknown, field: string, required: boolean): string[] {
  if (typeof value === "string") return normalizedStrings(value, field, required);
  if (!Array.isArray(value)) {
    if (!required && (value === undefined || value === null)) return [];
    fail(`${field} must be an array of refs`);
  }
  const refs = [...new Set(value.map((item, index) => text(item, `${field}[${index}]`)))].sort((left, right) => left.localeCompare(right));
  if (required && refs.length === 0) fail(`${field} must not be empty`);
  return refs;
}

function normalizedEnum<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  const normalized = text(value, field).toLowerCase().replace(/_/g, "-");
  if (!allowed.includes(normalized as T)) {
    fail(`${field} must be exactly one of ${allowed.join(", ")}`);
  }
  return normalized as T;
}

function normalizedDate(value: unknown, field: string): string | null {
  const normalized = optionalText(value, field);
  if (normalized === null) return null;
  if (Number.isNaN(Date.parse(normalized))) fail(`${field} must be a valid date or timestamp`);
  return normalized;
}

function finiteNumber(value: unknown, field: string, integer = false): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(`${field} must be a finite number`);
  if (integer && !Number.isInteger(value)) fail(`${field} must be an integer`);
  return value;
}

function nonNegativeNumber(value: unknown, field: string): number {
  const normalized = finiteNumber(value, field);
  if (normalized < 0) fail(`${field} must not be negative`);
  return normalized;
}

function optionalNonNegativeNumber(value: unknown, field: string): number | null {
  if (value === undefined || value === null) return null;
  return nonNegativeNumber(value, field);
}

function normalizeQuestion(input: Record<string, unknown>): string {
  if (own(input, "question") && own(input, "questions")) fail("provide exactly one question, not question and questions");
  if (own(input, "questions")) {
    const questions = input.questions;
    if (!Array.isArray(questions) || questions.length !== 1) fail("exactly one question is required");
    return text(questions[0], "question");
  }
  return text(input.question, "question");
}

function normalizeVariables(input: Record<string, unknown>): ExperimentVariable[] {
  const raw = input.variables;
  const variableNames = firstDefined(input, ["variableNames", "variable_names"]);
  const namesFromInput = variableNames === undefined ? null : normalizedRefs(variableNames, "variable names", true);
  const variables: ExperimentVariable[] = [];

  if (Array.isArray(raw)) {
    for (const [index, item] of raw.entries()) {
      const variable = object(item, `variables[${index}]`);
      const name = text(variable.name, `variables[${index}].name`);
      const options = [
        ...normalizedStrings(firstDefined(variable, ["options"]), `variables[${index}].options`, false),
        ...normalizedStrings(firstDefined(variable, ["values"]), `variables[${index}].values`, false),
      ];
      variables.push({ name, options: [...new Set(options)].sort((left, right) => left.localeCompare(right)) });
    }
  } else if (raw !== undefined && raw !== null) {
    const byName = object(raw, "variables");
    for (const [name, values] of Object.entries(byName)) {
      variables.push({ name: text(name, "variable name"), options: normalizedStrings(values, `variables.${name}`, true) });
    }
  }

  if (namesFromInput !== null) {
    if (variables.length > 0 && JSON.stringify(variables.map((variable) => variable.name).sort()) !== JSON.stringify(namesFromInput)) {
      fail("variable names do not match variables");
    }
    for (const name of namesFromInput) {
      if (!variables.some((variable) => variable.name === name)) variables.push({ name, options: [] });
    }
  }

  if (variables.length === 0) fail("at least one declared variable is required");
  const deduped = new Map<string, ExperimentVariable>();
  for (const variable of variables) {
    if (deduped.has(variable.name)) fail(`variable names must be unique: ${variable.name}`);
    deduped.set(variable.name, {
      name: variable.name,
      options: [...new Set(variable.options)].sort((left, right) => left.localeCompare(right)),
    });
  }
  return [...deduped.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function normalizeScope(input: Record<string, unknown>): ExperimentScope {
  const scope = input.scope === undefined ? {} : object(input.scope, "scope");
  const value = (name: keyof ExperimentScope): unknown => firstDefined(scope, [name, `${name}_scope`])
    ?? firstDefined(input, [
      `${name}Scope`,
      `${name}_scope`,
    ]);
  return {
    platform: normalizedStrings(value("platform"), "scope.platform", true),
    format: normalizedStrings(value("format"), "scope.format", true),
    topic: normalizedStrings(value("topic"), "scope.topic", true),
    audience: normalizedStrings(value("audience"), "scope.audience", true),
  };
}

function normalizeLineage(input: Record<string, unknown>): ExperimentLineage {
  const lineage = input.lineage === undefined ? {} : object(input.lineage, "lineage");
  const value = (name: keyof ExperimentLineage): unknown => firstDefined(lineage, [name, name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)])
    ?? firstDefined(input, [name, name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)]);
  return {
    sourceRefs: normalizedRefs(value("sourceRefs"), "lineage.sourceRefs", true),
    variantRefs: normalizedRefs(value("variantRefs"), "lineage.variantRefs", true),
    publishRefs: normalizedRefs(value("publishRefs"), "lineage.publishRefs", false),
    outcomeRefs: normalizedRefs(value("outcomeRefs"), "lineage.outcomeRefs", false),
  };
}

function normalizeObservation(input: unknown, index: number): SuccessObservation {
  const source = object(input, `successObservations[${index}]`);
  const familyInput = firstDefined(source, ["family", "outcomeFamily", "outcome_family"]);
  const family = normalizedEnum(familyInput, OUTCOME_FAMILIES, `successObservations[${index}].outcome family`);
  const id = text(source.id, `successObservations[${index}].id`);
  const metric = text(source.metric, `successObservations[${index}].metric`);
  const target = optionalNonNegativeNumber(firstDefined(source, ["target", "threshold"]), `successObservations[${index}].target`);
  const valueInput = firstDefined(source, ["value"]);
  const sampleInput = firstDefined(source, ["sample", "sampleSize", "sample_size", "denominator"]);
  const observedAtInput = firstDefined(source, ["observedAt", "observed_at"]);
  const value = optionalNonNegativeNumber(valueInput, `successObservations[${index}].value`);
  const sample = optionalNonNegativeNumber(sampleInput, `successObservations[${index}].sample`);
  const observedAt = normalizedDate(observedAtInput, `successObservations[${index}].observedAt`);
  const explicitMeasured = source.measured;
  if (explicitMeasured !== undefined && typeof explicitMeasured !== "boolean") {
    fail(`successObservations[${index}].measured must be a boolean`);
  }
  const measured = explicitMeasured === true
    || (explicitMeasured === undefined && value !== null && sample !== null && observedAt !== null);
  if (measured && (value === null || sample === null || sample <= 0 || observedAt === null)) {
    fail(`successObservations[${index}] measured observations require value, positive sample, and observedAt`);
  }
  if (explicitMeasured === false && (value !== null || sample !== null || observedAt !== null)) {
    fail(`successObservations[${index}] cannot include measurement fields when measured is false`);
  }
  const outcomeRefs = normalizedRefs(
    firstDefined(source, ["outcomeRefs", "outcome_refs"]),
    `successObservations[${index}].outcomeRefs`,
    false,
  );
  return { id, family, metric, target, measured, value, sample, observedAt, outcomeRefs };
}

function normalizeObservations(input: Record<string, unknown>): SuccessObservation[] {
  const raw = firstDefined(input, ["successObservations", "success_observations"]);
  if (!Array.isArray(raw) || raw.length === 0) fail("at least one success observation is required");
  const observations = raw.map(normalizeObservation);
  const ids = new Set<string>();
  for (const observation of observations) {
    if (ids.has(observation.id)) fail(`success observation ids must be unique: ${observation.id}`);
    ids.add(observation.id);
  }
  return observations.sort((left, right) =>
    left.family.localeCompare(right.family)
    || left.id.localeCompare(right.id)
    || left.metric.localeCompare(right.metric));
}

function normalizeComparison(input: Record<string, unknown>): ExperimentComparison {
  const raw = input.comparison;
  if (raw === undefined || raw === null) return { control: null, treatment: null };
  const comparison = object(raw, "comparison");
  return {
    control: optionalText(comparison.control, "comparison.control"),
    treatment: optionalText(comparison.treatment, "comparison.treatment"),
  };
}

function normalizeWinner(input: Record<string, unknown>, lineage: ExperimentLineage, observations: SuccessObservation[], minimumSample: number): ExperimentWinner | null {
  const suppliedWinner = input.winner;
  const suppliedVariantRef = firstDefined(input, ["winnerVariantRef", "winner_variant_ref"]);
  if (suppliedWinner !== undefined && suppliedVariantRef !== undefined) fail("provide winner or winnerVariantRef, not both");
  if (suppliedWinner === null || (suppliedWinner === undefined && (suppliedVariantRef === undefined || suppliedVariantRef === null))) return null;

  const winner: Record<string, unknown> = typeof suppliedWinner === "string"
    ? { variantRef: suppliedWinner }
    : suppliedWinner === undefined || suppliedWinner === null
      ? { variantRef: suppliedVariantRef }
      : object(suppliedWinner, "winner");
  const variantRef = text(firstDefined(winner, ["variantRef", "variant_ref"]), "winner.variantRef");
  if (!lineage.variantRefs.includes(variantRef)) fail("winner.variantRef must reference a declared variant");

  const measured = observations.filter((observation) => observation.measured);
  if (measured.length === 0) fail("a winner claim requires at least one measured observation");
  const familyInput = firstDefined(winner, ["family", "outcomeFamily", "outcome_family"]);
  const measuredFamilies = [...new Set(measured.map((observation) => observation.family))];
  const family = familyInput === undefined
    ? measuredFamilies.length === 1
      ? measuredFamilies[0]
      : fail("a winner claim must name exactly one outcome family")
    : normalizedEnum(familyInput, OUTCOME_FAMILIES, "winner.outcome family");
  const suppliedObservationRefs = firstDefined(winner, ["observationRefs", "observation_refs"]);
  const observationRefs = suppliedObservationRefs === undefined
    ? measured.filter((observation) => observation.family === family).map((observation) => observation.id)
    : normalizedRefs(suppliedObservationRefs, "winner.observationRefs", true);
  const selected = observationRefs.map((ref) => {
    const observation = observations.find((candidate) => candidate.id === ref);
    if (!observation) fail(`winner.observationRefs contains unknown observation: ${ref}`);
    return observation;
  });
  if (selected.some((observation) => !observation.measured)) fail("a winner claim may reference only measured observations");
  if (selected.some((observation) => observation.family !== family)) fail("a winner claim cannot conflate outcome families");
  if (selected.some((observation) => observation.outcomeRefs.length === 0)) {
    fail("a winner claim requires each observation to reference a declared outcome");
  }
  if (!selected.some((observation) => (observation.sample ?? 0) >= minimumSample)) {
    fail("a winner claim requires a measured observation meeting minimumSample");
  }
  return { variantRef, family, observationRefs };
}

/** Build a deterministic, side-effect-free experiment record. */
export function buildExperimentRecord(input: ExperimentRecordInput): ExperimentRecord {
  const source = object(input, "experiment record");
  const id = text(source.id, "id");
  const question = normalizeQuestion(source);
  const variables = normalizeVariables(source);
  const scope = normalizeScope(source);
  const lineage = normalizeLineage(source);
  const observations = normalizeObservations(source);
  const minimumSampleValue = firstDefined(source, ["minimumSample", "minimum_sample"]);
  const minimumSample = finiteNumber(minimumSampleValue, "minimumSample", true);
  if (minimumSample <= 0) fail("minimumSample must be greater than zero");
  const reviewRule = optionalText(firstDefined(source, ["reviewRule", "review_rule"]), "reviewRule");
  const startAt = normalizedDate(firstDefined(source, ["startAt", "start_at"]), "startAt");
  const endAt = normalizedDate(firstDefined(source, ["endAt", "end_at"]), "endAt");
  if (reviewRule === null && endAt === null) fail("either endAt or reviewRule is required");
  if (startAt !== null && endAt !== null && Date.parse(endAt) < Date.parse(startAt)) fail("endAt must not precede startAt");
  const status = normalizedEnum(source.status, STATUSES, "status");

  const outcomeRefs = new Set(lineage.outcomeRefs);
  for (const observation of observations) {
    for (const ref of observation.outcomeRefs) {
      if (!outcomeRefs.has(ref)) fail(`success observation outcome ref is not in lineage.outcomeRefs: ${ref}`);
    }
  }
  const winner = normalizeWinner(source, lineage, observations, minimumSample);
  if (winner !== null && status !== "closed") {
    fail("a winner claim requires status closed");
  }

  return {
    recordType: "experiment",
    version: EXPERIMENT_RECORD_VERSION,
    id,
    question,
    hypothesis: optionalText(source.hypothesis, "hypothesis"),
    unit: optionalText(source.unit, "unit"),
    comparison: normalizeComparison(source),
    variables,
    variableNames: variables.map((variable) => variable.name),
    scope,
    platformScope: [...scope.platform],
    formatScope: [...scope.format],
    topicScope: [...scope.topic],
    audienceScope: [...scope.audience],
    lineage,
    successObservations: observations,
    minimumSample,
    reviewRule,
    startAt,
    endAt,
    winner,
    status,
    generatesCopy: false,
    sideEffects: "none",
  };
}

/** Alias for callers that use the create naming convention used by other Grow seams. */
export const createExperimentRecord = buildExperimentRecord;

/** Alias for callers that already have an untrusted serialized value at the boundary. */
export const normalizeExperimentRecord = buildExperimentRecord;
