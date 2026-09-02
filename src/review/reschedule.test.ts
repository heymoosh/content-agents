import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readQueue } from "../publish/queue.js";
import { readLedger, writeLedgerAtomic } from "../publish/slots.js";
import { appendPublishingStatus, readPublishingStatuses } from "./publishing-status.js";
import { batchReschedule, listBatchCandidates, readPillar, rescheduleRow } from "./reschedule.js";
import type { PostizTransport } from "../publish/postiz.js";

const NOW = new Date("2026-09-02T12:00:00Z");
const PLANNED = "2026-09-10T17:00:00.000Z";

function fixture(): { root: string; folder: string; statusPath: string } {
  const root = mkdtempSync(join(tmpdir(), "reschedule-"));
  const folder = join(root, "content", "2026-09-01-essay");
  mkdirSync(join(folder, "derivatives"), { recursive: true });
  writeFileSync(join(folder, "review-queue.md"), [
    "| id | platform | format | asset | native | brand | cta | status | notes | origin |",
    "|---|---|---|---|---|---|---|---|---|---|",
    "| x-1 | x | text | derivatives/x-1.md | — | — | — | scheduled |  | from /cycle |",
    "| bs-1 | bluesky | text | derivatives/bs-1.md | — | — | — | scheduled |  | from /cycle |",
    "| li-1 | linkedin | text | derivatives/li-1.md | — | — | — | scheduled |  | from /cycle |",
    "",
  ].join("\n"));
  writeFileSync(join(folder, "derivatives", "x-1.md"), "---\nsource_lines: [1]\n---\nA line Muxin wrote.\n");
  writeFileSync(join(folder, "derivatives", "bs-1.md"), "---\nsource_lines: [1]\n---\nAnother line.\n");
  writeFileSync(join(folder, "derivatives", "li-1.md"), "---\nsource_lines: [1]\n---\nLinkedIn line.\n");
  writeFileSync(join(folder, "routing.md"), "# Routing — human-ai — 2026-09-01\n");
  const statusPath = join(root, "publishing-status.jsonl");
  process.env.CONTENT_AGENTS_TEST_LEDGER = join(root, "publish-schedule.jsonl");
  writeLedgerAtomic([{ platform: "x", day: "2026-09-10", time: PLANNED, asset: "derivatives/x-1.md", by: "postiz" }]);
  appendPublishingStatus({ slug: "2026-09-01-essay", rowId: "x-1", provider: "postiz", state: "planned", at: NOW.toISOString(), plannedFor: PLANNED, providerObjectId: "pz-1", providerAccountId: "acct-x" }, statusPath);
  appendPublishingStatus({ slug: "2026-09-01-essay", rowId: "bs-1", provider: "postiz", state: "planned", at: NOW.toISOString(), plannedFor: "2026-09-11T17:00:00.000Z", providerObjectId: "pz-2", providerAccountId: "acct-bs" }, statusPath);
  appendPublishingStatus({ slug: "2026-09-01-essay", rowId: "li-1", provider: "typefully", state: "planned", at: NOW.toISOString(), plannedFor: "2026-09-12T17:00:00.000Z", providerObjectId: "tf-1", providerAccountId: "acct-li" }, statusPath);
  return { root, folder, statusPath };
}

function fakePostiz(): { transport: PostizTransport; calls: Array<{ path: string; body?: unknown }> } {
  const calls: Array<{ path: string; body?: unknown }> = [];
  const dates: Record<string, string> = { "pz-1": PLANNED, "pz-2": "2026-09-11T17:00:00.000Z" };
  return {
    calls,
    transport: {
      async request(path, init) {
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({ path, body });
        if (init?.method === "POST") {
          const id = body.posts[0].value[0].id as string;
          dates[id] = body.date;
          return [{ postId: id, integration: body.posts[0].integration.id }];
        }
        return { posts: Object.entries(dates).map(([id, publishDate]) => ({ id, state: "QUEUE", publishDate, group: `g-${id}` })) };
      },
    },
  };
}

