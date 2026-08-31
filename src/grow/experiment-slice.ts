import { createHash } from "node:crypto";
import { buildGrowCapacityManifest, type GrowCapacityManifest } from "./capacity.js";
import { buildGrowDeliveryRecord, type GrowDeliveryRecord } from "./delivery-record.js";
import { buildExperimentRecord, type ExperimentRecord } from "./experiment-record.js";
import { buildGrowReviewBundle, type GrowReviewBundle } from "./review-bundle.js";

export const GROW_EXPERIMENT_PROPOSAL_VERSION = "grow-experiment-proposal-v1" as const;
export const GROW_EXPERIMENT_SLICE_VERSION = "grow-experiment-slice-v1" as const;

export type GrowExperimentSourceKind = "raw-thought" | "long-form" | "substack-note";
export type GrowExperimentEvidenceStatus = "supported" | "hypothesis";
export type GrowExperimentOutcomeFamily = "attention" | "conversation" | "audience" | "business";
export type GrowExperimentVariantDecisionStatus = "approved" | "edited" | "rejected" | "needs-another-pass";
export type ExperimentDirection = "increase" | "decrease" | "maintain";
export type ExperimentConfidence = "low" | "medium" | "high";

export interface SignalsExperimentRecommendationInput {
  version: "signals-experiment-recommendation-v1";
  id: string;
  owner: "signals";
  createdAt: string;
  evidenceRefs: readonly string[];
  observation: string;
  interpretation: string;
  hypothesis: string;
  expectedOutcome: {
    variantId: string;
    comparisonRef: string;
    family: GrowExperimentOutcomeFamily;
    metric: string;
    direction: ExperimentDirection;
  };
  whyThisInput: string;
  controlledVariable: string;
  constants: readonly string[];
  primaryMetric: { family: GrowExperimentOutcomeFamily; metric: string };
  guardrails: readonly { family: GrowExperimentOutcomeFamily; metric: string; rule: string }[];
  minimumSample: number;
  minimumDays: number;
  decisionRule: { keep: string; revise: string; reject: string };
  confidence: ExperimentConfidence;
  caveats: readonly string[];
  capacityRationale: string;
  provenance: {
    mechanism: "signals-science-agent-v1";
    engine: "claude" | "grok" | "codex";
    evidenceDigest: string;
    promptDigest: string;
    responseDigest: string;
  };
}

export interface ExperimentGenerationEvidenceInput {
  pipeline: "content-studio-configured-v1";
  editor: {
    version: "cold-feed-v1";
    status: "passed";
    recommendation: string;
    inputBodyDigest: string;
    outputBodyDigest: string;
  };
}

export interface GrowExperimentProposalInput {
  id: string;
  createdAt: string;
  source: {
    id: string;
    kind: GrowExperimentSourceKind;
    body: string;
    originRef: string;
    canonicalUrl?: string | null;
  };
  recommendation: SignalsExperimentRecommendationInput;
  selectedPlatforms: readonly string[];
  cut: {
    id: string;
    body: string;
    sourceRefs: readonly string[];
    rationale: string;
    decision: {
      status: "approved";
      decidedBy: "muxin";
      decidedAt: string;
    };
  };
  variants: readonly {
    id: string;
    platform: string;
    medium: string;
    format: string;
    body: string;
    sourceRefs: readonly string[];
    treatment: {
      ref: string;
      rationale: string;
      evidenceStatus: GrowExperimentEvidenceStatus;
      evidenceRefs: readonly string[];
    };
    experimentVariables: Readonly<Record<string, string>>;
    voiceCheck: "passed";
    originalityCheck: "passed";
    generation: ExperimentGenerationEvidenceInput;
  }[];
  capacity: {
    day: string;
    review: readonly { platform: string; available: number }[];
    slots: readonly { platform: string; available: number; capacity?: number; scheduledCount?: number }[];
  };
  experiment: {
    id: string;
    question: string;
    outcomeFamilies: readonly GrowExperimentOutcomeFamily[];
    minimumSample: number;
    topic: string;
    audience: string;
  };
}

export interface GrowExperimentVariant {
  id: string;
  platform: string;
  medium: string;
  format: string;
  body: string;
  sourceRefs: string[];
  treatment: {
    ref: string;
    rationale: string;
    evidenceStatus: GrowExperimentEvidenceStatus;
    evidenceRefs: string[];
  };
  experimentVariables: Record<string, string>;
  voiceCheck: "passed";
  originalityCheck: "passed";
  generation: ExperimentGenerationEvidenceInput;
  lineage: {
    sourceId: string;
    cutId: string;
    experimentId: string;
  };
}

export interface GrowExperimentProposal {
  kind: "grow_experiment_proposal";
  version: typeof GROW_EXPERIMENT_PROPOSAL_VERSION;
  digest: string;
  id: string;
  createdAt: string;
  source: { id: string; kind: GrowExperimentSourceKind; body: string; originRef: string; canonicalUrl: string | null };
  recommendation: SignalsExperimentRecommendationInput;
  selectedPlatforms: string[];
  cut: GrowExperimentProposalInput["cut"] & { sourceRefs: string[] };
  variants: GrowExperimentVariant[];
  capacity: { day: string; review: { platform: string; available: number }[]; slots: { platform: string; available: number; capacity?: number; scheduledCount?: number }[] };
  capacityManifest: GrowCapacityManifest;
  experiment: GrowExperimentProposalInput["experiment"];
  experimentRecord: ExperimentRecord;
  reviewBundles: GrowReviewBundle[];
  review: { required: true; owner: "muxin"; status: "pending"; decisionOptions: GrowExperimentVariantDecisionStatus[] };
  winner: null;
  autoApproval: false;
  autoScheduling: false;
  autoPublishing: false;
}

export interface GrowExperimentDecisionInput {
  proposalDigest: string;
  decidedBy: string;
  decidedAt: string;
  decisions: readonly {
    variantId: string;
    status: GrowExperimentVariantDecisionStatus;
    note: string | null;
    editedBody?: string | null;
  }[];
}

