/**
 * Deterministic, body-free fan-out for the Grow studio handoff.
 *
 * This module only binds references and exact treatment identities. It never reads source
 * substance, composes copy, invokes a model, ranks/selects, approves, schedules, publishes, or
 * writes files.
 */

export const DRAFT_BATCH_VERSION = "grow-draft-batch-v1" as const;
export const DRAFT_REQUEST_VERSION = "grow-draft-request-v1" as const;

export interface DraftBatchTreatmentInput {
  readonly platform: string;
  readonly medium: string;
  readonly format: string;
  readonly treatmentRef: string;
  readonly hookTemplateRefs: readonly string[];
  readonly experimentRefs: readonly string[];
}

export interface DraftBatchInput {
  readonly sourceThoughtRef: string;
  readonly sourceArtifactRef: string;
  readonly generationBriefRef: string;
  readonly volumePlanRef: string;
  readonly treatmentCoverageRef: string;
  readonly voicePolicyRef: string;
  readonly treatments: readonly DraftBatchTreatmentInput[];
  readonly [key: string]: unknown;
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
  readonly identity: DraftBatchTreatmentInput;
  readonly treatment: DraftBatchTreatmentInput;
  readonly lineage: {
    readonly sourceThoughtRef: string;
    readonly sourceArtifactRef: string;
    readonly generationBriefRef: string;
    readonly volumePlanRef: string;
    readonly treatmentCoverageRef: string;
    readonly expectedOutputArtifactRef: string;
  };
  readonly blockers: ["human review is pending"];
  readonly readiness: { readonly status: "blocked"; readonly blockers: ["human review is pending"] };
  readonly humanReview: {
    readonly required: true;
    readonly before: "publish";
    readonly approvalOwner: "human";
    readonly status: "pending";
    readonly decidedBy: null;
    readonly decidedAt: null;
    readonly reason: null;
  };
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

export interface DraftBatch {
  readonly kind: "grow_draft_batch";
  readonly version: typeof DRAFT_BATCH_VERSION;
  readonly sourceThoughtRef: string;
  readonly sourceArtifactRef: string;
  readonly requests: DraftRequest[];
  readonly humanReviewRequired: true;
  readonly generatesCopy: false;
  readonly creatorBodyCopyAllowed: false;
  readonly modelInvocation: "deferred";
  readonly autoApproval: false;
  readonly autoScheduling: false;
  readonly autoPublishing: false;
  readonly sideEffects: "none";
}

const BATCH_FIELDS = new Set([
  "sourceThoughtRef", "sourceArtifactRef", "generationBriefRef", "volumePlanRef",
  "treatmentCoverageRef", "voicePolicyRef", "treatments",
]);
const TREATMENT_FIELDS = new Set([
  "platform", "medium", "format", "treatmentRef", "hookTemplateRefs", "experimentRefs",
]);

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}

function assertFields(value: Record<string, unknown>, allowed: ReadonlySet<string>, label: string): void {
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) throw new Error(`${label} contains unsupported field "${field}"`);
  }
}

