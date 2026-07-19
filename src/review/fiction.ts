// Fiction desk data layer (Content Studio Riff 3f): browse and edit a series' CANON — the world
// bible, the outline, character sheets — in place. Chapter drafting and line-by-line review stay
// in the GitHub PR flow (/story); this desk only holds the material the drafts build from
// (Build 2 wall, stories/CLAUDE.md: the sole bridge to the rest of the studio is promotion).
// canon.md is append-only by contract (story:lock writes it), so it renders read-only here.

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { repoRoot } from "../db/db.js";

const execFileP = promisify(execFile);
const STORIES_ROOT = join(repoRoot, "stories");

export interface FictionDoc {
  id: string; // stable per-series doc id, e.g. "bible", "outline", "canon", "characters/eli.md"
  label: string;
  path: string; // series-relative file path
  editable: boolean;
}

export interface FictionSeries {
  slug: string;
  title: string;
  docs: FictionDoc[];
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
    out.push({ slug: entry.name, title: titleFromBible(dir, entry.name), docs });
  }
  return out;
}

// The path-traversal guard every doc read/write funnels through: the requested path must be one
// this series' seriesDocs() actually enumerated — never a client-invented path.
export function resolveDoc(slug: string, path: string, root: string = STORIES_ROOT): { abs: string; doc: FictionDoc } {
  if (!/^[a-z0-9][\w-]*$/.test(slug)) throw new Error("bad series");
  const seriesDir = join(root, slug);
  const doc = seriesDocs(seriesDir).find((d) => d.path === path);
  if (!doc) throw new Error("no such canon doc");
  return { abs: join(seriesDir, doc.path), doc };
}

export function readFictionDoc(slug: string, path: string, root: string = STORIES_ROOT): { doc: FictionDoc; body: string } {
  const { abs, doc } = resolveDoc(slug, path, root);
  return { doc, body: readFileSync(abs, "utf8") };
}

export function saveFictionDoc(slug: string, path: string, body: string, root: string = STORIES_ROOT): void {
  const { abs, doc } = resolveDoc(slug, path, root);
  if (!doc.editable) throw new Error(`${doc.label} is append-only — /story lock writes it, not this desk`);
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
