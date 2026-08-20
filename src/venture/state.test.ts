import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { deriveState } from "./state.js";
import { createArtifact, transitionArtifact } from "./artifacts.js";
import { appendCanonEvent, hasCanonEvent } from "./canon.js";
import { writeDecision, selectDecision, type DecisionKind } from "./decisions.js";
import { maybeCompletePhase4 } from "./phase4.js";
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
    assert.equal(state.checkpoints["checkpoint-1"].cleared, false);
  });

  test("2 of 3 live does not clear -- no partial pass", () => {
    seedRequiredArtifact("p1-a");
    seedRequiredArtifact("p1-b");
    seedRequiredArtifact("p1-c");
    makeLive("p1-a");
    makeLive("p1-b");
    const state = deriveState(SLUG, 3);
    assert.equal(state.checkpoints["checkpoint-1"].complete_count, 2);
    assert.equal(state.checkpoints["checkpoint-1"].cleared, false);
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
    assert.equal(state.checkpoints["checkpoint-1"].pace_recorded, false);
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
    assert.equal(state.checkpoints["checkpoint-1"].pace_recorded, true);
    assert.equal(state.checkpoints["checkpoint-1"].cleared, false);
    assert.equal(state.phase_status, "checkpoint_ready");
  });

  // CHANGED (was testing the pre-existing bug): this used to assert phase_status reads "complete"
  // the instant checkpoint-1 clears. Per docs/venture-schema-contract.md §5.2, "complete" means
  // "the venture finished Phase 4 and its Day 14 review" -- checkpoint-1 clearing only advances
  // current_phase to 2, it does not finish the venture. phase_status now reads whichever phase is
  // actually current (see state.ts's deriveState comment on the fix), so it reads "drafting" here:
  // current_phase is 2, and checkpoint-2 has no required items seeded yet in this test.
  test("a checkpoint-cleared canon event on checkpoint-1 advances current_phase, not phase_status to complete", () => {
    seedRequiredArtifact("p1-a");
    seedRequiredArtifact("p1-b");
    seedRequiredArtifact("p1-c");
    makeLive("p1-a");
    makeLive("p1-b");
    makeLive("p1-c");
    appendCanonEvent(SLUG, "pace-recorded", `${SLUG}/phase-1/pace`, { per_week: "5" }, "t3");
    appendCanonEvent(SLUG, "checkpoint-cleared", `${SLUG}/checkpoint-1`, { complete: "3" }, "t4");
    const state = deriveState(SLUG, 3);
    assert.equal(state.checkpoints["checkpoint-1"].cleared, true);
    assert.equal(state.current_phase, 2);
    assert.equal(state.phase_status, "drafting");
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
    assert.equal(state.checkpoints["checkpoint-1"].complete_count, 0);
    assert.match(state.checkpoints["checkpoint-1"].blocking[0].reason, /does not meet this kind's minimum/);
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
    assert.equal(state.checkpoints["checkpoint-1"].complete_count, 0);
  });

  // CHANGED (was testing the pre-existing bug, same as above): idempotence itself is still the
  // point of this test, just no longer pinned to the buggy "complete" reading. current_phase 2 /
  // phase_status "drafting" both stay stable across repeated deriveState() calls.
  test("rerunning deriveState after clearing is idempotent", () => {
    seedRequiredArtifact("p1-a");
    appendCanonEvent(SLUG, "checkpoint-cleared", `${SLUG}/checkpoint-1`, {}, "t0");
    const first = deriveState(SLUG, 1);
    const second = deriveState(SLUG, 1);
    assert.equal(first.phase_status, second.phase_status);
    assert.equal(first.current_phase, second.current_phase);
    assert.equal(second.checkpoints["checkpoint-1"].cleared, true);
    assert.equal(second.current_phase, 2);
    assert.equal(second.phase_status, "drafting");
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
    assert.equal(state.checkpoints["checkpoint-1"].complete_count, 3);
    assert.equal(state.checkpoints["checkpoint-1"].required_count, 3);
    assert.equal(state.checkpoints["checkpoint-1"].pace_recorded, true);
    assert.equal(state.checkpoints["checkpoint-1"].cleared, false);
    assert.equal(state.checkpoints["checkpoint-1"].blocking.length, 0);
    assert.equal(state.checkpoints["checkpoint-1"].required.length, 3);
    assert.equal(state.phase_status, "checkpoint_ready");
    // checkpoint-2 is unconditionally computed too (rules.yaml now always has it), but that must
    // not perturb checkpoint1 or phase_status, which stay driven by checkpoint-1 alone.
    assert.ok(state.checkpoints["checkpoint-2"]);
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
    assert.ok(state.checkpoints["checkpoint-2"]);
    assert.equal(state.checkpoints["checkpoint-2"]!.complete_count, 3);
    assert.equal(state.checkpoints["checkpoint-2"]!.required_count, 4);
    assert.equal(state.checkpoints["checkpoint-2"]!.cleared, false);
    assert.ok(state.checkpoints["checkpoint-2"]!.blocking.some((b) => /missing required artifact kind "survey"/.test(b.reason)));
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
    assert.ok(state.checkpoints["checkpoint-2"]);
    assert.equal(state.checkpoints["checkpoint-2"]!.complete_count, 3);
    assert.equal(state.checkpoints["checkpoint-2"]!.cleared, false);
    assert.ok(
      state.checkpoints["checkpoint-2"]!.blocking.some(
        (b) => /does not meet this kind's minimum \("attestation"\)/.test(b.reason) && /"welcome-email"/.test(b.reason)
      )
    );
  });

  test("all 4 kinds correctly live reads checkpoint_ready on checkpoint2 with no pace requirement", () => {
    for (const kind of KINDS) seedCp2Artifact(kind, kind);
    for (const kind of KINDS) makeLiveWithEvidence(kind, correctEvidenceFor(kind));
    const state = deriveState(SLUG);
    assert.ok(state.checkpoints["checkpoint-2"]);
    assert.equal(state.checkpoints["checkpoint-2"]!.complete_count, 4);
    assert.equal(state.checkpoints["checkpoint-2"]!.required_count, 4);
    assert.equal(state.checkpoints["checkpoint-2"]!.blocking.length, 0);
    // checkpoint-2 has no require_pace_recorded in rules.yaml -- pace_recorded reads trivially
    // true without any pace ever being recorded, and it must never end up in blocking.
    assert.equal(state.checkpoints["checkpoint-2"]!.pace_recorded, true);
    assert.equal(state.checkpoints["checkpoint-2"]!.cleared, false); // not cleared until the canon event fires
  });
});

