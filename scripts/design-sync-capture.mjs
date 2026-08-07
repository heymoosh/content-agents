// Capture the Content studio's real UI into a bundle the Claude Design workspace can ingest.
//
//   npm run design:capture
//
// Why this exists: the design workspace (.design-sync/config.json) is hand-authored, so its
// "current state" cards drift the moment the app ships anything. In July 2026 it still described a
// seven-tab light-paper app months after the five-room walnut desk shipped, which is why design
// proposals coming back kept not matching. This script removes the hand-transcription step: it
// starts the real server, drives a real browser through every room, and writes each room's actual
// markup plus the app's actual stylesheet into card files.
//
// It writes to .design-sync/build/ (gitignored) and prints the file list. Claude then uploads that
// bundle with the DesignSync tool: finalize_plan (localDir = the build dir) then write_files.
//
// Deliberately NOT included: guidelines/*.md and README.md. Those are prose about intent, they
// need judgment, and brief.md is Muxin's own words. Update them by hand when the story changes.

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
// playwright is a repo dependency; resolve it against the repo rather than the caller's cwd.
const { chromium } = createRequire(join(repoRoot, "package.json"))("playwright");

const PORT = Number(process.env.DESIGN_CAPTURE_PORT ?? 4711);
const BASE = `http://127.0.0.1:${PORT}/`;
const BUILD = join(repoRoot, ".design-sync", "build");
const CARDS = join(BUILD, "components", "current-state");
const GROUP = `Current state — the shipped desk (${new Date().toISOString().slice(0, 10)})`;

// One entry per room. `note` is the banner that rides on the card: say what the surface is FOR and
// what is deliberate about it, so a designer reading the card knows what not to throw away.
const ROOMS = [
  {
    room: "studio", section: "roomStudio", file: "StudioHome.html",
    name: "Studio room — everything happening, at a glance",
    note: `The overview that never starts work: four counts, a "Needs you today" list ranked by
      urgency (mono room label, a sentence written to Muxin, gray tail, one verb), and a
      "Your team, working" rail naming the crew with honest state and never a fake ETA. "The queue"
      sheet below lists background jobs.`,
  },
  {
    room: "content", section: "roomContent", file: "ContentWorkbench.html",
    name: "Content room — capture, the director's read, proposed cuts",
    note: `Folded together the old Add/Queue, Develop, Cuts and Review tabs. Capture sheet on top,
      then a session sheet per piece: the source in serif, the director's proposed cuts (lens name in
      purple, plain-language read, Muxin's own lines quoted verbatim under a mono rail), a
      "what your director checked" rail, and "Drafts for your yes" — the review queue — last.`,
  },
  {
    room: "outreach", section: "roomOutreach", file: "OutreachDossier.html",
    name: "Outreach room — lead chips, dossier, contacts, evidence rail",
    note: `Leads / Follow-ups as one room, two panes. The dossier leads with "Why this matters to
      you, in plain terms" as large serif prose written TO Muxin, then why-them / why-you, then the
      people at that company (each gets their own drafted message and follow-up clock), with cited
      evidence on the right rail. There is deliberately no send path in the software.`,
  },
  {
    room: "fiction", section: "roomFiction", file: "FictionDesk.html",
    name: "Fiction room — canon editable in place",
    note: `Holds only the canon (story bible, plot line, append-only ledger, one sheet per
      character). Chapter drafting and line-by-line review deliberately stay in the GitHub flow, so
      this desk is the layer underneath them. "Edit in place" saves straight to what drafts build from.`,
  },
  {
    room: "signals", section: "roomSignals", file: "SignalsRoom.html",
    name: "Signals room — where you fit, what to change, go deeper",
    note: `Replaced the Analytics tab. "Where you fit, so far" carries the under-4-weeks INSUFFICIENT
      guard; "Worth changing, your call" lifts each recommendation from the latest brief with a
      Send-to-backlog button that files a card and changes nothing by itself; "go deeper" holds the
      real runs. Every button label says what it costs and what it will not do.`,
  },
];

const NOTE_CSS = `
  .dscard-note { max-width:1120px; margin:0 auto 4px; padding:12px 16px; background:rgba(250,248,243,.93);
    border-left:3px solid #cbaf87; border-radius:0 8px 8px 0; color:#4a4238;
    font:13px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
  .dscard-note b { color:#1c1a17; }
`;

