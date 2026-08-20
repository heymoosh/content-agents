import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { formatStatus } from "./status.js";
import { clearCheckpoint } from "./checkpoint.js";
import { createArtifact, transitionArtifact } from "./artifacts.js";
import { appendCanonEvent } from "./canon.js";
import { writeDecision, selectDecision, type DecisionKind } from "./decisions.js";
import { ventureDir, clusterAnalysisPath } from "./paths.js";
import { loadRules, type ArtifactKind, type VentureRules } from "./rules.js";

const SLUG = "zz-test-status";

afterEach(() => {
  rmSync(ventureDir(SLUG), { recursive: true, force: true });
});

describe("formatStatus -- plain language, no internal vocabulary", () => {
  test("no artifacts yet reads as nothing drafted", () => {
    const text = formatStatus(SLUG);
    assert.match(text, /No posts drafted yet/);
  });

  test("never leaks internal field names into the output", () => {
    const rules = loadRules();
    createArtifact(SLUG, rules, {
      artifact_id: "p1-a",
      phase: 1,
      artifact_kind: "text-post-note",
      title: "t",
      checkpoint_id: "checkpoint-1",
      venture_id: SLUG,
      venture_phase: 1,
      message_id: "msg-a",
      at: "t0",
    });
    const text = formatStatus(SLUG);
    for (const forbidden of ["artifact", "delivery_status", "gated", "editorial_status"]) {
      assert.doesNotMatch(text.toLowerCase(), new RegExp(forbidden));
    }
  });

  // Regression: once checkpoint-1 clears, formatStatus starts reporting checkpoint-2's blocking
  // reasons too -- those come from a different code path (checkpointArtifactState's
  // required_artifact_kinds branch, state.ts) than checkpoint-1's, and it's easy for a raw
  // "missing required artifact kind ..." reason to leak straight into user-facing text unmapped.
  test("Phase 2 output (once checkpoint-1 has cleared) never leaks internal vocabulary either", () => {
    appendCanonEvent(SLUG, "checkpoint-cleared", `${SLUG}/checkpoint-1`, {}, "t0");
    const text = formatStatus(SLUG);
    assert.match(text, /Phase 2/);
    for (const forbidden of ["artifact", "delivery_status", "gated", "editorial_status"]) {
      assert.doesNotMatch(text.toLowerCase(), new RegExp(forbidden));
    }
  });
});

// Forbidden terms that would be internal-vocabulary leaks in Phase 3 output too, plus the new
// checkpoint-3-only terms this work package introduces (decision_kind, required_decision_kinds,
// selected_candidate_id) -- state.ts/checkpoint.ts/rules.yaml's own field names, never meant for
// Muxin's eyes.
const FORBIDDEN_TERMS = [
  "artifact",
  "delivery_status",
  "gated",
  "editorial_status",
  "artifact_kind",
  "decision_kind",
  "required_decision_kinds",
  "selected_candidate_id",
  "ledger_event_id",
  "checkpoint-3",
  "phase_3_completed",
];

function assertNoLeak(text: string) {
  for (const forbidden of FORBIDDEN_TERMS) {
    assert.doesNotMatch(text.toLowerCase(), new RegExp(forbidden.toLowerCase()));
  }
}

