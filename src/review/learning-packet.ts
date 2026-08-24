/**
 * A pure, post-publish learning contract.
 *
 * This module deliberately has no persistence or clock access. Callers supply the published
 * timestamp, evidence references, and decision/gate states. The output is a normalized snapshot
 * that can be stored or handed to another room by a caller, but this module never does either.
 */

export const LEARNING_PACKET_VERSION = 1 as const;

export type Confidence = "low" | "medium" | "high";

export type EvidenceStatus = "observed" | "reported" | "self_reported" | "verified" | "inferred" | "missing";

export interface Evidence {
  status: EvidenceStatus;
  refs: readonly string[];
  note: string | null;
}

export interface BlueprintLineage {
  sourceId: string;
  variantId: string;
  experimentId: string;
}

export interface Interpretation {
  summary: string;
  confidence: Confidence;
}

export type CommentQualificationStatus = "qualified" | "not_qualified" | "uncertain";

export interface CommentQualification {
  status: CommentQualificationStatus;
  basis: string;
}

export interface CommentObservationFacts {
  sourcePlatform: string;
  surface: string;
  commentId: string;
  observedAt: string;
  text: string;
}

export interface CommentObservationInput {
  id: string;
  lineage: BlueprintLineage;
  observation: CommentObservationFacts;
  qualification: CommentQualification;
  interpretation: Interpretation & { willingnessToPay?: "not_proven_by_comment" | string };
  evidence: Evidence;
  caveats: readonly string[];
}

export interface CommentObservation {
  kind: "comment_observation";
  id: string;
  lineage: BlueprintLineage;
  observation: CommentObservationFacts;
  qualification: CommentQualification;
  interpretation: Interpretation & { willingnessToPay: "not_proven_by_comment" };
  evidence: Evidence;
  caveats: readonly string[];
}

export type FunnelEventType =
  | "visit"
  | "opt_in"
  | "survey_response"
  | "qualified_inquiry"
  | "call"
  | "opportunity"
  | "purchase";

export interface FunnelEventFacts {
  eventType: FunnelEventType;
  occurredAt: string;
  source: string;
  value: number | null;
}

export interface FunnelEventInput {
  id: string;
  lineage: BlueprintLineage;
  observation: FunnelEventFacts;
  interpretation: Interpretation | null;
  evidence: Evidence;
  caveats: readonly string[];
}

export interface FunnelEvent {
  kind: "funnel_event";
  id: string;
  lineage: BlueprintLineage;
  observation: FunnelEventFacts;
  interpretation: Interpretation | null;
  evidence: Evidence;
  caveats: readonly string[];
}

export type BusinessOutcomeType = "qualified_inquiry" | "call" | "opportunity" | "purchase";

export interface BusinessOutcomeFacts {
  outcomeType: BusinessOutcomeType;
  occurredAt: string;
  source: string;
  amount: number | null;
  currency: string | null;
}

export interface BusinessOutcomeInput {
  id: string;
  lineage: BlueprintLineage;
  observation: BusinessOutcomeFacts;
  interpretation: Interpretation | null;
  evidence: Evidence;
  caveats: readonly string[];
}

export interface BusinessOutcome {
  kind: "business_outcome";
  id: string;
  lineage: BlueprintLineage;
  observation: BusinessOutcomeFacts;
  interpretation: Interpretation | null;
  evidence: Evidence;
  caveats: readonly string[];
}

export type MuxinDecision = "pending" | "adopted" | "declined";
export type VentureGate = "blocked" | "ready" | "accepted" | "rejected";

export interface VentureProposalObservation {
  basisRecordIds: readonly string[];
  factualSummary: string;
}

export interface VentureProposalInterpretation {
  proposedInput: string;
  rationale: string;
  confidence: Confidence;
}

export interface VentureInputProposalInput {
  id: string;
  lineage: BlueprintLineage;
  observation: VentureProposalObservation;
  interpretation: VentureProposalInterpretation;
  caveats: readonly string[];
  evidence: Evidence;
  muxinDecision: MuxinDecision;
  ventureGate: VentureGate;
}

