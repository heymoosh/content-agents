// Dev-only fixture mode for the review GUI (docs/prototype-port-rules.md Rule 4: "A dev fixture
// mode gets built. Otherwise new screens — the Venture room especially — cannot be reviewed until
// real data happens to exist for them.").
//
// The whole risk of this feature is fixture data reaching a real screen. Four things stop it:
//
//   1. It is off unless the process was STARTED with REVIEW_FIXTURES=1. Not a query param, not a
//      cookie, not a localStorage flag — nothing reachable from the browser can turn it on, so a
//      normal `npm run review` can never be talked into it.
//   2. When off, renderPage emits none of it. No banner, no panel, no scenario JSON, no
//      interceptor, no enabling control. Not hidden with CSS — absent. fixtures.test.ts asserts it.
//   3. When on, a striped red banner is pinned above everything, and it names which routes are
//      currently being faked. A screenshot cannot hide it.
//   4. Fixture mode is READ-ONLY BY CONSTRUCTION, in both directions:
//        - the browser interceptor answers every non-GET with 403 without letting it leave the page
//        - serve.ts refuses every non-GET request while the flag is set, before any route matches
//      So no fixture session can touch data/analytics.db, data/publish-schedule.jsonl,
//      review-queue.md, briefs/bets.md or any venture/<slug>/ file. Being unable to work for real
//      is the point, not a limitation: restart without the flag to use the app.
//
// This module is deliberately I/O-free — it imports no filesystem or subprocess module, nothing at
// all that could write. fixtures.test.ts asserts that too, by reading this file's own source.
//
// Adding a Venture fixture set later is a DATA change: append scenarios to FIXTURE_SCENARIOS and,
// once a Venture job kind exists, fill in its `kind` in JOB_ROOM_KINDS. No rewrite.

import type { JobView, JobRoom } from "./page.js";

export const FIXTURE_ENV_VAR = "REVIEW_FIXTURES";

// Read at server START, deliberately. serve.ts calls this once and passes the result into
// renderPage; there is no per-request re-read and no way to flip it from a client.
export function fixturesEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = env[FIXTURE_ENV_VAR];
  return v === "1" || v === "true";
}

// What serve.ts answers for any non-GET while fixture mode is on.
export const FIXTURE_WRITE_REFUSAL =
  `Fixture mode is on (${FIXTURE_ENV_VAR}=1). Every write is refused so fixture data can never ` +
  `reach a real file. Restart the review server without the flag to work for real.`;

// Unique strings the tests grep for. Each must appear ONLY inside fixture output, never in the
// normal page, so "the disabled render contains none of these" is a real proof.
export const FIXTURE_BANNER_MARKER = "id=\"fxBanner\"";
export const FIXTURE_PANEL_MARKER = "id=\"fxPanel\"";
export const FIXTURE_OPEN_MARKER = "id=\"fxOpen\"";
export const FIXTURE_INTERCEPT_MARKER = "__reviewFixtureFetchInstalled";

// Replaced with Date.now() in the browser at apply time. A `done` job only holds its room strip for
// STRIP_LINGER_MS past finishedAt, so a timestamp baked in at page render would already be stale by
// the time anyone clicked the button.
const NOW = "FIXTURE_NOW";

export interface FixtureScenario {
  id: string;
  group: string;
  label: string;
  // pathname -> the JSON body served for a GET of that pathname (query string ignored, so
  // /api/fiction/doc?series=… matches). Applied on top of whatever is already forced; Reset clears.
  overrides: Record<string, unknown>;
  room?: string; // data-room value to switch to when this scenario is applied
  reset?: boolean; // clears every override instead of adding any
  disabled?: boolean; // rendered as a dead button carrying `note` — nothing to force yet
  note?: string;
}

// ── Jobs ─────────────────────────────────────────────────────────────────────────────────────────

type FixtureJob = JobView & { slugs?: string[]; createdAt?: number; startedAt?: number };

const FIXTURE_STEPS = ["FIXTURE step one", "FIXTURE step two", "FIXTURE step three", "FIXTURE step four"];

