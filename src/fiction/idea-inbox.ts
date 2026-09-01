import "../util/env.js";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import { repoRoot } from "../db/db.js";
import { buildEngineSpawn, extractEngineText, GROK_FINAL_TEXT_SYSTEM_PROMPT, type Engine } from "../review/engines.js";
import { resolveDoc } from "../review/fiction.js";
import { withFileLock } from "../runtime/file-lock.js";

export const IDEA_CLASSIFICATIONS = ["world", "character", "plot", "chapter", "imagery", "clarify"] as const;
export type IdeaClassification = (typeof IDEA_CLASSIFICATIONS)[number];
export type IdeaStatus = "needs-review" | "approved" | "rejected";

export interface ClarificationTurn {
  text: string;
  createdAt: string;
}

export interface IdeaProvenance {
  source: "fiction-inbox";
  series: string;
  classification: IdeaClassification;
  targetPath: string | null;
  engine: Engine;
  clarificationTurns: ClarificationTurn[];
  createdAt: string;
}

export interface CleanupProposal {
  ideaId: string;
  series: string;
  classification: IdeaClassification;
  rawText: string;
  cleanedText: string;
  provenance: IdeaProvenance;
  createdAt: string;
  status: "needs-review" | "approved" | "rejected";
  storageRoot?: string;
  storiesRoot?: string;
}

export interface IdeaRecord {
  id: string;
  series: string;
  rawText: string;
  classification: IdeaClassification;
  targetPath: string | null;
  status: IdeaStatus;
  proposal: CleanupProposal | null;
  engine: Engine;
  clarificationTurns: ClarificationTurn[];
  createdAt: string;
  updatedAt: string;
  storageRoot?: string;
  storiesRoot?: string;
}

export interface IdeaOptions {
  storageRoot?: string;
  storiesRoot?: string;
  classification?: IdeaClassification;
  targetPath?: string;
  engine?: Engine;
}

const defaultHome = () => process.env.CONTENT_AGENTS_HOME?.trim() || join(homedir(), ".content-agents");
const safeSeries = (series: string): string => {
  if (!/^[a-z0-9][\w-]*$/.test(series)) throw new Error("bad series");
  return series;
};
const safeTargetPath = (path: string | null | undefined): string | null => {
  if (path === undefined || path === null || !String(path).trim()) return null;
  const value = String(path).trim();
  if (value.includes("\\") || value.includes("\0") || value.startsWith("/") || value.split("/").includes("..")) {
    throw new Error("unsafe target path");
  }
  return value;
};

function targetForClassification(classification: IdeaClassification, path: string | null | undefined): string | null {
  const safe = safeTargetPath(path);
  if (classification === "clarify") return null;
  if (classification === "world" || classification === "imagery") return "bible.md";
  if (classification === "plot") return "outline.md";
  if (classification === "chapter") return null;
  if (classification === "character" && safe !== null && !/^characters\/[a-z0-9][\w-]*\.md$/.test(safe)) {
    throw new Error("character ideas require a character document target");
  }
  return safe;
}

function inboxPath(series: string, root = defaultHome()): string {
  safeSeries(series);
  return join(resolve(root), series, "ideas.json");
}
function readAll(series: string, root?: string): IdeaRecord[] {
  try {
    const value = JSON.parse(readFileSync(inboxPath(series, root), "utf8")) as unknown;
    return Array.isArray(value) ? (value as IdeaRecord[]).map((record) => ({
      ...record,
      clarificationTurns: Array.isArray(record.clarificationTurns) ? record.clarificationTurns : [],
    })) : [];
  } catch { return []; }
}
function writeAll(series: string, records: IdeaRecord[], root?: string): void {
  const path = inboxPath(series, root);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(records, null, 2) + "\n", { mode: 0o600 });
  renameSync(tmp, path);
}
function mutate<T>(series: string, root: string | undefined, fn: (records: IdeaRecord[]) => T): T {
  const path = inboxPath(series, root);
  return withFileLock(`${path}.lock`, () => {
    const records = readAll(series, root);
    const value = fn(records);
    writeAll(series, records, root);
    return value;
  });
}

