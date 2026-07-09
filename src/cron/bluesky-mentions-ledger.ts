import { readFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { repoRoot } from "../db/db.js";

// Committed ledger for the Bluesky mentions poller (src/cron/bluesky-mentions.ts): tracks which
// mention/reply notifications the poller has already SEEN, so a re-run never re-flags the same
// notification. Mirrors data/notes-spread-ledger.jsonl's exact convention (src/cron/ledger.ts) —
// JSONL, append-only, one entry per line, never delete.
//
// The poller only ever appends "seen" entries here — it does NOT draft anything (same detect/draft
// separation as notes-daily.ts). Drafting a reply (src/atomize/reply-draft.ts) reads this ledger to
// find a mention but does not write back to it.

export const LEDGER_PATH = join(repoRoot, "data", "bluesky-mentions-ledger.jsonl");

export interface MentionLedgerEntry {
  uri: string; // AT URI of the mention/reply post — the dedupe key (one notification, one post)
  reason: "mention" | "reply";
  authorHandle: string;
  postUrl: string; // https://bsky.app/profile/<handle>/post/<rkey>
  postText: string;
  indexedAt: string; // Bluesky's own notification timestamp
  seenAt: string; // ISO timestamp of when this run detected it
}

// Read all ledger entries and return a Set of already-seen URIs for fast dedupe.
// `ledgerPath` is injectable for testing (defaults to the committed ledger file).
export function readLedger(
  ledgerPath = LEDGER_PATH
): { entries: MentionLedgerEntry[]; seenUris: Set<string> } {
  if (!existsSync(ledgerPath)) return { entries: [], seenUris: new Set() };
  const lines = readFileSync(ledgerPath, "utf8").split("\n").filter(Boolean);
  const entries: MentionLedgerEntry[] = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line) as MentionLedgerEntry);
    } catch {
      // skip malformed lines silently — don't crash if the file gets a stray newline
    }
  }
  const seenUris = new Set(entries.map((e) => e.uri));
  return { entries, seenUris };
}

// Append a single new entry to the ledger. `ledgerPath` is injectable for testing.
export function appendLedger(entry: MentionLedgerEntry, ledgerPath = LEDGER_PATH): void {
  mkdirSync(dirname(ledgerPath), { recursive: true });
  appendFileSync(ledgerPath, JSON.stringify(entry) + "\n");
}
