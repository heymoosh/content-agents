import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { recordPace, clearCheckpoint1 } from "./checkpoint.js";
import { createArtifact, transitionArtifact } from "./artifacts.js";
import { ventureDir } from "./paths.js";
import { hasCanonEvent } from "./canon.js";
import { loadRules, type VentureRules } from "./rules.js";

const SLUG = "zz-test-checkpoint";

afterEach(() => {
  rmSync(ventureDir(SLUG), { recursive: true, force: true });
});

function seedRequired(rules: VentureRules, id: string) {
  createArtifact(SLUG, rules, {
    artifact_id: id,
    phase: 1,
    artifact_kind: "text-post-note",
    title: id,
    checkpoint_id: "checkpoint-1",
    venture_id: SLUG,
    venture_phase: 1,
    message_id: `msg-${id}`,
    at: "t0",
  });
}

function makeLive(id: string) {
  transitionArtifact(SLUG, id, { editorial_status: "approved", delivery_status: "ready" }, "t1");
  transitionArtifact(SLUG, id, { delivery_status: "live_confirmed", evidence: { type: "agent", value: "r", confirmed_by: "agent" } }, "t2");
}

describe("clearCheckpoint1", () => {
  test("refuses with 2/3 live -- no partial pass", () => {
    const rules = loadRules();
    seedRequired(rules, "a");
    seedRequired(rules, "b");
    seedRequired(rules, "c");
    makeLive("a");
    makeLive("b");
    recordPace(SLUG, "5/week", "t3");
    const r = clearCheckpoint1(SLUG, "t4");
    assert.equal(r.cleared, false);
    assert.match(r.reason ?? "", /2\/3/);
  });

  test("refuses with 3/3 live but no pace recorded", () => {
    const rules = loadRules();
    seedRequired(rules, "a");
    seedRequired(rules, "b");
    seedRequired(rules, "c");
    makeLive("a");
    makeLive("b");
    makeLive("c");
    const r = clearCheckpoint1(SLUG, "t4");
    assert.equal(r.cleared, false);
    assert.match(r.reason ?? "", /pace not recorded/);
  });

  test("clears with 3/3 live and pace recorded, writes the canon event", () => {
    const rules = loadRules();
    seedRequired(rules, "a");
    seedRequired(rules, "b");
    seedRequired(rules, "c");
    makeLive("a");
    makeLive("b");
    makeLive("c");
    recordPace(SLUG, "5/week", "t3");
    const r = clearCheckpoint1(SLUG, "t4");
    assert.equal(r.cleared, true);
    assert.equal(r.alreadyCleared, false);
    assert.equal(hasCanonEvent(SLUG, `${SLUG}/checkpoint-1`), true);
  });

  test("rerunning clear after it already cleared is idempotent", () => {
    const rules = loadRules();
    seedRequired(rules, "a");
    seedRequired(rules, "b");
    seedRequired(rules, "c");
    makeLive("a");
    makeLive("b");
    makeLive("c");
    recordPace(SLUG, "5/week", "t3");
    clearCheckpoint1(SLUG, "t4");
    const r2 = clearCheckpoint1(SLUG, "t5");
    assert.equal(r2.cleared, true);
    assert.equal(r2.alreadyCleared, true);
  });
});

describe("recordPace", () => {
  test("is idempotent on repeat calls", () => {
    const first = recordPace(SLUG, "5/week", "t0");
    const second = recordPace(SLUG, "5/week", "t1");
    assert.equal(first.alreadyRecorded, false);
    assert.equal(second.alreadyRecorded, true);
  });
});
