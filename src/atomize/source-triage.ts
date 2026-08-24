import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { repoRoot } from "../db/db.js";
import { splitFrontmatter } from "../util/frontmatter.js";

// Source triage (card b288d0da, Muxin-approved 2026-07-10 strategy session): a classification
// step at /atomize time that decides, ONCE per source, whether the piece carries a testable
// belief worth the LinkedIn/X case-skeleton treatment, is personal/reflective register that
// skips it entirely, or is a Build 2 fiction teaser that must never carry it. Claude judges this
// inline (same "Claude does judgment, writes it as a fact" pattern as pillar/spin/thread_check
// elsewhere in this pipeline — see SKILL.md step 2.5) and records the verdict in source.md
// frontmatter. Every downstream step — route.ts's routing decision, validate.ts's case-skeleton
// gate, the drafting instructions in SKILL.md step 4 — READS that fact via readSourceClass()
// below instead of re-judging it.
//
// Supersedes card 9a7656d9's ask to gate frame on/off on thin per-topic resonance data (see that
// card's DECISION in docs/content-agents-backlog.md). This register/frame-fit judgment is the
// gate now, not analytics.

export const SOURCE_CLASSES = ["frame-native", "reflective", "fiction-promo"] as const;
export type SourceClass = (typeof SOURCE_CLASSES)[number];

// Platforms that carry the LinkedIn/X case-skeleton beat template (config/platforms.yaml
// spin_angles.linkedin / .x) — the "conversion-facing treatment" a reflective source excludes
// from its platform subset entirely, per the card's bucket rules.
export const CASE_SKELETON_PLATFORMS: readonly string[] = ["linkedin", "x"];

function readSourceFm(dir: string): Record<string, unknown> {
  const p = join(dir, "source.md");
  if (!existsSync(p)) return {};
  return splitFrontmatter(readFileSync(p, "utf8")).fm;
}

// Normalize an arbitrary frontmatter value into a definite SourceClass, or undefined when unset
// / not one of the three approved buckets — fail-safe: never guess a bucket from a bad value.
export function classifySourceClass(fm: Record<string, unknown>): SourceClass | undefined {
  const v = fm.source_class;
  return typeof v === "string" && (SOURCE_CLASSES as readonly string[]).includes(v) ? (v as SourceClass) : undefined;
}

// READ the fact already recorded in <dir>/source.md — never re-derives the classification.
// Downstream callers (route.ts, validate.ts) use this, not their own judgment.
export function readSourceClass(dir: string): SourceClass | undefined {
  return classifySourceClass(readSourceFm(dir));
}

// READ <dir>/source.md's `source_kind` (e.g. "substack-note", written by new-notes.ts/
// new-content.ts). route.ts's applySubstackRepost hook (card df11d0db) uses this to decide
// whether a piece is a Note being reposted back to Substack — the only case `substack` is a legal
// routing target. Empty string when absent/unreadable, same convention as publish/cta.ts's
// loadSourceKind (duplicated here, not imported, so strategy/ doesn't reach into publish/).
export function readSourceKind(dir: string): string {
  const v = readSourceFm(dir).source_kind;
  return typeof v === "string" ? v.trim() : "";
}

// READ <dir>/source.md's `origin` — the fact new-content.ts/new-notes.ts recorded about where
// this piece came from (a live URL for a URL ingest, else `file:<name>`, `voice-memo:<name>` or
// `pasted-text`). route.ts's origin block (v5 handoff §9.9) uses this to refuse routing a piece
// back to the platform it is already live on. Empty string when absent/unreadable — same
// fail-open convention as readSourceKind above, so an unrecorded origin routes normally.
export function readSourceOrigin(dir: string): string {
  const v = readSourceFm(dir).origin;
  return typeof v === "string" ? v.trim() : "";
}

// The informational "no beat-2 belief statement found" side effect (see triageEffects doc below)
// — read the same way, from the same recorded fact, never re-derived.
export function hasMissingBeat2(dir: string): boolean {
  return readSourceFm(dir).source_class_beat2 === "not_found";
}

