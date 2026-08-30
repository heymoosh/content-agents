import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { migrateLegacyDataFile } from "../runtime/data-root.js";
import { withFileLock } from "../runtime/file-lock.js";

export const CAPTURE_VERSION = "studio-capture-v1" as const;
export type CaptureRoom = "Content" | "Fiction" | "Outreach" | "Venture" | "Signals" | "Charles";

export interface StudioCapture {
  readonly version: typeof CAPTURE_VERSION;
  readonly id: string;
  readonly room: CaptureRoom;
  readonly text: string;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly jobId: string | null;
}

export const CAPTURES_PATH = migrateLegacyDataFile(["studio-captures.json"]);

function normalized(room: CaptureRoom, text: string): string {
  return `${room}\0${text.trim()}`;
}

export function captureId(room: CaptureRoom, text: string): string {
  return `capture-${createHash("sha256").update(normalized(room, text)).digest("hex").slice(0, 20)}`;
}

export function captureJobId(id: string): string { return `job-${id}`; }

function read(path: string): StudioCapture[] {
  if (!existsSync(path)) return [];
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!Array.isArray(parsed)) throw new Error("capture store is not an array");
  return parsed.filter((item): item is StudioCapture => Boolean(item && typeof item === "object"
    && (item as StudioCapture).version === CAPTURE_VERSION && typeof (item as StudioCapture).id === "string"));
}

function write(path: string, rows: StudioCapture[]): void {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(rows, null, 2) + "\n", { mode: 0o600 });
  renameSync(temp, path);
}

export function listCaptures(path: string = CAPTURES_PATH): StudioCapture[] { return read(path); }

/** Repository-owned and idempotent: the same room + exact trimmed input is one inbox record. */
export function saveCapture(room: CaptureRoom, text: string, path: string = CAPTURES_PATH): StudioCapture {
  const value = text.trim();
  if (!value) throw new Error("capture text is required");
  return withFileLock(`${path}.lock`, () => {
    const rows = read(path);
    const id = captureId(room, value);
    const existing = rows.find((row) => row.id === id);
    if (existing) return existing;
    const capture: StudioCapture = {
      version: CAPTURE_VERSION, id, room, text: value, createdAt: new Date().toISOString(), startedAt: null, jobId: null,
    };
    rows.push(capture); write(path, rows); return capture;
  });
}

/** Stamp the real advisor job only after it has been accepted by the shared queue. */
export function markCaptureStarted(id: string, jobId: string, path: string = CAPTURES_PATH): StudioCapture {
  return withFileLock(`${path}.lock`, () => {
    const rows = read(path);
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) throw new Error("no such capture");
    if (rows[index]!.jobId) return rows[index]!;
    rows[index] = { ...rows[index]!, startedAt: new Date().toISOString(), jobId };
    write(path, rows);
    return rows[index]!;
  });
}

/**
 * Serialize capture reservation, durable enqueue, and binding. The deterministic job id makes a
 * retry after a crash between enqueue and binding converge on the already-persisted queue row.
 */
export function startCapture<T extends { id: string }>(
  room: CaptureRoom,
  text: string,
  enqueue: (reservedJobId: string, capture: StudioCapture) => T,
  path: string = CAPTURES_PATH,
): { capture: StudioCapture; job: T | null; replayed: boolean } {
  const value = text.trim();
  if (!value) throw new Error("capture text is required");
  return withFileLock(`${path}.lock`, () => {
    const rows = read(path);
    const id = captureId(room, value);
    let index = rows.findIndex((row) => row.id === id);
    if (index < 0) {
      rows.push({ version: CAPTURE_VERSION, id, room, text: value, createdAt: new Date().toISOString(), startedAt: null, jobId: null });
      index = rows.length - 1;
      write(path, rows);
    }
    const capture = rows[index]!;
    if (capture.jobId) return { capture, job: null, replayed: true };
    const job = enqueue(captureJobId(id), capture);
    if (job.id !== captureJobId(id)) throw new Error("capture enqueue did not honor its reserved job id");
    const started = { ...capture, startedAt: new Date().toISOString(), jobId: job.id };
    rows[index] = started;
    write(path, rows);
    return { capture: started, job, replayed: false };
  });
}
