import { createHash } from "node:crypto";
import { listIdeas, type CleanupProposal, type IdeaRecord } from "../fiction/idea-inbox.js";
import { listCaptures, type StudioCapture } from "./captures.js";
import {
  ROOM_QUEUE_PATH, mutateQueueItem, pendingCount, projectCapture, projectCaptureEvents, readQueueItem, roomQueueItems, updateQueueItem,
  type FictionCanonGate, type FictionQueuePayload, type QueueState, type RoomQueueItem,
} from "./room-queue.js";

/**
 * The Fiction room's projection (decision 11, slice 1.5a reference implementation; 1.5c adds the
 * durable idea link and the confirm-before-canon gate).
 *
 * Fiction's lifecycle is owned by `ideas.json` (idea-inbox.ts): the queue never decides anything
 * about an idea, it mirrors the idea's status into the shared `QueueState` so the collapsed queue
 * count stays bounded and every room reads one shape. The link is `payload.ideaId`, written at
 * Studio Start; on sync an unlinked item is linked by the idea's own `captureId` (the explicit,
 * durable link Start records on the idea), and only a legacy idea with no `captureId` is matched
 * by exact raw text.
 *
 * The one thing the queue does own is the canon gate: an idea whose cleanup proposal targets a
 * canon-like doc (bible, outline, characters/) reaches canon ONLY through `confirmCanonGate`, and
 * the open question is a durable `awaiting-answer` row, so a reload re-enters the same
 * confirmation instead of losing it.
 */

export function fictionQueueState(
  idea: Pick<IdeaRecord, "status" | "classification" | "proposal"> | null, gate?: Pick<FictionCanonGate, "state"> | null,
): QueueState {
  if (!idea) return "archived";
  if (idea.status === "approved") return "complete";
  if (idea.status === "rejected") return "rejected";
  // An open canon confirmation is Muxin's to answer, whatever else the idea is waiting on.
  if (gate?.state === "open") return "awaiting-answer";
  // needs-review: an unclassified idea with no cleanup proposal is waiting on Muxin's clarification.
  return idea.classification === "clarify" && !idea.proposal ? "awaiting-answer" : "pending";
}

export function projectFictionCapture(capture: StudioCapture, idea: IdeaRecord, path: string = ROOM_QUEUE_PATH): RoomQueueItem<FictionQueuePayload> {
  if (capture.room !== "Fiction") throw new Error("only a Fiction capture projects into the Fiction queue");
  const item = projectCapture(capture, { kind: "fiction", series: idea.series, ideaId: idea.id }, path, fictionQueueState(idea));
  const state = fictionQueueState(idea, liveGate(item.payload, idea));
  if (item.payload.ideaId === idea.id && item.state === state) return item;
  return updateQueueItem<FictionQueuePayload>(capture.id, { state, payload: { series: idea.series, ideaId: idea.id } }, path);
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
 * unlinked items to an idea (by the idea's `captureId`, else a unique raw-text match among ideas
 * that have none), then mirror each linked idea's status. Idempotent; an item whose state and link
 * already match is not rewritten.
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
      linked = findIdeaForCapture(item.captureId, textOf.get(item.captureId), ideasBySeries.values());
      // Unlinked, unmatched or ambiguous: nothing has (unambiguously) promoted it, so it stays pending.
      if (!linked) { items.push(item); continue; }
    }
    items.push(updateQueueItem<FictionQueuePayload>(item.captureId, {
      state: fictionQueueState(linked, liveGate(item.payload, linked)),
      ...(linked ? { payload: { series: linked.series, ideaId: linked.id } } : {}),
    }, path));
  }
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { items, pending: pendingCount(items) };
}

/**
 * The explicit link wins: an idea recording this capture id is the one Start created for it, and
 * the raw text (which a capture id is derived from, series-blind) is not consulted. The raw-text
 * fallback exists only for ideas written before `captureId` existed, and since a capture id is
 * series-blind the same raw text in two series is a real ambiguity: link only a unique match,
 * never the first series by iteration order.
 */
function findIdeaForCapture(captureId: string, text: string | undefined, ideasBySeries: Iterable<IdeaRecord[]>): IdeaRecord | null {
  const explicit: IdeaRecord[] = [];
  const legacy: IdeaRecord[] = [];
  for (const ideas of ideasBySeries) {
    explicit.push(...ideas.filter((idea) => idea.captureId === captureId));
    if (text !== undefined) legacy.push(...ideas.filter((idea) => idea.captureId === undefined && idea.rawText === text));
  }
  if (explicit.length === 1) return explicit[0]!;
  if (explicit.length > 1) return null;
  return legacy.length === 1 ? legacy[0]! : null;
}

