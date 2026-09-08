import { readQueue } from "./queue.js";
import { scheduleApprovedOnce } from "../review/publishing-status.js";
import { scheduleKind, type DispatchMode, type ScheduleKind, type SchedulerDeps } from "../review/studio-scheduling.js";

/** Hermetic embedding seam; the terminal CLI never supplies these fields. */
export interface UnifiedPublishOptions {
  noSchedule?: boolean;
  schedule?: Parameters<typeof scheduleApprovedOnce>[3];
  publishingStatusPath?: string;
  selectionDeps?: Pick<SchedulerDeps, "fetchPostizRegistry" | "postizEnv">;
  dispatchMode?: DispatchMode;
}

/** Shared publish CLI path: approval gate + capability/account selection + durable event ledger. */
export async function publishApprovedViaConfiguredProviders(
  folder: string,
  kind: ScheduleKind,
  opts: UnifiedPublishOptions = {},
): Promise<number> {
  if (opts.noSchedule && kind !== "text") {
    throw new Error("unscheduled drafts are only supported for Typefully text rows");
  }
  const rows = readQueue(folder).rows.filter((row) => row.status === "approve" && scheduleKind(row) === kind);
  let completed = 0;
  for (const row of rows) {
    const result = await scheduleApprovedOnce(
      folder,
      folder.split("/").filter(Boolean).at(-1) ?? "content",
      row,
      opts.schedule,
      opts.publishingStatusPath,
      opts.selectionDeps,
      opts.dispatchMode ?? (opts.noSchedule ? "unscheduled-draft" : "scheduled"),
    );
    if (result.scheduleError) throw new Error(`${row.id}: ${result.scheduleError}`);
    completed++;
  }
  return completed;
}
