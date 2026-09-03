import { test } from "node:test";
import assert from "node:assert/strict";
import { receiptFromAcceptedSignalsInput, receiptFromResearchObservation, receiptFromResponse, type ResearchObservationLike, type SignalsInputArtifactLike } from "./venture-learning-receipt.js";
import type { ResponseRecord } from "../venture/responses.js";

const artifact: SignalsInputArtifactLike = {
  artifact_id: "signals-input-p1", artifact_kind: "signals-input", phase: 2, venture_id: "quiet-ops", venture_phase: 2,
  editorial_status: "draft", fields: {
    evidence_tier: "controlled", claim_ceiling: "bounded-comparison", source_record_refs: ["experiment:e1"], evidence_refs: ["outcome:t", "outcome:c"],
    scope: "one lead magnet", sample_size: 22, sample_size_by_arm: { treatment: 12, control: 10 }, provenance: "sha256:plan", caveats: ["small sample"], qualification: "qualified", evidence_status: "measured",
    venture_decision: { outcome: "accept" }, acceptance_fingerprint: "fp-1",
  },
};

test("accepted Signals artifact becomes a receipt with exact persisted metadata", () => {
  const r = receiptFromAcceptedSignalsInput(artifact);
  assert.deepEqual(r, {
    id: "signals-input-p1", venture: "quiet-ops", phase: 2, evidenceTier: "controlled", claimCeiling: "bounded-comparison",
    factualSummary: "Accepted Signals input (signals-input-p1)", evidenceRefs: ["outcome:t", "outcome:c"], sourceRefs: ["experiment:e1"],
    scope: "one lead magnet", sample: { treatment: 12, control: 10 }, caveats: ["small sample"],
  });
});

test("Signals receipt rejects absent, unaccepted, or drifted fields", () => {
  assert.throws(() => receiptFromAcceptedSignalsInput({ ...artifact, fields: null }), /fields/i);
  assert.throws(() => receiptFromAcceptedSignalsInput({ ...artifact, fields: { ...artifact.fields, venture_decision: { outcome: "reject" } } }), /accept/i);
  assert.throws(() => receiptFromAcceptedSignalsInput({ ...artifact, venture_phase: 3 }), /drift|phase/i);
  assert.throws(() => receiptFromAcceptedSignalsInput({ ...artifact, fields: { ...artifact.fields, claim_ceiling: undefined } }), /claim_ceiling/i);
  assert.throws(() => receiptFromAcceptedSignalsInput(artifact, "different-fingerprint"), /fingerprint.*canon/i);
  assert.throws(() => receiptFromAcceptedSignalsInput({ ...artifact, fields: { ...artifact.fields, claim_ceiling: "behavioral-intent" } }), /exceeds.*tier/i);
});

function observation(overrides: Partial<ResearchObservationLike> = {}): ResearchObservationLike {
  return { observation_id: "o-1", source: "metric", source_platform: "substack", surface: "note", content_item_id: "post-1",
    observed_at: "2026-09-01T00:00:00Z", redacted_text: null, behavioral_action: null, metric_name: "likes", metric_value: 14,
    previous_value: 10, delta: 4, window_start: "2026-08-31", window_end: "2026-09-01", collected_at: "2026-09-01T00:00:00Z", ...overrides };
}

test("ordinary analytics and redacted comments become honest account-level learning receipts", () => {
  const metric = receiptFromResearchObservation("quiet-ops", 2, observation());
  assert.equal(metric.evidenceTier, "engagement"); assert.equal(metric.claimCeiling, "attention");
  assert.match(metric.factualSummary, /likes: 14/); assert.match(metric.caveats.join(" "), /does not establish.*demand/i);
  const comment = receiptFromResearchObservation("quiet-ops", 2, observation({ source: "comment", metric_name: null, metric_value: null, redacted_text: "A reader wants a smaller first step." }));
  assert.equal(comment.evidenceTier, "qualitative"); assert.equal(comment.claimCeiling, "resonance");
  assert.match(comment.factualSummary, /smaller first step/); assert.doesNotMatch(JSON.stringify(comment), /respondent_hash|exact_text/);
});

function response(overrides: Partial<ResponseRecord> = {}): ResponseRecord {
  return { response_id: "r-1", source: "survey", received_at: "t", respondent_hash: "SECRET_HASH", target_audience_eligible: true,
    exact_quote: "PRIVATE EXACT QUOTE", redacted_quote: "redacted need", stuck_point: "stuck", desired_outcome: "desired", emotional_intensity: "medium",
    cluster_id: null, included_in_gate: true, exclusion_reason: null, ...overrides };
}

test("survey response maps to stated need and only uses redacted safe summary fields", () => {
  const r = receiptFromResponse("quiet-ops", 3, response());
  assert.equal(r.evidenceTier, "survey"); assert.equal(r.claimCeiling, "stated-need");
  assert.equal(r.evidenceRefs[0], "response:r-1"); assert.deepEqual(r.sample, { treatment: 1, control: 0 });
  assert.match(r.factualSummary, /redacted need/); assert.match(r.factualSummary, /stuck/); assert.match(r.factualSummary, /desired/);
  assert.doesNotMatch(r.factualSummary, /PRIVATE EXACT|SECRET_HASH/);
  assert.match(r.caveats[0], /not observed demand/i);
});

test("email, comment, DM, and other responses map to qualitative resonance", () => {
  for (const source of ["email", "comment", "dm", "other"] as const) {
    const r = receiptFromResponse("quiet-ops", 2, response({ source }));
    assert.equal(r.evidenceTier, "qualitative"); assert.equal(r.claimCeiling, "resonance");
  }
});

test("response receipt rejects absent safe text but retains excluded responses as caveated context", () => {
  assert.throws(() => receiptFromResponse("quiet-ops", 2, response({ redacted_quote: "" })), /redacted|safe/i);
  const excluded = receiptFromResponse("quiet-ops", 2, response({ included_in_gate: false, target_audience_eligible: false }));
  assert.match(excluded.scope, /contextual/i);
  assert.match(excluded.caveats.join(" "), /outside.*eligible audience|excluded/i);
});
