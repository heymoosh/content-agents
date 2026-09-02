import { CHARLES_DIR, listCharlesPosts, readCharlesPost, stampCharlesEngine, type CharlesPost } from "./charles.js";
import { ENGINE_COMMANDS, ENGINE_LABELS, type Engine } from "./engines.js";
import { decodeSpawnFailure, runClaudeSpawn, runQueued } from "./jobs.js";
import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, rmdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

const CHARLES_DRAFT_TIMEOUT_MS = 240_000;
export type CharlesDraftMode = "oneliner" | "essay" | "reply";
const CHARLES_DRAFT_MODES = new Set<CharlesDraftMode>(["oneliner", "essay", "reply"]);
const CHARLES_DIR_BY_MODE: Record<CharlesDraftMode, string> = { oneliner: "one-liners", essay: "essays", reply: "replies" };

function engineName(job: { engine?: Engine }): string {
  return ENGINE_LABELS[job.engine ?? "claude"];
}

export function assertCharlesDraftPolicy(body: string): void {
  if (/[—–]/.test(body)) {
    throw new Error("Charles draft contains an em dash or en dash; no draft was queued");
  }
}

export interface CharlesDraftState {
  files: Map<string, Buffer>;
  dirs: Set<string>;
  modes: Map<string, number>;
}

function treeEntries(root: string, rel = ""): Array<{ rel: string; kind: "file" | "dir" | "other" }> {
  if (!existsSync(join(root, rel))) return [];
  const entries: Array<{ rel: string; kind: "file" | "dir" | "other" }> = [];
  for (const entry of readdirSync(join(root, rel), { withFileTypes: true })) {
    const child = rel ? join(rel, entry.name) : entry.name;
    const kind = entry.isDirectory() ? "dir" : entry.isFile() ? "file" : "other";
    entries.push({ rel: child, kind });
    if (kind === "dir") entries.push(...treeEntries(root, child));
  }
  return entries;
}

export function captureCharlesDraftState(root: string): CharlesDraftState {
  const files = new Map<string, Buffer>();
  const dirs = new Set<string>();
  const modes = new Map<string, number>();
  for (const entry of treeEntries(root)) {
    if (entry.kind === "other") throw new Error(`Charles tree contains an unsupported filesystem entry: ${entry.rel}`);
    modes.set(entry.rel, lstatSync(join(root, entry.rel)).mode & 0o7777);
    if (entry.kind === "dir") dirs.add(entry.rel);
    else files.set(entry.rel, readFileSync(join(root, entry.rel)));
  }
  return { files, dirs, modes };
}

export function restoreCharlesDraftState(before: CharlesDraftState, root: string): void {
  const after = treeEntries(root);
  for (const entry of after.filter((candidate) => candidate.kind !== "dir" && !before.files.has(candidate.rel))) {
    rmSync(join(root, entry.rel), { force: true });
  }
  for (const entry of after
    .filter((candidate) => candidate.kind === "dir" && !before.dirs.has(candidate.rel))
    .sort((a, b) => b.rel.length - a.rel.length)) {
    rmSync(join(root, entry.rel), { recursive: true, force: true });
  }
  for (const dir of [...before.dirs].sort((a, b) => a.length - b.length)) mkdirSync(join(root, dir), { recursive: true });
  for (const [rel, bytes] of before.files) {
    const target = join(root, rel);
    if (existsSync(target) && !lstatSync(target).isFile()) rmSync(target, { recursive: true, force: true });
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  }
  for (const [rel, mode] of before.modes) chmodSync(join(root, rel), mode);
}

function stateDifferences(before: CharlesDraftState, after: CharlesDraftState): string[] {
  const differences: string[] = [];
  for (const rel of before.files.keys()) {
    if (!after.files.has(rel)) differences.push(`removed file ${rel}`);
    else if (!before.files.get(rel)!.equals(after.files.get(rel)!)) differences.push(`modified file ${rel}`);
  }
  for (const rel of after.files.keys()) if (!before.files.has(rel)) differences.push(`added file ${rel}`);
  for (const rel of before.dirs) if (!after.dirs.has(rel)) differences.push(`removed directory ${rel}`);
  for (const rel of after.dirs) if (!before.dirs.has(rel)) differences.push(`added directory ${rel}`);
  for (const [rel, mode] of before.modes) if (after.modes.get(rel) !== mode) differences.push(`changed mode or permission ${rel}`);
  return differences;
}

export function assertCharlesStateUnchanged(before: CharlesDraftState, after: CharlesDraftState): void {
  const differences = stateDifferences(before, after);
  if (differences.length) throw new Error(`Charles changed while the draft was running: ${differences.join(", ")}`);
}

interface QueueRowShape { id: string; type: string; file: string; status: string; notes: string }

function queueRows(text: string): QueueRowShape[] {
  return text.split("\n").flatMap((line) => {
    if (!line.trim().startsWith("|")) return [];
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 5 || cells[0] === "id" || /^-+$/.test(cells[0])) return [];
    return [{ id: cells[0], type: cells[1], file: cells[2], status: cells[3], notes: cells[4] }];
  });
}

