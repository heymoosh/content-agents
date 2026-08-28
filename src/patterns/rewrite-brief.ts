// Assembling the instruction that asks a model to make a draft perform better.
//
// Three earlier attempts got this wrong in the same direction, each by adding machinery. The frame
// bank ranked openers without reading the draft. `fit` read the draft but only for material already
// on the page, so a post that never wrote "I used to think" was told a belief reversal could not
// apply, which is nonsense: the writer knows what she used to think, it just is not typed yet. Then
// a first version of this module dumped twenty-two pattern descriptions into every request.
//
// What Muxin actually asked for is smaller. A stored prompt she can edit, a model she picks, one
// command. The corpus is the "more ideas" layer for iterations, not the opening move. That matches
// what the measurements showed: a capable model restructures prose unaided, and the corpus's real
// contribution is a specific, evidence-checked inventory to reach for when the first pass is not
// enough.
//
// So this module stays thin. It reads the stored prompt, optionally appends the pattern inventory,
// and attaches the draft. The judgment is the model's. The one thing held here and not delegated is
// the constraint that nothing gets invented in her voice, which lives in the prompt file itself.

import type { HookFrame } from "./hook-frame-library.js";

export const REWRITE_BRIEF_VERSION = "rewrite-brief-v2" as const;

export const REWRITE_PROMPT = "config/rewrite-prompt.md" as const;

export const MECHANISM_PROPOSALS =
  "docs/content-studio-program/staging/creator-mechanism-proposals-20260827/mechanism-proposals.jsonl" as const;

/** Families that describe how a piece is built, as opposed to how it opens. */
export const STRUCTURE_FAMILIES = [
  "structure",
  "storytelling-sequence",
  "retention",
  "framing",
  "cta",
] as const;

export interface MechanismProposal {
  readonly proposal_id: string;
  readonly family: string;
  readonly name: string;
  readonly mechanism: string;
  readonly platforms: readonly string[];
  readonly evidence_status: string;
  readonly support: { readonly entries: number; readonly distinct_creator_files: number };
  readonly evidence_limitations: readonly string[];
}

export class RewriteBriefError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RewriteBriefError";
  }
}

export function readMechanismProposals(jsonl: string): MechanismProposal[] {
  const rows: MechanismProposal[] = [];
  for (const [index, line] of jsonl.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch (error) {
      throw new RewriteBriefError(`proposal line ${index + 1} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    const row = parsed as MechanismProposal;
    if (typeof row?.proposal_id !== "string" || typeof row?.mechanism !== "string") {
      throw new RewriteBriefError(`proposal line ${index + 1} is missing proposal_id or mechanism`);
    }
    rows.push(row);
  }
  return rows;
}

export interface StoredPrompt {
  readonly base: string;
  readonly patterns: string;
}

/** Split the stored prompt into the part sent every time and the part sent only with patterns. */
export function parseStoredPrompt(markdown: string): StoredPrompt {
  const section = (name: string): string => {
    const match = new RegExp(`^##\\s+${name}\\s*$([\\s\\S]*?)(?=^##\\s|\\Z)`, "m").exec(markdown);
    return (match?.[1] ?? "").trim();
  };
  const base = section("base");
  if (!base) throw new RewriteBriefError(`${REWRITE_PROMPT} has no "## base" section`);
  return { base, patterns: section("patterns") };
}

export interface BriefInputs {
  readonly draft: string;
  readonly platform: string;
  readonly prompt: StoredPrompt;
  /** Append the corpus inventory. Off for a first pass, on when Muxin asks for more ideas. */
  readonly withPatterns: boolean;
  readonly frames: readonly HookFrame[];
  readonly proposals: readonly MechanismProposal[];
  /** Corpus top-quartile base rate, quoted so a count cannot be read as a promise. */
  readonly baseRate: number;
}

export interface AssembledBrief {
  readonly prompt: string;
  readonly openersOffered: number;
  readonly structuresOffered: number;
}

function openerLines(frames: readonly HookFrame[]): string[] {
  return frames.map((frame) => {
    const { instances, distinctCreatorFiles, topQuartileInstances, rankedInstances } = frame.support;
    const share = rankedInstances === 0 ? "not ranked" : `${topQuartileInstances}/${rankedInstances} top-quartile`;
    return `- [${frame.id}] ${frame.template}\n    when: ${frame.whenToUse}\n    seen in ${instances} posts across ${distinctCreatorFiles} creators, ${share}`;
  });
}

function structureLines(proposals: readonly MechanismProposal[]): string[] {
  return proposals.map((proposal) =>
    `- [${proposal.proposal_id}] (${proposal.family}) ${proposal.name}\n    ${proposal.mechanism}\n    seen in ${proposal.support.entries} posts across ${proposal.support.distinct_creator_files} creators`,
  );
}

export function assembleBrief(inputs: BriefInputs): AssembledBrief {
  if (!inputs.draft.trim()) throw new RewriteBriefError("draft is empty");

  const parts: string[] = [inputs.prompt.base];
  let openersOffered = 0;
  let structuresOffered = 0;

  if (inputs.withPatterns) {
    if (!inputs.prompt.patterns) throw new RewriteBriefError(`${REWRITE_PROMPT} has no "## patterns" section`);
    const openers = openerLines(inputs.frames);
    const structures = structureLines(inputs.proposals);
    if (openers.length === 0 && structures.length === 0) {
      throw new RewriteBriefError(`no patterns are in scope for ${inputs.platform}`);
    }
    openersOffered = openers.length;
    structuresOffered = structures.length;
    parts.push(
      inputs.prompt.patterns,
      "",
      "OPENING SHAPES:",
      ...openers,
      "",
      "STRUCTURAL PATTERNS:",
      ...structures,
      "",
      `Counts above are observational, with no control group. ${Math.round(inputs.baseRate * 100)}% is the rate at which any post lands in the top quarter of its own creator's results, so read a share against that and not as proof. Choose on fit.`,
    );
  }

  parts.push("", `MY DRAFT (${inputs.platform}):`, "---", inputs.draft.trim(), "---");
  return { prompt: parts.join("\n"), openersOffered, structuresOffered };
}

/** Patterns in scope for a platform: the structural families only, never the whole proposal set. */
export function scopeProposals(proposals: readonly MechanismProposal[], platform: string): MechanismProposal[] {
  const families = new Set<string>(STRUCTURE_FAMILIES);
  return proposals
    .filter((proposal) => families.has(proposal.family))
    .filter((proposal) => proposal.platforms.includes(platform))
    .sort((left, right) => (left.proposal_id < right.proposal_id ? -1 : 1));
}
