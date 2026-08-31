import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildContentRequest } from "./content-request.js";
import { proposeSignalsExperiment } from "./signals-experiment-proposal.js";

const request = buildContentRequest({
  id: "proposal-source", origin: "human-inference", descriptor: "A genuine belief shift about civic action",
  originalInput: "A private source sentence that must not enter the body-free science prompt.",
  treatments: ["belief-shift"], media: ["none"], platforms: ["linkedin"], includeUntreatedControl: true,
  sourceProvenance: { kind: "approved-cut", lens: "action", sourceLines: [5] },
});

const dossierPath = "docs/reviews/content-studio-phase2-used-to-think-final-dossier.json";
const evidenceRef = "dossier:sha256:eab59aff9411365842a03776499907fdc7de36fa7e5984f3ae8f11ec90c850bb#used-to-think-now-format-hypothesis";

describe("production Signals experiment proposal", () => {
  test("runs body-free science against persisted Content metadata and builds a capacity-bound plan", async () => {
    let prompt = "";
    const treated = request.variants.find((variant) => variant.identity.kind === "treated")!.identity.id;
    const control = request.variants.find((variant) => variant.identity.kind === "control")!.identity.id;
    const result = await proposeSignalsExperiment({
      contentRequestId: request.id, engine: "grok", evidenceDossierPath: dossierPath, evidenceFamily: "conversation", minimumSample: 10, minimumDays: 7,
      availablePublishingUnits: 12, availableDays: 14,
    }, async (value) => {
      prompt = value;
      return JSON.stringify({
        status: "recommended", evidenceRefs: [evidenceRef], observation: "The reviewed mechanism remains untested here.",
        interpretation: "Opening structure is the bounded uncertainty.", hypothesis: "The belief-shift opening will increase substantive replies relative to the untreated opening.",
        expectedOutcome: { variantId: treated, comparisonRef: control, family: "conversation", metric: "substantive-replies-per-1000", direction: "increase" },
        whyThisInput: "The approved cut contains a genuine belief shift.", controlledVariable: "opening treatment",
        constants: ["source", "platform", "CTA"], primaryMetric: { family: "conversation", metric: "substantive-replies-per-1000" },
        guardrails: [{ family: "conversation", metric: "negative-replies-per-1000", rule: "Must not increase." }],
        decisionRule: { keep: "Keep if replies increase and the guardrail holds.", revise: "Revise if uncertainty remains.", reject: "Reject if replies do not increase." },
        confidence: "high", caveats: ["One input cannot establish a general winner."], capacityRationale: "The declared window can carry the ten-unit test.",
      });
    }, { readRequest: async () => request, resolveFolder: () => "/unused", now: () => "2026-08-31T20:00:00.000Z" });
    assert.equal(result.status, "recommended");
    if (result.status !== "recommended") return;
    assert.equal(result.plan.priority, "high");
    assert.equal(result.plan.capacity.sufficient, true);
    assert.equal(result.plan.recommendation.provenance.engine, "grok");
    assert.doesNotMatch(prompt, /private source sentence/i);
    assert.match(prompt, /genuine belief shift about civic action/i);
    assert.match(prompt, /sha256:eab59aff/i);
    assert.match(prompt, /No post was tested with two alternate openings/i);
  });

  test("returns no-experiment without building a plan", async () => {
    const result = await proposeSignalsExperiment({
      contentRequestId: request.id, engine: "codex", evidenceDossierPath: dossierPath, evidenceFamily: "conversation", minimumSample: 10, minimumDays: 7,
      availablePublishingUnits: 10, availableDays: 7,
    }, async () => JSON.stringify({ status: "no-experiment", reason: "No bounded uncertainty justifies capacity.", evidenceRefs: [evidenceRef] }),
    { readRequest: async () => request, resolveFolder: () => "/unused" });
    assert.deepEqual(result.status, "no-experiment");
  });

  test("rejects an evidence file that cannot replay a usable Muxin review decision", async () => {
    await assert.rejects(() => proposeSignalsExperiment({
      contentRequestId: request.id, engine: "codex", evidenceDossierPath: "docs/reviews/forged.json", evidenceFamily: "conversation",
      minimumSample: 10, minimumDays: 7, availablePublishingUnits: 10, availableDays: 7,
    }, async () => "unused", {
      readRequest: async () => request, resolveFolder: () => "/unused",
      readDossier: async () => ({ readiness: { status: "usable", blockers: [] } }) as any,
    }), /research dossier|boundedEvidence|summaries/i);
  });

  test("rejects missing or invalid declared capacity before reading evidence or running science", async () => {
    let dossierRead = false;
    let scienceRan = false;
    await assert.rejects(() => proposeSignalsExperiment({
      contentRequestId: request.id, engine: "codex", evidenceDossierPath: dossierPath, evidenceFamily: "conversation",
      minimumSample: 10, minimumDays: 7, availablePublishingUnits: 0, availableDays: 7,
    }, async () => { scienceRan = true; return "unused"; }, {
      readRequest: async () => request, resolveFolder: () => "/unused",
      readDossier: async () => { dossierRead = true; return {}; },
    }), /availablePublishingUnits must be a positive integer/i);
    assert.equal(dossierRead, false);
    assert.equal(scienceRan, false);
  });

  test("abstains before reading evidence or running science when declared capacity cannot carry the test", async () => {
    let dossierRead = false;
    let scienceRan = false;
    const result = await proposeSignalsExperiment({
      contentRequestId: request.id, engine: "codex", evidenceDossierPath: dossierPath, evidenceFamily: "conversation",
      minimumSample: 10, minimumDays: 7, availablePublishingUnits: 2, availableDays: 7,
    }, async () => { scienceRan = true; return "unused"; }, {
      readRequest: async () => request, resolveFolder: () => "/unused",
      readDossier: async () => { dossierRead = true; return {}; },
    });
    assert.equal(result.status, "no-experiment");
    if (result.status === "no-experiment") assert.match(result.reason, /declared publishing capacity.*minimum sample/i);
    assert.equal(dossierRead, false);
    assert.equal(scienceRan, false);
  });
});
