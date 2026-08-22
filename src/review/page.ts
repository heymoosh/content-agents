// The review GUI's single HTML page (self-contained, no build step, no external requests): CSS +
// client-side <script> (the client script keeps its own DECIDED constant, shadowing the server-side
// one in rows.ts — that's a different runtime, left exactly as-is, no logic changes here).
//
// Pure, DOM-free mirror of the inline "replying to" context line the client <script> below renders
// for a "reply to mention" row (backend origin — carries reply_to_url/reply_to_text frontmatter
// alongside the normal kind:"text" shape; row-enrichment may surface either the camelCased
// replyToText, matching this file's sourceLines/threadSpinApplied convention, or the raw
// reply_to_text key — checked in that order). The client script can't import this (it's plain text
// rendered into the page, evaluated in the browser, not this module), so it keeps its own inline
// copy — same intentional cross-runtime duplication already called out for DECIDED above. Exists
// here purely so the row-context tweak has something a Node test can call directly, no browser DOM.
export function replyContextHtml(row: { origin?: string; replyToText?: string; reply_to_text?: string }): string {
  const text = row.replyToText ?? row.reply_to_text;
  if (row.origin !== "reply to mention" || !text) return "";
  const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
  const snippet = text.replace(/\s+/g, " ").slice(0, 220);
  return `<div class="reply-context">↳ replying to: ${esc(snippet)}</div>`;
}

// Pure, DOM-free mirror of the inline missing-image placeholder the client <script> below renders
// for a QUOTE-CARD (kind:"image") row whose PNG hasn't been rendered yet (row.assetUrl unset —
// rows.ts only sets it once existsSync() confirms the file is on disk). Before this, such a row with
// body text fell through to plain-text rendering with zero missing-image cue, indistinguishable from
// a normal text row or a fully-rendered card (card 4c3dd6fc). Mirrors the reply-context pair above:
// same cross-runtime duplication, kept in sync by hand, exists purely so this is Node-testable.
export function imageMissingHtml(row: { kind?: string; assetUrl?: string }): string {
  if (row.kind !== "image" || row.assetUrl) return "";
  return '<div class="src missing-img">— image not rendered yet —</div>';
}

// Pure, DOM-free mirror of the inline logic the client <script> below uses to clear its
// storyboardSlugs in-flight registry once a piece's real "Generate storyboard" video job actually
// resolves (done or failed) — not the instant the click fires (card fbfea28b: the old row.storyboardQueued
// flag lived until the NEXT full /api/queue refresh, with nothing clearing it on the job's own
// completion). True once at least one video job exists for the slug and none of that slug's video
// jobs are still queued/running; false while the queue hasn't caught up yet (no job for the slug
// visible) so the hint doesn't flicker off before the real job is even tracked.
export function storyboardJobDone(jobs: { kind: string; slugs?: string[]; status: string }[], slug: string): boolean {
  const forSlug = jobs.filter((j) => j.kind === "video" && (j.slugs || []).includes(slug));
  if (!forSlug.length) return false;
  return forSlug.every((j) => j.status === "done" || j.status === "failed");
}

// Pure, DOM-free mirror of the inline fmtElapsed(ms) helper the client <script> below uses. It is
// the ONE duration formatter every job surface goes through, and its only input is a measured
// elapsedMs. The click-local tickers that used to call it with a locally-started stopwatch are
// gone: a room strip and a click-started counter on the same screen disagreed by however long the
// job sat queued.
export function formatElapsed(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

// Pure, DOM-free mirror of the inline renderInsightsMeta(r) the client <script> below builds for
// the "Generate insights" meta line — a data-freshness stamp, a dated link to the full brief (never
// the brief's text; mdToHtml has no markdown-link syntax to render one), and an untagged-post
// warning. Built entirely from the server's deterministic numbers (serve.ts's generateInsights),
// never from Claude's synthesis text, so it can't be silently dropped or gotten wrong by an LLM
// pass (Muxin, 2026-07-16: Generate insights already ran live reports off the DB — the only stale
// input was the whole brief it inlined with no age signal). Same cross-runtime duplication
// convention as the mirrors above, kept in sync by hand.
export function fmtDays(n: number): string {
  return `${n} day${n === 1 ? "" : "s"}`;
}

export function renderInsightsMeta(r: {
  freshness?: { date: string; ageDays: number } | null;
  brief?: { path: string; date: string | null; ageDays: number | null } | null;
  untagged?: number;
}): string {
  const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
  const parts: string[] = [];
  if (r.freshness) parts.push(`Data current as of <b>${esc(r.freshness.date)}</b> (${fmtDays(r.freshness.ageDays)} ago)`);
  if (r.brief) {
    const label = esc(r.brief.date || r.brief.path) + (r.brief.ageDays != null ? ` (${fmtDays(r.brief.ageDays)} old)` : "");
    parts.push(`Brief: <a href="#stratBriefPanel">${label}</a>`);
  }
  if (r.untagged && r.untagged > 0) {
    parts.push(`<span class="warn">⚠ ${r.untagged} untagged post${r.untagged === 1 ? "" : "s"}</span>`);
  }
  return parts.length ? `<div class="insights-meta">${parts.join(" · ")}</div>` : "";
}

// ── job UI surfaces (Venture Build v5 §5) ────────────────────────────────────────────────────────
// Three surfaces read one source, /api/jobs (publicJob in jobs.ts): the Studio working panel, the
// per-room progress strip, and Studio's team rail. Everything below is a pure, DOM-free mirror of
// the inline client copies further down this file, same hand-synced convention as the mirrors above.
//
// The one rule this design was corrected for four times: never render a duration the system did not
// measure. Every duration comes from `elapsedMs`, and there is exactly ONE place per job per screen
// where one appears — the panel row's clock on Studio (the team rail deliberately carries no clock,
// it shares that screen), and the strip's clock in the destination room.

export interface JobView {
  id: string;
  kind: string;
  label: string;
  status: string; // "queued" | "running" | "blocked" | "done" | "failed"
  error?: string | null;
  elapsedMs?: number | null;
  lastStdoutLine?: string | null;
  steps?: string[];
  stepTotal?: number | null;
  step?: number;
  failedAtStep?: number | null;
  retryable?: boolean;
  ask?: { question: string; options: string[]; askedAt?: number } | null;
  answer?: string | null;
  logPath?: string;
  finishedAt?: number | null;
}

export type JobRoom = "Content" | "Outreach" | "Fiction" | "Signals" | "Venture" | "Charles";

export const JOB_COLORS = {
  ai: "#5b46b8", // purple: an AI is doing it
  amber: "#9a6b12",
  green: "#2f7d46",
  red: "#9a2f2f",
  grey: "#d8d2c6", // dot grey
  greyFg: "#a89a80", // the muted text that goes with it
  blue: "#2f5d9a", // Muxin's own words (the "You said:" line)
} as const;

// Which room a job lands in. Drives the rail label on `done`, the "Watch it in <Room>" link, the
// landing sentence, the team-rail name and which room's strip shows it.
export function jobRoom(kind: string): JobRoom {
  // "outreach-revise" is the Outreach thread's "Update it". It is a separate kind from "revise"
  // precisely so it lands here instead of under Content with the Formatter.
  if (kind === "scout" || kind === "draft-follow-up" || kind === "outreach-revise") return "Outreach";
  if (kind === "pull" || kind === "strategy" || kind === "insights" || kind === "ask-insights" || kind === "brief-revise") return "Signals";
  if (kind === "charles-draft") return "Charles";
  // url/file/text/notes/continue/video/develop/develop-reply/revise/duplicate — the production crew
  // ("revise" here is a CONTENT derivative revise, which belongs in Content)
  return "Content";
}

// Landing sentences (v5 §5.3), shown on `done`. They state what is WAITING, never that something
// published. Charles has no authored sentence in the design, and inventing one would be composing
// UI copy the design never wrote, so its footer stays empty.
export function jobLandingSentence(room: JobRoom): string {
  if (room === "Fiction") return "A scene draft, waiting on your read.";
  if (room === "Content") return "A cut, waiting on your yes.";
  if (room === "Outreach") return "A message, locked only when you say so.";
  if (room === "Signals") return "Filed. It writes nothing.";
  if (room === "Venture") return "An answer in the build conversation.";
  return "";
}

// The single duration formatter for every job surface. `null` elapsed means the job never started,
// so there is nothing measured to show.
export function jobElapsedText(elapsedMs: number | null | undefined): string {
  return elapsedMs == null ? "not started" : formatElapsed(elapsedMs);
}

// Studio working panel rail (v5 §5.1). On `done` the rail is the room name, green.
export function jobRailLabel(job: JobView): { text: string; color: string } {
  if (job.status === "failed") return { text: "Did not work", color: JOB_COLORS.red };
  // Amber "Needs you" only while she actually owes it an answer. Once she has answered, the row is
  // a record of a settled question, so it must stop flagging itself as urgent.
  if (job.status === "blocked") return job.answer
    ? { text: "You answered", color: JOB_COLORS.green }
    : { text: "Needs you", color: JOB_COLORS.amber };
  if (job.status === "done") return { text: jobRoom(job.kind), color: JOB_COLORS.green };
  if (job.status === "queued") return { text: "Waiting its turn", color: JOB_COLORS.greyFg };
  return { text: "Working", color: JOB_COLORS.ai };
}

// Studio working panel clock. `ahead` is how many jobs run before this one (queued only).
export function jobClockText(job: JobView, ahead: number): string {
  if (job.status === "queued") return `${ahead} ahead of it`;
  if (job.status === "failed") return `stopped after ${jobElapsedText(job.elapsedMs)}`;
  if (job.status === "done") return `took ${jobElapsedText(job.elapsedMs)}`;
  return jobElapsedText(job.elapsedMs); // running ticks, blocked is frozen by jobElapsedMs itself
}

// How many jobs run before a queued one: every job queued ahead of it, plus the one running now.
export function jobsAhead(jobs: JobView[], job: JobView): number {
  const idx = jobs.findIndex((j) => j.id === job.id);
  const queuedAhead = jobs.filter((j, i) => j.status === "queued" && i < idx).length;
  return queuedAhead + (jobs.some((j) => j.status === "running") ? 1 : 0);
}

export type DotState = "done" | "current" | "pending" | "blocked" | "failed";

// The ordered step list. `step` counts COMPLETED steps, so the step in flight is index `step`, and
// `failedAtStep` is that same 0-based index (jobs.ts sets it to `job.step` on failure).
// Production reality: no skill emits STEP markers yet, so `steps` is [] on every real job today and
// grows toward `stepTotal` mid-run. Both are normal, not edge cases.
export function jobStepDots(job: JobView): { text: string; state: DotState }[] {
  const steps = job.steps ?? [];
  const step = job.step ?? 0;
  if (job.status === "queued") return steps.map((text) => ({ text, state: "pending" as DotState }));
  if (job.status === "done") return steps.map((text) => ({ text, state: "done" as DotState }));
  if (job.status === "failed") {
    const at = job.failedAtStep;
    return steps.map((text, i) => ({
      text,
      state: at == null ? "pending" : i === at ? "failed" : i < at ? "done" : "pending",
    }));
  }
  if (job.status === "blocked") {
    // It stopped where it asked. If every step already completed, the ask sits on the last one.
    const at = Math.min(step, steps.length - 1);
    return steps.map((text, i) => ({ text, state: i === at ? "blocked" : i < at ? "done" : "pending" }));
  }
  return steps.map((text, i) => ({ text, state: i < step ? "done" : i === step ? "current" : "pending" }));
}

export function dotColor(state: DotState): string {
  if (state === "done") return JOB_COLORS.green;
  if (state === "current") return JOB_COLORS.ai;
  if (state === "blocked") return JOB_COLORS.amber;
  if (state === "failed") return JOB_COLORS.red;
  return JOB_COLORS.grey;
}

// Progress bar fill = step / stepTotal. Guarded: stepTotal is null on every job that emits no
// markers, and a bar drawn from nothing would be a number the system did not measure.
export function jobProgressPct(job: JobView): number | null {
  if (!job.stepTotal) return null;
  return Math.round((Math.min(job.step ?? 0, job.stepTotal) / job.stepTotal) * 100);
}

// Studio working panel footer (v5 §5.1). While running it is the heartbeat line, verbatim.
// Answering does not resume a dead subprocess: jobs.ts stamps the answer on the blocked job and
// queues a FRESH one carrying it, which runs its early steps again (v5 §8.1). So an answered job
// stays `blocked` with `answer` set, and saying "it stops here until you answer" would then be
// stale. This is the one string with no authored original, because the design modelled answering as
// flipping the same job to done.
export const ANSWERED_FOOTER = "You answered. A fresh job is running it from the start.";

// The echo of Muxin's own choice, set in her blue rather than the AI purple.
export function jobAnswerEcho(job: JobView): string {
  return job.answer ? `You said: ${job.answer}` : "";
}

export function jobFooter(job: JobView): string {
  if (job.status === "failed") return "It stopped where the red dot is. Nothing was written.";
  if (job.status === "blocked") return job.answer ? ANSWERED_FOOTER : "It stops here until you answer. Nothing is written in the meantime.";
  if (job.status === "done") return jobLandingSentence(jobRoom(job.kind));
  if (job.status === "queued") return "One job runs at a time, so this starts when the one above finishes.";
  return job.lastStdoutLine || "Real elapsed time, not an estimate.";
}

// The mono log line under each panel row.
export function jobLogLine(job: JobView): string {
  const path = job.logPath || "";
  if (job.status === "failed") return `> stopped at ${path}`;
  if (job.status === "blocked") return job.answer ? "> stopped, you answered it" : "> stopped, waiting on your answer";
  if (job.status === "queued") return "> waiting for a slot";
  if (job.status === "done") return `> wrote to ${path}`;
  return `> reading ${path} ...`;
}

export function jobOpenLabel(job: JobView): string {
  return `${job.status === "done" ? "Read it in" : "Watch it in"} ${jobRoom(job.kind)}`;
}

// ── the destination room's progress strip (v5 §5.2) ──
// Same source, its own authored strings (roomJobVals in the prototype writes shorter variants than
// the Studio panel does). It lingers 9 seconds after a job FINISHES so arriving late still shows
// what happened; a blocked or failed job holds the strip until it is acted on.
export const STRIP_LINGER_MS = 9000;

// How often the client re-reads /api/jobs while anything is worth watching.
export const JOBS_POLL_MS = 3000;

// A blocked job Muxin has ALREADY ANSWERED is settled work, not a demand on her. answerJob
// requeues a fresh job carrying her answer, so the original hangs around only so the question and
// what she picked stay readable. It must stop counting toward "waiting on you", stop holding the
// urgent rail state, stop holding a room strip open, and become sweepable by Clear queue.
export function jobAwaitingAnswer(job: JobView): boolean {
  return job.status === "blocked" && !job.answer;
}

// Finished as far as every surface is concerned: a clean `done`, or an answered ask.
export function jobSettled(job: JobView): boolean {
  return job.status === "done" || (job.status === "blocked" && !!job.answer);
}

// Whether the job poll should fire this beat. Queued or running work obviously needs it, but so
// does a job that JUST finished: the room strip lingers STRIP_LINGER_MS past finishedAt, and that
// linger can only expire if something keeps re-rendering until the window closes. Polling one beat
// past the window guarantees the render that actually clears the strip happens.
// `armedUntil` covers the other half: from an idle desk, an enqueue leaves nothing in `jobs` to
// look at yet, so a POST to an enqueueing route arms the poll for a moment until the new job shows
// up in the read. Without it the first progress surface for that job never appeared at all.
export function jobsPollDue(jobs: JobView[], now: number, armedUntil = 0): boolean {
  if (now < armedUntil) return true;
  if (jobs.some((j) => j.status === "queued" || j.status === "running")) return true;
  return jobs.some((j) => j.finishedAt != null && now - (j.finishedAt as number) < STRIP_LINGER_MS + JOBS_POLL_MS);
}

// Every POST route that puts a job on the queue. Some of them (a derivative revise, say) only
// answer once the whole job is finished, so waiting for the response before looking is too late:
// arming happens when the request goes out, not when it comes back.
export const JOB_ENQUEUE_ROUTES: readonly string[] = [
  "/api/atomize", "/api/notes/pick", "/api/revise", "/api/duplicate", "/api/video/generate",
  "/api/develop/start", "/api/develop/reply", "/api/develop/format",
  "/api/strategy/ask", "/api/strategy/refresh-brief", "/api/strategy/insights",
  "/api/strategy/ask-insights", "/api/strategy/pull",
  "/api/outreach/scout", "/api/outreach/draft", "/api/outreach/message/revise",
  "/api/charles/draft", "/api/followups/draft-follow-up",
];
export function enqueuesJob(path: string): boolean {
  return JOB_ENQUEUE_ROUTES.includes(path);
}

// `roomOf` is injectable only so the Fiction-failure rule below is testable today: no job kind maps
// to Fiction yet (PR 6 adds the /story draft job). The client always uses the default.
export function stripJobFor(
  jobs: JobView[], room: JobRoom, now: number, roomOf: (kind: string) => JobRoom = jobRoom,
): JobView | null {
  if (room === "Charles") return null; // Charles gets no strip; it keeps its current behavior
  const inRoom = jobs.filter((j) => roomOf(j.kind) === room);
  // An answered ask is settled: it drops out of `live` and falls to the linger below, so the
  // requeued job that carries her answer forward takes the strip instead of the question she is
  // done with.
  const live = inRoom.filter((j) => !jobSettled(j));
  const lingering = inRoom.filter((j) => j.finishedAt != null && now - (j.finishedAt as number) < STRIP_LINGER_MS);
  const candidate = live.length ? live[live.length - 1]
    : lingering.length ? lingering[lingering.length - 1]
    : null;
  if (!candidate) return null;
  // Fiction renders its own localized failure card, so the strip steps aside when the job it WOULD
  // show is that failure. One failure card per screen, never two. Judged on the newest job, not on
  // "any fiction job ever failed": an old failure left sitting in the queue must not blank the
  // strip for a Fiction job running right now, which would leave that job no progress surface.
  if (room === "Fiction" && candidate.status === "failed") return null;
  return candidate;
}

export function stripRailLabel(job: JobView): { text: string; color: string } {
  if (job.status === "failed") return { text: "Did not work", color: JOB_COLORS.red };
  if (job.status === "blocked") return job.answer
    ? { text: "You answered", color: JOB_COLORS.green }
    : { text: "Stopped, needs you", color: JOB_COLORS.amber };
  if (job.status === "done") return { text: "Just finished", color: JOB_COLORS.green };
  if (job.status === "queued") return { text: "Waiting its turn", color: JOB_COLORS.greyFg };
  return { text: "Working now", color: JOB_COLORS.ai };
}

export function stripClockText(job: JobView): string {
  if (job.status === "queued") return "not started";
  if (job.status === "failed") return `stopped after ${jobElapsedText(job.elapsedMs)}`;
  if (job.status === "done") return `took ${jobElapsedText(job.elapsedMs)}`;
  return jobElapsedText(job.elapsedMs);
}

export function stripFooter(job: JobView): string {
  if (job.status === "failed") return "It stopped where the red dot is. Nothing was written.";
  if (job.status === "blocked") return job.answer ? ANSWERED_FOOTER : "It stops here until you answer. Nothing is written in the meantime.";
  if (job.status === "done") return jobLandingSentence(jobRoom(job.kind));
  if (job.status === "queued") return "One job runs at a time. This starts when the current one finishes.";
  return job.lastStdoutLine || "Real elapsed time, not an estimate.";
}

// ── Studio's team rail (v5 §5.2) ──

export function teamRailHeader(jobs: JobView[]): string {
  // Only an UNANSWERED ask is waiting on her. Once she answers, the header must stop saying she
  // owes the team something.
  if (jobs.some(jobAwaitingAnswer)) return "YOUR TEAM, WAITING ON YOU";
  if (jobs.some((j) => j.status === "running")) return "YOUR TEAM, WORKING";
  return "YOUR TEAM, IDLE";
}

// One live row per unfinished job, named for the room it lands in.
export function teamRoomName(room: JobRoom): string {
  if (room === "Fiction") return "Co-writer";
  if (room === "Content") return "Formatter";
  if (room === "Outreach") return "Connector";
  if (room === "Signals") return "Reader";
  if (room === "Venture") return "Build";
  return "Charles";
}

export interface TeamRow {
  who: string;
  what: string;
  color: string;
  urgent: boolean;
  action: string;
}

export function teamLiveRows(jobs: JobView[]): TeamRow[] {
  return jobs
    .filter((j) => !jobSettled(j)) // an answered ask is finished; it stops asking "ANSWER IT"
    .map((j) => {
      const steps = j.steps ?? [];
      const inFlight = steps.length ? steps[Math.min(j.step ?? 0, steps.length - 1)].toLowerCase() : j.label;
      return {
        who: teamRoomName(jobRoom(j.kind)),
        what:
          j.status === "failed" ? "Stopped: it did not work"
            : j.status === "blocked" ? "Stopped: needs your answer"
            : j.status === "queued" ? "queued behind another job"
            : inFlight,
        color:
          j.status === "failed" ? JOB_COLORS.red
            : j.status === "blocked" ? JOB_COLORS.amber
            : j.status === "queued" ? JOB_COLORS.grey
            : JOB_COLORS.ai,
        urgent: j.status === "failed" || j.status === "blocked",
        action: j.status === "failed" ? "SEE WHAT STOPPED IT" : j.status === "blocked" ? "ANSWER IT" : "",
      };
    })
    .sort((a, b) => Number(b.urgent) - Number(a.urgent));
}

// Reconcile with the resting rows /api/studio already builds (buildStudioHome in studio.ts) so no
// agent ever appears twice. Two rows get dropped: any whose NAME already appears live, and any that
// studio.ts derived from the very same jobs (its `working` row, and its "Queue" row) — those would
// otherwise restate a live row under a different name and carry a second duration for one job.
export function restingTeamRows<T extends { name: string; state: string }>(resting: T[], live: TeamRow[]): T[] {
  const liveNames = new Set(live.map((r) => r.who));
  return resting.filter((r) => !liveNames.has(r.name) && r.state !== "working" && r.name !== "Queue");
}

// ── Outreach room: triage + thread (design v7 §3, static half) ──
// The room reads as two screens off ONE /api/outreach/leads read. Triage groups every lead by the
// reason it is on the desk; picking one opens its thread. Everything below is a pure mirror of the
// inline browser copy further down, so node:test can check the judgment without a DOM. Keep the two
// in sync by hand — the repo's standing convention for this file.

export interface OutreachContactView {
  name: string;
  role?: string;
}

export interface OutreachEvidenceView {
  id?: string;
  signal?: string;
  person?: string;
  source?: string;
  quote?: string;
  description?: string;
}

export interface OutreachMessageView {
  file?: string;
  channel?: string;
  status?: string;
  recipient?: string;
  body?: string;
}

export interface OutreachLeadView {
  dir: string;
  kind?: string;
  name?: string;
  source?: string;
  status?: string;
  segment?: string;
  pitchAngle?: string;
  pitch?: string;
  whyThem?: string;
  whyMe?: string;
  whyMutual?: string;
  contacts?: OutreachContactView[];
  evidence?: OutreachEvidenceView[];
  latestMessage?: OutreachMessageView | null;
}

// `fm.segment` is read by readLeadDetail() but no producer in this repo writes it, so it is always
// "" in practice. The real driver is the kind/source derivation below, which has FOUR values, not
// the prototype's three: content-example leads are real rows on the desk and get their own group
// rather than being dropped.
export function outreachSegment(lead: OutreachLeadView): string {
  if (lead.segment) return lead.segment;
  if (lead.kind === "platform") return "platform";
  if (lead.kind === "client") return lead.source === "jsa" ? "org-role" : "org-mission";
  return "content-example";
}

// Group names and notes lifted verbatim from the design's own SEGS array. The fourth group's note
// is the line this page already shipped for content-example leads, kept as written.
export const OUTREACH_SEGMENTS: { key: string; name: string; note: string }[] = [
  { key: "platform", name: "PLATFORMS", note: "Where the audience already is. Bring the work, not a pitch." },
  { key: "org-mission", name: "ORGANIZATIONS · MISSION FIT", note: "They do the thing you write about. Bring the overlap." },
  { key: "org-role", name: "ORGANIZATIONS · OPEN ROLES", note: "They are hiring for what you already built. Bring the receipt." },
  { key: "content-example", name: "EXAMPLES", note: "raw material for a writing angle" },
];

export function groupLeadsBySegment(
  leads: OutreachLeadView[],
): { key: string; name: string; note: string; leads: OutreachLeadView[] }[] {
  return OUTREACH_SEGMENTS.map((s) => ({
    ...s,
    leads: leads.filter((l) => outreachSegment(l) === s.key),
  })).filter((g) => g.leads.length > 0);
}

// The "when" column on a triage row. Real tracker events only: a lead with no event, or an event
// with no timestamp, says so plainly instead of showing a measured-looking date it never measured.
export function lastPitchedLabel(lastTouch: string | null | undefined): string {
  const t = (lastTouch ?? "").trim();
  return t ? `pitched ${t.slice(0, 10)}, by hand` : "never pitched";
}

export function threadSegLabel(segment: string): string {
  if (segment === "platform") return "PLATFORM · SELECTED";
  if (segment === "org-mission") return "MISSION FIT · SELECTED";
  if (segment === "org-role") return "OPEN ROLE · SELECTED";
  return "EXAMPLE · SELECTED";
}

// The matchmaker read. `legacy` marks a lead qualified before the why_* fields existed: it falls
// back to the pitch angle and SAYS it is a legacy read, rather than passing pitch-strategy prose
// off as the matchmaker's three-way answer.
export function matchmakerRead(lead: OutreachLeadView): {
  legacy: boolean;
  headline: string;
  rows: { k: string; v: string }[];
} {
  const hasMatchmaker = !!(lead.whyMutual || lead.whyThem || lead.whyMe);
  if (!hasMatchmaker) {
    return {
      legacy: true,
      headline: (lead.pitchAngle || lead.pitch || "").trim() || "(no read recorded yet)",
      rows: [],
    };
  }
  const rows: { k: string; v: string }[] = [];
  if (lead.whyThem) rows.push({ k: "Why them, for you", v: lead.whyThem });
  if (lead.whyMe) rows.push({ k: "Why you, for them", v: lead.whyMe });
  if (lead.whyMutual) rows.push({ k: "Why the two of you", v: lead.whyMutual });
  return { legacy: false, headline: (lead.whyMutual || lead.whyThem || lead.whyMe || "").trim(), rows };
}

// 0, 1 or several people. Zero is the plain zero case, not a flag: a lead with nobody named yet is
// still a lead you can write to.
export function contactsLine(contacts: OutreachContactView[] | undefined): string {
  const n = (contacts ?? []).length;
  if (n === 0) return "No named contact yet. Add one, or write to the organization.";
  if (n === 1) {
    const name = (contacts ?? [])[0].name;
    return `You are writing to ${name}${/[.!?]$/.test(name) ? "" : "."}`;
  }
  return `${n} people here. Each one gets its own message and its own follow-up clock.`;
}

// Mirror of isValidSourceUrl in src/outreach/qualify.ts, same posture: https?:// with a dotted
// host, or vault:<path> for evidence cited from Muxin's own vault. Kept here so the rail can say
// "no source recorded" instead of rendering a claim with nothing behind it.
const OUTREACH_PLACEHOLDER_SOURCES = new Set(["(none)", "none", "n/a", "na", "tbd", "unknown", ""]);
export function isEvidenceSourceValid(source: string | undefined): boolean {
  const trimmed = (source ?? "").trim();
  if (!trimmed || OUTREACH_PLACEHOLDER_SOURCES.has(trimmed.toLowerCase())) return false;
  if (/^vault:/i.test(trimmed)) {
    const path = trimmed.slice("vault:".length).trim();
    return path.length > 0 && !OUTREACH_PLACEHOLDER_SOURCES.has(path.toLowerCase());
  }
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    return new URL(trimmed).hostname.includes(".");
  } catch {
    return false;
  }
}

