import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { repoRoot } from "../db/db.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { extractSection, parseEvidence, type EvidenceItem } from "./qualify.js";

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

// Full-body read of one lead.md, for the review GUI's Outreach tab (card: web-discovery inbox --
// the prior GUI only ever read frontmatter via summarizeLead, discarding ## Profile/## Evidence/
// ## Classification/## Pitch entirely, which is exactly why that tab had no clickable sources or
// why-fit context). Reuses qualify.ts's own extractSection/parseEvidence rather than re-parsing
// the body a second way -- the same section slicing research.ts's merge logic depends on.
export interface LeadDetail extends LeadSummary {
  profile: string; // ## Profile (client/platform) -- doubles as the "what this is" summary for content-example
  evidence: EvidenceItem[]; // ## Evidence -- each item's `source` is a real, clickable URL when valid
  classificationNote: string; // ## Classification -- the why-fit reasoning (client/platform) or why-interesting note (content-example)
  pitch: string; // ## Pitch -- the pitch angle (client/platform) or tentative content angle (content-example)
  jsaStats: JsaStat[]; // stat-shaped lines parsed out of ## Profile (JSA-snapshot leads) -- table-ready
  profileRest: string; // ## Profile minus the jsaStats lines -- the prose worth reading, collapsed in the GUI
  muxinNotes: string; // ## Muxin notes -- Muxin's own free-text observations, appended via the GUI
  latestMessage: LeadMessage | null; // newest messages/message-NN.md, if this lead was ever drafted
  // The matchmaker read (design 3d): written to Muxin, not pitch-strategy prose. Emitted by the
  // updated /outreach research+qualify skills as frontmatter; empty strings on legacy leads (the
  // GUI falls back to pitchAngle labeled as a legacy read until the lead is re-qualified).
  whyThem: string; // "Why them, for you"
  whyMe: string; // "Why you, for them"
  whyMutual: string; // the one-paragraph mutual-fit read shown as the dossier headline
  segment: string; // platform | org-role | org-mission -- "" on legacy leads (GUI derives a display fallback)
  contacts: Contact[]; // ## Contacts -- the people at this lead (each gets its own follow-up clock)
  suggestedContacts: string[]; // evidence person: names not yet in ## Contacts (one-click add)
}

// One person at a lead (design 3d "WHO YOU'D REACH"): `## Contacts` body lines shaped
// `- <name> | <role>`. Parsed leniently -- a bare `- <name>` line is a contact with no role.
export interface Contact {
  name: string;
  role: string;
}

export function parseContacts(body: string): Contact[] {
  const section = extractSection(body, "## Contacts");
  const contacts: Contact[] = [];
  for (const line of section.split("\n")) {
    const m = line.match(/^-\s+(.+?)(?:\s*\|\s*(.*))?$/);
    if (m && m[1].trim()) contacts.push({ name: m[1].trim(), role: (m[2] ?? "").trim() });
  }
  return contacts;
}

// One stat-shaped line from a JSA-snapshot ## Profile (see intake.ts formatJsaSnapshot): the
// `- <label> (JSA): <value>` bullets plus the `JSA verdict:` / `JSA researched date:` header
// lines. Persona notes and prose paragraphs deliberately DON'T match -- they read better as text.
export interface JsaStat {
  label: string;
  value: string;
}

// Pure, exported for unit testing: split a ## Profile body into table-ready JSA stats and the
// remaining prose. Unmatched lines keep their original order.
export function parseJsaStats(profile: string): { stats: JsaStat[]; rest: string } {
  const stats: JsaStat[] = [];
  const rest: string[] = [];
  for (const line of profile.split("\n")) {
    const bullet = line.match(/^- (.+?) \(JSA\):\s*(.+)$/);
    const header = line.match(/^JSA (verdict|researched date):\s*(.+)$/);
    if (bullet) stats.push({ label: bullet[1].trim(), value: bullet[2].trim() });
    else if (header) stats.push({ label: `JSA ${header[1]}`, value: header[2].trim() });
    else rest.push(line);
  }
  return { stats, rest: rest.join("\n").replace(/\n{3,}/g, "\n\n").trim() };
}

// The newest drafted outreach message in a lead folder, for the Outreach tab's inline draft box.
export interface LeadMessage {
  file: string; // relative to the lead dir, e.g. "messages/message-02.md"
  channel: string;
  status: string; // draft | approved | locked
  recipient: string; // the person this message addresses ("" on legacy messages)
  body: string;
}

