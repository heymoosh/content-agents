/**
 * A body-free, reference-only description of an explicitly supplied platform treatment.
 *
 * This module does not read the corpus, inspect creator prose, call a provider, choose a winner,
 * or generate copy. It validates the reviewed or hypothetical overlay that a later Grow stage
 * may use as one input to a platform experiment.
 */

export const PLATFORM_TREATMENT_BLUEPRINT_VERSION = "platform-treatment-blueprint-v1" as const;

export type PlatformTreatmentOverlayKind = "reviewed" | "hypothesis";
export type PlatformTreatmentEvidencePool = "niche" | "broad" | "format";
export type PlatformTreatmentEvidenceStatus = "supported" | "hypothesis" | "insufficient" | "blocked";
export type PlatformTreatmentReviewStatus = "pending" | "passed" | "failed" | "not-run";
export type PlatformTreatmentText = string | "unknown" | null;
export type PlatformTreatmentList = readonly string[] | "unknown" | null;

export interface PlatformTreatmentMechanismInput {
  readonly id: string;
  readonly name: string;
  readonly sequence: readonly string[];
  readonly sourceSlots: readonly string[];
  readonly nativeAffordances: readonly string[];
}

export type PlatformTreatmentMechanism = PlatformTreatmentMechanismInput;

export interface PlatformTreatmentMechanismSetInput {
  readonly hook: PlatformTreatmentMechanismInput | null;
  readonly structure: PlatformTreatmentMechanismInput | null;
  readonly retentionPayoff: PlatformTreatmentMechanismInput | null;
  readonly cta: PlatformTreatmentMechanismInput | null;
  readonly format: PlatformTreatmentMechanismInput | null;
}

export type PlatformTreatmentMechanismSet = {
  readonly [K in keyof PlatformTreatmentMechanismSetInput]: PlatformTreatmentMechanism | null;
};

export interface PlatformTreatmentBlueprintInputRow {
  readonly id: string;
  readonly overlayKind: PlatformTreatmentOverlayKind;
  readonly platform: string;
  readonly medium: string;
  readonly format: string;
  readonly evidencePool: PlatformTreatmentEvidencePool;
  readonly niche: PlatformTreatmentText;
  readonly topic: PlatformTreatmentText;
  readonly analysisRefs: PlatformTreatmentList;
  readonly sourceRefs: PlatformTreatmentList;
  readonly baselineRefs: PlatformTreatmentList;
  readonly discoverySurfaces: PlatformTreatmentList;
  readonly responseIntent: PlatformTreatmentText;
  readonly mechanisms: PlatformTreatmentMechanismSetInput;
  readonly patternRefs: PlatformTreatmentList;
  readonly hookTemplateRefs: PlatformTreatmentList;
  readonly platformConfigRef: PlatformTreatmentText;
  readonly spinAngleRef: PlatformTreatmentText;
  readonly evidenceStatus: PlatformTreatmentEvidenceStatus;
  readonly caveats: PlatformTreatmentList;
  readonly reviewStatus: PlatformTreatmentReviewStatus;
  readonly originalityStatus: PlatformTreatmentReviewStatus;
  readonly reviewer: PlatformTreatmentText;
  readonly reviewedAt: PlatformTreatmentText;
}

export interface PlatformTreatmentReadiness {
  readonly status: "ready" | "blocked";
  readonly blockers: string[];
}

export interface PlatformTreatmentBlueprintRow extends Omit<PlatformTreatmentBlueprintInputRow, "mechanisms"> {
  readonly mechanisms: PlatformTreatmentMechanismSet;
  readonly readiness: PlatformTreatmentReadiness;
  readonly bodyIncluded: false;
}

export interface PlatformTreatmentBlueprint {
  readonly kind: "platform_treatment_blueprint";
  readonly version: typeof PLATFORM_TREATMENT_BLUEPRINT_VERSION;
  readonly rows: PlatformTreatmentBlueprintRow[];
  readonly readiness: PlatformTreatmentReadiness;
  readonly bodyIncluded: false;
  readonly generatesCopy: false;
  readonly creatorBodyCopyAllowed: false;
  readonly winnerClaimsAllowed: false;
  readonly universalViralityClaimAllowed: false;
  readonly sideEffects: "none";
}

type UnknownRecord = Record<string, unknown>;

