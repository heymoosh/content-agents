// Fiction desk data layer (Content Studio Riff 3f): browse and edit a series' CANON — the world
// bible, the outline, character sheets — in place, and READ the chapter drafts those build into.
// canon.md is append-only by contract (story:lock writes it), so it renders read-only here.
//
// Chapters were deliberately left out of this module (commit feb0ffe, "chapters in GitHub"). The
// v7 Fiction room needs the scene itself on screen, so they are exposed here now, but as a strictly
// READ path: every chapter doc is `editable: false`, so saveFictionDoc still refuses them and the
// only write into a chapter stays the scoped span patch (src/fiction/patch.ts). Line-by-line review
// and the commit history stay in the GitHub /story flow, exactly as before.
// (Build 2 wall, stories/AGENTS.md: the sole bridge to the rest of the studio is promotion.)

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Engine } from "./engines.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { repoRoot } from "../db/db.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { configuredDataPathOrLegacy } from "../runtime/data-root.js";

const execFileP = promisify(execFile);
const STORIES_ROOT = join(repoRoot, "stories");

export interface FictionDoc {
  id: string; // stable per-series doc id, e.g. "bible", "outline", "canon", "characters/eli.md"
  label: string;
  path: string; // series-relative file path
  editable: boolean;
  chapter?: number; // chapter docs only — the number the scene surfaces work from
}

export interface FictionSeries {
  slug: string;
  title: string;
  docs: FictionDoc[];
  // Kept as its OWN list rather than folded into `docs`: `docs` is the canon rail Muxin clicks
  // through, and a series with twenty chapters would bury the bible under them.
  chapters: FictionDoc[];
}

// The only files the desk will ever read or write, resolved per series from what actually exists.
// canon.md stays read-only (append-only ledger owned by story:lock); series.yaml stays off the
// desk entirely (config, edited in a real editor).
export function seriesDocs(seriesDir: string): FictionDoc[] {
  const docs: FictionDoc[] = [];
  if (existsSync(join(seriesDir, "bible.md"))) docs.push({ id: "bible", label: "The world (story bible)", path: "bible.md", editable: true });
  if (existsSync(join(seriesDir, "outline.md"))) docs.push({ id: "outline", label: "The plot line", path: "outline.md", editable: true });
  if (existsSync(join(seriesDir, "canon.md"))) docs.push({ id: "canon", label: "Canon ledger (append-only)", path: "canon.md", editable: false });
  const charsDir = join(seriesDir, "characters");
  if (existsSync(charsDir)) {
    for (const f of readdirSync(charsDir).filter((f) => f.endsWith(".md") && f !== "README.md").sort()) {
      docs.push({ id: `characters/${f}`, label: `Character: ${f.replace(/\.md$/, "").replace(/-/g, " ")}`, path: `characters/${f}`, editable: true });
    }
  }
  return docs;
}

// The chapter drafts, read-only. Ordered by number, not by readdir order.
export function chapterDocs(seriesDir: string): FictionDoc[] {
  const chDir = join(seriesDir, "chapters");
  if (!existsSync(chDir)) return [];
  return readdirSync(chDir)
    .map((f) => ({ f, n: Number(f.match(/^chapter-(\d+)\.md$/)?.[1]) }))
    .filter((x) => Number.isFinite(x.n) && x.n > 0)
    .sort((a, b) => a.n - b.n)
    .map(({ f, n }) => {
      const title = chapterTitle(join(chDir, f));
      return {
        id: `chapters/${f}`,
        label: title ? `Chapter ${n}: ${title}` : `Chapter ${n}`,
        path: `chapters/${f}`,
        editable: false, // the scoped span patch is the only write into a chapter
        chapter: n,
      };
    });
}

function chapterTitle(abs: string): string {
  try {
    const t = splitFrontmatter(readFileSync(abs, "utf8")).fm.title;
    return typeof t === "string" ? t.trim() : "";
  } catch {
    return "";
  }
}

