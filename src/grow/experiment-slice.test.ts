import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildGrowExperimentDecision,
  buildGrowExperimentProposal,
  type GrowExperimentProposalInput,
} from "./experiment-slice.js";

const base = (): GrowExperimentProposalInput => ({
  id: "phase3-used-to-think",
  createdAt: "2026-08-31T12:00:00.000Z",
  source: {
    id: "source-worlds-broken",
    kind: "long-form",
    body: "We tend to wait for a hero.\nOrdinary people already have leverage when they build together.",
    originRef: "fixture:worlds-broken#L1-L2",
    canonicalUrl: "https://www.humaninference.ai/essays/the-worlds-broken-what-do-we-do",
  },
  selectedPlatforms: ["linkedin", "x"],
  cut: {
    id: "cut-collective-leverage",
    body: "We tend to wait for a hero. Ordinary people already have leverage when they build together.",
    sourceRefs: ["source-worlds-broken#L1-L2"],
    rationale: "One standalone claim with a practical direction.",
    decision: { status: "approved", decidedBy: "muxin", decidedAt: "2026-08-31T11:55:00.000Z" },
  },
  variants: [
    {
      id: "variant-linkedin-used-to-think",
      platform: "linkedin",
      medium: "text",
      format: "post",
      body: "I used to think changing the world required a heroic leader. Now I think ordinary people build power by finding where they have leverage and working together.\n\nRead the full essay: https://www.humaninference.ai/essays/the-worlds-broken-what-do-we-do",
      sourceRefs: ["source-worlds-broken#L1-L2"],
      treatment: {
        ref: "pattern:used-to-think-now",
        rationale: "Use the reviewed belief-shift scaffold to make the point legible in a cold feed.",
        evidenceStatus: "hypothesis",
        evidenceRefs: ["dossier:used-to-think-now"],
      },
      experimentVariables: { hook: "used-to-think-now", cta: "source", length: "medium" },
      voiceCheck: "passed",
      originalityCheck: "passed",
    },
    {
      id: "variant-x-direct",
      platform: "x",
      medium: "text",
      format: "post",
      body: "Changing the world does not require one heroic leader. It requires ordinary people to find where they have leverage and build together.\n\nRead the full essay: https://www.humaninference.ai/essays/the-worlds-broken-what-do-we-do",
      sourceRefs: ["source-worlds-broken#L1-L2"],
      treatment: {
        ref: "treatment:direct-claim",
        rationale: "Ground the subject immediately, then land one practical point.",
        evidenceStatus: "supported",
        evidenceRefs: ["source-worlds-broken#L1-L2"],
      },
      experimentVariables: { hook: "direct-claim", cta: "source", length: "short" },
      voiceCheck: "passed",
      originalityCheck: "passed",
    },
  ],
  capacity: {
    day: "2026-09-01",
    review: [
      { platform: "linkedin", available: 1 },
      { platform: "x", available: 1 },
    ],
    slots: [
      { platform: "linkedin", available: 1 },
      { platform: "x", available: 1 },
    ],
  },
  experiment: {
    id: "experiment-used-to-think-vs-direct",
    question: "Does the reviewed belief-shift hook improve qualified conversation without reducing essay visits?",
    outcomeFamilies: ["attention", "conversation", "audience", "business"],
    minimumSample: 20,
    topic: "collective agency and social change",
    audience: "mixed-feed readers interested in civic systems and practical agency",
  },
});

