import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { repoRoot } from "../db/db.js";
import { scheduleApproved, type SchedulerDeps } from "./studio-scheduling.js";
import type { QueueRow } from "../publish/queue.js";
import type { DeliveryBrand, DeliveryPolicyDecision } from "../publish/delivery-policy.js";
import type { PostizCapabilityRegistry, PostizDestination, PostizMedia } from "../publish/postiz.js";

// SLICE-5N half 2 — the Content page's own reuse guard reads the row's OWN brand's Placed log.
//
// `reuseGuardBlock` used to call `checkReuse(basename(folder), platform)` and take the parameter
// default, `brandId = "human-inference"`. checkReuse resolves the Placed log as
// `briefs/<brand>/bets.md`, so every row this page scheduled — whatever identity it belonged to —
// was checked against Human Inference's placements. That is the whole defect: a Charles row could
// be refused because HUMAN INFERENCE published something recently, and could be placed twice
// because Charles's own placements were never read.
//
// Everything below asserts the OUTCOME: whether the publisher actually ran, what came back as
// `scheduled`, and the exact `scheduleError` string. Nothing asserts that checkReuse was called
// with a particular argument.
//
// Fixtures live in a throwaway directory, never in the repository's own `briefs/` tree.
// `CONTENT_AGENTS_TEST_BETS_PATH` cannot serve this suite — it names ONE file, so under it both
// brands read the same Placed log and the two could not be told apart, which is the entire point
// here. `CONTENT_AGENTS_TEST_BRIEFS_ROOT` (reuse-guard.ts) relocates the ROOT instead, so
// `<root>/<brand>/bets.md` still resolves per brand. Nothing under `briefs/` is written, and the
// last test in this file asserts that tree is byte-identical after the suite has run — Muxin's
// append-only placement log is the record that stops duplicate publishing, and a test must never
// be within one stray `rmSync` of it.

let SCRATCH: string;
let HI_DIR: string;
let CHARLES_DIR: string;

/** Every path under briefs/, with its bytes, so "the real tree is untouched" is checkable. */
function briefsTreeDigest(): string[] {
  const root = join(repoRoot, "briefs");
  const walk = (dir: string, prefix: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) =>
      entry.isDirectory()
        ? walk(join(dir, entry.name), `${prefix}${entry.name}/`)
        : [`${prefix}${entry.name} ${createHash("sha256").update(readFileSync(join(dir, entry.name))).digest("hex")}`]);
  return existsSync(root) ? walk(root, "") : [];
}
const BRIEFS_BEFORE = briefsTreeDigest();

/** One day ago: inside x's 14-day window (config/platforms.yaml), fixed so the refusal string can
 *  be asserted whole rather than around its timestamp. */
const YESTERDAY = new Date(Date.now() - 86_400_000).toISOString();

/** A bets.md Placed row in the exact shape reuse-guard.ts scans for. */
const placed = (slug: string, rowId: string, platform: string, iso: string): string =>
  `- placed ${iso} [${slug}/${rowId}] ${platform} → postiz post pz-0 @ earlier\n`;

const textRow = (over: Partial<QueueRow> = {}): QueueRow => ({
  id: "x-1", platform: "x", format: "text", asset: "derivatives/x-1.md",
  status: "approve", notes: "", lineIndex: 1, ...over,
});

/** A provider-mode decision for whichever identity the case is about. The delivery matrix keeps
 *  Charles on ready-to-paste today, so this seam — `deps.resolveDeliveryPolicy`, the same one every
 *  other scheduler suite injects — is how a non-Human-Inference brand is put in front of the guard
 *  at all. The guard must key on it whichever brand eventually reaches it. */
const policyFor = (brand: DeliveryBrand) =>
  (_folder: string, provider: DeliveryPolicyDecision["provider"]): DeliveryPolicyDecision => ({
    policyVersion: "delivery-policy-v1",
    origin: brand === "charles" ? "charles" : "human-inference",
    brand, provider, providerAccountId: `${brand}/${provider}`, mode: "provider", reason: "test",
  });

const takes = (destination: PostizDestination, media: PostizMedia[]): PostizCapabilityRegistry => ({
  fetchedAt: "2026-01-01T00:00:00Z",
  capabilities: [{ destination, media, accountId: "acct-1", accountLabel: "test", localMediaUpload: true }],
});

/** The Postiz PRE-FLIGHT path: a configured Postiz capability that would happily take the row. */
function postizDeps(brand: DeliveryBrand, ran: string[]): SchedulerDeps {
  return {
    publishText: async () => { ran.push("typefully-text"); return [{ ref: "typefully draft text-1" }]; },
    publishCards: async () => { ran.push("typefully-card"); return [{ ref: "typefully draft card-1" }]; },
    publishTikTok: async () => [], publishShorts: async () => [], publishSubstack: async () => [],
    lockOutreachMessage: async () => [],
    resolveDeliveryPolicy: policyFor(brand),
    postizEnv: { POSTIZ_ACCOUNT_ID: "acct-1" },
    fetchPostizRegistry: async () => takes("x", ["text"]),
    publishPostiz: async () => { ran.push("postiz"); return { providerObjectId: "pz-1", status: "scheduled" }; },
  };
}

