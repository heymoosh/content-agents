// Data layer for the Develop tab (the GUI's advisor stage): the /develop skill appends
// recommendation rounds to content/<slug>/develop/advice.json (machine truth this module
// round-trips) + develop/log.md (the append-only human-readable conversation record the advisor
// re-reads on reply rounds). This module owns every deterministic mutation — accept/dismiss/reply
// — so the subprocess only ever WRITES advice, never acts on it (same "don't trust the
// subprocess's own bookkeeping" posture jobs.ts takes with stampOrigin).
//
// The extraction-first guardrail (CLAUDE.md rule 1) lives here, not in the skill prompt: an angle
// card carries `sourceLines` (line refs into source.md, same convention as a derivative's
// source_lines frontmatter), and acceptAngle() assembles the new cut's body FROM THOSE LINES of
// source.md as it sits on disk — the advisor's own free text (title/summary) never enters a cut
// body. What the GUI previews (previewText below) is resolved by the same function, so
// what-you-see-is-what-you-accept.

import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { addCut, listCuts, DEFAULT_LENS } from "../atomize/cuts.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { CONTENT, safeFolder, isValidLens, firstHeading, listRootFolders, readQueueCached, DECIDED } from "./rows.js";

export type AdviceCardKind = "angle" | "cta" | "spin" | "routing" | "note";
export type AdviceCardStatus = "open" | "accepted" | "dismissed";

export interface AdviceCard {
  id: string; // "r<round>-c<n>", assigned by the advisor
  kind: AdviceCardKind;
  title: string;
  summary: string; // advisor rationale — NEVER enters content
  lens?: string; // angle only: proposed cut lens slug
  sourceLines?: (number | string)[]; // angle only: Muxin's verbatim source.md lines (e.g. [12, "31-33"])
  status: AdviceCardStatus;
  acceptedLens?: string | null;
  decidedAt?: string | null;
}

export interface AdviceRound {
  index: number;
  trigger: "initial" | "reply";
  replyText?: string | null; // Muxin's reply that prompted this round (reply rounds only)
  at?: string;
  cards: AdviceCard[];
}

export interface Advice {
  version: 1;
  rounds: AdviceRound[];
}

export function developDir(folder: string): string {
  return join(folder, "develop");
}
export function advicePath(folder: string): string {
  return join(developDir(folder), "advice.json");
}
export function developLogPath(folder: string): string {
  return join(developDir(folder), "log.md");
}

const CARD_KINDS = new Set<string>(["angle", "cta", "spin", "routing", "note"]);
const CARD_STATUSES = new Set<string>(["open", "accepted", "dismissed"]);

// Tolerant parse: the file is written by a headless `claude -p` run, the flakiest producer in this
// pipeline, so a malformed/absent file reads as null (nothing to show) rather than throwing raw —
// runDevelopJob() in jobs.ts separately fails the JOB loudly when no valid round landed. Cards
// with an unknown kind/status are normalized (kind→"note", status→"open") instead of dropped, so
// a slightly-off advisor round still renders rather than silently vanishing.
export function readAdvice(folder: string): Advice | null {
  let raw: string;
  try {
    raw = readFileSync(advicePath(folder), "utf8");
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || !Array.isArray((parsed as Advice).rounds)) return null;
  const rounds: AdviceRound[] = [];
  for (const r of (parsed as Advice).rounds) {
    if (typeof r !== "object" || r === null || !Array.isArray(r.cards)) continue;
    const cards: AdviceCard[] = [];
    for (const c of r.cards) {
      if (typeof c !== "object" || c === null || typeof c.id !== "string") continue;
      cards.push({
        id: c.id,
        kind: CARD_KINDS.has(String(c.kind)) ? (c.kind as AdviceCardKind) : "note",
        title: typeof c.title === "string" ? c.title : "",
        summary: typeof c.summary === "string" ? c.summary : "",
        lens: typeof c.lens === "string" ? c.lens : undefined,
        sourceLines: Array.isArray(c.sourceLines) ? c.sourceLines : undefined,
        status: CARD_STATUSES.has(String(c.status)) ? (c.status as AdviceCardStatus) : "open",
        acceptedLens: typeof c.acceptedLens === "string" ? c.acceptedLens : null,
        decidedAt: typeof c.decidedAt === "string" ? c.decidedAt : null,
      });
    }
    rounds.push({
      index: typeof r.index === "number" ? r.index : rounds.length + 1,
      trigger: r.trigger === "reply" ? "reply" : "initial",
      replyText: typeof r.replyText === "string" ? r.replyText : null,
      at: typeof r.at === "string" ? r.at : undefined,
      cards,
    });
  }
  return { version: 1, rounds };
}

export function writeAdvice(folder: string, advice: Advice): void {
  mkdirSync(developDir(folder), { recursive: true });
  writeFileSync(advicePath(folder), JSON.stringify(advice, null, 2) + "\n");
}

