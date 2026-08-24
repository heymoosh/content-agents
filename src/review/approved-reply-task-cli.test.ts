import { test } from "node:test";
import assert from "node:assert/strict";
import {
  renderApprovedReplyTaskCli,
  type ApprovedReplyTaskCliIO,
} from "./approved-reply-task-cli.js";

const task = {
  id: "reply-task-1",
  comment_observation_id: "comment-1",
  draft_text: "Thanks for naming this. I will look into it.",
  reply_purpose: "acknowledge the specific question",
  claim_refs: ["claim:reply"],
  target_platform: "Substack",
  human_decision: "approve",
  decided_by: "muxin",
  decided_at: "2026-08-24T12:00:00Z",
  delivery_status: "not_sent",
  sent_at: null,
  lineage: [
    { record_type: "comment_observation", id: "comment-1", relation: "responds-to" },
  ],
  status: "approved",
  source_comment_body: "PRIVATE SOURCE COMMENT BODY MUST NOT LEAK",
};

function io(fileContents = ""): ApprovedReplyTaskCliIO {
  return {
    readFile: () => fileContents,
  };
}

test("JSON input renders a deterministic, body-free JSON projection", () => {
  const first = renderApprovedReplyTaskCli(["--json", JSON.stringify(task), "--format", "json"], io());
  const second = renderApprovedReplyTaskCli(["--json", JSON.stringify(task), "--format", "json"], io());

  assert.equal(first, second);
  assert.equal(first.endsWith("\n"), true);
  assert.equal(first.includes(task.source_comment_body), false);
  assert.deepEqual(JSON.parse(first), {
    kind: "approved_reply_task",
    version: "approved-reply-task-v1",
    id: "reply-task-1",
    commentObservationId: "comment-1",
    draftText: task.draft_text,
    replyPurpose: task.reply_purpose,
    claimRefs: ["claim:reply"],
    targetPlatform: "substack",
    humanDecision: "approve",
    decidedBy: "muxin",
    decidedAt: "2026-08-24T12:00:00.000Z",
    deliveryStatus: "not_sent",
    sentAt: null,
    lineage: [{ recordType: "comment_observation", id: "comment-1", relation: "responds-to" }],
    status: "approved",
    readiness: { status: "ready", blockers: [] },
    autoSend: false,
    autoPublish: false,
    sideEffects: "none",
  });
});
test("file input renders Markdown with status, readiness, refs, and proposed reply", () => {
  const markdown = renderApprovedReplyTaskCli(["--file", "reply.json", "--format", "markdown"], io(JSON.stringify({
    ...task,
    human_decision: "pending",
    decided_by: null,
    decided_at: null,
    status: "pending",
  })));

  assert.match(markdown, /# Approved reply task/);
  assert.match(markdown, /Status: pending/);
  assert.match(markdown, /Readiness: BLOCKED/);
  assert.match(markdown, /human decision is pending/);
  assert.match(markdown, /comment-1/);
  assert.match(markdown, /Thanks for naming this/);
  assert.equal(markdown.includes(task.source_comment_body), false);
});

test("both format is explicit and unsupported or duplicate inputs fail before reading", () => {
  assert.match(renderApprovedReplyTaskCli(["--json", JSON.stringify(task), "--format", "both"], io()), /---\n/);
  assert.throws(() => renderApprovedReplyTaskCli(["--json", "{}", "--file", "x"], io()), /exactly one of --json or --file/);
  assert.throws(() => renderApprovedReplyTaskCli(["--file", "x", "--format", "html"], io()), /format must be json, markdown, or both/);
});

test("Markdown names every lifecycle status without implying delivery", () => {
  const cases = [
    ["pending", "pending", null, null, "pending"],
    ["approve", "approved", "muxin", "2026-08-24T12:00:00Z", "approved"],
    ["decline", "declined", "muxin", "2026-08-24T12:00:00Z", "declined"],
    ["approve", "sent", "muxin", "2026-08-24T12:00:00Z", "sent"],
  ] as const;

  for (const [decision, status, decidedBy, decidedAt, renderedStatus] of cases) {
    const deliveryStatus = status === "sent" ? "sent" : "not_sent";
    const output = renderApprovedReplyTaskCli(["--json", JSON.stringify({
      ...task,
      human_decision: decision,
      decided_by: decidedBy,
      decided_at: decidedAt,
      delivery_status: deliveryStatus,
      sent_at: status === "sent" ? "2026-08-24T13:00:00Z" : null,
      status,
    }), "--format", "markdown"], io());
    assert.match(output, new RegExp(`Status: ${renderedStatus}`));
  }
});
