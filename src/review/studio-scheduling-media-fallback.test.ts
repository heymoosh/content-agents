import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { scheduleApproved, defaultPublishPostiz, type SchedulerDeps } from "./studio-scheduling.js";
import { publishCards } from "../publish/cards.js";
import { readLedger, laDayKey } from "../publish/slots.js";
import type { QueueRow } from "../publish/queue.js";
import type { DeliveryPolicyDecision } from "../publish/delivery-policy.js";
import { PostizRateLimitError, type PostizCapabilityRegistry, type PostizTransport } from "../publish/postiz.js";

// SLICE-5J — Typefully is the BACKUP route for a Content-page configured-media image row when Postiz
// cannot take it (Muxin, 2026-09-05: "Content page should be able to also use Typefully if Postiz
// doesn't work"). Postiz stays the first choice. Exactly three conditions may open the backup:
//   1. Postiz is not configured at all (no base URL / API key) — nothing was ever sent.
//   2. Capability discovery authoritatively says Postiz cannot take this destination/media shape.
//   3. Postiz refuses the create with an unambiguous "nothing was created" outcome — the 429
//      rate-limit rejection, whose throttler guard runs before the create controller.
// Anything else — an AMBIGUOUS create failure, a video row, a destination Typefully cannot post to —
// keeps today's behavior. Every assertion below is on the observable outcome (which route actually
// scheduled the row, or the scheduleError the row came back with), never on a call argument.

const mediaRow = (over: Partial<QueueRow> = {}): QueueRow => ({
  id: "cm-1", platform: "linkedin", format: "image", asset: "configured-media/cm-1/card.png",
  status: "approve", notes: "", lineIndex: 1, ...over,
});

/** Mirrors the real policy matrix closely enough to matter here: "manual" is a manual-mode decision. */
const policyFor = (_folder: string, provider: DeliveryPolicyDecision["provider"]): DeliveryPolicyDecision =>
  provider === "manual"
    ? { policyVersion: "delivery-policy-v1", origin: "human-inference", brand: "human-inference", provider, providerAccountId: null, mode: "manual", reason: "destination is intentionally manual" }
    : { policyVersion: "delivery-policy-v1", origin: "human-inference", brand: "human-inference", provider, providerAccountId: `human-inference/${provider}`, mode: "provider", reason: "test" };

const POSTIZ_TAKES_LINKEDIN_IMAGES: PostizCapabilityRegistry = {
  fetchedAt: "2026-01-01T00:00:00Z",
  capabilities: [{ destination: "linkedin", media: ["text", "image"], accountId: "acct-1", accountLabel: "Human Inference", localMediaUpload: true }],
};
// Authoritative discovery that does NOT advertise linkedin/image.
const POSTIZ_TAKES_NOTHING_USEFUL: PostizCapabilityRegistry = {
  fetchedAt: "2026-01-01T00:00:00Z",
  capabilities: [{ destination: "youtube", media: ["video"], accountId: "acct-1", accountLabel: "Human Inference" }],
};

function mediaDeps(over: Partial<SchedulerDeps> = {}): { deps: SchedulerDeps; routes: string[] } {
  const routes: string[] = [];
  const deps: SchedulerDeps = {
    publishText: async () => { routes.push("typefully-text"); return [{ ref: "typefully draft text-1" }]; },
    publishCards: async () => { routes.push("typefully-card"); return [{ id: "cm-1", platform: "linkedin", when: "Sep 20, 9:00 AM PT", ref: "typefully draft tf-1" }]; },
    publishTikTok: async () => { routes.push("postpeer"); return [{}]; },
    publishShorts: async () => { routes.push("youtube"); return [{}]; },
    publishSubstack: async () => { routes.push("substack"); return [{}]; },
    lockOutreachMessage: async () => [],
    resolveDeliveryPolicy: policyFor,
    postizEnv: { POSTIZ_ACCOUNT_ID: "acct-1" },
    publishPostiz: async () => { routes.push("postiz"); return { providerObjectId: "pz-1", status: "scheduled" }; },
    ...over,
  };
  return { deps, routes };
}

const registry = (r: PostizCapabilityRegistry) => async (): Promise<PostizCapabilityRegistry> => r;

// ── Trigger 1: Postiz is not configured at all ────────────────────────────────────────────────────