// Refuse to start if anything already answers on the port. A 200 there proves only that SOMETHING
// is listening, never that it is ours — and polling HTTP to decide readiness loses the race every
// time, because the pre-existing server answers instantly while our child needs a second to boot
// and die of EADDRINUSE. Checking up front makes the failure deterministic instead of timing-dependent.
async function assertPortFree() {
  try {
    await fetch(BASE, { signal: AbortSignal.timeout(2000) });
  } catch {
    return; // nothing there, which is what we want
  }
  throw new Error(
    `something is already serving ${BASE}. Refusing to capture, because the snapshots would come ` +
      `from that server rather than a fresh one. Stop it, or set DESIGN_CAPTURE_PORT to a free port.`,
  );
}

function startServer() {
  const child = spawn("node", ["--import", "tsx", "src/review/serve.ts"], {
    cwd: repoRoot,
    env: { ...process.env, REVIEW_PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (b) => { child.out = (child.out ?? "") + b.toString("utf8"); });
  child.stderr.on("data", (b) => process.stderr.write(`[serve] ${b}`));
  child.on("exit", (code, signal) => { child.diedEarly = { code, signal }; });
  child.on("error", (e) => { child.diedEarly = { error: e.message }; });
  return child;
}

// Readiness comes from OUR child announcing itself on its own stdout, not from a port responding.
async function waitForServer(child, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.diedEarly) {
      throw new Error(
        `the review server we spawned exited before it was ready (${JSON.stringify(child.diedEarly)}). ` +
          `Port ${PORT} is most likely already in use. Stop the other server, or set ` +
          `DESIGN_CAPTURE_PORT to a free port.`,
      );
    }
    if (child.out?.includes(`http://localhost:${PORT}`)) {
      const res = await fetch(BASE).catch(() => null);
      if (res?.ok) return;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`review server did not announce itself on ${BASE} within ${timeoutMs}ms`);
}

// Same-origin assets (quote-card PNGs, video previews) are referenced by relative URL, which
// resolves to nothing once a card is opened as a file:// page or uploaded to the design project.
// Inline images as data URIs so a card is genuinely self-contained; swap video for a labelled
// placeholder, since a playing video means nothing in a static design snapshot anyway.
async function inlineAssets(markup) {
  const urls = [...markup.matchAll(/<(img|video)\b[^>]*\bsrc="(\/[^"]*)"/g)];
  let out = markup;
  for (const [, tag, url] of urls) {
    if (tag === "video") {
      out = out.replace(
        new RegExp(`<video\\b[^>]*\\bsrc="${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>(</video>)?`),
        `<div class="preview" style="display:flex;align-items:center;justify-content:center;` +
          `height:180px;background:#efe9db;border:1px solid #e7e1d6;border-radius:8px;` +
          `font:12px ui-monospace,Menlo,monospace;color:#7a7266">video preview (not embedded)</div>`,
      );
      continue;
    }
    try {
      const res = await fetch(new URL(url, BASE));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const type = res.headers.get("content-type") ?? "image/png";
      const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
      out = out.split(`"${url}"`).join(`"data:${type};base64,${b64}"`);
    } catch (e) {
      throw new Error(`could not inline asset ${url} (${e.message}) — the card would ship a broken image`);
    }
  }
  return out;
}

await assertPortFree();
const server = startServer();
let browser;
// A bare SIGINT/SIGTERM bypasses `finally`, which would leave the spawned review server listening
// after the capture is gone. Kill the child on the way out, then re-raise so the exit code is honest.
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.once(sig, () => {
    server.kill();
    process.exit(sig === "SIGINT" ? 130 : 143);
  });
}
try {
  await waitForServer(server);
  rmSync(BUILD, { recursive: true, force: true });
  mkdirSync(CARDS, { recursive: true });
  mkdirSync(join(BUILD, "tokens"), { recursive: true });

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  const css = await page.evaluate(() => document.querySelector("style").textContent);
  const header = await page.evaluate(() => document.querySelector("header").outerHTML);
  writeFileSync(
    join(BUILD, "tokens", "app-shipped.css"),
    `/* The ENTIRE shipped stylesheet, captured verbatim from the running app on ` +
      `${new Date().toISOString().slice(0, 10)} (the inline <style> block emitted by\n` +
      `   src/review/page.ts). Nothing edited. Use this when you need the real rule for something\n` +
      `   rather than a summary. */\n${css}`,
  );

  const written = [];
  for (const r of ROOMS) {
    await page.click(`.room[data-room="${r.room}"]`);
    // Wait for the room's own loaders to resolve, NOT a fixed delay. A card snapshotted mid-load
    // captures "Loading…" placeholders, and the blank-check below would still pass it: the header,
    // the note banner and the empty sheet clear the height and text thresholds on their own.
    try {
      await page.waitForFunction(
        (id) => {
          const el = document.getElementById(id);
          return !!el && !/Loading…/.test(el.innerText);
        },
        r.section,
        { timeout: 30000 },
      );
    } catch {
      throw new Error(`room "${r.room}": still showing "Loading…" after 30s — its API never resolved`);
    }
    await page.waitForTimeout(500); // let the final paint settle

    const raw = await page.evaluate((id) => {
      const el = document.getElementById(id);
      return el ? el.outerHTML : null;
    }, r.section);
    if (!raw) throw new Error(`room "${r.room}": #${r.section} not found — did the room ids change?`);
    const markup = await inlineAssets(raw);

    // Rooms that were not the active tab keep `hidden`; unhide so the card renders standalone.
    const body = markup.replace(/^(<section[^>]*?)\s+hidden(="")?/, "$1");
    // Show the right room as active in the shared header chrome.
    const hdr = header
      .replace(' class="room on"', ' class="room"')
      .replace(`class="room" data-room="${r.room}"`, `class="room on" data-room="${r.room}"`);
    const note = r.note.replace(/\s+/g, " ").trim();

    const html = `<!-- @dsCard group="${GROUP}" name="${r.name}" -->
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${r.name}</title>
<style>
${css}
${NOTE_CSS}
</style>
</head>
<body>
${hdr}
<div class="dscard-note"><b>Real capture from the running app.</b> ${note}</div>
${body}
</body>
</html>
`;
    writeFileSync(join(CARDS, r.file), html);
    written.push(`components/current-state/${r.file}`);
    console.log(`captured ${r.room} → ${r.file} (${html.length} chars)`);
  }
  written.push("tokens/app-shipped.css");

  // A page error means the room we just snapshotted may be half-rendered. Fail rather than upload
  // an authoritative-looking card built from a broken run.
  if (pageErrors.length) {
    throw new Error(`the app threw during capture, so the snapshots are not trustworthy:\n${pageErrors.join("\n")}`);
  }

  // A captured card that renders blank is worse than none: it looks authoritative and says nothing.
  // Check the ROOM's own content, not the whole document, so the header and note banner cannot
  // carry an empty card past this gate. Also fail on any asset that still fails to load.
  for (const r of ROOMS) {
    const badAssets = [];
    const onFailed = (req) => badAssets.push(req.url());
    page.on("requestfailed", onFailed);
    await page.goto(`file://${join(CARDS, r.file)}`);
    await page.waitForTimeout(300);
    page.off("requestfailed", onFailed);

    const stat = await page.evaluate(() => {
      const s = document.querySelector("section.view");
      if (!s) return null;
      return { height: s.getBoundingClientRect().height, chars: s.innerText.trim().length };
    });
    if (!stat) throw new Error(`card ${r.file} has no room section at all`);
    if (stat.height < 100 || stat.chars < 200) {
      throw new Error(`card ${r.file} renders essentially empty (${stat.height}px, ${stat.chars} chars of room text)`);
    }
    if (badAssets.length) {
      throw new Error(`card ${r.file} references assets that do not load: ${badAssets.join(", ")}`);
    }
  }
  console.log(`\nall ${ROOMS.length} cards render non-empty with every asset resolving.`);
  console.log(`console errors during capture: ${consoleErrors.length}`);
  if (consoleErrors.length) console.log(consoleErrors.join("\n"));

  writeFileSync(join(BUILD, "MANIFEST.txt"), written.join("\n") + "\n");
  const projectId = JSON.parse(readFileSync(join(repoRoot, ".design-sync", "config.json"), "utf8")).projectId;
  console.log(`\nbundle: ${BUILD}`);
  console.log(`upload with DesignSync (project ${projectId}): finalize_plan localDir=${BUILD}, writes =`);
  for (const p of written) console.log(`  ${p}`);
  console.log(`\nPROSE NOT CAPTURED — update by hand if the story changed: README.md, guidelines/*.md, tokens/tokens.css`);
} finally {
  // Nested, so a browser.close() that itself rejects can never skip killing the server.
  try {
    if (browser) await browser.close();
  } finally {
    if (!server.diedEarly) {
      const exited = new Promise((r) => server.once("exit", r));
      server.kill();
      // Don't return while the port is still held: the next run would hit EADDRINUSE.
      await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))]);
    }
  }
}
