import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ventureDir } from "./paths.js";
import { withFileLock } from "../runtime/file-lock.js";
import type { ClaimCeiling, EvidenceTier } from "../review/signals-venture-handoff-store.js";

export type LearningEvaluationRecommendation = "no-change" | "change" | "test";
export type LearningEvaluationTarget = "none" | "hypothesis" | "lead-generation" | "product" | "offer" | "strategy" | "experiment";
export type LearningEvaluationDecision = "accept" | "decline" | "request-more-evidence";

export interface LearningEvaluationInput {
  evaluationId: string; ventureSlug: string; inputRef: string;
  evidenceTier: EvidenceTier; claimCeiling: ClaimCeiling;
  recommendation: LearningEvaluationRecommendation; target: LearningEvaluationTarget;
  rationale: string; proposedChange: string; evidenceRefs: string[]; affectedRefs: string[]; caveats: string[]; engine: string;
}
export interface DownstreamLearningProposal { kind: "venture-learning-proposal"; evaluationId: string; inputRef: string; target: Exclude<LearningEvaluationTarget, "none" | "experiment"> | "experiment"; statement: string; evidenceRefs: string[]; affectedRefs: string[]; claimCeiling: ClaimCeiling; evidenceTier: EvidenceTier; }
export interface LearningEvaluation extends LearningEvaluationInput {
  digest: string; status: "pending" | "accepted" | "declined" | "more-evidence"; decidedBy: "muxin" | null; decisionRationale: string | null; decidedAt: string | null; downstreamProposal: DownstreamLearningProposal | null;
}
type Event = { kind: "evaluation"; at: string; evaluation: LearningEvaluation } | { kind: "decision"; at: string; evaluationId: string; decision: LearningEvaluationDecision; rationale: string };

