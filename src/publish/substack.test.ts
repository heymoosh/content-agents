/**
 * Unit tests for src/publish/substack.ts — the approve-only gate (CLAUDE.md rules 2/3: a wrong
 * status here posts live to Muxin's real public Substack account) and the two-phase claim-then-fire
 * machine built on the shared scheduler.
 *
 * Strategy: publishSubstack touches two append-only files, both redirected to isolated test paths:
 * files — the slot ledger (data/publish-schedule.jsonl, via claimSlots/findPendingClaim) and the
 * bets ledger (briefs/bets.md, via appendBetPlacement, only on an actual "fired" post).
 *   - The ledger: point CONTENT_AGENTS_TEST_LEDGER (read lazily by slots.ts's ledgerPath()) at an
 *     isolated file, same fix queue-view.test.ts already applied — running against the real ledger
 *     raced other suites (slots.test.ts) under Node's default concurrent-test-file execution.
 *   - bets.md: CONTENT_AGENTS_TEST_BETS_PATH keeps the brand-scoped production ledger untouched.
 * A postFn is always injected — no real browser is ever launched anywhere in this suite.
 */

import { test, describe, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, unlinkSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { publishSubstack, findPendingClaim, type PostFn } from "./substack.js";
import { readQueue } from "./queue.js";
import { readLedger, type Claim } from "./slots.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TEST_LEDGER = join(tmpdir(), "substack-test-ledger.jsonl");
const BETS_PATH = join(tmpdir(), "substack-test-bets.md");

const dirs: string[] = [];

function tmpFolder(): string {
  const dir = mkdtempSync(join(tmpdir(), "substack-test-"));
  mkdirSync(join(dir, "derivatives"), { recursive: true });
  dirs.push(dir);
  writeFileSync(join(dir, "content-request.json"), JSON.stringify({ origin: "human-inference" }));
  return dir;
}

// 9-column review-queue.md row (no origin cell — matches queue.test.ts's legacy-table fixtures).
function row(id: string, platform: string, status: string, asset = `derivatives/${id}.md`): string {
  return `| ${id} | ${platform} | text | ${asset} | 4 | 4 | yes | ${status} | |`;
}

function seedQueue(dir: string, rows: string[]): void {
  const header =
    `| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes |\n` +
    `|----|----------|--------|-------|-------------|------------|-----|--------|-------|\n`;
  writeFileSync(join(dir, "review-queue.md"), header + rows.join("\n") + "\n");
}

function seedDerivative(dir: string, id: string, body: string): void {
  writeFileSync(join(dir, "derivatives", `${id}.md`), `---\nplatform: substack\n---\n${body}`);
}

function seedClaim(dir: string, id: string, timeIso: string): void {
  const claim: Claim = {
    platform: "substack",
    day: timeIso.slice(0, 10),
    time: timeIso,
    asset: `${basename(dir)}/${id}`,
    by: "substack",
  };
  writeFileSync(TEST_LEDGER, JSON.stringify(claim) + "\n");
}

const shouldNotBeCalled: PostFn = async () => {
  throw new Error("postFn must not be called in this test");
};

describe("publishSubstack", () => {
  const originalAccountId = process.env.CONTENT_AGENTS_SUBSTACK_ACCOUNT_ID;
  before(() => {
    process.env.CONTENT_AGENTS_TEST_LEDGER = TEST_LEDGER;
    process.env.CONTENT_AGENTS_TEST_BETS_PATH = BETS_PATH;
    if (existsSync(BETS_PATH)) unlinkSync(BETS_PATH);
    process.env.CONTENT_AGENTS_SUBSTACK_ACCOUNT_ID = "human-inference/substack";
  });

  after(() => {
    delete process.env.CONTENT_AGENTS_TEST_LEDGER;
    delete process.env.CONTENT_AGENTS_TEST_BETS_PATH;
    if (originalAccountId === undefined) delete process.env.CONTENT_AGENTS_SUBSTACK_ACCOUNT_ID;
    else process.env.CONTENT_AGENTS_SUBSTACK_ACCOUNT_ID = originalAccountId;
    if (existsSync(TEST_LEDGER)) unlinkSync(TEST_LEDGER);
    if (existsSync(BETS_PATH)) unlinkSync(BETS_PATH);
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  beforeEach(() => {
    if (existsSync(TEST_LEDGER)) unlinkSync(TEST_LEDGER);
  });

  // (a) approve-only gate. draft/reject/published/pending substack rows, and an approved row on a
  // DIFFERENT platform, must never reach postFn — only status===approve AND platform===substack is
  // eligible. The one legitimately-approved row already has a due claim, so this run also proves
  // postFn genuinely fires for the row that IS supposed to be eligible (not just that gating exists).
  test("only a status=approve substack row is ever eligible — postFn never fires for the rest", async () => {
    const dir = tmpFolder();
    seedDerivative(dir, "substack-approved", "Approved note text.");
    seedQueue(dir, [
      row("substack-draft", "substack", "draft"),
      row("substack-reject", "substack", "reject"),
      row("substack-published", "substack", "published"),
      row("substack-pending", "substack", "pending"),
      row("other-approved", "x", "approve"),
      row("substack-approved", "substack", "approve"),
    ]);
    seedClaim(dir, "substack-approved", new Date(Date.now() - 3_600_000).toISOString());

    const calls: string[] = [];
    const postFn: PostFn = async (_ctx, text) => {
      calls.push(text);
      return { ref: "note-ref-1" };
    };

    await publishSubstack(dir, { postFn });

    assert.deepEqual(calls, ["Approved note text."]);

    const { rows } = readQueue(dir);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.status]));
    assert.equal(byId["substack-draft"], "draft");
    assert.equal(byId["substack-reject"], "reject");
    assert.equal(byId["substack-published"], "published");
    assert.equal(byId["substack-pending"], "pending");
    assert.equal(byId["other-approved"], "approve"); // untouched — not a substack row
    assert.equal(byId["substack-approved"], "published"); // the one that fired
  });

  test("no approved substack rows → returns [] and makes no calls", async () => {
    const dir = tmpFolder();
    seedQueue(dir, [row("substack-draft", "substack", "draft"), row("x-approved", "x", "approve")]);
    const results = await publishSubstack(dir, { postFn: shouldNotBeCalled });
    assert.deepEqual(results, []);
  });

  // (b) phase 1 — no existing claim: claims a future slot, posts nothing.
  test("phase 1: an approved row with no existing claim claims a future slot and does not post", async () => {
    const dir = tmpFolder();
    seedDerivative(dir, "substack-1", "Note body.");
    seedQueue(dir, [row("substack-1", "substack", "approve")]);
    const now = new Date();

    const results = await publishSubstack(dir, { postFn: shouldNotBeCalled, now });

    assert.equal(results.length, 1);
    assert.equal(results[0].posted, false);
    assert.equal(results[0].ref, "");
    assert.notEqual(results[0].when, "(unclaimed)");

    // row status is untouched — only a fired post flips it to published
    assert.equal(readQueue(dir).rows[0].status, "approve");

    const asset = `${basename(dir)}/substack-1`;
    const claim = findPendingClaim(asset);
    assert.ok(claim, "expected a claim to be recorded in the ledger");
    assert.ok(new Date(claim!.time).getTime() > now.getTime(), "claimed slot must be in the future");
  });

  // Claim exists but its slot hasn't arrived yet — wait, don't post.
  test("a claimed slot that has not arrived yet waits and does not post", async () => {
    const dir = tmpFolder();
    seedDerivative(dir, "substack-1", "Note body.");
    seedQueue(dir, [row("substack-1", "substack", "approve")]);
    seedClaim(dir, "substack-1", new Date(Date.now() + 999 * 86_400_000).toISOString());

    const results = await publishSubstack(dir, { postFn: shouldNotBeCalled });

    assert.equal(results.length, 1);
    assert.equal(results[0].posted, false);
    assert.equal(readQueue(dir).rows[0].status, "approve");
    assert.ok(findPendingClaim(`${basename(dir)}/substack-1`), "the pending claim must still be there");
  });

  // (c) phase 2 — a claim whose slot has passed fires exactly once, flips status, releases the claim,
  // and logs to publish-log.md / briefs/bets.md.
  test("phase 2: a due claim fires exactly once and marks the row published", async () => {
    const dir = tmpFolder();
    seedDerivative(dir, "substack-1", "Note body to post.");
    seedQueue(dir, [row("substack-1", "substack", "approve")]);
    const claimTime = new Date(Date.now() - 3_600_000).toISOString();
    seedClaim(dir, "substack-1", claimTime);

    let calls = 0;
    let calledWith: { context: unknown; text: string } | undefined;
    const postFn: PostFn = async (context, text) => {
      calls++;
      calledWith = { context, text };
      return { ref: "note-ref-2" };
    };

    const results = await publishSubstack(dir, { postFn });

    assert.equal(calls, 1);
    assert.equal(calledWith?.text, "Note body to post.");
    assert.equal(results.length, 1);
    assert.equal(results[0].posted, true);
    assert.equal(results[0].ref, "note-ref-2");

    assert.equal(readQueue(dir).rows[0].status, "published");
    assert.equal(findPendingClaim(`${basename(dir)}/substack-1`), undefined, "the spent claim must be released");

    const publishLog = readFileSync(join(dir, "publish-log.md"), "utf8");
    assert.match(publishLog, /substack-1 → substack note-ref-2 \(posted/);

    const bets = readFileSync(BETS_PATH, "utf8");
    assert.match(bets, new RegExp(`\\[${basename(dir)}/substack-1\\]`));
  });

  // (d) dry-run makes zero mutations — no ledger claim, no status change, no postFn call.
  test("dry-run reports intent without writing anything", async () => {
    const dir = tmpFolder();
    seedDerivative(dir, "substack-1", "Note body.");
    seedQueue(dir, [row("substack-1", "substack", "approve")]);
    const queueBefore = readFileSync(join(dir, "review-queue.md"), "utf8");

    const results = await publishSubstack(dir, { postFn: shouldNotBeCalled, dryRun: true });

    assert.equal(results.length, 1);
    assert.equal(results[0].posted, false);
    assert.equal(results[0].when, "(unclaimed)");
    assert.equal(readFileSync(join(dir, "review-queue.md"), "utf8"), queueBefore);
    assert.equal(findPendingClaim(`${basename(dir)}/substack-1`), undefined, "dry-run must not claim a slot");
    assert.deepEqual(readLedger(), [], "dry-run must not write to the ledger at all");
    assert.ok(!existsSync(join(dir, "publish-log.md")), "dry-run must not write a publish log");
  });

  // (e) 1/day cap — config/platforms.yaml's substack entry has no max_slots_per_day, so the shared
  // scheduler's default of 1 applies: two rows claimed in the SAME run must land on different days.
  test("1/day cap: two approved rows claimed in the same run land on different days", async () => {
    const dir = tmpFolder();
    seedDerivative(dir, "substack-1", "First note.");
    seedDerivative(dir, "substack-2", "Second note.");
    seedQueue(dir, [row("substack-1", "substack", "approve"), row("substack-2", "substack", "approve")]);
    const now = new Date();

    const results = await publishSubstack(dir, { postFn: shouldNotBeCalled, now });

    assert.equal(results.length, 2);
    assert.ok(results.every((r) => r.posted === false));

    const claim1 = findPendingClaim(`${basename(dir)}/substack-1`);
    const claim2 = findPendingClaim(`${basename(dir)}/substack-2`);
    assert.ok(claim1 && claim2, "both rows must have claimed a slot");
    assert.notEqual(claim1!.day, claim2!.day, "the default 1/day cap must push the second row to a different day");
  });
});
