import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setPublicDir("remotion/public");
Config.setOverwriteOutput(true);
Config.setVideoImageFormat("jpeg");

// Some sandboxed environments block the Chrome Headless Shell auto-download (network egress
// allowlist). Reuse the Playwright-managed Chromium headless shell already on disk there instead
// of failing the render. No-op (falls back to Remotion's own download) where that path is absent.
const PLAYWRIGHT_HEADLESS_SHELL =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
if (existsSync(PLAYWRIGHT_HEADLESS_SHELL)) {
  Config.setBrowserExecutable(PLAYWRIGHT_HEADLESS_SHELL);
}
