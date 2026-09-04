import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { IncomingMessage, ServerResponse } from "node:http";
import { saveCapture, type StudioCapture } from "./captures.js";
import {
  charlesDraftInput, charlesGroupId, charlesGroupState, charlesOutputStatusFromReview, markCharlesOutputDrafted, pendingCharlesOutputs,
  releaseCharlesOutput, reserveCharlesOutput, runCharlesGroup, selectCharlesOutputs, setCharlesOutputStatus, syncCharlesQueue, type CharlesDrafter,
} from "./charles-queue.js";
import { pendingCount, projectCapture, readQueueItem, type CharlesQueuePayload, type RoomQueueItem } from "./room-queue.js";
import { handleCharlesRoute } from "./serve-charles.js";
import type { CharlesPost } from "./charles.js";

// Slice 1.5d: the Charles group model. Every store here is a throwaway file; no test spawns a model
// or reads charles/review-queue.md (the sync takes its rows as input), so Muxin's Charles data is
// never touched.
function stores(label: string): { captures: string; queue: string } {
  const root = mkdtempSync(join(tmpdir(), `charles-queue-${label}-`));
  return { captures: join(root, "captures.json"), queue: join(root, "room-queue.json") };
}

function outputs(item: RoomQueueItem<CharlesQueuePayload>): Array<[string, string, string | null]> {
  return [...(item.payload.outputs ?? [])].sort((a, b) => a.ordinal - b.ordinal).map((o) => [o.type, o.status, o.postId]);
}

/** A drafter that returns a stable id per type, fails the types it is told to, and counts its calls. */
function fakeDrafter(failing: Set<string> = new Set()): { draft: CharlesDrafter; calls: string[] } {
  const calls: string[] = [];
  const post = (id: string, type: string): CharlesPost => ({ id, type, file: `posts/${type}/${id}.md`, status: "pending", notes: "", body: "Quite." });
  return {
    calls,
    draft: async (mode) => {
      calls.push(mode);
      if (failing.has(mode)) throw new Error(`${mode} drafter fell over`);
      return { id: `${mode}-1`, post: post(`${mode}-1`, mode) };
    },
  };
}

test("selection is persisted before any draft: every chosen output sits at pending under one durable group id", () => {
  const { captures, queue } = stores("select");
  const capture = saveCapture("Charles", "the inevitability of power, apparently", captures);
  const item = selectCharlesOutputs(capture, ["oneliner", "essay"], queue);
  assert.equal(item.payload.groupId, charlesGroupId(capture.id));
  assert.equal(item.updatedAt, readQueueItem(capture.id, queue)!.updatedAt);
  assert.equal(item.payload.outputs!.every((o) => o.updatedAt === item.payload.outputs![0]!.updatedAt), true, "a brand-new selection is one write: every output carries the same stamp");
  assert.equal(item.state, "pending");
  assert.deepEqual(outputs(item), [["oneliner", "pending", null], ["essay", "pending", null]]);
  assert.deepEqual(pendingCharlesOutputs(item).map((o) => o.type), ["oneliner", "essay"]);
  // Additive and idempotent: a repeat adds only the new type, at the next ordinal, and resets nothing.
  const again = selectCharlesOutputs(capture, ["essay", "reply", "reply"], queue);
  assert.deepEqual(outputs(again), [["oneliner", "pending", null], ["essay", "pending", null], ["reply", "pending", null]]);
  assert.deepEqual(again.payload.outputs!.map((o) => o.ordinal), [0, 1, 2]);
  assert.equal(again.payload.groupId, item.payload.groupId, "the group id is derived from the capture, so it never changes");
  assert.throws(() => selectCharlesOutputs(capture, [], queue), /at least one/);
  assert.throws(() => selectCharlesOutputs(capture, ["meme" as never], queue), /not a Charles output type/);
});

