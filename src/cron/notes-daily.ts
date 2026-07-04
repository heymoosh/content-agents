// notes-daily.ts — Daily cloud routine: fetch new Substack Notes, log which ones are new.
//
//   npm run notes-daily               # live run (needs SUBSTACK_HANDLE in .env)
//   npm run notes-daily -- --dry-run  # print plan only, no network calls, no file writes
//   npm run notes-daily -- --limit 40 # fetch further back (default 20)
//
// Cloud-safe: all state lives in data/notes-spread-ledger.jsonl (committed to git).
// The repo is cloned fresh each cloud run; on success, commit + push the updated ledger so the
// next run knows which notes were already surfaced. See docs/setup-cloud-routine.md.
//
// Flow: load ledger → fetch notes → filter new → log them → mark seen in the ledger. That's it.
//
// This script does NOT draft anything (Muxin's rule, 2026-07-04): drafting real per-platform
// posts needs genuine Claude judgment (Spin's per-channel reframing), and that only runs where
// Claude Code is actually authenticated — locally, via the review GUI's "Pull Substack Notes"
// button (`claude -p "/atomize notes"`, $0 on the subscription). A cloud runner like GitHub
// Actions has no such session, so this script stays deliberately dumb: it just keeps the ledger
// honest so the same note isn't re-flagged every day. All real drafting happens locally.

import "../util/env.js";
import { readLedger, appendLedger } from "./ledger.js";
import { fetchSubstackNotes, FetchedNote } from "../atomize/fetch-notes.js";

// ---- helpers ---------------------------------------------------------------

// Engagement score — mirrors the formula in new-notes.ts, for readable log ordering only.
function engScore(n: FetchedNote): number {
  return n.likes + n.replies * 3 + n.reposts * 2;
}

// Extract a short title from the note body (first non-empty line, max 80 chars).
function noteTitle(text: string): string {
  const firstLine = text.split("\n").map((l) => l.trim()).find(Boolean) ?? "note";
  return firstLine.slice(0, 80);
}

// ---- dry-run fixture -------------------------------------------------------

// Realistic fixture notes — used in --dry-run to verify the dedup logic without network calls.
const DRY_RUN_FIXTURE: FetchedNote[] = [
  {
    noteId: "c-dry-run-001",
    url: "https://substack.com/@muxin/note/c-dry-run-001",
    publishedAt: "2026-06-25T10:00:00.000Z",
    text: "AI is not going to replace workers. The humans deciding how to deploy it will. And they are making those decisions right now, mostly without asking the workers.",
    likes: 42,
    reposts: 8,
    replies: 5,
  },
  {
    noteId: "c-dry-run-002",
    url: "https://substack.com/@muxin/note/c-dry-run-002",
    publishedAt: "2026-06-24T15:00:00.000Z",
    text: "The hardest part about managing AI workflows is knowing when NOT to automate. That judgment is the new skill.",
    likes: 28,
    reposts: 3,
    replies: 2,
  },
  {
    // This one will be in the ledger → should be SKIPPED in dry-run
    noteId: "c-dry-run-already-spread",
    url: "https://substack.com/@muxin/note/c-dry-run-already-spread",
    publishedAt: "2026-06-23T09:00:00.000Z",
    text: "This note was already seen and should be skipped by the dedup ledger check.",
    likes: 15,
    reposts: 1,
    replies: 0,
  },
];

// ---- main ------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const limitIdx = args.indexOf("--limit");
  const fetchLimit = limitIdx >= 0 ? Math.max(1, parseInt(args[limitIdx + 1] ?? "20", 10) || 20) : 20;

  console.log(`\nnotes-daily${isDryRun ? " [DRY RUN — no network, no writes]" : ""}`);
  console.log("=".repeat(50));

  // 1. Load ledger — set of already-seen note IDs.
  const { spreadIds } = readLedger();
  console.log(`Ledger: ${spreadIds.size} note(s) already seen.`);

  // 2. Fetch notes (or use fixture in dry-run).
  let notes: FetchedNote[];
  if (isDryRun) {
    console.log("Using fixture notes (no network call in dry-run).");
    notes = [...DRY_RUN_FIXTURE];
    // Simulate the third fixture note already being in the ledger.
    spreadIds.add("c-dry-run-already-spread");
  } else {
    const handle = process.env.SUBSTACK_HANDLE;
    if (!handle) {
      console.error(
        "SUBSTACK_HANDLE not set. Add it to .env (your Substack @handle, e.g. humaninference)."
      );
      process.exit(1);
    }
    console.log(`Fetching last ${fetchLimit} notes for @${handle}...`);
    notes = await fetchSubstackNotes(handle, { limit: fetchLimit });
    console.log(`Fetched: ${notes.length} note(s).`);
  }

  // 3. Filter to NEW notes (not already in the ledger).
  const newNotes = notes
    .filter((n) => !spreadIds.has(n.noteId))
    .sort((a, b) => engScore(b) - engScore(a));
  console.log(`New (not yet seen): ${newNotes.length} note(s).`);

  if (newNotes.length === 0) {
    console.log("Nothing new — all fetched notes already in ledger.");
    return;
  }

  console.log(`\n${newNotes.length} new note(s):`);
  for (const n of newNotes) {
    const title = noteTitle(n.text);
    console.log(
      `  [eng:${engScore(n)} = ♥${n.likes} + 💬${n.replies}×3 + ↻${n.reposts}×2] "${title}"`
    );
    console.log(`    ${n.url}`);
  }

  if (isDryRun) {
    console.log("\nDry-run complete — no ledger entries written, no network calls.");
    return;
  }

  // 4. Mark each as seen so tomorrow's run doesn't re-flag it. No drafting happens here — run
  //    "Pull Substack Notes" in the review GUI locally to actually spread the good ones.
  for (const n of newNotes) {
    appendLedger({
      noteId: n.noteId,
      url: n.url,
      spreadAt: new Date().toISOString(),
      platforms: [],
    });
  }
  console.log(`\nLedger: marked ${newNotes.length} note(s) as seen.`);
  console.log(
    "Nothing drafted or published — run \"Pull Substack Notes\" in the review GUI " +
      "(npm run review) locally to draft the good ones with real per-platform Spin."
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
