import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { repoRoot } from "../db/db.js";
import { ventureDir } from "./paths.js";
import { appendCanonEvent, hasCanonEvent } from "./canon.js";
import { readArtifact } from "./artifacts.js";
import { readDecision } from "./decisions.js";
import { ingestResponse } from "./responses.js";
import { kickoffVenture, INTAKE_QUESTIONS, type IntakeAnswers } from "./intake.js";
import { loadRules } from "./rules.js";

// Exercises the real CLI as a subprocess, same discipline as phase2.test.ts/phase3.test.ts.
const SCRIPT = join(repoRoot, "src", "venture", "phase4.ts");
const SLUG = "zz-test-phase4";

function runCmd(sub: string, rest: string[], stdin = ""): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync("npx", ["tsx", SCRIPT, sub, SLUG, ...rest], {
    cwd: repoRoot,
    input: stdin,
    encoding: "utf8",
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

// Arrange-step subprocess calls are expected to succeed -- same discipline as phase3.test.ts's
// identical helper.
function must(r: { status: number | null; stdout: string; stderr: string }, label: string): typeof r {
  assert.equal(r.status, 0, `${label} failed (exit ${r.status}): ${r.stderr}`);
  return r;
}

afterEach(() => {
  rmSync(ventureDir(SLUG), { recursive: true, force: true });
});

// ---- seeding helpers ----

function seedPhase4Unlocked(): void {
  appendCanonEvent(SLUG, "phase_3_completed", `${SLUG}/phase-3-completed`, {}, "t0");
}

function seedOperatingPlanDrafted(minutes = 135): void {
  seedPhase4Unlocked();
  must(runCmd("operating-plan-draft", [], JSON.stringify({ time_budget_minutes: minutes })), "operating-plan-draft");
}

function seedOperatingPlanSelected(mode = "canonical", minutes = 135): void {
  seedOperatingPlanDrafted(minutes);
  const args = mode === "canonical" ? [mode] : [mode, "--override-reason", "Muxin has less time this cycle"];
  must(runCmd("operating-plan-choice-select", args), "operating-plan-choice-select");
}

function wellFormedTriage(): Record<string, unknown>[] {
  return [
    { bucket: "never_build", item: "a support team", note: "would require hires Muxin does not want" },
    { bucket: "ignore", item: "a competitor's new feature launch", note: "not relevant to this venture" },
    { bucket: "automate", item: "welcome email delivery", note: "repeats on every signup, no judgment needed" },
  ];
}

function wellFormedAutomationOrder(): Record<string, unknown>[] {
  return [
    { step: 1, name: "lead-magnet delivery and welcome message", status: "configured" },
    { step: 2, name: "post-signup tagging", status: "configured" },
    { step: 3, name: "follow-up sequences", status: "planned" },
    { step: 4, name: "payments, receipts, and scheduling", status: "skipped_not_needed" },
  ];
}

function wellFormedOperatingPlanWriteInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    time_budget_minutes: 135,
    schedule: { monday: "content writing and engagement, 30 min" },
    triage: wellFormedTriage(),
    automation_order: wellFormedAutomationOrder(),
    ...overrides,
  };
}

function seedIntakeScorecard(overrides: Partial<{ views_or_clicks_target: string; opt_in_target: string }> = {}): void {
  const rules = loadRules();
  const answers: IntakeAnswers = {};
  for (const q of INTAKE_QUESTIONS) answers[q.id] = `answer to ${q.id}`;
  kickoffVenture({
    slug: SLUG,
    answers,
    voice: {
      writing_samples: ["https://example.com/sample"],
      worldview_statement: "test worldview",
      natural_phrases: ["kind of a big deal"],
      refused_phrases_tones: ["here's the thing"],
    },
    scorecard: {
      required_live_posts: 3,
      ongoing_pace: "5 posts/week",
      views_or_clicks_target: "learning_only",
      opt_in_target: "learning_only",
      response_quality_test: "at least one specific, on-topic reply per post",
      sustainability_test: "fits inside the 5 hrs/week declared in q20",
      ...overrides,
    },
    rules,
    at: "t0",
  });
}

function seedResponse(id: string): void {
  ingestResponse(
    SLUG,
    {
      source: "survey",
      receivedAt: "t0",
      targetAudienceEligible: true,
      exactQuote: "exact quote text",
      redactedQuote: "redacted quote text",
      stuckPoint: "cannot find enough hours in the week",
      emotionalIntensity: "medium",
      responseId: id,
    },
    "t0"
  );
}