export function validateCharlesDraftMutation(
  before: CharlesDraftState,
  mode: CharlesDraftMode,
  root: string,
): { id: string; post: CharlesPost } {
  const after = captureCharlesDraftState(root);
  const queueRel = "review-queue.md";
  const queueBefore = before.files.get(queueRel)?.toString("utf8") ?? "";
  const queueAfter = after.files.get(queueRel)?.toString("utf8") ?? "";
  const added = [...after.files.keys()].filter((rel) => !before.files.has(rel));
  const removed = [...before.files.keys()].filter((rel) => !after.files.has(rel));
  const modified = [...before.files.keys()].filter((rel) => {
    const next = after.files.get(rel);
    return next !== undefined && !before.files.get(rel)!.equals(next);
  });
  const expectedDir = `posts/${CHARLES_DIR_BY_MODE[mode]}`;
  const addedDirs = [...after.dirs].filter((rel) => !before.dirs.has(rel));
  const removedDirs = [...before.dirs].filter((rel) => !after.dirs.has(rel));
  if (removedDirs.length || addedDirs.some((rel) => rel !== expectedDir)) {
    throw new Error("Charles draft must not add or remove any unexpected directory");
  }
  for (const [rel, priorMode] of before.modes) {
    if (after.modes.get(rel) !== priorMode) throw new Error(`Charles draft changed a file mode or permission: ${rel}`);
  }
  if (removed.length || modified.some((rel) => rel !== queueRel) || modified.filter((rel) => rel === queueRel).length !== 1) {
    throw new Error("Charles draft must change only review-queue.md and one new draft file");
  }
  if (added.length !== 1) throw new Error("Charles draft must create exactly one new draft file");
  const expectedType: Record<CharlesDraftMode, string> = { oneliner: "one-liner", essay: "essay", reply: "reply" };
  if (!new RegExp(`^posts/${CHARLES_DIR_BY_MODE[mode]}/[a-z0-9][a-z0-9-]*\\.md$`).test(added[0])) {
    throw new Error(`Charles ${mode} draft must use its mode-specific posts directory`);
  }
  const prefix = queueBefore.endsWith("\n") ? queueBefore : queueBefore + "\n";
  if (!queueAfter.startsWith(prefix)) throw new Error("Charles draft must append one queue row without rewriting existing queue bytes");
  const appended = queueAfter.slice(prefix.length).trimEnd();
  if (!appended || appended.includes("\n")) throw new Error("Charles draft must append exactly one queue row");
  const beforeIds = new Set(queueRows(queueBefore).map((row) => row.id));
  const newRows = queueRows(queueAfter).filter((row) => !beforeIds.has(row.id));
  if (newRows.length !== 1) throw new Error("Charles draft must append exactly one new queue id");
  const row = newRows[0];
  if (row.status !== "pending") throw new Error("Charles draft queue status must be pending");
  if (row.type !== expectedType[mode] || row.file !== added[0]) throw new Error("Charles draft row must match its requested mode and new file");
  const authored = after.files.get(added[0])!.toString("utf8") + "\n" + appended;
  assertCharlesDraftPolicy(authored);
  return { id: row.id, post: readCharlesPost(row.id, root) };
}

