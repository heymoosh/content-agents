import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { cancelPostizPost, createPostizPost, defaultProviderSettings, fetchPostizCapabilities, readPostizPost, reconcilePostizPost, reschedulePostizPost, resolveConfiguredPostizCapability, selectDeliveryRoute, supportsPostiz, createPostizTransport, updatePostizPost, uploadPostizMedia, type PostizTransport, type PostizCapabilityRegistry, type PostizDestination, type PostizMedia, rateLimitRetryAt, PostizRateLimitError, postizRateLimitRetryAt } from "./postiz.js";
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
    // SLICE-7B changed this one line. It used to read `"typefully"`, which is exactly the silent
    // downgrade this slice removes: discovery here lists only x, so linkedin/text is a channel
    // Postiz does not have connected and the row must refuse rather than land on another provider.
    // The image leg below is the fallback that survives, unchanged.
    assert.equal(selectDeliveryRoute(registry, "linkedin", "text"), "unsupported");
    assert.equal(selectDeliveryRoute(registry, "linkedin", "image"), "typefully");
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
  await assert.rejects(transport.request("/public/v1/posts", { method: "POST", body: "{}" }), /90 requests per hour.*each schedule or move counts as one.*resumes the waiting rows automatically after \d{4}-/);
});

test("a 429 carries the provider's resume time when it sends one, else one hour", async () => {
  const now = new Date("2026-09-02T18:10:00.000Z");
  assert.equal(rateLimitRetryAt({ "Retry-After": "120" }, now), "2026-09-02T18:12:00.000Z");
  assert.equal(rateLimitRetryAt({ "X-RateLimit-Reset": String(Math.floor(Date.parse("2026-09-02T18:30:00Z") / 1000)) }, now), "2026-09-02T18:30:00.000Z");
  assert.equal(rateLimitRetryAt(undefined, now), "2026-09-02T19:10:00.000Z");
  const fetchImpl = (async () => new Response("{}", { status: 429, headers: { "Retry-After": "60" } })) as unknown as typeof fetch;
  const transport = createPostizTransport({ POSTIZ_BASE_URL: "http://postiz.test", POSTIZ_API_KEY: "k" }, fetchImpl);
  let caught: unknown;
  try { await transport.request("/public/v1/posts", { method: "POST", body: "{}" }); } catch (e) { caught = e; }
  assert.ok(caught instanceof PostizRateLimitError);
  assert.equal(postizRateLimitRetryAt(caught.message), caught.retryAt);
  assert.equal(postizRateLimitRetryAt("Postiz POST /x failed (500)"), null);
  // Only the create endpoint is throttled; a 429 anywhere else stays an ordinary transport error.
  await assert.rejects(transport.request("/public/v1/upload", { method: "POST", body: "{}" }), /Postiz POST \/public\/v1\/upload failed \(429\)/);
});

