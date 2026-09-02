import { test } from "node:test";
import assert from "node:assert/strict";
import { scheduleApproved, scheduleKind, planPostizDispatch, type SchedulerDeps } from "./studio-scheduling.js";
import type { QueueRow } from "../publish/queue.js";
import type { DeliveryPolicyDecision } from "../publish/delivery-policy.js";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
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

test("Postiz dispatch places the source CTA like the Typefully path: reply on X, inline on Bluesky, none on video", async () => {
  const { planPostizDispatch } = await import("./studio-scheduling.js");
  const { mkdirSync } = await import("node:fs");
  const root = mkdtempSync(join(tmpdir(), "postiz-cta-"));
  mkdirSync(join(root, "derivatives"));
  writeFileSync(join(root, "source.md"), "---\ntitle: \"Essay\"\ncanonical_url: https://example.substack.com/p/essay\n---\nBody.\n");
  writeFileSync(join(root, "derivatives", "x-1.md"), "---\nsource_lines: [1]\ncta: source\n---\nA line Muxin wrote.\n");
  writeFileSync(join(root, "derivatives", "bs-1.md"), "---\nsource_lines: [1]\ncta: source\n---\nAnother line.\n");
  const transport = { async request() { throw new Error("no network in this test"); } };
  const base = { format: "text", asset: "", status: "approve", notes: "", lineIndex: 1 } as const;
  const x = await planPostizDispatch(root, { ...base, id: "x-1", platform: "x", asset: "derivatives/x-1.md" } as QueueRow, "acct", "2026-09-20T17:00:00Z", transport);
  assert.equal(x.input.content, "A line Muxin wrote.", "X keeps the link out of the body");
  assert.ok(x.input.followUps?.[0]?.includes("https://example.substack.com/p/essay"), "X carries the source link as the first reply");
  assert.equal(x.ctaDestination, "source");
  assert.equal(x.placement, "reply");
  const bs = await planPostizDispatch(root, { ...base, id: "bs-1", platform: "bluesky", asset: "derivatives/bs-1.md" } as QueueRow, "acct", "2026-09-20T17:00:00Z", transport);
  assert.ok(bs.input.content.includes("https://example.substack.com/p/essay"), "Bluesky places the link inline");
  assert.equal(bs.input.followUps, undefined);
  rmSync(root, { recursive: true, force: true });
});

// ── Configured-media routing: scheduleKind should own image/video rows Postiz can deliver, without
// swallowing rows a legacy scheduler already owns (quote-card, tiktok, YouTube short, or the older
// {x|linkedin|bluesky, format:"video", asset:"video/*.mp4"} native-video Typefully post). ────────
test("scheduleKind routes configured-media image/video rows to 'media', not text/null", () => {
  const configured = (over: Partial<QueueRow>): QueueRow => ({
    id: "m-1", platform: "instagram", format: "image", asset: "media-stages/m-1.json", status: "approve", notes: "", lineIndex: 1, ...over,
  });
  assert.equal(scheduleKind(configured({ platform: "instagram", format: "image" })), "media");
  assert.equal(scheduleKind(configured({ platform: "linkedin", format: "image" })), "media");
  assert.equal(scheduleKind(configured({ platform: "instagram", format: "video", asset: "configured-media/m-1/video.mp4" })), "media");
  assert.equal(scheduleKind(configured({ platform: "x", format: "video", asset: "configured-media/m-1/video.mp4" })), "media");
  // still owned by the existing short/tiktok schedulers, unaffected by the new "media" kind
  assert.equal(scheduleKind(configured({ platform: "youtube", format: "video", asset: "configured-media/m-1/video.mp4" })), "media"); // configured tiktok/youtube rows go through Postiz; the legacy PostPeer/YouTube handlers read video/short.mp4, never row.asset
  assert.equal(scheduleKind(configured({ platform: "tiktok", format: "video", asset: "configured-media/m-1/video.mp4" })), "media");
  // the older native-video Typefully post (not a configured-media row: no media-stages/configured-media asset)
  assert.equal(scheduleKind({ id: "qvid-x", platform: "x", format: "video", asset: "video/short.mp4", status: "approve", notes: "", lineIndex: 1 }), "text");
});

function fakeTransport(uploaded: string[]) {
  let n = 0;
  return {
    async request() {
      n += 1;
      const id = `media-${n}`;
      uploaded.push(id);
      return { id, path: `/uploads/${id}.png` };
    },
  };
}