describe("formatStatus -- Phase 3, plain language, no internal vocabulary", () => {
  const DECISION_KINDS: DecisionKind[] = ["problem-selection", "transformation-choice", "product-format-and-price"];

  function reachPhase3() {
    appendCanonEvent(SLUG, "checkpoint-cleared", `${SLUG}/checkpoint-1`, {}, "t0");
    appendCanonEvent(SLUG, "checkpoint-cleared", `${SLUG}/checkpoint-2`, {}, "t1");
  }

  // gateStateFromRecords (responses.ts) derives "opened" from the response-gate-opened canon event,
  // not from a live response count -- so a status test can open the gate without seeding 20 real
  // response records.
  function openResponseGate() {
    appendCanonEvent(SLUG, "response-gate-opened", `${SLUG}/response-gate-opened`, { eligible_unique: "20" }, "t2");
  }

  // writeClusterAnalysis (phase3.ts) is module-private -- write the same minimal shape directly.
  function storeClusterAnalysis() {
    mkdirSync(ventureDir(SLUG), { recursive: true });
    writeFileSync(clusterAnalysisPath(SLUG), JSON.stringify({ analyzed_at: "t3", clusters: [] }));
  }

  function selectDecisionOfKind(rules: VentureRules, kind: DecisionKind, id: string) {
    writeDecision(SLUG, {
      decision_id: id,
      decision_kind: kind,
      rules_version: rules.rules_version,
      input_refs: ["ref"],
      candidates: [{ candidate_id: "c1", label: "c1", scores: {}, evidence_refs: [], rationale: "r" }],
      recommended_candidate_ids: ["c1"],
      at: "t3",
    });
    selectDecision(SLUG, id, { selectedCandidateIds: ["c1"], selectedBy: "muxin", requiredSelectCount: 1, at: "t4" });
  }

  function seedPhase3Artifact(rules: VentureRules, kind: ArtifactKind, id: string) {
    createArtifact(SLUG, rules, {
      artifact_id: id,
      phase: 3,
      artifact_kind: kind,
      title: id,
      checkpoint_id: "checkpoint-3",
      venture_id: SLUG,
      venture_phase: 3,
      message_id: `msg-${id}`,
      at: "t3",
    });
  }

  test("gate closed: reports progress toward the goal, no leak", () => {
    reachPhase3();
    const text = formatStatus(SLUG);
    assert.match(text, /Phase 3/);
    assert.match(text, /0 of 20 people who count toward the goal/);
    assert.match(text, /30/); // the target
    assertNoLeak(text);
  });

  test("gate open, nothing else done: reports responses not grouped yet, no leak", () => {
    reachPhase3();
    openResponseGate();
    const text = formatStatus(SLUG);
    // openResponseGate() only fakes the ledger event (see its own comment) -- it doesn't seed real
    // response records, so the live "have" count reads 0 here even though the gate is open.
    assert.match(text, /0 people who count toward the goal/);
    assert.match(text, /haven't been grouped into common problems yet/);
    assertNoLeak(text);
  });

  test("gate open, cluster stored, partial completion: names only what's outstanding, no leak", () => {
    reachPhase3();
    openResponseGate();
    storeClusterAnalysis();
    const rules = loadRules();
    selectDecisionOfKind(rules, "problem-selection", "d-0");
    selectDecisionOfKind(rules, "transformation-choice", "d-1");
    // product-format-and-price left unselected; neither artifact seeded yet.
    const text = formatStatus(SLUG);
    assert.match(text, /price hasn't been chosen yet/);
    assert.match(text, /outline hasn't been drafted yet/);
    assert.doesNotMatch(text, /core problem hasn't been chosen yet/);
    assert.doesNotMatch(text, /change this creates hasn't been approved yet/);
    assertNoLeak(text);
  });

  test("gate open, cluster stored, everything approved: reports Phase 3 complete, no leak", () => {
    reachPhase3();
    openResponseGate();
    storeClusterAnalysis();
    const rules = loadRules();
    for (const [i, kind] of DECISION_KINDS.entries()) selectDecisionOfKind(rules, kind, `d-${i}`);
    seedPhase3Artifact(rules, "product-outline", "p3-product-outline");
    seedPhase3Artifact(rules, "price-decision", "p3-price-decision");
    transitionArtifact(SLUG, "p3-product-outline", { editorial_status: "approved" }, "t5");
    transitionArtifact(SLUG, "p3-price-decision", { editorial_status: "approved" }, "t5");
    clearCheckpoint(SLUG, "checkpoint-3", "t6");
    const text = formatStatus(SLUG);
    assert.match(text, /Phase 3 is complete/);
    assertNoLeak(text);
  });
});
