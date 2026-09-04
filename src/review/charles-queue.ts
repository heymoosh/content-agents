import { createHash } from "node:crypto";
import { listCharlesPosts, type CharlesPost, type CharlesRow } from "./charles.js";
import { listCaptures, type StudioCapture } from "./captures.js";
import type { Engine } from "./engines.js";
import {
  CHARLES_OUTPUT_TYPES, ROOM_QUEUE_PATH, mutateQueueItem, pendingCount, projectCapture, projectCaptureEvents, readQueueItem, roomQueueItems,
  type CharlesGroupOutput, type CharlesOutputState, type CharlesOutputType, type CharlesQueuePayload, type QueueState, type RoomQueueItem,
} from "./room-queue.js";

/**
 * The Charles room's group model (decision 11, slice 1.5d, build-order item 5).
 *
 * One capture fans out to up to three text outputs (one-liner, essay, reply) as ONE durable group.
 * The selection is persisted BEFORE anything drafts: every chosen output starts `pending`, so a
 * crash or a failed draft mid-way leaves an inspectable half-set, and a re-run drafts only the
 * outputs still `pending` (idempotent per group + output type; a drafted output is never redrafted).
 * Each output remains its own charles/review-queue.md row + draft file (charles-jobs.ts); Muxin's
 * per-row decision there is mirrored into the output's status on read (`syncCharlesQueue`), and
 * the group's queue state is rolled up from its outputs (`charlesGroupState`).
 *
 * Nothing here composes prose: drafting is the injected `draft` (enqueueCharlesDraft), unchanged.
 */

export function charlesGroupId(captureId: string): string {
  return `group-${createHash("sha256").update(captureId).digest("hex").slice(0, 20)}`;
}

const TERMINAL_OUTPUT_STATES: readonly CharlesOutputState[] = ["approved", "rejected"];

function isTerminalOutput(output: Pick<CharlesGroupOutput, "status">): boolean {
  return TERMINAL_OUTPUT_STATES.includes(output.status);
}

/**
 * Rollup: `complete` only once EVERY output is terminal (never while one is pending, drafting, or
 * drafted); `pending` while the outputs all sit at the same non-terminal step (none drafted yet, or
 * all drafted and awaiting Muxin); `partially-complete` whenever they disagree (some drafted or
 * decided, some still undrafted, reserved, or undecided). An item with no selection yet reads
 * `pending`. Only `complete` stops counting (room-queue.ts `pendingCount`).
 */
export function charlesGroupState(outputs: ReadonlyArray<Pick<CharlesGroupOutput, "status">>): QueueState {
  if (!outputs.length) return "pending";
  if (outputs.every(isTerminalOutput)) return "complete";
  const steps = new Set(outputs.map((output) => (isTerminalOutput(output) ? "done" : output.status)));
  return steps.size > 1 ? "partially-complete" : "pending";
}

export function isCharlesOutputType(value: unknown): value is CharlesOutputType {
  return typeof value === "string" && (CHARLES_OUTPUT_TYPES as readonly string[]).includes(value);
}

/** Muxin's review-queue.md status cell, as an output status. `revise` keeps the draft open. */
export function charlesOutputStatusFromReview(status: string): CharlesOutputState {
  if (status === "approve") return "approved";
  if (status === "discard") return "rejected";
  return "drafted";
}

function charlesItem(captureId: string, path: string): RoomQueueItem<CharlesQueuePayload> {
  const existing = readQueueItem(captureId, path);
  if (!existing) throw new Error("no such capture in the Charles queue");
  if (existing.payload.kind !== "charles") throw new Error("this capture is not in the Charles queue");
  return existing as RoomQueueItem<CharlesQueuePayload>;
}

function pendingOutput(type: CharlesOutputType, ordinal: number, now: string): CharlesGroupOutput {
  return { type, ordinal, status: "pending", postId: null, file: null, updatedAt: now };
}

/**
 * Persist the selection before drafting. A brand-new capture is projected with its full selection in
 * ONE atomic write (a crash cannot leave a group that forgot what was chosen). Idempotent and
 * additive after that: a type already in the group keeps its status (a replayed request never resets
 * a drafted output); a missing type joins at `pending` with the next ordinal in a follow-up write.
 * Duplicate types in one request collapse to one entry.
 */
