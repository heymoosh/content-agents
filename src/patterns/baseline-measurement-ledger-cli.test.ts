import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBaselineMeasurementLedgerFromJsonl,
  main,
  parseBaselineMeasurementLedgerArgs,
  renderBaselineMeasurementLedger,
} from "./baseline-measurement-ledger-cli.js";

function fact(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "measurement-1",
    accountId: "account-1",
    platform: "x",
    route: "/new",
    settled: true,
    sample: {
      windowStart: "2026-08-01T00:00:00.000Z",
      windowEnd: "2026-08-07T00:00:00.000Z",
    },
    metric: { name: "likes", numerator: 12, denominator: 40 },
    method: "manual",
    observedAt: "2026-08-08T00:00:00.000Z",
    collectedAt: "2026-08-08T01:00:00.000Z",
    baselineScope: "account-platform-week",
    baselineSource: "operator report 2026-08-08",
    evidenceRefs: ["evidence:report-1"],
    reviewerStatus: "reviewed",
    unavailableReason: null,
    ...overrides,
  };
}

test("parses explicit inspect and append commands with one JSONL input", () => {
  assert.deepEqual(parseBaselineMeasurementLedgerArgs([
    "inspect", "--input", "measurements.jsonl", "--format", "markdown",
  ]), {
    command: "inspect",
    path: "measurements.jsonl",
    fact: undefined,
    format: "markdown",
  });
  assert.deepEqual(parseBaselineMeasurementLedgerArgs([
    "append", "--file=measurements.jsonl", "--fact", JSON.stringify(fact()), "--format=both",
  ]), {
    command: "append",
    path: "measurements.jsonl",
    fact: JSON.stringify(fact()),
    format: "both",
  });
  assert.throws(() => parseBaselineMeasurementLedgerArgs(["inspect", "--input", "x", "--fact", "{}"]), /--fact is only valid for append/);
  assert.throws(() => parseBaselineMeasurementLedgerArgs(["append", "--input", "x"]), /--fact is required for append/);
  assert.throws(() => parseBaselineMeasurementLedgerArgs(["inspect", "--input", "x", "--unknown"]), /unknown argument/);
});

test("inspects JSONL deterministically and preserves blocked or unavailable facts", async () => {
  const ready = fact();
  const unavailable = fact({
    id: "measurement-2",
    metric: { name: "shares", numerator: null, denominator: null },
    sample: { windowStart: null, windowEnd: null },
    method: null,
    observedAt: null,
    collectedAt: null,
    baselineScope: null,
    baselineSource: null,
    evidenceRefs: [],
    reviewerStatus: "manual",
    unavailableReason: "platform does not expose this metric",
  });
  const raw = `${JSON.stringify(ready)}\n\n${JSON.stringify(unavailable)}\n`;
  const first = buildBaselineMeasurementLedgerFromJsonl(raw);
  const second = buildBaselineMeasurementLedgerFromJsonl(`${JSON.stringify(unavailable)}\n${JSON.stringify(ready)}\n`);
  assert.equal(first.rows.length, 2);
  assert.equal(first.rows[1]?.unavailableReason, "platform does not expose this metric");
  assert.notDeepEqual(first, second, "JSONL order is append order, not a ranking or sort");

  const json = renderBaselineMeasurementLedger(first, "json");
  const markdown = renderBaselineMeasurementLedger(first, "markdown");
  assert.equal(JSON.parse(json).rows.length, 2);
  assert.match(json, /"status": "blocked"/);
  assert.match(json, /platform does not expose this metric/);
  assert.match(markdown, /# Baseline measurement ledger/);
  assert.match(markdown, /measurement-2/);
  assert.match(markdown, /BLOCKED/);
  assert.match(markdown, /platform does not expose this metric/);
  assert.doesNotMatch(`${json}\n${markdown}`, /ratio|average|median|winner|ranking/i);

  const writes: string[] = [];
  const errors: string[] = [];
  const exitCode = await main(["inspect", "--input", "measurements.jsonl", "--format", "markdown"], {
    readJsonl: (path) => { assert.equal(path, "measurements.jsonl"); return raw; },
    stdout: (value) => { writes.push(value); },
    stderr: (value) => { errors.push(value); },
  });
  assert.equal(exitCode, 0);
  assert.equal(writes.length, 1);
  assert.deepEqual(errors, []);
  assert.equal(writes[0], markdown);
});

test("appends exactly one caller-supplied /new fact through injected JSONL I/O", async () => {
  const existing = fact({ id: "measurement-1" });
  const supplied = fact({ id: "measurement-2", metric: { name: "comments", numerator: 3, denominator: 8 } });
  const appended: string[] = [];
  const output: string[] = [];
  const exitCode = await main([
    "append", "--input", "measurements.jsonl", "--fact", JSON.stringify(supplied), "--format", "json",
  ], {
    readJsonl: () => `${JSON.stringify(existing)}\n`,
    appendJsonl: (path, line) => { assert.equal(path, "measurements.jsonl"); appended.push(line); },
    stdout: (value) => { output.push(value); },
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(appended, [`${JSON.stringify(supplied)}\n`]);
  assert.equal(JSON.parse(output[0] ?? "{}").rows.length, 2);
  assert.match(output[0] ?? "", /measurement-2/);
});

test("keeps JSONL records separated when the existing file lacks a final newline", async () => {
  const appended: string[] = [];
  const exitCode = await main([
    "append", "--input", "measurements.jsonl", "--fact", JSON.stringify(fact({ id: "measurement-2" })),
  ], {
    readJsonl: () => JSON.stringify(fact()),
    appendJsonl: (_path, line) => { appended.push(line); },
    stdout: () => undefined,
  });

  assert.equal(exitCode, 0);
  assert.match(appended[0] ?? "", /^\n\{"id":"measurement-2"/);
});

test("fails closed on malformed JSON and unsupported fields before appending or printing", async () => {
  const appended: string[] = [];
  const output: string[] = [];
  const errors: string[] = [];
  const io = {
    readJsonl: () => "not json\n",
    appendJsonl: (_path: string, line: string) => { appended.push(line); },
    stdout: (value: string) => { output.push(value); },
    stderr: (value: string) => { errors.push(value); },
  };

  assert.equal(await main(["inspect", "--input", "measurements.jsonl"], io), 1);
  assert.deepEqual(output, []);
  assert.match(errors.join(""), /line 1.*valid JSON/i);

  output.length = 0;
  errors.length = 0;
  const unsupported = fact({ id: "measurement-2", ranking: 1 });
  assert.equal(await main([
    "append", "--input", "measurements.jsonl", "--fact", JSON.stringify(unsupported),
  ], {
    ...io,
    readJsonl: () => `${JSON.stringify(fact({ id: "measurement-1" }))}\n`,
  }), 1);
  assert.deepEqual(appended, []);
  assert.deepEqual(output, []);
  assert.match(errors.join(""), /forbidden field: ranking/);
});
