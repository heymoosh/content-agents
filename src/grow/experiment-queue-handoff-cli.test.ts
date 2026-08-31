import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGrowExperimentProposal, type GrowExperimentProposalInput } from "./experiment-slice.js";
import { buildGrowExperimentQueueHandoff } from "./experiment-queue-handoff.js";
import { runGrowExperimentQueueHandoffCli, type GrowExperimentQueueHandoffCliIo } from "./experiment-queue-handoff-cli.js";
import { configuredEditorEvidence, signalsExperimentRecommendation } from "./experiment-test-fixtures.js";

function proposal() {
  const input: GrowExperimentProposalInput = {
    id: "cli-handoff", createdAt: "2026-08-30T12:00:00Z",
    source: { id: "source-cli", kind: "raw-thought", body: "A complete thought.", originRef: "fixture:cli" },
    recommendation: signalsExperimentRecommendation({ variantId: "linkedin-cli", families: ["attention"], minimumSample: 5 }),
    selectedPlatforms: ["linkedin"],
    cut: { id: "cut-cli", body: "A complete thought.", sourceRefs: ["source-cli#body"], rationale: "Complete.", decision: { status: "approved", decidedBy: "muxin", decidedAt: "2026-08-30T11:00:00Z" } },
    variants: [{ id: "linkedin-cli", platform: "linkedin", medium: "text", format: "post", body: "A complete thought, made legible for a busy reader.", sourceRefs: ["source-cli#body"], treatment: { ref: "treatment:direct", rationale: "Direct context.", evidenceStatus: "hypothesis", evidenceRefs: ["evidence:direct"] }, experimentVariables: { opener: "direct" }, voiceCheck: "passed", originalityCheck: "passed", generation: configuredEditorEvidence("A complete thought, made legible for a busy reader.") }],
    capacity: { day: "2026-09-01", review: [{ platform: "linkedin", available: 1 }], slots: [{ platform: "linkedin", available: 1, capacity: 1, scheduledCount: 0 }] },
    experiment: { id: "experiment-cli", question: "Does direct context help?", outcomeFamilies: ["attention"], minimumSample: 5, topic: "clarity", audience: "mixed-feed readers" },
  };
  return buildGrowExperimentProposal(input);
}

function io(files: Record<string, string>, applied: string[]): GrowExperimentQueueHandoffCliIo {
  return {
    read: async (path) => files[path] ?? "",
    output: (body) => { files.stdout = body; },
    error: (body) => { files.stderr = body; },
    apply: (folder, proposalValue, decisionValue) => {
      applied.push(folder);
      const plan = buildGrowExperimentQueueHandoff(proposalValue, decisionValue);
      return { ...plan, folder, created: plan.rows.length, existing: 0, bindings: [] };
    },
  };
}

test("handoff CLI previews by default and requires --apply for filesystem writes", async () => {
  const value = proposal();
  const decision = { proposalDigest: value.digest, decidedBy: "muxin", decidedAt: "2026-08-30T13:00:00Z", decisions: [{ variantId: "linkedin-cli", status: "approved", note: "Approved." }] };
  const files: Record<string, string> = { proposal: JSON.stringify(value), decision: JSON.stringify(decision) };
  const applied: string[] = [];
  assert.equal(await runGrowExperimentQueueHandoffCli(["--proposal", "proposal", "--decision", "decision", "--folder", "/content/example"], io(files, applied)), 0);
  assert.equal(applied.length, 0);
  assert.equal(JSON.parse(files.stdout!).rows[0].status, "pending");
  assert.equal(await runGrowExperimentQueueHandoffCli(["--proposal", "proposal", "--decision", "decision", "--folder", "/content/example", "--apply"], io(files, applied)), 0);
  assert.deepEqual(applied, ["/content/example"]);
});

test("handoff CLI fails closed on missing arguments and invalid JSON", async () => {
  const files: Record<string, string> = { bad: "{" };
  assert.equal(await runGrowExperimentQueueHandoffCli([], io(files, [])), 1);
  assert.match(files.stderr!, /--proposal is required/);
  assert.equal(await runGrowExperimentQueueHandoffCli(["--proposal", "bad", "--decision", "bad", "--folder", "/content/example"], io(files, [])), 1);
  assert.match(files.stderr!, /invalid JSON/);
});
