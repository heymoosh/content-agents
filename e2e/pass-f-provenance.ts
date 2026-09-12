// Pass F: first-time approval provenance and the explicit legacy refusal, driven in Chromium.

import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { appendRows } from "../src/publish/queue.js";
import { writeContentRequest } from "../src/review/content-request-store.js";
import { bootServer, openRoom, openSession, record, results, ROOT, waitLoaded } from "./harness.js";

const PORT = 4799;
const SLUG = "2099-09-11-e2e-provenance";
const LEGACY_ID = "e2e-legacy-approved";
const RECOVERY = `This row has no verifiable creation and approval provenance. Ask the coordinator to run scripts/reconcile-approval-provenance.ts for ${SLUG}/${LEGACY_ID}, then try Schedule again.`;
const SHOWN_RECOVERY = `${LEGACY_ID}: ${RECOVERY}`;

async function main(): Promise<void> {
  console.log("\n=== Pass F: approval provenance and recovery ===\n");
  const folder = join(ROOT, "content", SLUG);
  mkdirSync(join(folder, "derivatives"), { recursive: true });
  await writeContentRequest(folder, {
    id: "e2e-provenance-request",
    origin: "human-inference",
    descriptor: "Approval provenance browser proof",
    originalInput: "First-time approved rows schedule. Historical rows stay blocked until explicit adoption.",
    treatments: ["summary"],
    media: ["none"],
    platforms: ["x"],
    includeUntreatedControl: true,
  });
  writeFileSync(join(folder, "derivatives", "e2e-provider-success.md"), "---\nplatform: x\nvariant_kind: control\n---\n\nA first-time row approved in Studio.\n");
  writeFileSync(join(folder, "derivatives", `${LEGACY_ID}.md`), "---\nplatform: x\nvariant_kind: treated\n---\n\nA historical row with no journal events.\n");
  writeFileSync(join(folder, "review-queue.md"), "| id | platform | format | asset | native | brand | cta | status | notes | origin |\n|---|---|---|---|---|---|---|---|---|---|\n");
  appendRows(folder, [{
    id: "e2e-provider-success",
    platform: "x",
    format: "text",
    asset: "derivatives/e2e-provider-success.md",
    status: "pending",
    notes: "Untreated control",
    origin: "from GUI queue",
  }]);
  appendFileSync(join(folder, "review-queue.md"), `| ${LEGACY_ID} | x | text | derivatives/${LEGACY_ID}.md | — | — | — | approve | Historical row | from GUI queue |\n`);

  const server = await bootServer({}, PORT);
  let session: Awaited<ReturnType<typeof openSession>> | null = null;
  try {
    session = await openSession(PORT);
    const { page } = session;
    await page.setViewportSize({ width: 1280, height: 900 });
    await openRoom(page, "content");
    await waitLoaded(page, "#reviewMain");
    await page.click('#contentWizard [data-step="3"]');
    await page.fill("#reviewRequestFilter", SLUG);
    const section = page.locator("#reviewMain section.piece", { hasText: "A first-time row approved in Studio." });
    await section.waitFor({ timeout: 15_000 });
    await section.locator(".scan-row", { hasText: "e2e-provider-success" }).locator(".review-check").check();
    await page.click("#reviewApproveSelected");
    await page.waitForFunction(async (slug) => {
      const data = await (await fetch("/api/queue")).json();
      return data.pieces?.find((piece) => piece.slug === slug)?.rows?.find((row) => row.id === "e2e-provider-success")?.status === "approve";
    }, SLUG, { timeout: 20_000, polling: 250 });

    await page.click('#reviewSteps [data-step="4"]');
    await page.waitForSelector("#publishedSheet:not([hidden])", { timeout: 10_000 });
    await page.locator('#publishedSheet [data-schedule-id="e2e-provider-success"]').click();
    await page.waitForFunction(async (slug) => {
      const data = await (await fetch("/api/queue")).json();
      return data.pieces?.find((piece) => piece.slug === slug)?.rows?.find((row) => row.id === "e2e-provider-success")?.publishingStatus?.state === "planned";
    }, SLUG, { timeout: 20_000, polling: 250 });
    const legacyButton = page.locator(`#publishedSheet [data-schedule-id="${LEGACY_ID}"]`);
    await legacyButton.waitFor({ timeout: 15_000 });
    await legacyButton.click();
    await page.waitForFunction((text) => document.querySelector("#flash")?.textContent?.includes(text), SHOWN_RECOVERY, { timeout: 10_000 });
    await page.waitForTimeout(1_700);

    const state = await page.evaluate(async (slug) => {
      const data = await (await fetch("/api/queue")).json();
      return data.pieces?.find((piece) => piece.slug === slug);
    }, SLUG) as { rows?: Array<{ id: string; publishingStatus?: { state?: string; providerObjectId?: string } }> };
    const scheduled = state.rows?.find((row) => row.id === "e2e-provider-success");
    const legacy = state.rows?.find((row) => row.id === LEGACY_ID);
    const refusal = (await page.locator("#flash.error").innerText()).replace(/Dismiss\s*$/, "").replace(/^⚠\s*/, "").trim();
    record({
      feature: "A first-time Studio approval schedules while a zero-event row dispatches nothing",
      status: scheduled?.publishingStatus?.state === "planned" && scheduled.publishingStatus.providerObjectId === "e2e-provider-object" && !legacy?.publishingStatus ? "pass" : "fail",
      detail: `first-time=${scheduled?.publishingStatus?.state}/${scheduled?.publishingStatus?.providerObjectId}; legacy provider state=${legacy?.publishingStatus?.state ?? "none"}`,
    });
    record({
      feature: "The legacy refusal names the general adoption path and stays until read",
      status: refusal === SHOWN_RECOVERY && await page.locator("#flash.error").isVisible() ? "pass" : "fail",
      detail: `exact recovery=${refusal === SHOWN_RECOVERY}; still visible after 1.7s=${await page.locator("#flash.error").isVisible()}`,
    });

    // The refusal text people actually read lives in the flash itself, not in the row body
    // measured below. Read its own computed size so a stylesheet change that shrinks the flash
    // is caught here rather than by someone squinting at a blocked row.
    const flashFontPx = await page.locator("#flash.error").evaluate((flash) =>
      Number.parseFloat(getComputedStyle(flash).fontSize));
    record({
      feature: "The error flash renders the refusal at a readable size",
      status: flashFontPx >= 18 ? "pass" : "fail",
      detail: `#flash.error computed font-size=${flashFontPx}px (floor 18px)`,
    });

    for (const width of [1280, 768]) {
      await page.setViewportSize({ width, height: 900 });
      const measurements = await legacyButton.evaluate((button) => {
        const row = button.closest(".publish-row")!;
        const body = row.querySelector(".scan-body")!;
        const meta = body.querySelector(".src")!;
        const bodyStyle = getComputedStyle(body);
        const metaStyle = getComputedStyle(meta);
        const rowStyle = getComputedStyle(row);
        return {
          bodyFontPx: Number.parseFloat(bodyStyle.fontSize),
          lineHeightPx: Number.parseFloat(bodyStyle.lineHeight),
          metaFontPx: Number.parseFloat(metaStyle.fontSize),
          divider: rowStyle.borderTopStyle,
          viewportOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          bodyFirst: row.firstElementChild?.contains(body) === true,
        };
      });
      record({
        feature: `Publishing refusal layout is readable at ${width}px`,
        status: measurements.bodyFontPx >= 18 && measurements.lineHeightPx / measurements.bodyFontPx >= 1.5 && measurements.metaFontPx < measurements.bodyFontPx && measurements.divider !== "none" && !measurements.viewportOverflow && measurements.bodyFirst ? "pass" : "fail",
        detail: JSON.stringify(measurements),
      });
    }
  } finally {
    if (session) await session.close();
    await server.stop();
  }

  const failed = results.filter((row) => row.status === "fail").length;
  console.log(`\nPass F: ${results.length - failed} ok, ${failed} failing\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
