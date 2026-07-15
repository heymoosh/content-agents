// inbound-to-tracker.ts — Fold platform-specific inbound-listening ledgers into the shared
// Follow-ups tracker (backlog card 97588dc8, epic 659b50f0). The Bluesky mentions poller
// (bluesky-mentions.ts) detects mentions/replies and dedupes them into its own ledger, but never
// wrote anything to data/outreach/tracker.jsonl — so the Follow-ups tab's inbound bucket
// (tracker.ts's buildInboundRows) stayed permanently empty. This module is the missing link.
//
//   npm run inbound-to-tracker   # fold data/bluesky-mentions-ledger.jsonl into tracker.jsonl
//
// Design (settled 2026-07-15): follow-up MECHANICS are identical across inbound and outbound —
// same due-date clock, same nudge/overdue/responded/done vocabulary (src/outreach/tracker.ts).
// The only new thing inbound needs is ONE leading state before a lead rejoins that shared flow:
// a fresh mention is "inbound_received" (ball in Muxin's court, no clock yet, renders as "draft
// reply" — see tracker.ts's nextActionLabel). Once she replies with a normal contacted/
// followup_sent event, it's a plain outbound-shaped row from then on. No parallel semantics.
//
// One platform ledger today (Bluesky); more (X, LinkedIn, Substack — cards ec217518/aab14467/
// 81808fa0) plug in the same way once built: read their own ledger, call foldMentionsIntoTracker
// with a `channel` label.

import { pathToFileURL } from "node:url";
import { readLedger, type MentionLedgerEntry } from "./bluesky-mentions-ledger.js";
import { readTrackerEvents, appendTrackerEvent, TRACKER_PATH, type TrackerEvent } from "../outreach/tracker.js";

export interface FoldMentionsResult {
  appended: number;
  skipped: number; // already present in tracker.jsonl (dedupe by AT URI, stored in `message`)
}

// Pure: given already-loaded ledger entries + existing tracker events, return only the new
// tracker events to append. Dedupe key is the mention's own URI, carried on the synthesized
// event's `message` field — so a re-run of the fold (e.g. after re-running the poller) never
// double-appends the same mention.
export function foldMentionsPure(
  mentions: MentionLedgerEntry[],
  existingEvents: TrackerEvent[],
  channel: string
): TrackerEvent[] {
  const alreadyFolded = new Set(
    existingEvents.filter((e) => e.bucket === "inbound" && e.event === "inbound_received").map((e) => e.message)
  );
  return mentions
    .filter((m) => !alreadyFolded.has(m.uri))
    .map((m) => ({
      ts: m.indexedAt,
      lead: m.authorHandle,
      bucket: "inbound" as const,
      event: "inbound_received" as const,
      channel,
      message: m.uri,
      note: m.postText,
    }));
}

// Read the Bluesky mentions ledger + current tracker state, append any not-yet-folded mentions.
// Paths are injectable so tests never touch the committed ledger/tracker files.
export function foldLedgerIntoTracker(
  ledgerPath?: string,
  trackerPath: string = TRACKER_PATH
): FoldMentionsResult {
  const { entries } = readLedger(ledgerPath);
  const existingEvents = readTrackerEvents(trackerPath);
  const newEvents = foldMentionsPure(entries, existingEvents, "bluesky");
  for (const event of newEvents) {
    appendTrackerEvent(event, trackerPath);
  }
  return { appended: newEvents.length, skipped: entries.length - newEvents.length };
}

async function main() {
  const result = foldLedgerIntoTracker();
  console.log(`inbound-to-tracker: ${result.appended} new mention(s) folded into tracker.jsonl, ${result.skipped} already present.`);
}

// Run the CLI only when executed directly (matches bluesky-mentions.ts / typefully.ts).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
