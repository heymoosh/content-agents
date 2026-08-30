import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { cancelPostizPost, createPostizPost, fetchPostizCapabilities, readPostizPost, reconcilePostizPost, resolveConfiguredPostizCapability, selectDeliveryRoute, type PostizTransport } from "./postiz.js";
import { assertLiveCanaryGate, runPostizLifecycleCanary } from "./postiz-canary.js";
import { runCanaryMatrix } from "./canary-matrix.js";

function transport(responses: unknown[]): { client: PostizTransport; calls: Array<{ path: string; init?: RequestInit }> } {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  return { calls, client: { async request(path, init) { calls.push({ path, init }); return responses.shift(); } } };
}

describe("Postiz capability-first routing", () => {
  test("uses discovered Postiz support first and keeps explicit fallbacks", async () => {
    const { client } = transport([{ integrations: [{ platform: "x", capabilities: ["text", "image"], id: "acct-1", name: "Human Inference" }] }]);
    const registry = await fetchPostizCapabilities(client, new Date("2026-08-30T12:00:00Z"));
    assert.equal(selectDeliveryRoute(registry, "x", "image"), "postiz");
    assert.equal(selectDeliveryRoute(registry, "linkedin", "text"), "typefully");
    assert.equal(selectDeliveryRoute(registry, "tiktok", "video"), "postpeer");
    assert.equal(selectDeliveryRoute(registry, "youtube", "video"), "youtube");
    assert.equal(selectDeliveryRoute(registry, "substack", "text"), "substack");
    assert.equal(resolveConfiguredPostizCapability(registry, "x", "text", { POSTIZ_ACCOUNT_ID: "acct-1" }).accountLabel, "Human Inference");
    assert.throws(() => resolveConfiguredPostizCapability(registry, "x", "video", { POSTIZ_ACCOUNT_ID: "acct-1" }), /does not advertise/);
  });

  test("refuses inferred capabilities", async () => {
    const { client } = transport([{ integrations: [{ platform: "x", id: "acct-1", name: "HI" }] }]);
    await assert.rejects(fetchPostizCapabilities(client), /explicit media capabilities/);
  });
});

describe("Postiz stable lifecycle contract", () => {
  test("create/read/cancel/reconcile preserve stable ids, urls, and statuses", async () => {
    const { client, calls } = transport([
      { id: "post-7", url: "https://social.example/post-7", status: "scheduled", scheduledAt: "2026-09-01T12:00:00Z" },
      { id: "post-7", postUrl: "https://social.example/post-7", state: "private", publishDate: "2026-09-01T12:00:00Z" },
      { id: "post-7", status: "canceled" },
      { id: "post-7", status: "canceled" },
    ]);
    const input = { destination: "x", accountId: "acct-1", content: "approved canary", scheduledAt: "2026-09-01T12:00:00Z", visibility: "scheduled" } as const;
    assert.equal((await createPostizPost(client, input, new Date("2026-08-30T12:00:00Z"))).id, "post-7");
    assert.equal((await readPostizPost(client, "post-7")).url, "https://social.example/post-7");
    assert.equal((await cancelPostizPost(client, "post-7")).status, "canceled");
    assert.equal((await reconcilePostizPost(client, "post-7")).id, "post-7");
    assert.deepEqual(calls.map((call) => [call.init?.method ?? "GET", call.path]), [
      ["POST", "/api/public/v1/posts"], ["GET", "/api/public/v1/posts/post-7"],
      ["DELETE", "/api/public/v1/posts/post-7"], ["GET", "/api/public/v1/posts/post-7"],
    ]);
  });

  test("never creates an immediate or past post", async () => {
    const { client, calls } = transport([]);
    await assert.rejects(createPostizPost(client, { destination: "x", accountId: "a", content: "x", scheduledAt: "2026-08-29T00:00:00Z", visibility: "scheduled" }, new Date("2026-08-30T00:00:00Z")), /future/);
    assert.equal(calls.length, 0);
  });
});

