import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { applySignalsProposal, proposeSignalsChange, readSignalsProposals, reconcileSignalsApplyIntents, reviewSignalsProposal, rollbackSignalsProposal } from "./signals-change-proposals.js";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "signals-proposals-"));
  mkdirSync(join(root, "config"));
  writeFileSync(join(root, "config/platforms.yaml"), "platforms:\n  linkedin:\n    posts_per_week: 7\n");
  writeFileSync(join(root, "config/routing.yaml"), "defaults:\n  civic-tech: [bluesky, x]\n");
  return { root, path: join(root, "operational", "proposals.jsonl") };
}

test("concurrent identical Signals proposal transactions converge on one proposal", async () => {
  const f = fixture();
  const moduleUrl = pathToFileURL(join(process.cwd(), "src/review/signals-change-proposals.ts")).href;
  const script = `import { proposeSignalsChange } from ${JSON.stringify(moduleUrl)}; proposeSignalsChange({ type: "TEST", title: "Set linkedin cadence to 3 posts/week", rationale: "same", actor: "muxin" }, { root: process.argv[1], path: process.argv[2] });`;
  const run = promisify(execFile);
  try {
    await Promise.all(Array.from({ length: 6 }, () => run(process.execPath,
      ["--import", "tsx", "--input-type=module", "--eval", script, f.root, f.path])));
    assert.equal(readSignalsProposals(f.path).length, 1);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("concurrent review transitions allow exactly one pending-state winner", async () => {
  const f = fixture();
  const p = proposeSignalsChange({ type: "TEST", title: "Set linkedin cadence to 3 posts/week", rationale: "same", actor: "muxin" }, f);
  const moduleUrl = pathToFileURL(join(process.cwd(), "src/review/signals-change-proposals.ts")).href;
  const script = `import { reviewSignalsProposal } from ${JSON.stringify(moduleUrl)}; reviewSignalsProposal(process.argv[1], process.argv[2], "checked", "muxin", { path: process.argv[3] });`;
  const run = promisify(execFile);
  try {
    const outcomes = await Promise.allSettled(["approve", "reject"].map(action => run(process.execPath,
      ["--import", "tsx", "--input-type=module", "--eval", script, p.id, action, f.path])));
    assert.equal(outcomes.filter(x => x.status === "fulfilled").length, 1);
    assert.ok(["approved", "rejected"].includes(readSignalsProposals(f.path)[0]!.status));
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("concurrent applies serialize intent, config write, and completion", async () => {
  const f = fixture();
  const p = proposeSignalsChange({ type: "TEST", title: "Set linkedin cadence to 3 posts/week", rationale: "same", actor: "muxin" }, f);
  reviewSignalsProposal(p.id, "approve", "checked", "muxin", { path: f.path });
  const moduleUrl = pathToFileURL(join(process.cwd(), "src/review/signals-change-proposals.ts")).href;
  const script = `import { applySignalsProposal } from ${JSON.stringify(moduleUrl)}; applySignalsProposal(process.argv[1], "muxin", { root:process.argv[2], path:process.argv[3] });`;
  const run = promisify(execFile);
  try {
    await Promise.all([0, 1].map(() => run(process.execPath,
      ["--import", "tsx", "--input-type=module", "--eval", script, p.id, f.root, f.path])));
    assert.match(readFileSync(join(f.root, "config/platforms.yaml"), "utf8"), /posts_per_week: 3/);
    const appliedEvents = readFileSync(f.path, "utf8").split("\n").filter(line => line.includes('"event":"applied"'));
    assert.equal(appliedEvents.length, 1);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("adoption creates an intent-only exact cadence proposal, then Muxin reviews and applies it", () => {
  const f = fixture();
  try {
    const p = proposeSignalsChange({ type: "TEST", title: "Set linkedin cadence to 5 posts/week", rationale: "Measured fatigue", actor: "muxin" }, f);
    assert.equal(p.status, "pending"); assert.deepEqual(p.delta, { kind: "cadence", file: "config/platforms.yaml", platform: "linkedin", field: "posts_per_week", before: 7, after: 5 });
    assert.match(readFileSync(join(f.root, "config/platforms.yaml"), "utf8"), /posts_per_week: 7/);
    assert.equal(proposeSignalsChange({ type: "TEST", title: p.recommendation.title, rationale: p.recommendation.rationale, actor: "muxin" }, f).id, p.id, "repeat adoption is idempotent");
    assert.equal(reviewSignalsProposal(p.id, "approve", "I checked the measured window", "muxin", { path: f.path }).status, "approved");
    assert.equal(applySignalsProposal(p.id, "muxin", f).status, "applied");
    assert.match(readFileSync(join(f.root, "config/platforms.yaml"), "utf8"), /posts_per_week: 5/);
    assert.equal(applySignalsProposal(p.id, "muxin", f).status, "applied", "repeat apply is idempotent");
    assert.equal(rollbackSignalsProposal(p.id, "Cadence hurt quality", "muxin", f).status, "rolled_back");
    assert.match(readFileSync(join(f.root, "config/platforms.yaml"), "utf8"), /posts_per_week: 7/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("routing is allowlisted, unsupported prose is blocked, and config conflicts refuse apply", () => {
  const f = fixture();
  try {
    const routing = proposeSignalsChange({ type: "DO MORE", title: "Route civic-tech to linkedin", rationale: "Conversation evidence", actor: "muxin" }, f);
    assert.equal(routing.delta?.kind, "routing");
    const blocked = proposeSignalsChange({ type: "TEST", title: "Rewrite every hook", rationale: "Maybe stronger", actor: "muxin" }, f);
    assert.equal(blocked.status, "blocked"); assert.equal(blocked.delta, null);
    reviewSignalsProposal(routing.id, "approve", "Exact delta reviewed", "muxin", { path: f.path });
    writeFileSync(join(f.root, "config/platforms.yaml"), "platforms:\n  linkedin:\n    posts_per_week: 6\n");
    assert.throws(() => applySignalsProposal(routing.id, "muxin", f), /configuration changed since preview/);
    assert.equal(readSignalsProposals(f.path).find(p => p.id === routing.id)?.status, "approved");
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("a crash after config rename is recovered into a completed audit and retry is idempotent", () => {
  const f = fixture();
  try {
    const p = proposeSignalsChange({ type: "TEST", title: "Set linkedin cadence to 5 posts/week", rationale: "Measured fatigue", actor: "muxin" }, f);
    reviewSignalsProposal(p.id, "approve", "Exact delta reviewed", "muxin", { path: f.path });
    assert.throws(() => applySignalsProposal(p.id, "muxin", { ...f, afterConfigRename: () => { throw new Error("simulated crash"); } }), /simulated crash/);
    assert.equal(readSignalsProposals(f.path).find(x => x.id === p.id)?.status, "applying");
    assert.match(readFileSync(join(f.root, "config/platforms.yaml"), "utf8"), /posts_per_week: 5/);
    assert.equal(reconcileSignalsApplyIntents(f).find(x => x.id === p.id)?.status, "applied");
    assert.equal(applySignalsProposal(p.id, "muxin", f).status, "applied");
    const events = readFileSync(f.path, "utf8").trim().split("\n").map(line => JSON.parse(line));
    assert.ok(events.findIndex(e => e.event === "apply_intent") < events.findIndex(e => e.event === "applied"));
    assert.equal(events.filter(e => e.event === "applied").length, 1, "recovery completion is idempotent");
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("incomplete intent with a third config value is marked failed without a recovery mutation", () => {
  const f = fixture();
  try {
    const p = proposeSignalsChange({ type: "TEST", title: "Set linkedin cadence to 5 posts/week", rationale: "Measured fatigue", actor: "muxin" }, f);
    reviewSignalsProposal(p.id, "approve", "Exact delta reviewed", "muxin", { path: f.path });
    assert.throws(() => applySignalsProposal(p.id, "muxin", { ...f, afterConfigRename: () => { throw new Error("simulated crash"); } }));
    writeFileSync(join(f.root, "config/platforms.yaml"), "platforms:\n  linkedin:\n    posts_per_week: 6\n");
    assert.equal(reconcileSignalsApplyIntents(f).find(x => x.id === p.id)?.status, "apply_failed");
    assert.match(readFileSync(join(f.root, "config/platforms.yaml"), "utf8"), /posts_per_week: 6/);
    assert.throws(() => applySignalsProposal(p.id, "muxin", f), /config conflict/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("same Signals change title can exist independently per brand", () => {
  const f = fixture();
  try {
    const human = proposeSignalsChange({ brandId: "human-inference", type: "TEST", title: "Set linkedin cadence to 3 posts/week", rationale: "human", actor: "muxin" }, f);
    const charles = proposeSignalsChange({ brandId: "charles", type: "TEST", title: "Set linkedin cadence to 3 posts/week", rationale: "charles", actor: "muxin" }, f);
    assert.notEqual(human.id, charles.id);
    assert.equal(readSignalsProposals(f.path).length, 2);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test("non-Human-Inference proposals cannot apply against shared config", () => {
  const f = fixture();
  try {
    const proposal = proposeSignalsChange({ brandId: "charles", type: "TEST", title: "Set linkedin cadence to 3 posts/week", rationale: "charles", actor: "muxin" }, f);
    reviewSignalsProposal(proposal.id, "approve", "checked", "muxin", { path: f.path });
    assert.throws(() => applySignalsProposal(proposal.id, "muxin", f), /brand-specific configuration/i);
    assert.match(readFileSync(join(f.root, "config/platforms.yaml"), "utf8"), /posts_per_week: 7/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
