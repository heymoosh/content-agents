import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import type { BrowserContext, Download, Page } from "playwright";
import { inboxDir } from "../paths.js";
import { captureDiagnostics, looksLikeAuthWall } from "../diagnose.js";
import { PullError } from "../errors.js";
import type { PlatformPuller } from "../types.js";

// Substack has no analytics API, so we drive the full data export a human does. It is the ONE
// export ingest reads as a FOLDER: parseSubstackExport wants posts.csv + per-post event logs
// (posts/<id>.opens.csv, posts/<id>.delivers.csv). The export is generated server-side and is
// ASYNC — clicking "New export" queues a job and a Download link appears minutes later.
//
// ── NEEDS LIVE VERIFICATION (first pass, 2026-07-03) ────────────────────────────────
// Muxin's route: "you go to Dashboard first — a button on the left above the profile." Clicking
// Dashboard lands on the publication at https://<sub>.substack.com/publish/... which is how we
// learn the subdomain (we can't hardcode it); the export lives under Settings → Exports. This is
// a best-effort first pass — run `npm run pull -- substack --headed` and refine the nav + export
// selectors from the diagnostics screenshot, exactly as we did for LinkedIn.
const HOME_URL = "https://substack.com/home";

// Reach the publication dashboard via the "Dashboard" nav link, and read the subdomain off the
// resulting /publish/ URL (we can't hardcode Muxin's subdomain).
async function publicationOrigin(page: Page): Promise<string> {
  const dashboard = page
    .getByRole("link", { name: /dashboard/i })
    .or(page.getByRole("button", { name: /dashboard/i }))
    .first();
  try {
    await dashboard.waitFor({ state: "visible", timeout: 15_000 });
    await Promise.all([
      page.waitForURL(/\/publish\b/, { timeout: 20_000 }),
      dashboard.click(),
    ]);
  } catch (cause) {
    const diag = await captureDiagnostics(page, "substack", "dashboard-link-missing");
    throw new PullError("UI_CHANGED", `Couldn't reach the Substack publication dashboard from ${page.url()}`, {
      hint: `Expected a "Dashboard" link on substack.com/home leading to /publish/. Re-check src/pull/platforms/substack.ts. Screenshot: ${join(diag, "screenshot.png")}`,
      diagnosticsDir: diag,
      cause,
    });
  }
  return new URL(page.url()).origin;
}

// Request a FRESH export in the Import/Export section, then poll for a NEW download link to show
// up. Substack generates the export server-side; a finished one exposes a direct file link at
// /api/v1/publication_export/<id>/file (aria-label "Download"). We snapshot the links present
// BEFORE clicking so we grab OUR new export, not a stale earlier one. (Verified against the live
// settings DOM 2026-07-03: the button is exactly "New export"; a broad /export/i match hit the
// "Import / Export" section nav link instead and only scrolled the page.)
async function exportAndDownload(page: Page, origin: string): Promise<Download> {
  try {
    await page.goto(`${origin}/publish/settings#import-export-settings`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
  } catch (cause) {
    throw new PullError("NETWORK", `Couldn't load Substack settings (${origin}/publish/settings)`, {
      hint: "Check your connection / that Substack opens in a normal browser.",
      cause,
    });
  }

  const exportHrefs = (): Promise<string[]> =>
    page
      .locator('a[href*="publication_export"]')
      .evaluateAll((els) =>
        els.map((e) => (e as HTMLAnchorElement).getAttribute("href") || "").filter(Boolean)
      );
  const before = new Set(await exportHrefs());

  // "New export" builds the full data export: posts.csv + per-post event logs + email list.
  const newExport = page
    .getByRole("button", { name: /new export/i })
    .or(page.getByRole("link", { name: /new export/i }))
    .first();
  try {
    await newExport.waitFor({ state: "visible", timeout: 15_000 });
    await newExport.click();
  } catch (cause) {
    const diag = await captureDiagnostics(page, "substack", "export-trigger-missing");
    throw new PullError("UI_CHANGED", `"New export" button not found in Substack Import/Export (${page.url()})`, {
      hint: `Check the "New export" button in the Import/Export section; update src/pull/platforms/substack.ts. Screenshot: ${join(diag, "screenshot.png")}`,
      diagnosticsDir: diag,
      cause,
    });
  }

  // Async: poll (up to 5 min) for an export link that wasn't present before the click.
  const deadline = Date.now() + 5 * 60_000;
  let freshHref: string | undefined;
  while (Date.now() < deadline) {
    freshHref = (await exportHrefs()).find((h) => !before.has(h));
    if (freshHref) break;
    await page.waitForTimeout(5_000);
  }
  if (!freshHref) {
    const diag = await captureDiagnostics(page, "substack", "no-download");
    throw new PullError("UI_CHANGED", `Export requested but no new download link appeared within 5 min on ${page.url()}`, {
      hint: `Substack may still be generating it or emails it instead — re-run, or check src/pull/platforms/substack.ts. Screenshot: ${join(diag, "screenshot.png")}`,
      diagnosticsDir: diag,
    });
  }

  try {
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 60_000 }),
      page.locator(`a[href="${freshHref}"]`).first().click(),
    ]);
    return download;
  } catch (cause) {
    const diag = await captureDiagnostics(page, "substack", "download-click-failed");
    throw new PullError("UI_CHANGED", `Found the export link but the download didn't start on ${page.url()}`, {
      hint: `The Download link may open a new tab or serve inline — check src/pull/platforms/substack.ts. Screenshot: ${join(diag, "screenshot.png")}`,
      diagnosticsDir: diag,
      cause,
    });
  }
}

