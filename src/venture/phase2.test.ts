import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { repoRoot } from "../db/db.js";
import { ventureDir } from "./paths.js";
import { appendCanonEvent } from "./canon.js";
import { readArtifact, transitionArtifact, type Evidence } from "./artifacts.js";
import { clearCheckpoint } from "./checkpoint.js";

// Exercises the real CLI as a subprocess, same discipline as research-gate.test.ts (avoids
// fighting process.argv/stdin mutation across tests, tests the actual contract).
const SCRIPT = join(repoRoot, "src", "venture", "phase2.ts");
const PHASE1_SCRIPT = join(repoRoot, "src", "venture", "phase1.ts");
const SLUG = "zz-test-phase2";

function runCmd(sub: string, rest: string[], stdin = ""): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync("npx", ["tsx", SCRIPT, sub, SLUG, ...rest], {
    cwd: repoRoot,
    input: stdin,
    encoding: "utf8",
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

// Phase 1 commands needed to seed a venture up through Phase 2 unlock -- run against phase1.ts's
// own CLI rather than hand-faking canon/decision state.
function runPhase1(sub: string, rest: string[], stdin = ""): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync("npx", ["tsx", PHASE1_SCRIPT, sub, SLUG, ...rest], {
    cwd: repoRoot,
    input: stdin,
    encoding: "utf8",
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

afterEach(() => {
  rmSync(ventureDir(SLUG), { recursive: true, force: true });
});

const REQUIRED_SOURCES = [
  "note_reply",
  "essay_comment",
  "metric",
  "subscriber_movement",
  "dm",
  "email",
  "follow_up_question",
  "creator_observation",
];
const SIGNAL_FACTORS = [
  "audience_fit",
  "specificity",
  "explicit_stuck_point",
  "requested_help",
  "follow_up_question",
  "recurrence",
  "behavioral_action",
  "exposure_context",
];
const CONCEPT_FACTORS = ["early_problem", "narrowness", "frustration", "fast_win", "proof_fit", "research_value"];

function fullCollectionCoverage(): { source: string; status: string }[] {
  return REQUIRED_SOURCES.map((source) => ({ source, status: "complete" }));
}

function fullRationale(): { factor: string; status: string; evidence_refs: string[] }[] {
  return SIGNAL_FACTORS.map((factor) => ({ factor, status: "present", evidence_refs: ["obs:o-1"] }));
}

function wellFormedFinding(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    finding_id: "f-001",
    finding_origin: "planned",
    unknown_ids: ["u1"],
    evidence_refs: ["obs:o-1"],
    signal_quality_rationale: fullRationale(),
    ...overrides,
  };
}

// Seeds a venture all the way through Checkpoint 1 -> research read -> reviewed -> continuation
// selected proceed_with_evidence, i.e. Phase 2 unlocked, via the real phase1.ts CLI chain.
function seedPhase2Unlocked(): void {
  appendCanonEvent(SLUG, "checkpoint-cleared", `${SLUG}/checkpoint-1`, {}, "2026-08-19T00:00:00.000Z");
  runPhase1(
    "plan-init",
    [],
    JSON.stringify({
      confirmed_knowns: [],
      open_unknowns: [{ unknown_id: "u1", dimension: "emotional_frame", description: "d" }],
      probes: [],
    })
  );
  const finding = wellFormedFinding();
  runPhase1("research-read-init", [], JSON.stringify({ collection_coverage: fullCollectionCoverage(), findings: [finding] }));
  runPhase1("research-read-review", []);
  runPhase1(
    "continuation",
    [],
    JSON.stringify({
      input_refs: ["p1-research-plan", "p1-research-read"],
      candidates: [
        { candidate_id: "more_probes", label: "more_probes", scores: {}, evidence_refs: [], rationale: "r" },
        { candidate_id: "proceed_with_evidence", label: "proceed_with_evidence", scores: {}, evidence_refs: [], rationale: "r" },
        { candidate_id: "proceed_as_hypothesis", label: "proceed_as_hypothesis", scores: {}, evidence_refs: [], rationale: "r" },
      ],
      recommended_candidate_ids: ["proceed_with_evidence"],
    })
  );
  runPhase1("continuation-select", ["proceed_with_evidence"]);
}

function fiveConcepts(overrides: Record<string, unknown>[] = []): Record<string, unknown>[] {
  const base = Array.from({ length: 5 }, (_, i) => ({
    candidate_id: `concept-${i + 1}`,
    label: `concept ${i + 1}`,
    scores: Object.fromEntries(CONCEPT_FACTORS.map((f) => [f, 3])),
    evidence_refs: [],
    rationale: "r",
  }));
  for (const o of overrides) {
    const idx = base.findIndex((c) => c.candidate_id === o.candidate_id);
    if (idx >= 0) base[idx] = { ...base[idx], ...o };
  }
  return base;
}

function seedConceptSelected(): void {
  seedPhase2Unlocked();
  runCmd(
    "concepts",
    [],
    JSON.stringify({ input_refs: [], candidates: fiveConcepts(), recommended_candidate_ids: ["concept-1"] })
  );
  runCmd("concept-select", ["concept-1"]);
}

function wellFormedMagnetInput(): Record<string, unknown> {
  return {
    title: "Fix your first broken workflow",
    intro: "A short guide to fixing one thing that's slowing you down.",
    sections: ["Find the bottleneck", "Fix it in ten minutes"],
    action_step: "Pick one workflow and fix it today.",
    feedback_prompt: "What did you fix?",
    claim_refs: [],
  };
}

function seedMagnetDrafted(): void {
  seedConceptSelected();
  runCmd("magnet-draft", [], JSON.stringify(wellFormedMagnetInput()));
}

function wellFormedFitAssessment(overrides: Partial<Record<number, Partial<{ fits_chosen_magnet: boolean; note: string }>>> = {}): Record<string, unknown>[] {
  return [1, 2, 3, 4].map((q) => ({
    question_number: q,
    fits_chosen_magnet: true,
    note: "fits fine",
    ...(overrides[q] ?? {}),
  }));
}

function seedSurveyReviewed(): void {
  seedMagnetDrafted();
  runCmd(
    "survey-review",
    [],
    JSON.stringify({
      existing_survey_snapshot: "the 4-question survey text",
      fit_assessment: wellFormedFitAssessment(),
      recommended_changes: [],
      change_needed: false,
    })
  );
}

describe("phase-2-unlock gate", () => {
  test("concepts refused before requirePhase2Unlocked passes (no continuation decision yet)", () => {
    const r = runCmd(
      "concepts",
      [],
      JSON.stringify({ input_refs: [], candidates: fiveConcepts(), recommended_candidate_ids: ["concept-1"] })
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /is not selected yet/);
  });

  test("concepts refused when continuation selected more_probes", () => {
    appendCanonEvent(SLUG, "checkpoint-cleared", `${SLUG}/checkpoint-1`, {}, "2026-08-19T00:00:00.000Z");
    runPhase1(
      "plan-init",
      [],
      JSON.stringify({
        confirmed_knowns: [],
        open_unknowns: [{ unknown_id: "u1", dimension: "emotional_frame", description: "d" }],
        probes: [],
      })
    );
    const finding = wellFormedFinding();
    runPhase1("research-read-init", [], JSON.stringify({ collection_coverage: fullCollectionCoverage(), findings: [finding] }));
    runPhase1("research-read-review", []);
    runPhase1(
      "continuation",
      [],
      JSON.stringify({
        input_refs: ["p1-research-plan", "p1-research-read"],
        candidates: [
          { candidate_id: "more_probes", label: "more_probes", scores: {}, evidence_refs: [], rationale: "r" },
          { candidate_id: "proceed_with_evidence", label: "proceed_with_evidence", scores: {}, evidence_refs: [], rationale: "r" },
          { candidate_id: "proceed_as_hypothesis", label: "proceed_as_hypothesis", scores: {}, evidence_refs: [], rationale: "r" },
        ],
        recommended_candidate_ids: ["proceed_with_evidence"],
      })
    );
    runPhase1("continuation-select", ["more_probes", "--override-reason", "evidence too thin"]);
    const r = runCmd(
      "concepts",
      [],
      JSON.stringify({ input_refs: [], candidates: fiveConcepts(), recommended_candidate_ids: ["concept-1"] })
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /selected "more_probes"/);
  });
});

describe("concepts validation", () => {
  test("refused when candidate count != 5", () => {
    seedPhase2Unlocked();
    const r = runCmd(
      "concepts",
      [],
      JSON.stringify({ input_refs: [], candidates: fiveConcepts().slice(0, 4), recommended_candidate_ids: [] })
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /expected exactly 5 concept candidates/);
  });

  test("refused when a candidate is missing a factor score", () => {
    seedPhase2Unlocked();
    const candidates = fiveConcepts();
    delete (candidates[0].scores as Record<string, number>).proof_fit;
    const r = runCmd("concepts", [], JSON.stringify({ input_refs: [], candidates, recommended_candidate_ids: [] }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /missing a score for factor "proof_fit"/);
  });

  test("refused when a factor score is out of the 1-5 scale", () => {
    seedPhase2Unlocked();
    const candidates = fiveConcepts();
    (candidates[0].scores as Record<string, number>).fast_win = 9;
    const r = runCmd("concepts", [], JSON.stringify({ input_refs: [], candidates, recommended_candidate_ids: [] }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /outside the 1-5 scale/);
  });

  test("a thin-evidence-marked concept missing label_as_hypothesis is refused", () => {
    seedPhase2Unlocked();
    const candidates = fiveConcepts([{ candidate_id: "concept-1", thin_evidence: true }]);
    const r = runCmd("concepts", [], JSON.stringify({ input_refs: [], candidates, recommended_candidate_ids: [] }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /missing label_as_hypothesis: true/);
  });

  test("a thin-evidence-marked concept WITH label_as_hypothesis succeeds", () => {
    seedPhase2Unlocked();
    const candidates = fiveConcepts([{ candidate_id: "concept-1", thin_evidence: true, label_as_hypothesis: true }]);
    const r = runCmd("concepts", [], JSON.stringify({ input_refs: [], candidates, recommended_candidate_ids: ["concept-1"] }));
    assert.equal(r.status, 0);
    assert.match(r.stdout, /wrote p2-concept-01/);
  });
});

describe("concept-select override reason", () => {
  test("selecting a non-recommended candidate without --override-reason is refused", () => {
    seedPhase2Unlocked();
    runCmd(
      "concepts",
      [],
      JSON.stringify({ input_refs: [], candidates: fiveConcepts(), recommended_candidate_ids: ["concept-1"] })
    );
    const r = runCmd("concept-select", ["concept-2"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /--override-reason/);
  });

  test("selecting the recommended candidate needs no override reason", () => {
    seedPhase2Unlocked();
    runCmd(
      "concepts",
      [],
      JSON.stringify({ input_refs: [], candidates: fiveConcepts(), recommended_candidate_ids: ["concept-1"] })
    );
    const r = runCmd("concept-select", ["concept-1"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /concept selected: concept-1/);
  });
});

describe("magnet-draft", () => {
  test("refused before a concept is selected", () => {
    seedPhase2Unlocked();
    const r = runCmd("magnet-draft", [], JSON.stringify(wellFormedMagnetInput()));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /lead-magnet-concept is not selected/);
  });

  test("succeeds once a concept is selected", () => {
    seedConceptSelected();
    const r = runCmd("magnet-draft", [], JSON.stringify(wellFormedMagnetInput()));
    assert.equal(r.status, 0);
    assert.match(r.stdout, /drafted p2-lead-magnet/);
  });

  test("rejects an em dash", () => {
    seedConceptSelected();
    const input = { ...wellFormedMagnetInput(), intro: "A guide — for real." };
    const r = runCmd("magnet-draft", [], JSON.stringify(input));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /em dash/);
  });

  test("rejects empty sections array", () => {
    seedConceptSelected();
    const input = { ...wellFormedMagnetInput(), sections: [] };
    const r = runCmd("magnet-draft", [], JSON.stringify(input));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /sections must be a non-empty array/);
  });
});

describe("landing-page-draft", () => {
  function wellFormedLandingPageInput(): Record<string, unknown> {
    return {
      headline: "Fix your first broken workflow",
      benefit_1: "Save an hour a week",
      benefit_2: "Stop losing track of tasks",
      benefit_3: "Feel in control again",
      button_label: "Get the guide",
    };
  }

  test("missing a PDF-minimum field is refused", () => {
    seedConceptSelected();
    const input = wellFormedLandingPageInput();
    delete (input as Record<string, unknown>).benefit_2;
    const r = runCmd("landing-page-draft", [], JSON.stringify(input));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /missing required field\(s\): benefit_2/);
  });

  test("missing an optional field succeeds", () => {
    seedConceptSelected();
    const r = runCmd("landing-page-draft", [], JSON.stringify(wellFormedLandingPageInput()));
    assert.equal(r.status, 0);
    assert.match(r.stdout, /drafted p2-landing-page/);
    const artifact = readArtifact(SLUG, "p2-landing-page");
    assert.equal(artifact?.fields?.form_intro, null);
    assert.equal(artifact?.fields?.thank_you_message, null);
    assert.equal(artifact?.fields?.privacy_copy, null);
  });
});

describe("survey-review", () => {
  test("fewer than 4 fit_assessment entries is refused", () => {
    seedMagnetDrafted();
    const r = runCmd(
      "survey-review",
      [],
      JSON.stringify({
        existing_survey_snapshot: "snapshot",
        fit_assessment: wellFormedFitAssessment().slice(0, 3),
        recommended_changes: [],
        change_needed: false,
      })
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /must have exactly 4 entries/);
  });

  test("more than 4 fit_assessment entries is refused", () => {
    seedMagnetDrafted();
    const fit = wellFormedFitAssessment();
    const r = runCmd(
      "survey-review",
      [],
      JSON.stringify({
        existing_survey_snapshot: "snapshot",
        fit_assessment: [...fit, { question_number: 4, fits_chosen_magnet: true, note: "extra" }],
        recommended_changes: [],
        change_needed: false,
      })
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /must have exactly 4 entries/);
  });

  test("duplicate question_numbers is refused", () => {
    seedMagnetDrafted();
    const fit = wellFormedFitAssessment().map((f, i) => (i === 3 ? { ...f, question_number: 3 } : f));
    const r = runCmd(
      "survey-review",
      [],
      JSON.stringify({ existing_survey_snapshot: "snapshot", fit_assessment: fit, recommended_changes: [], change_needed: false })
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /duplicate question_number/);
  });

  test("fits_chosen_magnet: false with empty recommended_changes is refused", () => {
    seedMagnetDrafted();
    const r = runCmd(
      "survey-review",
      [],
      JSON.stringify({
        existing_survey_snapshot: "snapshot",
        fit_assessment: wellFormedFitAssessment({ 3: { fits_chosen_magnet: false, note: "doesn't fit" } }),
        recommended_changes: [],
        change_needed: true,
      })
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /recommended_changes must be non-empty/);
  });

  test("a well-formed all-fits review succeeds", () => {
    seedMagnetDrafted();
    const r = runCmd(
      "survey-review",
      [],
      JSON.stringify({
        existing_survey_snapshot: "snapshot",
        fit_assessment: wellFormedFitAssessment(),
        recommended_changes: [],
        change_needed: false,
      })
    );
    assert.equal(r.status, 0);
    assert.match(r.stdout, /wrote p2-survey-review/);
  });
});

describe("survey-review-approve", () => {
  test("sets reviewed_by_muxin true and reviewed_at", () => {
    seedSurveyReviewed();
    const r = runCmd("survey-review-approve", []);
    assert.equal(r.status, 0);
    const artifact = readArtifact(SLUG, "p2-survey-review");
    assert.equal(artifact?.fields?.reviewed_by_muxin, true);
    assert.ok(artifact?.fields?.reviewed_at);
  });
});

describe("welcome-email-draft", () => {
  function wellFormedWelcomeEmailInput(): Record<string, unknown> {
    return {
      subject: "Here's your guide",
      preview_text: "One fix, ten minutes",
      body: "Thanks for signing up. Here's the guide.",
      lead_magnet_link_text: "Get the guide",
      lead_magnet_destination: "https://humaninference.ai/guide",
      survey_question_or_link: "https://humaninference.ai/survey",
      claim_refs: [],
    };
  }

  test("refused when neither the magnet nor the survey artifact exists", () => {
    seedPhase2Unlocked();
    const r = runCmd("welcome-email-draft", [], JSON.stringify(wellFormedWelcomeEmailInput()));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /missing: lead-magnet, survey/);
  });

  test("refused when the magnet exists but the survey doesn't", () => {
    seedMagnetDrafted();
    const r = runCmd("welcome-email-draft", [], JSON.stringify(wellFormedWelcomeEmailInput()));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /missing: survey/);
  });

  test("succeeds once both the magnet and the survey exist", () => {
    seedSurveyReviewed();
    const r = runCmd("welcome-email-draft", [], JSON.stringify(wellFormedWelcomeEmailInput()));
    assert.equal(r.status, 0);
    assert.match(r.stdout, /drafted p2-welcome-email/);
  });
});

describe("announcement-draft", () => {
  test("succeeds and its artifact has checkpoint_id: null", () => {
    seedMagnetDrafted();
    const r = runCmd(
      "announcement-draft",
      [],
      JSON.stringify({
        title: "The guide is live",
        body: "I made a short guide to fix one broken workflow. It bridges from the free guide above.",
        claim_refs: [],
        bridges_to_lead_magnet: true,
      })
    );
    assert.equal(r.status, 0);
    assert.match(r.stdout, /drafted p2-announcement/);
    const artifact = readArtifact(SLUG, "p2-announcement");
    assert.equal(artifact?.checkpoint_id, null);
  });

  test("refused without a lead magnet", () => {
    seedConceptSelected();
    const r = runCmd(
      "announcement-draft",
      [],
      JSON.stringify({ title: "t", body: "b", claim_refs: [], bridges_to_lead_magnet: true })
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /requires a lead-magnet artifact to exist/);
  });
});

describe("Checkpoint 2 clears with all 4 required kinds live even with no announcement drafted", () => {
  test("clears once lead-magnet, landing-page-copy, welcome-email, and survey are all approved+live, with NO announcement drafted at all", () => {
    seedSurveyReviewed();
    runCmd(
      "welcome-email-draft",
      [],
      JSON.stringify({
        subject: "Here's your guide",
        preview_text: "One fix, ten minutes",
        body: "Thanks for signing up. Here's the guide.",
        lead_magnet_link_text: "Get the guide",
        lead_magnet_destination: "https://humaninference.ai/guide",
        survey_question_or_link: "https://humaninference.ai/survey",
        claim_refs: [],
      })
    );
    runCmd(
      "landing-page-draft",
      [],
      JSON.stringify({
        headline: "Fix your first broken workflow",
        benefit_1: "Save an hour a week",
        benefit_2: "Stop losing track of tasks",
        benefit_3: "Feel in control again",
        button_label: "Get the guide",
      })
    );

    // Approve (via phase2.ts's own approve command, exercising the extracted artifact-lifecycle
    // functions), then confirm delivery live for exactly the 4 required kinds -- deliver.ts's job
    // in the real flow, done directly here via transitionArtifact since delivery confirmation
    // isn't part of phase2.ts's own surface. No announcement is drafted at all in this test.
    const evidenceFor: Record<string, Evidence["type"]> = {
      "p2-lead-magnet": "url",
      "p2-survey-review": "url",
      "p2-welcome-email": "attestation",
      "p2-landing-page": "url",
    };
    for (const id of Object.keys(evidenceFor)) {
      const approveResult = runCmd("approve", [id]);
      assert.equal(approveResult.status, 0, `approve ${id} failed: ${approveResult.stderr}`);
      transitionArtifact(
        SLUG,
        id,
        { delivery_status: "live_confirmed", evidence: { type: evidenceFor[id], value: "https://humaninference.ai/x", confirmed_by: "muxin" } },
        "2026-08-19T00:00:00.000Z"
      );
    }

    const r = clearCheckpoint(SLUG, "checkpoint-2", "2026-08-19T00:01:00.000Z");
    assert.equal(r.cleared, true);
    assert.equal(r.alreadyCleared, false);
    assert.equal(readArtifact(SLUG, "p2-announcement"), undefined);
  });
});