function titleFromBible(seriesDir: string, slug: string): string {
  try {
    const m = readFileSync(join(seriesDir, "bible.md"), "utf8").match(/^#\s+(.+)$/m);
    if (m) return m[1].replace(/,?\s*Story Bible\s*$/i, "").trim();
  } catch {
    /* fall through */
  }
  return slug.replace(/-/g, " ");
}

export function listFictionSeries(root: string = STORIES_ROOT): FictionSeries[] {
  if (!existsSync(root)) return [];
  const out: FictionSeries[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(root, entry.name);
    const docs = seriesDocs(dir);
    if (!docs.length) continue;
    out.push({ slug: entry.name, title: titleFromBible(dir, entry.name), docs, chapters: chapterDocs(dir) });
  }
  return out;
}

// The ONE slug gate. Every fiction path that turns a client-supplied series name into a directory
// goes through this: resolveDoc below, the beats anchor, and listChapters. A caller that joins
// `slug` onto a root itself is a fourth variant waiting to drift, which is how GET
// /api/fiction/scene ended up reading any chapters/ directory on the disk.
export function seriesDirFor(slug: string, root: string = STORIES_ROOT): string {
  if (!/^[a-z0-9][\w-]*$/.test(slug)) throw new Error("bad series");
  return join(root, slug);
}

// A series' chapter list BY SLUG, gated. The by-directory `chapterDocs` above stays for callers
// that already hold a resolved directory.
export function listChapters(slug: string, root: string = STORIES_ROOT): FictionDoc[] {
  return chapterDocs(seriesDirFor(slug, root));
}

// The path-traversal guard every doc read/write funnels through: the requested path must be one
// this series' own enumeration actually produced — never a client-invented path. Chapter paths go
// through the SAME guard, so "chapters/../../.env" is rejected for exactly the reason
// "../../.env" always was: it is not in the list.
export function resolveDoc(slug: string, path: string, root: string = STORIES_ROOT): { abs: string; doc: FictionDoc } {
  const seriesDir = seriesDirFor(slug, root);
  const doc = [...seriesDocs(seriesDir), ...chapterDocs(seriesDir)].find((d) => d.path === path);
  if (!doc) throw new Error("no such canon doc");
  return { abs: join(seriesDir, doc.path), doc };
}

// One chapter, split for the room: the scene body renders on its own, the frontmatter does not.
export interface FictionChapter {
  number: number;
  title: string;
  status: string;
  body: string;
  path: string; // series-relative
}

export function readFictionChapter(slug: string, chapter: number, root: string = STORIES_ROOT): FictionChapter {
  if (!Number.isInteger(chapter) || chapter < 1) throw new Error("bad chapter");
  const path = `chapters/chapter-${String(chapter).padStart(2, "0")}.md`;
  const { abs } = resolveDoc(slug, path, root);
  const { fm, body } = splitFrontmatter(readFileSync(abs, "utf8"));
  return {
    number: chapter,
    title: typeof fm.title === "string" ? fm.title.trim() : "",
    status: typeof fm.status === "string" ? fm.status.trim() : "",
    body,
    path,
  };
}

// ── The beats Muxin typed, kept as the anchor for this scene ─────────────────────────────────────
// The prototype holds her beats in client memory, which dies on reload and takes the anchor with
// it. They live outside git instead, the same convention as the job logs and the Venture intake
// drafts: this is studio working state, not canon, and stories/ stays the series.
export const BEATS_ROOT = configuredDataPathOrLegacy("fiction-beats");

export interface SceneBeats {
  beats: string;
  chapter: number | null; // filled in once the draft job produced a chapter
  initialEngine: Engine | null;
  revisionHistory: { operationId: string; engine: Engine; recordedAt: string }[];
  savedAt: string;
}

function storedEngine(value: unknown): Engine | null {
  return value === "claude" || value === "grok" || value === "codex" || value === "ollama-gpt-oss" ? value : null;
}

function beatsPath(slug: string, root: string): string {
  return `${seriesDirFor(slug, root)}.json`; // same gate as every other slug-to-path join
}

export function readSceneBeats(slug: string, root: string = BEATS_ROOT): SceneBeats | null {
  try {
    const raw = JSON.parse(readFileSync(beatsPath(slug, root), "utf8")) as Partial<SceneBeats>;
    if (!raw || typeof raw.beats !== "string" || !raw.beats.trim()) return null;
    return {
      beats: raw.beats,
      chapter: typeof raw.chapter === "number" ? raw.chapter : null,
      initialEngine: storedEngine(raw.initialEngine ?? (raw as { engine?: unknown }).engine),
      revisionHistory: Array.isArray(raw.revisionHistory) ? raw.revisionHistory.flatMap((entry) => {
        const item = entry as { operationId?: unknown; engine?: unknown; recordedAt?: unknown };
        const engine = storedEngine(item.engine);
        return typeof item.operationId === "string" && engine && typeof item.recordedAt === "string"
          ? [{ operationId: item.operationId, engine, recordedAt: item.recordedAt }] : [];
      }) : [],
      savedAt: typeof raw.savedAt === "string" ? raw.savedAt : "",
    };
  } catch {
    return null; // never written, or unreadable — either way there is no anchor to show
  }
}

export function saveSceneBeats(slug: string, beats: string, chapter: number | null = null, root: string = BEATS_ROOT, engine: Engine | null = null, revisionOperationId?: string): SceneBeats {
  const text = beats.trim();
  if (!text) throw new Error("say the beats first");
  const p = beatsPath(slug, root);
  mkdirSync(join(p, ".."), { recursive: true });
  const existing = readSceneBeats(slug, root);
  const savedAt = new Date().toISOString();
  const priorRevisions = existing?.revisionHistory ?? [];
  const revisionHistory = revisionOperationId && engine && !priorRevisions.some((entry) => entry.operationId === revisionOperationId)
    ? [...priorRevisions, { operationId: revisionOperationId, engine, recordedAt: savedAt }]
    : priorRevisions;
  const saved: SceneBeats = {
    beats: text,
    chapter,
    initialEngine: revisionOperationId ? existing?.initialEngine ?? null : engine,
    revisionHistory: chapter === null && !revisionOperationId ? [] : revisionHistory,
    savedAt,
  };
  writeFileSync(p, JSON.stringify(saved, null, 2) + "\n");
  return saved;
}

// "Start a different scene": drop the anchor. It never touches a chapter file.
export function clearSceneBeats(slug: string, root: string = BEATS_ROOT): void {
  const p = beatsPath(slug, root);
  if (existsSync(p)) writeFileSync(p, JSON.stringify({ beats: "", chapter: null, savedAt: new Date().toISOString() }, null, 2) + "\n");
}

export function readFictionDoc(slug: string, path: string, root: string = STORIES_ROOT): { doc: FictionDoc; body: string } {
  const { abs, doc } = resolveDoc(slug, path, root);
  return { doc, body: readFileSync(abs, "utf8") };
}

// Why the desk will not write this doc, said accurately per doc. A chapter is not an append-only
// ledger and /story lock does not write it, so it gets its own sentence naming what does: the
// scoped span patch here, and the /story flow in GitHub for everything else.
export function refuseSave(doc: FictionDoc): string {
  if (doc.chapter !== undefined) {
    return `${doc.label} is a chapter draft, and this desk does not write chapters. Fix the line changes one flagged span; every other edit goes through /story and your GitHub flow.`;
  }
  return `${doc.label} is append-only. /story lock writes it, not this desk.`;
}

export function saveFictionDoc(slug: string, path: string, body: string, root: string = STORIES_ROOT): void {
  const { abs, doc } = resolveDoc(slug, path, root);
  if (!doc.editable) throw new Error(refuseSave(doc));
  if (!body.trim()) throw new Error("refusing to save an empty canon doc");
  writeFileSync(abs, body.replace(/\n*$/, "\n"));
}

// Read-only git history for one canon doc — the desk's "version history" line. Degrades to []
// on any git hiccup rather than failing the room.
export async function fictionDocHistory(slug: string, path: string, root: string = STORIES_ROOT): Promise<string[]> {
  try {
    const { abs } = resolveDoc(slug, path, root);
    const { stdout } = await execFileP("git", ["log", "--format=%ad · %s", "--date=short", "-5", "--", abs], { cwd: repoRoot });
    return stdout.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}
