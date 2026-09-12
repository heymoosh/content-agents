/**
 * Unit tests for src/publish/queue-view.ts — syncLedger(), the --sync action that both prunes
 * past-dated ledger claims and releases orphaned FUTURE claims (a run claimed a slot then aborted
 * before the post actually happened, so reconcile() reports it "claimed but not live" forever
 * unless something releases it).
 *
 * Strategy: point CONTENT_AGENTS_TEST_LEDGER (read lazily by slots.ts's ledgerPath()) at an
 * isolated file instead of the real data/publish-schedule.jsonl — slots.test.ts already exercises
 * the real path with its own save/restore dance, and running both suites against the SAME real
 * file raced under Node's default concurrent-test-file execution (one file's beforeEach wiping the
 * other's fixture mid-assertion). An isolated file removes the collision instead of just narrowing it.
 */

import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync, unlinkSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readLedger, type Claim } from "./slots.js";
import { syncLedger, reconcile, listTypefully, type QueueItem } from "./queue-view.js";
import { fetchScheduledDrafts, type TypefullyDraftRecord } from "./typefully.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TEST_LEDGER = join(repoRoot, "data", ".test-publish-schedule.queue-view.jsonl");
const QUEUE_VIEW_ENTRY = join(repoRoot, "src", "publish", "queue-view.ts");
const TSX_LOADER = join(repoRoot, "node_modules", "tsx", "dist", "loader.mjs");

function claim(overrides: Partial<Claim> = {}): Claim {
  return {
    platform: "x",
    day: "2026-08-01",
    time: "2026-08-01T17:00:00.000Z",
    asset: "test-fixture/x",
    by: "test",
    ...overrides,
  };
}

function seedLedger(claims: Claim[]): void {
  writeFileSync(TEST_LEDGER, claims.length ? claims.map((c) => JSON.stringify(c)).join("\n") + "\n" : "");
}

const NOW = new Date("2026-07-08T12:00:00.000Z").getTime();
const ALL_OK = { typefully: true, postpeer: true, youtube: true };

describe("queue-view.ts: syncLedger", () => {
  before(() => {
    process.env.CONTENT_AGENTS_TEST_LEDGER = TEST_LEDGER;
  });

  after(() => {
    delete process.env.CONTENT_AGENTS_TEST_LEDGER;
    if (existsSync(TEST_LEDGER)) unlinkSync(TEST_LEDGER);
  });

  beforeEach(() => {
    seedLedger([]);
  });

  test("releases an orphaned future claim with no live post behind it", () => {
    const orphan = claim({ asset: "aborted-run/x" });
    seedLedger([orphan]);

    const before = syncLedger([], ALL_OK, NOW);
    assert.equal(before.releasedOrphans.length, 1);
    assert.deepEqual(before.releasedOrphans[0], orphan);
    assert.deepEqual(readLedger(), [], "orphaned claim must be gone from the ledger after sync");
  });

  test("does not release a future claim that IS matched by a live post", () => {
    const matched = claim({ asset: "real-post/x" });
    seedLedger([matched]);
    const live: QueueItem[] = [
      { whenIso: matched.time, platform: "x", media: "text", title: "real post", source: "typefully" },
    ];

    const result = syncLedger(live, ALL_OK, NOW);
    assert.equal(result.releasedOrphans.length, 0);
    assert.deepEqual(readLedger(), [matched], "a claim backed by a live post must survive sync");
  });

  test("does not release a claim when a needed source was unreachable (uncheckable, not drift)", () => {
    const claimUnreachable = claim({ platform: "tiktok", day: "2026-08-02", time: "2026-08-02T17:00:00.000Z", asset: "maybe-live/tiktok" });
    seedLedger([claimUnreachable]);
    const okWithPostpeerDown = { ...ALL_OK, postpeer: false };

    const result = syncLedger([], okWithPostpeerDown, NOW);
    assert.equal(result.releasedOrphans.length, 0);
    assert.deepEqual(readLedger(), [claimUnreachable], "an uncheckable claim must not be released");
  });

  test("prunes past claims and reports counts, independent of orphan release", () => {
    const past = claim({ asset: "past", time: new Date(NOW - 86_400_000).toISOString(), day: "2026-07-07" });
    const futureLive = claim({ asset: "future-live", time: new Date(NOW + 86_400_000).toISOString(), day: "2026-07-09" });
    seedLedger([past, futureLive]);
    const live: QueueItem[] = [
      { whenIso: futureLive.time, platform: "x", media: "text", title: "t", source: "typefully" },
    ];

    const result = syncLedger(live, ALL_OK, NOW);
    assert.equal(result.prunedPast, 1);
    assert.equal(result.keptFuture, 1);
    assert.equal(result.releasedOrphans.length, 0);
    assert.deepEqual(readLedger(), [futureLive]);
  });

  test("no-op result on an empty ledger", () => {
    const result = syncLedger([], ALL_OK, NOW);
    assert.deepEqual(result, { prunedPast: 0, keptFuture: 0, releasedOrphans: [] });
  });
});