describe("deriveState -- Checkpoint 3 decisions (required_decision_kinds)", () => {
  const DECISION_KINDS: DecisionKind[] = ["problem-selection", "transformation-choice", "product-format-and-price"];

  function selectDecisionOfKind(kind: DecisionKind, id: string) {
    writeDecision(SLUG, {
      decision_id: id,
      decision_kind: kind,
      rules_version: rules.rules_version,
      input_refs: ["ref"],
      candidates: [{ candidate_id: "c1", label: "c1", scores: {}, evidence_refs: [], rationale: "r" }],
      recommended_candidate_ids: ["c1"],
      at: "t0",
    });
    selectDecision(SLUG, id, { selectedCandidateIds: ["c1"], selectedBy: "muxin", requiredSelectCount: 1, at: "t1" });
  }

  // checkpoint-1/checkpoint-2 declare no required_decision_kinds -- decisions_required_count must
  // read 0/0 for them, never perturbed by checkpoint-3's field existing in rules.yaml.
  test("checkpoint-1 and checkpoint-2 read 0/0 decisions, unaffected by checkpoint-3's required_decision_kinds", () => {
    const state = deriveState(SLUG);
    assert.equal(state.checkpoints["checkpoint-1"]!.decisions_required_count, 0);
    assert.equal(state.checkpoints["checkpoint-1"]!.decisions_complete_count, 0);
    assert.equal(state.checkpoints["checkpoint-2"]!.decisions_required_count, 0);
    assert.equal(state.checkpoints["checkpoint-2"]!.decisions_complete_count, 0);
  });

  test("no decisions selected -- checkpoint-3 reads 0/3, blocking names all three missing decision kinds", () => {
    const state = deriveState(SLUG);
    const cp3 = state.checkpoints["checkpoint-3"]!;
    assert.equal(cp3.decisions_required_count, 3);
    assert.equal(cp3.decisions_complete_count, 0);
    for (const kind of DECISION_KINDS) {
      assert.ok(cp3.blocking.some((b) => b.reason === `missing required decision kind "${kind}"`));
    }
  });

  test("2 of 3 decisions selected -- checkpoint-3 reads 2/3, blocking names only the unselected kind", () => {
    selectDecisionOfKind("problem-selection", "d-0");
    selectDecisionOfKind("transformation-choice", "d-1");
    const state = deriveState(SLUG);
    const cp3 = state.checkpoints["checkpoint-3"]!;
    assert.equal(cp3.decisions_complete_count, 2);
    assert.equal(cp3.decisions_required_count, 3);
    // Product-outline/price-decision artifacts are never seeded in this describe block, so
    // blocking also carries their "missing required artifact kind" entries -- filter to the
    // decision-shaped reasons this test actually cares about.
    const decisionBlocking = cp3.blocking.filter((b) => /^missing required decision kind/.test(b.reason));
    assert.deepEqual(
      decisionBlocking.map((b) => b.reason),
      ['missing required decision kind "product-format-and-price"']
    );
  });

  test("all 3 decisions selected -- checkpoint-3 reads 3/3 decisions, no decision blocking entries", () => {
    for (const [i, kind] of DECISION_KINDS.entries()) selectDecisionOfKind(kind, `d-${i}`);
    const state = deriveState(SLUG);
    const cp3 = state.checkpoints["checkpoint-3"]!;
    assert.equal(cp3.decisions_complete_count, 3);
    assert.equal(cp3.decisions_required_count, 3);
    assert.equal(cp3.blocking.filter((b) => /missing required decision kind/.test(b.reason)).length, 0);
  });
});

