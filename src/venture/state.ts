import { mkdirSync, writeFileSync } from "node:fs";
import { readArtifacts, type VentureArtifact } from "./artifacts.js";
import { hasCanonEvent, findCanonEvent } from "./canon.js";
import { statePath, ventureDir } from "./paths.js";
import { loadRules, artifactKindRule, type CheckpointRule } from "./rules.js";

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
  cleared: boolean;
  blocking: CheckpointBlocker[];
}

// Kept so anything still importing the old name doesn't break.
export type Checkpoint1State = CheckpointState;

export interface VentureState {
  slug: string;
  current_phase: 1 | 2;
  phase_status: PhaseStatus;
  checkpoint1: CheckpointState;
  checkpoint2?: CheckpointState;
}

// checkpoint_id is stamped on an artifact at draft time (createArtifact), so "required for a
// given checkpoint" is a plain join against artifacts.jsonl -- no separate manifest event needed.
//
// A CheckpointRule uses exactly one of two shapes (rules.ts):
//   - required_artifact_kinds: exactly one live artifact per named kind (checkpoint-2 style)
//   - required_artifact_count: N of any required-checkpoint_id artifact (checkpoint-1 style)
function checkpointArtifactState(slug: string, checkpointId: string, cfg: CheckpointRule): CheckpointState {
  const rules = loadRules();
  const required = readArtifacts(slug).filter((a) => a.checkpoint_id === checkpointId);
  const blocking: CheckpointBlocker[] = [];
  let completeCount = 0;
  let requiredCount: number;

  // docs/venture-schema-contract.md §3-4: each kind declares a minimum evidence type (e.g.
  // substack-post requires a real "url", not a bare attestation). A truthy evidence object
  // alone isn't enough -- it must exactly match that kind's minimum.
  function checkArtifact(a: VentureArtifact, labelKind?: string): boolean {
    const approvedAndConfirmed = a.editorial_status === "approved" && a.delivery_status === "live_confirmed" && a.evidence;
    if (!approvedAndConfirmed) {
      blocking.push({ artifact_id: a.artifact_id, reason: `${a.editorial_status}/${a.delivery_status}` });
      return false;
    }
    const minEvidence = artifactKindRule(rules, a.artifact_kind).min_evidence;
    if (minEvidence && a.evidence!.type !== minEvidence) {
      blocking.push({
        artifact_id: a.artifact_id,
        reason: labelKind
          ? `evidence type "${a.evidence!.type}" does not meet this kind's minimum ("${minEvidence}") for "${labelKind}"`
          : `evidence type "${a.evidence!.type}" does not meet this kind's minimum ("${minEvidence}")`,
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

  const cleared = hasCanonEvent(slug, `${slug}/${checkpointId}`);
  return {
    required,
    complete_count: completeCount,
    required_count: requiredCount,
    pace_recorded: paceRecorded,
    cleared,
    blocking,
  };
}

// Derives phase/checkpoint state from canon.md (the authority) on every call -- never trusts a
// stale cache. Also rewrites state.md as a human-readable snapshot, but that file is disposable:
// a disagreeing cache is rebuilt here, never repaired by re-running a transition.
export function deriveState(slug: string, requiredCount = 3): VentureState {
  const rules = loadRules();
  const cp1Cfg: CheckpointRule = { ...rules.checkpoints["checkpoint-1"], required_artifact_count: requiredCount };
  const cp1 = checkpointArtifactState(slug, "checkpoint-1", cp1Cfg);
  let phaseStatus: PhaseStatus;
  if (cp1.cleared) phaseStatus = "complete";
  else if (cp1.complete_count === cp1.required_count && cp1.pace_recorded) phaseStatus = "checkpoint_ready";
  else if (cp1.required.length > 0) phaseStatus = "awaiting_you";
  else phaseStatus = "drafting";

  const cp2Cfg = rules.checkpoints["checkpoint-2"];
  const cp2 = cp2Cfg ? checkpointArtifactState(slug, "checkpoint-2", cp2Cfg) : undefined;

  const state: VentureState = {
    slug,
    current_phase: 1,
    phase_status: phaseStatus,
    checkpoint1: cp1,
    ...(cp2 ? { checkpoint2: cp2 } : {}),
  };
  mkdirSync(ventureDir(slug), { recursive: true });
  writeFileSync(statePath(slug), renderStateMd(state));
  return state;
}

function renderStateMd(state: VentureState): string {
  const lines = [
    `# State (derived cache — never authoritative, see canon.md)`,
    ``,
    `phase_status: ${state.phase_status}`,
    `checkpoint-1: ${state.checkpoint1.complete_count}/${state.checkpoint1.required_count} live, pace_recorded=${state.checkpoint1.pace_recorded}, cleared=${state.checkpoint1.cleared}`,
  ];
  if (state.checkpoint2) {
    lines.push(
      `checkpoint-2: ${state.checkpoint2.complete_count}/${state.checkpoint2.required_count} live, pace_recorded=${state.checkpoint2.pace_recorded}, cleared=${state.checkpoint2.cleared}`
    );
  }
  lines.push(``);
  if (state.checkpoint1.blocking.length) {
    lines.push(`## What's blocking Checkpoint 1`, ``);
    for (const b of state.checkpoint1.blocking) {
      lines.push(`- ${b.artifact_id ?? "(no artifact)"}: ${b.reason}`);
    }
    lines.push(``);
  }
  if (state.checkpoint2 && state.checkpoint2.blocking.length) {
    lines.push(`## What's blocking Checkpoint 2`, ``);
    for (const b of state.checkpoint2.blocking) {
      lines.push(`- ${b.artifact_id ?? "(no artifact)"}: ${b.reason}`);
    }
  }
  return lines.join("\n") + "\n";
}