function job(over: Partial<FixtureJob> & { id: string; kind: string; status: string }): FixtureJob {
  return {
    label: "FIXTURE — not a real job",
    error: null,
    elapsedMs: null,
    lastStdoutLine: null,
    steps: [],
    stepTotal: null,
    step: 0,
    failedAtStep: null,
    retryable: false,
    ask: null,
    answer: null,
    logPath: "",
    finishedAt: null,
    slugs: [],
    ...over,
  } as FixtureJob;
}

// Deliberately absurd: 9,999,000 ms is 2h 46m 39s. Nobody mistakes it for a measurement.
const FAKE_ELAPSED = 9_999_000;

// One job per state, all in the Content room (kind "url") so a single strip shows the whole set.
// `queued` carries no stepTotal on purpose — that is the jobProgressPct null guard (Rule 1a) on
// screen. `running` carries one so the bar is reviewable too.
const JOB_STATES: { id: string; label: string; job: FixtureJob }[] = [
  {
    id: "job-queued",
    label: "queued",
    job: job({ id: "fixture-job-queued", kind: "url", status: "queued", label: "FIXTURE — a job waiting its turn" }),
  },
  {
    id: "job-running",
    label: "running",
    job: job({
      id: "fixture-job-running", kind: "url", status: "running",
      label: "FIXTURE — a job that is not running",
      steps: FIXTURE_STEPS, stepTotal: 4, step: 1, elapsedMs: FAKE_ELAPSED,
      lastStdoutLine: "FIXTURE — a heartbeat line no subprocess printed",
    }),
  },
  {
    id: "job-blocked-awaiting",
    label: "blocked (awaiting)",
    job: job({
      id: "fixture-job-blocked", kind: "url", status: "blocked",
      label: "FIXTURE — a job stopped on a question",
      steps: FIXTURE_STEPS, stepTotal: 4, step: 2, elapsedMs: FAKE_ELAPSED,
      ask: { question: "FIXTURE — a question no skill asked. Either answer is fake.", options: ["FIXTURE option A", "FIXTURE option B"] },
      answer: null,
    }),
  },
  {
    // Rule 1c: an ANSWERED blocked job is settled work, not a demand. jobRailLabel says "You
    // answered", the footer explains a fresh job restarted, and jobAnswerEcho renders her choice.
    // The prototype models this as still-waiting; the shipped app is right and this proves it.
    id: "job-blocked-answered",
    label: "blocked (answered)",
    job: job({
      id: "fixture-job-answered", kind: "url", status: "blocked",
      label: "FIXTURE — a job whose question was answered",
      steps: FIXTURE_STEPS, stepTotal: 4, step: 2, elapsedMs: FAKE_ELAPSED,
      ask: { question: "FIXTURE — a question no skill asked. Either answer is fake.", options: ["FIXTURE option A", "FIXTURE option B"] },
      answer: "FIXTURE option A",
    }),
  },
  {
    id: "job-failed",
    label: "failed",
    job: job({
      id: "fixture-job-failed", kind: "url", status: "failed",
      label: "FIXTURE — a failure that did not happen",
      steps: FIXTURE_STEPS, stepTotal: 4, step: 2, failedAtStep: 2, retryable: true,
      elapsedMs: FAKE_ELAPSED, error: "FIXTURE — no process ran, so nothing actually broke.",
      finishedAt: NOW as unknown as number,
    }),
  },
  {
    id: "job-done",
    label: "done",
    job: job({
      id: "fixture-job-done", kind: "url", status: "done",
      label: "FIXTURE — a job that finished nothing",
      steps: FIXTURE_STEPS, stepTotal: 4, step: 4, elapsedMs: FAKE_ELAPSED,
      finishedAt: NOW as unknown as number,
    }),
  },
  {
    // `stopped` is Muxin pressing Stop it (jobs.ts). FINDING, surfaced by building this fixture:
    // page.ts has no branch for it anywhere — jobRailLabel, jobFooter, jobLogLine, jobClockText and
    // the strip mirrors all fall through to their running default, so a job she stopped currently
    // renders as "Working" in AI purple with "Real elapsed time, not an estimate." underneath. That
    // is a screen claiming work is in flight that is not. Deliberately NOT fixed here — the copy for
    // a stopped job is a judgment call, not dev tooling — but this button puts it in front of you.
    id: "job-stopped",
    label: "stopped",
    job: job({
      id: "fixture-job-stopped", kind: "url", status: "stopped",
      label: "FIXTURE — a job nobody stopped",
      steps: FIXTURE_STEPS, stepTotal: 4, step: 2, elapsedMs: FAKE_ELAPSED,
      finishedAt: NOW as unknown as number,
    }),
  },
];

