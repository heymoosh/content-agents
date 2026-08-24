/**
 * A read-only, body-free pointer from Content to a Venture input.
 *
 * This module is deliberately a pure seam. It does not read or write a venture directory,
 * create an artifact, unlock a phase, approve publication, change strategy, or select a Venture
 * decision. A new pointer is a new append-only value; callers own persistence, if any.
 */

export const VENTURE_INPUT_POINTER_FIELDS = [
  "id",
  "ventureId",
  "phase",
  "inputKind",
  "sourceRecordRefs",
  "evidenceRefs",
  "contentItemRefs",
  "scope",
  "sampleSize",
  "provenance",
  "caveats",
  "contentHumanDecision",
  "ventureGate",
  "ventureDecision",
  "status",
  "lineage",
] as const;

export type VentureInputPointerField = typeof VENTURE_INPUT_POINTER_FIELDS[number];
export type VentureInputStatus = "pending" | "hypothesis" | "needs-more-evidence" | "ready" | "rejected";
export type ContentHumanDecisionStatus = "pending" | "approved" | "rejected";
export type VentureDecisionOutcome = "accept" | "reject" | "request-more-evidence";

export interface ContentHumanDecision {
  readonly status: ContentHumanDecisionStatus;
  readonly decidedBy: "muxin" | null;
  readonly decisionRef: string | null;
  readonly decidedAt: string | null;
}

export interface VentureGate {
  readonly status: "open" | "blocked";
  readonly gateRef: string;
}

export interface VentureDecisionFact {
  readonly outcome: VentureDecisionOutcome;
  readonly factRef: string;
  readonly independent: true;
  readonly evidenceRefs: readonly string[];
  readonly decidedAt: string;
}

export interface VentureInputLineage {
  readonly owner: "content";
  readonly pointerId: string;
  readonly ventureId: string;
  readonly phase: number;
  readonly inputKind: string;
  readonly sourceRecordRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly contentItemRefs: readonly string[];
}

export interface VentureInputPointer {
  readonly id: string;
  readonly ventureId: string;
  readonly phase: number;
  readonly inputKind: string;
  readonly sourceRecordRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly contentItemRefs: readonly string[];
  readonly scope: string;
  readonly sampleSize: number;
  readonly provenance: string;
  readonly caveats: readonly string[];
  readonly contentHumanDecision: ContentHumanDecision | null;
  readonly ventureGate: VentureGate;
  readonly ventureDecision: VentureDecisionFact | null;
  readonly status: VentureInputStatus;
  readonly lineage: VentureInputLineage;
}

export interface VentureInputReadiness {
  readonly kind: "venture_input_readiness";
  readonly pointer: VentureInputPointer;
  readonly status: VentureInputStatus;
  readonly ready: boolean;
  readonly blockers: readonly string[];
  readonly contentApproval: ContentHumanDecisionStatus | "not-recorded";
  readonly ventureDecision: {
    readonly outcome: VentureDecisionOutcome;
    readonly factRef: string;
  } | null;
  readonly safety: {
    readonly owner: "content";
    readonly appendOnly: true;
    readonly bodyFree: true;
    readonly readOnly: true;
    readonly directWrites: false;
    readonly createsArtifacts: false;
    readonly unlocksPhase: false;
    readonly approvesPublish: false;
    readonly changesStrategy: false;
  };
}

export class VentureInputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VentureInputValidationError";
  }
}

const FORBIDDEN_FIELD_TOKEN = /body|comment|model|ranking|winner/i;

function fail(message: string): never {
  throw new VentureInputValidationError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function scanForbiddenFields(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForbiddenFields(entry, `${path}[${index}]`));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_FIELD_TOKEN.test(key)) {
      fail(`field "${key}" at ${path} is forbidden by the body-free allowlist`);
    }
    scanForbiddenFields(entry, `${path}.${key}`);
  }
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value)) fail(`${field} must be an object`);
  return value;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") fail(`${field} must be a non-empty string`);
  return value;
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  return requiredString(value, field);
}

function integer(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || !Number.isFinite(value)) {
    fail(`${field} must be an integer`);
  }
  return value;
}

