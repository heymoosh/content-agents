import { fileURLToPath } from "node:url";
import { deriveState } from "./state.js";

// Read-only. Plain language throughout -- never "artifact", "delivery status", "gated" in the
// output (venture/CLAUDE.md's user-facing vocabulary).

export function formatStatus(slug: string): string {
  const state = deriveState(slug);
  const lines: string[] = [`${slug} -- Phase 1`];

  switch (state.phase_status) {
    case "drafting":
      lines.push("No posts drafted yet.");
      break;
    case "awaiting_you":
      lines.push(`${state.checkpoint1.complete_count} of ${state.checkpoint1.required_count} posts are live.`);
      break;
    case "checkpoint_ready":
      lines.push("All required posts are live and your pace is recorded -- ready to clear Checkpoint 1.");
      break;
    case "complete":
      lines.push("Checkpoint 1 is cleared.");
      break;
  }

  if (state.checkpoint1.blocking.length && state.phase_status !== "complete") {
    lines.push("", "What's still needed:");
    for (const b of state.checkpoint1.blocking) {
      lines.push(`- ${b.artifact_id ? `post "${b.artifact_id}"` : "posting pace"}: ${plainReason(b.reason)}`);
    }
  }

  return lines.join("\n");
}

function plainReason(reason: string): string {
  if (reason === "posting pace not recorded") return "not recorded yet";
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
