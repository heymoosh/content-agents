import { type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { openDb, repoRoot } from "../db/db.js";
import { readSignals, readOutcomeFamilies, readResearchReport } from "./signals.js";
import { buildSignalsRecommendationRead } from "./signals-recommendations.js";
import { appendSignalsDecision, readSignalsDecisions, recommendationKey, type SignalsDecisionKind, type SignalsRecommendationType } from "./signals-decisions.js";
import { applySignalsProposal, proposeSignalsChange, readSignalsProposals, reconcileSignalsApplyIntents, reviewSignalsProposal, rollbackSignalsProposal } from "./signals-change-proposals.js";
import { applyApprovedExperimentToContent, approveExperimentPlan, assertExperimentPlanCanGenerate, type AppliedExperimentContentHandoff, type ExperimentPlan, type ExperimentPlanDecision } from "../grow/experiment-content-handoff.js";
import { buildLiveSignalsExperimentPerformance, buildSignalsExperimentInterpretationPrompt, type ExperimentAnalyticsObservation, type SignalsExperimentPerformanceRow } from "../grow/signals-experiment-performance.js";
import { loadExperimentPlan, loadExperimentPlanDecision, markExperimentContentHandoff, readExperimentPlans, readExperimentPlansForPerformance, recordExperimentPlan, reviewExperimentPlan } from "./signals-experiment-plan-store.js";
import { readExperimentInterpretations, recordExperimentInterpretation, reviewExperimentInterpretation, type ExperimentInterpretationInput } from "./signals-experiment-result-store.js";
import { isEngine, type Engine } from "./engines.js";
import { safeFolder } from "./rows.js";
import { readPublishingStatuses } from "./publishing-status.js";
import { buildOutcomeLedger, readOutcomeLedger } from "../grow/outcome-ledger.js";
import type { SignalsExperimentProposalRequest, SignalsExperimentProposalResult } from "./signals-experiment-proposal.js";
import { isBrandId } from "../identity/brand.js";

type SignalsRouteContext = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  readBody: (req: IncomingMessage) => Promise<Record<string, unknown>>;
  json: (res: ServerResponse, code: number, obj: unknown) => void;
  decisionsPath?: string;
  appendDecision?: typeof appendSignalsDecision;
  proposalsPath?: string;
  configRoot?: string;
  experimentPlansPath?: string;
  experimentResultsPath?: string;
  readExperimentPerformance?: () => unknown;
  interpretExperiment?: (id: string, engine: Engine) => Promise<ExperimentInterpretationInput & { readonly autoWinner?: false }>;
  applyExperimentPlan?: (plan: ExperimentPlan, decision: ExperimentPlanDecision) => Promise<AppliedExperimentContentHandoff>;
  proposeExperiment?: (input: SignalsExperimentProposalRequest) => Promise<SignalsExperimentProposalResult>;
};

