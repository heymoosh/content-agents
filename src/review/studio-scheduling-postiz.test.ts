import { test } from "node:test";
import assert from "node:assert/strict";
import { scheduleApproved, type SchedulerDeps } from "./studio-scheduling.js";
import type { QueueRow } from "../publish/queue.js";
import type { DeliveryPolicyDecision } from "../publish/delivery-policy.js";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const row = (over: Partial<QueueRow> = {}): QueueRow => ({
  id: "x-1", platform: "x", format: "text", asset: "derivatives/x-1.md", status: "approve", notes: "", lineIndex: 1, ...over,
});

function deps(supportsText: boolean, calls: string[]): SchedulerDeps {
  const policy = (_folder: string, provider: DeliveryPolicyDecision["provider"]): DeliveryPolicyDecision => ({
    policyVersion: "delivery-policy-v1", origin: "human-inference", brand: "human-inference", provider,
    providerAccountId: `human-inference/${provider}`, mode: "provider", reason: "test",
  });
  return {
    publishText: async () => { calls.push("typefully"); return [{ draftId: "tf-1" }]; },
    publishCards: async () => [], publishTikTok: async () => [], publishShorts: async () => [], publishSubstack: async () => [],
    lockOutreachMessage: async () => [], resolveDeliveryPolicy: policy,
    postizEnv: { POSTIZ_ACCOUNT_ID: "acct-1" },
    fetchPostizRegistry: async () => ({ fetchedAt: "2026-01-01T00:00:00Z", capabilities: [{
      destination: supportsText ? "x" : "youtube", media: supportsText ? ["text"] : ["video"], accountId: "acct-1", accountLabel: "Human Inference",
    }] }),
    publishPostiz: async (_folder, _row, capability) => {
      calls.push("postiz");
      return { providerObjectId: "pz-1", providerAccountId: capability.accountId, canonicalUrl: "https://social.test/pz-1", status: "scheduled" };
    },
  };
}

test("production scheduler selects discovered Postiz capability before legacy providers", async () => {
  const calls: string[] = [];
  const result = await scheduleApproved("/unused", row(), deps(true, calls));
  assert.deepEqual(calls, ["postiz"]);
  assert.equal((result.scheduled as { providerObjectId: string }).providerObjectId, "pz-1");
  assert.equal(result.scheduleError, null);
});

test("Postiz-only credentials are not blocked by the provisional Typefully route", async () => {
  const folder = mkdtempSync(join(tmpdir(), "studio-postiz-only-"));
  writeFileSync(join(folder, "content-request.json"), JSON.stringify({ origin: "human-inference" }));
  const calls: string[] = [];
  const configured = deps(true, calls);
  delete configured.resolveDeliveryPolicy;
  const previousPostiz = process.env.CONTENT_AGENTS_POSTIZ_ACCOUNT_ID;
  const previousTypefully = process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID;
  process.env.CONTENT_AGENTS_POSTIZ_ACCOUNT_ID = "human-inference/postiz";
  delete process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID;
  try {
    const result = await scheduleApproved(folder, row(), configured);
    assert.deepEqual(calls, ["postiz"]);
    assert.equal(result.scheduleError, null);
  } finally {
    if (previousPostiz === undefined) delete process.env.CONTENT_AGENTS_POSTIZ_ACCOUNT_ID;
    else process.env.CONTENT_AGENTS_POSTIZ_ACCOUNT_ID = previousPostiz;
    if (previousTypefully === undefined) delete process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID;
    else process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID = previousTypefully;
    rmSync(folder, { recursive: true, force: true });
  }
});

test("legacy fallback still requires its exact provider account assertion after discovery", async () => {
  const folder = mkdtempSync(join(tmpdir(), "studio-fallback-policy-"));
  writeFileSync(join(folder, "content-request.json"), JSON.stringify({ origin: "human-inference" }));
  const calls: string[] = [];
  const configured = deps(false, calls);
  delete configured.resolveDeliveryPolicy;
  const previousTypefully = process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID;
  delete process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID;
  try {
    const result = await scheduleApproved(folder, row(), configured);
    assert.deepEqual(calls, []);
    assert.match(result.scheduleError ?? "", /CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID is missing/);
  } finally {
    if (previousTypefully === undefined) delete process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID;
    else process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID = previousTypefully;
    rmSync(folder, { recursive: true, force: true });
  }
});

test("legacy provider fallback occurs only after discovered registry says capability is unsupported", async () => {
  const calls: string[] = [];
  const result = await scheduleApproved("/unused", row(), deps(false, calls));
  assert.deepEqual(calls, ["typefully"]);
  assert.equal((result.scheduled as { draftId: string }).draftId, "tf-1");
  assert.equal(result.scheduleError, null);
});

test("ordinary local media falls back when Postiz has no explicit upload registration capability", async () => {
  const calls: string[] = [];
  const configured = deps(true, calls);
  configured.fetchPostizRegistry = async () => ({ fetchedAt: "2026-01-01T00:00:00Z", capabilities: [{
    destination: "x", media: ["image"], accountId: "acct-1", accountLabel: "Human Inference",
  }] });
  configured.publishCards = async () => { calls.push("typefully-card"); return [{ draftId: "tf-card-1" }]; };
  const result = await scheduleApproved("/unused", row({ id: "card-1", platform: "quote-card:x", format: "image", asset: "images/card.png" }), configured);
  assert.deepEqual(calls, ["typefully-card"]);
  assert.equal(result.scheduleError, null);
});

test("Postiz discovery transport failure is explicit and never silently falls back", async () => {
  const calls: string[] = [];
  const configured = deps(true, calls);
  configured.fetchPostizRegistry = async () => { throw new Error("registry connection refused"); };
  const result = await scheduleApproved("/unused", row(), configured);
  assert.deepEqual(calls, []);
  assert.match(result.scheduleError ?? "", /capability discovery failed.*route is uncertain.*connection refused/i);
});

test("malformed Postiz discovery cannot authorize legacy fallback", async () => {
  const calls: string[] = [];
  const configured = deps(true, calls);
  configured.fetchPostizRegistry = async () => ({ fetchedAt: "2026-01-01T00:00:00Z" } as never);
  const result = await scheduleApproved("/unused", row(), configured);
  assert.deepEqual(calls, []);
  assert.ok(result.scheduleError, "malformed discovery must surface an error instead of selecting Typefully");
});
