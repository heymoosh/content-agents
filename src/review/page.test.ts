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
  classifyCapture, captureVerdict, captureHandoffVerdict, CAPTURE_RAIL_IDLE, CAPTURE_RAIL_ASKING, LINK_ASK_HEADING,
  LINK_ASK_EXPLAINER, LINK_ASK_SIGNALS_NOTE, BOOT_ROOM,
  groupDigits, metricLine, sampleNote, familyGate, fitLine, floorNote, reuseLine, readsFromCells,
  intakeProgressLine, intakeUnanswered, intakeSaveLine, intakeSlugError,
  ventureMultiPickIds, followupDraftRequest, outreachDraftRequest, outreachMessageReviseRequest, notesPickRequest,
  type MetricReadView, type ChannelTreatmentView, type TreatmentView, type FitBasisView,
} from "./page.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { saveIntakeDraft } from "./intake-draft.js";
import { INTAKE_QUESTIONS } from "../venture/intake.js";

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
import * as pageModule from "./page.js";
import { repoRoot } from "../db/db.js";
import { VENTURE_READ_PATHS } from "./venture-reads.js";
import { VENTURE_WRITE_PATHS } from "./venture-writes.js";
import { INTAKE_DRAFT_PATHS } from "./intake-draft.js";
import { CARD_ACTION_IDS } from "./venture-thread.js";

const HERE = dirname(fileURLToPath(import.meta.url));

function emittedScripts(): string[] {
  const html = renderPage({ repoRoot, isDevWorktree: false });
  const scripts: string[] = [];
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) scripts.push(m[1]);
  return scripts;
}

type WorkbenchMirror = {
  workbenchSlugForJob: (job: { kind: string; label: string; slugs?: string[] }) => string | null;
  workbenchJobTarget: (job: { kind: string; label: string; slugs?: string[] }) => string | null;
};

function workbenchMirror(sessions: { slug: string }[]): WorkbenchMirror {
  const script = emittedScripts().join("\n");
  const start = script.indexOf("function workbenchSlugForJob(");
  const end = script.indexOf("function openWorkbenchJob(", start);
  assert.ok(start >= 0 && end > start, "the Workbench job helpers must reach the browser");
  return new Function("WB_SESSIONS", script.slice(start, end) + "\nreturn { workbenchSlugForJob, workbenchJobTarget };")(sessions) as WorkbenchMirror;
}

test("advisor job links target the matching Workbench session across every job state", () => {
  const target = (pageModule as Record<string, unknown>).workbenchJobTarget as (
    job: { kind: string; label: string; slugs?: string[] },
    sessions: { slug: string }[],
  ) => string | null;
  assert.equal(typeof target, "function");
  const sessions = [{ slug: "2026-08-25-piece" }];
  for (const status of ["queued", "running", "done", "failed", "stopped"]) {
    assert.equal(
      target({ kind: "develop", label: "Develop: 2026-08-25-piece", slugs: status === "done" ? [sessions[0].slug] : [] }, sessions),
      sessions[0].slug,
      `${status} develop job should open its Workbench session`,
    );
  }
  assert.equal(
    target({ kind: "develop-reply", label: "Advisor reply: 2026-08-25-piece", slugs: [] }, sessions),
    sessions[0].slug,
  );
});

test("advisor job links fall back to Content without claiming a missing Workbench artifact", () => {
  const target = (pageModule as Record<string, unknown>).workbenchJobTarget as (
    job: { kind: string; label: string; slugs?: string[] },
    sessions: { slug: string }[],
  ) => string | null;
  assert.equal(target({ kind: "develop", label: "Develop: not-materialized", slugs: [] }, []), null);
  assert.equal(target({ kind: "develop", label: "Develop: existing-piece", slugs: [] }, [{ slug: "existing-piece" }]), null,
    "a human source label cannot target a pre-existing session before the slug is stamped");
  assert.equal(target({ kind: "text", label: "Format: piece", slugs: ["not-materialized"] }, [{ slug: "not-materialized" }]), null);
});

test("the emitted Workbench resolver stays behavior-identical to the tested server resolver", () => {
  const sessions = [{ slug: "2026-08-25-piece" }];
  const browser = workbenchMirror(sessions);
  const server = (pageModule as Record<string, unknown>).workbenchJobTarget as (
    job: { kind: string; label: string; slugs?: string[] },
    sessions: { slug: string }[],
  ) => string | null;
  for (const job of [
    { kind: "develop", label: "Develop: 2026-08-25-piece", slugs: [] },
    { kind: "develop-reply", label: "Advisor reply: 2026-08-25-piece", slugs: [] },
    { kind: "develop", label: "Develop: 2026-08-25-piece", slugs: ["2026-08-25-piece"] },
    { kind: "develop", label: "Develop: existing-piece", slugs: [] },
    { kind: "text", label: "Format: 2026-08-25-piece", slugs: ["2026-08-25-piece"] },
  ]) {
    assert.equal(browser.workbenchJobTarget(job), server(job, sessions), JSON.stringify(job));
  }
  const script = emittedScripts().join("\n");
  assert.ok(script.includes("sheet.dataset.wbSlug = s.slug"), "Workbench sessions expose a scroll target");
  assert.ok(script.includes('querySelectorAll(".session[data-wb-slug]")'), "advisor navigation scrolls Workbench sessions");
  assert.ok(script.includes('Promise.resolve(setRoom("content")).then'), "advisor navigation has one authoritative Content load");
});

