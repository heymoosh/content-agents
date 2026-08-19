import { fileURLToPath } from "node:url";
import { loadRules, requireRulesVersionMatch } from "./rules.js";
import { deriveState, type CheckpointState } from "./state.js";
import { appendCanonEvent } from "./canon.js";

// A checkpoint clears only when ALL of: the required artifacts are approved, all are
// live_confirmed with evidence, and (for checkpoints that declare it) the ongoing posting pace
// is recorded (rules.md §5.5 for checkpoint-1). Approval alone never clears it, and there is no
// partial pass (Muxin, 2026-08-18).

export interface CheckpointResult {
  cleared: boolean;
  alreadyCleared: boolean;
  reason?: string;
}

export function recordPace(slug: string, postsPerWeek: string, at: string): { alreadyRecorded: boolean } {
  requireRulesVersionMatch(slug, loadRules());
  return appendCanonEvent(slug, "pace-recorded", `${slug}/phase-1/pace`, { per_week: postsPerWeek }, at);
}

export function clearCheckpoint(slug: string, checkpointId: string, at: string): CheckpointResult {
  const rules = loadRules();
  requireRulesVersionMatch(slug, rules);
  const cfg = rules.checkpoints[checkpointId];
  if (!cfg) {
    throw new Error(
      `no such checkpoint "${checkpointId}" in venture/rules.yaml -- known checkpoints: ${Object.keys(rules.checkpoints).join(", ")}`
    );
  }

  // state.ts only exposes named checkpoint1/checkpoint2 fields (not a generic map), so dispatch
  // by id here. A future checkpoint-3 needs a matching branch added -- and its own rules.yaml
  // entry, which is what the guard above already refuses loudly without.
  let cp: CheckpointState | undefined;
  if (checkpointId === "checkpoint-1") {
    cp = deriveState(slug, cfg.required_artifact_count).checkpoint1;
  } else if (checkpointId === "checkpoint-2") {
    cp = deriveState(slug).checkpoint2;
  } else {
    throw new Error(`clearCheckpoint has no handling wired up for checkpoint id "${checkpointId}" yet`);
  }
  if (!cp) {
    throw new Error(`checkpoint "${checkpointId}" state was not computed`);
  }

  if (cp.cleared) {
    return { cleared: true, alreadyCleared: true };
  }
  if (cp.complete_count !== cp.required_count) {
    return {
      cleared: false,
      alreadyCleared: false,
      reason: `${cp.complete_count}/${cp.required_count} required artifacts are approved+live -- no partial pass`,
    };
  }
  if (cfg.require_pace_recorded && !cp.pace_recorded) {
    return { cleared: false, alreadyCleared: false, reason: "posting pace not recorded -- run recordPace first" };
  }

  appendCanonEvent(
    slug,
    "checkpoint-cleared",
    `${slug}/${checkpointId}`,
    { complete: String(cp.complete_count), required: String(cp.required_count) },
    at
  );
  return { cleared: true, alreadyCleared: false };
}

// Kept so anything still calling the old checkpoint-1-only name doesn't break.
export function clearCheckpoint1(slug: string, at: string): CheckpointResult {
  return clearCheckpoint(slug, "checkpoint-1", at);
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
    if (!which) {
      console.error("usage: tsx src/venture/checkpoint.ts clear <slug> <checkpoint-1|checkpoint-2>");
      process.exit(1);
    }
    let r: CheckpointResult;
    try {
      r = clearCheckpoint(slug, which, new Date().toISOString());
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
    if (r.cleared) {
      console.log(r.alreadyCleared ? `${which} was already cleared` : `${which} cleared -- next phase unlocked (not yet built)`);
    } else {
      console.error(`${which} not cleared: ${r.reason}`);
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