const PATH = (slug: string) => join(ventureDir(slug), "learning-evaluations.jsonl");
const TIER_MAX: Record<EvidenceTier, ClaimCeiling> = { engagement: "attention", qualitative: "resonance", survey: "stated-need", directional: "directional-comparison", controlled: "bounded-comparison", funnel: "behavioral-intent", business: "observed-demand" };
const RANK: Record<ClaimCeiling, number> = { attention: 1, resonance: 2, "stated-need": 3, "directional-comparison": 4, "bounded-comparison": 5, "behavioral-intent": 6, "observed-demand": 7 };
function fail(message: string): never { throw new Error(`learning-evaluation: ${message}`); }
function text(v: unknown, f: string): string { if (typeof v !== "string" || !v.trim()) fail(`${f} is required`); return v.trim(); }
function validate(i: LearningEvaluationInput): LearningEvaluationInput {
  text(i.evaluationId, "evaluationId"); text(i.ventureSlug, "ventureSlug"); text(i.inputRef, "inputRef"); text(i.rationale, "rationale"); text(i.proposedChange, "proposedChange"); text(i.engine, "engine");
  if (!(i.evidenceTier in TIER_MAX)) fail("evidenceTier is invalid");
  if (!(i.claimCeiling in RANK) || RANK[i.claimCeiling] > RANK[TIER_MAX[i.evidenceTier]]) fail("claimCeiling exceeds evidence tier");
  if (!(i.recommendation === "no-change" || i.recommendation === "change" || i.recommendation === "test")) fail("recommendation is invalid");
  if (!(i.target in { none: 1, hypothesis: 1, "lead-generation": 1, product: 1, offer: 1, strategy: 1, experiment: 1 })) fail("target is invalid");
  if (i.recommendation === "no-change" && i.target !== "none") fail("no-change requires target none");
  if (i.recommendation === "test" && i.target !== "experiment") fail("test requires target experiment");
  if (i.recommendation === "change" && (i.target === "none" || i.target === "experiment")) fail("change requires a non-experiment target");
  if (!Array.isArray(i.evidenceRefs) || !i.evidenceRefs.length || i.evidenceRefs.some((r) => typeof r !== "string" || !r.trim())) fail("evidenceRefs are required");
  if (!Array.isArray(i.affectedRefs) || (i.recommendation !== "no-change" && !i.affectedRefs.length) || i.affectedRefs.some((r) => typeof r !== "string" || !r.trim())) fail("affectedRefs are required for a change or test");
  if (!Array.isArray(i.caveats) || i.caveats.some((r) => typeof r !== "string")) fail("caveats must be an array");
  return {
    evaluationId: i.evaluationId.trim(), ventureSlug: i.ventureSlug.trim(), inputRef: i.inputRef.trim(),
    evidenceTier: i.evidenceTier, claimCeiling: i.claimCeiling, recommendation: i.recommendation, target: i.target,
    rationale: i.rationale.trim(), proposedChange: i.proposedChange.trim(), evidenceRefs: [...new Set(i.evidenceRefs)].sort(),
    affectedRefs: [...new Set(i.affectedRefs)].sort(), caveats: [...i.caveats], engine: i.engine.trim(),
  };
}
function digest(i: LearningEvaluationInput): string { return createHash("sha256").update(JSON.stringify(validate(i))).digest("hex"); }
function readEvents(path: string): Event[] { if (!existsSync(path)) return []; return readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Event); }
function fold(path: string): Map<string, LearningEvaluation> {
  const out = new Map<string, LearningEvaluation>();
  for (const e of readEvents(path)) {
    if (e.kind === "evaluation") {
      const clean = validate(e.evaluation); const expected = digest(clean);
      if (e.evaluation.digest !== expected) fail(`invalid evaluation digest ${clean.evaluationId}`);
      const prior = out.get(clean.evaluationId);
      if (prior && prior.digest !== expected) fail(`conflicting evaluation ${clean.evaluationId}`);
      if (!prior) out.set(clean.evaluationId, { ...clean, digest: expected, status: "pending", decidedBy: null, decisionRationale: null, decidedAt: null, downstreamProposal: null });
    } else {
      const current = out.get(e.evaluationId); if (!current) fail(`decision precedes evaluation ${e.evaluationId}`);
      if (current.status !== "pending") {
        const priorDecision = current.status === "accepted" ? "accept" : current.status === "declined" ? "decline" : "request-more-evidence";
        if (priorDecision === e.decision && current.decisionRationale === e.rationale) continue;
        fail(`evaluation ${e.evaluationId} was already decided differently`);
      }
      current.status = e.decision === "accept" ? "accepted" : e.decision === "decline" ? "declined" : "more-evidence"; current.decidedBy = "muxin"; current.decisionRationale = e.rationale; current.decidedAt = e.at;
      current.downstreamProposal = e.decision === "accept" && current.recommendation !== "no-change" ? { kind: "venture-learning-proposal", evaluationId: current.evaluationId, inputRef: current.inputRef, target: current.target as DownstreamLearningProposal["target"], statement: current.proposedChange, evidenceRefs: [...current.evidenceRefs], affectedRefs: [...current.affectedRefs], claimCeiling: current.claimCeiling, evidenceTier: current.evidenceTier } : null;
    }
  }
  return out;
}
function append(path: string, event: Event): void { mkdirSync(dirname(path), { recursive: true }); appendFileSync(path, JSON.stringify(event) + "\n", { encoding: "utf8", mode: 0o600 }); }
export function recordLearningEvaluation(input: LearningEvaluationInput, path = PATH(input.ventureSlug), at = new Date().toISOString()): LearningEvaluation {
  return withFileLock(`${path}.lock`, () => { const clean = validate(input), d = digest(clean), prior = fold(path).get(clean.evaluationId); if (prior) { if (prior.digest !== d) fail(`conflicting or drifted evaluation ${clean.evaluationId}`); return prior; } const evaluation: LearningEvaluation = { ...clean, digest: d, status: "pending", decidedBy: null, decisionRationale: null, decidedAt: null, downstreamProposal: null }; append(path, { kind: "evaluation", at, evaluation }); return evaluation; });
}
export function recordLearningEvaluationDecision(ventureSlug: string, evaluationId: string, decision: LearningEvaluationDecision, rationale: string, path = PATH(ventureSlug), at = new Date().toISOString()): LearningEvaluation {
  if (!Object.hasOwn({ accept: 1, decline: 1, "request-more-evidence": 1 }, decision)) fail("decision is invalid"); text(rationale, "decision rationale");
  return withFileLock(`${path}.lock`, () => { const current = fold(path).get(evaluationId); if (!current) fail(`unknown evaluation ${evaluationId}`); if (current.ventureSlug !== ventureSlug) fail("evaluation belongs to another venture"); if (current.status !== "pending") { const prior = current.status === "accepted" ? "accept" : current.status === "declined" ? "decline" : "request-more-evidence"; if (prior === decision && current.decisionRationale === rationale.trim()) return current; fail(`evaluation ${evaluationId} was already decided differently`); } append(path, { kind: "decision", at, evaluationId, decision, rationale: rationale.trim() }); return fold(path).get(evaluationId)!; });
}
export function readLearningEvaluations(ventureSlug: string, path = PATH(ventureSlug)): LearningEvaluation[] { return withFileLock(`${path}.lock`, () => [...fold(path).values()].sort((a, b) => a.evaluationId.localeCompare(b.evaluationId))); }
export function loadLearningEvaluation(ventureSlug: string, evaluationId: string, path = PATH(ventureSlug)): LearningEvaluation { const found = readLearningEvaluations(ventureSlug, path).find((e) => e.evaluationId === evaluationId); if (!found) fail(`unknown evaluation ${evaluationId}`); return found; }
