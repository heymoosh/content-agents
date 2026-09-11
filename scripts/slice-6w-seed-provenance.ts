import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { readQueue, type QueueRow } from "../src/publish/queue.js";
import { PUBLISHING_STATUS_PATH } from "../src/review/publishing-status.js";
import {
  approvalDispatchDisposition,
  approvalFingerprint,
  approvalSchedulingBlock,
  commitReviewStatus,
  journalPathForLedger,
  recordNewQueueRows,
} from "../src/review/approval-provenance.js";

/**
 * SLICE-6W one-off: give `bluesky-2` the approval-dispatch provenance production never wrote for
 * it, so Studio's Schedule action stops refusing it. Pinned to one slug and one row id — it takes
 * no target arguments and cannot be pointed at anything else.
 *
 *   node --import tsx scripts/slice-6w-seed-provenance.ts                        # dry run
 *   node --import tsx scripts/slice-6w-seed-provenance.ts --write --complete-approval
 *
 * A creation event ALONE leaves the row refused: the journal would say "created, never approved"
 * while review-queue.md says `approve`, which `approvalDispatchDisposition` reports as `blocked`,
 * not `fresh`. `--write` on its own is therefore only useful ahead of a Studio approval click;
 * `--complete-approval` records the transition that actually makes the row schedulable, and a run
 * left stranded after `--write` can be resumed by re-running with both flags.
 *
 * Exit code: 0 when the row ends `fresh`, or from an advisory dry run; 1 when a run finishes with
 * the row still refused. Any safety refusal throws instead, writing nothing. No provider call.
 */

const SLUG = "2026-09-07-the-world-s-broken-what-do-we-do-human-inference";
const ROW_ID = "bluesky-2";
// The full row identity the packet pins, not just its id — a row matching on id alone could be a
// different derivative on a different platform by the time this runs.
const EXPECTED = { platform: "bluesky", format: "text", asset: "derivatives/bluesky-2.md", status: "approve" } as const;
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FOLDER = join(REPO_ROOT, "content", SLUG);
const LEDGER = PUBLISHING_STATUS_PATH;
const JOURNAL = journalPathForLedger(LEDGER);

function readRow(): QueueRow | undefined {
  return readQueue(FOLDER).rows.find((item) => item.id === ROW_ID);
}

/** The pinned row, or a refusal naming exactly what stopped matching. */
function targetRow(): QueueRow {
  const row = readRow();
  if (!row) throw new Error(`${SLUG} has no row ${ROW_ID}`);
  for (const [field, expected] of Object.entries(EXPECTED)) {
    const actual = row[field as keyof typeof EXPECTED];
    if (actual !== expected) throw new Error(`${ROW_ID}.${field} reads "${actual || "(empty)"}", expected "${expected}" — the queue moved under this script, stop and re-read the packet`);
  }
  return row;
}

/** Every journal event already recorded for this one row. */
function existingEvents(journalPath: string): { kind: string; fingerprint: string }[] {
  if (!existsSync(journalPath)) return [];
  const events: { kind: string; fingerprint: string }[] = [];
  for (const line of readFileSync(journalPath, "utf8").split("\n").filter(Boolean)) {
    const event = JSON.parse(line) as { slug?: string; rowId?: string; kind: string; fingerprint: string };
    if (event.slug === SLUG && event.rowId === ROW_ID) events.push(event);
  }
  return events;
}

/**
 * The write callback `commitReviewStatus` runs between its intent and commit events. The row is
 * already `approve` on disk, so there is nothing to write — but returning a bare `true` would let
 * the approval commit against a derivative edited since the creation event, certifying bytes
 * nobody approved. Re-read and fail closed on any drift instead.
 */
function unchangedRow(expectedFingerprint: string): () => boolean {
  return () => {
    const row = readRow();
    if (!row) return false;
    if (Object.entries(EXPECTED).some(([field, expected]) => row[field as keyof typeof EXPECTED] !== expected)) return false;
    return approvalFingerprint(FOLDER, row) === expectedFingerprint;
  };
}

/**
 * Apply the same calls against a throwaway copy of the journal, so a dry run reports the
 * disposition each option really produces instead of predicting it. The temp ledger path keeps
 * commitReviewStatus's row claim out of the real data root too.
 */
