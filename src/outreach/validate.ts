import { readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { repoRoot } from "../db/db.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { parseEvidence, LEAD_SOURCES } from "./qualify.js";

// outreach:validate -- two halves, dispatched by what kind of path is given:
//   tsx src/outreach/validate.ts outreach/leads/client-acme-co                       (lead shape)
//   tsx src/outreach/validate.ts outreach/leads/client-acme-co/messages/message-01.md (message shape)
//
// LEAD half: is lead.md's frontmatter/structure well-formed. Deliberately NOT a full pipeline
// validator -- it does not check evidence quality, quote-required worldview matches, or
// classification legality (that's qualify.ts's job, run separately, against the research/qualify
// output). This half only answers: "is this lead.md shaped the way
// docs/outreach-engine-plan.md §3 says a lead.md must be shaped."
//
// MESSAGE half (Phase 2, docs/outreach-engine-plan.md §3/§6): the mechanical two-sided guard.
// Refuses a drafted message whose `evidence` list is empty, whose evidence ids don't resolve to
// real E-ids in the lead's own `## Evidence` section, or whose `classification` is
// unclear/disqualified (you don't draft outreach off a non-fit). lock.ts re-runs this same check
// before ever locking a message, so a hand-edited/corrupted file can never become a legal
// /atomize source through the GUI's approve button.

// "content-example" (card: web-discovery inbox) is raw material for the separate, opt-in
// /brand-lens Inspiration mode -- a discovered product/company/org example, not an outreach
// target. It carries neither
// classification nor fit (see the kind-specific branch below); it reuses every other lead.md
// convention (required sections, evidence shape) unchanged.
const VALID_KINDS = new Set(["client", "platform", "peer", "content-example"]);
// Sourced from qualify.ts's LEAD_SOURCES so the two files can't drift on what a valid
// `source:` value is -- "ingested": pre-existing research (e.g. Muxin's Obsidian vault)
// snapshotted into a lead.md directly, distinct from "manual" (hand-typed intake), "jsa",
// "discovered", and "boardy" (a person/opportunity a networking-AI intro surfaced -- the intro
// itself is the citable evidence, same posture as an "ingested" vault citation).
const VALID_SOURCES: Set<string> = new Set(LEAD_SOURCES);
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
    violations.push(`${file}: kind must be "client", "platform", "peer", or "content-example" (got "${kind}")`);
  }

  if (!fm.name || typeof fm.name !== "string" || !fm.name.trim()) {
    violations.push(`${file}: missing or empty "name" frontmatter`);
  }

  if (fm.url === undefined) {
    violations.push(`${file}: missing "url" frontmatter (may be an empty string, but the key must exist)`);
  }

  const source = String(fm.source ?? "");
  if (!VALID_SOURCES.has(source)) {
    violations.push(`${file}: source must be one of ${LEAD_SOURCES.join("|")} (got "${source}")`);
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

  if (kind === "client" || kind === "peer") {
    const classification = String(fm.classification ?? "");
    if (!VALID_CLASSIFICATIONS.has(classification)) {
      violations.push(
        `${file}: kind: ${kind} requires classification in turnaround|greenfield|unclear|disqualified (got "${classification}")`,
      );
    }
    if (fm.fit !== undefined) {
      violations.push(`${file}: kind: ${kind} should not carry a "fit" field (that's the platform-kind field)`);
    }
  } else if (kind === "platform") {
    const fit = String(fm.fit ?? "");
    if (!VALID_FITS.has(fit)) {
      violations.push(`${file}: kind: platform requires fit in strong|partial|weak|disqualified (got "${fit}")`);
    }
    if (fm.classification !== undefined) {
      violations.push(`${file}: kind: platform should not carry a "classification" field (that's the client-kind field)`);
    }
  } else if (kind === "content-example") {
    if (fm.classification !== undefined) {
      violations.push(`${file}: kind: content-example should not carry a "classification" field`);
    }
    if (fm.fit !== undefined) {
      violations.push(`${file}: kind: content-example should not carry a "fit" field`);
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

const VALID_CHANNELS = new Set(["email", "linkedin-dm", "contact-form", "podcast-pitch"]);
const VALID_MESSAGE_STATUSES = new Set(["draft", "approved", "locked"]);
const ILLEGAL_MESSAGE_CLASSIFICATIONS = new Set(["unclear", "disqualified"]);
const ILLEGAL_MESSAGE_FITS = new Set(["weak", "disqualified"]);

// Pure per-file check, exported so it can be unit-tested without a lead folder on disk. Mirrors
// checkLeadShape's shape (a violations array of strings), plus the two-sided evidence-reference
// guard against `leadEvidenceIds` (the calling lead's own real E-ids, from its ## Evidence section).
export function checkMessageShape(file: string, fm: Record<string, unknown>, leadEvidenceIds: Set<string>): string[] {
  const violations: string[] = [];

  if (!fm.lead || typeof fm.lead !== "string" || !fm.lead.trim()) {
    violations.push(`${file}: missing "lead" frontmatter`);
  }

  const channel = String(fm.channel ?? "");
  if (!VALID_CHANNELS.has(channel)) {
    violations.push(`${file}: channel must be one of ${[...VALID_CHANNELS].join("|")} (got "${channel}")`);
  }

  const status = String(fm.status ?? "");
  if (!VALID_MESSAGE_STATUSES.has(status)) {
    violations.push(`${file}: status must be one of draft|approved|locked (got "${status}")`);
  }

  if (fm.classification === undefined && fm.fit === undefined) {
    violations.push(`${file}: missing "classification" (kind: client) or "fit" (kind: platform) frontmatter`);
  } else if (fm.classification !== undefined && fm.fit !== undefined) {
    violations.push(`${file}: message must carry "classification" OR "fit", not both`);
  } else if (fm.classification !== undefined) {
    const classification = String(fm.classification);
    if (ILLEGAL_MESSAGE_CLASSIFICATIONS.has(classification)) {
      violations.push(
        `${file}: classification is "${classification}" -- you don't draft outreach off a non-fit (turnaround|greenfield only)`,
      );
    }
  } else {
    const fit = String(fm.fit);
    if (ILLEGAL_MESSAGE_FITS.has(fit)) {
      violations.push(`${file}: fit is "${fit}" -- you don't draft outreach off a non-fit (strong|partial only)`);
    }
  }

  const evidence = fm.evidence;
  const evidenceIds = Array.isArray(evidence) ? evidence.map((e) => String(e)) : [];
  if (evidenceIds.length === 0) {
    violations.push(`${file}: "evidence" must be a non-empty array of evidence ids (the two-sided guard)`);
  } else {
    for (const id of evidenceIds) {
      if (!leadEvidenceIds.has(id)) {
        violations.push(`${file}: evidence id "${id}" does not exist in the lead's own ## Evidence section`);
      }
    }
  }

  return violations;
}

function validateLead(dir: string): void {
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

// Message mode resolves its lead folder structurally (messages/<file>.md's grandparent
// directory) rather than off the message's own `lead:` frontmatter string -- the same
// "navigate by directory join, not by embedded path" convention research.ts/qualify.ts/lock.ts
// use to find a lead's lead.md.
function validateMessage(file: string): void {
  const absFile = file.startsWith("/") ? file : join(repoRoot, file);
  if (!existsSync(absFile)) {
    console.error(`no such message file: ${absFile}`);
    process.exit(1);
  }
  const leadDir = dirname(dirname(absFile));
  const leadPath = join(leadDir, "lead.md");
  if (!existsSync(leadPath)) {
    console.error(`no lead.md found at ${leadPath} (expected messages/<file>.md under a lead folder)`);
    process.exit(1);
  }
  const { fm } = splitFrontmatter(readFileSync(absFile, "utf8"));
  const { body: leadBody } = splitFrontmatter(readFileSync(leadPath, "utf8"));
  const leadEvidenceIds = new Set(parseEvidence(leadBody).map((e) => e.id));
  const violations = checkMessageShape(basename(absFile), fm, leadEvidenceIds);
  if (violations.length) {
    console.error(`VALIDATION FAILED (${violations.length}):`);
    for (const v of violations) console.error(`  - ${v}`);
    process.exit(1);
  }
  console.log(`ok: ${file} message is well-formed and its evidence resolves against ${leadDir}`);
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error(
      "usage: tsx src/outreach/validate.ts <lead-folder>\n" +
        "   or: tsx src/outreach/validate.ts <lead-folder>/messages/message-NN.md",
    );
    process.exit(1);
  }
  const absArg = arg.startsWith("/") ? arg : join(repoRoot, arg);
  if (!existsSync(absArg)) {
    console.error(`no such path: ${absArg}`);
    process.exit(1);
  }
  if (statSync(absArg).isDirectory()) {
    validateLead(arg);
  } else {
    validateMessage(arg);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
