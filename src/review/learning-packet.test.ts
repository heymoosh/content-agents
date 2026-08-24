import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assessVentureHandoff,
  buildBlueprintLearningPacket,
  buildBusinessOutcome,
  buildCommentObservation,
  buildFunnelEvent,
  buildVentureInputProposal,
  type BlueprintLineage,
  type Evidence,
} from "./learning-packet.js";

const lineage: BlueprintLineage = {
  sourceId: "source-essay-01",
  variantId: "variant-b",
  experimentId: "experiment-hook-01",
};

const observedEvidence: Evidence = {
  status: "observed",
  refs: ["substack:comment:c-01"],
  note: null,
};

const verifiedEvidence: Evidence = {
  status: "verified",
  refs: ["analytics:funnel:2026-08-20"],
  note: null,
};

function comment(id: string, over: Record<string, unknown> = {}) {
  return buildCommentObservation({
    id,
    lineage,
    observation: {
      sourcePlatform: "substack",
      surface: "essay",
      commentId: id,
      observedAt: "2026-08-20T12:00:00.000Z",
      text: "This is exactly the problem I keep running into.",
    },
    qualification: {
      status: "qualified",
      basis: "Names a concrete problem and asks for a specific next step.",
    },
    interpretation: {
      summary: "The comment supports problem resonance.",
      confidence: "medium",
    },
    evidence: observedEvidence,
    caveats: ["One public comment is not a demand sample."],
    ...over,
  });
}

function funnelEvent(id: string, over: Record<string, unknown> = {}) {
  return buildFunnelEvent({
    id,
    lineage,
    observation: {
      eventType: "opt_in",
      occurredAt: "2026-08-20T13:00:00.000Z",
      source: "tracked-form",
      value: 1,
    },
    interpretation: {
      summary: "The visitor opted into the lead magnet.",
      confidence: "high",
    },
    evidence: verifiedEvidence,
    caveats: [],
    ...over,
  });
}

function outcome(id: string, over: Record<string, unknown> = {}) {
  return buildBusinessOutcome({
    id,
    lineage,
    observation: {
      outcomeType: "purchase",
      occurredAt: "2026-08-20T14:00:00.000Z",
      source: "checkout",
      amount: 49,
      currency: "USD",
    },
    interpretation: {
      summary: "A purchase is direct business evidence for this offer.",
      confidence: "high",
    },
    evidence: verifiedEvidence,
    caveats: ["One purchase does not establish repeatability."],
    ...over,
  });
}

function proposal(over: Record<string, unknown> = {}) {
  return buildVentureInputProposal({
    id: "proposal-01",
    lineage,
    observation: {
      basisRecordIds: ["c-01", "fe-01", "bo-01"],
      factualSummary: "The post produced one qualified comment, one opt-in, and one purchase.",
    },
    interpretation: {
      proposedInput: "Test a small paid product around the named problem.",
      rationale: "The observed purchase is stronger than comment resonance alone, but the sample is tiny.",
      confidence: "medium",
    },
    caveats: ["This is a proposal for a next test, not proof of market size."],
    evidence: verifiedEvidence,
    muxinDecision: "pending",
    ventureGate: "blocked",
    ...over,
  });
}

test("comment observations keep facts, qualification, interpretation, caveats, and lineage distinct", () => {
  const built = comment("c-01");

  assert.equal(built.kind, "comment_observation");
  assert.deepEqual(built.lineage, lineage);
  assert.equal(built.observation.text, "This is exactly the problem I keep running into.");
  assert.equal(built.qualification.status, "qualified");
  assert.match(built.qualification.basis, /concrete problem/);
  assert.equal(built.interpretation.summary, "The comment supports problem resonance.");
  assert.equal(built.evidence.status, "observed");
  assert.deepEqual(built.caveats, ["One public comment is not a demand sample."]);
  assert.equal(built.interpretation.willingnessToPay, "not_proven_by_comment");
  assert.equal("qualification" in built.observation, false);
  assert.equal("summary" in built.observation, false);
});
test("a comment never proves willingness to pay, even when its words say someone would buy", () => {
  const built = comment("c-02", {
    observation: {
      sourcePlatform: "substack",
      surface: "essay",
      commentId: "c-02",
      observedAt: "2026-08-20T12:00:00.000Z",
      text: "I would pay for this tomorrow.",
    },
  });

  assert.equal(built.interpretation.willingnessToPay, "not_proven_by_comment");
  assert.throws(
    () =>
      buildCommentObservation({
        ...built,
        interpretation: {
          summary: "The commenter says they would buy.",
          confidence: "high",
          willingnessToPay: "proven",
        },
      } as never),
    /comment.*not prove willingness to pay/i,
  );
});

