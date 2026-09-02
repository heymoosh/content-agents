import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { cancelPostizPost, createPostizPost, defaultProviderSettings, fetchPostizCapabilities, readPostizPost, reconcilePostizPost, reschedulePostizPost, resolveConfiguredPostizCapability, selectDeliveryRoute, supportsPostiz, createPostizTransport, updatePostizPost, uploadPostizMedia, type PostizTransport } from "./postiz.js";
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

  test("refuses a malformed explicit capability list", async () => {
    const { client } = transport([{ integrations: [{ platform: "x", id: "acct-1", name: "HI", media: "text" }] }]);
    await assert.rejects(fetchPostizCapabilities(client), /explicit media capabilities/);
  });

  test("maps the real public integrations shape to text-only, drops disabled rows, records unknown identifiers", async () => {
    // Exact shape of GET /public/v1/integrations in postiz-app (public.integrations.controller.ts): a bare
    // array with no media field.
    const { client, calls } = transport([[
      { id: "int-x", name: "Muxin Li", identifier: "x", picture: "p", disabled: false, profile: "muxin", customer: undefined },
      { id: "int-th", name: "human_inference", identifier: "threads", picture: "p", disabled: false, profile: "hi" },
      { id: "int-off", name: "Old", identifier: "linkedin", picture: "p", disabled: true, profile: "old" },
      { id: "int-fb", name: "Human Inference", identifier: "facebook", picture: "p", disabled: false, profile: "hi" },
      { id: "int-off2", name: "Old2", identifier: "bluesky", disabled: true, media: ["text", "image"] },
      { id: "int-yt", name: "Human Inference", identifier: "youtube", picture: "p", disabled: false, profile: "hi" },
      { id: "int-ig", name: "Muxin Li", identifier: "instagram", disabled: false },
      { id: "int-tt", name: "Human Inference", identifier: "tiktok", disabled: false },
    ]]);
    const registry = await fetchPostizCapabilities(client, new Date("2026-09-02T12:00:00Z"));
    assert.deepEqual(registry.capabilities, [
      { destination: "x", media: ["text"], accountId: "int-x", accountLabel: "Muxin Li" },
      { destination: "threads", media: ["text"], accountId: "int-th", accountLabel: "human_inference" },
      { destination: "facebook", media: ["text"], accountId: "int-fb", accountLabel: "Human Inference" },
    ]);
    assert.deepEqual(registry.unrecognized, [
      { identifier: "linkedin", accountId: "int-off", accountLabel: "Old", reason: "disabled" },
      { identifier: "bluesky", accountId: "int-off2", accountLabel: "Old2", reason: "disabled" },
      { identifier: "youtube", accountId: "int-yt", accountLabel: "Human Inference", reason: "no-text-baseline" },
      { identifier: "instagram", accountId: "int-ig", accountLabel: "Muxin Li", reason: "no-text-baseline" },
      { identifier: "tiktok", accountId: "int-tt", accountLabel: "Human Inference", reason: "no-text-baseline" },
    ]);
    assert.equal(supportsPostiz(registry, "x", "image"), false, "image stays unsupported without a verified upload path");
    assert.equal(calls.length, 1);
    assert.equal(selectDeliveryRoute(registry, "facebook", "image"), "unsupported", "facebook has no non-Postiz fallback");
  });

  test("advertises provider media only once the instance's upload lifecycle is verified", async () => {
    const rows = [
      { id: "int-yt", name: "HI", identifier: "youtube", disabled: false },
      { id: "int-x", name: "Muxin Li", identifier: "x", disabled: false },
      { id: "int-lp", name: "HI", identifier: "linkedin-page", disabled: false },
    ];
    const verified = await fetchPostizCapabilities(transport([rows]).client, new Date("2026-09-02T12:00:00Z"), { mediaUploadVerified: true });
    assert.deepEqual(verified.capabilities, [
      { destination: "youtube", media: ["video"], accountId: "int-yt", accountLabel: "HI", localMediaUpload: true },
      { destination: "x", media: ["text", "image", "video"], accountId: "int-x", accountLabel: "Muxin Li", localMediaUpload: true },
    ]);
    assert.deepEqual(verified.unrecognized, [{ identifier: "linkedin-page", accountId: "int-lp", accountLabel: "HI", reason: "unknown-identifier" }]);
    assert.equal(selectDeliveryRoute(verified, "youtube", "video", { requiresLocalMediaUpload: true }), "postiz");
  });

  test("multipart uploads omit the JSON content type so fetch writes the boundary", async () => {
    const seen: RequestInit[] = [];
    const client = createPostizTransport({ POSTIZ_BASE_URL: "http://postiz.test", POSTIZ_API_KEY: "k" }, (async (_url: string | URL | Request, init?: RequestInit) => { seen.push(init ?? {}); return new Response(JSON.stringify({ id: "m", path: "p" }), { status: 200 }); }) as typeof fetch);
    await uploadPostizMedia(client, { bytes: new Uint8Array([1]), filename: "a.png", mime: "image/png" });
    assert.equal((seen[0]?.headers as Record<string, string>)["Content-Type"], undefined);
    assert.equal((seen[0]?.headers as Record<string, string>).Authorization, "k");
  });

  test("sends the bare API key: Postiz's public middleware rejects a Bearer prefix", async () => {
    const seen: Array<{ url: string; headers: Record<string, string> }> = [];
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      seen.push({ url, headers: init?.headers as Record<string, string> });
      return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
    }) as unknown as typeof fetch;
    const client = createPostizTransport({ POSTIZ_BASE_URL: "http://localhost:4007/", POSTIZ_API_KEY: " key-1 " }, fakeFetch);
    await fetchPostizCapabilities(client);
    assert.equal(seen[0]?.url, "http://localhost:4007/api/public/v1/integrations");
    assert.equal(seen[0]?.headers.Authorization, "key-1");
  });
});