describe("deriveState -- current_phase", () => {
  test("no checkpoints cleared reads current_phase 1", () => {
    const state = deriveState(SLUG);
    assert.equal(state.current_phase, 1);
  });

  test("checkpoint-1 cleared (checkpoint-2 not) reads current_phase 2", () => {
    appendCanonEvent(SLUG, "checkpoint-cleared", `${SLUG}/checkpoint-1`, {}, "t0");
    const state = deriveState(SLUG);
    assert.equal(state.current_phase, 2);
  });

  test("checkpoint-1 and checkpoint-2 both cleared reads current_phase 3", () => {
    appendCanonEvent(SLUG, "checkpoint-cleared", `${SLUG}/checkpoint-1`, {}, "t0");
    appendCanonEvent(SLUG, "checkpoint-cleared", `${SLUG}/checkpoint-2`, {}, "t1");
    const state = deriveState(SLUG);
    assert.equal(state.current_phase, 3);
  });

  // checkpoint-3 clears as the `<slug>/phase-3-completed` ledger event (rules.yaml's
  // ledger_event_id), not the generic `<slug>/checkpoint-3` -- see ledgerEventId's comment.
  test("checkpoint-1, checkpoint-2, and checkpoint-3 all cleared reads current_phase 4", () => {
    appendCanonEvent(SLUG, "checkpoint-cleared", `${SLUG}/checkpoint-1`, {}, "t0");
    appendCanonEvent(SLUG, "checkpoint-cleared", `${SLUG}/checkpoint-2`, {}, "t1");
    appendCanonEvent(SLUG, "checkpoint-cleared", `${SLUG}/phase-3-completed`, {}, "t2");
    const state = deriveState(SLUG);
    assert.equal(state.current_phase, 4);
  });
});

