import type { StudioCapture } from "./captures.js";
import {
  ROOM_QUEUE_PATH, mutateQueueItem, projectCapture, readQueueItem,
  type RoomQueueItem, type VentureCandidate, type VentureQueuePayload,
} from "./room-queue.js";
import type { VentureResolution } from "./venture-resolver.js";

/**
 * The Venture room's projection and answer protocol (decision 11, slice 1.5b, build-order item 1).
 *
 * Studio Start resolves the capture to one venture when it can (venture-resolver.ts). When it
 * cannot, the question itself is durable: the item is projected at `awaiting-answer` carrying the
 * candidate snapshot and `answerVersion: 0`, so a reload re-reads the same open question instead
 * of losing it. Muxin's pick arrives through `answerVentureCapture`, a compare-and-swap keyed on
 * `answerVersion`: a stale version (a second tab answering after the first) is refused with 409 and
 * writes nothing; the exact same answer replayed (a retry) is a no-op 200.
 */

export function answerVersionOf(item: Pick<RoomQueueItem<VentureQueuePayload>, "payload">): number {
  return item.payload.answerVersion ?? 0;
}

/**
 * Idempotent: an existing projection wins untouched (a replayed Start never re-asks a question
 * Muxin already answered). A `none` resolution over a non-empty list still asks, over every venture,
 * rather than guessing; over an empty list it refuses, there is nothing to ask.
 */
export function projectVentureCapture(
  capture: StudioCapture, resolution: VentureResolution, ventures: readonly VentureCandidate[], path: string = ROOM_QUEUE_PATH,
): RoomQueueItem<VentureQueuePayload> {
  if (capture.room !== "Venture") throw new Error("only a Venture capture projects into the Venture queue");
  if (resolution.kind === "resolved") {
    return projectCapture(capture, { kind: "venture", slug: resolution.slug, candidates: [], answerVersion: 0 }, path, "pending");
  }
  const candidates = resolution.kind === "ambiguous" ? resolution.candidates : ventures;
  if (candidates.length === 0) throw new Error("no venture exists yet; create one in the Venture room first");
  return projectCapture(capture, { kind: "venture", slug: null, candidates: [...candidates], answerVersion: 0 }, path, "awaiting-answer");
}

export interface VentureAnswerInput { captureId: string; slug: string; expectedVersion: number }

export type VentureAnswerResult =
  | { readonly status: 200; readonly item: RoomQueueItem<VentureQueuePayload>; readonly replayed: boolean }
  | { readonly status: 400 | 404; readonly error: string }
  | { readonly status: 409; readonly error: string; readonly item: RoomQueueItem<VentureQueuePayload> };

/**
 * Compare-and-swap answer. Order matters: the slug is checked against the LIVE venture list first,
 * so a venture deleted mid-select fails as a plain 400 with nothing written; then the replay case
 * (same slug already set) returns 200 regardless of version; only then is the version compared
 * under the store lock, so two answers cannot both pass the check.
 */
export function answerVentureCapture(
  input: VentureAnswerInput, ventures: readonly string[], path: string = ROOM_QUEUE_PATH,
): VentureAnswerResult {
  const slug = input.slug.trim();
  if (!slug) return { status: 400, error: "venture slug is required" };
  if (!ventures.includes(slug)) return { status: 400, error: `no such venture: ${slug}` };
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 0) return { status: 400, error: "expectedVersion must be a non-negative integer" };
  const existing = readQueueItem(input.captureId, path);
  if (!existing) return { status: 404, error: "no such capture in the Venture queue" };
  if (existing.payload.kind !== "venture") return { status: 400, error: "this capture is not in the Venture queue" };
  try {
    const item = mutateQueueItem<VentureQueuePayload>(input.captureId, (current) => {
      if (current.payload.slug === slug) throw new AnswerReplay(current);
      if (answerVersionOf(current) !== input.expectedVersion) throw new AnswerConflict(current);
      const state = current.state === "awaiting-answer" ? "pending" : current.state;
      return { state, payload: { slug, candidates: [], answerVersion: answerVersionOf(current) + 1 } };
    }, path);
    return { status: 200, item, replayed: false };
  } catch (error) {
    if (error instanceof AnswerReplay) return { status: 200, item: error.item, replayed: true };
    if (error instanceof AnswerConflict) return { status: 409, error: "this capture was answered elsewhere; reload and answer again", item: error.item };
    throw error;
  }
}

// Decided under the store lock, surfaced as a result: neither writes anything.
class AnswerReplay extends Error { constructor(readonly item: RoomQueueItem<VentureQueuePayload>) { super("replay"); } }
class AnswerConflict extends Error { constructor(readonly item: RoomQueueItem<VentureQueuePayload>) { super("conflict"); } }
