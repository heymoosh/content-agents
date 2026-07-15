import "../util/env.js";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { repoRoot } from "../db/db.js";
import { slugify } from "../util/slug.js";
import { loadOutreachConfig } from "./config.js";
import { lookupCompany, listByVerdict, type JsaRecord } from "./jsa.js";

// outreach:add: scaffold outreach/leads/<kind>-<slug>/lead.md (docs/outreach-engine-plan.md §3).
//   tsx src/outreach/intake.ts --kind client --name "Acme Co" --url https://acme.co
//   tsx src/outreach/intake.ts --from-jsa --verdict TARGET "PostHog"
//   tsx src/outreach/intake.ts --from-jsa --verdict TARGET --limit 3
//
// --from-jsa is a bulk-import surface reading a sibling repo's data (job-search-agent's
// manual_research.db via jsa.ts) so it carries its own refusal rule, independent of jsa.ts's own
// guards: it MUST be given --verdict, AND either a specific company name or --limit N. Bare
// `--from-jsa` with neither is refused outright, no accidental full-db pull.

export type LeadKind = "client" | "platform";

export interface ManualIntakeSource {
  kind: LeadKind;
  name: string;
  url?: string;
}

export interface JsaIntakeSource {
  record: JsaRecord;
  verdicts: string[];
}

function leadDir(kind: LeadKind, name: string): string {
  return join(repoRoot, "outreach", "leads", `${kind}-${slugify(name)}`);
}

function decisionLogLine(note: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `- ${date}: ${note}`;
}

// JSA fields worth snapshotting into ## Profile: every non-empty note field, plus the two
// narrative fields. Blank fields are skipped so a thin JSA row (most TARGET rows have empty
// culture_notes/sources, see jsa.ts) doesn't pad the profile with empty bullet points.
function formatJsaSnapshot(record: JsaRecord): string {
  const lines: string[] = [];
  lines.push(`Snapshotted from JSA (job-search-agent) manual_research.db at intake.`);
  lines.push(`JSA verdict: ${record.verdict ?? "(none)"}`);
  if (record.domain) lines.push(`Domain: ${record.domain}`);
  if (record.researchedDate) lines.push(`JSA researched date: ${record.researchedDate}`);
  const notes: [string, string][] = [
    ["Remote", record.remoteNotes],
    ["Parental leave", record.parentalLeaveNotes],
    ["PM hiring", record.pmHiringNotes],
    ["Red flags", record.redFlagsNotes],
    ["Salary", record.salaryNotes],
    ["Culture", record.cultureNotes],
    ["Async", record.asyncNotes],
    ["Other benefits", record.otherBenefitsNotes],
    ["PM role quality", record.pmRoleQualityNotes],
    ["Job protection", record.jobProtectionNotes],
    ["Work/life balance", record.workLifeBalanceNotes],
    ["Hiring signals", record.hiringSignalsNotes],
  ];
  for (const [label, note] of notes) {
    if (note.trim()) lines.push(`- ${label} (JSA): ${note.trim()}`);
  }
  if (record.persona.trim()) lines.push(`\nJSA persona note: ${record.persona.trim()}`);
  if (record.founderPersona.trim()) lines.push(`\nJSA founder persona note: ${record.founderPersona.trim()}`);
  if (record.sources.trim()) lines.push(`\nJSA sources: ${record.sources.trim()}`);
  lines.push(
    "\nNote (JSA values-depth finding): a JSA verdict is a logistics-fit signal only (remote," +
      " pay, benefits, role quality) -- never a proxy for worldview alignment. This lead still" +
      " needs its own quote-required worldview qualify from scratch (config/outreach/clients.md," +
      " config/outreach/worldview-map.md) before it can reach `pursue`.",
  );
  return lines.join("\n");
}

