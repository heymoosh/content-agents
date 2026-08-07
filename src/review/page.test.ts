// Unit tests for src/review/page.ts's replyContextHtml() — the pure, DOM-free mirror of the
// inline "replying to" context line rowEl() renders for a "reply to mention" row (backend origin;
// carries reply_to_url/reply_to_text frontmatter alongside the normal kind:"text" shape). Kept
// DOM-free (no browser) so it's testable under plain node:test, per repo convention.

import { test } from "node:test";
import assert from "node:assert/strict";
import { replyContextHtml, imageMissingHtml, storyboardJobDone, formatElapsed, insightsTickerText, fmtDays, renderInsightsMeta } from "./page.js";

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

// renderInsightsMeta / fmtDays — card (Muxin, 2026-07-16): "Generate insights" already ran live
// reports; the fix surfaces a deterministic freshness stamp + a dated brief LINK (never the brief's
// text — mdToHtml has no markdown-link syntax) + an untagged-post warning, built from the server's
// numbers so it can't be silently dropped by Claude's synthesis pass.

test("fmtDays: singular for 1, plural otherwise", () => {
  assert.equal(fmtDays(0), "0 days");
  assert.equal(fmtDays(1), "1 day");
  assert.equal(fmtDays(22), "22 days");
});

test("renderInsightsMeta: renders freshness, a dated brief link, and an untagged warning together", () => {
  const html = renderInsightsMeta({
    freshness: { date: "2026-07-12", ageDays: 4 },
    brief: { path: "briefs/2026-06-24-strategy-brief.md", date: "2026-06-24", ageDays: 22 },
    untagged: 160,
  });
  assert.match(html, /Data current as of <b>2026-07-12<\/b> \(4 days ago\)/);
  assert.match(html, /<a href="#stratBriefPanel">2026-06-24 \(22 days old\)<\/a>/);
  assert.match(html, /class="warn">⚠ 160 untagged posts<\/span>/);
});

test("renderInsightsMeta: omits the untagged warning entirely when the count is 0", () => {
  const html = renderInsightsMeta({ freshness: { date: "2026-07-16", ageDays: 0 }, brief: null, untagged: 0 });
  assert.ok(!html.includes("untagged"));
});

test("renderInsightsMeta: falls back to the brief's path when it has no parseable date", () => {
  const html = renderInsightsMeta({ brief: { path: "briefs/weird-name.md", date: null, ageDays: null } });
  assert.match(html, /<a href="#stratBriefPanel">briefs\/weird-name\.md<\/a>/);
});

test("renderInsightsMeta: empty string when there's nothing to show (0 posts / no brief / no data)", () => {
  assert.equal(renderInsightsMeta({}), "");
  assert.equal(renderInsightsMeta({ freshness: null, brief: null, untagged: 0 }), "");
});

test("renderInsightsMeta: singular '1 untagged post', not 'posts'", () => {
  const html = renderInsightsMeta({ untagged: 1 });
  assert.match(html, /⚠ 1 untagged post</); // no trailing 's' before the closing tag
});

// ── Wiring guards (added after the 2026-07-19 click-through audit) ─────────────────────────────
// Two failure classes bit or nearly bit this page before: an emitted <script> that doesn't parse
// (the #244 regression — a stray backtick/apostrophe in the template literal), and a client
// fetch path with no matching serve.ts route (a dead button). Both become test failures here.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { renderPage } from "./page.js";
import { repoRoot } from "../db/db.js";

const HERE = dirname(fileURLToPath(import.meta.url));

function emittedScripts(): string[] {
  const html = renderPage({ repoRoot, isDevWorktree: false });
  const scripts: string[] = [];
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) scripts.push(m[1]);
  return scripts;
}

test("wiring guard: every emitted <script> block parses as JavaScript", () => {
  const scripts = emittedScripts();
  assert.ok(scripts.length > 0, "renderPage should emit at least one <script> block");
  for (const body of scripts) {
    // parse-only: new Function throws SyntaxError on a broken script without running it
    assert.doesNotThrow(() => new Function(body), "emitted client script must parse");
  }
});

