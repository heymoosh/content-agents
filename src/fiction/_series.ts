import "../util/env.js";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, isAbsolute } from "node:path";
import { parse } from "yaml";
import { repoRoot } from "../db/db.js";
import { splitFrontmatter } from "../util/frontmatter.js";

// Shared helpers for the Build 2 fiction scripts. A "series" is a folder under stories/.
export const STORIES_DIR = join(repoRoot, "stories");

export interface SeriesConfig {
  slug?: string;
  title?: string;
  prose?: string; // "default" = global config; "claude-native" = composed by the /story skill;
  // or an adapter name in src/providers/prose/ for the external story:draft path
  planner_model?: string; // claude-native: model that plans beats + QCs (e.g. opus)
  writer_model?: string; // claude-native: model that drafts prose (e.g. sonnet, haiku)
  narrative?: { pov?: string; tense?: string; style_ref?: string };
  chapter?: { target_words?: number; min_words?: number };
  illustration?: { style_lock?: string; aspect?: string };
  substack?: { publication?: string };
  [k: string]: unknown;
}

// Accept a slug ("the-glass-coast") or a path ("stories/the-glass-coast"). Returns the dir.
export function resolveSeriesDir(arg: string): string {
  if (!arg) throw new Error("missing <series> (slug or path under stories/)");
  const candidates = [
    isAbsolute(arg) ? arg : join(repoRoot, arg),
    join(STORIES_DIR, arg),
  ];
  const dir = candidates.find((d) => existsSync(join(d, "series.yaml")));
  if (!dir) {
    throw new Error(`no series found for "${arg}" (looked for series.yaml under stories/)`);
  }
  return dir;
}

export function readSeriesConfig(dir: string): SeriesConfig {
  const p = join(dir, "series.yaml");
  return (parse(readFileSync(p, "utf8")) as SeriesConfig) ?? {};
}

export const pad2 = (n: number) => String(n).padStart(2, "0");
export const chapterFileName = (n: number) => `chapter-${pad2(n)}.md`;
export const chapterPath = (dir: string, n: number) => join(dir, "chapters", chapterFileName(n));

// All chapter numbers present, ascending.
export function chapterNumbers(dir: string): number[] {
  const chDir = join(dir, "chapters");
  if (!existsSync(chDir)) return [];
  return readdirSync(chDir)
    .map((f) => f.match(/^chapter-(\d+)\.md$/)?.[1])
    .filter((x): x is string => Boolean(x))
    .map(Number)
    .sort((a, b) => a - b);
}

export function nextChapterNumber(dir: string): number {
  const nums = chapterNumbers(dir);
  return nums.length ? nums[nums.length - 1] + 1 : 1;
}

export function readChapter(dir: string, n: number): { fm: Record<string, unknown>; body: string } {
  const p = chapterPath(dir, n);
  if (!existsSync(p)) throw new Error(`no chapter ${n}: ${p}`);
  return splitFrontmatter(readFileSync(p, "utf8"));
}

// Read a small file if present, else "".
export function readIfExists(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8").trim() : "";
}

// Character sheets: stories/<slug>/characters/*.md (ignores the per-character image subdirs).
export function characterSheets(dir: string): { name: string; text: string }[] {
  const cdir = join(dir, "characters");
  if (!existsSync(cdir)) return [];
  return readdirSync(cdir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({ name: f.replace(/\.md$/, ""), text: readFileSync(join(cdir, f), "utf8").trim() }));
}

export const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;
