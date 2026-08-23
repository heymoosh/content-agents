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
    label: "FIXTURE: not a real job",
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
    job: job({ id: "fixture-job-queued", kind: "url", status: "queued", label: "FIXTURE: a job waiting its turn" }),
  },
  {
    id: "job-running",
    label: "running",
    job: job({
      id: "fixture-job-running", kind: "url", status: "running",
      label: "FIXTURE: a job that is not running",
      steps: FIXTURE_STEPS, stepTotal: 4, step: 1, elapsedMs: FAKE_ELAPSED,
      lastStdoutLine: "FIXTURE: a heartbeat line no subprocess printed",
    }),
  },
  {
    id: "job-blocked-awaiting",
    label: "blocked (awaiting)",
    job: job({
      id: "fixture-job-blocked", kind: "url", status: "blocked",
      label: "FIXTURE: a job stopped on a question",
      steps: FIXTURE_STEPS, stepTotal: 4, step: 2, elapsedMs: FAKE_ELAPSED,
      ask: { question: "FIXTURE: a question no skill asked. Either answer is fake.", options: ["FIXTURE option A", "FIXTURE option B"] },
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
      label: "FIXTURE: a job whose question was answered",
      steps: FIXTURE_STEPS, stepTotal: 4, step: 2, elapsedMs: FAKE_ELAPSED,
      ask: { question: "FIXTURE: a question no skill asked. Either answer is fake.", options: ["FIXTURE option A", "FIXTURE option B"] },
      answer: "FIXTURE option A",
    }),
  },
  {
    id: "job-failed",
    label: "failed",
    job: job({
      id: "fixture-job-failed", kind: "url", status: "failed",
      label: "FIXTURE: a failure that did not happen",
      steps: FIXTURE_STEPS, stepTotal: 4, step: 2, failedAtStep: 2, retryable: true,
      elapsedMs: FAKE_ELAPSED, error: "FIXTURE: no process ran, so nothing actually broke.",
      finishedAt: NOW as unknown as number,
    }),
  },
  {
    id: "job-done",
    label: "done",
    job: job({
      id: "fixture-job-done", kind: "url", status: "done",
      label: "FIXTURE: a job that finished nothing",
      steps: FIXTURE_STEPS, stepTotal: 4, step: 4, elapsedMs: FAKE_ELAPSED,
      finishedAt: NOW as unknown as number,
    }),
  },
  {
    // `stopped` is Muxin pressing Stop it (jobs.ts). This button FOUND the defect it now reviews:
    // page.ts had no branch for it anywhere, so jobRailLabel, jobFooter, jobLogLine, jobClockText
    // and every strip mirror fell through to their running default and a job she had stopped
    // rendered as "Working" in AI purple under "Real elapsed time, not an estimate." — a screen
    // claiming work was in flight that was not. Fixed since: the rail now reads "You stopped it" in
    // her own blue, the clock is the frozen measured elapsed, and no Retry is offered. The button
    // stays as the review surface for that copy.
    id: "job-stopped",
    label: "stopped",
    job: job({
      id: "fixture-job-stopped", kind: "url", status: "stopped",
      label: "FIXTURE: a job nobody stopped",
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
const FIC_BEATS = "FIXTURE: beats nobody typed. Two people, one room, one thing left unsaid.";

const FIC_SERIES = {
  series: [
    {
      slug: FIC_SLUG,
      title: "FIXTURE: a series that does not exist",
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
        title: "FIXTURE: Chapter one",
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

const FXS_AT = "2026-08-18T09:00:00.000Z";
const FXS_NOW = "2026-08-21T09:00:00.000Z";

// ── Signals: the four outcome families, and the redacted research read ───────────────────────────
//
// GET /api/signals/outcomes and GET /api/research/report. Every string carries FIXTURE so a
// screenshot cannot be mistaken for a real read, and the numbers exist to exercise the states the
// screen must keep apart: a real total, a measured zero, a sum over no posts at all, and a metric
// with no source to measure it from.

function fxMeasured(value: number, measured: number, unmeasured: number): Record<string, unknown> {
  return { state: "measured", value, records_measured: measured, records_unmeasured: unmeasured };
}
function fxUnmeasured(reason: string): Record<string, unknown> {
  return { state: "not_measured", reason: "FIXTURE: " + reason };
}

const FX_SAMPLE_RULE = {
  kind: "weeks_of_data",
  threshold_weeks: 4,
  source: "FIXTURE: not the repo's real INSUFFICIENT rule, a fixture standing in for it",
};

function fxOutcomes(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    generated_at: FXS_AT,
    attention: {
      family: "attention",
      question: "FIXTURE: did people see it?",
      impressions: fxMeasured(123456, 9, 2),
    },
    conversation: {
      family: "conversation",
      question: "FIXTURE: did people reply, comment, save, share, or DM?",
      likes: fxMeasured(0, 9, 2), // a MEASURED zero: nine posts carried the column and it added to nothing
      replies: fxMeasured(0, 0, 11), // a sum over NO posts, which is a different sentence
      reposts: fxMeasured(77, 9, 2),
      saves: fxUnmeasured("no saves column exists in this fixture database"),
      comments: fxUnmeasured("no comments column exists in this fixture database"),
      research_observations: fxUnmeasured("no research capture has run in this fixture database"),
      research_observations_by_source: {},
    },
    audience: {
      family: "audience",
      question: "FIXTURE: did it bring a landing visit, an opt-in, subscriber growth, or a survey response?",
      new_follows: fxMeasured(31, 9, 2),
      follower_total: fxMeasured(1580, 2, 0),
      follower_delta: fxMeasured(12, 2, 0),
      landing_visits: fxUnmeasured("no landing-page analytics ingest exists"),
      opt_ins: fxUnmeasured("no landing-page analytics ingest exists"),
      survey_responses: fxUnmeasured("survey responses live inside a venture and Signals never reads those"),
      partial_note: "FIXTURE: part of this family is measured and part has no source at all.",
    },
    business: {
      family: "business",
      question: "FIXTURE: did it lead to a qualified inquiry, a call, an opportunity, or a purchase?",
      qualified_inquiries: fxUnmeasured("no funnel record exists"),
      calls: fxUnmeasured("no funnel record exists"),
      opportunities: fxUnmeasured("no funnel record exists"),
      purchases: fxUnmeasured("no funnel record exists"),
      empty_state: "FIXTURE: until the landing page is live and taking payment there is nothing to measure here. It stays this way, not a zero.",
    },
    confidence: [
      { platform: "bluesky", posts: 3, weeks: 2, status: "INSUFFICIENT (<4 wks), directional only", sufficient: false },
      { platform: "linkedin", posts: 8, weeks: 11, status: "OK", sufficient: true },
    ],
    sample_rule: FX_SAMPLE_RULE,
    never_collapsed: true,
    ...over,
  };
}

// Nothing has gone out yet: no platform rows at all, and every family a sum over nothing. This is
// the state the screen must NOT render as four measured zeros.
function fxOutcomesPreLaunch(): Record<string, unknown> {
  const base = fxOutcomes() as Record<string, Record<string, unknown>>;
  const zeroed = (fam: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = { ...fam };
    for (const [k, v] of Object.entries(fam)) {
      if (v && typeof v === "object" && (v as { state?: string }).state === "measured") out[k] = fxMeasured(0, 0, 0);
    }
    return out;
  };
  return {
    ...base,
    attention: zeroed(base.attention),
    conversation: zeroed(base.conversation),
    audience: zeroed(base.audience),
    confidence: [],
  };
}

const FX_RESEARCH_AVAILABLE: Record<string, unknown> = {
  state: "available",
  capture_configured: true,
  report: {
    generated_at: FXS_AT,
    observation_counts: { reply: 14, comment: 3 },
    active_observation_counts: { reply: 12, comment: 3 },
    metrics: {},
    note_metrics: [],
    reply_observations: [
      { observation_id: "fx-1", note_id: "fx-note", reply_id: "fx-r1", parent_reply_id: null, published_at: FXS_AT,
        redacted_text: "FIXTURE: a redacted reply, stored without the exact words" },
      { observation_id: "fx-2", note_id: "fx-note", reply_id: "fx-r2", parent_reply_id: null, published_at: FXS_AT,
        redacted_text: "FIXTURE: another redacted reply" },
    ],
    creator_reply_observations: 2,
    audience_respondent_summary: {
      observation_count: 13, unique_respondents: 8,
      observations_without_respondent_hash: 1, max_observations_per_respondent: 3,
      respondent_observation_distribution: { "1": 5, "3": 1 },
    },
    largest_audience_thread: {
      observation_count: 6, known_respondents: 4,
      observations_without_respondent_hash: 0, max_observations_per_respondent: 2,
    },
    coverage: [
      { run_at: FXS_AT, source: "substack_notes", window_start: FXS_AT, window_end: FXS_NOW, status: "complete", records_captured: 14, gap_reason: null },
    ],
  },
};

const FX_RESEARCH_UNAVAILABLE: Record<string, unknown> = {
  state: "unavailable",
  capture_configured: false,
  reason: "FIXTURE: RESEARCH_HASH_KEY is not set, so research capture cannot write observations and the table is empty",
  report: null,
};

// ── Content: the three-step wizard ───────────────────────────────────────────────────────────────
//
// GET /api/content (the source picker), GET /api/content/treatment (the per-channel grid) and
// GET /api/queue (the drafts the third step approves). The channel list is chosen to put every
// FitBasis on one screen at once, because the whole point of the basis is that a COLD START from
// no data must not look like a STRONG FIT from a measured score.

const FX_SLUG = "2026-08-18-fixture-a-piece-that-does-not-exist";

function fxSession(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    slug: FX_SLUG,
    title: "FIXTURE: a piece nobody wrote",
    date: "2026-08-18",
    sourceBody: "FIXTURE: the source text of a piece that does not exist on disk.",
    rounds: [],
    cuts: [{ lens: "extract", title: "FIXTURE: the cut", body: "FIXTURE: a cut body", sourceLines: [4, "9-11"] }],
    pending: 2,
    origin: "file:FIXTURE.md",
    sourceKind: "",
    canonicalUrl: null,
    publishedAt: null,
    tag: "YOURS",
    tagBasis: "FIXTURE: origin file:FIXTURE.md, and nothing here has published it",
    ...over,
  };
}

function fxChannel(over: Record<string, unknown>): Record<string, unknown> {
  return {
    channel: "x",
    pillars: ["human-ai"],
    decision: "include",
    recordedDecision: "include",
    score: null,
    confidence: null,
    rationale: null,
    fitLabel: null,
    fitBasis: "unknown",
    belowFloor: false,
    reuse: { key: "x", allowed: true, everPlaced: false, lastPlacedAt: null, daysSince: null, minDays: 14, reason: null },
    reuseNote: null,
    slot: { time: FXS_NOW, label: "FIXTURE: Tue 09:00 PT" },
    ...over,
  };
}

const FX_TREATMENT: Record<string, unknown> = {
  slug: FX_SLUG,
  pillars: ["human-ai"],
  pillarSource: "routing.md",
  floor: 0.6,
  channels: [
    fxChannel({ channel: "x", score: 1.4, confidence: "data", fitLabel: "STRONG FIT", fitBasis: "measured" }),
    fxChannel({ channel: "linkedin", score: 0.8, confidence: "data", fitLabel: "REACH ONLY", fitBasis: "measured",
      reuse: { key: "linkedin", allowed: false, everPlaced: true, lastPlacedAt: FXS_AT, daysSince: 12, minDays: 60, reason: "FIXTURE: inside the window" } }),
    fxChannel({ channel: "threads", score: 0.4, confidence: "data", fitLabel: "POOR FIT", fitBasis: "measured", belowFloor: true,
      reuse: { key: "threads", allowed: true, everPlaced: true, lastPlacedAt: FXS_AT, daysSince: 40, minDays: 14, reason: null } }),
    fxChannel({ channel: "bluesky", score: null, confidence: "cold-start", fitLabel: "COLD START", fitBasis: "insufficient-data",
      reuse: { key: "bluesky", allowed: true, everPlaced: false, lastPlacedAt: null, daysSince: null, minDays: 21, reason: null } }),
    fxChannel({ channel: "mastodon", score: null, confidence: "rule", fitLabel: null, fitBasis: "editorial-rule", decision: "skip", recordedDecision: "include",
      reuse: { key: "mastodon", allowed: true, everPlaced: false, lastPlacedAt: null, daysSince: null, minDays: 21, reason: null } }),
    fxChannel({ channel: "quote-card", score: null, confidence: "always", fitLabel: null, fitBasis: "format-asset",
      reuse: null, reuseNote: "FIXTURE: reuse for a quote card is enforced per fan-out target, not on the card itself",
      slot: { time: FXS_NOW, label: "next-free-slot" } }),
  ],
  scoredBelowFloorButEnabled: ["threads"],
};

function fxRow(over: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "fx-row",
    platform: "x",
    format: "text",
    kind: "text",
    status: "",
    body: "FIXTURE: a draft nobody wrote.",
    notes: "",
    editable: false,
    revisable: false,
    duplicatable: false,
    sourceLines: [4],
    ...over,
  };
}

const FX_QUEUE: Record<string, unknown> = {
  pieces: [
    {
      slug: FX_SLUG,
      title: "FIXTURE: a piece nobody wrote",
      rows: [
        fxRow({ id: "fx-x-1", platform: "x" }),
        fxRow({ id: "fx-x-2", platform: "x", status: "approve" }),
        // she flagged this one: the tab badge counts it, the bulk yes must not touch it
        fxRow({ id: "fx-x-3", platform: "x", status: "revise", notes: "FIXTURE: needs a colder open" }),
        fxRow({ id: "fx-li-1", platform: "linkedin", body: "FIXTURE: the LinkedIn draft." }),
        fxRow({ id: "fx-li-2", platform: "linkedin", status: "approve", body: "FIXTURE: already yes." }),
        fxRow({ id: "fx-card-1", platform: "quote-card", kind: "image", format: "quote-card", body: "" }),
      ],
    },
  ],
  pending: 4,
  liveStateAsOf: null,
  textPlatforms: ["x", "linkedin", "bluesky"],
};

const FX_CONTENT_BASE: Record<string, unknown> = {
  "/api/content": {
    sessions: [
      fxSession(),
      fxSession({
        slug: "2026-08-12-fixture-a-note-of-hers", title: "FIXTURE: a Note of hers", pending: 0,
        origin: "https://substack.com/@fixture/note/c-1", sourceKind: "substack-note",
        canonicalUrl: "https://substack.com/@fixture/note/c-1", publishedAt: "2026-08-12",
        tag: "SUBSTACK", tagBasis: "FIXTURE: source.md records source_kind: substack-note", cuts: [],
      }),
      fxSession({
        slug: "2026-08-10-fixture-someone-elses-essay", title: "FIXTURE: someone else's essay", pending: 0,
        origin: "https://example.com/p/not-hers", canonicalUrl: "https://example.com/p/not-hers", publishedAt: "2026-08-10",
        tag: "READ IN", tagBasis: "FIXTURE: origin host example.com, which is not one of your configured destinations", cuts: [],
      }),
    ],
  },
  "/api/content/treatment": FX_TREATMENT,
  "/api/queue": FX_QUEUE,
};

const CONTENT_SCENARIOS: FixtureScenario[] = [
  {
    id: "content-wizard",
    group: "Content wizard",
    label: "every fit basis at once",
    room: "content",
    overrides: FX_CONTENT_BASE,
  },
  {
    id: "content-wizard-no-pillar",
    group: "Content wizard",
    label: "no routing.md, so no fit call",
    room: "content",
    overrides: {
      ...FX_CONTENT_BASE,
      "/api/content/treatment": {
        ...FX_TREATMENT,
        pillars: [],
        pillarSource: "none",
        scoredBelowFloorButEnabled: [],
        channels: (FX_TREATMENT.channels as Record<string, unknown>[]).map((c) => ({
          ...c, decision: null, recordedDecision: null, score: null, confidence: null,
          fitLabel: null, fitBasis: "unknown", belowFloor: false,
        })),
      },
    },
  },
  {
    id: "content-wizard-no-drafts",
    group: "Content wizard",
    label: "a source with no drafts yet",
    room: "content",
    overrides: {
      ...FX_CONTENT_BASE,
      "/api/queue": { pieces: [], pending: 0, liveStateAsOf: null, textPlatforms: ["x", "linkedin", "bluesky"] },
    },
  },
  {
    id: "content-treatment-error",
    group: "Content wizard",
    label: "the treatment read fails",
    room: "content",
    overrides: { ...FX_CONTENT_BASE, "/api/content/treatment": { error: "FIXTURE: bad slug" } },
  },
];

const SIGNALS_SCENARIOS: FixtureScenario[] = [
  {
    id: "signals-outcomes",
    group: "Signals outcomes",
    label: "four families, every state",
    room: "signals",
    overrides: { "/api/signals/outcomes": fxOutcomes(), "/api/research/report": FX_RESEARCH_AVAILABLE },
  },
  {
    id: "signals-outcomes-pre-launch",
    group: "Signals outcomes",
    label: "nothing live yet",
    room: "signals",
    overrides: { "/api/signals/outcomes": fxOutcomesPreLaunch(), "/api/research/report": FX_RESEARCH_UNAVAILABLE },
  },
  {
    id: "signals-research-unavailable",
    group: "Signals outcomes",
    label: "research capture never ran",
    room: "signals",
    overrides: { "/api/signals/outcomes": fxOutcomes(), "/api/research/report": FX_RESEARCH_UNAVAILABLE },
  },
];

const EMPTY_BY_ROOM: Record<string, Record<string, unknown>> = {
  content: {
    "/api/queue": { pieces: [], pending: 0, liveStateAsOf: null, textPlatforms: ["x", "linkedin", "bluesky"] },
    "/api/content": { sessions: [] },
    "/api/content/treatment": { error: "no source picked in this fixture set" },
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
    "/api/signals/outcomes": fxOutcomesPreLaunch(),
    "/api/research/report": FX_RESEARCH_UNAVAILABLE,
    "/api/strategy/brief": { ok: false, error: "FIXTURE: no strategy brief in this fixture set." },
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

// ── Venture ──────────────────────────────────────────────────────────────────────────────────────
//
// Built by running the REAL buildVentureThread over fixture domain data, not by hand-authoring
// thread JSON. That is the whole point of the builder being pure: a scenario cannot drift from what
// the room actually renders, because it IS what the room renders. venture-thread.ts imports nothing
// but types, so this stays I/O-free (fixtures.test.ts greps this file's own source for that).
//
// The three scenarios are chosen to exercise the honesty rules rather than to look good: mixed
// proof types on one checkpoint (the case where a single "3 OF 3 LIVE" would hide what it is
// resting on), a closed response gate with real zeros and a null cluster analysis, and a retracted
// artifact carrying BOTH its original evidence and its takedown.

import { buildVentureThread, type ThreadInput } from "./venture-thread.js";
import type { VentureArtifact, Evidence, Retraction } from "../venture/artifacts.js";
import type { CheckpointState, VentureState } from "../venture/state.js";
import type { DecisionRecord } from "../venture/decisions.js";

const FX_AT = "2026-08-18T09:00:00.000Z";
const FX_NOW = "2026-08-21T09:00:00.000Z";

function fxArtifact(over: Partial<VentureArtifact> & { artifact_id: string; title: string }): VentureArtifact {
  return {
    phase: 1, artifact_kind: "substack-post", body_path: null, checkpoint_id: "checkpoint-1", fields: null,
    delivery_mode: "manual", publishable: false, editorial_status: "draft", delivery_status: "awaiting_approval",
    evidence: null, retraction: null, failure: null, origin_type: "venture", venture_id: "fixture-venture",
    venture_phase: 1, message_id: "fx", cta_id: null, rules_version: "fixture-rules", probe_id: null,
    unknown_id: null, claim_refs: [], created_at: FX_AT, updated_at: FX_AT,
    ...over,
  } as VentureArtifact;
}

const ev = (type: Evidence["type"], value: string): Evidence => ({ type, value, confirmed_by: "muxin", confirmed_at: FX_AT });

const FX_LIVE_URL = fxArtifact({
  artifact_id: "p1-essay-01", title: "FIXTURE: why the ballot measure nobody reads decides the most",
  body_path: "phase-1-attention/p1-essay-01.md", editorial_status: "approved", delivery_status: "live_confirmed",
  evidence: ev("url", "https://example.invalid/fixture-essay"),
  claim_refs: [{ claim: "FIXTURE: a traced claim", ref: "intake:q7" }],
});
const FX_LIVE_AGENT = fxArtifact({
  artifact_id: "p1-note-01", title: "FIXTURE: the note the agent posted", artifact_kind: "text-post-note",
  delivery_mode: "app", publishable: true, editorial_status: "approved", delivery_status: "live_confirmed",
  evidence: ev("agent", "substack-notes"),
});
// The row the whole badge system exists for: live on Muxin's word alone, which must never render
// with the same mark as the two above.
const FX_LIVE_WORD = fxArtifact({
  artifact_id: "p1-note-02", title: "FIXTURE: the one you told me went up", artifact_kind: "welcome-email",
  editorial_status: "approved", delivery_status: "live_confirmed",
  evidence: ev("attestation", "I pasted it into Substack on the 18th and it is up."),
});
const FX_APPROVED_NOT_LIVE = fxArtifact({
  artifact_id: "p1-essay-02", title: "FIXTURE: approved, and not live", body_path: "phase-1-attention/p1-essay-02.md",
  editorial_status: "approved", delivery_status: "handed_off",
});
const FX_RETRACTED = fxArtifact({
  artifact_id: "p1-essay-03", title: "FIXTURE: the one that came down",
  editorial_status: "discarded", delivery_status: "cancelled",
  evidence: ev("url", "https://example.invalid/fixture-retracted"),
  retraction: { attestation: "I unpublished it, the link is dead now.", retracted_at: FX_NOW, retracted_by: "muxin" } as Retraction,
});

function fxCheckpoint(required: VentureArtifact[], over: Partial<CheckpointState> = {}): CheckpointState {
  const complete = required.filter((a) => a.delivery_status === "live_confirmed").length;
  return {
    required, complete_count: complete, required_count: required.length, pace_recorded: true,
    decisions_required_count: 0, decisions_complete_count: 0, cleared: false, blocking: [], ...over,
  };
}

function fxState(phase: 1 | 2 | 3 | 4, checkpoints: Record<string, CheckpointState>): VentureState {
  return {
    slug: "fixture-venture", current_phase: phase, phase_status: "awaiting_you", checkpoints,
    phase4: {
      operating_plan: { drafted: false, approved: false }, thank_you_notes_count: 0,
      day_14_review: { drafted: false, approved: false }, day_14_decision: { made: false, candidate_id: null },
      complete: false, blocking: [],
    },
  };
}

const FX_DECISION: DecisionRecord = {
  decision_id: "p1-platform-01", decision_kind: "platform-recommendation", rules_version: "fixture-rules",
  input_refs: ["intake:q18"],
  candidates: [
    { candidate_id: "substack", label: "FIXTURE: Substack", scores: { reach: 4, fit: 5 }, evidence_refs: [], rationale: "FIXTURE: where the essays already live." },
    { candidate_id: "linkedin", label: "FIXTURE: LinkedIn", scores: { reach: 5, fit: 2 }, evidence_refs: [], rationale: "FIXTURE: bigger room, wrong room." },
  ],
  recommended_candidate_ids: ["substack"], selected_candidate_ids: ["linkedin"], selected_by: "muxin",
  override_reason: "FIXTURE: the people I want are on LinkedIn, and I would rather be early there.",
  rationale: null, status: "selected", created_at: FX_AT, decided_at: FX_AT,
};

// Awaiting her, with a recommendation -- clicking the NON-recommended row is what raises the
// override-reason field. A fixture cannot pre-open that field (it is client state, not server
// data), so the scenario's job is to make the interrupt reachable in one click.
const FX_AWAITING: DecisionRecord = {
  ...FX_DECISION,
  decision_id: "p1-platform-02",
  selected_candidate_ids: [],
  selected_by: null,
  override_reason: null,
  status: "awaiting_user",
  decided_at: null,
};

// One live row short of clearing, so the Clear button starts disabled and the server's own refusal
// is one click away.
const FX_NOT_LIVE = fxArtifact({
  artifact_id: "p1-essay-04", title: "FIXTURE: approved, still not live",
  editorial_status: "approved", delivery_status: "handed_off",
});

// A manual hand-off with a url floor: the confirm-live form asks for a link.
const FX_HANDED_OFF = fxArtifact({
  artifact_id: "p1-essay-05", title: "FIXTURE: waiting on you to put it live",
  editorial_status: "approved", delivery_status: "handed_off",
});
const FX_FAILED = fxArtifact({
  artifact_id: "p1-essay-06", title: "FIXTURE: the one that did not go up",
  editorial_status: "approved", delivery_status: "failed",
  failure: { provider: null, message: "FIXTURE: Substack rejected the paste.", retryable: true, at: FX_NOW },
});

const FX_ANSWERS = {
  q1: "FIXTURE: help people vote on the local measures that actually change their street.",
  q2: "FIXTURE: people who already vote in the big races and skip everything under them.",
  q18: "FIXTURE: Substack. I already write there and it does not feel like performing.",
  q20: "FIXTURE: about forty minutes a day, and I will be honest when that slips.",
  q24: "FIXTURE: it should never become a thing that tells people how to vote.",
};

function fxThread(over: Partial<ThreadInput>) {
  return buildVentureThread({
    slug: "fixture-venture",
    state: fxState(1, { "checkpoint-1": fxCheckpoint([FX_LIVE_URL, FX_LIVE_AGENT, FX_LIVE_WORD]) }),
    statusText: "fixture-venture -- Phase 1\n3 of 3 posts are live.",
    artifacts: [FX_LIVE_URL, FX_LIVE_AGENT, FX_LIVE_WORD, FX_APPROVED_NOT_LIVE],
    decisions: [FX_DECISION],
    canon: [
      { at: FX_AT, type: "kickoff", id: "fixture-venture/kickoff", fields: { rules_version: "fixture-rules" } },
      { at: FX_AT, type: "pace-recorded", id: "fixture-venture/phase-1/pace", fields: { per_week: "5" } },
    ],
    gate: { state: "closed", have: 0, need: 20, target: 30, opened_at: null },
    clusters: null,
    answers: FX_ANSWERS,
    rulesVersion: "fixture-rules",
    minEvidence: { "substack-post": "url", "text-post-note": "agent", "welcome-email": "attestation", "product-outline": null, "phase_1_research_read": null, "day-14-review": null, "daily-operating-plan": null },
    selectCounts: { "idea-ranking": 3, "lead-magnet-concept": 1 },
    day14Candidates: ["continue", "revise_positioning", "revise_lead_magnet", "collect_more_evidence", "stop"],
    now: FX_NOW,
    ...over,
  });
}

const VENTURE_WRITE_SCENARIOS: FixtureScenario[] = [
  {
    id: "venture-awaiting-decision",
    group: "Venture",
    label: "a decision waiting on you",
    room: "venture",
    note: "Click the non-recommended row to reach the override-reason interrupt. A fixture cannot pre-open client state.",
    overrides: {
      "/api/venture/list": { ok: true, ventures: ["fixture-venture"] },
      "/api/venture/fixture-venture/thread": { ok: true, thread: fxThread({ decisions: [FX_AWAITING], artifacts: [] }) },
    },
  },
  {
    id: "venture-one-short",
    group: "Venture",
    label: "checkpoint one row short",
    room: "venture",
    overrides: {
      "/api/venture/list": { ok: true, ventures: ["fixture-venture"] },
      "/api/venture/fixture-venture/thread": {
        ok: true,
        thread: fxThread({
          artifacts: [FX_LIVE_URL, FX_LIVE_AGENT, FX_NOT_LIVE],
          state: fxState(1, { "checkpoint-1": fxCheckpoint([FX_LIVE_URL, FX_LIVE_AGENT, FX_NOT_LIVE]) }),
        }),
      },
    },
  },
  {
    id: "venture-confirm-live",
    group: "Venture",
    label: "confirm-live and report-failed forms",
    room: "venture",
    overrides: {
      "/api/venture/list": { ok: true, ventures: ["fixture-venture"] },
      "/api/venture/fixture-venture/thread": {
        ok: true,
        thread: fxThread({
          artifacts: [FX_HANDED_OFF, FX_FAILED],
          state: fxState(1, { "checkpoint-1": fxCheckpoint([FX_HANDED_OFF, FX_FAILED]) }),
        }),
      },
    },
  },
];

const VENTURE_SCENARIOS: FixtureScenario[] = [
  {
    id: "venture-mixed-proof",
    group: "Venture",
    label: "checkpoint on mixed proof",
    room: "venture",
    overrides: {
      "/api/venture/list": { ok: true, ventures: ["fixture-venture"] },
      "/api/venture/fixture-venture/thread": { ok: true, thread: fxThread({}) },
    },
  },
  {
    id: "venture-gate-closed",
    group: "Venture",
    label: "phase 3, gate closed at zero",
    room: "venture",
    overrides: {
      "/api/venture/list": { ok: true, ventures: ["fixture-venture"] },
      "/api/venture/fixture-venture/thread": {
        ok: true,
        thread: fxThread({
          state: fxState(3, { "checkpoint-3": fxCheckpoint([], { decisions_required_count: 3, decisions_complete_count: 1, blocking: [{ artifact_id: null, reason: 'missing required decision kind "transformation-choice"' }, { artifact_id: null, reason: 'missing required decision kind "product-format-and-price"' }] }) }),
          statusText: "fixture-venture -- Phase 3\n0 of 20 people who count toward the goal so far.",
          artifacts: [],
        }),
      },
    },
  },
  {
    id: "venture-retracted",
    group: "Venture",
    label: "a retracted post keeps its evidence",
    room: "venture",
    overrides: {
      "/api/venture/list": { ok: true, ventures: ["fixture-venture"] },
      "/api/venture/fixture-venture/thread": {
        ok: true,
        thread: fxThread({
          artifacts: [FX_RETRACTED, FX_APPROVED_NOT_LIVE],
          state: fxState(1, { "checkpoint-1": fxCheckpoint([FX_RETRACTED, FX_APPROVED_NOT_LIVE]) }),
          canon: [
            { at: FX_AT, type: "kickoff", id: "fixture-venture/kickoff", fields: {} },
            { at: FX_NOW, type: "retracted", id: "fixture-venture/p1-essay-03/retracted/" + FX_NOW, fields: { artifact: "p1-essay-03" } },
          ],
        }),
      },
    },
  },
];

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
          label: `FIXTURE: a ${room} job that is not running`,
          steps: FIXTURE_STEPS, stepTotal: 4, step: 1, elapsedMs: FAKE_ELAPSED,
          lastStdoutLine: "FIXTURE: a heartbeat line no subprocess printed",
        })],
      },
    },
  })),
  ...FIC_STATES.map((f) => ({
    id: f.id, group: "Fiction", label: f.label, room: "fiction",
    overrides: { ...FIC_BASE, "/api/fiction/scene": f.scene },
  })),
  ...VENTURE_SCENARIOS,
  ...VENTURE_WRITE_SCENARIOS,
  ...CONTENT_SCENARIOS,
  ...SIGNALS_SCENARIOS,
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
