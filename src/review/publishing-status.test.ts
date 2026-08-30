import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { publishingRetryBlock, readPublishingStatuses, resolvePublishingAttempt, scheduleApprovedOnce } from "./publishing-status.js";
import type { QueueRow } from "../publish/queue.js";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function ledger(): string { const root = mkdtempSync(join(tmpdir(), "publishing-status-")); roots.push(root); return join(root, "ledger.jsonl"); }
const row: QueueRow = { id: "x-1", platform: "x", format: "text", asset: "derivatives/x-1.md", status: "pending", notes: "", lineIndex: 2 };

describe("durable publishing status", () => {
  test("records provider, reference, planned time, and prevents a repeat schedule", async () => {
    const path = ledger(); let calls = 0;
    const first = await scheduleApprovedOnce("/tmp/content/piece", "piece", row, async () => {
      calls++; return { scheduled: { id: "x-1", platform: "x", when: "Monday 9:00 AM", draftId: "tf-1" }, scheduleError: null };
    }, path);
    assert.equal(first.publishing.state, "scheduled");
    assert.equal(first.publishing.provider, "typefully");
    assert.equal(first.publishing.ref, "tf-1");
    assert.equal(first.publishing.plannedFor, "Monday 9:00 AM");
    assert.throws(() => resolvePublishingAttempt("piece", "x-1", "not-created", {}, path), /no uncertain/i,
      "a completed scheduled event can never be overwritten by a cleared retry state");
    await assert.rejects(() => scheduleApprovedOnce("/tmp/content/piece", "piece", row, async () => {
      calls++; return { scheduled: null, scheduleError: null };
    }, path), /already|uncertain/i);
    assert.equal(calls, 1);
    assert.equal(readPublishingStatuses(path)["piece/x-1"]?.state, "scheduled");
  });

  test("persists uncertain failures so a blind retry cannot duplicate an accepted provider request", async () => {
    const path = ledger();
    const result = await scheduleApprovedOnce("/tmp/content/piece", "piece", row, async () => ({ scheduled: null, scheduleError: "network timeout" }), path);
    assert.equal(result.publishing.state, "uncertain");
    assert.equal(result.publishing.error, "network timeout");
    await assert.rejects(() => scheduleApprovedOnce("/tmp/content/piece", "piece", row, async () => ({ scheduled: null, scheduleError: null }), path), /uncertain/i);
    const cleared = resolvePublishingAttempt("piece", "x-1", "not-created", {}, path);
    assert.equal(cleared.state, "cleared");
    assert.equal(publishingRetryBlock("piece", { ...row, status: "approve" }, path), null);
  });

  test("a human-confirmed provider result records the item without retrying", async () => {
    const path = ledger();
    await scheduleApprovedOnce("/tmp/content/piece", "piece", row, async () => ({ scheduled: null, scheduleError: "connection ended" }), path);
    const found = resolvePublishingAttempt("piece", "x-1", "exists", { ref: "tf-9", plannedFor: "Tomorrow" }, path);
    assert.equal(found.state, "scheduled");
    assert.equal(found.ref, "tf-9");
    assert.match(publishingRetryBlock("piece", { ...row, status: "approve" }, path) ?? "", /scheduled/i);
  });

  test("an atomic claim blocks a second Studio process while the first provider call is open", async () => {
    const path = ledger();
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => { release = resolve; });
    const first = scheduleApprovedOnce("/tmp/content/piece", "piece", row, async () => {
      await waiting;
      return { scheduled: { when: "Tomorrow", draftId: "tf-1" }, scheduleError: null };
    }, path);
    const claims = join(dirname(path), ".publishing-claims");
    const lock = join(claims, readdirSync(claims)[0]);
    const claim = JSON.parse(readFileSync(lock, "utf8"));
    writeFileSync(lock, JSON.stringify({ ...claim, claimedAt: "2000-01-01T00:00:00.000Z" }) + "\n");
    assert.throws(() => resolvePublishingAttempt("piece", "x-1", "not-created", {}, path), /still active/i,
      "a live PID stays active even when the timestamp is old");
    await assert.rejects(() => scheduleApprovedOnce("/tmp/content/piece", "piece", row, async () => ({ scheduled: null, scheduleError: null }), path), /another Studio process|already.*claim/i);
    release();
    await first;
  });

  test("an already-approved legacy row is never blindly rescheduled without reconciliation", () => {
    assert.match(publishingRetryBlock("piece", { ...row, status: "approve" }, ledger()) ?? "", /already approved/i);
  });
});
