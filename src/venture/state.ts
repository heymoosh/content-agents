import { mkdirSync, writeFileSync } from "node:fs";
import { readArtifact, readArtifacts, type VentureArtifact } from "./artifacts.js";
import { hasCanonEvent, findCanonEvent } from "./canon.js";
import { readDecision, readDecisions } from "./decisions.js";
import { statePath, ventureDir } from "./paths.js";
import { loadRules, artifactKindRule, evidenceMeetsMinimum, type CheckpointRule, type VentureRules } from "./rules.js";
import { phase4CompletionSatisfied } from "./phase4.js";

export type PhaseStatus = "drafting" | "awaiting_you" | "checkpoint_ready" | "blocked" | "complete";

export interface CheckpointBlocker {
  artifact_id: string | null;
  reason: string;
}

export interface CheckpointState {
  required: VentureArtifact[];
  complete_count: number;
  required_count: number;
  pace_recorded: boolean;
  // Checkpoint-3 only today (rules.yaml's required_decision_kinds) -- 0/0 for any checkpoint that
  // doesn't declare the field, so it never perturbs checkpoint-1/checkpoint-2's semantics. Kept as
  // its own pair of counts, separate from complete_count/required_count, because the schema
  // contract's read model (§5.1/§5.2) counts `complete`/`required` over the artifact manifest only
  // -- decision completeness is a second, independently-ANDed criterion (§5.3), not a third kind of
  // manifest entry to fold into the same count.
  decisions_required_count: number;
  decisions_complete_count: number;
  cleared: boolean;
  blocking: CheckpointBlocker[];
}

// Phase 4 has no checkpoint (venture-schema-contract.md §5.3: "There is no checkpoint-4") -- this
// is the read-side counterpart to CheckpointState, shaped around the daily-operating-plan and
// day-14-review artifacts and the daily-operating-plan-choice/day-14-decision decisions instead of
// a required-artifact manifest. `complete` is phase4CompletionSatisfied's own verdict, recomputed
// fresh here every call rather than trusted from a cached canon event -- see this field's use in
// derivePhaseStatus below and maybeCompletePhase4's comment in phase4.ts for why.
export interface Phase4State {
  operating_plan: { drafted: boolean; approved: boolean };
  thank_you_notes_count: number;
  day_14_review: { drafted: boolean; approved: boolean };
  day_14_decision: { made: boolean; candidate_id: string | null };
  complete: boolean;
  // Same reason shape checkpointArtifactState's blocking array already uses ("missing required
  // artifact kind ...", "missing required decision kind ...", or an editorial/delivery pair) -- a
  // diagnostic rendering aid for status.ts's plainPhase4Reason, built by walking
  // rules.phase4_completion's own required kinds. This is separate from `complete`, which is never
  // derived from this list -- it comes straight from phase4CompletionSatisfied (see below).
  blocking: CheckpointBlocker[];
}

export interface VentureState {
  slug: string;
  current_phase: 1 | 2 | 3 | 4;
  phase_status: PhaseStatus;
  checkpoints: Record<string, CheckpointState>;
  phase4: Phase4State;
}

