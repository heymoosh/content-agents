import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  buildGrowThisPlan,
  type GrowThisPlan,
  type GrowThisPlanInput,
  type GrowThisStage,
  type GrowThisStageStatus,
} from "./grow-this-plan.js";

export const GROW_THIS_PLAN_CLI_VERSION = "grow-this-plan-cli-v1" as const;
export type GrowThisPlanCliFormat = "json" | "markdown" | "both";

export interface GrowThisPlanCliOptions {
  readonly source: { readonly kind: "json"; readonly value: string } | { readonly kind: "file"; readonly path: string };
  readonly format: GrowThisPlanCliFormat;
}

export interface GrowThisNextAction {
  readonly stage: GrowThisStage | null;
  readonly status: GrowThisStageStatus;
  readonly message: string;
}

export interface GrowThisPlanOperatorView {
  readonly kind: "grow_this_plan_operator_view";
  readonly version: typeof GROW_THIS_PLAN_CLI_VERSION;
  readonly plan: GrowThisPlan;
  readonly nextAction: GrowThisNextAction;
  readonly bodyIncluded: false;
  readonly sideEffects: "none";
}

export class GrowThisPlanCliValidationError extends Error {
  constructor(message: string) { super(message); this.name = "GrowThisPlanCliValidationError"; }
}

function fail(message: string): never { throw new GrowThisPlanCliValidationError(message); }

