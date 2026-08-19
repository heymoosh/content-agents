import { mkdirSync, writeFileSync } from "node:fs";
import { readArtifacts, type VentureArtifact } from "./artifacts.js";
import { hasCanonEvent, findCanonEvent } from "./canon.js";
import { statePath, ventureDir } from "./paths.js";
import { loadRules, artifactKindRule } from "./rules.js";

export type PhaseStatus = "drafting" | "awaiting_you" | "checkpoint_ready" | "blocked" | "complete";

export interface CheckpointBlocker {
  artifact_id: string | null;
  reason: string;
}

export interface Checkpoint1State {
  required: VentureArtifact[];
  complete_count: number;
  required_count: number;
  pace_recorded: boolean;
  cleared: boolean;
  blocking: CheckpointBlocker[];
}

export interface VentureState {
  slug: string;
  current_phase: 1;
  phase_status: PhaseStatus;
  checkpoint1: Checkpoint1State;
}

// checkpoint_id is stamped on an artifact at draft time (createArtifact), so "required for
// Checkpoint 1" is a plain join against artifacts.jsonl -- no separate manifest event needed.
function checkpoint1State(slug: string, requiredCount: number): Checkpoint1State {
  const rules = loadRules();
  const required = readArtifacts(slug).filter((a) => a.checkpoint_id === "checkpoint-1");
  const blocking: CheckpointBlocker[] = [];
  let completeCount = 0;
  for (const a of required) {
    const approvedAndConfirmed = a.editorial_status === "approved" && a.delivery_status === "live_confirmed" && a.evidence;
    if (!approvedAndConfirmed) {
      blocking.push({ artifact_id: a.artifact_id, reason: `${a.editorial_status}/${a.delivery_status}` });
      continue;
    }
    // docs/venture-schema-contract.md §3-4: each kind declares a minimum evidence type
    // (e.g. substack-post requires a real "url", not a bare attestation). A truthy evidence
    // object alone isn't enough -- it must be at least as strong as that kind's minimum.
    const minEvidence = artifactKindRule(rules, a.artifact_kind).min_evidence;
    if (minEvidence && a.evidence!.type !== minEvidence) {
      blocking.push({
        artifact_id: a.artifact_id,
        reason: `evidence type "${a.evidence!.type}" does not meet this kind's minimum ("${minEvidence}")`,
      });
      continue;
    }
    completeCount++;
  }
  const paceEvent = findCanonEvent(slug, `${slug}/phase-1/pace`);
  const paceRecorded = Boolean(paceEvent);
  if (!paceRecorded) blocking.push({ artifact_id: null, reason: "posting pace not recorded" });
  const cleared = hasCanonEvent(slug, `${slug}/checkpoint-1`);
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
  const cp1 = checkpoint1State(slug, requiredCount);
  let phaseStatus: PhaseStatus;
  if (cp1.cleared) phaseStatus = "complete";
  else if (cp1.complete_count === cp1.required_count && cp1.pace_recorded) phaseStatus = "checkpoint_ready";
  else if (cp1.required.length > 0) phaseStatus = "awaiting_you";
  else phaseStatus = "drafting";

  const state: VentureState = { slug, current_phase: 1, phase_status: phaseStatus, checkpoint1: cp1 };
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
    ``,
  ];
  if (state.checkpoint1.blocking.length) {
    lines.push(`## What's blocking Checkpoint 1`, ``);
    for (const b of state.checkpoint1.blocking) {
      lines.push(`- ${b.artifact_id ?? "(no artifact)"}: ${b.reason}`);
    }
  }
  return lines.join("\n") + "\n";
}
