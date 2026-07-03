// Unified review + approval GUI.
//
// One local page that aggregates every content/<slug>/review-queue.md, previews the actual
// derivative inline (post text, quote-card image, video storyboard), and lets Muxin
// approve / revise / discard / edit in place — instead of hand-editing 20+ markdown tables.
//
// It READS through the same readQueue() the publish step uses and WRITES status back into the
// exact same table cell setStatus() targets, so an "approve" here is byte-identical to an
// "approve" typed by hand — /publish sees no difference. Nothing here publishes anything; it
// only sets the review-queue status that /publish later gates on (CLAUDE.md rule 2).
//
//   npm run review            # http://localhost:4600
//   REVIEW_PORT=5000 npm run review
//
// Zero new deps: Node's built-in http + the existing queue parser.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";
import { repoRoot } from "../db/db.js";
import { readQueue, type QueueRow } from "../publish/queue.js";
import { publishText } from "../publish/typefully.js";

const CONTENT = join(repoRoot, "content");
const PORT = Number(process.env.REVIEW_PORT ?? 4600);

// A row is "decided" once it's out of the review inbox. Everything else needs Muxin's eyes.
const DECIDED = new Set(["published", "discard"]);
// Platforms whose approval auto-schedules a Typefully draft (Muxin's "Approve → auto-schedule").
const SCHEDULABLE = new Set(["x", "linkedin", "bluesky"]);
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const VIDEO_EXT = new Set([".mp4", ".webm", ".mov"]);

// "Revise with Claude": shell out to headless Claude Code (`claude -p`), which uses Muxin's
// subscription ($0 marginal), to edit ONE derivative in place per a natural-language instruction.
const execFileP = promisify(execFile);
const REVISE_TIMEOUT_MS = 180_000;

type Kind = "text" | "image" | "video" | "storyboard" | "unknown";

interface EnrichedRow extends QueueRow {
  kind: Kind;
  body?: string; // derivative text / storyboard text (what a human reads)
  spin?: boolean;
  angle?: string;
  sourceLines?: unknown;
  assetUrl?: string; // image/video preview URL
  editable: boolean; // can the body be edited-and-saved here?
  revisable: boolean; // has a derivatives/<id>.md that "Revise with Claude" can rewrite
  hasAsset: boolean;
}

interface Piece {
  slug: string;
  title: string;
  rows: EnrichedRow[];
  pending: number;
}

// Split frontmatter but KEEP the raw header text so a body edit can be written back without
// re-serializing (and thus reordering / reformatting) the YAML the pipeline wrote.
function splitRaw(text: string): { header: string; body: string; fm: Record<string, unknown> } {
  const m = text.match(/^(---\n[\s\S]*?\n---\n?)([\s\S]*)$/);
  if (!m) return { header: "", body: text.trim(), fm: {} };
  let fm: Record<string, unknown> = {};
  try {
    fm = (parseYaml(m[1].replace(/^---\n/, "").replace(/\n---\n?$/, "")) as Record<string, unknown>) ?? {};
  } catch {
    fm = {};
  }
  return { header: m[1], body: m[2].trim(), fm };
}

// Resolve a slug to its content folder, refusing anything that isn't a real review-queue folder
// (defends the write/asset endpoints against path traversal on a slug from the client).
function safeFolder(slug: string): string {
  if (!slug || slug.includes("/") || slug.includes("..")) throw new Error("bad slug");
  const folder = join(CONTENT, slug);
  if (!existsSync(join(folder, "review-queue.md"))) throw new Error("no such queue");
  return folder;
}

function firstHeading(folder: string): string {
  try {
    const m = readFileSync(join(folder, "review-queue.md"), "utf8").match(/^#\s+(.+)$/m);
    if (m) return m[1].replace(/^Review queue\s*[—-]\s*/i, "").trim();
  } catch {
    /* fall through to slug */
  }
  return basename(folder).replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/-/g, " ");
}