test("an image media row falls back to Typefully when Postiz is not configured at all", async () => {
  // No fetchPostizRegistry and an env with neither POSTIZ_BASE_URL nor POSTIZ_API_KEY.
  const { deps, routes } = mediaDeps({ postizEnv: {} });
  const result = await scheduleApproved("/unused", mediaRow(), deps);
  assert.deepEqual(routes, ["typefully-card"]);
  assert.equal(result.scheduleError, null);
  assert.match((result.scheduled as { ref: string }).ref, /^typefully draft /);
});

test("x and bluesky image media rows fall back the same way linkedin does", async () => {
  for (const platform of ["x", "bluesky"]) {
    const { deps, routes } = mediaDeps({ postizEnv: {} });
    const result = await scheduleApproved("/unused", mediaRow({ platform }), deps);
    assert.deepEqual(routes, ["typefully-card"], `${platform} must reach the Typefully backup route`);
    assert.equal(result.scheduleError, null);
  }
});

// ── Trigger 2: authoritative "Postiz cannot take this" discovery ──────────────────────────────────

test("an image media row falls back to Typefully after an authoritative unsupported discovery result", async () => {
  const { deps, routes } = mediaDeps({ fetchPostizRegistry: registry(POSTIZ_TAKES_NOTHING_USEFUL) });
  const result = await scheduleApproved("/unused", mediaRow(), deps);
  assert.deepEqual(routes, ["typefully-card"]);
  assert.equal(result.scheduleError, null);
  assert.match((result.scheduled as { ref: string }).ref, /^typefully draft /);
});

test("a discovery transport failure is not authoritative and never opens the backup route", async () => {
  const { deps, routes } = mediaDeps({ fetchPostizRegistry: async () => { throw new Error("registry connection refused"); } });
  const result = await scheduleApproved("/unused", mediaRow(), deps);
  assert.deepEqual(routes, [], "an uncertain route must schedule nothing at all");
  assert.match(result.scheduleError ?? "", /capability discovery failed.*route is uncertain/i);
});

// ── Trigger 3: a rate-limit rejection, the one unambiguous "nothing was created" create failure ───

test("a Postiz rate-limit rejection falls back to Typefully, and the row is scheduled exactly once", async () => {
  const { deps, routes } = mediaDeps({
    fetchPostizRegistry: registry(POSTIZ_TAKES_LINKEDIN_IMAGES),
    publishPostiz: async () => { routes.push("postiz"); throw new PostizRateLimitError("2026-01-01T01:00:00Z"); },
  });
  const result = await scheduleApproved("/unused", mediaRow(), deps);
  assert.deepEqual(routes, ["postiz", "typefully-card"], "Postiz is tried first, then exactly one backup attempt");
  assert.equal(routes.filter((r) => r === "typefully-card").length, 1);
  assert.equal(result.scheduleError, null);
  assert.match((result.scheduled as { ref: string }).ref, /^typefully draft /);
});

test("rate-limit WORDING on an untyped error authorizes nothing; only the typed error does", async () => {
  // Message text is not evidence of provenance. An error raised anywhere else that merely quotes
  // the throttler's wording could otherwise authorize a second provider for a create that may
  // already have succeeded — the exact double-post this slice exists to prevent.
  const flattened = new PostizRateLimitError("2026-01-01T01:00:00Z").message;
  const { deps, routes } = mediaDeps({
    fetchPostizRegistry: registry(POSTIZ_TAKES_LINKEDIN_IMAGES),
    publishPostiz: async () => { routes.push("postiz"); throw new Error(flattened); },
  });
  const result = await scheduleApproved("/unused", mediaRow(), deps);
  assert.deepEqual(routes, ["postiz"], "an untyped error must not open the backup route, whatever it says");
  assert.equal(result.scheduled, null);
  assert.equal(result.scheduleError, flattened);
});

// ── The line this slice exists for: an AMBIGUOUS create failure must NOT take a second route ─────