export function readLatestMessage(absDir: string): LeadMessage | null {
  const messagesDir = join(absDir, "messages");
  if (!existsSync(messagesDir)) return null;
  const files = readdirSync(messagesDir).filter((f) => /^message-\d+\.md$/.test(f)).sort();
  if (!files.length) return null;
  const file = files[files.length - 1];
  const { fm, body } = splitFrontmatter(readFileSync(join(messagesDir, file), "utf8"));
  return {
    file: `messages/${file}`,
    channel: String(fm.channel ?? ""),
    status: String(fm.status ?? "draft"),
    recipient: String(fm.recipient ?? ""),
    body: body.trim(),
  };
}

export function readLeadDetail(dir: string): LeadDetail {
  const absDir = dir.startsWith("/") ? dir : join(repoRoot, dir);
  const leadPath = join(absDir, "lead.md");
  const raw = readFileSync(leadPath, "utf8");
  const summary = summarizeLead(dir, raw);
  const { body } = splitFrontmatter(raw);
  const profile = extractSection(body, "## Profile").trim();
  const { stats, rest } = parseJsaStats(profile);
  const { fm } = splitFrontmatter(raw);
  const evidence = parseEvidence(body);
  const contacts = parseContacts(body);
  const known = new Set(contacts.map((c) => c.name.toLowerCase()));
  // Evidence `person:` fields carry occasional non-contacts: placeholder "(blank)"-style values,
  // and Muxin (a quote BY Muxin cited as evidence is not someone to reach).
  const suggestedContacts = [...new Set(
    evidence
      .map((e) => e.person.trim())
      .filter((p) => p && !p.startsWith("(") && !/^muxin\b/i.test(p) && !known.has(p.toLowerCase())),
  )];
  return {
    ...summary,
    profile,
    evidence,
    classificationNote: extractSection(body, "## Classification").trim(),
    pitch: extractSection(body, "## Pitch").trim(),
    jsaStats: stats,
    profileRest: rest,
    muxinNotes: extractSection(body, "## Muxin notes").trim(),
    latestMessage: readLatestMessage(absDir),
    whyThem: String(fm.why_them ?? "").trim(),
    whyMe: String(fm.why_me ?? "").trim(),
    whyMutual: String(fm.why_mutual ?? "").trim(),
    segment: String(fm.segment ?? "").trim(),
    contacts,
    suggestedContacts,
  };
}

// Every lead's full detail, for the GUI's single-fetch Outreach tab load. Leads are few (single-
// or low-double-digit count) and each file is tiny, so an N-file read per request is not worth
// caching or a separate detail endpoint -- kept as one function so /api/outreach/leads can just
// swap listLeads() for listLeadDetails() without changing its response shape's outer contract.
export function listLeadDetails(): LeadDetail[] {
  return listLeads().map((l) => readLeadDetail(l.dir));
}

// Fit-positive-first ordering for the target list, same "what can I act on" priority as
// STATUS_ORDER above but keyed on fit instead of status, since a target list is read for "which
// platforms are worth pitching," not "where is this lead in the pipeline."
const FIT_ORDER = ["strong", "partial", "weak", "disqualified"];

// outreach:status --targets -- a rendered target-list summary of platform-kind leads only
// (docs/outreach-engine-plan.md §6 Phase 3: the "maintain a target list" action seed for card
// 30772ba1, Growth via borrowed audiences, which /strategy folds into the weekly brief). Reuses
// listLeads()'s scan; adds no new filesystem or LLM surface.
export function renderTargetsList(leads: LeadSummary[]): string {
  const platforms = leads.filter((l) => l.kind === "platform");
  if (platforms.length === 0) {
    return "no platform-kind leads yet -- run `tsx src/outreach/intake.ts --kind platform ...` (or `/outreach add --kind platform`) to add one.";
  }
  const sorted = [...platforms].sort((a, b) => {
    const aRank = FIT_ORDER.indexOf(a.classificationOrFit);
    const bRank = FIT_ORDER.indexOf(b.classificationOrFit);
    const aKey = aRank === -1 ? FIT_ORDER.length : aRank;
    const bKey = bRank === -1 ? FIT_ORDER.length : bRank;
    return aKey !== bKey ? aKey - bKey : a.name.localeCompare(b.name);
  });
  const lines: string[] = [`BORROWED-AUDIENCE TARGET LIST (${sorted.length})`];
  for (const lead of sorted) {
    const angle = lead.pitchAngle.trim() || "(no pitch angle yet)";
    lines.push(`  ${lead.name} [fit: ${lead.classificationOrFit || "unclear"}] -- ${angle} -- ${lead.dir}`);
  }
  return lines.join("\n");
}

function main() {
  const leads = listLeads();
  if (process.argv.includes("--targets")) {
    console.log(renderTargetsList(leads));
    return;
  }
  console.log(renderStatusTable(leads));
  console.log(`\n${leads.length} lead${leads.length === 1 ? "" : "s"} total.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
