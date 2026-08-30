import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { repoRoot } from "../db/db.js";
import type { QueueRow } from "../publish/queue.js";
import { scheduleApproved, scheduleKind, type ScheduleKind } from "./studio-scheduling.js";

export type PublishingState = "scheduling" | "scheduled" | "private" | "blocked" | "uncertain" | "cleared";
export type PublishingResolution = "exists" | "not-created";
export type PublishingProvider = "typefully" | "postpeer" | "youtube" | "substack" | "manual";
export interface PublishingStatus {
  slug: string;
  rowId: string;
  provider: PublishingProvider;
  state: PublishingState;
  at: string;
  plannedFor?: string;
  ref?: string;
  error?: string;
}

export const PUBLISHING_STATUS_PATH = join(repoRoot, "data", "publishing-status.jsonl");
export function publishingKey(slug: string, rowId: string): string { return `${slug}/${rowId}`; }

function claimPath(slug: string, rowId: string, ledgerPath: string): string {
  const digest = createHash("sha256").update(publishingKey(slug, rowId)).digest("hex");
  return join(dirname(ledgerPath), ".publishing-claims", `${digest}.lock`);
}

function claimPublishingAttempt(slug: string, rowId: string, ledgerPath: string): () => void {
  const target = claimPath(slug, rowId, ledgerPath);
  mkdirSync(dirname(target), { recursive: true });
  let fd: number;
  try { fd = openSync(target, "wx", 0o600); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("another Studio process already claimed this publishing attempt; reconcile it before retrying");
    throw error;
  }
  try { writeFileSync(fd, JSON.stringify({ slug, rowId, claimedAt: new Date().toISOString(), pid: process.pid }) + "\n"); }
  finally { closeSync(fd); }
  return () => { try { unlinkSync(target); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; } };
}

function clearPublishingClaim(slug: string, rowId: string, ledgerPath: string): void {
  try { unlinkSync(claimPath(slug, rowId, ledgerPath)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
}

function publishingClaimIsActive(slug: string, rowId: string, ledgerPath: string): boolean {
  const target = claimPath(slug, rowId, ledgerPath);
  if (!existsSync(target)) return false;
  try {
    const claim = JSON.parse(readFileSync(target, "utf8")) as { pid?: unknown; claimedAt?: unknown };
    const claimedAt = typeof claim.claimedAt === "string" ? Date.parse(claim.claimedAt) : Number.NaN;
    if (Number.isInteger(claim.pid)) {
      try { process.kill(Number(claim.pid), 0); return true; }
      catch (error) { return (error as NodeJS.ErrnoException).code !== "ESRCH"; }
    }
    return Number.isNaN(claimedAt) || Date.now() - claimedAt <= 30 * 60_000;
  } catch { return true; }
}

export function providerForKind(kind: ScheduleKind): PublishingProvider {
  if (kind === "text" || kind === "card") return "typefully";
  if (kind === "tiktok") return "postpeer";
  if (kind === "video") return "youtube";
  if (kind === "substack") return "substack";
  return "manual";
}

export function appendPublishingStatus(status: PublishingStatus, path: string = PUBLISHING_STATUS_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path)) {
    const current = readFileSync(path, "utf8");
    if (current.length > 0 && !current.endsWith("\n")) appendFileSync(path, "\n", { encoding: "utf8", mode: 0o600 });
  }
  appendFileSync(path, JSON.stringify(status) + "\n", { encoding: "utf8", mode: 0o600 });
}

export function readPublishingStatuses(path: string = PUBLISHING_STATUS_PATH): Record<string, PublishingStatus> {
  if (!existsSync(path)) return {};
  const latest: Record<string, PublishingStatus> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const status = JSON.parse(line) as PublishingStatus;
      if (!status.slug || !status.rowId || !status.provider || !status.state || !status.at) continue;
      latest[publishingKey(status.slug, status.rowId)] = status;
    } catch { /* retain all complete earlier append-only events */ }
  }
  return latest;
}

export function publishingRetryBlock(slug: string, row: QueueRow, path: string = PUBLISHING_STATUS_PATH): string | null {
  if (row.status === "published" || row.status === "locked") return "this row was already scheduled or locked";
  const existing = readPublishingStatuses(path)[publishingKey(slug, row.id)];
  if (existing && ["scheduling", "scheduled", "private", "uncertain"].includes(existing.state)) {
    return `this row already has a ${existing.state} publishing attempt; reconcile it before retrying`;
  }
  if (row.status === "approve" && existing?.state !== "blocked" && existing?.state !== "cleared") return "this row is already approved; reconcile its provider state before retrying";
  return null;
}

