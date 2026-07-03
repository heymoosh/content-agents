import { chromium, type BrowserContext } from "playwright";
import { profileDir } from "./paths.js";
import type { PullPlatform } from "./types.js";

// Launch a persistent Chrome profile for a platform. The profile dir holds the saved
// login, so `pull:login` (headed) signs in once and every later `pull` (headless)
// reuses those cookies with no password stored anywhere.
export async function launchPlatform(
  platform: PullPlatform,
  opts: { headed?: boolean } = {}
): Promise<BrowserContext> {
  return chromium.launchPersistentContext(profileDir(platform), {
    headless: !opts.headed,
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
  });
}
