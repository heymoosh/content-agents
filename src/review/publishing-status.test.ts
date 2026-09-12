import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { after, afterEach, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { appendPublishingStatus, disposableProviderOutcome, publishingRetryBlock, readPublishingHistory, readPublishingStatuses, resolvePublishingAttempt, scheduleApprovedOnce } from "./publishing-status.js";
import { readQueue, writeCell, type QueueRow } from "../publish/queue.js";
import { approvalDispatchDisposition, commitReviewStatus, journalPathForLedger, recordNewQueueRows } from "./approval-provenance.js";
import { scheduleApproved, type SchedulerDeps } from "./studio-scheduling.js";

const roots: string[] = [];
const priorAccount = process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID;
const priorPostizAccount = process.env.CONTENT_AGENTS_POSTIZ_ACCOUNT_ID;
const priorPostpeerAccount = process.env.CONTENT_AGENTS_POSTPEER_ACCOUNT_ID;
const priorYoutubeAccount = process.env.CONTENT_AGENTS_YOUTUBE_ACCOUNT_ID;

test("the scheduling disposition branch is exhaustively narrowed after blocked and legacy cases", () => {
  const source = readFileSync(new URL("./publishing-status.ts", import.meta.url), "utf8");
  assert.match(source, /const _never:\s*never\s*=\s*disposition/);
  assert.doesNotMatch(source, /disposition\.kind !== "fresh" && disposition\.kind !== "adopted"/);
});

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

test("disposable provider outcomes require the matching token, marker, and repository root", () => {
  const root = mkdtempSync(join(tmpdir(), "disposable-provider-")); roots.push(root);
  writeFileSync(join(root, ".e2e-scheduling-token"), "one-run-secret");
  const env = { CONTENT_AGENTS_E2E_SCHEDULING_TOKEN: "one-run-secret", E2E_REPO_ROOT: root };
  assert.equal(disposableProviderOutcome({ id: "e2e-provider-success" }, {}, root), null);
  assert.equal(disposableProviderOutcome({ id: "e2e-provider-success" }, { ...env, CONTENT_AGENTS_E2E_SCHEDULING_TOKEN: "wrong" }, root), null);
  assert.equal(disposableProviderOutcome({ id: "e2e-provider-success" }, { ...env, E2E_REPO_ROOT: tmpdir() }, root), null);
  assert.equal(disposableProviderOutcome({ id: "ordinary-row" }, env, root), null);
  assert.deepEqual(disposableProviderOutcome({ id: "e2e-provider-success" }, env, root), {
    provider: "typefully", scheduled: { draftId: "e2e-provider-object", when: "Sep 2 at 9:00 AM", plannedFor: "2026-09-02T14:00:00.000Z" }, scheduleError: null,
  });
  assert.deepEqual(disposableProviderOutcome({ id: "e2e-provider-failure" }, env, root), {
    provider: "typefully", scheduled: null, scheduleError: "injected provider timeout",
  });
});
const row: QueueRow = { id: "x-1", platform: "x", format: "text", asset: "derivatives/x-1.md", status: "pending", notes: "", lineIndex: 2 };

/** Build the real status and provenance transition rather than passing a stale row to a mock. */
function approvedContentFolder(path: string, input: QueueRow = row, origin = "human-inference", slug = "piece"): string {
  const root = mkdtempSync(join(tmpdir(), "publishing-approved-")); roots.push(root);
  const folder = join(root, slug);
  mkdirSync(join(folder, dirname(input.asset)), { recursive: true });
  writeFileSync(join(folder, "content-request.json"), JSON.stringify({ origin }));
  writeFileSync(join(folder, input.asset), `---\nplatform: ${input.platform}\n---\n\nApproved body.\n`);
  writeFileSync(join(folder, "review-queue.md"),
    "| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |\n" +
    "|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|\n" +
    `| ${input.id} | ${input.platform} | ${input.format} | ${input.asset} | — | — | — | pending | | from GUI queue |\n`);
  const journal = journalPathForLedger(path);
  recordNewQueueRows(folder, readQueue(folder).rows, journal);
  const committed = commitReviewStatus(folder, slug, input.id, "approve", () => writeCell(folder, input.id, { status: "approve" }), path, journal);
  assert.equal(committed, true);
  return folder;
}
const execFileAsync = promisify(execFile);

describe("durable publishing status", () => {
  test("a Postiz rate limit records failed with the resume time and stays retry-eligible", async () => {
    const path = ledger();
    const folder = approvedContentFolder(path);
    const message = "Postiz rate limit reached (429): the create-post endpoint allows 90 requests per hour across the whole instance, and each schedule or move counts as one. Nothing was created. Studio resumes the waiting rows automatically after 2026-09-02T19:10:00.000Z.";
    const result = await scheduleApprovedOnce(folder, "piece", row, async () => ({ scheduled: null, scheduleError: message }), path);
    assert.equal(result.publishing.state, "failed");
    assert.match(result.publishing.error ?? "", /after 2026-09-02T19:10:00.000Z/);
    assert.equal(publishingRetryBlock("piece", { ...row, status: "approve" }, path), null);
    const second = await scheduleApprovedOnce(folder, "piece", { ...row, status: "approve" }, async () => ({ scheduled: { draftId: "p-1", when: "later", plannedFor: "2026-09-10T16:00:00.000Z" }, scheduleError: null }), path);
    assert.notEqual(second.publishing.state, "failed");
    assert.equal(second.scheduleError, null);
  });

  test("records provider, reference, planned time, and prevents a repeat schedule", async () => {
    const path = ledger(); let calls = 0;
    const folder = approvedContentFolder(path);
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

  test("a private Typefully draft retains its id without a planned time and blocks a later scheduled create", async () => {
    const path = ledger();
    const folder = approvedContentFolder(path);
    let calls = 0;
    const privateDraft = await scheduleApprovedOnce(folder, "piece", row, async () => {
      calls++;
      return { scheduled: { draftId: "private-draft-1", when: "unscheduled", plannedFor: null, autoPublishes: false }, scheduleError: null };
    }, path, undefined, "unscheduled-draft");
    assert.equal(privateDraft.publishing.state, "private");
    assert.equal(privateDraft.publishing.providerObjectId, "private-draft-1");
    assert.equal(privateDraft.publishing.plannedFor, undefined);
    await assert.rejects(() => scheduleApprovedOnce(folder, "piece", row, async () => {
      calls++;
      return { scheduled: { draftId: "would-duplicate" }, scheduleError: null };
    }, path), /already has a private publishing attempt|durable dispatch fence/i);
    assert.equal(calls, 1, "an existing private draft blocks the ordinary scheduled route too");
  });

  test("a private Typefully draft blocks a repeated private create", async () => {
    const path = ledger();
    const folder = approvedContentFolder(path);
    let calls = 0;
    await scheduleApprovedOnce(folder, "piece", row, async () => {
      calls++;
      return { scheduled: { draftId: "private-draft-1", when: "unscheduled", plannedFor: null, autoPublishes: false }, scheduleError: null };
    }, path, undefined, "unscheduled-draft");
    await assert.rejects(() => scheduleApprovedOnce(folder, "piece", row, async () => {
      calls++;
      return { scheduled: { draftId: "would-duplicate" }, scheduleError: null };
    }, path, undefined, "unscheduled-draft"), /already has a private publishing attempt|durable dispatch fence/i);
    assert.equal(calls, 1, "an existing private draft blocks another private route too");
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
    const folder = approvedContentFolder(path);
    const result = await scheduleApprovedOnce(folder, "piece", row, async () => ({ scheduled: null, scheduleError: "network timeout" }), path);
    assert.equal(result.publishing.state, "uncertain");
    assert.equal(result.publishing.error, "network timeout");
    await assert.rejects(() => scheduleApprovedOnce(folder, "piece", row, async () => ({ scheduled: null, scheduleError: null }), path), /durable dispatch fence/i);
    const cleared = resolvePublishingAttempt("piece", "x-1", "not-created", {}, path);
    assert.equal(cleared.state, "canceled");
    assert.equal(publishingRetryBlock("piece", { ...row, status: "approve" }, path), null);
  });

  test("a newly approved row with an empty ledger remains retryable after discovery fails before dispatch", async () => {
    const path = ledger();
    const folder = approvedContentFolder(path);
    const approved = { ...row, status: "approve" as const };
    const discoveryFailure = {
      fetchPostizRegistry: async () => { throw new Error("registry connection refused"); },
      postizEnv: { POSTIZ_ACCOUNT_ID: "acct" },
    };
    // The scheduler re-reads the committed approve transition before both attempts.
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
      // SLICE-7B moved the vehicle, not the subject. An empty registry used to route an x/text row
      // to Typefully; it now refuses, which would mask the retry this test is about. A registry
      // that advertises the row's own channel keeps the retry reaching the scheduler.
      fetchPostizRegistry: async () => ({ fetchedAt: "2026-01-01T00:00:00Z", capabilities: [{
        destination: "x" as const, media: ["text" as const], accountId: "acct", accountLabel: "Human Inference",
      }] }),
      postizEnv: { POSTIZ_ACCOUNT_ID: "acct" },
    });
    assert.equal(calls, 1);
    assert.equal(retried.publishing.state, "planned");
    assert.equal(retried.publishing.providerObjectId, "tf-retry");
    // SLICE-7B audit P2. The three asserts above are byte-identical to what they were, but none of
    // them names the route, and `tf-retry` is only the stub's object id. State the vehicle the
    // retry actually uses now, so a regression in provider selection on the retry path cannot pass
    // here unnoticed.
    assert.equal(retried.publishing.provider, "postiz", "the retry selects the channel the registry advertises");
  });

  test("normalizes legacy publisher references into stable provider object ids", async () => {
    const cases = [
      { row: { ...row, id: "card", platform: "quote-card:x", format: "image" }, ref: "typefully draft tf-card-7", expected: "tf-card-7" },
      { row: { ...row, id: "tiktok", platform: "tiktok", format: "video" }, ref: "postpeer post pp-8", expected: "pp-8" },
      { row: { ...row, id: "youtube", platform: "youtube", format: "short" }, ref: "https://youtube.com/shorts/yt-9", expected: "yt-9" },
    ];
    for (const item of cases) {
      const path = ledger();
      const slug = `piece-${item.row.id}`;
      const folder = approvedContentFolder(path, item.row, "human-inference", slug);
      const result = await scheduleApprovedOnce(folder, slug, item.row, async () => ({
        scheduled: { when: "Tomorrow", ref: item.ref }, scheduleError: null,
      }), path);
      assert.equal(result.publishing.providerObjectId, item.expected);
      assert.equal(result.publishing.ref, item.expected);
    }
  });

  test("a human-confirmed provider result records the item without retrying", async () => {
    const path = ledger();
    const folder = approvedContentFolder(path);
    await scheduleApprovedOnce(folder, "piece", row, async () => ({ scheduled: null, scheduleError: "connection ended" }), path);
    const found = resolvePublishingAttempt("piece", "x-1", "exists", { ref: "tf-9", plannedFor: "Tomorrow" }, path);
    assert.equal(found.state, "planned");
    assert.equal(found.providerObjectId, "tf-9");
    assert.match(publishingRetryBlock("piece", { ...row, status: "approve" }, path) ?? "", /planned/i);
  });

  test("an atomic claim blocks a second Studio process while the first provider call is open", async () => {
    const path = ledger();
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => { release = resolve; });
    const folder = approvedContentFolder(path);
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
    const result = await scheduleApprovedOnce(approvedContentFolder(path, outreach), "piece", outreach, async () => {
      calls++; return { scheduled: { autoPublishes: false }, scheduleError: null };
    }, path);
    assert.equal(calls, 1);
    assert.equal(result.publishing.provider, "manual");
    assert.equal(result.publishing.state, "private");
    assert.equal(result.publishing.providerAccountId, null);
  });

  test("persists Charles manual delivery as a private ledger outcome with no provider account", async () => {
    const path = ledger();
    const folder = approvedContentFolder(path, row, "charles", "charles-piece");
    const result = await scheduleApprovedOnce(folder, "charles-piece", row, async () => {
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
    const folder = approvedContentFolder(path, row, "fiction", "fiction-piece");
    const result = await scheduleApprovedOnce(folder, "fiction-piece", row, async () => {
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
    const folder = approvedContentFolder(path);
    const result = await scheduleApprovedOnce(folder, "piece", row, async (_folder, _row, _deps, policy) => {
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

// ── SLICE-7A: a refusal must not leave a permanent dispatch fence, and must not leave a clearable
//    one either ──────────────────────────────────────────────────────────────────────────────────
//
// Observed on bluesky-1 (2026-09-12): the reuse guard refused the row before Postiz was contacted
// at all, yet the attempt left `dispatch_started` with no `dispatch_resolved`, so every later
// Schedule click died on "this row already has a durable dispatch fence". The row was bricked.
//
// The opposite error is worse, so it gets equal weight here. A refusal recovered AFTER a publisher
// already ran proves nothing about provider state. If such a row were recorded `uncertain` it would
// become resolve-eligible, and a human could clear its fence and re-send a post the provider may
// already hold. So both kinds of refusal record `blocked`, and only the pre-dispatch kind clears a
// fence.
//
// Everything below asserts observable state: what the publishing ledger holds, what the approval
// safety journal holds, whether a retry is permitted, whether reconciliation is accepted, and
// whether a second Schedule actually reaches the scheduler again.
describe("SLICE-7A: refusals clear a fence only when nothing reached the provider", () => {
  const approved = { ...row, status: "approve" as const };
  const outcome = (message: string, refusal: "no-provider-request" | "publisher-declined") =>
    async () => ({ scheduled: null, scheduleError: message, refusal });
  function journalEvents(path: string): Record<string, unknown>[] {
    const journal = journalPathForLedger(path);
    if (!existsSync(journal)) return [];
    return readFileSync(journal, "utf8").split("\n").filter((line) => line.trim()).map((line) => JSON.parse(line));
  }

  /** The four refusal strings, each keyed to the producer that can actually emit it.
   *  Pre-flight strings are raised before any create or slot claim; recovery-branch strings are
   *  rebuilt after a publisher already ran. The same-row wording appears on BOTH sides, which is
   *  exactly why the discriminant, not the text, decides. */
  const REFUSALS: { name: string; message: string; refusal: "no-provider-request" | "publisher-declined" }[] = [
    { name: "pre-flight, same row inside min_reuse_days", refusal: "no-provider-request",
      message: "blocked by reuse guard, last placed to bluesky 2026-09-11T00:00:00.000Z (min_reuse_days: 21)" },
    { name: "pre-flight, unspecified guard refusal", refusal: "no-provider-request",
      message: "not scheduled: blocked by the reuse guard (check the server log for the reason)" },
    { name: "pre-flight, no brand resolved", refusal: "no-provider-request",
      message: "not scheduled: the delivery policy resolved no brand, so the reuse guard has no Placed log to check" },
    { name: "recovery, same row inside min_reuse_days", refusal: "publisher-declined",
      message: "blocked by reuse guard, last placed to x 2026-09-11T00:00:00.000Z (min_reuse_days: 14)" },
    { name: "recovery, unspecified guard refusal", refusal: "publisher-declined",
      message: "not scheduled: blocked by the reuse guard (check the server log for the reason)" },
    { name: "recovery, another derivative inside min_variant_days", refusal: "publisher-declined",
      message: "not scheduled: another post from this piece already went to bluesky on 2026-09-11T00:00:00.000Z."
        + " This one can go out from 2026-09-18T00:00:00.000Z (min_variant_days: 7)" },
  ];

  for (const item of REFUSALS) {
    test(`records blocked, and clears its fence only when pre-dispatch — ${item.name}`, async () => {
      const path = ledger();
      const folder = approvedContentFolder(path);
      const result = await scheduleApprovedOnce(folder, "piece", row, outcome(item.message, item.refusal), path);

      assert.equal(result.publishing.state, "blocked", "every guard refusal is blocked, never uncertain");
      assert.equal(result.publishing.error, item.message);

      const resolved = journalEvents(path).filter((e) => e.kind === "dispatch_resolved");
      const disposition = approvalDispatchDisposition(folder, "piece", approved, path);
      if (item.refusal === "no-provider-request") {
        assert.equal(resolved.length, 1, "nothing reached the provider, so the fence must clear");
        assert.equal(resolved[0].resolution, "not-created", "never `exists`: there is no object to point at");
        assert.equal(disposition.kind, "reconciled-not-created", `no durable fence survives: ${JSON.stringify(disposition)}`);
      } else {
        assert.equal(resolved.length, 0, "a publisher already ran, so its fence must be retained");
        assert.equal(disposition.kind, "blocked");
        assert.match((disposition as { reason: string }).reason, /durable dispatch fence/);
      }
    });
  }

  test("a pre-dispatch refusal is schedulable again with no hand repair", async () => {
    const path = ledger();
    const folder = approvedContentFolder(path);
    const message = REFUSALS[0].message;
    let calls = 0;
    const refuse = async () => { calls++; return { scheduled: null, scheduleError: message, refusal: "no-provider-request" as const }; };

    const first = await scheduleApprovedOnce(folder, "piece", row, refuse, path);
    assert.equal(first.publishing.state, "blocked");
    assert.equal(publishingRetryBlock("piece", approved, path), null, "the row stays retryable");

    // The second Schedule reaches the guard again instead of dying on a fence.
    const second = await scheduleApprovedOnce(folder, "piece", approved, refuse, path);
    assert.equal(calls, 2, "the scheduler really ran a second time");
    assert.equal(second.scheduleError, message, "refused by the guard again, not by the fence");

    // And once the window opens, the same row schedules. No coordinator, no resolveDispatchFence.
    const third = await scheduleApprovedOnce(folder, "piece", approved, async () => ({
      scheduled: { draftId: "tf-window-open", when: "Tomorrow" }, scheduleError: null,
    }), path);
    assert.equal(third.publishing.state, "planned");
    assert.equal(third.publishing.providerObjectId, "tf-window-open");
  });

  test("a publisher-declined row cannot be reconciled clear and cannot be rescheduled", async () => {
    const path = ledger();
    const folder = approvedContentFolder(path);
    let calls = 0;
    const declined = async () => { calls++; return { scheduled: null, scheduleError: REFUSALS[3].message, refusal: "publisher-declined" as const }; };
    const first = await scheduleApprovedOnce(folder, "piece", row, declined, path);
    assert.equal(first.publishing.state, "blocked");

    // `blocked` is deliberately NOT resolve-eligible. This is the door that would otherwise let a
    // human clear the fence and re-send a post the publisher may already have created.
    assert.throws(() => resolvePublishingAttempt("piece", "x-1", "not-created", {}, path), /no uncertain/i);
    // And the retained fence stops a second dispatch outright.
    await assert.rejects(() => scheduleApprovedOnce(folder, "piece", approved, declined, path), /durable dispatch fence/i);
    assert.equal(calls, 1, "the scheduler must not run a second time");
  });

  test("the discriminant is typed: wording is never what decides", async () => {
    // A refusal nobody has written yet still clears the fence, because the discriminant carries it.
    const path = ledger();
    const folder = approvedContentFolder(path);
    const reworded = await scheduleApprovedOnce(folder, "piece", row,
      outcome("the reuse guard said no, in wording that has not been written yet", "no-provider-request"), path);
    assert.equal(reworded.publishing.state, "blocked");
    assert.equal(approvalDispatchDisposition(folder, "piece", approved, path).kind, "reconciled-not-created");

    // The mirror image, and the load-bearing half: today's exact guard wording with NO discriminant
    // stays uncertain and stays fenced. A reader that sniffed the prefix would fail here.
    const textOnlyPath = ledger();
    const textOnlyFolder = approvedContentFolder(textOnlyPath);
    const textOnly = await scheduleApprovedOnce(textOnlyFolder, "piece", row, async () => ({
      scheduled: null, scheduleError: REFUSALS[0].message,
    }), textOnlyPath);
    assert.equal(textOnly.publishing.state, "uncertain", "the message alone proves nothing about a network call");
    const fenced = approvalDispatchDisposition(textOnlyFolder, "piece", approved, textOnlyPath);
    assert.equal(fenced.kind, "blocked");
    assert.match((fenced as { reason: string }).reason, /durable dispatch fence/);
  });

  test("fails closed: a generic provider error keeps uncertain and keeps its fence", async () => {
    const path = ledger();
    const folder = approvedContentFolder(path);
    const result = await scheduleApprovedOnce(folder, "piece", row, async () => ({
      scheduled: null, scheduleError: "connection reset by peer",
    }), path);
    assert.equal(result.publishing.state, "uncertain");
    assert.equal(journalEvents(path).filter((e) => e.kind === "dispatch_resolved").length, 0, "no fence may be cleared");
    const disposition = approvalDispatchDisposition(folder, "piece", approved, path);
    assert.equal(disposition.kind, "blocked");
    assert.match((disposition as { reason: string }).reason, /durable dispatch fence/);
    assert.match(publishingRetryBlock("piece", approved, path) ?? "", /uncertain/);
  });

  test("fails closed: a thrown scheduler callback keeps its fence", async () => {
    const path = ledger();
    const folder = approvedContentFolder(path);
    await assert.rejects(() => scheduleApprovedOnce(folder, "piece", row, async () => {
      throw new Error("socket hang up after the request left");
    }, path), /socket hang up/);
    assert.equal(readPublishingStatuses(path)["piece/x-1"]?.state, "uncertain");
    assert.equal(journalEvents(path).filter((e) => e.kind === "dispatch_resolved").length, 0, "no fence may be cleared");
    const disposition = approvalDispatchDisposition(folder, "piece", approved, path);
    assert.equal(disposition.kind, "blocked");
    assert.match((disposition as { reason: string }).reason, /durable dispatch fence/);
  });

  test("a Postiz rate limit is unchanged: still failed, still fence-resolved as not-created", async () => {
    const path = ledger();
    const folder = approvedContentFolder(path);
    const message = "Postiz rate limit reached (429): the create-post endpoint allows 90 requests per hour across the whole instance,"
      + " and each schedule or move counts as one. Nothing was created. Studio resumes the waiting rows automatically after 2026-09-02T19:10:00.000Z.";
    const result = await scheduleApprovedOnce(folder, "piece", row, async () => ({ scheduled: null, scheduleError: message }), path);
    assert.equal(result.publishing.state, "failed", "a throttle is not a guard refusal and keeps its own state");
    const resolved = journalEvents(path).filter((e) => e.kind === "dispatch_resolved");
    assert.equal(resolved.length, 1);
    assert.equal(resolved[0].resolution, "not-created");
  });

  test("a successful schedule is unchanged: terminal provider state, no fence resolution", async () => {
    const path = ledger();
    const folder = approvedContentFolder(path);
    const result = await scheduleApprovedOnce(folder, "piece", row, async () => ({
      scheduled: { draftId: "tf-ok", when: "Monday 9:00 AM", plannedFor: "2026-09-01T16:00:00.000Z" }, scheduleError: null,
    }), path);
    assert.equal(result.publishing.state, "planned");
    assert.equal(journalEvents(path).filter((e) => e.kind === "dispatch_resolved").length, 0,
      "a real provider object must keep its fence");
  });

  // Ordering across the two files. The ledger event and the journal event live in separate
  // append-only logs, so their recorded instants are the only cross-file evidence available: a
  // resolution stamped before its own terminal ledger event would mean the fence was cleared first,
  // which is the sequence that could leave a bare clearance with no record of what happened.
  test("the fence resolution is recorded no earlier than the terminal ledger event, and only after the fence opened", async () => {
    const path = ledger();
    const folder = approvedContentFolder(path);
    await scheduleApprovedOnce(folder, "piece", row, outcome(REFUSALS[0].message, "no-provider-request"), path);

    const terminal = readPublishingHistory(path).filter((e) => e.slug === "piece" && e.rowId === "x-1" && e.state === "blocked");
    assert.equal(terminal.length, 1, "exactly one terminal ledger event for this attempt");
    const dispatch = journalEvents(path).filter((e) => e.kind === "dispatch_started" || e.kind === "dispatch_resolved");
    assert.deepEqual(dispatch.map((e) => e.kind), ["dispatch_started", "dispatch_resolved"], "a fence is opened before it is resolved");
    assert.ok(
      Date.parse(String(dispatch[1].at)) >= Date.parse(terminal[0].at),
      `dispatch_resolved ${dispatch[1].at} must not predate the terminal ledger event ${terminal[0].at}`,
    );
  });

  test("a legacy row that never fenced takes the same refusal path without throwing", async () => {
    const path = ledger();
    // An approved row with a prior ledger event but NO approval journal at all: markDispatchStarted
    // never ran for it, so there is no fence to resolve. resolveDispatchFence must not be reached
    // and nothing may throw.
    const root = mkdtempSync(join(tmpdir(), "publishing-legacy-")); roots.push(root);
    const folder = join(root, "piece");
    mkdirSync(join(folder, "derivatives"), { recursive: true });
    writeFileSync(join(folder, "content-request.json"), JSON.stringify({ origin: "human-inference" }));
    writeFileSync(join(folder, "derivatives", "x-1.md"), "---\nplatform: x\n---\n\nApproved body.\n");
    writeFileSync(join(folder, "review-queue.md"),
      "| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |\n" +
      "|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|\n" +
      "| x-1 | x | text | derivatives/x-1.md | — | — | — | approve | | from GUI queue |\n");
    appendPublishingStatus({ slug: "piece", rowId: "x-1", provider: "typefully", state: "blocked", at: new Date().toISOString(), error: "an earlier refusal" }, path);

    const result = await scheduleApprovedOnce(folder, "piece", row, outcome(REFUSALS[0].message, "no-provider-request"), path);
    assert.equal(result.publishing.state, "blocked");
    assert.equal(journalEvents(path).length, 0, "a legacy row opens no fence and clears none");
    assert.equal(publishingRetryBlock("piece", approved, path), null);
  });
});

// ── SLICE-7C: a NON-Postiz refusal clears its fence, end to end ──────────────────────────────────
//
// SLICE-7A proved the fence rule against an injected `refusal`. That leaves the question this slice
// exists for untested: which routes can actually produce `no-provider-request` in the first place.
// Before SLICE-7C only the Postiz branch could, so every quote card and every video refused by the
// reuse guard kept its dispatch fence forever and needed hand repair.
//
// These run the REAL `scheduleApproved` with stubbed publishers, so the discriminant is the one the
// production code computes rather than one the test supplies. Every publisher is a stub and no
// network call is made. Observable state only: the publishing ledger, the approval safety journal,
// whether reconciliation is accepted, and whether a second Schedule reaches the scheduler again.
describe("SLICE-7C: a non-Postiz reuse-guard refusal is re-dispatchable end to end", () => {
  const scratch = mkdtempSync(join(tmpdir(), "slice-7c-fence-"));
  const savedBets = process.env.CONTENT_AGENTS_TEST_BETS_PATH;
  const betsFile = join(scratch, "bets.md");
  const YESTERDAY = new Date(Date.now() - 86_400_000).toISOString();

  before(() => { process.env.CONTENT_AGENTS_TEST_BETS_PATH = betsFile; writeFileSync(betsFile, "# Placed log\n"); });
  after(() => {
    if (savedBets === undefined) delete process.env.CONTENT_AGENTS_TEST_BETS_PATH;
    else process.env.CONTENT_AGENTS_TEST_BETS_PATH = savedBets;
    rmSync(scratch, { recursive: true, force: true });
  });

  /** A bets.md Placed row in the exact shape reuse-guard.ts scans for. */
  const placed = (rowId: string, platform: string): string =>
    `- placed ${YESTERDAY} [piece/${rowId}] ${platform} → postiz post pz-0 @ earlier\n`;
  const journalEvents = (path: string): Record<string, unknown>[] => {
    const journal = journalPathForLedger(path);
    if (!existsSync(journal)) return [];
    return readFileSync(journal, "utf8").split("\n").filter((line) => line.trim()).map((line) => JSON.parse(line));
  };
  const resolutions = (path: string) => journalEvents(path).filter((e) => e.kind === "dispatch_resolved");

  /** The real scheduler, with every publisher replaced. Postiz is left unconfigured so each row
   *  takes the legacy route this slice is about. */
  const via = (over: Partial<SchedulerDeps>): typeof scheduleApproved =>
    (folder, liveRow, _deps, policyDecision, dispatchMode) => scheduleApproved(folder, liveRow, {
      publishText: async () => [], publishCards: async () => [], publishTikTok: async () => [],
      publishShorts: async () => [], publishSubstack: async () => [], lockOutreachMessage: async () => [],
      postizEnv: {}, ...over,
    }, policyDecision, dispatchMode);

  const cardRow: QueueRow = { id: "quote-card-1-x", platform: "quote-card:x", format: "image", asset: "images/quote-card-1.png", status: "pending", notes: "", lineIndex: 2 };
  const tiktokRow: QueueRow = { id: "tt-1", platform: "tiktok", format: "video", asset: "video/short.mp4", status: "pending", notes: "", lineIndex: 2 };

  test("a quote card refused by the guard clears its fence and schedules again once the window opens", async () => {
    const path = ledger();
    const folder = approvedContentFolder(path, cardRow);
    writeFileSync(betsFile, `# Placed log\n${placed(cardRow.id, "x")}`);
    let calls = 0;

    const first = await scheduleApprovedOnce(folder, "piece", cardRow,
      via({ publishCards: async () => { calls++; return []; } }), path);

    assert.equal(calls, 0, "publishCards was never invoked, which is the entire basis of the fence claim");
    assert.equal(first.publishing.state, "blocked");
    assert.match(first.scheduleError ?? "", /^blocked by reuse guard, last placed to x /);
    const resolved = resolutions(path);
    assert.equal(resolved.length, 1, "nothing reached the provider, so the fence must clear");
    assert.equal(resolved[0].resolution, "not-created", "never `exists`: there is no object to point at");
    const approvedCard = { ...cardRow, status: "approve" as const };
    assert.equal(approvalDispatchDisposition(folder, "piece", approvedCard, path).kind, "reconciled-not-created");
    assert.equal(publishingRetryBlock("piece", approvedCard, path), null, "the row stays retryable with no hand repair");

    // And once the reuse window opens, the same row schedules. No coordinator, no fence surgery.
    writeFileSync(betsFile, "# Placed log\n");
    const second = await scheduleApprovedOnce(folder, "piece", approvedCard,
      via({ publishCards: async () => [{ draftId: "tf-window-open", when: "Tomorrow" }] }), path);
    assert.equal(second.scheduleError, null);
    assert.equal(second.publishing.state, "planned");
    assert.equal(second.publishing.providerObjectId, "tf-window-open");
  });

  test("a TikTok video refused by the guard clears its fence too, so the fix is route-general", async () => {
    const path = ledger();
    const folder = approvedContentFolder(path, tiktokRow);
    writeFileSync(betsFile, `# Placed log\n${placed(tiktokRow.id, "tiktok")}`);
    let calls = 0;

    const result = await scheduleApprovedOnce(folder, "piece", tiktokRow,
      via({ publishTikTok: async () => { calls++; return []; } }), path);

    assert.equal(calls, 0, "publishTikTok was never invoked");
    assert.equal(result.publishing.state, "blocked");
    assert.equal(result.publishing.provider, "postpeer", "a genuinely different route from the card above");
    assert.match(result.scheduleError ?? "", /^blocked by reuse guard, last placed to tiktok /);
    const resolved = resolutions(path);
    assert.equal(resolved.length, 1);
    assert.equal(resolved[0].resolution, "not-created");
    assert.equal(approvalDispatchDisposition(folder, "piece", { ...tiktokRow, status: "approve" }, path).kind, "reconciled-not-created");
  });

  // ── The negative, and the half that must not move. ───────────────────────────────────────────
  test("a non-Postiz publisher that declines DESPITE an allowed pre-flight keeps its fence", async () => {
    const path = ledger();
    const folder = approvedContentFolder(path, cardRow);
    writeFileSync(betsFile, "# Placed log\n"); // the guard allows: nothing was ever placed
    let calls = 0;
    const declining = () => via({ publishCards: async () => { calls++; return []; } });

    const first = await scheduleApprovedOnce(folder, "piece", cardRow, declining(), path);

    assert.equal(calls, 1, "the pre-flight allowed it, so the publisher really did run");
    assert.equal(first.publishing.state, "blocked");
    assert.equal(resolutions(path).length, 0, "a publisher already ran, so its fence must be retained");
    const approvedCard = { ...cardRow, status: "approve" as const };
    const disposition = approvalDispatchDisposition(folder, "piece", approvedCard, path);
    assert.equal(disposition.kind, "blocked");
    assert.match((disposition as { reason: string }).reason, /durable dispatch fence/);
    assert.throws(() => resolvePublishingAttempt("piece", cardRow.id, "not-created", {}, path), /no uncertain/i,
      "`blocked` stays resolve-ineligible: nobody may clear a fence on a publisher that already ran");
    await assert.rejects(() => scheduleApprovedOnce(folder, "piece", approvedCard, declining(), path), /durable dispatch fence/i);
    assert.equal(calls, 1, "and the scheduler must not run a second time");
  });
});