/** Human reconciliation after checking the provider; neither resolution contacts a provider. */
export function resolvePublishingAttempt(
  slug: string,
  rowId: string,
  resolution: PublishingResolution,
  details: { ref?: string; plannedFor?: string; provider?: PublishingProvider } = {},
  path: string = PUBLISHING_STATUS_PATH,
): PublishingStatus {
  const hadClaim = existsSync(claimPath(slug, rowId, path));
  if (hadClaim) {
    if (publishingClaimIsActive(slug, rowId, path)) throw new Error("this provider call is still active in another Studio process");
    clearPublishingClaim(slug, rowId, path);
  }
  // Acquire the SAME row lock used by scheduling, then re-read. If scheduling finishes first,
  // its latest `scheduled` event wins and resolution is refused; if it is still running, the
  // active claim above/refused wx acquisition wins. There is no check-then-append gap.
  const releaseClaim = claimPublishingAttempt(slug, rowId, path);
  try {
    const existing = readPublishingStatuses(path)[publishingKey(slug, rowId)];
    if (!existing || (existing.state !== "uncertain" && existing.state !== "scheduling")) {
      throw new Error("this row has no uncertain publishing attempt to reconcile");
    }
    const provider = existing.provider ?? details.provider;
    if (!provider) throw new Error("the uncertain publishing provider is unknown");
    const status: PublishingStatus = resolution === "exists"
      ? {
          slug, rowId, provider, state: "scheduled", at: new Date().toISOString(),
          ...(details.ref?.trim() ? { ref: details.ref.trim() } : {}),
          ...(details.plannedFor?.trim() ? { plannedFor: details.plannedFor.trim() } : {}),
        }
      : {
          slug, rowId, provider, state: "cleared", at: new Date().toISOString(),
          error: "Muxin checked the provider and confirmed that nothing was created; retry is allowed",
        };
    appendPublishingStatus(status, path);
    return status;
  } finally {
    releaseClaim();
  }
}

function details(value: unknown): { plannedFor?: string; ref?: string } {
  if (!value || typeof value !== "object") return {};
  const item = value as Record<string, unknown>;
  const plannedFor = typeof item.when === "string" && item.when ? item.when : undefined;
  const rawRef = item.ref ?? item.draftId;
  const ref = typeof rawRef === "string" && rawRef ? rawRef : undefined;
  return { ...(plannedFor ? { plannedFor } : {}), ...(ref ? { ref } : {}) };
}

function acceptedState(value: unknown): PublishingState {
  return value && typeof value === "object" && (value as Record<string, unknown>).autoPublishes === false ? "private" : "scheduled";
}

/**
 * Persist intent before the provider call. Scheduled/uncertain attempts cannot be blindly retried:
 * the provider may already have accepted them even if the HTTP response was lost.
 */
export async function scheduleApprovedOnce(
  folder: string,
  slug: string,
  row: QueueRow,
  schedule: typeof scheduleApproved = scheduleApproved,
  path: string = PUBLISHING_STATUS_PATH,
): Promise<{ scheduled: unknown; scheduleError: string | null; publishing: PublishingStatus }> {
  const kind = scheduleKind(row);
  if (!kind) throw new Error("no publishing provider owns this row");
  const releaseClaim = claimPublishingAttempt(slug, row.id, path);
  try {
    // Re-check after the atomic claim: another process may have completed between the caller's
    // UI read and this process acquiring the lock.
    const blocked = publishingRetryBlock(slug, row, path);
    if (blocked) throw new Error(blocked);
    const provider = providerForKind(kind);
    appendPublishingStatus({ slug, rowId: row.id, provider, state: "scheduling", at: new Date().toISOString() }, path);
    const result = await schedule(folder, row);
    const status: PublishingStatus = result.scheduleError
      ? {
          slug, rowId: row.id, provider,
          state: result.scheduleError.startsWith("blocked by reuse guard") ? "blocked" : "uncertain",
          at: new Date().toISOString(), error: result.scheduleError,
        }
      : { slug, rowId: row.id, provider, state: acceptedState(result.scheduled), at: new Date().toISOString(), ...details(result.scheduled) };
    appendPublishingStatus(status, path);
    return { ...result, publishing: status };
  } finally {
    releaseClaim();
  }
}
