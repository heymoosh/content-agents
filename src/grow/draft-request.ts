/**
 * A body-free request from one original thought to one exact Grow treatment.
 *
 * This seam carries references and planning metadata only. It never reads source substance,
 * composes copy, invokes a model, ranks treatments, selects a winner, or releases work.
 */

export const DRAFT_REQUEST_VERSION = "grow-draft-request-v1" as const;

export type DraftRequestReviewStatus = "pending" | "approved" | "rejected";
export type DraftRequestReadinessStatus = "ready" | "blocked";

export interface DraftRequestTreatmentIdentityInput {
  readonly platform: string;
  readonly medium: string;
  readonly format: string;
  readonly treatmentRef: string;
  readonly hookTemplateRefs: readonly string[];
  readonly experimentRefs: readonly string[];
}

export interface DraftRequestLineageInput {
  readonly sourceThoughtRef: string;
  readonly sourceArtifactRef: string;
  readonly generationBriefRef: string;
  readonly volumePlanRef: string;
  readonly treatmentCoverageRef: string;
  readonly expectedOutputArtifactRef: string;
}

export interface DraftRequestHumanReviewInput {
  readonly status: DraftRequestReviewStatus;
  readonly decidedBy?: string | null;
  readonly decidedAt?: string | null;
  readonly reason?: string | null;
}

export interface DraftRequestInput {
  readonly id: string;
  readonly sourceThoughtRef: string;
  readonly sourceArtifactRef: string;
  readonly platform: string;
  readonly medium: string;
  readonly format: string;
  readonly treatmentRef: string;
  readonly hookTemplateRefs: readonly string[];
  readonly experimentRefs: readonly string[];
  readonly voicePolicyRef: string;
  readonly expectedOutputArtifactRef: string;
  readonly treatment: DraftRequestTreatmentIdentityInput;
  readonly lineage: DraftRequestLineageInput;
  readonly blockers?: readonly string[];
  readonly humanReview: DraftRequestHumanReviewInput;
}

export interface DraftRequestTreatmentIdentity {
  readonly platform: string;
  readonly medium: string;
  readonly format: string;
  readonly treatmentRef: string;
  readonly hookTemplateRefs: string[];
  readonly experimentRefs: string[];
}

export interface DraftRequestLineage {
  readonly sourceThoughtRef: string;
  readonly sourceArtifactRef: string;
  readonly generationBriefRef: string;
  readonly volumePlanRef: string;
  readonly treatmentCoverageRef: string;
  readonly expectedOutputArtifactRef: string;
}

export interface DraftRequestHumanReview {
  readonly required: true;
  readonly before: "publish";
  readonly approvalOwner: "human";
  readonly status: DraftRequestReviewStatus;
  readonly decidedBy: "muxin" | null;
  readonly decidedAt: string | null;
  readonly reason: string | null;
}

export interface DraftRequestReadiness {
  readonly status: DraftRequestReadinessStatus;
  readonly blockers: string[];
}

export interface DraftRequest {
  readonly kind: "grow_draft_request";
  readonly version: typeof DRAFT_REQUEST_VERSION;
  readonly id: string;
  readonly sourceThoughtRef: string;
  readonly sourceArtifactRef: string;
  readonly platform: string;
  readonly medium: string;
  readonly format: string;
  readonly treatmentRef: string;
  readonly hookTemplateRefs: string[];
  readonly experimentRefs: string[];
  readonly voicePolicyRef: string;
  readonly expectedOutputArtifactRef: string;
  readonly identity: DraftRequestTreatmentIdentity;
  readonly treatment: DraftRequestTreatmentIdentity;
  readonly lineage: DraftRequestLineage;
  readonly blockers: string[];
  readonly readiness: DraftRequestReadiness;
  readonly humanReview: DraftRequestHumanReview;
  readonly templateReusePolicy: {
    readonly mode: "template-madlib";
    readonly commonSocialHooks: "allowed";
    readonly creatorBodyCopy: "forbidden";
  };
  readonly modelBoundary: {
    readonly modelInvocation: "deferred";
    readonly sideEffects: "none";
    readonly boundaries: {
      readonly composesBody: false;
      readonly commonHookMadLibAllowed: true;
      readonly creatorBodyCopyAllowed: false;
    };
  };
  readonly generatesCopy: false;
  readonly creatorBodyCopyAllowed: false;
  readonly sideEffects: "none";
}