// ---------------------------------------------------------------------------
// Confirm-before-canon gate.

/** What a confirmation is over: the exact proposal text and destination, so a re-cleanup is a new gate. */
export function canonGateDigest(proposal: Pick<CleanupProposal, "classification" | "cleanedText" | "createdAt" | "provenance">): string {
  return createHash("sha256")
    .update(proposal.classification).update("\0")
    .update(proposal.provenance.targetPath ?? "").update("\0")
    .update(Buffer.from(proposal.cleanedText, "utf8")).update("\0")
    .update(proposal.createdAt)
    .digest("hex").slice(0, 24);
}

export function canonGateId(captureId: string, digest: string): string {
  return `gate-${createHash("sha256").update(captureId).update("\0").update(digest).digest("hex").slice(0, 20)}`;
}

function canonTarget(proposal: CleanupProposal): string {
  if (proposal.classification === "world" || proposal.classification === "imagery") return proposal.provenance.targetPath ?? "bible.md";
  if (proposal.classification === "plot") return proposal.provenance.targetPath ?? "outline.md";
  if (proposal.classification === "character" && proposal.provenance.targetPath) return proposal.provenance.targetPath;
  throw new Error("choose a target document before asking to confirm a canon write");
}

/** The stored gate only if it is open AND still describes the idea's current proposal; else it is stale and inert. */
function liveGate(payload: FictionQueuePayload, idea: Pick<IdeaRecord, "proposal"> | null): FictionCanonGate | null {
  const gate = payload.gate;
  if (!gate || gate.state !== "open" || !idea?.proposal) return null;
  return canonGateDigest(idea.proposal) === gate.digest ? gate : null;
}

/** What the desk needs to re-open a Fiction item exactly where it was, after a reload. */
export interface FictionResume {
  readonly kind: "fiction";
  readonly captureId: string;
  readonly series: string | null;
  readonly ideaId: string | null;
  readonly gate: Pick<FictionCanonGate, "gateId" | "state" | "target" | "digest"> | null;
}

export function fictionResume(item: RoomQueueItem<FictionQueuePayload>): FictionResume {
  const gate = item.payload.gate;
  return {
    kind: "fiction", captureId: item.captureId, series: item.payload.series, ideaId: item.payload.ideaId,
    gate: gate ? { gateId: gate.gateId, state: gate.state, target: gate.target, digest: gate.digest } : null,
  };
}

export type FictionGateResult =
  | { readonly status: 200; readonly item: RoomQueueItem<FictionQueuePayload>; readonly gate: FictionCanonGate; readonly resume: FictionResume; readonly replayed: boolean }
  | { readonly status: 400 | 404; readonly error: string }
  | { readonly status: 409; readonly error: string; readonly item: RoomQueueItem<FictionQueuePayload> };

function ok(item: RoomQueueItem<FictionQueuePayload>, replayed: boolean): FictionGateResult {
  return { status: 200, item, gate: item.payload.gate!, resume: fictionResume(item), replayed };
}

function fictionItem(captureId: string, path: string): { item: RoomQueueItem<FictionQueuePayload> } | { error: FictionGateResult } {
  const existing = readQueueItem(captureId, path);
  if (!existing) return { error: { status: 404, error: "no such capture in the Fiction queue" } };
  if (existing.payload.kind !== "fiction") return { error: { status: 400, error: "this capture is not in the Fiction queue" } };
  return { item: existing as RoomQueueItem<FictionQueuePayload> };
}

/**
 * Ask Muxin to confirm the idea's pending cleanup proposal into its canon doc. Idempotent: the same
 * proposal re-asked returns the same open gate (or the confirmed one, nothing re-promotes); a
 * cancelled gate over the same proposal re-opens; a gate over an older proposal is replaced.
 * Chapter ideas never come here, they go to the draft queue, not canon.
 */
