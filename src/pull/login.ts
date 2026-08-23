import { createInterface } from "node:readline";
import { launchPlatform } from "./browser.js";
import { PULLERS } from "./registry.js";
import type { PullPlatform } from "./types.js";

// Platform-specific gotchas for the one-time human login (printed in the terminal).
const LOGIN_HINTS: Partial<Record<PullPlatform, string>> = {
  substack:
    'Substack prefers EMAIL sign-in over password: tick "I\'m not a robot", enter your email, then\n' +
    "  enter the 6-digit code — or, if it emails a magic LINK that opens your other browser, copy that\n" +
    "  link and paste it into THIS window's address bar so the session lands in this profile.",
  x:
    'If X says "We\'ve temporarily limited your login", close the window, wait a few minutes, and retry —\n' +
    "  it rate-limits repeated attempts.",
  threads:
    "Threads signs in with an INSTAGRAM account, not a separate Threads password. If the page offers\n" +
    "  \"Continue as <name>\", take it. Once you are in, scroll your own feed once before pressing Enter,\n" +
    "  so the session is fully established and not sitting on a half-loaded onboarding screen.",
};

// One-time interactive login. Opens a REAL (headed) browser at the platform's login
// page; you sign in by hand — password, 2FA, captcha, all of it — then press Enter.
// The persistent profile keeps the session so later `npm run pull` runs headless.
async function main() {
  const platform = process.argv[2] as PullPlatform;
  const puller = PULLERS[platform];
  if (!puller) {
    console.error(`usage: npm run pull:login -- <${Object.keys(PULLERS).join("|")}>`);
    process.exit(1);
  }

  const context = await launchPlatform(platform, { headed: true });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(puller.loginUrl);

  console.log(`\nA browser window opened for ${platform}.`);
  console.log("Log in fully (including any 2FA / captcha), then return here.");
  const hint = LOGIN_HINTS[platform];
  if (hint) console.log(`\n  ${hint}`);
  await new Promise<void>((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question("\nPress Enter once you're logged in and see your normal feed… ", () => {
      rl.close();
      resolve();
    });
  });

  await context.close();
  console.log(`\nSaved. From now on: npm run pull -- ${platform}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
