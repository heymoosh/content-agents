import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { saveCapture } from "./captures.js";
import { pendingCount, readQueueItem, roomQueueItems, type QueueState, type VentureCandidate, type VentureQueuePayload } from "./room-queue.js";
import { answerVentureCapture, answerVersionOf, projectVentureCapture } from "./venture-queue.js";
import { resolveVentureMention, ventureCandidates } from "./venture-resolver.js";
import { listVentures } from "../venture/paths.js";
import { reviewRequestHandler } from "./serve.js";

// The venture list is read from disk (src/venture/paths.ts), so every test that goes through the
// server points CONTENT_AGENTS_TEST_VENTURE_ROOT at its own throwaway tree; the capture and queue
// stores already land in the node:test throwaway data root. Nothing here touches venture/.
const ROOT_ENV = "CONTENT_AGENTS_TEST_VENTURE_ROOT";
function withVentureRoot<T>(slugs: readonly string[], fn: (root: string) => T): T {
  const before = process.env[ROOT_ENV];
  const root = mkdtempSync(join(tmpdir(), "venture-queue-root-"));
  for (const slug of slugs) mkdirSync(join(root, slug));
  process.env[ROOT_ENV] = root;
  const restore = () => { if (before === undefined) delete process.env[ROOT_ENV]; else process.env[ROOT_ENV] = before; rmSync(root, { recursive: true, force: true }); };
  try {
    const result = fn(root);
    if (result instanceof Promise) return result.finally(restore) as T;
    restore(); return result;
  } catch (error) { restore(); throw error; }
}

const VENTURES: VentureCandidate[] = ventureCandidates(["pricing-sprint", "newsletter-lab"]);
const SLUGS = VENTURES.map((v) => v.slug);

function stores(label: string): { captures: string; queue: string } {
  const root = mkdtempSync(join(tmpdir(), `venture-queue-${label}-`));
  return { captures: join(root, "captures.json"), queue: join(root, "room-queue.json") };
}

test("a resolved Venture capture projects as pending against its slug; a slug-only 1.5a row still reads as version 0", () => {
  const { captures, queue } = stores("resolved");
  const capture = saveCapture("Venture", "probe post for the pricing sprint", captures);
  const item = projectVentureCapture(capture, resolveVentureMention(capture.text, VENTURES), VENTURES, queue);
  assert.equal(item.state, "pending");
  assert.deepEqual(item.payload, { kind: "venture", slug: "pricing-sprint", candidates: [], answerVersion: 0 });
  assert.equal(answerVersionOf({ payload: { kind: "venture", slug: "x" } }), 0, "legacy rows without answerVersion read as 0");
  assert.equal(pendingCount(roomQueueItems("Venture", queue)), 1);
});

test("an ambiguous capture persists a durable awaiting-answer question with its candidate snapshot; a replayed Start returns it untouched", () => {
  const { captures, queue } = stores("ambiguous");
  const capture = saveCapture("Venture", "an idea that names no venture", captures);
  const resolution = resolveVentureMention(capture.text, VENTURES);
  assert.equal(resolution.kind, "none");
  const item = projectVentureCapture(capture, resolution, VENTURES, queue);
  assert.equal(item.state, "awaiting-answer");
  assert.deepEqual(item.payload, { kind: "venture", slug: null, candidates: VENTURES, answerVersion: 0 });
  // Reload: the question is in the store, not in a response.
  assert.equal(readQueueItem(capture.id, queue)?.state, "awaiting-answer");
  const again = projectVentureCapture(capture, { kind: "resolved", slug: "newsletter-lab" }, VENTURES, queue);
  assert.deepEqual(again, item, "an existing projection wins; a replayed Start never re-answers");
  assert.throws(() => projectVentureCapture(saveCapture("Venture", "nothing to ask over", captures), { kind: "none" }, [], queue), /no venture exists yet/);
});

