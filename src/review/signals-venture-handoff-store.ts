import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { dataPath } from "../runtime/data-root.js";
import { withFileLock } from "../runtime/file-lock.js";

export const SIGNALS_VENTURE_HANDOFF_PATH = dataPath("review", "signals-venture-handoffs.jsonl");
export type SignalsVentureDecision = "adopt" | "decline" | "request-more-evidence";
export type SignalsVentureStatus = "pending" | "adopted" | "declined" | "more-evidence";
export type EvidenceTier = "engagement" | "qualitative" | "survey" | "directional" | "controlled" | "funnel" | "business";
export type ClaimCeiling = "attention" | "resonance" | "stated-need" | "directional-comparison" | "bounded-comparison" | "behavioral-intent" | "observed-demand";

const CEILING_RANK: Record<ClaimCeiling, number> = {
  attention: 1, resonance: 2, "stated-need": 3, "directional-comparison": 4,
  "bounded-comparison": 5, "behavioral-intent": 6, "observed-demand": 7,
};
const TIER_MAX_CEILING: Record<EvidenceTier, ClaimCeiling> = {
  engagement: "attention", qualitative: "resonance", survey: "stated-need",
  directional: "directional-comparison", controlled: "bounded-comparison",
  funnel: "behavioral-intent", business: "observed-demand",
};

export interface SignalsVentureProposalInput {
  id: string; ventureSlug: string; sourceId: string; variantId: string; experimentId: string;
  title: string; factualSummary: string; proposedInput: string; rationale: string;
  confidence: "low" | "medium" | "high"; evidenceRefs: string[];
  phase: number; inputKind: EvidenceTier; contentItemRefs: string[]; scope: string;
  sampleSize: { treatment: number; control: number }; provenance: { planDigest: string; interpretationId: string };
  caveats: string[]; qualification: "qualified"; evidenceStatus: "measured";
  evidenceTier?: EvidenceTier; claimCeiling?: ClaimCeiling;
}
export interface SignalsVentureProposal extends SignalsVentureProposalInput {
  digest: string; status: SignalsVentureStatus; muxinRationale: string | null; decidedAt: string | null;
  /** Deliberately a display-only gate. This store never writes Venture state. */
  ventureGate: "blocked" | "ready";
}
type Event = { kind: "proposal"; at: string; proposal: SignalsVentureProposal } | { kind: "decision"; at: string; id: string; decision: SignalsVentureDecision; rationale: string };

/** Stable route-safe identity for one experiment -> named Venture/phase proposal. */
export function signalsVentureProposalId(experimentId: string, ventureSlug: string, phase: number): string {
  const identity = JSON.stringify({ experimentId, ventureSlug, phase });
  return `venture-input-${createHash("sha256").update(identity).digest("hex").slice(0, 24)}`;
}

