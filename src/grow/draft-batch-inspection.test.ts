import assert from "node:assert/strict";
import test from "node:test";

import { buildDraftBatch, type DraftBatchInput } from "./draft-batch.js";
import {
  buildDraftBatchInspection,
  renderDraftBatchInspectionJson,
  renderDraftBatchInspectionMarkdown,
} from "./draft-batch-inspection.js";

const input: DraftBatchInput = {
  sourceThoughtRef: "thought:original-1",
  sourceArtifactRef: "artifact:source-1",
  generationBriefRef: "brief:original-1",
  volumePlanRef: "volume:original-1",
  treatmentCoverageRef: "coverage:original-1",
  voicePolicyRef: "voice:muxin-1",
  treatments: [
    {
      platform: "x",
      medium: "text",
      format: "thread",
      treatmentRef: "treatment:contrast",
      hookTemplateRefs: ["hook:question", "hook:observation"],
      experimentRefs: ["experiment:opening-b"],
    },
    {
      platform: "linkedin",
      medium: "text",
      format: "short-post",
      treatmentRef: "treatment:observation",
      hookTemplateRefs: ["hook:question"],
      experimentRefs: ["experiment:opening-a"],
    },
    {
      platform: "linkedin",
      medium: "image",
      format: "quote-card",
      treatmentRef: "treatment:quote",
      hookTemplateRefs: ["hook:observation"],
      experimentRefs: ["experiment:visual-a"],
    },
  ],
};

test("builds a deterministic, body-free operator view with exact identities and counts", () => {
  const batch = buildDraftBatch(input);
  const before = structuredClone(batch);
  const inspection = buildDraftBatchInspection(batch);
  const reversed = buildDraftBatchInspection({ ...batch, requests: [...batch.requests].reverse() });

  assert.deepEqual(batch, before);
  assert.deepEqual(inspection, reversed);
  assert.deepEqual(inspection.counts, {
    total: 3,
    byPlatform: { linkedin: 2, x: 1 },
    byFormat: { "quote-card": 1, "short-post": 1, thread: 1 },
  });
  assert.deepEqual(inspection.requests.map((request) => request.identity), [
    {
      platform: "linkedin",
      medium: "image",
      format: "quote-card",
      treatmentRef: "treatment:quote",
      hookTemplateRefs: ["hook:observation"],
      experimentRefs: ["experiment:visual-a"],
    },
    {
      platform: "linkedin",
      medium: "text",
      format: "short-post",
      treatmentRef: "treatment:observation",
      hookTemplateRefs: ["hook:question"],
      experimentRefs: ["experiment:opening-a"],
    },
    {
      platform: "x",
      medium: "text",
      format: "thread",
      treatmentRef: "treatment:contrast",
      hookTemplateRefs: ["hook:observation", "hook:question"],
      experimentRefs: ["experiment:opening-b"],
    },
  ]);

  const request = inspection.requests[0]!;
  assert.deepEqual(request.lineage, batch.requests[0]!.lineage);
  assert.deepEqual(request.humanReview, {
    required: true,
    before: "publish",
    approvalOwner: "human",
    status: "pending",
  });
  assert.deepEqual(request.blockers, ["human review is pending"]);
  assert.equal(inspection.humanReview.pending, 3);
  assert.equal(inspection.generatesCopy, false);
  assert.equal(inspection.modelInvocation, "deferred");
  assert.equal(inspection.sideEffects, "none");
  assert.equal(Object.hasOwn(request, "body"), false);
});

test("validates the supplied batch shape conservatively and fails closed", () => {
  const batch = buildDraftBatch(input);

  assert.throws(() => buildDraftBatchInspection(null), /draft batch must be an object/);
  assert.throws(() => buildDraftBatchInspection({ ...batch, requests: [] }), /requests must be a non-empty array/);
  assert.throws(() => buildDraftBatchInspection({ ...batch, generatesCopy: true }), /generatesCopy must be false/);
  assert.throws(
    () => buildDraftBatchInspection({ ...batch, requests: [{ ...batch.requests[0]!, body: "creator prose" }] }),
    /request contains unsupported field "body"/,
  );
  assert.throws(
    () => buildDraftBatchInspection({
      ...batch,
      requests: [{ ...batch.requests[0]!, format: "other" }],
    }),
    /identity does not match request fields/,
  );
});

test("renders deterministic JSON and concise Markdown without source or generated copy", () => {
  const inspection = buildDraftBatchInspection(buildDraftBatch(input));
  const json = renderDraftBatchInspectionJson(inspection);
  const markdown = renderDraftBatchInspectionMarkdown(inspection);

  assert.deepEqual(JSON.parse(json), inspection);
  assert.match(markdown, /# Draft batch inspection/);
  assert.match(markdown, /Platform counts: linkedin 2; x 1/);
  assert.match(markdown, /Format counts: quote-card 1; short-post 1; thread 1/);
  assert.match(markdown, /linkedin \| text \| short-post \| treatment:observation/);
  assert.match(markdown, /Lineage: thought=thought:original-1/);
  assert.match(markdown, /Human review: pending \(human before publish\)/);
  assert.match(markdown, /Blockers: human review is pending/);
  assert.doesNotMatch(json, /creator prose|source body|generated copy/);
  assert.doesNotMatch(markdown, /creator prose|source body|generated copy/);
});
