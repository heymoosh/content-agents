import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, chmodSync } from "node:fs";
import { repoRoot } from "../db/db.js";
import type { PullPlatform } from "./types.js";

// Saved logins live OUTSIDE the repo, in the shared infra dir (~/.content-agents),
// never in git. One persistent Chrome profile per platform IS the "saved session":
// its cookies/localStorage survive between runs, so we log in once and reuse it.
const HOME = process.env.CONTENT_AGENTS_HOME || join(homedir(), ".content-agents");

export function profileDir(platform: PullPlatform): string {
  const base = join(HOME, "browser-profiles");
  const dir = join(base, platform);
  mkdirSync(dir, { recursive: true });
  // Session cookies are sensitive — lock the dirs to the current user (best-effort; noop on Windows).
  try {
    chmodSync(base, 0o700);
    chmodSync(dir, 0o700);
  } catch {
    /* non-POSIX filesystem — skip */
  }
  return dir;
}

// Downloaded exports land in the exact folder `npm run ingest` reads from.
export function inboxDir(platform: PullPlatform): string {
  const dir = join(repoRoot, "data", "inbox", platform);
  mkdirSync(dir, { recursive: true });
  return dir;
}
