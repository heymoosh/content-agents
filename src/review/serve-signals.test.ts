import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleSignalsRoute } from "./serve-signals.js";
import { appendSignalsDecision, readSignalsDecisions } from "./signals-decisions.js";
import { buildContentRequest } from "./content-request.js";
import { approveExperimentPlan, buildExperimentPlan } from "../grow/experiment-content-handoff.js";
import { signalsExperimentRecommendation } from "../grow/experiment-test-fixtures.js";
import { markExperimentContentHandoff, recordExperimentPlan, reviewExperimentPlan } from "./signals-experiment-plan-store.js";
import { readSignalsVentureProposals, recordSignalsVentureProposal } from "./signals-venture-handoff-store.js";
import { recordExperimentInterpretation, reviewExperimentInterpretation } from "./signals-experiment-result-store.js";

function harness(method: string, path: string, body: Record<string, unknown> = {}) {
  let response: { code: number; value: unknown } | undefined;
  const req = { method } as any;
  return {
    req,
    url: new URL(`http://localhost${path}`),
    readBody: async () => body,
    json: (_res: unknown, code: number, value: unknown) => { response = { code, value }; },
    response: () => response,
  };
}

test("decline is durably recorded and returned by a later Signals read", async () => {
  const root = mkdtempSync(join(tmpdir(), "serve-signals-"));
  const ledger = join(root, "signals.jsonl");
  try {
    const h = harness("POST", "/api/signals/decision", { decision: "decline", type: "TEST", title: "Try the audit hook", rationale: "Not this cycle" });
    assert.equal(await handleSignalsRoute({ ...h, res: {} as any, decisionsPath: ledger }), true);
    assert.equal(h.response()?.code, 200);
    assert.equal(readSignalsDecisions(ledger)["TEST:Try the audit hook"].decision, "decline");
    const read = harness("GET", "/api/signals");
    assert.equal(await handleSignalsRoute({ ...read, res: {} as any, decisionsPath: ledger, proposalsPath: join(root, "proposals"), experimentPlansPath: join(root, "plans"), ventureHandoffsPath: join(root, "venture-handoffs.jsonl") }), true);
    assert.deepEqual((read.response()?.value as any).decisions["TEST:Try the audit hook"].decision, "decline");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Signals Venture handoff decision returns the named Venture and never writes Venture state", async () => {
  const root = mkdtempSync(join(tmpdir(), "serve-signals-venture-"));
  const handoffs = join(root, "handoffs.jsonl");
  try {
    const p = recordSignalsVentureProposal({ id: "learn-1", ventureSlug: "venture-a", phase: 2, sourceId: "s", variantId: "v", experimentId: "e", title: "A bounded input", factualSummary: "Observed fact", proposedInput: "Try this", rationale: "Useful next test", confidence: "medium", evidenceRefs: ["outcome:1"], inputKind: "funnel", contentItemRefs: ["item-1"], scope: "one venture", sampleSize: { treatment: 10, control: 10 }, provenance: { planDigest: "sha256:plan", interpretationId: "sha256:interp" }, caveats: ["caveat"], qualification: "qualified", evidenceStatus: "measured" }, handoffs);
    const h = harness("POST", `/api/signals/venture-handoff/${p.id}/decision`, { decision: "adopt", rationale: "I want to use this input" });
    assert.equal(await handleSignalsRoute({ ...h, res: {} as any, ventureHandoffsPath: handoffs }), true);
    assert.equal(h.response()?.code, 200);
    assert.deepEqual((h.response()?.value as any).openVenture, "venture-a");
    assert.equal((h.response()?.value as any).proposal.status, "adopted");
    const read = harness("GET", "/api/signals");
    await handleSignalsRoute({ ...read, res: {} as any, decisionsPath: join(root, "decisions"), ventureHandoffsPath: handoffs, proposalsPath: join(root, "changes"), experimentPlansPath: join(root, "plans") });
    assert.equal((read.response()?.value as any).ventureHandoffs[0].status, "adopted");
    assert.equal((read.response()?.value as any).ventureHandoffs[0].ventureGate, "blocked");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Signals Venture proposal is derived only from accepted measured experiment state", async () => {
  const root = mkdtempSync(join(tmpdir(), "serve-signals-venture-create-"));
  const plansPath = join(root, "plans.jsonl"), resultsPath = join(root, "results.jsonl"), handoffs = join(root, "handoffs.jsonl");
  try {
    const input = { id: "content-create", origin: "human-inference" as const, descriptor: "input", originalInput: "source", treatments: ["summary"], media: ["none"], platforms: ["linkedin"], sourceProvenance: { kind: "source" as const, sourceLines: [1] } };
    const request = buildContentRequest(input);
    const treated = request.variants.find((v) => v.identity.kind === "treated")!.identity.id;
    const control = request.variants.find((v) => v.identity.kind === "control")!.identity.id;
    const plan = buildExperimentPlan({ recommendation: { ...signalsExperimentRecommendation({ variantId: treated, comparisonRef: control }), id: "experiment-create", confidence: "high" }, contentRequest: input, variablesByVariant: Object.fromEntries(request.variants.map((v) => [v.identity.id, { opening: v.identity.kind }])), capacity: { availablePublishingUnits: 10, availableDays: 7 } });
    recordExperimentPlan(plan, plansPath);
    const approved = approveExperimentPlan(plan, { status: "approved", decidedBy: "muxin", decidedAt: "2026-08-31T18:00:00.000Z" });
    reviewExperimentPlan(plan.recommendation.id, approved, plansPath);
    markExperimentContentHandoff(plan.recommendation.id, { experimentId: plan.recommendation.id, generatedIds: [treated, control], copyApproval: "pending-in-content" }, plansPath);
    const interpretation = recordExperimentInterpretation({ experimentId: plan.recommendation.id, recommendation: "keep", rationale: "Use the measured opening as the next audience input.", evidenceRefs: ["outcome:1"], confidence: "high", caveats: ["bounded"], engine: "codex" }, resultsPath);
    reviewExperimentInterpretation(plan.recommendation.id, "accepted", "I accept this reading.", resultsPath);
    const response = harness("POST", "/api/signals/experiments/experiment-create/venture-handoff/propose", { ventureSlug: "venture-a", phase: 2, proposedInput: "client tamper", evidenceRefs: ["client-tamper"] });
    await handleSignalsRoute({ ...response, res: {} as any, experimentPlansPath: plansPath, experimentResultsPath: resultsPath, ventureHandoffsPath: handoffs, readVentureState: () => ({ current_phase: 2 }), readExperimentPerformance: () => ({ experiments: [{ experimentId: "experiment-create", analysisStatus: "ready", primaryMetric: { family: "audience", metric: "opt-ins" }, outcomeRefs: ["outcome:1"], primaryOutcomeRefs: { treatment: ["outcome:treatment"], control: ["outcome:control"] }, primaryComparison: { treatment: { variantId: treated, sample: 10, value: 2 }, control: { variantId: control, sample: 10, value: 1 } } }] }) });
    assert.equal(response.response()?.code, 200, JSON.stringify(response.response()?.value));
    const value = response.response()?.value as any;
    assert.equal(value.proposal.proposedInput, interpretation.rationale);
    assert.equal(value.proposal.ventureSlug, "venture-a");
    assert.equal(value.proposal.evidenceStatus, "measured");
    assert.deepEqual(value.proposal.evidenceRefs, ["outcome:1", "outcome:control", "outcome:treatment"]);

    const stalePhase = harness("POST", "/api/signals/experiments/experiment-create/venture-handoff/propose", { ventureSlug: "venture-stale", phase: 2 });
    await handleSignalsRoute({ ...stalePhase, res: {} as any, experimentPlansPath: plansPath, experimentResultsPath: resultsPath, ventureHandoffsPath: handoffs, readVentureState: () => ({ current_phase: 3 }), readExperimentPerformance: () => ({ experiments: [] }) });
    assert.equal(stalePhase.response()?.code, 409);
    assert.match(String((stalePhase.response()?.value as any).error), /phase 3.*not phase 2/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Signals Venture proposals preserve weaker experiment evidence without upgrading it to demand", async () => {
  const root = mkdtempSync(join(tmpdir(), "serve-signals-venture-qualification-"));
  const plansPath = join(root, "plans.jsonl"), resultsPath = join(root, "results.jsonl"), handoffs = join(root, "handoffs.jsonl");
  try {
    const input = { id: "content-qualified", origin: "human-inference" as const, descriptor: "input", originalInput: "source", treatments: ["summary"], media: ["none"], platforms: ["linkedin"], sourceProvenance: { kind: "source" as const, sourceLines: [1] } };
    const request = buildContentRequest(input);
    const treated = request.variants.find((v) => v.identity.kind === "treated")!.identity.id;
    const control = request.variants.find((v) => v.identity.kind === "control")!.identity.id;
    const plan = buildExperimentPlan({ recommendation: { ...signalsExperimentRecommendation({ variantId: treated, comparisonRef: control }), id: "experiment-qualified", confidence: "high" }, contentRequest: input, variablesByVariant: Object.fromEntries(request.variants.map((v) => [v.identity.id, { opening: v.identity.kind }])), capacity: { availablePublishingUnits: 10, availableDays: 7 } });
    recordExperimentPlan(plan, plansPath);
    const approved = approveExperimentPlan(plan, { status: "approved", decidedBy: "muxin", decidedAt: "2026-08-31T18:00:00.000Z" });
    reviewExperimentPlan(plan.recommendation.id, approved, plansPath);
    markExperimentContentHandoff(plan.recommendation.id, { experimentId: plan.recommendation.id, generatedIds: [treated, control], copyApproval: "pending-in-content" }, plansPath);
    recordExperimentInterpretation({ experimentId: plan.recommendation.id, recommendation: "keep", rationale: "Measured, but not yet a Venture-qualified outcome.", evidenceRefs: ["analytics:1"], confidence: "high", caveats: ["bounded"], engine: "codex" }, resultsPath);
    reviewExperimentInterpretation(plan.recommendation.id, "accepted", "I accept this content reading only.", resultsPath);

    for (const family of ["attention", "conversation", "audience"] as const) {
      const response = harness("POST", "/api/signals/experiments/experiment-qualified/venture-handoff/propose", { ventureSlug: `venture-${family}`, phase: 2 });
      await handleSignalsRoute({ ...response, res: {} as any, experimentPlansPath: plansPath, experimentResultsPath: resultsPath, ventureHandoffsPath: handoffs, readVentureState: () => ({ current_phase: 2 }), readExperimentPerformance: () => ({ experiments: [{ experimentId: "experiment-qualified", analysisStatus: "ready", primaryMetric: { family, metric: family === "attention" ? "impressions" : family === "conversation" ? "replies" : "clicks" }, outcomeRefs: ["analytics:1", "outcome:unrelated-guardrail"], primaryOutcomeRefs: { treatment: [], control: [] }, primaryComparison: { treatment: { variantId: treated, sample: 10, value: 2 }, control: { variantId: control, sample: 10, value: 1 } } }] }) });
      assert.equal(response.response()?.code, 200, JSON.stringify(response.response()?.value));
      const proposal = (response.response()?.value as any).proposal;
      assert.equal(proposal.evidenceTier, "controlled");
      assert.equal(proposal.claimCeiling, "bounded-comparison");
      assert.equal(proposal.inputKind, "controlled");
    }
    assert.equal(readSignalsVentureProposals(handoffs).length, 3);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Signals Venture proposal rejects rejected interpretations and mismatched experiment variants", async () => {
  const root = mkdtempSync(join(tmpdir(), "serve-signals-venture-lineage-"));
  const plansPath = join(root, "plans.jsonl"), resultsPath = join(root, "results.jsonl"), handoffs = join(root, "handoffs.jsonl");
  try {
    const input = { id: "content-lineage", origin: "human-inference" as const, descriptor: "input", originalInput: "source", treatments: ["summary"], media: ["none"], platforms: ["linkedin"], sourceProvenance: { kind: "source" as const, sourceLines: [1] } };
    const request = buildContentRequest(input);
    const treated = request.variants.find((v) => v.identity.kind === "treated")!.identity.id;
    const control = request.variants.find((v) => v.identity.kind === "control")!.identity.id;
    const plan = buildExperimentPlan({ recommendation: { ...signalsExperimentRecommendation({ variantId: treated, comparisonRef: control }), id: "experiment-lineage", confidence: "high" }, contentRequest: input, variablesByVariant: Object.fromEntries(request.variants.map((v) => [v.identity.id, { opening: v.identity.kind }])), capacity: { availablePublishingUnits: 10, availableDays: 7 } });
    recordExperimentPlan(plan, plansPath);
    const approved = approveExperimentPlan(plan, { status: "approved", decidedBy: "muxin", decidedAt: "2026-08-31T18:00:00.000Z" });
    reviewExperimentPlan(plan.recommendation.id, approved, plansPath);
    markExperimentContentHandoff(plan.recommendation.id, { experimentId: plan.recommendation.id, generatedIds: [treated, control], copyApproval: "pending-in-content" }, plansPath);
    recordExperimentInterpretation({ experimentId: plan.recommendation.id, recommendation: "reject", rationale: "This result should not become a Venture input.", evidenceRefs: ["outcome:lineage"], confidence: "high", caveats: ["bounded"], engine: "codex" }, resultsPath);
    reviewExperimentInterpretation(plan.recommendation.id, "accepted", "I accept the rejection reading.", resultsPath);
    const performance = (treatmentId: string) => ({ experiments: [{ experimentId: "experiment-lineage", analysisStatus: "ready", primaryMetric: { family: "business", metric: "qualified-inquiries" }, outcomeRefs: ["outcome:lineage"], primaryOutcomeRefs: { treatment: ["outcome:lineage"], control: ["outcome:lineage"] }, primaryComparison: { treatment: { variantId: treatmentId, sample: 10, value: 2 }, control: { variantId: control, sample: 10, value: 1 } } }] });

    const rejected = harness("POST", "/api/signals/experiments/experiment-lineage/venture-handoff/propose", { ventureSlug: "venture-rejected", phase: 2 });
    await handleSignalsRoute({ ...rejected, res: {} as any, experimentPlansPath: plansPath, experimentResultsPath: resultsPath, ventureHandoffsPath: handoffs, readVentureState: () => ({ current_phase: 2 }), readExperimentPerformance: () => performance(treated) });
    assert.equal(rejected.response()?.code, 409);
    assert.match(String((rejected.response()?.value as any).error), /reject/i);

    // A non-rejected interpretation is required before the lineage branch can be reached.
    const acceptedResults = join(root, "accepted-results.jsonl");
    recordExperimentInterpretation({ experimentId: plan.recommendation.id, recommendation: "keep", rationale: "A qualified result.", evidenceRefs: ["outcome:lineage"], confidence: "high", caveats: ["bounded"], engine: "codex" }, acceptedResults);
    reviewExperimentInterpretation(plan.recommendation.id, "accepted", "I accept this reading.", acceptedResults);
    const mismatched = harness("POST", "/api/signals/experiments/experiment-lineage/venture-handoff/propose", { ventureSlug: "venture-mismatch", phase: 2 });
    await handleSignalsRoute({ ...mismatched, res: {} as any, experimentPlansPath: plansPath, experimentResultsPath: acceptedResults, ventureHandoffsPath: handoffs, readVentureState: () => ({ current_phase: 2 }), readExperimentPerformance: () => performance("wrong-treatment") });
    assert.equal(mismatched.response()?.code, 409);
    assert.match(String((mismatched.response()?.value as any).error), /variant|lineage|treatment/i);
    assert.deepEqual(readSignalsVentureProposals(handoffs), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Signals read fails closed on a corrupt Venture handoff ledger", async () => {
  const root = mkdtempSync(join(tmpdir(), "serve-signals-corrupt-handoff-"));
  const path = join(root, "handoffs.jsonl");
  try {
    writeFileSync(path, "{not-json}\n");
    const read = harness("GET", "/api/signals");
    await assert.rejects(() => handleSignalsRoute({ ...read, res: {} as any, decisionsPath: join(root, "decisions"), proposalsPath: join(root, "changes"), experimentPlansPath: join(root, "plans"), ventureHandoffsPath: path }));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("adopt records a decision without mutating the repository backlog", async () => {
  const root = mkdtempSync(join(tmpdir(), "serve-signals-"));
  const ledger = join(root, "signals.jsonl");
  try {
    const proposals = join(root, "proposals.jsonl");
    const h = harness("POST", "/api/signals/decision", { action: "adopt", type: "DO MORE", title: "Use notes", rationale: "They travel" });
    assert.equal(await handleSignalsRoute({ ...h, res: {} as any, decisionsPath: ledger, proposalsPath: proposals }), true);
    assert.equal(h.response()?.code, 200);
    assert.doesNotMatch(readFileSync(new URL("./serve-signals.ts", import.meta.url), "utf8"), /appendBacklog|appendBacklogCard/);
    assert.equal(readSignalsDecisions(ledger)["DO MORE:Use notes"].decision, "adopt");
    assert.equal((h.response()?.value as any).proposal.status, "blocked", "unsupported recommendation is honestly blocked");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("proposal review endpoints keep approval separate from apply", async () => {
  const root = mkdtempSync(join(tmpdir(), "serve-signals-proposal-"));
  mkdirSync(join(root, "config"));
  writeFileSync(join(root, "config/platforms.yaml"), "platforms:\n  linkedin:\n    posts_per_week: 7\n");
  writeFileSync(join(root, "config/routing.yaml"), "defaults:\n  civic-tech: [x]\n");
  const proposalsPath = join(root, "state", "proposals.jsonl");
  try {
    const adopt = harness("POST", "/api/signals/decision", { decision: "adopt", type: "TEST", title: "Set linkedin cadence to 5 posts/week", rationale: "Measured fatigue" });
    await handleSignalsRoute({ ...adopt, res: {} as any, decisionsPath: join(root, "decisions"), proposalsPath, configRoot: root });
    const id = (adopt.response()?.value as any).proposal.id;
    const approve = harness("POST", `/api/signals/proposals/${id}/approve`, { evidence: "Muxin checked the exact delta" });
    await handleSignalsRoute({ ...approve, res: {} as any, proposalsPath, configRoot: root });
    assert.equal((approve.response()?.value as any).proposal.status, "approved");
    assert.match(readFileSync(join(root, "config/platforms.yaml"), "utf8"), /posts_per_week: 7/);
    const apply = harness("POST", `/api/signals/proposals/${id}/apply`);
    await handleSignalsRoute({ ...apply, res: {} as any, proposalsPath, configRoot: root });
    assert.match(readFileSync(join(root, "config/platforms.yaml"), "utf8"), /posts_per_week: 5/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Signals experiment approval triggers canonical Content generation but leaves copy approval pending", async () => {
  const root = mkdtempSync(join(tmpdir(), "serve-signals-experiment-"));
  const plansPath = join(root, "plans.jsonl");
  try {
    const input = { id: "content-one", origin: "human-inference" as const, descriptor: "experiment", originalInput: "Source.", treatments: ["summary"], media: ["none"], platforms: ["linkedin"], sourceProvenance: { kind: "source" as const, sourceLines: [1] } };
    const request = buildContentRequest(input);
    const variantId = request.variants.find((variant) => variant.identity.kind === "treated")!.identity.id;
    const comparisonRef = request.variants.find((variant) => variant.identity.kind === "control")!.identity.id;
    const plan = buildExperimentPlan({
      recommendation: { ...signalsExperimentRecommendation({ variantId, comparisonRef, minimumSample: 10 }), id: "experiment-one", confidence: "high" },
      contentRequest: input,
      variablesByVariant: Object.fromEntries(request.variants.map((variant) => [variant.identity.id, { opening: variant.identity.kind }])),
      capacity: { availablePublishingUnits: 10, availableDays: 7 },
    });
    recordExperimentPlan(plan, plansPath);
    const approve = harness("POST", "/api/signals/experiments/experiment-one/approve");
    await handleSignalsRoute({
      ...approve, res: {} as any, experimentPlansPath: plansPath,
      applyExperimentPlan: async (proposal, decision) => ({
        kind: "experiment_content_handoff", version: "experiment-content-handoff-v1", experimentId: proposal.recommendation.id,
        contentRequest: { ...proposal.contentRequest, experiment: null }, generatedIds: [variantId, comparisonRef],
        copyApproval: "pending-in-content", contentIsCanonicalReviewSurface: true,
      }),
    });
    assert.equal(approve.response()?.code, 200);
    const value = approve.response()?.value as any;
    assert.equal(value.handoff.copyApproval, "pending-in-content");
    assert.equal(value.decision.authorizesCopyApproval, false);
    assert.equal(value.experimentPlans[0].status, "drafts-pending-content-review");
    const read = harness("GET", "/api/signals");
    await handleSignalsRoute({ ...read, res: {} as any, decisionsPath: join(root, "decisions"), proposalsPath: join(root, "changes"), experimentPlansPath: plansPath, ventureHandoffsPath: join(root, "venture-handoffs.jsonl") });
    assert.equal((read.response()?.value as any).experimentPlans[0].generatedCopyIncluded, false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Signals retry cannot generate from a historical approval whose plan lacks current capacity", async () => {
  const root = mkdtempSync(join(tmpdir(), "serve-signals-legacy-capacity-"));
  const plansPath = join(root, "plans.jsonl");
  try {
    const contentInput = { id: "legacy-capacity", origin: "human-inference" as const, descriptor: "experiment", originalInput: "Source.", treatments: ["summary"], media: ["none"], platforms: ["linkedin"], sourceProvenance: { kind: "source" as const, sourceLines: [1] } };
    const request = buildContentRequest(contentInput);
    const variantId = request.variants.find((variant) => variant.identity.kind === "treated")!.identity.id;
    const comparisonRef = request.variants.find((variant) => variant.identity.kind === "control")!.identity.id;
    const current = buildExperimentPlan({
      recommendation: { ...signalsExperimentRecommendation({ variantId, comparisonRef }), id: "legacy-capacity", confidence: "high" },
      contentRequest: contentInput,
      variablesByVariant: Object.fromEntries(request.variants.map((variant) => [variant.identity.id, { opening: variant.identity.kind }])),
      capacity: { availablePublishingUnits: 10, availableDays: 7 },
    });
    const decision = approveExperimentPlan(current, { status: "approved", decidedBy: "muxin", decidedAt: "2026-08-30T18:00:00.000Z" });
    recordExperimentPlan({ ...current, capacity: undefined } as any, plansPath);
    reviewExperimentPlan(current.recommendation.id, decision, plansPath);
    let applied = false;
    const start = harness("POST", "/api/signals/experiments/legacy-capacity/start");
    await handleSignalsRoute({
      ...start, res: {} as any, experimentPlansPath: plansPath,
      applyExperimentPlan: async () => { applied = true; throw new Error("must not run"); },
    });
    assert.equal(start.response()?.code, 409);
    assert.match(String((start.response()?.value as any).error), /capacity/i);
    assert.equal(applied, false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Signals proposal endpoint runs science on a normal Content request and records an approval-ready plan", async () => {
  const root = mkdtempSync(join(tmpdir(), "serve-signals-propose-"));
  const plansPath = join(root, "plans.jsonl");
  try {
    const contentInput = { id: "content-proposed", origin: "human-inference" as const, descriptor: "experiment", originalInput: "Source.", treatments: ["summary"], media: ["none"], platforms: ["linkedin"], sourceProvenance: { kind: "source" as const, sourceLines: [1] } };
    const request = buildContentRequest(contentInput);
    const variantId = request.variants.find((variant) => variant.identity.kind === "treated")!.identity.id;
    const comparisonRef = request.variants.find((variant) => variant.identity.kind === "control")!.identity.id;
    const plan = buildExperimentPlan({
      recommendation: { ...signalsExperimentRecommendation({ variantId, comparisonRef }), id: "experiment-proposed", confidence: "high" },
      contentRequest: contentInput,
      variablesByVariant: Object.fromEntries(request.variants.map((variant) => [variant.identity.id, { opening: variant.identity.kind }])),
      capacity: { availablePublishingUnits: 10, availableDays: 7 },
    });
    const propose = harness("POST", "/api/signals/experiments/propose", {
      contentRequestId: "content-proposed", engine: "grok",
      evidenceDossierPath: "docs/reviews/reviewed.json", evidenceFamily: "conversation",
      minimumSample: 10, minimumDays: 7, availablePublishingUnits: 10, availableDays: 7,
    });
    let received: Record<string, unknown> | undefined;
    await handleSignalsRoute({
      ...propose, res: {} as any, experimentPlansPath: plansPath,
      proposeExperiment: async (body: any) => { received = body; return { status: "recommended", plan }; },
    } as any);
    assert.equal(propose.response()?.code, 200);
    assert.equal(received?.engine, "grok");
    assert.equal(received?.evidenceDossierPath, "docs/reviews/reviewed.json");
    assert.equal((propose.response()?.value as any).experimentPlans[0].experimentId, "experiment-proposed");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Signals proposal endpoint fails closed when publishing capacity is omitted", async () => {
  const root = mkdtempSync(join(tmpdir(), "serve-signals-capacity-"));
  try {
    let called = false;
    const propose = harness("POST", "/api/signals/experiments/propose", {
      contentRequestId: "content-one", evidenceDossierPath: "docs/reviews/reviewed.json", evidenceFamily: "conversation",
      minimumSample: 10, minimumDays: 7,
    });
    await handleSignalsRoute({
      ...propose, res: {} as any, experimentPlansPath: join(root, "plans.jsonl"),
      proposeExperiment: async () => { called = true; return { status: "no-experiment", reason: "unused", evidenceRefs: [] }; },
    } as any);
    assert.equal(propose.response()?.code, 409);
    assert.match(String((propose.response()?.value as any).error), /availablePublishingUnits.*required/i);
    assert.equal(called, false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Signals proposal endpoint records an honest no-experiment without creating a plan", async () => {
  const root = mkdtempSync(join(tmpdir(), "serve-signals-no-experiment-"));
  try {
    const propose = harness("POST", "/api/signals/experiments/propose", {
      contentRequestId: "content-one", evidenceDossierPath: "docs/reviews/reviewed.json", evidenceFamily: "conversation",
      minimumSample: 10, minimumDays: 7, availablePublishingUnits: 10, availableDays: 7,
    });
    await handleSignalsRoute({
      ...propose, res: {} as any, experimentPlansPath: join(root, "plans.jsonl"),
      proposeExperiment: async () => ({ status: "no-experiment", reason: "No useful bounded uncertainty.", evidenceRefs: ["evidence-1"] }),
    } as any);
    assert.equal(propose.response()?.code, 200);
    assert.equal((propose.response()?.value as any).result.status, "no-experiment");
    assert.deepEqual((propose.response()?.value as any).experimentPlans, []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Signals read exposes collecting and ready experiment evidence from the measurement loop", async () => {
  const root = mkdtempSync(join(tmpdir(), "serve-signals-performance-"));
  const read = harness("GET", "/api/signals");
  const experimentPerformance = {
    kind: "signals_experiment_performance", version: "signals-experiment-performance-v1",
    experiments: [{ experimentId: "ready", analysisStatus: "ready", blockers: [], autoWinner: false }],
    autoWinner: false, sideEffects: "none",
  };
  try {
    await handleSignalsRoute({
      ...read, res: {} as any,
      decisionsPath: join(root, "missing-signals-decisions"),
      proposalsPath: join(root, "missing-signals-proposals"),
      experimentPlansPath: join(root, "missing-signals-plans"),
      ventureHandoffsPath: join(root, "missing-venture-handoffs.jsonl"),
      readExperimentPerformance: () => experimentPerformance,
    } as any);
    assert.deepEqual((read.response()?.value as any).experimentPerformance, experimentPerformance);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Signals interpretation stays reviewable, persists the human decision, and never selects a winner", async () => {
  const root = mkdtempSync(join(tmpdir(), "serve-signals-interpretation-"));
  const resultsPath = join(root, "results.jsonl");
  try {
    const interpret = harness("POST", "/api/signals/experiments/experiment-one/interpret", { engine: "codex" });
    const proposal = {
      experimentId: "experiment-one", recommendation: "keep", rationale: "The primary metric improved and the guardrail held.",
      evidenceRefs: ["analytics:one"], confidence: "medium", caveats: ["Small sample."], autoWinner: false,
    };
    assert.equal(await handleSignalsRoute({
      ...interpret, res: {} as any, experimentResultsPath: resultsPath,
      interpretExperiment: async (id: string, engine: string) => ({ ...proposal, experimentId: id, engine }),
    } as any), true);
    assert.equal(interpret.response()?.code, 200);
    assert.equal((interpret.response()?.value as any).interpretation.recommendation, "keep");
    assert.equal((interpret.response()?.value as any).interpretation.autoWinner, false);
    assert.equal((interpret.response()?.value as any).interpretation.reviewStatus, "pending");

    const review = harness("POST", "/api/signals/experiments/experiment-one/interpretation/accept", { rationale: "I reviewed the evidence and caveats." });
    assert.equal(await handleSignalsRoute({ ...review, res: {} as any, experimentResultsPath: resultsPath } as any), true);
    assert.equal((review.response()?.value as any).interpretation.reviewStatus, "accepted");
    assert.equal((review.response()?.value as any).interpretation.recommendation, "keep");
    assert.equal((review.response()?.value as any).interpretation.winner, null);
    assert.equal((review.response()?.value as any).interpretation.autoWinner, false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