test("the packet preserves lineage across comments, funnel events, outcomes, and the proposal", () => {
  const built = buildBlueprintLearningPacket({
    blueprint: {
      id: " blueprint-01 ",
      publishedAt: "2026-08-20T11:00:00.000Z",
      lineage,
    },
    commentObservations: [comment("c-02"), comment("c-01")],
    funnelEvents: [funnelEvent("fe-02"), funnelEvent("fe-01")],
    businessOutcomes: [outcome("bo-02"), outcome("bo-01")],
    ventureInputProposal: proposal({ muxinDecision: "adopted", ventureGate: "accepted" }),
  });

  assert.equal(built.blueprint.id, "blueprint-01");
  assert.deepEqual(built.lineage, lineage);
  assert.deepEqual(built.commentObservations.map((item) => item.id), ["c-01", "c-02"]);
  assert.deepEqual(built.funnelEvents.map((item) => item.id), ["fe-01", "fe-02"]);
  assert.deepEqual(built.businessOutcomes.map((item) => item.id), ["bo-01", "bo-02"]);
  assert.deepEqual(built.commentObservations.map((item) => item.lineage), [lineage, lineage]);
  assert.deepEqual(built.funnelEvents.map((item) => item.lineage), [lineage, lineage]);
  assert.deepEqual(built.businessOutcomes.map((item) => item.lineage), [lineage, lineage]);
  assert.deepEqual(built.ventureInputProposal.lineage, lineage);
  assert.equal(built.ventureInputProposal.muxinDecision, "adopted");
  assert.equal(built.ventureInputProposal.ventureGate, "accepted");
  assert.equal(built.handoff.status, "ready");
});

test("normalization is deterministic and does not invent timestamps or ids", () => {
  const input = {
    blueprint: { id: "  blueprint-02  ", publishedAt: "2026-08-20T11:00:00.000Z", lineage },
    commentObservations: [comment("c-02"), comment("c-01")],
    funnelEvents: [funnelEvent("fe-02"), funnelEvent("fe-01")],
    businessOutcomes: [outcome("bo-02"), outcome("bo-01")],
    ventureInputProposal: proposal({ muxinDecision: "adopted", ventureGate: "ready" }),
  };
  const first = buildBlueprintLearningPacket(input);
  const second = buildBlueprintLearningPacket(input);

  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(first.blueprint.publishedAt, "2026-08-20T11:00:00.000Z");
  assert.equal("createdAt" in first, false);
  assert.equal(first.ventureInputProposal.ventureGate, "ready");
});

test("missing lineage or evidence blocks handoff instead of yielding a false ready state", () => {
  const assessment = assessVentureHandoff({
    lineage: { sourceId: "", variantId: "variant-b", experimentId: null },
    evidence: { status: "missing", refs: [], note: "The source export was not captured." },
    muxinDecision: "adopted",
    ventureGate: "accepted",
  });

  assert.equal(assessment.status, "blocked");
  assert.deepEqual(assessment.blockers, [
    "source, variant, and experiment lineage are required",
    "evidence is missing",
  ]);
  assert.equal(assessment.ventureGate, "blocked");
});

test("Muxin decision and Venture gate are explicit, independent required states", () => {
  assert.equal(proposal().muxinDecision, "pending");
  assert.equal(proposal().ventureGate, "blocked");
  assert.equal(proposal({ muxinDecision: "declined", ventureGate: "rejected" }).muxinDecision, "declined");
  assert.equal(proposal({ muxinDecision: "declined", ventureGate: "rejected" }).ventureGate, "rejected");

  assert.throws(
    () => buildVentureInputProposal({ ...proposal(), muxinDecision: undefined } as never),
    /muxinDecision is required/i,
  );
  assert.throws(
    () => buildVentureInputProposal({ ...proposal(), ventureGate: undefined } as never),
    /ventureGate is required/i,
  );
  assert.throws(
    () => buildVentureInputProposal({ ...proposal(), muxinDecision: "pending", ventureGate: "accepted" } as never),
    /accepted.*adopted|venture gate/i,
  );
});

test("a proposal cannot cite records that are absent from the packet", () => {
  assert.throws(
    () => buildBlueprintLearningPacket({
      blueprint: {
        id: "blueprint-03",
        publishedAt: "2026-08-20T11:00:00.000Z",
        lineage,
      },
      commentObservations: [comment("c-03")],
      funnelEvents: [],
      businessOutcomes: [],
      ventureInputProposal: proposal({
        observation: {
          basisRecordIds: ["missing-record"],
          factualSummary: "This must not hand off.",
        },
        muxinDecision: "adopted",
        ventureGate: "ready",
      }),
    }),
    /missing basis records/i,
  );
});
