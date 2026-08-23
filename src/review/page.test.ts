// Unit tests for src/review/page.ts's replyContextHtml() — the pure, DOM-free mirror of the
// inline "replying to" context line rowEl() renders for a "reply to mention" row (backend origin;
// carries reply_to_url/reply_to_text frontmatter alongside the normal kind:"text" shape). Kept
// DOM-free (no browser) so it's testable under plain node:test, per repo convention.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  replyContextHtml, imageMissingHtml, storyboardJobDone, formatElapsed, fmtDays, renderInsightsMeta,
  JOB_COLORS, STRIP_LINGER_MS, jobRoom, jobLandingSentence, jobRailLabel, jobClockText, jobsAhead, jobStepDots,
  dotColor, jobProgressPct, jobFooter, jobLogLine, jobOpenLabel, stripJobFor, stripRailLabel, stripClockText,
  stripFooter, teamRailHeader, teamRoomName, teamLiveRows, restingTeamRows, jobAnswerEcho, ANSWERED_FOOTER,
  jobAwaitingAnswer, jobSettled, jobsPollDue, enqueuesJob, JOB_ENQUEUE_ROUTES, JOBS_POLL_MS, fictionStatusWord, fictionStatusTone, fictionHasScene, fictionCheckRow, fictionCanonStamp, fictionSceneParagraphs, unfixableLine,
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

// formatElapsed, the ONE duration formatter every job surface goes through. Card a14693da once
// used it for a click-local insights ticker; that ticker is gone (see the "one clock per screen"
// tests further down), so the only caller left is jobElapsedText, whose input is a measured
// elapsedMs.
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
import { VENTURE_READ_PATHS } from "./venture-reads.js";

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

// Read-only routes whose backend half landed before the screen that calls them. Each entry is a
// temporary exemption from the reverse ("orphan route") check below.
//
// The exemption is SELF-DELETING, not a comment asking nicely. The block right below the reverse
// check asserts, for every entry, that its route (a) still exists in serve.ts and (b) still has NO
// caller in the page. So the moment someone wires the fetch into page.ts, the entry itself goes
// red and the only way back to green is deleting it. A comment is not a mechanism; this is. It
// catches the other rot direction too — an entry naming a route that has since been removed.
//
// To add one: append the path and a comment in this format saying what it is and why its UI is
// not here yet. Keep the list at or near zero.
const PENDING_UI_ROUTES = new Set([
  // The Content room's "decide the treatment" read layer (fit label per channel, that channel's
  // own reuse window, next free slot). Backend shipped separately from the page.ts surface.
  "/api/content/treatment",
]);

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
  const hasCaller = (route: string): boolean =>
    refs.has(route) || [...refs].some((ref) => ref.endsWith("/") && route.startsWith(ref));
  for (const route of routes) {
    if (PENDING_UI_ROUTES.has(route)) continue;
    assert.ok(hasCaller(route), `serve.ts route ${route} has no caller in the page (orphan route)`);
  }

  // the exemptions expire on their own: an entry survives only while its route still exists AND
  // still has no caller, so wiring the UI turns the entry itself red instead of leaving a
  // permanent hole in the reverse check above
  for (const route of PENDING_UI_ROUTES) {
    assert.ok(routes.has(route), `PENDING_UI_ROUTES lists ${route}, which is no longer a serve.ts route — delete the entry`);
    assert.ok(
      !hasCaller(route),
      `${route} now has a caller in the page — delete its PENDING_UI_ROUTES entry, the exemption has done its job`
    );
  }
});

// ---------------------------------------------------------------------------
// The same self-deleting exemption as PENDING_UI_ROUTES above, for the Venture room's read routes.
//
// Two lists rather than one, for a structural reason: the guard above discovers routes by scanning
// serve.ts for `url.pathname === "..."` literals, and the nine venture reads are not written that
// way — they are dispatched by handleVentureRead() and carry a :slug path parameter, so the
// extractor cannot see them and `routes.has(...)` would reject them on sight. This block gets its
// route list from the module itself (VENTURE_READ_PATHS), which is a stronger source than a regex
// over source text: a route deleted there disappears from this check automatically.
//
// The mechanism is identical in spirit and identical in the property that matters — each entry
// asserts its route is STILL uncalled, so wiring the room turns the entry red and the only way
// back to green is deleting it. Keep the list at or near zero.
const PENDING_UI_VENTURE_READS: { route: string; reason: string }[] = [
  { route: "/api/venture/list", reason: "Venture room venture picker" },
  { route: "/api/venture/:slug/state", reason: "Venture room phase + checkpoint header" },
  { route: "/api/venture/:slug/artifacts", reason: "Venture room artifact list" },
  { route: "/api/venture/:slug/decisions", reason: "Venture room decision list" },
  { route: "/api/venture/:slug/canon", reason: "Venture room ledger thread" },
  { route: "/api/venture/:slug/gate", reason: "Venture room response-gate counter" },
  { route: "/api/venture/:slug/clusters", reason: "Venture room problem clusters" },
  { route: "/api/venture/:slug/rules", reason: "Venture room rules-version stamp" },
  { route: "/api/venture/:slug/intake/answers", reason: "Venture room YOUR WORDS / quotes panel" },
];