const INPUT_FIELDS = new Set([
  "id",
  "sourceThoughtRef",
  "sourceArtifactRef",
  "platform",
  "medium",
  "format",
  "treatmentRef",
  "hookTemplateRefs",
  "experimentRefs",
  "voicePolicyRef",
  "expectedOutputArtifactRef",
  "treatment",
  "lineage",
  "blockers",
  "humanReview",
]);

const TREATMENT_FIELDS = new Set([
  "platform",
  "medium",
  "format",
  "treatmentRef",
  "hookTemplateRefs",
  "experimentRefs",
]);

const LINEAGE_FIELDS = new Set([
  "sourceThoughtRef",
  "sourceArtifactRef",
  "generationBriefRef",
  "volumePlanRef",
  "treatmentCoverageRef",
  "expectedOutputArtifactRef",
]);

const HUMAN_REVIEW_FIELDS = new Set(["status", "decidedBy", "decidedAt", "reason"]);

export class DraftRequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DraftRequestValidationError";
  }
}

function fail(message: string): never {
  throw new DraftRequestValidationError(message);
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(label + " must be an object");
  }
  return value as Record<string, unknown>;
}

function allowedFields(value: Record<string, unknown>, allowed: ReadonlySet<string>, label: string): void {
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) fail(label + " contains unsupported field \"" + field + "\"");
  }
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") fail(label + " must not be empty");
  return value.trim();
}

function optionalText(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  return text(value, label);
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function refs(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) fail(label + " must be an array");
  const result = value.map((entry, index) => text(entry, label + "[" + index + "]"));
  if (result.length === 0) fail(label + " must not be empty");
  return sortedUnique(result);
}

function blockers(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) fail("blockers must be an array");
  return sortedUnique(value.map((entry, index) => text(entry, "blockers[" + index + "]")));
}

function iso(value: unknown, label: string): string {
  const normalized = text(value, label);
  if (Number.isNaN(Date.parse(normalized))) fail(label + " must be a valid timestamp");
  return normalized;
}

function sameRefs(left: readonly string[], right: readonly string[]): boolean {
  return JSON.stringify(sortedUnique(left)) === JSON.stringify(sortedUnique(right));
}

function normalizeTreatment(input: unknown): DraftRequestTreatmentIdentity {
  const source = object(input, "treatment");
  allowedFields(source, TREATMENT_FIELDS, "treatment");
  return {
    platform: text(source.platform, "treatment.platform"),
    medium: text(source.medium, "treatment.medium"),
    format: text(source.format, "treatment.format"),
    treatmentRef: text(source.treatmentRef, "treatment.treatmentRef"),
    hookTemplateRefs: refs(source.hookTemplateRefs, "treatment.hookTemplateRefs"),
    experimentRefs: refs(source.experimentRefs, "treatment.experimentRefs"),
  };
}

function normalizeLineage(input: unknown): DraftRequestLineage {
  const source = object(input, "lineage");
  allowedFields(source, LINEAGE_FIELDS, "lineage");
  return {
    sourceThoughtRef: text(source.sourceThoughtRef, "lineage.sourceThoughtRef"),
    sourceArtifactRef: text(source.sourceArtifactRef, "lineage.sourceArtifactRef"),
    generationBriefRef: text(source.generationBriefRef, "lineage.generationBriefRef"),
    volumePlanRef: text(source.volumePlanRef, "lineage.volumePlanRef"),
    treatmentCoverageRef: text(source.treatmentCoverageRef, "lineage.treatmentCoverageRef"),
    expectedOutputArtifactRef: text(source.expectedOutputArtifactRef, "lineage.expectedOutputArtifactRef"),
  };
}

function normalizeHumanReview(input: unknown): DraftRequestHumanReview {
  const source = object(input, "humanReview");
  allowedFields(source, HUMAN_REVIEW_FIELDS, "humanReview");
  const status = source.status;
  if (status !== "pending" && status !== "approved" && status !== "rejected") {
    fail("humanReview.status must be pending, approved, or rejected");
  }

  const decidedByValue = optionalText(source.decidedBy, "humanReview.decidedBy");
  const decidedAtValue = source.decidedAt === undefined || source.decidedAt === null
    ? null
    : iso(source.decidedAt, "humanReview.decidedAt");
  const reason = optionalText(source.reason, "humanReview.reason");

  if (status === "pending") {
    if (decidedByValue !== null || decidedAtValue !== null || reason !== null) {
      fail("pending human review must not contain a decision");
    }
    return {
      required: true,
      before: "publish",
      approvalOwner: "human",
      status,
      decidedBy: null,
      decidedAt: null,
      reason: null,
    };
  }

  if (decidedByValue !== "muxin") fail(status + " human review requires decidedBy muxin");
  if (decidedAtValue === null) fail(status + " human review requires decidedAt");
  if (status === "rejected" && reason === null) fail("rejected human review requires reason");

  return {
    required: true,
    before: "publish",
    approvalOwner: "human",
    status,
    decidedBy: "muxin",
    decidedAt: decidedAtValue,
    reason,
  };
}

