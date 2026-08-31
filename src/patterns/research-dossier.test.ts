import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  buildResearchDossier,
  recordResearchDossierDecision,
  type ResearchDossierDecision,
  type ResearchDossierInput,
} from "./research-dossier.js";
import * as researchDossierApi from "./research-dossier.js";

function input(overrides: Partial<ResearchDossierInput> = {}): ResearchDossierInput {
  return {
    question: {
      id: "question-openings",
      text: "Which reviewed opening mechanisms make a self-contained point quickly on text-first social feeds?",
      intendedUse: "observation",
    },
    selectionPolicy: {
      description: "Include reviewed text posts with explicit pool membership and a settled same-account baseline.",
      inclusionCriteria: ["reviewed source/post evidence", "settled comparable baseline"],
      exclusionCriteria: ["missing denominator", "pending originality review"],
    },
    evidence: [
      {
        id: "evidence-b",
        accountId: "account-b",
        sourceId: "source-b",
        postId: "post-b",
        platform: "linkedin",
        pool: "broad",
        membershipReason: "Muxin reviewed this account for the broad LinkedIn pool.",
        popularityScope: "LinkedIn text creators",
        sampleScope: "fixed reviewed August sample",
        baselineScope: "same-account settled /new posts",
        baselineRef: "baseline-b",
        metric: { name: "views", numerator: 600, denominator: 10_000, observedAt: "2026-08-20T00:00:00.000Z" },
        evidenceLinks: ["https://example.test/post-b"],
        provenance: "reviewed native post snapshot",
        collectedAt: "2026-08-21T00:00:00.000Z",
        caveats: ["public metrics can change"],
        reviewStatus: "reviewed",
        reviewedBy: "Muxin",
        reviewedAt: "2026-08-22T00:00:00.000Z",
      },
      {
        id: "evidence-a",
        accountId: "account-a",
        sourceId: "source-a",
        postId: "post-a",
        platform: "x",
        pool: "niche",
        membershipReason: "Muxin reviewed this account for the niche pool.",
        popularityScope: "Human Inference-adjacent creators on X",
        sampleScope: "fixed reviewed August sample",
        baselineScope: "same-account settled /new posts",
        baselineRef: "baseline-a",
        metric: { name: "views", numerator: 300, denominator: 5_000, observedAt: "2026-08-19T00:00:00.000Z" },
        evidenceLinks: ["https://example.test/post-a"],
        provenance: "reviewed native post snapshot",
        collectedAt: "2026-08-20T00:00:00.000Z",
        caveats: ["small bounded sample"],
        reviewStatus: "reviewed",
        reviewedBy: "Muxin",
        reviewedAt: "2026-08-21T00:00:00.000Z",
      },
    ],
    baselines: [
      {
        id: "baseline-b", accountId: "account-b", metric: "views", numerator: 900,
        denominator: 10, windowStart: "2026-08-01T00:00:00.000Z", windowEnd: "2026-08-20T00:00:00.000Z",
        method: "settled /new sample median", source: "native profile", evidenceRefs: ["https://example.test/baseline-b"],
        caveats: ["ten-post sample"], reviewStatus: "reviewed",
        reviewedBy: "Muxin", reviewedAt: "2026-08-22T00:00:00.000Z",
      },
      {
        id: "baseline-a", accountId: "account-a", metric: "views", numerator: 500,
        denominator: 10, windowStart: "2026-08-01T00:00:00.000Z", windowEnd: "2026-08-19T00:00:00.000Z",
        method: "settled /new sample median", source: "native profile", evidenceRefs: ["https://example.test/baseline-a"],
        caveats: ["ten-post sample"], reviewStatus: "reviewed",
        reviewedBy: "Muxin", reviewedAt: "2026-08-21T00:00:00.000Z",
      },
    ],
    selections: [
      { evidenceId: "evidence-b", disposition: "include", reason: "Meets every declared criterion." },
      { evidenceId: "evidence-a", disposition: "include", reason: "Meets every declared criterion." },
    ],
    summaries: [{
      id: "summary-context-first",
      statement: "The reviewed examples open by naming the topic before adding tension.",
      evidenceRefs: ["evidence-b", "evidence-a"],
      caveats: ["Two-account bounded sample; this is not a winner claim."],
      originality: {
        status: "passed",
        checkedAgainstEvidenceRefs: ["evidence-a", "evidence-b"],
        note: "Mechanism-level abstraction only; no creator wording retained.",
        checkedBy: "Muxin",
        checkedAt: "2026-08-22T00:00:00.000Z",
        method: "Compared the summary against every cited source and the corpus shingle scan.",
      },
    }],
    ...overrides,
  };
}

