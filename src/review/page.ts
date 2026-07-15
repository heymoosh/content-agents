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
  body { margin:0; background:var(--paper); color:var(--ink);
    font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
  header { position:sticky; top:0; z-index:5; background:rgba(250,248,243,.92);
    backdrop-filter:blur(8px); border-bottom:1px solid var(--line); padding:14px 22px;
    display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
  h1 { font:600 17px/1.2 Georgia,"Times New Roman",serif; margin:0; letter-spacing:.2px; }
  .count { background:var(--accent); color:var(--paper); border-radius:20px; padding:2px 11px;
    font-size:13px; font-weight:600; }
  .grow { flex:1; }
  label.toggle { font-size:13px; color:var(--muted); display:flex; align-items:center; gap:6px; cursor:pointer; }
  button { font:inherit; cursor:pointer; border:1px solid var(--line); background:var(--card);
    color:var(--ink); border-radius:7px; padding:6px 12px; transition:.12s; }
  button:hover { border-color:var(--muted); }
  button:disabled { opacity:.4; cursor:default; }
  main { max-width:860px; margin:0 auto; padding:22px 22px 120px; }
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
  nav.tabs { display:flex; gap:5px; }
  .tab { border:1px solid var(--line); background:var(--card); border-radius:8px; padding:6px 14px;
    font-weight:600; color:var(--muted); display:flex; align-items:center; gap:7px; }
  .tab.on { background:var(--accent); color:var(--paper); border-color:var(--accent); }
  .tab.on .count { background:var(--paper); color:var(--accent); }
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
  .notepick input[type=checkbox] { margin-top:3px; flex:0 0 auto; }
  .notepick .ntext { flex:1; min-width:0; font-size:13.5px; line-height:1.45; }
  .notepick .nmeta { font-size:11.5px; color:var(--muted); margin-bottom:2px; }
  .notepick .nmeta .drafted-tag { color:var(--blue); font-weight:600; }
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
  .thread-turn { margin-top:10px; padding-top:10px; border-top:1px solid var(--line); }
  .thread-turn.q { font-weight:600; color:var(--muted); font-size:13.5px; border-top:none; padding-top:0; }
  .jobs { max-width:820px; margin:24px auto 0; }
  .jobs > h3 { font:600 13px/1.3 Georgia,serif; color:var(--muted); margin:0 0 8px; text-transform:uppercase; letter-spacing:.5px; }
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
</style>
</head>
<body>
${opts.isDevWorktree ? `<div class="worktree-banner">⚠ Dev worktree checkout (${opts.repoRoot}) — data/content here is isolated and gitignored, not synced with your main repo. Numbers may look empty/stale even when your real pipeline is fine.</div>` : ""}
<header>
  <h1>Content studio</h1>
  <nav class="tabs">
    <button class="tab on" data-tab="ingest">Add / Queue</button>
    <button class="tab" data-tab="review">Review <span class="count" id="count">0</span></button>
    <button class="tab" data-tab="strategy">Analytics</button>
    <button class="tab" data-tab="outreach">Outreach</button>
    <button class="tab" data-tab="followups">Follow-ups</button>
  </nav>
  <span class="grow"></span>
  <label class="toggle" id="decidedWrap"><input type="checkbox" id="showDecided" /> show published / discarded</label>
  <span class="hint" id="lastRefreshed" style="min-width:0"></span>
  <button id="refresh" title="Refreshes only the tab you're looking at">Refresh queue</button>
</header>
<main>
  <section class="view" id="ingestView">
    <div class="ingest">
      <textarea id="src" placeholder="Paste an idea, a file path to an Obsidian note, or a Substack URL, then Add to queue. (⌘/Ctrl+Enter)"></textarea>
      <div class="ingest-actions">
        <button class="primary" id="addBtn">Add to queue</button>
        <button id="notesBtn">Browse Substack Notes</button>
        <span class="hint">One source per add. Claude drafts it on your subscription ($0), one at a time, so keep adding while it works. LinkedIn/X posts aren't re-importable; paste the text to expand one.</span>
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
        <span class="hint">Pick the notes worth cross-posting. Draft selected scaffolds a folder per note and runs the normal atomize pipeline (tag, route, draft, validate, queue) — nothing publishes without your review.</span>
      </div>
    </div>
    <div class="jobs" id="jobs"></div>
  </section>
  <section class="view" id="reviewView" hidden>
    <div id="reviewMain"><div class="empty">Loading…</div></div>
  </section>
  <section class="view" id="strategyView" hidden>
    <div class="strategy">
      <div class="strategy-actions">
        <button class="primary" id="insightsBtn">Generate insights</button>
        <span class="hint">Runs the analytics reports, then asks Claude (your subscription, $0) for a short skim: what's working, what's not, the numbers that matter. Nothing here writes data or publishes anything.</span>
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
    <div class="notes-panel">
      <div class="notes-head">
        <h3>Latest strategy brief</h3>
        <span class="grow"></span>
        <span class="src" id="briefPath"></span>
      </div>
      <div class="md" id="briefBody">Loading…</div>
      <div class="aibox show">
        <input placeholder="tell Claude what to change in the brief…" id="briefAskInput" />
        <button class="send" id="briefAskBtn">Send to Claude</button>
      </div>
      <span class="hint">Edits land in the brief file itself — /atomize and /strategy already read the latest brief every run, so a change here feeds forward with no extra step.</span>
    </div>
    <div class="notes-panel">
      <div class="notes-head">
        <h3>Raw downloaded exports</h3>
        <span class="grow"></span>
        <button id="rawRefreshBtn">Refresh</button>
      </div>
      <div id="rawList"><div class="empty">Loading…</div></div>
      <span class="hint">The actual CSV/JSON/XLSX files pulled from each platform (data/inbox = not yet ingested, data/processed = archived after npm run ingest) — open one yourself if you want to read the raw numbers rather than a computed report.</span>
    </div>
  </section>
  <section class="view" id="outreachView" hidden>
    <div class="strategy">
      <div class="strategy-actions">
        <span class="hint">Read-only (Phase 1 has no send path, nothing here contacts anyone). Add/research/qualify leads from the terminal: <code>/outreach add</code>, then <code>npm run outreach:research -- outreach/leads/&lt;dir&gt;</code>, then <code>npm run outreach:qualify -- outreach/leads/&lt;dir&gt;</code>.</span>
      </div>
      <div id="outreachList"><div class="empty">Loading…</div></div>
    </div>
  </section>
  <section class="view" id="followupsView" hidden>
    <div class="strategy">
      <div class="strategy-actions">
        <span class="hint">Tracks state AFTER a message is sent by hand — nothing here contacts anyone. Mark sent, mark responded, draft a follow-up touch (reframes the locked message; still lands pending review), or move on.</span>
      </div>
      <div id="followupsNote"></div>
      <div id="followupsList"><div class="empty">Loading…</div></div>
    </div>
  </section>
</main>
<div class="flash" id="flash"></div>
<script>
const $ = (s, r=document) => r.querySelector(s);
let DATA = { pieces: [], pending: 0 };
let showDecided = false;
const DECIDED = new Set(["published","discard","locked"]);

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
  // row.storyboardQueued is a client-only flag (survives until the next full /api/queue refresh,
  // same pattern as row.aiError) so a queued job reads as queued, not as a dead button.
  const storyboardBtn = row.canGenerateStoryboard
    ? (row.storyboardQueued
        ? '<span class="hint">✨ generating storyboard… (Add / Queue tab has progress)</span>'
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
    // Reopens (and stays open) when a prior "Ask Claude" attempt failed, so the error — durable
    // now, not a 1.4s toast — is still visible after the row's next rerender, not wiped by it.
    // Also durably shows Claude's REFUSAL reason (card 9304e4a5 part 4) — same mechanism, a real
    // explanation instead of a silent no-op.
    '<div class="aibox'+(row.aiError?" show":"")+'"><input placeholder="tell Claude what to change…" /><button class="send" data-act="ai-send">Send to Claude</button>'+
      (row.aiError ? '<div class="aierr">⚠ '+esc(row.aiError)+'</div>' : "")+
    '</div>'+
    (row.duplicatable
      ? '<div class="dupbox'+(row.dupError?" show":"")+'"><select>'+dupOptions+'</select><button class="send" data-act="dup-send">Duplicate</button>'+
        (row.dupError ? '<div class="duperr">⚠ '+esc(row.dupError)+'</div>' : "")+
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
    const inp = el.querySelector(".aibox input"); const instruction = inp ? inp.value.trim() : "";
    if(!instruction){ flash("Type what you want changed first"); return; }
    row.aiError = null;
    el.querySelector(".aibox").innerHTML = '<div class="thinking">✨ Claude is revising… (your subscription, ~10-30s)</div>';
    const r = await post("/api/revise",{slug:piece.slug,id:row.id,instruction});
    // Durable inline error on the row (survives rerender) instead of a 1.4s auto-hiding toast —
    // the toast alone made a real failure ("Claude ran but didn't change anything") vanish before
    // it registered as anything but "nothing's working."
    if(r.ok){ row.body = r.body; flash("Revised by Claude"); }
    else { row.aiError = r.error || "error"; }
    rerender();
  } else if (act === "gen-storyboard"){
    e.target.disabled = true;
    const r = await post("/api/video/generate",{slug:piece.slug});
    if(r.ok){ row.storyboardQueued = true; flash("Queued — generating storyboard (Add / Queue tab has progress)"); loadJobs(); }
    else { e.target.disabled = false; flash(r.error || "Could not queue /video"); }
    rerender();
  } else if (act === "dup"){
    const box = el.querySelector(".dupbox"); box.classList.toggle("show");
    if(!box.classList.contains("show")) row.dupError = null; // closing dismisses any stale error
  } else if (act === "dup-send"){
    const sel = el.querySelector(".dupbox select");
    const platform = sel ? sel.value : "";
    if(!platform){ flash("No other platform to duplicate to"); return; }
    row.dupError = null;
    el.querySelector(".dupbox").innerHTML = '<div class="thinking">✨ Claude is drafting the '+esc(platform)+' version… (~10-60s)</div>';
    const r = await post("/api/duplicate",{slug:piece.slug,id:row.id,platform});
    if(r.ok){ flash("Duplicated to "+platform+" — new pending row added"); await load(); }
    else { row.dupError = r.error || "error"; rerender(); }
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
  $("#count").textContent = pending + " pending";
  if (!shown) main.innerHTML = '<div class="empty">Nothing '+(showDecided?"here yet":"awaiting review")+'. 🎉</div>';
}

// ── tabs ──
// Refresh used to always do the same global rescan (load() + loadJobs()) no matter which tab was
// open, and never touched the Analytics tab at all — confusing (backlog card 3625b185: "what does
// Refresh even do?"). It's now tab-aware: doRefresh() below only re-reads whatever the CURRENT tab
// shows, labeled per tab, with a "last refreshed HH:MM" stamp so its effect is visible.
let currentTab = "ingest";
function refreshLabelFor(t){ return t==="review" ? "Refresh review" : t==="strategy" ? "Refresh brief + exports" : t==="outreach" ? "Refresh leads" : t==="followups" ? "Refresh follow-ups" : "Refresh queue"; }
function setTab(t){
  currentTab = t;
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("on", b.dataset.tab===t));
  $("#ingestView").hidden = t!=="ingest";
  $("#reviewView").hidden = t!=="review";
  $("#strategyView").hidden = t!=="strategy";
  $("#outreachView").hidden = t!=="outreach";
  $("#followupsView").hidden = t!=="followups";
  $("#decidedWrap").style.display = t==="review" ? "" : "none";
  $("#refresh").textContent = refreshLabelFor(t);
  if (t==="strategy" && !briefLoaded){ loadBrief(); loadRaw(); }
  if (t==="outreach"){ loadOutreach(); }
  if (t==="followups"){ loadFollowups(); }
}
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click", ()=>setTab(b.dataset.tab)));

let lastRefreshedAt = null;
function fmtHHMM(ms){ const d = new Date(ms); return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0"); }
function markRefreshed(){ lastRefreshedAt = Date.now(); $("#lastRefreshed").textContent = "last refreshed "+fmtHHMM(lastRefreshedAt); }

// Re-reads only what the ACTIVE tab shows — never a Claude spawn, never the other tabs' data.
// Ingest: the job queue. Review: the full review-queue.md + live-provider rescan (load()) that used
// to be Refresh's only behavior. Strategy: the brief + raw-exports list (NOT "Generate insights" —
// that's a real Claude call and stays a deliberate button click, never auto-fired by Refresh).
async function doRefresh(){
  $("#refresh").disabled = true;
  try {
    if (currentTab === "review") { await load(); await loadJobs(); }
    else if (currentTab === "strategy") { await loadBrief(); await loadRaw(); }
    else if (currentTab === "outreach") { await loadOutreach(); }
    else if (currentTab === "followups") { await loadFollowups(); }
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

// Insights: a Claude-written synthesis (not a raw report dump), plus a follow-up chat thread that
// can ask Claude to dig into anything — Claude may re-run the reports itself to answer.
let insightsHistory = [];
async function generateInsights(){
  $("#insightsBtn").disabled = true;
  $("#insightsPanel").hidden = false;
  insightsHistory = [];
  $("#insightsThread").innerHTML = "";
  $("#insightsOut").innerHTML = '<p class="hint">Running the reports, then asking Claude for a synthesis… (~20-40s)</p>';
  const r = await post("/api/strategy/insights", {});
  $("#insightsBtn").disabled = false;
  if(r.ok){ $("#insightsOut").innerHTML = mdToHtml(r.summary); insightsHistory = [{role:"assistant", content:r.summary}]; }
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
  thinking.className = "thinking"; thinking.textContent = "✨ Claude is looking into it… (~10-60s, may re-run a report)";
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
  if(!d.files || !d.files.length){ box.innerHTML = '<div class="empty">No raw exports found in data/inbox or data/processed on this checkout.</div>'; return; }
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

// ── Outreach (Phase 1, read-only) ──
// Same grouping order as status.ts's own STATUS_ORDER (pursue-ready leads first, cold/terminal
// statuses last) so this view and npm run outreach:status never disagree about ordering.
const OUTREACH_STATUS_ORDER = ["pursue","qualified","researched","intake","drafted","locked","passed"];
async function loadOutreach(){
  const box = $("#outreachList");
  box.innerHTML = '<div class="empty">Loading…</div>';
  const r = await fetch("/api/outreach/leads");
  const d = await r.json();
  const leads = (d.leads || []);
  if(!leads.length){
    box.innerHTML = '<div class="empty">No outreach leads yet. Run <code>/outreach add</code> (or npm run outreach:add) from the terminal to seed one.</div>';
    return;
  }
  const groups = new Map();
  for(const l of leads){
    const key = l.status || "(no status)";
    if(!groups.has(key)) groups.set(key, []);
    groups.get(key).push(l);
  }
  const keys = [...OUTREACH_STATUS_ORDER.filter(k=>groups.has(k)), ...[...groups.keys()].filter(k=>!OUTREACH_STATUS_ORDER.includes(k))];
  box.innerHTML = "";
  for(const key of keys){
    const group = groups.get(key);
    const sec = document.createElement("div"); sec.className = "notes-panel";
    let rows = "";
    for(const l of group){
      const field = l.kind === "platform" ? "fit" : "classification";
      const value = l.classificationOrFit || "unclear";
      const angle = l.pitchAngle ? '<div class="src">pitch: '+esc(l.pitchAngle)+'</div>' : "";
      rows += '<div class="notepick"><div class="ntext"><div class="nmeta">'+esc(l.kind)+' · '+esc(l.source)+' · '+esc(field)+'='+esc(value)+'</div>'+
        '<b>'+esc(l.name)+'</b>'+angle+'<div class="src">'+esc(l.dir)+'</div></div></div>';
    }
    sec.innerHTML = '<div class="notes-head"><h3>'+esc(key.toUpperCase())+' ('+group.length+')</h3></div><div class="notelist">'+rows+'</div>';
    box.appendChild(sec);
  }
}

// ── Follow-ups (Phase 4) ──
// Fixed bucket order (not data-driven) so the 4 reason-buckets always render in the same place,
// including an empty "Inbound" section before db22283f lands (schema-ready, never omitted).
const FOLLOWUP_BUCKETS = [["client","Client"],["platform","Platform"],["jobsearch","Job search"],["inbound","Inbound"]];
function followupTouchLabel(iso){ return iso ? iso.slice(0,10) : "never"; }
function followupRowHtml(row){
  const why = row.why ? '<div class="src">'+esc(row.why)+'</div>' : "";
  const disabled = row.status==="done" || row.status==="abandoned";
  const draftBtn = row.dir ? '<button class="fu-draft" data-bucket="'+esc(row.bucket)+'" data-lead="'+esc(row.lead)+'" data-dir="'+esc(row.dir)+'"'+(disabled?" disabled":"")+'>Draft follow-up</button>' : "";
  return '<div class="notepick">'+
      '<div class="ntext"><div class="nmeta">last touch '+followupTouchLabel(row.lastTouch)+' · '+esc(row.nextAction)+'</div>'+
      '<b>'+esc(row.who)+'</b>'+why+'</div>'+
      '<div class="actions">'+
        '<button class="fu-contacted" data-bucket="'+esc(row.bucket)+'" data-lead="'+esc(row.lead)+'"'+(disabled?" disabled":"")+'>Mark sent</button>'+
        '<button class="fu-responded" data-bucket="'+esc(row.bucket)+'" data-lead="'+esc(row.lead)+'"'+(disabled?" disabled":"")+'>Mark responded</button>'+
        draftBtn+
        '<button class="fu-moveon" data-bucket="'+esc(row.bucket)+'" data-lead="'+esc(row.lead)+'"'+(disabled?" disabled":"")+'>Move on</button>'+
      '</div>'+
    '</div>';
}
async function loadFollowups(){
  const box = $("#followupsList");
  box.innerHTML = '<div class="empty">Loading…</div>';
  const r = await fetch("/api/followups");
  const d = await r.json();
  if(!d.ok){ box.innerHTML = '<div class="empty">'+esc(d.error||"failed to load")+'</div>'; return; }
  $("#followupsNote").innerHTML = d.jobsearchNote ? '<div class="hint">Job search bucket: '+esc(d.jobsearchNote)+'</div>' : "";
  box.innerHTML = "";
  for(const [bucket,label] of FOLLOWUP_BUCKETS){
    const rows = (d.buckets && d.buckets[bucket]) || [];
    const sec = document.createElement("div"); sec.className = "notes-panel";
    const inner = rows.length ? rows.map(followupRowHtml).join("") : '<div class="empty">Nothing here yet.</div>';
    sec.innerHTML = '<div class="notes-head"><h3>'+esc(label)+' ('+rows.length+')</h3></div><div class="notelist">'+inner+'</div>';
    box.appendChild(sec);
  }
  box.querySelectorAll("button.fu-contacted").forEach(b=>b.addEventListener("click", ()=>followupAction("mark-contacted", b.dataset.bucket, b.dataset.lead)));
  box.querySelectorAll("button.fu-responded").forEach(b=>b.addEventListener("click", ()=>followupAction("mark-responded", b.dataset.bucket, b.dataset.lead)));
  box.querySelectorAll("button.fu-moveon").forEach(b=>b.addEventListener("click", ()=>followupAction("move-on", b.dataset.bucket, b.dataset.lead)));
  box.querySelectorAll("button.fu-draft").forEach(b=>b.addEventListener("click", ()=>followupDraft(b.dataset.dir)));
}
async function followupAction(action, bucket, lead){
  const r = await post("/api/followups/"+action, {bucket, lead});
  if(r.ok){ flash(action==="mark-responded" ? "Marked responded" : action==="mark-contacted" ? "Marked sent" : "Moved on"); loadFollowups(); }
  else flash(r.error || "Failed");
}
async function followupDraft(dir){
  flash("Drafting follow-up… (your subscription, ~30-60s)");
  const r = await post("/api/followups/draft-follow-up", {dir});
  if(r.ok){ flash("Follow-up drafted — review it on the Outreach tab"); loadFollowups(); }
  else flash(r.error || "Failed to draft");
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
  box.innerHTML = '<h3>Queue</h3>';
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
    e.preventDefault(); setTab("review");
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
    if(before !== JSON.stringify(JOBS.map(j=>[j.id,j.status]))) load(); // a job moved → refresh review rows
  }catch(e){}
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
function noteMeta(n){
  const d = n.publishedAt ? n.publishedAt.slice(0,10) : "????-??-??";
  const tag = n.drafted ? ' <span class="drafted-tag">already drafted</span>' : "";
  return d+' · eng '+n.eng+' (♥'+n.likes+' ↻'+n.reposts+' 💬'+n.replies+')'+tag;
}
function renderNotes(){
  const box = $("#notesList");
  const visible = NOTES.filter(n => notesShowDrafted || !n.drafted);
  if(!visible.length){ box.innerHTML = '<div class="empty">'+(NOTES.length? "All notes are already drafted." : "No notes found.")+'</div>'; return; }
  box.innerHTML = "";
  for(const n of visible){
    const el = document.createElement("label");
    el.className = "notepick" + (n.drafted ? " drafted" : "");
    el.innerHTML = '<input type="checkbox" data-idx="'+n.idx+'" '+(n.drafted?"disabled":"")+'>'+
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
  renderNotes();
}
async function draftSelectedNotes(){
  const indices = [...document.querySelectorAll('#notesList input[type=checkbox]:checked')].map(cb=>Number(cb.dataset.idx));
  if(!indices.length){ flash("Pick at least one note"); return; }
  $("#notesDraftBtn").disabled = true;
  const r = await post("/api/notes/pick",{indices});
  $("#notesDraftBtn").disabled = false;
  if(r.ok){
    flash(r.jobs.length+" note(s) queued");
    $("#notesPanel").hidden = true;
    loadJobs();
  } else flash(r.error || "Failed");
}
$("#addBtn").addEventListener("click", addSource);
$("#notesBtn").addEventListener("click", openNotes);
$("#notesCloseBtn").addEventListener("click", ()=>{ $("#notesPanel").hidden = true; });
$("#notesShowDrafted").addEventListener("change",(e)=>{ notesShowDrafted = e.target.checked; renderNotes(); });
$("#notesDraftBtn").addEventListener("click", draftSelectedNotes);
$("#src").addEventListener("keydown",(e)=>{ if((e.metaKey||e.ctrlKey)&&e.key==="Enter") addSource(); });
setInterval(()=>{ if(JOBS.some(j=>j.status==="queued"||j.status==="running")) loadJobs(); }, 3000);

$("#showDecided").addEventListener("change", (e)=>{ showDecided = e.target.checked; render(); });
setTab("ingest");
// Match doRefresh()'s ordering: stamp "last refreshed" once the initial data has actually
// landed, not the instant the page starts loading it (load()/loadJobs() are async).
Promise.all([load(), loadJobs()]).finally(markRefreshed);
</script>
</body>
</html>`;
}
