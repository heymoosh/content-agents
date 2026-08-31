import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { writeCell } from "../publish/queue.js";
import type { PublishingStatus } from "../review/publishing-status.js";
import { applyGrowExperimentQueueHandoff } from "./experiment-queue-handoff.js";
import { buildGrowExperimentRun } from "./experiment-run.js";
import { scheduleGrowExperimentVariant } from "./experiment-scheduling.js";
import { buildGrowExperimentProposal, type GrowExperimentDecisionInput, type GrowExperimentProposalInput } from "./experiment-slice.js";

function input(): GrowExperimentProposalInput {
  return {
    id: "p", createdAt: "2026-08-30T12:00:00Z",
    source: { id: "s", kind: "raw-thought", body: "A complete thought.", originRef: "fixture:s" },
    selectedPlatforms: ["x"],
    cut: { id: "c", body: "A complete thought.", sourceRefs: ["s#body"], rationale: "Complete.", decision: { status: "approved", decidedBy: "muxin", decidedAt: "2026-08-30T11:00:00Z" } },
    variants: [{ id: "v", platform: "x", medium: "text", format: "post", body: "A complete thought.", sourceRefs: ["s#body"], treatment: { ref: "t", rationale: "Direct.", evidenceStatus: "supported", evidenceRefs: ["s#body"] }, experimentVariables: { opener: "direct" }, voiceCheck: "passed", originalityCheck: "passed" }],
    capacity: { day: "2026-09-01", review: [{ platform: "x", available: 1 }], slots: [{ platform: "x", available: 1, capacity: 1, scheduledCount: 0 }] },
    experiment: { id: "e", question: "Does it work?", outcomeFamilies: ["attention"], minimumSample: 10, topic: "topic", audience: "readers" },
  };
}
function decision(digest: string): GrowExperimentDecisionInput {
  return { proposalDigest: digest, decidedBy: "muxin", decidedAt: "2026-08-30T13:00:00Z", decisions: [{ variantId: "v", status: "approved", note: "yes" }] };
}
function folder(): string {
  const root = mkdtempSync(join(tmpdir(), "grow-run-")); mkdirSync(join(root, "derivatives"));
  writeFileSync(join(root, "review-queue.md"), ["# Review queue", "", "| id | platform | format | asset | native | brand | cta | status | notes | origin |", "|---|---|---|---|---|---|---|---|---|---|", ""].join("\n"));
  return root;
}

async function fixture() {
  const root = folder(); const proposal = buildGrowExperimentProposal(input()); const selected = decision(proposal.digest);
  const handoff = applyGrowExperimentQueueHandoff(root, proposal, selected);
  const attempt = await scheduleGrowExperimentVariant(handoff, "v", { schedule: async (_folder, slug) => {
    writeCell(root, "v", { status: "published" });
    const publishing: PublishingStatus = { slug, rowId: "v", provider: "typefully", state: "planned", at: "2026-08-30T14:00:00Z", plannedFor: "2026-09-01T16:00:00Z", providerObjectId: "tf-1", deliveryMode: "provider" };
    return { scheduled: { draftId: "tf-1", plannedFor: publishing.plannedFor }, scheduleError: null, publishing };
  } });
  return { root, proposal, selected, attempt };
}

describe("Phase 3 running experiment transition", () => {
  test("turns observed scheduled delivery into a body-free running experiment with exact publish lineage", async () => {
    const value = await fixture();
    try {
      const run = buildGrowExperimentRun(value.proposal, value.selected, [value.attempt]);
      assert.equal(run.experimentRecord.status, "running");
      assert.deepEqual(run.experimentRecord.lineage.variantRefs, ["v"]);
      assert.deepEqual(run.experimentRecord.lineage.publishRefs, ["tf-1"]);
      assert.deepEqual(run.experimentRecord.comparison, { control: null, treatment: null });
      assert.equal(run.experimentRecord.startAt, "2026-08-30T14:00:00Z");
      assert.equal(run.experimentRecord.winner, null);
      assert.equal(run.autoWinner, false);
      assert.equal(run.sideEffects, "none");
    } finally { rmSync(value.root, { recursive: true, force: true }); }
  });

  test("rejects failed, digest-drifted, duplicate, or unready scheduling evidence", async () => {
    const value = await fixture();
    try {
      assert.throws(() => buildGrowExperimentRun(value.proposal, value.selected, [{ ...value.attempt, proposalDigest: "sha256:wrong" }]), /digest/i);
      assert.throws(() => buildGrowExperimentRun(value.proposal, value.selected, [{ ...value.attempt, version: "forged" as never }]), /unsupported/i);
      assert.throws(() => buildGrowExperimentRun(value.proposal, value.selected, [value.attempt, value.attempt]), /duplicate/i);
      assert.throws(() => buildGrowExperimentRun(value.proposal, value.selected, [{ ...value.attempt, scheduleError: "timeout" }]), /successful|error/i);
      assert.throws(() => buildGrowExperimentRun(value.proposal, value.selected, [{ ...value.attempt, binding: { ...value.attempt.binding, status: "blocked" } }]), /ready scheduled binding/i);
      assert.throws(() => buildGrowExperimentRun(value.proposal, value.selected, [{ ...value.attempt, binding: { ...value.attempt.binding, candidateId: "other" } }]), /candidate/i);
      assert.throws(() => buildGrowExperimentRun(value.proposal, value.selected, [{ ...value.attempt, publishing: { ...value.attempt.publishing, plannedFor: "2026-09-02T16:00:00Z" } }]), /timestamp/i);
      assert.throws(() => buildGrowExperimentRun(value.proposal, value.selected, [{ ...value.attempt, publishing: { ...value.attempt.publishing, at: "2026-08-30T12:30:00Z" } }]), /predates/i);
    } finally { rmSync(value.root, { recursive: true, force: true }); }
  });
});
