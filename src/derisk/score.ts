// Derisk score dimensions (card: /derisk opt-in lens, plan i-want-to-add-mellow-mist). Claude
// judges these inline while brainstorming the belief/test/payoff interactively with Muxin
// (SKILL.md's lock step), the same pattern as storytelling.ts's hook/narrative/resonance. This
// module is the deterministic plumbing only: parse the frontmatter Claude wrote, decide whether
// the analysis needs a rework pass, and summarize for `npm run validate`'s advisory output.
//
// reader_runnable and constructive are the anti-salty guards Muxin asked for directly: a belief
// the reader can't test themselves, or an analysis that reads as pure criticism, defeats the
// whole point of this lens (prove analytical value, don't just point out what's wrong).

export interface DeriskScores {
  load_bearing: number;
  test_cheap: number;
  test_decisive: number;
  payoff_concrete: number;
  reader_runnable: boolean;
  constructive: number;
}

const NUMERIC_DIMENSIONS = ["load_bearing", "test_cheap", "test_decisive", "payoff_concrete", "constructive"] as const;
export type NumericDimension = (typeof NUMERIC_DIMENSIONS)[number];

// 1-5 scale, same as native/brand/storytelling. <=3 is "low".
export const LOW_SCORE_THRESHOLD = 3;

// Reads fm.derisk_scores.{...}; undefined unless every field is present with the right type, so
// an analysis Claude hasn't scored yet is simply unscored rather than misreported as low.
export function parseDerisk(fm: Record<string, unknown>): DeriskScores | undefined {
  const raw = fm.derisk_scores;
  if (!raw || typeof raw !== "object") return undefined;
  const s = raw as Record<string, unknown>;
  const values = {} as DeriskScores;
  for (const dim of NUMERIC_DIMENSIONS) {
    const v = s[dim];
    if (typeof v !== "number") return undefined;
    values[dim] = v;
  }
  if (typeof s.reader_runnable !== "boolean") return undefined;
  values.reader_runnable = s.reader_runnable;
  return values;
}

// Which numeric dimensions are at/below the threshold, in rubric order.
export function lowDimensions(scores: DeriskScores): NumericDimension[] {
  return NUMERIC_DIMENSIONS.filter((dim) => scores[dim] <= LOW_SCORE_THRESHOLD);
}

// The anti-salty guard: a belief the reader can't test themselves, or an analysis that reads as
// pure criticism rather than something constructive, fails the reason this lens exists at all.
export function needsAntiSaltyGuard(scores: DeriskScores): boolean {
  return !scores.reader_runnable || scores.constructive <= LOW_SCORE_THRESHOLD;
}

export function needsReworkPass(scores: DeriskScores): boolean {
  return needsAntiSaltyGuard(scores) || lowDimensions(scores).length > 0;
}

// The review-queue.md notes-cell suffix for a flagged derisk analysis, mirroring
// spinPassNote/threadCheckNote's "flag: ..." convention exactly (src/atomize/storytelling.ts,
// thread-check.ts). Undefined when nothing is low. This is a suggestion surfaced for Muxin, never
// a block: SKILL.md still asks him to sign off before source.md is written.
export function deriskNote(scores: DeriskScores): string | undefined {
  const flags: string[] = [];
  if (needsAntiSaltyGuard(scores)) {
    flags.push(
      `flag: derisk anti-salty guard (reader_runnable: ${scores.reader_runnable}, constructive: ${scores.constructive})`,
    );
  }
  const low = lowDimensions(scores).filter((dim) => dim !== "constructive");
  if (low.length) {
    flags.push(`flag: derisk weak (low: ${low.join(", ")})`);
  }
  return flags.length ? flags.join("; ") : undefined;
}

// Advisory rollup, shaped to mirror summarizeStorytelling's contract so a future `npm run
// validate` wiring pass can plug it in directly -- not called from validate.ts yet as of this
// writing (that wiring touches /atomize's own row-creation step, out of scope for this skill).
// A source.md with no derisk scores yet (the common case; most content never goes through
// /derisk) is simply not counted.
export function summarizeDerisk(
  files: { file: string; fm: Record<string, unknown> }[],
): { scored: number; flagged: number; flaggedFiles: { file: string; low: NumericDimension[]; antiSalty: boolean }[] } {
  let scored = 0;
  const flaggedFiles: { file: string; low: NumericDimension[]; antiSalty: boolean }[] = [];
  for (const { file, fm } of files) {
    const scores = parseDerisk(fm);
    if (!scores) continue;
    scored++;
    const low = lowDimensions(scores).filter((dim) => dim !== "constructive");
    const antiSalty = needsAntiSaltyGuard(scores);
    if (low.length || antiSalty) flaggedFiles.push({ file, low, antiSalty });
  }
  return { scored, flagged: flaggedFiles.length, flaggedFiles };
}