function writeLeadFile(dir: string, opts: {
  kind: LeadKind;
  name: string;
  url: string;
  source: "manual" | "jsa" | "discovered";
  jsaVerdict?: string | null;
  profileSeed?: string;
  decisionNote: string;
}): void {
  const fitField =
    opts.kind === "client" ? "classification: unclear   # turnaround | greenfield | unclear | disqualified" : "fit: weak   # strong | partial | weak | disqualified";
  const jsaLine = opts.source === "jsa" ? `\njsa_verdict: ${opts.jsaVerdict ?? "unknown"}` : "";
  const frontmatter =
    `---\n` +
    `kind: ${opts.kind}\n` +
    `name: "${opts.name.replace(/"/g, '\\"')}"\n` +
    `url: "${opts.url.replace(/"/g, '\\"')}"\n` +
    `source: ${opts.source}${jsaLine}\n` +
    `status: intake   # intake | researched | qualified | pursue | passed | drafted | locked\n` +
    `${fitField}\n` +
    `pitch_angle: \n` +
    `---\n`;
  const profile = opts.profileSeed ? `${opts.profileSeed}\n` : "(not yet researched)\n";
  const body =
    `\n## Profile\n\n${profile}` +
    `\n## Evidence\n\n(none yet)\n` +
    `\n## Classification\n\n(not yet classified)\n` +
    `\n## Pitch\n\n(not yet drafted)\n` +
    `\n## Decision log\n\n${decisionLogLine(opts.decisionNote)}\n`;
  writeFileSync(join(dir, "lead.md"), frontmatter + body);
  writeFileSync(
    join(dir, "review-queue.md"),
    `# Outreach review queue -- ${opts.name}\n\n` +
      `Populated by \`npm run outreach:draft\`. Rows below surface in the review GUI; Approve calls\n` +
      `\`outreach:lock\`, never a scheduler -- nothing here sends or publishes anything.\n`,
  );
}

// Manual add: `--kind client|platform --name "..." [--url ...]`. Throws "already exists: <dir>"
// if the folder is already there (mirrors src/atomize/new-content.ts's scaffoldContentFolder).
export function intakeManual(src: ManualIntakeSource): string {
  const dir = leadDir(src.kind, src.name);
  if (existsSync(join(dir, "lead.md"))) throw new Error(`already exists: ${dir}`);
  mkdirSync(join(dir, "messages"), { recursive: true });
  writeLeadFile(dir, {
    kind: src.kind,
    name: src.name,
    url: src.url ?? "",
    source: "manual",
    decisionNote: "intake (manual)",
  });
  return dir;
}

// JSA-sourced add for one already-resolved record. Always kind: client -- JSA verdicts are about
// companies as potential employers/clients, not podcasts/platforms; see the plan's kind enum
// (client | platform) and 2a's "company name + domain + JSA verdict" handoff shape. Skips (does
// not throw) if the folder already exists, since batch imports must not abort on one collision --
// callers should check the return value.
export function intakeFromJsaRecord(record: JsaRecord): { dir: string; created: boolean } {
  const dir = leadDir("client", record.companyName);
  if (existsSync(join(dir, "lead.md"))) return { dir, created: false };
  mkdirSync(join(dir, "messages"), { recursive: true });
  const url = record.domain ? `https://${record.domain}` : "";
  writeLeadFile(dir, {
    kind: "client",
    name: record.companyName,
    url,
    source: "jsa",
    jsaVerdict: record.verdict,
    profileSeed: formatJsaSnapshot(record),
    decisionNote: `intake (jsa, verdict=${record.verdict ?? "unknown"})`,
  });
  return { dir, created: true };
}

export interface JsaImportRequest {
  verdicts: string[];
  companyName?: string;
  limit?: number;
}

export interface JsaImportResult {
  created: string[];
  skipped: { name: string; reason: string }[];
}

