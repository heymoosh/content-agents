import type { GrowPlan } from "./orchestrator.js";

export interface GrowTreatmentDefinition {
  id?: string;
  medium: string;
  format?: string;
  formats?: readonly string[];
  reason: string;
  patternRefs?: readonly string[];
  evidenceRefs?: readonly string[];
  experimentVariables?: Readonly<Record<string, string>>;
}

export interface GrowVariantCandidate {
  id: string;
  source: GrowPlan["source"];
  provenance: GrowPlan["source"]["provenance"];
  platform: string;
  medium: string;
  format: string;
  treatmentId: string;
  treatmentReason: string;
  patternRefs: string[];
  evidenceRefs: string[];
  experimentVariables: Record<string, string>;
  status: "draft" | "needs-human-review";
  reviewRequirement: string;
}

export interface GrowVariantManifest {
  version: "grow-variant-manifest-v1";
  candidates: GrowVariantCandidate[];
  reviewGate: GrowPlan["reviewGate"];
  generatesCopy: false;
  sideEffects: "none";
}

const DEFAULT_REASON = "Use the plan's requested format as the baseline treatment.";

function requiredText(value: string | undefined, label: string): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) throw new Error(`${label} must not be empty`);
  return trimmed;
}

function uniqueSorted(values: readonly string[] | undefined, label: string): string[] {
  return [...new Set((values ?? []).map((value) => requiredText(value, label)))].sort();
}

function normalizedTreatments(plan: GrowPlan, supplied: readonly GrowTreatmentDefinition[] | undefined): GrowTreatmentDefinition[] {
  if (supplied && supplied.length === 0) throw new Error("at least one treatment definition is required");
  if (!supplied) {
    const planFormats = plan.experiment.variables.find((variable) => variable.name === "format")?.options;
    const formats = planFormats?.length ? planFormats : ["text"];
    return formats.map((format) => ({
      id: `default-${format}`,
      medium: format,
      format,
      reason: DEFAULT_REASON,
    }));
  }

  const normalized = supplied.map((treatment) => {
    const formats = uniqueSorted(
      [...(treatment.formats ?? []), ...(treatment.format === undefined ? [] : [treatment.format])],
      "treatment format",
    );
    if (!formats.length) throw new Error("treatment must define at least one format");
    const experimentVariables = Object.fromEntries(
      Object.entries(treatment.experimentVariables ?? {})
        .map(([name, value]) => [requiredText(name, "experiment variable name"), requiredText(value, "experiment variable value")])
        .sort(([left], [right]) => left.localeCompare(right)),
    );
    return {
      id: requiredText(treatment.id ?? `treatment-${treatment.medium}-${formats.join("-")}`, "treatment id"),
      medium: requiredText(treatment.medium, "treatment medium"),
      formats,
      reason: requiredText(treatment.reason, "treatment reason"),
      patternRefs: uniqueSorted(treatment.patternRefs, "pattern ref"),
      evidenceRefs: uniqueSorted(treatment.evidenceRefs, "evidence ref"),
      experimentVariables,
    };
  });
  const unique = [...new Map(normalized.map((treatment) => [
    JSON.stringify([treatment.medium, treatment.formats, treatment.reason, treatment.patternRefs, treatment.evidenceRefs, treatment.experimentVariables]),
    treatment,
  ])).values()];
  const seenIds = new Set<string>();
  for (const treatment of unique) {
    if (seenIds.has(treatment.id ?? "")) throw new Error(`treatment id must be unique: ${treatment.id}`);
    seenIds.add(treatment.id ?? "");
  }
  return unique;
}

function stableIdPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "value";
}

export function createGrowVariantManifest(
  plan: GrowPlan,
  treatments?: readonly GrowTreatmentDefinition[],
): GrowVariantManifest {
  const definitions = normalizedTreatments(plan, treatments);
  const candidates = definitions.flatMap((treatment) => (treatment.formats ?? []).flatMap((format) => plan.platforms.map((platform) => {
    const experimentVariables = {
      ...treatment.experimentVariables,
      format,
      medium: treatment.medium,
      platform,
    };
    return {
      id: [platform, treatment.id ?? "treatment", format].map(stableIdPart).join("--"),
      source: {
        descriptor: { ...plan.source.descriptor },
        preservation: plan.source.preservation,
        provenance: plan.source.provenance,
      },
      provenance: plan.source.provenance,
      platform,
      medium: treatment.medium,
      format,
      treatmentId: treatment.id ?? "treatment",
      treatmentReason: treatment.reason,
      patternRefs: [...(treatment.patternRefs ?? [])],
      evidenceRefs: [...(treatment.evidenceRefs ?? [])],
      experimentVariables,
      status: "needs-human-review" as const,
      reviewRequirement: "Human approval is required before this candidate can be approved or published.",
    };
  })));

  const uniqueCandidates = [...new Map(candidates.map((candidate) => [
    JSON.stringify([candidate.platform, candidate.medium, candidate.format, candidate.treatmentId, candidate.treatmentReason, candidate.patternRefs, candidate.evidenceRefs, candidate.experimentVariables]),
    candidate,
  ])).values()].sort((left, right) =>
    left.platform.localeCompare(right.platform)
    || left.medium.localeCompare(right.medium)
    || left.format.localeCompare(right.format)
    || left.treatmentId.localeCompare(right.treatmentId));

  return {
    version: "grow-variant-manifest-v1",
    candidates: uniqueCandidates,
    reviewGate: { ...plan.reviewGate },
    generatesCopy: false,
    sideEffects: "none",
  };
}

export const buildGrowVariantManifest = createGrowVariantManifest;
