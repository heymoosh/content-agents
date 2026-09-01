import "../util/env.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { repoRoot } from "../db/db.js";
import { resolveSeriesDir, chapterPath, readChapter, pad2, characterSheets } from "./_series.js";
import { buildContext } from "./context.js";
import { buildEngineSpawn, ENGINE_COMMANDS, ENGINE_LABELS, isEngine, type Engine } from "../review/engines.js";

// Read a fresh chapter draft against the series canon and say what holds and what breaks.
// Nothing in src/fiction/ did this before: canon.ts is a write-only ledger (it appends a summary
// the /story skill supplies, AFTER Muxin approves a chapter) and validate.ts only checks
// frontmatter, one-sentence-per-line format and word count. Neither ever compares prose to canon.
//
//   npx tsx src/fiction/continuity.ts <series> [--chapter N]
//
// It writes its findings to a JSON report OUTSIDE git (~/.content-agents/fiction-continuity/),
// the same convention the GUI's job logs and Venture intake drafts already follow: this is a
// reading of a draft in progress, not canon, and canon.md stays the only ledger.
//
// Every finding carries the exact span it flags, verbatim from the chapter, so patch.ts can find
// that one span and rewrite it in place. A finding whose span is not findable exactly once keeps
// its severity and loses only the fix: it stays a conflict, it still counts as breaking, and it
// carries the reason nobody can patch it. Downgrading it to a hold would tell Muxin a chapter is
// clear while it still breaks canon.

const execFileP = promisify(execFile);
const CHECK_TIMEOUT_MS = 240_000;

export const CONTINUITY_ROOT = join(homedir(), ".content-agents", "fiction-continuity");

export type ContinuityKind = "conflict" | "hold";

// Why "Fix the line" is not on offer for a finding. "" means the fix IS on offer, or the finding
// is a hold and was never a candidate for one.
export type ContinuityUnfixable = "" | "span-missing" | "span-repeats" | "no-replacement";

export interface ContinuityItem {
  kind: ContinuityKind;
  rule: string; // the canon rule this reads against, e.g. "Elias's left hand"
  span: string; // verbatim from the chapter, so the patch can find it
  canonSays: string; // what canon establishes instead
  replacement: string; // the proposed rewrite of `span` ("" when there is nothing to propose)
  note: string; // written to Muxin, one or two sentences
  occurrences: number; // how many times `span` appears in the chapter body
  fixable: boolean; // exactly one occurrence AND a usable replacement
  unfixableReason: ContinuityUnfixable; // why a conflict cannot be patched; "" when it can
}

export interface ContinuityReport {
  series: string;
  chapter: number;
  engine: Engine | null;
  checkedAt: string;
  rulesRead: number;
  holds: ContinuityItem[];
  conflicts: ContinuityItem[];
}

export function continuityReportPath(slug: string, chapter: number, root: string = CONTINUITY_ROOT): string {
  return join(root, slug, `chapter-${pad2(chapter)}.json`);
}

export function readContinuityReport(slug: string, chapter: number, root: string = CONTINUITY_ROOT): ContinuityReport | null {
  const p = continuityReportPath(slug, chapter, root);
  if (!existsSync(p)) return null;
  try {
    const report = JSON.parse(readFileSync(p, "utf8")) as ContinuityReport;
    return { ...report, engine: isEngine(report.engine) ? report.engine : null };
  } catch {
    return null; // a half-written or hand-mangled report reads as "not checked yet", never a crash
  }
}

// The step labels, in order. Exported so the job surface and a test can assert the run emits
// exactly these — prose written to Muxin, sentence case, no trailing period (v5 handoff §1).
export const CONTINUITY_STEPS = [
  "Read the chapter",
  "Read your canon and character sheets",
  "Checked the draft against them",
  "Wrote down what holds and what broke",
] as const;

