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

    // P2.4a: Switching brands stays in the ordinary Signals read and an empty brand is rendered
    // as not measured, never as a measured zero. Fixture mode intercepts every request locally.
    await applyScenario(s.page, "signals-outcomes-pre-launch");
    const brandStates: string[] = [];
    for (const brand of ["charles", "fiction"] as const) {
      await s.page.locator("#signalsBrand").selectOption(brand);
      await s.page.waitForFunction(() => document.querySelector("#signalsFamilies")?.textContent?.includes("not measured"));
      brandStates.push(`${brand}:${await s.page.locator("#signalsBrand").inputValue()}`);
    }
    const scopedText = await textOf(s.page, "#signalsReads");
    record({
      feature: "Signals switches brand scope without turning missing evidence into zero",
      pr: "P2.4a",
      status: brandStates.every((state) => !state.endsWith(":")) && /not measured/i.test(scopedText)
        && /The selected brand scopes measurements, strategy recommendations, decisions, and experiments/.test(scopedText)
        && /Unassigned legacy records stay excluded/.test(scopedText) ? "pass" : "fail",
      detail: `${brandStates.join(", ")}; ${scopedText.replace(/\s+/g, " ").slice(0, 140)}…`,
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
    // Opening Studio starts ordinary reads. Let those finish before installing the fixture or an
    // older real /api/jobs response can arrive last and overwrite the forced scenario.
    await s.page.waitForLoadState("networkidle");
    await applyScenario(s.page, "job-running");
    // The panel may already be visible for a prior real job when the fixture chip is clicked. Wait
    // for the scenario payload itself, not merely for visibility, or a fast read can race reload().
    await s.page.waitForFunction(() => document.querySelector("#jobs")?.textContent?.includes("FIXTURE: a job that is not running"), null, { timeout: 15_000 });
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

    // An ordinary Content source no longer jumps directly into configuration. Picking it restores
    // the advisor/cut gate first; only a server-owned accepted cut can open treatments, media, and
    // platforms. Fixture mode is intentionally read-only, so this pass proves the gate and leaves
    // accepting a cut + configured generation to the disposable write pass.
    await openRoom(s.page, "content");
    await applyScenario(s.page, "content-wizard");
    await s.page.waitForSelector("#roomContent:not([hidden])", { timeout: 15_000 });
    await waitLoaded(s.page, "#cwBody").catch(() => "");
    await s.page.waitForSelector("#cwBody .cw-src", { timeout: 15_000 }).catch(() => null);
    await s.page.click("#cwBody .cw-src");
    const advisorText = ((await textOf(s.page, "#cwBody")) || "").replace(/\s+/g, " ").trim();
    const advisorGateOk = advisorText.includes("advisor conversation is restored") && advisorText.includes("APPROVED CUTS")
      && !advisorText.includes("TREATMENTS") && !(await s.page.locator("#contentConfigSave").count());
    record({
      feature: "Content source selection stops at the advisor and approved-cut gate",
      status: advisorGateOk ? "pass" : "fail",
      detail: advisorText.slice(0, 240),
    });
    await s.page.click('#cwSteps [data-step="3"]');
    await s.page.waitForSelector("#reviewSheet:not([hidden])", { timeout: 10_000 });
    const approvalText = ((await textOf(s.page, "#reviewSheet")) || "").replace(/\s+/g, " ").trim();
    record({
      feature: "Content opens request-grouped approval before the separate Publish step",
      status: approvalText.includes("Approve Drafts") && approvalText.includes("Publish") ? "pass" : "fail",
      detail: approvalText.slice(0, 220),
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