function seedDayFourteenReviewApproved(): void {
  seedOperatingPlanSelected("canonical", 135);
  must(runCmd("operating-plan-write", [], JSON.stringify(wellFormedOperatingPlanWriteInput())), "operating-plan-write");
  must(runCmd("approve", ["p4-operating-plan"]), "approve operating-plan");
  seedIntakeScorecard();
  must(runCmd("day-14-scorecard-draft", [], JSON.stringify({})), "day-14-scorecard-draft");
  must(runCmd("approve", ["p4-day-14-review"]), "approve day-14-review");
}

// ==== gate: requirePhase4Unlocked ====

describe("Phase 4 gate: requirePhase4Unlocked", () => {
  for (const [sub, args, stdin] of [
    ["time-budget-compare", [], JSON.stringify({ time_budget_minutes: 135 })],
    ["operating-plan-draft", [], JSON.stringify({ time_budget_minutes: 135 })],
    ["operating-plan-choice-select", ["canonical"], ""],
    ["operating-plan-write", [], JSON.stringify(wellFormedOperatingPlanWriteInput())],
    ["approve", ["p4-operating-plan"], ""],
    ["discard", ["p4-operating-plan"], ""],
    ["restore", ["p4-operating-plan"], ""],
    ["list", [], ""],
  ] as [string, string[], string][]) {
    test(`"${sub}" refuses before phase-3-completed is recorded`, () => {
      const r = runCmd(sub, args, stdin);
      assert.equal(r.status, 1);
      assert.match(r.stderr, /phase-3-completed is not recorded yet/);
    });
  }

  test("commands proceed past the gate once phase-3-completed is recorded", () => {
    seedPhase4Unlocked();
    const r = runCmd("time-budget-compare", [], JSON.stringify({ time_budget_minutes: 135 }));
    assert.equal(r.status, 0, r.stderr);
  });
});

// ==== time-budget-compare ====

describe("time-budget-compare", () => {
  test("reports fits when the budget covers the canonical 135 minutes", () => {
    seedPhase4Unlocked();
    const r = runCmd("time-budget-compare", [], JSON.stringify({ time_budget_minutes: 135 }));
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /fits: 135 minutes/);
  });

  test("reports does-not-fit and names all 4 options when the budget is short", () => {
    seedPhase4Unlocked();
    const r = runCmd("time-budget-compare", [], JSON.stringify({ time_budget_minutes: 60 }));
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /does not fit: 60 minutes/);
    assert.match(r.stdout, /all 4 options/);
  });

  test("rejects a non-positive time budget", () => {
    seedPhase4Unlocked();
    const r = runCmd("time-budget-compare", [], JSON.stringify({ time_budget_minutes: 0 }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /must be a positive number/);
  });
});

// ==== operating-plan-draft ====

describe("operating-plan-draft", () => {
  test("recommends canonical when the budget fits", () => {
    seedPhase4Unlocked();
    const r = runCmd("operating-plan-draft", [], JSON.stringify({ time_budget_minutes: 135 }));
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /canonical recommended/);
  });

  test("recommends nothing when the budget does not fit", () => {
    seedPhase4Unlocked();
    const r = runCmd("operating-plan-draft", [], JSON.stringify({ time_budget_minutes: 60 }));
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /no mode recommended/);
  });

  test("writes all 4 modes as candidates", () => {
    seedPhase4Unlocked();
    must(runCmd("operating-plan-draft", [], JSON.stringify({ time_budget_minutes: 135 })), "operating-plan-draft");
    const r = runCmd("operating-plan-choice-select", ["revised_scope", "--override-reason", "testing"]);
    assert.equal(r.status, 0, r.stderr);
  });

  test("refuses to re-draft once the decision is already selected", () => {
    seedOperatingPlanSelected();
    const r = runCmd("operating-plan-draft", [], JSON.stringify({ time_budget_minutes: 135 }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /already selected/);
  });
});

// ==== operating-plan-choice-select ====