function enrich(folder: string, slug: string, row: QueueRow): EnrichedRow {
  const asset = row.asset && row.asset !== "—" && row.asset !== "-" ? row.asset : "";
  let kind: Kind = "unknown";
  if (row.format === "text") kind = "text";
  else if (row.format === "image") kind = "image";
  else if (row.format === "video") kind = "video";
  else if (row.format === "storyboard") kind = "storyboard";

  const out: EnrichedRow = {
    ...row,
    kind,
    editable: false,
    revisable: existsSync(join(folder, "derivatives", `${row.id}.md`)),
    hasAsset: false,
  };
  const assetUrl = (file: string) => `/asset?slug=${encodeURIComponent(slug)}&file=${encodeURIComponent(file)}`;

  const loadMd = (relPath: string) => {
    const p = join(folder, relPath);
    if (!existsSync(p)) return false;
    const { body, fm } = splitRaw(readFileSync(p, "utf8"));
    out.body = body;
    out.spin = fm.spin === true;
    out.angle = typeof fm.angle === "string" ? fm.angle : undefined;
    out.sourceLines = fm.source_lines;
    return true;
  };

  if ((kind === "text" || kind === "video") && asset.endsWith(".md")) {
    if (loadMd(asset)) {
      out.hasAsset = true;
      out.editable = kind === "text"; // text derivatives are safe to edit-in-place
    }
  } else if (kind === "image" && asset) {
    const p = join(folder, asset);
    if (existsSync(p) && IMAGE_EXT.has(extname(asset).toLowerCase())) {
      out.assetUrl = assetUrl(asset);
      out.hasAsset = true;
    }
    // The quote text that backs the card usually lives in a companion derivative.
    loadMd(join("derivatives", `${row.id}.md`));
  } else if (kind === "storyboard") {
    loadMd(join("video", "storyboard.md")) && (out.hasAsset = true);
  }

  // A video derivative can also have a rendered file to preview.
  if (kind === "video" && asset && VIDEO_EXT.has(extname(asset).toLowerCase())) {
    if (existsSync(join(folder, asset))) {
      out.assetUrl = assetUrl(asset);
      out.hasAsset = true;
    }
  }
  return out;
}

function listPieces(): Piece[] {
  let dirs: string[] = [];
  try {
    dirs = readdirSync(CONTENT, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(CONTENT, d.name, "review-queue.md")))
      .map((d) => d.name);
  } catch {
    dirs = [];
  }
  const pieces = dirs.map((slug) => {
    const folder = join(CONTENT, slug);
    const { rows } = readQueue(folder);
    const enriched = rows.map((r) => enrich(folder, slug, r));
    return {
      slug,
      title: firstHeading(folder),
      rows: enriched,
      pending: enriched.filter((r) => !DECIDED.has(r.status)).length,
    };
  });
  pieces.sort((a, b) => b.slug.localeCompare(a.slug)); // newest (date-prefixed) first
  return pieces;
}

// Rewrite one row's status and/or notes in review-queue.md, matched by id (not a stale line
// index), preserving every other cell. Mirrors setStatus()'s cells[8] target so /publish reads
// it identically; also updates the notes cell (cells[9]) which setStatus() doesn't touch.
function updateRow(slug: string, id: string, status?: string, notes?: string): boolean {
  const folder = safeFolder(slug);
  const path = join(folder, "review-queue.md");
  const lines = readFileSync(path, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("|") || /^\|\s*-+/.test(line) || /^\|\s*id\s*\|/i.test(line)) continue;
    const cells = line.split("|");
    if (cells.length < 11) continue; // leading "" + 9 data cells + trailing ""
    if (cells[1].trim() !== id) continue;
    if (status !== undefined) cells[8] = ` ${status} `;
    if (notes !== undefined) cells[9] = ` ${notes.replace(/[|\n\r]/g, " ").trim()} `;
    lines[i] = cells.join("|");
    writeFileSync(path, lines.join("\n"));
    return true;
  }
  return false;
}

// Save an edited derivative body, keeping its frontmatter block byte-for-byte.
function saveDerivative(slug: string, id: string, body: string): void {
  const folder = safeFolder(slug);
  if (!/^[\w.-]+$/.test(id)) throw new Error("bad id");
  const p = join(folder, "derivatives", `${id}.md`);
  if (!existsSync(p)) throw new Error("no such derivative");
  const { header } = splitRaw(readFileSync(p, "utf8"));
  writeFileSync(p, header + body.trim() + "\n");
}

