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

// The three routes in serve.ts that wrap this module, declared here for the wiring guard.
//
// They were invisible to BOTH of page.test.ts's guards, which is worse than it sounds. The first
// guard finds routes by scanning serve.ts for `url.pathname === "..."` literals, and these three
// are regex-dispatched (they carry a slug and a question number), so it never saw them. The second
// guard reads its route list from venture-reads.ts/venture-writes.ts, and these are written
// straight into serve.ts rather than through either dispatcher, so it never saw them either. A
// route in neither list is a route no test can notice has no caller.
//
// So the list is declared next to the functions it exposes, the same way VENTURE_WRITE_PATHS is,
// and page.test.ts asserts BOTH directions: every path here has a caller in the page, and every
// regex route literal in serve.ts is declared in one of these lists — so the next regex route
// added straight into serve.ts fails the guard until it is declared too.
export const INTAKE_DRAFT_PATHS = [
  "/api/venture/:slug/intake/:n/draft", // POST save one answer, GET restore one answer
  "/api/venture/:slug/intake/drafts", // GET restore the whole in-progress interview
  "/api/venture/:slug/intake/section", // POST save one Voice Evidence or Scorecard field
  "/api/venture/:slug/intake/sections", // GET restore both section drafts
  "/api/venture/:slug/intake/drafts/clear", // POST clear all scratch buffers after commit
];

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

export const INTAKE_SECTION_FIELDS = {
  voice: ["writing_samples", "worldview_statement", "natural_phrases", "refused_phrases_tones"],
  scorecard: ["required_live_posts", "ongoing_pace", "views_or_clicks_target", "opt_in_target", "response_quality_test", "sustainability_test"],
} as const;

export type IntakeSection = keyof typeof INTAKE_SECTION_FIELDS;
export type IntakeSectionField = (typeof INTAKE_SECTION_FIELDS)[IntakeSection][number];

export interface IntakeSectionDraft {
  section: IntakeSection;
  field: IntakeSectionField;
  text: string;
  savedAt: string;
}

export type IntakeSectionDrafts = {
  [S in IntakeSection]: Partial<Record<(typeof INTAKE_SECTION_FIELDS)[S][number], IntakeSectionDraft>>;
};

export interface SectionSaveResult {
  ok: boolean;
  error?: string;
  draft?: IntakeSectionDraft;
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

function sectionError(section: unknown): string | null {
  if (section !== "voice" && section !== "scorecard") return 'section must be "voice" or "scorecard"';
  return null;
}

function sectionFieldError(section: unknown, field: unknown): string | null {
  const badSection = sectionError(section);
  if (badSection) return badSection;
  if (typeof field !== "string" || !(INTAKE_SECTION_FIELDS[section as IntakeSection] as readonly string[]).includes(field)) {
    return `unknown field for ${section}: ${String(field)}`;
  }
  return null;
}

function draftPath(slug: string, root: string): string {
  return join(root, `${slug}.json`);
}

function sectionDraftPath(slug: string, root: string): string {
  return join(root, `${slug}.sections.json`);
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

function emptySectionDrafts(): IntakeSectionDrafts {
  return { voice: {}, scorecard: {} };
}

function readSectionFile(slug: string, root: string): IntakeSectionDrafts {
  const path = sectionDraftPath(slug, root);
  if (!existsSync(path)) return emptySectionDrafts();
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { sections?: Partial<IntakeSectionDrafts> };
    if (!parsed || typeof parsed !== "object" || !parsed.sections || typeof parsed.sections !== "object") return emptySectionDrafts();
    const sections = emptySectionDrafts();
    for (const section of ["voice", "scorecard"] as const) {
      const fields = parsed.sections[section];
      if (!fields || typeof fields !== "object") continue;
      for (const field of INTAKE_SECTION_FIELDS[section]) {
        const raw = (fields as Record<string, unknown>)[field];
        if (!raw || typeof raw !== "object" || typeof (raw as { text?: unknown }).text !== "string") continue;
        const savedAt = typeof (raw as { savedAt?: unknown }).savedAt === "string" ? (raw as { savedAt: string }).savedAt : "";
        (sections[section] as Record<string, IntakeSectionDraft | undefined>)[field] = {
          section, field, text: (raw as { text: string }).text, savedAt,
        };
      }
    }
    return sections;
  } catch {
    return emptySectionDrafts();
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

function writeSectionFile(slug: string, root: string, sections: IntakeSectionDrafts): void {
  mkdirSync(root, { recursive: true });
  const path = sectionDraftPath(slug, root);
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify({ slug, sections }, null, 2)}\n`);
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

export function saveIntakeSectionDraft(
  slug: string,
  section: unknown,
  field: unknown,
  text: unknown,
  root: string = INTAKE_DRAFT_DIR,
): SectionSaveResult {
  const bad = slugError(slug) ?? sectionFieldError(section, field);
  if (bad) return { ok: false, error: bad };
  if (typeof text !== "string") return { ok: false, error: "draft text must be text" };
  const validSection = section as IntakeSection;
  const validField = field as IntakeSectionField;
  const sections = readSectionFile(slug, root);
  const draft: IntakeSectionDraft = { section: validSection, field: validField, text, savedAt: new Date().toISOString() };
  (sections[validSection] as Record<string, IntakeSectionDraft | undefined>)[validField] = draft;
  writeSectionFile(slug, root, sections);
  return { ok: true, draft };
}

export function readIntakeSections(slug: string, root: string = INTAKE_DRAFT_DIR): { ok: boolean; error?: string; sections: IntakeSectionDrafts } {
  const bad = slugError(slug);
  if (bad) return { ok: false, error: bad, sections: emptySectionDrafts() };
  return { ok: true, sections: readSectionFile(slug, root) };
}

// Drop a venture's scratch buffer once its real answers are committed, so stale drafts never
// shadow the saved intake. Called by the room right after a successful commit — deliberately from
// the client rather than folded into the commit route, so the clear is one visible step and a
// failed clear cannot be mistaken for a failed kickoff.
export function clearIntakeDrafts(slug: string, root: string = INTAKE_DRAFT_DIR): { ok: boolean; error?: string; cleared: boolean } {
  const bad = slugError(slug);
  if (bad) return { ok: false, error: bad, cleared: false };
  const paths = [draftPath(slug, root), sectionDraftPath(slug, root)];
  let cleared = false;
  for (const path of paths) {
    if (!existsSync(path)) continue;
    rmSync(path, { force: true });
    cleared = true;
  }
  return { ok: true, cleared };
}
