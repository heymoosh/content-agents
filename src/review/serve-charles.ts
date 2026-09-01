import { type IncomingMessage, type ServerResponse } from "node:http";
import { listCharlesPosts, readCharlesPost, saveCharlesPost, setCharlesStatus, readPersonaBrief } from "./charles.js";
import { enqueueCharlesDraft } from "./jobs.js";
import { type Engine } from "./engines.js";
import {
  appendReviewCommentSafe, charlesReviewSubject, listReviewCommentsSafe,
} from "./review-comments.js";
import {
  approveCharlesPersonaProposal, proposeCharlesPersonaEdit, readCharlesPersona,
  rejectCharlesPersonaProposal,
} from "./charles-persona.js";

type CharlesRouteContext = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  readBody: (req: IncomingMessage) => Promise<Record<string, unknown>>;
  json: (res: ServerResponse, code: number, obj: unknown) => void;
  requestEngine: (value: unknown) => Engine;
  charlesRoot?: string;
  personaProposalsPath?: string;
};

function assertOnly(body: Record<string, unknown>, allowed: readonly string[]): void {
  const extras = Object.keys(body).filter((key) => !allowed.includes(key));
  if (extras.length) throw new Error(`unsupported persona request field: ${extras[0]}`);
}

// Charles room routes preserve the review-only contract: no endpoint here posts a draft.
export async function handleCharlesRoute({ req, res, url, readBody, json, requestEngine, charlesRoot, personaProposalsPath }: CharlesRouteContext): Promise<boolean> {
  // Charles room (Build 4): charles/review-queue.md + the drafts it points at. Same review
  // contract as everywhere else — approve/revise/discard just flips a status cell here, nothing
  // posts (see charles/CLAUDE.md).
  if (req.method === "GET" && url.pathname === "/api/charles") {
    json(res, 200, { posts: listCharlesPosts().map((post) => ({
      ...post, comments: listReviewCommentsSafe("charles", charlesReviewSubject(post.id)),
    })) });
    return true;
  }
  if (req.method === "GET" && url.pathname === "/api/charles/persona-brief") {
    try {
      json(res, 200, { ok: true, text: readPersonaBrief(charlesRoot) });
    } catch (e) {
      json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    return true;
  }
  if (req.method === "GET" && url.pathname === "/api/charles/persona") {
    try {
      json(res, 200, { ok: true, persona: readCharlesPersona({ root: charlesRoot, proposalsPath: personaProposalsPath }) });
    } catch (e) {
      json(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    return true;
  }
  if (req.method === "POST" && url.pathname === "/api/charles/persona/proposals") {
    const b = await readBody(req);
    try {
      assertOnly(b, ["yaml"]);
      const proposal = proposeCharlesPersonaEdit(String(b.yaml ?? ""), "muxin", { root: charlesRoot, proposalsPath: personaProposalsPath });
      json(res, 200, { ok: true, proposal, persona: readCharlesPersona({ root: charlesRoot, proposalsPath: personaProposalsPath }) });
    } catch (e) {
      json(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    return true;
  }
  const personaDecision = url.pathname.match(/^\/api\/charles\/persona\/proposals\/(charles-persona-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/(approve|reject)$/);
  if (req.method === "POST" && personaDecision) {
    const b = await readBody(req);
    try {
      assertOnly(b, ["evidence"]);
      const [id, decision] = [personaDecision[1], personaDecision[2]];
      const proposal = decision === "approve"
        ? approveCharlesPersonaProposal(id, String(b.evidence ?? ""), "muxin", { root: charlesRoot, proposalsPath: personaProposalsPath })
        : rejectCharlesPersonaProposal(id, String(b.evidence ?? ""), "muxin", { root: charlesRoot, proposalsPath: personaProposalsPath });
      json(res, 200, { ok: true, proposal, persona: readCharlesPersona({ root: charlesRoot, proposalsPath: personaProposalsPath }) });
    } catch (e) {
      json(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    return true;
  }
  if (req.method === "POST" && url.pathname === "/api/charles/status") {
    const b = await readBody(req);
    try {
      const id = String(b.id ?? "");
      const status = String(b.status ?? "");
      const notes = b.notes !== undefined ? String(b.notes) : undefined;
      setCharlesStatus(id, status, notes);
      let historyWarning: string | undefined;
      if (status === "revise" && notes?.trim()) {
        historyWarning = appendReviewCommentSafe({
          domain: "charles", subject: charlesReviewSubject(id), body: notes,
          operationId: b.operationId === undefined ? undefined : String(b.operationId),
        }).warning;
      }
      json(res, 200, { ok: true, post: {
        ...readCharlesPost(id), comments: listReviewCommentsSafe("charles", charlesReviewSubject(id)),
      }, historyWarning });
    } catch (e) {
      json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    return true;
  }
  if (req.method === "POST" && url.pathname === "/api/charles/doc") {
    const b = await readBody(req);
    try {
      saveCharlesPost(String(b.id ?? ""), String(b.body ?? ""));
      json(res, 200, { ok: true });
    } catch (e) {
      json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    return true;
  }
  if (req.method === "POST" && url.pathname === "/api/charles/draft") {
    const b = await readBody(req);
    try {
      const drafted = await enqueueCharlesDraft(String(b.mode ?? ""), String(b.input ?? ""), requestEngine(b.engine));
      json(res, 200, { ok: true, ...drafted });
    } catch (e) {
      json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    return true;
  }
  return false;
}