describe("reschedule a scheduled Postiz row", () => {
  test("moves provider, ledger, and publishing record together to an exact time", async () => {
    const { root, folder, statusPath } = fixture();
    const { transport, calls } = fakePostiz();
    const row = readQueue(folder).rows.find((r) => r.id === "x-1")!;
    const outcome = await rescheduleRow(folder, "2026-09-01-essay", row, { to: "2026-09-14T17:00:00Z" }, { transport, statusPath, now: () => NOW });
    assert.equal(outcome.ok, true, String(outcome.error ?? ""));
    assert.equal(outcome.to, "2026-09-14T17:00:00.000Z");
    const save = calls.find((c) => c.body)!.body as Record<string, unknown>;
    assert.equal(save.type, "schedule");
    assert.equal((save.posts as Array<Record<string, unknown>>)[0].group, "g-pz-1");
    assert.equal(((save.posts as Array<{ value: Array<{ id: string; content: string }> }>)[0].value[0]).content, "A line Muxin wrote.");
    assert.deepEqual(readLedger(), [{ platform: "x", day: "2026-09-14", time: "2026-09-14T17:00:00.000Z", asset: "derivatives/x-1.md", by: "postiz" }]);
    const status = readPublishingStatuses(statusPath)["2026-09-01-essay/x-1"];
    assert.equal(status.plannedFor, "2026-09-14T17:00:00.000Z");
    assert.equal(status.state, "planned");
    assert.equal(status.providerObjectId, "pz-1");
    rmSync(root, { recursive: true, force: true });
  });

  test("refuses non-Postiz, non-planned, past, and past-target moves without a provider call", async () => {
    const { root, folder, statusPath } = fixture();
    const { transport, calls } = fakePostiz();
    const rows = readQueue(folder).rows;
    const li = await rescheduleRow(folder, "2026-09-01-essay", rows.find((r) => r.id === "li-1")!, { to: "2026-09-14T17:00:00Z" }, { transport, statusPath, now: () => NOW });
    assert.match(li.error ?? "", /typefully has no reschedule API/);
    const past = await rescheduleRow(folder, "2026-09-01-essay", rows.find((r) => r.id === "x-1")!, { to: "2026-09-01T17:00:00Z" }, { transport, statusPath, now: () => NOW });
    assert.match(past.error ?? "", /must be in the future/);
    const late = await rescheduleRow(folder, "2026-09-01-essay", rows.find((r) => r.id === "x-1")!, { to: "2026-09-20T17:00:00Z" }, { transport, statusPath, now: () => new Date("2026-09-11T00:00:00Z") });
    assert.match(late.error ?? "", /already passed/);
    assert.equal(calls.length, 0);
    rmSync(root, { recursive: true, force: true });
  });

  test("a full destination day is refused before the provider is touched", async () => {
    const { root, folder, statusPath } = fixture();
    // x allows two slots a day (config/platforms.yaml); fill both.
    writeLedgerAtomic([...readLedger(), { platform: "x", day: "2026-09-14", time: "2026-09-14T16:30:00.000Z", asset: "other", by: "postiz" }, { platform: "x", day: "2026-09-14", time: "2026-09-14T23:45:00.000Z", asset: "other2", by: "postiz" }]);
    const { transport, calls } = fakePostiz();
    const row = readQueue(folder).rows.find((r) => r.id === "x-1")!;
    const outcome = await rescheduleRow(folder, "2026-09-01-essay", row, { to: "2026-09-14T17:00:00Z" }, { transport, statusPath, now: () => NOW, buildInput: async () => { throw new Error("must not build"); } });
    assert.equal(outcome.ok, false);
    assert.match(outcome.error ?? "", /already has 2 posts claimed on 2026-09-14/);
    assert.equal(calls.filter((c) => c.body).length, 0);
    rmSync(root, { recursive: true, force: true });
  });

  test("a local write failure after the provider moved is recorded as uncertain with the new time", async () => {
    const { root, folder, statusPath } = fixture();
    const { transport } = fakePostiz();
    const row = readQueue(folder).rows.find((r) => r.id === "x-1")!;
    const ledger = process.env.CONTENT_AGENTS_TEST_LEDGER!;
    let built = false;
    const outcome = await rescheduleRow(folder, "2026-09-01-essay", row, { to: "2026-09-14T17:00:00Z" }, {
      transport, statusPath, now: () => NOW,
      buildInput: async (f, r, acct, at, t) => { built = true; writeFileSync(ledger, "{not json\n"); mkdirSync(join(ledger + ".lock"), { recursive: true }); return { destination: "x", accountId: acct, content: "c", scheduledAt: at, visibility: "scheduled" }; },
    });
    assert.equal(built, true);
    assert.equal(outcome.ok, false);
    assert.match(outcome.error ?? "", /Postiz moved the post to 2026-09-14T17:00:00.000Z but the local record/);
    const status = readPublishingStatuses(statusPath)["2026-09-01-essay/x-1"];
    assert.equal(status.state, "uncertain");
    assert.equal(status.plannedFor, "2026-09-14T17:00:00.000Z");
    rmSync(root, { recursive: true, force: true });
  });

  test("a post Postiz no longer lists is not moved", async () => {
    const { root, folder, statusPath } = fixture();
    const transport: PostizTransport = { async request() { return { posts: [] }; } };
    const row = readQueue(folder).rows.find((r) => r.id === "x-1")!;
    const outcome = await rescheduleRow(folder, "2026-09-01-essay", row, { to: "2026-09-14T17:00:00Z" }, { transport, statusPath, now: () => NOW });
    assert.equal(outcome.ok, false);
    assert.match(outcome.error ?? "", /no longer lists/);
    assert.equal(readPublishingStatuses(statusPath)["2026-09-01-essay/x-1"].plannedFor, PLANNED);
    rmSync(root, { recursive: true, force: true });
  });
});