test("Postiz carousel dispatch uploads every slide in order and captions from the derivative", async () => {
  const root = mkdtempSync(join(tmpdir(), "postiz-carousel-"));
  mkdirSync(join(root, "derivatives"));
  mkdirSync(join(root, "configured-media", "m-1"), { recursive: true });
  writeFileSync(join(root, "derivatives", "m-1.md"), "---\nsource_lines: [1]\n---\nCarousel caption from the derivative.\n");
  writeFileSync(join(root, "configured-media", "m-1", "slide-1.png"), "png-1");
  writeFileSync(join(root, "configured-media", "m-1", "slide-2.png"), "png-2");
  writeFileSync(join(root, "configured-media", "m-1", "carousel-manifest.json"), JSON.stringify({
    version: "configured-carousel-v1",
    slides: ["configured-media/m-1/slide-1.png", "configured-media/m-1/slide-2.png"],
  }));
  const uploaded: string[] = [];
  const row: QueueRow = { id: "m-1", platform: "linkedin", format: "image", asset: "configured-media/m-1/carousel-manifest.json", status: "approve", notes: "", lineIndex: 1 };
  const plan = await planPostizDispatch(root, row, "acct", "2026-09-20T17:00:00Z", fakeTransport(uploaded));
  assert.deepEqual(uploaded, ["media-1", "media-2"]);
  assert.equal(plan.input.media?.length, 2);
  assert.deepEqual(plan.input.media?.map((m) => m.id), ["media-1", "media-2"]);
  assert.equal(plan.input.content, "Carousel caption from the derivative.");
  rmSync(root, { recursive: true, force: true });
});

test("Postiz carousel dispatch refuses a manifest that exceeds the destination's image cap", async () => {
  const root = mkdtempSync(join(tmpdir(), "postiz-carousel-cap-"));
  mkdirSync(join(root, "derivatives"));
  mkdirSync(join(root, "configured-media", "m-2"), { recursive: true });
  writeFileSync(join(root, "derivatives", "m-2.md"), "---\nsource_lines: [1]\n---\nToo many slides.\n");
  const slides = Array.from({ length: 5 }, (_, i) => `configured-media/m-2/slide-${i + 1}.png`);
  for (const slide of slides) writeFileSync(join(root, slide), "png");
  writeFileSync(join(root, "configured-media", "m-2", "carousel-manifest.json"), JSON.stringify({ version: "configured-carousel-v1", slides }));
  const row: QueueRow = { id: "m-2", platform: "x", format: "image", asset: "configured-media/m-2/carousel-manifest.json", status: "approve", notes: "", lineIndex: 1 };
  await assert.rejects(
    planPostizDispatch(root, row, "acct", "2026-09-20T17:00:00Z", fakeTransport([])),
    /more than x allows \(max 4\)/,
  );
  rmSync(root, { recursive: true, force: true });
});

test("Postiz dispatch refuses a non-quote-card image/video row with no derivative", async () => {
  const root = mkdtempSync(join(tmpdir(), "postiz-missing-derivative-"));
  mkdirSync(join(root, "configured-media", "m-3"), { recursive: true });
  writeFileSync(join(root, "configured-media", "m-3", "image.png"), "png");
  const row: QueueRow = { id: "m-3", platform: "instagram", format: "image", asset: "configured-media/m-3/image.png", status: "approve", notes: "", lineIndex: 1 };
  await assert.rejects(
    planPostizDispatch(root, row, "acct", "2026-09-20T17:00:00Z", fakeTransport([])),
    /missing derivative .*m-3\.md/,
  );
  rmSync(root, { recursive: true, force: true });
});

test("Postiz dispatch sends a single configured image on instagram with the derivative caption", async () => {
  const root = mkdtempSync(join(tmpdir(), "postiz-single-image-"));
  mkdirSync(join(root, "derivatives"));
  mkdirSync(join(root, "configured-media", "m-4"), { recursive: true });
  writeFileSync(join(root, "derivatives", "m-4.md"), "---\nsource_lines: [1]\n---\nSingle configured image caption.\n");
  writeFileSync(join(root, "configured-media", "m-4", "image.png"), "png");
  const uploaded: string[] = [];
  const row: QueueRow = { id: "m-4", platform: "instagram", format: "image", asset: "configured-media/m-4/image.png", status: "approve", notes: "", lineIndex: 1 };
  const plan = await planPostizDispatch(root, row, "acct", "2026-09-20T17:00:00Z", fakeTransport(uploaded));
  assert.deepEqual(uploaded, ["media-1"]);
  assert.equal(plan.input.media?.length, 1);
  assert.equal(plan.input.content, "Single configured image caption.");
  rmSync(root, { recursive: true, force: true });
});

test("Postiz video title falls back from video/title.txt to the derivative's first line to row.notes", async () => {
  const root = mkdtempSync(join(tmpdir(), "postiz-video-title-"));
  mkdirSync(join(root, "derivatives"));
  mkdirSync(join(root, "configured-media", "m-5"), { recursive: true });
  writeFileSync(join(root, "derivatives", "m-5.md"), "---\nsource_lines: [1]\n---\nFirst real line of the caption.\nSecond line.\n");
  writeFileSync(join(root, "configured-media", "m-5", "video.mp4"), "mp4");
  const row: QueueRow = { id: "m-5", platform: "youtube", format: "video", asset: "configured-media/m-5/video.mp4", status: "approve", notes: "fallback note", lineIndex: 1 };
  const plan = await planPostizDispatch(root, row, "acct", "2026-09-20T17:00:00Z", fakeTransport([]));
  assert.equal((plan.input.providerSettings as { title: string }).title, "First real line of the caption. #Shorts");
  rmSync(root, { recursive: true, force: true });
});
