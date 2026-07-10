import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { repoRoot } from "../db/db.js";
import { splitFrontmatter } from "../util/frontmatter.js";

// outreach:status -- deterministic, non-LLM listing of every outreach/leads/*/lead.md, for
// `/outreach status` and the GUI's read-only lead review-queue surface (Phase 1 definition of
// done: "the /outreach skill (add/research/qualify/status)"). Pure filesystem scan +
// frontmatter read -- no judgment, no LLM call, nothing written to disk.
//   tsx src/outreach/status.ts

const LEADS_ROOT = join(repoRoot, "outreach", "leads");

export interface LeadSummary {
  dir: string; // relative to repoRoot, e.g. "outreach/leads/client-acme-co"
  kind: string;
  name: string;
  source: string;
  status: string;
  classificationOrFit: string;
  pitchAngle: string;
}

// Pure, exported for unit testing: turn one lead.md's raw text into a summary row. Kept separate
// from the real directory scan below so tests never need files on disk.
export function summarizeLead(dir: string, raw: string): LeadSummary {
  const { fm } = splitFrontmatter(raw);
  const kind = String(fm.kind ?? "");
  return {
    dir,
    kind,
    name: String(fm.name ?? ""),
    source: String(fm.source ?? ""),
    status: String(fm.status ?? ""),
    classificationOrFit: String(kind === "platform" ? (fm.fit ?? "") : (fm.classification ?? "")),
    pitchAngle: String(fm.pitch_angle ?? ""),
  };
}

// Real directory scan: every outreach/leads/<kind>-<slug>/lead.md on disk. A folder without a
// lead.md yet (mid-scaffold, or a stray dir) is skipped rather than crashing the whole listing.
export function listLeads(): LeadSummary[] {
  if (!existsSync(LEADS_ROOT)) return [];
  const entries = readdirSync(LEADS_ROOT, { withFileTypes: true }).filter((e) => e.isDirectory());
  const summaries: LeadSummary[] = [];
  for (const entry of entries) {
    const leadPath = join(LEADS_ROOT, entry.name, "lead.md");
    if (!existsSync(leadPath)) continue;
    const relDir = `outreach/leads/${entry.name}`;
    summaries.push(summarizeLead(relDir, readFileSync(leadPath, "utf8")));
  }
  return summaries.sort((a, b) => a.name.localeCompare(b.name));
}

// Muxin wants "what can I act on right now" before "what's still in the pipeline" -- pursue-ready
// leads first, cold/terminal statuses last. Any status not in this list (there shouldn't be one,
// validate.ts enforces the enum) still shows up, just after the known ones.
const STATUS_ORDER = ["pursue", "qualified", "researched", "intake", "drafted", "locked", "passed"];

export function groupByStatus(leads: LeadSummary[]): Map<string, LeadSummary[]> {
  const groups = new Map<string, LeadSummary[]>();
  for (const lead of leads) {
    const key = lead.status || "(no status)";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(lead);
  }
  return groups;
}

export function renderStatusTable(leads: LeadSummary[]): string {
  if (leads.length === 0) {
    return "no outreach leads yet -- run `tsx src/outreach/intake.ts` (or `/outreach add`) to add one.";
  }
  const groups = groupByStatus(leads);
  const orderedKeys = [
    ...STATUS_ORDER.filter((k) => groups.has(k)),
    ...[...groups.keys()].filter((k) => !STATUS_ORDER.includes(k)),
  ];
  const lines: string[] = [];
  for (const key of orderedKeys) {
    const group = groups.get(key)!;
    lines.push(`\n${key.toUpperCase()} (${group.length})`);
    for (const lead of group) {
      const field = lead.kind === "platform" ? "fit" : "classification";
      lines.push(`  ${lead.name} [${lead.kind}, ${lead.source}] ${field}=${lead.classificationOrFit} -- ${lead.dir}`);
    }
  }
  return lines.join("\n").trim();
}

function main() {
  const leads = listLeads();
  console.log(renderStatusTable(leads));
  console.log(`\n${leads.length} lead${leads.length === 1 ? "" : "s"} total.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