test("answer protocol: validates the slug against the live list, then CAS on answerVersion, and replays are no-ops", () => {
  const { captures, queue } = stores("answer");
  const capture = saveCapture("Venture", "which venture is this for", captures);
  projectVentureCapture(capture, { kind: "ambiguous", candidates: VENTURES }, VENTURES, queue);

  const unknown = answerVentureCapture({ captureId: capture.id, slug: "not-on-disk", expectedVersion: 0 }, SLUGS, queue);
  assert.equal(unknown.status, 400);
  assert.equal(readQueueItem(capture.id, queue)?.state, "awaiting-answer", "a bad slug writes nothing");
  assert.equal(answerVentureCapture({ captureId: capture.id, slug: "pricing-sprint", expectedVersion: 1.5 }, SLUGS, queue).status, 400);
  assert.equal(answerVentureCapture({ captureId: "capture-missing", slug: "pricing-sprint", expectedVersion: 0 }, SLUGS, queue).status, 404);

  const first = answerVentureCapture({ captureId: capture.id, slug: "pricing-sprint", expectedVersion: 0 }, SLUGS, queue);
  assert.equal(first.status, 200);
  assert.ok(first.status === 200 && !first.replayed);
  const stored = readQueueItem(capture.id, queue) as { state: QueueState; payload: VentureQueuePayload };
  assert.equal(stored.state, "pending");
  assert.deepEqual(stored.payload, { kind: "venture", slug: "pricing-sprint", candidates: [], answerVersion: 1 });

  // Retry dupe: the same answer again, with the now-stale version a retrying client would still hold.
  const retry = answerVentureCapture({ captureId: capture.id, slug: "pricing-sprint", expectedVersion: 0 }, SLUGS, queue);
  assert.equal(retry.status, 200);
  assert.ok(retry.status === 200 && retry.replayed);
  assert.equal(answerVersionOf(readQueueItem(capture.id, queue) as { payload: VentureQueuePayload }), 1, "no double effect");

  // Two-tab divergence: a second tab answering differently off the pre-answer version is refused.
  const stale = answerVentureCapture({ captureId: capture.id, slug: "newsletter-lab", expectedVersion: 0 }, SLUGS, queue);
  assert.equal(stale.status, 409);
  assert.equal(readQueueItem(capture.id, queue)?.payload.kind === "venture" ? (readQueueItem(capture.id, queue)!.payload as VentureQueuePayload).slug : null, "pricing-sprint");
  // A deliberate re-answer off the current version still works (a room may move a capture).
  const moved = answerVentureCapture({ captureId: capture.id, slug: "newsletter-lab", expectedVersion: 1 }, SLUGS, queue);
  assert.equal(moved.status, 200);
  assert.equal(moved.status === 200 ? answerVersionOf(moved.item) : -1, 2);
  assert.equal(moved.status === 200 ? moved.item.state : null, "pending", "an already-answered item keeps its state");

  // Venture deleted mid-select: the slug validation fails cleanly, nothing changes.
  const gone = answerVentureCapture({ captureId: capture.id, slug: "pricing-sprint", expectedVersion: 2 }, ["newsletter-lab"], queue);
  assert.equal(gone.status, 400);
  assert.equal(answerVersionOf(readQueueItem(capture.id, queue) as { payload: VentureQueuePayload }), 2);
});