// The drain() artifact predicate: a develop job "worked" iff a new, PARSEABLE round landed —
// exit code 0 alone proves nothing (same "finished != worked" rule as atomize/video jobs).
export function roundCount(folder: string): number {
  return readAdvice(folder)?.rounds.length ?? 0;
}

// Line refs use the derivative source_lines convention: a bare number (12) or an inclusive
// "start-end" range string ("31-33"), all 1-indexed into source.md as it sits on disk.
export function parseLineRefs(refs: (number | string)[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const ref of refs) {
    if (typeof ref === "number") {
      if (!Number.isInteger(ref) || ref < 1) throw new Error(`bad line ref: ${ref}`);
      out.push([ref, ref]);
      continue;
    }
    const m = /^(\d+)-(\d+)$/.exec(String(ref).trim());
    if (!m) throw new Error(`bad line ref: "${ref}"`);
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a < 1 || b < a) throw new Error(`bad line ref: "${ref}"`);
    out.push([a, b]);
  }
  if (!out.length) throw new Error("an angle needs at least one source line ref");
  return out;
}

// The ONLY source of an accepted cut's body: Muxin's verbatim source.md lines, selected by the
// card's refs, ranges separated by a blank line. Throws (rather than silently truncating) when a
// ref points past the end of the file — e.g. the advisor's refs went stale after a source edit.
export function extractSourceLines(folder: string, refs: (number | string)[]): string {
  const ranges = parseLineRefs(refs);
  const lines = readFileSync(join(folder, "source.md"), "utf8").split("\n");
  const chunks: string[] = [];
  for (const [start, end] of ranges) {
    if (end > lines.length) throw new Error(`line ref ${start}-${end} is past the end of source.md (${lines.length} lines)`);
    chunks.push(lines.slice(start - 1, end).join("\n").trim());
  }
  return chunks.filter(Boolean).join("\n\n");
}

function findCard(advice: Advice, cardId: string): AdviceCard | null {
  for (const round of advice.rounds) {
    const card = round.cards.find((c) => c.id === cardId);
    if (card) return card;
  }
  return null;
}

function appendLog(folder: string, text: string): void {
  mkdirSync(developDir(folder), { recursive: true });
  appendFileSync(developLogPath(folder), text);
}

// Accept an angle card as a real cut: deterministic, server-side, no Claude spawn. The cut body is
// assembled by extractSourceLines() — the advisor's title becomes cut.md frontmatter `title:` (a
// label Muxin can edit in the Cuts tab), and its summary never lands anywhere in the cut.
export function acceptAngle(
  folder: string,
  cardId: string,
  lensOverride?: string,
  titleOverride?: string,
): { lens: string; cutDir: string; body: string } {
  const advice = readAdvice(folder);
  if (!advice) throw new Error("no advice.json to accept from — run Develop first");
  const card = findCard(advice, cardId);
  if (!card) throw new Error("no such card");
  if (card.kind !== "angle") throw new Error("only an angle card can become a cut");
  if (card.status !== "open") throw new Error(`card already ${card.status}`);
  if (!card.sourceLines?.length) throw new Error("this angle carries no source line refs — nothing verbatim to build a cut from");
  const lens = (lensOverride ?? card.lens ?? "").trim();
  if (!isValidLens(lens) || lens === DEFAULT_LENS) throw new Error("bad lens");
  if (listCuts(folder).includes(lens)) throw new Error(`a "${lens}" cut already exists`);
  const body = extractSourceLines(folder, card.sourceLines);
  if (!body.trim()) throw new Error("the referenced source lines are empty");
  const cutDir = addCut(folder, {
    lens,
    title: (titleOverride ?? card.title) || lens,
    text: body,
    sourceLines: card.sourceLines, // provenance for reading surfaces ("lines 10 and 12, verbatim")
  });
  card.status = "accepted";
  card.acceptedLens = lens;
  card.decidedAt = new Date().toISOString();
  writeAdvice(folder, advice);
  appendLog(folder, `\n## Accepted: ${lens} (${cardId}) → cuts/${lens}/cut.md\n`);
  return { lens, cutDir, body };
}

export function dismissCard(folder: string, cardId: string): void {
  const advice = readAdvice(folder);
  if (!advice) throw new Error("no advice.json — run Develop first");
  const card = findCard(advice, cardId);
  if (!card) throw new Error("no such card");
  if (card.status !== "open") throw new Error(`card already ${card.status}`);
  card.status = "dismissed";
  card.decidedAt = new Date().toISOString();
  writeAdvice(folder, advice);
}

// Persist Muxin's reply into log.md BEFORE the reply job is enqueued (serve.ts does the ordering):
// the spawn argv stays a fixed `/develop content/<slug>` with no free text in it, and the reply is
// on disk for the audit trail even if the job then dies. Returns the round index the advisor's
// answer will get, purely for the caller's logging.
export function appendReply(folder: string, reply: string): number {
  const nextRound = roundCount(folder) + 1;
  appendLog(folder, `\n## Muxin — reply (round ${nextRound})\n\n${reply.trim()}\n`);
  return nextRound;
}

