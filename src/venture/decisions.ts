import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { decisionsPath, ventureDir } from "./paths.js";

export type DecisionStatus = "awaiting_user" | "selected" | "superseded";
export type DecisionKind = "platform-recommendation" | "idea-ranking";

export interface Candidate {
  candidate_id: string;
  label: string;
  scores: Record<string, number>;
  evidence_refs: string[];
  rationale: string;
  unknown_id?: string | null;
  no_cta_reason?: string | null;
}

export interface DecisionRecord {
  decision_id: string;
  decision_kind: DecisionKind;
  rules_version: string;
  input_refs: string[];
  candidates: Candidate[];
  recommended_candidate_ids: string[];
  selected_candidate_ids: string[];
  selected_by: "muxin" | null;
  override_reason: string | null;
  rationale: string | null; // required when selected ids share an unknown_id (§2C.5)
  status: DecisionStatus;
  created_at: string;
  decided_at: string | null;
}

function readLines(slug: string): DecisionRecord[] {
  const path = decisionsPath(slug);
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as DecisionRecord);
}

// Same append-only, latest-line-wins fold as artifacts.jsonl.
export function readDecisions(slug: string): DecisionRecord[] {
  const lines = readLines(slug);
  const latest = new Map<string, DecisionRecord>();
  for (const d of lines) latest.set(d.decision_id, d);
  return [...latest.values()];
}

export function readDecision(slug: string, decisionId: string): DecisionRecord | undefined {
  return readDecisions(slug).find((d) => d.decision_id === decisionId);
}

function appendLine(slug: string, decision: DecisionRecord): void {
  mkdirSync(ventureDir(slug), { recursive: true });
  appendFileSync(decisionsPath(slug), JSON.stringify(decision) + "\n");
}

export interface WriteDecisionInput {
  decision_id: string;
  decision_kind: DecisionKind;
  rules_version: string;
  input_refs: string[];
  candidates: Candidate[];
  recommended_candidate_ids: string[];
  at: string;
}

// Writes a decision awaiting Muxin's selection. Nothing auto-selects -- selected_candidate_ids
// starts empty, selected_by starts null.
export function writeDecision(slug: string, input: WriteDecisionInput): DecisionRecord {
  const record: DecisionRecord = {
    decision_id: input.decision_id,
    decision_kind: input.decision_kind,
    rules_version: input.rules_version,
    input_refs: input.input_refs,
    candidates: input.candidates,
    recommended_candidate_ids: input.recommended_candidate_ids,
    selected_candidate_ids: [],
    selected_by: null,
    override_reason: null,
    rationale: null,
    status: "awaiting_user",
    created_at: input.at,
    decided_at: null,
  };
  appendLine(slug, record);
  return record;
}

export class DecisionAlreadySelectedError extends Error {
  constructor(decisionId: string) {
    super(`decision ${decisionId} is already selected -- immutable once selected, make a new decision instead`);
    this.name = "DecisionAlreadySelectedError";
  }
}

export class SystemSelectionRejectedError extends Error {
  constructor() {
    super('selected_by "system" is rejected -- nothing auto-selects a venture decision, only "muxin" may');
    this.name = "SystemSelectionRejectedError";
  }
}

export class UnknownOverlapRequiresRationaleError extends Error {
  constructor(sharedUnknownId: string) {
    super(
      `two or more selected candidates share unknown_id "${sharedUnknownId}" -- a top-level ` +
        `rationale is required to record why deliberate repetition is worth it here (§5.2)`
    );
    this.name = "UnknownOverlapRequiresRationaleError";
  }
}

export interface SelectDecisionInput {
  selectedCandidateIds: string[];
  selectedBy: "muxin";
  overrideReason?: string | null;
  rationale?: string | null;
  requiredSelectCount?: number; // enforced for idea-ranking; omit for single-select kinds
  at: string;
}

function findSharedUnknownId(candidates: Candidate[], selectedIds: string[]): string | null {
  const seen = new Map<string, string>(); // unknown_id -> first candidate_id that used it
  for (const id of selectedIds) {
    const c = candidates.find((cand) => cand.candidate_id === id);
    const unknownId = c?.unknown_id;
    if (!unknownId) continue;
    if (seen.has(unknownId)) return unknownId;
    seen.set(unknownId, id);
  }
  return null;
}

export function selectDecision(slug: string, decisionId: string, input: SelectDecisionInput): DecisionRecord {
  const current = readDecision(slug, decisionId);
  if (!current) throw new Error(`no such decision: ${decisionId}`);
  if (current.status === "selected") throw new DecisionAlreadySelectedError(decisionId);
  if ((input.selectedBy as string) === "system") throw new SystemSelectionRejectedError();
  if (input.requiredSelectCount !== undefined && input.selectedCandidateIds.length !== input.requiredSelectCount) {
    throw new Error(
      `decision ${decisionId} requires exactly ${input.requiredSelectCount} selected candidates, got ${input.selectedCandidateIds.length}`
    );
  }
  const sharedUnknownId = findSharedUnknownId(current.candidates, input.selectedCandidateIds);
  if (sharedUnknownId && !input.rationale) {
    throw new UnknownOverlapRequiresRationaleError(sharedUnknownId);
  }
  const next: DecisionRecord = {
    ...current,
    selected_candidate_ids: input.selectedCandidateIds,
    selected_by: input.selectedBy,
    override_reason: input.overrideReason ?? null,
    rationale: input.rationale ?? null,
    status: "selected",
    decided_at: input.at,
  };
  appendLine(slug, next);
  return next;
}
