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
import { loadExperimentInterpretation, readExperimentInterpretations, recordExperimentInterpretation, reviewExperimentInterpretation, type ExperimentInterpretationInput } from "./signals-experiment-result-store.js";
import { isEngine, type Engine } from "./engines.js";
import { safeFolder } from "./rows.js";
import { readPublishingStatuses } from "./publishing-status.js";
import { buildOutcomeLedger, readOutcomeLedger } from "../grow/outcome-ledger.js";
import type { SignalsExperimentProposalRequest, SignalsExperimentProposalResult } from "./signals-experiment-proposal.js";
import { isBrandId, type BrandId } from "../identity/brand.js";
import { readSignalsVentureProposals, recordSignalsVentureDecision, recordSignalsVentureProposal, signalsVentureProposalId, type SignalsVentureDecision } from "./signals-venture-handoff-store.js";
import { readCanonEvents } from "../venture/canon.js";
import { computeState } from "../venture/state.js";

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
  ventureHandoffsPath?: string;
  readVentureState?: (slug: string) => { current_phase: number };
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

function requestedBrand(url: URL): BrandId | null {
  const value = url.searchParams.get("brand") ?? url.searchParams.get("brandId");
  return isBrandId(value) ? value : null;
}

function bodyBrand(body: Record<string, unknown>): BrandId {
  const value = body.brand ?? body.brandId;
  if (!isBrandId(value)) throw new Error("brand is required and must be one of human-inference, charles, fiction");
  return value;
}

