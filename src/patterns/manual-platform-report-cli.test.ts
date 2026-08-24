import assert from "node:assert/strict";
import test from "node:test";

import {
  buildManualPlatformReportFromJson,
  loadManualPlatformReportInput,
  main,
  parseManualPlatformReportArgs,
  renderManualPlatformReport,
} from "./manual-platform-report-cli.js";

const CREATOR_BODY = "PRIVATE CREATOR BODY MUST NEVER REACH CLI OUTPUT";

function rawObservations(): string {
  return JSON.stringify([
    {
      accountId: "account-1",
      postId: "post-1",
      platform: " X ",
      role: "editor",
      pool: "format",
      scope: "format",
      collectionStatus: "partial",
      body: CREATOR_BODY,
    },
    {
      accountId: "account-2",
      postId: "post-2",
      platform: "threads",
      role: "analyst",
      pool: "niche",
      scope: "niche",
      collectionStatus: "observed",
    },
  ]);
}

test("parses exactly one explicit source and the supported output formats", () => {
  assert.deepEqual(parseManualPlatformReportArgs(["--json", "[]", "--format", "markdown"]), {
    source: { kind: "json-string", value: "[]" },
    format: "markdown",
  });
  assert.deepEqual(parseManualPlatformReportArgs(["--input", "observations.json", "--format=both"]), {
    source: { kind: "file", path: "observations.json" },
    format: "both",
  });
  assert.deepEqual(parseManualPlatformReportArgs(["--file=observations.json"]), {
    source: { kind: "file", path: "observations.json" },
    format: "json",
  });
  assert.throws(() => parseManualPlatformReportArgs([]), /exactly one of --json or --input\/--file is required/);
  assert.throws(
    () => parseManualPlatformReportArgs(["--json", "[]", "--file", "observations.json"]),
    /exactly one of --json or --input\/--file is allowed/,
  );
  assert.throws(() => parseManualPlatformReportArgs(["--json", "[]", "--format", "html"]), /format must be json, markdown, or both/);
  assert.throws(() => parseManualPlatformReportArgs(["--json", "[]", "--unknown"]), /unknown argument/);
});

test("strictly accepts an array or observations envelope and normalizes without body copying", () => {
  const arrayRows = loadManualPlatformReportInput(rawObservations());
  const envelopeRows = loadManualPlatformReportInput(JSON.stringify({ observations: JSON.parse(rawObservations()) }));

  assert.deepEqual(arrayRows, envelopeRows);
  assert.equal(arrayRows[0]?.platform, "x");
  assert.equal(arrayRows[0]?.role, "editor");
  assert.equal(arrayRows[0]?.pool, "format");
  assert.equal(arrayRows[0]?.collectionStatus, "partial");
  assert.equal(Object.hasOwn(arrayRows[0] ?? {}, "body"), false);
  assert.equal(JSON.stringify(arrayRows).includes(CREATOR_BODY), false);

  const report = buildManualPlatformReportFromJson(rawObservations());
  assert.deepEqual(report.roles, [{ value: "analyst", count: 1 }, { value: "editor", count: 1 }]);
  assert.deepEqual(report.pools, [{ value: "format", count: 1 }, { value: "niche", count: 1 }]);
  assert.deepEqual(report.collectionStatuses, [{ status: "observed", count: 1 }, { status: "partial", count: 1 }]);
  assert.equal(Object.hasOwn(report, "winner"), false);
  assert.equal(Object.hasOwn(report, "ranking"), false);
  assert.doesNotMatch(JSON.stringify(report), /PRIVATE CREATOR BODY|creatorBody|"winner"\s*:|"ranking"\s*:/);
});

test("fails closed on malformed JSON, envelopes, and observation rows", () => {
  assert.throws(() => loadManualPlatformReportInput("not json"), /input must be valid JSON/);
  assert.throws(() => loadManualPlatformReportInput("{}"), /observations must be an array/);
  assert.throws(() => loadManualPlatformReportInput(JSON.stringify({ observations: {} })), /observations must be an array/);
  assert.throws(() => loadManualPlatformReportInput(JSON.stringify({ rows: [] })), /observations must be an array/);
  assert.throws(() => loadManualPlatformReportInput(JSON.stringify([null])), /observations\[0\] must be an object/);
  assert.throws(() => loadManualPlatformReportInput(JSON.stringify([[{}]])), /observations\[0\] must be an object/);
});

test("renders through the existing report renderers", () => {
  const report = buildManualPlatformReportFromJson(rawObservations());
  const json = renderManualPlatformReport(report, "json");
  const markdown = renderManualPlatformReport(report, "markdown");
  const both = renderManualPlatformReport(report, "both");

  assert.equal(JSON.parse(json).kind, "manual_platform_report");
  assert.match(markdown, /# Manual platform observation report/);
  assert.match(markdown, /Descriptive coverage only/);
  assert.equal(both, `${json}\n${markdown}`);
});

test("uses injected file and output I/O, with no output on failure", async () => {
  const reads: string[] = [];
  const writes: string[] = [];
  const errors: string[] = [];
  const exitCode = await main(["--file", "observations.json", "--format", "both"], {
    readFile: async (path) => {
      reads.push(path);
      return rawObservations();
    },
    write: (value) => { writes.push(value); },
    error: (value) => { errors.push(value); },
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(reads, ["observations.json"]);
  assert.equal(errors.length, 0);
  assert.equal(writes.length, 1);
  assert.match(writes[0] ?? "", /# Manual platform observation report/);
  assert.match(writes[0] ?? "", /"kind": "manual_platform_report"/);

  const failedWrites: string[] = [];
  const failedErrors: string[] = [];
  const failed = await main(["--json", "not json"], {
    write: (value) => { failedWrites.push(value); },
    error: (value) => { failedErrors.push(value); },
  });
  assert.equal(failed, 1);
  assert.deepEqual(failedWrites, []);
  assert.match(failedErrors.join(""), /input must be valid JSON/);
});