function refList(value: unknown, field: string, requireOne: boolean): string[] {
  if (!Array.isArray(value)) fail(`${field} must be an array of refs`);
  if (requireOne && value.length === 0) fail(`${field} must contain at least one ref`);
  const refs = value.map((entry, index) => requiredString(entry, `${field}[${index}]`));
  if (new Set(refs).size !== refs.length) fail(`${field} must contain unique refs`);
  return refs;
}

function stringList(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) fail(`${field} must be an array of strings`);
  return value.map((entry, index) => requiredString(entry, `${field}[${index}]`));
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], field: string): void {
  const allow = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allow.has(key)) fail(`${field}.${key} is not in the strict allowlist`);
  }
}

function contentDecision(value: unknown): ContentHumanDecision | null {
  if (value === null) return null;
  const source = record(value, "contentHumanDecision");
  exactKeys(source, ["status", "decidedBy", "decisionRef", "decidedAt"], "contentHumanDecision");
  const status = source.status;
  if (status !== "pending" && status !== "approved" && status !== "rejected") {
    fail("contentHumanDecision.status must be pending, approved, or rejected");
  }
  const decidedBy = source.decidedBy;
  if (decidedBy !== null && decidedBy !== "muxin") {
    fail("contentHumanDecision.decidedBy must be muxin or null; Content approval cannot be inferred");
  }
  const decisionRef = nullableString(source.decisionRef, "contentHumanDecision.decisionRef");
  const decidedAt = nullableString(source.decidedAt, "contentHumanDecision.decidedAt");
  if (status === "pending" && (decidedBy !== null || decisionRef !== null || decidedAt !== null)) {
    fail("pending contentHumanDecision must not carry a decision");
  }
  if (status !== "pending" && (decidedBy !== "muxin" || decisionRef === null || decidedAt === null)) {
    fail("contentHumanDecision approval/rejection requires an explicit Muxin decision");
  }
  return { status, decidedBy, decisionRef, decidedAt };
}

function ventureGate(value: unknown): VentureGate {
  const source = record(value, "ventureGate");
  exactKeys(source, ["status", "gateRef"], "ventureGate");
  if (source.status !== "open" && source.status !== "blocked") {
    fail("ventureGate.status must be open or blocked");
  }
  return { status: source.status, gateRef: requiredString(source.gateRef, "ventureGate.gateRef") };
}

function ventureDecision(value: unknown): VentureDecisionFact | null {
  if (value === null) return null;
  const source = record(value, "ventureDecision");
  exactKeys(source, ["outcome", "factRef", "independent", "evidenceRefs", "decidedAt"], "ventureDecision");
  if (source.outcome !== "accept" && source.outcome !== "reject" && source.outcome !== "request-more-evidence") {
    fail("ventureDecision.outcome must be accept, reject, or request-more-evidence");
  }
  if (source.independent !== true) {
    fail("ventureDecision requires an independent Venture fact");
  }
  return {
    outcome: source.outcome,
    factRef: requiredString(source.factRef, "ventureDecision.factRef"),
    independent: true,
    evidenceRefs: refList(source.evidenceRefs, "ventureDecision.evidenceRefs", true),
    decidedAt: requiredString(source.decidedAt, "ventureDecision.decidedAt"),
  };
}