export function selectCharlesOutputs(
  capture: StudioCapture, types: readonly CharlesOutputType[], path: string = ROOM_QUEUE_PATH,
): RoomQueueItem<CharlesQueuePayload> {
  if (capture.room !== "Charles") throw new Error("only a Charles capture projects into the Charles queue");
  const wanted = [...new Set(types)];
  if (!wanted.length) throw new Error("choose at least one Charles output type");
  for (const type of wanted) if (!isCharlesOutputType(type)) throw new Error(`"${String(type)}" is not a Charles output type`);
  const groupId = charlesGroupId(capture.id);
  const now = new Date().toISOString();
  const initial = wanted.map((type, ordinal) => pendingOutput(type, ordinal, now));
  const item = projectCapture(capture, { kind: "charles", groupId, outputs: initial }, path, "pending");
  const have = new Set((item.payload.outputs ?? []).map((output) => output.type));
  if (item.payload.groupId && wanted.every((type) => have.has(type))) return item;
  return mutateQueueItem<CharlesQueuePayload>(capture.id, (current) => {
    const outputs = [...(current.payload.outputs ?? [])];
    for (const type of wanted) {
      if (outputs.some((output) => output.type === type)) continue;
      outputs.push(pendingOutput(type, outputs.length, new Date().toISOString()));
    }
    return { state: charlesGroupState(outputs), payload: { groupId: current.payload.groupId ?? groupId, outputs } };
  }, path);
}

/** The outputs a (re)run still has to draft, in selection order. */
export function pendingCharlesOutputs(item: Pick<RoomQueueItem<CharlesQueuePayload>, "payload">): CharlesGroupOutput[] {
  return [...(item.payload.outputs ?? [])].filter((output) => output.status === "pending").sort((a, b) => a.ordinal - b.ordinal);
}

export interface CharlesDraftedRef { postId: string; file: string }

function outputIndex(current: RoomQueueItem<CharlesQueuePayload>, type: CharlesOutputType): { outputs: readonly CharlesGroupOutput[]; index: number; output: CharlesGroupOutput } {
  const outputs = current.payload.outputs ?? [];
  const index = outputs.findIndex((output) => output.type === type);
  if (index < 0) throw new Error(`${type} was not selected for this Charles group`);
  return { outputs, index, output: outputs[index]! };
}

function replaceOutput(outputs: readonly CharlesGroupOutput[], index: number, next: CharlesGroupOutput): { state: QueueState; payload: { outputs: CharlesGroupOutput[] } } {
  const replaced = [...outputs];
  replaced[index] = next;
  return { state: charlesGroupState(replaced), payload: { outputs: replaced } };
}

/**
 * Claim one pending output for this run, under the store lock: pending → drafting. Exactly one
 * caller wins; every other run (this process, another process, a retry) sees `drafting` and must not
 * draft it. `reserved: false` means someone else already holds it or it is past that step.
 */
export function reserveCharlesOutput(
  captureId: string, type: CharlesOutputType, path: string = ROOM_QUEUE_PATH,
): { item: RoomQueueItem<CharlesQueuePayload>; reserved: boolean } {
  charlesItem(captureId, path);
  let reserved = false;
  const item = mutateQueueItem<CharlesQueuePayload>(captureId, (current) => {
    const { outputs, index, output } = outputIndex(current, type);
    if (output.status !== "pending") return {};
    reserved = true;
    return replaceOutput(outputs, index, { ...output, status: "drafting", updatedAt: new Date().toISOString() });
  }, path);
  return { item, reserved };
}

/**
 * Give a reservation back: drafting → pending, only when nothing was recorded against it. Used when
 * the drafter threw (its own rollback guarantees nothing reached charles/), so the retry re-drafts.
 */