function validate(input: SignalsVentureProposalInput): SignalsVentureProposalInput {
  for (const key of ["id", "ventureSlug", "title", "factualSummary", "proposedInput", "rationale"] as const)
    if (!input[key]?.trim()) throw new Error(`${key} is required`);
  if (!["low", "medium", "high"].includes(input.confidence)) throw new Error("confidence is invalid");
  if (!Array.isArray(input.evidenceRefs) || !input.evidenceRefs.length || input.evidenceRefs.some((v) => typeof v !== "string" || !v.trim())) throw new Error("evidenceRefs are required");
  if (!Number.isInteger(input.phase) || input.phase < 1) throw new Error("phase must be a positive integer");
  const evidenceTier = input.evidenceTier ?? input.inputKind;
  if (!(evidenceTier in TIER_MAX_CEILING)) throw new Error("evidenceTier is invalid");
  const claimCeiling = input.claimCeiling ?? TIER_MAX_CEILING[evidenceTier as EvidenceTier];
  if (!(claimCeiling in CEILING_RANK)) throw new Error("claimCeiling is invalid");
  if (CEILING_RANK[claimCeiling as ClaimCeiling] > CEILING_RANK[TIER_MAX_CEILING[evidenceTier as EvidenceTier]]) throw new Error(`claimCeiling ${claimCeiling} exceeds evidenceTier ${evidenceTier}`);
  if ((evidenceTier === "directional" || evidenceTier === "controlled") && (!input.experimentId?.trim() || !input.sourceId?.trim() || !input.variantId?.trim())) throw new Error(`${evidenceTier} evidence requires experiment/content/treatment lineage`);
  if (evidenceTier === "controlled" && (!input.sampleSize || !Number.isInteger(input.sampleSize.treatment) || !Number.isInteger(input.sampleSize.control) || input.sampleSize.treatment < 1 || input.sampleSize.control < 1)) throw new Error("controlled evidence requires both measured arms");
  if (!Array.isArray(input.contentItemRefs)) throw new Error("contentItemRefs must be an array");
  if ((evidenceTier === "directional" || evidenceTier === "controlled") && input.contentItemRefs.length === 0) throw new Error("contentItemRefs are required for experiment evidence");
  if (!input.scope?.trim()) throw new Error("scope is required");
  if ((evidenceTier === "directional" || evidenceTier === "controlled") && (!input.provenance?.planDigest?.trim() || !input.provenance.interpretationId?.trim())) throw new Error("provenance is required for experiment evidence");
  if (input.qualification !== "qualified" || input.evidenceStatus !== "measured") throw new Error("proposal must be qualified measured evidence");
  if (!Array.isArray(input.caveats)) throw new Error("caveats must be an array");
  return {
    id: input.id, ventureSlug: input.ventureSlug, sourceId: input.sourceId, variantId: input.variantId,
    experimentId: input.experimentId, title: input.title, factualSummary: input.factualSummary,
    proposedInput: input.proposedInput, rationale: input.rationale, confidence: input.confidence,
    evidenceRefs: [...new Set(input.evidenceRefs)].sort(), phase: input.phase, inputKind: input.inputKind,
    contentItemRefs: [...input.contentItemRefs], scope: input.scope,
    sampleSize: { treatment: input.sampleSize?.treatment ?? 0, control: input.sampleSize?.control ?? 0 },
    provenance: { planDigest: input.provenance?.planDigest ?? "", interpretationId: input.provenance?.interpretationId ?? "" },
    caveats: [...input.caveats], qualification: input.qualification, evidenceStatus: input.evidenceStatus,
    evidenceTier, claimCeiling,
  };
}
function digest(input: SignalsVentureProposalInput): string { return createHash("sha256").update(JSON.stringify(validate(input))).digest("hex"); }
function readEvents(path: string): Event[] { if (!existsSync(path)) return []; return readFileSync(path, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line) as Event); }
function fold(path: string): Map<string, SignalsVentureProposal> {
  const out = new Map<string, SignalsVentureProposal>();
  for (const e of readEvents(path)) {
    if (e.kind === "proposal") {
      const clean = validate(e.proposal);
      const expectedDigest = digest(clean);
      if (e.proposal.digest !== expectedDigest) throw new Error(`invalid Signals Venture proposal digest ${e.proposal.id}`);
      const prior = out.get(clean.id);
      if (prior && prior.digest !== expectedDigest) throw new Error(`conflicting Signals Venture proposal ${clean.id}`);
      // Proposal events contain immutable input only. Never trust their projected decision fields:
      // adopted/declined state exists solely when a later append-only decision event derives it.
      if (!prior) out.set(clean.id, {
        ...clean,
        digest: expectedDigest,
        status: "pending",
        muxinRationale: null,
        decidedAt: null,
        ventureGate: "blocked",
        evidenceRefs: [...clean.evidenceRefs],
      });
    }
    else { const p = out.get(e.id); if (!p) throw new Error(`decision precedes proposal ${e.id}`); if (p.status !== "pending") throw new Error(`proposal ${e.id} was already decided`); p.status = e.decision === "adopt" ? "adopted" : e.decision === "decline" ? "declined" : "more-evidence"; p.muxinRationale = e.rationale; p.decidedAt = e.at; p.ventureGate = "blocked"; }
  }
  return out;
}
function append(path: string, event: Event): void { mkdirSync(dirname(path), { recursive: true }); appendFileSync(path, JSON.stringify(event) + "\n", { encoding: "utf8", mode: 0o600 }); }

export function recordSignalsVentureProposal(input: SignalsVentureProposalInput, path = SIGNALS_VENTURE_HANDOFF_PATH): SignalsVentureProposal {
  return withFileLock(`${path}.lock`, () => { const clean = validate(input), d = digest(clean), prior = fold(path).get(clean.id); if (prior) { if (prior.digest !== d) throw new Error(`conflicting or drifted proposal ${clean.id}`); return prior; } const proposal: SignalsVentureProposal = { ...clean, digest: d, status: "pending", muxinRationale: null, decidedAt: null, ventureGate: "blocked" }; append(path, { kind: "proposal", at: new Date().toISOString(), proposal }); return proposal; });
}
export function recordSignalsVentureDecision(id: string, decision: SignalsVentureDecision, rationale: string, path = SIGNALS_VENTURE_HANDOFF_PATH): SignalsVentureProposal {
  if (!rationale.trim()) throw new Error("decision rationale is required");
  if (!["adopt", "decline", "request-more-evidence"].includes(decision)) throw new Error("invalid Signals Venture decision");
  return withFileLock(`${path}.lock`, () => { const p = fold(path).get(id); if (!p) throw new Error(`unknown Signals Venture proposal ${id}`); if (p.status !== "pending") throw new Error(`proposal ${id} was already decided`); append(path, { kind: "decision", id, decision, rationale: rationale.trim(), at: new Date().toISOString() }); return fold(path).get(id)!; });
}
export function readSignalsVentureProposals(path = SIGNALS_VENTURE_HANDOFF_PATH): SignalsVentureProposal[] { return withFileLock(`${path}.lock`, () => [...fold(path).values()].sort((a, b) => a.id.localeCompare(b.id)).map((p) => ({ ...p, evidenceRefs: [...p.evidenceRefs] }))); }
