import { test } from "node:test";
import assert from "node:assert/strict";

import { main, parseReviewStagingArgs, parseReviewStagingInput } from "./review-staging-cli.js";
import { REVIEW_STAGING_APPROVED_KEYS } from "./review-staging.js";

function raw(): string {
  return JSON.stringify({ accountMetadataRows: REVIEW_STAGING_APPROVED_KEYS.map((currentAccountKey) => ({ currentAccountKey, platform: currentAccountKey.split("|")[0], handle: currentAccountKey.split("|")[1], evidenceCount: 1 })) });
}

test("CLI accepts explicit JSON and renders JSON or Markdown", () => {
  const artifact = parseReviewStagingInput(raw());
  assert.equal(artifact.rows.length, 65);
  assert.equal(parseReviewStagingArgs(["--json", raw(), "--format", "markdown"]).format, "markdown");
  let output = "";
  assert.equal(main(["--json", raw(), "--format", "markdown"], { write: (value) => { output = value; } }), 0);
  assert.match(output, /Pattern review staging/);
  assert.doesNotMatch(output, /PRIVATE|selected winner/i);
});

test("CLI fails closed and reports the semantic lock prefix", () => {
  let error = "";
  assert.equal(main(["--json", JSON.stringify({ accountMetadataRows: [{ currentAccountKey: "x|bad", platform: "x", evidenceCount: 1, body: "PRIVATE" }] })], { error: (value) => { error = value; } }), 1);
  assert.match(error, /patterns:review-staging/);
  assert.throws(() => parseReviewStagingArgs([]), /one of --json or --input/);
});

test("CLI rejects competing source identity envelopes", () => {
  const value = { accountMetadataRows: JSON.parse(raw()).accountMetadataRows, source: { cohortSize: 65 }, sourceProjection: { cohortSize: 64 } };
  assert.throws(() => parseReviewStagingInput(JSON.stringify(value)), /ambiguous source identity field cohortSize/);
});
