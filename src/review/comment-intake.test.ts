import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assessCommentIntakeReadiness,
  normalizeCommentIntake,
  type CommentIntakeInput,
} from "./comment-intake.js";
import { buildCommentLearningView } from "../grow/comment-learning.js";

const lineage = {
  sourceId: "source-1",
  variantId: "variant-1",
  experimentId: "experiment-1",
};

function input(overrides: Partial<CommentIntakeInput> = {}): CommentIntakeInput {
  return {
    id: "comment-record-1",
    contentItemId: "content-item-1",
    lineage,
    commentId: "platform-comment-1",
    platform: "substack",
    surface: "essay",
    comment: {
      text: "A commenter’s private body should not be copied into a summary.",
      redactionRequested: false,
    },
    observedAt: "2026-08-23T12:00:00Z",
    sourceNoteRef: "note:manual-1",
    evidenceRefs: ["evidence:2", "evidence:1", "evidence:2"],
    moderation: { status: "reviewed", note: "Manually checked" },
    consent: { status: "public_context", note: null },
    ...overrides,
  };
}

test("normalization is deterministic and produces a learning-packet-shaped observation", () => {
  const first = normalizeCommentIntake(input({
    lineage: { sourceId: " source-1 ", variantId: "variant-1", experimentId: "experiment-1" },
    platform: " Substack ",
    observedAt: "2026-08-23T12:00:00-00:00",
  }));
  const second = normalizeCommentIntake(input({
    lineage: { sourceId: " source-1 ", variantId: "variant-1", experimentId: "experiment-1" },
    platform: " Substack ",
    observedAt: "2026-08-23T12:00:00-00:00",
  }));

  assert.deepEqual(first, second);
  assert.equal(first.kind, "comment_observation_intake");
  assert.equal(first.contentItemId, "content-item-1");
  assert.deepEqual(first.lineage, lineage);
  assert.deepEqual(first.commentObservation.evidence.refs, ["evidence:1", "evidence:2", "note:manual-1"]);
  assert.equal(first.commentObservation.observation.sourcePlatform, "substack");
  assert.equal(first.commentObservation.observation.observedAt, "2026-08-23T12:00:00.000Z");
  assert.equal(first.commentObservation.qualification.status, "uncertain");
  assert.equal(first.commentObservation.interpretation.willingnessToPay, "not_proven_by_comment");
  assert.equal(first.summary.autoClaimsDemand, false);
  assert.equal(first.summary.productIdea, null);
});

test("missing content lineage and evidence refs produce explicit blockers", () => {
  const candidate = input({
    contentItemId: " ",
    lineage: { sourceId: "", variantId: "variant-1", experimentId: null as unknown as string },
    sourceNoteRef: " ",
    evidenceRefs: [],
  });

  const readiness = assessCommentIntakeReadiness(candidate);

  assert.equal(readiness.status, "blocked");
  assert.deepEqual(readiness.blockers, [
    "content item reference is required",
    "source, variant, and experiment lineage references are required",
    "source note reference is required",
    "at least one evidence reference is required",
  ]);
  assert.throws(() => normalizeCommentIntake(candidate), /content item reference is required/);
});

test("redaction replaces raw comment text everywhere in the derived intake output", () => {
  const raw = "The commenter included a private phone number 555-0100.";
  const redacted = "[private contact detail removed]";
  const normalized = normalizeCommentIntake(input({
    comment: { text: raw, redactedText: redacted, redactionRequested: true },
  }));
  const serialized = JSON.stringify(normalized);
  const serializedSummary = JSON.stringify(normalized.summary);

  assert.equal(normalized.commentObservation.observation.text, redacted);
  assert.equal(normalized.summary.text, null);
  assert.equal(serialized.includes(raw), false);
  assert.equal(serializedSummary.includes(redacted), false, "derived summary must not echo the redacted body either");
});

test("unreviewed moderation or unresolved consent blocks readiness", () => {
  const readiness = assessCommentIntakeReadiness(input({
    moderation: { status: "not_reviewed" },
    consent: { status: "unknown" },
  }));

  assert.equal(readiness.status, "blocked");
  assert.deepEqual(readiness.blockers, [
    "moderation posture is not reviewed",
    "consent posture is unresolved",
  ]);
});

test("withheld consent blocks readiness and canonical learning validation remains available", () => {
  const candidate = input({ consent: { status: "withheld" } });
  assert.deepEqual(assessCommentIntakeReadiness(candidate).blockers, ["consent posture is unresolved"]);
  assert.throws(() => normalizeCommentIntake(candidate), /consent posture is unresolved/);

  const normalized = normalizeCommentIntake(input());
  const learning = buildCommentLearningView({
    commentObservations: [normalized.commentObservation],
    funnelEvents: [],
    businessOutcomes: [],
    muxinDecision: "pending",
  });
  assert.equal(learning.hypotheses[0]?.qualification, "uncertain");
  assert.equal(learning.hypotheses[0]?.signal, "comment");
});

test("intake is pure and declares no provider, publish, reply, or Venture side effects", () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error("provider call should not happen");
  }) as typeof fetch;
  const candidate = input();
  const before = JSON.stringify(candidate);

  try {
    const normalized = normalizeCommentIntake(candidate);
    assert.equal(fetchCalls, 0);
    assert.equal(JSON.stringify(candidate), before);
    assert.equal(normalized.sideEffects, "none");
    assert.equal(normalized.summary.ventureArtifacts, false);
    assert.equal(normalized.summary.publish, false);
    assert.equal(normalized.summary.reply, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
