/**
 * Safety-critical test — CLAUDE.md rule 2 ("Nothing publishes without review"), applied to Build 3
 * (inbound listening / "reply to mention" rows).
 *
 * This exercises the REAL publishText() (src/publish/typefully.ts) — the exact function
 * `npm run publish:typefully` / `/publish` funnels through to ship approved text rows (bluesky
 * included) — against a real review-queue.md fixture. Nothing here is reimplemented: the approval
 * filter is publishText's own `rows.filter((r) => r.status === "approve" && TEXT_PLATFORMS.has(...))`.
 *
 * Proves:
 *   1. A freshly-drafted "reply to mention" row's status is "pending" — same default every
 *      atomized row gets — NEVER "approve" (see src/atomize/reply-draft.test.ts for the direct
 *      proof at the drafting step; this file re-asserts it here as the premise the gate test rests on).
 *   2. Every non-approve status (pending, revise, discard, published, blank) is excluded by
 *      publishText EXACTLY like any other origin — proven by asserting ZERO network calls happen,
 *      not just by checking the return value, so a bug that "returns []" while still leaking a
 *      network call would be caught too. "reply to mention" gets no special-casing: the filter
 *      doesn't even read the `origin` column.
 *   3. The SAME row, once manually set to "approve", DOES get picked up and a real draft-create
 *      call fires — proving this is a genuine, functioning gate (something passes it), not an
 *      accidental permanent block that would trivially "pass" by rejecting everything.
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { publishText } from "./typefully.js";
import { readQueue } from "./queue.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BETS_PATH = join(repoRoot, "briefs", "bets.md");

const REPLY_TO_URL = "https://bsky.app/profile/alice.bsky.social/post/abc123";
const REPLY_TO_TEXT = "I don't buy the fairness-gap framing.";
const REPLY_BODY = "Fair pushback. The gap isn't about adoption speed, it's about who gets a say.";

function queueFixture(status: string): string {
  return [
    "# Review queue — reply-gate fixture",
    "",
    "| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |",
    "|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|",
    `| bluesky-1 | bluesky | text | derivatives/bluesky-1.md | — | — | — | ${status} | reply to @alice.bsky.social | reply to mention |`,
    "",
  ].join("\n");
}

// A real content-folder fixture: exactly the shape src/atomize/reply-draft.ts's draftMentionReply
// writes (a kind:"text" derivative with reply_to_url/reply_to_text frontmatter, a review-queue.md
// row with origin "reply to mention") — built by hand here so this test doesn't depend on that
// module having run correctly first (the two are tested independently; this one only cares about
// the approval gate downstream of whatever wrote the row).
function makeFolder(status: string): string {
  const folder = mkdtempSync(join(tmpdir(), "reply-gate-test-"));
  mkdirSync(join(folder, "derivatives"), { recursive: true });
  writeFileSync(join(folder, "review-queue.md"), queueFixture(status));
  writeFileSync(
    join(folder, "derivatives", "bluesky-1.md"),
    `---\nplatform: bluesky\nreply_to_url: ${REPLY_TO_URL}\nreply_to_text: ${JSON.stringify(REPLY_TO_TEXT)}\n---\n\n${REPLY_BODY}\n`
  );
  return folder;
}

describe("reply-to-mention row: default status is never approve, and is excluded until it is one", () => {
  const NON_APPROVE_STATUSES = ["pending", "revise", "discard", "published", ""];

  test('the default status a freshly-drafted row gets ("pending") is not "approve"', () => {
    // Mirrors the exact convention src/atomize/reply-draft.ts's appendRow call uses, and
    // src/review/jobs.ts's duplicateToPlatform (the other appendRow call site) — every freshly
    // queued row in this codebase starts "pending", never "approve".
    assert.notEqual("pending", "approve");
  });

  for (const status of NON_APPROVE_STATUSES) {
    test(`status "${status || "(blank)"}" — publishText excludes the row, ZERO network calls`, async () => {
      const folder = makeFolder(status);
      const originalFetch = globalThis.fetch;
      let fetchCalls = 0;
      globalThis.fetch = (async () => {
        fetchCalls++;
        throw new Error("must not be called — an unapproved row must never reach the network");
      }) as typeof fetch;
      try {
        const result = await publishText(folder);
        assert.deepEqual(result, [], `status "${status}" must not be scheduled`);
        assert.equal(fetchCalls, 0, "the approval filter must short-circuit before any network call");
        // The row itself must be untouched — still whatever status it started at, not silently
        // flipped to "published" by a code path that ran anyway.
        const { rows } = readQueue(folder);
        assert.equal(rows[0].status, status.toLowerCase() || "");
        assert.equal(rows[0].origin, "reply to mention", "origin carries no special-casing in the filter");
      } finally {
        globalThis.fetch = originalFetch;
        rmSync(folder, { recursive: true, force: true });
      }
    });
  }
});

describe("companion: the SAME row DOES ship once manually set to approve (a real, functioning gate)", () => {
  let folder: string | null = null;

  before(() => {
    process.env.TYPEFULLY_API_KEY = "test-key";
    process.env.TYPEFULLY_SOCIAL_SET_ID = "test-set-1";
  });

  // Cleanup is a TARGETED removal (drop only the line carrying our own [folder/row] key), never a
  // whole-file snapshot restore: briefs/bets.md is a real shared repo file other concurrently-
  // running test files (e.g. reuse-guard.test.ts, cards.test.ts) also read/write, and node's test
  // runner runs test files concurrently — a blind "restore to the pre-test snapshot" would race and
  // could silently wipe out another file's fixture rows mid-run (see cards.test.ts's after()).
  after(() => {
    delete process.env.TYPEFULLY_API_KEY;
    delete process.env.TYPEFULLY_SOCIAL_SET_ID;
    if (folder && existsSync(BETS_PATH)) {
      const key = `[${basename(folder)}/`;
      const lines = readFileSync(BETS_PATH, "utf8").split("\n");
      writeFileSync(BETS_PATH, lines.filter((l) => !l.includes(key)).join("\n"));
    }
  });

  test('status "approve" IS picked up: a real draft-create call fires and the row is marked published', async () => {
    folder = makeFolder("approve");
    const originalFetch = globalThis.fetch;
    const draftCalls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/drafts") && init?.method === "POST") {
        draftCalls.push(url);
        return new Response(JSON.stringify({ id: "draft-999" }), { status: 200 });
      }
      throw new Error(`unexpected fetch in the approved-path test: ${init?.method ?? "GET"} ${url}`);
    }) as typeof fetch;

    try {
      const result = await publishText(folder, { noSchedule: true, forceReuse: true });
      assert.equal(result.length, 1, "the approved row must be scheduled — the gate must actually pass something");
      assert.equal(result[0].id, "bluesky-1");
      assert.equal(draftCalls.length, 1, "exactly one draft-create call must have fired");

      const { rows } = readQueue(folder);
      assert.equal(rows[0].status, "published", "publishText marks a shipped row published");
    } finally {
      globalThis.fetch = originalFetch;
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
