import { listIdeas, type IdeaRecord } from "../fiction/idea-inbox.js";
import { listCaptures, type StudioCapture } from "./captures.js";
import {
  ROOM_QUEUE_PATH, pendingCount, projectCapture, projectCaptureEvents, roomQueueItems, updateQueueItem,
  type FictionQueuePayload, type QueueState, type RoomQueueItem,
} from "./room-queue.js";

/**
 * The Fiction room's projection (decision 11, slice 1.5a reference implementation).
 *
 * Fiction's lifecycle is owned by `ideas.json` (idea-inbox.ts): the queue never decides anything
 * about an idea, it mirrors the idea's status into the shared `QueueState` so the collapsed queue
 * count stays bounded and every room reads one shape. The link is `payload.ideaId`, written at
 * Studio Start; a legacy capture with no link is matched by exact raw text on sync.
 */

export function fictionQueueState(idea: Pick<IdeaRecord, "status" | "classification" | "proposal"> | null): QueueState {
  if (!idea) return "archived";
  if (idea.status === "approved") return "complete";
  if (idea.status === "rejected") return "rejected";
  // needs-review: an unclassified idea with no cleanup proposal is waiting on Muxin's clarification.
  return idea.classification === "clarify" && !idea.proposal ? "awaiting-answer" : "pending";
}

export function projectFictionCapture(capture: StudioCapture, idea: IdeaRecord, path: string = ROOM_QUEUE_PATH): RoomQueueItem<FictionQueuePayload> {
  if (capture.room !== "Fiction") throw new Error("only a Fiction capture projects into the Fiction queue");
  const item = projectCapture(capture, { kind: "fiction", series: idea.series, ideaId: idea.id }, path, fictionQueueState(idea));
  if (item.payload.ideaId === idea.id && item.state === fictionQueueState(idea)) return item;
  return updateQueueItem<FictionQueuePayload>(capture.id, { state: fictionQueueState(idea), payload: { series: idea.series, ideaId: idea.id } }, path);
}

export interface FictionQueueSyncOptions {
  /** Series slugs to look for idea links in (normally `listFictionSeries()` slugs). */
  series: readonly string[];
  captures?: readonly StudioCapture[];
  path?: string;
  /** Idea-store root; defaults to the store's own (`CONTENT_AGENTS_HOME`). */
  ideasRoot?: string;
}

/**
 * Read-side reconcile: project any Fiction capture event not yet in the queue (legacy rows), link
 * unlinked items to an idea by exact raw text, then mirror each linked idea's status. Idempotent;
 * an item whose state and link already match is not rewritten.
 */
export function syncFictionQueue(options: FictionQueueSyncOptions): { items: RoomQueueItem<FictionQueuePayload>[]; pending: number } {
  const path = options.path ?? ROOM_QUEUE_PATH;
  const captures = (options.captures ?? listCaptures()).filter((capture) => capture.room === "Fiction");
  projectCaptureEvents(captures, path);
  const ideasBySeries = new Map(options.series.map((slug) => [slug, listIdeas(slug, options.ideasRoot)] as const));
  const textOf = new Map(captures.map((capture) => [capture.id, capture.text] as const));
  const items: RoomQueueItem<FictionQueuePayload>[] = [];
  for (const item of roomQueueItems("Fiction", path) as RoomQueueItem<FictionQueuePayload>[]) {
    let linked: IdeaRecord | null = null;
    if (item.payload.ideaId && item.payload.series) {
      linked = ideasBySeries.get(item.payload.series)?.find((idea) => idea.id === item.payload.ideaId) ?? null;
    } else {
      // A capture id is series-blind (room + text), so the same raw text in two series is a real
      // ambiguity: link only a unique match, never the first series by iteration order.
      const text = textOf.get(item.captureId);
      const matches: IdeaRecord[] = [];
      if (text !== undefined) for (const ideas of ideasBySeries.values()) matches.push(...ideas.filter((idea) => idea.rawText === text));
      linked = matches.length === 1 ? matches[0]! : null;
      // Unlinked, unmatched or ambiguous: nothing has (unambiguously) promoted it, so it stays pending.
      if (!linked) { items.push(item); continue; }
    }
    items.push(updateQueueItem<FictionQueuePayload>(item.captureId, {
      state: fictionQueueState(linked),
      ...(linked ? { payload: { series: linked.series, ideaId: linked.id } } : {}),
    }, path));
  }
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { items, pending: pendingCount(items) };
}
