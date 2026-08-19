import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { artifactsPath, ventureDir } from "./paths.js";
import { artifactKindRule, type ArtifactKind, type VentureRules } from "./rules.js";

export type EditorialStatus = "draft" | "approved" | "discarded";
export type DeliveryStatus =
  | "not_applicable"
  | "awaiting_approval"
  | "ready"
  | "handed_off"
  | "live_confirmed"
  | "failed"
  | "cancelled";

export interface ClaimRef {
  claim: string;
  ref: string; // "intake:q11" or "confirmed_known:<id>"
}

export interface Evidence {
  type: "url" | "agent" | "attestation";
  value: string;
  provider?: string;
  confirmed_by?: "muxin" | "agent";
  confirmed_at?: string;
}

export interface Failure {
  provider: string;
  message: string;
  retryable: boolean;
  at: string;
}

export interface VentureArtifact {
  artifact_id: string;
  phase: number;
  artifact_kind: ArtifactKind;
  title: string;
  body_path: string | null;
  checkpoint_id: string | null;
  // Non-null only for structured artifact kinds (phase_1_research_plan): per-field-editable data
  // (confirmed_knowns[], open_unknowns[], probes[], reviewed_by_muxin, plan_version, ...). null
  // for the two post kinds, which use title/body_path/claim_refs instead.
  fields: Record<string, unknown> | null;

  delivery_mode: "manual" | "app" | "none";
  publishable: boolean;
  editorial_status: EditorialStatus;
  delivery_status: DeliveryStatus;
  evidence: Evidence | null;
  failure: Failure | null;

  // §1B lineage fields
  origin_type: "venture";
  venture_id: string;
  venture_phase: number;
  message_id: string;
  cta_id: string | null;
  rules_version: string;

  // Phase 1 specific
  probe_id: string | null;
  unknown_id: string | null;
  claim_refs: ClaimRef[];

  created_at: string;
  updated_at: string;
}

// §2.2's valid (editorial, delivery) combinations. Anything not listed here is rejected.
const VALID_COMBINATIONS = new Set<string>([
  "draft:not_applicable",
  "draft:awaiting_approval",
  "approved:ready",
  "approved:handed_off",
  "approved:live_confirmed",
  "approved:failed",
  "approved:not_applicable",
  "discarded:cancelled",
  "discarded:not_applicable",
  "discarded:live_confirmed", // retract path: discard after it already shipped keeps the record
]);

export function isValidCombination(editorial: EditorialStatus, delivery: DeliveryStatus): boolean {
  return VALID_COMBINATIONS.has(`${editorial}:${delivery}`);
}

function readLines(slug: string): VentureArtifact[] {
  const path = artifactsPath(slug);
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as VentureArtifact);
}

// artifacts.jsonl is append-only: each write is a full snapshot line for that artifact_id.
// Reading folds to the latest line per id (last write wins), the same event-sourced spirit as
// canon.md and decisions.jsonl -- never an in-place rewrite of an existing line.
export function readArtifacts(slug: string): VentureArtifact[] {
  const lines = readLines(slug);
  const latest = new Map<string, VentureArtifact>();
  for (const a of lines) latest.set(a.artifact_id, a);
  return [...latest.values()];
}

export function readArtifact(slug: string, artifactId: string): VentureArtifact | undefined {
  return readArtifacts(slug).find((a) => a.artifact_id === artifactId);
}

function appendLine(slug: string, artifact: VentureArtifact): void {
  mkdirSync(ventureDir(slug), { recursive: true });
  appendFileSync(artifactsPath(slug), JSON.stringify(artifact) + "\n");
}

export interface CreateArtifactInput {
  artifact_id: string;
  phase: number;
  artifact_kind: ArtifactKind;
  title: string;
  body_path?: string | null;
  checkpoint_id?: string | null;
  fields?: Record<string, unknown> | null;
  venture_id: string;
  venture_phase: number;
  message_id: string;
  cta_id?: string | null;
  probe_id?: string | null;
  unknown_id?: string | null;
  claim_refs?: ClaimRef[];
  at: string;
}

