import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface FileLockOptions { timeoutMs?: number; staleMs?: number; pollMs?: number; now?: () => number }

function pause(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function processAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** Synchronous cross-process lock based on atomic exclusive creation. */
export function withFileLock<T>(lockPath: string, fn: () => T, options: FileLockOptions = {}): T {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const staleMs = options.staleMs ?? 5 * 60_000;
  const pollMs = options.pollMs ?? 20;
  const now = options.now ?? Date.now;
  const deadline = now() + timeoutMs;
  mkdirSync(dirname(lockPath), { recursive: true, mode: 0o700 });
  while (true) {
    let fd: number | undefined;
    try {
      fd = openSync(lockPath, "wx", 0o600);
      writeFileSync(fd, JSON.stringify({ pid: process.pid, createdAt: now() }) + "\n");
      closeSync(fd); fd = undefined;
      try { return fn(); } finally { rmSync(lockPath, { force: true }); }
    } catch (error) {
      if (fd !== undefined) closeSync(fd);
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;
      let stale = false;
      try {
        const metadata = JSON.parse(readFileSync(lockPath, "utf8")) as { pid?: number; createdAt?: number };
        const age = now() - (metadata.createdAt ?? statSync(lockPath).mtimeMs);
        stale = age > staleMs && !processAlive(metadata.pid ?? 0);
      } catch { stale = existsSync(lockPath) && now() - statSync(lockPath).mtimeMs > staleMs; }
      if (stale) { rmSync(lockPath, { force: true }); continue; }
      if (now() >= deadline) throw new Error(`timed out waiting for lock: ${lockPath}`);
      pause(pollMs);
    }
  }
}

export interface FileLease { release(): void }
export function tryAcquireFileLease(lockPath: string, options: Pick<FileLockOptions, "staleMs" | "now"> = {}): FileLease | null {
  const staleMs = options.staleMs ?? 5 * 60_000;
  const now = options.now ?? Date.now;
  mkdirSync(dirname(lockPath), { recursive: true, mode: 0o700 });
  const token = `${process.pid}-${Math.random().toString(36).slice(2)}`;
  const create = (): FileLease | null => {
    try {
      const fd = openSync(lockPath, "wx", 0o600);
      writeFileSync(fd, JSON.stringify({ pid: process.pid, createdAt: now(), token }) + "\n"); closeSync(fd);
      return { release: () => {
        try { const current = JSON.parse(readFileSync(lockPath, "utf8")) as { token?: string }; if (current.token === token) rmSync(lockPath, { force: true }); } catch { /* already released */ }
      } };
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; return null; }
  };
  const acquired = create(); if (acquired) return acquired;
  try {
    const owner = JSON.parse(readFileSync(lockPath, "utf8")) as { pid?: number; createdAt?: number };
    if (now() - (owner.createdAt ?? statSync(lockPath).mtimeMs) > staleMs && !processAlive(owner.pid ?? 0)) {
      rmSync(lockPath, { force: true }); return create();
    }
  } catch { /* a concurrent owner is changing it; fail closed */ }
  return null;
}
