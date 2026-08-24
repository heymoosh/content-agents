import assert from "node:assert/strict";
import { test } from "node:test";
import { buildExperimentRecord, type ExperimentRecordInput } from "./experiment-record.js";

const baseInput: ExperimentRecordInput = {
  id: " experiment-01 ",
  question: " Which opener earns more qualified replies? ",
  variables: [
    { name: "hook", options: [" statement ", "question"] },
    { name: "length", options: ["short"] },
  ],
  scope: {
    platform: [" substack "],
    format: ["note"],
    topic: [" civic technology "],
    audience: [" independent builders "],
  },
  lineage: {
    sourceRefs: ["source-01"],
    variantRefs: ["variant-b", "variant-a"],
    publishRefs: [],
    outcomeRefs: [],
  },
  successObservations: [
    {
      id: "observation-replies",
      family: "conversation",
      metric: "qualified replies",
      target: 2,
    },
  ],
  minimumSample: 20,
  reviewRule: "Review after 14 days and at least 20 published variants.",
  status: "running",
};

test("rejects missing or empty platform, format, topic, and audience scope", () => {
  assert.throws(
    () => buildExperimentRecord({ ...baseInput, scope: { ...baseInput.scope, platform: [] } }),
    /scope\.platform/i,
  );
  assert.throws(
    () => buildExperimentRecord({ ...baseInput, scope: { ...baseInput.scope, format: undefined } } as never),
    /scope\.format/i,
  );
  assert.throws(
    () => buildExperimentRecord({ ...baseInput, scope: { ...baseInput.scope, topic: "  " } } as never),
    /scope\.topic/i,
  );
  assert.throws(
    () => buildExperimentRecord({ ...baseInput, scope: { ...baseInput.scope, audience: ["builders", " "] } }),
    /scope\.audience/i,
  );
});

test("blocks a winner claim until a measured observation meets the minimum sample", () => {
  const unmeasured = {
    ...baseInput,
    winner: { variantRef: "variant-a", family: "conversation", observationRefs: ["observation-replies"] },
  } as ExperimentRecordInput;

  assert.throws(() => buildExperimentRecord(unmeasured), /measured observation/i);

  assert.throws(
    () => buildExperimentRecord({
      ...unmeasured,
      status: "closed",
      lineage: {
        ...baseInput.lineage,
        publishRefs: ["publish-a"],
        outcomeRefs: ["outcome-replies"],
      },
      successObservations: [{
        id: "observation-replies",
        family: "conversation",
        metric: "qualified replies",
        measured: true,
        value: 4,
        sample: 19,
        observedAt: "2026-08-20",
        outcomeRefs: ["outcome-replies"],
      }],
    }),
    /minimumSample/i,
  );

  const measured = buildExperimentRecord({
    ...unmeasured,
    status: "closed",
    lineage: {
      ...baseInput.lineage,
      publishRefs: ["publish-a", "publish-b"],
      outcomeRefs: ["outcome-replies"],
    },
    successObservations: [{
      id: "observation-replies",
      family: "conversation",
      metric: "qualified replies",
      target: 2,
      measured: true,
      value: 4,
      sample: 20,
      observedAt: "2026-08-20",
      outcomeRefs: ["outcome-replies"],
    }],
  });

  assert.deepEqual(measured.winner, {
    variantRef: "variant-a",
    family: "conversation",
    observationRefs: ["observation-replies"],
  });
});

test("blocks winner claims outside a closed experiment or without declared outcome evidence", () => {
  const measured = {
    ...baseInput,
    lineage: {
      ...baseInput.lineage,
      publishRefs: ["publish-a"],
      outcomeRefs: ["outcome-replies"],
    },
    successObservations: [{
      id: "observation-replies",
      family: "conversation",
      metric: "qualified replies",
      measured: true,
      value: 4,
      sample: 20,
      observedAt: "2026-08-20",
      outcomeRefs: ["outcome-replies"],
    }],
    winner: { variantRef: "variant-a", family: "conversation", observationRefs: ["observation-replies"] },
  } as ExperimentRecordInput;

  for (const status of ["proposed", "running", "insufficient-evidence"] as const) {
    assert.throws(() => buildExperimentRecord({ ...measured, status }), /status closed/i);
  }

  assert.throws(
    () => buildExperimentRecord({
      ...measured,
      status: "closed",
      lineage: { ...measured.lineage, outcomeRefs: [] },
      successObservations: [{ ...measured.successObservations[0], outcomeRefs: [] }],
    }),
    /declared outcome/i,
  );
});

test("requires exactly one question", () => {
  assert.throws(
    () => buildExperimentRecord({ ...baseInput, question: "one", questions: ["one", "two"] } as never),
    /exactly one question|not question and questions/i,
  );
});

test("keeps outcome families separate and normalizes records deterministically", () => {
  assert.throws(
    () => buildExperimentRecord({
      ...baseInput,
      successObservations: [{
        id: "mixed",
        family: "attention+conversation",
        metric: "engagement",
        target: 1,
      }],
    } as never),
    /outcome family/i,
  );

  const first = buildExperimentRecord({
    ...baseInput,
    variables: [
      { name: "length", options: ["short"] },
      { name: "hook", options: ["question", "statement"] },
    ],
    scope: {
      platform: ["substack"],
      format: ["note"],
      topic: ["civic technology"],
      audience: ["independent builders"],
    },
    lineage: {
      sourceRefs: ["source-01"],
      variantRefs: ["variant-a", "variant-b"],
      publishRefs: [],
      outcomeRefs: [],
    },
  });
  const second = buildExperimentRecord(baseInput);

  assert.deepEqual(first, second);
  assert.deepEqual(first.variables, [
    { name: "hook", options: ["question", "statement"] },
    { name: "length", options: ["short"] },
  ]);
  assert.deepEqual(first.scope, {
    platform: ["substack"],
    format: ["note"],
    topic: ["civic technology"],
    audience: ["independent builders"],
  });
  assert.equal(first.generatesCopy, false);
  assert.equal(first.sideEffects, "none");
});
