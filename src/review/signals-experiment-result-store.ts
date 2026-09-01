import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { migrateLegacyDataFile } from "../runtime/data-root.js";
import { withFileLock } from "../runtime/file-lock.js";
import type { Engine } from "./engines.js";
import { isBrandId, type BrandId } from "../identity/brand.js";

export const SIGNALS_EXPERIMENT_RESULTS_PATH = migrateLegacyDataFile(["signals-experiment-results.jsonl"]);
export const SIGNALS_EXPERIMENT_INTERPRETATION_VERSION = "signals-experiment-interpretation-v1" as const;

export type ExperimentInterpretationRecommendation = "keep" | "revise" | "reject";
export type ExperimentInterpretationReviewStatus = "pending" | "accepted" | "rejected";

export interface ExperimentInterpretationInput {
  readonly experimentId: string;
  readonly brandId?: BrandId;
  readonly recommendation: ExperimentInterpretationRecommendation;
  readonly rationale: string;
  readonly evidenceRefs: readonly string[];
  readonly confidence: "low" | "medium" | "high";
  readonly caveats: readonly string[];
  readonly engine: Engine;
}

export interface InterpretableExperimentRow {
  readonly experimentId: string;
  readonly analysisStatus: string;
  readonly outcomeRefs: readonly string[];
}

export interface ExperimentInterpretation {
  readonly kind: "signals_experiment_interpretation";
  readonly version: typeof SIGNALS_EXPERIMENT_INTERPRETATION_VERSION;
  readonly id: string;
  readonly experimentId: string;
  readonly brandId?: BrandId;
  readonly recommendation: ExperimentInterpretationRecommendation;
  readonly rationale: string;
  readonly evidenceRefs: string[];
  readonly confidence: "low" | "medium" | "high";
  readonly caveats: string[];
  readonly engine: Engine;
  readonly createdAt: string;
  readonly reviewStatus: ExperimentInterpretationReviewStatus;
  readonly reviewedBy: "muxin" | null;
  readonly reviewedAt: string | null;
  readonly reviewRationale: string | null;
  readonly winner: null;
  readonly autoWinner: false;
}

type InterpretationProposalEvent = { kind: "interpretation-proposal"; at: string; interpretation: Omit<ExperimentInterpretation, "reviewStatus" | "reviewedBy" | "reviewedAt" | "reviewRationale"> };
type InterpretationReviewEvent = { kind: "interpretation-review"; at: string; interpretationId: string; experimentId: string; status: "accepted" | "rejected"; decidedBy: "muxin"; rationale: string };
type InterpretationEvent = InterpretationProposalEvent | InterpretationReviewEvent;

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} is required`);
  return value.trim();
}

function strings(value: readonly string[], field: string, required = false): string[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  const result = [...new Set(value.map((item, index) => text(item, `${field}[${index}]`)))].sort();
  if (required && result.length === 0) throw new Error(`${field} must not be empty`);
  return result;
}

function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex")}`;
}

/** Parse the science agent's data-only response against the exact measured evidence in its prompt. */
export function parseExperimentInterpretationResult(
  raw: string,
  row: InterpretableExperimentRow,
  engine: Engine,
): ExperimentInterpretationInput {
  if (row.analysisStatus !== "ready") throw new Error(`experiment ${row.experimentId} is not ready for interpretation`);
  let parsed: unknown;
  try { parsed = JSON.parse(raw.trim()); }
  catch { throw new Error("Signals interpretation must be one JSON object"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Signals interpretation must be one JSON object");
  const value = parsed as Record<string, unknown>;
  const allowed = new Set(["experimentId", "recommendation", "rationale", "evidenceRefs", "confidence", "caveats"]);
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`Signals interpretation field ${key} is not allowed`);
  const experimentId = text(value.experimentId, "experimentId");
  if (experimentId !== row.experimentId) throw new Error("Signals interpretation experiment id does not match");
  if (value.recommendation !== "keep" && value.recommendation !== "revise" && value.recommendation !== "reject") throw new Error("interpretation recommendation is invalid");
  if (value.confidence !== "low" && value.confidence !== "medium" && value.confidence !== "high") throw new Error("interpretation confidence is invalid");
  const evidenceRefs = strings(value.evidenceRefs as readonly string[], "evidenceRefs", true);
  const allowedEvidence = new Set(row.outcomeRefs);
  for (const ref of evidenceRefs) if (!allowedEvidence.has(ref)) throw new Error(`interpretation evidence ${ref} was not measured for this experiment`);
  return {
    experimentId,
    recommendation: value.recommendation,
    rationale: text(value.rationale, "rationale"),
    evidenceRefs,
    confidence: value.confidence,
    caveats: strings(value.caveats as readonly string[], "caveats"),
    engine,
  };
}

function readEvents(path: string): InterpretationEvent[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter(Boolean).map((line, index) => {
    try { return JSON.parse(line) as InterpretationEvent; }
    catch { throw new Error(`Signals experiment result ledger line ${index + 1} is invalid JSON`); }
  });
}

function append(path: string, event: InterpretationEvent): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(event) + "\n", { encoding: "utf8", mode: 0o600 });
}

