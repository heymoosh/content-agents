import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { listWaitingRows, runPublishDrainOnce, type WaitingRow } from "./publish-drain.js";
import { appendPublishingStatus, readPublishingStatuses } from "./publishing-status.js";
import type { QueueRow } from "../publish/queue.js";

const roots: string[] = [];
after(() => { for (const r of roots) rmSync(r, { recursive: true, force: true }); });
const priorPostiz = process.env.CONTENT_AGENTS_POSTIZ_ACCOUNT_ID;
const priorTypefully = process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID;
process.env.CONTENT_AGENTS_POSTIZ_ACCOUNT_ID = "human-inference/postiz";
process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID = "human-inference/typefully";
after(() => {
  if (priorPostiz === undefined) delete process.env.CONTENT_AGENTS_POSTIZ_ACCOUNT_ID; else process.env.CONTENT_AGENTS_POSTIZ_ACCOUNT_ID = priorPostiz;
  if (priorTypefully === undefined) delete process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID; else process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID = priorTypefully;
});

const RATE_LIMIT = (at: string) => `Postiz rate limit reached (429): the create-post endpoint allows 90 requests per hour across the whole instance, and each schedule or move counts as one. Nothing was created. Studio resumes the waiting rows automatically after ${at}.`;

function contentRoot(): { root: string; ledger: string; health: string } {
  const root = mkdtempSync(join(tmpdir(), "publish-drain-")); roots.push(root);
  return { root: join(root, "content"), ledger: join(root, "ledger.jsonl"), health: join(root, "health.json") };
}
function piece(root: string, slug: string, id: string, status: string): { folder: string; row: QueueRow } {
  const folder = join(root, slug);
  mkdirSync(join(folder, "derivatives"), { recursive: true });
  writeFileSync(join(folder, "content-request.json"), JSON.stringify({ origin: "human-inference" }));
  writeFileSync(join(folder, "derivatives", `${id}.md`), "---\nplatform: x\n---\n\nApproved body.\n");
  writeFileSync(join(folder, "review-queue.md"), [
    "# Review queue", "",
    "| id | platform | format | asset | score | pillar | cta | status | notes |",
    "|---|---|---|---|---|---|---|---|---|",
    `| ${id} | x | text | derivatives/${id}.md | 8 | human-ai |  | ${status} |  |`, "",
  ].join("\n"));
  const row: QueueRow = { id, platform: "x", format: "text", asset: `derivatives/${id}.md`, status, notes: "", lineIndex: 4 };
  return { folder, row };
}
const failed = (slug: string, rowId: string, at: string, ledger: string) =>
  appendPublishingStatus({ slug, rowId, provider: "postiz", state: "failed", at: "2026-09-02T18:10:00.000Z", error: RATE_LIMIT(at) }, ledger);

test("only approved rows whose last attempt was a Postiz rate limit are waiting", () => {
  const { root, ledger } = contentRoot();
  piece(root, "a", "x-1", "approve"); failed("a", "x-1", "2026-09-02T19:10:00.000Z", ledger);
  piece(root, "b", "x-1", "pending"); failed("b", "x-1", "2026-09-02T19:10:00.000Z", ledger);
  piece(root, "c", "x-1", "approve");
  appendPublishingStatus({ slug: "c", rowId: "x-1", provider: "postiz", state: "failed", at: "2026-09-02T18:10:00.000Z", error: "provider selection failed before dispatch" }, ledger);
  piece(root, "d", "x-1", "approve");
  appendPublishingStatus({ slug: "d", rowId: "x-1", provider: "postiz", state: "uncertain", at: "2026-09-02T18:10:00.000Z", error: "network timeout" }, ledger);
  piece(root, "e", "x-1", "approve");
  appendPublishingStatus({ slug: "e", rowId: "x-1", provider: "typefully", state: "failed", at: "2026-09-02T18:10:00.000Z", error: RATE_LIMIT("2026-09-02T19:10:00.000Z") }, ledger);
  const waiting = listWaitingRows({ contentRoot: root, ledgerPath: ledger });
  assert.deepEqual(waiting.map((w) => [w.slug, w.retryAt]), [["a", "2026-09-02T19:10:00.000Z"]]);
});

