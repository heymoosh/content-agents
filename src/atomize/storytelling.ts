// Storytelling score dimension (Muxin eval 2026-06-30, decision 2026-06-30): a rubric run against
// 10 real derivatives found native/brand scoring 4-5 while storytelling (hook/narrative/resonance)
// clustered at 2-3. Claude judges these three dimensions inline while scoring in SKILL.md step 5,
// the same pattern as native/brand/thread_check elsewhere in this pipeline. This module is the
// deterministic plumbing only: parse the frontmatter Claude wrote, decide whether it's low enough
// to suggest a Spin pass, and summarize for `npm run validate`'s advisory output.
//
// Never a hard gate: practical angle and CTA stay conditional, never scored requirements
// (Muxin, 2026-06-30 DECISION — engagement is resonance, not conversion), and a low storytelling
// score still queues for review same as every other score here.

export interface StorytellingScores {
  hook: number;
  narrative: number;
  resonance: number;
}

const DIMENSIONS = ["hook", "narrative", "resonance"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

// 1-5 scale, same as native/brand. <=3 is "low" — matches the eval's 2-3 clustering, so the
// derivatives that motivated this dimension actually surface for a Spin re-hook pass.
export const LOW_SCORE_THRESHOLD = 3;

// Reads fm.scores.{hook,narrative,resonance}; undefined unless all three are present numbers, so
// a derivative Claude hasn't scored on this dimension yet (or an older one predating it) is simply
// unscored rather than misreported as low.
export function parseStorytelling(fm: Record<string, unknown>): StorytellingScores | undefined {
  const scores = fm.scores;
  if (!scores || typeof scores !== "object") return undefined;
  const s = scores as Record<string, unknown>;
  const values = {} as StorytellingScores;
  for (const dim of DIMENSIONS) {
    const v = s[dim];
    if (typeof v !== "number") return undefined;
    values[dim] = v;
  }
  return values;
}

// Which of the three dimensions are at/below the threshold, in rubric order.
export function lowDimensions(scores: StorytellingScores): Dimension[] {
  return DIMENSIONS.filter((dim) => scores[dim] <= LOW_SCORE_THRESHOLD);
}

export function needsSpinPass(scores: StorytellingScores): boolean {
  return lowDimensions(scores).length > 0;
}

// The exact review-queue.md notes-cell suffix Claude appends for a flagged derivative (step 8).
// Undefined when nothing is low — a high-scoring derivative gets no flag, no note. This is a
// suggestion surfaced for Muxin, never a block: he still approves/discards in review-queue.md.
export function spinPassNote(scores: StorytellingScores): string | undefined {
  const low = lowDimensions(scores);
  if (!low.length) return undefined;
  return `flag: spin pass suggested (low: ${low.join(", ")})`;
}

// Advisory rollup for `npm run validate` — reported, never a gate (mirrors summarizeThreadChecks
// in thread-check.ts). A derivative with no storytelling scores yet is simply not counted.
// Each flagged file carries its own low dimensions so callers don't have to re-parse/re-derive
// them a second time to report which dimensions were low.
export function summarizeStorytelling(
  files: { file: string; fm: Record<string, unknown> }[]
): { scored: number; flagged: number; flaggedFiles: { file: string; low: Dimension[] }[] } {
  let scored = 0;
  const flaggedFiles: { file: string; low: Dimension[] }[] = [];
  for (const { file, fm } of files) {
    const scores = parseStorytelling(fm);
    if (!scores) continue;
    scored++;
    const low = lowDimensions(scores);
    if (low.length) flaggedFiles.push({ file, low });
  }
  return { scored, flagged: flaggedFiles.length, flaggedFiles };
}
