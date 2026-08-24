import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appendBaselineMeasurement,
  assessBaselineMeasurementReadiness,
  createBaselineMeasurementLedger,
  type BaselineMeasurementFact,
} from "./baseline-measurement-ledger.js";

function fact(overrides: Partial<BaselineMeasurementFact> = {}): BaselineMeasurementFact {
  return {
    id: "measurement-1",
    accountId: "account-1",
    platform: "x",
    route: "/new",
    settled: true,
    sample: {
      windowStart: "2026-08-01T00:00:00Z",
      windowEnd: "2026-08-07T00:00:00Z",
    },
    metric: { name: "likes", numerator: 12, denominator: 40 },
    method: "manual",
    observedAt: "2026-08-08T00:00:00Z",
    collectedAt: "2026-08-08T01:00:00Z",
    baselineScope: "account-platform-week",
    baselineSource: "operator report 2026-08-08",
    evidenceRefs: ["evidence:report-1"],
    reviewerStatus: "reviewed",
    unavailableReason: null,
    ...overrides,
  };
}

test("appends deterministic, body-free facts and exposes readiness", () => {
  const first = appendBaselineMeasurement(createBaselineMeasurementLedger(), fact());
  const second = appendBaselineMeasurement(createBaselineMeasurementLedger(), fact());

  assert.deepEqual(first, second);
  assert.equal(first.rows.length, 1);
  assert.equal("body" in first.rows[0], false);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.rows[0]), true);
  assert.equal(assessBaselineMeasurementReadiness(first.rows[0]).status, "ready");
  assert.deepEqual(assessBaselineMeasurementReadiness(first.rows[0]).blockers, []);
});

test("retains incomplete and unavailable facts with visible blockers", () => {
  const row = fact({
    sample: { windowStart: null, windowEnd: null },
    metric: { name: "likes", numerator: null, denominator: null },
    method: null,
    observedAt: null,
    collectedAt: null,
    baselineScope: null,
    baselineSource: null,
    evidenceRefs: [],
    reviewerStatus: "manual",
    unavailableReason: "platform does not expose this metric",
  });
  const stored = appendBaselineMeasurement(createBaselineMeasurementLedger(), row);
  const readiness = assessBaselineMeasurementReadiness(stored.rows[0]);

  assert.equal(stored.rows[0].unavailableReason, "platform does not expose this metric");
  assert.equal(readiness.status, "blocked");
  assert.deepEqual(readiness.blockers, [
    "metric numerator is missing",
    "metric denominator is missing",
    "sample window start is missing",
    "sample window end is missing",
    "method is missing",
    "observed time is missing",
    "collected time is missing",
    "baseline scope is missing",
    "baseline source is missing",
    "evidence refs are missing",
    "reviewer status is manual",
  ]);
});

test("rejects duplicates, edits, inferred values, and forbidden content", () => {
  const ledger = appendBaselineMeasurement(createBaselineMeasurementLedger(), fact());
  assert.throws(() => appendBaselineMeasurement(ledger, fact()), /duplicate id/);
  assert.throws(() => appendBaselineMeasurement(ledger, fact({ id: "measurement-2", settled: false } as unknown as Partial<BaselineMeasurementFact>)), /settled/);
  assert.throws(() => appendBaselineMeasurement(ledger, fact({ id: "measurement-2", value: 0 } as unknown as Partial<BaselineMeasurementFact>)), /forbidden field: value/);
  assert.throws(() => appendBaselineMeasurement(ledger, fact({ id: "measurement-2", body: "private text" } as unknown as Partial<BaselineMeasurementFact>)), /forbidden field: body/);
  assert.throws(() => appendBaselineMeasurement(ledger, fact({ id: "measurement-2", model: "gpt" } as unknown as Partial<BaselineMeasurementFact>)), /forbidden field: model/);
  assert.throws(() => appendBaselineMeasurement(ledger, fact({ id: "measurement-2", ranking: 1 } as unknown as Partial<BaselineMeasurementFact>)), /forbidden field: ranking/);
});

test("requires explicit /new caller facts and does not mutate the input ledger", () => {
  const ledger = createBaselineMeasurementLedger();
  const next = appendBaselineMeasurement(ledger, fact());
  assert.deepEqual(ledger.rows, []);
  assert.throws(() => appendBaselineMeasurement(ledger, fact({ id: "measurement-2", route: "/collect" } as unknown as Partial<BaselineMeasurementFact>)), /route must be \/new/);
  assert.throws(() => appendBaselineMeasurement(ledger, fact({ id: "measurement-2", evidenceRefs: ["  "] })), /evidence refs/);
  assert.equal(next.rows.length, 1);
});