// ── SLICE-6Y: every connected Postiz channel is schedulable, not just the one pinned id ─────────
//
// Postiz issues one account id per connected channel, so the old single `POSTIZ_ACCOUNT_ID` could
// only ever name one of them and every other channel was refused with "does not advertise" for a
// capability Postiz really did advertise. The approved-account guard stays an explicit allowlist:
// a channel newly connected in Postiz is still unpostable until a human adds its id.
//
// The fixture mirrors live discovery on 2026-09-11 (mastodon, facebook, linkedin, threads, x,
// bluesky, all text-only). Account ids here are invented; no real id or secret appears.
describe("SLICE-6Y approved Postiz accounts", () => {
  const ACCOUNTS: Record<string, PostizDestination> = {
    "acct-mastodon": "mastodon", "acct-facebook": "facebook", "acct-linkedin": "linkedin",
    "acct-threads": "threads", "acct-x": "x", "acct-bluesky": "bluesky",
  };
  const liveShape: PostizCapabilityRegistry = {
    fetchedAt: "2026-09-11T12:00:00Z",
    capabilities: Object.entries(ACCOUNTS).map(([accountId, destination]) => ({
      destination, media: ["text"] as PostizMedia[], accountId, accountLabel: `Human Inference ${destination}`,
    })),
  };
  const refusal = (destination: PostizDestination, media: PostizMedia, env: NodeJS.ProcessEnv): string => {
    try { resolveConfiguredPostizCapability(liveShape, destination, media, env); } catch (error) { return (error as Error).message; }
    throw new Error(`expected ${destination}/${media} to be refused`);
  };

  test("one approved id schedules its own channel and nothing else", () => {
    const env = { POSTIZ_ACCOUNT_IDS: "acct-threads" };
    const resolved = resolveConfiguredPostizCapability(liveShape, "threads", "text", env);
    assert.equal(resolved.accountId, "acct-threads");
    assert.equal(resolved.destination, "threads");
    // Every other connected channel is still refused, so the guard did not become "pick whatever matches".
    for (const destination of Object.values(ACCOUNTS).filter((d) => d !== "threads")) {
      assert.match(refusal(destination, "text", env), /not approved for posting/);
    }
  });

  test("several approved ids each resolve to their own account; an unlisted channel is refused", () => {
    const env = { POSTIZ_ACCOUNT_IDS: "acct-threads, acct-bluesky ,acct-linkedin" };
    assert.equal(resolveConfiguredPostizCapability(liveShape, "threads", "text", env).accountId, "acct-threads");
    assert.equal(resolveConfiguredPostizCapability(liveShape, "bluesky", "text", env).accountId, "acct-bluesky");
    assert.equal(resolveConfiguredPostizCapability(liveShape, "linkedin", "text", env).accountId, "acct-linkedin");
    assert.match(refusal("x", "text", env), /Postiz has x\/text connected on account acct-x, which is not approved for posting\./);
  });

  test("the legacy single variable keeps working as a one-entry allowlist", () => {
    const env = { POSTIZ_ACCOUNT_ID: "acct-bluesky" };
    assert.equal(resolveConfiguredPostizCapability(liveShape, "bluesky", "text", env).accountId, "acct-bluesky");
    for (const destination of Object.values(ACCOUNTS).filter((d) => d !== "bluesky")) {
      assert.match(refusal(destination, "text", env), /not approved for posting/);
    }
  });

  test("both variables set approve the union and the legacy value is not dropped", () => {
    const env = { POSTIZ_ACCOUNT_ID: "acct-bluesky", POSTIZ_ACCOUNT_IDS: "acct-threads" };
    assert.equal(resolveConfiguredPostizCapability(liveShape, "bluesky", "text", env).accountId, "acct-bluesky");
    assert.equal(resolveConfiguredPostizCapability(liveShape, "threads", "text", env).accountId, "acct-threads");
    assert.match(refusal("x", "text", env), /not approved for posting/);
  });

  test("two approved accounts on one channel refuse and name both ids", () => {
    const doubled: PostizCapabilityRegistry = {
      fetchedAt: "2026-09-11T12:00:00Z",
      capabilities: [
        { destination: "threads", media: ["text"], accountId: "acct-threads", accountLabel: "first" },
        { destination: "threads", media: ["text"], accountId: "acct-threads-2", accountLabel: "second" },
      ],
    };
    const env = { POSTIZ_ACCOUNT_IDS: "acct-threads,acct-threads-2" };
    assert.throws(
      () => resolveConfiguredPostizCapability(doubled, "threads", "text", env),
      /2 approved Postiz accounts advertise threads\/text \(acct-threads, acct-threads-2\)\. Leave one of them in POSTIZ_ACCOUNT_IDS and remove the rest\./,
    );
    // With only one of the two approved there is no ambiguity, so it still resolves.
    assert.equal(resolveConfiguredPostizCapability(doubled, "threads", "text", { POSTIZ_ACCOUNT_IDS: "acct-threads-2" }).accountId, "acct-threads-2");
    // Neither approved names both connected ids and still refuses.
    assert.throws(
      () => resolveConfiguredPostizCapability(doubled, "threads", "text", { POSTIZ_ACCOUNT_IDS: "acct-bluesky" }),
      /Postiz has threads\/text connected on accounts acct-threads, acct-threads-2, none of them approved for posting\. Add the one you want to POSTIZ_ACCOUNT_IDS to schedule this channel\./,
    );
  });

  test("nothing configured is a refusal, and an empty list is unset rather than approve-everything", () => {
    for (const env of [{}, { POSTIZ_ACCOUNT_IDS: "" }, { POSTIZ_ACCOUNT_IDS: "   " }, { POSTIZ_ACCOUNT_IDS: " , ,, " }, { POSTIZ_ACCOUNT_IDS: "", POSTIZ_ACCOUNT_ID: "  " }]) {
      assert.equal(refusal("threads", "text", env), "POSTIZ_ACCOUNT_IDS or POSTIZ_ACCOUNT_ID is required to select a discovered instance account");
    }
  });

  // Audit finding P2 (Grok, 2026-09-11): splitting the legacy variable too would widen the guard.
  // A legacy value holding a comma used to be one opaque id that matched nothing; it must stay that
  // way. Only POSTIZ_ACCOUNT_IDS is a list.
  test("the legacy variable is one opaque id and is never split into a list", () => {
    const joined = "acct-threads,acct-bluesky";
    // Both halves are real registry ids, so a split would resolve them. It must not.
    assert.match(refusal("threads", "text", { POSTIZ_ACCOUNT_ID: joined }), /Postiz has threads\/text connected on account acct-threads, which is not approved for posting\./);
    assert.match(refusal("bluesky", "text", { POSTIZ_ACCOUNT_ID: joined }), /Postiz has bluesky\/text connected on account acct-bluesky, which is not approved for posting\./);
    // The very same pair in the list variable IS approved, so the refusal above is about the
    // legacy variable's shape and not about these two ids.
    assert.equal(resolveConfiguredPostizCapability(liveShape, "threads", "text", { POSTIZ_ACCOUNT_IDS: joined }).accountId, "acct-threads");
    assert.equal(resolveConfiguredPostizCapability(liveShape, "bluesky", "text", { POSTIZ_ACCOUNT_IDS: joined }).accountId, "acct-bluesky");
    // A trailing comma is part of the opaque id too, so it matches nothing.
    assert.match(refusal("threads", "text", { POSTIZ_ACCOUNT_ID: "acct-threads," }), /not approved for posting/);
    // An untrimmed legacy id still works, because trimming is not splitting.
    assert.equal(resolveConfiguredPostizCapability(liveShape, "threads", "text", { POSTIZ_ACCOUNT_ID: "  acct-threads  " }).accountId, "acct-threads");
  });

  test("an approved id the registry never returned selects nothing and fabricates nothing", () => {
    const env = { POSTIZ_ACCOUNT_IDS: "acct-ghost,acct-threads" };
    // The ghost id is simply ignored: the real approved id still resolves...
    assert.equal(resolveConfiguredPostizCapability(liveShape, "threads", "text", env).accountId, "acct-threads");
    // ...and a destination the registry does not advertise at all is still refused, not invented.
    assert.equal(refusal("instagram", "text", env), "configured Postiz account does not advertise instagram/text");
    assert.equal(refusal("threads", "image", env), "configured Postiz account does not advertise threads/image");
  });

  test("the connected-but-unapproved refusal names the cause and the fix, and stops blaming the channel", () => {
    const message = refusal("threads", "text", { POSTIZ_ACCOUNT_IDS: "acct-bluesky" });
    assert.equal(message, "Postiz has threads/text connected on account acct-threads, which is not approved for posting. Add acct-threads to POSTIZ_ACCOUNT_IDS to schedule this channel.");
    assert.ok(!/does not advertise/.test(message), "Postiz does advertise this channel, so the old wording would be a lie");
  });

  test("the guard fails closed: no capability of an unapproved account is ever returned", () => {
    // One approved id at a time, across every connected channel. The only pair that may resolve is
    // the one whose own account is approved; every other pair must throw.
    for (const approved of Object.keys(ACCOUNTS)) {
      for (const [accountId, destination] of Object.entries(ACCOUNTS)) {
        if (accountId === approved) {
          assert.equal(resolveConfiguredPostizCapability(liveShape, destination, "text", { POSTIZ_ACCOUNT_IDS: approved }).accountId, accountId);
        } else {
          assert.throws(() => resolveConfiguredPostizCapability(liveShape, destination, "text", { POSTIZ_ACCOUNT_IDS: approved }));
        }
      }
    }
  });

  test("every refusal this guard can produce passes the voice rules", () => {
    const messages = [
      refusal("threads", "text", {}),
      refusal("threads", "text", { POSTIZ_ACCOUNT_IDS: "acct-bluesky" }),
      refusal("instagram", "text", { POSTIZ_ACCOUNT_IDS: "acct-bluesky" }),
      refusal("threads", "text", { POSTIZ_ACCOUNT_IDS: "acct-ghost" }),
    ];
    for (const message of messages) {
      assert.ok(!message.includes("—"), `em dash in refusal: ${message}`);
      assert.ok(!/here's the thing|isn't just|at the end of the day|let's (dive|unpack)|leverage|seamless|robust/i.test(message), `AI tell in refusal: ${message}`);
      assert.ok(!/[A-Za-z0-9_-]{20,}/.test(message.replace(/POSTIZ_ACCOUNT_IDS?/g, "")), `refusal looks like it carries a secret: ${message}`);
    }
  });
});

// ── SLICE-7B: a Postiz channel never silently downgrades to Typefully ───────────────────────────
//
// Observed 2026-09-12: `x-1` of one piece sat on Typefully with "No planned time recorded" while
// its bluesky and threads siblings went to Postiz with real planned times. The cause was one line
// here: every UNLISTED x/linkedin/bluesky destination fell through to `typefully`, for text as
// well as image, with no error and no signal. Text no longer falls through. The image leg is the
// configured-media backup route cards.ts owns and is deliberately untouched.
//
// Account ids in these fixtures are invented. No secret and no real id appears.
describe("SLICE-7B a text destination Postiz does not list never routes to Typefully", () => {
  const TEXT_CHANNELS: PostizDestination[] = ["x", "linkedin", "bluesky"];
  const empty: PostizCapabilityRegistry = { fetchedAt: "2026-09-12T12:00:00Z", capabilities: [] };
  const lists = (destination: PostizDestination): PostizCapabilityRegistry => ({
    fetchedAt: "2026-09-12T12:00:00Z",
    capabilities: [{ destination, media: ["text"] as PostizMedia[], accountId: `acct-${destination}`, accountLabel: `Human Inference ${destination}` }],
  });

  for (const destination of TEXT_CHANNELS) {
    test(`${destination}/text is unsupported when discovery does not list it`, () => {
      assert.equal(selectDeliveryRoute(empty, destination, "text"), "unsupported",
        `${destination}/text must refuse, never quietly become a Typefully draft`);
    });

    test(`${destination}/text is still postiz when discovery does list it`, () => {
      assert.equal(selectDeliveryRoute(lists(destination), destination, "text"), "postiz");
    });
  }

  test("the configured-media image backup route is unchanged for all three", () => {
    for (const destination of TEXT_CHANNELS) {
      assert.equal(selectDeliveryRoute(empty, destination, "image"), "typefully",
        `${destination}/image keeps the backup route a media row depends on`);
    }
  });

  test("every non-text route is unchanged", () => {
    assert.equal(selectDeliveryRoute(empty, "facebook", "text"), "unsupported");
    assert.equal(selectDeliveryRoute(empty, "facebook", "image"), "unsupported");
    assert.equal(selectDeliveryRoute(empty, "tiktok", "video"), "postpeer");
    assert.equal(selectDeliveryRoute(empty, "youtube", "video"), "youtube");
    assert.equal(selectDeliveryRoute(empty, "substack", "text"), "substack");
  });
});