// A :slug route counts as called when the emitted script both reaches into /api/venture/ and names
// this route's own tail — the client builds these as "/api/venture/" + slug + "/state".
function venturePathIsCalled(script: string, route: string): boolean {
  if (!route.includes(":slug")) return script.includes(route);
  return script.includes("/api/venture/") && script.includes("/" + route.split("/:slug/")[1]);
}

test("wiring guard: every venture read route is either called by the page or parked in PENDING_UI_VENTURE_READS", () => {
  const script = emittedScripts().join("\n");
  for (const route of VENTURE_READ_PATHS) {
    const called = venturePathIsCalled(script, route);
    const parked = PENDING_UI_VENTURE_READS.find((e) => e.route === route);
    if (parked) {
      assert.ok(
        !called,
        `${route} now has a caller in the page — delete its PENDING_UI_VENTURE_READS entry ` +
          `(parked for the ${parked.reason}); the exemption has done its job`
      );
    } else {
      assert.ok(called, `venture-reads.ts serves ${route} but no caller in the page (orphan route) — wire it, or park it with a reason`);
    }
  }
});

test("PENDING_UI_VENTURE_READS holds no entry for a route that no longer exists", () => {
  for (const e of PENDING_UI_VENTURE_READS) {
    assert.ok(
      VENTURE_READ_PATHS.includes(e.route),
      `PENDING_UI_VENTURE_READS lists ${e.route}, which is no longer served — delete the entry`
    );
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
  // Fiction kinds map for real now, but job() here builds a Content-kind job, so the rule is
  // exercised through the injectable resolver. One failure card per screen, never two.
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
  outreachSendState, outreachSendNote, outreachSendBadge, leadSendLogLine,
  outreachThreadPhase, firstSentence, outreachOpeningLine,
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

test("outreachSendState: locking is the only per-message fact the repo measures", () => {
  assert.equal(outreachSendState(null), "none");
  assert.equal(outreachSendState(undefined), "none");
  assert.equal(outreachSendState({ status: "draft" }), "draft");
  assert.equal(outreachSendState({ status: "approved" }), "draft");
  assert.equal(outreachSendState({ status: "locked" }), "locked");
});

test("outreachSendState: locked never reads as sent, because nothing records which message went", () => {
  // The tracker keys lead:person, not message. A lead whose message-01 went out months ago would
  // otherwise stamp "sent" on a freshly locked message-02 nobody has touched.
  const state = outreachSendState({ status: "locked" });
  assert.equal(state, "locked");
  assert.ok(outreachSendBadge(state, false).endsWith("NOT SENT"), "a locked message says plainly that it has not been sent");
});

test("outreachSendNote: locking and sending carry the two authored notes, verbatim", () => {
  assert.equal(outreachSendNote("draft"), "Locking readies it. You send it by hand, and nothing here can send it for you.");
  assert.equal(outreachSendNote("locked"), "Paste it into your mail client and send it there. Tell me once it has gone.");
  assert.equal(outreachSendNote("none"), "");
});

test("outreachSendBadge: locked says NOT SENT until a send is on the ledger, and never argues with it", () => {
  assert.equal(outreachSendBadge("locked", false), "LOCKED · NOT EDITABLE, NOT SENT");
  assert.equal(outreachSendBadge("locked", true), "LOCKED · NOT EDITABLE");
  assert.equal(outreachSendBadge("draft", true), "");
  assert.equal(outreachSendBadge("none", false), "");
});

test("leadSendLogLine: the logged send is reported as the lead-level fact the tracker measured", () => {
  assert.equal(leadSendLogLine("2026-08-06T14:22:00.000Z"), "A send was logged 2026-08-06, by hand. See Follow-ups.");
  assert.equal(leadSendLogLine(null), "");
  assert.equal(leadSendLogLine("  "), "");
});

test("outreach copy: no em dashes and no 'atomize' in the strings this PR adds", () => {
  const strings = [
    ...OUTREACH_SEGMENTS.flatMap((s) => [s.name, s.note]),
    lastPitchedLabel(null), lastPitchedLabel("2026-08-06T00:00:00.000Z"),
    ...["platform", "org-mission", "org-role", "content-example"].map(threadSegLabel),
    contactsLine([]), contactsLine([{ name: "Annika L." }]), contactsLine([{ name: "A" }, { name: "B" }]),
    matchmakerRead(lead({})).headline,
    ...(["none", "draft", "locked"] as const).map(outreachSendNote),
    outreachSendBadge("locked", false), outreachSendBadge("locked", true),
    leadSendLogLine("2026-08-06T00:00:00.000Z"),
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

// ── Outreach room: the conversational half (design v7 §3, live direction) ──

test("outreachThreadPhase: derived from the message and the job, never a stored flag", () => {
  assert.equal(outreachThreadPhase(null, false), "asking");
  assert.equal(outreachThreadPhase(undefined, false), "asking");
  assert.equal(outreachThreadPhase(null, true), "drafting");
  // A job in flight beats a message already on disk: a re-draft is still drafting.
  assert.equal(outreachThreadPhase({ file: "messages/message-01.md", body: "hi" }, true), "drafting");
  assert.equal(outreachThreadPhase({ file: "messages/message-01.md", body: "hi" }, false), "drafted");
});

test("firstSentence: cuts at the first full stop, and caps a runaway one on a word boundary", () => {
  assert.equal(firstSentence("They ship in public. Then they write about it.", 200), "They ship in public.");
  assert.equal(firstSentence("no full stop here", 200), "no full stop here");
  assert.equal(firstSentence("", 200), "");
  assert.equal(firstSentence(undefined, 200), "");
  const long = firstSentence("one two three four five six seven eight nine ten.", 20);
  assert.ok(long.endsWith("..."));
  assert.ok(long.length <= 24, long);
  assert.ok(!/ $/.test(long.replace(/\.\.\.$/, "")), "the cut lands on a word boundary");
});

test("outreachOpeningLine: built from the matchmaker read, not invented fresh", () => {
  const line = outreachOpeningLine(lead({
    name: "Acme Co",
    whyMutual: "You both think the untested assumption is the expensive one. That is rarer than it sounds.",
  }));
  assert.ok(line.includes("Acme Co"));
  assert.ok(line.includes("You both think the untested assumption is the expensive one."));
  assert.ok(line.includes("Want to lead with that, or keep it short and just ask for a quick chat?"));
  // The second sentence of the read is trimmed, so the opening line stays one line.
  assert.ok(!line.includes("That is rarer than it sounds."));
});

test("outreachOpeningLine: falls back to the legacy pitch angle rather than inventing a reason", () => {
  const line = outreachOpeningLine(lead({ name: "Acme Co", pitchAngle: "they just reversed a shipped decision in public." }));
  assert.ok(line.includes("they just reversed a shipped decision in public."));
});

test("outreachOpeningLine: a lead with no read on file says so, and still asks the question", () => {
  const line = outreachOpeningLine(lead({ name: "Acme Co" }));
  assert.ok(line.includes("there is no research read on file yet"));
  assert.ok(line.includes("I will write it in your voice"));
  assert.ok(!line.includes("(no read recorded yet)"), "the internal placeholder never reaches Muxin");
});

test("outreach thread markup: the direction composer ships with the prototype's authored copy", () => {
  const html = renderPage({ repoRoot, isDevWorktree: false });
  for (const copy of [
    "Suggested angle",
    "Say which way to take it, in a line or two.",
    "Draft it",
    "Nothing here goes anywhere. It becomes a draft, and only you send it.",
    "YOU SAID",
    "Drafting the pitch",
    "The draft",
    "Make it shorter, drop the second line, warmer close",
    "Update it",
    "Rewriting the same draft, not adding a new one",
  ]) {
    assert.ok(html.includes(copy), "authored direction copy missing from the page: " + copy);
  }
  // The vision doc's one hard promise, said in place rather than only in the prompt.
  assert.ok(html.includes("I never invent interest you do not have"));
});

test("outreach thread markup: iterating reuses the one revise route, and drafting posts the direction", () => {
  const html = renderPage({ repoRoot, isDevWorktree: false });
  assert.ok(html.includes('post("/api/outreach/draft"'), "the directed draft has its own route");
  assert.ok(html.includes('post("/api/outreach/message/revise"'), "iterate still uses the pre-existing revise path");
  assert.equal(
    html.split('post("/api/outreach/message/revise"').length - 1, 1,
    "exactly one revise call site, never a second path bolted on",
  );
});

test("outreach thread markup: the direction copy Muxin reads carries no em dash and no AI tells", () => {
  const html = renderPage({ repoRoot, isDevWorktree: false });
  for (const copy of [
    "Nothing here goes anywhere. It becomes a draft, and only you send it. I write it in your voice and I never invent interest you do not have.",
    "Say which way to take it, in a line or two.",
    "Rewriting the same draft, not adding a new one",
  ]) {
    assert.ok(html.includes(copy));
    assert.ok(!copy.includes("\u2014"), "no em dash in the copy this PR adds: " + copy);
  }
});

// ── Audit fixes: answered asks, the strip's poll and its Fiction rule, one clock per screen ─────

// Finding 5: Muxin answers one ask, the fresh job runs and finishes, and the team header still
// reads YOUR TEAM, WAITING ON YOU with an ANSWER IT row she can never clear.
test("an answered ask stops counting as waiting on her", () => {
  const unanswered = job({ id: "a", status: "blocked", answer: null, finishedAt: 1000 });
  const answered = job({ id: "b", status: "blocked", answer: "Substack", finishedAt: 1000 });
  assert.equal(jobAwaitingAnswer(unanswered), true);
  assert.equal(jobAwaitingAnswer(answered), false);
  assert.equal(jobSettled(answered), true, "she is done with it, so every surface treats it as finished");
  assert.equal(jobSettled(unanswered), false);
  assert.equal(jobSettled(job({ status: "done" })), true);
  assert.equal(jobSettled(job({ status: "failed" })), false);
});

test("the team header stops demanding an answer once she has given one", () => {
  assert.equal(teamRailHeader([job({ status: "blocked", answer: null })]), "YOUR TEAM, WAITING ON YOU");
  assert.equal(teamRailHeader([job({ status: "blocked", answer: "Substack" })]), "YOUR TEAM, IDLE");
  assert.equal(
    teamRailHeader([job({ id: "a", status: "blocked", answer: "Substack" }), job({ id: "b", status: "running" })]),
    "YOUR TEAM, WORKING",
    "the fresh job carrying her answer is what the header should be about",
  );
});

test("an answered ask leaves the team rail instead of sitting there saying ANSWER IT", () => {
  const rows = teamLiveRows([
    job({ id: "a", status: "blocked", answer: "Substack" }),
    job({ id: "b", status: "blocked", answer: null }),
  ]);
  assert.equal(rows.length, 1, "only the question she still owes an answer to");
  assert.equal(rows[0].action, "ANSWER IT");
  assert.equal(rows[0].urgent, true);
});

test("an answered ask reads as answered on the row, not as amber urgency", () => {
  const answered = job({ status: "blocked", answer: "Substack", elapsedMs: 4000 });
  assert.equal(jobRailLabel(answered).text, "You answered");
  assert.equal(jobRailLabel(answered).color, JOB_COLORS.green);
  assert.equal(stripRailLabel(answered).text, "You answered");
  assert.notEqual(jobRailLabel(answered).color, JOB_COLORS.amber);
  // The question and her choice stay readable. That copy is not deleted.
  assert.equal(jobFooter(answered), ANSWERED_FOOTER);
  assert.equal(stripFooter(answered), ANSWERED_FOOTER);
  assert.equal(jobAnswerEcho(answered), "You said: Substack");
  assert.match(jobLogLine(answered), /you answered it/);
  // And the unanswered case is untouched.
  const waiting = job({ status: "blocked", answer: null });
  assert.equal(jobRailLabel(waiting).text, "Needs you");
  assert.equal(jobRailLabel(waiting).color, JOB_COLORS.amber);
  assert.equal(stripRailLabel(waiting).text, "Stopped, needs you");
});

test("an answered ask releases the room strip; an unanswered one holds it", () => {
  const answered = job({ id: "a", kind: "url", status: "blocked", answer: "Substack", finishedAt: 1000 });
  const waiting = job({ id: "b", kind: "url", status: "blocked", answer: null, finishedAt: 1000 });
  assert.equal(stripJobFor([waiting], "Content", 1000 + STRIP_LINGER_MS * 5)?.id, "b", "it still needs her");
  assert.equal(stripJobFor([answered], "Content", 1000 + STRIP_LINGER_MS * 5), null, "it lingered, then cleared");
  assert.equal(
    stripJobFor([answered, job({ id: "c", kind: "url", status: "running" })], "Content", 2000)?.id, "c",
    "the fresh job carrying her answer takes the strip",
  );
});

// Finding 7: the Fiction rule looked at ALL fiction jobs, so one stale failure hid the strip from
// every later Fiction job, leaving a running job no progress surface at all.
const asFiction = () => "Fiction" as const;

test("a stale Fiction failure does not hide the strip from a Fiction job running now", () => {
  const jobsIn = [
    job({ id: "old", kind: "fiction-draft", status: "failed", finishedAt: 500 }),
    job({ id: "new", kind: "fiction-draft", status: "running" }),
  ];
  assert.equal(stripJobFor(jobsIn, "Fiction", 1000, asFiction)?.id, "new");
});

test("Fiction still suppresses the strip when the newest job IS the failure", () => {
  const jobsIn = [
    job({ id: "old", kind: "fiction-draft", status: "done", finishedAt: 500 }),
    job({ id: "new", kind: "fiction-draft", status: "failed", finishedAt: 900 }),
  ];
  assert.equal(stripJobFor(jobsIn, "Fiction", 1000, asFiction), null, "one failure card per screen, never two");
});

test("only Fiction suppresses a failure; every other room still shows one", () => {
  const failed = job({ id: "f", kind: "url", status: "failed", finishedAt: 900 });
  assert.equal(stripJobFor([failed], "Content", 1000)?.id, "f");
});

// Finding 6: the poll only fired while a queued or running job was already in hand, so the 9s
// linger could never expire (nothing re-rendered to clear it) and an enqueue from an idle desk
// never armed the poll at all.
test("the poll keeps firing long enough for the strip linger to actually expire", () => {
  const finished = [job({ status: "done", finishedAt: 1000 })];
  assert.equal(jobsPollDue(finished, 1000), true, "it just finished");
  assert.equal(jobsPollDue(finished, 1000 + STRIP_LINGER_MS - 1), true, "still inside the linger window");
  assert.equal(
    jobsPollDue(finished, 1000 + STRIP_LINGER_MS + 1), true,
    "one beat past the window, so a render actually happens to clear the strip",
  );
  assert.equal(jobsPollDue(finished, 1000 + STRIP_LINGER_MS + JOBS_POLL_MS + 1), false, "then it rests");
});

test("live work always keeps the poll running", () => {
  assert.equal(jobsPollDue([job({ status: "running", finishedAt: null })], 9_999_999), true);
  assert.equal(jobsPollDue([job({ status: "queued", finishedAt: null })], 9_999_999), true);
  assert.equal(jobsPollDue([], 9_999_999), false, "an idle desk with nothing to watch does not poll");
});

test("an enqueue arms the poll from an idle desk, where there is no job to see yet", () => {
  assert.equal(jobsPollDue([], 1000), false);
  assert.equal(jobsPollDue([], 1000, 1500), true, "armed, so the new job gets found on the next beat");
  assert.equal(jobsPollDue([], 2000, 1500), false, "the arming window is short on purpose");
});

test("every route that enqueues a job arms the poll", () => {
  for (const route of [
    "/api/atomize", "/api/notes/pick", "/api/revise", "/api/duplicate", "/api/video/generate",
    "/api/develop/start", "/api/develop/format", "/api/strategy/refresh-brief", "/api/strategy/insights",
    "/api/strategy/ask-insights", "/api/strategy/pull", "/api/outreach/scout", "/api/outreach/draft",
    "/api/outreach/message/revise", "/api/charles/draft", "/api/followups/draft-follow-up",
    "/api/fiction/draft", "/api/fiction/repass", "/api/fiction/check",
  ]) {
    assert.equal(enqueuesJob(route), true, route + " queues a job, so it must arm the poll");
  }
  assert.equal(enqueuesJob("/api/status"), false, "a status write queues nothing");
  assert.equal(enqueuesJob("/api/outreach/mark-sent"), false);
});

// The Fiction room shipped its three buttons without adding their routes to the arming list, so
// from an idle desk jobsPollDue stayed false and pressing Draft it, Second pass or Check the canon
// showed no progress at all. Fiction does not self-heal either: its refresh only reloads the room,
// never the jobs. Named on their own so a future edit cannot quietly drop them again.
test("the Fiction room's three buttons arm the poll, so a scene it is writing is visible", () => {
  for (const route of ["/api/fiction/draft", "/api/fiction/repass", "/api/fiction/check"]) {
    assert.equal(enqueuesJob(route), true, route + " enqueues a Fiction job, so it must arm the poll");
    assert.ok(JOB_ENQUEUE_ROUTES.includes(route), route + " must be in the exported list");
  }
  // Reading a scene enqueues nothing, so it must not arm the poll.
  assert.equal(enqueuesJob("/api/fiction/scene"), false, "a read queues nothing");
  assert.equal(enqueuesJob("/api/fiction/doc"), false);
});

// The mirror convention again: the browser has its own copy of this list, and only the copy that
// ships decides whether Muxin sees the strip.
test("client <script> output: the Fiction routes reach the browser's arming list too", () => {
  const html = renderPage({ repoRoot: process.cwd(), isDevWorktree: false });
  const script = html.slice(html.indexOf("<script>"), html.lastIndexOf("</script>"));
  const list = script.slice(script.indexOf("const JOB_ENQUEUE_ROUTES = ["));
  const mirrored = list.slice(0, list.indexOf("]"));
  for (const route of ["/api/fiction/draft", "/api/fiction/repass", "/api/fiction/check"]) {
    assert.ok(mirrored.includes('"' + route + '"'), route + " must ship in the client mirror");
  }
});

// Finding 9: "Update it" on an Outreach thread showed up under Content as the Formatter, because
// it shared the "revise" kind with content derivative revises.
test("an outreach message revise belongs to Outreach, and a content revise still belongs to Content", () => {
  assert.equal(jobRoom("outreach-revise"), "Outreach");
  assert.equal(teamRoomName(jobRoom("outreach-revise")), "Connector");
  assert.equal(jobRoom("revise"), "Content", "a derivative revise must not move rooms");
  assert.equal(teamRoomName(jobRoom("revise")), "Formatter");
  assert.equal(jobLandingSentence(jobRoom("outreach-revise")), "A message, locked only when you say so.");
  const running = job({ kind: "outreach-revise", status: "running" });
  assert.equal(stripJobFor([running], "Outreach", 0)?.id, "j1");
  assert.equal(stripJobFor([running], "Content", 0), null);
});

// Finding 8: two durations on one screen. The strip counts from when the job was QUEUED; a timer
// started at the click does not, so the same screen showed "12s elapsed" beside "3s".
test("no screen that carries a strip starts its own competing clock", () => {
  const html = renderPage({ repoRoot: process.cwd(), isDevWorktree: false });
  assert.ok(
    !html.includes("fmtElapsed(Date.now()-start)"),
    "a click-local stopwatch beside the strip's measured clock is the defect this design was corrected for",
  );
  assert.ok(!html.includes("elapsed</span>"), "no second elapsed counter anywhere on a strip screen");
});

test("no screen shows a duration estimate nothing measured", () => {
  const html = renderPage({ repoRoot: process.cwd(), isDevWorktree: false });
  assert.ok(!html.includes("~20-40s"), "nothing measured that guess");
  assert.ok(!html.includes("~10-60s"), "nor the ETA it replaced");
});

test("the poll and the arming list actually reach the browser", () => {
  const html = renderPage({ repoRoot: process.cwd(), isDevWorktree: false });
  const script = html.slice(html.indexOf("<script>"), html.lastIndexOf("</script>"));
  for (const fn of ["function jobsPollDue(", "function enqueuesJob(", "function jobAwaitingAnswer(", "function jobSettled("]) {
    assert.ok(script.includes(fn), fn + " must reach the browser");
  }
  assert.ok(script.includes("jobsPollDue(JOBS, Date.now(), jobsPollArmedUntil)"), "the interval must use the shared gate");
  assert.ok(script.includes("if(enqueuesJob(path)) jobsPollArmedUntil"), "post() must arm the poll when it enqueues");
});

test("the copy this fix adds carries no em dash", () => {
  const html = renderPage({ repoRoot: process.cwd(), isDevWorktree: false });
  for (const copy of [
    "The strip at the top of this room carries the clock",
    "Running the reports, then asking Claude for a synthesis.",
    "You answered",
    "> stopped, you answered it",
  ]) {
    assert.ok(html.includes(copy), "missing: " + copy);
    assert.ok(!copy.includes("\u2014"), "no em dash in: " + copy);
  }
});

// ── Fiction room (v7 §2) ─────────────────────────────────────────────────────────────────────────

const fjob = (over: Record<string, unknown> = {}) =>
  ({ id: "j1", kind: "fiction-draft", label: "Draft a scene", status: "running", ...over }) as never;

test("the fiction job kinds land in the Fiction room, so its strip and Co-writer rail come alive", () => {
  assert.equal(jobRoom("fiction-draft"), "Fiction");
  assert.equal(jobRoom("fiction-continuity"), "Fiction");
  assert.equal(teamRoomName(jobRoom("fiction-draft")), "Co-writer");
  // Unchanged for every other kind.
  assert.equal(jobRoom("charles-draft"), "Charles");
  assert.equal(jobRoom("video"), "Content");
});

test("the header tracks unwritten, drafting, waiting, and scene waiting on you", () => {
  assert.equal(fictionStatusWord([], false), "unwritten");
  assert.equal(fictionStatusWord([fjob({ status: "queued" })], false), "drafting");
  assert.equal(fictionStatusWord([fjob({ status: "running" })], false), "drafting");
  assert.equal(fictionStatusWord([fjob({ status: "blocked" })], false), "waiting on your answer");
  assert.equal(fictionStatusWord([fjob({ status: "done" })], true), "scene waiting on you");
  // A job in another room never moves Fiction's header.
  assert.equal(fictionStatusWord([{ id: "x", kind: "video", label: "v", status: "running" } as never], false), "unwritten");
});

test("a failure reads as nothing written only when nothing was in fact written", () => {
  assert.equal(fictionStatusWord([fjob({ status: "failed" })], false), "nothing written");
  // A failed SECOND pass leaves the first pass on disk and on screen, so the header must not
  // claim nothing was written while the scene is right there.
  assert.equal(fictionStatusWord([fjob({ status: "done" }), fjob({ id: "j2", status: "failed" })], true), "scene waiting on you");
  assert.equal(fictionStatusTone("nothing written").fg, JOB_COLORS.red);
  assert.equal(fictionStatusTone("drafting").fg, JOB_COLORS.ai);
});

// Rule 4 guard: Georgia is Muxin's own words, the AI purple is the machine's. The room used to
// call "a scene exists" whatever chapter sat newest in stories/, so a chapter she wrote herself in
// /story came back labelled "The scene, from your beats" and set in purple, with the composer
// underneath it still asking for the beats it claimed to have used. A scene exists only when her
// saved beats produced it.
test("a chapter she wrote herself is never a scene from beats she never gave", () => {
  const hers = { body: "The rope went slack in his hand." };
  assert.equal(fictionHasScene("", hers), false);
  assert.equal(fictionHasScene(null, hers), false);
  assert.equal(fictionHasScene("   ", hers), false);
  // With no beats the header stays honest and the composer keeps the room.
  assert.equal(fictionStatusWord([], fictionHasScene("", hers)), "unwritten");
  assert.equal(fictionStatusWord([fjob({ status: "done" })], fictionHasScene("", hers)), "unwritten");
  // Beats saved but the draft not back yet is still not a scene.
  assert.equal(fictionHasScene("Eli finds the cut line.", null), false);
  assert.equal(fictionHasScene("Eli finds the cut line.", { body: "  " }), false);
  assert.equal(fictionStatusWord([fjob({ status: "running" })], fictionHasScene("Eli finds the cut line.", null)), "drafting");
  // Her beats and the prose they produced: that is a scene.
  assert.equal(fictionHasScene("Eli finds the cut line.", hers), true);
  assert.equal(fictionStatusWord([fjob({ status: "done" })], fictionHasScene("Eli finds the cut line.", hers)), "scene waiting on you");
});

// The mirror convention: fixing the exported copy and forgetting the inline one would leave the
// browser rendering her prose in purple while the test suite reported green.
test("client <script> output: the browser gates the scene on her beats too, not just the export", () => {
  const html = renderPage({ repoRoot: process.cwd(), isDevWorktree: false });
  assert.ok(html.includes("function ficHasScene(beats, chapter){"), "the client mirror must ship");
  assert.ok(html.includes("const hasScene = ficHasScene(beats, chapter);"), "renderFiction must use the mirror");
});

test("Fix the line is offered only on a conflict the check can actually patch", () => {
  const base = { kind: "conflict", rule: "Eli's left hand", note: "The draft sweeps a whole hand.", span: "his gloved hand", replacement: "his two remaining fingers", fixable: true };
  assert.equal(fictionCheckRow(base, false).canFix, true);
  assert.equal(fictionCheckRow(base, false).word, "conflict");
  assert.equal(fictionCheckRow({ ...base, fixable: false }, false).canFix, false);
  assert.equal(fictionCheckRow({ ...base, span: "" }, false).canFix, false);
  assert.equal(fictionCheckRow({ ...base, replacement: "" }, false).canFix, false);
  assert.equal(fictionCheckRow({ ...base, kind: "hold" }, false).canFix, false);
  assert.equal(fictionCheckRow({ ...base, kind: "hold" }, false).word, "holds");
  const fixed = fictionCheckRow(base, true);
  assert.equal(fixed.word, "fixed");
  assert.equal(fixed.canFix, false);
  assert.match(fixed.text, /his two remaining fingers/);
});


// A conflict the check cannot patch loses the BUTTON and keeps the SEVERITY. Losing the severity
// too is how the rail could show a chapter as green while it still broke canon.
test("an unfixable conflict stays a conflict on the rail, and only the button goes away", () => {
  const base = { kind: "conflict", rule: "Eli's left hand", note: "The draft sweeps a whole hand.", span: "his gloved hand", replacement: "", fixable: false };
  const fixableColor = fictionCheckRow({ ...base, replacement: "his two remaining fingers", fixable: true }, false).color;
  for (const reason of ["span-missing", "span-repeats", "no-replacement"]) {
    const row = fictionCheckRow({ ...base, unfixableReason: reason, occurrences: reason === "span-repeats" ? 2 : 1 }, false);
    assert.equal(row.word, "conflict", `an unfixable conflict must never render as "${row.word}"`);
    assert.equal(row.color, fixableColor, "same treatment as a fixable conflict");
    assert.equal(row.canFix, false);
    assert.match(row.text, /The draft sweeps a whole hand\./, "the finding itself is still said");
    assert.match(row.text, /I cannot fix this one for you/, `no reason given for ${reason}`);
    assert.ok(!row.text.includes("\u2014"), "no em dash in copy Muxin reads");
  }
});

test("each unfixable reason says plainly which thing blocked the fix", () => {
  assert.match(unfixableLine("span-missing"), /could not find that exact wording/);
  assert.match(unfixableLine("span-repeats", 2), /appears 2 times/);
  assert.match(unfixableLine("span-repeats"), /appears more than once/);
  assert.match(unfixableLine("no-replacement"), /nothing safe to put in its place/);
  assert.equal(unfixableLine(""), "", "a fixable conflict says nothing extra");
  for (const line of [unfixableLine("span-missing"), unfixableLine("span-repeats", 2), unfixableLine("no-replacement")]) {
    assert.ok(!line.includes("\u2014"));
    assert.ok(!/atomize/i.test(line));
  }
});

test("the canon stamp only counts what came back, and shows nothing before a check", () => {
  assert.equal(fictionCanonStamp(null), "");
  assert.equal(
    fictionCanonStamp({ checkedAt: "2026-08-22T10:00:00.000Z", holds: [1, 2], conflicts: [1] } as never),
    "checked 2026-08-22 · 2 holding · 1 breaking",
  );
});

// The exact failure the audit named: the model flags two genuine contradictions whose spans each
// appear twice. They used to be rewritten into holds, so the stamp read "2 holding, 0 breaking"
// while the chapter still broke canon, and Muxin read that as cleared.
test("the stamp counts an unfixable conflict as breaking, never as holding", () => {
  const unfixable = { kind: "conflict", rule: "r", note: "n", span: "s", replacement: "", fixable: false, unfixableReason: "span-repeats", occurrences: 2 };
  const stamp = fictionCanonStamp({ checkedAt: "2026-08-22T10:00:00.000Z", holds: [], conflicts: [unfixable, unfixable] } as never);
  assert.equal(stamp, "checked 2026-08-22 · 0 holding · 2 breaking");
  assert.ok(!stamp.includes("2 holding"), "two broken rules must never read as holding");
});

test("the client rail carries the same unfixable copy the server helper does", () => {
  const html = renderPage({ repoRoot, isDevWorktree: false });
  for (const copy of [unfixableLine("span-missing"), unfixableLine("no-replacement"), "so there is no single line to change."]) {
    assert.ok(html.includes(copy), "the browser mirror drifted from the server helper: " + copy);
    assert.ok(!copy.includes("\u2014"), "no em dash in the copy this PR adds: " + copy);
  }
});

test("the scene renders as paragraphs, while the file keeps one sentence per line", () => {
  const body = "The airlock was quiet.\nNo klaxons, no amber strobe.\n\nHe did not speak into the comms.";
  assert.deepEqual(fictionSceneParagraphs(body), [
    "The airlock was quiet. No klaxons, no amber strobe.",
    "He did not speak into the comms.",
  ]);
  assert.deepEqual(fictionSceneParagraphs(""), []);
});
