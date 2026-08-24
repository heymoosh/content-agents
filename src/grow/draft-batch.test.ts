import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDraftBatch,
  type DraftBatchInput,
} from "./draft-batch.js";

function hasForbiddenKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbiddenKey);
  if (value === null || typeof value !== "object") return false;
  return Object.entries(value).some(([key, entry]) =>
    /^(?:body|creatorBody|prompt|modelOutput|pii|ranking|winner)$/i.test(key)
    || hasForbiddenKey(entry));
}

const base: DraftBatchInput = {
  sourceThoughtRef: "thought:original-1",
  sourceArtifactRef: "artifact:source-1",
  generationBriefRef: "brief:original-1",
  volumePlanRef: "volume:original-1",
  treatmentCoverageRef: "coverage:original-1",
  voicePolicyRef: "voice:muxin-1",
  treatments: [
    {
      platform: "linkedin",
      medium: "text",
      format: "short-post",
      treatmentRef: "treatment:observation",
      hookTemplateRefs: ["hook:common-question"],
      experimentRefs: ["experiment:opening-a"],
    },
    {
      platform: "x",
      medium: "text",
      format: "thread",
      treatmentRef: "treatment:contrast",
      hookTemplateRefs: ["hook:common-question"],
      experimentRefs: ["experiment:opening-b"],
    },
  ],
};

test("builds a deterministic body-free request per exact treatment", () => {
  const first = buildDraftBatch(base);
  const second = buildDraftBatch({ ...base, treatments: [...base.treatments].reverse() });

  assert.deepEqual(first, second);
  assert.equal(first.kind, "grow_draft_batch");
  assert.equal(first.requests.length, 2);
  assert.deepEqual(first.requests[0]?.lineage, {
    sourceThoughtRef: "thought:original-1",
    sourceArtifactRef: "artifact:source-1",
    generationBriefRef: "brief:original-1",
    volumePlanRef: "volume:original-1",
    treatmentCoverageRef: "coverage:original-1",
    expectedOutputArtifactRef: "artifact:draft-request-platform-linkedin-medium-text-format-short-post-treatment-treatment-observation-experiments-experiment-opening-a-hooks-hook-common-question-key-WyJsaW5rZWRpbiIsInRleHQiLCJzaG9ydC1wb3N0IiwidHJlYXRtZW50Om9ic2VydmF0aW9uIixbImhvb2s6Y29tbW9uLXF1ZXN0aW9uIl0sWyJleHBlcmltZW50Om9wZW5pbmctYSJdXQ",
  });
  assert.equal(first.requests[0]?.humanReview.status, "pending");
  assert.equal(first.requests[0]?.generatesCopy, false);
  assert.equal(first.requests[0]?.modelBoundary.modelInvocation, "deferred");
  assert.equal(first.requests[0]?.templateReusePolicy.commonSocialHooks, "allowed");
  assert.equal(first.requests[0]?.creatorBodyCopyAllowed, false);
  assert.equal(first.sideEffects, "none");
  assert.equal(hasForbiddenKey(first), false);
});

test("fails closed on duplicate exact identities, including reordered refs", () => {
  assert.throws(
    () => buildDraftBatch({
      ...base,
      treatments: [
        ...base.treatments,
        { ...base.treatments[0]!, hookTemplateRefs: ["hook:common-question"] },
      ],
    }),
    /duplicate.*treatment/i,
  );
});

test("keeps output identities unique when only hook-template refs differ", () => {
  const batch = buildDraftBatch({
    ...base,
    treatments: [
      { ...base.treatments[0]!, hookTemplateRefs: ["hook-a"] },
      { ...base.treatments[0]!, hookTemplateRefs: ["hook-b"] },
    ],
  });

  assert.equal(new Set(batch.requests.map((request) => request.id)).size, 2);
  assert.equal(new Set(batch.requests.map((request) => request.expectedOutputArtifactRef)).size, 2);
});

test("keeps experiment and hook reference boundaries distinct in output IDs", () => {
  const batch = buildDraftBatch({
    ...base,
    treatments: [
      { ...base.treatments[0]!, hookTemplateRefs: ["h2"], experimentRefs: ["e1", "h1"] },
      { ...base.treatments[0]!, hookTemplateRefs: ["h1", "h2"], experimentRefs: ["e1"] },
    ],
  });

  assert.equal(new Set(batch.requests.map((request) => request.id)).size, 2);
  assert.equal(new Set(batch.requests.map((request) => request.expectedOutputArtifactRef)).size, 2);
});

test("keeps punctuation-normalized treatment refs distinct in output IDs", () => {
  const batch = buildDraftBatch({
    ...base,
    treatments: [
      { ...base.treatments[0]!, treatmentRef: "treatment:a.b" },
      { ...base.treatments[0]!, treatmentRef: "treatment:a-b" },
    ],
  });

  assert.equal(new Set(batch.requests.map((request) => request.id)).size, 2);
  assert.equal(new Set(batch.requests.map((request) => request.expectedOutputArtifactRef)).size, 2);
});

test("fails closed on incomplete identities and forbidden input fields", () => {
  assert.throws(
    () => buildDraftBatch({ ...base, treatments: [{ ...base.treatments[0]!, format: "" }] }),
    /format.*non-empty/i,
  );
  assert.throws(
    () => buildDraftBatch({ ...base, treatments: [{ ...base.treatments[0]!, experimentRefs: [] }] }),
    /experimentRefs.*non-empty/i,
  );
  assert.throws(
    () => buildDraftBatch({ ...base, body: "creator prose" } as unknown as DraftBatchInput),
    /unsupported.*body/i,
  );
  assert.throws(
    () => buildDraftBatch({ ...base, winner: "treatment:observation" } as unknown as DraftBatchInput),
    /unsupported.*winner/i,
  );
  assert.throws(
    () => buildDraftBatch({ ...base, prompt: "write the post" } as unknown as DraftBatchInput),
    /unsupported.*prompt/i,
  );
  assert.throws(
    () => buildDraftBatch({ ...base, pii: "private email" } as unknown as DraftBatchInput),
    /unsupported.*pii/i,
  );
});
