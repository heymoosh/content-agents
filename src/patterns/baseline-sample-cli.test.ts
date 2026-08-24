import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildBaselineFromJson, main, parseBaselineSampleArgs, parseBaselineSampleInput, renderBaselineSampleMarkdown } from "./baseline-sample-cli.js";

const input = JSON.stringify({
  account: { platform: "reddit", handle: "r/test" },
  sample: [
    { metrics: { views: null, likes: 2, comments: 1, shares: null }, posted_at: "2026-08-01T00:00:00.000Z" },
    { metrics: { views: null, likes: 4, comments: 2, shares: null }, posted_at: "2026-08-02T00:00:00.000Z" },
    { metrics: { views: null, likes: 8, comments: 4, shares: null }, posted_at: null },
  ],
  meta: { followers: 10, method: "settled /new sample", collected_at: "2026-08-03T00:00:00.000Z" },
});

test("parses an explicit baseline sample and builds a real median", () => {
  const parsed = parseBaselineSampleInput(input);
  assert.equal(parsed.sample.length, 3);
  const baseline = buildBaselineFromJson(input);
  assert.equal(baseline.median, 6);
  assert.deepEqual(baseline.terms, ["likes", "comments"]);
});

test("fails closed for empty or incomparable samples", () => {
  assert.throws(() => parseBaselineSampleInput(JSON.stringify({ account: { platform: "reddit", handle: "r/test" }, sample: [], meta: { followers: null, method: "x", collected_at: "now" } })), /non-empty/);
  assert.throws(() => buildBaselineFromJson(JSON.stringify({ account: { platform: "reddit", handle: "r/test" }, sample: [{ metrics: { views: null, likes: null, comments: null, shares: null }, posted_at: null }], meta: { followers: null, method: "x", collected_at: "now" } })), /common measurable/);
});

test("renders body-free markdown and has no file-writing path", () => {
  const baseline = buildBaselineFromJson(input);
  const markdown = renderBaselineSampleMarkdown(baseline);
  assert.match(markdown, /Measured baseline sample/);
  assert.match(markdown, /writes no baseline file/);
  assert.equal(parseBaselineSampleArgs(["--json", input, "--format", "markdown"]).format, "markdown");
});

test("main reports malformed input without throwing", () => {
  let error = "";
  assert.equal(main(["--json", "{}"], { error: (value) => { error = value; } }), 1);
  assert.match(error, /patterns:baseline-sample/);
});

test("reading a sample does not create or modify files", () => {
  const directory = mkdtempSync(join(tmpdir(), "baseline-sample-cli-test-"));
  try {
    const inputPath = join(directory, "sample.json");
    writeFileSync(inputPath, input);
    const before = readdirSync(directory);
    let output = "";
    assert.equal(main(["--input", inputPath], { write: (value) => { output = value; } }), 0);
    assert.equal(output.includes('"baseline"'), true);
    assert.deepEqual(readdirSync(directory), before);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
