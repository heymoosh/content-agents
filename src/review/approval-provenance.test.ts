import { mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { after, afterEach, before, test } from "node:test";
import assert from "node:assert/strict";
import { appendRows, readQueue, writeCell } from "../publish/queue.js";
import { approvalSchedulingBlock, commitReviewStatus, journalPathForLedger, recordNewQueueRows } from "./approval-provenance.js";
import { appendPublishingStatus, resolvePublishingAttempt, scheduleApprovedOnce } from "./publishing-status.js";

const roots: string[] = [];
const execFileAsync = promisify(execFile);
const priorTypefullyAccount = process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID;
before(() => { process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID = "human-inference/typefully"; });
after(() => { if (priorTypefullyAccount === undefined) delete process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID; else process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID = priorTypefullyAccount; });
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function fixture(): { folder: string; slug: string; ledger: string; journal: string } {
  const folder = mkdtempSync(join(tmpdir(), "approval-provenance-")); roots.push(folder);
  const slug = folder.split("/").at(-1)!;
  mkdirSync(join(folder, "derivatives"));
  writeFileSync(join(folder, "content-request.json"), JSON.stringify({ origin: "human-inference" }));
  writeFileSync(join(folder, "derivatives", "x-1.md"), "---\nplatform: x\n---\n\nFirst approved body.\n");
  writeFileSync(join(folder, "review-queue.md"), "| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |\n|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|\n| x-1 | x | text | derivatives/x-1.md | — | — | — | pending | | from GUI queue |\n");
  const ledger = join(folder, "ledger.jsonl");
  const journal = journalPathForLedger(ledger);
  recordNewQueueRows(folder, readQueue(folder).rows, journal);
  return { folder, slug, ledger, journal };
}

function approve(item: ReturnType<typeof fixture>): void {
  const ok = commitReviewStatus(item.folder, item.slug, "x-1", "approve", () => writeCell(item.folder, "x-1", { status: "approve" }), item.ledger, item.journal);
  assert.equal(ok, true);
}

test("a supported newly-created approval is fenced before its first scheduler callback and is one-time", async () => {
  const item = fixture(); approve(item); let calls = 0;
  const result = await scheduleApprovedOnce(item.folder, item.slug, readQueue(item.folder).rows[0]!, async () => {
    calls++;
    assert.match(readFileSync(item.journal, "utf8"), /"dispatch_started"/);
    return { scheduled: { draftId: "first" }, scheduleError: null };
  }, item.ledger);
  assert.equal(calls, 1);
  assert.equal(result.scheduleError, null);
  await assert.rejects(() => scheduleApprovedOnce(item.folder, item.slug, readQueue(item.folder).rows[0]!, async () => {
    calls++; return { scheduled: { draftId: "second" }, scheduleError: null };
  }, item.ledger), /already|fence|reconcile/i);
  assert.equal(calls, 1);
});

test("a journal persistence failure calls no scheduler and leaves no fresh bypass", async () => {
  const item = fixture(); approve(item); let calls = 0;
  renameSync(item.journal, `${item.journal}.saved`); mkdirSync(item.journal);
  await assert.rejects(() => scheduleApprovedOnce(item.folder, item.slug, readQueue(item.folder).rows[0]!, async () => {
    calls++; return { scheduled: {}, scheduleError: null };
  }, item.ledger));
  assert.equal(calls, 0);
});

test("changed payloads, malformed journals, and legacy status cycles are refused", async () => {
  const item = fixture(); approve(item); let calls = 0;
  writeFileSync(join(item.folder, "derivatives", "x-1.md"), "---\nplatform: x\n---\n\nChanged after approval.\n");
  await assert.rejects(() => scheduleApprovedOnce(item.folder, item.slug, readQueue(item.folder).rows[0]!, async () => {
    calls++; return { scheduled: {}, scheduleError: null };
  }, item.ledger), /current identity|provenance/i);
  assert.equal(calls, 0);

  const malformed = fixture(); approve(malformed); writeFileSync(malformed.journal, "not json\n");
  await assert.rejects(() => scheduleApprovedOnce(malformed.folder, malformed.slug, readQueue(malformed.folder).rows[0]!, async () => {
    calls++; return { scheduled: {}, scheduleError: null };
  }, malformed.ledger), /journal is malformed/i);
  assert.equal(calls, 0);

  const badLedger = fixture(); approve(badLedger); writeFileSync(badLedger.ledger, "not json\n");
  await assert.rejects(() => scheduleApprovedOnce(badLedger.folder, badLedger.slug, readQueue(badLedger.folder).rows[0]!, async () => {
    calls++; return { scheduled: {}, scheduleError: null };
  }, badLedger.ledger), /publishing ledger is malformed/i);
  assert.equal(calls, 0);

  const legacy = fixture();
  rmSync(legacy.journal);
  writeCell(legacy.folder, "x-1", { status: "approve" });
  writeCell(legacy.folder, "x-1", { status: "pending" });
  writeCell(legacy.folder, "x-1", { status: "approve" });
  await assert.rejects(() => scheduleApprovedOnce(legacy.folder, legacy.slug, readQueue(legacy.folder).rows[0]!, async () => {
    calls++; return { scheduled: {}, scheduleError: null };
  }, legacy.ledger), /already approved|provenance|reconcile/i);
  assert.equal(calls, 0);
});

test("concurrent Schedule attempts share the durable row claim and invoke one provider callback", async () => {
  const item = fixture(); approve(item); let calls = 0; let release!: () => void;
  const entered = new Promise<void>((resolve) => { release = resolve; });
  let enteredCallback!: () => void;
  const callbackStarted = new Promise<void>((resolve) => { enteredCallback = resolve; });
  const first = scheduleApprovedOnce(item.folder, item.slug, readQueue(item.folder).rows[0]!, async () => {
    calls++; enteredCallback(); await entered; return { scheduled: { draftId: "only-one" }, scheduleError: null };
  }, item.ledger);
  await callbackStarted;
  await assert.rejects(() => scheduleApprovedOnce(item.folder, item.slug, readQueue(item.folder).rows[0]!, async () => {
    calls++; return { scheduled: { draftId: "duplicate" }, scheduleError: null };
  }, item.ledger), /another Studio process|claimed/i);
  release(); await first;
  assert.equal(calls, 1);
});

test("a second Node process cannot cross the durable row claim", async () => {
  const item = fixture(); approve(item); let release!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  let enteredCallback!: () => void;
  const callbackStarted = new Promise<void>((resolve) => { enteredCallback = resolve; });
  const first = scheduleApprovedOnce(item.folder, item.slug, readQueue(item.folder).rows[0]!, async () => {
    enteredCallback(); await waiting; return { scheduled: { draftId: "parent" }, scheduleError: null };
  }, item.ledger);
  await callbackStarted;
  const child = `import { readQueue } from "./src/publish/queue.ts";
import { scheduleApprovedOnce } from "./src/review/publishing-status.ts";
const [folder, slug, ledger] = process.argv.slice(1);
try { await scheduleApprovedOnce(folder, slug, readQueue(folder).rows[0], async () => ({ scheduled: {}, scheduleError: null }), ledger); process.exitCode = 2; }
catch (error) { console.log(error instanceof Error ? error.message : String(error)); }`;
  const output = await execFileAsync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", child, item.folder, item.slug, item.ledger], { cwd: process.cwd() });
  assert.match(output.stdout, /another Studio process|claimed/i);
  release(); await first;
});

test("an interrupted newer status or approval transition never launders an approved row", async () => {
  const statusInterrupted = fixture(); approve(statusInterrupted); let calls = 0;
  assert.equal(commitReviewStatus(statusInterrupted.folder, statusInterrupted.slug, "x-1", "pending", () => false, statusInterrupted.ledger, statusInterrupted.journal), false);
  await assert.rejects(() => scheduleApprovedOnce(statusInterrupted.folder, statusInterrupted.slug, readQueue(statusInterrupted.folder).rows[0]!, async () => {
    calls++; return { scheduled: {}, scheduleError: null };
  }, statusInterrupted.ledger), /interrupted|latest status/i);

  const approvalInterrupted = fixture();
  assert.equal(commitReviewStatus(approvalInterrupted.folder, approvalInterrupted.slug, "x-1", "pending", () => writeCell(approvalInterrupted.folder, "x-1", { status: "pending" }), approvalInterrupted.ledger, approvalInterrupted.journal), true);
  assert.equal(commitReviewStatus(approvalInterrupted.folder, approvalInterrupted.slug, "x-1", "approve", () => false, approvalInterrupted.ledger, approvalInterrupted.journal), false);
  writeCell(approvalInterrupted.folder, "x-1", { status: "approve" });
  await assert.rejects(() => scheduleApprovedOnce(approvalInterrupted.folder, approvalInterrupted.slug, readQueue(approvalInterrupted.folder).rows[0]!, async () => {
    calls++; return { scheduled: {}, scheduleError: null };
  }, approvalInterrupted.ledger), /interrupted|latest approval/i);
  assert.equal(calls, 0);
});

test("a stale failed ledger result or approval cycle cannot supersede a newer fence", async () => {
  const item = fixture(); approve(item); let calls = 0;
  await scheduleApprovedOnce(item.folder, item.slug, readQueue(item.folder).rows[0]!, async () => {
    calls++; return { scheduled: null, scheduleError: "network timeout" };
  }, item.ledger);
  appendPublishingStatus({ slug: item.slug, rowId: "x-1", provider: "typefully", state: "failed", at: new Date().toISOString(), error: "stale local result" }, item.ledger);
  assert.equal(commitReviewStatus(item.folder, item.slug, "x-1", "pending", () => writeCell(item.folder, "x-1", { status: "pending" }), item.ledger, item.journal), true);
  assert.equal(commitReviewStatus(item.folder, item.slug, "x-1", "approve", () => writeCell(item.folder, "x-1", { status: "approve" }), item.ledger, item.journal), true);
  await assert.rejects(() => scheduleApprovedOnce(item.folder, item.slug, readQueue(item.folder).rows[0]!, async () => {
    calls++; return { scheduled: {}, scheduleError: null };
  }, item.ledger), /durable dispatch fence/i);
  assert.equal(calls, 1);
});

test("an exact not-created reconciliation, and only that reconciliation, enables the next fenced attempt", async () => {
  const item = fixture(); approve(item); let calls = 0;
  await scheduleApprovedOnce(item.folder, item.slug, readQueue(item.folder).rows[0]!, async () => {
    calls++; return { scheduled: null, scheduleError: "network timeout" };
  }, item.ledger);
  assert.equal(resolvePublishingAttempt(item.slug, "x-1", "not-created", {}, item.ledger).state, "canceled");
  const retried = await scheduleApprovedOnce(item.folder, item.slug, readQueue(item.folder).rows[0]!, async () => {
    calls++; return { scheduled: { draftId: "second-attempt" }, scheduleError: null };
  }, item.ledger);
  assert.equal(retried.scheduleError, null);
  assert.equal(calls, 2);
});

test("an ordinary unattempted edit can be reapproved without treating an appended duplicate id as new", async () => {
  const item = fixture();
  assert.equal(commitReviewStatus(item.folder, item.slug, "x-1", "pending", () => writeCell(item.folder, "x-1", { status: "pending" }), item.ledger, item.journal), true);
  writeFileSync(join(item.folder, "derivatives", "x-1.md"), "---\nplatform: x\n---\n\nEdited body before approval.\n");
  assert.equal(commitReviewStatus(item.folder, item.slug, "x-1", "approve", () => writeCell(item.folder, "x-1", { status: "approve" }), item.ledger, item.journal), true);
  let calls = 0;
  await scheduleApprovedOnce(item.folder, item.slug, readQueue(item.folder).rows[0]!, async () => {
    calls++; return { scheduled: { draftId: "edited" }, scheduleError: null };
  }, item.ledger);
  assert.equal(calls, 1);
  assert.throws(() => recordNewQueueRows(item.folder, readQueue(item.folder).rows, item.journal), /already created/i);
});

test("a callback crash retains its claim through a simulated restart until exact reconciliation", async () => {
  const item = fixture(); approve(item);
  await assert.rejects(() => scheduleApprovedOnce(item.folder, item.slug, readQueue(item.folder).rows[0]!, async () => {
    throw new Error("connection dropped after provider accepted request");
  }, item.ledger), /connection dropped/i);
  const claims = join(item.folder, ".publishing-claims");
  const names = readdirSync(claims);
  assert.equal(names.length, 1, "the post-callback failure retains the durable row claim");
  const claim = join(claims, names[0]!);
  const metadata = JSON.parse(readFileSync(claim, "utf8")) as Record<string, unknown>;
  writeFileSync(claim, JSON.stringify({ ...metadata, pid: 99999999 }) + "\n");
  assert.equal(resolvePublishingAttempt(item.slug, "x-1", "not-created", {}, item.ledger).state, "canceled");
  assert.equal(readdirSync(claims).length, 0, "only reconciliation releases a retained stale-process claim");
  let calls = 0;
  await scheduleApprovedOnce(item.folder, item.slug, readQueue(item.folder).rows[0]!, async () => {
    calls++; return { scheduled: { draftId: "recovered" }, scheduleError: null };
  }, item.ledger);
  assert.equal(calls, 1);
});

test("reused identities cannot be issued a second creation record", () => {
  const item = fixture();
  assert.throws(() => recordNewQueueRows(item.folder, readQueue(item.folder).rows, item.journal), /already created/i);
  assert.match(approvalSchedulingBlock(item.folder, item.slug, readQueue(item.folder).rows[0]!, item.ledger, item.journal) ?? "", /latest approval/i);
});

test("an ambiguous terminal write leaves the dispatch fence across a restart", async () => {
  const item = fixture(); approve(item); let calls = 0;
  await assert.rejects(() => scheduleApprovedOnce(item.folder, item.slug, readQueue(item.folder).rows[0]!, async () => {
    calls++;
    rmSync(item.ledger, { force: true });
    mkdirSync(`${item.ledger}.terminal-failure`);
    renameSync(`${item.ledger}.terminal-failure`, item.ledger);
    return { scheduled: { draftId: "provider-created" }, scheduleError: null };
  }, item.ledger), /provider returned typefully object provider-created.*do not retry automatically/i);
  assert.equal(calls, 1);
  rmSync(item.ledger, { recursive: true, force: true });
  await assert.rejects(() => scheduleApprovedOnce(item.folder, item.slug, readQueue(item.folder).rows[0]!, async () => {
    calls++; return { scheduled: {}, scheduleError: null };
  }, item.ledger), /fence|reconcile/i);
  assert.equal(calls, 1);
});

test("canonical append records only a physically new identity with its completed derivative", () => {
  const item = fixture();
  writeFileSync(join(item.folder, "derivatives", "x-2.md"), "---\nplatform: x\n---\n\nSecond.\n");
  appendRows(item.folder, [{ id: "x-2", platform: "x", format: "text", asset: "derivatives/x-2.md", status: "pending" }]);
  assert.throws(() => appendRows(item.folder, [{ id: "x-2", platform: "x", format: "text", asset: "derivatives/x-2.md", status: "pending" }]), /already exists/i);
});
