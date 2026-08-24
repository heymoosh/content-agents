import assert from "node:assert/strict";
import test from "node:test";
import { main, parseLearningBundleArgs } from "./learning-bundle-cli.js";

const envelope = JSON.stringify({ lineage: { sourceId: "source-1", variantId: "variant-1", experimentId: "experiment-1" }, learningView: {
  kind: "grow_comment_learning_view", version: "grow-comment-learning-v1", hypotheses: [], muxinDecision: "pending",
  readiness: { status: "ready", blockers: [] }, autoClaimsDemand: false, ventureArtifacts: false, sideEffects: "none",
}, feedEvidence: [], proposals: [] });

test("renders an explicit empty learning bundle", () => {
  let output = "";
  assert.equal(main(["--json", envelope, "--format", "markdown"], { write: (value) => { output = value; } }), 0);
  assert.match(output, /Learning bundle/);
  assert.match(output, /Proposals: 0/);
});

test("parses file and both-format options", () => {
  assert.deepEqual(parseLearningBundleArgs(["--input", "bundle.json", "--format", "both"]), { source: { kind: "file", path: "bundle.json" }, format: "both" });
});

test("fails closed on malformed or incomplete envelopes", () => {
  let error = "";
  assert.equal(main(["--json", "{}"], { error: (value) => { error = value; } }), 1);
  assert.match(error, /grow:learning-bundle/);
  assert.match(error, /lineage must be an object/);
  assert.throws(() => parseLearningBundleArgs(["--json", "{}", "--input", "x"]), /exactly one/);
});

test("rejects malformed nested learning views and proposals before the builder runs", () => {
  const base = JSON.parse(envelope) as Record<string, unknown>;
  let error = "";
  const malformedView = { ...base, learningView: { ...(base.learningView as object), hypotheses: "not-an-array" } };
  assert.equal(main(["--json", JSON.stringify(malformedView)], { error: (value) => { error = value; } }), 1);
  assert.match(error, /learningView\.hypotheses must be an array/);

  const malformedProposal = { ...base, proposals: [{ id: "p" }] };
  assert.equal(main(["--json", JSON.stringify(malformedProposal)], { error: (value) => { error = value; } }), 1);
  assert.match(error, /proposals\[0\]\.statement must be a non-empty string/);
});
