import "../util/env.js";
import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync, unlinkSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { repoRoot } from "../db/db.js";
import { slugify } from "../util/slug.js";
import { logCost } from "../util/cost-log.js";
import { loadOutreachConfig } from "../outreach/config.js";
import { listLeads } from "../outreach/status.js";
import { runQualify } from "../outreach/qualify.js";
import { buildResearchSettings } from "../outreach/research.js";
import {
  buildClientPlatformDiscoveryPrompt,
  parseClientPlatformDiscoveryCandidates,
  buildContentExampleDiscoveryPrompt,
  parseContentExampleDiscoveryCandidates,
  computeDiscoveryBudget,
  type ClientPlatformDiscoveryCandidate,
  type ContentExampleDiscoveryCandidate,
} from "./prompt.js";
import type { EvidenceItem } from "../outreach/qualify.js";

// discovery:discover -- the /scout skill's backend. Finds real, cited candidates across three
// kinds (client, platform, content-example) via bounded web search, and writes each one straight
// into a decision-gated lead folder -- outreach/leads/<kind>-<slug>/lead.md -- reusing the SAME
// folder/schema/GUI machinery outreach already has, rather than inventing a parallel inbox format.
// Nothing here ever contacts anyone or spends without Muxin's say-so: a discovered lead lands at
// status intake/researched, same as a manually-added one, and only Muxin's own approve action in
// the review GUI (or `npm run outreach:draft` / a /brand-lens run) acts on it further.
//
//   tsx src/discovery/discover.ts [--kinds client,platform,content-example] [--theme "..."] [--limit N]
//
// Default kinds = all three; default theme = the pillars.yaml signal list (config/pillars.yaml);
// default limit = 3 candidates per kind. One `claude -p` call per kind (not per pillar) keeps a
// run to at most 3 subprocess calls regardless of theme breadth.

const execFileP = promisify(execFile);

export type DiscoveryKind = "client" | "platform" | "content-example";
export const DISCOVERY_KINDS: readonly DiscoveryKind[] = ["client", "platform", "content-example"];

const RUN_LOG_PATH = join(repoRoot, "data", "discovery", "run-log.jsonl");
const DEFAULT_TIMEOUT_MS = 10 * 60_000; // flat, generous timeout for a whole multi-candidate pass

function leadDir(kind: DiscoveryKind, name: string): string {
  return join(repoRoot, "outreach", "leads", `${kind}-${slugify(name)}`);
}

// Same exact-slug dedup convention intake.ts's intakeFromJsaRecord uses (not fuzzy matching --
// that's idea-scout's domain, out of scope here): skip a candidate whose slug already exists
// rather than overwriting or erroring the whole run.
function existingNamesForKind(kind: DiscoveryKind): string[] {
  return listLeads()
    .filter((l) => l.kind === kind)
    .map((l) => l.name);
}

function formatEvidenceLines(evidence: EvidenceItem[]): string {
  if (evidence.length === 0) return "(none yet)";
  return evidence
    .map((item, i) => `- E${i + 1} | signal: ${item.signal} | person: ${item.person} | source: ${item.source} | quote: ${item.quote} | ${item.description}`)
    .join("\n");
}

function yamlQuote(value: string): string {
  const oneLine = value.replace(/\s+/g, " ").trim();
  return `"${oneLine.replace(/"/g, '\\"')}"`;
}

function decisionLogLine(note: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `- ${date}: ${note}`;
}

function scaffoldReviewQueue(dir: string, name: string): void {
  writeFileSync(
    join(dir, "review-queue.md"),
    `# Outreach review queue -- ${name}\n\n` +
      `Populated by \`npm run outreach:draft\`. Rows below surface in the review GUI; Approve calls\n` +
      `\`outreach:lock\`, never a scheduler -- nothing here sends or publishes anything.\n`,
  );
}

export interface WriteResult {
  dir: string;
  created: boolean;
}