test("Studio Start on a Venture capture: unambiguous resolves directly, ambiguous returns needsVenture and is answered over HTTP", () => withVentureRoot(SLUGS, async (root) => {
  assert.deepEqual(listVentures(), ["newsletter-lab", "pricing-sprint"], "the test venture root is what the server lists");
  const httpServer = createServer(reviewRequestHandler);
  try {
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const address = httpServer.address();
    assert.ok(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}`;
    const post = async (path: string, body: unknown) => {
      const r = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      return { status: r.status, body: await r.json() as Record<string, any> };
    };
    const stamp = Date.now();

    const direct = await post("/api/captures/start", { room: "Venture", text: `probe post for pricing-sprint ${stamp}` });
    assert.equal(direct.status, 200, direct.body.error);
    assert.equal(direct.body.needsVenture, false);
    assert.equal(direct.body.queueItem.state, "pending");
    assert.equal(direct.body.queueItem.payload.slug, "pricing-sprint");

    const asked = await post("/api/captures/start", { room: "Venture", text: `an idea with no venture named ${stamp}` });
    assert.equal(asked.status, 200, asked.body.error);
    assert.equal(asked.body.needsVenture, true);
    assert.equal(asked.body.captureId, asked.body.capture.id);
    assert.equal(asked.body.answerVersion, 0);
    assert.deepEqual(asked.body.candidates.map((c: VentureCandidate) => c.slug), ["newsletter-lab", "pricing-sprint"]);

    // Reload: the open question is durable and counts as pending work.
    const read = await fetch(`${base}/api/room-queue?room=Venture`);
    const queue = await read.json() as { items: Array<{ captureId: string; state: QueueState }>; pending: number };
    assert.equal(read.status, 200);
    assert.equal(queue.items.find((item) => item.captureId === asked.body.captureId)?.state, "awaiting-answer");
    assert.equal(queue.pending, pendingCount(queue.items));

    // An explicit desk mention is resolved by the server, never taken as a slug on trust.
    const mentioned = await post("/api/captures/start", { room: "Venture", text: `a mention-routed idea ${stamp}`, venture: "Newsletter Lab" });
    assert.equal(mentioned.body.queueItem.payload.slug, "newsletter-lab");
    const untrusted = await post("/api/captures/start", { room: "Venture", text: `a bogus-mention idea ${stamp}`, venture: "made-up-venture" });
    assert.equal(untrusted.body.needsVenture, true, "an unknown mention asks instead of defaulting");

    const bad = await post("/api/room-queue/venture-answer", { captureId: asked.body.captureId, slug: "made-up", expectedVersion: 0 });
    assert.equal(bad.status, 400);
    const missingVersion = await post("/api/room-queue/venture-answer", { captureId: asked.body.captureId, slug: "pricing-sprint" });
    assert.equal(missingVersion.status, 400);
    const ok = await post("/api/room-queue/venture-answer", { captureId: asked.body.captureId, slug: "pricing-sprint", expectedVersion: 0 });
    assert.equal(ok.status, 200, ok.body.error);
    assert.equal(ok.body.item.state, "pending");
    assert.equal(ok.body.item.payload.answerVersion, 1);
    const dupe = await post("/api/room-queue/venture-answer", { captureId: asked.body.captureId, slug: "pricing-sprint", expectedVersion: 0 });
    assert.equal(dupe.status, 200);
    assert.equal(dupe.body.replayed, true);
    const otherTab = await post("/api/room-queue/venture-answer", { captureId: asked.body.captureId, slug: "newsletter-lab", expectedVersion: 0 });
    assert.equal(otherTab.status, 409);
    assert.equal(otherTab.body.item.payload.slug, "pricing-sprint", "the conflict response carries the current row");

    // Venture deleted mid-select.
    rmSync(join(root, "newsletter-lab"), { recursive: true, force: true });
    const deleted = await post("/api/room-queue/venture-answer", { captureId: asked.body.captureId, slug: "newsletter-lab", expectedVersion: 1 });
    assert.equal(deleted.status, 400);
    const after = await (await fetch(`${base}/api/room-queue?room=Venture`)).json() as { items: Array<{ captureId: string; payload: VentureQueuePayload }> };
    assert.equal(after.items.find((item) => item.captureId === asked.body.captureId)?.payload.slug, "pricing-sprint");
  } finally {
    await new Promise<void>((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve()));
  }
}));

test("Studio Start refuses a Venture capture when no venture exists", () => withVentureRoot([], async () => {
  const httpServer = createServer(reviewRequestHandler);
  try {
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const address = httpServer.address();
    assert.ok(address && typeof address === "object");
    const r = await fetch(`http://127.0.0.1:${address.port}/api/captures/start`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ room: "Venture", text: `no ventures yet ${Date.now()}` }) });
    assert.equal(r.status, 400);
    assert.match(((await r.json()) as { error: string }).error, /no venture exists yet/);
  } finally {
    await new Promise<void>((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve()));
  }
}));