// Stamps delivery_mode/publishable from rules.ts's kind table AT CREATE TIME and writes them
// onto the line -- the delivery path later reads the stored field, never re-derives it from
// artifact_kind. This is what keeps `publishable` explicit-not-inferred all the way through.
export function createArtifact(
  slug: string,
  rules: VentureRules,
  input: CreateArtifactInput
): VentureArtifact {
  const kindRule = artifactKindRule(rules, input.artifact_kind);
  const artifact: VentureArtifact = {
    artifact_id: input.artifact_id,
    phase: input.phase,
    artifact_kind: input.artifact_kind,
    title: input.title,
    body_path: input.body_path ?? null,
    checkpoint_id: input.checkpoint_id ?? null,
    fields: input.fields ?? null,
    delivery_mode: kindRule.delivery_mode,
    publishable: kindRule.publishable,
    editorial_status: "draft",
    delivery_status: kindRule.delivery_mode === "none" ? "not_applicable" : "awaiting_approval",
    evidence: null,
    failure: null,
    origin_type: "venture",
    venture_id: input.venture_id,
    venture_phase: input.venture_phase,
    message_id: input.message_id,
    cta_id: input.cta_id ?? null,
    rules_version: rules.rules_version,
    probe_id: input.probe_id ?? null,
    unknown_id: input.unknown_id ?? null,
    claim_refs: input.claim_refs ?? [],
    created_at: input.at,
    updated_at: input.at,
  };
  appendLine(slug, artifact);
  return artifact;
}

export class InvalidTransitionError extends Error {
  constructor(from: VentureArtifact, editorial: EditorialStatus, delivery: DeliveryStatus) {
    super(
      `invalid venture artifact transition for ${from.artifact_id}: ` +
        `${from.editorial_status}:${from.delivery_status} -> ${editorial}:${delivery}`
    );
    this.name = "InvalidTransitionError";
  }
}

export interface TransitionPatch {
  editorial_status?: EditorialStatus;
  delivery_status?: DeliveryStatus;
  evidence?: Evidence | null;
  failure?: Failure | null;
}

export function transitionArtifact(
  slug: string,
  artifactId: string,
  patch: TransitionPatch,
  at: string
): VentureArtifact {
  const current = readArtifact(slug, artifactId);
  if (!current) throw new Error(`no such artifact: ${artifactId}`);
  const next: VentureArtifact = {
    ...current,
    ...patch,
    updated_at: at,
  };
  if (!isValidCombination(next.editorial_status, next.delivery_status)) {
    throw new InvalidTransitionError(current, next.editorial_status, next.delivery_status);
  }
  appendLine(slug, next);
  return next;
}

// Patches keys inside a structured artifact's `fields` bag (e.g. reviewed_by_muxin,
// confirmed_by_muxin on a confirmed_knowns entry). Separate from transitionArtifact -- fields
// edits aren't part of the editorial/delivery state machine and need no combination check.
export function updateArtifactFields(
  slug: string,
  artifactId: string,
  patch: Record<string, unknown>,
  at: string
): VentureArtifact {
  const current = readArtifact(slug, artifactId);
  if (!current) throw new Error(`no such artifact: ${artifactId}`);
  const next: VentureArtifact = {
    ...current,
    fields: { ...(current.fields ?? {}), ...patch },
    updated_at: at,
  };
  appendLine(slug, next);
  return next;
}

// The publish gate. `manual`-kind artifacts (substack-post) are never `publishable: true` by
// design -- publishable means "the app can deliver this itself", which is exactly what a manual
// hand-off isn't. So the gate branches on delivery_mode:
//   app    -> ALL of publishable, approved, ready (each alone is insufficient)
//   manual -> approved AND ready (publishable is correctly always false here)
//   none   -> never deliverable
export function readyForDelivery(a: VentureArtifact): boolean {
  if (a.editorial_status !== "approved" || a.delivery_status !== "ready") return false;
  if (a.delivery_mode === "app") return a.publishable === true;
  if (a.delivery_mode === "manual") return true;
  return false;
}
