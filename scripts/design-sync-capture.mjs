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

function startServer() {
  const child = spawn("node", ["--import", "tsx", "src/review/serve.ts"], {
    cwd: repoRoot,
    env: { ...process.env, REVIEW_PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stderr.on("data", (b) => process.stderr.write(`[serve] ${b}`));
  return child;
}

async function waitForServer(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`review server did not come up on ${BASE} within ${timeoutMs}ms`);
}

const server = startServer();
let browser;
try {
  await waitForServer();
  rmSync(BUILD, { recursive: true, force: true });
  mkdirSync(CARDS, { recursive: true });
  mkdirSync(join(BUILD, "tokens"), { recursive: true });

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
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
    await page.waitForTimeout(2000);
    const markup = await page.evaluate((id) => {
      const el = document.getElementById(id);
      return el ? el.outerHTML : null;
    }, r.section);
    if (!markup) throw new Error(`room "${r.room}": #${r.section} not found — did the room ids change?`);

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

  // A captured card that renders blank is worse than none: it looks authoritative and says nothing.
  for (const r of ROOMS) {
    await page.goto(`file://${join(CARDS, r.file)}`);
    await page.waitForTimeout(300);
    const ok = await page.evaluate(() => {
      const s = document.querySelector("section.view");
      return !!s && s.getBoundingClientRect().height > 100 && document.body.innerText.trim().length > 200;
    });
    if (!ok) throw new Error(`card ${r.file} renders empty — fix the capture before uploading it`);
  }
  console.log(`\nall ${ROOMS.length} cards render non-empty. console errors during capture: ${consoleErrors.length}`);
  if (consoleErrors.length) console.log(consoleErrors.join("\n"));

  writeFileSync(join(BUILD, "MANIFEST.txt"), written.join("\n") + "\n");
  const projectId = JSON.parse(readFileSync(join(repoRoot, ".design-sync", "config.json"), "utf8")).projectId;
  console.log(`\nbundle: ${BUILD}`);
  console.log(`upload with DesignSync (project ${projectId}): finalize_plan localDir=${BUILD}, writes =`);
  for (const p of written) console.log(`  ${p}`);
  console.log(`\nPROSE NOT CAPTURED — update by hand if the story changed: README.md, guidelines/*.md, tokens/tokens.css`);
} finally {
  if (browser) await browser.close();
  server.kill();
}
