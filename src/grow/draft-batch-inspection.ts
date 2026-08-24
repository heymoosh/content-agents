import {
  DRAFT_BATCH_VERSION,
  DRAFT_REQUEST_VERSION,
  type DraftRequest,
} from "./draft-batch.js";

/** Stable version for the read-only operator projection of a DraftBatch. */
export const DRAFT_BATCH_INSPECTION_VERSION = "grow-draft-batch-inspection-v1" as const;

export interface DraftBatchInspectionIdentity {
  readonly platform: string;
  readonly medium: string;
  readonly format: string;
  readonly treatmentRef: string;
  readonly hookTemplateRefs: string[];
  readonly experimentRefs: string[];
}

export interface DraftBatchInspectionHumanReview {
  readonly required: true;
  readonly before: "publish";
  readonly approvalOwner: "human";
  readonly status: "pending";
}

export interface DraftBatchInspectionRequest {
  readonly id: string;
  readonly identity: DraftBatchInspectionIdentity;
  readonly lineage: DraftRequest["lineage"];
  readonly humanReview: DraftBatchInspectionHumanReview;
  readonly blockers: string[];
}

export interface DraftBatchInspectionCounts {
  readonly total: number;
  readonly byPlatform: Readonly<Record<string, number>>;
  readonly byFormat: Readonly<Record<string, number>>;
}

export interface DraftBatchInspection {
  readonly kind: "grow_draft_batch_inspection";
  readonly version: typeof DRAFT_BATCH_INSPECTION_VERSION;
  readonly sourceThoughtRef: string;
  readonly sourceArtifactRef: string;
  readonly requests: DraftBatchInspectionRequest[];
  readonly counts: DraftBatchInspectionCounts;
  readonly humanReview: {
    readonly required: true;
    readonly before: "publish";
    readonly approvalOwner: "human";
    readonly status: "pending";
    readonly pending: number;
  };
  readonly blockers: string[];
  readonly generatesCopy: false;
  readonly creatorBodyCopyAllowed: false;
  readonly modelInvocation: "deferred";
  readonly autoApproval: false;
  readonly autoScheduling: false;
  readonly autoPublishing: false;
  readonly sideEffects: "none";
}

export type DraftBatchInspectionFormat = "json" | "markdown" | "both";

