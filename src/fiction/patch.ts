import "../util/env.js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { splitFrontmatter } from "../util/frontmatter.js";
import { resolveSeriesDir, chapterPath } from "./_series.js";
import { oneSentencePerLine } from "./_format.js";
import { hasEmDash } from "./continuity.js";

// Replace ONE exact span in one chapter draft and re-save it. This is what "Fix the line" calls.
//
// Before this, the only write paths into a chapter were a whole regeneration (draft.ts) or the
// Fiction desk's whole-file save (saveFictionDoc), and neither is what fixing one flagged sentence
// means. This module never regenerates: it finds that one span, swaps it, and leaves every other
// byte of the prose alone.
//
// Three invariants, all enforced here rather than left to the caller:
// 1. Zero matches and more than one match are BOTH errors. A span that is not there any more, or
//    that appears twice, has no single line to fix, and silently guessing which one would edit
//    prose Muxin never saw flagged.
// 2. The frontmatter block is preserved byte for byte (splitFrontmatter's `header`), the same way
//    POST /api/outreach/message/save preserves a message's frontmatter.
// 3. Fiction chapters are written one sentence per line so GitHub PR comments anchor to a passage
//    (stories/CLAUDE.md). A replacement carrying two sentences would break that, so the lines the
//    span touched are re-split, and only those lines.

export class PatchSpanError extends Error {}

// How many non-overlapping times `span` occurs in `body`.
function occurrences(body: string, span: string): number {
  let n = 0;
  let from = 0;
  for (;;) {
    const i = body.indexOf(span, from);
    if (i < 0) return n;
    n++;
    from = i + span.length;
  }
}

// The line range [start, end] (0-based, inclusive) that the character range [from, to) covers.
function lineRange(body: string, from: number, to: number): { start: number; end: number } {
  const before = body.slice(0, from).split("\n");
  const through = body.slice(0, to).split("\n");
  return { start: before.length - 1, end: through.length - 1 };
}

// Pure: the whole span-replacement rule, testable without a chapter file on disk.
export function patchBody(body: string, span: string, replacement: string): string {
  const target = span.trim();
  const text = replacement.trim();
  if (!target) throw new PatchSpanError("there is no line to fix: the flagged text came through empty");
  if (!text) throw new PatchSpanError("there is nothing to put in its place: the replacement came through empty");
  if (hasEmDash(text)) throw new PatchSpanError("that replacement has an em dash in it, and this series does not use them");

  const found = occurrences(body, target);
  if (found === 0) {
    throw new PatchSpanError("that exact wording is not in the chapter any more, so run the canon check again first");
  }
  if (found > 1) {
    throw new PatchSpanError(`that exact wording appears ${found} times in the chapter, so there is no single line to fix`);
  }

  const at = body.indexOf(target);
  const { start, end } = lineRange(body, at, at + target.length);
  const lines = body.split("\n");
  const patchedRegion = lines.slice(start, end + 1).join("\n").replace(target, text);
  // Re-split ONLY the lines the span touched, so a two-sentence replacement still lands one
  // sentence per line and the rest of the chapter keeps its exact bytes.
  const rewritten = oneSentencePerLine(patchedRegion);
  return [...lines.slice(0, start), ...rewritten.split("\n"), ...lines.slice(end + 1)].join("\n");
}

export interface PatchResult {
  path: string; // absolute path to the chapter that changed
  body: string; // the chapter prose after the fix (no frontmatter)
}

// Apply the fix to a real chapter file. Frontmatter is written back byte for byte.
export function patchChapterSpan(seriesArg: string, chapter: number, span: string, replacement: string): PatchResult {
  const dir = resolveSeriesDir(seriesArg);
  const abs = chapterPath(dir, chapter);
  if (!existsSync(abs)) throw new PatchSpanError(`there is no chapter ${chapter} to fix`);

  const { header, body } = splitFrontmatter(readFileSync(abs, "utf8"));
  const patched = patchBody(body, span, replacement);
  // `header` carries its own trailing newline (splitFrontmatter keeps the block byte-exact).
  writeFileSync(abs, `${header}\n${patched.replace(/\n*$/, "")}\n`);
  return { path: abs, body: patched };
}