export interface GrowExperimentSlice {
  kind: "grow_experiment_slice";
  version: typeof GROW_EXPERIMENT_SLICE_VERSION;
  proposalDigest: string;
  id: string;
  source: GrowExperimentProposal["source"];
  cut: GrowExperimentProposal["cut"];
  variants: GrowExperimentVariant[];
  review: {
    required: true;
    owner: "muxin";
    status: "decided";
    decidedAt: string;
    decisions: Array<{ variantId: string; status: GrowExperimentVariantDecisionStatus; note: string | null; editedBody: string | null }>;
  };
  capacityManifest: GrowCapacityManifest;
  reviewBundles: GrowReviewBundle[];
  deliveryRecords: GrowDeliveryRecord[];
  approvedRecords: Array<{
    variantId: string;
    platform: string;
    medium: string;
    format: string;
    body: string;
    sourceRefs: string[];
    treatmentRef: string;
    experimentId: string;
    deliveryRecordId: string;
    deliveryReadiness: "ready";
  }>;
  experiment: GrowExperimentProposal["experiment"];
  experimentRecord: ExperimentRecord;
  winner: null;
  autoApproval: false;
  autoScheduling: false;
  autoPublishing: false;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function experimentBodyDigest(body: string): string {
  return `sha256:${createHash("sha256").update(body, "utf8").digest("hex")}`;
}

/** Static, dependency-free review surface for the exact digest-bound proposal. */
export function renderGrowExperimentProposalHtml(proposal: GrowExperimentProposal): string {
  const decisionSeed = JSON.stringify({
    proposalDigest: proposal.digest,
    variantIds: proposal.variants.map((variant) => variant.id),
  }).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  const cards = proposal.variants.map((variant) => `
    <article class="card" data-variant-id="${escapeHtml(variant.id)}">
      <p class="eyebrow">${escapeHtml(variant.platform)} · ${escapeHtml(variant.medium)} · ${escapeHtml(variant.format)}</p>
      <div class="copy">${escapeHtml(variant.body).replace(/\n/g, "<br>")}</div>
      <dl>
        <dt>Treatment</dt><dd>${escapeHtml(variant.treatment.ref)}</dd>
        <dt>Why</dt><dd>${escapeHtml(variant.treatment.rationale)}</dd>
        <dt>Evidence</dt><dd>${escapeHtml(variant.treatment.evidenceStatus)} · ${escapeHtml(variant.treatment.evidenceRefs.join(", "))}</dd>
        <dt>Editor</dt><dd>Cold-feed editor passed · ${escapeHtml(variant.generation.editor.recommendation)}</dd>
        <dt>Variables</dt><dd>${escapeHtml(Object.entries(variant.experimentVariables).map(([key, value]) => `${key}=${value}`).join(" · "))}</dd>
        <dt>Lineage</dt><dd>${escapeHtml(variant.sourceRefs.join(", "))}</dd>
      </dl>
      <fieldset><legend>Muxin decision</legend><label><input type="radio" name="decision-${escapeHtml(variant.id)}" value="approved"> Approve</label><label><input type="radio" name="decision-${escapeHtml(variant.id)}" value="edited"> Edit</label><label><input type="radio" name="decision-${escapeHtml(variant.id)}" value="rejected"> Reject</label><label><input type="radio" name="decision-${escapeHtml(variant.id)}" value="needs-another-pass"> Another pass</label></fieldset>
      <label class="field">Decision note (optional)<textarea data-note rows="2" placeholder="Why this decision?"></textarea></label>
      <label class="field edit-field" hidden>Edited body<textarea data-edited-body rows="8" placeholder="Paste the complete revised post. It will require a fresh validated proposal before delivery."></textarea></label>
    </article>`).join("\n");
  const slots = proposal.capacity.slots.map((slot) => `<li>${escapeHtml(slot.platform)}: ${slot.available} publishing slots available</li>`).join("");
  const review = proposal.capacity.review.map((entry) => `<li>${escapeHtml(entry.platform)}: ${entry.available} review decisions available</li>`).join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Content Studio Phase 3 Experiment review</title>
<style>:root{color-scheme:light;--ink:#1c1917;--paper:#f6f1e8;--panel:#fffdf8;--line:#d7cbb8;--accent:#26594d;--danger:#9f2f24}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 system-ui,sans-serif}main{width:min(1120px,calc(100% - 32px));margin:36px auto 72px}header,.card,.cut,.capacity,.decision-export{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:24px}h1{font:700 clamp(32px,5vw,55px)/1.05 Georgia,serif;margin:0 0 12px}.eyebrow{text-transform:uppercase;letter-spacing:.09em;font-size:12px;font-weight:800;color:var(--accent)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:18px;margin-top:20px}.copy{font-size:18px;white-space:normal;margin:20px 0}dl{display:grid;grid-template-columns:100px 1fr;gap:7px 12px;font-size:13px}dt{font-weight:800}dd{margin:0;color:#5f584f}fieldset{margin-top:20px;border:1px solid var(--line);border-radius:9px;display:flex;flex-wrap:wrap;gap:14px}.field{display:block;font-size:13px;font-weight:700;margin-top:16px}textarea{display:block;width:100%;margin-top:5px;border:1px solid var(--line);border-radius:8px;padding:10px;background:#fff;font:14px/1.45 system-ui,sans-serif;resize:vertical}section{margin-top:34px}.digest{overflow-wrap:anywhere;font:12px ui-monospace,monospace;color:#655f57}.cut,.capacity{margin-top:14px}.notice{border-left:5px solid var(--accent);padding-left:14px}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}button{border:0;border-radius:9px;padding:11px 15px;background:var(--accent);color:white;font-weight:800;cursor:pointer}button.secondary{background:#5f584f}.decision-status{min-height:1.5em;color:var(--danger);font-weight:700}pre{max-height:360px;overflow:auto;background:#211f1b;color:#f8f2e8;padding:16px;border-radius:9px;font:12px/1.5 ui-monospace,monospace;white-space:pre-wrap}</style></head>
<body><main><header><p class="eyebrow">Human Inference · Phase 3 Experiment review</p><h1>A Signals-recommended content experiment</h1><p>Signals proposes the scientific question. Experiment preserves the controls, review, delivery, and measurement gates. Nothing here is approved, scheduled, published, measured, or a winner until the corresponding human and provider evidence exists.</p><p class="digest">Proposal digest: ${escapeHtml(proposal.digest)}</p></header>
<section><h2>Why run this experiment?</h2><div class="capacity"><dl>
<dt>Observation</dt><dd>${escapeHtml(proposal.recommendation.observation)}</dd>
<dt>Interpretation</dt><dd>${escapeHtml(proposal.recommendation.interpretation)}</dd>
<dt>Hypothesis</dt><dd>${escapeHtml(proposal.recommendation.hypothesis)}</dd>
<dt>Expected</dt><dd>${escapeHtml(`${proposal.recommendation.expectedOutcome.variantId} should ${proposal.recommendation.expectedOutcome.direction} ${proposal.recommendation.expectedOutcome.metric} versus ${proposal.recommendation.expectedOutcome.comparisonRef}.`)}</dd>
<dt>Why this input</dt><dd>${escapeHtml(proposal.recommendation.whyThisInput)}</dd>
<dt>Changes</dt><dd>${escapeHtml(proposal.recommendation.controlledVariable)}</dd>
<dt>Held constant</dt><dd>${escapeHtml(proposal.recommendation.constants.join(", "))}</dd>
<dt>Primary metric</dt><dd>${escapeHtml(`${proposal.recommendation.primaryMetric.family}: ${proposal.recommendation.primaryMetric.metric}`)}</dd>
<dt>Guardrails</dt><dd>${escapeHtml(proposal.recommendation.guardrails.map((item) => `${item.family}/${item.metric}: ${item.rule}`).join(" · "))}</dd>
<dt>Evaluation</dt><dd>${escapeHtml(`${proposal.recommendation.minimumSample} comparable units and ${proposal.recommendation.minimumDays} days`)}</dd>
<dt>Keep</dt><dd>${escapeHtml(proposal.recommendation.decisionRule.keep)}</dd>
<dt>Revise</dt><dd>${escapeHtml(proposal.recommendation.decisionRule.revise)}</dd>
<dt>Reject</dt><dd>${escapeHtml(proposal.recommendation.decisionRule.reject)}</dd>
<dt>Confidence</dt><dd>${escapeHtml(proposal.recommendation.confidence)}</dd>
<dt>Caveats</dt><dd>${escapeHtml(proposal.recommendation.caveats.join(" · "))}</dd>
<dt>Capacity</dt><dd>${escapeHtml(proposal.recommendation.capacityRationale)}</dd>
<dt>Evidence</dt><dd>${escapeHtml(proposal.recommendation.evidenceRefs.join(", "))}</dd>
<dt>Science pass</dt><dd>${escapeHtml(`${proposal.recommendation.provenance.mechanism} · ${proposal.recommendation.provenance.engine} · prompt ${proposal.recommendation.provenance.promptDigest}`)}</dd>
</dl></div></section>
<section><h2>Approved message cut</h2><div class="cut"><div class="copy">${escapeHtml(proposal.cut.body)}</div><p>${escapeHtml(proposal.cut.rationale)}</p><p class="digest">${escapeHtml(proposal.cut.sourceRefs.join(", "))} · approved by Muxin at ${escapeHtml(proposal.cut.decision.decidedAt)}</p></div></section>
<section><h2>Candidate treatments</h2><p class="notice">Candidate volume is ${proposal.capacityManifest.internalCandidateVolume}. Approved publish volume is ${proposal.capacityManifest.approvedPublishVolume} until you decide each item.</p><div class="grid">${cards}</div></section>
<section><h2>Capacity and experiment</h2><div class="capacity"><p><strong>Declared capacity on ${escapeHtml(proposal.capacity.day)}:</strong></p><ul>${review}${slots}</ul><p><strong>Question:</strong> ${escapeHtml(proposal.experiment.question)}</p><p><strong>Outcome families:</strong> ${escapeHtml(proposal.experiment.outcomeFamilies.join(", "))}; minimum sample ${proposal.experiment.minimumSample}</p><p><strong>Winner:</strong> None. The experiment is proposed, not measured.</p></div></section>
<section><h2>Export your decisions</h2><div class="decision-export"><p>A decision is required for every candidate. This creates the digest-bound JSON file used by the next local command. It does not approve, schedule, publish, or send anything by itself.</p><p class="decision-status" role="status" aria-live="polite"></p><div class="actions"><button type="button" data-copy-decision>Copy decision JSON</button><button type="button" class="secondary" data-download-decision>Download decision JSON</button></div><pre data-decision-preview aria-label="Decision JSON preview">Choose one decision for every candidate.</pre></div></section>
</main><script>
const decisionSeed=${decisionSeed};
const decisionCards=Array.from(document.querySelectorAll("[data-variant-id]"));
const decisionStatus=document.querySelector(".decision-status");
const decisionPreview=document.querySelector("[data-decision-preview]");
function buildDecision(){
  const missing=[];
  const decisions=decisionCards.map(function(card){
    const variantId=card.dataset.variantId;
    const selected=card.querySelector('input[type="radio"]:checked');
    if(!selected){missing.push(variantId);return null;}
    const note=card.querySelector("[data-note]").value.trim();
    const item={variantId:variantId,status:selected.value,note:note||null};
    if(selected.value==="edited"){
      const editedBody=card.querySelector("[data-edited-body]").value;
      if(!editedBody.trim())missing.push(variantId+" (edited body)");
      item.editedBody=editedBody;
    }
    return item;
  });
  if(missing.length){throw new Error("Choose a decision for: "+missing.join(", "));}
  return {proposalDigest:decisionSeed.proposalDigest,decidedBy:"muxin",decidedAt:new Date().toISOString(),decisions:decisions};
}
function renderDecision(){
  try{const text=JSON.stringify(buildDecision(),null,2)+"\\n";decisionPreview.textContent=text;decisionStatus.textContent="";return text;}
  catch(error){decisionStatus.textContent=error.message;decisionPreview.textContent="Decision JSON is incomplete.";return null;}
}
decisionCards.forEach(function(card){
  card.addEventListener("change",function(){
    const selected=card.querySelector('input[type="radio"]:checked');
    card.querySelector(".edit-field").hidden=!selected||selected.value!=="edited";
    renderDecision();
  });
  card.addEventListener("input",renderDecision);
});
document.querySelector("[data-copy-decision]").addEventListener("click",async function(){
  const text=renderDecision();if(!text)return;
  try{await navigator.clipboard.writeText(text);decisionStatus.textContent="Decision JSON copied.";}
  catch(error){decisionStatus.textContent="Clipboard access was unavailable. Select and copy the JSON preview below.";}
});
document.querySelector("[data-download-decision]").addEventListener("click",function(){
  const text=renderDecision();if(!text)return;
  const link=document.createElement("a");link.href=URL.createObjectURL(new Blob([text],{type:"application/json"}));link.download="content-studio-phase3-experiment-decision.json";link.click();URL.revokeObjectURL(link.href);decisionStatus.textContent="Decision JSON downloaded.";
});
</script></body></html>\n`;
}

const SOURCE_KINDS = new Set<GrowExperimentSourceKind>(["raw-thought", "long-form", "substack-note"]);
const EVIDENCE_STATUSES = new Set<GrowExperimentEvidenceStatus>(["supported", "hypothesis"]);
const OUTCOME_FAMILIES = new Set<GrowExperimentOutcomeFamily>(["attention", "conversation", "audience", "business"]);
const DECISION_STATUSES = new Set<GrowExperimentVariantDecisionStatus>(["approved", "edited", "rejected", "needs-another-pass"]);
const PLATFORM_LIMITS: Readonly<Record<string, number>> = { x: 280, bluesky: 300, threads: 500, mastodon: 500, community: 1500, linkedin: 3000 };

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} is required`);
  return value.trim();
}

function exactBody(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} is required`);
  return value;
}

function iso(value: unknown, field: string): string {
  const normalized = text(value, field);
  if (Number.isNaN(Date.parse(normalized))) throw new Error(`${field} must be a valid timestamp`);
  return normalized;
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) throw new Error(`${field} must be a non-negative integer`);
  return value;
}

function positiveInteger(value: unknown, field: string): number {
  const result = nonNegativeInteger(value, field);
  if (result === 0) throw new Error(`${field} must be positive`);
  return result;
}

function refs(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${field} must be a non-empty array`);
  const normalized = value.map((entry, index) => text(entry, `${field}[${index}]`));
  if (new Set(normalized).size !== normalized.length) throw new Error(`${field} contains duplicates`);
  return normalized.sort((left, right) => left.localeCompare(right));
}