describe("batch reschedule by theme", () => {
  test("selects scheduled Postiz rows by pillar, slug, platform, or key, earliest first", () => {
    const { root, folder, statusPath } = fixture();
    const deps = { statusPath, now: () => NOW, resolveFolder: () => folder };
    assert.equal(readPillar(folder), "human-ai");
    assert.deepEqual(listBatchCandidates({ pillars: ["human-ai"] }, deps).map((c) => c.row.id), ["x-1", "bs-1"]);
    assert.deepEqual(listBatchCandidates({ pillars: ["careers"] }, deps).map((c) => c.row.id), []);
    assert.deepEqual(listBatchCandidates({ platforms: ["bluesky"] }, deps).map((c) => c.row.id), ["bs-1"]);
    assert.deepEqual(listBatchCandidates({ ids: ["2026-09-01-essay/x-1"] }, deps).map((c) => c.row.id), ["x-1"]);
    assert.deepEqual(listBatchCandidates({ slugs: ["other"] }, deps).map((c) => c.row.id), []);
    assert.throws(() => listBatchCandidates({}, deps), /empty selection/);
    rmSync(root, { recursive: true, force: true });
  });

  test("shift keeps the cluster's spacing and reports every row", async () => {
    const { root, folder, statusPath } = fixture();
    const { transport } = fakePostiz();
    const result = await batchReschedule({ pillars: ["human-ai"] }, { mode: "shift", days: 7 }, { transport, statusPath, now: () => NOW, resolveFolder: () => folder });
    assert.equal(result.candidates, 2);
    assert.deepEqual(result.results.map((r) => [r.id, r.ok, r.to]), [["x-1", true, "2026-09-17T17:00:00.000Z"], ["bs-1", true, "2026-09-18T17:00:00.000Z"]]);
    const ledger = readLedger();
    assert.ok(ledger.some((c) => c.platform === "x" && c.time === "2026-09-17T17:00:00.000Z"));
    assert.ok(ledger.some((c) => c.platform === "bluesky" && c.time === "2026-09-18T17:00:00.000Z"), "a row with no prior ledger claim still gets one after the move");
    assert.equal(readFileSync(statusPath, "utf8").trim().split("\n").length, 5);
    rmSync(root, { recursive: true, force: true });
  });

  test("stops at the first Postiz rate-limit error and reports the rest as not attempted", async () => {
    const { root, folder, statusPath } = fixture();
    const inner = fakePostiz();
    const transport: PostizTransport = {
      async request(path, init) {
        if (init?.method === "POST" && path.endsWith("/posts")) throw new Error("Postiz rate limit reached (429): the create-post endpoint allows 90 requests per hour across the whole instance, and each schedule or move counts as one.");
        return inner.transport.request(path, init);
      },
    };
    const result = await batchReschedule({ pillars: ["human-ai"] }, { mode: "shift", days: 7 }, { transport, statusPath, now: () => NOW, resolveFolder: () => folder });
    assert.equal(result.candidates, 2);
    assert.equal(result.results.length, 2);
    assert.equal(result.results[0].ok, false);
    assert.match(String(result.results[0].error), /rate limit reached/);
    assert.match(String(result.results[1].error), /not attempted/);
    assert.equal(inner.calls.filter((c) => c.path.endsWith("/posts") && c.body).length, 0, "no further create calls after the first 429");
    rmSync(root, { recursive: true, force: true });
  });

  test("after re-flows through the cadence so two rows on one platform take distinct slots", async () => {
    const { root, folder, statusPath } = fixture();
    appendPublishingStatus({ slug: "2026-09-01-essay", rowId: "x-2", provider: "postiz", state: "planned", at: NOW.toISOString(), plannedFor: "2026-09-12T17:00:00.000Z", providerObjectId: "pz-1", providerAccountId: "acct-x" }, statusPath);
    writeFileSync(join(folder, "review-queue.md"), readFileSync(join(folder, "review-queue.md"), "utf8") + "| x-2 | x | text | derivatives/x-1.md | — | — | — | scheduled |  | from /cycle |\n");
    const { transport } = fakePostiz();
    const result = await batchReschedule({ platforms: ["x"] }, { mode: "after", notBefore: "2026-10-01T00:00:00Z" }, { transport, statusPath, now: () => NOW, resolveFolder: () => folder });
    assert.equal(result.results.length, 2);
    for (const r of result.results) assert.equal(r.ok, true, String(r.error ?? ""));
    const times = result.results.map((r) => r.to!);
    assert.notEqual(times[0], times[1], "the second row sees the first row's new ledger claim");
    for (const time of times) assert.ok(time >= "2026-10-01T00:00:00.000Z");
    assert.equal(readLedger().filter((c) => c.platform === "x" && c.time >= "2026-10-01").length, 2);
    rmSync(root, { recursive: true, force: true });
  });
});
