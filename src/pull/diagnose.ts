import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import type { Page } from "playwright";
import type { PullPlatform } from "./types.js";

const HOME = process.env.CONTENT_AGENTS_HOME || join(homedir(), ".content-agents");

// A login/checkpoint/authwall URL means the saved session is no longer valid — that's an
// expired login, NOT a UI change. Keeping the two apart is the core of triage.
export function looksLikeAuthWall(url: string): boolean {
  return /\/(login|checkpoint|authwall|uas|signup|challenge)/i.test(url);
}

// On failure, dump enough to tell a site UI change from our-side breakage WITHOUT
// re-running: a full-page screenshot, the URL, the page title, and the raw HTML. It
// captures your analytics screen, so it lives OUTSIDE the repo and is never committed.
export async function captureDiagnostics(
  page: Page,
  platform: PullPlatform,
  label: string
): Promise<string> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = join(HOME, "pull-diagnostics", `${platform}-${stamp}-${label}`);
  mkdirSync(dir, { recursive: true });
  try {
    await page.screenshot({ path: join(dir, "screenshot.png"), fullPage: true });
    writeFileSync(join(dir, "url.txt"), page.url());
    writeFileSync(join(dir, "title.txt"), await page.title());
    writeFileSync(join(dir, "page.html"), await page.content());
  } catch {
    // Page may be closed/detached by the time we get here — a partial bundle still helps.
  }
  return dir;
}
