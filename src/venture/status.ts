import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { computeState, deriveState, checkpointPhaseStatus, type CheckpointBlocker, type CheckpointState, type Phase4State, type VentureState } from "./state.js";
import { getResponseGateState } from "./responses.js";
import { clusterAnalysisPath } from "./paths.js";
import { loadRules } from "./rules.js";
import { maybeCompletePhase4 } from "./phase4.js";

// Read-only (formatStatus's own render step). Plain language throughout -- never "artifact",
// "delivery status", "gated" in the output (venture/AGENTS.md's user-facing vocabulary).

export function formatStatus(slug: string): string {
  // Opportunistic lazy write, ahead of the pure read below: day-14-decide only requires the
  // day-14-review artifact approved, not the daily-operating-plan artifact, so Muxin can decide
  // Day 14 before approving the operating plan. If she does, maybeCompletePhase4 (called from
  // day-14-decide at the time) finds the completion predicate unsatisfied and returns -- and
  // because a decision record is immutable once selected, day-14-decide can never run again to
  // re-check. Without this call, approving the operating plan afterward would never re-trigger
  // phase-4-completed. Calling it here means simply running `venture:status` (or any call to
  // formatStatus) after that ordering gap self-heals it: it recomputes the same predicate fresh
  // and, if now satisfied, fires the canon event and back-fills the artifact's decision fields
  // before we render. deriveState()'s own read of Phase4State is independently self-healing too
  // (state.ts's derivePhase4State calls phase4CompletionSatisfied directly rather than trusting
  // the canon event), so the rendered status is correct either way -- this call just makes the
  // ledger event itself stop lagging forever.
  const rules = loadRules();
  maybeCompletePhase4(slug, rules);

  return renderStatus(slug, deriveState(slug));
}

// The same render with no lazy write and no state.md refresh, for read-only HTTP callers (the
// Venture room's GET /api/venture/:slug/state). The rendered text is identical: deriveState's own
// derivePhase4State recomputes the completion predicate directly rather than trusting the canon
// event, so skipping maybeCompletePhase4 changes only whether the LEDGER catches up -- which is
// precisely the side effect a GET must not have. A status read never repairs the ledger; running
// `venture:status` (or any real phase command) still does.
export function formatStatusReadOnly(slug: string): string {
  return renderStatus(slug, computeState(slug));
}

function renderStatus(slug: string, state: VentureState): string {
  const lines: string[] = [`${slug} -- Phase ${state.current_phase}`];

  // Only the phase Muxin is actually in gets rendered -- once current_phase moves past a phase,
  // that phase's own block (and any "Checkpoint N is cleared" line inside it) stops appearing, so
  // no stale message from an earlier phase survives into later output.
  if (state.current_phase === 1) renderPhase1(state.checkpoints["checkpoint-1"], lines);
  else if (state.current_phase === 2) renderPhase2(state.checkpoints["checkpoint-2"], lines);
  else if (state.current_phase === 3) renderPhase3(slug, state.checkpoints["checkpoint-3"], lines);
  else renderPhase4(state.phase4, lines);

  return lines.join("\n");
}

function renderPhase1(cp1: CheckpointState | undefined, lines: string[]) {
  if (!cp1) return;
  switch (checkpointPhaseStatus(cp1)) {
    case "drafting":
      lines.push("No posts drafted yet.");
      break;
    case "awaiting_you":
      lines.push(`${cp1.complete_count} of ${cp1.required_count} posts are live.`);
      break;
    case "checkpoint_ready":
      lines.push("All required posts are live and your pace is recorded -- ready to clear Checkpoint 1.");
      break;
  }
  // current_phase only reads 1 while checkpoint-1 hasn't cleared yet, so cp1.blocking is always
  // relevant to show here -- no "cleared" case to guard against, unlike the old unconditional block.
  if (cp1.blocking.length) {
    lines.push("", "What's still needed:");
    for (const b of cp1.blocking) {
      lines.push(`- ${b.artifact_id ? `post "${b.artifact_id}"` : "posting pace"}: ${plainReason(b.reason)}`);
    }
  }
}