export interface VentureInputProposal {
  kind: "venture_input_proposal";
  id: string;
  lineage: BlueprintLineage;
  observation: VentureProposalObservation;
  interpretation: VentureProposalInterpretation;
  caveats: readonly string[];
  evidence: Evidence;
  /** Muxin's editorial/business decision. This is not the Venture gate. */
  muxinDecision: MuxinDecision;
  /** Venture's separate intake gate. This is not Muxin's decision. */
  ventureGate: VentureGate;
}

export interface HandoffAssessment {
  status: "blocked" | "ready";
  blockers: readonly string[];
  /** The effective gate after checking the handoff prerequisites. */
  ventureGate: VentureGate;
}

export interface BlueprintLearningPacketInput {
  blueprint: {
    id: string;
    publishedAt: string;
    lineage: BlueprintLineage;
  };
  commentObservations: readonly CommentObservation[];
  funnelEvents: readonly FunnelEvent[];
  businessOutcomes: readonly BusinessOutcome[];
  ventureInputProposal: VentureInputProposal;
}

export interface BlueprintLearningPacket {
  kind: "content_learning_packet";
  version: typeof LEARNING_PACKET_VERSION;
  blueprint: {
    id: string;
    publishedAt: string;
    lineage: BlueprintLineage;
  };
  lineage: BlueprintLineage;
  commentObservations: readonly CommentObservation[];
  funnelEvents: readonly FunnelEvent[];
  businessOutcomes: readonly BusinessOutcome[];
  ventureInputProposal: VentureInputProposal;
  handoff: HandoffAssessment;
}

export class LearningPacketValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LearningPacketValidationError";
  }
}

const EVIDENCE_STATUSES: readonly EvidenceStatus[] = [
  "observed",
  "reported",
  "self_reported",
  "verified",
  "inferred",
  "missing",
];

const CONFIDENCES: readonly Confidence[] = ["low", "medium", "high"];
const COMMENT_QUALIFICATIONS: readonly CommentQualificationStatus[] = ["qualified", "not_qualified", "uncertain"];
const FUNNEL_EVENT_TYPES: readonly FunnelEventType[] = [
  "visit",
  "opt_in",
  "survey_response",
  "qualified_inquiry",
  "call",
  "opportunity",
  "purchase",
];
const BUSINESS_OUTCOME_TYPES: readonly BusinessOutcomeType[] = ["qualified_inquiry", "call", "opportunity", "purchase"];
const MUXIN_DECISIONS: readonly MuxinDecision[] = ["pending", "adopted", "declined"];
const VENTURE_GATES: readonly VentureGate[] = ["blocked", "ready", "accepted", "rejected"];

function fail(message: string): never {
  throw new LearningPacketValidationError(message);
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
  if (value === null || value === undefined) return null;
  return text(value, field);
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) fail(`${field} must be one of ${allowed.join(", ")}`);
  return value as T;
}

function iso(value: unknown, field: string): string {
  const normalized = text(value, field);
  if (Number.isNaN(Date.parse(normalized))) fail(`${field} must be a valid timestamp`);
  return normalized;
}

function nonNegativeNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) fail(`${field} must be a non-negative finite number`);
  return value;
}

function nullableNumber(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  return nonNegativeNumber(value, field);
}

function strings(value: unknown, field: string, sort = false): string[] {
  if (!Array.isArray(value)) fail(`${field} must be an array`);
  const normalized = value.map((item, index) => text(item, `${field}[${index}]`));
  return sort ? [...new Set(normalized)].sort((a, b) => a.localeCompare(b)) : normalized;
}

function normalizeLineage(value: unknown): BlueprintLineage {
  const input = object(value, "lineage");
  return {
    sourceId: text(input.sourceId, "lineage.sourceId"),
    variantId: text(input.variantId, "lineage.variantId"),
    experimentId: text(input.experimentId, "lineage.experimentId"),
  };
}

function completeLineage(value: unknown): value is BlueprintLineage {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  return [input.sourceId, input.variantId, input.experimentId].every((item) => typeof item === "string" && item.trim() !== "");
}

function sameLineage(left: BlueprintLineage, right: BlueprintLineage): boolean {
  return left.sourceId === right.sourceId && left.variantId === right.variantId && left.experimentId === right.experimentId;
}