test("an ambiguous Postiz create failure returns its scheduleError and never falls back", async () => {
  // Each of these may or may not have created the draft. Re-sending any of them through Typefully
  // is how one approved row ships twice.
  const ambiguous = [
    new Error("Postiz POST /public/v1/posts failed (502): upstream reset"),
    new Error("Postiz POST /public/v1/posts failed (400): validation"),
    new Error("fetch failed"),
    new Error("The operation was aborted due to timeout"),
    new Error("socket hang up"),
    new Error("Postiz POST /public/v1/posts failed (429)"), // a 429 the transport did NOT classify
  ];
  for (const error of ambiguous) {
    const { deps, routes } = mediaDeps({
      fetchPostizRegistry: registry(POSTIZ_TAKES_LINKEDIN_IMAGES),
      publishPostiz: async () => { routes.push("postiz"); throw error; },
    });
    const result = await scheduleApproved("/unused", mediaRow(), deps);
    assert.deepEqual(routes, ["postiz"], `must not take a second route after: ${error.message}`);
    assert.equal(result.scheduled, null);
    assert.equal(result.scheduleError, error.message);
  }
});

// ── Postiz still wins whenever it can take the row ────────────────────────────────────────────────

test("Postiz keeps the row whenever discovery says it can take it", async () => {
  const { deps, routes } = mediaDeps({ fetchPostizRegistry: registry(POSTIZ_TAKES_LINKEDIN_IMAGES) });
  const result = await scheduleApproved("/unused", mediaRow(), deps);
  assert.deepEqual(routes, ["postiz"], "no Typefully attempt while Postiz can take the row");
  assert.equal(result.scheduleError, null);
  assert.equal((result.scheduled as { providerObjectId: string }).providerObjectId, "pz-1");
});

// ── Rows that must KEEP today's manual ready-to-paste path ───────────────────────────────────────

function folderWithAsset(assetRelPath: string): string {
  const folder = mkdtempSync(join(tmpdir(), "media-fallback-"));
  mkdirSync(join(folder, assetRelPath, ".."), { recursive: true });
  writeFileSync(join(folder, assetRelPath), "rendered asset stand-in\n");
  return folder;
}

