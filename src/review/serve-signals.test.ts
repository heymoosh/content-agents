import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleSignalsRoute } from "./serve-signals.js";
import { appendSignalsDecision, readSignalsDecisions } from "./signals-decisions.js";
import { buildContentRequest } from "./content-request.js";
import { buildExperimentPlan } from "../grow/experiment-content-handoff.js";
import { signalsExperimentRecommendation } from "../grow/experiment-test-fixtures.js";
import { recordExperimentPlan } from "./signals-experiment-plan-store.js";

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
    assert.equal(await handleSignalsRoute({ ...read, res: {} as any, decisionsPath: ledger }), true);
    assert.deepEqual((read.response()?.value as any).decisions["TEST:Try the audit hook"].decision, "decline");
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
    await handleSignalsRoute({ ...read, res: {} as any, decisionsPath: join(root, "decisions"), proposalsPath: join(root, "changes"), experimentPlansPath: plansPath });
    assert.equal((read.response()?.value as any).experimentPlans[0].generatedCopyIncluded, false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
