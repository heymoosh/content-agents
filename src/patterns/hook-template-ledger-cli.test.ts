import { test } from "node:test";
import assert from "node:assert/strict";
import { main, parseHookTemplateLedgerArgs, renderHookTemplateLedgerMarkdown } from "./hook-template-ledger-cli.js";
import { readHookTemplateLedger } from "./hook-template-ledger.js";

const row = {
  id: "hook:contrast",
  name: "Contrast opener",
  mechanism: "Set an expected assumption beside the specific reversal.",
  platforms: ["linkedin"],
  niches: ["building"],
  formats: ["text-post"],
  slots: ["claim", "contrast"],
  sourceRefs: [{ sourceId: "library-1", location: "row 1", kind: "library-row", evidenceStatus: "unmeasured", caveats: ["hypothesis"] }],
  review: "passed",
  originality: "passed",
  evidenceStatus: "hypothesis",
  adaptationNote: "Use Muxin's own claim and wording.",
  generatesCopy: false,
  creatorBodyCopyAllowed: false,
};

test("parses file, filters, and format arguments", () => {
  assert.deepEqual(parseHookTemplateLedgerArgs([
    "--file", "hooks.jsonl", "--platform", "linkedin", "--niche", "building", "--format", "both", "--include-unreviewed",
  ]), {
    file: "hooks.jsonl",
    filter: { platform: "linkedin", niche: "building", includeUnreviewed: true },
    format: "both",
  });
  assert.throws(() => parseHookTemplateLedgerArgs([]), /--file is required/);
  assert.throws(() => parseHookTemplateLedgerArgs(["--file", "hooks.jsonl", "--format", "yaml"]), /--format/);
});

test("renders a deterministic, body-free operator view through injected I/O", () => {
  const output: string[] = [];
  const errors: string[] = [];
  const code = main(["--file", "hooks.jsonl", "--format", "both"], {
    readFile: (path) => { assert.equal(path, "hooks.jsonl"); return JSON.stringify(row); },
    write: (value) => output.push(value),
    error: (value) => errors.push(value),
  });
  assert.equal(code, 0);
  assert.deepEqual(errors, []);
  assert.match(output[0] ?? "", /hook-template-ledger-cli-v1/);
  assert.match(output[0] ?? "", /Common-hook mad-lib adaptation/);
  assert.doesNotMatch(output[0] ?? "", /"(?:body|copy|model|winner|score)"\s*:/);
  assert.match(renderHookTemplateLedgerMarkdown(readHookTemplateLedger(JSON.stringify(row))), /Contrast opener|contrast/);
});

test("reports parse failures without writing a partial report", () => {
  const output: string[] = [];
  const errors: string[] = [];
  const code = main(["--file", "hooks.jsonl"], {
    readFile: () => JSON.stringify({ ...row, body: "creator wording" }),
    write: (value) => output.push(value),
    error: (value) => errors.push(value),
  });
  assert.equal(code, 1);
  assert.deepEqual(output, []);
  assert.match(errors[0] ?? "", /hook-templates:.*forbidden/);
});