// ── The GET /api/develop shape ──────────────────────────────────────────────────────────────────

export interface DevelopCardView extends AdviceCard {
  previewText?: string; // angle cards: the live verbatim lines acceptAngle() would use, resolved now
  previewError?: string; // a stale/broken ref renders as an inline error, never crashes the list
}

export interface DevelopSession {
  slug: string;
  title: string;
  rounds: Array<Omit<AdviceRound, "cards"> & { cards: DevelopCardView[] }>;
  cuts: string[]; // non-extract lenses already on disk (accepted here or made elsewhere)
}

// Folder-level core, exported for tmp-dir tests (the cutSetForFolder testability pattern).
export function developSessionForFolder(folder: string, slug: string): DevelopSession | null {
  const advice = readAdvice(folder);
  if (!advice || !advice.rounds.length) return null;
  const rounds = advice.rounds.map((round) => ({
    ...round,
    cards: round.cards.map((card): DevelopCardView => {
      if (card.kind !== "angle" || !card.sourceLines?.length) return { ...card };
      try {
        return { ...card, previewText: extractSourceLines(folder, card.sourceLines) };
      } catch (e) {
        return { ...card, previewError: e instanceof Error ? e.message : String(e) };
      }
    }),
  }));
  return { slug, title: firstHeading(folder), rounds, cuts: listCuts(folder) };
}

// Every content folder with an advisor session, newest (date-prefixed slug) first. Same discovery
// root as the Cuts tab — outreach leads never have develop sessions.
export function listDevelopSessions(): DevelopSession[] {
  const out: DevelopSession[] = [];
  for (const slug of listRootFolders(CONTENT)) {
    const session = developSessionForFolder(join(CONTENT, slug), slug);
    if (session) out.push(session);
  }
  out.sort((a, b) => b.slug.localeCompare(a.slug));
  return out;
}

// ── The Content room (workbench) aggregate ──────────────────────────────────────────────────────
// One shape per active piece for the studio desk's Content room: Muxin's source verbatim, the
// advisor session (if any), each cut as a readable message with provenance, and how many drafts
// are still pending in review. A folder is "active" when it has an advisor session, a non-extract
// cut, or pending review rows — settled folders stay reachable through the review list instead of
// piling up on the desk.

export interface ContentCutView {
  lens: string;
  title: string;
  body: string;
  sourceLines?: (number | string)[];
}

export interface ContentSession {
  slug: string;
  title: string;
  date: string; // from the folder's YYYY-MM-DD prefix ("" when unprefixed)
  sourceBody: string;
  rounds: DevelopSession["rounds"]; // [] when no advisor session yet
  cuts: ContentCutView[];
  pending: number;
}

export function contentSessionForFolder(folder: string, slug: string): ContentSession | null {
  let sourceBody = "";
  try {
    sourceBody = splitFrontmatter(readFileSync(join(folder, "source.md"), "utf8")).body.trim();
  } catch {
    return null; // no source.md — not a workbench piece
  }
  const session = developSessionForFolder(folder, slug);
  const cuts: ContentCutView[] = [];
  for (const lens of listCuts(folder)) {
    try {
      const { fm, body } = splitFrontmatter(readFileSync(join(folder, "cuts", lens, "cut.md"), "utf8"));
      cuts.push({
        lens,
        title: typeof fm.title === "string" ? fm.title : lens,
        body: body.trim(),
        sourceLines: Array.isArray(fm.source_lines) ? (fm.source_lines as (number | string)[]) : undefined,
      });
    } catch {
      /* unreadable cut — skip it rather than sinking the whole room */
    }
  }
  let pending = 0;
  try {
    pending = readQueueCached(folder).filter((r) => !DECIDED.has(r.status)).length;
  } catch {
    /* no queue yet */
  }
  if (!session && !cuts.length && !pending) return null;
  return {
    slug,
    title: firstHeading(folder),
    date: /^(\d{4}-\d{2}-\d{2})-/.exec(slug)?.[1] ?? "",
    sourceBody,
    rounds: session?.rounds ?? [],
    cuts,
    pending,
  };
}

export function listContentSessions(): ContentSession[] {
  const out: ContentSession[] = [];
  for (const slug of listRootFolders(CONTENT)) {
    const session = contentSessionForFolder(join(CONTENT, slug), slug);
    if (session) out.push(session);
  }
  out.sort((a, b) => b.slug.localeCompare(a.slug));
  return out;
}

// Slug-resolving wrappers for the routes (safeFolder = the one path-traversal guard).
export function acceptAngleBySlug(slug: string, cardId: string, lens?: string, title?: string) {
  return acceptAngle(safeFolder(slug), cardId, lens, title);
}
export function dismissCardBySlug(slug: string, cardId: string): void {
  dismissCard(safeFolder(slug), cardId);
}
export function appendReplyBySlug(slug: string, reply: string): number {
  return appendReply(safeFolder(slug), reply);
}
