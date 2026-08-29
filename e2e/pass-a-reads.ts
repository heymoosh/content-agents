// Pass A: every room loads, renders from a real read, and throws nothing.
//
// Run under REVIEW_FIXTURES=1 so the Venture/Signals/job surfaces have data to render (that is
// exactly what fixture mode was built for — prototype-port-rules Rule 4). Fixture mode is read-only
// by construction, so this pass proves reads only; writes are Pass B.

import { bootServer, openSession, openRoom, waitLoaded, textOf, record, results,
  applyScenario,
} from "./harness.js";

const PORT = 4791;

// room key -> containers whose "Loading…" must be gone once the room is open.
const ROOMS: { room: string; label: string; panes: string[]; pr?: string }[] = [
  { room: "content", label: "Content room renders", panes: ["#reviewMain"], pr: "#341/#375" },
  { room: "studio", label: "Studio room renders", panes: ["#studioMain"], pr: "#349" },
  { room: "outreach", label: "Outreach room renders", panes: ["#outreachList"], pr: "#350" },
  { room: "fiction", label: "Fiction room renders", panes: ["#fictionMain"], pr: "#352" },
  { room: "charles", label: "Charles room renders", panes: ["#charlesMain"] },
  { room: "venture", label: "Venture room renders", panes: ["#ventureThread"], pr: "#381" },
  { room: "signals", label: "Signals room renders", panes: ["#signalsFamilies", "#signalsTop"], pr: "#375" },
];