/** Build a deterministic, body-free request from references and caller-supplied metadata. */
export function createDraftRequest(input: DraftRequestInput): DraftRequest {
  const source = object(input, "draft request");
  allowedFields(source, INPUT_FIELDS, "draft request");

  const id = text(source.id, "id");
  const sourceThoughtRef = text(source.sourceThoughtRef, "sourceThoughtRef");
  const sourceArtifactRef = text(source.sourceArtifactRef, "sourceArtifactRef");
  const platform = text(source.platform, "platform");
  const medium = text(source.medium, "medium");
  const format = text(source.format, "format");
  const treatmentRef = text(source.treatmentRef, "treatmentRef");
  const hookTemplateRefs = refs(source.hookTemplateRefs, "hookTemplateRefs");
  const experimentRefs = refs(source.experimentRefs, "experimentRefs");
  const voicePolicyRef = text(source.voicePolicyRef, "voicePolicyRef");
  const expectedOutputArtifactRef = text(source.expectedOutputArtifactRef, "expectedOutputArtifactRef");
  const treatment = normalizeTreatment(source.treatment);
  const lineage = normalizeLineage(source.lineage);
  const humanReview = normalizeHumanReview(source.humanReview);
  const suppliedBlockers = blockers(source.blockers);

  if (treatment.platform !== platform) fail("treatment platform must match platform identity");
  if (treatment.medium !== medium) fail("treatment medium must match medium identity");
  if (treatment.format !== format) fail("treatment format must match format identity");
  if (treatment.treatmentRef !== treatmentRef) fail("treatment ref must match treatment identity");
  if (!sameRefs(treatment.hookTemplateRefs, hookTemplateRefs)) fail("treatment hook template refs must match identity");
  if (!sameRefs(treatment.experimentRefs, experimentRefs)) fail("treatment experiment refs must match identity");

  if (lineage.sourceThoughtRef !== sourceThoughtRef) fail("lineage source thought ref must match source identity");
  if (lineage.sourceArtifactRef !== sourceArtifactRef) fail("lineage source artifact ref must match source identity");
  if (lineage.expectedOutputArtifactRef !== expectedOutputArtifactRef) {
    fail("lineage expected output artifact ref must match output identity");
  }

  const reviewBlockers = humanReview.status === "approved"
    ? []
    : ["human review is " + humanReview.status];
  const allBlockers = sortedUnique([...suppliedBlockers, ...reviewBlockers]);
  if (humanReview.status === "approved" && allBlockers.length > 0) {
    fail("approval is blocked: " + allBlockers.join(", "));
  }

  const identity: DraftRequestTreatmentIdentity = {
    platform,
    medium,
    format,
    treatmentRef,
    hookTemplateRefs: [...hookTemplateRefs],
    experimentRefs: [...experimentRefs],
  };

  return {
    kind: "grow_draft_request",
    version: DRAFT_REQUEST_VERSION,
    id,
    sourceThoughtRef,
    sourceArtifactRef,
    platform,
    medium,
    format,
    treatmentRef,
    hookTemplateRefs: [...hookTemplateRefs],
    experimentRefs: [...experimentRefs],
    voicePolicyRef,
    expectedOutputArtifactRef,
    identity,
    treatment: {
      ...treatment,
      hookTemplateRefs: [...treatment.hookTemplateRefs],
      experimentRefs: [...treatment.experimentRefs],
    },
    lineage: { ...lineage },
    blockers: allBlockers,
    readiness: {
      status: allBlockers.length === 0 ? "ready" : "blocked",
      blockers: [...allBlockers],
    },
    humanReview,
    templateReusePolicy: {
      mode: "template-madlib",
      commonSocialHooks: "allowed",
      creatorBodyCopy: "forbidden",
    },
    modelBoundary: {
      modelInvocation: "deferred",
      sideEffects: "none",
      boundaries: {
        composesBody: false,
        commonHookMadLibAllowed: true,
        creatorBodyCopyAllowed: false,
      },
    },
    generatesCopy: false,
    creatorBodyCopyAllowed: false,
    sideEffects: "none",
  };
}

export const buildDraftRequest = createDraftRequest;