describe("Phase 3 Grow experiment slice", () => {
  test("builds a digest-bound proposal with readable copy, full lineage, explicit capacity, and no implied winner", () => {
    const result = buildGrowExperimentProposal(base());

    assert.equal(result.version, "grow-experiment-proposal-v1");
    assert.match(result.digest, /^sha256:[a-f0-9]{64}$/);
    assert.deepEqual(result.selectedPlatforms, ["linkedin", "x"]);
    assert.equal(result.cut.decision.status, "approved");
    assert.equal(result.variants.length, 2);
    assert.equal(result.capacityManifest.internalCandidateVolume, 2);
    assert.equal(result.capacityManifest.approvedPublishVolume, 0);
    assert.ok(result.capacityManifest.slices.every((slice) => !slice.paused));
    assert.equal(result.experimentRecord.version, "grow-experiment-v1");
    assert.equal(result.reviewBundles.length, 2);
    assert.equal(result.review.status, "pending");
    assert.equal(result.winner, null);
    assert.equal(result.autoApproval, false);
    assert.equal(result.autoScheduling, false);
    assert.equal(result.autoPublishing, false);
  });

  test("requires exact platform coverage and source, cut, evidence, rationale, variables, voice, and CTA boundaries", () => {
    assert.throws(() => buildGrowExperimentProposal({ ...base(), selectedPlatforms: ["linkedin", "tiktok"] }), /selected platform.*variant/i);
    assert.throws(() => buildGrowExperimentProposal({ ...base(), variants: [{ ...base().variants[0]!, sourceRefs: [] }, base().variants[1]!] }), /sourceRefs/i);
    assert.throws(() => buildGrowExperimentProposal({ ...base(), variants: [{ ...base().variants[0]!, body: "Bad dash — and [^6]." }, base().variants[1]!] }), /voice|footnote|dash/i);
    assert.throws(() => buildGrowExperimentProposal({ ...base(), variants: [{ ...base().variants[0]!, body: "A standalone post with no source invitation." }, base().variants[1]!] }), /canonical source CTA/i);
    assert.throws(() => buildGrowExperimentProposal({ ...base(), variants: [{ ...base().variants[0]!, body: `${base().variants[0]!.body} https://example.com/unreviewed-lead` }, base().variants[1]!] }), /only the canonical source CTA/i);
    assert.throws(() => buildGrowExperimentProposal({ ...base(), variants: [{ ...base().variants[0]!, treatment: { ...base().variants[0]!.treatment, evidenceRefs: [] } }, base().variants[1]!] }), /evidenceRefs/i);
    assert.throws(() => buildGrowExperimentProposal({ ...base(), variants: [base().variants[0]!, { ...base().variants[1]!, body: `${"Long ".repeat(70)}\n\nRead the full essay: https://www.humaninference.ai/essays/the-worlds-broken-what-do-we-do` }] }), /x.*280/i);
  });

  test("keeps Substack Notes link-free even when a canonical URL is supplied", () => {
    const input = base();
    input.source = { ...input.source, kind: "substack-note", canonicalUrl: "https://example.substack.com/p/note-1" };
    input.variants = input.variants.map((variant) => ({ ...variant, body: variant.body.split("\n\nRead the full essay:")[0]! }));
    assert.doesNotThrow(() => buildGrowExperimentProposal(input));
    input.variants = input.variants.map((variant) => ({ ...variant, body: `${variant.body}\n\nhttps://example.substack.com/p/note-1` }));
    assert.throws(() => buildGrowExperimentProposal(input), /Substack Note.*link/i);
  });

  test("records approve, edited, reject, and another-pass decisions without overflowing review or slot capacity", () => {
    const proposal = buildGrowExperimentProposal(base());
    const result = buildGrowExperimentDecision(proposal, {
      proposalDigest: proposal.digest,
      decidedBy: "muxin",
      decidedAt: "2026-08-31T13:00:00.000Z",
      decisions: [
        { variantId: "variant-linkedin-used-to-think", status: "approved", note: "Use it." },
        { variantId: "variant-x-direct", status: "rejected", note: "Too compressed." },
      ],
    });

    assert.equal(result.version, "grow-experiment-slice-v1");
    assert.equal(result.review.status, "decided");
    assert.deepEqual(result.approvedRecords.map((row) => row.variantId), ["variant-linkedin-used-to-think"]);
    assert.equal(result.approvedRecords[0]?.deliveryReadiness, "ready");
    assert.equal(result.capacityManifest.internalCandidateVolume, 2);
    assert.equal(result.capacityManifest.approvedPublishVolume, 1);
    assert.equal(result.experimentRecord.status, "proposed");
    assert.equal(result.deliveryRecords[0]?.status, "approved");
    assert.equal(result.winner, null);
  });

  test("fails closed on digest tamper, partial decisions, forged authority, edits without copy, and capacity overflow", () => {
    const proposal = buildGrowExperimentProposal(base());
    const decisions = proposal.variants.map((variant) => ({ variantId: variant.id, status: "approved" as const, note: null }));
    assert.throws(() => buildGrowExperimentDecision(proposal, { proposalDigest: "sha256:" + "0".repeat(64), decidedBy: "muxin", decidedAt: "2026-08-31T13:00:00Z", decisions }), /digest/i);
    assert.throws(() => buildGrowExperimentDecision(proposal, { proposalDigest: proposal.digest, decidedBy: "muxin", decidedAt: "2026-08-31T13:00:00Z", decisions: decisions.slice(0, 1) }), /every variant/i);
    assert.throws(() => buildGrowExperimentDecision(proposal, { proposalDigest: proposal.digest, decidedBy: "system", decidedAt: "2026-08-31T13:00:00Z", decisions }), /Muxin/i);
    assert.throws(() => buildGrowExperimentDecision(proposal, { proposalDigest: proposal.digest, decidedBy: "muxin", decidedAt: "2026-08-31T13:00:00Z", decisions: [{ variantId: proposal.variants[0]!.id, status: "edited", note: "Sharper.", editedBody: null }, { variantId: proposal.variants[1]!.id, status: "rejected", note: null }] }), /editedBody/i);

    const constrained = buildGrowExperimentProposal({ ...base(), capacity: { ...base().capacity, review: [{ platform: "linkedin", available: 0 }, { platform: "x", available: 1 }] } });
    assert.throws(() => buildGrowExperimentDecision(constrained, { proposalDigest: constrained.digest, decidedBy: "muxin", decidedAt: "2026-08-31T13:00:00Z", decisions: constrained.variants.map((variant) => ({ variantId: variant.id, status: "approved", note: null })) }), /review capacity/i);

    const noLinkedInSlot = buildGrowExperimentProposal({ ...base(), capacity: { ...base().capacity, slots: [{ platform: "linkedin", available: 0 }, { platform: "x", available: 1 }] } });
    assert.throws(() => buildGrowExperimentDecision(noLinkedInSlot, { proposalDigest: noLinkedInSlot.digest, decidedBy: "muxin", decidedAt: "2026-08-31T13:00:00Z", decisions: [{ variantId: "variant-linkedin-used-to-think", status: "approved", note: null }, { variantId: "variant-x-direct", status: "rejected", note: null }] }), /slot capacity/i);
  });

  test("records edits and another-pass decisions but never promotes edited copy without a fresh validated proposal", () => {
    const proposal = buildGrowExperimentProposal(base());
    const result = buildGrowExperimentDecision(proposal, {
      proposalDigest: proposal.digest, decidedBy: "muxin", decidedAt: "2026-08-31T13:00:00Z",
      decisions: [
        { variantId: "variant-linkedin-used-to-think", status: "edited", note: "Sharper wording.", editedBody: "A new Muxin edit. Read the full essay: https://www.humaninference.ai/essays/the-worlds-broken-what-do-we-do" },
        { variantId: "variant-x-direct", status: "needs-another-pass", note: "Try a different opening." },
      ],
    });
    assert.equal(result.approvedRecords.length, 0);
    assert.equal(result.deliveryRecords.length, 0);
    assert.ok(result.reviewBundles.every((bundle) => bundle.status === "needs-another-pass"));
    assert.equal(result.capacityManifest.approvedPublishVolume, 0);
  });
});
