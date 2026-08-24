import assert from "node:assert/strict";
import test from "node:test";

import {
  main,
  parsePatternDataStatusArgs,
  renderPatternDataStatusJson,
  renderPatternDataStatusMarkdown,
  renderPatternDataStatus,
} from "./data-status-cli.js";
import type { PatternCoreArtifactReport, PatternDataStatusReport } from "./data-status.js";

function artifact(
  relativePath: PatternCoreArtifactReport["relativePath"],
  format: "jsonl" | "json",
  status: "available" | "missing" | "invalid" = "available",
): PatternCoreArtifactReport {
  return {
    relativePath,
    format,
    status,
    bytes: status === "missing" ? null : 42,
    recordCount: status === "missing" ? 0 : 2,
    validRecordCount: status === "available" ? 2 : 0,
    parseErrors: [],
    validationErrors: [],
  };
}

function optionalArtifact(
  relativePath: "browser" | "rss",
  status: "available" | "missing" | "invalid" = "available",
) {
  return {
    relativePath,
    status,
    fileCount: status === "missing" ? 0 : 1,
    files: status === "missing" ? [] : ["capture.json"],
    fileCountByExtension: status === "missing" ? [] : [{ extension: ".json", count: 1 }],
    totalBytes: status === "missing" ? null : 42,
    errors: [],
  };
}

function report(): PatternDataStatusReport {
  return {
    dataDirectory: "/private/tmp/pattern-data",
    reviewStatus: "unreviewed",
    reviewBoundary: "Counts and file metadata are unreviewed and not human-reviewed.",
    artifacts: {
      "corpus.jsonl": artifact("corpus.jsonl", "jsonl"),
      "analyses.jsonl": artifact("analyses.jsonl", "jsonl", "missing"),
      "baselines.jsonl": artifact("baselines.jsonl", "jsonl"),
      "inbox/reddit-rss-top-year-2026-08-23.json": artifact(
        "inbox/reddit-rss-top-year-2026-08-23.json",
        "json",
        "invalid",
      ),
    },
    derivedArtifacts: {
      openers: {
        relativePath: "openers.jsonl",
        format: "jsonl",
        status: "available",
        bytes: 42,
        recordCount: 2,
        validRecordCount: 1,
        parseErrors: [{ line: 2, message: "invalid JSON" }],
        validationErrors: [],
      },
    },
    corpus: {
      recordCount: 2,
      validRecordCount: 2,
      byPlatform: [
        { platform: "x", count: 1 },
        { platform: "youtube", count: 1 },
      ],
    },
    baselines: {
      recordCount: 2,
      validRecordCount: 2,
      platformHandleKeys: ["x|alpha", "youtube|zeta"],
    },
    optionalArtifacts: {
      browser: optionalArtifact("browser"),
      rss: optionalArtifact("rss", "missing"),
    },
    missingArtifacts: ["analyses.jsonl", "rss"],
    invalidArtifacts: ["inbox/reddit-rss-top-year-2026-08-23.json"],
  };
}

test("requires an explicit data directory and accepts only the documented formats", () => {
  assert.deepEqual(parsePatternDataStatusArgs(["--data-dir", "/tmp/pattern-data"]), {
    dataDir: "/tmp/pattern-data",
    format: "json",
  });
  assert.deepEqual(parsePatternDataStatusArgs(["--data-dir", "/tmp/pattern-data", "--format", "both"]), {
    dataDir: "/tmp/pattern-data",
    format: "both",
  });
  assert.throws(() => parsePatternDataStatusArgs([]), /--data-dir is required/);
  assert.throws(() => parsePatternDataStatusArgs(["--data-dir", " "]), /--data-dir requires a non-empty path/);
  assert.throws(() => parsePatternDataStatusArgs(["--data-dir", "/tmp/pattern-data", "--format", "html"]), /--format must be json, markdown, or both/);
  assert.throws(() => parsePatternDataStatusArgs(["--data-dir", "/tmp/pattern-data", "--unknown"]), /unknown argument: --unknown/);
  assert.throws(() => parsePatternDataStatusArgs(["--data-dir"]), /--data-dir requires a value/);
  assert.throws(() => parsePatternDataStatusArgs(["--data-dir", "/tmp/pattern-data", "--format", "json", "--format", "json"]), /--format may be supplied only once/);
});

test("renders deterministic operator metadata without opener text or corpus bodies", () => {
  const source = report() as PatternDataStatusReport & Record<string, unknown>;
  source.opener_text = "PRIVATE OPENER TEXT";
  source.body = "PRIVATE CORPUS BODY";

  const json = renderPatternDataStatusJson(source);
  assert.deepEqual(JSON.parse(json), report());
  assert.match(json, /"reviewStatus": "unreviewed"/);
  assert.match(json, /"recordCount": 2/);
  assert.doesNotMatch(json, /PRIVATE OPENER TEXT|PRIVATE CORPUS BODY|opener_text|"body"/);

  const markdown = renderPatternDataStatusMarkdown(source);
  assert.match(markdown, /^# Pattern data status/m);
  assert.match(markdown, /## Artifact inventory/);
  assert.match(markdown, /corpus\.jsonl/);
  assert.match(markdown, /Corpus records: 2 \(valid: 2\)/);
  assert.match(markdown, /x \| 1/);
  assert.match(markdown, /Baselines: 2 \(valid: 2\)/);
  assert.doesNotMatch(markdown, /PRIVATE OPENER TEXT|PRIVATE CORPUS BODY/);
  assert.doesNotMatch(markdown, /opener_text|"body"/);
  assert.equal(renderPatternDataStatusJson(source), renderPatternDataStatusJson(source));
  assert.equal(renderPatternDataStatus(source, "both"), `${renderPatternDataStatusJson(source)}\n${renderPatternDataStatusMarkdown(source)}`);
});

test("main injects the status loader and writer without touching the data directory", () => {
  const loadedPaths: string[] = [];
  const writes: string[] = [];
  const errors: string[] = [];

  const exitCode = main(
    ["--data-dir", "/virtual/read-only-data", "--format", "both"],
    (dataDir) => {
      loadedPaths.push(dataDir);
      return report();
    },
    { write: (value) => writes.push(value), error: (value) => errors.push(value) },
  );

  assert.equal(exitCode, 0);
  assert.deepEqual(loadedPaths, ["/virtual/read-only-data"]);
  assert.equal(errors.length, 0);
  assert.equal(writes.length, 1);
  assert.match(writes[0] ?? "", /\"reviewStatus\": \"unreviewed\"/);
  assert.match(writes[0] ?? "", /# Pattern data status/);
});

test("main fails closed on invalid arguments and loader failures", () => {
  const writes: string[] = [];
  const errors: string[] = [];
  let loadCount = 0;
  const io = { write: (value: string) => writes.push(value), error: (value: string) => errors.push(value) };

  assert.equal(main(["--format", "json"], () => { loadCount += 1; return report(); }, io), 1);
  assert.equal(main(["--data-dir", "/virtual/read-only-data", "--format", "yaml"], () => { loadCount += 1; return report(); }, io), 1);
  assert.equal(main(["--data-dir", "/virtual/read-only-data"], () => {
    loadCount += 1;
    throw new Error("data directory unavailable");
  }, io), 1);

  assert.equal(loadCount, 1);
  assert.equal(writes.length, 0);
  assert.match(errors.join("\n"), /--data-dir is required/);
  assert.match(errors.join("\n"), /--format must be json, markdown, or both/);
  assert.match(errors.join("\n"), /data directory unavailable/);
});
