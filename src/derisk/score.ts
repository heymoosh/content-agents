// Derisk frame-fidelity dimensions (card: /derisk opt-in lens, plan i-want-to-add-mellow-mist,
// reshaped 2026-07-16 after Muxin corrected the premise: de-risking is his signature brand frame
// -- riskiest belief -> cheapest test -> decision it unlocks -> what it saves if false -> a
// positioning sign-off -- not a quality guard on someone else's strategy. Claude judges these
// inline while composing the frame with Muxin (SKILL.md's lock step), the same pattern as
// storytelling.ts's hook/narrative/resonance. This module is the deterministic plumbing only:
// parse the frontmatter Claude wrote, decide whether a beat is missing or weak, and summarize for
// `npm run validate`'s advisory output.
//
// Never a hard gate (Muxin, 2026-07-16 DECISION): a piece missing a beat still queues for review
// same as every other soft-scored dimension in this pipeline -- being useful IS the frame, not a
// score threshold enforced on top of it.

export interface DeriskScores {
  belief_load_bearing: number;
  test_cheap: number;
  test_reader_runnable: boolean;
  decision_named: boolean;
  saves_if_false_concrete: number;
  has_signoff: boolean;
}

const NUMERIC_DIMENSIONS = ["belief_load_bearing", "test_cheap", "saves_if_false_concrete"] as const;
export type NumericDimension = (typeof NUMERIC_DIMENSIONS)[number];

const BOOLEAN_BEATS = ["test_reader_runnable", "decision_named", "has_signoff"] as const;
export type BooleanBeat = (typeof BOOLEAN_BEATS)[number];

// 1-5 scale, same as native/brand/storytelling. <=3 is "weak".
export const LOW_SCORE_THRESHOLD = 3;

// Reads fm.derisk_scores.{...}; undefined unless every field is present with the right type, so
// a source Claude hasn't scored yet is simply unscored rather than misreported as weak.
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
  for (const beat of BOOLEAN_BEATS) {
    const v = s[beat];
    if (typeof v !== "boolean") return undefined;
    values[beat] = v;
  }
  return values;
}

// Which numeric dimensions read weak, in rubric order.
export function lowDimensions(scores: DeriskScores): NumericDimension[] {
  return NUMERIC_DIMENSIONS.filter((dim) => scores[dim] <= LOW_SCORE_THRESHOLD);
}

// Which boolean beats of the frame are missing entirely, in rubric order.
export function missingBeats(scores: DeriskScores): BooleanBeat[] {
  return BOOLEAN_BEATS.filter((beat) => !scores[beat]);
}

// Soft signal only: the frame reads incomplete or weak somewhere, worth another pass before
// Muxin signs off -- never a block. Mirrors storytelling.ts's needsSpinPass exactly.
export function needsFramePass(scores: DeriskScores): boolean {
  return lowDimensions(scores).length > 0 || missingBeats(scores).length > 0;
}

// The review-queue.md notes-cell suffix for an incomplete/weak frame, mirroring
// spinPassNote/threadCheckNote's "flag: ..." convention exactly (src/atomize/storytelling.ts,
// thread-check.ts). Undefined when the frame is complete and strong. A suggestion surfaced for
// Muxin, never a block: SKILL.md still asks him to sign off before source.md is written.
export function deriskNote(scores: DeriskScores): string | undefined {
  const missing = missingBeats(scores);
  const low = lowDimensions(scores);
  const flags: string[] = [];
  if (missing.length) {
    flags.push(`flag: derisk frame incomplete (missing: ${missing.join(", ")})`);
  }
  if (low.length) {
    flags.push(`flag: derisk frame weak (low: ${low.join(", ")})`);
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
): {
  scored: number;
  flagged: number;
  flaggedFiles: { file: string; low: NumericDimension[]; missing: BooleanBeat[] }[];
} {
  let scored = 0;
  const flaggedFiles: { file: string; low: NumericDimension[]; missing: BooleanBeat[] }[] = [];
  for (const { file, fm } of files) {
    const scores = parseDerisk(fm);
    if (!scores) continue;
    scored++;
    const low = lowDimensions(scores);
    const missing = missingBeats(scores);
    if (low.length || missing.length) flaggedFiles.push({ file, low, missing });
  }
  return { scored, flagged: flaggedFiles.length, flaggedFiles };
}