// One REAL kind per room, so jobRoom(kind) lands the job in the strip being reviewed. A made-up
// kind falls through jobRoom's default and would silently land in Content.
const JOB_ROOM_KINDS: { room: JobRoom; kind: string | null; roomTab?: string; note?: string }[] = [
  { room: "Content", kind: "url", roomTab: "content" },
  { room: "Outreach", kind: "scout", roomTab: "outreach" },
  { room: "Fiction", kind: "fiction-draft", roomTab: "fiction" },
  { room: "Signals", kind: "strategy", roomTab: "signals" },
  // stripJobFor returns null for Charles by design — this one shows in Studio's panel and rail only.
  { room: "Charles", kind: "charles-draft", roomTab: "charles" },
  // jobRoom() maps no kind to Venture yet, so there is nothing honest to force. Fill in `kind`
  // when the Venture room ships its job kind and this button lights up on its own.
  { room: "Venture", kind: null, note: "no job kind maps to Venture yet" },
];

// ── Fiction ──────────────────────────────────────────────────────────────────────────────────────

const FIC_SLUG = "fixture-series";

// The beats are Muxin's OWN words on a real screen, so they render in the Georgia serif register
// (page.ts decides that by field, not by us). Fixture prose therefore goes in the field that
// matches the register it stands in for — never into an AI-purple field.
const FIC_BEATS = "FIXTURE — beats nobody typed. Two people, one room, one thing left unsaid.";

const FIC_SERIES = {
  series: [
    {
      slug: FIC_SLUG,
      title: "FIXTURE — a series that does not exist",
      docs: [
        { id: "bible", label: "The world (story bible)", path: "bible.md", editable: true },
      ],
      chapters: [
        { id: "chapter-1", label: "Chapter 1", path: "chapters/chapter-01.md", editable: true, chapter: 1 },
      ],
    },
  ],
};

const FIC_DOC = {
  ok: true,
  doc: { id: "bible", label: "The world (story bible)", path: "bible.md", editable: true },
  body: "# FIXTURE\n\nThis story bible is fixture data. Nothing here was written and nothing is saved.",
  history: [],
};

const FIC_BASE = { "/api/fiction": FIC_SERIES, "/api/fiction/doc": FIC_DOC };

const FIC_STATES: { id: string; label: string; scene: unknown }[] = [
  {
    id: "fiction-no-beats",
    label: "no beats saved",
    scene: { ok: true, beats: "", chapter: null, continuity: null },
  },
  {
    id: "fiction-beats-no-chapter",
    label: "beats saved, no chapter",
    scene: { ok: true, beats: FIC_BEATS, chapter: null, continuity: null },
  },
  {
    id: "fiction-scene",
    label: "a scene from beats",
    scene: {
      ok: true,
      beats: FIC_BEATS,
      chapter: {
        number: 1,
        title: "FIXTURE — Chapter one",
        status: "draft",
        body:
          "FIXTURE. No chapter was drafted to produce this paragraph, and none of it is anybody's prose.\n\n" +
          "FIXTURE. A second paragraph, here only so the scene reader has more than one block to lay out.",
        path: "chapters/chapter-01.md",
      },
      continuity: null,
    },
  },
];

