import { chromium, type BrowserContext } from "playwright";
import { profileDir } from "./paths.js";
import type { PullPlatform } from "./types.js";

// Launch a persistent Chrome profile for a platform. The profile dir holds the saved
// login, so `pull:login` (headed) signs in once and every later `pull` (headless)
// reuses those cookies with no password stored anywhere.
//
// We drive REAL Google Chrome (channel: "chrome"), not Playwright's bundled Chromium, and strip
// the automation tells — the "Chrome is being controlled by automated software" flag and
// navigator.webdriver. LinkedIn tolerated bundled Chromium, but X and Substack fingerprint it and
// block even the human login (X "temporarily limited your login"; Substack loops its captcha).
// Real Chrome + these flags lets the one-time interactive login through.
export async function launchPlatform(
  platform: PullPlatform,
  opts: { headed?: boolean } = {}
): Promise<BrowserContext> {
  const context = await chromium.launchPersistentContext(profileDir(platform), {
    channel: "chrome",
    headless: !opts.headed,
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
    ignoreDefaultArgs: ["--enable-automation"],
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });
  // Belt-and-suspenders: some bot checks read navigator.webdriver before the launch flag applies.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  return context;
}
