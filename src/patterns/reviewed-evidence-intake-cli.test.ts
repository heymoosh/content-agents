import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReviewedEvidenceIntakeFromJson,
  main,
  parseReviewedEvidenceIntakeArgs,
  renderReviewedEvidenceIntake,
} from "./reviewed-evidence-intake-cli.js";

const envelope = JSON.stringify({
  accountMetadataRows: [{ currentAccountKey: "x|alpha", disposition: "unmapped", unmappedReason: "review pending" }],
  sourceEvidenceRows: [{ id: "evidence-alpha", body: "unsupported" }],
  baselineSamples: [],
});

const validEnvelope = JSON.stringify({
  accountMetadataRows: [{ currentAccountKey: "x|alpha", disposition: "unmapped", unmappedReason: "review pending" }],
  sourceEvidenceRows: [],
  baselineSamples: [],
});

test("accepts JSON/file input and json, markdown, or both output", () => {
  assert.deepEqual(parseReviewedEvidenceIntakeArgs(["--json", validEnvelope]), {
    source: { kind: "json", value: validEnvelope },
    format: "json",
  });
  assert.deepEqual(parseReviewedEvidenceIntakeArgs(["--file", "intake.json", "--format", "both"]), {
    source: { kind: "file", path: "intake.json" },
    format: "both",
  });
  assert.throws(() => parseReviewedEvidenceIntakeArgs([]), /exactly one of --json or --file is required/);
  assert.throws(() => parseReviewedEvidenceIntakeArgs(["--json", validEnvelope, "--file", "other.json"]), /exactly one/);
  assert.throws(() => parseReviewedEvidenceIntakeArgs(["--json", validEnvelope, "--format", "html"]), /format/);
  assert.throws(() => parseReviewedEvidenceIntakeArgs(["--json", validEnvelope, "--unknown"]), /unknown argument/);
});

test("fails closed for malformed nested envelopes and unsupported body fields before writing", () => {
  assert.throws(() => buildReviewedEvidenceIntakeFromJson(JSON.stringify({
    accountMetadataRows: {}, sourceEvidenceRows: [], baselineSamples: [],
  })), /accountMetadataRows must be an array/);
  assert.throws(() => buildReviewedEvidenceIntakeFromJson(envelope), /body|unsupported/i);
  assert.throws(() => buildReviewedEvidenceIntakeFromJson(JSON.stringify({
    accountMetadataRows: [{ currentAccountKey: "x|alpha", audienceSnapshot: [] }], sourceEvidenceRows: [], baselineSamples: [],
  })), /audienceSnapshot.*object/i);
});

test("renders body-free deterministic output and keeps CLI read-only", () => {
  const report = buildReviewedEvidenceIntakeFromJson(validEnvelope);
  const json = renderReviewedEvidenceIntake(report, "json");
  const markdown = renderReviewedEvidenceIntake(report, "markdown");
  assert.match(json, /reviewed_evidence_intake/);
  assert.match(markdown, /Reviewed evidence intake/);
  assert.doesNotMatch(`${json}${markdown}`, /"body"\s*:|PRIVATE CREATOR BODY|"winner"|"model"|"ranking"/i);
  assert.equal(renderReviewedEvidenceIntake(report, "both"), `${json}\n${markdown}`);
});

test("injects file and output IO and writes nothing on invalid input", () => {
  const writes: string[] = [];
  const errors: string[] = [];
  const paths: string[] = [];
  assert.equal(main(["--file", "/virtual/intake.json", "--format", "markdown"], {
    readFile: (path) => { paths.push(path); return validEnvelope; },
    write: (value) => writes.push(value),
    error: (value) => errors.push(value),
  }), 0);
  assert.deepEqual(paths, ["/virtual/intake.json"]);
  assert.equal(writes.length, 1);
  assert.deepEqual(errors, []);

  const invalidWrites: string[] = [];
  const invalidErrors: string[] = [];
  assert.equal(main(["--json", JSON.stringify({ accountMetadataRows: [], sourceEvidenceRows: "bad", baselineSamples: [] })], {
    write: (value) => invalidWrites.push(value),
    error: (value) => invalidErrors.push(value),
  }), 1);
  assert.deepEqual(invalidWrites, []);
  assert.match(invalidErrors.join(""), /patterns:reviewed-evidence-intake/);
});