function lineage(value: unknown, pointer: {
  id: string;
  ventureId: string;
  phase: number;
  inputKind: string;
  sourceRecordRefs: readonly string[];
  evidenceRefs: readonly string[];
  contentItemRefs: readonly string[];
}): VentureInputLineage {
  const source = record(value, "lineage");
  exactKeys(source, [
    "owner", "pointerId", "ventureId", "phase", "inputKind", "sourceRecordRefs", "evidenceRefs", "contentItemRefs",
  ], "lineage");
  if (source.owner !== "content") fail("lineage.owner must be content");
  const pointerId = requiredString(source.pointerId, "lineage.pointerId");
  if (pointerId !== pointer.id) fail("lineage.pointerId must exactly match id");
  const ventureId = requiredString(source.ventureId, "lineage.ventureId");
  if (ventureId !== pointer.ventureId) fail("lineage.ventureId must exactly match ventureId");
  const phase = integer(source.phase, "lineage.phase");
  if (phase !== pointer.phase) fail("lineage.phase must exactly match phase");
  const inputKind = requiredString(source.inputKind, "lineage.inputKind");
  if (inputKind !== pointer.inputKind) fail("lineage.inputKind must exactly match inputKind");
  const sourceRecordRefs = refList(source.sourceRecordRefs, "lineage.sourceRecordRefs", true);
  const evidenceRefs = refList(source.evidenceRefs, "lineage.evidenceRefs", true);
  const contentItemRefs = refList(source.contentItemRefs, "lineage.contentItemRefs", false);
  if (!sameStrings(sourceRecordRefs, pointer.sourceRecordRefs)) fail("lineage.sourceRecordRefs must exactly match sourceRecordRefs");
  if (!sameStrings(evidenceRefs, pointer.evidenceRefs)) fail("lineage.evidenceRefs must exactly match evidenceRefs");
  if (!sameStrings(contentItemRefs, pointer.contentItemRefs)) fail("lineage.contentItemRefs must exactly match contentItemRefs");
  return { owner: "content", pointerId, ventureId, phase, inputKind, sourceRecordRefs, evidenceRefs, contentItemRefs };
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isCommentOnly(inputKind: string, sourceRecordRefs: readonly string[]): boolean {
  const kindIsComment = /comment|reply/i.test(inputKind);
  const refsAreComments = sourceRecordRefs.length > 0 && sourceRecordRefs.every((ref) => /comment|reply/i.test(ref));
  // A comment may point back to the content item that elicited it; that does not turn the
  // comment into independent market evidence. The source records, not the join target, decide
  // whether the input is comment-only.
  return kindIsComment || refsAreComments;
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) freezeDeep(nested);
    Object.freeze(value);
  }
  return value;
}

/** Validate, clone, and freeze one Content-owned pointer. No input object is mutated. */
export function createVentureInputPointer(input: unknown): VentureInputPointer {
  scanForbiddenFields(input, "pointer");
  const source = record(input, "pointer");
  exactKeys(source, VENTURE_INPUT_POINTER_FIELDS, "pointer");

  const id = requiredString(source.id, "id");
  const ventureId = requiredString(source.ventureId, "ventureId");
  const phase = integer(source.phase, "phase");
  if (phase < 1 || phase > 4) fail("phase must be an integer from 1 through 4");
  const inputKind = requiredString(source.inputKind, "inputKind");
  const sourceRecordRefs = refList(source.sourceRecordRefs, "sourceRecordRefs", true);
  const evidenceRefs = refList(source.evidenceRefs, "evidenceRefs", true);
  const contentItemRefs = refList(source.contentItemRefs, "contentItemRefs", false);
  const scope = requiredString(source.scope, "scope");
  const sampleSize = integer(source.sampleSize, "sampleSize");
  if (sampleSize < 1) fail("sampleSize must be a positive integer");
  const provenance = requiredString(source.provenance, "provenance");
  const caveats = stringList(source.caveats, "caveats");
  const contentHumanDecision = contentDecision(source.contentHumanDecision);
  const ventureGateValue = ventureGate(source.ventureGate);
  const ventureDecisionValue = ventureDecision(source.ventureDecision);
  const status = source.status;
  if (status !== "pending" && status !== "hypothesis" && status !== "needs-more-evidence" && status !== "ready" && status !== "rejected") {
    fail("status must be pending, hypothesis, needs-more-evidence, ready, or rejected");
  }
  if (status === "ready" && ventureDecisionValue?.outcome !== "accept") {
    fail("status ready requires an independent Venture accept fact; a null decision is not acceptance");
  }
  if (status === "ready" && contentHumanDecision?.status !== "approved") {
    fail("status ready requires explicit Muxin approval");
  }
  if (status === "ready" && ventureGateValue.status !== "open") {
    fail("status ready requires an open Venture gate");
  }
  if (isCommentOnly(inputKind, sourceRecordRefs) && status === "ready") {
    fail("comment-only inputs must remain hypothesis or needs-more-evidence");
  }

  const pointerBase = { id, ventureId, phase, inputKind, sourceRecordRefs, evidenceRefs, contentItemRefs };
  const pointer: VentureInputPointer = {
    id,
    ventureId,
    phase,
    inputKind,
    sourceRecordRefs,
    evidenceRefs,
    contentItemRefs,
    scope,
    sampleSize,
    provenance,
    caveats,
    contentHumanDecision,
    ventureGate: ventureGateValue,
    ventureDecision: ventureDecisionValue,
    status,
    lineage: lineage(source.lineage, pointerBase),
  };
  return freezeDeep(pointer);
}