// Pure text builders, split out from the disk-writing functions below them so the file SHAPE is
// unit-testable without touching the real outreach/leads/ tree -- mirrors research.ts's own
// mergeResearchIntoLead (pure merge) vs runResearch (disk + subprocess, only guard-clause tested).
export function buildClientPlatformLeadFile(
  kind: "client" | "platform",
  candidate: ClientPlatformDiscoveryCandidate,
  theme: string,
): string {
  const fieldName = kind === "client" ? "classification" : "fit";
  const defaultValue = kind === "client" ? "unclear" : "weak";
  const classification = candidate.classification || defaultValue;

  const frontmatter =
    `---\n` +
    `kind: ${kind}\n` +
    `name: "${candidate.name.replace(/"/g, '\\"')}"\n` +
    `url: "${candidate.url.replace(/"/g, '\\"')}"\n` +
    `source: discovered\n` +
    `status: researched   # intake | researched | qualified | pursue | passed | drafted | locked\n` +
    `${fieldName}: ${classification}\n` +
    `pitch_angle: ${yamlQuote(candidate.pitchAngle || "(not yet drafted)")}\n` +
    `---\n`;

  const disconfirmation = candidate.disconfirmation ? `\n\nDisconfirmation pass: ${candidate.disconfirmation}` : "";
  const body =
    `\n## Profile\n\n${candidate.profile || "(no profile summary returned)"}\n` +
    `\n## Evidence\n\n${formatEvidenceLines(candidate.evidence)}\n` +
    `\n## Classification\n\n${candidate.classificationNote || "(no rationale provided)"}${disconfirmation}\n` +
    `\n## Pitch\n\n${candidate.pitchAngle || "(not yet drafted)"}\n` +
    `\n## Decision log\n\n${decisionLogLine(`discovered via /scout (theme: "${theme}")`)}\n`;

  return frontmatter + body;
}

// Reuses the SAME required sections (## Profile/## Evidence/## Classification/## Pitch/
// ## Decision log) validate.ts's checkLeadShape already requires for every kind, just relabeled
// in content: ## Classification holds "why this is a good example" (not a legality classification),
// ## Pitch holds the tentative content angle. No classification/fit frontmatter field is written --
// content-example carries neither (see validate.ts's kind: "content-example" branch).
export function buildContentExampleLeadFile(candidate: ContentExampleDiscoveryCandidate, theme: string): string {
  const frontmatter =
    `---\n` +
    `kind: content-example\n` +
    `name: "${candidate.name.replace(/"/g, '\\"')}"\n` +
    `url: "${candidate.url.replace(/"/g, '\\"')}"\n` +
    `source: discovered\n` +
    `status: intake   # intake | pursue | passed\n` +
    `pitch_angle: ${yamlQuote(candidate.angle || "(not yet drafted)")}\n` +
    `---\n`;

  const body =
    `\n## Profile\n\n${candidate.why || "(no summary returned)"}\n` +
    `\n## Evidence\n\n${formatEvidenceLines(candidate.evidence)}\n` +
    `\n## Classification\n\n${candidate.why || "(no rationale provided)"}\n` +
    `\n## Pitch\n\n${candidate.angle || "(not yet drafted)"}\n` +
    `\n## Decision log\n\n${decisionLogLine(`discovered via /scout (theme: "${theme}")`)}\n`;

  return frontmatter + body;
}