describe("live-canary gate", () => {
  const input = { destination: "x", accountId: "a", content: "approved", scheduledAt: "2026-09-01T00:00:00Z", visibility: "draft" } as const;
  const approval = { approvedBy: "Muxin", approvedAt: "2026-08-30T00:00:00Z", evidence: "review-record-123" };
  test("requires both the kill-switch and durable approval evidence", () => {
    assert.throws(() => assertLiveCanaryGate(input, approval, {}, new Date("2026-08-30T00:00:00Z")), /CANARY_I_MEAN_IT/);
    assert.throws(() => assertLiveCanaryGate(input, { ...approval, evidence: "" }, { CANARY_I_MEAN_IT: "1" }, new Date("2026-08-30T00:00:00Z")), /approval evidence/);
    assert.doesNotThrow(() => assertLiveCanaryGate(input, approval, { CANARY_I_MEAN_IT: "1" }, new Date("2026-08-30T00:00:00Z")));
    assert.throws(() => assertLiveCanaryGate({ ...input, visibility: "scheduled" }, approval, { CANARY_I_MEAN_IT: "1" }, new Date("2026-08-30T00:00:00Z")), /scheduled is prohibited/);
  });

  test("composes a gated create/read/cancel/reconcile harness lifecycle", async () => {
    const { client, calls } = transport([
      { id: "canary-1", status: "draft" }, { id: "canary-1", status: "draft" },
      { id: "canary-1", status: "canceled" }, { id: "canary-1", status: "canceled" },
    ]);
    const root = mkdtempSync(join(tmpdir(), "postiz-canary-"));
    const result = await runPostizLifecycleCanary(client, input, approval, { CANARY_I_MEAN_IT: "1" }, new Date("2026-08-30T00:00:00Z"), { cleanupLedgerPath: join(root, "cleanup.jsonl"), emitRecovery: () => {} });
    assert.equal(result.reconciled.status, "canceled");
    assert.equal(calls.length, 4);
    rmSync(root, { recursive: true, force: true });
  });

  for (const scenario of ["read throw", "ID mismatch", "cancel failure"] as const) {
    test(`${scenario} retains a process-visible stable recovery id and attempts cleanup`, async () => {
      const root = mkdtempSync(join(tmpdir(), "postiz-canary-"));
      const ledger = join(root, "cleanup.jsonl"); const emitted: string[] = []; const calls: string[] = [];
      const client: PostizTransport = { async request(path, init) {
        calls.push(`${init?.method ?? "GET"} ${path}`);
        if (init?.method === "POST") return { id: "recover-7", status: "draft" };
        if (init?.method === "DELETE") {
          if (scenario === "cancel failure") throw new Error("cancel offline");
          return { id: "recover-7", status: "canceled" };
        }
        if (calls.filter((call) => call.startsWith("GET")).length === 1) {
          if (scenario === "read throw") throw new Error("read offline");
          return { id: scenario === "ID mismatch" ? "wrong-id" : "recover-7", status: "draft" };
        }
        return { id: "recover-7", status: "canceled" };
      } };
      await assert.rejects(runPostizLifecycleCanary(client, input, approval, { CANARY_I_MEAN_IT: "1" }, new Date("2026-08-30T00:00:00Z"), {
        cleanupLedgerPath: ledger, emitRecovery: (event) => emitted.push(event.providerObjectId),
      }));
      assert.equal(emitted[0], "recover-7", "recovery id must be emitted immediately after create");
      assert.match(readFileSync(ledger, "utf8"), /"cleanupRequired":true/);
      assert.ok(calls.some((call) => call.startsWith("DELETE")), "cleanup must be attempted in finally");
      rmSync(root, { recursive: true, force: true });
    });
  }

  test("recovery id is process-visible and cleanup runs even when durable evidence persistence fails", async () => {
    const root = mkdtempSync(join(tmpdir(), "postiz-canary-")); const emitted: string[] = [];
    const { client, calls } = transport([{ id: "recover-9", status: "draft" }, { id: "recover-9", status: "canceled" }, { id: "recover-9", status: "canceled" }]);
    await assert.rejects(runPostizLifecycleCanary(client, input, approval, { CANARY_I_MEAN_IT: "1" }, new Date("2026-08-30T00:00:00Z"), {
      cleanupLedgerPath: root, emitRecovery: (event) => emitted.push(event.providerObjectId),
    }));
    assert.equal(emitted[0], "recover-9");
    assert.ok(calls.some((call) => call.init?.method === "DELETE"));
    rmSync(root, { recursive: true, force: true });
  });

  test("does not clear cleanupRequired until cancellation reconciles terminal", async () => {
    const root = mkdtempSync(join(tmpdir(), "postiz-canary-"));
    const ledger = join(root, "cleanup.jsonl");
    const { client } = transport([
      { id: "pending-1", status: "draft" }, { id: "pending-1", status: "draft" },
      { id: "pending-1", status: "canceled" }, { id: "pending-1", status: "draft" },
    ]);
    await assert.rejects(runPostizLifecycleCanary(client, input, approval, { CANARY_I_MEAN_IT: "1" }, new Date("2026-08-30T00:00:00Z"), { cleanupLedgerPath: ledger, emitRecovery: () => {} }), /not terminal/);
    const events = readFileSync(ledger, "utf8").trim().split("\n").map((line) => JSON.parse(line) as { cleanupRequired: boolean });
    assert.ok(events.every((event) => event.cleanupRequired), "no false cleanup event may be recorded");
    rmSync(root, { recursive: true, force: true });
  });
});

