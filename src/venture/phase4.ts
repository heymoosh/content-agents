import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadRules, requireRulesVersionMatch, type VentureRules } from "./rules.js";
import { createArtifact, readArtifact } from "./artifacts.js";
import { writeDecision, selectWithOverride, readDecision, type Candidate, type DecisionRecord } from "./decisions.js";
import { phase4Dir } from "./paths.js";
import { hasCanonEvent } from "./canon.js";
import {
  fail,
  now,
  cmdApprove,
  cmdDiscard,
  cmdRestore,
  cmdList,
  readStdin,
  flag,
  positionalArgs,
  checkNoEmDash,
} from "./artifact-lifecycle.js";

// Phase 4 script: scaffolding and gate checks only, same discipline as phase1.ts/phase2.ts/
// phase3.ts. The daily operating plan's schedule, triage, and automation-order judgment is
// Claude's own work, done inline while running .claude/skills/venture/SKILL.md -- this script
// never calls an LLM itself. It reads Claude's output on stdin, validates it mechanically, and
// refuses to persist anything that skips a gate.
//
// usage: tsx src/venture/phase4.ts <subcommand> <slug> [...args] [--stdin]
//
// This file owns the FIRST HALF of Phase 4 only: the daily operating plan, triage, and
// automation-order commands (rules.md §8.1-§8.3). Direct outreach thank-you notes and the Day 14
// review/phase-completion logic (rules.md §8.4-§8.5) are a later work package's addition to this
// same file's dispatch() switch -- see requirePhase4Unlocked's export comment below.

// --- the Phase 4 gate (rules.md §11 item 18: "Phase 4 opens only after Phase 3 decisions are
// approved") ---------------------------------------------------------------------------------
//
// Exported so a later work package can import and reuse this exact gate for outreach-notes/
// Day-14-review commands rather than rebuilding it -- applied once, in dispatch(), to every
// subcommand this file owns (mirrors phase2.ts's single dispatch-level requirePhase2Unlocked call,
// not phase3.ts's exemption-list shape -- Phase 4 has no circular "gate depends on the gated
// command" concern the way Phase 3's response-ingest does, so no exemption list is needed).

export function requirePhase4Unlocked(slug: string): void {
  if (!hasCanonEvent(slug, `${slug}/phase-3-completed`)) {
    fail(
      `refusing: phase-3-completed is not recorded yet -- Phase 4 opens only after Phase 3's ` +
        `decisions are approved (rules.md §11 item 18). Complete Phase 3 (src/venture/phase3.ts) first.`
    );
  }
}

// --- small shared helpers -------------------------------------------------------------------------

// Guards against silently overwriting an already-made decision (rules.md §11 item 15), same
// discipline as phase3.ts's copy of this helper.
function refuseIfDecisionSelected(slug: string, decisionId: string, label: string): void {
  const d = readDecision(slug, decisionId);
  if (d?.status === "selected") {
    fail(
      `refusing: ${decisionId} (${label}) is already selected -- re-running this command would silently ` +
        `overwrite data underneath an already-made decision (rules.md §11 item 15). If this genuinely ` +
        `needs to change, that's a product question for Muxin, not a rerun.`
    );
  }
}

// Same concern as refuseIfDecisionSelected, for artifacts -- same discipline as phase3.ts's copy.
function refuseIfArtifactApproved(slug: string, artifactId: string): void {
  const a = readArtifact(slug, artifactId);
  if (a?.editorial_status === "approved") {
    fail(
      `refusing: ${artifactId} is already approved -- re-running this draft command would silently ` +
        `revert it to draft, discarding the approval (rules.md §11 item 15). Discard it first if it ` +
        `genuinely needs to be redrafted.`
    );
  }
}

function writePhase4Body(slug: string, artifactId: string, body: string): string {
  mkdirSync(phase4Dir(slug), { recursive: true });
  const relPath = `phase-4-operations/${artifactId}.md`;
  writeFileSync(`${phase4Dir(slug)}/${artifactId}.md`, body.trim() + "\n");
  return relPath;
}

// --- time-budget-compare / operating-plan-draft: the daily-operating-plan-choice decision
// (rules.md §8.1) ----------------------------------------------------------------------------
//
// rules.md §8.1's four numbered choices, keyed by rules.daily_operating_plan.modes' string values
// (venture-schema-contract.md §2B's chosen_mode enum). Text mirrors the rule's own wording so a
// candidate's rationale never drifts from what rules.md actually says.
const MODE_INFO: Record<string, { label: string; rationale: string }> = {
  canonical: {
    label: "Use the canonical daily routine",
    rationale: "Run the PDF's five-job routine as specified, unchanged (rules.md §8.1, choice 1).",
  },
  rotated: {
    label: "Rotate the five jobs across the week",
    rationale: "Spread the five jobs across the week within the available time budget instead of doing all five daily (rules.md §8.1, choice 2).",
  },
  extended_timeline: {
    label: "Extend the build timeline",
    rationale: "Keep the full five-job sequence but extend the build timeline while preserving the sequence (rules.md §8.1, choice 3).",
  },
  revised_scope: {
    label: "Revise the posting pace or scope",
    rationale: "Revise the posting pace or scope to fit the available time budget (rules.md §8.1, choice 4).",
  },
};