// Regression for card a112f4ac: reconcile() used to key live posts / ledger claims by plain Sets of
// `${platform}|${day}`, so it could only tell presence from absence, never a count. Once a platform
// has >1 slot/day (max_slots_per_day, card c58fa530), an orphaned extra claim (or an extra unclaimed
// live post) on a multi-slot day silently looked "matched, fine" on both sides.
describe("queue-view.ts: reconcile() counts claims per platform/day instead of just checking presence", () => {
  test("2 ledger claims + 1 live post on the same platform/day: the 1 excess claim is claimedNotLive", () => {
    const c1 = claim({ asset: "slot-1/x" });
    const c2 = claim({ asset: "slot-2/x" });
    const live: QueueItem[] = [
      { whenIso: c1.time, platform: "x", media: "text", title: "the one live post", source: "typefully" },
    ];

    const result = reconcile(live, [c1, c2], ALL_OK);
    assert.equal(result.claimedNotLive.length, 1, "exactly one of the two same-day claims is unmatched");
    assert.ok(
      [c1.asset, c2.asset].includes(result.claimedNotLive[0].asset),
      "the flagged claim must be one of the two same-day claims"
    );
    assert.equal(result.liveNotClaimed.length, 0);
  });

  test("1 ledger claim + 2 live posts on the same platform/day: the 1 excess live post is liveNotClaimed", () => {
    const c1 = claim({ asset: "slot-1/x" });
    const live: QueueItem[] = [
      { whenIso: c1.time, platform: "x", media: "text", title: "live post A", source: "typefully" },
      { whenIso: c1.time, platform: "x", media: "text", title: "live post B", source: "typefully" },
    ];

    const result = reconcile(live, [c1], ALL_OK);
    assert.equal(result.claimedNotLive.length, 0);
    assert.equal(result.liveNotClaimed.length, 1, "exactly one of the two same-day live posts is unclaimed");
    assert.ok(
      ["live post A", "live post B"].includes(result.liveNotClaimed[0].title),
      "the flagged live post must be one of the two same-day live posts"
    );
  });

  test("2 ledger claims + 2 live posts on the same platform/day: counts match, no drift", () => {
    const c1 = claim({ asset: "slot-1/x" });
    const c2 = claim({ asset: "slot-2/x" });
    const live: QueueItem[] = [
      { whenIso: c1.time, platform: "x", media: "text", title: "live post A", source: "typefully" },
      { whenIso: c1.time, platform: "x", media: "text", title: "live post B", source: "typefully" },
    ];

    const result = reconcile(live, [c1, c2], ALL_OK);
    assert.equal(result.claimedNotLive.length, 0);
    assert.equal(result.liveNotClaimed.length, 0);
  });

  test("2 claims at different times on the same day, one live: the claim with no matching live post is flagged, not whichever comes first in ledger order", () => {
    const orphan = claim({ asset: "orphan/x", time: "2026-08-01T09:30:00.000Z" });
    const backed = claim({ asset: "backed/x", time: "2026-08-01T17:00:00.000Z" });
    const live: QueueItem[] = [
      { whenIso: backed.time, platform: "x", media: "text", title: "the live post", source: "typefully" },
    ];

    // Ledger order puts the orphan FIRST — day-count-only matching would greedily "match" it against
    // the live post and wrongly flag `backed` (which IS live) as the excess claim instead.
    const result = reconcile(live, [orphan, backed], ALL_OK);
    assert.equal(result.claimedNotLive.length, 1);
    assert.equal(
      result.claimedNotLive[0].asset,
      "orphan/x",
      "the claim with no matching live post must be flagged, not the live-backed one"
    );
  });
});