export const substack: PlatformPuller = {
  platform: "substack",
  loginUrl: "https://substack.com/sign-in",

  async pull(context: BrowserContext): Promise<string[]> {
    const page = context.pages()[0] ?? (await context.newPage());

    // 1) Navigate — a failure here is connectivity (our side), not a UI change.
    try {
      await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    } catch (cause) {
      throw new PullError("NETWORK", `Couldn't load ${HOME_URL}`, {
        hint: "Check your connection / that Substack opens in a normal browser.",
        cause,
      });
    }

    // 2) Auth check — a sign-in wall means the saved session lapsed (re-login), NOT a UI change.
    if (looksLikeAuthWall(page.url())) {
      throw new PullError("SESSION_EXPIRED", `Substack redirected to a sign-in wall (${page.url()})`, {
        hint: "Run `npm run pull:login -- substack` and sign in again.",
      });
    }

    // 3) Dashboard → Settings → export (throws UI_CHANGED with diagnostics if the flow moved).
    const origin = await publicationOrigin(page);
    const download = await exportAndDownload(page, origin);

    // 4) Save + unpack. The full export is a .zip (posts.csv + per-post event logs) that
    //    parseSubstackExport reads as a FOLDER; a plain stats CSV is saved as-is for parseSubstack.
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const suggested = download.suggestedFilename();
      // The full export serves as a .zip (posts.csv + posts/ event logs + email list); the API
      // /file endpoint may not put ".zip" in the suggested name, so treat anything not-.csv as zip.
      if (!/\.csv$/i.test(suggested)) {
        const zipPath = join(tmpdir(), `substack-export-${stamp}.zip`);
        await download.saveAs(zipPath);
        const destDir = join(inboxDir("substack"), `substack-export-${stamp}`);
        mkdirSync(destDir, { recursive: true });
        // macOS ships `unzip`; preserve the posts/ subfolder structure the parser expects.
        const unzip = spawnSync("unzip", ["-o", zipPath, "-d", destDir], { encoding: "utf8" });
        if (unzip.status !== 0) {
          throw new Error(`unzip failed: ${(unzip.stderr || unzip.stdout || "").trim()}`);
        }
        return [destDir];
      }
      const dest = join(inboxDir("substack"), `substack-stats-${stamp}.csv`);
      await download.saveAs(dest);
      return [dest];
    } catch (cause) {
      throw new PullError("DOWNLOAD_FAILED", "Export downloaded but saving/unpacking it failed", {
        hint: "Check disk space / write permission for data/inbox/substack/ (and that `unzip` is available).",
        cause,
      });
    }
  },
};
