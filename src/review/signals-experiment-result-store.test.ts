import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import * as resultStore from "./signals-experiment-result-store.js";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function readyRow() {
  return {
    experimentId: "experiment-one", analysisStatus: "ready", outcomeRefs: ["analytics:one", "provider:one"],
    winner: null, autoWinner: false,
  };
}

test("parses a body-free science result only when it cites measured experiment evidence", () => {
  const parse = (resultStore as any).parseExperimentInterpretationResult;
  const result = parse(JSON.stringify({
    experimentId: "experiment-one", recommendation: "keep", rationale: "The treatment improved the primary metric while the guardrail held.",
    evidenceRefs: ["analytics:one", "provider:one"], confidence: "medium", caveats: ["The sample is still modest."],
  }), readyRow(), "codex");
  assert.deepEqual(result, {
    experimentId: "experiment-one", recommendation: "keep", rationale: "The treatment improved the primary metric while the guardrail held.",
    evidenceRefs: ["analytics:one", "provider:one"], confidence: "medium", caveats: ["The sample is still modest."], engine: "codex",
  });
  assert.equal(JSON.stringify(result).includes("post body"), false);
});

test("rejects an interpretation that invents evidence or runs before readiness", () => {
  const parse = (resultStore as any).parseExperimentInterpretationResult;
  const output = JSON.stringify({
    experimentId: "experiment-one", recommendation: "reject", rationale: "The metric did not improve.",
    evidenceRefs: ["analytics:invented"], confidence: "high", caveats: [],
  });
  assert.throws(() => parse(output, readyRow(), "codex"), /evidence/i);
  assert.throws(() => parse(output, { ...readyRow(), analysisStatus: "collecting" }, "codex"), /not ready/i);
});

test("persists one interpretation and one separate Muxin review without creating a winner", () => {
  const root = mkdtempSync(join(tmpdir(), "signals-result-store-")); roots.push(root);
  const path = join(root, "results.jsonl");
  const proposal = resultStore.recordExperimentInterpretation({
    experimentId: "experiment-one", recommendation: "revise", rationale: "The direction is promising but attribution is incomplete.",
    evidenceRefs: ["analytics:one"], confidence: "low", caveats: ["One arm is noisy."], engine: "codex",
  }, path, "2026-08-31T10:00:00Z");
  assert.equal(proposal.reviewStatus, "pending");
  const retry = resultStore.recordExperimentInterpretation({
    experimentId: "experiment-one", recommendation: "revise", rationale: "The direction is promising but attribution is incomplete.",
    evidenceRefs: ["analytics:one"], confidence: "low", caveats: ["One arm is noisy."], engine: "codex",
  }, path, "2026-08-31T10:05:00Z");
  assert.equal(retry.id, proposal.id);
  assert.equal(retry.createdAt, proposal.createdAt);
  const reviewed = resultStore.reviewExperimentInterpretation("experiment-one", "accepted", "I reviewed the uncertainty.", path, "2026-08-31T11:00:00Z");
  assert.equal(reviewed.reviewStatus, "accepted");
  assert.equal(reviewed.recommendation, "revise");
  assert.equal(reviewed.winner, null);
  assert.equal(reviewed.autoWinner, false);
});
