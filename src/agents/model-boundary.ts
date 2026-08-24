/** Pure audit record for model/subagent routing. It describes work; it never invokes a model. */
export const MODEL_BOUNDARY_VERSION = "model-boundary-v1" as const;

export type ModelBoundaryRole = "extractor" | "pattern-adapter" | "researcher" | "generator" | "media-renderer" | "auditor";
export type ModelBoundaryTask = "extraction" | "pattern-adaptation" | "research" | "content-generation" | "media" | "audit";
export type ModelRoute = "claude-subscription" | "codex-subscription" | "local" | "specialist-opt-in";
export type HumanGate = "required" | "not-required";
export type HumanDecision = "pending" | "approved" | "rejected";

export interface ModelBoundaryInput {
  readonly id: string;
  readonly role: ModelBoundaryRole | string;
  readonly taskKind: ModelBoundaryTask | string;
  readonly modelRoute: ModelRoute | string;
  readonly inputRefs: readonly string[];
  readonly outputRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly humanGate: HumanGate;
  readonly humanDecision: HumanDecision;
  readonly sideEffects: "none" | string;
  readonly originalSubstanceRef?: string | null;
  readonly commonHookTemplate?: boolean;
  readonly creatorBodyCopy?: boolean;
}

export interface ModelBoundaryRecord {
  readonly kind: "model_boundary_record";
  readonly version: typeof MODEL_BOUNDARY_VERSION;
  readonly id: string;
  readonly role: ModelBoundaryRole;
  readonly taskKind: ModelBoundaryTask;
  readonly modelRoute: ModelRoute;
  readonly costClass: "subscription" | "local-free" | "paid-opt-in";
  readonly inputRefs: string[];
  readonly outputRefs: string[];
  readonly evidenceRefs: string[];
  readonly humanGate: HumanGate;
  readonly humanDecision: HumanDecision;
  readonly boundaries: {
    readonly composesBody: boolean;
    readonly commonHookMadLibAllowed: boolean;
    readonly creatorBodyCopyAllowed: false;
  };
  readonly readiness: { status: "ready" | "blocked"; blockers: string[] };
  readonly sideEffects: "none";
}

const ROLES = new Set<ModelBoundaryRole>(["extractor", "pattern-adapter", "researcher", "generator", "media-renderer", "auditor"]);
const TASKS = new Set<ModelBoundaryTask>(["extraction", "pattern-adaptation", "research", "content-generation", "media", "audit"]);
const ROUTES = new Set<ModelRoute>(["claude-subscription", "codex-subscription", "local", "specialist-opt-in"]);

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} is required`);
  return value.trim();
}
function refs(value: readonly string[], field: string): string[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${field} must contain at least one audit ref`);
  return [...new Set(value.map((item, index) => text(item, `${field}[${index}]`)))].sort();
}

export function buildModelBoundaryRecord(input: ModelBoundaryInput): ModelBoundaryRecord {
  const id = text(input.id, "id");
  const role = input.role as ModelBoundaryRole;
  const taskKind = input.taskKind as ModelBoundaryTask;
  const modelRoute = input.modelRoute as ModelRoute;
  if (!ROLES.has(role)) throw new Error("role is unknown");
  if (!TASKS.has(taskKind)) throw new Error("taskKind is unknown");
  if (!ROUTES.has(modelRoute)) throw new Error("modelRoute is unknown");
  const inputRefs = refs(input.inputRefs, "inputRefs");
  const outputRefs = refs(input.outputRefs, "outputRefs");
  const evidenceRefs = refs(input.evidenceRefs, "evidenceRefs");
  const creatorBodyCopy = input.creatorBodyCopy ?? false;
  const commonHookMadLibAllowed = input.commonHookTemplate === true && (taskKind === "pattern-adaptation" || taskKind === "content-generation");
  const blockers: string[] = [];
  if (input.sideEffects !== "none") blockers.push("model boundary allows side effects");
  if (creatorBodyCopy) blockers.push("creator body copying is forbidden");
  if ((taskKind === "content-generation" || taskKind === "pattern-adaptation" || taskKind === "research") && input.humanGate !== "required") {
    blockers.push("content work requires a human gate");
  }
  if (input.humanGate === "required" && input.humanDecision === "rejected") blockers.push("human decision is rejected");
  if (commonHookMadLibAllowed && !input.originalSubstanceRef) blockers.push("hook adaptation requires original substance reference");
  if (taskKind === "extraction" && role !== "extractor") blockers.push("extraction must use the extractor role");
  if (taskKind === "content-generation" && role !== "generator") blockers.push("content generation must use the generator role");
  const costClass = modelRoute === "local" ? "local-free" : modelRoute === "specialist-opt-in" ? "paid-opt-in" : "subscription";
  return {
    kind: "model_boundary_record", version: MODEL_BOUNDARY_VERSION, id, role, taskKind, modelRoute, costClass,
    inputRefs, outputRefs, evidenceRefs, humanGate: input.humanGate, humanDecision: input.humanDecision,
    boundaries: { composesBody: taskKind === "content-generation", commonHookMadLibAllowed, creatorBodyCopyAllowed: false },
    readiness: { status: blockers.length === 0 ? "ready" : "blocked", blockers: [...new Set(blockers)] },
    sideEffects: "none",
  };
}

export const createModelBoundaryRecord = buildModelBoundaryRecord;