// checkpoint_id is stamped on an artifact at draft time (createArtifact), so "required for a
// given checkpoint" is a plain join against artifacts.jsonl -- no separate manifest event needed.
//
// A CheckpointRule uses exactly one of two shapes (rules.ts):
//   - required_artifact_kinds: exactly one live artifact per named kind (checkpoint-2 style)
//   - required_artifact_count: N of any required-checkpoint_id artifact (checkpoint-1 style)
//
// `rules` and `artifacts` are loaded ONCE by the caller (deriveState) and threaded through here --
// this used to reload venture/rules.yaml and re-read artifacts.jsonl itself on every call, which
// meant a single deriveState() call parsed rules.yaml 3x and artifacts.jsonl 2x (once per
// checkpoint, plus deriveState's own top-level load).
function checkpointArtifactState(
  slug: string,
  checkpointId: string,
  cfg: CheckpointRule,
  rules: VentureRules,
  artifacts: VentureArtifact[]
): CheckpointState {
  const required = artifacts.filter((a) => a.checkpoint_id === checkpointId);
  const blocking: CheckpointBlocker[] = [];
  let completeCount = 0;
  let requiredCount: number;

  // docs/venture-schema-contract.md §3-4: each kind declares a minimum evidence type (e.g.
  // substack-post requires a real "url", not a bare attestation). A truthy evidence object alone
  // isn't enough -- it must clear that kind's floor. evidenceMeetsMinimum (rules.ts) owns what
  // clears what; this read used to be exact equality, which no `attestation` kind could ever pass.
  //
  // §5.2's derivation rule: "an artifact is complete when editorial_status === approved AND
  // delivery_status is live_confirmed (modes app/manual) OR not_applicable (mode none)." A
  // delivery_mode: "none" artifact (e.g. Phase 3's product-outline/price-decision) is an internal
  // decision artifact with no external delivery step to confirm -- createArtifact (artifacts.ts)
  // stamps it "not_applicable" at draft time and it can never reach "live_confirmed", so requiring
  // live_confirmed unconditionally would block such an artifact's checkpoint forever. This is a
  // general rule about the artifact kind, not specific to any one checkpoint.
  function checkArtifact(a: VentureArtifact, labelKind?: string): boolean {
    const kindRule = artifactKindRule(rules, a.artifact_kind);
    const deliverySatisfied =
      kindRule.delivery_mode === "none"
        ? a.delivery_status === "not_applicable"
        : a.delivery_status === "live_confirmed" && Boolean(a.evidence);
    if (a.editorial_status !== "approved" || !deliverySatisfied) {
      blocking.push({ artifact_id: a.artifact_id, reason: `${a.editorial_status}/${a.delivery_status}` });
      return false;
    }
    if (kindRule.min_evidence && !evidenceMeetsMinimum(a.evidence!.type, kindRule.min_evidence)) {
      blocking.push({
        artifact_id: a.artifact_id,
        reason: labelKind
          ? `evidence type "${a.evidence!.type}" does not meet this kind's minimum ("${kindRule.min_evidence}") for "${labelKind}"`
          : `evidence type "${a.evidence!.type}" does not meet this kind's minimum ("${kindRule.min_evidence}")`,
      });
      return false;
    }
    return true;
  }

  if (cfg.required_artifact_kinds) {
    requiredCount = cfg.required_artifact_kinds.length;
    for (const kind of cfg.required_artifact_kinds) {
      const artifact = required.find((a) => a.artifact_kind === kind);
      if (!artifact) {
        blocking.push({ artifact_id: null, reason: `missing required artifact kind "${kind}"` });
        continue;
      }
      if (checkArtifact(artifact, kind)) completeCount++;
    }
  } else {
    requiredCount = cfg.required_artifact_count ?? required.length;
    for (const a of required) {
      if (checkArtifact(a)) completeCount++;
    }
  }

  // Only checkpoint-1 currently declares require_pace_recorded; when a checkpoint doesn't
  // require it, pace_recorded reads true (trivially satisfied) so it never shows up in blocking.
  let paceRecorded = true;
  if (cfg.require_pace_recorded) {
    paceRecorded = Boolean(findCanonEvent(slug, `${slug}/phase-1/pace`));
    if (!paceRecorded) blocking.push({ artifact_id: null, reason: "posting pace not recorded" });
  }

  // Only checkpoint-3 currently declares required_decision_kinds (rules.yaml); every other
  // checkpoint reads 0/0 here and never pays the readDecisions() cost. rules.md §7.10 /
  // venture-schema-contract.md §5.3: each named decision_kind must have a `selected`
  // DecisionRecord for this slug -- artifact approval alone is not enough (§2A's
  // selected_candidate_ids is the thing that actually records Muxin's choice).
  let decisionsRequiredCount = 0;
  let decisionsCompleteCount = 0;
  if (cfg.required_decision_kinds?.length) {
    decisionsRequiredCount = cfg.required_decision_kinds.length;
    const decisions = readDecisions(slug);
    for (const kind of cfg.required_decision_kinds) {
      const isSelected = decisions.some((d) => d.decision_kind === kind && d.status === "selected");
      if (isSelected) {
        decisionsCompleteCount++;
      } else {
        blocking.push({ artifact_id: null, reason: `missing required decision kind "${kind}"` });
      }
    }
  }

  // The ledger event id defaults to `<slug>/<checkpointId>` (checkpoint-1, checkpoint-2); a
  // checkpoint may override it via rules.yaml's ledger_event_id (checkpoint-3 does, matching
  // venture-schema-contract.md §5.3's `<slug>/phase-3-completed`) -- read here so `cleared` and
  // clearCheckpoint's own write (checkpoint.ts) never disagree about which event id is authoritative.
  const cleared = hasCanonEvent(slug, ledgerEventId(slug, checkpointId, cfg));
  return {
    required,
    complete_count: completeCount,
    required_count: requiredCount,
    pace_recorded: paceRecorded,
    decisions_required_count: decisionsRequiredCount,
    decisions_complete_count: decisionsCompleteCount,
    cleared,
    blocking,
  };
}

