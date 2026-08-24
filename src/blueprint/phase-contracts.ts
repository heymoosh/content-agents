/**
 * Read-only target contracts for the four blueprint phases.
 *
 * These definitions describe a predicate and its boundaries. They do not
 * claim that a producer, artifact, or downstream integration exists.
 */

export const BLUEPRINT_PHASES = [
  "coverage/catalog",
  "pool-evidence",
  "growth/delivery",
  "learning/venture",
] as const;

export type BlueprintPhase = (typeof BLUEPRINT_PHASES)[number];

export interface PhaseContract {
  readonly phase: BlueprintPhase;
  readonly name: string;
  readonly owner: string;
  readonly requiredInputs: readonly string[];
  readonly outputs: readonly string[];
  readonly humanGates: readonly string[];
  readonly evidence: readonly string[];
  readonly nonGoals: readonly string[];
  readonly pauseConditions: readonly string[];
  readonly implementationClaim: false;
  readonly implementationNote: string;
}
export interface PhaseContractEvaluation {
  readonly phase: string;
  readonly status: "ready" | "blocked";
  readonly blockers: readonly string[];
}

export type PhaseContractReference = PhaseContract | BlueprintPhase | string;

const IMPLEMENTATION_NOTE = "This is a target contract, not an implementation claim.";

function strings(values: readonly string[]): readonly string[] {
  return Object.freeze([...values]);
}

function contract(
  phase: BlueprintPhase,
  name: string,
  owner: string,
  requiredInputs: readonly string[],
  outputs: readonly string[],
  humanGates: readonly string[],
  evidence: readonly string[],
  nonGoals: readonly string[],
  pauseConditions: readonly string[],
): PhaseContract {
  return Object.freeze({
    phase,
    name,
    owner,
    requiredInputs: strings(requiredInputs),
    outputs: strings(outputs),
    humanGates: strings(humanGates),
    evidence: strings(evidence),
    nonGoals: strings(nonGoals),
    pauseConditions: strings(pauseConditions),
    implementationClaim: false as const,
    implementationNote: IMPLEMENTATION_NOTE,
  });
}

const CONTRACTS: readonly PhaseContract[] = Object.freeze([
  contract(
    "coverage/catalog",
    "Coverage and catalog",
    "coverage/catalog",
    [
      "seeded-material-and-current-account-source-records",
      "stable-platform-local-account-identities",
      "declared-research-pools-and-popularity-rules",
      "current-versus-target-coverage-facts",
    ],
    [
      "reviewable-inventory-and-explicit-mapping-plan",
      "coverage-report-with-caveats",
      "vocabulary-lineage-and-pool-boundary",
    ],
    [
      "muxin-accepts-scope-and-caveats",
    ],
    [
      "inventory",
      "mapping-rows",
      "source-links",
      "coverage-report",
    ],
    [
      "broad-scraping",
      "repo-wide-rewrite",
      "universal-score",
      "auto-publishing",
      "auto-replies",
      "corpus-completeness-claim",
    ],
    [
      "pause-if-account-identity-or-scope-is-missing",
      "pause-if-pool-membership-would-be-inferred",
      "pause-if-coverage-caveats-have-no-disposition",
    ],
  ),
  contract(
    "pool-evidence",
    "Pool evidence",
    "pool evidence",
    [
      "catalog-and-declared-research-question",
      "normalized-source-account-and-evidence-records",
      "explicit-pool-membership-and-selection-rules",
      "denominators-dates-provenance-and-caveats",
      "originality-check-records",
    ],
    [
      "normalized-bounded-evidence-set",
      "reviewable-pattern-summaries-and-selection-rules",
      "source-links-denominators-dates-and-caveats",
    ],
    [
      "muxin-accepts-observation-hypothesis-or-experiment-input",
    ],
    [
      "bounded-evidence-set",
      "pattern-summaries",
      "source-links",
      "selection-rules",
      "review-notes",
    ],
    [
      "inferring-missing-pool-metadata",
      "training-on-exact-creator-text",
      "winner-selection-or-winner-claim",
      "body-or-opener-generation",
      "replacing-human-judgment-with-ranking",
      "generalizing-from-a-single-account-or-small-sample",
    ],
    [
      "pause-if-pool-membership-or-denominator-is-inferred",
      "pause-if-source-citations-or-provenance-are-missing",
      "pause-if-evidence-is-too-thin-to-support-the-declared-question",
    ],
  ),
  contract(
    "growth/delivery",
    "Growth and delivery",
    "Grow variants; review/publish owns approval and delivery",
    [
      "raw-input-with-lineage",
      "selected-platform-set-and-format-treatments",
      "available-evidence-and-pattern-references",
      "configured-review-and-slot-capacity",
      "experiment-question-and-declared-variables",
    ],
    [
      "readable-cut-and-platform-format-variants",
      "review-bundle-and-publish-ready-records",
      "experiment-and-outcome-records",
    ],
    [
      "muxin-review-decision-recorded",
      "muxin-publish-approval-recorded-before-delivery",
    ],
    [
      "cut-and-variant-bundle",
      "review-bundle-and-decision-record",
      "scheduler-and-delivery-record",
      "experiment-record-and-outcome-record-or-explicitly-pending",
    ],
    [
      "silent-platform-selection",
      "publishing-without-muxin-approval",
      "auto-replies",
      "changing-voice-pillars-or-routing-from-metrics-alone",
    ],
    [
      "pause-if-lineage-or-treatment-rationale-is-missing",
      "pause-if-review-decision-is-pending-or-rejected",
      "pause-if-delivery-would-publish-without-muxin-approval",
    ],
  ),
  contract(
    "learning/venture",
    "Learning and Venture",
    "Venture after comments/Signals produces qualified inputs",
    [
      "measured-variant-records",
      "qualified-comment-observations",
      "funnel-events-with-attribution-or-explicit-unknown",
      "business-outcome-records",
    ],
    [
      "caveated-venture-input-with-provenance-scope-and-sample-size",
      "adopt-decline-or-more-evidence-decision-context",
      "venture-handoff-only-after-venture-gate",
    ],
    [
      "muxin-adopts-signal-before-demand-claim",
      "muxin-approves-venture-input",
      "venture-accepts-input-before-phase-transition",
    ],
    [
      "linked-signal-and-decision-record",
      "venture-artifact-or-explicit-request-for-more-evidence",
      "approval-record",
    ],
    [
      "turning-content-engagement-into-proof-of-demand",
      "bypassing-venture-decisions",
      "making-venture-the-owner-of-every-studio-idea",
    ],
    [
      "pause-if-outcome-families-are-collapsed",
      "pause-if-demand-claim-lacks-muxin-adoption",
      "pause-if-venture-gate-is-not-accepted",
    ],
  ),
]);