export function openCanonGate(captureId: string, idea: IdeaRecord, path: string = ROOM_QUEUE_PATH): FictionGateResult {
  const found = fictionItem(captureId, path);
  if ("error" in found) return found.error;
  if (found.item.payload.ideaId !== idea.id) return { status: 400, error: "this capture is not linked to that idea" };
  if (idea.status !== "needs-review") return { status: 400, error: "idea is no longer awaiting review" };
  if (!idea.proposal) return { status: 400, error: "no reviewable cleanup proposal" };
  if (idea.proposal.classification === "chapter") return { status: 400, error: "chapter ideas go to the draft queue, not canon" };
  let target: string;
  try { target = canonTarget(idea.proposal); } catch (error) { return { status: 400, error: error instanceof Error ? error.message : String(error) }; }
  const digest = canonGateDigest(idea.proposal);
  const gateId = canonGateId(captureId, digest);
  let replayed = false;
  const item = mutateQueueItem<FictionQueuePayload>(captureId, (current) => {
    const gate = current.payload.gate;
    if (gate?.gateId === gateId && gate.state !== "cancelled") { replayed = true; return {}; }
    const opened: FictionCanonGate = { gateId, state: "open", target, digest, openedAt: new Date().toISOString(), resolvedAt: null };
    return { state: "awaiting-answer", payload: { gate: opened } };
  }, path);
  return ok(item, replayed);
}

export interface FictionGateInput { captureId: string; gateId: string }

/**
 * Muxin's explicit yes. `promote` performs the canon write (the caller wires `approveIdea` with its
 * branch authorization) and returns the promoted idea; it runs under the queue lock, so a throw
 * leaves the gate open and the row unwritten for a retry. A confirmed gate replayed is a no-op 200
 * (`promote` is not called again); a cancelled or superseded gate is a 409, never a promotion.
 */
export function confirmCanonGate(
  input: FictionGateInput, promote: (gate: FictionCanonGate) => IdeaRecord, path: string = ROOM_QUEUE_PATH,
): FictionGateResult {
  const found = fictionItem(input.captureId, path);
  if ("error" in found) return found.error;
  if (!input.gateId.trim()) return { status: 400, error: "gateId is required" };
  let replayed = false;
  try {
    const item = mutateQueueItem<FictionQueuePayload>(input.captureId, (current) => {
      const gate = current.payload.gate;
      if (!gate || gate.gateId !== input.gateId) throw new GateConflict(current, "this confirmation is no longer open; reload and ask again");
      if (gate.state === "confirmed") { replayed = true; return {}; }
      if (gate.state === "cancelled") throw new GateConflict(current, "this confirmation was cancelled; ask again to reopen it");
      const promoted = promote(gate);
      const confirmed: FictionCanonGate = { ...gate, state: "confirmed", resolvedAt: new Date().toISOString() };
      return { state: fictionQueueState(promoted, confirmed), payload: { series: promoted.series, ideaId: promoted.id, gate: confirmed } };
    }, path);
    return ok(item, replayed);
  } catch (error) {
    if (error instanceof GateConflict) return { status: 409, error: error.message, item: error.item };
    throw error;
  }
}

/** Muxin's no, or a walk-away: the proposal stays pending review, nothing is written to canon. Idempotent. */
export function cancelCanonGate(input: FictionGateInput, path: string = ROOM_QUEUE_PATH): FictionGateResult {
  const found = fictionItem(input.captureId, path);
  if ("error" in found) return found.error;
  if (!input.gateId.trim()) return { status: 400, error: "gateId is required" };
  let replayed = false;
  try {
    const item = mutateQueueItem<FictionQueuePayload>(input.captureId, (current) => {
      const gate = current.payload.gate;
      if (!gate || gate.gateId !== input.gateId) throw new GateConflict(current, "this confirmation is no longer open; reload");
      if (gate.state === "cancelled") { replayed = true; return {}; }
      if (gate.state === "confirmed") throw new GateConflict(current, "this idea is already in canon; a confirmation cannot be cancelled");
      // An open gate implies a needs-review idea with a proposal (openCanonGate's precondition),
      // which mirrors as `pending` once the question is withdrawn.
      return { state: "pending", payload: { gate: { ...gate, state: "cancelled", resolvedAt: new Date().toISOString() } } };
    }, path);
    return ok(item, replayed);
  } catch (error) {
    if (error instanceof GateConflict) return { status: 409, error: error.message, item: error.item };
    throw error;
  }
}

// Decided under the store lock, surfaced as a result: writes nothing.
class GateConflict extends Error { constructor(readonly item: RoomQueueItem<FictionQueuePayload>, message: string) { super(message); } }
