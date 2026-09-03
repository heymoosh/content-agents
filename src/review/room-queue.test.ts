import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CAPTURE_VERSION, captureId, listCaptures, saveCapture, type StudioCapture } from "./captures.js";
import {
  PENDING_STATES, QUEUE_STATES, TERMINAL_STATES, isPendingState, listQueueItems, pendingCount, projectCapture,
  projectCaptureEvents, readQueueItem, roomQueueItems, updateQueueItem, type QueueState, type RoomQueueItem,
} from "./room-queue.js";

test("collapsed-queue count includes exactly the still-needs-attention states", () => {
  assert.deepEqual([...PENDING_STATES, ...TERMINAL_STATES].sort(), [...QUEUE_STATES].sort(), "every state is classified once");
  assert.deepEqual(PENDING_STATES, ["pending", "awaiting-answer", "in-progress", "partially-complete"]);
  assert.deepEqual(TERMINAL_STATES, ["complete", "rejected", "archived"]);
  const items = QUEUE_STATES.map((state) => ({ state }));
  assert.equal(pendingCount(items), 4);
  assert.equal(pendingCount([]), 0);
  for (const state of TERMINAL_STATES) assert.equal(isPendingState(state), false, `${state} must not count`);
});

test("a projection is idempotent per capture and the raw event stays minimal", () => {
  const root = mkdtempSync(join(tmpdir(), "room-queue-"));
  const captures = join(root, "studio-captures.json"), queue = join(root, "room-queue.json");
  const capture = saveCapture("Venture", "a venture thought", captures);
  assert.deepEqual(Object.keys(capture).sort(), ["createdAt", "id", "jobId", "room", "startedAt", "text", "version"], "no lifecycle leaks into the front-door event");
  const first = projectCapture(capture, { kind: "venture", slug: null }, queue);
  assert.equal(first.state, "pending");
  assert.equal(first.createdAt, capture.createdAt);
  const moved = updateQueueItem(capture.id, { state: "awaiting-answer", payload: { slug: "acme" } }, queue);
  assert.equal(moved.state, "awaiting-answer");
  assert.deepEqual(moved.payload, { kind: "venture", slug: "acme" });
  // Re-projecting the same event never resets the room's lifecycle.
  assert.deepEqual(projectCapture(capture, { kind: "venture", slug: null }, queue), moved);
  assert.equal(listQueueItems(queue).length, 1);
  assert.throws(() => projectCapture(capture, { kind: "charles", groupId: null }, queue), /does not belong to the Venture room/);
  assert.throws(() => updateQueueItem("capture-missing", { state: "complete" }, queue), /no such queue item/);
  // The raw event log is untouched by projection work.
  assert.deepEqual(listCaptures(captures), [capture]);
});

test("a no-op update leaves the row byte-identical", () => {
  const root = mkdtempSync(join(tmpdir(), "room-queue-noop-"));
  const queue = join(root, "room-queue.json");
  const capture = saveCapture("Charles", "a charles thought", join(root, "captures.json"));
  projectCapture(capture, { kind: "charles", groupId: null }, queue);
  const before = readFileSync(queue, "utf8");
  updateQueueItem(capture.id, { state: "pending", payload: { groupId: null } }, queue);
  assert.equal(readFileSync(queue, "utf8"), before);
});

test("migration: legacy studio-captures.json rows still load and project, and the log is never rewritten", () => {
  const root = mkdtempSync(join(tmpdir(), "room-queue-legacy-"));
  const captures = join(root, "studio-captures.json"), queue = join(root, "room-queue.json");
  // Exactly the v1 shape the current code writes: room/text/timestamps/job, nothing else.
  const legacy: StudioCapture[] = [
    { version: CAPTURE_VERSION, id: captureId("Fiction", "an old fiction idea"), room: "Fiction", text: "an old fiction idea", createdAt: "2026-08-01T00:00:00.000Z", startedAt: null, jobId: null },
    { version: CAPTURE_VERSION, id: captureId("Content", "https://example.com/old"), room: "Content", text: "https://example.com/old", createdAt: "2026-08-02T00:00:00.000Z", startedAt: "2026-08-02T00:00:01.000Z", jobId: "job-x" },
    { version: CAPTURE_VERSION, id: captureId("Signals", "an old signal"), room: "Signals", text: "an old signal", createdAt: "2026-08-03T00:00:00.000Z", startedAt: null, jobId: null },
  ];
  const bytes = JSON.stringify(legacy, null, 2) + "\n";
  writeFileSync(captures, bytes);
  assert.equal(listCaptures(captures).length, 3, "CAPTURE_VERSION is unchanged so v1 rows still read");
  const first = projectCaptureEvents(listCaptures(captures), queue);
  assert.equal(first.created, 3);
  assert.equal(readFileSync(captures, "utf8"), bytes, "the event log is immutable");
  const byId = new Map(first.items.map((item) => [item.captureId, item] as const));
  const fiction = byId.get(legacy[0]!.id)!, content = byId.get(legacy[1]!.id)!, signal = byId.get(legacy[2]!.id)!;
  assert.deepEqual([fiction.state, fiction.payload], ["pending", { kind: "fiction", series: null, ideaId: null }]);
  assert.deepEqual([content.state, content.payload], ["in-progress", { kind: "content", jobId: "job-x" }]);
  assert.deepEqual([signal.state, signal.payload], ["pending", { kind: "generic" }]);
  assert.equal(fiction.createdAt, "2026-08-01T00:00:00.000Z", "queue order follows the original capture time");
  // Rerunning is a no-op, and a lifecycle change made in between survives it.
  updateQueueItem(legacy[0]!.id, { state: "complete" }, queue);
  const again = projectCaptureEvents(listCaptures(captures), queue);
  assert.equal(again.created, 0);
  assert.equal(readQueueItem(legacy[0]!.id, queue)?.state, "complete");
  assert.equal(pendingCount(roomQueueItems("Fiction", queue)), 0);
  // A new event written by today's code joins the same queue on the next reconcile.
  saveCapture("Fiction", "a fresh fiction idea", captures);
  assert.equal(projectCaptureEvents(listCaptures(captures), queue).created, 1);
  assert.equal(pendingCount(roomQueueItems("Fiction", queue)), 1);
});

test("the store drops rows it cannot trust instead of crashing the queue", () => {
  const root = mkdtempSync(join(tmpdir(), "room-queue-bad-"));
  const queue = join(root, "room-queue.json");
  const good: RoomQueueItem = { version: "room-queue-v1", captureId: "capture-a", room: "Charles", state: "pending", createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z", payload: { kind: "charles", groupId: null } };
  const { payload: _payload, ...noPayload } = good;
  writeFileSync(queue, JSON.stringify([
    good,
    { ...good, captureId: "capture-b", state: "bogus" as QueueState },
    { ...noPayload, captureId: "capture-c" },
    { ...good, captureId: "capture-d", payload: { series: null, ideaId: null } },
    { ...good, captureId: "capture-e", room: "Kitchen" },
    { ...good, captureId: "capture-f", createdAt: 1 },
    { version: "other" },
    null,
  ]) + "\n");
  assert.deepEqual(listQueueItems(queue), [good]);
});
