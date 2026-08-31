import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readQueue } from "../publish/queue.js";
import { buildGrowExperimentProposal, type GrowExperimentDecisionInput, type GrowExperimentProposalInput } from "./experiment-slice.js";
import { configuredEditorEvidence, signalsExperimentRecommendation } from "./experiment-test-fixtures.js";
import { applyGrowExperimentQueueHandoff, buildGrowExperimentQueueHandoff } from "./experiment-queue-handoff.js";

function proposalInput(): GrowExperimentProposalInput {
  return {
    id: "phase3-handoff",
    createdAt: "2026-08-30T12:00:00.000Z",
    source: {
      id: "source-1",
      kind: "long-form",
      body: "People wait for a hero.\nPeople can build power together.",
      originRef: "fixture:source-1",
      canonicalUrl: "https://www.humaninference.ai/essays/source-1",
    },
    recommendation: signalsExperimentRecommendation({ variantId: "linkedin-direct", comparisonRef: "x-question", families: ["attention", "conversation"], minimumSample: 10 }),
    selectedPlatforms: ["linkedin", "x"],
    cut: {
      id: "cut-1",
      body: "People wait for a hero. People can build power together.",
      sourceRefs: ["source-1#L1-L2"],
      rationale: "One complete point.",
      decision: { status: "approved", decidedBy: "muxin", decidedAt: "2026-08-30T11:00:00.000Z" },
    },
    variants: [
      {
        id: "linkedin-direct",
        platform: "linkedin",
        medium: "text",
        format: "post",
        body: "People keep waiting for a hero. The more practical answer is to build power together.\n\nRead the essay: https://www.humaninference.ai/essays/source-1",
        sourceRefs: ["source-1#L1-L2"],
        treatment: { ref: "treatment:direct", rationale: "Ground the subject immediately.", evidenceStatus: "supported", evidenceRefs: ["source-1#L1-L2"] },
        experimentVariables: { opener: "direct" }, voiceCheck: "passed", originalityCheck: "passed",
        generation: configuredEditorEvidence("People keep waiting for a hero. The more practical answer is to build power together.\n\nRead the essay: https://www.humaninference.ai/essays/source-1"),
      },
      {
        id: "x-question",
        platform: "x",
        medium: "text",
        format: "post",
        body: "Why do we keep waiting for a hero? People can build power together.\n\nRead the essay: https://www.humaninference.ai/essays/source-1",
        sourceRefs: ["source-1#L1-L2"],
        treatment: { ref: "treatment:question", rationale: "Use a legible question.", evidenceStatus: "hypothesis", evidenceRefs: ["evidence:question"] },
        experimentVariables: { opener: "question" }, voiceCheck: "passed", originalityCheck: "passed",
        generation: configuredEditorEvidence("Why do we keep waiting for a hero? People can build power together.\n\nRead the essay: https://www.humaninference.ai/essays/source-1"),
      },
    ],
    capacity: {
      day: "2026-09-01",
      review: [{ platform: "linkedin", available: 1 }, { platform: "x", available: 1 }],
      slots: [
        { platform: "linkedin", available: 1, capacity: 1, scheduledCount: 0 },
        { platform: "x", available: 1, capacity: 1, scheduledCount: 0 },
      ],
    },
    experiment: {
      id: "experiment-1", question: "Which opener produces qualified conversation?",
      outcomeFamilies: ["attention", "conversation"], minimumSample: 10,
      topic: "collective agency", audience: "mixed-feed readers",
    },
  };
}

function decision(proposalDigest: string): GrowExperimentDecisionInput {
  return {
    proposalDigest,
    decidedBy: "muxin",
    decidedAt: "2026-08-30T13:00:00.000Z",
    decisions: [
      { variantId: "linkedin-direct", status: "approved", note: "Approved for this experiment." },
      { variantId: "x-question", status: "rejected", note: "The question is weaker." },
    ],
  };
}

