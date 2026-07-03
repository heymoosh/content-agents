import { join } from "node:path";
import type { BrowserContext, Download, Page } from "playwright";
import { inboxDir } from "../paths.js";
import { captureDiagnostics, looksLikeAuthWall } from "../diagnose.js";
import { PullError } from "../errors.js";
import type { PlatformPuller } from "../types.js";

// X has no free per-post analytics API, and its analytics GraphQL uses rotating query-id hashes
// (too fragile to hardcode). But Analytics > Content has a "Download CSV" button that exports
// exactly the per-post "Content" CSV parseX ingests (text + impressions + engagements per post).
//
// ── VERIFIED 2026-07-03 (drove the saved session) ──────────────────────────────────
// The Content tab is a direct URL; the export control is <button aria-label="Download CSV">, and
// clicking it downloads account_analytics_content_<from>_<to>.csv. `days=` sets the window (the UI
// defaults to 7; we ask for 90 to get more history per pull). If a pull fails "THEIR SIDE", the two
// things to re-check are this URL and the "Download CSV" accessible name.
const CONTENT_URL = "https://x.com/i/account_analytics/content?type=posts&sort=date&dir=desc&days=90";

// The export control, whether X renders it as a button or a link.
function exportControl(page: Page) {
  return page
    .getByRole("button", { name: /download csv/i })
    .or(page.getByRole("link", { name: /download csv/i }))
    .first();
}

// Find the "Download CSV" control and capture the download it produces. Anything missing HERE — we
// are logged in and on the Content tab — means the flow changed, so it's UI_CHANGED with a saved
// diagnostics bundle, never a silent generic timeout.
async function triggerAndCapture(page: Page): Promise<Download> {
  const trigger = exportControl(page);
  try {
    await trigger.waitFor({ state: "visible", timeout: 20_000 });
  } catch (cause) {
    const diag = await captureDiagnostics(page, "x", "export-trigger-missing");
    throw new PullError("UI_CHANGED", `"Download CSV" control not found on ${page.url()}`, {
      hint: `X may have changed the Content-tab export — re-check the URL + button name in src/pull/platforms/x.ts. Screenshot: ${join(diag, "screenshot.png")}`,
      diagnosticsDir: diag,
      cause,
    });
  }

  try {
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      trigger.click(),
    ]);
    return download;
  } catch (cause) {
    const diag = await captureDiagnostics(page, "x", "no-download");
    throw new PullError("UI_CHANGED", `Clicked "Download CSV" but no download started on ${page.url()}`, {
      hint: `The export may now open a menu/dialog — check the flow in src/pull/platforms/x.ts. Screenshot: ${join(diag, "screenshot.png")}`,
      diagnosticsDir: diag,
      cause,
    });
  }
}

export const x: PlatformPuller = {
  platform: "x",
  loginUrl: "https://x.com/login",

  async pull(context: BrowserContext): Promise<string[]> {
    const page = context.pages()[0] ?? (await context.newPage());

    // 1) Navigate straight to the Content tab — a failure here is connectivity (our side).
    try {
      await page.goto(CONTENT_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    } catch (cause) {
      throw new PullError("NETWORK", `Couldn't load ${CONTENT_URL}`, {
        hint: "Check your connection / that X opens in a normal browser.",
        cause,
      });
    }
    await page.waitForTimeout(4_000); // the analytics table + export button hydrate client-side

    // 2) Auth check — a login wall means the saved session lapsed (re-login), NOT a UI change.
    if (looksLikeAuthWall(page.url())) {
      throw new PullError("SESSION_EXPIRED", `X redirected to a login wall (${page.url()})`, {
        hint: "Run `npm run pull:login -- x` and sign in again.",
      });
    }

    // 3) Export + capture (throws UI_CHANGED with diagnostics if the flow moved).
    const download = await triggerAndCapture(page);

    // 4) Save into the ingest inbox — a failure here is our side (disk/permissions).
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const dest = join(inboxDir("x"), `x-content-${stamp}.csv`);
      await download.saveAs(dest);
      return [dest];
    } catch (cause) {
      throw new PullError("DOWNLOAD_FAILED", "Export downloaded but saving the file failed", {
        hint: "Check disk space / write permission for data/inbox/x/.",
        cause,
      });
    }
  },
};