function readLiveExperimentPerformance(experimentPlansPath?: string) {
  const plans = readExperimentPlansForPerformance(experimentPlansPath);
  if (plans.length === 0) return {
    kind: "signals_experiment_performance" as const, version: "signals-experiment-performance-v1" as const,
    experiments: [], autoWinner: false as const, sideEffects: "none" as const,
  };
  const planBrands = new Map(plans.map((plan) => [plan.contentRequest.id, plan.brandId]));
  const publications = Object.values(readPublishingStatuses()).map((status) => ({
    slug: status.slug, rowId: status.rowId, state: status.state, brandId: planBrands.get(status.slug) ?? null, providerObjectId: status.providerObjectId ?? status.ref ?? null, providerAccountId: status.providerAccountId ?? null,
    canonicalUrl: status.canonicalUrl ?? null, providerPublishedAt: status.providerPublishedAt ?? null,
    at: status.at, eventId: status.eventId ?? `legacy:${status.slug}/${status.rowId}:${status.at}`,
  }));
  const db = openDb();
  try {
    const analytics = db.prepare(`
      SELECT m.id, p.platform_post_id AS platformPostId, p.url, p.brand_id AS brandId, p.provider_account_id AS providerAccountId, m.captured_at AS capturedAt,
             m.impressions, m.replies, m.clicks, m.new_follows AS newFollows
      FROM metrics m JOIN posts p ON p.id = m.post_id
      WHERE p.brand_id IS NOT NULL
        AND m.brand_id = p.brand_id
        AND m.provider_account_id = p.provider_account_id
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
export async function handleSignalsRoute({ req, res, url, readBody, json, decisionsPath, appendDecision, proposalsPath, configRoot, experimentPlansPath, experimentResultsPath, ventureHandoffsPath, readVentureState, readExperimentPerformance, interpretExperiment, applyExperimentPlan, proposeExperiment }: SignalsRouteContext): Promise<boolean> {
  // Signals room (design 3e): deterministic brief + durable user decisions. Muxin decides;
  // adoption records intent only and never mutates configuration or the repository backlog.
  if (req.method === "GET" && url.pathname === "/api/signals") {
    const brand = requestedBrand(url);
    if (!brand) { json(res, 400, { ok: false, error: "brand is required and must be one of human-inference, charles, fiction" }); return true; }
    reconcileSignalsApplyIntents({ root: configRoot, path: proposalsPath });
    const decisions = Object.fromEntries(Object.entries(readSignalsDecisions(decisionsPath)).filter(([, decision]) => decision.brandId === brand));
    const signals = readSignals(brand);
    json(res, 200, {
      ...signals,
      ...buildSignalsRecommendationRead(brand),
      decisions,
      recommendations: signals.recommendations.map((recommendation) => ({
        ...recommendation,
        decision: decisions[recommendationKey(recommendation.type, recommendation.title, brand)]?.decision ?? null,
      })),
      changeProposals: readSignalsProposals(proposalsPath).filter((proposal) => proposal.brandId === brand),
      experimentPlans: readExperimentPlans(experimentPlansPath).filter((plan) => plan.brandId === brand),
      experimentPerformance: (() => { const value = (readExperimentPerformance?.() ?? readLiveExperimentPerformance(experimentPlansPath)) as { experiments?: readonly { brandId?: BrandId | null }[]; [key: string]: unknown }; return { ...value, experiments: (value.experiments ?? []).filter((item) => item.brandId === brand) }; })(),
      experimentInterpretations: readExperimentInterpretations(experimentResultsPath).filter((item) => item.brandId === brand),
      // A missing/unavailable optional handoff ledger is an honest empty read, like the other
      // Signals projections. It must not make the core Signals room fail to load.
      ventureHandoffs: readSignalsVentureProposals(ventureHandoffsPath).map((proposal) => {
        const decision = readCanonEvents(proposal.ventureSlug).find((event) => event.type === "signals-input-decision" && event.id === `${proposal.ventureSlug}/signals-input/${proposal.id}`);
        return { ...proposal, ventureDecision: decision ? { outcome: decision.fields.outcome, decidedAt: decision.at, decisionRef: decision.fields.decision_ref } : null };
      }),
    });
    return true;
  }
  if (req.method === "POST" && /^\/api\/signals\/venture-handoff\/[^/]+\/decision$/.test(url.pathname)) {
    const [, , , , encodedId] = url.pathname.split("/");
    const id = decodeURIComponent(encodedId);
    const body = await readBody(req);
    try {
      const decision = String(body.decision ?? "") as SignalsVentureDecision;
      const proposal = recordSignalsVentureDecision(id, decision, String(body.rationale ?? ""), ventureHandoffsPath);
      json(res, 200, { ok: true, proposal, openVenture: proposal.ventureSlug });
    } catch (e) {
      json(res, 409, { ok: false, error: e instanceof Error ? e.message : String(e), ventureHandoffs: readSignalsVentureProposals(ventureHandoffsPath) });
    }
    return true;
  }
  if (req.method === "POST" && /^\/api\/signals\/experiments\/[^/]+\/interpret$/.test(url.pathname)) {
    const [, , , , encodedId] = url.pathname.split("/");
    const id = decodeURIComponent(encodedId);
    const body = await readBody(req);
    try {
      const brand = bodyBrand(body);
      const engine = body.engine === "claude" || body.engine === "grok" || body.engine === "codex" ? body.engine : "codex";
      if (!interpretExperiment) throw new Error("Signals experiment interpretation runner is unavailable");
      const result = await interpretExperiment(id, engine);
      if (result.experimentId !== id) throw new Error("Signals interpretation returned a different experiment id");
      const plan = loadExperimentPlan(id, experimentPlansPath);
      if (plan.brandId !== brand) throw new Error("Signals interpretation brand does not match the experiment Content request");
      const interpretation = recordExperimentInterpretation({ ...result, engine, brandId: plan.brandId ?? undefined }, experimentResultsPath);
      json(res, 200, { ok: true, interpretation });
    } catch (e) {
      json(res, 409, { ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    return true;
  }
  if (req.method === "POST" && url.pathname === "/api/signals/experiments/propose") {
    const body = await readBody(req);
    try {
      const brand = bodyBrand(body);
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
      if (result.status === "recommended") {
        if (result.plan.brandId !== brand) throw new Error("Signals experiment brand does not match the Content request");
        recordExperimentPlan(result.plan, experimentPlansPath);
      }
      json(res, 200, { ok: true, result: result.status === "recommended" ? { status: result.status, experimentId: result.plan.recommendation.id } : result, experimentPlans: readExperimentPlans(experimentPlansPath) });
    } catch (e) {
      json(res, 409, { ok: false, error: e instanceof Error ? e.message : String(e), experimentPlans: readExperimentPlans(experimentPlansPath) });
    }
    return true;
  }
  if (req.method === "POST" && /^\/api\/signals\/experiments\/[^/]+\/venture-handoff\/propose$/.test(url.pathname)) {
    const [, , , , encodedId] = url.pathname.split("/");
    const id = decodeURIComponent(encodedId);
    const body = await readBody(req);
    try {
      const ventureSlug = String(body.ventureSlug ?? "").trim();
      const phase = Number(body.phase);
      if (!ventureSlug || !Number.isInteger(phase) || phase < 1) throw new Error("named ventureSlug and positive phase are required");
      const ventureState = (readVentureState ?? computeState)(ventureSlug);
      if (ventureState.current_phase !== phase) throw new Error(`Venture ${ventureSlug} is in phase ${ventureState.current_phase}, not phase ${phase}`);
      const plan = loadExperimentPlan(id, experimentPlansPath);
      const interpretation = loadExperimentInterpretation(id, experimentResultsPath);
      if (interpretation.reviewStatus !== "accepted") throw new Error("an accepted experiment interpretation is required");
      if (interpretation.recommendation === "reject") throw new Error("a rejected experiment interpretation cannot become a Venture input");
      const performance = (readExperimentPerformance?.() ?? readLiveExperimentPerformance(experimentPlansPath)) as { experiments?: SignalsExperimentPerformanceRow[] };
      const row = performance.experiments?.find((item) => item.experimentId === id);
      if (!row || row.analysisStatus !== "ready") throw new Error("a ready measured performance row is required");
      const family = row.primaryMetric.family;
      if (!row.outcomeRefs.length || !row.primaryComparison?.treatment || !row.primaryComparison.control) throw new Error("both measured arms and evidence references are required");
      const generated = readExperimentPlans(experimentPlansPath).find((item) => item.experimentId === id)?.generatedIds ?? [];
      const expectedVariants = plan.contentRequest.variants.map((variant) => variant.identity.id).sort();
      if (generated.length !== expectedVariants.length || [...generated].sort().some((variantId, index) => variantId !== expectedVariants[index])) {
        throw new Error("the exact experiment Content handoff variants are required");
      }
      if (row.primaryComparison.treatment.variantId !== plan.recommendation.expectedOutcome.variantId
        || row.primaryComparison.control.variantId !== plan.recommendation.expectedOutcome.comparisonRef) {
        throw new Error("measured treatment/control variant lineage does not match the experiment plan");
      }
      const attributedTreatment = row.primaryOutcomeRefs?.treatment.filter((ref) => ref.startsWith("outcome:")) ?? [];
      const attributedControl = row.primaryOutcomeRefs?.control.filter((ref) => ref.startsWith("outcome:")) ?? [];
      const attributedBothArms = attributedTreatment.length > 0 && attributedControl.length > 0;
      const evidenceTier = family === "business" && attributedBothArms ? "business"
        : family === "audience" && attributedBothArms ? "funnel"
          : "controlled";
      const claimCeiling = evidenceTier === "business" ? "observed-demand"
        : evidenceTier === "funnel" ? "behavioral-intent"
          : "bounded-comparison";
      const measuredRefs = [...new Set([
        ...interpretation.evidenceRefs,
        ...(row.primaryOutcomeRefs?.treatment ?? []),
        ...(row.primaryOutcomeRefs?.control ?? []),
        ...row.outcomeRefs,
      ])];
      const proposal = recordSignalsVentureProposal({
        id: signalsVentureProposalId(id, ventureSlug, phase), ventureSlug, phase, sourceId: plan.contentRequest.id,
        variantId: row.primaryComparison.treatment.variantId, experimentId: id, title: plan.recommendation.hypothesis,
        factualSummary: `${row.primaryMetric.metric} was measured across both experiment arms.`, proposedInput: interpretation.rationale,
        rationale: interpretation.rationale, confidence: interpretation.confidence,
        evidenceRefs: measuredRefs,
        inputKind: evidenceTier, evidenceTier, claimCeiling, contentItemRefs: generated,
        scope: plan.contentRequest.id, sampleSize: { treatment: row.primaryComparison.treatment.sample, control: row.primaryComparison.control.sample },
        provenance: { planDigest: plan.digest, interpretationId: interpretation.id }, caveats: [...interpretation.caveats], qualification: "qualified", evidenceStatus: "measured",
      }, ventureHandoffsPath);
      json(res, 200, { ok: true, proposal });
    } catch (e) { json(res, 409, { ok: false, error: e instanceof Error ? e.message : String(e) }); }
    return true;
  }
  if (req.method === "POST" && /^\/api\/signals\/experiments\/[^/]+\/interpretation\/(accept|reject)$/.test(url.pathname)) {
    const [, , , , encodedId, , action] = url.pathname.split("/");
    const id = decodeURIComponent(encodedId);
    const body = await readBody(req);
    try {
      const brand = bodyBrand(body);
      const interpretation = reviewExperimentInterpretation(id, action === "accept" ? "accepted" : "rejected", String(body.rationale ?? ""), experimentResultsPath);
      if (interpretation.brandId !== brand) throw new Error("Signals interpretation brand does not match caller scope");
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
      const brand = bodyBrand(body);
      const plan = loadExperimentPlan(id, experimentPlansPath);
      if (plan.brandId !== brand) throw new Error("Signals experiment brand does not match the Content request");
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
    let brand: BrandId;
    try { brand = bodyBrand(b); } catch (e) { json(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) }); return true; }
    const decision = String(b.decision ?? b.action ?? "").trim() as SignalsDecisionKind;
    const type = String(b.type ?? "").trim() as SignalsRecommendationType;
    const title = String(b.title ?? "").trim();
    const rationale = String(b.rationale ?? b.detail ?? "").trim();
    if (!["adopt", "decline"].includes(decision) || !["DO MORE", "TEST", "DO LESS"].includes(type) || !title || !rationale) {
      json(res, 400, { ok: false, error: "a Signals decision needs a valid action, type, title, and rationale" });
      return true;
    }
    const date = new Date().toISOString();
    const recorded = { decision, type, title, rationale, date, brandId: brand };
    try {
      // Adoption is durable intent, not permission to mutate config or the repository backlog.
      // The append-only decision ledger is the source for later, explicitly authorized work.
      (appendDecision ?? appendSignalsDecision)(recorded, decisionsPath);
      const proposal = decision === "adopt"
        ? proposeSignalsChange({ type, title, rationale, actor: "muxin", brandId: brand }, { root: configRoot, path: proposalsPath })
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
      const brand = bodyBrand(b);
      const existing = readSignalsProposals(proposalsPath).find((item) => item.id === id);
      if (!existing || existing.brandId !== brand) throw new Error("Signals proposal brand does not match caller scope");
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
