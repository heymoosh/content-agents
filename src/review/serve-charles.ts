import { type IncomingMessage, type ServerResponse } from "node:http";
import { listCharlesPosts, readCharlesPost, saveCharlesPost, setCharlesStatus, readPersonaBrief } from "./charles.js";
import { enqueueCharlesDraft } from "./jobs.js";
import { type Engine } from "./engines.js";
import {
  appendReviewCommentSafe, charlesReviewSubject, listReviewCommentsWithHealth,
} from "./review-comments.js";
import {
  approveCharlesPersonaProposal, proposeCharlesPersonaEdit, readCharlesPersona,
  rejectCharlesPersonaProposal,
} from "./charles-persona.js";
import { saveCapture } from "./captures.js";
import { isCharlesOutputType, runCharlesGroup, type CharlesDrafter } from "./charles-queue.js";
import { pendingCount, type CharlesOutputType } from "./room-queue.js";

type CharlesRouteContext = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  readBody: (req: IncomingMessage) => Promise<Record<string, unknown>>;
  json: (res: ServerResponse, code: number, obj: unknown) => void;
  requestEngine: (value: unknown) => Engine;
  charlesRoot?: string;
  personaProposalsPath?: string;
  reviewCommentsPath?: string;
  /** Slice 1.5d group run: injectable stores + drafter so a test never spawns a model or touches charles/. */
  capturesPath?: string;
  queuePath?: string;
  draftCharles?: CharlesDrafter;
};

function assertOnly(body: Record<string, unknown>, allowed: readonly string[]): void {
  const extras = Object.keys(body).filter((key) => !allowed.includes(key));
  if (extras.length) throw new Error(`unsupported persona request field: ${extras[0]}`);
}

// Charles room routes preserve the review-only contract: no endpoint here posts a draft.
export async function handleCharlesRoute({ req, res, url, readBody, json, requestEngine, charlesRoot, personaProposalsPath, reviewCommentsPath, capturesPath, queuePath, draftCharles }: CharlesRouteContext): Promise<boolean> {
  // Charles room (Build 4): charles/review-queue.md + the drafts it points at. Same review
  // contract as everywhere else — approve/revise/discard just flips a status cell here, nothing
  // posts (see charles/CLAUDE.md).
  if (req.method === "GET" && url.pathname === "/api/charles") {
    json(res, 200, { posts: listCharlesPosts(charlesRoot).map((post) => {
      const history = listReviewCommentsWithHealth("charles", charlesReviewSubject(post.id), reviewCommentsPath);
      return { ...post, comments: history.comments, historyWarning: history.warning };
    }) });
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
        }, reviewCommentsPath).warning;
      }
      const history = listReviewCommentsWithHealth("charles", charlesReviewSubject(id), reviewCommentsPath);
      historyWarning = [historyWarning, history.warning].filter(Boolean).join(" ") || undefined;
      json(res, 200, { ok: true, post: {
        ...readCharlesPost(id, charlesRoot), comments: history.comments, historyWarning: history.warning,
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
  // One capture, several outputs, one durable group (decision 11, slice 1.5d, charles-queue.ts).
  // The selection is persisted with every output `pending` BEFORE any draft runs; each output then
  // drafts through the same per-mode path as /api/charles/draft. A failed output stays `pending`
  // and the same request again drafts only what is still missing. The group is read back off
  // GET /api/room-queue?room=Charles. No client caller yet (the desk still posts per mode).
  if (req.method === "POST" && url.pathname === "/api/charles/group") {
    const b = await readBody(req);
    try {
      const rawTypes = Array.isArray(b.types) ? b.types : [];
      const types: CharlesOutputType[] = [];
      for (const type of rawTypes) {
        if (!isCharlesOutputType(type)) throw new Error(`"${String(type)}" isn't a format this can draft. Try oneliner, essay, or reply`);
        types.push(type);
      }
      if (!types.length) throw new Error("choose at least one format");
      const capture = saveCapture("Charles", String(b.text ?? ""), capturesPath);
      const run = await runCharlesGroup({
        capture, types, engine: requestEngine(b.engine), path: queuePath,
        replySource: b.replySource === undefined ? undefined : String(b.replySource),
        draft: draftCharles ?? ((mode, input, engine) => enqueueCharlesDraft(mode, input, engine)),
      });
      json(res, 200, {
        ok: true, captureId: capture.id, groupId: run.item.payload.groupId, item: run.item, results: run.results, pending: pendingCount([run.item]),
      });
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