// The refusal rule this module exists to enforce: --from-jsa requires --verdict AND either a
// specific company name or --limit N. Bare `--from-jsa` (no verdict, no name, no limit) throws.
export function intakeFromJsa(req: JsaImportRequest): JsaImportResult {
  if (!req.verdicts || req.verdicts.length === 0) {
    throw new Error(
      "--from-jsa requires --verdict <VERDICT[,VERDICT2,...]> -- refusing an unfiltered JSA pull.",
    );
  }
  if (!req.companyName && !req.limit) {
    throw new Error(
      "--from-jsa requires either a company name argument or --limit N -- refusing a bare bulk import.",
    );
  }

  const created: string[] = [];
  const skipped: { name: string; reason: string }[] = [];

  if (req.companyName) {
    const record = lookupCompany(req.companyName);
    if (!record) {
      skipped.push({ name: req.companyName, reason: "not found in JSA's manual_research.db" });
      return { created, skipped };
    }
    const verdictMatches = req.verdicts.some(
      (v) => (record.verdict ?? "").toLowerCase() === v.toLowerCase(),
    );
    if (!verdictMatches) {
      skipped.push({
        name: record.companyName,
        reason: `JSA verdict "${record.verdict ?? "(none)"}" does not match requested --verdict ${req.verdicts.join(",")}`,
      });
      return { created, skipped };
    }
    const { dir, created: wasCreated } = intakeFromJsaRecord(record);
    if (wasCreated) created.push(dir);
    else skipped.push({ name: record.companyName, reason: `already exists: ${dir}` });
    return { created, skipped };
  }

  const config = loadOutreachConfig();
  const cappedLimit = Math.max(1, Math.min(req.limit ?? config.batchCap, config.batchCap));
  const records = listByVerdict(req.verdicts, cappedLimit);
  for (const record of records) {
    const { dir, created: wasCreated } = intakeFromJsaRecord(record);
    if (wasCreated) created.push(dir);
    else skipped.push({ name: record.companyName, reason: `already exists: ${dir}` });
  }
  return { created, skipped };
}

function parseArgs(argv: string[]): {
  fromJsa: boolean;
  verdicts: string[];
  limit?: number;
  kind: LeadKind;
  name?: string;
  url?: string;
  positional?: string;
} {
  let fromJsa = false;
  let verdicts: string[] = [];
  let limit: number | undefined;
  let kind: LeadKind = "client";
  let name: string | undefined;
  let url: string | undefined;
  let positional: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--from-jsa") fromJsa = true;
    else if (a === "--verdict") verdicts = (argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--limit") limit = Number(argv[++i]);
    else if (a === "--kind") kind = argv[++i] as LeadKind;
    else if (a === "--name") name = argv[++i];
    else if (a === "--url") url = argv[++i];
    else if (!a.startsWith("--")) positional = a;
  }
  return { fromJsa, verdicts, limit, kind, name, url, positional };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.fromJsa) {
    const result = intakeFromJsa({
      verdicts: args.verdicts,
      companyName: args.positional,
      limit: args.limit,
    });
    for (const dir of result.created) console.log(`created: ${dir}`);
    for (const s of result.skipped) console.log(`skipped: ${s.name} (${s.reason})`);
    if (result.created.length === 0 && result.skipped.length === 0) {
      console.log("no matching JSA rows");
    }
    return;
  }

  const name = args.name ?? args.positional;
  if (!name) {
    console.error(
      "usage: tsx src/outreach/intake.ts --kind client|platform --name \"...\" [--url ...]\n" +
        '   or: tsx src/outreach/intake.ts --from-jsa --verdict TARGET "Company Name"\n' +
        "   or: tsx src/outreach/intake.ts --from-jsa --verdict TARGET --limit N",
    );
    process.exit(1);
  }
  if (args.kind !== "client" && args.kind !== "platform") {
    console.error(`--kind must be "client" or "platform" (got "${args.kind}")`);
    process.exit(1);
  }
  const dir = intakeManual({ kind: args.kind, name, url: args.url });
  console.log(dir);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
