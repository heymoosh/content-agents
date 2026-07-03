import { join } from "node:path";
import type { BrowserContext, Download, Page } from "playwright";
import { inboxDir } from "../paths.js";
import { captureDiagnostics, looksLikeAuthWall } from "../diagnose.js";
import { PullError } from "../errors.js";
import type { PlatformPuller } from "../types.js";

// X (Twitter) has no free per-post analytics API, so we drive the same export a human does.
// The ingest step wants the per-post "Content" CSV (rows = individual posts, with impressions/
// likes/etc.) dropped in data/inbox/x/ — NOT the account-overview daily totals (see parse-x.ts).
//
// ── NEEDS LIVE VERIFICATION (first pass, 2026-07-03) ────────────────────────────────
// X's analytics UI has moved repeatedly (analytics.twitter.com was sunset). The current premium
// hub is /i/account_analytics, and the per-post export sits behind an "Export"/"Export data"
// control you reach after clicking into the Posts/Content view. Muxin's note: "from there you'd
// click around for what you want." So this is a best-effort first pass — run
// `npm run pull -- x --headed`, then refine the URL + selectors from the diagnostics screenshot,
// exactly as we did for LinkedIn.
const ANALYTICS_URL = "https://x.com/i/account_analytics";

// Match the export trigger by ARIA role + accessible name (robust to button-vs-link), the same
// approach that made LinkedIn resilient. X may label it "Export" or "Export data".
function exportControl(page: Page) {
  return page
    .getByRole("button", { name: /export/i })
    .or(page.getByRole("link", { name: /export/i }))
    .first();
}

// Find the export control and capture the download it produces. Anything missing HERE — we're
// logged in and on the analytics page — means the site's flow changed, so it's UI_CHANGED with a
// saved diagnostics bundle, never a silent generic timeout.
async function triggerAndCapture(page: Page): Promise<Download> {
  const trigger = exportControl(page);
  try {
    await trigger.waitFor({ state: "visible", timeout: 15_000 });
  } catch (cause) {
    const diag = await captureDiagnostics(page, "x", "export-trigger-missing");
    throw new PullError("UI_CHANGED", `Export control (role button/link matching /export/i) not found on ${page.url()}`, {
      hint: `X likely changed its analytics UI, or the export sits behind another click (Posts/Content view). Re-check the URL + accessible name in src/pull/platforms/x.ts. Screenshot: ${join(diag, "screenshot.png")}`,
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
    throw new PullError("UI_CHANGED", `Clicked Export but no download started on ${page.url()}`, {
      hint: `X's export may open a menu (by day / by post) or a dialog before downloading — check the flow in src/pull/platforms/x.ts. Screenshot: ${join(diag, "screenshot.png")}`,
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

    // 1) Navigate — a failure here is connectivity (our side), not a UI change.
    try {
      await page.goto(ANALYTICS_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    } catch (cause) {
      throw new PullError("NETWORK", `Couldn't load ${ANALYTICS_URL}`, {
        hint: "Check your connection / that X opens in a normal browser.",
        cause,
      });
    }

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
