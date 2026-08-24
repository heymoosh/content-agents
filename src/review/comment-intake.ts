import {
  buildCommentObservation,
  type BlueprintLineage,
  type CommentObservation,
} from "./learning-packet.js";

export type { BlueprintLineage, CommentObservation } from "./learning-packet.js";

/**
 * Pure, local intake for a manually observed comment.
 *
 * This is an adapter at the boundary of the learning-packet/comment-learning conventions. It
 * accepts facts supplied by a person, normalizes them, and returns a packet-shaped observation plus
 * a body-free summary. It deliberately has no filesystem, clock, provider, publisher, or reply
 * dependency. A valid intake is ready for reviewable learning data only; it never proves demand or
 * unlocks Venture.
 */

export const COMMENT_INTAKE_VERSION = "comment-observation-intake-v1" as const;

export type ModerationStatus = "reviewed" | "not_reviewed" | "unknown";
export type ConsentStatus = "explicit" | "public_context" | "unknown" | "withheld";

export interface ModerationPostureInput {
  readonly status: ModerationStatus;
  readonly note?: string | null;
}

export interface ConsentPostureInput {
  readonly status: ConsentStatus;
  readonly note?: string | null;
}

export interface CommentTextInput {
  /** The original body, accepted only when no redaction is requested. */
  readonly text?: string;
  /** A privacy-safe representation supplied by the manual operator. */
  readonly redactedText?: string;
  /** If true, `redactedText` is required and the original body is discarded. */
  readonly redactionRequested?: boolean;
}

export interface CommentIntakeInput {
  readonly id: string;
  readonly contentItemId: string;
  readonly lineage: BlueprintLineage;
  readonly commentId: string;
  readonly platform: string;
  readonly surface: string;
  readonly comment: CommentTextInput;
  readonly observedAt: string;
  readonly sourceNoteRef: string;
  readonly evidenceRefs: readonly string[];
  readonly moderation: ModerationStatus | ModerationPostureInput;
  readonly consent: ConsentStatus | ConsentPostureInput;
}

export interface CommentLearningSummary {
  readonly kind: "comment_learning_summary";
  readonly version: typeof COMMENT_INTAKE_VERSION;
  readonly id: string;
  readonly contentItemId: string;
  readonly lineage: BlueprintLineage;
  readonly sourcePlatform: string;
  readonly surface: string;
  readonly observedAt: string;
  /** Intentionally null: summaries never carry a comment body, raw or redacted. */
  readonly text: null;
  readonly evidenceRefs: readonly string[];
  readonly sourceRecordIds: readonly string[];
  readonly qualification: "uncertain";
  readonly confidence: "low";
  readonly muxinDecision: "pending";
  readonly productIdea: null;
  readonly autoClaimsDemand: false;
  readonly ventureArtifacts: false;
  readonly publish: false;
  readonly reply: false;
  readonly sideEffects: "none";
}

export interface CommentIntakeReadiness {
  readonly status: "ready" | "blocked";
  readonly blockers: readonly string[];
  readonly ventureHandoff: {
    readonly status: "blocked";
    readonly blockers: readonly string[];
  };
}

/** A deliberately blocked, body-free bridge toward the separate Venture handoff gate. */
export interface CommentIntakeHandoff {
  readonly kind: "comment_intake_handoff";
  readonly contentItemId: string;
  readonly lineage: BlueprintLineage;
  readonly muxinDecision: "pending";
  readonly ventureGate: "blocked";
  readonly readiness: CommentIntakeReadiness["ventureHandoff"];
  readonly autoClaimsDemand: false;
  readonly ventureArtifacts: false;
  readonly sideEffects: "none";
}

export interface NormalizedCommentIntake {
  readonly kind: "comment_observation_intake";
  readonly version: typeof COMMENT_INTAKE_VERSION;
  readonly id: string;
  readonly contentItemId: string;
  readonly lineage: BlueprintLineage;
  readonly source: {
    readonly noteRef: string;
    readonly evidenceRefs: readonly string[];
  };
  readonly moderation: ModerationPostureInput;
  readonly consent: ConsentPostureInput;
  readonly redactionRequested: boolean;
  readonly commentObservation: CommentObservation;
  readonly summary: CommentLearningSummary;
  readonly ventureHandoff: CommentIntakeHandoff;
  readonly readiness: CommentIntakeReadiness;
  readonly sideEffects: "none";
}

export class CommentIntakeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommentIntakeValidationError";
  }
}

type LooseRecord = Record<string, unknown>;