describe("Postiz stable lifecycle contract", () => {
  test("create/read/cancel/reconcile follow the real public API: array create, windowed list read, soft delete", async () => {
    const { client, calls } = transport([
      [{ postId: "post-7", integration: "acct-1" }],
      { posts: [{ id: "post-7", state: "QUEUE", publishDate: "2026-09-01T12:00:00.000Z", releaseURL: "https://social.example/post-7", group: "g-1" }] },
      { id: "post-7" },
      { posts: [] },
    ]);
    const input = { destination: "x", accountId: "acct-1", content: "approved canary", scheduledAt: "2026-09-01T12:00:00Z", visibility: "scheduled" } as const;
    const created = await createPostizPost(client, input, new Date("2026-08-30T12:00:00Z"));
    assert.deepEqual(created, { id: "post-7", url: null, status: "scheduled", scheduledAt: "2026-09-01T12:00:00Z" });
    assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
      type: "schedule", date: "2026-09-01T12:00:00Z", shortLink: false, tags: [],
      posts: [{ integration: { id: "acct-1" }, value: [{ content: "approved canary", image: [] }], settings: { who_can_reply_post: "everyone" } }],
    });
    const read = await readPostizPost(client, "post-7", input.scheduledAt);
    assert.equal(read.url, "https://social.example/post-7");
    assert.equal(read.status, "scheduled");
    assert.equal(read.group, "g-1");
    assert.equal((await cancelPostizPost(client, "post-7")).status, "canceled");
    assert.equal((await reconcilePostizPost(client, "post-7", input.scheduledAt)).status, "canceled");
    assert.deepEqual(calls.map((call) => [call.init?.method ?? "GET", call.path.replace(/\?.*$/, "")]), [
      ["POST", "/api/public/v1/posts"], ["GET", "/api/public/v1/posts"],
      ["DELETE", "/api/public/v1/posts/post-7"], ["GET", "/api/public/v1/posts"],
    ]);
    assert.match(calls[1]?.path ?? "", /startDate=2026-07-18T12%3A00%3A00\.000Z&endDate=2026-10-16T12%3A00%3A00\.000Z/);
  });

  test("draft maps to Postiz type draft; private and media are refused before any request", async () => {
    const { client, calls } = transport([[{ postId: "d-1", integration: "acct-1" }]]);
    const base = { destination: "x", accountId: "acct-1", content: "c", scheduledAt: "2026-09-01T12:00:00Z" } as const;
    const now = new Date("2026-08-30T12:00:00Z");
    assert.equal((await createPostizPost(client, { ...base, visibility: "draft" }, now)).status, "draft");
    assert.equal(JSON.parse(String(calls[0]?.init?.body)).type, "draft");
    assert.equal(JSON.parse(String(calls[0]?.init?.body)).posts[0].settings, undefined, "drafts skip provider settings: Postiz validates them only for non-draft saves");
    await assert.rejects(createPostizPost(client, { ...base, visibility: "private" }, now), /no private visibility/);
    await assert.rejects(createPostizPost(client, { ...base, visibility: "draft", mediaUrls: ["https://x/y.png"] }, now), /remote URLs are refused/);
    assert.equal(calls.length, 1);
  });

  test("non-draft saves carry each channel's required provider settings from the live integration-settings schemas", async () => {
    assert.deepEqual(defaultProviderSettings("x"), { who_can_reply_post: "everyone" });
    assert.deepEqual(defaultProviderSettings("bluesky"), {});
    assert.equal(defaultProviderSettings("tiktok").content_posting_method, "DIRECT_POST");
    const { client, calls } = transport([[{ postId: "p-1" }], [{ postId: "p-2" }]]);
    const now = new Date("2026-08-30T12:00:00Z");
    const media = [{ id: "m-1", path: "http://postiz/uploads/m-1.png" }];
    await createPostizPost(client, { destination: "instagram", accountId: "ig", content: "caption", media, scheduledAt: "2026-09-01T12:00:00Z", visibility: "scheduled", providerSettings: { post_type: "story" } }, now);
    const body = JSON.parse(String(calls[0]?.init?.body));
    assert.deepEqual(body.posts[0].settings, { post_type: "story" });
    assert.deepEqual(body.posts[0].value[0].image, media);
    await assert.rejects(createPostizPost(client, { destination: "instagram", accountId: "ig", content: "caption", scheduledAt: "2026-09-01T12:00:00Z", visibility: "scheduled" }, now), /require media/);
    await assert.rejects(createPostizPost(client, { destination: "youtube", accountId: "yt", content: "c", media, scheduledAt: "2026-09-01T12:00:00Z", visibility: "scheduled" }, now), /providerSettings\.title/);
    await createPostizPost(client, { destination: "facebook", accountId: "fb", content: "text only", scheduledAt: "2026-09-01T12:00:00Z", visibility: "scheduled" }, now);
    assert.deepEqual(JSON.parse(String(calls[1]?.init?.body)).posts[0].settings, { post_type: "post" });
  });

  test("reschedule re-POSTs the full body in place with type schedule; update keeps the date and never restarts the workflow", async () => {
    const { client, calls } = transport([[{ postId: "post-7" }], [{ postId: "post-7" }], [{ postId: "other" }]]);
    const now = new Date("2026-08-30T12:00:00Z");
    const input = { destination: "x", accountId: "acct-1", content: "approved", scheduledAt: "2026-09-01T12:00:00Z", visibility: "scheduled" } as const;
    const moved = await reschedulePostizPost(client, { id: "post-7", group: "g-1" }, input, "2026-09-03T12:00:00Z", now);
    assert.deepEqual(moved, { id: "post-7", url: null, status: "scheduled", scheduledAt: "2026-09-03T12:00:00Z" });
    const body = JSON.parse(String(calls[0]?.init?.body));
    assert.equal(body.type, "schedule");
    assert.equal(body.date, "2026-09-03T12:00:00Z");
    assert.equal(body.posts[0].group, "g-1");
    assert.equal(body.posts[0].value[0].id, "post-7");
    assert.equal(body.republish, undefined);
    await updatePostizPost(client, { id: "post-7", scheduledAt: input.scheduledAt }, { ...input, content: "edited" }, now);
    assert.equal(JSON.parse(String(calls[1]?.init?.body)).type, "update");
    await assert.rejects(updatePostizPost(client, { id: "post-7", scheduledAt: "2026-09-02T12:00:00Z" }, input, now), /cannot change the date/);
    await assert.rejects(reschedulePostizPost(client, { id: "post-7" }, input, "2026-09-04T12:00:00Z", now), /different stable id/);
    await assert.rejects(reschedulePostizPost(client, { id: "post-7" }, input, "2026-08-01T12:00:00Z", now), /future/);
  });

  test("upload posts multipart to the public upload route and returns the media ref", async () => {
    const { client, calls } = transport([{ id: "m-9", name: "x.png", path: "http://postiz/uploads/m-9.png" }]);
    const ref = await uploadPostizMedia(client, { bytes: new Uint8Array([137, 80, 78, 71]), filename: "x.png", mime: "image/png" });
    assert.deepEqual(ref, { id: "m-9", path: "http://postiz/uploads/m-9.png" });
    assert.equal(calls[0]?.path, "/api/public/v1/upload");
    assert.ok(calls[0]?.init?.body instanceof FormData);
    await assert.rejects(uploadPostizMedia(client, { bytes: new Uint8Array(), filename: "x.png", mime: "image/png" }), /non-empty/);
  });

  test("read fails closed when the post is absent from the window", async () => {
    const { client } = transport([{ posts: [{ id: "other", state: "DRAFT" }] }]);
    await assert.rejects(readPostizPost(client, "post-7", "2026-09-01T12:00:00Z"), /not found/);
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
    assert.throws(() => assertLiveCanaryGate({ ...input, visibility: "scheduled" }, approval, { CANARY_I_MEAN_IT: "1" }, new Date("2026-08-30T00:00:00Z")), /allowScheduled=true/);
    const farOut = { ...input, visibility: "scheduled" as const, scheduledAt: "2026-09-10T00:00:00Z" };
    assert.throws(() => assertLiveCanaryGate({ ...farOut, scheduledAt: "2026-09-03T00:00:00Z" }, { ...approval, allowScheduled: true }, { CANARY_I_MEAN_IT: "1" }, new Date("2026-08-30T00:00:00Z")), /at least 7 days out/);
    assert.doesNotThrow(() => assertLiveCanaryGate(farOut, { ...approval, allowScheduled: true }, { CANARY_I_MEAN_IT: "1" }, new Date("2026-08-30T00:00:00Z")));
  });

  test("approved scheduled canary proves schedule, reschedule, read-back, cancel, and terminal reconcile", async () => {
    const { client, calls } = transport([
      [{ postId: "canary-2", integration: "acct-1" }],
      { posts: [{ id: "canary-2", state: "QUEUE", publishDate: "2026-09-10T00:00:00.000Z", group: "g-2" }] },
      [{ postId: "canary-2", integration: "acct-1" }],
      { posts: [{ id: "canary-2", state: "QUEUE", publishDate: "2026-09-10T01:00:00.000Z", group: "g-3" }] },
      { id: "canary-2" }, { posts: [] },
    ]);
    const root = mkdtempSync(join(tmpdir(), "postiz-canary-"));
    const scheduled = { ...input, visibility: "scheduled" as const, scheduledAt: "2026-09-10T00:00:00Z" };
    const result = await runPostizLifecycleCanary(client, scheduled, { ...approval, allowScheduled: true }, { CANARY_I_MEAN_IT: "1" }, new Date("2026-08-30T00:00:00Z"),
      { cleanupLedgerPath: join(root, "cleanup.jsonl"), emitRecovery: () => {}, rescheduleTo: "2026-09-10T01:00:00Z" });
    assert.equal(result.rescheduled?.scheduledAt, "2026-09-10T01:00:00Z");
    assert.equal(result.reconciled.status, "canceled");
    const move = JSON.parse(String(calls[2]?.init?.body));
    assert.equal(move.type, "schedule"); assert.equal(move.posts[0].group, "g-2"); assert.equal(move.posts[0].value[0].id, "canary-2");
    assert.equal(calls.length, 6);
    const ledger = readFileSync(join(root, "cleanup.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
    assert.equal(ledger.at(-1).cleanupRequired, false);
    rmSync(root, { recursive: true, force: true });
  });

  test("a reschedule that does not land keeps cleanupRequired and still cancels", async () => {
    const { client, calls } = transport([
      [{ postId: "canary-3" }], { posts: [{ id: "canary-3", state: "QUEUE", publishDate: "2026-09-10T00:00:00.000Z" }] },
      [{ postId: "canary-3" }], { posts: [{ id: "canary-3", state: "QUEUE", publishDate: "2026-09-10T00:00:00.000Z" }] },
      { id: "canary-3" }, { posts: [] },
    ]);
    const root = mkdtempSync(join(tmpdir(), "postiz-canary-"));
    const scheduled = { ...input, visibility: "scheduled" as const, scheduledAt: "2026-09-10T00:00:00Z" };
    await assert.rejects(runPostizLifecycleCanary(client, scheduled, { ...approval, allowScheduled: true }, { CANARY_I_MEAN_IT: "1" }, new Date("2026-08-30T00:00:00Z"),
      { cleanupLedgerPath: join(root, "cleanup.jsonl"), emitRecovery: () => {}, rescheduleTo: "2026-09-10T01:00:00Z" }), /after a reschedule/);
    assert.equal(calls.filter((call) => call.init?.method === "DELETE").length, 1);
    rmSync(root, { recursive: true, force: true });
  });

  test("composes a gated create/read/cancel/reconcile harness lifecycle", async () => {
    const { client, calls } = transport([
      [{ postId: "canary-1", integration: "acct-1" }], { posts: [{ id: "canary-1", state: "DRAFT" }] },
      { id: "canary-1" }, { posts: [] },
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
        if (init?.method === "POST") return [{ postId: "recover-7", integration: "acct-1" }];
        if (init?.method === "DELETE") {
          if (scenario === "cancel failure") throw new Error("cancel offline");
          return { id: "recover-7" };
        }
        if (calls.filter((call) => call.startsWith("GET")).length === 1) {
          if (scenario === "read throw") throw new Error("read offline");
          // "ID mismatch" models a list that lacks the created id: read must fail closed, never match another row.
          return { posts: [{ id: scenario === "ID mismatch" ? "wrong-id" : "recover-7", state: "DRAFT" }] };
        }
        return { posts: [] };
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
    const { client, calls } = transport([[{ postId: "recover-9", integration: "acct-1" }], { id: "recover-9" }, { posts: [] }]);
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
      [{ postId: "pending-1", integration: "acct-1" }], { posts: [{ id: "pending-1", state: "DRAFT" }] },
      { id: "pending-1" }, { posts: [{ id: "pending-1", state: "DRAFT" }] },
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

test("transport turns a 429 into an actionable rate-limit error", async () => {
  const fetchImpl = (async () => new Response(JSON.stringify({ statusCode: 429, message: "ThrottlerException: Too Many Requests" }), { status: 429 })) as unknown as typeof fetch;
  const transport = createPostizTransport({ POSTIZ_BASE_URL: "http://postiz.test", POSTIZ_API_KEY: "k" }, fetchImpl);
  await assert.rejects(transport.request("/public/v1/posts", { method: "POST", body: "{}" }), /90 requests per hour.*each schedule or move counts as one/);
});