test("a 1.5a Charles row (groupId only) still loads and gains its group on first selection", () => {
  const { captures, queue } = stores("legacy");
  const capture = saveCapture("Charles", "an older capture", captures);
  projectCapture(capture, { kind: "charles", groupId: null }, queue);
  const legacy = readQueueItem(capture.id, queue) as RoomQueueItem<CharlesQueuePayload>;
  assert.equal(legacy.payload.outputs, undefined);
  assert.equal(pendingCount([legacy]), 1, "a legacy row still counts as needing attention");
  assert.deepEqual(syncCharlesQueue({ captures: [capture], posts: [], path: queue }).items.map((i) => i.payload), [{ kind: "charles", groupId: null }], "sync leaves an unselected row untouched");
  const upgraded = selectCharlesOutputs(capture, ["essay"], queue);
  assert.equal(upgraded.payload.groupId, charlesGroupId(capture.id));
  assert.deepEqual(outputs(upgraded), [["essay", "pending", null]]);
});

test("group state rolls up from its outputs; only complete stops counting", () => {
  const at = (...statuses: Array<"pending" | "drafting" | "drafted" | "approved" | "rejected">) => statuses.map((status) => ({ status }));
  assert.equal(charlesGroupState([]), "pending");
  assert.equal(charlesGroupState(at("pending", "pending")), "pending");
  // A reservation is a non-terminal step: it keeps the group counting and never lets it read complete.
  assert.equal(charlesGroupState(at("drafting")), "pending");
  assert.equal(charlesGroupState(at("approved", "drafting")), "partially-complete");
  assert.equal(charlesGroupState(at("approved", "rejected", "pending")), "partially-complete");
  for (const open of ["pending", "drafting", "drafted"] as const) assert.notEqual(charlesGroupState(at("approved", "rejected", open)), "complete");
  assert.equal(charlesGroupState(at("drafted", "drafted")), "pending", "all drafted, none decided: awaiting Muxin as one unit");
  assert.equal(charlesGroupState(at("drafted", "pending")), "partially-complete", "a half-drafted set");
  assert.equal(charlesGroupState(at("approved", "pending")), "partially-complete");
  assert.equal(charlesGroupState(at("approved", "drafted")), "partially-complete", "one decided, one still under review");
  assert.equal(charlesGroupState(at("approved", "rejected")), "complete", "rejected is terminal too");
  assert.equal(charlesGroupState(at("rejected")), "complete");
  assert.equal(pendingCount([{ state: "partially-complete" }, { state: "complete" }, { state: "pending" }]), 2);
});

test("a run drafts each pending output, a mid-way failure leaves a durable half-set, and the retry drafts only what is missing", async () => {
  const { captures, queue } = stores("run");
  const capture = saveCapture("Charles", "everything is perfectly stable", captures);
  const first = fakeDrafter(new Set(["essay"]));
  const run = await runCharlesGroup({ capture, types: ["oneliner", "essay", "reply"], engine: "claude", replySource: "https://example.com/post", draft: first.draft, path: queue });
  assert.deepEqual(first.calls, ["oneliner", "essay", "reply"]);
  assert.deepEqual(run.results, [
    { type: "oneliner", outcome: "drafted", id: "oneliner-1" },
    { type: "essay", outcome: "failed", error: "essay drafter fell over" },
    { type: "reply", outcome: "drafted", id: "reply-1" },
  ]);
  assert.equal(run.item.state, "partially-complete");
  assert.deepEqual(outputs(run.item), [["oneliner", "drafted", "oneliner-1"], ["essay", "pending", null], ["reply", "drafted", "reply-1"]]);
  assert.deepEqual(outputs(readQueueItem(capture.id, queue) as RoomQueueItem<CharlesQueuePayload>), outputs(run.item), "the half-set is on disk, not in memory");

  // The same request again (same text = same capture = same group) touches only the missing essay.
  const second = fakeDrafter();
  const retry = await runCharlesGroup({ capture, types: ["oneliner", "essay", "reply"], engine: "claude", replySource: "https://example.com/post", draft: second.draft, path: queue });
  assert.deepEqual(second.calls, ["essay"], "drafted outputs are never redrafted");
  assert.deepEqual(retry.results, [
    { type: "oneliner", outcome: "skipped", id: "oneliner-1", status: "drafted" },
    { type: "essay", outcome: "drafted", id: "essay-1" },
    { type: "reply", outcome: "skipped", id: "reply-1", status: "drafted" },
  ]);
  assert.equal(retry.item.state, "pending", "all drafted, all awaiting Muxin");
  assert.equal(retry.item.payload.outputs!.find((o) => o.type === "essay")?.file, "posts/essay/essay-1.md");
  // Across both runs nothing was drafted twice: only the failed essay was attempted again.
  const drafts = [...first.calls, ...second.calls];
  assert.equal(drafts.filter((d) => d === "oneliner").length, 1);
  assert.equal(drafts.filter((d) => d === "reply").length, 1);
  assert.equal(drafts.filter((d) => d === "essay").length, 2);
});

