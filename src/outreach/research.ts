import "../util/env.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { repoRoot } from "../db/db.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { logCost } from "../util/cost-log.js";
import { loadOutreachConfig } from "./config.js";
import {
  parseEvidence,
  extractSection,
  setFrontmatterField,
  type EvidenceItem,
} from "./qualify.js";

// outreach:research: checkpointed evidence-gathering pass on an intake lead
// (docs/outreach-engine-plan.md stage 3, "research.ts -> claude-cli subprocess with web search;
// cited evidence into lead.md"). Headless Claude on Muxin's SUBSCRIPTION, $0 marginal
// (CLAUDE.md rule 6) -- same route as src/providers/polish/claude-cli.ts, but unlike that
// provider this call genuinely needs live WebSearch/WebFetch tool access (the prompt cannot
// embed "the internet" inline), so it passes --permission-mode acceptEdits, the one existing
// precedent for headless tool use in this repo (src/review/jobs.ts's runClaudeSpawn). This module
// still writes lead.md itself in plain TypeScript (mergeResearchIntoLead below) rather than
// letting Claude edit files directly, so acceptEdits is only ever exercised for search/fetch, not
// file writes.
//
//   tsx src/outreach/research.ts outreach/leads/client-acme-co
//
// Phase 1 supports kind: client only. kind: platform needs config/outreach/platforms.md, which is
// explicit Phase 3 scope (docs/outreach-engine-plan.md) and does not exist yet -- research.ts
// refuses a platform lead with a clear message rather than inventing an unreviewed rubric.

const execFileP = promisify(execFile);

const RUN_LOG_PATH = join(repoRoot, "data", "outreach", "run-log.jsonl");

const PLACEHOLDER_RE = /^\(.*\)$/;
function isPlaceholderSection(text: string): boolean {
  return PLACEHOLDER_RE.test(text.trim());
}

