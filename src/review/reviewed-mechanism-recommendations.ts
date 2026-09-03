import { readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../db/db.js";
import { validateUsableResearchDossier, type ResearchDossier } from "../patterns/research-dossier.js";
import type { ContentRequest, RecommendationEvidence } from "./content-request.js";

const USED_TO_THINK_DOSSIER = join(
  repoRoot,
  "docs",
  "reviews",
  "content-studio-phase2-used-to-think-final-dossier.json",
);

const USED_TO_THINK_QUESTION = "used-to-think-now-text-first";
const USED_TO_THINK_SUMMARY = "used-to-think-now-format-hypothesis";

export function containsPersonalBeliefReversal(body: string): boolean {
  const oldBelief = /\bI\s+(?:used\s+to\s+(?:think|believe)|once\s+(?:thought|believed)|thought|believed)\b/i.exec(body);
  const newBelief = /\b(?:now\s+I\s+(?:think|believe)|I\s+now\s+(?:think|believe)|but\s+I\s+(?:now\s+)?(?:think|believe)|today\s+I\s+(?:think|believe)|I\s+no\s+longer\s+(?:think|believe)|I\s+changed\s+my\s+mind)\b/i.exec(body);
  return oldBelief !== null && newBelief !== null && oldBelief.index < newBelief.index;
}

function usedToThinkRecommendation(dossier: ResearchDossier): RecommendationEvidence | null {
  if (dossier.question.id !== USED_TO_THINK_QUESTION) return null;
  if (dossier.question.intendedUse !== "hypothesis" || dossier.usabilityDecision?.disposition !== "hypothesis") {
    throw new Error("reviewed used-to-think dossier must retain its hypothesis disposition");
  }
  if (dossier.bodyIncluded !== false || dossier.winnerClaimsAllowed !== false) {
    throw new Error("reviewed used-to-think dossier must remain body-free and forbid winner claims");
  }
  const summary = dossier.summaries.find((item) => item.id === USED_TO_THINK_SUMMARY);
  if (!summary) throw new Error("reviewed used-to-think dossier is missing its approved mechanism summary");
  return {
    option: "belief-shift",
    kind: "treatment",
    recommended: true,
    source: `research-dossier:${dossier.digest}`,
    reason: `Reviewed hypothesis: use a first-person belief reversal because this source contains a genuine change of mind. ${summary.statement} This does not claim the treatment improves reach or any other outcome.`,
  };
}

export function reviewedMechanismRecommendations(body: string, values: readonly unknown[]): RecommendationEvidence[] {
  if (!containsPersonalBeliefReversal(body)) return [];
  const recommendations: RecommendationEvidence[] = [];
  for (const value of values) {
    const dossier = validateUsableResearchDossier(value);
    const recommendation = usedToThinkRecommendation(dossier);
    if (recommendation) recommendations.push(recommendation);
  }
  return recommendations;
}

export function readReviewedMechanismRecommendations(body: string): RecommendationEvidence[] {
  const dossier = JSON.parse(readFileSync(USED_TO_THINK_DOSSIER, "utf8")) as unknown;
  return reviewedMechanismRecommendations(body, [dossier]);
}

export function assertReviewedMechanismGenerationAuthorization(request: ContentRequest, authoritativeBody: string): void {
  const usesBeliefShift = request.selections.treatments.includes("belief-shift");
  const dossierEvidence = request.recommendations.treatments
    .flatMap((recommendation) => recommendation.evidence)
    .filter((item) => item.source.trim().toLowerCase().startsWith("research-dossier:"));
  if (!usesBeliefShift && dossierEvidence.length === 0) return;
  if (!usesBeliefShift) throw new Error("persisted reviewed mechanism evidence has no selected treatment");
  if (request.origin !== "human-inference" && request.origin !== "studio") {
    throw new Error("belief-shift generation is available only for an authorized Human Inference source");
  }
  const expected = readReviewedMechanismRecommendations(authoritativeBody);
  if (expected.length !== 1 || expected[0]?.option !== "belief-shift") {
    throw new Error("belief-shift generation is not authorized by the canonical reviewed dossier and authoritative approved cut");
  }
  if (JSON.stringify(dossierEvidence) !== JSON.stringify(expected)) {
    throw new Error("persisted belief-shift evidence does not match canonical reviewed dossier authorization");
  }
}
