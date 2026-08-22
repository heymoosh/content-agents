// Unit tests for src/review/page.ts's replyContextHtml() — the pure, DOM-free mirror of the
// inline "replying to" context line rowEl() renders for a "reply to mention" row (backend origin;
// carries reply_to_url/reply_to_text frontmatter alongside the normal kind:"text" shape). Kept
// DOM-free (no browser) so it's testable under plain node:test, per repo convention.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  replyContextHtml, imageMissingHtml, storyboardJobDone, formatElapsed, insightsTickerText, fmtDays, renderInsightsMeta,
  JOB_COLORS, STRIP_LINGER_MS, jobRoom, jobLandingSentence, jobRailLabel, jobClockText, jobsAhead, jobStepDots,
  dotColor, jobProgressPct, jobFooter, jobLogLine, jobOpenLabel, stripJobFor, stripRailLabel, stripClockText,
  stripFooter, teamRailHeader, teamRoomName, teamLiveRows, restingTeamRows, jobAnswerEcho, ANSWERED_FOOTER,
} from "./page.js";

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
// script body every backslash run must be even-length. The ONLY legitimate odd cases are the two
// escapes a template literal genuinely needs: \` (there is no other way to write a backtick) and
// \${ (suppressing a placeholder). A lone \$ is NOT exempt — it emits a bare $, which silently
// turns a literal-dollar regex into an end-of-input anchor, exactly the class of bug this catches.
test("client <script> source: every backslash is doubled, so regexes survive the template literal", () => {
  const src = readFileSync(new URL("./page.ts", import.meta.url), "utf8");
  const open = src.indexOf("\n<script>\n");
  const close = src.indexOf("\n</script>\n");
  assert.ok(open > 0 && close > open, "could not locate the client <script> body in page.ts");

  const before = src.slice(0, open).split("\n").length; // 1-indexed line of the <script> tag
  const offenders: string[] = [];
  src.slice(open, close).split("\n").forEach((line, i) => {
    for (const m of line.matchAll(/\\+/g)) {
      const rest = line.slice(m.index! + m[0].length);
      // Only \` and \${ are consumed on purpose. A lone \$ is a real defect, not an escape.
      const isTemplateEscape = rest.startsWith("`") || rest.startsWith("${");
      if (m[0].length % 2 === 1 && !isTemplateEscape) {
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
//
// These assert on the WHOLE surrounding expression, not just the regex. A bare `/\s+/g` check
// would be untethered — the emitted script contains more than one of those, so deleting the
// reply-context one entirely would still pass. Likewise a bare `class="ev-src"` check proves
// nothing: that substring survived intact even when the broken regex commented the line out.
test("client <script> output: the two regexes that shipped broken now emit correctly", () => {
  const html = renderPage({ repoRoot: process.cwd(), isDevWorktree: false });
  const script = html.slice(html.indexOf("<script>"), html.lastIndexOf("</script>"));

  // "replying to" preview: must collapse whitespace, not eat every letter "s".
  assert.ok(
    script.includes('replyText.replace(/\\s+/g," ").slice(0,220)'),
    "the reply-context snippet must emit its whitespace-collapse intact",
  );
  assert.ok(!script.includes("/s+/g"), "emitted /s+/g would replace runs of 's' with a space");

  // Outreach evidence link: the URL test now lives in evidenceSourceView (the mirror of
  // qualify.ts's isValidSourceUrl), and its verdict is what guards the <a>. Both halves are
  // asserted so a mangled backslash can't quietly turn the link into plain text again.
  assert.ok(
    script.includes('/^https?:\\/\\//i.test(t)'),
    "the evidence-source URL test must emit its slashes intact",
  );
  assert.ok(
    script.includes('sv.kind==="link" ? \'<a class="ev-src"'),
    "the evidence-link verdict must still be wired into the <a class=\"ev-src\"> tag",
  );
  assert.ok(!script.includes("/^https?:///i"), "emitted /^https?:///i turns the rest of the line into a comment");
});

// ── job UI surfaces (v5 §5) ──────────────────────────────────────────────────────────────────────
// The three surfaces (Studio working panel, room progress strip, Studio team rail) all read
// /api/jobs. These cover the pure mirrors; the inline client copies are kept in sync by hand.

function job(over = {}) {
  return {
    id: "j1", kind: "url", label: "The Gini essay", status: "running",
    error: null, elapsedMs: 3000, lastStdoutLine: null,
    steps: [], stepTotal: null, step: 0, failedAtStep: null, retryable: false,
    ask: null, answer: null, logPath: "/logs/j1.log", finishedAt: null,
    ...over,
  };
}

test("jobRoom: every job kind lands in exactly one room", () => {
  assert.equal(jobRoom("url"), "Content");
  assert.equal(jobRoom("video"), "Content");
  assert.equal(jobRoom("develop"), "Content");
  assert.equal(jobRoom("scout"), "Outreach");
  assert.equal(jobRoom("draft-follow-up"), "Outreach");
  assert.equal(jobRoom("strategy"), "Signals");
  assert.equal(jobRoom("insights"), "Signals");
  assert.equal(jobRoom("pull"), "Signals");
  assert.equal(jobRoom("charles-draft"), "Charles");
});

test("jobRailLabel: one label and color per status, and on done the rail is the room name", () => {
  assert.deepEqual(jobRailLabel(job({ status: "queued" })), { text: "Waiting its turn", color: JOB_COLORS.greyFg });
  assert.deepEqual(jobRailLabel(job({ status: "running" })), { text: "Working", color: JOB_COLORS.ai });
  assert.deepEqual(jobRailLabel(job({ status: "blocked" })), { text: "Needs you", color: JOB_COLORS.amber });
  assert.deepEqual(jobRailLabel(job({ status: "failed" })), { text: "Did not work", color: JOB_COLORS.red });
  assert.deepEqual(jobRailLabel(job({ status: "done" })), { text: "Content", color: JOB_COLORS.green });
  assert.deepEqual(jobRailLabel(job({ status: "done", kind: "scout" })), { text: "Outreach", color: JOB_COLORS.green });
});

test("jobClockText: every duration comes from elapsedMs, never a literal", () => {
  assert.equal(jobClockText(job({ status: "queued" }), 2), "2 ahead of it");
  assert.equal(jobClockText(job({ status: "running", elapsedMs: 3000 }), 0), "3s");
  assert.equal(jobClockText(job({ status: "blocked", elapsedMs: 74000 }), 0), "1m 14s");
  assert.equal(jobClockText(job({ status: "failed", elapsedMs: 3000 }), 0), "stopped after 3s");
  assert.equal(jobClockText(job({ status: "done", elapsedMs: 3000 }), 0), "took 3s");
});

test("jobClockText: a job that never started says so rather than showing a measured-looking zero", () => {
  assert.equal(jobClockText(job({ status: "running", elapsedMs: null }), 0), "not started");
  assert.equal(stripClockText(job({ status: "queued", elapsedMs: null })), "not started");
});

test("jobsAhead: counts the jobs queued before this one, plus the one running now", () => {
  const jobs = [
    job({ id: "a", status: "running" }),
    job({ id: "b", status: "queued" }),
    job({ id: "c", status: "queued" }),
  ];
  assert.equal(jobsAhead(jobs, jobs[1]), 1);
  assert.equal(jobsAhead(jobs, jobs[2]), 2);
});

test("jobStepDots: running splits the list into done, current, and pending", () => {
  const dots = jobStepDots(job({ status: "running", steps: ["Read it", "Cut it", "Checked it"], stepTotal: 3, step: 1 }));
  assert.deepEqual(dots.map((d) => d.state), ["done", "current", "pending"]);
  assert.equal(dotColor("done"), JOB_COLORS.green);
  assert.equal(dotColor("current"), JOB_COLORS.ai);
  assert.equal(dotColor("pending"), JOB_COLORS.grey);
});

test("jobStepDots: a failure paints the failing dot red, earlier green, later grey", () => {
  const dots = jobStepDots(job({
    status: "failed", steps: ["Read it", "Cut it", "Checked it"], stepTotal: 3, step: 1, failedAtStep: 1,
  }));
  assert.deepEqual(dots.map((d) => d.state), ["done", "failed", "pending"]);
  assert.equal(dotColor("failed"), JOB_COLORS.red);
});

test("jobStepDots: a failure with no step markers points at no step at all", () => {
  const dots = jobStepDots(job({ status: "failed", steps: ["Read it", "Cut it"], failedAtStep: null }));
  assert.deepEqual(dots.map((d) => d.state), ["pending", "pending"]);
});

test("jobStepDots: blocked marks the step it stopped on amber, and queued and done are uniform", () => {
  const blocked = jobStepDots(job({ status: "blocked", steps: ["Read it", "Cut it", "Checked it"], stepTotal: 3, step: 1 }));
  assert.deepEqual(blocked.map((d) => d.state), ["done", "blocked", "pending"]);
  assert.equal(dotColor("blocked"), JOB_COLORS.amber);
  // Blocked after every step completed: the ask sits on the last one, not off the end of the list.
  const atEnd = jobStepDots(job({ status: "blocked", steps: ["Read it", "Cut it"], stepTotal: 2, step: 2 }));
  assert.deepEqual(atEnd.map((d) => d.state), ["done", "blocked"]);
  assert.deepEqual(jobStepDots(job({ status: "queued", steps: ["a", "b"] })).map((d) => d.state), ["pending", "pending"]);
  assert.deepEqual(jobStepDots(job({ status: "done", steps: ["a", "b"], step: 2 })).map((d) => d.state), ["done", "done"]);
});

test("jobStepDots: no skill emits STEP markers yet, so an empty steps list renders no dots at all", () => {
  for (const status of ["queued", "running", "blocked", "failed", "done"]) {
    assert.deepEqual(jobStepDots(job({ status, steps: [] })), [], status + " must not invent a step list");
  }
});

test("jobStepDots: a steps array still growing toward stepTotal renders only what has arrived", () => {
  const dots = jobStepDots(job({ status: "running", steps: ["Read it"], stepTotal: 3, step: 1 }));
  assert.deepEqual(dots.map((d) => d.state), ["done"]);
});

test("jobProgressPct: fills step/stepTotal, and draws nothing when stepTotal was never measured", () => {
  assert.equal(jobProgressPct(job({ step: 1, stepTotal: 4 })), 25);
  assert.equal(jobProgressPct(job({ step: 3, stepTotal: 3 })), 100);
  assert.equal(jobProgressPct(job({ step: 0, stepTotal: null })), null);
});

test("jobLandingSentence: the authored sentence per room, each one stating what waits", () => {
  assert.equal(jobLandingSentence("Fiction"), "A scene draft, waiting on your read.");
  assert.equal(jobLandingSentence("Content"), "A cut, waiting on your yes.");
  assert.equal(jobLandingSentence("Outreach"), "A message, locked only when you say so.");
  assert.equal(jobLandingSentence("Signals"), "Filed. It writes nothing.");
  assert.equal(jobLandingSentence("Venture"), "An answer in the build conversation.");
  // Charles has no authored sentence in the design; inventing one would be composing UI copy.
  assert.equal(jobLandingSentence("Charles"), "");
});

test("jobLandingSentence: no landing sentence claims anything published", () => {
  for (const room of ["Fiction", "Content", "Outreach", "Signals", "Venture"] as const) {
    const s = jobLandingSentence(room).toLowerCase();
    assert.ok(!/publish|posted|sent to/.test(s), room + " landing sentence must not claim a send");
  }
});

test("jobFooter: the running footer is the heartbeat line, verbatim", () => {
  assert.equal(jobFooter(job({ status: "running", lastStdoutLine: "reading the source file" })), "reading the source file");
  assert.equal(jobFooter(job({ status: "running", lastStdoutLine: null })), "Real elapsed time, not an estimate.");
  assert.equal(jobFooter(job({ status: "queued" })), "One job runs at a time, so this starts when the one above finishes.");
  assert.equal(jobFooter(job({ status: "blocked" })), "It stops here until you answer. Nothing is written in the meantime.");
  assert.equal(jobFooter(job({ status: "failed" })), "It stopped where the red dot is. Nothing was written.");
  assert.equal(jobFooter(job({ status: "done" })), "A cut, waiting on your yes.");
});

test("an answered job stays blocked with its answer on record, so the footer stops asking", () => {
  // jobs.ts stamps the answer on the blocked job and queues a FRESH one carrying it; the original
  // never flips to done, so "It stops here until you answer" would go stale on screen.
  const answered = job({ status: "blocked", ask: { question: "Which one?", options: ["A", "B"] }, answer: "A" });
  assert.equal(jobFooter(answered), ANSWERED_FOOTER);
  assert.equal(stripFooter(answered), ANSWERED_FOOTER);
  assert.equal(jobAnswerEcho(answered), "You said: A");
  // Still waiting: the original ask copy holds.
  const waiting = job({ status: "blocked", ask: { question: "Which one?", options: ["A", "B"] }, answer: null });
  assert.equal(jobFooter(waiting), "It stops here until you answer. Nothing is written in the meantime.");
  assert.equal(jobAnswerEcho(waiting), "");
});

test("jobAnswerEcho: nothing to echo until Muxin has actually picked something", () => {
  assert.equal(jobAnswerEcho(job({ status: "done", answer: null })), "");
  assert.equal(jobAnswerEcho(job({ status: "done", answer: "Elias" })), "You said: Elias");
});

test("jobOpenLabel and jobLogLine name the room and the real log path", () => {
  assert.equal(jobOpenLabel(job({ status: "running", kind: "scout" })), "Watch it in Outreach");
  assert.equal(jobOpenLabel(job({ status: "done", kind: "scout" })), "Read it in Outreach");
  assert.equal(jobLogLine(job({ status: "done" })), "> wrote to /logs/j1.log");
  assert.equal(jobLogLine(job({ status: "failed" })), "> stopped at /logs/j1.log");
  assert.equal(jobLogLine(job({ status: "queued" })), "> waiting for a slot");
});

test("stripJobFor: a finished job lingers 9 seconds in its room, then clears", () => {
  const done = job({ status: "done", finishedAt: 1_000_000 });
  assert.equal(stripJobFor([done], "Content", 1_000_000 + 8999)?.id, "j1");
  assert.equal(stripJobFor([done], "Content", 1_000_000 + 9001), null);
  assert.equal(STRIP_LINGER_MS, 9000);
});

test("stripJobFor: blocked and failed jobs hold the strip past the linger window", () => {
  const late = 1_000_000 + 60_000;
  assert.equal(stripJobFor([job({ status: "blocked", finishedAt: 1_000_000 })], "Content", late)?.id, "j1");
  assert.equal(stripJobFor([job({ status: "failed", finishedAt: 1_000_000 })], "Content", late)?.id, "j1");
});

test("stripJobFor: a job only shows in the room it lands in", () => {
  const jobs = [job({ id: "a", kind: "scout" }), job({ id: "b", kind: "strategy" })];
  assert.equal(stripJobFor(jobs, "Outreach", 0)?.id, "a");
  assert.equal(stripJobFor(jobs, "Signals", 0)?.id, "b");
  assert.equal(stripJobFor(jobs, "Content", 0), null);
});

test("stripJobFor: a Fiction failure suppresses the strip, so only Fiction's own failure card shows", () => {
  // No job kind maps to Fiction yet (PR 6 adds the /story draft job), so the rule is exercised
  // through the injectable resolver. One failure card per screen, never two.
  const toFiction = () => "Fiction" as const;
  const failed = [job({ id: "f", status: "failed", finishedAt: 1_000_000 })];
  assert.equal(stripJobFor(failed, "Fiction", 1_000_000, toFiction), null);
  // The same failure in any other room still shows its strip.
  assert.equal(stripJobFor(failed, "Content", 1_000_000)?.id, "f");
  // A Fiction failure suppresses the strip for a healthy Fiction job on the same screen too.
  const mixed = [job({ id: "ok", status: "running" }), job({ id: "f", status: "failed" })];
  assert.equal(stripJobFor(mixed, "Fiction", 0, toFiction), null);
  // With no failure, Fiction shows its running job as normal.
  assert.equal(stripJobFor([job({ id: "ok", status: "running" })], "Fiction", 0, toFiction)?.id, "ok");
});

test("stripJobFor: Charles gets no strip at all", () => {
  assert.equal(stripJobFor([job({ kind: "charles-draft", status: "running" })], "Charles", 0), null);
});

test("strip copy: its own shorter authored strings, distinct from the Studio panel's", () => {
  assert.equal(stripRailLabel(job({ status: "running" })).text, "Working now");
  assert.equal(stripRailLabel(job({ status: "blocked" })).text, "Stopped, needs you");
  assert.equal(stripRailLabel(job({ status: "done" })).text, "Just finished");
  assert.equal(stripRailLabel(job({ status: "failed" })).text, "Did not work");
  assert.equal(stripFooter(job({ status: "queued" })), "One job runs at a time. This starts when the current one finishes.");
  assert.equal(stripFooter(job({ status: "done" })), "A cut, waiting on your yes.");
  assert.equal(stripClockText(job({ status: "done", elapsedMs: 3000 })), "took 3s");
});

test("teamRailHeader: blocked wins over running, and idle is the floor", () => {
  assert.equal(teamRailHeader([job({ status: "running" }), job({ status: "blocked" })]), "YOUR TEAM, WAITING ON YOU");
  assert.equal(teamRailHeader([job({ status: "running" }), job({ status: "queued" })]), "YOUR TEAM, WORKING");
  assert.equal(teamRailHeader([job({ status: "done" }), job({ status: "failed" })]), "YOUR TEAM, IDLE");
  assert.equal(teamRailHeader([]), "YOUR TEAM, IDLE");
});

test("teamLiveRows: one row per unfinished job, named for the room it lands in, urgent first", () => {
  const rows = teamLiveRows([
    job({ id: "a", kind: "url", status: "running", steps: ["Found the line"], stepTotal: 1, step: 0 }),
    job({ id: "b", kind: "scout", status: "blocked" }),
    job({ id: "c", kind: "strategy", status: "done" }),
  ]);
  assert.deepEqual(rows.map((r) => r.who), ["Connector", "Formatter"], "the blocked row sorts first");
  assert.equal(rows[0].what, "Stopped: needs your answer");
  assert.equal(rows[0].action, "ANSWER IT");
  assert.equal(rows[1].what, "found the line");
  assert.equal(rows[1].urgent, false);
});

test("teamLiveRows: with no step markers the row falls back to the job's own label, not invented copy", () => {
  const rows = teamLiveRows([job({ status: "running", steps: [], label: "The Gini essay" })]);
  assert.equal(rows[0].what, "The Gini essay");
});

test("teamRoomName: the design's cast, one name per room", () => {
  assert.equal(teamRoomName("Fiction"), "Co-writer");
  assert.equal(teamRoomName("Content"), "Formatter");
  assert.equal(teamRoomName("Outreach"), "Connector");
  assert.equal(teamRoomName("Signals"), "Reader");
  assert.equal(teamRoomName("Venture"), "Build");
});

test("restingTeamRows: no agent appears twice, and job-derived rows never restate a live one", () => {
  const live = teamLiveRows([job({ kind: "url", status: "running" })]); // → Formatter
  const resting = [
    { name: "Formatter", state: "idle", line: "idle, waiting on a cut" },
    { name: "Formatter", state: "working", line: "The Gini essay · 0m 03s" },
    { name: "Queue", state: "recent", line: "2 jobs waiting their turn" },
    { name: "Scout", state: "recent", line: "last swept 2026-08-18" },
    { name: "Publisher", state: "recent", line: "holding 2 approved posts for slots" },
  ];
  assert.deepEqual(restingTeamRows(resting, live).map((r) => r.name), ["Scout", "Publisher"]);
});

test("restingTeamRows: with nothing live the resting cast still shows, minus the job-derived rows", () => {
  const resting = [
    { name: "Scout", state: "recent", line: "last swept 2026-08-18" },
    { name: "Publisher", state: "idle", line: "no posts holding" },
    { name: "Formatter", state: "idle", line: "idle, waiting on a cut" },
  ];
  assert.deepEqual(restingTeamRows(resting, []).map((r) => r.name), ["Scout", "Publisher", "Formatter"]);
});

// ── Signals honesty guard ────────────────────────────────────────────────────────────────────────
// The v7 prototype ships "Rule added. Applies to next post." — a claim the backend cannot make:
// sending a recommendation to the backlog files a card, and nothing changes until that card ships.
// The repo already carries the honest copy. This is a guard so a future port never reintroduces the
// lie, and so the honest copy keeps naming where the card actually goes.
test("Signals: the emitted page never claims a filed recommendation already took effect", () => {
  const html = renderPage({ repoRoot: process.cwd(), isDevWorktree: false });
  assert.ok(!html.includes("Rule added"), 'the page must never say "Rule added"');
  assert.ok(!html.includes("Applies to next post"), 'the page must never say "Applies to next post"');
});

test("Signals: send-to-backlog copy still names the backlog and says nothing changes until it ships", () => {
  const html = renderPage({ repoRoot: process.cwd(), isDevWorktree: false });
  assert.ok(html.includes("Send to backlog"), "the action must still name the backlog");
  assert.ok(
    html.includes("Files a card; Claude Code works out where it applies and tracks whether it held. Nothing changes until that ships."),
    "the honest explanation of what filing does must stay",
  );
  assert.ok(html.includes("filed to the backlog"), "the confirmed state must still name the backlog");
});

// The three job surfaces must actually reach the browser, not just exist as testable mirrors.
test("client <script> output: the job working panel, room strips and team rail all emit", () => {
  const html = renderPage({ repoRoot: process.cwd(), isDevWorktree: false });
  for (const id of ["stripContent", "stripOutreach", "stripFiction", "stripSignals"]) {
    assert.ok(html.includes('id="' + id + '"'), id + " container must be in the markup");
  }
  assert.ok(!html.includes('id="stripCharles"'), "Charles gets no progress strip");
  const script = html.slice(html.indexOf("<script>"), html.lastIndexOf("</script>"));
  for (const fn of ["function renderJobs()", "function renderRoomStrips()", "function renderTeamRail()", "function stripJobFor(", "async function answerJob(", "async function retryJob("]) {
    assert.ok(script.includes(fn), fn + " must reach the browser");
  }
  assert.ok(script.includes('"/api/jobs/"+encodeURIComponent(id)+"/answer"'), "the ask box must post to the answer route");
  assert.ok(script.includes('"/api/jobs/"+encodeURIComponent(id)+"/retry"'), "retry must post to the retry route");
  // Every authored copy string from §5.1 and §5.3 ships verbatim.
  for (const copy of [
    "Waiting its turn", "Did not work", "Needs you", "Working now", "Stopped, needs you", "Just finished",
    "One job runs at a time, so this starts when the one above finishes.",
    "It stops here until you answer. Nothing is written in the meantime.",
    "It stopped where the red dot is. Nothing was written.",
    "A scene draft, waiting on your read.", "A cut, waiting on your yes.",
    "A message, locked only when you say so.", "Filed. It writes nothing.",
    "An answer in the build conversation.",
    "YOUR TEAM, WAITING ON YOU", "YOUR TEAM, WORKING", "YOUR TEAM, IDLE",
    "You answered. A fresh job is running it from the start.",
  ]) {
    assert.ok(script.includes(copy), "authored copy missing from the page: " + copy);
  }
});

test("job surface copy: no em dashes and no 'atomize' in the strings this PR adds", () => {
  const strings = [
    jobFooter(job({ status: "queued" })), jobFooter(job({ status: "blocked" })),
    jobFooter(job({ status: "failed" })), jobFooter(job({ status: "done" })),
    jobFooter(job({ status: "running", lastStdoutLine: null })), ANSWERED_FOOTER,
    stripFooter(job({ status: "queued" })), stripFooter(job({ status: "running", lastStdoutLine: null })),
    jobRailLabel(job({ status: "queued" })).text, jobRailLabel(job({ status: "failed" })).text,
    stripRailLabel(job({ status: "running" })).text, stripRailLabel(job({ status: "blocked" })).text,
    stripRailLabel(job({ status: "done" })).text,
    jobOpenLabel(job({ status: "done" })), jobLogLine(job({ status: "queued" })),
    teamRailHeader([]), teamRailHeader([job({ status: "blocked" })]),
    ...(["Fiction", "Content", "Outreach", "Signals", "Venture", "Charles"] as const).map((r) => jobLandingSentence(r)),
    ...(["Fiction", "Content", "Outreach", "Signals", "Venture", "Charles"] as const).map((r) => teamRoomName(r)),
    ...teamLiveRows([job({ status: "failed" }), job({ status: "blocked" }), job({ status: "queued" })]).flatMap((r) => [r.what, r.action]),
  ];
  for (const s of strings) {
    assert.ok(!s.includes("—"), "em dash in job surface copy: " + s);
    assert.ok(!/atomize/i.test(s), '"atomize" must never appear in UI copy: ' + s);
  }
});

// ── Outreach room: triage + thread (design v7 §3, static half) ──

import {
  outreachSegment, OUTREACH_SEGMENTS, groupLeadsBySegment, lastPitchedLabel, threadSegLabel,
  matchmakerRead, contactsLine, isEvidenceSourceValid, evidenceSourceView, NO_SOURCE_RECORDED,
  outreachSendState, outreachSendNote, outreachSendBadge,
} from "./page.js";
import type { OutreachLeadView } from "./page.js";

const lead = (over: Partial<OutreachLeadView> = {}): OutreachLeadView => ({ dir: "outreach/leads/client-acme", ...over });

test("outreachSegment: four values, because content-example leads are real rows on the desk", () => {
  assert.equal(outreachSegment(lead({ kind: "platform" })), "platform");
  assert.equal(outreachSegment(lead({ kind: "client", source: "jsa" })), "org-role");
  assert.equal(outreachSegment(lead({ kind: "client", source: "scout" })), "org-mission");
  assert.equal(outreachSegment(lead({ kind: "content-example" })), "content-example");
});

test("outreachSegment: nothing writes fm.segment today, so the kind/source read is the real driver", () => {
  // A lead whose frontmatter DID carry a segment still wins, but the fallback is what actually runs.
  assert.equal(outreachSegment(lead({ segment: "org-role", kind: "platform" })), "org-role");
  assert.equal(outreachSegment(lead({ segment: "", kind: "platform" })), "platform");
});

test("groupLeadsBySegment: four groups in the design's order, empty ones dropped", () => {
  const leads = [
    lead({ dir: "a", kind: "content-example" }),
    lead({ dir: "b", kind: "client", source: "jsa" }),
    lead({ dir: "c", kind: "platform" }),
    lead({ dir: "d", kind: "client", source: "scout" }),
    lead({ dir: "e", kind: "platform" }),
  ];
  const groups = groupLeadsBySegment(leads);
  assert.deepEqual(groups.map((g) => g.name), [
    "PLATFORMS", "ORGANIZATIONS · MISSION FIT", "ORGANIZATIONS · OPEN ROLES", "EXAMPLES",
  ]);
  assert.deepEqual(groups[0].leads.map((l) => l.dir), ["c", "e"]);
  assert.deepEqual(groups[3].leads.map((l) => l.dir), ["a"]);
  assert.equal(groupLeadsBySegment([lead({ kind: "platform" })]).length, 1, "empty groups do not render");
  assert.equal(groupLeadsBySegment([]).length, 0);
});

test("groupLeadsBySegment: an Example lead is never dropped on the floor", () => {
  const groups = groupLeadsBySegment([lead({ dir: "x", kind: "content-example" })]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, "content-example");
  assert.equal(groups[0].note, OUTREACH_SEGMENTS[3].note, "the Example group keeps the line this page already shipped");
});

test("groupLeadsBySegment: every lead handed in lands in exactly one group", () => {
  const leads = [
    lead({ dir: "a", kind: "platform" }), lead({ dir: "b", kind: "client", source: "jsa" }),
    lead({ dir: "c", kind: "client" }), lead({ dir: "d", kind: "content-example" }),
    lead({ dir: "e", kind: undefined }),
  ];
  const seen = groupLeadsBySegment(leads).flatMap((g) => g.leads.map((l) => l.dir));
  assert.equal(seen.length, leads.length);
  assert.equal(new Set(seen).size, leads.length);
});

test("lastPitchedLabel: a real tracker timestamp, or the plain truth that there is none", () => {
  assert.equal(lastPitchedLabel("2026-08-06T14:22:00.000Z"), "pitched 2026-08-06, by hand");
  assert.equal(lastPitchedLabel(null), "never pitched");
  assert.equal(lastPitchedLabel(undefined), "never pitched");
  assert.equal(lastPitchedLabel("   "), "never pitched");
});

test("threadSegLabel: the design's three labels, plus the fourth the repo actually needs", () => {
  assert.equal(threadSegLabel("platform"), "PLATFORM · SELECTED");
  assert.equal(threadSegLabel("org-mission"), "MISSION FIT · SELECTED");
  assert.equal(threadSegLabel("org-role"), "OPEN ROLE · SELECTED");
  assert.equal(threadSegLabel("content-example"), "EXAMPLE · SELECTED");
});

test("matchmakerRead: the three-way grid when the matchmaker pass has run", () => {
  const r = matchmakerRead(lead({ whyThem: "they ship in public", whyMe: "you have the receipts", whyMutual: "one audience, two halves" }));
  assert.equal(r.legacy, false);
  assert.deepEqual(r.rows.map((x) => x.k), ["Why them, for you", "Why you, for them", "Why the two of you"]);
  assert.equal(r.headline, "one audience, two halves");
});

test("matchmakerRead: a partial matchmaker read renders only the fields that exist", () => {
  const r = matchmakerRead(lead({ whyThem: "they ship in public" }));
  assert.equal(r.legacy, false);
  assert.deepEqual(r.rows.map((x) => x.k), ["Why them, for you"]);
  assert.equal(r.headline, "they ship in public");
});

test("matchmakerRead: a legacy lead falls back to pitchAngle and is FLAGGED as legacy, never passed off as the matchmaker read", () => {
  const r = matchmakerRead(lead({ pitchAngle: "guest essay on hiring signals" }));
  assert.equal(r.legacy, true);
  assert.equal(r.headline, "guest essay on hiring signals");
  assert.deepEqual(r.rows, [], "a legacy lead has no three-way grid to show");
});

test("matchmakerRead: nothing recorded at all says so rather than showing an empty headline", () => {
  const r = matchmakerRead(lead({}));
  assert.equal(r.legacy, true);
  assert.equal(r.headline, "(no read recorded yet)");
});

test("contactsLine: zero contacts is the plain zero case, not a special flag", () => {
  assert.equal(contactsLine([]), "No named contact yet. Add one, or write to the organization.");
  assert.equal(contactsLine(undefined), "No named contact yet. Add one, or write to the organization.");
});

test("contactsLine: one contact names them, without doubling a period the name already ends on", () => {
  assert.equal(contactsLine([{ name: "Rae Okafor", role: "editor" }]), "You are writing to Rae Okafor.");
  assert.equal(contactsLine([{ name: "Annika L.", role: "editor" }]), "You are writing to Annika L.");
});

test("contactsLine: several contacts say each one runs its own clock", () => {
  const line = contactsLine([{ name: "Annika L." }, { name: "James H." }, { name: "Rae O." }]);
  assert.match(line, /^3 people here\./);
  assert.match(line, /own follow-up clock/, "several people means several clocks, which is what tracker.ts keys on");
});

test("isEvidenceSourceValid: a real https URL with a dotted host is valid", () => {
  assert.equal(isEvidenceSourceValid("https://posthog.com/blog/handbook"), true);
  assert.equal(isEvidenceSourceValid("http://example.org/a"), true);
});

test("isEvidenceSourceValid: a vault: path is valid, mirroring qualify.ts", () => {
  assert.equal(isEvidenceSourceValid("vault:People/Annika L.md"), true);
  assert.equal(isEvidenceSourceValid("vault:"), false);
  assert.equal(isEvidenceSourceValid("vault:n/a"), false);
});

test("isEvidenceSourceValid: placeholders and half-typed sources are not sources", () => {
  for (const bad of ["", "  ", "(none)", "none", "N/A", "tbd", "unknown", "posthog.com", "https://localhost", "not a url"]) {
    assert.equal(isEvidenceSourceValid(bad), false, "should be rejected: " + JSON.stringify(bad));
  }
  assert.equal(isEvidenceSourceValid(undefined), false);
});

test("evidenceSourceView: a valid URL is clickable, a vault path is text, anything else says it has no source", () => {
  assert.deepEqual(evidenceSourceView("https://posthog.com/blog"), { kind: "link", text: "https://posthog.com/blog" });
  assert.deepEqual(evidenceSourceView("vault:People/Annika L.md"), { kind: "text", text: "vault:People/Annika L.md" });
  assert.deepEqual(evidenceSourceView("(none)"), { kind: "none", text: NO_SOURCE_RECORDED });
  assert.deepEqual(evidenceSourceView(undefined), { kind: "none", text: NO_SOURCE_RECORDED });
});

test("evidenceSourceView: never invents a date, because EvidenceItem carries no timestamp", () => {
  for (const src of ["https://posthog.com/blog", "vault:People/Annika L.md", "(none)", "", "tbd"]) {
    const v = evidenceSourceView(src);
    assert.ok(!/observed/i.test(v.text), "an evidence source must never read as an observation date: " + v.text);
    assert.ok(!/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/.test(v.text));
  }
});

test("outreachSendState: locked and sent are two different states and never collapse into one", () => {
  assert.equal(outreachSendState(null, null), "none");
  assert.equal(outreachSendState({ status: "draft" }, null), "draft");
  assert.equal(outreachSendState({ status: "approved" }, null), "draft");
  assert.equal(outreachSendState({ status: "locked" }, null), "locked");
  assert.equal(outreachSendState({ status: "locked" }, "2026-08-06T00:00:00.000Z"), "sent");
});

test("outreachSendState: a tracker touch on an UNLOCKED message still reads as a draft, never as sent", () => {
  assert.equal(outreachSendState({ status: "draft" }, "2026-08-06T00:00:00.000Z"), "draft");
});

test("outreachSendNote: locking and sending carry the two authored notes, verbatim", () => {
  assert.equal(outreachSendNote("draft"), "Locking readies it. You send it by hand, and nothing here can send it for you.");
  assert.equal(outreachSendNote("locked"), "Paste it into your mail client and send it there. Tell me once it has gone.");
  assert.equal(outreachSendNote("none"), "");
});

test("outreachSendBadge: a locked message says it is not sent, and a sent one says who sent it", () => {
  assert.equal(outreachSendBadge("locked"), "LOCKED · NOT EDITABLE, NOT SENT");
  assert.equal(outreachSendBadge("sent"), "LOCKED · SENT BY HAND");
  assert.equal(outreachSendBadge("draft"), "");
  assert.ok(!outreachSendBadge("locked").includes("SENT BY HAND"), "locked must never read as sent");
});

test("outreach copy: no em dashes and no 'atomize' in the strings this PR adds", () => {
  const strings = [
    ...OUTREACH_SEGMENTS.flatMap((s) => [s.name, s.note]),
    lastPitchedLabel(null), lastPitchedLabel("2026-08-06T00:00:00.000Z"),
    ...["platform", "org-mission", "org-role", "content-example"].map(threadSegLabel),
    contactsLine([]), contactsLine([{ name: "Annika L." }]), contactsLine([{ name: "A" }, { name: "B" }]),
    matchmakerRead(lead({})).headline,
    ...(["none", "draft", "locked", "sent"] as const).map(outreachSendNote),
    ...(["none", "draft", "locked", "sent"] as const).map(outreachSendBadge),
    NO_SOURCE_RECORDED,
  ];
  for (const s of strings) {
    assert.ok(!s.includes("—"), "em dash in outreach copy: " + s);
    assert.ok(!/atomize/i.test(s), '"atomize" must never appear in UI copy: ' + s);
  }
});

test("outreach room markup: the triage rail, the thread, and both send steps are on the page", () => {
  const html = renderPage({ repoRoot, isDevWorktree: false });
  for (const copy of [
    "WHO IS IN FRONT OF YOU, GROUPED BY WHY · PICK ONE TO DRAFT TO",
    "Where the audience already is. Bring the work, not a pitch.",
    "They do the thing you write about. Bring the overlap.",
    "They are hiring for what you already built. Bring the receipt.",
    "← Back to queue",
    "Lock this message",
    "Copy to clipboard",
    "Mark as manually sent",
    "Locking readies it. You send it by hand, and nothing here can send it for you.",
    "Paste it into your mail client and send it there. Tell me once it has gone.",
    "no source recorded",
    "never pitched",
  ]) {
    assert.ok(html.includes(copy), "authored outreach copy missing from the page: " + copy);
  }
});

test("outreach room markup: the Leads | Follow-ups subnav and the #349 progress strip both survive", () => {
  const html = renderPage({ repoRoot, isDevWorktree: false });
  assert.ok(html.includes('data-sub="leads"') && html.includes('data-sub="followups"'), "the subnav must keep working");
  assert.equal(html.split('id="stripOutreach"').length - 1, 1, "exactly one room progress strip, neither removed nor duplicated");
});

test("outreach evidence markup: no fabricated observation date anywhere on the page", () => {
  const html = renderPage({ repoRoot, isDevWorktree: false });
  assert.ok(!/observed /.test(html), "the prototype's 'observed Aug 6' fallback has no data behind it and must not ship");
});
