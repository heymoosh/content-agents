import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { existsSync } from "node:fs";
import { readArtifact, readArtifacts } from "../venture/artifacts.js";
import { readDecisions } from "../venture/decisions.js";
import { readCanonEvents } from "../venture/canon.js";
import { readResponse } from "../venture/responses.js";
import { computeState } from "../venture/state.js";
import { ventureDir } from "../venture/paths.js";
import { openDb } from "../db/db.js";
import {
  loadLearningEvaluation,
  readLearningEvaluations,
  recordLearningEvaluation,
  recordLearningEvaluationDecision,
  type LearningEvaluation,
  type LearningEvaluationDecision,
  type LearningEvaluationInput,
} from "../venture/learning-evaluation.js";
import type { Engine } from "./engines.js";
import {
  receiptFromAcceptedSignalsInput,
  receiptFromResearchObservation,
  receiptFromResponse,
  type ResearchObservationLike,
} from "./venture-learning-receipt.js";
import type {
  VentureLearningContext,
  VentureLearningEvaluation,
  VentureLearningReceipt,
} from "./venture-learning-evaluator.js";
import {
  proposeVentureLearningExperiment,
  type VentureLearningExperimentRequest,
  type VentureLearningExperimentResult,
} from "./venture-learning-experiment-proposal.js";
import { recordVentureExperimentPlan } from "./signals-experiment-plan-store.js";

type Context = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  readBody: (req: IncomingMessage) => Promise<Record<string, unknown>>;
  json: (res: ServerResponse, code: number, obj: unknown) => void;
  evaluateLearning?: (receipt: VentureLearningReceipt, context: VentureLearningContext, engine: Engine) => Promise<VentureLearningEvaluation>;
  proposeExperiment?: (input: VentureLearningExperimentRequest) => Promise<VentureLearningExperimentResult>;
  receiptFor?: (slug: string, source: "signals-input" | "response" | "research-observation", id: string) => VentureLearningReceipt;
  listSources?: (slug: string) => VentureLearningReceipt[];
  contextFor?: (slug: string) => VentureLearningContext;
  listEvaluations?: (slug: string) => LearningEvaluation[];
  recordEvaluation?: (input: LearningEvaluationInput) => LearningEvaluation;
  decideEvaluation?: (slug: string, id: string, decision: LearningEvaluationDecision, rationale: string) => LearningEvaluation;
  loadEvaluation?: (slug: string, id: string) => LearningEvaluation;
  recordExperiment?: typeof recordVentureExperimentPlan;
};

const SAFE = /^[a-z0-9][\w-]*$/;
function required(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  return value.trim();
}

/** Bounded server-derived Venture context. It includes current artifacts and decisions, never raw response records. */
export function buildVentureLearningContext(slug: string): VentureLearningContext {
  const artifacts = readArtifacts(slug);
  const refs: VentureLearningContext["refs"] = artifacts.map((artifact) => {
    return {
      id: `artifact:${artifact.artifact_id}`,
      kind: artifact.artifact_kind,
      summary: `${artifact.title}; phase ${artifact.phase}; editorial status ${artifact.editorial_status}`,
    };
  });
  for (const decision of readDecisions(slug)) {
    const selected = new Set(decision.selected_candidate_ids);
    refs.push({
      id: `decision:${decision.decision_id}`,
      kind: decision.decision_kind,
      summary: decision.candidates.map((candidate) => `${selected.has(candidate.candidate_id) ? "selected" : "candidate"}: ${candidate.label}`).join(" | "),
    });
  }
  const namedHypotheses = refs.filter((ref) => /hypoth|problem|offer|product|lead/i.test(`${ref.kind} ${ref.summary}`)).map((ref) => ({ id: ref.id, summary: ref.summary }));
  return { namedHypotheses, refs };
}

function activeResearchRows(id?: string): ResearchObservationLike[] {
  const db = openDb();
  try {
    const whereId = id ? " AND observation_id = ?" : "";
    return db.prepare(`SELECT observation_id, source, source_platform, surface, content_item_id, observed_at,
      redacted_text, behavioral_action, metric_name, metric_value, previous_value, delta,
      window_start, window_end, collected_at
      FROM research_observations
      WHERE superseded_by IS NULL AND deleted_at IS NULL AND is_creator_observation = 0
        AND source IN ('metric','subscriber_movement','comment','reply','dm','email','follow_up_question')${whereId}
      ORDER BY COALESCE(collected_at, observed_at) DESC, observation_id DESC${id ? "" : " LIMIT 50"}`)
      .all(...(id ? [id] : [])) as ResearchObservationLike[];
  } finally { db.close(); }
}

export function listResearchLearningReceipts(slug: string): VentureLearningReceipt[] {
  const phase = computeState(slug).current_phase;
  return activeResearchRows().flatMap((row) => {
    try { return [receiptFromResearchObservation(slug, phase, row)]; } catch { return []; }
  });
}

function defaultReceipt(slug: string, source: "signals-input" | "response" | "research-observation", id: string): VentureLearningReceipt {
  const phase = computeState(slug).current_phase;
  if (source === "signals-input") {
    const artifact = readArtifact(slug, id);
    if (!artifact) throw new Error(`unknown accepted Signals input ${id}`);
    const pointer = typeof artifact.fields?.pointer_id === "string" ? artifact.fields.pointer_id : "";
    const canon = readCanonEvents(slug).find((event) => event.id === `${slug}/signals-input/${pointer}` && event.type === "signals-input-decision");
    const fingerprint = typeof canon?.fields.fingerprint === "string" ? canon.fields.fingerprint : undefined;
    if (!fingerprint) throw new Error(`accepted Signals input ${id} has no matching canon fingerprint`);
    return receiptFromAcceptedSignalsInput(artifact, fingerprint);
  }
  if (source === "research-observation") {
    const rows = activeResearchRows(id);
    if (rows.length !== 1) throw new Error(`unknown active research observation ${id}`);
    return receiptFromResearchObservation(slug, phase, rows[0]!);
  }
  const response = readResponse(slug, id);
  if (!response) throw new Error(`unknown Venture response ${id}`);
  return receiptFromResponse(slug, phase, response);
}