// Regression for card c18c39a9: fetchScheduledDrafts() used to fetch only the first page (limit=50)
// of Typefully's scheduled drafts. A real live draft sitting beyond that page was invisible to
// reconcile(), so a matching ledger claim was misreported as claimedNotLive and `--sync` would
// release it, letting a later run double-book the same slot. Exercises the full path: a stubbed
// multi-page Typefully response -> fetchScheduledDrafts() -> reconcile() (via syncLedger).
describe("queue-view.ts: reconcile() correctly matches a live post beyond the old pagination limit", () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.TYPEFULLY_API_KEY;
  const originalSetId = process.env.TYPEFULLY_SOCIAL_SET_ID;

  before(() => {
    process.env.CONTENT_AGENTS_TEST_LEDGER = TEST_LEDGER;
  });

  after(() => {
    delete process.env.CONTENT_AGENTS_TEST_LEDGER;
    if (existsSync(TEST_LEDGER)) unlinkSync(TEST_LEDGER);
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.TYPEFULLY_API_KEY;
    else process.env.TYPEFULLY_API_KEY = originalKey;
    if (originalSetId === undefined) delete process.env.TYPEFULLY_SOCIAL_SET_ID;
    else process.env.TYPEFULLY_SOCIAL_SET_ID = originalSetId;
  });

  beforeEach(() => {
    seedLedger([]);
  });

  test("the 51st Typefully draft is matched, not wrongly released as an orphan", async () => {
    process.env.TYPEFULLY_API_KEY = "test-key";
    process.env.TYPEFULLY_SOCIAL_SET_ID = "test-set";

    // The claim we expect to survive --sync: a real draft scheduled for 2026-08-01T17:00:00Z on x.
    const matched = claim({ asset: "51st-draft/x" });
    seedLedger([matched]);

    // First 50 drafts are unrelated (different day); the 51st (index 50, beyond the OLD limit=50
    // page) is the one that actually matches the ledger claim.
    const allDrafts = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      draft_title: `filler-${i + 1}`,
      scheduled_date: "2026-08-02T17:00:00.000Z",
      status: "scheduled",
      x_post_enabled: true,
    }));
    allDrafts.push({
      id: 51,
      draft_title: "the-real-draft",
      scheduled_date: matched.time,
      status: "scheduled",
      x_post_enabled: true,
    });

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const limit = Number(url.searchParams.get("limit") ?? "50");
      const offset = Number(url.searchParams.get("offset") ?? "0");
      const page = allDrafts.slice(offset, offset + limit);
      const next = offset + limit < allDrafts.length ? "https://api.typefully.com/v2/next-page" : null;
      return new Response(JSON.stringify({ results: page, next }), { status: 200 });
    }) as typeof fetch;

    const drafts = await fetchScheduledDrafts();
    assert.equal(drafts.length, 51, "fetchScheduledDrafts must have paged past the old 50-item limit");

    const live: QueueItem[] = drafts.map((d) => ({
      whenIso: d.whenIso,
      platform: d.platforms[0],
      media: "text",
      title: d.title,
      source: "typefully",
    }));

    const result = syncLedger(live, ALL_OK, NOW);
    assert.equal(
      result.releasedOrphans.length,
      0,
      "the 51st draft matches the claim, so reconcile() must not report it claimedNotLive"
    );
    assert.deepEqual(readLedger(), [matched], "a claim backed by a live post beyond the old page limit must survive --sync");
  });
});

