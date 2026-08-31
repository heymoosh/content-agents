import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { after, afterEach, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { publishingRetryBlock, readPublishingHistory, readPublishingStatuses, resolvePublishingAttempt, scheduleApprovedOnce } from "./publishing-status.js";
import type { QueueRow } from "../publish/queue.js";

const roots: string[] = [];
const priorAccount = process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID;
const priorPostizAccount = process.env.CONTENT_AGENTS_POSTIZ_ACCOUNT_ID;
const priorPostpeerAccount = process.env.CONTENT_AGENTS_POSTPEER_ACCOUNT_ID;
const priorYoutubeAccount = process.env.CONTENT_AGENTS_YOUTUBE_ACCOUNT_ID;
before(() => {
  process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID = "human-inference/typefully";
  process.env.CONTENT_AGENTS_POSTIZ_ACCOUNT_ID = "human-inference/postiz";
  process.env.CONTENT_AGENTS_POSTPEER_ACCOUNT_ID = "human-inference/postpeer";
  process.env.CONTENT_AGENTS_YOUTUBE_ACCOUNT_ID = "human-inference/youtube";
});
after(() => {
  if (priorAccount === undefined) delete process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID;
  else process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID = priorAccount;
  if (priorPostizAccount === undefined) delete process.env.CONTENT_AGENTS_POSTIZ_ACCOUNT_ID;
  else process.env.CONTENT_AGENTS_POSTIZ_ACCOUNT_ID = priorPostizAccount;
  if (priorPostpeerAccount === undefined) delete process.env.CONTENT_AGENTS_POSTPEER_ACCOUNT_ID;
  else process.env.CONTENT_AGENTS_POSTPEER_ACCOUNT_ID = priorPostpeerAccount;
  if (priorYoutubeAccount === undefined) delete process.env.CONTENT_AGENTS_YOUTUBE_ACCOUNT_ID;
  else process.env.CONTENT_AGENTS_YOUTUBE_ACCOUNT_ID = priorYoutubeAccount;
});
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function ledger(): string { const root = mkdtempSync(join(tmpdir(), "publishing-status-")); roots.push(root); return join(root, "ledger.jsonl"); }
function contentFolder(origin = "human-inference"): string {
  const root = mkdtempSync(join(tmpdir(), "publishing-content-")); roots.push(root);
  writeFileSync(join(root, "content-request.json"), JSON.stringify({ origin }));
  mkdirSync(join(root, "derivatives"));
  writeFileSync(join(root, "derivatives", "x-1.md"), "---\nplatform: x\n---\n\nApproved body.\n");
  return root;
}
const row: QueueRow = { id: "x-1", platform: "x", format: "text", asset: "derivatives/x-1.md", status: "pending", notes: "", lineIndex: 2 };
const execFileAsync = promisify(execFile);

describe("durable publishing status", () => {
  test("records provider, reference, planned time, and prevents a repeat schedule", async () => {
    const path = ledger(); let calls = 0;
    const folder = contentFolder();
    const first = await scheduleApprovedOnce(folder, "piece", row, async () => {
      calls++; return { scheduled: { id: "x-1", platform: "x", when: "Monday 9:00 AM", plannedFor: "2026-09-01T16:00:00.000Z", draftId: "tf-1" }, scheduleError: null };
    }, path);
    assert.equal(first.publishing.state, "planned");
    assert.equal(first.publishing.provider, "typefully");
    assert.equal(first.publishing.ref, "tf-1");
    assert.equal(first.publishing.plannedFor, "2026-09-01T16:00:00.000Z");
    assert.equal(first.publishing.origin, "human-inference");
    assert.equal(first.publishing.brand, "human-inference");
    assert.equal(first.publishing.deliveryMode, "provider");
    assert.equal(first.publishing.providerAccountId, "human-inference/typefully");
    assert.equal(first.publishing.policyVersion, "delivery-policy-v1");
    assert.throws(() => resolvePublishingAttempt("piece", "x-1", "not-created", {}, path), /no uncertain/i,
      "a completed scheduled event can never be overwritten by a cleared retry state");
    await assert.rejects(() => scheduleApprovedOnce(folder, "piece", row, async () => {
      calls++; return { scheduled: null, scheduleError: null };
    }, path), /already|uncertain/i);
    assert.equal(calls, 1);
    assert.equal(readPublishingStatuses(path)["piece/x-1"]?.state, "planned");
  });

  test("serializes publishing-ledger appends across processes", async () => {
    const path = ledger();
    const source = `import { appendPublishingStatus } from "./src/review/publishing-status.ts";
appendPublishingStatus({ slug: "child", rowId: process.argv[2], provider: "manual", state: "private", at: new Date().toISOString(), providerObjectId: process.argv[2] }, process.argv[1]);`;
    await Promise.all(Array.from({ length: 8 }, (_, index) => execFileAsync(process.execPath, [
      "--import", "tsx", "--input-type=module", "-e", source, path, `row-${index}`,
    ], { cwd: process.cwd() })));
    const history = readPublishingHistory(path);
    assert.equal(history.length, 8);
    assert.equal(new Set(history.map((event) => event.rowId)).size, 8);
  });

  test("persists uncertain failures so a blind retry cannot duplicate an accepted provider request", async () => {
    const path = ledger();
    const folder = contentFolder();
    const result = await scheduleApprovedOnce(folder, "piece", row, async () => ({ scheduled: null, scheduleError: "network timeout" }), path);
    assert.equal(result.publishing.state, "uncertain");
    assert.equal(result.publishing.error, "network timeout");
    await assert.rejects(() => scheduleApprovedOnce(folder, "piece", row, async () => ({ scheduled: null, scheduleError: null }), path), /uncertain/i);
    const cleared = resolvePublishingAttempt("piece", "x-1", "not-created", {}, path);
    assert.equal(cleared.state, "canceled");
    assert.equal(publishingRetryBlock("piece", { ...row, status: "approve" }, path), null);
  });

  test("a newly approved row with an empty ledger remains retryable after discovery fails before dispatch", async () => {
    const path = ledger();
    const folder = contentFolder();
    const approved = { ...row, status: "approve" as const };
    const discoveryFailure = {
      fetchPostizRegistry: async () => { throw new Error("registry connection refused"); },
      postizEnv: { POSTIZ_ACCOUNT_ID: "acct" },
    };
    // /api/status retains the pre-write row snapshot (pending) for this first call, then the
    // persisted queue row is `approve` on the explicit retry.
    const failed = await scheduleApprovedOnce(folder, "piece", row, async () => {
      throw new Error("scheduler must not run when discovery failed");
    }, path, discoveryFailure);
    assert.equal(failed.publishing.state, "failed");
    assert.match(failed.scheduleError ?? "", /before dispatch.*no provider request was made.*route is uncertain/i);
    assert.equal(readPublishingHistory(path).length, 1, "the pre-dispatch failure must be durably audited");
    assert.equal(publishingRetryBlock("piece", approved, path), null, "a proven pre-dispatch failure is safe to retry");

    let calls = 0;
    const retried = await scheduleApprovedOnce(folder, "piece", approved, async () => {
      calls++; return { scheduled: { draftId: "tf-retry", when: "Tomorrow" }, scheduleError: null };
    }, path, {
      fetchPostizRegistry: async () => ({ fetchedAt: "2026-01-01T00:00:00Z", capabilities: [] }),
      postizEnv: { POSTIZ_ACCOUNT_ID: "acct" },
    });
    assert.equal(calls, 1);
    assert.equal(retried.publishing.state, "planned");
    assert.equal(retried.publishing.providerObjectId, "tf-retry");
  });

  test("normalizes legacy publisher references into stable provider object ids", async () => {
    const cases = [
      { row: { ...row, id: "card", platform: "quote-card:x", format: "image" }, ref: "typefully draft tf-card-7", expected: "tf-card-7" },
      { row: { ...row, id: "tiktok", platform: "tiktok", format: "video" }, ref: "postpeer post pp-8", expected: "pp-8" },
      { row: { ...row, id: "youtube", platform: "youtube", format: "short" }, ref: "https://youtube.com/shorts/yt-9", expected: "yt-9" },
    ];
    for (const item of cases) {
      const result = await scheduleApprovedOnce(contentFolder(), `piece-${item.row.id}`, item.row, async () => ({
        scheduled: { when: "Tomorrow", ref: item.ref }, scheduleError: null,
      }), ledger());
      assert.equal(result.publishing.providerObjectId, item.expected);
      assert.equal(result.publishing.ref, item.expected);
    }
  });

  test("a human-confirmed provider result records the item without retrying", async () => {
    const path = ledger();
    await scheduleApprovedOnce(contentFolder(), "piece", row, async () => ({ scheduled: null, scheduleError: "connection ended" }), path);
    const found = resolvePublishingAttempt("piece", "x-1", "exists", { ref: "tf-9", plannedFor: "Tomorrow" }, path);
    assert.equal(found.state, "planned");
    assert.equal(found.providerObjectId, "tf-9");
    assert.match(publishingRetryBlock("piece", { ...row, status: "approve" }, path) ?? "", /planned/i);
  });

  test("an atomic claim blocks a second Studio process while the first provider call is open", async () => {
    const path = ledger();
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => { release = resolve; });
    const folder = contentFolder();
    const first = scheduleApprovedOnce(folder, "piece", row, async () => {
      await waiting;
      return { scheduled: { when: "Tomorrow", draftId: "tf-1" }, scheduleError: null };
    }, path);
    const claims = join(dirname(path), ".publishing-claims");
    const lock = join(claims, readdirSync(claims)[0]);
    const claim = JSON.parse(readFileSync(lock, "utf8"));
    writeFileSync(lock, JSON.stringify({ ...claim, claimedAt: "2000-01-01T00:00:00.000Z" }) + "\n");
    assert.throws(() => resolvePublishingAttempt("piece", "x-1", "not-created", {}, path), /still active/i,
      "a live PID stays active even when the timestamp is old");
    await assert.rejects(() => scheduleApprovedOnce(folder, "piece", row, async () => ({ scheduled: null, scheduleError: null }), path), /another Studio process|already.*claim/i);
    release();
    await first;
  });

  test("an already-approved legacy row is never blindly rescheduled without reconciliation", () => {
    assert.match(publishingRetryBlock("piece", { ...row, status: "approve" }, ledger()) ?? "", /already approved/i);
  });

  test("outreach locking remains manual and does not require publishing identity metadata", async () => {
    const path = ledger(); let calls = 0;
    const outreach = { ...row, platform: "email", format: "outreach-message" };
    const result = await scheduleApprovedOnce(contentFolder(), "piece", outreach, async () => {
      calls++; return { scheduled: { autoPublishes: false }, scheduleError: null };
    }, path);
    assert.equal(calls, 1);
    assert.equal(result.publishing.provider, "manual");
    assert.equal(result.publishing.state, "private");
    assert.equal(result.publishing.providerAccountId, null);
  });

  test("persists Charles manual delivery as a private ledger outcome with no provider account", async () => {
    const path = ledger();
    const result = await scheduleApprovedOnce(contentFolder("charles"), "charles-piece", row, async () => {
      return { scheduled: { autoPublishes: false, readyToPaste: "ready-to-paste/x-1.txt" }, scheduleError: null };
    }, path);
    assert.equal(result.publishing.state, "private");
    assert.equal(result.publishing.origin, "charles");
    assert.equal(result.publishing.brand, "charles");
    assert.equal(result.publishing.deliveryMode, "manual");
    assert.equal(result.publishing.provider, "typefully");
    assert.equal(result.publishing.providerAccountId, null);
    assert.equal(result.publishing.policyVersion, "delivery-policy-v1");
    assert.match(result.publishing.policyReason ?? "", /ready-to-paste/i);
    assert.equal(readPublishingStatuses(path)["charles-piece/x-1"]?.state, result.publishing.state);
  });

  test("persists Fiction's blocked delivery policy without invoking a provider", async () => {
    const path = ledger(); let calls = 0;
    const result = await scheduleApprovedOnce(contentFolder("fiction"), "fiction-piece", row, async () => {
      calls++; return { scheduled: null, scheduleError: null };
    }, path);
    assert.equal(calls, 0);
    assert.equal(result.publishing.state, "blocked");
    assert.equal(result.publishing.origin, "fiction");
    assert.equal(result.publishing.brand, "fiction");
    assert.equal(result.publishing.deliveryMode, "blocked");
    assert.equal(result.publishing.provider, "typefully");
    assert.equal(result.publishing.providerAccountId, null);
    assert.equal(result.publishing.policyVersion, "delivery-policy-v1");
    assert.match(result.publishing.error ?? "", /no separately configured provider account/i);
    assert.equal(readPublishingStatuses(path)["fiction-piece/x-1"]?.state, result.publishing.state);
  });

  test("reads old lines without rewriting them and retains the full append-only history", () => {
    const path = ledger();
    writeFileSync(path,
      JSON.stringify({ slug: "old", rowId: "x-1", provider: "typefully", state: "scheduled", at: "2026-01-01T00:00:00.000Z", ref: "draft-1" }) + "\n" +
      JSON.stringify({ slug: "old", rowId: "x-1", provider: "typefully", state: "live", at: "2026-01-02T00:00:00.000Z", providerObjectId: "draft-1", canonicalUrl: "https://x.test/1" }) + "\n");
    const history = readPublishingHistory(path);
    assert.equal(history.length, 2);
    assert.equal(history[0].state, "planned");
    assert.equal(history[0].legacyState, "scheduled");
    assert.equal(history[0].providerObjectId, "draft-1");
    assert.equal(readPublishingStatuses(path)["old/x-1"]?.state, "live");
  });

  test("capability-selected Postiz scheduling persists stable provider identity and timestamps", async () => {
    const path = ledger();
    const selection = {
      postizEnv: { POSTIZ_ACCOUNT_ID: "acct-real" },
      fetchPostizRegistry: async () => ({ fetchedAt: "2026-01-01T00:00:00Z", capabilities: [{
        destination: "x" as const, media: ["text" as const], accountId: "acct-real", accountLabel: "Human Inference",
      }] }),
    };
    const result = await scheduleApprovedOnce(contentFolder(), "piece", row, async (_folder, _row, _deps, policy) => {
      assert.equal(policy?.provider, "postiz");
      return { scheduled: {
        providerObjectId: "pz-7", providerAccountId: "acct-real", canonicalUrl: "https://social.test/pz-7",
        status: "published", providerCreatedAt: "2026-01-01T00:00:00Z", providerUpdatedAt: "2026-01-02T00:00:00Z",
        providerPublishedAt: "2026-01-03T00:00:00Z",
      }, scheduleError: null };
    }, path, selection);
    assert.equal(result.publishing.provider, "postiz");
    assert.equal(result.publishing.state, "live");
    assert.equal(result.publishing.providerObjectId, "pz-7");
    assert.equal(result.publishing.providerAccountId, "acct-real");
    assert.equal(result.publishing.canonicalUrl, "https://social.test/pz-7");
    assert.equal(readPublishingStatuses(path)["piece/x-1"]?.providerPublishedAt, "2026-01-03T00:00:00Z");
  });
});