// Shared by state.ts (read) and checkpoint.ts (write) so the two never compute a different event id
// for the same checkpoint -- see CheckpointRule.ledger_event_id's comment in rules.ts.
export function ledgerEventId(slug: string, checkpointId: string, cfg: CheckpointRule): string {
  return `${slug}/${cfg.ledger_event_id ?? checkpointId}`;
}

// Reads the daily-operating-plan/day-14-review artifacts and the day-14-decision decision fresh on
// every call -- never trusts hasCanonEvent(phase-4-completed) alone, since that event can lag the
// true completion condition (phase4.ts's maybeCompletePhase4 comment explains the exact ordering
// gap this closes). `complete` reuses phase4CompletionSatisfied directly rather than
// re-implementing its artifact/decision checks a second time here.
function derivePhase4State(slug: string, rules: VentureRules): Phase4State {
  const artifacts = readArtifacts(slug);
  const decisions = readDecisions(slug);
  const operatingPlan = readArtifact(slug, "p4-operating-plan");
  const day14Review = readArtifact(slug, "p4-day-14-review");
  const day14Decision = readDecision(slug, "p4-day-14-decision");
  const thankYouNotesCount = artifacts.filter((a) => a.artifact_kind === "thank-you-note").length;
  const decisionMade = day14Decision?.status === "selected";

  const blocking: CheckpointBlocker[] = [];
  for (const kind of rules.phase4_completion.required_artifact_kinds) {
    const a = artifacts.find((x) => x.artifact_kind === kind);
    if (!a) {
      blocking.push({ artifact_id: null, reason: `missing required artifact kind "${kind}"` });
    } else if (a.editorial_status !== "approved" || a.delivery_status !== "not_applicable") {
      blocking.push({ artifact_id: a.artifact_id, reason: `${a.editorial_status}/${a.delivery_status}` });
    }
  }
  for (const kind of rules.phase4_completion.required_decision_kinds) {
    const selected = decisions.some((d) => d.decision_kind === kind && d.status === "selected");
    if (!selected) blocking.push({ artifact_id: null, reason: `missing required decision kind "${kind}"` });
  }

  return {
    operating_plan: { drafted: Boolean(operatingPlan), approved: operatingPlan?.editorial_status === "approved" },
    thank_you_notes_count: thankYouNotesCount,
    day_14_review: { drafted: Boolean(day14Review), approved: day14Review?.editorial_status === "approved" },
    day_14_decision: { made: decisionMade, candidate_id: decisionMade ? day14Decision!.selected_candidate_ids[0] : null },
    complete: phase4CompletionSatisfied(slug, rules),
    blocking,
  };
}

// Same four-way branching order phase-1/2/3's cp-driven phase_status always used (cleared ->
// complete, complete_count===required_count && pace_recorded -> checkpoint_ready, required.length>0
// -> awaiting_you, else drafting), parameterized so it can run against whichever checkpoint is
// currently active rather than being hardcoded to checkpoint-1 -- see deriveState's comment on why
// this fixes the pre-existing phase_status bug.
// Exported so status.ts can render Phase 1's block through the same status derivation deriveState
// itself uses for phase_status, rather than duplicating this four-way branch a second time.
export function checkpointPhaseStatus(cp: CheckpointState | undefined): PhaseStatus {
  if (!cp) return "drafting";
  if (cp.cleared) return "complete";
  if (cp.complete_count === cp.required_count && cp.pace_recorded) return "checkpoint_ready";
  if (cp.required.length > 0) return "awaiting_you";
  return "drafting";
}

