import assert from "node:assert/strict";
import { test } from "node:test";
import { buildContentRequest } from "./content-request.js";
import { proposeVentureLearningExperiment } from "./venture-learning-experiment-proposal.js";
import type { LearningEvaluation } from "../venture/learning-evaluation.js";

const requestInput = {
  id: "venture-content", origin: "venture" as const, ventureId: "quiet-ops", descriptor: "Approved Venture post", originalInput: "A source thought.",
  treatments: ["summary"], platforms: ["linkedin"], media: ["none"], includeUntreatedControl: true,
  ventureSource: { artifactId: "text-post", phase: 2, artifactKind: "text-post-note" as const, messageId: "m1", bodyPath: "body.md", claimRefs: [], approval: { editorialStatus: "approved" as const, provenance: "muxin-editorial-approval" as const } },
};
const request = buildContentRequest(requestInput);
const evaluation: LearningEvaluation = {
  evaluationId: "eval-1", ventureSlug: "quiet-ops", inputRef: "response:r1", evidenceTier: "survey", claimCeiling: "stated-need",
  recommendation: "test", target: "experiment", rationale: "Readers said the checklist framing was clearer.", proposedChange: "Test checklist framing against the current framing.",
  evidenceRefs: ["response:r1"], affectedRefs: ["artifact:text-post"], caveats: ["One stated response is not demand."], engine: "codex", digest: "digest",
  status: "accepted", decidedBy: "muxin", decisionRationale: "Worth testing.", decidedAt: "2026-09-01T12:00:00.000Z",
  downstreamProposal: { kind: "venture-learning-proposal", evaluationId: "eval-1", inputRef: "response:r1", target: "experiment", statement: "Test checklist framing against the current framing.", evidenceRefs: ["response:r1"], affectedRefs: ["artifact:text-post"], claimCeiling: "stated-need", evidenceTier: "survey" },
};
const output = JSON.stringify({
  status: "recommended", evidenceRefs: ["response:r1"], observation: "One reader stated a preference for checklist framing.", interpretation: "The framing may make the value easier to recognize.",
  hypothesis: "Checklist framing will increase substantive replies relative to the summary framing.",
  expectedOutcome: { variantId: request.variants.find((v) => v.identity.kind === "treated")!.identity.id, comparisonRef: request.variants.find((v) => v.identity.kind === "control")!.identity.id, family: "conversation", metric: "substantive-replies", direction: "increase" },
  whyThisInput: "Muxin accepted this Venture learning as worth testing.", controlledVariable: "framing", constants: ["source", "platform", "CTA"],
  primaryMetric: { family: "conversation", metric: "substantive-replies" }, guardrails: [{ family: "conversation", metric: "confused-replies", rule: "Must not increase." }],
  decisionRule: { keep: "Keep if substantive replies increase.", revise: "Revise if replies are mixed.", reject: "Reject if confused replies increase." },
  confidence: "medium", caveats: ["This tests resonance, not demand."], capacityRationale: "One matched pair fits the declared capacity.",
});

test("an accepted Venture recommendation becomes a normal pending Experiment plan", async () => {
  let prompt = "";
  const result = await proposeVentureLearningExperiment({ ventureSlug: "quiet-ops", evaluationId: "eval-1", contentRequestId: request.id, engine: "codex", evidenceFamily: "conversation", minimumSample: 2, minimumDays: 2, availablePublishingUnits: 2, availableDays: 2 }, async (value) => { prompt = value; return output; }, { loadEvaluation: () => evaluation, readRequest: async () => request, resolveFolder: () => "/unused", now: () => "2026-09-01T13:00:00.000Z" });
  assert.equal(result.status, "recommended");
  if (result.status !== "recommended") return;
  assert.equal(result.envelope.plan.generatesCopy, false);
  assert.equal(result.envelope.planApproval, "pending-muxin");
  assert.equal(result.envelope.copyApproval, "pending-in-content");
  assert.equal(result.envelope.ventureContext.evaluationId, "eval-1");
  assert.match(prompt, /accepted Venture learning recommendation/i);
  assert.doesNotMatch(prompt, /A source thought/);
});

test("fails before model work without Muxin acceptance or capacity", async () => {
  let called = false;
  const run = async () => { called = true; return output; };
  const base = { ventureSlug: "quiet-ops", evaluationId: "eval-1", contentRequestId: request.id, engine: "codex" as const, evidenceFamily: "conversation" as const, minimumSample: 2, minimumDays: 2, availablePublishingUnits: 2, availableDays: 2 };
  await assert.rejects(() => proposeVentureLearningExperiment(base, run, { loadEvaluation: () => ({ ...evaluation, status: "pending", decidedBy: null }), readRequest: async () => request }), /accepted.*Muxin/i);
  const deferred = await proposeVentureLearningExperiment({ ...base, availablePublishingUnits: 1 }, run, { loadEvaluation: () => evaluation, readRequest: async () => request });
  assert.equal(deferred.status, "no-experiment");
  assert.equal(called, false);
});