/** Parse a model response fail-closed. Multiple destinations or no destination means clarify. */
export function classifyIdeaOutput(output: string): IdeaClassification {
  const text = String(output ?? "").toLowerCase();
  const matches = IDEA_CLASSIFICATIONS.filter((label) => label !== "clarify" && new RegExp(`\\b${label}\\b`, "g").test(text));
  return matches.length === 1 ? matches[0] : "clarify";
}

function ideaId(series: string, rawText: string): string {
  return createHash("sha256").update(series).update("\0").update(Buffer.from(rawText, "utf8")).digest("hex").slice(0, 24);
}

export function createIdea(series: string, rawText: string, options: IdeaOptions = {}): IdeaRecord {
  safeSeries(series);
  if (typeof rawText !== "string") throw new Error("raw idea must be text");
  if (!rawText.trim()) throw new Error("raw idea must not be empty");
  const storageRoot = resolve(options.storageRoot ?? defaultHome());
  const storiesRoot = resolve(options.storiesRoot ?? join(repoRoot, "stories"));
  const id = ideaId(series, rawText);
  return mutate(series, storageRoot, (records) => {
    const existing = records.find((record) => record.id === id && record.rawText === rawText);
    if (existing) return existing;
    const now = new Date().toISOString();
    const classification = options.classification ?? "clarify";
    const record: IdeaRecord = {
      id, series, rawText, classification,
      targetPath: targetForClassification(classification, options.targetPath), status: "needs-review", proposal: null,
      engine: options.engine ?? "claude", clarificationTurns: [], createdAt: now, updatedAt: now, storageRoot, storiesRoot,
    };
    records.push(record);
    return record;
  });
}

export function readIdea(series: string, id: string, root = defaultHome()): IdeaRecord | null {
  return readAll(series, root).find((record) => record.id === id) ?? null;
}