// Phase 4's own phase_status, mirroring the same "first thing that's true wins" shape as
// checkpointPhaseStatus but over Phase4State's fields instead of a required-artifact manifest --
// there is no checkpoint to clear, so "complete" comes straight from phase4CompletionSatisfied.
function phase4PhaseStatus(p4: Phase4State): PhaseStatus {
  if (p4.complete) return "complete";
  if (p4.operating_plan.drafted && !p4.operating_plan.approved) return "awaiting_you";
  if (p4.day_14_review.drafted && !p4.day_14_review.approved) return "awaiting_you";
  if (p4.day_14_review.approved && !p4.day_14_decision.made) return "awaiting_you";
  return "drafting";
}

// Turns "checkpoint-1" into "Checkpoint 1" for human-readable output; falls back to the raw id
// for anything that doesn't match the "checkpoint-<n>" shape (e.g. a future "phase_3_completed").
function checkpointLabel(checkpointId: string): string {
  const m = /^checkpoint-(\d+)$/.exec(checkpointId);
  return m ? `Checkpoint ${m[1]}` : checkpointId;
}

// Derives phase/checkpoint state from canon.md (the authority) on every call -- never trusts a
// stale cache. Also rewrites state.md as a human-readable snapshot, but that file is disposable:
// a disagreeing cache is rebuilt here, never repaired by re-running a transition.
//
// `checkpoint1RequiredCount` overrides checkpoint-1's required_artifact_count (rules.yaml already
// declares 3, same as this function's old hardcoded default) -- kept ONLY because tests seed a
// single required artifact and need a matching count of 1 to exercise complete/blocked states
// without seeding three real fixtures. Checkpoint-2 and any future checkpoint always reads its
// count from rules.yaml directly, with no equivalent override -- this is the one legitimate
// exception to "don't have two plumbing paths for the same information," not a second general path.
//
// SPLIT (Venture room read routes): the caching write below is what makes deriveState unsafe for a
// GET. computeState() is this same derivation with the write removed -- byte-identical result, no
// mkdirSync, no state.md. Read-only HTTP callers use computeState; everything that was already
// calling deriveState keeps the cache-refreshing behavior it had.
export function computeState(slug: string, checkpoint1RequiredCount?: number): VentureState {
  const rules = loadRules();
  const artifacts = readArtifacts(slug);

  const checkpoints: Record<string, CheckpointState> = {};
  for (const [checkpointId, cfg] of Object.entries(rules.checkpoints)) {
    const effectiveCfg: CheckpointRule =
      checkpointId === "checkpoint-1" && checkpoint1RequiredCount !== undefined
        ? { ...cfg, required_artifact_count: checkpoint1RequiredCount }
        : cfg;
    checkpoints[checkpointId] = checkpointArtifactState(slug, checkpointId, effectiveCfg, rules, artifacts);
  }
  const phase4 = derivePhase4State(slug, rules);

  // No explicit "current_phase" transition rule is written down anywhere in venture/rules.md or
  // docs/venture-schema-contract.md (the schema contract's `current_phase: 1..4` is the aspirational
  // full API shape, not a rule for computing it) -- conservatively inferred from the same checkpoint-
  // clearing signal each phase already gates its own next step on: checkpoint-1 clearing is the
  // earliest point the ledger records the venture having moved past Phase 1's own required work (the
  // phase-1-research-continuation decision that actually unlocks Phase 2 concept generation can only
  // be selected after checkpoint-1 clears, per rules.md §5.6's requireCheckpoint1Cleared gate in
  // phase1.ts); checkpoint-2 clearing is the same signal for Phase 2 -> Phase 3 (rules.md §7.1's
  // Phase 3 posting/response-gate work only makes sense once the lead magnet/landing page/welcome
  // email/survey are live); checkpoint-3 clearing (recorded as phase-3-completed) is the same signal
  // for Phase 3 -> Phase 4 (Phase 4 opens only once Phase 3's decisions are approved -- rules.md §11
  // item 18, phase4.ts's requirePhase4Unlocked). There is no checkpoint-4, so current_phase stops at
  // 4 once checkpoint-3 clears -- being IN Phase 4 and being DONE with Phase 4 are different facts,
  // the latter tracked by phase4.complete / phase_status below, not by current_phase advancing further.
  const cp1 = checkpoints["checkpoint-1"];
  const cp2 = checkpoints["checkpoint-2"];
  const cp3 = checkpoints["checkpoint-3"];
  const currentPhase: 1 | 2 | 3 | 4 = cp3?.cleared ? 4 : cp2?.cleared ? 3 : cp1?.cleared ? 2 : 1;

  // FIX (was a pre-existing bug): phase_status used to be driven by checkpoint-1 alone, no matter
  // which phase the venture had actually reached -- checkpoint-1 clearing made phase_status read
  // "complete" instantly and permanently, even with Phase 2/3/4 still entirely undone. It now reads
  // whichever checkpoint (or, in Phase 4, Phase4State) corresponds to currentPhase, so "complete"
  // only means what docs/venture-schema-contract.md §5.2 says it means: "the venture finished Phase
  // 4 and its Day 14 review." By construction, whenever currentPhase is 1/2/3, that phase's own
  // checkpoint has NOT cleared yet (clearing it is what advances currentPhase past it) -- so the
  // "complete" branch inside checkpointPhaseStatus is effectively unreachable for phases 1-3 here,
  // exactly as it should be.
  let phaseStatus: PhaseStatus;
  if (currentPhase === 1) phaseStatus = checkpointPhaseStatus(cp1);
  else if (currentPhase === 2) phaseStatus = checkpointPhaseStatus(cp2);
  else if (currentPhase === 3) phaseStatus = checkpointPhaseStatus(cp3);
  else phaseStatus = phase4PhaseStatus(phase4);

  const state: VentureState = {
    slug,
    current_phase: currentPhase,
    phase_status: phaseStatus,
    checkpoints,
    phase4,
  };
  return state;
}