// Pure prompt assembly, exported so the guardrails can't drift and a test can read them.
export function buildContinuityPrompt(canonPack: string, chapterBody: string): string {
  return [
    `You are checking one chapter of a serialized fiction series against its established canon.`,
    `Report only. Do not rewrite the chapter, do not run commands, do not touch any file.`,
    ``,
    `THE ESTABLISHED MATERIAL (bible, canon ledger, character sheets, earlier chapters):`,
    `"""`,
    canonPack.trim(),
    `"""`,
    ``,
    `THE CHAPTER UNDER REVIEW (one sentence per line):`,
    `"""`,
    chapterBody.trim(),
    `"""`,
    ``,
    `Find two kinds of thing:`,
    `- "conflict": the chapter contradicts something the material above establishes. A physical`,
    `  detail, a name, a timeline fact, a character's state. Only flag a real contradiction.`,
    `- "hold": something unresolved or unverifiable against the material. Not a contradiction:`,
    `  a fact the material never settled, or a detail you cannot confirm either way.`,
    ``,
    `Rules for every item you return:`,
    `- "span" MUST be copied character for character from the chapter text above, and it must be`,
    `  a stretch of text that appears EXACTLY ONCE in it. Prefer a whole sentence. If you cannot`,
    `  quote a unique span, still report the item but leave "span" empty.`,
    `- "replacement" is your proposed rewrite of that exact span, and nothing more. Same voice,`,
    `  same tense, same length if you can. Leave it empty when you have nothing to propose.`,
    `- NO EM DASHES anywhere in your output. This series bans them. Use a period, a comma, a`,
    `  colon or parentheses instead.`,
    `- "note" is one or two plain sentences written to the author about what you found.`,
    `- "canon_says" quotes or paraphrases what the established material says instead.`,
    `- Do not invent canon. If the material does not establish it, it is a hold, not a conflict.`,
    ``,
    `Output ONLY a JSON object, no preamble and no markdown fences:`,
    `{"rules_read": <how many established facts/rules you actually read against>,`,
    ` "items": [{"kind":"conflict"|"hold","rule":"...","span":"...","canon_says":"...",`,
    `            "replacement":"...","note":"..."}]}`,
    `An empty "items" array is a valid and useful answer.`,
  ].join("\n");
}

