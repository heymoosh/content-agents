import { type IncomingMessage, type ServerResponse } from "node:http";
import { openDb } from "../db/db.js";
import { readSignals, readOutcomeFamilies, readResearchReport } from "./signals.js";
import { buildSignalsRecommendationRead } from "./signals-recommendations.js";
import { appendSignalsDecision, readSignalsDecisions, recommendationKey, type SignalsDecisionKind, type SignalsRecommendationType } from "./signals-decisions.js";
import { applySignalsProposal, proposeSignalsChange, readSignalsProposals, reconcileSignalsApplyIntents, reviewSignalsProposal, rollbackSignalsProposal } from "./signals-change-proposals.js";

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
};

// Signals stays split by its existing response contracts: signal summary, outcome families, and
// redacted research report remain separate reads; decisions are explicit append-only writes.
export async function handleSignalsRoute({ req, res, url, readBody, json, decisionsPath, appendDecision, proposalsPath, configRoot }: SignalsRouteContext): Promise<boolean> {
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
    });
    return true;
  }
  // Card D: the four outcome families, grouped at read time out of data/analytics.db
  // (docs/venture-schema-contract.md §5.8). A separate route from /api/signals on purpose —
  // this is a different read with a different shape, and nothing merges the two into a score.
  if (req.method === "GET" && url.pathname === "/api/signals/outcomes") {
    const db = openDb();
    try {
      json(res, 200, readOutcomeFamilies(db));
    } finally {
      db.close();
    }
    return true;
  }
  // The redacted account-level research read (contract §5.4b), until now unreachable from the
  // GUI. Aggregate counts and redacted text only; degrades to an honest empty read, never zeros.
  if (req.method === "GET" && url.pathname === "/api/research/report") {
    const db = openDb();
    try {
      json(res, 200, readResearchReport(db));
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