function operatingPlanModeCandidates(rules: VentureRules): Candidate[] {
  return rules.daily_operating_plan.modes.map((mode) => {
    const info = MODE_INFO[mode];
    if (!info) throw new Error(`no MODE_INFO entry for daily_operating_plan mode "${mode}" -- rules.yaml and phase4.ts have drifted`);
    const label =
      mode === "canonical"
        ? `${info.label} (${rules.daily_operating_plan.canonical_total_minutes} minutes across ${rules.daily_operating_plan.canonical_jobs.length} jobs)`
        : info.label;
    return {
      candidate_id: mode,
      label,
      scores: {},
      evidence_refs: ["intake:q20"],
      rationale: info.rationale,
    };
  });
}

// Read-only: compares the intake time budget against the canonical routine's total minutes and
// states plainly whether it fits, without writing a decision or artifact. Kept as its own command
// (rather than folded silently into operating-plan-draft) so Claude -- or Muxin -- can check the
// comparison on its own before committing to drafting the decision; operating-plan-draft below
// does NOT require this to have been run first, it re-derives the same comparison from the same
// stdin shape.
interface TimeBudgetInput {
  time_budget_minutes: number;
}

function requireTimeBudgetMinutes(input: TimeBudgetInput): number {
  if (typeof input.time_budget_minutes !== "number" || !(input.time_budget_minutes > 0)) {
    fail(`time_budget_minutes must be a positive number`);
  }
  return input.time_budget_minutes;
}

function cmdTimeBudgetCompare(slug: string) {
  const rules = loadRules();
  const input = JSON.parse(readStdin()) as TimeBudgetInput;
  const minutes = requireTimeBudgetMinutes(input);
  const canonical = rules.daily_operating_plan.canonical_total_minutes;
  const fits = minutes >= canonical;
  if (fits) {
    console.log(`fits: ${minutes} minutes available covers the canonical ${canonical}-minute routine.`);
  } else {
    console.log(
      `does not fit: ${minutes} minutes available is less than the canonical ${canonical}-minute routine. ` +
        `rules.md §8.1 requires all 4 options (canonical/rotated/extended_timeline/revised_scope) be offered ` +
        `as a recorded choice -- the system must not auto-pick one.`
    );
  }
}

function cmdOperatingPlanDraft(slug: string) {
  const rules = loadRules();
  refuseIfDecisionSelected(slug, "p4-operating-plan-01", "daily-operating-plan-choice");
  const input = JSON.parse(readStdin()) as TimeBudgetInput;
  const minutes = requireTimeBudgetMinutes(input);
  const fits = minutes >= rules.daily_operating_plan.canonical_total_minutes;

  const d = writeDecision(slug, {
    decision_id: "p4-operating-plan-01",
    decision_kind: "daily-operating-plan-choice",
    rules_version: rules.rules_version,
    input_refs: ["intake:q20"],
    candidates: operatingPlanModeCandidates(rules),
    recommended_candidate_ids: fits ? ["canonical"] : [],
    at: now(),
  });
  console.log(
    `wrote ${d.decision_id} (${d.candidates.length} modes, budget ${minutes}min, ` +
      `${fits ? "canonical recommended" : "no mode recommended -- budget below canonical"}) -- ` +
      `STOP: show Muxin the operating-plan options`
  );
}

function cmdOperatingPlanChoiceSelect(slug: string, candidateId: string) {
  const overrideReason = flag("--override-reason");
  const d = selectWithOverride(slug, "p4-operating-plan-01", candidateId, overrideReason, {
    requiredSelectCount: 1,
    ruleCite: "rules.md §8.1",
    candidateLabel: "operating-plan mode",
  });
  console.log(`operating-plan mode selected: ${d.selected_candidate_ids[0]}`);
}

function requireOperatingPlanChoiceSelected(slug: string): DecisionRecord {
  const d = readDecision(slug, "p4-operating-plan-01");
  if (!d || d.status !== "selected") {
    fail(
      `refusing: daily-operating-plan-choice is not selected. Run "operating-plan-draft" then ` +
        `"operating-plan-choice-select" first (rules.md §8.1).`
    );
  }
  return d!;
}

