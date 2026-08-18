import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchSubstackReplyTree, ReplyTreeError, type ReplyHttpResponse } from "./replies.js";

function response(body: unknown, status = 200): ReplyHttpResponse {
  return {
    ok: () => status >= 200 && status < 300,
    status: () => status,
    json: async () => body,
  };
}

function context(pages: unknown[], statuses: number[] = []) {
  let calls = 0;
  return {
    calls: () => calls,
    request: {
      get: async () => {
        const index = calls++;
        return response(pages[Math.min(index, pages.length - 1)], statuses[index] ?? 200);
      },
    },
  };
}

function page(branches: unknown[], nextCursor?: string, moreBranches = 0) {
  return { commentBranches: branches, moreBranches, nextCursor };
}

test("reply walk keeps top-level branch count separate from flattened nested observation count", async () => {
  const fake = context([
    page([
      {
        comment: { id: 10, user_id: 1, body: "root", date: "2026-08-01T00:00:00Z" },
        descendantComments: [
          { id: 11, user_id: 2, body: "child", ancestor_path: "10" },
          { id: 12, user_id: 3, body: "grandchild", ancestor_path: "10/11" },
        ],
      },
      { comment: { id: 20, user_id: 4, body: "second" }, descendantComments: [{ id: 21, user_id: 5, body: "reply", ancestor_path: "20" }] },
    ], "opaque-next"),
    page([{ comment: { id: 30, user_id: 6, body: "third" }, descendantComments: [{ id: 31, user_id: 7, body: "reply", ancestor_path: "30" }] }]),
  ]);

  const capture = await fetchSubstackReplyTree("c-123", fake);

  assert.equal(fake.calls(), 2);
  assert.equal(capture.replyBranchCountCaptured, 3);
  assert.equal(capture.replyObservationCountCaptured, 7);
  assert.equal(capture.flattenedReplies.find((reply) => reply.replyId === "12")?.parentReplyId, "11");
  assert.equal(capture.flattenedReplies.find((reply) => reply.replyId === "10")?.parentReplyId, null);
});

test("reply walk unwraps the nested comment envelope used by live descendant payloads", async () => {
  const fake = context([
    page([
      {
        comment: { id: 10, user_id: 1, body: "root" },
        descendantComments: [
          { type: "comment", comment: { id: 11, user_id: 2, body: "wrapped child", ancestor_path: "10" } },
        ],
      },
    ]),
  ]);

  const capture = await fetchSubstackReplyTree("c-123", fake);

  assert.equal(capture.replyBranchCountCaptured, 1);
  assert.equal(capture.replyObservationCountCaptured, 2);
  assert.equal(capture.flattenedReplies.find((reply) => reply.replyId === "11")?.parentReplyId, "10");
});

test("repeated cursor fails loudly instead of looping", async () => {
  const fake = context([
    page([{ comment: { id: 1, body: "one" } }], "cursor-a"),
    page([{ comment: { id: 2, body: "two" } }], "cursor-a"),
  ]);

  await assert.rejects(
    () => fetchSubstackReplyTree("c-123", fake),
    (error: unknown) => error instanceof ReplyTreeError && error.kind === "REPEATED_CURSOR"
  );
  assert.equal(fake.calls(), 2);
});

test("a page with zero new ids and a next cursor is a hard failure", async () => {
  const fake = context([
    page([{ comment: { id: 1, body: "one" } }], "cursor-a"),
    page([], "cursor-b"),
  ]);

  await assert.rejects(
    () => fetchSubstackReplyTree("c-123", fake),
    (error: unknown) => error instanceof ReplyTreeError && error.kind === "ZERO_NEW_IDS"
  );
});

test("page-cap exhaustion and 403 are not represented as complete captures", async () => {
  const capped = context([page([{ comment: { id: 1, body: "one" } }], "cursor-a")]);
  await assert.rejects(
    () => fetchSubstackReplyTree("c-123", capped, { pageCap: 1 }),
    (error: unknown) => error instanceof ReplyTreeError && error.kind === "PAGE_CAP"
  );

  const forbidden = context([page([], undefined)], [403]);
  await assert.rejects(
    () => fetchSubstackReplyTree("c-123", forbidden),
    (error: unknown) => error instanceof ReplyTreeError && error.kind === "FORBIDDEN"
  );
});