test("wiring guard: every client /api path has a serve.ts route, and every route has a caller", () => {
  const script = emittedScripts().join("\n");
  const serveSrc = readFileSync(join(HERE, "serve.ts"), "utf8");

  const routes = new Set<string>();
  for (const m of serveSrc.matchAll(/url\.pathname === "(\/api\/[^"]+)"/g)) routes.add(m[1]);
  // the one regex route: GET /api/jobs/<id>/log
  const routePrefixes = /\/api\\\/jobs\\\//.test(serveSrc) || serveSrc.includes("^\\/api\\/jobs\\/") ? ["/api/jobs/"] : [];

  // client refs: "…/api/foo" (exact) or "…/api/foo/" + concat (prefix). Query strings stop the match.
  const refs = new Set<string>();
  for (const m of script.matchAll(/["'](\/api\/[a-zA-Z0-9/_-]*)/g)) refs.add(m[1]);
  assert.ok(refs.size >= 40, `expected the client to reference many routes, got ${refs.size}`);

  // forward: every client ref resolves to a route
  for (const ref of refs) {
    const ok = ref.endsWith("/")
      ? [...routes].some((r) => r.startsWith(ref)) || routePrefixes.some((p) => p.startsWith(ref) || ref.startsWith(p))
      : routes.has(ref) || routePrefixes.some((p) => ref.startsWith(p));
    assert.ok(ok, `client calls ${ref} but serve.ts has no matching route (dead button)`);
  }

  // reverse: every route is reachable from the page (exact ref, or via a "/api/foo/"+x concat)
  for (const route of routes) {
    const ok = refs.has(route) || [...refs].some((ref) => ref.endsWith("/") && route.startsWith(ref));
    assert.ok(ok, `serve.ts route ${route} has no caller in the page (orphan route)`);
  }
});

// ---------------------------------------------------------------------------
// Escaping guard for the client <script>.
//
// The whole client script is authored inside a TypeScript template literal, so the template
// swallows one level of backslash before the browser ever sees the code. A regex written there
// needs DOUBLED backslashes: `/\\s+/g` in the source is what emits `/\s+/g` to the browser.
// Two real bugs shipped from getting this wrong, and neither was caught by the existing
// "every emitted <script> parses" guard, because both mangled forms are still valid JavaScript:
//
//   /\s+/g        emitted as  /s+/g            — replaced runs of the letter "s" with a space
//   /^https?:\/\//i  emitted as  /^https?:///i  — a regex, then // starting a LINE COMMENT, which
//                                                 silently ate the rest of the ternary
//
// So this asserts the invariant directly at the source level, where it is unambiguous: inside the
// script body every backslash run must be even-length. The only legitimate odd cases are the
// template literal's own escapes, \` and \$, which are consumed on purpose.
test("client <script> source: every backslash is doubled, so regexes survive the template literal", () => {
  const src = readFileSync(new URL("./page.ts", import.meta.url), "utf8");
  const open = src.indexOf("\n<script>\n");
  const close = src.indexOf("\n</script>\n");
  assert.ok(open > 0 && close > open, "could not locate the client <script> body in page.ts");

  const before = src.slice(0, open).split("\n").length; // 1-indexed line of the <script> tag
  const offenders: string[] = [];
  src.slice(open, close).split("\n").forEach((line, i) => {
    for (const m of line.matchAll(/\\+/g)) {
      const next = line[m.index! + m[0].length];
      // \` and \$ are the template literal's own escapes and are meant to be consumed.
      if (m[0].length % 2 === 1 && next !== "`" && next !== "$") {
        offenders.push(`page.ts:${before + i}: ${line.trim().slice(0, 120)}`);
        return;
      }
    }
  });
  assert.deepEqual(
    offenders,
    [],
    "un-doubled backslash inside the client <script> — the template literal will eat it before the " +
      "browser sees it. Double it (\\\\s, \\\\/):\n" + offenders.join("\n"),
  );
});

// Regression cover for the two specific defects above, asserting on what the BROWSER receives
// rather than on the source, so a future refactor of how the page is assembled still gets caught.
test("client <script> output: the two regexes that shipped broken now emit correctly", () => {
  const html = renderPage({ repoRoot: process.cwd(), isDevWorktree: false });
  const script = html.slice(html.indexOf("<script>"), html.lastIndexOf("</script>"));

  // "replying to" preview: must collapse whitespace, not eat every letter "s".
  assert.ok(script.includes("/\\s+/g"), "the reply-context snippet must emit /\\s+/g");
  assert.ok(!script.includes("/s+/g"), "emitted /s+/g would replace runs of 's' with a space");

  // Outreach evidence link: must test the URL, not comment the ternary out.
  assert.ok(script.includes("/^https?:\\/\\//i"), "the evidence-link test must emit /^https?:\\/\\//i");
  assert.ok(!script.includes("/^https?:///i"), "emitted /^https?:///i turns the rest of the line into a comment");
  assert.ok(script.includes('class="ev-src"'), "the evidence source link must survive into the page");
});
