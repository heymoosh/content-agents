/** Read-only evaluation boundary for accepted Venture learning receipts. */
import type { ClaimCeiling, EvidenceTier } from "./signals-venture-handoff-store.js";

export type LearningRecommendation = "no-change" | "change" | "test";
export type LearningTarget = "none" | "hypothesis" | "lead-generation" | "product" | "offer" | "strategy" | "experiment";
export type LearningConfidence = "low" | "medium" | "high";

export interface VentureLearningReceipt {
  id: string; venture: string; phase: number; evidenceTier: EvidenceTier; claimCeiling: ClaimCeiling;
  factualSummary: string; evidenceRefs: string[]; sourceRefs: string[]; scope: string;
  sample: { treatment: number; control: number }; caveats: string[];
}
export interface VentureLearningContext {
  namedHypotheses: Array<{ id: string; summary: string }>;
  refs: Array<{ id: string; kind: string; summary: string }>;
}
export interface VentureLearningEvaluation {
  recommendation: LearningRecommendation; target: LearningTarget; rationale: string;
  proposedChange: string; affectedRefs: string[]; evidenceRefs: string[]; caveats: string[];
  confidence: LearningConfidence;
  provenance: { engine: string; route: "subscription-cli" };
}

const OUTPUT_FIELDS = new Set(["recommendation", "target", "rationale", "proposedChange", "affectedRefs", "evidenceRefs", "caveats", "confidence"]);
const RECOMMENDATIONS = new Set<LearningRecommendation>(["no-change", "change", "test"]);
const TARGETS = new Set<LearningTarget>(["none", "hypothesis", "lead-generation", "product", "offer", "strategy", "experiment"]);
const CONFIDENCES = new Set<LearningConfidence>(["low", "medium", "high"]);
const CEILING_RANK: Record<ClaimCeiling, number> = { attention: 1, resonance: 2, "stated-need": 3, "directional-comparison": 4, "bounded-comparison": 5, "behavioral-intent": 6, "observed-demand": 7 };
const TIER_MAX: Record<EvidenceTier, ClaimCeiling> = { engagement: "attention", qualitative: "resonance", survey: "stated-need", directional: "directional-comparison", controlled: "bounded-comparison", funnel: "behavioral-intent", business: "observed-demand" };

function assertReceiptCeiling(receipt: VentureLearningReceipt): void {
  const ceiling = CEILING_RANK[receipt.claimCeiling];
  const maximum = TIER_MAX[receipt.evidenceTier];
  if (!ceiling || !maximum || ceiling > CEILING_RANK[maximum]) throw new Error("receipt claim ceiling exceeds its evidence tier");
}