// Build the instruction for a single-file, extraction-first revision. Kept explicit + exported so
// the guardrails (edit only this file, keep frontmatter, stay traceable, voice.yaml) can't drift.
export function revisePrompt(slug: string, id: string, platform: string, instruction: string): string {
  const isCardCaption = /^quote-card-\d+-[a-z]+$/i.test(id);
  return [
    `Revise ONE content derivative in place for Muxin Li's content pipeline. Do not run shell commands; just edit the one file, then stop.`,
    ``,
    `File to edit: content/${slug}/derivatives/${id}.md   (platform: ${platform || "?"})`,
    `Muxin's request: "${instruction}"`,
    ``,
    `Rules:`,
    `- Edit ONLY that one file. Touch nothing else.`,
    `- Keep the YAML frontmatter block intact (platform, spin, angle, source_lines, cta, ...). Change only the body (the post text) unless the request is explicitly about frontmatter.`,
    `- Extraction-first: the body must stay traceable to Muxin's source at content/${slug}/source.md. If the derivative has spin: true you may re-angle within its config/platforms.yaml spin_angles guardrails, but NEVER invent a claim, statistic, metaphor, or worldview Muxin did not express.`,
    `- Follow config/voice.yaml: no em dashes, no AI tells, Muxin's plain PM voice.`,
    `- Respect the platform's max_chars in config/platforms.yaml.`,
    isCardCaption
      ? `- This is a quote-card CAPTION: it gives CONTEXT around the quote shown on the image. Do not restate the quote; keep it context-only.`
      : ``,
    `- Be surgical: apply the request, do not rewrite what was not asked.`,
  ]
    .filter(Boolean)
    .join("\n");
}

// Run the revision through headless Claude Code (subscription, no per-token API cost), then return
// the edited body. Failures (missing CLI, timeout, non-zero exit, no-op) surface as thrown messages
// the GUI shows instead of crashing.
async function reviseDerivative(slug: string, id: string, instruction: string): Promise<string> {
  const folder = safeFolder(slug);
  if (!/^[\w.-]+$/.test(id)) throw new Error("bad id");
  if (!instruction.trim()) throw new Error("tell Claude what to change first");
  const p = join(folder, "derivatives", `${id}.md`);
  if (!existsSync(p)) throw new Error("no such derivative to revise");

  const original = splitRaw(readFileSync(p, "utf8"));
  const platform = typeof original.fm.platform === "string" ? original.fm.platform : "";
  const prompt = revisePrompt(slug, id, platform, instruction.trim());

  try {
    await execFileP("claude", ["-p", prompt, "--permission-mode", "acceptEdits"], {
      cwd: repoRoot,
      timeout: REVISE_TIMEOUT_MS,
      maxBuffer: 20_000_000,
    });
  } catch (e) {
    const err = e as { code?: string; killed?: boolean; stderr?: string; message?: string };
    if (err.code === "ENOENT") {
      throw new Error("the `claude` CLI isn't on this server's PATH — start the GUI from a terminal where `claude` runs");
    }
    if (err.killed) throw new Error(`Claude timed out after ${REVISE_TIMEOUT_MS / 1000}s`);
    throw new Error(`Claude revise failed: ${(err.stderr || err.message || "unknown").slice(0, 300)}`);
  }

  const after = splitRaw(readFileSync(p, "utf8")).body;
  if (after === original.body) {
    throw new Error("Claude ran but didn't change anything — try a more specific instruction");
  }
  return after;
}

function serveAsset(res: ServerResponse, slug: string, file: string): void {
  let folder: string;
  try {
    folder = safeFolder(slug);
  } catch {
    res.writeHead(404).end("not found");
    return;
  }
  if (file.includes("..") || file.startsWith("/")) {
    res.writeHead(400).end("bad path");
    return;
  }
  const ext = extname(file).toLowerCase();
  if (!IMAGE_EXT.has(ext) && !VIDEO_EXT.has(ext)) {
    res.writeHead(400).end("unsupported");
    return;
  }
  const p = join(folder, file);
  if (!p.startsWith(folder) || !existsSync(p)) {
    res.writeHead(404).end("not found");
    return;
  }
  const types: Record<string, string> = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".gif": "image/gif", ".mp4": "video/mp4",
    ".webm": "video/webm", ".mov": "video/quicktime",
  };
  res.writeHead(200, { "content-type": types[ext] ?? "application/octet-stream", "cache-control": "no-store" });
  res.end(readFileSync(p));
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 5_000_000) reject(new Error("body too large"));
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function json(res: ServerResponse, code: number, obj: unknown): void {
  const s = JSON.stringify(obj);
  res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(s);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  try {
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(PAGE);
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/queue") {
      const pieces = listPieces();
      json(res, 200, { pieces, pending: pieces.reduce((n, p) => n + p.pending, 0) });
      return;
    }
    if (req.method === "GET" && url.pathname === "/asset") {
      serveAsset(res, url.searchParams.get("slug") ?? "", url.searchParams.get("file") ?? "");
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/status") {
      const b = await readBody(req);
      const slug = String(b.slug ?? "");
      const id = String(b.id ?? "");
      const status = b.status === undefined ? undefined : String(b.status);
      const notes = b.notes === undefined ? undefined : String(b.notes);
      const ok = updateRow(slug, id, status, notes);
      if (!ok) {
        json(res, 404, { ok: false });
        return;
      }
      // Approve → auto-schedule (Muxin's choice): a text row goes straight to a Typefully SCHEDULED
      // draft at its cadence slot, and publishText flips the row to "published". Non-text rows just
      // get marked approve (cards/tiktok/video still schedule via /publish). A scheduling failure is
      // returned (not thrown) so the row stays "approve" and the GUI can show why.
      let scheduled: unknown = null;
      let scheduleError: string | null = null;
      if (status === "approve") {
        const folder = safeFolder(slug);
        const row = readQueue(folder).rows.find((r) => r.id === id);
        if (row && SCHEDULABLE.has(row.platform)) {
          try {
            const done = await publishText(folder, { onlyIds: [id] });
            scheduled = done[0] ?? null;
          } catch (e) {
            scheduleError = e instanceof Error ? e.message : String(e);
          }
        }
      }
      json(res, 200, { ok: true, scheduled, scheduleError });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/derivative") {
      const b = await readBody(req);
      saveDerivative(String(b.slug ?? ""), String(b.id ?? ""), String(b.body ?? ""));
      json(res, 200, { ok: true });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/revise") {
      const b = await readBody(req);
      try {
        const body = await reviseDerivative(String(b.slug ?? ""), String(b.id ?? ""), String(b.instruction ?? ""));
        json(res, 200, { ok: true, body });
      } catch (e) {
        json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    res.writeHead(404).end("not found");
  } catch (e) {
    json(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});

// Start the server only when run directly (npm run review), so tests can import revisePrompt et al.
// without binding the port.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  server.listen(PORT, () => {
    console.log(`\n  Review queue → http://localhost:${PORT}\n`);
    console.log("  Approve / revise / discard / edit every pending derivative in one place.");
    console.log("  Only 'approve' rows are acted on by /publish. Ctrl-C to stop.\n");
  });
}

