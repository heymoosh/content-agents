import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deriveState, type CheckpointBlocker } from "./state.js";
import { getResponseGateState } from "./responses.js";
import { clusterAnalysisPath } from "./paths.js";

// Read-only. Plain language throughout -- never "artifact", "delivery status", "gated" in the
// output (venture/CLAUDE.md's user-facing vocabulary).

export function formatStatus(slug: string): string {
  const state = deriveState(slug);
  const cp1 = state.checkpoints["checkpoint-1"];
  const lines: string[] = [`${slug} -- Phase ${state.current_phase}`];

  switch (state.phase_status) {
    case "drafting":
      lines.push("No posts drafted yet.");
      break;
    case "awaiting_you":
      lines.push(`${cp1.complete_count} of ${cp1.required_count} posts are live.`);
      break;
    case "checkpoint_ready":
      lines.push("All required posts are live and your pace is recorded -- ready to clear Checkpoint 1.");
      break;
    case "complete":
      lines.push("Checkpoint 1 is cleared.");
      break;
  }

  if (cp1.blocking.length && state.phase_status !== "complete") {
    lines.push("", "What's still needed:");
    for (const b of cp1.blocking) {
      lines.push(`- ${b.artifact_id ? `post "${b.artifact_id}"` : "posting pace"}: ${plainReason(b.reason)}`);
    }
  }

  // Phase 2 visibility -- only once current_phase has actually moved past Phase 1 (checkpoint-1
  // cleared, see state.ts's deriveState). Before that, checkpoint-2 is computed but not yet
  // relevant to show Muxin.
  const cp2 = state.checkpoints["checkpoint-2"];
  if (state.current_phase === 2 && cp2) {
    lines.push("", `Phase 2 -- ${cp2.complete_count} of ${cp2.required_count} required items are live.`);
    if (cp2.cleared) {
      lines.push("Checkpoint 2 is cleared.");
    } else if (cp2.blocking.length) {
      lines.push("", "What Phase 2 still needs:");
      for (const b of cp2.blocking) {
        const reason = plainReason(b.reason);
        lines.push(b.artifact_id ? `- "${b.artifact_id}": ${reason}` : `- ${reason}`);
      }
    }
  }

  // Phase 3 visibility -- only once current_phase has actually moved past Phase 2 (checkpoint-2
  // cleared, see state.ts's deriveState), same gating pattern as Phase 2's own block above.
  const cp3 = state.checkpoints["checkpoint-3"];
  if (state.current_phase === 3 && cp3) {
    lines.push("", "Phase 3");
    const gate = getResponseGateState(slug);
    if (gate.state === "closed") {
      // rules.md §10's copy table: "eligible unique respondents" -> "people who count toward the
      // goal"; "gated" -> "waiting for enough answers".
      lines.push(
        `${gate.have} of ${gate.need} people who count toward the goal so far (aiming for ${gate.target}) -- ` +
          `still waiting for enough answers, posting continues in the meantime.`
      );
    } else {
      lines.push(`${gate.have} people who count toward the goal -- enough to start choosing the problem, the outline, and the price.`);
      if (!existsSync(clusterAnalysisPath(slug))) {
        lines.push("The responses haven't been grouped into common problems yet.");
      } else if (cp3.cleared) {
        lines.push("Phase 3 is complete -- the problem, the change this creates, the outline, and the price are all approved.");
      } else if (cp3.blocking.length) {
        lines.push("", "What Phase 3 still needs:");
        for (const b of cp3.blocking) {
          lines.push(`- ${plainPhase3Reason(b)}`);
        }
      } else {
        lines.push("The problem, the change this creates, the outline, and the price are all approved -- ready to clear Checkpoint 3.");
      }
    }
  }

  return lines.join("\n");
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