test("an output is reserved before it drafts, so a held reservation is skipped and never redrafted", async () => {
  const { captures, queue } = stores("reserve");
  const capture = saveCapture("Charles", "reserve first", captures);
  selectCharlesOutputs(capture, ["oneliner", "essay"], queue);
  // Another run (or process) already holds the essay: it reads `drafting` on disk.
  const held = reserveCharlesOutput(capture.id, "essay", queue);
  assert.equal(held.reserved, true);
  assert.equal(reserveCharlesOutput(capture.id, "essay", queue).reserved, false, "a second reserve loses");
  assert.deepEqual(outputs(held.item), [["oneliner", "pending", null], ["essay", "drafting", null]]);
  assert.equal(held.item.state, "partially-complete");
  assert.deepEqual(pendingCharlesOutputs(held.item).map((o) => o.type), ["oneliner"], "a reserved output is not a retry target");

  const seen: string[] = [];
  const drafter: CharlesDrafter = async (mode) => {
    seen.push(mode);
    // Mid-draft, the output must already be reserved on disk.
    assert.equal((readQueueItem(capture.id, queue) as RoomQueueItem<CharlesQueuePayload>).payload.outputs!.find((o) => o.type === mode)?.status, "drafting");
    return { id: `${mode}-1`, post: { id: `${mode}-1`, type: mode, file: `posts/${mode}/${mode}-1.md`, status: "pending", notes: "", body: "Quite." } };
  };
  const run = await runCharlesGroup({ capture, types: ["oneliner", "essay"], engine: "claude", draft: drafter, path: queue });
  assert.deepEqual(seen, ["oneliner"]);
  assert.deepEqual(run.results, [
    { type: "oneliner", outcome: "drafted", id: "oneliner-1" },
    { type: "essay", outcome: "skipped", id: null, status: "drafting" },
  ]);
  assert.equal(run.item.state, "partially-complete", "the group reads unfinished, not duplicated");
  assert.throws(() => setCharlesOutputStatus(capture.id, "essay", "approved", queue), /not been drafted/);
  // The holder finishes: drafting → drafted with its ref.
  const finished = markCharlesOutputDrafted(capture.id, "essay", { postId: "essay-9", file: "posts/essays/essay-9.md" }, queue);
  assert.deepEqual(outputs(finished), [["oneliner", "drafted", "oneliner-1"], ["essay", "drafted", "essay-9"]]);
  assert.equal(finished.state, "pending");
  // A release only ever undoes an unrecorded reservation.
  assert.equal(releaseCharlesOutput(capture.id, "essay", queue).updatedAt, finished.updatedAt);
});

test("a drafter that throws releases its reservation to pending, so the retry re-drafts exactly that output", async () => {
  const { captures, queue } = stores("release");
  const capture = saveCapture("Charles", "throw on the second", captures);
  const first = fakeDrafter(new Set(["essay"]));
  await runCharlesGroup({ capture, types: ["oneliner", "essay", "reply"], engine: "claude", replySource: "https://example.com/p", draft: first.draft, path: queue });
  assert.deepEqual(outputs(readQueueItem(capture.id, queue) as RoomQueueItem<CharlesQueuePayload>), [["oneliner", "drafted", "oneliner-1"], ["essay", "pending", null], ["reply", "drafted", "reply-1"]]);
  const second = fakeDrafter();
  const retry = await runCharlesGroup({ capture, types: ["oneliner", "essay", "reply"], engine: "claude", replySource: "https://example.com/p", draft: second.draft, path: queue });
  assert.deepEqual(second.calls, ["essay"]);
  assert.deepEqual(outputs(retry.item), [["oneliner", "drafted", "oneliner-1"], ["essay", "drafted", "essay-1"], ["reply", "drafted", "reply-1"]]);
});

