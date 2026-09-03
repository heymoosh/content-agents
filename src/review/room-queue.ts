import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { migrateLegacyDataFile } from "../runtime/data-root.js";
import { withFileLock } from "../runtime/file-lock.js";
import type { CaptureRoom, StudioCapture } from "./captures.js";

/**
 * Room-owned queue projections over the capture event log (decision 11, slice 1.5a).
 *
 * `studio-captures.json` (captures.ts) is the immutable front door: one content-idempotent event
 * per room + trimmed text, holding only room/text/timestamps/job. Everything a room learns about a
 * capture afterwards (which venture, which fiction idea, which Charles group, where it sits in the
 * room's lifecycle) lives HERE, keyed by the capture id, so the raw event never needs a schema bump
 * and `captureId` derivation stays stable for crash-retry convergence.
 *
 * Later slices extend a room's payload interface below (Venture candidates + answer version,
 * Charles per-output status) without touching the shared item shape or the count semantics.
 */

export const ROOM_QUEUE_VERSION = "room-queue-v1" as const;

export const QUEUE_STATES = [
  "pending", "awaiting-answer", "in-progress", "partially-complete", "complete", "rejected", "archived",
] as const;
export type QueueState = (typeof QUEUE_STATES)[number];

/**
 * Count semantics. A collapsed queue's summary counts ONLY items that still need Muxin's attention:
 * `pending`, `awaiting-answer`, `in-progress`, `partially-complete`. The terminal states `complete`,
 * `rejected`, `archived` never count, so a room's number is bounded by open work, not by history.
 */
export const PENDING_STATES = ["pending", "awaiting-answer", "in-progress", "partially-complete"] as const satisfies readonly QueueState[];
export const TERMINAL_STATES = ["complete", "rejected", "archived"] as const satisfies readonly QueueState[];
export type PendingState = (typeof PENDING_STATES)[number];
export type TerminalState = (typeof TERMINAL_STATES)[number];

export function isPendingState(state: QueueState): state is PendingState {
  return (PENDING_STATES as readonly QueueState[]).includes(state);
}

export function pendingCount(items: ReadonlyArray<Pick<RoomQueueItem, "state">>): number {
  return items.reduce((count, item) => count + (isPendingState(item.state) ? 1 : 0), 0);
}

// Room payloads. Each room owns its own interface; a slice that builds a room's queue adds fields
// to that interface only. A consumer switching on `kind` must keep a default branch.
export interface ContentQueuePayload { readonly kind: "content"; readonly jobId: string | null }
/** Slice 1.5c: `ideaId` links the projection to the room's `ideas.json` record. `null` = not yet promoted. */
export interface FictionQueuePayload { readonly kind: "fiction"; readonly series: string | null; readonly ideaId: string | null }
/** Slice 1.5b adds the awaiting-venture candidate snapshot + answer version (compare-and-swap). */
export interface VentureQueuePayload { readonly kind: "venture"; readonly slug: string | null }
/** Slice 1.5d adds the selected output types + per-output status under one durable group id. */
export interface CharlesQueuePayload { readonly kind: "charles"; readonly groupId: string | null }
/** Rooms with no projection of their own yet (Outreach, Signals). */
export interface GenericQueuePayload { readonly kind: "generic" }
export type RoomQueuePayload = ContentQueuePayload | FictionQueuePayload | VentureQueuePayload | CharlesQueuePayload | GenericQueuePayload;

export interface RoomQueueItem<P extends RoomQueuePayload = RoomQueuePayload> {
  readonly version: typeof ROOM_QUEUE_VERSION;
  readonly captureId: string;
  readonly room: CaptureRoom;
  readonly state: QueueState;
  /** Copied from the capture event so the queue orders by when Muxin captured it. */
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly payload: P;
}

export const ROOM_QUEUE_PATH = migrateLegacyDataFile(["room-queue.json"]);

const CAPTURE_ROOMS: readonly string[] = ["Content", "Fiction", "Outreach", "Venture", "Signals", "Charles"];

/** A row is trusted only if every field a reader dereferences is present and well-typed. */
function isQueueItem(item: unknown): item is RoomQueueItem {
  if (!item || typeof item !== "object") return false;
  const row = item as Record<string, unknown>;
  const payload = row.payload as Record<string, unknown> | null | undefined;
  return row.version === ROOM_QUEUE_VERSION && typeof row.captureId === "string"
    && typeof row.room === "string" && CAPTURE_ROOMS.includes(row.room)
    && typeof row.state === "string" && (QUEUE_STATES as readonly string[]).includes(row.state)
    && typeof row.createdAt === "string" && typeof row.updatedAt === "string"
    && payload !== null && payload !== undefined && typeof payload === "object" && typeof payload.kind === "string";
}

function read(path: string): RoomQueueItem[] {
  if (!existsSync(path)) return [];
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!Array.isArray(parsed)) throw new Error("room queue store is not an array");
  return parsed.filter(isQueueItem);
}

function write(path: string, rows: RoomQueueItem[]): void {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(rows, null, 2) + "\n", { mode: 0o600 });
  renameSync(temp, path);
}

