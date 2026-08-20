import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadRules, requireRulesVersionMatch, type VentureRules } from "./rules.js";
import { createArtifact, readArtifact, readArtifacts, updateArtifactFields, type VentureArtifact } from "./artifacts.js";
import {
  writeDecision,
  selectWithOverride,
  selectDecision,
  readDecision,
  readDecisions,
  type Candidate,
  type DecisionRecord,
} from "./decisions.js";
import { phase4Dir } from "./paths.js";
import { hasCanonEvent, appendCanonEvent } from "./canon.js";
import { readResponse, getResponseGateState } from "./responses.js";
import { readIntakeScorecard } from "./intake.js";
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
// This file owns all of Phase 4: the daily operating plan, triage, and automation-order commands
// (rules.md §8.1-§8.3, Work Package 1), plus direct-outreach thank-you notes and the Day 14
// review/phase-completion logic (rules.md §8.4-§8.5, Work Package 2) -- all in the same
// dispatch() switch, see requirePhase4Unlocked's export comment below.

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

// Same shape as phase3.ts's own copy of this helper -- kept as a local duplicate, not a shared
// export, since the two files' near-identical helpers already aren't unified elsewhere in this
// codebase (see phase3.ts's refuseIfDecisionSelected/refuseIfArtifactApproved comments).
function requireNonEmpty(fields: Record<string, string | undefined | null>): void {
  const missing = Object.entries(fields)
    .filter(([, v]) => !v || !v.trim())
    .map(([k]) => k);
  if (missing.length) fail(`missing required field(s): ${missing.join(", ")}`);
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

// --- thank-you-note-draft: the thank-you-note artifact (rules.md §8.4) ----------------------------
//
// Multi-instance by design: rules.md sets no minimum or maximum count of thank-you notes (rules.yaml
// deliberately excludes thank-you-note from phase4_completion.required_artifact_kinds), so this is
// drafted once per respondent worth thanking, not once per venture. The artifact id therefore takes
// a caller-supplied note_id, the same "let the caller name the instance" shape phase1.ts's cmdDraft
// uses for candidateId -- refuseIfArtifactApproved guards a re-run of the SAME note_id only, never
// blocking a second, different note_id.

// Lightweight, on purpose (this only needs a rough sentence count, not a grammar checker) -- same
// terminal-punctuation-then-whitespace split phase3.ts's checkSingleSentence uses, but counting
// segments instead of enforcing exactly one.
function countSentences(text: string): number {
  return text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter((p) => p.trim().length > 0).length;
}

// rules.md §8.4: "make no sales demand." A hard ban risks false positives (e.g. quoting the
// respondent's own words back at them, which may legitimately include "$" or "buy"), so this is a
// soft warning Muxin reviews by hand, not a refusal.
const SALES_ASK_SUBSTRINGS = ["buy", "purchase", "sign up", "$"];

function warnIfSalesAsk(text: string): void {
  const lower = text.toLowerCase();
  const hit = SALES_ASK_SUBSTRINGS.find((s) => lower.includes(s));
  if (hit) {
    console.warn(
      `warning: note_text contains "${hit}", which can read as a sales ask -- rules.md §8.4 says ` +
        `"make no sales demand." This is a soft warning, not a refusal (the respondent's own words may ` +
        `legitimately include this), so review by hand before approving.`
    );
  }
}

// HARD refusal, not a warning: phase-4-operations/*.md (writePhase4Body's output) is NOT gitignored,
// unlike responses.jsonl -- a raw email or handle written into a thank-you note's body would commit
// an identifying detail to git. A simple substring/regex check, not full PII detection.
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const HANDLE_RE = /(?:^|[^\w@])@[A-Za-z0-9_]{2,}/;

function checkNoRawIdentifier(fields: Record<string, string>): void {
  for (const [key, text] of Object.entries(fields)) {
    if (EMAIL_RE.test(text) || HANDLE_RE.test(text)) {
      fail(
        `field "${key}" looks like it contains a raw email address or @-handle -- ` +
          `phase-4-operations/*.md files are NOT gitignored (unlike responses.jsonl), so a raw ` +
          `identifier here would leak into git (rules.md §9.3 item 1). Redact it before drafting.`
      );
    }
  }
}

interface ThankYouNoteInput {
  response_id: string;
  influenced_idea_or_section: string;
  note_text: string;
  muxin_asked_for_more?: boolean;
}

function cmdThankYouNoteDraft(slug: string, noteId: string) {
  if (!noteId?.trim()) fail(`usage: tsx src/venture/phase4.ts thank-you-note-draft <slug> <note_id>`);
  // noteId feeds straight into a filesystem path below (writePhase4Body) -- same traversal guard
  // paths.ts's safeSlug applies to a venture slug, applied here to a caller-supplied note_id.
  if (noteId.includes("/") || noteId.includes("\\") || noteId.includes("..")) {
    fail(`bad note_id: ${JSON.stringify(noteId)} -- must be a bare id, no path separators or ".."`);
  }
  const rules = loadRules();
  const artifactId = `p4-thank-you-${noteId}`;
  refuseIfArtifactApproved(slug, artifactId);
  const input = JSON.parse(readStdin()) as ThankYouNoteInput;

  requireNonEmpty({
    response_id: input.response_id,
    influenced_idea_or_section: input.influenced_idea_or_section,
    note_text: input.note_text,
  });

  // "link privately to the source response" (rules.md §8.4) means response_id must name a real
  // response record -- never a free-text pointer the system can't verify.
  const response = readResponse(slug, input.response_id);
  if (!response) {
    fail(
      `refusing: response_id "${input.response_id}" does not exist -- a thank-you note must link ` +
        `privately to a real source response (rules.md §8.4)`
    );
  }

  const sentenceCount = countSentences(input.note_text);
  if (sentenceCount > 2 && !input.muxin_asked_for_more) {
    fail(
      `note_text is ${sentenceCount} sentence-like segments -- rules.md §8.4 caps a thank-you note ` +
        `at two short sentences unless the user asked for more (set muxin_asked_for_more: true)`
    );
  }

  checkNoRawIdentifier({ note_text: input.note_text, influenced_idea_or_section: input.influenced_idea_or_section });
  checkNoEmDash({ note_text: input.note_text, influenced_idea_or_section: input.influenced_idea_or_section });
  warnIfSalesAsk(input.note_text);

  const body = [`Response: ${input.response_id}`, `Influenced: ${input.influenced_idea_or_section}`, ``, input.note_text].join("\n");
  const bodyPath = writePhase4Body(slug, artifactId, body);

  const artifact = createArtifact(slug, rules, {
    artifact_id: artifactId,
    phase: 4,
    artifact_kind: "thank-you-note",
    title: `Thank-you note (${input.response_id})`,
    body_path: bodyPath,
    checkpoint_id: null,
    venture_id: slug,
    venture_phase: 4,
    message_id: artifactId,
    fields: {
      response_id: input.response_id,
      influenced_idea_or_section: input.influenced_idea_or_section,
      note_text: input.note_text,
      muxin_asked_for_more: !!input.muxin_asked_for_more,
    },
    at: now(),
  });
  console.log(
    `drafted ${artifact.artifact_id} (thank-you-note, response ${input.response_id}) -- ` +
      `awaiting Muxin's approval -- stays manual, she sends it herself once approved`
  );
}

// --- day-14-scorecard-draft: the day-14-review artifact (rules.md §8.5, schema-contract §5.6) -----
//
// A Phase-wide singleton (one Day 14 review per venture), fixed id "p4-day-14-review" -- same
// shape as p4-operating-plan. refuseIfArtifactApproved (not a broader "already exists" refusal)
// matches phase3.ts's outline-draft/price-draft precedent: a redraft is allowed while the artifact
// is still an unapproved draft (nothing downstream depends on this artifact's exact shape the way
// phase3's cluster-analysis orphaning risk does -- day-14-decide requires this artifact APPROVED
// first, so an unapproved redraft can't leave anything dangling), refused once Muxin has approved it.

const DAY14_SCORECARD_FIELDS = [
  "posts_live",
  "posting_pace_achieved",
  "qualified_views_or_clicks",
  "clicks_target_or_learning_only",
  "landing_page_opt_in_rate",
  "opt_in_target_or_learning_only",
  "eligible_unique_responses",
  "response_quality_read",
  "sustainability_read",
] as const;

interface Day14ScorecardInput {
  clicks_target_or_learning_only?: string;
  opt_in_target_or_learning_only?: string;
  qualified_views_or_clicks?: number | null;
  landing_page_opt_in_rate?: number | null;
  posting_pace_achieved?: string | null;
  response_quality_read?: string | null;
  sustainability_read?: string | null;
}

function countLivePosts(slug: string): number {
  return readArtifacts(slug).filter(
    (a) => (a.artifact_kind === "substack-post" || a.artifact_kind === "text-post-note") && a.delivery_status === "live_confirmed"
  ).length;
}

// Renders the §8.5 bullets that are NOT scorecard fields -- read from existing artifact/decision
// state at review time, never invented. "product build started" has no artifact/decision backing
// it anywhere in this data model, so it renders as an explicit gap for Muxin to confirm by hand
// rather than a fabricated status (rules.md §11 item 17: never report a Day 14 pass the fixed
// scorecard didn't earn).
function renderDay14NonScorecardLines(slug: string): string[] {
  const artifactLine = (label: string, artifactId: string): string => {
    const a = readArtifact(slug, artifactId);
    return a ? `- ${label}: ${a.editorial_status}/${a.delivery_status} (${artifactId})` : `- ${label}: not drafted yet (${artifactId})`;
  };
  const decisionLine = (label: string, decisionId: string): string => {
    const d = readDecision(slug, decisionId);
    return d ? `- ${label}: ${d.status} (${decisionId})` : `- ${label}: not made yet (${decisionId})`;
  };
  return [
    artifactLine("Lead magnet live", "p2-lead-magnet"),
    artifactLine("Landing page capturing emails", "p2-landing-page"),
    artifactLine("Survey working", "p2-survey-review"),
    decisionLine("Product problem approved", "p3-problem-01"),
    decisionLine("Transformation approved", "p3-transformation-01"),
    artifactLine("Outline approved", "p3-product-outline"),
    artifactLine("Price and pitch approved", "p3-price-decision"),
    `- Product build started: not tracked by this data model yet -- confirm with Muxin directly`,
    artifactLine("Operating plan tested for sustainability", "p4-operating-plan"),
  ];
}

function cmdDay14ScorecardDraft(slug: string) {
  const rules = loadRules();
  refuseIfArtifactApproved(slug, "p4-day-14-review");
  const raw = JSON.parse(readStdin()) as Record<string, unknown>;

  // eligible_unique_responses and posts_live are COMPUTED, never accepted on stdin -- refuse the
  // input outright if a caller tries to supply either, rather than silently ignoring it.
  if ("eligible_unique_responses" in raw) {
    fail(`refusing: eligible_unique_responses is computed from real response data, never accepted on stdin`);
  }
  if ("posts_live" in raw) {
    fail(`refusing: posts_live is computed from live artifact records, never accepted on stdin`);
  }
  const input = raw as Day14ScorecardInput;

  const scorecard = readIntakeScorecard(slug);
  if (!scorecard) {
    fail(`refusing: no intake scorecard found for "${slug}" -- intake must be complete before the Day 14 review (rules.md §4.4)`);
  }

  // clicks_target_or_learning_only / opt_in_target_or_learning_only are read verbatim from intake
  // -- a stdin value is only accepted if it AGREES with what was fixed at kickoff, never silently
  // overwritten (rules.md §4.4, §11 item 15).
  if (input.clicks_target_or_learning_only !== undefined && input.clicks_target_or_learning_only !== scorecard!.views_or_clicks_target) {
    fail(
      `clicks_target_or_learning_only (${JSON.stringify(input.clicks_target_or_learning_only)}) disagrees with the ` +
        `target fixed at intake (${JSON.stringify(scorecard!.views_or_clicks_target)}) -- Day 14 must not silently ` +
        `revise the Day 0 scorecard (rules.md §4.4, §11 item 15)`
    );
  }
  if (input.opt_in_target_or_learning_only !== undefined && input.opt_in_target_or_learning_only !== scorecard!.opt_in_target) {
    fail(
      `opt_in_target_or_learning_only (${JSON.stringify(input.opt_in_target_or_learning_only)}) disagrees with the ` +
        `target fixed at intake (${JSON.stringify(scorecard!.opt_in_target)}) -- Day 14 must not silently revise the ` +
        `Day 0 scorecard (rules.md §4.4, §11 item 15)`
    );
  }

  checkNoEmDash({
    posting_pace_achieved: input.posting_pace_achieved ?? undefined,
    response_quality_read: input.response_quality_read ?? undefined,
    sustainability_read: input.sustainability_read ?? undefined,
  });

  const scorecardFields: Record<(typeof DAY14_SCORECARD_FIELDS)[number], unknown> = {
    posts_live: countLivePosts(slug),
    posting_pace_achieved: input.posting_pace_achieved ?? null,
    qualified_views_or_clicks: input.qualified_views_or_clicks ?? null,
    clicks_target_or_learning_only: scorecard!.views_or_clicks_target,
    landing_page_opt_in_rate: input.landing_page_opt_in_rate ?? null,
    opt_in_target_or_learning_only: scorecard!.opt_in_target,
    eligible_unique_responses: getResponseGateState(slug).have,
    response_quality_read: input.response_quality_read ?? null,
    sustainability_read: input.sustainability_read ?? null,
  };

  // schema-contract §5.6: "a day-14-review ... reading null must render 'not enough data yet,'
  // never a fabricated zero." Rendering only -- fields.scorecard below keeps the literal null.
  const renderScorecardValue = (v: unknown): string => (v === null ? "not enough data yet" : JSON.stringify(v));

  const body = [
    `Day 14 scorecard (rules.md §8.5, venture-schema-contract.md §5.6):`,
    ``,
    ...DAY14_SCORECARD_FIELDS.map((f) => `- ${f}: ${renderScorecardValue(scorecardFields[f])}`),
    ``,
    `Other §8.5 facts (read from existing state, not new scorecard fields):`,
    ``,
    ...renderDay14NonScorecardLines(slug),
  ].join("\n");
  const bodyPath = writePhase4Body(slug, "p4-day-14-review", body);

  const artifact = createArtifact(slug, rules, {
    artifact_id: "p4-day-14-review",
    phase: 4,
    artifact_kind: "day-14-review",
    title: "Day 14 review",
    body_path: bodyPath,
    checkpoint_id: null,
    venture_id: slug,
    venture_phase: 4,
    message_id: "p4-day-14-review",
    fields: {
      scorecard: scorecardFields,
      decision: null,
      decided_by: null,
      decided_at: null,
    },
    at: now(),
  });
  console.log(
    `drafted ${artifact.artifact_id} (day-14-review, ${scorecardFields.eligible_unique_responses} eligible unique ` +
      `responses, ${scorecardFields.posts_live} posts live) -- STOP: show Muxin the facts before day-14-decide`
  );
}

// --- day-14-decide: the day-14-decision decision, and Phase 4 completion (rules.md §8.5) ----------

function requireDay14ReviewApproved(slug: string): VentureArtifact {
  const a = readArtifact(slug, "p4-day-14-review");
  if (!a || a.editorial_status !== "approved") {
    fail(
      `refusing: p4-day-14-review is not approved yet. Run "day-14-scorecard-draft" then ` +
        `"approve ${slug} p4-day-14-review" first -- Muxin confirms the facts before deciding (rules.md §8.5).`
    );
  }
  return a!;
}

// rules.md §8.5's checkpoint-completion check: reads phase4_completion's required kinds
// GENERICALLY (never a hardcoded pair scattered through this function), same spirit as
// checkpoint.ts's clearCheckpoint() -- deliberately NOT calling clearCheckpoint() itself, since
// Phase 4 completion is a distinct concept (rules.ts's Phase4CompletionRule comment) that must
// never be handed to code that only knows the checkpoint-1/2/3 ledger-event shape.
//
// Exported so state.ts's read side can recompute this SAME predicate on every deriveState() call,
// rather than trusting hasCanonEvent(phase-4-completed) to already be written (see
// maybeCompletePhase4's comment below for why that can lag).
export function phase4CompletionSatisfied(slug: string, rules: VentureRules): boolean {
  const artifacts = readArtifacts(slug);
  const decisions = readDecisions(slug);
  const artifactsOk = rules.phase4_completion.required_artifact_kinds.every((kind) => {
    const a = artifacts.find((x) => x.artifact_kind === kind);
    return !!a && a.editorial_status === "approved" && a.delivery_status === "not_applicable";
  });
  const decisionsOk = rules.phase4_completion.required_decision_kinds.every((kind) =>
    decisions.some((d) => d.decision_kind === kind && d.status === "selected")
  );
  return artifactsOk && decisionsOk;
}

// Ledger first, cache second -- same crash-safety order checkpoints already use
// (venture-schema-contract.md §5.3): a crash between the two leaves the event recorded and the
// artifact's fields.decision stale, never the reverse. appendCanonEvent's own hasCanonEvent guard
// makes the ledger write idempotent on its own, no separate check needed here.
//
// Exported, and deliberately takes NO decision parameter -- it reads "p4-day-14-decision" itself
// and no-ops quietly (returns false, logs nothing) if it isn't selected yet. This makes it safe to
// call from anywhere, not just right after cmdDay14Decide's own selectDecision call: day-14-decide
// only requires the day-14-review artifact approved, not the daily-operating-plan artifact --
// nothing enforces that ordering, and because selectDecision() makes "p4-day-14-decision"
// immutable, cmdDay14Decide can never be called again for a slug once decided. If Muxin decides
// Day 14 before approving the operating plan, this function would previously run once, find the
// predicate unsatisfied, and never be asked again -- permanently missing phase-4-completed even
// after the operating plan is later approved. status.ts's formatStatus now calls this
// opportunistically before every render (see its own comment), which only works because this
// function can run standalone, without a fresh decision passed in.
//
// Returns true when Phase 4 is complete (whether it fired the event just now or it was already
// recorded), false otherwise -- callers decide what, if anything, to tell the user.
export function maybeCompletePhase4(slug: string, rules: VentureRules): boolean {
  const decision = readDecision(slug, "p4-day-14-decision");
  if (!decision || decision.status !== "selected") return false;
  const eventId = `${slug}/${rules.phase4_completion.ledger_event_id}`;
  if (hasCanonEvent(slug, eventId)) return true;
  if (!phase4CompletionSatisfied(slug, rules)) return false;
  appendCanonEvent(slug, "phase_4_completed", eventId, {}, now());
  updateArtifactFields(
    slug,
    "p4-day-14-review",
    { decision: decision.selected_candidate_ids[0], decided_by: decision.selected_by, decided_at: decision.decided_at },
    now()
  );
  console.log(
    `Phase 4 complete -- the venture's active build is done. There is no fourth checkpoint; the Day 14 ` +
      `decision IS the completion (rules.md §8.5/§8.6, venture-schema-contract.md §5.3).`
  );
  return true;
}

function cmdDay14Decide(slug: string, candidateId: string) {
  const rules = loadRules();
  requireDay14ReviewApproved(slug);
  const reason = flag("--reason");
  if (!candidateId?.trim()) fail(`usage: tsx src/venture/phase4.ts day-14-decide <slug> <candidate_id> --reason "..."`);
  // decisions.ts's day-14-decision comment: the system never recommends one, so selectDecision()
  // (unlike selectWithOverride()) never forces an override reason here -- rules.md §8.5's "Record
  // the decision and reason" still has to be enforced somewhere, so this command requires --reason
  // itself rather than relying on a mechanism that doesn't apply to this decision kind.
  if (!reason?.trim()) fail(`refusing: --reason is required -- rules.md §8.5: "Record the decision and reason."`);
  if (!rules.day_14_decision.candidates.includes(candidateId)) {
    fail(`"${candidateId}" is not one of the Day 14 decision options (${rules.day_14_decision.candidates.join(", ")})`);
  }

  if (!readDecision(slug, "p4-day-14-decision")) {
    writeDecision(slug, {
      decision_id: "p4-day-14-decision",
      decision_kind: "day-14-decision",
      rules_version: rules.rules_version,
      input_refs: ["p4-day-14-review"],
      candidates: rules.day_14_decision.candidates.map((c) => ({
        candidate_id: c,
        label: c,
        scores: {},
        evidence_refs: ["p4-day-14-review"],
        rationale: "",
      })),
      recommended_candidate_ids: [],
      at: now(),
    });
  }

  // selectDecision throws DecisionAlreadySelectedError on a second call -- immutability (rules.md
  // §11 item 15) comes for free from decisions.ts, no extra guard needed here.
  const selected = selectDecision(slug, "p4-day-14-decision", {
    selectedCandidateIds: [candidateId],
    selectedBy: "muxin",
    rationale: reason,
    requiredSelectCount: 1,
    at: now(),
  });
  console.log(`Day 14 decision recorded: ${selected.selected_candidate_ids[0]} -- ${reason}`);

  const completed = maybeCompletePhase4(slug, rules);
  if (!completed) {
    console.log(`Day 14 decision recorded, but Phase 4 is not yet complete -- other required items are still outstanding.`);
  }
}

// --- dispatch ---------------------------------------------------------------------------------

function dispatch() {
  const [, , sub, slug, ...rest] = process.argv;
  if (!sub || !slug) {
    fail(
      `usage: tsx src/venture/phase4.ts <time-budget-compare|operating-plan-draft|` +
        `operating-plan-choice-select|operating-plan-write|thank-you-note-draft|day-14-scorecard-draft|` +
        `day-14-decide|approve|discard|restore|list> <slug> [...args]`
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
    case "thank-you-note-draft":
      return cmdThankYouNoteDraft(slug, positionalArgs(rest)[0]);
    case "day-14-scorecard-draft":
      return cmdDay14ScorecardDraft(slug);
    case "day-14-decide":
      return cmdDay14Decide(slug, positionalArgs(rest, "--reason")[0]);
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