/** Alias for callers that want the seam named as a validator. */
export const validateVentureInputPointer = createVentureInputPointer;

function statusFor(pointer: VentureInputPointer, blockers: readonly string[]): VentureInputStatus {
  const commentOnly = isCommentOnly(pointer.inputKind, pointer.sourceRecordRefs);
  if (pointer.ventureDecision?.outcome === "reject") return "rejected";
  if (pointer.ventureDecision?.outcome === "request-more-evidence") return "needs-more-evidence";
  if (commentOnly) return pointer.status === "hypothesis" ? "hypothesis" : "needs-more-evidence";
  if (blockers.length === 0 && pointer.ventureDecision?.outcome === "accept") return "ready";
  if (pointer.status === "needs-more-evidence" || pointer.status === "hypothesis") return pointer.status;
  return "pending";
}

/**
 * Derive readiness without changing the pointer. This is a read-only projection, not a Venture
 * gate writer. The Venture decision is summarized only after its independent fact was validated.
 */
export function assessVentureInputReadiness(input: VentureInputPointer): VentureInputReadiness {
  const pointer = createVentureInputPointer(input);
  const blockers: string[] = [];
  const contentApproval = pointer.contentHumanDecision?.status ?? "not-recorded";
  if (contentApproval !== "approved") blockers.push("explicit Muxin approval is required before Content input is ready");
  if (pointer.ventureGate.status !== "open") blockers.push("the Venture gate is not open");
  if (pointer.ventureDecision === null) blockers.push("an independent Venture decision fact (accept, reject, or request-more-evidence) is required");
  if (isCommentOnly(pointer.inputKind, pointer.sourceRecordRefs)) {
    blockers.push("comment-only evidence remains a hypothesis/needs-more-evidence, not a conclusion");
  }
  if (pointer.ventureDecision?.outcome === "request-more-evidence") blockers.push("Venture requested more evidence");
  const status = statusFor(pointer, blockers);
  const ready = blockers.length === 0 && pointer.ventureDecision?.outcome === "accept";
  return freezeDeep({
    kind: "venture_input_readiness",
    pointer,
    status,
    ready,
    blockers,
    contentApproval,
    ventureDecision: pointer.ventureDecision
      ? { outcome: pointer.ventureDecision.outcome, factRef: pointer.ventureDecision.factRef }
      : null,
    safety: {
      owner: "content",
      appendOnly: true,
      bodyFree: true,
      readOnly: true,
      directWrites: false,
      createsArtifacts: false,
      unlocksPhase: false,
      approvesPublish: false,
      changesStrategy: false,
    },
  });
}

/** Alias for the seam's read projection. */
export const buildVentureInputReadiness = assessVentureInputReadiness;

export function assertUniqueVentureInputIds(inputs: readonly VentureInputPointer[]): void {
  const seen = new Set<string>();
  for (const input of inputs) {
    const pointer = createVentureInputPointer(input);
    if (seen.has(pointer.id)) fail(`venture input id "${pointer.id}" must be unique; duplicate identity found`);
    seen.add(pointer.id);
  }
}

/** Ensure a new in-memory sequence only appends complete, unchanged pointers. */
export function assertAppendOnlyVentureInputs(
  previous: readonly VentureInputPointer[],
  next: readonly VentureInputPointer[],
): void {
  assertUniqueVentureInputIds(previous);
  assertUniqueVentureInputIds(next);
  if (next.length < previous.length) fail("venture input sequence is append-only and cannot shrink");
  for (let index = 0; index < previous.length; index += 1) {
    const oldPointer = createVentureInputPointer(previous[index]);
    const newPointer = createVentureInputPointer(next[index]);
    if (oldPointer.id !== newPointer.id || JSON.stringify(oldPointer) !== JSON.stringify(newPointer)) {
      fail(`venture input sequence is append-only; input at index ${index} was changed in place`);
    }
  }
}
