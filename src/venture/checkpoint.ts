import { fileURLToPath } from "node:url";
import { loadRules } from "./rules.js";
import { deriveState } from "./state.js";
import { appendCanonEvent } from "./canon.js";

// Checkpoint 1 clears only when ALL THREE of: the required posts are approved, all are
// live_confirmed with evidence, and the ongoing posting pace is recorded (rules.md §5.5).
// Approval alone never clears it, and there is no partial pass (Muxin, 2026-08-18).

export interface CheckpointResult {
  cleared: boolean;
  alreadyCleared: boolean;
  reason?: string;
}

export function recordPace(slug: string, postsPerWeek: string, at: string): { alreadyRecorded: boolean } {
  return appendCanonEvent(slug, "pace-recorded", `${slug}/phase-1/pace`, { per_week: postsPerWeek }, at);
}

export function clearCheckpoint1(slug: string, at: string): CheckpointResult {
  const rules = loadRules();
  const cfg = rules.checkpoints["checkpoint-1"];
  const state = deriveState(slug, cfg.required_artifact_count);

  if (state.checkpoint1.cleared) {
    return { cleared: true, alreadyCleared: true };
  }
  if (state.checkpoint1.complete_count !== state.checkpoint1.required_count) {
    return {
      cleared: false,
      alreadyCleared: false,
      reason: `${state.checkpoint1.complete_count}/${state.checkpoint1.required_count} required posts are approved+live -- no partial pass`,
    };
  }
  if (cfg.require_pace_recorded && !state.checkpoint1.pace_recorded) {
    return { cleared: false, alreadyCleared: false, reason: "posting pace not recorded -- run recordPace first" };
  }

  appendCanonEvent(
    slug,
    "checkpoint-cleared",
    `${slug}/checkpoint-1`,
    { complete: String(state.checkpoint1.complete_count), required: String(state.checkpoint1.required_count) },
    at
  );
  return { cleared: true, alreadyCleared: false };
}

function main() {
  const [, , sub, slug, ...rest] = process.argv;
  if (sub === "pace" && slug) {
    const value = rest[0];
    if (!value) {
      console.error("usage: tsx src/venture/checkpoint.ts pace <slug> <N/week>");
      process.exit(1);
    }
    const r = recordPace(slug, value, new Date().toISOString());
    console.log(r.alreadyRecorded ? "pace already recorded" : `pace recorded: ${value}`);
    return;
  }
  if (sub === "clear" && slug) {
    const which = rest[0];
    if (which !== "checkpoint-1") {
      console.error("usage: tsx src/venture/checkpoint.ts clear <slug> checkpoint-1");
      process.exit(1);
    }
    const r = clearCheckpoint1(slug, new Date().toISOString());
    if (r.cleared) {
      console.log(r.alreadyCleared ? "checkpoint-1 was already cleared" : "checkpoint-1 cleared -- Phase 2 unlocked (not yet built)");
    } else {
      console.error(`checkpoint-1 not cleared: ${r.reason}`);
      process.exit(1);
    }
    return;
  }
  console.error("usage: tsx src/venture/checkpoint.ts <pace|clear> <slug> ...");
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
