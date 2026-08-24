import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStudioReadinessFromJson,
  main,
  parseStudioReadinessArgs,
  renderStudioReadinessMarkdown,
} from "./studio-readiness-cli.js";

const volumePlan = {
  sourceReference: "source:essay-1",
  substanceReference: "substance:essay-1",
  slots: [{
    platform: "linkedin",
    dayIndex: 0,
    slotIndex: 0,
    variantId: "variant-1",
    experimentAssignment: null,
    readiness: "ready",
    blockers: [],
    humanReviewRequired: true,
    humanGate: { required: true, before: "publish", approvalOwner: "human", status: "pending" },
  }],
  humanReviewRequired: true,
  generatesCopy: false,
  sideEffects: "none",
};

const treatmentCoverage = {
  kind: "grow_treatment_coverage",
  version: "grow-treatment-coverage-v1",
  readiness: { status: "ready", blockers: [] },
  generatesCopy: false,
  creatorBodyCopyAllowed: false,
  sideEffects: "none",
};

const generationRunManifest = {
  coverage: {
    status: "complete",
    expectedVariantIds: ["variant-1"],
    generatedVariantIds: ["variant-1"],
    duplicateVariantIds: [],
    missingVariantIds: [],
  },
  rows: [{ variantId: "variant-1", status: "ready", blockers: [] }],
  humanReviewRequired: true,
  generatesCopy: false,
  sideEffects: "none",
  autoApproval: false,
  autoScheduling: false,
  autoPublishing: false,
};

const generationReviewDelivery = {
  kind: "grow_generation_review_delivery",
  version: "grow-generation-review-delivery-v1",
  sourceReference: "source:essay-1",
  substanceReference: "substance:essay-1",
  rows: [{
    slot: { platform: "linkedin", dayIndex: 0, slotIndex: 0, variantId: "variant-1" },
    generatedArtifactRef: "artifact:variant-1",
    reviewQueueRef: "review:variant-1",
    reviewBundleId: "review-1",
    deliveryBinding: { readiness: { status: "ready", blockers: [] } },
    readiness: { status: "ready", blockers: [] },
  }],
  summary: { slots: 1, bound: 1, ready: 1, blocked: 0, missingBindings: 0 },
  readiness: { status: "ready", blockers: [] },
  bodyFree: true,
  generatesCopy: false,
  creatorBodyCopyAllowed: false,
  humanApprovalRequired: true,
  autoApproval: false,
  autoScheduling: false,
  autoPublishing: false,
  sideEffects: "none",
};

test("parses exactly one JSON source and format", () => {
  assert.deepEqual(parseStudioReadinessArgs(["--json", "{}", "--format", "markdown"]), {
    source: { kind: "json-string", value: "{}" }, format: "markdown",
  });
  assert.throws(() => parseStudioReadinessArgs(["--json", "{}", "--file", "x"]), /exactly one/);
});

test("fails closed for malformed envelopes", () => {
  assert.throws(() => buildStudioReadinessFromJson("[]"), /JSON object envelope/);
  assert.throws(() => buildStudioReadinessFromJson('{"source":{"status":"unknown"}}'), /source status/);
});

test("parses and validates explicit volume and generation envelopes", () => {
  const readiness = buildStudioReadinessFromJson(JSON.stringify({
    source: { status: "ready" },
    treatmentCoverage,
    volume: volumePlan,
    generation: generationRunManifest,
  }));

  assert.equal(readiness.stages.find((entry) => entry.stage === "volume")?.status, "ready");
  assert.equal(readiness.stages.find((entry) => entry.stage === "generation")?.status, "ready");
  assert.throws(() => buildStudioReadinessFromJson(JSON.stringify({
    volumePlan: { ...volumePlan, slots: "not-an-array" },
  })), /volume plan slots must be an array/);
  assert.throws(() => buildStudioReadinessFromJson(JSON.stringify({
    generationRunManifest: { ...generationRunManifest, rows: [{ variantId: "variant-1", body: "copy" }] },
  })), /unsupported field "body"|generation run row 1 must contain a status/);
  assert.throws(() => buildStudioReadinessFromJson(JSON.stringify({
    treatmentCoverage: { ...treatmentCoverage, kind: "grow_treatment_coverage", generatesCopy: true },
  })), /treatment coverage must not generate copy|treatment coverage generatesCopy/);
  assert.throws(() => buildStudioReadinessFromJson(JSON.stringify({ source: { status: "ready" }, body: "copy" })), /unsupported field "body"/);
});

test("accepts a genuine versioned generation-run artifact", () => {
  const readiness = buildStudioReadinessFromJson(JSON.stringify({
    source: { status: "ready" },
    treatmentCoverage,
    volumePlan,
    generationRunManifest: {
      kind: "grow_generation_run",
      version: "grow-generation-run-v1",
      sourceReference: "source:essay-1",
      substanceReference: "substance:essay-1",
      slots: [{
        platform: "linkedin", dayIndex: 0, slotIndex: 0, variantId: "variant-1", status: "ready",
        readiness: { status: "ready", blockers: [] }, blockers: [], humanReviewRequired: true,
        generatedArtifactRef: "artifact:variant-1", reviewQueueRef: "review:variant-1", reviewQueueStatus: "pending",
      }],
      unexpectedCandidates: [],
      summary: { slots: 1, ready: 1, blocked: 0, missing: 0, duplicate: 0, unexpected: 0 },
      readiness: { status: "ready", blockers: [] },
      humanReviewRequired: true,
      generatesCopy: false,
      creatorBodyCopyAllowed: false,
      autoApproval: false,
      autoScheduling: false,
      autoPublishing: false,
      sideEffects: "none",
    },
  }));
  assert.equal(readiness.stages.find((entry) => entry.stage === "generation")?.status, "ready");
});

test("accepts a body-free generation review-delivery artifact and fails closed on body fields", () => {
  const readiness = buildStudioReadinessFromJson(JSON.stringify({
    source: { status: "ready" },
    treatmentCoverage,
    volumePlan,
    generationRunManifest,
    generationReviewDelivery,
  }));
  assert.equal(readiness.stages.find((entry) => entry.stage === "delivery")?.status, "blocked");
  assert.throws(() => buildStudioReadinessFromJson(JSON.stringify({
    generationReviewDelivery: { ...generationReviewDelivery, rows: [{ ...generationReviewDelivery.rows[0], deliveryBinding: { body: "copy" } }] },
  })), /unsupported body field "body"/);
});

test("renders deterministic, body-free readiness metadata", () => {
  const readiness = buildStudioReadinessFromJson(JSON.stringify({ source: { status: "ready" } }));
  const markdown = renderStudioReadinessMarkdown(readiness);
  assert.match(markdown, /Overall: blocked/);
  assert.match(markdown, /Human gates/);
  assert.match(markdown, /\| volume \| blocked \|/);
  assert.match(markdown, /\| generation \| blocked \|/);
  assert.match(markdown, /Generates copy: false/);
  assert.equal(JSON.stringify(readiness).includes("body"), false);
  assert.equal(JSON.stringify(readiness).includes("content"), false);
});

test("uses injected file and output IO without writing domain state", async () => {
  let output = "";
  let errors = "";
  const exitCode = await main(["--file", "input.json", "--format", "json"], {
    readFile: async (path) => { assert.equal(path, "input.json"); return '{"source":{"status":"blocked"}}'; },
    write: (value) => { output += value; },
    error: (value) => { errors += value; },
  });
  assert.equal(exitCode, 0);
  assert.equal(errors, "");
  assert.match(output, /studio_readiness/);
});
