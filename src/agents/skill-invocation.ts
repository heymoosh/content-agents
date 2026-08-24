import {
  evaluateSkillContract,
  getSkillContracts,
  type SkillContract,
  type SkillContractEvaluation,
  type SkillContractReference,
  type SkillHumanGate,
  type SuppliedSkillFacts,
} from "./skill-contract.js";

/** Pure, model-free audit envelope for one explicit skill-boundary check. */
export const SKILL_INVOCATION_VERSION = "skill-invocation-v1" as const;

export interface SkillInvocationInput {
  readonly invocationId: string;
  readonly contract: SkillContractReference;
  readonly suppliedFacts: SuppliedSkillFacts;
}

export interface SkillInvocationEnvelope {
  readonly kind: "skill_invocation";
  readonly version: typeof SKILL_INVOCATION_VERSION;
  readonly invocationId: string;
  readonly contract: string;
  readonly suppliedFactKeys: readonly string[];
  readonly evaluation: SkillContractEvaluation;
  readonly outputFact: string | null;
  readonly owner: string | null;
  readonly humanGate: SkillHumanGate | null;
  readonly contentReuse: SkillContract["contentReuse"];
  readonly sideEffects: "none";
}

const SAFE_CONTENT_REUSE = Object.freeze({
  commonHookReuse: "template-madlib-compatible" as const,
  creatorBodyCopyReuse: "forbidden" as const,
});

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} is required`);
  return value.trim();
}

function suppliedFacts(value: unknown): SuppliedSkillFacts {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("suppliedFacts must be an object");
  }
  return value as SuppliedSkillFacts;
}

function contractName(reference: SkillContractReference): string {
  if (typeof reference === "string") return reference;
  if (reference !== null && typeof reference === "object" && typeof reference.name === "string") {
    return reference.name;
  }
  return "unknown";
}

function manifestContract(reference: SkillContractReference): SkillContract | null {
  const name = contractName(reference);
  return getSkillContracts().find((candidate) => candidate.name === name) ?? null;
}

/**
 * Build an auditable readiness artifact from caller-supplied facts.
 *
 * This function reads fact values only through the existing contract evaluator
 * to distinguish absent from blank/unknown facts. It retains only fact keys in
 * the returned artifact and performs no skill, model, publish, or filesystem
 * operation.
 */
export function buildSkillInvocationEnvelope(input: SkillInvocationInput): SkillInvocationEnvelope {
  if (input === null || typeof input !== "object") throw new Error("skill invocation input must be an object");

  const invocationId = requiredText(input.invocationId, "invocationId");
  const facts = suppliedFacts(input.suppliedFacts);
  const name = contractName(input.contract);
  const skillContract = manifestContract(input.contract);
  const evaluation = evaluateSkillContract(skillContract ?? name, facts);
  const contentReuse = skillContract?.contentReuse ?? SAFE_CONTENT_REUSE;

  return Object.freeze({
    kind: "skill_invocation" as const,
    version: SKILL_INVOCATION_VERSION,
    invocationId,
    contract: name,
    suppliedFactKeys: Object.freeze(Object.keys(facts).sort(compareStrings)),
    evaluation: Object.freeze({
      contract: evaluation.contract,
      status: evaluation.status,
      missingFacts: Object.freeze([...evaluation.missingFacts]),
      unknownFacts: Object.freeze([...evaluation.unknownFacts]),
    }),
    outputFact: skillContract?.outputFact ?? null,
    owner: skillContract?.owner ?? null,
    humanGate: skillContract?.humanGate ?? null,
    contentReuse,
    sideEffects: "none" as const,
  });
}

export const createSkillInvocationEnvelope = buildSkillInvocationEnvelope;
