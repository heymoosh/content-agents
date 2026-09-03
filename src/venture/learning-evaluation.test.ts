import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { recordLearningEvaluation, recordLearningEvaluationDecision, readLearningEvaluations, type LearningEvaluationInput } from "./learning-evaluation.js";

function evaluation(overrides: Partial<LearningEvaluationInput> = {}): LearningEvaluationInput {
  return { evaluationId: "eval-1", ventureSlug: "venture-1", inputRef: "signals-input-1", evidenceTier: "survey", claimCeiling: "stated-need", recommendation: "test", target: "experiment", rationale: "Test the stated need.", proposedChange: "Run a bounded follow-up test.", evidenceRefs: ["evidence-1"], affectedRefs: ["decision-1"], caveats: ["not demand proof"], engine: "codex", ...overrides };
}

test("learning evaluations preserve tier ceiling, require the matching target, and emit a downstream proposal only after Muxin accepts", () => {
  const root = mkdtempSync(join(tmpdir(), "learning-eval-")); const path = join(root, "evaluations.jsonl");
  try {
    const pending = recordLearningEvaluation(evaluation(), path, "2026-09-01T00:00:00Z");
    assert.equal(pending.status, "pending"); assert.equal(pending.downstreamProposal, null);
    const accepted = recordLearningEvaluationDecision("venture-1", "eval-1", "accept", "Muxin accepts the next test.", path, "2026-09-01T01:00:00Z");
    assert.equal(accepted.downstreamProposal?.target, "experiment"); assert.equal(accepted.downstreamProposal?.claimCeiling, "stated-need");
    assert.deepEqual(accepted.downstreamProposal?.evidenceRefs, ["evidence-1"]);
    assert.throws(() => recordLearningEvaluation(evaluation({ evaluationId: "bad", recommendation: "no-change", target: "offer" }), path), /no-change requires/);
    assert.throws(() => recordLearningEvaluation(evaluation({ evaluationId: "bad-2", recommendation: "change", target: "experiment" }), path), /change requires/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("learning evaluation retries are idempotent and tampering fails closed", () => {
  const root = mkdtempSync(join(tmpdir(), "learning-eval-tamper-")); const path = join(root, "evaluations.jsonl");
  try {
    const first = recordLearningEvaluation(evaluation(), path); const retry = recordLearningEvaluation(evaluation(), path); assert.deepEqual(retry, first);
    recordLearningEvaluationDecision("venture-1", "eval-1", "decline", "Do not use this yet.", path);
    assert.deepEqual(recordLearningEvaluationDecision("venture-1", "eval-1", "decline", "Do not use this yet.", path), readLearningEvaluations("venture-1", path)[0]);
    assert.throws(() => recordLearningEvaluationDecision("venture-1", "eval-1", "accept", "changed", path), /differently/i);
    assert.equal(readLearningEvaluations("venture-1", path)[0]!.status, "declined");
    const event = JSON.parse(readFileSync(path, "utf8").split("\n")[0]!); event.evaluation.proposedChange = "tampered"; writeFileSync(path, `${JSON.stringify(event)}\n`);
    assert.throws(() => readLearningEvaluations("venture-1", path), /digest|invalid/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
