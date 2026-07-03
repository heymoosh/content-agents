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

// Request a fresh export, then poll the exports list for the Download link (it appears once the
// job finishes — can take minutes) and capture the file it downloads.
async function exportAndDownload(page: Page, origin: string): Promise<Download> {
  try {
    await page.goto(`${origin}/publish/settings`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  } catch (cause) {
    throw new PullError("NETWORK", `Couldn't load Substack settings (${origin}/publish/settings)`, {
      hint: "Check your connection / that Substack opens in a normal browser.",
      cause,
    });
  }

  const newExport = page
    .getByRole("button", { name: /new export|create.*export|export/i })
    .or(page.getByRole("link", { name: /new export|create.*export|export/i }))
    .first();
  try {
    await newExport.waitFor({ state: "visible", timeout: 15_000 });
    await newExport.click();
  } catch (cause) {
    const diag = await captureDiagnostics(page, "substack", "export-trigger-missing");
    throw new PullError("UI_CHANGED", `Export control not found in Substack settings (${page.url()})`, {
      hint: `Find the "Exports" section / "New export" button and update src/pull/platforms/substack.ts. Screenshot: ${join(diag, "screenshot.png")}`,
      diagnosticsDir: diag,
      cause,
    });
  }

  // Async: the Download link shows up once the export is built. Poll generously (5 min).
  const downloadLink = page.getByRole("link", { name: /download/i }).first();
  try {
    await downloadLink.waitFor({ state: "visible", timeout: 5 * 60_000 });
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 60_000 }),
      downloadLink.click(),
    ]);
    return download;
  } catch (cause) {
    const diag = await captureDiagnostics(page, "substack", "no-download");
    throw new PullError("UI_CHANGED", `Export requested but no Download link/download appeared on ${page.url()}`, {
      hint: `Substack may email the export, place it elsewhere, or need more time. Re-check src/pull/platforms/substack.ts. Screenshot: ${join(diag, "screenshot.png")}`,
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
      if (/\.zip$/i.test(suggested)) {
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