function requiredPositiveInteger(value: unknown, field: string): number {
  if (value === undefined || value === null || value === "") throw new Error(`${field} is required`);
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${field} must be a positive integer`);
  return parsed;
}

function readLiveExperimentPerformance(experimentPlansPath?: string) {
  const plans = readExperimentPlansForPerformance(experimentPlansPath);
  if (plans.length === 0) return {
    kind: "signals_experiment_performance" as const, version: "signals-experiment-performance-v1" as const,
    experiments: [], autoWinner: false as const, sideEffects: "none" as const,
  };
  const publications = Object.values(readPublishingStatuses()).map((status) => ({
    slug: status.slug, rowId: status.rowId, state: status.state, providerObjectId: status.providerObjectId ?? status.ref ?? null,
    canonicalUrl: status.canonicalUrl ?? null, providerPublishedAt: status.providerPublishedAt ?? null,
    at: status.at, eventId: status.eventId ?? `legacy:${status.slug}/${status.rowId}:${status.at}`,
  }));
  const db = openDb();
  try {
    const analytics = db.prepare(`
      SELECT m.id, p.platform_post_id AS platformPostId, p.url, m.captured_at AS capturedAt,
             m.impressions, m.replies, m.clicks, m.new_follows AS newFollows
      FROM metrics m JOIN posts p ON p.id = m.post_id
    `).all() as ExperimentAnalyticsObservation[];
    const outcomePath = join(repoRoot, "data", "outcomes.jsonl");
    const outcomeLedger = existsSync(outcomePath) ? buildOutcomeLedger(readOutcomeLedger(outcomePath)) : null;
    return buildLiveSignalsExperimentPerformance({ plans, publications, analytics, outcomeLedger, now: new Date().toISOString() });
  } finally { db.close(); }
}

export function prepareLiveExperimentInterpretation(id: string, experimentPlansPath?: string): { row: SignalsExperimentPerformanceRow; prompt: string } {
  const row = readLiveExperimentPerformance(experimentPlansPath).experiments.find((item) => item.experimentId === id);
  if (!row) throw new Error(`unknown measurable experiment ${id}`);
  if (row.analysisStatus !== "ready") throw new Error(`experiment ${id} is not ready: ${row.blockers.join("; ")}`);
  return { row: row as SignalsExperimentPerformanceRow, prompt: buildSignalsExperimentInterpretationPrompt(row as SignalsExperimentPerformanceRow) };
}

// Signals stays split by its existing response contracts: signal summary, outcome families, and
// redacted research report remain separate reads; decisions are explicit append-only writes.
export async function handleSignalsRoute({ req, res, url, readBody, json, decisionsPath, appendDecision, proposalsPath, configRoot, experimentPlansPath, experimentResultsPath, readExperimentPerformance, interpretExperiment, applyExperimentPlan, proposeExperiment }: SignalsRouteContext): Promise<boolean> {
  // Signals room (design 3e): deterministic brief + durable user decisions. Muxin decides;
  // adoption records intent only and never mutates configuration or the repository backlog.
  if (req.method === "GET" && url.pathname === "/api/signals") {
    reconcileSignalsApplyIntents({ root: configRoot, path: proposalsPath });
    const decisions = readSignalsDecisions(decisionsPath);
    const signals = readSignals();
    json(res, 200, {
      ...signals,
      ...buildSignalsRecommendationRead(),
      decisions,
      recommendations: signals.recommendations.map((recommendation) => ({
        ...recommendation,
        decision: decisions[recommendationKey(recommendation.type, recommendation.title)]?.decision ?? null,
      })),
      changeProposals: readSignalsProposals(proposalsPath),
      experimentPlans: readExperimentPlans(experimentPlansPath),
      experimentPerformance: readExperimentPerformance?.() ?? readLiveExperimentPerformance(experimentPlansPath),
      experimentInterpretations: readExperimentInterpretations(experimentResultsPath),
    });
    return true;
  }
  if (req.method === "POST" && /^\/api\/signals\/experiments\/[^/]+\/interpret$/.test(url.pathname)) {
    const [, , , , encodedId] = url.pathname.split("/");
    const id = decodeURIComponent(encodedId);
    const body = await readBody(req);
    try {
      const engine = isEngine(body.engine) ? body.engine : "codex";
      if (!interpretExperiment) throw new Error("Signals experiment interpretation runner is unavailable");
      const result = await interpretExperiment(id, engine);
      if (result.experimentId !== id) throw new Error("Signals interpretation returned a different experiment id");
      const interpretation = recordExperimentInterpretation({ ...result, engine }, experimentResultsPath);
      json(res, 200, { ok: true, interpretation });
    } catch (e) {
      json(res, 409, { ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    return true;
  }
  if (req.method === "POST" && url.pathname === "/api/signals/experiments/propose") {
    const body = await readBody(req);
    try {
      if (!proposeExperiment) throw new Error("Signals experiment proposal runner is unavailable");
      const engine = body.engine === "claude" || body.engine === "grok" || body.engine === "codex" ? body.engine : "codex";
      const result = await proposeExperiment({
        contentRequestId: String(body.contentRequestId ?? "").trim(), engine,
        evidenceDossierPath: String(body.evidenceDossierPath ?? "").trim(),
        evidenceFamily: String(body.evidenceFamily ?? "") as SignalsExperimentProposalRequest["evidenceFamily"],
        minimumSample: Number(body.minimumSample ?? 10), minimumDays: Number(body.minimumDays ?? 7),
        availablePublishingUnits: requiredPositiveInteger(body.availablePublishingUnits, "availablePublishingUnits"),
        availableDays: requiredPositiveInteger(body.availableDays, "availableDays"),
      });
      if (result.status === "recommended") recordExperimentPlan(result.plan, experimentPlansPath);
      json(res, 200, { ok: true, result: result.status === "recommended" ? { status: result.status, experimentId: result.plan.recommendation.id } : result, experimentPlans: readExperimentPlans(experimentPlansPath) });
    } catch (e) {
      json(res, 409, { ok: false, error: e instanceof Error ? e.message : String(e), experimentPlans: readExperimentPlans(experimentPlansPath) });
    }
    return true;
  }
  if (req.method === "POST" && /^\/api\/signals\/experiments\/[^/]+\/interpretation\/(accept|reject)$/.test(url.pathname)) {
    const [, , , , encodedId, , action] = url.pathname.split("/");
    const id = decodeURIComponent(encodedId);
    const body = await readBody(req);
    try {
      const interpretation = reviewExperimentInterpretation(id, action === "accept" ? "accepted" : "rejected", String(body.rationale ?? ""), experimentResultsPath);
      json(res, 200, { ok: true, interpretation });
    } catch (e) {
      json(res, 409, { ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    return true;
  }
  if (req.method === "POST" && /^\/api\/signals\/experiments\/[^/]+\/(approve|decline|start)$/.test(url.pathname)) {
    const [, , , , encodedId, action] = url.pathname.split("/");
    const id = decodeURIComponent(encodedId);
    const body = await readBody(req);
    try {
      const plan = loadExperimentPlan(id, experimentPlansPath);
      let decision = loadExperimentPlanDecision(id, experimentPlansPath);
      if (action === "approve" || action === "decline") {
        if (decision) throw new Error(`experiment plan ${id} was already reviewed`);
        decision = approveExperimentPlan(plan, { status: action === "approve" ? "approved" : "declined", decidedBy: "muxin", decidedAt: new Date().toISOString(), rationale: String(body.rationale ?? "") });
        reviewExperimentPlan(id, decision, experimentPlansPath);
      }
      if (!decision || decision.status !== "approved") {
        json(res, 200, { ok: true, decision, experimentPlans: readExperimentPlans(experimentPlansPath) });
        return true;
      }
      assertExperimentPlanCanGenerate(plan);
      const apply = applyExperimentPlan ?? ((proposal, approved) => applyApprovedExperimentToContent(safeFolder(proposal.contentRequest.id), proposal, approved));
      const handoff = await apply(plan, decision);
      markExperimentContentHandoff(id, handoff, experimentPlansPath);
      json(res, 200, { ok: true, decision, handoff, experimentPlans: readExperimentPlans(experimentPlansPath) });
    } catch (e) {
      json(res, 409, { ok: false, error: e instanceof Error ? e.message : String(e), experimentPlans: readExperimentPlans(experimentPlansPath) });
    }
    return true;
  }
  // Card D: the four outcome families, grouped at read time out of data/analytics.db
  // (docs/venture-schema-contract.md §5.8). A separate route from /api/signals on purpose —
  // this is a different read with a different shape, and nothing merges the two into a score.
  if (req.method === "GET" && url.pathname === "/api/signals/outcomes") {
    const db = openDb();
    try {
      const requested = url.searchParams.get("brand") ?? url.searchParams.get("brandId") ?? undefined;
      if (requested === undefined) {
        json(res, 400, { ok: false, error: "brand is required" });
        return true;
      }
      if (!isBrandId(requested)) {
        json(res, 400, { ok: false, error: "brand must be one of human-inference, charles, fiction" });
        return true;
      }
      json(res, 200, readOutcomeFamilies(db, { brandId: requested }));
    } finally {
      db.close();
    }
    return true;
  }
  // The redacted account-level research read (contract §5.4b), until now unreachable from the
  // GUI. Aggregate counts and redacted text only; degrades to an honest empty read, never zeros.
  if (req.method === "GET" && url.pathname === "/api/research/report") {
    const requested = url.searchParams.get("brand") ?? url.searchParams.get("brandId") ?? undefined;
    if (requested === undefined) {
      json(res, 400, { ok: false, error: "brand is required" });
      return true;
    }
    if (!isBrandId(requested)) {
      json(res, 400, { ok: false, error: "brand must be one of human-inference, charles, fiction" });
      return true;
    }
    const db = openDb();
    try {
      json(res, 200, readResearchReport(db, { brandId: requested }));
    } finally {
      db.close();
    }
    return true;
  }
  if (req.method === "POST" && (url.pathname === "/api/signals/decision" || url.pathname === "/api/signals/decisions")) {
    const b = await readBody(req);
    const decision = String(b.decision ?? b.action ?? "").trim() as SignalsDecisionKind;
    const type = String(b.type ?? "").trim() as SignalsRecommendationType;
    const title = String(b.title ?? "").trim();
    const rationale = String(b.rationale ?? b.detail ?? "").trim();
    if (!["adopt", "decline"].includes(decision) || !["DO MORE", "TEST", "DO LESS"].includes(type) || !title || !rationale) {
      json(res, 400, { ok: false, error: "a Signals decision needs a valid action, type, title, and rationale" });
      return true;
    }
    const date = new Date().toISOString();
    const recorded = { decision, type, title, rationale, date };
    try {
      // Adoption is durable intent, not permission to mutate config or the repository backlog.
      // The append-only decision ledger is the source for later, explicitly authorized work.
      (appendDecision ?? appendSignalsDecision)(recorded, decisionsPath);
      const proposal = decision === "adopt"
        ? proposeSignalsChange({ type, title, rationale, actor: "muxin" }, { root: configRoot, path: proposalsPath })
        : null;
      json(res, 200, { ok: true, decision: recorded, proposal });
    } catch (e) {
      json(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    return true;
  }
  if (req.method === "POST" && /^\/api\/signals\/proposals\/[^/]+\/(approve|reject|apply|rollback)$/.test(url.pathname)) {
    const [, , , , id, action] = url.pathname.split("/");
    const b = await readBody(req);
    try {
      const proposal = action === "approve" || action === "reject"
        ? reviewSignalsProposal(id, action, String(b.evidence ?? ""), "muxin", { path: proposalsPath })
        : action === "apply"
          ? applySignalsProposal(id, "muxin", { root: configRoot, path: proposalsPath })
          : rollbackSignalsProposal(id, String(b.evidence ?? ""), "muxin", { root: configRoot, path: proposalsPath });
      json(res, 200, { ok: true, proposal });
    } catch (e) { json(res, 409, { ok: false, error: e instanceof Error ? e.message : String(e) }); }
    return true;
  }
  return false;
}