function pendingProposal(): unknown {
  const reviewed = input();
  return {
    ...reviewed,
    evidence: reviewed.evidence.map(({ reviewStatus: _status, reviewedBy: _by, reviewedAt: _at, ...row }) => row),
    baselines: reviewed.baselines.map(({ reviewStatus: _status, reviewedBy: _by, reviewedAt: _at, ...row }) => row),
    summaries: reviewed.summaries.map((summary) => ({
      ...summary,
      originality: {
        checkedAgainstEvidenceRefs: summary.originality.checkedAgainstEvidenceRefs,
        note: summary.originality.note,
        method: summary.originality.method,
      },
    })),
  };
}

function evidenceReviewedDossier(): ReturnType<typeof buildResearchDossier> {
  const api = researchDossierApi as unknown as {
    buildResearchDossierReviewPacket(value: unknown): { digest: string; proposal: { evidence: Array<{ id: string }>; baselines: Array<{ id: string }>; summaries: Array<{ id: string }> } };
    recordResearchDossierEvidenceReview(packet: unknown, decision: unknown): ReturnType<typeof buildResearchDossier>;
  };
  const packet = api.buildResearchDossierReviewPacket(pendingProposal());
  return api.recordResearchDossierEvidenceReview(packet, {
    reviewedBy: "Muxin",
    reviewedAt: "2026-08-30T17:00:00Z",
    packetDigest: packet.digest,
    policyApproved: true,
    evidenceApprovals: packet.proposal.evidence.map((row) => row.id),
    baselineApprovals: packet.proposal.baselines.map((row) => row.id),
    originalityApprovals: packet.proposal.summaries.map((row) => row.id),
    note: "Evidence review completed for the test fixture.",
  });
}

