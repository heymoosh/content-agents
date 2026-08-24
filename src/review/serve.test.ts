import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  revisePrompt,
  classifySource,
  sourceDispatch,
  isSafeRawPath,
  isValidLeadDir,
  isValidMessageFile,
  outreachDraftGuard,
  followUpDraftGuard,
  MAX_DIRECTION_CHARS,
  appendLeadNote,
  approveBlockReason,
  replyToMentionBlockReason,
  scheduleKind,
  scheduleApproved,
  enrich,
  jobLogPath,
  lastNonEmptyLine,
  tailLines,
  jobElapsedMs,
  daysAgo,
  computeFreshness,
  parseBriefDate,
  extractSection,
  type SchedulerDeps,
  appendLeadContact,
  ventureAnalysisPrompt,
} from "./serve.js";
import type { LiveProviderState } from "./reconcile.js";
import type { QueueRow } from "../publish/queue.js";

test("ventureAnalysisPrompt is read-only and carries the server-derived state", () => {
  const prompt = ventureAnalysisPrompt("my-venture", { phase: 2, next: "review" });
  assert.match(prompt, /\.claude\/skills\/venture\/SKILL\.md/);
  assert.match(prompt, /do not write, edit, delete, or advance/);
  assert.match(prompt, /my-venture/);
  assert.match(prompt, /"phase": 2/);
});

// "Revise with Claude" (Muxin, 2026-07-03): the GUI shells out to headless `claude -p` to edit one
// derivative in place. The prompt is the only guardrail against Claude wandering — these lock it in.

test("revisePrompt scopes to one file and carries the extraction-first + voice guardrails", () => {
  const p = revisePrompt("2026-06-16-foo", "x-1", "x", "make it punchier");
  assert.match(p, /content\/2026-06-16-foo\/derivatives\/x-1\.md/); // the exact file, nothing else
  assert.match(p, /make it punchier/); // Muxin's instruction is included
  assert.match(p, /Edit ONLY that one file/);
  assert.match(p, /frontmatter/); // preserve frontmatter
  assert.match(p, /source\.md/); // extraction-first traceability
  assert.match(p, /voice\.yaml/); // no em dashes / AI tells
  assert.ok(!/quote-card CAPTION/.test(p), "x-1 is not a card caption");
});

test("revisePrompt adds the context-only rule only for a quote-card caption id", () => {
  const caption = revisePrompt("2026-06-16-foo", "quote-card-2-linkedin", "linkedin", "tighten it");
  assert.match(caption, /quote-card CAPTION/);
  assert.match(caption, /context-only/);

  // the card DEFINITION derivative (quote-card-2, the quote itself) is not a caption
  const def = revisePrompt("2026-06-16-foo", "quote-card-2", "quote-card", "x");
  assert.ok(!/quote-card CAPTION/.test(def));
});

// "Add / Queue" tab (Muxin, 2026-07-03): the GUI is the front door now. A raw source string is
// routed to /atomize as a url, a real file path, or pasted text — this decides which.
test("classifySource routes urls, existing files, and pasted text", () => {
  assert.equal(classifySource("https://x.substack.com/p/post").kind, "url");

  const file = classifySource("/vault/My Note.md", (p) => p === "/vault/My Note.md");
  assert.equal(file.kind, "file");
  assert.equal(file.arg, "/vault/My Note.md");
  assert.equal(file.label, "My Note.md");

  const text = classifySource("# An Idea\nsome body that isn't a path", () => false);
  assert.equal(text.kind, "text");
  assert.equal(text.label, "An Idea"); // title from the first heading, hash stripped

  // a path-looking string that doesn't resolve is a fast "file not found", never dispatched as
  // pasted text — a nonexistent path materialized as fake note content used to burn a full LLM
  // atomize run before the model itself noticed the input was garbage.
  const missing = classifySource("/nope/missing.md", () => false);
  assert.equal(missing.kind, "file-not-found");
  assert.equal(missing.arg, "/nope/missing.md");
});

test("classifySource recognizes ~/ and drive-letter paths as file-not-found too", () => {
  assert.equal(classifySource("~/vault/missing.md", () => false).kind, "file-not-found");
  assert.equal(classifySource("C:\\notes\\missing.md", () => false).kind, "file-not-found");
  // a slash inside prose (has a space) is still plain pasted text, not a phantom path
  assert.equal(classifySource("thoughts on love/loss and grief", () => false).kind, "text");
});

test("sourceDispatch surfaces an immediate error for file-not-found instead of dispatching a job", () => {
  const dispatch = sourceDispatch(classifySource("/nope/missing.md", () => false), "/nope/missing.md");
  assert.ok("error" in dispatch);
  assert.match((dispatch as { error: string }).error, /no such file/);

  const textDispatch = sourceDispatch(classifySource("just some pasted text", () => false), "just some pasted text");
  assert.equal(("kind" in textDispatch && textDispatch.kind) || null, "text");
});