// Pure prompt assembly, exported so it can be unit-tested without shelling out to the CLI.
export function buildResearchPrompt(opts: {
  name: string;
  url: string;
  existingProfile: string;
  searchBudgetPerSignal: number;
  clientsRubric: string;
  worldviewMap: string;
  personFitRubric: string;
}): string {
  const profileBlock =
    opts.existingProfile.trim() && !isPlaceholderSection(opts.existingProfile)
      ? `Existing profile notes already on file (do not repeat verbatim, build on them):\n"""\n${opts.existingProfile.trim()}\n"""\n`
      : "";
  return [
    `You are running the RESEARCH stage of a client-fit outreach engine for Muxin Li (docs/outreach-engine-plan.md).`,
    `Target company: ${opts.name}`,
    `URL: ${opts.url || "(none given)"}`,
    ``,
    profileBlock,
    `--- CLIENT FIT RUBRIC (config/outreach/clients.md) ---`,
    opts.clientsRubric.trim(),
    ``,
    `--- WORLDVIEW MAP (config/outreach/worldview-map.md) ---`,
    opts.worldviewMap.trim(),
    ``,
    `--- PERSON-FIT RUBRIC (config/outreach/person-fit.md) ---`,
    opts.personFitRubric.trim(),
    ``,
    `--- YOUR TASK ---`,
    `Gather citable, specific evidence for this company, closed-checklist style:`,
    `1. Walk the turnaround signals, greenfield signals, and disqualifying signals from the client fit rubric above, one at a time. For each signal, search at most ${opts.searchBudgetPerSignal} times. If nothing turns up within that budget, record "no evidence found" for that signal and move on. Do not exceed the budget chasing one signal.`,
    `2. Separately, look for a worldview-match: a direct quote (with a working source link) from the company itself (founder, blog, press, job postings) that echoes one of the five worldview-map statements above, in the company's own words, not Muxin's phrasing. This is REQUIRED to be a real quote. If none exists, say so plainly, do not paraphrase or infer one.`,
    `3. Disconfirmation pass: separately search for evidence AGAINST the worldview match you just made (or against a worldview match existing at all if you found none). Look for signals the company does not share this belief: locked-down decision-making, executing someone else's roadmap, no public reflective content at all. Record what you searched for and what, if anything, you found, even if the honest answer is nothing found either way.`,
    `4. Person-fit pass: try to identify one named individual at the company (founder, exec, or a visible team member) who might be a genuine philosophical match. Apply the Philosophical Depth Probe tiers from the person-fit rubric above. Only report a person-fit evidence item if they rate Genuine depth or Developing WITH a direct quote backing it. If nobody clears that bar, do not report a person-fit item at all: that is a legitimate, expected outcome, not a failure.`,
    `5. Classify the company as exactly one of: turnaround, greenfield, unclear, disqualified, per the rubric above. If evidence is thin or mixed, use unclear, a real and expected outcome. Never round up to look more decisive.`,
    ``,
    `RULES:`,
    `- Every evidence item must have a real, working-looking source URL, and worldview-match and person-fit items must carry a real direct quote. No quote means no worldview-match or person-fit claim, full stop.`,
    `- Cite Glassdoor/Blind-style commentary as commentary, never as verified fact.`,
    `- No em dashes anywhere in your output. Use periods, commas, colons, or parentheses instead.`,
    `- Do not invent evidence. "No evidence found" is a legitimate, expected result for most signals.`,
    ``,
    `--- OUTPUT FORMAT (exact section markers, nothing before the first marker or after the last) ---`,
    `PROFILE:`,
    `<2-4 sentence plain-prose summary of what this company is and does, for someone who has never heard of it>`,
    ``,
    `EVIDENCE:`,
    `<one line per evidence item found, in exactly this shape, one item per line>`,
    `- E1 | signal: <turnaround|greenfield|disqualifying|worldview-match|person-fit> | person: <name, or blank for company-level signals> | source: <full https URL> | quote: <exact quote in double quotes, or (none) for non-quote signals> | <one-line description>`,
    ``,
    `DISCONFIRMATION:`,
    `<1-3 sentences: what you searched for as evidence against the worldview match, and what you found or did not find>`,
    ``,
    `CLASSIFICATION: <turnaround|greenfield|unclear|disqualified>`,
    `CLASSIFICATION_NOTE:`,
    `<1-2 short paragraphs of rationale citing the evidence item ids above, e.g. "per E2, E4". Must not assert a worldview match without citing a worldview-match evidence item that carries a real quote.>`,
    ``,
    `PITCH_ANGLE: <one sentence: the specific, honest angle a pitch to this company would use, naming the real match found, or "insufficient evidence for a pitch angle yet" if classification is unclear or disqualified>`,
  ].join("\n");
}

const RESPONSE_MARKERS = [
  "PROFILE",
  "EVIDENCE",
  "DISCONFIRMATION",
  "CLASSIFICATION_NOTE",
  "CLASSIFICATION",
  "PITCH_ANGLE",
];

export interface ParsedResearch {
  profile: string;
  evidenceBlock: string;
  evidence: EvidenceItem[];
  disconfirmation: string;
  classification: string;
  classificationNote: string;
  pitchAngle: string;
}

// Parses the section-marker output format above. Order-independent and tolerant of a missing
// section (falls back to an empty string / no evidence rather than throwing), since an LLM
// response is never guaranteed byte-perfect. Exported for unit testing.
export function parseResearchResponse(text: string): ParsedResearch {
  // CLASSIFICATION_NOTE must be matched before CLASSIFICATION since it shares the same prefix.
  const markerRe = new RegExp(`^(${RESPONSE_MARKERS.join("|")}):\\s*(.*)$`);
  const sections: Record<string, string[]> = {};
  let current: string | null = null;
  for (const line of text.split("\n")) {
    const m = line.match(markerRe);
    if (m) {
      current = m[1];
      sections[current] = sections[current] ?? [];
      if (m[2]) sections[current].push(m[2]);
      continue;
    }
    if (current) sections[current].push(line);
  }
  const get = (key: string) => (sections[key] ?? []).join("\n").trim();
  const evidenceBlock = get("EVIDENCE");
  const evidence = parseEvidence(`## Evidence\n\n${evidenceBlock}\n`);
  return {
    profile: get("PROFILE"),
    evidenceBlock,
    evidence,
    disconfirmation: get("DISCONFIRMATION"),
    classification: get("CLASSIFICATION").toLowerCase().trim(),
    classificationNote: get("CLASSIFICATION_NOTE"),
    pitchAngle: get("PITCH_ANGLE"),
  };
}