// Case-evidence fact (card f7b186c2, Muxin DECISION 2026-07-14): a narrower, separate judgment
// from beat2 above. beat2Found only asks whether a quotable belief statement exists — a derivative
// can satisfy that using Muxin's OWN autobiographical material (see spin-mode.md's counter-example,
// which PR #185 hit exactly this way). This fact asks the question the LinkedIn/X case-skeleton
// actually needs: does this SPECIFIC source contain a real, anonymize-able THIRD-PARTY case — a
// team/client situation, not Muxin's own story — with enough concrete detail (a situation, a
// quoted assumption, a cost) to extract into the case-skeleton beats? Judged once per source, same
// pattern as source_class/source_class_beat2. Extraction-only and CONDITIONAL per the DECISION:
// never force or invent a case when this reads "not_found" — fall back to the essay's own
// argument. validate.ts's checkCaseGate is the hard, code-level enforcement of that rule — a
// derivative may declare `case_skeleton: true` only when this fact reads "found", so the rule is
// an assertion the pipeline enforces, not merely a prompt hint.
export function readCaseEvidence(dir: string): "found" | "not_found" | undefined {
  const v = readSourceFm(dir).source_class_case;
  return v === "found" || v === "not_found" ? v : undefined;
}

export function hasCaseEvidence(dir: string): boolean {
  return readCaseEvidence(dir) === "found";
}

// WRITE the classification fact into source.md frontmatter. A text-level patch (insert lines
// before the closing `---`), not a full YAML re-serialize, so the rest of the block — including
// the canonical_url reminder comment scaffoldContentFolder writes — survives byte-for-byte, and
// re-triaging the same source is idempotent (old source_class*/lines are replaced, not doubled).
export function writeSourceClass(
  dir: string,
  sourceClass: SourceClass,
  opts?: { beat2Found?: boolean; caseEvidenceFound?: boolean }
): void {
  const p = join(dir, "source.md");
  const raw = readFileSync(p, "utf8");
  const { header, body } = splitFrontmatter(raw);
  if (!header) throw new Error(`source.md has no frontmatter block: ${p}`);
  const stripped = header.replace(/^source_class(_beat2|_case)?:.*\n/gm, "");
  const lines = [`source_class: ${sourceClass}`];
  if (opts?.beat2Found !== undefined) lines.push(`source_class_beat2: ${opts.beat2Found ? "found" : "not_found"}`);
  if (opts?.caseEvidenceFound !== undefined) {
    lines.push(`source_class_case: ${opts.caseEvidenceFound ? "found" : "not_found"}`);
  }
  if (!/---\n$/.test(stripped)) throw new Error(`source.md frontmatter block malformed: ${p}`);
  const patched = stripped.replace(/---\n$/, `${lines.join("\n")}\n---\n`);
  writeFileSync(p, `${patched}\n${body}\n`);
}

export interface TriageEffects {
  skeletonAllowed: boolean;
  excludePlatforms: string[];
}

// The bucket rules (Muxin-approved, docs/content-agents-backlog.md card b288d0da):
//  - frame-native: full fan-out, skeleton beats applied per platform dialect (existing default —
//    unchanged behavior).
//  - reflective: NO skeleton ever; excludes LinkedIn/X from the platform subset entirely (native
//    to Substack + Bluesky — home is the Human Inference landing page + newsletter once card
//    87c86b16 ships, Substack is the interim home).
//  - fiction-promo: NO skeleton (teasers stay in the existing extraction-first cliffhanger
//    style); platform subset is unaffected — pillar-driven routing still decides that normally.
export function triageEffects(sourceClass: SourceClass): TriageEffects {
  if (sourceClass === "reflective") return { skeletonAllowed: false, excludePlatforms: [...CASE_SKELETON_PLATFORMS] };
  if (sourceClass === "fiction-promo") return { skeletonAllowed: false, excludePlatforms: [] };
  return { skeletonAllowed: true, excludePlatforms: [] };
}

