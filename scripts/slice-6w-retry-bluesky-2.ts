import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readQueue, type QueueRow } from "../src/publish/queue.js";
import { appendPublishingStatus, publishingKey, readPublishingStatuses, PUBLISHING_STATUS_PATH } from "../src/review/publishing-status.js";
import { buildPostizInput } from "../src/review/studio-scheduling.js";
import { createPostizTransport, findPostizPost, reschedulePostizPost } from "../src/publish/postiz.js";
import { laDayKey, moveClaim } from "../src/publish/slots.js";

/**
 * SLICE-6W one-off: retry `bluesky-2` after its Postiz delivery failed at its planned time
 * (2026-09-11T20:31:00.000Z). `rescheduleRow` (src/review/reschedule.ts) refuses to move a row
 * whose last publishing state is not "planned" -- by design, since routinely rescheduling a failed
 * row would hide real delivery problems. This script is the deliberate, pinned exception: Postiz's
 * own reschedule call restarts the post's publish workflow regardless of its current state, which
 * is exactly a retry, not an ordinary move. Pinned to one slug/row/provider-object id; refuses if
 * any of them have drifted since this was written.
 *
 *   node --import tsx scripts/slice-6w-retry-bluesky-2.ts --write
 */

const SLUG = "2026-09-07-the-world-s-broken-what-do-we-do-human-inference";
const ROW_ID = "bluesky-2";
const PROVIDER_OBJECT_ID = "cmtxe0dww0004mn81r740iylk";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FOLDER = join(REPO_ROOT, "content", SLUG);
const STATUS_PATH = PUBLISHING_STATUS_PATH;
const MINUTES_OUT = 10;

async function main(): Promise<number> {
  const write = process.argv.includes("--write");

  const row = readQueue(FOLDER).rows.find((item): item is QueueRow => item.id === ROW_ID);
  if (!row) throw new Error(`${SLUG} has no row ${ROW_ID}`);
  // "published" here means Studio already dispatched this row to the provider (studio-scheduling.ts
  // setStatus call) -- it is not a delivery confirmation. reconcile.ts treats approve/published as
  // the same "this row is meant to go out" state; mirror that instead of requiring "approve" only.
  if (row.platform !== "bluesky" || !["approve", "published"].includes(row.status)) throw new Error(`row drifted: platform=${row.platform} status=${row.status}`);

  const status = readPublishingStatuses(STATUS_PATH)[publishingKey(SLUG, ROW_ID)];
  if (!status) throw new Error("no publishing record for this row");
  if (status.providerObjectId !== PROVIDER_OBJECT_ID) throw new Error(`providerObjectId drifted: ${status.providerObjectId}`);
  if (status.state !== "failed") throw new Error(`expected state "failed", found "${status.state}" -- this script is pinned to the known failure, not general-purpose retry`);
  if (!status.providerAccountId || !status.plannedFor) throw new Error("publishing record is missing providerAccountId or plannedFor");

  const now = new Date();
  const to = new Date(now.getTime() + MINUTES_OUT * 60_000).toISOString();
  console.log(`row       ${SLUG}/${ROW_ID}`);
  console.log(`from      ${status.plannedFor} (failed)`);
  console.log(`to        ${to}`);

  const transport = createPostizTransport();
  const current = await findPostizPost(transport, PROVIDER_OBJECT_ID, status.plannedFor, now);
  if (!current) throw new Error("Postiz no longer lists this post; nothing to retry");
  console.log(`postiz    id=${current.id} status=${current.status}`);
  if (current.status !== "failed") throw new Error(`Postiz reports ${current.status}, not failed; re-check before retrying`);

  if (!write) {
    console.log("\nDRY RUN -- nothing written. Re-run with --write to retry for real.");
    return 0;
  }

  const input = await buildPostizInput(FOLDER, row, status.providerAccountId, to, transport);
  const moved = await reschedulePostizPost(transport, { id: current.id, group: current.group }, input, to, now);
  console.log(`moved     Postiz now reports scheduledAt=${moved.scheduledAt}`);

  try {
    const previous = { platform: row.platform, day: laDayKey(new Date(status.plannedFor)), time: status.plannedFor, asset: row.asset, by: "postiz" as const };
    moveClaim(previous, { time: moved.scheduledAt!, day: laDayKey(new Date(moved.scheduledAt!)) });
  } catch (error) {
    console.log(`warning   slot ledger not updated: ${error instanceof Error ? error.message : String(error)}`);
  }

  appendPublishingStatus({
    ...status, state: "planned", at: new Date().toISOString(), plannedFor: moved.scheduledAt!,
    providerUpdatedAt: new Date().toISOString(), error: undefined, schemaVersion: undefined, eventId: undefined,
  }, STATUS_PATH);
  console.log("wrote     planned event to publishing-status.jsonl");
  return 0;
}

main().then((code) => { process.exitCode = code; }).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
