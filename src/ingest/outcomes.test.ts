import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { main, parseOutcomeIngestArgs } from "./outcomes.js";
import { readOutcomeLedger } from "../grow/outcome-ledger.js";

const row = {
  id: "landing-visit-1", eventType: "visit", observedAt: "2026-09-01T10:00:00Z", collectedAt: "2026-09-01T10:05:00Z",
  metric: "event_count", value: 4, unit: "event", numerator: 4, denominator: null,
  scope: { channel: "landing-page" }, window: { startAt: "2026-09-01T09:00:00Z", endAt: "2026-09-01T10:00:00Z" },
  sourceNote: "reviewed landing export", evidenceRefs: ["landing-export:row-1"],
  lineage: [{ recordType: "source_export", id: "landing-export", relation: "measured-from" }], caveats: [], status: "measured",
  respondentHash: null,
  attribution: [{ contentItemId: null, touchType: "unknown", touchAt: "2026-09-01T10:00:00Z", confidence: "low", attributionReason: "no UTM in export" }],
};

test("outcome ingest requires an explicit canonical brand and one explicit input", () => {
  assert.deepEqual(parseOutcomeIngestArgs(["--brand", "human-inference", "--input", "facts.json", "--ledger", "ledger.jsonl"]), {
    brandId: "human-inference", source: { kind: "file", path: "facts.json" }, ledgerPath: "ledger.jsonl",
  });
  assert.throws(() => parseOutcomeIngestArgs(["--input", "facts.json"]), /brand/i);
  assert.throws(() => parseOutcomeIngestArgs(["--brand", "other", "--json", "{}"]), /brand/i);
});

test("outcome ingest appends a validated brand-scoped batch and returns a body-free receipt", async () => {
  const root = mkdtempSync(join(tmpdir(), "outcome-ingest-"));
  const input = join(root, "facts.json"), ledger = join(root, "outcomes.jsonl");
  writeFileSync(input, JSON.stringify({ rows: [row] }));
  let output = "", error = "";
  try {
    assert.equal(await main(["--brand", "human-inference", "--input", input, "--ledger", ledger], {
      readFile: (path) => readFileSync(path, "utf8"), write: (value) => { output += value; }, error: (value) => { error += value; },
    }), 0);
    assert.equal(error, "");
    assert.deepEqual(readOutcomeLedger(ledger).map((item) => [item.id, item.brandId]), [["landing-visit-1", "human-inference"]]);
    assert.match(output, /"appended":1/);
    assert.doesNotMatch(output, /sourceNote|attribution|landing export/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("outcome ingest leaves the ledger unchanged when any row in the batch conflicts", async () => {
  const root = mkdtempSync(join(tmpdir(), "outcome-ingest-atomic-"));
  const ledger = join(root, "outcomes.jsonl");
  let output = "", error = "";
  try {
    const first = JSON.stringify({ rows: [row] });
    assert.equal(await main(["--brand", "human-inference", "--json", first, "--ledger", ledger], { write: (v) => { output += v; }, error: (v) => { error += v; } }), 0);
    const before = readFileSync(ledger, "utf8");
    assert.equal(await main(["--brand", "human-inference", "--json", JSON.stringify({ rows: [{ ...row, id: "new" }, row] }), "--ledger", ledger], { write: (v) => { output += v; }, error: (v) => { error += v; } }), 1);
    assert.equal(readFileSync(ledger, "utf8"), before);
    assert.match(error, /already exists/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("outcome ingest refuses lifecycle states and metrics that cannot truthfully render as counts", async () => {
  const root = mkdtempSync(join(tmpdir(), "outcome-ingest-semantics-"));
  const ledger = join(root, "outcomes.jsonl");
  let error = "";
  try {
    for (const invalid of [
      { ...row, id: "draft-row", status: "draft" },
      { ...row, id: "rejected-row", status: "rejected" },
      { ...row, id: "null-row", value: null, numerator: null },
      { ...row, id: "negative-row", value: -1, numerator: -1 },
    ]) {
      assert.equal(await main(["--brand", "human-inference", "--json", JSON.stringify({ rows: [invalid] }), "--ledger", ledger], { write: () => {}, error: (v) => { error += v; } }), 1);
    }
    assert.equal(readOutcomeLedger(ledger).length, 0);
    assert.match(error, /measured fact|event_count|non-negative integer/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("outcome ingest preserves explicit rate facts for Experiment without relabeling them as counts", async () => {
  const root = mkdtempSync(join(tmpdir(), "outcome-ingest-rate-"));
  const ledger = join(root, "outcomes.jsonl");
  try {
    const rate = { ...row, id: "rate-row", metric: "visits-per-1000-impressions", unit: "rate", value: 4.1, numerator: 4.1, denominator: 1000 };
    assert.equal(await main(["--brand", "human-inference", "--json", JSON.stringify({ rows: [rate] }), "--ledger", ledger], { write: () => {}, error: () => {} }), 0);
    assert.deepEqual(readOutcomeLedger(ledger).map((item) => [item.metric, item.value]), [["visits-per-1000-impressions", 4.1]]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
