import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { migrateLegacyDataFile } from "../runtime/data-root.js";
import { withFileLock } from "../runtime/file-lock.js";

const LEGACY_CAPTURE_VERSION = "studio-capture-v1" as const;
export const CAPTURE_VERSION = "studio-capture-v2" as const;
export type CaptureRoom = "Content" | "Fiction" | "Outreach" | "Venture" | "Signals" | "Charles";

export interface CapturePromotionTarget {
  readonly room: CaptureRoom;
  readonly itemId: string;
}

export interface StudioCapture {
  readonly version: typeof CAPTURE_VERSION;
  readonly id: string;
  readonly room: CaptureRoom;
  readonly text: string;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly jobId: string | null;
  readonly promotedAt: string | null;
  readonly promotion: CapturePromotionTarget | null;
}

export const CAPTURES_PATH = migrateLegacyDataFile(["studio-captures.json"]);

function normalized(room: CaptureRoom, text: string): string {
  return `${room}\0${text.trim()}`;
}

export function captureId(room: CaptureRoom, text: string): string {
  return `capture-${createHash("sha256").update(normalized(room, text)).digest("hex").slice(0, 20)}`;
}

export function captureJobId(id: string): string { return `job-${id}`; }

function captureRoom(value: unknown): value is CaptureRoom {
  return typeof value === "string" && ["Content", "Fiction", "Outreach", "Venture", "Signals", "Charles"].includes(value);
}

function normalizedCapture(item: unknown): StudioCapture | null {
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  if (typeof row.id !== "string" || !captureRoom(row.room) || typeof row.text !== "string"
    || typeof row.createdAt !== "string" || (row.startedAt !== null && typeof row.startedAt !== "string")
    || (row.jobId !== null && typeof row.jobId !== "string")) return null;
  if (row.version === LEGACY_CAPTURE_VERSION) {
    return {
      version: CAPTURE_VERSION, id: row.id, room: row.room, text: row.text, createdAt: row.createdAt,
      startedAt: row.startedAt, jobId: row.jobId, promotedAt: null, promotion: null,
    };
  }
  if (row.version !== CAPTURE_VERSION || (row.promotedAt !== null && typeof row.promotedAt !== "string")) return null;
  const promotion = row.promotion;
  if (promotion !== null && (!promotion || typeof promotion !== "object"
    || !captureRoom((promotion as Record<string, unknown>).room)
    || typeof (promotion as Record<string, unknown>).itemId !== "string")) return null;
  if ((promotion === null) !== (row.promotedAt === null)) throw new Error("capture store contains an incomplete promotion state");
  if (promotion !== null && (row.jobId !== null || row.startedAt !== null)) throw new Error("capture store contains contradictory promotion and job-start states");
  return {
    version: CAPTURE_VERSION, id: row.id, room: row.room, text: row.text, createdAt: row.createdAt,
    startedAt: row.startedAt, jobId: row.jobId, promotedAt: row.promotedAt,
    promotion: promotion as CapturePromotionTarget | null,
  };
}

function read(path: string): StudioCapture[] {
  if (!existsSync(path)) return [];
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!Array.isArray(parsed)) throw new Error("capture store is not an array");
  return parsed.map(normalizedCapture).filter((item): item is StudioCapture => item !== null);
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
      version: CAPTURE_VERSION, id, room, text: value, createdAt: new Date().toISOString(),
      startedAt: null, jobId: null, promotedAt: null, promotion: null,
    };
    rows.push(capture); write(path, rows); return capture;
  });
}

/** Stamp the real advisor job only after it has been accepted by the shared queue. */
export function markCaptureStarted(id: string, jobId: string, path: string = CAPTURES_PATH): StudioCapture {
  if (!jobId.trim()) throw new Error("capture job id is required");
  return withFileLock(`${path}.lock`, () => {
    const rows = read(path);
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) throw new Error("no such capture");
    if (rows[index]!.promotion) throw new Error("capture is already promoted to a room item");
    if (rows[index]!.jobId) return rows[index]!;
    rows[index] = { ...rows[index]!, startedAt: new Date().toISOString(), jobId };
    write(path, rows);
    return rows[index]!;
  });
}

/** Stamp a durable room item only after its owning store accepted it; identical retries are no-ops. */
export function markCapturePromoted(
  id: string,
  target: CapturePromotionTarget,
  path: string = CAPTURES_PATH,
): StudioCapture {
  if (!captureRoom(target.room) || !target.itemId.trim()) throw new Error("capture promotion target is required");
  return withFileLock(`${path}.lock`, () => {
    const rows = read(path);
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) throw new Error("no such capture");
    const capture = rows[index]!;
    if (capture.room !== target.room) throw new Error("capture promotion room does not match its owning room");
    if (capture.jobId || capture.startedAt) throw new Error("capture is already started as a job");
    if (capture.promotion) {
      if (capture.promotion.room === target.room && capture.promotion.itemId === target.itemId) return capture;
      throw new Error("capture is already promoted to a different room item");
    }
    const promoted: StudioCapture = {
      ...capture,
      promotedAt: new Date().toISOString(),
      promotion: { room: target.room, itemId: target.itemId.trim() },
    };
    rows[index] = promoted;
    write(path, rows);
    return promoted;
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
      rows.push({
        version: CAPTURE_VERSION, id, room, text: value, createdAt: new Date().toISOString(),
        startedAt: null, jobId: null, promotedAt: null, promotion: null,
      });
      index = rows.length - 1;
      write(path, rows);
    }
    const capture = rows[index]!;
    if (capture.promotion) throw new Error("capture is already promoted to a room item");
    if (capture.jobId) return { capture, job: null, replayed: true };
    const job = enqueue(captureJobId(id), capture);
    if (job.id !== captureJobId(id)) throw new Error("capture enqueue did not honor its reserved job id");
    const started = { ...capture, startedAt: new Date().toISOString(), jobId: job.id };
    rows[index] = started;
    write(path, rows);
    return { capture: started, job, replayed: false };
  });
}