/** runPublisher's RECOVERY path: no Postiz configured, so a text row goes to publishText — which
 *  returns [] the way a publisher that silently skipped on its own guard does. That empty return is
 *  what makes runPublisher recompute the guard to explain the skip. */
function recoveryDeps(brand: DeliveryBrand, ran: string[]): SchedulerDeps {
  return {
    publishText: async () => { ran.push("typefully-text"); return []; },
    publishCards: async () => [], publishTikTok: async () => [], publishShorts: async () => [],
    publishSubstack: async () => [], lockOutreachMessage: async () => [],
    resolveDeliveryPolicy: policyFor(brand),
    postizEnv: {},
  };
}

describe("the Content page's reuse guard checks a row against its own brand's placements", () => {
  const saved: Record<string, string | undefined> = {};
  const ENV_KEYS = ["CONTENT_AGENTS_TEST_BETS_PATH", "CONTENT_AGENTS_TEST_BRIEFS_ROOT", "CONTENT_AGENTS_TEST_LEDGER"];

  before(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    SCRATCH = mkdtempSync(join(tmpdir(), "slice5n-briefs-"));
    HI_DIR = join(SCRATCH, "human-inference");
    CHARLES_DIR = join(SCRATCH, "charles");
    mkdirSync(HI_DIR, { recursive: true });
    mkdirSync(CHARLES_DIR, { recursive: true });
    // The per-file override must be OFF for the root override to be consulted at all.
    delete process.env.CONTENT_AGENTS_TEST_BETS_PATH;
    process.env.CONTENT_AGENTS_TEST_BRIEFS_ROOT = SCRATCH;
    process.env.CONTENT_AGENTS_TEST_LEDGER = join(SCRATCH, "publish-schedule.jsonl");
    writeFileSync(process.env.CONTENT_AGENTS_TEST_LEDGER, "");
  });

  after(() => {
    rmSync(SCRATCH, { recursive: true, force: true });
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  /** Human Inference placed this slug to x yesterday. Charles never placed anything. */
  function humanInferencePlacedOnly(slug: string): void {
    writeFileSync(join(HI_DIR, "bets.md"), `# Placed log\n${placed(slug, "x-1", "x", YESTERDAY)}`);
    writeFileSync(join(CHARLES_DIR, "bets.md"), "# Placed log\n");
  }

  /** Charles placed this slug to x yesterday. Human Inference never placed anything. */
  function charlesPlacedOnly(slug: string): void {
    writeFileSync(join(HI_DIR, "bets.md"), "# Placed log\n");
    writeFileSync(join(CHARLES_DIR, "bets.md"), `# Placed log\n${placed(slug, "x-1", "x", YESTERDAY)}`);
  }

  // ── Postiz PRE-FLIGHT path (studio-scheduling.ts, the `provider === "postiz"` branch) ───────────

  test("Postiz pre-flight: a Charles row is ALLOWED while only Human Inference placed this slug", async () => {
    const slug = "slice5n-preflight-hi-only";
    humanInferencePlacedOnly(slug);
    const ran: string[] = [];

    const result = await scheduleApproved(`/tmp/${slug}`, textRow(), postizDeps("charles", ran));

    assert.deepEqual(ran, ["postiz"], "the row really was dispatched, so the guard did not refuse it");
    assert.equal(result.scheduleError, null);
    assert.equal((result.scheduled as { providerObjectId: string }).providerObjectId, "pz-1");
  });

  test("Postiz pre-flight: the same row is BLOCKED once Charles himself placed this slug", async () => {
    const slug = "slice5n-preflight-charles";
    charlesPlacedOnly(slug);
    const ran: string[] = [];

    const result = await scheduleApproved(`/tmp/${slug}`, textRow(), postizDeps("charles", ran));

    assert.deepEqual(ran, [], "nothing was created: neither Postiz nor any backup route ran");
    assert.equal(result.scheduled, null);
    assert.equal(result.scheduleError, `blocked by reuse guard, last placed to x ${YESTERDAY} (min_reuse_days: 14)`);
  });

  // The control from the other side. Without it the pair above would also pass if the guard had
  // simply stopped reading any Placed log at all.
  test("Postiz pre-flight: a Human Inference row is still blocked by Human Inference's own log", async () => {
    const slug = "slice5n-preflight-hi-row";
    humanInferencePlacedOnly(slug);
    const ran: string[] = [];

    const result = await scheduleApproved(`/tmp/${slug}`, textRow(), postizDeps("human-inference", ran));

    assert.deepEqual(ran, []);
    assert.equal(result.scheduled, null);
    assert.equal(result.scheduleError, `blocked by reuse guard, last placed to x ${YESTERDAY} (min_reuse_days: 14)`);
  });

  // ── runPublisher RECOVERY path (the `done.length === 0` branch) ─────────────────────────────────

  test("recovery path: a Charles row skipped by its publisher is not blamed on Human Inference's log", async () => {
    const slug = "slice5n-recovery-hi-only";
    humanInferencePlacedOnly(slug);
    const ran: string[] = [];

    const result = await scheduleApproved(`/tmp/${slug}`, textRow(), recoveryDeps("charles", ran));

    assert.deepEqual(ran, ["typefully-text"], "the publisher ran and skipped on its own");
    assert.equal(result.scheduled, null);
    // The guard answers "allowed" for Charles, so the skip is explained by the generic wording
    // rather than by a Human Inference placement Charles had nothing to do with.
    assert.equal(
      result.scheduleError,
      "not scheduled: blocked by the reuse guard (check the server log for the reason)",
    );
  });

  test("recovery path: a Charles row IS explained by Charles's own placement", async () => {
    const slug = "slice5n-recovery-charles";
    charlesPlacedOnly(slug);
    const ran: string[] = [];

    const result = await scheduleApproved(`/tmp/${slug}`, textRow(), recoveryDeps("charles", ran));

    assert.deepEqual(ran, ["typefully-text"]);
    assert.equal(result.scheduled, null);
    assert.equal(result.scheduleError, `blocked by reuse guard, last placed to x ${YESTERDAY} (min_reuse_days: 14)`);
  });

  // ── The two paths cannot drift apart ────────────────────────────────────────────────────────────

  test("both guard paths produce the identical refusal for the identical brand and placement", async () => {
    const slug = "slice5n-no-drift";
    charlesPlacedOnly(slug);
    const preflightRan: string[] = [];
    const recoveryRan: string[] = [];

    const preflight = await scheduleApproved(`/tmp/${slug}`, textRow(), postizDeps("charles", preflightRan));
    const recovery = await scheduleApproved(`/tmp/${slug}`, textRow(), recoveryDeps("charles", recoveryRan));

    assert.equal(preflight.scheduleError, recovery.scheduleError);
    assert.equal(preflight.scheduled, null);
    assert.equal(recovery.scheduled, null);
  });

  // ── The suite never touches Muxin's own placement log ───────────────────────────────────────────
  // Last, so it runs after every fixture above has been written and read. `briefs/bets.md` is the
  // append-only record that stops duplicate publishing; a suite that could delete it is a worse
  // defect than the one it was written to catch.
  test("the repository's own briefs/ tree is byte-identical to what it was before this suite ran", () => {
    // Byte-identity against the digest taken at module load, and nothing else. It asserts no
    // standing fact about what briefs/ contains: a tree that had `charles/` keeps it, one that did
    // not still does not, and either way this fails only if THIS suite changed something. Asserting
    // "briefs/charles does not exist" would turn a legitimate /strategy run into a red test.
    assert.deepEqual(briefsTreeDigest(), BRIEFS_BEFORE);
    assert.ok(SCRATCH.startsWith(tmpdir()), "every fixture this suite wrote lives under a throwaway directory");
  });
});

describe("explicit unscheduled Typefully drafts", () => {
  test("force Typefully without Postiz discovery or a scheduled fallback", async () => {
    let discoveryCalls = 0;
    let captured: Record<string, unknown> | undefined;
    const deps: SchedulerDeps = {
      publishText: async (_folder, opts) => {
        captured = opts;
        return [{ draftId: "private-draft-1", when: "unscheduled", plannedFor: null, autoPublishes: false }];
      },
      publishCards: async () => [], publishTikTok: async () => [], publishShorts: async () => [],
      publishSubstack: async () => [], lockOutreachMessage: async () => [],
      resolveDeliveryPolicy: policyFor("human-inference"),
      postizEnv: { POSTIZ_BASE_URL: "https://would-have-been-probed.test", POSTIZ_API_KEY: "not-used" },
      fetchPostizRegistry: async () => { discoveryCalls++; throw new Error("must not discover Postiz for a private draft"); },
    };
    const result = await scheduleApproved("/tmp/slice-5t-private", textRow(), deps, undefined, "unscheduled-draft");
    assert.equal(result.scheduleError, null);
    assert.equal(discoveryCalls, 0);
    assert.deepEqual(captured, {
      onlyIds: ["x-1"],
      noSchedule: true,
      deferNoScheduleCompletion: true,
    });
    assert.deepEqual(result.scheduled, { draftId: "private-draft-1", when: "unscheduled", plannedFor: null, autoPublishes: false });
  });

  test("refuses a non-text draft mode before any provider activity", async () => {
    let calls = 0;
    const deps: SchedulerDeps = {
      publishText: async () => { calls++; return []; }, publishCards: async () => { calls++; return []; },
      publishTikTok: async () => { calls++; return []; }, publishShorts: async () => { calls++; return []; },
      publishSubstack: async () => { calls++; return []; }, lockOutreachMessage: async () => { calls++; return []; },
      resolveDeliveryPolicy: policyFor("human-inference"),
    };
    const result = await scheduleApproved("/tmp/slice-5t-refusal", textRow({ platform: "quote-card:x" }), deps, undefined, "unscheduled-draft");
    assert.match(result.scheduleError ?? "", /only supported for Typefully text rows/);
    assert.equal(calls, 0);
  });
});
