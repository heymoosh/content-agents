import type { PatternCatalog } from "./catalog.js";
import { buildComparisonReadiness, type ComparisonReadinessInventory } from "./comparison-readiness.js";
import { buildOperatorReadiness, type OperatorReadiness } from "./operator-readiness.js";
import { buildPoolEvidenceInventory, type PoolEvidenceInventory } from "./pool-evidence.js";
import { buildSourceEvidence, type SourceEvidenceInventory } from "./source-evidence.js";
import type { ReviewMetadataInput } from "./review-metadata.js";

/** The versioned, body-free handoff for inspecting pattern evidence readiness. */
export const EVIDENCE_READINESS_VERSION = "evidence-readiness-v1" as const;

export interface EvidenceReadinessInput {
  /** The normalized catalog rollup; it is never used to fill source/post pool membership. */
  readonly catalog: PatternCatalog;
  /** Raw corpus records passed to the existing source-evidence adapter. */
  readonly corpus: readonly unknown[];
  /** Raw analysis records passed to the existing source-evidence adapter. */
  readonly analyses: readonly unknown[];
  /** Explicit account review rows. An empty array intentionally leaves readiness blocked. */
  readonly reviews: readonly ReviewMetadataInput[];
}

export interface EvidenceReadinessArtifact {
  readonly kind: "pattern_evidence_readiness";
  readonly version: typeof EVIDENCE_READINESS_VERSION;
  readonly poolEvidence: PoolEvidenceInventory;
  readonly sourceEvidence: SourceEvidenceInventory;
  readonly comparisonReadiness: ComparisonReadinessInventory;
  readonly operatorReadiness: OperatorReadiness;
  readonly sideEffects: "none";
}

/**
 * Compose the existing pure pattern adapters into one deterministic, read-only artifact.
 *
 * Catalog pool labels and source/post pool memberships intentionally travel through separate
 * adapters. A catalog row can show its explicit account-level pool while source evidence remains
 * null when the corpus/analysis records do not carry an explicit membership.
 */
export function buildEvidenceReadiness(input: EvidenceReadinessInput): EvidenceReadinessArtifact {
  const poolEvidence = buildPoolEvidenceInventory(input.catalog);
  const sourceEvidence = buildSourceEvidence([...input.corpus], [...input.analyses]);
  const comparisonReadiness = buildComparisonReadiness({
    reviews: [...input.reviews],
    evidence: sourceEvidence.rows,
  });
  const operatorReadiness = buildOperatorReadiness(comparisonReadiness);

  return {
    kind: "pattern_evidence_readiness",
    version: EVIDENCE_READINESS_VERSION,
    poolEvidence,
    sourceEvidence,
    comparisonReadiness,
    operatorReadiness,
    sideEffects: "none",
  };
}

export const createEvidenceReadiness = buildEvidenceReadiness;