// Writes a discovered client/platform candidate straight into a fully-populated lead.md (status:
// researched, real evidence/classification already filled in from the discovery pass -- unlike
// intake.ts's writeLeadFile, which scaffolds an empty "not yet researched" placeholder). Then
// immediately runs qualify.ts's own evaluateQualify/runQualify backstop on the freshly-written
// file: a model's positive classification claim is code-checked (real evidence, a real quoted
// worldview-match) and downgraded if it doesn't hold up, before Muxin ever sees it -- the exact
// same legality gate a manually-researched lead goes through, never skipped for a discovered one.
export function writeClientPlatformLead(
  kind: "client" | "platform",
  candidate: ClientPlatformDiscoveryCandidate,
  theme: string,
): WriteResult {
  const dir = leadDir(kind, candidate.name);
  if (existsSync(join(dir, "lead.md"))) return { dir, created: false };
  mkdirSync(join(dir, "messages"), { recursive: true });

  writeFileSync(join(dir, "lead.md"), buildClientPlatformLeadFile(kind, candidate, theme));
  scaffoldReviewQueue(dir, candidate.name);

  const relDir = dir.startsWith(repoRoot) ? dir.slice(repoRoot.length + 1) : dir;
  runQualify(relDir);
  return { dir: relDir, created: true };
}

// Status starts at "intake": a content-example candidate is raw material for Muxin to look at,
// not yet a decision (pursue/passed), mirroring how a manually-added client/platform lead starts
// at "intake" before anyone has looked at it.
export function writeContentExampleLead(candidate: ContentExampleDiscoveryCandidate, theme: string): WriteResult {
  const dir = leadDir("content-example", candidate.name);
  if (existsSync(join(dir, "lead.md"))) return { dir, created: false };
  mkdirSync(dir, { recursive: true });

  writeFileSync(join(dir, "lead.md"), buildContentExampleLeadFile(candidate, theme));

  const relDir = dir.startsWith(repoRoot) ? dir.slice(repoRoot.length + 1) : dir;
  return { dir: relDir, created: true };
}

const SEARCH_BUDGET_HOOK_PATH = join(repoRoot, "src", "outreach", "search-budget-hook.ts");
const TSX_BIN = join(repoRoot, "node_modules", ".bin", "tsx");

async function callClaudeDiscover(prompt: string, totalBudget: number): Promise<string> {
  const model = (process.env.CLAUDE_POLISH_MODEL ?? "sonnet").trim();
  const counterFile = join(tmpdir(), `discovery-search-budget-${randomUUID()}.count`);
  let stdout: string;
  try {
    // Same --permission-mode acceptEdits + --settings search-budget-hook wiring research.ts's
    // callClaudeResearch uses -- see that function's comment for why acceptEdits is safe here
    // (this call never writes files itself; writeClientPlatformLead/writeContentExampleLead own
    // every byte written to disk). search-budget-hook.ts is reused completely unmodified: it only
    // ever reads the two env vars set below, kind-agnostic.
    const r = await execFileP(
      "claude",
      ["-p", prompt, "--model", model, "--permission-mode", "acceptEdits", "--settings", JSON.stringify(buildResearchSettings(SEARCH_BUDGET_HOOK_PATH))],
      {
        cwd: repoRoot,
        timeout: DEFAULT_TIMEOUT_MS,
        maxBuffer: 20_000_000,
        env: {
          ...process.env,
          OUTREACH_SEARCH_BUDGET_COUNTER_FILE: counterFile,
          OUTREACH_SEARCH_BUDGET_TOTAL: String(totalBudget),
        },
      },
    );
    stdout = r.stdout;
  } catch (e) {
    const err = e as { code?: string; killed?: boolean; stderr?: string };
    if (err.code === "ENOENT") {
      throw new Error("`claude` CLI not on PATH -- discover.ts needs Claude Code installed");
    }
    if (err.killed) {
      throw new Error(`claude -p timed out after ${Math.round(DEFAULT_TIMEOUT_MS / 60_000)}min during discovery`);
    }
    throw new Error(`claude -p failed: ${err.stderr?.trim() || (e instanceof Error ? e.message : String(e))}`);
  } finally {
    if (existsSync(counterFile)) {
      try {
        unlinkSync(counterFile);
      } catch {
        // best-effort cleanup only
      }
    }
  }
  const text = stdout.trim();
  if (!text) throw new Error("claude -p returned no text during discovery");
  return text;
}

