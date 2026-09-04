import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { createCleanupProposal, createIdea, listIdeas, rejectIdea, setIdeaClassification } from "../fiction/idea-inbox.js";
import { listCaptures, saveCapture } from "./captures.js";
import { fictionQueueState, projectFictionCapture, syncFictionQueue } from "./fiction-queue.js";
import { listFictionSeries } from "./fiction.js";
import { pendingCount, readQueueItem, roomQueueItems, type QueueState } from "./room-queue.js";
import { reviewRequestHandler } from "./serve.js";

// The fiction idea store honors CONTENT_AGENTS_HOME but not NODE_TEST_CONTEXT: every test here
// isolates it explicitly, or it writes Muxin's real inbox.
function withIsolatedHome<T>(fn: (home: string) => T): T {
  const home = mkdtempSync(join(tmpdir(), "fiction-queue-home-"));
  const prior = process.env.CONTENT_AGENTS_HOME;
  process.env.CONTENT_AGENTS_HOME = home;
  const restore = () => { if (prior === undefined) delete process.env.CONTENT_AGENTS_HOME; else process.env.CONTENT_AGENTS_HOME = prior; rmSync(home, { recursive: true, force: true }); };
  try {
    const result = fn(home);
    if (result instanceof Promise) return result.finally(restore) as T;
    restore(); return result;
  } catch (error) { restore(); throw error; }
}

test("fiction queue state mirrors the idea store's lifecycle", () => {
  assert.equal(fictionQueueState(null), "archived");
  assert.equal(fictionQueueState({ status: "needs-review", classification: "clarify", proposal: null }), "awaiting-answer");
  assert.equal(fictionQueueState({ status: "needs-review", classification: "plot", proposal: null }), "pending");
  assert.equal(fictionQueueState({ status: "approved", classification: "plot", proposal: null }), "complete");
  assert.equal(fictionQueueState({ status: "rejected", classification: "plot", proposal: null }), "rejected");
});

test("Start-time projection links the capture to its idea; sync follows the idea through review", () => withIsolatedHome((home) => {
  const root = mkdtempSync(join(tmpdir(), "fiction-queue-"));
  const captures = join(root, "captures.json"), queue = join(root, "room-queue.json");
  const capture = saveCapture("Fiction", "the lighthouse edits the sea", captures);
  const idea = createIdea("series-a", capture.text, { storageRoot: home });
  const item = projectFictionCapture(capture, idea, queue);
  assert.deepEqual(item.payload, { kind: "fiction", series: "series-a", ideaId: idea.id });
  assert.equal(item.state, "awaiting-answer", "a fresh, unclassified idea is waiting on Muxin");
  const sync = (): ReturnType<typeof syncFictionQueue> => syncFictionQueue({ series: ["series-a"], captures: listCaptures(captures), path: queue, ideasRoot: home });
  assert.equal(sync().pending, 1);
  const classified = setIdeaClassification({ ...idea, storageRoot: home }, "plot");
  assert.equal(sync().items[0]!.state, "pending");
  const proposal = createCleanupProposal(classified, "cleaned");
  rejectIdea(proposal, { storageRoot: home });
  const after = sync();
  assert.equal(after.items[0]!.state, "rejected");
  assert.equal(after.pending, 0, "a rejected idea leaves the collapsed count");
  assert.equal(readQueueItem(capture.id, queue)?.state, "rejected", "the state is durable, not just derived in the response");
}));

test("sync migrates a legacy unlinked Fiction capture and links it to its idea by exact raw text", () => withIsolatedHome((home) => {
  const root = mkdtempSync(join(tmpdir(), "fiction-queue-legacy-"));
  const captures = join(root, "captures.json"), queue = join(root, "room-queue.json");
  const linked = saveCapture("Fiction", "an idea Muxin already sent to the inbox", captures);
  const orphan = saveCapture("Fiction", "an idea never Started", captures);
  createIdea("series-a", linked.text, { storageRoot: home });
  const result = syncFictionQueue({ series: ["series-a"], captures: listCaptures(captures), path: queue, ideasRoot: home });
  const byId = new Map(result.items.map((item) => [item.captureId, item] as const));
  assert.equal(byId.get(linked.id)?.payload.ideaId, listIdeas("series-a", home)[0]!.id);
  assert.equal(byId.get(linked.id)?.state, "awaiting-answer");
  assert.deepEqual(byId.get(orphan.id)?.payload, { kind: "fiction", series: null, ideaId: null });
  assert.equal(byId.get(orphan.id)?.state, "pending", "an un-promoted capture still needs attention");
  assert.equal(result.pending, 2);
  assert.equal(pendingCount(roomQueueItems("Fiction", queue)), 2);
}));