function isRecord(value: unknown): value is LooseRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function trimmed(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function requiredText(value: unknown, field: string): string {
  const normalized = trimmed(value);
  if (normalized === null) throw new CommentIntakeValidationError(`${field} is required`);
  return normalized;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function validTimestamp(value: unknown): string | null {
  const text = trimmed(value);
  if (text === null) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function completeLineage(value: unknown): value is BlueprintLineage {
  if (!isRecord(value)) return false;
  return trimmed(value.sourceId) !== null
    && trimmed(value.variantId) !== null
    && trimmed(value.experimentId) !== null;
}

function postureStatus(value: unknown, field: string): ModerationStatus | ConsentStatus | null {
  if (typeof value === "string") return value as ModerationStatus | ConsentStatus;
  if (isRecord(value) && typeof value.status === "string") return value.status as ModerationStatus | ConsentStatus;
  return null;
}

function postureNote(value: unknown): string | null {
  if (typeof value === "string") return null;
  if (!isRecord(value) || value.note === null || value.note === undefined) return null;
  return trimmed(value.note);
}

interface Representation {
  readonly text: string | null;
  readonly redactedText: string | null;
  readonly requested: boolean;
  readonly blocker: string | null;
}

function representation(value: unknown): Representation {
  if (!isRecord(value)) {
    return { text: null, redactedText: null, requested: false, blocker: "comment text or redacted representation is required" };
  }
  const text = trimmed(value.text);
  const redactedText = trimmed(value.redactedText);
  if (value.redactionRequested !== undefined && typeof value.redactionRequested !== "boolean") {
    return { text, redactedText, requested: false, blocker: "redaction request must be true or false" };
  }
  const requested = value.redactionRequested === true || (text === null && redactedText !== null);
  if (requested && redactedText === null) {
    return { text, redactedText, requested, blocker: "privacy-safe redacted representation is required when redaction is requested" };
  }
  if (!requested && text === null && redactedText === null) {
    return { text, redactedText, requested, blocker: "comment text or redacted representation is required" };
  }
  return { text, redactedText, requested, blocker: null };
}

function evidenceRefs(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const normalized = value.map(trimmed);
  if (normalized.some((item) => item === null)) return null;
  return uniqueSorted(normalized as string[]);
}

function moderationStatus(value: unknown): ModerationStatus {
  const status = postureStatus(value, "moderation");
  if (status === "reviewed" || status === "not_reviewed" || status === "unknown") return status;
  throw new CommentIntakeValidationError("moderation posture is required");
}

function consentStatus(value: unknown): ConsentStatus {
  const status = postureStatus(value, "consent");
  if (status === "explicit" || status === "public_context" || status === "unknown" || status === "withheld") return status;
  throw new CommentIntakeValidationError("consent posture is required");
}

function normalizedPosture<T extends ModerationStatus | ConsentStatus>(value: unknown, status: T): { status: T; note: string | null } {
  return { status, note: postureNote(value) };
}

function readinessBlockers(value: unknown): string[] {
  if (!isRecord(value)) return ["comment intake must be an object"];
  const blockers: string[] = [];

  if (trimmed(value.contentItemId) === null) blockers.push("content item reference is required");
  if (!completeLineage(value.lineage)) blockers.push("source, variant, and experiment lineage references are required");
  if (trimmed(value.platform) === null) blockers.push("platform is required");
  if (trimmed(value.surface) === null) blockers.push("comment surface is required");
  if (trimmed(value.commentId) === null) blockers.push("comment reference is required");

  const body = representation(value.comment);
  if (body.blocker !== null) blockers.push(body.blocker);
  if (validTimestamp(value.observedAt) === null) blockers.push("observed timestamp must be a valid timestamp");

  if (trimmed(value.sourceNoteRef) === null) blockers.push("source note reference is required");
  const refs = evidenceRefs(value.evidenceRefs);
  if (refs === null) {
    blockers.push(Array.isArray(value.evidenceRefs)
      ? "evidence references must be non-empty strings"
      : "at least one evidence reference is required");
  } else if (refs.length === 0) {
    blockers.push("at least one evidence reference is required");
  }

  const moderation = postureStatus(value.moderation, "moderation");
  if (moderation === null) blockers.push("moderation posture is required");
  else if (moderation === "not_reviewed") blockers.push("moderation posture is not reviewed");
  else if (moderation === "unknown") blockers.push("moderation posture is unresolved");
  else if (moderation !== "reviewed") blockers.push("moderation posture is invalid");

  const consent = postureStatus(value.consent, "consent");
  if (consent === null) blockers.push("consent posture is required");
  else if (consent === "unknown" || consent === "withheld") blockers.push("consent posture is unresolved");
  else if (consent !== "explicit" && consent !== "public_context") blockers.push("consent posture is invalid");

  return blockers;
}

/**
 * Assess only the supplied facts. It never normalizes by mutation, calls a provider, or changes a
 * Venture gate. A ready result means the local observation is admissible for reviewable learning
 * data, not that it establishes demand.
 */
export function assessCommentIntakeReadiness(input: unknown): CommentIntakeReadiness {
  const blockers = readinessBlockers(input);
  const ventureBlockers = ["comment observation alone does not establish demand or unlock Venture"];
  return {
    status: blockers.length === 0 ? "ready" : "blocked",
    blockers,
    ventureHandoff: { status: "blocked", blockers: ventureBlockers },
  };
}

function normalizeLineage(value: unknown): BlueprintLineage {
  if (!completeLineage(value)) throw new CommentIntakeValidationError("source, variant, and experiment lineage references are required");
  return {
    sourceId: requiredText(value.sourceId, "lineage.sourceId"),
    variantId: requiredText(value.variantId, "lineage.variantId"),
    experimentId: requiredText(value.experimentId, "lineage.experimentId"),
  };
}

function normalizeRepresentation(value: unknown): { text: string; requested: boolean } {
  const body = representation(value);
  if (body.blocker !== null) throw new CommentIntakeValidationError(body.blocker);
  const text = body.requested ? body.redactedText : body.text ?? body.redactedText;
  if (text === null) throw new CommentIntakeValidationError("comment text or redacted representation is required");
  return { text, requested: body.requested };
}

/**
 * Normalize one manual comment observation into the existing learning-packet shape.
 *
 * No qualification is inferred from the body: the adapter uses `uncertain`/`low` and preserves a
 * clear caveat. A redaction request causes the raw value to be discarded before this function's
 * returned object is assembled, so it cannot leak into the derived summary or handoff metadata.
 */
export function normalizeCommentIntake(input: CommentIntakeInput): NormalizedCommentIntake {
  const readiness = assessCommentIntakeReadiness(input);
  if (readiness.status === "blocked") {
    throw new CommentIntakeValidationError(`comment intake is blocked: ${readiness.blockers.join("; ")}`);
  }

  const source = input as unknown as LooseRecord;
  const id = requiredText(source.id, "id");
  const contentItemId = requiredText(source.contentItemId, "contentItemId");
  const lineage = normalizeLineage(source.lineage);
  const commentId = requiredText(source.commentId, "commentId");
  const platform = requiredText(source.platform, "platform").toLowerCase();
  const surface = requiredText(source.surface, "surface").toLowerCase();
  const observedAt = validTimestamp(source.observedAt) as string;
  const sourceNoteRef = requiredText(source.sourceNoteRef, "sourceNoteRef");
  const suppliedEvidenceRefs = evidenceRefs(source.evidenceRefs) as string[];
  const refs = uniqueSorted([sourceNoteRef, ...suppliedEvidenceRefs]);
  const body = normalizeRepresentation(source.comment);
  const moderation = normalizedPosture(source.moderation, moderationStatus(source.moderation));
  const consent = normalizedPosture(source.consent, consentStatus(source.consent));

  const commentObservation = buildCommentObservation({
    id,
    lineage: { ...lineage },
    observation: {
      sourcePlatform: platform,
      surface,
      commentId,
      observedAt,
      text: body.text,
    },
    qualification: {
      status: "uncertain",
      basis: "Manual intake records an observation only; no demand or product inference was performed.",
    },
    interpretation: {
      summary: "Comment observation only; no demand or product idea inferred.",
      confidence: "low",
      willingnessToPay: "not_proven_by_comment",
    },
    evidence: {
      status: "observed",
      refs,
      note: "Manual local intake; source note and evidence references supplied by the operator.",
    },
    caveats: [
      "A comment is not proof of demand, willingness to pay, or audience fit.",
      "No product idea or Venture artifact was inferred by intake.",
      ...(body.requested ? ["Raw comment text was withheld from derived summaries."] : []),
    ].sort((left, right) => left.localeCompare(right)),
  });

  const summary: CommentLearningSummary = {
    kind: "comment_learning_summary",
    version: COMMENT_INTAKE_VERSION,
    id,
    contentItemId,
    lineage: { ...lineage },
    sourcePlatform: platform,
    surface,
    observedAt,
    text: null,
    evidenceRefs: refs,
    sourceRecordIds: [id],
    qualification: "uncertain",
    confidence: "low",
    muxinDecision: "pending",
    productIdea: null,
    autoClaimsDemand: false,
    ventureArtifacts: false,
    publish: false,
    reply: false,
    sideEffects: "none",
  };

  const ventureHandoff: CommentIntakeHandoff = {
    kind: "comment_intake_handoff",
    contentItemId,
    lineage: { ...lineage },
    muxinDecision: "pending",
    ventureGate: "blocked",
    readiness: readiness.ventureHandoff,
    autoClaimsDemand: false,
    ventureArtifacts: false,
    sideEffects: "none",
  };

  return {
    kind: "comment_observation_intake",
    version: COMMENT_INTAKE_VERSION,
    id,
    contentItemId,
    lineage: { ...lineage },
    source: { noteRef: sourceNoteRef, evidenceRefs: refs },
    moderation,
    consent,
    redactionRequested: body.requested,
    commentObservation,
    summary,
    ventureHandoff,
    readiness,
    sideEffects: "none",
  };
}

export const buildCommentObservationIntake = normalizeCommentIntake;
export const createCommentObservationIntake = normalizeCommentIntake;
