import { createInterface } from "node:readline";
import { launchPlatform } from "./browser.js";
import { PULLERS } from "./registry.js";
import type { PullPlatform } from "./types.js";

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
