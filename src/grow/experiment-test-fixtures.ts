import { experimentBodyDigest, type GrowExperimentOutcomeFamily, type SignalsExperimentRecommendationInput } from "./experiment-slice.js";

export function configuredEditorEvidence(body: string) {
  return {
    pipeline: "content-studio-configured-v1" as const,
    editor: {
      version: "cold-feed-v1" as const,
      status: "passed" as const,
      recommendation: "Ground the concrete subject immediately for a mixed-feed reader.",
      inputBodyDigest: experimentBodyDigest(`pre-editor:${body}`),
      outputBodyDigest: experimentBodyDigest(body),
    },
  };
}

export function signalsExperimentRecommendation(input: {
  variantId: string;
  comparisonRef?: string;
  evidenceRefs?: readonly string[];
  families?: readonly GrowExperimentOutcomeFamily[];
  minimumSample?: number;
}): SignalsExperimentRecommendationInput {
  const family = input.families?.includes("conversation") ? "conversation" : input.families?.[0] ?? "attention";
  const comparisonRef = input.comparisonRef ?? "baseline:historical";
  const evidenceRefs = [...(input.evidenceRefs ?? []), comparisonRef];
  return {
    version: "signals-experiment-recommendation-v1",
    id: `signals-rec:${input.variantId}`,
    owner: "signals",
    createdAt: "2026-08-30T11:58:00.000Z",
    evidenceRefs: [...new Set(evidenceRefs)],
    observation: "Qualified evidence leaves a bounded uncertainty worth testing.",
    interpretation: "The selected treatment may improve the named outcome for this audience.",
    hypothesis: `The selected treatment will increase ${family} outcomes relative to ${comparisonRef}.`,
    expectedOutcome: { variantId: input.variantId, comparisonRef, family, metric: `${family}-rate`, direction: "increase" },
    whyThisInput: "This input supports the treatment without requiring invented claims.",
    controlledVariable: "opening treatment",
    constants: ["source", "platform", "CTA"],
    primaryMetric: { family, metric: `${family}-rate` },
    guardrails: [{ family, metric: `${family}-quality`, rule: "Must not materially decline." }],
    minimumSample: input.minimumSample ?? 10,
    minimumDays: 7,
    decisionRule: {
      keep: "Keep if the primary metric improves and the guardrail holds.",
      revise: "Revise if the direction is promising but evidence is insufficient.",
      reject: "Reject if the primary metric does not improve or the guardrail fails.",
    },
    confidence: "low",
    caveats: ["The recommendation is provisional until the declared sample is observed."],
    capacityRationale: "The bounded test is worth one normal publishing slot.",
    provenance: {
      mechanism: "signals-science-agent-v1",
      engine: "codex",
      evidenceDigest: experimentBodyDigest("fixture evidence"),
      promptDigest: experimentBodyDigest("fixture prompt"),
      responseDigest: experimentBodyDigest("fixture response"),
    },
  };
}