function uniqueTexts(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${field} must be a non-empty array`);
  const normalized = value.map((entry, index) => text(entry, `${field}[${index}]`));
  if (new Set(normalized).size !== normalized.length) throw new Error(`${field} contains duplicates`);
  return normalized.sort((left, right) => left.localeCompare(right));
}

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stable(object[key])}`).join(",")}}`;
}

function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(stable(value)).digest("hex")}`;
}

function assertVoice(body: string, field: string): void {
  const findings: string[] = [];
  if (/[—–]/.test(body)) findings.push("dash");
  if (/\[\^[^\]]+\]|^\[\^[^\]]+\]:/m.test(body)) findings.push("markdown footnote");
  const tells: readonly RegExp[] = [
    /\bhere(?:'|’)?s the (?:thing|kicker)\b/i,
    /\bthe thing is\b/i,
    /\bit(?:'|’)?s not just\b/i,
    /\bit(?:'|’)?s not about .{0,80}\bit(?:'|’)?s about\b/i,
    /\b(?:isn(?:'|’)?t|more than) just\b/i,
    /\blet(?:'|’)?s (?:dive in|unpack|break it down)\b/i,
    /\b(?:in a world where|in an age of|in today(?:'|’)?s)\b/i,
    /\b(?:at the end of the day|the reality is|the truth is|make no mistake|it(?:'|’)?s worth noting|that said|needless to say)\b/i,
    /\b(?:delve|supercharge|game-changer|tapestry|testament|ever-evolving|robust|seamless|realm|landscape|foster|harness|elevate|empower|paradigm|journey)\b/i,
    /\b(?:navigate the complexities|unlock(?:ing|ed|s)?|at scale)\b/i,
  ];
  if (tells.some((pattern) => pattern.test(body))) findings.push("AI tell");
  if (/:\s+(?!https?:\/\/)[a-z]/.test(body)) findings.push("lowercase after colon");
  if (findings.length) throw new Error(`${field} failed voice cleanup: ${findings.join(", ")}`);
}

function canonicalUrl(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const normalized = text(value, "source.canonicalUrl");
  let parsed: URL;
  try { parsed = new URL(normalized); } catch { throw new Error("source.canonicalUrl is invalid"); }
  if (parsed.protocol !== "https:") throw new Error("source.canonicalUrl must use https");
  return normalized;
}

function assertCta(body: string, kind: GrowExperimentSourceKind, url: string | null, field: string): void {
  const links = body.match(/https:\/\/[^\s)]+/g) ?? [];
  if (kind === "substack-note") {
    if (links.length > 0) throw new Error(`${field}: Substack Note variants must remain link-free`);
    return;
  }
  if (kind === "long-form" && url !== null && !body.includes(url)) {
    throw new Error(`${field} is missing the canonical source CTA`);
  }
  if (url === null && links.length > 0) throw new Error(`${field} contains a link without an approved CTA destination`);
  if (url !== null && (links.length !== 1 || links[0] !== url)) throw new Error(`${field} must contain only the canonical source CTA`);
}

function normalizeSpace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function sourceRefCoverage(sourceId: string, sourceBody: string, sourceRefs: readonly string[], field: string): { keys: Set<string>; text: string } {
  const lines = sourceBody.split(/\r?\n/);
  const keys = new Set<string>();
  const parts: string[] = [];
  for (const ref of sourceRefs) {
    if (ref === `${sourceId}#body`) {
      if (sourceRefs.length !== 1) throw new Error(`${field} #body reference must stand alone`);
      keys.add("body");
      parts.push(sourceBody);
      continue;
    }
    const match = new RegExp(`^${sourceId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}#L(\\d+)(?:-L?(\\d+))?$`).exec(ref);
    if (!match) throw new Error(`${field} must reference ${sourceId} by #body or #Lx-Ly`);
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start < 1 || end < start || end > lines.length) throw new Error(`${field} contains a source line outside the supplied source body`);
    for (let line = start; line <= end; line += 1) keys.add(String(line));
    parts.push(lines.slice(start - 1, end).join("\n"));
  }
  return { keys, text: parts.join("\n") };
}

export function buildGrowExperimentProposal(input: GrowExperimentProposalInput): GrowExperimentProposal {
  const id = text(input.id, "id");
  const createdAt = iso(input.createdAt, "createdAt");
  const sourceKind = input.source?.kind;
  if (!SOURCE_KINDS.has(sourceKind)) throw new Error("source.kind is invalid");
  const source = {
    id: text(input.source?.id, "source.id"),
    kind: sourceKind,
    body: exactBody(input.source?.body, "source.body"),
    originRef: text(input.source?.originRef, "source.originRef"),
    canonicalUrl: canonicalUrl(input.source?.canonicalUrl),
  };
  const selectedPlatforms = uniqueTexts(input.selectedPlatforms, "selectedPlatforms");
  if (input.cut?.decision?.status !== "approved" || input.cut.decision.decidedBy !== "muxin") throw new Error("cut requires Muxin approval");
  const cut = {
    id: text(input.cut.id, "cut.id"),
    body: exactBody(input.cut.body, "cut.body"),
    sourceRefs: refs(input.cut.sourceRefs, "cut.sourceRefs"),
    rationale: text(input.cut.rationale, "cut.rationale"),
    decision: { status: "approved" as const, decidedBy: "muxin" as const, decidedAt: iso(input.cut.decision.decidedAt, "cut.decision.decidedAt") },
  };
  assertVoice(cut.body, "cut.body");
  const cutCoverage = sourceRefCoverage(source.id, source.body, cut.sourceRefs, "cut.sourceRefs");
  if (normalizeSpace(cut.body) !== normalizeSpace(cutCoverage.text)) throw new Error("cut.body must exactly match its cited source lines");
  if (!Array.isArray(input.variants) || input.variants.length === 0) throw new Error("variants must be a non-empty array");
  const variantIds = new Set<string>();
  const variants = input.variants.map((variant, index): GrowExperimentVariant => {
    const prefix = `variants[${index}]`;
    const variantId = text(variant.id, `${prefix}.id`);
    if (variantIds.has(variantId)) throw new Error("variant ids must be unique");
    variantIds.add(variantId);
    const platform = text(variant.platform, `${prefix}.platform`);
    if (!selectedPlatforms.includes(platform)) throw new Error(`selected platform set does not include variant platform ${platform}`);
    const body = exactBody(variant.body, `${prefix}.body`);
    assertVoice(body, `${prefix}.body`);
    assertCta(body, source.kind, source.canonicalUrl, `${prefix}.body`);
    const platformLimit = PLATFORM_LIMITS[platform];
    if (platformLimit !== undefined && body.length > platformLimit) throw new Error(`${prefix}.body exceeds the ${platform} ${platformLimit}-character limit`);
    if (!EVIDENCE_STATUSES.has(variant.treatment?.evidenceStatus)) throw new Error(`${prefix}.treatment.evidenceStatus is invalid`);
    const variables = variant.experimentVariables;
    if (variables === null || typeof variables !== "object" || Array.isArray(variables) || Object.keys(variables).length === 0) {
      throw new Error(`${prefix}.experimentVariables must be a non-empty object`);
    }
    const experimentVariables = Object.fromEntries(Object.entries(variables).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => [text(key, `${prefix}.experimentVariables key`), text(value, `${prefix}.experimentVariables.${key}`)]));
    if (variant.voiceCheck !== "passed") throw new Error(`${prefix}.voiceCheck must be passed`);
    if (variant.originalityCheck !== "passed") throw new Error(`${prefix}.originalityCheck must be passed`);
    if (variant.generation?.pipeline !== "content-studio-configured-v1") throw new Error(`${prefix}.generation must come from the Content Studio configured pipeline`);
    if (variant.generation.editor?.version !== "cold-feed-v1" || variant.generation.editor.status !== "passed") {
      throw new Error(`${prefix}.generation.editor must record a passed cold-feed-v1 editor treatment`);
    }
    const editorRecommendation = text(variant.generation.editor.recommendation, `${prefix}.generation.editor.recommendation`);
    const inputBodyDigest = text(variant.generation.editor.inputBodyDigest, `${prefix}.generation.editor.inputBodyDigest`);
    const outputBodyDigest = text(variant.generation.editor.outputBodyDigest, `${prefix}.generation.editor.outputBodyDigest`);
    if (!/^sha256:[a-f0-9]{64}$/.test(inputBodyDigest)) throw new Error(`${prefix}.generation.editor.inputBodyDigest is invalid`);
    if (outputBodyDigest !== experimentBodyDigest(body)) throw new Error(`${prefix}.generation.editor.outputBodyDigest does not match the candidate body`);
    const sourceRefs = refs(variant.sourceRefs, `${prefix}.sourceRefs`);
    const variantCoverage = sourceRefCoverage(source.id, source.body, sourceRefs, `${prefix}.sourceRefs`);
    if ([...variantCoverage.keys].some((key) => !cutCoverage.keys.has(key))) throw new Error(`${prefix}.sourceRefs exceed the approved cut boundary`);
    return {
      id: variantId,
      platform,
      medium: text(variant.medium, `${prefix}.medium`),
      format: text(variant.format, `${prefix}.format`),
      body,
      sourceRefs,
      treatment: {
        ref: text(variant.treatment?.ref, `${prefix}.treatment.ref`),
        rationale: text(variant.treatment?.rationale, `${prefix}.treatment.rationale`),
        evidenceStatus: variant.treatment.evidenceStatus,
        evidenceRefs: refs(variant.treatment.evidenceRefs, `${prefix}.treatment.evidenceRefs`),
      },
      experimentVariables,
      voiceCheck: "passed",
      originalityCheck: "passed",
      generation: {
        pipeline: "content-studio-configured-v1",
        editor: { version: "cold-feed-v1", status: "passed", recommendation: editorRecommendation, inputBodyDigest, outputBodyDigest },
      },
      lineage: { sourceId: source.id, cutId: cut.id, experimentId: text(input.experiment?.id, "experiment.id") },
    };
  }).sort((left, right) => left.id.localeCompare(right.id));
  for (const platform of selectedPlatforms) {
    if (!variants.some((variant) => variant.platform === platform)) throw new Error(`selected platform ${platform} has no variant`);
  }

  const reviewPlatforms = new Set<string>();
  const review = (input.capacity?.review ?? []).map((entry, index) => {
    const platform = text(entry.platform, `capacity.review[${index}].platform`);
    if (!selectedPlatforms.includes(platform)) throw new Error(`review capacity platform ${platform} is not selected`);
    if (reviewPlatforms.has(platform)) throw new Error(`duplicate review capacity for ${platform}`);
    reviewPlatforms.add(platform);
    return { platform, available: nonNegativeInteger(entry.available, `capacity.review[${index}].available`) };
  }).sort((left, right) => left.platform.localeCompare(right.platform));
  for (const platform of selectedPlatforms) if (!reviewPlatforms.has(platform)) throw new Error(`review capacity is missing for ${platform}`);

  const slotPlatforms = new Set<string>();
  const slots = (input.capacity?.slots ?? []).map((slot, index) => {
    const platform = text(slot.platform, `capacity.slots[${index}].platform`);
    if (!selectedPlatforms.includes(platform)) throw new Error(`capacity slot platform ${platform} is not selected`);
    if (slotPlatforms.has(platform)) throw new Error(`duplicate capacity slot for ${platform}`);
    slotPlatforms.add(platform);
    const available = nonNegativeInteger(slot.available, `capacity.slots[${index}].available`);
    const capacityValue = slot.capacity === undefined ? undefined : nonNegativeInteger(slot.capacity, `capacity.slots[${index}].capacity`);
    const scheduledCount = slot.scheduledCount === undefined ? undefined : nonNegativeInteger(slot.scheduledCount, `capacity.slots[${index}].scheduledCount`);
    if ((capacityValue === undefined) !== (scheduledCount === undefined)) throw new Error(`capacity.slots[${index}] must supply capacity and scheduledCount together`);
    if (capacityValue !== undefined && scheduledCount! + available !== capacityValue) throw new Error(`capacity.slots[${index}] capacity must equal scheduledCount plus available`);
    return { platform, available, ...(capacityValue === undefined ? {} : { capacity: capacityValue, scheduledCount }) };
  }).sort((left, right) => left.platform.localeCompare(right.platform));
  for (const platform of selectedPlatforms) if (!slotPlatforms.has(platform)) throw new Error(`capacity slot is missing for ${platform}`);

  const outcomeFamilies = uniqueTexts(input.experiment?.outcomeFamilies, "experiment.outcomeFamilies") as GrowExperimentOutcomeFamily[];
  if (outcomeFamilies.some((family) => !OUTCOME_FAMILIES.has(family))) throw new Error("experiment.outcomeFamilies contains an invalid family");
  const experimentId = text(input.experiment?.id, "experiment.id");
  const suppliedRecommendation = input.recommendation;
  if (suppliedRecommendation?.version !== "signals-experiment-recommendation-v1" || suppliedRecommendation.owner !== "signals") {
    throw new Error("recommendation must be a Signals-owned signals-experiment-recommendation-v1 record");
  }
  const recommendationEvidenceRefs = refs(suppliedRecommendation.evidenceRefs, "recommendation.evidenceRefs");
  const recommendationFamilies = new Set(outcomeFamilies);
  const expected = suppliedRecommendation.expectedOutcome;
  if (!variantIds.has(expected?.variantId)) throw new Error("recommendation.expectedOutcome must name a proposal variant");
  const comparisonRef = text(expected?.comparisonRef, "recommendation.expectedOutcome.comparisonRef");
  if (comparisonRef === expected.variantId || (!variantIds.has(comparisonRef) && !recommendationEvidenceRefs.includes(comparisonRef))) {
    throw new Error("recommendation.expectedOutcome comparisonRef must name another proposal variant or cited baseline evidence");
  }
  if (!recommendationFamilies.has(expected.family)) throw new Error("recommendation.expectedOutcome family must be declared by the experiment");
  if (!["increase", "decrease", "maintain"].includes(expected.direction)) throw new Error("recommendation.expectedOutcome direction is invalid");
  const primaryMetric = suppliedRecommendation.primaryMetric;
  if (!recommendationFamilies.has(primaryMetric?.family)) throw new Error("recommendation.primaryMetric family must be declared by the experiment");
  if (expected.family !== primaryMetric.family || text(expected.metric, "recommendation.expectedOutcome.metric") !== text(primaryMetric.metric, "recommendation.primaryMetric.metric")) {
    throw new Error("recommendation expected outcome must use the primary metric");
  }
  const minimumSample = positiveInteger(suppliedRecommendation.minimumSample, "recommendation.minimumSample");
  if (minimumSample !== positiveInteger(input.experiment?.minimumSample, "experiment.minimumSample")) throw new Error("recommendation minimum sample must match the experiment");
  const guardrails = (suppliedRecommendation.guardrails ?? []).map((guardrail, index) => {
    if (!recommendationFamilies.has(guardrail.family)) throw new Error(`recommendation.guardrails[${index}].family must be declared by the experiment`);
    return { family: guardrail.family, metric: text(guardrail.metric, `recommendation.guardrails[${index}].metric`), rule: text(guardrail.rule, `recommendation.guardrails[${index}].rule`) };
  });
  if (guardrails.length === 0) throw new Error("recommendation.guardrails must not be empty");
  const recommendation: SignalsExperimentRecommendationInput = {
    version: "signals-experiment-recommendation-v1",
    id: text(suppliedRecommendation.id, "recommendation.id"),
    owner: "signals",
    createdAt: iso(suppliedRecommendation.createdAt, "recommendation.createdAt"),
    evidenceRefs: recommendationEvidenceRefs,
    observation: text(suppliedRecommendation.observation, "recommendation.observation"),
    interpretation: text(suppliedRecommendation.interpretation, "recommendation.interpretation"),
    hypothesis: text(suppliedRecommendation.hypothesis, "recommendation.hypothesis"),
    expectedOutcome: { variantId: expected.variantId, comparisonRef, family: expected.family, metric: primaryMetric.metric, direction: expected.direction },
    whyThisInput: text(suppliedRecommendation.whyThisInput, "recommendation.whyThisInput"),
    controlledVariable: text(suppliedRecommendation.controlledVariable, "recommendation.controlledVariable"),
    constants: uniqueTexts(suppliedRecommendation.constants, "recommendation.constants"),
    primaryMetric: { family: primaryMetric.family, metric: text(primaryMetric.metric, "recommendation.primaryMetric.metric") },
    guardrails,
    minimumSample,
    minimumDays: positiveInteger(suppliedRecommendation.minimumDays, "recommendation.minimumDays"),
    decisionRule: {
      keep: text(suppliedRecommendation.decisionRule?.keep, "recommendation.decisionRule.keep"),
      revise: text(suppliedRecommendation.decisionRule?.revise, "recommendation.decisionRule.revise"),
      reject: text(suppliedRecommendation.decisionRule?.reject, "recommendation.decisionRule.reject"),
    },
    confidence: (["low", "medium", "high"] as const).includes(suppliedRecommendation.confidence) ? suppliedRecommendation.confidence : (() => { throw new Error("recommendation.confidence is invalid"); })(),
    caveats: uniqueTexts(suppliedRecommendation.caveats, "recommendation.caveats"),
    capacityRationale: text(suppliedRecommendation.capacityRationale, "recommendation.capacityRationale"),
    provenance: {
      mechanism: suppliedRecommendation.provenance?.mechanism === "signals-science-agent-v1" ? suppliedRecommendation.provenance.mechanism : (() => { throw new Error("recommendation provenance must come from signals-science-agent-v1"); })(),
      engine: (["claude", "grok", "codex"] as const).includes(suppliedRecommendation.provenance?.engine) ? suppliedRecommendation.provenance.engine : (() => { throw new Error("recommendation provenance engine is invalid"); })(),
      evidenceDigest: text(suppliedRecommendation.provenance?.evidenceDigest, "recommendation.provenance.evidenceDigest"),
      promptDigest: text(suppliedRecommendation.provenance?.promptDigest, "recommendation.provenance.promptDigest"),
      responseDigest: text(suppliedRecommendation.provenance?.responseDigest, "recommendation.provenance.responseDigest"),
    },
  };
  for (const [field, value] of Object.entries(recommendation.provenance).filter(([field]) => field.endsWith("Digest"))) {
    if (!/^sha256:[a-f0-9]{64}$/.test(value)) throw new Error(`recommendation.provenance.${field} is invalid`);
  }
  const capacity = {
    day: text(input.capacity?.day, "capacity.day"),
    review,
    slots,
  };
  const capacityManifest = buildGrowCapacityManifest({
    days: [capacity.day],
    platforms: selectedPlatforms,
    candidates: variants.map((variant) => ({ id: variant.id, day: capacity.day, platform: variant.platform, status: "candidate" })),
    // The proposal represents work admitted into the declared review batch. Passing null here
    // avoids mislabeling an exactly-full batch as paused; the explicit per-platform limit remains
    // in proposal.capacity.review and is enforced when decisions are applied.
    reviewCapacity: review.map((entry) => ({ day: capacity.day, platform: entry.platform, capacity: null })),
    slotCapacity: slots.map((slot) => ({ day: capacity.day, platform: slot.platform, capacity: slot.capacity ?? null, scheduledCount: slot.scheduledCount ?? null, availableSlots: slot.available })),
  });
  const experiment = {
    id: experimentId,
    question: text(input.experiment?.question, "experiment.question"),
    outcomeFamilies,
    minimumSample,
    topic: text(input.experiment?.topic, "experiment.topic"),
    audience: text(input.experiment?.audience, "experiment.audience"),
  };
  const variableOptions = new Map<string, Set<string>>();
  for (const variant of variants) for (const [name, option] of Object.entries(variant.experimentVariables)) {
    const options = variableOptions.get(name) ?? new Set<string>();
    options.add(option); variableOptions.set(name, options);
  }
  const experimentRecord = buildExperimentRecord({
    id: experiment.id,
    question: experiment.question,
    hypothesis: recommendation.hypothesis,
    unit: "published platform variant",
    variables: [...variableOptions].map(([name, options]) => ({ name, options: [...options] })),
    scope: { platform: selectedPlatforms, format: [...new Set(variants.map((variant) => variant.format))], topic: [experiment.topic], audience: [experiment.audience] },
    lineage: { sourceRefs: [source.id], variantRefs: variants.map((variant) => variant.id), publishRefs: [], outcomeRefs: [] },
    successObservations: outcomeFamilies.map((family) => ({ id: `${experiment.id}:${family}`, family, metric: family === recommendation.primaryMetric.family ? recommendation.primaryMetric.metric : `${family}-outcome`, measured: false })),
    minimumSample: experiment.minimumSample,
    reviewRule: `Review after at least ${recommendation.minimumSample} comparable published units and ${recommendation.minimumDays} days. Keep: ${recommendation.decisionRule.keep} Revise: ${recommendation.decisionRule.revise} Reject: ${recommendation.decisionRule.reject}`,
    status: "proposed",
    winner: null,
  });
  const reviewBundles = variants.map((variant) => buildGrowReviewBundle({
    id: `review:${id}:${variant.id}`,
    sourceRef: { recordType: "source", id: source.id },
    cutRef: { recordType: "cut", id: cut.id },
    variantRefs: [{ recordType: "variant", id: variant.id }],
    publishRefs: null,
    lineage: [
      { recordType: "source", id: source.id }, { recordType: "cut", id: cut.id },
      { recordType: "variant", id: variant.id }, { recordType: "treatment", id: variant.treatment.ref },
      { recordType: "experiment", id: experiment.id },
    ],
    evidenceStatus: variant.treatment.evidenceStatus,
    evidenceRefs: [...variant.sourceRefs, ...variant.treatment.evidenceRefs],
    evidenceNote: `Source references are within the approved cut; semantic grounding remains for Muxin to review. Treatment evidence status is ${variant.treatment.evidenceStatus}.`,
    voiceCheck: variant.voiceCheck,
    originalityCheck: variant.originalityCheck,
    humanDecision: { status: "candidate", decidedBy: null, decidedAt: null, note: null },
  }));
  const proposalWithoutDigest = {
    kind: "grow_experiment_proposal" as const,
    version: GROW_EXPERIMENT_PROPOSAL_VERSION,
    id,
    createdAt,
    source,
    recommendation,
    selectedPlatforms,
    cut,
    variants,
    capacity,
    capacityManifest,
    experiment,
    experimentRecord,
    reviewBundles,
    review: {
      required: true as const,
      owner: "muxin" as const,
      status: "pending" as const,
      decisionOptions: ["approved", "edited", "rejected", "needs-another-pass"] as GrowExperimentVariantDecisionStatus[],
    },
    winner: null,
    autoApproval: false as const,
    autoScheduling: false as const,
    autoPublishing: false as const,
  };
  return { ...proposalWithoutDigest, digest: digest(proposalWithoutDigest) };
}

export function buildGrowExperimentDecision(proposal: GrowExperimentProposal, input: GrowExperimentDecisionInput): GrowExperimentSlice {
  if (proposal.kind !== "grow_experiment_proposal" || proposal.version !== GROW_EXPERIMENT_PROPOSAL_VERSION) throw new Error("proposal kind or version is unsupported");
  const rebuilt = buildGrowExperimentProposal({
    id: proposal.id,
    createdAt: proposal.createdAt,
    source: proposal.source,
    recommendation: proposal.recommendation,
    selectedPlatforms: proposal.selectedPlatforms,
    cut: proposal.cut,
    variants: proposal.variants.map((variant) => ({
      id: variant.id,
      platform: variant.platform,
      medium: variant.medium,
      format: variant.format,
      body: variant.body,
      sourceRefs: variant.sourceRefs,
      treatment: variant.treatment,
      experimentVariables: variant.experimentVariables,
      voiceCheck: variant.voiceCheck,
      originalityCheck: variant.originalityCheck,
      generation: variant.generation,
    })),
    capacity: { day: proposal.capacity.day, review: proposal.capacity.review, slots: proposal.capacity.slots },
    experiment: {
      id: proposal.experiment.id,
      question: proposal.experiment.question,
      outcomeFamilies: proposal.experiment.outcomeFamilies,
      minimumSample: proposal.experiment.minimumSample,
      topic: proposal.experiment.topic,
      audience: proposal.experiment.audience,
    },
  });
  if (stable(rebuilt) !== stable(proposal)) throw new Error("proposal contains forged or non-canonical derived fields");
  const { digest: suppliedDigest, ...proposalWithoutDigest } = proposal;
  const authenticDigest = digest(proposalWithoutDigest);
  if (suppliedDigest !== authenticDigest || input.proposalDigest !== authenticDigest) throw new Error("proposal digest does not match the immutable proposal");
  if (text(input.decidedBy, "decidedBy").toLowerCase() !== "muxin") throw new Error("only Muxin can decide an Experiment review");
  const decidedAt = iso(input.decidedAt, "decidedAt");
  if (!Array.isArray(input.decisions) || input.decisions.length !== proposal.variants.length) throw new Error("a decision is required for every variant");
  const variantMap = new Map(proposal.variants.map((variant) => [variant.id, variant]));
  const seen = new Set<string>();
  const decisions = input.decisions.map((decision, index) => {
    const variantId = text(decision.variantId, `decisions[${index}].variantId`);
    if (!variantMap.has(variantId) || seen.has(variantId)) throw new Error("decisions must identify every variant exactly once");
    seen.add(variantId);
    if (!DECISION_STATUSES.has(decision.status)) throw new Error(`decisions[${index}].status is invalid`);
    const note = decision.note === null ? null : text(decision.note, `decisions[${index}].note`);
    let editedBody: string | null = null;
    if (decision.status === "edited") {
      editedBody = exactBody(decision.editedBody, `decisions[${index}].editedBody`);
      assertVoice(editedBody, `decisions[${index}].editedBody`);
      assertCta(editedBody, proposal.source.kind, proposal.source.canonicalUrl, `decisions[${index}].editedBody`);
      const platform = variantMap.get(variantId)!.platform;
      const platformLimit = PLATFORM_LIMITS[platform];
      if (platformLimit !== undefined && editedBody.length > platformLimit) throw new Error(`decisions[${index}].editedBody exceeds the ${platform} ${platformLimit}-character limit`);
    } else if (decision.editedBody !== undefined && decision.editedBody !== null) {
      throw new Error(`decisions[${index}].editedBody is allowed only for an edited decision`);
    }
    return { variantId, status: decision.status, note, editedBody };
  }).sort((left, right) => left.variantId.localeCompare(right.variantId));

  // An edit is a new body-bearing candidate. Record it, but require a fresh validated proposal
  // before it can cross the canonical review/delivery boundary.
  const approved = decisions.filter((decision) => decision.status === "approved");
  const approvedByPlatform = new Map<string, number>();
  for (const decision of approved) {
    const platform = variantMap.get(decision.variantId)!.platform;
    approvedByPlatform.set(platform, (approvedByPlatform.get(platform) ?? 0) + 1);
  }
  for (const entry of proposal.capacity.review) {
    if ((approvedByPlatform.get(entry.platform) ?? 0) > entry.available) throw new Error(`approved decisions exceed review capacity for ${entry.platform}`);
  }
  for (const slot of proposal.capacity.slots) {
    if ((approvedByPlatform.get(slot.platform) ?? 0) > slot.available) throw new Error(`approved decisions exceed slot capacity for ${slot.platform}`);
  }
  const decisionByVariant = new Map(decisions.map((decision) => [decision.variantId, decision]));
  const capacityManifest = buildGrowCapacityManifest({
    days: [proposal.capacity.day],
    platforms: proposal.selectedPlatforms,
    candidates: proposal.variants.map((variant) => {
      const status = decisionByVariant.get(variant.id)!.status;
      return { id: variant.id, day: proposal.capacity.day, platform: variant.platform, status: status === "approved" ? "approved" : status === "rejected" ? "rejected" : "blocked" };
    }),
    reviewCapacity: proposal.capacity.review.map((entry) => ({ day: proposal.capacity.day, platform: entry.platform, capacity: entry.available })),
    slotCapacity: proposal.capacity.slots.map((slot) => ({ day: proposal.capacity.day, platform: slot.platform, capacity: slot.capacity ?? null, scheduledCount: slot.scheduledCount ?? null, availableSlots: slot.available })),
  });
  const reviewBundles = proposal.variants.map((variant) => {
    const decision = decisionByVariant.get(variant.id)!;
    const bundleStatus = decision.status === "edited" ? "needs-another-pass" : decision.status;
    return buildGrowReviewBundle({
      id: `review:${proposal.id}:${variant.id}`,
      sourceRef: { recordType: "source", id: proposal.source.id },
      cutRef: { recordType: "cut", id: proposal.cut.id },
      variantRefs: [{ recordType: "variant", id: variant.id }],
      publishRefs: null,
      lineage: [
        { recordType: "source", id: proposal.source.id }, { recordType: "cut", id: proposal.cut.id },
        { recordType: "variant", id: variant.id }, { recordType: "treatment", id: variant.treatment.ref },
        { recordType: "experiment", id: proposal.experiment.id },
      ],
      evidenceStatus: decision.status === "approved" ? "supported" : variant.treatment.evidenceStatus,
      evidenceRefs: [...variant.sourceRefs, ...variant.treatment.evidenceRefs],
      evidenceNote: decision.status === "approved"
        ? `Muxin approved this candidate's semantic source grounding; treatment effectiveness remains ${variant.treatment.evidenceStatus}.`
        : `Source references are within the approved cut; semantic grounding was not approved. Treatment evidence status is ${variant.treatment.evidenceStatus}.`,
      voiceCheck: variant.voiceCheck,
      originalityCheck: variant.originalityCheck,
      humanDecision: {
        status: bundleStatus,
        decidedBy: "muxin",
        decidedAt,
        note: decision.status === "edited"
          ? `${decision.note ?? "Muxin supplied an edit."} The edited body requires a fresh validated proposal.`
          : decision.note,
      },
    });
  });
  const reviewByVariant = new Map(reviewBundles.map((bundle) => [bundle.variantRefs[0]!.id, bundle]));
  const capacityCandidateIds = proposal.variants.map((variant) => variant.id);
  const deliveryRecords = approved.map((decision) => {
    const variant = variantMap.get(decision.variantId)!;
    return buildGrowDeliveryRecord({
      reviewBundle: reviewByVariant.get(variant.id)!,
      capacityManifest,
      capacityCandidateIds,
      candidate: { id: variant.id, day: proposal.capacity.day, platform: variant.platform, variantId: variant.id },
      status: "approved",
      publishRef: null,
      outcomeRefs: [],
    });
  });
  const deliveryByVariant = new Map(deliveryRecords.map((record) => [record.lineage.variantId!, record]));
  const approvedRecords = approved.map((decision) => {
    const variant = variantMap.get(decision.variantId)!;
    const delivery = deliveryByVariant.get(variant.id)!;
    if (delivery.readiness.status !== "ready") throw new Error(`canonical delivery record is blocked for ${variant.id}: ${delivery.readiness.blockers.join(", ")}`);
    return {
      variantId: variant.id,
      platform: variant.platform,
      medium: variant.medium,
      format: variant.format,
      body: variant.body,
      sourceRefs: [...variant.sourceRefs],
      treatmentRef: variant.treatment.ref,
      experimentId: proposal.experiment.id,
      deliveryRecordId: delivery.id,
      deliveryReadiness: "ready" as const,
    };
  });
  return {
    kind: "grow_experiment_slice",
    version: GROW_EXPERIMENT_SLICE_VERSION,
    proposalDigest: authenticDigest,
    id: proposal.id,
    source: proposal.source,
    cut: proposal.cut,
    variants: proposal.variants,
    review: { required: true, owner: "muxin", status: "decided", decidedAt, decisions },
    capacityManifest,
    reviewBundles,
    deliveryRecords,
    approvedRecords,
    experiment: proposal.experiment,
    experimentRecord: proposal.experimentRecord,
    winner: null,
    autoApproval: false,
    autoScheduling: false,
    autoPublishing: false,
  };
}
