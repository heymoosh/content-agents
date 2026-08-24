import { test } from "node:test";
import assert from "node:assert/strict";
import { main, parseReviewSessionArgs, parseReviewSessionInput } from "./review-session-cli.js";

const batch = { kind: "account_review_queue_batch", version: "account-review-batch-v1", rows: [], humanReviewRequiredRows: 0 };

test("accepts explicit JSON and renders a review session", () => {
  const result = parseReviewSessionInput(JSON.stringify({ batch }));
  assert.equal(result.kind, "review_session");
  assert.equal(result.humanReviewRequired, false);
  assert.equal(parseReviewSessionArgs(["--json", JSON.stringify({ batch }), "--format", "markdown"]).format, "markdown");
});

test("fails closed on malformed input and reports through the CLI", () => {
  assert.throws(() => parseReviewSessionInput("[]"), /object/);
  let error = "";
  assert.equal(main(["--json", "{}"], { error: (value) => { error = value; } }), 1);
  assert.match(error, /patterns:review-session/);
});

test("keeps pending and unmapped actions explicit", () => {
  for (const [status, expected] of [["pending", "review the required account metadata fields"], ["unmapped", "map the account or record an explicit unmapped disposition"]] as const) {
    const result = parseReviewSessionInput(JSON.stringify({ batch: { kind: "account_review_queue_batch", version: "account-review-batch-v1", rows: [{ currentAccountKey: "reddit|r/test", platform: "reddit", handle: "r/test", evidenceCount: 0, status, missingRequiredOverlayFields: ["topics"], nextReviewAction: "next" }], humanReviewRequiredRows: 1 } }));
    assert.equal(result.rows[0].humanAction, expected);
  }
});
