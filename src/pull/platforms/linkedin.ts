import { join } from "node:path";
import type { BrowserContext, Download, Page } from "playwright";
import { inboxDir } from "../paths.js";
import { captureDiagnostics, looksLikeAuthWall } from "../diagnose.js";
import { PullError } from "../errors.js";
import type { PlatformPuller } from "../types.js";

// LinkedIn has no usable analytics API for a personal/creator profile, so we drive the same
// "Export" a human would. The ingest step wants the .xlsx analytics export dropped in
// data/inbox/linkedin/ (see src/ingest/import.ts + parse-linkedin.ts).
//
// ── VERIFIED 2026-07-03 ──────────────────────────────────────────────────────────
// On /analytics/creator/content/, the Export control is an <a> styled as a button (accessible
// name "Export"), NOT a <button>. So we match by ARIA ROLE + NAME — robust to link-vs-button —
// rather than a tag/CSS selector. If a pull later fails "THEIR SIDE — UI changed", the two things
// to re-check are the accessible name of the Export control and the confirm button in the dialog.
const ANALYTICS_URL = "https://www.linkedin.com/analytics/creator/content/";

// The Export control, whether LinkedIn renders it as a button or a link.
function exportControl(page: Page) {
  return page
    .getByRole("button", { name: "Export" })
    .or(page.getByRole("link", { name: "Export" }))
    .first();
}

// Find the Export control and capture the download it produces. Anything missing HERE — we're
// logged in and on the page — means the site's flow changed, so it's UI_CHANGED with a saved
// diagnostics bundle, never a silent generic timeout.
async function triggerAndCapture(page: Page): Promise<Download> {
  const trigger = exportControl(page);
  try {
    await trigger.waitFor({ state: "visible", timeout: 12_000 });
  } catch (cause) {
    const diag = await captureDiagnostics(page, "linkedin", "export-trigger-missing");
    throw new PullError("UI_CHANGED", `Export control (role button/link "Export") not found on ${page.url()}`, {
      hint: `LinkedIn likely changed its UI — re-check the accessible name in src/pull/platforms/linkedin.ts. Screenshot: ${join(diag, "screenshot.png")}`,
      diagnosticsDir: diag,
      cause,
    });
  }

  try {
    await trigger.click();
    // Clicking Export opens a small confirm modal ("Your analytics export is being prepared.
    // Confirm to begin downloading.") whose action button is "Confirm" — and LinkedIn does NOT
    // tag it role=dialog, so target the Confirm control directly and race it vs the download.
    const confirm = page
      .getByRole("button", { name: "Confirm" })
      .or(page.getByRole("link", { name: "Confirm" }))
      .first();
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      confirm.click({ timeout: 8_000 }),
    ]);
    return download;
  } catch (cause) {
    const diag = await captureDiagnostics(page, "linkedin", "no-download");
    throw new PullError("UI_CHANGED", `Clicked Export but no download started on ${page.url()}`, {
      hint: `The export dialog/confirm may have changed — check the confirm step in src/pull/platforms/linkedin.ts. Screenshot: ${join(diag, "screenshot.png")}`,
      diagnosticsDir: diag,
      cause,
    });
  }
}

export const linkedin: PlatformPuller = {
  platform: "linkedin",
  loginUrl: "https://www.linkedin.com/login",

  async pull(context: BrowserContext): Promise<string[]> {
    const page = context.pages()[0] ?? (await context.newPage());

    // 1) Navigate — a failure here is connectivity (our side), not a UI change.
    try {
      await page.goto(ANALYTICS_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    } catch (cause) {
      throw new PullError("NETWORK", `Couldn't load ${ANALYTICS_URL}`, {
        hint: "Check your connection / that LinkedIn opens in a normal browser.",
        cause,
      });
    }

    // 2) Auth check — a login wall means the saved session lapsed (re-login), NOT a UI change.
    if (looksLikeAuthWall(page.url())) {
      throw new PullError("SESSION_EXPIRED", `LinkedIn redirected to a login wall (${page.url()})`, {
        hint: "Run `npm run pull:login -- linkedin` and sign in again.",
      });
    }

    // 3) Export + capture (throws UI_CHANGED with diagnostics if the flow moved).
    const download = await triggerAndCapture(page);

    // 4) Save into the ingest inbox — a failure here is our side (disk/permissions).
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const dest = join(inboxDir("linkedin"), `linkedin-analytics-${stamp}.xlsx`);
      await download.saveAs(dest);
      return [dest];
    } catch (cause) {
      throw new PullError("DOWNLOAD_FAILED", "Export downloaded but saving the file failed", {
        hint: "Check disk space / write permission for data/inbox/linkedin/.",
        cause,
      });
    }
  },
};
