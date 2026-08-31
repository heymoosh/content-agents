import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runGrowExperimentSliceCli, type GrowExperimentSliceCliIo } from "./experiment-slice-cli.js";
import { buildGrowExperimentProposal, renderGrowExperimentProposalHtml } from "./experiment-slice.js";
import { configuredEditorEvidence, signalsExperimentRecommendation } from "./experiment-test-fixtures.js";
import { parseSignalsExperimentScienceResult } from "../review/signals-experiment-recommendation.js";

function proposalInput(): Record<string, unknown> {
  return {
    id: "one", createdAt: "2026-08-31T12:00:00Z",
    source: { id: "source-1", kind: "raw-thought", body: "A complete original thought.", originRef: "inline:source-1" },
    recommendation: signalsExperimentRecommendation({ variantId: "variant-1", minimumSample: 10 }),
    selectedPlatforms: ["x"],
    cut: { id: "cut-1", body: "A complete original thought.", sourceRefs: ["source-1#body"], rationale: "Already concise.", decision: { status: "approved", decidedBy: "muxin", decidedAt: "2026-08-31T11:00:00Z" } },
    variants: [{ id: "variant-1", platform: "x", medium: "text", format: "post", body: "A complete original thought.", sourceRefs: ["source-1#body"], treatment: { ref: "control", rationale: "Preserve the thought.", evidenceStatus: "supported", evidenceRefs: ["source-1#body"] }, experimentVariables: { hook: "control" }, voiceCheck: "passed", originalityCheck: "passed", generation: configuredEditorEvidence("A complete original thought.") }],
    capacity: { day: "2026-09-01", review: [{ platform: "x", available: 1 }], slots: [{ platform: "x", available: 1 }] },
    experiment: { id: "experiment-1", question: "What happens?", outcomeFamilies: ["attention"], minimumSample: 10, topic: "one thought", audience: "mixed-feed readers" },
  };
}

function memory(files: Record<string, string>) {
  let stdout = ""; let stderr = "";
  const writes: Record<string, string> = {};
  const io: GrowExperimentSliceCliIo = {
    read: async (path) => { if (!(path in files)) throw new Error("missing"); return files[path]!; },
    write: async (path, body) => { writes[path] = body; },
    output: (body) => { stdout += body; },
    error: (body) => { stderr += body; },
  };
  return { io, writes, stdout: () => stdout, stderr: () => stderr };
}

test("Phase 3 CLI writes JSON and a static review HTML from the same digest-bound proposal", async () => {
  const first = memory({ "input.json": JSON.stringify(proposalInput()) });
  assert.equal(await runGrowExperimentSliceCli(["propose", "--input", "input.json", "--output", "proposal.json"], first.io), 0);
  const proposal = JSON.parse(first.writes["proposal.json"]!);
  assert.match(proposal.digest, /^sha256:/);

  const second = memory({ "input.json": JSON.stringify(proposalInput()) });
  assert.equal(await runGrowExperimentSliceCli(["propose", "--input", "input.json", "--html", "--output", "review.html"], second.io), 0);
  assert.match(second.writes["review.html"]!, /Signals-recommended content experiment/);
  assert.match(second.writes["review.html"]!, new RegExp(proposal.digest));
});

test("the static review HTML exports a complete digest-bound decision without pre-approving anything", () => {
  const proposal = buildGrowExperimentProposal(proposalInput() as never);
  const rendered = renderGrowExperimentProposalHtml(proposal);
  assert.match(rendered, /data-variant-id="variant-1"/);
  assert.match(rendered, /value="approved"/);
  assert.match(rendered, /value="edited"/);
  assert.match(rendered, /value="needs-another-pass"/);
  assert.doesNotMatch(rendered, /type="radio"[^>]*\schecked(?:\s|>)/);
  assert.doesNotMatch(rendered, /type="radio" disabled/);
  assert.match(rendered, /content-studio-phase3-experiment-decision\.json/);
  assert.match(rendered, /Why run this experiment/);
  assert.match(rendered, /Hypothesis/);
  assert.match(rendered, /Cold-feed editor passed/);
  assert.match(rendered, /proposalDigest/);
  assert.match(rendered, new RegExp(proposal.digest));
  assert.match(rendered, /A decision is required for every candidate/);
});

test("Phase 3 CLI records a complete Muxin decision and rejects partial input", async () => {
  const proposed = memory({ "input.json": JSON.stringify(proposalInput()) });
  await runGrowExperimentSliceCli(["propose", "--input", "input.json", "--output", "proposal.json"], proposed.io);
  const proposal = JSON.parse(proposed.writes["proposal.json"]!);
  const decision = { proposalDigest: proposal.digest, decidedBy: "muxin", decidedAt: "2026-08-31T13:00:00Z", decisions: [{ variantId: "variant-1", status: "approved", note: null }] };
  const decided = memory({ "proposal.json": JSON.stringify(proposal), "decision.json": JSON.stringify(decision) });
  assert.equal(await runGrowExperimentSliceCli(["decide", "--input", "proposal.json", "--decision", "decision.json"], decided.io), 0);
  assert.equal(JSON.parse(decided.stdout()).approvedRecords.length, 1);

  const partial = memory({ "proposal.json": JSON.stringify(proposal), "decision.json": JSON.stringify({ ...decision, decisions: [] }) });
  assert.equal(await runGrowExperimentSliceCli(["decide", "--input", "proposal.json", "--decision", "decision.json"], partial.io), 1);
  assert.match(partial.stderr(), /every variant/i);
});

test("the retained Phase 3 JSON and HTML are the same current digest-bound packet", () => {
  const root = process.cwd();
  const input = JSON.parse(readFileSync(resolve(root, "docs/reviews/content-studio-phase3-experiment-input.json"), "utf8"));
  const retained = JSON.parse(readFileSync(resolve(root, "docs/reviews/content-studio-phase3-experiment-proposal.json"), "utf8"));
  const html = readFileSync(resolve(root, "docs/reviews/content-studio-phase3-experiment-review.html"), "utf8");
  const scienceInput = JSON.parse(readFileSync(resolve(root, "docs/reviews/content-studio-phase3-experiment-science-input.json"), "utf8"));
  const scienceResponse = readFileSync(resolve(root, "docs/reviews/content-studio-phase3-experiment-science-response.json"), "utf8").trim();
  const fresh = buildGrowExperimentProposal(input);
  const science = parseSignalsExperimentScienceResult(scienceResponse, scienceInput, "codex");
  assert.equal(science.status, "recommended");
  if (science.status === "recommended") assert.deepEqual(input.recommendation, science.recommendation);
  assert.deepEqual(retained, fresh);
  assert.match(html, new RegExp(fresh.digest));
  assert.equal(fresh.capacityManifest.version, "grow-capacity-manifest-v1");
  assert.equal(fresh.experimentRecord.version, "grow-experiment-v1");
  assert.ok(fresh.reviewBundles.every((bundle) => bundle.version === "grow-review-bundle-v1"));
});
