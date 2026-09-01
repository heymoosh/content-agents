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
import { recordExperimentPlan, reviewExperimentPlan } from "./signals-experiment-plan-store.js";

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
    const h = harness("POST", "/api/signals/decision", { brand: "human-inference", decision: "decline", type: "TEST", title: "Try the audit hook", rationale: "Not this cycle" });
    assert.equal(await handleSignalsRoute({ ...h, res: {} as any, decisionsPath: ledger }), true);
    assert.equal(h.response()?.code, 200);
    assert.equal(readSignalsDecisions(ledger)["human-inference:TEST:Try the audit hook"].decision, "decline");
    const read = harness("GET", "/api/signals?brand=human-inference");
    assert.equal(await handleSignalsRoute({ ...read, res: {} as any, decisionsPath: ledger, proposalsPath: join(root, "proposals"), experimentPlansPath: join(root, "plans") }), true);
    assert.deepEqual((read.response()?.value as any).decisions["human-inference:TEST:Try the audit hook"].decision, "decline");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("adopt records a decision without mutating the repository backlog", async () => {
  const root = mkdtempSync(join(tmpdir(), "serve-signals-"));
  const ledger = join(root, "signals.jsonl");
  try {
    const proposals = join(root, "proposals.jsonl");
    const h = harness("POST", "/api/signals/decision", { brand: "human-inference", action: "adopt", type: "DO MORE", title: "Use notes", rationale: "They travel" });
    assert.equal(await handleSignalsRoute({ ...h, res: {} as any, decisionsPath: ledger, proposalsPath: proposals }), true);
    assert.equal(h.response()?.code, 200);
    assert.doesNotMatch(readFileSync(new URL("./serve-signals.ts", import.meta.url), "utf8"), /appendBacklog|appendBacklogCard/);
    assert.equal(readSignalsDecisions(ledger)["human-inference:DO MORE:Use notes"].decision, "adopt");
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
    const adopt = harness("POST", "/api/signals/decision", { brand: "human-inference", decision: "adopt", type: "TEST", title: "Set linkedin cadence to 5 posts/week", rationale: "Measured fatigue" });
    await handleSignalsRoute({ ...adopt, res: {} as any, decisionsPath: join(root, "decisions"), proposalsPath, configRoot: root });
    const id = (adopt.response()?.value as any).proposal.id;
    const approve = harness("POST", `/api/signals/proposals/${id}/approve`, { brand: "human-inference", evidence: "Muxin checked the exact delta" });
    await handleSignalsRoute({ ...approve, res: {} as any, proposalsPath, configRoot: root });
    assert.equal((approve.response()?.value as any).proposal.status, "approved");
    assert.match(readFileSync(join(root, "config/platforms.yaml"), "utf8"), /posts_per_week: 7/);
    const apply = harness("POST", `/api/signals/proposals/${id}/apply`, { brand: "human-inference" });
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
    const approve = harness("POST", "/api/signals/experiments/experiment-one/approve", { brand: "human-inference" });
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
    const read = harness("GET", "/api/signals?brand=human-inference");
    await handleSignalsRoute({ ...read, res: {} as any, decisionsPath: join(root, "decisions"), proposalsPath: join(root, "changes"), experimentPlansPath: plansPath });
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
    const start = harness("POST", "/api/signals/experiments/legacy-capacity/start", { brand: "human-inference" });
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
      brand: "human-inference",
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
      brand: "human-inference",
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
      brand: "human-inference",
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
  const read = harness("GET", "/api/signals?brand=human-inference");
  const experimentPerformance = {
    kind: "signals_experiment_performance", version: "signals-experiment-performance-v1",
    experiments: [{ experimentId: "ready", brandId: "human-inference", analysisStatus: "ready", blockers: [], autoWinner: false }],
    autoWinner: false, sideEffects: "none",
  };
  await handleSignalsRoute({
    ...read, res: {} as any,
    decisionsPath: join(tmpdir(), "missing-signals-decisions"),
    proposalsPath: join(tmpdir(), "missing-signals-proposals"),
    experimentPlansPath: join(tmpdir(), "missing-signals-plans"),
    readExperimentPerformance: () => experimentPerformance,
  } as any);
  assert.deepEqual((read.response()?.value as any).experimentPerformance, experimentPerformance);
});

test("Signals interpretation stays reviewable, persists the human decision, and never selects a winner", async () => {
  const root = mkdtempSync(join(tmpdir(), "serve-signals-interpretation-"));
  const resultsPath = join(root, "results.jsonl");
  const plansPath = join(root, "plans.jsonl");
  try {
    const contentInput = { id: "interpretation-content", origin: "human-inference" as const, descriptor: "experiment", originalInput: "Source.", treatments: ["summary"], media: ["none"], platforms: ["linkedin"], sourceProvenance: { kind: "source" as const, sourceLines: [1] } };
    const request = buildContentRequest(contentInput);
    const variantId = request.variants.find((variant) => variant.identity.kind === "treated")!.identity.id;
    const comparisonRef = request.variants.find((variant) => variant.identity.kind === "control")!.identity.id;
    recordExperimentPlan(buildExperimentPlan({
      recommendation: { ...signalsExperimentRecommendation({ variantId, comparisonRef }), id: "experiment-one", confidence: "high" },
      contentRequest: contentInput,
      variablesByVariant: Object.fromEntries(request.variants.map((variant) => [variant.identity.id, { opening: variant.identity.kind }])),
      capacity: { availablePublishingUnits: 10, availableDays: 7 },
    }), plansPath);
    const interpret = harness("POST", "/api/signals/experiments/experiment-one/interpret", { brand: "human-inference", engine: "codex" });
    const proposal = {
      experimentId: "experiment-one", recommendation: "keep", rationale: "The primary metric improved and the guardrail held.",
      evidenceRefs: ["analytics:one"], confidence: "medium", caveats: ["Small sample."], autoWinner: false,
    };
    assert.equal(await handleSignalsRoute({
      ...interpret, res: {} as any, experimentPlansPath: plansPath, experimentResultsPath: resultsPath,
      interpretExperiment: async (id: string, engine: string) => ({ ...proposal, experimentId: id, engine }),
    } as any), true);
    assert.equal(interpret.response()?.code, 200);
    assert.equal((interpret.response()?.value as any).interpretation.recommendation, "keep");
    assert.equal((interpret.response()?.value as any).interpretation.autoWinner, false);
    assert.equal((interpret.response()?.value as any).interpretation.reviewStatus, "pending");

    const review = harness("POST", "/api/signals/experiments/experiment-one/interpretation/accept", { brand: "human-inference", rationale: "I reviewed the evidence and caveats." });
    assert.equal(await handleSignalsRoute({ ...review, res: {} as any, experimentResultsPath: resultsPath } as any), true);
    assert.equal((review.response()?.value as any).interpretation.reviewStatus, "accepted");
    assert.equal((review.response()?.value as any).interpretation.recommendation, "keep");
    assert.equal((review.response()?.value as any).interpretation.winner, null);
    assert.equal((review.response()?.value as any).interpretation.autoWinner, false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
