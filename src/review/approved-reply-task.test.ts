import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assessApprovedReplyTaskReadiness,
  normalizeApprovedReplyTask,
  type ApprovedReplyTaskInput,
} from "./approved-reply-task.js";

const lineage = [
  { record_type: "variant", id: "variant-1", relation: "published-as" },
  { record_type: "comment_observation", id: "comment-1", relation: "responds-to" },
];

function input(overrides: Record<string, unknown> = {}): ApprovedReplyTaskInput {
  return {
    id: "reply-task-1",
    commentObservationId: "comment-1",
    draftText: "  Thanks for naming this. I will look into it.\n",
    replyPurpose: "acknowledge the specific question",
    claimRefs: ["claim:reply", "claim:reply"],
    targetPlatform: "Substack",
    humanDecision: "pending",
    decidedBy: null,
    decidedAt: null,
    deliveryStatus: "not_sent",
    sentAt: null,
    lineage,
    status: "pending",
    ...overrides,
  };
}

test("pending replies remain reviewable and blocked from delivery", () => {
  const normalized = normalizeApprovedReplyTask(input());

  assert.equal(normalized.kind, "approved_reply_task");
  assert.equal(normalized.humanDecision, "pending");
  assert.equal(normalized.status, "pending");
  assert.equal(normalized.readiness.status, "blocked");
  assert.deepEqual(normalized.readiness.blockers, ["human decision is pending"]);
  assert.equal(normalized.sideEffects, "none");
});

test("an approved reply has a ready, unsent task state and keeps its draft text", () => {
  const draftText = "  Keep this exact reviewable artifact.\n";
  const normalized = normalizeApprovedReplyTask(input({
    draftText,
    humanDecision: "approve",
    decidedBy: " muxin ",
    decidedAt: "2026-08-24T12:00:00-05:00",
    status: "approved",
  }));

  assert.equal(normalized.draftText, draftText);
  assert.equal(normalized.humanDecision, "approve");
  assert.equal(normalized.decidedBy, "muxin");
  assert.equal(normalized.decidedAt, "2026-08-24T17:00:00.000Z");
  assert.equal(normalized.deliveryStatus, "not_sent");
  assert.equal(normalized.sentAt, null);
  assert.equal(normalized.status, "approved");
  assert.deepEqual(normalized.readiness, { status: "ready", blockers: [] });
});

test("a declined reply is retained as a review record but cannot be delivered", () => {
  const {
    commentObservationId: _commentObservationId,
    draftText: _draftText,
    replyPurpose: _replyPurpose,
    claimRefs: _claimRefs,
    targetPlatform: _targetPlatform,
    humanDecision: _humanDecision,
    decidedBy: _decidedBy,
    decidedAt: _decidedAt,
    deliveryStatus: _deliveryStatus,
    sentAt: _sentAt,
    ...snakeBase
  } = input();
  const normalized = normalizeApprovedReplyTask({
    ...snakeBase,
    comment_observation_id: " comment-1 ",
    draft_text: "A declined draft is still auditable.",
    reply_purpose: "declined response",
    claim_refs: ["claim:one"],
    target_platform: "x",
    human_decision: "decline",
    decided_by: "muxin",
    decided_at: "2026-08-24T18:00:00Z",
    delivery_status: "not_sent",
    sent_at: null,
    lineage: [
      { record_type: "comment_observation", id: "comment-1", relation: "responds-to" },
    ],
    status: "declined",
  });

  assert.equal(normalized.humanDecision, "decline");
  assert.equal(normalized.status, "declined");
  assert.equal(normalized.deliveryStatus, "not_sent");
  assert.equal(normalized.readiness.status, "blocked");
  assert.deepEqual(normalized.readiness.blockers, ["human decision is declined"]);
});