// --- operating-plan-write: the daily-operating-plan artifact (rules.md §8.2-§8.3) -----------------

type TriageBucket = "never_build" | "ignore" | "automate";
const TRIAGE_BUCKETS: TriageBucket[] = ["never_build", "ignore", "automate"];

interface TriageInput {
  bucket: TriageBucket;
  item: string;
  note: string;
}

type AutomationStatus = "planned" | "configured" | "skipped_not_needed";
const AUTOMATION_STATUSES: AutomationStatus[] = ["planned", "configured", "skipped_not_needed"];

interface AutomationOrderInput {
  step: 1 | 2 | 3 | 4;
  name: string;
  status: AutomationStatus;
}

interface OperatingPlanWriteInput {
  chosen_mode?: string;
  time_budget_minutes: number;
  schedule: Record<string, unknown>;
  triage: TriageInput[];
  automation_order: AutomationOrderInput[];
}

// rules.md §8.2: "Do not automate insight, voice, audience empathy, product judgment, or final
// approval." A mechanical substring check, same shape as artifact-lifecycle.ts's checkNoEmDash --
// matches both the space and hyphen spelling of each two-word concept.
const NEVER_AUTOMATE_CONCEPTS = [
  "insight",
  "voice",
  "audience empathy",
  "audience-empathy",
  "product judgment",
  "product-judgment",
  "final approval",
  "final-approval",
];

function checkTriage(triage: TriageInput[]): void {
  if (!Array.isArray(triage)) fail(`triage must be an array`);
  for (const t of triage) {
    if (!TRIAGE_BUCKETS.includes(t.bucket)) {
      fail(`triage item "${t.item}" has an invalid bucket "${t.bucket}" -- must be one of ${TRIAGE_BUCKETS.join(", ")} (rules.md §8.2)`);
    }
    if (!t.item?.trim()) fail(`a triage entry is missing item`);
    if (!t.note?.trim()) fail(`triage item "${t.item}" is missing a note`);
    if (t.bucket === "automate") {
      const haystack = `${t.item} ${t.note}`.toLowerCase();
      const hit = NEVER_AUTOMATE_CONCEPTS.find((c) => haystack.includes(c));
      if (hit) {
        fail(
          `triage item "${t.item}" is bucketed "automate" but names "${hit}" -- rules.md §8.2's ` +
            `never-automate list (insight, voice, audience empathy, product judgment, final approval) ` +
            `bans exactly this, no exceptions`
        );
      }
    }
  }
}

// rules.md §8.3: "Configure in this dependency order." Steps 1-4 don't all have to appear (step 4
// -- payments/receipts/scheduling -- may not be needed this sprint), but if a later step appears,
// every earlier step MUST also appear as an entry -- with status "skipped_not_needed" if it
// genuinely isn't needed, or "planned"/"configured" if it is. An entry present with ANY status
// counts as satisfying the dependency; a step number with NO entry at all is the real gap this
// check refuses. This is what distinguishes a documented "we looked at step 1 and it's not needed"
// from an undocumented gap in the configuration order.
function checkAutomationOrder(order: AutomationOrderInput[]): void {
  if (!Array.isArray(order)) fail(`automation_order must be an array`);
  const seenSteps = new Set<number>();
  for (const o of order) {
    if (![1, 2, 3, 4].includes(o.step)) fail(`automation_order entry "${o.name}" has an invalid step "${o.step}" -- must be 1-4 (rules.md §8.3)`);
    if (seenSteps.has(o.step)) fail(`automation_order has more than one entry for step ${o.step}`);
    seenSteps.add(o.step);
    if (!o.name?.trim()) fail(`automation_order step ${o.step} is missing a name`);
    if (!AUTOMATION_STATUSES.includes(o.status)) {
      fail(`automation_order step ${o.step} ("${o.name}") has an invalid status "${o.status}" -- must be one of ${AUTOMATION_STATUSES.join(", ")}`);
    }
  }
  const maxStep = Math.max(0, ...seenSteps);
  for (let s = 1; s <= maxStep; s++) {
    if (!seenSteps.has(s)) {
      fail(
        `automation_order names step ${maxStep} but is missing step ${s} -- rules.md §8.3's dependency ` +
          `order requires every earlier step to appear (with status "skipped_not_needed" if it genuinely ` +
          `isn't needed), not be silently absent`
      );
    }
  }
}

