import { type IncomingMessage, type ServerResponse } from "node:http";
import { openDb } from "../db/db.js";
import { readSignals, appendBacklogCard, readOutcomeFamilies, readResearchReport } from "./signals.js";

type SignalsRouteContext = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  readBody: (req: IncomingMessage) => Promise<Record<string, unknown>>;
  json: (res: ServerResponse, code: number, obj: unknown) => void;
};

// Signals stays split by its existing response contracts: signal summary, outcome families, and
// redacted research report remain separate reads; adjustment adoption remains an explicit write.
export async function handleSignalsRoute({ req, res, url, readBody, json }: SignalsRouteContext): Promise<boolean> {
  // Signals room (design 3e): the deterministic read of the latest brief, and the one write —
  // sending an adjustment to the repo backlog as a card. Muxin decides; nothing self-adopts.
  if (req.method === "GET" && url.pathname === "/api/signals") {
    json(res, 200, readSignals());
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
  if (req.method === "POST" && url.pathname === "/api/signals/backlog") {
    const b = await readBody(req);
    const title = String(b.title ?? "").trim();
    const detail = String(b.detail ?? "").trim();
    if (!title || !detail) {
      json(res, 400, { ok: false, error: "an adjustment needs a title and its rationale" });
      return true;
    }
    const signals = readSignals();
    json(res, 200, appendBacklogCard({ title, detail, briefPath: signals.briefPath, date: new Date().toISOString().slice(0, 10) }));
    return true;
  }
  return false;
}
