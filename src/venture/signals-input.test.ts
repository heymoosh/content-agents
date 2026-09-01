import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { artifactsPath, canonPath } from "./paths.js";
import { appendCanonEvent, readCanonEvents } from "./canon.js";
import { readArtifact, readArtifacts } from "./artifacts.js";
import { loadRules } from "./rules.js";
import { clearTempVentureRoot, useTempVentureRoot } from "./test-venture-root.js";
import { acceptSignalsInput, type SignalsInputHandoff } from "./signals-input.js";

const SLUG = "signals-input-test";
const RULES_VERSION = "venture-rules-2026-08-19-draft-1";

const workerCode = `
  import fs from "node:fs";
  import { syncBuiltinESMExports } from "node:module";
  const [startPath, appendReleasePath] = process.argv.slice(1);
  process.stdout.write("RACE_STARTED\\n");
  while (!fs.existsSync(startPath)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2);
  const originalAppendFileSync = fs.appendFileSync;
  let paused = false;
  fs.appendFileSync = ((path, ...args) => {
    if (!paused && String(path).endsWith("artifacts.jsonl")) {
      paused = true;
      process.stdout.write("RACE_CRITICAL\\n");
      while (!fs.existsSync(appendReleasePath)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2);
    }
    return originalAppendFileSync(path, ...args);
  });
  syncBuiltinESMExports();
  const { acceptSignalsInput } = await import("./src/venture/signals-input.ts");
  const handoff = JSON.parse(process.env.SIGNALS_INPUT_RACE_HANDOFF);
  const decision = { outcome: "accept", decided_by: "muxin", decision_ref: "muxin-race", reason: "Accept the measured signal." };
  try {
    const result = acceptSignalsInput(handoff.venture_id, handoff, decision, "2026-08-30T01:00:00.000Z");
    process.stdout.write(JSON.stringify({ ok: true, result }));
  } catch (error) {
    process.stdout.write(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  }
`;

type RaceWorker = { started: Promise<void>; critical: Promise<void>; done: Promise<{ code: number | null; output: string }> };

function runRaceWorker(startPath: string, appendReleasePath: string, input: SignalsInputHandoff): RaceWorker {
  let startedResolve!: () => void;
  let criticalResolve!: () => void;
  const started = new Promise<void>((resolve) => { startedResolve = resolve; });
  const critical = new Promise<void>((resolve) => { criticalResolve = resolve; });
  const done = new Promise<{ code: number | null; output: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", workerCode, startPath, appendReleasePath], {
      cwd: process.cwd(),
      env: { ...process.env, SIGNALS_INPUT_RACE_HANDOFF: JSON.stringify(input) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      if (text.includes("RACE_STARTED")) startedResolve();
      if (text.includes("RACE_CRITICAL")) criticalResolve();
    });
    child.stderr.on("data", (chunk: Buffer) => { output += chunk.toString(); });
    child.on("error", (error) => { startedResolve(); criticalResolve(); reject(error); });
    child.on("close", (code) => { startedResolve(); criticalResolve(); resolve({ code, output }); });
  });
  return { started, critical, done };
}

function handoff(overrides: Partial<SignalsInputHandoff> = {}): SignalsInputHandoff {
  return {
    pointer_id: "pointer-1",
    venture_id: SLUG,
    phase: 1,
    rules_version: RULES_VERSION,
    input_kind: "qualified-funnel-signal",
    source_record_refs: ["funnel:1"],
    evidence_refs: ["evidence:1"],
    content_item_refs: ["content:1"],
    scope: "one measured funnel outcome",
    sample_size: 1,
    provenance: "Signals outcome ledger",
    caveats: ["Directional evidence, not a demand claim."],
    lineage: { source_id: "source-1", variant_id: "variant-1", experiment_id: "experiment-1" },
    content_decision: { status: "approved", decided_by: "muxin", decision_ref: "content-decision-1" },
    venture_gate_ref: "venture-gate:signals-input",
    qualification: "qualified",
    evidence_status: "measured",
    ...overrides,
  };
}