// ── Empty states ─────────────────────────────────────────────────────────────────────────────────
// An empty read is a real, shippable screen state (Rule 3: "measured-as-zero and not-measured-at-all
// are different"), so each of these is the honest empty payload of the route it fakes.

const EMPTY_BY_ROOM: Record<string, Record<string, unknown>> = {
  content: {
    "/api/queue": { pieces: [], pending: 0, liveStateAsOf: null, textPlatforms: ["x", "linkedin", "bluesky"] },
    "/api/content": { sessions: [] },
  },
  studio: {
    "/api/studio": { counts: { draftsToReview: 0, dossiersToRead: 0, followupsDue: 0, postsHolding: 0 }, needsYou: [], team: [] },
    "/api/jobs": { jobs: [] },
  },
  outreach: {
    "/api/outreach/leads": { leads: [] },
    "/api/followups": { ok: true, buckets: { client: [], platform: [], inbound: [], jobsearch: [] }, jobsearchNote: null },
  },
  fiction: { "/api/fiction": { series: [] } },
  signals: {
    "/api/signals": { briefPath: null, briefDate: null, confidence: [], recommendations: [] },
    "/api/strategy/brief": { ok: false, error: "FIXTURE — no strategy brief in this fixture set." },
    "/api/strategy/raw": { ok: true, files: [] },
  },
  charles: { "/api/charles": { posts: [] } },
};

const COLD_START: Record<string, unknown> = {
  ...EMPTY_BY_ROOM.content,
  ...EMPTY_BY_ROOM.studio,
  ...EMPTY_BY_ROOM.outreach,
  ...EMPTY_BY_ROOM.fiction,
  ...EMPTY_BY_ROOM.signals,
  ...EMPTY_BY_ROOM.charles,
  "/api/notes": { ok: true, notes: [] },
};

// ── The scenario table ───────────────────────────────────────────────────────────────────────────

export const FIXTURE_SCENARIOS: FixtureScenario[] = [
  ...JOB_STATES.map((s) => ({
    id: s.id, group: "Job state", label: s.label, room: "studio",
    overrides: { "/api/jobs": { jobs: [s.job] } },
  })),
  ...JOB_ROOM_KINDS.map(({ room, kind, roomTab, note }) => ({
    id: `job-room-${room.toLowerCase()}`,
    group: "Job, by room",
    label: room.toLowerCase(),
    room: roomTab,
    disabled: kind == null,
    note,
    overrides: kind == null ? {} : {
      "/api/jobs": {
        jobs: [job({
          id: `fixture-job-${room.toLowerCase()}`, kind, status: "running",
          label: `FIXTURE — a ${room} job that is not running`,
          steps: FIXTURE_STEPS, stepTotal: 4, step: 1, elapsedMs: FAKE_ELAPSED,
          lastStdoutLine: "FIXTURE — a heartbeat line no subprocess printed",
        })],
      },
    },
  })),
  ...FIC_STATES.map((f) => ({
    id: f.id, group: "Fiction", label: f.label, room: "fiction",
    overrides: { ...FIC_BASE, "/api/fiction/scene": f.scene },
  })),
  ...Object.entries(EMPTY_BY_ROOM).map(([tab, overrides]) => ({
    id: `empty-${tab}`, group: "Empty", label: tab, room: tab, overrides,
  })),
  {
    id: "cold-start",
    group: "Reset",
    label: "cold start (everything empty)",
    room: "studio",
    overrides: { ...COLD_START, "/api/jobs": { jobs: [] } },
  },
  {
    id: "reset",
    group: "Reset",
    label: "back to real data",
    overrides: {},
    reset: true,
  },
];

// ── Emitted markup ───────────────────────────────────────────────────────────────────────────────

const BANNER_BG = "repeating-linear-gradient(135deg,#9a2f2f 0 13px,#6f1f1f 13px 26px)";