export function listQueueItems(path: string = ROOM_QUEUE_PATH): RoomQueueItem[] { return read(path); }

export function readQueueItem(captureId: string, path: string = ROOM_QUEUE_PATH): RoomQueueItem | null {
  return read(path).find((item) => item.captureId === captureId) ?? null;
}

export function roomQueueItems(room: CaptureRoom, path: string = ROOM_QUEUE_PATH): RoomQueueItem[] {
  return read(path).filter((item) => item.room === room);
}

/** A capture event's lifecycle before any room learns more: reserved onto a job means in progress. */
export function initialQueueState(capture: Pick<StudioCapture, "jobId">): QueueState {
  return capture.jobId ? "in-progress" : "pending";
}

/** The room-shaped payload for an event nothing has linked yet (legacy rows, un-Started captures). */
export function unlinkedPayload(room: CaptureRoom, capture: Pick<StudioCapture, "jobId">): RoomQueuePayload {
  switch (room) {
    case "Content": return { kind: "content", jobId: capture.jobId };
    case "Fiction": return { kind: "fiction", series: null, ideaId: null };
    case "Venture": return { kind: "venture", slug: null };
    case "Charles": return { kind: "charles", groupId: null };
    default: return { kind: "generic" };
  }
}

/**
 * Idempotent: project one capture event into its room queue. An existing projection wins
 * untouched (its lifecycle is the room's, never re-derived from the raw event).
 */
export function projectCapture<P extends RoomQueuePayload>(
  capture: StudioCapture, payload: P, path: string = ROOM_QUEUE_PATH, state: QueueState = initialQueueState(capture),
): RoomQueueItem<P> {
  if (payload.kind !== unlinkedPayload(capture.room, capture).kind) throw new Error(`${payload.kind} payload does not belong to the ${capture.room} room`);
  return withFileLock(`${path}.lock`, () => {
    const rows = read(path);
    const existing = rows.find((item) => item.captureId === capture.id);
    if (existing) return existing as RoomQueueItem<P>;
    const item: RoomQueueItem<P> = {
      version: ROOM_QUEUE_VERSION, captureId: capture.id, room: capture.room, state,
      createdAt: capture.createdAt, updatedAt: new Date().toISOString(), payload,
    };
    rows.push(item); write(path, rows); return item;
  });
}

/**
 * Move a projection through its lifecycle and/or enrich its payload. Any state is reachable from
 * any other (a room may resurrect an archived item); `updatedAt` always advances. A no-op patch
 * leaves the row byte-identical so read-side reconcilers can call this freely.
 */
export function updateQueueItem<P extends RoomQueuePayload>(
  captureId: string, patch: { state?: QueueState; payload?: Partial<P> }, path: string = ROOM_QUEUE_PATH,
): RoomQueueItem<P> {
  if (patch.state !== undefined && !(QUEUE_STATES as readonly string[]).includes(patch.state)) throw new Error(`unknown queue state: ${String(patch.state)}`);
  return withFileLock(`${path}.lock`, () => {
    const rows = read(path);
    const index = rows.findIndex((item) => item.captureId === captureId);
    if (index < 0) throw new Error("no such queue item");
    const current = rows[index]! as RoomQueueItem<P>;
    const payload = patch.payload ? { ...current.payload, ...patch.payload } as P : current.payload;
    if (patch.payload?.kind !== undefined && patch.payload.kind !== current.payload.kind) throw new Error("queue payload kind is fixed per room");
    const state = patch.state ?? current.state;
    if (state === current.state && JSON.stringify(payload) === JSON.stringify(current.payload)) return current;
    const next: RoomQueueItem<P> = { ...current, state, payload, updatedAt: new Date().toISOString() };
    rows[index] = next; write(path, rows); return next;
  });
}

/**
 * Migration, explicit and idempotent: every capture event without a projection gets one. Legacy
 * `studio-captures.json` rows (pre-projection) are read as-is and never rewritten; their lifecycle
 * starts from `initialQueueState` and their payload from `payloadFor` (default: unlinked). Safe to
 * run on every read.
 */
export function projectCaptureEvents(
  captures: readonly StudioCapture[],
  path: string = ROOM_QUEUE_PATH,
  payloadFor: (capture: StudioCapture) => RoomQueuePayload = (capture) => unlinkedPayload(capture.room, capture),
): { created: number; items: RoomQueueItem[] } {
  return withFileLock(`${path}.lock`, () => {
    const rows = read(path);
    const known = new Set(rows.map((item) => item.captureId));
    let created = 0;
    for (const capture of captures) {
      if (known.has(capture.id)) continue;
      const payload = payloadFor(capture);
      if (payload.kind !== unlinkedPayload(capture.room, capture).kind) throw new Error(`${payload.kind} payload does not belong to the ${capture.room} room`);
      rows.push({
        version: ROOM_QUEUE_VERSION, captureId: capture.id, room: capture.room, state: initialQueueState(capture),
        createdAt: capture.createdAt, updatedAt: new Date().toISOString(), payload,
      });
      known.add(capture.id); created += 1;
    }
    if (created) write(path, rows);
    return { created, items: rows };
  });
}