function fold(path: string): Map<string, ExperimentInterpretation> {
  const byExperiment = new Map<string, ExperimentInterpretation>();
  for (const event of readEvents(path)) {
    if (event.kind === "interpretation-proposal") {
      const prior = byExperiment.get(event.interpretation.experimentId);
      if (prior && prior.id !== event.interpretation.id) throw new Error(`experiment ${event.interpretation.experimentId} already has an interpretation awaiting or carrying review`);
      byExperiment.set(event.interpretation.experimentId, {
        ...event.interpretation,
        reviewStatus: prior?.reviewStatus ?? "pending",
        reviewedBy: prior?.reviewedBy ?? null,
        reviewedAt: prior?.reviewedAt ?? null,
        reviewRationale: prior?.reviewRationale ?? null,
      });
      continue;
    }
    const current = byExperiment.get(event.experimentId);
    if (!current || current.id !== event.interpretationId) throw new Error(`interpretation review precedes its proposal for ${event.experimentId}`);
    if (current.reviewStatus !== "pending") throw new Error(`interpretation ${current.id} was reviewed more than once`);
    byExperiment.set(event.experimentId, {
      ...current, reviewStatus: event.status, reviewedBy: event.decidedBy, reviewedAt: event.at, reviewRationale: event.rationale,
    });
  }
  return byExperiment;
}

export function recordExperimentInterpretation(
  input: ExperimentInterpretationInput,
  path: string = SIGNALS_EXPERIMENT_RESULTS_PATH,
  now: string = new Date().toISOString(),
): ExperimentInterpretation {
  if (Number.isNaN(Date.parse(now))) throw new Error("interpretation timestamp is invalid");
  const experimentId = text(input.experimentId, "experimentId");
  if (!["keep", "revise", "reject"].includes(input.recommendation)) throw new Error("interpretation recommendation is invalid");
  if (!["low", "medium", "high"].includes(input.confidence)) throw new Error("interpretation confidence is invalid");
  if (!["claude", "grok", "codex", "ollama-gpt-oss"].includes(input.engine)) throw new Error("interpretation engine is invalid");
  const identity = {
    kind: "signals_experiment_interpretation" as const,
    version: SIGNALS_EXPERIMENT_INTERPRETATION_VERSION,
    experimentId,
    ...(input.brandId ? { brandId: input.brandId } : {}),
    recommendation: input.recommendation,
    rationale: text(input.rationale, "rationale"),
    evidenceRefs: strings(input.evidenceRefs, "evidenceRefs", true),
    confidence: input.confidence,
    caveats: strings(input.caveats, "caveats"),
    engine: input.engine,
    winner: null,
    autoWinner: false as const,
  };
  if (input.brandId !== undefined && !isBrandId(input.brandId)) throw new Error("interpretation brand id is invalid");
  const proposal = { ...identity, id: digest(identity), createdAt: now };
  return withFileLock(`${path}.lock`, () => {
    const prior = fold(path).get(experimentId);
    if (prior) {
      if (prior.id !== proposal.id) throw new Error(`experiment ${experimentId} already has a different interpretation`);
      return prior;
    }
    append(path, { kind: "interpretation-proposal", at: now, interpretation: proposal });
    return { ...proposal, reviewStatus: "pending", reviewedBy: null, reviewedAt: null, reviewRationale: null };
  });
}

export function reviewExperimentInterpretation(
  experimentId: string,
  status: "accepted" | "rejected",
  rationale: string,
  path: string = SIGNALS_EXPERIMENT_RESULTS_PATH,
  now: string = new Date().toISOString(),
): ExperimentInterpretation {
  if (Number.isNaN(Date.parse(now))) throw new Error("interpretation review timestamp is invalid");
  return withFileLock(`${path}.lock`, () => {
    const current = fold(path).get(text(experimentId, "experimentId"));
    if (!current) throw new Error(`unknown experiment interpretation ${experimentId}`);
    if (current.reviewStatus !== "pending") throw new Error(`interpretation ${current.id} was already reviewed`);
    append(path, { kind: "interpretation-review", at: now, interpretationId: current.id, experimentId: current.experimentId, status, decidedBy: "muxin", rationale: text(rationale, "review rationale") });
    return fold(path).get(current.experimentId)!;
  });
}

export function readExperimentInterpretations(path: string = SIGNALS_EXPERIMENT_RESULTS_PATH): ExperimentInterpretation[] {
  if (!existsSync(path)) return [];
  return withFileLock(`${path}.lock`, () => [...fold(path).values()].sort((left, right) => left.experimentId.localeCompare(right.experimentId)));
}

export function loadExperimentInterpretation(experimentId: string, path: string = SIGNALS_EXPERIMENT_RESULTS_PATH): ExperimentInterpretation {
  return withFileLock(`${path}.lock`, () => {
    const row = fold(path).get(experimentId);
    if (!row) throw new Error(`unknown experiment interpretation ${experimentId}`);
    return row;
  });
}
