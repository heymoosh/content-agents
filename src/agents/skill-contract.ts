/**
 * Read-only contracts for the content studio's lightweight skill boundary.
 *
 * This manifest describes invocation requirements and limits. It does not
 * invoke a skill or model, inspect a fact's meaning, or perform any I/O.
 */

export const SKILL_CONTRACT_VERSION = "skill-contract-v1" as const;

export const SKILL_CONTRACT_NAMES = [
  "capture/develop",
  "patterns",
  "format-for-platforms",
  "human-review",
  "publish",
  "learning",
  "Venture",
] as const;

export type SkillContractName = (typeof SKILL_CONTRACT_NAMES)[number];
export type SkillHumanGate = "required" | "not-required";

export interface SkillContract {
  readonly kind: "skill_contract";
  readonly version: typeof SKILL_CONTRACT_VERSION;
  readonly name: SkillContractName;
  readonly inputFacts: readonly string[];
  readonly outputFact: string;
  readonly owner: string;
  readonly invocationBoundary: string;
  readonly humanGate: SkillHumanGate;
  readonly prohibitedHiddenSideEffects: readonly string[];
  readonly prohibitedDownstreamClaims: readonly string[];
  readonly contentReuse: {
    readonly commonHookReuse: "template-madlib-compatible";
    readonly creatorBodyCopyReuse: "forbidden";
  };
}

export type SkillContractReference = SkillContract | SkillContractName | string;
export type SuppliedSkillFacts = Readonly<Record<string, unknown>>;

export interface SkillContractEvaluation {
  readonly contract: string;
  readonly status: "ready" | "blocked";
  readonly missingFacts: readonly string[];
  readonly unknownFacts: readonly string[];
}

const HIDDEN_SIDE_EFFECTS = [
  "hidden filesystem/network writes",
  "hidden skill or model invocation",
  "publishing or scheduling outside the explicit boundary",
] as const;

const BODY_AND_CLAIM_BOUNDARIES = [
  "creator body-copy reuse",
  "claiming virality, demand, or causality from an unmeasured result",
] as const;

const COMMON_REUSE = Object.freeze({
  commonHookReuse: "template-madlib-compatible" as const,
  creatorBodyCopyReuse: "forbidden" as const,
});

function frozenStrings(values: readonly string[]): readonly string[] {
  return Object.freeze([...values]);
}

function contract(
  name: SkillContractName,
  inputFacts: readonly string[],
  outputFact: string,
  owner: string,
  invocationBoundary: string,
  humanGate: SkillHumanGate,
  prohibitedDownstreamClaims: readonly string[] = BODY_AND_CLAIM_BOUNDARIES,
): SkillContract {
  return Object.freeze({
    kind: "skill_contract" as const,
    version: SKILL_CONTRACT_VERSION,
    name,
    inputFacts: frozenStrings(inputFacts),
    outputFact,
    owner,
    invocationBoundary,
    humanGate,
    prohibitedHiddenSideEffects: frozenStrings(HIDDEN_SIDE_EFFECTS),
    prohibitedDownstreamClaims: frozenStrings(prohibitedDownstreamClaims),
    contentReuse: COMMON_REUSE,
  });
}

const CONTRACTS: readonly SkillContract[] = Object.freeze([
  contract(
    "capture/develop",
    ["raw_thought_or_essay"],
    "developed_source",
    "Muxin and the content studio",
    "An explicit raw thought or essay submission becomes a traceable source brief; no source is invented.",
    "not-required",
  ),
  contract(
    "patterns",
    ["developed_source", "pattern_evidence", "platform_best_practices"],
    "pattern_treatments",
    "Patterns research",
    "Read declared corpus evidence and platform observations to produce reusable structures and template-madlib hook treatments; never ingest creator body copy.",
    "not-required",
  ),
  contract(
    "format-for-platforms",
    ["developed_source", "pattern_treatments", "target_platforms", "format_options", "experiment_policy"],
    "platform_format_experiments",
    "The content studio",
    "Fan out an explicit source across selected platforms, media formats, and declared experiment combinations; planning only.",
    "not-required",
  ),
  contract(
    "human-review",
    ["platform_format_experiments", "source_lineage", "original_voice_reference"],
    "reviewed_variants",
    "Muxin",
    "Present generated treatments in the review queue; this boundary cannot invoke publishing or scheduling.",
    "required",
  ),
  contract(
    "publish",
    ["reviewed_variants", "publish_destination", "publish_approval"],
    "published_content",
    "The platform publisher after Muxin approval",
    "An explicit approved variant, destination, and schedule enter the platform adapter; approval cannot be inferred from draft state.",
    "required",
  ),
  contract(
    "learning",
    ["published_content", "comments", "outcomes"],
    "learning_signals",
    "The learning loop",
    "Read captured comments and measured outcomes from published content to produce caveated learning signals; observation only.",
    "not-required",
  ),
  contract(
    "Venture",
    ["learning_signals", "demand_hypothesis", "muxin_venture_decision"],
    "venture_handoff",
    "Venture with a separate Muxin gate",
    "A learning packet may cross into Venture only through an explicit Venture decision at a separate Venture boundary; this boundary does not declare demand or advance a Venture phase.",
    "required",
    [
      ...BODY_AND_CLAIM_BOUNDARIES,
      "demand claim without explicit Muxin adoption",
      "Venture phase transition without Venture acceptance",
    ],
  ),
]);

const CONTRACT_BY_NAME = new Map<SkillContractName, SkillContract>(
  CONTRACTS.map((skillContract) => [skillContract.name, skillContract]),
);

/** Return the manifest in dependency order. No callers can mutate its shape. */
export function getSkillContracts(): readonly SkillContract[] {
  return CONTRACTS;
}

function resolvedContract(reference: SkillContractReference): SkillContract | null {
  if (typeof reference === "object" && reference !== null) return reference;
  return CONTRACT_BY_NAME.get(reference as SkillContractName) ?? null;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isKnownValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  return typeof value !== "string" || value.trim() !== "";
}

/**
 * Evaluate exact fact keys against one contract.
 *
 * Missing means the required key is absent. Unknown means a required key has
 * a null/undefined/blank value, or a supplied key is outside this contract.
 * Values are deliberately not coerced or interpreted.
 */
export function evaluateSkillContract(
  reference: SkillContractReference,
  suppliedFacts: SuppliedSkillFacts,
): SkillContractEvaluation {
  const skillContract = resolvedContract(reference);
  if (skillContract === null) {
    const name = typeof reference === "string" ? reference : "unknown";
    return { contract: name, status: "blocked", missingFacts: [], unknownFacts: [] };
  }

  const required = new Set(skillContract.inputFacts);
  const missingFacts = skillContract.inputFacts
    .filter((fact) => !Object.hasOwn(suppliedFacts, fact))
    .sort(compareStrings);
  const unknownFacts = Object.keys(suppliedFacts)
    .filter((fact) => !required.has(fact) || !isKnownValue(suppliedFacts[fact]))
    .sort(compareStrings);

  return {
    contract: skillContract.name,
    status: missingFacts.length === 0 && unknownFacts.length === 0 ? "ready" : "blocked",
    missingFacts,
    unknownFacts,
  };
}
