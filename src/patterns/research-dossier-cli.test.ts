import assert from "node:assert/strict";
import test from "node:test";

import {
  main,
  parseResearchDossierArgs,
  renderResearchDossierHtml,
  renderResearchDossierMarkdown,
} from "./research-dossier-cli.js";

const validInput = JSON.stringify({
  question: { id: "q1", text: "What opening mechanism is visible in this bounded set?", intendedUse: "observation" },
  selectionPolicy: {
    description: "Reviewed text posts with explicit baselines.",
    inclusionCriteria: ["reviewed"], exclusionCriteria: ["missing facts"],
  },
  evidence: [{
    id: "e1", accountId: "a1", sourceId: "s1", postId: "p1", platform: "x", pool: "niche",
    membershipReason: "Muxin reviewed niche membership.", popularityScope: "niche X creators",
    sampleScope: "fixed sample", baselineScope: "same-account /new", baselineRef: "b1",
    metric: { name: "views", numerator: 20, denominator: 100, observedAt: "2026-08-20T00:00:00Z" },
    evidenceLinks: ["https://example.test/e1"], provenance: "native snapshot",
    collectedAt: "2026-08-21T00:00:00Z", caveats: ["small sample"], reviewStatus: "reviewed",
    reviewedBy: "Muxin", reviewedAt: "2026-08-22T00:00:00Z",
  }],
  baselines: [{
    id: "b1", accountId: "a1", metric: "views", numerator: 10, denominator: 5,
    windowStart: "2026-08-01T00:00:00Z", windowEnd: "2026-08-20T00:00:00Z",
    method: "settled /new median", source: "native profile", evidenceRefs: ["https://example.test/b1"],
    caveats: ["five-post sample"], reviewStatus: "reviewed",
    reviewedBy: "Muxin", reviewedAt: "2026-08-22T00:00:00Z",
  }],
  selections: [{ evidenceId: "e1", disposition: "include", reason: "Meets criteria." }],
  summaries: [{
    id: "summary-1", statement: "The example names its subject immediately.", evidenceRefs: ["e1"],
    caveats: ["Descriptive only."],
    originality: { status: "passed", checkedAgainstEvidenceRefs: ["e1"], note: "No creator wording retained.", checkedBy: "Muxin", checkedAt: "2026-08-22T00:00:00Z", method: "Source comparison and shingle scan." },
  }],
});

test("parses build and decide commands without implicit files or decisions", () => {
  assert.deepEqual(parseResearchDossierArgs(["build", "--file", "input.json", "--format", "html"]), {
    command: "build", inputPath: "input.json", format: "html", outputPath: null,
  });
  assert.deepEqual(parseResearchDossierArgs(["decide", "--dossier", "dossier.json", "--decision", "decision.json", "--output", "decided.json"]), {
    command: "decide", dossierPath: "dossier.json", decisionPath: "decision.json", outputPath: "decided.json",
  });
  assert.throws(() => parseResearchDossierArgs(["build", "--file", "input.json", "--format", "pdf"]), /format/i);
  assert.throws(() => parseResearchDossierArgs(["decide", "--dossier", "dossier.json"]), /decision/i);
});

test("renders a scannable review artifact with evidence, caveats, citations, and the pending decision gate", () => {
  const writes: string[] = [];
  const errors: string[] = [];
  assert.equal(main(["build", "--file", "input.json", "--format", "json"], {
    readFile: () => validInput,
    write: (value) => writes.push(value),
    writeFile: () => { throw new Error("unexpected file write"); },
    error: (value) => errors.push(value),
  }), 0);
  const dossier = JSON.parse(writes.join(""));
  const markdown = renderResearchDossierMarkdown(dossier);
  const html = renderResearchDossierHtml(dossier);
  assert.match(markdown, /Pending Muxin review/);
  assert.match(markdown, /sha256:[a-f0-9]{64}/);
  assert.match(markdown, /https:\/\/example\.test\/e1/);
  assert.match(html, /Research dossier review/);
  assert.match(html, /No winner claims/);
  assert.match(html, /sha256:[a-f0-9]{64}/);
  assert.match(html, /Descriptive only/);
  assert.doesNotMatch(html, /<script|creator body/i);
  assert.deepEqual(errors, []);
});

test("records an injected explicit decision and writes only the requested output", () => {
  let dossierJson = "";
  assert.equal(main(["build", "--file", "input.json", "--format", "json"], {
    readFile: () => validInput, write: (value) => { dossierJson += value; }, writeFile: () => {}, error: () => {},
  }), 0);
  const files = new Map([
    ["dossier.json", dossierJson],
    ["decision.json", JSON.stringify({ decidedBy: "Muxin", decidedAt: "2026-08-30T18:00:00Z", disposition: "observation", note: "Use as a bounded observation.", dossierDigest: JSON.parse(dossierJson).digest })],
  ]);
  const outputs: Array<[string, string]> = [];
  assert.equal(main(["decide", "--dossier", "dossier.json", "--decision", "decision.json", "--output", "decided.json"], {
    readFile: (path) => files.get(path) ?? "",
    write: () => { throw new Error("unexpected stdout"); },
    writeFile: (path, value) => outputs.push([path, value]),
    error: () => {},
  }), 0);
  assert.equal(outputs[0]?.[0], "decided.json");
  assert.equal(JSON.parse(outputs[0]![1]).readiness.status, "usable");
});

test("fails without writing when input or decision authority is invalid", () => {
  const outputs: string[] = [];
  const errors: string[] = [];
  assert.equal(main(["build", "--file", "bad.json", "--output", "out.json"], {
    readFile: () => "{}", write: (value) => outputs.push(value), writeFile: (_path, value) => outputs.push(value), error: (value) => errors.push(value),
  }), 1);
  assert.deepEqual(outputs, []);
  assert.match(errors.join(""), /research-dossier/i);
});
