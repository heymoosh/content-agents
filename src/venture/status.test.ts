import { test, describe, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { formatStatus } from "./status.js";
import { clearCheckpoint } from "./checkpoint.js";
import { createArtifact, transitionArtifact } from "./artifacts.js";
import { appendCanonEvent, hasCanonEvent } from "./canon.js";
import { writeDecision, selectDecision, type DecisionKind } from "./decisions.js";
import { ventureDir, clusterAnalysisPath } from "./paths.js";
import { loadRules, type ArtifactKind, type VentureRules } from "./rules.js";
import { useTempVentureRoot, clearTempVentureRoot } from "./test-venture-root.js";

const SLUG = "zz-test-status";

beforeEach(useTempVentureRoot);

afterEach(clearTempVentureRoot);

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

  test("gate open, cluster stored, everything approved but checkpoint not yet cleared: reports ready to clear, no leak", () => {
    // Regression test: formatStatus used to fall silent in exactly this window -- every
    // requirement met (blocking empty) but cp3.cleared still false because nobody has run
    // `checkpoint.ts clear` yet. Muxin got no signal she could clear Phase 3.
    reachPhase3();
    openResponseGate();
    storeClusterAnalysis();
    const rules = loadRules();
    for (const [i, kind] of DECISION_KINDS.entries()) selectDecisionOfKind(rules, kind, `d-${i}`);
    seedPhase3Artifact(rules, "product-outline", "p3-product-outline");
    seedPhase3Artifact(rules, "price-decision", "p3-price-decision");
    transitionArtifact(SLUG, "p3-product-outline", { editorial_status: "approved" }, "t5");
    transitionArtifact(SLUG, "p3-price-decision", { editorial_status: "approved" }, "t5");
    // Deliberately no clearCheckpoint(SLUG, "checkpoint-3", ...) call here.
    const text = formatStatus(SLUG);
    assert.match(text, /ready to clear Checkpoint 3/);
    assert.doesNotMatch(text, /Phase 3 is complete/);
    assertNoLeak(text);
  });

  // CHANGED: this used to assert "Phase 3 is complete" survives forever once checkpoint-3 clears,
  // because current_phase was capped at 3 (there was no Phase 4 to move into). Work Package 3 gave
  // current_phase a real 4th value -- clearing checkpoint-3 now genuinely advances into Phase 4, so
  // formatStatus renders the Phase 4 block (matching Phase 1/2's own precedent: once you move past
  // a phase, that phase's block -- including any "is complete"/"is cleared" line -- stops
  // appearing, see renderPhase1/renderPhase2's comments). "Phase 3 is complete" is now stale and
  // must NOT survive into Phase 4's output; the fresh Phase 4 block (nothing drafted yet, right
  // after entering it) is what should render instead.
  test("gate open, cluster stored, everything approved: checkpoint-3 clearing advances into a fresh Phase 4, no stale Phase 3 message, no leak", () => {
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
    assert.match(text, /Phase 4/);
    assert.doesNotMatch(text, /Phase 3 is complete/);
    assert.match(text, /daily operating plan hasn't been drafted yet/);
    assert.match(text, /Day 14 review hasn't been drafted yet/);
    assertNoLeak(text);
  });
});

describe("formatStatus -- Phase 4, plain language, no internal vocabulary", () => {
  function reachPhase4() {
    appendCanonEvent(SLUG, "checkpoint-cleared", `${SLUG}/checkpoint-1`, {}, "t0");
    appendCanonEvent(SLUG, "checkpoint-cleared", `${SLUG}/checkpoint-2`, {}, "t1");
    appendCanonEvent(SLUG, "checkpoint-cleared", `${SLUG}/phase-3-completed`, {}, "t2");
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

  function seedPhase4Artifact(rules: VentureRules, kind: ArtifactKind, id: string) {
    createArtifact(SLUG, rules, {
      artifact_id: id,
      phase: 4,
      artifact_kind: kind,
      title: id,
      checkpoint_id: null,
      venture_id: SLUG,
      venture_phase: 4,
      message_id: `msg-${id}`,
      at: "t3",
    });
  }

  test("operating plan approved, day 14 review drafted (awaiting review), decision not made: no leak", () => {
    reachPhase4();
    const rules = loadRules();
    seedPhase4Artifact(rules, "daily-operating-plan", "p4-operating-plan");
    transitionArtifact(SLUG, "p4-operating-plan", { editorial_status: "approved" }, "t4");
    seedPhase4Artifact(rules, "day-14-review", "p4-day-14-review");
    const text = formatStatus(SLUG);
    assert.match(text, /Phase 4/);
    assert.match(text, /daily operating plan is drafted and approved/);
    assert.match(text, /Day 14 review is drafted and waiting on your review/);
    assert.match(text, /Day 14 decision hasn't been made yet/);
    assertNoLeak(text);
  });

  // Reproduces WP2's flagged ordering gap (day-14-decide requires only the day-14-review artifact
  // approved, not the daily-operating-plan artifact) and confirms the WRITE side self-heals:
  // formatStatus calls the exported maybeCompletePhase4 opportunistically before every render, so
  // simply running `venture:status` again after the operating plan is finally approved is what
  // fires the phase-4-completed canon event -- no separate command needed. state.test.ts's matching
  // "ordering gap" test covers the READ side (phase_status/phase4.complete reading correctly even
  // before this event fires).
  test("ordering gap: Day 14 decided before the operating plan is approved -- running status again after approval fires phase-4-completed", () => {
    reachPhase4();
    const rules = loadRules();
    selectDecisionOfKind(rules, "daily-operating-plan-choice", "d-mode");
    seedPhase4Artifact(rules, "daily-operating-plan", "p4-operating-plan");
    seedPhase4Artifact(rules, "day-14-review", "p4-day-14-review");
    transitionArtifact(SLUG, "p4-day-14-review", { editorial_status: "approved" }, "t4");
    selectDecisionOfKind(rules, "day-14-decision", "p4-day-14-decision");

    // Before the operating plan is approved: not complete yet, event not written.
    let text = formatStatus(SLUG);
    assert.doesNotMatch(text, /Phase 4 is complete/);
    assert.equal(hasCanonEvent(SLUG, `${SLUG}/phase-4-completed`), false);

    // Muxin approves the operating plan -- the missing piece, days later in the real scenario.
    transitionArtifact(SLUG, "p4-operating-plan", { editorial_status: "approved" }, "t5");

    // Simply running status again is what fires the event -- no separate command needed.
    text = formatStatus(SLUG);
    assert.match(text, /Phase 4 is complete/);
    assert.equal(hasCanonEvent(SLUG, `${SLUG}/phase-4-completed`), true);
    // No stale message from an earlier phase (checkpoint-1 cleared back at reachPhase4()) survives
    // into Phase 4's completed output -- confirms renderPhase1's block genuinely stops rendering
    // once current_phase has moved on, not just that it happens not to match by coincidence here.
    assert.doesNotMatch(text, /Checkpoint 1 is cleared/);
    assertNoLeak(text);
  });
});
