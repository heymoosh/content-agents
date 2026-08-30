// Pass B: the write flows, driven through the real UI against a real server.
//
// Fixture mode cannot do this — it refuses every non-GET by construction — so this runs a plain
// server. Safe because src/db/db.ts derives repoRoot from import.meta.url: every write lands in
// THIS worktree's own venture/, outreach/, data/ and review-queue.md, and can never reach Muxin's
// checkout.
//
// EXPENSIVE_ROUTES are aborted at the browser (see harness.ts). Nothing here starts a model job.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bootServer, openSession, openRoom, waitLoaded, record, results, ROOT } from "./harness.js";

const PORT = 4793;
const SLUG = "e2e-probe-venture";

/** Answers 1..25, each distinctive so we can prove they were stored verbatim. */
function answerFor(n: number): string {
  return `E2E answer ${n}: the ${n}th thing she actually typed, stored word for word.`;
}

async function main(): Promise<void> {
  console.log("\n=== Pass B: writes, real server (worktree-isolated) ===\n");
  const server = await bootServer({}, PORT);
  let s: Awaited<ReturnType<typeof openSession>> | null = null;

  try {
    s = await openSession(PORT);
    const { page } = s;
    // ── #381: the whole 25-question intake interview, on the desk, ending in a real intake.md ──
    await openRoom(page, "venture");
    await waitLoaded(page, "#ventureThread").catch(() => {});
    await page.click("#ventureStartBtn");
    await page.waitForSelector("#ivSlugIn", { timeout: 10_000 });
    await page.fill("#ivSlugIn", SLUG);
    await page.click("#ivBegin");
    await page.waitForSelector("#ivIn", { timeout: 10_000 });

    let answered = 0;
    for (let n = 1; n <= 25; n++) {
      // Wait for the textarea OF THIS QUESTION. renderIntake() rebuilds the subtree and the new
      // textarea reuses the id #ivIn, so a bare waitForSelector("#ivIn") matches the PREVIOUS
      // question's node and types answer n into question n-1. data-ivq is what disambiguates.
      await page.waitForSelector(`#ivIn[data-ivq="${n}"]`, { timeout: 15_000 });
      await page.fill(`#ivIn[data-ivq="${n}"]`, answerFor(n));
      // Confirm the answer reached the SERVER before advancing. Asserting against the save line
      // alone would pass on the previous question's stale "saved".
      await page.waitForFunction(
        async (args) => {
          const r = await fetch(`/api/venture/${args.slug}/intake/${args.n}/draft`);
          const j = await r.json();
          return !!(j.ok && j.draft && j.draft.text === args.text);
        },
        { slug: SLUG, n, text: answerFor(n) },
        { timeout: 20_000, polling: 250 }
      );
      answered++;
      await page.click("#ivNext");
    }
    record({
      feature: "Intake interview accepts all 25 answers with autosave",
      pr: "#381/#348",
      status: answered === 25 ? "pass" : "fail",
      detail: `${answered}/25 questions answered and autosaved`,
    });

    // Autosave durability: the drafts must be on the SERVER, not just in the page.
    const drafts = await page.evaluate(async (slug) => {
      const r = await fetch(`/api/venture/${slug}/intake/drafts`);
      return (await r.json()) as { ok: boolean; drafts?: { n: number; text: string }[] };
    }, SLUG);
    const draftCount = drafts.drafts?.length ?? 0;
    record({
      feature: "Intake answers survive on the server, not just in the page",
      pr: "#348",
      status: draftCount === 25 ? "pass" : "fail",
      detail: `${draftCount}/25 drafts readable back from /intake/drafts`,
    });

    // Voice evidence step.
    await page.waitForSelector('[data-ivf="samples"]', { timeout: 10_000 });
    await page.fill('[data-ivf="samples"]', "https://example.invalid/a-piece-she-wrote");
    await page.fill('[data-ivf="worldview"]', "People deserve tools that tell them the truth about what they measured.");
    await page.fill('[data-ivf="natural"]', "plainly\nno guessing");
    await page.fill('[data-ivf="refused"]', "here's the thing\nsynergy");
    await page.click("#ivNext");

    // Day 14 scorecard.
    await page.waitForSelector('[data-ivf="posts"]', { timeout: 10_000 });
    await page.fill('[data-ivf="posts"]', "3");
    await page.fill('[data-ivf="pace"]', "three a week, most weeks");
    await page.click('[data-ivlo="views"]');
    await page.waitForSelector('[data-ivf="optin"]', { timeout: 10_000 });
    await page.click('[data-ivlo="optin"]');
    await page.waitForSelector('[data-ivf="quality"]', { timeout: 10_000 });
    await page.fill('[data-ivf="quality"]', "They name a specific moment it went wrong, not a general complaint.");
    await page.fill('[data-ivf="sustain"]', "Still under the 2h15m a day I said in question 20.");

    const commitErrors = s.errors.length;
    await page.click("#ivCommit");
    // The commit either writes and leaves the interview, or renders a refusal in place.
    await page
      .waitForFunction(
        () => {
          const box = document.querySelector("#ventureIntake");
          const refusal = document.querySelector("#ventureIntake .vrefusal");
          return (box as HTMLElement | null)?.hidden === true || !!refusal;
        },
        undefined,
        { timeout: 30_000 }
      )
      .catch(() => {});

    const refusalText = await page.textContent("#ventureIntake .vrefusal").catch(() => null);
    const intakePath = join(ROOT, "venture", SLUG, "intake.md");
    const wrote = existsSync(intakePath);
    const body = wrote ? readFileSync(intakePath, "utf8") : "";
    // Verbatim storage is the actual promise of this screen, so check the words, not just the file.
    const verbatim = wrote && body.includes(answerFor(7)) && body.includes(answerFor(25));

    record({
      feature: "Intake commit writes a real intake.md with her answers verbatim",
      pr: "#381",
      status: wrote && verbatim ? "pass" : "fail",
      detail: wrote
        ? verbatim
          ? `venture/${SLUG}/intake.md written, ${body.length} bytes, answers 7 and 25 present word for word`
          : `intake.md written but an answer was not stored verbatim`
        : `no intake.md. Refusal on screen: ${refusalText?.trim().slice(0, 200) ?? "(none)"}`,
    });

    const newErrs = s.errors.slice(commitErrors);
    if (newErrs.length) {
      record({
        feature: "Intake commit runs without a browser error",
        pr: "#381",
        status: "fail",
        detail: newErrs.join(" / ").slice(0, 250),
      });
    }

    // Canon should record the kickoff, and the new venture should join the picker.
    const list = await page.evaluate(async () => {
      const r = await fetch("/api/venture/list");
      return (await r.json()) as { ok: boolean; ventures: string[] };
    });
    record({
      feature: "A venture created on the desk joins the venture list",
      pr: "#381",
      status: list.ventures?.includes(SLUG) ? "pass" : "fail",
      detail: `list = ${(list.ventures ?? []).join(", ")}`,
    });

    // ── #383: the artifact body editor, and #383: paste-a-response. Both are controls that only ──
    // exist when the seeded venture is in the phase that owns them. Enumerate what the room
    // actually offers rather than guessing a selector, and report honestly if it is unreachable.
    // Leave the interview first, or the thread stays hidden behind it and the dump reads the
    // intake box instead of the room.
    await page.click("#ivLeave").catch(() => {});
    for (const slug of ["zz-test-phase3", "zz-test-phase2"]) {
      await page.selectOption("#ventureSelect", slug).catch(() => {});
      await page.waitForTimeout(1200);
      const controls = await page.evaluate(() =>
        Array.from(document.querySelectorAll("#roomVenture [data-v], #roomVenture button"))
          .map((el) => {
            const e = el as HTMLElement;
            return (e.dataset.v ?? "") + "|" + (e.textContent ?? "").trim().slice(0, 40);
          })
          .filter((x) => x !== "|")
          .slice(0, 40)
      );
      console.log(`  (controls on ${slug}: ${controls.slice(0, 12).join(" · ")})`);
    }

    // ── Outreach: Gmail is the source of truth, and this fixture has no authenticated connection. ──
    await openRoom(page, "outreach");
    await waitLoaded(page, "#outreachList");
    const outreachText = ((await page.locator("#outreachList").innerText()) ?? "").replace(/\s+/g, " ");
    const disabledSend = await page.locator("#outreachList button:disabled", { hasText: "Connect Gmail to send" }).count();
    record({
      feature: "Outreach refuses sending until the intended Gmail account is connected",
      pr: "#350",
      status: outreachText.includes("muxin.li.pro@gmail.com") && disabledSend > 0 ? "pass" : "fail",
      detail: `account named=${outreachText.includes("muxin.li.pro@gmail.com")}; disabled send controls=${disabledSend}`,
    });

    // ── Content: the approve write, the one gate rule 2 cares about. ──
    await openRoom(page, "content");
    await waitLoaded(page, "#reviewMain");
    const statusWrite = await page.evaluate(async () => {
      const r = await fetch("/api/queue");
      const j = (await r.json()) as { pieces: { slug: string; rows: { id: string; status: string }[] }[] };
      const piece = (j.pieces ?? []).find((p) => (p.rows ?? []).length);
      const row = piece?.rows?.[0];
      if (!row) return { ok: false, why: "no reviewable rows in this worktree" };
      const res = await fetch("/api/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: row.id, slug: piece!.slug, status: "hold" }),
      });
      return { ok: res.ok, status: res.status, id: row.id, body: (await res.text()).slice(0, 160) };
    });
    record({
      feature: "Content review status write reaches review-queue.md",
      pr: "#341",
      status: statusWrite.ok ? "pass" : "fail",
      detail: statusWrite.ok
        ? `set ${(statusWrite as { id?: string }).id} to hold`
        : `${JSON.stringify(statusWrite).slice(0, 200)}`,
    });

    // ── Signals: recommendations are session-local and do not expose a backlog write. ──
    await openRoom(page, "signals");
    await waitLoaded(page, "#signalsFamilies");
    const signalsText = ((await page.locator("#signalsReads").innerText()) ?? "").replace(/\s+/g, " ");
    const backlogButtons = await page.getByRole("button", { name: "Send to backlog" }).count();
    record({
      feature: "Signals exposes actionable defaults without an orchestration write",
      pr: "#375",
      status: signalsText.includes("Content defaults") && backlogButtons === 0 ? "pass" : "fail",
      detail: `Content defaults shown=${signalsText.includes("Content defaults")}; backlog buttons=${backlogButtons}`,
    });

    if (s.blockedCalls.length) {
      console.log(`\n  (aborted ${s.blockedCalls.length} model-spawning call(s): ${[...new Set(s.blockedCalls)].join(", ")})`);
    }
    if (s.badResponses.length) {
      console.log(`  (non-OK responses seen: ${[...new Set(s.badResponses)].slice(0, 12).join(", ")})`);
    }
  } finally {
    if (s) await s.close();
    await server.stop();
  }

  const failed = results.filter((r) => r.status === "fail").length;
  console.log(`\nPass B: ${results.length - failed} ok, ${failed} failing\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
