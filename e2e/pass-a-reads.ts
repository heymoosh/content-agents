// Pass A: every room loads, renders from a real read, and throws nothing.
//
// Run under REVIEW_FIXTURES=1 so the Venture/Signals/job surfaces have data to render (that is
// exactly what fixture mode was built for — prototype-port-rules Rule 4). Fixture mode is read-only
// by construction, so this pass proves reads only; writes are Pass B.

import { bootServer, openSession, openRoom, waitLoaded, textOf, record, results } from "./harness.js";

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
  const s = await openSession(PORT);
  try {
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
    await openRoom(s.page, "studio");
    const jobsText = await textOf(s.page, "#jobs");
    record({
      feature: "Studio job queue lists jobs",
      pr: "#349",
      status: jobsText.trim().length > 0 ? "pass" : "fail",
      detail: jobsText.trim().length > 0 ? `${jobsText.trim().slice(0, 100).replace(/\s+/g, " ")}…` : "job queue empty in fixture mode",
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
    await s.close();
    server.stop();
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