test("CLI prints the configured scheduler ledger path with repository .env reads contained and no provider requests", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "content-agents-queue-view-"));
  const dataRoot = join(fixtureRoot, "data-root");
  const isolatedHome = join(fixtureRoot, "home");
  const isolatedTmp = join(fixtureRoot, "tmp");
  const isolatedCwd = join(fixtureRoot, "cwd");
  const fixtureLedger = join(dataRoot, "scheduler", "publish-schedule.jsonl");
  const fixtureEnv = join(fixtureRoot, "fixture.env");
  const envReadLoader = join(fixtureRoot, "env-read-loader.mjs");
  const envReadInterceptor = join(fixtureRoot, "env-read-interceptor.mjs");
  const envReadPreload = join(fixtureRoot, "env-read-preload.mjs");
  const envReadReceipt = join(fixtureRoot, "env-read-receipt.txt");
  const networkReceipt = join(fixtureRoot, "network-receipt.txt");
  const exactRepoEnv = join(repoRoot, ".env");

  try {
    mkdirSync(dirname(fixtureLedger), { recursive: true });
    mkdirSync(isolatedHome, { recursive: true });
    mkdirSync(isolatedTmp, { recursive: true });
    mkdirSync(isolatedCwd, { recursive: true });
    writeFileSync(fixtureLedger, JSON.stringify(claim({ asset: "child-fixture/x" })) + "\n");
    writeFileSync(fixtureEnv, "CONTENT_AGENTS_TEST_QUEUE_FIXTURE_ENV=loaded\n");
    writeFileSync(
      envReadLoader,
      [
        "const envModuleUrl = process.env.CONTENT_AGENTS_TEST_ENV_MODULE_URL;",
        "const interceptorUrl = process.env.CONTENT_AGENTS_TEST_ENV_INTERCEPTOR_URL;",
        "export async function resolve(specifier, context, nextResolve) {",
        "  if (specifier === 'node:fs' && context.parentURL === envModuleUrl) {",
        "    return { url: interceptorUrl, shortCircuit: true };",
        "  }",
        "  return nextResolve(specifier, context);",
        "}",
        "",
      ].join("\n")
    );
    writeFileSync(
      envReadInterceptor,
      [
        "import { appendFileSync, readFileSync as nativeReadFileSync } from 'node:fs';",
        "const exactRepoEnv = process.env.CONTENT_AGENTS_TEST_EXACT_REPO_ENV;",
        "const fixtureEnv = process.env.CONTENT_AGENTS_TEST_FIXTURE_ENV;",
        "const receipt = process.env.CONTENT_AGENTS_TEST_ENV_RECEIPT;",
        "export function readFileSync(path, ...args) {",
        "  if (path !== exactRepoEnv) throw new Error(`unexpected env read: ${path}`);",
        "  appendFileSync(receipt, `substituted:${path}\\n`);",
        "  return nativeReadFileSync(fixtureEnv, ...args);",
        "}",
        "",
      ].join("\n")
    );
    writeFileSync(
      envReadPreload,
      [
        "import { appendFileSync, writeFileSync } from 'node:fs';",
        "import { register } from 'node:module';",
        "const networkReceipt = process.env.CONTENT_AGENTS_TEST_NETWORK_RECEIPT;",
        "const envReceipt = process.env.CONTENT_AGENTS_TEST_ENV_RECEIPT;",
        "writeFileSync(networkReceipt, '');",
        "register(new URL('./env-read-loader.mjs', import.meta.url));",
        "globalThis.fetch = async (input) => {",
        "  appendFileSync(networkReceipt, `${String(input)}\\n`);",
        "  throw new Error('network access is forbidden in this queue-view fixture');",
        "};",
        "process.on('exit', () => {",
        "  appendFileSync(envReceipt, `loaded:${process.env.CONTENT_AGENTS_TEST_QUEUE_FIXTURE_ENV ?? ''}\\n`);",
        "});",
        "",
      ].join("\n")
    );

    const child = spawnSync(process.execPath, ["--import", TSX_LOADER, "--import", pathToFileURL(envReadPreload).href, QUEUE_VIEW_ENTRY], {
      cwd: isolatedCwd,
      env: {
        HOME: isolatedHome,
        TMPDIR: isolatedTmp,
        TMP: isolatedTmp,
        TEMP: isolatedTmp,
        NODE_ENV: "test",
        CONTENT_AGENTS_DATA_ROOT: dataRoot,
        CONTENT_AGENTS_TEST_ENV_MODULE_URL: pathToFileURL(join(repoRoot, "src", "util", "env.ts")).href,
        CONTENT_AGENTS_TEST_ENV_INTERCEPTOR_URL: pathToFileURL(envReadInterceptor).href,
        CONTENT_AGENTS_TEST_EXACT_REPO_ENV: exactRepoEnv,
        CONTENT_AGENTS_TEST_FIXTURE_ENV: fixtureEnv,
        CONTENT_AGENTS_TEST_ENV_RECEIPT: envReadReceipt,
        CONTENT_AGENTS_TEST_NETWORK_RECEIPT: networkReceipt,
      },
      encoding: "utf8",
      timeout: 10_000,
      killSignal: "SIGKILL",
      maxBuffer: 1_000_000,
    });

    assert.equal(child.error, undefined, `queue CLI should finish before the bounded timeout: ${child.error?.message ?? ""}`);
    assert.equal(child.signal, null, `queue CLI should not be terminated: ${child.stderr}`);
    assert.equal(child.status, 0, `queue CLI failed: ${child.stderr}`);
    assert.match(
      child.stdout,
      new RegExp(`=== LEDGER RECONCILE \\(${fixtureLedger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}: 1 claims, 0 future\\) ===`)
    );
    assert.doesNotMatch(child.stdout, /data\/publish-schedule\.jsonl/);
    assert.match(child.stdout, /Typefully: TYPEFULLY_API_KEY not set — skipped/);
    assert.match(child.stdout, /PostPeer: POSTPEER_API_KEY not set — skipped/);
    assert.match(child.stdout, /YouTube: OAuth env vars not set — skipped/);
    assert.equal(
      readFileSync(envReadReceipt, "utf8"),
      `substituted:${exactRepoEnv}\nloaded:loaded\n`,
      "env.ts must receive only the fixture contents when it asks for the exact repository .env path"
    );
    assert.equal(readFileSync(networkReceipt, "utf8"), "", "no configured provider may attempt a network request");
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

// SLICE-7D: a Typefully draft with no scheduled_date is dropped from the scheduled list, which made
// the live list INCOMPLETE while listTypefully still reported ok: true. `ok` is the only thing
// standing between a future claim and releaseClaims(), so `--sync` could free a slot that a real
// (merely undated) draft was sitting behind, and a later run could then schedule a second post into
// it. These tests prove the incompleteness now routes the claim to `uncheckable` instead, and that
// a genuinely orphaned claim is still released so --sync does not freeze.
describe("queue-view.ts: a dateless Typefully draft makes the live list incomplete", () => {
  const DATELESS_LEDGER = join(mkdtempSync(join(tmpdir(), "content-agents-queue-view-dateless-")), "ledger.jsonl");
  const originalKey = process.env.TYPEFULLY_API_KEY;
  const originalLedger = process.env.CONTENT_AGENTS_TEST_LEDGER;

  before(() => {
    process.env.CONTENT_AGENTS_TEST_LEDGER = DATELESS_LEDGER;
    process.env.TYPEFULLY_API_KEY = "test-key";
  });

  after(() => {
    if (originalLedger === undefined) delete process.env.CONTENT_AGENTS_TEST_LEDGER;
    else process.env.CONTENT_AGENTS_TEST_LEDGER = originalLedger;
    if (originalKey === undefined) delete process.env.TYPEFULLY_API_KEY;
    else process.env.TYPEFULLY_API_KEY = originalKey;
    rmSync(dirname(DATELESS_LEDGER), { recursive: true, force: true });
  });

  beforeEach(() => {
    writeFileSync(DATELESS_LEDGER, "");
  });

  function seedLedgerAt(path: string, claims: Claim[]): void {
    writeFileSync(path, claims.length ? claims.map((c) => JSON.stringify(c)).join("\n") + "\n" : "");
  }

  function record(over: Partial<TypefullyDraftRecord> = {}): TypefullyDraftRecord {
    return { id: "d-1", whenIso: "2026-08-02T17:00:00.000Z", platforms: ["x"], title: "a draft", status: "scheduled", ...over };
  }

  const liveFrom = (r: { items: QueueItem[] }): QueueItem[] => r.items;
  const okFrom = (r: { ok: boolean }): Record<string, boolean> => ({ ...ALL_OK, typefully: r.ok });

  test("listTypefully reports ok: false and counts the dateless drafts", async () => {
    const result = await listTypefully(async () => [
      record({ id: "dated" }),
      record({ id: "no-date-1", whenIso: null, status: "draft" }),
      record({ id: "no-date-2", whenIso: null, status: "draft" }),
    ]);
    assert.equal(result.ok, false, "an incomplete live list must never license a claim release");
    assert.match(result.note ?? "", /2 draft\(s\) have no scheduled date/);
    assert.doesNotMatch(result.note ?? "", /—/, "no em dashes in copy a human reads");
    assert.deepEqual(result.items.map((i) => i.title), ["a draft"], "the genuinely scheduled drafts are still listed");
  });

  test("listTypefully reports ok: true with no note when every draft has a date", async () => {
    const result = await listTypefully(async () => [record({ id: "dated" })]);
    assert.equal(result.ok, true);
    assert.equal(result.note, null);
  });

  test("a future claim whose Typefully draft is dateless is NOT released, and is reported uncheckable", async () => {
    const behindADatelessDraft = claim({ asset: "dateless-draft/x" });
    seedLedgerAt(DATELESS_LEDGER, [behindADatelessDraft]);

    const tf = await listTypefully(async () => [
      record({ id: "the-real-draft", whenIso: null, status: "draft", title: "the-real-draft" }),
    ]);
    const live = liveFrom(tf);
    const ok = okFrom(tf);

    const { claimedNotLive, uncheckable } = reconcile(live, [behindADatelessDraft], ok);
    assert.deepEqual(claimedNotLive, [], "an incomplete list can never conclude a claim is an orphan");
    assert.deepEqual(uncheckable, [behindADatelessDraft], "it belongs in the existing not-cross-checked bucket");

    const result = syncLedger(live, ok, NOW);
    assert.deepEqual(result.releasedOrphans, [], "releaseClaims must never be handed this claim");
    assert.deepEqual(readLedger(), [behindADatelessDraft], "the claim stays in the ledger, so the slot stays taken");
  });

  // The production gate, not just the flag: a draft whose date is present but unusable (whitespace
  // here) is dropped by the scheduled filter exactly like a null-dated one, so it has to mark the
  // list incomplete for the same reason. If it did not, syncLedger would free the slot this draft is
  // sitting behind and a later run could schedule a second post into it.
  test("a whitespace-dated draft blocks release the same way a null-dated one does", async () => {
    const behindAGarbageDate = claim({ asset: "whitespace-date/x" });
    seedLedgerAt(DATELESS_LEDGER, [behindAGarbageDate]);

    // fetchAllDrafts maps an unusable date to null, so this is what the real fetch would hand over.
    const tf = await listTypefully(async () => [
      record({ id: "whitespace-date", whenIso: null, status: "scheduled", title: "whitespace-date" }),
    ]);
    assert.equal(tf.ok, false, "a date that does not parse leaves the live list incomplete");
    assert.match(tf.note ?? "", /1 draft\(s\) have no scheduled date/);

    const result = syncLedger(liveFrom(tf), okFrom(tf), NOW);
    assert.deepEqual(result.releasedOrphans, [], "releaseClaims must never be handed this claim");
    assert.deepEqual(readLedger(), [behindAGarbageDate], "the slot stays taken");
  });

  test("a genuinely orphaned future claim is STILL released when the live list is complete", async () => {
    const orphan = claim({ asset: "orphan/x" });
    seedLedgerAt(DATELESS_LEDGER, [orphan]);

    // A complete live list: one dated draft, on a different day, and nothing dateless.
    const tf = await listTypefully(async () => [record({ id: "unrelated", whenIso: "2026-08-05T17:00:00.000Z" })]);
    assert.equal(tf.ok, true);

    const result = syncLedger(liveFrom(tf), okFrom(tf), NOW);
    assert.deepEqual(result.releasedOrphans, [orphan], "the fix must not freeze --sync");
    assert.deepEqual(readLedger(), [], "an orphaned claim still frees its slot");
  });
});
