import { fileURLToPath } from "node:url";
import { loadRules, requireRulesVersionMatch } from "./rules.js";
import { deriveState, ledgerEventId } from "./state.js";
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

  // state.ts now exposes a generic checkpoints map (rules.checkpoints is already
  // Record<string, CheckpointRule>), so any checkpoint id rules.yaml declares works here with no
  // per-id branching -- a future checkpoint-3 needs only its own rules.yaml entry, which the guard
  // above already refuses loudly without.
  const cp = deriveState(slug).checkpoints[checkpointId];
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
  // Only checkpoint-3 declares required_decision_kinds today (rules.yaml) -- every other checkpoint
  // reads 0/0 here and this branch never fires, so checkpoint-1/checkpoint-2's clearing predicate is
  // unchanged. rules.md §7.10 / venture-schema-contract.md §5.3: the problem, transformation, and
  // price/format decisions must each be `selected`, alongside the two artifacts checked above --
  // both conditions, no partial pass on either.
  if (cp.decisions_complete_count !== cp.decisions_required_count) {
    const missingKinds = cp.blocking
      .map((b) => /^missing required decision kind "(.+)"$/.exec(b.reason)?.[1])
      .filter((k): k is string => Boolean(k));
    return {
      cleared: false,
      alreadyCleared: false,
      reason:
        `${cp.decisions_complete_count}/${cp.decisions_required_count} required decisions are selected -- ` +
        `no partial pass (missing: ${missingKinds.join(", ")})`,
    };
  }
  if (cfg.require_pace_recorded && !cp.pace_recorded) {
    return { cleared: false, alreadyCleared: false, reason: "posting pace not recorded -- run recordPace first" };
  }

  // Event id defaults to `<slug>/<checkpointId>` (checkpoint-1, checkpoint-2); checkpoint-3
  // overrides it via rules.yaml's ledger_event_id to `<slug>/phase-3-completed`
  // (venture-schema-contract.md §5.3) -- see ledgerEventId's comment in state.ts, which computed
  // `cp.cleared` above using the exact same function, so the read and the write never disagree.
  const eventId = ledgerEventId(slug, checkpointId, cfg);
  const fields: Record<string, string> = { complete: String(cp.complete_count), required: String(cp.required_count) };
  if (cp.decisions_required_count > 0) {
    fields.decisions_complete = String(cp.decisions_complete_count);
    fields.decisions_required = String(cp.decisions_required_count);
  }
  appendCanonEvent(slug, "checkpoint-cleared", eventId, fields, at);
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
    if (!which) {
      console.error("usage: tsx src/venture/checkpoint.ts clear <slug> <checkpoint-1|checkpoint-2|checkpoint-3>");
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
      console.log(r.alreadyCleared ? `${which} was already cleared` : `${which} cleared -- next phase unlocked`);
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