function normalizeEvidence(value: unknown): Evidence {
  const input = object(value, "evidence");
  const status = enumValue(input.status, EVIDENCE_STATUSES, "evidence.status");
  const refs = strings(input.refs, "evidence.refs", true);
  const note = optionalText(input.note, "evidence.note");
  if (status === "missing" && refs.length > 0) fail("missing evidence cannot carry evidence refs");
  if (status !== "missing" && refs.length === 0) fail("evidence refs are required when evidence is present");
  return { status, refs, note };
}

function normalizeInterpretation(value: unknown, field = "interpretation"): Interpretation {
  const input = object(value, field);
  return {
    summary: text(input.summary, `${field}.summary`),
    confidence: enumValue(input.confidence, CONFIDENCES, `${field}.confidence`),
  };
}

function normalizeOptionalInterpretation(value: unknown): Interpretation | null {
  if (value === null || value === undefined) return null;
  return normalizeInterpretation(value);
}

function normalizeCaveats(value: unknown): string[] {
  return strings(value, "caveats", true);
}

function normalizeCommentObservationFacts(value: unknown): CommentObservationFacts {
  const input = object(value, "observation");
  return {
    sourcePlatform: text(input.sourcePlatform, "observation.sourcePlatform"),
    surface: text(input.surface, "observation.surface"),
    commentId: text(input.commentId, "observation.commentId"),
    observedAt: iso(input.observedAt, "observation.observedAt"),
    text: text(input.text, "observation.text"),
  };
}

function normalizeCommentQualification(value: unknown): CommentQualification {
  const input = object(value, "qualification");
  return {
    status: enumValue(input.status, COMMENT_QUALIFICATIONS, "qualification.status"),
    basis: text(input.basis, "qualification.basis"),
  };
}

function normalizeFunnelFacts(value: unknown): FunnelEventFacts {
  const input = object(value, "observation");
  const valueNumber = input.value;
  return {
    eventType: enumValue(input.eventType, FUNNEL_EVENT_TYPES, "observation.eventType"),
    occurredAt: iso(input.occurredAt, "observation.occurredAt"),
    source: text(input.source, "observation.source"),
    value: valueNumber === null || valueNumber === undefined ? null : nonNegativeNumber(valueNumber, "observation.value"),
  };
}

function normalizeBusinessOutcomeFacts(value: unknown): BusinessOutcomeFacts {
  const input = object(value, "observation");
  const currency = optionalText(input.currency, "observation.currency");
  const amount = nullableNumber(input.amount, "observation.amount");
  if (amount !== null && currency === null) fail("observation.currency is required when observation.amount is present");
  return {
    outcomeType: enumValue(input.outcomeType, BUSINESS_OUTCOME_TYPES, "observation.outcomeType"),
    occurredAt: iso(input.occurredAt, "observation.occurredAt"),
    source: text(input.source, "observation.source"),
    amount,
    currency: currency?.toUpperCase() ?? null,
  };
}

function normalizeProposalObservation(value: unknown): VentureProposalObservation {
  const input = object(value, "observation");
  const basisRecordIds = strings(input.basisRecordIds, "observation.basisRecordIds", true);
  if (basisRecordIds.length === 0) fail("observation.basisRecordIds must not be empty");
  return {
    basisRecordIds,
    factualSummary: text(input.factualSummary, "observation.factualSummary"),
  };
}

function normalizeProposalInterpretation(value: unknown): VentureProposalInterpretation {
  const input = object(value, "interpretation");
  return {
    proposedInput: text(input.proposedInput, "interpretation.proposedInput"),
    rationale: text(input.rationale, "interpretation.rationale"),
    confidence: enumValue(input.confidence, CONFIDENCES, "interpretation.confidence"),
  };
}

function assertId(value: unknown): string {
  return text(value, "id");
}