describe("operating-plan-choice-select", () => {
  test("selecting the recommended mode needs no override reason", () => {
    seedOperatingPlanDrafted(135);
    const r = runCmd("operating-plan-choice-select", ["canonical"]);
    assert.equal(r.status, 0, r.stderr);
  });

  test("selecting a non-recommended mode without --override-reason is refused", () => {
    seedOperatingPlanDrafted(135);
    const r = runCmd("operating-plan-choice-select", ["rotated"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /not the recommended operating-plan mode/);
  });

  test("selecting a non-recommended mode with --override-reason succeeds", () => {
    seedOperatingPlanDrafted(135);
    const r = runCmd("operating-plan-choice-select", ["rotated", "--override-reason", "Muxin prefers to rotate"]);
    assert.equal(r.status, 0, r.stderr);
  });
});

// ==== operating-plan-write ====

describe("operating-plan-write", () => {
  test("refuses before the decision is selected", () => {
    seedOperatingPlanDrafted(135);
    const r = runCmd("operating-plan-write", [], JSON.stringify(wellFormedOperatingPlanWriteInput()));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /daily-operating-plan-choice is not selected/);
  });

  test("a well-formed write succeeds and stores fields", () => {
    seedOperatingPlanSelected("canonical", 135);
    const r = runCmd("operating-plan-write", [], JSON.stringify(wellFormedOperatingPlanWriteInput()));
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /drafted p4-operating-plan \(daily-operating-plan, mode canonical\) -- awaiting Muxin's approval/);
    const a = readArtifact(SLUG, "p4-operating-plan");
    assert.ok(a);
    assert.equal(a!.fields?.chosen_mode, "canonical");
    assert.equal(a!.checkpoint_id, null);
    assert.equal(a!.venture_phase, 4);
  });

  test("refuses a chosen_mode on stdin that disagrees with the selected decision", () => {
    seedOperatingPlanSelected("canonical", 135);
    const r = runCmd("operating-plan-write", [], JSON.stringify(wellFormedOperatingPlanWriteInput({ chosen_mode: "rotated" })));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /does not match the selected daily-operating-plan-choice candidate/);
  });

  test("refuses a triage bucket outside the 3 valid values", () => {
    seedOperatingPlanSelected("canonical", 135);
    const input = wellFormedOperatingPlanWriteInput({
      triage: [{ bucket: "sometimes", item: "x", note: "y" }],
    });
    const r = runCmd("operating-plan-write", [], JSON.stringify(input));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /invalid bucket "sometimes"/);
  });

  test("refuses an automate-bucket item naming 'insight'", () => {
    seedOperatingPlanSelected("canonical", 135);
    const input = wellFormedOperatingPlanWriteInput({
      triage: [{ bucket: "automate", item: "audience insight synthesis", note: "weekly" }],
    });
    const r = runCmd("operating-plan-write", [], JSON.stringify(input));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /names "insight"/);
  });

  test("refuses an automate-bucket item naming 'final approval'", () => {
    seedOperatingPlanSelected("canonical", 135);
    const input = wellFormedOperatingPlanWriteInput({
      triage: [{ bucket: "automate", item: "sign-off step", note: "this is the final approval before it ships" }],
    });
    const r = runCmd("operating-plan-write", [], JSON.stringify(input));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /names "final approval"/);
  });

  test("refuses an automation_order with a real ordering gap (step 3 present, steps 1/2 absent)", () => {
    seedOperatingPlanSelected("canonical", 135);
    const input = wellFormedOperatingPlanWriteInput({
      automation_order: [{ step: 3, name: "follow-up sequences", status: "planned" }],
    });
    const r = runCmd("operating-plan-write", [], JSON.stringify(input));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /missing step 1/);
  });

  test("allows a skipped_not_needed-status entry to satisfy an earlier step's presence", () => {
    seedOperatingPlanSelected("canonical", 135);
    const input = wellFormedOperatingPlanWriteInput({
      automation_order: [
        { step: 1, name: "lead-magnet delivery and welcome message", status: "skipped_not_needed" },
        { step: 2, name: "post-signup tagging", status: "configured" },
        { step: 3, name: "follow-up sequences", status: "configured" },
      ],
    });
    const r = runCmd("operating-plan-write", [], JSON.stringify(input));
    assert.equal(r.status, 0, r.stderr);
  });

  test("refuses an em dash in a triage note", () => {
    seedOperatingPlanSelected("canonical", 135);
    const input = wellFormedOperatingPlanWriteInput({
      triage: [{ bucket: "ignore", item: "x", note: "not relevant — skip it" }],
    });
    const r = runCmd("operating-plan-write", [], JSON.stringify(input));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /em dash/);
  });

  test("refuses to re-draft once the artifact is already approved", () => {
    seedOperatingPlanSelected("canonical", 135);
    must(runCmd("operating-plan-write", [], JSON.stringify(wellFormedOperatingPlanWriteInput())), "operating-plan-write");
    must(runCmd("approve", ["p4-operating-plan"]), "approve");
    const r = runCmd("operating-plan-write", [], JSON.stringify(wellFormedOperatingPlanWriteInput()));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /already approved/);
  });
});

