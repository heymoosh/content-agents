import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { repoRoot } from "../db/db.js";
import { splitFrontmatter } from "../util/frontmatter.js";

// outreach:qualify: deterministic, non-LLM legality check on a researched lead.md
// (docs/outreach-engine-plan.md §9f, "match verification before anything reaches Muxin").
//   tsx src/outreach/qualify.ts outreach/leads/client-acme-co
//
// This is a backstop on research.ts's LLM output, not another LLM call: it re-derives the
// classification/fit field from the ## Evidence section using code-level rules, and can only
// ever downgrade a claim, never upgrade one. Two legality rules apply to every lead:
//   1. a positive classification (turnaround/greenfield/strong/partial) with zero evidence items
//      is forced to unclear.
//   2. a positive classification with no valid, quoted "worldview-match" evidence item (real
//      quote + live source URL) is forced to unclear -- per config/outreach/clients.md, "no
//      quote means the values leg is unmet, not assumed."
// A third rule, the two-key jobsearch gate, applies only to source: jsa leads (JSA values-depth
// finding: a JSA verdict is a logistics-fit signal only, never a proxy for worldview alignment).
// A jsa-sourced lead needs BOTH a valid worldview-match item (company-level) and a valid
// person-fit item (a named, evidenced like-minded person, config/outreach/person-fit.md) before
// status can advance to "pursue". If a named person-fit match exists but the company side never
// clears, the person is still recorded as an anchor in config/outreach/anchors.md instead of
// being discarded.

export type LeadKind = "client" | "platform";
export type LeadSource = "manual" | "jsa" | "discovered" | "ingested";
export const LEAD_SOURCES: readonly LeadSource[] = ["manual", "jsa", "discovered", "ingested"];

const CLIENT_POSITIVE = new Set(["turnaround", "greenfield"]);
const PLATFORM_POSITIVE = new Set(["strong", "partial"]);
const PLACEHOLDER_SOURCES = new Set(["(none)", "none", "n/a", "na", "tbd", "unknown", ""]);
const PLACEHOLDER_QUOTES = new Set(["(none)", "none", "n/a", "na", "tbd", ""]);

// Evidence line shape (research.ts writes these, qualify.ts reads them):
//   - E1 | signal: worldview-match | person: | source: https://... | quote: "..." | one-line note
//   - E2 | signal: person-fit | person: Jane Doe | source: https://... | quote: "..." | one-line note
const EVIDENCE_LINE_RE =
  /^-\s*(E\d+)\s*\|\s*signal:\s*([^|]*?)\s*\|\s*person:\s*([^|]*?)\s*\|\s*source:\s*([^|]*?)\s*\|\s*quote:\s*([^|]*?)\s*\|\s*(.*)$/;

export interface EvidenceItem {
  id: string;
  signal: string;
  person: string;
  source: string;
  quote: string;
  description: string;
}

// Exported so research.ts (the LLM evidence-gathering pass) can reuse the exact same section
// slicing and frontmatter-field rewrite logic when it merges its findings into lead.md, instead
// of maintaining a second, possibly-drifting copy of this parsing.
export function extractSection(body: string, heading: string): string {
  const lines = body.split("\n");
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start === -1) return "";
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.trim().startsWith("## "));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n");
}

export function parseEvidence(body: string): EvidenceItem[] {
  const section = extractSection(body, "## Evidence");
  const items: EvidenceItem[] = [];
  for (const line of section.split("\n")) {
    const m = line.match(EVIDENCE_LINE_RE);
    if (!m) continue;
    items.push({
      id: m[1],
      signal: m[2].trim(),
      person: m[3].trim(),
      source: m[4].trim(),
      quote: m[5].trim(),
      description: m[6].trim(),
    });
  }
  return items;
}

export function isValidSourceUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed || PLACEHOLDER_SOURCES.has(trimmed.toLowerCase())) return false;
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    return new URL(trimmed).hostname.includes(".");
  } catch {
    return false;
  }
}

export function hasQuote(quote: string): boolean {
  const trimmed = quote.trim();
  return trimmed.length > 0 && !PLACEHOLDER_QUOTES.has(trimmed.toLowerCase());
}

export function isValidEvidenceItem(item: EvidenceItem): boolean {
  return hasQuote(item.quote) && isValidSourceUrl(item.source);
}

function findValidBySignal(items: EvidenceItem[], signal: string): EvidenceItem | undefined {
  return items.find((i) => i.signal === signal && isValidEvidenceItem(i));
}

export interface QualifyInput {
  kind: LeadKind;
  source: LeadSource;
  classification?: string;
  fit?: string;
  leadName: string;
  leadFile: string;
}

export interface QualifyResult {
  fieldName: "classification" | "fit";
  claimed: string;
  finalValue: string;
  status: string;
  downgraded: boolean;
  reasons: string[];
  anchorEntry?: { name: string; company: string; why: string };
}

