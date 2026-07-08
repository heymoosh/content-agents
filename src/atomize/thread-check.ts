import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { repoRoot } from "../db/db.js";

// Home-brand worldview thread-check (Muxin, 2026-07-04): every piece reaching review-queue.md
// should thread back to the line in config/platforms.yaml `home_brand`. Claude judges the
// connection inline while running /atomize (writes `thread_check` frontmatter, the same pattern
// as `pillar`/`spin`/`scores` elsewhere in this pipeline) using `signals` below as the rubric.
// This module is the deterministic plumbing only: load the line, normalize Claude's verdict
// safely, and (on "missing") weave in the already-approved worldview language via Spin — never
// the content judgment itself, and never a hard gate (surface/suggest only).

export interface HomeBrand {
  worldview: string;
  worldview_expanded: string;
  signals: string[];
}

export function loadHomeBrand(): HomeBrand {
  const config = parse(readFileSync(join(repoRoot, "config", "platforms.yaml"), "utf8")) as {
    home_brand?: HomeBrand;
  };
  if (!config.home_brand) throw new Error("config/platforms.yaml is missing home_brand");
  return config.home_brand;
}

export type ThreadStatus = "pass" | "missing";

// Normalize Claude's inline verdict (`fm.thread_check`) into a definite status. Anything other
// than the literal string "pass" — omitted, misspelled, or a stray boolean — defaults to
// "missing" so an unset check always surfaces for review instead of silently passing.
export function classifyThread(fm: Record<string, unknown>): ThreadStatus {
  return fm.thread_check === "pass" ? "pass" : "missing";
}

// Spin's per-channel reframing (config/platforms.yaml `spin_angles`, docs/spin-experiment.md)
// already carries Muxin-approved worldview language (the `substack` angle). Reuse that exact
// wording rather than inventing new copy: weave `worldview_expanded` onto the body as a closing
// line. Idempotent — drafting in twice does not duplicate the line. Returns the frontmatter patch
// to apply; queueing is never blocked either way, whether or not this runs.
export function draftThreadIn(
  body: string,
  homeBrand: Pick<HomeBrand, "worldview_expanded">
): { body: string; fm: { thread_check: "pass"; thread_spin_applied: true } } {
  const trimmed = body.trim();
  const line = homeBrand.worldview_expanded.trim();
  const woven = trimmed.endsWith(line) ? trimmed : `${trimmed}\n\n${line}`;
  return { body: woven, fm: { thread_check: "pass", thread_spin_applied: true } };
}

// The exact review-queue.md notes-cell suffix Claude appends for a still-missing thread-check
// after a redraft/draftThreadIn attempt (step 8). Undefined when the check passed — a passing
// derivative gets no flag. Mirrors storytelling.ts's spinPassNote() — same soft-gate,
// notes-cell pattern: surfaced for Muxin in the raw markdown itself, never a block.
export function threadCheckNote(fm: Record<string, unknown>): string | undefined {
  return classifyThread(fm) === "missing" ? "flag: home-brand thread-check missing" : undefined;
}

// Advisory-only rollup for `npm run validate` — reported, never a gate (a "missing" piece still
// queues at step 8 of the atomize skill).
export function summarizeThreadChecks(
  files: { file: string; fm: Record<string, unknown> }[]
): { pass: number; missing: number; missingFiles: string[] } {
  let pass = 0;
  const missingFiles: string[] = [];
  for (const { file, fm } of files) {
    if (classifyThread(fm) === "pass") pass++;
    else missingFiles.push(file);
  }
  return { pass, missing: missingFiles.length, missingFiles };
}