export async function withCharlesDraftStage<T>(task: (stage: { root: string; charlesRoot: string }) => Promise<T>): Promise<T> {
  const root = mkdtempSync(join(tmpdir(), "content-agents-charles-draft-"));
  try {
    const charlesRoot = join(root, "charles");
    cpSync(CHARLES_DIR, charlesRoot, { recursive: true });
    const skillTarget = join(root, ".claude", "skills", "charles");
    mkdirSync(dirname(skillTarget), { recursive: true });
    cpSync(join(dirname(CHARLES_DIR), ".claude", "skills", "charles"), skillTarget, { recursive: true });
    return await task({ root, charlesRoot });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

export function writeCharlesQueueAtomically(path: string, bytes: Buffer, mode: number): void {
  const temp = join(dirname(path), `.review-queue-${randomUUID()}.tmp`);
  try {
    writeFileSync(temp, bytes, { flag: "wx" });
    chmodSync(temp, mode);
    renameSync(temp, path);
  } finally {
    rmSync(temp, { force: true });
  }
}

// ── Charles room: "Draft" (Build 4) ─────────────────────────────────────────────────────────
// The Charles room's missing front door — parity with the Content room's "Format directly", which
// spawns the real /atomize headlessly. This does the same for /charles: one bounded claude -p call
// that writes exactly one new draft file + appends exactly one review-queue.md row, then stops.
// Text modes only (one-liner/essay/reply) — memes are out of scope here on purpose (Muxin does
// meme research/image-gen elsewhere); the Charles room instead offers a one-click copy of
// charles/config/persona-brief.md for her to hand to whatever tool she's using for that.

// Exported so the prompt's guardrails (persona.yaml governs the voice, not config/voice.yaml;
// leak-bank-only claims; exactly one file + one queue row; id uniqueness) are unit-testable
// without spawning a real subprocess.
export function charlesDraftPrompt(mode: CharlesDraftMode, input: string, existingIds: string[]): string {
  const inputLine =
    mode === "reply"
      ? `Reply to this real post/article — fetch it first, never invent what it said: ${input}`
      : input.trim()
        ? `Topic/angle to draft toward: ${input.trim()}`
        : `No specific topic given — pick one of the comic-engine angles yourself.`;
  return [
    `Draft ONE new post for Charles Lord Featherbottom, a fictional satirical persona in this repo`,
    `(Build 4). Do not run shell commands beyond what reading/writing files requires; write the one`,
    `new file plus the one queue row below, then stop.`,
    ``,
    `First read charles/AGENTS.md and charles/config/persona.yaml in full — his voice is governed`,
    `by persona.yaml, NOT config/voice.yaml. Then follow the "Mode: /charles ${mode}" section of`,
    `.claude/skills/charles/SKILL.md exactly, for this input:`,
    ``,
    inputLine,
    ``,
    `Rules:`,
    `- Write ONLY the one new draft file (under charles/posts/${CHARLES_DIR_BY_MODE[mode]}/)`,
    `  plus ONE new row appended to charles/review-queue.md. Touch nothing else.`,
    `- Pick a short kebab-case id/slug for the draft that is NOT already one of these existing ids:`,
    `  ${existingIds.length ? existingIds.join(", ") : "(none yet)"}`,
    `- Status for the new row is always "pending" — never approve/discard it yourself.`,
    `- If you use a "useful leak," it MUST be one already listed in persona.yaml's leak_bank —`,
    `  never invent a statistic, org, or ballot measure that isn't there.`,
    `- Keep the em-dash ban (charles/AGENTS.md carries it over from Build 2's fiction rule).`,
  ].join("\n");
}

export async function enqueueCharlesDraft(mode: string, input: string, engine: Engine = "claude"): Promise<{ id: string; post: CharlesPost }> {
  if (!CHARLES_DRAFT_MODES.has(mode as CharlesDraftMode)) {
    throw new Error(`"${mode}" isn't a mode this can draft from the GUI. Try one-liner, essay, or reply`);
  }
  if (mode === "reply" && !input.trim()) throw new Error("a reply needs a URL to react to");

  return runQueued("charles-draft", `Draft a Charles ${mode}`, async (job) => {
    const liveBefore = captureCharlesDraftState(CHARLES_DIR);
    const existingIds = listCharlesPosts(CHARLES_DIR).map((post) => post.id);
    const prompt = charlesDraftPrompt(mode as CharlesDraftMode, input, existingIds);
    return withCharlesDraftStage(async (stage) => {
      const stagedBefore = captureCharlesDraftState(stage.charlesRoot);
      const result = await runClaudeSpawn(job, prompt, { timeoutMs: CHARLES_DRAFT_TIMEOUT_MS, cwd: stage.root });
      const failure = decodeSpawnFailure(result, job.id, {
        timeoutVerb: `${engineName(job)} draft`, timeoutLabel: `${CHARLES_DRAFT_TIMEOUT_MS / 1000}s`,
        exitVerb: `${engineName(job)} draft`, command: job.engine === "claude" ? undefined : ENGINE_COMMANDS[job.engine ?? "claude"],
      });
      if (failure) throw new Error(failure);
      const accepted = validateCharlesDraftMutation(stagedBefore, mode as CharlesDraftMode, stage.charlesRoot);
      stampCharlesEngine(accepted.id, job.engine ?? "claude", stage.charlesRoot);
      assertCharlesStateUnchanged(liveBefore, captureCharlesDraftState(CHARLES_DIR));
      const stagedAfter = captureCharlesDraftState(stage.charlesRoot);
      const addedFile = [...stagedAfter.files.keys()].find((rel) => !stagedBefore.files.has(rel))!;
      const queueAfter = stagedAfter.files.get("review-queue.md")!;
      const draftBytes = stagedAfter.files.get(addedFile)!;
      const target = join(CHARLES_DIR, addedFile);
      const targetDir = dirname(target);
      const madeTargetDir = !liveBefore.dirs.has(dirname(addedFile));
      const queuePath = join(CHARLES_DIR, "review-queue.md");
      try {
        mkdirSync(targetDir, { recursive: true });
        writeFileSync(target, draftBytes, { flag: "wx" });
        writeCharlesQueueAtomically(queuePath, queueAfter, liveBefore.modes.get("review-queue.md")!);
      } catch (error) {
        if (existsSync(target) && lstatSync(target).isFile() && readFileSync(target).equals(draftBytes)) rmSync(target, { force: true });
        if (madeTargetDir) {
          try { rmdirSync(targetDir); } catch { /* preserve a non-empty directory another writer now owns */ }
        }
        throw error;
      }
      return { id: accepted.id, post: { ...accepted.post, engine: job.engine ?? "claude" } };
    });
  }, engine);
}
