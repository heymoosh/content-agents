import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { repoRoot } from "../db/db.js";
import { splitFrontmatter } from "../util/frontmatter.js";

// outreach:validate -- the lead-SHAPE half only: is lead.md's frontmatter/structure well-formed.
//   tsx src/outreach/validate.ts outreach/leads/client-acme-co
// This is deliberately NOT a full pipeline validator -- it does not check evidence quality,
// quote-required worldview matches, or classification legality (that's qualify.ts's job, run
// separately, against the research/qualify output). This module only answers: "is this lead.md
// shaped the way docs/outreach-engine-plan.md §3 says a lead.md must be shaped."

const VALID_KINDS = new Set(["client", "platform"]);
const VALID_SOURCES = new Set(["manual", "jsa", "discovered"]);
const VALID_STATUSES = new Set([
  "intake",
  "researched",
  "qualified",
  "pursue",
  "passed",
  "drafted",
  "locked",
]);
const VALID_CLASSIFICATIONS = new Set(["turnaround", "greenfield", "unclear", "disqualified"]);
const VALID_FITS = new Set(["strong", "partial", "weak", "disqualified"]);
const REQUIRED_SECTIONS = ["## Profile", "## Evidence", "## Classification", "## Pitch", "## Decision log"];

// Pure per-file check, exported so it can be unit-tested without a lead folder on disk.
export function checkLeadShape(file: string, fm: Record<string, unknown>, body: string): string[] {
  const violations: string[] = [];

  const kind = String(fm.kind ?? "");
  if (!VALID_KINDS.has(kind)) {
    violations.push(`${file}: kind must be "client" or "platform" (got "${kind}")`);
  }

  if (!fm.name || typeof fm.name !== "string" || !fm.name.trim()) {
    violations.push(`${file}: missing or empty "name" frontmatter`);
  }

  if (fm.url === undefined) {
    violations.push(`${file}: missing "url" frontmatter (may be an empty string, but the key must exist)`);
  }

  const source = String(fm.source ?? "");
  if (!VALID_SOURCES.has(source)) {
    violations.push(`${file}: source must be one of manual|jsa|discovered (got "${source}")`);
  }
  if (source === "jsa" && (!fm.jsa_verdict || typeof fm.jsa_verdict !== "string" || !fm.jsa_verdict.trim())) {
    violations.push(`${file}: source: jsa but missing "jsa_verdict" frontmatter (snapshot at intake requires it)`);
  }

  const status = String(fm.status ?? "");
  if (!VALID_STATUSES.has(status)) {
    violations.push(
      `${file}: status must be one of intake|researched|qualified|pursue|passed|drafted|locked (got "${status}")`,
    );
  }

  if (kind === "client") {
    const classification = String(fm.classification ?? "");
    if (!VALID_CLASSIFICATIONS.has(classification)) {
      violations.push(
        `${file}: kind: client requires classification in turnaround|greenfield|unclear|disqualified (got "${classification}")`,
      );
    }
    if (fm.fit !== undefined) {
      violations.push(`${file}: kind: client should not carry a "fit" field (that's the platform-kind field)`);
    }
  } else if (kind === "platform") {
    const fit = String(fm.fit ?? "");
    if (!VALID_FITS.has(fit)) {
      violations.push(`${file}: kind: platform requires fit in strong|partial|weak|disqualified (got "${fit}")`);
    }
    if (fm.classification !== undefined) {
      violations.push(`${file}: kind: platform should not carry a "classification" field (that's the client-kind field)`);
    }
  }

  if (fm.pitch_angle === undefined) {
    violations.push(`${file}: missing "pitch_angle" frontmatter (may be empty, but the key must exist)`);
  }

  for (const section of REQUIRED_SECTIONS) {
    if (!body.includes(section)) {
      violations.push(`${file}: missing required body section "${section}"`);
    }
  }

  return violations;
}

function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error("usage: tsx src/outreach/validate.ts <lead-folder>");
    process.exit(1);
  }
  const absDir = dir.startsWith("/") ? dir : join(repoRoot, dir);
  const leadPath = join(absDir, "lead.md");
  if (!existsSync(leadPath)) {
    console.error(`no lead.md: ${leadPath}`);
    process.exit(1);
  }
  const { fm, body } = splitFrontmatter(readFileSync(leadPath, "utf8"));
  const violations = checkLeadShape("lead.md", fm, body);
  if (violations.length) {
    console.error(`VALIDATION FAILED (${violations.length}):`);
    for (const v of violations) console.error(`  - ${v}`);
    process.exit(1);
  }
  console.log(`ok: ${dir} lead.md is well-formed`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