function folder(): string {
  const root = mkdtempSync(join(tmpdir(), "grow-handoff-"));
  mkdirSync(join(root, "derivatives"));
  writeFileSync(join(root, "review-queue.md"), [
    "# Review queue",
    "",
    "| id | platform | format | asset | native | brand | cta | status | notes | origin |",
    "|---|---|---|---|---|---|---|---|---|---|",
    "",
  ].join("\n"));
  return root;
}

describe("Phase 3 experiment queue handoff", () => {
  test("plans only explicitly approved unchanged variants with exact lineage", () => {
    const proposal = buildGrowExperimentProposal(proposalInput());
    const handoff = buildGrowExperimentQueueHandoff(proposal, decision(proposal.digest));
    assert.equal(handoff.rows.length, 1);
    assert.equal(handoff.rows[0]?.id, "linkedin-direct");
    assert.equal(handoff.rows[0]?.status, "pending");
    assert.doesNotMatch(handoff.assets[0]!.content, /approved_by|approved_at/);
    assert.equal(handoff.assets[0]?.body, proposal.variants[0]?.body);
    assert.deepEqual(handoff.rows[0]?.lineage, {
      sourceId: "source-1", cutId: "cut-1", variantId: "linkedin-direct",
      treatmentId: "treatment:direct", experimentId: "experiment-1", publishId: null,
    });
    assert.equal(handoff.autoScheduling, false);
    assert.equal(handoff.autoPublishing, false);
  });

  test("writes the canonical asset and queue row once, then reconciles the live queue fact", () => {
    const root = folder();
    try {
      const proposal = buildGrowExperimentProposal(proposalInput());
      const first = applyGrowExperimentQueueHandoff(root, proposal, decision(proposal.digest));
      const second = applyGrowExperimentQueueHandoff(root, proposal, decision(proposal.digest));
      assert.equal(first.created, 1);
      assert.equal(second.created, 0);
      assert.equal(second.existing, 1);
      const rows = readQueue(root).rows;
      assert.equal(rows.length, 1);
      assert.equal(rows[0]?.status, "pending");
      assert.notEqual(first.bindings[0]?.readiness.status, "ready");
      const asset = readFileSync(join(root, rows[0]!.asset), "utf8");
      assert.match(asset, /grow_proposal_digest:/);
      assert.match(asset, /variant_id: "linkedin-direct"/);
      assert.ok(asset.endsWith(`${proposal.variants[0]!.body}\n`));
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("fails closed before writing when an existing row or asset conflicts", () => {
    const root = folder();
    try {
      const proposal = buildGrowExperimentProposal(proposalInput());
      const plan = buildGrowExperimentQueueHandoff(proposal, decision(proposal.digest));
      writeFileSync(join(root, plan.assets[0]!.relativePath), "different body\n");
      const before = readFileSync(join(root, "review-queue.md"), "utf8");
      assert.throws(() => applyGrowExperimentQueueHandoff(root, proposal, decision(proposal.digest)), /conflict/i);
      assert.equal(readFileSync(join(root, "review-queue.md"), "utf8"), before);
      assert.equal(readQueue(root).rows.length, 0);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("never queues edited, rejected, or another-pass variants", () => {
    const input = proposalInput();
    input.variants = [input.variants[0]!];
    input.selectedPlatforms = ["linkedin"];
    input.capacity = { day: "2026-09-01", review: [{ platform: "linkedin", available: 1 }], slots: [{ platform: "linkedin", available: 1, capacity: 1, scheduledCount: 0 }] };
    const proposal = buildGrowExperimentProposal(input);
    for (const status of ["edited", "rejected", "needs-another-pass"] as const) {
      const result = buildGrowExperimentQueueHandoff(proposal, {
        proposalDigest: proposal.digest, decidedBy: "muxin", decidedAt: "2026-08-30T13:00:00.000Z",
        decisions: [{ variantId: "linkedin-direct", status, note: "Not approved.", ...(status === "edited" ? { editedBody: proposal.variants[0]!.body } : {}) }],
      });
      assert.equal(result.rows.length, 0);
    }
  });
});
