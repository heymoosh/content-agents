import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { migrateLegacyDataFile } from "../runtime/data-root.js";
import { tryAcquireFileLease } from "../runtime/file-lock.js";
import { readQueue, type QueueRow } from "../publish/queue.js";
import { postizRateLimitRetryAt } from "../publish/postiz.js";
import { CONTENT } from "./rows.js";
import { PUBLISHING_STATUS_PATH, publishingKey, readPublishingStatuses, scheduleApprovedOnce } from "./publishing-status.js";
import { scheduleApproved, scheduleKind } from "./studio-scheduling.js";

/**
 * Background drain for approved rows that Postiz turned away with a 429.
 *
 * Muxin approves a week of content in one sitting; Postiz allows 90 creates per hour per instance.
 * A 429 is recorded as a retry-eligible `failed` ledger event whose message carries the resume time.
 * This loop, running inside the Studio server, waits for that time and then re-dispatches the waiting
 * rows one by one, stopping again at the next 429. Nothing here bypasses the approval gate: only rows
 * Muxin already set to `approve`, and only ones whose last provider attempt was a rate limit, qualify.
 * It runs only while Studio is open.
 */
export const PUBLISH_DRAIN_HEALTH_PATH = migrateLegacyDataFile(["publish-drain-health.json"]);

export interface PublishDrainHealth {
  state: "idle" | "running" | "ok" | "waiting" | "failed";
  waitingRows: number;
  resumeAt?: string;
  lastStartedAt?: string;
  lastCompletedAt?: string;
  drained?: number;
  error?: string;
}

export interface WaitingRow { folder: string; slug: string; row: QueueRow; retryAt: string }

export interface PublishDrainDeps {
  ledgerPath?: string;
  healthPath?: string;
  contentRoot?: string;
  now?: () => Date;
  schedule?: typeof scheduleApproved;
  selectionDeps?: Parameters<typeof scheduleApprovedOnce>[5];
  listWaiting?: (deps: PublishDrainDeps) => WaitingRow[];
}

let health: PublishDrainHealth = { state: "idle", waitingRows: 0 };
let active: Promise<PublishDrainHealth> | null = null;
export function publishDrainHealth(): PublishDrainHealth { return { ...health }; }

function persistHealth(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(health, null, 2) + "\n", { mode: 0o600 });
}

/** Approved rows whose latest ledger event is a Postiz rate limit, oldest resume time first. */
export function listWaitingRows(deps: PublishDrainDeps = {}): WaitingRow[] {
  const root = deps.contentRoot ?? CONTENT;
  const statuses = readPublishingStatuses(deps.ledgerPath ?? PUBLISHING_STATUS_PATH);
  const waiting: WaitingRow[] = [];
  let slugs: string[] = [];
  try { slugs = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return []; }
  for (const slug of slugs) {
    const folder = join(root, slug);
    if (!existsSync(join(folder, "review-queue.md"))) continue;
    let rows: QueueRow[];
    try { rows = readQueue(folder).rows; } catch { continue; }
    for (const row of rows) {
      if (row.status !== "approve" || !scheduleKind(row)) continue;
      const latest = statuses[publishingKey(slug, row.id)];
      // Only Postiz rate limits qualify: the resume-time message shape is Postiz's, and the
      // drainer must never re-dispatch a failure another provider recorded.
      if (!latest || latest.state !== "failed" || latest.provider !== "postiz") continue;
      const retryAt = postizRateLimitRetryAt(latest.error);
      if (retryAt) waiting.push({ folder, slug, row, retryAt });
    }
  }
  return waiting.sort((a, b) => a.retryAt.localeCompare(b.retryAt));
}

/** One bounded pass. Concurrent ticks share the same promise; a file lease keeps it single-instance. */
export function runPublishDrainOnce(deps: PublishDrainDeps = {}): Promise<PublishDrainHealth> {
  if (active) return active;
  const now = deps.now ?? (() => new Date());
  const healthPath = deps.healthPath ?? PUBLISH_DRAIN_HEALTH_PATH;
  const lease = tryAcquireFileLease(`${healthPath}.drain.lock`, { staleMs: 30 * 60_000 });
  if (!lease) {
    if (existsSync(healthPath)) {
      try { return Promise.resolve(JSON.parse(readFileSync(healthPath, "utf8")) as PublishDrainHealth); }
      catch { /* the owner may be replacing health */ }
    }
    return Promise.resolve({ state: "running", waitingRows: health.waitingRows });
  }
  // Assign through a local so a pass that finishes synchronously (every row still waiting, no
  // await reached) cannot clear `active` before the assignment lands and pin a stale promise.
  const run = (async (): Promise<PublishDrainHealth> => {
    const startedAt = now().toISOString();
    health = { ...health, state: "running", lastStartedAt: startedAt };
    persistHealth(healthPath);
    try {
      const waiting = (deps.listWaiting ?? listWaitingRows)(deps);
      let drained = 0;
      let resumeAt: string | undefined;
      let remaining = waiting.length;
      for (const item of waiting) {
        if (item.retryAt > now().toISOString()) { resumeAt = item.retryAt; break; }
        const result = await scheduleApprovedOnce(item.folder, item.slug, item.row, deps.schedule ?? scheduleApproved, deps.ledgerPath ?? PUBLISHING_STATUS_PATH, deps.selectionDeps);
        const nextRetry = postizRateLimitRetryAt(result.scheduleError);
        if (nextRetry) { resumeAt = nextRetry; break; }
        remaining -= 1;
        if (!result.scheduleError) drained += 1;
      }
      health = {
        state: remaining > 0 ? "waiting" : "ok", waitingRows: remaining, lastStartedAt: startedAt,
        lastCompletedAt: now().toISOString(), drained, ...(remaining > 0 && resumeAt ? { resumeAt } : {}),
      };
    } catch (error) {
      health = { ...health, state: "failed", lastCompletedAt: now().toISOString(), error: error instanceof Error ? error.message : String(error) };
    } finally {
      persistHealth(healthPath);
      lease.release();
    }
    return publishDrainHealth();
  })();
  active = run;
  void run.finally(() => { if (active === run) active = null; });
  return run;
}

/** Immediate startup pass plus an unref'd bounded interval for the long-lived review server. */
export function startPublishDrainLoop(intervalMs = 5 * 60_000): { stop(): void } {
  void runPublishDrainOnce();
  const timer = setInterval(() => { void runPublishDrainOnce(); }, Math.max(60_000, intervalMs));
  timer.unref();
  return { stop: () => clearInterval(timer) };
}

async function main(): Promise<void> {
  const result = await runPublishDrainOnce();
  console.log(JSON.stringify(result));
  if (result.state === "failed") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
}