test("a configured-media VIDEO row never falls back to Typefully; it keeps the manual path", async () => {
  const folder = folderWithAsset("configured-media/cm-1/video.mp4");
  try {
    const { deps, routes } = mediaDeps({ postizEnv: {} });
    const result = await scheduleApproved(folder, mediaRow({ format: "video", asset: "configured-media/cm-1/video.mp4" }), deps);
    assert.deepEqual(routes, [], "Typefully's card route is image-only");
    assert.equal(result.scheduleError, null);
    assert.match((result.scheduled as { readyToPaste: string }).readyToPaste, /^ready-to-paste\//);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

test("image media rows for destinations Typefully cannot post to keep the manual path", async () => {
  for (const platform of ["instagram", "threads", "tiktok", "facebook", "mastodon", "youtube"]) {
    const folder = folderWithAsset("configured-media/cm-1/card.png");
    try {
      const { deps, routes } = mediaDeps({ postizEnv: {} });
      const result = await scheduleApproved(folder, mediaRow({ platform }), deps);
      assert.deepEqual(routes, [], `${platform} is not a Typefully destination`);
      assert.equal(result.scheduleError, null);
      assert.match((result.scheduled as { readyToPaste: string }).readyToPaste, /^ready-to-paste\//);
    } finally { rmSync(folder, { recursive: true, force: true }); }
  }
});

test("a configured CAROUSEL row keeps the manual path — the backup route sends one rendered image", async () => {
  const folder = folderWithAsset("configured-media/cm-1/carousel-manifest.json");
  try {
    const { deps, routes } = mediaDeps({ postizEnv: {} });
    const result = await scheduleApproved(folder, mediaRow({ asset: "configured-media/cm-1/carousel-manifest.json" }), deps);
    assert.deepEqual(routes, []);
    assert.match((result.scheduled as { readyToPaste: string }).readyToPaste, /^ready-to-paste\//);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

// ── The backup route is still gated by the reuse guard the card path already uses ─────────────────

test("a fallback row the reuse guard skips comes back as a scheduleError, not a silent success", async () => {
  const { deps, routes } = mediaDeps({
    postizEnv: {},
    publishCards: async () => { routes.push("typefully-card"); return []; }, // what the reuse guard's skip looks like
  });
  const result = await scheduleApproved("/unused", mediaRow(), deps);
  assert.deepEqual(routes, ["typefully-card"]);
  assert.equal(result.scheduled, null);
  assert.match(result.scheduleError ?? "", /reuse guard/);
});

// ── /atomize quote-card rows are untouched by the widened selection ───────────────────────────────

test("a quote-card row still routes exactly as it did: Postiz first, publishCards as its legacy route", async () => {
  const card = mediaRow({ id: "quote-card-1-x", platform: "quote-card:x", asset: "images/quote-card-1.png" });
  const first = mediaDeps({ fetchPostizRegistry: registry({ fetchedAt: "2026-01-01T00:00:00Z", capabilities: [{ destination: "x", media: ["image"], accountId: "acct-1", accountLabel: "Human Inference", localMediaUpload: true }] }) });
  const viaPostiz = await scheduleApproved("/unused", card, first.deps);
  assert.deepEqual(first.routes, ["postiz"]);
  assert.equal(viaPostiz.scheduleError, null);

  const second = mediaDeps({ fetchPostizRegistry: registry(POSTIZ_TAKES_NOTHING_USEFUL) });
  const viaCards = await scheduleApproved("/unused", card, second.deps);
  assert.deepEqual(second.routes, ["typefully-card"]);
  assert.equal(viaCards.scheduleError, null);

  // And an ambiguous create failure on a quote-card row still has no second route either.
  const third = mediaDeps({
    fetchPostizRegistry: registry({ fetchedAt: "2026-01-01T00:00:00Z", capabilities: [{ destination: "x", media: ["image"], accountId: "acct-1", accountLabel: "Human Inference", localMediaUpload: true }] }),
  });
  third.deps.publishPostiz = async () => { third.routes.push("postiz"); throw new PostizRateLimitError("2026-01-01T01:00:00Z"); };
  const failed = await scheduleApproved("/unused", card, third.deps);
  assert.deepEqual(third.routes, ["postiz"], "the rate-limit backup is scoped to media rows only");
  assert.match(failed.scheduleError ?? "", /rate limit reached/);
});

// ── Slot accounting across a real rate-limited Postiz create and its Typefully fallback ──────────
// Not a stub-level assertion: this runs the REAL defaultPublishPostiz (against a transport that
// rate-limits the create) and the REAL publishCards (against a stubbed Typefully API), against an
// isolated slot ledger. defaultPublishPostiz claims a slot BEFORE the provider call, so a create
// failure that does not give the slot back leaks calendar space on every retry; a fallback that
// claims without the first being released would hold two. Exactly one must be held net.
describe("a rate-limited create followed by a fallback holds exactly one slot", () => {
  const originalFetch = globalThis.fetch;
  const saved: Record<string, string | undefined> = {};
  const ENV_KEYS = [
    "TYPEFULLY_API_KEY", "TYPEFULLY_SOCIAL_SET_ID", "CONTENT_AGENTS_TEST_LEDGER",
    "CONTENT_AGENTS_TEST_BETS_PATH", "CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID", "CONTENT_AGENTS_POSTIZ_ACCOUNT_ID",
  ];
  const scratch = mkdtempSync(join(tmpdir(), "media-fallback-slots-"));
  const dirs: string[] = [scratch];

  before(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    process.env.TYPEFULLY_API_KEY = "test-key";
    process.env.TYPEFULLY_SOCIAL_SET_ID = "test-set";
    process.env.CONTENT_AGENTS_TEST_LEDGER = join(scratch, "publish-schedule.jsonl");
    process.env.CONTENT_AGENTS_TEST_BETS_PATH = join(scratch, "bets.md");
    process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID = "human-inference/typefully";
    process.env.CONTENT_AGENTS_POSTIZ_ACCOUNT_ID = "human-inference/postiz";
  });

  after(() => {
    globalThis.fetch = originalFetch;
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  test("the rate-limited Postiz claim is released and the Typefully fallback holds the only slot", async () => {
    const folder = mkdtempSync(join(tmpdir(), "media-fallback-live-"));
    dirs.push(folder);
    writeFileSync(join(folder, "content-request.json"), JSON.stringify({ origin: "human-inference" }));
    mkdirSync(join(folder, "derivatives"), { recursive: true });
    mkdirSync(join(folder, "configured-media", "cm-1"), { recursive: true });
    writeFileSync(
      join(folder, "review-queue.md"),
      `| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |\n` +
        `|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|\n` +
        `| cm-1 | linkedin | image | configured-media/cm-1/card.png | 4 | 5 | yes | approve | studio media row | from studio |\n`
    );
    writeFileSync(join(folder, "derivatives", "cm-1.md"), "---\ncta: none\n---\nCaption Muxin approved for this image.\n");
    writeFileSync(join(folder, "configured-media", "cm-1", "card.png"), "fixture bytes");

    // Postiz accepts the media upload, then rate-limits the create — the throttler's pre-controller
    // rejection, the one create failure that is unambiguously "nothing was created".
    const postizCalls: string[] = [];
    // Snapshot the ledger AT the create, before the rejection. Without this the test cannot tell
    // "Postiz claimed a slot and released it" — the behavior under test — from "Postiz never
    // claimed one at all"; both leave the same empty residue afterwards.
    let ledgerAtCreate: ReturnType<typeof readLedger> = [];
    const postiz: PostizTransport = {
      async request(path) {
        postizCalls.push(path);
        if (path === "/api/public/v1/upload") return { id: "pz-media-1", path: "/uploads/card.png" };
        if (path === "/api/public/v1/posts") {
          ledgerAtCreate = readLedger();
          throw new PostizRateLimitError("2099-01-01T00:00:00Z");
        }
        throw new Error(`unexpected Postiz path ${path}`);
      },
    };
    const typefullyCalls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      typefullyCalls.push(`${(init?.method ?? "GET").toUpperCase()} ${url}`);
      if (url.includes("/media/upload")) return new Response(JSON.stringify({ media_id: "media-1", upload_url: "https://s3.example.com/upload" }), { status: 200 });
      if (url.includes("s3.example.com")) return new Response(null, { status: 200 });
      if (url.endsWith("/drafts")) return new Response(JSON.stringify({ id: "draft-1" }), { status: 200 });
      throw new Error(`unexpected fetch in test: ${url}`);
    }) as typeof fetch;

    const deps: SchedulerDeps = {
      publishText: async () => [], publishCards, publishTikTok: async () => [], publishShorts: async () => [],
      publishSubstack: async () => [], lockOutreachMessage: async () => [],
      postizEnv: { POSTIZ_ACCOUNT_ID: "acct-1" },
      fetchPostizRegistry: registry(POSTIZ_TAKES_LINKEDIN_IMAGES),
      publishPostiz: (f, r, c, p) => defaultPublishPostiz(f, r, c, p, () => postiz),
    };

    const result = await scheduleApproved(folder, mediaRow(), deps);

    assert.equal(result.scheduleError, null);
    assert.equal((result.scheduled as { ref: string }).ref, "typefully draft draft-1");
    // Prove Postiz really was tried first and really did claim a slot before failing — otherwise the
    // ledger assertions below would pass trivially on a row that never reached the create at all.
    assert.deepEqual(postizCalls, ["/api/public/v1/upload", "/api/public/v1/posts"], "Postiz was tried first and reached the create");
    assert.ok(typefullyCalls.some((c) => c.endsWith("/drafts")), "the fallback created the Typefully draft");

    // Postiz really did hold a slot at the moment the create was rejected.
    assert.equal(ledgerAtCreate.length, 1, `Postiz must hold exactly one claim at the create: ${JSON.stringify(ledgerAtCreate)}`);
    assert.equal(ledgerAtCreate[0].by, "postiz");
    assert.equal(ledgerAtCreate[0].platform, "linkedin");
    assert.equal(ledgerAtCreate[0].asset, "configured-media/cm-1/card.png");

    // ...and it is gone afterwards. Asserted on the WHOLE ledger, unfiltered: a leaked claim under
    // any asset spelling, platform or `by` label shows up here, where a filtered view could miss it.
    const finalLedger = readLedger();
    assert.equal(finalLedger.length, 1, `the whole ledger must hold exactly one claim after the fallback: ${JSON.stringify(finalLedger)}`);
    const [held] = finalLedger;
    assert.equal(held.by, "cards", "the surviving claim is the fallback's, not the released Postiz one");
    assert.equal(held.platform, "linkedin");
    assert.equal(held.asset, `${basename(folder)}/cm-1`);
    assert.equal(held.day, laDayKey(new Date(held.time)));
    assert.ok(new Date(held.time).getTime() > Date.now(), "the held slot is in the future");
    assert.ok(existsSync(join(folder, "publish-log.md")));
  });
});

// ── Cross-function reuse-key agreement ───────────────────────────────────────────────────────────
// The Typefully fallback writes its bets.md Placed row under `target` (cards.ts), while
// scheduleApproved recomputes the guard under reuseGuardPlatform("media", row) (studio-scheduling.ts).
// Two independently-maintained functions must return the SAME string for the same row, and the
// failure mode if they ever drift is silent — a bucket mismatch "would never match and never block
// anything". This pins them together through an actual refusal: assert the specific reuse-guard
// message, which can only be produced when the recomputed key finds the row the fallback placed.
describe("a completed fallback is found by the reuse key the media path recomputes", () => {
  const originalFetch = globalThis.fetch;
  const saved: Record<string, string | undefined> = {};
  const ENV_KEYS = [
    "TYPEFULLY_API_KEY", "TYPEFULLY_SOCIAL_SET_ID", "CONTENT_AGENTS_TEST_LEDGER",
    "CONTENT_AGENTS_TEST_BETS_PATH", "CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID",
  ];
  const scratch = mkdtempSync(join(tmpdir(), "media-fallback-reuse-"));
  const dirs: string[] = [scratch];

  before(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    process.env.TYPEFULLY_API_KEY = "test-key";
    process.env.TYPEFULLY_SOCIAL_SET_ID = "test-set";
    // Its own ledger and bets file, so the whole-ledger assertion in the block above stays exact.
    process.env.CONTENT_AGENTS_TEST_LEDGER = join(scratch, "publish-schedule.jsonl");
    process.env.CONTENT_AGENTS_TEST_BETS_PATH = join(scratch, "bets.md");
    process.env.CONTENT_AGENTS_TYPEFULLY_ACCOUNT_ID = "human-inference/typefully";
  });

  after(() => {
    globalThis.fetch = originalFetch;
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  test("a second fallback for the same row is refused, naming the platform the first one placed to", async () => {
    const folder = mkdtempSync(join(tmpdir(), "media-fallback-reuse-folder-"));
    dirs.push(folder);
    writeFileSync(join(folder, "content-request.json"), JSON.stringify({ origin: "human-inference" }));
    mkdirSync(join(folder, "derivatives"), { recursive: true });
    mkdirSync(join(folder, "configured-media", "cm-1"), { recursive: true });
    const queuePath = join(folder, "review-queue.md");
    writeFileSync(
      queuePath,
      `| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes | origin |\n` +
        `|----|----------|--------|-------|-------------|------------|-----|--------|-------|--------|\n` +
        `| cm-1 | linkedin | image | configured-media/cm-1/card.png | 4 | 5 | yes | approve | studio media row | from studio |\n`
    );
    writeFileSync(join(folder, "derivatives", "cm-1.md"), "---\ncta: none\n---\nCaption Muxin approved for this image.\n");
    writeFileSync(join(folder, "configured-media", "cm-1", "card.png"), "fixture bytes");

    let draftCalls = 0;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/media/upload")) return new Response(JSON.stringify({ media_id: "media-1", upload_url: "https://s3.example.com/upload" }), { status: 200 });
      if (url.includes("s3.example.com")) return new Response(null, { status: 200 });
      if (url.endsWith("/drafts")) { draftCalls++; return new Response(JSON.stringify({ id: "draft-1" }), { status: 200 }); }
      throw new Error(`unexpected fetch in test: ${url}`);
    }) as typeof fetch;

    // Postiz unconfigured, so both runs take the backup route.
    const deps: SchedulerDeps = {
      publishText: async () => [], publishCards, publishTikTok: async () => [], publishShorts: async () => [],
      publishSubstack: async () => [], lockOutreachMessage: async () => [], postizEnv: {},
    };

    const first = await scheduleApproved(folder, mediaRow(), deps);
    assert.equal(first.scheduleError, null);
    assert.equal((first.scheduled as { ref: string }).ref, "typefully draft draft-1");
    assert.equal(draftCalls, 1);

    // Put the row back to `approve`, as a crashed status write would have left it.
    writeFileSync(queuePath, readFileSync(queuePath, "utf8").replace("| published |", "| approve |"));

    const second = await scheduleApproved(folder, mediaRow(), deps);

    assert.equal(second.scheduled, null);
    // The SPECIFIC message, not the generic "check the server log" fallback: it can only be built
    // when reuseGuardPlatform's key finds the Placed row cards.ts wrote under `target`. If those two
    // ever drift apart, this assertion is what catches it.
    assert.match(second.scheduleError ?? "", /^blocked by reuse guard, last placed to linkedin /);
    assert.match(second.scheduleError ?? "", /min_reuse_days: 60/);
    assert.equal(draftCalls, 1, "no second draft may be created");
  });
});