function renderPhase2(cp2: CheckpointState | undefined, lines: string[]) {
  if (!cp2) return;
  lines.push(`${cp2.complete_count} of ${cp2.required_count} required items are live.`);
  // current_phase only reads 2 while checkpoint-2 hasn't cleared yet, so there is no "cleared" case
  // to render here -- same reasoning as renderPhase1's dropped "complete" case. An empty blocking
  // list here (checkpoint_ready but not yet cleared) prints nothing further, unchanged from before.
  if (cp2.blocking.length) {
    lines.push("", "What Phase 2 still needs:");
    for (const b of cp2.blocking) {
      const reason = plainReason(b.reason);
      lines.push(b.artifact_id ? `- "${b.artifact_id}": ${reason}` : `- ${reason}`);
    }
  }
}

function renderPhase3(slug: string, cp3: CheckpointState | undefined, lines: string[]) {
  if (!cp3) return;
  const gate = getResponseGateState(slug);
  if (gate.state === "closed") {
    // rules.md §10's copy table: "eligible unique respondents" -> "people who count toward the
    // goal"; "gated" -> "waiting for enough answers".
    lines.push(
      `${gate.have} of ${gate.need} people who count toward the goal so far (aiming for ${gate.target}) -- ` +
        `still waiting for enough answers, posting continues in the meantime.`
    );
    return;
  }
  lines.push(`${gate.have} people who count toward the goal -- enough to start choosing the problem, the outline, and the price.`);
  if (!existsSync(clusterAnalysisPath(slug))) {
    lines.push("The responses haven't been grouped into common problems yet.");
  } else if (cp3.blocking.length) {
    lines.push("", "What Phase 3 still needs:");
    for (const b of cp3.blocking) {
      lines.push(`- ${plainPhase3Reason(b)}`);
    }
  } else {
    lines.push("The problem, the change this creates, the outline, and the price are all approved -- ready to clear Checkpoint 3.");
  }
}

const DAY14_DECISION_LABELS: Record<string, string> = {
  continue: "keep going as planned",
  revise_positioning: "revise the positioning",
  revise_lead_magnet: "revise the lead magnet",
  collect_more_evidence: "collect more evidence before deciding further",
  stop: "stop",
};

function renderPhase4(p4: Phase4State, lines: string[]) {
  lines.push(
    p4.operating_plan.drafted
      ? p4.operating_plan.approved
        ? "The daily operating plan is drafted and approved."
        : "The daily operating plan is drafted and waiting on your review."
      : "The daily operating plan hasn't been drafted yet."
  );
  if (p4.thank_you_notes_count > 0) {
    lines.push(`${p4.thank_you_notes_count} thank-you note${p4.thank_you_notes_count === 1 ? "" : "s"} drafted so far.`);
  }
  lines.push(
    p4.day_14_review.drafted
      ? p4.day_14_review.approved
        ? "The Day 14 review is drafted and approved."
        : "The Day 14 review is drafted and waiting on your review."
      : "The Day 14 review hasn't been drafted yet."
  );
  lines.push(
    p4.day_14_decision.made
      ? `The Day 14 decision has been made: ${DAY14_DECISION_LABELS[p4.day_14_decision.candidate_id ?? ""] ?? p4.day_14_decision.candidate_id}.`
      : "The Day 14 decision hasn't been made yet."
  );
  if (p4.complete) {
    lines.push("", "Phase 4 is complete -- the venture's active build is done.");
  } else if (p4.blocking.length) {
    lines.push("", "What Phase 4 still needs:");
    for (const b of p4.blocking) {
      lines.push(`- ${plainPhase4Reason(b)}`);
    }
  }
}

// rules.md §7.10's four remaining gate items once the response gate is open and common problems
// are grouped: the problem chosen, the transformation approved, the outline approved, the price
// and pitch approved. Kept separate from plainReason (checkpoint-1/checkpoint-2's translator)
// rather than folded into it -- Phase 3's blocking reasons name a decision_kind as well as an
// artifact_kind, a shape checkpoint-1/checkpoint-2 never produce, and this keeps that
// checkpoint-2-proven translator's behavior untouched.
const MISSING_OUTLINE_OR_PRICE_ARTIFACT: Record<string, string> = {
  "product-outline": "The outline hasn't been drafted yet.",
  "price-decision": "The price and pitch haven't been drafted yet.",
};
const MISSING_PHASE3_DECISION: Record<string, string> = {
  "problem-selection": "The core problem hasn't been chosen yet.",
  "transformation-choice": "The change this creates hasn't been approved yet.",
  "product-format-and-price": "The price hasn't been chosen yet.",
};
const AWAITING_REVIEW_PHASE3_ARTIFACT: Record<string, string> = {
  "p3-product-outline": "The outline is drafted and waiting on your review.",
  "p3-price-decision": "The price and pitch are drafted and waiting on your review.",
};