/** Build one comment record, forcing the WTP interpretation to remain caveated. */
export function buildCommentObservation(input: CommentObservationInput): CommentObservation {
  const source = object(input, "comment observation");
  const interpretationInput = object(source.interpretation, "interpretation");
  const suppliedWillingness = interpretationInput.willingnessToPay;
  if (suppliedWillingness !== undefined && suppliedWillingness !== "not_proven_by_comment") {
    fail("comments do not prove willingness to pay");
  }
  const interpretation = normalizeInterpretation(source.interpretation);
  return {
    kind: "comment_observation",
    id: assertId(source.id),
    lineage: normalizeLineage(source.lineage),
    observation: normalizeCommentObservationFacts(source.observation),
    qualification: normalizeCommentQualification(source.qualification),
    interpretation: { ...interpretation, willingnessToPay: "not_proven_by_comment" },
    evidence: normalizeEvidence(source.evidence),
    caveats: normalizeCaveats(source.caveats),
  };
}

/** Build one attributable funnel event without interpreting it as a business result. */
export function buildFunnelEvent(input: FunnelEventInput): FunnelEvent {
  const source = object(input, "funnel event");
  return {
    kind: "funnel_event",
    id: assertId(source.id),
    lineage: normalizeLineage(source.lineage),
    observation: normalizeFunnelFacts(source.observation),
    interpretation: normalizeOptionalInterpretation(source.interpretation),
    evidence: normalizeEvidence(source.evidence),
    caveats: normalizeCaveats(source.caveats),
  };
}

/** Build a business outcome as its own family; it is never folded into attention or conversation. */
export function buildBusinessOutcome(input: BusinessOutcomeInput): BusinessOutcome {
  const source = object(input, "business outcome");
  return {
    kind: "business_outcome",
    id: assertId(source.id),
    lineage: normalizeLineage(source.lineage),
    observation: normalizeBusinessOutcomeFacts(source.observation),
    interpretation: normalizeOptionalInterpretation(source.interpretation),
    evidence: normalizeEvidence(source.evidence),
    caveats: normalizeCaveats(source.caveats),
  };
}

/** Build a Venture proposal while requiring both human state machines to be explicit. */
export function buildVentureInputProposal(input: VentureInputProposalInput): VentureInputProposal {
  const source = object(input, "Venture input proposal");
  if (!Object.hasOwn(source, "muxinDecision") || source.muxinDecision === undefined) fail("muxinDecision is required");
  if (!Object.hasOwn(source, "ventureGate") || source.ventureGate === undefined) fail("ventureGate is required");
  const muxinDecision = enumValue(source.muxinDecision, MUXIN_DECISIONS, "muxinDecision");
  const ventureGate = enumValue(source.ventureGate, VENTURE_GATES, "ventureGate");
  if (ventureGate === "accepted" && muxinDecision !== "adopted") {
    fail("an accepted Venture gate requires an adopted Muxin decision");
  }
  return {
    kind: "venture_input_proposal",
    id: assertId(source.id),
    lineage: normalizeLineage(source.lineage),
    observation: normalizeProposalObservation(source.observation),
    interpretation: normalizeProposalInterpretation(source.interpretation),
    caveats: normalizeCaveats(source.caveats),
    evidence: normalizeEvidence(source.evidence),
    muxinDecision,
    ventureGate,
  };
}

/**
 * Check handoff readiness without changing the caller's records. Missing lineage/evidence always
 * wins over an asserted accepted gate, so an incomplete packet cannot look ready by declaration.
 */
export function assessVentureHandoff(input: {
  lineage: BlueprintLineage | Partial<Record<keyof BlueprintLineage, string | null>> | null | undefined;
  evidence: Evidence | null | undefined;
  muxinDecision: MuxinDecision;
  ventureGate: VentureGate;
}): HandoffAssessment {
  const source = object(input, "handoff");
  const muxinDecision = enumValue(source.muxinDecision, MUXIN_DECISIONS, "muxinDecision");
  const ventureGate = enumValue(source.ventureGate, VENTURE_GATES, "ventureGate");
  const blockers: string[] = [];

  if (!completeLineage(source.lineage)) blockers.push("source, variant, and experiment lineage are required");

  let evidence: Evidence | null = null;
  if (source.evidence !== null && source.evidence !== undefined) evidence = normalizeEvidence(source.evidence);
  if (evidence === null || evidence.status === "missing" || evidence.refs.length === 0) blockers.push("evidence is missing");

  if (muxinDecision === "pending") blockers.push("Muxin decision is pending");
  if (muxinDecision === "declined") blockers.push("Muxin declined the proposal");
  if (ventureGate === "blocked") blockers.push("Venture gate is blocked");
  if (ventureGate === "rejected") blockers.push("Venture gate is rejected");

  return {
    status: blockers.length === 0 ? "ready" : "blocked",
    blockers,
    ventureGate: blockers.length === 0 ? ventureGate : "blocked",
  };
}