// ==== approve: delivery_mode "none" lands on not_applicable ====

describe("approve", () => {
  test("approving the daily-operating-plan artifact lands on delivery_status not_applicable", () => {
    seedOperatingPlanSelected("canonical", 135);
    must(runCmd("operating-plan-write", [], JSON.stringify(wellFormedOperatingPlanWriteInput())), "operating-plan-write");
    const r = runCmd("approve", ["p4-operating-plan"]);
    assert.equal(r.status, 0, r.stderr);
    const a = readArtifact(SLUG, "p4-operating-plan");
    assert.equal(a!.editorial_status, "approved");
    assert.equal(a!.delivery_status, "not_applicable");
  });
});

// ==== thank-you-note-draft ====

describe("thank-you-note-draft", () => {
  test("refuses an unknown response_id", () => {
    seedPhase4Unlocked();
    const r = runCmd(
      "thank-you-note-draft",
      ["note-1"],
      JSON.stringify({
        response_id: "no-such-response",
        influenced_idea_or_section: "the lead magnet's title",
        note_text: "Thanks so much for that.",
      })
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /does not exist/);
  });

  test("refuses a note containing a raw email address", () => {
    seedPhase4Unlocked();
    seedResponse("r-test-1");
    const r = runCmd(
      "thank-you-note-draft",
      ["note-1"],
      JSON.stringify({
        response_id: "r-test-1",
        influenced_idea_or_section: "the lead magnet's title",
        note_text: "Thanks so much, email me at jane@example.com anytime.",
      })
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /raw email address or @-handle/);
  });

  test("refuses a note containing a raw @-handle", () => {
    seedPhase4Unlocked();
    seedResponse("r-test-1");
    const r = runCmd(
      "thank-you-note-draft",
      ["note-1"],
      JSON.stringify({
        response_id: "r-test-1",
        influenced_idea_or_section: "the lead magnet's title",
        note_text: "Thanks so much, find me @janedoe anytime.",
      })
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /raw email address or @-handle/);
  });

  test("refuses a 3-sentence note without muxin_asked_for_more", () => {
    seedPhase4Unlocked();
    seedResponse("r-test-1");
    const r = runCmd(
      "thank-you-note-draft",
      ["note-1"],
      JSON.stringify({
        response_id: "r-test-1",
        influenced_idea_or_section: "the lead magnet's title",
        note_text: "Thanks so much. This really shaped the outline. I owe you one.",
      })
    );
    assert.equal(r.status, 1);
    assert.match(r.stderr, /sentence-like segments/);
  });

  test("allows a 3-sentence note when muxin_asked_for_more is true", () => {
    seedPhase4Unlocked();
    seedResponse("r-test-1");
    const r = runCmd(
      "thank-you-note-draft",
      ["note-1"],
      JSON.stringify({
        response_id: "r-test-1",
        influenced_idea_or_section: "the lead magnet's title",
        note_text: "Thanks so much. This really shaped the outline. I owe you one.",
        muxin_asked_for_more: true,
      })
    );
    assert.equal(r.status, 0, r.stderr);
    const a = readArtifact(SLUG, "p4-thank-you-note-1");
    assert.ok(a);
    assert.equal(a!.artifact_kind, "thank-you-note");
    assert.equal(a!.delivery_mode, "manual");
  });

  test("a well-formed 2-sentence note succeeds and drafts a thank-you-note artifact", () => {
    seedPhase4Unlocked();
    seedResponse("r-test-1");
    const r = runCmd(
      "thank-you-note-draft",
      ["note-1"],
      JSON.stringify({
        response_id: "r-test-1",
        influenced_idea_or_section: "the lead magnet's title",
        note_text: "Thanks so much for that. It really shaped the outline.",
      })
    );
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /stays manual, she sends it herself once approved/);
  });
});

// ==== day-14-scorecard-draft ====

