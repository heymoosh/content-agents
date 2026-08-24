/**
 * A planning-only fan-out for the Grow workflow.
 *
 * This boundary retains references to the supplied source and its substance, but never reads
 * either one, calls a model, writes a draft, selects a winner, or releases work. The generated
 * variants are specifications that a later, human-directed stage may use.
 */

export const GENERATION_BRIEF_VERSION = "generation-brief-v1" as const;

export interface GenerationExperimentDimensionInput {
  name: string;
  options: readonly string[];
}

export interface GenerationExperimentDimension {
  name: string;
  options: string[];
}

export interface GenerationExperimentMatrixInput {
  dimensions: readonly GenerationExperimentDimensionInput[];
}

export interface GenerationExperimentMatrix {
  dimensions: GenerationExperimentDimension[];
}

export type GenerationReadinessStatus = "ready" | "blocked";

export interface GenerationPlatformFormatReadinessFact {
  platform: string;
  format: string;
  readiness: {
    status: GenerationReadinessStatus;
    blockers: readonly string[];
  };
}

export interface GenerationBriefReadiness {
  status: GenerationReadinessStatus;
  blockers: string[];
}

export interface GenerationBriefInput {
  sourceReference: string;
  substanceReference: string;
  goal: string;
  platforms: readonly string[];
  formats: readonly string[];
  mediaModes: readonly string[];
  topicLanes: readonly string[];
  patternTemplateRefs: readonly string[];
  dailyVolumePerPlatform?: number | Readonly<Record<string, number>>;
  experimentMatrix?: GenerationExperimentMatrixInput;
  platformFormatReadiness?: readonly GenerationPlatformFormatReadinessFact[];
}

export interface GenerationTemplateReusePolicy {
  mode: "template-madlib";
  commonSocialHooks: "allowed";
  creatorBodyCopy: "forbidden";
}

export interface GenerationHumanGate {
  required: true;
  before: "publish";
  approvalOwner: "human";
  status: "pending";
}

export interface GenerationModelBoundary {
  modelInvocation: "deferred";
  preferredRoute: "claude-subscription";
  costClass: "subscription";
  humanGate: "required";
  humanDecision: "pending";
  sideEffects: "none";
  boundaries: {
    composesBody: false;
    commonHookMadLibAllowed: true;
    creatorBodyCopyAllowed: false;
  };
}

export interface GenerationBriefTreatment {
  mediaMode: string;
  topicLane: string;
  patternTemplateRef: string;
}

export interface GenerationBriefVariant {
  id: string;
  platform: string;
  format: string;
  mediaMode: string;
  topicLane: string;
  patternTemplateRef: string;
  treatment: GenerationBriefTreatment;
  experimentAssignment: Record<string, string> | null;
  readiness?: GenerationBriefReadiness;
  humanGate: GenerationHumanGate;
  specificationOnly: true;
}

