import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadSpinAngles, type SpinAngle } from "../atomize/spin.js";

// Angle-refresh drift check (docs/content-agents-backlog.md card 8ba83a4c): the four spin_angles
// in config/platforms.yaml were derived once from Muxin's Obsidian content-ideas and approved
// 2026-06-30. This module never re-derives or rewrites those angles — Claude does that judgment
// inline while running /strategy (reading the current content-ideas + config/pillars.yaml, the
// same "scripts do deterministic work, Claude does judgment" split as pillar tagging / storytelling
// scoring / the home-brand thread-check elsewhere in this pipeline). This module is the
// deterministic plumbing only: compare Claude's freshly-derived candidates against the encoded
// approved angles and report divergences. It only ever reads config/platforms.yaml
// (via loadSpinAngles) and never writes to it.

export interface AngleCandidate {
  channel: string;
  candidate: string;
  // Claude's own call on whether the candidate still matches the approved angle in substance.
  verdict?: string;
  rationale?: string;
}

export interface AngleComparison {
  channel: string;
  approved: string;
  candidate: string;
  drift: boolean;
  rationale?: string;
}

// Fail-safe like classifyThread in thread-check.ts: anything other than the literal "match"
// (omitted, misspelled, a stray boolean) surfaces as drift rather than silently passing.
export function classifyVerdict(verdict: unknown): "match" | "drift" {
  return verdict === "match" ? "match" : "drift";
}

// Match channel keys leniently (trim + case-fold): candidates are LLM-authored JSON, not a fixed
// enum, so "X" or " x " must still resolve to the "x" entry in config/platforms.yaml instead of
// silently reporting a real candidate as "no candidate derived this run".
function normalizeChannel(channel: string): string {
  return channel.trim().toLowerCase();
}

// One comparison per approved channel, sorted for stable output. A channel Claude didn't derive a
// candidate for this run surfaces as drift too (never silently dropped from the report).
export function compareAngles(
  candidates: AngleCandidate[],
  approved: Record<string, Pick<SpinAngle, "angle">>
): AngleComparison[] {
  const byChannel = new Map(candidates.map((c) => [normalizeChannel(c.channel), c]));
  return Object.keys(approved)
    .sort()
    .map((channel) => {
      const rawAngle = approved[channel]?.angle;
      if (typeof rawAngle !== "string") {
        throw new Error(`config/platforms.yaml spin_angles.${channel}.angle is missing or not a string`);
      }
      const approvedAngle = rawAngle.trim();
      const candidate = byChannel.get(normalizeChannel(channel));
      if (!candidate) {
        return {
          channel,
          approved: approvedAngle,
          candidate: "(no candidate derived this run)",
          drift: true,
          rationale: "no candidate was derived for this channel",
        };
      }
      return {
        channel,
        approved: approvedAngle,
        candidate: candidate.candidate.trim(),
        drift: classifyVerdict(candidate.verdict) === "drift",
        rationale: candidate.rationale,
      };
    });
}

export function divergencesOnly(comparisons: AngleComparison[]): AngleComparison[] {
  return comparisons.filter((c) => c.drift);
}

// Divergences only — a matching channel stays silent, never restated.
export function formatDriftReport(comparisons: AngleComparison[]): string {
  if (comparisons.length === 0) {
    return "No approved channel angles found in config/platforms.yaml (spin_angles is empty) — nothing to compare.";
  }
  const drifted = divergencesOnly(comparisons);
  if (drifted.length === 0) {
    return `No drift: all ${comparisons.length} channel angle(s) still match the approved angles in config/platforms.yaml.`;
  }
  const lines = [
    `Angle drift on ${drifted.length}/${comparisons.length} channel(s) — config/platforms.yaml is unchanged; Muxin re-approves any of these by hand:`,
    "",
  ];
  for (const c of drifted) {
    lines.push(`- ${c.channel}`);
    lines.push(`    approved:  ${c.approved}`);
    lines.push(`    candidate: ${c.candidate}`);
    if (c.rationale) lines.push(`    why:       ${c.rationale}`);
  }
  return lines.join("\n");
}

// Candidates JSON comes from the CLI (a literal or a file path) — untrusted shape until checked.
// Reject clearly here so a malformed/incomplete payload fails with an actionable message instead
// of an uncaught TypeError/SyntaxError deep inside compareAngles.
export function parseCandidates(text: string): AngleCandidate[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`candidates JSON is not valid JSON (${(err as Error).message})`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error('candidates JSON must be an array, e.g. \'[{"channel":"x","candidate":"...","verdict":"match|drift"}]\'');
  }
  const seen = new Set<string>();
  for (const item of parsed) {
    const channel = (item as Partial<AngleCandidate>)?.channel;
    const candidate = (item as Partial<AngleCandidate>)?.candidate;
    if (typeof channel !== "string" || !channel.trim()) {
      throw new Error(`each candidate needs a non-empty "channel" string, got: ${JSON.stringify(item)}`);
    }
    if (typeof candidate !== "string") {
      throw new Error(`candidate for channel "${channel}" needs a "candidate" string, got: ${JSON.stringify(item)}`);
    }
    const key = normalizeChannel(channel);
    if (seen.has(key)) {
      throw new Error(`duplicate channel "${channel}" in candidates JSON — one candidate per channel`);
    }
    seen.add(key);
  }
  return parsed as AngleCandidate[];
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error(
      'usage: tsx src/strategy/angle-refresh.ts \'[{"channel":"x","candidate":"...","verdict":"match|drift","rationale":"..."}]\' | candidates.json'
    );
    process.exit(1);
  }
  let candidates: AngleCandidate[];
  try {
    const text = arg.trim().startsWith("[") ? arg : readFileSync(arg, "utf8");
    candidates = parseCandidates(text);
  } catch (err) {
    console.error(`angle-refresh: ${(err as Error).message}`);
    process.exit(1);
  }
  const approved = loadSpinAngles();
  console.log(formatDriftReport(compareAngles(candidates, approved)));
}

// Run only as a CLI entry point — importing the pure functions for tests must not execute main()
// (which calls process.exit on bad args). Same guard as route.ts.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