function formatEvidenceLine(item: EvidenceItem, index: number): string {
  return `- E${index} | signal: ${item.signal} | person: ${item.person} | source: ${item.source} | quote: ${item.quote} | ${item.description}`;
}

function yamlQuote(value: string): string {
  const oneLine = value.replace(/\s+/g, " ").trim();
  return `"${oneLine.replace(/"/g, '\\"')}"`;
}

function replaceSection(body: string, heading: string, transform: (old: string) => string): string {
  const lines = body.split("\n");
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start === -1) return body; // heading missing entirely -- validate.ts's shape check owns that
  const rest = lines.slice(start + 1);
  const relEnd = rest.findIndex((l) => l.trim().startsWith("## "));
  const end = relEnd === -1 ? lines.length : start + 1 + relEnd;
  const oldContent = lines.slice(start + 1, end).join("\n").trim();
  const nextContent = transform(oldContent).trim();
  return [...lines.slice(0, start + 1), "", nextContent, "", ...lines.slice(end)].join("\n");
}

// Pure merge of a parsed research response into an existing lead.md's header/body, exported so
// the merge logic (append vs replace, evidence renumbering, placeholder handling) can be unit
// tested without touching disk or a subprocess. kind is always "client" in Phase 1 (see the
// module comment above on why kind: platform is refused before this ever runs).
export function mergeResearchIntoLead(opts: {
  header: string;
  body: string;
  parsed: ParsedResearch;
}): { header: string; body: string } {
  const { parsed } = opts;
  const classification = parsed.classification || "unclear";

  let header = setFrontmatterField(opts.header, "classification", classification);
  header = setFrontmatterField(header, "status", "researched");
  header = setFrontmatterField(header, "pitch_angle", yamlQuote(parsed.pitchAngle || "(not yet drafted)"));

  let body = replaceSection(opts.body, "## Profile", (old) =>
    isPlaceholderSection(old) || !old ? parsed.profile || "(no profile summary returned)" : `${old}\n\n---\n\n${parsed.profile}`,
  );

  body = replaceSection(body, "## Evidence", (old) => {
    const oldItems = isPlaceholderSection(old) || !old ? [] : parseEvidence(`## Evidence\n\n${old}\n`);
    const combined = [...oldItems, ...parsed.evidence];
    if (combined.length === 0) return "(none yet)";
    return combined.map((item, i) => formatEvidenceLine(item, i + 1)).join("\n");
  });

  body = replaceSection(body, "## Classification", () => {
    const note = parsed.classificationNote || "(no rationale provided)";
    const disconfirmation = parsed.disconfirmation
      ? `\n\nDisconfirmation pass: ${parsed.disconfirmation}`
      : "";
    return `${note}${disconfirmation}`;
  });

  body = replaceSection(body, "## Pitch", () => parsed.pitchAngle || "(not yet drafted)");

  return { header, body };
}

export interface RunResearchResult {
  dir: string;
  name: string;
  classification: string;
  evidenceCount: number;
}

async function callClaudeResearch(prompt: string, timeoutMs: number): Promise<string> {
  const model = (process.env.CLAUDE_POLISH_MODEL ?? "sonnet").trim();
  let stdout: string;
  try {
    // --permission-mode acceptEdits: the one precedent in this repo (src/review/jobs.ts's
    // runClaudeSpawn) for letting a headless `claude -p` call use tools (WebSearch/WebFetch here)
    // without hanging on an interactive approval prompt. This call never lets Claude write files
    // itself -- mergeResearchIntoLead above owns every byte written to lead.md -- so acceptEdits
    // only ever gets exercised for search/fetch in practice.
    const r = await execFileP(
      "claude",
      ["-p", prompt, "--model", model, "--permission-mode", "acceptEdits"],
      { cwd: repoRoot, timeout: timeoutMs, maxBuffer: 20_000_000 },
    );
    stdout = r.stdout;
  } catch (e) {
    const err = e as { code?: string; killed?: boolean; stderr?: string };
    if (err.code === "ENOENT") {
      throw new Error("`claude` CLI not on PATH -- research.ts needs Claude Code installed");
    }
    if (err.killed) {
      throw new Error(`claude -p timed out after ${Math.round(timeoutMs / 60_000)}min during research`);
    }
    throw new Error(`claude -p failed: ${err.stderr?.trim() || (e instanceof Error ? e.message : String(e))}`);
  }
  const text = stdout.trim();
  if (!text) throw new Error("claude -p returned no text during research");
  return text;
}

