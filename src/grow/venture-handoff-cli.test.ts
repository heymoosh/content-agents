import assert from "node:assert/strict";
import test from "node:test";
import { main, parseVentureHandoffArgs, renderVentureHandoffMarkdown } from "./venture-handoff-cli.js";
import type { VentureHandoffView } from "./venture-handoff.js";

const view = {
  kind: "grow_venture_handoff_view", version: "grow-venture-handoff-v1", blueprintId: "blueprint-1",
  lineage: { sourceId: "source-1", variantId: "variant-1", experimentId: "experiment-1" },
  families: { comment: [], funnel: [], business: [] }, qualifiedHypotheses: [], proposalId: null, selectedProposal: null,
  muxinDecision: "pending", ventureGate: "blocked", readiness: { status: "blocked", blockers: ["proposal is missing"] },
  autoClaimsDemand: false, ventureArtifacts: false, sideEffects: "none",
} as const satisfies VentureHandoffView;

test("renders a body-free handoff summary", () => {
  const markdown = renderVentureHandoffMarkdown(view);
  assert.match(markdown, /Venture handoff/);
  assert.match(markdown, /proposal is missing/);
  assert.doesNotMatch(markdown, /comment body|creator body|publish call|publish API/i);
});

test("parses file and both-format options", () => {
  assert.deepEqual(parseVentureHandoffArgs(["--input", "handoff.json", "--format", "both"]), {
    source: { kind: "file", path: "handoff.json" }, format: "both",
  });
});

test("fails closed on malformed envelope and partial explicit bundle selection", () => {
  let error = "";
  assert.equal(main(["--json", "{}"], { error: (value) => { error = value; } }), 1);
  assert.match(error, /packet must be an object/);
  const partial = JSON.stringify({ packet: {}, learningView: { kind: "grow_comment_learning_view" }, learningBundle: {} });
  assert.equal(main(["--json", partial], { error: (value) => { error = value; } }), 1);
  assert.match(error, /learningBundle and proposalId must be supplied together/);
  assert.throws(() => parseVentureHandoffArgs(["--json", "{}", "--input", "x"]), /exactly one/);
});
