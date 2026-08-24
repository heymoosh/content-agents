/**
 * A pure review handoff for the Grow Phase 3 contract.
 *
 * This module only normalizes references, metadata, and the human decision. It never reads a
 * source body, creates copy, persists a row, queues work, schedules, or publishes anything.
 */

export const GROW_REVIEW_BUNDLE_VERSION = "grow-review-bundle-v1" as const;

export type GrowReviewBundleStatus = "candidate" | "approved" | "rejected" | "needs-another-pass";
export type GrowReviewCheck = "pending" | "passed" | "failed" | "not-run";
export type GrowReviewEvidenceStatus = "supported" | "hypothesis" | "insufficient" | "blocked";

export interface GrowReviewReference {
  recordType: string;
  id: string;
  relation: string | null;
}

export type GrowReviewReferenceInput =
  | string
  | {
    recordType?: string;
    record_type?: string;
    id?: string;
    relation?: string | null;
  };

export interface GrowReviewReadiness {
  status: "ready" | "blocked";
  blockingFields: string[];
  reason: string;
}

export interface GrowReviewReadinessInput {
  status?: "ready" | "blocked" | string;
  blockingFields?: readonly string[] | null;
  blocking_fields?: readonly string[] | null;
  reason?: string | null;
}

export interface GrowReviewEvidenceInput {
  status?: GrowReviewEvidenceStatus | string | null;
  refs?: readonly string[] | null;
  note?: string | null;
}

export interface GrowHumanReviewDecision {
  status: GrowReviewBundleStatus;
  decidedBy: "muxin" | null;
  decidedAt: string | null;
  note: string | null;
}

export interface GrowHumanReviewDecisionInput {
  status?: GrowReviewBundleStatus | string;
  decidedBy?: string | null;
  decided_by?: string | null;
  decidedAt?: string | null;
  decided_at?: string | null;
  note?: string | null;
}

export type GrowReviewLineageInput =
  | readonly GrowReviewReferenceInput[]
  | {
    sourceId?: string | null;
    cutId?: string | null;
    variantId?: string | null;
    publishId?: string | null;
    source_id?: string | null;
    cut_id?: string | null;
    variant_id?: string | null;
    publish_id?: string | null;
  };

export interface GrowReviewBundleInput {
  id: string;
  sourceRef?: GrowReviewReferenceInput | null;
  source?: GrowReviewReferenceInput | null;
  cutRef?: GrowReviewReferenceInput | null;
  cut?: GrowReviewReferenceInput | null;
  variantRefs?: readonly GrowReviewReferenceInput[] | null;
  variants?: readonly GrowReviewReferenceInput[] | null;
  publishRefs?: readonly GrowReviewReferenceInput[] | null;
  publishRef?: GrowReviewReferenceInput | null;
  publish?: readonly GrowReviewReferenceInput[] | GrowReviewReferenceInput | null;
  lineage?: GrowReviewLineageInput | null;

  evidence?: GrowReviewEvidenceInput | null;
  evidenceStatus?: GrowReviewEvidenceStatus | string | null;
  evidenceRefs?: readonly string[] | null;
  evidenceNote?: string | null;

  voiceCheck?: GrowReviewCheck | string | null;
  originalityCheck?: GrowReviewCheck | string | null;
  readiness?: GrowReviewReadinessInput | null;
  humanDecision?: GrowHumanReviewDecisionInput | null;
  decision?: GrowHumanReviewDecisionInput | null;
  status?: GrowReviewBundleStatus | string;
  decidedBy?: string | null;
  decided_by?: string | null;
  decidedAt?: string | null;
  decided_at?: string | null;
  decisionNote?: string | null;
}

export interface GrowReviewBundle {
  kind: "grow_review_bundle";
  version: typeof GROW_REVIEW_BUNDLE_VERSION;
  id: string;
  sourceRef: GrowReviewReference;
  cutRef: GrowReviewReference;
  variantRefs: GrowReviewReference[];
  publishRefs: GrowReviewReference[] | null;
  lineage: GrowReviewReference[] | null;
  evidenceStatus: GrowReviewEvidenceStatus;
  evidenceRefs: string[];
  evidenceNote: string | null;
  voiceCheck: GrowReviewCheck;
  originalityCheck: GrowReviewCheck;
  readiness: GrowReviewReadiness;
  humanDecision: GrowHumanReviewDecision;
  status: GrowReviewBundleStatus;
  generatesCopy: false;
  sideEffects: "none";
}