function cmdOperatingPlanWrite(slug: string) {
  const rules = loadRules();
  const decision = requireOperatingPlanChoiceSelected(slug);
  refuseIfArtifactApproved(slug, "p4-operating-plan");
  const input = JSON.parse(readStdin()) as OperatingPlanWriteInput;

  // The selected mode is frozen once selected -- operating-plan-write must carry it forward
  // exactly, never silently re-derive or re-pick it (rules.md §11 item 15), same discipline
  // phase3.ts's outline-draft applies to the approved transformation sentence.
  const chosenMode = decision.selected_candidate_ids[0];
  if (input.chosen_mode !== undefined && input.chosen_mode !== chosenMode) {
    fail(
      `operating-plan-write's chosen_mode does not match the selected daily-operating-plan-choice ` +
        `candidate -- selected: ${JSON.stringify(chosenMode)}, got: ${JSON.stringify(input.chosen_mode)}. ` +
        `To change the mode, run a new operating-plan-choice-select before operating-plan-write, not a ` +
        `silent override here.`
    );
  }

  const minutes = requireTimeBudgetMinutes(input);
  if (typeof input.schedule !== "object" || input.schedule === null || Array.isArray(input.schedule)) {
    fail(`schedule must be a non-null object`);
  }
  checkTriage(input.triage);
  checkAutomationOrder(input.automation_order);
  checkNoEmDash({
    schedule_json: JSON.stringify(input.schedule),
    triage_items: input.triage.map((t) => t.item),
    triage_notes: input.triage.map((t) => t.note),
    automation_order_names: input.automation_order.map((o) => o.name),
  });

  const body = [
    `Chosen mode: ${chosenMode}`,
    `Time budget: ${minutes} minutes`,
    ``,
    `Schedule:`,
    JSON.stringify(input.schedule, null, 2),
    ``,
    `Triage:`,
    ...input.triage.map((t) => `- [${t.bucket}] ${t.item} -- ${t.note}`),
    ``,
    `Automation order:`,
    ...input.automation_order.map((o) => `${o.step}. ${o.name} (${o.status})`),
  ].join("\n");
  const bodyPath = writePhase4Body(slug, "p4-operating-plan", body);

  const artifact = createArtifact(slug, rules, {
    artifact_id: "p4-operating-plan",
    phase: 4,
    artifact_kind: "daily-operating-plan",
    title: `Daily operating plan (${chosenMode})`,
    body_path: bodyPath,
    checkpoint_id: null, // there is no checkpoint-4 -- Phase 4 artifacts are never stamped against one
    venture_id: slug,
    venture_phase: 4,
    message_id: "p4-operating-plan",
    fields: {
      time_budget_minutes: minutes,
      chosen_mode: chosenMode,
      schedule: input.schedule,
      triage: input.triage,
      automation_order: input.automation_order,
    },
    at: now(),
  });
  console.log(`drafted ${artifact.artifact_id} (daily-operating-plan, mode ${chosenMode}) -- awaiting Muxin's approval`);
}

// --- dispatch ---------------------------------------------------------------------------------

function dispatch() {
  const [, , sub, slug, ...rest] = process.argv;
  if (!sub || !slug) {
    fail(
      `usage: tsx src/venture/phase4.ts <time-budget-compare|operating-plan-draft|` +
        `operating-plan-choice-select|operating-plan-write|approve|discard|restore|list> <slug> [...args]`
    );
  }
  const rules = loadRules();
  requireRulesVersionMatch(slug, rules);
  // Every subcommand this file owns is gated -- see requirePhase4Unlocked's comment for why this
  // is a single dispatch-level call (phase2.ts's shape), not an exemption list (phase3.ts's
  // shape). A later work package adding outreach-notes/Day-14-review cases to this same switch
  // stays covered by this same call, nothing extra to wire per case.
  requirePhase4Unlocked(slug);
  switch (sub) {
    case "time-budget-compare":
      return cmdTimeBudgetCompare(slug);
    case "operating-plan-draft":
      return cmdOperatingPlanDraft(slug);
    case "operating-plan-choice-select":
      return cmdOperatingPlanChoiceSelect(slug, positionalArgs(rest, "--override-reason")[0]);
    case "operating-plan-write":
      return cmdOperatingPlanWrite(slug);
    case "approve":
      return cmdApprove(slug, positionalArgs(rest)[0]);
    case "discard":
      return void cmdDiscard(slug, positionalArgs(rest)[0]);
    case "restore":
      return void cmdRestore(slug, positionalArgs(rest)[0]);
    case "list":
      return cmdList(slug);
    default:
      fail(`unknown subcommand: ${sub}`);
  }
}

// Every gate refusal in this file throws a plain Error -- caught here and printed as a clean
// one-line message via fail(), never an uncaught stack trace dump. Mirrors phase1.ts/phase2.ts/
// phase3.ts's main().
export function main() {
  try {
    dispatch();
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