function loadSpinAnglesText(): string {
  const raw = readFileSync(join(repoRoot, "config", "platforms.yaml"), "utf8");
  const doc = parseYaml(raw) as { spin_angles?: Record<string, { audience?: string; angle?: string }> };
  const spinAngles = doc.spin_angles ?? {};
  return Object.entries(spinAngles)
    .map(([channel, v]) => `${channel} (audience: ${v.audience ?? "?"}): ${(v.angle ?? "").trim()}`)
    .join("\n\n");
}

// Falls back to the full pillars.yaml signal list (every pillar's `signals`) when no --theme is
// given, so a bare `/scout` still has a concrete, current theme to search around without Muxin
// having to type one every time.
function defaultTheme(): string {
  const raw = readFileSync(join(repoRoot, "config", "pillars.yaml"), "utf8");
  const doc = parseYaml(raw) as { pillars?: { name?: string; signals?: string[] }[] };
  const pillars = doc.pillars ?? [];
  return pillars.map((p) => `${p.name ?? ""}: ${(p.signals ?? []).join("; ")}`).join(" | ");
}

export interface DiscoverKindResult {
  kind: DiscoveryKind;
  created: string[];
  skipped: string[]; // names the model proposed but were already on file
}

async function sweepKind(kind: DiscoveryKind, theme: string, maxCandidates: number): Promise<DiscoverKindResult> {
  const config = loadOutreachConfig();
  const excludeNames = existingNamesForKind(kind);
  const created: string[] = [];
  const skipped: string[] = [];

  if (kind === "content-example") {
    const budget = computeDiscoveryBudget(kind, maxCandidates, config.searchBudgetPerSignal);
    const prompt = buildContentExampleDiscoveryPrompt({ theme, maxCandidates, excludeNames, searchBudgetPerSignal: config.searchBudgetPerSignal });
    const text = await callClaudeDiscover(prompt, budget);
    const candidates = parseContentExampleDiscoveryCandidates(text);
    for (const c of candidates) {
      const result = writeContentExampleLead(c, theme);
      (result.created ? created : skipped).push(c.name);
    }
    return { kind, created, skipped };
  }

  const clientsRubric = readFileSync(join(repoRoot, "config", "outreach", "clients.md"), "utf8");
  const platformsRubric = readFileSync(join(repoRoot, "config", "outreach", "platforms.md"), "utf8");
  const worldviewMap = readFileSync(join(repoRoot, "config", "outreach", "worldview-map.md"), "utf8");
  const personFitRubric = readFileSync(join(repoRoot, "config", "outreach", "person-fit.md"), "utf8");

  const budget = computeDiscoveryBudget(kind, maxCandidates, config.searchBudgetPerSignal);
  const prompt = buildClientPlatformDiscoveryPrompt({
    kind,
    theme,
    maxCandidates,
    rubric: kind === "client" ? clientsRubric : platformsRubric,
    worldviewMap,
    extraContext: kind === "client" ? personFitRubric : loadSpinAnglesText(),
    excludeNames,
    searchBudgetPerSignal: config.searchBudgetPerSignal,
  });
  const text = await callClaudeDiscover(prompt, budget);
  const candidates = parseClientPlatformDiscoveryCandidates(text);
  for (const c of candidates) {
    const result = writeClientPlatformLead(kind, c, theme);
    (result.created ? created : skipped).push(c.name);
  }
  return { kind, created, skipped };
}

// The default per-kind runner: one bounded `claude -p` sweep plus the cost-log row for it. The
// row lives here rather than in runDiscover's loop because the spend belongs to the kind that
// incurred it, so an injected runKind never logs a cost for a call it did not make.
async function discoverKind(kind: DiscoveryKind, theme: string, maxCandidates: number): Promise<DiscoverKindResult> {
  const result = await sweepKind(kind, theme, maxCandidates);
  logCost({ step: "discovery:scout", detail: `${kind} (${result.created.length} found)`, costUsd: 0 });
  return result;
}

export interface RunDiscoverResult {
  results: DiscoverKindResult[];
  theme: string;
}