function stableJsonForTest(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJsonForTest).join(",")}]`;
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  const row = value as Record<string, unknown>;
  return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${stableJsonForTest(row[key])}`).join(",")}}`;
}

function rehashDossierForTest(value: Record<string, unknown>): void {
  const { digest: _digest, readiness: _readiness, usabilityDecision: _decision, ...core } = value;
  value.digest = `sha256:${createHash("sha256").update(stableJsonForTest(core)).digest("hex")}`;
}

test("creates a digest-bound pending review packet without manufacturing Muxin approval", () => {
  const api = researchDossierApi as unknown as {
    buildResearchDossierReviewPacket(value: unknown): {
      kind: string;
      digest: string;
      reviewStatus: string;
      proposal: unknown;
    };
  };
  const packet = api.buildResearchDossierReviewPacket(pendingProposal());

  assert.equal(packet.kind, "research_dossier_review_packet");
  assert.equal(packet.reviewStatus, "pending_muxin_evidence_review");
  assert.match(packet.digest, /^sha256:[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(packet), /"reviewedBy":"Muxin"|"checkedBy":"Muxin"/);
  assert.deepEqual(api.buildResearchDossierReviewPacket(pendingProposal()), packet);

  const prestamped = structuredClone(pendingProposal()) as { evidence: Array<Record<string, unknown>> };
  prestamped.evidence[0]!.reviewedBy = "Muxin";
  assert.throws(() => api.buildResearchDossierReviewPacket(prestamped), /unknown field.*reviewedBy|reviewedBy.*unsupported/i);

  const disguisedBody = structuredClone(pendingProposal()) as { evidence: Array<Record<string, unknown>> };
  disguisedBody.evidence[0]!.secretBody = "creator copy";
  assert.throws(() => api.buildResearchDossierReviewPacket(disguisedBody), /unknown field.*secretBody/i);
});

test("applies exact Muxin approvals to the reviewed proposal and leaves usability pending", () => {
  const api = researchDossierApi as unknown as {
    buildResearchDossierReviewPacket(value: unknown): { digest: string };
    recordResearchDossierEvidenceReview(packet: unknown, decision: unknown): ReturnType<typeof buildResearchDossier>;
  };
  const packet = api.buildResearchDossierReviewPacket(pendingProposal());
  const dossier = api.recordResearchDossierEvidenceReview(packet, {
    reviewedBy: "Muxin",
    reviewedAt: "2026-08-30T20:00:00Z",
    packetDigest: packet.digest,
    policyApproved: true,
    evidenceApprovals: ["evidence-a", "evidence-b"],
    baselineApprovals: ["baseline-a", "baseline-b"],
    originalityApprovals: ["summary-context-first"],
    note: "Evidence, selection policy, baselines, and originality boundary reviewed as shown.",
  });

  assert.equal(dossier.readiness.status, "pending_muxin_review");
  assert.equal(dossier.usabilityDecision, null);
  assert.ok(dossier.boundedEvidence.included.every((row) => row.reviewedBy === "Muxin"));
  assert.ok(dossier.baselines.every((row) => row.reviewedBy === "Muxin"));
  assert.ok(dossier.summaries.every((row) => row.originality.checkedBy === "Muxin"));
  const receipt = (dossier as unknown as { evidenceReview: { packetDigest: string; note: string } | null }).evidenceReview;
  assert.equal(receipt?.packetDigest, packet.digest);
  assert.equal(receipt?.note, "Evidence, selection policy, baselines, and originality boundary reviewed as shown.");
  assert.equal((dossier as unknown as { evidenceReviewPacket: { digest: string } | null }).evidenceReviewPacket?.digest, packet.digest);
});

test("evidence review fails closed on tampering, partial approval, or a rejected policy", () => {
  const api = researchDossierApi as unknown as {
    buildResearchDossierReviewPacket(value: unknown): { digest: string };
    recordResearchDossierEvidenceReview(packet: unknown, decision: unknown): unknown;
  };
  const packet = api.buildResearchDossierReviewPacket(pendingProposal());
  const decision = {
    reviewedBy: "Muxin",
    reviewedAt: "2026-08-30T20:00:00Z",
    packetDigest: packet.digest,
    policyApproved: true,
    evidenceApprovals: ["evidence-a", "evidence-b"],
    baselineApprovals: ["baseline-a", "baseline-b"],
    originalityApprovals: ["summary-context-first"],
    note: "Reviewed.",
  };

  assert.throws(() => api.recordResearchDossierEvidenceReview(packet, { ...decision, packetDigest: "sha256:deadbeef" }), /digest/i);
  assert.throws(() => api.recordResearchDossierEvidenceReview(packet, { ...decision, evidenceApprovals: ["evidence-a"] }), /evidence.*approval/i);
  assert.throws(() => api.recordResearchDossierEvidenceReview(packet, { ...decision, policyApproved: false }), /policy.*approved/i);
  assert.throws(() => api.recordResearchDossierEvidenceReview(packet, { ...decision, body: "smuggled creator copy" }), /unknown field|body/i);
  const tampered = structuredClone(packet) as unknown as { proposal: { question: { text: string } } };
  tampered.proposal.question.text = "Tampered question";
  assert.throws(() => api.recordResearchDossierEvidenceReview(tampered, decision), /digest|tamper/i);
});

test("builds a deterministic, body-free, question-scoped dossier that remains pending human judgment", () => {
  const dossier = buildResearchDossier(input());

  assert.equal(dossier.kind, "research_dossier");
  assert.equal(dossier.version, "research-dossier-v2");
  assert.deepEqual(dossier.boundedEvidence.included.map((row) => row.id), ["evidence-a", "evidence-b"]);
  assert.deepEqual(dossier.citations.map((citation) => citation.evidenceId), ["evidence-a", "evidence-b"]);
  assert.equal(dossier.readiness.status, "pending_muxin_review");
  assert.equal(dossier.usabilityDecision, null);
  assert.match(dossier.digest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(dossier.bodyIncluded, false);
  assert.doesNotMatch(JSON.stringify(dossier), /creator body|winner claim.*true/i);
  assert.deepEqual(buildResearchDossier(input()), dossier);
});

test("keeps explicit exclusions and reasons in the bounded evidence audit", () => {
  const dossier = buildResearchDossier(input({
    selections: [
      { evidenceId: "evidence-a", disposition: "include", reason: "Meets every declared criterion." },
      { evidenceId: "evidence-b", disposition: "exclude", reason: "Outside the declared platform scope." },
    ],
    summaries: [{
      id: "summary-a",
      statement: "The reviewed example grounds the topic in its first sentence.",
      evidenceRefs: ["evidence-a"],
      caveats: ["One example is descriptive only."],
      originality: { status: "passed", checkedAgainstEvidenceRefs: ["evidence-a"], note: "No exact creator wording.", checkedBy: "Muxin", checkedAt: "2026-08-22T00:00:00.000Z", method: "Source comparison and shingle scan." },
    }],
  }));

  assert.deepEqual(dossier.boundedEvidence.excluded, [{ evidenceId: "evidence-b", reason: "Outside the declared platform scope." }]);
  assert.deepEqual(dossier.boundedEvidence.included.map((row) => row.id), ["evidence-a"]);
});

test("fails closed on incomplete evidence, citation closure, selection coverage, originality, or body fields", () => {
  const missingDenominator = input();
  missingDenominator.evidence[0]!.metric.denominator = null;
  assert.throws(() => buildResearchDossier(missingDenominator), /denominator/i);

  assert.throws(() => buildResearchDossier(input({
    selections: [{ evidenceId: "evidence-a", disposition: "include", reason: "included" }],
  })), /selection.*evidence-b/i);

  assert.throws(() => buildResearchDossier(input({
    summaries: [{
      id: "bad-ref", statement: "Unsupported summary.", evidenceRefs: ["missing"], caveats: ["none"],
      originality: { status: "passed", checkedAgainstEvidenceRefs: ["missing"], note: "checked", checkedBy: "Muxin", checkedAt: "2026-08-22T00:00:00.000Z", method: "source comparison" },
    }],
  })), /unknown evidence/i);

  assert.throws(() => buildResearchDossier(input({
    summaries: [{
      id: "pending", statement: "Pending summary.", evidenceRefs: ["evidence-a"], caveats: ["none"],
      originality: { status: "pending", checkedAgainstEvidenceRefs: ["evidence-a"], note: "not checked", checkedBy: "Muxin", checkedAt: "2026-08-22T00:00:00.000Z", method: "not run" },
    }],
  })), /originality/i);

  const missingReviewAuthority = input();
  delete (missingReviewAuthority.evidence[0] as Partial<(typeof missingReviewAuthority.evidence)[number]>).reviewedBy;
  assert.throws(() => buildResearchDossier(missingReviewAuthority), /reviewedBy/i);

  const missingOriginalityMethod = input();
  delete (missingOriginalityMethod.summaries[0]!.originality as Partial<(typeof missingOriginalityMethod.summaries)[number]["originality"]>).method;
  assert.throws(() => buildResearchDossier(missingOriginalityMethod), /originality.*method/i);

  assert.throws(() => buildResearchDossier(input({
    summaries: [{
      id: "orphan-b", statement: "Only one row supports this summary.", evidenceRefs: ["evidence-a"],
      caveats: ["bounded"], originality: { status: "passed", checkedAgainstEvidenceRefs: ["evidence-a"],
        note: "No creator wording.", checkedBy: "Muxin", checkedAt: "2026-08-22T00:00:00.000Z", method: "Source comparison." },
    }],
  })), /included evidence evidence-b.*summary/i);

  const duplicateBaseline = input();
  duplicateBaseline.baselines.push({ ...duplicateBaseline.baselines[0]! });
  assert.throws(() => buildResearchDossier(duplicateBaseline), /duplicate baseline/i);

  const unsafeCitation = input();
  unsafeCitation.evidence[0]!.evidenceLinks = ["javascript:alert(1)"];
  assert.throws(() => buildResearchDossier(unsafeCitation), /evidenceLinks.*https/i);

  assert.throws(() => buildResearchDossier({ ...input(), body: "private creator body" } as unknown as ResearchDossierInput), /unsupported.*body|body.*unsupported/i);
});

test("only an explicit Muxin decision makes a dossier usable and decisions are immutable", () => {
  const unreceipted = buildResearchDossier(input());
  assert.throws(() => recordResearchDossierDecision(unreceipted, {
    decidedBy: "Muxin", decidedAt: "2026-08-30T18:00:00Z", disposition: "hypothesis",
    note: "This must not bypass evidence review.", dossierDigest: unreceipted.digest,
  }), /evidence review.*required|receipt.*required/i);

  const api = researchDossierApi as unknown as { buildResearchDossierReviewPacket(value: unknown): { digest: string; proposal: { evidence: Array<{ id: string }>; baselines: Array<{ id: string }>; summaries: Array<{ id: string }> } } };
  const packet = api.buildResearchDossierReviewPacket(pendingProposal());
  const forged = structuredClone(unreceipted) as unknown as Record<string, unknown> & { evidenceReviewPacket: unknown; evidenceReview: unknown };
  forged.evidenceReviewPacket = packet;
  forged.evidenceReview = {
    reviewedBy: "Muxin", reviewedAt: "2026-08-30T17:00:00Z", packetDigest: packet.digest,
    policyApproved: true,
    evidenceApprovals: packet.proposal.evidence.map((row) => row.id),
    baselineApprovals: packet.proposal.baselines.map((row) => row.id),
    originalityApprovals: packet.proposal.summaries.map((row) => row.id), note: "Forged receipt.",
  };
  rehashDossierForTest(forged);
  assert.throws(() => recordResearchDossierDecision(forged as unknown as ReturnType<typeof buildResearchDossier>, {
    decidedBy: "Muxin", decidedAt: "2026-08-30T18:00:00Z", disposition: "hypothesis",
    note: "This must not pass.", dossierDigest: forged.digest as string,
  }), /canonical|packet|receipt|review/i);

  const dossier = evidenceReviewedDossier();
  assert.throws(() => recordResearchDossierDecision(dossier, {
    decidedBy: "editor",
    decidedAt: "2026-08-30T18:00:00Z",
    disposition: "observation",
    note: "Looks usable.",
    dossierDigest: dossier.digest,
  } as unknown as ResearchDossierDecision), /Muxin/i);

  const decided = recordResearchDossierDecision(dossier, {
    decidedBy: "Muxin",
    decidedAt: "2026-08-30T18:00:00Z",
    disposition: "hypothesis",
    note: "Use this as a bounded hypothesis, not a general rule.",
    dossierDigest: dossier.digest,
  });
  assert.equal(decided.readiness.status, "usable");
  assert.equal(decided.usabilityDecision?.disposition, "hypothesis");
  assert.throws(() => recordResearchDossierDecision(decided, {
    decidedBy: "Muxin", decidedAt: "2026-08-30T19:00:00Z", disposition: "reject", note: "changed", dossierDigest: dossier.digest,
  }), /already has.*decision/i);

  const revise = recordResearchDossierDecision(dossier, {
    decidedBy: "Muxin", decidedAt: "2026-08-30T18:00:00Z", disposition: "revise", note: "Add a larger sample.", dossierDigest: dossier.digest,
  });
  assert.equal(revise.readiness.status, "revision_requested");

  const tampered = JSON.parse(JSON.stringify(dossier));
  tampered.summaries[0].statement = "Changed after review.";
  assert.throws(() => recordResearchDossierDecision(tampered, {
    decidedBy: "Muxin", decidedAt: "2026-08-30T18:00:00Z", disposition: "observation",
    note: "Use it.", dossierDigest: dossier.digest,
  }), /digest|tamper|canonical/i);

  const bodyBearing = JSON.parse(JSON.stringify(dossier));
  bodyBearing.body = "PRIVATE CREATOR BODY";
  assert.throws(() => recordResearchDossierDecision(bodyBearing, {
    decidedBy: "Muxin", decidedAt: "2026-08-30T18:00:00Z", disposition: "observation",
    note: "Use it.", dossierDigest: dossier.digest,
  }), /unknown field.*body|unsupported.*body/i);

  const nestedLeak = JSON.parse(JSON.stringify(dossier));
  nestedLeak.question.privateContent = "PRIVATE CREATOR BODY";
  assert.throws(() => recordResearchDossierDecision(nestedLeak, {
    decidedBy: "Muxin", decidedAt: "2026-08-30T18:00:00Z", disposition: "observation",
    note: "Use it.", dossierDigest: dossier.digest,
  }), /unknown field.*privateContent/i);

  const typeConfused = JSON.parse(JSON.stringify(dossier));
  typeConfused.summaries[0].statement = { privateContent: "PRIVATE CREATOR BODY" };
  assert.throws(() => recordResearchDossierDecision(typeConfused, {
    decidedBy: "Muxin", decidedAt: "2026-08-30T18:00:00Z", disposition: "observation",
    note: "Use it.", dossierDigest: dossier.digest,
  }), /statement.*string|canonical/i);
});
