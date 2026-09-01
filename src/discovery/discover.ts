import "../util/env.js";
import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync, unlinkSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash, randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { repoRoot } from "../db/db.js";
import { slugify } from "../util/slug.js";
import { logCost } from "../util/cost-log.js";
import { loadOutreachConfig } from "../outreach/config.js";
import { splitFrontmatter } from "../util/frontmatter.js";
import { listLeads } from "../outreach/status.js";
import { runQualify, formatEvidenceLine, isValidEvidenceItem } from "../outreach/qualify.js";
import { buildResearchSettings } from "../outreach/research.js";
import { buildEngineSpawn, isEngine } from "../review/engines.js";
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

const RUN_LOG_PATH = join(repoRoot, "data", "outreach", "run-log.jsonl");
const LENS_STATE_PATH = join(repoRoot, "data", "outreach", "discovery-lens.json");
const DEFAULT_TIMEOUT_MS = 10 * 60_000; // flat, generous timeout for a whole multi-candidate pass

export interface DiscoveryAnchor { name: string; why: string }
export interface DiscoveryLens {
  belief: string; dialect: string; modality: string; anchors: DiscoveryAnchor[];
}

export interface DiscoveryRunContext {
  lens: DiscoveryLens;
  antiExamples: string[];
  calibration: DiscoveryCalibration[];
}

export interface DiscoveryCalibration {
  kind: "client" | "platform";
  decided: number;
  pursued: number;
  pursueRate: number | null;
  assessment: "thin" | "healthy" | "cold" | "broad";
}

export function computeDiscoveryCalibration(leads: Array<{ kind: string; status: string }>): DiscoveryCalibration[] {
  return (["client", "platform"] as const).map((kind) => {
    const decisions = leads.filter((lead) => lead.kind === kind && (lead.status === "pursue" || lead.status === "passed"));
    const pursued = decisions.filter((lead) => lead.status === "pursue").length;
    const pursueRate = decisions.length ? pursued / decisions.length : null;
    let assessment: DiscoveryCalibration["assessment"] = "thin";
    if (decisions.length >= 5 && pursueRate !== null) {
      const [low, high] = kind === "platform" ? [0.2, 0.4] : [0.1, 0.3];
      assessment = pursueRate < low ? "cold" : pursueRate > high ? "broad" : "healthy";
    }
    return { kind, decided: decisions.length, pursued, pursueRate, assessment };
  });
}

export function formatDiscoveryCalibration(items: DiscoveryCalibration[]): string {
  return items.map((item) => {
    const rate = item.pursueRate === null ? "unavailable" : `${Math.round(item.pursueRate * 100)}%`;
    const direction = item.assessment === "cold"
      ? "tighten fit before searching"
      : item.assessment === "broad"
        ? "broaden the frontier cautiously"
        : item.assessment === "thin"
          ? "too few decisions to recalibrate"
          : "within the intended precision band";
    return `${item.kind} pursue rate ${rate} across ${item.decided} decisions (${item.assessment}; ${direction})`;
  }).join("\n");
}

/** Parse the deliberately human-editable anchor file without making it a second data store. */
export function parseAnchors(markdown: string): DiscoveryAnchor[] {
  const result: DiscoveryAnchor[] = [];
  let current: DiscoveryAnchor | null = null;
  const withoutComments = markdown.replace(/<!--[\s\S]*?-->/g, "");
  for (const line of withoutComments.split("\n")) {
    const m = line.match(/^\s*-\s*\*\*([^*]+)\*\*\s*(.*)$/);
    if (m) {
      if (current) result.push(current);
      const rest = m[2].replace(/^,?\s*/, "").trim();
      const why = rest.match(/Why this anchor:\s*(.*)$/i)?.[1] ?? rest;
      current = { name: m[1].trim(), why: why.replace(/[.\s]+$/, "") };
    } else if (current && /^\s{2,}\S/.test(line) && !line.trimStart().startsWith("<!--")) {
      current.why = `${current.why} ${line.trim()}`.trim().replace(/[.\s]+$/, "");
    }
  }
  if (current) result.push(current);
  return result;
}