export async function runResearch(dirArg: string): Promise<RunResearchResult> {
  const config = loadOutreachConfig();
  const absDir = dirArg.startsWith("/") ? dirArg : join(repoRoot, dirArg);
  const leadPath = join(absDir, "lead.md");
  if (!existsSync(leadPath)) throw new Error(`no lead.md found at ${absDir}`);
  const raw = readFileSync(leadPath, "utf8");
  const { fm, body, header } = splitFrontmatter(raw);

  const kind = fm.kind === "platform" ? "platform" : "client";
  if (kind === "platform") {
    throw new Error(
      "kind: platform has no fit profile yet (config/outreach/platforms.md is Phase 3 scope, not built in Phase 1). research.ts only supports kind: client for now.",
    );
  }

  const name = String(fm.name ?? dirArg);
  const url = String(fm.url ?? "");
  const existingProfile = extractSection(body, "## Profile");

  const clientsRubric = readFileSync(join(repoRoot, "config", "outreach", "clients.md"), "utf8");
  const worldviewMap = readFileSync(join(repoRoot, "config", "outreach", "worldview-map.md"), "utf8");
  const personFitRubric = readFileSync(join(repoRoot, "config", "outreach", "person-fit.md"), "utf8");

  const prompt = buildResearchPrompt({
    name,
    url,
    existingProfile,
    searchBudgetPerSignal: config.searchBudgetPerSignal,
    clientsRubric,
    worldviewMap,
    personFitRubric,
  });

  const timeoutMs = config.researchTimeoutMin * 60_000;
  const text = await callClaudeResearch(prompt, timeoutMs);
  const parsed = parseResearchResponse(text);

  const merged = mergeResearchIntoLead({ header, body, parsed });
  const date = new Date().toISOString().slice(0, 10);
  const logLine = `- ${date}: research pass (search_budget_per_signal=${config.searchBudgetPerSignal}, evidence_found=${parsed.evidence.length}, classification=${parsed.classification || "unclear"})`;
  const finalBody = `${merged.body.replace(/\n+$/, "")}\n${logLine}\n`;

  writeFileSync(leadPath, `${merged.header}\n${finalBody}`);

  mkdirSync(dirname(RUN_LOG_PATH), { recursive: true });
  const runLogEntry = {
    timestamp: new Date().toISOString(),
    dir: dirArg,
    name,
    kind,
    search_budget_per_signal: config.searchBudgetPerSignal,
    timeout_min: config.researchTimeoutMin,
    evidence_found: parsed.evidence.length,
    classification: parsed.classification || "unclear",
    disconfirmation_checked: Boolean(parsed.disconfirmation.trim()),
    model: (process.env.CLAUDE_POLISH_MODEL ?? "sonnet").trim(),
  };
  appendFileSync(RUN_LOG_PATH, JSON.stringify(runLogEntry) + "\n");

  logCost({ step: "outreach:research", detail: name, costUsd: 0 });

  return {
    dir: dirArg,
    name,
    classification: parsed.classification || "unclear",
    evidenceCount: parsed.evidence.length,
  };
}

function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error("usage: tsx src/outreach/research.ts <lead-folder>");
    process.exit(1);
  }
  runResearch(dir)
    .then((result) => {
      console.log(
        `${result.dir}: classification=${result.classification}, evidence_found=${result.evidenceCount}`,
      );
    })
    .catch((e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
