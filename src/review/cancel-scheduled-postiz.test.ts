import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { cancelScheduled, selectCancelAdapter, type CancelDeps } from "./rows.js";
import { readQueue } from "../publish/queue.js";

// cancelScheduled used to end in `else await deps.cancelPostPeerPost(logged.refId)`, so a Postiz row
// handed a Postiz post id to PostPeer's delete route: a wrong-provider call on a destructive path.
// These tests pin the explicit per-provider dispatch and the refusal that replaced the fallthrough.
// Cancel deps are stubs, so no provider is ever contacted.

const HEADER =
  "| id | platform | format | asset | native | brand | cta | status | notes |\n" +
  "|---|---|---|---|---|---|---|---|---|\n";

function tmpFolder(opts: { status?: string; logLine?: string } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "cancel-postiz-test-"));
  writeFileSync(
    join(dir, "review-queue.md"),
    HEADER + `| x-1 | x | text | derivatives/x-1.md | | | | ${opts.status ?? "approve"} | |\n`,
  );
  if (opts.logLine !== undefined) writeFileSync(join(dir, "publish-log.md"), "# Publish log\n\n" + opts.logLine + "\n");
  return dir;
}

function stubDeps(): CancelDeps & { typefullyCalls: string[]; postpeerCalls: string[]; postizCalls: string[] } {
  const typefullyCalls: string[] = [];
  const postpeerCalls: string[] = [];
  const postizCalls: string[] = [];
  return {
    typefullyCalls, postpeerCalls, postizCalls,
    cancelTypefullyDraft: async (id) => { typefullyCalls.push(id); },
    cancelPostPeerPost: async (id) => { postpeerCalls.push(id); },
    cancelPostizPost: async (id) => { postizCalls.push(id); },
  };
}

// Acceptance 4: the Postiz adapter, with the Postiz ref, and provably neither of the other two.
test("cancelScheduled: a Postiz row cancels through the Postiz adapter only", async () => {
  const folder = tmpFolder({
    logLine: "- 2026-09-12T10:27:12.838Z — x-1 → postiz post pz-live-1 (x, Sun, Sep 13, 9:30 AM PT, cta→reply)",
  });
  try {
    const deps = stubDeps();
    const row = readQueue(folder).rows.find((r) => r.id === "x-1")!;
    const res = await cancelScheduled(folder, row, deps);
    assert.deepEqual(res, { ok: true });
    assert.deepEqual(deps.postizCalls, ["pz-live-1"], "must cancel the logged Postiz post id");
    assert.deepEqual(deps.typefullyCalls, [], "must not call the Typefully adapter");
    assert.deepEqual(deps.postpeerCalls, [], "must not hand a Postiz id to PostPeer's delete route");
    assert.equal(readQueue(folder).rows[0].status, "discard");
    assert.match(readFileSync(join(folder, "publish-log.md"), "utf8"), /x-1 → canceled \(postiz ref pz-live-1/);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("cancelScheduled: a Postiz cancel that throws surfaces the error and leaves the row approved", async () => {
  const folder = tmpFolder({ logLine: "- 2026-09-12T10:27:12.838Z — x-1 → postiz post pz-live-1 (x)" });
  try {
    const deps: CancelDeps = {
      cancelTypefullyDraft: async () => {},
      cancelPostPeerPost: async () => {},
      cancelPostizPost: async () => { throw new Error("Postiz DELETE /api/public/v1/posts/pz-live-1 failed (500)"); },
    };
    const row = readQueue(folder).rows.find((r) => r.id === "x-1")!;
    const res = await cancelScheduled(folder, row, deps);
    assert.equal(res.ok, false);
    assert.match(res.error!, /failed \(500\)/);
    assert.equal(readQueue(folder).rows[0].status, "approve", "a failed cancel must not flip the row to discard");
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

// Acceptance 5: anything not positively identified refuses, and calls nothing.
test("selectCancelAdapter: an unrecognized provider refuses by name and returns no adapter", () => {
  const deps = stubDeps();
  const picked = selectCancelAdapter("somefutureprovider", deps);
  assert.ok("refusal" in picked, "an unrecognized provider must never resolve to an adapter");
  assert.match(picked.refusal, /somefutureprovider/, "the refusal names the provider");
  assert.match(picked.refusal, /by hand/);
  assert.deepEqual(deps.typefullyCalls, []);
  assert.deepEqual(deps.postpeerCalls, []);
  assert.deepEqual(deps.postizCalls, []);
});

test("selectCancelAdapter: the empty and undefined provider cases refuse rather than falling through", () => {
  const deps = stubDeps();
  for (const provider of ["", "postpee", "postizz", "upload-post"]) {
    const picked = selectCancelAdapter(provider, deps);
    assert.ok("refusal" in picked, `${provider || "(empty)"} must not resolve to an adapter`);
  }
  assert.deepEqual(deps.typefullyCalls, []);
  assert.deepEqual(deps.postpeerCalls, []);
  assert.deepEqual(deps.postizCalls, []);
});

// Acceptance 6 (cancel half): each known provider maps to its own adapter and no other.
test("selectCancelAdapter: each known provider maps to exactly its own adapter", async () => {
  const deps = stubDeps();
  const typefully = selectCancelAdapter("typefully", deps);
  const postpeer = selectCancelAdapter("postpeer", deps);
  const postiz = selectCancelAdapter("postiz", deps);
  assert.ok("cancel" in typefully && "cancel" in postpeer && "cancel" in postiz);
  await typefully.cancel("tf-1");
  assert.deepEqual(deps.typefullyCalls, ["tf-1"]);
  assert.deepEqual(deps.postpeerCalls, []);
  assert.deepEqual(deps.postizCalls, []);
  await postpeer.cancel("pp-1");
  assert.deepEqual(deps.postpeerCalls, ["pp-1"]);
  assert.deepEqual(deps.postizCalls, []);
  await postiz.cancel("pz-1");
  assert.deepEqual(deps.postizCalls, ["pz-1"]);
  assert.deepEqual(deps.typefullyCalls, ["tf-1"]);
  assert.deepEqual(deps.postpeerCalls, ["pp-1"]);
});