function sortedUniqueRecords<T extends { id: string }>(records: readonly T[], field: string): T[] {
  const copy = [...records];
  const ids = copy.map((record) => record.id);
  if (new Set(ids).size !== ids.length) fail(`${field} ids must be unique`);
  return copy.sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeCommentRecord(value: unknown): CommentObservation {
  return buildCommentObservation(value as CommentObservationInput);
}

function normalizeFunnelRecord(value: unknown): FunnelEvent {
  return buildFunnelEvent(value as FunnelEventInput);
}

function normalizeOutcomeRecord(value: unknown): BusinessOutcome {
  return buildBusinessOutcome(value as BusinessOutcomeInput);
}

/** Build a deterministic packet and derive a conservative handoff assessment. */
export function buildBlueprintLearningPacket(input: BlueprintLearningPacketInput): BlueprintLearningPacket {
  const source = object(input, "learning packet");
  const blueprintInput = object(source.blueprint, "blueprint");
  const blueprintLineage = normalizeLineage(blueprintInput.lineage);
  const commentObservations = sortedUniqueRecords(
    (Array.isArray(source.commentObservations) ? source.commentObservations : fail("commentObservations must be an array")).map(normalizeCommentRecord),
    "commentObservations",
  );
  const funnelEvents = sortedUniqueRecords(
    (Array.isArray(source.funnelEvents) ? source.funnelEvents : fail("funnelEvents must be an array")).map(normalizeFunnelRecord),
    "funnelEvents",
  );
  const businessOutcomes = sortedUniqueRecords(
    (Array.isArray(source.businessOutcomes) ? source.businessOutcomes : fail("businessOutcomes must be an array")).map(normalizeOutcomeRecord),
    "businessOutcomes",
  );
  const ventureInputProposal = buildVentureInputProposal(source.ventureInputProposal as VentureInputProposalInput);

  const recordIds = new Set([
    ...commentObservations.map((record) => record.id),
    ...funnelEvents.map((record) => record.id),
    ...businessOutcomes.map((record) => record.id),
  ]);
  const missingBasisRecords = ventureInputProposal.observation.basisRecordIds.filter((id) => !recordIds.has(id));
  if (missingBasisRecords.length > 0) {
    fail(`ventureInputProposal cites missing basis records: ${missingBasisRecords.join(", ")}`);
  }

  for (const [field, records] of [
    ["commentObservations", commentObservations],
    ["funnelEvents", funnelEvents],
    ["businessOutcomes", businessOutcomes],
  ] as const) {
    for (const record of records) {
      if (!sameLineage(record.lineage, blueprintLineage)) fail(`${field} record ${record.id} does not preserve blueprint lineage`);
    }
  }
  if (!sameLineage(ventureInputProposal.lineage, blueprintLineage)) {
    fail("ventureInputProposal does not preserve blueprint lineage");
  }

  const handoff = assessVentureHandoff({
    lineage: blueprintLineage,
    evidence: ventureInputProposal.evidence,
    muxinDecision: ventureInputProposal.muxinDecision,
    ventureGate: ventureInputProposal.ventureGate,
  });

  return {
    kind: "content_learning_packet",
    version: LEARNING_PACKET_VERSION,
    blueprint: {
      id: text(blueprintInput.id, "blueprint.id"),
      publishedAt: iso(blueprintInput.publishedAt, "blueprint.publishedAt"),
      lineage: blueprintLineage,
    },
    lineage: { ...blueprintLineage },
    commentObservations,
    funnelEvents,
    businessOutcomes,
    ventureInputProposal,
    handoff,
  };
}