export function buildVentureLearningEvaluationPrompt(receipt: VentureLearningReceipt, context: VentureLearningContext): string {
  assertReceiptCeiling(receipt);
  const refs = context.refs.map((r) => `${r.id} (${r.kind}): ${r.summary}`).join("\n");
  const hypotheses = context.namedHypotheses.map((h) => `${h.id}: ${h.summary}`).join("\n");
  return [
    "You are a read-only Venture learning evaluator running through a subscription CLI.",
    "Return exactly one typed recommendation as one JSON object, with only these fields:",
    'recommendation (no-change|change|test), target (none|hypothesis|lead-generation|product|offer|strategy|experiment), rationale, proposedChange, affectedRefs, evidenceRefs, caveats, confidence (low|medium|high).',
    "Use no markdown and no body text. Never auto-apply a change, advance a phase, or select a winner.",
    `Accepted receipt: ${receipt.id}; venture ${receipt.venture}; phase ${receipt.phase}; evidence tier ${receipt.evidenceTier}; claim ceiling: ${receipt.claimCeiling}.`,
    `Factual summary: ${receipt.factualSummary}; scope: ${receipt.scope}; treatment sample ${receipt.sample.treatment}; control sample ${receipt.sample.control}; caveats: ${receipt.caveats.join("; ")}.`,
    `Evidence refs: ${receipt.evidenceRefs.join(", ")}; source refs: ${receipt.sourceRefs.join(", ")}.`,
    `Named hypotheses:\n${hypotheses || "none supplied"}\nVenture context refs:\n${refs || "none supplied"}`,
    "Respect the claim ceiling. Distinguish attention (seen), resonance (engagement), stated need (what someone says they need), directional comparison (a non-causal comparison), bounded comparison (a controlled comparison), behavioral intent (a declared or bounded next action), and observed demand (a measured opt-in, inquiry, or purchase). Do not translate weaker evidence upward into a stronger category.",
    "This is only a contextual recommendation. A separate Experiment planner creates detailed experiment fields after Muxin accepts a test recommendation.",
    "evidenceRefs must be a subset of the supplied receipt evidence/source refs. affectedRefs must be a subset of supplied Venture context refs.",
  ].join("\n");
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("evaluation must be one JSON object");
  return value as Record<string, unknown>;
}
function text(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be a non-empty string`);
  if (/```|(^|\n)\s*#{1,6}\s|\*\*|\[[^\]]+\]\([^)]*\)/.test(value)) throw new Error(`${field} contains markdown/body text`);
  return value.trim();
}
function stringList(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string" || !v.trim())) throw new Error(`${field} must be a string array`);
  const normalized = value.map((v) => String(v).trim());
  if (new Set(normalized).size !== normalized.length) throw new Error(`${field} must contain unique refs`);
  return normalized;
}
function claimRank(textValue: string): number {
  const s = textValue.toLowerCase()
    .replace(/\b(?:is|are|was|were|does|do|did|can|cannot|can't|isn't|aren't|wasn't|weren't)?\s*not\s+(?:proof|evidence)\s+of\s+(?:observed demand|purchase intent|intent)\b/g, "")
    .replace(/\b(?:does|do|did)\s+not\s+prove\s+(?:observed demand|purchase intent|intent)\b/g, "")
    .replace(/\b(?:no|not)\s+(?:observed demand|purchase intent|intent)\b/g, "");
  if (/observed demand|purchase|purchased|revenue|sales|customer(?:s)? (?:bought|paid)|will buy/.test(s)) return 7;
  if (/behavioral intent|intent|sign[- ]?up intent|declared interest/.test(s)) return 6;
  if (/bounded comparison|controlled comparison|control(?:led)? arm/.test(s)) return 5;
  if (/directional comparison|directional(?:ly)? compared/.test(s)) return 4;
  if (/stated need|said they need|asked for/.test(s)) return 3;
  if (/resonance|engagement|reply|comment|save/.test(s)) return 2;
  if (/attention|seen|view|impression/.test(s)) return 1;
  return 0;
}

export function parseVentureLearningEvaluation(raw: string, receipt: VentureLearningReceipt, context: VentureLearningContext, engine = "codex"): VentureLearningEvaluation {
  assertReceiptCeiling(receipt);
  let parsed: unknown;
  try { parsed = JSON.parse(raw.trim()); } catch { throw new Error("evaluation is not valid JSON"); }
  const value = object(parsed);
  for (const key of Object.keys(value)) if (!OUTPUT_FIELDS.has(key)) throw new Error(`unknown field: ${key}`);
  const recommendation = text(value.recommendation, "recommendation") as LearningRecommendation;
  const target = text(value.target, "target") as LearningTarget;
  if (!RECOMMENDATIONS.has(recommendation)) throw new Error("recommendation is invalid");
  if (!TARGETS.has(target)) throw new Error("target is invalid");
  if ((recommendation === "no-change" && target !== "none") || (recommendation === "test" && target !== "experiment") || (recommendation === "change" && (target === "none" || target === "experiment"))) throw new Error("recommendation and target pairing is invalid");
  const rationale = text(value.rationale, "rationale");
  const proposedChange = text(value.proposedChange, "proposedChange");
  const affectedRefs = stringList(value.affectedRefs, "affectedRefs");
  const evidenceRefs = stringList(value.evidenceRefs, "evidenceRefs");
  const caveats = stringList(value.caveats, "caveats");
  const confidence = text(value.confidence, "confidence") as LearningConfidence;
  if (!CONFIDENCES.has(confidence)) throw new Error("confidence is invalid");
  if (recommendation !== "no-change" && affectedRefs.length === 0) throw new Error("affectedRefs must contain at least one ref for a change or test");
  const allowedEvidence = new Set([...receipt.evidenceRefs, ...receipt.sourceRefs]);
  if (evidenceRefs.some((ref) => !allowedEvidence.has(ref))) throw new Error("evidenceRefs must be a subset of supplied receipt refs");
  const allowedAffected = new Set([...context.namedHypotheses.map((h) => h.id), ...context.refs.map((r) => r.id)]);
  if (affectedRefs.some((ref) => !allowedAffected.has(ref))) throw new Error("affectedRefs must be a subset of Venture context refs");
  const ceiling = CEILING_RANK[receipt.claimCeiling];
  if (!ceiling) throw new Error("claim ceiling is unknown");
  const allText = [rationale, proposedChange, ...caveats].join(" ");
  if (claimRank(allText) > ceiling) throw new Error("evaluation overclaims the receipt claim ceiling");
  return { recommendation, target, rationale, proposedChange, affectedRefs, evidenceRefs, caveats, confidence, provenance: { engine, route: "subscription-cli" } };
}
