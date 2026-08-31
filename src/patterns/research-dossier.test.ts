import assert from "node:assert/strict";
import test from "node:test";

import {
  buildResearchDossier,
  recordResearchDossierDecision,
  type ResearchDossierDecision,
  type ResearchDossierInput,
} from "./research-dossier.js";

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

test("builds a deterministic, body-free, question-scoped dossier that remains pending human judgment", () => {
  const dossier = buildResearchDossier(input());

  assert.equal(dossier.kind, "research_dossier");
  assert.equal(dossier.version, "research-dossier-v1");
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
  const dossier = buildResearchDossier(input());
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
  }), /digest|tamper/i);

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
