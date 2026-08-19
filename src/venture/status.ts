import { fileURLToPath } from "node:url";
import { deriveState } from "./state.js";

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

  return lines.join("\n");
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
