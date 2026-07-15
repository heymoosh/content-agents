import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { cancelScheduled, type CancelDeps } from "./rows.js";
import { readQueue } from "../publish/queue.js";

// cancelScheduled (card e4eca4a1) is the review GUI "Cancel" action's server half: it dispatches a
// row's logged provider ref (findLoggedRef against publish-log.md) to the right live cancel call,
// flips the row to "discard", and audit-logs the cancellation — or degrades gracefully for the
// retired Upload-Post provider. These tests inject fake cancel deps so no real network call fires,
// and use a real temp folder so the queue-write + publish-log-append side effects are provable.

const HEADER =
  "| id | platform | format | asset | native | brand | cta | status | notes |\n" +
  "|---|---|---|---|---|---|---|---|---|\n";

// An approved text row qualifies for reconciliation (needsReconciliation), so it's cancelable.
function tmpFolder(opts: { status?: string; logLine?: string } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "cancel-sched-test-"));
  const status = opts.status ?? "approve";
  writeFileSync(
    join(dir, "review-queue.md"),
    HEADER + `| x-1 | x | text | derivatives/x-1.md | | | | ${status} | |\n`,
  );
  if (opts.logLine !== undefined) {
    writeFileSync(join(dir, "publish-log.md"), "# Publish log\n\n" + opts.logLine + "\n");
  }
  return dir;
}

function stubDeps(): CancelDeps & { typefullyCalls: string[]; postpeerCalls: string[] } {
  const typefullyCalls: string[] = [];
  const postpeerCalls: string[] = [];
  return {
    typefullyCalls,
    postpeerCalls,
    cancelTypefullyDraft: async (id) => { typefullyCalls.push(id); },
    cancelPostPeerPost: async (id) => { postpeerCalls.push(id); },
  };
}

test("cancelScheduled: a Typefully row cancels the logged draft, flips to discard, and audit-logs", async () => {
  const folder = tmpFolder({ logLine: "- 2026-07-10T00:00:00.000Z — x-1 → typefully draft draft-777" });
  try {
    const deps = stubDeps();
    const row = readQueue(folder).rows.find((r) => r.id === "x-1")!;
    const res = await cancelScheduled(folder, row, deps);
    assert.deepEqual(res, { ok: true });
    assert.deepEqual(deps.typefullyCalls, ["draft-777"], "must cancel the logged draft id");
    assert.deepEqual(deps.postpeerCalls, [], "must not touch PostPeer for a Typefully row");
    assert.equal(readQueue(folder).rows[0].status, "discard", "row flips to discard, never back to pending");
    const log = readFileSync(join(folder, "publish-log.md"), "utf8");
    assert.match(log, /x-1 → canceled \(typefully ref draft-777/);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("cancelScheduled: a PostPeer (TikTok) row cancels the logged post", async () => {
  const folder = tmpFolder({ logLine: "- 2026-07-10T00:00:00.000Z — x-1 → postpeer post pp-42" });
  try {
    const deps = stubDeps();
    const row = readQueue(folder).rows.find((r) => r.id === "x-1")!;
    const res = await cancelScheduled(folder, row, deps);
    assert.deepEqual(res, { ok: true });
    assert.deepEqual(deps.postpeerCalls, ["pp-42"]);
    assert.deepEqual(deps.typefullyCalls, []);
    assert.equal(readQueue(folder).rows[0].status, "discard");
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("cancelScheduled: a retired Upload-Post row degrades to a dashboard pointer, no cancel call, no status change", async () => {
  const folder = tmpFolder({ logLine: "- 2026-07-10T00:00:00.000Z — x-1 → upload-post job up-9" });
  try {
    const deps = stubDeps();
    const row = readQueue(folder).rows.find((r) => r.id === "x-1")!;
    const res = await cancelScheduled(folder, row, deps);
    assert.equal(res.ok, false);
    assert.match(res.error!, /upload-post\.com/, "must point Muxin at the external dashboard");
    assert.deepEqual(deps.typefullyCalls, []);
    assert.deepEqual(deps.postpeerCalls, []);
    assert.equal(readQueue(folder).rows[0].status, "approve", "must NOT flip a row it couldn't actually cancel");
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("cancelScheduled: a row with no logged provider ref returns an error, no cancel call", async () => {
  const folder = tmpFolder({ logLine: "# no matching row line" });
  try {
    const deps = stubDeps();
    const row = readQueue(folder).rows.find((r) => r.id === "x-1")!;
    const res = await cancelScheduled(folder, row, deps);
    assert.equal(res.ok, false);
    assert.match(res.error!, /no logged provider/i);
    assert.deepEqual(deps.typefullyCalls, []);
    assert.deepEqual(deps.postpeerCalls, []);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("cancelScheduled: a non-scheduled (pending) row is rejected before any provider call", async () => {
  const folder = tmpFolder({ status: "pending", logLine: "- 2026-07-10T00:00:00.000Z — x-1 → typefully draft draft-777" });
  try {
    const deps = stubDeps();
    const row = readQueue(folder).rows.find((r) => r.id === "x-1")!;
    const res = await cancelScheduled(folder, row, deps);
    assert.equal(res.ok, false);
    assert.match(res.error!, /isn't a scheduled post/);
    assert.deepEqual(deps.typefullyCalls, []);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("cancelScheduled: a provider cancel that throws surfaces the error and leaves the row scheduled", async () => {
  const folder = tmpFolder({ logLine: "- 2026-07-10T00:00:00.000Z — x-1 → typefully draft draft-777" });
  try {
    const deps: CancelDeps = {
      cancelTypefullyDraft: async () => { throw new Error("typefully DELETE → 500 boom"); },
      cancelPostPeerPost: async () => {},
    };
    const row = readQueue(folder).rows.find((r) => r.id === "x-1")!;
    const res = await cancelScheduled(folder, row, deps);
    assert.equal(res.ok, false);
    assert.match(res.error!, /500 boom/);
    assert.equal(readQueue(folder).rows[0].status, "approve", "a failed cancel must not flip the row to discard");
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