// Pure decision function, exported for unit testing without touching disk.
export function evaluateQualify(input: QualifyInput, evidence: EvidenceItem[]): QualifyResult {
  const fieldName: "classification" | "fit" = input.kind === "client" ? "classification" : "fit";
  const claimed = (input.kind === "client" ? input.classification : input.fit) ?? "unclear";
  const positiveSet = input.kind === "client" ? CLIENT_POSITIVE : PLATFORM_POSITIVE;
  const reasons: string[] = [];
  let finalValue = claimed;

  if (claimed === "disqualified") {
    return { fieldName, claimed, finalValue: "disqualified", status: "passed", downgraded: false, reasons };
  }

  const worldviewMatch = findValidBySignal(evidence, "worldview-match");
  const personFit = findValidBySignal(evidence, "person-fit");

  // "unclear" is only a legal value for kind: "client" (classification); kind: "platform"'s
  // fit field only accepts strong|partial|weak|disqualified, so a platform-kind downgrade must
  // land on "weak" instead (config/outreach VALID_FITS in validate.ts).
  const downgradeTarget = input.kind === "client" ? "unclear" : "weak";

  if (positiveSet.has(claimed)) {
    if (evidence.length === 0) {
      finalValue = downgradeTarget;
      reasons.push(`claimed "${claimed}" with zero evidence items, forced to ${downgradeTarget}`);
    } else if (!worldviewMatch) {
      finalValue = downgradeTarget;
      reasons.push(
        `claimed "${claimed}" with no valid quoted worldview-match evidence (quote and live source required), forced to ${downgradeTarget}`,
      );
    }
  }

  const downgraded = finalValue !== claimed;
  let status: string;

  if (finalValue === "disqualified") {
    status = "passed";
  } else if (!positiveSet.has(finalValue)) {
    status = "qualified";
  } else if (input.source === "jsa" && !personFit) {
    status = "qualified";
    reasons.push(
      "jsa-sourced lead: company-level worldview-match cleared, but no named and evidenced person-fit found yet, two-key gate withholds pursue",
    );
  } else {
    status = "pursue";
  }

  let anchorEntry: QualifyResult["anchorEntry"];
  if (input.source === "jsa" && !positiveSet.has(finalValue) && personFit && personFit.person) {
    anchorEntry = {
      name: personFit.person,
      company: input.leadName,
      why: personFit.description || `named person-fit match at ${input.leadName} (see ${input.leadFile})`,
    };
  }

  return { fieldName, claimed, finalValue, status, downgraded, reasons, anchorEntry };
}

export function setFrontmatterField(header: string, field: string, value: string): string {
  const lines = header.split("\n");
  const idx = lines.findIndex((l) => l.startsWith(`${field}:`));
  if (idx === -1) return header;
  const line = lines[idx];
  const hashIdx = line.indexOf("#");
  const comment = hashIdx === -1 ? "" : "   " + line.slice(hashIdx);
  lines[idx] = `${field}: ${value}${comment}`;
  return lines.join("\n");
}

const ANCHORS_PATH = join(repoRoot, "config", "outreach", "anchors.md");

// Dedup by name + company substring match. Not a database, a small append-only reference file --
// a simple text check is enough to avoid re-appending the same anchor on every re-qualify run.
function appendAnchorIfNew(entry: { name: string; company: string; why: string }): boolean {
  if (!existsSync(ANCHORS_PATH)) return false;
  const text = readFileSync(ANCHORS_PATH, "utf8");
  if (text.includes(`**${entry.name}**`) && text.includes(entry.company)) return false;
  const line = `- **${entry.name}** @ ${entry.company}. Why this anchor: ${entry.why}\n`;
  writeFileSync(ANCHORS_PATH, text.replace(/\n+$/, "\n") + line);
  return true;
}

export interface QualifyRunResult extends QualifyResult {
  dir: string;
  anchorAppended: boolean;
}

export function runQualify(dirArg: string): QualifyRunResult {
  const absDir = dirArg.startsWith("/") ? dirArg : join(repoRoot, dirArg);
  const leadPath = join(absDir, "lead.md");
  const raw = readFileSync(leadPath, "utf8");
  const { fm, body, header } = splitFrontmatter(raw);

  const kind: LeadKind = fm.kind === "platform" ? "platform" : "client";
  const rawSource = String(fm.source ?? "manual");
  const source: LeadSource = (LEAD_SOURCES as string[]).includes(rawSource) ? (rawSource as LeadSource) : "manual";
  const relLeadFile = leadPath.startsWith(repoRoot) ? leadPath.slice(repoRoot.length + 1) : leadPath;

  const evidence = parseEvidence(body);
  const input: QualifyInput = {
    kind,
    source,
    classification: typeof fm.classification === "string" ? fm.classification : undefined,
    fit: typeof fm.fit === "string" ? fm.fit : undefined,
    leadName: String(fm.name ?? dirArg),
    leadFile: relLeadFile,
  };

  const result = evaluateQualify(input, evidence);

  let newHeader = setFrontmatterField(header, result.fieldName, result.finalValue);
  newHeader = setFrontmatterField(newHeader, "status", result.status);

  const date = new Date().toISOString().slice(0, 10);
  const logLines = [`- ${date}: qualify -> ${result.fieldName}=${result.finalValue}, status=${result.status}`];
  for (const reason of result.reasons) logLines.push(`  - ${reason}`);
  const newBody = `${body.replace(/\n+$/, "")}\n${logLines.join("\n")}\n`;

  writeFileSync(leadPath, `${newHeader}\n${newBody}`);

  let anchorAppended = false;
  if (result.anchorEntry) {
    anchorAppended = appendAnchorIfNew(result.anchorEntry);
  }

  return { ...result, dir: dirArg, anchorAppended };
}

function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error("usage: tsx src/outreach/qualify.ts <lead-folder>");
    process.exit(1);
  }
  const result = runQualify(dir);
  console.log(
    `${dir}: ${result.fieldName} ${result.claimed} -> ${result.finalValue} (status -> ${result.status})` +
      (result.downgraded ? " [downgraded]" : ""),
  );
  for (const reason of result.reasons) console.log(`  - ${reason}`);
  if (result.anchorAppended) console.log(`  anchor recorded: ${result.anchorEntry?.name} @ ${result.anchorEntry?.company}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