export function releaseCharlesOutput(captureId: string, type: CharlesOutputType, path: string = ROOM_QUEUE_PATH): RoomQueueItem<CharlesQueuePayload> {
  charlesItem(captureId, path);
  return mutateQueueItem<CharlesQueuePayload>(captureId, (current) => {
    const { outputs, index, output } = outputIndex(current, type);
    if (output.status !== "drafting" || output.postId !== null) return {};
    return replaceOutput(outputs, index, { ...output, status: "pending", updatedAt: new Date().toISOString() });
  }, path);
}

/**
 * Record one output's draft, from `pending` or a held `drafting` reservation. Idempotent per
 * (group, type): the exact same ref replayed is a no-op; the same row pointed at a different file,
 * or a different row over an already-drafted output, is refused, so nothing is ever redrafted or
 * re-pointed.
 */
export function markCharlesOutputDrafted(
  captureId: string, type: CharlesOutputType, ref: CharlesDraftedRef, path: string = ROOM_QUEUE_PATH,
): RoomQueueItem<CharlesQueuePayload> {
  charlesItem(captureId, path);
  return mutateQueueItem<CharlesQueuePayload>(captureId, (current) => {
    const { outputs, index, output } = outputIndex(current, type);
    if (output.status !== "pending" && output.status !== "drafting") {
      if (output.postId !== ref.postId) throw new Error(`${type} is already drafted as ${output.postId}; it is never redrafted`);
      if (output.file !== ref.file) throw new Error(`${type} is already drafted as ${output.postId} at ${output.file}; it is never re-pointed`);
      return {};
    }
    return replaceOutput(outputs, index, { ...output, status: "drafted", postId: ref.postId, file: ref.file, updatedAt: new Date().toISOString() });
  }, path);
}

/** Mirror one drafted output's review decision. An undrafted output has nothing to approve. */
export function setCharlesOutputStatus(
  captureId: string, type: CharlesOutputType, status: Exclude<CharlesOutputState, "pending" | "drafting">, path: string = ROOM_QUEUE_PATH,
): RoomQueueItem<CharlesQueuePayload> {
  charlesItem(captureId, path);
  return mutateQueueItem<CharlesQueuePayload>(captureId, (current) => {
    const { outputs, index, output } = outputIndex(current, type);
    if (output.status === "pending" || output.status === "drafting") throw new Error(`${type} has not been drafted yet`);
    if (output.status === status) return {};
    return replaceOutput(outputs, index, { ...output, status, updatedAt: new Date().toISOString() });
  }, path);
}

export interface CharlesQueueSyncOptions {
  captures?: readonly StudioCapture[];
  /** Review-queue rows to mirror from; defaults to the live charles/review-queue.md. */
  posts?: readonly CharlesRow[];
  path?: string;
}

/**
 * Read-side reconcile: project any Charles capture event not yet in the queue (legacy rows), then
 * mirror each drafted output's review-queue.md status (approve → approved, discard → rejected,
 * anything else → drafted) and roll the group state up. Items with no selection are left as they
 * are. Idempotent; an item already in sync is not rewritten.
 */
export function syncCharlesQueue(options: CharlesQueueSyncOptions = {}): { items: RoomQueueItem<CharlesQueuePayload>[]; pending: number } {
  const path = options.path ?? ROOM_QUEUE_PATH;
  const captures = (options.captures ?? listCaptures()).filter((capture) => capture.room === "Charles");
  projectCaptureEvents(captures, path);
  const statusById = new Map((options.posts ?? listCharlesPosts()).map((row) => [row.id, row.status] as const));
  const items: RoomQueueItem<CharlesQueuePayload>[] = [];
  for (const item of roomQueueItems("Charles", path) as RoomQueueItem<CharlesQueuePayload>[]) {
    if (!item.payload.outputs) { items.push(item); continue; }
    items.push(mutateQueueItem<CharlesQueuePayload>(item.captureId, (current) => {
      const outputs = (current.payload.outputs ?? []).map((output) => {
        if (output.status === "pending" || !output.postId) return output;
        const reviewed = statusById.get(output.postId);
        // A row Muxin removed by hand keeps its last known status rather than being resurrected.
        const status = reviewed === undefined ? output.status : charlesOutputStatusFromReview(reviewed);
        return status === output.status ? output : { ...output, status, updatedAt: new Date().toISOString() };
      });
      return { state: charlesGroupState(outputs), payload: { outputs } };
    }, path));
  }
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { items, pending: pendingCount(items) };
}

