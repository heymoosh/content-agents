import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { deriveState } from "./state.js";
import { createArtifact, transitionArtifact } from "./artifacts.js";
import { appendCanonEvent } from "./canon.js";
import { ventureDir } from "./paths.js";
import { loadRules, type ArtifactKind, type VentureRules } from "./rules.js";

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

  test("live with the wrong evidence type for the kind does not count toward Checkpoint 1", () => {
    // text-post-note requires "agent" evidence (rules.yaml) -- writing "url" evidence onto one
    // (e.g. state corrupted outside the normal deliver.ts path) must not silently count as live.
    seedRequiredArtifact("p1-a");
    transitionArtifact(SLUG, "p1-a", { editorial_status: "approved", delivery_status: "ready" }, "t1");
    transitionArtifact(
      SLUG,
      "p1-a",
      { delivery_status: "live_confirmed", evidence: { type: "url", value: "https://example.com", confirmed_by: "muxin" } },
      "t2"
    );
    const state = deriveState(SLUG, 1);
    assert.equal(state.checkpoint1.complete_count, 0);
    assert.match(state.checkpoint1.blocking[0].reason, /does not meet this kind's minimum/);
  });

  test("a substack-post (min_evidence url) with agent evidence does not count either", () => {
    createArtifact(SLUG, rules, {
      artifact_id: "p1-essay",
      phase: 1,
      artifact_kind: "substack-post",
      title: "essay",
      checkpoint_id: "checkpoint-1",
      venture_id: SLUG,
      venture_phase: 1,
      message_id: "msg-p1-essay",
      at: "t0",
    });
    transitionArtifact(SLUG, "p1-essay", { editorial_status: "approved", delivery_status: "ready" }, "t1");
    transitionArtifact(
      SLUG,
      "p1-essay",
      { delivery_status: "live_confirmed", evidence: { type: "agent", value: "ref", confirmed_by: "agent" } },
      "t2"
    );
    const state = deriveState(SLUG, 1);
    assert.equal(state.checkpoint1.complete_count, 0);
  });

  test("rerunning deriveState after clearing is idempotent -- still reads complete", () => {
    seedRequiredArtifact("p1-a");
    appendCanonEvent(SLUG, "checkpoint-cleared", `${SLUG}/checkpoint-1`, {}, "t0");
    const first = deriveState(SLUG, 1);
    const second = deriveState(SLUG, 1);
    assert.equal(first.phase_status, second.phase_status);
    assert.equal(second.checkpoint1.cleared, true);
  });

  // Regression: the checkpointArtifactState refactor must not change checkpoint1's own behavior.
  test("checkpoint1 field shape and semantics are unchanged by the generalization", () => {
    seedRequiredArtifact("p1-a");
    seedRequiredArtifact("p1-b");
    seedRequiredArtifact("p1-c");
    makeLive("p1-a");
    makeLive("p1-b");
    makeLive("p1-c");
    appendCanonEvent(SLUG, "pace-recorded", `${SLUG}/phase-1/pace`, { per_week: "5" }, "t3");
    const state = deriveState(SLUG, 3);
    assert.equal(state.checkpoint1.complete_count, 3);
    assert.equal(state.checkpoint1.required_count, 3);
    assert.equal(state.checkpoint1.pace_recorded, true);
    assert.equal(state.checkpoint1.cleared, false);
    assert.equal(state.checkpoint1.blocking.length, 0);
    assert.equal(state.checkpoint1.required.length, 3);
    assert.equal(state.phase_status, "checkpoint_ready");
    // checkpoint-2 is unconditionally computed too (rules.yaml now always has it), but that must
    // not perturb checkpoint1 or phase_status, which stay driven by checkpoint-1 alone.
    assert.ok(state.checkpoint2);
  });
});