export function listIdeas(series: string, root = defaultHome()): IdeaRecord[] {
  return readAll(series, root).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function setIdeaClassification(idea: IdeaRecord, classification: IdeaClassification, targetPath?: string): IdeaRecord {
  const target = targetForClassification(classification, targetPath ?? idea.targetPath);
  const updated = { ...idea, classification, targetPath: target, updatedAt: new Date().toISOString() };
  mutate(idea.series, idea.storageRoot, (records) => {
    const index = records.findIndex((record) => record.id === idea.id);
    if (index < 0) throw new Error("idea not found");
    records[index] = updated;
    return updated;
  });
  return updated;
}

/** Append one author-supplied clarification turn, preserving its bytes and order. */
export function appendClarificationTurn(idea: IdeaRecord, text: string): IdeaRecord {
  if ((idea.classification !== "clarify" && !(idea.classification === "character" && !idea.targetPath)) || idea.proposal) throw new Error("only unresolved ideas accept clarification turns");
  if (typeof text !== "string" || !text.trim()) throw new Error("clarification follow-up must not be empty");
  const turns = Array.isArray(idea.clarificationTurns) ? idea.clarificationTurns : [];
  const prior = turns.find((turn) => turn.text === text);
  if (prior) return idea;
  const updated = { ...idea, clarificationTurns: [...turns, { text, createdAt: new Date().toISOString() }], updatedAt: new Date().toISOString() };
  mutate(idea.series, idea.storageRoot, (records) => {
    const index = records.findIndex((record) => record.id === idea.id);
    if (index < 0) throw new Error("idea not found");
    records[index] = updated;
    return updated;
  });
  return updated;
}

/** Context sent to a classifier/cleanup adapter; delimiters keep author turns distinct from instructions. */
export function buildIdeaContext(idea: Pick<IdeaRecord, "rawText" | "clarificationTurns">): string {
  const turns = Array.isArray(idea.clarificationTurns) ? idea.clarificationTurns : [];
  return [
    "=== ORIGINAL IDEA (EXACT AUTHOR TEXT) ===",
    idea.rawText,
    "=== END ORIGINAL IDEA ===",
    "=== CLARIFICATION TURNS (ORDERED AUTHOR TEXT) ===",
    ...(turns.length ? turns.map((turn, index) => `[${index + 1}] ${turn.text}`) : ["(none)"]),
    "=== END CLARIFICATION TURNS ===",
  ].join("\n");
}

export function createCleanupProposal(idea: IdeaRecord, cleanedText: string, engine: Engine = idea.engine): CleanupProposal {
  if (idea.classification === "clarify") throw new Error("clarify the idea before cleanup");
  if (typeof cleanedText !== "string" || !cleanedText.trim()) throw new Error("cleanup text is required");
  if (idea.classification === "chapter" && cleanedText !== idea.rawText) {
    throw new Error("chapter proposal must preserve the raw beats exactly");
  }
  const proposal: CleanupProposal = {
    ideaId: idea.id, series: idea.series, classification: idea.classification,
    rawText: idea.rawText, cleanedText, status: "needs-review",
    provenance: { source: "fiction-inbox", series: idea.series, classification: idea.classification,
    targetPath: idea.targetPath, engine, clarificationTurns: (idea.clarificationTurns ?? []).map((turn) => ({ ...turn })), createdAt: new Date().toISOString() },
    createdAt: new Date().toISOString(), storageRoot: idea.storageRoot, storiesRoot: idea.storiesRoot,
  };
  mutate(idea.series, idea.storageRoot, (records) => {
    const index = records.findIndex((record) => record.id === idea.id);
    if (index < 0) throw new Error("idea not found");
    records[index] = { ...records[index], proposal, engine, updatedAt: new Date().toISOString() };
    return proposal;
  });
  return proposal;
}

function targetFor(proposal: CleanupProposal): string {
  if (proposal.classification === "world" || proposal.classification === "imagery") return proposal.provenance.targetPath ?? "bible.md";
  if (proposal.classification === "plot") return proposal.provenance.targetPath ?? "outline.md";
  if (proposal.classification === "character" && proposal.provenance.targetPath) return proposal.provenance.targetPath;
  if (proposal.classification === "chapter") return "";
  throw new Error("choose a target document before approving");
}

export interface ApprovalOptions {
  storageRoot?: string;
  storiesRoot?: string;
  queueChapter?: (series: string, rawIdea: string, engine: Engine) => unknown;
  /** Set only after the caller proves the checkout is on main. */
  canonicalWriteAuthorized?: boolean;
}

function pendingProposalIndex(records: IdeaRecord[], proposal: CleanupProposal): number {
  const index = records.findIndex((record) => record.id === proposal.ideaId);
  const pending = index >= 0 ? records[index] : null;
  if (!pending || pending.status !== "needs-review" || !pending.proposal || !isDeepStrictEqual(pending.proposal, proposal)) {
    throw new Error("action must match the exact pending proposal");
  }
  return index;
}

/** Approve only a reviewable proposal. Chapter ideas use the existing draft queue; canon is never written. */
export function approveIdea(proposal: CleanupProposal, options: ApprovalOptions = {}): IdeaRecord {
  if (proposal.status !== "needs-review") throw new Error("idea is no longer awaiting review");
  const storageRoot = options.storageRoot ?? proposal.storageRoot ?? defaultHome();
  const storiesRoot = options.storiesRoot ?? proposal.storiesRoot ?? join(repoRoot, "stories");
  return mutate(proposal.series, storageRoot, (records) => {
    const index = pendingProposalIndex(records, proposal);
    if (proposal.classification === "chapter") {
      if (!options.queueChapter) throw new Error("chapter queue is unavailable");
      const beats = proposal.provenance.clarificationTurns.length
        ? buildIdeaContext({ rawText: proposal.rawText, clarificationTurns: proposal.provenance.clarificationTurns })
        : proposal.rawText;
      options.queueChapter(proposal.series, beats, proposal.provenance.engine);
    } else {
      if (options.canonicalWriteAuthorized !== true) {
        throw new Error("main branch canonical-write authorization is required");
      }
      const target = targetFor(proposal);
      const resolved = resolveDoc(proposal.series, target, storiesRoot);
      if (!resolved.doc.editable || resolved.doc.path === "canon.md" || resolved.doc.chapter !== undefined) {
        throw new Error("target document is not writable through the Fiction inbox");
      }
      const existing = readFileSync(resolved.abs, "utf8");
      const body = `${existing.replace(/\n*$/, "\n\n")}${proposal.cleanedText.replace(/\n*$/, "\n")}`;
      writeFileSync(resolved.abs, body);
    }
    const updated = { ...proposal, status: "approved" as const, storageRoot, storiesRoot };
    records[index] = { ...records[index], proposal: updated, status: "approved", updatedAt: new Date().toISOString() };
    return records[index];
  });
}

export function rejectIdea(proposal: CleanupProposal, options: ApprovalOptions = {}): IdeaRecord {
  if (proposal.status !== "needs-review") throw new Error("idea is no longer awaiting review");
  const storageRoot = options.storageRoot ?? proposal.storageRoot ?? defaultHome();
  return mutate(proposal.series, storageRoot, (records) => {
    const index = pendingProposalIndex(records, proposal);
    const updated = { ...records[index], proposal: { ...proposal, status: "rejected" as const }, status: "rejected" as const, updatedAt: new Date().toISOString() };
    records[index] = updated;
    return updated;
  });
}

function cliPrompt(kind: "classify" | "cleanup", idea: string, destination?: IdeaClassification): string {
  if (kind === "classify") return `Classify this fiction inbox idea. Reply with exactly one token: world, character, plot, chapter, imagery, or clarify. If ambiguous, reply clarify.\n\n${idea}`;
  return `Clean up the author's fiction idea for the ${destination} document. Preserve meaning and voice. Do not summarize, paraphrase away details, or add new story facts. Return only the cleaned text.\n\n${idea}`;
}

export function buildIdeaSpawn(engine: Engine, prompt: string): { command: string; args: string[]; input?: string } {
  if (engine === "ollama-gpt-oss") throw new Error("GPT-OSS is paused for Fiction inbox work");
  const built = buildEngineSpawn(engine, prompt, {
    timeoutMs: 120_000, sandbox: "read-only", permissionMode: null, tools: "",
  });
  if (engine === "grok") built.args.push(
    "--output-format", "json",
    "--system-prompt-override", GROK_FINAL_TEXT_SYSTEM_PROMPT,
    "--sandbox", "read-only",
    "--disable-web-search", "--no-subagents", "--verbatim",
  );
  return built;
}

function runCli(engine: Engine, prompt: string): Promise<string> {
  const built = buildIdeaSpawn(engine, prompt);
  return new Promise((resolveOutput, reject) => {
    const child = spawn(built.command, built.args, { cwd: repoRoot, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = ""; let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => { child.kill("SIGTERM"); reject(new Error(`${engine} CLI timed out`)); }, 120_000);
    child.once("error", reject);
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new Error(`${engine} CLI exited ${code}: ${stderr.slice(-500)}`));
      else {
        try { resolveOutput(extractEngineText(engine, stdout)); }
        catch (error) { reject(error); }
      }
    });
    if (built.input !== undefined) child.stdin.end(built.input); else child.stdin.end();
  });
}

export async function classifyIdeaWithEngine(rawText: string, engine: Engine = "claude"): Promise<IdeaClassification> {
  return classifyIdeaOutput(await runCli(engine, cliPrompt("classify", rawText)));
}

export async function cleanupIdeaWithEngine(rawText: string, classification: IdeaClassification, engine: Engine = "claude"): Promise<string> {
  if (classification === "clarify") throw new Error("clarify the idea before cleanup");
  return runCli(engine, cliPrompt("cleanup", rawText, classification));
}