test("queue open links carry job kind so advisor navigation is distinct from Review navigation", () => {
  const script = emittedScripts().join("\n");
  assert.ok(script.includes('class="jopen" data-id="\'+esc(j.id)+\'"'), "queue links identify the job");
  assert.ok(script.includes('data-kind="\'+esc(j.kind)+\'"'), "queue links carry the job kind");
  assert.match(script, /a\.dataset\.kind===\"develop\"/);
  assert.match(script, /openWorkbenchJob\(job\)/);
  assert.match(script, /if\(a\.dataset\.slug\) load\(\)/, "non-advisor jobs keep the Review-queue path");
});

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
// Empty, and meant to stay that way. The three routes that used to sit here
// (/api/content/treatment, /api/signals/outcomes, /api/research/report) are all called by the page
// now: the Content room's three-step wizard reads the first, the Signals room's outcome families
// read the other two. Add an entry only for a route whose UI genuinely has not landed yet, and
// delete it the moment it has.
const PENDING_UI_ROUTES = new Set<string>([]);

test("wiring guard: every client /api path has a serve.ts route, and every route has a caller", () => {
  const script = emittedScripts().join("\n");
  const serveSrc = readFileSync(join(HERE, "serve.ts"), "utf8");

  const routes = new Set<string>();
  for (const m of serveSrc.matchAll(/url\.pathname === "(\/api\/[^"]+)"/g)) routes.add(m[1]);
  // the one regex route: GET /api/jobs/<id>/log
  const routePrefixes = /\/api\\\/jobs\\\//.test(serveSrc) || serveSrc.includes("^\\/api\\/jobs\\/") ? ["/api/jobs/"] : [];
  // Two whole prefixes are owned by a dispatcher rather than by `url.pathname === "..."` literals,
  // so the extractor above cannot see any of their routes: /api/jobs/<id>/log, and every venture
  // route (handleVentureRead / handleVentureWrite). Their per-route coverage is asserted by the
  // PENDING_UI_VENTURE block below, which reads the real path lists from those modules; here the
  // prefix only has to stop a genuine venture call being reported as a dead button.
  if (serveSrc.includes("handleVentureRead")) routePrefixes.push("/api/venture/");
  if (serveSrc.includes("handleFictionRoute")) routePrefixes.push("/api/fiction");
  if (serveSrc.includes("handleCharlesRoute")) routePrefixes.push("/api/charles");
  if (serveSrc.includes("handleSignalsRoute")) routePrefixes.push("/api/signals", "/api/research");

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
// The same self-deleting exemption as PENDING_UI_ROUTES above, for the Venture room's routes.
//
// Two lists rather than one, for a structural reason: the guard above discovers routes by scanning
// serve.ts for `url.pathname === "..."` literals, and the venture routes are not written that
// way — they are dispatched by handleVentureRead()/handleVentureWrite() and carry :slug and :id
// path parameters, so the extractor cannot see them and `routes.has(...)` would reject them on
// sight. This block gets its route list from the modules themselves (VENTURE_READ_PATHS,
// VENTURE_WRITE_PATHS), which is a stronger source than a regex over source text: a route deleted
// there disappears from this check automatically.
//
// The mechanism is identical in spirit and identical in the property that matters — each entry
// asserts its route is STILL uncalled, so wiring the room turns the entry red and the only way
// back to green is deleting it. Keep the list at or near zero.
const PENDING_UI_VENTURE: { route: string; reason: string }[] = [];

// A parameterised route counts as called when the emitted script both reaches into /api/venture/
// and names this route's own literal segments — the client builds these as
// "/api/venture/" + slug + "/artifacts/" + id + "/approve", so ":slug"/":id" never appear as text
// and the fixed segments around them are what to look for.
//
// The segments are matched as QUOTED fragments, not as bare substrings, and that distinction is
// load-bearing rather than fussy. A concatenated path writes each literal run between two quotes
// ("/intake/" + n + "/draft"), so requiring the quotes costs nothing — and without them
// "/api/venture/:slug/intake/drafts" reads as called by the clear button alone, because
// "/intake/drafts/clear" contains "/intake/drafts" as a substring. That is a route reported as
// wired when nothing fetches it, which is the exact failure this guard exists to catch.
function quotedRunPresent(script: string, run: string): boolean {
  return script.includes('"' + run + '"') || script.includes("'" + run + "'");
}
function venturePathIsCalled(script: string, route: string): boolean {
  if (!route.includes(":")) return script.includes(route);
  if (!script.includes("/api/venture/")) return false;
  // An artifact-lifecycle route is dispatched from the SERVER-supplied action id, not from a
  // literal path in the client ("/artifacts/"+id+"/"+action.id), so its verb never appears as text.
  // Checking for the literal would force the client to hardcode a second copy of the state machine,
  // which is the thing venture-thread.ts's cardActions() exists to prevent. Instead: the dispatch
  // expression must ship, and the verb must be one CardAction can actually emit.
  const verb = /^\/api\/venture\/:slug\/artifacts\/:id\/([a-z-]+)$/.exec(route)?.[1];
  if (verb && (CARD_ACTION_IDS as readonly string[]).includes(verb)) {
    return script.includes('"/artifacts/"+encodeURIComponent(artifactId)+"/"+action.id');
  }
  // Split the path into the literal runs a concatenation would write between its parameters:
  // "/api/venture/:slug/intake/:n/draft" → ["/api/venture/", "/intake/", "/draft"]. Every run has
  // to appear quoted.
  const runs: string[] = [];
  let run = "";
  for (const seg of route.split("/").slice(1)) {
    if (seg.startsWith(":")) {
      runs.push(run + "/");
      run = "";
    } else {
      run += "/" + seg;
    }
  }
  if (run) runs.push(run);
  return runs.every((r) => quotedRunPresent(script, r));
}

test("every artifact-lifecycle route has a CardAction id, and every id has a route", () => {
  const lifecycle = VENTURE_WRITE_PATHS.map((p) => /^\/api\/venture\/:slug\/artifacts\/:id\/([a-z-]+)$/.exec(p)?.[1]).filter(Boolean);
  assert.deepEqual([...lifecycle].sort(), [...CARD_ACTION_IDS].sort(), "the action id union and the artifact routes must be the same set");
});

// The intake-draft routes are the third source: unlike the other venture routes they are written
// straight into serve.ts rather than through handleVentureRead/handleVentureWrite, so neither
// dispatcher's path list carries them. Folding them in here is what makes them subject to the same
// called-or-parked rule as everything else; the test below is what stops the NEXT such route from
// being written without a declaration at all.
const VENTURE_PATHS = [...VENTURE_READ_PATHS, ...VENTURE_WRITE_PATHS, ...INTAKE_DRAFT_PATHS];

// Every regex-dispatched route in serve.ts must be declared in one of the path lists above.
//
// This closes the hole all three intake-draft routes fell through. The first wiring guard finds
// routes by scanning for `url.pathname === "..."` literals and cannot see a regex; the second
// reads its list from the venture dispatchers and cannot see a route written straight into
// serve.ts. A regex route that is in neither is invisible to both — it can ship with no caller,
// and no test notices. So: extract every `/^\/api\/...$/.test(url.pathname)` pattern out of
// serve.ts's own source, canonicalize it back to a :param path, and require it to be declared.
//
// `/api/jobs/` keeps its existing prefix-level treatment in the first guard (the client builds
// those paths from a job id the same way), so those four are listed here rather than re-plumbed.
const DECLARED_JOB_REGEX_PATHS = [
  "/api/jobs/:id/stop", "/api/jobs/:id/log", "/api/jobs/:id/answer", "/api/jobs/:id/retry",
  "/api/venture/:slug/analyze", "/api/venture/:slug/run-step",
];

/** `/^\/api\/venture\/[^/]+\/intake\/\d+\/draft$/` → `/api/venture/:slug/intake/:n/draft`. */
export function canonicalRegexRoute(pattern: string): string {
  return pattern
    .replace(/^\^/, "")
    .replace(/\$$/, "")
    .replace(/\\\//g, "/")
    .replace(/\(\[\^\/\]\+\)|\[\^\/\]\+/g, ":slug")
    .replace(/\\d\+/g, ":n");
}

test("wiring guard: every regex-dispatched route in serve.ts is declared in a path list", () => {
  const serveSrc = readFileSync(join(HERE, "serve.ts"), "utf8");
  const declared = new Set([...VENTURE_PATHS, ...DECLARED_JOB_REGEX_PATHS]);
  const found: string[] = [];
  for (const m of serveSrc.matchAll(/\/(\^\\\/api\\\/[^\n]*?\$)\/\.test\(url\.pathname\)/g)) {
    found.push(canonicalRegexRoute(m[1]));
  }
  assert.ok(found.length >= 7, `expected serve.ts's regex routes to be found, got ${found.length}`);
  for (const route of found) {
    // Only the FIRST :param of a venture path is the slug; a later [^/]+ is an id, and the
    // declarations spell those out. Compare on shape rather than on the parameter's name.
    const shape = (p: string) => p.replace(/:[a-zA-Z]+/g, ":x");
    const ok = [...declared].some((d) => shape(d) === shape(route));
    assert.ok(
      ok,
      `serve.ts dispatches ${route} by regex, and no path list declares it. A regex route is ` +
        `invisible to both wiring guards until it is declared — add it to INTAKE_DRAFT_PATHS, ` +
        `VENTURE_READ_PATHS/VENTURE_WRITE_PATHS, or DECLARED_JOB_REGEX_PATHS above.`
    );
  }
});

test("wiring guard: every venture route is either called by the page or parked in PENDING_UI_VENTURE", () => {
  const script = emittedScripts().join("\n");
  for (const route of VENTURE_PATHS) {
    const called = venturePathIsCalled(script, route);
    const parked = PENDING_UI_VENTURE.find((e) => e.route === route);
    if (parked) {
      assert.ok(
        !called,
        `${route} now has a caller in the page — delete its PENDING_UI_VENTURE entry ` +
          `(parked for the ${parked.reason}); the exemption has done its job`
      );
    } else {
      assert.ok(called, `venture-reads.ts/venture-writes.ts serves ${route} but no caller in the page (orphan route) — wire it, or park it with a reason`);
    }
  }
});

test("PENDING_UI_VENTURE holds no entry for a route that no longer exists", () => {
  for (const e of PENDING_UI_VENTURE) {
    assert.ok(VENTURE_PATHS.includes(e.route), `PENDING_UI_VENTURE lists ${e.route}, which is no longer served — delete the entry`);
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

test("Signals: recommendations expose session-only adopt and decline decisions", () => {
  const html = renderPage({ repoRoot: process.cwd(), isDevWorktree: false });
  assert.ok(html.includes('sig-adopt'), "recommendations must offer Adopt");
  assert.ok(html.includes('class="sig-decline"'), "recommendations must offer Decline");
  assert.ok(html.includes("Adopted for this session. Nothing changed."), "adopt must be visibly session-only");
  assert.ok(html.includes("Declined this session"), "declined recommendations need a session section");
  assert.ok(html.includes("const sigAdopted = new Set()"), "adopt state must live in JavaScript memory");
  assert.ok(html.includes("const sigDeclined = new Set()"), "decline state must live in JavaScript memory");
  assert.ok(html.includes("JSON.stringify([r.type, r.title])"), "session decisions must be keyed by type and title");
  assert.ok(html.includes('sigAdopted.add(signalKey(r))'), "Adopt must only update in-memory state");
  assert.ok(html.includes('sigDeclined.add(signalKey(r))'), "Decline must only update in-memory state");
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
    // The stopped register (this PR): her word for it, its frozen clock, its footer, its log line.
    "You stopped it", "You stopped this one. It did not finish.", "Stop it",
    "Too late, it had already stopped on its own.", "Stopping it.",
  ]) {
    assert.ok(script.includes(copy), "authored copy missing from the page: " + copy);
  }
});

test("job surface copy: no em dashes and no 'atomize' in the strings this PR adds", () => {
  const strings = [
    jobFooter(job({ status: "queued" })), jobFooter(job({ status: "blocked" })),
    jobFooter(job({ status: "failed" })), jobFooter(job({ status: "done" })),
    jobFooter(job({ status: "running", lastStdoutLine: null })), ANSWERED_FOOTER,
    jobFooter(job({ status: "stopped" })), STOPPED_FOOTER,
    stripFooter(job({ status: "queued" })), stripFooter(job({ status: "running", lastStdoutLine: null })),
    stripFooter(job({ status: "stopped" })),
    jobRailLabel(job({ status: "stopped" })).text, stripRailLabel(job({ status: "stopped" })).text,
    jobClockText(job({ status: "stopped", elapsedMs: 185_000 }), 0), jobLogLine(job({ status: "stopped" })),
    jobOpenLabel(job({ status: "stopped" })),
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
  evidenceCapturedView, NO_CAPTURE_DATE_RECORDED,
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

test("evidenceSourceView: the source line stays a source line and never carries a date", () => {
  // EvidenceItem now HAS a captured_at, and it renders on its own row (evidenceCapturedView
  // below). The source cell still must not borrow from it: the prototype's hardcoded
  // "observed Aug 6" sat exactly here, and a dateless source must keep reading as a dateless
  // source rather than reaching for the item's timestamp.
  for (const src of ["https://posthog.com/blog", "vault:People/Annika L.md", "(none)", "", "tbd"]) {
    const v = evidenceSourceView(src);
    assert.ok(!/observed/i.test(v.text), "an evidence source must never read as an observation date: " + v.text);
    assert.ok(!/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/.test(v.text));
  }
});

// ── captured_at: dated, undated, and no evidence at all ─────────────────────────────────────────

test("evidenceCapturedView: a recorded date and no recorded date are two different sentences", () => {
  assert.deepEqual(evidenceCapturedView("2026-08-23"), { dated: true, text: "captured 2026-08-23" });
  assert.deepEqual(evidenceCapturedView(null), { dated: false, text: NO_CAPTURE_DATE_RECORDED });
  assert.deepEqual(evidenceCapturedView(undefined), { dated: false, text: NO_CAPTURE_DATE_RECORDED });
  assert.deepEqual(evidenceCapturedView(""), { dated: false, text: NO_CAPTURE_DATE_RECORDED });
  assert.notEqual(evidenceCapturedView("2026-08-23").text, evidenceCapturedView(null).text);
});

test("evidenceCapturedView: an undated item never renders as though it were dated", () => {
  // The failure this guards is the whole reason the field has three states: every lead.md already
  // on disk was written before captured_at existed, nothing rewrites those files, so undated is a
  // permanent state and not a loading one. No mtime, no today, no blank that reads like a date.
  for (const v of [null, undefined, "", "   ", "today", "unknown", "(none)", "2026-08", "Aug 23 2026"]) {
    const out = evidenceCapturedView(v);
    assert.equal(out.dated, false, JSON.stringify(v));
    assert.equal(out.text, NO_CAPTURE_DATE_RECORDED, JSON.stringify(v));
    assert.ok(!/\d{4}-\d{2}-\d{2}/.test(out.text), "an undated item must not render a date: " + out.text);
    assert.ok(!/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/.test(out.text));
  }
});

test("evidenceCapturedView: the browser copy answers every vector identically (Rule 5)", () => {
  const script = emittedScripts().join("\n");
  const start = script.indexOf("// ── begin the capture-date mirror ──");
  const end = script.indexOf("// ── end of the capture-date mirror ──");
  assert.ok(start > -1, "the inline capture-date mirror must reach the browser");
  assert.ok(end > start, "the capture-date mirror's end marker must follow it");
  const mirror = new Function(
    script.slice(start, end) + "\nreturn evidenceCapturedView;"
  )() as typeof evidenceCapturedView;
  for (const v of ["2026-08-23", "1999-01-01", null, undefined, "", "  ", "today", "2026-08", "Aug 23 2026"]) {
    assert.deepEqual(mirror(v), evidenceCapturedView(v), JSON.stringify(v));
  }
});

test("the evidence rail renders the capture date in the browser, in its own two registers", () => {
  const html = renderPage({ repoRoot: process.cwd(), isDevWorktree: false });
  assert.ok(html.includes("evidenceCapturedView(e.captured_at)"), "the rail must read the item's own date");
  assert.ok(html.includes('cv.dated?"ev-cap":"ev-nocap"'), "dated and undated must take different classes");
  // ...and the two classes must actually LOOK different, or the distinction is only in the markup.
  // Asserted against the emitted CSS because that is the only place it exists.
  const cap = /\.ev-cap \{([^}]*)\}/.exec(html);
  const nocap = /\.ev-nocap \{([^}]*)\}/.exec(html);
  assert.ok(cap && nocap, "both registers need a rule of their own, or the two collapse");
  assert.ok(/font-style:italic/.test(nocap![1]), "the undated register is set apart in style: " + nocap![1]);
  assert.ok(!/font-style:italic/.test(cap![1]), "and the dated one is not");
  assert.notEqual(/color:(#[0-9a-f]+)/.exec(cap![1])?.[1], /color:(#[0-9a-f]+)/.exec(nocap![1])?.[1], "and in colour");
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

// ── a job Muxin stopped (the UI half of the per-job "Stop it", PR #361) ──────────────────────────
// #361 shipped `stopped` as its own status, a POST /api/jobs/:id/stop route and the whole queue
// mechanic, with no UI at all. Every helper below fell through to its `running` default, so a job
// she had deliberately ended rendered as "Working", in the AI purple, under "Real elapsed time, not
// an estimate." — the screen claiming work was in flight that was not. Same class of defect as the
// Fiction scene bug in #359. These tests pin the honest rendering AND the client mirror of it.

import { STOPPED_FOOTER, jobStopOffered } from "./page.js";

test("a stopped job's rail says she ended it, in her own blue, never Working in the AI purple", () => {
  const rail = jobRailLabel(job({ status: "stopped" }));
  assert.equal(rail.text, "You stopped it");
  assert.equal(rail.color, JOB_COLORS.blue);
  assert.notEqual(rail.text, "Working");
  assert.notEqual(rail.color, JOB_COLORS.ai, "a stopped job is not working, so it must not wear the AI register");
  assert.notEqual(rail.color, JOB_COLORS.red, "she ended it; nothing broke");

  const strip = stripRailLabel(job({ status: "stopped" }));
  assert.equal(strip.text, "You stopped it");
  assert.equal(strip.color, JOB_COLORS.blue);
  assert.notEqual(strip.text, "Working now");
});

test("a stopped job's footer says she stopped it, and claims nothing about what reached disk", () => {
  assert.equal(jobFooter(job({ status: "stopped" })), STOPPED_FOOTER);
  assert.equal(stripFooter(job({ status: "stopped" })), STOPPED_FOOTER);
  assert.equal(STOPPED_FOOTER, "You stopped this one. It did not finish.");
  // Never the running heartbeat line, and never the failure line's "Nothing was written." — a job
  // killed mid-run may have written something, so that is a claim this screen cannot make.
  assert.ok(!STOPPED_FOOTER.includes("Real elapsed time, not an estimate."));
  assert.ok(!STOPPED_FOOTER.includes("Nothing was written"));
  // A stopped job carrying a stale heartbeat line must not render it as if it were still beating.
  assert.equal(jobFooter(job({ status: "stopped", lastStdoutLine: "reading the essay" })), STOPPED_FOOTER);
});

test("a stopped job's clock is the real measured elapsed, frozen, and says nothing when it never ran", () => {
  // finishedAt is set by stopJob, so jobElapsedMs freezes: this is measured, not a live tick.
  assert.equal(jobClockText(job({ status: "stopped", elapsedMs: 185_000 }), 0), "ran for 3m 5s");
  assert.equal(stripClockText(job({ status: "stopped", elapsedMs: 185_000 })), "ran for 3m 5s");
  // Stopped while still queued: startedAt is null, so there is no duration to render at all.
  assert.equal(jobClockText(job({ status: "stopped", elapsedMs: null }), 3), "not started");
  assert.equal(stripClockText(job({ status: "stopped", elapsedMs: null })), "not started");
  // Not the queue copy, not the done copy, not the failure copy.
  for (const text of [jobClockText(job({ status: "stopped", elapsedMs: 185_000 }), 3), stripClockText(job({ status: "stopped", elapsedMs: 185_000 }))]) {
    assert.ok(!text.includes("ahead of it"));
    assert.ok(!text.startsWith("took"));
    assert.ok(!text.startsWith("stopped after"));
  }
});

test("a stopped job's log line names no artifact path, because it may not have written one", () => {
  const line = jobLogLine(job({ status: "stopped", logPath: "/logs/j1.log" }));
  assert.equal(line, "> stopped, you ended it");
  assert.ok(!line.includes("/logs/j1.log"), "a stopped run must not claim it wrote anywhere");
  assert.ok(!line.includes("reading"), "nothing is being read any more");
});

test("a stopped job's room link neither promises motion nor promises an artifact", () => {
  assert.equal(jobOpenLabel(job({ status: "stopped", kind: "url" })), "Open Content");
  assert.equal(jobOpenLabel(job({ status: "stopped", kind: "fiction-draft" })), "Open Fiction");
  assert.ok(!jobOpenLabel(job({ status: "stopped" })).includes("Watch it"));
  assert.ok(!jobOpenLabel(job({ status: "stopped" })).includes("Read it"));
});

test("a stopped job's steps show what finished and nothing in flight", () => {
  const dots = jobStepDots(job({ status: "stopped", steps: ["pull", "draft", "score", "write"], step: 2 }));
  assert.deepEqual(dots.map((d) => d.state), ["done", "done", "pending", "pending"]);
  assert.ok(!dots.some((d) => d.state === "current"), "nothing is in flight, so no dot pulses in the AI purple");
  assert.ok(!dots.some((d) => d.state === "failed"), "she stopped it; no step broke");
  assert.ok(!dots.map((d) => dotColor(d.state)).includes(JOB_COLORS.ai));
});

test("a stopped job is settled: it stops holding the team rail and stops asking for anything", () => {
  assert.equal(jobSettled(job({ status: "stopped" })), true);
  assert.equal(jobAwaitingAnswer(job({ status: "stopped" })), false);
  // The Studio team rail lists live work only. A job she ended is not live work.
  assert.deepEqual(teamLiveRows([job({ id: "a", status: "stopped" })]), []);
  assert.equal(teamRailHeader([job({ status: "stopped" })]), "YOUR TEAM, IDLE");
  // `failed` is still deliberately unsettled: it holds its strip until she has seen it.
  assert.equal(jobSettled(job({ status: "failed" })), false);
});

test("a stopped job holds its room strip only for the linger, then the strip goes away", () => {
  const now = 1_000_000;
  const stopped = job({ id: "s1", kind: "url", status: "stopped", finishedAt: now - 1000 });
  assert.equal(stripJobFor([stopped], "Content", now)?.id, "s1", "just-stopped work still shows what happened");
  const old = job({ id: "s2", kind: "url", status: "stopped", finishedAt: now - (STRIP_LINGER_MS + 1) });
  assert.equal(stripJobFor([old], "Content", now), null, "it is settled, so it does not hold the strip open");
});

test("Stop is offered on queued and running work only, never on anything already settled", () => {
  assert.equal(jobStopOffered(job({ status: "queued" })), true);
  assert.equal(jobStopOffered(job({ status: "running" })), true);
  for (const status of ["done", "failed", "stopped"]) {
    assert.equal(jobStopOffered(job({ status })), false, status + " has already settled; the route would no-op");
  }
  // Blocked is settled too, and stopping it would throw away a question she has not answered.
  assert.equal(jobStopOffered(job({ status: "blocked", ask: { question: "which cut?", options: ["a", "b"] } })), false);
  assert.equal(jobStopOffered(job({ status: "blocked", answer: "a" })), false);
});

test("storyboardJobDone: a stopped video job is resolved, so the generating hint clears", () => {
  const jobs = [{ kind: "video", slugs: ["my-slug"], status: "stopped" }];
  assert.equal(storyboardJobDone(jobs, "my-slug"), true);
  assert.equal(storyboardJobDone([...jobs, { kind: "video", slugs: ["my-slug"], status: "running" }], "my-slug"), false);
});

// ── the client mirror (Rule 5) ───────────────────────────────────────────────────────────────────
// Every branch above exists twice: exported for these tests, and again inline in the browser
// <script>. Fixing only the export would leave the browser rendering "Working" for a stopped job
// and go green without these. That exact failure is why #359 needed two tests, not one.

function clientScript(): string {
  const html = renderPage({ repoRoot: process.cwd(), isDevWorktree: false });
  return html.slice(html.indexOf("<script>"), html.lastIndexOf("</script>"));
}

test("client mirror: the stopped branch ships in the browser script, on both job surfaces", () => {
  const script = clientScript();
  const twice = (needle: string) => script.split(needle).length - 1;
  // rail: the Studio panel's jobRail and the room strip's stripRail
  assert.equal(twice('if(j.status==="stopped") return {text:"You stopped it", color:JC.blue};'), 2);
  // clock: jobClock and stripClock, both frozen on the measured elapsedMs
  assert.equal(twice('if(j.status==="stopped") return j.elapsedMs==null ? "not started" : "ran for "+jobElapsedText(j.elapsedMs);'), 2);
  // footer: jobFooter and stripFooter, off one constant
  assert.ok(script.includes('const STOPPED_FOOTER = "You stopped this one. It did not finish.";'));
  assert.equal(twice('if(j.status==="stopped") return STOPPED_FOOTER;'), 2);
  // log line, room link, step dots
  assert.ok(script.includes('if(j.status==="stopped") return "> stopped, you ended it";'));
  assert.ok(script.includes('if(j.status==="stopped") return "Open " + jobRoom(j.kind);'));
  assert.ok(script.includes('if(j.status==="stopped") return steps.map((t,i)=>({text:t,state: i<step?"done":"pending"}));'));
  // settled, the Stop predicate, and the sweep set that matches jobIsSweepable in jobs.ts
  assert.ok(script.includes('function jobSettled(j){ return j.status==="done" || j.status==="stopped" || (j.status==="blocked" && !!j.answer); }'));
  assert.ok(script.includes('function jobStopOffered(j){ return j.status==="queued" || j.status==="running"; }'));
  assert.ok(script.includes('JOBS.some(j=>j.status==="done"||j.status==="failed"||j.status==="stopped")'));
  assert.ok(script.includes('forSlug.every(j=>j.status==="done"||j.status==="failed"||j.status==="stopped")'));
});

test("client mirror: the Stop control and its route reach the browser, on both surfaces", () => {
  const script = clientScript();
  assert.ok(script.includes("function stopBtnHtml(j)"), "the button must be built from jobStopOffered, not from a status test inline");
  assert.ok(script.includes('jobStopOffered(j) ? \'<button class="jstop" data-id="\'+esc(j.id)+\'">Stop it</button>\' : ""'));
  assert.ok(script.includes("async function stopJob(id)"), "the handler must reach the browser");
  assert.ok(script.includes('"/api/jobs/"+encodeURIComponent(id)+"/stop"'), "Stop must post to the stop route");
  // Wired on the Studio working panel AND on the room strip: a job running while she is inside a
  // room has no other surface on that screen.
  assert.equal(script.split('querySelectorAll("button.jstop")').length - 1, 2);
});

test("client mirror: Retry is never offered for a stopped job", () => {
  const script = clientScript();
  const box = script.slice(script.indexOf("function askBoxHtml(j)"), script.indexOf("function renderJobs()"));
  assert.ok(box.includes('class="jretry"'), "the retry button lives in the failure box");
  assert.ok(box.indexOf('if(j.status==="failed")') < box.indexOf('class="jretry"'), "and only inside the failed branch");
  assert.ok(!box.includes('"stopped"'), "the ask/failure box must not render for a stopped job at all");
  // Two independent refusals in jobs.ts back this: stopJob forces retryable=false, and retryJob
  // refuses anything that is not `failed`. The UI must not offer what the backend will refuse.
  assert.equal(script.split('class="jretry"').length - 1, 1, "exactly one place builds a Retry button");
});

test("stopJob claims nothing when the job had already settled", async () => {
  const script = clientScript();
  const start = script.indexOf("async function stopJob(id){");
  const src = script.slice(start, script.indexOf("\n}", start) + 2);
  const flashed: string[] = [];
  const reloads: number[] = [];
  const make = (response: Record<string, unknown>) =>
    new Function("post", "flash", "loadJobs", src + "\nreturn stopJob;")(
      async () => response,
      (m: string) => flashed.push(m),
      () => reloads.push(1),
    ) as (id: string) => Promise<void>;

  await make({ ok: true, status: "running", stopped: true })("j1");
  assert.equal(flashed[0], "Stopping it.");
  // The route answers the moment SIGTERM goes out, so its `status` is not final. The toast must not
  // quote it, and the poll must re-read.
  assert.ok(!flashed[0].includes("running"));
  assert.equal(reloads.length, 1);

  flashed.length = 0;
  await make({ ok: true, status: "done", stopped: false })("j1");
  assert.equal(flashed[0], "Too late, it had already stopped on its own.");
  assert.ok(!/stopped it\.$/i.test(flashed[0]), "an already-settled stop must not read as success");

  flashed.length = 0;
  await make({ ok: false, error: "no such job" })("j1");
  assert.equal(flashed[0], "no such job");
  assert.equal(reloads.length, 2, "a failed stop must not trigger a reload as if something changed");
});

// ── Studio capture: the classifier, its mirror, and the bare-link ask ────────────────────────────
// The capture box moved from the Content room to the top of Studio, and grew a classifier that
// picks a room. Three things must hold, and each has bitten this file before:
//   - the rule itself, including precedence (first match wins, and the order is load-bearing);
//   - the inline browser copy behaving IDENTICALLY to the export (Rule 5 — fixing one and
//     forgetting the other went green twice);
//   - the dispatch never claiming to start work that has no route behind it.

type CaptureFn = (t: string) => { kind: string; room?: string; url?: string };
type VerdictFn = (room: string) => { room: string; line: string; actionLabel: string | null };

// Pulls the client's own copy of the two helpers back out of the emitted <script> and evaluates it.
// String-presence would pass on a mangled regex (`\s` emitted as `s`, `\/` emitted as `/` opening a
// line comment); running the extracted code cannot.
function captureMirror(): { classifyCapture: CaptureFn; captureVerdict: VerdictFn } {
  const script = emittedScripts().join("\n");
  const start = script.indexOf("const BARE_URL_RE");
  const end = script.indexOf("// ── end of the capture mirror ──");
  assert.ok(start > -1, "the inline classifyCapture mirror must reach the browser");
  assert.ok(end > start, "the capture mirror's end marker must follow it");
  const src = script.slice(start, end);
  return new Function(src + "\nreturn { classifyCapture: classifyCapture, captureVerdict: captureVerdict };")() as {
    classifyCapture: CaptureFn; captureVerdict: VerdictFn;
  };
}

// [text, expected room]. The precedence cases are the point: each one matches more than one rule.
const CAPTURE_ROOM_VECTORS: [string, string][] = [
  ["follow up with Jamie R. about the pitch", "Outreach"],
  ["met Dana at the meetup, she runs the fund", "Outreach"],
  ["reply to https://someplace.com", "Outreach"],       // a keyword beats the bare-URL branch
  ["intro to plotting", "Outreach"],                     // rule 1 beats Fiction's "plot"
  ["email the scene to my editor", "Outreach"],          // rule 1 beats Fiction's "scene"
  ["chapter 4 needs a colder open", "Fiction"],
  ["elias finally says it out loud", "Fiction"],
  ["a scene where the offer lands badly", "Fiction"],    // rule 2 beats Venture's "offer"
  ["what should the price be", "Venture"],
  ["survey answers are coming in faster than I thought", "Venture"],
  ["a thought about how atomization actually scales", "Content"],
  ["I read https://example.com/post today and it stuck with me", "Content"], // a link inside a sentence
  ["foo.xyz", "Content"],                                // a TLD the bare-link rule does not accept
];

const CAPTURE_ASK_VECTORS = [
  "https://example.com",
  "www.someone.ai",
  "example.substack.com/p/a-thing",
  "  https://foo.org  ",
  "http://localhost.dev/x?y=1",
];

test("classifyCapture: five branches, first match wins, and the order is load-bearing", () => {
  for (const [text, room] of CAPTURE_ROOM_VECTORS) {
    const v = classifyCapture(text);
    assert.equal(v.kind, "room", text);
    assert.equal((v as { room: string }).room, room, text);
  }
});

test("classifyCapture: a bare link is a question, never a room", () => {
  for (const text of CAPTURE_ASK_VECTORS) {
    const v = classifyCapture(text);
    assert.equal(v.kind, "ask-link", text);
    assert.equal((v as { url: string }).url, text.trim(), "the ask carries the trimmed link");
  }
  // Muxin's decision, recorded so nobody re-litigates it from the v5 handoff's match table (which
  // sent anything containing http / .com / .ai / .org straight to Signals): the app asks.
  assert.notEqual(classifyCapture("https://example.com").kind, "room");
});

test("classifyCapture: empty text classifies as empty, not as Content", () => {
  for (const t of ["", "   ", "\n\t "]) assert.equal(classifyCapture(t).kind, "empty", JSON.stringify(t));
});

test("captureHandoffSummary: a saved capture is an explicit next action in its owning room", async () => {
  const { captureHandoffSummary } = await import("./page.js") as unknown as {
    captureHandoffSummary?: (capture: { room: string; text: string } | null) => unknown;
  };
  assert.equal(typeof captureHandoffSummary, "function");
  if (!captureHandoffSummary) return;
  const summary = captureHandoffSummary({ room: "Fiction", text: "Elias finally tells the truth." });
  assert.deepEqual(summary, {
    room: "fiction",
    label: "Fiction",
    text: "Capture waiting in Fiction.",
    detail: "Elias finally tells the truth.",
    action: "Open",
  });
  assert.equal(captureHandoffSummary(null), null);
});

test("classifyCapture mirror: the browser copy answers identically on every vector (Rule 5)", () => {
  const mirror = captureMirror().classifyCapture;
  for (const [text, room] of CAPTURE_ROOM_VECTORS) {
    assert.deepEqual(mirror(text), classifyCapture(text), text);
    assert.equal(mirror(text).room, room, text);
  }
  for (const text of CAPTURE_ASK_VECTORS) {
    assert.deepEqual(mirror(text), classifyCapture(text), text);
    assert.equal(mirror(text).kind, "ask-link", text);
  }
  for (const t of ["", "   "]) assert.deepEqual(mirror(t), classifyCapture(t));
});

test("durable capture verdict: every routed capture names the room it chose, and its browser mirror agrees", () => {
  const mirror = captureMirror().captureVerdict;
  for (const room of ["Content", "Fiction", "Outreach", "Venture"] as const) {
    const v = captureHandoffVerdict(room);
    assert.ok(v.line.includes(room), "the verdict must name the room it picked: " + room);
    assert.deepEqual(mirror(room), v, "the browser copy of captureVerdict must match: " + room);
  }
  for (const room of ["Fiction", "Outreach", "Venture"] as const) {
    assert.ok(captureHandoffVerdict(room).line.includes("choose the next action"));
  }
  assert.equal(captureHandoffVerdict("Content").actionLabel, null);
  assert.equal(captureHandoffVerdict("Fiction").actionLabel, "Keep it in Fiction");
});

test("Studio capture: the rendered durable-handoff verdict makes no stale routing promise", () => {
  const html = renderPage({ repoRoot: process.cwd(), isDevWorktree: false });
  const script = emittedScripts().join("\n");
  for (const line of [
    "I read this as Fiction. Keep it in Fiction as a capture, then choose the next action there.",
    "I read this as Outreach. Keep it in Outreach as a capture, then choose the next action there.",
    "I read this as Venture. Keep it in Venture as a capture, then choose the next action there.",
  ]) assert.ok(script.includes(JSON.stringify(line)), line);
  for (const stale of [
    "I can put it in the composer as your beats",
    "Your words stay in the box.",
    "files a backlog card",
    "Same route as \"Hand it to your director\"",
  ]) {
    assert.ok(!html.includes(stale), "stale rendered promise: " + stale);
    assert.ok(!script.includes(stale), "stale client promise: " + stale);
  }
  assert.ok(script.includes('localStorage.setItem(CAPTURE_HANDOFF_KEY'), "a verdict is saved as a durable handoff");
  assert.ok(script.includes("Nothing was submitted or started."), "the handoff waits for an explicit next action");
});

test("Studio capture: the box moved out of the Content room and into Studio", () => {
  const html = renderPage({ repoRoot: process.cwd(), isDevWorktree: false });
  const studio = html.slice(html.indexOf('id="roomStudio"'), html.indexOf('id="roomFiction"'));
  const content = html.slice(html.indexOf('id="roomContent"'), html.indexOf('id="roomStudio"'));
  for (const id of ['id="src"', 'id="captureTitle"', 'id="devStartBtn"', 'id="addBtn"', 'id="notesBtn"', 'id="notesPanel"', 'id="routeBtn"']) {
    assert.ok(studio.includes(id), id + " must live in the Studio room now");
    assert.ok(!content.includes(id), id + " must no longer be in the Content room");
  }
  // The notes browser came with it, so its copy must not still point "below" at a sheet that is
  // now in a different room.
  assert.ok(studio.includes("waits for your yes in the Content room"));
  assert.ok(!html.includes("every draft still waits for your yes below"));
  // The promo bridge fills #src, so it has to land in the room #src is in.
  const script = emittedScripts().join("\n");
  assert.ok(script.includes('setRoom("studio"); // the capture box lives in Studio now'));
});

test("the bare-link ask: three controls, the honest explainer, and the honest Signals copy", () => {
  const html = renderPage({ repoRoot: process.cwd(), isDevWorktree: false });
  assert.ok(html.includes(LINK_ASK_HEADING), "the ask must be headed " + LINK_ASK_HEADING);
  assert.ok(html.includes("Versions for Content"), "the default-weighted button");
  assert.ok(html.includes("Source for Signals"), "the filing button");
  assert.ok(html.includes("Never mind, clear it"), "the cancel");
  assert.ok(html.includes(LINK_ASK_EXPLAINER), "the explainer ships verbatim");
  // Signals has no ingest for "a URL a reader came from". This durable handoff must not claim
  // that it files a backlog card or measures attribution.
  const signalsHandoffNote = "Source for Signals keeps it in Signals for your next action. Nothing here records where a reader came from, so this is a note to look at later, not attribution.";
  assert.equal(LINK_ASK_SIGNALS_NOTE, signalsHandoffNote, "the page export must match the rendered durable behavior");
  assert.ok(html.includes(LINK_ASK_SIGNALS_NOTE), "the Signals button must say what it actually does");
  assert.ok(LINK_ASK_SIGNALS_NOTE.includes("not attribution"));
  assert.ok(!LINK_ASK_SIGNALS_NOTE.includes("files a backlog card"));
  // The ask's own state: an amber rail and a dimmed, read-only textarea while it is open.
  assert.ok(html.includes(CAPTURE_RAIL_IDLE) && html.includes('id="captureRail"'));
  const script = emittedScripts().join("\n");
  assert.ok(script.includes(JSON.stringify(CAPTURE_RAIL_ASKING)), "the amber rail label must reach the browser");
  assert.ok(script.includes('ta.readOnly = true; ta.classList.add("dimmed");'));
});

// The capture section may only reach routes that exist. Outreach drafting needs a lead folder and
// Venture has no free-text entry, so a dispatch to either would be a claim this system cannot back.
test("Studio capture: the dispatch never posts to a route that cannot take free text", () => {
  const script = emittedScripts().join("\n");
  const start = script.indexOf("// ── Studio capture: one front door (v7 Studio)");
  const end = script.indexOf("// ── Substack Notes checklist");
  assert.ok(start > -1 && end > start, "the capture client section must be identifiable");
  const section = script.slice(start, end);
  const paths = [...new Set([...section.matchAll(/\/api\/[a-z0-9/-]+/g)].map((m) => m[0]))].sort();
  assert.deepEqual(paths, [], "a capture handoff must not call an API route");
  assert.ok(section.includes('localStorage.setItem(CAPTURE_HANDOFF_KEY'));
  assert.ok(section.includes('readCaptureHandoffs()'));
  assert.ok(section.includes('CAPTURE WAITING HERE'));
  assert.ok(section.includes('Choose the next action in this room. Nothing was submitted or started.'));
  for (const id of ["contentCaptureHandoff", "fictionCaptureHandoff", "outreachCaptureHandoff", "ventureCaptureHandoff", "signalsCaptureHandoff", "charlesCaptureHandoff"]) {
    assert.ok(section.includes(id), id + " must surface a pending capture in its owning room");
  }
  assert.ok(!/function takeCaptureTo[\s\S]*?post\(/.test(section), "routing a capture must never start work");
});

test("Studio capture copy: no em dashes, and nothing claims a job was started", () => {
  const strings = [
    CAPTURE_RAIL_IDLE, CAPTURE_RAIL_ASKING, LINK_ASK_HEADING, LINK_ASK_EXPLAINER, LINK_ASK_SIGNALS_NOTE,
    ...(["Content", "Fiction", "Outreach", "Venture"] as const).map((r) => captureVerdict(r).line),
  ];
  for (const s of strings) assert.ok(!s.includes("—"), "em dash in capture copy: " + s);
  for (const r of ["Outreach", "Venture"] as const) {
    assert.ok(/cannot start/.test(captureVerdict(r).line), r + " must say plainly that it cannot start one");
  }
});

test("Studio director copy: the visible attribution uses punctuation allowed by the voice rules", () => {
  const html = renderPage({ repoRoot, isDevWorktree: false });
  const studio = html.slice(html.indexOf('<section class="view" id="roomStudio"'), html.indexOf('<section class="view" id="roomFiction"'));
  assert.ok(studio.includes("Your director."));
  assert.ok(!studio.includes("— your director"));
});

test("ventureMultiPickIds: toggles choices but never lets the client exceed requiredCount", () => {
  assert.deepEqual(ventureMultiPickIds(3, [], "a"), ["a"]);
  assert.deepEqual(ventureMultiPickIds(3, ["a", "b"], "c"), ["a", "b", "c"]);
  assert.deepEqual(ventureMultiPickIds(3, ["a", "b", "c"], "d"), ["a", "b", "c"]);
  assert.deepEqual(ventureMultiPickIds(3, ["a", "b", "c"], "b"), ["a", "c"]);
  assert.deepEqual(ventureMultiPickIds(3, ["a", "a"], "b"), ["a", "b"]);
});

test("Venture multi-pick markup: the UI submits the server-required set and keeps the refusal path", () => {
  const html = renderPage({ repoRoot, isDevWorktree: false });
  const script = emittedScripts().join("\n");
  assert.ok(script.includes("function vMultiSubmit(choice)"));
  assert.ok(script.includes('candidateIds:ids'), "the submit payload must be the selected set");
  assert.ok(script.includes('data-vmulti-submit="'), "the choice panel needs a submit action");
  assert.ok(script.includes("The server still checks the count, override reason, and whether this decision is already immutable."));
  assert.ok(html.includes("LEDGER / HISTORY"), "the Venture room needs a visible history area");
  assert.ok(html.includes("Earlier artifacts and live records appear here when the server exposes them."));
});

test("followupDraftRequest: selected engine is sent, with Claude preserved as the fallback", () => {
  assert.deepEqual(followupDraftRequest("outreach/leads/acme", "Rae", "grok"), {
    dir: "outreach/leads/acme", recipient: "Rae", engine: "grok",
  });
  assert.deepEqual(followupDraftRequest("outreach/leads/acme"), {
    dir: "outreach/leads/acme", engine: "claude",
  });
  const script = emittedScripts().join("\n");
  assert.ok(script.includes('class="fu-draft-control"'), "the Follow-ups action needs a picker wrapper");
  assert.ok(script.includes('post("/api/followups/draft-follow-up", followupDraftRequest(dir, person, engine))'));
  assert.ok(script.includes('engine:engine || "claude"'), "missing selector keeps the old Claude default");
});

test("Outreach directed drafts and revisions expose one engine picker and send its value", () => {
  assert.deepEqual(outreachDraftRequest("leads/acme", "keep it warm", "Rae", "grok"), {
    dir: "leads/acme", direction: "keep it warm", recipient: "Rae", engine: "grok",
  });
  assert.deepEqual(outreachMessageReviseRequest("leads/acme", "messages/1.md", "shorter", "codex"), {
    dir: "leads/acme", file: "messages/1.md", instruction: "shorter", engine: "codex",
  });
  assert.equal(outreachDraftRequest("leads/acme", "say hello").engine, "claude");
  assert.equal(outreachMessageReviseRequest("leads/acme", "messages/1.md", "warmer").engine, "claude");
  const script = emittedScripts().join("\n");
  assert.ok(script.includes('const outreachEngine = l.kind!=="content-example" ? engineSelectHtml() : "";'), "the Outreach thread needs an engine picker");
  assert.ok(!script.includes('engineSelectHtml("outreachEngine")'), "Outreach must not emit duplicate selector ids");
  assert.ok(script.includes('querySelector(".engine-select")'), "Outreach actions must read the thread-local picker");
  assert.ok(script.includes('outreachDraftRequest(dir, direction, recipient, engine)'), "directed drafts must build an engine-aware request");
  assert.ok(script.includes('post("/api/outreach/draft", outreachDraftRequest(dir, direction, recipient, engine))'));
  assert.ok(script.includes('outreachMessageReviseRequest(dir, file, instruction, engine)'), "message revisions must build an engine-aware request");
  assert.ok(script.includes('post("/api/outreach/message/revise", outreachMessageReviseRequest(dir, file, instruction, engine))'));
  assert.ok(script.includes('engine:engine || "claude"'), "Outreach keeps Claude when no selector is available");
});

test("Notes picker sends the selected engine", () => {
  assert.deepEqual(notesPickRequest([1, 3], "grok"), { indices: [1, 3], engine: "grok" });
  assert.deepEqual(notesPickRequest([2]), { indices: [2], engine: "claude" });
  const script = emittedScripts().join("\n");
  assert.ok(script.includes('post("/api/notes/pick", notesPickRequest(indices, $("#studioEngine").value))'));
});

test("Content workbench actions expose local engine selectors and use them", () => {
  const html = renderPage({ repoRoot, isDevWorktree: false });
  const script = emittedScripts().join("\n");
  assert.ok(html.includes('class="wb-reply"'), "each workbench reply action needs its own control group");
  assert.ok(html.includes('class="wb-handoff"'), "each workbench handoff needs its own control group");
  assert.ok(script.includes('refreshEngineControls(box);'), "rebuilt workbench selectors must receive engine availability state");
  assert.ok(script.includes('t.closest(".wb-reply")?.querySelector(".engine-select")'));
  assert.ok(script.includes('t.closest(".wb-handoff")?.querySelector(".engine-select")'));
  assert.ok(!script.includes('post("/api/develop/reply", {slug, reply, engine:$("#studioEngine").value})'));
  assert.ok(!script.includes('post("/api/develop/format", {slug, lenses, engine:$("#studioEngine").value})'));
});

test("Fiction drafting and second passes expose a local engine selector and send it", () => {
  const script = emittedScripts().join("\n");
  assert.ok(script.includes('post("/api/fiction/draft",{series:ficSeries, beats:t, engine})'));
  assert.ok(script.includes('post("/api/fiction/repass",{series:ficSeries, chapter:chapter.number, note:note, engine})'));
  assert.ok(script.includes('const engine = draftBtn.closest("div")?.querySelector(".engine-select")?.value || "claude";'));
  assert.ok(script.includes('const engine = passBtn.closest("div")?.querySelector(".engine-select")?.value || "claude";'));
  assert.ok(script.includes('refreshEngineControls($("#fictionMain"));'));
});

test("Studio polish keeps engine choices, capture submits, and room loads understandable", () => {
  const script = emittedScripts().join("\n");
  assert.ok(script.includes('content-agents-preferred-engine'), "engine preference should survive a reload");
  assert.ok(script.includes('Claude · Writing') && script.includes('Grok · Ideation') && script.includes('GPT (Codex) · Analysis'),
    "engine options should explain their strengths inline");
  assert.ok(script.includes("captureSubmitting"), "capture handoffs need one shared in-flight guard");
  assert.ok(script.includes('showRoomLoading("workbench")') && script.includes('showRoomLoading("outreachList")') && script.includes('showRoomLoading("ventureThread")'),
    "the three async rooms should expose a loading state");
  assert.ok(script.includes('post("/api/fiction/check",{series:ficSeries, chapter:chapter.number, engine})'),
    "the canon check must send the selected engine");
});

test("Venture run-step control: queues one selected-engine draft step at the current phase", () => {
  const html = renderPage({ repoRoot, isDevWorktree: false });
  const script = emittedScripts().join("\n");
  assert.ok(html.includes('id="ventureRunStepBtn"'), "Venture needs a phase-run action");
  assert.ok(html.includes("Run the next draft step"));
  assert.ok(html.includes("stops at the next human gate"), "the action must preserve the human gate");
  assert.ok(script.includes('post("/api/venture/"+encodeURIComponent(ventureSlug)+"/run-step", {engine, phase:VENTURE_THREAD.phase})'));
  assert.ok(script.includes("function runVentureStep()"));
});

// The desk boots into Studio (Muxin, 2026-08-23), because the capture box is there now and booting
// into Content would open on a screen with no way to capture a thought. Three places have to agree,
// and the first paint has to actually fetch what that room shows.
test("boot room: Studio, with the nav highlight, currentTab and the first fetch all agreeing", () => {
  assert.equal(BOOT_ROOM, "studio");
  const html = renderPage({ repoRoot: process.cwd(), isDevWorktree: false });
  const onButtons = [...html.matchAll(/<button class="room on" data-room="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(onButtons, [BOOT_ROOM], "exactly one nav room may rest highlighted, and it is the boot room");
  const script = emittedScripts().join("\n");
  assert.ok(script.includes('let currentTab = "' + BOOT_ROOM + '";'), "currentTab must start on the boot room");
  // Anchored at the boot call site itself: `setRoom("content")` is still legitimate elsewhere, as
  // the Studio needs-you rows' click-through into the Content room.
  assert.ok(
    script.includes('setRoom("' + BOOT_ROOM + '");\n// The desk header'),
    "the boot setRoom must name the boot room",
  );
  // setRoom(boot) fires the room's own reads, but "last refreshed" is stamped off this list, and an
  // unfetched Studio first-paints as "Loading…". Both Studio reads have to be in it.
  const boot = script.slice(script.indexOf("Promise.all(["), script.indexOf("finally(markRefreshed)"));
  for (const fn of ["loadStudio()", "loadJobs()"]) {
    assert.ok(boot.includes(fn), fn + " must be part of the first paint now that Studio is the boot room");
  }
  // The Content pending badge lives in the header rail, so its read still runs at boot.
  assert.ok(boot.includes("load()"), "the pending-count badge's read must still run at boot");
});


// ── Signals: the four outcome families ──────────────────────────────────────────────────────────
//
// Rule 5's strong form: every vector is answered twice, once by the export and once by the copy
// the browser actually gets, sliced out of the emitted <script> and evaluated. A test that only
// exercised the export would go green while the browser kept a bug.

type SignalsMirror = {
  groupDigits: typeof groupDigits;
  metricLine: typeof metricLine;
  sampleNote: typeof sampleNote;
  familyGate: typeof familyGate;
};

function signalsMirror(): SignalsMirror {
  const script = emittedScripts().join("\n");
  const start = script.indexOf("// ── begin the signals mirror ──");
  const end = script.indexOf("// ── end of the signals mirror ──");
  assert.ok(start > -1, "the inline signals mirror must reach the browser");
  assert.ok(end > start, "the signals mirror's end marker must follow it");
  return new Function(
    script.slice(start, end) + "\nreturn { groupDigits, metricLine, sampleNote, familyGate };"
  )() as SignalsMirror;
}

const METRIC_VECTORS: MetricReadView[] = [
  { state: "measured", value: 4180, records_measured: 12, records_unmeasured: 0 },
  { state: "measured", value: 0, records_measured: 12, records_unmeasured: 0 },   // a MEASURED zero
  { state: "measured", value: 0, records_measured: 0, records_unmeasured: 11 },   // a sum over nothing
  { state: "measured", value: 7, records_measured: 1, records_unmeasured: 1 },    // singular wording
  { state: "measured", value: -3, records_measured: 2, records_unmeasured: 0 },   // a negative delta
  { state: "measured", value: 1234567, records_measured: 9, records_unmeasured: 2 },
  { state: "not_measured", reason: "the metrics table has no saves column" },
];

test("metricLine: measured, measured-as-zero and never-measured are three different cells", () => {
  const real = metricLine(METRIC_VECTORS[0]);
  const zero = metricLine(METRIC_VECTORS[1]);
  const nothing = metricLine(METRIC_VECTORS[2]);
  const absent = metricLine(METRIC_VECTORS[6]);

  assert.equal(real.value, "4,180");
  assert.equal(real.tone, "ink");

  // measured-as-zero prints the zero AND says how many posts it was measured on
  assert.equal(zero.value, "0");
  assert.match(zero.note, /measured on 12 records/);
  assert.equal(zero.tone, "ink");

  // a sum over no posts is not the same claim, and is not toned like a measurement
  assert.equal(nothing.value, "0");
  assert.match(nothing.note, /sum over nothing/);
  assert.equal(nothing.tone, "grey");
  assert.notEqual(nothing.note, zero.note);

  // never measured renders its reason and NEVER a number, a zero, or a bare dash
  assert.equal(absent.value, "not measured");
  assert.equal(absent.note, "the metrics table has no saves column");
  assert.equal(absent.tone, "grey");
  assert.ok(!/^[-–—]?\d*$/.test(absent.value), "an unmeasured cell must not read as a number or a dash");
});

test("metricLine: the browser copy answers every vector identically", () => {
  const mirror = signalsMirror().metricLine;
  for (const v of METRIC_VECTORS) assert.deepEqual(mirror(v), metricLine(v), JSON.stringify(v));
});

// The `posts_measured`/`posts_unmeasured` -> `records_measured`/`records_unmeasured` rename (PR
// #376 documented the mismatch at the declaration and deferred it until page.ts was free). It was
// a rename and nothing else, so these are the exact sentences the screen shipped before it, pinned
// byte for byte: if a later change to the field names moves a word, this is what says so.
test("metricLine: the rename left every rendered sentence byte-identical", () => {
  assert.deepEqual(metricLine({ state: "measured", value: 4180, records_measured: 12, records_unmeasured: 0 }), {
    value: "4,180",
    note: "measured on 12 records",
    tone: "ink",
  });
  assert.deepEqual(metricLine({ state: "measured", value: 7, records_measured: 1, records_unmeasured: 1 }), {
    value: "7",
    note: "measured on 1 record, 1 record carried no number",
    tone: "ink",
  });
  assert.deepEqual(metricLine({ state: "measured", value: 1234567, records_measured: 9, records_unmeasured: 2 }), {
    value: "1,234,567",
    note: "measured on 9 records, 2 records carried no number",
    tone: "ink",
  });
  assert.deepEqual(metricLine({ state: "measured", value: 0, records_measured: 0, records_unmeasured: 11 }), {
    value: "0",
    note: "no record carried this number, so this is a sum over nothing rather than a measured zero",
    tone: "grey",
  });
});

test("groupDigits: grouping is written out, not left to a locale, and both copies agree", () => {
  const mirror = signalsMirror().groupDigits;
  for (const n of [0, 7, 999, 1000, 4180, 1234567, -3, -1234, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(mirror(n), groupDigits(n), String(n));
  }
  assert.equal(groupDigits(1234567), "1,234,567");
  assert.equal(groupDigits(-1234), "-1,234");
});

const RULE = { kind: "weeks_of_data", threshold_weeks: 4, source: "the repo's own INSUFFICIENT rule" };
const CONF_VECTORS: { platform: string; posts: number; weeks: number; status: string; sufficient: boolean }[][] = [
  [],
  [{ platform: "x", posts: 3, weeks: 1, status: "INSUFFICIENT", sufficient: false }],
  [{ platform: "x", posts: 30, weeks: 9, status: "OK", sufficient: true }],
  [
    { platform: "x", posts: 30, weeks: 9, status: "OK", sufficient: true },
    { platform: "bluesky", posts: 3, weeks: 1, status: "INSUFFICIENT", sufficient: false },
  ],
];

test("sampleNote: no posts on record reads as 'nothing measured yet', never as four zeros", () => {
  assert.match(sampleNote([], RULE), /No posts on record/);
  assert.match(sampleNote(CONF_VECTORS[1], RULE), /None of the 1 platform on record clears 4 weeks/);
  assert.match(sampleNote(CONF_VECTORS[2], RULE), /All 1 platform on record clear/);
  assert.match(sampleNote(CONF_VECTORS[3], RULE), /1 of 2 platforms on record clear 4 weeks/);
  // the threshold is whatever the read handed over, never a number typed into the page
  assert.match(sampleNote(CONF_VECTORS[3], { ...RULE, threshold_weeks: 1 }), /1 week of data/);
});

test("sampleNote and familyGate: the browser copies answer identically", () => {
  const m = signalsMirror();
  for (const conf of CONF_VECTORS) {
    for (const weeks of [1, 4, 12]) {
      const rule = { ...RULE, threshold_weeks: weeks };
      assert.equal(m.sampleNote(conf, rule), sampleNote(conf, rule), JSON.stringify([conf.length, weeks]));
    }
  }
  for (const f of ["attention", "conversation", "audience", "business"] as const) {
    assert.deepEqual(m.familyGate(f), familyGate(f), f);
  }
});

test("familyGate: only attention and conversation may feed a suppression call", () => {
  for (const f of ["attention", "conversation"] as const) {
    assert.match(familyGate(f).text, /MAY INFORM/);
  }
  for (const f of ["audience", "business"] as const) {
    assert.match(familyGate(f).text, /NEVER USED TO SUPPRESS/);
  }
});

test("the Signals screen calls both new reads and renders no prototype fixture number", () => {
  const script = emittedScripts().join("\n");
  assert.ok(script.includes('fetch("/api/signals/outcomes")'), "the outcome families must be fetched");
  assert.ok(script.includes('fetch("/api/research/report")'), "the research read must be fetched");
  // The prototype's Signals numbers and thresholds have no source in this repo (port rules, Rule 2).
  for (const n of ["4,180", "trending up", "home base", "still testing"]) {
    assert.ok(!script.includes(n), "the page must not carry the prototype's fixture value " + n);
  }
});

// ── Content: the treatment grid ─────────────────────────────────────────────────────────────────

type TreatmentMirror = {
  fitLine: typeof fitLine;
  floorNote: typeof floorNote;
  reuseLine: typeof reuseLine;
  readsFromCells: typeof readsFromCells;
};

function treatmentMirror(): TreatmentMirror {
  const script = emittedScripts().join("\n");
  // readsFromCells/reuseLine both call the browser's own fmtDays, so the slice needs it too. Taking
  // it out of the emitted script (rather than redefining it here) keeps the browser copy on trial.
  const fmtAt = script.indexOf("function fmtDays(n){");
  assert.ok(fmtAt > -1, "the browser needs its own fmtDays for the treatment mirror");
  const fmtSrc = script.slice(fmtAt, script.indexOf("\n", fmtAt));
  const start = script.indexOf("// ── begin the treatment mirror ──");
  const end = script.indexOf("// ── end of the treatment mirror ──");
  assert.ok(start > -1, "the inline treatment mirror must reach the browser");
  assert.ok(end > start, "the treatment mirror's end marker must follow it");
  return new Function(
    fmtSrc + "\n" + script.slice(start, end) + "\nreturn { fitLine, floorNote, reuseLine, readsFromCells };"
  )() as TreatmentMirror;
}

function chan(over: Partial<ChannelTreatmentView>): ChannelTreatmentView {
  return {
    channel: "x", decision: "include", recordedDecision: "include", score: null,
    fitLabel: null, fitBasis: "unknown", belowFloor: false,
    reuse: { key: "x", allowed: true, everPlaced: false, lastPlacedAt: null, daysSince: null, minDays: 14, reason: null },
    reuseNote: null, slot: { time: "t", label: "Tue 09:00 PT" },
    ...over,
  };
}

const CHANNEL_VECTORS: ChannelTreatmentView[] = [
  chan({ channel: "x", score: 1.4, fitLabel: "STRONG FIT", fitBasis: "measured" }),
  chan({ channel: "linkedin", score: 0.8, fitLabel: "REACH ONLY", fitBasis: "measured" }),
  chan({ channel: "threads", score: 0.42, fitLabel: "POOR FIT", fitBasis: "measured", belowFloor: true }),
  chan({ channel: "bluesky", fitLabel: "COLD START", fitBasis: "insufficient-data" }),
  chan({ channel: "mastodon", fitBasis: "editorial-rule", decision: "skip" }),
  chan({ channel: "quote-card", fitBasis: "format-asset", reuse: null, reuseNote: "enforced per fan-out target" }),
  chan({ channel: "x", fitBasis: "unknown", decision: null, recordedDecision: null }),
  chan({ channel: "linkedin", reuse: { key: "linkedin", allowed: false, everPlaced: true, lastPlacedAt: "x", daysSince: 12, minDays: 60, reason: "inside the window" } }),
  chan({ channel: "x", reuse: { key: "x", allowed: true, everPlaced: true, lastPlacedAt: "x", daysSince: 40, minDays: 14, reason: null } }),
  chan({ channel: "x", reuse: { key: "x", allowed: false, everPlaced: true, lastPlacedAt: "x", daysSince: null, minDays: 1, reason: null } }),
];

test("fitLine: a COLD START from no data never looks like a STRONG FIT from a measured score", () => {
  const strong = fitLine(CHANNEL_VECTORS[0], 0.6);
  const cold = fitLine(CHANNEL_VECTORS[3], 0.6);
  assert.equal(strong.label, "STRONG FIT");
  assert.equal(strong.tone, "green");
  assert.match(strong.basis, /measured, scoring 1\.4/);
  assert.equal(cold.label, "COLD START");
  assert.notEqual(cold.tone, strong.tone, "the two must not share a tone");
  assert.match(cold.basis, /not enough posts or weeks/);
  assert.ok(!/measured/.test(cold.basis), "a cold start must never claim a measurement");
});

test("fitLine: an unscored channel gets words, not one of the four verdicts", () => {
  const rule = fitLine(CHANNEL_VECTORS[4], 0.6);
  const asset = fitLine(CHANNEL_VECTORS[5], 0.6);
  const unknown = fitLine(CHANNEL_VECTORS[6], 0.6);
  const verdicts = ["STRONG FIT", "REACH ONLY", "POOR FIT", "COLD START"];
  for (const r of [rule, asset, unknown]) {
    assert.ok(!verdicts.includes(r.label), r.label + " must not be a fit verdict");
    assert.ok(r.basis.length > 0, "the label never renders bare");
    assert.equal(r.tone, "grey");
  }
  assert.equal(rule.label, "EDITORIAL RULE");
  assert.equal(asset.label, "ALWAYS GENERATED");
  assert.equal(unknown.label, "NOT SCORED");
});

test("fitLine: the configured floor is printed, never a literal typed into the page", () => {
  assert.match(fitLine(CHANNEL_VECTORS[1], 0.6).basis, /floor is 0\.6/);
  assert.match(fitLine(CHANNEL_VECTORS[1], 0.25).basis, /floor is 0\.25/);
});

test("floorNote: scoring under the floor is information, never an exclusion", () => {
  assert.equal(floorNote(CHANNEL_VECTORS[0], 0.6), "");
  const note = floorNote(CHANNEL_VECTORS[2], 0.6);
  assert.match(note, /stays on/);
  assert.match(note, /never skips a channel/);
});

test("reuseLine: every sentence names THIS channel's own window, never one global number", () => {
  const never = reuseLine(CHANNEL_VECTORS[0]);
  const held = reuseLine(CHANNEL_VECTORS[7]);
  const clear = reuseLine(CHANNEL_VECTORS[8]);
  const card = reuseLine(CHANNEL_VECTORS[5]);
  assert.match(never.text, /14 days/);
  assert.match(held.text, /60 days/);
  assert.equal(held.tone, "amber");
  assert.match(clear.text, /14 days/);
  assert.equal(clear.tone, "ink");
  assert.equal(card.text, "enforced per fan-out target");
  assert.equal(card.tone, "grey");
  // the prototype's single global "The window is 14 days" must not survive anywhere
  for (const v of CHANNEL_VECTORS) assert.ok(!/The window is 14 days/.test(reuseLine(v).text));
});

test("the treatment mirror answers every channel vector identically", () => {
  const m = treatmentMirror();
  for (const v of CHANNEL_VECTORS) {
    for (const floor of [0.6, 0.25]) {
      assert.deepEqual(m.fitLine(v, floor), fitLine(v, floor), v.channel + " @ " + floor);
      assert.equal(m.floorNote(v, floor), floorNote(v, floor), v.channel + " @ " + floor);
    }
    assert.deepEqual(m.reuseLine(v), reuseLine(v), v.channel);
  }
});

const TREATMENT_VECTORS: { t: TreatmentView; cuts: { lens: string; sourceLines?: (number | string)[] }[] }[] = [
  {
    t: { slug: "s", pillars: ["human-ai"], pillarSource: "routing.md", floor: 0.6,
         channels: [CHANNEL_VECTORS[0], CHANNEL_VECTORS[7]], scoredBelowFloorButEnabled: ["threads"] },
    cuts: [{ lens: "extract", sourceLines: [4, "9-11"] }],
  },
  {
    t: { slug: "s", pillars: [], pillarSource: "none", floor: 0.6,
         channels: [CHANNEL_VECTORS[6]], scoredBelowFloorButEnabled: [] },
    cuts: [],
  },
  {
    t: { slug: "s", pillars: ["civic-tech", "human-ai"], pillarSource: "routing.md", floor: 0.25,
         channels: [CHANNEL_VECTORS[0]], scoredBelowFloorButEnabled: ["threads", "mastodon"] },
    cuts: [{ lens: "a", sourceLines: [1] }, { lens: "b", sourceLines: [2] }, { lens: "c" }],
  },
];

test("readsFromCells: one channel and one cut read as singular, several read as plural", () => {
  const one = readsFromCells(TREATMENT_VECTORS[0].t, TREATMENT_VECTORS[0].cuts);
  const many = readsFromCells(TREATMENT_VECTORS[2].t, TREATMENT_VECTORS[2].cuts);
  assert.match(one[2].v, /threads scores under the floor of 0\.6 and stays on\./);
  assert.match(many[2].v, /threads, mastodon score under the floor of 0\.25 and stay on\./);
  assert.match(one[3].v, /The cut below carries the source lines it was built from,/);
  assert.match(many[3].v, /All 2 cuts below carry the source lines they were built from,/);
});

test("readsFromCells: four cells, each standing on a read rather than on the prototype's copy", () => {
  const [withPillar, noPillar] = TREATMENT_VECTORS.map((v) => readsFromCells(v.t, v.cuts));
  assert.equal(withPillar.length, 4);
  assert.deepEqual(withPillar.map((c) => c.k), ["PILLAR", "REUSE WINDOWS", "NOTHING SKIPPED", "YOUR WORDS"]);

  assert.match(withPillar[0].v, /human-ai, read from this piece's routing\.md/);
  // the held channel names ITS OWN window, and no global constant appears
  assert.match(withPillar[1].v, /60 days/);
  assert.ok(!/The window is 14 days/.test(withPillar[1].v));
  assert.match(withPillar[2].v, /floor of 0\.6/);
  assert.match(withPillar[2].v, /never skips a channel/);
  assert.match(withPillar[3].v, /Nothing composed/);

  // no routing.md: no pillar, no score, and NO extraction claim, because no cut carries source lines
  assert.match(noPillar[0].v, /has no routing\.md/);
  assert.equal(noPillar[0].tone, "grey");
  assert.match(noPillar[2].v, /No score to skip anything on/);
  assert.match(noPillar[3].v, /makes no claim/);
  assert.equal(noPillar[3].tone, "grey");
});

test("readsFromCells: the browser copy answers every treatment vector identically", () => {
  const m = treatmentMirror().readsFromCells;
  for (const v of TREATMENT_VECTORS) assert.deepEqual(m(v.t, v.cuts), readsFromCells(v.t, v.cuts), v.t.pillarSource);
});

test("the Content wizard calls the treatment read and offers no control the backend cannot honour", () => {
  const script = emittedScripts().join("\n");
  assert.ok(script.includes('"/api/content/treatment?slug="'), "the wizard must read the treatment");
  // Refused ports: routing decides channels (route.ts), so there is no channel checkbox here, and
  // nothing in src/ clusters Muxin's own audience.
  assert.ok(!script.includes("Make the "), "the prototype's 'Make the N drafts' control does not ship");
  assert.ok(!script.includes("sit in that cluster"), "no cluster-size claim ships");
  // VENTURE_SLUGS/VENTURE_THREAD are the Venture room's own state; the TAG would be a quoted literal
  assert.ok(!script.includes('"VENTURE"'), "no source can earn a VENTURE tag, so the tag does not ship");
  assert.ok(script.includes('"SUBSTACK"') && script.includes('"YOURS"') && script.includes('"READ IN"'),
    "the three tags that a real source.md fact can earn do ship");
});

test("the wizard's bulk yes reuses the row status route and says what it approves", () => {
  const script = emittedScripts().join("\n");
  assert.ok(script.includes('post("/api/status"'), "a bulk yes must reuse the same write every card uses");
  assert.ok(script.includes("Yes to all "), "the scoped label ships");
  assert.ok(script.includes("Nothing outside this channel is touched"), "the scope is stated");
  assert.ok(script.includes("Nothing posts instantly"), "scheduling is not hidden behind the word approve");
  // A row she flagged revise must be out of reach: approving it would act against her own note.
  assert.ok(script.includes("!DECIDED.has(r.status) && !r.status"), "the bulk yes targets untouched drafts only");
  assert.ok(script.includes("marked revise or blocked"), "the button says what it deliberately leaves alone");
});

test("cwGroups: the bulk yes counts only untouched drafts, never a row marked revise", () => {
  // The browser's cwGroups is DOM-bound, so this asserts the shape of the emitted source instead:
  // the three counts must be distinct, and `fresh` (what the button acts on) must exclude a status.
  const script = emittedScripts().join("\n");
  const start = script.indexOf("function cwGroups(){");
  assert.ok(start > -1, "cwGroups must reach the browser");
  const body = script.slice(start, script.indexOf("\nfunction ", start + 10));
  assert.match(body, /fresh: pending\.filter\(r=>!r\.status\)\.length/);
  assert.match(body, /flagged: pending\.filter\(r=>!!r\.status\)\.length/);
  // and a live check of the same predicate over a realistic row set
  const rows = [
    { status: "" }, { status: "" }, { status: "approve" }, { status: "revise" },
    { status: "blocked" }, { status: "published" }, { status: "discard" },
  ];
  const DECIDED_SET = new Set(["published", "discard", "locked"]);
  const pending = rows.filter((r) => !DECIDED_SET.has(r.status) && r.status !== "approve");
  assert.equal(pending.length, 4, "the badge counts revise and blocked as outstanding");
  assert.equal(pending.filter((r) => !r.status).length, 2, "but only two are what a bulk yes may touch");
  assert.equal(pending.filter((r) => !!r.status).length, 2);
});

// ---------------------------------------------------------------------------
// The intake interview's Rule 5 mirrors.
//
// Same mechanism as captureMirror above: slice the browser's own copies out of the emitted script,
// `new Function` them, and run every vector through BOTH. String-presence would not catch the
// failure that matters — an inline copy edited out of step with the export, which goes green while
// the browser keeps the old answer.

type IntakeMirror = {
  ivProgressLine: (step: number, total: number) => string;
  ivUnanswered: (drafts: { n: number; text: string }[], total: number) => number[];
  ivSaveLine: (s: { state: string; savedAt?: string; error?: string }) => string;
  ivSlugError: (slug: string) => string | null;
};

function intakeMirror(): IntakeMirror {
  const script = emittedScripts().join("\n");
  const start = script.indexOf("function ivProgressLine(");
  const end = script.indexOf("// ── end of the intake mirror ──");
  assert.ok(start > -1, "the inline intake mirrors must reach the browser");
  assert.ok(end > start, "the intake mirror's end marker must follow it");
  const src = script.slice(start, end);
  return new Function(
    src + "\nreturn { ivProgressLine, ivUnanswered, ivSaveLine, ivSlugError };"
  )() as IntakeMirror;
}

test("intakeProgressLine: counted, never estimated, and the two panels are named not numbered", () => {
  const m = intakeMirror().ivProgressLine;
  const vectors: [number, number][] = [[1, 25], [7, 25], [25, 25], [26, 25], [27, 25], [0, 25], [28, 25], [3, 4]];
  for (const [step, total] of vectors) {
    assert.equal(m(step, total), intakeProgressLine(step, total), `mirror disagrees at step ${step}`);
  }
  assert.equal(intakeProgressLine(7, 25), "Question 7 of 25");
  assert.equal(intakeProgressLine(26, 25), "Voice evidence", "the panels after the interview are named steps");
  assert.equal(intakeProgressLine(27, 25), "Day 14 scorecard");
  assert.equal(intakeProgressLine(28, 25), "");
  // Rule 3: nothing on this screen may render a duration nobody measured.
  const script = emittedScripts().join("\n");
  const start = script.indexOf("const IV_QUESTIONS");
  const body = script.slice(start, script.indexOf("async function loadFiction(", start));
  assert.ok(start > -1 && body.length > 0, "the interview client must reach the browser");
  assert.doesNotMatch(body, /minutes? (left|remaining)|about \d+ min|est\w* time|takes about/i,
    "the interview must not estimate how long it takes — nothing here measures that");
});

test("intakeUnanswered: whitespace is not an answer, and the mirror agrees", () => {
  const m = intakeMirror().ivUnanswered;
  const vectors: { n: number; text: string }[][] = [
    [],
    [{ n: 1, text: "a" }, { n: 3, text: "c" }],
    [{ n: 1, text: "   " }, { n: 2, text: "\n" }, { n: 3, text: "x" }],
    [{ n: 1, text: "" }, { n: 2, text: "ok" }, { n: 5, text: "ok" }],
  ];
  for (const drafts of vectors) {
    assert.deepEqual(m(drafts, 5), intakeUnanswered(drafts, 5), "mirror disagrees");
  }
  assert.deepEqual(intakeUnanswered([{ n: 1, text: "   " }, { n: 2, text: "x" }], 3), [1, 3],
    "a box holding only whitespace is unanswered, exactly as kickoffVenture reads it");
});

test("intakeSaveLine: 'saved' is only ever said about a write the server confirmed", () => {
  const m = intakeMirror().ivSaveLine;
  const vectors = [
    { state: "" },
    { state: "saving" },
    { state: "saved", savedAt: "2026-08-23T09:05:00.000Z" },
    { state: "saved" },                              // no timestamp: no time claimed
    { state: "saved", savedAt: "not a date" },
    { state: "failed", error: "bad venture name" },
    { state: "failed" },
  ];
  for (const v of vectors) assert.equal(m(v), intakeSaveLine(v), `mirror disagrees on ${JSON.stringify(v)}`);
  assert.equal(intakeSaveLine({ state: "" }), "", "an untouched box claims nothing");
  assert.equal(intakeSaveLine({ state: "saved" }), "saved", "no savedAt means no clock time is invented");
  assert.match(intakeSaveLine({ state: "failed", error: "disk full" }), /^NOT SAVED — disk full/);
  // Rule 2's banned pattern: a bare timer that says "saved" without a response.
  const script = emittedScripts().join("\n");
  const start = script.indexOf("async function ivSaveNow(");
  const body = script.slice(start, script.indexOf("\nfunction ivQueue(", start));
  assert.ok(start > -1, "ivSaveNow must reach the browser");
  assert.ok(body.includes('j.draft.savedAt'), "the saved time comes off the server's own response");
  assert.doesNotMatch(body, /setTimeout/, "the save indicator must not be driven by a timer");
});

test("intakeSlugError mirrors intake-draft.ts's own rule, in both runtimes", () => {
  const m = intakeMirror().ivSlugError;
  const vectors = ["voter-choice", "a", "9lives", "", "A", "-x", ".hidden", "a/b", "..", "a b", "a_b-2"];
  for (const s of vectors) assert.equal(m(s), intakeSlugError(s), `mirror disagrees on ${JSON.stringify(s)}`);
  // and it agrees with the server's copy, which is the one that actually refuses
  for (const s of vectors) {
    const serverOk = saveIntakeDraft(s, 1, "x", mkdtempSync(join(tmpdir(), "iv-slug-"))).ok;
    assert.equal(intakeSlugError(s) === null, serverOk, `client and server disagree about ${JSON.stringify(s)}`);
  }
});

test("the interview screen carries no second copy of the 25 questions", () => {
  const script = emittedScripts().join("\n");
  // The list is serialized from src/venture/intake.ts, so every question must be there verbatim...
  for (const q of INTAKE_QUESTIONS) {
    assert.ok(script.includes(JSON.stringify(q.question)), `question ${q.id} must reach the browser from the real list`);
  }
  // ...and exactly once. A hand-typed second copy is the failure this guards: it would be a change
  // to what the interview asks (root CLAUDE.md rule 7) hiding inside a GUI diff.
  const first = INTAKE_QUESTIONS[0].question;
  assert.equal(script.split(JSON.stringify(first)).length - 1, 1, "the question list must be serialized once, not retyped");
});

test("the interview types her answers in her own register, and never in the AI one", () => {
  const html = renderPage({ repoRoot, isDevWorktree: false });
  const css = html.slice(html.indexOf(".iv-in {"), html.indexOf(".iv-save {"));
  assert.match(css, /Georgia/, "the box she types in is Georgia — those are her words");
  assert.match(css, /border-left:2px solid var\(--blue\)/, "and carries the blue rule, the same pair .vmine uses");
  const script = emittedScripts().join("\n");
  const start = script.indexOf("const IV_QUESTIONS");
  const body = script.slice(start, script.indexOf("async function loadFiction(", start));
  assert.doesNotMatch(body, /5b46b8|vdrafted|vpen/, "nothing in the interview may render in the AI-written register");
});