const CONTRACT_BY_PHASE = new Map<BlueprintPhase, PhaseContract>(
  CONTRACTS.map((phaseContract) => [phaseContract.phase, phaseContract]),
);

/** Return the complete target contract set in blueprint dependency order. */
export function getPhaseContracts(): readonly PhaseContract[] {
  return CONTRACTS;
}

/** Return one named target contract, or null when the phase name is not canonical. */
export function getPhaseContract(phase: string): PhaseContract | null {
  return CONTRACT_BY_PHASE.get(phase as BlueprintPhase) ?? null;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requiredFacts(phaseContract: PhaseContract): readonly string[] {
  return [...new Set([
    ...phaseContract.requiredInputs,
    ...phaseContract.humanGates,
    ...phaseContract.evidence,
  ])].sort(compareStrings);
}

/**
 * Evaluate exact supplied facts against one contract.
 *
 * Facts are intentionally not interpreted, aliased, or inferred. The required
 * input, human-gate, and evidence strings must be supplied exactly. A pause
 * condition supplied as a fact is an explicit block, even if all requirements
 * are otherwise present.
 */
export function evaluatePhaseContract(
  reference: PhaseContractReference,
  facts: readonly string[],
): PhaseContractEvaluation {
  const phaseContract = typeof reference === "object"
    ? reference
    : getPhaseContract(reference);

  if (phaseContract === null) {
    const phase = typeof reference === "string" ? reference : "unknown";
    return {
      phase,
      status: "blocked",
      blockers: [`unknown phase contract: ${phase || "empty"}`],
    };
  }

  const supplied = new Set<string>();
  const blockers = new Set<string>();
  const knownFacts = new Set([...requiredFacts(phaseContract), ...phaseContract.pauseConditions]);

  for (const fact of facts) {
    if (typeof fact !== "string" || fact.trim() === "") {
      blockers.add("empty fact");
      continue;
    }
    const normalized = fact.trim();
    supplied.add(normalized);
    if (!knownFacts.has(normalized)) {
      blockers.add(`unknown fact: ${normalized}`);
    } else if (phaseContract.pauseConditions.includes(normalized)) {
      blockers.add(`pause condition active: ${normalized}`);
    }
  }

  for (const fact of requiredFacts(phaseContract)) {
    if (!supplied.has(fact)) blockers.add(`missing fact: ${fact}`);
  }

  const orderedBlockers = [...blockers].sort(compareStrings);
  return {
    phase: phaseContract.phase,
    status: orderedBlockers.length === 0 ? "ready" : "blocked",
    blockers: orderedBlockers,
  };
}