const BUNDLE_STATUSES = new Set<GrowReviewBundleStatus>([
  "candidate",
  "approved",
  "rejected",
  "needs-another-pass",
]);
const REVIEW_CHECKS = new Set<GrowReviewCheck>(["pending", "passed", "failed", "not-run"]);
const EVIDENCE_STATUSES = new Set<GrowReviewEvidenceStatus>(["supported", "hypothesis", "insufficient", "blocked"]);

export class GrowReviewBundleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GrowReviewBundleValidationError";
  }
}

function fail(message: string): never {
  throw new GrowReviewBundleValidationError(message);
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${field} must be an object`);
  }
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

function sortedUniqueStrings(value: unknown, field: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) fail(`${field} must be an array or null`);
  return [...new Set(value.map((item, index) => text(item, `${field}[${index}]`)))].sort((left, right) => left.localeCompare(right));
}

function iso(value: unknown, field: string): string {
  const normalized = text(value, field);
  if (Number.isNaN(Date.parse(normalized))) fail(`${field} must be a valid timestamp`);
  return normalized;
}

function enumValue<T extends string>(value: unknown, allowed: ReadonlySet<T>, field: string): T {
  if (typeof value !== "string") fail(`${field} is required`);
  const normalized = value.trim().toLowerCase().replace(/[_ ]/g, "-") as T;
  if (!allowed.has(normalized)) fail(`${field} must be one of ${[...allowed].join(", ")}`);
  return normalized;
}

function normalizeCheck(value: unknown, field: string): GrowReviewCheck {
  if (value === undefined || value === null) return "pending";
  const normalized = String(value).trim().toLowerCase().replace(/[_ ]/g, "-");
  const aliases: Record<string, GrowReviewCheck> = {
    pass: "passed",
    approved: "passed",
    fail: "failed",
  };
  const check = aliases[normalized] ?? normalized;
  if (!REVIEW_CHECKS.has(check as GrowReviewCheck)) {
    fail(`${field} must be one of pending, passed, failed, or not-run`);
  }
  return check as GrowReviewCheck;
}

function normalizeReference(value: unknown, field: string, expectedType?: string): GrowReviewReference {
  if (typeof value === "string") {
    return { recordType: expectedType ?? "unknown", id: text(value, `${field}.id`), relation: null };
  }
  const input = object(value, field);
  const recordType = optionalText(input.recordType ?? input.record_type, `${field}.recordType`)
    ?? expectedType
    ?? fail(`${field}.recordType is required`);
  if (expectedType !== undefined && recordType !== expectedType) {
    fail(`${field}.recordType must be ${expectedType}`);
  }
  return {
    recordType,
    id: text(input.id, `${field}.id`),
    relation: optionalText(input.relation, `${field}.relation`),
  };
}

function referenceKey(reference: GrowReviewReference): string {
  return `${reference.recordType}\u0000${reference.id}\u0000${reference.relation ?? ""}`;
}

function sortedUniqueReferences(values: readonly GrowReviewReference[]): GrowReviewReference[] {
  const unique = new Map<string, GrowReviewReference>();
  for (const value of values) unique.set(referenceKey(value), value);
  return [...unique.values()].sort((left, right) =>
    left.recordType.localeCompare(right.recordType)
    || left.id.localeCompare(right.id)
    || (left.relation ?? "").localeCompare(right.relation ?? ""));
}

function normalizeReferenceList(value: unknown, field: string, expectedType: string): GrowReviewReference[] {
  if (!Array.isArray(value)) fail(`${field} must be an array`);
  return sortedUniqueReferences(value.map((item, index) => normalizeReference(item, `${field}[${index}]`, expectedType)));
}

function normalizeOptionalReferenceList(value: unknown, field: string, expectedType: string): GrowReviewReference[] | null {
  if (value === undefined || value === null) return null;
  const normalized = normalizeReferenceList(value, field, expectedType);
  return normalized.length === 0 ? null : normalized;
}

function normalizeLineage(value: unknown): GrowReviewReference[] | null {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) {
    const normalized = value.map((item, index) => normalizeReference(item, `lineage[${index}]`));
    const deduped = sortedUniqueReferences(normalized);
    return deduped.length === 0 ? null : deduped;
  }

  const input = object(value, "lineage");
  const fields: Array<[string, string, string]> = [
    ["sourceId", "source_id", "source"],
    ["cutId", "cut_id", "cut"],
    ["variantId", "variant_id", "variant"],
    ["publishId", "publish_id", "publish"],
  ];
  const normalized = fields.flatMap(([camel, snake, type]) => {
    const id = input[camel] ?? input[snake];
    return id === undefined || id === null ? [] : [normalizeReference(id, `lineage.${camel}`, type)];
  });
  return normalized.length === 0 ? null : sortedUniqueReferences(normalized);
}

function normalizeEvidence(input: GrowReviewBundleInput): {
  status: GrowReviewEvidenceStatus;
  refs: string[];
  note: string | null;
} {
  const nested = input.evidence;
  const nestedRecord = nested === null || nested === undefined ? null : object(nested, "evidence");
  const statusValue = input.evidenceStatus ?? nestedRecord?.status ?? "blocked";
  const refsValue = input.evidenceRefs ?? nestedRecord?.refs ?? [];
  const noteValue = input.evidenceNote ?? nestedRecord?.note;
  return {
    status: enumValue(statusValue, EVIDENCE_STATUSES, "evidenceStatus"),
    refs: sortedUniqueStrings(refsValue, "evidenceRefs"),
    note: optionalText(noteValue, "evidenceNote"),
  };
}

function normalizeReadiness(value: unknown): GrowReviewReadinessInput | null {
  if (value === undefined || value === null) return null;
  const input = object(value, "readiness");
  const status = input.status === undefined || input.status === null
    ? undefined
    : enumValue(input.status, new Set(["ready", "blocked"] as const), "readiness.status");
  const blockingFields = sortedUniqueStrings(input.blockingFields ?? input.blocking_fields, "readiness.blockingFields");
  return {
    status,
    blockingFields,
    reason: optionalText(input.reason, "readiness.reason"),
  };
}

function normalizeDecision(input: GrowReviewBundleInput): GrowHumanReviewDecision {
  const decisionInput = input.humanDecision ?? input.decision;
  const decision = decisionInput === null || decisionInput === undefined
    ? null
    : object(decisionInput, "humanDecision");
  const hasNestedDecision = decision !== null;
  const statusValue = decision?.status ?? (hasNestedDecision ? undefined : input.status) ?? "candidate";
  const status = enumValue(statusValue, BUNDLE_STATUSES, "humanDecision.status");
  const decidedByValue = decision?.decidedBy ?? decision?.decided_by ?? input.decidedBy ?? input.decided_by;
  const decidedAtValue = decision?.decidedAt ?? decision?.decided_at ?? input.decidedAt ?? input.decided_at;
  const noteValue = decision?.note ?? input.decisionNote;

  if (status === "candidate") {
    if (decidedByValue !== undefined && decidedByValue !== null) fail("candidate humanDecision cannot have decidedBy");
    if (decidedAtValue !== undefined && decidedAtValue !== null) fail("candidate humanDecision cannot have decidedAt");
    return { status, decidedBy: null, decidedAt: null, note: null };
  }

  const decidedBy = optionalText(decidedByValue, "humanDecision.decidedBy");
  if (decidedBy === null || decidedBy.toLowerCase() !== "muxin") {
    fail(`${status} requires human review decidedBy muxin`);
  }
  const decidedAt = decidedAtValue === undefined || decidedAtValue === null
    ? null
    : iso(decidedAtValue, "humanDecision.decidedAt");
  if (decidedAt === null) fail(`${status} requires humanDecision.decidedAt`);
  return {
    status,
    decidedBy: "muxin",
    decidedAt,
    note: optionalText(noteValue, "humanDecision.note"),
  };
}

function lineageBlockers(
  lineage: GrowReviewReference[] | null,
  sourceRef: GrowReviewReference,
  cutRef: GrowReviewReference,
  variantRefs: readonly GrowReviewReference[],
): string[] {
  if (lineage === null) return ["lineage"];
  const blockers: string[] = [];
  if (!lineage.some((ref) => ref.recordType === sourceRef.recordType && ref.id === sourceRef.id)) blockers.push("lineage.sourceRef");
  if (!lineage.some((ref) => ref.recordType === cutRef.recordType && ref.id === cutRef.id)) blockers.push("lineage.cutRef");
  if (variantRefs.some((variant) => !lineage.some((ref) => ref.recordType === variant.recordType && ref.id === variant.id))) {
    blockers.push("lineage.variantRefs");
  }
  if (lineage.length === 0) blockers.push("lineage");
  return blockers;
}

function readinessFor(
  inputReadiness: GrowReviewReadinessInput | null,
  evidenceStatus: GrowReviewEvidenceStatus,
  evidenceRefs: readonly string[],
  voiceCheck: GrowReviewCheck,
  originalityCheck: GrowReviewCheck,
  humanDecision: GrowHumanReviewDecision,
  lineage: GrowReviewReference[] | null,
  sourceRef: GrowReviewReference,
  cutRef: GrowReviewReference,
  variantRefs: readonly GrowReviewReference[],
): GrowReviewReadiness {
  const blockers = [...(inputReadiness?.blockingFields ?? [])];
  if (inputReadiness?.status === "blocked" && blockers.length === 0) blockers.push("readiness");
  blockers.push(...lineageBlockers(lineage, sourceRef, cutRef, variantRefs));
  if (evidenceStatus !== "supported") blockers.push("evidenceStatus");
  if (evidenceRefs.length === 0) blockers.push("evidenceRefs");
  if (voiceCheck !== "passed") blockers.push("voiceCheck");
  if (originalityCheck !== "passed") blockers.push("originalityCheck");
  if (humanDecision.status === "candidate") blockers.push("humanReview");

  const blockingFields = [...new Set(blockers)].sort((left, right) => left.localeCompare(right));
  return {
    status: blockingFields.length === 0 ? "ready" : "blocked",
    blockingFields,
    reason: blockingFields.length === 0
      ? "All review and approval prerequisites are present."
      : `Blocked: ${blockingFields.join(", ")}.`,
  };
}

/** Build a deterministic, reference-only Grow review bundle. */
export function buildGrowReviewBundle(input: GrowReviewBundleInput): GrowReviewBundle {
  const source = object(input, "review bundle");
  const sourceValue = input.sourceRef ?? input.source;
  const cutValue = input.cutRef ?? input.cut;
  if (sourceValue === undefined || sourceValue === null) fail("sourceRef is required");
  if (cutValue === undefined || cutValue === null) fail("cutRef is required");

  const sourceRef = normalizeReference(sourceValue, "sourceRef", "source");
  const cutRef = normalizeReference(cutValue, "cutRef", "cut");
  const variantsValue = input.variantRefs ?? input.variants;
  if (variantsValue === undefined || variantsValue === null) fail("variantRefs is required");
  const variantRefs = normalizeReferenceList(variantsValue, "variantRefs", "variant");
  if (variantRefs.length === 0) fail("variantRefs must not be empty");

  const publishValue = input.publishRefs
    ?? (input.publishRef === undefined || input.publishRef === null
      ? (Array.isArray(input.publish) ? input.publish : input.publish === undefined ? null : input.publish === null ? null : [input.publish])
      : [input.publishRef]);
  const publishRefs = normalizeOptionalReferenceList(publishValue, "publishRefs", "publish");
  const lineage = normalizeLineage(input.lineage);
  const evidence = normalizeEvidence(input);
  const voiceCheck = normalizeCheck(input.voiceCheck, "voiceCheck");
  const originalityCheck = normalizeCheck(input.originalityCheck, "originalityCheck");
  const humanDecision = normalizeDecision(input);
  const readiness = readinessFor(
    normalizeReadiness(input.readiness),
    evidence.status,
    evidence.refs,
    voiceCheck,
    originalityCheck,
    humanDecision,
    lineage,
    sourceRef,
    cutRef,
    variantRefs,
  );
  if (humanDecision.status === "approved" && readiness.status !== "ready") {
    fail(`approval is blocked: ${readiness.blockingFields.join(", ")}`);
  }

  return {
    kind: "grow_review_bundle",
    version: GROW_REVIEW_BUNDLE_VERSION,
    id: text(source.id, "id"),
    sourceRef,
    cutRef,
    variantRefs,
    publishRefs,
    lineage,
    evidenceStatus: evidence.status,
    evidenceRefs: evidence.refs,
    evidenceNote: evidence.note,
    voiceCheck,
    originalityCheck,
    readiness,
    humanDecision,
    status: humanDecision.status,
    generatesCopy: false,
    sideEffects: "none",
  };
}

export const createGrowReviewBundle = buildGrowReviewBundle;
export const buildReviewBundle = buildGrowReviewBundle;
