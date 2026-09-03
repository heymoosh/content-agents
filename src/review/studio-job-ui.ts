// Pure, DOM-free job UI types and helpers used by the server-side review page.
// The browser script below page.ts keeps its own inline mirrors because it is emitted as plain
// text and evaluated in the browser; that intentional cross-runtime duplication remains intact.

export function formatElapsed(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export interface JobView {
  id: string;
  kind: string;
  label: string;
  engine?: string;
  status: string; // "queued" | "running" | "blocked" | "done" | "failed" | "stopped"
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
  blue: "#2f5d9a", // Muxin's own hand: the "You said:" line, and the Stop she pressed herself
} as const;

// Which room a job lands in. Drives the rail label on `done`, the "Watch it in <Room>" link, the
// landing sentence, the team-rail name and which room's strip shows it.
export function jobRoom(kind: string): JobRoom {
  // "outreach-revise" is the Outreach thread's "Update it". It is a separate kind from "revise"
  // precisely so it lands here instead of under Content with the Formatter.
  if (kind === "scout" || kind === "draft-follow-up" || kind === "outreach-revise") return "Outreach";
  if (kind === "pull" || kind === "strategy" || kind === "insights" || kind === "ask-insights" || kind === "brief-revise") return "Signals";
  if (kind === "venture-analysis" || kind === "venture-step" || kind === "venture-delivery") return "Venture";
  if (kind === "charles-draft") return "Charles";
  if (kind === "fiction-draft" || kind === "fiction-continuity" || kind === "fiction-promo") return "Fiction";
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
  // She pressed Stop. That is neither a break nor work in flight, so it wears neither the red nor
  // the AI purple: blue is her own hand on this screen (see jobAnswerEcho), and this run ended by it.
  if (job.status === "stopped") return { text: "You stopped it", color: JOB_COLORS.blue };
  if (job.status === "done") return { text: jobRoom(job.kind), color: JOB_COLORS.green };
  if (job.status === "queued") return { text: "Waiting its turn", color: JOB_COLORS.greyFg };
  return { text: "Working", color: JOB_COLORS.ai };
}

// Studio working panel clock. `ahead` is how many jobs run before this one (queued only).
export function jobClockText(job: JobView, ahead: number): string {
  if (job.status === "queued") return `${ahead} ahead of it`;
  if (job.status === "failed") return `stopped after ${jobElapsedText(job.elapsedMs)}`;
  // Frozen at finishedAt like every other landed job, and measured: a job stopped while queued
  // never started, so it has no elapsed time to show and says exactly that.
  if (job.status === "stopped") return job.elapsedMs == null ? "not started" : `ran for ${jobElapsedText(job.elapsedMs)}`;
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
  if (job.status === "stopped") {
    // The completed steps are real. The one it was inside never finished, so it is not "current"
    // (nothing is in flight) and not "failed" either (nothing broke). It is simply not done.
    return steps.map((text, i) => ({ text, state: (i < step ? "done" : "pending") as DotState }));
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
export const ANSWERED_FOOTER = "You answered. A fresh job is running it from the start.";

// Muxin pressed Stop it. It names her as the one who ended the run, and it refuses to guess what
// reached disk: a subprocess killed mid-run may well have written something, so the failure copy's
// "Nothing was written." is a claim this screen cannot make about a stop.
export const STOPPED_FOOTER = "You stopped this one. It did not finish.";

// The echo of Muxin's own choice, set in her blue rather than the AI purple.
export function jobAnswerEcho(job: JobView): string {
  return job.answer ? `You said: ${job.answer}` : "";
}

export function jobFooter(job: JobView): string {
  if (job.status === "failed") return "It stopped where the red dot is. Nothing was written.";
  if (job.status === "stopped") return STOPPED_FOOTER;
  if (job.status === "blocked") return job.answer ? ANSWERED_FOOTER : "It stops here until you answer. Nothing is written in the meantime.";
  if (job.status === "done") return jobLandingSentence(jobRoom(job.kind));
  if (job.status === "queued") return "One job runs at a time, so this starts when the one above finishes.";
  return job.lastStdoutLine || "Real elapsed time, not an estimate.";
}

// The mono log line under each panel row.
export function jobLogLine(job: JobView): string {
  const path = job.logPath || "";
  if (job.status === "failed") return `> stopped at ${path}`;
  if (job.status === "stopped") return "> stopped, you ended it";
  if (job.status === "blocked") return job.answer ? "> stopped, you answered it" : "> stopped, waiting on your answer";
  if (job.status === "queued") return "> waiting for a slot";
  if (job.status === "done") return `> wrote to ${path}`;
  return `> reading ${path} ...`;
}

export function jobOpenLabel(job: JobView): string {
  // "Watch it" would promise motion a stopped job no longer has, and "Read it" would promise an
  // artifact it may never have written. The room is still worth opening. That is the whole claim.
  if (job.status === "stopped") return `Open ${jobRoom(job.kind)}`;
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

// Finished as far as every surface is concerned: a clean `done`, a job Muxin stopped, or an
// answered ask. `stopped` belongs here for the same reason jobs.ts lets Clear finished sweep it —
// it is finished work by her own decision, with nothing left for her to act on. `failed` is still
// deliberately absent: it holds its strip until she has seen it.
export function jobSettled(job: JobView): boolean {
  return job.status === "done" || job.status === "stopped" || (job.status === "blocked" && !!job.answer);
}

// Where "Stop it" is offered. stopJob() no-ops on anything already settled (it hands back
// `stopped: false` and changes nothing), so a control on those rows would do nothing at all. A
// blocked job is settled too, and stopping it would throw away a question she has not answered
// yet, which is a decision nobody has made. Queued and running work only.
export function jobStopOffered(job: JobView): boolean {
  return job.kind !== "venture-delivery" && (job.status === "queued" || job.status === "running");
}

// Whether the job poll should fire this beat. Queued or running work obviously needs it, but so
// does a job that JUST finished: the room strip lingers STRIP_LINGER_MS past finishedAt, and that
// linger can only expire if something keeps re-rendering until the window closes. Polling one beat
// past the window guarantees the render that actually clears the strip happens.
// `armedUntil` covers the other half: from an idle desk, an enqueue leaves nothing in `jobs` to
// look at yet, so a POST to an enqueueing route arms the poll for a moment until the new job shows
// up. Without it the first progress surface for that job never appeared at all.
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
  "/api/content/generate",
  "/api/strategy/ask", "/api/strategy/refresh-brief", "/api/strategy/insights",
  "/api/strategy/ask-insights", "/api/strategy/pull",
  "/api/outreach/scout", "/api/outreach/draft", "/api/outreach/message/revise",
  "/api/charles/draft", "/api/followups/draft-follow-up",
  "/api/fiction/draft", "/api/fiction/repass", "/api/fiction/check", "/api/fiction/promotion/draft", "/api/fiction/promotion/revise", "/api/venture/:slug/analyze", "/api/venture/:slug/run-step",
];
export function enqueuesJob(path: string): boolean {
  return JOB_ENQUEUE_ROUTES.includes(path) || /^\/api\/venture\/[^/]+\/(analyze|run-step)$/.test(path) ||
    /^\/api\/venture\/[^/]+\/artifacts\/[^/]+\/(deliver|retry-delivery)$/.test(path);
}

// `roomOf` is injectable only so the Fiction-failure rule below can be exercised against a made-up
// kind. Fiction kinds map for real now (see jobRoom above), so the client always uses the default.
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
  if (job.status === "stopped") return { text: "You stopped it", color: JOB_COLORS.blue };
  if (job.status === "done") return { text: "Just finished", color: JOB_COLORS.green };
  if (job.status === "queued") return { text: "Waiting its turn", color: JOB_COLORS.greyFg };
  return { text: "Working now", color: JOB_COLORS.ai };
}

export function stripClockText(job: JobView): string {
  if (job.status === "queued") return "not started";
  if (job.status === "failed") return `stopped after ${jobElapsedText(job.elapsedMs)}`;
  if (job.status === "stopped") return job.elapsedMs == null ? "not started" : `ran for ${jobElapsedText(job.elapsedMs)}`;
  if (job.status === "done") return `took ${jobElapsedText(job.elapsedMs)}`;
  return jobElapsedText(job.elapsedMs);
}

export function stripFooter(job: JobView): string {
  if (job.status === "failed") return "It stopped where the red dot is. Nothing was written.";
  if (job.status === "stopped") return STOPPED_FOOTER;
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