const BATCH_FIELDS = new Set([
  "kind", "version", "sourceThoughtRef", "sourceArtifactRef", "requests", "humanReviewRequired",
  "generatesCopy", "creatorBodyCopyAllowed", "modelInvocation", "autoApproval", "autoScheduling",
  "autoPublishing", "sideEffects",
]);
const REQUEST_FIELDS = new Set([
  "kind", "version", "id", "sourceThoughtRef", "sourceArtifactRef", "platform", "medium", "format",
  "treatmentRef", "hookTemplateRefs", "experimentRefs", "voicePolicyRef", "expectedOutputArtifactRef",
  "identity", "treatment", "lineage", "blockers", "readiness", "humanReview", "templateReusePolicy",
  "modelBoundary", "generatesCopy", "creatorBodyCopyAllowed", "sideEffects",
]);
const IDENTITY_FIELDS = new Set([
  "platform", "medium", "format", "treatmentRef", "hookTemplateRefs", "experimentRefs",
]);
const LINEAGE_FIELDS = new Set([
  "sourceThoughtRef", "sourceArtifactRef", "generationBriefRef", "volumePlanRef", "treatmentCoverageRef",
  "expectedOutputArtifactRef",
]);
const READINESS_FIELDS = new Set(["status", "blockers"]);
const HUMAN_REVIEW_FIELDS = new Set(["required", "before", "approvalOwner", "status", "decidedBy", "decidedAt", "reason"]);
const TEMPLATE_POLICY_FIELDS = new Set(["mode", "commonSocialHooks", "creatorBodyCopy"]);
const MODEL_BOUNDARY_FIELDS = new Set(["modelInvocation", "sideEffects", "boundaries"]);
const MODEL_BOUNDARIES_FIELDS = new Set(["composesBody", "commonHookMadLibAllowed", "creatorBodyCopyAllowed"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  return value;
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a non-empty string`);
  return value;
}

function exactFields(value: Record<string, unknown>, allowed: ReadonlySet<string>, label: string): void {
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) throw new Error(`${label} contains unsupported field "${field}"`);
  }
}

function exactBoolean(value: unknown, expected: boolean, label: string): void {
  if (value !== expected) throw new Error(`${label} must be ${expected}`);
}

function exactString(value: unknown, expected: string, label: string): void {
  if (value !== expected) throw new Error(`${label} must be ${expected}`);
}

function stringRefs(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} must be a non-empty array`);
  const refs = value.map((entry, index) => requiredText(entry, `${label}[${index}]`));
  if (new Set(refs).size !== refs.length) throw new Error(`${label} contains duplicate references`);
  return refs;
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameIdentity(left: DraftBatchInspectionIdentity, right: DraftBatchInspectionIdentity): boolean {
  return left.platform === right.platform
    && left.medium === right.medium
    && left.format === right.format
    && left.treatmentRef === right.treatmentRef
    && sameStringArray(left.hookTemplateRefs, right.hookTemplateRefs)
    && sameStringArray(left.experimentRefs, right.experimentRefs);
}

function identityKey(identity: DraftBatchInspectionIdentity): string {
  return JSON.stringify([
    identity.platform,
    identity.medium,
    identity.format,
    identity.treatmentRef,
    identity.hookTemplateRefs,
    identity.experimentRefs,
  ]);
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedCounts(values: readonly string[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => compare(left, right)));
}

function validateIdentity(value: unknown, label: string): DraftBatchInspectionIdentity {
  const source = record(value, label);
  exactFields(source, IDENTITY_FIELDS, label);
  return {
    platform: requiredText(source.platform, `${label} platform`),
    medium: requiredText(source.medium, `${label} medium`),
    format: requiredText(source.format, `${label} format`),
    treatmentRef: requiredText(source.treatmentRef, `${label} treatmentRef`),
    hookTemplateRefs: stringRefs(source.hookTemplateRefs, `${label} hookTemplateRefs`),
    experimentRefs: stringRefs(source.experimentRefs, `${label} experimentRefs`),
  };
}

function validateLineage(value: unknown, label: string): DraftRequest["lineage"] {
  const source = record(value, label);
  exactFields(source, LINEAGE_FIELDS, label);
  return {
    sourceThoughtRef: requiredText(source.sourceThoughtRef, `${label} sourceThoughtRef`),
    sourceArtifactRef: requiredText(source.sourceArtifactRef, `${label} sourceArtifactRef`),
    generationBriefRef: requiredText(source.generationBriefRef, `${label} generationBriefRef`),
    volumePlanRef: requiredText(source.volumePlanRef, `${label} volumePlanRef`),
    treatmentCoverageRef: requiredText(source.treatmentCoverageRef, `${label} treatmentCoverageRef`),
    expectedOutputArtifactRef: requiredText(source.expectedOutputArtifactRef, `${label} expectedOutputArtifactRef`),
  };
}

function validateBlockers(value: unknown, label: string): string[] {
  const blockers = stringRefs(value, label);
  if (blockers.length !== 1 || blockers[0] !== "human review is pending") {
    throw new Error(`${label} must contain only human review is pending`);
  }
  return blockers;
}

function validateHumanReview(value: unknown, label: string): void {
  const source = record(value, label);
  exactFields(source, HUMAN_REVIEW_FIELDS, label);
  exactBoolean(source.required, true, `${label}.required`);
  exactString(source.before, "publish", `${label}.before`);
  exactString(source.approvalOwner, "human", `${label}.approvalOwner`);
  exactString(source.status, "pending", `${label}.status`);
  if (source.decidedBy !== null || source.decidedAt !== null || source.reason !== null) {
    throw new Error(`${label} decision fields must be null while pending`);
  }
}

function validateRequest(value: unknown, batch: { sourceThoughtRef: string; sourceArtifactRef: string }): DraftBatchInspectionRequest {
  const source = record(value, "draft batch request");
  exactFields(source, REQUEST_FIELDS, "draft batch request");

  exactString(source.kind, "grow_draft_request", "request.kind");
  exactString(source.version, DRAFT_REQUEST_VERSION, "request.version");
  const id = requiredText(source.id, "request.id");
  const identity = validateIdentity(source.identity, "request identity");
  const treatment = validateIdentity(source.treatment, "request treatment");
  if (!sameIdentity(identity, treatment)) throw new Error("request identity and treatment must match");

  const flatIdentity = validateIdentity({
    platform: source.platform,
    medium: source.medium,
    format: source.format,
    treatmentRef: source.treatmentRef,
    hookTemplateRefs: source.hookTemplateRefs,
    experimentRefs: source.experimentRefs,
  }, "request fields");
  if (!sameIdentity(identity, flatIdentity)) throw new Error("request identity does not match request fields");

  exactString(source.sourceThoughtRef, batch.sourceThoughtRef, "request.sourceThoughtRef");
  exactString(source.sourceArtifactRef, batch.sourceArtifactRef, "request.sourceArtifactRef");
  requiredText(source.voicePolicyRef, "request.voicePolicyRef");
  const expectedOutputArtifactRef = requiredText(source.expectedOutputArtifactRef, "request.expectedOutputArtifactRef");
  const lineage = validateLineage(source.lineage, "request lineage");
  if (lineage.sourceThoughtRef !== batch.sourceThoughtRef || lineage.sourceArtifactRef !== batch.sourceArtifactRef) {
    throw new Error("request lineage does not match batch source refs");
  }
  if (lineage.expectedOutputArtifactRef !== expectedOutputArtifactRef) {
    throw new Error("request lineage does not match expected output ref");
  }

  const blockers = validateBlockers(source.blockers, "request blockers");
  const readiness = record(source.readiness, "request readiness");
  exactFields(readiness, READINESS_FIELDS, "request readiness");
  exactString(readiness.status, "blocked", "request readiness.status");
  const readinessBlockers = validateBlockers(readiness.blockers, "request readiness.blockers");
  if (!sameStringArray(blockers, readinessBlockers)) throw new Error("request readiness blockers must match blockers");

  validateHumanReview(source.humanReview, "request humanReview");

  const templatePolicy = record(source.templateReusePolicy, "request templateReusePolicy");
  exactFields(templatePolicy, TEMPLATE_POLICY_FIELDS, "request templateReusePolicy");
  exactString(templatePolicy.mode, "template-madlib", "request templateReusePolicy.mode");
  exactString(templatePolicy.commonSocialHooks, "allowed", "request templateReusePolicy.commonSocialHooks");
  exactString(templatePolicy.creatorBodyCopy, "forbidden", "request templateReusePolicy.creatorBodyCopy");

  const modelBoundary = record(source.modelBoundary, "request modelBoundary");
  exactFields(modelBoundary, MODEL_BOUNDARY_FIELDS, "request modelBoundary");
  exactString(modelBoundary.modelInvocation, "deferred", "request modelBoundary.modelInvocation");
  exactString(modelBoundary.sideEffects, "none", "request modelBoundary.sideEffects");
  const boundaries = record(modelBoundary.boundaries, "request modelBoundary.boundaries");
  exactFields(boundaries, MODEL_BOUNDARIES_FIELDS, "request modelBoundary.boundaries");
  exactBoolean(boundaries.composesBody, false, "request modelBoundary.boundaries.composesBody");
  exactBoolean(boundaries.commonHookMadLibAllowed, true, "request modelBoundary.boundaries.commonHookMadLibAllowed");
  exactBoolean(boundaries.creatorBodyCopyAllowed, false, "request modelBoundary.boundaries.creatorBodyCopyAllowed");

  exactBoolean(source.generatesCopy, false, "request.generatesCopy");
  exactBoolean(source.creatorBodyCopyAllowed, false, "request.creatorBodyCopyAllowed");
  exactString(source.sideEffects, "none", "request.sideEffects");

  return {
    id,
    identity: {
      ...identity,
      hookTemplateRefs: [...identity.hookTemplateRefs],
      experimentRefs: [...identity.experimentRefs],
    },
    lineage,
    humanReview: { required: true, before: "publish", approvalOwner: "human", status: "pending" },
    blockers: [...blockers],
  };
}

interface ValidatedDraftBatch {
  readonly sourceThoughtRef: string;
  readonly sourceArtifactRef: string;
  readonly requests: DraftBatchInspectionRequest[];
}

function validateBatch(value: unknown): ValidatedDraftBatch {
  const source = record(value, "draft batch");
  exactFields(source, BATCH_FIELDS, "draft batch");
  exactString(source.kind, "grow_draft_batch", "draft batch.kind");
  exactString(source.version, DRAFT_BATCH_VERSION, "draft batch.version");
  const sourceThoughtRef = requiredText(source.sourceThoughtRef, "draft batch.sourceThoughtRef");
  const sourceArtifactRef = requiredText(source.sourceArtifactRef, "draft batch.sourceArtifactRef");
  if (!Array.isArray(source.requests) || source.requests.length === 0) throw new Error("requests must be a non-empty array");
  exactBoolean(source.humanReviewRequired, true, "humanReviewRequired");
  exactBoolean(source.generatesCopy, false, "generatesCopy");
  exactBoolean(source.creatorBodyCopyAllowed, false, "creatorBodyCopyAllowed");
  exactString(source.modelInvocation, "deferred", "modelInvocation");
  exactBoolean(source.autoApproval, false, "autoApproval");
  exactBoolean(source.autoScheduling, false, "autoScheduling");
  exactBoolean(source.autoPublishing, false, "autoPublishing");
  exactString(source.sideEffects, "none", "sideEffects");

  const requests = source.requests.map((request) => validateRequest(request, { sourceThoughtRef, sourceArtifactRef }));
  const seenIds = new Set<string>();
  const seenIdentities = new Set<string>();
  for (const request of requests) {
    if (seenIds.has(request.id)) throw new Error(`duplicate request id: ${request.id}`);
    seenIds.add(request.id);
    const key = identityKey(request.identity);
    if (seenIdentities.has(key)) throw new Error(`duplicate exact request identity: ${key}`);
    seenIdentities.add(key);
  }

  return {
    sourceThoughtRef,
    sourceArtifactRef,
    requests,
  };
}

/** Validate and project only the body-free metadata needed by an operator. */
export function buildDraftBatchInspection(batch: unknown): DraftBatchInspection {
  const validated = validateBatch(batch);
  const requests = [...validated.requests]
    .sort((left, right) => compare(identityKey(left.identity), identityKey(right.identity)));
  const platforms = requests.map((request) => request.identity.platform);
  const formats = requests.map((request) => request.identity.format);
  const blockers = [...new Set(requests.flatMap((request) => request.blockers))].sort(compare);

  return {
    kind: "grow_draft_batch_inspection",
    version: DRAFT_BATCH_INSPECTION_VERSION,
    sourceThoughtRef: validated.sourceThoughtRef,
    sourceArtifactRef: validated.sourceArtifactRef,
    requests,
    counts: {
      total: requests.length,
      byPlatform: sortedCounts(platforms),
      byFormat: sortedCounts(formats),
    },
    humanReview: {
      required: true,
      before: "publish",
      approvalOwner: "human",
      status: "pending",
      pending: requests.length,
    },
    blockers,
    generatesCopy: false,
    creatorBodyCopyAllowed: false,
    modelInvocation: "deferred",
    autoApproval: false,
    autoScheduling: false,
    autoPublishing: false,
    sideEffects: "none",
  };
}

export const inspectDraftBatch = buildDraftBatchInspection;
export const createDraftBatchInspection = buildDraftBatchInspection;

export function renderDraftBatchInspectionJson(inspection: DraftBatchInspection): string {
  return `${JSON.stringify(inspection, null, 2)}\n`;
}

function cell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function refs(value: readonly string[]): string {
  return value.map(cell).join(", ");
}

function counts(value: Readonly<Record<string, number>>): string {
  return Object.entries(value).map(([name, count]) => `${cell(name)} ${count}`).join("; ");
}

function lineage(value: DraftRequest["lineage"]): string {
  return [
    `thought=${cell(value.sourceThoughtRef)}`,
    `artifact=${cell(value.sourceArtifactRef)}`,
    `brief=${cell(value.generationBriefRef)}`,
    `volume=${cell(value.volumePlanRef)}`,
    `coverage=${cell(value.treatmentCoverageRef)}`,
    `output=${cell(value.expectedOutputArtifactRef)}`,
  ].join("; ");
}

export function renderDraftBatchInspectionMarkdown(inspection: DraftBatchInspection): string {
  const lines = [
    "# Draft batch inspection",
    "",
    `Batch source: ${cell(inspection.sourceThoughtRef)} / ${cell(inspection.sourceArtifactRef)}`,
    `Requests: ${inspection.counts.total}`,
    `Platform counts: ${counts(inspection.counts.byPlatform)}`,
    `Format counts: ${counts(inspection.counts.byFormat)}`,
    `Human review: ${inspection.humanReview.status} (${inspection.humanReview.approvalOwner} before ${inspection.humanReview.before}); pending ${inspection.humanReview.pending}`,
    `Blockers: ${inspection.blockers.length ? inspection.blockers.map(cell).join("; ") : "none"}`,
    "",
    "## Requests",
    "",
    "| # | Platform | Medium | Format | Treatment | Hooks | Experiments | Review | Blockers |",
    "|---:|---|---|---|---|---|---|---|---|",
    ...inspection.requests.flatMap((request, index) => [
      `| ${index + 1} | ${cell(request.identity.platform)} | ${cell(request.identity.medium)} | ${cell(request.identity.format)} | ${cell(request.identity.treatmentRef)} | ${refs(request.identity.hookTemplateRefs)} | ${refs(request.identity.experimentRefs)} | ${request.humanReview.status} | ${request.blockers.map(cell).join("; ")} |`,
      `| | ID: ${cell(request.id)} | | | | | | human before ${request.humanReview.before} | |`,
      `| | Lineage: ${lineage(request.lineage)} | | | | | | | |`,
    ]),
    "",
    "Read-only: no copy generated, no model invoked, no approval, scheduling, publishing, or persistence performed.",
  ];
  return `${lines.join("\n")}\n`;
}

export function renderDraftBatchInspection(
  inspection: DraftBatchInspection,
  format: DraftBatchInspectionFormat,
): string {
  if (format === "json") return renderDraftBatchInspectionJson(inspection);
  if (format === "markdown") return renderDraftBatchInspectionMarkdown(inspection);
  return `${renderDraftBatchInspectionJson(inspection)}\n${renderDraftBatchInspectionMarkdown(inspection)}`;
}
