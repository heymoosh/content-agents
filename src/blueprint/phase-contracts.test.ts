import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluatePhaseContract,
  getPhaseContracts,
  type PhaseContract,
} from "./phase-contracts.js";

const expectedPhases = [
  "coverage/catalog",
  "pool-evidence",
  "growth/delivery",
  "learning/venture",
] as const;

function completeFacts(contract: PhaseContract): string[] {
  return [...contract.requiredInputs, ...contract.humanGates, ...contract.evidence];
}

test("phase contracts are complete and preserve the human transition boundaries", () => {
  const contracts = getPhaseContracts();

  assert.deepEqual(contracts.map((contract) => contract.phase), expectedPhases);
  for (const contract of contracts) {
    assert.ok(contract.name);
    assert.ok(contract.owner);
    assert.ok(contract.requiredInputs.length > 0);
    assert.ok(contract.outputs.length > 0);
    assert.ok(contract.humanGates.length > 0);
    assert.ok(contract.evidence.length > 0);
    assert.ok(contract.nonGoals.length > 0);
    assert.ok(contract.pauseConditions.length > 0);
    assert.equal(contract.implementationClaim, false);
    assert.match(contract.implementationNote, /not an implementation claim/i);
  }

  const growth = contracts[2];
  assert.ok(growth.humanGates.some((gate) => /publish/i.test(gate)));
  const learning = contracts[3];
  assert.ok(learning.humanGates.some((gate) => /demand/i.test(gate)));
  assert.ok(learning.humanGates.some((gate) => /venture/i.test(gate)));
});
test("the complete contract set and evaluations are deterministically ordered", () => {
  const first = getPhaseContracts();
  const second = getPhaseContracts();

  assert.deepEqual(first, second);
  assert.deepEqual(first.map((contract) => contract.phase), [...expectedPhases].sort((left, right) => {
    return expectedPhases.indexOf(left) - expectedPhases.indexOf(right);
  }));

  const contract = first[0];
  const shuffledFacts = [...completeFacts(contract)].reverse();
  assert.deepEqual(
    evaluatePhaseContract(contract, shuffledFacts),
    evaluatePhaseContract(contract, completeFacts(contract)),
  );
});

test("missing, empty, and unknown facts block without inference", () => {
  const contract = getPhaseContracts()[0];

  const missing = evaluatePhaseContract(contract, []);
  assert.equal(missing.status, "blocked");
  assert.ok(missing.blockers.some((blocker) => blocker.startsWith("missing fact:")));

  const invalid = evaluatePhaseContract(contract, ["", "invented-fact"]);
  assert.equal(invalid.status, "blocked");
  assert.ok(invalid.blockers.includes("empty fact"));
  assert.ok(invalid.blockers.includes("unknown fact: invented-fact"));
});

test("a fully supplied growth contract is ready", () => {
  const contract = getPhaseContracts().find((candidate) => candidate.phase === "growth/delivery");
  assert.ok(contract);

  const evaluation = evaluatePhaseContract(contract, completeFacts(contract));

  assert.deepEqual(evaluation, {
    phase: "growth/delivery",
    status: "ready",
    blockers: [],
  });
});
