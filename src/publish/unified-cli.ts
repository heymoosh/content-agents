import { readQueue } from "./queue.js";
import { scheduleApprovedOnce } from "../review/publishing-status.js";
import { scheduleKind, type ScheduleKind } from "../review/studio-scheduling.js";

/** Shared publish CLI path: approval gate + capability/account selection + durable event ledger. */
export async function publishApprovedViaConfiguredProviders(folder: string, kind: ScheduleKind): Promise<number> {
  const rows = readQueue(folder).rows.filter((row) => row.status === "approve" && scheduleKind(row) === kind);
  let completed = 0;
  for (const row of rows) {
    const result = await scheduleApprovedOnce(folder, folder.split("/").filter(Boolean).at(-1) ?? "content", row);
    if (result.scheduleError) throw new Error(`${row.id}: ${result.scheduleError}`);
    completed++;
  }
  return completed;
}