export const NO_SOURCE_RECORDED = "no source recorded";

// What the evidence rail shows under a quote. There is no timestamp anywhere in EvidenceItem, so
// there is no date to fall back on: an item with nothing valid behind it says it has nothing.
export function evidenceSourceView(source: string | undefined): { kind: "link" | "text" | "none"; text: string } {
  const trimmed = (source ?? "").trim();
  if (!isEvidenceSourceValid(trimmed)) return { kind: "none", text: NO_SOURCE_RECORDED };
  if (/^https?:\/\//i.test(trimmed)) return { kind: "link", text: trimmed };
  return { kind: "text", text: trimmed };
}

// Locked and sent are two different states and never collapse into one check. Locking readies the
// text; only Muxin's own hands send it, and only her own click records that it went.
//
// This reads ONLY the message's own status, because that is the only per-message fact the repo
// measures. The tracker's lastTouch is keyed lead:person, not message, so a lead whose message-01
// went out months ago would otherwise stamp "sent" on a message-02 nobody has touched. The logged
// send is reported separately, as the lead-level fact it actually is.
export type OutreachSendState = "none" | "draft" | "locked";
export function outreachSendState(message: OutreachMessageView | null | undefined): OutreachSendState {
  if (!message) return "none";
  return (message.status ?? "").trim() === "locked" ? "locked" : "draft";
}

export function outreachSendNote(state: OutreachSendState): string {
  if (state === "draft") return "Locking readies it. You send it by hand, and nothing here can send it for you.";
  if (state === "locked") return "Paste it into your mail client and send it there. Tell me once it has gone.";
  return "";
}

// "NOT SENT" is dropped once a send is on the ledger for this lead, so the badge never argues with
// the line below it. It never claims THIS message is the one that went: nothing records that.
export function outreachSendBadge(state: OutreachSendState, hasLoggedSend: boolean): string {
  if (state !== "locked") return "";
  return hasLoggedSend ? "LOCKED · NOT EDITABLE" : "LOCKED · NOT EDITABLE, NOT SENT";
}

// The lead-level send fact, straight off the tracker event that recorded it.
export function leadSendLogLine(lastTouch: string | null | undefined): string {
  const t = (lastTouch ?? "").trim();
  return t ? `A send was logged ${t.slice(0, 10)}, by hand. See Follow-ups.` : "";
}

// ── The thread's three phases, and the line that opens it (v7 §3, conversational half) ──
// Nothing new is stored to know which phase a thread is in. A lead with no drafted message is
// waiting on Muxin's direction, a lead with a draft job in flight is drafting, and a lead with a
// message on disk is drafted. The phase is read off those facts, never off a parallel state flag
// that could disagree with what is actually on disk.
export type OutreachThreadPhase = "asking" | "drafting" | "drafted";
export function outreachThreadPhase(
  message: OutreachMessageView | null | undefined,
  drafting: boolean,
): OutreachThreadPhase {
  if (drafting) return "drafting";
  return message ? "drafted" : "asking";
}

// One sentence, cut at its first full stop and capped, so a paragraph-long matchmaker read does not
// swallow the opening line. The full read is already rendered above it.
export function firstSentence(text: string | undefined, cap: number): string {
  const t = (text ?? "").trim();
  if (!t) return "";
  const m = t.match(/^[\s\S]*?[.?!](?=\s|$)/);
  let s = (m ? m[0] : t).trim();
  if (s.length > cap) s = `${s.slice(0, cap).replace(/[\s,;:]+\S*$/, "")}...`;
  return s;
}

// The AI's opening line, built from whyThem/whyMe/whyMutual (v7 handoff §3's own recommendation:
// matchmaker.ts already wrote that read, so the line quotes it instead of inventing a fresh reason
// the system never recorded). A lead with no read on file says so rather than making one up.
export function outreachOpeningLine(lead: OutreachLeadView): string {
  const who = (lead.name || lead.dir || "this one").trim();
  const read = matchmakerRead(lead);
  const reason = firstSentence(read.headline, 180);
  if (!reason || reason === "(no read recorded yet)") {
    return `I put ${who} in front of you, and there is no research read on file yet. Tell me what you want this message to say and I will write it in your voice.`;
  }
  const tail = /[.?!]$/.test(reason) ? "" : ".";
  return `I put ${who} in front of you for this reason: ${reason}${tail} Want to lead with that, or keep it short and just ask for a quick chat?`;
}

// Not fully static: it interpolates the dev-worktree banner (isDevWorktree + repoRoot), so this is
// exported as a function of those two inputs rather than a bare constant — serve.ts calls
// renderPage({ repoRoot, isDevWorktree: IS_DEV_WORKTREE }) from its GET / route.
export function renderPage(opts: { repoRoot: string; isDevWorktree: boolean }): string {
  return /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Review queue</title>
<style>
  :root {
    --paper:#faf8f3; --ink:#1c1a17; --muted:#7a7266; --line:#e7e1d6; --card:#fffdf8;
    --green:#2f7d46; --green-bg:#e7f2ea; --amber:#9a6b12; --amber-bg:#f7efdc;
    --red:#9a2f2f; --red-bg:#f6e6e3; --blue:#2f5d9a; --blue-bg:#e6ecf5; --accent:#1c1a17;
  }
  * { box-sizing:border-box; }
  /* The studio desk (Content Studio Riff design): the page is a walnut desk, each work surface a
     sheet of paper laid on it. Warm-paper tokens keep styling everything ON the sheets. */
  body { margin:0; color:var(--ink);
    font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    min-height:100vh; background-color:#231508;
    background-image:radial-gradient(120% 80% at 50% -12%, rgba(234,202,150,.20), rgba(234,202,150,0) 55%),
      repeating-linear-gradient(90deg, rgba(0,0,0,.42) 0 2px, rgba(120,80,40,.06) 2px 4px, transparent 4px 236px),
      repeating-linear-gradient(90.6deg, rgba(255,255,255,.022) 0 1px, transparent 1px 6px, rgba(0,0,0,.12) 6px 7px, transparent 7px 13px),
      repeating-linear-gradient(89.4deg, rgba(0,0,0,.10) 0 2px, transparent 2px 9px),
      linear-gradient(180deg, #45311d 0%, #2b1b0e 55%, #1d1006 100%);
    background-attachment:fixed; }
  header { position:sticky; top:0; z-index:5; background:rgba(29,16,6,.88);
    backdrop-filter:blur(8px); border-bottom:1px solid rgba(230,213,175,.16); padding:13px 26px;
    display:flex; align-items:center; gap:18px; flex-wrap:wrap; }
  h1 { font:700 14px/1.2 Georgia,"Times New Roman",serif; margin:0; letter-spacing:.2px; color:#e6d5af; }
  nav.rooms { display:flex; gap:18px; }
  .room { border:none; background:none; padding:2px 0 4px; font:inherit; font-size:13px;
    color:#b7a686; cursor:pointer; border-bottom:1.5px solid transparent; border-radius:0; }
  .room:hover { color:#f4e8ca; border-color:transparent; }
  .room.on { color:#f4e8ca; font-weight:600; border-bottom-color:#cbaf87; }
  .room .count { background:#f4e8ca; color:#3a2a12; margin-left:6px; }
  .desk-date { font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; color:#a89876; }
  header .hint { color:#a89876; }
  header > button#refresh { border:1px solid rgba(230,213,175,.4); background:transparent; color:#e6d5af; }
  header > button#refresh:hover { border-color:#e6d5af; }
  header label.toggle { color:#a89876; }
  /* Paper sheets on the desk */
  .sheet { position:relative; background:#fbf9f4; border-radius:5px; margin:26px auto;
    max-width:1040px; padding:44px 56px 40px;
    box-shadow:0 34px 66px -24px rgba(45,36,20,.5), 0 8px 22px rgba(45,36,20,.16); }
  .sheet-head { display:flex; align-items:baseline; gap:14px; flex-wrap:wrap; }
  .sheet-head h2 { font:400 26px/1.25 Georgia,"Times New Roman",serif; margin:0; }
  .sheet-sub { font-size:13.5px; color:#8a7f6d; margin-top:5px; }
  .mono-note { font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; color:#b0a488; }
  /* Capture sheet (3a): the blank page */
  .capture-title { font:400 40px/1.2 Georgia,"Times New Roman",serif; letter-spacing:-.01em; margin-bottom:16px; }
  .capture textarea { width:100%; min-height:110px; font:17px/1.6 Georgia,"Times New Roman",serif;
    padding:4px 0; border:none; outline:none; background:transparent; resize:vertical; color:var(--ink); }
  .capture textarea::placeholder { color:#a89a80; }
  .director-line { margin-top:34px; padding-top:20px; border-top:1px solid #efe7d6;
    display:flex; align-items:flex-start; gap:14px; }
  .d-avatar { width:30px; height:30px; border-radius:50%; background:#efeafd; border:1px solid #d8cff2;
    display:flex; align-items:center; justify-content:center; font:italic 700 14px/1 Georgia,serif;
    color:#5b46b8; flex:none; }
  .d-line-main { font-size:13.5px; line-height:1.5; color:#4a453c; }
  .d-line-sub { font-size:12.5px; color:#8a7f6d; font-style:italic; }
  /* Workbench session sheets (3b): main column + director margin */
  .session { padding:0; overflow:hidden; }
  .session-grid { display:grid; grid-template-columns:minmax(0,1fr) 300px; }
  .session-main { padding:44px 36px 40px 56px; min-width:0; }
  .session-margin { border-left:1px solid #efe7d6; padding:44px 26px 36px 24px; background:#faf7f0;
    display:flex; flex-direction:column; gap:16px; }
  .wb-title { font:600 20px/1.3 Georgia,"Times New Roman",serif; margin-bottom:16px; }
  .wb-label { font:italic 400 13px/1.5 Georgia,serif; color:#a89a80; margin-bottom:12px; }
  .wb-source { font:400 19px/1.55 Georgia,"Times New Roman",serif; color:var(--ink);
    padding-left:18px; border-left:2px solid var(--blue); white-space:pre-wrap; }
  .wb-source.clamped { max-height:180px; overflow:hidden;
    -webkit-mask-image:linear-gradient(180deg,#000 60%,transparent); mask-image:linear-gradient(180deg,#000 60%,transparent); }
  .wb-expand { font-size:12.5px; color:#7a7266; border-bottom:1px solid #d8cfbb; cursor:pointer; width:fit-content; margin-top:6px; }
  .wb-sep { margin:36px 0 0; display:flex; align-items:center; gap:12px; }
  .wb-sep span.rule { height:1px; flex:1; background:#efe7d6; }
  .wb-sep span.txt { font:italic 400 14px/1 Georgia,serif; color:#a89a80; }
  .wb-cut { margin-top:26px; }
  .wb-cut-head { display:flex; align-items:baseline; gap:10px; margin-bottom:10px; flex-wrap:wrap; }
  .wb-cut-head .lens { font:600 13px/1 Georgia,serif; color:#5b46b8; }
  .wb-cut-head .sub { font-size:12px; color:#8a7f6d; font-style:italic; }
  .wb-cut-body { font:400 22px/1.55 Georgia,"Times New Roman",serif; color:var(--ink); white-space:pre-wrap; }
  .wb-cut textarea { width:100%; min-height:140px; font:400 18px/1.55 Georgia,serif; padding:10px 12px;
    border:1px solid var(--muted); border-radius:8px; background:#fff; }
  .wb-handoff { margin-top:40px; padding-top:22px; border-top:1px solid #efe7d6;
    display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
  .wb-handoff .note { font-size:13px; color:#7a7266; line-height:1.5; max-width:340px; }
  .wb-links { margin-top:14px; display:flex; gap:20px; flex-wrap:wrap; }
  .wb-link { font-size:13px; color:#7a7266; border-bottom:1px solid #d8cfbb; padding-bottom:1px; cursor:pointer; background:none; border-top:none; border-left:none; border-right:none; border-radius:0; padding-top:0; padding-left:0; padding-right:0; }
  .wb-check { display:flex; flex-direction:column; gap:5px; padding-left:12px; border-left:2px solid #d8cff2; }
  .wb-check.sand { border-left-color:#e6dcc4; }
  .wb-check.green { border-left-color:#cbe0d1; }
  .wb-check .t { font-size:12.5px; font-weight:600; color:var(--ink); }
  .wb-check .t .verdict { color:#5b46b8; }
  .wb-check.sand .t .verdict { color:#a89a80; }
  .wb-check.green .t .verdict { color:var(--green); }
  .wb-check .d { font-size:12.5px; line-height:1.5; color:#5a5346; }
  .wb-margin-cap { font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; color:#a89a80; letter-spacing:.06em; }
  .wb-margin-sub { font:italic 400 13px/1.5 Georgia,serif; color:#8a7f6d; }
  .wb-reply { margin-top:auto; padding-top:16px; border-top:1px solid #efe7d6; display:flex; flex-direction:column; gap:8px; }
  .wb-reply input { font:italic 13px/1.4 Georgia,serif; border:1px solid #e6dcc4; background:#fbf9f4;
    border-radius:8px; padding:8px 12px; color:var(--ink); width:100%; }
  .wb-proposal { margin-top:26px; padding:14px 16px; background:#faf7f0; border:1px solid #efe7d6; border-radius:10px; }
  /* Studio home (3c): stat tiles + the ranked needs-you list + the team margin */
  .stat-tiles { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-top:20px; }
  .stat-tile { border:1px solid #efe7d6; border-radius:10px; padding:14px 16px; background:#faf7f0;
    display:flex; flex-direction:column; gap:3px; }
  .stat-tile .n { font:400 30px/1 Georgia,serif; }
  .stat-tile .l { font-size:12px; color:#5a5346; line-height:1.3; }
  .ny-row { display:grid; grid-template-columns:82px 1fr auto; gap:16px; align-items:baseline;
    padding:13px 0; border-top:1px solid #efe7d6; }
  .ny-room { font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; text-transform:uppercase; letter-spacing:.05em; color:#5a5346; }
  .ny-row.urgent .ny-room { color:#9a6b12; }
  .ny-text { font-size:15px; color:var(--ink); }
  .ny-detail { color:#8a7f6d; }
  .team-row { display:flex; align-items:flex-start; gap:10px; }
  .team-dot { width:8px; height:8px; border-radius:50%; margin-top:5px; flex:none; }
  .team-name { font-size:13px; font-weight:600; color:var(--ink); }
  .team-line { font-size:12px; color:#8a7f6d; }
  /* Outreach room (3d/3g): the dossier on the desk + the follow-ups ledger */
  .lead-rail { display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding-bottom:16px; border-bottom:1px solid #efe7d6; margin-bottom:20px; }
  .lead-chip { display:inline-flex; align-items:center; gap:7px; border:1px solid #e6dcc4; background:#fbf9f4;
    border-radius:20px; padding:4px 12px; font-size:12.5px; color:#5a5346; cursor:pointer; }
  .lead-chip.on { border:1.5px solid var(--ink); background:#fff; color:var(--ink); }
  .lead-chip .dot { width:7px; height:7px; border-radius:50%; flex:none; }
  .lead-chip .k { color:#8a7f6d; }
  .seg-chip { font:700 10px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.05em;
    text-transform:uppercase; padding:2px 8px; border-radius:5px; }
  .seg-chip.platform { background:var(--blue-bg); color:var(--blue); }
  .seg-chip.org-role { background:var(--amber-bg); color:var(--amber); }
  .seg-chip.org-mission { background:var(--green-bg); color:var(--green); }
  .seg-chip.content-example { background:#efeae0; color:#5a5346; }
  .fit-chip { font:700 10px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.05em;
    text-transform:uppercase; padding:2px 8px; border-radius:5px; background:var(--green-bg); color:var(--green); }
  .legacy-chip { font:10px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; color:#8a6a2a; background:var(--amber-bg); padding:2px 8px; border-radius:9px; }
  .dossier-grid { display:grid; grid-template-columns:minmax(0,1fr) 300px; gap:0 28px; }
  .dossier-why { font:400 22px/1.5 Georgia,"Times New Roman",serif; color:var(--ink); margin:8px 0 0; }
  .mm-grid { display:flex; flex-direction:column; gap:14px; margin:24px 0 0; }
  .mm-row { display:grid; grid-template-columns:120px 1fr; gap:16px; align-items:baseline; }
  .mm-row .k { font:italic 400 14px/1.4 Georgia,serif; color:#8a7f6d; }
  .mm-row .v { font-size:14px; line-height:1.55; color:#3a352c; }
  .who-box { margin:22px 0 0; padding:14px 16px; background:#faf7f0; border:1px solid #efe7d6; border-radius:10px; }
  .who-chip { display:inline-flex; align-items:center; gap:8px; border:1.5px solid var(--ink); background:#fff;
    border-radius:20px; padding:5px 12px; font-size:13px; margin:0 6px 6px 0; }
  .who-chip .role { color:#8a7f6d; }
  .who-suggest { display:inline-flex; align-items:center; gap:8px; border:1px dashed #d8cfbb; background:#fbf9f4;
    border-radius:20px; padding:5px 12px; font-size:13px; color:#5a5346; margin:0 6px 6px 0; }
  .who-suggest button { font-size:11.5px; padding:1px 8px; }
  .sent-bar { margin-top:14px; background:#faf7f0; border:1px solid #efe7d6; border-radius:10px; padding:14px 16px;
    display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
  .sent-bar select, .sent-bar input.fu-note { font:inherit; font-size:12.5px; border:1px solid #d8cfbb; background:#fbf9f4;
    border-radius:7px; padding:5px 10px; color:var(--ink); }
  .sent-bar button.go { border:none; background:var(--green); color:#fbf9f4; border-radius:7px; padding:6px 13px; font-weight:600; }
  /* Outreach thread, the conversational half: the AI's opening line, then Muxin's typed direction.
     Rule 4 of the handoff, held here: her words are Georgia serif on the blue quote rule, the AI's
     suggested angle is labelled in purple. The two never look like the same hand wrote them. */
  .dir-box { margin:16px 0 0; max-width:600px; background:#fffdf8; border:1px solid #d8cfbb; border-radius:8px; padding:16px 18px; }
  .dir-open { display:flex; flex-direction:column; gap:6px; max-width:600px; margin-top:18px; }
  .dir-open .cap { font:600 12.5px/1 Georgia,serif; color:#5b46b8; }
  .dir-open .line { font:400 17px/1.6 Georgia,"Times New Roman",serif; color:var(--ink); }
  .dir-box textarea { width:100%; box-sizing:border-box; border:none; outline:none; background:transparent;
    padding:0; resize:vertical; font:400 16px/1.55 Georgia,"Times New Roman",serif; color:var(--ink); }
  .dir-go { display:flex; align-items:center; gap:12px; margin-top:12px; padding-top:12px; border-top:1px solid #efe7d6; }
  .dir-go button { background:var(--ink); color:#fbf9f4; border:none; border-radius:7px; padding:7px 15px;
    font-size:13.5px; font-weight:600; white-space:nowrap; }
  .dir-go button[disabled] { opacity:.5; }
  .dir-go .note { font-size:12.5px; line-height:1.5; color:#8a7f6d; }
  .dir-said { margin-top:18px; max-width:600px; padding-left:16px; border-left:2px solid #2f5d9a; }
  .dir-said .cap { font:10px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.06em; color:#a89a80; margin-bottom:4px; }
  .dir-said .said { font:400 17px/1.55 Georgia,"Times New Roman",serif; color:var(--ink); white-space:pre-wrap; }
  .ev-quote { font:italic 400 13px/1.55 Georgia,serif; color:#3a352c; }
  .ev-src { font-size:12px; color:#7a7266; border-bottom:1px solid #d8cfbb; width:fit-content; text-decoration:none; }
  .ev-nosrc { font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; color:#a89a80; }
  /* Outreach triage: the queue grouped by why, one row per lead, one click into the thread */
  .tri-cap { font:10.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.06em;
    color:#a89a80; text-transform:uppercase; margin-bottom:20px; }
  .tri-group { display:flex; flex-direction:column; gap:9px; margin-bottom:22px; }
  .tri-head { display:flex; flex-direction:column; gap:2px; }
  .tri-name { font:10px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.05em; color:#7a6f5c; }
  .tri-note { font-size:12.5px; line-height:1.5; color:#8a7f6d; }
  button.tri-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:14px; align-items:baseline;
    width:100%; text-align:left; border:none; border-top:1px solid #f2ece0; border-radius:0;
    background:none; padding:9px 12px; margin:0; color:inherit; }
  button.tri-row:hover { background:#f4efe3; }
  .tri-who { min-width:0; display:flex; flex-direction:column; gap:2px; }
  .tri-who .w { font:400 16px/1.4 Georgia,"Times New Roman",serif; color:var(--ink); }
  .tri-who .y { font-size:12.5px; line-height:1.5; color:#7a7266;
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .tri-when { font:10.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; color:#a89a80; white-space:nowrap; }
  .tri-when.on { color:var(--green); }
  /* Outreach thread: one lead, read end to end */
  button.out-back { border:none; background:none; padding:0; font-size:13px; color:#7a7266;
    border-bottom:1px solid #d8cfbb; border-radius:0; margin-bottom:20px; }
  .thread-head { display:flex; flex-direction:column; gap:4px; margin-bottom:16px; }
  .thread-seg { font:10.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.06em; color:#a89a80; }
  .thread-who { font:400 27px/1.3 Georgia,"Times New Roman",serif; color:var(--ink); }
  .thread-person { font-size:13.5px; line-height:1.5; color:#7a7266; }
  .send-steps { margin-top:16px; display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
  .send-note { font-size:13px; line-height:1.5; color:#7a7266; max-width:330px; }
  /* Follow-ups ledger rows */
  .fu-row { padding:18px 0 14px; border-top:1px solid #efe7d6; }
  .fu-head { display:grid; grid-template-columns:12px minmax(0,1fr) auto; gap:14px; align-items:baseline; }
  .fu-dot { width:8px; height:8px; border-radius:50%; margin-top:4px; }
  .fu-name { font-size:16px; font-weight:600; color:var(--ink); }
  .fu-org { font-size:15px; color:#5a5346; font-weight:400; }
  .fu-meta { font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; color:#8a7f6d; margin-top:3px; }
  .fu-next { font-size:14px; font-weight:600; }
  .fu-origin { margin:14px 0 12px 26px; background:#faf7f0; border:1px solid #efe7d6; border-radius:10px;
    padding:16px 18px; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:18px; }
  .fu-origin .cap { font:10.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; color:#a89a80; text-transform:uppercase; letter-spacing:.05em; margin-bottom:4px; }
  .fu-origin .cell { font-size:13px; line-height:1.5; color:#3a352c; }
  .fu-actions { margin-left:26px; display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
  /* Outreach room subnav (Leads | Follow-ups) */
  .subnav { display:flex; gap:3px; align-items:center; background:rgba(0,0,0,.28); border-radius:20px;
    padding:3px; width:fit-content; margin:22px auto 0; }
  .subtab { font-size:12px; color:#e6d5af; border:none; background:none; border-radius:16px; padding:4px 13px; cursor:pointer; }
  .subtab.on { font-weight:600; background:#f4e8ca; color:#3a2a12; }
  .count { background:var(--accent); color:var(--paper); border-radius:20px; padding:2px 11px;
    font-size:13px; font-weight:600; }
  .grow { flex:1; }
  label.toggle { font-size:13px; color:var(--muted); display:flex; align-items:center; gap:6px; cursor:pointer; }
  button { font:inherit; cursor:pointer; border:1px solid var(--line); background:var(--card);
    color:var(--ink); border-radius:7px; padding:6px 12px; transition:.12s; }
  button:hover { border-color:var(--muted); }
  button:disabled { opacity:.4; cursor:default; }
  main { max-width:1100px; margin:0 auto; padding:6px 22px 120px; }
  .piece { margin:26px 0 8px; }
  .piece > h2 { font:600 15px/1.3 Georgia,serif; margin:0 0 2px; }
  .piece > .slug { color:var(--muted); font-size:12px; margin-bottom:12px; }
  .row { background:var(--card); border:1px solid var(--line); border-radius:11px;
    padding:14px 16px; margin:10px 0; box-shadow:0 1px 0 rgba(0,0,0,.02); }
  .row.decided { opacity:.62; }
  .rowhead { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:9px; }
  .badge { font-size:11px; font-weight:700; letter-spacing:.4px; text-transform:uppercase;
    padding:2px 8px; border-radius:5px; background:#efeae0; color:#5a5346; }
  .badge.x{background:#e9edf2;color:#2c3e50}.badge.linkedin{background:#e4ecf5;color:#1c4e8a}
  .badge.bluesky{background:#e3eefb;color:#1f6fd6}.badge.tiktok{background:#f0e9f2;color:#5a2c66}
  .badge.quote-card{background:#f3ecdf;color:#7a5a1c}.badge.video-script,.badge.youtube{background:#f6e3e1;color:#9a2f2f}
  .badge.substack{background:#fbe7dd;color:#a3441c}
  .fmt { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.4px; }
  .pill { font-size:11px; font-weight:700; padding:2px 9px; border-radius:20px; margin-left:auto; }
  .pill.approve{background:var(--green-bg);color:var(--green)}
  .pill.revise{background:var(--amber-bg);color:var(--amber)}
  .pill.discard{background:#eee;color:var(--muted)}
  .pill.published{background:var(--blue-bg);color:var(--blue)}
  .pill.locked{background:var(--blue-bg);color:var(--blue)}
  .pill.blocked{background:var(--red-bg);color:var(--red)}
  .pill.needs{background:#efe9db;color:#8a6d1e}
  .spin { font-size:11px; background:#efeafd; color:#5b46b8; padding:2px 8px; border-radius:5px; font-weight:600; }
  .thread-pass { font-size:11px; background:var(--green-bg); color:var(--green); padding:2px 8px; border-radius:5px; font-weight:600; }
  .thread-missing { font-size:11px; background:var(--amber-bg); color:var(--amber); padding:2px 8px; border-radius:5px; font-weight:600; }
  .origin { font-size:11px; background:#e9e5da; color:#6b6355; padding:2px 8px; border-radius:5px; font-weight:600; }
  .src { font-size:11px; color:var(--muted); }
  .body { white-space:pre-wrap; font-size:14.5px; line-height:1.6; margin:4px 0 6px;
    padding:11px 13px; background:var(--paper); border:1px solid var(--line); border-radius:8px; }
  /* No max-height: a video script is read in FULL before it is approved, and a fixed 260px window
     with only macOS's auto-hiding overlay scrollbar as the cue hid most of a typical script behind
     a scroll nobody could see. The sheet itself scrolls, so letting this grow hides nothing. */
  .body.story { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12.5px; color:#4a453c; }
  textarea { width:100%; min-height:120px; font:14.5px/1.6 inherit; padding:11px 13px;
    border:1px solid var(--muted); border-radius:8px; background:#fff; resize:vertical; }
  img.preview { max-width:340px; width:100%; border-radius:8px; border:1px solid var(--line); display:block; }
  video.preview { max-width:340px; width:100%; border-radius:8px; border:1px solid var(--line); display:block; }
  .notes { font-size:12.5px; color:var(--amber); margin:4px 0 0; }
  .approve-blocked { font-size:12.5px; color:var(--red); margin:4px 0 0; font-weight:600; }
  .scheduled { font-size:12.5px; color:var(--green); font-weight:600; margin:4px 0 0; }
  .recon-ok { font-size:12.5px; color:var(--green); font-weight:600; margin:4px 0 0; }
  .recon-mismatch { font-size:12.5px; color:var(--red); font-weight:600; margin:4px 0 0; }
  .recon-unknown { font-size:12.5px; color:var(--muted); margin:4px 0 0; }
  .reply-context { font-size:12.5px; color:var(--muted); margin:4px 0 0; }
  .actions { display:flex; gap:7px; margin-top:11px; flex-wrap:wrap; align-items:center; }
  .actions .spacer { flex:1; }
  button.approve{border-color:var(--green);color:var(--green)}
  button.approve.on{background:var(--green);color:#fff}
  button.revise{border-color:var(--amber);color:var(--amber)}
  button.revise.on{background:var(--amber);color:#fff}
  button.discard.on{background:#6b6459;color:#fff;border-color:#6b6459}
  button.save{border-color:var(--accent);background:var(--accent);color:var(--paper)}
  .empty { text-align:center; color:var(--muted); padding:60px 20px; }
  .revisebox { margin-top:9px; display:none; gap:7px; }
  .revisebox.show { display:flex; }
  .revisebox input { flex:1; font:inherit; padding:7px 10px; border:1px solid var(--muted); border-radius:7px; }
  button.ai { border-color:#5b46b8; color:#5b46b8; }
  button.ai:hover { background:#efeafd; }
  .aibox { margin-top:9px; display:none; gap:7px; flex-wrap:wrap; }
  .aibox.show { display:flex; }
  .aibox input { flex:1; font:inherit; padding:7px 10px; border:1px solid #5b46b8; border-radius:7px; }
  .aibox button.send { border-color:#5b46b8; background:#5b46b8; color:#fff; }
  .aierr { flex-basis:100%; color:var(--red); font-size:12.5px; font-weight:600; }
  .thinking { font-size:13px; color:#5b46b8; font-weight:600; padding:4px 0; }
  .thinking .ticker { color:var(--muted); font-weight:400; }
  button.storyboard { border-color:var(--blue); color:var(--blue); }
  button.storyboard:hover { background:var(--blue-bg); }
  button.dup { border-color:#7a5a1c; color:#7a5a1c; }
  button.dup:hover { background:#f3ecdf; }
  .dupbox { margin-top:9px; display:none; gap:7px; flex-wrap:wrap; align-items:center; }
  .dupbox.show { display:flex; }
  .dupbox select { font:inherit; padding:7px 10px; border:1px solid #7a5a1c; border-radius:7px; background:#fff; }
  .dupbox button.send { border-color:#7a5a1c; background:#7a5a1c; color:#fff; }
  button.cancel { border-color:var(--red); color:var(--red); }
  button.cancel:hover { background:#fdecec; }
  .duperr { flex-basis:100%; color:var(--red); font-size:12.5px; font-weight:600; }
  .view[hidden] { display:none; }
  .ingest { max-width:820px; margin:0 auto; }
  .ingest textarea { width:100%; min-height:130px; font:15px/1.6 inherit; padding:13px 15px;
    border:1px solid var(--muted); border-radius:10px; background:#fff; resize:vertical; }
  .ingest-actions { display:flex; gap:9px; align-items:center; margin-top:11px; flex-wrap:wrap; }
  button.primary { background:var(--accent); color:var(--paper); border-color:var(--accent); font-weight:600; }
  .hint { font-size:12px; color:var(--muted); flex:1; min-width:220px; line-height:1.4; }
  .notes-panel { max-width:820px; margin:16px auto 0; background:var(--card); border:1px solid var(--line);
    border-radius:10px; padding:14px 16px; }
  .notes-head { display:flex; align-items:center; gap:12px; margin-bottom:8px; flex-wrap:wrap; }
  .notes-head h3 { font:600 14px/1.3 Georgia,serif; margin:0; }
  /* .notelist deliberately has no height rule. Same reason as .body.story above: a fixed 420px
     window clipped whole notes mid-card with no visible scrollbar, so a complete list and a
     truncated one looked identical. The page scrolls already. */
  .notepick { display:flex; align-items:flex-start; gap:10px; padding:9px 4px; border-bottom:1px solid var(--line); }
  .notepick:last-child { border-bottom:none; }
  .notepick.drafted { opacity:.5; }
  .notepick.redraftable { opacity:.85; }
  .notepick.redraftable .drafted-tag { color:var(--green); }
  .notepick input[type=checkbox] { margin-top:3px; flex:0 0 auto; }
  .notepick .ntext { flex:1; min-width:0; font-size:13.5px; line-height:1.45; }
  .notepick .nmeta { font-size:11.5px; color:var(--muted); margin-bottom:2px; }
  .notepick .nmeta .drafted-tag { color:var(--blue); font-weight:600; }
  /* Outreach lead cards: why-fit first, JSA logistics as a table, prose collapsed (Muxin,
     2026-07-16: "a mountain of text with very little signal"). */
  .kind-badge { font-size:11px; font-weight:700; letter-spacing:.4px; text-transform:uppercase;
    padding:2px 8px; border-radius:5px; background:#e4ecf5; color:#1c4e8a; }
  .lead-why { margin:6px 0 2px; font-size:14px; line-height:1.5; }
  .lead-details { margin-top:6px; font-size:13px; }
  .lead-details summary { cursor:pointer; color:var(--blue); font-size:12.5px; }
  .lead-details .ntext { margin-top:6px; white-space:pre-wrap; }
  .jsa-stats { border-collapse:collapse; margin:8px 0; font-size:12.5px; }
  .jsa-stats th,.jsa-stats td { border:1px solid var(--line); padding:4px 9px; text-align:left; vertical-align:top; }
  .jsa-stats th { background:#f1ede3; font-weight:600; white-space:nowrap; }
  .lead-msg { margin-top:10px; padding:10px 12px; border:1px solid var(--line); border-radius:8px; background:var(--paper); }
  .lead-msg textarea.msg-edit { min-height:140px; margin-top:6px; }
  .lead-notes { margin-top:8px; }
  .lead-notes .my-notes { white-space:pre-wrap; font-size:13px; color:var(--amber); }
  .fu-note { font:inherit; font-size:12.5px; padding:5px 9px; border:1px solid var(--line); border-radius:7px; min-width:200px; }
  .notes-actions { display:flex; gap:9px; align-items:center; margin-top:12px; flex-wrap:wrap; }
  .strategy { max-width:820px; margin:0 auto; }
  .strategy-actions { display:flex; gap:9px; align-items:center; margin-bottom:6px; flex-wrap:wrap; }
  .md { font-size:14px; line-height:1.6; }
  .md h1,.md h2,.md h3 { font-family:Georgia,"Times New Roman",serif; margin:16px 0 6px; }
  .md h1 { font-size:18px; } .md h2 { font-size:15.5px; } .md h3 { font-size:14px; }
  .md h1:first-child,.md h2:first-child,.md h3:first-child { margin-top:0; }
  .md p { margin:7px 0; }
  .md ul { margin:5px 0 10px 20px; padding:0; }
  .md li { margin:3px 0; }
  .md table { border-collapse:collapse; width:100%; margin:9px 0; font-size:12.5px; }
  .md th,.md td { border:1px solid var(--line); padding:5px 9px; text-align:left; vertical-align:top; }
  .md th { background:#f1ede3; font-weight:700; }
  .md code { background:#efeae0; padding:1px 5px; border-radius:4px; font-size:12px; }
  .insights-panel { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:14px 16px; margin-top:12px; }
  .insights-meta { font-size:12px; color:var(--muted); margin-bottom:10px; padding-bottom:10px; border-bottom:1px solid var(--line); }
  .insights-meta a { color:var(--blue); }
  .insights-meta .warn { color:var(--red); font-weight:600; }
  .thread-turn { margin-top:10px; padding-top:10px; border-top:1px solid var(--line); }
  .thread-turn.q { font-weight:600; color:var(--muted); font-size:13.5px; border-top:none; padding-top:0; }
  .jobs { max-width:820px; margin:24px auto 0; }
  .jobs-head { display:flex; align-items:center; justify-content:space-between; gap:9px; margin-bottom:8px; }
  .jobs-head h3 { font:600 13px/1.3 Georgia,serif; color:var(--muted); margin:0; text-transform:uppercase; letter-spacing:.5px; }
  .jobs-head button { font-size:12px; padding:4px 10px; }
  .job { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:12px 15px;
    margin:9px 0; display:flex; align-items:center; gap:12px; }
  .job .jlabel { flex:1; min-width:0; font-size:14px; }
  .job .jlabel .txt { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:block; }
  .job .jkind { font-size:11px; text-transform:uppercase; letter-spacing:.4px; color:var(--muted); }
  .job .jerr { color:var(--red); font-size:12.5px; white-space:normal; margin-top:3px; }
  .job .jheartbeat { color:var(--muted); font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px; }
  .job .jelapsed { color:var(--muted); font-size:12px; }
  .job a.jlog { font-size:12px; color:var(--blue); text-decoration:none; }
  .job a.jump { font-size:12.5px; color:var(--blue); text-decoration:none; font-weight:600; }
  .spin-dot { width:9px; height:9px; border-radius:50%; background:var(--amber); flex:0 0 auto;
    animation:pulse 1s ease-in-out infinite; }
  @keyframes pulse { 0%,100%{opacity:.3} 50%{opacity:1} }
  /* Job working panel (v5 §5.1): one row per job, rail + clock + ordered steps + ask/failure box.
     Exactly one duration per row: the clock, top right. The team rail carries none on purpose. */
  .jrow { border:1px solid #dfd4bb; border-radius:8px; background:var(--card); padding:16px 18px; margin:14px 0; }
  .jrow.asking { border-color:#e8d5a8; }
  .jrow.bad { border-color:#ecc9c0; }
  .jrow-head { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:16px; align-items:baseline; }
  .jrow-rail { font:10.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; text-transform:uppercase;
    letter-spacing:.05em; display:block; }
  .jrow-text { font:400 16px/1.45 Georgia,"Times New Roman",serif; color:var(--ink); display:block; margin-top:4px;
    overflow-wrap:anywhere; }
  .jrow-clock { font:9.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.05em;
    color:#a89a80; white-space:nowrap; }
  .jrow-bar { height:3px; background:#eae2ce; border-radius:2px; margin-top:13px; overflow:hidden; }
  .jrow-bar span { display:block; height:3px; transition:width .4s ease; }
  .jsteps { margin-top:13px; display:flex; flex-direction:column; gap:7px; }
  .jstep { display:grid; grid-template-columns:9px minmax(0,1fr); gap:12px; align-items:baseline; font-size:13px; line-height:1.5; }
  .jstep i { width:7px; height:7px; border-radius:50%; margin-top:6px; display:block; }
  .jstep.pending { color:#a89a80; }
  .jstep.done { color:#3a352c; }
  .jstep.current { color:var(--ink); }
  .jstep.current i { animation:pulse 1.1s ease-in-out infinite; }
  .jstep.failed { color:var(--red); }
  .jbox { margin-top:14px; padding:13px 15px; border-radius:8px; max-width:560px;
    background:#fdf8ec; border:1px solid #e8d5a8; }
  .jbox.bad { background:#fdf1ef; border-color:#ecc9c0; }
  .jbox .q { font-size:14px; line-height:1.55; color:var(--ink); }
  .jbox .opts { display:flex; gap:8px; margin-top:11px; flex-wrap:wrap; }
  .jbox button { border:1px solid var(--ink); background:var(--card); color:var(--ink); border-radius:7px;
    padding:6px 13px; font-size:13px; }
  .jfoot { font-size:12.5px; color:#8a7f6d; line-height:1.5; margin-top:12px; }
  .jrow-tail { margin-top:13px; padding-top:12px; border-top:1px solid #f2ece0; display:flex; gap:16px;
    align-items:baseline; flex-wrap:wrap; }
  .jrow-tail .jpath { font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; color:#a89a80; min-width:0;
    overflow-wrap:anywhere; }
  .jrow-tail .grow { flex:1; }
  .jrow-tail a { font-size:12.5px; color:#7a7266; border-bottom:1px solid #d8cfbb; text-decoration:none; white-space:nowrap; }
  /* The destination room's progress strip: same data, its own shorter strings. */
  .room-strip { border-top:1px solid #dfd4bb; border-bottom:1px solid #efe7d6; padding:15px 0 17px;
    margin-bottom:28px; max-width:600px; }
  .room-strip .sh { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:14px; align-items:baseline; }
  .room-strip .sh .rail { font:10.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; text-transform:uppercase; letter-spacing:.06em; }
  .room-strip .sh .clock { font:10.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; color:#8a7f6d; white-space:nowrap; }
  .room-strip .stext { font:400 17px/1.5 Georgia,"Times New Roman",serif; color:var(--ink); margin-top:7px; overflow-wrap:anywhere; }
  .room-strip .jsteps { margin-top:11px; gap:6px; }
  .team-action { font:9.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.05em;
    color:var(--amber); border-bottom:1px solid #e0cfa4; width:fit-content; margin-top:2px; }
  .team-row.urgent .team-line { color:var(--amber); font-weight:600; }
  .flash { position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:var(--accent);
    color:var(--paper); padding:9px 16px; border-radius:8px; font-size:13px; opacity:0;
    transition:.2s; pointer-events:none; }
  .flash.show { opacity:1; }
  .worktree-banner { background:var(--red-bg); color:var(--red); font-size:12.5px; font-weight:600;
    text-align:center; padding:6px 16px; border-bottom:1px solid var(--red); }
  /* Develop tab: advisor recommendation cards. The one signature element is the verbatim
     pull-quote — Muxin's own lines, set in the page's serif behind a blue-pencil rule (visually
     rhyming with the Cuts tab's margin notes) — so "what the advisor thinks" (plain sans) and
     "what's actually Muxin's" (serif quote, the only text that can become a cut) never blur. */
  .dev-card { background:var(--card); border:1px solid var(--line); border-radius:11px;
    padding:14px 16px; margin:10px 0; box-shadow:0 1px 0 rgba(0,0,0,.02); }
  .dev-card.decided { opacity:.62; }
  .dev-kind { font-size:11px; font-weight:700; letter-spacing:.4px; text-transform:uppercase;
    padding:2px 8px; border-radius:5px; flex:0 0 auto; }
  .dev-kind.angle { background:var(--blue-bg); color:var(--blue); }
  .dev-kind.cta { background:var(--amber-bg); color:var(--amber); }
  .dev-kind.spin { background:#efeafd; color:#5b46b8; }
  .dev-kind.routing { background:var(--green-bg); color:var(--green); }
  .dev-kind.note { background:#efeae0; color:#5a5346; }
  .dev-summary { font-size:13.5px; color:#4a453c; margin:4px 0 6px; white-space:pre-wrap; }
  .dev-preview-label { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.4px; margin-top:8px; }
  .dev-preview { font:15px/1.65 Georgia,"Times New Roman",serif; white-space:pre-wrap;
    margin:4px 0 6px; padding:10px 14px; background:var(--paper);
    border-left:3px solid var(--blue); border-radius:0 8px 8px 0; }
  .dev-lens { font:inherit; font-size:12.5px; padding:5px 9px; border:1px solid var(--line); border-radius:7px; width:150px; }
  .dev-round-reply { font-size:13px; color:var(--muted); font-weight:600; margin:14px 0 2px; }
  .dev-format { display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin:10px 0 4px;
    padding:10px 14px; border:1px dashed var(--line); border-radius:9px; }
  .dev-working { font-size:13px; color:#5b46b8; font-weight:600; margin:6px 0; }
</style>
</head>
<body>
${opts.isDevWorktree ? `<div class="worktree-banner">⚠ Dev worktree checkout (${opts.repoRoot}) — data/content here is isolated and gitignored, not synced with your main repo. Numbers may look empty/stale even when your real pipeline is fine.</div>` : ""}
<header>
  <h1>Content studio</h1>
  <nav class="rooms">
    <button class="room on" data-room="content">Content <span class="count" id="count" hidden>0</span></button>
    <button class="room" data-room="studio">Studio</button>
    <button class="room" data-room="outreach">Outreach</button>
    <button class="room" data-room="fiction">Fiction</button>
    <button class="room" data-room="charles">Charles</button>
    <button class="room" data-room="signals">Signals</button>
  </nav>
  <span class="grow"></span>
  <span class="desk-date" id="deskDate"></span>
  <span class="hint" id="lastRefreshed" style="min-width:0"></span>
  <button id="refresh" title="Refreshes only the room you're looking at">Refresh</button>
</header>
<main>
  <section class="view" id="roomContent">
    <div class="sheet" id="stripContent" hidden style="padding:24px 56px 10px"></div>
    <div class="sheet capture">
      <div class="capture-title" id="captureTitle">What's on your mind today?</div>
      <textarea id="src" placeholder="Start typing. Paste a link, a file path, or half a sentence. Nothing is a form. (⌘/Ctrl+Enter hands it over)"></textarea>
      <div class="ingest-actions">
        <button class="primary" id="devStartBtn">Hand it to your director</button>
        <button id="addBtn" title="Skip the director's read and go straight to platform drafts">Format directly</button>
        <button id="notesBtn">Browse Substack Notes</button>
      </div>
      <div class="director-line">
        <span class="d-avatar">d</span>
        <div>
          <div class="d-line-main">Your creative director is here when you want a read.</div>
          <div class="d-line-sub">Won't touch a word without your say. Handles the platforms, the visuals, the posting. Asks you only for the calls that are yours. <span style="color:#5b46b8;">— your director</span></div>
        </div>
      </div>
      <div class="notes-panel" id="notesPanel" hidden>
        <div class="notes-head">
          <h3>Substack Notes</h3>
          <label class="toggle"><input type="checkbox" id="notesShowDrafted" /> show already drafted</label>
          <span class="grow"></span>
          <button id="notesCloseBtn">Close</button>
        </div>
        <div class="notelist" id="notesList"><div class="empty">Loading…</div></div>
        <div class="notes-actions">
          <button class="primary" id="notesDraftBtn">Draft selected</button>
          <span class="hint">Pick the notes worth cross-posting. Each one gets a folder and goes through the production pipeline; every draft still waits for your yes below. A note published in the last 30 days stays blocked.</span>
        </div>
      </div>
    </div>
    <div id="workbench"></div>
    <div class="sheet" id="reviewSheet">
      <div class="sheet-head">
        <h2>Drafts for your yes</h2>
        <span class="grow"></span>
        <label class="toggle" id="decidedWrap"><input type="checkbox" id="showDecided" /> show published / discarded</label>
      </div>
      <div class="sheet-sub">Approve schedules it. Nothing posts without a yes here.</div>
      <div id="reviewMain" style="margin-top:14px"><div class="empty">Loading…</div></div>
    </div>
  </section>
  <section class="view" id="roomStudio" hidden>
    <div class="sheet session">
      <div class="session-grid">
        <div class="session-main" id="studioMain"><div class="empty">Loading…</div></div>
        <div class="session-margin" id="studioTeam"></div>
      </div>
    </div>
    <div class="sheet">
      <div class="sheet-head"><h2>The queue</h2></div>
      <div class="sheet-sub">Every background job, honest elapsed time, a log link. Nothing here needs babysitting.</div>
      <div class="jobs" id="jobs" style="max-width:none;margin-top:10px"></div>
    </div>
  </section>
  <section class="view" id="roomFiction" hidden>
    <div class="sheet" id="stripFiction" hidden style="padding:24px 56px 10px"></div>
    <div class="sheet session">
      <div class="session-grid">
        <div class="session-main" id="fictionMain"><div class="empty">Loading…</div></div>
        <div class="session-margin" id="fictionSide"></div>
      </div>
    </div>
  </section>
  <section class="view" id="roomCharles" hidden>
    <div class="sheet capture">
      <div class="capture-title">Draft a new Charles post</div>
      <div class="ingest-actions" style="align-items:center">
        <select id="charlesMode">
          <option value="oneliner">One-liner</option>
          <option value="essay">Essay</option>
          <option value="reply">Reply to a link</option>
        </select>
        <input id="charlesInput" style="flex:1;min-width:220px" placeholder="Topic/angle, or a URL to react to (reply) — optional otherwise" />
        <button class="primary" id="charlesDraftBtn">Draft</button>
      </div>
      <div class="hint">Runs the real /charles skill on your subscription ($0 marginal), same as Format directly does for Content. Lands in the queue below as "pending" — nothing posts on its own.</div>
    </div>
    <div class="sheet">
      <div class="sheet-head"><h2>Persona brief</h2><span class="grow"></span><button id="charlesBriefCopyBtn">Copy</button></div>
      <div class="sheet-sub">Muxin's original brief, verbatim — for pasting into whatever else she's using for meme research (e.g. Grok).</div>
      <textarea id="charlesBriefText" readonly style="width:100%;min-height:140px;margin-top:10px;font:400 13px/1.6 ui-monospace,monospace;padding:12px 14px;border:1px dashed #e0d6c0;border-radius:8px;background:#fcfbf7;resize:vertical;"></textarea>
    </div>
    <div class="sheet session">
      <div class="session-grid">
        <div class="session-main" id="charlesMain"><div class="empty">Loading…</div></div>
        <div class="session-margin" id="charlesSide"></div>
      </div>
    </div>
  </section>
  <section class="view" id="roomSignals" hidden>
    <div class="sheet" id="stripSignals" hidden style="padding:24px 56px 10px"></div>
    <div class="sheet">
    <div class="sheet-head"><h2>Signals</h2><span class="grow"></span><span class="src" id="signalsBriefDate"></span></div>
    <div class="sheet-sub">Where you fit so far, what's worth changing (your call), and what's too weak to trust. Data tunes the dials, never the person.</div>
    <div id="signalsTop"><div class="empty">Loading…</div></div>
    <div class="wb-sep" style="margin-top:30px"><span class="rule"></span><span class="txt">go deeper</span><span class="rule"></span></div>
    <div class="strategy" style="max-width:none;margin-top:14px">
      <div class="strategy-actions">
        <button class="primary" id="insightsBtn">Generate insights</button>
        <span class="hint">Runs the analytics reports live against the current database, then asks Claude (your subscription, $0) for a short skim: what's working, what's not, the numbers that matter, plus any data-hygiene next steps. The prior-cycle brief is linked, dated, not dumped in full. Nothing here writes data or publishes anything.</span>
      </div>
      <div class="insights-panel" id="insightsPanel" hidden>
        <div class="md" id="insightsOut"></div>
        <div id="insightsThread"></div>
        <div class="aibox show">
          <input placeholder="ask a follow-up… (e.g. why is X underperforming?)" id="insightsAskInput" />
          <button class="send" id="insightsAskBtn">Ask</button>
        </div>
      </div>
    </div>
    <div class="notes-panel" id="stratBriefPanel">
      <div class="notes-head">
        <h3>Latest strategy brief</h3>
        <span class="grow"></span>
        <span class="src" id="briefPath"></span>
        <button id="briefToggleBtn">Show brief</button>
        <button class="primary" id="briefRefreshBtn" title="Runs the full /strategy skill: grades last cycle's bets, writes a new dated brief, records new bets. Takes minutes.">Refresh brief (runs /strategy)</button>
      </div>
      <div id="briefBodyWrap" hidden>
        <div class="md" id="briefBody">Loading…</div>
        <div class="aibox show">
          <input placeholder="tell Claude what to change in the brief…" id="briefAskInput" />
          <button class="send" id="briefAskBtn">Send to Claude</button>
        </div>
        <span class="hint">Edits land in the brief file itself. Formatting and strategy runs read the latest brief every time, so a change here feeds forward with no extra step.</span>
      </div>
      <span class="hint">Refresh brief runs the REAL /strategy (your subscription, $0): grades bets against fresh data and writes a new dated brief, same as running it in a terminal.</span>
    </div>
    <div class="notes-panel">
      <div class="notes-head">
        <h3>Raw downloaded exports</h3>
        <span class="src" id="rawLastPull"></span>
        <span class="grow"></span>
        <button class="primary" id="rawPullBtn">Pull fresh now</button>
        <button id="rawRefreshBtn">Reload list</button>
      </div>
      <div id="rawList"><div class="empty">Loading…</div></div>
      <span class="hint">The actual CSV/JSON/XLSX files pulled from each platform (data/inbox = not yet ingested, data/processed = archived after npm run ingest). "Reload list" only re-reads what's already on disk — it does NOT fetch anything new. "Pull fresh now" is the real pull: it launches real Chrome with your saved logins for LinkedIn/X/Substack and can take a few minutes; it otherwise only runs Sundays at 07:00 via cron. Open a file yourself if you want the raw numbers rather than a computed report.</span>
    </div>
    </div>
  </section>
  <section class="view" id="roomOutreach" hidden>
    <div class="subnav">
      <button class="subtab on" data-sub="leads">Leads</button>
      <button class="subtab" data-sub="followups">Follow-ups</button>
    </div>
    <div class="sheet" id="stripOutreach" hidden style="padding:24px 56px 10px"></div>
    <div class="sheet" id="outreachPane">
      <div class="sheet-head"><h2 id="outreachHead">Leads</h2></div>
      <div class="sheet-sub">Everyone your scout found, grouped by the reason they are on the desk. Pick one to read the research and shape a message. Only you ever send it.</div>
      <div id="outreachList" style="margin-top:14px"><div class="empty">Loading…</div></div>
    </div>
    <div class="sheet" id="followupsPane" hidden>
      <div class="sheet-head"><h2>Follow-ups</h2></div>
      <div class="sheet-sub">Everything you've sent, and what's next. The clock starts when you click Mark sent. Nothing here sends anything.</div>
      <div id="followupsNote"></div>
      <div id="followupsList" style="margin-top:14px"><div class="empty">Loading…</div></div>
    </div>
  </section>
</main>
<div class="flash" id="flash"></div>
<script>
const $ = (s, r=document) => r.querySelector(s);
let DATA = { pieces: [], pending: 0 };
let showDecided = false;
const DECIDED = new Set(["published","discard","locked"]);
// In-flight action registries, keyed by stable row.id / piece.slug — NOT stored on the row/DATA
// objects. The 3s job poll (setInterval below) calls load() on ANY job status change anywhere,
// which replaces DATA wholesale and rebuilds every row's DOM from scratch; a flag or "thinking…"
// innerHTML living on the row/DOM gets clobbered by that unrelated refresh, well before the actual
// operation finishes (card fbfea28b). Keying by id/slug instead of the row object also survives
// load() swapping in a fresh row object mid-await.
const aiPending = new Set();       // row ids with an in-flight Ask-Claude revise
const dupPending = new Map();      // row id -> target platform, for an in-flight Duplicate
const storyboardSlugs = new Set(); // piece slugs with an in-flight storyboard (video) job

function flash(msg){ const f=$("#flash"); f.textContent=msg; f.classList.add("show"); setTimeout(()=>f.classList.remove("show"),1400); }
function esc(s){ return (s??"").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

async function load(){
  const r = await fetch("/api/queue"); DATA = await r.json();
  render();
}
// Armed when a POST that enqueues a job goes OUT. Some of those routes only answer once the whole
// job has finished, so waiting for the response would be too late to ever show its progress.
let jobsPollArmedUntil = 0;
async function post(path, body){
  if(enqueuesJob(path)) jobsPollArmedUntil = Date.now() + JOBS_POLL_MS * 3;
  const r = await fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  return r.json();
}

function statusLabel(s){ return s ? s : "needs"; }
function pillClass(s){ return s && ["approve","revise","discard","published","blocked","locked"].includes(s) ? s : "needs"; }

function rowEl(piece, row){
  const el = document.createElement("div");
  const decided = DECIDED.has(row.status);
  el.className = "row" + (decided ? " decided" : "");
  el.dataset.id = row.id;

  const spin = row.spin ? '<span class="spin">spin · '+esc(row.angle||"")+'</span>' : "";
  const src = row.sourceLines ? '<span class="src">lines '+esc(JSON.stringify(row.sourceLines))+'</span>' : "";
  const thread = row.threadCheck === "missing"
    ? '<span class="thread-missing">thread: missing'+(row.threadSpinApplied?" · spin-drafted":"")+'</span>'
    : row.threadCheck === "pass"
    ? '<span class="thread-pass">thread: pass</span>'
    : "";
  // Origin source-tag (Muxin, 2026-07-04): which pipeline created this row. Omitted (not guessed)
  // for a row written before this field existed — see src/publish/queue.ts QUEUE_ORIGINS.
  const origin = row.origin ? '<span class="origin">'+esc(row.origin)+'</span>' : "";
  // "reply to mention" rows (card db22283f) carry reply_to_url/reply_to_text alongside the normal
  // kind:"text" shape — show what's being replied to inline so Muxin has context without opening
  // the file. Checks camelCase first (this file's own sourceLines/threadSpinApplied convention),
  // then the raw frontmatter key, in case row-enrichment surfaces it un-cased.
  const replyText = row.replyToText ?? row.reply_to_text;
  const replyContext = (row.origin === "reply to mention" && replyText)
    ? '<div class="reply-context">↳ replying to: '+esc(replyText.replace(/\\s+/g," ").slice(0,220))+'</div>'
    : "";
  let preview = "";
  if (row.assetUrl && row.kind === "image") preview = '<img class="preview" src="'+row.assetUrl+'" alt="card" />';
  else if (row.assetUrl && row.kind === "video") preview = '<video class="preview" src="'+row.assetUrl+'" controls muted></video>';
  // Quote-card row whose PNG hasn't been rendered yet — flag it explicitly instead of falling
  // through to plain-text rendering, which looked identical to a normal card (card 4c3dd6fc).
  else if (row.kind === "image") preview = '<div class="src missing-img">— image not rendered yet —</div>';
  if (row.body !== undefined && row.body !== "") {
    const cls = row.kind === "storyboard" ? "body story" : "body";
    preview += '<div class="'+cls+'" data-body>'+esc(row.body)+'</div>';
  }
  if (!preview) preview = '<div class="src">— no asset generated yet —</div>';

  const notes = row.notes && row.notes.trim() ? '<div class="notes">note: '+esc(row.notes)+'</div>' : "";
  const sched = row.scheduledWhen ? '<div class="scheduled">✓ scheduled · '+esc(row.scheduledWhen)+'</div>' : "";
  // Live reconciliation against the real provider (Typefully/PostPeer) — the authoritative check,
  // unlike sched above which is just what the client remembers asking for at approve-time.
  const recon = row.reconciled;
  let reconHtml = "";
  // "Cancel scheduled post" only shows once live reconciliation actually CONFIRMS a row is still
  // scheduled at the provider — never on a mere "approved"/"published" status, which can already
  // be stale (drifted, or provider-side canceled outside this pipeline). Card e4eca4a1.
  let cancelBtn = "";
  if (recon && recon.state === "scheduled") {
    reconHtml = '<div class="recon-ok">✓ live at '+esc(recon.provider)+(recon.when ? ' · '+esc(recon.when) : '')+'</div>';
    cancelBtn = '<button class="cancel" data-act="cancel">✕ Cancel scheduled post</button>';
  } else if (recon && recon.state === "mismatch") {
    reconHtml = '<div class="recon-mismatch">⚠ not found at '+esc(recon.provider)+' — '+esc(recon.reason||"mismatch")+'</div>';
  } else if (recon && recon.state === "unavailable" && recon.provider === "upload-post") {
    // The retired Upload-Post provider (PR #130 deleted its adapter) has no live check and can't be
    // canceled from here — point straight at the dashboard instead of a dead-end "unavailable".
    reconHtml = '<div class="recon-unknown">⚠ scheduled via the retired Upload-Post provider — check/cancel by hand at '+
      '<a href="https://upload-post.com" target="_blank" rel="noopener">upload-post.com</a></div>';
  } else if (recon && recon.state === "unavailable") {
    reconHtml = '<div class="recon-unknown">provider check unavailable ('+esc(recon.provider)+') — '+esc(recon.reason||"")+'</div>';
  }
  const cancelErr = row.cancelError ? '<div class="recon-mismatch">⚠ cancel failed: '+esc(row.cancelError)+'</div>' : "";
  const manual = row.manualComment ? '<div class="notes">↳ add as first comment in Typefully: '+esc(row.manualComment)+'</div>' : "";
  const editBtn = row.editable ? '<button data-act="edit">Edit</button>' : "";
  const aiBtn = row.revisable ? '<button class="ai" data-act="ai">✨ Ask Claude</button>' : "";
  // "Generate storyboard" (card 9e20a616): the video-path dead end — a video-script row you can't
  // approve because storyboard.md doesn't exist yet, and no way to run /video without a terminal.
  // storyboardSlugs (module-level, keyed by piece.slug — card fbfea28b) tracks the in-flight state
  // instead of a row flag, so it survives the background poll's load() rebuilding this row's DOM.
  const storyboardBtn = row.canGenerateStoryboard
    ? (storyboardSlugs.has(piece.slug)
        ? '<span class="hint">✨ generating storyboard… (the Studio room has progress)</span>'
        : '<button class="storyboard" data-act="gen-storyboard">🎬 Generate storyboard</button>')
    : "";
  // "Duplicate to platform" (card 9304e4a5's missing "create a post for another platform"):
  // options come from DATA.textPlatforms (server's TEXT_PLATFORMS), excluding this row's own
  // platform so the dropdown only ever offers an actual new target.
  const dupBtn = row.duplicatable ? '<button class="dup" data-act="dup">⧉ Duplicate to platform…</button>' : "";
  const dupOptions = (DATA.textPlatforms || [])
    .filter((p) => p !== row.platform)
    .map((p) => '<option value="'+esc(p)+'">'+esc(p)+'</option>')
    .join("");
  const schedulable = ["x","linkedin","bluesky"].includes(row.platform);
  const approveLabel = schedulable ? "Approve → schedule" : "Approve";
  // Keep warning + disabled state even once status is "approve" — that's the phantom-approval
  // case (hand-edited row, or the asset removed after a valid approval) this guard exists to catch.
  const approveDisabled = !!row.approveBlocked;
  const blockedNote = approveDisabled ? '<div class="approve-blocked">⚠ '+esc(row.approveBlocked)+'</div>' : "";

  el.innerHTML =
    '<div class="rowhead">'+
      '<span class="badge '+esc(row.platform.split(":")[0])+'">'+esc(row.platform)+'</span>'+
      '<span class="fmt">'+esc(row.format)+' · '+esc(row.id)+'</span>'+ spin + thread + origin + src +
      '<span class="pill '+pillClass(row.status)+'">'+esc(statusLabel(row.status))+'</span>'+
    '</div>'+
    replyContext + preview + notes + sched + reconHtml + cancelErr + manual + blockedNote +
    '<div class="actions">'+
      '<button class="approve'+(row.status==="approve"?" on":"")+'" data-act="approve"'+
        (approveDisabled ? ' disabled title="'+esc(row.approveBlocked)+'"' : "")+'>'+approveLabel+'</button>'+
      '<button class="revise'+(row.status==="revise"?" on":"")+'" data-act="revise">Revise</button>'+
      '<button class="discard'+(row.status==="discard"?" on":"")+'" data-act="discard">Discard</button>'+
      '<span class="spacer"></span>'+ storyboardBtn + editBtn + aiBtn + dupBtn + cancelBtn +
    '</div>'+
    '<div class="revisebox"><input placeholder="what needs changing?" value="'+esc(row.notes||"")+'" /><button data-act="save-note">Save note</button></div>'+
    // Reopens (and stays open) when a prior "Ask Claude" attempt failed, or while one is in flight
    // (aiPending, keyed by row.id — card fbfea28b), so the thinking indicator/error is still visible
    // after the row's next rerender (a background job poll no longer wipes it), not a 1.4s toast.
    // Also durably shows Claude's REFUSAL reason (card 9304e4a5 part 4) — same mechanism, a real
    // explanation instead of a silent no-op.
    '<div class="aibox'+((row.aiError||aiPending.has(row.id))?" show":"")+'">'+
      (aiPending.has(row.id)
        ? '<div class="thinking">✨ Claude is revising… (your subscription, ~10-30s)</div>'
        : '<input placeholder="tell Claude what to change…" /><button class="send" data-act="ai-send">Send to Claude</button>'+
          (row.aiError ? '<div class="aierr">⚠ '+esc(row.aiError)+'</div>' : ""))+
    '</div>'+
    (row.duplicatable
      ? '<div class="dupbox'+((row.dupError||dupPending.has(row.id))?" show":"")+'">'+
        (dupPending.has(row.id)
          ? '<div class="thinking">✨ Claude is drafting the '+esc(dupPending.get(row.id))+' version. The strip at the top of this room carries the clock.</div>'
          : '<select>'+dupOptions+'</select><button class="send" data-act="dup-send">Duplicate</button>'+
            (row.dupError ? '<div class="duperr">⚠ '+esc(row.dupError)+'</div>' : ""))+
      '</div>'
      : "");

  el.addEventListener("click", (e)=>onAction(e, piece, row, el));
  return el;
}

async function onAction(e, piece, row, el){
  const act = e.target.dataset.act; if(!act) return;
  if (act === "approve" || act === "discard"){
    e.target.disabled = true;
    const r = await post("/api/status",{slug:piece.slug,id:row.id,status:act});
    if (act === "approve"){
      if (r.ok === false){ flash(r.error || "Approve blocked"); }
      else if (row.kind === "outreach-message" && r.scheduled){
        // Outreach Phase 2: Approve here calls lock.ts, not a real scheduler — nothing sends,
        // nothing schedules (CLAUDE.md rule 2 analog). Never say "Scheduled" for this row kind.
        row.status="locked";
        flash("Locked");
      }
      else if (r.scheduled){
        row.status="published"; row.scheduledWhen=r.scheduled.when; row.manualComment=r.scheduled.manualComment||"";
        // A YouTube Short with no "youtube" cadence configured uploads PRIVATE instead of on a real
        // publish schedule (see publishShorts) — flag that distinctly instead of a generic "Scheduled"
        // that reads the same as an actually-scheduled post.
        flash(r.scheduled.autoPublishes === false ? "Uploaded (still PRIVATE — flip it manually in YouTube Studio) · "+r.scheduled.when : "Scheduled · "+r.scheduled.when);
      }
      else if (r.scheduleError){ row.status="approve"; flash("Approved — schedule failed: "+r.scheduleError); }
      else { row.status="approve"; flash("Approved"); }
    } else { row.status="discard"; flash("Discarded"); }
    rerender();
  } else if (act === "revise"){
    el.querySelector(".revisebox").classList.toggle("show");
  } else if (act === "save-note"){
    const note = el.querySelector(".revisebox input").value;
    await post("/api/status",{slug:piece.slug,id:row.id,status:"revise",notes:note});
    row.status="revise"; row.notes=note; flash("Marked revise"); rerender();
  } else if (act === "edit"){
    const bodyEl = el.querySelector("[data-body]"); if(!bodyEl) return;
    const ta = document.createElement("textarea"); ta.value = row.body;
    bodyEl.replaceWith(ta);
    e.target.textContent = "Save"; e.target.dataset.act = "save-body";
  } else if (act === "save-body"){
    const ta = el.querySelector("textarea"); if(!ta) return;
    await post("/api/derivative",{slug:piece.slug,id:row.id,body:ta.value});
    row.body = ta.value.trim(); flash("Saved"); rerender();
  } else if (act === "ai"){
    const box = el.querySelector(".aibox"); box.classList.toggle("show");
    if(!box.classList.contains("show")) row.aiError = null; // closing dismisses any stale error
    const inp = el.querySelector(".aibox input"); if(inp && box.classList.contains("show")) inp.focus();
  } else if (act === "ai-send"){
    if(aiPending.has(row.id)) return; // already in flight — don't fire a second real spawn (card fbfea28b)
    const inp = el.querySelector(".aibox input"); const instruction = inp ? inp.value.trim() : "";
    if(!instruction){ flash("Type what you want changed first"); return; }
    row.aiError = null;
    aiPending.add(row.id); rerender(); // thinking indicator now survives a background job poll's load()
    try {
      const r = await post("/api/revise",{slug:piece.slug,id:row.id,instruction});
      // Durable inline error on the row (survives rerender) instead of a 1.4s auto-hiding toast —
      // the toast alone made a real failure ("Claude ran but didn't change anything") vanish before
      // it registered as anything but "nothing's working."
      if(r.ok){ row.body = r.body; flash("Revised by Claude"); }
      else { row.aiError = r.error || "error"; }
    } finally { aiPending.delete(row.id); rerender(); }
  } else if (act === "gen-storyboard"){
    e.target.disabled = true;
    const r = await post("/api/video/generate",{slug:piece.slug});
    if(r.ok){ storyboardSlugs.add(piece.slug); flash("Queued — generating storyboard (the Studio room has progress)"); loadJobs(); }
    else { e.target.disabled = false; flash(r.error || "Could not queue /video"); }
    rerender();
  } else if (act === "dup"){
    const box = el.querySelector(".dupbox"); box.classList.toggle("show");
    if(!box.classList.contains("show")) row.dupError = null; // closing dismisses any stale error
  } else if (act === "dup-send"){
    if(dupPending.has(row.id)) return; // already in flight — don't fire a second real spawn (card fbfea28b)
    const sel = el.querySelector(".dupbox select");
    const platform = sel ? sel.value : "";
    if(!platform){ flash("No other platform to duplicate to"); return; }
    row.dupError = null;
    dupPending.set(row.id, platform); rerender(); // thinking indicator now survives a background job poll's load()
    try {
      const r = await post("/api/duplicate",{slug:piece.slug,id:row.id,platform});
      if(r.ok){ flash("Duplicated to "+platform+" — new pending row added"); await load(); }
      else { row.dupError = r.error || "error"; rerender(); }
    } finally { dupPending.delete(row.id); rerender(); }
  } else if (act === "cancel"){
    if(!confirm("Cancel this scheduled post? This removes the live draft/post at the provider.")) return;
    e.target.disabled = true;
    row.cancelError = null;
    const r = await post("/api/cancel",{slug:piece.slug,id:row.id});
    if(r.ok){ row.status="discard"; row.reconciled=null; flash("Canceled"); }
    else { e.target.disabled = false; row.cancelError = r.error || "error"; flash(r.error || "Could not cancel"); }
    rerender();
  }
}

let rerenderScheduled=false;
function rerender(){ if(rerenderScheduled) return; rerenderScheduled=true; requestAnimationFrame(()=>{rerenderScheduled=false; render();}); }

function render(){
  const main = $("#reviewMain"); main.innerHTML = "";
  let shown = 0, pending = 0;
  for (const piece of DATA.pieces){
    const rows = piece.rows.filter(r => showDecided || !DECIDED.has(r.status));
    pending += piece.rows.filter(r=>!DECIDED.has(r.status)).length;
    if (!rows.length) continue;
    shown += rows.length;
    const sec = document.createElement("section"); sec.className = "piece";
    sec.innerHTML = '<h2>'+esc(piece.title)+'</h2><div class="slug">'+esc(piece.slug)+'</div>';
    for (const row of rows) sec.appendChild(rowEl(piece, row));
    main.appendChild(sec);
  }
  $("#count").textContent = String(pending);
  $("#count").hidden = pending === 0;
  if (!shown) main.innerHTML = '<div class="empty">Nothing '+(showDecided?"here yet":"awaiting review")+'. 🎉</div>';
}

// ── rooms ──
// Six rooms on the desk (Content Studio Riff): Content, Studio, Outreach, Fiction, Charles, Signals.
// Refresh stays room-aware: it only re-reads whatever the CURRENT room shows, labeled per room,
// with a "last refreshed HH:MM" stamp so its effect is visible.
let currentTab = "content";
let outreachSub = "leads"; // the Outreach room's Leads | Follow-ups toggle
function refreshLabelFor(t){ return t==="content" ? "Refresh the desk" : t==="studio" ? "Refresh queue" : t==="signals" ? "Reload brief + file list" : t==="fiction" ? "Reload canon" : t==="charles" ? "Reload drafts" : t==="outreach" ? (outreachSub==="followups" ? "Refresh follow-ups" : "Scout new leads") : "Refresh"; }
function setRoom(t){
  currentTab = t;
  document.querySelectorAll(".room").forEach(b=>b.classList.toggle("on", b.dataset.room===t));
  $("#roomContent").hidden = t!=="content";
  $("#roomStudio").hidden = t!=="studio";
  $("#roomOutreach").hidden = t!=="outreach";
  $("#roomFiction").hidden = t!=="fiction";
  $("#roomCharles").hidden = t!=="charles";
  $("#roomSignals").hidden = t!=="signals";
  $("#refresh").textContent = refreshLabelFor(t);
  if (t==="content"){ loadContent(); }
  if (t==="studio"){ loadStudio(); loadJobs(); }
  if (t==="signals"){ loadSignals(); if(!briefLoaded){ loadBrief(); loadRaw(); } }
  if (t==="outreach"){ setOutreachSub(outreachSub); }
  if (t==="fiction"){ loadFiction(); }
  if (t==="charles"){ loadCharles(); }
}
document.querySelectorAll(".room").forEach(b=>b.addEventListener("click", ()=>setRoom(b.dataset.room)));
function setOutreachSub(s){
  outreachSub = s;
  document.querySelectorAll(".subtab").forEach(b=>b.classList.toggle("on", b.dataset.sub===s));
  $("#outreachPane").hidden = s!=="leads";
  $("#followupsPane").hidden = s!=="followups";
  $("#refresh").textContent = refreshLabelFor("outreach");
  if (s==="leads") loadOutreach(); else loadFollowups();
}
document.querySelectorAll(".subtab").forEach(b=>b.addEventListener("click", ()=>setOutreachSub(b.dataset.sub)));

let lastRefreshedAt = null;
function fmtHHMM(ms){ const d = new Date(ms); return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0"); }
function markRefreshed(){ lastRefreshedAt = Date.now(); $("#lastRefreshed").textContent = "last refreshed "+fmtHHMM(lastRefreshedAt); }

// Re-reads only what the ACTIVE room shows — never a Claude spawn, never the other rooms' data.
// ONE deliberate exception (Muxin, 2026-07-16): on the Outreach room's Leads pane the button is
// "Scout new leads" and runs the real /scout web-discovery agent (the pane already reloads itself
// on every visit anyway).
async function doRefresh(){
  $("#refresh").disabled = true;
  try {
    if (currentTab === "content") { await loadContent(); await load(); await loadJobs(); }
    else if (currentTab === "signals") { await loadSignals(); await loadBrief(); await loadRaw(); }
    else if (currentTab === "outreach") { if (outreachSub === "followups") await loadFollowups(); else await scoutRun(); }
    else if (currentTab === "fiction") { await loadFiction(); }
    else if (currentTab === "charles") { await loadCharles(); }
    else { if(currentTab==="studio") await loadStudio(); await loadJobs(); }
  } finally {
    $("#refresh").disabled = false;
    markRefreshed();
  }
}
$("#refresh").addEventListener("click", doRefresh);

// ── Analytics & Strategy ──

// Minimal markdown -> HTML for the brief + Claude's synthesis: headers, tables, bullet lists,
// bold/code, paragraphs. Not a full CommonMark parser, just enough for the content this pipeline
// itself generates. Escapes first, so no raw HTML from a derivative/brief ever executes.
function mdToHtml(md){
  const inline = s => esc(s).replace(/\\*\\*(.+?)\\*\\*/g, "<b>$1</b>").replace(/\`([^\`]+)\`/g, "<code>$1</code>");
  const isTableRow = l => /^\\s*\\|.*\\|\\s*$/.test(l);
  const isSepRow = l => /^[\\s|:-]+$/.test(l) && l.includes("-");
  const cellsOf = l => l.trim().replace(/^\\|/,"").replace(/\\|$/,"").split("|").map(c=>c.trim());
  const lines = md.split("\\n");
  let html = "", i = 0, inList = false;
  const closeList = () => { if(inList){ html += "</ul>"; inList = false; } };
  while(i < lines.length){
    const line = lines[i];
    const h = line.match(/^(#{1,6})\\s+(.*)$/);
    if(h){ closeList(); const lvl = h[1].length; html += "<h"+lvl+">"+inline(h[2])+"</h"+lvl+">"; i++; continue; }
    if(isTableRow(line)){
      closeList();
      const rows = [];
      while(i < lines.length && isTableRow(lines[i])){ rows.push(lines[i]); i++; }
      let head = null, body = rows;
      if(rows.length > 1 && isSepRow(rows[1])){ head = cellsOf(rows[0]); body = rows.slice(2); }
      html += "<table>";
      if(head) html += "<tr>"+head.map(c=>"<th>"+inline(c)+"</th>").join("")+"</tr>";
      for(const r of body){ if(isSepRow(r)) continue; html += "<tr>"+cellsOf(r).map(c=>"<td>"+inline(c)+"</td>").join("")+"</tr>"; }
      html += "</table>";
      continue;
    }
    if(/^\\s*[-*]\\s+/.test(line)){
      if(!inList){ html += "<ul>"; inList = true; }
      html += "<li>"+inline(line.replace(/^\\s*[-*]\\s+/,""))+"</li>";
      i++; continue;
    }
    closeList();
    if(line.trim() === ""){ i++; continue; }
    html += "<p>"+inline(line)+"</p>";
    i++;
  }
  closeList();
  return html;
}

let briefLoaded = false;
async function loadBrief(){
  briefLoaded = true;
  const r = await fetch("/api/strategy/brief"); const d = await r.json();
  if(!d.ok){ $("#briefBody").textContent = d.error; $("#briefPath").textContent = ""; return; }
  $("#briefBody").innerHTML = mdToHtml(d.content);
  $("#briefPath").textContent = d.path;
}
// Collapsed by default — the brief used to render in full the moment the Strategy tab opened,
// which is the "populates the whole page" behavior Muxin flagged. Now it opens on request: the
// toggle button, or the dated "Brief: <date>" link Generate Insights renders (delegated listener
// below, since that link lives inside dynamically-injected insights/brief-revise HTML).
function setBriefExpanded(open){
  $("#briefBodyWrap").hidden = !open;
  $("#briefToggleBtn").textContent = open ? "Hide brief" : "Show brief";
}
$("#briefToggleBtn").addEventListener("click", ()=> setBriefExpanded($("#briefBodyWrap").hidden));
document.addEventListener("click", (e)=>{
  const a = e.target.closest && e.target.closest('a[href="#stratBriefPanel"]');
  if(a) setBriefExpanded(true);
});
async function askBrief(){
  const inp = $("#briefAskInput"); const instruction = inp.value.trim();
  if(!instruction){ flash("Type what you want changed first"); return; }
  $("#briefAskBtn").disabled = true;
  const prevHtml = $("#briefBody").innerHTML;
  $("#briefBody").textContent = "✨ Claude is revising the brief… (your subscription, ~10-30s)";
  const r = await post("/api/strategy/ask", {instruction});
  $("#briefAskBtn").disabled = false;
  if(r.ok){ $("#briefBody").innerHTML = mdToHtml(r.content); $("#briefPath").textContent = r.path; inp.value = ""; flash("Brief revised by Claude"); }
  else { $("#briefBody").innerHTML = prevHtml; flash("Revise failed: "+(r.error||"error")); }
}
$("#briefAskBtn").addEventListener("click", askBrief);

// "Refresh brief": the FULL /strategy skill as a background job (Muxin, 2026-07-16: the brief
// never refreshes unless he runs /strategy in a terminal). Same live-elapsed ticker pattern as
// askInsights — this genuinely takes minutes, so an honest ticking count beats a fake ETA.
async function refreshBriefRun(){
  const btn = $("#briefRefreshBtn");
  btn.disabled = true;
  const body = $("#briefBody");
  const prevHtml = body.innerHTML;
  // No clock here. The progress strip at the top of this room is the ONE measured duration for
  // this job, and it counts from when the job was queued. A second timer started at the click
  // disagreed with it on the same screen, which is the exact defect this design was corrected for.
  body.innerHTML = '<p class="thinking">✨ Running the full /strategy skill. It grades your bets and writes a new dated brief, which takes minutes. The strip at the top of this room carries the clock, and the Studio room has the log.</p>';
  loadJobs(); // make the strategy job visible in the Studio room right away
  try {
    const r = await post("/api/strategy/refresh-brief", {});
    if(r.ok){ flash("Brief refreshed: "+(r.path||"")); await loadBrief(); }
    else { body.innerHTML = prevHtml; flash(r.error || "Refresh failed — see the job log"); }
  } catch (e) {
    body.innerHTML = prevHtml;
    flash(e instanceof Error ? e.message : String(e));
  } finally {
    btn.disabled = false;
  }
}
$("#briefRefreshBtn").addEventListener("click", refreshBriefRun);

// Insights: a Claude-written synthesis (not a raw report dump), plus a follow-up chat thread that
// can ask Claude to dig into anything — Claude may re-run the reports itself to answer. fmtDays/
// renderInsightsMeta mirror this file's Node-side exports of the same name (kept in sync by hand,
// same cross-runtime convention as the mirrors above): the meta line is built from deterministic
// server-side numbers, NOT from Claude's markdown, since mdToHtml has no link syntax and this way
// the freshness stamp can never be wrong or omitted by an LLM pass.
function fmtDays(n){ return n+" day"+(n===1?"":"s"); }
function renderInsightsMeta(r){
  const parts = [];
  if(r.engine === "gpt-codex") parts.push('<span style="color:#5b46b8;font-weight:600">analyst · GPT (Codex)</span>');
  else if(r.engine === "claude-cli") parts.push('<span style="color:#5b46b8;font-weight:600">analyst · Claude</span>'+(r.fallbackReason?' <span title="'+esc(r.fallbackReason)+'">(GPT unavailable — hover for why)</span>':''));
  if(r.freshness) parts.push('Data current as of <b>'+esc(r.freshness.date)+'</b> ('+fmtDays(r.freshness.ageDays)+' ago)');
  if(r.brief){
    const label = esc(r.brief.date || r.brief.path) + (r.brief.ageDays!=null ? ' ('+fmtDays(r.brief.ageDays)+' old)' : '');
    parts.push('Brief: <a href="#stratBriefPanel">'+label+'</a>');
  }
  if(r.untagged > 0) parts.push('<span class="warn">⚠ '+r.untagged+' untagged post'+(r.untagged===1?'':'s')+'</span>');
  return parts.length ? '<div class="insights-meta">'+parts.join(' · ')+'</div>' : '';
}
let insightsHistory = [];
async function generateInsights(){
  $("#insightsBtn").disabled = true;
  $("#insightsPanel").hidden = false;
  insightsHistory = [];
  $("#insightsThread").innerHTML = "";
  // No estimate here. Nothing ever measured the guess that used to sit in this line, and the strip
  // at the top of this room already shows the real elapsed time for this job.
  $("#insightsOut").innerHTML = '<p class="hint">Running the reports, then asking Claude for a synthesis. The strip at the top of this room carries the clock.</p>';
  const r = await post("/api/strategy/insights", {});
  $("#insightsBtn").disabled = false;
  if(r.ok){ $("#insightsOut").innerHTML = renderInsightsMeta(r) + mdToHtml(r.summary); insightsHistory = [{role:"assistant", content:r.summary}]; }
  else { $("#insightsOut").innerHTML = "<p>Failed: "+esc(r.error||"error")+"</p>"; }
}
$("#insightsBtn").addEventListener("click", generateInsights);

function renderThread(){
  const box = $("#insightsThread"); box.innerHTML = "";
  for(const h of insightsHistory.slice(1)){ // [0] is the initial summary, already shown above
    const el = document.createElement("div");
    el.className = "thread-turn" + (h.role === "user" ? " q" : "");
    el.innerHTML = h.role === "user" ? "You asked: "+esc(h.content) : mdToHtml(h.content);
    box.appendChild(el);
  }
}
async function askInsights(){
  const inp = $("#insightsAskInput"); const q = inp.value.trim();
  if(!q){ flash("Ask something first"); return; }
  if(!insightsHistory.length){ flash("Generate insights first"); return; }
  $("#insightsAskBtn").disabled = true;
  insightsHistory.push({role:"user", content:q});
  inp.value = "";
  renderThread();
  const thinking = document.createElement("div");
  thinking.className = "thinking";
  // No clock here either. Card a14693da replaced a fixed ETA with a click-local ticker, which was
  // right at the time; the room strip now carries the one measured elapsed count for this job, so
  // a second timer on the same screen would just disagree with it.
  thinking.innerHTML = '✨ Claude is looking into it. It may re-run a report first. The strip at the top of this room carries the clock.';
  $("#insightsThread").appendChild(thinking);
  const r = await post("/api/strategy/ask-insights", {question:q, history:insightsHistory});
  $("#insightsAskBtn").disabled = false;
  insightsHistory.push({role:"assistant", content: r.ok ? r.answer : "Failed: "+(r.error||"error")});
  renderThread();
}
$("#insightsAskBtn").addEventListener("click", askInsights);

// Raw downloaded exports — the actual files, not a computed report.
async function loadRaw(){
  const box = $("#rawList");
  box.innerHTML = '<div class="empty">Loading…</div>';
  const r = await fetch("/api/strategy/raw"); const d = await r.json();
  if(!d.files || !d.files.length){
    box.innerHTML = '<div class="empty">No raw exports found in data/inbox or data/processed on this checkout.</div>';
    $("#rawLastPull").textContent = "";
    return;
  }
  // Files sort newest-first server-side (listRawFiles) — the first entry's mtime IS the last
  // successful pull, so staleness is visible at a glance instead of only showing up as a surprise.
  $("#rawLastPull").textContent = "last pull: "+new Date(d.files[0].mtime).toISOString().slice(0,10);
  box.innerHTML = "";
  for(const f of d.files){
    const el = document.createElement("div"); el.className = "notepick";
    const kb = (f.size/1024).toFixed(1);
    const when = new Date(f.mtime).toISOString().slice(0,10);
    el.innerHTML = '<div class="ntext"><div class="nmeta">'+when+' · '+kb+' KB</div>'+
      '<a href="/api/strategy/raw-file?path='+encodeURIComponent(f.path)+'" target="_blank">'+esc(f.path)+'</a></div>';
    box.appendChild(el);
  }
}
$("#rawRefreshBtn").addEventListener("click", loadRaw);

// "Pull fresh now" — the real pull (npm run pull -- --ingest), queued through the same job system
// as every other Claude/subprocess spawn in this GUI, so it gets a persisted log + heartbeat even
// though it can take minutes (real Chrome, saved LinkedIn/X/Substack sessions). A ticking elapsed
// count (not a fixed ETA) mirrors askInsights' own ticker above — card a14693da's fix for the same
// "don't undersell an honestly-variable wait" problem.
async function pullFresh(){
  const btn = $("#rawPullBtn");
  btn.disabled = true; $("#rawRefreshBtn").disabled = true;
  const box = $("#rawList");
  const prevHtml = box.innerHTML;
  box.innerHTML = '<div class="empty">✨ Pulling fresh analytics through real Chrome. It can take a few minutes. The strip at the top of this room carries the clock.</div>';
  const r = await post("/api/strategy/pull", {});
  btn.disabled = false; $("#rawRefreshBtn").disabled = false;
  if(r.ok){ flash("Pull complete"); await loadRaw(); }
  else { box.innerHTML = prevHtml; flash("Pull failed: "+(r.error||"error")); await loadRaw(); }
}
$("#rawPullBtn").addEventListener("click", pullFresh);

// ── Outreach room: triage, then the thread (design v7 §3) ──
// Two screens off one /api/outreach/leads read. Triage is the default: every lead grouped by the
// reason it is on the desk, each row carrying who, why, and when it was last pitched (real tracker
// events only). Picking a row opens that lead's thread — the matchmaker read, the people, the
// evidence with its sources, the message, and the two separate steps at the end: lock it, then
// tell the page you sent it by hand. Nothing here contacts anyone.
// The helpers below mirror the exported ones in page.ts; keep both sides in step by hand.
let OUTREACH_LEADS = null;
let OUTREACH_TOUCH = {};       // lead dir → newest tracker lastTouch, from /api/followups
let activeLeadDir = null;      // null = the triage queue; a dir = that lead's thread
let scoutInFlight = false;
const outPending = new Set();
const outError = new Map();
const msgPending = new Set();
const msgError = new Map();
const lockPending = new Set();
const outDirection = new Map();  // lead dir → what she is typing, so a re-render never eats it
const outSaid = new Map();       // lead dir → the direction she sent with the draft now on screen

function leadSegment(l){
  if (l.segment) return l.segment;
  if (l.kind === "platform") return "platform";
  if (l.kind === "client") return l.source === "jsa" ? "org-role" : "org-mission";
  return "content-example";
}
const SEG_INFO = {
  "platform":        { label:"Platform",      dot:"#2f5d9a", line:"a stage or audience that could host you" },
  "org-role":        { label:"Org · role",    dot:"#9a6b12", line:"values fit with an open role behind it" },
  "org-mission":     { label:"Org · mission", dot:"#2f7d46", line:"values-aligned, worth knowing" },
  "content-example": { label:"Example",       dot:"#7a7266", line:"raw material for a writing angle" },
};
const OUT_SEGMENTS = [
  { key:"platform",        name:"PLATFORMS",                   note:"Where the audience already is. Bring the work, not a pitch." },
  { key:"org-mission",     name:"ORGANIZATIONS · MISSION FIT", note:"They do the thing you write about. Bring the overlap." },
  { key:"org-role",        name:"ORGANIZATIONS · OPEN ROLES",  note:"They are hiring for what you already built. Bring the receipt." },
  { key:"content-example", name:"EXAMPLES",                    note:"raw material for a writing angle" },
];
function groupLeadsBySegment(leads){
  return OUT_SEGMENTS.map(s=>({key:s.key, name:s.name, note:s.note, leads:leads.filter(l=>leadSegment(l)===s.key)}))
    .filter(g=>g.leads.length>0);
}
function lastPitchedLabel(lastTouch){
  const t = (lastTouch || "").trim();
  return t ? "pitched "+t.slice(0,10)+", by hand" : "never pitched";
}
function threadSegLabel(seg){
  if(seg==="platform") return "PLATFORM · SELECTED";
  if(seg==="org-mission") return "MISSION FIT · SELECTED";
  if(seg==="org-role") return "OPEN ROLE · SELECTED";
  return "EXAMPLE · SELECTED";
}
function matchmakerRead(l){
  const has = !!(l.whyMutual || l.whyThem || l.whyMe);
  if(!has) return { legacy:true, headline:((l.pitchAngle||l.pitch||"").trim()||"(no read recorded yet)"), rows:[] };
  const rows = [];
  if(l.whyThem) rows.push({k:"Why them, for you", v:l.whyThem});
  if(l.whyMe) rows.push({k:"Why you, for them", v:l.whyMe});
  if(l.whyMutual) rows.push({k:"Why the two of you", v:l.whyMutual});
  return { legacy:false, headline:(l.whyMutual||l.whyThem||l.whyMe||"").trim(), rows:rows };
}
function contactsLine(contacts){
  const n = (contacts||[]).length;
  if(n===0) return "No named contact yet. Add one, or write to the organization.";
  if(n===1) return "You are writing to "+contacts[0].name+(/[.!?]$/.test(contacts[0].name)?"":".");
  return n+" people here. Each one gets its own message and its own follow-up clock.";
}
const OUT_PLACEHOLDER_SOURCES = ["(none)","none","n/a","na","tbd","unknown",""];
function isEvidenceSourceValid(source){
  const t = (source||"").trim();
  if(!t || OUT_PLACEHOLDER_SOURCES.indexOf(t.toLowerCase())>=0) return false;
  if(/^vault:/i.test(t)){
    const path = t.slice("vault:".length).trim();
    return path.length>0 && OUT_PLACEHOLDER_SOURCES.indexOf(path.toLowerCase())<0;
  }
  if(!/^https?:\\/\\//i.test(t)) return false;
  try { return new URL(t).hostname.indexOf(".")>=0; } catch(e){ return false; }
}
const NO_SOURCE_RECORDED = "no source recorded";
function evidenceSourceView(source){
  const t = (source||"").trim();
  if(!isEvidenceSourceValid(t)) return { kind:"none", text:NO_SOURCE_RECORDED };
  if(/^https?:\\/\\//i.test(t)) return { kind:"link", text:t };
  return { kind:"text", text:t };
}
// Message status only: the tracker's lastTouch is keyed lead:person, never message, so it can
// never say WHICH message went. The logged send is reported below as the lead-level fact it is.
function outreachSendState(msg){
  if(!msg) return "none";
  return (msg.status||"").trim() === "locked" ? "locked" : "draft";
}
function outreachSendNote(state){
  if(state==="draft") return "Locking readies it. You send it by hand, and nothing here can send it for you.";
  if(state==="locked") return "Paste it into your mail client and send it there. Tell me once it has gone.";
  return "";
}
function outreachSendBadge(state, hasLoggedSend){
  if(state!=="locked") return "";
  return hasLoggedSend ? "LOCKED · NOT EDITABLE" : "LOCKED · NOT EDITABLE, NOT SENT";
}
function leadSendLogLine(lastTouch){
  const t = (lastTouch||"").trim();
  return t ? "A send was logged "+t.slice(0,10)+", by hand. See Follow-ups." : "";
}
function outreachThreadPhase(msg, drafting){
  if(drafting) return "drafting";
  return msg ? "drafted" : "asking";
}
function firstSentence(text, cap){
  const t = (text||"").trim();
  if(!t) return "";
  const m = t.match(/^[\\s\\S]*?[.?!](?=\\s|$)/);
  let s = (m ? m[0] : t).trim();
  if(s.length > cap) s = s.slice(0, cap).replace(/[\\s,;:]+\\S*$/, "") + "...";
  return s;
}
function outreachOpeningLine(l){
  const who = ((l.name || l.dir || "this one")+"").trim();
  const read = matchmakerRead(l);
  const reason = firstSentence(read.headline, 180);
  if(!reason || reason === "(no read recorded yet)"){
    return "I put "+who+" in front of you, and there is no research read on file yet. Tell me what you want this message to say and I will write it in your voice.";
  }
  const tail = /[.?!]$/.test(reason) ? "" : ".";
  return "I put "+who+" in front of you for this reason: "+reason+tail+" Want to lead with that, or keep it short and just ask for a quick chat?";
}

// ── Triage: the queue, grouped by why ──
function triageHtml(){
  const groups = groupLeadsBySegment(OUTREACH_LEADS);
  if(!groups.length) return '<div class="empty">No leads yet. Scout new leads (top right) runs the discovery agent; /outreach add seeds one by hand.</div>';
  const body = groups.map(g=>
    '<div class="tri-group">'+
      '<div class="tri-head"><span class="tri-name">'+esc(g.name)+'</span><span class="tri-note">'+esc(g.note)+'</span></div>'+
      g.leads.map(l=>{
        const touch = OUTREACH_TOUCH[l.dir];
        const why = matchmakerRead(l).headline;
        return '<button class="tri-row" data-dir="'+esc(l.dir)+'">'+
          '<span class="tri-who"><span class="w">'+esc(l.name||l.dir)+'</span><span class="y">'+esc(why)+'</span></span>'+
          '<span class="tri-when'+(touch?" on":"")+'">'+esc(lastPitchedLabel(touch))+'</span>'+
        '</button>';
      }).join("")+
    '</div>').join("");
  const margin = '<div class="session-margin"><div class="wb-margin-cap">WHY THIS IS ON YOUR DESK</div>'+
    '<div class="src">Pick someone from the queue. The research on them, and every source behind it, opens here.</div></div>';
  return '<div class="dossier-grid"><div style="min-width:0;">'+
    '<div class="tri-cap">WHO IS IN FRONT OF YOU, GROUPED BY WHY · PICK ONE TO DRAFT TO</div>'+body+
  '</div>'+margin+'</div>';
}

// ── The thread: one lead, read end to end ──
function outreachMarginHtml(l){
  const evs = [...(l.evidence||[])].sort((a,b)=>(b.signal==="worldview-match"?1:0)-(a.signal==="worldview-match"?1:0));
  const items = evs.slice(0,5).map(e=>{
    const quote = e.quote && e.quote!=="(none)" ? '<div class="ev-quote">"'+esc(e.quote)+'"</div>'
      : (e.description ? '<div class="d">'+esc(e.description)+'</div>' : "");
    // No date fallback: EvidenceItem carries no timestamp, so an item with nothing valid behind it
    // says it has no source rather than showing a day nobody recorded.
    const sv = evidenceSourceView(e.source);
    const src = sv.kind==="link" ? '<a class="ev-src" href="'+esc(sv.text)+'" target="_blank" rel="noopener">source ↗</a>'
      : sv.kind==="text" ? '<div class="ev-src">'+esc(sv.text)+'</div>'
      : '<div class="ev-nosrc">'+esc(sv.text)+'</div>';
    const cls = e.signal==="worldview-match" ? "green" : "sand";
    return '<div class="wb-check '+cls+'"><span class="t"><span class="verdict">'+esc(e.signal)+'</span>'+(e.person?' · '+esc(e.person):"")+'</span>'+quote+src+'</div>';
  }).join("");
  const stats = (l.jsaStats||[]).slice(0,3).map(s=>'<div class="d" style="font-size:12.5px;color:#5a5346;">'+esc(s.label)+': '+esc(s.value)+'</div>').join("");
  const profile = (l.profileRest||l.profile) ? '<details class="lead-details"><summary>Full profile</summary><div class="ntext" style="white-space:pre-wrap;font-size:12.5px;">'+esc(l.profileRest||l.profile)+'</div></details>' : "";
  const reasoning = l.classificationNote ? '<details class="lead-details"><summary>Full why-fit reasoning</summary><div class="ntext" style="white-space:pre-wrap;font-size:12.5px;">'+esc(l.classificationNote)+'</div></details>' : "";
  return '<div class="session-margin"><div class="wb-margin-cap">WHY THIS IS ON YOUR DESK</div>'+
    (items || '<div class="src">No evidence recorded on this lead yet.</div>')+
    (stats?'<div>'+stats+'</div>':"")+reasoning+profile+
    '<div class="wb-reply"><span class="mono-note">Every claim here carries its source, or says it has none. This page stays tied to the follow-up row. Months from now: the why, what you said, the date, one click.</span></div></div>';
}

// ── The conversational half: I ask, you say which way to take it, then I draft ──
// The phase is derived, never stored: no message and no job means asking, a job in flight means
// drafting, a message on disk means drafted. What she types wins over the stored pitch angle when
// they disagree, and it only ever describes what SHE wants said. I clean it up in her voice and
// never invent interest she does not have.
function directionHtml(l){
  const phase = outreachThreadPhase(l.latestMessage, outPending.has(l.dir));
  const said = (outSaid.get(l.dir) || "").trim();
  const saidBlock = said
    ? '<div class="dir-said"><div class="cap">YOU SAID</div><div class="said">'+esc(said)+'</div></div>'
    : "";
  if(phase === "drafting"){
    return saidBlock + '<div class="thinking" style="margin-top:14px;">✨ Drafting the pitch… (your subscription, ~30-60s. The Studio room has the progress and the log.)</div>';
  }
  if(phase === "drafted") return saidBlock;
  const typed = outDirection.get(l.dir) || "";
  const err = outError.get(l.dir);
  return '<div class="dir-open"><span class="cap">Suggested angle</span>'+
      '<span class="line">'+esc(outreachOpeningLine(l))+'</span></div>'+
    '<div class="dir-box">'+
      '<textarea class="dir-input" rows="2" data-dir="'+esc(l.dir)+'" placeholder="Say which way to take it, in a line or two.">'+esc(typed)+'</textarea>'+
      '<div class="dir-go"><button class="dir-send" data-dir="'+esc(l.dir)+'"'+(typed.trim()?"":" disabled")+'>Draft it</button>'+
        '<span class="note">Nothing here goes anywhere. It becomes a draft, and only you send it. I write it in your voice and I never invent interest you do not have.</span></div>'+
      (err ? '<div class="aierr" style="margin-top:10px;">⚠ '+esc(err)+' (see the Studio room for the job log)</div>' : "")+
    '</div>';
}

function outreachMessageBox(l){
  const msg = l.latestMessage;
  // No message yet is not an empty state here: the direction composer above IS the empty state, and
  // it is asking her a question rather than showing her a blank box.
  if(!msg) return "";
  const state = outreachSendState(msg);
  const logged = leadSendLogLine(OUTREACH_TOUCH[l.dir]);
  const recip = msg.recipient ? ' · to '+esc(msg.recipient) : "";
  if(state === "locked"){
    return '<div class="lead-msg"><div class="nmeta">'+esc(msg.file)+recip+' · '+esc(msg.channel||"?")+' · <b>'+esc(outreachSendBadge(state, !!logged))+'</b></div>'+
      '<div class="body">'+esc(msg.body)+'</div>'+
      (logged ? '<div class="src">'+esc(logged)+'</div>' : "")+'</div>';
  }
  const revPending = msgPending.has(l.dir);
  const revErr = msgError.get(l.dir);
  // "Update it" edits THIS message in place, through the revise path that already existed. It never
  // starts a second numbered draft, and the copy says so.
  return '<div class="lead-msg"><div class="nmeta">The draft · '+esc(msg.file)+recip+' · '+esc(msg.status)+'</div>'+
    '<textarea class="msg-edit">'+esc(msg.body)+'</textarea>'+
    '<div class="actions"><button class="msg-save" data-dir="'+esc(l.dir)+'" data-file="'+esc(msg.file)+'">Save edits</button></div>'+
    '<div class="aibox show">'+
      (revPending
        ? '<div class="thinking">✨ Rewriting the same draft, not adding a new one…</div>'
        : '<input class="msg-revise-input" placeholder="Make it shorter, drop the second line, warmer close…" /><button class="send msg-revise" data-dir="'+esc(l.dir)+'" data-file="'+esc(msg.file)+'">Update it</button>'+
          (revErr ? '<div class="aierr">⚠ '+esc(revErr)+'</div>' : ""))+
    '</div></div>';
}

// Lock, then copy, then say you sent it. Three separate steps, because readied, copied and
// actually gone are three different things and only your hands do the last one.
function sendStepsHtml(l){
  const msg = l.latestMessage;
  if(!msg) return "";
  const state = outreachSendState(msg);
  const pending = lockPending.has(l.dir);
  const note = '<span class="send-note">'+esc(outreachSendNote(state))+'</span>';
  if(state === "draft"){
    return '<div class="send-steps"><button class="primary out-lock" data-dir="'+esc(l.dir)+'" data-file="'+esc(msg.file)+'"'+(pending?" disabled":"")+'>'+(pending?"Locking…":"Lock this message")+'</button>'+note+'</div>';
  }
  const channels = ["email","linkedin-dm","contact-form","podcast-pitch"];
  const chanSel = '<select class="sent-channel">'+channels.map(c=>'<option value="'+c+'"'+(c===(msg.channel||"email")?" selected":"")+'>'+c+'</option>').join("")+'</select>';
  const people = (l.contacts||[]).map(c=>c.name);
  const personSel = '<select class="sent-person"><option value="">(no specific person)</option>'+people.map(n=>'<option value="'+esc(n)+'"'+(msg.recipient===n?" selected":"")+'>'+esc(n)+'</option>').join("")+'</select>';
  const copyBtn = '<button class="primary out-copy" data-dir="'+esc(l.dir)+'">Copy to clipboard</button>';
  const markBar = '<div class="sent-bar">'+personSel+chanSel+'<button class="go sent-go" data-dir="'+esc(l.dir)+'">Mark as manually sent</button></div>';
  return '<div class="send-steps">'+copyBtn+note+'</div>'+markBar;
}

function whoBoxHtml(l){
  const chips = (l.contacts||[]).map(c=>'<span class="who-chip"><b>'+esc(c.name)+'</b>'+(c.role?'<span class="role">'+esc(c.role)+'</span>':"")+'</span>').join("");
  const suggested = (l.suggestedContacts||[]).map(n=>'<span class="who-suggest">'+esc(n)+'<button class="who-add" data-dir="'+esc(l.dir)+'" data-name="'+esc(n)+'">+ add</button></span>').join("");
  return '<div class="who-box">'+
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:9px;"><span class="wb-margin-cap">WHO YOU WOULD REACH</span><span class="grow"></span></div>'+
    (chips+suggested ? '<div>'+chips+suggested+'</div>' : "")+
    '<div class="aibox show" style="margin-top:8px;"><input class="who-name" placeholder="name" style="max-width:160px;" /><input class="who-role" placeholder="role (optional)" style="max-width:180px;" /><button class="who-save" data-dir="'+esc(l.dir)+'">Add contact</button></div>'+
    '<div class="src" style="margin-top:8px;">'+esc(contactsLine(l.contacts))+'</div>'+
  '</div>';
}

function threadHtml(l){
  const seg = leadSegment(l);
  const info = SEG_INFO[seg] || SEG_INFO["content-example"];
  const undecided = !["pursue","passed","locked","drafted"].includes(l.status);
  const pending = outPending.has(l.dir);
  const fitChip = l.classificationOrFit ? '<span class="fit-chip">'+esc(l.classificationOrFit)+'</span>' : "";
  const provChip = (l.whySource === "gpt-codex" ? '<span class="legacy-chip" style="background:#efeafd;color:#5b46b8">why: analyst, GPT-routed</span>' : l.whySource === "claude-cli" ? '<span class="legacy-chip">why: analyst, Claude</span>' : "")+(l.source === "jsa" ? '<span class="legacy-chip">research: JSA</span>' : "");
  const mmr = matchmakerRead(l);
  const legacy = mmr.legacy ? ' <span class="legacy-chip">legacy read, the pitch angle standing in until this lead is re-qualified</span>' : "";
  const mm = mmr.rows.length
    ? '<div class="mm-grid">'+mmr.rows.map(r=>'<div class="mm-row"><span class="k">'+esc(r.k)+'</span><span class="v">'+esc(r.v)+'</span></div>').join("")+'</div>'
    : "";
  // The direction composer replaces the old one-click "Draft the message": drafting now starts from
  // what she typed, so the thread only offers it once the lead is one she said to pursue.
  const canDraft = !l.latestMessage && l.kind!=="content-example" && (l.status==="pursue"||l.status==="qualified");
  const direction = (canDraft || pending || l.latestMessage) && l.kind!=="content-example" ? directionHtml(l) : "";
  const decideBtns = l.kind==="content-example" ? "" :
    '<div class="wb-handoff">'+
      (undecided ? '<button class="primary out-pursue" data-dir="'+esc(l.dir)+'">Worth pursuing</button><button class="out-pass" data-dir="'+esc(l.dir)+'">Pass</button>' : "")+
      '<span class="note">Pursue or pass just marks your call. Drafting writes a message for you to shape; only you ever send it.</span>'+
    '</div>';
  const notes = '<div class="lead-notes">'+
    (l.muxinNotes ? '<div class="my-notes">'+esc(l.muxinNotes)+'</div>' : "")+
    '<div class="aibox show"><input class="lead-note-input" placeholder="your note on this lead (what stood out)…" /><button class="lead-note-save" data-dir="'+esc(l.dir)+'">Save note</button></div></div>';
  return '<div class="dossier-grid"><div style="min-width:0;">'+
    '<button class="out-back">← Back to queue</button>'+
    '<div class="thread-head"><span class="thread-seg">'+esc(threadSegLabel(seg))+'</span>'+
      '<span class="thread-who">'+esc(l.name||l.dir)+'</span>'+
      '<span class="thread-person">'+esc(contactsLine(l.contacts))+'</span></div>'+
    '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><span class="seg-chip '+esc(seg)+'">'+esc(info.label)+'</span>'+fitChip+'<span class="src">'+esc(info.line)+'</span><span class="grow"></span>'+provChip+'</div>'+
    '<div class="wb-label" style="margin:14px 0 0;">Why this matters to you, in plain terms'+legacy+'</div>'+
    '<div class="dossier-why">'+esc(mmr.headline)+'</div>'+
    mm + whoBoxHtml(l) + direction + outreachMessageBox(l) + sendStepsHtml(l) + decideBtns + notes +
    (l.url?'<div class="src" style="margin-top:10px;"><a href="'+esc(l.url)+'" target="_blank" rel="noopener">'+esc(l.url)+'</a></div>':"")+
  '</div>'+outreachMarginHtml(l)+'</div>';
}

function renderOutreachBox(){
  if(!OUTREACH_LEADS) return;
  const box = $("#outreachList");
  const leads = OUTREACH_LEADS;
  if(!leads.length){
    activeLeadDir = null;
    $("#outreachHead").textContent = "Leads";
    box.innerHTML = '<div class="empty">No leads yet. Scout new leads (top right) runs the discovery agent; /outreach add seeds one by hand.</div>';
    return;
  }
  if(activeLeadDir && !leads.some(l=>l.dir===activeLeadDir)) activeLeadDir = null;
  const active = activeLeadDir ? leads.find(l=>l.dir===activeLeadDir) : null;
  $("#outreachHead").textContent = active ? "The thread" : "Leads";
  box.innerHTML = active ? threadHtml(active) : triageHtml();
  box.querySelectorAll("button.tri-row").forEach(b=>b.addEventListener("click",()=>{ activeLeadDir = b.dataset.dir; renderOutreachBox(); }));
  box.querySelectorAll("button.out-back").forEach(b=>b.addEventListener("click",()=>{ activeLeadDir = null; renderOutreachBox(); }));
  box.querySelectorAll("button.dir-send").forEach(b=>b.addEventListener("click", ()=>outreachDraft(b.dataset.dir, b)));
  // Kept out of the render loop on purpose: re-rendering per keystroke would eat the caret. The
  // typed text is stashed so a refresh mid-thought does not lose it, and the button just enables.
  box.querySelectorAll("textarea.dir-input").forEach(t=>t.addEventListener("input", ()=>{
    outDirection.set(t.dataset.dir, t.value);
    const wrap = t.closest(".dir-box");
    const btn = wrap ? wrap.querySelector("button.dir-send") : null;
    if(btn) btn.disabled = !t.value.trim();
  }));
  box.querySelectorAll("button.out-pursue").forEach(b=>b.addEventListener("click", ()=>outreachDecide(b.dataset.dir,"pursue")));
  box.querySelectorAll("button.out-pass").forEach(b=>b.addEventListener("click", ()=>outreachDecide(b.dataset.dir,"pass")));
  box.querySelectorAll("button.out-lock").forEach(b=>b.addEventListener("click", ()=>outreachLock(b.dataset.dir, b.dataset.file)));
  box.querySelectorAll("button.out-copy").forEach(b=>b.addEventListener("click", ()=>outreachCopy(b)));
  box.querySelectorAll("button.lead-note-save").forEach(b=>b.addEventListener("click", ()=>outreachSaveNote(b)));
  box.querySelectorAll("button.msg-save").forEach(b=>b.addEventListener("click", ()=>outreachMsgSave(b)));
  box.querySelectorAll("button.msg-revise").forEach(b=>b.addEventListener("click", ()=>outreachMsgRevise(b)));
  box.querySelectorAll("button.who-add").forEach(b=>b.addEventListener("click", ()=>outreachAddContact(b.dataset.dir, b.dataset.name, "")));
  box.querySelectorAll("button.who-save").forEach(b=>b.addEventListener("click", ()=>{
    const wrap = b.closest(".who-box");
    outreachAddContact(b.dataset.dir, wrap.querySelector(".who-name").value.trim(), wrap.querySelector(".who-role").value.trim());
  }));
  box.querySelectorAll("button.sent-go").forEach(b=>b.addEventListener("click", ()=>{
    const bar = b.closest(".sent-bar");
    outreachMarkSent(b.dataset.dir, bar.querySelector(".sent-person").value, bar.querySelector(".sent-channel").value);
  }));
}

async function outreachAddContact(dir, name, role){
  if(!name){ flash("Type a name first"); return; }
  const r = await post("/api/outreach/contact/add", {dir, name, role});
  if(r.ok){ flash(name+" added"); await loadOutreach(); }
  else flash(r.error || "Could not add the contact");
}

// The one lock path, and it reuses the review queue's own approve route: an outreach-message row
// lives in the LEAD folder, so slug = the lead dir name and id = the message id. Locking readies
// the text and nothing else; sending is still a thing only Muxin does, by hand.
async function outreachLock(dir, file){
  if(lockPending.has(dir)) return;
  const slug = (dir||"").split("/").pop();
  const id = (file||"").replace(/^messages\\//, "").replace(/\\.md$/, "");
  if(!slug || !id){ flash("No message to lock yet"); return; }
  lockPending.add(dir); renderOutreachBox();
  try {
    const r = await post("/api/status", {slug, id, status:"approve"});
    // /api/status answers ok:true with a scheduleError when the lock itself failed (or when the
    // in-flight guard tripped) — the row is still a draft, so never flash "Locked" over that.
    if(r.ok === false) flash(r.error || "Could not lock it");
    else if(r.scheduleError) flash(r.scheduleError);
    else flash("Locked. Copy it, send it yourself, then tell the page it has gone.");
  } catch (e) {
    flash(e instanceof Error ? e.message : String(e));
  } finally {
    lockPending.delete(dir);
    await loadOutreach();
  }
}

function outreachCopy(b){
  const grid = b.closest(".dossier-grid");
  const body = grid ? grid.querySelector(".lead-msg .body") : null;
  const text = body ? body.textContent : "";
  if(!text){ flash("Nothing to copy yet"); return; }
  try { if(navigator.clipboard) navigator.clipboard.writeText(text); } catch (e) {}
  flash("Copied. Paste it into your mail client and send it there.");
}

// Logging a send hands the lead back to the queue, where the row now reads its real
// "pitched <date>, by hand" off the tracker event this just wrote.
async function outreachMarkSent(dir, person, channel){
  const r = await post("/api/outreach/mark-sent", {dir, person, channel});
  if(r.ok){ flash("Logged. The clock starts today; see Follow-ups."); activeLeadDir = null; await loadOutreach(); }
  else flash(r.error || "Could not log the send");
}

async function outreachSaveNote(b){
  const inp = b.closest(".lead-notes").querySelector(".lead-note-input");
  const note = inp ? inp.value.trim() : "";
  if(!note){ flash("Type a note first"); return; }
  b.disabled = true;
  const r = await post("/api/outreach/note", {dir: b.dataset.dir, note});
  if(r.ok){ flash("Note saved to lead.md"); await loadOutreach(); }
  else { b.disabled = false; flash(r.error || "Failed to save note"); }
}

async function outreachMsgSave(b){
  const ta = b.closest(".lead-msg").querySelector(".msg-edit");
  const body = ta ? ta.value : "";
  if(!body.trim()){ flash("Message body cannot be empty"); return; }
  b.disabled = true;
  const r = await post("/api/outreach/message/save", {dir: b.dataset.dir, file: b.dataset.file, body});
  if(r.ok){ flash("Saved"); await loadOutreach(); }
  else { b.disabled = false; flash(r.error || "Failed to save"); }
}

async function outreachMsgRevise(b){
  const dir = b.dataset.dir, file = b.dataset.file;
  if(msgPending.has(dir)) return; // already in flight — never a second real claude -p spawn
  const inp = b.closest(".aibox").querySelector(".msg-revise-input");
  const instruction = inp ? inp.value.trim() : "";
  if(!instruction){ flash("Type what should change first"); return; }
  msgError.delete(dir);
  msgPending.add(dir); renderOutreachBox();
  try {
    const r = await post("/api/outreach/message/revise", {dir, file, instruction});
    if(r.ok){ flash("Message revised"); await loadOutreach(); }
    else { msgError.set(dir, r.error || "Failed to revise"); }
  } catch (e) {
    msgError.set(dir, e instanceof Error ? e.message : String(e));
  } finally {
    msgPending.delete(dir); renderOutreachBox();
  }
}

// "Scout new leads": the header button on this room's Leads pane. A real /scout run (minutes).
async function scoutRun(){
  if(scoutInFlight) return;
  scoutInFlight = true;
  const box = $("#outreachList");
  const banner = document.createElement("div");
  banner.className = "hint";
  banner.style.padding = "10px 4px";
  banner.textContent = "✨ Scouting for new leads with bounded searches on your subscription. It takes minutes. The strip at the top of this room carries the clock, and the Studio room has the log.";
  box.prepend(banner);
  loadJobs(); // make the scout job visible in the Studio room right away
  try {
    const r = await post("/api/outreach/scout", {});
    if(r.ok){ flash("Scout finished — leads reloaded"); }
    else flash(r.error || "Scout failed — see the job log");
  } catch (e) {
    flash(e instanceof Error ? e.message : String(e));
  } finally {
    scoutInFlight = false;
    await loadOutreach();
  }
}

// Two reads, one render. The leads carry who and why; the follow-ups ledger is the only place a
// real "when it was last pitched" exists, so the triage rail waits for both rather than guessing.
async function loadOutreach(){
  const box = $("#outreachList");
  if(!OUTREACH_LEADS) box.innerHTML = '<div class="empty">Loading…</div>';
  const [leadsRes, fuRes] = await Promise.all([
    fetch("/api/outreach/leads"),
    fetch("/api/followups").catch(()=>null),
  ]);
  const d = await leadsRes.json();
  OUTREACH_LEADS = d.leads || [];
  OUTREACH_TOUCH = {};
  if(fuRes && fuRes.ok){
    try {
      const fu = await fuRes.json();
      const b = fu.buckets || {};
      const rows = [].concat(b.client||[], b.platform||[]);
      for(const row of rows){
        if(!row.dir || !row.lastTouch) continue;
        const prev = OUTREACH_TOUCH[row.dir];
        if(!prev || row.lastTouch > prev) OUTREACH_TOUCH[row.dir] = row.lastTouch;
      }
    } catch (e) { /* no ledger yet: every row reads "never pitched", which is the truth */ }
  }
  renderOutreachBox();
}


// ── Content room: the workbench (Content Studio Riff 3a/3b) ──
// One sheet per active piece: Muxin's source verbatim in serif behind the blue pencil, each cut
// rendered as the message it is, the director's checks in the margin, one clear handoff. Accept
// still builds cuts server-side from verbatim lines only (what you see IS what gets accepted);
// the reply box runs another advisor round as a queued job; "Hand it to the team" runs the
// formatting pipeline. Nothing publishes — every draft lands below in "Drafts for your yes".
let WB_SESSIONS = [];
const devReplyPending = new Set(); // slugs with a just-clicked reply, before the job shows in JOBS
const wbExpanded = new Set();      // slugs whose full source text is expanded

function devWorking(slug){
  return devReplyPending.has(slug) || JOBS.some(j =>
    (j.kind==="develop"||j.kind==="develop-reply") && (j.status==="queued"||j.status==="running") &&
    (j.label==="Develop: "+slug || j.label==="Advisor reply: "+slug));
}
function fmtDay(iso){
  if(!iso) return "";
  const p = iso.split("-");
  const MO = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return MO[(Number(p[1])||1)-1]+" "+Number(p[2]);
}
function lineRefsText(refs){
  const parts = (refs||[]).map(String);
  if(!parts.length) return "";
  return (parts.length===1 ? "line " : "lines ")+parts.join(", ");
}
function wbCheckHtml(cls, verdict, label, textHtml){
  return '<div class="wb-check '+cls+'"><span class="t"><span class="verdict">'+esc(verdict)+'</span> · '+esc(label)+'</span><span class="d">'+textHtml+'</span></div>';
}
function wbMarginHtml(s){
  const kindLabel = {cta:"CTA check", spin:"Platform spin", routing:"Routing", note:"Note"};
  const checks = [];
  const last = s.rounds.length ? s.rounds[s.rounds.length-1] : null;
  if(last) for(const c of last.cards){
    if(c.kind==="angle") continue;
    checks.push(wbCheckHtml("", "checked", kindLabel[c.kind]||c.kind, esc(c.summary||c.title)));
  }
  // The extraction guarantee, synthesized from the cuts' own recorded provenance.
  const withLines = s.cuts.filter(c=>c.sourceLines && c.sourceLines.length);
  if(withLines.length){
    const refs = withLines.map(c=>lineRefsText(c.sourceLines)).join("; ");
    checks.push(wbCheckHtml("green", "held", "Extraction", esc("Every word is yours ("+refs+"), verbatim and trimmed. Nothing composed.")));
  }
  const body = checks.length ? checks.join("")
    : '<div class="wb-margin-sub">No director notes on this piece yet.</div>';
  const reply = devWorking(s.slug)
    ? '<div class="dev-working">✨ your director is working on a round… (Studio has the log)</div>'
    : '<div class="wb-reply"><input class="wb-reply-input" placeholder="Push back, or ask for another angle…" data-slug="'+esc(s.slug)+'" />'+
      '<button class="wb-reply-send" data-slug="'+esc(s.slug)+'">'+(s.rounds.length?"Send to your director":"Ask for a read")+'</button>'+
      '<span class="mono-note">a round takes 30s to a few min. real time.</span></div>';
  return '<div class="session-margin">'+
    '<div><div class="wb-margin-cap">WHAT YOUR DIRECTOR CHECKED</div>'+
    (s.rounds.length ? '<div class="wb-margin-sub">Ran the lenses against your words. Kept only what earned its place.</div>' : "")+
    '</div>'+body+reply+'</div>';
}
function wbAngleHtml(slug, card){
  const refs = lineRefsText(card.sourceLines);
  const preview = card.previewText!==undefined
    ? '<div class="dev-preview-label">your lines, verbatim ('+esc(refs)+')</div><div class="dev-preview">'+esc(card.previewText)+'</div>'
    : (card.previewError ? '<div class="aierr">⚠ '+esc(card.previewError)+'</div>' : "");
  const actions = card.previewText!==undefined
    ? '<div class="actions"><input class="dev-lens" value="'+esc(card.lens||"")+'" title="name for this cut (lowercase-with-dashes)" /><button class="dev-accept" data-slug="'+esc(slug)+'" data-card="'+esc(card.id)+'">Accept as cut</button><button class="dev-dismiss" data-slug="'+esc(slug)+'" data-card="'+esc(card.id)+'">Dismiss</button></div>'
    : '<div class="actions"><button class="dev-dismiss" data-slug="'+esc(slug)+'" data-card="'+esc(card.id)+'">Dismiss</button></div>';
  return '<div class="wb-proposal">'+
    '<div class="wb-cut-head"><span class="lens">Your director proposes a cut</span><span class="sub">'+esc(card.lens||"")+'</span></div>'+
    '<div style="font-weight:600;font-size:14px;margin-bottom:4px;">'+esc(card.title)+'</div>'+
    (card.summary?'<div class="dev-summary">'+esc(card.summary)+'</div>':"")+preview+actions+'</div>';
}
function wbSessionEl(s){
  const sheet = document.createElement("div");
  sheet.className = "sheet session";
  const expanded = wbExpanded.has(s.slug);
  const longSource = s.sourceBody.length > 420;
  const openAngles = [];
  for(const round of s.rounds) for(const c of round.cards) if(c.kind==="angle" && c.status==="open") openAngles.push(c);
  let main = '<div class="wb-title">'+esc(s.title)+'</div>'+
    '<div class="wb-label">You wrote'+(s.date?", "+fmtDay(s.date):"")+'</div>'+
    '<div class="wb-source'+((longSource&&!expanded)?" clamped":"")+'">'+esc(s.sourceBody)+'</div>'+
    (longSource?'<div class="wb-expand" data-slug="'+esc(s.slug)+'">'+(expanded?"show less":"read the whole page")+'</div>':"");
  if(s.cuts.length){
    main += '<div class="wb-sep"><span class="rule"></span><span class="txt">your director shaped '+(s.cuts.length>1?"cuts":"a cut")+'</span><span class="rule"></span></div>';
    for(const c of s.cuts){
      main += '<div class="wb-cut" data-lens="'+esc(c.lens)+'">'+
        '<div class="wb-cut-head"><span class="lens">The cut</span><span class="sub">'+esc(c.lens)+' · still your words, trimmed</span><span class="grow"></span><button class="wb-link wb-cut-edit" data-slug="'+esc(s.slug)+'" data-lens="'+esc(c.lens)+'">Edit the cut</button></div>'+
        '<div class="wb-cut-body">'+esc(c.body)+'</div></div>';
    }
  }
  for(const card of openAngles) main += wbAngleHtml(s.slug, card);
  const lensChecks = ["extract"].concat(s.cuts.map(c=>c.lens)).map(l =>
    '<label class="toggle"><input type="checkbox" class="dev-fmt-lens" value="'+esc(l)+'" checked /> '+esc(l)+'</label>').join("");
  main += '<div class="wb-handoff"><button class="primary dev-format-btn" data-slug="'+esc(s.slug)+'">Hand it to the team →</button>'+
    '<span class="note">They shape it for each platform, make the visuals, hold it for posting. Every draft comes back below for your yes.</span>'+lensChecks+'</div>';
  if(s.pending) main += '<div class="wb-links"><span class="wb-link wb-goto-review">'+s.pending+' draft'+(s.pending===1?"":"s")+' below, waiting for your yes ↓</span></div>';
  sheet.innerHTML = '<div class="session-grid"><div class="session-main">'+main+'</div>'+wbMarginHtml(s)+'</div>';
  return sheet;
}
function renderWorkbench(){
  const box = $("#workbench");
  box.innerHTML = "";
  for(const s of WB_SESSIONS) box.appendChild(wbSessionEl(s));
}
async function loadContent(){
  const r = await fetch("/api/content"); const d = await r.json();
  WB_SESSIONS = d.sessions || [];
  renderWorkbench();
}
async function devStart(){
  const ta = $("#src"); const source = ta.value.trim();
  if(!source){ flash("Write or paste something first"); return; }
  $("#devStartBtn").disabled = true;
  const r = await post("/api/develop/start",{source});
  $("#devStartBtn").disabled = false;
  if(r.ok){ ta.value=""; flash("Handed over — your director is reading"); loadJobs(); }
  else flash(r.error || "Could not hand it over");
}
$("#devStartBtn").addEventListener("click", devStart);
// Delegated — the workbench is rebuilt wholesale on every load, same pattern as the notes list.
$("#workbench").addEventListener("click", async (e)=>{
  const t = e.target;
  if (!t || !t.classList) return;
  if (t.classList.contains("dev-accept")){
    const lensInput = t.closest(".actions").querySelector(".dev-lens");
    t.disabled = true;
    const body = {slug:t.dataset.slug, cardId:t.dataset.card};
    if (lensInput && lensInput.value.trim()) body.lens = lensInput.value.trim();
    const r = await post("/api/develop/accept", body);
    if(r.ok){ flash("Cut made: "+r.lens+" — your words, on the page"); await loadContent(); }
    else { t.disabled = false; flash(r.error || "Could not accept"); }
  } else if (t.classList.contains("dev-dismiss")){
    t.disabled = true;
    const r = await post("/api/develop/dismiss", {slug:t.dataset.slug, cardId:t.dataset.card});
    if(r.ok){ await loadContent(); } else { t.disabled = false; flash(r.error || "Could not dismiss"); }
  } else if (t.classList.contains("wb-reply-send")){
    const slug = t.dataset.slug;
    const inp = t.closest(".wb-reply").querySelector(".wb-reply-input");
    const reply = inp ? inp.value.trim() : "";
    const session = WB_SESSIONS.find(x=>x.slug===slug);
    const hasRounds = session && session.rounds.length;
    if(!reply && hasRounds){ flash("Type something for your director first"); return; }
    devReplyPending.add(slug); renderWorkbench();
    try {
      const r = reply
        ? await post("/api/develop/reply", {slug, reply})
        : await post("/api/develop/start", {slug});
      if(r.ok){ flash("Handed over — your director is on it"); await loadJobs(); }
      else flash(r.error || "Could not queue the round");
    } finally { devReplyPending.delete(slug); renderWorkbench(); }
  } else if (t.classList.contains("dev-format-btn")){
    const slug = t.dataset.slug;
    const lenses = [...t.closest(".session-main").querySelectorAll(".dev-fmt-lens")].filter(c=>c.checked).map(c=>c.value);
    if(!lenses.length){ flash("Pick at least one cut"); return; }
    t.disabled = true;
    const r = await post("/api/develop/format", {slug, lenses});
    if(r.ok){ flash("Handed to the team — "+r.jobs.length+" formatting job(s); drafts land below for your yes"); loadJobs(); }
    else { t.disabled = false; flash(r.error || "Could not queue formatting"); }
  } else if (t.classList.contains("wb-cut-edit")){
    const cutEl = t.closest(".wb-cut");
    if(t.dataset.mode === "save"){
      const ta = cutEl.querySelector("textarea");
      const r = await post("/api/cut-save", {slug:t.dataset.slug, lens:t.dataset.lens, body:ta ? ta.value : ""});
      if(r.ok){ flash("Saved"); await loadContent(); }
      else flash(r.error || "Could not save");
    } else {
      const bodyEl = cutEl.querySelector(".wb-cut-body");
      const ta = document.createElement("textarea");
      ta.value = bodyEl.textContent;
      bodyEl.replaceWith(ta);
      t.textContent = "Save"; t.dataset.mode = "save";
    }
  } else if (t.classList.contains("wb-expand")){
    const slug = t.dataset.slug;
    if(wbExpanded.has(slug)) wbExpanded.delete(slug); else wbExpanded.add(slug);
    renderWorkbench();
  } else if (t.classList.contains("wb-goto-review")){
    $("#reviewSheet").scrollIntoView({behavior:"smooth", block:"start"});
  }
});

// "Draft it": her typed direction rides into THIS run's prompt via POST /api/outreach/draft. It
// wins over the stored pitch angle where they disagree. Iterating on the result is a different
// button ("Update it"), and it reuses the revise path that already existed.
async function outreachDraft(dir, btn){
  if(outPending.has(dir)) return; // already in flight — don't fire a second real claude -p spawn
  const wrap = btn ? btn.closest(".dir-box") : null;
  const input = wrap ? wrap.querySelector(".dir-input") : null;
  const direction = input ? input.value.trim() : (outDirection.get(dir) || "").trim();
  if(!direction){ flash("Say which way to take it first"); return; }
  outDirection.set(dir, direction);
  outSaid.set(dir, direction);
  outError.delete(dir);
  outPending.add(dir); renderOutreachBox();
  // Tracked separately from the try/catch, because a draft that landed and a reload that failed are
  // two different things. Once the message is written, nothing below may hand her back an empty
  // composer and an error, which would read as "try again" and write a second numbered draft.
  let drafted = false;
  try {
    // Recipient defaults to the lead's first contact so the message frontmatter carries the
    // person its follow-up clock will belong to.
    const lead = (OUTREACH_LEADS||[]).find(l=>l.dir===dir);
    const recipient = lead && lead.contacts && lead.contacts.length ? lead.contacts[0].name : undefined;
    const body = {dir, direction};
    if(recipient) body.recipient = recipient;
    const r = await post("/api/outreach/draft", body);
    if(r.ok){ drafted = true; outDirection.delete(dir); flash("Drafted. Shape it here before you ever send it."); }
    else outError.set(dir, r.error || "Failed to draft");
    await loadOutreach();
  } catch (e) {
    if(drafted) flash("It drafted, but the page could not reload. Refresh to see it.");
    else outError.set(dir, e instanceof Error ? e.message : String(e));
  } finally {
    if(!drafted) outSaid.delete(dir);
    outPending.delete(dir); renderOutreachBox();
  }
}

async function outreachDecide(dir, decision){
  const r = await post("/api/outreach/decide", {dir, decision});
  if(r.ok){ flash(decision==="pursue" ? "Marked worth pursuing" : "Passed"); loadOutreach(); }
  else flash(r.error || "Failed");
}

// ── Fiction desk (Content Studio Riff 3f) ──
// The canon underneath the series, editable in place: world bible, plot line, character sheets.
// canon.md is append-only (story:lock owns it) and renders read-only. Chapter drafting and
// line-by-line review stay in the GitHub /story flow; the promo shortcuts in the margin are the
// only bridge to the rest of the studio, and they just seed the Content capture for Muxin.
let FICTION = null;
let ficSeries = null;
let ficDocPath = null;
let ficDocData = null;
async function loadFiction(){
  const r = await fetch("/api/fiction");
  FICTION = (await r.json()).series || [];
  if(!FICTION.length){
    $("#fictionMain").innerHTML = '<div class="empty">No series on the desk yet. Start one with /story new in a terminal.</div>';
    $("#fictionSide").innerHTML = "";
    return;
  }
  if(!ficSeries || !FICTION.some(s=>s.slug===ficSeries)) ficSeries = FICTION[0].slug;
  const series = FICTION.find(s=>s.slug===ficSeries);
  if(!ficDocPath || !series.docs.some(d=>d.path===ficDocPath)) ficDocPath = series.docs[0].path;
  const dr = await fetch("/api/fiction/doc?series="+encodeURIComponent(ficSeries)+"&path="+encodeURIComponent(ficDocPath));
  ficDocData = await dr.json();
  renderFiction();
}
function renderFiction(){
  const series = FICTION.find(s=>s.slug===ficSeries);
  const d = ficDocData;
  const doc = series.docs.find(x=>x.path===ficDocPath);
  const history = (d.history||[]).length ? '<details class="lead-details" style="margin-top:10px"><summary>Version history</summary><div class="ntext" style="font-size:12px">'+d.history.map(esc).join("<br>")+'</div></details>' : "";
  $("#fictionMain").innerHTML =
    '<div class="wb-label">'+esc(series.title)+' · your canon</div>'+
    '<div style="font:400 27px/1.35 Georgia,serif;margin:2px 0 14px;">'+esc(doc.label)+'</div>'+
    '<div id="ficBody" style="font:400 16px/1.75 Georgia,serif;border:1px dashed #e0d6c0;border-radius:8px;padding:20px 22px;background:#fcfbf7;white-space:pre-wrap;max-height:520px;overflow:auto;">'+esc(d.body)+'</div>'+
    '<div class="actions" style="margin-top:12px">'+
      (doc.editable
        ? '<button class="primary" id="ficEditBtn">Edit in place</button><span class="src">Saves straight to your canon. What you save here is what the drafts build from.</span>'
        : '<span class="src">Append-only: /story lock writes this ledger; the desk only reads it.</span>')+
    '</div>'+history+
    '<div style="margin-top:26px;padding-top:16px;border-top:1px solid #efe7d6;" class="src">Chapter drafting and line-by-line review stay in your GitHub flow (/story), where you already work sentence by sentence. This desk holds the canon underneath it.</div>';
  $("#fictionSide").innerHTML =
    '<div class="wb-margin-cap">YOUR CANON · CLICK TO OPEN</div>'+
    series.docs.map(x=>'<div class="lead-chip'+(x.path===ficDocPath?" on":"")+'" style="display:flex" data-path="'+esc(x.path)+'">'+esc(x.label)+'</div>').join("")+
    '<div class="wb-reply"><div class="wb-margin-cap">PROMOTE THE SERIES</div>'+
    '<span class="wb-link" id="ficPromoNote">Start a launch note in Content</span>'+
    '<span class="mono-note">Promo is the only bridge to the rest of the studio: teasers quote LOCKED chapters verbatim. Character art: /illustrate '+esc(ficSeries)+' character &lt;name&gt; in a terminal.</span></div>';
  document.querySelectorAll("#fictionSide .lead-chip").forEach(c=>c.addEventListener("click",()=>{ ficDocPath=c.dataset.path; loadFiction(); }));
  const editBtn = $("#ficEditBtn");
  if(editBtn) editBtn.addEventListener("click", ()=>{
    const bodyEl = $("#ficBody");
    if(editBtn.dataset.mode==="save"){
      const ta = bodyEl.querySelector("textarea");
      post("/api/fiction/doc",{series:ficSeries, path:ficDocPath, body: ta?ta.value:""}).then(r=>{
        if(r.ok){ flash("Saved to your canon"); loadFiction(); } else flash(r.error||"Could not save");
      });
      return;
    }
    const ta = document.createElement("textarea");
    ta.value = ficDocData.body;
    ta.style.cssText = "width:100%;min-height:420px;font:400 15px/1.7 Georgia,serif;border:none;background:transparent;resize:vertical;";
    bodyEl.innerHTML=""; bodyEl.appendChild(ta);
    editBtn.textContent = "Save to canon"; editBtn.dataset.mode = "save";
  });
  const promo = $("#ficPromoNote");
  if(promo) promo.addEventListener("click", ()=>{
    setRoom("content");
    $("#src").value = "Launch note for "+series.title+": ";
    $("#src").focus();
  });
}

async function draftCharles(){
  const mode = $("#charlesMode").value;
  const input = $("#charlesInput").value.trim();
  if(mode==="reply" && !input){ flash("Paste a URL to reply to first"); return; }
  const btn = $("#charlesDraftBtn");
  btn.disabled = true; btn.textContent = "Drafting… (check Studio for progress)";
  const r = await post("/api/charles/draft", {mode, input});
  btn.disabled = false; btn.textContent = "Draft";
  if(r.ok){
    $("#charlesInput").value = "";
    charlesId = r.id;
    flash("Drafted — waiting in the queue below");
    if(currentTab==="charles") loadCharles();
  } else flash(r.error || "Could not draft");
}
$("#charlesDraftBtn").addEventListener("click", draftCharles);

let charlesBriefLoaded = false;
async function loadCharlesBrief(){
  if(charlesBriefLoaded) return;
  const r = await fetch("/api/charles/persona-brief");
  const d = await r.json();
  $("#charlesBriefText").value = d.ok ? d.text : "";
  if(d.ok) charlesBriefLoaded = true;
}
$("#charlesBriefCopyBtn").addEventListener("click", async ()=>{
  try{ await navigator.clipboard.writeText($("#charlesBriefText").value); flash("Copied"); }
  catch(e){ $("#charlesBriefText").select(); flash("Select-all + Cmd/Ctrl-C to copy"); }
});

// ── Charles desk (Build 4) ──
// charles/review-queue.md + the drafts it points at. Same approve/revise/discard contract as the
// Content room, against Charles's simpler 5-column table (see charles/CLAUDE.md). Nothing here
// posts anything — approving just flips the status cell; Muxin pastes it to Substack herself.
let CHARLES_POSTS = [];
let charlesId = null;
function typeLabel(t){ return t==="one-liner" ? "One-liner" : t==="essay" ? "Essay" : t==="reply" ? "Reply" : t; }
async function loadCharles(){
  loadCharlesBrief();
  const r = await fetch("/api/charles");
  CHARLES_POSTS = (await r.json()).posts || [];
  if(!CHARLES_POSTS.length){
    $("#charlesMain").innerHTML = '<div class="empty">Nothing drafted yet. Pick a mode above and hit Draft.</div>';
    $("#charlesSide").innerHTML = "";
    return;
  }
  if(!charlesId || !CHARLES_POSTS.some(p=>p.id===charlesId)) charlesId = CHARLES_POSTS[0].id;
  renderCharles();
}
function renderCharles(){
  const post = CHARLES_POSTS.find(p=>p.id===charlesId);
  $("#charlesMain").innerHTML =
    '<div class="wb-label">Charles Lord Featherbottom · '+esc(typeLabel(post.type))+'</div>'+
    '<div style="display:flex;align-items:center;gap:10px;margin:2px 0 14px;">'+
      '<span class="pill '+pillClass(post.status)+'">'+esc(statusLabel(post.status))+'</span>'+
      (post.notes ? '<span class="src">'+esc(post.notes)+'</span>' : "")+
    '</div>'+
    '<div id="charlesBody" style="font:400 16px/1.75 Georgia,serif;border:1px dashed #e0d6c0;border-radius:8px;padding:20px 22px;background:#fcfbf7;white-space:pre-wrap;max-height:460px;overflow:auto;">'+esc(post.body)+'</div>'+
    '<div class="actions" style="margin-top:12px">'+
      '<button class="approve'+(post.status==="approve"?" on":"")+'" data-act="approve">Approve</button>'+
      '<button class="revise'+(post.status==="revise"?" on":"")+'" data-act="revise">Revise</button>'+
      '<button class="discard'+(post.status==="discard"?" on":"")+'" data-act="discard">Discard</button>'+
      '<span class="spacer"></span>'+
      '<button id="charlesEditBtn" data-act="edit">Edit in place</button>'+
    '</div>'+
    '<div class="revisebox" id="charlesRevisebox"><input placeholder="what needs changing?" value="'+esc(post.notes||"")+'" /><button data-act="save-note">Save note</button></div>'+
    '<div style="margin-top:26px;padding-top:16px;border-top:1px solid #efe7d6;" class="src">Approving here does not post anything — Charles has no live-posting credentials on purpose (charles/CLAUDE.md). Once approved, paste it to Substack yourself.</div>';
  $("#charlesSide").innerHTML =
    '<div class="wb-margin-cap">DRAFTS · CLICK TO OPEN</div>'+
    CHARLES_POSTS.map(p=>'<div class="lead-chip'+(p.id===charlesId?" on":"")+'" style="display:flex;flex-direction:column;align-items:flex-start;gap:2px" data-id="'+esc(p.id)+'">'+
      '<span>'+esc(typeLabel(p.type))+' · '+esc(p.id)+'</span>'+
      '<span class="pill '+pillClass(p.status)+'" style="font-size:10px">'+esc(statusLabel(p.status))+'</span>'+
    '</div>').join("");
  document.querySelectorAll("#charlesSide .lead-chip").forEach(c=>c.addEventListener("click",()=>{ charlesId=c.dataset.id; renderCharles(); }));
  $("#charlesMain").querySelectorAll("[data-act]").forEach(b=>b.addEventListener("click", (e)=>onCharlesAction(e.target.dataset.act, post)));
}
async function onCharlesAction(act, item){
  if (act === "approve" || act === "discard"){
    const r = await post("/api/charles/status", {id:item.id, status:act});
    if (r.ok===false){ flash(r.error||"Failed"); return; }
    flash(act==="approve" ? "Approved — paste it to Substack when ready" : "Discarded");
    loadCharles();
  } else if (act === "revise"){
    $("#charlesRevisebox").classList.toggle("show");
  } else if (act === "save-note"){
    const note = $("#charlesRevisebox input").value;
    const r = await post("/api/charles/status", {id:item.id, status:"revise", notes:note});
    if (r.ok===false){ flash(r.error||"Failed"); return; }
    flash("Marked revise");
    loadCharles();
  } else if (act === "edit"){
    const bodyEl = $("#charlesBody");
    const btn = $("#charlesEditBtn");
    if(btn.dataset.mode==="save"){
      const ta = bodyEl.querySelector("textarea");
      const r = await post("/api/charles/doc", {id:item.id, body: ta?ta.value:""});
      if(r.ok){ flash("Saved"); loadCharles(); } else flash(r.error||"Could not save");
      return;
    }
    const ta = document.createElement("textarea");
    ta.value = item.body;
    ta.style.cssText = "width:100%;min-height:380px;font:400 15px/1.7 Georgia,serif;border:none;background:transparent;resize:vertical;";
    bodyEl.innerHTML=""; bodyEl.appendChild(ta);
    btn.textContent = "Save draft"; btn.dataset.mode = "save";
  }
}

// ── Signals room (Content Studio Riff 3e) ──
// Deterministic read of the latest brief: per-channel confidence cards and the brief's own
// [DO MORE]/[TEST]/[DO LESS] recommendations as "worth changing, your call" cards. Send to
// backlog files a card for the Claude Code pipeline; nothing changes by itself.
let SIGNALS = null;
const sigSent = new Set();
function signalStatusLabel(c){
  return c.status.startsWith("OK") ? c.weeks+" wks of data" : "insufficient · directional only";
}
function renderSignals(){
  if(!SIGNALS) return;
  $("#signalsBriefDate").textContent = SIGNALS.briefDate ? "data through "+SIGNALS.briefDate : "";
  const box = $("#signalsTop");
  if(!SIGNALS.briefPath){
    box.innerHTML = '<div class="empty">No strategy brief yet. Run Refresh brief below (or /strategy in a terminal) and this page fills in.</div>';
    return;
  }
  const fitCards = (SIGNALS.confidence||[]).map(c=>{
    const ok = c.status.startsWith("OK");
    return '<div class="stat-tile"><span style="font:600 14px/1.3 Georgia,serif;">'+esc(c.channel)+'</span>'+
      '<span class="l" style="color:'+(ok?"#2f7d46":"#9a6b12")+'">'+esc(signalStatusLabel(c))+'</span>'+
      '<span class="l">'+c.posts+' posts on record</span></div>';
  }).join("");
  const weak = (SIGNALS.confidence||[]).filter(c=>!c.status.startsWith("OK"));
  const recs = (SIGNALS.recommendations||[]).map((r,i)=>{
    const sent = sigSent.has(r.title);
    return '<div class="wb-proposal"><div class="wb-cut-head"><span class="lens">'+esc(r.type.toLowerCase())+'</span><span style="font-weight:600;font-size:14px;">'+esc(r.title)+'</span></div>'+
      '<div class="dev-summary">'+esc(r.rationale)+'</div>'+
      '<div class="actions">'+(sent
        ? '<span class="scheduled">✓ filed to the backlog — the pipeline grooms it from here</span>'
        : '<button class="primary sig-send" data-i="'+i+'">Send to backlog</button><span class="src">Files a card; Claude Code works out where it applies and tracks whether it held. Nothing changes until that ships.</span>')+
      '</div></div>';
  }).join("");
  box.innerHTML =
    '<div style="margin-top:16px"><div style="font:600 14px/1 Georgia,serif;margin-bottom:8px;">Where you fit, so far</div><div class="stat-tiles" style="margin-top:8px">'+fitCards+'</div></div>'+
    (weak.length?'<div class="src" style="margin-top:10px">Too weak to trust yet: '+weak.map(c=>esc(c.channel)).join(", ")+'. We will not build on those.</div>':"")+
    '<div style="margin-top:26px"><div style="font:600 14px/1 Georgia,serif;margin-bottom:4px;">Worth changing, your call</div>'+
    '<div class="src" style="margin-bottom:6px">Straight from the latest brief. These do not change anything by themselves.</div>'+
    (recs||'<div class="empty" style="padding:14px">The latest brief carries no recommendations.</div>')+'</div>';
  box.querySelectorAll(".sig-send").forEach(b=>b.addEventListener("click", async ()=>{
    const r = SIGNALS.recommendations[Number(b.dataset.i)];
    b.disabled = true;
    const res = await post("/api/signals/backlog", {title: r.title, detail: "["+r.type+"] "+r.rationale});
    if(res.ok){ sigSent.add(r.title); flash("Filed to the backlog"); renderSignals(); }
    else { b.disabled = false; flash(res.error || "Could not file it"); if((res.error||"").includes("already")) { sigSent.add(r.title); renderSignals(); } }
  }));
}
async function loadSignals(){
  const r = await fetch("/api/signals");
  SIGNALS = await r.json();
  renderSignals();
}

// ── Studio home (Content Studio Riff 3c) ──
// The one screen that spans all five rooms. Never starts work; shows what needs Muxin (ranked)
// and what the team is doing, from real queue/ledger data. Click-throughs land in the room that
// owns each item.
let STUDIO = null;
function studioDateLine(){
  const now = new Date();
  const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const MO = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return DAYS[now.getDay()]+", "+MO[now.getMonth()]+" "+now.getDate();
}
function renderStudio(){
  if(!STUDIO) return;
  const c = STUDIO.counts;
  const tiles = [
    [c.draftsToReview, "drafts to review", "#9a6b12", "content"],
    [c.dossiersToRead, "dossiers to read", "#2f5d9a", "outreach"],
    [c.followupsDue, "follow-ups due", "#9a6b12", "followups"],
    [c.postsHolding, "posts holding for slots", "#2f7d46", null],
  ].map(t=>'<div class="stat-tile"'+(t[3]?' style="cursor:pointer" data-goto="'+t[3]+'"':'')+'><span class="n" style="color:'+t[2]+'">'+t[0]+'</span><span class="l">'+t[1]+'</span></div>').join("");
  const rows = (STUDIO.needsYou||[]).map(n=>
    '<div class="ny-row'+(n.urgent?" urgent":"")+'"><span class="ny-room">'+esc(n.label)+'</span>'+
    '<span class="ny-text">'+esc(n.text)+' <span class="ny-detail">'+esc(n.detail)+'</span></span>'+
    '<span class="wb-link ny-go" data-room="'+esc(n.room)+'"'+(n.dir?' data-dir="'+esc(n.dir)+'"':'')+'>'+esc(n.action)+'</span></div>'
  ).join("");
  $("#studioMain").innerHTML =
    '<div class="wb-label" style="margin-bottom:2px">'+studioDateLine()+'</div>'+
    '<div style="font:400 30px/1.25 Georgia,serif;margin:2px 0 4px;">Everything happening, at a glance</div>'+
    '<div class="sheet-sub" style="max-width:560px">This screen never starts work, that is what Content is for. It shows what needs you and what the team is doing, so you never go hunting room by room.</div>'+
    '<div class="stat-tiles">'+tiles+'</div>'+
    '<div style="margin-top:30px;"><div style="font:600 14px/1 Georgia,serif;margin-bottom:8px;">Needs you today</div>'+
    (rows || '<div class="empty" style="padding:20px">Nothing needs you right now. 🎉</div>')+'</div>';
  renderTeamRail();
  document.querySelectorAll("#studioMain .ny-go").forEach(a=>a.addEventListener("click",()=>{
    const room = a.dataset.room;
    if(room==="content"){ setRoom("content"); $("#reviewSheet").scrollIntoView(); }
    else if(room==="outreach"){ if(a.dataset.dir) activeLeadDir=a.dataset.dir; setRoom("outreach"); setOutreachSub("leads"); }
    else if(room==="followups"){ setRoom("outreach"); setOutreachSub("followups"); }
    else setRoom(room);
  }));
  document.querySelectorAll("#studioMain .stat-tile[data-goto]").forEach(t=>t.addEventListener("click",()=>{
    const g = t.dataset.goto;
    if(g==="followups"){ setRoom("outreach"); setOutreachSub("followups"); }
    else if(g==="outreach"){ setRoom("outreach"); setOutreachSub("leads"); }
    else { setRoom("content"); if(g==="content") $("#reviewSheet").scrollIntoView(); }
  }));
}
async function loadStudio(){
  const r = await fetch("/api/studio");
  STUDIO = await r.json();
  renderStudio();
}

// ── Follow-ups ledger (Content Studio Riff 3g) ──
// Everything sent, and what's next — every row tied back to its origin: why you reached out,
// what you said, the dossier. Two people at one org are two rows with two clocks (the tracker
// folds per person). Calm copy from nextActionLabel; nothing here sends anything.
const FU_FILTERS = [["all","All"],["platform","Platform"],["client","Org"],["jobsearch","Job search"],["inbound","Inbound"]];
let fuFilter = "all";
let FOLLOWUPS_DATA = null;
const fuPending = new Set();
const fuError = new Map();
const fuOpen = new Set(); // row keys with the origin block expanded

function fuDotColor(status){
  return status==="due"||status==="overdue" ? "#9a6b12"
    : status==="responded" ? "#2f7d46"
    : status==="waiting" ? "#2f5d9a"
    : status==="done"||status==="abandoned" ? "#d8d2c6"
    : "#b0a488";
}
function fuNextColor(status){
  return status==="due"||status==="overdue" ? "#9a6b12" : status==="responded" ? "#2f7d46" : "#8a7f6d";
}
function fuAllRows(){
  const d = FOLLOWUPS_DATA;
  if(!d || !d.buckets) return [];
  const rows = [];
  for(const bucket of ["client","platform","jobsearch","inbound"]) for(const r of (d.buckets[bucket]||[])) rows.push(r);
  return rows;
}
function followupRowHtml(row){
  const disabled = row.status==="done" || row.status==="abandoned";
  const pending = row.dir ? fuPending.has(row.dir) : false;
  const err = row.dir ? fuError.get(row.dir) : null;
  const open = fuOpen.has(row.key);
  const nameParts = row.person ? [row.person, row.who.replace(row.person+" · ","")] : [row.who, ""];
  const sentLine = (row.channel?esc(row.channel):"—")+(row.lastTouch?' · last touch '+esc(row.lastTouch.slice(0,10)):' · never');
  const origin = open ? '<div class="fu-origin">'+
      '<div><div class="cap">Why you reached out</div><div class="cell">'+esc(row.why)+'</div></div>'+
      '<div><div class="cap">What you said</div>'+(row.saidExcerpt?'<div class="cell" style="font:italic 400 13px/1.55 Georgia,serif;">"…'+esc(row.saidExcerpt)+'…"</div>':'<div class="cell">no locked message on file</div>')+'</div>'+
      '<div><div class="cap">The dossier</div><div class="cell">'+(row.fit?esc(row.fit)+' fit':'—')+(row.dir?' · <span class="wb-link fu-reopen" data-dir="'+esc(row.dir)+'">reopen ↗</span>':"")+'</div></div>'+
    '</div>' : "";
  const status = pending
    ? '<div class="hint" style="margin-left:26px;">drafting… (the Studio room has progress + log)</div>'
    : err ? '<div class="aierr" style="margin-left:26px;">⚠ '+esc(err)+'</div>' : "";
  const draftBtn = row.dir && !disabled ? '<button class="fu-draft" data-dir="'+esc(row.dir)+'" data-person="'+esc(row.person||"")+'"'+(pending?" disabled":"")+'>'+(pending?"Drafting…":"Draft a follow-up")+'</button>' : "";
  const noteInput = disabled ? "" : '<input class="fu-note" placeholder="optional note (kept in the ledger)…" />';
  return '<div class="fu-row">'+
    '<div class="fu-head"><span class="fu-dot" style="background:'+fuDotColor(row.status)+'"></span>'+
      '<div><span class="fu-name">'+esc(nameParts[0])+'</span>'+(row.person?' <span class="fu-org">· '+esc(nameParts[1])+'</span>':"")+
      ' <span class="seg-chip '+(row.bucket==="platform"?"platform":row.bucket==="client"?"org-role":"content-example")+'">'+esc(row.bucket==="client"?"org":row.bucket)+'</span>'+
      '<div class="fu-meta">'+sentLine+' · <span class="wb-link fu-toggle" data-key="'+esc(row.key)+'">'+(open?"hide why":"show why")+'</span></div></div>'+
      '<span class="fu-next" style="color:'+fuNextColor(row.status)+'">'+esc(row.nextAction)+'</span></div>'+
    origin + status +
    '<div class="fu-actions">'+noteInput+
      '<button class="fu-responded" data-bucket="'+esc(row.bucket)+'" data-lead="'+esc(row.lead)+'" data-person="'+esc(row.person||"")+'"'+(disabled?" disabled":"")+'>They replied</button>'+
      '<button class="fu-contacted" data-bucket="'+esc(row.bucket)+'" data-lead="'+esc(row.lead)+'" data-person="'+esc(row.person||"")+'"'+(disabled?" disabled":"")+'>I nudged them</button>'+
      draftBtn+
      '<button class="fu-moveon" data-bucket="'+esc(row.bucket)+'" data-lead="'+esc(row.lead)+'" data-person="'+esc(row.person||"")+'"'+(disabled?" disabled":"")+'>Move on</button>'+
    '</div>'+
  '</div>';
}
function renderFollowupsBox(){
  if(!FOLLOWUPS_DATA) return;
  const box = $("#followupsList");
  $("#followupsNote").innerHTML = FOLLOWUPS_DATA.jobsearchNote ? '<div class="hint">Job search bucket: '+esc(FOLLOWUPS_DATA.jobsearchNote)+'</div>' : "";
  const rows = fuAllRows();
  const counts = {all: rows.length};
  for(const [k] of FU_FILTERS) if(k!=="all") counts[k] = rows.filter(r=>r.bucket===k).length;
  const chips = FU_FILTERS.map(([k,label])=>'<span class="lead-chip'+(fuFilter===k?" on":"")+'" data-f="'+k+'">'+label+' '+ (counts[k]||0) +'</span>').join("");
  const visible = rows.filter(r=>fuFilter==="all"||r.bucket===fuFilter);
  box.innerHTML = '<div class="lead-rail">'+chips+'</div>'+
    (visible.length ? visible.map(followupRowHtml).join("") : '<div class="empty">Nothing here yet. A row appears when you lock a message or mark a send.</div>');
  box.querySelectorAll(".lead-chip").forEach(c=>c.addEventListener("click",()=>{ fuFilter=c.dataset.f; renderFollowupsBox(); }));
  box.querySelectorAll(".fu-toggle").forEach(t=>t.addEventListener("click",()=>{
    if(fuOpen.has(t.dataset.key)) fuOpen.delete(t.dataset.key); else fuOpen.add(t.dataset.key);
    renderFollowupsBox();
  }));
  box.querySelectorAll(".fu-reopen").forEach(t=>t.addEventListener("click",()=>{ activeLeadDir=t.dataset.dir; setOutreachSub("leads"); }));
  const rowNote = (b) => { const inp = b.closest(".fu-actions").querySelector(".fu-note"); return inp ? inp.value.trim() : ""; };
  const args = (b) => { const o={bucket:b.dataset.bucket, lead:b.dataset.lead}; const n=rowNote(b); if(n) o.note=n; if(b.dataset.person) o.person=b.dataset.person; return o; };
  box.querySelectorAll("button.fu-responded").forEach(b=>b.addEventListener("click", ()=>followupAction("mark-responded", args(b))));
  box.querySelectorAll("button.fu-contacted").forEach(b=>b.addEventListener("click", ()=>followupAction("mark-contacted", args(b))));
  box.querySelectorAll("button.fu-moveon").forEach(b=>b.addEventListener("click", ()=>followupAction("move-on", args(b))));
  box.querySelectorAll("button.fu-draft").forEach(b=>b.addEventListener("click", ()=>followupDraft(b.dataset.dir, b.dataset.person)));
}
async function loadFollowups(){
  const box = $("#followupsList");
  if(!FOLLOWUPS_DATA) box.innerHTML = '<div class="empty">Loading…</div>';
  const r = await fetch("/api/followups");
  const d = await r.json();
  if(!d.ok){ box.innerHTML = '<div class="empty">'+esc(d.error||"failed to load")+'</div>'; return; }
  FOLLOWUPS_DATA = d;
  renderFollowupsBox();
}
async function followupAction(action, body){
  const r = await post("/api/followups/"+action, body);
  if(r.ok){ flash(action==="mark-responded" ? "Marked replied" : action==="mark-contacted" ? "Nudge logged — clock restarted" : "Moved on"); loadFollowups(); }
  else flash(r.error || "Failed");
}
async function followupDraft(dir, person){
  if(fuPending.has(dir)) return; // already in flight — never a second real claude -p spawn
  fuError.delete(dir);
  fuPending.add(dir); renderFollowupsBox();
  try {
    const r = await post("/api/followups/draft-follow-up", person ? {dir, recipient: person} : {dir});
    if(r.ok){ flash("Follow-up drafted — shape it on the Leads pane"); await loadFollowups(); }
    else { fuError.set(dir, r.error || "Failed to draft"); }
  } catch (e) {
    fuError.set(dir, e instanceof Error ? e.message : String(e));
  } finally {
    fuPending.delete(dir); renderFollowupsBox();
  }
}


// ── ingest + job queue ──
let JOBS = [];
function fmtElapsed(ms){
  if(ms==null) return "";
  const s = Math.round(ms/1000);
  return s<60 ? s+"s" : Math.floor(s/60)+"m "+(s%60)+"s";
}
// ── job UI surfaces (v5 §5): three screens, one source (/api/jobs) ──
// Inline duplicates of the exported mirrors at the top of this file (jobRoom, jobRailLabel,
// jobClockText, jobStepDots, jobFooter, stripJobFor, teamRailHeader, ...). The client script cannot
// import them, so they are kept in sync by hand, same convention as the mirrors above.
// One duration per job per screen, always from elapsedMs: the panel row's clock on Studio, the
// strip's clock in the destination room. Never a frozen literal beside a live counter.
const JC = { ai:"#5b46b8", amber:"#9a6b12", green:"#2f7d46", red:"#9a2f2f", grey:"#d8d2c6", greyFg:"#a89a80", blue:"#2f5d9a" };
const STRIP_LINGER_MS = 9000;
const JOBS_POLL_MS = 3000;
// Mirrors jobAwaitingAnswer/jobSettled/jobsPollDue/enqueuesJob in this file's Node-side export,
// kept in sync by hand. An answered ask is settled work: it stops reading as "waiting on you".
function jobAwaitingAnswer(j){ return j.status==="blocked" && !j.answer; }
function jobSettled(j){ return j.status==="done" || (j.status==="blocked" && !!j.answer); }
function jobsPollDue(jobs, now, armedUntil){
  if(now < (armedUntil||0)) return true;
  if(jobs.some(j=>j.status==="queued"||j.status==="running")) return true;
  return jobs.some(j=>j.finishedAt!=null && now-j.finishedAt < STRIP_LINGER_MS + JOBS_POLL_MS);
}
const JOB_ENQUEUE_ROUTES = ["/api/atomize","/api/notes/pick","/api/revise","/api/duplicate","/api/video/generate","/api/develop/start","/api/develop/reply","/api/develop/format","/api/strategy/ask","/api/strategy/refresh-brief","/api/strategy/insights","/api/strategy/ask-insights","/api/strategy/pull","/api/outreach/scout","/api/outreach/draft","/api/outreach/message/revise","/api/charles/draft","/api/followups/draft-follow-up"];
function enqueuesJob(path){ return JOB_ENQUEUE_ROUTES.includes(path); }
function jobRoom(kind){
  if(kind==="scout"||kind==="draft-follow-up"||kind==="outreach-revise") return "Outreach";
  if(kind==="pull"||kind==="strategy"||kind==="insights"||kind==="ask-insights"||kind==="brief-revise") return "Signals";
  if(kind==="charles-draft") return "Charles";
  return "Content";
}
function jobLanding(room){
  if(room==="Fiction") return "A scene draft, waiting on your read.";
  if(room==="Content") return "A cut, waiting on your yes.";
  if(room==="Outreach") return "A message, locked only when you say so.";
  if(room==="Signals") return "Filed. It writes nothing.";
  if(room==="Venture") return "An answer in the build conversation.";
  return "";
}
function jobElapsedText(ms){ return ms==null ? "not started" : fmtElapsed(ms); }
function jobRail(j){
  if(j.status==="failed") return {text:"Did not work", color:JC.red};
  if(j.status==="blocked") return j.answer ? {text:"You answered", color:JC.green} : {text:"Needs you", color:JC.amber};
  if(j.status==="done") return {text:jobRoom(j.kind), color:JC.green};
  if(j.status==="queued") return {text:"Waiting its turn", color:JC.greyFg};
  return {text:"Working", color:JC.ai};
}
function jobsAhead(jobs, j){
  const idx = jobs.findIndex(x=>x.id===j.id);
  return jobs.filter((x,i)=>x.status==="queued" && i<idx).length + (jobs.some(x=>x.status==="running")?1:0);
}
function jobClock(j, ahead){
  if(j.status==="queued") return ahead+" ahead of it";
  if(j.status==="failed") return "stopped after "+jobElapsedText(j.elapsedMs);
  if(j.status==="done") return "took "+jobElapsedText(j.elapsedMs);
  return jobElapsedText(j.elapsedMs);
}
// step counts COMPLETED steps, so the one in flight is index step; failedAtStep is that same
// 0-based index. steps is [] on every real job today (no skill emits STEP markers yet).
function jobStepDots(j){
  const steps = j.steps||[], step = j.step||0;
  if(j.status==="queued") return steps.map(t=>({text:t,state:"pending"}));
  if(j.status==="done") return steps.map(t=>({text:t,state:"done"}));
  if(j.status==="failed"){ const at=j.failedAtStep;
    return steps.map((t,i)=>({text:t,state: at==null?"pending" : i===at?"failed" : i<at?"done":"pending"})); }
  if(j.status==="blocked"){ const at=Math.min(step, steps.length-1);
    return steps.map((t,i)=>({text:t,state: i===at?"blocked" : i<at?"done":"pending"})); }
  return steps.map((t,i)=>({text:t,state: i<step?"done" : i===step?"current":"pending"}));
}
function dotColor(state){
  return state==="done"?JC.green : state==="current"?JC.ai : state==="blocked"?JC.amber : state==="failed"?JC.red : JC.grey;
}
function jobProgressPct(j){ return !j.stepTotal ? null : Math.round((Math.min(j.step||0, j.stepTotal)/j.stepTotal)*100); }
const ANSWERED_FOOTER = "You answered. A fresh job is running it from the start.";
function jobAnswerEcho(j){ return j.answer ? "You said: "+j.answer : ""; }
function jobFooter(j){
  if(j.status==="failed") return "It stopped where the red dot is. Nothing was written.";
  if(j.status==="blocked") return j.answer ? ANSWERED_FOOTER : "It stops here until you answer. Nothing is written in the meantime.";
  if(j.status==="done") return jobLanding(jobRoom(j.kind));
  if(j.status==="queued") return "One job runs at a time, so this starts when the one above finishes.";
  return j.lastStdoutLine || "Real elapsed time, not an estimate.";
}
function jobLogLine(j){
  const path = j.logPath||"";
  if(j.status==="failed") return "> stopped at "+path;
  if(j.status==="blocked") return j.answer ? "> stopped, you answered it" : "> stopped, waiting on your answer";
  if(j.status==="queued") return "> waiting for a slot";
  if(j.status==="done") return "> wrote to "+path;
  return "> reading "+path+" ...";
}
function jobOpenLabel(j){ return (j.status==="done" ? "Read it in " : "Watch it in ") + jobRoom(j.kind); }
function stepsHtml(dots){
  return dots.map(d=>'<div class="jstep '+d.state+'"><i style="background:'+dotColor(d.state)+'"></i><span>'+esc(d.text)+'</span></div>').join("");
}
function askBoxHtml(j){
  if(j.status==="blocked" && j.ask){
    return '<div class="jbox"><div class="q">'+esc(j.ask.question)+'</div>'+
      (j.answer ? "" : '<div class="opts">'+
        (j.ask.options||[]).map(o=>'<button class="jans" data-id="'+esc(j.id)+'" data-opt="'+esc(o)+'">'+esc(o)+'</button>').join("")+'</div>')+
      '</div>';
  }
  if(j.status==="failed"){
    return '<div class="jbox bad"><div class="q">'+esc(j.error||"It stopped without saying why.")+'</div>'+
      (j.retryable ? '<div class="opts"><button class="jretry" data-id="'+esc(j.id)+'">Try it again</button></div>' : "")+'</div>';
  }
  return "";
}
function renderJobs(){
  const box = $("#jobs"); box.innerHTML = "";
  if(!JOBS.length){ box.innerHTML = '<div class="empty" style="padding:34px">Nothing queued yet. Drop an idea above. 🌱</div>'; return; }
  const clearable = JOBS.some(j=>j.status==="done"||j.status==="failed");
  let html = '<div class="jobs-head"><h3>Queue</h3>'+(clearable?'<button id="clearJobsBtn">Clear queue</button>':'')+'</div>';
  for(const j of [...JOBS].reverse()){
    const rail = jobRail(j), pct = jobProgressPct(j), dots = jobStepDots(j);
    const cls = j.status==="failed" ? " bad" : j.status==="blocked" ? " asking" : "";
    html += '<div class="jrow'+cls+'">'+
      '<div class="jrow-head"><span style="min-width:0">'+
        '<span class="jrow-rail" style="color:'+rail.color+'">'+esc(rail.text)+'</span>'+
        '<span class="jrow-text">'+esc(j.label)+'</span></span>'+
      '<span class="jrow-clock">'+esc(jobClock(j, jobsAhead(JOBS, j)))+'</span></div>'+
      (pct!=null ? '<div class="jrow-bar"><span style="width:'+pct+'%;background:'+rail.color+'"></span></div>' : "")+
      (dots.length ? '<div class="jsteps">'+stepsHtml(dots)+
        (j.answer ? '<div class="jstep done"><i style="background:'+JC.blue+'"></i><span style="font-family:Georgia,serif">'+esc(jobAnswerEcho(j))+'</span></div>' : "")+
        '</div>' : "")+
      askBoxHtml(j)+
      '<div class="jfoot">'+esc(jobFooter(j))+'</div>'+
      '<div class="jrow-tail">'+
        (j.status!=="queued" ? '<span class="jpath">'+esc(jobLogLine(j))+'</span>' : "")+
        '<span class="grow"></span>'+
        (j.startedAt ? '<a href="/api/jobs/'+encodeURIComponent(j.id)+'/log" target="_blank">Open the log</a>' : "")+
        '<a href="#" class="jopen" data-room="'+esc(jobRoom(j.kind).toLowerCase())+'"'+(j.slugs&&j.slugs.length?' data-slug="'+esc(j.slugs[0])+'"':'')+'>'+esc(jobOpenLabel(j))+'</a>'+
      '</div></div>';
  }
  box.innerHTML = html;
  box.querySelectorAll("a.jopen").forEach(a=>a.addEventListener("click",(e)=>{
    e.preventDefault(); setRoom(a.dataset.room);
    if(a.dataset.slug) load().then(()=>{
      const d = [...document.querySelectorAll(".piece .slug")].find(x=>x.textContent===a.dataset.slug);
      if(d) d.scrollIntoView({behavior:"smooth", block:"start"});
    });
  }));
  box.querySelectorAll("button.jans").forEach(b=>b.addEventListener("click",()=>answerJob(b.dataset.id, b.dataset.opt)));
  box.querySelectorAll("button.jretry").forEach(b=>b.addEventListener("click",()=>retryJob(b.dataset.id)));
}
async function answerJob(id, answer){
  const r = await post("/api/jobs/"+encodeURIComponent(id)+"/answer",{answer});
  if(r.ok) loadJobs(); else flash(r.error || "Could not send that answer");
}
async function retryJob(id){
  const r = await post("/api/jobs/"+encodeURIComponent(id)+"/retry",{});
  if(r.ok) loadJobs(); else flash(r.error || "Could not run it again");
}
// The destination room's progress strip. Lingers STRIP_LINGER_MS after a job finishes so arriving
// late still shows what happened; a blocked or failed job holds it until it is acted on. Fiction
// suppresses it on a failure (Fiction shows its own failure card: one per screen, never two), and
// Charles has no strip at all.
function stripJobFor(jobs, room, now, roomOf){
  if(room==="Charles") return null;
  const to = roomOf || jobRoom;
  const inRoom = jobs.filter(j=>to(j.kind)===room);
  const live = inRoom.filter(j=>!jobSettled(j));
  const lingering = inRoom.filter(j=>j.finishedAt!=null && now-j.finishedAt < STRIP_LINGER_MS);
  const candidate = live.length ? live[live.length-1] : lingering.length ? lingering[lingering.length-1] : null;
  if(!candidate) return null;
  // Judged on the newest job, not on "any fiction job ever failed". See the Node-side mirror.
  if(room==="Fiction" && candidate.status==="failed") return null;
  return candidate;
}
function stripRail(j){
  if(j.status==="failed") return {text:"Did not work", color:JC.red};
  if(j.status==="blocked") return j.answer ? {text:"You answered", color:JC.green} : {text:"Stopped, needs you", color:JC.amber};
  if(j.status==="done") return {text:"Just finished", color:JC.green};
  if(j.status==="queued") return {text:"Waiting its turn", color:JC.greyFg};
  return {text:"Working now", color:JC.ai};
}
function stripClock(j){
  if(j.status==="queued") return "not started";
  if(j.status==="failed") return "stopped after "+jobElapsedText(j.elapsedMs);
  if(j.status==="done") return "took "+jobElapsedText(j.elapsedMs);
  return jobElapsedText(j.elapsedMs);
}
function stripFooter(j){
  if(j.status==="failed") return "It stopped where the red dot is. Nothing was written.";
  if(j.status==="blocked") return j.answer ? ANSWERED_FOOTER : "It stops here until you answer. Nothing is written in the meantime.";
  if(j.status==="done") return jobLanding(jobRoom(j.kind));
  if(j.status==="queued") return "One job runs at a time. This starts when the current one finishes.";
  return j.lastStdoutLine || "Real elapsed time, not an estimate.";
}
function renderRoomStrips(){
  const now = Date.now();
  for(const room of ["Content","Outreach","Fiction","Signals"]){
    const box = $("#strip"+room); if(!box) continue;
    const j = stripJobFor(JOBS, room, now);
    if(!j){ box.hidden = true; box.innerHTML = ""; continue; }
    const rail = stripRail(j), pct = jobProgressPct(j), dots = jobStepDots(j);
    box.hidden = false;
    box.innerHTML = '<div class="room-strip">'+
      '<div class="sh"><span class="rail" style="color:'+rail.color+'">'+esc(rail.text)+'</span>'+
      '<span class="clock">'+esc(stripClock(j))+'</span></div>'+
      '<div class="stext">'+esc(j.label)+'</div>'+
      (pct!=null ? '<div class="jrow-bar"><span style="width:'+pct+'%;background:'+rail.color+'"></span></div>' : "")+
      (dots.length ? '<div class="jsteps">'+stepsHtml(dots)+
        (j.answer ? '<div class="jstep done"><i style="background:'+JC.blue+'"></i><span style="font-family:Georgia,serif">'+esc(jobAnswerEcho(j))+'</span></div>' : "")+
        '</div>' : "")+
      askBoxHtml(j)+
      '<div class="jfoot">'+esc(stripFooter(j))+'</div></div>';
    box.querySelectorAll("button.jans").forEach(b=>b.addEventListener("click",()=>answerJob(b.dataset.id, b.dataset.opt)));
    box.querySelectorAll("button.jretry").forEach(b=>b.addEventListener("click",()=>retryJob(b.dataset.id)));
  }
}
// Studio's team rail. Live rows come from the jobs themselves, named for the room each lands in;
// the resting rows come from /api/studio. No clock here on purpose: the working panel on this same
// screen already carries each job's one duration.
function teamRailHeader(jobs){
  if(jobs.some(jobAwaitingAnswer)) return "YOUR TEAM, WAITING ON YOU";
  if(jobs.some(j=>j.status==="running")) return "YOUR TEAM, WORKING";
  return "YOUR TEAM, IDLE";
}
function teamRoomName(room){
  if(room==="Fiction") return "Co-writer";
  if(room==="Content") return "Formatter";
  if(room==="Outreach") return "Connector";
  if(room==="Signals") return "Reader";
  if(room==="Venture") return "Build";
  return "Charles";
}
function teamLiveRows(jobs){
  return jobs.filter(j=>!jobSettled(j)).map(j=>{
    const steps = j.steps||[];
    const inFlight = steps.length ? steps[Math.min(j.step||0, steps.length-1)].toLowerCase() : j.label;
    return {
      who: teamRoomName(jobRoom(j.kind)),
      what: j.status==="failed" ? "Stopped: it did not work"
        : j.status==="blocked" ? "Stopped: needs your answer"
        : j.status==="queued" ? "queued behind another job" : inFlight,
      color: j.status==="failed" ? JC.red : j.status==="blocked" ? JC.amber : j.status==="queued" ? JC.grey : JC.ai,
      urgent: j.status==="failed" || j.status==="blocked",
      action: j.status==="failed" ? "SEE WHAT STOPPED IT" : j.status==="blocked" ? "ANSWER IT" : ""
    };
  }).sort((a,b)=>Number(b.urgent)-Number(a.urgent));
}
// Drop a resting row whose NAME is already live, and any row /api/studio derived from these same
// jobs (its "working" row, its "Queue" row) so no agent ever appears twice.
function restingTeamRows(resting, live){
  const names = new Set(live.map(r=>r.who));
  return resting.filter(r=>!names.has(r.name) && r.state!=="working" && r.name!=="Queue");
}
function renderTeamRail(){
  const box = $("#studioTeam"); if(!box) return;
  const live = teamLiveRows(JOBS);
  const resting = restingTeamRows((STUDIO && STUDIO.team) || [], live);
  const restDot = (state)=> state==="recent" ? JC.green : JC.grey;
  box.innerHTML = '<div class="wb-margin-cap">'+teamRailHeader(JOBS)+'</div>'+
    live.map(r=>'<div class="team-row'+(r.urgent?" urgent":"")+'"><span class="team-dot" style="background:'+r.color+'"></span>'+
      '<div><div class="team-name">'+esc(r.who)+'</div><div class="team-line">'+esc(r.what)+'</div>'+
      (r.urgent?'<div class="team-action">'+esc(r.action)+'</div>':"")+'</div></div>').join("")+
    resting.map(m=>'<div class="team-row"><span class="team-dot" style="background:'+restDot(m.state)+'"></span>'+
      '<div><div class="team-name">'+esc(m.name)+'</div><div class="team-line">'+esc(m.line)+'</div></div></div>').join("")+
    '<div class="wb-reply"><span class="mono-note">You bring the yes. They handle the brand phrase, the CTA, the spin, the visuals, the posting. Nothing goes out until you say so.</span></div>';
}

async function loadJobs(){
  try{
    const before = JSON.stringify(JOBS.map(j=>[j.id,j.status]));
    const r = await fetch("/api/jobs"); JOBS = (await r.json()).jobs || [];
    renderJobs();
    renderRoomStrips();
    renderTeamRail();
    // Clear a slug's "generating storyboard…" hint once its real video job actually resolves (done
    // or failed) — inline mirror of storyboardJobDone() in this file's exported section (client
    // script can't import it; kept in sync by hand, card fbfea28b). Runs before load() below so the
    // rebuilt review rows already reflect the cleared state instead of racing it.
    for(const slug of [...storyboardSlugs]){
      const forSlug = JOBS.filter(j=>j.kind==="video" && (j.slugs||[]).includes(slug));
      if(forSlug.length && forSlug.every(j=>j.status==="done"||j.status==="failed")) storyboardSlugs.delete(slug);
    }
    if(before !== JSON.stringify(JOBS.map(j=>[j.id,j.status]))){
      load(); // a job moved → refresh review rows
      if(currentTab==="content") loadContent(); // a finished advisor round renders its new sheets
      if(currentTab==="studio") loadStudio(); // counts and the team panel just changed
    }
  }catch(e){}
}
async function clearJobs(){
  const r = await post("/api/jobs/clear",{});
  if(r.ok){ flash(r.removed+" cleared"); loadJobs(); }
  else flash(r.error || "Could not clear queue");
}
async function addSource(){
  const ta = $("#src"); const source = ta.value.trim();
  if(!source){ flash("Paste something first"); return; }
  $("#addBtn").disabled = true;
  const r = await post("/api/atomize",{source});
  $("#addBtn").disabled = false;
  if(r.ok){ ta.value=""; flash("Queued — Claude is drafting"); loadJobs(); }
  else flash(r.error || "Could not queue");
}
// ── Substack Notes checklist (manual pick, replaces the old one-click "Pull Substack Notes") ──
let NOTES = [];
let notesShowDrafted = false;
// Selections keyed by the note's stable cache idx, NOT the DOM — renderNotes() rebuilds the list
// wholesale (e.g. toggling "show already drafted"), which used to silently wipe every ticked
// checkbox (Muxin, 2026-07-16). A selection survives being filtered out of view; Draft selected
// drafts everything in this set.
const selectedNoteIdxs = new Set();
function noteMeta(n){
  const d = n.publishedAt ? n.publishedAt.slice(0,10) : "????-??-??";
  // draftedTag ("in review now" / "published Nd ago" / "drafted before, discarded") comes from the
  // server's note-reuse rule — never recomputed client-side.
  const tag = n.drafted ? ' <span class="drafted-tag">'+esc(n.draftedTag||"already drafted")+'</span>' : "";
  return d+' · eng '+n.eng+' (♥'+n.likes+' ↻'+n.reposts+' 💬'+n.replies+')'+tag;
}
function renderNotes(){
  const box = $("#notesList");
  const visible = NOTES.filter(n => notesShowDrafted || !n.drafted);
  if(!visible.length){ box.innerHTML = '<div class="empty">'+(NOTES.length? "All notes are already drafted." : "No notes found.")+'</div>'; return; }
  box.innerHTML = "";
  for(const n of visible){
    // Blocked = drafted and not reusable (still in review, or published inside the 30-day
    // cooldown). A discarded or long-ago-published note is selectable again, just labeled.
    const blocked = n.drafted && !n.reusable;
    const el = document.createElement("label");
    el.className = "notepick" + (blocked ? " drafted" : n.drafted ? " redraftable" : "");
    el.innerHTML = '<input type="checkbox" data-idx="'+n.idx+'" '+(blocked?"disabled":"")+(selectedNoteIdxs.has(n.idx)?" checked":"")+'>'+
      '<div class="ntext"><div class="nmeta">'+noteMeta(n)+'</div>'+esc(n.text.replace(/\\s+/g," ").slice(0,220))+'</div>';
    box.appendChild(el);
  }
}
async function openNotes(){
  $("#notesPanel").hidden = false;
  $("#notesList").innerHTML = '<div class="empty">Loading…</div>';
  const r = await fetch("/api/notes");
  const data = await r.json();
  if(!data.ok){ $("#notesList").innerHTML = '<div class="empty">'+esc(data.error||"Failed to load notes")+'</div>'; return; }
  NOTES = data.notes;
  selectedNoteIdxs.clear(); // fresh fetch = fresh cache indices; stale selections must not map onto new notes
  renderNotes();
}
async function draftSelectedNotes(){
  const indices = [...selectedNoteIdxs].sort((a,b)=>a-b);
  if(!indices.length){ flash("Pick at least one note"); return; }
  $("#notesDraftBtn").disabled = true;
  const r = await post("/api/notes/pick",{indices});
  $("#notesDraftBtn").disabled = false;
  if(r.ok){
    flash(r.jobs.length+" note(s) queued");
    selectedNoteIdxs.clear();
    $("#notesPanel").hidden = true;
    loadJobs();
  } else flash(r.error || "Failed");
}
// Delegated so it survives every renderNotes() rebuild — the checkboxes themselves are recreated.
$("#notesList").addEventListener("change",(e)=>{
  const cb = e.target;
  if(!cb || cb.type !== "checkbox" || cb.dataset.idx === undefined) return;
  const idx = Number(cb.dataset.idx);
  if(cb.checked) selectedNoteIdxs.add(idx); else selectedNoteIdxs.delete(idx);
});
$("#jobs").addEventListener("click",(e)=>{ if(e.target.id==="clearJobsBtn") clearJobs(); });
$("#addBtn").addEventListener("click", addSource);
$("#notesBtn").addEventListener("click", openNotes);
$("#notesCloseBtn").addEventListener("click", ()=>{ $("#notesPanel").hidden = true; });
$("#notesShowDrafted").addEventListener("change",(e)=>{ notesShowDrafted = e.target.checked; renderNotes(); });
$("#notesDraftBtn").addEventListener("click", draftSelectedNotes);
$("#src").addEventListener("keydown",(e)=>{ if((e.metaKey||e.ctrlKey)&&e.key==="Enter") devStart(); });
setInterval(()=>{ if(jobsPollDue(JOBS, Date.now(), jobsPollArmedUntil)) loadJobs(); }, JOBS_POLL_MS);

$("#showDecided").addEventListener("change", (e)=>{ showDecided = e.target.checked; render(); });
setRoom("content");
// The desk header's live date ("Thursday · Jul 17").
{
  const now = new Date();
  const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const MO = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  $("#deskDate").textContent = DAYS[now.getDay()]+" · "+MO[now.getMonth()]+" "+now.getDate();
}
// Match doRefresh()'s ordering: stamp "last refreshed" once the initial data has actually
// landed, not the instant the page starts loading it (load()/loadJobs() are async).
Promise.all([load(), loadJobs(), loadContent()]).finally(markRefreshed);
</script>
</body>
</html>`;
}