test("sent delivery fails closed without explicit human approval and decision", () => {
  assert.throws(
    () => normalizeApprovedReplyTask(input({
      humanDecision: "pending",
      deliveryStatus: "sent",
      sentAt: "2026-08-24T19:00:00Z",
      status: "sent",
    })),
    /sent delivery requires explicit human approval/i,
  );

  assert.throws(
    () => normalizeApprovedReplyTask(input({
      humanDecision: "approve",
      decidedBy: null,
      decidedAt: null,
      deliveryStatus: "sent",
      sentAt: "2026-08-24T19:00:00Z",
      status: "sent",
    })),
    /explicit human approval.*decision|decidedBy|decidedAt/i,
  );
});

test("snake and camel aliases normalize deterministically without mutating input", () => {
  const firstInput = {
    id: " reply-task-2 ",
    comment_observation_id: " comment-2 ",
    draft_text: "A preserved draft.",
    reply_purpose: "answer the question",
    claim_refs: ["claim:z", " claim:a ", "claim:z"],
    target_platform: " Bluesky ",
    human_decision: "approve",
    decided_by: "muxin",
    decided_at: "2026-08-24T20:00:00-05:00",
    delivery_status: "sent",
    sent_at: "2026-08-24T21:00:00-05:00",
    lineage: [
      { record_type: "source", id: "source-2", relation: null },
      { record_type: "comment_observation", id: "comment-2", relation: "responds-to" },
      { record_type: "source", id: "source-2", relation: null },
    ],
    status: "sent",
  } satisfies ApprovedReplyTaskInput;
  const before = structuredClone(firstInput);

  const first = normalizeApprovedReplyTask(firstInput);
  const second = normalizeApprovedReplyTask(firstInput);

  assert.deepEqual(first, second);
  assert.deepEqual(firstInput, before);
  assert.equal(first.id, "reply-task-2");
  assert.equal(first.commentObservationId, "comment-2");
  assert.deepEqual(first.claimRefs, ["claim:a", "claim:z"]);
  assert.deepEqual(first.lineage, [
    { recordType: "comment_observation", id: "comment-2", relation: "responds-to" },
    { recordType: "source", id: "source-2", relation: null },
  ]);
  assert.equal(first.decidedAt, "2026-08-25T01:00:00.000Z");
  assert.equal(first.sentAt, "2026-08-25T02:00:00.000Z");
  assert.equal(first.status, "sent");
  assert.deepEqual(first.readiness, { status: "ready", blockers: [] });
});

test("invalid refs and timestamps are rejected", () => {
  assert.throws(() => normalizeApprovedReplyTask(input({ claimRefs: [" "] })), /claimRefs\[0\].*required/i);
  assert.throws(() => normalizeApprovedReplyTask(input({ lineage: [{ record_type: "source", id: " ", relation: null }] })), /lineage\[0\].*id.*required/i);
  assert.throws(() => normalizeApprovedReplyTask(input({
    humanDecision: "approve",
    decidedBy: "muxin",
    decidedAt: "not-a-timestamp",
    status: "approved",
  })), /decidedAt.*valid timestamp/i);
});

test("normalization never sends, publishes, writes, or includes source comment body", () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error("send should not happen");
  }) as typeof fetch;

  try {
    const normalized = normalizeApprovedReplyTask({
      ...input({ humanDecision: "approve", decidedBy: "muxin", decidedAt: "2026-08-24T12:00:00Z", status: "approved" }),
      source_comment_body: "PRIVATE SOURCE COMMENT BODY MUST NOT LEAK",
    } as ApprovedReplyTaskInput);

    assert.equal(fetchCalls, 0);
    assert.equal(normalized.sideEffects, "none");
    assert.equal(normalized.autoSend, false);
    assert.equal(normalized.autoPublish, false);
    assert.equal(JSON.stringify(normalized).includes("PRIVATE SOURCE COMMENT BODY MUST NOT LEAK"), false);
    assert.deepEqual(assessApprovedReplyTaskReadiness(normalized), normalized.readiness);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