// Em dashes are Muxin's house rule and it carries into fiction (stories/AGENTS.md). A proposed
// replacement carrying one cannot be written into a chapter, so it is not a usable fix.
export function hasEmDash(s: string): boolean {
  return /[—–]/.test(s);
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

// Count non-overlapping exact occurrences of `span` in `body`. Pure, so the fixability rule is
// testable without a chapter file.
export function countOccurrences(body: string, span: string): number {
  if (!span) return 0;
  let count = 0;
  let from = 0;
  for (;;) {
    const i = body.indexOf(span, from);
    if (i < 0) return count;
    count++;
    from = i + span.length;
  }
}

// Pull the JSON object out of whatever the model actually printed. Tolerant of a preamble line or
// a ```json fence, both of which a chatty model adds even when told not to.
export function extractJsonObject(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = fenced ? fenced[1] : raw;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return text.slice(start, end + 1);
}

// Which of the three things stops "Fix the line" from being offered. Order matters: a span the
// patch cannot locate is the first thing to say, because the replacement is moot without it.
export function unfixableReason(occurrences: number, usableReplacement: boolean): ContinuityUnfixable {
  if (occurrences === 0) return "span-missing";
  if (occurrences > 1) return "span-repeats";
  return usableReplacement ? "" : "no-replacement";
}

// Turn the model's answer into findings, sorted into conflicts and holds.
//
// A conflict the patch cannot apply LOSES THE FIX AND KEEPS THE SEVERITY. Two things make a
// conflict unpatchable: its span is not present in the chapter exactly once, so there is no single
// line to change, or its replacement is empty, unchanged or carries an em dash, so there is nothing
// safe to write. Either way it is still a contradiction with canon, so it stays a conflict, it
// still counts as breaking in the stamp, and it records why the fix is off the table. It used to
// become a hold, which read as green on the rail and let a chapter that broke canon look cleared.
export function parseContinuityResponse(raw: string, chapterBody: string): { rulesRead: number; holds: ContinuityItem[]; conflicts: ContinuityItem[] } {
  const json = extractJsonObject(raw);
  if (!json) throw new Error("the canon check returned nothing that parses as findings");
  let parsed: { rules_read?: unknown; items?: unknown };
  try {
    parsed = JSON.parse(json) as { rules_read?: unknown; items?: unknown };
  } catch {
    throw new Error("the canon check returned findings that are not valid JSON");
  }

  const holds: ContinuityItem[] = [];
  const conflicts: ContinuityItem[] = [];
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  for (const rawItem of items) {
    if (!rawItem || typeof rawItem !== "object") continue;
    const o = rawItem as Record<string, unknown>;
    const note = str(o.note);
    const rule = str(o.rule);
    if (!note && !rule) continue; // an item that says nothing is not a finding

    const span = str(o.span);
    const replacement = str(o.replacement);
    const occurrences = countOccurrences(chapterBody, span);
    const usableReplacement = Boolean(replacement) && !hasEmDash(replacement) && replacement !== span;
    const fixable = occurrences === 1 && usableReplacement;
    const kind: ContinuityKind = str(o.kind) === "conflict" ? "conflict" : "hold";
    const item: ContinuityItem = {
      kind,
      rule: rule || "unnamed rule",
      span,
      canonSays: str(o.canon_says),
      replacement: fixable ? replacement : "",
      note,
      occurrences,
      fixable,
      unfixableReason: kind === "conflict" ? unfixableReason(occurrences, usableReplacement) : "",
    };
    (item.kind === "conflict" ? conflicts : holds).push(item);
  }

  const rulesRead = typeof parsed.rules_read === "number" && parsed.rules_read >= 0 ? Math.round(parsed.rules_read) : 0;
  return { rulesRead, holds, conflicts };
}

// The judgment call, on Muxin's chosen CLI (Claude/Grok/Codex all run through the same
// buildEngineSpawn seam src/review/jobs.ts uses -- src/review/multi-engine-plan.md's "one seam").
// Claude and Grok get `--tools ""`: a single-shot read, everything it needs is in the prompt, so it
// cannot wander the repo. Codex has no such flag; `sandbox: "read-only"` is its equivalent guarantee.
export type ContinuityModelCall = (prompt: string) => Promise<string>;

function continuityModel(): string {
  return (process.env.FICTION_CONTINUITY_MODEL ?? "sonnet").trim();
}

// Pure argv assembly, exported so a test can assert the read-only guarantee without spawning
// anything. Claude's model knob (FICTION_CONTINUITY_MODEL) is Claude-specific and does not carry
// over to Grok or Codex, which have no equivalent env override here -- each just runs its CLI's
// default.
export function continuityEngineSpawn(engine: Engine, prompt: string): { command: string; args: string[] } {
  return buildEngineSpawn(engine, prompt, {
    timeoutMs: CHECK_TIMEOUT_MS,
    permissionMode: null, // read-only report: no edits are ever on offer, so no approval flag to set
    tools: engine === "codex" ? undefined : "",
    sandbox: "read-only",
    ...(engine === "claude" ? { model: continuityModel() } : {}),
  });
}

export function callEngineContinuity(engine: Engine): ContinuityModelCall {
  return async (prompt) => {
    const { command, args } = continuityEngineSpawn(engine, prompt);
    try {
      const { stdout } = await execFileP(command, args, {
        cwd: repoRoot,
        timeout: CHECK_TIMEOUT_MS,
        maxBuffer: 20_000_000,
      });
      return stdout;
    } catch (e) {
      const err = e as { code?: string; killed?: boolean; stderr?: string };
      const cli = ENGINE_COMMANDS[engine];
      if (err.code === "ENOENT") throw new Error(`\`${cli}\` CLI is not on this PATH, so the canon check has nothing to ask`);
      if (err.killed) throw new Error(`the canon check timed out after ${CHECK_TIMEOUT_MS / 1000}s`);
      throw new Error(`the ${ENGINE_LABELS[engine]} canon check failed: ${err.stderr?.trim() || (e instanceof Error ? e.message : String(e))}`);
    }
  };
}

// Kept for the one caller (a hand run outside the job queue) that wants Claude specifically without
// naming an engine.
export const callClaudeContinuity: ContinuityModelCall = callEngineContinuity("claude");

export interface ContinuityOptions {
  engine?: Engine; // which CLI reads the chapter; defaults to Claude, same as every other seam caller
  callModel?: ContinuityModelCall;
  root?: string; // where the report is written; injectable for tests
  prev?: number; // how many prior chapters to send in full (buildContext's own knob)
  onStep?: (n: number, total: number, label: string) => void;
}

// Read the chapter, assemble the established material through context.ts (the one existing
// canon/character assembly, not a second way of reading those files), ask, and write the report.
export async function runContinuityCheck(seriesArg: string, chapter: number, opts: ContinuityOptions = {}): Promise<ContinuityReport> {
  const dir = resolveSeriesDir(seriesArg);
  const slug = dir.split("/").filter(Boolean).pop() as string;
  const step = opts.onStep ?? (() => {});
  const total = CONTINUITY_STEPS.length;

  step(1, total, CONTINUITY_STEPS[0]);
  if (!existsSync(chapterPath(dir, chapter))) throw new Error(`there is no chapter ${chapter} in ${slug} to check`);
  const { body } = readChapter(dir, chapter);
  if (!body.trim()) throw new Error(`chapter ${chapter} is empty, so there is nothing to check`);

  step(2, total, CONTINUITY_STEPS[1]);
  const canonPack = buildContext(dir, chapter, opts.prev ?? 2);

  step(3, total, CONTINUITY_STEPS[2]);
  const engine = opts.engine ?? "claude";
  const raw = await (opts.callModel ?? callEngineContinuity(engine))(buildContinuityPrompt(canonPack, body));
  const { rulesRead, holds, conflicts } = parseContinuityResponse(raw, body);

  step(4, total, CONTINUITY_STEPS[3]);
  const report: ContinuityReport = {
    series: slug,
    chapter,
    engine,
    checkedAt: new Date().toISOString(),
    // The model's own count is a claim, not a measurement. Fall back to what this repo can
    // actually count (the character sheets it was handed) rather than showing an invented number.
    rulesRead: rulesRead || characterSheets(dir).length,
    holds,
    conflicts,
  };
  const out = continuityReportPath(slug, chapter, opts.root ?? CONTINUITY_ROOT);
  mkdirSync(join(out, ".."), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
  return report;
}

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const series = process.argv[2];
  if (!series || series.startsWith("--")) {
    console.error("usage: npx tsx src/fiction/continuity.ts <series> [--chapter N]");
    process.exit(1);
  }
  const dir = resolveSeriesDir(series);
  const chapter = flag("--chapter")
    ? Number(flag("--chapter"))
    : (await import("./_series.js")).chapterNumbers(dir).slice(-1)[0];
  if (!chapter) {
    console.error("no chapter to check yet");
    process.exit(1);
  }
  const engineFlag = flag("--engine");
  const engine: Engine = isEngine(engineFlag) ? engineFlag : "claude";
  try {
    const report = await runContinuityCheck(series, chapter, {
      engine,
      // The STEP markers the job queue reads (src/review/jobs.ts parseStepMarker). They go to
      // stdout on their own lines; the findings go to the report file, never mixed in here.
      onStep: (n, total, label) => process.stdout.write(`STEP ${n}/${total} ${label}\n`),
    });
    process.stdout.write(
      `${report.conflicts.length} conflict(s), ${report.holds.length} hold(s) in chapter ${report.chapter} of ${report.series}\n`,
    );
    process.stdout.write(`report: ${continuityReportPath(report.series, report.chapter)}\n`);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) void main();