function evaluationId(receipt: VentureLearningReceipt, context: VentureLearningContext, engine: Engine): string {
  return `learning-evaluation-${createHash("sha256").update(JSON.stringify({ receipt, context, engine })).digest("hex").slice(0, 24)}`;
}

/** Async Venture learning routes. Recommendations are generated read-only and remain pending until Muxin decides. */
export async function handleVentureLearningRoute(options: Context): Promise<boolean> {
  const { req, res, url, readBody, json } = options;
  const readMatch = /^\/api\/venture\/([^/]+)\/learning-evaluations$/.exec(url.pathname);
  const sourcesMatch = /^\/api\/venture\/([^/]+)\/learning-sources$/.exec(url.pathname);
  const evaluateMatch = /^\/api\/venture\/([^/]+)\/learning\/(signals-input|response|research-observation)\/([^/]+)\/evaluate$/.exec(url.pathname);
  const decisionMatch = /^\/api\/venture\/([^/]+)\/learning-evaluations\/([^/]+)\/decision$/.exec(url.pathname);
  const experimentMatch = /^\/api\/venture\/([^/]+)\/learning-evaluations\/([^/]+)\/experiment\/propose$/.exec(url.pathname);
  const match = readMatch ?? sourcesMatch ?? evaluateMatch ?? decisionMatch ?? experimentMatch;
  if (!match) return false;
  const slug = match[1]!;
  if (!SAFE.test(slug)) { json(res, 400, { ok: false, error: "bad venture slug" }); return true; }
  if (!existsSync(ventureDir(slug))) { json(res, 404, { ok: false, error: `no such venture: ${slug}` }); return true; }
  if (req.method === "GET" && readMatch) {
    json(res, 200, { ok: true, evaluations: (options.listEvaluations ?? readLearningEvaluations)(slug) });
    return true;
  }
  if (req.method === "GET" && sourcesMatch) {
    json(res, 200, { ok: true, sources: (options.listSources ?? listResearchLearningReceipts)(slug) });
    return true;
  }
  if (req.method !== "POST") return false;
  try {
    const body = await readBody(req);
    if (evaluateMatch) {
      const source = evaluateMatch[2]! as "signals-input" | "response" | "research-observation";
      const id = decodeURIComponent(evaluateMatch[3]!);
      if (!SAFE.test(id)) throw new Error("bad learning source id");
      const engine = body.engine === "claude" || body.engine === "grok" || body.engine === "codex" ? body.engine : "codex";
      if (!options.evaluateLearning) throw new Error("Venture learning evaluator is unavailable");
      const receipt = (options.receiptFor ?? defaultReceipt)(slug, source, id);
      const context = (options.contextFor ?? buildVentureLearningContext)(slug);
      const result = await options.evaluateLearning(receipt, context, engine);
      const evaluation = (options.recordEvaluation ?? recordLearningEvaluation)({
        evaluationId: evaluationId(receipt, context, engine), ventureSlug: slug, inputRef: receipt.id,
        evidenceTier: receipt.evidenceTier, claimCeiling: receipt.claimCeiling,
        recommendation: result.recommendation, target: result.target, rationale: result.rationale,
        proposedChange: result.proposedChange, evidenceRefs: [...result.evidenceRefs], affectedRefs: [...result.affectedRefs],
        caveats: [...new Set([...receipt.caveats, ...result.caveats])], engine: result.provenance.engine,
      });
      json(res, 200, { ok: true, evaluation });
      return true;
    }
    if (decisionMatch) {
      const id = decodeURIComponent(decisionMatch[2]!);
      if (!SAFE.test(id)) throw new Error("bad evaluation id");
      const decision = required(body.decision, "decision") as LearningEvaluationDecision;
      const rationale = required(body.rationale, "rationale");
      const evaluation = (options.decideEvaluation ?? recordLearningEvaluationDecision)(slug, id, decision, rationale);
      json(res, 200, { ok: true, evaluation });
      return true;
    }
    if (experimentMatch) {
      const id = decodeURIComponent(experimentMatch[2]!);
      if (!SAFE.test(id)) throw new Error("bad evaluation id");
      const engine = body.engine === "claude" || body.engine === "grok" || body.engine === "codex" ? body.engine : "codex";
      const input: VentureLearningExperimentRequest = {
        ventureSlug: slug, evaluationId: id, contentRequestId: required(body.contentRequestId, "contentRequestId"), engine,
        evidenceFamily: required(body.evidenceFamily, "evidenceFamily") as VentureLearningExperimentRequest["evidenceFamily"],
        minimumSample: Number(body.minimumSample), minimumDays: Number(body.minimumDays),
        availablePublishingUnits: Number(body.availablePublishingUnits), availableDays: Number(body.availableDays),
      };
      const result = options.proposeExperiment
        ? await options.proposeExperiment(input)
        : await proposeVentureLearningExperiment(input, async () => { throw new Error("Venture Experiment planner is unavailable"); });
      if (result.status === "recommended") (options.recordExperiment ?? recordVentureExperimentPlan)(result.envelope);
      json(res, 200, { ok: true, result: result.status === "recommended" ? { status: result.status, experimentId: result.envelope.plan.recommendation.id } : result });
      return true;
    }
  } catch (error) {
    json(res, 409, { ok: false, error: error instanceof Error ? error.message : String(error) });
    return true;
  }
  return false;
}