test("sync refuses to link a legacy capture whose raw text lives in more than one series", () => withIsolatedHome((home) => {
  const root = mkdtempSync(join(tmpdir(), "fiction-queue-ambiguous-"));
  const captures = join(root, "captures.json"), queue = join(root, "room-queue.json");
  const shared = saveCapture("Fiction", "the same beat in two stories", captures);
  const unique = saveCapture("Fiction", "a beat only one story has", captures);
  createIdea("series-a", shared.text, { storageRoot: home });
  createIdea("series-b", shared.text, { storageRoot: home });
  const only = createIdea("series-b", unique.text, { storageRoot: home });
  const result = syncFictionQueue({ series: ["series-a", "series-b"], captures: listCaptures(captures), path: queue, ideasRoot: home });
  const byId = new Map(result.items.map((item) => [item.captureId, item] as const));
  assert.deepEqual(byId.get(shared.id)?.payload, { kind: "fiction", series: null, ideaId: null }, "an ambiguous match is never linked by iteration order");
  assert.equal(byId.get(shared.id)?.state, "pending");
  assert.deepEqual(byId.get(unique.id)?.payload, { kind: "fiction", series: "series-b", ideaId: only.id }, "a unique match still links");
  assert.equal(byId.get(unique.id)?.state, "awaiting-answer");
}));

test("a corrupt Fiction queue row is dropped instead of failing the whole room read", () => withIsolatedHome((home) => {
  const root = mkdtempSync(join(tmpdir(), "fiction-queue-corrupt-"));
  const captures = join(root, "captures.json"), queue = join(root, "room-queue.json");
  const capture = saveCapture("Fiction", "a sound idea", captures);
  const idea = createIdea("series-a", capture.text, { storageRoot: home });
  projectFictionCapture(capture, idea, queue);
  const rows = JSON.parse(readFileSync(queue, "utf8")) as Array<Record<string, unknown>>;
  const { payload: _payload, ...broken } = rows[0]!;
  writeFileSync(queue, JSON.stringify([{ ...broken, captureId: "capture-broken" }, rows[0]]) + "\n");
  const result = syncFictionQueue({ series: ["series-a"], captures: listCaptures(captures), path: queue, ideasRoot: home });
  assert.deepEqual(result.items.map((item) => item.captureId), [capture.id]);
  assert.equal(result.pending, 1);
}));

test("Studio Start projects a Fiction capture and GET /api/room-queue reports it with a bounded count", () => withIsolatedHome(async () => {
  const series = listFictionSeries();
  assert.equal(series.length, 1, "test assumes one fiction series in stories/");
  const httpServer = createServer(reviewRequestHandler);
  try {
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const address = httpServer.address();
    assert.ok(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}`;
    const text = `A cartographer who maps forgetting. ${Date.now()}`;
    const started = await fetch(`${base}/api/captures/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ room: "Fiction", text }) });
    const startBody = await started.json() as { ok?: boolean; error?: string; capture?: { id: string }; idea?: { id: string }; queueItem?: { captureId: string; state: string; payload: { ideaId: string } } };
    assert.equal(started.status, 200, startBody.error ?? "fiction start failed");
    assert.equal(startBody.queueItem?.captureId, startBody.capture?.id);
    assert.equal(startBody.queueItem?.payload.ideaId, startBody.idea?.id);
    assert.equal(startBody.queueItem?.state, "awaiting-answer");
    const bad = await fetch(`${base}/api/room-queue?room=Kitchen`);
    assert.equal(bad.status, 400);
    const read = await fetch(`${base}/api/room-queue?room=Fiction`);
    const body = await read.json() as { ok?: boolean; error?: string; room?: string; pending?: number; items?: Array<{ captureId: string; state: QueueState }> };
    assert.equal(read.status, 200, body.error ?? "room queue read failed");
    const mine = body.items?.find((item) => item.captureId === startBody.capture?.id);
    assert.equal(mine?.state, "awaiting-answer");
    assert.equal(body.pending, pendingCount(body.items ?? []), "the summary count is the documented pending semantics, nothing else");
  } finally {
    await new Promise<void>((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve()));
  }
}));