describe("deriveState -- Phase 4", () => {
  const rules = loadRules();

  function reachPhase4() {
    appendCanonEvent(SLUG, "checkpoint-cleared", `${SLUG}/checkpoint-1`, {}, "t0");
    appendCanonEvent(SLUG, "checkpoint-cleared", `${SLUG}/checkpoint-2`, {}, "t1");
    appendCanonEvent(SLUG, "checkpoint-cleared", `${SLUG}/phase-3-completed`, {}, "t2");
  }

  function selectDecisionOfKind(kind: DecisionKind, id: string) {
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

  // daily-operating-plan and day-14-review are both delivery_mode "none" (rules.yaml) -- approving
  // them is enough, there is no delivery step to confirm, same as product-outline/price-decision
  // in Phase 3 (state.test.ts's Checkpoint 3 fixtures follow the identical shape).
  function seedPhase4Artifact(kind: ArtifactKind, id: string) {
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

  function approve(id: string) {
    transitionArtifact(SLUG, id, { editorial_status: "approved" }, "t4");
  }

  test("nothing drafted yet reads current_phase 4, phase_status drafting, phase4.complete false", () => {
    reachPhase4();
    const state = deriveState(SLUG);
    assert.equal(state.current_phase, 4);
    assert.equal(state.phase_status, "drafting");
    assert.equal(state.phase4.complete, false);
    assert.equal(state.phase4.operating_plan.drafted, false);
  });

  test("operating plan drafted but not approved reads phase_status awaiting_you", () => {
    reachPhase4();
    seedPhase4Artifact("daily-operating-plan", "p4-operating-plan");
    const state = deriveState(SLUG);
    assert.equal(state.phase4.operating_plan.drafted, true);
    assert.equal(state.phase4.operating_plan.approved, false);
    assert.equal(state.phase_status, "awaiting_you");
  });

  // Reproduces WP2's flagged ordering gap: day-14-decide only requires the day-14-review artifact
  // approved, not the daily-operating-plan artifact -- nothing stops Muxin from deciding Day 14
  // first. This proves the READ side self-heals: deriveState() recomputes phase4CompletionSatisfied
  // fresh every call, so phase_status flips to "complete" the moment the operating plan is approved
  // -- even though nothing has called maybeCompletePhase4 yet, so the phase-4-completed canon event
  // is still unwritten at that point. status.test.ts covers the matching WRITE-side self-heal
  // (formatStatus's opportunistic maybeCompletePhase4 call actually firing that event).
  test("ordering gap: Day 14 decided before the operating plan is approved -- read self-heals once it is", () => {
    reachPhase4();
    // Day-14-decide's own prerequisites: both required decisions selected, day-14-review approved.
    // The operating plan ARTIFACT is drafted but deliberately left unapproved.
    selectDecisionOfKind("daily-operating-plan-choice", "d-mode");
    seedPhase4Artifact("daily-operating-plan", "p4-operating-plan");
    seedPhase4Artifact("day-14-review", "p4-day-14-review");
    approve("p4-day-14-review");
    selectDecisionOfKind("day-14-decision", "p4-day-14-decision");

    const before = deriveState(SLUG);
    assert.equal(before.phase4.complete, false);
    assert.notEqual(before.phase_status, "complete");
    assert.equal(hasCanonEvent(SLUG, `${SLUG}/phase-4-completed`), false);

    // Muxin now approves the operating plan -- the missing piece.
    approve("p4-operating-plan");

    const after = deriveState(SLUG);
    assert.equal(after.phase4.complete, true);
    assert.equal(after.phase_status, "complete");
    // The read is correct even though nothing has fired the ledger event yet -- proves this isn't
    // reading hasCanonEvent(phase-4-completed), it's recomputing the predicate fresh.
    assert.equal(hasCanonEvent(SLUG, `${SLUG}/phase-4-completed`), false);

    // Confirms the predicate really is satisfied, not just read-side optimism: the exported
    // maybeCompletePhase4 (the lazy WRITE side) can now fire the event from this same state.
    const completed = maybeCompletePhase4(SLUG, rules);
    assert.equal(completed, true);
    assert.equal(hasCanonEvent(SLUG, `${SLUG}/phase-4-completed`), true);
  });
});