// Pinned above every other layer and never dismissable. The panel can be hidden; this cannot.
export function fixtureBannerHtml(): string {
  return `<style>
  body { padding-top:32px; }
  header { top:32px !important; }
  .fxb { border:1px solid #4a3a22; background:#241a0e; color:#e0cfa8; border-radius:5px;
    padding:4px 8px; font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace; cursor:pointer; }
  .fxb:hover { border-color:#c8ae7c; color:#fff; }
  .fxb[disabled] { opacity:.4; cursor:not-allowed; }
  .fxg { font:9.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; text-transform:uppercase;
    letter-spacing:.07em; color:#7a6647; }
</style>
<div ${FIXTURE_BANNER_MARKER} role="alert" style="position:fixed;top:0;left:0;right:0;z-index:9000;
  background:${BANNER_BG};color:#fff;padding:7px 16px;display:flex;gap:14px;align-items:baseline;
  font:700 11.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;
  box-shadow:0 2px 10px rgba(0,0,0,.45)">
  <span>&#9888; FIXTURE MODE &mdash; ${FIXTURE_ENV_VAR}=1 &mdash; NOTHING ON THIS PAGE IS REAL</span>
  <span id="fxBannerState" style="font-weight:400;letter-spacing:0;opacity:.92">real data &middot; nothing forced &middot; every write refused</span>
</div>`;
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

export function fixturePanelHtml(): string {
  const groups: string[] = [];
  // Rooms are derived from the page's own nav at runtime (see the script), so the Venture room
  // appears here the day it ships and nothing breaks before then.
  groups.push(`<div style="display:flex;flex-direction:column;gap:7px">
      <span class="fxg">Room</span><div id="fxRooms" style="display:flex;flex-wrap:wrap;gap:5px"></div></div>`);
  const seen = new Set<string>();
  for (const sc of FIXTURE_SCENARIOS) {
    if (seen.has(sc.group)) continue;
    seen.add(sc.group);
    const items = FIXTURE_SCENARIOS.filter((s) => s.group === sc.group)
      .map((s) => `<button class="fxb" data-fx="${esc(s.id)}"${s.disabled ? " disabled" : ""}` +
        `${s.note ? ` title="${esc(s.note)}"` : ""}>${esc(s.label)}${s.disabled ? " &middot; n/a" : ""}</button>`)
      .join("");
    groups.push(`<div style="display:flex;flex-direction:column;gap:7px">
      <span class="fxg">${esc(sc.group)}</span><div style="display:flex;flex-wrap:wrap;gap:5px">${items}</div></div>`);
  }
  return `<div ${FIXTURE_PANEL_MARKER} style="position:fixed;right:16px;bottom:16px;z-index:9000;width:250px;
  box-sizing:border-box;max-height:74vh;overflow:auto;background:rgba(20,14,7,.96);
  border:1px solid #4a3a22;border-radius:10px;box-shadow:0 18px 40px rgba(0,0,0,.5);
  padding:13px 14px 14px;display:flex;flex-direction:column;gap:13px">
  <div style="display:flex;align-items:center;gap:10px">
    <span class="fxg" style="color:#c8ae7c">Fixture panel</span><span style="flex:1"></span>
    <button id="fxHide" class="fxb" style="border:none;background:none;padding:0;color:#8a7355">hide</button>
  </div>
  ${groups.join("\n  ")}
  <div style="font:10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#6d5b3f;border-top:1px solid #33260f;padding-top:10px">
    Dev tooling, not part of the app. Every button fakes a read; every write is refused.
  </div>
</div>
<button ${FIXTURE_OPEN_MARKER} class="fxb" hidden style="position:fixed;right:16px;bottom:16px;z-index:9000;
  border-radius:20px;padding:6px 13px;text-transform:uppercase;letter-spacing:.07em">fixtures</button>`;
}

// The browser half. Pure plumbing on purpose: no domain logic lives here, so there is nothing for
// Rule 5's mirror convention to keep in sync — the scenario payloads below are the SAME objects the
// Node tests assert against, serialized, not a second hand-written copy.
export function fixtureScriptHtml(): string {
  const data = JSON.stringify({ scenarios: FIXTURE_SCENARIOS, refusal: FIXTURE_WRITE_REFUSAL, now: NOW })
    .replace(/</g, "\\u003c");
  return `<script>
(function(){
  "use strict";
  var FX = ${data};
  var overrides = Object.create(null);
  var last = "";
  window.${FIXTURE_INTERCEPT_MARKER} = true;

  // Timestamps are stamped when a scenario is applied, not when the page rendered: a "done" job
  // only holds its room strip for a few seconds past finishedAt.
  function hydrate(v){
    if (v === FX.now) return Date.now();
    if (Array.isArray(v)) return v.map(hydrate);
    if (v && typeof v === "object"){ var o = {}; for (var k in v) o[k] = hydrate(v[k]); return o; }
    return v;
  }
  function reply(status, body){
    return new Response(JSON.stringify(body), { status: status, headers: { "content-type": "application/json" } });
  }

  // Installed BEFORE the app's own script, so its very first load()/loadJobs() already goes
  // through here. Every non-GET dies in this function: no write request ever leaves the page.
  var realFetch = window.fetch.bind(window);
  window.fetch = function(input, init){
    var raw = (typeof input === "string") ? input : (input && input.url) || String(input);
    var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
    var path = raw;
    try { path = new URL(raw, location.href).pathname; } catch(e){}
    if (method !== "GET") return Promise.resolve(reply(403, { ok: false, error: FX.refusal }));
    if (Object.prototype.hasOwnProperty.call(overrides, path)) {
      return Promise.resolve(reply(200, hydrate(overrides[path])));
    }
    return realFetch(input, init);
  };

  function paint(){
    var el = document.getElementById("fxBannerState");
    if (!el) return;
    var keys = Object.keys(overrides);
    el.textContent = keys.length
      ? "forcing " + keys.join(" ") + (last ? "  \\u00b7  last: " + last : "")
      : "real data \\u00b7 nothing forced \\u00b7 every write refused";
  }
  function reload(){
    var names = ["load","loadJobs","loadContent","loadStudio","loadSignals","loadFiction","loadCharles","loadOutreach","loadFollowups"];
    for (var i = 0; i < names.length; i++){
      try { var f = window[names[i]]; if (typeof f === "function") f(); } catch(e){}
    }
  }
  function apply(id){
    var sc = null;
    for (var i = 0; i < FX.scenarios.length; i++) if (FX.scenarios[i].id === id) sc = FX.scenarios[i];
    if (!sc || sc.disabled) return;
    if (sc.reset) { overrides = Object.create(null); last = ""; }
    else { for (var k in sc.overrides) overrides[k] = sc.overrides[k]; last = sc.group + " / " + sc.label; }
    paint();
    if (sc.room && typeof window.setRoom === "function") { try { window.setRoom(sc.room); } catch(e){} }
    reload();
  }
  function paintRooms(){
    var box = document.getElementById("fxRooms"); if (!box) return;
    var tabs = document.querySelectorAll("nav.rooms .room"), html = "";
    for (var i = 0; i < tabs.length; i++){
      var r = tabs[i].getAttribute("data-room") || "";
      html += '<button class="fxb" data-fxroom="' + r + '">' + r + '</button>';
    }
    box.innerHTML = html || '<span style="font:10px/1.4 ui-monospace,monospace;color:#6d5b3f">no rooms in the header</span>';
  }
  function start(){
    paintRooms();
    paint();
    var panel = document.getElementById("fxPanel"), open = document.getElementById("fxOpen");
    if (!panel || !open) return;
    panel.addEventListener("click", function(e){
      var b = e.target.closest ? e.target.closest("button") : null; if (!b) return;
      if (b.id === "fxHide") { panel.hidden = true; open.hidden = false; return; }
      if (b.dataset.fxroom) { if (typeof window.setRoom === "function") window.setRoom(b.dataset.fxroom); return; }
      if (b.dataset.fx) apply(b.dataset.fx);
    });
    open.addEventListener("click", function(){ panel.hidden = false; open.hidden = true; });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
</script>`;
}
