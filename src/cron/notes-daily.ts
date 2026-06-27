// notes-daily.ts — Daily cloud routine: fetch new Substack Notes → UNSCHEDULED Typefully drafts.
//
//   npm run notes-daily               # live run (needs SUBSTACK_HANDLE + TYPEFULLY_API_KEY in .env)
//   npm run notes-daily -- --dry-run  # print plan only, no network calls, no file writes
//   npm run notes-daily -- --limit 40 # fetch further back (default 20)
//
// Cloud-safe: all state lives in data/notes-spread-ledger.jsonl (committed to git).
// The repo is cloned fresh each cloud run; on success, commit + push the updated ledger so the
// next run knows which notes were already spread. See docs/setup-cloud-routine.md.
//
// Flow: load ledger → fetch notes → filter new → score + pick top N → scaffold content folder
//       → write derivatives → pre-approve in review-queue.md → publish:typefully --no-schedule
//       → append ledger.
//
// Drafts are created UNSCHEDULED (publish:typefully --no-schedule omits publish_at), so NOTHING
// auto-posts. They sit in Typefully until Muxin manually schedules/publishes the good ones.

import "../util/env.js";
import { writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { repoRoot } from "../db/db.js";
import { readLedger, appendLedger, LedgerEntry } from "./ledger.js";
import { fetchSubstackNotes, FetchedNote } from "../atomize/fetch-notes.js";
import { scaffoldContentFolder } from "../atomize/new-content.js";

// ---- config ----------------------------------------------------------------

// Text platforms to spread notes to. Notes are short-form; x and bluesky are the natural fit.
// LinkedIn omitted by default (professional register mismatch for casual notes), but easy to add.
const SPREAD_PLATFORMS = ["x", "bluesky"] as const;
type Platform = (typeof SPREAD_PLATFORMS)[number];

// Character limits per platform (mirrors config/platforms.yaml max_chars).
const PLATFORM_LIMITS: Record<string, number> = { x: 280, bluesky: 300, linkedin: 3000 };

// Max notes to spread per run (keeps Typefully queue from flooding).
const MAX_PER_RUN = 3;

// ---- helpers ---------------------------------------------------------------

// Engagement score — mirrors the formula in new-notes.ts so selection is consistent.
function engScore(n: FetchedNote): number {
  return n.likes + n.replies * 3 + n.reposts * 2;
}

// Extract a short title from the note body (first non-empty line, max 80 chars).
function noteTitle(text: string): string {
  const firstLine = text.split("\n").map((l) => l.trim()).find(Boolean) ?? "note";
  return firstLine.slice(0, 80);
}

// Trim text to a platform char limit, breaking at a sentence boundary when possible.
function trimToLimit(text: string, limit: number): string {
  if (text.length <= limit) return text;
  // Try to break at a sentence boundary (". ") within the back 40% of the window.
  const cutoff = text.lastIndexOf(". ", limit - 3);
  if (cutoff > limit * 0.6) return text.slice(0, cutoff + 1);
  return text.slice(0, limit - 3) + "...";
}

// Write a single extraction-first derivative file. The body IS the note text — verbatim,
// possibly trimmed for the platform limit. No new claims; source_lines traces back to note.
function writeDerivative(folder: string, platform: Platform, noteText: string): void {
  const limit = PLATFORM_LIMITS[platform] ?? Infinity;
  const body = trimToLimit(noteText, limit);
  const lineCount = noteText.split("\n").length;
  const content = [
    "---",
    `platform: ${platform}`,
    "option: 1",
    `source_lines: [1, ${lineCount}]`,
    "cta: source",
    "scores: { native: 4, brand: 4, cta: true }",
    "---",
    "",
    body,
    "",
  ].join("\n");
  writeFileSync(join(folder, "derivatives", `${platform}-1.md`), content);
}

// Write review-queue.md with every platform row pre-approved.
// "Auto-approved" here means note text goes verbatim (extraction-first, no AI composition), so the
// review gate is Muxin scheduling/publishing the good UNSCHEDULED drafts in Typefully by hand —
// nothing auto-posts, so a pre-approved row only ever becomes a saved draft until he acts on it.
function writeReviewQueue(folder: string, title: string): void {
  const rows = SPREAD_PLATFORMS.map(
    (p) =>
      `| ${p}-1 | ${p} | text | derivatives/${p}-1.md | 4 | 4 | yes | approve | auto-spread (verbatim note text) |`
  ).join("\n");
  writeFileSync(
    join(folder, "review-queue.md"),
    [
      `# Review queue — ${title}`,
      "",
      "> Auto-approved by notes-daily (verbatim note text, extraction-first).",
      "> Drafts arrive UNSCHEDULED in Typefully — nothing auto-posts. Muxin schedules/publishes the good ones by hand.",
      "",
      "| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes |",
      "|----|----------|--------|-------|-------------|------------|-----|--------|-------|",
      rows,
      "",
    ].join("\n")
  );
}

// ---- dry-run fixture -------------------------------------------------------

// Realistic fixture notes — used in --dry-run to verify the pipeline logic without network calls.
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
    text: "This note was already spread and should be skipped by the dedup ledger check.",
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

  // 1. Load ledger — set of already-spread note IDs.
  const { spreadIds } = readLedger();
  console.log(`Ledger: ${spreadIds.size} note(s) already spread.`);

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
  const newNotes = notes.filter((n) => !spreadIds.has(n.noteId));
  console.log(`New (not yet spread): ${newNotes.length} note(s).`);

  if (newNotes.length === 0) {
    console.log("Nothing to do — all fetched notes already in ledger.");
    return;
  }

  // 4. Sort by engagement score descending, take top MAX_PER_RUN.
  const selected = newNotes.sort((a, b) => engScore(b) - engScore(a)).slice(0, MAX_PER_RUN);

  console.log(`\nSelected top ${selected.length} note(s) by engagement score:`);
  for (const n of selected) {
    console.log(
      `  [eng:${engScore(n)} = ♥${n.likes} + 💬${n.replies}×3 + ↻${n.reposts}×2]` +
        ` ${n.text.replace(/\s+/g, " ").slice(0, 100)}...`
    );
  }
  console.log(`  Platforms: ${SPREAD_PLATFORMS.join(", ")}`);

  // 5. Dry-run: print the plan and exit.
  if (isDryRun) {
    const draftCount = selected.length * SPREAD_PLATFORMS.length;
    console.log(
      `\nDry-run plan: would create ${selected.length} content folder(s) and ${draftCount} ` +
        `UNSCHEDULED Typefully draft(s) (no auto-post — they sit until Muxin schedules them):`
    );
    for (const n of selected) {
      const title = noteTitle(n.text);
      console.log(`\n  Note: "${title}"`);
      console.log(`  Origin: ${n.url}`);
      for (const p of SPREAD_PLATFORMS) {
        const body = trimToLimit(n.text, PLATFORM_LIMITS[p] ?? Infinity);
        console.log(`  ${p}: ${body.length}/${PLATFORM_LIMITS[p]} chars (unscheduled draft)`);
      }
    }
    console.log("\nDry-run complete — no files written, no Typefully drafts created, no network calls.");
    return;
  }

  // 6. Live run: scaffold, write derivatives, publish, update ledger.
  const spreadCount = { success: 0, skipped: 0 };
  for (const note of selected) {
    const title = noteTitle(note.text);
    console.log(`\nProcessing: "${title}"`);
    console.log(`  noteId: ${note.noteId}`);

    // a. Scaffold content folder (source.md + empty subfolders).
    let folder: string;
    try {
      folder = scaffoldContentFolder({
        title,
        origin: note.url,
        publishedAt: note.publishedAt,
        text: note.text,
        sourceKind: "substack-note",
      });
      console.log(`  scaffolded: ${relative(repoRoot, folder)}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.startsWith("already exists:")) {
        // Folder already exists (prior partial run or slug collision). Mark as spread to avoid
        // retrying indefinitely, then skip the publish step.
        console.log(`  folder already exists — marking as spread and skipping publish`);
        appendLedger({
          noteId: note.noteId,
          url: note.url,
          spreadAt: new Date().toISOString(),
          platforms: [],
          contentFolder: relative(repoRoot, msg.replace("already exists: ", "")),
        });
        spreadCount.skipped++;
        continue;
      }
      console.error(`  error scaffolding (${msg}) — skipping this note`);
      spreadCount.skipped++;
      continue;
    }

    // b. Write extraction-first derivative files (verbatim note text, trimmed to platform limit).
    for (const platform of SPREAD_PLATFORMS) {
      writeDerivative(folder, platform, note.text);
    }
    console.log(`  derivatives written: ${SPREAD_PLATFORMS.join(", ")}`);

    // c. Write review-queue.md with all rows pre-approved.
    writeReviewQueue(folder, title);
    console.log("  review-queue.md: all rows approve");

    // d. Create UNSCHEDULED Typefully drafts via the existing publish:typefully script. The
    //    --no-schedule flag omits publish_at, so drafts are SAVED but do NOT auto-post — they sit
    //    in Typefully until Muxin manually schedules/publishes the good ones. Nothing fires
    //    automatically. (Reuses the shared draft-creation path; no duplicated Typefully logic.)
    console.log("  calling publish:typefully --no-schedule (unscheduled drafts)...");
    const result = spawnSync(
      "npm",
      ["run", "publish:typefully", "--", folder, "--no-schedule"],
      { encoding: "utf8", cwd: repoRoot, env: { ...process.env } }
    );
    if (result.status !== 0) {
      const errOut = (result.stderr ?? "").trim();
      console.error(`  publish:typefully failed (exit ${result.status ?? "?"}):\n${errOut}`);
      // Still append to ledger so we don't retry this note; the content folder exists.
      appendLedger({
        noteId: note.noteId,
        url: note.url,
        spreadAt: new Date().toISOString(),
        platforms: [],
        contentFolder: relative(repoRoot, folder),
      });
      spreadCount.skipped++;
      continue;
    }
    // Print each output line with indentation.
    const lines = (result.stdout ?? "").trim().split("\n").filter(Boolean);
    for (const line of lines) console.log(`  ↳ ${line}`);

    // e. Append to the committed ledger so the next cloud run skips this note.
    const entry: LedgerEntry = {
      noteId: note.noteId,
      url: note.url,
      spreadAt: new Date().toISOString(),
      platforms: [...SPREAD_PLATFORMS],
      contentFolder: relative(repoRoot, folder),
    };
    appendLedger(entry);
    console.log(`  ledger: appended ${note.noteId}`);
    spreadCount.success++;
  }

  console.log(
    `\nnotes-daily done. Spread: ${spreadCount.success} note(s). ` +
      `Skipped: ${spreadCount.skipped}. ` +
      `Commit and push data/notes-spread-ledger.jsonl to persist for the next run.`
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
