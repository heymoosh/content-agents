import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir, tmpdir } from "node:os";
import {
  appendReviewComment, appendReviewCommentSafe, charlesReviewSubject, fictionReviewSubject, listReviewComments,
  listReviewCommentsSafe, listReviewCommentsWithHealth, REVIEW_COMMENTS_PATH,
} from "./review-comments.js";
test("review comments preserve the legacy default when no isolated data root is configured", () => {
  assert.equal(REVIEW_COMMENTS_PATH, join(homedir(), ".content-agents", "review-comments.jsonl"));
});

test("review subjects are stable and reject invalid resource identities", () => {
  assert.equal(fictionReviewSubject("the-least-of-us", 3), "the-least-of-us:chapter-3");
  assert.equal(charlesReviewSubject("one-liner-1"), "one-liner-1");
  assert.throws(() => fictionReviewSubject("", 3), /series/);
  assert.throws(() => fictionReviewSubject("series", 0), /chapter/);
  assert.throws(() => charlesReviewSubject(" "), /draft id/);
});

test("review comments append durably and read back oldest first per subject", () => {
  const root = mkdtempSync(join(tmpdir(), "review-comments-"));
  const path = join(root, "comments.jsonl");
  try {
    appendReviewComment({ domain: "fiction", subject: "series:chapter-1", body: "More tension here." }, path);
    appendReviewComment({ domain: "charles", subject: "draft-1", body: "Sharper walk-back." }, path);
    appendReviewComment({ domain: "fiction", subject: "series:chapter-1", body: "Keep the final sentence." }, path);
    assert.deepEqual(listReviewComments("fiction", "series:chapter-1", path).map((item) => item.body), [
      "More tension here.", "Keep the final sentence.",
    ]);
    assert.equal(readFileSync(path, "utf8").trim().split("\n").length, 3);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a truncated final line never gets fused to the next append", () => {
  const root = mkdtempSync(join(tmpdir(), "review-comments-"));
  const path = join(root, "comments.jsonl");
  try {
    writeFileSync(path, '{"truncated":true}');
    appendReviewComment({ domain: "charles", subject: "draft-1", body: "Try again." }, path);
    const lines = readFileSync(path, "utf8").split("\n");
    assert.equal(lines[0], '{"truncated":true}');
    assert.match(lines[1], /"body":"Try again\."/);
    assert.deepEqual(listReviewComments("charles", "draft-1", path).map((item) => item.body), ["Try again."]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("review comments reject empty or unbounded client fields", () => {
  const root = mkdtempSync(join(tmpdir(), "review-comments-"));
  const path = join(root, "comments.jsonl");
  try {
    assert.throws(() => appendReviewComment({ domain: "fiction", subject: "", body: "note" }, path), /subject/);
    assert.throws(() => appendReviewComment({ domain: "fiction", subject: "chapter", body: "   " }, path), /comment/);
    assert.throws(() => appendReviewComment({ domain: "fiction", subject: "chapter", body: "x".repeat(5001) }, path), /too long/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("an operation id makes a repeated primary action idempotent in review history", () => {
  const root = mkdtempSync(join(tmpdir(), "review-comments-"));
  const path = join(root, "comments.jsonl");
  try {
    const input = { domain: "fiction" as const, subject: "series:chapter-1", body: "Tighter ending.", operationId: "job-8" };
    const first = appendReviewComment(input, path);
    const second = appendReviewComment(input, path);
    assert.equal(second.id, first.id);
    assert.equal(listReviewComments("fiction", input.subject, path).length, 1);
    assert.throws(() => appendReviewComment({ ...input, body: "Different request." }, path), /different text/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("safe history writes report a warning without turning a completed primary action into a failure", () => {
  const root = mkdtempSync(join(tmpdir(), "review-comments-"));
  try {
    const result = appendReviewCommentSafe(
      { domain: "charles", subject: "draft-1", body: "Sharper opening." },
      root,
    );
    assert.equal(result.comment, null);
    assert.match(result.warning ?? "", /history/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("safe history reads distinguish a healthy empty file from an unavailable store", () => {
  const root = mkdtempSync(join(tmpdir(), "review-comments-"));
  try {
    const missing = join(root, "missing.jsonl");
    assert.deepEqual(listReviewCommentsWithHealth("charles", "draft-1", missing), { comments: [] });
    const unavailable = listReviewCommentsWithHealth("charles", "draft-1", root);
    assert.deepEqual(unavailable.comments, []);
    assert.match(unavailable.warning ?? "", /Review history is unavailable/);
    assert.deepEqual(listReviewCommentsSafe("charles", "draft-1", root), [], "legacy callers retain the safe empty-array contract");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