export interface GenerationBrief {
  version: typeof GENERATION_BRIEF_VERSION;
  sourceReference: string;
  substanceReference: string;
  goal: string;
  platforms: string[];
  formats: string[];
  mediaModes: string[];
  topicLanes: string[];
  patternTemplateRefs: string[];
  dailyVolumePerPlatform: Record<string, number>;
  experimentMatrix: GenerationExperimentMatrix | null;
  variants: GenerationBriefVariant[];
  templateReusePolicy: GenerationTemplateReusePolicy;
  humanGate: GenerationHumanGate;
  reviewGate: {
    required: true;
    before: "publish";
    approvalOwner: "human";
  };
  modelBoundary: GenerationModelBoundary;
  generatesCopy: false;
  sideEffects: "none";
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} must not be empty`);
  return trimmed;
}

function preservedReference(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  if (!value.trim()) throw new Error(`${label} must not be empty`);
  return value;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizedList(value: unknown, label: string, emptyMessage: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const normalized = [...new Set(value.map((entry) => requiredText(entry, label)))].sort(compareStrings);
  if (!normalized.length) throw new Error(emptyMessage);
  return normalized;
}

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return value;
}

function normalizeDailyVolume(
  platforms: readonly string[],
  value: number | Readonly<Record<string, number>> | undefined,
): Record<string, number> {
  if (value === undefined) {
    return Object.fromEntries(platforms.map((platform) => [platform, 1]));
  }

  if (typeof value === "number") {
    const volume = positiveInteger(value, "daily volume");
    return Object.fromEntries(platforms.map((platform) => [platform, volume]));
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("dailyVolumePerPlatform must be a positive integer or platform map");
  }

  const platformSet = new Set(platforms);
  for (const platform of Object.keys(value)) {
    if (!platformSet.has(platform)) throw new Error(`daily volume contains unknown platform "${platform}"`);
  }

  return Object.fromEntries(
    platforms.map((platform) => [
      platform,
      value[platform] === undefined ? 1 : positiveInteger(value[platform], `daily volume for ${platform}`),
    ]),
  );
}

function normalizeExperimentMatrix(
  value: GenerationExperimentMatrixInput | undefined,
): GenerationExperimentMatrix | null {
  if (value === undefined) return null;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("experimentMatrix must be an object");
  }
  if (!Array.isArray(value.dimensions) || !value.dimensions.length) {
    throw new Error("experiment matrix must contain at least one dimension");
  }

  const dimensions = value.dimensions.map((dimension) => {
    if (dimension === null || typeof dimension !== "object" || Array.isArray(dimension)) {
      throw new Error("experiment dimension must be an object");
    }
    const name = requiredText(dimension.name, "experiment dimension name");
    const options = normalizedList(dimension.options, "experiment option", "experiment options must not be empty");
    return { name, options };
  });
  const names = new Set<string>();
  for (const dimension of dimensions) {
    if (names.has(dimension.name)) throw new Error(`duplicate experiment dimension "${dimension.name}"`);
    names.add(dimension.name);
  }
  return { dimensions: dimensions.sort((left, right) => compareStrings(left.name, right.name)) };
}

function readinessKey(platform: string, format: string): string {
  return JSON.stringify([platform, format]);
}

function normalizePlatformFormatReadiness(
  platforms: readonly string[],
  formats: readonly string[],
  value: readonly GenerationPlatformFormatReadinessFact[] | undefined,
): Map<string, GenerationBriefReadiness> | null {
  if (value === undefined) return null;
  if (!Array.isArray(value)) throw new Error("platformFormatReadiness must be an array");

  const platformSet = new Set(platforms);
  const formatSet = new Set(formats);
  const facts = new Map<string, GenerationBriefReadiness>();
  for (const fact of value) {
    if (fact === null || typeof fact !== "object" || Array.isArray(fact)) {
      throw new Error("platform-format readiness fact must be an object");
    }
    const platform = requiredText(fact.platform, "readiness platform");
    const format = requiredText(fact.format, "readiness format");
    if (!platformSet.has(platform)) throw new Error(`readiness contains unknown platform "${platform}"`);
    if (!formatSet.has(format)) throw new Error(`readiness contains unknown format "${format}"`);

    const readiness = fact.readiness as { status: unknown; blockers: unknown };
    if (readiness === null || typeof readiness !== "object" || Array.isArray(readiness)) {
      throw new Error("platform-format readiness must contain a readiness object");
    }
    if (readiness.status !== "ready" && readiness.status !== "blocked") {
      throw new Error("platform-format readiness status must be ready or blocked");
    }
    if (!Array.isArray(readiness.blockers)) {
      throw new Error("platform-format readiness blockers must be an array");
    }
    const blockers = [...new Set(readiness.blockers.map((blocker: unknown) => requiredText(blocker, "readiness blocker")))];
    if (readiness.status === "blocked" && blockers.length === 0) blockers.push("platform/format readiness is blocked");

    const key = readinessKey(platform, format);
    if (facts.has(key)) throw new Error(`duplicate readiness for ${platform}/${format}`);
    facts.set(key, { status: readiness.status, blockers });
  }
  return facts;
}

function readinessFor(
  platform: string,
  format: string,
  facts: Map<string, GenerationBriefReadiness> | null,
): GenerationBriefReadiness | undefined {
  if (facts === null) return undefined;
  return facts.get(readinessKey(platform, format)) ?? {
    status: "blocked",
    blockers: ["platform/format readiness fact is absent"],
  };
}

function experimentAssignments(matrix: GenerationExperimentMatrix | null): Array<Record<string, string> | null> {
  if (!matrix) return [null];
  let assignments: Array<Record<string, string>> = [{}];
  for (const dimension of matrix.dimensions) {
    assignments = assignments.flatMap((assignment) =>
      dimension.options.map((option) => ({ ...assignment, [dimension.name]: option })),
    );
  }
  return assignments;
}

function assignmentKey(assignment: Record<string, string> | null): string {
  if (!assignment) return "none";
  return Object.entries(assignment)
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([name, value]) => `${name}=${value}`)
    .join("&");
}

function variantId(
  platform: string,
  format: string,
  mediaMode: string,
  topicLane: string,
  patternTemplateRef: string,
  assignment: Record<string, string> | null,
): string {
  return [platform, format, mediaMode, topicLane, patternTemplateRef, assignmentKey(assignment)].join("|");
}

export function createGenerationBrief(input: GenerationBriefInput): GenerationBrief {
  if (input === null || typeof input !== "object") throw new Error("generation brief input must be an object");

  const sourceReference = preservedReference(input.sourceReference, "sourceReference");
  const substanceReference = preservedReference(input.substanceReference, "substanceReference");
  const goal = requiredText(input.goal, "goal");
  const platforms = normalizedList(input.platforms, "platform", "at least one platform is required");
  const formats = normalizedList(input.formats, "format", "formats must not be empty");
  const mediaModes = normalizedList(input.mediaModes, "mediaModes", "mediaModes must not be empty");
  const topicLanes = normalizedList(input.topicLanes, "topicLane", "topicLanes must not be empty");
  const patternTemplateRefs = normalizedList(
    input.patternTemplateRefs,
    "patternTemplateRef",
    "at least one pattern/template reference is required",
  );
  const dailyVolumePerPlatform = normalizeDailyVolume(platforms, input.dailyVolumePerPlatform);
  const experimentMatrix = normalizeExperimentMatrix(input.experimentMatrix);
  const platformFormatReadiness = normalizePlatformFormatReadiness(
    platforms,
    formats,
    input.platformFormatReadiness,
  );
  const assignments = experimentAssignments(experimentMatrix);
  const variants: GenerationBriefVariant[] = [];
  const humanGate: GenerationHumanGate = {
    required: true,
    before: "publish",
    approvalOwner: "human",
    status: "pending",
  };

  for (const platform of platforms) {
    for (const format of formats) {
      for (const mediaMode of mediaModes) {
        for (const topicLane of topicLanes) {
          for (const patternTemplateRef of patternTemplateRefs) {
            for (const experimentAssignment of assignments) {
              const readiness = readinessFor(platform, format, platformFormatReadiness);
              variants.push({
                id: variantId(platform, format, mediaMode, topicLane, patternTemplateRef, experimentAssignment),
                platform,
                format,
                mediaMode,
                topicLane,
                patternTemplateRef,
                treatment: { mediaMode, topicLane, patternTemplateRef },
                experimentAssignment: experimentAssignment ? { ...experimentAssignment } : null,
                ...(readiness ? { readiness: { status: readiness.status, blockers: [...readiness.blockers] } } : {}),
                humanGate: { ...humanGate },
                specificationOnly: true,
              });
            }
          }
        }
      }
    }
  }

  return {
    version: GENERATION_BRIEF_VERSION,
    sourceReference,
    substanceReference,
    goal,
    platforms,
    formats,
    mediaModes,
    topicLanes,
    patternTemplateRefs,
    dailyVolumePerPlatform,
    experimentMatrix,
    variants,
    templateReusePolicy: {
      mode: "template-madlib",
      commonSocialHooks: "allowed",
      creatorBodyCopy: "forbidden",
    },
    humanGate,
    reviewGate: {
      required: true,
      before: "publish",
      approvalOwner: "human",
    },
    modelBoundary: {
      modelInvocation: "deferred",
      preferredRoute: "claude-subscription",
      costClass: "subscription",
      humanGate: "required",
      humanDecision: "pending",
      sideEffects: "none",
      boundaries: {
        composesBody: false,
        commonHookMadLibAllowed: true,
        creatorBodyCopyAllowed: false,
      },
    },
    generatesCopy: false,
    sideEffects: "none",
  };
}
