// Venture intake autosave (Venture Build v7 handoff §1): a scratch buffer for the GUI's 25-question
// intake interview. The room debounces every keystroke here so a half-typed answer survives a
// closed tab, a reload, or a walk away from the desk.
//
// This is NOT the intake write. `kickoffVenture()` in src/venture/intake.ts still owns the real
// answers and still writes all 25 at once; nothing in this file touches venture/ or intake.md.
// Drafts live outside git under ~/.content-agents/venture-intake-drafts/<slug>.json, the same
// convention the GUI's job logs already use (src/review/jobs.ts).

import { readFileSync, writeFileSync, renameSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { INTAKE_QUESTIONS } from "../venture/intake.js";

export const INTAKE_DRAFT_DIR = join(homedir(), ".content-agents", "venture-intake-drafts");

// The interview is a fixed 25 questions (venture/rules.md §4.2). Read the real list rather than
// hardcoding the count, so this guard tracks it if the interview ever changes.
export const MAX_QUESTION = INTAKE_QUESTIONS.length;

export interface IntakeDraft {
  n: number; // 1-based question number
  text: string;
  savedAt: string; // ISO timestamp, so the room can show when it last saved
}

export interface IntakeDraftFile {
  slug: string;
  drafts: IntakeDraft[]; // ordered by question number
}

export interface SaveResult {
  ok: boolean;
  error?: string;
  draft?: IntakeDraft;
}

// Same posture as fiction.ts's resolveDoc(): one path segment, lowercase-alphanumeric first char,
// then word chars and hyphens. That rejects "a/b", "..", ".hidden", and "" in one test.
function slugError(slug: unknown): string | null {
  if (typeof slug !== "string" || !/^[a-z0-9][\w-]*$/.test(slug)) return "bad venture name";
  return null;
}

function questionError(n: unknown): string | null {
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > MAX_QUESTION) {
    return `question number must be a whole number from 1 to ${MAX_QUESTION}`;
  }
  return null;
}

function draftPath(slug: string, root: string): string {
  return join(root, `${slug}.json`);
}

// A debounced autosave writes constantly, so a truncated or hand-mangled file must never take the
// room down. Anything unreadable reads back as no drafts, and the next save overwrites it.
function readFile(slug: string, root: string): IntakeDraft[] {
  const path = draftPath(slug, root);
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    const drafts = (parsed as IntakeDraftFile)?.drafts;
    if (!Array.isArray(drafts)) return [];
    return drafts.filter(
      (d): d is IntakeDraft =>
        !!d && typeof d === "object" && questionError((d as IntakeDraft).n) === null && typeof (d as IntakeDraft).text === "string",
    );
  } catch {
    return [];
  }
}

// Write to a sibling temp file and rename, so a reader never sees a half-written file.
function writeFile(slug: string, root: string, drafts: IntakeDraft[]): void {
  mkdirSync(root, { recursive: true });
  const path = draftPath(slug, root);
  const tmp = `${path}.tmp`;
  const body: IntakeDraftFile = { slug, drafts: [...drafts].sort((a, b) => a.n - b.n) };
  writeFileSync(tmp, `${JSON.stringify(body, null, 2)}\n`);
  renameSync(tmp, path);
}

// Save one question's in-progress text. An empty string is a real save (Muxin cleared the box),
// not a no-op, so the restore matches what she left on screen.
export function saveIntakeDraft(slug: string, n: number, text: string, root: string = INTAKE_DRAFT_DIR): SaveResult {
  const bad = slugError(slug) ?? questionError(n);
  if (bad) return { ok: false, error: bad };
  if (typeof text !== "string") return { ok: false, error: "draft text must be text" };
  const drafts = readFile(slug, root).filter((d) => d.n !== n);
  const draft: IntakeDraft = { n, text, savedAt: new Date().toISOString() };
  drafts.push(draft);
  writeFile(slug, root, drafts);
  return { ok: true, draft };
}

// Every in-progress answer for one venture, so reopening the interview restores the whole form
// in one fetch.
export function readIntakeDrafts(slug: string, root: string = INTAKE_DRAFT_DIR): { ok: boolean; error?: string; drafts: IntakeDraft[] } {
  const bad = slugError(slug);
  if (bad) return { ok: false, error: bad, drafts: [] };
  return { ok: true, drafts: readFile(slug, root).sort((a, b) => a.n - b.n) };
}

// One question's draft. No draft yet is the normal case on a fresh question, so it reads back as
// a null draft rather than an error.
export function readIntakeDraft(slug: string, n: number, root: string = INTAKE_DRAFT_DIR): { ok: boolean; error?: string; draft: IntakeDraft | null } {
  const bad = slugError(slug) ?? questionError(n);
  if (bad) return { ok: false, error: bad, draft: null };
  return { ok: true, draft: readFile(slug, root).find((d) => d.n === n) ?? null };
}

// Drop a venture's scratch buffer once its real answers are committed, so stale drafts never
// shadow the saved intake. No route calls this yet; the Venture room will, right after the
// interview's final write.
export function clearIntakeDrafts(slug: string, root: string = INTAKE_DRAFT_DIR): { ok: boolean; error?: string; cleared: boolean } {
  const bad = slugError(slug);
  if (bad) return { ok: false, error: bad, cleared: false };
  const path = draftPath(slug, root);
  if (!existsSync(path)) return { ok: true, cleared: false };
  rmSync(path, { force: true });
  return { ok: true, cleared: true };
}