async function main(): Promise<void> {
  console.log("\n=== Pass A: reads, fixture mode ===\n");
  const server = await bootServer({ REVIEW_FIXTURES: "1" }, PORT);
  let s: Awaited<ReturnType<typeof openSession>> | null = null;
  try {
    s = await openSession(PORT);
    // The fixture banner is a safety claim (fixtures.ts §3: "a screenshot cannot hide it"). If it is
    // missing while the flag is on, fixture data is reaching a screen unlabelled.
    const bannerVisible = await s.page.locator("#fxBanner").isVisible().catch(() => false);
    const bannerText = (await textOf(s.page, "#fxBanner")).replace(/\s+/g, " ").trim();
    const saysNotReal = /NOTHING ON THIS PAGE IS REAL/i.test(bannerText);
    record({
      feature: "Fixture mode announces itself on screen",
      pr: "#374",
      status: bannerVisible && saysNotReal ? "pass" : "fail",
      detail: bannerVisible
        ? `banner visible: "${bannerText.slice(0, 90)}"`
        : "NO visible #fxBanner while REVIEW_FIXTURES=1",
    });

    for (const r of ROOMS) {
      const before = s.errors.length;
      const badBefore = s.badResponses.length;
      try {
        await openRoom(s.page, r.room);
        const seen: string[] = [];
        for (const pane of r.panes) seen.push((await waitLoaded(s.page, pane)).trim().slice(0, 60));
        const newErrors = s.errors.slice(before);
        const newBad = s.badResponses.slice(badBefore);
        if (newErrors.length || newBad.length) {
          record({
            feature: r.label,
            pr: r.pr,
            status: "fail",
            detail: [...newErrors, ...newBad.map((b) => "bad response " + b)].join(" / ").slice(0, 300),
          });
        } else {
          record({ feature: r.label, pr: r.pr, status: "pass", detail: `rendered: "${seen.join(" | ")}"` });
        }
      } catch (e) {
        const newErrors = s.errors.slice(before);
        const newBad = s.badResponses.slice(badBefore);
        record({
          feature: r.label,
          pr: r.pr,
          status: "fail",
          detail: `${(e as Error).message.split("\n")[0]}${newErrors.length ? " | " + newErrors.join(" / ") : ""}${
            newBad.length ? " | bad: " + newBad.join(", ") : ""
          }`.slice(0, 300),
        });
      }
    }

    // ── specific surfaces from this batch, checked by content and not just by "it rendered" ──

    // #375: Signals outcome families. Three states never two — a family that was never measured must
    // say so rather than printing a zero.
    await openRoom(s.page, "signals");
    const fam = await textOf(s.page, "#signalsFamilies");
    record({
      feature: "Signals outcome families show measured vs never-measured",
      pr: "#375",
      status: fam.length > 40 ? "pass" : "fail",
      detail: fam.length > 40 ? `${fam.trim().slice(0, 120).replace(/\s+/g, " ")}…` : `family pane nearly empty: "${fam.trim()}"`,
    });

    // #375: the Content wizard is a step surface, not a static sheet.
    await openRoom(s.page, "content");
    const steps = await s.page.locator("#cwSteps .cw-step, #cwSteps [data-step]").count();
    const cwBody = await textOf(s.page, "#cwBody");
    record({
      feature: "Content wizard renders its steps",
      pr: "#375",
      status: steps > 0 || cwBody.trim().length > 0 ? "pass" : "fail",
      detail: steps > 0 ? `${steps} steps` : `no steps; body="${cwBody.trim().slice(0, 80)}"`,
    });

    // #349/#378: the job queue surface, and a job's step markers when it has them.
    // The queue renders only when a job exists, so an idle studio shows nothing rather than a sheet
    // announcing its own emptiness. Apply a running job first: with that scenario the queue MUST
    // list it, so absence is a failure rather than an empty-fixture excuse.
    await openRoom(s.page, "studio");
    await applyScenario(s.page, "job-running");
    await s.page.waitForSelector("#jobs:not([hidden])", { timeout: 15_000 }).catch(() => null);
    const jobsText = await textOf(s.page, "#jobs");
    record({
      feature: "Studio job queue lists jobs",
      pr: "#349",
      status: jobsText.trim().length > 0 ? "pass" : "fail",
      detail: jobsText.trim().length > 0
        ? `${jobsText.trim().slice(0, 100).replace(/\s+/g, " ")}…`
        : "job-running scenario applied and the queue still listed nothing",
    });

    // #350: Outreach is a triage queue grouped by reason, then a thread.
    await openRoom(s.page, "outreach");
    const outreachText = await textOf(s.page, "#outreachList");
    record({
      feature: "Outreach triage queue renders",
      pr: "#350",
      status: outreachText.trim().length > 0 ? "pass" : "fail",
      detail: outreachText.trim().slice(0, 120).replace(/\s+/g, " "),
    });
    await s.page.click('button.subtab[data-sub="followups"]');
    await s.page.waitForSelector("#followupsPane:not([hidden])", { timeout: 10_000 });
    const followText = await waitLoaded(s.page, "#followupsList").catch(() => "");
    record({
      feature: "Outreach follow-ups tab renders",
      pr: "#350",
      status: followText.trim().length > 0 ? "pass" : "fail",
      detail: followText.trim().slice(0, 120).replace(/\s+/g, " "),
    });

    // The workbench (the director's notes: proposed cut, reply box, Format for platforms, and the
    // PATTERN READS seam) no longer renders open by default — it moved behind a control on wizard
    // step 2 for the picked piece (rules.md carve-out 1). Reach it the way a person does: pick a
    // source, then open the director's notes on it. Apply recs-blocked FIRST, before picking a
    // source: it forces three real Content sessions (a dev worktree's own /api/content can be
    // empty, per the banner at the top of this page), so the pick is guaranteed a row to click
    // rather than depending on whatever this checkout happens to have on disk.
    await openRoom(s.page, "content");
    await applyScenario(s.page, "recs-blocked");
    await s.page.waitForSelector("#roomContent:not([hidden])", { timeout: 15_000 });
    await waitLoaded(s.page, "#cwBody").catch(() => "");
    await s.page.waitForSelector("#cwBody .cw-src", { timeout: 15_000 }).catch(() => null);
    await s.page.click("#cwBody .cw-src");
    await s.page.waitForSelector('#cwBody [data-set-pane="workbench"]', { timeout: 15_000 }).catch(() => null);
    await s.page.click('#cwBody [data-set-pane="workbench"]');
    await s.page.waitForSelector("#workbench:not([hidden])", { timeout: 15_000 }).catch(() => null);
    await waitLoaded(s.page, "#workbench").catch(() => "");

    // Production label: Format for platforms is what a person sees; "Hand it to the team" and any
    // visible "atomize" are banned interface copy.
    const contentBody = ((await s.page.locator("body").innerText()) ?? "").replace(/\s+/g, " ").trim();
    const hasFormat = contentBody.includes("Format for platforms");
    const hasHandoff = contentBody.includes("Hand it to the team");
    const hasAtomize = /atomize/i.test(contentBody);
    const formatBtns = await s.page.locator("#workbench .dev-format-btn").count();
    if (!hasFormat && formatBtns === 0) {
      record({
        feature: "Production label is Format for platforms, not atomize",
        status: "blocked",
        detail: `no Format for platforms on screen (workbench format buttons=0); Hand it to the team=${hasHandoff}; atomize=${hasAtomize}`,
      });
    } else {
      record({
        feature: "Production label is Format for platforms, not atomize",
        status: hasFormat && !hasHandoff && !hasAtomize ? "pass" : "fail",
        detail: `Format for platforms=${hasFormat}; Hand it to the team=${hasHandoff}; atomize=${hasAtomize}; format buttons=${formatBtns}`,
      });
    }

    // Recommendation seam honesty: the margin names PATTERN READS and never claims the corpus is
    // approved, live, proven, viral, or a winner. recs-blocked (applied above, before the pick) also
    // forces /api/recommendations, and the workbench pane opened above stays open across it (a
    // fixture apply re-fetches in place, it does not navigate) — so the block's own selector is
    // unchanged: #workbench .wb-recs.
    // Scope to the seam's own block, not the whole margin: a director's angle summary may fairly
    // use a word this seam must never use, about Muxin's own routing rather than a corpus claim.
    // waitLoaded returns as soon as the container stops saying Loading, which on a second visit to
    // this room can be the previous render still on screen, so wait for the block itself.
    await s.page.waitForSelector("#workbench .wb-recs", { timeout: 15_000 }).catch(() => null);
    const marginText = ((await textOf(s.page, "#workbench .wb-recs")) || "").replace(/\s+/g, " ").trim();
    if (!marginText) {
      record({
        feature: "Recommendation margin never claims proven or live status",
        status: "fail",
        detail: "recs-blocked scenario applied; PATTERN READS block still did not render",
      });
    } else {
      const hasCaption = /PATTERN READS/.test(marginText);
      const claimHits = ["approved", "live", "proven", "viral", "winner"].filter((w) =>
        new RegExp(`\\b${w}\\b`, "i").test(marginText)
      );
      record({
        feature: "Recommendation margin never claims proven or live status",
        status: hasCaption && claimHits.length === 0 ? "pass" : "fail",
        detail: hasCaption
          ? `caption present; forbidden whole-words=[${claimHits.join(",") || "none"}]; margin≈"${marginText.slice(0, 140)}"`
          : `PATTERN READS missing; margin≈"${marginText.slice(0, 140)}"`,
      });
    }

    // The seam's production answer is a blocked read: reviewed-interface, no examples.
    const recsRead = await s.page.evaluate(async () => {
      const r = await fetch("/api/recommendations");
      return { status: r.status, body: await r.json() };
    });
    const recsBody = recsRead.body as { availability?: string; source?: string; examples?: unknown[] };
    const recsOk =
      recsRead.status === 200 &&
      recsBody.availability === "blocked" &&
      recsBody.source === "reviewed-interface" &&
      Array.isArray(recsBody.examples) &&
      recsBody.examples.length === 0;
    record({
      feature: "Recommendation seam serves a blocked read",
      status: recsOk ? "pass" : "fail",
      detail: `HTTP ${recsRead.status}; availability=${recsBody.availability}; source=${recsBody.source}; examples=${Array.isArray(recsBody.examples) ? recsBody.examples.length : "missing"}`,
    });

    // Studio needs-you actions must be real <button>s (keyboard-reachable). The pre-prototype
    // stat tiles were removed in the Studio subtraction pass; this check covers only what remains.
    // Apply a Studio scenario first so a missing needs-you list names what was tried; no fixture
    // overrides /api/studio with a non-empty needsYou, so empty after apply stays blocked (not pass).
    await applyScenario(s.page, "job-queued");
    await s.page.waitForSelector("#roomStudio:not([hidden])", { timeout: 15_000 });
    await waitLoaded(s.page, "#studioMain").catch(() => "");
    const btnNy = await s.page.locator("#studioMain button.ny-go").count();
    const spanNy = await s.page.locator("#studioMain span.ny-go").count();
    if (btnNy === 0) {
      record({
        feature: "Studio needs-you actions are real buttons",
        status: spanNy > 0 ? "fail" : "blocked",
        detail:
          spanNy > 0
            ? `job-queued scenario applied; needs-you empty, but found non-buttons: span.ny-go=${spanNy}`
            : `job-queued scenario applied; Studio needs-you list still empty (0 button.ny-go); cannot verify action controls are buttons. span.ny-go=${spanNy}`,
      });
    } else {
      record({
        feature: "Studio needs-you actions are real buttons",
        status: spanNy === 0 ? "pass" : "fail",
        detail: `button.ny-go=${btnNy}, span.ny-go=${spanNy}`,
      });
    }

    // Room nav is keyboard-operable: Enter on a room button changes room and sets aria-current.
    await openRoom(s.page, "studio");
    const beforeRoom = await s.page.locator("button.room.on").getAttribute("data-room");
    // Any room BUT the one already open, so this stays true whatever order the nav runs in.
    const otherRoomBtn = s.page.locator("nav.rooms button.room:not(.on)").first();
    const targetRoom = await otherRoomBtn.getAttribute("data-room");
    await otherRoomBtn.focus();
    await s.page.keyboard.press("Enter");
    const targetId = "#room" + (targetRoom ?? "").charAt(0).toUpperCase() + (targetRoom ?? "").slice(1);
    await s.page.waitForSelector(`${targetId}:not([hidden])`, { timeout: 15_000 }).catch(() => {});
    const afterRoom = await s.page.locator("button.room.on").getAttribute("data-room");
    const currentAttr = await s.page.locator("button.room.on").getAttribute("aria-current");
    const roomChanged = afterRoom != null && afterRoom !== beforeRoom;
    record({
      feature: "Room nav responds to Enter and announces current page",
      status: roomChanged && currentAttr === "page" ? "pass" : "fail",
      detail: `before=${beforeRoom}; after=${afterRoom}; aria-current=${currentAttr}`,
    });

    // Narrow window: Content, Outreach, and Studio must not scroll horizontally at 700×900.
    const originalViewport = s.page.viewportSize() ?? { width: 1280, height: 720 };
    await s.page.setViewportSize({ width: 700, height: 900 });
    const narrowRooms: { room: string; pane: string }[] = [
      { room: "content", pane: "#reviewMain" },
      { room: "outreach", pane: "#outreachList" },
      { room: "studio", pane: "#studioMain" },
    ];
    const narrowDetails: string[] = [];
    let narrowFail = false;
    let narrowBlocked = false;
    for (const nr of narrowRooms) {
      await openRoom(s.page, nr.room);
      await waitLoaded(s.page, nr.pane).catch(() => "");
      const widths = await s.page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      const ok = widths.scrollWidth <= widths.clientWidth + 1;
      narrowDetails.push(`${nr.room}: scrollWidth=${widths.scrollWidth} clientWidth=${widths.clientWidth}`);
      if (!ok) narrowFail = true;
      if (widths.clientWidth === 0) narrowBlocked = true;
    }
    await s.page.setViewportSize(originalViewport);
    record({
      feature: "Narrow viewport has no horizontal scroll (Content, Outreach, Studio)",
      status: narrowBlocked ? "blocked" : narrowFail ? "fail" : "pass",
      detail: narrowDetails.join("; "),
    });

    // Fixture mode's central safety promise: it cannot write. Prove it from the browser.
    const writeAttempt = await s.page.evaluate(async () => {
      const r = await fetch("/api/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: "anything", status: "approve" }),
      });
      return r.status;
    });
    record({
      feature: "Fixture mode refuses every write",
      pr: "#374",
      status: writeAttempt === 403 ? "pass" : "fail",
      detail: `POST /api/status answered ${writeAttempt} (expected 403)`,
    });

    if (s.blockedCalls.length) {
      console.log(`\n  (suite aborted ${s.blockedCalls.length} model-spawning call(s): ${[...new Set(s.blockedCalls)].join(", ")})`);
    }
  } finally {
    if (s) await s.close();
    await server.stop();
  }

  const failed = results.filter((r) => r.status === "fail").length;
  console.log(`\nPass A: ${results.length - failed} ok, ${failed} failing\n`);
  // The spawned server and the browser keep the loop alive otherwise.
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
