import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readPatternDataStatus } from "./data-status.js";

function fixtureDirectory(): string {
  return mkdtempSync(join(tmpdir(), "pattern-data-status-"));
}

function writeJsonl(path: string, records: unknown[]): void {
  writeFileSync(path, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
}

function writeCoreFixtures(root: string): void {
  mkdirSync(join(root, "inbox"), { recursive: true });
  writeJsonl(join(root, "corpus.jsonl"), [
    { platform: "youtube", handle: "@zeta", body: "PRIVATE CORPUS BODY ZETA" },
    { platform: "x", handle: "@alpha", body: "PRIVATE CORPUS BODY ALPHA" },
  ]);
  writeJsonl(join(root, "analyses.jsonl"), [
    { id: "zeta", body: "PRIVATE ANALYSIS BODY" },
  ]);
  writeJsonl(join(root, "baselines.jsonl"), [
    { platform: "youtube", handle: "@Zeta", median: 10 },
    { platform: "x", handle: "@alpha", median: 20 },
  ]);
  writeFileSync(join(root, "inbox", "reddit-rss-top-year-2026-08-23.json"), JSON.stringify([
    { platform: "reddit", title: "PRIVATE REDDIT TITLE" },
  ]), "utf8");
}

test("reports all core artifacts and metadata only", () => {
  const root = fixtureDirectory();
  try {
    writeCoreFixtures(root);
    mkdirSync(join(root, "browser"), { recursive: true });
    mkdirSync(join(root, "rss"), { recursive: true });
    writeFileSync(join(root, "browser", "z-top.txt"), "PRIVATE BROWSER NUMBERS\n", "utf8");
    writeFileSync(join(root, "browser", "a-new.txt"), "PRIVATE BROWSER NUMBERS\n", "utf8");
    writeFileSync(join(root, "rss", "z-top.xml"), "PRIVATE RSS BODY\n", "utf8");

    const report = readPatternDataStatus(root);

    assert.equal(report.reviewStatus, "unreviewed");
    assert.match(report.reviewBoundary, /not human-reviewed/i);
    assert.deepEqual(
      Object.values(report.artifacts).map((artifact) => artifact.status),
      ["available", "available", "available", "available"],
    );
    assert.equal(report.artifacts["corpus.jsonl"].recordCount, 2);
    assert.equal(report.artifacts["analyses.jsonl"].recordCount, 1);
    assert.equal(report.artifacts["baselines.jsonl"].recordCount, 2);
    assert.equal(report.artifacts["inbox/reddit-rss-top-year-2026-08-23.json"].recordCount, 1);
    assert.deepEqual(report.corpus.byPlatform, [
      { platform: "x", count: 1 },
      { platform: "youtube", count: 1 },
    ]);
    assert.deepEqual(report.baselines.platformHandleKeys, ["x|alpha", "youtube|zeta"]);
    assert.equal(report.optionalArtifacts.browser.status, "available");
    assert.equal(report.optionalArtifacts.browser.fileCount, 2);
    assert.deepEqual(report.optionalArtifacts.browser.fileCountByExtension, [{ extension: ".txt", count: 2 }]);
    assert.equal(report.optionalArtifacts.rss.fileCount, 1);
    assert.deepEqual(report.optionalArtifacts.rss.files, ["z-top.xml"]);
    assert.deepEqual(report.missingArtifacts, []);
    assert.deepEqual(report.invalidArtifacts, []);

    const serialized = JSON.stringify(report);
    assert.equal("body" in report, false);
    assert.equal(serialized.includes('"body"'), false);
    assert.equal(serialized.includes("PRIVATE CORPUS BODY"), false);
    assert.equal(serialized.includes("PRIVATE ANALYSIS BODY"), false);
    assert.equal(serialized.includes("PRIVATE REDDIT TITLE"), false);
    assert.equal(serialized.includes("PRIVATE RSS BODY"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("reports missing core and optional artifacts without creating them", () => {
  const root = fixtureDirectory();
  try {
    writeJsonl(join(root, "corpus.jsonl"), [{ platform: "x", handle: "alpha" }]);
    const report = readPatternDataStatus(root);

    assert.equal(report.artifacts["corpus.jsonl"].status, "available");
    assert.equal(report.artifacts["analyses.jsonl"].status, "missing");
    assert.equal(report.artifacts["baselines.jsonl"].status, "missing");
    assert.equal(report.artifacts["inbox/reddit-rss-top-year-2026-08-23.json"].status, "missing");
    assert.equal(report.optionalArtifacts.browser.status, "missing");
    assert.equal(report.optionalArtifacts.rss.status, "missing");
    assert.deepEqual(report.missingArtifacts, [
      "analyses.jsonl",
      "baselines.jsonl",
      "browser",
      "inbox/reddit-rss-top-year-2026-08-23.json",
      "rss",
    ]);
    assert.deepEqual(report.invalidArtifacts, []);
    assert.equal(readFileSync(join(root, "corpus.jsonl"), "utf8").includes("alpha"), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("marks malformed JSONL and JSON as invalid and retains only safe counts", () => {
  const root = fixtureDirectory();
  try {
    mkdirSync(join(root, "inbox"), { recursive: true });
    writeFileSync(join(root, "corpus.jsonl"), `${JSON.stringify({ platform: "x", handle: "alpha" })}\nnot-json\n`, "utf8");
    writeFileSync(join(root, "analyses.jsonl"), "{\"id\":\"ok\"}\n[]\n", "utf8");
    writeFileSync(join(root, "baselines.jsonl"), "{\n", "utf8");
    writeFileSync(join(root, "inbox", "reddit-rss-top-year-2026-08-23.json"), "[not-json", "utf8");

    const report = readPatternDataStatus(root);

    assert.equal(report.artifacts["corpus.jsonl"].status, "invalid");
    assert.equal(report.artifacts["corpus.jsonl"].recordCount, 2);
    assert.equal(report.artifacts["corpus.jsonl"].validRecordCount, 1);
    assert.deepEqual(report.artifacts["corpus.jsonl"].parseErrors, [{ line: 2, message: "invalid JSON" }]);
    assert.equal(report.artifacts["analyses.jsonl"].status, "invalid");
    assert.deepEqual(report.artifacts["analyses.jsonl"].validationErrors, [{ record: 2, message: "record must be a JSON object" }]);
    assert.equal(report.artifacts["baselines.jsonl"].status, "invalid");
    assert.deepEqual(report.artifacts["baselines.jsonl"].parseErrors, [{ line: 1, message: "invalid JSON" }]);
    assert.equal(report.artifacts["inbox/reddit-rss-top-year-2026-08-23.json"].status, "invalid");
    assert.deepEqual(report.artifacts["inbox/reddit-rss-top-year-2026-08-23.json"].parseErrors, [{ line: null, message: "invalid JSON" }]);
    assert.deepEqual(report.invalidArtifacts, [
      "analyses.jsonl",
      "baselines.jsonl",
      "corpus.jsonl",
      "inbox/reddit-rss-top-year-2026-08-23.json",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("sorts report collections deterministically and does not rewrite fixtures", () => {
  const root = fixtureDirectory();
  try {
    writeCoreFixtures(root);
    const before = readFileSync(join(root, "corpus.jsonl"), "utf8");
    const first = readPatternDataStatus(root);
    const second = readPatternDataStatus(root);

    assert.deepEqual(first, second);
    assert.deepEqual(first.optionalArtifacts.browser.files, []);
    assert.equal(readFileSync(join(root, "corpus.jsonl"), "utf8"), before);
    assert.deepEqual(first.invalidArtifacts, []);
    assert.deepEqual(first.missingArtifacts, ["browser", "rss"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
