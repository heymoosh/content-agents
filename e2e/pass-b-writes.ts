// Pass B: the write flows, driven through the real UI against a real server.
//
// Fixture mode cannot do this — it refuses every non-GET by construction — so this runs a plain
// server. Safe because src/db/db.ts derives repoRoot from import.meta.url: every write lands in
// THIS worktree's own venture/, outreach/, data/ and review-queue.md, and can never reach Muxin's
// checkout.
//
// EXPENSIVE_ROUTES are aborted at the browser (see harness.ts). Nothing here starts a model job.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bootServer, openSession, openRoom, waitLoaded, record, results, ROOT } from "./harness.js";
import { writeContentRequest } from "../src/review/content-request-store.js";

const PORT = 4793;
const SLUG = "e2e-probe-venture";
const CONTENT_SLUG = "2099-09-01-e2e-content-review";

/** Answers 1..25, each distinctive so we can prove they were stored verbatim. */
function answerFor(n: number): string {
  return `E2E answer ${n}: the ${n}th thing she actually typed, stored word for word.`;
}

async function main(): Promise<void> {
  console.log("\n=== Pass B: writes, real server (worktree-isolated) ===\n");
  // Keep the manual-send assertion independent of whatever personal lead data happens to exist.
  const outreachFixture = join(ROOT, "outreach", "leads", "e2e-manual-send");
  mkdirSync(join(outreachFixture, "messages"), { recursive: true });
  writeFileSync(join(outreachFixture, "lead.md"), [
    "---", "kind: client", 'name: "E2E Manual Send"', "url: https://example.invalid/e2e",
    "source: e2e", "status: pursue", "classification: greenfield", 'pitch_angle: "Verify the manual handoff"', "---",
    "", "## Profile", "", "Disposable browser fixture.",
  ].join("\n"));
  writeFileSync(join(outreachFixture, "messages", "message-01.md"), [
    "---", "lead: e2e-manual-send", "channel: email", "status: locked", "locked_at: 2026-08-30", "---", "",
    "Hello from the disposable manual-send fixture.",
  ].join("\n"));
  const schedulingToken = process.env.CONTENT_AGENTS_E2E_SCHEDULING_TOKEN;
  if (!schedulingToken || !existsSync(join(ROOT, ".e2e-scheduling-token"))) {
    throw new Error("combined disposable E2E scheduling token is required");
  }
  const contentFixture = join(ROOT, "content", CONTENT_SLUG);
  mkdirSync(join(contentFixture, "derivatives"), { recursive: true });
  await writeContentRequest(contentFixture, {
    id: "e2e-content-review-request", origin: "human-inference", descriptor: "E2E grouped approval request",
    originalInput: "The exact disposable source for grouped Content review.", treatments: ["summary"],
    media: ["none"], platforms: ["x"], includeUntreatedControl: true,
  });
  writeFileSync(join(contentFixture, "review-queue.md"), [
    "# Review queue — E2E grouped approval request", "",
    "| id | platform | format | asset | native(1-5) | brand(1-5) | cta | status | notes |",
    "|----|----------|--------|-------|-------------|------------|-----|--------|-------|",
    "| e2e-provider-success | x | text | derivatives/e2e-provider-success.md | 5 | 5 | no | pending | Untreated control |",
    "| e2e-provider-failure | x | text | derivatives/e2e-provider-failure.md | 5 | 5 | no | pending | Treatment: summary |",
  ].join("\n") + "\n");
  writeFileSync(join(contentFixture, "derivatives", "e2e-provider-success.md"), "---\nplatform: x\nvariant_kind: control\n---\n\nOriginal success draft.\n");
  writeFileSync(join(contentFixture, "derivatives", "e2e-provider-failure.md"), "---\nplatform: x\nvariant_kind: treated\ntreatment: summary\n---\n\nOriginal failure draft.\n");
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

    // ── Outreach: delivery is manual; the Studio copies and records a send but never implies Gmail. ──
    await openRoom(page, "outreach");
    await waitLoaded(page, "#outreachList");
    const rows = page.locator("#outreachList button.tri-row");
    let manualControls = 0;
    for (let i = 0; i < await rows.count(); i++) {
      await rows.nth(i).click();
      manualControls = await page.locator("#outreachList button", { hasText: "I sent this by hand" }).count();
      if (manualControls > 0) break;
      await page.locator("#outreachList button.out-back").click();
    }
    const outreachText = ((await page.locator("#outreachList").innerText()) ?? "").replace(/\s+/g, " ");
    const copyControls = await page.locator("#outreachList button", { hasText: "Copy message" }).count();
    record({
      feature: "Outreach exposes manual copy and sent-by-hand recording without claiming Gmail delivery",
      status: copyControls > 0 && manualControls > 0 && !/Gmail|Connect Gmail/.test(outreachText) ? "pass" : "fail",
      detail: `copy controls=${copyControls}; sent-by-hand controls=${manualControls}; Gmail claimed=${/Gmail|Connect Gmail/.test(outreachText)}`,
    });

    // ── Content: direct edit + grouped approval + hermetic provider outcomes through the UI. ──
    await openRoom(page, "content");
    await waitLoaded(page, "#reviewMain");
    await page.click('#contentWizard [data-step="3"]');
    await page.fill("#reviewRequestFilter", CONTENT_SLUG);
    const fixtureSection = page.locator("#reviewMain section.piece", { hasText: "E2E grouped approval request" });
    await fixtureSection.waitFor({ timeout: 15_000 });
    const successRow = fixtureSection.locator(".scan-row", { hasText: "e2e-provider-success" });
    await successRow.getByRole("button", { name: "Open Focus Mode" }).click();
    const editedBody = "Edited through Focus Mode in the disposable browser.";
    await page.fill("#reviewFocusEditor", editedBody);
    await page.click("#reviewFocusSave");
    await page.waitForFunction((body) => document.body.innerText.includes(body), editedBody, { timeout: 15_000 });
    const grouped = page.locator("#reviewMain section.piece", { hasText: "E2E grouped approval request" });
    await grouped.locator(".review-check").nth(0).check();
    await grouped.locator(".review-check").nth(1).check();
    await page.click("#reviewApproveSelected");
    await page.waitForFunction(async (slug) => {
      const response = await fetch("/api/queue");
      const data = await response.json();
      const piece = (data.pieces || []).find((candidate) => candidate.slug === slug);
      return piece?.rows?.filter((row) => row.id.startsWith("e2e-provider-") && row.status === "approve").length === 2;
    }, CONTENT_SLUG, { timeout: 20_000, polling: 250 });
    const queueState = await page.evaluate(async (slug) => {
      const response = await fetch("/api/queue");
      const data = await response.json();
      return (data.pieces || []).find((candidate) => candidate.slug === slug);
    }, CONTENT_SLUG) as { requestId?: string; rows?: { id: string; status: string; publishingStatus?: { state?: string; error?: string; providerObjectId?: string } }[] };
    const success = queueState.rows?.find((row) => row.id === "e2e-provider-success");
    const failure = queueState.rows?.find((row) => row.id === "e2e-provider-failure");
    const savedBody = readFileSync(join(contentFixture, "derivatives", "e2e-provider-success.md"), "utf8");
    record({
      feature: "Content direct edit and grouped approval reach durable files through the real UI",
      status: queueState.requestId === "e2e-content-review-request" && savedBody.includes(editedBody) && success?.status === "approve" && failure?.status === "approve" ? "pass" : "fail",
      detail: `request=${queueState.requestId}; edit=${savedBody.includes(editedBody)}; approved=${success?.status}/${failure?.status}`,
    });
    record({
      feature: "Content grouped approval reports injected provider success and retained failure separately",
      status: success?.publishingStatus?.state === "planned" && success.publishingStatus.providerObjectId === "e2e-provider-object" && failure?.publishingStatus?.state === "uncertain" && failure.publishingStatus.error === "injected provider timeout" ? "pass" : "fail",
      detail: `success=${success?.publishingStatus?.state}/${success?.publishingStatus?.providerObjectId}; failure=${failure?.publishingStatus?.state}/${failure?.publishingStatus?.error}`,
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
