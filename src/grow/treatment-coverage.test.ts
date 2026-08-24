import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGrowTreatmentCoverage,
  type GrowTreatmentCoverageInput,
} from "./treatment-coverage.js";

const requestedBase = {
  platform: "x",
  medium: "text",
  format: "post",
  treatmentId: "treatment-1",
  experimentId: "experiment-1",
  variables: { opener: "question", length: "short" },
};

function candidate(
  id: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    platform: requestedBase.platform,
    medium: requestedBase.medium,
    format: requestedBase.format,
    treatmentId: requestedBase.treatmentId,
    experimentId: requestedBase.experimentId,
    experimentVariables: { length: "short", opener: "question" },
    readiness: { status: "ready", blockers: [] },
    ...overrides,
  };
}

test("matches only complete treatment identity and sorts variables before comparing", () => {
  const input: GrowTreatmentCoverageInput = {
    requestedTreatments: [requestedBase],
    candidates: [candidate("candidate-1")],
  };

  const report = buildGrowTreatmentCoverage(input);

  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0]?.status, "matched");
  assert.deepEqual(report.rows[0]?.candidateIds, ["candidate-1"]);
  assert.deepEqual(report.rows[0]?.readiness, { status: "ready", blockers: [] });
  assert.deepEqual(report.rows[0]?.identity.variables, {
    length: "short",
    opener: "question",
  });
  assert.equal(report.readiness.status, "ready");
  assert.equal(report.sideEffects, "none");
  assert.equal(report.generatesCopy, false);
  assert.equal(report.creatorBodyCopyAllowed, false);
});

test("preserves missing, duplicate, blocked, and unexpected states", () => {
  const duplicate = { ...requestedBase, treatmentId: "duplicate" };
  const blocked = { ...requestedBase, treatmentId: "blocked" };
  const input: GrowTreatmentCoverageInput = {
    requestedTreatments: [
      requestedBase,
      { ...requestedBase, treatmentId: "missing" },
      duplicate,
      blocked,
    ],
    candidates: [
      candidate("candidate-ready"),
      candidate("candidate-duplicate-a", { treatmentId: "duplicate" }),
      candidate("candidate-duplicate-b", { treatmentId: "duplicate" }),
      candidate("candidate-blocked", {
        treatmentId: "blocked",
        readiness: { status: "blocked", blockers: ["voiceCheck", "humanGate"] },
      }),
      candidate("candidate-unexpected", { treatmentId: "unexpected" }),
    ],
  };

  const report = buildGrowTreatmentCoverage(input);

  assert.deepEqual(report.rows.map((row) => ({ treatmentId: row.identity.treatmentId, status: row.status })), [
    { treatmentId: "blocked", status: "blocked" },
    { treatmentId: "duplicate", status: "duplicate" },
    { treatmentId: "missing", status: "missing" },
    { treatmentId: "treatment-1", status: "matched" },
  ]);
  assert.deepEqual(report.rows.find((row) => row.identity.treatmentId === "duplicate")?.candidateIds, [
    "candidate-duplicate-a",
    "candidate-duplicate-b",
  ]);
  assert.deepEqual(report.rows.find((row) => row.identity.treatmentId === "blocked")?.readiness, {
    status: "blocked",
    blockers: ["humanGate", "voiceCheck"],
  });
  assert.deepEqual(report.unexpectedCandidates.map((row) => row.candidateId), ["candidate-unexpected"]);
  assert.equal(report.unexpectedCandidates[0]?.status, "unexpected");
  assert.deepEqual(report.summary, {
    requested: 4,
    matched: 1,
    missing: 1,
    duplicate: 1,
    blocked: 1,
    unexpected: 1,
  });
  assert.equal(report.readiness.status, "blocked");
  assert.ok(report.readiness.blockers.some((blocker) => blocker.includes("missing")));
  assert.ok(report.readiness.blockers.some((blocker) => blocker.includes("unexpected")));
});

test("does not use partial identity matches and is deterministic without mutating inputs", () => {
  const input: GrowTreatmentCoverageInput = {
    requested: [requestedBase, { ...requestedBase, treatmentId: "missing" }],
    candidates: [
      candidate("candidate-wrong-format", { format: "thread", treatmentId: "missing" }),
      candidate("candidate-right", { treatmentId: "treatment-1" }),
    ],
  };
  const before = structuredClone(input);

  const first = buildGrowTreatmentCoverage(input);
  const second = buildGrowTreatmentCoverage({
    requested: [...input.requested!].reverse(),
    candidates: [...input.candidates].reverse(),
  });

  assert.deepEqual(first, second);
  assert.equal(first.rows.find((row) => row.identity.treatmentId === "missing")?.status, "missing");
  assert.deepEqual(first.unexpectedCandidates.map((row) => row.candidateId), ["candidate-wrong-format"]);
  assert.deepEqual(input, before);
  assert.equal(JSON.stringify(first).includes("body"), false);
  assert.equal(JSON.stringify(first).includes("copy"), false);
});