function record(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${field} must be an object`);
  return value as Record<string, unknown>;
}

function optionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) fail(`${option} requires a value`);
  return value;
}

function keyName(value: string): string { return value.replace(/[_-]/g, "").toLowerCase(); }

const FORBIDDEN_KEYS = new Set([
  "body", "bodytext", "postbody", "creatorbody", "sourcebody", "content", "copy", "generatedcopy",
  "transcript", "model", "modelname", "prompt", "completion", "llm", "apikey", "accesstoken",
  "password", "secret", "winner", "ranking", "rank", "score", "scores", "selectedwinner",
]);

function assertNoUnsafeFields(value: unknown, field: string, seen = new WeakSet<object>()): void {
  if (value === null || typeof value !== "object") return;
  if (seen.has(value)) fail(`${field} contains a cyclic value`);
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoUnsafeFields(item, `${field}[${index + 1}]`, seen));
    return;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(keyName(key))) fail(`${field}.${key} is unsupported; Grow-this planning is body-free and does not accept model, credential, or winner fields`);
    assertNoUnsafeFields(nested, `${field}.${key}`, seen);
  }
}

function jsonObject(raw: string): Record<string, unknown> {
  if (typeof raw !== "string") fail("input must contain text");
  let parsed: unknown;
  try { parsed = JSON.parse(raw) as unknown; }
  catch { fail("input must be valid JSON"); }
  const envelope = record(parsed, "input envelope");
  const allowed = new Set([
    "id", "sourceRef", "cutRef", "variantRefs", "sourceStatus", "cutStatus", "cutDecision", "reviewBundle",
    "generationReviewDelivery", "deliveryRef", "delivery", "experimentRef", "experiment", "outcomeRef", "outcomeLedger", "evidenceRefs",
  ]);
  for (const key of Object.keys(envelope)) if (!allowed.has(key)) fail(`input envelope contains unsupported field "${key}"`);
  for (const field of ["id", "sourceRef", "cutRef", "reviewBundle"]) if (!Object.hasOwn(envelope, field)) fail(`${field} is required`);
  if (!Array.isArray(envelope.variantRefs)) fail("variantRefs must be an array");
  if (Object.hasOwn(envelope, "evidenceRefs") && !Array.isArray(envelope.evidenceRefs)) fail("evidenceRefs must be an array");
  record(envelope.sourceRef, "sourceRef");
  record(envelope.cutRef, "cutRef");
  record(envelope.reviewBundle, "reviewBundle");
  assertNoUnsafeFields(envelope, "input envelope");
  return envelope;
}

export function parseGrowThisPlanInput(raw: string): GrowThisPlanInput {
  const envelope = jsonObject(raw);
  return envelope as unknown as GrowThisPlanInput;
}

export function parseGrowThisPlanArgs(argv: readonly string[]): GrowThisPlanCliOptions {
  let json: string | undefined;
  let file: string | undefined;
  let format: GrowThisPlanCliFormat = "json";
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") {
      if (json !== undefined) fail("--json may only be supplied once");
      json = optionValue(argv, index, argument); index += 1;
    } else if (argument === "--file") {
      if (file !== undefined) fail("--file may only be supplied once");
      file = optionValue(argv, index, argument); index += 1;
    } else if (argument === "--format") {
      const value = optionValue(argv, index, argument);
      if (value !== "json" && value !== "markdown" && value !== "both") fail("--format must be json, markdown, or both");
      format = value; index += 1;
    } else fail(`unknown argument: ${argument}`);
  }
  if (json !== undefined && file !== undefined) fail("exactly one of --json or --file is allowed");
  if (json === undefined && file === undefined) fail("exactly one of --json or --file is required");
  return { source: json === undefined ? { kind: "file", path: file as string } : { kind: "json", value: json }, format };
}

function nextAction(plan: GrowThisPlan): GrowThisNextAction {
  const actionable = plan.lifecycle.find((stage) => stage.status === "blocked" || stage.status === "pending" || stage.status === "not-started");
  if (!actionable) {
    return { stage: null, status: "ready", message: "All recorded stages are ready; record the next measured outcome before making a new decision." };
  }
  const blocker = actionable.blockers[0];
  if (actionable.status === "blocked") {
    return { stage: actionable.stage, status: actionable.status, message: blocker ?? `Resolve the ${actionable.stage} stage blockers.` };
  }
  if (actionable.status === "pending") {
    return { stage: actionable.stage, status: actionable.status, message: blocker ?? `Complete the human decision for the ${actionable.stage} stage.` };
  }
  return { stage: actionable.stage, status: actionable.status, message: `Start the ${actionable.stage} stage when its preceding evidence and human gate are complete.` };
}

export function buildGrowThisPlanOperatorView(input: GrowThisPlanInput): GrowThisPlanOperatorView {
  const plan = buildGrowThisPlan(input);
  return {
    kind: "grow_this_plan_operator_view",
    version: GROW_THIS_PLAN_CLI_VERSION,
    plan,
    nextAction: nextAction(plan),
    bodyIncluded: false,
    sideEffects: "none",
  };
}

export function renderGrowThisPlanJson(view: GrowThisPlanOperatorView): string {
  return `${JSON.stringify(view, null, 2)}\n`;
}

function markdown(value: unknown): string {
  return String(value ?? "null").replace(/[|\r\n]/g, (character) => character === "|" ? "\\|" : " ").replace(/\s+/g, " ").trim();
}

export function renderGrowThisPlanMarkdown(view: GrowThisPlanOperatorView): string {
  const plan = view.plan;
  const lines = [
    "# Grow-this operator view",
    "",
    `Lifecycle: ${plan.readiness.status} | Next action: ${view.nextAction.stage ?? "none"} (${view.nextAction.status})`,
    `Action: ${view.nextAction.message}`,
    `Winner: null | Generates copy: false | Side effects: none`,
    "",
    "| Stage | Status | References | Blockers |",
    "|---|---|---|---|",
    ...plan.lifecycle.map((stage) => `| ${stage.stage} | ${stage.status} | ${markdown(stage.refs.join(", "))} | ${markdown(stage.blockers.join("; "))} |`),
    "",
    "## Human gates",
    "",
    `- Cut: ${plan.gates.cut.status}; ${markdown(plan.gates.cut.blockers.join("; "))}`,
    `- Review: ${plan.gates.review.status}; ${markdown(plan.gates.review.blockers.join("; "))}`,
    `- Delivery: ${plan.gates.delivery.status}; ${markdown(plan.gates.delivery.blockers.join("; "))}`,
    "",
    "No source body, creator body, model output, queue mutation, scheduling, publishing, or winner inference is performed.",
    "",
  ];
  return lines.join("\n");
}

export function renderGrowThisPlan(view: GrowThisPlanOperatorView, format: GrowThisPlanCliFormat): string {
  if (format === "json") return renderGrowThisPlanJson(view);
  if (format === "markdown") return renderGrowThisPlanMarkdown(view);
  return `${renderGrowThisPlanJson(view)}\n${renderGrowThisPlanMarkdown(view)}`;
}

function readSource(source: GrowThisPlanCliOptions["source"]): string {
  return source.kind === "json" ? source.value : readFileSync(source.path, "utf8");
}

export function main(
  argv: readonly string[] = process.argv.slice(2),
  io: { readonly readFile?: (path: string) => string; readonly write?: (value: string) => void; readonly error?: (value: string) => void } = {},
): number {
  try {
    const options = parseGrowThisPlanArgs(argv);
    const raw = options.source.kind === "json" ? options.source.value : (io.readFile ?? ((path: string) => readFileSync(path, "utf8")))(options.source.path);
    const view = buildGrowThisPlanOperatorView(parseGrowThisPlanInput(raw));
    (io.write ?? ((value: string) => process.stdout.write(value)))(renderGrowThisPlan(view, options.format));
    return 0;
  } catch (error) {
    (io.error ?? ((value: string) => process.stderr.write(value)))(`grow:this: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