export function parseWorldviewMap(markdown: string): { beliefs: string[]; dialects: string[] } {
  const beliefs: string[] = [];
  const dialects: string[] = [];
  for (const line of markdown.split("\n")) {
    const heading = line.match(/^##\s+\d+\.\s+(.+)$/);
    if (heading) beliefs.push(heading[1].trim());
    const dialect = line.match(/^[-*]\s+([^:]+):\s*["“]?(.+?)["”]?\s*$/);
    if (dialect && /practitioner|academic|safety|civic|org|engineering|design/i.test(dialect[1])) dialects.push(dialect[2].replace(/["“”]/g, "").trim());
  }
  return { beliefs, dialects: dialects.length ? dialects : ["plain language"] };
}

export function selectDiscoveryLens(input: { runCount: number; beliefs: string[]; dialects: string[]; modalities: string[]; anchors: DiscoveryAnchor[]; anchorSubsetSize?: number }): DiscoveryLens {
  const n = Math.max(0, input.runCount);
  const beliefs = input.beliefs.length ? input.beliefs : ["open-ended inquiry"];
  const dialects = input.dialects.length ? input.dialects : ["plain language"];
  const modalities = input.modalities.length ? input.modalities : ["founder-post"];
  const size = Math.max(1, Math.min(input.anchorSubsetSize ?? 3, Math.max(1, input.anchors.length)));
  const anchors = input.anchors.length ? Array.from({ length: Math.min(size, input.anchors.length) }, (_, i) => input.anchors[(n + i) % input.anchors.length]) : [];
  return { belief: beliefs[n % beliefs.length], dialect: dialects[Math.floor(n / beliefs.length) % dialects.length], modality: modalities[n % modalities.length], anchors };
}

export function buildAnchorGraphContext(anchors: DiscoveryAnchor[]): string {
  if (!anchors.length) return "No trusted anchors are available for graph expansion.";
  return anchors.map((a) => `Anchor: ${a.name}. Why trusted: ${a.why}. Expand 1-2 public hops through co-appearance, collaboration/citation, engagement, and alumni graphs.`).join("\n");
}

export function collectPassAntiExamples(leads: Array<{ name: string; status: string; body: string }>): string[] {
  const out: string[] = [];
  for (const lead of leads) {
    if (lead.status !== "passed") continue;
    const lines = lead.body.split("\n").filter((line) => /status set to passed|Muxin decided pass/i.test(line));
    for (const line of lines) {
      const reason = line.split(/(?:status set to passed|Muxin decided pass\s*\([^)]*\))\s*(?:--|:)\s*/i)[1]?.trim().replace(/[.\s]+$/, "");
      if (reason) out.push(`${lead.name}: ${reason}.`);
    }
  }
  return out;
}

export function normalizeIdentity(value: string): string {
  let s = value.trim().toLowerCase();
  const isUrl = /^https?:\/\//.test(s);
  try {
    if (isUrl) s = new URL(s).hostname.replace(/^www\./, "");
  } catch { /* retain the raw candidate */ }
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  s = s.replace(/\.(com|org|net|io|co|ai)$/i, "");
  return s.replace(/^the\s+/, "").replace(/&/g, " and ").replace(/\b(incorporated|corporation|company|limited|inc|corp|llc|ltd|co)\b/g, "").replace(/[^a-z0-9]+/g, "").trim();
}

export interface MidTailSignals { kind: "client" | "platform"; audienceSize?: number; fundingStage?: string; newsletterSubscribers?: number; }
export interface MidTailCaps { audienceSizeMax?: number; newsletterSubscribersMax?: number; excludedFundingStages?: string[] }
export function decideMidTail(signals: MidTailSignals, caps: MidTailCaps = {}): { action: "keep" | "downgrade" | "exclude"; reason: string } {
  if (signals.audienceSize !== undefined && signals.audienceSize >= (caps.audienceSizeMax ?? 50_000)) return { action: "downgrade", reason: "audience_size_at_or_above_cap" };
  if (signals.newsletterSubscribers !== undefined && signals.newsletterSubscribers >= (caps.newsletterSubscribersMax ?? 50_000)) return { action: "downgrade", reason: "audience_size_at_or_above_cap" };
  const excluded = caps.excludedFundingStages ?? ["series-b", "series-c", "series-d-plus", "growth", "public"];
  if (signals.kind === "client" && signals.fundingStage && excluded.some((stage) => signals.fundingStage!.toLowerCase().includes(stage))) return { action: "exclude", reason: "funding_stage_at_or_above_cap" };
  return { action: "keep", reason: "within_mid_tail" };
}

export function evaluateCandidateMidTail(
  kind: "client" | "platform",
  candidate: ClientPlatformDiscoveryCandidate,
  caps: MidTailCaps = {},
): { action: "keep" | "downgrade" | "exclude"; reason: string } {
  const text = [
    candidate.profile,
    candidate.evidenceBlock,
    candidate.classificationNote,
    ...candidate.evidence.flatMap((item) => [item.description, item.quote ?? ""]),
  ].join(" ");
  const audienceMatches = [...text.matchAll(/([\d,.]+)\s*([km])?\s+(?:monthly\s+)?(listeners|subscribers|downloads|views|listens)\b/gi)];
  let audienceSize: number | undefined;
  let newsletterSubscribers: number | undefined;
  for (const audience of audienceMatches) {
    const base = Number(audience[1].replace(/,/g, ""));
    const multiplier = audience[2]?.toLowerCase() === "m" ? 1_000_000 : audience[2]?.toLowerCase() === "k" ? 1_000 : 1;
    const value = Number.isFinite(base) ? base * multiplier : undefined;
    if (/subscriber/i.test(audience[3])) newsletterSubscribers = Math.max(newsletterSubscribers ?? 0, value ?? 0);
    else audienceSize = Math.max(audienceSize ?? 0, value ?? 0);
  }
  const stage = text.match(/\b(series\s+[b-d]|growth(?:-stage)?|public company)\b/i)?.[1]
    ?.toLowerCase().replace(/\s+/g, "-").replace("public-company", "public");
  if (/\b(?:current|recent) hype list\b/i.test(text)) return { action: "exclude", reason: "current_hype_list" };
  return decideMidTail({ kind, audienceSize, newsletterSubscribers, fundingStage: stage }, caps);
}

export function applyDiscoveryEvidenceGates(
  kind: "client" | "platform",
  candidate: ClientPlatformDiscoveryCandidate,
): { action: "keep" | "skip"; candidate: ClientPlatformDiscoveryCandidate; reason?: string } {
  const next = { ...candidate };
  const hasPersonFirstEvidence = candidate.evidence.some((item) =>
    item.signal.trim().toLowerCase() === "person-fit" && item.person.trim() && isValidEvidenceItem(item),
  );
  if (kind === "client" && !hasPersonFirstEvidence) return { action: "skip", candidate: next, reason: "missing_person_first_evidence" };
  if (!candidate.disconfirmation.trim()) {
    next.classification = kind === "client" ? "unclear" : "weak";
    next.classificationNote = `${candidate.classificationNote}\n\nDiscovery evidence gate: no disconfirmation pass was returned, so this candidate was downgraded.`.trim();
  }
  return { action: "keep", candidate: next };
}

/** Bound untrusted model output before any candidate reaches a write loop. */
export function capDiscoveryCandidates<T>(candidates: T[], maxCandidates: number): T[] {
  return candidates.slice(0, Math.max(0, Math.floor(maxCandidates)));
}

/** A changed fit profile earns one recalibrated run; unchanged cold methodology blocks spend. */
export function shouldBlockColdCalibration(coldKinds: string[], currentProfileHash: string, previousProfileHash?: string): boolean {
  return coldKinds.length > 0 && Boolean(previousProfileHash) && previousProfileHash === currentProfileHash;
}

export function classifyRateLimitFailure(error: { code?: number | string; stderr?: string; message?: string }): boolean {
  return String(error.code ?? "") === "429" || /rate.?limit|usage limit|too many requests|rolling window|capacity/i.test(`${error.stderr ?? ""} ${error.message ?? ""}`);
}

export async function withRateLimitRetry<T>(operation: () => Promise<T>, opts: { maxRetries?: number; baseDelayMs?: number; sleep?: (ms: number) => Promise<void> } = {}): Promise<{ value: T; retries: number }> {
  const max = Math.max(0, Math.min(opts.maxRetries ?? 2, 2));
  const sleep = opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 0; ; attempt++) {
    try { return { value: await operation(), retries: attempt }; }
    catch (error) {
      const rateLimited = classifyRateLimitFailure(error as { code?: number | string; stderr?: string; message?: string });
      if (!rateLimited || attempt >= max) {
        if (rateLimited && error && typeof error === "object") Object.assign(error, { rateLimitRetries: attempt });
        throw error;
      }
      await sleep((opts.baseDelayMs ?? 250) * 2 ** attempt);
    }
  }
}

function leadDir(kind: DiscoveryKind, name: string): string {
  return join(repoRoot, "outreach", "leads", `${kind}-${slugify(name)}`);
}

// Exact names are sent to the model to save searches; the permanent cross-kind canonical identity
// gate below remains authoritative at write time.
function existingNamesForKind(kind: DiscoveryKind): string[] {
  return listLeads()
    .filter((l) => l.kind === kind)
    .map((l) => l.name);
}

function existingIdentities(): Set<string> {
  const ids = new Set<string>();
  for (const lead of listLeads()) {
    ids.add(normalizeIdentity(lead.name));
    try {
      const raw = readFileSync(join(repoRoot, lead.dir, "lead.md"), "utf8");
      const { fm } = splitFrontmatter(raw);
      if (typeof fm.url === "string" && fm.url) ids.add(normalizeIdentity(fm.url));
    } catch { /* malformed/vanished lead is still safely name-deduped */ }
  }
  return ids;
}

// Reuses qualify.ts's own serializer rather than a second copy of the line format -- the reader
// (EVIDENCE_LINE_RE) and both writers are one format or they are not a format at all.
//
// `capturedAt` is the day this discovery run gathered the evidence, so a scaffolded lead.md carries
// its own capture dates from the start. Same clock as decisionLogLine below, and equally a real
// measurement rather than a guess: the run IS the capture.
function formatEvidenceLines(evidence: EvidenceItem[], capturedAt: string): string {
  if (evidence.length === 0) return "(none yet)";
  return evidence
    .map((item, i) => formatEvidenceLine(item.captured_at ? item : { ...item, captured_at: capturedAt }, i + 1))
    .join("\n");
}

function yamlQuote(value: string): string {
  const oneLine = value.replace(/\s+/g, " ").trim();
  return `"${oneLine.replace(/"/g, '\\"')}"`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function decisionLogLine(note: string): string {
  return `- ${today()}: ${note}`;
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
    `\n## Evidence\n\n${formatEvidenceLines(candidate.evidence, today())}\n` +
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
    `\n## Evidence\n\n${formatEvidenceLines(candidate.evidence, today())}\n` +
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
  if (existsSync(join(dir, "lead.md")) || existingIdentities().has(normalizeIdentity(candidate.name)) || (candidate.url && existingIdentities().has(normalizeIdentity(candidate.url)))) return { dir, created: false };
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
  if (existsSync(join(dir, "lead.md")) || existingIdentities().has(normalizeIdentity(candidate.name)) || (candidate.url && existingIdentities().has(normalizeIdentity(candidate.url)))) return { dir, created: false };
  mkdirSync(dir, { recursive: true });

  writeFileSync(join(dir, "lead.md"), buildContentExampleLeadFile(candidate, theme));

  const relDir = dir.startsWith(repoRoot) ? dir.slice(repoRoot.length + 1) : dir;
  return { dir: relDir, created: true };
}

const SEARCH_BUDGET_HOOK_PATH = join(repoRoot, "src", "outreach", "search-budget-hook.ts");

interface DiscoveryCallResult { text: string; searchesUsed: number; rateLimitRetries: number }

async function callClaudeDiscover(prompt: string, totalBudget: number): Promise<DiscoveryCallResult> {
  const selected = isEngine(process.env.CONTENT_AGENT_ENGINE) ? process.env.CONTENT_AGENT_ENGINE : "claude";
  if (selected === "codex") throw new Error("Scout supports Claude or Grok web discovery; choose one of those engines.");
  const model = (process.env.CLAUDE_POLISH_MODEL ?? "sonnet").trim();
  const counterFile = join(tmpdir(), `discovery-search-budget-${randomUUID()}.count`);
  let stdout: string;
  let rateLimitRetries = 0;
  let searchesUsed = 0;
  try {
    // Same --permission-mode acceptEdits + --settings search-budget-hook wiring research.ts's
    // callClaudeResearch uses -- see that function's comment for why acceptEdits is safe here
    // (this call never writes files itself; writeClientPlatformLead/writeContentExampleLead own
    // every byte written to disk). search-budget-hook.ts is reused completely unmodified: it only
    // ever reads the two env vars set below, kind-agnostic.
    const built = buildEngineSpawn(selected, prompt, { timeoutMs: DEFAULT_TIMEOUT_MS, permissionMode: "acceptEdits", model: selected === "claude" ? model : undefined });
    const args = [...built.args, "--settings", JSON.stringify(buildResearchSettings(SEARCH_BUDGET_HOOK_PATH))];
    const retried = await withRateLimitRetry(() => execFileP(
      built.command,
      args,
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
    ), { maxRetries: 2 });
    stdout = retried.value.stdout;
    rateLimitRetries = retried.retries;
  } catch (e) {
    const err = e as { code?: string; killed?: boolean; stderr?: string };
    if (err.code === "ENOENT") {
      throw new Error(selected+" CLI not on PATH -- Scout needs the selected engine installed");
    }
    if (err.killed) {
      throw new Error(selected+" web discovery timed out after "+Math.round(DEFAULT_TIMEOUT_MS / 60_000)+"min");
    }
    throw new Error(selected+" web discovery failed: "+(err.stderr?.trim() || (e instanceof Error ? e.message : String(e))));
  } finally {
    if (existsSync(counterFile)) {
      try {
        searchesUsed = Math.max(0, Number(readFileSync(counterFile, "utf8").trim()) || 0);
        unlinkSync(counterFile);
      } catch {
        // best-effort cleanup only
      }
    }
  }
  const text = stdout.trim();
  if (!text) throw new Error(selected+" returned no text during discovery");
  return { text, searchesUsed, rateLimitRetries };
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
  searchesUsed?: number;
  evidenceFound?: number;
  rateLimitRetries?: number;
  midTailDowngraded?: number;
  midTailExcluded?: number;
}

async function sweepKind(kind: DiscoveryKind, theme: string, maxCandidates: number, context: DiscoveryRunContext): Promise<DiscoverKindResult> {
  const config = loadOutreachConfig();
  const excludeNames = existingNamesForKind(kind);
  const created: string[] = [];
  const skipped: string[] = [];

  if (kind === "content-example") {
    const budget = computeDiscoveryBudget(kind, maxCandidates, config.searchBudgetPerSignal);
    const prompt = buildContentExampleDiscoveryPrompt({ theme, maxCandidates, excludeNames, searchBudgetPerSignal: config.searchBudgetPerSignal });
    const call = await callClaudeDiscover(prompt, budget);
    const candidates = capDiscoveryCandidates(parseContentExampleDiscoveryCandidates(call.text), maxCandidates);
    for (const c of candidates) {
      const result = writeContentExampleLead(c, theme);
      (result.created ? created : skipped).push(c.name);
    }
    return { kind, created, skipped, searchesUsed: call.searchesUsed, evidenceFound: candidates.reduce((sum, candidate) => sum + candidate.evidence.length, 0), rateLimitRetries: call.rateLimitRetries };
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
    lens: context.lens,
    anchorContext: buildAnchorGraphContext(context.lens.anchors),
    antiExamples: context.antiExamples,
    calibration: formatDiscoveryCalibration(context.calibration.filter((item) => item.kind === kind)),
  });
  const call = await callClaudeDiscover(prompt, budget);
  const candidates = capDiscoveryCandidates(parseClientPlatformDiscoveryCandidates(call.text), maxCandidates);
  let midTailDowngraded = 0;
  let midTailExcluded = 0;
  for (const rawCandidate of candidates) {
    const evidenceGate = applyDiscoveryEvidenceGates(kind, rawCandidate);
    if (evidenceGate.action === "skip") {
      skipped.push(rawCandidate.name);
      continue;
    }
    const c = evidenceGate.candidate;
    const midTail = evaluateCandidateMidTail(kind, c, {
      audienceSizeMax: config.midTailCaps.podcastListenersMax,
      newsletterSubscribersMax: config.midTailCaps.newsletterSubscribersMax,
      excludedFundingStages: config.midTailCaps.companyFundingStageExclude,
    });
    if (midTail.action === "exclude") {
      midTailExcluded++;
      skipped.push(c.name);
      continue;
    }
    if (midTail.action === "downgrade") {
      midTailDowngraded++;
      if (kind === "platform" && c.classification === "strong") c.classification = "partial";
      if (kind === "client" && (c.classification === "turnaround" || c.classification === "greenfield")) c.classification = "unclear";
      c.classificationNote = `${c.classificationNote}\n\nMid-tail policy: downgraded (${midTail.reason}).`.trim();
    }
    const result = writeClientPlatformLead(kind, c, theme);
    (result.created ? created : skipped).push(c.name);
  }
  return { kind, created, skipped, searchesUsed: call.searchesUsed, evidenceFound: candidates.reduce((sum, candidate) => sum + candidate.evidence.length, 0), rateLimitRetries: call.rateLimitRetries, midTailDowngraded, midTailExcluded };
}

// The default per-kind runner: one bounded `claude -p` sweep plus the cost-log row for it. The
// row lives here rather than in runDiscover's loop because the spend belongs to the kind that
// incurred it, so an injected runKind never logs a cost for a call it did not make.
async function discoverKind(kind: DiscoveryKind, theme: string, maxCandidates: number, context: DiscoveryRunContext): Promise<DiscoverKindResult> {
  const result = await sweepKind(kind, theme, maxCandidates, context);
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
  runKind?: (kind: DiscoveryKind, theme: string, maxCandidates: number, context: DiscoveryRunContext) => Promise<DiscoverKindResult>;
  // Where the run log is appended. Injectable so a test never writes into the real
  // data/outreach/run-log.jsonl -- same convention as the notes-spread ledger's test path.
  runLogPath?: string;
  lensStatePath?: string;
  now?: () => number;
}

export async function runDiscover(opts: RunDiscoverOptions = {}): Promise<RunDiscoverResult> {
  const kinds = opts.kinds && opts.kinds.length ? opts.kinds : [...DISCOVERY_KINDS];
  const theme = opts.theme?.trim() || defaultTheme();
  const maxCandidates = Math.max(1, Math.min(opts.limit ?? 3, 5));
  const batchCap = Math.max(1, Math.min(loadOutreachConfig().batchCap, 5));
  const step = opts.onStep ?? (() => {});
  const runKind = opts.runKind ?? discoverKind;
  // The total is the kinds actually about to run, counted before the first marker — never a guess.
  const total = kinds.length;
  const lensStatePath = opts.lensStatePath ?? (opts.runLogPath ? `${opts.runLogPath}.lens.json` : LENS_STATE_PATH);
  let runCount = 0;
  let previousProfileHash: string | undefined;
  if (existsSync(lensStatePath)) {
    try {
      const saved = JSON.parse(readFileSync(lensStatePath, "utf8"));
      runCount = Math.max(0, Number(saved.runCount) || 0);
      previousProfileHash = typeof saved.profileHash === "string" ? saved.profileHash : undefined;
    } catch { runCount = 0; }
  }
  const profileInputs = ["worldview-map.md", "anchors.md", "clients.md", "platforms.md", "person-fit.md"]
    .map((name) => readFileSync(join(repoRoot, "config", "outreach", name), "utf8"));
  const profileHash = createHash("sha256").update(profileInputs.join("\0")).digest("hex");
  const map = parseWorldviewMap(profileInputs[0]);
  const lens = selectDiscoveryLens({ runCount, beliefs: map.beliefs, dialects: map.dialects, modalities: ["episode-level podcast", "newsletter", "founder-post"], anchors: parseAnchors(profileInputs[1]) });
  const leadRecords = listLeads().map((lead) => {
    let body = "";
    try { body = readFileSync(join(repoRoot, lead.dir, "lead.md"), "utf8"); } catch { /* preserve the summary even if its file vanished */ }
    return { ...lead, body };
  });
  const context: DiscoveryRunContext = {
    lens,
    antiExamples: collectPassAntiExamples(leadRecords),
    calibration: computeDiscoveryCalibration(leadRecords),
  };
  const coldKinds = context.calibration.filter((item) => kinds.includes(item.kind) && item.assessment === "cold");
  const now = opts.now ?? Date.now;
  const startedAt = now();

  const results: DiscoverKindResult[] = [];
  let failure: unknown = shouldBlockColdCalibration(coldKinds.map((item) => item.kind), profileHash, previousProfileHash)
    ? new Error(`Scout calibration is cold for ${coldKinds.map((item) => item.kind).join(", ")}. Refresh the fit profile or worldview map before spending another discovery run.`)
    : undefined;
  let remainingCapacity = batchCap;
  try {
    if (failure) throw failure;
    for (const [i, kind] of kinds.entries()) {
      step(i + 1, total, DISCOVERY_STEP_LABELS[kind]);
      const remainingKinds = kinds.length - i;
      const kindLimit = Math.min(maxCandidates, Math.ceil(remainingCapacity / remainingKinds));
      if (kindLimit < 1) {
        results.push({ kind, created: [], skipped: [] });
        continue;
      }
      const result = await runKind(kind, theme, kindLimit, context);
      results.push(result);
      remainingCapacity = Math.max(0, remainingCapacity - result.created.length);
    }
  } catch (error) {
    failure = error;
  }

  const runLogPath = opts.runLogPath ?? RUN_LOG_PATH;
  mkdirSync(dirname(runLogPath), { recursive: true });
  const runLogEntry = {
    timestamp: new Date().toISOString(),
    status: failure ? "failed" : "completed",
    ...(failure ? { error: failure instanceof Error ? failure.message : String(failure) } : {}),
    theme,
    limit: maxCandidates,
    batchCap,
    profileHash,
    lens,
    calibration: context.calibration,
    durationMs: Math.max(0, now() - startedAt),
    searchesUsed: results.reduce((sum, result) => sum + (result.searchesUsed ?? 0), 0),
    evidenceFound: results.reduce((sum, result) => sum + (result.evidenceFound ?? 0), 0),
    rateLimitRetries: results.reduce((sum, result) => sum + (result.rateLimitRetries ?? 0), 0) + (failure && typeof failure === "object" && "rateLimitRetries" in failure ? Number(failure.rateLimitRetries) || 0 : 0),
    rateLimitFailure: failure ? classifyRateLimitFailure(failure as { code?: number | string; stderr?: string; message?: string }) : false,
    midTailDowngraded: results.reduce((sum, result) => sum + (result.midTailDowngraded ?? 0), 0),
    midTailExcluded: results.reduce((sum, result) => sum + (result.midTailExcluded ?? 0), 0),
    results: results.map((r) => ({ kind: r.kind, created: r.created, skipped: r.skipped })),
  };
  appendFileSync(runLogPath, JSON.stringify(runLogEntry) + "\n");
  if (failure) throw failure;
  mkdirSync(dirname(lensStatePath), { recursive: true });
  writeFileSync(lensStatePath, JSON.stringify({ runCount: runCount + 1, profileHash, lens }, null, 2) + "\n");

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
        console.log(`${r.kind}: ${r.created.length} created, ${r.skipped.length} skipped by the frontier or policy gates`);
        for (const name of r.created) console.log(`  + ${name}`);
        for (const name of r.skipped) console.log(`  = ${name} (skipped by the frontier or policy gates)`);
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