describe("attended publish canary matrix", () => {
  const approval = { approvedBy: "Muxin", approvedAt: "2026-08-30T00:00:00Z", evidence: "review-record-123" };
  const registry = { fetchedAt: "2026-08-30T00:00:00Z", capabilities: [
    { destination: "x", media: ["text"], accountId: "acct-1", accountLabel: "HI" },
  ] } as const;

  test("proves Postiz-first, Typefully fallback, and records other providers as exceptions", async () => {
    const calls: string[] = [];
    const evidence = await runCanaryMatrix(registry, [
      { destination: "x", media: "text" },
      { destination: "linkedin", media: "image" },
      { destination: "youtube", media: "video", expectedExceptionRoute: "youtube" },
    ], approval, {
      postiz: async (item) => { calls.push(`postiz:${item.destination}/${item.media}`); return { providerObjectId: "pz-1", cleanupTerminal: true }; },
      typefully: async (item) => { calls.push(`typefully:${item.destination}/${item.media}`); return { providerObjectId: "tf-1", cleanupTerminal: true }; },
    }, { CANARY_I_MEAN_IT: "1", POSTIZ_ACCOUNT_ID: "acct-1" });
    assert.deepEqual(calls, ["postiz:x/text", "typefully:linkedin/image"]);
    assert.deepEqual(evidence.map((item) => [item.route, item.outcome]), [
      ["postiz", "verified"], ["typefully", "verified"], ["youtube", "explicit-exception"],
    ]);
  });

  test("fails closed for incomplete Postiz coverage and non-terminal cleanup", async () => {
    const runner = {
      postiz: async () => ({ providerObjectId: "pz-1", cleanupTerminal: false }),
      typefully: async () => ({ providerObjectId: "tf-1", cleanupTerminal: true }),
    };
    await assert.rejects(runCanaryMatrix(registry, [], approval, runner, { CANARY_I_MEAN_IT: "1", POSTIZ_ACCOUNT_ID: "acct-1" }), /incomplete/);
    await assert.rejects(runCanaryMatrix(registry, [{ destination: "x", media: "text" }], approval, runner, { CANARY_I_MEAN_IT: "1", POSTIZ_ACCOUNT_ID: "acct-1" }), /not positively reconciled/);
  });

  test("cannot claim matrix success without fallback and explicitly validated exception coverage", async () => {
    const runner = {
      postiz: async () => ({ providerObjectId: "pz-1", cleanupTerminal: true }),
      typefully: async () => ({ providerObjectId: "tf-1", cleanupTerminal: true }),
    };
    const env = { CANARY_I_MEAN_IT: "1", POSTIZ_ACCOUNT_ID: "acct-1" };
    await assert.rejects(runCanaryMatrix(registry, [{ destination: "x", media: "text" }], approval, runner, env), /no supported Typefully fallback/);
    await assert.rejects(runCanaryMatrix(registry, [
      { destination: "x", media: "text" }, { destination: "linkedin", media: "image" },
    ], approval, runner, env), /no explicit provider exception/);
    await assert.rejects(runCanaryMatrix(registry, [
      { destination: "x", media: "text" }, { destination: "linkedin", media: "image" },
      { destination: "youtube", media: "video" },
    ], approval, runner, env), /must explicitly declare youtube/);
    await assert.rejects(runCanaryMatrix({ fetchedAt: registry.fetchedAt, capabilities: [] }, [], approval, runner, env), /advertises no capabilities/);
  });
});