function refs(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} must be a non-empty array`);
  const result = value.map((entry, index) => text(entry, `${label}[${index}]`));
  if (new Set(result).size !== result.length) throw new Error(`${label} contains duplicate references`);
  return result.sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
}

function normalizeTreatment(value: unknown): DraftBatchTreatmentInput {
  const source = object(value, "treatment identity");
  assertFields(source, TREATMENT_FIELDS, "treatment identity");
  return {
    platform: text(source.platform, "treatment platform"),
    medium: text(source.medium, "treatment medium"),
    format: text(source.format, "treatment format"),
    treatmentRef: text(source.treatmentRef, "treatment ref"),
    hookTemplateRefs: refs(source.hookTemplateRefs, "hookTemplateRefs"),
    experimentRefs: refs(source.experimentRefs, "experimentRefs"),
  };
}

function identityKey(treatment: DraftBatchTreatmentInput): string {
  return JSON.stringify([
    treatment.platform, treatment.medium, treatment.format, treatment.treatmentRef,
    treatment.hookTemplateRefs, treatment.experimentRefs,
  ]);
}

function artifactPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

function requestFor(input: DraftBatchInput, treatment: DraftBatchTreatmentInput): DraftRequest {
  const id = [treatment.platform, treatment.medium, treatment.format, treatment.treatmentRef, ...treatment.experimentRefs]
    .map(artifactPart).filter(Boolean).join("-");
  const expectedOutputArtifactRef = `artifact:draft-request-${id}`;
  const lineage = {
    sourceThoughtRef: text(input.sourceThoughtRef, "sourceThoughtRef"),
    sourceArtifactRef: text(input.sourceArtifactRef, "sourceArtifactRef"),
    generationBriefRef: text(input.generationBriefRef, "generationBriefRef"),
    volumePlanRef: text(input.volumePlanRef, "volumePlanRef"),
    treatmentCoverageRef: text(input.treatmentCoverageRef, "treatmentCoverageRef"),
    expectedOutputArtifactRef,
  };
  const identity = { ...treatment, hookTemplateRefs: [...treatment.hookTemplateRefs], experimentRefs: [...treatment.experimentRefs] };
  return {
    kind: "grow_draft_request", version: DRAFT_REQUEST_VERSION, id,
    sourceThoughtRef: lineage.sourceThoughtRef, sourceArtifactRef: lineage.sourceArtifactRef,
    platform: treatment.platform, medium: treatment.medium, format: treatment.format,
    treatmentRef: treatment.treatmentRef, hookTemplateRefs: [...treatment.hookTemplateRefs],
    experimentRefs: [...treatment.experimentRefs], voicePolicyRef: text(input.voicePolicyRef, "voicePolicyRef"),
    expectedOutputArtifactRef, identity, treatment: identity, lineage,
    blockers: ["human review is pending"],
    readiness: { status: "blocked", blockers: ["human review is pending"] },
    humanReview: { required: true, before: "publish", approvalOwner: "human", status: "pending", decidedBy: null, decidedAt: null, reason: null },
    templateReusePolicy: { mode: "template-madlib", commonSocialHooks: "allowed", creatorBodyCopy: "forbidden" },
    modelBoundary: { modelInvocation: "deferred", sideEffects: "none", boundaries: { composesBody: false, commonHookMadLibAllowed: true, creatorBodyCopyAllowed: false } },
    generatesCopy: false, creatorBodyCopyAllowed: false, sideEffects: "none",
  };
}

/** Build a stable manifest. Input is metadata only; no model or filesystem boundary exists here. */
export function buildDraftBatch(input: DraftBatchInput): DraftBatch {
  const source = object(input, "draft batch");
  assertFields(source, BATCH_FIELDS, "draft batch");
  if (!Array.isArray(source.treatments) || source.treatments.length === 0) throw new Error("treatments must be a non-empty array");
  const normalized = source.treatments.map(normalizeTreatment);
  const seen = new Set<string>();
  for (const treatment of normalized) {
    const key = identityKey(treatment);
    if (seen.has(key)) throw new Error(`duplicate exact treatment identity: ${key}`);
    seen.add(key);
  }
  const typed = { ...input } as DraftBatchInput;
  const requests = normalized
    .sort((left, right) => identityKey(left).localeCompare(identityKey(right)))
    .map((treatment) => requestFor(typed, treatment));
  return {
    kind: "grow_draft_batch", version: DRAFT_BATCH_VERSION,
    sourceThoughtRef: text(input.sourceThoughtRef, "sourceThoughtRef"),
    sourceArtifactRef: text(input.sourceArtifactRef, "sourceArtifactRef"),
    requests, humanReviewRequired: true, generatesCopy: false, creatorBodyCopyAllowed: false,
    modelInvocation: "deferred", autoApproval: false, autoScheduling: false, autoPublishing: false,
    sideEffects: "none",
  };
}

export const createDraftBatch = buildDraftBatch;
export const buildDraftRequestBatch = buildDraftBatch;
