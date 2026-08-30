import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { appendSignalsDecision, readSignalsDecisions, recommendationKey } from "./signals-decisions.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

test("Signals decisions are append-only and reads return the latest state", () => {
  const root = mkdtempSync(join(tmpdir(), "signals-decisions-"));
  const ledger = join(root, "decisions.jsonl");
  try {
    const rec = { type: "DO MORE" as const, title: "Use notes", rationale: "They travel." };
    assert.equal(appendSignalsDecision({ ...rec, decision: "adopt", date: "2026-08-29" }, ledger).ok, true);
    assert.equal(appendSignalsDecision({ ...rec, decision: "decline", date: "2026-08-30" }, ledger).ok, true);
    const key = recommendationKey(rec.type, rec.title);
    assert.deepEqual(readSignalsDecisions(ledger), {
      [key]: { ...rec, decision: "decline", date: "2026-08-30" },
    });
    assert.equal(readFileSync(ledger, "utf8").trim().split("\n").length, 2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("missing decision ledger reads as an empty state", () => {
  const root = mkdtempSync(join(tmpdir(), "signals-decisions-"));
  try { assert.deepEqual(readSignalsDecisions(join(root, "missing.jsonl")), {}); }
  finally { rmSync(root, { recursive: true, force: true }); }
});

test("a crash-truncated tail does not swallow the next complete decision", () => {
  const root = mkdtempSync(join(tmpdir(), "signals-decisions-tail-"));
  const path = join(root, "decisions.jsonl");
  writeFileSync(path, '{"type":"TEST"');
  appendSignalsDecision({ type: "TEST", title: "Try the hook", rationale: "Measured result", decision: "adopt", date: "2026-08-29" }, path);
  assert.equal(readSignalsDecisions(path)[recommendationKey("TEST", "Try the hook")]?.decision, "adopt");
  rmSync(root, { recursive: true, force: true });
});

test("concurrent legacy decision appends preserve every complete transaction", async () => {
  const root = mkdtempSync(join(tmpdir(), "signals-decisions-processes-")), path = join(root, "decisions.jsonl");
  const moduleUrl = pathToFileURL(join(process.cwd(), "src/review/signals-decisions.ts")).href;
  const script = `import { appendSignalsDecision } from ${JSON.stringify(moduleUrl)}; appendSignalsDecision({ type:"TEST", title:process.argv[2], rationale:"measured", decision:"adopt", date:"2026-08-30" }, process.argv[1]);`;
  const run = promisify(execFile);
  try {
    await Promise.all(Array.from({ length: 8 }, (_, i) => run(process.execPath,
      ["--import", "tsx", "--input-type=module", "--eval", script, path, `proposal-${i}`])));
    assert.equal(Object.keys(readSignalsDecisions(path)).length, 8);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