const ROW_KEYS = new Set([
  "id", "overlayKind", "platform", "medium", "format", "evidencePool", "niche", "topic",
  "analysisRefs", "sourceRefs", "baselineRefs", "discoverySurfaces", "responseIntent", "mechanisms",
  "patternRefs", "hookTemplateRefs", "platformConfigRef", "spinAngleRef", "evidenceStatus", "caveats",
  "reviewStatus", "originalityStatus", "reviewer", "reviewedAt",
]);
const MECHANISM_KEYS = new Set(["id", "name", "sequence", "sourceSlots", "nativeAffordances"]);
const MECHANISM_FIELDS = ["hook", "structure", "retentionPayoff", "cta", "format"] as const;
const REVIEW_STATUSES = new Set<PlatformTreatmentReviewStatus>(["pending", "passed", "failed", "not-run"]);
const EVIDENCE_POOLS = new Set<PlatformTreatmentEvidencePool>(["niche", "broad", "format"]);
const EVIDENCE_STATUSES = new Set<PlatformTreatmentEvidenceStatus>(["supported", "hypothesis", "insufficient", "blocked"]);
const FORBIDDEN_KEYS = new Set([
  "body", "bodytext", "creatorbody", "creatorbodycopy", "creatorbodytext", "creatorcopy", "postbody",
  "posttext", "rawbody", "rawtext", "transcript", "transcripttext", "content", "copy", "draft", "prompt",
  "completion", "model", "winner", "ranking", "viral", "proven",
]);

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function keyName(value: string): string {
  return value.replace(/[_-]/g, "").toLowerCase();
}

function rejectForbiddenKeys(value: unknown, path: string, active = new WeakSet<object>()): void {
  if (!isRecord(value) && !Array.isArray(value)) return;
  const object = value as object;
  if (active.has(object)) throw new TypeError(`${path} contains a cyclic value`);
  active.add(object);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => rejectForbiddenKeys(entry, `${path}[${index}]`, active));
  } else {
    for (const [key, entry] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(keyName(key))) {
        throw new TypeError(`${path}.${key} is unsupported; body, model, ranking, and winner fields are forbidden`);
      }
      rejectForbiddenKeys(entry, `${path}.${key}`, active);
    }
  }
  active.delete(object);
}

function assertAllowedKeys(value: UnknownRecord, allowed: ReadonlySet<string>, path: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new TypeError(`unsupported field: ${path}.${key}`);
  }
}

function requiredField(value: UnknownRecord, field: string, path: string): unknown {
  if (!Object.hasOwn(value, field)) throw new TypeError(`${path}.${field} is required; missing metadata is not inferred`);
  return value[field];
}

function text(value: unknown, label: string): PlatformTreatmentText {
  if (value === null || value === "unknown") return value;
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be a non-empty string, null, or unknown`);
  }
  return value.trim();
}

function requiredText(value: unknown, label: string): string {
  const normalized = text(value, label);
  if (normalized === null || normalized === "unknown") throw new TypeError(`${label} must be a non-empty string`);
  return normalized;
}

function normalizedList(value: unknown, label: string): PlatformTreatmentList {
  if (value === null || value === "unknown") return value;
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array, null, or unknown`);
  const values = value.map((entry, index) => requiredText(entry, `${label}[${index}]`));
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function nonEmpty(value: PlatformTreatmentList): boolean {
  return Array.isArray(value) && value.length > 0;
}

function reviewStatus(value: unknown, label: string): PlatformTreatmentReviewStatus {
  if (typeof value !== "string" || !REVIEW_STATUSES.has(value.trim() as PlatformTreatmentReviewStatus)) {
    throw new TypeError(`${label} must be pending, passed, failed, or not-run`);
  }
  return value.trim() as PlatformTreatmentReviewStatus;
}

function evidenceStatus(value: unknown): PlatformTreatmentEvidenceStatus {
  if (typeof value !== "string" || !EVIDENCE_STATUSES.has(value.trim() as PlatformTreatmentEvidenceStatus)) {
    throw new TypeError("evidenceStatus must be supported, hypothesis, insufficient, or blocked");
  }
  return value.trim() as PlatformTreatmentEvidenceStatus;
}

