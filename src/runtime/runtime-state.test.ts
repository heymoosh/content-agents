import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { dataRoot, migrateLegacyDataFile } from "./data-root.js";
import { withFileLock } from "./file-lock.js";
import { acquireJobExecutionLease, readDurableJobs, recoverAbandonedJobs } from "./durable-jobs.js";
import { spawn } from "node:child_process";

const roots: string[] = [];
afterEach(() => { delete process.env.CONTENT_AGENTS_DATA_ROOT; for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

test("CONTENT_AGENTS_DATA_ROOT selects the operational root", () => {
  const root = join(tmpdir(), `content-agents-root-${randomUUID()}`); roots.push(root);
  process.env.CONTENT_AGENTS_DATA_ROOT = root;
  assert.equal(dataRoot(), root);
});

test("legacy repo data is copied once into the operational root and remains readable", () => {
  const root = join(tmpdir(), `content-agents-root-${randomUUID()}`), legacy = join(tmpdir(), `content-agents-legacy-${randomUUID()}`);
  roots.push(root, legacy); mkdirSync(legacy); process.env.CONTENT_AGENTS_DATA_ROOT = root;
  writeFileSync(join(legacy, "publishing-status.jsonl"), "legacy\n");
  const migrated = migrateLegacyDataFile(["publishing-status.jsonl"], legacy);
  assert.equal(readFileSync(migrated, "utf8"), "legacy\n");
  writeFileSync(join(legacy, "publishing-status.jsonl"), "changed\n");
  assert.equal(readFileSync(migrateLegacyDataFile(["publishing-status.jsonl"], legacy), "utf8"), "legacy\n", "canonical state wins after migration");
});

test("a dead stale lock is reclaimed and removed after the transaction", () => {
  const root = join(tmpdir(), `content-agents-lock-${randomUUID()}`); roots.push(root); mkdirSync(root);
  const lock = join(root, "scheduler.lock");
  writeFileSync(lock, JSON.stringify({ pid: 999_999_999, createdAt: 1 }));
  assert.equal(withFileLock(lock, () => "claimed", { staleMs: 1 }), "claimed");
  assert.equal(existsSync(lock), false);
});

test("startup recovery fails queued and running records closed but preserves terminals", () => {
  const records = [
    { id: "q", kind: "strategy", label: "q", status: "queued" },
    { id: "r", kind: "strategy", label: "r", status: "running" },
    { id: "d", kind: "strategy", label: "d", status: "done" },
  ];
  const recovered = recoverAbandonedJobs(records, 42, () => false);
  assert.deepEqual(recovered.map((record) => record.status), ["failed", "failed", "done"]);
  assert.equal(recovered[0]?.retryable, false);
  assert.equal(recovered[0]?.finishedAt, 42);
});

test("concurrent process enqueues use locked record mutations without losing jobs", async () => {
  const root = join(tmpdir(), `content-agents-jobs-${randomUUID()}`); roots.push(root);
  const store = join(root, "jobs.json");
  const moduleUrl = new URL("./durable-jobs.ts", import.meta.url).href;
  const children = Array.from({ length: 8 }, (_, index) => new Promise<void>((resolve, reject) => {
    const code = `import { upsertDurableJob } from ${JSON.stringify(moduleUrl)}; upsertDurableJob({id:${JSON.stringify(`child-${index}`)},kind:'strategy',label:'child',status:'queued',ownerPid:process.pid});`;
    const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", code], {
      env: { ...process.env, CONTENT_AGENTS_TEST_JOB_STORE: store }, stdio: "ignore",
    });
    child.once("error", reject); child.once("exit", (status) => status === 0 ? resolve() : reject(new Error(`child exited ${status}`)));
  }));
  await Promise.all(children);
  process.env.CONTENT_AGENTS_TEST_JOB_STORE = store;
  assert.deepEqual(readDurableJobs().map((job) => job.id).sort(), Array.from({ length: 8 }, (_, index) => `child-${index}`).sort());
  delete process.env.CONTENT_AGENTS_TEST_JOB_STORE;
});

test("execution lease has one owner and recovers only a dead stale owner", () => {
  const root = join(tmpdir(), `content-agents-lease-${randomUUID()}`); roots.push(root);
  process.env.CONTENT_AGENTS_TEST_JOB_STORE = join(root, "jobs.json");
  const first = acquireJobExecutionLease(); assert.ok(first);
  assert.equal(acquireJobExecutionLease(), null);
  first.release();
  mkdirSync(root, { recursive: true });
  writeFileSync(`${process.env.CONTENT_AGENTS_TEST_JOB_STORE}.execute.lock`, JSON.stringify({ pid: 999_999_999, createdAt: 1, token: "dead" }));
  const next = acquireJobExecutionLease(); assert.ok(next); next.release();
  delete process.env.CONTENT_AGENTS_TEST_JOB_STORE;
});
