import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStudioReadinessFromJson,
  main,
  parseStudioReadinessArgs,
  renderStudioReadinessMarkdown,
} from "./studio-readiness-cli.js";

test("parses exactly one JSON source and format", () => {
  assert.deepEqual(parseStudioReadinessArgs(["--json", "{}", "--format", "markdown"]), {
    source: { kind: "json-string", value: "{}" }, format: "markdown",
  });
  assert.throws(() => parseStudioReadinessArgs(["--json", "{}", "--file", "x"]), /exactly one/);
});

test("fails closed for malformed envelopes", () => {
  assert.throws(() => buildStudioReadinessFromJson("[]"), /JSON object envelope/);
  assert.throws(() => buildStudioReadinessFromJson('{"source":{"status":"unknown"}}'), /source status/);
});

test("renders deterministic, body-free readiness metadata", () => {
  const readiness = buildStudioReadinessFromJson(JSON.stringify({ source: { status: "ready" } }));
  const markdown = renderStudioReadinessMarkdown(readiness);
  assert.match(markdown, /Overall: blocked/);
  assert.match(markdown, /Human gates/);
  assert.match(markdown, /Generates copy: false/);
  assert.equal(JSON.stringify(readiness).includes("body"), false);
  assert.equal(JSON.stringify(readiness).includes("content"), false);
});

test("uses injected file and output IO without writing domain state", async () => {
  let output = "";
  let errors = "";
  const exitCode = await main(["--file", "input.json", "--format", "json"], {
    readFile: async (path) => { assert.equal(path, "input.json"); return '{"source":{"status":"blocked"}}'; },
    write: (value) => { output += value; },
    error: (value) => { errors += value; },
  });
  assert.equal(exitCode, 0);
  assert.equal(errors, "");
  assert.match(output, /studio_readiness/);
});