// Analytics tab "raw downloaded exports" viewer (Muxin, 2026-07-04): serves files straight out of
// data/inbox and data/processed by a client-supplied relative path — this guard is the only thing
// standing between that and reading arbitrary files off disk.
// Approve guard (Muxin, 2026-07-04): the "video-script" row (format=storyboard) drafts
// video/script-draft.md long before /video turns it into video/storyboard.md — the one file
// src/video/render.ts's own render gate trusts. Approving off the draft alone is a phantom
// approval. `exists` is injected so these don't touch the real filesystem.
const storyboardRow: QueueRow = {
  id: "video-script", platform: "video-script", format: "storyboard", asset: "—",
  status: "blocked", notes: "", lineIndex: 0,
};

test("approveBlockReason blocks a storyboard row when video/storyboard.md doesn't exist", () => {
  const reason = approveBlockReason("/content/2026-06-16-foo", storyboardRow, () => false);
  assert.match(reason ?? "", /storyboard not rendered yet/);
  assert.match(reason ?? "", /\/video/); // tells Muxin what to run
});

test("approveBlockReason allows the same storyboard row once video/storyboard.md exists", () => {
  const reason = approveBlockReason(
    "/content/2026-06-16-foo",
    storyboardRow,
    (p) => p === "/content/2026-06-16-foo/video/storyboard.md",
  );
  assert.equal(reason, null);
});

test("approveBlockReason never blocks text rows, even with nothing on disk", () => {
  const textRow: QueueRow = { id: "x-1", platform: "x", format: "text", asset: "derivatives/x-1.md", status: "pending", notes: "", lineIndex: 1 };
  const alwaysFalse = () => false;
  assert.equal(approveBlockReason("/content/2026-06-16-foo", textRow, alwaysFalse), null);
});

// Quote-card (format=image) rows carry the same missing-render risk as storyboard/video above — a
// row can land in review-queue.md before /render -- --still ever produces its PNG.
test("approveBlockReason blocks an image/quote-card row whose PNG isn't rendered yet", () => {
  const imageRow: QueueRow = { id: "quote-card-1", platform: "quote-card", format: "image", asset: "images/quote-card-1.png", status: "pending", notes: "", lineIndex: 2 };
  const cardCaptionRow: QueueRow = { id: "quote-card-6-x", platform: "quote-card:x", format: "image", asset: "images/quote-card-6.png", status: "pending", notes: "", lineIndex: 3 };
  const alwaysFalse = () => false;
  assert.match(approveBlockReason("/content/2026-06-16-foo", imageRow, alwaysFalse) ?? "", /not rendered yet/);
  assert.match(approveBlockReason("/content/2026-06-16-foo", cardCaptionRow, alwaysFalse) ?? "", /not rendered yet/);
});

test("approveBlockReason allows an image/quote-card row once its PNG exists", () => {
  const imageRow: QueueRow = { id: "quote-card-1", platform: "quote-card", format: "image", asset: "images/quote-card-1.png", status: "pending", notes: "", lineIndex: 2 };
  const exists = (p: string) => p === "/content/2026-06-16-foo/images/quote-card-1.png";
  assert.equal(approveBlockReason("/content/2026-06-16-foo", imageRow, exists), null);
});

test("approveBlockReason doesn't block an image/quote-card row with no asset cell yet (nothing to check)", () => {
  const noAssetRow: QueueRow = { id: "quote-card-1", platform: "quote-card", format: "image", asset: "—", status: "pending", notes: "", lineIndex: 2 };
  assert.equal(approveBlockReason("/content/2026-06-16-foo", noAssetRow, () => false), null);
});

// "video"/"short" rows carry the same missing-render risk as the video-script row above (the
// rendered short + its TikTok row are also added to review-queue.md right after a /video render —
// docs/content-agents-backlog.md card 4bef9a7c calls this out by name as "storyboard/video rows").
test("approveBlockReason blocks a video/short row whose asset isn't rendered yet", () => {
  const videoRow: QueueRow = { id: "qvid-x", platform: "x", format: "video", asset: "video/short.mp4", status: "pending", notes: "", lineIndex: 4 };
  const shortRow: QueueRow = { id: "tiktok-1", platform: "tiktok", format: "short", asset: "video/short.mp4", status: "pending", notes: "", lineIndex: 5 };
  const alwaysFalse = () => false;
  assert.match(approveBlockReason("/content/2026-06-16-foo", videoRow, alwaysFalse) ?? "", /not rendered yet/);
  assert.match(approveBlockReason("/content/2026-06-16-foo", shortRow, alwaysFalse) ?? "", /not rendered yet/);
});

test("approveBlockReason allows a video/short row once its asset exists", () => {
  const videoRow: QueueRow = { id: "qvid-x", platform: "x", format: "video", asset: "video/short.mp4", status: "pending", notes: "", lineIndex: 4 };
  const exists = (p: string) => p === "/content/2026-06-16-foo/video/short.mp4";
  assert.equal(approveBlockReason("/content/2026-06-16-foo", videoRow, exists), null);
});