function plainPhase3Reason(b: CheckpointBlocker): string {
  const missingArtifactKind = /^missing required artifact kind "(.+)"$/.exec(b.reason);
  if (missingArtifactKind) {
    return MISSING_OUTLINE_OR_PRICE_ARTIFACT[missingArtifactKind[1]] ?? `"${missingArtifactKind[1]}" hasn't been drafted yet.`;
  }
  const missingDecisionKind = /^missing required decision kind "(.+)"$/.exec(b.reason);
  if (missingDecisionKind) {
    return MISSING_PHASE3_DECISION[missingDecisionKind[1]] ?? `"${missingDecisionKind[1]}" hasn't been chosen yet.`;
  }
  // The artifact exists but isn't approved yet -- reason is an editorial/delivery pair (e.g.
  // "draft/not_applicable"), which names no kind on its own; the fixed artifact_id (phase3.ts
  // always writes "p3-product-outline"/"p3-price-decision") is what tells us which one.
  return AWAITING_REVIEW_PHASE3_ARTIFACT[b.artifact_id ?? ""] ?? "One item is drafted and waiting on your review.";
}

// Mirrors plainPhase3Reason's shape, over rules.phase4_completion's own required kinds
// (daily-operating-plan/day-14-review artifacts, daily-operating-plan-choice/day-14-decision
// decisions) instead of Phase 3's outline/price/problem/transformation set.
const MISSING_PHASE4_ARTIFACT: Record<string, string> = {
  "daily-operating-plan": "The daily operating plan hasn't been drafted yet.",
  "day-14-review": "The Day 14 review hasn't been drafted yet.",
};
const MISSING_PHASE4_DECISION: Record<string, string> = {
  "daily-operating-plan-choice": "The daily operating plan mode hasn't been chosen yet.",
  "day-14-decision": "The Day 14 decision hasn't been made yet.",
};
const AWAITING_REVIEW_PHASE4_ARTIFACT: Record<string, string> = {
  "p4-operating-plan": "The daily operating plan is drafted and waiting on your review.",
  "p4-day-14-review": "The Day 14 review is drafted and waiting on your review.",
};

function plainPhase4Reason(b: CheckpointBlocker): string {
  const missingArtifactKind = /^missing required artifact kind "(.+)"$/.exec(b.reason);
  if (missingArtifactKind) {
    return MISSING_PHASE4_ARTIFACT[missingArtifactKind[1]] ?? `"${missingArtifactKind[1]}" hasn't been drafted yet.`;
  }
  const missingDecisionKind = /^missing required decision kind "(.+)"$/.exec(b.reason);
  if (missingDecisionKind) {
    return MISSING_PHASE4_DECISION[missingDecisionKind[1]] ?? `"${missingDecisionKind[1]}" hasn't been made yet.`;
  }
  return AWAITING_REVIEW_PHASE4_ARTIFACT[b.artifact_id ?? ""] ?? "One item is drafted and waiting on your review.";
}

function plainReason(reason: string): string {
  if (reason === "posting pace not recorded") return "not recorded yet";

  // Checkpoint-2-shaped reasons (checkpointArtifactState's required_artifact_kinds branch,
  // state.ts) -- these never occur for checkpoint-1, which uses required_artifact_count instead.
  const missingKind = /^missing required artifact kind "(.+)"$/.exec(reason);
  if (missingKind) return `"${missingKind[1]}" not drafted yet`;
  if (/does not meet this kind's minimum/.test(reason)) return "live, but confirmed the wrong way";

  const [editorial, delivery] = reason.split("/");
  if (editorial === "draft") return "waiting on your review";
  if (editorial === "approved" && delivery !== "live_confirmed") return "approved, not live yet";
  if (editorial === "discarded") return "you discarded this one";
  return reason;
}

function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("usage: tsx src/venture/status.ts <slug>");
    process.exit(1);
  }
  console.log(formatStatus(slug));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
