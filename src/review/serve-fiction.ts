import { type IncomingMessage, type ServerResponse } from "node:http";
import {
  listFictionSeries, readFictionDoc, saveFictionDoc, fictionDocHistory,
  readFictionChapter, readSceneBeats, saveSceneBeats, clearSceneBeats, listChapters,
} from "./fiction.js";
import { patchChapterSpan } from "../fiction/patch.js";
import { readContinuityReport } from "../fiction/continuity.js";
import { addFictionDraftJob, addFictionRepassJob, addFictionCheckJob, publicJob } from "./jobs.js";
import { type Engine } from "./engines.js";

type FictionRouteContext = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  readBody: (req: IncomingMessage) => Promise<Record<string, unknown>>;
  json: (res: ServerResponse, code: number, obj: unknown) => void;
  requestEngine: (value: unknown) => Engine;
};

// Fiction desk routes remain walled from the shared content pipeline. Returning true means a
// Fiction endpoint wrote its response; false lets serve.ts continue its normal dispatch.
export async function handleFictionRoute({ req, res, url, readBody, json, requestEngine }: FictionRouteContext): Promise<boolean> {
  // Fiction desk (design 3f): canon browse/edit only. Chapters stay in the GitHub /story flow;
  // canon.md is append-only and renders read-only. The Build 2 wall holds — nothing here
  // composes prose or crosses into the content pipeline except by Muxin starting a promo note.
  if (req.method === "GET" && url.pathname === "/api/fiction") {
    json(res, 200, { series: listFictionSeries() });
    return true;
  }
  if (req.method === "GET" && url.pathname === "/api/fiction/doc") {
    try {
      const slug = url.searchParams.get("series") ?? "";
      const path = url.searchParams.get("path") ?? "";
      const { doc, body } = readFictionDoc(slug, path);
      json(res, 200, { ok: true, doc, body, history: await fictionDocHistory(slug, path) });
    } catch (e) {
      json(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    return true;
  }
  if (req.method === "POST" && url.pathname === "/api/fiction/doc") {
    const b = await readBody(req);
    try {
      saveFictionDoc(String(b.series ?? ""), String(b.path ?? ""), String(b.body ?? ""));
      json(res, 200, { ok: true });
    } catch (e) {
      json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    return true;
  }
  // ── The Fiction room's scene (v7 §2) ───────────────────────────────────────────────────────
  // One read for the whole room: her beats (the anchor), the drafted scene, and what the canon
  // check found. Nothing here approves, locks or publishes a chapter — every one still waits on
  // Muxin, and the GitHub /story flow stays where line editing and the commit history live.
  if (req.method === "GET" && url.pathname === "/api/fiction/scene") {
    try {
      const slug = url.searchParams.get("series") ?? "";
      // listChapters runs the same slug gate resolveDoc does. Joining the raw query param onto
      // stories/ here let "../.." walk out and list any chapters/ directory on the disk. Its
      // result is unused now, but the gate is why the call stays.
      listChapters(slug);
      const beats = readSceneBeats(slug);
      // The one chapter this room actually produced, and nothing else. It used to fall back to
      // the newest chapter on disk, which handed back one Muxin wrote herself in /story; the room
      // then labelled her prose "the scene, from your beats" and set it in the AI purple. Her
      // words are never the AI register. A ?chapter= override is gone with the fallback rather
      // than gated: it had no caller, and any value it took could name a chapter she wrote.
      const n = beats?.chapter ?? null;
      const chapter = n ? readFictionChapter(slug, n) : null;
      json(res, 200, {
        ok: true,
        beats: beats?.beats ?? "",
        chapter,
        continuity: n ? readContinuityReport(slug, n) : null,
      });
    } catch (e) {
      json(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    return true;
  }
  // "Draft it" — her beats become a queued /story run. See jobs.ts's fictionDraftPrompt for why
  // this dispatches the SKILL rather than `story:draft` (draft.ts is inert for claude-native
  // series and is a guardrail path).
  if (req.method === "POST" && url.pathname === "/api/fiction/draft") {
    const b = await readBody(req);
    try {
      const slug = String(b.series ?? "");
      const beats = String(b.beats ?? "");
      const { job, queued } = addFictionDraftJob(slug, beats, requestEngine(b.engine));
      // The anchor survives a reload, so it is written here rather than left in the page. Only
      // for a run that actually queued: a deduped press returns the draft already in flight, and
      // moving the anchor to beats that run never received would show Muxin one set of beats
      // above prose written from another.
      if (queued) saveSceneBeats(slug, beats);
      json(res, 200, { ok: true, job: publicJob(job) });
    } catch (e) {
      json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    return true;
  }
  // The second pass ("More tension, less explaining"): its OWN measured job, never an instant
  // rewrite. The draft on screen does not move until the new one lands.
  if (req.method === "POST" && url.pathname === "/api/fiction/repass") {
    const b = await readBody(req);
    try {
      json(res, 200, {
        ok: true,
        job: publicJob(addFictionRepassJob(String(b.series ?? ""), Number(b.chapter ?? 0), String(b.note ?? ""), requestEngine(b.engine))),
      });
    } catch (e) {
      json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    return true;
  }
  if (req.method === "POST" && url.pathname === "/api/fiction/check") {
    const b = await readBody(req);
    try {
      json(res, 200, { ok: true, job: publicJob(addFictionCheckJob(String(b.series ?? ""), Number(b.chapter ?? 0), requestEngine(b.engine))) });
    } catch (e) {
      json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    return true;
  }
  // "Fix the line": replace ONE flagged span in the chapter and re-save. Refuses when that exact
  // wording is missing or appears more than once, because then there is no single line to fix.
  if (req.method === "POST" && url.pathname === "/api/fiction/fix") {
    const b = await readBody(req);
    try {
      const result = patchChapterSpan(
        String(b.series ?? ""), Number(b.chapter ?? 0), String(b.span ?? ""), String(b.replacement ?? ""),
      );
      json(res, 200, { ok: true, body: result.body });
    } catch (e) {
      json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    return true;
  }
  // "Start a different scene": drops the anchor only. It never touches a chapter file.
  if (req.method === "POST" && url.pathname === "/api/fiction/beats/clear") {
    const b = await readBody(req);
    try {
      clearSceneBeats(String(b.series ?? ""));
      json(res, 200, { ok: true });
    } catch (e) {
      json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    return true;
  }
  return false;
}
