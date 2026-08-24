import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildModelBoundaryRecord } from "./model-boundary.js";

const base = {
  id: "boundary-1", role: "pattern-adapter" as const, taskKind: "pattern-adaptation" as const,
  modelRoute: "claude-subscription" as const, inputRefs: ["source-1"], outputRefs: ["variant-1"], evidenceRefs: ["pattern-1"],
  humanGate: "required" as const, humanDecision: "pending" as const, sideEffects: "none" as const,
  originalSubstanceRef: "source-1", commonHookTemplate: true, creatorBodyCopy: false,
};

describe("model boundary", () => {
  test("records a subscription-first, human-gated common-hook adaptation", () => {
    const result = buildModelBoundaryRecord(base);
    assert.equal(result.readiness.status, "ready");
    assert.equal(result.costClass, "subscription");
    assert.equal(result.boundaries.commonHookMadLibAllowed, true);
    assert.equal(result.boundaries.creatorBodyCopyAllowed, false);
    assert.equal(result.sideEffects, "none");
  });

  test("rejects unknown roles and missing audit refs", () => {
    assert.throws(() => buildModelBoundaryRecord({ ...base, role: "mystery" }), /role/);
    assert.throws(() => buildModelBoundaryRecord({ ...base, outputRefs: [] }), /outputRefs/);
  });

  test("keeps extraction-only separate from generation and requires a human gate", () => {
    const extraction = buildModelBoundaryRecord({ ...base, role: "extractor", taskKind: "extraction", outputRefs: ["analysis-1"], commonHookTemplate: false, originalSubstanceRef: null });
    assert.equal(extraction.boundaries.composesBody, false);
    assert.equal(extraction.readiness.status, "ready");
    const ungated = buildModelBoundaryRecord({ ...base, humanGate: "not-required" as never });
    assert.equal(ungated.readiness.status, "blocked");
    assert.ok(ungated.readiness.blockers.includes("content work requires a human gate"));
  });
});