function mechanism(value: unknown, path: string): PlatformTreatmentMechanism | null {
  if (value === null) return null;
  if (!isRecord(value)) throw new TypeError(`${path} must be an object or null`);
  assertAllowedKeys(value, MECHANISM_KEYS, path);
  const list = (field: string): string[] => {
    const source = requiredField(value, field, path);
    if (!Array.isArray(source)) throw new TypeError(`${path}.${field} must be an array`);
    return source.map((entry, index) => requiredText(entry, `${path}.${field}[${index}]`));
  };
  return {
    id: requiredText(requiredField(value, "id", path), `${path}.id`),
    name: requiredText(requiredField(value, "name", path), `${path}.name`),
    sequence: list("sequence"),
    sourceSlots: list("sourceSlots"),
    nativeAffordances: list("nativeAffordances"),
  };
}

function normalizeMechanisms(value: unknown, path: string): PlatformTreatmentMechanismSet {
  if (!isRecord(value)) throw new TypeError(`${path} must be an object`);
  assertAllowedKeys(value, new Set(MECHANISM_FIELDS), path);
  return Object.fromEntries(MECHANISM_FIELDS.map((field) => [field, mechanism(requiredField(value, field, path), `${path}.${field}`)])) as PlatformTreatmentMechanismSet;
}

function coordinateKey(row: Pick<PlatformTreatmentBlueprintRow, "platform" | "medium" | "format" | "evidencePool" | "niche" | "topic">): string {
  return JSON.stringify([row.platform, row.medium, row.format, row.evidencePool, row.niche, row.topic]);
}

function readinessFor(row: Omit<PlatformTreatmentBlueprintRow, "readiness" | "bodyIncluded">): PlatformTreatmentReadiness {
  const blockers: string[] = [];
  if (row.overlayKind === "hypothesis") blockers.push("overlay kind is hypothesis");
  if (row.evidencePool === "niche" && (row.niche === null || row.niche === "unknown")) blockers.push("niche label is missing for niche evidence");
  if (row.topic === null || row.topic === "unknown") blockers.push("topic is missing");
  if (!nonEmpty(row.analysisRefs)) blockers.push("analysis refs are missing");
  if (!nonEmpty(row.sourceRefs)) blockers.push("source refs are missing");
  if (!nonEmpty(row.baselineRefs)) blockers.push("baseline refs are missing");
  if (!nonEmpty(row.discoverySurfaces)) blockers.push("discovery surfaces are missing");
  if (row.responseIntent === null || row.responseIntent === "unknown") blockers.push("response intent is missing");
  for (const field of MECHANISM_FIELDS) if (row.mechanisms[field] === null) blockers.push(`${field} mechanism is missing`);
  if (!nonEmpty(row.patternRefs)) blockers.push("pattern refs are missing");
  if (!nonEmpty(row.hookTemplateRefs)) blockers.push("hook template refs are missing");
  if (row.platformConfigRef === null || row.platformConfigRef === "unknown") blockers.push("platform config ref is missing");
  if (row.spinAngleRef === null || row.spinAngleRef === "unknown") blockers.push("spin angle ref is missing");
  if (row.evidenceStatus !== "supported") blockers.push(`evidence status is ${row.evidenceStatus}`);
  if (row.reviewStatus !== "passed") blockers.push(`review status is ${row.reviewStatus}`);
  if (row.originalityStatus !== "passed") blockers.push(`originality status is ${row.originalityStatus}`);
  if (row.reviewer === null || row.reviewer === "unknown") blockers.push("reviewer is missing");
  if (row.reviewedAt === null || row.reviewedAt === "unknown") blockers.push("reviewedAt is missing");
  return { status: blockers.length === 0 ? "ready" : "blocked", blockers: [...new Set(blockers)].sort((left, right) => left.localeCompare(right)) };
}

