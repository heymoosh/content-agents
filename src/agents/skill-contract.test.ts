import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateSkillContract,
  getSkillContracts,
  type SkillContract,
} from "./skill-contract.js";

const expectedStages = [
  "capture/develop",
  "patterns",
  "format-for-platforms",
  "human-review",
  "publish",
  "learning",
  "Venture",
] as const;

function completeFacts(contract: SkillContract): Record<string, unknown> {
  return Object.fromEntries(contract.inputFacts.map((fact) => [fact, `${fact}-supplied`])) as Record<string, unknown>;
}

describe("skill contracts", () => {
  test("defines every bounded stage with complete fields", () => {
    const contracts = getSkillContracts();

    assert.deepEqual(contracts.map((contract) => contract.name), expectedStages);
    for (const contract of contracts) {
      assert.ok(contract.inputFacts.length > 0);
      assert.ok(contract.outputFact);
      assert.ok(contract.owner);
      assert.ok(contract.invocationBoundary);
      assert.ok(["required", "not-required"].includes(contract.humanGate));
      assert.ok(contract.prohibitedHiddenSideEffects.length > 0);
      assert.ok(contract.prohibitedDownstreamClaims.length > 0);
      assert.equal(contract.contentReuse.commonHookReuse, "template-madlib-compatible");
      assert.equal(contract.contentReuse.creatorBodyCopyReuse, "forbidden");
    }
  });

  test("returns a stable frozen manifest and deterministic evaluations", () => {
    const first = getSkillContracts();
    const second = getSkillContracts();

    assert.deepEqual(first, second);
    assert.equal(Object.isFrozen(first), true);
    assert.equal(Object.isFrozen(first[0]), true);

    const contract = first[2];
    const forward = completeFacts(contract);
    const reverse = Object.fromEntries(Object.entries(forward).reverse());
    assert.deepEqual(
      evaluateSkillContract(contract, forward),
      evaluateSkillContract(contract.name, reverse),
    );
  });

  test("reports exact missing and unknown facts without inference", () => {
    const contract = getSkillContracts().find((candidate) => candidate.name === "format-for-platforms");
    assert.ok(contract);

    const evaluation = evaluateSkillContract(contract, {
      developed_source: "essay-1",
      pattern_treatments: null,
      extra_fact: "not part of this boundary",
    });

    assert.deepEqual(evaluation, {
      contract: "format-for-platforms",
      status: "blocked",
      missingFacts: ["experiment_policy", "format_options", "target_platforms"],
      unknownFacts: ["extra_fact", "pattern_treatments"],
    });
  });

  test("marks a complete format-for-platforms invocation ready", () => {
    const contract = getSkillContracts().find((candidate) => candidate.name === "format-for-platforms");
    assert.ok(contract);

    assert.deepEqual(evaluateSkillContract(contract, completeFacts(contract)), {
      contract: "format-for-platforms",
      status: "ready",
      missingFacts: [],
      unknownFacts: [],
    });
  });

  test("makes the body-copy, hidden-side-effect, and demand boundaries explicit", () => {
    const contracts = getSkillContracts();
    for (const contract of contracts) {
      assert.ok(contract.prohibitedHiddenSideEffects.includes("hidden filesystem/network writes"));
      assert.ok(contract.prohibitedHiddenSideEffects.includes("hidden skill or model invocation"));
      assert.ok(contract.prohibitedDownstreamClaims.includes("creator body-copy reuse"));
    }

    const patterns = contracts.find((contract) => contract.name === "patterns");
    const publish = contracts.find((contract) => contract.name === "publish");
    const learning = contracts.find((contract) => contract.name === "learning");
    const venture = contracts.find((contract) => contract.name === "Venture");
    assert.ok(patterns && publish && learning && venture);

    assert.match(patterns.invocationBoundary, /template-madlib/i);
    assert.equal(publish.humanGate, "required");
    assert.ok(learning.inputFacts.includes("comments"));
    assert.ok(learning.inputFacts.includes("outcomes"));
    assert.equal(venture.humanGate, "required");
    assert.match(venture.invocationBoundary, /separate Venture boundary/i);
    assert.ok(venture.prohibitedDownstreamClaims.includes("demand claim without explicit Muxin adoption"));
  });
});
