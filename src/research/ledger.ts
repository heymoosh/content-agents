import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

export type NoteCompleteness = "complete" | "partial" | "stale" | "error";

export interface SubstackNotesLedgerEntry {
  note_id: string;
  first_seen_at: string;
  last_checked_at: string;
  last_activity_at: string | null;
  reply_branch_count_reported: number;
  reply_branch_count_captured: number;
  reply_observation_count_captured: number;
  completeness: NoteCompleteness;
  cursor_or_etag: string | null;
  last_error: string | null;
  raw_capture_path: string | null;
}

export function readResearchLedger(path: string): Map<string, SubstackNotesLedgerEntry> {
  if (!existsSync(path)) return new Map();
  const latest = new Map<string, SubstackNotesLedgerEntry>();
  for (const line of readFileSync(path, "utf8").split("\n").filter(Boolean)) {
    try {
      const entry = JSON.parse(line) as SubstackNotesLedgerEntry;
      if (entry.note_id) latest.set(entry.note_id, entry);
    } catch {
      // A stray malformed line must not erase checkpoint state from valid later lines.
    }
  }
  return latest;
}

export function appendResearchLedger(path: string, entry: SubstackNotesLedgerEntry): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(entry) + "\n");
}

function hoursSince(value: string | null, nowMs: number): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? Math.max(0, (nowMs - parsed) / 3_600_000) : Number.POSITIVE_INFINITY;
}

export function shouldCheckNote(
  note: { publishedAt: string | null; replies: number },
  previous: SubstackNotesLedgerEntry | undefined,
  now = new Date()
): boolean {
  if (!previous) return true;
  if (previous.completeness !== "complete") return true;
  if (previous.reply_branch_count_reported !== previous.reply_branch_count_captured) return true;
  const ageHours = hoursSince(note.publishedAt, now.getTime());
  const checkedHours = hoursSince(previous.last_checked_at, now.getTime());
  if (ageHours < 7 * 24) return true;
  if (ageHours < 30 * 24) return checkedHours > 72;
  return checkedHours > 30 * 24 || previous.reply_branch_count_reported !== note.replies;
}