function projectRow(input: PlatformTreatmentBlueprintInputRow, index: number): PlatformTreatmentBlueprintRow {
  if (!isRecord(input)) throw new TypeError(`rows[${index}] must be an object`);
  const raw = input as unknown as UnknownRecord;
  const path = `rows[${index}]`;
  rejectForbiddenKeys(raw, path);
  assertAllowedKeys(raw, ROW_KEYS, path);
  const projected: Omit<PlatformTreatmentBlueprintRow, "readiness" | "bodyIncluded"> = {
    id: requiredText(requiredField(raw, "id", path), `${path}.id`),
    overlayKind: requiredField(raw, "overlayKind", path) as PlatformTreatmentOverlayKind,
    platform: requiredText(requiredField(raw, "platform", path), `${path}.platform`),
    medium: requiredText(requiredField(raw, "medium", path), `${path}.medium`),
    format: requiredText(requiredField(raw, "format", path), `${path}.format`),
    evidencePool: requiredField(raw, "evidencePool", path) as PlatformTreatmentEvidencePool,
    niche: text(requiredField(raw, "niche", path), `${path}.niche`),
    topic: text(requiredField(raw, "topic", path), `${path}.topic`),
    analysisRefs: normalizedList(requiredField(raw, "analysisRefs", path), `${path}.analysisRefs`),
    sourceRefs: normalizedList(requiredField(raw, "sourceRefs", path), `${path}.sourceRefs`),
    baselineRefs: normalizedList(requiredField(raw, "baselineRefs", path), `${path}.baselineRefs`),
    discoverySurfaces: normalizedList(requiredField(raw, "discoverySurfaces", path), `${path}.discoverySurfaces`),
    responseIntent: text(requiredField(raw, "responseIntent", path), `${path}.responseIntent`),
    mechanisms: normalizeMechanisms(requiredField(raw, "mechanisms", path), `${path}.mechanisms`),
    patternRefs: normalizedList(requiredField(raw, "patternRefs", path), `${path}.patternRefs`),
    hookTemplateRefs: normalizedList(requiredField(raw, "hookTemplateRefs", path), `${path}.hookTemplateRefs`),
    platformConfigRef: text(requiredField(raw, "platformConfigRef", path), `${path}.platformConfigRef`),
    spinAngleRef: text(requiredField(raw, "spinAngleRef", path), `${path}.spinAngleRef`),
    evidenceStatus: evidenceStatus(requiredField(raw, "evidenceStatus", path)),
    caveats: normalizedList(requiredField(raw, "caveats", path), `${path}.caveats`),
    reviewStatus: reviewStatus(requiredField(raw, "reviewStatus", path), `${path}.reviewStatus`),
    originalityStatus: reviewStatus(requiredField(raw, "originalityStatus", path), `${path}.originalityStatus`),
    reviewer: text(requiredField(raw, "reviewer", path), `${path}.reviewer`),
    reviewedAt: text(requiredField(raw, "reviewedAt", path), `${path}.reviewedAt`),
  };
  if (projected.overlayKind !== "reviewed" && projected.overlayKind !== "hypothesis") throw new TypeError(`${path}.overlayKind must be reviewed or hypothesis`);
  if (!EVIDENCE_POOLS.has(projected.evidencePool)) throw new TypeError(`${path}.evidencePool must be niche, broad, or format`);
  return { ...projected, readiness: readinessFor(projected), bodyIncluded: false };
}

export function buildPlatformTreatmentBlueprint(inputs: readonly PlatformTreatmentBlueprintInputRow[]): PlatformTreatmentBlueprint {
  if (!Array.isArray(inputs)) throw new TypeError("platform treatment rows must be an array");
  const rows = inputs.map(projectRow).sort((left, right) => coordinateKey(left).localeCompare(coordinateKey(right)) || left.id.localeCompare(right.id));
  const seen = new Set<string>();
  for (const row of rows) {
    const key = coordinateKey(row);
    if (seen.has(key)) throw new TypeError(`duplicate platform/medium/pool/topic identity: ${key}`);
    seen.add(key);
  }
  const blockers = [...new Set(rows.flatMap((row) => row.readiness.blockers))].sort((left, right) => left.localeCompare(right));
  return {
    kind: "platform_treatment_blueprint",
    version: PLATFORM_TREATMENT_BLUEPRINT_VERSION,
    rows,
    readiness: { status: rows.length > 0 && blockers.length === 0 ? "ready" : "blocked", blockers: rows.length === 0 ? ["no explicit platform treatment rows"] : blockers },
    bodyIncluded: false,
    generatesCopy: false,
    creatorBodyCopyAllowed: false,
    winnerClaimsAllowed: false,
    universalViralityClaimAllowed: false,
    sideEffects: "none",
  };
}

export const createPlatformTreatmentBlueprint = buildPlatformTreatmentBlueprint;