describe("deriveState -- Checkpoint 2", () => {
  const KINDS: ArtifactKind[] = ["lead-magnet", "landing-page-copy", "welcome-email", "survey"];

  function seedCp2Artifact(kind: ArtifactKind, id: string) {
    createArtifact(SLUG, rules, {
      artifact_id: id,
      phase: 2,
      artifact_kind: kind,
      title: id,
      checkpoint_id: "checkpoint-2",
      venture_id: SLUG,
      venture_phase: 2,
      message_id: `msg-${id}`,
      at: "t0",
    });
  }

  function makeLiveWithEvidence(id: string, evidenceType: "url" | "attestation" | "agent") {
    transitionArtifact(SLUG, id, { editorial_status: "approved", delivery_status: "ready" }, "t1");
    transitionArtifact(
      SLUG,
      id,
      { delivery_status: "live_confirmed", evidence: { type: evidenceType, value: "ref", confirmed_by: "muxin" } },
      "t2"
    );
  }

  // rules.yaml: lead-magnet, landing-page-copy, survey all want "url"; welcome-email wants
  // "attestation".
  function correctEvidenceFor(kind: ArtifactKind): "url" | "attestation" {
    return kind === "welcome-email" ? "attestation" : "url";
  }

  test("3 of 4 required kinds live does not clear -- blocking names the missing kind", () => {
    seedCp2Artifact("lead-magnet", "lm");
    seedCp2Artifact("landing-page-copy", "lp");
    seedCp2Artifact("welcome-email", "we");
    makeLiveWithEvidence("lm", correctEvidenceFor("lead-magnet"));
    makeLiveWithEvidence("lp", correctEvidenceFor("landing-page-copy"));
    makeLiveWithEvidence("we", correctEvidenceFor("welcome-email"));
    // survey is never seeded at all -- "missing" case.
    const state = deriveState(SLUG);
    assert.ok(state.checkpoint2);
    assert.equal(state.checkpoint2!.complete_count, 3);
    assert.equal(state.checkpoint2!.required_count, 4);
    assert.equal(state.checkpoint2!.cleared, false);
    assert.ok(state.checkpoint2!.blocking.some((b) => /missing required artifact kind "survey"/.test(b.reason)));
  });

  test("all 4 kinds live but one has the wrong evidence type -- blocking names the mismatch", () => {
    for (const kind of KINDS) seedCp2Artifact(kind, kind);
    for (const kind of KINDS) {
      if (kind === "welcome-email") {
        // wrong evidence: welcome-email wants "attestation", give it "url" instead.
        makeLiveWithEvidence(kind, "url");
      } else {
        makeLiveWithEvidence(kind, correctEvidenceFor(kind));
      }
    }
    const state = deriveState(SLUG);
    assert.ok(state.checkpoint2);
    assert.equal(state.checkpoint2!.complete_count, 3);
    assert.equal(state.checkpoint2!.cleared, false);
    assert.ok(
      state.checkpoint2!.blocking.some(
        (b) => /does not meet this kind's minimum \("attestation"\)/.test(b.reason) && /"welcome-email"/.test(b.reason)
      )
    );
  });

  test("all 4 kinds correctly live reads checkpoint_ready on checkpoint2 with no pace requirement", () => {
    for (const kind of KINDS) seedCp2Artifact(kind, kind);
    for (const kind of KINDS) makeLiveWithEvidence(kind, correctEvidenceFor(kind));
    const state = deriveState(SLUG);
    assert.ok(state.checkpoint2);
    assert.equal(state.checkpoint2!.complete_count, 4);
    assert.equal(state.checkpoint2!.required_count, 4);
    assert.equal(state.checkpoint2!.blocking.length, 0);
    // checkpoint-2 has no require_pace_recorded in rules.yaml -- pace_recorded reads trivially
    // true without any pace ever being recorded, and it must never end up in blocking.
    assert.equal(state.checkpoint2!.pace_recorded, true);
    assert.equal(state.checkpoint2!.cleared, false); // not cleared until the canon event fires
  });
});
