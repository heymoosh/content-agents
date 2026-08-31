import { createHash } from "node:crypto";
import { appendCanonEvent, readCanonEvents } from "./canon.js";
import { createArtifact, readArtifact, type VentureArtifact } from "./artifacts.js";
import { computeState } from "./state.js";
import { loadRules, requireRulesVersionMatch } from "./rules.js";
import { withFileLock } from "../runtime/file-lock.js";
import { join } from "node:path";
import { ventureDir } from "./paths.js";

/** The strict, body-free envelope Venture accepts from the Content/Signals boundary. */
export interface SignalsInputHandoff {
  pointer_id: string;
  venture_id: string;
  phase: number;
  rules_version: string;
  input_kind: string;
  source_record_refs: string[];
  evidence_refs: string[];
  content_item_refs: string[];
  scope: string;
  sample_size: number;
  provenance: string;
  caveats: string[];
  lineage: { source_id: string; variant_id: string; experiment_id: string };
  content_decision: { status: "approved"; decided_by: "muxin"; decision_ref: string };
  venture_gate_ref: string;
  qualification: string;
  evidence_status: string;
}

export interface SignalsInputDecision {
  outcome: "accept" | "reject" | "request-more-evidence";
  decided_by: "muxin";
  decision_ref: string;
  reason: string;
}

export interface SignalsInputAcceptance {
  alreadyRecorded: boolean;
  artifact: VentureArtifact | null;
  factRef: string;
}

function fail(message: string): never { throw new Error(`signals-input: ${message}`); }
function nonEmpty(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") fail(`${field} must be a non-empty string`);
  return value;
}
function refs(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((v) => typeof v !== "string" || !v.trim())) fail(`${field} must contain non-empty refs`);
  if (new Set(value).size !== value.length) fail(`${field} must contain unique refs`);
  return [...value] as string[];
}
function exactKeys(value: object, allowed: readonly string[], field: string): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length) fail(`${field}.${unknown[0]} is not allowed`);
}
function validateHandoff(value: SignalsInputHandoff, slug: string): SignalsInputHandoff {
  if (!value || typeof value !== "object") fail("handoff must be an object");
  exactKeys(value, ["pointer_id", "venture_id", "phase", "rules_version", "input_kind", "source_record_refs", "evidence_refs", "content_item_refs", "scope", "sample_size", "provenance", "caveats", "lineage", "content_decision", "venture_gate_ref", "qualification", "evidence_status"], "handoff");
  if (value.venture_id !== slug) fail(`handoff names venture ${JSON.stringify(value.venture_id)}, expected ${JSON.stringify(slug)}`);
  nonEmpty(value.pointer_id, "pointer_id"); nonEmpty(value.rules_version, "rules_version");
  nonEmpty(value.input_kind, "input_kind"); nonEmpty(value.scope, "scope"); nonEmpty(value.provenance, "provenance");
  if (!Number.isInteger(value.phase) || value.phase < 1 || value.phase > 4) fail("phase must be an integer from 1 through 4");
  if (!Number.isInteger(value.sample_size) || value.sample_size < 1) fail("sample_size must be a positive integer");
  refs(value.source_record_refs, "source_record_refs"); refs(value.evidence_refs, "evidence_refs");
  if (!Array.isArray(value.content_item_refs)) fail("content_item_refs must be an array");
  refs(value.content_item_refs.length ? value.content_item_refs : ["_empty_"], "content_item_refs");
  if (!Array.isArray(value.caveats) || value.caveats.some((v) => typeof v !== "string")) fail("caveats must be an array of strings");
  if (value.qualification !== "qualified") fail("qualification must be qualified");
  if (value.evidence_status !== "measured") fail("evidence_status must be measured");
  if (!value.content_decision || typeof value.content_decision !== "object") fail("Content approval must be an explicit Muxin approval");
  exactKeys(value.content_decision, ["status", "decided_by", "decision_ref"], "content_decision");
  if (value.content_decision.status !== "approved" || value.content_decision.decided_by !== "muxin") fail("Content approval must be an explicit Muxin approval");
  nonEmpty(value.content_decision.decision_ref, "content_decision.decision_ref");
  nonEmpty(value.venture_gate_ref, "venture_gate_ref");
  for (const key of ["source_id", "variant_id", "experiment_id"] as const) nonEmpty(value.lineage?.[key], `lineage.${key}`);
  return value;
}
function validateDecision(value: SignalsInputDecision): void {
  if (!value || value.decided_by !== "muxin") fail("decided_by must be muxin; Venture acceptance cannot be inferred");
  if (!["accept", "reject", "request-more-evidence"].includes(value.outcome)) fail("outcome is invalid");
  nonEmpty(value.decision_ref, "decision_ref"); nonEmpty(value.reason, "reason");
}
function fingerprint(handoff: SignalsInputHandoff, decision: SignalsInputDecision): string {
  return createHash("sha256").update(JSON.stringify({ handoff, decision })).digest("hex");
}