// One step per kind, because one kind IS one unit of real work: a single bounded `claude -p` web
// search followed by the lead folders it writes. The label says what the sweep is looking for.
export const DISCOVERY_STEP_LABELS: Record<DiscoveryKind, string> = {
  client: "Scouting companies worth pitching",
  platform: "Scouting platforms worth pitching",
  "content-example": "Scouting real examples to write about",
};

export interface RunDiscoverOptions {
  kinds?: DiscoveryKind[];
  theme?: string;
  limit?: number;
  // Progress markers for the GUI job queue (src/review/jobs.ts parseStepMarker). Optional: a
  // caller that passes none gets exactly today's behaviour. main() below is the one wiring that
  // turns these into `STEP n/total label` lines on stdout.
  onStep?: (n: number, total: number, label: string) => void;
  // Injected so the step sequence is unit-testable without spawning `claude` per kind. Nothing
  // but the test overrides it.
  runKind?: (kind: DiscoveryKind, theme: string, maxCandidates: number) => Promise<DiscoverKindResult>;
  // Where the run log is appended. Injectable so a test never writes into the real
  // data/discovery/run-log.jsonl -- same convention as the notes-spread ledger's test path.
  runLogPath?: string;
}

export async function runDiscover(opts: RunDiscoverOptions = {}): Promise<RunDiscoverResult> {
  const kinds = opts.kinds && opts.kinds.length ? opts.kinds : [...DISCOVERY_KINDS];
  const theme = opts.theme?.trim() || defaultTheme();
  const maxCandidates = Math.max(1, Math.min(opts.limit ?? 3, 5)); // hard cap of 5/kind, cost-bounding
  const step = opts.onStep ?? (() => {});
  const runKind = opts.runKind ?? discoverKind;
  // The total is the kinds actually about to run, counted before the first marker — never a guess.
  const total = kinds.length;

  const results: DiscoverKindResult[] = [];
  for (const [i, kind] of kinds.entries()) {
    step(i + 1, total, DISCOVERY_STEP_LABELS[kind]);
    const result = await runKind(kind, theme, maxCandidates);
    results.push(result);
  }

  const runLogPath = opts.runLogPath ?? RUN_LOG_PATH;
  mkdirSync(dirname(runLogPath), { recursive: true });
  const runLogEntry = {
    timestamp: new Date().toISOString(),
    theme,
    limit: maxCandidates,
    results: results.map((r) => ({ kind: r.kind, created: r.created, skipped: r.skipped })),
  };
  appendFileSync(runLogPath, JSON.stringify(runLogEntry) + "\n");

  return { results, theme };
}

function parseArgs(argv: string[]): { kinds?: DiscoveryKind[]; theme?: string; limit?: number } {
  let kinds: DiscoveryKind[] | undefined;
  let theme: string | undefined;
  let limit: number | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--kinds") {
      kinds = (argv[++i] ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s): s is DiscoveryKind => (DISCOVERY_KINDS as string[]).includes(s));
    } else if (a === "--theme") theme = argv[++i];
    else if (a === "--limit") limit = Number(argv[++i]);
  }
  return { kinds, theme, limit };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  runDiscover({
    ...args,
    // The STEP markers the job queue reads (src/review/jobs.ts parseStepMarker). Their own lines
    // on stdout, before each kind's work begins; the findings print after the run, as before.
    onStep: (n, total, label) => process.stdout.write(`STEP ${n}/${total} ${label}\n`),
  })
    .then((result) => {
      console.log(`theme: ${result.theme}\n`);
      for (const r of result.results) {
        console.log(`${r.kind}: ${r.created.length} created, ${r.skipped.length} skipped (already on file)`);
        for (const name of r.created) console.log(`  + ${name}`);
        for (const name of r.skipped) console.log(`  = ${name} (skipped, already on file)`);
      }
      console.log(`\nReview in the GUI: npm run review -> Outreach tab.`);
    })
    .catch((e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