test("the drain waits until the resume time, then dispatches once per row and stops at the next 429", async () => {
  const { root, ledger, health } = contentRoot();
  const a = piece(root, "a", "x-1", "approve"); failed("a", "x-1", "2026-09-02T19:10:00.000Z", ledger);
  const b = piece(root, "b", "x-1", "approve"); failed("b", "x-1", "2026-09-02T19:10:00.000Z", ledger);
  const c = piece(root, "c", "x-1", "approve"); failed("c", "x-1", "2026-09-02T19:10:00.000Z", ledger);
  void a; void b; void c;
  const calls: string[] = [];
  let clock = new Date("2026-09-02T18:30:00.000Z");
  const deps = {
    contentRoot: root, ledgerPath: ledger, healthPath: health, now: () => clock,
    // Provider selection resolves to Postiz exactly as the live path does, so the ledger events the
    // drainer writes are Postiz events and remain eligible for the next pass.
    selectionDeps: {
      postizEnv: { POSTIZ_ACCOUNT_ID: "acct-1" },
      fetchPostizRegistry: async () => ({ fetchedAt: "2026-01-01T00:00:00Z", capabilities: [{ destination: "x" as const, media: ["text" as const], accountId: "acct-1", accountLabel: "Human Inference" }] }),
    },
    schedule: async (folder: string, row: QueueRow) => {
      calls.push(`${folder.split("/").pop()}/${row.id}`);
      if (calls.length === 3) return { scheduled: null, scheduleError: RATE_LIMIT("2026-09-02T20:30:00.000Z") };
      return { scheduled: { draftId: `p-${calls.length}`, when: "later", plannedFor: "2026-09-10T16:00:00.000Z" }, scheduleError: null };
    },
  };
  const early = await runPublishDrainOnce(deps);
  assert.equal(early.state, "waiting");
  assert.equal(early.waitingRows, 3);
  assert.equal(early.resumeAt, "2026-09-02T19:10:00.000Z");
  assert.deepEqual(calls, []);

  clock = new Date("2026-09-02T19:15:00.000Z");
  const second = await runPublishDrainOnce(deps);
  assert.deepEqual(calls, ["a/x-1", "b/x-1", "c/x-1"]);
  assert.equal(second.state, "waiting");
  assert.equal(second.waitingRows, 1);
  assert.equal(second.drained, 2);
  assert.equal(second.resumeAt, "2026-09-02T20:30:00.000Z");
  const persisted = JSON.parse(readFileSync(health, "utf8"));
  assert.equal(persisted.resumeAt, "2026-09-02T20:30:00.000Z");
  const statuses = readPublishingStatuses(ledger);
  assert.notEqual(statuses["a/x-1"].state, "failed");
  assert.equal(statuses["c/x-1"].state, "failed");

  clock = new Date("2026-09-02T20:35:00.000Z");
  const third = await runPublishDrainOnce(deps);
  assert.deepEqual(calls, ["a/x-1", "b/x-1", "c/x-1", "c/x-1"]);
  assert.equal(third.state, "ok");
  assert.equal(third.waitingRows, 0);
  const fourth = await runPublishDrainOnce(deps);
  assert.deepEqual(calls.length, 4, "a drained row is never dispatched twice");
  assert.equal(fourth.state, "ok");
});

test("an injected waiting list bypasses the content scan", async () => {
  const { root, ledger, health } = contentRoot();
  const list: WaitingRow[] = [];
  const result = await runPublishDrainOnce({ contentRoot: root, ledgerPath: ledger, healthPath: health, listWaiting: () => list });
  assert.equal(result.state, "ok");
});
