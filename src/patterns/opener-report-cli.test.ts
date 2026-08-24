import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOpenerReportFromJson,
  main,
  parseOpenerReportArgs,
  renderOpenerReport,
} from "./opener-report-cli.js";
import type { Opener } from "./types.js";

const CREATOR_BODY = "CREATOR POST BODY MUST NEVER REACH CLI OUTPUT";

function opener(overrides: Partial<Opener> = {}): Opener {
  return {
    id: "opener-x-a-1",
    corpus_entry_id: "x-a-1",
    platform: "x",
    creator: "A",
    handle: "@a",
    url: "https://example.test/1",
    opener_text: "A source opener",
    onscreen_title: null,
    kind: "text",
    performance: { multiple: 2, metric: "views", note: "2.0x a measured baseline" },
    verbatim_ok: false,
    warnings: [],
    collected_at: "2026-08-24T00:00:00.000Z",
    ...overrides,
  };
}

function rawOpeners(openers: readonly unknown[] = [opener()]): string {
  return JSON.stringify(openers);
}

test("parses exactly one explicit JSON source and the supported output formats", () => {
  assert.deepEqual(parseOpenerReportArgs(["--json", "[]", "--format", "markdown"]), {
    source: { kind: "json-string", value: "[]" },
    format: "markdown",
  });
  assert.deepEqual(parseOpenerReportArgs(["--input", "openers.json", "--format", "both"]), {
    source: { kind: "file", path: "openers.json" },
    format: "both",
  });
  assert.deepEqual(parseOpenerReportArgs(["--file", "openers.json"]), {
    source: { kind: "file", path: "openers.json" },
    format: "json",
  });
  assert.throws(() => parseOpenerReportArgs([]), /exactly one of --json or --input\/--file is required/);
  assert.throws(() => parseOpenerReportArgs(["--json", "[]", "--file", "openers.json"]), /exactly one of --json or --input\/--file is allowed/);
  assert.throws(() => parseOpenerReportArgs(["--json", "[]", "--format", "html"]), /format must be json, markdown, or both/);
});

test("parses JSON rows and the explicit openers envelope, retaining no creator body field", () => {
  const rows = [
    { ...opener({ id: "opener-z-1", corpus_entry_id: "z-1" }), body: CREATOR_BODY },
    { ...opener({ id: "opener-a-1", corpus_entry_id: "a-1", performance: { multiple: 99, metric: "views", note: "high" } }), body: CREATOR_BODY },
  ];

  const report = buildOpenerReportFromJson(rawOpeners(rows));
  const envelopeReport = buildOpenerReportFromJson(JSON.stringify({ openers: rows }));

  assert.deepEqual(report, envelopeReport);
  assert.deepEqual(report.rows.map((row) => row.id), ["opener-a-1", "opener-z-1"]);
  assert.equal(JSON.stringify(report).includes(CREATOR_BODY), false);
  assert.equal(Object.hasOwn(report, "winner"), false);
  assert.equal(Object.hasOwn(report, "ranking"), false);
});

test("renders json, markdown, and both through the existing report renderers", () => {
  const report = buildOpenerReportFromJson(rawOpeners());
  const json = renderOpenerReport(report, "json");
  const markdown = renderOpenerReport(report, "markdown");
  const both = renderOpenerReport(report, "both");

  assert.equal(JSON.parse(json).kind, "opener_operator_report");
  assert.match(markdown, /# Opener operator report/);
  assert.match(markdown, /Source evidence \(verbatim\)/);
  assert.equal(both, `${json}\n${markdown}`);
  assert.doesNotMatch(`${json}${markdown}`, /CREATOR POST BODY|"body"\s*:/);
});

test("fails closed on malformed JSON and invalid opener rows", () => {
  assert.throws(() => buildOpenerReportFromJson("not json"), /input must be valid JSON/);
  assert.throws(() => buildOpenerReportFromJson("{}"), /openers must be an array/);
  assert.throws(() => buildOpenerReportFromJson(JSON.stringify([{}])), /\[0\].*id/);
  assert.throws(() => buildOpenerReportFromJson(JSON.stringify([opener({ platform: "not-a-platform" as Opener["platform"] })])), /platform/);
  assert.throws(() => buildOpenerReportFromJson(JSON.stringify([opener({ warnings: [{ code: "not-a-warning" as never, note: "bad" }] })])), /warnings\[0\].code/);
  assert.throws(() => buildOpenerReportFromJson(JSON.stringify([opener({ performance: { multiple: "fast" as never, metric: "views", note: "bad" } })])), /performance\.multiple/);
});

test("uses injected file and output IO without domain writes or output on failure", async () => {
  const writes: string[] = [];
  const errors: string[] = [];
  const reads: string[] = [];
  const exitCode = await main(["--file", "openers.json", "--format", "json"], {
    readFile: async (path) => {
      reads.push(path);
      return rawOpeners();
    },
    write: (value) => {
      writes.push(value);
    },
    error: (value) => {
      errors.push(value);
    },
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(reads, ["openers.json"]);
  assert.equal(errors.length, 0);
  assert.equal(writes.length, 1);

  const failedWrites: string[] = [];
  const failedErrors: string[] = [];
  const failed = await main(["--json", "not json"], {
    write: (value) => {
      failedWrites.push(value);
    },
    error: (value) => {
      failedErrors.push(value);
    },
  });
  assert.equal(failed, 1);
  assert.deepEqual(failedWrites, []);
  assert.match(failedErrors.join(""), /input must be valid JSON/);
});
