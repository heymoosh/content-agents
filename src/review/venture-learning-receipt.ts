import type { ClaimCeiling, EvidenceTier } from "./signals-venture-handoff-store.js";
import type { VentureLearningReceipt } from "./venture-learning-evaluator.js";
import type { ResponseRecord } from "../venture/responses.js";

/** Small structural view keeps this adapter read-only and prevents body_path/body access. */
export interface SignalsInputArtifactLike {
  artifact_id: string; artifact_kind: string; phase: number; venture_id: string; venture_phase: number;
  editorial_status: string; fields: Record<string, unknown> | null;
}

export interface ResearchObservationLike {
  observation_id: string;
  source: string;
  source_platform: string;
  surface: string | null;
  content_item_id: string | null;
  observed_at: string;
  redacted_text: string | null;
  behavioral_action: string | null;
  metric_name: string | null;
  metric_value: number | null;
  previous_value: number | null;
  delta: number | null;
  window_start: string | null;
  window_end: string | null;
  collected_at: string | null;
}

const TIERS = new Set<EvidenceTier>(["engagement", "qualitative", "survey", "directional", "controlled", "funnel", "business"]);
const CEILINGS = new Set<ClaimCeiling>(["attention", "resonance", "stated-need", "directional-comparison", "bounded-comparison", "behavioral-intent", "observed-demand"]);
const CEILING_RANK: Record<ClaimCeiling, number> = { attention: 1, resonance: 2, "stated-need": 3, "directional-comparison": 4, "bounded-comparison": 5, "behavioral-intent": 6, "observed-demand": 7 };
const TIER_MAX: Record<EvidenceTier, ClaimCeiling> = { engagement: "attention", qualitative: "resonance", survey: "stated-need", directional: "directional-comparison", controlled: "bounded-comparison", funnel: "behavioral-intent", business: "observed-demand" };
function fail(message: string): never { throw new Error(`venture-learning-receipt: ${message}`); }
function nonEmpty(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) fail(`${field} is absent`);
  return value.trim();
}
function refs(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((v) => typeof v !== "string" || !v.trim())) fail(`${field} is absent or invalid`);
  if (new Set(value).size !== value.length) fail(`${field} contains duplicate refs`);
  return value.map((v) => String(v).trim());
}

export function receiptFromAcceptedSignalsInput(artifact: SignalsInputArtifactLike, expectedFingerprint?: string): VentureLearningReceipt {
  if (!artifact || artifact.artifact_kind !== "signals-input") fail("artifact kind is not Signals input");
  if (!Number.isInteger(artifact.phase) || artifact.phase < 1 || artifact.phase !== artifact.venture_phase) fail("artifact phase metadata drifted");
  const fields = artifact.fields;
  if (!fields || typeof fields !== "object") fail("accepted Signals input fields are absent");
  const tier = fields.evidence_tier as EvidenceTier;
  const ceiling = fields.claim_ceiling as ClaimCeiling;
  if (!TIERS.has(tier)) fail("evidence_tier is absent or invalid");
  if (!CEILINGS.has(ceiling)) fail("claim_ceiling is absent or invalid");
  if (CEILING_RANK[ceiling] > CEILING_RANK[TIER_MAX[tier]]) fail("claim_ceiling exceeds evidence_tier");
  const decision = fields.venture_decision;
  if (!decision || typeof decision !== "object" || (decision as Record<string, unknown>).outcome !== "accept") fail("Signals input was not accepted by Venture");
  const fingerprint = nonEmpty(fields.acceptance_fingerprint, "acceptance_fingerprint");
  if (expectedFingerprint !== undefined && fingerprint !== expectedFingerprint) fail("acceptance_fingerprint does not match the canon decision");
  const sourceRefs = refs(fields.source_record_refs, "source_record_refs");
  const evidenceRefs = refs(fields.evidence_refs, "evidence_refs");
  const scope = nonEmpty(fields.scope, "scope");
  const sampleSize = fields.sample_size;
  if (!Number.isInteger(sampleSize) || (sampleSize as number) < 1) fail("sample_size is absent or invalid");
  const byArm = fields.sample_size_by_arm as { treatment?: unknown; control?: unknown } | undefined;
  const sample = byArm && Number.isInteger(byArm.treatment) && Number.isInteger(byArm.control)
    ? { treatment: byArm.treatment as number, control: byArm.control as number }
    : { treatment: sampleSize as number, control: 0 };
  if (!Array.isArray(fields.caveats) || fields.caveats.some((v) => typeof v !== "string" || !v.trim())) fail("caveats are absent or invalid");
  const factual = typeof fields.factual_summary === "string" && fields.factual_summary.trim()
    ? fields.factual_summary.trim()
    : `Accepted Signals input (${artifact.artifact_id})`;
  return { id: artifact.artifact_id, venture: nonEmpty(artifact.venture_id, "venture_id"), phase: artifact.phase, evidenceTier: tier, claimCeiling: ceiling,
    factualSummary: factual, evidenceRefs, sourceRefs, scope, sample, caveats: (fields.caveats as string[]).map((v) => v.trim()) };
}

