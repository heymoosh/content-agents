import { spawnSync } from "node:child_process";
import { launchPlatform } from "./browser.js";
import { DEFAULT_PULL_PLATFORMS, PULLERS } from "./registry.js";
import { PullError, classifyUnknown, CULPRIT, type PullFailureKind } from "./errors.js";
import type { PullPlatform } from "./types.js";

// Headless: reuse the saved session, download the export into data/inbox/<platform>/,
// then (with --ingest) run the existing importer so the DB updates in one shot.
//
//   npm run pull -- linkedin            # download the export
//   npm run pull -- linkedin --ingest   # download, then npm run ingest
//   npm run pull -- linkedin --headed   # watch the browser to triage a failure
//   npm run pull                        # every configured platform

async function pullOne(platform: PullPlatform, headed: boolean): Promise<string[]> {
  const puller = PULLERS[platform];
  if (!puller) {
    throw new PullError("SETUP", `no puller for "${platform}" (have: ${Object.keys(PULLERS).join(", ")})`, {
      hint: "Check the platform name.",
    });
  }
  const context = await launchPlatform(platform, { headed });
  try {
    const files = await puller.pull(context);
    for (const f of files) console.log(`  ↓ ${f}`);
    return files;
  } finally {
    await context.close();
  }
}

// The triage verdict: every failure says WHOSE fault it is (site UI vs our side),
// what happened, how to fix it, and where the diagnostics bundle landed.
function reportFailure(platform: string, err: unknown): PullFailureKind {
  const kind = err instanceof PullError ? err.kind : classifyUnknown(err);
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\n✗ ${platform} — FAILED`);
  console.error(`  culprit: ${CULPRIT[kind]}`);
  console.error(`  what:    ${msg}`);
  if (err instanceof PullError && err.hint) console.error(`  fix:     ${err.hint}`);
  else if (kind === "SETUP") console.error(`  fix:     npm install && npx playwright install chromium`);
  if (err instanceof PullError && err.diagnosticsDir) console.error(`  diag:    ${err.diagnosticsDir}`);
  return kind;
}

async function main() {
  const args = process.argv.slice(2);
  const headed = args.includes("--headed");
  const runIngest = args.includes("--ingest");
  const targets = args.filter((a) => !a.startsWith("--")) as PullPlatform[];
  const platforms = targets.length ? targets : DEFAULT_PULL_PLATFORMS;

  let pulled = 0;
  const failures: { platform: string; kind: PullFailureKind }[] = [];
  for (const p of platforms) {
    console.log(`\n▶ ${p}`);
    try {
      pulled += (await pullOne(p, headed)).length;
      console.log(`✓ ${p} — ok`);
    } catch (e) {
      // Isolate failures: one dead session or UI change must not abort the other platforms.
      failures.push({ platform: p, kind: reportFailure(p, e) });
    }
  }

  if (runIngest && pulled) {
    console.log("\nrunning ingest…");
    spawnSync("npm", ["run", "ingest"], { stdio: "inherit" });
  }

  console.log(`\n─ done: ${pulled} file(s) pulled, ${failures.length} platform(s) failed ─`);
  const uiChanges = failures.filter((f) => f.kind === "UI_CHANGED").map((f) => f.platform);
  if (uiChanges.length) {
    console.error(`  ⚠ ${uiChanges.join(", ")}: the site's UI changed — update selectors (see the diag bundle above).`);
  }
  if (failures.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
