import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { deriveState } from "./state.js";
import { createArtifact, transitionArtifact } from "./artifacts.js";
import { appendCanonEvent } from "./canon.js";
import { ventureDir } from "./paths.js";
import { loadRules, type VentureRules } from "./rules.js";

const SLUG = "zz-test-state";
let rules: VentureRules;

beforeEach(() => {
  rules = loadRules();
});

afterEach(() => {
  rmSync(ventureDir(SLUG), { recursive: true, force: true });
});

function seedRequiredArtifact(id: string) {
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
  transitionArtifact(
    SLUG,
    id,
    { delivery_status: "live_confirmed", evidence: { type: "agent", value: "ref", confirmed_by: "agent" } },
    "t2"
  );
}

describe("deriveState -- Checkpoint 1", () => {
  test("no required artifacts yet reads drafting", () => {
    const state = deriveState(SLUG);
    assert.equal(state.phase_status, "drafting");
    assert.equal(state.checkpoint1.cleared, false);
  });

  test("2 of 3 live does not clear -- no partial pass", () => {
    seedRequiredArtifact("p1-a");
    seedRequiredArtifact("p1-b");
    seedRequiredArtifact("p1-c");
    makeLive("p1-a");
    makeLive("p1-b");
    const state = deriveState(SLUG, 3);
    assert.equal(state.checkpoint1.complete_count, 2);
    assert.equal(state.checkpoint1.cleared, false);
    assert.equal(state.phase_status, "awaiting_you");
  });

  test("3 of 3 live but pace not recorded reads awaiting_you, not checkpoint_ready", () => {
    seedRequiredArtifact("p1-a");
    seedRequiredArtifact("p1-b");
    seedRequiredArtifact("p1-c");
    makeLive("p1-a");
    makeLive("p1-b");
    makeLive("p1-c");
    const state = deriveState(SLUG, 3);
    assert.equal(state.checkpoint1.pace_recorded, false);
    assert.equal(state.phase_status, "awaiting_you");
  });

  test("3 of 3 live AND pace recorded reads checkpoint_ready, but cleared stays false until the checkpoint event fires", () => {
    seedRequiredArtifact("p1-a");
    seedRequiredArtifact("p1-b");
    seedRequiredArtifact("p1-c");
    makeLive("p1-a");
    makeLive("p1-b");
    makeLive("p1-c");
    appendCanonEvent(SLUG, "pace-recorded", `${SLUG}/phase-1/pace`, { per_week: "5" }, "t3");
    const state = deriveState(SLUG, 3);
    assert.equal(state.checkpoint1.pace_recorded, true);
    assert.equal(state.checkpoint1.cleared, false);
    assert.equal(state.phase_status, "checkpoint_ready");
  });

  test("a checkpoint-cleared canon event flips cleared/phase_status to complete", () => {
    seedRequiredArtifact("p1-a");
    seedRequiredArtifact("p1-b");
    seedRequiredArtifact("p1-c");
    makeLive("p1-a");
    makeLive("p1-b");
    makeLive("p1-c");
    appendCanonEvent(SLUG, "pace-recorded", `${SLUG}/phase-1/pace`, { per_week: "5" }, "t3");
    appendCanonEvent(SLUG, "checkpoint-cleared", `${SLUG}/checkpoint-1`, { complete: "3" }, "t4");
    const state = deriveState(SLUG, 3);
    assert.equal(state.checkpoint1.cleared, true);
    assert.equal(state.phase_status, "complete");
  });

  test("rerunning deriveState after clearing is idempotent -- still reads complete", () => {
    seedRequiredArtifact("p1-a");
    appendCanonEvent(SLUG, "checkpoint-cleared", `${SLUG}/checkpoint-1`, {}, "t0");
    const first = deriveState(SLUG, 1);
    const second = deriveState(SLUG, 1);
    assert.equal(first.phase_status, second.phase_status);
    assert.equal(second.checkpoint1.cleared, true);
  });
});
