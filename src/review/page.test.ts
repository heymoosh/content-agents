// Unit tests for src/review/page.ts's replyContextHtml() — the pure, DOM-free mirror of the
// inline "replying to" context line rowEl() renders for a "reply to mention" row (backend origin;
// carries reply_to_url/reply_to_text frontmatter alongside the normal kind:"text" shape). Kept
// DOM-free (no browser) so it's testable under plain node:test, per repo convention.

import { test } from "node:test";
import assert from "node:assert/strict";
import { replyContextHtml, imageMissingHtml, storyboardJobDone, formatElapsed, insightsTickerText } from "./page.js";

test("replyContextHtml: a 'reply to mention' row renders its reply_to_text inline", () => {
  const row = {
    origin: "reply to mention" as const,
    replyToText: "hey, loved your take on atomization — do you think this scales to video too?",
  };
  const html = replyContextHtml(row);
  assert.ok(html.includes(row.replyToText), "rendered output must contain the reply_to_text snippet");
  assert.ok(html.includes("reply-context"), "should use the reply-context style, consistent with the page's other inline context lines");
});

test("replyContextHtml: falls back to the raw snake_case frontmatter key if row-enrichment surfaces it un-cased", () => {
  const row = { origin: "reply to mention" as const, reply_to_text: "great point about extraction-first drafting" };
  const html = replyContextHtml(row);
  assert.ok(html.includes(row.reply_to_text));
});

test("replyContextHtml: truncates a long reply sensibly, matching this file's other long-text truncation (220 chars, whitespace-collapsed)", () => {
  const long = "word ".repeat(100).trim(); // far past 220 chars
  const row = { origin: "reply to mention" as const, replyToText: long };
  const html = replyContextHtml(row);
  const expected = long.replace(/\s+/g, " ").slice(0, 220);
  assert.ok(html.includes(expected));
  assert.ok(!html.includes(long), "should not render the full untruncated text");
});

test("replyContextHtml: renders nothing for a normal text row with no reply_to_text", () => {
  assert.equal(replyContextHtml({ origin: "from GUI queue" }), "");
  assert.equal(replyContextHtml({}), "");
});

test("replyContextHtml: renders nothing when reply_to_text is present but origin isn't 'reply to mention'", () => {
  assert.equal(replyContextHtml({ origin: "from /cycle", replyToText: "should not show" }), "");
});

// Unit tests for imageMissingHtml() — the pure, DOM-free mirror of the inline missing-image
// placeholder rowEl() renders for a QUOTE-CARD (kind:"image") row whose PNG hasn't been rendered
// yet. Before card 4c3dd6fc, such a row (body present, assetUrl unset) fell through to plain-text
// rendering with no missing-image cue at all — indistinguishable from a normal card.

test("imageMissingHtml: an image row with no assetUrl renders the missing-image placeholder", () => {
  const html = imageMissingHtml({ kind: "image" });
  assert.ok(html.includes("image not rendered yet"));
  assert.ok(html.includes("src"), "should reuse the existing .src placeholder styling");
});

test("imageMissingHtml: an image row WITH an assetUrl renders nothing (the real <img> tag covers it)", () => {
  assert.equal(imageMissingHtml({ kind: "image", assetUrl: "/assets/quote-card-1.png" }), "");
});

test("imageMissingHtml: a non-image row renders nothing", () => {
  assert.equal(imageMissingHtml({ kind: "text" }), "");
  assert.equal(imageMissingHtml({ kind: "video" }), "");
  assert.equal(imageMissingHtml({}), "");
});

// Unit tests for storyboardJobDone() — the pure, DOM-free mirror of the inline logic loadJobs()
// uses to clear the storyboardSlugs in-flight registry once a piece's real "Generate storyboard"
// video job actually resolves. Before card fbfea28b, the in-flight indicator (row.storyboardQueued)
// had no completion signal of its own at all — it only cleared on the NEXT unrelated full-queue
// refresh, and any background job poll in between wiped it prematurely.

test("storyboardJobDone: no jobs for the slug at all is not done (queue hasn't caught up yet)", () => {
  assert.equal(storyboardJobDone([], "my-slug"), false);
});

test("storyboardJobDone: a running video job for the slug is not done", () => {
  const jobs = [{ kind: "video", slugs: ["my-slug"], status: "running" }];
  assert.equal(storyboardJobDone(jobs, "my-slug"), false);
});

test("storyboardJobDone: a queued video job for the slug is not done", () => {
  const jobs = [{ kind: "video", slugs: ["my-slug"], status: "queued" }];
  assert.equal(storyboardJobDone(jobs, "my-slug"), false);
});

test("storyboardJobDone: a done video job for the slug is done", () => {
  const jobs = [{ kind: "video", slugs: ["my-slug"], status: "done" }];
  assert.equal(storyboardJobDone(jobs, "my-slug"), true);
});

test("storyboardJobDone: a failed video job for the slug is done (terminal, not a stuck spinner)", () => {
  const jobs = [{ kind: "video", slugs: ["my-slug"], status: "failed" }];
  assert.equal(storyboardJobDone(jobs, "my-slug"), true);
});

test("storyboardJobDone: one done + one still-running video job for the same slug is NOT done", () => {
  const jobs = [
    { kind: "video", slugs: ["my-slug"], status: "done" },
    { kind: "video", slugs: ["my-slug"], status: "running" },
  ];
  assert.equal(storyboardJobDone(jobs, "my-slug"), false);
});

test("storyboardJobDone: a done job for a DIFFERENT slug does not mark this slug done", () => {
  const jobs = [{ kind: "video", slugs: ["other-slug"], status: "done" }];
  assert.equal(storyboardJobDone(jobs, "my-slug"), false);
});

test("storyboardJobDone: a done job of a non-video kind for the slug is ignored", () => {
  const jobs = [{ kind: "text", slugs: ["my-slug"], status: "done" }];
  assert.equal(storyboardJobDone(jobs, "my-slug"), false);
});

// formatElapsed / insightsTickerText — card a14693da: the insights follow-up "thinking" indicator
// used to show a fixed "~10-60s" ETA while the real server-side bound is 180s. Replaced with a
// live elapsed-time count so a long wait reads as "still working," not "frozen."
test("formatElapsed: under a minute renders as whole seconds", () => {
  assert.equal(formatElapsed(0), "0s");
  assert.equal(formatElapsed(42_000), "42s");
  assert.equal(formatElapsed(59_499), "59s");
});

test("formatElapsed: a minute or more renders as Xm Ys", () => {
  assert.equal(formatElapsed(60_000), "1m 0s");
  assert.equal(formatElapsed(90_000), "1m 30s");
  assert.equal(formatElapsed(185_000), "3m 5s");
});

test("insightsTickerText: no longer claims the old misleading fixed ETA", () => {
  const html = insightsTickerText(45_000);
  assert.ok(!html.includes("10-60s"), "must not still show the old undersold ETA");
});

test("insightsTickerText: renders the live elapsed count so the wait reads as ongoing, not stuck", () => {
  const html = insightsTickerText(45_000);
  assert.ok(html.includes("45s elapsed"));
  assert.ok(html.includes("still looking into it") || html.includes("looking into it"));
});

test("insightsTickerText: elapsed count keeps ticking past a minute, matching the real ~180s bound", () => {
  const html = insightsTickerText(125_000);
  assert.ok(html.includes("2m 5s elapsed"));
});
