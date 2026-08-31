import { existsSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { dataPath } from "./data-root.js";
import { processAlive, tryAcquireFileLease, withFileLock, type FileLease } from "./file-lock.js";
import { mkdirSync, writeFileSync, renameSync } from "node:fs";

export interface DurableJobRecord { id: string; status: string; kind: string; label: string; [key: string]: unknown }
function storePath(): string { return process.env.CONTENT_AGENTS_TEST_JOB_STORE ?? dataPath("jobs", "review-jobs.json"); }
function readUnlocked(path: string): DurableJobRecord[] {
  if (!existsSync(path)) return [];
  try { const value = JSON.parse(readFileSync(path, "utf8")); return Array.isArray(value) ? value : []; } catch { return []; }
}
function writeUnlocked(path: string, records: DurableJobRecord[]): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const tmp = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  writeFileSync(tmp, JSON.stringify(records, null, 2) + "\n", { mode: 0o600 }); renameSync(tmp, path);
}

export function readDurableJobs(): DurableJobRecord[] {
  const path = storePath();
  return withFileLock(`${path}.lock`, () => {
    return readUnlocked(path);
  });
}

export function writeDurableJobs(records: DurableJobRecord[]): void {
  const path = storePath();
  withFileLock(`${path}.lock`, () => {
    writeUnlocked(path, records);
  });
}

export function upsertDurableJob(record: DurableJobRecord): void {
  const path = storePath(); withFileLock(`${path}.lock`, () => {
    const records = readUnlocked(path); const index = records.findIndex((current) => current.id === record.id);
    if (index < 0) records.push(record); else records[index] = record; writeUnlocked(path, records);
  });
}
export function removeDurableJobs(ids: readonly string[]): void {
  if (!ids.length) return; const drop = new Set(ids); const path = storePath();
  withFileLock(`${path}.lock`, () => writeUnlocked(path, readUnlocked(path).filter((record) => !drop.has(record.id))));
}
export function acquireJobExecutionLease(): FileLease | null {
  const path = storePath(); return tryAcquireFileLease(`${path}.execute.lock`, { staleMs: 30 * 60_000 });
}

export function recoverAbandonedJobs(records: DurableJobRecord[], now = Date.now(), alive = processAlive): DurableJobRecord[] {
  return records.map((record) => (record.status === "queued" || record.status === "running") && !alive(Number(record.ownerPid ?? 0)) ? {
    ...record, status: "failed", finishedAt: now, retryable: false,
    error: "The prior process exited before this non-idempotent job finished. It was not resumed automatically.",
  } : record);
}