// The original entry point, unchanged in behavior: derive, then refresh the disposable state.md
// snapshot beside canon.md.
export function deriveState(slug: string, checkpoint1RequiredCount?: number): VentureState {
  const state = computeState(slug, checkpoint1RequiredCount);
  mkdirSync(ventureDir(slug), { recursive: true });
  writeFileSync(statePath(slug), renderStateMd(state));
  return state;
}

function renderStateMd(state: VentureState): string {
  const lines = [
    `# State (derived cache — never authoritative, see canon.md)`,
    ``,
    `current_phase: ${state.current_phase}`,
    `phase_status: ${state.phase_status}`,
  ];
  for (const [checkpointId, cp] of Object.entries(state.checkpoints)) {
    // decisions=x/y is appended only for a checkpoint that declares required_decision_kinds
    // (checkpoint-3 today) -- checkpoint-1/checkpoint-2 read 0/0 here and keep this line exactly as
    // it was before the generalization.
    const decisionsSuffix = cp.decisions_required_count
      ? `, decisions=${cp.decisions_complete_count}/${cp.decisions_required_count}`
      : "";
    lines.push(
      `${checkpointId}: ${cp.complete_count}/${cp.required_count} live, pace_recorded=${cp.pace_recorded}, cleared=${cp.cleared}${decisionsSuffix}`
    );
  }
  lines.push(
    `phase-4: operating_plan(drafted=${state.phase4.operating_plan.drafted}, approved=${state.phase4.operating_plan.approved}), ` +
      `thank_you_notes=${state.phase4.thank_you_notes_count}, ` +
      `day_14_review(drafted=${state.phase4.day_14_review.drafted}, approved=${state.phase4.day_14_review.approved}), ` +
      `day_14_decision(made=${state.phase4.day_14_decision.made}, candidate=${state.phase4.day_14_decision.candidate_id ?? "none"}), ` +
      `complete=${state.phase4.complete}`
  );
  lines.push(``);
  for (const [checkpointId, cp] of Object.entries(state.checkpoints)) {
    if (!cp.blocking.length) continue;
    lines.push(`## What's blocking ${checkpointLabel(checkpointId)}`, ``);
    for (const b of cp.blocking) {
      lines.push(`- ${b.artifact_id ?? "(no artifact)"}: ${b.reason}`);
    }
    lines.push(``);
  }
  return lines.join("\n").replace(/\n+$/, "\n");
}