test("each output is drafted from the same input the per-mode front door builds", () => {
  assert.equal(charlesDraftInput("essay", "a topic", "https://example.com/x"), "a topic");
  assert.equal(charlesDraftInput("reply", "a requested angle", "https://example.com/x"), "https://example.com/x\nRequested angle: a requested angle");
  assert.equal(charlesDraftInput("reply", "https://example.com/pasted-as-text", undefined), "https://example.com/pasted-as-text");
});

test("marking an output drafted is idempotent per (group, type) and refuses to re-point a drafted output", () => {
  const { captures, queue } = stores("mark");
  const capture = saveCapture("Charles", "one capture", captures);
  selectCharlesOutputs(capture, ["essay"], queue);
  const drafted = markCharlesOutputDrafted(capture.id, "essay", { postId: "essay-1", file: "posts/essays/essay-1.md" }, queue);
  assert.deepEqual(outputs(drafted), [["essay", "drafted", "essay-1"]]);
  const replay = markCharlesOutputDrafted(capture.id, "essay", { postId: "essay-1", file: "posts/essays/essay-1.md" }, queue);
  assert.equal(replay.updatedAt, drafted.updatedAt, "a replay writes nothing");
  assert.throws(() => markCharlesOutputDrafted(capture.id, "essay", { postId: "essay-2", file: "posts/essays/essay-2.md" }, queue), /never redrafted/);
  assert.throws(() => markCharlesOutputDrafted(capture.id, "essay", { postId: "essay-1", file: "posts/essays/elsewhere.md" }, queue), /never re-pointed/);
  assert.equal((readQueueItem(capture.id, queue) as RoomQueueItem<CharlesQueuePayload>).payload.outputs![0]!.file, "posts/essays/essay-1.md", "a refused re-point wrote nothing");
  assert.throws(() => markCharlesOutputDrafted(capture.id, "reply", { postId: "reply-1", file: "posts/replies/reply-1.md" }, queue), /not selected/);
  assert.throws(() => markCharlesOutputDrafted("capture-missing", "essay", { postId: "x", file: "y" }, queue), /no such capture/);
});

test("approval is per output and the group completes only when every output is decided", () => {
  const { captures, queue } = stores("approve");
  const capture = saveCapture("Charles", "two outputs", captures);
  selectCharlesOutputs(capture, ["oneliner", "essay"], queue);
  assert.throws(() => setCharlesOutputStatus(capture.id, "essay", "approved", queue), /not been drafted/);
  markCharlesOutputDrafted(capture.id, "oneliner", { postId: "ol-1", file: "posts/one-liners/ol-1.md" }, queue);
  markCharlesOutputDrafted(capture.id, "essay", { postId: "es-1", file: "posts/essays/es-1.md" }, queue);
  assert.equal(setCharlesOutputStatus(capture.id, "oneliner", "approved", queue).state, "partially-complete");
  assert.equal(setCharlesOutputStatus(capture.id, "essay", "rejected", queue).state, "complete");
  assert.equal(pendingCount([readQueueItem(capture.id, queue)!]), 0);
  // Muxin can change her mind on a decided output; the group reopens.
  assert.equal(setCharlesOutputStatus(capture.id, "essay", "drafted", queue).state, "partially-complete");
});