/** Venture-owned acceptance. It never unlocks a phase, clears a checkpoint, or publishes. */
function acceptSignalsInputUnlocked(slug: string, rawHandoff: SignalsInputHandoff, decision: SignalsInputDecision, at: string): SignalsInputAcceptance {
  const rules = loadRules();
  requireRulesVersionMatch(slug, rules);
  const handoff = validateHandoff(rawHandoff, slug);
  validateDecision(decision);
  if (handoff.rules_version !== rules.rules_version) fail(`rules_version ${handoff.rules_version} does not match current Venture rules ${rules.rules_version}`);
  const id = `${slug}/signals-input/${handoff.pointer_id}`;
  const digest = fingerprint(handoff, decision);
  const existing = readCanonEvents(slug).find((event) => event.id === id);
  if (existing) {
    if (existing.fields.fingerprint !== digest) fail("existing Signals input identity has drifted; refusing overwrite");
    const existingArtifact = decision.outcome === "accept" ? readArtifact(slug, `signals-input-${handoff.pointer_id}`) : undefined;
    if (decision.outcome === "accept" && !existingArtifact) fail("accepted Signals input decision exists but its artifact is missing");
    return { alreadyRecorded: true, artifact: existingArtifact ?? null, factRef: id };
  }
  const state = computeState(slug);
  if (handoff.phase !== state.current_phase) fail(`phase ${handoff.phase} is not the current Venture phase ${state.current_phase}`);
  let artifact: VentureArtifact | null = null;
  if (decision.outcome === "accept") {
    const existingArtifact = readArtifact(slug, `signals-input-${handoff.pointer_id}`);
    if (existingArtifact) {
      if (existingArtifact.fields?.acceptance_fingerprint !== digest) fail("existing Signals input artifact has drifted; refusing overwrite");
      artifact = existingArtifact;
    } else artifact = createArtifact(slug, rules, {
      artifact_id: `signals-input-${handoff.pointer_id}`,
      phase: handoff.phase,
      artifact_kind: "signals-input",
      title: "Accepted Signals input",
      fields: {
        pointer_id: handoff.pointer_id, input_kind: handoff.input_kind, source_record_refs: [...handoff.source_record_refs],
        evidence_refs: [...handoff.evidence_refs], content_item_refs: [...handoff.content_item_refs], scope: handoff.scope,
        sample_size: handoff.sample_size, provenance: handoff.provenance, caveats: [...handoff.caveats],
        lineage: { ...handoff.lineage }, content_decision_ref: handoff.content_decision.decision_ref,
        venture_gate_ref: handoff.venture_gate_ref, qualification: handoff.qualification, evidence_status: handoff.evidence_status,
        acceptance_fingerprint: digest,
        venture_decision: { outcome: decision.outcome, decision_ref: decision.decision_ref, reason: decision.reason },
      },
      venture_id: slug, venture_phase: handoff.phase, message_id: `signals-input-${handoff.pointer_id}`, at,
    });
  }
  const reasonHash = createHash("sha256").update(decision.reason).digest("hex");
  appendCanonEvent(slug, "signals-input-decision", id, { outcome: decision.outcome, decided_by: "muxin", decision_ref: decision.decision_ref, reason_hash: reasonHash, fingerprint: digest }, at);
  return { alreadyRecorded: false, artifact, factRef: id };
}

/** Serialize the artifact + canon transition across processes so identical concurrent accepts collapse to one write. */
export function acceptSignalsInput(slug: string, rawHandoff: SignalsInputHandoff, decision: SignalsInputDecision, at: string): SignalsInputAcceptance {
  return withFileLock(join(ventureDir(slug), ".signals-input.lock"), () => acceptSignalsInputUnlocked(slug, rawHandoff, decision, at));
}
