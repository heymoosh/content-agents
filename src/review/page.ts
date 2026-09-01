// The review GUI's single HTML page (self-contained, no build step, no external requests): CSS +
// client-side <script> (the client script keeps its own DECIDED constant, shadowing the server-side
// one in rows.ts — that's a different runtime, left exactly as-is, no logic changes here).

import {
  fixtureBannerHtml,
  fixturePanelHtml,
  fixtureScriptHtml,
} from "./fixtures.js";
// The 25 intake questions, serialized into the client below. Imported rather than retyped: this is
// venture/rules.md §4.2's fixed list and src/venture/intake.ts is the one place it lives. A second
// copy on this screen would be a content-generation change hiding inside a GUI diff (root
// CLAUDE.md rule 7) the first time the two drifted.
import { INTAKE_QUESTIONS } from "../venture/intake.js";
import { JOB_COLORS, jobRoom, type JobView } from "./studio-job-ui.js";
export {
  formatElapsed,
  ANSWERED_FOOTER,
  JOB_COLORS,
  JOB_ENQUEUE_ROUTES,
  JOBS_POLL_MS,
  STOPPED_FOOTER,
  STRIP_LINGER_MS,
  dotColor,
  enqueuesJob,
  jobAnswerEcho,
  jobClockText,
  jobElapsedText,
  jobFooter,
  jobLandingSentence,
  jobLogLine,
  jobOpenLabel,
  jobProgressPct,
  jobRailLabel,
  jobRoom,
  jobSettled,
  jobStepDots,
  jobStopOffered,
  jobsAhead,
  jobsPollDue,
  jobAwaitingAnswer,
  restingTeamRows,
  stripClockText,
  stripFooter,
  stripJobFor,
  stripRailLabel,
  teamLiveRows,
  teamRailHeader,
  teamRoomName,
  type DotState,
  type JobRoom,
  type JobView,
  type TeamRow,
} from "./studio-job-ui.js";
import { unfixableLine } from "./page-fiction.js";
import {
  BOOT_ROOM,
  CAPTURE_RAIL_ASKING,
  CAPTURE_RAIL_IDLE,
} from "./page-capture.js";
export * from "./page-outreach.js";
export * from "./page-fiction.js";
export * from "./page-charles.js";
export * from "./page-venture.js";
export * from "./page-signals.js";
// Re-export the shared classifier API, while this page owns the copy it actually displays for a
// durable handoff. page-capture.ts's old Signals note described a backlog write this surface no
// longer makes, so it is deliberately not re-exported from the rendered-page module.
export {
  classifyCapture,
  captureVerdict,
  BOOT_ROOM,
  CAPTURE_RAIL_ASKING,
  CAPTURE_RAIL_IDLE,
  LINK_ASK_HEADING,
  LINK_ASK_EXPLAINER,
  type CaptureRoom,
  type CaptureVerdict,
  type CaptureVerdictView,
  type DeskRoom,
} from "./page-capture.js";
export const LINK_ASK_SIGNALS_NOTE = "Source for Signals keeps it in Signals for your next action. Nothing here records where a reader came from, so this is a note to look at later, not attribution.";

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
  return '<div class="src missing-img">No image rendered yet.</div>';
}

/** Actions shared by every persisted configured-media stage, independent of media kind. */
export function mediaPlanActionsHtml(asset: string | undefined, media?: string): string {
  const attach = media === "image" || media === "image-carousel"
    ? '<button data-act="attach-reviewed-media">Attach reviewed image file(s)</button>'
    : "";
  return String(asset || "").startsWith("media-stages/")
    ? '<span class="storyboard-control"><button data-act="approve-media-plan">Approve media plan/source</button><button class="storyboard" data-act="render-media">Render approved media</button>'+attach+'</span>'
    : "";
}

// Pure, DOM-free mirror of the inline logic the client <script> below uses to clear its
// storyboardSlugs in-flight registry once a piece's real "Generate storyboard" video job actually
// resolves (done, failed, or stopped by Muxin) — not the instant the click fires (card fbfea28b: the old row.storyboardQueued
// flag lived until the NEXT full /api/queue refresh, with nothing clearing it on the job's own
// completion). True once at least one video job exists for the slug and none of that slug's video
// jobs are still queued/running; false while the queue hasn't caught up yet (no job for the slug
// visible) so the hint doesn't flicker off before the real job is even tracked.
export function storyboardJobDone(jobs: { kind: string; slugs?: string[]; status: string }[], slug: string): boolean {
  const forSlug = jobs.filter((j) => j.kind === "video" && (j.slugs || []).includes(slug));
  if (!forSlug.length) return false;
  return forSlug.every((j) => j.status === "done" || j.status === "failed" || j.status === "stopped");
}

export interface WorkbenchJobTarget {
  kind: string;
  label: string;
  slugs?: string[];
}

/**
 * Resolve the content folder named by an advisor job without relying on its artifact check.
 *
 * A folder job has its slug in the label from the moment it is queued, while `slugs` is only
 * stamped after a successful advisor round. Keeping the label fallback here lets queued, running,
 * failed, and stopped advisor jobs still point at an already-materialized Workbench session.
 */
export function workbenchSlugForJob(job: WorkbenchJobTarget): string | null {
  if (job.kind !== "develop" && job.kind !== "develop-reply") return null;
  const stamped = job.slugs?.find((slug) => typeof slug === "string" && slug.trim());
  if (stamped) return stamped;
  const match = /^(?:Develop|Advisor reply):\s*(.+)$/.exec(job.label.trim());
  const candidate = match?.[1]?.trim() || "";
  // Source-start jobs use a human label (URL, filename, or first pasted line) until the
  // materializer stamps a real slug. Only the date-prefixed folder names this pipeline creates
  // are safe to infer from a label before that stamp exists.
  return /^\d{4}-\d{2}-\d{2}-[A-Za-z0-9][A-Za-z0-9._-]*$/.test(candidate) ? candidate : null;
}

/**
 * Return a Workbench target only when the corresponding read-only session is present. A missing
 * session deliberately returns null: the caller can still open Content, but must not imply that a
 * review artifact exists or manufacture one for a job that has not materialized it.
 */
export function workbenchJobTarget(
  job: WorkbenchJobTarget,
  sessions: readonly { slug: string }[],
): string | null {
  const slug = workbenchSlugForJob(job);
  return slug && sessions.some((session) => session.slug === slug) ? slug : null;
}

export type CaptureHandoff = { room: string; text: string; id?: string };

// A capture remains an inbox item until Muxin chooses Start on it. That action may prepare a
// build-specific human gate, but never approves, schedules, or publishes.
export function captureHandoffSummary(capture: CaptureHandoff | null): {
  room: string; label: string; text: string; detail: string; action: string;
} | null {
  if (!capture?.text.trim() || !capture.room.trim()) return null;
  return {
    room: capture.room.toLowerCase(),
    label: capture.room,
    text: `Capture waiting in ${capture.room}.`,
    detail: capture.text.trim().replace(/\s+/g, " ").slice(0, 140),
    action: "Open",
  };
}

// Start on it saves first, then advances to the safest real next action each build can accept.
export function captureHandoffVerdict(room: "Content" | "Fiction" | "Outreach" | "Venture"): {
  room: string; line: string; actionLabel: string | null;
} {
  if (room === "Content") return { room, line: "I read this as Content. Start on it opens an advisor round. Approval and publishing stay separate.", actionLabel: "Start on it" };
  if (room === "Fiction") return { room, line: "I read this as Fiction. Start on it puts these beats in Write next for you to review before drafting.", actionLabel: "Start on it" };
  if (room === "Outreach") return { room, line: "I read this as Outreach. Start on it opens the lead chooser; you still choose the person before any draft.", actionLabel: "Start on it" };
  return { room, line: "I read this as Venture. Start on it opens the current human-gated venture step. It does not run or approve it.", actionLabel: "Start on it" };
}


export function renderPage(opts: { repoRoot: string; isDevWorktree: boolean; fixtures?: boolean }): string {
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
  :focus-visible { outline:2px solid var(--blue); outline-offset:2px; }
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
  /* The design's own header line, kept because it is the one promise the whole app makes. */
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
  /* A relocated control demoted below its room's content, so it stops competing with the sheet's
     subject. Small and mono, like the rest of this room's status labels, not a form field. */
  .sheet-foot { margin-top:18px; padding-top:14px; border-top:1px solid #efe7d6; display:flex; justify-content:flex-end; }
  .sheet-foot .engine-choice { font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; color:#a89a80; gap:6px; }
  .sheet-foot .engine-choice span { font-weight:600; }
  .sheet-foot .engine-select { font-size:11px; min-width:0; padding:2px 6px; }
  /* Capture sheet (3a): the blank page. Charles still uses a full .sheet.capture; Studio nests
     capture as a bordered card on its one home sheet (.studio-capture). */
  .capture-title { font:400 40px/1.2 Georgia,"Times New Roman",serif; letter-spacing:-.01em; margin-bottom:16px; }
  .capture textarea { width:100%; min-height:110px; font:17px/1.6 Georgia,"Times New Roman",serif;
    padding:4px 0; border:none; outline:none; background:transparent; resize:vertical; color:var(--ink); }
  .capture textarea:focus-visible { outline:2px solid var(--blue); outline-offset:3px; border-radius:4px; }
  .capture textarea::placeholder { color:#a89a80; }
  .studio-capture { margin:36px 56px 8px; padding:28px 32px 24px; border:1px solid #e3d9c3;
    border-radius:8px; background:var(--paper); }
  /* The capture box (v7 Studio): its rail, the verdict it states back, and the bare-link ask.
     While the ask is open the textarea dims and goes read-only, and the rail turns amber — that is
     honest state (the app is holding her link, waiting), not decoration. */
  .capture-rail-row { display:flex; align-items:baseline; gap:14px; flex-wrap:wrap; margin-bottom:12px; }
  .capture-rail { font:10.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; text-transform:uppercase;
    letter-spacing:.06em; color:#8a7f6d; }
  .capture-rail.asking { color:#9a6b12; }
  .capture-rail-hint { font:italic 400 12.5px/1.4 Georgia,serif; color:#a89a80; margin-left:auto; }
  /* One primary action, then demoted real actions + the engine picker so they stop competing. */
  .capture-primary { display:flex; align-items:center; gap:14px; margin-top:14px; padding-top:14px;
    border-top:1px solid #efe7d6; flex-wrap:wrap; }
  .capture-explain { font-size:12.5px; line-height:1.5; color:#8a7f6d; max-width:470px; }
  .capture-more { display:flex; gap:18px; flex-wrap:wrap; align-items:center; margin-top:14px; }
  .capture textarea.dimmed { opacity:.6; }
  .capture-verdict { margin:12px 0 0; padding:11px 14px; border:1px solid #e3d9c3; background:#fffdf8;
    border-radius:8px; font-size:13.5px; line-height:1.55; color:var(--ink); max-width:640px; }
  .capture-verdict .cv-row { margin-top:9px; display:flex; gap:8px; align-items:baseline; flex-wrap:wrap;
    font-size:12.5px; color:#8a7f6d; }
  .capture-verdict button { font-size:12.5px; padding:4px 11px; }
  .link-ask { margin-top:14px; padding-top:14px; border-top:1px solid #e3d9c3; max-width:640px; }
  .link-ask-head { font-size:14.5px; line-height:1.5; color:var(--ink); font-weight:600; }
  .link-ask-btns { display:flex; gap:9px; margin-top:12px; flex-wrap:wrap; align-items:center; }
  .link-ask-btns button.link-ask-cancel { border:none; background:none; padding:0; margin-left:4px;
    font-size:12.5px; color:#7a7266; border-bottom:1px solid #d8cfbb; }
  .link-ask-why { font-size:12.5px; line-height:1.55; color:#8a7f6d; margin-top:12px; max-width:470px; }
  /* Workbench session sheets (3b): main column + director margin */
  .session { padding:0; overflow:hidden; }
  .session-grid { display:grid; grid-template-columns:minmax(0,1fr) 300px; }
  .session-main { padding:44px 36px 40px 56px; min-width:0; }
  .session-margin { border-left:1px solid #efe7d6; padding:44px 26px 36px 24px; background:#faf7f0;
    display:flex; flex-direction:column; gap:16px; min-height:100%; }
  .room-rail { position:sticky; top:78px; align-self:start; max-height:calc(100vh - 96px); overflow:auto; }
  .scan-row { width:100%; display:grid; grid-template-columns:32px minmax(150px,190px) minmax(260px,1fr) auto auto; gap:14px; align-items:center; text-align:left;
    padding:13px 4px; border:0; border-top:1px solid var(--line); border-radius:0; background:none; }
  .scan-row:hover { background:#faf7f0; }
  .focus-backdrop { position:fixed; inset:0; z-index:80; background:rgba(28,26,23,.42); display:grid; place-items:center; padding:28px; }
  .focus-backdrop[hidden] { display:none; }
  .focus-dialog { width:min(880px,100%); max-height:calc(100vh - 56px); overflow:auto; background:var(--paper);
    border:1px solid var(--line); border-radius:12px; box-shadow:0 18px 60px rgba(0,0,0,.22); padding:22px; }
  .review-focus-editor { width:100%; min-height:260px; box-sizing:border-box; margin-top:16px; padding:16px;
    font:400 18px/1.65 Georgia,"Times New Roman",serif; color:var(--ink); background:#fff;
    border:1px solid #d8cfbb; border-left:3px solid var(--blue); border-radius:0 8px 8px 0; resize:vertical; }
  .room-pages { display:flex; align-items:baseline; gap:24px; flex-wrap:wrap; padding-bottom:14px; margin-bottom:22px; border-bottom:1px solid #dfd4bb; }
  .room-pages button { border:0; border-bottom:1.5px solid transparent; border-radius:0; background:none; color:#9b907b; padding:0 0 5px; font:inherit; cursor:pointer; }
  .room-pages button.on { color:var(--ink); border-bottom-color:var(--ink); font-weight:600; }
  .request-search { width:min(680px,calc(100vw - 220px)); min-width:420px; padding:9px 12px; }
  .publish-row { display:grid; grid-template-columns:minmax(150px,1.2fr) minmax(110px,.7fr) minmax(150px,1fr) minmax(150px,1fr); gap:14px;
    align-items:start; padding:13px 4px; border-top:1px solid var(--line); }
  .publish-row.head { font:10px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; color:#8a7f6d; letter-spacing:.05em; text-transform:uppercase; }
  .charles-composer { padding-bottom:24px; border-bottom:1px solid #efe7d6; }
  .charles-composer label[for=charlesInput] { display:block; font-weight:600; margin:18px 0 8px; }
  .charles-composer #charlesInput { min-height:150px; box-sizing:border-box; padding:14px 16px; border:1px solid #cfc4ad;
    border-left:3px solid var(--blue); border-radius:0 8px 8px 0; background:#fff; }
  .charles-controls { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-top:14px; }
  @media (max-width:760px) { .scan-row { grid-template-columns:28px minmax(0,1fr) auto; }
    .scan-row > :nth-child(3), .scan-row > :nth-child(5) { grid-column:2 / -1; } }
  .wb-title { font:600 20px/1.3 Georgia,"Times New Roman",serif; margin-bottom:16px; }
  .wb-label { font:italic 400 13px/1.5 Georgia,serif; color:#a89a80; margin-bottom:12px; }
  .wb-source { font:400 19px/1.55 Georgia,"Times New Roman",serif; color:var(--ink);
    padding-left:18px; border-left:2px solid var(--blue); white-space:pre-wrap; }
  .wb-source.clamped { max-height:180px; overflow:hidden;
    -webkit-mask-image:linear-gradient(180deg,#000 60%,transparent); mask-image:linear-gradient(180deg,#000 60%,transparent); }
  .wb-expand { font-size:12.5px; color:#7a7266; border:none; border-bottom:1px solid #d8cfbb; background:none; padding:0; font:inherit; cursor:pointer; width:fit-content; margin-top:6px; }
  .wb-sep { margin:36px 0 0; display:flex; align-items:center; gap:12px; }
  .wb-sep span.rule { height:1px; flex:1; background:#efe7d6; }
  .wb-sep span.txt { font:italic 400 14px/1 Georgia,serif; color:#a89a80; }
  .wb-cut { margin-top:26px; }
  .wb-cut-head { display:flex; align-items:baseline; gap:10px; margin-bottom:10px; flex-wrap:wrap;
    padding-left:18px; border-left:2px solid transparent; }
  .wb-cut-head .lens { font:600 13px/1 Georgia,serif; color:#5b46b8; }
  .wb-cut-head .sub { font-size:12px; color:#8a7f6d; font-style:italic; }
  .wb-cut-body { font:400 22px/1.55 Georgia,"Times New Roman",serif; color:var(--ink); white-space:pre-wrap;
    padding-left:18px; border-left:2px solid var(--blue); }
  .wb-cut textarea { width:100%; min-height:140px; font:400 18px/1.55 Georgia,serif; padding:10px 12px;
    border:1px solid var(--muted); border-radius:8px; background:#fff; }
  .wb-handoff { margin-top:40px; padding-top:22px; border-top:1px solid #efe7d6;
    display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
  .wb-handoff .note { font-size:13px; color:#7a7266; line-height:1.5; max-width:340px; }
  .wb-links { margin-top:14px; display:flex; gap:20px; flex-wrap:wrap; }
  .wb-link { font-size:13px; color:#7a7266; border-bottom:1px solid #d8cfbb; padding-bottom:1px; cursor:pointer; background:none; border-top:none; border-left:none; border-right:none; border-radius:0; padding-top:0; padding-left:0; padding-right:0; }
  .venture-switcher { min-width:220px; max-width:380px; }
  .venture-stages { display:flex; align-items:baseline; gap:6px; flex-wrap:wrap; padding:16px 0 13px; border-bottom:1px solid #dfd4bb; }
  .venture-stage { border:0; background:none; padding:0; color:#a89a80; cursor:pointer; }
  .venture-stage.on { color:var(--ink); font-weight:600; }
  .venture-example { padding:22px; border:1px solid var(--line); border-radius:10px; background:#faf7f0; }
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
  .wb-rec-ex { margin-top:10px; padding-top:10px; border-top:1px solid var(--line);
    display:flex; flex-direction:column; gap:4px; }
  .wb-rec-plat { font-size:12.5px; font-weight:600; color:var(--ink); }
  .wb-rec-mech { font-size:12.5px; color:var(--ink); }
  .wb-rec-why { font-size:12.5px; line-height:1.5; color:#5a5346; }
  .wb-rec-ev { font-size:12px; line-height:1.45; color:var(--muted); margin-top:4px; }
  .wb-rec-conf { font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; color:var(--muted); }
  .wb-reply { margin-top:auto; padding-top:16px; border-top:1px solid #efe7d6; display:flex; flex-direction:column; gap:8px; }
  .wb-reply input { font:italic 13px/1.4 Georgia,serif; border:1px solid #e6dcc4; background:#fbf9f4;
    border-radius:8px; padding:8px 12px; color:var(--ink); width:100%; }
  .wb-proposal { margin-top:26px; padding:14px 16px; background:#faf7f0; border:1px solid #efe7d6; border-radius:10px; }
  /* Studio home (3c): stat tiles + the ranked needs-you list + the team margin */
  .stat-tiles { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-top:20px; }
  .stat-tile { border:1px solid #efe7d6; border-radius:10px; padding:14px 16px; background:#faf7f0;
    display:flex; flex-direction:column; gap:3px; }
  button.stat-tile { font:inherit; text-align:left; cursor:pointer; }
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
  .dir-box textarea:focus-visible { outline:2px solid var(--blue); outline-offset:3px; border-radius:4px; }
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
  /* A recorded capture date and no recorded capture date are the same line in two registers, so
     the pair is legible at a glance: dated reads as a fact, undated reads as an admission. */
  .ev-cap { font:10.5px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace; color:#8b8272; letter-spacing:.03em; margin-top:3px; }
  .ev-nocap { font:10.5px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace; color:#b3a894; font-style:italic; letter-spacing:.03em; margin-top:3px; }
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
  /* Outreach room subnav (Leads | Follow-ups): styled as the sheet's own tab strip, not a
     floating pill hovering above the desk. Aligned to the sheet's own max-width/padding so it
     reads as attached to the paper below it, rather than a separate piece of chrome. */
  .subnav { display:flex; gap:22px; max-width:1040px; margin:26px auto 0; padding:0 56px; }
  .subtab { font:10.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; text-transform:uppercase;
    letter-spacing:.06em; color:#a89a80; border:none; border-bottom:2px solid transparent;
    background:none; border-radius:0; padding:0 0 8px; cursor:pointer; }
  .subtab.on { font-weight:600; color:#3a2a12; border-bottom-color:#3a2a12; }
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
  .engine-choice { display:inline-flex; align-items:center; gap:7px; color:#6e6659; font-size:12px; white-space:nowrap; }
  .engine-choice select { min-width:112px; }
  .engine-choice span { font-weight:600; }
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
  .jrow-tail button.jstop { border:1px solid #d8cfbb; background:var(--card); color:#7a7266; border-radius:6px;
    padding:4px 12px; font-size:12.5px; white-space:nowrap; cursor:pointer; }
  .jrow-tail button.jstop:hover { border-color:#b9ada0; color:var(--ink); }
  .room-strip .jrow-tail { border-top:none; padding-top:6px; margin-top:8px; }
  /* ── Venture room ─────────────────────────────────────────────────────────────────────────────
     Two columns: the derived thread, and the "what this is built on" rail. The rail is the only
     place in the app that carries a sticky sidebar, so its own collapse rule lives here too — this
     is page.ts's first @media block, authored because a two-column room is the first thing here
     that genuinely breaks below ~900px. */
  .vroom { display:grid; grid-template-columns:minmax(0,1fr) 268px; }
  .vthread { min-width:0; padding:26px 40px 34px; display:flex; flex-direction:column; gap:22px; }
  .vrail { border-left:1px solid var(--line); background:#faf7f0; border-radius:0 5px 5px 0; }
  .vrail-in { position:sticky; top:58px; box-sizing:border-box; padding:22px 24px 30px;
    display:flex; flex-direction:column; gap:15px; max-height:calc(100vh - 72px); overflow-y:auto; }
  @media (max-width:900px) {
    .vroom { grid-template-columns:minmax(0,1fr); }
    .vthread { padding:22px 22px 26px; }
    .vrail { border-left:none; border-top:1px solid var(--line); border-radius:0 0 5px 5px; }
    .vrail-in { position:static; max-height:none; overflow-y:visible; }
  }
  @media (max-width:900px) {
    .sheet { margin:16px 10px; padding:28px 20px 26px; }
    .studio-capture { margin:24px 20px 8px; padding:22px 18px; }
    .session-grid { grid-template-columns:minmax(0,1fr); }
    .session-main { padding:28px 20px 24px; }
    .session-margin { border-left:none; border-top:1px solid #efe7d6; padding:24px 20px 28px; }
    .dossier-grid { grid-template-columns:minmax(0,1fr); gap:0; }
    .stat-tiles { grid-template-columns:repeat(2,1fr); }
    .mm-row { grid-template-columns:minmax(0,1fr); gap:2px; }
    .ny-row { grid-template-columns:minmax(0,1fr); gap:4px; }
    header { padding:11px 16px; }
  }
  .vmono { font:10.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; text-transform:uppercase;
    letter-spacing:.06em; color:#a89a80; }
  .vsaid { font-size:15.5px; line-height:1.62; color:var(--ink); max-width:600px; white-space:pre-wrap; }
  /* Muxin's own words. Georgia + the blue rule is HER register and nothing else in this room may
     use the pair — see docs/prototype-port-rules.md Rule 3. */
  .vmine { font:400 18px/1.55 Georgia,"Times New Roman",serif; color:var(--ink); padding-left:16px;
    border-left:2px solid var(--blue); white-space:pre-wrap; max-width:600px; }
  /* AI-written prose. Purple rule + its own label, so the two are never confusable. */
  .vdrafted { font:400 17px/1.62 Georgia,"Times New Roman",serif; color:var(--ink); padding-left:16px;
    border-left:2px solid #5b46b8; white-space:pre-wrap; margin-top:7px; max-width:600px; }
  .vpen { font:10.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; text-transform:uppercase;
    letter-spacing:.05em; color:#5b46b8; }
  /* The .vpen of HER register: same label slot, her blue instead of the AI purple. The pair is the
     whole point — a body she rewrote must never keep the purple one. */
  .vhand { font:10.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; text-transform:uppercase;
    letter-spacing:.05em; color:var(--blue); }
  /* The body editor. Georgia + the blue rule, because the moment she types in it the words are
     hers — the same box the intake interview gives her, for the same reason. */
  .vedit { width:100%; box-sizing:border-box; margin-top:11px; min-height:280px;
    font:400 17px/1.62 Georgia,"Times New Roman",serif; color:var(--ink); padding:12px 14px 12px 16px;
    border:1px solid #d8cfbb; border-left:2px solid var(--blue); border-radius:0 7px 7px 0;
    background:#fff; resize:vertical; white-space:pre-wrap; }
  .vedit:focus { outline:none; border-color:#b9c9dd; border-left-color:var(--blue); }
  .vreceipt { display:grid; grid-template-columns:7px minmax(0,1fr); gap:12px; align-items:baseline; max-width:600px; }
  .vreceipt i { width:6px; height:6px; border-radius:50%; margin-top:6px; display:block; }
  .vreceipt span { font-size:13px; line-height:1.5; color:#8a7f6d; }
  .vblock { border-top:1px solid #dfd4bb; border-bottom:1px solid var(--line); padding:16px 0 18px; max-width:640px; }
  /* Serif with NO coloured rule: a card title is neither her words nor drafted prose, and the rule
     is what carries authorship. */
  .vtitle { font:400 21px/1.35 Georgia,"Times New Roman",serif; margin-top:6px; color:var(--ink); }
  .vstate { display:grid; grid-template-columns:7px 1fr; gap:12px; align-items:baseline; margin-top:11px; }
  .vstate i { width:7px; height:7px; border-radius:50%; margin-top:6px; display:block; }
  .vstate span { font-size:14px; line-height:1.55; }
  .vbadge { display:inline-flex; align-items:center; gap:5px; border-radius:4px; padding:2px 6px;
    font:9.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.06em; white-space:nowrap; }
  .vbadge.link { border:1px solid #c3d3e8; background:#eef2f8; color:#2f5d9a; }
  .vbadge.system { border:1px solid #cbe0d1; background:#eef5f0; color:#2f7d46; }
  .vbadge.word { border:1px solid #e8d5a8; background:#fdf8ec; color:#9a6b12; }
  .vhow { font-size:12.5px; line-height:1.5; color:#8a7f6d; margin-top:5px; max-width:460px; }
  .vcp { border:1px solid #d8cfbb; background:#f6f1e4; border-radius:10px; padding:17px 20px 19px; max-width:640px; }
  .vcp-head { display:flex; align-items:baseline; gap:14px; flex-wrap:wrap; }
  .vcp-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:16px; align-items:start;
    padding:13px 0; border-top:1px solid #e2d8c1; }
  .vcp-row .t { font-size:15px; line-height:1.45; color:var(--ink); }
  .vcp-row .l { display:flex; align-items:center; gap:9px; flex-wrap:wrap; margin-top:6px; font-size:13px; line-height:1.5; }
  .vcp-row .l i { width:7px; height:7px; border-radius:50%; flex:none; display:block; }
  .vcp-appr { font:9.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.06em;
    color:#a89a80; white-space:nowrap; }
  .vgate-n { font:400 30px/1 Georgia,"Times New Roman",serif; color:var(--ink); }
  .vgate-bar { height:3px; background:#eae2ce; border-radius:2px; margin-top:11px; max-width:420px; overflow:hidden; }
  .vgate-bar span { display:block; height:3px; background:#9a6b12; }
  .vchoice-row { display:grid; grid-template-columns:20px minmax(0,1fr); gap:13px; align-items:baseline;
    border-top:1px solid var(--line); padding:12px 0; }
  .vchoice-row .mark { font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; color:#a89a80; }
  .vchoice-row .n { display:block; font:400 18px/1.4 Georgia,"Times New Roman",serif; color:var(--ink); }
  .vchoice-row .w { display:block; font-size:13.5px; line-height:1.5; color:#7a7266; margin-top:3px; }
  .vchoice-row .sc { display:block; font:10.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;
    letter-spacing:.05em; color:#a89a80; margin-top:4px; }
  .vrail-grp { font:10px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; color:#b0a488;
    letter-spacing:.06em; border-top:1px solid var(--line); padding-top:11px; }
  .vrail-item { display:grid; grid-template-columns:5px minmax(0,1fr); gap:9px; align-items:start; }
  .vrail-item i { width:4px; height:4px; border-radius:50%; margin-top:6px; display:block; background:#b0a488; }
  .vrail-item .lbl { font:10px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; color:#b0a488; letter-spacing:.04em; }
  .vrail-item .q { display:block; font:italic 400 13px/1.5 Georgia,"Times New Roman",serif; color:var(--ink);
    padding-left:9px; border-left:2px solid var(--blue); }
  .vrail-item .p { font-size:13px; line-height:1.45; color:#5a5346; }
  .vrail-item .from { font:10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; color:#b8ad94; }
  .vrail-item a.jump { font:10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.04em;
    color:var(--blue); border-bottom:1px solid #c9d6e6; text-decoration:none; align-self:flex-start; }
  .vnote { font-size:12.5px; line-height:1.5; color:#8a7f6d; max-width:420px; }
  .vacts { display:flex; gap:8px; margin-top:16px; flex-wrap:wrap; align-items:center; }
  .vacts button { border:1px solid #e7e1d6; background:var(--card); color:var(--ink); border-radius:7px;
    padding:7px 13px; font-size:13.5px; cursor:pointer; }
  .vacts button.primary { border-color:var(--ink); background:var(--ink); color:#faf8f3; font-weight:600; }
  .vacts button:disabled { opacity:.5; cursor:default; }
  /* A server refusal renders next to the control that caused it, verbatim. It is not a toast:
     these sentences say what to bring instead, and a toast that vanishes takes the instruction
     with it. Confirmations are the toast (Muxin's decision). */
  .vrefusal { font-size:12.5px; line-height:1.55; color:var(--red); background:#fdf1ef;
    border:1px solid #ecc9c0; border-radius:7px; padding:9px 12px; margin-top:10px; max-width:520px; }
  .vform { margin-top:12px; padding:13px 15px; background:#fdf8ec; border:1px solid #e8d5a8; border-radius:8px; max-width:560px; }
  .vform .lbl { font:10.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; text-transform:uppercase;
    letter-spacing:.06em; color:#9a6b12; }
  .vform .ask { font-size:13.5px; line-height:1.55; color:var(--ink); margin-top:7px; }
  .vform input, .vform textarea { width:100%; box-sizing:border-box; margin-top:9px;
    font:400 15px/1.5 Georgia,"Times New Roman",serif; padding:8px 10px; border:1px solid #d8cfbb;
    border-radius:7px; background:#fff; color:var(--ink); resize:vertical; }
  /* A dropdown is the APP's list of categories, not anyone's prose, so it takes the app's face.
     Rule 4: sans is the app speaking; Georgia is for words a person actually wrote. */
  .vform select { width:100%; box-sizing:border-box; margin-top:9px; font:400 14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    padding:8px 10px; border:1px solid #d8cfbb; border-radius:7px; background:#fff; color:var(--ink); }
  /* SOMEONE ELSE'S words, transcribed. Not hers (that is Georgia + the blue rule, .vmine) and not
     the AI's (Georgia + the purple rule, .vdrafted). The third party gets the neutral rule the
     cluster panel already gives audience evidence, so the room never has three registers meaning
     two things. */
  .vform .other { border-left:2px solid #d8cfbb; border-radius:0 7px 7px 0; }
  .vform .sub { font-size:12px; line-height:1.5; color:#8a7f6d; margin-top:6px; }
  .vform .pair { display:flex; gap:10px; }
  .vform .pair > * { flex:1; min-width:0; }
  .vchoice-row.pick { cursor:pointer; }
  .vchoice-row.pick:hover .n { text-decoration:underline; }
  /* ── The intake interview ──────────────────────────────────────────────────────────────────────
     One question at a time, the same register rules as the rest of the room. The box she types in
     is Georgia + the blue rule, because what goes in it is HER words and nothing else on this
     screen may wear that pair (docs/prototype-port-rules.md Rule 3). The question above it is the
     app asking, so it is sans. Nothing here is purple: no AI writes a single character of an
     intake answer. */
  .iv { max-width:660px; display:flex; flex-direction:column; gap:0; }
  .iv-head { display:flex; align-items:baseline; gap:14px; flex-wrap:wrap; }
  .iv-block { font-size:13px; line-height:1.5; color:#8a7f6d; margin-top:10px; }
  .iv-bar { height:3px; background:#eae2ce; border-radius:2px; margin-top:10px; max-width:420px; overflow:hidden; }
  .iv-bar span { display:block; height:3px; background:#2f5d9a; }
  .iv-q { font-size:19px; line-height:1.5; color:var(--ink); margin-top:20px; max-width:600px; }
  .iv-hint { font-size:12.5px; line-height:1.5; color:#8a7f6d; margin-top:8px; max-width:520px; }
  /* HER register. Same Georgia + blue rule as .vmine, because it is the same thing: her words. */
  .iv-in { width:100%; box-sizing:border-box; margin-top:14px; min-height:132px;
    font:400 18px/1.55 Georgia,"Times New Roman",serif; color:var(--ink); padding:12px 14px 12px 16px;
    border:1px solid #d8cfbb; border-left:2px solid var(--blue); border-radius:0 7px 7px 0;
    background:#fff; resize:vertical; }
  .iv-in:focus { outline:none; border-color:#b9c9dd; border-left-color:var(--blue); }
  .iv-save { font:10.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.05em;
    color:#a89a80; margin-top:8px; min-height:14px; }
  .iv-save.bad { color:var(--red); }
  .iv-nav { display:flex; gap:8px; margin-top:18px; flex-wrap:wrap; align-items:center; }
  .iv-nav button { border:1px solid #e7e1d6; background:var(--card); color:var(--ink); border-radius:7px;
    padding:7px 13px; font-size:13.5px; cursor:pointer; }
  .iv-nav button.primary { border-color:var(--ink); background:var(--ink); color:#faf8f3; font-weight:600; }
  .iv-nav button:disabled { opacity:.5; cursor:default; }
  .iv-nav .grow { flex:1; }
  /* The jump grid. Answered and unanswered are visibly different, and both are counted, never
     estimated. */
  .iv-jump { display:flex; flex-wrap:wrap; gap:6px; margin-top:22px; padding-top:16px;
    border-top:1px solid var(--line); }
  .iv-jump button { width:29px; height:29px; padding:0; border-radius:6px; cursor:pointer;
    font:10.5px/1 ui-monospace,SFMono-Regular,Menlo,monospace; border:1px solid #e2d8c1;
    background:var(--card); color:#a89a80; }
  .iv-jump button.done { border-color:#c3d3e8; background:#eef2f8; color:#2f5d9a; }
  .iv-jump button.here { border-color:var(--ink); color:var(--ink); font-weight:700; }
  .iv-panel { margin-top:18px; }
  .iv-field { margin-top:17px; }
  .iv-field .lbl { font:10.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; text-transform:uppercase;
    letter-spacing:.06em; color:#a89a80; }
  .iv-field .sub { font-size:12.5px; line-height:1.5; color:#8a7f6d; margin-top:4px; max-width:520px; }
  .iv-field input, .iv-field textarea { width:100%; box-sizing:border-box; margin-top:8px;
    font:400 16px/1.55 Georgia,"Times New Roman",serif; color:var(--ink); padding:9px 11px 9px 13px;
    border:1px solid #d8cfbb; border-left:2px solid var(--blue); border-radius:0 7px 7px 0;
    background:#fff; resize:vertical; }
  .iv-field input[type=number] { max-width:120px; }
  .iv-field .lo { border:1px solid #e2d8c1; background:var(--card); color:#7a7266; border-radius:6px;
    padding:3px 9px; font:10.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; cursor:pointer; margin-top:7px; }
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
  .connection-state { margin:0 40px; padding:10px 14px; border:1px solid #e8d5a8; border-radius:7px;
    background:#fdf8ec; color:#6b531c; font-size:13px; line-height:1.5; }
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
  /* Shared read tones. Grey is never "zero" — it is "this was not measured", and the copy next to
     it always says which. Kept as four names so a formatter can return a tone without knowing hex. */
  .t-ink { color:var(--ink); } .t-grey { color:#a89a80; } .t-green { color:#2f7d46; } .t-amber { color:#9a6b12; }
  /* Signals: the four outcome families (never collapsed into one score) */
  .fam { border-top:1px solid #efe7d6; padding:14px 0 4px; }
  .fam-head { display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; }
  .fam-name { font:600 15px/1.3 Georgia,serif; color:var(--ink); }
  .fam-ask { font:10.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; text-transform:uppercase;
    letter-spacing:.05em; color:#a89a80; }
  .fam-metrics { display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:10px 22px; margin-top:11px; }
  .metric { display:flex; flex-direction:column; gap:2px; min-width:0; }
  .metric .k { font:9.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.05em; color:#a89a80; }
  .metric .v { font:400 21px/1.15 Georgia,"Times New Roman",serif; }
  .metric .v.small { font:600 13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.03em; }
  .metric .n { font-size:12px; line-height:1.5; color:#5a5346; }
  .fam-gate { font:10.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.05em; margin-top:9px; }
  .fam-note { font-size:12.5px; line-height:1.55; color:#5a5346; margin-top:7px; max-width:560px; }
  .sig-sample { font-size:12.5px; line-height:1.55; color:#5a5346; margin-top:8px; }
  .sig-plat { display:grid; grid-template-columns:120px 96px minmax(0,1fr); gap:14px; align-items:baseline;
    padding:9px 0; border-top:1px solid #f2ece0; font-size:13px; }
  /* Content: one four-view cycle */
  .cw-steps { display:flex; align-items:baseline; gap:6px; flex-wrap:wrap; padding-bottom:14px; border-bottom:1px solid #dfd4bb; }
  .cw-step { border:none; background:none; padding:0; display:flex; align-items:baseline; gap:7px; cursor:pointer; }
  .cw-step[disabled] { cursor:default; }
  .cw-step .num { font:10.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; color:#c0b498; }
  .cw-step .nm { font-size:13.5px; color:#b0a488; border-bottom:1.5px solid transparent; padding-bottom:3px; }
  .cw-step.done .nm { color:#5a5346; } .cw-step.done .num { color:#c0b498; }
  .cw-step.on .nm { color:var(--ink); font-weight:600; border-bottom-color:var(--ink); }
  .cw-step.on .num { color:var(--ink); }
  .cw-sep { font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; color:#cdc0a4; padding:0 8px; }
  .cw-rail { font:10.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.05em; white-space:nowrap; }
  .cw-src { display:grid; grid-template-columns:96px minmax(0,1fr) auto; gap:16px; align-items:baseline;
    font:inherit; text-align:left; width:100%; background:none; color:inherit; border:none; border-radius:0;
    padding:13px 12px; margin:0 -12px; border-top:1px solid #f2ece0; cursor:pointer; }
  .cw-src:hover { background:#faf6ec; }
  .cw-src.on { background:#f4efe3; }
  .cw-tag { justify-self:start; font:9.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.06em;
    border-radius:3px; padding:4px 7px; }
  .cw-tag.substack { color:#5a5346; background:#f2ece0; }
  .cw-tag.yours { color:#2f5d9a; background:#eaeff7; }
  .cw-tag.readin { color:#8a7f6d; background:#f2ece0; }
  .cw-tag.untagged { color:#a89a80; background:#f6f2e8; }
  .cw-src .ttl { font:400 17px/1.4 Georgia,"Times New Roman",serif; color:var(--ink); }
  .cw-src .meta { font:10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; color:#a89a80; display:block; }
  .cw-picked { border:1px solid var(--line); border-radius:9px; background:var(--card); padding:15px 17px;
    display:grid; grid-template-columns:minmax(0,1fr) auto; gap:18px; align-items:start; }
  .cw-reads { margin-top:18px; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px 26px; }
  .cw-cell { display:flex; flex-direction:column; gap:3px; min-width:0; }
  .cw-cell .k { font:9.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.05em; color:#a89a80; }
  .cw-cell .v { font-size:12.5px; line-height:1.5; }
  .cw-chans { margin-top:13px; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:11px; }
  .cw-chan { border:1px solid #eee8db; background:#faf7f0; border-radius:9px; padding:13px 15px;
    display:flex; flex-direction:column; gap:6px; }
  .cw-chan .top { display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; }
  .cw-chan .nm { font-size:14.5px; font-weight:600; }
  .cw-chan .fit { font:9.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.05em; white-space:nowrap; }
  .cw-chan .basis, .cw-chan .reuse, .cw-chan .slot { font-size:12px; line-height:1.5; }
  .cw-chan .slot { font:9.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.04em; color:#a89a80; }
  .cw-tabs { margin-top:18px; display:flex; flex-wrap:wrap; gap:7px; }
  .cw-tab { border:1px solid #e2dac8; background:var(--card); color:#3a352c; border-radius:7px; padding:7px 12px;
    display:flex; align-items:baseline; gap:9px; cursor:pointer; }
  .cw-tab.on { border-color:var(--ink); background:var(--ink); color:#faf8f3; font-weight:600; }
  .cw-tab .badge { font:9.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.04em; white-space:nowrap; }
  .cw-tabhead { margin-top:16px; padding-bottom:13px; border-bottom:1px solid #efe7d6;
    display:flex; gap:16px; align-items:baseline; flex-wrap:wrap; }
  .cw-yesall { margin-top:20px; padding-top:17px; border-top:1px solid #efe7d6;
    display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
</style>
</head>
<body>
${opts.fixtures ? fixtureBannerHtml() : ""}
${opts.isDevWorktree ? `<div class="worktree-banner">⚠ Dev worktree checkout (${opts.repoRoot}): data/content here is isolated and gitignored, not synced with your main repo. Numbers may look empty/stale even when your real pipeline is fine.</div>` : ""}
<header>
  <h1>Content studio</h1>
  <nav class="rooms" aria-label="Rooms">
    <button class="room${BOOT_ROOM === "studio" ? " on" : ""}" data-room="studio">Studio</button>
    <button class="room" data-room="venture">Venture</button>
    <button class="room${BOOT_ROOM === "content" ? " on" : ""}" data-room="content">Content <span class="count" id="count" hidden>0</span></button>
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
<div class="connection-state" id="connectionState" hidden role="alert"></div>
<main>
  <section class="view" id="roomContent">
    <div class="sheet" id="stripContent" hidden style="padding:24px 56px 10px"></div>
    <div class="sheet" id="contentCaptureHandoff" hidden></div>
    <div class="sheet" id="contentWizard">
      <div class="cw-steps" id="cwSteps"></div>
      <div id="cwBody"><div class="empty">Loading…</div></div>
    </div>
    <div class="sheet" id="reviewSheet" hidden>
      <div class="cw-steps" id="reviewSteps"></div>
      <div class="sheet-head">
        <h2>Approve Drafts</h2>
        <span class="grow"></span>
        <button type="button" class="cw-back" id="reviewSelectAll">Select all</button>
        <button type="button" class="primary" id="reviewApproveSelected">Approve selected for publishing</button>
      </div>
      <div class="sheet-sub">Review related outputs together by input request. Approval moves work into the publishing workflow; it does not claim that a provider accepted it.</div>
      <div class="cw-tabs" aria-label="Draft filters">
        <label style="flex-basis:100%">Input request <input class="request-search" id="reviewRequestFilter" list="reviewRequestOptions" type="search" placeholder="Search or choose an input request" autocomplete="off"><datalist id="reviewRequestOptions"></datalist></label>
        <label>Media <select id="reviewMediaFilter"><option value="">All</option></select></label>
        <label>Platform <select id="reviewPlatformFilter"><option value="">All</option></select></label>
        <label>Treatment <select id="reviewTreatmentFilter"><option value="">All</option></select></label>
      </div>
      <div id="reviewMain" style="margin-top:14px"><div class="empty">Loading…</div></div>
    </div>
    <div class="sheet" id="publishedSheet" hidden>
      <div class="cw-steps" id="publishedSteps"></div>
      <div class="sheet-head"><h2>Publishing status</h2><span class="grow"></span></div>
      <div class="sheet-sub">Scheduling and publication status by input request. Text and cards go through Typefully, TikTok through PostPeer, Shorts through YouTube, and Notes through Substack. A provider is only shown as complete after its recorded result can be read back.</div>
      <div id="publishedMain" style="margin-top:14px"><div class="empty">Nothing has entered publishing yet.</div></div>
    </div>
  </section>
  <section class="view" id="roomStudio" hidden>
    <!-- Studio is one sheet: capture card on top, needs-you + team rail, queue only when busy. -->
    <div class="sheet session">
      <div class="capture studio-capture">
        <div class="capture-rail-row">
          <span class="capture-rail" id="captureRail">One place to say it</span>
          <span class="capture-rail-hint">a thought, a link, a name, a scene</span>
        </div>
        <textarea id="src" placeholder="Say it however it came out."></textarea>
        <div class="capture-verdict" id="captureVerdict" hidden></div>
        <!-- Quiet state: one primary action. Director / Format / Notes and the engine picker are real
             and stay reachable, demoted below so they stop competing with Start-on-it. Link-ask and
             the Notes panel open in place of this block (rules.md carve-out 1), not stacked on it. -->
        <div id="captureQuiet">
          <div class="capture-primary" id="captureActions">
            <button type="button" class="primary" id="routeBtn" title="Reads what you wrote, picks the room, and tells you which one it picked">Start on it</button>
            <span class="capture-explain">I pick the room and begin the next safe step. A bare link still needs one quick question first. Nothing goes out without your review.</span>
          </div>
          <div class="sheet-foot" style="justify-content:flex-start">
            <label class="engine-choice"><span>Run with</span><select class="engine-select" id="studioEngine"><option value="claude">Claude</option><option value="grok">Grok</option><option value="codex">GPT (Codex)</option></select></label>
            <button type="button" class="wb-link" id="notesBtn">Pull Substack Notes</button>
          </div>
        </div>
        <div class="link-ask" id="linkAsk" hidden>
          <div class="link-ask-head">Where should this go?</div>
          <div class="link-ask-btns">
            <button type="button" id="linkFileBtn">Source for Signals</button>
            <button type="button" class="primary" id="linkReadBtn">Versions for Content</button>
            <button type="button" class="link-ask-cancel" id="linkCancelBtn">Never mind, clear it</button>
          </div>
          <div class="hint">${LINK_ASK_SIGNALS_NOTE}</div>
          <div class="link-ask-why">Filing treats it as somewhere your readers came from. Reading treats it as source material for a post of yours. I will not guess between those two.</div>
        </div>
        <div class="notes-panel" id="notesPanel" hidden>
          <div class="notes-head">
            <h3>Substack Notes</h3>
            <label class="toggle"><input type="checkbox" id="notesShowDrafted" /> show already drafted</label>
            <span class="grow"></span>
            <button type="button" id="notesCloseBtn">Close</button>
          </div>
          <div class="notelist" id="notesList"><div class="empty">Loading…</div></div>
          <div class="notes-actions">
            <button type="button" class="primary" id="notesDraftBtn">Draft selected</button>
            <span class="hint">Pick the notes worth cross-posting. Each one gets a folder and goes through the production pipeline; every draft still waits for your yes in the Content room. A note published in the last 30 days stays blocked.</span>
          </div>
        </div>
      </div>
      <div class="session-grid">
        <div class="session-main">
          <div id="studioMain"><div class="empty">Loading…</div></div>
          <div class="jobs" id="jobs" style="max-width:none;margin-top:22px" hidden></div>
        </div>
        <div class="session-margin room-rail" id="studioTeam"></div>
      </div>
    </div>
  </section>
  <section class="view" id="roomFiction" hidden>
    <div class="sheet" id="stripFiction" hidden style="padding:24px 56px 10px"></div>
    <div class="sheet" id="fictionCaptureHandoff" hidden></div>
    <div class="sheet session">
      <div class="session-grid">
        <div class="session-main" id="fictionMain"><div class="empty">Loading…</div></div>
        <div class="session-margin room-rail" id="fictionSide"></div>
      </div>
    </div>
  </section>
  <section class="view" id="roomCharles" hidden>
    <div class="sheet" id="charlesCaptureHandoff" hidden></div>
    <div class="sheet session">
      <div class="session-grid">
      <div class="session-main">
      <nav class="room-pages" aria-label="Charles pages"><button type="button" class="on" data-charles-page="input">Input</button><button type="button" data-charles-page="needs-review">Needs review</button><button type="button" data-charles-page="approved">Approved</button><button type="button" data-charles-page="all">All drafts</button></nav>
      <div id="charlesInputPane">
      <div class="capture charles-composer">
      <div class="capture-title">Draft a Charles post</div>
      <label for="charlesInput">Topic, angle, or idea</label>
      <textarea id="charlesInput" rows="6" placeholder="What should Charles write about?"></textarea>
      <fieldset style="border:0;padding:10px 0 0;margin:0"><legend class="wb-label">FORMATS · EACH QUEUES SEPARATELY</legend>
        <label><input class="charles-format" type="checkbox" value="oneliner" checked> One-liner</label>
        <label><input class="charles-format" type="checkbox" value="essay"> Essay</label>
        <label><input class="charles-format" type="checkbox" value="reply"> Reply</label>
      </fieldset>
      <div class="charles-controls"><label class="engine-choice"><span>Draft with</span><select class="engine-select" id="charlesEngine"><option value="claude">Claude</option><option value="grok">Grok</option><option value="codex">GPT (Codex)</option></select></label><button class="primary" id="charlesDraftBtn">Draft selected formats</button></div>
      <div id="charlesReplySource" hidden style="margin-top:12px">
        <label class="wb-label" for="charlesReplyInput">POST OR ARTICLE TO REPLY TO</label>
        <input id="charlesReplyInput" type="url" style="width:100%" placeholder="Paste the URL or quoted post" />
        <div class="hint" style="margin-top:5px">Charles will respond to this source using the thought above as optional direction.</div>
      </div>
      <div class="hint">Runs the real /charles skill with the engine you choose. Lands in the queue below as "pending". Nothing posts on its own.</div>
      </div>
      </div>
      <div id="charlesDraftPane" hidden>
      <div><div class="wb-margin-cap">Charles drafts</div><p class="sheet-sub">Choose a draft to review. Approved drafts can be sent to Content for platform treatments and publishing.</p></div>
      <div id="charlesDraftList" style="margin-top:20px"></div>
      <div id="charlesMain" style="margin-top:24px"><div class="empty">Loading…</div></div>
      </div>
      </div>
      <div class="session-margin room-rail" id="charlesSide">
        <details id="charlesPersonaPanel" open>
          <summary class="wb-margin-cap">PERSONA CONTEXT</summary>
          <div class="sheet-sub" style="margin-top:10px">Muxin's original brief, verbatim, for copying into her other persona tools.</div>
          <button id="charlesBriefCopyBtn" style="margin-top:10px">Copy persona brief</button>
          <textarea id="charlesBriefText" readonly style="width:100%;min-height:140px;margin-top:10px;font:400 11px/1.5 ui-monospace,monospace;padding:10px;border:1px dashed #e0d6c0;border-radius:8px;background:#fcfbf7;resize:vertical;"></textarea>
        </details>
      </div>
      </div>
    </div>
  </section>
  <section class="view" id="roomVenture" hidden>
    <!-- One default sheet: compact chrome + the thread. Intake guardrails sit behind VEN.pane. -->
    <div class="sheet" id="ventureMainSheet" style="padding:22px 40px 28px">
      <div class="sheet-head"><h2>Venture</h2><label><span class="sr-only">Choose a venture</span><select id="ventureSelect" class="venture-switcher" aria-label="Choose a venture"><option>Loading ventures…</option></select></label><button type="button" id="ventureStartBtn"><span aria-hidden="true">＋</span> Start a venture</button><span class="grow"></span>
        <span class="src" id="ventureDay"></span>
      </div>
      <nav class="venture-stages" aria-label="Venture stages"><button class="venture-stage on" data-set-ven-pane="work">1 · Work</button><span class="cw-sep">→</span><button class="venture-stage" data-set-ven-pane="documents">2 · Documents</button><span class="cw-sep">→</span><button class="venture-stage" data-set-ven-pane="intake">3 · Guardrails</button><span class="cw-sep">→</span><button class="venture-stage" data-set-ven-pane="history">4 · History</button></nav>
      <div id="ventureWorkPane">
      <div class="sheet-sub" style="max-width:640px">Every line below comes from the ledger, the decisions, the artifacts, and your intake. The selected engine drafts one step and stops at your next gate.</div>
      <details class="venture-tools" style="margin-top:12px">
        <summary class="cw-back">Analysis and next-step controls</summary>
        <div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:10px;padding:10px 12px;background:#faf7f0;border:1px solid #efe7d6;border-radius:8px">
          <label class="engine-choice"><span>Run with</span><select class="engine-select" id="ventureEngine"><option value="claude">Claude</option><option value="grok">Grok</option><option value="codex">GPT (Codex)</option></select></label>
          <button type="button" id="ventureAnalyzeBtn">Analyze this step</button>
          <button type="button" id="ventureRunStepBtn">Run the next draft step</button>
          <span class="src">Both stop at the next human gate. Neither approves or publishes.</span>
        </div>
      </details>
      <div id="ventureAnalysisPanel" hidden style="margin-top:16px;padding-top:14px;border-top:1px solid #efe7d6">
        <div class="sheet-head"><h3>Selected engine's read</h3><span class="grow"></span><span class="src" id="ventureAnalysisEngine"></span></div>
        <div class="sheet-sub">Read-only advice about what is ready, what you need to decide, and what must wait. It does not write canon or advance a phase.</div>
        <div class="md" id="ventureAnalysisOut" style="margin-top:12px"></div>
      </div>
      <div class="vroom" id="ventureRead" style="margin:18px -40px 0;border-top:1px solid #efe7d6">
        <div class="vthread" id="ventureThread"><div class="empty">Loading…</div></div>
      </div>
      </div>
      <div id="ventureDocumentsPane" hidden><div id="ventureDocuments"></div><div id="ventureDocumentReader" hidden></div></div>
      <div id="ventureHistoryPane" hidden><div id="ventureRail"></div></div>
      <div id="ventureIntakePane" hidden>
      <div class="sheet-head">
        <h2>Intake guardrails</h2>
        <span class="grow"></span>
        <span class="src">Voice and scorecard fields save as you type</span>
      </div>
      <div class="sheet-sub">These fields are separate from the 25-question interview. They survive a reload, never advance a phase, and remain durable notes for this venture until you choose to use them.</div>
      <div id="ventureIntakeSections">
        <div class="empty" style="padding:18px 0">Choose a venture to load its intake guardrails.</div>
      </div>
      </div>
    </div>
    <div class="sheet" id="ventureCaptureHandoff" hidden></div>
    <div class="sheet" id="ventureIntake" hidden style="padding:26px 40px 34px">
      <div id="intakeBox"></div>
    </div>
  </section>
  <section class="view" id="roomSignals" hidden>
    <div class="sheet" id="signalsCaptureHandoff" hidden></div>
    <div class="sheet" id="stripSignals" hidden style="padding:24px 56px 10px"></div>
    <div class="sheet" id="signalsReads">
    <div class="sheet-head"><h2>Signals</h2><span class="grow"></span><label class="src">Brand <select id="signalsBrand"><option value="human-inference">Human Inference</option><option value="charles">Charles</option><option value="fiction">Fiction</option></select></label><span class="src" id="signalsBriefDate"></span></div>
    <div class="sheet-sub">Where you fit so far, what's worth changing (your call), and what's too weak to trust. Data tunes the dials, never the person.</div>
    <div class="src" style="margin-top:8px">The selected brand scopes measurements, strategy recommendations, decisions, and experiments. Unassigned legacy records stay excluded.</div>
    <div id="signalsTop"><div class="empty">Loading…</div></div>
    <details style="margin-top:26px"><summary class="wb-label">Measurement inventory</summary><div style="margin-top:18px">
      <div style="font:italic 400 14px/1.5 Georgia,serif;color:#a89a80">This read</div>
      <div style="font:400 27px/1.35 Georgia,'Times New Roman',serif;color:#1c1a17;margin:8px 0 0;max-width:520px">Four things, kept apart</div>
      <div class="sheet-sub" style="max-width:560px">One number across all four would hide the thing you most need to see. Nothing on this page adds them up, and two of them are never allowed to argue for dropping a pillar or a platform.</div>
      <div id="signalsFamilies"><div class="empty">Loading…</div></div>
    </div><div id="signalsResearch"></div></details>
    <div class="wb-sep" style="margin-top:30px"><span class="rule"></span><span class="txt">go deeper</span><span class="rule"></span></div>
    <div class="strategy" style="max-width:none;margin-top:14px">
      <div class="strategy-actions">
        <label class="engine-choice"><span>Run analysis with</span><select class="engine-select" id="signalsAnalysisEngine"><option value="claude">Claude</option><option value="grok">Grok</option><option value="codex">GPT (Codex)</option><option value="ollama-gpt-oss">GPT-OSS (local)</option></select></label>
        <button class="primary" id="insightsBtn">Generate insights</button>
        <span class="hint">Runs the analytics reports live, then asks your selected engine for a short skim. Nothing here writes data or publishes anything.</span>
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
    <div class="sheet-foot" style="justify-content:flex-start;align-items:baseline;gap:14px;flex-wrap:wrap">
      <button type="button" class="cw-back" data-set-sig-pane="brief">Show the latest strategy brief</button>
      <button type="button" class="cw-back" data-set-sig-pane="raw">Show the raw downloaded exports</button>
      <span class="src">The brief file and the on-disk CSV/JSON/XLSX pulls live there. This room opens on the reads.</span>
    </div>
    </div>
    <div class="sheet" id="signalsBriefSheet" hidden>
      <div class="sheet-head">
        <button type="button" class="cw-back" data-set-sig-pane="reads">Back to the reads</button>
        <h2>Latest strategy brief</h2>
      </div>
      <div class="notes-panel" id="stratBriefPanel" style="margin-top:14px">
        <div class="notes-head">
          <span class="grow"></span>
          <span class="src" id="briefPath"></span>
          <label class="engine-choice"><span>Run with</span><select class="engine-select" id="strategyEngine"><option value="claude">Claude</option><option value="grok">Grok</option><option value="codex">GPT (Codex)</option></select></label>
          <button id="briefToggleBtn">Show brief</button>
          <button class="primary" id="briefRefreshBtn" title="Runs the full /strategy skill: grades last cycle's bets, writes a new dated brief, records new bets. Takes minutes.">Refresh brief (runs /strategy)</button>
        </div>
        <div id="briefBodyWrap" hidden>
          <div class="md" id="briefBody">Loading…</div>
          <div class="aibox show">
            <input placeholder="tell Claude what to change in the brief…" id="briefAskInput" />
            <button class="send" id="briefAskBtn">Send to engine</button>
          </div>
          <span class="hint">Edits land in the brief file itself. Formatting and strategy runs read the latest brief every time, so a change here feeds forward with no extra step.</span>
        </div>
        <span class="hint">Refresh brief runs the REAL /strategy with the selected engine: grades bets against fresh data and writes a new dated brief.</span>
      </div>
    </div>
    <div class="sheet" id="signalsRawSheet" hidden>
      <div class="sheet-head">
        <button type="button" class="cw-back" data-set-sig-pane="reads">Back to the reads</button>
        <h2>Raw downloaded exports</h2>
        <span class="grow"></span>
        <span class="src" id="rawLastPull"></span>
        <button class="primary" id="rawPullBtn">Pull fresh now</button>
        <button id="rawRefreshBtn">Reload list</button>
      </div>
      <div id="rawList" style="margin-top:14px"><div class="empty">Loading…</div></div>
      <span class="hint">The actual CSV/JSON/XLSX files pulled from each platform (data/inbox = not yet ingested, data/processed = archived after npm run ingest). "Reload list" only re-reads what's already on disk. It does NOT fetch anything new. "Pull fresh now" is the real pull: it launches real Chrome with your saved logins for LinkedIn/X/Substack and can take a few minutes; it otherwise only runs Sundays at 07:00 via cron. Open a file yourself if you want the raw numbers rather than a computed report.</span>
    </div>
  </section>
  <section class="view" id="roomOutreach" hidden>
    <div class="subnav">
      <button class="subtab on" data-sub="leads">Leads</button>
      <button class="subtab" data-sub="followups">Follow-ups</button>
    </div>
    <div class="sheet" id="stripOutreach" hidden style="padding:24px 56px 10px"></div>
    <div class="sheet" id="outreachPane">
      <div id="outreachCaptureHandoff" hidden></div>
      <div id="outreachList"><div class="empty">Loading…</div></div>
      <div class="sheet-foot" id="outreachFoot"><label class="engine-choice"><span>Scout with</span><select class="engine-select" id="scoutEngine"><option value="codex">ChatGPT</option><option value="grok">Grok</option></select></label></div>
    </div>
    <div class="sheet" id="followupsPane" hidden>
      <div class="sheet-head"><h2>Follow-ups</h2></div>
      <div class="sheet-sub">Everything you've sent, and what's next. The clock starts when you click Mark sent. Nothing here sends anything.</div>
      <div id="followupsNote"></div>
      <div id="followupsList" style="margin-top:14px"><div class="empty">Loading…</div></div>
    </div>
  </section>
</main>
<div class="focus-backdrop" id="reviewFocus" hidden><section class="focus-dialog" role="dialog" aria-modal="true" aria-labelledby="reviewFocusTitle" tabindex="-1"><div class="sheet-head"><h2 id="reviewFocusTitle">Draft review</h2><span class="grow"></span><button type="button" id="reviewFocusClose" aria-label="Close draft review">Close</button></div><div id="reviewFocusBody"></div></section></div>
<div class="flash" id="flash"></div>
${opts.fixtures ? fixturePanelHtml() + fixtureScriptHtml() : ""}
<script>
const $ = (s, r=document) => r.querySelector(s);
let DATA = { pieces: [], pending: 0 };
const SAMPLE_REVIEW_PIECE = ${opts.fixtures ? JSON.stringify({
  slug: "sample-ai-power-request", requestId: "sample-layout-only",
  descriptor: "Why do we seem to fear AI more than we fear power?",
  title: "Why do we seem to fear AI more than we fear power?",
  originalInput: "A sample source used only to make the review layout visible in fixture mode.", sample: true,
  rows: [
    { id: "quote-card-1-bluesky", platform: "bluesky", media: "static-quote-card", format: "image", treatment: "quote-card", status: "pending", editable: true, body: "People worry AI will mint a new economic underclass. America already has one; check the Gini wealth index before deciding what is new here." },
    { id: "thread-1-linkedin", platform: "linkedin", media: "text", format: "thread", treatment: "platform-framing", status: "pending", editable: true, body: "We fear new systems of power while treating old concentrations of power as background conditions. That asymmetry is worth examining." },
  ],
}) : "null"};
const DECIDED = new Set(["published","discard","locked"]);
const reviewSelected = new Set();
// In-flight action registries, keyed by stable row.id / piece.slug — NOT stored on the row/DATA
// objects. The 3s job poll (setInterval below) calls load() on ANY job status change anywhere,
// which replaces DATA wholesale and rebuilds every row's DOM from scratch; a flag or "thinking…"
// innerHTML living on the row/DOM gets clobbered by that unrelated refresh, well before the actual
// operation finishes (card fbfea28b). Keying by id/slug instead of the row object also survives
// load() swapping in a fresh row object mid-await.
const aiPending = new Set();       // row ids with an in-flight engine revise
const aiEngine = new Map();        // row id -> selected engine while the run is in flight
const dupPending = new Map();      // row id -> target platform, for an in-flight Duplicate
const dupEngine = new Map();       // row id -> selected engine while the run is in flight
const storyboardSlugs = new Set(); // piece slugs with an in-flight storyboard (video) job

function flash(msg){ const f=$("#flash"); f.textContent=msg; f.classList.add("show"); setTimeout(()=>f.classList.remove("show"),1400); }
function connectionState(message){
  const box=$("#connectionState");
  if(!box) return;
  box.textContent=message;
  box.hidden=false;
}
function connectionRecovered(){
  const box=$("#connectionState");
  if(box) box.hidden=true;
}
// String() rather than a bare ?? "": a caller passing a number used to throw "replace is not a
// function" deep inside a map, and the room's catch reported that render bug as a server problem.
// esc runs on every value this page prints, so it coerces rather than trusting its callers.
function esc(s){ return String(s??"").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
const ENGINE_LABELS = {claude:"Claude", grok:"Grok", codex:"GPT (Codex)", "ollama-gpt-oss":"GPT-OSS (local)"};
const ENGINE_ROLES = {claude:"Writing", grok:"Ideation", codex:"Analysis", "ollama-gpt-oss":"Analysis"};
const ENGINE_OPTIONS = '<option value="claude">Claude · Writing</option><option value="grok">Grok · Ideation</option><option value="codex">GPT (Codex) · Analysis</option>';
const OUTREACH_ENGINE_OPTIONS = '<option value="codex">ChatGPT</option><option value="grok">Grok</option>';
let ENGINE_STATUS = {claude:true, grok:true, codex:true, "ollama-gpt-oss":false};
function engineLabel(id){ return ENGINE_LABELS[id] || "Claude"; }
const ENGINE_PREFERENCE_KEY = "content-agents-preferred-engine";
function preferredEngine(){
  try { const value = localStorage.getItem(ENGINE_PREFERENCE_KEY); return ENGINE_LABELS[value] ? value : "claude"; }
  catch(e){ return "claude"; }
}
function rememberEngine(value){
  if(!ENGINE_LABELS[value]) return;
  try { localStorage.setItem(ENGINE_PREFERENCE_KEY, value); } catch(e) {}
}
function engineSelectHtml(id){ return '<label class="engine-choice"><span>Run with</span><select class="engine-select"'+(id?' id="'+id+'"':'')+'>'+ENGINE_OPTIONS+'</select></label>'; }
function outreachEngineSelectHtml(){ return '<label class="engine-choice"><span>Draft with</span><select class="engine-select outreach-engine">'+OUTREACH_ENGINE_OPTIONS+'</select></label>'; }
function refreshEngineControls(root=document){
  const preferred = preferredEngine();
  root.querySelectorAll(".engine-select").forEach(sel=>{
    [...sel.options].forEach(opt=>{ opt.disabled = ENGINE_STATUS[opt.value] === false; });
    const hasPreferred = [...sel.options].some(opt=>opt.value === preferred);
    if(!sel.dataset.engineTouched && hasPreferred) sel.value = ENGINE_STATUS[preferred] === false ? "claude" : preferred;
    if(sel.value && ENGINE_STATUS[sel.value] === false) sel.value = "claude";
  });
}
document.addEventListener("change", e=>{
  const target = e.target;
  if(target?.classList?.contains("engine-select")){
    target.dataset.engineTouched = "true";
    rememberEngine(target.value);
  }
});
async function loadEngines(){
  try{
    const r = await fetch("/api/engines"); const d = await r.json();
    for(const e of (d.engines||[])) {
      ENGINE_STATUS[e.id] = !!e.installed;
      document.querySelectorAll(".engine-select option[value=\\""+e.id+"\\"]").forEach(opt=>{
        opt.title = (e.roleHint ? e.roleHint+" · " : "")+(e.description||"");
      });
    }
    refreshEngineControls();
    // Engine availability used to fill a second hint under the capture card. That line was
    // collapsed into the single sentence beside Start on it; the select still disables
    // unavailable engines via refreshEngineControls, and sign-in is still checked when a run starts.
  }catch(e){ connectionState("Engine availability could not be checked. The server will validate your choice when you run it."); }
}

function showRoomLoading(id){
  const box = $("#"+id);
  if(!box || box.querySelector(".room-loading")) return;
  box.insertAdjacentHTML("afterbegin", '<div class="room-loading" aria-live="polite" style="display:flex;flex-direction:column;gap:9px;padding:14px 0;opacity:.72"><span style="display:block;width:38%;height:11px;border-radius:6px;background:#e9e0d1"></span><span style="display:block;width:84%;height:10px;border-radius:6px;background:#eee7dc"></span><span style="display:block;width:66%;height:10px;border-radius:6px;background:#eee7dc"></span><span class="src">Loading the latest desk state…</span></div>');
}
function hideRoomLoading(id){ $("#"+id)?.querySelector(".room-loading")?.remove(); }

async function load(){
  try {
    const r = await fetch("/api/queue");
    if(!r.ok) throw new Error("queue "+r.status);
    DATA = await r.json();
    render();
    connectionRecovered();
  } catch(e) {
    connectionState("Content Studio could not load the approval queue. Your existing drafts are unchanged. Check the server, then refresh.");
  }
}
// Armed when a POST that enqueues a job goes OUT. Some of those routes only answer once the whole
// job has finished, so waiting for the response would be too late to ever show its progress.
let jobsPollArmedUntil = 0;
async function post(path, body){
  if(enqueuesJob(path)) jobsPollArmedUntil = Date.now() + JOBS_POLL_MS * 3;
  try {
    const r = await fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
    const data = await r.json();
    connectionRecovered();
    return data;
  } catch(e) {
    connectionState("Content Studio could not reach its server. Your existing files and approvals are unchanged. Check the server, then try again.");
    return {ok:false,error:"Could not reach Content Studio. Check the server and try again."};
  }
}

function statusLabel(s){ return s ? s : "needs"; }
function pillClass(s){ return s && ["approve","revise","discard","published","blocked","locked"].includes(s) ? s : "needs"; }

function rowEl(piece, row){
  const el = document.createElement("div");
  const decided = DECIDED.has(row.status);
  el.className = "row" + (decided ? " decided" : "");
  el.dataset.id = row.id;

  const spin = row.spin ? '<span class="spin">spin · '+esc(row.angle||"")+'</span>' : "";
  const src = row.sourceLines ? '<span class="src">'+esc(lineRefsText(row.sourceLines))+'</span>' : "";
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
  if (row.mediaStage) preview = '<pre class="body story" data-media-stage>'+esc(JSON.stringify(row.mediaStage,null,2))+'</pre>';
  else if (row.assetUrl && row.kind === "image") preview = '<img class="preview" src="'+row.assetUrl+'" alt="card" />';
  else if (row.assetUrl && row.kind === "video") preview = '<video class="preview" src="'+row.assetUrl+'" controls muted></video>';
  // Quote-card row whose PNG hasn't been rendered yet — flag it explicitly instead of falling
  // through to plain-text rendering, which looked identical to a normal card (card 4c3dd6fc).
  else if (row.kind === "image") preview = '<div class="src missing-img">No image rendered yet.</div>';
  if (row.body !== undefined && row.body !== "") {
    const cls = row.kind === "storyboard" ? "body story" : "body";
    preview += '<div class="'+cls+'" data-body>'+esc(row.body)+'</div>';
  }
  if (!preview) preview = '<div class="src">No asset generated yet.</div>';

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
    reconHtml = '<div class="recon-mismatch">⚠ not found at '+esc(recon.provider)+': '+esc(recon.reason||"mismatch")+'</div>';
  } else if (recon && recon.state === "unavailable" && recon.provider === "upload-post") {
    // The retired Upload-Post provider (PR #130 deleted its adapter) has no live check and can't be
    // canceled from here — point straight at the dashboard instead of a dead-end "unavailable".
    reconHtml = '<div class="recon-unknown">⚠ scheduled via the retired Upload-Post provider: check/cancel by hand at '+
      '<a href="https://upload-post.com" target="_blank" rel="noopener">upload-post.com</a></div>';
  } else if (recon && recon.state === "unavailable") {
    reconHtml = '<div class="recon-unknown">provider check unavailable ('+esc(recon.provider)+'): '+esc(recon.reason||"")+'</div>';
  }
  const cancelErr = row.cancelError ? '<div class="recon-mismatch">⚠ cancel failed: '+esc(row.cancelError)+'</div>' : "";
  const manual = row.manualComment ? '<div class="notes">↳ add as first comment in Typefully: '+esc(row.manualComment)+'</div>' : "";
  const editBtn = row.editable ? '<button data-act="edit">Edit</button>' : "";
  const aiBtn = row.revisable ? '<button class="ai" data-act="ai">Revise with an engine</button>' : "";
  // "Generate storyboard" (card 9e20a616): the video-path dead end — a video-script row you can't
  // approve because storyboard.md doesn't exist yet, and no way to run /video without a terminal.
  // storyboardSlugs (module-level, keyed by piece.slug — card fbfea28b) tracks the in-flight state
  // instead of a row flag, so it survives the background poll's load() rebuilding this row's DOM.
  const storyboardBtn = row.canGenerateStoryboard
    ? (storyboardSlugs.has(piece.slug)
        ? '<span class="hint">generating storyboard… (the Studio room has progress)</span>'
        : '<span class="storyboard-control">'+engineSelectHtml()+'<button class="storyboard" data-act="gen-storyboard">Generate storyboard</button></span>')
    : "";
  const mediaPlanBtns = mediaPlanActionsHtml(row.asset, row.mediaStage?.media);
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
      '<span class="spacer"></span>'+ storyboardBtn + mediaPlanBtns + editBtn + aiBtn + dupBtn + cancelBtn +
    '</div>'+
    '<div class="revisebox"><input placeholder="what needs changing?" value="'+esc(row.notes||"")+'" /><button data-act="save-note">Save note</button></div>'+
    // Reopens (and stays open) when a prior "Ask Claude" attempt failed, or while one is in flight
    // (aiPending, keyed by row.id — card fbfea28b), so the thinking indicator/error is still visible
    // after the row's next rerender (a background job poll no longer wipes it), not a 1.4s toast.
    // Also durably shows Claude's REFUSAL reason (card 9304e4a5 part 4) — same mechanism, a real
    // explanation instead of a silent no-op.
    '<div class="aibox'+((row.aiError||aiPending.has(row.id))?" show":"")+'">'+
      (aiPending.has(row.id)
        ? '<div class="thinking">'+esc(engineLabel(aiEngine.get(row.id)))+' is revising. The room strip carries the live clock.</div>'
        : engineSelectHtml()+'<input placeholder="tell the selected engine what to change…" /><button class="send" data-act="ai-send">Run revision</button>'+
          (row.aiError ? '<div class="aierr">⚠ '+esc(row.aiError)+'</div>' : ""))+
    '</div>'+
    (row.duplicatable
      ? '<div class="dupbox'+((row.dupError||dupPending.has(row.id))?" show":"")+'">'+
        (dupPending.has(row.id)
          ? '<div class="thinking">'+esc(engineLabel(dupEngine.get(row.id)))+' is drafting the '+esc(dupPending.get(row.id))+' version. The room strip carries the live clock.</div>'
          : engineSelectHtml()+'<select class="dup-platform">'+dupOptions+'</select><button class="send" data-act="dup-send">Duplicate</button>'+
            (row.dupError ? '<div class="duperr">⚠ '+esc(row.dupError)+'</div>' : ""))+
      '</div>'
      : "");

  el.addEventListener("click", (e)=>onAction(e, piece, row, el));
  return el;
}
let reviewFocusReturn = null;
function reviewSelectionKey(requestId,variantId){ return JSON.stringify([requestId,variantId]); }
function reviewScanRowEl(piece,row){
  const button=document.createElement("div");
  const selectionKey=reviewSelectionKey(piece.slug,row.id);
  button.className="scan-row"; button.dataset.reviewKey=selectionKey;
  const lead=String(row.body||row.notes||"No generated asset yet").replace(/\\s+/g," ").slice(0,150);
  const treatment=row.control===true||row.variantKind==="control" ? "Untreated control" : esc(row.treatment||row.angle||"Treated variant");
  button.innerHTML='<label aria-label="Select '+esc(row.id)+'"><input type="checkbox" class="review-check"'+(reviewSelected.has(selectionKey)?" checked":"")+'></label><span><span class="badge '+esc(row.platform)+'">'+esc(row.platform)+'</span><span class="src" style="display:block;margin-top:4px">'+esc(row.media||row.format||row.kind||"content")+' · '+treatment+'</span></span><span style="min-width:0"><strong>'+esc(row.id)+'</strong><span class="src" style="display:block;margin-top:3px;max-height:4.5em;overflow:auto">'+esc(lead)+'</span></span><span class="pill '+pillClass(row.status)+'">'+esc(reviewStateLabel(row.status))+'</span><button type="button" class="cw-back review-open">Open Focus Mode</button>';
  button.querySelector(".review-check").addEventListener("change",e=>{ if(e.target.checked) reviewSelected.add(selectionKey); else reviewSelected.delete(selectionKey); });
  button.querySelector(".review-open").addEventListener("click",()=>openReviewFocus(piece,row,button.querySelector(".review-open")));
  return button;
}
function reviewStateLabel(status){
  if(status==="approve"||status==="published"||status==="locked") return "Approved";
  if(status==="revise"||status==="blocked") return "Changes requested";
  if(status==="discard") return "Rejected";
  return "Draft";
}
function contentRequestPieces(pieces){ return (pieces||[]).filter(p=>p.originalInput||p.requestId); }
function reviewVisiblePieces(){
  const real=contentRequestPieces(DATA.pieces);
  return real.length||!SAMPLE_REVIEW_PIECE ? real : [SAMPLE_REVIEW_PIECE];
}
function openReviewFocus(piece,row,returnTo){
  reviewFocusReturn=returnTo;
  const body=$("#reviewFocusBody");
  body.innerHTML='<div class="rowhead"><span class="badge '+esc(row.platform)+'">'+esc(row.platform)+'</span><span class="fmt">'+esc(row.format||row.kind||"content")+' · '+esc(row.id)+'</span><span class="pill '+pillClass(row.status)+'">'+esc(reviewStateLabel(row.status))+'</span></div>'+
    '<label class="wb-label" for="reviewFocusEditor" style="display:block;margin-top:18px">EDIT THE DRAFT DIRECTLY</label>'+
    '<textarea id="reviewFocusEditor" class="review-focus-editor">'+esc(row.body||"")+'</textarea>'+
    '<div class="actions"><button type="button" id="reviewFocusSave"'+(row.editable?'':' disabled')+'>Save edit</button><button type="button" class="approve" data-focus-act="approve">Approve</button><button type="button" class="revise" data-focus-act="revise">Request changes</button><button type="button" class="discard" data-focus-act="discard">Discard</button></div>'+
    (row.editable?'':'<div class="src">This asset is not text-editable here.</div>');
  $("#reviewFocusTitle").textContent=piece.title+" · "+row.platform;
  $("#reviewFocus").hidden=false; $("#reviewFocus .focus-dialog").focus();
  const editor=$("#reviewFocusEditor"); if(row.editable) editor.focus();
  $("#reviewFocusSave").addEventListener("click",async ()=>{ const result=await post("/api/derivative",{slug:piece.slug,id:row.id,body:editor.value}); if(result.ok===false){flash(result.error||"Could not save");return;} row.body=editor.value.trim(); flash("Saved"); closeReviewFocus(); rerender(); });
  body.querySelectorAll("[data-focus-act]").forEach(button=>button.addEventListener("click",async ()=>{ const act=button.dataset.focusAct; if(act==="revise"){ closeReviewFocus(); openReviewFocus(piece,row,returnTo); flash("Edit the draft directly, or use Revise with an engine from the draft list"); return; } const result=await post("/api/status",{slug:piece.slug,id:row.id,status:act}); if(result.ok===false){flash(result.error||"Could not update status");return;} if(act==="approve"&&result.scheduled){ row.status=row.kind==="outreach-message"?"locked":"published"; row.scheduledWhen=result.scheduled.when; flash(row.kind==="outreach-message"?"Locked":"Scheduled · "+(result.scheduled.when||"provider accepted")); } else if(act==="approve"&&result.scheduleError){ row.status="approve"; flash("Approved, scheduling needs attention: "+result.scheduleError); } else { row.status=act; flash(act==="approve"?"Approved": "Discarded"); } closeReviewFocus(); rerender(); }));
}
function closeReviewFocus(){
  $("#reviewFocus").hidden=true; $("#reviewFocusBody").innerHTML="";
  if(reviewFocusReturn&&reviewFocusReturn.isConnected) reviewFocusReturn.focus();
  reviewFocusReturn=null;
}
$("#reviewFocusClose").addEventListener("click",closeReviewFocus);
$("#reviewFocus").addEventListener("click",e=>{ if(e.target===$("#reviewFocus")) closeReviewFocus(); });
document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&!$("#reviewFocus").hidden) closeReviewFocus(); });

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
        flash(r.scheduled.autoPublishes === false ? "Uploaded (still PRIVATE: flip it manually in YouTube Studio) · "+r.scheduled.when : "Scheduled · "+r.scheduled.when);
      }
      else if (r.scheduleError){ row.status="approve"; flash("Approved, schedule failed: "+r.scheduleError); }
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
    const engineSelect = el.querySelector(".aibox .engine-select");
    const engine = engineSelect ? engineSelect.value : "claude";
    row.aiError = null;
    aiEngine.set(row.id, engine);
    aiPending.add(row.id); rerender(); // thinking indicator now survives a background job poll's load()
    try {
      const r = await post("/api/revise",{slug:piece.slug,id:row.id,instruction,engine});
      // Durable inline error on the row (survives rerender) instead of a 1.4s auto-hiding toast —
      // the toast alone made a real failure ("Claude ran but didn't change anything") vanish before
      // it registered as anything but "nothing's working."
      if(r.ok){ row.body = r.body; flash("Revised with "+engineLabel(engine)); }
      else { row.aiError = r.error || "error"; }
    } finally { aiPending.delete(row.id); aiEngine.delete(row.id); rerender(); }
  } else if (act === "gen-storyboard"){
    e.target.disabled = true;
    const storyboardEngine = el.querySelector(".storyboard-control .engine-select");
    const engine = storyboardEngine ? storyboardEngine.value : "claude";
    const r = await post("/api/video/generate",{slug:piece.slug,engine});
    if(r.ok){ storyboardSlugs.add(piece.slug); flash("Queued with "+engineLabel(engine)+"; generating storyboard"); loadJobs(); }
    else { e.target.disabled = false; flash(r.error || "Could not queue /video"); }
    rerender();
  } else if (act === "approve-media-plan"){
    e.target.disabled = true;
    const r = await post("/api/content/media/approve",{slug:piece.slug,id:row.id});
    flash(r.ok ? "Media plan/source approved. Rendering is still a separate action." : (r.error||"Could not approve media plan"));
    if(!r.ok) e.target.disabled=false;
  } else if (act === "render-media"){
    e.target.disabled = true;
    const r = await post("/api/content/media/render",{slug:piece.slug,id:row.id});
    if(r.ok){ flash("Configured media render queued"); loadJobs(); }
    else { e.target.disabled=false; flash(r.error||"Could not queue media render"); }
  } else if (act === "attach-reviewed-media"){
    const entered = window.prompt("Paste one relative file per line. Each must be an image already inside this content folder.", "reviewed/image.png");
    if(entered===null) return;
    const assetPaths = entered.split(/\\r?\\n/).map(value=>value.trim()).filter(Boolean);
    if(!assetPaths.length){ flash("Enter at least one relative image path"); return; }
    e.target.disabled = true;
    const r = await post("/api/content/media/attach-reviewed",{slug:piece.slug,id:row.id,assetPaths});
    if(r.ok){ flash("Reviewed image file(s) attached for draft review"); await load(); }
    else { e.target.disabled=false; flash(r.error||"Could not attach reviewed image files"); }
  } else if (act === "dup"){
    const box = el.querySelector(".dupbox"); box.classList.toggle("show");
    if(!box.classList.contains("show")) row.dupError = null; // closing dismisses any stale error
  } else if (act === "dup-send"){
    if(dupPending.has(row.id)) return; // already in flight — don't fire a second real spawn (card fbfea28b)
    const sel = el.querySelector(".dupbox .dup-platform");
    const platform = sel ? sel.value : "";
    if(!platform){ flash("No other platform to duplicate to"); return; }
    const engineSelect = el.querySelector(".dupbox .engine-select");
    const engine = engineSelect ? engineSelect.value : "claude";
    row.dupError = null;
    dupEngine.set(row.id, engine);
    dupPending.set(row.id, platform); rerender(); // thinking indicator now survives a background job poll's load()
    try {
      const r = await post("/api/duplicate",{slug:piece.slug,id:row.id,platform,engine});
      if(r.ok){ flash("Duplicated to "+platform+" with "+engineLabel(engine)+"; new pending row added"); await load(); }
      else { row.dupError = r.error || "error"; rerender(); }
    } finally { dupPending.delete(row.id); dupEngine.delete(row.id); rerender(); }
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
function rerender(){
  // The focus dialog contains a detached copy of a row. Close it before rebuilding the source list,
  // then return focus to the corresponding compact trigger (or the review surface if the action
  // removed that row from the current filter). This prevents an approve/revise response from
  // leaving stale controls visible in the modal.
  const reviewFocusId = !$("#reviewFocus").hidden ? $("#reviewFocusBody .row")?.dataset.id || null : null;
  if(reviewFocusId) closeReviewFocus();
  if(rerenderScheduled) return;
  rerenderScheduled=true;
  requestAnimationFrame(()=>{
    rerenderScheduled=false;
    render();
    if(reviewFocusId){
      const trigger=[...document.querySelectorAll("[data-review-id]")].find(el=>el.dataset.reviewId===reviewFocusId);
      if(trigger) trigger.focus();
      else { const surface=$("#reviewMain"); surface?.setAttribute("tabindex","-1"); surface?.focus(); }
    }
  });
}

function render(){
  const main = $("#reviewMain"); main.innerHTML = "";
  let shown = 0, pending = 0;
  const mediaFilter=$("#reviewMediaFilter")?.value||"";
  const platformFilter=$("#reviewPlatformFilter")?.value||"";
  const treatmentFilter=$("#reviewTreatmentFilter")?.value||"";
  const requestQuery=($("#reviewRequestFilter")?.value||"").trim().toLowerCase();
  for (const piece of reviewVisiblePieces()){
    const rows = piece.rows.filter(r => !DECIDED.has(r.status))
      .filter(r=>!mediaFilter||(r.media||r.kind)===mediaFilter)
      .filter(r=>!platformFilter||r.platform===platformFilter)
      .filter(r=>!treatmentFilter||(treatmentFilter==="control" ? r.control===true||r.variantKind==="control" : r.treatment===treatmentFilter||(treatmentFilter==="treated"&&!(r.control===true||r.variantKind==="control"))))
      .filter(()=>!requestQuery||[piece.slug,piece.descriptor,piece.title].some(value=>String(value||"").toLowerCase().includes(requestQuery)));
    pending += piece.rows.filter(r=>!DECIDED.has(r.status)).length;
    if (!rows.length) continue;
    shown += rows.length;
    const sec = document.createElement("section"); sec.className = "piece";
    const source=String(piece.originalInput||piece.sourceBody||piece.title||"").replace(/\\s+/g," ").split(" ").slice(0,75).join(" ");
    sec.innerHTML = (piece.sample?'<div class="cw-rail t-amber">SAMPLE DATA · LAYOUT ONLY</div><div class="src">Nothing in this sample is added to your request list.</div>':'')+'<h3>'+esc(piece.descriptor||piece.title)+'</h3><div class="slug">Descriptor · '+esc(piece.descriptor||piece.title)+' · '+esc(piece.slug)+'</div><details><summary class="cw-back">Original input</summary><div class="src" style="max-width:680px;margin-top:8px">'+esc(source)+(source.split(" ").length>=75?"…":"")+'</div></details>';
    for (const row of rows) sec.appendChild(reviewScanRowEl(piece, row));
    main.appendChild(sec);
  }
  $("#count").textContent = String(pending);
  $("#count").hidden = pending === 0;
  if (!shown) main.innerHTML = '<div class="empty">Nothing awaiting review for these filters.</div>';
  renderReviewFilters();
  renderPublished();
  refreshEngineControls();
  // Step 3 of the wizard renders the SAME rows out of the same DATA, so a status change anywhere
  // has to repaint it too. renderContentWizard never calls back into render().
  if (typeof renderContentWizard === "function") renderContentWizard();
}
function renderReviewFilters(){
  const media=$("#reviewMediaFilter"), platform=$("#reviewPlatformFilter"), treatment=$("#reviewTreatmentFilter"), request=$("#reviewRequestFilter"), requestOptions=$("#reviewRequestOptions");
  if(!media||!platform||!treatment||!request||!requestOptions) return;
  const mv=media.value, pv=platform.value, tv=treatment.value;
  const visiblePieces=reviewVisiblePieces();
  const rows=visiblePieces.flatMap(p=>p.rows||[]);
  const mediaValues=[...new Set(rows.map(r=>r.media||r.kind).filter(Boolean))];
  const platforms=[...new Set(visiblePieces.flatMap(p=>(p.rows||[]).map(r=>r.platform)))];
  const treatments=[...new Set(rows.filter(r=>!(r.control===true||r.variantKind==="control")).map(r=>r.treatment||"treated").filter(Boolean))];
  media.innerHTML='<option value="">All</option>'+mediaValues.map(value=>'<option value="'+esc(value)+'">'+esc(value)+'</option>').join(""); media.value=mv;
  platform.innerHTML='<option value="">All</option>'+platforms.map(p=>'<option value="'+esc(p)+'">'+esc(p)+'</option>').join(""); platform.value=pv;
  treatment.innerHTML='<option value="">All</option><option value="control">Untreated control</option>'+treatments.map(value=>'<option value="'+esc(value)+'">'+esc(value==="treated"?"Treated":value)+'</option>').join(""); treatment.value=tv;
  const requestedPieces=visiblePieces;
  requestOptions.innerHTML=requestedPieces.map(p=>'<option value="'+esc(p.descriptor||p.title)+'">'+esc(p.slug)+'</option>').join("");
}
function publishingState(row){
  if(row.publishingStatus&&row.publishingStatus.state==="uncertain") return "Needs reconciliation";
  if(row.publishingStatus&&row.publishingStatus.state==="blocked") return "Blocked";
  if(row.publishingStatus&&row.publishingStatus.state==="scheduling") return "Scheduling";
  if(row.publishingStatus&&row.publishingStatus.state==="private") return "Uploaded private";
  if(row.publishingStatus&&row.publishingStatus.state==="cleared") return "Ready to retry";
  if(row.scheduleError||row.reconciled&&row.reconciled.state==="mismatch") return "Needs attention";
  if(row.publishingStatus&&row.publishingStatus.state==="scheduled") return "Scheduled";
  if(row.reconciled&&row.reconciled.state==="scheduled"||row.scheduledWhen) return "Scheduled";
  if(row.status==="published") return "Scheduled / uploaded";
  return "Pending";
}
function publishingProvider(row){
  if(row.reconciled&&row.reconciled.provider) return row.reconciled.provider;
  if(row.publishingStatus&&row.publishingStatus.provider) return row.publishingStatus.provider;
  const platform=String(row.platform||"").toLowerCase(), format=String(row.format||"").toLowerCase();
  if(platform==="x"||platform==="linkedin"||platform==="bluesky"||platform.startsWith("quote-card")) return "Typefully";
  if(platform==="tiktok") return "PostPeer";
  if(platform==="youtube"||format==="short") return "YouTube";
  if(platform==="substack") return "Substack";
  return "No provider assigned";
}
function renderPublished(){
  const main=$("#publishedMain"); if(!main) return; main.innerHTML=""; let shown=0;
  for(const piece of contentRequestPieces(DATA.pieces)){
    const rows=(piece.rows||[]).filter(r=>r.status==="approve"||r.status==="published"||r.status==="locked"||r.scheduleError);
    if(!rows.length) continue; shown+=rows.length;
    const sec=document.createElement("section"); sec.className="piece";
    sec.innerHTML='<h3>'+esc(piece.descriptor||piece.title)+'</h3><div class="slug">Input request · '+esc(piece.slug)+'</div><div class="publish-row head"><span>Draft</span><span>Destination</span><span>Planned / sent</span><span>Provider status</span></div>';
    for(const row of rows){
      const state=publishingState(row), item=document.createElement("div"); item.className="publish-row";
      const error=(row.publishingStatus&&row.publishingStatus.error)||row.scheduleError||(row.reconciled&&row.reconciled.reason)||"";
      const provider=publishingProvider(row);
      const planned=(row.reconciled&&row.reconciled.when)||(row.publishingStatus&&row.publishingStatus.plannedFor)||row.scheduledWhen||"No planned time recorded";
      const ref=row.publishingStatus&&row.publishingStatus.ref ? ' · '+esc(row.publishingStatus.ref) : '';
      const reconcile=row.publishingStatus&&(row.publishingStatus.state==="uncertain"||row.publishingStatus.state==="scheduling") ? '<div class="actions"><button data-publish-resolve="exists" data-slug="'+esc(piece.slug)+'" data-id="'+esc(row.id)+'">I found it at the provider</button><button data-publish-resolve="not-created" data-slug="'+esc(piece.slug)+'" data-id="'+esc(row.id)+'">Provider has nothing · allow retry</button></div>' : '';
      item.innerHTML='<span><strong>'+esc(row.id)+'</strong><span class="src" style="display:block">'+esc(row.format||row.kind||"content")+'</span></span><span class="badge '+esc(row.platform)+'">'+esc(row.platform)+'</span><span><span class="pill">'+state+'</span><span class="src" style="display:block">'+esc(planned)+'</span></span><span class="src"><strong>'+esc(provider)+'</strong>'+ref+'<br>'+(error?esc(error):state==="Pending"?'Waiting for the provider to accept it.':'Provider result recorded; live publication is not yet confirmed.')+reconcile+'</span>';
      sec.appendChild(item);
    }
    main.appendChild(sec);
  }
  main.querySelectorAll("[data-publish-resolve]").forEach(button=>button.addEventListener("click",()=>resolvePublishing(button.dataset.slug,button.dataset.id,button.dataset.publishResolve,button)));
  if(!shown) main.innerHTML='<div class="empty">Nothing has entered publishing yet.</div>';
}
async function resolvePublishing(slug,id,resolution,button){
  if(resolution==="not-created"&&!confirm("Only allow a retry after you checked the named provider and confirmed that no draft, upload, or post exists. Continue?")) return;
  const ref=resolution==="exists" ? prompt("Provider reference or URL (optional)","") : undefined;
  const plannedFor=resolution==="exists" ? prompt("Planned time or current provider status (optional)","") : undefined;
  button.disabled=true;
  const result=await post("/api/publishing/resolve",{slug,id,resolution,ref,plannedFor});
  if(!result.ok){ button.disabled=false; flash(result.error||"Could not record the reconciliation"); return; }
  flash(resolution==="exists"?"Provider item recorded. No retry will run.":"Provider check recorded. You may approve again to retry.");
  await load();
}
async function approveReviewSelection(){
  const targets=[];
  for(const piece of DATA.pieces||[]) for(const row of piece.rows||[]) if(reviewSelected.has(reviewSelectionKey(piece.slug,row.id))&&!DECIDED.has(row.status)) targets.push({piece,row});
  const failures=[];
  for(const {piece,row} of targets){ const result=await post("/api/status",{slug:piece.slug,id:row.id,status:"approve"}); if(result&&result.ok===false) failures.push(result.error||"Approve blocked"); else if(result&&result.scheduleError) failures.push(result.scheduleError); }
  reviewSelected.clear(); await load();
  flash(failures.length?"Some approvals need attention: "+failures.join(" · "):"Approved and handed to publishing");
}

// ── rooms ──
// Seven rooms on the desk: Studio, Venture, Content, Outreach, Fiction, Charles, and Signals.
// Refresh stays room-aware: it only re-reads whatever the CURRENT room shows, labeled per room,
// with a "last refreshed HH:MM" stamp so its effect is visible.
let currentTab = ${JSON.stringify(BOOT_ROOM)};
const SHOW_TEST_VENTURES = ${JSON.stringify(Boolean(process.env.CONTENT_AGENTS_TEST_VENTURE_ROOT))};
let outreachSub = "leads"; // the Outreach room's Leads | Follow-ups toggle
function refreshLabelFor(t){ return t==="content" ? "Refresh the desk" : t==="studio" ? "Refresh queue" : t==="signals" ? "Reload brief + file list" : t==="fiction" ? "Reload canon" : t==="charles" ? "Reload drafts" : t==="venture" ? "Reread canon" : t==="outreach" ? (outreachSub==="followups" ? "Refresh follow-ups" : "Scout new leads") : "Refresh"; }
function setRoom(t){
  currentTab = t;
  document.querySelectorAll(".room").forEach(b=>{
    const on = b.dataset.room===t;
    b.classList.toggle("on", on);
    if(on) b.setAttribute("aria-current","page");
    else b.removeAttribute("aria-current");
  });
  $("#roomContent").hidden = t!=="content";
  $("#roomStudio").hidden = t!=="studio";
  $("#roomOutreach").hidden = t!=="outreach";
  $("#roomFiction").hidden = t!=="fiction";
  $("#roomCharles").hidden = t!=="charles";
  $("#roomVenture").hidden = t!=="venture";
  $("#roomSignals").hidden = t!=="signals";
  $("#refresh").textContent = refreshLabelFor(t);
  if (t==="content"){
    const pending = loadContent();
    renderCaptureHandoff();
    return pending;
  }
  if (t==="studio"){ loadStudio(); loadJobs(); }
  if (t==="signals"){ loadSignals(); if(!briefLoaded){ loadBrief(); loadRaw(); } }
  if (t==="outreach"){ setOutreachSub(outreachSub); }
  if (t==="fiction"){ loadFiction(); }
  if (t==="charles"){ loadCharles(); }
  if (t==="venture"){ loadVentureList(); }
  renderCaptureHandoff();
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
    else if (currentTab === "venture") { await loadVenture(); }
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
// SIG.pane picks which of the Signals room's three sheets is on screen: "reads" (default),
// "brief", or "raw". Exactly one shows at a time — see renderSignalsSheets.
let SIG = { pane: "reads" };
function renderSignalsSheets(){
  $("#signalsReads").hidden = SIG.pane !== "reads";
  $("#signalsBriefSheet").hidden = SIG.pane !== "brief";
  $("#signalsRawSheet").hidden = SIG.pane !== "raw";
}
function openSignalsBrief(){
  SIG.pane = "brief";
  renderSignalsSheets();
  setBriefExpanded(true);
}
async function loadBrief(){
  briefLoaded = true;
  const r = await fetch("/api/strategy/brief?brand="+encodeURIComponent(signalsBrand())); const d = await r.json();
  if(!d.ok){ $("#briefBody").textContent = d.error; $("#briefPath").textContent = ""; return; }
  $("#briefBody").innerHTML = mdToHtml(d.content);
  $("#briefPath").textContent = d.path;
}
// Collapsed by default — the brief used to render in full the moment the Strategy tab opened,
// which is the "populates the whole page" behavior Muxin flagged. Now it opens on request: the
// toggle button, or the dated "Brief: <date>" link Generate Insights renders (delegated listener
// below, since that link lives inside dynamically-injected insights/brief-revise HTML). Opening
// that link also switches SIG.pane to the demoted brief sheet.
function setBriefExpanded(open){
  $("#briefBodyWrap").hidden = !open;
  $("#briefToggleBtn").textContent = open ? "Hide brief" : "Show brief";
}
$("#briefToggleBtn").addEventListener("click", ()=> setBriefExpanded($("#briefBodyWrap").hidden));
document.addEventListener("click", (e)=>{
  const a = e.target.closest && e.target.closest('a[href="#stratBriefPanel"]');
  if(a){ openSignalsBrief(); }
});
$("#roomSignals").addEventListener("click", (e)=>{
  const t = e.target.closest ? e.target.closest("[data-set-sig-pane]") : null;
  if(!t) return;
  SIG.pane = t.dataset.setSigPane;
  renderSignalsSheets();
  if(SIG.pane === "brief") setBriefExpanded(true);
});
async function askBrief(){
  const inp = $("#briefAskInput"); const instruction = inp.value.trim();
  if(!instruction){ flash("Type what you want changed first"); return; }
  $("#briefAskBtn").disabled = true;
  const prevHtml = $("#briefBody").innerHTML;
  const engine = $("#strategyEngine").value;
  $("#briefBody").textContent = engineLabel(engine)+" is revising the brief. The room strip carries the live clock.";
  const r = await post("/api/strategy/ask", {instruction, engine, brand:signalsBrand()});
  $("#briefAskBtn").disabled = false;
  if(r.ok){ $("#briefBody").innerHTML = mdToHtml(r.content); $("#briefPath").textContent = r.path; inp.value = ""; flash("Brief revised with "+engineLabel(engine)); }
  else { $("#briefBody").innerHTML = prevHtml; flash("Revise failed: "+(r.error||"error")); }
}
$("#briefAskBtn").addEventListener("click", askBrief);

// "Refresh brief": the FULL /strategy skill as a background job (Muxin, 2026-07-16: the brief
// never refreshes unless he runs /strategy in a terminal). It genuinely takes minutes, and the one
// measured count for that wait is the room strip's, not a clock started here.
async function refreshBriefRun(){
  const btn = $("#briefRefreshBtn");
  btn.disabled = true;
  const body = $("#briefBody");
  const prevHtml = body.innerHTML;
  // No clock here. The progress strip at the top of this room is the ONE measured duration for
  // this job, and it counts from when the job was queued. A second timer started at the click
  // disagreed with it on the same screen, which is the exact defect this design was corrected for.
  const engine = $("#strategyEngine").value;
  body.innerHTML = '<p class="thinking">Running /strategy with '+esc(engineLabel(engine))+'. It grades your bets and writes a new dated brief. The room strip carries the live clock.</p>';
  loadJobs(); // make the strategy job visible in the Studio room right away
  try {
    const r = await post("/api/strategy/refresh-brief", {engine, brand:signalsBrand()});
    if(r.ok){ flash("Brief refreshed: "+(r.path||"")); await loadBrief(); }
    else { body.innerHTML = prevHtml; flash(r.error || "Refresh failed: see the job log"); }
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
  else if(r.engine === "claude" || r.engine === "claude-cli") parts.push('<span style="color:#5b46b8;font-weight:600">analyst · Claude</span>');
  else if(r.engine === "grok") parts.push('<span style="color:#5b46b8;font-weight:600">analyst · Grok</span>');
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
  const engine = $("#signalsAnalysisEngine").value;
  const intro = engine === "claude" ? "Running the reports, then asking Claude for a synthesis." : "Running the reports, then asking "+engineLabel(engine)+" for a synthesis.";
  $("#insightsOut").innerHTML = '<p class="hint">'+esc(intro)+' The room strip carries the live clock.</p>';
  const r = await post("/api/strategy/insights", {engine, brand:signalsBrand()});
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
  const engine = $("#signalsAnalysisEngine").value;
  thinking.innerHTML = esc(engineLabel(engine))+' is looking into it. It may re-run a report first. The room strip carries the live clock.';
  $("#insightsThread").appendChild(thinking);
  const r = await post("/api/strategy/ask-insights", {question:q, history:insightsHistory, engine, brand:signalsBrand()});
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
// though it can take minutes (real Chrome, saved LinkedIn/X/Substack sessions). Card a14693da took
// the fixed ETA off this wait rather than underselling an honestly variable one; the honest count
// that replaced it is the room strip's, and nothing here starts a second one.
async function pullFresh(){
  const btn = $("#rawPullBtn");
  btn.disabled = true; $("#rawRefreshBtn").disabled = true;
  const box = $("#rawList");
  const prevHtml = box.innerHTML;
  box.innerHTML = '<div class="empty">Pulling fresh analytics through real Chrome. It can take a few minutes. The strip at the top of this room carries the clock.</div>';
  const r = await post("/api/strategy/pull", {brand: signalsBrand()});
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
// ── begin the capture-date mirror ──
// Mirror of evidenceCapturedView: dated, or undated and saying so. Never a backfilled day.
const NO_CAPTURE_DATE_RECORDED = "no capture date recorded";
function evidenceCapturedView(capturedAt){
  const t = (capturedAt||"").trim();
  if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(t)) return { dated:false, text:NO_CAPTURE_DATE_RECORDED };
  return { dated:true, text:"captured "+t };
}
// ── end of the capture-date mirror ──
// Message status only: the tracker's lastTouch is keyed lead:person, never message, so it can
// never say WHICH message went. The logged send is reported below as the lead-level fact it is.
function outreachSendState(msg){
  if(!msg) return "none";
  return (msg.status||"").trim() === "locked" ? "locked" : "draft";
}
function outreachSendNote(state){
  if(state==="draft") return "Locking readies it. You send it by hand, and nothing here can send it for you.";
  if(state==="locked") return "Copy the locked message, send it in the channel you choose, then record that you sent it.";
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
function outreachGoodFit(l){
  const fit=String(l.classificationOrFit||l.fit||l.classification||"").trim().toLowerCase();
  if(l.kind==="platform") return fit==="strong"||fit==="partial";
  if(l.kind==="client") return fit==="turnaround"||fit==="greenfield";
  return false;
}

// ── Triage: the queue, grouped by why ──
function triageHtml(){
  const groups = groupLeadsBySegment((OUTREACH_LEADS||[]).filter(outreachGoodFit));
  if(!groups.length) return '<div class="empty">No leads yet. Scout new leads above runs the discovery agent. Nothing is contacted or sent automatically.</div>';
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
    '<div class="src">Pick someone from the queue. The research on them, and every source behind it, opens here. Only you ever send it.</div></div>';
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
    // No fallback anywhere on this row: an item with nothing valid behind it says it has no
    // source, and an item nobody dated says it has no date. Neither borrows from the other.
    const sv = evidenceSourceView(e.source);
    const src = sv.kind==="link" ? '<a class="ev-src" href="'+esc(sv.text)+'" target="_blank" rel="noopener">source ↗</a>'
      : sv.kind==="text" ? '<div class="ev-src">'+esc(sv.text)+'</div>'
      : '<div class="ev-nosrc">'+esc(sv.text)+'</div>';
    const cv = evidenceCapturedView(e.captured_at);
    const cap = '<div class="'+(cv.dated?"ev-cap":"ev-nocap")+'">'+esc(cv.text)+'</div>';
    const cls = e.signal==="worldview-match" ? "green" : "sand";
    return '<div class="wb-check '+cls+'"><span class="t"><span class="verdict">'+esc(e.signal)+'</span>'+(e.person?' · '+esc(e.person):"")+'</span>'+quote+src+cap+'</div>';
  }).join("");
  const stats = (l.jsaStats||[]).slice(0,3).map(s=>'<div class="d" style="font-size:12.5px;color:#5a5346;">'+esc(s.label)+': '+esc(s.value)+'</div>').join("");
  const profile = (l.profileRest||l.profile) ? '<details class="lead-details"><summary>Full profile</summary><div class="ntext" style="white-space:pre-wrap;font-size:12.5px;">'+esc(l.profileRest||l.profile)+'</div></details>' : "";
  const reasoning = l.classificationNote ? '<details class="lead-details"><summary>Full why-fit reasoning</summary><div class="ntext" style="white-space:pre-wrap;font-size:12.5px;">'+esc(l.classificationNote)+'</div></details>' : "";
  const matchRows=matchmakerRead(l).rows;
  const matchDetail=matchRows.length?'<details class="lead-details"><summary>Why this lead?</summary><div class="mm-grid">'+matchRows.map(r=>'<div class="mm-row"><span class="k">'+esc(r.k)+'</span><span class="v">'+esc(r.v)+'</span></div>').join("")+'</div></details>':"";
  return '<div class="session-margin"><details class="outreach-why"><summary class="wb-margin-cap">WHY THIS LEAD?</summary>'+
    (items || '<div class="src">No evidence recorded on this lead yet.</div>')+
    (stats?'<div>'+stats+'</div>':"")+matchDetail+reasoning+profile+'</details>'+
    '<div class="wb-reply"><div class="wb-margin-cap">FOLLOW-UP</div><span class="mono-note">After a send is logged, its reminder and history stay here.</span></div></div>';
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
    return saidBlock + '<div class="thinking" style="margin-top:14px;">Drafting the pitch… (your subscription. The Studio room has the progress and the log.)</div>';
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
        ? '<div class="thinking">Rewriting the same draft, not adding a new one…</div>'
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
  return '<div class="send-steps"><button type="button" class="out-copy" data-dir="'+esc(l.dir)+'">Copy message</button><button type="button" class="primary out-mark-sent" data-dir="'+esc(l.dir)+'">I sent this by hand</button>'+note+'</div>';
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
  // The direction composer replaces the old one-click "Draft the message": drafting now starts from
  // what she typed, so the thread only offers it once the lead is one she said to pursue.
  const canDraft = !l.latestMessage && l.kind!=="content-example" && (l.status==="pursue"||l.status==="qualified");
  const direction = (canDraft || pending || l.latestMessage) && l.kind!=="content-example" ? directionHtml(l) : "";
  const outreachEngine = l.kind!=="content-example" ? outreachEngineSelectHtml() : "";
  const decideBtns = l.kind==="content-example" ? "" :
    '<div class="wb-handoff" style="margin-top:18px">'+
      (undecided ? '<button class="primary out-pursue" data-dir="'+esc(l.dir)+'">Interested</button><button class="out-pass" data-dir="'+esc(l.dir)+'">Not for me</button>' : '<span class="pill">'+esc(l.status)+'</span>')+
      '<span class="note">This only records your yes or no.</span>'+
    '</div>';
  const recommendation = l.kind==="content-example" ? "" :
    '<div class="outreach-recommendation" style="margin-top:18px;padding:14px 16px;border-left:2px solid var(--green);background:#f5f9f4">'+
      '<div class="wb-margin-cap">WHY THIS MAY BE WORTH A CONVERSATION</div><p style="margin:6px 0 0;max-width:680px">'+esc(mmr.headline||"The research suggests a plausible overlap, but you should decide whether it is strong enough to pursue.")+'</p></div>';
  const notes = '<div class="lead-notes">'+
    (l.muxinNotes ? '<div class="my-notes">'+esc(l.muxinNotes)+'</div>' : "")+
    '<div class="aibox show"><input class="lead-note-input" placeholder="your note on this lead (what stood out)…" /><button class="lead-note-save" data-dir="'+esc(l.dir)+'">Save note</button></div></div>';
  return '<div class="dossier-grid"><div style="min-width:0;">'+
    '<button class="out-back">← Back to queue</button>'+
    '<div class="thread-head"><span class="thread-seg">'+esc(threadSegLabel(seg))+'</span>'+
      '<span class="thread-who">'+esc(l.name||l.dir)+'</span>'+
      '<span class="thread-person">'+esc(contactsLine(l.contacts))+'</span></div>'+
    '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><span class="seg-chip '+esc(seg)+'">'+esc(info.label)+'</span>'+fitChip+'</div>'+recommendation+decideBtns+
    '<details class="outreach-why" style="margin-top:14px"><summary>Why this lead?</summary><p class="src">'+esc(mmr.headline)+'</p></details>'+
    '<details style="margin-top:14px"><summary>Recipient</summary>'+whoBoxHtml(l)+'</details>'+outreachEngine + direction + outreachMessageBox(l) + sendStepsHtml(l) +
    '<details style="margin-top:18px"><summary>Notes</summary>'+notes+'</details>'+
    (l.url?'<div class="src" style="margin-top:10px;"><a href="'+esc(l.url)+'" target="_blank" rel="noopener">'+esc(l.url)+'</a></div>':"")+
  '</div>'+outreachMarginHtml(l)+'</div>';
}

function renderOutreachBox(){
  if(!OUTREACH_LEADS) return;
  const box = $("#outreachList");
  const leads = OUTREACH_LEADS.filter(outreachGoodFit);
  if(!leads.length){
    activeLeadDir = null;
    box.innerHTML = '<div class="empty">No leads yet. Scout new leads above runs the discovery agent. Nothing is contacted or sent automatically.</div>';
    return;
  }
  if(activeLeadDir && !leads.some(l=>l.dir===activeLeadDir)) activeLeadDir = null;
  const active = activeLeadDir ? leads.find(l=>l.dir===activeLeadDir) : null;
  box.innerHTML = active ? threadHtml(active) : triageHtml();
  refreshEngineControls(box);
  box.querySelectorAll("button.tri-row").forEach(b=>b.addEventListener("click",()=>{ activeLeadDir = b.dataset.dir; renderOutreachBox(); }));
  box.querySelectorAll("button.out-back").forEach(b=>b.addEventListener("click",()=>{ activeLeadDir = null; renderOutreachBox(); }));
  box.querySelectorAll("button.dir-send").forEach(b=>b.addEventListener("click", ()=>{
    const select = b.closest(".dossier-grid")?.querySelector(".engine-select");
    outreachDraft(b.dataset.dir, b, select ? select.value : "codex");
  }));
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
  box.querySelectorAll("button.out-copy").forEach(b=>b.addEventListener("click", ()=>outreachCopy(b.dataset.dir)));
  box.querySelectorAll("button.out-mark-sent").forEach(b=>b.addEventListener("click", ()=>outreachMarkSent(b.dataset.dir, b)));
  box.querySelectorAll("button.lead-note-save").forEach(b=>b.addEventListener("click", ()=>outreachSaveNote(b)));
  box.querySelectorAll("button.msg-save").forEach(b=>b.addEventListener("click", ()=>outreachMsgSave(b)));
  box.querySelectorAll("button.msg-revise").forEach(b=>b.addEventListener("click", ()=>{
    const select = b.closest(".dossier-grid")?.querySelector(".engine-select");
    outreachMsgRevise(b, select ? select.value : "codex");
  }));
  box.querySelectorAll("button.who-add").forEach(b=>b.addEventListener("click", ()=>outreachAddContact(b.dataset.dir, b.dataset.name, "")));
  box.querySelectorAll("button.who-save").forEach(b=>b.addEventListener("click", ()=>{
    const wrap = b.closest(".who-box");
    outreachAddContact(b.dataset.dir, wrap.querySelector(".who-name").value.trim(), wrap.querySelector(".who-role").value.trim());
  }));
}

async function outreachCopy(dir){
  const lead = (OUTREACH_LEADS||[]).find(l=>l.dir===dir);
  const body = lead && lead.latestMessage ? String(lead.latestMessage.body||"") : "";
  if(!body.trim()){ flash("No message to copy yet"); return; }
  try {
    await navigator.clipboard.writeText(body);
    flash("Message copied");
  } catch (e) {
    flash("Could not copy automatically. Select the message text and copy it.");
  }
}

async function outreachMarkSent(dir, button){
  const lead = (OUTREACH_LEADS||[]).find(l=>l.dir===dir);
  if(!lead || !lead.latestMessage){ flash("No message to mark as sent"); return; }
  button.disabled = true;
  try {
    const r = await post("/api/outreach/mark-sent", {dir:lead.dir});
    if(!r.ok){ button.disabled=false; flash(r.error||"Could not record the send"); return; }
    flash("Send recorded. Follow-ups will remind you when it is time to check back.");
    await loadOutreach();
  } catch (e) {
    button.disabled=false;
    flash(e instanceof Error ? e.message : String(e));
  }
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

async function outreachMsgRevise(b, engine){
  const dir = b.dataset.dir, file = b.dataset.file;
  if(msgPending.has(dir)) return; // already in flight — never a second real claude -p spawn
  const inp = b.closest(".aibox").querySelector(".msg-revise-input");
  const instruction = inp ? inp.value.trim() : "";
  if(!instruction){ flash("Type what should change first"); return; }
  msgError.delete(dir);
  msgPending.add(dir); renderOutreachBox();
  try {
    const r = await post("/api/outreach/message/revise", outreachMessageReviseRequest(dir, file, instruction, engine));
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
  const engine = $("#scoutEngine")?.value || "codex";
  const box = $("#outreachList");
  const banner = document.createElement("div");
  banner.className = "hint";
  banner.style.padding = "10px 4px";
  banner.textContent = "Scouting for new leads with "+engineLabel(engine)+" and bounded searches on your subscription. It takes minutes. The strip at the top of this room carries the clock, and the Studio room has the log.";
  box.prepend(banner);
  loadJobs(); // make the scout job visible in the Studio room right away
  try {
    const r = await post("/api/outreach/scout", {engine});
    if(r.ok){ flash("Scout finished with "+engineLabel(engine)+": leads reloaded"); }
    else flash(r.error || "Scout failed: see the job log");
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
  showRoomLoading("outreachList");
  try {
    const [leadsRes, fuRes] = await Promise.all([
      fetch("/api/outreach/leads"),
      fetch("/api/followups").catch(()=>null),
    ]);
    if(!leadsRes.ok) throw new Error("outreach "+leadsRes.status);
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
    hideRoomLoading("outreachList");
    connectionRecovered();
  } catch(e) {
    hideRoomLoading("outreachList");
    box.innerHTML = '<div class="load-error" role="alert"><strong>Could not load Outreach.</strong><div>Your lead files are unchanged. Check the server, then try again.</div><button type="button" id="outreachRetry">Try again</button></div>';
    $("#outreachRetry")?.addEventListener("click", loadOutreach);
    connectionState("Content Studio could not load Outreach. Your lead files are unchanged.");
  }
}


// Content source sessions feed the configuration wizard and preserve provenance for review rows.
let WB_SESSIONS = [];
function fmtDay(iso){
  if(!iso) return "";
  const p = iso.split("-");
  const MO = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return MO[(Number(p[1])||1)-1]+" "+Number(p[2]);
}
// source_lines rides in from a piece's frontmatter, so it is whatever was written there: usually
// an array of numbers, sometimes a bare scalar, occasionally something malformed. This runs inside
// rowEl, which builds every row of the review queue, so a .map on a non-array would take the whole
// queue down over one bad file. Anything that is not an array of refs degrades to nothing shown.
function lineRefsText(refs){
  let list;
  if(Array.isArray(refs)) list = refs;
  else if(typeof refs === "number" || (typeof refs === "string" && refs.trim() !== "")) list = [refs];
  else list = [];
  const parts = list.map(String).filter(function(s){ return s.trim() !== ""; });
  if(!parts.length) return "";
  return (parts.length===1 ? "line " : "lines ")+parts.join(", ");
}
async function loadContent(){
  showRoomLoading("contentWizard");
  try {
    const r = await fetch("/api/content");
    if(!r.ok) throw new Error("content "+r.status);
    const d = await r.json();
    WB_SESSIONS = d.sessions || [];
    renderContentWizard();
    hideRoomLoading("contentWizard");
    connectionRecovered();
  } catch(e) {
    hideRoomLoading("contentWizard");
    $("#cwBody").innerHTML = '<div class="load-error" role="alert"><strong>Could not load Content.</strong><div>Your existing drafts are unchanged. Check the server, then try again.</div><button type="button" id="contentRetry">Try again</button></div>';
    $("#contentRetry")?.addEventListener("click", loadContent);
    connectionState("Content Studio could not load Content. Your existing drafts are unchanged.");
  }
}

// ── Content: the three-step wizard (pick a source, decide the treatment, approve the drafts) ──
//
// Step 1 reads GET /api/content, step 2 reads
// GET /api/content/treatment?slug=…, step 3 reads the piece's own rows out of GET /api/queue and
// approves them through the SAME POST /api/status every review card uses. No new write path.
//
// Refused from the design prototype, because no read in this repo supports them:
//   * the tick-a-channel-then-generate control. config/routing.yaml's defaults list is the only
//     thing that includes or skips a channel (src/strategy/route.ts, a locked policy), so a
//     checkbox here would claim a power the pipeline does not give it. The grid is a read.
//   * the per-draft treatment block (a CTA toggle and persona spins sized by an audience cluster).
//     Nothing in src/ clusters Muxin's own audience, so none of it has a source.
//   * the VENTURE source tag. Nothing hands a Venture artifact to content/. See develop.ts.
// CW.pane picks either the configuration wizard or the grouped review surface.
let CW = { slug:null, step:1, tab:null, treat:null, treatFor:null, treatErr:null, signalDefaults:null, launching:false, loading:false, yesErrors:[], pane:"wizard", config:null, approvedLens:null };

// ── begin the treatment mirror ──
// Rule 5: written twice, once exported from page.ts for DOM-free tests and once here. Keep both.
function fitLine(ch, floor){
  const score = ch.score == null ? "" : String(Math.round(ch.score*100)/100);
  if(ch.fitBasis === "measured"){
    const tone = ch.fitLabel === "STRONG FIT" ? "green" : ch.fitLabel === "POOR FIT" ? "amber" : "ink";
    return { label: ch.fitLabel || "NO FIT CALL",
      basis: "measured, scoring "+score+" where this platform's own norm is 1.0 and the floor is "+floor,
      tone: tone };
  }
  if(ch.fitBasis === "insufficient-data"){
    return { label: ch.fitLabel || "COLD START",
      basis: "not enough posts or weeks on this channel to score it, so there is no verdict here yet",
      tone: "grey" };
  }
  if(ch.fitBasis === "editorial-rule"){
    return { label:"EDITORIAL RULE", basis:"your own rule in config/routing.yaml put it here, the data never spoke", tone:"grey" };
  }
  if(ch.fitBasis === "format-asset"){
    return { label:"ALWAYS GENERATED", basis:"a format asset, so it was never fit scored", tone:"grey" };
  }
  return { label:"NOT SCORED", basis:"nothing on disk says what this piece is about, so fit was never computed", tone:"grey" };
}
function floorNote(ch, floor){
  if(!ch.belowFloor) return "";
  return "Scores under the floor of "+floor+" and stays on. A score never skips a channel here, config/routing.yaml's defaults list decides that on its own.";
}
function reuseLine(ch){
  if(!ch.reuse) return { text: ch.reuseNote || "no reuse check runs for this channel", tone:"grey" };
  const window = "this channel's own window of "+fmtDays(ch.reuse.minDays);
  if(!ch.reuse.everPlaced) return { text:"Never placed here, so "+window+" is holding nothing.", tone:"ink" };
  const ago = ch.reuse.daysSince == null ? "at an unrecorded time" : fmtDays(ch.reuse.daysSince)+" ago";
  if(ch.reuse.allowed) return { text:"Last placed "+ago+", which is past "+window+".", tone:"ink" };
  return { text:"Held: placed "+ago+", inside "+window+".", tone:"amber" };
}
function readsFromCells(t, cuts){
  const held = t.channels.filter(c=>c.reuse && c.reuse.everPlaced && !c.reuse.allowed);
  const pillar = t.pillarSource === "routing.md"
    ? { k:"PILLAR", v:t.pillars.join(" + ")+", read from this piece's routing.md. It is what drove every fit call below.", tone:"ink" }
    : { k:"PILLAR", v:"None. This piece has no routing.md, so nothing below was fit scored and every call is yours.", tone:"grey" };
  const reuse = held.length
    ? { k:"REUSE WINDOWS",
        v: held.map(c=>c.channel+" carried this "+fmtDays(c.reuse.daysSince == null ? 0 : c.reuse.daysSince)+" ago, against its own window of "+fmtDays(c.reuse.minDays)).join(". ")+
           ". Every channel carries its own window, so there is no single number here.",
        tone:"amber" }
    : { k:"REUSE WINDOWS",
        v:"Nothing is holding this piece. Each channel was checked against its own window, not one shared number.",
        tone:"ink" };
  const below = t.scoredBelowFloorButEnabled;
  const skipped = below.length
    ? { k:"NOTHING SKIPPED",
        v: below.join(", ")+(below.length === 1 ? " scores under the floor of " : " score under the floor of ")+t.floor+
           (below.length === 1 ? " and stays on. " : " and stay on. ")+
           "A score never skips a channel here, config/routing.yaml's defaults list decides that on its own.",
        tone:"ink" }
    : { k:"NOTHING SKIPPED",
        v: t.pillarSource === "routing.md"
          ? "No channel scored under the floor of "+t.floor+". A score could not have skipped one anyway, the defaults list decides that."
          : "No score to skip anything on, so every channel below is on and the call is yours.",
        tone:"ink" };
  const traced = cuts.filter(c=>c.sourceLines && c.sourceLines.length);
  const words = traced.length
    ? { k:"YOUR WORDS",
        v:(traced.length === 1
            ? "The cut below carries the source lines it was built from"
            : "All "+traced.length+" cuts below carry the source lines they were built from")+
          ", so every draft is your text, trimmed. Nothing composed.",
        tone:"ink" }
    : { k:"YOUR WORDS",
        v:"No cut here records the lines it came from, so this screen makes no claim about how the drafts were built.",
        tone:"grey" };
  return [pillar, reuse, skipped, words];
}
// ── end of the treatment mirror ──

const CW_STEPS = [["1","Pick a source"],["2","Review the treatment"],["3","Approve the drafts"],["4","Publish"]];
const CW_TAGCLASS = { "SUBSTACK":"substack", "YOURS":"yours", "READ IN":"readin" };
const CONTENT_CONFIG_OPTIONS = {
  treatment: [
    ["cta","CTA"],["viral-rewrite","Viral rewrite"],["platform-framing","Platform-specific framing"],
    ["shorter-version","Shorter version"],["thread","Thread"],["counterpoint","Counterpoint"],
    ["summary","Summary"],["hook-variants","Hook variants"],
  ],
  media: [
    ["static-quote-card","Static quote card"],["animated-quote-card","Animated quote card"],
    ["image","Image"],["image-carousel","Image carousel"],["short-video-script","Short-video script"],
    ["video-caption-package","Video transcript / caption package"],["audiogram","Audiogram / waveform clip"],
  ],
  platform: [
    ["substack","Substack"],["linkedin","LinkedIn"],["x","X"],["bluesky","Bluesky"],["mastodon","Mastodon"],
    ["threads","Threads"],["instagram","Instagram"],["tiktok","TikTok"],["youtube","YouTube"],
  ],
};

function contentRequestOrigin(s){
  const origin = String(s.origin||"").toLowerCase();
  if(origin.includes("fiction")) return "fiction";
  if(origin.includes("charles")) return "charles";
  if(origin.includes("venture")) return "venture";
  return "human-inference";
}
function cwEnsureConfig(){
  const s = cwSession();
  if(!s) return null;
  if(CW.config && CW.config.slug===s.slug) return CW.config;
  const routed = (CW.treat && CW.treat.channels || []).filter(c=>c.decision==="include").map(c=>c.channel);
  const supported = CONTENT_CONFIG_OPTIONS.platform.map(x=>x[0]);
  const platforms = routed.filter(p=>supported.includes(p));
  const defaults = CW.signalDefaults || {};
  const sourceDistribution = CW.treat && CW.treat.distribution || {platforms:[],media:[]};
  const recommended = key => (defaults[key]||[]).filter(x=>x.recommended).map(x=>x.option);
  const treatments = recommended("treatments").filter(x=>CONTENT_CONFIG_OPTIONS.treatment.some(o=>o[0]===x));
  const sourceMedia = (sourceDistribution.media||[]).map(x=>x.option).filter(x=>CONTENT_CONFIG_OPTIONS.media.some(o=>o[0]===x));
  const sourcePlatforms = (sourceDistribution.platforms||[]).map(x=>x.option).filter(x=>supported.includes(x));
  const platformRequiredMedia = (sourceDistribution.platforms||[]).filter(x=>sourcePlatforms.includes(x.option) && x.requiredMedia).map(x=>x.requiredMedia);
  const media = [...new Set([...sourceMedia, ...platformRequiredMedia])];
  const fallbackMedia = recommended("media").filter(x=>CONTENT_CONFIG_OPTIONS.media.some(o=>o[0]===x));
  const defaultPlatforms = recommended("platforms").filter(x=>supported.includes(x));
  CW.config = {
    slug:s.slug,
    treatment:new Set(treatments.length ? treatments : ["summary"]),
    media:new Set(media.length ? media : fallbackMedia),
    platform:new Set(platforms.length ? platforms : sourcePlatforms.length ? sourcePlatforms : defaultPlatforms.length ? defaultPlatforms : ["bluesky"]),
    control:true,
    saving:false,
    saved:false,
  };
  return CW.config;
}
function cwConfigSectionHtml(kind, title, options, s){
  const cfg = cwEnsureConfig();
  const choices = options.map(([id,label])=>{
    const audioOnly = id==="audiogram" && !/audio|podcast/i.test(String(s.sourceKind||""));
    const mappingBlocked = id==="cta";
    const disabled = audioOnly || mappingBlocked;
    const why = mappingBlocked ? "CTA mapping required before this can be selected." : audioOnly ? "Available when the source includes audio." : "";
    return '<label style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" data-config-kind="'+kind+'" value="'+id+'"'+(cfg[kind].has(id)?" checked":"")+(disabled?" disabled":"")+'><span>'+label+(why?'<span class="src" style="display:block">'+why+'</span>':"")+'</span></label>';
  }).join("");
  const model = kind==="treatment" ? engineSelectHtml("contentTreatmentEngine") : "";
  return '<section class="cw-config" style="margin-top:24px;padding-top:20px;border-top:1px solid #efe7d6">'+
    '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><span class="fam-ask">'+title+'</span>'+model+'<span class="grow"></span>'+
    '<button type="button" class="cw-back" data-config-all="'+kind+'">Select all</button><button type="button" class="cw-back" data-config-none="'+kind+'">Deselect all</button></div>'+
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px 18px;margin-top:14px">'+choices+'</div></section>';
}

function cwSources(){ return WB_SESSIONS || []; }
function cwSession(){ return cwSources().filter(s=>s.slug===CW.slug)[0] || null; }
function cwPiece(){ return (DATA.pieces||[]).filter(p=>p.slug===CW.slug)[0] || null; }
function cwRows(){ const p = cwPiece(); return p ? p.rows : []; }
function cwStep(){
  if(!CW.slug) return 1;
  return CW.step > 2 ? 2 : CW.step < 1 ? 1 : CW.step;
}
function cwRail(step){
  if(step === 1){
    const n = cwSources().length;
    return { text: n+" SOURCE"+(n===1?"":"S")+" ON THE DESK", tone: n ? "grey" : "amber" };
  }
  if(step === 2){
    if(CW.treatErr) return { text:"COULD NOT READ THE TREATMENT", tone:"amber" };
    if(!CW.treat) return { text:"READING THE TREATMENT", tone:"grey" };
    const n = CW.treat.channels.length;
    return { text: n+" CHANNEL"+(n===1?"":"S")+" READ FOR THIS PIECE", tone:"grey" };
  }
  const rows = cwRows();
  const total = rows.length;
  const pending = rows.filter(row=>!DECIDED.has(row.status)&&row.status!=="approve").length;
  if(!total) return { text:"NO DRAFTS EXIST FOR THIS PIECE YET", tone:"amber" };
  return pending
    ? { text: pending+" OF "+total+" STILL NEED YOUR YES", tone:"amber" }
    : { text:"ALL "+total+" HAVE YOUR YES", tone:"green" };
}
function cwStepsHtml(step){
  return CW_STEPS.map((sd,i)=>{
    const num = i+1;
    const cls = num===step ? " on" : num<step ? " done" : "";
    const reachable = num===1 || num>=3 || !!CW.slug;
    return '<span style="display:flex;align-items:baseline;gap:9px">'+
      '<button class="cw-step'+cls+'" data-step="'+num+'"'+(reachable?"":" disabled")+'>'+
      '<span class="num">'+sd[0]+'</span><span class="nm">'+esc(sd[1])+'</span></button>'+
      '<span class="cw-sep">'+(i<3?"→":"")+'</span></span>';
  }).join("");
}
// Step 1's line is a pick-aid, not a developer readout: date and the drafts-waiting count are real
// reads Muxin needs to choose between sources. tagBasis (why the tag is what it is, e.g. "source.md
// records source_kind: …") stays out of this line on purpose — it is provenance for a developer,
// not something she needs to pick a source. Never invent a word count or an open count here: the
// prototype shows both, but no read in this repo measures them.
function cwSourceMeta(s){
  const bits = [];
  if(s.date) bits.push("on the desk since "+fmtDay(s.date));
  // published_at is a full ISO timestamp for a Note and a plain date for an essay. Show the day.
  if(s.publishedAt) bits.push("published "+fmtDay(String(s.publishedAt).slice(0,10)));
  if(s.pending) bits.push(s.pending+" draft"+(s.pending===1?"":"s")+" waiting for your yes");
  return bits.join(" · ");
}
function cwStep1Html(){
  const sources = cwSources();
  if(!sources.length){
    return '<div class="empty">Nothing on the desk yet. Start with an idea or source in Studio, then choose Content when it is ready for configuration.</div>';
  }
  const rows = sources.map(s=>{
    const tag = s.tag || "UNTAGGED";
    const cls = CW_TAGCLASS[s.tag] || "untagged";
    const on = s.slug===CW.slug;
    return (on
      ? '<button type="button" class="cw-src on" data-slug="'+esc(s.slug)+'">'
      : '<button type="button" class="cw-src" data-slug="'+esc(s.slug)+'">')+
      '<span class="cw-tag '+cls+'">'+esc(tag)+'</span>'+
      '<span style="min-width:0"><span class="ttl">'+esc(s.title)+'</span>'+
      '<span class="meta">'+esc(cwSourceMeta(s))+'</span></span>'+
      '<span class="src" style="justify-self:end;white-space:nowrap">'+(on?"PICKED":"Make versions")+'</span>'+
      '</button>';
  }).join("");
  return '<div style="margin-top:22px">'+
    '<div class="fam-ask">WHAT YOU CAN MAKE VERSIONS OF</div>'+
    '<div class="src" style="margin-top:6px;max-width:560px">Everything here has a source.md on disk. The tag says where it came from and the line under it says which fact the tag is standing on. Nothing leaves this room until you say yes to each draft.</div>'+
    '<div style="margin-top:16px">'+rows+'</div>'+
    '<div class="src" style="margin-top:16px;max-width:520px">An essay from somewhere else comes in through Studio. Paste the link there and pick "Versions for Content".</div>'+
    '</div>';
}
function cwPickedHtml(s){
  const cls = CW_TAGCLASS[s.tag] || "untagged";
  return '<div class="cw-picked">'+
    '<span style="min-width:0;display:flex;flex-direction:column;gap:6px">'+
    '<span style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">'+
    '<span class="cw-tag '+cls+'">'+esc(s.tag||"UNTAGGED")+'</span>'+
    '<span class="src">'+esc(s.slug)+'</span></span>'+
    '<span style="font:400 20px/1.45 Georgia,serif">'+esc(s.title)+'</span>'+
    '<span class="src">'+esc(cwSourceMeta(s))+'</span></span>'+
    '<button class="cw-back" data-step="1">Pick a different one</button></div>';
}
function cwChannelHtml(c){
  const fit = fitLine(c, CW.treat.floor);
  const reuse = reuseLine(c);
  const fn = floorNote(c, CW.treat.floor);
  const drift = (c.recordedDecision && c.decision && c.recordedDecision !== c.decision)
    ? '<div class="basis t-amber">routing.md on disk records "'+esc(c.recordedDecision)+'" while a fresh routing read says "'+esc(c.decision)+'".</div>'
    : "";
  const routed = c.decision ? "routing: "+c.decision : "not routed";
  return '<div class="cw-chan">'+
    '<div class="top"><span class="nm">'+esc(c.channel)+'</span>'+
    '<span class="fit t-'+fit.tone+'">'+esc(fit.label)+'</span>'+
    '<span style="flex:1"></span><span class="src">'+esc(routed)+'</span></div>'+
    '<div class="basis t-grey">'+esc(fit.basis)+'</div>'+
    (fn?'<div class="basis t-grey">'+esc(fn)+'</div>':"")+
    drift+
    '<div class="reuse t-'+reuse.tone+'">'+esc(reuse.text)+'</div>'+
    '<div class="slot">NEXT FREE SLOT · '+esc(c.slot ? c.slot.label : "")+'</div>'+
    '</div>';
}
function cwAdvisorHtml(s){
  const rounds=(s.rounds||[]).map(r=>'<section style="margin-top:18px"><div class="fam-ask">ADVISOR ROUND '+esc(r.index)+'</div>'+
    (r.replyText?'<div class="src" style="margin-top:6px">You: '+esc(r.replyText)+'</div>':'')+
    r.cards.map(c=>'<div style="margin-top:12px;padding:13px;border:1px solid #e5dcc9;border-radius:8px"><b>'+esc(c.title||c.kind)+'</b><div class="src" style="margin-top:5px">'+esc(c.summary||'')+'</div>'+
      (c.previewText?'<pre style="white-space:pre-wrap;font:14px/1.55 Georgia,serif">'+esc(c.previewText)+'</pre>':'')+
      (c.status==='open'?'<div class="actions"><button data-dev-accept data-card="'+esc(c.id)+'" data-slug="'+esc(s.slug)+'">Accept exact-source cut</button><input class="dev-lens" value="'+esc(c.lens||'')+'" aria-label="Cut name"><button data-dev-dismiss data-card="'+esc(c.id)+'" data-slug="'+esc(s.slug)+'">Dismiss</button></div>':'<div class="src">'+esc(c.status)+'</div>')+'</div>').join('')+'</section>').join('');
  const cuts=(s.cuts||[]).map(c=>'<label style="display:block;margin-top:14px;padding:14px;border:1px solid #ded4bd;border-radius:8px"><input type="radio" name="approvedCut" data-approved-cut value="'+esc(c.lens)+'"'+(CW.approvedLens===c.lens?' checked':'')+'> <b>'+esc(c.title||c.lens)+'</b><span class="src" style="display:block">Exact source '+esc(lineRefsText(c.sourceLines))+'</span><textarea data-cut-body="'+esc(c.lens)+'" rows="6" style="width:100%;margin-top:9px">'+esc(c.body)+'</textarea><div class="actions"><button data-cut-save data-lens="'+esc(c.lens)+'">Save edit</button><input data-cut-comment-text placeholder="Comment on this cut"><input data-cut-comment-line type="number" min="1" value="1" aria-label="Line"><button data-cut-comment data-lens="'+esc(c.lens)+'">Add comment</button></div></label>').join('');
  return cwPickedHtml(s)+'<div class="src" style="margin-top:16px">The advisor conversation is restored from develop/advice.json. Accept builds only from the cited source lines. Pick one approved cut before configuration.</div>'+rounds+
    (!rounds?'<button class="primary" data-dev-start data-slug="'+esc(s.slug)+'" style="margin-top:18px">Ask the advisor</button>':'')+
    '<div style="margin-top:24px"><div class="fam-ask">APPROVED CUTS</div>'+ (cuts||'<div class="empty">Accept an exact-source cut before choosing treatments.</div>')+'</div>'+
    '<div class="wb-reply"><input class="wb-reply-input" placeholder="Reply to the advisor"><button data-dev-reply data-slug="'+esc(s.slug)+'">Reply</button></div>'+
    (CW.approvedLens?'<button class="primary" data-open-config style="margin-top:20px">Configure this approved cut</button>':'');
}
function cwStep2Html(){
  const s = cwSession();
  if(!s) return '<div class="empty">That source is no longer on the desk. Pick another one.</div>';
  // Approved cross-room handoffs already carry their owning room's human approval/context. The
  // advisor/cut gate is for ordinary Muxin-voice Content sources, not a second approval system for
  // Fiction, Charles, or Venture.
  if(contentRequestOrigin(s)!=="human-inference"){ const crossCfg=cwEnsureConfig(); crossCfg.open=true; }
  if(!CW.config || !CW.config.open) return cwAdvisorHtml(s);
  if(CW.treatErr) return cwPickedHtml(s)+'<div class="fam-note t-amber" style="margin-top:16px">Could not read recommendations for this piece: '+esc(CW.treatErr)+'</div>';
  if(!CW.treat || CW.treatFor !== CW.slug) return cwPickedHtml(s)+'<div class="empty">Reading recommendations…</div>';
  const cfg = cwEnsureConfig();
  const dist=CW.treat.distribution||{platforms:[],media:[],mediaRationale:""};
  const platformWhy=(dist.platforms||[]).map(x=>'<div style="margin-top:8px"><b>'+esc(x.option)+'</b><div class="src">'+esc(x.reason)+'</div></div>').join('');
  const mediaWhy=(dist.media||[]).map(x=>'<div style="margin-top:8px"><b>'+esc(x.option)+'</b><div class="src">'+esc(x.reason)+'</div></div>').join('');
  const recommendation = '<details style="margin-top:16px"><summary class="cw-back">Why these platforms and media?</summary><div style="margin-top:8px;max-width:680px">'+platformWhy+(mediaWhy||'<div class="src" style="margin-top:8px">'+esc(dist.mediaRationale||'Text only.')+'</div>')+'<div class="src" style="margin-top:10px">Source fit supplies the cold-start recommendation. Existing routing and measured performance evidence remain stronger when available. Every checkbox remains yours to change.</div></div></details>';
  return cwPickedHtml(s)+
    '<div class="src" style="margin-top:18px;max-width:640px">Choose treatments, media, and platforms independently. Recommendations preselect a starting point; they never remove your control.</div>'+
    cwConfigSectionHtml("treatment","TREATMENTS",CONTENT_CONFIG_OPTIONS.treatment,s)+
    cwConfigSectionHtml("media","MEDIA",CONTENT_CONFIG_OPTIONS.media,s)+
    cwConfigSectionHtml("platform","PLATFORMS",CONTENT_CONFIG_OPTIONS.platform,s)+recommendation+
    '<label style="display:flex;gap:9px;align-items:flex-start;margin-top:22px;padding:14px;background:#faf7f0;border:1px solid #efe7d6;border-radius:8px"><input type="checkbox" id="contentControlEnabled"'+(cfg.control?" checked":"")+'><span><b>Untreated control</b><span class="src" style="display:block">Create one source-preserving control for each selected platform and media combination. You can disable it explicitly.</span></span></label>'+
    '<div class="cw-yesall"><button type="button" class="primary" id="contentConfigSave" data-config-save'+(cfg.saving?" disabled":"")+'>'+(cfg.saving?"Creating drafts…":cfg.saved?"Drafts created":"Save and create drafts")+'</button>'+
    '<span class="src">This stores the request, creates its untreated control and treated drafts, then sends them to Approve Drafts. It does not approve, schedule, or publish anything.</span></div>';
}
function cwStep3Html(){
  return '';
}
// The room opens on exactly one sheet: configuration or grouped review.
function renderContentWizard(){
  $("#contentWizard").hidden = CW.pane !== "wizard";
  $("#reviewSheet").hidden = CW.pane !== "review";
  $("#publishedSheet").hidden = CW.pane !== "published";
  if(CW.pane === "review"){ $("#reviewSteps").innerHTML=cwStepsHtml(3); return; }
  if(CW.pane === "published"){ $("#publishedSteps").innerHTML=cwStepsHtml(4); renderPublished(); return; }
  const step = cwStep();
  $("#cwSteps").innerHTML = cwStepsHtml(step);
  const body = $("#cwBody");
  body.innerHTML = step === 1 ? cwStep1Html() : step === 2 ? cwStep2Html() : cwStep3Html();
  refreshEngineControls(body);
}
// Opened from step 3's "Show every piece's drafts" or from a Studio jump — the cross-piece sweep
// the wizard's own step 3 (per-piece) cannot do.
function openReviewSheet(){
  CW.pane = "review";
  renderContentWizard();
  $("#reviewSheet").scrollIntoView({behavior:"smooth", block:"start"});
}
async function cwLoadTreatment(){
  const slug = CW.slug;
  if(!slug) return;
  CW.loading = true; CW.treatErr = null;
  try {
    const [r, signals] = await Promise.all([
      fetch("/api/content/treatment?slug="+encodeURIComponent(slug)),
      fetch("/api/signals").then(x=>x.json()).catch(()=>null),
    ]);
    const d = await r.json();
    CW.signalDefaults = signals && signals.contentDefaults || null;
    if(d && d.error){ CW.treat = null; CW.treatFor = null; CW.treatErr = d.error; }
    else { CW.treat = d; CW.treatFor = slug; CW.treatErr = null; }
  } catch(e){
    CW.treat = null; CW.treatFor = null; CW.treatErr = String(e && e.message ? e.message : e);
  } finally {
    CW.loading = false;
    if(CW.slug === slug) renderContentWizard();
  }
}
function cwSelectableConfigIds(kind){
  const s = cwSession();
  return CONTENT_CONFIG_OPTIONS[kind].map(x=>x[0]).filter(id=>id!=="cta" && (id!=="audiogram" || /audio|podcast/i.test(String(s&&s.sourceKind||""))));
}
async function cwSaveConfig(){
  const s = cwSession(), cfg = cwEnsureConfig();
  if(!s || !cfg || cfg.saving) return;
  if(!cfg.platform.size){ flash("Choose at least one platform"); return; }
  const engine = $("#contentTreatmentEngine")?.value || "codex";
  cfg.saving = true; renderContentWizard();
  const recommendedPlatforms = (CW.treat && CW.treat.channels || []).filter(c=>c.decision==="include").map(c=>c.channel);
  const signalEvidence = ["treatments","media","platforms"].flatMap(key=>(CW.signalDefaults&&CW.signalDefaults[key]||[]).filter(x=>x.recommended).map(x=>({
    option:x.option, kind:key==="treatments"?"treatment":key==="platforms"?"platform":"media",
    reason:x.explanation, source:x.source, recommended:true,
  })));
  const distributionEvidence = [
    ...((CW.treat&&CW.treat.distribution&&CW.treat.distribution.platforms)||[]).map(x=>({option:x.option,kind:"platform",reason:x.reason,source:"source-fit",recommended:true})),
    ...((CW.treat&&CW.treat.distribution&&CW.treat.distribution.media)||[]).map(x=>({option:x.option,kind:"media",reason:x.reason,source:"source-fit",recommended:true})),
  ];
  const evidence = [
    ...distributionEvidence,
    ...signalEvidence,
    ...recommendedPlatforms.map(option=>({option,kind:"platform",reason:"Current routing includes this platform",source:"routing",recommended:true})),
  ];
  const origin = contentRequestOrigin(s);
  const request = {
    id:s.slug, origin, descriptor:s.title, originalInput:((s.cuts||[]).find(c=>c.lens===CW.approvedLens)||{}).body||s.sourceBody,
    treatments:[...cfg.treatment], media:[...cfg.media], platforms:[...cfg.platform],
    recommendationEvidence:evidence, includeUntreatedControl:cfg.control,
    ventureId:origin==="fiction" ? "least-of-us-fiction" : null,
    sourceProvenance:(()=>{ const cut=(s.cuts||[]).find(c=>c.lens===CW.approvedLens); return cut?{kind:"approved-cut",lens:cut.lens,sourceLines:cut.sourceLines}:null; })(),
  };
  try{
    const result = await post("/api/content/request", {slug:s.slug, request});
    if(!result.ok) throw new Error(result.error||"Could not save configuration");
    const generated = await post("/api/content/generate", {slug:s.slug, engine});
    if(!generated.ok) throw new Error("Configuration saved, but drafts were not created: "+(generated.error||"generation failed"));
    cfg.saved = true; CW.step=3; CW.pane="review"; flash(generated.ids.length+" configured drafts created"); await load(); await loadContent();
  }catch(e){ flash(e instanceof Error?e.message:String(e)); }
  finally{ cfg.saving = false; renderContentWizard(); }
}
// Delegated: the wizard is rebuilt wholesale on every render.
$("#contentWizard").addEventListener("click", (e)=>{
  const t = e.target.closest ? e.target.closest("[data-step],[data-slug],[data-set-pane],[data-config-all],[data-config-none],[data-config-save],[data-dev-start],[data-dev-reply],[data-dev-accept],[data-dev-dismiss],[data-cut-save],[data-cut-comment],[data-open-config]") : null;
  if(!t) return;
  if(t.dataset.openConfig!==undefined){ const cfg=cwEnsureConfig(); cfg.open=true; renderContentWizard(); cwLoadTreatment(); return; }
  if(t.dataset.devStart!==undefined){ t.disabled=true; post('/api/develop/start',{slug:t.dataset.slug,engine:$('#studioEngine').value}).then(r=>{flash(r.ok?'Advisor started':r.error);loadJobs();}); return; }
  if(t.dataset.devReply!==undefined){ const input=t.closest('.wb-reply').querySelector('.wb-reply-input'); const reply=input.value.trim(); if(!reply){flash('Type a reply first');return;} t.disabled=true; post('/api/develop/reply',{slug:t.dataset.slug,reply,engine:$('#studioEngine').value}).then(r=>{flash(r.ok?'Reply queued':r.error);loadJobs();}); return; }
  if(t.dataset.devAccept!==undefined){ const lens=t.closest('.actions').querySelector('.dev-lens').value.trim(); post('/api/develop/accept',{slug:t.dataset.slug,cardId:t.dataset.card,lens}).then(async r=>{flash(r.ok?'Exact-source cut accepted':r.error);if(r.ok){CW.approvedLens=r.lens;await loadContent();}}); return; }
  if(t.dataset.devDismiss!==undefined){ post('/api/develop/dismiss',{slug:t.dataset.slug,cardId:t.dataset.card}).then(async r=>{flash(r.ok?'Dismissed':r.error);if(r.ok)await loadContent();}); return; }
  if(t.dataset.cutSave!==undefined){ const ta=t.closest('label').querySelector('[data-cut-body]'); post('/api/cut-save',{slug:CW.slug,lens:t.dataset.lens,body:ta.value}).then(async r=>{flash(r.ok?'Cut saved':r.error);if(r.ok)await loadContent();}); return; }
  if(t.dataset.cutComment!==undefined){ const row=t.closest('label'), text=row.querySelector('[data-cut-comment-text]').value, line=row.querySelector('[data-cut-comment-line]').value; post('/api/cut-comment',{slug:CW.slug,lens:t.dataset.lens,text,line}).then(r=>flash(r.ok?'Comment saved':r.error)); return; }
  if(t.dataset.configSave !== undefined){ cwSaveConfig(); return; }
  if(t.dataset.configAll !== undefined || t.dataset.configNone !== undefined){
    const kind = t.dataset.configAll !== undefined ? t.dataset.configAll : t.dataset.configNone;
    const cfg = cwEnsureConfig();
    cfg[kind] = new Set(t.dataset.configAll !== undefined ? cwSelectableConfigIds(kind) : []);
    cfg.saved = false; renderContentWizard(); return;
  }
  if(t.dataset.setPane !== undefined){
    CW.pane = t.dataset.setPane;
    renderContentWizard();
    return;
  }
  if(t.dataset.slug !== undefined){
    CW.slug = t.dataset.slug; CW.step = 2; CW.tab = null; CW.treat = null; CW.treatFor = null; CW.treatErr = null; CW.yesErrors = []; CW.pane = "wizard"; CW.config = null; CW.approvedLens=null;
    renderContentWizard(); return;
  }
  if(t.dataset.step !== undefined){
    const n = Number(t.dataset.step);
    if(n > 1 && !CW.slug) return;
    if(n === 3){ CW.pane = "review"; renderContentWizard(); return; }
    if(n === 4){ CW.pane = "published"; renderContentWizard(); return; }
    CW.step = n; CW.yesErrors = []; CW.pane = "wizard";
    renderContentWizard();
    if(n === 2 && CW.slug && CW.treatFor !== CW.slug) cwLoadTreatment();
  }
});
$("#contentWizard").addEventListener("change", (e)=>{
  const target = e.target, cfg = cwEnsureConfig();
  if(target&&target.dataset&&target.dataset.approvedCut!==undefined){ CW.approvedLens=target.value; renderContentWizard(); return; }
  if(!cfg || !target) return;
  if(target.id==="contentControlEnabled"){ cfg.control = !!target.checked; cfg.saved = false; return; }
  const kind = target.dataset && target.dataset.configKind;
  if(!kind) return;
  if(target.checked) cfg[kind].add(target.value); else cfg[kind].delete(target.value);
  cfg.saved = false;
});

// "Draft it": her typed direction rides into THIS run's prompt via POST /api/outreach/draft. It
// wins over the stored pitch angle where they disagree. Iterating on the result is a different
// button ("Update it"), and it reuses the revise path that already existed.
async function outreachDraft(dir, btn, engine){
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
    const r = await post("/api/outreach/draft", outreachDraftRequest(dir, direction, recipient, engine));
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

// ── Fiction room (Content Studio Riff 3f, rebuilt for v7 §2) ──
// The composer, her beats kept as the anchor, the drafted scene, and the canon rail that says what
// holds and what breaks. Her words are Georgia in the ink colour; the drafted prose is AI-written
// and carries the purple. canon.md is still append-only (story:lock owns it) and renders read-only,
// and a chapter is never editable here: the only write into one is the scoped span patch behind
// "Fix the line". Nothing in this room approves, locks or publishes a chapter. Line editing and the
// commit history stay in the GitHub /story flow.
let FICTION = null;
let ficSeries = null;
let ficDocPath = null;
let ficDocData = null;
let ficScene = null;      // { beats, chapter, continuity } from /api/fiction/scene
let ficPassNote = "";
let ficFixed = {};        // spans fixed in this session, so the rail says "fixed" until the next check
let ficPage = "write";
let ficPromoRequest = "";
let ficPromoObjective = "Invite readers into the series with a spoiler-light chapter preview.";
let ficPromoChapter = null;
let ficPromoDraft = null;
let ficPromoBusy = false;
let ficPromoError = "";
// ── Venture room ────────────────────────────────────────────────────────────────────────────────
//
// The thread is read-only except for explicit, server-gated controls: the selected-engine analysis
// read and one validated draft-step enqueue. Neither control selects, approves, publishes, or
// advances a phase; the thread continues to render the server's human gates.
//
// Almost nothing is computed here. src/review/venture-thread.ts already derived the whole view
// model server-side; this walks it and writes markup. The two exceptions are the mirrors below.
//
// VEN.pane picks one focused stage instead of stacking the whole venture on one page.
// the venture thread) or "intake" (the voice/scorecard guardrails). Exactly one shows at a time.
// The Start-a-venture interview is a separate overlay on the thread pane, same as before.
let VEN = { pane: "work" };
function renderVentureSheets(){
  $("#ventureMainSheet").hidden = false;
  $("#ventureWorkPane").hidden = VEN.pane !== "work";
  $("#ventureDocumentsPane").hidden = VEN.pane !== "documents";
  $("#ventureHistoryPane").hidden = VEN.pane !== "history";
  $("#ventureIntakePane").hidden = VEN.pane !== "intake";
  document.querySelectorAll(".venture-stage").forEach(b=>b.classList.toggle("on", b.dataset.setVenPane===VEN.pane));
}
let VENTURE_SLUGS = [];
let ventureSlug = null;
let VENTURE_THREAD = null;
let VENTURE_SIGNALS = null;
let VENTURE_LEARNING_EVALUATIONS = [];
let VENTURE_LEARNING_SOURCES = [];
let VENTURE_RESPONSE_EVALUATE_ID = null;
let VENTURE_SUMMARIES = {};
let VENTURE_DOCUMENTS = [];
let ventureDocument = null;
let ventureAnalysisPending = false;
let ventureRunStepPending = false;
const INTAKE_FIELDS = {
  voice: ["writing_samples", "worldview_statement", "natural_phrases", "refused_phrases_tones"],
  scorecard: ["required_live_posts", "ongoing_pace", "views_or_clicks_target", "opt_in_target", "response_quality_test", "sustainability_test"],
};
const INTAKE_LABELS = {
  writing_samples:"Writing samples", worldview_statement:"Worldview statement", natural_phrases:"Natural phrases", refused_phrases_tones:"Refused phrases or tones",
  required_live_posts:"Required live posts", ongoing_pace:"Ongoing pace", views_or_clicks_target:"Views or clicks target", opt_in_target:"Opt-in target",
  response_quality_test:"Response-quality test", sustainability_test:"Sustainability test",
};
let VENTURE_INTAKE = {voice:{}, scorecard:{}};
const intakeTimers = new Map();
function intakeKey(section, field){ return section+":"+field; }
function intakeValue(section, field){
  const value = VENTURE_INTAKE[section] && VENTURE_INTAKE[section][field];
  return value && typeof value === "object" ? String(value.text || "") : String(value || "");
}
function renderVentureIntake(){
  const box = $("#ventureIntakeSections");
  if(!box) return;
  // Pane chrome and save hint live on #ventureIntakePane. This only fills fields.
  const body = Object.entries(INTAKE_FIELDS).map(([section, fields])=>
    '<div style="margin-top:18px"><div class="wb-label">'+esc(section==="voice"?"Voice":"Scorecard")+'</div>'+
    '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:8px">'+fields.map(field=>{
      const key = intakeKey(section, field);
      return '<label style="display:flex;flex-direction:column;gap:5px;font-size:12px;color:#5a5346"><span>'+esc(INTAKE_LABELS[field]||field)+' <span data-intake-state="'+esc(key)+'" style="font:10px ui-monospace,monospace;color:#a89a80">saved</span></span>'+
        '<textarea data-intake-section="'+esc(section)+'" data-intake-field="'+esc(field)+'" rows="3" placeholder="Add a durable guardrail for this section" style="width:100%;box-sizing:border-box;resize:vertical;border:1px solid #e0d6c0;border-radius:7px;padding:9px 10px;background:#fffdf8;font:14px/1.5 Georgia,serif">'+esc(intakeValue(section, field))+'</textarea></label>';
    }).join('')+'</div></div>'
  ).join('');
  box.innerHTML = body;
  box.querySelectorAll("textarea[data-intake-section]").forEach(ta=>ta.addEventListener("input",()=>{
    const section=ta.dataset.intakeSection, field=ta.dataset.intakeField, key=intakeKey(section,field);
    VENTURE_INTAKE[section][field] = ta.value;
    const state=box.querySelector('[data-intake-state="'+key+'"]');
    if(state) state.textContent = "saving…";
    clearTimeout(intakeTimers.get(key));
    const slug = ventureSlug;
    intakeTimers.set(key, setTimeout(()=>{
      intakeTimers.delete(key);
      if(ventureSlug === slug) saveVentureIntakeField(slug, section, field, ta.value);
    }, 500));
  }));
}
async function loadVentureIntakeSections(slug = ventureSlug){
  const box=$("#ventureIntakeSections");
  if(!box || !slug) return;
  try {
    const r=await fetch("/api/venture/"+encodeURIComponent(slug)+"/intake/sections");
    const j=await r.json();
    if(!r.ok || !j.ok) throw new Error(j.error||"could not load intake guardrails");
    if(slug !== ventureSlug) return;
    VENTURE_INTAKE={voice:{...(j.sections&&j.sections.voice||{})},scorecard:{...(j.sections&&j.sections.scorecard||{})}};
    renderVentureIntake();
  } catch(e) {
    if(slug !== ventureSlug) return;
    box.innerHTML='<div class="load-error" role="alert"><strong>Could not load intake guardrails.</strong><div>Check your connection, then try again. Your saved answers are unchanged.</div><button type="button" id="ventureIntakeRetry">Try again</button></div>';
    $("#ventureIntakeRetry")?.addEventListener("click", ()=>loadVentureIntakeSections(slug));
  }
}
async function saveVentureIntakeField(slug, section, field, text){
  const key=intakeKey(section,field);
  const state=$("#ventureIntakeSections [data-intake-state=\\""+key+"\\"]");
  try {
    const r=await post("/api/venture/"+encodeURIComponent(slug)+"/intake/section",{section,field,text});
    if(slug !== ventureSlug) return;
    if(r.ok){ if(state) state.textContent="saved"; }
    else { if(state) state.textContent="not saved"; flash(r.error||"This intake field was not saved. Try again"); }
  } catch(e) {
    if(slug !== ventureSlug) return;
    if(state) state.textContent="not saved";
    flash("This intake field was not saved. Check your connection and try again");
  }
}

// Rule 5 mirrors of ventureDotColor / ventureDayLine in page.ts. Change one, change both.
function vDot(tone){
  if (tone === "green") return "#2f7d46";
  if (tone === "amber") return "#9a6b12";
  if (tone === "red") return "#9a2f2f";
  if (tone === "blue") return "#2f5d9a";
  return "#b0a488";
}
function vDayLine(elapsedDays){
  if (elapsedDays === null || elapsedDays === undefined) return "";
  return elapsedDays === 0 ? "started today" : "day " + (elapsedDays + 1) + " since kickoff";
}

async function loadVentureList(){
  const r = await fetch("/api/venture/list");
  const j = await r.json();
  VENTURE_SLUGS = (j.ventures || []).filter(slug=>SHOW_TEST_VENTURES || !/^(?:e2e-|zz-test-)/.test(slug));
  if(!VENTURE_SLUGS.length){
    ventureSlug = null;
    $("#ventureEngine").disabled = true;
    $("#ventureAnalyzeBtn").disabled = true;
    $("#ventureRunStepBtn").disabled = true;
    $("#ventureAnalysisPanel").hidden = true;
    $("#ventureDay").textContent = "";
    $("#ventureIntakeSections").innerHTML = '<div class="empty" style="padding:18px 0">Start or choose a venture to edit its durable voice and scorecard fields.</div>';
    $("#ventureThread").innerHTML = '<div class="empty">No venture on the desk yet. "Start a venture" above runs the whole intake interview here: 25 questions, one at a time.</div>';
    $("#ventureRail").innerHTML = "";
    renderVentureSwitcher(); renderVentureDocuments();
    return;
  }
  $("#ventureEngine").disabled = false;
  $("#ventureAnalyzeBtn").disabled = false;
  $("#ventureRunStepBtn").disabled = false;
  if(!ventureSlug || !VENTURE_SLUGS.includes(ventureSlug)) ventureSlug = VENTURE_SLUGS[0];
  renderVentureSwitcher();
  Promise.all(VENTURE_SLUGS.map(async slug=>{
    try { const r=await fetch("/api/venture/"+encodeURIComponent(slug)+"/thread"); const j=await r.json(); if(r.ok&&j.ok) VENTURE_SUMMARIES[slug]=j.thread; } catch(e){}
  })).then(renderVentureSwitcher);
  await loadVenture();
}
function renderVentureSwitcher(){
  const box=$("#ventureSelect");
  if(!box) return;
  box.innerHTML=(VENTURE_SLUGS.length ? VENTURE_SLUGS.map(slug=>{
    const summary=VENTURE_SUMMARIES[slug];
    const phase=summary && summary.phase ? "Phase "+summary.phase : "";
    return '<option value="'+esc(slug)+'"'+(slug===ventureSlug?' selected':'')+'>'+esc(slug)+(phase?' · '+esc(phase):'')+'</option>';
  }).join('') : '<option value="" disabled selected>No ventures yet</option>')+
    '<option value="__example__"'+(ventureSlug==='__example__'?' selected':'')+'>Example venture · guided walkthrough</option>';
}
function renderVentureDocuments(){
  const box=$("#ventureDocuments"); if(!box) return;
  box.innerHTML='<div class="vmono" style="margin-top:22px">CANONICAL DOCUMENTS</div><div class="vnote" style="font-size:11px;margin-top:4px">Opened from the venture files on disk.</div>'+
    (VENTURE_DOCUMENTS.length ? '<div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">'+VENTURE_DOCUMENTS.map(d=>
      '<button type="button" data-venture-document="'+esc(d.id)+'" class="lead-chip"'+(d.state==="missing"||d.state==="unavailable"?' disabled':'')+' style="text-align:left;display:flex;flex-direction:column"><span>'+esc(d.title)+'</span><span class="from">Phase '+esc(d.phase)+' · '+esc(d.state)+' · '+esc(d.path)+(d.state==="unavailable"&&d.error?' · unavailable: '+esc(d.error):'')+'</span></button>'
    ).join('')+'</div>' : '<div class="vnote" style="margin-top:9px">No document index is available for this venture yet.</div>');
  const reader=$("#ventureDocumentReader");
  if(!ventureDocument){ reader.hidden=true; reader.innerHTML=""; return; }
  reader.hidden=false;
  reader.innerHTML='<div style="margin-top:20px;padding-top:14px;border-top:1px solid var(--line)"><div class="vtitle" style="font-size:15px">'+esc(ventureDocument.title)+'</div><div class="from">Phase '+esc(ventureDocument.phase)+' · '+esc(ventureDocument.path)+' · '+esc(ventureDocument.state)+'</div><div class="md" style="margin-top:10px;max-height:360px;overflow:auto">'+(ventureDocument.content===null?'<p>This document is missing on disk.</p>':ventureDocument.content.trim()?mdToHtml(ventureDocument.content):'<p>This document exists but is empty.</p>')+'</div></div>';
}
async function loadVentureDocuments(){
  const slug=ventureSlug;
  VENTURE_DOCUMENTS=[]; ventureDocument=null; renderVentureDocuments();
  if(!slug) return;
  try { const r=await fetch("/api/venture/"+encodeURIComponent(slug)+"/documents"); const j=await r.json(); if(!r.ok) throw new Error(j.error||"could not read documents"); if(slug!==ventureSlug) return; VENTURE_DOCUMENTS=j.documents||[]; }
  catch(e){ VENTURE_DOCUMENTS=[]; }
  renderVentureDocuments();
}
async function openVentureDocument(id){
  const slug=ventureSlug;
  const r=await fetch("/api/venture/"+encodeURIComponent(slug)+"/documents/"+encodeURIComponent(id));
  const j=await r.json();
  if(!r.ok||!j.ok){ flash(j.error||"Could not open that document"); return; }
  if(slug!==ventureSlug) return;
  ventureDocument=j.document; renderVentureDocuments();
}
async function loadVenture(){
  if(!ventureSlug) return loadVentureList();
  const requestedSlug = ventureSlug;
  showRoomLoading("ventureThread");
  try {
    const [r, signalsResponse, learningResponse, sourceResponse] = await Promise.all([fetch("/api/venture/"+encodeURIComponent(requestedSlug)+"/thread"), fetch("/api/signals").catch(()=>null), fetch("/api/venture/"+encodeURIComponent(requestedSlug)+"/learning-evaluations").catch(()=>null), fetch("/api/venture/"+encodeURIComponent(requestedSlug)+"/learning-sources").catch(()=>null)]);
    if(!r.ok) throw new Error("venture "+r.status);
    const j = await r.json();
    if(requestedSlug !== ventureSlug){ hideRoomLoading("ventureThread"); return; }
    if(!j.ok) throw new Error(j.error || "could not read this venture");
    VENTURE_THREAD = j.thread;
    VENTURE_SIGNALS = signalsResponse&&signalsResponse.ok ? await signalsResponse.json() : null;
    const learning = learningResponse&&learningResponse.ok ? await learningResponse.json() : null;
    VENTURE_LEARNING_EVALUATIONS = learning&&Array.isArray(learning.evaluations) ? learning.evaluations : [];
    const sourceData = sourceResponse&&sourceResponse.ok ? await sourceResponse.json() : null;
    VENTURE_LEARNING_SOURCES = sourceData&&Array.isArray(sourceData.sources) ? sourceData.sources : [];
    VENTURE_SUMMARIES[requestedSlug] = j.thread;
    $("#ventureRunStepBtn").disabled = false;
    renderVenture();
    renderVentureSwitcher();
    hideRoomLoading("ventureThread");
    await Promise.all([loadVentureIntakeSections(requestedSlug), loadVentureDocuments()]);
    connectionRecovered();
  } catch(e) {
    hideRoomLoading("ventureThread");
    $("#ventureThread").innerHTML = '<div class="load-error" role="alert"><strong>Could not load Venture.</strong><div>Your existing venture files are unchanged. Check the server, then try again.</div><button type="button" id="ventureRetry">Try again</button></div>';
    $("#ventureRetry")?.addEventListener("click", loadVenture);
    connectionState("Content Studio could not load Venture. Your existing files are unchanged.");
  }
}
async function analyzeVenture(){
  if(!ventureSlug || ventureAnalysisPending) return;
  const engine = $("#ventureEngine").value;
  ventureAnalysisPending = true;
  $("#ventureAnalyzeBtn").disabled = true;
  $("#ventureAnalysisPanel").hidden = false;
  $("#ventureAnalysisEngine").textContent = engineLabel(engine);
  $("#ventureAnalysisOut").innerHTML = '<p class="thinking">'+esc(engineLabel(engine))+' is reading the current venture state. The room strip carries the live clock.</p>';
  try {
    const r = await post("/api/venture/"+encodeURIComponent(ventureSlug)+"/analyze", {engine});
    if(r.ok){
      $("#ventureAnalysisEngine").textContent = "analyst · "+engineLabel(r.engine || engine);
      $("#ventureAnalysisOut").innerHTML = mdToHtml(r.analysis || "No advice returned.");
    } else {
      $("#ventureAnalysisOut").innerHTML = '<p>Failed: '+esc(r.error||"error")+'</p>';
    }
  } catch(e) {
    $("#ventureAnalysisOut").innerHTML = '<p>Failed: '+esc(e instanceof Error ? e.message : String(e))+'</p>';
  } finally {
    ventureAnalysisPending = false;
    $("#ventureAnalyzeBtn").disabled = !ventureSlug;
  }
}
$("#ventureAnalyzeBtn").addEventListener("click", analyzeVenture);
async function runVentureStep(){
  if(!ventureSlug || !VENTURE_THREAD || ventureRunStepPending) return;
  const engine = $("#ventureEngine").value;
  ventureRunStepPending = true;
  $("#ventureRunStepBtn").disabled = true;
  $("#ventureRunStepBtn").textContent = "Queueing draft step…";
  try {
    const r = await post("/api/venture/"+encodeURIComponent(ventureSlug)+"/run-step", {engine, phase:VENTURE_THREAD.phase});
    if(r.ok){
      flash("Draft step queued with "+engineLabel(r.engine || engine)+"; it stops at the next human gate");
      await loadVenture();
      loadJobs();
    } else flash(r.error || "Could not queue the draft step");
  } catch(e) {
    flash(e instanceof Error ? e.message : String(e));
  } finally {
    ventureRunStepPending = false;
    $("#ventureRunStepBtn").disabled = !ventureSlug;
    $("#ventureRunStepBtn").textContent = "Run the next draft step";
  }
}
$("#ventureRunStepBtn").addEventListener("click", runVentureStep);
// ── writes ───────────────────────────────────────────────────────────────────────────────────────
//
// Two rules, and everything below follows from them.
//
// 1. REFETCH THE WHOLE THREAD after every successful write; never patch a panel from a response.
//    One write moves several panels at once -- approving an artifact changes its card, moves the
//    checkpoint's completion count, and can append a canon receipt. Patching one of them would put
//    a fresh card beside a stale checkpoint stamp: a half-updated state presented as a whole one.
//    Rebuilding from /thread makes that unrepresentable, which is why the eight fine-grained read
//    routes were folded away.
//
// 2. THE CLIENT NEVER AUTHORIZES. selectWithOverride refuses a blank override reason,
//    confirmManualDelivery refuses a below-floor proof and names what to bring instead,
//    clearCheckpoint refuses a partial pass with its reason, transitionArtifact refuses an illegal
//    pair. Where the UI raises a field early or starts a button disabled, that is a MIRROR of the
//    server rule for her convenience -- never a replacement, and never allowed to hide a refusal.
//    Every refusal renders verbatim, next to the control that caused it.
let ventureBusy = false;
// Which control is showing a form or an error, so a rerender does not lose it. Cleared on success.
let ventureOpen = null; // { key, kind, value, error }

function vOpen(key, kind, value){ ventureOpen = { key, kind, value: value || "", error: "" }; renderVenture(); }
function vClose(){ ventureOpen = null; renderVenture(); }
function vErr(msg){ if(ventureOpen) ventureOpen.error = msg; renderVenture(); }

// One write. On success: toast, drop any open form, refetch the whole thread. On refusal: keep the
// form open and show the server's own sentence under it, because that sentence is the useful part.
async function ventureWrite(path, body, okMsg, key){
  if(ventureBusy) return false;
  ventureBusy = true;
  try {
    const r = await fetch("/api/venture/"+encodeURIComponent(ventureSlug)+path, {
      method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify(body||{})
    });
    let j; try { j = await r.json(); } catch(e) { j = { ok:false, error: "the server answered "+r.status }; }
    if(!j.ok){
      if(ventureOpen && ventureOpen.key === key) ventureOpen.error = j.error || "refused";
      else ventureOpen = { key, kind:"error", value:"", error: j.error || "refused" };
      ventureBusy = false;
      renderVenture();
      return false;
    }
    ventureOpen = null;
    ventureBusy = false;
    $("#ventureAnalysisPanel").hidden = true;
    await loadVenture();
    if(okMsg) flash(okMsg);
    return j;
  } catch(e){
    ventureBusy = false;
    if(ventureOpen) ventureOpen.error = String(e && e.message || e);
    renderVenture();
    return false;
  }
}

function vCardAction(artifactId, action){
  const key = "card:"+artifactId+":"+action.id;
  if(action.id === "edit") return vOpenEditor(artifactId);
  if(action.id === "confirm-live") return vOpen(key, "confirm:"+action.proof, "");
  if(action.id === "failed") return vOpen(key, "failed", "");
  if(action.id === "retract") return vOpen(key, "retract", "");
  if(action.destructive && !confirm(action.label + ": " + artifactId + "?")) return;
  ventureWrite("/artifacts/"+encodeURIComponent(artifactId)+"/"+action.id, {}, (action.label+": done"), key);
}

// The reason field the override discipline raises. Rendered from the server's own
// recommended_candidate_ids (via choice.items[].recommended), never from source order: an empty
// recommendation set makes every option an override, which is exactly how selectWithOverride
// treats it, and the prototype got both of those wrong.
// Opening the editor is a READ first: the body lives in a file the thread deliberately does not
// inline, so it is fetched when she asks for it and not before. The box never opens empty and
// hopeful -- until the read lands, the slot says it is reading, because an empty editor and an
// empty document look identical and one of them saves over a draft.
async function vOpenEditor(artifactId){
  const key = "card:"+artifactId+":edit";
  vOpen(key, "editloading", "");
  try {
    const r = await fetch("/api/venture/"+encodeURIComponent(ventureSlug)+"/artifacts/"+encodeURIComponent(artifactId)+"/body");
    const j = await r.json();
    if(!ventureOpen || ventureOpen.key !== key) return;   // she moved on while it was loading
    if(!j.ok){ ventureOpen.kind = "error"; return vErr(j.error || "could not read the file"); }
    ventureOpen.kind = "editing";
    ventureOpen.value = j.body || "";
    renderVenture();
  } catch(e){
    if(ventureOpen && ventureOpen.key === key){ ventureOpen.kind = "error"; vErr(String(e && e.message || e)); }
  }
}
function vSaveBody(artifactId, text){
  // NOT blocked here when empty. editArtifactBody refuses it and says what to do instead ("discard
  // it instead"), and that sentence is better than anything this layer would invent.
  ventureWrite("/artifacts/"+encodeURIComponent(artifactId)+"/edit", { body: text },
    "Saved. They are your words now.", "card:"+artifactId+":edit");
}

function vNeedsReason(choice, item){
  if(choice.reasonAlwaysRequired) return true;
  return !!choice.overrideDiscipline && !item.recommended;
}
function vPick(choice, item){
  const key = "choice:"+choice.decisionId+":"+item.candidateId;
  if(vNeedsReason(choice, item)){
    vOpen(key, "reason", "");
    ventureOpen.reasonAlways = !!choice.reasonAlwaysRequired;
    return renderVenture();
  }
  ventureWrite("/decisions/"+encodeURIComponent(choice.decisionId)+"/select", { candidateIds:[item.candidateId] }, "Recorded in canon", key);
}
function vSubmitReason(choice, item){
  const key = "choice:"+choice.decisionId+":"+item.candidateId;
  const text = (ventureOpen && ventureOpen.value || "").trim();
  // Deliberately NOT blocked here when empty: selectWithOverride owns that refusal and its wording
  // is better than anything this layer would invent. Sending it through is how she sees it.
  const body = { candidateIds:[item.candidateId] };
  if(choice.reasonAlwaysRequired) body.rationale = text; else body.overrideReason = text;
  ventureWrite("/decisions/"+encodeURIComponent(choice.decisionId)+"/select", body, "Recorded in canon", key);
}

function ventureMultiPickIds(requiredCount, selectedIds, candidateId){
  const current = [...new Set(selectedIds)];
  if(current.includes(candidateId)) return current.filter(id=>id!==candidateId);
  return current.length >= requiredCount ? current : [...current, candidateId];
}
function vMultiSelection(choice){
  const key = "choice:"+choice.decisionId+":multi";
  return ventureOpen && ventureOpen.key === key && Array.isArray(ventureOpen.candidateIds)
    ? ventureOpen.candidateIds : [];
}
function vMultiToggle(choice, item){
  const key = "choice:"+choice.decisionId+":multi";
  const ids = ventureMultiPickIds(choice.requiredCount, vMultiSelection(choice), item.candidateId);
  ventureOpen = { key, kind:"multi", value:"", error:"", candidateIds:ids };
  renderVenture();
}
function vMultiSubmit(choice){
  const key = "choice:"+choice.decisionId+":multi";
  const ids = vMultiSelection(choice);
  if(ids.length !== choice.requiredCount) return;
  const selected = choice.items.filter(item=>ids.includes(item.candidateId));
  const needsReason = choice.reasonAlwaysRequired ||
    (choice.overrideDiscipline && selected.some(item=>!item.recommended));
  if(needsReason){
    ventureOpen = { key, kind:"multi-reason", value:"", error:"", candidateIds:ids,
      reasonAlwaysRequired:!!choice.reasonAlwaysRequired };
    renderVenture();
    return;
  }
  ventureWrite("/decisions/"+encodeURIComponent(choice.decisionId)+"/select", { candidateIds:ids }, "Recorded in canon", key);
}
function vSubmitMultiReason(choice){
  const key = "choice:"+choice.decisionId+":multi";
  const ids = ventureOpen && Array.isArray(ventureOpen.candidateIds) ? ventureOpen.candidateIds : [];
  const text = (ventureOpen && ventureOpen.value || "").trim();
  const body = { candidateIds:ids };
  if(choice.reasonAlwaysRequired) body.rationale = text; else body.overrideReason = text;
  ventureWrite("/decisions/"+encodeURIComponent(choice.decisionId)+"/select", body, "Recorded in canon", key);
}

// The response form's own open/submit pair, kept next to the other writes rather than inside the
// listener so the state it carries is visible in one place.
//
// THE COUNT IS NEVER MOVED FROM HERE. What lands on screen after a successful write is the gate the
// SERVER just computed and then, on the refetch, the gate it computes again from the log. This
// screen has no arithmetic of its own about who counts, which is the only way "20 of 30" can be
// trusted to mean what ingestResponse decided rather than what a form hoped.
const V_RESPONSE_FIELDS = ["source","received_at","exact_quote","redacted_quote","stuck_point","desired_outcome",
  "emotional_intensity","target_audience_eligible","id_platform","id_value","exclusion_reason"];
// The browser's own clock, and the only thing it is used for: pre-filling a box she can change.
// Nothing derives a stored date from it.
function vToday(){ const d = new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function vOpenResponse(){
  ventureOpen = { key:"gate:response", kind:"response", value:"", error:"", fields:{} };
  renderVenture();
}
// Read every box back out of the DOM before anything can rebuild it. A refusal re-renders the form,
// so a value not captured here is a value she has to type again.
function vCaptureResponse(){
  const f = {};
  for(const k of V_RESPONSE_FIELDS){ const el = $("#vr-"+k); f[k] = el ? el.value : ""; }
  if(ventureOpen) ventureOpen.fields = f;
  return f;
}
function vSubmitResponse(){
  const f = vCaptureResponse();
  const body = {
    source: f.source,
    received_at: f.received_at,
    exact_quote: f.exact_quote,
    redacted_quote: f.redacted_quote,
    stuck_point: f.stuck_point,
    desired_outcome: f.desired_outcome,
    emotional_intensity: f.emotional_intensity,
    exclusion_reason: f.exclusion_reason
  };
  // Sent ONLY when she actually answered. An unanswered dropdown must reach the server as absent so
  // its refusal is what she reads, rather than this layer picking a side and moving the count.
  if(f.target_audience_eligible === "yes") body.target_audience_eligible = true;
  else if(f.target_audience_eligible === "no") body.target_audience_eligible = false;
  if(f.id_platform || f.id_value) body.raw_identifier = { platform: f.id_platform, stable_user_id: f.id_value };
  ventureWrite("/responses", body, "", "gate:response").then(res=>{
    if(!res) return;
    const g = res.gate || {};
    // The server's own counts, said back plainly. It deliberately does NOT say "+1": an ineligible
    // response, or a second one from someone already counted, moves nothing, and the sentence has
    // to be able to report that honestly.
    const counted = (typeof g.have === "number" && typeof g.need === "number")
      ? " " + g.have + " of " + g.need + " people count toward the goal."
      : "";
    if(res.response_id) VENTURE_RESPONSE_EVALUATE_ID = res.response_id;
    renderVenture();
    flash((res.likely_duplicate
      ? "Written down. Same identifier as one already in the log, so they count once."
      : "Written down.") + counted);
  });
}

function vBadge(ev){
  if(!ev) return "";
  return '<span class="vbadge '+esc(ev.tone)+'">'+esc(ev.glyph)+' '+esc(ev.badge)+'</span>';
}
// A live artifact's proof, rendered by TYPE. A URL is a link anyone can re-check; an attestation is
// a sentence and never renders as one. The "how" line always ships with it: a claim never renders
// bare (docs/prototype-port-rules.md Rule 3).
function vEvidence(ev){
  if(!ev) return "";
  const val = ev.isUrl
    ? '<a href="'+esc(ev.value)+'" target="_blank" rel="noreferrer">'+esc(ev.value)+'</a>'
    : '<span class="vmine" style="display:block;margin-top:4px">'+esc(ev.value)+'</span>';
  const when = ev.confirmedAt ? '<div class="vmono" style="margin-top:5px">CONFIRMED '+esc(String(ev.confirmedAt).slice(0,10))+'</div>' : "";
  return '<div style="margin-top:9px;font-size:13px">'+val+'</div>'+when+'<div class="vhow">'+esc(ev.how)+'</div>';
}
function vCard(m){
  let h = '<div class="vblock"><div class="vmono">'+esc(m.rail)+'</div>'
    + '<div class="vtitle">'+esc(m.title)+'</div>'
    + '<div class="vstate"><i style="background:'+vDot(m.dot)+'"></i><span>'+esc(m.state)+'</span>'+vBadge(m.evidence)+'</div>';
  if(m.evidence) h += vEvidence(m.evidence);
  if(m.retraction){
    h += '<div style="margin-top:11px"><div class="vmono">TAKEN DOWN '+esc(String(m.retraction.retractedAt).slice(0,10))+'</div>'
      + '<div class="vmine" style="margin-top:5px">'+esc(m.retraction.attestation)+'</div>'
      + '<div class="vhow">The evidence that it was live is kept above. Both facts are true, and the record needs both.</div></div>';
  }
  if(m.failure){
    h += '<div style="margin-top:11px"><div class="vmono" style="color:'+vDot("red")+'">DELIVERY FAILED '+esc(String(m.failure.at).slice(0,10))+'</div>'
      + '<div class="vnote" style="margin-top:4px">'+esc(m.failure.message)+'</div></div>';
  }
  if(m.bodyPath){
    // Whose words this is, and the ONLY thing that decides it: the recorded edit stamp. Purple and
    // "I DRAFTED THIS" until she has been through it, her blue and the day she did afterwards.
    // Nothing here guesses from how much changed, because nothing measured that.
    h += '<div style="margin-top:15px">'
      + (m.editedAt
        ? '<div class="vhand">YOU REWROTE THIS &middot; '+esc(String(m.editedAt).slice(0,10))+'</div>'
          + '<div class="vnote" style="margin-top:5px;max-width:560px">You have been through this one yourself, so I no longer call it my draft.</div>'
        : '<div class="vpen">I DRAFTED THIS</div>')
      + '<div class="vnote" style="margin-top:6px;font:11px/1.5 ui-monospace,monospace">'+esc(m.bodyPath)+'</div>'
      // Why the Edit button is absent, said plainly rather than left as a missing control. Only
      // when there IS a body to edit and something is stopping it.
      + (!m.editable && m.editBlockedReason ? '<div class="vnote" style="margin-top:6px;max-width:560px">'+esc(m.editBlockedReason)+'</div>' : "")
      + '</div>';
  }
  if(m.claimRefs && m.claimRefs.length){
    h += '<div class="vmono" style="margin-top:11px">'+m.claimRefs.length+' CLAIM'+(m.claimRefs.length===1?"":"S")+' TRACED · '
      + esc(m.claimRefs.map(c=>c.ref).join(", "))+'</div>';
  }
  if(m.findings){
    h += '<div style="margin-top:15px"><div class="vmono">WHAT THE PROBES TURNED UP THAT NOBODY ASKED FOR</div>'
      + m.findings.map(f=>'<div style="padding:14px 16px;border:1px solid var(--line);border-radius:9px;background:var(--card);margin-top:10px">'
        + '<div class="vtitle" style="font-size:15px;font-weight:600;margin-top:0">'+esc(f.label)+'</div>'
        + (f.note ? '<div class="vnote" style="margin-top:5px">'+esc(f.note)+'</div>' : "")
        + (f.signalQuality ? '<div class="vmono" style="margin-top:8px">SIGNAL '+esc(f.signalQuality.toUpperCase())+'</div>' : "")
        // Three states, not two: accepted, declined, and not yet asked.
        + (f.confirmed === null
          ? '<div class="vacts"><button class="primary" data-vfind="'+esc(m.artifactId)+'" data-vfid="'+esc(f.findingId)+'" data-vyes="1">Let it shape Phase 2</button>'
            + '<button data-vfind="'+esc(m.artifactId)+'" data-vfid="'+esc(f.findingId)+'" data-vyes="0">Note it, change nothing</button></div>'
          : '<div class="vmono" style="margin-top:9px">'+(f.confirmed?"YOU LET THIS SHAPE PHASE 2":"YOU NOTED IT AND CHANGED NOTHING")+'</div>')
        + '</div>').join("")
      + '</div>';
  }
  // The action list comes from the SERVER (venture-thread.ts's cardActions), so the browser never
  // holds a second copy of the state machine and can never draw a control the routes would refuse.
  if(m.actions && m.actions.length){
    h += '<div class="vacts">'
      + m.actions.map((a,i)=>'<button data-vcard="'+esc(m.artifactId)+'" data-vact="'+i+'"'
        + (i===0?' class="primary"':'')+'>'+esc(a.label)+'</button>').join("")
      + '</div>';
  }
  if(m.contentHandoffEligible){
    h += '<div class="vacts"><button class="primary v-content-handoff" data-vhandoff="'+esc(m.artifactId)+'">Send approved artifact to Content</button></div>';
  }
  h += vSlot("card:"+m.artifactId, m);
  return h+'</div>';
}
// The open form or the standing refusal for one control, if it belongs to this panel. Both live in
// the same slot on purpose: a refusal is the answer to the thing she just tried, so it belongs where
// she tried it, not in a toast that takes the instruction away with it.
function vSlot(prefix, m){
  const o = ventureOpen;
  if(!o || o.key.indexOf(prefix) !== 0) return "";
  let form = "";
  if(o.kind && o.kind.indexOf("confirm:") === 0){
    const proof = o.kind.slice("confirm:".length);
    form = '<div class="lbl">'+(proof==="url"?"THE LIVE LINK":"WHAT YOU PUT LIVE")+'</div>'
      + '<div class="ask">'+(proof==="url"
        ? "Paste the link. Nothing here will open it, and the row will say so, but a link can be re-checked later."
        : "Say what you did, in your own words. Nothing here can check it, and the row will always say that.")+'</div>'
      + (proof==="url"
        ? '<input id="vFormVal" value="'+esc(o.value)+'" placeholder="https://" />'
        : '<textarea id="vFormVal" rows="3">'+esc(o.value)+'</textarea>')
      + vFormButtons("It is live");
  } else if(o.kind === "failed"){
    form = '<div class="lbl">WHAT WENT WRONG</div>'
      + '<div class="ask">Your words, not the provider&#39;s. This is what the failure row will show.</div>'
      + '<textarea id="vFormVal" rows="3">'+esc(o.value)+'</textarea>' + vFormButtons("Record it");
  } else if(o.kind === "retract"){
    form = '<div class="lbl">WHAT HAPPENED TO IT</div>'
      + '<div class="ask">Taken down, unpublished, link dead. The record that it was live is kept either way, and this sits beside it.</div>'
      + '<textarea id="vFormVal" rows="3">'+esc(o.value)+'</textarea>' + vFormButtons("It came down");
  } else if(o.kind === "reason" || o.kind === "multi-reason"){
    form = '<div class="lbl">'+(o.reasonAlwaysRequired || o.reasonAlways?"YOUR REASON":"REASON FOR OVERRIDING THE RECOMMENDATION")+'</div>'
      + '<div class="ask">One line is enough. It goes in the audit trail beside the choice.</div>'
      + '<input id="vFormVal" value="'+esc(o.value)+'" placeholder="One line is enough" />' + vFormButtons("Record it");
  } else if(o.kind === "pace"){
    form = '<div class="lbl">YOUR ONGOING POSTING PACE</div>'
      + '<div class="ask">In your own words. Checkpoint 1 does not clear without it.</div>'
      + '<input id="vFormVal" value="'+esc(o.value)+'" placeholder="three a week" />' + vFormButtons("Record it");
  } else if(o.kind === "editing"){
    form = '<div class="lbl">THE WORDS THEMSELVES</div>'
      + '<div class="ask">Read straight off the file. Saving overwrites it and records that you were the one who did.</div>'
      + '<textarea class="vedit" id="vFormVal">'+esc(o.value)+'</textarea>'
      + vFormButtons("Save it");
  } else if(o.kind === "editloading"){
    // Not an empty editor. An editor with nothing in it looks exactly like a document with nothing
    // in it, and saving that would wipe the draft.
    form = '<div class="lbl">THE WORDS THEMSELVES</div><div class="ask">Reading the file&hellip;</div>';
  } else if(o.kind === "response"){
    // The one multi-field form in the room, so it keeps its own values in ventureOpen.fields --
    // a refusal rebuilds this whole subtree, and losing a transcribed quote to a missing dropdown
    // would be the worst possible time to throw her typing away.
    form = vResponseForm(o);
  }
  void m;
  return (form ? '<div class="vform">'+form+'</div>' : "")
    + (o.error ? '<div class="vrefusal">'+esc(o.error)+'</div>' : "");
}
function vFormButtons(label){
  return '<div class="vacts"><button class="primary" id="vFormOk">'+esc(label)+'</button>'
    + '<button id="vFormCancel">Never mind</button></div>';
}
function vChoice(m){
  const draftIds = m.requiredCount > 1 ? vMultiSelection(m) : [];
  const rows = m.items.map(it=>{
    const selected = it.selected || draftIds.includes(it.candidateId);
    const mark = selected ? "●" : it.recommended ? "○" : "·";
    // Only a decision still awaiting her is clickable. A settled one is a record, not a control:
    // decisions.ts refuses a second selection outright (rules.md §11 item 15, immutability).
    const pick = m.live ? ' pick" data-vpick="'+esc(m.decisionId)+'" data-vcand="'+esc(it.candidateId)+'"' : '"';
    return '<div class="vchoice-row'+(selected?' selected':'')+pick+'><span class="mark">'+mark+'</span><span>'
      + '<span class="n">'+esc(it.title)+'</span>'
      + (it.why ? '<span class="w">'+esc(it.why)+'</span>' : "")
      + (it.scoreLine ? '<span class="sc">'+esc(it.scoreLine)+'</span>' : "")
      + (it.recommended && !it.selected ? '<span class="sc">RECOMMENDED</span>' : "")
      + '</span></div>';
  }).join("");
  let h = '<div class="vblock"><div class="vmono">'+esc(m.rail)+'</div>'
    + (m.sub ? '<div class="vnote" style="margin-top:7px;max-width:560px;font-size:14.5px;color:#5a5346">'+esc(m.sub)+'</div>' : "")
    + '<div style="margin-top:13px">'+rows+'</div>';
  // Her reason for going against the recommendation is HER words, so it renders in her register.
  if(m.overrideReason){
    h += '<div style="margin-top:13px"><div class="vmono">YOUR REASON FOR OVERRIDING</div>'
      + '<div class="vmine" style="margin-top:5px">'+esc(m.overrideReason)+'</div></div>';
  }
  if(m.rationale){
    h += '<div style="margin-top:11px"><div class="vmono">YOUR REASONING</div>'
      + '<div class="vmine" style="margin-top:5px">'+esc(m.rationale)+'</div></div>';
  }
  h += '<div style="display:flex;gap:18px;margin-top:12px;flex-wrap:wrap;align-items:baseline">'
    + (m.live
      ? '<span class="vmono" style="color:'+vDot("amber")+'">'+(m.requiredCount>1?"PICK "+m.requiredCount:"PICK ONE")+'</span>'
      : '<span class="vmono">DECIDED</span>')
    + '<span class="vmono" style="color:#b0a488">'+esc(m.rulesVersion)+'</span></div>';
  if(m.live && m.requiredCount > 1){
    const ready = draftIds.length === m.requiredCount;
    h += '<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:13px">'
      + '<span class="vmono" style="color:'+(ready?vDot("green"):vDot("amber"))+'">SELECTED '+draftIds.length+' OF '+m.requiredCount+'</span>'
      + '<button class="primary" data-vmulti-submit="'+esc(m.decisionId)+'"'+(ready?'':' disabled')+'>Submit these '+m.requiredCount+'</button>'
      + '</div><div class="vnote" style="margin-top:9px">Choose exactly '+m.requiredCount+' together. The server still checks the count, override reason, and whether this decision is already immutable.</div>';
  }
  h += vSlot("choice:"+m.decisionId, m);
  return h+'</div>';
}
// The gate, and the one control that can move it. Every number here is the server's: have is
// countEligibleUnique over the log, and the bar is its own pct. Recording a response does NOT
// nudge them client-side -- ventureWrite refetches the whole thread, so what the bar shows is
// always what the log actually counted, never an optimistic have+1 for a response that turned out
// to be ineligible or a repeat of someone already in there.
function vGate(m){
  return '<div class="vblock"><div class="vmono">'+esc(m.rail)+'</div>'
    + '<div class="vtitle" style="font-size:20px">'+esc(m.title)+'</div>'
    + '<div style="display:flex;align-items:baseline;gap:12px;margin-top:14px;flex-wrap:wrap">'
    + '<span class="vgate-n">'+m.have+'</span><span style="font-size:14px;color:#7a7266">of '+m.need+' needed, aiming for '+m.target+'</span></div>'
    + '<div class="vgate-bar"><span style="width:'+m.pct+'%"></span></div>'
    + '<div class="vnote" style="margin-top:13px;max-width:530px;font-size:13.5px;color:#5a5346">'+esc(m.note)+'</div>'
    + '<div class="vacts"><button class="primary" id="vAddResponse">Write down a response</button>'
    + '<span class="vnote">One person at a time. I never split a paste into several and I never guess who sent what.</span></div>'
    + vSlot("gate", m)
    + '</div>';
}
// One response, transcribed. Every field is Muxin's answer, because the two that decide anything --
// is this person in the audience you are testing, and is there an identifier to recognize them by --
// are judgments src/venture/responses.ts has always required as explicit input and refuses to infer.
//
// The audience question starts UNANSWERED and stays that way until she picks. That is the three-
// states rule applied to a form: "not answered" is not "no", and the route refuses an unanswered
// one with its own sentence rather than this screen quietly defaulting the count either way.
const V_RESP_SOURCES = [["survey","a survey answer"],["email","an email"],["comment","a comment"],["dm","a DM"],["other","somewhere else"]];
const V_RESP_INTENSITY = [["low","said in passing"],["medium","clearly bothered"],["high","really wound up about it"]];
function vRespField(id, label, ask, o, opts){
  const v = esc((o.fields && o.fields[id]) || "");
  const box = opts && opts.textarea
    ? '<textarea id="vr-'+id+'" rows="'+(opts.rows||3)+'"'+(opts.other?' class="other"':'')+'>'+v+'</textarea>'
    : '<input id="vr-'+id+'" value="'+v+'"'+(opts&&opts.placeholder?' placeholder="'+esc(opts.placeholder)+'"':'')+' />';
  return '<div style="margin-top:14px"><div class="lbl">'+esc(label)+'</div>'
    + (ask ? '<div class="sub">'+esc(ask)+'</div>' : "") + box + '</div>';
}
function vRespSelect(id, label, ask, o, options, blank){
  const cur = (o.fields && o.fields[id]) || "";
  const opts = (blank ? '<option value=""'+(cur===""?" selected":"")+'>'+esc(blank)+'</option>' : "")
    + options.map(pair=>'<option value="'+esc(pair[0])+'"'+(cur===pair[0]?" selected":"")+'>'+esc(pair[1])+'</option>').join("");
  return '<div style="margin-top:14px"><div class="lbl">'+esc(label)+'</div>'
    + (ask ? '<div class="sub">'+esc(ask)+'</div>' : "")
    + '<select id="vr-'+id+'">'+opts+'</select></div>';
}
function vResponseForm(o){
  return '<div class="lbl">ONE RESPONSE, IN THEIR WORDS AND YOUR JUDGMENT</div>'
    + '<div class="ask">Nothing you type here is read back to you later. The log answers in counts only, and it stays out of git.</div>'
    + vRespSelect("source", "WHERE IT CAME FROM", "", o, V_RESP_SOURCES, "pick one")
    // Pre-filled with today because most transcribing happens the day it lands, and left editable
    // because plenty of it does not. The date that gets stored is whichever one is in this box when
    // she sends it -- the server requires the field rather than reading its own clock, so an email
    // from last week never gets today written on it just because today is when she typed it up.
    + '<div style="margin-top:14px"><div class="lbl">WHEN IT REACHED YOU</div>'
    + '<div class="sub">Today unless you change it. Nothing here can tell when it actually arrived.</div>'
    + '<input type="date" id="vr-received_at" value="'+esc((o.fields && o.fields.received_at) || vToday())+'" /></div>'
    + vRespField("exact_quote", "WHAT THEY ACTUALLY SAID", "Their words, not yours and not mine. Paste or type them as they came.", o, { textarea:true, rows:4, other:true })
    + vRespField("redacted_quote", "THE SAME THING, WITH IDENTIFYING BITS TAKEN OUT", "This is the only version that ever leaves the log, so it is the one a cluster quotes. I do not redact it for you.", o, { textarea:true, rows:4, other:true })
    + vRespField("stuck_point", "WHERE THEY ARE STUCK", "One line, in your words.", o, {})
    + vRespField("desired_outcome", "WHAT THEY SAID THEY WANT INSTEAD", "Leave it empty if they did not say.", o, {})
    + vRespSelect("emotional_intensity", "HOW HARD THEY SAID IT", "", o, V_RESP_INTENSITY, "pick one")
    + vRespSelect("target_audience_eligible", "IS THIS PERSON IN THE AUDIENCE YOU ARE TESTING?",
        "Your call, and it is the one that decides whether they count toward the goal above. I have no way to read it off their words.",
        o, [["yes","Yes, they are the person this is for"],["no","No, they are outside it"]], "not answered yet")
    + '<div style="margin-top:14px"><div class="lbl">SOMETHING TO RECOGNIZE THEM BY (OPTIONAL)</div>'
    + '<div class="sub">An email or a platform user id, never a display name. It gets hashed and the raw value is thrown away, never written down. It is the only way two responses from the same person count as one. Leave both empty and this counts as its own person.</div>'
    + '<div class="pair"><input id="vr-id_platform" value="'+esc((o.fields&&o.fields.id_platform)||"")+'" placeholder="which platform" />'
    + '<input id="vr-id_value" value="'+esc((o.fields&&o.fields.id_value)||"")+'" placeholder="their id or email there" /></div></div>'
    + vRespField("exclusion_reason", "A REASON TO KEEP THEM OUT OF THE COUNT (OPTIONAL)", "Filling this in keeps the response on file and out of the goal.", o, {})
    + vFormButtons("Write it down");
}
function vCheckpoint(m){
  const rows = m.rows.map(r=>
    '<div class="vcp-row"><div style="min-width:0"><div class="t">'+esc(r.title)+'</div>'
    + '<div class="l"><i style="background:'+vDot(r.dot)+'"></i><span style="color:'+(r.isLive?vDot(r.dot):"#9a6b12")+'">'+esc(r.live)+'</span>'+vBadge(r.evidence)+'</div>'
    + '</div><div style="text-align:right"><span class="vcp-appr">'+esc(r.approval)+'</span></div></div>'
  ).join("");
  const decisions = m.decisions.length
    ? '<div style="margin-top:13px;padding-top:13px;border-top:1px solid #e2d8c1">'
      + '<div class="vmono">AND THESE DECISIONS</div>'
      + m.decisions.map(d=>'<div class="l" style="display:flex;align-items:center;gap:9px;margin-top:7px;font-size:13px">'
        + '<i style="width:7px;height:7px;border-radius:50%;display:block;background:'+vDot(d.selected?"green":"amber")+'"></i>'
        + '<span>'+esc(d.kind.replace(/-/g," "))+(d.selected?"":" (not chosen yet)")+'</span></div>').join("")
      + '</div>'
    : "";
  return '<div class="vcp"><div class="vcp-head"><span class="vmono" style="color:#8a7f6d">'+esc(m.rail)+'</span>'
    + '<span class="grow" style="flex:1"></span>'
    + '<span class="vmono" style="color:'+vDot(m.stampTone)+'">'+esc(m.stamp)+'</span></div>'
    + '<div class="vnote" style="margin-top:8px;max-width:520px;font-size:14.5px;color:#3a352c">'+esc(m.sub)+'</div>'
    + '<div style="display:flex;justify-content:space-between;gap:14px;margin-top:16px">'
    + '<span class="vmono" style="font-size:9.5px;color:#b0a488">CONDITION, AND WHETHER IT IS LIVE</span>'
    + '<span class="vmono" style="font-size:9.5px;color:#b0a488">YOUR APPROVAL</span></div>'
    + rows + decisions
    + '<div class="vnote" style="margin-top:15px;padding-top:15px;border-top:1px solid #e2d8c1">'+esc(m.footNote)+'</div>'
    + (m.cleared ? "" :
        '<div class="vacts">'
        + (m.needsPace ? '<button id="vPace">Record your pace</button>' : "")
        // Disabled is a MIRROR of clearCheckpoint's predicate, not a gate: if the mirror is ever
        // wrong the server refuses with its own reason, and that reason renders right below.
        + '<button class="primary" id="vClear"'+(m.canClear?"":" disabled")+'>'+esc(m.checkpointId === "checkpoint-3" ? "Record it and open Phase 4" : "Clear it and open the next phase")+'</button>'
        + '<span class="vnote">'+(m.canClear
            ? "Canon first, then the next phase opens."
            : "Every row above has to report live first. Nothing after this gets written until then.")+'</span>'
        + '</div>')
    + vSlot("checkpoint:"+m.checkpointId, m)
    + '</div>';
}
function vQuotes(m){
  return '<div class="vblock" style="border-bottom:none"><div class="vmono">'+esc(m.rail)+'</div>'
    + '<div class="vnote" style="margin-top:7px;max-width:560px;font-size:14.5px;color:#5a5346">'+esc(m.sub)+'</div>'
    + '<div style="display:flex;flex-direction:column;gap:19px;margin-top:17px">'
    + m.lines.map(q=>'<div id="'+esc(q.anchor)+'"><div class="vmono">'+esc(q.question)+'</div>'
      + '<div class="vmine" style="margin-top:6px">'+esc(q.answer)+'</div></div>').join("")
    + '</div></div>';
}
function vClusters(m){
  return '<div class="vblock"><div class="vmono">'+esc(m.rail)+'</div>'
    + '<div class="vnote" style="margin-top:7px;max-width:560px;font-size:14.5px;color:#5a5346">'+esc(m.sub)+'</div>'
    + m.items.map(c=>'<div style="margin-top:15px"><div class="vtitle" style="font-size:18px">'+esc(c.label)+'</div>'
      + '<div class="vnote" style="margin-top:4px">'+esc(c.stuckPoint)+'</div>'
      + c.evidence.map(e=>'<div class="vdrafted" style="border-left-color:#d8cfbb;font-size:15px;margin-top:7px">'+esc(e)+'</div>').join("")
      + '</div>').join("")
    + '</div>';
}
function ventureLearningHtml(){
  const evaluations=Array.isArray(VENTURE_LEARNING_EVALUATIONS)?VENTURE_LEARNING_EVALUATIONS:[];
  const sources=[];
  const adopted=(VENTURE_SIGNALS&&VENTURE_SIGNALS.ventureHandoffs||[]).filter(p=>p.ventureSlug===ventureSlug&&p.status==="adopted"&&p.ventureDecision&&p.ventureDecision.outcome==="accept");
  adopted.forEach(p=>sources.push('<button data-learning-source="signals-input" data-learning-id="'+esc("signals-input-"+p.id)+'">Evaluate learning from accepted Signals input</button>'));
  if(VENTURE_RESPONSE_EVALUATE_ID) sources.push('<button class="vacts" data-learning-source="response" data-learning-id="'+esc(VENTURE_RESPONSE_EVALUATE_ID)+'">Evaluate learning from the recorded response</button>');
  (Array.isArray(VENTURE_LEARNING_SOURCES)?VENTURE_LEARNING_SOURCES:[]).slice(0,20).forEach(s=>{
    const id=String(s.id||"").replace(/^research:/,"");
    if(id) sources.push('<button data-learning-source="research-observation" data-learning-id="'+esc(id)+'">Evaluate '+esc(s.evidenceTier)+' learning · '+esc(s.scope)+'</button>');
  });
  const sourceHtml=sources.length?'<div class="vblock"><div class="vmono">LEARNING</div><div class="vnote">Review one accepted learning receipt at a time. Evaluation never changes Venture state by itself.</div><div class="vacts">'+sources.join('')+'</div></div>':'';
  const cards=evaluations.map(e=>{
    const status=String(e.status||"pending");
    const controls=status==="pending"?'<div class="vacts"><button class="primary" data-learning-decision="accept" data-learning-id="'+esc(e.evaluationId||e.id)+'">Accept</button><button data-learning-decision="request-more-evidence" data-learning-id="'+esc(e.evaluationId||e.id)+'">Request more evidence</button><button data-learning-decision="decline" data-learning-id="'+esc(e.evaluationId||e.id)+'">Decline</button></div>':'';
    const experiment=status==="accepted"&&e.recommendation==="test"?'<div class="vform learning-experiment" data-learning-experiment="'+esc(e.evaluationId||e.id)+'"><div class="lbl">PROPOSE EXPERIMENT</div><div class="sub">Use an existing Venture Content request. The normal Experiment approval queue remains separate.</div><input data-learning-field="contentRequestId" placeholder="Content request ID" /><input data-learning-field="evidenceFamily" placeholder="outcome family" /><div class="pair"><input data-learning-field="minimumSample" placeholder="minimum sample" /><input data-learning-field="minimumDays" placeholder="minimum days" /></div><div class="pair"><input data-learning-field="availablePublishingUnits" placeholder="publishing units" /><input data-learning-field="availableDays" placeholder="available days" /></div><button class="primary" data-learning-experiment-submit="'+esc(e.evaluationId||e.id)+'">Propose Experiment</button></div>':'';
    const acceptedNote=status==="accepted"&&e.recommendation==="change"?'<div class="vnote">Accepted as a proposal. It does not mutate Venture automatically.</div>':status==="accepted"&&e.recommendation==="test"?'<div class="vnote">Accepted as a test recommendation. Nothing is run until you propose it and approve the normal Experiment plan.</div>':'';
    return '<div class="vblock learning-card"><div class="vmono">LEARNING EVALUATION · '+esc(status)+'</div><div class="vtitle" style="font-size:19px">'+esc(e.recommendation)+' · '+esc(e.target)+'</div><div class="vnote" style="margin-top:7px"><strong>Evidence tier:</strong> '+esc(e.evidenceTier)+' · <strong>Claim ceiling:</strong> '+esc(e.claimCeiling)+'</div><div class="vnote" style="margin-top:7px"><strong>Rationale:</strong> '+esc(e.rationale)+'</div><div class="vnote" style="margin-top:7px"><strong>Proposed change:</strong> '+esc(e.proposedChange)+'</div><div class="vnote" style="margin-top:7px"><strong>Caveats:</strong> '+(e.caveats||[]).map(esc).join('; ')+'</div>'+controls+acceptedNote+experiment+'</div>';
  }).join('');
  return sourceHtml+(cards?'<div class="vblock"><div class="vmono">RECORDED LEARNING</div>'+cards+'</div>':'');
}
function renderVenture(){
  const t = VENTURE_THREAD;
  if(!t){ $("#ventureThread").innerHTML = '<div class="empty">Nothing to show.</div>'; return; }
  $("#ventureDay").textContent = vDayLine(t.elapsedDays);
  const signals = (VENTURE_SIGNALS&&VENTURE_SIGNALS.ventureHandoffs||[]).filter(p=>p.ventureSlug===ventureSlug&&p.status==="adopted");
  const signalsHtml = signals.map(p=>'<div class="vblock" data-signals-input="'+esc(p.id)+'"><div class="vmono">SIGNALS INPUT · '+(p.ventureDecision?'DECIDED IN VENTURE':'ADOPTED IN SIGNALS')+'</div><div class="vtitle" style="font-size:20px">'+esc(p.title)+'</div><div class="vnote" style="margin-top:8px">'+esc(p.proposedInput)+' · measured '+esc(p.evidenceStatus)+' evidence · phase '+esc(p.phase)+(p.ventureDecision?' · Venture decision: '+esc(p.ventureDecision.outcome):'')+'</div>'+signalsHandoffMetaHtml(p, null, null)+'<div class="vnote" style="margin-top:6px"><strong>Venture:</strong> '+esc(p.ventureSlug)+' · <strong>Phase:</strong> '+esc(p.phase)+'</div>'+(p.ventureDecision?'':'<div class="vacts"><button class="primary" data-signals-input-action="accept" data-signals-input-id="'+esc(p.id)+'">Accept in Venture</button><button data-signals-input-action="request-more-evidence" data-signals-input-id="'+esc(p.id)+'">Request more evidence</button><button data-signals-input-action="reject" data-signals-input-id="'+esc(p.id)+'">Reject</button></div>')+'</div>').join('');
  $("#ventureThread").innerHTML = ventureLearningHtml() + signalsHtml + t.messages.map(m=>{
    if(m.kind==="rail") return '<div class="vmono">'+esc(m.text)+'</div>';
    if(m.kind==="said") return '<div class="vsaid">'+esc(m.text)+'</div>';
    if(m.kind==="receipt") return '<div class="vreceipt"><i style="background:'+vDot(m.dot)+'"></i><span>'+esc(m.text)+'</span></div>';
    if(m.kind==="card") return vCard(m);
    if(m.kind==="choice") return vChoice(m);
    if(m.kind==="gate") return vGate(m);
    if(m.kind==="quotes") return vQuotes(m);
    if(m.kind==="clusters") return vClusters(m);
    if(m.kind==="checkpoint") return vCheckpoint(m);
    return "";
  }).join("");
  const historyHtml = (t.history||[]).map(g=>'<details class="venture-history" style="margin-top:12px" open><summary class="vmono">EARLIER PHASE '+esc(g.phase)+' · WHAT WAS DRAFTED ('+g.artifacts.length+')</summary>'
    + g.artifacts.map(a=>'<div class="vnote" style="margin-top:9px;padding:10px;border:1px solid var(--line);border-radius:8px">'
      + '<div class="vtitle" style="font-size:14px">'+esc(a.title)+'</div>'
      + '<div class="from" style="margin-top:4px">'+esc(a.state)+' · '+esc(a.rail)+'</div>'
      + (a.bodyPath ? '<div class="from" style="margin-top:4px">'+esc(a.bodyPath)+'</div>' : '')
      + '</div>').join('')+'</details>').join('');
  $("#ventureRail").innerHTML = '<div><div class="vmono">LEDGER / HISTORY</div>'
    + '<div class="vnote" style="font-size:12px;margin-top:2px">Earlier artifacts and live records appear here when the server exposes them. Nothing is inferred.</div></div>'
    + historyHtml
    + t.rail.map(g=>'<div style="display:flex;flex-direction:column;gap:9px">'
      + '<div class="vrail-grp">'+esc(g.name)+'</div>'
      + g.items.map(it=>'<div class="vrail-item"><i></i><span style="min-width:0;display:flex;flex-direction:column;gap:2px">'
        + '<span class="lbl">'+esc(it.label)+'</span>'
        + (it.isQuote ? '<span class="q">'+esc(it.value)+'</span>' : '<span class="p">'+esc(it.value)+'</span>')
        + '<span class="from">'+esc(it.from)+'</span>'
        + (it.jumpTo ? '<a class="jump" href="#'+esc(it.jumpTo)+'">jump to it</a>' : "")
        + '</span></div>').join("")
      + '</div>').join("")
    + '<div style="margin-top:auto;padding-top:15px;border-top:1px solid var(--line)">'
    + '<div class="vmono">READ FROM</div>'
    + t.refs.map(r=>'<div style="margin-top:6px"><div style="font-size:12px;line-height:1.4;color:#5a5346">'+esc(r.name)+'</div>'
      + '<div class="from" style="font:10px/1.5 ui-monospace,monospace;color:#b8ad94">'+esc(r.stamp)+'</div></div>').join("")
    + '</div>';
}
function renderVentureExample(){
  $("#ventureDay").textContent = "read-only example";
  $("#ventureEngine").disabled = true; $("#ventureAnalyzeBtn").disabled = true; $("#ventureRunStepBtn").disabled = true;
  $("#ventureThread").innerHTML = '<div class="venture-example"><div class="vmono">SAMPLE DATA · ILLUSTRATIVE, NOT LIVE</div><h3 style="margin-top:10px">A small consulting offer for mission-driven operators</h3><p class="vnote">This sample shows the path from intake to evidence, content, and an email-acquisition asset. Nothing here writes product state.</p><div class="vreceipt"><i style="background:#2f7d46"></i><span>Intake complete · voice and truth constraints recorded</span></div><div class="vblock"><div class="vmono">Content in review</div><div class="vtitle" style="margin-top:8px">Why good operators miss institutional incentives</div><div class="vnote">Status · Draft · LinkedIn short post + image. Waiting for your decision before it moves.</div></div><div class="vblock"><div class="vmono">Lead magnet</div><div class="vtitle" style="margin-top:8px">Operator incentives field guide</div><div class="vnote">Status · Ready for review · CTA acquires an email, then offers an optional Email survey that records reader interests.</div></div><div class="vblock"><div class="vmono">NEXT ACTION</div><div class="vtitle" style="margin-top:8px">Waiting for your decision</div><div class="vnote">Approve the research plan, choose three content ideas, or revise the lead magnet. Each action stops at the next human gate.</div></div></div>';
  $("#ventureDocuments").innerHTML='<div class="venture-example"><div class="vmono">EXAMPLE DOCUMENTS</div><p class="vnote">As work advances, this stage holds the research plan, selected ideas, draft posts, lead magnet, offer outline, operating plan, and Day 14 review. Each remains visibly draft, approved, or live.</p></div>';
  $("#ventureRail").innerHTML='<div class="venture-example"><div class="vmono">EXAMPLE HISTORY</div><p class="vnote">Every selection, approval, delivery confirmation, and checkpoint appears here as an audit trail. Earlier phases stay available without crowding the current work screen.</p></div>';
  $("#ventureIntakeSections").innerHTML='<div class="venture-example"><div class="vmono">EXAMPLE GUARDRAILS</div><p class="vnote"><strong>Voice:</strong> plainspoken, specific, and skeptical of inflated claims.</p><p class="vnote"><strong>Truth boundary:</strong> treat demand as a hypothesis until real replies or purchases support it.</p><p class="vnote"><strong>Day 14:</strong> three live probes, a sustainable posting pace, and at least five substantive replies from the intended audience.</p><p class="from">Read-only. Start your own venture to record real guardrails.</p></div>';
}
document.addEventListener("click", async e=>{
  const target=e.target && e.target.closest ? e.target.closest("[data-venture-slug]") : null;
  if(target){ switchVenture(target.dataset.ventureSlug); return; }
  const doc=e.target && e.target.closest ? e.target.closest("[data-venture-document]") : null;
  if(doc) openVentureDocument(doc.dataset.ventureDocument);
});
$("#ventureSelect").addEventListener("change", e=>switchVenture(e.target.value));
function switchVenture(slug){
  if(!slug || (!VENTURE_SLUGS.includes(slug) && slug!=="__example__") || slug===ventureSlug) return;
  for(const timer of intakeTimers.values()) clearTimeout(timer);
  intakeTimers.clear();
  ventureSlug=slug;
  VENTURE_THREAD=null;
  VENTURE_LEARNING_EVALUATIONS=[];
  VENTURE_LEARNING_SOURCES=[];
  VENTURE_RESPONSE_EVALUATE_ID=null;
  VENTURE_DOCUMENTS=[];
  ventureDocument=null;
  ventureAnalysisPending=false;
  $("#ventureAnalysisPanel").hidden=true;
  $("#ventureRunStepBtn").disabled=true;
  renderVentureSwitcher();
  renderVentureDocuments();
  if(slug==="__example__"){ renderVentureExample(); return; }
  loadVenture();
}
// Pane switch for the in-sheet venture views. Lives on the room, not
// inside the rebuilt thread, so a plain listener on #roomVenture is enough.
$("#roomVenture").addEventListener("click", (e)=>{
  const t = e.target.closest ? e.target.closest("[data-set-ven-pane]") : null;
  if(!t) return;
  VEN.pane = t.dataset.setVenPane;
  renderVentureSheets();
});
// One delegated listener: renderVenture() replaces the whole subtree on every refetch, so per-node
// handlers would be re-bound constantly and a stale one could fire against a rebuilt thread.
document.addEventListener("click", e=>{
  const t = e.target;
  if(!t || !t.closest || !t.closest("#roomVenture")) return;
  const val = ()=> { const el = $("#vFormVal"); return el ? el.value : ""; };

  const learningSource = t.closest("[data-learning-source]");
  if(learningSource){
    const source=learningSource.dataset.learningSource, id=learningSource.dataset.learningId;
    if(source&&id) post("/api/venture/"+encodeURIComponent(ventureSlug)+"/learning/"+source+"/"+encodeURIComponent(id)+"/evaluate",{engine:$("#ventureEngine").value||"codex"}).then(r=>{ if(r.ok){ flash("Learning evaluation is ready for your review."); loadVenture(); } else flash(r.error||"Could not evaluate learning"); });
    return;
  }
  const learningDecision = t.closest("[data-learning-decision]");
  if(learningDecision){
    const rationale=prompt("Why record this Venture learning decision?")||"";
    if(!rationale.trim()) return;
    learningDecision.disabled=true;
    post("/api/venture/"+encodeURIComponent(ventureSlug)+"/learning-evaluations/"+encodeURIComponent(learningDecision.dataset.learningId)+"/decision",{decision:learningDecision.dataset.learningDecision,rationale}).then(r=>{ if(r.ok){ flash("Learning decision recorded."); loadVenture(); } else { learningDecision.disabled=false; flash(r.error||"Could not record learning decision"); } });
    return;
  }
  const experimentSubmit = t.closest("[data-learning-experiment-submit]");
  if(experimentSubmit){
    const form=experimentSubmit.closest("[data-learning-experiment]");
    const field=(name)=>form&&form.querySelector('[data-learning-field="'+name+'"]')?.value||"";
    post("/api/venture/"+encodeURIComponent(ventureSlug)+"/learning-evaluations/"+encodeURIComponent(experimentSubmit.dataset.learningExperiment||"")+"/experiment/propose",{
      contentRequestId:field("contentRequestId"), evidenceFamily:field("evidenceFamily"), minimumSample:Number(field("minimumSample")), minimumDays:Number(field("minimumDays")), availablePublishingUnits:Number(field("availablePublishingUnits")), availableDays:Number(field("availableDays")), engine:$("#ventureEngine").value||"codex"
    }).then(r=>{ if(r.ok){ flash("Moved into the normal Experiment approval queue. Nothing runs or publishes automatically."); loadVenture(); } else flash(r.error||"Could not propose Experiment"); });
    return;
  }

  if(t.id === "vFormCancel") return vClose();
  const handoff = t.closest("[data-vhandoff]");
  if(handoff) return ventureContentHandoff(handoff.dataset.vhandoff, handoff);
  if(t.id === "vFormOk"){
    const o = ventureOpen; if(!o) return;
    if(o.kind === "reason"){
      const c = (VENTURE_THREAD.messages||[]).find(m=>m.kind==="choice" && o.key.indexOf("choice:"+m.decisionId+":")===0);
      const cand = o.key.slice(o.key.lastIndexOf(":")+1);
      if(c){ ventureOpen.value = val(); return vSubmitReason(c, { candidateId: cand }); }
      return;
    }
    if(o.kind === "multi-reason"){
      const c = (VENTURE_THREAD.messages||[]).find(m=>m.kind==="choice" && o.key === "choice:"+m.decisionId+":multi");
      if(c){ ventureOpen.value = val(); return vSubmitMultiReason(c); }
      return;
    }
    const id = o.key.split(":")[1];
    if(o.kind && o.kind.indexOf("confirm:")===0){
      return ventureWrite("/artifacts/"+encodeURIComponent(id)+"/confirm-live",
        { type: o.kind.slice("confirm:".length), value: val() }, "Recorded as live", o.key);
    }
    if(o.kind === "failed") return ventureWrite("/artifacts/"+encodeURIComponent(id)+"/failed", { message: val() }, "Recorded", o.key);
    if(o.kind === "retract") return ventureWrite("/artifacts/"+encodeURIComponent(id)+"/retract", { attestation: val() }, "Recorded as taken down", o.key);
    if(o.kind === "pace") return ventureWrite("/pace", { postsPerWeek: val() }, "Pace recorded", o.key);
    if(o.kind === "editing") return vSaveBody(id, val());
    if(o.kind === "response") return vSubmitResponse();
    return;
  }

  const signalsInput = t.closest("[data-signals-input-action]");
  if(signalsInput){
    const proposal = (VENTURE_SIGNALS&&VENTURE_SIGNALS.ventureHandoffs||[]).find(p=>p.id===signalsInput.dataset.signalsInputId&&p.ventureSlug===ventureSlug);
    if(!proposal) return;
    const reason = prompt(signalsInput.dataset.signalsInputAction==="accept"?"Why accept this Signals input in Venture?":signalsInput.dataset.signalsInputAction==="reject"?"Why reject this Signals input?":"What evidence is still needed?")||"";
    if(!reason.trim()) return;
    signalsInput.disabled=true;
    ventureWrite("/signals-input/"+encodeURIComponent(proposal.id)+"/decision", {
      outcome: signalsInput.dataset.signalsInputAction, reason,
    }, "Signals input decision recorded", "signals-input:"+proposal.id).then(result=>{ if(result) loadVenture(); });
    return;
  }

  const card = t.closest("[data-vcard]");
  if(card){
    const m = (VENTURE_THREAD.messages||[]).find(x=>x.kind==="card" && x.artifactId===card.dataset.vcard);
    if(m) return vCardAction(m.artifactId, m.actions[Number(card.dataset.vact)]);
  }
  const find = t.closest("[data-vfind]");
  if(find){
    return ventureWrite("/artifacts/"+encodeURIComponent(find.dataset.vfind)+"/findings/"+encodeURIComponent(find.dataset.vfid),
      { accepted: find.dataset.vyes === "1" }, "Recorded", "card:"+find.dataset.vfind);
  }
  const pick = t.closest("[data-vpick]");
  if(pick){
    const c = (VENTURE_THREAD.messages||[]).find(x=>x.kind==="choice" && x.decisionId===pick.dataset.vpick);
    const it = c && c.items.find(i=>i.candidateId===pick.dataset.vcand);
    if(c && it && c.requiredCount === 1) return vPick(c, it);
    if(c && it && c.requiredCount > 1) return vMultiToggle(c, it);
    return;
  }
  const multiSubmit = t.closest("[data-vmulti-submit]");
  if(multiSubmit){
    const c = (VENTURE_THREAD.messages||[]).find(x=>x.kind==="choice" && x.decisionId===multiSubmit.dataset.vmultiSubmit);
    if(c) return vMultiSubmit(c);
    return;
  }
  if(t.id === "vAddResponse") return vOpenResponse();
  if(t.id === "vPace"){
    const cp = (VENTURE_THREAD.messages||[]).find(x=>x.kind==="checkpoint");
    if(cp) return vOpen("checkpoint:"+cp.checkpointId+":pace", "pace", "");
  }
  if(t.id === "vClear"){
    const cp = (VENTURE_THREAD.messages||[]).find(x=>x.kind==="checkpoint");
    if(!cp) return;
    // clearCheckpoint answers 200 even when it declines -- {cleared:false, reason}. The reason is
    // the sentence the screen owes her, so a declined clear is surfaced like a refusal rather than
    // silently doing nothing, and the thread is refetched either way (the attempt refreshed state).
    ventureWrite("/checkpoint/"+encodeURIComponent(cp.checkpointId)+"/clear", {}, "", "checkpoint:"+cp.checkpointId).then(res=>{
      if(!res) return;
      if(res.result && res.result.cleared) flash("Cleared, and written to canon");
      else if(res.result && res.result.reason) { ventureOpen = { key:"checkpoint:"+cp.checkpointId, kind:"error", value:"", error: res.result.reason }; renderVenture(); }
    });
  }
});

async function ventureContentHandoff(artifactId, button){
  if(!ventureSlug || !artifactId) return;
  button.disabled=true;
  const result=await post("/api/venture/handoff",{slug:ventureSlug,artifactId});
  if(!result.ok){ button.disabled=false; flash(result.error||"Could not create the Content handoff"); return; }
  await setRoom("content");
  CW.slug=result.request.id; CW.step=2; CW.pane="wizard"; CW.config=null; CW.treat=null; CW.treatFor=null; renderContentWizard(); cwLoadTreatment();
  flash("Venture artifact opened in Content configuration");
}

// ── the intake interview ─────────────────────────────────────────────────────────────────────────
//
// The 25-question interview from venture/rules.md §4.2, conducted here instead of in a terminal.
// One question at a time (SKILL.md step 1: "not a form dump"), autosaved to the scratch buffer
// behind /api/venture/:slug/intake/..., then the two panels kickoffVenture cannot write without --
// voice evidence and the Day 14 scorecard -- and then the commit.
//
// Four things this screen refuses to do:
//   * carry its own copy of the questions. IV_QUESTIONS is serialized from src/venture/intake.ts.
//   * say "saved" on a timer. The word only appears after the server answered, and the time shown
//     is the server's own savedAt (see intakeSaveLine).
//   * estimate anything. "Question 7 of 25" is counted. There is no minutes-remaining, because
//     nothing here measures how long an interview takes.
//   * decide what complete means. It marks the empty boxes for her convenience; the commit route
//     is what refuses, and its sentence is what renders.
const IV_QUESTIONS = ${JSON.stringify(INTAKE_QUESTIONS)};
const IV_TOTAL = IV_QUESTIONS.length;
const IV_RESUME_KEY = "venture-intake-in-progress";
const IV_VOICE_STEP = IV_TOTAL + 1;
const IV_SCORE_STEP = IV_TOTAL + 2;

// Rule 5 mirrors of intakeProgressLine / intakeUnanswered / intakeSaveLine / intakeSlugError in
// page.ts. Change one, change both.
function ivProgressLine(step, total){
  if(step >= 1 && step <= total) return "Question "+step+" of "+total;
  if(step === total + 1) return "Voice evidence";
  if(step === total + 2) return "Day 14 scorecard";
  return "";
}
function ivUnanswered(drafts, total){
  const filled = new Set();
  for(const d of drafts) if(d.text && d.text.trim()) filled.add(d.n);
  const out = [];
  for(let n=1; n<=total; n++) if(!filled.has(n)) out.push(n);
  return out;
}
function ivSaveLine(s){
  if(s.state === "saving") return "saving…";
  if(s.state === "failed") return "NOT SAVED. "+(s.error || "the server did not answer");
  if(s.state === "saved"){
    const d = s.savedAt ? new Date(s.savedAt) : null;
    if(!d || isNaN(d.getTime())) return "saved";
    return "saved "+String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");
  }
  return "";
}
function ivSlugError(slug){
  if(typeof slug !== "string" || !/^[a-z0-9][\\w-]*$/.test(slug)) return "bad venture name";
  return null;
}
// ── end of the intake mirror ──

let ivSlug = null;              // null = not in the interview
let ivStep = 1;
let ivAnswers = new Map();      // question number -> text, as last seen by the server or typed here
let ivSave = { state:"", savedAt:"", error:"" };
let ivTimer = null;             // the debounce
let ivFlight = null;            // the save in the air, so a commit can wait for it
let ivDirty = 0;                // question number with text the debounce has not sent yet, or 0
let ivVoice = { samples:"", worldview:"", natural:"", refused:"" };
let ivScore = { posts:"", pace:"", views:"", optin:"", quality:"", sustain:"" };
let ivRefusal = "";             // the server's sentence, verbatim
let ivMissing = [];             // question numbers it named, for marking the grid
let ivBusy = false;
const IV_DEBOUNCE_MS = 600;

// Which venture is mid-interview, so a reload lands back in it instead of on a slug field. The
// answers themselves are on the server -- this remembers only the name, and losing it costs one
// retype.
function ivRemember(slug){ try { if(slug) localStorage.setItem(IV_RESUME_KEY, slug); else localStorage.removeItem(IV_RESUME_KEY); } catch(e){} }
function ivRemembered(){ try { return localStorage.getItem(IV_RESUME_KEY); } catch(e){ return null; } }
// A remembered name is only worth offering while it is still an unfinished interview. Once the
// venture exists its drafts have been cleared, so resuming it would open 25 empty boxes for a
// venture that is already on the desk.
function ivResumable(){
  const s = ivRemembered();
  if(!s || ivSlugError(s)) return null;
  if((VENTURE_SLUGS||[]).includes(s)){ ivRemember(null); return null; }
  return s;
}

function ivShow(on){
  // Interview sits on the thread pane. Leaving guardrails open would stack two work surfaces.
  if(on){ VEN.pane = "work"; renderVentureSheets(); }
  $("#ventureRead").hidden = on;
  $("#ventureIntake").hidden = !on;
  $("#ventureStartBtn").textContent = on ? "Back to the venture" : "Start a venture";
}
function ivDraftList(){
  const out = [];
  ivAnswers.forEach((text,n)=>out.push({ n:n, text:text }));
  return out;
}
function ivApi(path){ return "/api/venture/"+encodeURIComponent(ivSlug)+path; }

async function ivLoadAll(){
  const r = await fetch(ivApi("/intake/drafts"));
  const j = await r.json();
  ivAnswers = new Map();
  if(j.ok) for(const d of (j.drafts||[])) ivAnswers.set(d.n, d.text);
}
// Re-read the one question she just landed on. Cheap (a local file) and it means the box always
// shows what is actually stored, including a save that failed in another tab. Only ever called
// after a flush, so it can never overwrite text the debounce still owed.
async function ivLoadOne(n){
  try {
    const r = await fetch(ivApi("/intake/"+n+"/draft"));
    const j = await r.json();
    if(j.ok) ivAnswers.set(n, j.draft ? j.draft.text : (ivAnswers.get(n) || ""));
  } catch(e){ /* keep what is on screen; the save line already says if a write failed */ }
}

function ivPaintSave(){
  const el = $("#ivSave");
  if(!el) return;
  el.textContent = ivSaveLine(ivSave);
  el.className = "iv-save" + (ivSave.state === "failed" ? " bad" : "");
}
function ivPaintJump(){
  const el = $("#ivJump");
  if(el) el.innerHTML = ivJumpHtml();
}

async function ivSaveNow(n, text){
  ivSave = { state:"saving", savedAt:"", error:"" };
  ivPaintSave();
  const p = (async ()=>{
    try {
      const r = await fetch(ivApi("/intake/"+n+"/draft"), {
        method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({ text: text })
      });
      const j = await r.json();
      // "saved" is the server's word, and savedAt is the server's clock. Nothing here invents it.
      if(j.ok && j.draft){ ivSave = { state:"saved", savedAt: j.draft.savedAt, error:"" }; ivAnswers.set(n, j.draft.text); }
      else ivSave = { state:"failed", savedAt:"", error: j.error || "the server refused the save" };
    } catch(e){
      ivSave = { state:"failed", savedAt:"", error: String(e && e.message || e) };
    }
    ivPaintSave();
    ivPaintJump();
  })();
  ivFlight = p;
  await p;
  if(ivFlight === p) ivFlight = null;
}

function ivQueue(n, text){
  ivAnswers.set(n, text);
  ivDirty = n;
  ivPaintJump();
  if(ivTimer) clearTimeout(ivTimer);
  ivTimer = setTimeout(()=>{ ivTimer = null; ivDirty = 0; ivSaveNow(n, ivAnswers.get(n) || ""); }, IV_DEBOUNCE_MS);
}

// Everything that leaves a question -- next, back, a jump, the commit -- goes through here first.
// Without it the last thing she typed sits in the debounce and the commit reads a stale buffer.
async function ivFlush(){
  if(ivTimer){ clearTimeout(ivTimer); ivTimer = null; }
  const n = ivDirty;
  ivDirty = 0;
  if(n) await ivSaveNow(n, ivAnswers.get(n) || "");
  else if(ivFlight) await ivFlight;
}

async function ivGo(step){
  if(step < 1 || step > IV_SCORE_STEP) return;
  await ivFlush();
  ivRefusal = "";
  ivStep = step;
  if(step <= IV_TOTAL) await ivLoadOne(step);
  renderIntake();
  const box = $("#ivIn");
  if(box) box.focus();
}

async function ivEnter(slug){
  ivSlug = slug;
  ivStep = 1;
  ivRefusal = "";
  ivMissing = [];
  ivSave = { state:"", savedAt:"", error:"" };
  ivRemember(slug);
  await ivLoadAll();
  // Open on the first unanswered question, so resuming picks up where she stopped rather than
  // making her page through what she already wrote.
  const gaps = ivUnanswered(ivDraftList(), IV_TOTAL);
  ivStep = gaps.length ? gaps[0] : IV_VOICE_STEP;
  ivShow(true);
  renderIntake();
  const box = $("#ivIn");
  if(box) box.focus();
}

function ivExit(){
  ivSlug = null;
  ivShow(false);
}

function ivLines(s){ return String(s||"").split("\\n").map(x=>x.trim()).filter(Boolean); }

async function ivCommit(){
  if(ivBusy) return;
  await ivFlush();
  ivBusy = true;
  ivRefusal = "";
  renderIntake();
  const body = {
    voice: {
      writing_samples: ivLines(ivVoice.samples),
      worldview_statement: ivVoice.worldview,
      natural_phrases: ivLines(ivVoice.natural),
      refused_phrases_tones: ivLines(ivVoice.refused),
    },
    scorecard: {
      required_live_posts: Number(ivScore.posts),
      ongoing_pace: ivScore.pace,
      views_or_clicks_target: ivScore.views,
      opt_in_target: ivScore.optin,
      response_quality_test: ivScore.quality,
      sustainability_test: ivScore.sustain,
    },
  };
  let res = null;
  try {
    const r = await fetch(ivApi("/intake/commit"), { method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify(body) });
    res = await r.json();
  } catch(e){
    res = { ok:false, error: String(e && e.message || e) };
  }
  ivBusy = false;
  const out = (res && res.result) || res || {};
  if(!out.ok){
    // Verbatim. kickoffVenture's refusals name the qids that are missing and what the scorecard
    // still needs; rewording them here would throw away the useful half.
    ivRefusal = out.error || (res && res.error) || "the commit was refused";
    ivMissing = out.missing || [];
    renderIntake();
    return;
  }
  // Only now is the scratch buffer safe to drop -- the real answers are in intake.md.
  const newSlug = ivSlug;
  try { await fetch(ivApi("/intake/drafts/clear"), { method:"POST", headers:{"content-type":"application/json"}, body:"{}" }); } catch(e){}
  ivRemember(null);
  ivExit();
  flash(out.alreadyKickedOff ? (newSlug + " was already kicked off") : ("intake.md written: " + newSlug + " is on the desk"));
  ventureSlug = newSlug;
  await loadVentureList();
}

// ── render ───────────────────────────────────────────────────────────────────────────────────────

function ivJumpHtml(){
  const gaps = new Set(ivUnanswered(ivDraftList(), IV_TOTAL));
  let out = "";
  for(let n=1; n<=IV_TOTAL; n++){
    const cls = (gaps.has(n) ? "" : "done") + (n === ivStep ? " here" : "");
    out += '<button class="'+cls+'" data-ivgo="'+n+'" title="'+esc(IV_QUESTIONS[n-1].question)+'">'+n+'</button>';
  }
  return out;
}

function ivHeadHtml(){
  const answered = IV_TOTAL - ivUnanswered(ivDraftList(), IV_TOTAL).length;
  const pct = Math.round(answered / IV_TOTAL * 100);
  return '<div class="iv-head"><div class="vmono">'+esc(ivProgressLine(ivStep, IV_TOTAL))+'</div>'
    + '<span class="grow" style="flex:1"></span>'
    + '<div class="vmono">'+answered+' of '+IV_TOTAL+' answered</div></div>'
    + '<div class="iv-bar"><span style="width:'+pct+'%"></span></div>';
}

function ivField(key, label, sub, value, multiline){
  const tag = multiline
    ? '<textarea data-ivf="'+key+'" rows="'+(multiline===true?3:multiline)+'">'+esc(value)+'</textarea>'
    : '<input data-ivf="'+key+'" value="'+esc(value)+'">';
  return '<div class="iv-field"><div class="lbl">'+esc(label)+'</div>'
    + '<div class="sub">'+esc(sub)+'</div>'+tag+'</div>';
}

function ivRefusalHtml(){
  return ivRefusal ? '<div class="vrefusal">'+esc(ivRefusal)+'</div>' : "";
}

function ivQuestionHtml(){
  const q = IV_QUESTIONS[ivStep-1];
  return ivHeadHtml()
    + '<div class="iv-block">'+esc("Block "+q.block)+'</div>'
    + '<div class="iv-q">'+esc(q.question)+'</div>'
    + '<div class="iv-hint">Your words, stored exactly as you type them. Nothing here gets paraphrased, and nothing is drafted for you.</div>'
    + '<textarea class="iv-in" id="ivIn" data-ivq="'+ivStep+'">'+esc(ivAnswers.get(ivStep) || "")+'</textarea>'
    + '<div class="iv-save" id="ivSave">'+esc(ivSaveLine(ivSave))+'</div>'
    + '<div class="iv-nav">'
    + '<button id="ivBack"'+(ivStep===1?" disabled":"")+'>Back</button>'
    + '<button class="primary" id="ivNext">'+(ivStep===IV_TOTAL?"On to voice evidence":"Next")+'</button>'
    + '<span class="grow"></span>'
    + '<button id="ivLeave">Leave it for now</button>'
    + '</div>'
    + ivRefusalHtml()
    + '<div class="iv-jump" id="ivJump">'+ivJumpHtml()+'</div>';
}

function ivVoiceHtml(){
  return ivHeadHtml()
    + '<div class="iv-q">What your writing sounds like.</div>'
    + '<div class="iv-hint">Phase 1 drafts in your voice off this, so it is written into intake.md alongside the 25. One per line where a list is asked for.</div>'
    + '<div class="iv-panel">'
    + ivField("samples", "Writing samples", "One to three things you have written that sound like you. A link or the text itself.", ivVoice.samples, 3)
    + ivField("worldview", "Worldview statement", "The thing you believe that the drafts have to keep believing.", ivVoice.worldview, 3)
    + ivField("natural", "Phrases you use", "Words that are actually yours. One per line.", ivVoice.natural, 3)
    + ivField("refused", "Phrases and tones you refuse", "What you never want to see under your name. One per line.", ivVoice.refused, 3)
    + '</div>'
    + '<div class="iv-nav"><button id="ivBack">Back</button>'
    + '<button class="primary" id="ivNext">On to the Day 14 scorecard</button>'
    + '<span class="grow"></span><button id="ivLeave">Leave it for now</button></div>'
    + ivRefusalHtml();
}

function ivScoreHtml(){
  const disabled = ivBusy ? " disabled" : "";
  return ivHeadHtml()
    + '<div class="iv-q">What Day 14 gets scored against.</div>'
    + '<div class="iv-hint">Fixed now, not after the fact (venture/rules.md §4.4). Two of the fields are set by the rule itself and are not asked here: the eligible-response target (minimum 20, target 30) and the five final-decision options.</div>'
    + '<div class="iv-panel">'
    + ivField("posts", "Required live Phase 1 posts", "How many have to actually be live to count the phase as run.", ivScore.posts, false)
    + ivField("pace", "Ongoing posting pace", "In your own words. Nothing measures this for you.", ivScore.pace, false)
    + ivField("views", "Qualified views or clicks target", "If you have no baseline to set one from, say learning_only rather than picking a number.", ivScore.views, false)
    + '<button class="lo" data-ivlo="views">use learning_only</button>'
    + ivField("optin", "Landing-page opt-in target", "Same rule: learning_only if there is nothing to base a number on.", ivScore.optin, false)
    + '<button class="lo" data-ivlo="optin">use learning_only</button>'
    + ivField("quality", "Response-quality test", "How you will tell a useful response from a polite one.", ivScore.quality, 2)
    + ivField("sustain", "Sustainability test", "Measured against the time budget you gave in question 20.", ivScore.sustain, 2)
    + '</div>'
    + '<div class="iv-nav"><button id="ivBack"'+disabled+'>Back</button>'
    + '<button class="primary" id="ivCommit"'+disabled+'>'+(ivBusy?"Writing…":"Write intake.md")+'</button>'
    + '<span class="grow"></span><button id="ivLeave"'+disabled+'>Leave it for now</button></div>'
    + '<div class="iv-hint">This is the write. It creates venture/'+esc(ivSlug||"")+'/, renders intake.md from your 25 answers verbatim, and records the kickoff in canon. Nothing publishes.</div>'
    + ivRefusalHtml()
    + (ivMissing.length ? '<div class="iv-hint">Unanswered: '+ivMissing.join(", ")+'</div><div class="iv-jump" id="ivJump">'+ivJumpHtml()+'</div>' : "");
}

function ivStartHtml(){
  // The resume offer sits BESIDE the name field, never in front of it. Making it automatic would
  // mean that once one interview is half-finished there is no way to start a second: every click
  // of "Start a venture" would drop straight back into the first.
  const resume = ivResumable();
  return '<div class="vmono">START A VENTURE</div>'
    + (resume
        ? '<div class="iv-panel"><div class="iv-q">You left one unfinished.</div>'
          + '<div class="iv-hint">Your answers to '+esc(resume)+' are still on the server, exactly where you stopped.</div>'
          + '<div class="iv-nav"><button class="primary" id="ivResume">Pick up '+esc(resume)+'</button>'
          + '<button id="ivForget">Forget it</button></div></div>'
        : "")
    + '<div class="iv-q" style="margin-top:'+(resume?"26px":"0")+'">'+(resume?"Or start a new one.":"What should it be called?")+'</div>'
    + '<div class="iv-hint">Lowercase letters, numbers and dashes. This becomes venture/&lt;name&gt;/ on disk. Typing a name you already started brings those answers back too.</div>'
    + '<div class="iv-field"><input id="ivSlugIn" placeholder="voter-choice"></div>'
    + '<div class="iv-nav"><button class="primary" id="ivBegin">Begin the interview</button>'
    + '<span class="grow"></span><button id="ivLeave">Cancel</button></div>'
    + ivRefusalHtml();
}

function renderIntake(){
  const box = $("#intakeBox");
  if(!box) return;
  if(!ivSlug){ box.innerHTML = ivStartHtml(); const s = $("#ivSlugIn"); if(s) s.focus(); return; }
  const body = ivStep <= IV_TOTAL ? ivQuestionHtml() : ivStep === IV_VOICE_STEP ? ivVoiceHtml() : ivScoreHtml();
  box.innerHTML = '<div class="iv"><div class="vmono">INTAKE: '+esc(ivSlug)+'</div>'+body+'</div>';
}

// One delegated listener each, like the Venture thread above: renderIntake() replaces the whole
// subtree, so per-node handlers would be rebound on every navigation.
document.addEventListener("input", e=>{
  const t = e.target;
  if(!t || !t.closest || !t.closest("#ventureIntake")) return;
  if(t.id === "ivIn") return ivQueue(Number(t.dataset.ivq), t.value);
  const f = t.dataset && t.dataset.ivf;
  // The voice and scorecard panels are one sitting, not autosaved: the draft store holds question
  // numbers 1..25 and nothing else, and widening that contract to carry ten loose fields is a
  // bigger change than this screen needs. They live in memory until the commit.
  if(f && Object.prototype.hasOwnProperty.call(ivVoice, f)) ivVoice[f] = t.value;
  else if(f && Object.prototype.hasOwnProperty.call(ivScore, f)) ivScore[f] = t.value;
});
document.addEventListener("click", e=>{
  const t = e.target;
  if(!t || !t.closest) return;
  if(t.id === "ventureStartBtn"){
    if(ivSlug){ ivShow(false); ivSlug = null; return; }
    ivShow(true);
    ivRefusal = "";
    return renderIntake();
  }
  if(!t.closest("#ventureIntake")) return;

  if(t.id === "ivResume"){ const s = ivResumable(); return s ? ivEnter(s) : renderIntake(); }
  if(t.id === "ivForget"){ ivRemember(null); return renderIntake(); }

  if(t.id === "ivBegin"){
    const el = $("#ivSlugIn");
    const slug = (el ? el.value : "").trim();
    const bad = ivSlugError(slug);
    if(bad){ ivRefusal = bad + ": lowercase letters, numbers and dashes, starting with a letter or a number"; return renderIntake(); }
    if((VENTURE_SLUGS||[]).includes(slug)){ ivRefusal = slug + " already exists. Pick another name, or open it from the picker above."; return renderIntake(); }
    return ivEnter(slug);
  }
  if(t.id === "ivLeave"){ ivRemember(ivSlug); return ivExit(); }
  if(t.id === "ivBack") return ivGo(ivStep - 1);
  if(t.id === "ivNext") return ivGo(ivStep + 1);
  if(t.id === "ivCommit") return ivCommit();
  const lo = t.dataset && t.dataset.ivlo;
  if(lo){ ivScore[lo] = "learning_only"; return renderIntake(); }
  const go = t.closest("[data-ivgo]");
  if(go) return ivGo(Number(go.dataset.ivgo));
});

async function loadFiction(){
  const r = await fetch("/api/fiction");
  FICTION = (await r.json()).series || [];
  if(!FICTION.length){
    $("#fictionMain").innerHTML = '<div class="empty">No Fiction series is on the desk yet. Create a series in your existing story workflow, then return here to draft and check scenes.</div>';
    $("#fictionSide").innerHTML = "";
    renderCaptureHandoff();
    return;
  }
  if(!ficSeries || !FICTION.some(s=>s.slug===ficSeries)) ficSeries = FICTION[0].slug;
  const series = FICTION.find(s=>s.slug===ficSeries);
  if(ficPromoChapter==null && series.chapters && series.chapters.length) ficPromoChapter=series.chapters[0].chapter;
  if(!ficDocPath || !series.docs.some(d=>d.path===ficDocPath)) ficDocPath = series.docs[0].path;
  const dr = await fetch("/api/fiction/doc?series="+encodeURIComponent(ficSeries)+"&path="+encodeURIComponent(ficDocPath));
  ficDocData = await dr.json();
  const sr = await fetch("/api/fiction/scene?series="+encodeURIComponent(ficSeries));
  ficScene = await sr.json();
  if(ficPage==="promotion") await loadFictionPromotion();
  renderFiction();
  renderCaptureHandoff();
}
async function loadFictionPromotion(){
  if(!ficSeries || !ficPromoChapter){ ficPromoDraft=null; return; }
  try{
    const r=await fetch("/api/fiction/promotion?series="+encodeURIComponent(ficSeries)+"&chapter="+encodeURIComponent(ficPromoChapter));
    const d=await r.json(); ficPromoDraft=d.ok?d.draft:null; ficPromoError=d.ok?"":(d.error||"Could not load promotion draft");
  }catch(e){ ficPromoDraft=null; ficPromoError=e instanceof Error?e.message:String(e); }
}
function ficStatusWord(hasScene){
  const mine = (JOBS||[]).filter(j=>jobRoom(j.kind)==="Fiction");
  const newest = mine.length ? mine[mine.length-1] : null;
  if(mine.some(j=>j.status==="blocked")) return "waiting on your answer";
  if(newest && newest.status==="failed" && !hasScene) return "nothing written";
  if(mine.some(j=>j.status==="queued"||j.status==="running") && !hasScene) return "drafting";
  return hasScene ? "scene waiting on you" : "unwritten";
}
function ficHasScene(beats, chapter){
  return !!(String(beats||"").trim() && chapter && String(chapter.body||"").trim());
}
function ficStatusTone(w){
  if(w==="nothing written") return {fg:JC.red, bg:"#fdf1ef", bd:"#ecc9c0"};
  if(w==="drafting") return {fg:JC.ai, bg:"#efeafd", bd:"#ded5e9"};
  if(w==="unwritten") return {fg:"#8a7f6d", bg:"#f4efe3", bd:"#e6dcc4"};
  return {fg:JC.amber, bg:"#fdf8ec", bd:"#e8d5a8"};
}
function ficUnfixableLine(reason, occurrences){
  if(reason==="span-missing") return ${JSON.stringify(unfixableLine("span-missing"))};
  if(reason==="span-repeats") return "I cannot fix this one for you: that wording appears "+((typeof occurrences==="number"&&occurrences>1)?occurrences+" times":"more than once")+" in the chapter, so there is no single line to change.";
  if(reason==="no-replacement") return ${JSON.stringify(unfixableLine("no-replacement"))};
  return "";
}
function ficCheckRow(item, fixed){
  if(fixed) return {word:"fixed", color:JC.green, border:"#cbe0d1", rule:item.rule, text:'Reads "'+item.replacement+'" now. Changed in the draft.', canFix:false};
  if(item.kind==="conflict"){
    const canFix = !!(item.fixable && item.span && item.replacement);
    const why = canFix ? "" : ficUnfixableLine(item.unfixableReason||"", item.occurrences);
    return {word:"conflict", color:JC.amber, border:"#e8d5a8", rule:item.rule, text:(why ? (item.note+" "+why).trim() : item.note), canFix:canFix};
  }
  return {word:"holds", color:JC.green, border:"#cbe0d1", rule:item.rule, text:item.note, canFix:false};
}
function ficCanonStamp(rep){
  if(!rep) return "";
  const holds = (rep.holds||[]).length, conflicts = (rep.conflicts||[]).length;
  return "checked "+(rep.checkedAt||"").slice(0,10)+" · "+holds+" holding · "+conflicts+" breaking";
}
function ficParagraphs(body){
  return String(body||"").replace(/\\r\\n/g,"\\n").trim().split(/\\n\\s*\\n/)
    .map(p=>p.split("\\n").map(l=>l.trim()).filter(Boolean).join(" ")).filter(Boolean);
}
function ficEditableSpans(body){
  return String(body||"").replace(/\\r\\n/g,"\\n").trim().split(/\\n\\s*\\n/).map(span=>span.trim()).filter(Boolean);
}
function ficPassJob(){
  const mine = (JOBS||[]).filter(j=>j.kind==="fiction-draft"&&(j.status==="queued"||j.status==="running"));
  return mine.length ? mine[mine.length-1] : null;
}
function ficFailedJob(){
  const mine = (JOBS||[]).filter(j=>jobRoom(j.kind)==="Fiction");
  const newest = mine.length ? mine[mine.length-1] : null;
  return newest && newest.status==="failed" ? newest : null;
}
function renderFiction(){
  const series = FICTION.find(s=>s.slug===ficSeries);
  const d = ficDocData;
  const doc = series.docs.find(x=>x.path===ficDocPath);
  const sc = ficScene || {};
  const chapter = sc.chapter || null;
  const beats = (sc.beats||"").trim();
  const rep = sc.continuity || null;
  const hasScene = ficHasScene(beats, chapter);
  const word = ficStatusWord(hasScene);
  const tone = ficStatusTone(word);
  const passJob = ficPassJob();
  const failed = ficFailedJob();
  const history = (d.history||[]).length ? '<details class="lead-details" style="margin-top:10px"><summary>Version history</summary><div class="ntext" style="font-size:12px">'+d.history.map(esc).join("<br>")+'</div></details>' : "";

  const head =
    '<div style="display:flex;align-items:center;gap:11px;flex-wrap:wrap">'+
      '<span class="wb-label" style="margin:0">'+esc(series.title)+'</span>'+
      '<span style="font:10px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;color:'+tone.fg+';background:'+tone.bg+';border:1px solid '+tone.bd+';border-radius:4px;padding:2px 7px">'+esc(word)+'</span>'+
    '</div>';

  const composer =
    '<div style="font:400 27px/1.35 Georgia,serif;margin:6px 0 18px;max-width:520px">What happens next?</div>'+
    '<div style="background:#fffdf8;border:1px solid #d8cfbb;border-radius:8px;padding:20px 22px;max-width:600px">'+
      '<textarea id="ficBeats" rows="5" placeholder="Say the beats. Who is in it, what turns, what you want it to feel like." style="width:100%;box-sizing:border-box;border:none;background:transparent;padding:0;resize:vertical;font:400 18px/1.6 Georgia,serif;color:var(--ink)">'+esc(beats)+'</textarea>'+
      '<div style="display:flex;align-items:center;gap:14px;margin-top:14px;padding-top:14px;border-top:1px solid #efe7d6">'+
        engineSelectHtml()+
        '<button class="primary" id="ficDraftBtn" style="flex:none;white-space:nowrap">'+(beats?'Draft another pass':'Draft it')+'</button>'+
        '<span class="src">It writes a first pass and checks the canon while it goes. You read it before anything is kept.</span>'+
      '</div>'+
    '</div>';

  const anchor = !beats ? '' :
    '<div style="max-width:600px;margin-top:14px">'+
      '<div class="wb-margin-cap">YOUR BEATS · KEPT AS THE ANCHOR FOR THIS SCENE</div>'+
      '<div style="margin-top:9px;border-left:2px solid '+JC.blue+';padding-left:18px;font:400 18px/1.6 Georgia,serif;color:var(--ink);white-space:pre-wrap">'+esc(beats)+'</div>'+
      '<button id="ficStartOver" style="margin-top:12px;border:none;background:none;padding:0;font-size:12.5px;color:#7a7266;border-bottom:1px solid #d8cfbb;cursor:pointer">Start a different scene</button>'+
    '</div>';

  const failCard = !failed ? '' :
    '<div style="margin-top:22px;max-width:600px;border:1px solid #ecc9c0;background:#fdf1ef;border-radius:9px;padding:15px 17px">'+
      '<div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap">'+
        '<span style="font:10px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;color:'+JC.red+'">NOTHING WRITTEN · WHERE IT STOPPED</span>'+
        '<span style="flex:1"></span>'+
        '<span class="mono-note">'+esc(jobClock(failed, 0))+'</span>'+
      '</div>'+
      jobStepDots(failed).map(sd=>'<div style="display:grid;grid-template-columns:7px minmax(0,1fr);gap:11px;align-items:baseline;margin-top:7px"><span style="width:6px;height:6px;border-radius:50%;background:'+dotColor(sd.state)+';margin-top:6px"></span><span style="font-size:13px;line-height:1.5">'+esc(sd.text)+'</span></div>').join("")+
      '<div style="font-size:13px;line-height:1.55;margin-top:11px">'+esc(failed.error||"It stopped where the red dot is.")+'</div>'+
      (failed.retryable ? '<div class="actions" style="margin-top:13px"><button data-retry="'+esc(failed.id)+'">Run it again</button></div>' : '')+
    '</div>';

  const spans = hasScene ? ficEditableSpans(chapter.body) : [];
  const reviewHistory = (sc.comments||[]).length
    ? '<details class="lead-details" open style="margin-top:16px;max-width:600px"><summary>Review history · '+sc.comments.length+'</summary>'+(sc.comments||[]).map(item=>'<div class="src" style="margin-top:9px"><strong>'+esc(String(item.createdAt||"").slice(0,16).replace("T"," "))+'</strong><br>'+esc(item.body)+'</div>').join("")+'</details>'
    : '<div class="src" style="margin-top:12px">Review history starts when you request a second pass.</div>';
  const scene = !hasScene ? '' :
    '<div style="display:flex;align-items:baseline;gap:10px;margin:32px 0 11px">'+
      '<span style="font:600 13px/1 Georgia,serif;color:'+JC.ai+'">The scene, from your beats</span>'+
      '<span class="src" style="font-style:italic">chapter '+chapter.number+(chapter.title?' · '+esc(chapter.title):'')+' · your beats, its prose</span>'+
    '</div>'+
    '<div style="max-width:600px;display:flex;flex-direction:column;gap:15px;padding-left:18px;border-left:2px solid '+JC.ai+'">'+
      spans.map((t,i)=>'<div data-passage="'+i+'"><div style="font:400 18px/1.8 Georgia,serif;color:'+JC.ai+';white-space:pre-wrap">'+esc(t)+'</div><button type="button" data-edit-passage="'+i+'" style="margin-top:5px;border:none;background:none;padding:0;color:#756b9a;font-size:12px;cursor:pointer">Edit passage</button></div>').join("")+
    '</div>'+
    '<div style="margin-top:22px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">'+
      '<button id="ficRecheck">Check the canon again</button>'+
      engineSelectHtml()+
      '<span class="src" style="max-width:340px">It is written to stories/'+esc(ficSeries)+'/'+esc(chapter.path)+'. A passage edit saves to this draft, but final acceptance and commit history stay in the story PR.</span>'+
    '</div>'+
    '<div style="margin-top:26px;max-width:600px">'+
      '<div class="wb-margin-cap">SECOND PASS · SAY WHAT TO CHANGE</div>'+
      '<div style="display:flex;gap:10px;align-items:center;border:1px solid #d8cfbb;background:#fffdf8;border-radius:8px;padding:9px 13px;margin-top:8px">'+
        '<input id="ficPass" value="'+esc(ficPassNote)+'" placeholder="More tension, less explaining" style="flex:1;min-width:0;border:none;background:transparent;font:400 16px/1.5 Georgia,serif;color:var(--ink)" />'+
        engineSelectHtml()+
        '<button class="primary" id="ficPassBtn"'+(passJob?' disabled':'')+' style="white-space:nowrap">Run it again</button>'+
      '</div>'+
      '<div class="src" style="margin-top:8px">'+(passJob
        ? 'It is running now. The draft above does not move until the new one lands.'
        : 'It runs as its own job, with the real time on it. Nothing overwrites the draft above until you read the new one.')+'</div>'+reviewHistory+
    '</div>'+
    '<div style="margin:38px 0 0;display:flex;align-items:center;gap:12px"><span style="height:1px;flex:1;background:#efe7d6"></span><span style="font:italic 400 14px/1 Georgia,serif;color:#a89a80">the canon underneath it</span><span style="height:1px;flex:1;background:#efe7d6"></span></div>';

  const stageNav='<nav class="room-pages" aria-label="Fiction pages">'+[["write","Write next"],["review","Review drafts"],["promotion","Promotion"]].map(([id,label])=>'<button type="button" class="'+(ficPage===id?'on':'')+'" data-fiction-page="'+id+'">'+label+'</button>').join('')+'</nav>';
  const chapterOptions=(series.chapters||[]).map(ch=>'<option value="'+ch.chapter+'"'+(Number(ficPromoChapter)===ch.chapter?' selected':'')+'>'+esc(ch.label)+'</option>').join("");
  if(ficPromoChapter==null&&series.chapters&&series.chapters.length) ficPromoChapter=series.chapters[0].chapter;
  const intake='<div style="margin-top:24px"><div class="wb-label">OPTIONAL STORY PROMOTION</div><h3>Promote a finished chapter</h3><p class="src">This is separate from writing the story. Choose a locked chapter and say what the promotion should do; approved copy can then move to Content.</p><label class="wb-label" for="ficPromoChapter">SERIES / CHAPTER</label><select id="ficPromoChapter" style="width:100%;max-width:520px">'+chapterOptions+'</select><label class="wb-label" for="ficPromoRequest" style="display:block;margin-top:18px">WHAT SHOULD THIS PROMOTION DO?</label><textarea id="ficPromoRequest" rows="5" style="width:100%;max-width:600px" placeholder="Describe the launch note, audience, and spoiler boundary.">'+esc(ficPromoRequest)+'</textarea><label class="wb-label" for="ficPromoObjective" style="display:block;margin-top:18px">SUGGESTED OBJECTIVE</label><input id="ficPromoObjective" style="width:100%;max-width:600px" value="'+esc(ficPromoObjective)+'"></div>';
  const canonPanel=
    '<div class="wb-label" style="margin-top:34px">The philosophy · your canon</div>'+
    '<div style="font:400 27px/1.35 Georgia,serif;margin:2px 0 14px;">'+esc(doc.label)+'</div>'+
    '<div id="ficBody" style="font:400 16px/1.75 Georgia,serif;border:1px dashed #e0d6c0;border-radius:8px;padding:20px 22px;background:#fcfbf7;white-space:pre-wrap;max-height:520px;overflow:auto;">'+esc(d.body)+'</div>'+
    '<div class="actions" style="margin-top:12px">'+
      (doc.editable
        ? '<button class="primary" id="ficEditBtn">Edit in place</button><span class="src">Saves straight to your canon. What you save here is what the drafts build from.</span>'
        : '<span class="src">Append-only: /story lock writes this ledger; the desk only reads it.</span>')+
    '</div>'+history+
    '<div style="margin-top:26px;padding-top:16px;border-top:1px solid #efe7d6;" class="src">First passes happen here, checked against this canon as they are written. Line editing and the commit history stay in your GitHub flow (/story), where you already work sentence by sentence.</div>';
  const promoHistory=ficPromoDraft&&ficPromoDraft.revisionHistory&&ficPromoDraft.revisionHistory.length
    ? '<details class="lead-details" style="margin-top:14px"><summary>Revision history · '+ficPromoDraft.revisionHistory.length+'</summary>'+ficPromoDraft.revisionHistory.map((item,i)=>'<div class="src" style="margin-top:8px">'+(i+1)+' · '+esc(item.kind)+(item.model?' · '+esc(item.model):'')+(item.instruction?' · '+esc(item.instruction):'')+'</div>').join("")+'</details>' : '';
  const promoDraftPanel=!ficPromoDraft
    ? '<div style="margin-top:28px;max-width:680px"><div class="wb-label">PROMOTIONAL DRAFT</div><p class="src">Uses the approved chapter and locked quote passages selected in Intake. It never edits the story chapter.</p>'+
      (ficPromoError?'<div class="fam-note t-amber">'+esc(ficPromoError)+'</div>':'')+
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">'+engineSelectHtml("ficPromoEngine")+'<button type="button" class="primary" id="ficPromoDraftCreate"'+(ficPromoBusy||!String(ficPromoRequest).trim()?' disabled':'')+'>'+(ficPromoBusy?'Drafting…':'Draft promotion')+'</button></div></div>'
    : '<div style="margin-top:28px;max-width:760px"><div style="display:flex;align-items:center;gap:10px"><div class="wb-label" style="margin:0">PROMOTIONAL DRAFT</div><span class="pill">'+esc(ficPromoDraft.state)+'</span></div>'+
      '<textarea id="ficPromoBody" rows="14" style="width:100%;box-sizing:border-box;margin-top:12px;font:400 17px/1.65 Georgia,serif">'+esc(ficPromoDraft.body)+'</textarea>'+
      '<div class="actions"><button type="button" id="ficPromoSave"'+(ficPromoBusy?' disabled':'')+'>Save direct edit</button><button type="button" class="primary" id="ficPromoApprove"'+(ficPromoBusy||ficPromoDraft.state==='Approved'?' disabled':'')+'>Approve final</button><button type="button" id="ficPromoReject"'+(ficPromoBusy?' disabled':'')+'>Reject</button></div>'+
      '<div class="wb-margin-cap" style="margin-top:22px">TARGETED AI REVISION</div><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px"><input id="ficPromoInstruction" style="flex:1;min-width:260px" placeholder="Ask for one focused change">'+engineSelectHtml("ficPromoRevisionEngine")+'<button type="button" id="ficPromoRevise"'+(ficPromoBusy?' disabled':'')+'>Request revision</button></div>'+
      '<div class="wb-margin-cap" style="margin-top:22px">PLATFORM / MEDIA PREVIEWS</div><div class="stat-tiles">'+(ficPromoDraft.previews||[]).map(p=>'<div class="stat-tile"><strong>'+esc(p.label)+'</strong><span class="l">'+esc(p.platform)+' · '+esc(p.media)+'</span></div>').join("")+'</div>'+promoHistory+(ficPromoError?'<div class="fam-note t-amber">'+esc(ficPromoError)+'</div>':'')+'</div>';
  const finalPanel=head+(ficPromoDraft&&ficPromoDraft.state==='Approved'
    ? '<div style="max-width:680px;margin-top:22px"><div class="wb-label">APPROVED PROMOTIONAL FINAL</div><div style="white-space:pre-wrap;font:400 18px/1.7 Georgia,serif">'+esc(ficPromoDraft.body)+'</div></div>'
    : '<div class="empty">No approved promotional final is available yet. Draft and approve the promotion before handing it to Content.</div>')+
    '<div style="margin-top:26px;padding:18px;border:1px solid #d8cfbb;border-radius:8px;background:#fffdf8"><div class="wb-label">CONTENT HANDOFF</div><p class="src">Creates a durable Content source from the approved promotional final, the selected locked chapter, its quoteable passages, canon restrictions, fiction origin, and your promotion request. It publishes nothing.</p><button type="button" class="primary" id="ficPromoNote"'+(!(ficPromoDraft&&ficPromoDraft.state==='Approved')?' disabled':'')+'>Send approved final to Content</button></div>';
  const promotionPage=intake+promoDraftPanel+(ficPromoDraft&&ficPromoDraft.state==='Approved'?finalPanel:'');
  const reviewPage=head+(hasScene?anchor+failCard+scene:'<div class="empty">No draft yet. Add your direction in Write next, then draft a first pass.</div>')+
    '<div class="src" style="max-width:680px;margin-top:24px;padding-top:16px;border-top:1px solid #efe7d6">Direct line edits and final acceptance happen in the story PR. Use the revision note here to ask for another focused pass; the canonical chapter is never silently overwritten.</div>';
  $("#fictionMain").innerHTML = stageNav+(ficPage==="write"?head+composer+failCard:ficPage==="review"?reviewPage:ficPage==="canon"?canonPanel:promotionPage);

  const rows = [].concat(rep?rep.conflicts||[]:[], rep?rep.holds||[]:[]);
  const checks = rows.length
    ? rows.map((it,i)=>{
        const r = ficCheckRow(it, !!ficFixed[it.span]);
        return '<div style="display:flex;flex-direction:column;gap:6px;padding-left:12px;border-left:2px solid '+r.border+'">'+
          '<span style="font-size:12.5px;font-weight:600"><span style="color:'+r.color+'">'+esc(r.word)+'</span> · '+esc(r.rule)+'</span>'+
          '<span style="font-size:12.5px;line-height:1.5;color:#5a5346">'+esc(r.text)+'</span>'+
          (r.canFix ? '<button data-fix="'+i+'" style="width:fit-content;margin-top:2px;font-size:11.5px;background:none;border:1px solid '+JC.amber+';color:'+JC.amber+';border-radius:5px;padding:3px 8px;cursor:pointer">Fix the line</button>' : '')+
        '</div>';
      }).join("")
    : '<div class="src">'+(hasScene
        ? 'Nothing came back from the last check. Run it again after an edit.'
        : 'Nothing to check yet. This fills in when a draft exists, one line per rule it read, and it says which ones broke.')+'</div>';

  $("#fictionSide").innerHTML =
    '<div class="wb-margin-cap">CHECKED AGAINST YOUR CANON</div>'+
    '<div style="display:flex;flex-direction:column;gap:14px;margin:10px 0 4px">'+checks+'</div>'+
    (rep ? '<div class="mono-note">'+esc(ficCanonStamp(rep))+'</div>' : '')+
    '<div style="height:1px;background:#efe7d6;margin:14px 0"></div>'+
    '<div class="wb-margin-cap">YOUR CANON · CLICK TO OPEN</div>'+
    series.docs.map(x=>'<div class="lead-chip'+(x.path===ficDocPath?" on":"")+'" style="display:flex" data-path="'+esc(x.path)+'">'+esc(x.label)+'</div>').join("")+
    '<div class="wb-reply"><div class="wb-margin-cap">PROMOTION BRIDGE</div><span class="mono-note">Only Final can hand an approved chapter to Content. The route validates the lock and quote provenance before writing anything.</span></div>';

  refreshEngineControls($("#fictionMain"));
  document.querySelectorAll("#fictionMain [data-fiction-page]").forEach(button=>button.addEventListener("click",async ()=>{
    ficPromoRequest=$("#ficPromoRequest")?.value??ficPromoRequest;
    ficPromoObjective=$("#ficPromoObjective")?.value??ficPromoObjective;
    ficPromoChapter=Number($("#ficPromoChapter")?.value||ficPromoChapter);
    ficPage=button.dataset.fictionPage;
    if(ficPage==="promotion") await loadFictionPromotion();
    renderFiction();
  }));
  $("#ficPromoRequest")?.addEventListener("input",e=>{ ficPromoRequest=e.target.value; });
  $("#ficPromoObjective")?.addEventListener("input",e=>{ ficPromoObjective=e.target.value; });
  $("#ficPromoChapter")?.addEventListener("change",async e=>{ ficPromoChapter=Number(e.target.value); ficPromoDraft=null; await loadFictionPromotion(); });
  const promoCreate=$("#ficPromoDraftCreate");
  if(promoCreate) promoCreate.addEventListener("click",async ()=>{
    const engine=$("#ficPromoEngine")?.value||"codex";
    ficPromoBusy=true; ficPromoError=""; renderFiction();
    const chapterInfo=(series.chapters||[]).find(item=>item.chapter===Number(ficPromoChapter));
    const result=await post("/api/fiction/promotion/draft",{series:ficSeries,chapter:ficPromoChapter,descriptor:series.title+" · "+(chapterInfo?chapterInfo.label:"Chapter "+ficPromoChapter)+" promotion",originalInput:ficPromoRequest,objective:ficPromoObjective,engine});
    ficPromoBusy=false; if(result.ok){ficPromoDraft=result.draft;flash("Promotional draft ready");}else ficPromoError=result.error||"Could not draft promotion"; renderFiction();
  });
  const promoSave=$("#ficPromoSave");
  if(promoSave) promoSave.addEventListener("click",async ()=>{
    const result=await post("/api/fiction/promotion/save",{series:ficSeries,chapter:ficPromoChapter,body:$("#ficPromoBody").value});
    if(result.ok){ficPromoDraft=result.draft;ficPromoError="";flash("Direct edit saved");}else ficPromoError=result.error||"Could not save"; renderFiction();
  });
  const promoRevise=$("#ficPromoRevise");
  if(promoRevise) promoRevise.addEventListener("click",async ()=>{
    const instruction=$("#ficPromoInstruction").value.trim(); if(!instruction){flash("Ask for one focused change first");return;}
    const engine=$("#ficPromoRevisionEngine")?.value||"codex";
    ficPromoBusy=true;ficPromoError="";renderFiction();
    const result=await post("/api/fiction/promotion/revise",{series:ficSeries,chapter:ficPromoChapter,instruction,engine});
    ficPromoBusy=false;if(result.ok){ficPromoDraft=result.draft;flash("Targeted revision ready");}else ficPromoError=result.error||"Could not revise";renderFiction();
  });
  for(const pair of [["ficPromoApprove","Approved"],["ficPromoReject","Rejected"]]){
    const button=$("#"+pair[0]); if(button) button.addEventListener("click",async ()=>{
      const result=await post("/api/fiction/promotion/status",{series:ficSeries,chapter:ficPromoChapter,state:pair[1]});
      if(result.ok){ficPromoDraft=result.draft;ficPromoError="";flash(pair[1]==="Approved"?"Promotion approved":"Promotion rejected");}else ficPromoError=result.error||"Could not update status";renderFiction();
    });
  }
  document.querySelectorAll("#fictionSide .lead-chip").forEach(c=>c.addEventListener("click",()=>{ ficDocPath=c.dataset.path; ficPage="canon"; loadFiction(); }));
  const draftBtn = $("#ficDraftBtn");
  if(draftBtn) draftBtn.addEventListener("click", ()=>{
    const t = ($("#ficBeats").value||"").trim();
    if(!t){ flash("Say the beats first"); return; }
    const engine = draftBtn.closest("div")?.querySelector(".engine-select")?.value || "claude";
    post("/api/fiction/draft",{series:ficSeries, beats:t, engine}).then(r=>{
      if(r.ok){ flash("Drafting with "+engineLabel(engine)+". It checks the canon while it goes."); loadFiction(); }
      else flash(r.error||"Could not start it");
    });
  });
  const startOver = $("#ficStartOver");
  if(startOver) startOver.addEventListener("click", ()=>{
    post("/api/fiction/beats/clear",{series:ficSeries}).then(()=>{ ficFixed={}; ficPassNote=""; loadFiction(); });
  });
  const passInput = $("#ficPass");
  if(passInput) passInput.addEventListener("input", e=>{ ficPassNote = e.target.value; });
  const passBtn = $("#ficPassBtn");
  if(passBtn) passBtn.addEventListener("click", ()=>{
    const note = (ficPassNote||"").trim();
    if(!note){ flash("Say what to change first"); return; }
    const engine = passBtn.closest("div")?.querySelector(".engine-select")?.value || "claude";
    post("/api/fiction/repass",{series:ficSeries, chapter:chapter.number, note:note, engine}).then(r=>{
      if(r.ok){ ficPassNote=""; flash(r.historyWarning||("Second pass queued with "+engineLabel(engine)+". The draft above stays until it lands.")); loadFiction(); }
      else flash(r.error||"Could not start it");
    });
  });
  document.querySelectorAll("#fictionMain [data-edit-passage]").forEach(button=>button.addEventListener("click",()=>{
    const index=Number(button.dataset.editPassage); const span=spans[index];
    const wrap=button.closest("[data-passage]"); if(!wrap||span===undefined)return;
    wrap.innerHTML='<textarea rows="7" style="width:100%;box-sizing:border-box;font:400 17px/1.65 Georgia,serif">'+esc(span)+'</textarea><div class="actions"><button type="button" data-save-passage>Save passage</button><button type="button" data-cancel-passage>Cancel</button></div>';
    wrap.querySelector("[data-cancel-passage]").addEventListener("click",renderFiction);
    wrap.querySelector("[data-save-passage]").addEventListener("click",async ()=>{
      const replacement=wrap.querySelector("textarea").value;
      const result=await post("/api/fiction/fix",{series:ficSeries,chapter:chapter.number,span,replacement});
      if(result.ok){flash("Passage saved to the draft");await loadFiction();}else flash(result.error||"Could not save that passage");
    });
  }));
  const recheck = $("#ficRecheck");
  if(recheck) recheck.addEventListener("click", ()=>{
    const engine = recheck.closest("div")?.querySelector(".engine-select")?.value || "claude";
    post("/api/fiction/check",{series:ficSeries, chapter:chapter.number, engine}).then(r=>{
      if(r.ok){ flash("Reading it against your canon with "+engineLabel(engine)); loadFiction(); } else flash(r.error||"Could not start it");
    });
  });
  document.querySelectorAll("#fictionSide [data-fix]").forEach(b=>b.addEventListener("click", ()=>{
    const it = rows[Number(b.dataset.fix)];
    post("/api/fiction/fix",{series:ficSeries, chapter:chapter.number, span:it.span, replacement:it.replacement}).then(r=>{
      if(r.ok){ ficFixed[it.span]=true; flash("Line fixed in the draft"); loadFiction(); }
      else flash(r.error||"Could not fix that line");
    });
  }));
  document.querySelectorAll("#fictionMain [data-retry]").forEach(b=>b.addEventListener("click", ()=>{
    post("/api/jobs/"+encodeURIComponent(b.dataset.retry)+"/retry",{}).then(r=>{
      if(r.ok){ flash("Running it again"); loadFiction(); } else flash(r.error||"Could not run it again");
    });
  }));
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
  if(promo) promo.addEventListener("click", async ()=>{
    promo.disabled=true;
    const descriptor=series.title+" · chapter "+ficPromoChapter+" launch";
    const result=await post("/api/fiction/handoff",{slug:"fiction-handoff",series:ficSeries,chapter:Number(ficPromoChapter),descriptor,originalInput:ficPromoRequest,suggestedPromotionalObjective:ficPromoObjective});
    if(!result.ok){ promo.disabled=false; flash(result.error||"Could not create the Content handoff"); return; }
    await setRoom("content");
    CW.slug=result.request.id; CW.step=2; CW.pane="wizard"; CW.config=null; CW.treat=null; CW.treatFor=null; renderContentWizard(); cwLoadTreatment();
    flash("Fiction handoff opened in Content configuration");
  });
}

async function draftCharles(){
  const input = $("#charlesInput").value.trim();
  const replySource = $("#charlesReplyInput").value.trim();
  const modes=[...document.querySelectorAll(".charles-format:checked")].map(x=>x.value);
  if(!modes.length){ flash("Choose at least one format"); return; }
  if(modes.includes("reply") && !replySource){ flash("Paste a URL or quoted post before queueing a reply"); return; }
  const btn = $("#charlesDraftBtn");
  btn.disabled = true; btn.textContent = "Queueing checked formats…";
  const engine=$("#charlesEngine").value;
  const results=[];
  for(const mode of modes) results.push({mode,result:await post("/api/charles/draft", {
    mode, input:mode==="reply" ? replySource+(input ? "\\nRequested angle: "+input : "") : input, engine,
  })});
  btn.disabled = false; btn.textContent = "Draft";
  const ok=results.filter(x=>x.result.ok), failed=results.filter(x=>!x.result.ok);
  if(ok.length){
    $("#charlesInput").value = "";
    $("#charlesReplyInput").value = "";
    charlesId = ok[ok.length-1].result.id;
    charlesPage = "needs-review";
    flash("Queued "+ok.map(x=>typeLabel(x.mode)).join(", ")+" with "+engineLabel(engine)+(failed.length?"; failed: "+failed.map(x=>typeLabel(x.mode)).join(", "):""));
    if(currentTab==="charles") loadCharles();
  } else flash(failed.map(x=>typeLabel(x.mode)+": "+(x.result.error||"failed")).join("; "));
}
function renderCharlesReplySource(){
  $("#charlesReplySource").hidden = ![...document.querySelectorAll(".charles-format:checked")].some(x=>x.value==="reply");
}
document.querySelectorAll(".charles-format").forEach(x=>x.addEventListener("change", renderCharlesReplySource));
renderCharlesReplySource();
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
let charlesPage = "input";
function renderCharlesPages(){
  $("#charlesInputPane").hidden=charlesPage!=="input";
  $("#charlesDraftPane").hidden=charlesPage==="input";
  document.querySelectorAll("[data-charles-page]").forEach(button=>button.classList.toggle("on",button.dataset.charlesPage===charlesPage));
}
function charlesVisiblePosts(){
  if(charlesPage==="needs-review") return CHARLES_POSTS.filter(post=>post.status==="pending"||post.status==="revise");
  if(charlesPage==="approved") return CHARLES_POSTS.filter(post=>post.status==="approve");
  if(charlesPage==="all") return CHARLES_POSTS;
  return [];
}
document.querySelectorAll("[data-charles-page]").forEach(button=>button.addEventListener("click",()=>{
  charlesPage=button.dataset.charlesPage;
  const visible=charlesVisiblePosts(); if(visible.length&&!visible.some(post=>post.id===charlesId)) charlesId=visible[0].id;
  renderCharles(); renderCharlesPages();
}));
function typeLabel(t){ return t==="one-liner" ? "One-liner" : t==="essay" ? "Essay" : t==="reply" ? "Reply" : t; }
async function loadCharles(){
  loadCharlesBrief();
  const r = await fetch("/api/charles");
  CHARLES_POSTS = (await r.json()).posts || [];
  if(!CHARLES_POSTS.length){
    $("#charlesMain").innerHTML = '<div class="empty">Nothing drafted yet. Pick a mode above and hit Draft.</div>';
    $("#charlesDraftList").innerHTML = "";
    renderCharlesPages(); return;
  }
  if(!charlesId || !CHARLES_POSTS.some(p=>p.id===charlesId)) charlesId = CHARLES_POSTS[0].id;
  renderCharles();
  renderCharlesPages();
}
function renderCharles(){
  const visible = charlesVisiblePosts();
  const post = visible.find(p=>p.id===charlesId) || visible[0];
  if(!post){
    $("#charlesMain").innerHTML='<div class="empty">Nothing in this view.</div>';
    $("#charlesDraftList").innerHTML=""; return;
  }
  charlesId=post.id;
  const reviewHistory=(post.comments||[]).length
    ? '<details class="lead-details" open style="margin-top:18px"><summary>Review history · '+post.comments.length+'</summary>'+post.comments.map(item=>'<div class="src" style="margin-top:9px"><strong>'+esc(String(item.createdAt||"").slice(0,16).replace("T"," "))+'</strong><br>'+esc(item.body)+'</div>').join("")+'</details>'
    : '<div class="src" style="margin-top:14px">Review history starts when you save a revision note.</div>';
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
      (post.status==="approve"?'<button class="primary" data-act="content-handoff">Send approved draft to Content</button>':"")+
      '<button id="charlesEditBtn" data-act="edit">Edit in place</button>'+
    '</div>'+
    '<div class="revisebox" id="charlesRevisebox"><input placeholder="what needs changing?" value="" /><button data-act="save-note">Save note</button></div>'+reviewHistory+
    '<div style="margin-top:26px;padding-top:16px;border-top:1px solid #efe7d6;" class="src">Approving here does not post anything. An approved output can enter Content with Charles identity and CTA restrictions for optional treatments, media, and routing.</div>';
  $("#charlesDraftList").innerHTML =
    '<div class="wb-margin-cap">DRAFTS · CLICK TO OPEN</div>'+
    visible.map(p=>'<div class="lead-chip'+(p.id===charlesId?" on":"")+'" style="display:flex;flex-direction:column;align-items:flex-start;gap:2px" data-id="'+esc(p.id)+'">'+
      '<span>'+esc(typeLabel(p.type))+' · '+esc(p.id)+'</span>'+
      '<span class="pill '+pillClass(p.status)+'" style="font-size:10px">'+esc(statusLabel(p.status))+'</span>'+
    '</div>').join("");
  document.querySelectorAll("#charlesDraftList .lead-chip").forEach(c=>c.addEventListener("click",()=>{ charlesId=c.dataset.id; renderCharles(); }));
  $("#charlesMain").querySelectorAll("[data-act]").forEach(b=>b.addEventListener("click", (e)=>onCharlesAction(e.target.dataset.act, post)));
}
async function onCharlesAction(act, item){
  if (act === "approve" || act === "discard"){
    const r = await post("/api/charles/status", {id:item.id, status:act});
    if (r.ok===false){ flash(r.error||"Failed"); return; }
    flash(act==="approve" ? "Approved: paste it to Substack when ready" : "Discarded");
    loadCharles();
  } else if (act === "revise"){
    $("#charlesRevisebox").classList.toggle("show");
  } else if (act === "save-note"){
    const noteInput = $("#charlesRevisebox input");
    const note = noteInput.value;
    const operationId=noteInput.dataset.operationId||(noteInput.dataset.operationId=(globalThis.crypto&&crypto.randomUUID?crypto.randomUUID():(Date.now()+"-"+Math.random())));
    const r = await post("/api/charles/status", {id:item.id, status:"revise", notes:note, operationId});
    if (r.ok===false){ flash(r.error||"Failed"); return; }
    flash(r.historyWarning||"Marked revise");
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
  } else if (act === "content-handoff"){
    const result=await post("/api/charles/handoff",{postId:item.id,thought:item.body,selectedOutputs:[item.type],descriptor:"Charles · "+typeLabel(item.type),originalInput:item.body});
    if(!result.ok){ flash(result.error||"Could not create the Content handoff"); return; }
    await setRoom("content");
    CW.slug=result.request.id; CW.step=2; CW.pane="wizard"; CW.config=null; CW.treat=null; CW.treatFor=null; renderContentWizard(); cwLoadTreatment();
    flash("Charles draft opened in Content configuration");
  }
}

// ── Signals room (Content Studio Riff 3e) ──
// Deterministic read of the latest brief: per-channel confidence cards and the brief's own
// [DO MORE]/[TEST]/[DO LESS] recommendations as "worth changing, your call" cards. Adoption
// creates an auditable proposal only; review and apply remain separate Muxin actions.
//
// The room's pane state (SIG) and renderSignalsSheets live with the brief/raw loaders above so the
// foot controls and the insights "Brief:" link share one switch. The last two sheets are
// pre-prototype developer surfaces relocated behind those controls so the room opens on the reads.
let SIGNALS = null;
function signalsBrand(){ return document.getElementById("signalsBrand")?.value || "human-inference"; }
// The server returns the latest append-only decision for each recommendation. A reload therefore
// keeps the user's choice without changing routing, configuration, or the repository backlog.
function signalKey(r){ return r.type+":"+r.title; }
function signalStatusLabel(c){
  return c.status.startsWith("OK") ? c.weeks+" wks of data" : "insufficient · directional only";
}
function signalDeltaHtml(p){
  if(!p) return "";
  if(!p.delta) return '<div class="fam-note t-amber">Blocked: '+esc(p.blockedReason||"outside the current allowlist")+'</div>';
  const d=p.delta;
  const exact=d.kind==="cadence" ? d.file+": platforms."+d.platform+"."+d.field+" · "+d.before+" → "+d.after : d.file+": defaults."+d.pillar+" · "+d.platform+" · "+(d.before?"included":"not included")+" → "+(d.after?"included":"not included");
  const controls=p.status==="pending" ? '<button class="sig-proposal-review primary" data-id="'+esc(p.id)+'" data-action="approve">Approve exact change</button><button class="sig-proposal-review" data-id="'+esc(p.id)+'" data-action="reject">Reject</button>' : p.status==="approved" ? '<button class="sig-proposal-apply primary" data-id="'+esc(p.id)+'">Apply approved change</button>' : p.status==="applied" ? '<span class="src">Applied. Audit record saved.</span><button class="sig-proposal-rollback" data-id="'+esc(p.id)+'">Rollback</button>' : '<span class="src">'+esc(p.status.replaceAll("_"," "))+'</span>';
  return '<div class="fam-note"><strong>Exact preview</strong><br>'+esc(exact)+'</div><div class="actions">'+controls+'</div>';
}
function signalsPracticalHtml(){
  const read=SIGNALS&&SIGNALS.performance;
  if(read&&read.summary){
    const top=read.summary.top;
    return '<section style="margin-top:22px"><div class="wb-label">WHAT IS WORKING NOW</div><div class="src" style="margin:5px 0 12px">Sample data · illustrative, not measured</div><div class="stat-tiles">'+
      '<div class="stat-tile"><strong>Topics earning engagement</strong><span class="l">'+esc(top.topic)+'</span></div>'+
      '<div class="stat-tile"><strong>Platforms working</strong><span class="l">'+esc(top.platform)+' for the illustrative sample</span></div>'+
      '<div class="stat-tile"><strong>Media and formats</strong><span class="l">'+esc(top.media)+' with '+esc(top.format)+'</span></div>'+
      '<div class="stat-tile"><strong>Content defaults</strong><span class="l">'+esc(read.summary.action)+'</span></div>'+
      '</div><div class="src" style="margin-top:10px">This sample never preselects a real request. Real requests use separate safe defaults and every choice remains editable.</div></section>';
  }
  return '<section style="margin-top:22px"><div class="wb-label">WHAT IS WORKING NOW</div><div class="src" style="margin:5px 0 12px">Sample data · illustrative, not measured</div><div class="stat-tiles">'+
    '<div class="stat-tile"><strong>Topics earning engagement</strong><span class="l">Work, status, and institutional incentives</span></div>'+
    '<div class="stat-tile"><strong>Platforms working</strong><span class="l">LinkedIn for the sample topic</span></div>'+
    '<div class="stat-tile"><strong>Media and formats</strong><span class="l">Carousel outperforming plain text in the sample</span></div>'+
    '<div class="stat-tile"><strong>Content defaults</strong><span class="l">Preselect short post + image; every choice remains editable</span></div>'+
    '</div><div class="src" style="margin-top:10px">Insufficient measured evidence keeps the current safe defaults. A measured zero will appear as 0; unavailable outcomes say not measured.</div></section>';
}
function displayLabel(value){
  const normalized=String(value||"").replaceAll("-"," ");
  return normalized ? normalized[0].toUpperCase()+normalized.slice(1) : "";
}
// Handoff cards are deliberately metadata-only. Keep this renderer shared between the Signals
// experiment card and the Venture room's projected Signals input so neither surface can silently
// drop the scope, measured arms, provenance, caveats, qualification, or exact lineage needed to
// review a handoff. Every value is escaped here; in particular, never render a draft body.
function signalsHandoffMetaHtml(p, perf, interpretation){
  const sample=(p&&p.sampleSize)||{};
  const comparison=perf&&perf.primaryComparison;
  const treatment=sample.treatment ?? (comparison&&comparison.treatment&&comparison.treatment.sample);
  const control=sample.control ?? (comparison&&comparison.control&&comparison.control.sample);
  const provenance=(p&&p.provenance)||{};
  const lineage=(p&&p.lineage)||{};
  const caveats=(p&&p.caveats)||((interpretation&&interpretation.caveats)||[]);
  const qualification=p&&p.qualification || (interpretation&&interpretation.qualification) || "not recorded";
  const evidenceStatus=p&&p.evidenceStatus || (interpretation&&interpretation.evidenceStatus) || "not recorded";
  const scope=p&&p.scope || (p&&p.contentRequestId) || "not recorded";
  const sourceId=p&&p.sourceId || (lineage&&lineage.sourceId) || "not recorded";
  const variantId=p&&p.variantId || (lineage&&lineage.variantId) || "not recorded";
  const experimentId=p&&p.experimentId || (lineage&&lineage.experimentId) || "not recorded";
  return '<div class="src handoff-meta">'+
    '<strong>Scope:</strong> '+esc(scope)+
    ' · <strong>Sample:</strong> treatment '+esc(treatment==null?"not measured":treatment)+' · control '+esc(control==null?"not measured":control)+
    ' · <strong>Qualification:</strong> '+esc(qualification)+
    ' · <strong>Evidence:</strong> '+esc(evidenceStatus)+
    '<br><strong>Provenance:</strong> plan digest '+esc(provenance.planDigest||(p&&p.digest)||"not recorded")+' · interpretation '+esc(provenance.interpretationId||(interpretation&&interpretation.id)||"not recorded")+
    '<br><strong>Caveats:</strong> '+esc(caveats.length?caveats.join("; "):"none recorded")+
    '<br><strong>Lineage:</strong> source '+esc(sourceId)+' · variant '+esc(variantId)+' · experiment '+esc(experimentId)+
    (((p&&p.contentItemRefs)||[]).length?' · content '+((p.contentItemRefs||[]).map(esc).join(", ")):'')+
    '</div>';
}
function experimentCanProposeVenture(perf, interpretation){
  const family=perf&&perf.primaryMetric&&perf.primaryMetric.family;
  const refs=perf&&perf.primaryOutcomeRefs;
  return !!(interpretation&&interpretation.reviewStatus==="accepted"&&interpretation.recommendation!=="reject"&&
    perf&&perf.analysisStatus==="ready"&&(family==="audience"||family==="business")&&
    refs&&Array.isArray(refs.treatment)&&refs.treatment.some(ref=>String(ref).startsWith("outcome:"))&&
    Array.isArray(refs.control)&&refs.control.some(ref=>String(ref).startsWith("outcome:")));
}
function signalsExperimentsHtml(){
  const plans=(SIGNALS&&SIGNALS.experimentPlans)||[];
  const propose='<div class="actions"><button class="sig-experiment-propose primary">Ask Signals to evaluate a Content request</button><span class="src">Uses reviewed evidence and body-free Content metadata. It may honestly recommend no experiment.</span></div>';
  if(!plans.length) return '<section style="margin-top:26px"><div class="wb-label">EXPERIMENTS</div>'+propose+'<div class="empty" style="padding:14px">Signals has not retained a sufficiently useful experiment proposal yet.</div></section>';
  const performanceById=new Map((((SIGNALS&&SIGNALS.experimentPerformance)||{}).experiments||[]).map(row=>[row.experimentId,row]));
  const interpretationById=new Map(((SIGNALS&&SIGNALS.experimentInterpretations)||[]).map(row=>[row.experimentId,row]));
  return '<section style="margin-top:26px"><div class="wb-label">EXPERIMENTS</div>'+propose+'<div class="src" style="margin:5px 0 12px">High-confidence proposals appear first. Approving a plan creates pending drafts in Content; it does not approve their copy or publish anything.</div>'+plans.map(p=>{
    const status=String(p.status||"proposed");
    const confidence=String(p.confidence||"unknown");
    const controls=status==="proposed"
      ? '<button class="sig-experiment primary" data-id="'+esc(p.experimentId)+'" data-action="approve">Approve plan and create drafts</button><button class="sig-experiment" data-id="'+esc(p.experimentId)+'" data-action="decline">Decline</button>'
      : status==="plan-approved"
        ? '<button class="sig-experiment primary" data-id="'+esc(p.experimentId)+'" data-action="start">Retry draft creation</button>'
        : status==="drafts-pending-content-review"
          ? '<button class="sig-experiment-open primary" data-request="'+esc(p.contentRequestId||p.requestId||"")+'">Open pending drafts in Content</button>'
          : '<span class="src">'+(status==="deferred"?'Deferred before generation. '+esc(p.priorityReason||'Confidence or declared capacity is insufficient.') : esc(status.replaceAll("-"," ")))+'</span>';
    const metric=p.primaryMetric ? p.primaryMetric.family+': '+p.primaryMetric.metric : 'not configured';
    const expected=p.expectedOutcome||{};
    const perf=performanceById.get(p.experimentId);
    const interpretation=interpretationById.get(p.experimentId);
    let measurement='';
    if(perf){
      const analysisStatus=String(perf.analysisStatus||"collecting");
      const blockers=(perf.blockers||[]).map(esc).join('; ');
      const comparison=perf.primaryComparison;
      const measured=comparison&&comparison.treatment&&comparison.control
        ? '<div class="src">Measured treatment: '+esc(comparison.treatment.value)+' over '+esc(comparison.treatment.sample)+' units · comparison: '+esc(comparison.control.value)+' over '+esc(comparison.control.sample)+' units</div>' : '';
      measurement='<div class="dev-summary"><strong>Analysis status:</strong> '+esc(displayLabel(analysisStatus))+'</div>'+measured+
        (blockers?'<div class="src">Still needed: '+blockers+'</div>':'');
      if(analysisStatus==="ready"&&!interpretation) measurement+='<div class="actions"><button class="sig-experiment-interpret primary" data-id="'+esc(p.experimentId)+'">Interpret measured result</button><span class="src">This uses the selected signed-in analysis model. This never selects a winner.</span></div>';
    }
    if(interpretation){
      const reviewStatus=String(interpretation.reviewStatus||"pending");
      measurement+='<div class="dev-summary"><strong>Signals recommends '+esc(interpretation.recommendation)+':</strong> '+esc(interpretation.rationale)+'</div>'+
        '<div class="src">Confidence: '+esc(displayLabel(interpretation.confidence))+' · Evidence: '+(interpretation.evidenceRefs||[]).map(esc).join(', ')+'</div>'+
        ((interpretation.caveats||[]).length?'<div class="src">Caveats: '+interpretation.caveats.map(esc).join('; ')+'</div>':'')+
        (reviewStatus==="pending"?'<div class="actions"><button class="sig-experiment-interpret-review primary" data-id="'+esc(p.experimentId)+'" data-action="accept">Accept interpretation</button><button class="sig-experiment-interpret-review" data-id="'+esc(p.experimentId)+'" data-action="reject">Reject analysis</button><span class="src">Your review records the learning. It does not change routing or select a winner.</span></div>'
          : '<div class="src">Interpretation review: '+esc(reviewStatus)+' by Muxin. Winner remains unset.</div>'+(experimentCanProposeVenture(perf, interpretation)?'<div class="actions"><button class="sig-venture-propose primary" data-id="'+esc(p.experimentId)+'">Propose as Venture input</button><span class="src">Requires a named Venture and phase. Signals records the proposal only.</span></div>':'') );
    }
    return '<div class="wb-proposal"><div class="wb-cut-head"><span class="lens">'+esc(confidence)+' confidence</span><span style="font-weight:600;font-size:14px;">'+esc(p.hypothesis)+'</span></div>'+
      '<div class="dev-summary"><strong>Observation:</strong> '+esc(p.observation)+'</div>'+
      '<div class="dev-summary"><strong>Evidence:</strong> '+(p.evidenceRefs||[]).map(esc).join(', ')+'</div>'+
      '<div class="dev-summary"><strong>Interpretation:</strong> '+esc(p.interpretation)+'</div>'+
      '<div class="dev-summary"><strong>Why this input:</strong> '+esc(p.whyThisInput)+'</div>'+
      '<div class="dev-summary"><strong>Expected outcome:</strong> '+esc(expected.direction||'not configured')+' '+esc(expected.metric||'not configured')+' for '+esc(expected.variantId||'not configured')+'</div>'+
      '<div class="src"><strong>Comparison:</strong> '+esc(expected.comparisonRef||'not configured')+' · '+esc(expected.family||'not configured')+'</div>'+
      '<div class="dev-summary"><strong>Change one thing:</strong> '+esc(p.controlledVariable)+'</div>'+
      '<div class="src">Hold constant: '+(p.constants||[]).map(esc).join('; ')+'</div>'+
      '<div class="src">Primary metric: '+esc(metric)+' · Minimum '+esc(p.minimumSample)+' observations over '+esc(p.minimumDays)+' days</div>'+
      ((p.guardrails||[]).length?'<div class="src">Guardrails: '+p.guardrails.map(g=>esc(g.family+': '+g.metric+' · '+g.rule)).join('; ')+'</div>':'')+
      (p.decisionRule?'<div class="src"><strong>Keep:</strong> '+esc(p.decisionRule.keep)+' <strong>Revise:</strong> '+esc(p.decisionRule.revise)+' <strong>Reject:</strong> '+esc(p.decisionRule.reject)+'</div>':'')+
      '<div class="src"><strong>Capacity:</strong> '+esc(p.capacityRationale)+(p.capacity?' · '+esc(p.capacity.availablePublishingUnits)+' units / '+esc(p.capacity.availableDays)+' days declared':'')+'</div>'+
      ((p.caveats||[]).length?'<div class="src"><strong>Caveats:</strong> '+p.caveats.map(esc).join('; ')+'</div>':'')+
      (p.planDecision&&p.planDecision.rationale?'<div class="src"><strong>Decision rationale:</strong> '+esc(p.planDecision.rationale)+'</div>':'')+
      signalsHandoffMetaHtml(p, perf, interpretation)+
      '<div class="actions">'+controls+'</div>'+measurement+'</div>';
  }).join('')+'</section>';
}
function signalsVentureHandoffsHtml(){
  const rows=(SIGNALS&&SIGNALS.ventureHandoffs)||[];
  if(!rows.length) return '';
  return '<section style="margin-top:26px"><div class="wb-label">VENTURE INPUTS</div><div class="src" style="margin:5px 0 12px">Learning proposals stay in Signals until you decide. This never creates Venture artifacts or accepts a Venture gate.</div>'+rows.map(p=>{
    const status=String(p.status||"pending");
    const controls=status==="pending"
      ? '<button class="sig-venture-decision primary" data-id="'+esc(p.id)+'" data-action="adopt">Adopt for Venture</button><button class="sig-venture-decision" data-id="'+esc(p.id)+'" data-action="request-more-evidence">Request more evidence</button><button class="sig-venture-decision" data-id="'+esc(p.id)+'" data-action="decline">Decline</button>'
      : status==="adopted" ? '<button class="sig-venture-open primary" data-slug="'+esc(p.ventureSlug)+'">Open '+esc(p.ventureSlug)+'</button>' : '<span class="src">'+esc(status.replaceAll("-"," "))+'</span>';
    return '<div class="wb-proposal"><div class="wb-cut-head"><span class="lens">'+esc(p.confidence)+' confidence</span><span style="font-weight:600;font-size:14px;">'+esc(p.title)+'</span></div><div class="dev-summary"><strong>Observed:</strong> '+esc(p.factualSummary)+'</div><div class="dev-summary"><strong>Proposed Venture input:</strong> '+esc(p.proposedInput)+'</div>'+signalsHandoffMetaHtml(p, null, null)+'<div class="src"><strong>Evidence refs:</strong> '+p.evidenceRefs.map(esc).join(', ')+'</div>'+ (p.muxinRationale?'<div class="src"><strong>Your decision:</strong> '+esc(p.muxinRationale)+'</div>':'') +'<div class="src"><strong>Venture:</strong> '+esc(p.ventureSlug)+' · <strong>Phase:</strong> '+esc(p.phase)+'</div><div class="actions">'+controls+'</div></div>';
  }).join('')+'</section>';
}
function renderSignals(){
  if(!SIGNALS) return;
  $("#signalsBriefDate").textContent = SIGNALS.briefDate ? "data through "+SIGNALS.briefDate : "";
  const box = $("#signalsTop");
  if(!SIGNALS.briefPath){
    box.innerHTML = signalsPracticalHtml()+signalsExperimentsHtml()+signalsVentureHandoffsHtml()+'<div class="empty">No live strategy brief yet. The clearly labeled sample above demonstrates the intended read; open the latest strategy brief below to replace it with evidence.</div>';
    bindSignalsExperimentActions(box);
    box.querySelectorAll(".sig-venture-decision").forEach(b=>b.addEventListener("click", ()=>decideSignalsVenture(b)));
    box.querySelectorAll(".sig-venture-open").forEach(b=>b.addEventListener("click", ()=>{ setRoom("venture"); switchVenture(b.dataset.slug); }));
    box.querySelectorAll(".sig-venture-propose").forEach(b=>b.addEventListener("click", ()=>proposeSignalsVenture(b)));
    return;
  }
  const fitCards = (SIGNALS.confidence||[]).map(c=>{
    const ok = c.status.startsWith("OK");
    return '<div class="stat-tile"><span style="font:600 14px/1.3 Georgia,serif;">'+esc(c.channel)+'</span>'+
      '<span class="l" style="color:'+(ok?"#2f7d46":"#9a6b12")+'">'+esc(signalStatusLabel(c))+'</span>'+
      '<span class="l">'+c.posts+' posts on record</span></div>';
  }).join("");
  const weak = (SIGNALS.confidence||[]).filter(c=>!c.status.startsWith("OK"));
  const declined = (SIGNALS.recommendations||[]).filter(r=>(r.decision || (SIGNALS.decisions&&SIGNALS.decisions[signalKey(r)]||{}).decision)==="decline");
  const recs = (SIGNALS.recommendations||[]).map((r,i)=>{
    const key = signalKey(r);
    const decision = r.decision || (SIGNALS.decisions&&SIGNALS.decisions[key]||{}).decision;
    if(decision==="decline") return "";
    const adopted = decision==="adopt";
    const proposal=(SIGNALS.changeProposals||[]).find(p=>signalKey(p.recommendation)===key);
    return '<div class="wb-proposal"><div class="wb-cut-head"><span class="lens">'+esc(r.type.toLowerCase())+'</span><span style="font-weight:600;font-size:14px;">'+esc(r.title)+'</span></div>'+
      '<div class="dev-summary">'+esc(r.rationale)+'</div>'+
      '<div class="actions">'+
        '<button class="'+(adopted?'':'primary ')+'sig-adopt" data-i="'+i+'"'+(adopted?' disabled':'')+'>'+(adopted?'Adopted':'Adopt')+'</button>'+
        '<button class="sig-decline" data-i="'+i+'">Decline</button>'+
        (adopted ? '<span class="src">Intent saved. Configuration still unchanged.</span>' : '')+
      '</div>'+signalDeltaHtml(proposal)+'</div>';
  }).join("");
  const declinedHtml = declined.length
    ? '<div style="margin-top:26px"><div style="font:600 14px/1 Georgia,serif;margin-bottom:6px;">Declined</div>'+declined.map(r=>
      '<div class="wb-proposal"><div class="wb-cut-head"><span class="lens">'+esc(r.type.toLowerCase())+'</span><span style="font-weight:600;font-size:14px;">'+esc(r.title)+'</span></div>'+
      '<div class="dev-summary">'+esc(r.rationale)+'</div><div class="src">Decision saved. No configuration changed.</div></div>'
    ).join("")+'</div>'
    : "";
  const weakHtml = weak.length
    ? '<div class="src" style="margin-top:10px">Too weak to trust yet: '+weak.map(c=>esc(c.channel)).join(", ")+'. We will not build on those.</div>'
    : "";
  const briefNote = '<div class="src" style="margin-bottom:6px">Straight from the latest brief. These do not change anything by themselves.</div>';
  box.innerHTML = signalsPracticalHtml()+signalsExperimentsHtml()+signalsVentureHandoffsHtml()+
    '<div style="margin-top:16px"><div style="font:600 14px/1 Georgia,serif;margin-bottom:8px;">Where you fit, so far</div><div class="stat-tiles" style="margin-top:8px">'+fitCards+'</div></div>'+
    weakHtml+
    '<div style="margin-top:26px"><div style="font:600 14px/1 Georgia,serif;margin-bottom:4px;">Worth changing, your call</div>'+briefNote+
    (recs||'<div class="empty" style="padding:14px">No active recommendations this session.</div>')+'</div>'+declinedHtml;
  box.querySelectorAll(".sig-adopt").forEach(b=>b.addEventListener("click", ()=>saveSignalDecision(Number(b.dataset.i),"adopt",b)));
  box.querySelectorAll(".sig-decline").forEach(b=>b.addEventListener("click", ()=>saveSignalDecision(Number(b.dataset.i),"decline",b)));
  box.querySelectorAll(".sig-proposal-review").forEach(b=>b.addEventListener("click", ()=>reviewSignalProposal(b.dataset.id,b.dataset.action,b)));
  box.querySelectorAll(".sig-proposal-apply").forEach(b=>b.addEventListener("click", ()=>actOnSignalProposal(b.dataset.id,"apply",b)));
  box.querySelectorAll(".sig-proposal-rollback").forEach(b=>b.addEventListener("click", ()=>actOnSignalProposal(b.dataset.id,"rollback",b)));
  bindSignalsExperimentActions(box);
  box.querySelectorAll(".sig-venture-decision").forEach(b=>b.addEventListener("click", ()=>decideSignalsVenture(b)));
  box.querySelectorAll(".sig-venture-open").forEach(b=>b.addEventListener("click", ()=>{ setRoom("venture"); switchVenture(b.dataset.slug); }));
  box.querySelectorAll(".sig-venture-propose").forEach(b=>b.addEventListener("click", ()=>proposeSignalsVenture(b)));
}
async function proposeSignalsVenture(button){
  const ventureSlug=(prompt("Named Venture slug:")||"").trim();
  const phase=Number(prompt("Venture phase:","2")||"");
  if(!ventureSlug||!Number.isInteger(phase)||phase<1){flash("A named Venture and positive phase are required.");return;}
  button.disabled=true;
  const result=await post("/api/signals/experiments/"+encodeURIComponent(button.dataset.id)+"/venture-handoff/propose",{ventureSlug,phase});
  if(!result.ok){button.disabled=false;flash(result.error||"Could not propose Venture input");return;}
  flash("Venture input proposal saved in Signals. Venture remains separately gated.");
  await loadSignals();
}
async function decideSignalsVenture(button){
  const rationale=prompt(button.dataset.action==="adopt"?"Why adopt this Venture input?":button.dataset.action==="decline"?"Why decline this Venture input?":"What evidence is still needed?")||"";
  if(!rationale.trim()) return;
  button.disabled=true;
  const result=await post("/api/signals/venture-handoff/"+encodeURIComponent(button.dataset.id)+"/decision",{decision:button.dataset.action,rationale});
  if(!result.ok){button.disabled=false;flash(result.error||"Could not record the Signals decision");return;}
  flash(button.dataset.action==="adopt"?"Signals decision saved. Venture remains separately gated.":"Signals decision saved.");
  await loadSignals();
}
function bindSignalsExperimentActions(box){
  box.querySelectorAll(".sig-experiment-propose").forEach(b=>b.addEventListener("click", ()=>proposeSignalsExperiment(b)));
  box.querySelectorAll(".sig-experiment").forEach(b=>b.addEventListener("click", ()=>actOnSignalsExperiment(b.dataset.id,b.dataset.action,b)));
  box.querySelectorAll(".sig-experiment-open").forEach(b=>b.addEventListener("click", ()=>openExperimentDrafts(b.dataset.request)));
  box.querySelectorAll(".sig-experiment-interpret").forEach(b=>b.addEventListener("click", ()=>interpretSignalsExperiment(b.dataset.id,b)));
  box.querySelectorAll(".sig-experiment-interpret-review").forEach(b=>b.addEventListener("click", ()=>reviewSignalsExperimentInterpretation(b.dataset.id,b.dataset.action,b)));
}
async function proposeSignalsExperiment(button){
  const contentRequestId=(prompt("Content request ID to evaluate:")||"").trim();
  if(!contentRequestId) return;
  const evidenceDossierPath=(prompt('Reviewed evidence dossier path under docs/reviews:','docs/reviews/content-studio-phase2-used-to-think-final-dossier.json')||"").trim();
  if(!evidenceDossierPath) return;
  const evidenceFamily=(prompt('Outcome family for this evidence: attention, conversation, audience, or business','conversation')||"").trim().toLowerCase();
  if(!["attention","conversation","audience","business"].includes(evidenceFamily)){flash("Choose a valid outcome family.");return;}
  const minimumSample=Number(prompt("Minimum published units:","10")||"10");
  const minimumDays=Number(prompt("Minimum elapsed days:","7")||"7");
  const availablePublishingUnits=Number(prompt("Publishing units available in that window:",String(minimumSample))||String(minimumSample));
  const availableDays=Number(prompt("Days available:",String(minimumDays))||String(minimumDays));
  const selected=$("#signalsAnalysisEngine").value||"codex";
  if(selected==="ollama-gpt-oss"){flash("Choose Claude, Grok, or Codex for experiment proposals.");return;}
  button.disabled=true;
  const result=await post("/api/signals/experiments/propose",{contentRequestId,evidenceDossierPath,evidenceFamily,minimumSample,minimumDays,availablePublishingUnits,availableDays,engine:selected,brand:signalsBrand()});
  if(!result.ok){button.disabled=false;flash(result.error||"Could not evaluate the experiment.");return;}
  flash(result.result&&result.result.status==="no-experiment"?"Signals found no experiment worth the capacity.":"Signals experiment proposal is ready for review.");
  await loadSignals();
}
async function actOnSignalsExperiment(id,action,button){
  let rationale="";
  if(action==="decline") rationale=prompt("Why decline this experiment?")||"";
  button.disabled=true;
  const result=await post("/api/signals/experiments/"+encodeURIComponent(id)+"/"+action,{approvedBy:"muxin",rationale,brand:signalsBrand()});
  if(!result.ok){ button.disabled=false; flash(result.error||"Could not update experiment"); await loadSignals(); return; }
  flash(action==="decline"?"Experiment declined.":"Experiment drafts are pending review in Content.");
  await loadSignals();
}
async function interpretSignalsExperiment(id,button){
  button.disabled=true;
  const result=await post("/api/signals/experiments/"+encodeURIComponent(id)+"/interpret",{engine:$("#signalsAnalysisEngine").value||"codex",brand:signalsBrand()});
  if(!result.ok){button.disabled=false;flash(result.error||"Could not interpret experiment");return;}
  flash("Signals interpretation is ready for your review.");
  await loadSignals();
}
async function reviewSignalsExperimentInterpretation(id,action,button){
  const rationale=prompt(action==="accept"?"Why accept this interpretation?":"Why reject this analysis?")||"";
  if(!rationale.trim()) return;
  button.disabled=true;
  const result=await post("/api/signals/experiments/"+encodeURIComponent(id)+"/interpretation/"+action,{rationale,brand:signalsBrand()});
  if(!result.ok){button.disabled=false;flash(result.error||"Could not review interpretation");return;}
  flash(action==="accept"?"Interpretation recorded.":"Analysis rejected.");
  await loadSignals();
}
async function openExperimentDrafts(requestId){
  await setRoom("content");
  CW.pane="review";
  render();
  const filter=$("#reviewRequestFilter");
  if(filter){ filter.value=requestId||""; render(); }
  flash("Showing this experiment's pending Content drafts.");
}
async function reviewSignalProposal(id,action,button){
  const evidence=prompt(action==="approve" ? "Why is this exact change approved?" : "Why reject this proposal?");
  if(!evidence) return;
  button.disabled=true;
  const result=await post("/api/signals/proposals/"+encodeURIComponent(id)+"/"+action,{evidence,brand:signalsBrand()});
  if(!result.ok){ button.disabled=false; flash(result.error||"Could not review proposal"); return; }
  flash(action==="approve" ? "Proposal approved. It has not been applied." : "Proposal rejected."); await loadSignals();
}
async function actOnSignalProposal(id,action,button){
  let evidence="";
  if(action==="rollback"){ evidence=prompt("Why roll this change back?")||""; if(!evidence) return; }
  button.disabled=true;
  const result=await post("/api/signals/proposals/"+encodeURIComponent(id)+"/"+action,{evidence,brand:signalsBrand()});
  if(!result.ok){ button.disabled=false; flash(result.error||"Could not "+action+" proposal"); return; }
  flash(action==="apply" ? "Approved Signals change applied." : "Signals change rolled back."); await loadSignals();
}
async function saveSignalDecision(index, decision, button){
  const recommendation=SIGNALS&&SIGNALS.recommendations ? SIGNALS.recommendations[index] : null;
  if(!recommendation) return;
  button.disabled=true;
  const result=await post("/api/signals/decision",{decision,type:recommendation.type,title:recommendation.title,rationale:recommendation.rationale,brand:signalsBrand()});
  if(!result.ok){ button.disabled=false; flash(result.error||"Could not save the decision"); return; }
  flash("Decision saved. No configuration changed.");
  await loadSignals();
}
async function loadSignals(){
  const brand=signalsBrand();
  const r = await fetch("/api/signals"+"?brand="+encodeURIComponent(brand));
  SIGNALS = await r.json();
  renderSignals();
  await loadOutcomes();
}
document.getElementById("signalsBrand")?.addEventListener("change", () => {
  briefLoaded=false;
  insightsHistory=[];
  loadSignals();
  if(SIG.pane==="brief") loadBrief();
});

// ── Signals: the four outcome families + the redacted research read ──
//
// GET /api/signals/outcomes groups what data/analytics.db really holds into the four families of
// docs/venture-schema-contract.md §5.8; GET /api/research/report is the redacted account-level
// research read. Nothing here adds a family to another one, and nothing here computes a number.
//
// Refused from the design prototype, all of them fixtures with no source in this repo: its four
// family totals, its per-family sample thresholds, its per-platform trend vocabulary, its "too weak
// to trust yet" sidebar and its "a post almost nobody saw brought in a subscriber" line.
let OUTCOMES = null, RESEARCH = null;

// ── begin the signals mirror ──
// Rule 5: written twice, once exported from page.ts for DOM-free tests and once here. Keep both.
function groupDigits(n){
  if(!Number.isFinite(n) || !Number.isInteger(n)) return String(n);
  const digits = String(Math.abs(n)).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ",");
  return n < 0 ? "-"+digits : digits;
}
function metricLine(m){
  if(m.state === "not_measured") return { value:"not measured", note:m.reason, tone:"grey" };
  if(m.records_measured === 0){
    return { value:"0",
      note:"no record carried this number, so this is a sum over nothing rather than a measured zero",
      tone:"grey" };
  }
  // "record", not "post": half of these come off capture rows and observation sources, not posts.
  const on = m.records_measured === 1 ? "1 record" : m.records_measured+" records";
  const missing = m.records_unmeasured
    ? ", "+m.records_unmeasured+(m.records_unmeasured === 1 ? " record carried no number" : " records carried no number")
    : "";
  return { value:groupDigits(m.value), note:"measured on "+on+missing, tone:"ink" };
}
function sampleNote(confidence, rule){
  const bar = rule.threshold_weeks+(rule.threshold_weeks === 1 ? " week" : " weeks");
  if(!confidence.length) return "No posts on record in this database, so nothing below has been measured yet.";
  const ok = confidence.filter(c=>c.sufficient).length;
  const total = confidence.length;
  const platforms = total === 1 ? "platform" : "platforms";
  if(ok === 0) return "None of the "+total+" "+platforms+" on record clears "+bar+" of data. Everything below is directional only.";
  if(ok === total) return "All "+total+" "+platforms+" on record clear "+bar+" of data.";
  return ok+" of "+total+" "+platforms+" on record clear "+bar+" of data. The rest are directional only.";
}
function familyGate(family){
  return (family === "attention" || family === "conversation")
    ? { text:"MAY INFORM A ROUTING OR SUPPRESSION CALL", tone:"green" }
    : { text:"NEVER USED TO SUPPRESS A PILLAR OR PLATFORM", tone:"amber" };
}
// ── end of the signals mirror ──

// Which sub-metrics each family carries, in the order signals.ts declares them. A key the read did
// not return is skipped rather than rendered as a blank.
const FAMILY_METRICS = [
  ["attention", [["impressions","IMPRESSIONS"]]],
  ["conversation", [["likes","LIKES"],["replies","REPLIES"],["reposts","REPOSTS"],["saves","SAVES"],["comments","COMMENTS"],["research_observations","REPLY SIGNALS"]]],
  ["audience", [["new_follows","NEW FOLLOWS"],["follower_total","FOLLOWER TOTAL"],["follower_delta","FOLLOWER CHANGE"],["landing_visits","LANDING VISITS"],["opt_ins","OPT-INS"],["survey_responses","SURVEY RESPONSES"]]],
  ["business", [["qualified_inquiries","QUALIFIED INQUIRIES"],["calls","CALLS"],["opportunities","OPPORTUNITIES"],["purchases","PURCHASES"]]],
];
function metricHtml(label, m){
  const l = metricLine(m);
  const big = l.tone === "ink";
  return '<div class="metric"><span class="k">'+esc(label)+'</span>'+
    '<span class="v '+(big?"":"small ")+'t-'+l.tone+'">'+esc(l.value)+'</span>'+
    '<span class="n">'+esc(l.note)+'</span></div>';
}
function familyHtml(fam, metrics){
  const present = metrics.filter(pair=>fam[pair[0]]);
  const gate = familyGate(fam.family);
  // "Nothing measured here" is derived, never a phase flag: it is true exactly when every
  // sub-metric this family carries came back not_measured.
  const nothing = present.length > 0 && present.every(pair=>fam[pair[0]].state === "not_measured");
  const bySource = fam.research_observations_by_source || {};
  const srcKeys = Object.keys(bySource);
  return '<div class="fam">'+
    '<div class="fam-head"><span class="fam-name">'+esc(fam.family.charAt(0).toUpperCase()+fam.family.slice(1))+'</span>'+
    '<span class="fam-ask">'+esc(fam.question)+'</span><span style="flex:1"></span>'+
    (nothing?'<span class="fam-ask t-grey">NOTHING MEASURED HERE</span>':"")+'</div>'+
    '<div class="fam-metrics">'+present.map(pair=>metricHtml(pair[1], fam[pair[0]])).join("")+'</div>'+
    (srcKeys.length?'<div class="fam-note">Reply signals by source: '+srcKeys.map(k=>esc(k)+" "+bySource[k]).join(", ")+'.</div>':"")+
    (fam.partial_note?'<div class="fam-note">'+esc(fam.partial_note)+'</div>':"")+
    (fam.empty_state?'<div class="fam-note t-grey">'+esc(fam.empty_state)+'</div>':"")+
    '<div class="fam-gate t-'+gate.tone+'">'+esc(gate.text)+'</div>'+
    '</div>';
}
function renderOutcomes(){
  const box = $("#signalsFamilies");
  if(!OUTCOMES){ box.innerHTML = '<div class="empty">Loading…</div>'; return; }
  if(OUTCOMES.error){ box.innerHTML = '<div class="empty">Could not read the outcome families: '+esc(OUTCOMES.error)+'</div>'; return; }
  const conf = OUTCOMES.confidence || [];
  const excluded = OUTCOMES.excluded_unassigned || {};
  const excludedLine = ["posts","metrics","audience","research"].map(k=>k+" "+(Number(excluded[k])||0)).join(", ");
  const plats = conf.map(c=>
    '<div class="sig-plat"><span style="font-weight:600">'+esc(c.platform)+'</span>'+
    '<span class="t-'+(c.sufficient?"green":"amber")+'" style="font:10.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace">'+esc(c.sufficient?"enough data":"insufficient")+'</span>'+
    '<span style="color:#5a5346">'+c.posts+' post'+(c.posts===1?"":"s")+' on record over '+c.weeks+' week'+(c.weeks===1?"":"s")+'. '+esc(c.status)+'</span></div>'
  ).join("");
  box.innerHTML =
    '<div class="sig-sample">'+esc(sampleNote(conf, OUTCOMES.sample_rule))+'</div>'+
    '<div class="src" style="margin-top:4px">Legacy rows excluded from this brand view: '+esc(excludedLine)+'. They remain unassigned, never silently attributed.</div>'+
    '<div class="src" style="margin-top:4px">Sample rule: '+esc(OUTCOMES.sample_rule ? OUTCOMES.sample_rule.source : "")+'</div>'+
    FAMILY_METRICS.map(pair=>OUTCOMES[pair[0]] ? familyHtml(OUTCOMES[pair[0]], pair[1]) : "").join("")+
    (plats?'<div style="margin-top:26px"><div style="font:600 14px/1 Georgia,serif;margin-bottom:2px;">How much data is behind this</div>'+
      '<div class="src" style="margin-bottom:4px">Counted straight off the posts table, one row per platform. No trend words: nothing in this repo computes one.</div>'+plats+'</div>':"");
}
function researchLine(k, v){
  return '<div class="sig-plat" style="grid-template-columns:220px minmax(0,1fr)"><span class="src">'+esc(k)+'</span><span>'+esc(String(v))+'</span></div>';
}
function renderResearch(){
  const box = $("#signalsResearch");
  if(!RESEARCH){ box.innerHTML = ""; return; }
  const head = '<div class="wb-sep" style="margin-top:34px"><span class="rule"></span><span class="txt">reply signals, redacted</span><span class="rule"></span></div>';
  if(RESEARCH.state !== "available"){
    box.innerHTML = head+'<div class="fam-note t-grey" style="margin-top:12px">'+esc(RESEARCH.reason||"")+'</div>'+
      '<div class="src" style="margin-top:6px">Capture '+(RESEARCH.capture_configured?"is configured (RESEARCH_HASH_KEY is set)":"is not configured (RESEARCH_HASH_KEY is unset)")+'. This is an absence of measurement, not a zero.</div>';
    return;
  }
  const r = RESEARCH.report || {};
  const active = r.active_observation_counts || {};
  const keys = Object.keys(active).sort();
  const resp = r.audience_respondent_summary || {};
  const thread = r.largest_audience_thread || {};
  const cov = (r.coverage||[]).slice(-3).map(c=>
    researchLine("coverage · "+(c.source||""), (c.status||"")+", "+(c.records_captured==null?"no record count":c.records_captured+" records")+(c.gap_reason?", gap: "+c.gap_reason:""))
  ).join("");
  const replies = (r.reply_observations||[]).filter(x=>x.redacted_text).slice(0,3).map(x=>
    '<div class="fam-note">"'+esc(x.redacted_text)+'"</div>'
  ).join("");
  box.innerHTML = head+
    '<div class="src" style="margin-top:12px">Account level and redacted by construction: counts and redacted text only, never an exact reply and never a respondent identity.</div>'+
    (keys.length?keys.map(k=>researchLine("active observations · "+k, active[k])).join(""):'<div class="fam-note t-grey">No active observations recorded.</div>')+
    researchLine("your own replies", r.creator_reply_observations==null?"not recorded":r.creator_reply_observations)+
    researchLine("audience observations", (resp.observation_count==null?"not recorded":resp.observation_count)+" from "+(resp.unique_respondents==null?"an unrecorded number of":resp.unique_respondents)+" known respondents, "+(resp.observations_without_respondent_hash==null?"an unrecorded number":resp.observations_without_respondent_hash)+" with no respondent recorded")+
    researchLine("largest single thread", (thread.observation_count==null?"not recorded":thread.observation_count)+" observations, "+(thread.known_respondents==null?"an unrecorded number of":thread.known_respondents)+" known respondents")+
    cov+
    (replies?'<div class="src" style="margin-top:10px">A few redacted lines, as stored:</div>'+replies:"");
}
async function loadOutcomes(){
  const brand = signalsBrand();
  const [o, rr] = await Promise.all([
    fetch("/api/signals/outcomes"+"?brand="+encodeURIComponent(brand)).then(r=>r.json()).catch(e=>({error:String(e)})),
    fetch("/api/research/report"+"?brand="+encodeURIComponent(brand)).then(r=>r.json()).catch(()=>null),
  ]);
  OUTCOMES = o; RESEARCH = rr;
  renderOutcomes(); renderResearch();
}

// ── Studio home (Content Studio Riff 3c) ──
// The one screen that spans all five rooms. Never starts work; shows what needs Muxin (ranked)
// and what the team is doing, from real queue/ledger data. Click-throughs land in the room that
// owns each item.
let STUDIO = null;
let PUBLISH_RECONCILIATION_HEALTH = null;
function publishingHealthLine(health){
  if(!health) return "Delivery checks unavailable";
  if(health.state==="failed") return "Delivery checks stopped: "+(health.error||"provider reconciliation failed");
  if(health.state==="running") return "Delivery checks running now";
  if(health.state==="ok") return "Delivery checks current"+(health.lastCompletedAt?" · "+String(health.lastCompletedAt).slice(0,16).replace("T"," "):"");
  return "Delivery checks waiting for the first run";
}
function studioDateLine(){
  const now = new Date();
  const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const MO = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return DAYS[now.getDay()]+", "+MO[now.getMonth()]+" "+now.getDate();
}
function renderStudio(){
  if(!STUDIO) return;
  // The four stat tiles (drafts / dossiers / follow-ups / posts holding) were the pre-prototype
  // summary. "Needs you today" already names the same work in sentences, and each tile's click
  // path already has a needs-you row or the room nav, so the tiles go rather than relocate.
  const captures = SERVER_CAPTURES.map(captureHandoffSummary).filter(Boolean).map(c=>({...c, urgent:true}));
  const items = [...captures, ...(STUDIO.needsYou||[])];
  const rows = items.map(n=>
    '<div class="ny-row'+(n.urgent?" urgent":"")+'"><span class="ny-room">'+esc(n.label)+'</span>'+
    '<span class="ny-text">'+esc(n.text)+' <span class="ny-detail">'+esc(n.detail)+'</span></span>'+
    '<button type="button" class="wb-link ny-go" data-room="'+esc(n.room)+'"'+(n.dir?' data-dir="'+esc(n.dir)+'"':'')+'>'+esc(n.action)+'</button></div>'
  ).join("");
  // Closing line uses the measured row count. The prototype's hardcoded "Four things" would lie
  // whenever the list is not exactly four.
  const closing = items.length
    ? '<div style="margin-top:22px;font-size:12.5px;line-height:1.55;color:#8a7f6d">'+items.length+' thing'+(items.length===1?"":"s")+', ranked by what actually blocks something. Everything else the team is handling.</div>'
    : "";
  $("#studioMain").innerHTML =
    '<div style="font:italic 400 14px/1.5 Georgia,serif;color:#a89a80;margin-bottom:6px">'+studioDateLine()+'</div>'+
    '<div style="font:400 30px/1.25 Georgia,serif;margin:0 0 22px;">Needs you today</div>'+
    (rows || '<div class="empty" style="padding:20px 0">Nothing needs you right now.</div>')+
    '<div id="publishingReconciliationHealth" class="src" style="margin-top:18px">'+esc(publishingHealthLine(PUBLISH_RECONCILIATION_HEALTH))+'</div>'+
    closing;
  renderTeamRail();
  document.querySelectorAll("#studioMain .ny-go").forEach(a=>a.addEventListener("click",()=>{
    const room = a.dataset.room;
    if(room==="content"){ setRoom("content"); openReviewSheet(); }
    else if(room==="outreach"){ if(a.dataset.dir) activeLeadDir=a.dataset.dir; setRoom("outreach"); setOutreachSub("leads"); }
    else if(room==="followups"){ setRoom("outreach"); setOutreachSub("followups"); }
    else setRoom(room);
  }));
}
async function loadStudio(){
  try {
    const [r, healthResponse] = await Promise.all([
      fetch("/api/studio"),
      fetch("/api/publishing/reconciliation-health").catch(()=>null),
    ]);
    if(!r.ok) throw new Error("studio "+r.status);
    STUDIO = await r.json();
    PUBLISH_RECONCILIATION_HEALTH = healthResponse&&healthResponse.ok ? await healthResponse.json() : null;
    renderStudio();
    connectionRecovered();
  } catch(e) {
    $("#studioMain").innerHTML = '<div class="load-error" role="alert"><strong>Could not load the Studio overview.</strong><div>Your queue and drafts are unchanged. Check the server, then try again.</div><button type="button" id="studioRetry">Try again</button></div>';
    $("#studioRetry")?.addEventListener("click", loadStudio);
    connectionState("Content Studio could not load the overview. Your queue and drafts are unchanged.");
  }
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
  const sentLine = (row.channel?esc(row.channel):"not recorded")+(row.lastTouch?' · last touch '+esc(row.lastTouch.slice(0,10)):' · never');
  const origin = open ? '<div class="fu-origin">'+
      '<div><div class="cap">Why you reached out</div><div class="cell">'+esc(row.why)+'</div></div>'+
      '<div><div class="cap">What you said</div>'+(row.saidExcerpt?'<div class="cell" style="font:italic 400 13px/1.55 Georgia,serif;">"…'+esc(row.saidExcerpt)+'…"</div>':'<div class="cell">no locked message on file</div>')+'</div>'+
      '<div><div class="cap">The dossier</div><div class="cell">'+(row.fit?esc(row.fit)+' fit':'not recorded')+(row.dir?' · <button type="button" class="wb-link fu-reopen" data-dir="'+esc(row.dir)+'">reopen ↗</button>':"")+'</div></div>'+
    '</div>' : "";
  const status = pending
    ? '<div class="hint" style="margin-left:26px;">drafting… (the Studio room has progress + log)</div>'
    : err ? '<div class="aierr" style="margin-left:26px;">⚠ '+esc(err)+'</div>' : "";
  const draftBtn = row.dir && !disabled ? '<span class="fu-draft-control">'+outreachEngineSelectHtml()+'<button class="fu-draft" data-dir="'+esc(row.dir)+'" data-person="'+esc(row.person||"")+'"'+(pending?" disabled":"")+'>'+(pending?"Drafting…":"Draft a follow-up")+'</button></span>' : "";
  const noteInput = disabled ? "" : '<input class="fu-note" placeholder="optional note (kept in the ledger)…" />';
  return '<div class="fu-row">'+
    '<div class="fu-head"><span class="fu-dot" style="background:'+fuDotColor(row.status)+'"></span>'+
      '<div><span class="fu-name">'+esc(nameParts[0])+'</span>'+(row.person?' <span class="fu-org">· '+esc(nameParts[1])+'</span>':"")+
      ' <span class="seg-chip '+(row.bucket==="platform"?"platform":row.bucket==="client"?"org-role":"content-example")+'">'+esc(row.bucket==="client"?"org":row.bucket)+'</span>'+
      '<div class="fu-meta">'+sentLine+' · <button type="button" class="wb-link fu-toggle" data-key="'+esc(row.key)+'">'+(open?"hide why":"show why")+'</button></div></div>'+
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
  refreshEngineControls(box);
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
  box.querySelectorAll("button.fu-draft").forEach(b=>b.addEventListener("click", ()=>{
    const select = b.closest(".fu-draft-control")?.querySelector(".engine-select");
    followupDraft(b.dataset.dir, b.dataset.person, select ? select.value : "codex");
  }));
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
  if(r.ok){ flash(action==="mark-responded" ? "Marked replied" : action==="mark-contacted" ? "Nudge logged: clock restarted" : "Moved on"); loadFollowups(); }
  else flash(r.error || "Failed");
}
function followupDraftRequest(dir, person, engine){
  return { dir:dir, ...(person ? {recipient:person} : {}), engine:engine || "codex" };
}
async function followupDraft(dir, person, engine){
  if(fuPending.has(dir)) return; // already in flight — never a second real claude -p spawn
  fuError.delete(dir);
  fuPending.add(dir); renderFollowupsBox();
  try {
    const r = await post("/api/followups/draft-follow-up", followupDraftRequest(dir, person, engine));
    if(r.ok){ flash("Follow-up drafted: shape it on the Leads pane"); await loadFollowups(); }
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
// Mirrors jobAwaitingAnswer/jobSettled/jobStopOffered/jobsPollDue/enqueuesJob in this file's
// Node-side export, kept in sync by hand. An answered ask is settled work: it stops reading as
// "waiting on you". So is a job she stopped herself: it is finished, by her decision.
function jobAwaitingAnswer(j){ return j.status==="blocked" && !j.answer; }
function jobSettled(j){ return j.status==="done" || j.status==="stopped" || (j.status==="blocked" && !!j.answer); }
// Stop is offered only where it can act: queued or running. Everything else has already settled,
// where the route no-ops, and a blocked job's stop would discard a question she has not answered.
function jobStopOffered(j){ return j.status==="queued" || j.status==="running"; }
function jobsPollDue(jobs, now, armedUntil){
  if(now < (armedUntil||0)) return true;
  if(jobs.some(j=>j.status==="queued"||j.status==="running")) return true;
  return jobs.some(j=>j.finishedAt!=null && now-j.finishedAt < STRIP_LINGER_MS + JOBS_POLL_MS);
}
const JOB_ENQUEUE_ROUTES = ["/api/atomize","/api/notes/pick","/api/revise","/api/duplicate","/api/video/generate","/api/content/generate","/api/content/media/render","/api/strategy/ask","/api/strategy/refresh-brief","/api/strategy/insights","/api/strategy/ask-insights","/api/strategy/pull","/api/outreach/scout","/api/outreach/draft","/api/outreach/message/revise","/api/charles/draft","/api/followups/draft-follow-up","/api/fiction/draft","/api/fiction/repass","/api/fiction/check","/api/fiction/promotion/draft","/api/fiction/promotion/revise"];
function enqueuesJob(path){ return JOB_ENQUEUE_ROUTES.includes(path) || /^\\/api\\/venture\\/[^/]+\\/(analyze|run-step)$/.test(path); }
function jobRoom(kind){
  if(kind==="scout"||kind==="draft-follow-up"||kind==="outreach-revise") return "Outreach";
  if(kind==="pull"||kind==="strategy"||kind==="insights"||kind==="ask-insights"||kind==="brief-revise") return "Signals";
  if(kind==="venture-analysis"||kind==="venture-step") return "Venture";
  if(kind==="charles-draft") return "Charles";
  if(kind==="fiction-draft"||kind==="fiction-continuity"||kind==="fiction-promo") return "Fiction";
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
  if(j.status==="stopped") return {text:"You stopped it", color:JC.blue};
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
  if(j.status==="stopped") return j.elapsedMs==null ? "not started" : "ran for "+jobElapsedText(j.elapsedMs);
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
  // Stopped: the completed steps are real, the one it was inside never finished. Nothing is in
  // flight, so no dot is "current", and nothing broke, so none is "failed".
  if(j.status==="stopped") return steps.map((t,i)=>({text:t,state: i<step?"done":"pending"}));
  return steps.map((t,i)=>({text:t,state: i<step?"done" : i===step?"current":"pending"}));
}
function dotColor(state){
  return state==="done"?JC.green : state==="current"?JC.ai : state==="blocked"?JC.amber : state==="failed"?JC.red : JC.grey;
}
function jobProgressPct(j){ return !j.stepTotal ? null : Math.round((Math.min(j.step||0, j.stepTotal)/j.stepTotal)*100); }
const ANSWERED_FOOTER = "You answered. A fresh job is running it from the start.";
const STOPPED_FOOTER = "You stopped this one. It did not finish.";
function jobAnswerEcho(j){ return j.answer ? "You said: "+j.answer : ""; }
function jobFooter(j){
  if(j.status==="failed") return "It stopped where the red dot is. Nothing was written.";
  if(j.status==="stopped") return STOPPED_FOOTER;
  if(j.status==="blocked") return j.answer ? ANSWERED_FOOTER : "It stops here until you answer. Nothing is written in the meantime.";
  if(j.status==="done") return jobLanding(jobRoom(j.kind));
  if(j.status==="queued") return "One job runs at a time, so this starts when the one above finishes.";
  return j.lastStdoutLine || "Real elapsed time, not an estimate.";
}
function jobLogLine(j){
  const path = j.logPath||"";
  if(j.status==="failed") return "> stopped at "+path;
  if(j.status==="stopped") return "> stopped, you ended it";
  if(j.status==="blocked") return j.answer ? "> stopped, you answered it" : "> stopped, waiting on your answer";
  if(j.status==="queued") return "> waiting for a slot";
  if(j.status==="done") return "> wrote to "+path;
  return "> reading "+path+" ...";
}
function jobOpenLabel(j){
  // "Watch it" would promise motion a stopped job no longer has; "Read it" would promise an
  // artifact it may never have written. Opening the room is all this one claims.
  if(j.status==="stopped") return "Open " + jobRoom(j.kind);
  return (j.status==="done" ? "Read it in " : "Watch it in ") + jobRoom(j.kind);
}
function workbenchSlugForJob(j){
  if(j.kind!=="develop" && j.kind!=="develop-reply") return null;
  const stamped = (j.slugs||[]).find(slug=>typeof slug==="string" && slug.trim());
  if(stamped) return stamped;
  const match = /^(?:Develop|Advisor reply):\\s*(.+)$/.exec(String(j.label||"").trim());
  const candidate = match && match[1].trim() ? match[1].trim() : "";
  return /^\\d{4}-\\d{2}-\\d{2}-[A-Za-z0-9][A-Za-z0-9._-]*$/.test(candidate) ? candidate : null;
}
function workbenchJobTarget(j){
  const slug = workbenchSlugForJob(j);
  return slug && WB_SESSIONS.some(s=>s.slug===slug) ? slug : null;
}
function openWorkbenchJob(j){
  Promise.resolve(setRoom("content")).then(()=>{
    const slug = workbenchJobTarget(j);
    if(!slug) return;
    // Advisor-era jobs now land in the ordinary Content configuration for their source. The old
    // Workbench/cuts surface is not a reachable alternate review path.
    if(CW.slug !== slug){
      CW.slug = slug; CW.step = 2; CW.tab = null; CW.treat = null; CW.treatFor = null; CW.treatErr = null; CW.yesErrors = [];
      cwLoadTreatment();
    }
    CW.pane = "wizard";
    renderContentWizard();
    $("#contentWizard")?.scrollIntoView({behavior:"smooth", block:"start"});
  });
}
// The per-job Stop control, on the two surfaces a live job appears on. Same button, same handler.
function stopBtnHtml(j){
  return jobStopOffered(j) ? '<button class="jstop" data-id="'+esc(j.id)+'">Stop it</button>' : "";
}
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
  // Empty queue: show nothing. A separate empty sheet used to announce itself; jobs now fold into
  // the one Studio sheet only when there is work.
  if(!JOBS.length){ box.hidden = true; return; }
  box.hidden = false;
  // Matches jobIsSweepable in jobs.ts, which takes a stopped job too: it is finished work.
  const clearable = JOBS.some(j=>j.status==="done"||j.status==="failed"||j.status==="stopped");
  let html = '<div class="jobs-head"><h3>Queue</h3>'+(clearable?'<button id="clearJobsBtn">Clear queue</button>':'')+'</div>';
  for(const j of [...JOBS].reverse()){
    const rail = jobRail(j), pct = jobProgressPct(j), dots = jobStepDots(j);
    const cls = j.status==="failed" ? " bad" : j.status==="blocked" ? " asking" : "";
    html += '<div class="jrow'+cls+'">'+
      '<div class="jrow-head"><span style="min-width:0">'+
        '<span class="jrow-rail" style="color:'+rail.color+'">'+esc(rail.text)+'</span>'+
        '<span class="jrow-text">'+esc(j.label)+'</span><span class="src"> · '+esc(engineLabel(j.engine))+'</span></span>'+
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
        stopBtnHtml(j)+
        (j.startedAt ? '<a href="/api/jobs/'+encodeURIComponent(j.id)+'/log" target="_blank">Open the log</a>' : "")+
        '<a href="#" class="jopen" data-id="'+esc(j.id)+'" data-kind="'+esc(j.kind)+'" data-room="'+esc(jobRoom(j.kind).toLowerCase())+'"'+(j.slugs&&j.slugs.length?' data-slug="'+esc(j.slugs[0])+'"':'')+'>'+esc(jobOpenLabel(j))+'</a>'+
      '</div></div>';
  }
  box.innerHTML = html;
  box.querySelectorAll("a.jopen").forEach(a=>a.addEventListener("click",(e)=>{
    e.preventDefault();
    const job = JOBS.find(j=>j.id===a.dataset.id);
    if(a.dataset.kind==="develop" || a.dataset.kind==="develop-reply"){
      if(job) openWorkbenchJob(job);
      return;
    }
    setRoom(a.dataset.room);
    if(a.dataset.slug) load().then(()=>{
      const d = [...document.querySelectorAll(".piece .slug")].find(x=>x.textContent===a.dataset.slug);
      if(d) d.scrollIntoView({behavior:"smooth", block:"start"});
    });
  }));
  box.querySelectorAll("button.jans").forEach(b=>b.addEventListener("click",()=>answerJob(b.dataset.id, b.dataset.opt)));
  box.querySelectorAll("button.jretry").forEach(b=>b.addEventListener("click",()=>retryJob(b.dataset.id)));
  box.querySelectorAll("button.jstop").forEach(b=>b.addEventListener("click",()=>stopJob(b.dataset.id)));
}
async function answerJob(id, answer){
  const r = await post("/api/jobs/"+encodeURIComponent(id)+"/answer",{answer});
  if(r.ok) loadJobs(); else flash(r.error || "Could not send that answer");
}
async function retryJob(id){
  const r = await post("/api/jobs/"+encodeURIComponent(id)+"/retry",{});
  if(r.ok) loadJobs(); else flash(r.error || "Could not run it again");
}
// Stop ONE job. The response's status field is deliberately NOT read: for a running subprocess the
// route answers the instant SIGTERM goes out, and the job settles a beat later in its own close
// handler, so any status this toast quoted could already be stale. The next poll renders the truth.
// A false "stopped" means it had already settled and nothing changed, which is not a success to claim.
async function stopJob(id){
  const r = await post("/api/jobs/"+encodeURIComponent(id)+"/stop",{});
  if(!r.ok){ flash(r.error || "Could not stop it"); return; }
  flash(r.stopped ? "Stopping it." : "Too late, it had already stopped on its own.");
  loadJobs();
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
  if(j.status==="stopped") return {text:"You stopped it", color:JC.blue};
  if(j.status==="done") return {text:"Just finished", color:JC.green};
  if(j.status==="queued") return {text:"Waiting its turn", color:JC.greyFg};
  return {text:"Working now", color:JC.ai};
}
function stripClock(j){
  if(j.status==="queued") return "not started";
  if(j.status==="failed") return "stopped after "+jobElapsedText(j.elapsedMs);
  if(j.status==="stopped") return j.elapsedMs==null ? "not started" : "ran for "+jobElapsedText(j.elapsedMs);
  if(j.status==="done") return "took "+jobElapsedText(j.elapsedMs);
  return jobElapsedText(j.elapsedMs);
}
function stripFooter(j){
  if(j.status==="failed") return "It stopped where the red dot is. Nothing was written.";
  if(j.status==="stopped") return STOPPED_FOOTER;
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
      '<div class="jfoot">'+esc(stripFooter(j))+'</div>'+
      (jobStopOffered(j) ? '<div class="jrow-tail"><span class="grow"></span>'+stopBtnHtml(j)+'</div>' : "")+
      '</div>';
    box.querySelectorAll("button.jans").forEach(b=>b.addEventListener("click",()=>answerJob(b.dataset.id, b.dataset.opt)));
    box.querySelectorAll("button.jretry").forEach(b=>b.addEventListener("click",()=>retryJob(b.dataset.id)));
    box.querySelectorAll("button.jstop").forEach(b=>b.addEventListener("click",()=>stopJob(b.dataset.id)));
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
    // Clear a slug's "generating storyboard…" hint once its real video job actually resolves (done,
    // failed, or stopped by Muxin) — inline mirror of storyboardJobDone() in this file's exported section (client
    // script can't import it; kept in sync by hand, card fbfea28b). Runs before load() below so the
    // rebuilt review rows already reflect the cleared state instead of racing it.
    for(const slug of [...storyboardSlugs]){
      const forSlug = JOBS.filter(j=>j.kind==="video" && (j.slugs||[]).includes(slug));
      if(forSlug.length && forSlug.every(j=>j.status==="done"||j.status==="failed"||j.status==="stopped")) storyboardSlugs.delete(slug);
    }
    if(before !== JSON.stringify(JOBS.map(j=>[j.id,j.status]))){
      load(); // a job moved → refresh review rows
      if(currentTab==="content") loadContent(); // a finished advisor round renders its new sheets
      if(currentTab==="studio") loadStudio(); // counts and the team panel just changed
      if(currentTab==="fiction") loadFiction(); // a landed scene or canon check is what she is waiting on
    }
  }catch(e){ connectionState("Content Studio could not load the job queue. Your existing files are unchanged. Check the server, then refresh."); }
}
async function clearJobs(){
  const r = await post("/api/jobs/clear",{});
  if(r.ok){ flash(r.removed+" cleared"); loadJobs(); }
  else flash(r.error || "Could not clear queue");
}
async function addSource(){
  const ta = $("#src"); const source = ta.value.trim();
  if(!source || captureSubmitting) { if(!source) flash("Paste something first"); return; }
  const engine = $("#studioEngine").value;
  setCaptureSubmitting(true);
  try {
    const r = await post("/api/atomize",{source, engine});
    if(r.ok){ ta.value=""; flash("Queued with "+engineLabel(engine)); loadJobs(); }
    else flash(r.error || "Could not queue");
  } finally { setCaptureSubmitting(false); }
}
// ── Studio capture: one front door (v7 Studio) ───────────────────────────────────────────────
// Inline mirror of classifyCapture() / captureHandoffVerdict() in this file's exported section. The client
// script cannot import, so the two copies are kept in sync BY HAND (docs/prototype-port-rules.md
// Rule 5) and page.test.ts pulls this copy back out of the emitted script and runs the identical
// vectors through both.
const BARE_URL_RE = /^\\s*(https?:\\/\\/|www\\.)?[a-z0-9-]+(\\.[a-z0-9-]+)*\\.(com|ai|org|io|net|co|dev)(\\/\\S*)?\\s*$/i;
function classifyCapture(text){
  const t = String(text==null?"":text).trim();
  if(!t) return {kind:"empty"};
  const low = t.toLowerCase();
  if(/follow up|reply to|email|intro|reach out|met /.test(low)) return {kind:"room", room:"Outreach"};
  if(/chapter|scene|elias|character|plot/.test(low)) return {kind:"room", room:"Fiction"};
  if(/price|offer|landing|magnet|survey|venture|phase|response|repl/.test(low)) return {kind:"room", room:"Venture"};
  if(BARE_URL_RE.test(t)) return {kind:"ask-link", url:t};
  return {kind:"room", room:"Content"};
}
function captureVerdict(room){
  if(room==="Content") return {room:room, line:${JSON.stringify(captureHandoffVerdict("Content").line)}, actionLabel:"Start on it"};
  if(room==="Fiction") return {room:room, line:${JSON.stringify(captureHandoffVerdict("Fiction").line)}, actionLabel:"Start on it"};
  if(room==="Outreach") return {room:room, line:${JSON.stringify(captureHandoffVerdict("Outreach").line)}, actionLabel:"Start on it"};
  return {room:room, line:${JSON.stringify(captureHandoffVerdict("Venture").line)}, actionLabel:"Start on it"};
}
// ── end of the capture mirror ──

let linkAskUrl = null;          // the bare link the two-button ask is open on
let captureSubmitting = false;  // the two Studio handoffs share one guard, so Enter cannot double-queue
function captureHandoffSummary(capture){
  if(!capture || !String(capture.text || "").trim() || !String(capture.room || "").trim()) return null;
  const room = String(capture.room);
  return { room:room.toLowerCase(), label:room, text:"Capture waiting in "+room+".",
    detail:String(capture.text).trim().replace(/\\s+/g," ").slice(0,140), action:"Open" };
}
function setCaptureSubmitting(busy){
  captureSubmitting = busy;
  const button=$("#routeBtn"); if(button) button.disabled=busy;
}

function captureText(){ return ($("#src").value||"").trim(); }
function hideCaptureVerdict(){ $("#captureVerdict").hidden = true; }
function setCaptureRail(asking){
  const rail = $("#captureRail");
  rail.textContent = asking ? ${JSON.stringify(CAPTURE_RAIL_ASKING)} : ${JSON.stringify(CAPTURE_RAIL_IDLE)};
  rail.classList.toggle("asking", !!asking);
}
function setCaptureQuiet(show){
  const quiet = $("#captureQuiet");
  if(quiet) quiet.hidden = !show;
}
function openLinkAsk(url){
  linkAskUrl = url;
  hideCaptureVerdict();
  $("#notesPanel").hidden = true;
  $("#linkAsk").hidden = false;
  setCaptureQuiet(false);
  const ta = $("#src");
  ta.readOnly = true; ta.classList.add("dimmed");
  setCaptureRail(true);
}
function closeLinkAsk(clearText){
  linkAskUrl = null;
  $("#linkAsk").hidden = true;
  if($("#notesPanel").hidden) setCaptureQuiet(true);
  const ta = $("#src");
  ta.readOnly = false; ta.classList.remove("dimmed");
  if(clearText) ta.value = "";
  setCaptureRail(false);
}
// States the room it picked, then offers the explicit action that makes a durable handoff.
function showCaptureVerdict(room){
  const v = captureVerdict(room);
  const box = $("#captureVerdict");
  const others = ["Content","Fiction","Outreach","Venture"].filter(r=>r!==room);
  box.innerHTML = '<div>'+esc(v.line)+'</div>'+
      '<div class="cv-row"><button class="primary cap-go">Start on it</button></div>'+
    '<div class="cv-row"><span>Wrong room?</span>'+
      others.map(r=>'<button class="cap-move" data-room="'+r+'">'+r+'</button>').join("")+'</div>';
  box.hidden = false;
  const go = box.querySelector(".cap-go");
  if(go) go.addEventListener("click", ()=>takeCaptureTo(room));
  box.querySelectorAll(".cap-move").forEach(b=>b.addEventListener("click", ()=>showCaptureVerdict(b.dataset.room)));
}
// Save before advancing. Content starts an advisor-only job. Other builds prepare their existing
// human gate with the capture visible, without auto-drafting, approving, scheduling, or publishing.
async function advanceCaptureSafely(room, text){
  if(room==="Content"){
    await Promise.resolve(setRoom("content"));
    const r=await post("/api/captures/start",{text:text,engine:$("#studioEngine").value});
    if(!r.ok) throw new Error(r.error||"Could not start the advisor");
    await loadCaptures(); loadJobs();
    return "Advisor started. It cannot approve or publish.";
  }
  await Promise.resolve(setRoom(room.toLowerCase()));
  if(room==="Fiction"){
    await loadFiction();
    ficPage="write"; renderFiction();
    const beats=$("#ficBeats"); if(beats&&!beats.value.trim()) beats.value=text;
    beats?.focus();
    return "Your beats are in Write next. Review them before drafting.";
  }
  if(room==="Outreach"){
    setOutreachSub("leads");
    $("#outreachList button, #outreachList [tabindex]")?.focus();
    return "Choose the lead this belongs to before drafting.";
  }
  await loadVenture();
  $("#ventureRunStepBtn")?.focus();
  return "The current venture step is open. Review its human gate before running it.";
}
async function takeCaptureTo(room){
  const t = captureText();
  if(!t){ flash("Write or paste something first"); return; }
  const saved = await post("/api/captures", {room:room, text:t});
  if(!saved.ok){ flash(saved.error||"Could not save this capture. It is still in the box."); return; }
  try {
    const message=await advanceCaptureSafely(room,t);
    $("#src").value = "";
    hideCaptureVerdict();
    await loadCaptures(); renderCaptureHandoff();
    flash(message);
  } catch(e) {
    flash(e instanceof Error?e.message:String(e));
  }
}
let SERVER_CAPTURES = [];
async function loadCaptures(){
  try { const r=await fetch("/api/captures"); const d=await r.json(); if(d.ok) SERVER_CAPTURES=d.captures||[]; }
  catch(e) { /* keep the last repository read visible */ }
}
function renderCaptureHandoff(){
  const targets = [
    ["content", "contentCaptureHandoff", "Content"],
    ["fiction", "fictionCaptureHandoff", "Fiction"],
    ["outreach", "outreachCaptureHandoff", "Outreach"],
    ["venture", "ventureCaptureHandoff", "Venture"],
    ["signals", "signalsCaptureHandoff", "Signals"],
    ["charles", "charlesCaptureHandoff", "Charles"],
  ];
  for(const [room, id, label] of targets){
    const box = $("#"+id);
    if(!box) continue;
    const captures = SERVER_CAPTURES.filter(c=>c.room===label);
    if(!captures.length || currentTab !== room){ box.hidden = true; box.innerHTML = ""; continue; }
    box.hidden = false;
    box.innerHTML = captures.map(capture=>'<div class="capture-handoff" data-capture-id="'+esc(capture.id)+'" style="border:1px solid #d8cfbb;background:#fffdf8;border-radius:8px;padding:13px 15px;margin-top:14px">'+
      '<div class="wb-label">CAPTURE WAITING HERE</div>'+
      '<div style="font:400 16px/1.6 Georgia,serif;white-space:pre-wrap;margin-top:6px">'+esc(capture.text)+'</div>'+
      '<div class="actions" style="margin-top:10px">'+(label==="Content"&&!capture.jobId?'<button class="primary cap-start">Start on it</button>':'')+'<button class="cap-return">Back to Studio capture</button><span class="src">'+(capture.jobId?'Advisor started. Approval and publishing remain separate.':'Saved in the repository. Nothing has been approved or published.')+'</span></div>'+
      '</div>').join("");
    box.querySelectorAll(".capture-handoff").forEach(card=>{
      card.querySelector(".cap-start")?.addEventListener("click", async (event)=>{
        event.target.disabled=true;
        const capture=SERVER_CAPTURES.find(c=>c.id===card.dataset.captureId);
        const r=await post("/api/captures/start",{text:capture&&capture.text,engine:$("#studioEngine").value});
        if(r.ok){ flash("Advisor started. It cannot approve or publish."); await loadCaptures(); renderCaptureHandoff(); loadJobs(); }
        else { event.target.disabled=false; flash(r.error||"Could not start the advisor"); }
      });
      card.querySelector(".cap-return")?.addEventListener("click", ()=>{ setRoom("studio"); $("#src").focus(); });
    });
  }
}
function routeCapture(){
  const v = classifyCapture(captureText());
  if(v.kind==="empty"){ flash("Write or paste something first"); return; }
  if(v.kind==="ask-link"){ openLinkAsk(v.url); return; }
  showCaptureVerdict(v.room);
  flash("I read this as "+v.room+".");
}
// "Versions for Content" holds the link in Content for Muxin to decide what to do with it next.
async function linkReadForContent(){
  const url = linkAskUrl;
  if(!url) return;
  const r=await post("/api/captures",{room:"Content",text:url});
  if(!r.ok){ flash(r.error||"Could not save this capture. It is still in the box."); return; }
  closeLinkAsk(true); await loadCaptures(); setRoom("content"); renderCaptureHandoff();
  flash("Kept it in Content. Start on it when you want the advisor.");
}
// "Source for Signals" keeps an inbox item and nothing more. There is no referrer record, no
// funnel data and no job kind that takes a URL, so this must never imply traffic attribution.
async function linkFileForSignals(){
  const url = linkAskUrl;
  if(!url) return;
  const r=await post("/api/captures",{room:"Signals",text:url});
  if(!r.ok){ flash(r.error||"Could not save this capture. It is still in the box."); return; }
  closeLinkAsk(true); await loadCaptures(); setRoom("signals"); renderCaptureHandoff();
  flash("Kept it in Signals. Choose the next action there.");
}
$("#routeBtn").addEventListener("click", routeCapture);
$("#linkReadBtn").addEventListener("click", linkReadForContent);
$("#linkFileBtn").addEventListener("click", linkFileForSignals);
$("#linkCancelBtn").addEventListener("click", ()=>{
  closeLinkAsk(true); hideCaptureVerdict();
});
// A verdict is about the text that produced it, so editing the text retires it.
$("#src").addEventListener("input", hideCaptureVerdict);

// ── Substack Notes checklist (manual pick, replaces the old one-click "Pull Substack Notes") ──
let NOTES = [];
let notesShowDrafted = false;
// Selections keyed by the note's stable cache idx, NOT the DOM — renderNotes() rebuilds the list
// wholesale (e.g. toggling "show already drafted"), which used to silently wipe every ticked
// checkbox (Muxin, 2026-07-16). A selection survives being filtered out of view; Draft selected
// drafts everything in this set.
const selectedNoteIdxs = new Set();
function notesPickRequest(indices, engine){
  return {indices, engine:engine || "claude"};
}
function noteMeta(n){
  const d = n.publishedAt ? n.publishedAt.slice(0,10) : "????-??-??";
  // draftedTag ("in review now" / "published Nd ago" / "drafted before, discarded") comes from the
  // server's note-reuse rule — never recomputed client-side.
  const tag = n.drafted ? ' <span class="drafted-tag">'+esc(n.draftedTag||"already drafted")+'</span>' : "";
  return d+' · eng '+n.eng+' ('+n.likes+' likes · '+n.reposts+' reposts · '+n.replies+' replies)'+tag;
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
  // Opens in place of the quiet capture controls (same carve-out as the bare-link ask), not stacked
  // under them. Closing restores the quiet state.
  if(linkAskUrl) closeLinkAsk(false);
  $("#notesPanel").hidden = false;
  setCaptureQuiet(false);
  $("#notesList").innerHTML = '<div class="empty">Loading…</div>';
  const r = await fetch("/api/notes");
  const data = await r.json();
  if(!data.ok){ $("#notesList").innerHTML = '<div class="empty">'+esc(data.error||"Failed to load notes")+'</div>'; return; }
  NOTES = data.notes;
  selectedNoteIdxs.clear(); // fresh fetch = fresh cache indices; stale selections must not map onto new notes
  renderNotes();
}
function closeNotes(){
  $("#notesPanel").hidden = true;
  if($("#linkAsk").hidden) setCaptureQuiet(true);
}
async function draftSelectedNotes(){
  const indices = [...selectedNoteIdxs].sort((a,b)=>a-b);
  if(!indices.length){ flash("Pick at least one note"); return; }
  $("#notesDraftBtn").disabled = true;
  const r = await post("/api/notes/pick", notesPickRequest(indices, $("#studioEngine").value));
  $("#notesDraftBtn").disabled = false;
  if(r.ok){
    flash(r.jobs.length+" note(s) queued");
    selectedNoteIdxs.clear();
    closeNotes();
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
$("#notesBtn").addEventListener("click", openNotes);
$("#notesCloseBtn").addEventListener("click", closeNotes);
$("#notesShowDrafted").addEventListener("change",(e)=>{ notesShowDrafted = e.target.checked; renderNotes(); });
$("#notesDraftBtn").addEventListener("click", draftSelectedNotes);
$("#src").addEventListener("keydown",(e)=>{ if((e.metaKey||e.ctrlKey)&&e.key==="Enter") routeCapture(); });
setInterval(()=>{ if(jobsPollDue(JOBS, Date.now(), jobsPollArmedUntil)) loadJobs(); }, JOBS_POLL_MS);

for(const id of ["reviewMediaFilter","reviewPlatformFilter","reviewTreatmentFilter"]) $("#"+id).addEventListener("change",render);
$("#reviewRequestFilter").addEventListener("input",render);
$("#reviewSelectAll").addEventListener("click",()=>{ document.querySelectorAll("#reviewMain .review-check").forEach(box=>{ box.checked=true; reviewSelected.add(box.closest(".scan-row").dataset.reviewKey); }); });
$("#reviewApproveSelected").addEventListener("click",approveReviewSelection);
$("#reviewSheet").addEventListener("click", (e)=>{
  const t = e.target.closest ? e.target.closest("[data-step]") : null;
  if(!t) return; const n=Number(t.dataset.step);
  if(n===4) CW.pane="published"; else if(n===3) CW.pane="review"; else { CW.pane="wizard"; CW.step=n; if(n===2&&CW.slug&&CW.treatFor!==CW.slug) cwLoadTreatment(); }
  renderContentWizard();
});
$("#publishedSheet").addEventListener("click", (e)=>{
  const t = e.target.closest ? e.target.closest("[data-step]") : null;
  if(!t) return; const n=Number(t.dataset.step);
  if(n===4) CW.pane="published"; else if(n===3) CW.pane="review"; else { CW.pane="wizard"; CW.step=n; if(n===2&&CW.slug&&CW.treatFor!==CW.slug) cwLoadTreatment(); }
  renderContentWizard();
});
setRoom(${JSON.stringify(BOOT_ROOM)});
loadCaptures().then(renderCaptureHandoff);
// The desk header's live date ("Thursday · Jul 17").
{
  const now = new Date();
  const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const MO = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  $("#deskDate").textContent = DAYS[now.getDay()]+" · "+MO[now.getMonth()]+" "+now.getDate();
}
// Match doRefresh()'s ordering: stamp "last refreshed" once the initial data has actually
// landed, not the instant the page starts loading it (load()/loadJobs() are async).
// loadStudio() is in here because Studio is the boot room: without it the first paint of the desk
// she actually opens on is an empty "Loading…". load() still runs at boot even though its sheet is
// in another room, because the Content nav button's pending badge reads off it.
loadEngines();
Promise.all([loadStudio(), load(), loadJobs(), loadContent()]).finally(markRefreshed);
</script>
</body>
</html>`;
}