/** Convert one active account-level research row into a redacted, claim-bounded receipt. */
export function receiptFromResearchObservation(venture: string, phase: number, row: ResearchObservationLike): VentureLearningReceipt {
  const id = nonEmpty(row.observation_id, "observation_id");
  const source = nonEmpty(row.source, "source");
  const platform = nonEmpty(row.source_platform, "source_platform");
  if (!Number.isInteger(phase) || phase < 1) fail("research observation phase is invalid");
  if (source === "metric" || source === "subscriber_movement") {
    const metric = nonEmpty(row.metric_name, "metric_name");
    if (typeof row.metric_value !== "number" || !Number.isFinite(row.metric_value)) fail("metric_value is absent or invalid");
    const window = [row.window_start, row.window_end].filter(Boolean).join(" to ") || row.collected_at || row.observed_at;
    const comparison = typeof row.delta === "number" ? `; change ${row.delta}` : "";
    return {
      id: `research:${id}`, venture: nonEmpty(venture, "venture"), phase,
      evidenceTier: "engagement", claimCeiling: "attention",
      factualSummary: `${platform} ${metric}: ${row.metric_value}${comparison}`,
      evidenceRefs: [`research-observation:${id}`],
      sourceRefs: [row.content_item_id ? `content:${row.content_item_id}` : `platform:${platform}`],
      scope: `one measured ${metric} observation over ${window}`,
      sample: { treatment: 1, control: 0 },
      caveats: ["Engagement supports attention only. It does not establish resonance, intent, or demand."],
    };
  }
  if (!["comment", "reply", "dm", "email", "follow_up_question"].includes(source)) fail(`research source ${source} is not a supported learning source`);
  const redacted = nonEmpty(row.redacted_text, "redacted_text");
  const action = row.behavioral_action?.trim() ? `; recorded action: ${row.behavioral_action.trim()}` : "";
  return {
    id: `research:${id}`, venture: nonEmpty(venture, "venture"), phase,
    evidenceTier: "qualitative", claimCeiling: "resonance",
    factualSummary: `${redacted}${action}`,
    evidenceRefs: [`research-observation:${id}`],
    sourceRefs: [row.content_item_id ? `content:${row.content_item_id}` : `platform:${platform}`],
    scope: `one redacted ${source} observation on ${platform}${row.surface ? ` (${row.surface})` : ""}`,
    sample: { treatment: 1, control: 0 },
    caveats: ["One qualitative observation can show resonance, not prevalence, intent, or demand."],
  };
}

export function receiptFromResponse(venture: string, phase: number, response: ResponseRecord): VentureLearningReceipt {
  if (!response || !nonEmpty(venture, "venture") || !Number.isInteger(phase) || phase < 1) fail("response context is invalid");
  const redacted = nonEmpty(response.redacted_quote, "redacted_quote");
  const stuck = nonEmpty(response.stuck_point, "stuck_point");
  const desired = response.desired_outcome == null ? "" : nonEmpty(response.desired_outcome, "desired_outcome");
  const survey = response.source === "survey";
  const evidenceTier: EvidenceTier = survey ? "survey" : "qualitative";
  const claimCeiling: ClaimCeiling = survey ? "stated-need" : "resonance";
  const details = [redacted, stuck, desired].filter(Boolean).join("; ");
  const audienceCaveat = response.target_audience_eligible && response.included_in_gate
    ? []
    : ["This response is outside the current eligible audience or excluded from the response gate; treat it as context, not target-market evidence."];
  return { id: `response:${nonEmpty(response.response_id, "response_id")}`, venture: venture.trim(), phase, evidenceTier, claimCeiling,
    factualSummary: details, evidenceRefs: [`response:${response.response_id}`], sourceRefs: [`response-source:${response.source}`],
    scope: response.target_audience_eligible && response.included_in_gate ? "one eligible Venture response" : "one contextual Venture response",
    sample: { treatment: 1, control: 0 },
    caveats: ["One stated response is not observed demand.", ...audienceCaveat], };
}