test("approveBlockReason doesn't block a video/short row with no asset cell yet (nothing to check)", () => {
  const noAssetRow: QueueRow = { id: "tiktok-1", platform: "tiktok", format: "short", asset: "—", status: "pending", notes: "", lineIndex: 5 };
  assert.equal(approveBlockReason("/content/2026-06-16-foo", noAssetRow, () => false), null);
});

// Security fix (card db22283f follow-up): rows.ts's `isReply` gate inside enrich() only ever
// drove the revisable/duplicatable BUTTON flags in the GUI — a client-side hint, not a server-side
// gate. A request straight at /api/revise or /api/duplicate for a "reply to mention" row's id could
// still reach reviseDerivative/duplicateToPlatform, both of which run a `claude -p` prompt over
// content/<slug>/source.md — for that origin, the mention author's own untrusted post text, not
// Muxin's — through runClaudeSpawn's DEFAULT permission mode (acceptEdits, full tool access),
// unlike reply-draft.ts's locked-down `--tools ""` spawn for that same untrusted text.
// replyToMentionBlockReason is what those two route handlers in serve.ts (~/api/revise, ~/api/duplicate)
// now call FIRST, sourced from the row's real persisted origin via readQueue — never a
// client-supplied flag — returning early with a 400 before reviseDerivative/duplicateToPlatform
// (and therefore any `claude -p` spawn) is ever reached.
test('replyToMentionBlockReason blocks a row whose persisted origin is "reply to mention"', () => {
  const row: QueueRow = {
    id: "bluesky-1", platform: "bluesky", format: "text", asset: "derivatives/bluesky-1.md",
    status: "pending", notes: "reply to @alice.bsky.social", origin: "reply to mention", lineIndex: 1,
  };
  const reason = replyToMentionBlockReason(row);
  assert.match(reason ?? "", /reply-to-mention row/);
  assert.match(reason ?? "", /not Muxin's writing/);
});

test("replyToMentionBlockReason allows every other origin, a row with no origin column, and an unknown id", () => {
  const base = { id: "x-1", platform: "x", format: "text", asset: "derivatives/x-1.md", status: "pending", notes: "", lineIndex: 1 };
  assert.equal(replyToMentionBlockReason({ ...base, origin: "from /cycle" }), null);
  assert.equal(replyToMentionBlockReason({ ...base, origin: "from GUI queue" }), null);
  assert.equal(replyToMentionBlockReason({ ...base }), null); // pre-2026-07-04 row, no origin cell
  // An id that doesn't match any row (readQueue's .find() returns undefined) isn't blocked here —
  // it falls through to reviseDerivative/duplicateToPlatform's own "no such row" error, same as
  // before this fix, so a bad id still gets a real error instead of a misleading reply-gate message.
  assert.equal(replyToMentionBlockReason(undefined), null);
});

test("isSafeRawPath only allows paths under data/inbox or data/processed", () => {
  assert.ok(isSafeRawPath("inbox/x/export.csv"));
  assert.ok(isSafeRawPath("processed/foo.json"));
  assert.ok(!isSafeRawPath("../../.env"));
  assert.ok(!isSafeRawPath("/etc/passwd"));
  assert.ok(!isSafeRawPath("config/voice.yaml")); // outside the two allowed roots
  assert.ok(!isSafeRawPath(""));
});

test("isValidLeadDir only allows a single real segment under outreach/leads/", () => {
  assert.ok(isValidLeadDir("outreach/leads/client-acme-co"));
  assert.ok(isValidLeadDir("outreach/leads/platform-foo.bar"));
  assert.ok(!isValidLeadDir("outreach/leads/..")); // single-segment ".." would resolve one level up
  assert.ok(!isValidLeadDir("outreach/leads/."));
  assert.ok(!isValidLeadDir("outreach/leads/../../../etc/passwd"));
  assert.ok(!isValidLeadDir("/etc/passwd"));
  assert.ok(!isValidLeadDir(""));
});

// Approve → auto-schedule for cards / tiktok / video / substack (Muxin, 2026-07-04): approving one
// of these rows in the GUI now schedules it via its platform's existing publish function (no
// separate /publish run), mirroring the text→Typefully path. `SchedulerDeps` is injected so these
// route/error tests NEVER touch a real PostPeer / Upload-Post / YouTube / browser network call.
const row = (over: Partial<QueueRow>): QueueRow => ({
  id: "r", platform: "x", format: "text", asset: "—", status: "approve", notes: "", lineIndex: 0, ...over,
});

test("scheduleKind routes each row type to the publisher that owns its filter", () => {
  assert.equal(scheduleKind(row({ platform: "x", format: "text" })), "text");
  assert.equal(scheduleKind(row({ platform: "linkedin" })), "text");
  assert.equal(scheduleKind(row({ platform: "bluesky" })), "text");
  // a native-video post on a text platform (the animated quote video: {x|linkedin|bluesky, video})
  // still goes via Typefully, NOT youtube — text platforms are matched first, which is required so
  // these real qvid rows don't fall to youtube.ts (whose filter is format==="short", not "video").
  assert.equal(scheduleKind(row({ platform: "x", format: "video" })), "text");
  assert.equal(scheduleKind(row({ platform: "quote-card", format: "image" })), "card");
  assert.equal(scheduleKind(row({ platform: "quote-card:linkedin", format: "image" })), "card");
  assert.equal(scheduleKind(row({ platform: "tiktok", format: "short" })), "tiktok"); // matched before video
  // the YouTube Short row (format "short" only ever appears on youtube/tiktok rows, never a text platform)
  assert.equal(scheduleKind(row({ platform: "youtube", format: "short" })), "video");
  assert.equal(scheduleKind(row({ platform: "youtube", format: "video" })), "video");
  assert.equal(scheduleKind(row({ platform: "substack", format: "text" })), "substack");
  // a row no scheduler owns just gets the plain approve status (e.g. the storyboard row)
  assert.equal(scheduleKind(row({ platform: "video-script", format: "storyboard" })), null);
  // Outreach Phase 2: Approve on an outreach-message row means LOCK, never a real scheduler —
  // routed by format (fixed), not platform (the channel: email|linkedin-dm|contact-form|podcast-pitch).
  assert.equal(scheduleKind(row({ platform: "email", format: "outreach-message" })), "outreach-lock");
  assert.equal(scheduleKind(row({ platform: "podcast-pitch", format: "outreach-message" })), "outreach-lock");
});

// Stub deps: record which publisher fired + return a marker so we can assert the row's scheduled
// info came back. Any dep NOT overridden throws if called, proving routing hit exactly one path.
function stubDeps(): { deps: SchedulerDeps; calls: Record<string, { folder: string; onlyIds?: string[] }[]> } {
  const calls: Record<string, { folder: string; onlyIds?: string[] }[]> = {
    publishText: [], publishCards: [], publishTikTok: [], publishShorts: [], publishSubstack: [], lockOutreachMessage: [],
  };
  const rec = (name: string) => async (folder: string, opts?: { onlyIds?: string[] }) => {
    calls[name].push({ folder, onlyIds: opts?.onlyIds });
    return [{ scheduledBy: name }];
  };
  return {
    calls,
    deps: {
      publishText: rec("publishText"),
      publishCards: rec("publishCards"),
      publishTikTok: rec("publishTikTok"),
      publishShorts: rec("publishShorts"),
      publishSubstack: rec("publishSubstack"),
      lockOutreachMessage: rec("lockOutreachMessage"),
    },
  };
}

test("scheduleApproved schedules a TEXT row via publishText only (mocked, no network)", async () => {
  const { deps, calls } = stubDeps();
  const out = await scheduleApproved("/content/2026-06-16-foo", row({ id: "x-1", platform: "x", format: "text" }), deps);
  assert.deepEqual(out, { scheduled: { scheduledBy: "publishText" }, scheduleError: null });
  assert.deepEqual(calls.publishText, [{ folder: "/content/2026-06-16-foo", onlyIds: ["x-1"] }]);
  assert.equal(
    calls.publishCards.length + calls.publishTikTok.length + calls.publishShorts.length + calls.publishSubstack.length,
    0,
  );
});

test("scheduleApproved schedules a CARD row via publishCards only (mocked, no network)", async () => {
  const { deps, calls } = stubDeps();
  const out = await scheduleApproved("/content/2026-06-16-foo", row({ id: "quote-card-1", platform: "quote-card:x", format: "image" }), deps);
  assert.deepEqual(out, { scheduled: { scheduledBy: "publishCards" }, scheduleError: null });
  assert.deepEqual(calls.publishCards, [{ folder: "/content/2026-06-16-foo", onlyIds: ["quote-card-1"] }]);
  assert.equal(
    calls.publishTikTok.length + calls.publishShorts.length + calls.publishText.length + calls.publishSubstack.length,
    0,
  );
});

test("scheduleApproved schedules a TIKTOK row via publishTikTok only (mocked, no network)", async () => {
  const { deps, calls } = stubDeps();
  const out = await scheduleApproved("/f", row({ id: "tiktok-1", platform: "tiktok", format: "short" }), deps);
  assert.deepEqual(out, { scheduled: { scheduledBy: "publishTikTok" }, scheduleError: null });
  assert.deepEqual(calls.publishTikTok, [{ folder: "/f", onlyIds: ["tiktok-1"] }]);
  assert.equal(
    calls.publishCards.length + calls.publishShorts.length + calls.publishText.length + calls.publishSubstack.length,
    0,
  );
});

test("scheduleApproved schedules a VIDEO (Short) row via publishShorts only (mocked, no network)", async () => {
  const { deps, calls } = stubDeps();
  const out = await scheduleApproved("/f", row({ id: "yt-1", platform: "youtube", format: "short" }), deps);
  assert.deepEqual(out, { scheduled: { scheduledBy: "publishShorts" }, scheduleError: null });
  assert.deepEqual(calls.publishShorts, [{ folder: "/f", onlyIds: ["yt-1"] }]);
  assert.equal(
    calls.publishCards.length + calls.publishTikTok.length + calls.publishText.length + calls.publishSubstack.length,
    0,
  );
});

test("scheduleApproved schedules a SUBSTACK row via publishSubstack only (mocked, no network)", async () => {
  const { deps, calls } = stubDeps();
  const out = await scheduleApproved("/f", row({ id: "note-1", platform: "substack", format: "text" }), deps);
  assert.deepEqual(out, { scheduled: { scheduledBy: "publishSubstack" }, scheduleError: null });
  assert.deepEqual(calls.publishSubstack, [{ folder: "/f", onlyIds: ["note-1"] }]);
  assert.equal(
    calls.publishCards.length + calls.publishTikTok.length + calls.publishShorts.length + calls.publishText.length,
    0,
  );
});

test("scheduleApproved surfaces a scheduleError (row stays approve) when the publisher throws", async () => {
  const { deps } = stubDeps();
  deps.publishTikTok = async () => {
    throw new Error("PostPeer returned 402 — free-tier posts exhausted");
  };
  const out = await scheduleApproved("/f", row({ id: "tiktok-1", platform: "tiktok", format: "short" }), deps);
  assert.equal(out.scheduled, null);
  assert.match(out.scheduleError ?? "", /402/); // visible reason, not a crash
});

test("scheduleApproved does nothing for a row no scheduler owns", async () => {
  const { deps, calls } = stubDeps();
  const out = await scheduleApproved("/f", row({ platform: "video-script", format: "storyboard" }), deps);
  assert.deepEqual(out, { scheduled: null, scheduleError: null });
  assert.equal(
    calls.publishText.length +
      calls.publishCards.length +
      calls.publishTikTok.length +
      calls.publishShorts.length +
      calls.publishSubstack.length +
      calls.lockOutreachMessage.length,
    0,
  );
});

// Outreach Phase 2, GUI approve-equals-lock semantics: approving an outreach-message row must
// call lock.ts (via deps.lockOutreachMessage) and NEVER any real scheduler/publisher — CLAUDE.md
// rule 2 analog, there is no send path. Same dispatch/injection pattern as every publisher above.
test("scheduleApproved locks an OUTREACH-MESSAGE row via lockOutreachMessage only, never a real publisher", async () => {
  const { deps, calls } = stubDeps();
  const out = await scheduleApproved(
    "/outreach/leads/client-acme-co",
    row({ id: "message-01", platform: "email", format: "outreach-message" }),
    deps,
  );
  assert.deepEqual(out, { scheduled: { scheduledBy: "lockOutreachMessage" }, scheduleError: null });
  assert.deepEqual(calls.lockOutreachMessage, [{ folder: "/outreach/leads/client-acme-co", onlyIds: ["message-01"] }]);
  assert.equal(
    calls.publishText.length + calls.publishCards.length + calls.publishTikTok.length + calls.publishShorts.length + calls.publishSubstack.length,
    0,
  );
});

test("scheduleApproved surfaces a scheduleError (row stays approve) when locking fails validation", async () => {
  const { deps } = stubDeps();
  deps.lockOutreachMessage = async () => {
    throw new Error("refusing to lock message-01.md, fails the two-sided guard");
  };
  const out = await scheduleApproved(
    "/outreach/leads/client-acme-co",
    row({ id: "message-01", platform: "email", format: "outreach-message" }),
    deps,
  );
  assert.equal(out.scheduled, null);
  assert.match(out.scheduleError ?? "", /two-sided guard/);
});

// A publisher can skip a row WITHOUT throwing (the reuse guard, or cards.ts finding no connected
// account for the row's target) — it just returns []. That must surface as a scheduleError, not the
// same {scheduled:null, scheduleError:null} shape as "no scheduler owns this row" — otherwise the GUI
// shows a bare "Approved" for both a harmless no-op AND a real, silently-skipped schedule attempt.
test("scheduleApproved surfaces a scheduleError when the publisher runs but schedules nothing", async () => {
  const { deps } = stubDeps();
  deps.publishTikTok = async () => [];
  const out = await scheduleApproved("/f", row({ id: "tiktok-1", platform: "tiktok", format: "short" }), deps);
  assert.equal(out.scheduled, null);
  assert.match(out.scheduleError ?? "", /reuse guard|connected account/);
});

// Live Typefully/PostPeer schedule reconciliation (Muxin, 2026-07-04): GET /api/queue calls
// enrich() per row to attach row.reconciled — this exercises that REAL function (not a
// reimplementation) against a temp folder, proving the GOAL_CONDITION end to end: one published
// row whose draft is genuinely live at the provider shows its real time, one approved row with
// nothing scheduled is flagged as a mismatch. No network — the live provider state is injected.
function tmpContentFolder(): string {
  return mkdtempSync(join(tmpdir(), "reconcile-serve-test-"));
}

test("enrich() attaches the provider's real time to a row that's genuinely live", () => {
  const folder = tmpContentFolder();
  try {
    const live: LiveProviderState = {
      typefullyDrafts: [{ id: "98765", whenIso: "2026-07-10T16:00:00.000Z", platforms: ["x"], title: "x-1 (content-agents)" }],
      postpeerPosts: [],
    };
    const log = { text: "- 2026-07-04T00:00:00.000Z — x-1 → typefully draft 98765 (x, Fri 9:00am PT)\n" };
    const r = row({ id: "x-1", platform: "x", format: "text", status: "published" });
    const out = enrich(folder, "2026-07-04-demo", r, log, live);
    assert.equal(out.reconciled?.provider, "typefully");
    assert.equal(out.reconciled?.state, "scheduled");
    assert.ok(out.reconciled?.when, "should carry the provider's real scheduled time");
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("enrich() flags an approved row with nothing scheduled at the provider as a mismatch", () => {
  const folder = tmpContentFolder();
  try {
    const live: LiveProviderState = { typefullyDrafts: [], postpeerPosts: [] };
    const r = row({ id: "tiktok-1", platform: "tiktok", format: "short", status: "approve" });
    const out = enrich(folder, "2026-07-04-demo", r, { text: "" }, live);
    assert.equal(out.reconciled?.provider, "postpeer");
    assert.equal(out.reconciled?.state, "mismatch");
    assert.match(out.reconciled?.reason ?? "", /no scheduled PostPeer post recorded/);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("enrich() omits reconciled entirely for a row that isn't approved yet", () => {
  const folder = tmpContentFolder();
  try {
    const live: LiveProviderState = { typefullyDrafts: [], postpeerPosts: [] };
    const r = row({ id: "x-2", platform: "x", format: "text", status: "pending" });
    const out = enrich(folder, "2026-07-04-demo", r, { text: "" }, live);
    assert.equal(out.reconciled, undefined);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

// Job observability (Codebase-review fix Phase 1, 2026-07-08): persist + stream Claude job logs,
// heartbeat + elapsed in the jobs pill, durable errors instead of a black box.

test("jobLogPath keeps every job's log under one dir, one file per job id", () => {
  const a = jobLogPath("job-1");
  const b = jobLogPath("job-2");
  assert.match(a, /gui-jobs[/\\]job-1\.log$/);
  assert.match(b, /gui-jobs[/\\]job-2\.log$/);
  assert.notEqual(a, b);
});

test("lastNonEmptyLine: the heartbeat is the last real line, ignoring trailing blank lines", () => {
  assert.equal(lastNonEmptyLine("line one\nline two\n"), "line two");
  assert.equal(lastNonEmptyLine("only line"), "only line");
  assert.equal(lastNonEmptyLine("line one\n\n   \n"), "line one");
});

test("lastNonEmptyLine: no output yet is null, not an empty string", () => {
  assert.equal(lastNonEmptyLine(""), null);
  assert.equal(lastNonEmptyLine("\n\n"), null);
});

test("tailLines: keeps the last N non-blank lines, dropping earlier ones", () => {
  const text = Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n");
  const tail = tailLines(text, 30);
  const lines = tail.split("\n");
  assert.equal(lines.length, 30);
  assert.equal(lines[0], "line 20");
  assert.equal(lines[29], "line 49");
});

test("tailLines: shorter input than N returns everything, blank lines dropped", () => {
  assert.equal(tailLines("a\n\nb\nc", 30), "a\nb\nc");
});

test("jobElapsedMs: null for a job that hasn't started yet", () => {
  assert.equal(jobElapsedMs({ status: "queued", startedAt: null, finishedAt: null }), null);
});

test("jobElapsedMs: keeps ticking against `now` while running", () => {
  const ms = jobElapsedMs({ status: "running", startedAt: 1000, finishedAt: null }, 4500);
  assert.equal(ms, 3500);
});

test("jobElapsedMs: freezes at finishedAt-startedAt once the job lands", () => {
  const ms = jobElapsedMs({ status: "done", startedAt: 1000, finishedAt: 6000 }, 999_999);
  assert.equal(ms, 5000);
});

// "Generate insights" data-first fix (Muxin, 2026-07-16): the reports it runs were always live off
// data/analytics.db — the only stale input was the full latest brief it inlined with no age signal.
// These four pure helpers replace that with a real "as of" stamp and a trimmed, dated brief excerpt
// instead of a whole-file dump (mdToHtml has no markdown-link syntax, so the brief is surfaced as a
// dated reference for the client to render as a real <a>, never as raw brief text in Claude's
// synthesis prompt/output).

test("daysAgo: same calendar day is 0", () => {
  const now = new Date("2026-07-16T18:00:00Z").getTime();
  assert.equal(daysAgo("2026-07-16", now), 0);
});

test("daysAgo: counts whole days between a date and now", () => {
  const now = new Date("2026-07-16T12:00:00Z").getTime();
  assert.equal(daysAgo("2026-06-24", now), 22);
});

test("daysAgo: accepts a full ISO timestamp, only the date part matters", () => {
  const now = new Date("2026-07-16T00:00:00Z").getTime();
  assert.equal(daysAgo("2026-07-12T09:41:00.000Z", now), 4);
});

test("computeFreshness: null when every date is null/undefined (no data at all)", () => {
  assert.equal(computeFreshness([null, undefined, null], Date.now()), null);
});

test("computeFreshness: picks the MOST RECENT of several dates, ignoring nulls", () => {
  const now = new Date("2026-07-16T00:00:00Z").getTime();
  const f = computeFreshness([null, "2026-07-01T00:00:00Z", "2026-07-12T09:41:00.000Z", null], now);
  assert.deepEqual(f, { date: "2026-07-12", ageDays: 4 });
});

test("parseBriefDate: extracts the date from a well-formed brief filename", () => {
  assert.equal(parseBriefDate("2026-06-24-strategy-brief.md"), "2026-06-24");
});

test("parseBriefDate: null for anything that doesn't match the exact pattern", () => {
  assert.equal(parseBriefDate("strategy-brief.md"), null);
  assert.equal(parseBriefDate("2026-06-24-strategy-brief.draft.md"), null);
  assert.equal(parseBriefDate("notes.md"), null);
});

test("extractSection: pulls one ## section through the next ## heading", () => {
  const md = [
    "# Strategy Brief: 2026-06-24",
    "intro text",
    "## Last cycle scorecard",
    "| Bet | Verdict |",
    "|---|---|",
    "| 001 | passed |",
    "## Data confidence",
    "| Channel | Status |",
  ].join("\n");
  const section = extractSection(md, "Last cycle scorecard");
  assert.match(section ?? "", /^## Last cycle scorecard/);
  assert.match(section ?? "", /001 \| passed/);
  assert.ok(!section?.includes("Data confidence"), "must stop before the next ## heading");
});

test("extractSection: a section at the end of the file runs to EOF", () => {
  const md = "# Brief\n## Directives for atomization\n- prioritize_pillar: human-ai\n- format_notes: short posts\n";
  const section = extractSection(md, "Directives for atomization");
  assert.match(section ?? "", /prioritize_pillar: human-ai/);
  assert.match(section ?? "", /format_notes: short posts/);
});

test("extractSection: null when the header isn't present (older or hand-edited brief)", () => {
  assert.equal(extractSection("# Brief\nsome text, no headers at all", "Directives for atomization"), null);
});

test("extractSection: header match is case-insensitive but the exact header text still must match", () => {
  const md = "## directives for atomization\nsome directive\n";
  assert.match(extractSection(md, "Directives for atomization") ?? "", /some directive/);
  assert.equal(extractSection(md, "Last cycle scorecard"), null);
});

// ── isValidMessageFile — the Outreach tab's inline draft editor may only touch a lead's own
// messages/message-NN.md, same allowlist posture as isValidLeadDir.

test("isValidMessageFile accepts only the messages/message-NN.md shape", () => {
  assert.equal(isValidMessageFile("messages/message-01.md"), true);
  assert.equal(isValidMessageFile("messages/message-12.md"), true);
  assert.equal(isValidMessageFile("messages/../lead.md"), false);
  assert.equal(isValidMessageFile("/etc/passwd"), false);
  assert.equal(isValidMessageFile("lead.md"), false);
  assert.equal(isValidMessageFile("messages/message-.md"), false);
  assert.equal(isValidMessageFile(""), false);
});

// ── outreachDraftGuard — the whole guard for POST /api/outreach/draft (v7 handoff §3). Reuses the
// same lead-folder allowlist every other outreach route uses, and caps a pasted-document direction.

test("outreachDraftGuard refuses anything outside a real outreach/leads/<dir> folder", () => {
  for (const bad of ["", "outreach/leads/..", "outreach/leads/../../etc/passwd", "/etc/passwd", "content/foo"]) {
    const g = outreachDraftGuard({ dir: bad, direction: "keep it short" });
    assert.ok("error" in g, `expected ${bad} to be refused`);
    assert.match((g as { error: string }).error, /valid outreach lead folder/);
  }
  // A missing dir is refused the same way, not treated as an empty-but-fine value.
  assert.ok("error" in outreachDraftGuard({}));
});

test("outreachDraftGuard accepts a real lead folder and passes the direction through", () => {
  const g = outreachDraftGuard({ dir: "outreach/leads/client-acme-co", direction: "  keep it short  " });
  assert.deepEqual(g, { dir: "outreach/leads/client-acme-co", direction: "keep it short", engine: "claude" });
});

test("outreachDraftGuard turns a blank direction into undefined, never an empty string", () => {
  // Load-bearing: `undefined` is what keeps buildDraftPrompt byte-identical for existing callers.
  for (const blank of ["", "   ", "\n\t "]) {
    const g = outreachDraftGuard({ dir: "outreach/leads/client-acme-co", direction: blank });
    assert.deepEqual(g, { dir: "outreach/leads/client-acme-co", direction: undefined, engine: "claude" });
  }
  assert.deepEqual(outreachDraftGuard({ dir: "outreach/leads/client-acme-co" }), {
    dir: "outreach/leads/client-acme-co",
    direction: undefined,
    engine: "claude",
  });
});

test("outreachDraftGuard normalizes the optional engine for the directed draft route", () => {
  assert.deepEqual(
    outreachDraftGuard({ dir: "outreach/leads/client-acme-co", engine: "grok" }),
    { dir: "outreach/leads/client-acme-co", direction: undefined, engine: "grok" },
  );
  assert.deepEqual(
    outreachDraftGuard({ dir: "outreach/leads/client-acme-co", engine: "unsupported" }),
    { dir: "outreach/leads/client-acme-co", direction: undefined, engine: "claude" },
  );
});

test("outreachDraftGuard caps a pasted-document direction before it reaches a spawn", () => {
  const ok = outreachDraftGuard({ dir: "outreach/leads/client-acme-co", direction: "x".repeat(MAX_DIRECTION_CHARS) });
  assert.ok(!("error" in ok));
  const tooLong = outreachDraftGuard({ dir: "outreach/leads/client-acme-co", direction: "x".repeat(MAX_DIRECTION_CHARS + 1) });
  assert.ok("error" in tooLong);
  assert.match((tooLong as { error: string }).error, /under 2000 characters/);
});

test("followUpDraftGuard validates the route folder and propagates the optional engine", () => {
  assert.deepEqual(
    followUpDraftGuard({ dir: "outreach/leads/client-acme-co", engine: "grok" }),
    { dir: "outreach/leads/client-acme-co", engine: "grok" },
  );
  assert.deepEqual(
    followUpDraftGuard({ dir: "outreach/leads/client-acme-co" }),
    { dir: "outreach/leads/client-acme-co", engine: "claude" },
  );
  assert.ok("error" in followUpDraftGuard({ dir: "outreach/leads/../escape", engine: "codex" }));
});

// ── appendLeadNote — Muxin's per-lead notes ("what stood out, why interested"), appended dated
// under lead.md's ## Muxin notes so the memory-jogger travels with the lead file itself.

const LEAD_RAW = [
  "---",
  "kind: client",
  'name: "Acme Co"',
  "---",
  "",
  "## Profile",
  "",
  "Acme makes widgets.",
  "",
  "## Decision log",
  "",
  "- 2026-07-10: intake",
  "",
].join("\n");

test("appendLeadNote creates ## Muxin notes before ## Decision log when the section is missing", () => {
  const out = appendLeadNote(LEAD_RAW, "loved the founder's blog voice", "2026-07-16");
  const notesAt = out.indexOf("## Muxin notes");
  const decisionAt = out.indexOf("## Decision log");
  assert.ok(notesAt !== -1 && decisionAt !== -1 && notesAt < decisionAt, "notes section lands before the decision log");
  assert.match(out, /- 2026-07-16: loved the founder's blog voice/);
  assert.match(out, /^---\n/, "frontmatter block survives");
  assert.match(out, /Acme makes widgets\./, "profile body survives");
});

test("appendLeadNote appends into an existing ## Muxin notes section, keeping order", () => {
  const withSection = appendLeadNote(LEAD_RAW, "first note", "2026-07-16");
  const out = appendLeadNote(withSection, "second note", "2026-07-17");
  const first = out.indexOf("first note");
  const second = out.indexOf("second note");
  const decisionAt = out.indexOf("## Decision log");
  assert.ok(first !== -1 && second !== -1 && first < second, "notes accumulate in order");
  assert.ok(second < decisionAt, "new note stays inside the notes section, not after the decision log");
  assert.equal(out.match(/## Muxin notes/g)?.length, 1, "no duplicate section");
});

test("appendLeadNote appends the section at the end when there is no ## Decision log", () => {
  const raw = "---\nkind: client\n---\n\n## Profile\n\nAcme.\n";
  const out = appendLeadNote(raw, "note", "2026-07-16");
  assert.match(out, /## Muxin notes/);
  assert.ok(out.indexOf("## Muxin notes") > out.indexOf("## Profile"));
  assert.match(out, /- 2026-07-16: note/);
});

// ── appendLeadContact (design 3d "WHO YOU'D REACH") ─────────────────────────────────────────────
test("appendLeadContact creates ## Contacts before ## Decision log and appends without duplicating", () => {
  const raw = `---\nkind: client\nname: "PostHog"\n---\n\n## Profile\n\ntext\n\n## Decision log\n\n- 2026-07-01: researched\n`;
  const once = appendLeadContact(raw, "Jamie R.", "community lead");
  assert.match(once, /## Contacts\n\n- Jamie R\. \| community lead\n/);
  assert.ok(once.indexOf("## Contacts") < once.indexOf("## Decision log"));
  const twice = appendLeadContact(once, "Annika L.", "");
  assert.match(twice, /- Jamie R\. \| community lead\n- Annika L\.\n/);
  assert.throws(() => appendLeadContact(twice, "jamie r.", "any"), /already a contact/);
});