test("sync mirrors each drafted output's review-queue decision and rolls the group up", () => {
  const { captures, queue } = stores("sync");
  const capture = saveCapture("Charles", "reviewed later", captures);
  selectCharlesOutputs(capture, ["oneliner", "essay", "reply"], queue);
  markCharlesOutputDrafted(capture.id, "oneliner", { postId: "ol-1", file: "posts/one-liners/ol-1.md" }, queue);
  markCharlesOutputDrafted(capture.id, "essay", { postId: "es-1", file: "posts/essays/es-1.md" }, queue);
  const row = (id: string, type: string, status: string) => ({ id, type, file: `posts/${type}/${id}.md`, status, notes: "" });
  const synced = syncCharlesQueue({ captures: [capture], posts: [row("ol-1", "one-liner", "approve"), row("es-1", "essay", "revise")], path: queue });
  assert.equal(synced.pending, 1);
  assert.deepEqual(outputs(synced.items[0]!), [["oneliner", "approved", "ol-1"], ["essay", "drafted", "es-1"], ["reply", "pending", null]]);
  assert.equal(synced.items[0]!.state, "partially-complete");
  // A row Muxin deleted by hand keeps its last known status; a decided output re-pending in the queue reopens.
  const later = syncCharlesQueue({ captures: [capture], posts: [row("es-1", "essay", "discard")], path: queue });
  assert.deepEqual(outputs(later.items[0]!), [["oneliner", "approved", "ol-1"], ["essay", "rejected", "es-1"], ["reply", "pending", null]]);
  assert.equal(charlesOutputStatusFromReview("pending"), "drafted");
  // A Charles capture nobody selected outputs for is projected on read and counts, as in 1.5a.
  const stray = saveCapture("Charles", "a stray capture", captures);
  const all = syncCharlesQueue({ captures: [capture, stray], posts: [], path: queue });
  assert.equal(all.items.length, 2);
  assert.equal(all.items.find((i) => i.captureId === stray.id)?.state, "pending");
});

// The route, through handleCharlesRoute so the drafter and the stores are injectable.
type RouteBody = Record<string, unknown>;
async function call(body: RouteBody, draft: CharlesDrafter, paths: { captures: string; queue: string }): Promise<RouteBody> {
  let out: RouteBody = {};
  const handled = await handleCharlesRoute({
    req: { method: "POST" } as IncomingMessage, res: {} as ServerResponse, url: new URL("http://localhost/api/charles/group"),
    readBody: async () => body, json: (_res, _code, payload) => { out = payload as RouteBody; }, requestEngine: () => "claude",
    capturesPath: paths.captures, queuePath: paths.queue, draftCharles: draft,
  });
  assert.equal(handled, true);
  return out;
}

test("POST /api/charles/group persists the selection, drafts through the injected drafter, and reports per-output outcomes", async () => {
  const paths = stores("route");
  const failing = fakeDrafter(new Set(["reply"]));
  const first = await call({ text: "power is not inevitable", types: ["oneliner", "reply"], replySource: "https://example.com/x", engine: "claude" }, failing.draft, paths);
  assert.equal(first.ok, true);
  assert.equal(first.groupId, charlesGroupId(String(first.captureId)));
  assert.equal(first.pending, 1);
  assert.deepEqual((first.results as Array<{ type: string; outcome: string }>).map((r) => `${r.type}:${r.outcome}`), ["oneliner:drafted", "reply:failed"]);
  const stored = readQueueItem(String(first.captureId), paths.queue) as RoomQueueItem<CharlesQueuePayload>;
  assert.equal(stored.state, "partially-complete");
  const retry = fakeDrafter();
  const second = await call({ text: "power is not inevitable", types: ["oneliner", "reply"], replySource: "https://example.com/x" }, retry.draft, paths);
  assert.deepEqual(retry.calls, ["reply"]);
  assert.equal(second.captureId, first.captureId, "same text, same capture, same group");
  assert.equal((second.item as RoomQueueItem).state, "pending");

  const bad = await call({ text: "x", types: ["meme"] }, retry.draft, paths);
  assert.equal(bad.ok, false);
  assert.match(String(bad.error), /isn't a format/);
  const none = await call({ text: "x", types: [] }, retry.draft, paths);
  assert.match(String(none.error), /at least one/);
  const empty = await call({ text: "  ", types: ["essay"] }, retry.draft, paths);
  assert.match(String(empty.error), /capture text is required/);
});

test("a capture in another room cannot be selected into the Charles queue", () => {
  const { captures, queue } = stores("room");
  const capture: StudioCapture = saveCapture("Fiction", "not charles", captures);
  assert.throws(() => selectCharlesOutputs(capture, ["essay"], queue), /only a Charles capture/);
});
