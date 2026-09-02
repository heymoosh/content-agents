// Deterministic Chromium proof for Fiction idea classification, review, and canonical approval.
// The one-run token replaces only classifier/cleanup output and the missing-git main-branch read;
// all UI, routes, inbox persistence, proposal review, and canonical writes remain production code.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bootServer, openRoom, openSession, record, results, ROOT, waitLoaded } from "./harness.js";

const PORT = 4798;
const SERIES = "the-least-of-us";
const RAW = "  The station signal changes something.\nKeep these exact author bytes.  ";
const CLEANED = "The signal changes the weather above the station.";

async function main(): Promise<void> {
  console.log("\n=== Pass D: Fiction idea review, disposable injected engine ===\n");
  const token = process.env.CONTENT_AGENTS_E2E_CONFIGURED_ENGINE_TOKEN;
  if (!token || readFileSync(join(ROOT, ".e2e-configured-engine-token"), "utf8") !== token) throw new Error("combined disposable engine token is required");
  const biblePath = join(ROOT, "stories", SERIES, "bible.md");
  const outlinePath = join(ROOT, "stories", SERIES, "outline.md");
  const bibleBefore = readFileSync(biblePath, "utf8");
  const outlineBefore = readFileSync(outlinePath, "utf8");
  const server = await bootServer({ CONTENT_AGENTS_E2E_CONFIGURED_ENGINE_TOKEN: token }, PORT);
  let session: Awaited<ReturnType<typeof openSession>> | null = null;
  try {
    session = await openSession(PORT, {
      allowInjectedRequests: ["POST /api/fiction/inbox"],
    });
    const { page } = session;
    await openRoom(page, "fiction");
    await waitLoaded(page, "#fictionMain");
    await page.waitForSelector("#ficIdea", { timeout: 15_000 });
    await page.fill("#ficIdea", RAW);
    await page.selectOption("#ficIdeaEngine", "codex");
    const classifyResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/fiction/inbox" && response.request().method() === "POST");
    await page.click("#ficIdeaSubmit");
    const classifyHttp = await classifyResponse;
    const classified = await classifyHttp.json() as { ok?: boolean; idea?: { id?: string; rawText?: string; classification?: string }; proposal?: { cleanedText?: string } };
    if (!classifyHttp.ok() || !classified.ok) throw new Error(`Fiction classification failed: HTTP ${classifyHttp.status()}`);
    await page.waitForSelector("[data-inbox-approve]", { timeout: 15_000 });
    const canonUnchangedBeforeReview = readFileSync(biblePath, "utf8") === bibleBefore;
    const approveResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/fiction/inbox/approve");
    await page.click("[data-inbox-approve]");
    const approveHttp = await approveResponse;
    const approved = await approveHttp.json() as { ok?: boolean; idea?: { status?: string; rawText?: string } };
    if (!approveHttp.ok() || !approved.ok) throw new Error(`Fiction approval failed: HTTP ${approveHttp.status()}`);
    await page.reload();
    await openRoom(page, "fiction");
    await page.waitForFunction((raw) => document.querySelector("#fictionMain")?.textContent?.includes(raw), RAW.trim(), { timeout: 15_000 });
    const bibleAfter = readFileSync(biblePath, "utf8");
    const rendered = await page.locator("#fictionMain").innerText();
    const appendCount = bibleAfter.split(CLEANED).length - 1;
    const passed = classified.idea?.rawText === RAW
      && classified.idea.classification === "world"
      && classified.proposal?.cleanedText === CLEANED
      && canonUnchangedBeforeReview
      && approved.idea?.status === "approved"
      && approved.idea.rawText === RAW
      && bibleAfter.startsWith(bibleBefore)
      && appendCount === 1
      && readFileSync(outlinePath, "utf8") === outlineBefore
      && rendered.includes("approved") && rendered.includes(RAW.trim())
      && session.blockedCalls.length === 0;
    record({
      feature: "Fiction GUI preserves the raw idea, reviews injected cleanup, and writes canon only after approval",
      status: passed ? "pass" : "fail",
      detail: `raw exact=${classified.idea?.rawText === RAW}; pre-approval canon unchanged=${canonUnchangedBeforeReview}; cleaned append count=${appendCount}; unrelated outline unchanged=${readFileSync(outlinePath, "utf8") === outlineBefore}; reload approved=${rendered.includes("approved")}; blocked model calls=${session.blockedCalls.length}`,
    });
  } finally {
    await session?.close().catch(() => {});
    await server.stop();
  }
  process.exit(results.some((result) => result.status === "fail") ? 1 : 0);
}

main().catch((error) => { console.error(error); process.exit(1); });