describe("day-14-scorecard-draft", () => {
  test("refuses eligible_unique_responses supplied on stdin", () => {
    seedPhase4Unlocked();
    seedIntakeScorecard();
    const r = runCmd("day-14-scorecard-draft", [], JSON.stringify({ eligible_unique_responses: 99 }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /computed from real response data/);
  });

  test("refuses posts_live supplied on stdin", () => {
    seedPhase4Unlocked();
    seedIntakeScorecard();
    const r = runCmd("day-14-scorecard-draft", [], JSON.stringify({ posts_live: 5 }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /computed from live artifact records/);
  });

  test("computes eligible_unique_responses correctly from seeded response data", () => {
    seedPhase4Unlocked();
    seedIntakeScorecard();
    seedResponse("r-1");
    seedResponse("r-2");
    seedResponse("r-3");
    const r = runCmd("day-14-scorecard-draft", [], JSON.stringify({}));
    assert.equal(r.status, 0, r.stderr);
    const a = readArtifact(SLUG, "p4-day-14-review");
    const scorecard = a!.fields?.scorecard as Record<string, unknown>;
    assert.equal(scorecard.eligible_unique_responses, 3);
    assert.equal(scorecard.posts_live, 0);
  });

  test("refuses a stdin clicks_target_or_learning_only that disagrees with intake's stored target", () => {
    seedPhase4Unlocked();
    seedIntakeScorecard({ views_or_clicks_target: "learning_only" });
    const r = runCmd("day-14-scorecard-draft", [], JSON.stringify({ clicks_target_or_learning_only: "500 clicks" }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /disagrees with the target fixed at intake/);
  });

  test("refuses a stdin opt_in_target_or_learning_only that disagrees with intake's stored target", () => {
    seedPhase4Unlocked();
    seedIntakeScorecard({ opt_in_target: "learning_only" });
    const r = runCmd("day-14-scorecard-draft", [], JSON.stringify({ opt_in_target_or_learning_only: "10%" }));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /disagrees with the target fixed at intake/);
  });

  test("accepts a stdin target that agrees with intake's stored target", () => {
    seedPhase4Unlocked();
    seedIntakeScorecard({ views_or_clicks_target: "learning_only" });
    const r = runCmd("day-14-scorecard-draft", [], JSON.stringify({ clicks_target_or_learning_only: "learning_only" }));
    assert.equal(r.status, 0, r.stderr);
  });

  test("refuses to re-draft once the artifact is already approved", () => {
    seedDayFourteenReviewApproved();
    const r = runCmd("day-14-scorecard-draft", [], JSON.stringify({}));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /already approved/);
  });
});

// ==== day-14-decide + Phase 4 completion ====

describe("day-14-decide", () => {
  test("refuses before the day-14-review artifact is approved", () => {
    seedPhase4Unlocked();
    const r = runCmd("day-14-decide", ["continue", "--reason", "clear signal to keep going"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /p4-day-14-review is not approved/);
  });

  test("refuses a missing --reason", () => {
    seedDayFourteenReviewApproved();
    const r = runCmd("day-14-decide", ["continue"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /--reason is required/);
  });

  test("refuses a candidate outside the fixed 5 options", () => {
    seedDayFourteenReviewApproved();
    const r = runCmd("day-14-decide", ["give_up", "--reason", "testing"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /not one of the Day 14 decision options/);
  });

  test("once approved and decided, phase-4-completed fires and the artifact's fields match the DecisionRecord", () => {
    seedDayFourteenReviewApproved();
    const r = runCmd("day-14-decide", ["continue", "--reason", "clear signal to keep going"]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Phase 4 complete/);

    assert.ok(hasCanonEvent(SLUG, `${SLUG}/phase-4-completed`));

    const d = readDecision(SLUG, "p4-day-14-decision");
    assert.equal(d!.status, "selected");
    assert.equal(d!.selected_candidate_ids[0], "continue");
    assert.equal(d!.rationale, "clear signal to keep going");

    const a = readArtifact(SLUG, "p4-day-14-review");
    assert.equal(a!.fields?.decision, "continue");
    assert.equal(a!.fields?.decided_by, "muxin");
    assert.equal(a!.fields?.decided_at, d!.decided_at);
  });

  test("a second day-14-decide call attempting to change the decision is refused", () => {
    seedDayFourteenReviewApproved();
    must(runCmd("day-14-decide", ["continue", "--reason", "first decision"]), "day-14-decide");
    const r = runCmd("day-14-decide", ["stop", "--reason", "trying to change it"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /already selected/);
  });
});
