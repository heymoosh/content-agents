// Signals room data layer (Content Studio Riff 3e): deterministic reads of the latest strategy
// brief — the per-channel data-confidence table and the [DO MORE]/[TEST]/[DO LESS]
// recommendations — plus the one write this room owns: sending an adjustment to the repo's own
// backlog (docs/content-agents-backlog.md, Muxin's chosen target, 2026-07-17) as a prose_kanban
// card for the conductor pipeline to groom and build. Nothing here adopts anything by itself.

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { repoRoot } from "../db/db.js";

export interface ChannelConfidence {
  channel: string;
  posts: number;
  weeks: number;
  status: string; // "OK" or the INSUFFICIENT wording, verbatim from the brief
}

export interface BriefRecommendation {
  type: "DO MORE" | "TEST" | "DO LESS";
  title: string;
  rationale: string;
}

export interface SignalsRead {
  briefPath: string | null; // repo-relative, null when no brief exists yet
  briefDate: string | null;
  confidence: ChannelConfidence[];
  recommendations: BriefRecommendation[];
}

export function latestBriefFile(briefsDir: string = join(repoRoot, "briefs")): string | null {
  if (!existsSync(briefsDir)) return null;
  const files = readdirSync(briefsDir).filter((f) => /^\d{4}-\d{2}-\d{2}-strategy-brief\.md$/.test(f)).sort();
  return files.length ? files[files.length - 1] : null;
}

// Pure, exported for tests: parse the two Signals sections out of a brief's markdown.
export function parseBriefSignals(text: string): { confidence: ChannelConfidence[]; recommendations: BriefRecommendation[] } {
  const confidence: ChannelConfidence[] = [];
  const confSection = text.split(/^## Data confidence\s*$/m)[1]?.split(/^## /m)[0] ?? "";
  for (const line of confSection.split("\n")) {
    const m = line.match(/^\|\s*([a-z][\w-]*)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*([^|]+)\|/);
    if (m) confidence.push({ channel: m[1], posts: Number(m[2]), weeks: Number(m[3]), status: m[4].trim() });
  }
  const recommendations: BriefRecommendation[] = [];
  const recSection = text.split(/^## Recommendations\s*$/m)[1]?.split(/^## /m)[0] ?? "";
  const lines = recSection.split("\n");
  let current: BriefRecommendation | null = null;
  for (const line of lines) {
    const m = line.match(/^\d+\.\s+\*\*\[(DO MORE|TEST|DO LESS)\]\s*(.+?)\*\*\s*(.*)$/);
    if (m) {
      if (current) recommendations.push(current);
      current = { type: m[1] as BriefRecommendation["type"], title: m[2].trim().replace(/\.$/, ""), rationale: m[3].trim() };
      continue;
    }
    if (current) {
      if (/^\s*$/.test(line) && current.rationale) {
        recommendations.push(current);
        current = null;
      } else if (line.trim()) {
        current.rationale = `${current.rationale} ${line.trim()}`.trim();
      }
    }
  }
  if (current) recommendations.push(current);
  return { confidence, recommendations };
}

export function readSignals(briefsDir: string = join(repoRoot, "briefs")): SignalsRead {
  const file = latestBriefFile(briefsDir);
  if (!file) return { briefPath: null, briefDate: null, confidence: [], recommendations: [] };
  const parsed = parseBriefSignals(readFileSync(join(briefsDir, file), "utf8"));
  return {
    briefPath: `briefs/${file}`,
    briefDate: file.slice(0, 10),
    ...parsed,
  };
}

export const BACKLOG_PATH = join(repoRoot, "docs", "content-agents-backlog.md");

// Append ONE prose_kanban card for an adjustment Muxin chose to send. Dedupe by exact title —
// a double-click must not file the card twice. The card lands in Backlog (never To Do); the
// conductor pipeline's grooming decides everything after that.
export function appendBacklogCard(
  opts: { title: string; detail: string; briefPath: string | null; date: string },
  path: string = BACKLOG_PATH,
): { ok: boolean; error?: string } {
  if (!existsSync(path)) return { ok: false, error: `no backlog file at ${path}` };
  const text = readFileSync(path, "utf8");
  if (text.includes(`**${opts.title}**`)) return { ok: false, error: "already on the backlog" };
  const card = [
    ``,
    `**${opts.title}**`,
    `- ORIGIN: Signals room adjustment, sent by Muxin ${opts.date}${opts.briefPath ? ` (from ${opts.briefPath})` : ""}. The system works out where it applies (formatter default, skill prose, a check) and tracks whether it held.`,
    `- ${opts.detail}`,
    `- STATUS: Backlog`,
    `<!-- card-id: ${randomUUID()} -->`,
    ``,
  ].join("\n");
  writeFileSync(path, text.replace(/\n+$/, "\n") + card);
  return { ok: true };
}