beforeEach(() => {
  useTempVentureRoot();
  appendCanonEvent(SLUG, "kickoff", `${SLUG}/kickoff`, { rules_version: RULES_VERSION }, "2026-08-30T00:00:00.000Z");
});
afterEach(clearTempVentureRoot);

describe("Venture Signals input acceptance", () => {
  test("accept creates one non-publishable internal artifact and an auditable Muxin decision", () => {
    const result = acceptSignalsInput(SLUG, handoff(), { outcome: "accept", decided_by: "muxin", decision_ref: "muxin-signal-1", reason: "Use this measured lead signal to test the problem." }, "2026-08-30T01:00:00.000Z");
    assert.equal(result.artifact?.artifact_id, "signals-input-pointer-1");
    assert.equal(result.artifact?.artifact_kind, "signals-input");
    assert.equal(result.artifact?.delivery_mode, "none");
    assert.equal(result.artifact?.publishable, false);
    assert.equal(result.artifact?.editorial_status, "draft");
    assert.equal(result.artifact?.delivery_status, "not_applicable");
    assert.equal(result.artifact?.checkpoint_id, null);
    assert.equal(JSON.stringify(result.artifact).includes("private"), false);
    assert.equal(readArtifacts(SLUG).length, 1);
    assert.equal(readCanonEvents(SLUG).filter((e) => e.type === "signals-input-decision").length, 1);
  });

  test("reject and request-more-evidence record the Venture decision but create no artifact", () => {
    for (const outcome of ["reject", "request-more-evidence"] as const) {
      const result = acceptSignalsInput(SLUG, handoff({ pointer_id: `pointer-${outcome}` }), { outcome, decided_by: "muxin", decision_ref: `muxin-${outcome}`, reason: "Need a clearer measured signal." }, "2026-08-30T01:00:00.000Z");
      assert.equal(result.artifact, null);
    }
    assert.equal(readArtifacts(SLUG).length, 0);
    assert.equal(readCanonEvents(SLUG).filter((e) => e.type === "signals-input-decision").length, 2);
  });

  test("same identity and bytes are idempotent, but drift fails closed", () => {
    const input = handoff();
    const action = { outcome: "accept" as const, decided_by: "muxin" as const, decision_ref: "muxin-signal-1", reason: "Accept." };
    const first = acceptSignalsInput(SLUG, input, action, "2026-08-30T01:00:00.000Z");
    const second = acceptSignalsInput(SLUG, input, action, "2026-08-30T02:00:00.000Z");
    assert.equal(second.alreadyRecorded, true);
    assert.deepEqual(second.artifact, first.artifact);
    assert.equal(readArtifacts(SLUG).length, 1);
    assert.throws(() => acceptSignalsInput(SLUG, { ...input, scope: "drifted" }, action, "2026-08-30T03:00:00.000Z"), /drift|identity|fingerprint/i);
  });

  test("recovers an artifact written before its canon event without appending a duplicate", () => {
    const input = handoff();
    const action = { outcome: "accept" as const, decided_by: "muxin" as const, decision_ref: "muxin-signal-1", reason: "Accept." };
    acceptSignalsInput(SLUG, input, action, "2026-08-30T01:00:00.000Z");
    writeFileSync(canonPath(SLUG), readFileSync(canonPath(SLUG), "utf8").replace(/^- .*\*\*signals-input-decision\*\*.*\n/m, ""));
    const recovered = acceptSignalsInput(SLUG, input, action, "2026-08-30T02:00:00.000Z");
    assert.equal(recovered.artifact?.artifact_id, "signals-input-pointer-1");
    assert.equal(readArtifacts(SLUG).length, 1);
    assert.equal(readCanonEvents(SLUG).filter((e) => e.type === "signals-input-decision").length, 1);
    assert.throws(() => acceptSignalsInput(SLUG, { ...input, scope: "drift" }, action, "2026-08-30T03:00:00.000Z"), /drift|fingerprint/i);
  });

  test("requires the independent Muxin action, current phase/rules, and qualified measured evidence", () => {
    assert.throws(() => acceptSignalsInput(SLUG, handoff(), { outcome: "accept", decided_by: "system" as never, decision_ref: "x", reason: "x" }, "t"), /Muxin|decided_by/i);
    assert.throws(() => acceptSignalsInput(SLUG, handoff({ rules_version: "old-rules" }), { outcome: "accept", decided_by: "muxin", decision_ref: "x", reason: "x" }, "t"), /rules/i);
    assert.throws(() => acceptSignalsInput(SLUG, handoff({ phase: 2 }), { outcome: "accept", decided_by: "muxin", decision_ref: "x", reason: "x" }, "t"), /phase/i);
    assert.throws(() => acceptSignalsInput(SLUG, handoff({ qualification: "hypothesis" }), { outcome: "accept", decided_by: "muxin", decision_ref: "x", reason: "x" }, "t"), /qualified/i);
    assert.throws(() => acceptSignalsInput(SLUG, handoff({ evidence_status: "unmeasured" }), { outcome: "accept", decided_by: "muxin", decision_ref: "x", reason: "x" }, "t"), /measured/i);
  });

  test("rejects a handoff with no Content item refs", () => {
    assert.throws(
      () => acceptSignalsInput(SLUG, handoff({ content_item_refs: [] }), { outcome: "accept", decided_by: "muxin", decision_ref: "x", reason: "x" }, "t"),
      /content_item_refs.*non-empty refs/i,
    );
  });

  test("accepts the same internal artifact kind in the Venture's current Phase 2", () => {
    appendCanonEvent(SLUG, "checkpoint-cleared", `${SLUG}/checkpoint-1`, {}, "2026-08-30T00:10:00.000Z");
    const result = acceptSignalsInput(SLUG, handoff({ phase: 2, pointer_id: "phase-2" }), { outcome: "accept", decided_by: "muxin", decision_ref: "muxin-phase-2", reason: "Use this qualified input in Phase 2." }, "2026-08-30T01:00:00.000Z");
    assert.equal(result.artifact?.phase, 2);
    assert.equal(result.artifact?.venture_phase, 2);
    assert.equal(result.artifact?.artifact_kind, "signals-input");
  });

  test("two simultaneous cross-process accepts create exactly one artifact and canon decision", async () => {
    const raceRoot = mkdtempSync(join(tmpdir(), "signals-input-race-"));
    const startPath = join(raceRoot, "start");
    const appendReleasePath = join(raceRoot, "append-release");
    const input = handoff({ pointer_id: "cross-process-race" });
    const workers = [0, 1].map(() => runRaceWorker(startPath, appendReleasePath, input));
    try {
      await Promise.all(workers.map((worker) => worker.started));
      writeFileSync(startPath, "go\n");
      await Promise.race(workers.map((worker) => worker.critical));
      writeFileSync(appendReleasePath, "go\n");
      const results = await Promise.all(workers.map((worker) => worker.done));
      assert.deepEqual(results.map((result) => result.code), [0, 0], results.map((result) => result.output).join("\n"));
      const artifactLines = readFileSync(artifactsPath(SLUG), "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line) as { artifact_id: string });
      assert.equal(artifactLines.filter((artifact) => artifact.artifact_id === "signals-input-cross-process-race").length, 1);
      assert.equal(readCanonEvents(SLUG).filter((event) => event.type === "signals-input-decision" && event.id === `${SLUG}/signals-input/cross-process-race`).length, 1);
    } finally {
      if (!existsSync(startPath)) writeFileSync(startPath, "release after failure\n");
      if (!existsSync(appendReleasePath)) writeFileSync(appendReleasePath, "release after failure\n");
      await Promise.allSettled(workers.map((worker) => worker.done));
      rmSync(raceRoot, { recursive: true, force: true });
    }
  });
});
