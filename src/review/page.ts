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

// Pure, DOM-free mirror of the inline fmtElapsed(ms) helper the client <script> below uses (both
// for the Jobs queue's live elapsed time and, since card a14693da, the insights follow-up ticker).
export function formatElapsed(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

// Pure, DOM-free mirror of the inline "thinking" ticker text the client <script> below builds
// while awaiting a follow-up insights answer (server-side timeout up to 180s) — replaces a fixed
// "~10-60s" ETA that badly undersold the real wait with a live elapsed-time count instead, so a
// user can tell it's still working rather than assume it's frozen (card a14693da). Exists here
// purely so the text format is Node-testable; the client keeps its own inline copy ticked by a
// setInterval (same cross-runtime duplication convention as the mirrors above).
export function insightsTickerText(elapsedMs: number): string {
  return `✨ Claude is looking into it… (may re-run a report) <span class="ticker">${formatElapsed(elapsedMs)} elapsed</span>`;
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
  .ev-quote { font:italic 400 13px/1.55 Georgia,serif; color:#3a352c; }
  .ev-src { font-size:12px; color:#7a7266; border-bottom:1px solid #d8cfbb; width:fit-content; text-decoration:none; }
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
  .body.story { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12.5px; color:#4a453c; max-height:260px; overflow:auto; }
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
  .notelist { max-height:420px; overflow:auto; }
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
    <button class="room" data-room="signals">Signals</button>
  </nav>
  <span class="grow"></span>
  <span class="desk-date" id="deskDate"></span>
  <span class="hint" id="lastRefreshed" style="min-width:0"></span>
  <button id="refresh" title="Refreshes only the room you're looking at">Refresh</button>
</header>
<main>
  <section class="view" id="roomContent">
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
    <div class="sheet">
      <div class="sheet-head"><h2>Your team, working</h2></div>
      <div class="sheet-sub">Live queue with honest elapsed times and logs. The full one-glance overview (needs-you list, counts across every room) lands in the next build.</div>
      <div class="jobs" id="jobs" style="max-width:none;margin-top:10px"></div>
    </div>
  </section>
  <section class="view" id="roomFiction" hidden>
    <div class="sheet">
      <div class="sheet-head"><h2>The fiction desk</h2></div>
      <div class="sheet-sub">Coming in a later build: your canon (world, philosophy, plot line, voice &amp; characters) editable in place, plus promo shortcuts. Chapter drafting and line-by-line review stay in your GitHub flow. Until then: <code>/story</code> in a terminal.</div>
    </div>
  </section>
  <section class="view" id="roomSignals" hidden>
    <div class="sheet">
    <div class="sheet-head"><h2>Signals</h2></div>
    <div class="sheet-sub">The read on what's working, what isn't, and what's too weak to trust. The full analyst layout lands in a later build.</div>
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
        <span class="hint">Edits land in the brief file itself — /atomize and /strategy already read the latest brief every run, so a change here feeds forward with no extra step.</span>
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
    <div class="sheet" id="outreachPane">
      <div class="sheet-head"><h2>Leads</h2></div>
      <div class="sheet-sub">Dossiers from your scout. Pursue or pass marks the call; a drafted message is yours to edit, and only you ever send it.</div>
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
async function post(path, body){
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
    ? '<div class="reply-context">↳ replying to: '+esc(replyText.replace(/\s+/g," ").slice(0,220))+'</div>'
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
          ? '<div class="thinking">✨ Claude is drafting the '+esc(dupPending.get(row.id))+' version… (~10-60s)</div>'
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
// Five rooms on the desk (Content Studio Riff): Content, Studio, Outreach, Fiction, Signals.
// Refresh stays room-aware: it only re-reads whatever the CURRENT room shows, labeled per room,
// with a "last refreshed HH:MM" stamp so its effect is visible.
let currentTab = "content";
let outreachSub = "leads"; // the Outreach room's Leads | Follow-ups toggle
function refreshLabelFor(t){ return t==="content" ? "Refresh the desk" : t==="studio" ? "Refresh queue" : t==="signals" ? "Reload brief + file list" : t==="outreach" ? (outreachSub==="followups" ? "Refresh follow-ups" : "Scout new leads") : "Refresh"; }
function setRoom(t){
  currentTab = t;
  document.querySelectorAll(".room").forEach(b=>b.classList.toggle("on", b.dataset.room===t));
  $("#roomContent").hidden = t!=="content";
  $("#roomStudio").hidden = t!=="studio";
  $("#roomOutreach").hidden = t!=="outreach";
  $("#roomFiction").hidden = t!=="fiction";
  $("#roomSignals").hidden = t!=="signals";
  $("#refresh").textContent = refreshLabelFor(t);
  if (t==="content"){ loadContent(); }
  if (t==="studio"){ loadJobs(); }
  if (t==="signals" && !briefLoaded){ loadBrief(); loadRaw(); }
  if (t==="outreach"){ setOutreachSub(outreachSub); }
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
    else if (currentTab === "signals") { await loadBrief(); await loadRaw(); }
    else if (currentTab === "outreach") { if (outreachSub === "followups") await loadFollowups(); else await scoutRun(); }
    else { await loadJobs(); }
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
  const start = Date.now();
  const tick = () => { body.innerHTML = '<p class="thinking">✨ Running the full /strategy skill (grades bets, writes a new dated brief — takes minutes; the Studio room has the log) <span class="ticker">'+fmtElapsed(Date.now()-start)+' elapsed</span></p>'; };
  tick();
  const timer = setInterval(tick, 1000);
  loadJobs(); // make the strategy job visible in the Studio room right away
  try {
    const r = await post("/api/strategy/refresh-brief", {});
    if(r.ok){ flash("Brief refreshed: "+(r.path||"")); await loadBrief(); }
    else { body.innerHTML = prevHtml; flash(r.error || "Refresh failed — see the job log"); }
  } catch (e) {
    body.innerHTML = prevHtml;
    flash(e instanceof Error ? e.message : String(e));
  } finally {
    clearInterval(timer);
    btn.disabled = false;
  }
}
$("#briefRefreshBtn").addEventListener("click", refreshBriefRun);

// Insights: a Claude-written synthesis (not a raw report dump), plus a follow-up chat thread that
// can ask Claude to dig into anything — Claude may re-run the reports itself to answer. fmtDays/
// renderInsightsMeta mirror this file's Node-side exports of the same name (kept in sync by hand,
// same convention as insightsTickerText below) — the meta line is built from deterministic
// server-side numbers, NOT from Claude's markdown, since mdToHtml has no link syntax and this way
// the freshness stamp can never be wrong or omitted by an LLM pass.
function fmtDays(n){ return n+" day"+(n===1?"":"s"); }
function renderInsightsMeta(r){
  const parts = [];
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
  $("#insightsOut").innerHTML = '<p class="hint">Running the reports, then asking Claude for a synthesis… (~20-40s)</p>';
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
  // Honest, live feedback instead of a fixed ETA that undersells the real (up to 180s) wait —
  // may re-run a report, so a ticking elapsed count beats a static guess (card a14693da).
  const start = Date.now();
  const tick = () => { thinking.innerHTML = '✨ Claude is looking into it… (may re-run a report) <span class="ticker">'+fmtElapsed(Date.now()-start)+' elapsed</span>'; }; // mirrors insightsTickerText() in this file's Node-side export, kept in sync by hand
  tick();
  const timer = setInterval(tick, 1000);
  $("#insightsThread").appendChild(thinking);
  let r;
  try {
    r = await post("/api/strategy/ask-insights", {question:q, history:insightsHistory});
  } finally {
    clearInterval(timer);
  }
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
  const start = Date.now();
  const tick = () => { box.innerHTML = '<div class="empty">✨ Pulling fresh analytics… real Chrome, can take a few minutes <span class="ticker">'+fmtElapsed(Date.now()-start)+' elapsed</span></div>'; };
  tick();
  const timer = setInterval(tick, 1000);
  let r;
  try {
    r = await post("/api/strategy/pull", {});
  } finally {
    clearInterval(timer);
  }
  btn.disabled = false; $("#rawRefreshBtn").disabled = false;
  if(r.ok){ flash("Pull complete"); await loadRaw(); }
  else { box.innerHTML = prevHtml; flash("Pull failed: "+(r.error||"error")); await loadRaw(); }
}
$("#rawPullBtn").addEventListener("click", pullFresh);

// ── Outreach room: the dossier on the desk (Content Studio Riff 3d) ──
// One lead at a time, read like a briefing: the matchmaker read up top (why them / why you /
// mutual), the people to reach with their own follow-up clocks, the message you shape, and the
// one honest logistics step — "Mark as sent" — that starts the ledger clock. Legacy leads (no
// matchmaker fields yet) fall back to their pitch angle with a "legacy read" chip until
// re-qualified. Nothing here contacts anyone.
let OUTREACH_LEADS = null;
let activeLeadDir = null;
let scoutInFlight = false;
const outPending = new Set();
const outError = new Map();
const msgPending = new Set();
const msgError = new Map();

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

function outreachMarginHtml(l){
  const evs = [...(l.evidence||[])].sort((a,b)=>(b.signal==="worldview-match"?1:0)-(a.signal==="worldview-match"?1:0));
  const items = evs.slice(0,5).map(e=>{
    const quote = e.quote && e.quote!=="(none)" ? '<div class="ev-quote">"'+esc(e.quote)+'"</div>'
      : (e.description ? '<div class="d">'+esc(e.description)+'</div>' : "");
    const link = /^https?:\/\//i.test(e.source) ? '<a class="ev-src" href="'+esc(e.source)+'" target="_blank" rel="noopener">source ↗</a>' : "";
    const cls = e.signal==="worldview-match" ? "green" : "sand";
    return '<div class="wb-check '+cls+'"><span class="t"><span class="verdict">'+esc(e.signal)+'</span>'+(e.person?' · '+esc(e.person):"")+'</span>'+quote+link+'</div>';
  }).join("");
  const stats = (l.jsaStats||[]).slice(0,3).map(s=>'<div class="d" style="font-size:12.5px;color:#5a5346;">'+esc(s.label)+': '+esc(s.value)+'</div>').join("");
  const profile = (l.profileRest||l.profile) ? '<details class="lead-details"><summary>Full profile</summary><div class="ntext" style="white-space:pre-wrap;font-size:12.5px;">'+esc(l.profileRest||l.profile)+'</div></details>' : "";
  const reasoning = l.classificationNote ? '<details class="lead-details"><summary>Full why-fit reasoning</summary><div class="ntext" style="white-space:pre-wrap;font-size:12.5px;">'+esc(l.classificationNote)+'</div></details>' : "";
  return '<div class="session-margin"><div class="wb-margin-cap">WHY THIS IS ON YOUR DESK</div>'+items+
    (stats?'<div>'+stats+'</div>':"")+reasoning+profile+
    '<div class="wb-reply"><span class="mono-note">This page stays tied to the follow-up row. Months from now: the why, what you said, the date, one click.</span></div></div>';
}

function outreachMessageBox(l){
  const msg = l.latestMessage;
  if(!msg) return "";
  const recip = msg.recipient ? ' · to '+esc(msg.recipient) : "";
  if(msg.status === "locked"){
    return '<div class="lead-msg"><div class="nmeta">locked message · '+esc(msg.file)+recip+' · '+esc(msg.channel||"?")+'</div>'+
      '<div class="body">'+esc(msg.body)+'</div>'+
      '<div class="src">Locked means ready. You send it yourself; log it below so the clock starts.</div></div>';
  }
  const revPending = msgPending.has(l.dir);
  const revErr = msgError.get(l.dir);
  return '<div class="lead-msg"><div class="nmeta">drafted message · '+esc(msg.file)+recip+' · '+esc(msg.status)+'</div>'+
    '<textarea class="msg-edit">'+esc(msg.body)+'</textarea>'+
    '<div class="actions"><button class="msg-save" data-dir="'+esc(l.dir)+'" data-file="'+esc(msg.file)+'">Save edits</button></div>'+
    '<div class="aibox show">'+
      (revPending
        ? '<div class="thinking">✨ revising… (your subscription, ~10-30s)</div>'
        : '<input class="msg-revise-input" placeholder="what should change in the message?" /><button class="send msg-revise" data-dir="'+esc(l.dir)+'" data-file="'+esc(msg.file)+'">Revise with AI</button>'+
          (revErr ? '<div class="aierr">⚠ '+esc(revErr)+'</div>' : ""))+
    '</div>'+
    '<div class="src">Approve on this page locks the text. Nothing sends itself.</div></div>';
}

function whoBoxHtml(l){
  const chips = (l.contacts||[]).map(c=>'<span class="who-chip"><b>'+esc(c.name)+'</b>'+(c.role?'<span class="role">'+esc(c.role)+'</span>':"")+'</span>').join("");
  const suggested = (l.suggestedContacts||[]).map(n=>'<span class="who-suggest">'+esc(n)+'<button class="who-add" data-dir="'+esc(l.dir)+'" data-name="'+esc(n)+'">+ add</button></span>').join("");
  return '<div class="who-box">'+
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:9px;"><span class="wb-margin-cap">WHO YOU WOULD REACH</span><span class="grow"></span></div>'+
    '<div>'+chips+suggested+'</div>'+
    '<div class="aibox show" style="margin-top:8px;"><input class="who-name" placeholder="name" style="max-width:160px;" /><input class="who-role" placeholder="role (optional)" style="max-width:180px;" /><button class="who-save" data-dir="'+esc(l.dir)+'">Add contact</button></div>'+
    '<div class="src" style="margin-top:8px;">One lead can hold many people. Each gets its own drafted message and its own follow-up clock.</div>'+
  '</div>';
}

function sentBarHtml(l){
  const msg = l.latestMessage;
  if(!msg || msg.status !== "locked") return "";
  const channels = ["email","linkedin-dm","contact-form","podcast-pitch"];
  const chanSel = '<select class="sent-channel">'+channels.map(c=>'<option value="'+c+'"'+(c===(msg.channel||"email")?" selected":"")+'>'+c+'</option>').join("")+'</select>';
  const people = (l.contacts||[]).map(c=>c.name);
  const personSel = '<select class="sent-person"><option value="">(no specific person)</option>'+people.map(n=>'<option value="'+esc(n)+'"'+(msg.recipient===n?" selected":"")+'>'+esc(n)+'</option>').join("")+'</select>';
  return '<div class="sent-bar">'+
    '<div style="display:flex;flex-direction:column;gap:2px;min-width:220px;flex:1;"><span style="font-size:13px;font-weight:600;">Sent it? Log it so the clock starts.</span><span class="src">This is the step that puts them on the follow-ups ledger, with the date, channel, and this message.</span></div>'+
    personSel+chanSel+'<button class="go sent-go" data-dir="'+esc(l.dir)+'">Mark as sent</button>'+
  '</div>';
}

function dossierHtml(l){
  const seg = leadSegment(l);
  const info = SEG_INFO[seg] || SEG_INFO["content-example"];
  const undecided = !["pursue","passed","locked","drafted"].includes(l.status);
  const pending = outPending.has(l.dir);
  const err = outError.get(l.dir);
  const fitChip = l.classificationOrFit ? '<span class="fit-chip">'+esc(l.classificationOrFit)+'</span>' : "";
  const provChip = l.source === "jsa" ? '<span class="legacy-chip">research: JSA</span>' : "";
  const hasMatchmaker = l.whyMutual || l.whyThem || l.whyMe;
  const headline = l.whyMutual || l.pitchAngle || l.pitch || "(no read recorded yet)";
  const legacy = hasMatchmaker ? "" : ' <span class="legacy-chip">legacy read — re-qualify for the matchmaker version</span>';
  const mm = hasMatchmaker
    ? '<div class="mm-grid">'+
      (l.whyThem?'<div class="mm-row"><span class="k">Why them, for you</span><span class="v">'+esc(l.whyThem)+'</span></div>':"")+
      (l.whyMe?'<div class="mm-row"><span class="k">Why you, for them</span><span class="v">'+esc(l.whyMe)+'</span></div>':"")+
      '</div>'
    : "";
  const status = pending
    ? '<div class="hint">drafting… (your subscription, ~30-60s — the Studio room has progress + log)</div>'
    : err ? '<div class="aierr">⚠ '+esc(err)+' — see the Studio room for the job log</div>' : "";
  const decideBtns = l.kind==="content-example" ? "" :
    '<div class="wb-handoff">'+
      (undecided ? '<button class="primary out-pursue" data-dir="'+esc(l.dir)+'">Worth pursuing</button><button class="out-pass" data-dir="'+esc(l.dir)+'">Pass</button>' : "")+
      ((l.status==="pursue"||l.status==="qualified") && !pending ? '<button class="out-draft" data-dir="'+esc(l.dir)+'">Draft the message</button>' : "")+
      '<span class="note">Pursue or pass just marks your call. Drafting writes a message for you to shape; only you ever send it.</span>'+
    '</div>';
  const notes = '<div class="lead-notes">'+
    (l.muxinNotes ? '<div class="my-notes">'+esc(l.muxinNotes)+'</div>' : "")+
    '<div class="aibox show"><input class="lead-note-input" placeholder="your note on this lead (what stood out)…" /><button class="lead-note-save" data-dir="'+esc(l.dir)+'">Save note</button></div></div>';
  return '<div class="dossier-grid"><div style="min-width:0;">'+
    '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;"><span class="seg-chip '+esc(seg)+'">'+esc(info.label)+'</span>'+fitChip+'<span class="src">'+esc(info.line)+'</span><span class="grow"></span>'+provChip+'</div>'+
    '<div class="wb-label" style="margin:14px 0 0;">Why this matters to you, in plain terms'+legacy+'</div>'+
    '<div class="dossier-why">'+esc(headline)+'</div>'+
    mm + whoBoxHtml(l) + status + outreachMessageBox(l) + sentBarHtml(l) + decideBtns + notes +
    (l.url?'<div class="src" style="margin-top:10px;"><a href="'+esc(l.url)+'" target="_blank" rel="noopener">'+esc(l.url)+'</a></div>':"")+
  '</div>'+outreachMarginHtml(l)+'</div>';
}

function renderOutreachBox(){
  if(!OUTREACH_LEADS) return;
  const box = $("#outreachList");
  const leads = OUTREACH_LEADS;
  if(!leads.length){
    box.innerHTML = '<div class="empty">No leads yet. Scout new leads (top right) runs the discovery agent; /outreach add seeds one by hand.</div>';
    return;
  }
  const undecided = leads.find(l=>!["pursue","passed","locked","drafted"].includes(l.status));
  if(!activeLeadDir || !leads.some(l=>l.dir===activeLeadDir)) activeLeadDir = (undecided||leads[0]).dir;
  const rail = leads.map(l=>{
    const seg = leadSegment(l); const info = SEG_INFO[seg]||SEG_INFO["content-example"];
    return '<span class="lead-chip'+(l.dir===activeLeadDir?" on":"")+'" data-dir="'+esc(l.dir)+'"><span class="dot" style="background:'+info.dot+'"></span>'+esc(l.name||l.dir)+'<span class="k">'+esc(info.label.toLowerCase())+'</span></span>';
  }).join("");
  const active = leads.find(l=>l.dir===activeLeadDir);
  box.innerHTML = '<div class="lead-rail">'+rail+'</div>'+(active?dossierHtml(active):"");
  box.querySelectorAll(".lead-chip").forEach(c=>c.addEventListener("click",()=>{ activeLeadDir = c.dataset.dir; renderOutreachBox(); }));
  box.querySelectorAll("button.out-draft").forEach(b=>b.addEventListener("click", ()=>outreachDraft(b.dataset.dir)));
  box.querySelectorAll("button.out-pursue").forEach(b=>b.addEventListener("click", ()=>outreachDecide(b.dataset.dir,"pursue")));
  box.querySelectorAll("button.out-pass").forEach(b=>b.addEventListener("click", ()=>outreachDecide(b.dataset.dir,"pass")));
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

async function outreachMarkSent(dir, person, channel){
  const r = await post("/api/outreach/mark-sent", {dir, person, channel});
  if(r.ok){ flash("Logged — the clock starts today. See Follow-ups."); await loadOutreach(); }
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
  const start = Date.now();
  const tick = () => { banner.textContent = "✨ Scouting for new leads… (bounded searches on your subscription, takes minutes — the Studio room has the log) · "+fmtElapsed(Date.now()-start)+" elapsed"; };
  tick();
  const timer = setInterval(tick, 1000);
  box.prepend(banner);
  loadJobs(); // make the scout job visible in the Studio room right away
  try {
    const r = await post("/api/outreach/scout", {});
    if(r.ok){ flash("Scout finished — leads reloaded"); }
    else flash(r.error || "Scout failed — see the job log");
  } catch (e) {
    flash(e instanceof Error ? e.message : String(e));
  } finally {
    clearInterval(timer);
    scoutInFlight = false;
    await loadOutreach();
  }
}

async function loadOutreach(){
  const box = $("#outreachList");
  if(!OUTREACH_LEADS) box.innerHTML = '<div class="empty">Loading…</div>';
  const r = await fetch("/api/outreach/leads");
  const d = await r.json();
  OUTREACH_LEADS = d.leads || [];
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

async function outreachDraft(dir){
  if(outPending.has(dir)) return; // already in flight — don't fire a second real claude -p spawn
  outError.delete(dir);
  outPending.add(dir); renderOutreachBox();
  try {
    // Recipient defaults to the lead's first contact so the message frontmatter carries the
    // person its follow-up clock will belong to.
    const lead = (OUTREACH_LEADS||[]).find(l=>l.dir===dir);
    const recipient = lead && lead.contacts && lead.contacts.length ? lead.contacts[0].name : undefined;
    const r = await post("/api/followups/draft-follow-up", recipient ? {dir, recipient} : {dir});
    if(r.ok){ flash("Drafted — shape it here before you ever send it"); await loadOutreach(); }
    else { outError.set(dir, r.error || "Failed to draft"); }
  } catch (e) {
    outError.set(dir, e instanceof Error ? e.message : String(e));
  } finally {
    outPending.delete(dir); renderOutreachBox();
  }
}

async function outreachDecide(dir, decision){
  const r = await post("/api/outreach/decide", {dir, decision});
  if(r.ok){ flash(decision==="pursue" ? "Marked worth pursuing" : "Passed"); loadOutreach(); }
  else flash(r.error || "Failed");
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
function jobPill(s){ return s==="done"?"published":s==="failed"?"blocked":s==="running"?"revise":"needs"; }
function jobStatusText(s){ return s==="running"?"working…":s; }
function fmtElapsed(ms){
  if(ms==null) return "";
  const s = Math.round(ms/1000);
  return s<60 ? s+"s" : Math.floor(s/60)+"m "+(s%60)+"s";
}
function renderJobs(){
  const box = $("#jobs"); box.innerHTML = "";
  if(!JOBS.length){ box.innerHTML = '<div class="empty" style="padding:34px">Nothing queued yet. Drop an idea above. 🌱</div>'; return; }
  const clearable = JOBS.some(j=>j.status==="done"||j.status==="failed");
  box.innerHTML = '<div class="jobs-head"><h3>Queue</h3>'+(clearable?'<button id="clearJobsBtn">Clear queue</button>':'')+'</div>';
  for(const j of [...JOBS].reverse()){
    const el = document.createElement("div"); el.className = "job";
    const dot = j.status==="running" ? '<span class="spin-dot"></span>' : "";
    const err = j.error ? '<div class="jerr">'+esc(j.error)+'</div>' : "";
    // Heartbeat: last line of real output, shown only while running, so a long /atomize pass never
    // reads as a silent black box — the whole point of persisting + streaming the job log.
    const heartbeat = (j.status==="running" && j.lastStdoutLine) ? '<div class="jheartbeat">'+esc(j.lastStdoutLine)+'</div>' : "";
    const elapsed = j.elapsedMs!=null ? '<span class="jelapsed">'+fmtElapsed(j.elapsedMs)+'</span>' : "";
    const viewLog = j.startedAt ? '<a class="jlog" href="/api/jobs/'+encodeURIComponent(j.id)+'/log" target="_blank">log</a>' : "";
    let right = elapsed + '<span class="pill '+jobPill(j.status)+'">'+esc(jobStatusText(j.status))+'</span>' + viewLog;
    if(j.status==="done" && j.slugs && j.slugs.length){
      right = '<a class="jump" href="#" data-slug="'+esc(j.slugs[0])+'">→ review'+(j.slugs.length>1?" "+j.slugs.length+" pieces":"")+'</a>' + right;
    }
    el.innerHTML = dot + '<div class="jlabel"><span class="txt"><span class="jkind">'+esc(j.kind)+'</span> · '+esc(j.label)+'</span>'+heartbeat+err+'</div>' + right;
    box.appendChild(el);
  }
  box.querySelectorAll("a.jump").forEach(a=>a.addEventListener("click",(e)=>{
    e.preventDefault(); setRoom("content");
    load().then(()=>{
      const d = [...document.querySelectorAll(".piece .slug")].find(x=>x.textContent===a.dataset.slug);
      if(d) d.scrollIntoView({behavior:"smooth", block:"start"});
    });
  }));
}
async function loadJobs(){
  try{
    const before = JSON.stringify(JOBS.map(j=>[j.id,j.status]));
    const r = await fetch("/api/jobs"); JOBS = (await r.json()).jobs || [];
    renderJobs();
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
setInterval(()=>{ if(JOBS.some(j=>j.status==="queued"||j.status==="running")) loadJobs(); }, 3000);

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