// The one-line confirmation Muxin sees in the triage UX (SKILL.md step 2.5) — matches the card's
// own worked examples ("frame-native -> LinkedIn/X/Bluesky", "reflective -> Substack/newsletter,
// no frame").
export function triageSummary(sourceClass: SourceClass): string {
  if (sourceClass === "reflective") {
    return "reflective -> Substack + Bluesky only, no frame (LinkedIn case format and X excluded)";
  }
  if (sourceClass === "fiction-promo") {
    return "fiction-promo -> Substack series; teasers fan out unframed (extraction-first cliffhanger style, no skeleton)";
  }
  return "frame-native -> full fan-out (LinkedIn/X/Bluesky), skeleton beats applied per platform dialect";
}

// The exact note appended for Muxin when triage found no beat-2-style belief statement in the
// source — informational only (helps her learn which essays lack "the move"), never blocking.
// Same notes-cell pattern as storytelling.ts's spinPassNote() / thread-check.ts's threadCheckNote().
export function beat2Note(dir: string): string | undefined {
  return hasMissingBeat2(dir) ? "flag: no beat-2 belief statement found" : undefined;
}

// The Muxin-facing flag for the case-evidence fact above — informational, same as beat2Note,
// never blocking. It exists so she sees, per source, whether the LinkedIn/X case-skeleton had
// real third-party material to draw on or fell back to normal spin.
export function caseNote(dir: string): string | undefined {
  return readCaseEvidence(dir) === "not_found"
    ? "flag: no anonymize-able third-party case found in source; LinkedIn/X case-skeleton falls back to normal (non-case) spin"
    : undefined;
}

// CLI shim (SKILL.md step 2.5): the tiny script Claude's inline classification judgment gets
// piped into, same pattern as src/db/tag-posts.ts for pillar tags. Claude does the judgment
// (reading the source, picking a bucket, checking for a beat-2 belief statement, checking for a
// real third-party case); this just writes the verdict to source.md and prints the Muxin-facing
// confirmation.
//   tsx src/atomize/source-triage.ts <content-folder> <frame-native|reflective|fiction-promo> [--beat2 found|not_found] [--case found|not_found]
function main() {
  const [dirArg, classArg, ...rest] = process.argv.slice(2);
  if (!dirArg || !classArg) {
    console.error(
      "usage: tsx src/atomize/source-triage.ts <content-folder> <frame-native|reflective|fiction-promo> [--beat2 found|not_found] [--case found|not_found]"
    );
    process.exit(1);
  }
  if (!(SOURCE_CLASSES as readonly string[]).includes(classArg)) {
    console.error(`invalid source class "${classArg}" — must be one of ${SOURCE_CLASSES.join(", ")}`);
    process.exit(1);
  }
  const sourceClass = classArg as SourceClass;

  let beat2Found: boolean | undefined;
  const beat2Idx = rest.indexOf("--beat2");
  if (beat2Idx >= 0) {
    const v = rest[beat2Idx + 1];
    if (v !== "found" && v !== "not_found") {
      console.error('--beat2 must be "found" or "not_found"');
      process.exit(1);
    }
    beat2Found = v === "found";
  }

  let caseEvidenceFound: boolean | undefined;
  const caseIdx = rest.indexOf("--case");
  if (caseIdx >= 0) {
    const v = rest[caseIdx + 1];
    if (v !== "found" && v !== "not_found") {
      console.error('--case must be "found" or "not_found"');
      process.exit(1);
    }
    caseEvidenceFound = v === "found";
  }

  const dir = dirArg.startsWith("/") ? dirArg : join(repoRoot, dirArg);
  writeSourceClass(dir, sourceClass, {
    beat2Found,
    caseEvidenceFound,
  });
  console.log(triageSummary(sourceClass));
  const note = beat2Note(dir);
  if (note) console.log(note);
  const cnote = caseNote(dir);
  if (cnote) console.log(cnote);
}

// Run only as a CLI entry point — importing these functions for tests/route.ts/validate.ts must
// not execute main().
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
