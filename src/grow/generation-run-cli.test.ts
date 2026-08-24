import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGenerationRunFromJson,
  main,
  parseGenerationRunArgs,
  renderGenerationRun,
  renderGenerationRunMarkdown,
  type GenerationRunCliIo,
} from "./generation-run-cli.js";

const volumePlan = {
  sourceReference: "essay:attention",
  substanceReference: "substance:attention",
  slots: [{
    platform: "linkedin",
    dayIndex: 0,
    slotIndex: 0,
    variantId: "linkedin-a",
    experimentAssignment: { opening: "question" },
    readiness: "ready",
    blockers: [],
    humanReviewRequired: true,
    humanGate: { required: true, before: "publish", approvalOwner: "human", status: "pending" },
  }],
  humanReviewRequired: true,
  generatesCopy: false,
  sideEffects: "none",
};

const coverage = {
  kind: "grow_treatment_coverage",
  version: "grow-treatment-coverage-v1",
  rows: [],
  unexpectedCandidates: [],
  summary: { requested: 0, matched: 0, missing: 0, duplicate: 0, blocked: 0, unexpected: 0 },
  readiness: { status: "ready", blockers: [] },
  generatesCopy: false,
  creatorBodyCopyAllowed: false,
  sideEffects: "none",
};

const candidate = {
  platform: "linkedin",
  dayIndex: 0,
  slotIndex: 0,
  variantId: "linkedin-a",
  experimentAssignment: { opening: "question" },
  generatedArtifactRef: "artifact:linkedin-a",
  reviewQueueRef: "review:linkedin-a",
  reviewQueueStatus: "pending",
  readiness: { status: "ready", blockers: [] },
};

function envelope(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({ volumePlan, candidates: [candidate], treatmentCoverage: coverage, ...overrides });
}

test("parses one explicit source and the supported output formats", () => {
  assert.deepEqual(parseGenerationRunArgs(["--json", "{}", "--format", "markdown"]), {
    source: { kind: "json-string", value: "{}" },
    format: "markdown",
  });
  assert.deepEqual(parseGenerationRunArgs(["--file", "run.json"]), {
    source: { kind: "file", path: "run.json" },
    format: "json",
  });
  assert.throws(
    () => parseGenerationRunArgs(["--json", "{}", "--json", "{}"]),
    /may only be supplied once/,
  );
  assert.throws(() => parseGenerationRunArgs(["--json", "{}", "--file", "run.json"]), /exactly one/);
  assert.throws(() => parseGenerationRunArgs([]), /exactly one/);
  assert.throws(() => parseGenerationRunArgs(["--json", "{}", "--format", "html"]), /must be json, markdown, or both/);
});

test("builds deterministic body-free output and keeps treatment coverage explicit", () => {
  const first = buildGenerationRunFromJson(envelope());
  const second = buildGenerationRunFromJson(envelope({ candidates: [candidate] }));

  assert.deepEqual(first, second);
  assert.equal(first.readiness.status, "ready");
  assert.deepEqual(first.treatmentCoverage, { supplied: true, status: "ready", blockers: [] });
  assert.equal(first.generatesCopy, false);
  assert.equal(first.creatorBodyCopyAllowed, false);
  assert.equal(first.autoApproval, false);
  assert.equal(first.autoScheduling, false);
  assert.equal(first.autoPublishing, false);
  assert.equal(first.sideEffects, "none");
  assert.doesNotMatch(JSON.stringify(first), /"(?:body|content|assets?|copy)"\s*:/i);

  const markdown = renderGenerationRunMarkdown(first);
  assert.match(markdown, /^# Generation run/m);
  assert.match(markdown, /Treatment coverage: ready/);
  assert.match(markdown, /artifact:linkedin-a/);
  assert.match(markdown, /review:linkedin-a/);
  assert.doesNotMatch(markdown, /creator body text|source body|asset payload/i);
  assert.match(renderGenerationRun(first, "both"), /\n# Generation run/);
});

test("fails closed for malformed JSON envelopes and unsupported body fields", () => {
  assert.throws(() => buildGenerationRunFromJson("not-json"), /valid JSON/);
  assert.throws(() => buildGenerationRunFromJson("[]"), /JSON object envelope/);
  assert.throws(() => buildGenerationRunFromJson(JSON.stringify({ candidates: [] })), /volumePlan is required/);
  assert.throws(() => buildGenerationRunFromJson(JSON.stringify({ volumePlan, candidates: [], body: "forbidden" })), /unsupported field/);
  assert.throws(() => buildGenerationRunFromJson(envelope({
    treatmentCoverage: { ...coverage, readiness: { status: "unknown", blockers: [] } },
  })), /treatment coverage.*status|readiness.*status/);
  assert.throws(() => buildGenerationRunFromJson(envelope({
    candidates: [{ ...candidate, body: "forbidden" }],
  })), /unsupported field/);
});

test("uses injected file and output IO without writing domain state", async () => {
  const reads: string[] = [];
  const writes: string[] = [];
  const errors: string[] = [];
  const io: GenerationRunCliIo = {
    readFile: async (path) => { reads.push(path); return envelope(); },
    write: (value) => { writes.push(value); },
    error: (value) => { errors.push(value); },
  };

  const exitCode = await main(["--file", "run.json", "--format", "markdown"], io);

  assert.equal(exitCode, 0);
  assert.deepEqual(reads, ["run.json"]);
  assert.equal(writes.length, 1);
  assert.match(writes[0] ?? "", /^# Generation run/);
  assert.deepEqual(errors, []);
});

test("reports validation errors through injected error IO", async () => {
  let output = "";
  let error = "";
  const exitCode = await main(["--json", envelope({ body: "forbidden" })], {
    write: (value) => { output += value; },
    error: (value) => { error += value; },
  });

  assert.equal(exitCode, 1);
  assert.equal(output, "");
  assert.match(error, /^grow:generation-run:/);
  assert.match(error, /unsupported field/);
});
