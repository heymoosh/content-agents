// Pure, DOM-free, filesystem-free recommendation seam for the Content room.
// Reads nothing from disk. Production answers only through blockedRecommendationRead();
// there is deliberately no "available" or "live" availability state. When a reviewed
// interface eventually exists, adding a usable state is a separate, reviewed change.

export type RecommendationAvailability =
  | "blocked"
  | "insufficient-evidence"
  | "awaiting-review"
  | "unavailable"
  | "empty";

export type RecommendationSource = "fixture-example" | "reviewed-interface";

export interface RecommendationEvidence {
  label: string;
  reference: string;
  caveat: string;
}

export interface RecommendationExample {
  id: string;
  platform: string;
  mechanism: string;
  whyItCouldFit: string;
  evidence: RecommendationEvidence[];
  confidence: "low" | "medium" | "high";
}

export interface RecommendationRead {
  availability: RecommendationAvailability;
  source: RecommendationSource;
  headline: string;
  detail: string;
  examples: RecommendationExample[];
}

export const RECOMMENDATION_STATES: readonly RecommendationAvailability[] = [
  "blocked",
  "insufficient-evidence",
  "awaiting-review",
  "unavailable",
  "empty",
];

const STATE_COPY: Record<RecommendationAvailability, { headline: string; detail: string }> = {
  blocked: {
    headline: "A policy gate is blocking recommendations.",
    detail:
      "The corpus is still unreviewed, so nothing can be offered yet. You decide when that gate opens.",
  },
  "insufficient-evidence": {
    headline: "The evidence behind this answer is too thin to stand on.",
    detail:
      "Thin evidence is not a small version of good evidence. You review what is there before anything becomes usable.",
  },
  "awaiting-review": {
    headline: "Proposals are waiting on your review.",
    detail:
      "Nothing from this seam is usable until you have read those proposals and decided what to do with them.",
  },
  unavailable: {
    headline: "The recommendation source could not be read.",
    detail:
      "This is a failed read, not an empty answer. Repair the source, then you review whatever comes back before it is usable.",
  },
  empty: {
    headline: "The reviewed interface had nothing for this piece.",
    detail:
      "That empty answer is deliberate, not a failure. You still decide whether to act on it or ask for more.",
  },
};

export function describeRecommendation(
  availability: RecommendationAvailability,
): { headline: string; detail: string } {
  return { ...STATE_COPY[availability] };
}

export function blockedRecommendationRead(): RecommendationRead {
  const { headline, detail } = describeRecommendation("blocked");
  return {
    availability: "blocked",
    source: "reviewed-interface",
    headline,
    detail,
    examples: [],
  };
}

// Guard: only fixture-example responses may expose recommendation bodies through this seam.
// A reviewed-interface response that somehow carries examples still returns []. That keeps
// unreviewed mechanism copy from becoming renderable before that stage itself is reviewed.
// src/review/page.ts hand-mirrors this guard in its browser script.
export function recommendationExamplesShown(read: RecommendationRead): RecommendationExample[] {
  return read.source === "fixture-example" ? read.examples : [];
}

export const RECOMMENDATION_EXAMPLE_NOTICE =
  "This example only illustrates the shape the seam will carry; it is not something you have reviewed or signed off on.";

export const FORBIDDEN_RECOMMENDATION_CLAIMS: readonly string[] = [
  "approved",
  "live",
  "proven",
  "best",
  "viral",
  "winner",
  "guaranteed",
  "top-performing",
];

export function claimsLiveness(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_RECOMMENDATION_CLAIMS.some((claim) => {
    const escaped = claim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`).test(lower);
  });
}