function simulate(row: QueueRow, fingerprint: string, completeApproval: boolean): string | null {
  const scratch = mkdtempSync(join(tmpdir(), "slice-6w-seed-"));
  try {
    const ledger = join(scratch, "ledger.jsonl");
    const journal = journalPathForLedger(ledger);
    if (existsSync(JOURNAL)) copyFileSync(JOURNAL, journal);
    recordNewQueueRows(FOLDER, [row], journal);
    if (completeApproval) commitReviewStatus(FOLDER, SLUG, ROW_ID, "approve", unchangedRow(fingerprint), ledger, journal);
    return approvalSchedulingBlock(FOLDER, SLUG, row, ledger, journal);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/** Print where the row actually ended up. Nonzero unless Schedule will now accept it. */
function report(): number {
  const row = readRow();
  if (!row) throw new Error(`${ROW_ID} disappeared from the queue mid-run`);
  const disposition = approvalDispatchDisposition(FOLDER, SLUG, row, LEDGER, JOURNAL);
  console.log(`result   ${JSON.stringify(disposition)}`);
  console.log(`Schedule ${approvalSchedulingBlock(FOLDER, SLUG, row, LEDGER, JOURNAL) ?? "is unblocked for this row"}`);
  return disposition.kind === "fresh" ? 0 : 1;
}

function main(): number {
  const write = process.argv.includes("--write");
  const completeApproval = process.argv.includes("--complete-approval");
  const row = targetRow();
  const fingerprint = approvalFingerprint(FOLDER, row);
  // No readable derivative means no honest evidence to record. Stop before touching the journal.
  if (!fingerprint) throw new Error(`${ROW_ID}'s derivative ${row.asset} is unreadable; nothing can be recorded for it`);

  console.log(`row      ${SLUG}/${ROW_ID} (${row.platform} ${row.format}, status ${row.status})`);
  console.log(`asset    ${row.asset}`);
  console.log(`journal  ${JOURNAL}`);
  console.log(`digest   ${fingerprint}`);

  const already = existingEvents(JOURNAL);
  console.log(`current  ${JSON.stringify(approvalDispatchDisposition(FOLDER, SLUG, row, LEDGER, JOURNAL))}`);
  // A journal holding exactly one creation event is a `--write` run that stopped half-done. That
  // is resumable: finish it rather than reporting it as already seeded and leaving it refused.
  const resumable = already.length === 1 && already[0]!.kind === "created";

  if (already.length && !(resumable && write && completeApproval)) {
    console.log(`\nAlready seeded: ${already.length} event(s) — ${already.map((event) => event.kind).join(" -> ")}`);
    if (resumable) console.log("Re-run with --write --complete-approval to finish the approval transition.");
    return report();
  }

  if (!write) {
    console.log("\nDRY RUN — nothing written. Simulated against a scratch copy of the journal:");
    console.log(`  --write                      => Schedule ${simulate(row, fingerprint, false) ?? "is unblocked"}`);
    console.log(`  --write --complete-approval  => Schedule ${simulate(row, fingerprint, true) ?? "is unblocked"}`);
    if (completeApproval) console.log("\n--complete-approval does nothing without --write; this was a dry run.");
    console.log("\nRe-run with --write --complete-approval to apply.");
    return 0;
  }

  if (resumable) {
    // Resuming means trusting an event written by an earlier process. Only do that if the bytes
    // it fingerprinted are still the bytes on disk.
    if (already[0]!.fingerprint !== fingerprint) throw new Error(`${row.asset} changed since its creation event was recorded; reconcile the journal by hand rather than approving different bytes`);
    console.log("\nresuming created event from an earlier run");
  } else {
    recordNewQueueRows(FOLDER, [row], JOURNAL);
    console.log("\nwrote    created");
  }

  if (completeApproval) {
    if (!commitReviewStatus(FOLDER, SLUG, ROW_ID, "approve", unchangedRow(fingerprint), LEDGER, JOURNAL)) {
      throw new Error("the approval transition refused to commit because the row or its derivative changed mid-run; inspect the journal before retrying");
    }
    console.log("wrote    approval_intent -> approval_committed");
  }
  return report();
}

process.exitCode = main();
