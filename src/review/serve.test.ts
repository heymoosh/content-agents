import { test } from "node:test";
import assert from "node:assert/strict";
import { revisePrompt, classifySource, isSafeRawPath, approveBlockReason } from "./serve.js";
import type { QueueRow } from "../publish/queue.js";

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

  // a path-looking string that doesn't resolve is pasted text, not a phantom file
  assert.equal(classifySource("/nope/missing.md", () => false).kind, "text");
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

test("approveBlockReason never blocks text/image/quote-card rows, even with nothing on disk", () => {
  const textRow: QueueRow = { id: "x-1", platform: "x", format: "text", asset: "derivatives/x-1.md", status: "pending", notes: "", lineIndex: 1 };
  const imageRow: QueueRow = { id: "quote-card-1", platform: "quote-card", format: "image", asset: "images/quote-card-1.png", status: "pending", notes: "", lineIndex: 2 };
  const cardCaptionRow: QueueRow = { id: "quote-card-6-x", platform: "quote-card:x", format: "image", asset: "images/quote-card-6.png", status: "pending", notes: "", lineIndex: 3 };
  const alwaysFalse = () => false;
  assert.equal(approveBlockReason("/content/2026-06-16-foo", textRow, alwaysFalse), null);
  assert.equal(approveBlockReason("/content/2026-06-16-foo", imageRow, alwaysFalse), null);
  assert.equal(approveBlockReason("/content/2026-06-16-foo", cardCaptionRow, alwaysFalse), null);
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

test("isSafeRawPath only allows paths under data/inbox or data/processed", () => {
  assert.ok(isSafeRawPath("inbox/x/export.csv"));
  assert.ok(isSafeRawPath("processed/foo.json"));
  assert.ok(!isSafeRawPath("../../.env"));
  assert.ok(!isSafeRawPath("/etc/passwd"));
  assert.ok(!isSafeRawPath("config/voice.yaml")); // outside the two allowed roots
  assert.ok(!isSafeRawPath(""));
});