// ── the page (self-contained, no build step, no external requests) ──────────────────────────
const PAGE = /* html */ `<!doctype html>
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
  .fmt { font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.4px; }
  .pill { font-size:11px; font-weight:700; padding:2px 9px; border-radius:20px; margin-left:auto; }
  .pill.approve{background:var(--green-bg);color:var(--green)}
  .pill.revise{background:var(--amber-bg);color:var(--amber)}
  .pill.discard{background:#eee;color:var(--muted)}
  .pill.published{background:var(--blue-bg);color:var(--blue)}
  .pill.blocked{background:var(--red-bg);color:var(--red)}
  .pill.needs{background:#efe9db;color:#8a6d1e}
  .spin { font-size:11px; background:#efeafd; color:#5b46b8; padding:2px 8px; border-radius:5px; font-weight:600; }
  .src { font-size:11px; color:var(--muted); }
  .body { white-space:pre-wrap; font-size:14.5px; line-height:1.6; margin:4px 0 6px;
    padding:11px 13px; background:var(--paper); border:1px solid var(--line); border-radius:8px; }
  .body.story { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12.5px; color:#4a453c; max-height:260px; overflow:auto; }
  textarea { width:100%; min-height:120px; font:14.5px/1.6 inherit; padding:11px 13px;
    border:1px solid var(--muted); border-radius:8px; background:#fff; resize:vertical; }
  img.preview { max-width:340px; width:100%; border-radius:8px; border:1px solid var(--line); display:block; }
  video.preview { max-width:340px; width:100%; border-radius:8px; border:1px solid var(--line); display:block; }
  .notes { font-size:12.5px; color:var(--amber); margin:4px 0 0; }
  .scheduled { font-size:12.5px; color:var(--green); font-weight:600; margin:4px 0 0; }
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
  .aibox { margin-top:9px; display:none; gap:7px; }
  .aibox.show { display:flex; }
  .aibox input { flex:1; font:inherit; padding:7px 10px; border:1px solid #5b46b8; border-radius:7px; }
  .aibox button.send { border-color:#5b46b8; background:#5b46b8; color:#fff; }
  .thinking { font-size:13px; color:#5b46b8; font-weight:600; padding:4px 0; }
  .flash { position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:var(--accent);
    color:var(--paper); padding:9px 16px; border-radius:8px; font-size:13px; opacity:0;
    transition:.2s; pointer-events:none; }
  .flash.show { opacity:1; }
</style>
</head>
<body>
<header>
  <h1>Review queue</h1>
  <span class="count" id="count">0</span>
  <span class="grow"></span>
  <label class="toggle"><input type="checkbox" id="showDecided" /> show published / discarded</label>
  <button id="refresh">Refresh</button>
</header>
<main id="main"><div class="empty">Loading…</div></main>
<div class="flash" id="flash"></div>
<script>
const $ = (s, r=document) => r.querySelector(s);
let DATA = { pieces: [], pending: 0 };
let showDecided = false;
const DECIDED = new Set(["published","discard"]);

function flash(msg){ const f=$("#flash"); f.textContent=msg; f.classList.add("show"); setTimeout(()=>f.classList.remove("show"),1400); }
function esc(s){ return (s??"").replace(/[&<>]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }

async function load(){
  const r = await fetch("/api/queue"); DATA = await r.json();
  render();
}
async function post(path, body){
  const r = await fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  return r.json();
}

function statusLabel(s){ return s ? s : "needs"; }
function pillClass(s){ return s && ["approve","revise","discard","published","blocked"].includes(s) ? s : "needs"; }

function rowEl(piece, row){
  const el = document.createElement("div");
  const decided = DECIDED.has(row.status);
  el.className = "row" + (decided ? " decided" : "");
  el.dataset.id = row.id;

  const spin = row.spin ? '<span class="spin">spin · '+esc(row.angle||"")+'</span>' : "";
  const src = row.sourceLines ? '<span class="src">lines '+esc(JSON.stringify(row.sourceLines))+'</span>' : "";
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
  const manual = row.manualComment ? '<div class="notes">↳ add as first comment in Typefully: '+esc(row.manualComment)+'</div>' : "";
  const editBtn = row.editable ? '<button data-act="edit">Edit</button>' : "";
  const aiBtn = row.revisable ? '<button class="ai" data-act="ai">✨ Ask Claude</button>' : "";
  const schedulable = ["x","linkedin","bluesky"].includes(row.platform);
  const approveLabel = schedulable ? "Approve → schedule" : "Approve";

  el.innerHTML =
    '<div class="rowhead">'+
      '<span class="badge '+esc(row.platform.split(":")[0])+'">'+esc(row.platform)+'</span>'+
      '<span class="fmt">'+esc(row.format)+' · '+esc(row.id)+'</span>'+ spin + src +
      '<span class="pill '+pillClass(row.status)+'">'+esc(statusLabel(row.status))+'</span>'+
    '</div>'+
    preview + notes + sched + manual +
    '<div class="actions">'+
      '<button class="approve'+(row.status==="approve"?" on":"")+'" data-act="approve">'+approveLabel+'</button>'+
      '<button class="revise'+(row.status==="revise"?" on":"")+'" data-act="revise">Revise</button>'+
      '<button class="discard'+(row.status==="discard"?" on":"")+'" data-act="discard">Discard</button>'+
      '<span class="spacer"></span>'+ editBtn + aiBtn +
    '</div>'+
    '<div class="revisebox"><input placeholder="what needs changing?" value="'+esc(row.notes||"")+'" /><button data-act="save-note">Save note</button></div>'+
    '<div class="aibox"><input placeholder="tell Claude what to change…" /><button class="send" data-act="ai-send">Send to Claude</button></div>';

  el.addEventListener("click", (e)=>onAction(e, piece, row, el));
  return el;
}

async function onAction(e, piece, row, el){
  const act = e.target.dataset.act; if(!act) return;
  if (act === "approve" || act === "discard"){
    e.target.disabled = true;
    const r = await post("/api/status",{slug:piece.slug,id:row.id,status:act});
    if (act === "approve"){
      if (r.scheduled){ row.status="published"; row.scheduledWhen=r.scheduled.when; row.manualComment=r.scheduled.manualComment||""; flash("Scheduled · "+r.scheduled.when); }
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
    const inp = el.querySelector(".aibox input"); if(inp && box.classList.contains("show")) inp.focus();
  } else if (act === "ai-send"){
    const inp = el.querySelector(".aibox input"); const instruction = inp ? inp.value.trim() : "";
    if(!instruction){ flash("Type what you want changed first"); return; }
    el.querySelector(".aibox").innerHTML = '<div class="thinking">✨ Claude is revising… (your subscription, ~10-30s)</div>';
    const r = await post("/api/revise",{slug:piece.slug,id:row.id,instruction});
    if(r.ok){ row.body = r.body; flash("Revised by Claude"); }
    else { flash("Revise failed: "+(r.error||"error")); }
    rerender();
  }
}

let rerenderScheduled=false;
function rerender(){ if(rerenderScheduled) return; rerenderScheduled=true; requestAnimationFrame(()=>{rerenderScheduled=false; render();}); }

function render(){
  const main = $("#main"); main.innerHTML = "";
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

$("#refresh").addEventListener("click", load);
$("#showDecided").addEventListener("change", (e)=>{ showDecided = e.target.checked; render(); });
load();
</script>
</body>
</html>`;
