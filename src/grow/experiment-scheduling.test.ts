import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { writeCell } from "../publish/queue.js";
import type { PublishingStatus } from "../review/publishing-status.js";
import { applyGrowExperimentQueueHandoff } from "./experiment-queue-handoff.js";
import { scheduleGrowExperimentVariant } from "./experiment-scheduling.js";
import { buildGrowExperimentProposal, type GrowExperimentDecisionInput, type GrowExperimentProposalInput } from "./experiment-slice.js";
import { configuredEditorEvidence, signalsExperimentRecommendation } from "./experiment-test-fixtures.js";

function proposalInput(): GrowExperimentProposalInput {
  return {
    id: "proposal-1", createdAt: "2026-08-30T12:00:00.000Z",
    source: { id: "source-1", kind: "long-form", body: "People can act together.", originRef: "fixture:source-1", canonicalUrl: "https://example.test/essay" },
    recommendation: signalsExperimentRecommendation({ variantId: "x-direct", minimumSample: 10 }),
    cut: {
      id: "cut-1", body: "People can act together.", sourceRefs: ["source-1#body"], rationale: "One complete point.",
      decision: { status: "approved", decidedBy: "muxin", decidedAt: "2026-08-30T11:00:00.000Z" },
    },
    selectedPlatforms: ["x"],
    variants: [{
      id: "x-direct", platform: "x", medium: "text", format: "post",
      body: "Collective action is a practical question.\n\nPeople can act together.\n\nRead the essay: https://example.test/essay",
      sourceRefs: ["source-1#body"],
      treatment: { ref: "treatment:direct", evidenceStatus: "supported", evidenceRefs: ["source-1#body"], rationale: "Ground the topic immediately." },
      experimentVariables: { opener: "direct" },
      voiceCheck: "passed", originalityCheck: "passed",
      generation: configuredEditorEvidence("Collective action is a practical question.\n\nPeople can act together.\n\nRead the essay: https://example.test/essay"),
    }],
    capacity: {
      day: "2026-09-01",
      review: [{ platform: "x", available: 1 }],
      slots: [{ platform: "x", available: 1, capacity: 1, scheduledCount: 0 }],
    },
    experiment: {
      id: "experiment-1", question: "Does the direct opener work?", outcomeFamilies: ["attention"],
      minimumSample: 10, topic: "collective agency", audience: "mixed-feed readers",
    },
  };
}

function decision(digest: string): GrowExperimentDecisionInput {
  return {
    proposalDigest: digest, decidedBy: "muxin", decidedAt: "2026-08-30T13:00:00.000Z",
    decisions: [{ variantId: "x-direct", status: "approved", note: "Approved." }],
  };
}

function folder(): string {
  const root = mkdtempSync(join(tmpdir(), "grow-schedule-"));
  mkdirSync(join(root, "derivatives"));
  writeFileSync(join(root, "review-queue.md"), [
    "# Review queue", "",
    "| id | platform | format | asset | native | brand | cta | status | notes | origin |",
    "|---|---|---|---|---|---|---|---|---|---|", "",
  ].join("\n"));
  return root;
}

describe("Phase 3 experiment scheduling evidence", () => {
  test("explicitly schedules one approved handoff and returns a ready scheduled binding", async () => {
    const root = folder();
    try {
      const proposal = buildGrowExperimentProposal(proposalInput());
      const handoff = applyGrowExperimentQueueHandoff(root, proposal, decision(proposal.digest));
      const schedule = async (_folder: string, slug: string): Promise<{ scheduled: unknown; scheduleError: null; publishing: PublishingStatus }> => {
        assert.equal(slug, root.split("/").at(-1));
        writeCell(root, "x-direct", { status: "published" });
        return {
          scheduled: { draftId: "tf-123", plannedFor: "2026-09-01T16:00:00.000Z" }, scheduleError: null,
          publishing: {
            slug, rowId: "x-direct", provider: "typefully", state: "planned",
            at: "2026-08-30T13:01:00.000Z", plannedFor: "2026-09-01T16:00:00.000Z",
            providerObjectId: "tf-123", deliveryMode: "provider",
          },
        };
      };
      const result = await scheduleGrowExperimentVariant(handoff, "x-direct", { schedule });
      assert.equal(result.attempted, true);
      assert.equal(result.binding.status, "scheduled", JSON.stringify(result.binding.readiness));
      assert.equal(result.binding.readiness.status, "ready", JSON.stringify(result.binding.readiness));
      assert.equal(result.binding.schedulerFacts?.status, "scheduled");
      assert.equal(result.binding.providerFacts?.reference, "tf-123");
      assert.equal(result.binding.providerFacts?.scheduledAt, "2026-09-01T16:00:00.000Z");
      assert.equal(result.binding.autoPublishing, false);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("keeps a failed attempt approved and exposes blocked evidence without inventing provider facts", async () => {
    const root = folder();
    try {
      const proposal = buildGrowExperimentProposal(proposalInput());
      const handoff = applyGrowExperimentQueueHandoff(root, proposal, decision(proposal.digest));
      const result = await scheduleGrowExperimentVariant(handoff, "x-direct", {
        schedule: async (_folder, slug) => ({
          scheduled: null, scheduleError: "provider timeout",
          publishing: { slug, rowId: "x-direct", provider: "typefully", state: "uncertain", at: "2026-08-30T13:01:00.000Z", error: "provider timeout", deliveryMode: "provider" },
        }),
      });
      assert.equal(result.binding.status, "blocked");
      assert.equal(result.binding.providerFacts, null);
      assert.match(result.scheduleError ?? "", /timeout/);
      assert.match(readFileSync(join(root, "review-queue.md"), "utf8"), /\| approve \|/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("refuses any row that is not the unchanged approved handoff candidate", async () => {
    const root = folder();
    try {
      const proposal = buildGrowExperimentProposal(proposalInput());
      const handoff = applyGrowExperimentQueueHandoff(root, proposal, decision(proposal.digest));
      writeCell(root, "x-direct", { status: "pending" });
      let calls = 0;
      await assert.rejects(
        scheduleGrowExperimentVariant(handoff, "x-direct", { schedule: async () => { calls += 1; throw new Error("should not run"); } }),
        /must still be explicitly approved/i,
      );
      assert.equal(calls, 0);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("refuses body drift before acquiring a publishing attempt", async () => {
    const root = folder();
    try {
      const proposal = buildGrowExperimentProposal(proposalInput());
      const handoff = applyGrowExperimentQueueHandoff(root, proposal, decision(proposal.digest));
      writeFileSync(join(root, handoff.rows[0]!.asset), "changed after approval\n");
      let calls = 0;
      await assert.rejects(
        scheduleGrowExperimentVariant(handoff, "x-direct", { schedule: async () => { calls += 1; throw new Error("should not run"); } }),
        /approved body/i,
      );
      assert.equal(calls, 0);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
