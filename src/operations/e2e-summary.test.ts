import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeE2ERun, type JourneyRecord, type RunIdentity } from "./e2e-summary.js";

const IDENTITY: RunIdentity = { candidateSha: "abc1234", command: "npm run test:e2e", exitCode: 0 };

test("counts derive from the supplied records and sum to their length", () => {
  const records: JourneyRecord[] = [
    { pass: "A", feature: "one", status: "pass", detail: "" },
    { pass: "A", feature: "two", status: "pass", detail: "" },
    { pass: "B", feature: "three", status: "fail", detail: "threw a network error" },
    { pass: "B", feature: "four", status: "blocked", detail: "no fixture for this path" },
  ];
  const summary = summarizeE2ERun(records, IDENTITY);
  assert.equal(summary.passed, 2);
  assert.equal(summary.failed, 1);
  assert.equal(summary.skipped, 1);
  assert.equal(summary.passed + summary.failed + summary.skipped, records.length);
});

test("carries the exact run identity fields through unchanged", () => {
  const identity: RunIdentity = { candidateSha: "deadbeef", command: "tsx e2e/run-all.ts D-editorial", exitCode: 1 };
  const summary = summarizeE2ERun([{ pass: "D", feature: "x", status: "pass", detail: "" }], identity);
  assert.equal(summary.candidateSha, "deadbeef");
  assert.equal(summary.command, "tsx e2e/run-all.ts D-editorial");
  assert.equal(summary.exitCode, 1);
});

test("every failed journey is named in failures with its reason", () => {
  const records: JourneyRecord[] = [
    { pass: "B", feature: "writes a draft", status: "fail", detail: "500 from /api/atomize" },
  ];
  const summary = summarizeE2ERun(records, IDENTITY);
  assert.equal(summary.failures.length, 1);
  assert.equal(summary.failures[0].name, "B: writes a draft");
  assert.equal(summary.failures[0].reason, "500 from /api/atomize");
});

test("every skipped journey is named in skips with its reason", () => {
  const records: JourneyRecord[] = [
    { pass: "E", feature: "renders a video", status: "blocked", detail: "genuinely bills per render" },
  ];
  const summary = summarizeE2ERun(records, IDENTITY);
  assert.equal(summary.skips.length, 1);
  assert.equal(summary.skips[0].name, "E: renders a video");
  assert.equal(summary.skips[0].reason, "genuinely bills per render");
});

test("a skip with no reason is refused, not reported as an empty string", () => {
  const records: JourneyRecord[] = [{ pass: "E", feature: "unlabeled", status: "blocked", detail: "" }];
  assert.throws(() => summarizeE2ERun(records, IDENTITY), /refusing to summarise/);
});

test("a skip with only whitespace as a reason is refused", () => {
  const records: JourneyRecord[] = [{ pass: "E", feature: "unlabeled", status: "blocked", detail: "   " }];
  assert.throws(() => summarizeE2ERun(records, IDENTITY), /refusing to summarise/);
});

test("a failure with no reason is refused", () => {
  const records: JourneyRecord[] = [{ pass: "B", feature: "unlabeled", status: "fail", detail: "" }];
  assert.throws(() => summarizeE2ERun(records, IDENTITY), /refusing to summarise/);
});

test("an all-skipped run cannot be read as a clean pass", () => {
  const records: JourneyRecord[] = [
    { pass: "E", feature: "one", status: "blocked", detail: "no fixture" },
    { pass: "E", feature: "two", status: "blocked", detail: "no fixture" },
  ];
  const summary = summarizeE2ERun(records, IDENTITY);
  assert.equal(summary.passed, 0);
  assert.equal(summary.skipped, 2);
  assert.equal(summary.failed, 0);
});

test("an empty record set summarises to all-zero counts", () => {
  const summary = summarizeE2ERun([], IDENTITY);
  assert.equal(summary.passed, 0);
  assert.equal(summary.failed, 0);
  assert.equal(summary.skipped, 0);
  assert.deepEqual(summary.failures, []);
  assert.deepEqual(summary.skips, []);
});