// ---------------------------------------------------------------------------
// The group run: select, then draft only what is still pending.

export type CharlesDrafter = (mode: CharlesOutputType, input: string, engine: Engine) => Promise<{ id: string; post: CharlesPost }>;

export interface CharlesGroupRunInput {
  capture: StudioCapture;
  types: readonly CharlesOutputType[];
  engine: Engine;
  /** The link or quoted post a reply reacts to; the capture text then rides along as the angle. */
  replySource?: string;
  draft: CharlesDrafter;
  path?: string;
}

export type CharlesOutputResult =
  | { readonly type: CharlesOutputType; readonly outcome: "drafted"; readonly id: string }
  | { readonly type: CharlesOutputType; readonly outcome: "skipped"; readonly id: string | null; readonly status: CharlesOutputState }
  | { readonly type: CharlesOutputType; readonly outcome: "failed"; readonly error: string };

export interface CharlesGroupRunResult {
  readonly item: RoomQueueItem<CharlesQueuePayload>;
  readonly results: readonly CharlesOutputResult[];
}

/** What each output is drafted from. Unchanged from the per-mode front door: the text is the topic, a reply gets its source first. */
export function charlesDraftInput(type: CharlesOutputType, text: string, replySource: string | undefined): string {
  if (type !== "reply") return text;
  const source = (replySource ?? "").trim();
  return source ? `${source}${text.trim() ? `\nRequested angle: ${text.trim()}` : ""}` : text;
}

const groupsInFlight = new Set<string>();

/**
 * Persist the selection, then for each still-pending output in ordinal order: reserve it
 * (pending → drafting, under the store lock), draft it, record the draft (drafting → drafted). The
 * reservation is what makes a retry or a concurrent process safe: only the caller whose reserve won
 * drafts, everyone else sees `drafting` and skips, so at most one draft ever lands per output.
 *
 * A drafter that THROWS committed nothing (charles-jobs.ts rolls its own file back), so the output is
 * released to `pending` and a retry re-drafts it. A crash strictly between reserve and the
 * successful mark leaves the output `drafting`: if the draft did land it is still in
 * charles/review-queue.md for Muxin (nothing lost), and the group reads unfinished
 * (partially-complete) instead of ever holding a duplicate. That visible unfinished output is the
 * deliberate trade. One run per group per process; the reservation covers the cross-process case.
 */
export async function runCharlesGroup(input: CharlesGroupRunInput): Promise<CharlesGroupRunResult> {
  const path = input.path ?? ROOM_QUEUE_PATH;
  if (groupsInFlight.has(input.capture.id)) throw new Error("this Charles group is already being drafted");
  groupsInFlight.add(input.capture.id);
  try {
    const item = selectCharlesOutputs(input.capture, input.types, path);
    const selected = new Set(input.types);
    const results: CharlesOutputResult[] = [];
    for (const output of [...(item.payload.outputs ?? [])].sort((a, b) => a.ordinal - b.ordinal)) {
      if (!selected.has(output.type)) continue;
      const claim = output.status === "pending" ? reserveCharlesOutput(input.capture.id, output.type, path) : null;
      if (!claim?.reserved) {
        const live = claim?.item.payload.outputs?.find((candidate) => candidate.type === output.type) ?? output;
        results.push({ type: output.type, outcome: "skipped", id: live.postId, status: live.status });
        continue;
      }
      try {
        const drafted = await input.draft(output.type, charlesDraftInput(output.type, input.capture.text, input.replySource), input.engine);
        markCharlesOutputDrafted(input.capture.id, output.type, { postId: drafted.id, file: drafted.post.file }, path);
        results.push({ type: output.type, outcome: "drafted", id: drafted.id });
      } catch (error) {
        releaseCharlesOutput(input.capture.id, output.type, path);
        results.push({ type: output.type, outcome: "failed", error: error instanceof Error ? error.message : String(error) });
      }
    }
    return { item: charlesItem(input.capture.id, path), results };
  } finally {
    groupsInFlight.delete(input.capture.id);
  }
}
