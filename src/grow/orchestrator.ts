/**
 * A planning-only seam for a future Grow workflow.
 *
 * This module intentionally does not read the source, draft copy, call a model, or write a
 * queue. It records what a later, human-directed run may invoke and where review belongs.
 */

export type GrowSourceDescriptor =
  | { kind: "inline-thought"; text: string }
  | { kind: "local-file"; path: string };

export interface ExperimentVariable {
  name: string;
  options: string[];
}

export interface GrowExperiment {
  hypothesis?: string;
  variables?: ExperimentVariable[];
}

export interface GrowPlanRequest {
  source: GrowSourceDescriptor;
  goal: string;
  platforms: readonly string[];
  experiment?: GrowExperiment;
}

export interface GrowStage {
  id: "preserve-source" | "message-cut" | "platform-format-variants" | "human-review" | "learning-outputs";
  purpose: string;
  outputs: string[];
  requiresHumanReview: boolean;
}

export interface EngineCapability {
  name: string;
  capability: string;
  invocation: "deferred";
}

export interface GrowPlan {
  version: "grow-plan-v1";
  goal: string;
  source: {
    descriptor: GrowSourceDescriptor;
    preservation: "required";
    provenance: "descriptor-retained";
  };
  platforms: string[];
  stages: GrowStage[];
  reviewGate: {
    required: true;
    before: "publish";
    approvalOwner: "human";
  };
  experiment: {
    hypothesis: string | null;
    variables: ExperimentVariable[];
  };
  learningOutputs: string[];
  engineCapabilities: EngineCapability[];
  generatesCopy: false;
  sideEffects: "none";
}

const DEFAULT_VARIABLES: ExperimentVariable[] = [
  { name: "message-cut", options: ["observation", "question"] },
  { name: "format", options: ["text", "image", "video"] },
  { name: "platform", options: [] },
];

const ENGINE_CAPABILITIES: EngineCapability[] = [
  { name: "develop", capability: "develop a planning context for a source and goal", invocation: "deferred" },
  { name: "brand-lens", capability: "check brand alignment and surface gaps without rewriting copy", invocation: "deferred" },
  { name: "atomize", capability: "coordinate extraction-first derivative planning", invocation: "deferred" },
  { name: "atomize/source-triage", capability: "classify source constraints and editorial effects", invocation: "deferred" },
  { name: "atomize/cuts", capability: "record and list human-approved message cuts", invocation: "deferred" },
  { name: "strategy/route", capability: "resolve platform routing decisions", invocation: "deferred" },
  { name: "patterns/catalog", capability: "read pattern-corpus catalog context", invocation: "deferred" },
  { name: "video", capability: "plan video/storyboard work behind its review gate", invocation: "deferred" },
  { name: "review", capability: "coordinate human review of proposed variants", invocation: "deferred" },
  { name: "review/rows", capability: "read review rows and enforce approval prerequisites", invocation: "deferred" },
  { name: "publish", capability: "prepare approved work for a later publication path", invocation: "deferred" },
  { name: "publish/queue", capability: "inspect publication queue only after approval", invocation: "deferred" },
  { name: "signals", capability: "read review and outcome signals for learning", invocation: "deferred" },
  { name: "venture/status", capability: "read Venture phase context when a goal is Venture-related", invocation: "deferred" },
];

function requiredText(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} must not be empty`);
  return trimmed;
}

function normalizePlatforms(platforms: readonly string[]): string[] {
  const normalized = [...new Set(platforms.map((platform) => requiredText(platform, "platform")))].sort();
  if (!normalized.length) throw new Error("at least one platform is required");
  return normalized;
}

function normalizeVariables(
  variables: ExperimentVariable[] | undefined,
  platforms: string[],
): ExperimentVariable[] {
  const supplied = variables ?? DEFAULT_VARIABLES;
  const normalized = supplied.map((variable) => ({
    name: requiredText(variable.name, "experiment variable name"),
    options: [...new Set(variable.options.map((option) => requiredText(option, "experiment option")))].sort(),
  }));
  const platformVariable = normalized.find((variable) => variable.name === "platform");
  if (platformVariable) platformVariable.options = platforms;
  return normalized.sort((a, b) => a.name.localeCompare(b.name));
}

export function createGrowPlan(request: GrowPlanRequest): GrowPlan {
  const goal = requiredText(request.goal, "goal");
  const platforms = normalizePlatforms(request.platforms);
  const source = request.source;
  if (source.kind === "inline-thought") requiredText(source.text, "source");
  else if (source.kind === "local-file") requiredText(source.path, "source path");
  else throw new Error("unsupported source kind");

  return {
    version: "grow-plan-v1",
    goal,
    source: { descriptor: { ...source }, preservation: "required", provenance: "descriptor-retained" },
    platforms,
    stages: [
      { id: "preserve-source", purpose: "retain the original source descriptor and provenance", outputs: ["source descriptor", "provenance reference"], requiresHumanReview: false },
      { id: "message-cut", purpose: "select a human-approved message cut without composing copy", outputs: ["approved message cut reference"], requiresHumanReview: true },
      { id: "platform-format-variants", purpose: "map the approved cut to requested platform and format variants", outputs: ["variant specifications", "experiment assignments"], requiresHumanReview: false },
      { id: "human-review", purpose: "hold every proposed variant for editorial approval", outputs: ["review decision"], requiresHumanReview: true },
      { id: "learning-outputs", purpose: "record outcomes and reusable learning inputs", outputs: ["experiment result", "learning record"], requiresHumanReview: false },
    ],
    reviewGate: { required: true, before: "publish", approvalOwner: "human" },
    experiment: {
      hypothesis: request.experiment?.hypothesis?.trim() || null,
      variables: normalizeVariables(request.experiment?.variables, platforms),
    },
    learningOutputs: ["platform-level outcome", "format-level outcome", "message-cut outcome", "next experiment candidate"],
    engineCapabilities: ENGINE_CAPABILITIES.map((engine) => ({ ...engine })),
    generatesCopy: false,
    sideEffects: "none",
  };
}
