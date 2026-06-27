import { readFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { repoRoot } from "../db/db.js";

// Committed ledger for the daily cloud routine: tracks which Substack Notes have already been
// spread to Typefully as scheduled drafts. Cloud machines clone fresh each run, so analytics.db
// (gitignored) can't serve as memory — this file lives in data/ and IS committed.
//
// Format: JSONL — one JSON object per line, append-only. Never delete entries.

export const LEDGER_PATH = join(repoRoot, "data", "notes-spread-ledger.jsonl");

export interface LedgerEntry {
  noteId: string;       // entity_key, e.g. "c-279240534"
  url: string;          // substack note URL
  spreadAt: string;     // ISO timestamp of when this run spread the note
  platforms: string[];  // text platforms it was spread to, e.g. ["x", "bluesky"]
  contentFolder: string; // relative path, e.g. "content/2026-06-26-my-note"
}

// Read all ledger entries and return a Set of already-spread note IDs for fast dedup.
// `ledgerPath` is injectable for testing (defaults to the committed ledger file).
export function readLedger(
  ledgerPath = LEDGER_PATH
): { entries: LedgerEntry[]; spreadIds: Set<string> } {
  if (!existsSync(ledgerPath)) return { entries: [], spreadIds: new Set() };
  const lines = readFileSync(ledgerPath, "utf8").split("\n").filter(Boolean);
  const entries: LedgerEntry[] = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line) as LedgerEntry);
    } catch {
      // skip malformed lines silently — don't crash if the file gets a stray newline
    }
  }
  const spreadIds = new Set(entries.map((e) => e.noteId));
  return { entries, spreadIds };
}

// Append a single new entry to the ledger.
// `ledgerPath` is injectable for testing.
export function appendLedger(entry: LedgerEntry, ledgerPath = LEDGER_PATH): void {
  mkdirSync(dirname(ledgerPath), { recursive: true });
  appendFileSync(ledgerPath, JSON.stringify(entry) + "\n");
}
